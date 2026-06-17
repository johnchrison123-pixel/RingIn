-- ════════════════════════════════════════════════════════════════════
-- Profile redesign — stat helpers for the Followers / Friends / Hearts card.
--
-- A viewer needs to see ANOTHER user's follower + friend counts on their
-- profile. The underlying tables are RLS-restricted to participants:
--   - public.follows         (legacy website table, TEXT ids)
--   - public.anon_connections(user_a, user_b)  read = participants only
-- so a direct client-side count() returns 0 for other people. These two
-- SECURITY DEFINER counters bypass RLS to return just an integer count
-- (a public-ish social metric, same class as a follower count). Hearts are
-- computed client-side from a profile's loaded posts, so no RPC is needed.
--
-- Purely additive. No schema changes. Safe to run anytime. Forward-compatible:
-- the client falls back to 0 if these functions don't exist yet.
-- ════════════════════════════════════════════════════════════════════

-- Followers of a user = rows in follows where following_id = that user.
-- follows uses TEXT ids (legacy website schema), so cast the uuid to text.
create or replace function public.count_user_followers(p_uid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select count(*)::int into c
    from public.follows
   where following_id = p_uid::text;
  return coalesce(c, 0);
end;
$$;

revoke all on function public.count_user_followers(uuid) from public;
grant execute on function public.count_user_followers(uuid) to authenticated;

-- Friends of a user = accepted symmetric anon_connections they're part of.
create or replace function public.count_user_friends(p_uid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select count(*)::int into c
    from public.anon_connections
   where user_a = p_uid or user_b = p_uid;
  return coalesce(c, 0);
end;
$$;

revoke all on function public.count_user_friends(uuid) from public;
grant execute on function public.count_user_friends(uuid) to authenticated;
