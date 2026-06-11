# RingIn — Comprehensive App Audit

> 🔄 **Research in progress** — multiple agents auditing the app right now. This URL will fill in over the next 30–60 minutes. Just refresh.
>
> **What's being checked (in parallel, supervised):**
> 1. **HomeScreen** — feed, post composer, comments, likes, moments strip, hashtag filter, online experts strip
> 2. **MessagesScreen** — inbox, chat, reactions, typing indicators, photo attach, the new Friends / Experts / Groups / Business tabs
> 3. **CallScreen + voice/video** — Agora integration, ringtone, accept/decline, in-call controls, missed calls, lock-screen push
> 4. **SearchScreen** — experts list, search FTS, follow/call buttons, trending hashtags, expert profile
> 5. **ProfileScreen + Settings** — all toggles (sound, haptics, privacy, notifications, blocked users, muted words, delete account, expert application, auto-update, version display)
> 6. **Security** — RLS policies on all tables, exposed secrets in repo, API endpoint auth, OTA bundle integrity
> 7. **Dummy buttons + non-saving + non-caching** — every clickable element traced to its handler; localStorage / Supabase persistence verified
> 8. **Social-media comparison** — Instagram, Facebook, LinkedIn, Twitter, WhatsApp patterns vs RingIn implementation
>
> A supervisor agent reviews every report to make sure no screen / feature is missed.

---

_Last updated: 2026-05-17 — full report posted here when agents finish._
