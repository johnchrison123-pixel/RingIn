-- ────────────────────────────────────────────────────────────────────────
-- User reports — replaces the previously fake "Thanks for reporting!"
-- alert with a real submit-to-Supabase flow. Backed by the ReportModal
-- component in src/components/ReportModal.js.
--
-- Run once in the Supabase SQL editor (https://supabase.com/dashboard
-- → SQL Editor). Until this migration is applied, the client falls back
-- to a localStorage queue so reports still get captured locally for
-- you to inspect manually.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  -- target_type is one of: 'post', 'comment', 'user', 'message', 'moment', 'photo'
  target_type  text not null,
  -- target_id is a free-form string so it can hold uuid, comment-id, etc.
  target_id    text not null,
  -- category: 'spam', 'harassment', 'hate', 'sexual', 'violence', 'misinfo', 'other'
  category     text not null,
  details      text,
  status       text not null default 'pending',  -- 'pending' / 'reviewed' / 'actioned' / 'dismissed'
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id)
);

alter table public.reports enable row level security;

-- Anyone signed in can submit a report. They can only submit AS themselves.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- Reporters can read their own reports (so the UI can show "you reported this").
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports
  for select using (auth.uid() = reporter_id);

-- Admins can read everything. Define an `is_admin` column on `profiles`
-- (add it manually if not present: alter table profiles add column is_admin boolean default false;).
drop policy if exists "reports_read_admin" on public.reports;
create policy "reports_read_admin" on public.reports
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin" on public.reports
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

create index if not exists reports_pending_idx on public.reports (created_at desc) where status = 'pending';
create index if not exists reports_target_idx  on public.reports (target_type, target_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);
