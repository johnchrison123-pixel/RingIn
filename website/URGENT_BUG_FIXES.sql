-- =====================================================
-- URGENT BUG FIXES for RingIn — Run in Supabase SQL Editor
-- Safe to run multiple times.
-- =====================================================

-- 1) Fix notifications schema mismatch
-- Mobile app inserts 'message' field but column doesn't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;

-- Backfill: copy text→message and vice versa so both apps work
UPDATE notifications SET message = COALESCE(message, text) WHERE message IS NULL AND text IS NOT NULL;
UPDATE notifications SET text = COALESCE(text, message) WHERE text IS NULL AND message IS NOT NULL;


-- 2) Create notification_settings table (referenced by mobile HomeScreen)
CREATE TABLE IF NOT EXISTS notification_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,        -- subscriber
  following_id TEXT NOT NULL,   -- whose posts they're subscribing to
  notify_posts BOOLEAN DEFAULT TRUE,
  notify_likes BOOLEAN DEFAULT TRUE,
  notify_comments BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, following_id)
);
CREATE INDEX IF NOT EXISTS notification_settings_user_idx ON notification_settings(user_id);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notif settings" ON notification_settings;
CREATE POLICY "Users manage own notif settings" ON notification_settings
  FOR ALL USING (auth.uid()::text = user_id);


-- 3) Create support_tickets table (used by website Help & Support form)
CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  topic TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',  -- 'open' | 'in_progress' | 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status, created_at DESC);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit tickets" ON support_tickets;
CREATE POLICY "Anyone can submit tickets" ON support_tickets
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users see own tickets" ON support_tickets;
CREATE POLICY "Users see own tickets" ON support_tickets
  FOR SELECT USING (auth.uid()::text = user_id);


-- 4) Tighten notifications INSERT policy — prevent impersonation spam
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "Users create notifications as self" ON notifications;
CREATE POLICY "Users create notifications as self" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (from_user_id IS NULL OR auth.uid()::text = from_user_id)
  );


-- 5) Add sender_avatar to messages table (referenced by website MessagesScreen)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_avatar TEXT;


-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='notifications' AND column_name='message') AS has_notif_message,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='notification_settings') AS has_notif_settings,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='support_tickets') AS has_support_tickets,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='messages' AND column_name='sender_avatar') AS has_sender_avatar;
-- All should be 1.

-- =====================================================
-- ⚠️ SECURITY: ROTATE YOUR ANON KEY
-- =====================================================
-- The current anon key has been committed to the .env files (visible in git history).
-- Anyone with access to the repo can use it.
--
-- To rotate:
-- 1. Go to Supabase Dashboard → Project Settings → API
-- 2. Click "Regenerate" on the anon key
-- 3. Copy the new key
-- 4. Update .env files in:
--    - /.env (mobile)
--    - /website/.env.local
--    - /python-service/.env
-- 5. Add to your Vercel deployment env vars
-- =====================================================
