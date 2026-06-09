-- ════════════════════════════════════════════════════════════════════
-- R64 — Real Friends v2.
--
-- Big upgrade to Phase 1:
--   1. Add `occupation` + `interests` columns to profiles
--   2. Rewrite list_community_friends to accept 7 optional filters +
--      a free-text search across name/email/city
--   3. New suggest_friends RPC with a per-user daily rotation —
--      same user sees a DIFFERENT shuffled list each day
--   4. Seed 13 realistic Malayalee dummy profiles covering Kerala,
--      Tamil Nadu/Karnataka migration, Gulf diaspora, UK diaspora
--
-- The suggestion algorithm scores candidates by:
--   - Same home language as me     +30
--   - Same current city as me      +25
--   - Same hometown as me          +20
--   - Each shared interest         +10
--   - Stable daily-rotation noise  +0-15 (hash of date+user)
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. New columns ════════

alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists interests jsonb default '[]'::jsonb;

-- Column-level UPDATE grants per R61 lockdown model
grant update (occupation) on public.profiles to authenticated;
grant update (interests)  on public.profiles to authenticated;

-- ════════ 2. Updated list_community_friends with all 7 filters ════════

drop function if exists public.list_community_friends(text, text, integer);

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
  last_seen_at    timestamptz
) language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  search_pat text;
  n_interests int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  search_pat := case
    when p_search is null or length(trim(p_search)) = 0 then null
    else '%' || lower(trim(p_search)) || '%'
  end;
  n_interests := coalesce(jsonb_array_length(p_interests), 0);

  return query
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.cover_url,
      p.home_language,
      p.home_town,
      p.current_city,
      p.occupation,
      coalesce(p.gender, p.anon_gender),
      coalesce(p.interests, '[]'::jsonb),
      p.bio,
      p.anon_nickname,
      coalesce(p.is_online, false),
      p.last_seen_at
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
          select 1
          from jsonb_array_elements_text(coalesce(p.interests, '[]'::jsonb)) my_i
          where lower(my_i) in (
            select lower(v) from jsonb_array_elements_text(p_interests) v
          )
        )
      )
      and (
        search_pat is null
        or lower(coalesce(p.full_name, ''))    like search_pat
        or lower(coalesce(p.anon_nickname, '')) like search_pat
        or lower(coalesce(p.current_city, '')) like search_pat
        or lower(coalesce(p.home_town, ''))    like search_pat
        or p.id::text = trim(p_search)
      )
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = auth.uid() and ab.blocked_id = p.id)
           or (ab.blocker_id = p.id and ab.blocked_id = auth.uid())
      )
    order by coalesce(p.last_seen_at, p.created_at) desc nulls last
    limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;
revoke all on function public.list_community_friends(text, text, text, text, text, jsonb, text, integer) from public;
grant execute on function public.list_community_friends(text, text, text, text, text, jsonb, text, integer) to authenticated;

-- ════════ 3. suggest_friends — daily rotating suggestion algorithm ════════

create or replace function public.suggest_friends(p_limit integer default 12)
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
  is_online       boolean,
  match_score     integer
) language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me record;
  /* day_seed changes once per day per user — gives each user a stable
   * "shuffle of the day" so the order doesn't reroll on refresh but
   * looks fresh tomorrow. */
  day_seed bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select home_language, current_city, home_town,
         coalesce(interests, '[]'::jsonb) as interests,
         coalesce(gender, anon_gender) as gender
    into me
    from public.profiles where id = auth.uid();

  day_seed := abs(hashtext(auth.uid()::text || to_char(current_date, 'YYYYMMDD')));

  return query
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.cover_url,
      p.home_language,
      p.home_town,
      p.current_city,
      p.occupation,
      coalesce(p.gender, p.anon_gender),
      coalesce(p.interests, '[]'::jsonb),
      p.bio,
      coalesce(p.is_online, false),
      (
        case when me.home_language is not null and lower(p.home_language) = lower(me.home_language) then 30 else 0 end +
        case when me.current_city  is not null and lower(p.current_city)  = lower(me.current_city)  then 25 else 0 end +
        case when me.home_town     is not null and lower(p.home_town)     = lower(me.home_town)     then 20 else 0 end +
        coalesce((
          select count(*)::int * 10
          from jsonb_array_elements_text(coalesce(p.interests, '[]'::jsonb)) pi
          where lower(pi) in (
            select lower(mi) from jsonb_array_elements_text(coalesce(me.interests, '[]'::jsonb)) mi
          )
        ), 0) +
        /* Daily-rotation noise — stable per (user, day) pair. */
        ((abs(hashtext(p.id::text || day_seed::text)) % 15))
      )::int as match_score
    from public.profiles p
    where p.id <> auth.uid()
      and p.home_language is not null
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = auth.uid() and ab.blocked_id = p.id)
           or (ab.blocker_id = p.id and ab.blocked_id = auth.uid())
      )
    order by match_score desc, p.last_seen_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 12), 50));
end;
$$;
revoke all on function public.suggest_friends(integer) from public;
grant execute on function public.suggest_friends(integer) to authenticated;

-- ════════ 4. Seed 13 dummy Malayalee profiles ════════

/* These are TEST profiles. They reference auth.users — created here
 * with placeholder uuids and a 'dummy' email pattern so you can clean
 * them up later with:
 *   delete from auth.users where email like '%@ringin-dummy.test';
 *
 * Composition (Malayalee diaspora story):
 *   - 4 in Kerala (Kochi / Kozhikode)
 *   - 4 in TN/KA (Chennai / Bangalore — Malayalees working there)
 *   - 4 in Dubai (Gulf diaspora)
 *   - 1 in London (UK diaspora)
 */

do $$
declare
  dummies text[][] := array[
    -- Kerala (4)
    array['11111111-aaaa-bbbb-cccc-000000000001','Arun Krishnan','m','malayalam','Kochi','Kochi','Software Engineer at Infopark',
          '"Coffee + code + cricket. Born and raised in Fort Kochi. Always up for backwater trips."',
          '["cricket","films","coding","backwater trips","coffee"]'],
    array['11111111-aaaa-bbbb-cccc-000000000002','Anjali Menon','f','malayalam','Kochi','Kochi','Bank Officer',
          '"Federal Bank. Bharatanatyam dancer. Marine Drive walks every evening 🌊"',
          '["dance","food","travel","reading","mohiniyattam"]'],
    array['11111111-aaaa-bbbb-cccc-000000000003','Mohammed Faizal','m','malayalam','Kozhikode','Kozhikode','Restaurant Owner',
          '"Run a Kozhikode biriyani place near beach road. Foodie life. Looking to meet new friends in the city."',
          '["food","business","music","beach walks","ghazal"]'],
    array['11111111-aaaa-bbbb-cccc-000000000004','Sneha Pillai','f','malayalam','Kochi','Kochi','Postgrad Student',
          '"MA English Lit at MG Uni Kottayam. Books, films, chai. Slow living."',
          '["books","films","photography","writing","poetry"]'],
    -- Chennai / Bangalore (4 — Malayalees working there)
    array['22222222-aaaa-bbbb-cccc-000000000001','Rahul Nair','m','malayalam','Thiruvananthapuram','Bangalore','Software Engineer at Flipkart',
          '"Trivandrum boy in Bangalore for 3 years. Looking for Mallu friends here for cricket + sadya weekends."',
          '["cricket","gaming","food","tech","sadya"]'],
    array['22222222-aaaa-bbbb-cccc-000000000002','Priya Krishnan','f','malayalam','Thrissur','Chennai','Product Manager',
          '"Originally Thrissur. Chennai 5 years. Films + yoga + chai. Onam every year back home."',
          '["yoga","travel","films","food","Carnatic music"]'],
    array['22222222-aaaa-bbbb-cccc-000000000003','Vinod Pillai','m','malayalam','Kochi','Bangalore','Data Scientist',
          '"Kochi → Bangalore. Wake up running, code, gym, cricket on weekends. Looking for kettle buddies ☕"',
          '["cricket","music","hiking","tech","gym"]'],
    array['22222222-aaaa-bbbb-cccc-000000000004','Maya Suresh','f','malayalam','Kollam','Chennai','UX Designer',
          '"Kollam → Chennai. Design, art, coffee. Trying to find Mallu girls in OMR area for weekend meetups."',
          '["art","films","coffee","design","photography"]'],
    -- Dubai (4 — Gulf diaspora)
    array['33333333-aaaa-bbbb-cccc-000000000001','Joseph Mathai','m','malayalam','Kottayam','Dubai','Civil Engineer',
          '"15 years in Dubai. From Kottayam. Wife + 2 kids. Looking to meet Mallu families here for weekend hangouts."',
          '["family","photography","travel","cricket","church"]'],
    array['33333333-aaaa-bbbb-cccc-000000000002','Fatima Beegum','f','malayalam','Malappuram','Dubai','Staff Nurse',
          '"Originally Tirur. 6 years in Dubai. Long shifts. Need malayali friends to share home food + WhatsApp gossip ☕"',
          '["cooking","films","social media","nursing","Quran"]'],
    array['33333333-aaaa-bbbb-cccc-000000000003','Akhil Varghese','m','malayalam','Ernakulam','Dubai','Hotel Manager',
          '"Hilton Dubai. Ernakulam born. Hospitality life. Mallu meetups every other weekend at the Spice Route."',
          '["hospitality","food","travel","music","whisky tasting"]'],
    array['33333333-aaaa-bbbb-cccc-000000000004','Lakshmi Nair','f','malayalam','Thiruvananthapuram','Dubai','Banker',
          '"Banking at Emirates NBD. Trivandrum at heart. Yoga + books. Looking for Mallu book club in Dubai 📚"',
          '["finance","yoga","books","tea","classical music"]'],
    -- London (1 — UK diaspora)
    array['44444444-aaaa-bbbb-cccc-000000000001','Dileep George','m','malayalam','Kochi','London','NHS Doctor',
          '"Cardiologist in central London. From Kochi originally. 7 years here. Looking for Mallu friends in zone 2/3."',
          '["medicine","music","travel","cricket","red wine"]']
  ];
  i int;
  r text[];
  uid uuid;
  full_name_v text;
  gender_v text;
  hl text;
  ht text;
  cc text;
  occ text;
  bio_v text;
  interests_v jsonb;
  email_v text;
begin
  for i in 1 .. array_length(dummies, 1) loop
    r := dummies[i:i][1];
    uid := r[1]::uuid;
    full_name_v := r[2];
    gender_v := r[3];
    hl := r[4];
    ht := r[5];
    cc := r[6];
    occ := r[7];
    bio_v := r[8];
    interests_v := r[9]::jsonb;
    email_v := 'dummy' || i || '@ringin-dummy.test';

    /* Insert into auth.users only if it doesn't already exist. Use
     * Supabase's minimal auth schema. SQL editor runs as postgres so
     * this is allowed. */
    if not exists (select 1 from auth.users where id = uid) then
      insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at, raw_app_meta_data,
        raw_user_meta_data, created_at, updated_at
      ) values (
        uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        email_v,
        crypt('dummy-password-' || i, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"is_dummy":true}'::jsonb,
        now() - (random() * interval '180 days'),
        now() - (random() * interval '30 days')
      );
    end if;

    /* Now upsert the profile row. */
    insert into public.profiles (
      id, full_name, gender, home_language, home_town, current_city,
      occupation, bio, interests, anon_nickname, anon_gender,
      anon_onboarded, is_available_anon
    ) values (
      uid, full_name_v, gender_v, hl, ht, cc, occ, bio_v, interests_v,
      split_part(full_name_v, ' ', 1), gender_v, true, false
    )
    on conflict (id) do update set
      full_name     = excluded.full_name,
      gender        = excluded.gender,
      home_language = excluded.home_language,
      home_town     = excluded.home_town,
      current_city  = excluded.current_city,
      occupation    = excluded.occupation,
      bio           = excluded.bio,
      interests     = excluded.interests;
  end loop;
  raise notice 'R64: seeded % dummy Malayalee profiles', array_length(dummies, 1);
end $$;
