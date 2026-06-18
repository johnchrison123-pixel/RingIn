-- ════════════════════════════════════════════════════════════════════
-- 0054_gift_economy.sql — Animated in-call virtual gifting (EXPAND phase).
--
-- Catalog is SERVER-AUTHORITATIVE: send_gift() takes ONLY a gift_key and
-- reads coins/tier/payout from gift_catalog. The client NEVER supplies a
-- price — this kills the p_coins trust-vuln in the old send_anon_call_gift /
-- send_anon_chat_gift RPCs (0030/0031), which stay alive this release for
-- back-compat and get dropped in a later CONTRACT migration once no client
-- calls them. Mirrors the secure buy_cosmetic (0049) pattern; coins column
-- is already REVOKEd from authenticated (0038). Re-run safe.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.gift_catalog (
  gift_key     text primary key,
  name         text not null,
  category     text not null,
  icon         text not null default '🎁',
  coins        integer not null check (coins > 0),
  tier         text not null check (tier in ('regular','premium')),
  animation    text not null default '',
  fullscreen   boolean not null default false,
  sound        text not null default 'bell',
  featured     boolean not null default false,
  is_lucky_box boolean not null default false,
  sort         integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.gift_catalog drop constraint if exists gift_coins_valid_tier;
alter table public.gift_catalog
  add constraint gift_coins_valid_tier check (
    (tier = 'regular' and coins in (9,15,19,25,29,49,79,99,199,299)) or
    (tier = 'premium' and coins in (399,499,599,799,999,1499,1999,2999,4999))
  );

create index if not exists gift_catalog_cat_idx on public.gift_catalog (category, sort);
create index if not exists gift_catalog_active_idx on public.gift_catalog (active) where active;

alter table public.gift_catalog enable row level security;
drop policy if exists "gift_catalog_read" on public.gift_catalog;
create policy "gift_catalog_read" on public.gift_catalog for select using (true);
grant select on public.gift_catalog to anon, authenticated;

create table if not exists public.gift_sends (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references auth.users(id) on delete cascade,
  receiver_id     uuid not null references auth.users(id) on delete cascade,
  gift_key        text not null references public.gift_catalog(gift_key),
  coins_spent     integer not null check (coins_spent > 0),
  receiver_payout integer not null check (receiver_payout >= 0),
  platform_cut    integer not null check (platform_cut >= 0),
  call_id         uuid,
  rolled_gift_key text references public.gift_catalog(gift_key),
  created_at      timestamptz not null default now()
);
create index if not exists gift_sends_recv_idx   on public.gift_sends (receiver_id, created_at desc);
create index if not exists gift_sends_call_idx    on public.gift_sends (call_id, created_at desc);
create index if not exists gift_sends_sender_idx  on public.gift_sends (sender_id, created_at desc);

alter table public.gift_sends enable row level security;
drop policy if exists "gift_sends_read" on public.gift_sends;
create policy "gift_sends_read" on public.gift_sends for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);

-- realtime delivery to the receiver (guard against double-add on re-run)
do $pub$ begin
  begin
    alter publication supabase_realtime add table public.gift_sends;
  exception when duplicate_object then null; end;
end $pub$;

-- ════════ send_gift — server-priced, vuln-free (receiver 70 / platform 30) ════════
create or replace function public.send_gift(
  p_gift_key text,
  p_to_user  uuid,
  p_call_id  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  g         public.gift_catalog;
  me        uuid := auth.uid();
  cur_bal   integer;
  new_bal   integer;
  payout    integer;
  platform  integer;
  final_g   public.gift_catalog;
  final_key text;
  new_id    uuid;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;
  if p_to_user is null or p_to_user = me then
    return jsonb_build_object('status','bad_recipient');
  end if;

  select * into g from public.gift_catalog where gift_key = p_gift_key and active = true;
  if not found then return jsonb_build_object('status','not_found'); end if;

  select coins into cur_bal from public.profiles where id = me for update;
  if coalesce(cur_bal,0) < g.coins then
    return jsonb_build_object('status','insufficient','balance',coalesce(cur_bal,0),'price',g.coins);
  end if;

  if g.is_lucky_box then
    select * into final_g from public.gift_catalog
      where active = true and is_lucky_box = false and category = g.category
      order by random() limit 1;
    if not found then
      select * into final_g from public.gift_catalog
        where active = true and is_lucky_box = false order by random() limit 1;
    end if;
    final_key := final_g.gift_key;
  else
    final_g := g; final_key := g.gift_key;
  end if;

  payout   := (g.coins * 70) / 100;
  platform := g.coins - payout;
  new_bal  := cur_bal - g.coins;
  update public.profiles set coins = new_bal where id = me;
  update public.profiles set coins = coalesce(coins,0) + payout where id = p_to_user;

  insert into public.gift_sends
    (sender_id, receiver_id, gift_key, coins_spent, receiver_payout, platform_cut, call_id, rolled_gift_key)
  values
    (me, p_to_user, p_gift_key, g.coins, payout, platform, p_call_id,
     case when g.is_lucky_box then final_key else null end)
  returning id into new_id;

  return jsonb_build_object(
    'status','ok','send_id',new_id,'balance',new_bal,
    'delivered_gift_key',final_key,'name',final_g.name,'icon',final_g.icon,
    'coins',g.coins,'tier',final_g.tier,'animation',final_g.animation,
    'fullscreen',final_g.fullscreen,'sound',final_g.sound,'receiver_payout',payout
  );
end;
$fn$;
revoke all on function public.send_gift(text, uuid, uuid) from public;
grant execute on function public.send_gift(text, uuid, uuid) to authenticated;

create or replace function public.call_top_supporters(p_call_id uuid, p_limit int default 3)
returns table (sender_id uuid, total_coins bigint, gift_count bigint)
language sql security definer set search_path = public, pg_temp as $fn2$
  select sender_id, sum(coins_spent)::bigint, count(*)::bigint
  from public.gift_sends where call_id = p_call_id
  group by sender_id order by 2 desc limit greatest(1, coalesce(p_limit,3));
$fn2$;
revoke all on function public.call_top_supporters(uuid,int) from public;
grant execute on function public.call_top_supporters(uuid,int) to authenticated;

-- ════════ Seed: 135 gifts ════════
insert into public.gift_catalog (gift_key, name, category, icon, coins, tier, animation, fullscreen, sound, is_lucky_box, sort) values
  ('tiny_tap','Tiny Tap','Reactions & Mood','👆',9,'regular','',false,'bell',false,10),
  ('heyy_wink','Heyy Wink','Reactions & Mood','😉',9,'regular','',false,'bell',false,20),
  ('clap_clap','Clap-Clap','Reactions & Mood','👏',15,'regular','',false,'bell',false,30),
  ('aww_heart','Aww Heart','Reactions & Mood','🥹',15,'regular','',false,'bell',false,40),
  ('lol_burst','Lol Burst','Reactions & Mood','😂',19,'regular','',false,'bell',false,50),
  ('side_eye','Side-Eye','Reactions & Mood','👀',19,'regular','',false,'bell',false,60),
  ('garam_reaction','Garam Reaction','Reactions & Mood','🌶️',25,'regular','',false,'bell',false,70),
  ('chill_vibe','Chill Vibe','Reactions & Mood','😎',25,'regular','',false,'bell',false,80),
  ('mood_off','Mood Off','Reactions & Mood','🙄',29,'regular','',false,'bell',false,90),
  ('blush_bomb','Blush Bomb','Reactions & Mood','😳',29,'regular','',false,'bell',false,100),
  ('hi_five_slam','Hi-Five Slam','Reactions & Mood','🙌',49,'regular','',false,'bell',false,110),
  ('big_mood','Big Mood','Reactions & Mood','🤩',79,'regular','',false,'bell',false,120),
  ('vibe_check_passed','Vibe Check Passed','Reactions & Mood','✨',99,'regular','',false,'bell',false,130),
  ('full_on_feels','Full-On Feels','Reactions & Mood','🥰',199,'regular','',false,'bell',false,140),
  ('mood_takeover_sky_high','Mood Takeover: Sky-High','Reactions & Mood','🎆',499,'premium','',true,'fanfare',false,150),
  ('maha_mood_monsoon','Maha-Mood Monsoon','Reactions & Mood','🌈',999,'premium','',true,'fanfare',false,160),
  ('cutting_chai','Cutting Chai','Chai & Desi Treats','☕',9,'regular','',false,'bell',false,10),
  ('crispy_samosa','Crispy Samosa','Chai & Desi Treats','🥟',15,'regular','',false,'bell',false,20),
  ('vada_pav_express','Vada Pav Express','Chai & Desi Treats','🍔',19,'regular','',false,'bell',false,30),
  ('gulab_jamun_pair','Gulab Jamun Pair','Chai & Desi Treats','🍮',25,'regular','',false,'bell',false,40),
  ('pani_puri_blast','Pani Puri Blast','Chai & Desi Treats','🫗',29,'regular','',false,'bell',false,50),
  ('masala_chai_tray','Masala Chai Tray','Chai & Desi Treats','🫖',49,'regular','',false,'bell',false,60),
  ('mithai_dabba','Mithai Dabba','Chai & Desi Treats','🍬',79,'regular','',false,'bell',false,70),
  ('jalebi_swirl','Jalebi Swirl','Chai & Desi Treats','🍥',99,'regular','',false,'bell',false,80),
  ('filter_coffee_kaapi','Filter Coffee Kaapi','Chai & Desi Treats','🥤',199,'regular','',false,'bell',false,90),
  ('royal_thali_feast','Royal Thali Feast','Chai & Desi Treats','🍱',299,'regular','',false,'bell',false,100),
  ('halwai_s_hot_counter','Halwai''s Hot Counter','Chai & Desi Treats','🧁',399,'premium','',true,'fanfare',false,110),
  ('diwali_mithai_bombs','Diwali Mithai Bombs','Chai & Desi Treats','🎆',799,'premium','',true,'fanfare',false,120),
  ('wedding_baraat_buffet','Wedding Baraat Buffet','Chai & Desi Treats','🎪',1999,'premium','',true,'fanfare',false,130),
  ('maharaja_royal_dawat','Maharaja Royal Dawat','Chai & Desi Treats','👑',4999,'premium','',true,'fanfare',false,140),
  ('dil_tap','Dil Tap','Love & Romance','❤️',15,'regular','',false,'bell',false,10),
  ('blush_wink','Blush Wink','Love & Romance','😘',19,'regular','',false,'bell',false,20),
  ('gulab_single','Gulab Single','Love & Romance','🌹',25,'regular','',false,'bell',false,30),
  ('sweet_nothing','Sweet Nothing','Love & Romance','🍫',29,'regular','',false,'bell',false,40),
  ('pyaar_petals','Pyaar Petals','Love & Romance','🌸',49,'regular','',false,'bell',false,50),
  ('gajra_glow','Gajra Glow','Love & Romance','💮',79,'regular','',false,'bell',false,60),
  ('cuddle_bear','Cuddle Bear','Love & Romance','🧸',99,'regular','',false,'bell',false,70),
  ('heartbeat_sync','Heartbeat Sync','Love & Romance','💓',199,'regular','',false,'bell',false,80),
  ('love_letter','Love Letter','Love & Romance','💌',299,'regular','',false,'bell',false,90),
  ('bouquet_of_us','Bouquet of Us','Love & Romance','💐',399,'premium','',true,'fanfare',false,100),
  ('crimson_confession','Crimson Confession','Love & Romance','🥀❤️',599,'premium','',true,'fanfare',false,110),
  ('couple_s_constellation','Couple''s Constellation','Love & Romance','💑✨',799,'premium','',true,'fanfare',false,120),
  ('saat_vachan_ring','Saat Vachan Ring','Love & Romance','💍',999,'premium','',true,'fanfare',false,130),
  ('note_drop','Note Drop','Music & Vibes','🎵',9,'regular','',false,'bell',false,10),
  ('taali_beat','Taali Beat','Music & Vibes','👏',15,'regular','',false,'bell',false,20),
  ('dhol_thump','Dhol Thump','Music & Vibes','🥁',19,'regular','',false,'bell',false,30),
  ('whistle_hook','Whistle Hook','Music & Vibes','😗',25,'regular','',false,'bell',false,40),
  ('bansuri_breeze','Bansuri Breeze','Music & Vibes','🪈',29,'regular','',false,'bell',false,50),
  ('headphone_heart','Headphone Heart','Music & Vibes','🎧',49,'regular','',false,'bell',false,60),
  ('tabla_roll','Tabla Roll','Music & Vibes','🪘',79,'regular','',false,'bell',false,70),
  ('guitar_riff','Guitar Riff','Music & Vibes','🎸',99,'regular','',false,'bell',false,80),
  ('shehnai_serenade','Shehnai Serenade','Music & Vibes','🎺',199,'regular','',false,'bell',false,90),
  ('garba_night','Garba Night','Music & Vibes','💃',299,'regular','',false,'bell',false,100),
  ('dj_drop','DJ Drop','Music & Vibes','🎛️',399,'premium','',true,'fanfare',false,110),
  ('bollywood_concert','Bollywood Concert','Music & Vibes','🎤',499,'premium','',true,'fanfare',false,120),
  ('boop_the_nose','Boop the Nose','Cute & Playful','🐽',9,'regular','',false,'bell',false,10),
  ('squishy_bun','Squishy Bun','Cute & Playful','🍡',15,'regular','',false,'bell',false,20),
  ('pocket_kitten','Pocket Kitten','Cute & Playful','🐱',19,'regular','',false,'bell',false,30),
  ('bubble_pop','Bubble Pop','Cute & Playful','🫧',25,'regular','',false,'bell',false,40),
  ('chai_panda','Chai Panda','Cute & Playful','🐼',29,'regular','',false,'bell',false,50),
  ('toy_box_surprise','Toy Box Surprise','Cute & Playful','🎁',49,'regular','',false,'bell',false,60),
  ('huggy_bear','Huggy Bear','Cute & Playful','🧸',79,'regular','',false,'bell',false,70),
  ('bunny_hop','Bunny Hop','Cute & Playful','🐰',99,'regular','',false,'bell',false,80),
  ('genda_pup','Genda Pup','Cute & Playful','🐶',199,'regular','',false,'bell',false,90),
  ('carousel_cuddle','Carousel Cuddle','Cute & Playful','🎠',299,'regular','',false,'bell',false,100),
  ('duck_parade','Duck Parade','Cute & Playful','🦆',49,'regular','',false,'bell',false,110),
  ('sleepy_sloth','Sleepy Sloth','Cute & Playful','🦥',79,'regular','',false,'bell',false,120),
  ('penguin_slide','Penguin Slide','Cute & Playful','🐧',99,'regular','',false,'bell',false,130),
  ('mango_frog','Mango Frog','Cute & Playful','🐸',199,'regular','',false,'bell',false,140),
  ('gold_biscuit','Gold Biscuit','Flex & Luxury','🟡',19,'regular','',false,'bell',false,10),
  ('drip_shades','Drip Shades','Flex & Luxury','🕶',29,'regular','',false,'bell',false,20),
  ('iced_out_watch','Iced-Out Watch','Flex & Luxury','⌚',79,'regular','',false,'bell',false,30),
  ('stack_of_lakhs','Stack of Lakhs','Flex & Luxury','💵',99,'regular','',false,'bell',false,40),
  ('auto_rickshaw_roller','Auto-Rickshaw Roller','Flex & Luxury','🛺',199,'regular','',false,'bell',false,50),
  ('bullet_thunder','Bullet Thunder','Flex & Luxury','🏍',299,'regular','',false,'bell',false,60),
  ('solitaire_sparkle','Solitaire Sparkle','Flex & Luxury','💍',399,'premium','',false,'chime_big',false,70),
  ('midnight_coupe','Midnight Coupe','Flex & Luxury','🏎',599,'premium','',true,'fanfare',false,80),
  ('skyline_yacht','Skyline Yacht','Flex & Luxury','🛥',999,'premium','',true,'fanfare',false,90),
  ('diamond_cascade','Diamond Cascade','Flex & Luxury','💎',1499,'premium','',true,'fanfare',false,100),
  ('private_jet_takeoff','Private Jet Takeoff','Flex & Luxury','✈️',1999,'premium','',true,'fanfare',false,110),
  ('maharaja_s_vault','Maharaja''s Vault','Flex & Luxury','🏆',4999,'premium','',true,'fanfare',false,120),
  ('gajra_of_gold','Gajra of Gold','Flex & Luxury','🌼',49,'regular','',false,'bell',false,130),
  ('platinum_card','Platinum Card','Flex & Luxury','💳',299,'regular','',false,'bell',false,140),
  ('diwali_sky','Diwali Sky','Legendary & Epic','🎆',999,'regular','',true,'fanfare',false,10),
  ('starlight_rocket','Starlight Rocket','Legendary & Epic','🚀',999,'regular','',true,'fanfare',false,20),
  ('genda_phoolon_ka_mahal_marigold_palace','Genda Phoolon Ka Mahal (Marigold Palace)','Legendary & Epic','🏯',1499,'premium','',true,'fanfare',false,30),
  ('peacock_throne','Peacock Throne','Legendary & Epic','🦚',1499,'premium','',true,'fanfare',false,40),
  ('garuda_s_flight','Garuda''s Flight','Legendary & Epic','🦅',1999,'premium','',true,'fanfare',false,50),
  ('naga_storm','Naga Storm','Legendary & Epic','🐍',1999,'premium','',true,'fanfare',false,60),
  ('maharaja_s_baraat','Maharaja''s Baraat','Legendary & Epic','🐘',2999,'premium','',true,'fanfare',false,70),
  ('galaxy_crown','Galaxy Crown','Legendary & Epic','🌌',2999,'premium','',true,'fanfare',false,80),
  ('phoenix_of_lights','Phoenix of Lights','Legendary & Epic','🔥',4999,'premium','',true,'fanfare',false,90),
  ('sone_ki_lanka_golden_citadel','Sone Ki Lanka (Golden Citadel)','Legendary & Epic','🏰',4999,'premium','',true,'fanfare',false,100),
  ('ringin_maharaja_crown_the_crown_jewel','RingIn Maharaja Crown — The Crown Jewel','Legendary & Epic','👑',4999,'premium','',true,'fanfare',false,110),
  ('ek_diya','Ek Diya','Festive & India Special','🪔',49,'regular','',false,'bell',false,10),
  ('rang_splash','Rang Splash','Festive & India Special','🎨',49,'regular','',false,'bell',false,20),
  ('pyaar_ka_dhaaga','Pyaar Ka Dhaaga','Festive & India Special','🧵',79,'regular','',false,'bell',false,30),
  ('genda_garland','Genda Garland','Festive & India Special','🌼',99,'regular','',false,'bell',false,40),
  ('mithai_thali','Mithai Thali','Festive & India Special','🍬',99,'regular','',false,'bell',false,50),
  ('phuljhadi_spark','Phuljhadi Spark','Festive & India Special','🎇',199,'regular','',false,'bell',false,60),
  ('dhol_tashaa','Dhol Tashaa','Festive & India Special','🥁',299,'regular','',false,'bell',false,70),
  ('filmi_spotlight','Filmi Spotlight','Festive & India Special','🎬',399,'premium','',false,'chime_big',false,80),
  ('cricket_trophy_roar','Cricket Trophy Roar','Festive & India Special','🏆',599,'premium','',true,'fanfare',false,90),
  ('aakash_aatishbaazi','Aakash Aatishbaazi','Festive & India Special','🎆',999,'premium','',true,'fanfare',false,100),
  ('baraat_procession','Baraat Procession','Festive & India Special','🐘',1499,'premium','',true,'fanfare',false,110),
  ('mor_singhaasan','Mor Singhaasan','Festive & India Special','🦚',1999,'premium','',true,'fanfare',false,120),
  ('mohabbat_ka_taj','Mohabbat Ka Taj','Festive & India Special','🕌',2999,'premium','',true,'fanfare',false,130),
  ('mini_mukut','Mini Mukut','Royalty & Power','👑',99,'regular','',false,'bell',false,10),
  ('royal_nod','Royal Nod','Royalty & Power','🫅',199,'regular','',false,'bell',false,20),
  ('vip_gold_card','VIP Gold Card','Royalty & Power','💳',299,'regular','',false,'bell',false,30),
  ('throne_invite','Throne Invite','Royalty & Power','🪑',399,'premium','',false,'chime_big',false,40),
  ('crown_of_hearts','Crown of Hearts','Royalty & Power','💛',499,'premium','',false,'chime_big',false,50),
  ('royal_scepter','Royal Scepter','Royalty & Power','🪄',599,'premium','',false,'chime_big',false,60),
  ('maharani_tiara','Maharani Tiara','Royalty & Power','💎',799,'premium','',true,'fanfare',false,70),
  ('maharaja_pagdi','Maharaja Pagdi','Royalty & Power','🤴',999,'premium','',true,'fanfare',false,80),
  ('diamond_throne','Diamond Throne','Royalty & Power','🪑',1499,'premium','',true,'fanfare',false,90),
  ('royal_court','Royal Court','Royalty & Power','🎺',1999,'premium','',true,'fanfare',false,100),
  ('mayura_throne','Mayura Throne','Royalty & Power','🦚',2999,'premium','',true,'fanfare',false,110),
  ('palace_coronation','Palace Coronation','Royalty & Power','🏰',4999,'premium','',true,'fanfare',false,120),
  ('chai_surprise','Chai Surprise','Lucky Mystery Box','🫖🎁',29,'regular','',false,'bell',true,10),
  ('lucky_laddoo','Lucky Laddoo','Lucky Mystery Box','🟡🎁',49,'regular','',false,'bell',true,20),
  ('paan_pop_box','Paan Pop Box','Lucky Mystery Box','🍃🎁',79,'regular','',false,'bell',true,30),
  ('rangoli_riddle','Rangoli Riddle','Lucky Mystery Box','🌸🎁',99,'regular','',false,'bell',true,40),
  ('mango_monsoon_crate','Mango Monsoon Crate','Lucky Mystery Box','🥭📦',199,'regular','',false,'bell',true,50),
  ('festive_pinata_box','Festive Pinata Box','Lucky Mystery Box','🪅🎁',299,'regular','',false,'bell',true,60),
  ('diwali_diya_vault','Diwali Diya Vault','Lucky Mystery Box','🪔🎁',399,'premium','',true,'fanfare',true,70),
  ('peacock_fortune_box','Peacock Fortune Box','Lucky Mystery Box','🦚🎁',599,'premium','',true,'fanfare',true,80),
  ('maharaja_treasure_chest','Maharaja Treasure Chest','Lucky Mystery Box','👑🧰',799,'premium','',true,'fanfare',true,90),
  ('crown_jewel_vault','Crown Jewel Vault','Lucky Mystery Box','💎🎁',999,'premium','',true,'fanfare',true,100),
  ('sufi_whirl_night','Sufi Whirl Night','Music & Vibes','🌀',999,'premium','',true,'fanfare',false,130),
  ('stadium_anthem','Stadium Anthem','Music & Vibes','🏟️',1999,'premium','',true,'fanfare',false,140),
  ('plushie_parade','Plushie Parade','Cute & Playful','🧸',999,'premium','',true,'fanfare',false,150),
  ('cuddle_cloud','Cuddle Cloud','Cute & Playful','☁️',499,'premium','',false,'chime_big',false,160),
  ('love_locket','Love Locket','Love & Romance','🔐',499,'premium','',false,'chime_big',false,140),
  ('pyaar_tap','Pyaar Tap','Love & Romance','💗',9,'regular','',false,'bell',false,150)
on conflict (gift_key) do update set
  name=excluded.name, category=excluded.category, icon=excluded.icon, coins=excluded.coins,
  tier=excluded.tier, fullscreen=excluded.fullscreen, sound=excluded.sound,
  is_lucky_box=excluded.is_lucky_box, sort=excluded.sort, active=true;
