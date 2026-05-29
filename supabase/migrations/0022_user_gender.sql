-- ────────────────────────────────────────────────────────────────────────
-- Real-profile gender + anonymous onboarding flag.
--
-- Per user request (R32): gender belongs to the user's REAL RingIn profile,
-- not to the anonymous-mode profile. The anonymous flow inherits it
-- automatically. Anon-mode only lets the user edit:
--   nickname, avatar, interests, preference, online toggle.
--
-- The first time a user opens Anonymous Connect, a setup wizard runs:
--   1. (if profiles.gender is null) Pick gender — saved to profiles.gender
--   2. Pick nickname
--   3. Pick avatar
--   4. Pick preference (Boys / Girls / Anyone)
--   5. Done — flag profiles.anon_onboarded = true so the wizard never
--      shows again for this user.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Real gender column (nullable until set)
alter table public.profiles add column if not exists gender text;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender is null or gender in ('m','f','other'));

-- 2. Onboarding flag so we know to skip the wizard on subsequent visits
alter table public.profiles add column if not exists anon_onboarded boolean not null default false;

-- 3. Updated matchmaker — now reads gender from profiles.gender (real)
-- not profiles.anon_gender (deprecated). Falls back to anon_gender for
-- back-compat if real gender isn't set yet.
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

  -- R32: prefer real profiles.gender; fall back to anon_gender for
  -- back-compat with users who already set anon_gender under R31.
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

-- 4. Onboarding RPC — sets gender + marks onboarded in one call
create or replace function public.complete_anon_onboarding(
  p_gender text,
  p_nickname text,
  p_avatar text,
  p_preference text
) returns jsonb language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_gender is not null and p_gender not in ('m','f','other') then
    raise exception 'invalid gender';
  end if;
  update public.profiles set
    gender = coalesce(p_gender, gender),
    anon_nickname = coalesce(nullif(trim(p_nickname), ''), anon_nickname),
    anon_avatar = coalesce(p_avatar, anon_avatar),
    anon_preference = coalesce(p_preference, anon_preference),
    anon_onboarded = true
    where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.complete_anon_onboarding(text, text, text, text) from public;
grant execute on function public.complete_anon_onboarding(text, text, text, text) to authenticated;
