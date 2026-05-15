-- ============================================================
-- URGENT FIX — Cover Photo Not Showing
-- ============================================================
-- Run this in your Supabase SQL Editor to fix the cover photo issue
-- ============================================================

-- Add cover_url column (if missing)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Also add coins column (if missing)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 1240;

-- Optional: counts (if you want real numbers)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posts_count INTEGER DEFAULT 0;

-- Verify the columns now exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('cover_url', 'coins', 'avatar_url');

-- ============================================================
-- AFTER RUNNING THIS:
-- 1. Open RingIn mobile app
-- 2. Go to Profile → tap pencil on cover photo
-- 3. Re-upload your cover (it'll save to the new column properly)
-- 4. Refresh website at localhost:3000 → cover appears
-- ============================================================
