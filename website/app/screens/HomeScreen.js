'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '../lib/icons'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'
import { LeftRail, RightRail } from '../components/Sidebars'
import { CURRENT_USER, EXPERTS, POSTS, FILTERS } from '../lib/mockData'
import { sb } from '../lib/supabase'
import { useFollow } from '../lib/useFollow'
import { usePostsRealtime } from '../lib/usePostsRealtime'
import { timeAgo } from '../lib/storage'
import { getRecommendedExperts, getPersonalizedFeed } from '../lib/mlService'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  amber: '#F5A623', red: '#EF4747', pink: '#E84D9A', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

function mapPost(p) {
  if (!p || !p.id) return null
  const images = Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : [])
  const likesArr = Array.isArray(p.likes) ? p.likes : []
  return {
    id: p.id,
    user_id: p.user_id,
    user: {
      id: p.user_id,
      name: p.user_name || 'User',
      img: p.user_avatar || null,
      role: 'Member',
      online: false,
      verified: false,
    },
    text: p.text || '',
    time: timeAgo(p.created_at),
    created_at: p.created_at,
    tags: Array.isArray(p.tags) ? p.tags : [],
    likes: likesArr.length,
    likedByIds: likesArr,
    liked: false,
    comments: p.comments_count || 0,
    img: images[0] || null,
    extraImgs: images.slice(1),
    video_url: p.video_url || null,
  }
}

// Normalize POSTS mock data (different shape: has user object, time string, no likedByIds)
function normalizeMockPost(p) {
  if (!p || !p.id) return null
  return {
    id: p.id,
    user_id: p.user?.id,
    user: {
      id: p.user?.id,
      name: p.user?.name || 'User',
      img: p.user?.img || null,
      role: p.user?.role || 'Member',
      online: p.user?.online || false,
      verified: p.user?.verified || false,
    },
    text: p.text || '',
    time: p.time || '',
    created_at: p.created_at || new Date().toISOString(),
    tags: Array.isArray(p.tags) ? p.tags : [],
    likes: typeof p.likes === 'number' ? p.likes : 0,
    likedByIds: [],
    liked: !!p.liked,
    comments: p.comments || 0,
    img: p.img || null,
    extraImgs: [],
    video_url: null,
  }
}

const CACHE_VERSION = 'v2'

export default function HomeScreen({ user, session, onGoToTab, onViewUser, onCallExpert, onMessageUser, onShowLikers, onOpenSettings, onOpenSavedPosts, onOpenExpertApply }) {
  const [filter, setFilter] = useState(() => {
    // Pick up pending tag filter from sidebar trending click
    if (typeof window !== 'undefined') {
      try {
        const pending = localStorage.getItem('pending_tag_filter')
        if (pending) {
          localStorage.removeItem('pending_tag_filter')
          return pending.toLowerCase()
        }
      } catch (e) {}
    }
    return 'all'
  })
  const [posts, setPosts] = useState([])
  const [experts, setExperts] = useState(EXPERTS)
  const [loading, setLoading] = useState(true)
  const [commentsCache, setCommentsCache] = useState({})
  const recentPostTexts = useRef(new Set()) // To dedupe own-post realtime echo

  const userId = session?.user?.id
  const { following, toggleFollow } = useFollow(sb, userId)

  // Realtime listeners (likes, comments, new posts) — skips own user echo
  usePostsRealtime(sb, 'feed-posts-rt', userId, setPosts, setCommentsCache, {
    onNewPost: (raw) => {
      // Extra guard: skip if we recently posted same text (own optimistic post)
      if (recentPostTexts.current.has((raw.text || '').slice(0, 100))) return
      setPosts(prev => {
        if (prev.find(p => p.id === raw.id)) return prev
        return [mapPost(raw), ...prev]
      })
    },
  })

  // Load real posts from Supabase + cache
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        // Cached load first (instant render) — but only valid posts
        try {
          const cacheKey = 'feed_posts_cache_' + CACHE_VERSION
          const cached = localStorage.getItem(cacheKey)
          // Clear old cache versions
          if (localStorage.getItem('feed_posts_cache')) localStorage.removeItem('feed_posts_cache')

          if (cached && mounted) {
            const arr = JSON.parse(cached)
            if (Array.isArray(arr) && arr.length > 0) {
              // Filter out malformed posts (missing user object)
              const valid = arr.filter(p => p && p.id && p.user && p.user.name)
              if (valid.length > 0) {
                setPosts(valid.map(p => ({
                  ...p,
                  liked: userId ? (p.likedByIds || []).includes(userId) : false,
                })))
                setLoading(false)
              }
            }
          }
        } catch (e) {
          try { localStorage.removeItem('feed_posts_cache_' + CACHE_VERSION) } catch (e2) {}
        }

        const { data: dbPosts, error } = await sb
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(15)

        if (error) {
          console.log('[Home] Posts query error, using mock:', error.message)
          if (mounted) {
            setPosts(POSTS.map(normalizeMockPost).filter(Boolean))
            setLoading(false)
          }
          return
        }

        if (mounted && dbPosts && dbPosts.length > 0) {
          const userIds = [...new Set(dbPosts.map(p => p.user_id))]
          const { data: profiles } = await sb
            .from('profiles')
            .select('id, full_name, email, avatar_url, is_online')
            .in('id', userIds)

          const profileMap = {}
          if (profiles) profiles.forEach(p => { profileMap[p.id] = p })

          const mapped = dbPosts.map(p => {
            const post = mapPost(p)
            const profile = profileMap[p.user_id]
            if (profile) {
              post.user.name = profile.full_name || profile.email?.split('@')[0] || 'User'
              post.user.img = profile.avatar_url || post.user.img
              post.user.online = profile.is_online
            }
            if (userId && post.likedByIds.includes(userId)) post.liked = true
            return post
          })

          setPosts(mapped)
          try { localStorage.setItem('feed_posts_cache_' + CACHE_VERSION, JSON.stringify(mapped)) } catch (e) {}
        } else if (mounted) {
          // Empty DB - keep mock for demo (normalized)
          setPosts(POSTS.map(normalizeMockPost).filter(Boolean))
        }

        // Online experts — try ML personalized recommendations first
        if (userId) {
          const recs = await getRecommendedExperts(userId, 8)
          if (mounted && recs?.recommendations && recs.recommendations.length > 0) {
            const mlExperts = recs.recommendations.map((r) => ({
              id: r.id,
              name: r.name,
              role: r.bio_tag || r.expert_area || 'Member',
              rate: r.rate || 50,
              img: r.avatar_url,
              online: r.is_online,
              verified: false,
              loc: r.city,
              _mlScore: r.score,
            }))
            // Only use ML results — don't pollute with mock data
            setExperts(mlExperts)
            return
          }
        }

        // Fallback to DB query if ML service unavailable
        const { data: onlineProfiles } = await sb
          .from('profiles')
          .select('id, full_name, email, avatar_url, is_online, bio')
          .eq('is_online', true)
          .limit(8)

        if (mounted && onlineProfiles && onlineProfiles.length > 0) {
          const mappedExperts = onlineProfiles.map((p, i) => ({
            id: p.id,
            name: p.full_name || p.email?.split('@')[0] || 'User',
            role: 'Member',
            rate: [50, 60, 80, 90, 110, 120, 75, 95][i % 8],
            img: p.avatar_url,
            online: true,
            verified: false,
          }))
          // Only fall back to mock when DB has nothing
          setExperts(mappedExperts)
        }
        // If both ML and DB return empty, keep mock EXPERTS (initial state) for demo
      } catch (e) {
        console.error('[Home] Load error:', e)
        if (mounted) setPosts(POSTS.map(normalizeMockPost).filter(Boolean))
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [userId])

  // Toggle like
  const toggleLike = async (postId) => {
    if (!userId) {
      alert('Please log in to like posts')
      return
    }

    const snapshot = posts
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const wasLiked = p.liked
      const newLikedBy = wasLiked
        ? p.likedByIds.filter(id => id !== userId)
        : [...new Set([...p.likedByIds, userId])]
      return {
        ...p,
        liked: !wasLiked,
        likes: newLikedBy.length,
        likedByIds: newLikedBy,
      }
    }))

    const { error } = await sb.rpc('toggle_like', { post_id: postId, user_id: userId })
    if (error) {
      console.error('[Home] toggle_like error:', error.message)
      setPosts(snapshot)
    }
  }

  // Submit new post
  const handleNewPost = async ({ text, images, video, tags }) => {
    if (!userId) {
      alert('Please log in to post')
      return
    }
    const postData = {
      user_id: userId,
      user_name: user.name,
      user_avatar: user.avatar || user.img,
      text,
      images: images || [],
      video_url: video || null,
      tags: tags || [],
      likes: [],
      comments_count: 0,
    }

    // Track for dedup
    recentPostTexts.current.add((text || '').slice(0, 100))
    setTimeout(() => { recentPostTexts.current.delete((text || '').slice(0, 100)) }, 5000)

    const tempId = 'tmp_' + Date.now()
    const optimistic = {
      ...postData,
      id: tempId,
      created_at: new Date().toISOString(),
    }
    setPosts(prev => [mapPost(optimistic), ...prev])

    const { data, error } = await sb.from('posts').insert([postData]).select()
    if (error) {
      alert('Failed to post: ' + error.message)
      setPosts(prev => prev.filter(p => p.id !== tempId))
      return
    }

    if (data && data[0]) {
      setPosts(prev => prev.map(p => p.id === tempId ? mapPost(data[0]) : p))
    }
  }

  // Delete post
  const handleDelete = async (postId) => {
    const snapshot = posts
    setPosts(prev => prev.filter(p => p.id !== postId))
    const { error } = await sb.from('posts').delete().eq('id', postId)
    if (error) {
      alert('Failed to delete')
      setPosts(snapshot)
    }
  }

  // Edit post
  const handleEdit = async (postId, newText) => {
    const snapshot = posts
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, text: newText } : p))
    const { error } = await sb.from('posts').update({ text: newText }).eq('id', postId)
    if (error) {
      alert('Failed to edit')
      setPosts(snapshot)
    }
  }

  // Submit comment
  const handleAddComment = async (postId, text) => {
    if (!userId || !text.trim()) return

    const tempId = 'tmp_' + Date.now()
    const optimistic = {
      id: tempId,
      post_id: postId,
      user_id: userId,
      user_name: user.name,
      user_avatar: user.avatar || user.img,
      text,
      created_at: new Date().toISOString(),
    }

    setCommentsCache(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimistic],
    }))
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p
    ))

    const { data, error } = await sb.from('comments').insert([{
      post_id: postId,
      user_id: userId,
      user_name: user.name,
      user_avatar: user.avatar || user.img,
      text,
    }]).select()

    if (error) {
      console.error('[Comment] Insert error:', error.message)
      setCommentsCache(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== tempId),
      }))
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 1) - 1) } : p
      ))
      return
    }

    if (data && data[0]) {
      setCommentsCache(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map(c => c.id === tempId ? data[0] : c),
      }))
      // Update count from DB to be accurate
      const { count } = await sb.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', postId)
      if (count != null) {
        sb.from('posts').update({ comments_count: count }).eq('id', postId).then(() => {})
      }
    }
  }

  // Load comments
  const loadComments = async (postId) => {
    if (commentsCache[postId]) return commentsCache[postId]

    try {
      const cached = localStorage.getItem('comments_' + postId)
      if (cached) {
        const arr = JSON.parse(cached)
        setCommentsCache(prev => ({ ...prev, [postId]: arr }))
      }
    } catch (e) {}

    const { data, error } = await sb
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setCommentsCache(prev => ({ ...prev, [postId]: data }))
      try { localStorage.setItem('comments_' + postId, JSON.stringify(data)) } catch (e) {}
      return data
    }
    return []
  }

  // Filter posts by chip
  const filteredPosts = (() => {
    if (filter === 'all' || filter === 'trending') return posts
    if (filter === 'following') {
      const followingIds = Object.keys(following)
      return posts.filter(p => followingIds.includes(p.user_id))
    }
    // Category filters
    return posts.filter(p => {
      if (!p) return false
      const userRole = (p.user?.role || '').toLowerCase()
      const tagMatch = p.tags?.some(t => (t || '').toLowerCase().includes(filter.toLowerCase()))
      return tagMatch || userRole.includes(filter.toLowerCase())
    })
  })()

  return (
    <div className="ringin-page">
      <div className="left-rail">
        <LeftRail
          user={user}
          onGoToTab={onGoToTab}
          onOpenSettings={onOpenSettings}
          onOpenSavedPosts={onOpenSavedPosts}
          onOpenExpertApply={onOpenExpertApply}
        />
      </div>

      <main className="ringin-main">
        <Composer user={user} session={session} onSubmit={handleNewPost} />

        {/* Filter Chips */}
        <div style={{ ...card(), marginTop: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 16px' }}>
            {FILTERS.map(f => {
              const active = filter === f.toLowerCase()
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f.toLowerCase())}
                  style={{
                    padding: '6px 14px', border: `1px solid ${active ? C.ac : C.border}`,
                    background: active ? C.acg : C.bg3,
                    borderRadius: 20, fontSize: 12, fontWeight: 600,
                    color: active ? C.ac : C.t2, cursor: 'pointer',
                  }}
                >{f}</button>
              )
            })}
          </div>
        </div>

        {loading && posts.length === 0 && (
          <SkeletonPosts />
        )}

        {!loading && filteredPosts.length === 0 && (
          <div style={{ ...card(), padding: 40, textAlign: 'center', color: C.t2 }}>
            {filter === 'following' ? 'Follow some users to see their posts here' : 'No posts to show'}
          </div>
        )}

        {filteredPosts.map(p => (
          <PostCard
            key={p.id}
            post={p}
            currentUser={user}
            currentUserId={userId}
            isOwner={p.user_id === userId}
            onLike={() => toggleLike(p.id)}
            onDelete={() => handleDelete(p.id)}
            onEdit={(newText) => handleEdit(p.id, newText)}
            onAddComment={(text) => handleAddComment(p.id, text)}
            onLoadComments={() => loadComments(p.id)}
            comments={commentsCache[p.id]}
            onViewUser={onViewUser}
            onMessageUser={onMessageUser}
            onShowLikers={onShowLikers}
          />
        ))}
      </main>

      <div className="right-rail">
        <RightRail
          experts={experts}
          onlineExperts={experts}
          onCallExpert={onCallExpert}
          onViewUser={onViewUser}
          onGoToTab={onGoToTab}
          following={following}
          toggleFollow={toggleFollow}
        />
      </div>
    </div>
  )
}

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}

function SkeletonPosts() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ ...card(), marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.bg3 }} className="blink" />
            <div style={{ flex: 1 }}>
              <div style={{ width: '40%', height: 14, background: C.bg3, borderRadius: 4, marginBottom: 6 }} className="blink" />
              <div style={{ width: '30%', height: 12, background: C.bg3, borderRadius: 4 }} className="blink" />
            </div>
          </div>
          <div style={{ width: '100%', height: 14, background: C.bg3, borderRadius: 4, marginBottom: 6 }} className="blink" />
          <div style={{ width: '85%', height: 14, background: C.bg3, borderRadius: 4, marginBottom: 6 }} className="blink" />
          <div style={{ width: '60%', height: 14, background: C.bg3, borderRadius: 4 }} className="blink" />
        </div>
      ))}
    </>
  )
}
