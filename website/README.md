# RingIn Website - Next.js + Tailwind CSS

A modern, high-fidelity web platform for RingIn - an expert calling social network with real-time features, anonymous connections, and a peer-to-peer marketplace.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ (LTS recommended)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
http://localhost:3000
```

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
website/
├── app/
│   ├── components/        # Reusable UI components
│   │   └── TopNav.js     # Main navigation bar
│   ├── screens/          # Full-page screens
│   │   ├── HomeScreen.js           # Feed + posts + composers
│   │   ├── ExpertsScreen.js        # Expert directory (3-column grid)
│   │   ├── AnonymousConnect.js     # Random matching feature
│   │   ├── WorkshopsScreen.js      # Live workshop hub
│   │   ├── MessagesScreen.js       # Messaging/inbox
│   │   ├── ProfileScreen.js        # User profile
│   │   └── WalletScreen.js         # Coins/wallet
│   ├── lib/             # Utilities & helpers (API clients, auth, etc)
│   ├── utils/           # Shared utilities
│   ├── layout.js        # Root layout + metadata
│   ├── page.js          # Main app with tab routing
│   └── globals.css      # Tailwind + global styles
├── public/              # Static assets (images, fonts)
├── tailwind.config.js   # Tailwind design system tokens
├── postcss.config.js    # PostCSS configuration
├── next.config.js       # Next.js configuration
└── package.json         # Dependencies
```

## 🎨 Design System

### Colors (from design_handoff)
- **Background**: `#09090E` (bg), `#111117` (bg-2), `#17171F` (bg-3), `#1E1E28` (bg-4)
- **Text**: `#EEEEF8` (text), `#8F8FAA` (t-2), `#52526A` (t-3)
- **Brand**: `#7B6EFF` (purple), `#E84D9A` (pink), `#27C96A` (green), `#F5A623` (gold)
- **Accent Gradient**: `linear-gradient(135deg, #7B6EFF, #E84D9A)`

### Typography
- **Brand**: Syne 700 (display, headings)
- **UI**: DM Sans 400/600/700 (body, buttons, labels)
- **Sizes**: 11px (xs), 12px (sm), 14px (base), 15px (lg), 16px (xl), 22px (2xl), 26px (3xl), 32px (4xl)

### Components

#### Buttons
```jsx
<button className="btn btn-pri">Call Expert</button>     {/* Purple */}
<button className="btn btn-sec">Cancel</button>          {/* Neutral */}
<button className="btn btn-out">Learn More</button>      {/* Outlined */}
<button className="btn btn-lg btn-pri">Get Started</button> {/* Large */}
```

#### Cards
```jsx
<div className="card">
  <div className="card-pad">Content here</div>
</div>
```

#### Chips (Tags/Filters)
```jsx
<div className="chip">Design</div>
<div className="chip on">Active Filter</div>
```

## 📱 Screen Features

### Home Feed
- 3-column layout: left profile card, center feed, right online experts
- Post composer with photo/feeling/live actions
- Filter chips (All, Following, Trending, Health, Tech, etc)
- Post cards with likes, comments, call buttons
- Expandable comments section
- Online experts list with call buttons
- Live workshops sidebar

### Experts Directory
- Category sidebar (200px)
- 3-column responsive grid
- Expert cards with:
  - Cover gradient image
  - Avatar (overlapping -32px)
  - Name + verified badge
  - Role, rating (stars), call count
  - 2-line bio
  - Category tags
  - Call & Chat CTAs
  - Rate badge ($/min)

### Anonymous Connect (NEW)
- Left: Compact anonymous profile (emoji avatar, mood, fans/calls)
- Right: Tag inputs for interests + chat preferences
- Match UI: Side-by-side avatars, shared interests, Skip/Connect buttons
- Profile sheet modal with full details
- Edit modal: 20 emoji avatars, nickname, bio, gender, age

### Messages
- Conversation list
- Direct messaging interface
- Unread badge counter
- Real-time message sync

### Workshops
- Live workshop cards
- "LIVE" badge with pulsing indicator
- Participant count
- Speaker info

### Profile
- Cover image with avatar overlay
- Name, role, bio
- Stats: followers, calls, rating
- Edit profile button
- Verification badge

### Wallet
- Coin balance (large hero number)
- Add Coins button
- Withdraw button
- Transaction history (coming)

## 🔗 Navigation

Main tabs in TopNav:
1. **Home** - Feed with posts, composers, stats
2. **Experts** - Directory of verified professionals
3. **Connect** (Orb button) - Anonymous voice/video matching
4. **Workshops** - Live educational content
5. **Messages** - Direct messaging with unread badge
6. Additional via avatar menu: Profile, Wallet, Settings

## 🎯 State Management

Currently using React `useState` for local component state. For scaling:
- **Recommended**: Zustand or Redux Toolkit for global state
- **Auth**: User context with JWT
- **Real-time**: Supabase realtime listeners or Socket.io

## 🔌 API Integration (Placeholder)

The app currently uses mock data. To connect real APIs:

1. **User Auth**: Create `lib/auth.js`
2. **Data Fetching**: Create `lib/api.js` with fetch wrapper
3. **Real-time**: Socket.io or Supabase channels
4. **Storage**: Move mock data from `data.js` to backend calls

Example integration pattern:
```jsx
const [posts, setPosts] = useState([])

useEffect(() => {
  fetchPosts().then(setPosts)
}, [])
```

## 🚢 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```bash
docker build -t ringin-web .
docker run -p 3000:3000 ringin-web
```

### Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_API_URL=https://api.ringin.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_KEY=...
```

## 📊 Performance Optimization

- ✅ Image optimization with next/image
- ✅ Automatic code splitting
- ✅ Lazy loading for screens
- ✅ CSS-in-JS with Tailwind (no runtime overhead)
- ✅ Font optimization with next/font

## 🧪 Testing (TODO)

```bash
npm install --save-dev jest @testing-library/react
npm run test
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing`
2. Make changes
3. Test: `npm run dev`
4. Build: `npm run build`
5. Commit with clear messages
6. Push and create PR

## 📝 TODOs

- [ ] Implement real authentication (Supabase/Auth0)
- [ ] Connect to backend API
- [ ] Add WebRTC for anonymous calling
- [ ] Implement real-time messaging (Socket.io)
- [ ] Add workshop video streaming
- [ ] Payment integration (Stripe)
- [ ] Analytics (Mixpanel/Amplitude)
- [ ] Dark/light mode toggle
- [ ] Mobile responsive optimizations
- [ ] PWA capabilities
- [ ] i18n for multiple languages

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide React Icons](https://lucide.dev)
- [Design Tokens Reference](./design_handoff_ringin/README.md)

## 🆘 Troubleshooting

### Port 3000 already in use
```bash
# Kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Tailwind classes not applying
- Clear `.next` folder: `rm -rf .next`
- Restart dev server
- Check `content` paths in `tailwind.config.js`

### Build errors
```bash
npm run build --verbose  # Get more details
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

MIT - Build something amazing!

---

**Next Step**: [Review Design Handoff](./design_handoff_ringin/README.md) for detailed specs
