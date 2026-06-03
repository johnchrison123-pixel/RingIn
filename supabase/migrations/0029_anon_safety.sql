-- ────────────────────────────────────────────────────────────────────────
-- R46 — Anonymous safety primitives + matchmaker hardening + queue count.
--
-- 1. anon_excluded   — persistent exclude list (Find Next + Block both write here)
-- 2. anon_blocks     — explicit blocks (subset of excluded but tracked separately
--                      so we can show "Blocked Users" UI + admin can audit)
-- 3. anon_reports    — abuse reports with reason category, for ringin-admin
-- 4. block_anon RPC  — atomic block + exclude + drop connection + drop pending requests
-- 5. report_anon RPC — categorized report (harassment / sexual / underage / scam / hate / other)
-- 6. anonymous_enqueue_and_match — extended to enforce anon_excluded server-side
--                                  (DROP + recreate to ensure clean replacement)
-- 7. actively_searching_count view — replaces available_anon_count for the UI.
--    The old view counts everyone with is_available_anon=true; this one counts
--    only people currently in the queue waiting for a match (last 40 sec).
-- ────────────────────────────────────────────────────────────────────────

-- 1. anon_excluded
create table if not exists public.anon_excluded (
  excluder_id uuid not null references auth.users(id) on delete cascade,
  excluded_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'find_next'
    check (reason in ('find_next','block')),
  created_at timestamptz not null default now(),
  primary key (excluder_id, excluded_id)
);
create index if not exists ae_by_excluder on public.anon_excluded (excluder_id);
alter table public.anon_excluded enable row level security;
drop policy if exists "ae_read" on public.anon_excluded;
create policy "ae_read" on public.anon_excluded
  for select using (auth.uid()::text = excluder_id::text);

-- 2. anon_blocks
create table if not exists public.anon_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.anon_blocks enable row level security;
drop policy if exists "ab_read" on public.anon_blocks;
create policy "ab_read" on public.anon_blocks
  for select using (auth.uid()::text = blocker_id::text);

-- 3. anon_reports
create table if not exists public.anon_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_id   uuid not null references auth.users(id) on delete cascade,
  reason      text not null
    check (reason in ('harassment','sexual','underage','scam','hate','other')),
  context     text not null default 'call'
    check (context in ('call','message','profile')),
  context_id  text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists ar_target_idx on public.anon_reports (target_id, created_at desc);
alter table public.anon_reports enable row level security;
drop policy if exists "ar_read_self" on public.anon_reports;
create policy "ar_read_self" on public.anon_reports
  for select using (auth.uid()::text = reporter_id::text);

-- 4. block_anon RPC — atomic block + exclude + leave connection
create or replace function public.block_anon(p_target uuid)
returns jsonb language plpgsql security definer as $$
declare canon_a uuid; canon_b uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target = auth.uid() then raise exception 'cannot block yourself'; end if;

  insert into public.anon_blocks (blocker_id, blocked_id)
  values (auth.uid(), p_target) on conflict do nothing;

  insert into public.anon_excluded (excluder_id, excluded_id, reason)
  values (auth.uid(), p_target, 'block')
  on conflict (excluder_id, excluded_id) do update set reason = 'block';

  /* Drop any existing connection between us. */
  canon_a := least(auth.uid()::text, p_target::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_target::text)::uuid;
  delete from public.anon_connections where user_a = canon_a and user_b = canon_b;

  /* Cancel any pending requests both ways. */
  delete from public.anon_connection_requests
    where (requester_id = auth.uid() and recipient_id = p_target)
       or (requester_id = p_target and recipient_id = auth.uid());

  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.block_anon(uuid) from public;
grant execute on function public.block_anon(uuid) to authenticated;

-- 5. report_anon RPC
create or replace function public.report_anon(
  p_target     uuid,
  p_reason     text,
  p_context    text default 'call',
  p_context_id text default null,
  p_note       text default null
) returns jsonb language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target = auth.uid() then raise exception 'cannot report yourself'; end if;
  if p_reason not in ('harassment','sexual','underage','scam','hate','other') then
    raise exception 'invalid reason';
  end if;
  if p_context not in ('call','message','profile') then
    raise exception 'invalid context';
  end if;
  insert into public.anon_reports (reporter_id, target_id, reason, context, context_id, note)
  values (auth.uid(), p_target, p_reason, p_context, p_context_id, p_note);
  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.report_anon(uuid, text, text, text, text) from public;
grant execute on function public.report_anon(uuid, text, text, text, text) to authenticated;

-- 6. Updated matchmaker — enforces anon_excluded (server-side, persistent)
drop function if exists public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb);
create or replace function public.anonymous_enqueue_and_match(
  p_interests jsonb default '[]'::jsonb,
  p_same_geo boolean default true,
  p_geo_country text default null,
  p_geo_city text default null,
  p_exclude jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer as $$
declare
  my_id uuid := auth.uid();
  my_nick text; my_avatar text; my_gender text; my_pref text;
  partner_id uuid; partner_nick text; partner_avatar text; partner_gender text;
  new_channel text;
begin
  if my_id is null then raise exception 'not authenticated'; end if;

  select anon_nickname,
         coalesce(anon_avatar, 'girl1'),
         coalesce(gender, anon_gender, 'f'),
         coalesce(anon_preference, 'both')
    into my_nick, my_avatar, my_gender, my_pref
    from public.profiles where id = my_id;
  if my_nick is null or length(trim(my_nick)) = 0 then my_nick := 'Anonymous'; end if;

  insert into public.anonymous_queue (
    user_id, joined_at, interests, same_geo, geo_country, geo_city, exclude_user_ids, status,
    matched_with, matched_at, channel_id, nickname, avatar, gender, preference
  ) values (
    my_id, now(), coalesce(p_interests, '[]'::jsonb), coalesce(p_same_geo, true),
    p_geo_country, p_geo_city, coalesce(p_exclude, '[]'::jsonb), 'waiting',
    null, null, null, my_nick, my_avatar, my_gender, my_pref
  ) on conflict (user_id) do update
    set joined_at = now(), interests = excluded.interests, same_geo = excluded.same_geo,
        geo_country = excluded.geo_country, geo_city = excluded.geo_city,
        exclude_user_ids = excluded.exclude_user_ids,
        status = 'waiting', matched_with = null, matched_at = null, channel_id = null,
        nickname = excluded.nickname, avatar = excluded.avatar,
        gender = excluded.gender, preference = excluded.preference;

  with candidates as (
    select q.user_id, q.joined_at, q.nickname, q.avatar, q.gender,
      (
        coalesce((select count(*)::int * 10
          from jsonb_array_elements_text(coalesce(p_interests, '[]'::jsonb)) my_i
          where my_i in (select v::text from jsonb_array_elements_text(q.interests) v)), 0)
        + case when coalesce(p_same_geo, true) and p_geo_city is not null and q.geo_city = p_geo_city then 5 else 0 end
        + (extract(epoch from (now() - q.joined_at)) / 10.0)
      ) as score
    from public.anonymous_queue q
    where q.status = 'waiting' and q.user_id <> my_id
      and not (q.user_id::text in (select jsonb_array_elements_text(coalesce(p_exclude, '[]'::jsonb))))
      and not (my_id::text in (select jsonb_array_elements_text(q.exclude_user_ids)))
      and q.joined_at > now() - interval '2 minutes'
      and (my_pref = 'both' or (my_pref = 'men' and q.gender = 'm') or (my_pref = 'women' and q.gender = 'f'))
      and (coalesce(q.preference, 'both') = 'both'
           or (q.preference = 'men' and my_gender = 'm')
           or (q.preference = 'women' and my_gender = 'f'))
      /* R46: server-side persistent exclude — both directions. If either
       * user has excluded the other (via Find Next OR Block), no match. */
      and not exists (select 1 from public.anon_excluded ae
                      where ae.excluder_id = my_id and ae.excluded_id = q.user_id)
      and not exists (select 1 from public.anon_excluded ae
                      where ae.excluder_id = q.user_id and ae.excluded_id = my_id)
  )
  select user_id, nickname, avatar, gender
    into partner_id, partner_nick, partner_avatar, partner_gender
    from candidates order by score desc, joined_at asc limit 1 for update skip locked;

  if partner_id is null then return jsonb_build_object('status', 'waiting'); end if;

  new_channel := 'anon-' || replace(gen_random_uuid()::text, '-', '');
  update public.anonymous_queue set status = 'matched', matched_with = partner_id,
    matched_at = now(), channel_id = new_channel where user_id = my_id;
  update public.anonymous_queue set status = 'matched', matched_with = my_id,
    matched_at = now(), channel_id = new_channel
    where user_id = partner_id and status = 'waiting';

  return jsonb_build_object('status', 'matched', 'partner_id', partner_id,
    'partner_nickname', partner_nick, 'partner_avatar', partner_avatar,
    'partner_gender', partner_gender, 'channel_id', new_channel,
    'is_caller', my_id::text > partner_id::text);
end;
$$;
revoke all on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) from public;
grant execute on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) to authenticated;

-- 7. actively_searching_count view — replaces available_anon_count for the
--    online indicator on the Anonymous Connect screen. Counts only people
--    currently waiting in the matchmaker queue (last 40 sec), not the
--    full set of users with "available" toggled on.
create or replace view public.actively_searching_count as
  select count(*)::int as count
  from public.anonymous_queue
  where status = 'waiting'
    and joined_at > now() - interval '40 seconds';
grant select on public.actively_searching_count to authenticated;

-- 8. add_anon_exclude RPC — called by Find Next to make the partner skip permanent
create or replace function public.add_anon_exclude(p_target uuid)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target = auth.uid() then return; end if;
  insert into public.anon_excluded (excluder_id, excluded_id, reason)
  values (auth.uid(), p_target, 'find_next')
  on conflict (excluder_id, excluded_id) do nothing;
end;
$$;
revoke all on function public.add_anon_exclude(uuid) from public;
grant execute on function public.add_anon_exclude(uuid) to authenticated;
