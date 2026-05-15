# Tier 1 + Tier 2 — Overnight Work Progress

**Started:** 2026-05-15 (your local time)
**Branch:** `claude/funny-nightingale-a8aa45` (NOT merged to main per your instruction)
**Approach:** Work serially through Tier 1 (18 items) then Tier 2 (13 items). After each item: (a) sanity-check, (b) commit + push to worktree, (c) update this report.

---

## Status legend

- ✅ **Done & verified** — code shipped to worktree, sanity-checked, no known bugs
- ⚠ **Done but needs your action** — code shipped, but needs you to do one thing (run a SQL migration, sign up for a service, etc.)
- 🟡 **In progress** — currently working on it
- ⏸ **Blocked / paused** — waiting on something
- ⬜ **Not started**

---

## Tier 1 (no migrations, can use immediately when shipped)

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Real Report flow (replaces fake alert) | ⬜ | Will use Supabase fallback if `reports` table doesn't exist yet |
| 2 | Sentry-pattern error boundaries | ⬜ | No DSN needed — just crash isolation in render tree |
| 3 | "Latest first" feed header | ⬜ | Sentiment win — chronological-as-feature |
| 4 | robots.txt | ⬜ | Static file in `public/` |
| 5 | schema.org JSON-LD | ⬜ | Person + Article + Organization markup |
| 6 | sitemap.xml | ⬜ | Edge function from Supabase data |
| 7 | OG meta + Twitter Cards (BIG) | ⬜ | Vercel edge function for crawler URLs |
| 8 | Image client-side compression | ⬜ | Canvas → WebP on upload |
| 9 | Read-receipt ticks | ⬜ | Uses existing `messages.read` |
| 10 | Typing indicators | ⬜ | Supabase Realtime presence |
| 11 | Persistent in-call banner | ⬜ | Sticky bar when CallScreen unmounted |
| 12 | Hide-likes toggle | ⬜ | localStorage setting |
| 13 | Cursor pagination | ⬜ | Replace LIMIT/OFFSET on feeds |
| 14 | Hashtag parsing + tag pages | ⬜ | Already use `tags` column |
| 15 | Diversity cap in feed | ⬜ | Max 3 consecutive from same author |
| 16 | Notification batching | ⬜ | Collapse "X liked" + "Y liked" |
| 17 | Android notification channels | ⬜ | Capacitor native config |
| 18 | Document expand-contract pattern | ⬜ | CLAUDE.md addendum |

## Tier 2 (each ships with a SQL migration you run in Supabase)

| # | Item | Status | Migration file | Your action |
|---|---|---|---|---|
| 19 | Restrict mode | ⬜ | `0002_restrict.sql` | Paste in Supabase SQL editor |
| 20 | 6-emoji reactions | ⬜ | `0003_reactions.sql` | Paste in Supabase |
| 21 | Audience selector on posts | ⬜ | `0004_audience.sql` | Paste in Supabase |
| 22 | Last seen + privacy | ⬜ | `0005_last_seen.sql` | Paste in Supabase |
| 23 | Moment view counts | ⬜ | `0006_moment_views.sql` | Paste in Supabase |
| 24 | Moment poll sticker | ⬜ | `0007_moment_polls.sql` | Paste in Supabase |
| 25 | Close Friends list | ⬜ | `0008_close_friends.sql` | Paste in Supabase |
| 26 | Postgres FTS search | ⬜ | `0009_search.sql` | Paste in Supabase |
| 27 | Delete account | ⬜ | `0010_account_deletion.sql` | Paste in Supabase |
| 28 | Age gate | ⬜ | `0011_age_gate.sql` | Paste in Supabase |
| 29 | Server-side blocks | ⬜ | `0012_blocks.sql` | Paste in Supabase |
| 30 | Trending hashtags | ⬜ | `0013_trending.sql` | Paste in Supabase |
| 31 | Notification prefs DB | ⬜ | `0014_notif_prefs.sql` | Paste in Supabase |

---

## Bug-checker findings

(No findings yet — bug-checker has not run.)

---

## Per-item commit log

(Will populate as I ship.)

---

## When you wake up — your checklist

1. Read this report from top to bottom. ✅/⚠ items ship as-is; ⏸ items need your action listed.
2. Open the **Tier 2 migrations** in `supabase/migrations/` (files `0002_*.sql` through `0014_*.sql`). Paste each into Supabase Dashboard → SQL Editor → Run, in order. ~30 sec each.
3. Review the worktree branch: `git log --oneline claude/funny-nightingale-a8aa45 ^main` shows what's new.
4. If everything looks good, say **"merge to main"** and I push it; Vercel auto-deploys to PWA.
5. APK on Desktop: `ringin-tier1-tier2.apk` — install for native testing.
