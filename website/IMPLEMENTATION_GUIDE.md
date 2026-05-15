# RingIn Website - Implementation Guide

This guide walks through building out the website from the design handoff files and connecting it to the mobile app backend.

## Phase 1: Foundation ✅ (COMPLETE)

### Done
- [x] Next.js project setup
- [x] Tailwind CSS design system (colors, typography, spacing)
- [x] TopNav component with 5 main tabs
- [x] Home, Experts, Anonymous Connect, Workshops, Messages, Profile, Wallet screens (basic)
- [x] Global styling & design tokens
- [x] Responsive layout structure

### What to do next
Move to Phase 2 below.

---

## Phase 2: Core Features (IN PROGRESS)

### 2.1 Home Feed (Priority: HIGH)
**Current State**: Basic layout, mock posts
**Todo**:
- [ ] Real post fetching from API (`/api/posts`)
- [ ] Implement composer form (text + image upload)
- [ ] Comment system with optimistic updates
- [ ] Like/unlike with animations
- [ ] Hashtag and @mention support
- [ ] Share button implementation
- [ ] Post creation modal/form

**File to expand**: `app/screens/HomeScreen.js`

**Design reference**: `design_handoff_ringin/desktop/screens-feed.jsx`

### 2.2 Experts Directory (Priority: HIGH)
**Current State**: Grid layout, mock expert data
**Todo**:
- [ ] Category filtering (left sidebar)
- [ ] Search/filter by name, skill, rating
- [ ] Expert card interactions (hover effects)
- [ ] Expert profile modal on card click
- [ ] Rate sorting (lowest/highest $/min)
- [ ] Rating breakdown view
- [ ] "Call Expert" CTA integration

**File to expand**: `app/screens/ExpertsScreen.js`

**Design reference**: `design_handoff_ringin/desktop/screens-1.jsx`

### 2.3 Anonymous Connect (Priority: MEDIUM)
**Current State**: Placeholder
**Todo**:
- [ ] Profile editor modal (emoji avatars, nickname, bio)
- [ ] Interest & chat type tag inputs
- [ ] Matching algorithm (WebRTC signaling server)
- [ ] Match UI with side-by-side avatars
- [ ] Start call button (WebRTC)
- [ ] Recently called list
- [ ] Profile view modal from match screen

**File to expand**: `app/screens/AnonymousConnect.js`

**Design reference**: `design_handoff_ringin/desktop/screens-connect.jsx`

**Dependencies**: 
```bash
npm install webrtc-adapter socket.io-client
```

### 2.4 Messages (Priority: HIGH)
**Current State**: Placeholder
**Todo**:
- [ ] Conversation list with avatars, names, last message
- [ ] Real-time message sync (Socket.io or Supabase)
- [ ] Message detail view
- [ ] Typing indicators
- [ ] Message read receipts
- [ ] Search conversations
- [ ] Unread badge counter (already in TopNav)
- [ ] Message grouping by date

**File to expand**: `app/screens/MessagesScreen.js`

**Design reference**: `design_handoff_ringin/desktop/screens-rest.jsx`

### 2.5 Workshops (Priority: MEDIUM)
**Current State**: Placeholder
**Todo**:
- [ ] Fetch live/upcoming workshops
- [ ] Workshop card with thumbnail, speaker, time
- [ ] "LIVE" badge with pulsing animation (already in CSS)
- [ ] Join workshop button (video stream integration)
- [ ] Workshop details modal
- [ ] Past recordings list

**File to expand**: `app/screens/WorkshopsScreen.js`

**Design reference**: `design_handoff_ringin/desktop/screens-rest.jsx`

**Dependencies** (later):
```bash
npm install daily-js  # or mux-embed, 100ms
```

### 2.6 Profile & Wallet (Priority: MEDIUM)
**Current State**: Basic layout
**Todo**:
- [ ] Edit profile form
- [ ] Verification badge claim flow
- [ ] Portfolio/experience sections
- [ ] Call history
- [ ] Earnings breakdown (coins earned/spent)
- [ ] Transaction history
- [ ] Withdrawal flow
- [ ] Add funds/purchase coins

**Files to expand**: `app/screens/ProfileScreen.js`, `app/screens/WalletScreen.js`

**Design reference**: `design_handoff_ringin/desktop/screens-rest.jsx`

---

## Phase 3: Advanced Features (LATER)

### 3.1 Real-time Features
- [ ] Real-time post notifications
- [ ] Online status indicators
- [ ] Typing indicators in messages
- [ ] Live workshop notifications

**Setup**:
```bash
npm install socket.io-client
# or use Supabase realtime
```

### 3.2 Voice/Video Calling
- [ ] WebRTC setup (Daily.co, LiveKit, or custom)
- [ ] Peer connection management
- [ ] Audio/video codec selection
- [ ] Call recording (optional)

### 3.3 Payment Integration
- [ ] Stripe payment form
- [ ] Coin purchase flow
- [ ] Expert booking + payment
- [ ] Refund handling

```bash
npm install @stripe/react-stripe-js stripe
```

### 3.4 Authentication
- [ ] Supabase Auth or Auth0 integration
- [ ] OAuth (Google, GitHub, Apple)
- [ ] Email verification
- [ ] 2FA setup

### 3.5 Analytics
- [ ] Page tracking (Mixpanel, Amplitude, Plausible)
- [ ] Event tracking (calls made, coins spent, etc)
- [ ] User journey tracking

```bash
npm install mixpanel-browser  # or amplitude-js
```

---

## Backend API Contract

### Expected Endpoints

```
// Posts
GET    /api/posts                    - Feed
POST   /api/posts                    - Create
GET    /api/posts/:id                - Single post
POST   /api/posts/:id/likes          - Like post
DELETE /api/posts/:id/likes          - Unlike
POST   /api/posts/:id/comments       - Comment

// Experts
GET    /api/experts                  - Directory (filterable)
GET    /api/experts/:id              - Profile
GET    /api/experts/:id/ratings      - Reviews

// Messages
GET    /api/conversations            - List
GET    /api/conversations/:id        - Detail + messages
POST   /api/messages                 - Send message
POST   /api/conversations/:id/read   - Mark read

// Users
GET    /api/users/me                 - Current user
PATCH  /api/users/me                 - Update profile
GET    /api/users/:id                - Public profile

// Wallet
GET    /api/wallet                   - Balance + transactions
POST   /api/wallet/purchase          - Buy coins

// Calls
POST   /api/calls                    - Initiate call
GET    /api/calls/:id                - Call status
POST   /api/calls/:id/complete       - End call

// Auth
POST   /api/auth/signup              - Register
POST   /api/auth/login               - Login
POST   /api/auth/logout              - Logout
POST   /api/auth/refresh             - Refresh token
```

---

## Environment Setup

### Create `.env.local`
```env
# API
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_WEBSOCKET_URL=ws://localhost:8000

# Auth
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx

# Payments
NEXT_PUBLIC_STRIPE_KEY=pk_test_xxxxx

# Real-time
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:8001

# Analytics
NEXT_PUBLIC_MIXPANEL_TOKEN=xxxxx
```

---

## Component Patterns

### Creating a new screen

```jsx
'use client'

import { useEffect, useState } from 'react'

export default function FeatureScreen({ user }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchData().then(setData).finally(() => setLoading(false))
  }, [])
  
  if (loading) return <div>Loading...</div>
  
  return (
    <div className="max-w-7xl mx-auto px-5 py-6 pb-20">
      {/* Content */}
    </div>
  )
}
```

### Creating a reusable component

```jsx
// app/components/ExpertCard.js
export default function ExpertCard({ expert, onCall, onChat }) {
  return (
    <div className="card hover:border-ac transition-all">
      {/* Content */}
    </div>
  )
}
```

### Using API calls

```jsx
// app/lib/api.js
export async function fetchPosts() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`)
  return res.json()
}

// In component
useEffect(() => {
  fetchPosts().then(setPosts)
}, [])
```

---

## Testing

### Unit tests (Jest)
```bash
npm run test -- --watch
```

### E2E tests (Playwright - optional)
```bash
npm install -D @playwright/test
```

### Manual testing checklist
- [ ] All screens accessible from nav
- [ ] Form submissions work
- [ ] Responsive on mobile (375px, 768px, 1440px)
- [ ] Dark mode looks good
- [ ] Performance: LCP < 2.5s, FID < 100ms
- [ ] Accessibility: WCAG AA compliance

---

## Deployment Checklist

- [ ] Environment variables set
- [ ] API endpoints verified
- [ ] Build succeeds: `npm run build`
- [ ] No console errors
- [ ] Images optimized
- [ ] Meta tags correct (favicon, OpenGraph)
- [ ] Analytics integrated
- [ ] Error logging setup (Sentry)
- [ ] Performance monitored (Vercel Analytics)

---

## Quick Commands

```bash
# Development
npm run dev              # Start dev server

# Testing
npm run lint            # ESLint check

# Building
npm run build           # Build for production
npm start               # Start production server

# Utilities
npm run build --verbose # Debug build issues
npm cache clean --force # Clear npm cache
```

---

## Resources

- [Design Handoff Details](../design_handoff_ringin/README.md)
- [Next.js Best Practices](https://nextjs.org/learn)
- [Tailwind Tips](https://tailwindcss.com/docs/configuration)
- [React Patterns](https://react.dev/reference)

---

**Current Status**: Phase 1 Complete, Phase 2 Ready

**Estimated Timeline**:
- Phase 2 (Core): 2-3 weeks
- Phase 3 (Advanced): 2-4 weeks
- Polish & Launch: 1 week

