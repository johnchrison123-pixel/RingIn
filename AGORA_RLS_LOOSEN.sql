-- ============================================================================
-- LOOSEN call_invites RLS — quick fix to unblock the receiving side
-- ============================================================================
-- Run this in Supabase SQL Editor.
--
-- What this does:
--   - Any authenticated user can SELECT any call_invites row (so realtime
--     broadcasts reach the callee even if caller_id/callee_id is slightly off).
--   - Anyone authenticated can INSERT (drops the auth.uid()=caller_id check).
--   - Anyone authenticated can UPDATE.
--
-- Trade-off: any signed-in user could in theory read/modify any call invite.
-- For Phase 1 testing this is fine. Tighten later via:
--     auth.uid() = caller_id OR auth.uid() = callee_id
-- once we've confirmed everything works end to end.
-- ============================================================================

DROP POLICY IF EXISTS "call_invites_participants_read"   ON call_invites;
DROP POLICY IF EXISTS "call_invites_caller_insert"       ON call_invites;
DROP POLICY IF EXISTS "call_invites_participants_update" ON call_invites;
DROP POLICY IF EXISTS "call_invites_open_read"           ON call_invites;
DROP POLICY IF EXISTS "call_invites_open_insert"         ON call_invites;
DROP POLICY IF EXISTS "call_invites_open_update"         ON call_invites;

CREATE POLICY "call_invites_open_read" ON call_invites
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "call_invites_open_insert" ON call_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "call_invites_open_update" ON call_invites
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Confirm
SELECT 'POLICIES NOW' AS check, count(*)::text AS result
FROM pg_policies WHERE tablename='call_invites';
-- Expected: 3
