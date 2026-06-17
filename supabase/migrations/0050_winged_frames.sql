-- ════════════════════════════════════════════════════════════════════
-- Winged PFP frames, section-wise (Neon / VIP / Premium / Sigma), to match
-- the reference designs. Vector-rendered client-side from `payload`
-- (wing style + gradient colors + crown + badge); payload.img can later
-- carry a transparent PNG for an exact-art swap with no code change.
--
-- Prices (coins): Neon 149, Premium 199, VIP 299, Sigma 249 (all >= 149).
-- Expand-only upsert. Re-run safe. Requires 0049 (catalog_items) first.
-- ════════════════════════════════════════════════════════════════════

-- Retire the generic 0049 ring/wing frames in favour of the section set.
update public.catalog_items set active = false
 where id in (
   'frame_pulse','frame_cyber','frame_pinkhalo','frame_limewire',
   'frame_goldaura','frame_aurora','frame_angel','frame_phoenix',
   'frame_dragon','frame_cosmic'
 );

insert into public.catalog_items (id, kind, section, name, price_coins, is_premium, sort, payload) values
  -- Neon Wings (149)
  ('frame_neon_blue',     'frame','Neon Wings','Neon Blue Wings',     149,false,10,'{"wing":"angel","c1":"#00E5FF","c2":"#2D7BFF","crown":"king","img":"/frames/frame_neon_blue.png"}'),
  ('frame_neon_violet',   'frame','Neon Wings','Neon Violet Wings',   149,false,20,'{"wing":"angel","c1":"#9B59FF","c2":"#E84D9A","crown":"king","img":"/frames/frame_neon_violet.png"}'),
  ('frame_neon_butterfly','frame','Neon Wings','Neon Butterfly',      149,false,30,'{"wing":"butterfly","c1":"#FF6AD5","c2":"#00E5FF","crown":"tiara","img":"/frames/frame_neon_butterfly.png"}'),
  ('frame_neon_magenta',  'frame','Neon Wings','Neon Magenta Wings',  149,false,40,'{"wing":"angel","c1":"#FF3D7F","c2":"#9B59FF","crown":"tiara","img":"/frames/frame_neon_magenta.png"}'),
  -- Premium Wings (199)
  ('frame_prem_silver',   'frame','Premium Wings','Silver Seraph',    199,true,10,'{"wing":"feather","c1":"#EAF6FF","c2":"#9FB6CF","crown":"king","badge":"PREMIUM","img":"/frames/frame_prem_silver.png"}'),
  ('frame_prem_frost',    'frame','Premium Wings','Frost Seraph',     199,true,20,'{"wing":"feather","c1":"#CFE8FF","c2":"#7AA7D8","crown":"king","badge":"PREMIUM","img":"/frames/frame_prem_frost.png"}'),
  ('frame_prem_violet',   'frame','Premium Wings','Violet Seraph',    199,true,30,'{"wing":"feather","c1":"#E3CBFF","c2":"#9B7BD8","crown":"tiara","badge":"PREMIUM","img":"/frames/frame_prem_violet.png"}'),
  ('frame_prem_rose',     'frame','Premium Wings','Rose Seraph',      199,true,40,'{"wing":"feather","c1":"#FFD6E8","c2":"#C98BB0","crown":"tiara","badge":"PREMIUM","img":"/frames/frame_prem_rose.png"}'),
  -- VIP Wings (299)
  ('frame_vip_gold',      'frame','VIP Wings','Gold Royal',           299,true,10,'{"wing":"feather","c1":"#FFE7A0","c2":"#C8881B","crown":"king","badge":"VIP","img":"/frames/frame_vip_gold.png"}'),
  ('frame_vip_onyx',      'frame','VIP Wings','Onyx Gold',            299,true,20,'{"wing":"feather","c1":"#FFE7A0","c2":"#3A2E0B","crown":"king","badge":"VIP","img":"/frames/frame_vip_onyx.png"}'),
  ('frame_vip_royal',     'frame','VIP Wings','Royal Flame',          299,true,30,'{"wing":"feather","c1":"#FFD93D","c2":"#FF8A00","crown":"king","badge":"VIP","img":"/frames/frame_vip_royal.png"}'),
  ('frame_vip_tiara',     'frame','VIP Wings','Gold Tiara',           299,true,40,'{"wing":"feather","c1":"#FFE7A0","c2":"#C8881B","crown":"tiara","badge":"VIP","img":"/frames/frame_vip_tiara.png"}'),
  -- Sigma Wings (249)
  ('frame_sigma_dark',    'frame','Sigma Wings','Shadow Sigma',       249,true,10,'{"wing":"demon","c1":"#8A8A8A","c2":"#161616","crown":"king","badge":"Σ","img":"/frames/frame_sigma_dark.png"}'),
  ('frame_sigma_blood',   'frame','Sigma Wings','Blood Sigma',        249,true,20,'{"wing":"demon","c1":"#FF3D3D","c2":"#3A0000","crown":"king","badge":"Σ","img":"/frames/frame_sigma_blood.png"}'),
  ('frame_sigma_silver',  'frame','Sigma Wings','Silver Sigma',       249,true,30,'{"wing":"angel","c1":"#D0D0D0","c2":"#5A5A5A","crown":"king","badge":"Σ","img":"/frames/frame_sigma_silver.png"}'),
  ('frame_sigma_rose',    'frame','Sigma Wings','Rose Sigma',         249,true,40,'{"wing":"angel","c1":"#FF8AB0","c2":"#5A2030","crown":"tiara","badge":"Σ","img":"/frames/frame_sigma_rose.png"}')
on conflict (id) do update set
  name=excluded.name, price_coins=excluded.price_coins, is_premium=excluded.is_premium,
  section=excluded.section, sort=excluded.sort, payload=excluded.payload, active=true;
