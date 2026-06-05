-- ────────────────────────────────────────────────────────────────────────
-- R57 — FRND-style host mode for Anonymous Connect.
--
-- Women can opt in to "Host Mode" and set a per-minute rate. Callers
-- (any gender) can either:
--   - Random Host: matched with any online host (server picks)
--   - Browse Hosts: pick a specific host from a list
--
-- Both flows go through the existing call_invites + Agora pipeline with
-- the host's rate, anonymous nicknames + avatars, and the caller is
-- charged per-minute by deduct_call_coins (R55) which now also credits
-- the host 40% of every deducted coin as neons.
--
-- Confined to Anonymous Connect — no other surface affected. The is_host
-- column is opt-in (default false) so existing profiles are unaffected.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Profile columns (idempotent)
alter table public.profiles
  add column if not exists is_host boolean not null default false;
alter table public.profiles
  add column if not exists host_rate_per_min integer not null default 15;
alter table public.profiles
  add column if not exists host_total_calls integer not null default 0;
alter table public.profiles
  drop constraint if exists profiles_host_rate_check;
alter table public.profiles
  add constraint profiles_host_rate_check
  check (host_rate_per_min >= 5 and host_rate_per_min <= 100);

-- 2. set_host_mode — toggle host status + optional rate update.
--    Gender-gated: only profiles.gender = 'f' can enable for v1.
create or replace function public.set_host_mode(
  p_enabled boolean,
  p_rate    integer default null
) returns jsonb language plpgsql security definer as $$
declare my_gender text; my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  select coalesce(gender, anon_gender) into my_gender from public.profiles where id = my_id;
  if p_enabled and (my_gender is null or my_gender <> 'f') then
    raise exception 'host mode is only available for female accounts at this time';
  end if;
  if p_rate is not null and (p_rate < 5 or p_rate > 100) then
    raise exception 'rate must be between 5 and 100 coins/min';
  end if;
  update public.profiles set
    is_host = p_enabled,
    host_rate_per_min = coalesce(p_rate, host_rate_per_min)
    where id = my_id;
  return jsonb_build_object('status','ok','is_host', p_enabled);
end;
$$;
revoke all on function public.set_host_mode(boolean, integer) from public;
grant execute on function public.set_host_mode(boolean, integer) to authenticated;

-- 3. list_available_hosts — for the Browse Hosts feed.
--    Filters to hosts currently online + excludes hosts the caller has
--    blocked (or who have blocked the caller) via anon_blocks.
create or replace function public.list_available_hosts(p_limit integer default 50)
returns table (
  user_id        uuid,
  nickname       text,
  avatar         text,
  gender         text,
  languages      jsonb,
  caption        text,
  from_loc       text,
  rate_per_min   integer,
  total_calls    integer
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      p.id as user_id,
      coalesce(p.anon_nickname, 'Anonymous') as nickname,
      coalesce(p.anon_avatar, 'girl1') as avatar,
      coalesce(p.gender, p.anon_gender) as gender,
      coalesce(p.anon_languages, '[]'::jsonb) as languages,
      p.anon_caption as caption,
      p.anon_from as from_loc,
      p.host_rate_per_min as rate_per_min,
      p.host_total_calls as total_calls
    from public.profiles p
    where p.is_host = true
      and coalesce(p.is_available_anon, false) = true
      and (p.available_until is null or p.available_until > now())
      and p.id <> auth.uid()
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = auth.uid() and ab.blocked_id = p.id)
           or (ab.blocker_id = p.id and ab.blocked_id = auth.uid())
      )
      and not exists (
        select 1 from public.anon_excluded ae
        where (ae.excluder_id = auth.uid() and ae.excluded_id = p.id)
           or (ae.excluder_id = p.id and ae.excluded_id = auth.uid())
      )
    order by p.host_total_calls desc, p.id
    limit coalesce(p_limit, 50);
end;
$$;
revoke all on function public.list_available_hosts(integer) from public;
grant execute on function public.list_available_hosts(integer) to authenticated;

-- 4. find_random_host — pick one online host at random.
--    Used by the "🎲 Random Host" button.
create or replace function public.find_random_host()
returns table (
  user_id        uuid,
  nickname       text,
  avatar         text,
  gender         text,
  rate_per_min   integer
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      p.id as user_id,
      coalesce(p.anon_nickname, 'Anonymous') as nickname,
      coalesce(p.anon_avatar, 'girl1') as avatar,
      coalesce(p.gender, p.anon_gender) as gender,
      p.host_rate_per_min as rate_per_min
    from public.profiles p
    where p.is_host = true
      and coalesce(p.is_available_anon, false) = true
      and (p.available_until is null or p.available_until > now())
      and p.id <> auth.uid()
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = auth.uid() and ab.blocked_id = p.id)
           or (ab.blocker_id = p.id and ab.blocked_id = auth.uid())
      )
      and not exists (
        select 1 from public.anon_excluded ae
        where (ae.excluder_id = auth.uid() and ae.excluded_id = p.id)
           or (ae.excluder_id = p.id and ae.excluded_id = auth.uid())
      )
    order by random()
    limit 1;
end;
$$;
revoke all on function public.find_random_host() from public;
grant execute on function public.find_random_host() to authenticated;

-- 5. Update deduct_call_coins to ALSO credit the callee 40% as neons
--    when the call has a paid rate. This:
--      - Pays hosts their 40% on host calls (R57 model)
--      - Also retroactively fixes expert-call payouts (audit Bug 5)
--    Anonymous-but-free calls (rate = 0) are still skipped.
create or replace function public.deduct_call_coins(p_invite_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  inv record;
  minutes_elapsed integer;
  total_due integer;
  cur_bal integer;
  new_bal integer;
  actually_deducted integer;
  host_share integer;
  expert_label text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_invite_id is null then raise exception 'invite id required'; end if;

  select * into inv from public.call_invites where id = p_invite_id;
  if inv is null then raise exception 'invite not found'; end if;

  if inv.caller_id <> auth.uid() then
    return jsonb_build_object('status','skipped','reason','not_caller');
  end if;

  /* No charge if there's no rate — covers free anon calls AND any other
   * call type that didn't set a rate. The is_anonymous flag is no longer
   * checked because host calls are anonymous + paid simultaneously. */
  if inv.rate_per_min is null or inv.rate_per_min <= 0 then
    return jsonb_build_object('status','skipped','reason','no_rate');
  end if;

  if inv.started_at is null then
    return jsonb_build_object('status','skipped','reason','never_connected');
  end if;

  minutes_elapsed := greatest(
    1,
    ceil(extract(epoch from (coalesce(inv.ended_at, now()) - inv.started_at)) / 60.0)::integer
  );
  total_due := minutes_elapsed * inv.rate_per_min;

  select coins into cur_bal from public.profiles where id = auth.uid() for update;
  if cur_bal is null then raise exception 'profile not found'; end if;

  actually_deducted := least(total_due, greatest(0, cur_bal));
  new_bal := greatest(0, cur_bal - actually_deducted);

  update public.profiles set coins = new_bal where id = auth.uid();

  /* R57: credit the host/expert (callee) 40% in neons of what was
   * actually deducted from the caller. */
  if inv.callee_id is not null and actually_deducted > 0 then
    host_share := (actually_deducted * 40) / 100;
    if host_share > 0 then
      update public.profiles
        set neons = coalesce(neons, 0) + host_share,
            host_total_calls = host_total_calls + 1
        where id = inv.callee_id;
    end if;
  end if;

  expert_label := coalesce(inv.callee_name, 'host');
  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'call', 'Call with ' || expert_label, -actually_deducted, 0);

  return jsonb_build_object(
    'status','ok',
    'new_balance', new_bal,
    'deducted', actually_deducted,
    'minutes', minutes_elapsed,
    'rate', inv.rate_per_min,
    'host_neons_credited', coalesce(host_share, 0)
  );
end;
$$;
revoke all on function public.deduct_call_coins(uuid) from public;
grant execute on function public.deduct_call_coins(uuid) to authenticated;
