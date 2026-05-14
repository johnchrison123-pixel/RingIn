-- ────────────────────────────────────────────────────────────────────────
-- Real Moments — 24h disappearing stories backed by Supabase.
-- Mirrors the schema referenced by src/components/Moments.js and the
-- upload pipeline in src/screens/HomeScreen.js. Run once in the
-- Supabase SQL editor (https://supabase.com/dashboard → SQL editor).
--
-- Images are uploaded to the existing public `chat-images` storage
-- bucket (re-used for simplicity; nothing in this migration touches
-- storage). Until this migration is applied, the client falls back to
-- localStorage so the poster still sees their own moments.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.moments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  image_url   text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

alter table public.moments enable row level security;

-- Anyone signed in can read recent (< 24h) moments.
drop policy if exists "moments_read_recent" on public.moments;
create policy "moments_read_recent" on public.moments
  for select using (created_at > now() - interval '24 hours');

-- Users can post their own moments.
drop policy if exists "moments_insert_own" on public.moments;
create policy "moments_insert_own" on public.moments
  for insert with check (auth.uid() = user_id);

-- Users can delete (unpost) their own moments.
drop policy if exists "moments_delete_own" on public.moments;
create policy "moments_delete_own" on public.moments
  for delete using (auth.uid() = user_id);

create index if not exists moments_recent_idx on public.moments (created_at desc);
create index if not exists moments_user_idx   on public.moments (user_id, created_at desc);
