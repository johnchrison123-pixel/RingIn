-- ────────────────────────────────────────────────────────────────────────
-- R41 — Track which platform issued the FCM token (native APK vs PWA).
--
-- Before this, profiles.fcm_token was a single column shared between the
-- Chrome PWA install and the native Capacitor APK. Whichever one ran
-- requestNotificationPermission last won the column. Symptom: user
-- installs the native APK (which would handle calls properly in-app),
-- then later opens the PWA in Chrome — the web SDK overwrites the
-- native token with a web-push token. Next incoming call is delivered
-- to the browser instead of the APK → swipe-banner notification that
-- opens Chrome on tap.
--
-- New rule:
--   - Native registration: ALWAYS overwrites + sets kind='native'.
--   - Web registration: refuses to overwrite when kind='native'.
--
-- Result: once the user has the APK installed, calls always route to it.
-- ────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists fcm_token_kind text;

/* Constrain to known values. Null is allowed (legacy rows). */
alter table public.profiles
  drop constraint if exists profiles_fcm_token_kind_check;
alter table public.profiles
  add constraint profiles_fcm_token_kind_check
  check (fcm_token_kind is null or fcm_token_kind in ('native','web'));
