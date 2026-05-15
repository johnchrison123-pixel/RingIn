-- ────────────────────────────────────────────────────────────────────────
-- Per-user notification preferences. Today these are localStorage-only
-- (per CLAUDE.md). Moving to Supabase so they sync across devices.
--
-- The existing `notification_settings` table is referenced in
-- HomeScreen.js:1426 but isn't actually defined in any prior migration —
-- this migration creates it. Schema matches what the existing query
-- expects: notify_posts boolean keyed on (user_id, following_id).
--
-- We ALSO add a global per-channel prefs table so users can mute
-- categories app-wide:
--   notify_likes, notify_comments, notify_follows, notify_calls,
--   notify_messages, notify_mentions, notify_workshops, notify_promo,
--   notify_email, quiet_hours_start, quiet_hours_end.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Per-following toggle (existing query expects this).
create table if not exists public.notification_settings (
  user_id        uuid not null references auth.users(id) on delete cascade,
  following_id   uuid not null references auth.users(id) on delete cascade,
  notify_posts   boolean not null default true,
  notify_moments boolean not null default true,
  notify_calls   boolean not null default true,
  primary key (user_id, following_id)
);

alter table public.notification_settings enable row level security;

drop policy if exists "notif_settings_read_own" on public.notification_settings;
create policy "notif_settings_read_own" on public.notification_settings
  for select using (auth.uid() = user_id);

drop policy if exists "notif_settings_upsert_own" on public.notification_settings;
create policy "notif_settings_upsert_own" on public.notification_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "notif_settings_update_own" on public.notification_settings;
create policy "notif_settings_update_own" on public.notification_settings
  for update using (auth.uid() = user_id);

drop policy if exists "notif_settings_delete_own" on public.notification_settings;
create policy "notif_settings_delete_own" on public.notification_settings
  for delete using (auth.uid() = user_id);

-- 2. Global per-channel prefs.
create table if not exists public.notification_prefs (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  notify_likes     boolean not null default true,
  notify_comments  boolean not null default true,
  notify_follows   boolean not null default true,
  notify_calls     boolean not null default true,
  notify_messages  boolean not null default true,
  notify_mentions  boolean not null default true,
  notify_workshops boolean not null default true,
  notify_promo     boolean not null default false,  -- default OFF — user explicitly opts in
  notify_email     boolean not null default false,
  -- Quiet hours: 0–23, in user's local hour. NULL = no quiet hours.
  quiet_hours_start int check (quiet_hours_start is null or (quiet_hours_start >= 0 and quiet_hours_start < 24)),
  quiet_hours_end   int check (quiet_hours_end   is null or (quiet_hours_end   >= 0 and quiet_hours_end   < 24)),
  updated_at       timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notif_prefs_read_own" on public.notification_prefs;
create policy "notif_prefs_read_own" on public.notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "notif_prefs_upsert_own" on public.notification_prefs;
create policy "notif_prefs_upsert_own" on public.notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "notif_prefs_update_own" on public.notification_prefs;
create policy "notif_prefs_update_own" on public.notification_prefs
  for update using (auth.uid() = user_id);
