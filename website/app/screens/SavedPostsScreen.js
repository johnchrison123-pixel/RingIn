'use client'

import { useState, useEffect } from 'react'
import { Icon } from '../lib/icons'
import PostCard from '../components/PostCard'
import { LeftRail, RightRail } from '../components/Sidebars'
import { sb } from '../lib/supabase'
import { useFollow } from '../lib/useFollow'
import { usePostsRealtime } from '../lib/usePostsRealtime'
import { timeAgo } from '../lib/storage'

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
    id: p.id, user_id: p.user_id,
    user: {
      id: p.user_id,
      name: p.user_name || 'User',
      img: p.user_avatar || null,
      role: 'Member',
      online: false,
      verified: false,
    },
    text: p.text || '', time: timeAgo(p.created_at), created_at: p.created_at,
    tags: Array.isArray(p.tags) ? p.tags : [],
    likes: likesArr.length, likedByIds: likesArr, liked: false,
    comments: p.comments_count || 0,
    img: images[0] || null, extraImgs: images.slice(1), video_url: p.video_url || null,
  }
}

export default function SavedPostsScreen({
  user, session, onGoToTab, onViewUser, onMessageUser, onCallExpert,
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentsCache, setCommentsCache] = useState({})
  const [savedPostIds, setSavedPostIds] = useState([])

  const userId = session?.user?.id
  const { following, toggleFollow } = useFollow(sb, userId)

  // Load saved posts list from Supabase
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let mounted = true

    const loadSaved = async () => {
      // Step 1: Get list of saved post IDs from saved_posts table
      const { data: saved, error: savedErr } = await sb.from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (savedErr) {
        console.error('[SavedPosts] error:', savedErr.message)
        // Fallback: try localStorage
        try {
          const localCache = JSON.parse(localStorage.getItem('saved_posts_' + userId) || '[]')
          if (localCache.length > 0) {
            await fetchPostsByIds(localCache, mounted)
            return
          }
        } catch (e) {}
        if (mounted) setLoading(false)
        return
      }

      if (!saved || saved.length === 0) {
        if (mounted) {
          setPosts([])
          setSavedPostIds([])
          setLoading(false)
        }
        return
      }

      const ids = saved.map(s => s.post_id)
      setSavedPostIds(ids)
      // Sync to localStorage for cache
      try { localStorage.setItem('saved_posts_' + userId, JSON.stringify(ids)) } catch (e) {}

      await fetchPostsByIds(ids, mounted)
    }

    const fetchPostsByIds = async (ids, mounted) => {
      if (!ids || ids.length === 0) {
        if (mounted) { setPosts([]); setLoading(false) }
        return
      }

      // Step 2: Get the actual post data
      const { data: postData, error: postErr } = await sb.from('posts')
        .select('*')
        .in('id', ids)

      if (postErr || !postData) {
        if (mounted) setLoading(false)
        return
      }

      // Get profile info for the post authors
      const userIds = [...new Set(postData.map(p => p.user_id).filter(Boolean))]
      let profileMap = {}
      if (userIds.length > 0) {
        const { data: profiles } = await sb.from('profiles')
          .select('id, full_name, email, avatar_url, is_online, bio')
          .in('id', userIds)
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p })
      }

      // Map posts with profile data
      const mapped = postData.map(p => {
        const post = mapPost(p)
        if (!post) return null
        const profile = profileMap[p.user_id]
        if (profile) {
          let bioJson = {}
          try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}
          post.user.name = profile.full_name || profile.email?.split('@')[0] || 'User'
          post.user.img = profile.avatar_url || bioJson.avatar_url || null
          post.user.online = profile.is_online
        }
        if (userId && post.likedByIds.includes(userId)) post.liked = true
        return post
      }).filter(Boolean)

      // Sort by original saved order
      const ordered = ids
        .map(id => mapped.find(p => p.id === id))
        .filter(Boolean)

      if (mounted) {
        setPosts(ordered)
        setLoading(false)
      }
    }

    loadSaved()
    return () => { mounted = false }
  }, [userId])

  // Realtime listener for like/comment count updates
  usePostsRealtime(sb, userId ? `saved-posts-rt-${userId}` : null, userId, setPosts, setCommentsCache, {})

  // Listen for unsave events (when user clicks "Unsave" on a post)
  useEffect(() => {
    if (!userId) return
    const ch = sb.channel('saved-posts-changes-' + userId)
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'saved_posts',
        filter: 'user_id=eq.' + userId,
      }, (payload) => {
        // Remove the unsaved post from the list
        setPosts(prev => prev.filter(p => p.id !== payload.old.post_id))
        setSavedPostIds(prev => prev.filter(id => id !== payload.old.post_id))
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [userId])

  const toggleLike = async (postId) => {
    if (!userId) return
    const snapshot = posts
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const wasLiked = p.liked
      const newLikedBy = wasLiked
        ? p.likedByIds.filter(id => id !== userId)
        : [...new Set([...p.likedByIds, userId])]
      return { ...p, liked: !wasLiked, likes: newLikedBy.length, likedByIds: newLikedBy }
    }))
    const { error } = await sb.rpc('toggle_like', { post_id: postId, user_id: userId })
    if (error) setPosts(snapshot)
  }

  const handleAddComment = async (postId, text) => {
    const tempId = 'tmp_' + Date.now()
    const optimistic = {
      id: tempId, post_id: postId, user_id: userId,
      user_name: user.name, user_avatar: user.img || user.avatar,
      text, created_at: new Date().toISOString(),
    }
    setCommentsCache(prev => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }))
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))

    const { data } = await sb.from('comments').insert([{
      post_id: postId, user_id: userId,
      user_name: user.name, user_avatar: user.img || user.avatar, text,
    }]).select()
    if (data?.[0]) {
      setCommentsCache(prev => ({
        ...prev, [postId]: (prev[postId] || []).map(c => c.id === tempId ? data[0] : c),
      }))
    }
  }

  const loadComments = async (postId) => {
    if (commentsCache[postId]) return
    const { data } = await sb.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    if (data) setCommentsCache(prev => ({ ...prev, [postId]: data }))
  }

  // For OWN posts: actually delete from DB
  const handleDelete = async (postId) => {
    if (!confirm('Delete this post permanently?')) return
    setPosts(prev => prev.filter(p => p.id !== postId))
    await sb.from('posts').delete().eq('id', postId)
    // Also remove from saved_posts since the post no longer exists
    await sb.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId)
  }

  // Add insert listener for newly-saved posts
  useEffect(() => {
    if (!userId) return
    const ch = sb.channel('saved-posts-inserts-' + userId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'saved_posts',
        filter: 'user_id=eq.' + userId,
      }, async (payload) => {
        const pid = payload.new.post_id
        if (savedPostIds.includes(pid)) return
        // Fetch the post
        const { data: pd } = await sb.from('posts').select('*').eq('id', pid).single()
        if (pd) {
          const mapped = mapPost(pd)
          if (mapped) {
            setPosts(prev => [mapped, ...prev])
            setSavedPostIds(prev => [...new Set([...prev, pid])])
          }
        }
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [userId, savedPostIds])

  const handleEdit = async (postId, newText) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, text: newText } : p))
    await sb.from('posts').update({ text: newText }).eq('id', postId)
  }

  return (
    <div className="ringin-page">
      <div className="left-rail">
        <LeftRail user={user} onGoToTab={onGoToTab} />
      </div>

      <main className="ringin-main">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => onGoToTab && onGoToTab('home')} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: C.bg3, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, cursor: 'pointer',
          }}>
            <div style={{ width: 16, height: 16 }}>{Icon.back()}</div>
            Home
          </button>
          <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, flex: 1 }}>
            🔖 Saved Posts
          </h1>
          {posts.length > 0 && (
            <span style={{
              padding: '4px 12px', borderRadius: 12, background: C.acg,
              color: C.ac, fontSize: 12, fontWeight: 700,
            }}>{posts.length}</span>
          )}
        </div>

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div style={{
            ...card(), padding: 60, textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔖</div>
            <h2 style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              No Saved Posts Yet
            </h2>
            <p style={{ color: C.t2, fontSize: 14, marginBottom: 20, maxWidth: 380, margin: '0 auto 20px' }}>
              Tap the 3-dot menu on any post and click <b>Save Post</b> to bookmark it. Saved posts appear here for later.
            </p>
            <button onClick={() => onGoToTab && onGoToTab('home')} style={{
              padding: '12px 24px', borderRadius: 10,
              background: C.grad, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Browse Home Feed</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ ...card(), padding: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.bg3 }} className="blink" />
              <div style={{ flex: 1 }}>
                <div style={{ width: '40%', height: 14, background: C.bg3, borderRadius: 4, marginBottom: 6 }} className="blink" />
                <div style={{ width: '90%', height: 14, background: C.bg3, borderRadius: 4 }} className="blink" />
              </div>
            </div>
          </div>
        )}

        {/* Posts list */}
        {posts.map(p => (
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
          />
        ))}
      </main>

      <div className="right-rail">
        <RightRail
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
