# Supabase Migrations — Apply Order

Paste each file's contents into **Supabase Dashboard → SQL Editor → Run** in numerical order. Each file is idempotent (`if not exists` / `drop policy if exists` / `or replace`) — safe to re-run if you're unsure whether a file applied.

| # | File | What it does | Tier 2 item | Time |
|---|---|---|---|---|
| 0001 | `0001_moments.sql` | Moments table (already applied if Moments work) | — | — |
| 0002 | `0002_reports.sql` | Reports table (replaces fake "Thanks for reporting" alert) | T1.1 | ~30 sec |
| 0003 | `0003_restrict.sql` | Restrict mode (Instagram-style anti-harassment) | T2.1 | ~30 sec |
| 0004 | `0004_reactions.sql` | 6-emoji reactions on chat messages | T2.2 | ~30 sec |
| 0005 | `0005_audience.sql` | Per-post audience selector (Public / Followers / Private) | T2.3 | ~30 sec |
| 0006 | `0006_last_seen.sql` | Last-seen + 4-tier privacy controls | T2.4 | ~30 sec |
| 0007 | `0007_moment_views.sql` | Moment view counts ("seen by N") | T2.5 | ~30 sec |
| 0008 | `0008_moment_polls.sql` | Moment poll sticker | T2.6 | ~30 sec |
| 0009 | `0009_close_friends.sql` | Close Friends list + green AvatarRing variant | T2.7 | ~30 sec |
| 0010 | `0010_search.sql` | Postgres full-text search on posts + profiles | T2.8 | ~45 sec |
| 0011 | `0011_account_deletion.sql` | Soft-delete account + 30-day cooling off + purge function | T2.9 | ~30 sec |
| 0012 | `0012_age_gate.sql` | Date-of-birth + is_minor flag (COPPA / GDPR-K / AU) | T2.10 | ~30 sec |
| 0013 | `0013_blocks.sql` | Server-side block list (replaces localStorage) | T2.11 | ~30 sec |
| 0014 | `0014_trending.sql` | Trending hashtags (materialized view) | T2.12 | ~30 sec |
| 0015 | `0015_notif_prefs.sql` | Per-user + per-following notification preferences | T2.13 | ~30 sec |

**Total time:** ~10 min if you paste each one in order.

---

## After 0011 — set up the purge cron

The 30-day account-deletion purge needs a daily scheduled job:

```sql
-- One-time, in the SQL Editor:
select cron.schedule('purge-deleted-accounts', '0 4 * * *',
  'select public.purge_deleted_accounts();');
```

Requires the `pg_cron` extension. Enable it once at:
**Database → Extensions → search "pg_cron" → Enable**

## After 0014 — set up the trending refresh

Same idea for trending hashtags refresh every 5 min:

```sql
select cron.schedule('refresh-trending-tags', '*/5 * * * *',
  'select public.refresh_trending_tags();');
```

## Notes

- **Graceful client fallback:** every Tier 2 feature in the React client uses try/catch around the relevant Supabase call. If a migration hasn't been applied yet, the feature shows a "we couldn't find that table" banner internally and falls back to a no-op or localStorage equivalent. **No client-side errors crash the app if a migration is missing.** This means you can apply migrations one at a time at your own pace.
- **Backfilling localStorage data:** the existing `ringin_blocked` localStorage list (per-user) is migrated to the server `blocks` table on first app open after migration 0013 applies — see `src/utils/blocksMigration.js`.
- **Service-role required:** migrations 0011 (purge) and 0014 (trending refresh) define functions that grant only to the `service_role`. Schedule them via Supabase cron OR a Vercel cron route — never call from the browser client.
