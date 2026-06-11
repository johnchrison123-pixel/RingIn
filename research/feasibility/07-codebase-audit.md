# RingIn Codebase Audit — Ground Truth Inventory

## 1. Feature Inventory

### App.js — Root / Shell
- Email+password auth, sign-up, sign-in, forgot-password (working)
- Bottom nav: Home / Friends / [Connect Orb] / Experts / Messages (working; Workshops removed from nav but route exists)
- Global realtime: unread message badge + notification badge (working)
- Incoming call detection: realtime + 4s polling + visibility-change polling (working)
- Android back + left-edge swipe-back (working)
- PWA install prompt + OTA update prompt (Capgo) (working)
- Push notification deep-link handler partial: `actionParam === 'accept'` broken (App.js:307-316), always opens ring modal (one extra tap)

### HomeScreen.js — Feed
- Realtime post feed with shimmer skeleton (working)
- Like/unlike with sound + haptics + optimistic UI + snapshot rollback (working)
- Threaded comments (2 levels), localStorage comment likes (working)
- Create/edit/delete post (working; delete uses window.confirm — polish bug)
- Content moderation gate uses window.confirm (HomeScreen.js:2110) — polish bug
- Post mute (working)
- Notification bell + realtime sound (working)
- Hashtag filtering (working)
- SavedPosts cross-tab navigation (working)
- Moments strip (24h TTL, cube-swipe nav) (working)
- UserProfileView (working)
- Creator coin subscriptions UI built; real money is `'pending'` placeholder (SearchScreen.js:168-171)
- Hide likes preference (working)

**Half-built:** Hardcoded EXPERTS/WORKSHOPS arrays (HomeScreen.js:80-81) — not from Supabase.

### FriendsScreen.js — Real Friends (R64)
- Horizontal filter pills (lang, city, hometown, job, gender, interests, online) (working)
- `suggest_friends` RPC → horizontal card strip with "See All" (working)
- `list_community_friends` RPC with debounced search (250ms) (working)
- Incomplete profiles filtered out (working)
- Setup modal auto-opens on first visit (working)
- `request_anon_connection` RPC (working)
- Follow from Friends tab (working)
- Profile summary modal → avatar → UserProfileView (working)
- **Polish gap:** loading state renders blank (no shimmer) while `loading && results.length === 0`

### SearchScreen.js — Experts
- Real experts from Supabase via `profileToExpert()` (working)
- Expert profile: stats, tags, bio, follow, subscribe, message (working)
- Call button → Agora (working)
- Ratings: `rating: null` (SearchScreen.js:63) — all experts show no rating
- Calls: always 0 (line 65) — placeholder
- Follower count: always empty (line 66) — placeholder
- Subscriptions: trial works; real-money creates `status:'pending'` (line 168)

### MessagesScreen.js — Inbox + Chat
- Conversation list with realtime + shimmer (working)
- ChatBox: realtime, emoji reactions, typing sound, read receipts (working)
- Photo attachment (Supabase storage) (working)
- Lever send (heart/thumbs, 5 haptic tiers) (working)
- Unsend (long-press 500ms) (working)
- Chat header ⋮ menu: Mute, Clear, Block (working)
- Block uses window.confirm (MessagesScreen.js:732) — polish bug
- Restrict mode (working)
- Call from chat (working)
- Expert demo conversation rows (MessagesScreen.js:19) hardcoded — minor polish

### AnonymousConnect.js — Anonymous Voice
- 4-tab structure: Connections / Messages / Call Logs / Profile (working)
- Anonymous matchmaking (30-sec countdown, `anon_match_queue`) (working)
- Onboarding wizard (gender, nickname, avatar) (working)
- Anonymous profile with Edit Profile modal (working)
- Virtual gifts: 3-tier (sticker/premium/mega), coins debit/credit (working)
- Gift reactions on chat messages (working)
- Call logs tab (working)
- Post-call sheet (Add / Find Next / Block+Report) (working)
- Host mode (FRND-style, female-gated) with rate setting (working)
- Anonymous messaging (working)
- Paid host calls (random + browse) (working)
- Star rating for hosts post-call (R59) (working)
- Safety sheet (working)

### CallScreen.js — Voice Call UI
- Agora RTC with lazy-loaded SDK (~250KB) (working)
- Phases: ringing → connecting → connected → ended (working)
- Per-minute coin deduction (working)
- **Mute/Speaker:** Speaker toggle in PWA is volume-based ONLY (CallScreen.js:130-131). Capacitor native plugin scaffolded but iOS/Android platforms NOT built.
- In-call virtual gifts (working)
- Add as Connection during anon call (working)
- Hangup from Android back button (working)
- Build version stamp displayed (`v2.0-native-debug`) — polish issue, debug label in production

### WalletScreen.js — Coins
- Coin balance via `useCoinBalance` realtime hook (working)
- 6 purchase packages (₹100-₹4000) (working)
- Payment form: card (Luhn) + UPI (working)
- **CRITICAL:** Payment processing simulated (`// Simulate payment processing`, WalletScreen.js:110). No real Razorpay/gateway. `topup_coins` RPC triggered after fake `setTimeout(1200ms)`.
- Transaction history (last 20) (working)
- Avg coin rate calculation (working)

### ProfileScreen.js
- Edit profile (name, bio, avatar, cover, website, timezone, location) (working)
- Sound & Haptics settings (working)
- Privacy settings (working)
- Download My Data (working)
- Expert Application form (working)
- Blocked users (working)
- Muted words (working)
- Creator subscription setup (working)
- Sign out + delete account (working)
- Posts grid + likes + comments (working)

## 2. Tech Stack

- React 19.2.5, CRA, no JSX (React.createElement)
- Supabase-js ^2.105.1 — auth, realtime, RPCs, storage
- Agora RTC SDK ^4.21.0 — voice, lazy-loaded
- Capacitor 6.2.0 + @capgo/capacitor-updater 6.0.20 (Android only; iOS not built)
- Firebase 12.13.0 + firebase-admin 13.0.0 — FCM push
- Vercel auto-deploy from main, ~60s; custom OTA manifest at raw.githubusercontent.com
- OTA: Capgo `CapacitorUpdater` with `autoUpdate: false`; neon-green prompt; PWA uses SW cache
- Migrations: 15 SQL files; migrations 0016+ applied directly to cloud DB

## 3. UI/UX Smoothness Scores (1-10)

| Screen | Visual | Animation | Loading | Error | Gestures | Score |
|---|---|---|---|---|---|---|
| Auth | 8 | 4 | N/A | 7 | N/A | **6** |
| HomeScreen | 7 | 5 | 8 | 6 | 6 | **6** |
| FriendsScreen | 7 | 5 | 3 | 6 | 5 | **5** |
| SearchScreen | 6 | 5 | 4 | 5 | 4 | **5** |
| MessagesScreen | 7 | 7 | 7 | 6 | 6 | **7** |
| AnonymousConnect | 8 | 7 | 6 | 7 | 6 | **7** |
| CallScreen | 8 | 7 | 7 | 6 | 5 | **7** |
| WalletScreen | 7 | 4 | 5 | 6 | 3 | **5** |
| ProfileScreen | 7 | 4 | 5 | 6 | 5 | **5** |

## 4. What RingIn HAS That Competitors Don't

1. Expert marketplace + coin-based per-minute billing in a social feed
2. Anonymous matchmaking orb in center nav
3. Sound engine with per-sound volume + variant picker
4. Lever send button with progressive haptics (5 tiers)
5. Moments with cube-swipe 3D nav + in-story reactions
6. OTA native APK updates via Capgo

## 5. What RingIn LACKS vs Instagram / WhatsApp / FRND / Yalla

1. **No video calls** — only voice. Non-starter for India where video chat is norm.
2. **No real payment gateway** — WalletScreen.js:110 simulated. Coins cannot be purchased for real money.
3. **No expert ratings/reviews** — SearchScreen.js:63 `rating: null`. Users can't evaluate experts.
4. **No group voice/video rooms** — 1:1 only.
5. **No video Moments** — Photo only; video shows `alert('Moments coming soon')`.
6. **No real-money subscription billing** — creates `status: 'pending'` rows.
7. **No earpiece/loudspeaker routing in PWA** — volume-only.
8. **No Stories/Reels video feed** — text+photo only.
9. **No interest-based feed discovery** — HomeScreen experts/workshops hardcoded.
10. **No iOS push notifications** — APNs not configured.

## 6. Top 10 TIER 1 Polish Bugs (file:line verified)

1. `window.confirm()` for "Delete post" — HomeScreen.js:638, 2570
2. `window.confirm()` for "Block user" — MessagesScreen.js:732
3. `window.confirm()` for content moderation gate — HomeScreen.js:2110
4. `window.alert()` for "Moments coming soon" — Moments.js:2198
5. `window.alert()` in ExpertProfile subscription fallback — SearchScreen.js:148
6. No skeleton on FriendsScreen initial load — FriendsScreen.js:263-358
7. Build-version debug label in production — CallScreen.js:35 `v2.0-native-debug`
8. Push-notification Accept action silently does nothing — App.js:307-316
9. Expert metrics all zero/null — SearchScreen.js:63-66
10. Hardcoded fake expert/workshop data on HomeScreen — HomeScreen.js:80-81

## 7. Architectural Strengths

1. Single Supabase client (singleton) — no per-screen creation
2. Optimistic UI + snapshot rollback everywhere
3. Strict realtime filter on call invites + 4s polling fallback + visibility-change polling
4. Coin balance as shared broadcast hook
5. Lazy-loaded Agora SDK with requestIdleCallback prefetch

## 8. Architectural Weaknesses

1. **Payment processing entirely simulated** — entire coin economy has no real money entry
2. **Expert/Workshop data partially hardcoded** — HomeScreen.js:80-81 vs SearchScreen Supabase
3. **Native platform layer scaffolded but not built** — earpiece routing, iOS push, background call wake all non-functional
4. **No schema for expert ratings, calls count, followers** — trust signals are placeholder
5. **window.confirm/alert in 5+ locations** — violates CLAUDE.md, blocks JS thread, breaks back-navigation chain
