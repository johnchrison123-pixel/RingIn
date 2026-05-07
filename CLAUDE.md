# RingIn — Claude Project Context

## Project Info
- **App Name:** RingIn
- **Live URL:** https://ring-in.vercel.app
- **GitHub:** https://github.com/johnchrison123-pixel/RingIn
- **Local Path:** ~/Desktop/The project/RingIn/ringin2
- **Stack:** React CRA (Create React App) + Supabase + Vercel

## Deployment
- Vercel **auto-deploys** from GitHub `main` branch
- To deploy: merge changes → push to `main` → Vercel picks it up automatically
- No manual vercel CLI needed — just `git push origin main`

## Supabase
- **URL:** https://fnthuegoevgicqmzhwcw.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudGh1ZWdvZXZnaWNxbXpod2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjkxNzcsImV4cCI6MjA5Mjk0NTE3N30.RyUVn23aZOt8in-BiMhK0c2EfR9GN8wQ2HRA5cMJm7s
- **Shared client:** `src/utils/supabase.js` exports `sb` — import from here, never call createClient directly

## Coding Rules (CRITICAL)
- **NO JSX** — use `React.createElement()` exclusively everywhere
- **State pattern:** `var xS=useState(init); var x=xS[0]; var setX=xS[1];`
- All hooks (useState, useEffect, useRef, custom hooks) must be called BEFORE any conditional returns
- useEffect cleanups are required for all Supabase realtime channel subscriptions

## Project Structure
```
src/
  App.js                        — root, tab routing, session management
  screens/
    HomeScreen.js               — feed, posts, likes, comments, notifications
    MessagesScreen.js           — conversations list, ChatBox, realtime messaging
    SearchScreen.js             — experts list, expert profile, call screen
    ProfileScreen.js            — user profile, settings, sound/haptics, privacy
    CallScreen.js               — live call UI
    useFollow.js                — follow/unfollow hook (Supabase + localStorage)
  utils/
    supabase.js                 — single shared Supabase client
    soundEngine.js              — Web Audio API, playSound(), hapticPulse(), prefs
```

## Sound Engine (src/utils/soundEngine.js)
- `playSound(type)` — plays a sound by type, reads localStorage prefs
- `playUnlikeSound()` — soft descending tone for unlike action
- `hapticPulse(pattern)` — vibration, gates on `getHapticsEnabled()`
- `getSCtx()` — returns the singleton AudioContext
- `getSoundPrefs()` / `saveSoundPrefs()` — localStorage `ringin_sound_prefs`
- `getHapticsEnabled()` / `setHapticsEnabled(val)` — localStorage `ringin_haptics`
- Sound types: `'like'`, `'notification'`, `'typing'`, `'message'`

## localStorage Keys
| Key | What it stores |
|-----|----------------|
| `ringin_sound_prefs` | Sound settings per type (volume, variant, enabled) |
| `ringin_haptics` | Haptics on/off boolean |
| `ringin_clikes` | Comment likes (shared across HomeScreen + ProfileScreen) |
| `ringin_muted_posts` | Post IDs with notifications muted |
| `ringin_muted_convos` | Conversation IDs with notifications muted |
| `ringin_blocked` | Blocked user IDs |
| `ringin_muted_words` | Muted words list |
| `convos_<userId>` | Cached conversation list per user |

## Supabase Tables (known)
- `posts` — id, user_id, content/text, likes, created_at
- `comments` — id, post_id, user_id, content, created_at
- `messages` — id, conversation_id, sender_id, content, created_at
- `notifications` — id, user_id, type, post_id, sender_id, created_at
- `profiles` — id, name, bio, avatar_url, role, etc.
- `follows` — follower_id, following_id
- `blocked_users` — blocker_id, blocked_id

## Supabase Storage Buckets
- `chat-images` — uploaded images from chat photo attachment feature

## Features Built (all working)
### HomeScreen
- Live post feed with realtime updates
- Like/unlike posts with sound + haptics + optimistic UI + rollback
- Comments with likes (localStorage persisted)
- Post detail view (live-derived from posts array)
- Create post, delete post, **edit post** (modal)
- Mute notifications per post (localStorage)
- Notification badge + realtime notification sound
- UserProfile view with their posts

### MessagesScreen
- Conversations list with realtime inbox updates
- ChatBox with realtime messages
- Send text messages + emoji reactions
- **Photo/image attachment** (uploads to Supabase storage, renders inline)
- **Unsend message** (long-press 500ms → 🗑 Unsend menu)
- **Chat header ⋮ menu** — Mute conversation, Clear all chat, Block user
- Lever send button with progressive haptics (5 tiers) + sound
- Typing sound debounced 80ms

### SearchScreen
- Experts list with Follow/Call buttons
- Expert profile view with stats, tags, bio
- Follow/unfollow (Supabase + localStorage)
- **Message expert** → navigates to Messages tab and opens their convo
- Typing sound debounced

### ProfileScreen
- Edit profile (name, bio, avatar) → saves to Supabase
- Sound & Haptics settings page (per-sound volume, variants, preview, haptics toggle)
- Privacy settings (localStorage)
- Notification preferences (localStorage)
- **Blocked Users** — view and unblock (localStorage)
- **Muted Words** — add/remove chips (localStorage)
- **Download My Data** — queries Supabase, triggers JSON download
- **Expert Application** — full form, saves to Supabase profiles table
- Post likes with sound (like/unlike)
- Comments with likes (localStorage persisted)

### CallScreen
- Live call UI with coin counter
- Call timer

## Architecture Decisions
- Single Supabase client in `src/utils/supabase.js` (not per-screen)
- All realtime subscriptions cleaned up in useEffect return
- Optimistic UI updates with snapshot-based rollback on every write
- Haptics use separate 100ms ticker from 16ms animation loop (prevents motor cancellation)
- Comment likes use localStorage (`ringin_clikes`) for instant cross-screen sync
- `levHoldPctRef` (useRef) used in lever release to avoid stale state closure

## Git / Deploy Workflow
```bash
# All work is done in the worktree:
# C:\Users\johnc\Desktop\The project\RingIn\ringin2\.claude\worktrees\funny-nightingale-a8aa45

# To deploy changes:
cd "C:\Users\johnc\Desktop\The project\RingIn\ringin2"
git merge claude/funny-nightingale-a8aa45
git push origin main
# Vercel auto-deploys from main — live in ~60 seconds at https://ring-in.vercel.app
```

## Known Bugs Fixed
- toggleLike revert used re-toggle instead of snapshot restore
- postDetail out of sync with live posts array (now live-derived)
- Comment likes not persisting across screens (now localStorage-backed)
- toggleLikeU (userPosts) same revert bug fixed
- Notification sound missing on realtime INSERT
- Supabase removeAllChannels() called on tab switch (killed chat subscription)
- Messages only appeared after realtime ping (now optimistic)
- saveEditPost wrong field name (text not content)
- submitPost ran notification code even on Supabase error
- deletePost had no rollback
- submitComment had no rollback
- saveEditProfile closed modal even on error
- toggleFollow had no rollback
- All localStorage writes now wrapped in try/catch
