'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '../lib/icons'
import Avatar, { VerifiedBadge } from '../components/Avatar'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'
import { LeftRail, RightRail } from '../components/Sidebars'
import FollowersListModal from '../components/FollowersListModal'
import { sb } from '../lib/supabase'
import { uploadAvatar, uploadCover, timeAgo } from '../lib/storage'
import { usePostsRealtime } from '../lib/usePostsRealtime'
import { useFollow } from '../lib/useFollow'
import { COUNTRIES, INDIAN_STATES } from '../lib/countries'

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

export default function ProfileScreen({
  user, session, onOpenWallet, onViewUser, onSignOut, onGoToTab,
  initialSection, onMessageUser, onCallExpert,
}) {
  const [profile, setProfile] = useState(user)
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('posts')
  const [showSettings, setShowSettings] = useState(initialSection === 'settings')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showExpertApply, setShowExpertApply] = useState(initialSection === 'expert')
  const [showFollowersList, setShowFollowersList] = useState(null) // 'followers' | 'following'
  const [commentsCache, setCommentsCache] = useState({})
  const avatarInputRef = useRef(null)
  const coverInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const userId = session?.user?.id

  // React to initialSection prop changes — fixes "avatar click stays in settings" bug
  useEffect(() => {
    setShowSettings(initialSection === 'settings')
    setShowExpertApply(initialSection === 'expert')
  }, [initialSection])
  const { following, toggleFollow } = useFollow(sb, userId)

  // Load profile and posts
  useEffect(() => {
    if (!userId) return
    let mounted = true

    // Cache load (with validation)
    try {
      const cachedPosts = localStorage.getItem('my_posts_cache_v2_' + userId)
      if (cachedPosts && mounted) {
        const arr = JSON.parse(cachedPosts)
        if (Array.isArray(arr)) {
          const valid = arr.filter(p => p && p.id && p.user && p.user.name)
          if (valid.length > 0) setPosts(valid)
        }
      }
      // Clear old cache
      localStorage.removeItem('my_posts_cache_' + userId)
    } catch (e) {
      try { localStorage.removeItem('my_posts_cache_v2_' + userId) } catch (e2) {}
    }

    sb.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
      if (!mounted) return
      if (data) {
        let bioJson = {}
        try { bioJson = JSON.parse(data.bio || '{}') } catch (e) {}

        // Read cover from BOTH cover_url column AND bio.cover_url (fallback)
        const coverFinal = data.cover_url || bioJson.cover_url || null
        const avatarFinal = data.avatar_url || bioJson.avatar_url || null

        const merged = {
          ...user, ...data,
          name: data.full_name || user.name,
          img: avatarFinal,
          cover: coverFinal,
          about: bioJson.about || '',
          tag: bioJson.tag || '',
          website_name: bioJson.website_name || '',
          website_url: bioJson.website_url || '',
          coins: data.coins != null ? data.coins : (user.coins || 0),
        }
        setProfile(merged)
        if (avatarFinal) {
          try { localStorage.setItem('avatar_' + userId, avatarFinal) } catch (e) {}
        }
        if (coverFinal) {
          try { localStorage.setItem('cover_' + userId, coverFinal) } catch (e) {}
        }
      }
    })

    sb.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30).then(({ data }) => {
      if (!mounted) return
      if (data) {
        const mapped = data.map(p => {
          const post = mapPost(p)
          if (userId && post.likedByIds.includes(userId)) post.liked = true
          return post
        })
        setPosts(mapped)
        try { localStorage.setItem('my_posts_cache_v2_' + userId, JSON.stringify(mapped)) } catch (e) {}
      }
    })

    sb.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId).then(({ count }) => {
      if (mounted && count != null) setFollowerCount(count)
    })
    sb.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId).then(({ count }) => {
      if (mounted && count != null) setFollowingCount(count)
    })

    return () => { mounted = false }
  }, [userId])

  usePostsRealtime(sb, userId ? `profile-posts-rt-${userId}` : null, userId, setPosts, setCommentsCache, {})

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAvatar(file, userId)

      // Try to update avatar_url column first
      const { error: colErr } = await sb.from('profiles').update({ avatar_url: url }).eq('id', userId)

      // Also save in bio JSON as backup (always succeeds)
      let bioJson = {}
      try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}
      bioJson.avatar_url = url
      await sb.from('profiles').update({ bio: JSON.stringify(bioJson) }).eq('id', userId)

      setProfile(p => ({ ...p, img: url, avatar_url: url, bio: JSON.stringify(bioJson) }))
      try { localStorage.setItem('avatar_' + userId, url) } catch (e) {}

      if (colErr) {
        console.warn('[Avatar] cover_url column missing - saved to bio.avatar_url instead. Run SUPABASE_MIGRATIONS.sql.')
      }
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadCover(file, userId)

      // Try cover_url column first
      const { error: colErr } = await sb.from('profiles').update({ cover_url: url }).eq('id', userId)

      // Also save to bio JSON as backup (always works since bio is a known column)
      let bioJson = {}
      try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}
      bioJson.cover_url = url
      await sb.from('profiles').update({ bio: JSON.stringify(bioJson) }).eq('id', userId)

      setProfile(p => ({ ...p, cover: url, cover_url: url, bio: JSON.stringify(bioJson) }))
      try { localStorage.setItem('cover_' + userId, url) } catch (e) {}

      if (colErr) {
        console.warn('[Cover] cover_url column missing - saved to bio.cover_url instead. Run SUPABASE_MIGRATIONS.sql to add the column.')
      }
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleNewPost = async ({ text, images, video, tags }) => {
    if (!userId) return alert('Please log in')
    const tempId = 'tmp_' + Date.now()
    const optimistic = {
      id: tempId, user_id: userId,
      user_name: profile.name, user_avatar: profile.img,
      text, images: images || [], video_url: video, tags: tags || [],
      likes: [], comments_count: 0, created_at: new Date().toISOString(),
    }
    setPosts(prev => [mapPost(optimistic), ...prev])

    const { data, error } = await sb.from('posts').insert([{
      user_id: userId, user_name: profile.name, user_avatar: profile.img,
      text, images: images || [], video_url: video, tags: tags || [],
      likes: [], comments_count: 0,
    }]).select()

    if (error) {
      alert('Failed: ' + error.message)
      setPosts(prev => prev.filter(p => p.id !== tempId))
      return
    }
    if (data?.[0]) {
      setPosts(prev => {
        const updated = prev.map(p => p.id === tempId ? mapPost(data[0]) : p)
        try { localStorage.setItem('my_posts_cache_v2_' + userId, JSON.stringify(updated)) } catch (e) {}
        return updated
      })
    }
  }

  const toggleLike = async (postId) => {
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
      user_name: profile.name, user_avatar: profile.img,
      text, created_at: new Date().toISOString(),
    }
    setCommentsCache(prev => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }))
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))
    const { data } = await sb.from('comments').insert([{
      post_id: postId, user_id: userId,
      user_name: profile.name, user_avatar: profile.img, text,
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

  if (showSettings) {
    return <SettingsPanel
      profile={profile}
      onBack={() => setShowSettings(false)}
      onSignOut={onSignOut}
      onOpenWallet={onOpenWallet}
      onUpdateProfile={setProfile}
      session={session}
    />
  }

  return (
    <div className="ringin-page">
      <div className="left-rail">
        <LeftRail
          user={{ ...profile, posts: posts.length, followers: followerCount, following: followingCount }}
          onGoToTab={onGoToTab}
          onOpenSettings={() => setShowSettings(true)}
          onOpenExpertApply={() => setShowExpertApply(true)}
        />
      </div>

      <main className="ringin-main">
        {/* Hero card */}
        <div style={{ ...card(), overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: 220, position: 'relative', background: profile.cover ? `url(${profile.cover}) center/cover` : C.grad }}>
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
            <button onClick={() => coverInputRef.current?.click()} style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>📷 Edit Cover</button>
          </div>

          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -56, marginBottom: 16 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ border: `4px solid ${C.bg2}`, borderRadius: '50%' }}>
                  <Avatar user={profile} size={112} />
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                <button onClick={() => avatarInputRef.current?.click()} style={{
                  position: 'absolute', bottom: 4, right: 4,
                  background: C.ac, color: '#fff', border: `3px solid ${C.bg2}`,
                  borderRadius: '50%', width: 36, height: 36,
                  fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>📷</button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowEditProfile(true)} style={btnSec()}>
                  ✏️ Edit Profile
                </button>
                <button onClick={() => setShowSettings(true)} style={btnSec()}>
                  <div style={{ width: 14, height: 14, display: 'inline-flex' }}>{Icon.settings()}</div>
                  Settings
                </button>
              </div>
            </div>

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

            {/* Stats — Glass blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 12, marginTop: 20 }}>
              <GlassStat v={posts.length} l="Posts" onClick={() => {
                const el = document.getElementById('posts-section')
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveTab('posts')
              }} />
              <GlassStat v={followerCount} l="Followers" onClick={() => setShowFollowersList('followers')} />
              <GlassStat v={followingCount} l="Following" onClick={() => setShowFollowersList('following')} />
              <GlassStat v={profile.coins || 0} l="Coins" onClick={onOpenWallet} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div id="posts-section" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          {['posts', 'about', 'reviews'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '12px 20px', background: 'none', border: 'none',
              color: activeTab === t ? C.ac : C.t2, fontSize: 14, fontWeight: 700,
              borderBottom: activeTab === t ? `2px solid ${C.ac}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <>
            <Composer user={profile} session={session} onSubmit={handleNewPost} />
            <div style={{ marginTop: 16 }} />
            {posts.length === 0 && (
              <div style={{ ...card(), padding: 40, textAlign: 'center', color: C.t2 }}>
                No posts yet. Share your first post!
              </div>
            )}
            {posts.map(p => (
              <PostCard
                key={p.id}
                post={p}
                currentUser={profile}
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
          </>
        )}

        {activeTab === 'about' && (
          <div style={{ ...card(), padding: 24 }}>
            <h3 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>About</h3>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {profile.about || <span style={{ color: C.t3 }}>No bio yet. Click Edit Profile to add one.</span>}
            </div>
            <button onClick={() => setShowExpertApply(true)} style={{
              marginTop: 24, padding: '14px 24px', borderRadius: 10,
              background: C.grad, color: '#fff', fontWeight: 700, fontSize: 14,
              border: 'none', cursor: 'pointer', width: '100%',
            }}>🎯 Become an Expert</button>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div style={{ ...card(), padding: 40, textAlign: 'center', color: C.t2 }}>
            No reviews yet.
          </div>
        )}

        {showEditProfile && (
          <EditProfileModal
            profile={profile}
            onClose={() => setShowEditProfile(false)}
            onSave={(updated) => { setProfile(updated); setShowEditProfile(false) }}
            userId={userId}
          />
        )}

        {showExpertApply && (
          <ExpertApplyModal
            profile={profile}
            onClose={() => setShowExpertApply(false)}
            userId={userId}
          />
        )}

        {uploading && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24, padding: '12px 20px',
            background: C.bg2, border: `1px solid ${C.ac}`, borderRadius: 10,
            color: C.text, fontSize: 13, zIndex: 200,
          }}>Uploading...</div>
        )}

        {showFollowersList && (
          <FollowersListModal
            userId={userId}
            type={showFollowersList}
            onClose={() => setShowFollowersList(null)}
            onViewUser={onViewUser}
            currentUserId={userId}
            following={following}
            toggleFollow={toggleFollow}
          />
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

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}

function btnSec() {
  return {
    padding: '10px 16px', borderRadius: 10,
    background: C.bg4, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  }
}

function Stat({ v, l, onClick }) {
  return (
    <div onClick={onClick} style={{ textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{v}</div>
      <div style={{ fontSize: 11, color: C.t2 }}>{l}</div>
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

// ====== EDIT PROFILE MODAL ======
function EditProfileModal({ profile, onClose, onSave, userId }) {
  const [name, setName] = useState(profile.name || '')
  const [tag, setTag] = useState(profile.tag || '')
  const [about, setAbout] = useState(profile.about || '')
  const [websiteName, setWebsiteName] = useState(profile.website_name || '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const tagFinal = tag.trim() ? (tag.trim().startsWith('#') ? tag.trim() : '#' + tag.trim()) : ''
    let bioJson = {}
    try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}
    bioJson.about = about.trim()
    bioJson.tag = tagFinal
    bioJson.website_name = websiteName.trim()
    bioJson.website_url = websiteUrl.trim()
    const { error } = await sb.from('profiles').update({
      full_name: name.trim(), bio: JSON.stringify(bioJson),
    }).eq('id', userId)

    if (error) {
      alert('Failed: ' + error.message)
      setSaving(false)
      return
    }
    onSave({
      ...profile,
      name: name.trim(),
      full_name: name.trim(),
      tag: tagFinal,
      about: about.trim(),
      website_name: websiteName.trim(),
      website_url: websiteUrl.trim(),
      bio: JSON.stringify(bioJson),
    })
    setSaving(false)
  }

  return (
    <Modal onClose={onClose} title="Edit Profile">
      <Field label="Display Name">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp()} />
      </Field>
      <Field label="Tag (e.g. #engineer)">
        <input value={tag} onChange={(e) => setTag(e.target.value)} style={inp()} />
      </Field>
      <Field label="About Me">
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} style={{ ...inp(), resize: 'vertical' }} />
      </Field>
      <Field label="Website Name">
        <input value={websiteName} onChange={(e) => setWebsiteName(e.target.value)} style={inp()} />
      </Field>
      <Field label="Website URL">
        <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} style={inp()} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onClose} style={btnSec()}>Cancel</button>
        <button onClick={save} disabled={saving} style={{
          padding: '10px 16px', borderRadius: 10,
          background: C.ac, color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 1,
        }}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Modal>
  )
}

// ====== EXPERT APPLY MODAL ======
function ExpertApplyModal({ profile, onClose, userId }) {
  const [name, setName] = useState(profile.name || '')
  const [area, setArea] = useState('Tech')
  const [bio, setBio] = useState('')
  const [exp, setExp] = useState('')
  const [rate, setRate] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = async () => {
    setSaving(true)
    let bioJson = {}
    try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}
    bioJson.expert_request = { name, area, bio, exp, rate, applied_at: new Date().toISOString() }
    const { error } = await sb.from('profiles').update({ bio: JSON.stringify(bioJson) }).eq('id', userId)
    if (error) {
      alert('Failed: ' + error.message)
      setSaving(false)
      return
    }
    alert('Expert application submitted! We\'ll review and get back to you.')
    onClose()
  }

  return (
    <Modal onClose={onClose} title="Become an Expert">
      <Field label="Display Name">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp()} />
      </Field>
      <Field label="Expertise Area">
        <select value={area} onChange={(e) => setArea(e.target.value)} style={inp()}>
          <option>Medical</option>
          <option>Legal</option>
          <option>Tech</option>
          <option>Finance</option>
          <option>Mental Health</option>
          <option>Fitness</option>
          <option>Other</option>
        </select>
      </Field>
      <Field label="Short Bio">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ ...inp(), resize: 'vertical' }} />
      </Field>
      <Field label="Years of Experience">
        <input value={exp} onChange={(e) => setExp(e.target.value)} type="number" style={inp()} />
      </Field>
      <Field label="Hourly Rate (coins/min)">
        <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" style={inp()} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onClose} style={btnSec()}>Cancel</button>
        <button onClick={apply} disabled={saving || !name || !bio || !exp || !rate} style={{
          padding: '10px 16px', borderRadius: 10,
          background: C.grad, color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 1,
        }}>{saving ? 'Submitting...' : 'Submit Application'}</button>
      </div>
    </Modal>
  )
}

// ====== SETTINGS PANEL ======
function SettingsPanel({ profile, onBack, onSignOut, onOpenWallet, onUpdateProfile, session }) {
  const [section, setSection] = useState('main')

  if (section === 'main') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px 80px' }}>
        <button onClick={onBack} style={btnBack()}>
          <div style={{ width: 16, height: 16 }}>{Icon.back()}</div>
          Back to Profile
        </button>

        <div style={{ ...card(), padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Stat v="0" l="Calls Made" />
          <Stat v={profile.coins || 0} l="Coins" onClick={onOpenWallet} />
          <Stat v="0★" l="Rating" />
        </div>

        <div style={{ ...card(), padding: 8, marginBottom: 16 }}>
          <SettingItem icon="👤" label="Account Settings" onClick={() => setSection('account')} />
          <SettingItem icon="🔒" label="Privacy & Security" onClick={() => setSection('privacy')} />
          <SettingItem icon="🔔" label="Notification Settings" onClick={() => setSection('notifs')} />
          <SettingItem icon="🔊" label="Sound & Haptics" onClick={() => setSection('sound')} />
          <SettingItem icon="📊" label="Activity Log" onClick={() => setSection('activity')} />
          <SettingItem icon="❓" label="Help & Support" onClick={() => setSection('help')} />
          <SettingItem icon="⭐" label="Rate the App" onClick={() => alert('Thanks for using RingIn!')} />
        </div>

        <button onClick={async () => {
          if (confirm('Sign out?')) {
            await sb.auth.signOut()
            onSignOut && onSignOut()
          }
        }} style={{
          width: '100%', padding: 14, borderRadius: 10,
          background: 'rgba(239,71,71,0.1)', border: `1px solid ${C.red}`,
          color: C.red, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Sign Out</button>
      </div>
    )
  }

  if (section === 'account') {
    return <AccountSettings profile={profile} onBack={() => setSection('main')} session={session} onUpdateProfile={onUpdateProfile} />
  }
  if (section === 'privacy') {
    return <PrivacySettings profile={profile} onBack={() => setSection('main')} session={session} />
  }
  if (section === 'notifs') {
    return <NotificationSettings onBack={() => setSection('main')} session={session} profile={profile} />
  }
  if (section === 'sound') {
    return <SoundSettings onBack={() => setSection('main')} session={session} profile={profile} />
  }
  if (section === 'help') {
    return <HelpSupport onBack={() => setSection('main')} session={session} />
  }
  if (section === 'activity') {
    return <ActivityLog onBack={() => setSection('main')} session={session} />
  }
  return null
}

function SettingItem({ icon, label, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: C.text,
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ color: C.t3 }}>›</span>
    </div>
  )
}

// ====== ACCOUNT SETTINGS WITH COUNTRY/STATE/CITY ======
function AccountSettings({ profile, onBack, session, onUpdateProfile }) {
  const [name, setName] = useState(profile.name || '')
  const [tag, setTag] = useState(profile.tag || '')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [showStatePicker, setShowStatePicker] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [stateSearch, setStateSearch] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState(null)
  const [state, setState] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  // Load saved location data — from bio.location (DB) first, fallback to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    let bioLoc = {}
    try {
      const bioJson = JSON.parse(profile.bio || '{}')
      bioLoc = bioJson.location || {}
    } catch (e) {}

    try {
      // Country: bio first, then localStorage, default India
      const ccFromBio = bioLoc.country
      const ccFromLs = localStorage.getItem('acct_country_code')
      const cc = ccFromBio || ccFromLs
      const found = cc ? COUNTRIES.find(c => c.code === cc) : null
      setCountry(found || COUNTRIES.find(c => c.code === 'IN') || COUNTRIES[0])

      setPhone(bioLoc.phone || localStorage.getItem('acct_phone') || '')
      setState(bioLoc.state || localStorage.getItem('acct_state') || '')
      setDistrict(bioLoc.district || localStorage.getItem('acct_district') || '')
      setCity(bioLoc.city || localStorage.getItem('acct_city') || '')
    } catch (e) {}
  }, [profile.bio])

  const save = async () => {
    setSaving(true)
    let bioJson = {}
    try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}
    bioJson.tag = tag.trim() ? (tag.trim().startsWith('#') ? tag.trim() : '#' + tag.trim()) : ''
    bioJson.location = {
      country: country?.code,
      country_name: country?.name,
      dial: country?.dial,
      phone, state, district, city,
    }
    await sb.from('profiles').update({
      full_name: name.trim(), bio: JSON.stringify(bioJson),
    }).eq('id', session.user.id)
    try {
      localStorage.setItem('acct_country_code', country?.code || '')
      localStorage.setItem('acct_phone', phone)
      localStorage.setItem('acct_state', state)
      localStorage.setItem('acct_district', district)
      localStorage.setItem('acct_city', city)
    } catch (e) {}
    onUpdateProfile(p => ({ ...p, name: name.trim(), tag: bioJson.tag }))
    setSaving(false)
    onBack()
  }

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dial.includes(countrySearch)
  )
  const indianStateNames = Object.keys(INDIAN_STATES).filter(s => s.toLowerCase().includes(stateSearch.toLowerCase()))
  const cityList = (state && INDIAN_STATES[state] ? INDIAN_STATES[state] : []).filter(c => c.toLowerCase().includes(citySearch.toLowerCase()))

  return (
    <SubPanel title="Account Settings" onBack={onBack}>
      <Field label="Display Name"><input value={name} onChange={(e) => setName(e.target.value)} style={inp()} /></Field>
      <Field label="Tag"><input value={tag} onChange={(e) => setTag(e.target.value)} style={inp()} /></Field>
      <Field label="Email"><input value={session?.user?.email || ''} disabled style={{ ...inp(), opacity: 0.6 }} /></Field>

      {/* Country Dropdown */}
      <Field label="Country">
        <button onClick={() => setShowCountryPicker(true)} style={{
          ...inp(), display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', textAlign: 'left',
        }}>
          {country ? (
            <span>{country.flag} {country.name} ({country.dial})</span>
          ) : (
            <span style={{ color: C.t3 }}>Select country...</span>
          )}
          <span style={{ color: C.t3 }}>▼</span>
        </button>
      </Field>

      {/* Phone with country code */}
      <Field label="Phone Number">
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCountryPicker(true)} style={{
            ...inp(), width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontWeight: 700,
          }}>
            {country?.dial || '+91'}
          </button>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="Phone number"
            style={{ ...inp(), flex: 1 }}
          />
        </div>
      </Field>

      {/* State (Indian states only for Kerala launch) */}
      {country?.code === 'IN' && (
        <>
          <Field label="State">
            <button onClick={() => setShowStatePicker(true)} style={{
              ...inp(), display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', textAlign: 'left',
            }}>
              {state || <span style={{ color: C.t3 }}>Select state...</span>}
              <span style={{ color: C.t3 }}>▼</span>
            </button>
          </Field>

          <Field label="District">
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Your district"
              style={inp()}
            />
          </Field>

          <Field label="City">
            {state && INDIAN_STATES[state] ? (
              <button onClick={() => setShowCityPicker(true)} style={{
                ...inp(), display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', textAlign: 'left',
              }}>
                {city || <span style={{ color: C.t3 }}>Select city...</span>}
                <span style={{ color: C.t3 }}>▼</span>
              </button>
            ) : (
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" style={inp()} />
            )}
          </Field>
        </>
      )}

      {country && country.code !== 'IN' && (
        <>
          <Field label="State / Province">
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Your state" style={inp()} />
          </Field>
          <Field label="District / Region">
            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Your district" style={inp()} />
          </Field>
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" style={inp()} />
          </Field>
        </>
      )}

      <button onClick={save} disabled={saving} style={btnPri()}>{saving ? 'Saving...' : 'Save Changes'}</button>

      {/* Country Picker Modal */}
      {showCountryPicker && (
        <Modal title="Select Country" onClose={() => setShowCountryPicker(false)}>
          <input
            placeholder="Search country or code..."
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            autoFocus
            style={{ ...inp(), marginBottom: 12 }}
          />
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {filteredCountries.map(c => (
              <button key={c.code} onClick={() => {
                // Reset state/district/city when country changes to prevent cross-country leak
                const isDifferentCountry = !country || country.code !== c.code
                setCountry(c)
                if (isDifferentCountry) {
                  setState('')
                  setDistrict('')
                  setCity('')
                }
                setShowCountryPicker(false); setCountrySearch('')
              }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 12, width: '100%',
                background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
                color: C.text, fontSize: 14, textAlign: 'left',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 22 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: C.t3, fontWeight: 700 }}>{c.dial}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* State Picker Modal (India) */}
      {showStatePicker && (
        <Modal title="Select State" onClose={() => setShowStatePicker(false)}>
          <input
            placeholder="Search state..."
            value={stateSearch}
            onChange={(e) => setStateSearch(e.target.value)}
            autoFocus
            style={{ ...inp(), marginBottom: 12 }}
          />
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {indianStateNames.map(s => (
              <button key={s} onClick={() => {
                setState(s); setCity(''); setShowStatePicker(false); setStateSearch('')
              }} style={{
                display: 'block', padding: 12, width: '100%',
                background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
                color: C.text, fontSize: 14, textAlign: 'left',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >{s}</button>
            ))}
          </div>
        </Modal>
      )}

      {/* City Picker Modal */}
      {showCityPicker && state && (
        <Modal title={`City in ${state}`} onClose={() => setShowCityPicker(false)}>
          <input
            placeholder="Search city..."
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            autoFocus
            style={{ ...inp(), marginBottom: 12 }}
          />
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {cityList.map(ct => (
              <button key={ct} onClick={() => {
                setCity(ct); setShowCityPicker(false); setCitySearch('')
              }} style={{
                display: 'block', padding: 12, width: '100%',
                background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
                color: C.text, fontSize: 14, textAlign: 'left',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >{ct}</button>
            ))}
            {cityList.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: C.t3 }}>
                Type your city name above
                <button onClick={() => { setCity(citySearch); setShowCityPicker(false); setCitySearch('') }} style={{
                  display: 'block', margin: '12px auto', padding: '8px 16px',
                  background: C.ac, color: '#fff', border: 'none', borderRadius: 8,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>Use "{citySearch}"</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </SubPanel>
  )
}

// ====== PRIVACY WITH PASSWORD CHANGE FORM ======
function PrivacySettings({ profile, onBack, session }) {
  const [resetting, setResetting] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const sendReset = async () => {
    setResetting(true)
    const { error } = await sb.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: 'https://ring-in.vercel.app',
    })
    if (error) alert('Failed: ' + error.message)
    else alert('Password reset email sent to ' + session.user.email + '!')
    setResetting(false)
  }

  const changePassword = async () => {
    if (newPw !== confirmPw) return alert('New passwords do not match')
    if (newPw.length < 6) return alert('Password must be at least 6 characters')
    setPwSaving(true)

    // Verify current password by trying to sign in
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: session.user.email,
      password: currentPw,
    })
    if (signInErr) {
      alert('Current password is incorrect')
      setPwSaving(false)
      return
    }

    // Update password
    const { error } = await sb.auth.updateUser({ password: newPw })
    if (error) {
      alert('Failed: ' + error.message)
    } else {
      alert('Password changed successfully!')
      setShowPwForm(false)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setPwSaving(false)
  }

  return (
    <SubPanel title="Privacy & Security" onBack={onBack}>
      {/* Password Section */}
      <div style={{ ...card(), padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Password</h3>

        {!showPwForm ? (
          <>
            <button onClick={() => setShowPwForm(true)} style={{ ...btnPri(), marginBottom: 8 }}>
              🔑 Change Password (Current + New)
            </button>
            <button onClick={sendReset} disabled={resetting} style={{
              ...btnSec(), width: '100%', justifyContent: 'center',
            }}>
              {resetting ? 'Sending...' : '📧 Send Password Reset Email'}
            </button>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 8, textAlign: 'center' }}>
              Two ways to reset — choose what works for you
            </div>
          </>
        ) : (
          <>
            <Field label="Current Password">
              <input
                type="password" value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                style={inp()}
              />
            </Field>
            <Field label="New Password">
              <input
                type="password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 6 characters"
                style={inp()}
              />
            </Field>
            <Field label="Confirm New Password">
              <input
                type="password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Type new password again"
                style={inp()}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setShowPwForm(false); setCurrentPw(''); setNewPw(''); setConfirmPw('') }} style={btnSec()}>
                Cancel
              </button>
              <button onClick={changePassword} disabled={pwSaving || !currentPw || !newPw || !confirmPw} style={{
                padding: '10px 16px', borderRadius: 10,
                background: C.ac, color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 1,
                opacity: (pwSaving || !currentPw || !newPw || !confirmPw) ? 0.5 : 1,
              }}>
                {pwSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ ...card(), padding: 16, marginBottom: 12 }}>
        <ToggleRow label="Show online status" defaultChecked />
        <ToggleRow label="Allow direct messages" defaultChecked />
        <ToggleRow label="Show profile in search" defaultChecked />
      </div>

      <div style={{ ...card(), padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Data</h3>
        <button onClick={async () => {
          const uid = session.user.id
          const [posts, comments, follows, savedP, transactions, prof] = await Promise.all([
            sb.from('posts').select('*').eq('user_id', uid),
            sb.from('comments').select('*').eq('user_id', uid),
            sb.from('follows').select('*').eq('follower_id', uid),
            sb.from('saved_posts').select('*').eq('user_id', uid),
            sb.from('transactions').select('*').eq('user_id', uid),
            sb.from('profiles').select('*').eq('id', uid).single(),
          ])
          const bundle = {
            exported_at: new Date().toISOString(),
            user_id: uid,
            email: session.user.email,
            profile: prof.data || null,
            posts: posts.data || [],
            comments: comments.data || [],
            follows: follows.data || [],
            saved_posts: savedP.data || [],
            transactions: transactions.data || [],
          }
          const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `ringin-data-${uid}.json`
          a.click()
          URL.revokeObjectURL(url)
        }} style={btnSec()}>📥 Download My Data</button>
      </div>

      <div style={{ ...card(), padding: 16 }}>
        <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 12 }}>Danger Zone</h3>
        <button onClick={() => alert('Email support@ringin.app to delete your account.')} style={{
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(239,71,71,0.1)', border: `1px solid ${C.red}`,
          color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>Delete Account</button>
      </div>
    </SubPanel>
  )
}

function NotificationSettings({ onBack, session, profile }) {
  // Unified key naming with mobile app
  const prefKeys = ['likes', 'comments', 'follows', 'calls', 'messages', 'workshops', 'promotions', 'email_updates']
  const prefLabels = { likes: 'Likes', comments: 'Comments', follows: 'Follows', calls: 'Calls', messages: 'Messages', workshops: 'Workshops', promotions: 'Promotions', email_updates: 'Email Updates' }

  // Initialize from bio synchronously
  const [prefs, setPrefs] = useState(() => {
    let bioPrefs = {}
    try {
      const bioJson = JSON.parse(profile?.bio || '{}')
      bioPrefs = bioJson.notif_prefs || {}
    } catch (e) {}
    if (typeof window === 'undefined') return bioPrefs
    const stored = {}
    prefKeys.forEach(k => {
      // Bio takes priority, then localStorage, default true. Check both new + old keys.
      if (bioPrefs[k] !== undefined) stored[k] = bioPrefs[k]
      else if (bioPrefs['notif_' + k] !== undefined) stored[k] = bioPrefs['notif_' + k]
      else stored[k] = localStorage.getItem('notif_' + k) !== 'false'
    })
    return stored
  })

  // Re-sync when profile.bio changes externally
  useEffect(() => {
    if (!profile?.bio) return
    try {
      const bioJson = JSON.parse(profile.bio)
      if (bioJson.notif_prefs) {
        setPrefs(prev => ({ ...prev, ...bioJson.notif_prefs }))
      }
    } catch (e) {}
  }, [profile?.bio])

  const toggle = async (k) => {
    const next = { ...prefs, [k]: !prefs[k] }
    setPrefs(next)
    try { localStorage.setItem('notif_' + k, next[k] ? 'true' : 'false') } catch (e) {}

    // Persist to DB
    if (session?.user?.id) {
      // MERGE — don't replace, to avoid wiping mobile-set prefs
      // Re-read latest bio first to merge with concurrent writes
      const { data: latest } = await sb.from('profiles').select('bio').eq('id', session.user.id).single()
      let bioJson = {}
      try { bioJson = JSON.parse(latest?.bio || profile?.bio || '{}') } catch (e) {}
      bioJson.notif_prefs = { ...(bioJson.notif_prefs || {}), ...next }
      await sb.from('profiles').update({ bio: JSON.stringify(bioJson) }).eq('id', session.user.id)
    }
  }
  return (
    <SubPanel title="Notification Settings" onBack={onBack}>
      <div style={{ ...card(), padding: 8 }}>
        {prefKeys.map(k => (
          <ToggleRow key={k} label={prefLabels[k] || k} checked={prefs[k]} onChange={() => toggle(k)} />
        ))}
      </div>
    </SubPanel>
  )
}

function SoundSettings({ onBack, session, profile }) {
  const keys = ['Sound effects', 'Typing sounds', 'Notification sounds', 'Haptics (mobile)']

  // Initialize sync from bio
  const [prefs, setPrefs] = useState(() => {
    try {
      const bioJson = JSON.parse(profile?.bio || '{}')
      return bioJson.sound_prefs || {}
    } catch (e) { return {} }
  })

  const toggle = async (k) => {
    const next = { ...prefs, [k]: prefs[k] === false ? true : false }
    setPrefs(next)
    if (session?.user?.id) {
      // Re-read latest bio + merge to avoid clobbering
      const { data: latest } = await sb.from('profiles').select('bio').eq('id', session.user.id).single()
      let bioJson = {}
      try { bioJson = JSON.parse(latest?.bio || profile?.bio || '{}') } catch (e) {}
      bioJson.sound_prefs = { ...(bioJson.sound_prefs || {}), ...next }
      await sb.from('profiles').update({ bio: JSON.stringify(bioJson) }).eq('id', session.user.id)
    }
  }

  return (
    <SubPanel title="Sound & Haptics" onBack={onBack}>
      <div style={{ ...card(), padding: 16 }}>
        {keys.map(k => (
          <ToggleRow key={k} label={k} checked={prefs[k] !== false} onChange={() => toggle(k)} />
        ))}
      </div>
    </SubPanel>
  )
}

function HelpSupport({ onBack, session }) {
  const [topic, setTopic] = useState('General')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!msg.trim()) return
    setSending(true)
    // Try saving to support_tickets table; fall back to email link
    const ticket = {
      user_id: session?.user?.id || null,
      user_email: session?.user?.email || '',
      topic,
      message: msg.trim(),
    }
    try {
      const { error } = await sb.from('support_tickets').insert([ticket])
      if (error) throw error
      alert("✓ Sent! We'll respond within 24h to " + (session?.user?.email || 'your email'))
    } catch (e) {
      // Table doesn't exist? Open email client
      const body = encodeURIComponent(`Topic: ${topic}\n\nMessage:\n${msg}\n\n--\nUser: ${session?.user?.email || 'Guest'}`)
      window.location.href = `mailto:support@ringin.app?subject=${encodeURIComponent('[' + topic + '] Support Request')}&body=${body}`
    }
    setMsg('')
    setSending(false)
  }

  return (
    <SubPanel title="Help & Support" onBack={onBack}>
      <div style={{ ...card(), padding: 16, marginBottom: 12 }}>
        <Field label="Topic">
          <select value={topic} onChange={(e) => setTopic(e.target.value)} style={inp()}>
            <option>General</option>
            <option>Account Issues</option>
            <option>Payment</option>
            <option>Technical</option>
            <option>Feature Request</option>
          </select>
        </Field>
        <Field label="Message">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} style={{ ...inp(), resize: 'vertical' }} placeholder="How can we help?" />
        </Field>
        <button onClick={submit} disabled={sending || !msg.trim()} style={btnPri()}>
          {sending ? 'Sending...' : 'Send Message'}
        </button>
      </div>

      <div style={{ ...card(), padding: 16 }}>
        <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>FAQ</h3>
        {[
          ['How do I earn coins?', 'Sign up bonus + referrals + receiving calls as expert'],
          ['How do refunds work?', 'Email support@ringin.app within 24 hours of charge'],
          ['Is my data private?', 'Yes — we never sell your data. See Privacy Policy'],
        ].map(([q, a], i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{q}</div>
            <div style={{ fontSize: 13, color: C.t2 }}>{a}</div>
          </div>
        ))}
      </div>
    </SubPanel>
  )
}

function ActivityLog({ onBack, session }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!session?.user?.id) return
    const uid = session.user.id
    Promise.all([
      sb.from('posts').select('id, text, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
      sb.from('comments').select('id, text, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
    ]).then(([p, c]) => {
      const all = []
      if (p.data) p.data.forEach(x => all.push({ type: 'post', when: x.created_at, label: 'Posted: ' + (x.text || '').slice(0, 60) }))
      if (c.data) c.data.forEach(x => all.push({ type: 'comment', when: x.created_at, label: 'Commented: ' + (x.text || '').slice(0, 60) }))
      all.sort((a, b) => new Date(b.when) - new Date(a.when))
      setItems(all)
    })
  }, [])

  return (
    <SubPanel title="Activity Log" onBack={onBack}>
      <div style={{ ...card(), padding: 8 }}>
        {items.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: C.t2 }}>No recent activity</div>}
        {items.map((it, i) => (
          <div key={i} style={{ padding: '10px 12px', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontSize: 13, color: C.text }}>{it.label}</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{timeAgo(it.when)}</div>
          </div>
        ))}
      </div>
    </SubPanel>
  )
}

function SubPanel({ title, onBack, children }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px 80px' }}>
      <button onClick={onBack} style={btnBack()}>
        <div style={{ width: 16, height: 16 }}>{Icon.back()}</div> Back
      </button>
      <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20 }}>{title}</h1>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, defaultChecked, onChange }) {
  const [state, setState] = useState(checked !== undefined ? checked : !!defaultChecked)
  const handle = () => {
    if (onChange) onChange(!state)
    setState(!state)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 8px' }}>
      <span style={{ fontSize: 14, color: C.text }}>{label}</span>
      <button onClick={handle} style={{
        width: 44, height: 24, borderRadius: 12,
        background: state ? C.ac : C.bg4, border: 'none',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: state ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, background: C.bg2,
        border: `1px solid ${C.border}`, borderRadius: 14,
        padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t2, fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function inp() {
  return {
    width: '100%', padding: '10px 14px', background: C.bg3,
    border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  }
}

function btnPri() {
  return {
    width: '100%', padding: 12, borderRadius: 10,
    background: C.ac, color: '#fff', border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  }
}

function btnBack() {
  return {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    padding: '8px 14px', borderRadius: 10,
    background: C.bg3, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 13, cursor: 'pointer',
  }
}
