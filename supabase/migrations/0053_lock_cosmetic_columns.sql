-- ════════════════════════════════════════════════════════════════════
-- Lock down the cosmetic OWNERSHIP columns (money-leak fix).
--
-- 0049 added profiles.owned_cosmetics + profiles.equipped but never added
-- them to the R58/0038 column-level REVOKE list. So the `authenticated`
-- role could self-grant EVERY cosmetic for free, bypassing buy_cosmetic
-- entirely, via:  sb.from('profiles').update({ owned_cosmetics:[...all ids] })
-- — and could equip anything it never bought.
--
-- Fix: revoke column-level UPDATE on both from `authenticated`. The
-- SECURITY DEFINER buy_cosmetic / equip_cosmetic RPCs are owned by postgres
-- and bypass this revoke, so buying + equipping keep working normally.
-- Verified: the client only SELECTs these columns (StoreScreen.js:35,
-- HomeScreen.js:311) — it never writes them directly — so nothing breaks.
-- Idempotent / re-run safe.
-- ════════════════════════════════════════════════════════════════════

revoke update (owned_cosmetics) on public.profiles from authenticated;
revoke update (equipped)        on public.profiles from authenticated;
