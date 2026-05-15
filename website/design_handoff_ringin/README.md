# Handoff: RingIn — Expert Calling Social Platform

## Overview
RingIn is a social platform where users call domain experts (doctors, lawyers, coaches, devs, etc.) paying per-minute in coins, and join live workshops. This handoff covers the full desktop web app plus a new **Anonymous Connect** feature for random anonymous voice/video calls between regular users.

## About the Design Files
The HTML/JSX files in this bundle are **design references** built as a working prototype to communicate visual style, layout, and interaction behavior. They are NOT production code to ship directly. Your task is to **recreate these designs inside your target codebase** (Next.js, Remix, Vue, native iOS/Android, etc.) using the patterns and libraries already established there. If no codebase exists, Next.js + Tailwind is a reasonable default.

## Fidelity
**High-fidelity.** Exact colors, typography, spacing, hover states, and interactions are specified. Recreate pixel-perfectly using your codebase's component primitives.

## Screens

### 1. Home Feed (`screens-feed.jsx`)
3-column grid: left sidebar (profile card + shortcuts), center feed (composer + filter chips + posts), right rail (online experts, live workshops, who to follow).
- Composer: avatar + ghost input "What's on your mind, {firstName}?" + photo/feeling/go-live action row
- Filter chips: All, Following, Trending, Health, Tech, Career, Finance (16px bottom margin to first post)
- Post cards: avatar, name + verified tick, role, time, text, optional image, tag chips, like/comment/share/call row, expandable comments

### 2. Experts (`screens-rest.jsx` ExpertsScreen)
Grid of expert cards. Category sidebar (200px, 13px text). Card has gradient cover (80px), avatar overlapping (-32px), name, rating ★, calls count, bio (2 lines), rate badge, Call button.

### 3. Anonymous Connect (`screens-connect.jsx`) — NEW FEATURE
Page accessed via gradient pink/purple orb button between Experts and Workshops in nav.
- Left card (320px): compact anonymous profile (emoji avatar, nickname, mood, fans/calls), View profile + Edit buttons, karma + streak
- Right card: two **tag inputs** — "Your interests" and "What kind of chat?" — type then Enter to add chip, × to remove. Match preferences (voice / video / share interest). Big "Connect anonymously" CTA.
- Below: Recently called (3-col grid) + Added friends (3-col grid)
- Click any avatar → ProfileSheet modal (cover gradient + emoji avatar + full bio, gender/age/mood, interests as #tags, followers/calls/topic stats, Call CTA)
- Edit modal: 20 emoji avatars, nickname (with suggestions), 120-char bio, gender select, age, mood
- Match flow: pulsing orb "Finding someone…" → Match screen with both avatars side-by-side, shared interests highlighted, Skip / Connect Voice buttons

### 4. Workshops, Messages, Wallet, Profile (Mine + Expert), Settings, Notifications
See individual files. Standard patterns — list/detail, gradient cover photos, action rails.

## Top Navigation (`components.jsx` TopNav)
- Left: RingIn wordmark + search pill
- Center: tab buttons (Home, Experts, **[gradient orb anon-connect button]**, Workshops, Messages)
  - The orb is 38px circle, gradient `linear-gradient(135deg,#7B6EFF,#E84D9A)`, phone icon, 9px green online dot top-right, 3px margin
- Right: wallet chip (coin badge + balance), bell with notif count, avatar

## Design Tokens (`styles.css` :root)
- **Colors**: bg #0a0a0e, bg2 #131318, bg3 #1a1a22, text #e8e8ec, t2 #9c9caa, t3 #6b6b78, border #26262e
- **Brand**: ac #7B6EFF (primary purple), ac2 #5B4FE0, pink #E84D9A, green #21D07A, red #E84B3A, gold #F5A623, coin #F5A623
- **Accent gradient (--grad)**: linear-gradient(135deg,#7B6EFF,#E84D9A) — used for cover photos, anon-connect button, CTAs
- **Acg (translucent accent)**: rgba(123,110,255,0.16) — chip backgrounds, glows

## Typography
- **Display / brand**: Syne 700 (RingIn wordmark, hero titles)
- **UI**: Inter 400/600/700 (everything else)
- Body 14px, secondary 12-13px, small 11px, hero 22-26px

## Spacing & Radius
- Card padding 16-22px, gap 14-16px between cards
- Border-radius: cards 14px, buttons 10px, chips 16-20px, avatars 50%
- Buttons: btn-pri (purple), btn-sec (filled neutral), btn-out (border only); btn-lg = larger padding

## Interactions
- Hover: cards lift translateY(-2px) + border accent, buttons lighten
- Online dot pulse: `@keyframes blink` 1s infinite opacity 1→0.3
- Match orb pulse during search
- Tag chips: click × to remove, Enter to add (TagInput component)

## State Management
- Single top-level `tab` string in `app.jsx` switches screens
- Local component state for: composer open, post likes, filter chip selection, anon profile draft, interests/topics arrays, match state, modal open/close
- Recommend Zustand or Context for: current user, coin balance, unread counts in real codebase

## Files in this handoff
- `desktop/index.html` — entry, loads scripts
- `desktop/styles.css` — all design tokens + component styles
- `desktop/data.js` — mock data (users, experts, posts, workshops, transactions)
- `desktop/components.jsx` — Icon, Avatar, TopNav, VerifiedBadge
- `desktop/screens-feed.jsx` — HomeScreen with feed, composer, sidebars
- `desktop/screens-1.jsx` — Experts list + Expert profile
- `desktop/screens-rest.jsx` — Messages, Workshops, Wallet, Profile, Settings, Notifications
- `desktop/screens-connect.jsx` — Anonymous Connect (NEW feature)
- `desktop/app.jsx` — root with tab routing

## Assets
- Avatars use `https://i.pravatar.cc/150?img=N` placeholder service — replace with real CDN
- All other graphics are CSS gradients + SVG icons (no raster assets)
- Emoji are used directly for anonymous avatars

## Implementation Notes
1. Replace inline-styled JSX with your component library (e.g., Radix + Tailwind, Mantine, Chakra). Tokens above map cleanly to Tailwind theme.
2. Move mock data behind real API calls — see shape in `data.js`.
3. Anonymous Connect needs real-time matching: WebRTC + a signaling server (Socket.io, LiveKit, Daily.co).
4. Wallet/coin system needs payment integration (Stripe) and a backend ledger.
5. Workshops need video streaming (Mux, Daily.co, or 100ms).
6. The "verified expert" tick implies a vetting/onboarding flow not shown in this design.
