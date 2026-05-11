-- ===========================================================================
-- AGORA VOICE CALL SUPPORT — run this once in Supabase SQL Editor
-- ===========================================================================
-- After running, also do:
--   1) Add Vercel Environment Variable:  AGORA_APP_CERTIFICATE = <your cert>
--      (Settings → Environment Variables → add for Production+Preview+Development)
--   2) Wait for Vercel to redeploy (~2 min after the next push)
-- ===========================================================================

-- 1) Table: call_invites — one row per call attempt (ringing, accepted, etc.)
CREATE TABLE IF NOT EXISTS call_invites (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id       UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  caller_name     TEXT,
  caller_avatar   TEXT,
  callee_id       UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_name     TEXT,
  callee_avatar   TEXT,
  channel         TEXT         NOT NULL,        -- Agora channel name (= invite id)
  status          TEXT         NOT NULL DEFAULT 'ringing'
                              CHECK (status IN ('ringing','accepted','rejected','missed','ended','cancelled')),
  rate_per_min    INTEGER      NOT NULL DEFAULT 30,
  started_at      TIMESTAMPTZ,                  -- when the call actually connected
  ended_at        TIMESTAMPTZ,
  duration_secs   INTEGER,
  end_reason      TEXT,                         -- 'caller_hangup'|'callee_hangup'|'rejected'|'no_answer'|'no_coins'
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_invites_callee_status ON call_invites(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_call_invites_caller_status ON call_invites(caller_id, status);
CREATE INDEX IF NOT EXISTS idx_call_invites_created_at    ON call_invites(created_at DESC);

-- 2) RLS — only the two participants can read/update an invite
ALTER TABLE call_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_invites_participants_read"   ON call_invites;
DROP POLICY IF EXISTS "call_invites_caller_insert"       ON call_invites;
DROP POLICY IF EXISTS "call_invites_participants_update" ON call_invites;

CREATE POLICY "call_invites_participants_read" ON call_invites
  FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "call_invites_caller_insert" ON call_invites
  FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "call_invites_participants_update" ON call_invites
  FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- 3) Realtime: enable on call_invites so subscriptions fire
ALTER PUBLICATION supabase_realtime ADD TABLE call_invites;

-- 4) Done — verify
SELECT 'call_invites table ready' AS status,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='call_invites') AS exists;
