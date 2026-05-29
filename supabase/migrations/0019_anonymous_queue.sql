-- ────────────────────────────────────────────────────────────────────────
-- Anonymous Connect matchmaking queue.
--
-- Flow:
--   1. User taps "Find Someone" → client calls anonymous_enqueue_and_match
--      which atomically inserts/updates their row AND immediately searches
--      for a waiting partner. If found, both rows flip to status='matched'
--      in one DB transaction and the match info returns to the client.
--   2. If no partner found on first call, client polls anonymous_check_match
--      every 2 sec for up to 30 sec. When ANOTHER user tries to match, their
--      enqueue RPC will find this user and mark BOTH matched — the polling
--      client will see status='matched' on its own row and proceed.
--   3. The "caller" (deterministically: user with the larger UUID) initiates
--      the call via the existing call_invites pipeline. The "callee" sees
--      the standard incoming-call ring.
--   4. On skip → leave queue + re-enqueue with the skipped partner added to
--      exclude_user_ids so they don't match again.
--
-- Matching score = +10 per shared interest + 5 if same geo + 0.1/sec wait age
-- (older entries get priority — fairness while still preferring interest match)
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.anonymous_queue (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  interests        jsonb not null default '[]'::jsonb,
  same_geo         boolean not null default true,
  geo_country      text,
  geo_city         text,
  exclude_user_ids jsonb not null default '[]'::jsonb,
  status           text not null default 'waiting'
    check (status in ('waiting','matched','expired','cancelled')),
  matched_with     uuid references auth.users(id),
  matched_at       timestamptz,
  channel_id       text,
  created_at       timestamptz not null default now()
);

alter table public.anonymous_queue enable row level security;

-- Read: own row OR partner row (so both sides can see channel + each other)
drop policy if exists "aq_read" on public.anonymous_queue;
create policy "aq_read" on public.anonymous_queue
  for select using (
    auth.uid()::text = user_id::text
    or auth.uid()::text = matched_with::text
  );

drop policy if exists "aq_insert_own" on public.anonymous_queue;
create policy "aq_insert_own" on public.anonymous_queue
  for insert with check (auth.uid()::text = user_id::text);

drop policy if exists "aq_update_own" on public.anonymous_queue;
create policy "aq_update_own" on public.anonymous_queue
  for update using (auth.uid()::text = user_id::text);

drop policy if exists "aq_delete_own" on public.anonymous_queue;
create policy "aq_delete_own" on public.anonymous_queue
  for delete using (auth.uid()::text = user_id::text);

-- ────────────────────────────────────────────────────────────────────────
-- Main RPC: enqueue + atomic try-match. SECURITY DEFINER so it can update
-- the partner's row (their RLS would otherwise reject our update).
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.anonymous_enqueue_and_match(
  p_interests jsonb default '[]'::jsonb,
  p_same_geo boolean default true,
  p_geo_country text default null,
  p_geo_city text default null,
  p_exclude jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  my_id uuid := auth.uid();
  partner_id uuid;
  new_channel text;
begin
  if my_id is null then raise exception 'not authenticated'; end if;

  -- 1) Upsert my own queue row. If already matched, this re-enqueues me
  -- (e.g., after a skip — partner was added to my exclude list).
  insert into public.anonymous_queue (
    user_id, joined_at, interests, same_geo, geo_country, geo_city, exclude_user_ids, status,
    matched_with, matched_at, channel_id
  ) values (
    my_id, now(), coalesce(p_interests, '[]'::jsonb), coalesce(p_same_geo, true),
    p_geo_country, p_geo_city, coalesce(p_exclude, '[]'::jsonb), 'waiting',
    null, null, null
  )
  on conflict (user_id) do update
    set joined_at = now(),
        interests = excluded.interests,
        same_geo = excluded.same_geo,
        geo_country = excluded.geo_country,
        geo_city = excluded.geo_city,
        exclude_user_ids = excluded.exclude_user_ids,
        status = 'waiting',
        matched_with = null,
        matched_at = null,
        channel_id = null;

  -- 2) Find best partner: most shared interests, then oldest waiter (fairness).
  -- FOR UPDATE SKIP LOCKED prevents two simultaneous matchers grabbing the
  -- same partner — the second one just skips and looks at the next candidate.
  with candidates as (
    select
      q.user_id,
      q.joined_at,
      -- score: +10 per shared interest, +5 if same city, +0.1 per sec wait age
      (
        coalesce((
          select count(*)::int * 10
          from jsonb_array_elements_text(coalesce(p_interests, '[]'::jsonb)) my_i
          where my_i in (
            select v::text from jsonb_array_elements_text(q.interests) v
          )
        ), 0)
        + case when coalesce(p_same_geo, true)
                 and p_geo_city is not null
                 and q.geo_city = p_geo_city then 5 else 0 end
        + (extract(epoch from (now() - q.joined_at)) / 10.0)
      ) as score
    from public.anonymous_queue q
    where q.status = 'waiting'
      and q.user_id <> my_id
      -- exclude users in my exclude list
      and not (q.user_id::text in (
        select jsonb_array_elements_text(coalesce(p_exclude, '[]'::jsonb))
      ))
      -- don't match with someone who excluded me
      and not (my_id::text in (
        select jsonb_array_elements_text(q.exclude_user_ids)
      ))
      -- ignore stale waiters (>2 min)
      and q.joined_at > now() - interval '2 minutes'
  )
  select user_id into partner_id
  from candidates
  order by score desc, joined_at asc
  limit 1
  for update skip locked;

  if partner_id is null then
    return jsonb_build_object('status', 'waiting');
  end if;

  -- 3) Pair them — atomic via SECURITY DEFINER.
  new_channel := 'anon-' || replace(gen_random_uuid()::text, '-', '');

  update public.anonymous_queue
    set status = 'matched', matched_with = partner_id, matched_at = now(), channel_id = new_channel
    where user_id = my_id;

  update public.anonymous_queue
    set status = 'matched', matched_with = my_id, matched_at = now(), channel_id = new_channel
    where user_id = partner_id and status = 'waiting';

  return jsonb_build_object(
    'status', 'matched',
    'partner_id', partner_id,
    'channel_id', new_channel,
    -- Deterministic caller: larger UUID initiates so both clients agree on roles
    'is_caller', my_id::text > partner_id::text
  );
end;
$$;
revoke all on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) from public;
grant execute on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- Poll: check my own row's status. Used between initial enqueue and timeout.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.anonymous_check_match()
returns jsonb
language plpgsql
security definer
as $$
declare
  my_id uuid := auth.uid();
  my_row record;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  select * into my_row from public.anonymous_queue where user_id = my_id;
  if my_row is null then return jsonb_build_object('status','none'); end if;
  if my_row.status = 'matched' then
    return jsonb_build_object(
      'status', 'matched',
      'partner_id', my_row.matched_with,
      'channel_id', my_row.channel_id,
      'is_caller', my_id::text > my_row.matched_with::text
    );
  end if;
  return jsonb_build_object('status', my_row.status);
end;
$$;
revoke all on function public.anonymous_check_match() from public;
grant execute on function public.anonymous_check_match() to authenticated;

-- Leave queue (user cancelled or timed out)
create or replace function public.anonymous_leave_queue()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.anonymous_queue where user_id = auth.uid();
end;
$$;
revoke all on function public.anonymous_leave_queue() from public;
grant execute on function public.anonymous_leave_queue() to authenticated;

-- Cleanup stale entries (call from cron / Edge Function periodically)
create or replace function public.anonymous_cleanup_expired()
returns int
language plpgsql
security definer
as $$
declare cnt int;
begin
  delete from public.anonymous_queue
    where (status = 'waiting' and joined_at < now() - interval '2 minutes')
       or (status = 'matched' and matched_at < now() - interval '5 minutes');
  get diagnostics cnt = row_count;
  return cnt;
end;
$$;
grant execute on function public.anonymous_cleanup_expired() to authenticated;

create index if not exists aq_waiting_idx
  on public.anonymous_queue (status, joined_at desc)
  where status = 'waiting';

create index if not exists aq_matched_with_idx
  on public.anonymous_queue (matched_with);
