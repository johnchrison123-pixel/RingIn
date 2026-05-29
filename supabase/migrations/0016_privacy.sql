-- ────────────────────────────────────────────────────────────────────────
-- Privacy controls — server-side enforcement of three settings that were
-- previously localStorage-only on the client. This was a critical pre-launch
-- gap (audit R23): the Settings UI promised "private profile", "lock profile"
-- and "hide likes" but the database had zero idea about any of them, so any
-- authenticated user could SELECT a "private" profile directly via Supabase.
--
-- This migration is purely ADDITIVE (expand-contract pattern, per CLAUDE.md):
--   • Old clients that don't write these columns keep working — defaults
--     leave the user as 'public' / unlocked / likes-visible, which is the
--     pre-migration behavior.
--   • New client writes the columns; the RLS policies below then enforce
--     them server-side.
--
-- Three columns added to public.profiles:
--   profile_visibility ('public' | 'followers' | 'private')
--   is_locked          (boolean — gate follows behind approval)
--   hide_likes_in_feed (boolean — self-display preference, cross-device)
--
-- Two RESTRICTIVE RLS policies added — restrictive means they AND with
-- existing permissive policies, so the previous baseline access still
-- applies, and the new privacy rules layer on top:
--   public.profiles  → only owner sees private profiles; only followers
--                      see followers-only profiles.
--   public.posts     → posts inherit the profile-owner's visibility rule.
--
-- R23 v2: added ::text casts on all id comparisons because the legacy
-- public.follows table uses TEXT user ids (from website/SUPABASE_MIGRATIONS.sql)
-- while auth.uid() returns UUID. Casting both sides to text avoids the
-- "operator does not exist: text = uuid" error and is safe — UUIDs are
-- already unique strings.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Columns ---------------------------------------------------------------

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public';

-- Drop + add constraint (idempotent) so a re-run on a partially-applied DB
-- doesn't fail on the second pass.
alter table public.profiles
  drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles
  add constraint profiles_profile_visibility_check
  check (profile_visibility in ('public', 'followers', 'private'));

alter table public.profiles
  add column if not exists is_locked boolean not null default false;

alter table public.profiles
  add column if not exists hide_likes_in_feed boolean not null default false;

-- 2. RLS on profiles -------------------------------------------------------
-- Restrictive policy: rows you don't own are visible only if their
-- profile_visibility allows. Combined with the existing permissive
-- "profiles_hide_deleted" policy from 0011, this AND-gates correctly:
--   non-deleted AND (own OR public OR (followers AND following the viewer)).

alter table public.profiles enable row level security;

drop policy if exists "profiles_visibility_restrict" on public.profiles;
create policy "profiles_visibility_restrict" on public.profiles
  as restrictive
  for select using (
    auth.uid()::text = profiles.id::text
    or coalesce(profile_visibility, 'public') = 'public'
    or (
      coalesce(profile_visibility, 'public') = 'followers'
      and auth.uid() is not null
      and exists (
        select 1 from public.follows f
        where f.follower_id::text = auth.uid()::text
          and f.following_id::text = profiles.id::text
      )
    )
  );

-- 3. RLS on posts ----------------------------------------------------------
-- Posts inherit visibility from the author's profile. If the author set
-- their profile to 'private', their posts are invisible to everyone but
-- themselves — regardless of any per-post audience setting.

alter table public.posts enable row level security;

drop policy if exists "posts_author_visibility_restrict" on public.posts;
create policy "posts_author_visibility_restrict" on public.posts
  as restrictive
  for select using (
    auth.uid()::text = posts.user_id::text
    or exists (
      select 1 from public.profiles p
      where p.id::text = posts.user_id::text
        and (
          coalesce(p.profile_visibility, 'public') = 'public'
          or (
            coalesce(p.profile_visibility, 'public') = 'followers'
            and auth.uid() is not null
            and exists (
              select 1 from public.follows f
              where f.follower_id::text = auth.uid()::text
                and f.following_id::text = p.id::text
            )
          )
        )
    )
  );

-- 4. Index hint for the joined follows lookups (cheap; speeds the EXISTS).
create index if not exists follows_follower_following_idx
  on public.follows (follower_id, following_id);

-- 5. Index for any "browse by visibility" query the admin/analytics path
-- might run later. Cheap, just over the profiles table.
create index if not exists profiles_visibility_idx
  on public.profiles (profile_visibility)
  where profile_visibility <> 'public';
