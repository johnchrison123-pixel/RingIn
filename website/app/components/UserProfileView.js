'use client'

import { useState, useEffect } from 'react'
import { Icon } from '../lib/icons'
import Avatar, { VerifiedBadge } from './Avatar'
import PostCard from './PostCard'
import { LeftRail, RightRail } from './Sidebars'
import FollowersListModal from './FollowersListModal'
import { sb } from '../lib/supabase'
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

export default function UserProfileView({
  user, currentUser, currentUserId, following, toggleFollow,
  onBack, onViewUser, onGoToMessages, onCallExpert, onGoToTab, onMessageUser,
}) {
  const [profile, setProfile] = useState(user)
  const [posts, setPosts] = useState([])
  const [commentsCache, setCommentsCache] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAvatarBig, setShowAvatarBig] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showFollowersList, setShowFollowersList] = useState(null)

  const isFollowing = following && following[user?.id]
  const isSelf = currentUserId === user?.id

  // Load profile + posts (with cache)
  useEffect(() => {
    if (!user?.id) return
    let mounted = true

    // Cache profile
    try {
      const cachedProf = localStorage.getItem('user_profile_' + user.id)
      if (cachedProf && mounted) {
        const cp = JSON.parse(cachedProf)
        setProfile(p => ({ ...p, ...cp }))
      }
      const cachedPosts = localStorage.getItem('user_posts_v2_' + user.id)
      if (cachedPosts && mounted) {
        const cp = JSON.parse(cachedPosts)
        if (Array.isArray(cp)) {
          const valid = cp.filter(p => p && p.id && p.user && p.user.name)
          if (valid.length > 0) {
            setPosts(valid)
            setLoading(false)
          }
        }
      }
      localStorage.removeItem('user_posts_' + user.id)
    } catch (e) {}

    sb.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (!mounted || !data) return
      let bioJson = {}
      try { bioJson = JSON.parse(data.bio || '{}') } catch (e) {}

      // Read cover/avatar from BOTH column AND bio JSON (fallback)
      const coverFinal = data.cover_url || bioJson.cover_url || null
      const avatarFinal = data.avatar_url || bioJson.avatar_url || user.img || null

      const merged = {
        ...user, ...data,
        name: data.full_name || data.email?.split('@')[0] || user.name,
        img: avatarFinal,
        cover: coverFinal,
        about: bioJson.about,
        tag: bioJson.tag,
        website_name: bioJson.website_name,
        website_url: bioJson.website_url,
      }
      setProfile(merged)
      try { localStorage.setItem('user_profile_' + user.id, JSON.stringify(merged)) } catch (e) {}
    })

    // Follower/following counts
    sb.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id).then(({ count }) => {
      if (mounted && count != null) setFollowerCount(count)
    })
    sb.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id).then(({ count }) => {
      if (mounted && count != null) setFollowingCount(count)
    })

    sb.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      if (!mounted) return
      if (data) {
        const mapped = data.map(p => {
          const post = mapPost(p)
          if (currentUserId && post.likedByIds.includes(currentUserId)) post.liked = true
          return post
        })
        setPosts(mapped)
        try { localStorage.setItem('user_posts_v2_' + user.id, JSON.stringify(mapped)) } catch (e) {}
      }
      setLoading(false)
    })

    return () => { mounted = false }
  }, [user?.id])

  // Realtime sync
  usePostsRealtime(sb, user?.id ? `userprofile-posts-${user.id}` : null, currentUserId, setPosts, setCommentsCache, {})

  const startMessage = () => {
    if (!currentUserId) return alert('Please log in')
    const convId = [currentUserId, user.id].sort().join('_')
    onGoToMessages && onGoToMessages({
      id: convId, convId, user: { id: user.id, name: profile.name, img: profile.img },
    })
  }

  const handleLike = async (postId) => {
    if (!currentUserId) return alert('Please log in')
    const snapshot = posts
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const wasLiked = p.liked
      const newLikedBy = wasLiked
        ? p.likedByIds.filter(id => id !== currentUserId)
        : [...new Set([...p.likedByIds, currentUserId])]
      return { ...p, liked: !wasLiked, likes: newLikedBy.length, likedByIds: newLikedBy }
    }))
    const { error } = await sb.rpc('toggle_like', { post_id: postId, user_id: currentUserId })
    if (error) setPosts(snapshot)
  }

  const handleAddComment = async (postId, text) => {
    const tempId = 'tmp_' + Date.now()
    const optimistic = {
      id: tempId, post_id: postId, user_id: currentUserId,
      user_name: currentUser.name, user_avatar: currentUser.img || currentUser.avatar,
      text, created_at: new Date().toISOString(),
    }
    setCommentsCache(prev => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }))
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))

    const { data } = await sb.from('comments').insert([{
      post_id: postId, user_id: currentUserId,
      user_name: currentUser.name, user_avatar: currentUser.img || currentUser.avatar, text,
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

  const handleDelete = async (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    await sb.from('posts').delete().eq('id', postId)
  }

  const handleEdit = async (postId, newText) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, text: newText } : p))
    await sb.from('posts').update({ text: newText }).eq('id', postId)
  }

  return (
    <div className="ringin-page">
      <div className="left-rail">
        <LeftRail user={currentUser} onGoToTab={onGoToTab} />
      </div>

      <main className="ringin-main">
        {/* Back button */}
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          padding: '8px 14px', borderRadius: 10,
          background: C.bg3, border: `1px solid ${C.border}`,
          color: C.text, fontSize: 13, cursor: 'pointer',
        }}>
          <div style={{ width: 16, height: 16 }}>{Icon.back()}</div>
          Back
        </button>

        {/* Hero */}
        <div style={{ ...card(), overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: 220, background: profile.cover ? `url(${profile.cover}) center/cover` : C.grad }} />
          <div style={{ padding: '0 24px 24px', position: 'relative' }}>
            <div onClick={() => setShowAvatarBig(true)} style={{
              marginTop: -56, display: 'inline-block', cursor: 'pointer',
              border: `4px solid ${C.bg2}`, borderRadius: '50%',
            }}>
              <Avatar user={profile} size={112} showOnline={profile.is_online} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {profile.name} {profile.verified && <VerifiedBadge />}
                </div>
                {profile.tag && <div style={{ fontSize: 14, color: C.t2, marginTop: 4 }}>{profile.tag}</div>}
                {profile.about && <div style={{ fontSize: 14, color: C.text, marginTop: 12, lineHeight: 1.5 }}>{profile.about}</div>}
                {profile.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener" style={{
                    fontSize: 13, color: C.ac, marginTop: 8, display: 'inline-block',
                  }}>🔗 {profile.website_name || profile.website_url}</a>
                )}

                {/* Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
                  gap: 12, marginTop: 20,
                }}>
                  <GlassStat v={posts.length} l="Posts" />
                  <GlassStat v={followerCount} l="Followers" onClick={() => setShowFollowersList('followers')} />
                  <GlassStat v={followingCount} l="Following" onClick={() => setShowFollowersList('following')} />
                  {profile.rating && <GlassStat v={`${profile.rating}★`} l="Rating" />}
                </div>
              </div>

              {!isSelf && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => toggleFollow && toggleFollow(user.id, profile.name, profile.img, profile.role)} style={{
                    padding: '10px 20px', borderRadius: 10,
                    background: isFollowing ? C.acg : C.ac,
                    border: isFollowing ? `1px solid ${C.ac}` : 'none',
                    color: isFollowing ? C.ac : '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>{isFollowing ? '✓ Following' : '+ Follow'}</button>
                  <button onClick={startMessage} style={{
                    padding: '10px 20px', borderRadius: 10,
                    background: C.bg4, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <div style={{ width: 14, height: 14 }}>{Icon.msg()}</div>
                    Message
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Posts */}
        <div style={{ marginBottom: 16, fontFamily: 'Syne', fontSize: 18, fontWeight: 700, color: C.text, padding: '0 4px' }}>Posts</div>
        {loading && posts.length === 0 && (
          <div style={{ ...card(), padding: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.bg3 }} className="blink" />
              <div style={{ flex: 1 }}>
                <div style={{ width: '40%', height: 14, background: C.bg3, borderRadius: 4, marginBottom: 6 }} className="blink" />
                <div style={{ width: '30%', height: 12, background: C.bg3, borderRadius: 4 }} className="blink" />
              </div>
            </div>
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div style={{ ...card(), padding: 40, textAlign: 'center', color: C.t2 }}>
            No posts yet from {profile.name?.split(' ')[0]}.
          </div>
        )}
        {posts.map(p => (
          <PostCard
            key={p.id}
            post={p}
            currentUser={currentUser}
            currentUserId={currentUserId}
            isOwner={p.user_id === currentUserId}
            onLike={() => handleLike(p.id)}
            onAddComment={(text) => handleAddComment(p.id, text)}
            onLoadComments={() => loadComments(p.id)}
            onDelete={() => handleDelete(p.id)}
            onEdit={(newText) => handleEdit(p.id, newText)}
            comments={commentsCache[p.id]}
            onViewUser={onViewUser}
            onMessageUser={onMessageUser}
          />
        ))}

        {showFollowersList && (
          <FollowersListModal
            userId={user.id}
            type={showFollowersList}
            onClose={() => setShowFollowersList(null)}
            onViewUser={onViewUser}
            currentUserId={currentUserId}
            following={following || {}}
            toggleFollow={toggleFollow}
          />
        )}

        {/* Avatar viewer */}
        {showAvatarBig && (
          <div onClick={() => setShowAvatarBig(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}>
            {profile.img ? (
              <img src={profile.img} alt="" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '50%' }} />
            ) : (
              <div style={{ background: C.bg2, padding: 60, borderRadius: '50%' }}>
                <Avatar user={profile} size={200} />
              </div>
            )}
          </div>
        )}
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

function card() {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14 }
}

function Stat({ v, l, onClick }) {
  return (
    <div onClick={onClick} style={{
      textAlign: 'center',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{v}</div>
      <div style={{ fontSize: 11, color: onClick ? C.ac : C.t2 }}>{l}</div>
    </div>
  )
}

function GlassStat({ v, l, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'center', cursor: onClick ? 'pointer' : 'default',
        padding: '16px 12px',
        background: hover
          ? 'linear-gradient(135deg, rgba(123,110,255,0.18), rgba(232,77,154,0.12))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        border: hover
          ? `1px solid rgba(123,110,255,0.4)`
          : `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 14,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: hover
          ? '0 8px 24px rgba(123,110,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'all 0.2s ease',
        transform: hover && onClick ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{
        fontSize: 22, fontWeight: 800, color: C.text,
        fontFamily: 'Syne', letterSpacing: '-0.5px',
      }}>{v}</div>
      <div style={{
        fontSize: 11, color: hover ? C.ac : C.t2,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginTop: 4, fontWeight: 600, transition: 'color 0.2s',
      }}>{l}</div>
    </div>
  )
}
