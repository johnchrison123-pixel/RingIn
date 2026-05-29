-- ────────────────────────────────────────────────────────────────────────
-- Anonymous Connect profile (nickname + avatar + gender + preference) +
-- gender-aware matchmaking.
--
-- FRND-style anonymous identity:
--   - Pick a nickname (display name shown to matched stranger)
--   - Pick an avatar from a set of 6 (3 girl + 3 boy)
--   - Declare your gender (m/f)
--   - Set who you want to match with (men/women/both)
--
-- The matchmaker enforces mutual preference compatibility — if you said
-- "I want to match with women" and the other person said "I want to match
-- with men", neither side gets the other. Only mutually-OK pairs match.
-- ────────────────────────────────────────────────────────────────────────

-- 1) Persistent settings on the user's profile
alter table public.profiles add column if not exists anon_nickname  text;
alter table public.profiles add column if not exists anon_avatar    text default 'girl1';
alter table public.profiles add column if not exists anon_gender    text default 'f'
  check (anon_gender in ('m','f'));
alter table public.profiles add column if not exists anon_preference text default 'both'
  check (anon_preference in ('men','women','both'));

-- 2) Copy these onto the queue row so partner can see them without an
-- extra profile lookup AND the matcher can filter by them.
alter table public.anonymous_queue add column if not exists nickname   text;
alter table public.anonymous_queue add column if not exists avatar     text;
alter table public.anonymous_queue add column if not exists gender     text;
alter table public.anonymous_queue add column if not exists preference text;

-- 3) Updated matchmaker — same algorithm + interest scoring + race-free
-- pairing, PLUS:
--   - Pulls nickname/avatar/gender/preference from profile and stores on queue row
--   - Filters candidates: candidate's gender must match my preference
--     AND my gender must match candidate's preference
--   - Returns partner's nickname + avatar so the UI can show them
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
  my_nick text;
  my_avatar text;
  my_gender text;
  my_pref text;
  partner_id uuid;
  partner_nick text;
  partner_avatar text;
  partner_gender text;
  new_channel text;
begin
  if my_id is null then raise exception 'not authenticated'; end if;

  -- Pull current anonymous profile settings
  select anon_nickname, coalesce(anon_avatar, 'girl1'),
         coalesce(anon_gender, 'f'), coalesce(anon_preference, 'both')
    into my_nick, my_avatar, my_gender, my_pref
    from public.profiles where id = my_id;

  -- Default nickname if user hasn't set one
  if my_nick is null or length(trim(my_nick)) = 0 then
    my_nick := 'Anonymous';
  end if;

  -- 1) Upsert queue row with all anonymous-profile fields
  insert into public.anonymous_queue (
    user_id, joined_at, interests, same_geo, geo_country, geo_city, exclude_user_ids, status,
    matched_with, matched_at, channel_id, nickname, avatar, gender, preference
  ) values (
    my_id, now(), coalesce(p_interests, '[]'::jsonb), coalesce(p_same_geo, true),
    p_geo_country, p_geo_city, coalesce(p_exclude, '[]'::jsonb), 'waiting',
    null, null, null, my_nick, my_avatar, my_gender, my_pref
  )
  on conflict (user_id) do update
    set joined_at = now(),
        interests = excluded.interests,
        same_geo = excluded.same_geo,
        geo_country = excluded.geo_country,
        geo_city = excluded.geo_city,
        exclude_user_ids = excluded.exclude_user_ids,
        status = 'waiting',
        matched_with = null, matched_at = null, channel_id = null,
        nickname = excluded.nickname,
        avatar = excluded.avatar,
        gender = excluded.gender,
        preference = excluded.preference;

  -- 2) Find best partner with mutual gender-preference compatibility
  with candidates as (
    select
      q.user_id, q.joined_at, q.nickname, q.avatar, q.gender,
      (
        coalesce((
          select count(*)::int * 10
          from jsonb_array_elements_text(coalesce(p_interests, '[]'::jsonb)) my_i
          where my_i in (select v::text from jsonb_array_elements_text(q.interests) v)
        ), 0)
        + case when coalesce(p_same_geo, true) and p_geo_city is not null and q.geo_city = p_geo_city then 5 else 0 end
        + (extract(epoch from (now() - q.joined_at)) / 10.0)
      ) as score
    from public.anonymous_queue q
    where q.status = 'waiting'
      and q.user_id <> my_id
      and not (q.user_id::text in (select jsonb_array_elements_text(coalesce(p_exclude, '[]'::jsonb))))
      and not (my_id::text in (select jsonb_array_elements_text(q.exclude_user_ids)))
      and q.joined_at > now() - interval '2 minutes'
      -- Mutual gender preference compatibility:
      -- I want: my_pref ('men' wants 'm', 'women' wants 'f', 'both' wants any)
      -- They want: q.preference must accept my_gender
      and (
        my_pref = 'both'
        or (my_pref = 'men'   and q.gender = 'm')
        or (my_pref = 'women' and q.gender = 'f')
      )
      and (
        coalesce(q.preference, 'both') = 'both'
        or (q.preference = 'men'   and my_gender = 'm')
        or (q.preference = 'women' and my_gender = 'f')
      )
  )
  select user_id, nickname, avatar, gender
    into partner_id, partner_nick, partner_avatar, partner_gender
    from candidates
    order by score desc, joined_at asc
    limit 1
    for update skip locked;

  if partner_id is null then
    return jsonb_build_object('status', 'waiting');
  end if;

  -- 3) Atomic pairing
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
    'partner_nickname', partner_nick,
    'partner_avatar', partner_avatar,
    'partner_gender', partner_gender,
    'channel_id', new_channel,
    'is_caller', my_id::text > partner_id::text
  );
end;
$$;
revoke all on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) from public;
grant execute on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) to authenticated;

-- 4) Updated check_match — also returns partner profile snapshot
create or replace function public.anonymous_check_match()
returns jsonb
language plpgsql
security definer
as $$
declare
  my_id uuid := auth.uid();
  my_row record;
  partner_row record;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  select * into my_row from public.anonymous_queue where user_id = my_id;
  if my_row is null then return jsonb_build_object('status','none'); end if;
  if my_row.status = 'matched' then
    select nickname, avatar, gender into partner_row
      from public.anonymous_queue where user_id = my_row.matched_with;
    return jsonb_build_object(
      'status', 'matched',
      'partner_id', my_row.matched_with,
      'partner_nickname', coalesce(partner_row.nickname, 'Anonymous'),
      'partner_avatar', coalesce(partner_row.avatar, 'girl1'),
      'partner_gender', partner_row.gender,
      'channel_id', my_row.channel_id,
      'is_caller', my_id::text > my_row.matched_with::text
    );
  end if;
  return jsonb_build_object('status', my_row.status);
end;
$$;
revoke all on function public.anonymous_check_match() from public;
grant execute on function public.anonymous_check_match() to authenticated;

-- 5) RPC to save anonymous profile settings (atomic, single call from UI)
create or replace function public.set_anon_profile(
  p_nickname text default null,
  p_avatar text default null,
  p_gender text default null,
  p_preference text default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set
    anon_nickname = coalesce(nullif(trim(p_nickname), ''), anon_nickname),
    anon_avatar = coalesce(p_avatar, anon_avatar),
    anon_gender = coalesce(p_gender, anon_gender),
    anon_preference = coalesce(p_preference, anon_preference)
  where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_anon_profile(text, text, text, text) from public;
grant execute on function public.set_anon_profile(text, text, text, text) to authenticated;
