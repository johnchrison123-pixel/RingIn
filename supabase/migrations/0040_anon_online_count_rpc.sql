-- ════════════════════════════════════════════════════════════════════
-- R61 — bulletproof online count via SECURITY DEFINER RPC.
--
-- BACKGROUND
-- The Anonymous Connect screen shows "🟢 N people online now" beside
-- the availability toggle. Until now this came from a view:
--
--   create view public.available_anon_count as
--     select count(*)::int as count from public.profiles
--      where is_available_anon = true ...
--
-- Views default to INVOKER privileges. When a client SELECT-s from the
-- view, Postgres applies the caller's RLS to the underlying profiles
-- table. RingIn's profiles RLS varies across rows (some columns + rows
-- visible only to the owner). The net effect: count(*) only counted
-- rows the caller could see — often returning 0 or 1 even when many
-- users were toggled on.
--
-- FIX
-- A SECURITY DEFINER function runs as the function owner (postgres),
-- bypassing all caller-side RLS. It returns the GLOBAL count of toggled-
-- on profiles. No matter what RLS lives on profiles, this works.
--
-- The function is auth-gated (must be signed in) and returns only an
-- integer, so it cannot leak any other profile data.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.get_anon_online_count()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select count(*)::int into c
    from public.profiles
   where is_available_anon = true
     and (available_until is null or available_until > now());

  return coalesce(c, 0);
end;
$$;

revoke all on function public.get_anon_online_count() from public;
grant execute on function public.get_anon_online_count() to authenticated;
