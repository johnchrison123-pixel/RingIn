-- ════════════════════════════════════════════════════════════════════
-- R59 — Big feature batch.
--
-- Bundles four things into ONE paste so the user only runs migrations
-- once this round:
--
--   1. HOST RATINGS — 1-5 star post-call rating with cached sum/count
--      on profiles, surfaced in list_available_hosts ordering.
--   2. PPV CREATOR POSTS — per-post paywall_coins column + unlock RPC
--      that debits the fan and credits the creator 45% as neons.
--   3. MASS DM TO SUBSCRIBERS — broadcast_to_subscribers RPC that fans
--      out one message into the messages table, rate-limited 1/24h.
--   4. SELF-CALL LAUNDERING GUARD — block caller_id = callee_id in
--      deduct_call_coins (prevents two-account neon laundering).
--
-- Also RE-APPLIES the R58 column-level REVOKEs in case the original
-- 0038 paste rolled back silently. revoke update is idempotent — safe
-- to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ════════ R58 retry (safe to re-apply) ════════

drop policy if exists "profiles_update_own_safe" on public.profiles;
create policy "profiles_update_own_safe" on public.profiles
  for update
  using (auth.uid()::text = id::text)
  with check (auth.uid()::text = id::text);

revoke update (coins) on public.profiles from authenticated;
revoke update (neons) on public.profiles from authenticated;
revoke update (is_host) on public.profiles from authenticated;
revoke update (host_rate_per_min) on public.profiles from authenticated;
revoke update (host_total_calls) on public.profiles from authenticated;
revoke update (gender) on public.profiles from authenticated;

-- ════════ R59 #1: HOST RATINGS ════════

create table if not exists public.host_ratings (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null,
  rater_id        uuid not null,
  call_invite_id  uuid,
  stars           integer not null check (stars between 1 and 5),
  note            text,
  created_at      timestamptz not null default now(),
  unique (host_id, rater_id, call_invite_id)
);

create index if not exists hr_by_host on public.host_ratings (host_id, created_at desc);

alter table public.host_ratings enable row level security;
drop policy if exists "hr_read_all" on public.host_ratings;
create policy "hr_read_all" on public.host_ratings for select using (true);
grant select on public.host_ratings to authenticated;

alter table public.profiles
  add column if not exists host_rating_sum integer not null default 0;
alter table public.profiles
  add column if not exists host_rating_count integer not null default 0;
revoke update (host_rating_sum) on public.profiles from authenticated;
revoke update (host_rating_count) on public.profiles from authenticated;

/* rate_host(host_id, call_invite_id, stars, note?) — fan rates host
 * after a paid host call. Idempotent: re-rating same call updates the
 * existing row. Verifies the call belonged to the caller. */
create or replace function public.rate_host(
  p_host_id uuid,
  p_call_invite_id uuid,
  p_stars integer,
  p_note text default null
)
returns jsonb language plpgsql security definer as $$
declare
  inv record;
  old_stars integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be 1-5';
  end if;
  if p_host_id is null then raise exception 'host id required'; end if;
  if p_host_id = auth.uid() then raise exception 'cannot rate yourself'; end if;

  if p_call_invite_id is not null then
    select * into inv from public.call_invites where id = p_call_invite_id;
    if inv is null then raise exception 'call not found'; end if;
    if inv.caller_id <> auth.uid() then raise exception 'not your call'; end if;
    if inv.callee_id <> p_host_id then raise exception 'host did not receive this call'; end if;
  end if;

  select stars into old_stars from public.host_ratings
   where host_id = p_host_id
     and rater_id = auth.uid()
     and call_invite_id is not distinct from p_call_invite_id;

  if old_stars is null then
    insert into public.host_ratings (host_id, rater_id, call_invite_id, stars, note)
    values (p_host_id, auth.uid(), p_call_invite_id, p_stars, p_note);

    update public.profiles
       set host_rating_sum = host_rating_sum + p_stars,
           host_rating_count = host_rating_count + 1
     where id = p_host_id;
  else
    update public.host_ratings
       set stars = p_stars, note = p_note, created_at = now()
     where host_id = p_host_id
       and rater_id = auth.uid()
       and call_invite_id is not distinct from p_call_invite_id;

    update public.profiles
       set host_rating_sum = host_rating_sum - old_stars + p_stars
     where id = p_host_id;
  end if;

  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.rate_host(uuid, uuid, integer, text) from public;
grant execute on function public.rate_host(uuid, uuid, integer, text) to authenticated;

/* list_available_hosts — re-create to include rating columns and rank
 * by rating desc, then total calls desc. */
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
  total_calls    integer,
  rating_avg     numeric,
  rating_count   integer
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      p.id,
      coalesce(p.anon_nickname, 'Anonymous')::text,
      coalesce(p.anon_avatar, 'girl1')::text,
      coalesce(p.gender, p.anon_gender, 'f')::text,
      coalesce(p.anon_languages, '[]'::jsonb),
      coalesce(p.anon_caption, '')::text,
      coalesce(p.anon_from, '')::text,
      p.host_rate_per_min,
      coalesce(p.host_total_calls, 0),
      (case when coalesce(p.host_rating_count, 0) > 0
            then round(p.host_rating_sum::numeric / p.host_rating_count, 2)
            else null end)::numeric,
      coalesce(p.host_rating_count, 0)
    from public.profiles p
    where coalesce(p.is_host, false) = true
      and coalesce(p.is_available_anon, false) = true
      and (p.available_until is null or p.available_until > now())
      and p.id <> auth.uid()
    order by
      (case when coalesce(p.host_rating_count, 0) > 0
            then p.host_rating_sum::numeric / p.host_rating_count
            else 0 end) desc,
      coalesce(p.host_total_calls, 0) desc
    limit coalesce(p_limit, 50);
end;
$$;
revoke all on function public.list_available_hosts(integer) from public;
grant execute on function public.list_available_hosts(integer) to authenticated;

-- ════════ R59 #2: PPV CREATOR POSTS ════════

/* paywall_coins on creator_posts:
 *   null   → free for active subscribers (default behavior)
 *   > 0    → locked even for subs, costs that many coins to unlock once
 *           (unlocks are permanent per fan; one-time charge)
 */
alter table public.creator_posts add column if not exists paywall_coins integer;

create table if not exists public.creator_post_unlocks (
  post_id     uuid not null references public.creator_posts(id) on delete cascade,
  fan_id      uuid not null,
  coins_paid  integer not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, fan_id)
);

alter table public.creator_post_unlocks enable row level security;
drop policy if exists "cpu_read_own" on public.creator_post_unlocks;
create policy "cpu_read_own" on public.creator_post_unlocks
  for select using (fan_id::text = auth.uid()::text);
grant select on public.creator_post_unlocks to authenticated;

create or replace function public.unlock_creator_post(p_post_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  pst record;
  fan_bal integer;
  creator_share integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into pst from public.creator_posts where id = p_post_id;
  if pst is null then raise exception 'post not found'; end if;
  if pst.creator_id = auth.uid() then
    return jsonb_build_object('status','own_post');
  end if;
  if pst.paywall_coins is null or pst.paywall_coins <= 0 then
    return jsonb_build_object('status','free','reason','no_paywall');
  end if;

  if exists (select 1 from public.creator_post_unlocks
              where post_id = p_post_id and fan_id = auth.uid()) then
    return jsonb_build_object('status','already_unlocked');
  end if;

  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < pst.paywall_coins then
    raise exception 'insufficient coins';
  end if;

  /* 45% creator split (same as subscription split) */
  creator_share := (pst.paywall_coins * 45) / 100;

  update public.profiles
     set coins = fan_bal - pst.paywall_coins
   where id = auth.uid();
  update public.profiles
     set neons = coalesce(neons, 0) + creator_share
   where id = pst.creator_id;

  insert into public.creator_post_unlocks (post_id, fan_id, coins_paid)
  values (p_post_id, auth.uid(), pst.paywall_coins);

  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'ppv_unlock', 'Unlocked premium post', -pst.paywall_coins, 0);

  return jsonb_build_object(
    'status','ok',
    'paid', pst.paywall_coins,
    'creator_neons', creator_share
  );
end;
$$;
revoke all on function public.unlock_creator_post(uuid) from public;
grant execute on function public.unlock_creator_post(uuid) to authenticated;

-- ════════ R59 #3: MASS DM TO SUBSCRIBERS ════════

alter table public.messages add column if not exists is_broadcast boolean default false;
alter table public.profiles add column if not exists last_broadcast_at timestamptz;
revoke update (last_broadcast_at) on public.profiles from authenticated;

/* broadcast_to_subscribers(text) — creator sends one message to ALL
 * active subscribers. Inserts one messages row per subscriber so each
 * recipient sees it as a normal DM. Rate-limited 1 per 24h to prevent
 * spam. Max 2000 chars. */
create or replace function public.broadcast_to_subscribers(p_text text)
returns jsonb language plpgsql security definer as $$
declare
  my_id     uuid := auth.uid();
  my_name   text;
  trimmed   text;
  recipient record;
  conv_id   text;
  count_sent integer := 0;
  last_b    timestamptz;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  trimmed := nullif(trim(coalesce(p_text, '')), '');
  if trimmed is null then raise exception 'empty message'; end if;
  if length(trimmed) > 2000 then raise exception 'message too long (max 2000 chars)'; end if;

  select last_broadcast_at into last_b from public.profiles where id = my_id;
  if last_b is not null and last_b > now() - interval '24 hours' then
    raise exception 'rate limit: 1 broadcast per 24 hours';
  end if;

  select coalesce(full_name, 'Creator') into my_name from public.profiles where id = my_id;

  for recipient in
    select distinct sa.subscriber_id as sub_id
      from public.subscriptions_active sa
     where sa.creator_id = my_id
       and sa.status in ('active','trialing')
       and (sa.expires_at is null or sa.expires_at > now())
  loop
    conv_id := least(my_id::text, recipient.sub_id::text)
            || '_'
            || greatest(my_id::text, recipient.sub_id::text);

    insert into public.messages
      (conversation_id, sender_id, sender_name, receiver_id, text, read, is_broadcast)
    values
      (conv_id, my_id, my_name, recipient.sub_id, trimmed, false, true);

    count_sent := count_sent + 1;
  end loop;

  update public.profiles set last_broadcast_at = now() where id = my_id;

  return jsonb_build_object('status','ok','sent_to', count_sent);
end;
$$;
revoke all on function public.broadcast_to_subscribers(text) from public;
grant execute on function public.broadcast_to_subscribers(text) to authenticated;

-- ════════ R59 #4: SELF-CALL LAUNDERING GUARD ════════

/* Re-create deduct_call_coins with one extra guard: if caller_id =
 * callee_id (two accounts owned by same person), refuse to convert
 * coins → 40% neons. Rest of logic unchanged from 0038. */
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

  select * into inv from public.call_invites where id = p_invite_id for update;
  if inv is null then raise exception 'invite not found'; end if;

  if coalesce(inv.coins_settled, false) then
    return jsonb_build_object('status','already_settled');
  end if;
  if inv.caller_id <> auth.uid() then
    return jsonb_build_object('status','skipped','reason','not_caller');
  end if;

  /* R59 self-call guard: refuse to launder via same-user calls. */
  if inv.callee_id is not null and inv.caller_id = inv.callee_id then
    update public.call_invites set coins_settled = true where id = p_invite_id;
    return jsonb_build_object('status','skipped','reason','self_call_blocked');
  end if;

  if inv.rate_per_min is null or inv.rate_per_min <= 0 then
    update public.call_invites set coins_settled = true where id = p_invite_id;
    return jsonb_build_object('status','skipped','reason','no_rate');
  end if;

  if inv.started_at is null then
    update public.call_invites set coins_settled = true where id = p_invite_id;
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

  update public.call_invites
     set coins_settled = true,
         ended_at = coalesce(ended_at, now())
   where id = p_invite_id;

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
