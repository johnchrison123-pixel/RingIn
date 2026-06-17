-- ════════════════════════════════════════════════════════════════════
-- Cosmetics store — coin-bought, account-bound profile customization.
--
-- Four kinds, sold for existing coins (profiles.coins):
--   tag     — neon title flair under the name (Rockstar, Hero, ...)
--   frame   — neon PFP ring; premium ones have wings (VIP look)
--   sticker — 3D-style neon glyphs (zodiac, instruments, vibes)
--   theme   — neon accent palette applied to the profile
--
-- NOT a blockchain/NFT (India taxes VDAs at 30%+1% TDS) — these are plain
-- in-app goods: ownership lives in profiles.owned_cosmetics, the equipped
-- selection in profiles.equipped. Visual rendering is done client-side from
-- the payload (color/glyph/css-key), so real 3D art can swap in later by
-- editing payload — no schema change.
--
-- Expand-only. No drops/renames. Safe to run anytime. The client reads
-- owned/equipped defensively (treats missing columns/catalog as "none").
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. Ownership + equipped columns on profiles ════════
alter table public.profiles add column if not exists owned_cosmetics jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists equipped        jsonb not null default '{}'::jsonb;

-- ════════ 2. Catalog ════════
create table if not exists public.catalog_items (
  id          text primary key,
  kind        text not null check (kind in ('tag','frame','sticker','theme')),
  section     text not null,
  name        text not null,
  price_coins integer not null default 0 check (price_coins >= 0),
  is_premium  boolean not null default false,
  sort        integer not null default 0,
  active      boolean not null default true,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.catalog_items enable row level security;

-- The store is public to signed-in users; nobody but migrations can write.
drop policy if exists "catalog_read" on public.catalog_items;
create policy "catalog_read" on public.catalog_items
  for select using (true);

grant select on public.catalog_items to anon, authenticated;

create index if not exists catalog_items_kind_idx on public.catalog_items (kind, sort);

-- ════════ 3. Seed the catalog ════════

-- 3a. Title tags (neon text flair).
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  ('tag_rockstar',    'tag','Title Tags','Rockstar',     100, false, 10, '{"color":"#E84D9A"}'),
  ('tag_hero',        'tag','Title Tags','Hero',         100, false, 20, '{"color":"#378ADD"}'),
  ('tag_entrepreneur','tag','Title Tags','Entrepreneur', 120, false, 30, '{"color":"#FBC56B"}'),
  ('tag_influencer',  'tag','Title Tags','Influencer',   120, false, 40, '{"color":"#9B59FF"}'),
  ('tag_creator',     'tag','Title Tags','Creator',      120, false, 50, '{"color":"#1DC9A0"}'),
  ('tag_hustler',     'tag','Title Tags','Hustler',      100, false, 60, '{"color":"#FF6B2D"}'),
  ('tag_maverick',    'tag','Title Tags','Maverick',     100, false, 70, '{"color":"#7B6EFF"}'),
  ('tag_trendsetter', 'tag','Title Tags','Trendsetter',  120, false, 80, '{"color":"#FF3D7F"}'),
  ('tag_pioneer',     'tag','Title Tags','Pioneer',      120, false, 90, '{"color":"#1DC9A0"}'),
  ('tag_legend',      'tag','Title Tags','Legend',       150, true, 100, '{"color":"#FFD93D"}'),
  ('tag_visionary',   'tag','Title Tags','Visionary',    150, true, 110, '{"color":"#00E5FF"}'),
  ('tag_icon',        'tag','Title Tags','Icon',         150, true, 120, '{"color":"#FF3D7F"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;

-- 3b. PFP frames (neon rings; winged = premium VIP).
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  ('frame_pulse',    'frame','Neon Frames','Neon Pulse',     120, false, 10, '{"css":"ring-pulse","color":"#7B6EFF"}'),
  ('frame_cyber',    'frame','Neon Frames','Cyber Ring',     120, false, 20, '{"css":"ring-solid","color":"#00E5FF"}'),
  ('frame_pinkhalo', 'frame','Neon Frames','Hot Pink Halo',  120, false, 30, '{"css":"ring-solid","color":"#FF3D7F"}'),
  ('frame_limewire', 'frame','Neon Frames','Lime Wire',      120, false, 40, '{"css":"ring-solid","color":"#9BE15D"}'),
  ('frame_goldaura', 'frame','Neon Frames','Gold Aura',      200, true,  50, '{"css":"ring-double","color":"#FFD93D"}'),
  ('frame_aurora',   'frame','Neon Frames','Aurora Ring',    200, true,  60, '{"css":"ring-gradient","color":"#1DC9A0","color2":"#378ADD"}'),
  ('frame_angel',    'frame','Neon Frames','Angel Wings',    500, true,  70, '{"css":"wings","color":"#EAF6FF","glow":"#BFE4FF"}'),
  ('frame_phoenix',  'frame','Neon Frames','Phoenix Wings',  700, true,  80, '{"css":"wings","color":"#FF6B2D","glow":"#FFB37A"}'),
  ('frame_dragon',   'frame','Neon Frames','Dragon Wings',   700, true,  90, '{"css":"wings","color":"#9BE15D","glow":"#D6FFA8"}'),
  ('frame_cosmic',   'frame','Neon Frames','Cosmic Wings',   800, true, 100, '{"css":"wings","color":"#9B59FF","glow":"#D9B8FF"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;

-- 3c. Stickers — zodiac signs.
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  ('sticker_aries',      'sticker','Zodiac Stickers','Aries',        60, false, 10, '{"glyph":"♈","color":"#FF6B2D"}'),
  ('sticker_taurus',     'sticker','Zodiac Stickers','Taurus',       60, false, 20, '{"glyph":"♉","color":"#1DC9A0"}'),
  ('sticker_gemini',     'sticker','Zodiac Stickers','Gemini',       60, false, 30, '{"glyph":"♊","color":"#FBC56B"}'),
  ('sticker_cancer',     'sticker','Zodiac Stickers','Cancer',       60, false, 40, '{"glyph":"♋","color":"#00E5FF"}'),
  ('sticker_leo',        'sticker','Zodiac Stickers','Leo',          60, false, 50, '{"glyph":"♌","color":"#FFD93D"}'),
  ('sticker_virgo',      'sticker','Zodiac Stickers','Virgo',        60, false, 60, '{"glyph":"♍","color":"#9BE15D"}'),
  ('sticker_libra',      'sticker','Zodiac Stickers','Libra',        60, false, 70, '{"glyph":"♎","color":"#FF3D7F"}'),
  ('sticker_scorpio',    'sticker','Zodiac Stickers','Scorpio',      60, false, 80, '{"glyph":"♏","color":"#9B59FF"}'),
  ('sticker_sagittarius','sticker','Zodiac Stickers','Sagittarius',  60, false, 90, '{"glyph":"♐","color":"#FF6B2D"}'),
  ('sticker_capricorn',  'sticker','Zodiac Stickers','Capricorn',    60, false,100, '{"glyph":"♑","color":"#1DC9A0"}'),
  ('sticker_aquarius',   'sticker','Zodiac Stickers','Aquarius',     60, false,110, '{"glyph":"♒","color":"#00E5FF"}'),
  ('sticker_pisces',     'sticker','Zodiac Stickers','Pisces',       60, false,120, '{"glyph":"♓","color":"#378ADD"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;

-- 3d. Stickers — musical instruments.
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  ('sticker_guitar',    'sticker','Music Stickers','Guitar',     70, false, 10, '{"glyph":"🎸","color":"#FF6B2D"}'),
  ('sticker_piano',     'sticker','Music Stickers','Piano',      70, false, 20, '{"glyph":"🎹","color":"#7B6EFF"}'),
  ('sticker_trumpet',   'sticker','Music Stickers','Trumpet',    70, false, 30, '{"glyph":"🎺","color":"#FBC56B"}'),
  ('sticker_violin',    'sticker','Music Stickers','Violin',     70, false, 40, '{"glyph":"🎻","color":"#E84D9A"}'),
  ('sticker_drums',     'sticker','Music Stickers','Drums',      70, false, 50, '{"glyph":"🥁","color":"#1DC9A0"}'),
  ('sticker_mic',       'sticker','Music Stickers','Mic',        70, false, 60, '{"glyph":"🎤","color":"#FF3D7F"}'),
  ('sticker_headphones','sticker','Music Stickers','Headphones', 70, false, 70, '{"glyph":"🎧","color":"#00E5FF"}'),
  ('sticker_sax',       'sticker','Music Stickers','Saxophone',  70, false, 80, '{"glyph":"🎷","color":"#FFD93D"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;

-- 3e. Stickers — vibes.
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  ('sticker_fire',     'sticker','Vibe Stickers','Fire',     70, false, 10, '{"glyph":"🔥","color":"#FF6B2D"}'),
  ('sticker_bolt',     'sticker','Vibe Stickers','Bolt',     70, false, 20, '{"glyph":"⚡","color":"#FFD93D"}'),
  ('sticker_diamond',  'sticker','Vibe Stickers','Diamond',  90, true,  30, '{"glyph":"💎","color":"#00E5FF"}'),
  ('sticker_crown',    'sticker','Vibe Stickers','Crown',    90, true,  40, '{"glyph":"👑","color":"#FFD93D"}'),
  ('sticker_rocket',   'sticker','Vibe Stickers','Rocket',   70, false, 50, '{"glyph":"🚀","color":"#9B59FF"}'),
  ('sticker_star',     'sticker','Vibe Stickers','Star',     70, false, 60, '{"glyph":"⭐","color":"#FBC56B"}'),
  ('sticker_butterfly','sticker','Vibe Stickers','Butterfly',70, false, 70, '{"glyph":"🦋","color":"#E84D9A"}'),
  ('sticker_moon',     'sticker','Vibe Stickers','Moon',     70, false, 80, '{"glyph":"🌙","color":"#7B6EFF"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;

-- 3f. Neon themes (accent palettes). Synthwave is the free default.
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  ('theme_synthwave','theme','Neon Themes','Synthwave',    0, false, 10, '{"accent":"#7B6EFF","accent2":"#E84D9A","glow":"rgba(123,110,255,0.5)"}'),
  ('theme_cyberlime','theme','Neon Themes','Cyber-Lime', 150, false, 20, '{"accent":"#9BE15D","accent2":"#1DC9A0","glow":"rgba(155,225,93,0.5)"}'),
  ('theme_aurora',   'theme','Neon Themes','Aurora',     150, false, 30, '{"accent":"#1DC9A0","accent2":"#378ADD","glow":"rgba(29,201,160,0.5)"}'),
  ('theme_inferno',  'theme','Neon Themes','Inferno',    150, false, 40, '{"accent":"#FF6B2D","accent2":"#FF3D7F","glow":"rgba(255,107,45,0.5)"}'),
  ('theme_galaxy',   'theme','Neon Themes','Galaxy',     150, false, 50, '{"accent":"#9B59FF","accent2":"#534AB7","glow":"rgba(155,89,255,0.5)"}'),
  ('theme_ice',      'theme','Neon Themes','Ice',        150, false, 60, '{"accent":"#00E5FF","accent2":"#A9E6FF","glow":"rgba(0,229,255,0.5)"}'),
  ('theme_sunset',   'theme','Neon Themes','Sunset',     150, false, 70, '{"accent":"#FF8A5B","accent2":"#FF3D7F","glow":"rgba(255,138,91,0.5)"}'),
  ('theme_vapor',    'theme','Neon Themes','Vaporwave',  200, true,  80, '{"accent":"#FF6AD5","accent2":"#00E5FF","glow":"rgba(255,106,213,0.5)"}'),
  ('theme_goldlux',  'theme','Neon Themes','Gold Lux',   250, true,  90, '{"accent":"#FFD93D","accent2":"#FF6B2D","glow":"rgba(255,217,61,0.5)"}'),
  ('theme_matrix',   'theme','Neon Themes','Matrix',     200, true, 100, '{"accent":"#39FF14","accent2":"#0FA958","glow":"rgba(57,255,20,0.5)"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;

-- ════════ 4. buy_cosmetic — atomic coin debit + grant ownership ════════
create or replace function public.buy_cosmetic(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  it       public.catalog_items;
  cur_bal  integer;
  new_bal  integer;
  owned    jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into it from public.catalog_items where id = p_item_id and active = true;
  if not found then return jsonb_build_object('status','not_found'); end if;

  -- Lock the buyer's row for the balance check + debit.
  select coins, coalesce(owned_cosmetics,'[]'::jsonb)
    into cur_bal, owned
    from public.profiles where id = auth.uid() for update;

  if owned ? p_item_id then
    return jsonb_build_object('status','already_owned','balance',coalesce(cur_bal,0));
  end if;

  if coalesce(cur_bal,0) < it.price_coins then
    return jsonb_build_object('status','insufficient','balance',coalesce(cur_bal,0),'price',it.price_coins);
  end if;

  new_bal := coalesce(cur_bal,0) - it.price_coins;
  update public.profiles
     set coins = new_bal,
         owned_cosmetics = coalesce(owned_cosmetics,'[]'::jsonb) || to_jsonb(p_item_id)
   where id = auth.uid();

  return jsonb_build_object('status','ok','balance',new_bal,'item_id',p_item_id);
end;
$$;

revoke all on function public.buy_cosmetic(text) from public;
grant execute on function public.buy_cosmetic(text) to authenticated;

-- ════════ 5. equip_cosmetic — set/clear the equipped slot for a kind ════════
-- Pass p_item_id = '' (or null) to unequip that slot. Validates ownership.
create or replace function public.equip_cosmetic(p_kind text, p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare owned jsonb; clearing boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('tag','frame','sticker','theme') then
    return jsonb_build_object('status','bad_kind');
  end if;

  clearing := (p_item_id is null or length(p_item_id) = 0);

  if not clearing then
    select coalesce(owned_cosmetics,'[]'::jsonb) into owned from public.profiles where id = auth.uid();
    if not (owned ? p_item_id) then
      return jsonb_build_object('status','not_owned');
    end if;
  end if;

  update public.profiles
     set equipped = jsonb_set(
           coalesce(equipped,'{}'::jsonb),
           array[p_kind],
           case when clearing then 'null'::jsonb else to_jsonb(p_item_id) end,
           true)
   where id = auth.uid();

  return jsonb_build_object('status','ok','kind',p_kind,'item_id',case when clearing then null else p_item_id end);
end;
$$;

revoke all on function public.equip_cosmetic(text, text) from public;
grant execute on function public.equip_cosmetic(text, text) to authenticated;
