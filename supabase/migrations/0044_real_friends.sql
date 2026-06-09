-- ════════════════════════════════════════════════════════════════════
-- R63 — Real Friends Phase 1.
--
-- The "find friends from my community in my city" feature. Users add 3
-- optional fields to their profile (home language, home town, current
-- city) and can filter other users by (language × current_city) to
-- discover people from their community wherever they relocate.
--
-- This is NOT caste / religion / sub-community. Strictly:
--   - home_language: what language you grew up speaking ("malayalam",
--     "tamil", "telugu", "hindi", "punjabi", etc.)
--   - home_town: optional, where you're originally from ("Kochi",
--     "Chennai", etc.)
--   - current_city: where you live now ("Dubai", "Gurgaon", "London", ...)
--
-- All three are free-form text. Standard social-app data, no SPDI.
-- ════════════════════════════════════════════════════════════════════

-- 1. Columns

alter table public.profiles add column if not exists home_language text;
alter table public.profiles add column if not exists home_town text;
alter table public.profiles add column if not exists current_city text;

-- 2. Composite index for fast filter queries

create index if not exists profiles_community_idx
  on public.profiles (lower(home_language), lower(current_city))
  where home_language is not null and current_city is not null;

-- 3. Column-level UPDATE grants (per R61 lockdown model — these are
--    user-writable, so they must be in the explicit allow list).

grant update (home_language) on public.profiles to authenticated;
grant update (home_town)     on public.profiles to authenticated;
grant update (current_city)  on public.profiles to authenticated;

-- 4. list_community_friends — main discovery RPC.
--    Returns matching profiles ordered by recency-of-activity.
--    Respects existing block + exclude lists. Excludes self.
--    Lowercase comparison so 'Dubai' / 'dubai' / 'DUBAI' all match.

create or replace function public.list_community_friends(
  p_language   text default null,
  p_city       text default null,
  p_limit      integer default 100
)
returns table (
  user_id         uuid,
  full_name       text,
  avatar_url      text,
  home_language   text,
  home_town       text,
  current_city    text,
  bio             text,
  anon_nickname   text,
  is_online       boolean,
  last_seen_at    timestamptz
) language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  return query
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.home_language,
      p.home_town,
      p.current_city,
      p.bio,
      p.anon_nickname,
      coalesce(p.is_online, false),
      p.last_seen_at
    from public.profiles p
    where p.id <> auth.uid()
      and p.home_language is not null
      and p.current_city is not null
      and (p_language is null
        or lower(p.home_language) = lower(p_language))
      and (p_city is null
        or lower(p.current_city) = lower(p_city))
      /* Block-list + exclude-list — never surface users either of us
       * already shut out. Re-uses the anon safety tables. */
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
    order by coalesce(p.last_seen_at, p.created_at) desc nulls last
    limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.list_community_friends(text, text, integer) from public;
grant execute on function public.list_community_friends(text, text, integer) to authenticated;

-- 5. count_community_friends — for the "127 Malayalis in Dubai" header.
--    Cheaper than count(*) on the full table; uses the index above.

create or replace function public.count_community_friends(
  p_language text default null,
  p_city     text default null
)
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare c integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select count(*)::int into c
    from public.profiles p
   where p.id <> auth.uid()
     and p.home_language is not null
     and p.current_city is not null
     and (p_language is null or lower(p.home_language) = lower(p_language))
     and (p_city is null or lower(p.current_city) = lower(p_city));
  return coalesce(c, 0);
end;
$$;

revoke all on function public.count_community_friends(text, text) from public;
grant execute on function public.count_community_friends(text, text) to authenticated;

-- 6. list_distinct_cities / list_distinct_languages — for the
--    autosuggest dropdowns. Returns the cities + languages users have
--    actually entered, sorted by popularity. Smart UX nudge: people
--    pick from a real list of where their community exists, not a
--    random hardcoded list.

create or replace function public.list_distinct_friend_cities(p_limit integer default 50)
returns table (city text, n integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select current_city, count(*)::int as n
      from public.profiles
     where current_city is not null
       and length(trim(current_city)) > 0
     group by current_city
     order by n desc, current_city asc
     limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;
revoke all on function public.list_distinct_friend_cities(integer) from public;
grant execute on function public.list_distinct_friend_cities(integer) to authenticated;

create or replace function public.list_distinct_friend_languages(p_limit integer default 50)
returns table (language text, n integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select home_language, count(*)::int as n
      from public.profiles
     where home_language is not null
       and length(trim(home_language)) > 0
     group by home_language
     order by n desc, home_language asc
     limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;
revoke all on function public.list_distinct_friend_languages(integer) from public;
grant execute on function public.list_distinct_friend_languages(integer) to authenticated;
