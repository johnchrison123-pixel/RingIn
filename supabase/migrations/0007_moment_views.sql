-- ────────────────────────────────────────────────────────────────────────
-- Moment view counts. When you post a Moment, you see who viewed it
-- (mirroring Instagram Stories' viewer list).
--
-- One row per (moment, viewer) pair. We don't dedupe across views — if
-- the same viewer reopens a moment twice, that's still one row (the
-- unique constraint enforces it). View timestamp updates to the most
-- recent open via the upsert pattern in the client.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.moment_views (
  moment_id  uuid not null references public.moments(id) on delete cascade,
  viewer_id  uuid not null references auth.users(id)    on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (moment_id, viewer_id)
);

alter table public.moment_views enable row level security;

-- Anyone signed in can record their own view.
drop policy if exists "moment_views_insert_own" on public.moment_views;
create policy "moment_views_insert_own" on public.moment_views
  for insert with check (auth.uid() = viewer_id);

-- Owner of the moment can read who viewed it.
drop policy if exists "moment_views_read_owner" on public.moment_views;
create policy "moment_views_read_owner" on public.moment_views
  for select using (
    exists (
      select 1 from public.moments m
      where m.id = moment_id and m.user_id = auth.uid()
    )
  );

-- Viewers can see + delete their own (e.g. for "I didn't mean to view that" parity with IG).
drop policy if exists "moment_views_self" on public.moment_views;
create policy "moment_views_self" on public.moment_views
  for select using (auth.uid() = viewer_id);
drop policy if exists "moment_views_delete_self" on public.moment_views;
create policy "moment_views_delete_self" on public.moment_views
  for delete using (auth.uid() = viewer_id);

create index if not exists moment_views_moment_idx on public.moment_views (moment_id);
