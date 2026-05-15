-- =====================================================
-- RingIn Website - Supabase Migration (FIXED for TEXT IDs)
-- Safe to run multiple times. Run in Supabase SQL Editor.
-- =====================================================

-- ============== STEP 1: ADD COLUMNS TO profiles ==============

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 1240;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posts_count INTEGER DEFAULT 0;


-- ============== STEP 2: NEW TABLES (using TEXT for IDs to match existing schema) ==============

CREATE TABLE IF NOT EXISTS saved_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);
CREATE INDEX IF NOT EXISTS saved_posts_user_idx ON saved_posts(user_id);
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_posts_all" ON saved_posts;
CREATE POLICY "saved_posts_all" ON saved_posts
  FOR ALL USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS muted_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);
CREATE INDEX IF NOT EXISTS muted_posts_user_idx ON muted_posts(user_id);
ALTER TABLE muted_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muted_posts_all" ON muted_posts;
CREATE POLICY "muted_posts_all" ON muted_posts
  FOR ALL USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  coins INTEGER NOT NULL,
  amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(user_id, created_at DESC);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (auth.uid()::text = user_id);
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS blocked_users (
  id BIGSERIAL PRIMARY KEY,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_users_all" ON blocked_users;
CREATE POLICY "blocked_users_all" ON blocked_users
  FOR ALL USING (auth.uid()::text = blocker_id);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_user_id TEXT,
  from_user_name TEXT,
  from_user_avatar TEXT,
  type TEXT NOT NULL,
  text TEXT,
  post_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id);
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id);
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (auth.uid()::text = user_id);


-- ============== STEP 3: toggle_like RPC FUNCTION (TEXT-safe) ==============

DROP FUNCTION IF EXISTS toggle_like(text, text);
DROP FUNCTION IF EXISTS toggle_like(uuid, uuid);

CREATE OR REPLACE FUNCTION toggle_like(post_id TEXT, user_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_likes TEXT[];
BEGIN
  SELECT COALESCE(likes::text[], ARRAY[]::TEXT[]) INTO current_likes FROM posts WHERE id::text = post_id;

  IF user_id = ANY(current_likes) THEN
    UPDATE posts SET likes = array_remove(current_likes, user_id) WHERE id::text = post_id;
  ELSE
    UPDATE posts SET likes = array_append(current_likes, user_id) WHERE id::text = post_id;
  END IF;
END;
$$;


-- ============== STEP 4: STORAGE BUCKETS ==============

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('posts-media', 'posts-media', true),
  ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ============== STEP 5: STORAGE POLICIES ==============

DROP POLICY IF EXISTS "pub_read_avatars" ON storage.objects;
CREATE POLICY "pub_read_avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "auth_upload_avatars" ON storage.objects;
CREATE POLICY "auth_upload_avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_update_avatars" ON storage.objects;
CREATE POLICY "auth_update_avatars" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pub_read_covers" ON storage.objects;
CREATE POLICY "pub_read_covers" ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "auth_upload_covers" ON storage.objects;
CREATE POLICY "auth_upload_covers" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_update_covers" ON storage.objects;
CREATE POLICY "auth_update_covers" ON storage.objects FOR UPDATE
  USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pub_read_posts_media" ON storage.objects;
CREATE POLICY "pub_read_posts_media" ON storage.objects FOR SELECT
  USING (bucket_id = 'posts-media');

DROP POLICY IF EXISTS "auth_upload_posts_media" ON storage.objects;
CREATE POLICY "auth_upload_posts_media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pub_read_chat_images" ON storage.objects;
CREATE POLICY "pub_read_chat_images" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "auth_upload_chat_images" ON storage.objects;
CREATE POLICY "auth_upload_chat_images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

-- =====================================================
-- DONE — Re-upload cover photo after this runs successfully
-- =====================================================
