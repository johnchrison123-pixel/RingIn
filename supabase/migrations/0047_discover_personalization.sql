-- ════════════════════════════════════════════════════════════════════
-- R66.1 — Discover algorithm: personalized ranking
--
-- Previously list_community_friends ordered ONLY by last_seen_at desc.
-- Result: a user from Dubai opening Discover saw random dummies in
-- whatever order they were created, not the Dubai Malayalees most
-- relevant to them.
--
-- Now the Discover ordering uses a personalization score:
--   +30 same home language as me
--   +25 same current city as me
--   +20 same hometown as me
--   +10 per shared interest with me
--   +10 if active in last 7 days
--
-- When the user is actively SEARCHING (typed a name / city / user id),
-- we revert to recency ordering — search relevance is implicit in the
-- WHERE filter, and stable order is more useful when looking for a
-- specific person.
--
-- The match_score is also returned in the result row so the client can
-- show a "best match" badge later if desired.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.list_community_friends(
  p_language    text default null,
  p_city        text default null,
  p_home_town   text default null,
  p_occupation  text default null,
  p_gender      text default null,
  p_interests   jsonb default '[]'::jsonb,
  p_search      text default null,
  p_limit       integer default 100
)
returns table (
  user_id         uuid,
  full_name       text,
  avatar_url      text,
  cover_url       text,
  home_language   text,
  home_town       text,
  current_city    text,
  occupation      text,
  gender          text,
  interests       jsonb,
  bio             text,
  anon_nickname   text,
  is_online       boolean,
  last_seen_at    timestamptz,
  match_score     integer
) language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  search_pat text;
  n_interests int;
  my_lang text;
  my_city text;
  my_home text;
  my_interests jsonb;
  is_searching boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  search_pat := case
    when p_search is null or length(trim(p_search)) = 0 then null
    else '%' || lower(trim(p_search)) || '%'
  end;
  is_searching := search_pat is not null;
  n_interests := coalesce(jsonb_array_length(p_interests), 0);

  select home_language, current_city, home_town,
         coalesce(interests, '[]'::jsonb)
    into my_lang, my_city, my_home, my_interests
    from public.profiles where id = auth.uid();

  return query
    select
      p.id, p.full_name, p.avatar_url, p.cover_url,
      p.home_language, p.home_town, p.current_city,
      p.occupation, coalesce(p.gender, p.anon_gender),
      coalesce(p.interests, '[]'::jsonb),
      p.bio, p.anon_nickname,
      coalesce(p.is_online, false), p.last_seen_at,
      (
        case when my_lang is not null and lower(p.home_language) = lower(my_lang) then 30 else 0 end +
        case when my_city is not null and lower(p.current_city)  = lower(my_city) then 25 else 0 end +
        case when my_home is not null and lower(p.home_town)     = lower(my_home) then 20 else 0 end +
        coalesce((
          select count(*)::int * 10
          from jsonb_array_elements_text(coalesce(p.interests, '[]'::jsonb)) pi
          where lower(pi) in (
            select lower(mi) from jsonb_array_elements_text(coalesce(my_interests, '[]'::jsonb)) mi
          )
        ), 0) +
        case when p.last_seen_at > now() - interval '7 days' then 10 else 0 end
      )::int as match_score
    from public.profiles p
    where p.id <> auth.uid()
      and (p_language   is null or lower(p.home_language) = lower(p_language))
      and (p_city       is null or lower(p.current_city)  = lower(p_city))
      and (p_home_town  is null or lower(p.home_town)     = lower(p_home_town))
      and (p_occupation is null or lower(p.occupation) like ('%' || lower(p_occupation) || '%'))
      and (p_gender     is null or coalesce(p.gender, p.anon_gender) = p_gender)
      and (
        n_interests = 0
        or exists (
          select 1 from jsonb_array_elements_text(coalesce(p.interests, '[]'::jsonb)) my_i
          where lower(my_i) in (select lower(v) from jsonb_array_elements_text(p_interests) v)
        )
      )
      and (
        search_pat is null
        or lower(coalesce(p.full_name, ''))     like search_pat
        or lower(coalesce(p.anon_nickname, '')) like search_pat
        or lower(coalesce(p.current_city, ''))  like search_pat
        or lower(coalesce(p.home_town, ''))     like search_pat
        or p.id::text = trim(p_search)
      )
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = auth.uid() and ab.blocked_id = p.id)
           or (ab.blocker_id = p.id and ab.blocked_id = auth.uid())
      )
    order by
      case when is_searching
           then 0
           else (
             case when my_lang is not null and lower(p.home_language) = lower(my_lang) then 30 else 0 end +
             case when my_city is not null and lower(p.current_city)  = lower(my_city) then 25 else 0 end +
             case when my_home is not null and lower(p.home_town)     = lower(my_home) then 20 else 0 end +
             coalesce((
               select count(*)::int * 10
               from jsonb_array_elements_text(coalesce(p.interests, '[]'::jsonb)) pi
               where lower(pi) in (
                 select lower(mi) from jsonb_array_elements_text(coalesce(my_interests, '[]'::jsonb)) mi
               )
             ), 0)
           )
      end desc,
      coalesce(p.last_seen_at, p.created_at) desc nulls last
    limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;
revoke all on function public.list_community_friends(text, text, text, text, text, jsonb, text, integer) from public;
grant execute on function public.list_community_friends(text, text, text, text, text, jsonb, text, integer) to authenticated;
