'use client'

import { useState, useEffect } from 'react'
import TopNav from './components/TopNav'
import BottomNav from './components/BottomNav'
import HomeScreen from './screens/HomeScreen'
import ExpertsScreen from './screens/ExpertsScreen'
import AnonymousConnect from './screens/AnonymousConnect'
import WorkshopsScreen from './screens/WorkshopsScreen'
import MessagesScreen from './screens/MessagesScreen'
import ProfileScreen from './screens/ProfileScreen'
import WalletScreen from './screens/WalletScreen'
import LoginScreen from './screens/LoginScreen'
import CallScreen from './screens/CallScreen'
import SavedPostsScreen from './screens/SavedPostsScreen'
import UserProfileView from './components/UserProfileView'
import { useFollow } from './lib/useFollow'
import { sb } from './lib/supabase'
import { CURRENT_USER } from './lib/mockData'
import SeoLandingContent from './components/SeoLandingContent'

export default function HomeClient({ seoExperts = [], seoPosts = [] }) {
  const [activeTab, setActiveTab] = useState('home')
  const [unreadMsg, setUnreadMsg] = useState(0)
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [activeCall, setActiveCall] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [initConvo, setInitConvo] = useState(null)
  const [prevTab, setPrevTab] = useState('home')
  const [profileInitialSection, setProfileInitialSection] = useState(null)

  const { following: appFollowing, toggleFollow: appToggleFollow } = useFollow(sb, session?.user?.id)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = sb.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setShowLogin(false)
    })
    return () => listener?.subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    try {
      const cachedAvatar = localStorage.getItem('avatar_' + session.user.id)
      const cachedCover = localStorage.getItem('cover_' + session.user.id)
      setProfile(prev => prev || {
        ...CURRENT_USER,
        id: session.user.id,
        email: session.user.email,
        name: session.user.email?.split('@')[0] || 'User',
        img: cachedAvatar,
        avatar: cachedAvatar,
        cover: cachedCover,
      })
    } catch (e) {}
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }

    sb.from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        let bioJson = {}
        try { bioJson = JSON.parse(data?.bio || '{}') } catch (e) {}
        if (data) {
          const coverFinal = data.cover_url || bioJson.cover_url || null
          const avatarFinal = data.avatar_url || bioJson.avatar_url || null

          const merged = {
            id: data.id,
            name: data.full_name || data.email?.split('@')[0] || 'User',
            email: data.email,
            avatar: avatarFinal, img: avatarFinal,
            cover: coverFinal,
            role: bioJson.tag || 'Member',
            about: bioJson.about || '',
            bio: data.bio,
            tag: bioJson.tag,
            website_name: bioJson.website_name,
            website_url: bioJson.website_url,
            location: bioJson.location,
            coins: data.coins != null ? data.coins : 1240,
            followers: data.followers_count || 0,
            following: data.following_count || 0,
            posts: data.posts_count || 0,
          }
          setProfile(merged)
          if (avatarFinal) {
            try { localStorage.setItem('avatar_' + session.user.id, avatarFinal) } catch (e) {}
          }
          if (coverFinal) {
            try { localStorage.setItem('cover_' + session.user.id, coverFinal) } catch (e) {}
          }
        }
      })

    sb.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.email?.split('@')[0],
      is_online: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'id' }).then(() => {})

    const handleBeforeUnload = () => {
      sb.from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', session.user.id)
        .then(() => {})
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return

    sb.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', session.user.id)
      .eq('read', false)
      .then(({ count }) => { if (count != null) setUnreadMsg(count) })

    const ch = sb.channel('inbox-badge-' + session.user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'receiver_id=eq.' + session.user.id,
      }, () => {
        setActiveTab(currentTab => {
          if (currentTab !== 'messages') setUnreadMsg(prev => prev + 1)
          return currentTab
        })
      })
      .subscribe()

    return () => { sb.removeChannel(ch) }
  }, [session?.user?.id])

  // Read URL params to deep link to specific user/post on open
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const userParam = params.get('user')
    const postParam = params.get('post')
    if (userParam && session) {
      sb.from('profiles').select('id, full_name, email, avatar_url').eq('id', userParam).single().then(({ data }) => {
        if (data) handleViewUser({
          id: data.id,
          name: data.full_name || data.email?.split('@')[0],
          img: data.avatar_url,
        })
      })
    }
    if (postParam && session) {
      // Could open post detail here
    }
  }, [session])

  const currentUser = profile || CURRENT_USER

  const handleTabChange = (tab) => {
    if (tab === 'messages') setUnreadMsg(0)
    setViewingUser(null)
    setProfileInitialSection(null)
    if (tab !== 'wallet' && tab !== 'saved') setPrevTab(tab)
    setActiveTab(tab)
  }

  const handleViewUser = (u) => {
    if (!u || !u.id) return
    if (u.id === session?.user?.id) {
      setActiveTab('profile')
      setViewingUser(null)
      return
    }
    setViewingUser(u)
  }

  const handleCallExpert = (expert) => {
    if (!session) {
      setShowLogin(true)
      return
    }
    setActiveCall(expert)
  }

  const handleGoToMessages = (convo) => {
    setInitConvo(convo)
    setActiveTab('messages')
    setViewingUser(null)
  }

  const handleMessageUser = (user) => {
    if (!session) {
      setShowLogin(true)
      return
    }
    if (!user || !user.id) return
    const convId = [session.user.id, user.id].sort().join('_')
    handleGoToMessages({
      id: convId, convId, user: { id: user.id, name: user.name, img: user.img },
    })
  }

  const handleSignOut = async () => {
    const oldUid = session?.user?.id
    await sb.auth.signOut()
    setSession(null)
    setProfile(null)
    setActiveTab('home')
    setActiveCall(null)
    setViewingUser(null)
    setInitConvo(null)
    setPrevTab('home')
    setProfileInitialSection(null)
    setUnreadMsg(0)
    setUnreadNotif(0)
    if (oldUid && typeof window !== 'undefined') {
      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && (
            k.endsWith('_' + oldUid) ||
            k.includes(oldUid) ||
            k === 'feed_posts_cache_v2' ||
            k.startsWith('comments_') ||
            k.startsWith('msgs_') ||
            k.startsWith('convos_') ||
            k.startsWith('avatar_') ||
            k.startsWith('cover_') ||
            k.startsWith('user_posts_v2_') ||
            k.startsWith('user_profile_') ||
            k.startsWith('saved_posts_') ||
            k.startsWith('muted_posts_') ||
            k.startsWith('follows_') ||
            k.startsWith('my_posts_cache_v2_') ||
            k.startsWith('notif_') ||
            k.startsWith('acct_')
          )) {
            keysToRemove.push(k)
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
      } catch (e) {}
    }
  }

  const handleCoinsUpdate = (newCoins) => {
    setProfile(p => p ? { ...p, coins: newCoins } : p)
    if (session?.user?.id) {
      sb.from('profiles').update({ coins: newCoins }).eq('id', session.user.id).then(() => {})
    }
  }

  const handleOpenSettings = () => {
    setProfileInitialSection('settings')
    setActiveTab('profile')
  }

  const handleOpenExpertApply = () => {
    setProfileInitialSection('expert')
    setActiveTab('profile')
  }

  const handleOpenSavedPosts = () => {
    setProfileInitialSection(null)
    setViewingUser(null)
    setActiveTab('saved')
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#09090E', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="brand-grad" style={{ fontSize: 32 }}>RingIn</div>
      </div>
    )
  }

  if (showLogin && !session) {
    return <LoginScreen onClose={() => setShowLogin(false)} />
  }

  // Show SEO landing when not logged in (preserves all SEO content + better UX)
  if (!session) {
    return (
      <SeoLandingContent
        experts={seoExperts}
        posts={seoPosts}
        showLoginCta={true}
        onShowLogin={() => setShowLogin(true)}
      />
    )
  }

  if (activeCall) {
    return (
      <CallScreen
        expert={activeCall}
        coins={currentUser.coins}
        onCoinsChange={handleCoinsUpdate}
        onEnd={() => setActiveCall(null)}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090E', position: 'relative', zIndex: 1 }}>
      <TopNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMsg={unreadMsg}
        unreadNotif={unreadNotif}
        user={currentUser}
        coins={currentUser.coins}
        onViewUser={handleViewUser}
      />

      <main data-ringin-main style={{ paddingTop: '60px' }}>
        {!session && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(123,110,255,.2), rgba(232,77,154,.2))',
            border: '1px solid #28283A', borderRadius: 14,
            padding: '12px 20px', margin: '20px auto', maxWidth: 1360,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, color: '#EEEEF8' }}>
                👋 Welcome to RingIn (Demo Mode)
              </div>
              <div style={{ fontSize: 13, color: '#8F8FAA', marginTop: 4 }}>
                Sign in to post, like, comment, message, and call experts.
              </div>
            </div>
            <button
              onClick={() => setShowLogin(true)}
              style={{
                padding: '10px 20px', borderRadius: 8,
                background: 'linear-gradient(135deg, #7B6EFF, #E84D9A)',
                color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >Log In / Sign Up</button>
          </div>
        )}

        {viewingUser ? (
          <UserProfileView
            user={viewingUser}
            currentUser={currentUser}
            currentUserId={session?.user?.id}
            following={appFollowing}
            toggleFollow={appToggleFollow}
            onBack={() => setViewingUser(null)}
            onViewUser={handleViewUser}
            onGoToMessages={handleGoToMessages}
            onCallExpert={handleCallExpert}
            onGoToTab={handleTabChange}
            onMessageUser={handleMessageUser}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeScreen
                user={currentUser}
                session={session}
                onGoToTab={handleTabChange}
                onViewUser={handleViewUser}
                onCallExpert={handleCallExpert}
                onMessageUser={handleMessageUser}
                onOpenSettings={handleOpenSettings}
                onOpenSavedPosts={handleOpenSavedPosts}
                onOpenExpertApply={handleOpenExpertApply}
              />
            )}
            {activeTab === 'experts' && (
              <ExpertsScreen
                user={currentUser}
                session={session}
                onCallExpert={handleCallExpert}
                onViewUser={handleViewUser}
                onGoToMessages={handleGoToMessages}
                onGoToTab={handleTabChange}
              />
            )}
            {activeTab === 'connect' && <AnonymousConnect user={currentUser} session={session} />}
            {activeTab === 'workshops' && (
              <WorkshopsScreen
                user={currentUser}
                session={session}
                onGoToTab={handleTabChange}
                onViewUser={handleViewUser}
                onCallExpert={handleCallExpert}
              />
            )}
            {activeTab === 'messages' && (
              <MessagesScreen
                user={currentUser}
                session={session}
                initConvo={initConvo}
                onConvoConsumed={() => setInitConvo(null)}
                onUnreadCount={setUnreadMsg}
                onViewUser={handleViewUser}
                onGoToTab={handleTabChange}
                onCallExpert={handleCallExpert}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileScreen
                user={currentUser}
                session={session}
                onOpenWallet={() => handleTabChange('wallet')}
                onViewUser={handleViewUser}
                onSignOut={handleSignOut}
                onGoToTab={handleTabChange}
                initialSection={profileInitialSection}
                onMessageUser={handleMessageUser}
                onCallExpert={handleCallExpert}
              />
            )}
            {activeTab === 'wallet' && (
              <WalletScreen
                user={currentUser}
                session={session}
                onBack={() => handleTabChange(prevTab)}
              />
            )}
            {activeTab === 'saved' && (
              <SavedPostsScreen
                user={currentUser}
                session={session}
                onGoToTab={handleTabChange}
                onViewUser={handleViewUser}
                onMessageUser={handleMessageUser}
                onCallExpert={handleCallExpert}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile bottom nav (CSS-hidden on desktop) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMsg={unreadMsg}
      />
    </div>
  )
}
