-- ════════════════════════════════════════════════════════════════════
-- Real cleaned PNG frames (Neon + VIP) + bring back plain "Classic Rings";
-- drop the grid-sliced frames, the Premium-silver set, and Sigma.
--
-- The 9 frames came from the user's Gemini files (solid dark bg, filled
-- centre) → background-keyed + ring-centred + hollowed into transparent PNGs
-- in public/frames/. payload.img points at them; render is ring-centred.
-- Requires 0049/0050 (catalog_items). Re-run safe.
-- ════════════════════════════════════════════════════════════════════

-- 1. Deactivate the old grid-sliced / unused winged frames (bad checkerboard art).
update public.catalog_items set active = false where id in (
  'frame_neon_butterfly','frame_prem_silver','frame_prem_frost','frame_prem_violet','frame_prem_rose',
  'frame_vip_royal','frame_vip_tiara',
  'frame_sigma_dark','frame_sigma_blood','frame_sigma_silver','frame_sigma_rose'
);

-- 2. Bring back the plain glowing RING frames (neon glow + gold aura + aurora)
--    as a "Classic Rings" tier. These render as CSS rings (no img).
update public.catalog_items set active = true, section = 'Classic Rings', price_coins = 149
 where id in ('frame_pulse','frame_cyber','frame_pinkhalo','frame_limewire','frame_goldaura','frame_aurora');

-- 3. The 9 real cleaned PNG frames.
insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload, active) values
  ('frame_neon_blue',    'frame','Neon Wings','Neon Blue',    149,false,10,'{"img":"/frames/frame_neon_blue.png"}',    true),
  ('frame_neon_violet',  'frame','Neon Wings','Neon Violet',  149,false,20,'{"img":"/frames/frame_neon_violet.png"}',  true),
  ('frame_neon_pink',    'frame','Neon Wings','Neon Pink',    149,false,30,'{"img":"/frames/frame_neon_pink.png"}',    true),
  ('frame_neon_magenta', 'frame','Neon Wings','Neon Magenta', 149,false,40,'{"img":"/frames/frame_neon_magenta.png"}', true),
  ('frame_neon_cyan',    'frame','Neon Wings','Neon Cyan',    149,false,50,'{"img":"/frames/frame_neon_cyan.png"}',    true),
  ('frame_neon_aqua',    'frame','Neon Wings','Neon Aqua',    149,false,60,'{"img":"/frames/frame_neon_aqua.png"}',    true),
  ('frame_neon_teal',    'frame','Neon Wings','Neon Teal',    149,false,70,'{"img":"/frames/frame_neon_teal.png"}',    true),
  ('frame_vip_gold',     'frame','VIP Wings','Gold Royal',    299,true, 10,'{"img":"/frames/frame_vip_gold.png"}',     true),
  ('frame_vip_onyx',     'frame','VIP Wings','Onyx Gold',     299,true, 20,'{"img":"/frames/frame_vip_onyx.png"}',     true)
on conflict (id) do update set
  kind=excluded.kind, section=excluded.section, name=excluded.name, price_coins=excluded.price_coins,
  is_premium=excluded.is_premium, sort=excluded.sort, payload=excluded.payload, active=true;
