-- ============================================================================
-- AGORA DIAGNOSIS — run this if calls don't ring on the callee's device.
-- ============================================================================
-- Tells you which piece is broken: table, RLS, publication, or none of those.

-- 1) Is the table there?
SELECT 'TABLE EXISTS' AS check, COUNT(*)::text AS result
FROM information_schema.tables
WHERE table_name='call_invites';
-- Expected: 1

-- 2) Is RLS enabled?
SELECT 'RLS ENABLED' AS check,
       CASE WHEN c.relrowsecurity THEN '1' ELSE '0' END AS result
FROM pg_class c
WHERE c.relname='call_invites' AND c.relkind='r';
-- Expected: 1

-- 3) Do the 3 RLS policies exist?
SELECT 'POLICIES COUNT' AS check, COUNT(*)::text AS result
FROM pg_policies
WHERE tablename='call_invites';
-- Expected: 3

-- 4) Is the table in the realtime publication? (THIS IS USUALLY THE PROBLEM)
SELECT 'REALTIME PUBLICATION' AS check,
       CASE WHEN EXISTS (
         SELECT 1
         FROM pg_publication p
         JOIN pg_publication_rel pr ON pr.prpubid = p.oid
         JOIN pg_class c ON c.oid = pr.prrelid
         WHERE p.pubname = 'supabase_realtime' AND c.relname = 'call_invites'
       ) THEN '1' ELSE '0' END AS result;
-- Expected: 1   (if 0, run the FIX below)

-- 5) Recent invite rows (any in the last 5 min?)
SELECT 'RECENT INVITES' AS check, COUNT(*)::text AS result
FROM call_invites
WHERE created_at > now() - interval '5 minutes';

-- ============================================================================
-- FIX — run this if check #4 returned 0
-- ============================================================================
-- Option A: try the SQL (sometimes blocked on Supabase free tier)
--   ALTER PUBLICATION supabase_realtime ADD TABLE call_invites;
--
-- Option B (more reliable): enable via Supabase Dashboard
--   1. Open Supabase Dashboard → Database → Replication
--   2. Find "supabase_realtime" publication
--   3. Click "0 tables" (or "X tables") next to it
--   4. Find "call_invites" in the list and toggle it ON
--   5. Save
-- ============================================================================
