-- ────────────────────────────────────────────────────────────────────────
-- Restrict mode — Instagram's anti-harassment three-tier pattern.
-- - BLOCK = total cutoff, two-way (handled separately in 0012_blocks.sql).
-- - MUTE  = one-way silence, no signal to the muted party (localStorage).
-- - RESTRICT = restricted user can still comment, but ONLY they see it
--   until the restrictor approves it into public view. They have no
--   notification or visible signal — eliminates the retaliation risk
--   that Block carries.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.restricted_users (
  restrictor_id  uuid not null references auth.users(id) on delete cascade,
  restricted_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (restrictor_id, restricted_id),
  check (restrictor_id <> restricted_id)
);

alter table public.restricted_users enable row level security;

drop policy if exists "restrict_read_own" on public.restricted_users;
create policy "restrict_read_own" on public.restricted_users
  for select using (auth.uid() = restrictor_id);

drop policy if exists "restrict_insert_own" on public.restricted_users;
create policy "restrict_insert_own" on public.restricted_users
  for insert with check (auth.uid() = restrictor_id);

drop policy if exists "restrict_delete_own" on public.restricted_users;
create policy "restrict_delete_own" on public.restricted_users
  for delete using (auth.uid() = restrictor_id);

create index if not exists restrict_restrictor_idx on public.restricted_users (restrictor_id);
create index if not exists restrict_restricted_idx on public.restricted_users (restricted_id);

-- Comments table needs an "awaiting approval" flag. If the column already
-- exists from a previous attempt, leave it alone.
alter table public.comments
  add column if not exists pending_approval boolean default false;

create index if not exists comments_pending_idx
  on public.comments (post_id, created_at desc)
  where pending_approval = true;

-- When a restricted user comments on a post, the row is inserted with
-- pending_approval=true. The post owner sees the comment in a "pending"
-- list; the restricted user sees it in the public list (their own view).
-- All other viewers see it only after the post owner approves.
--
-- Approval flow is handled client-side: post owner taps "Approve" in
-- the pending list → updates pending_approval=false. Or "Delete" → row
-- deleted.
--
-- The visibility filter is implemented in the React render layer rather
-- than via RLS because the rule depends on the VIEWER's identity vs the
-- post owner — RLS can't easily express "show to the comment author and
-- the post owner only." Acceptable tradeoff: a determined attacker could
-- query around the filter, but that's the same risk we accept with
-- localStorage block lists today.
