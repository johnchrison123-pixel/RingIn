-- ────────────────────────────────────────────────────────────────────────
-- Per-post audience selector — Public / Followers / Private.
-- Mirrors Facebook's chip in the composer (without "Custom" lists,
-- which are overkill for current scale).
--
-- 'public'    → anyone signed in can see (default — matches today's behaviour)
-- 'followers' → only users in the post author's followers can see
-- 'private'   → only the author can see (drafts / "for me" posts)
--
-- The follower check requires the existing `follows` table (from CLAUDE.md
-- — already populated). The RLS policy below assumes that table is
-- accessible to anon-keyed reads via its own RLS.
-- ────────────────────────────────────────────────────────────────────────

alter table public.posts
  add column if not exists audience text not null default 'public';

-- Constrain to the three known values.
alter table public.posts
  drop constraint if exists posts_audience_check;
alter table public.posts
  add constraint posts_audience_check
  check (audience in ('public', 'followers', 'private'));

-- Re-create the read policy to enforce audience visibility.
drop policy if exists "posts_read_audience" on public.posts;
drop policy if exists "posts_read_public"   on public.posts;
create policy "posts_read_audience" on public.posts
  for select using (
    audience = 'public'
    or user_id = auth.uid()
    or (
      audience = 'followers'
      and exists (
        select 1 from public.follows f
        where f.following_id = posts.user_id
          and f.follower_id  = auth.uid()
      )
    )
  );

create index if not exists posts_audience_idx on public.posts (audience, created_at desc);
