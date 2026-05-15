-- ────────────────────────────────────────────────────────────────────────
-- Server-side block list — replaces the existing localStorage-only
-- ringin_blocked array. Fixes the bug from the bug-checker scan where
-- ProfileScreen treated blocked entries as objects but MessagesScreen
-- stored them as strings.
--
-- BLOCK is two-way and silent (the blocked party isn't notified).
-- They can no longer DM, see your posts, or appear in your search.
-- We enforce the read-side via the existing posts/profiles RLS — it
-- simply joins against this table.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.blocks (
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks_read_own" on public.blocks;
create policy "blocks_read_own" on public.blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks
  for delete using (auth.uid() = blocker_id);

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Helper RPC: did userA block userB? Used by client renderers without
-- exposing the full blocks table to the blocked party.
create or replace function public.is_blocked(blocker uuid, blocked uuid)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.blocks where blocker_id = blocker and blocked_id = blocked);
$$;
grant execute on function public.is_blocked(uuid, uuid) to authenticated, anon;

-- One-time backfill: import the localStorage block lists. The client
-- has a "Migrate blocks to server" button (in ProfileScreen privacy
-- section) that calls this RPC for each existing block.
-- (This file doesn't backfill anything itself — see the client
-- migration code in src/screens/ProfileScreen.js.)
