-- ════════════════════════════════════════════════════════════════════
-- R62 — Race-condition fixes for the call flow.
--
-- 1. REVERSE-CALL RACE: if user A and B both press Call on each other
--    within ~1 second, two `ringing` invites get inserted between the
--    same pair. Both phones get an outgoing AND an incoming → both
--    stuck. Fix: a partial unique index on the (sorted) pair of users
--    while status = 'ringing'. The second concurrent INSERT then fails
--    with a uniqueness violation that the client catches gracefully.
--
-- 2. FIND_RANDOM_HOST RACE: two callers calling find_random_host at the
--    same microsecond can both receive the SAME host_id back. Both
--    insert call invites → host gets two ringing notifications → one
--    silently fails. Fix: exclude hosts who already have a ringing
--    call invite in the last 60 seconds, so concurrent callers
--    automatically pick different hosts.
-- ════════════════════════════════════════════════════════════════════

-- ════════ Fix 1: reverse-call race ════════

/* Partial unique index — only enforced while status='ringing'. Once the
 * call is accepted/rejected/ended, status changes and the constraint
 * stops applying, so future calls between the same pair work normally.
 *
 * We sort the two user IDs as text so (A→B) and (B→A) collapse to the
 * same key. Any second concurrent ringing insert between the same pair
 * (regardless of direction) gets rejected with code 23505. */
create unique index if not exists call_invites_ringing_pair_unique
  on public.call_invites (
    least(caller_id::text, callee_id::text),
    greatest(caller_id::text, callee_id::text)
  )
  where status = 'ringing';

-- ════════ Fix 2: find_random_host race ════════

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
      /* R62 RACE FIX: skip hosts who already have a fresh ringing
       * invite. If two callers run find_random_host simultaneously,
       * the first one's invite goes in immediately and this filter
       * excludes that host from the second caller's pick → they
       * automatically get a different host. */
      and not exists (
        select 1 from public.call_invites ci
        where ci.callee_id = p.id
          and ci.status = 'ringing'
          and ci.created_at > now() - interval '60 seconds'
      )
    order by random()
    limit 1;
end;
$$;
revoke all on function public.find_random_host() from public;
grant execute on function public.find_random_host() to authenticated;
