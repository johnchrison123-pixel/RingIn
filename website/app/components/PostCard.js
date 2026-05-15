'use client'

import { useState, useEffect } from 'react'
import { Icon } from '../lib/icons'
import Avatar, { VerifiedBadge } from './Avatar'
import { sb } from '../lib/supabase'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  amber: '#F5A623', red: '#EF4747', pink: '#E84D9A', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function PostCard({
  post, currentUser, currentUserId, isOwner,
  onLike, onDelete, onEdit, onAddComment, onLoadComments, comments,
  onViewUser, onMessageUser, onShowLikers, onUnsave,
}) {
  // Hooks MUST run before any early return (Rules of Hooks)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post?.text || '')
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [saved, setSaved] = useState(false)
  const [muted, setMuted] = useState(false)
  const [toast, setToast] = useState(null)
  const [hidden, setHidden] = useState(false)

  // Defensive guards — derive safe user object even if post.user undefined
  const safeUser = post?.user || {
    id: post?.user_id,
    name: post?.user_name || 'User',
    img: post?.user_avatar,
    role: 'Member',
    online: false,
    verified: false,
  }

  // Init saved + muted state from localStorage cache, then sync from DB
  useEffect(() => {
    if (!post?.id) return
    try {
      const savedPosts = JSON.parse(localStorage.getItem('saved_posts_' + currentUserId) || '[]')
      setSaved(savedPosts.includes(post.id))
      const mutedPosts = JSON.parse(localStorage.getItem('muted_posts_' + currentUserId) || '[]')
      setMuted(mutedPosts.includes(post.id))
    } catch (e) {}

    // Sync from Supabase
    if (currentUserId) {
      sb.from('saved_posts').select('post_id').eq('user_id', currentUserId).eq('post_id', post.id).then(({ data }) => {
        if (data && data.length > 0) setSaved(true)
      })
      sb.from('muted_posts').select('post_id').eq('user_id', currentUserId).eq('post_id', post.id).then(({ data }) => {
        if (data && data.length > 0) setMuted(true)
      })
    }
  }, [post?.id, currentUserId])

  useEffect(() => {
    if (showComments && onLoadComments) onLoadComments()
  }, [showComments])

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = () => setShowMenu(false)
    setTimeout(() => document.addEventListener('click', handler), 100)
    return () => document.removeEventListener('click', handler)
  }, [showMenu])

  const allImages = [post.img, ...(post.extraImgs || [])].filter(Boolean)

  const submitComment = () => {
    if (!commentText.trim()) return
    onAddComment(commentText.trim())
    setCommentText('')
  }

  const submitEdit = async () => {
    if (!editText.trim() || editText === post.text) {
      setEditing(false)
      return
    }
    await onEdit(editText.trim())
    setEditing(false)
  }

  const sharePost = () => {
    const url = `https://ring-in.vercel.app/post/${post.id}`
    if (navigator.share) {
      navigator.share({ url, title: 'RingIn Post', text: post.text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied!'))
    }
  }

  const toggleSave = async () => {
    if (!currentUserId) {
      alert('Please log in to save posts')
      setShowMenu(false)
      return
    }
    const wasSaved = saved
    setSaved(!wasSaved)
    setShowMenu(false)

    // Update localStorage cache
    try {
      const key = 'saved_posts_' + currentUserId
      const savedPosts = JSON.parse(localStorage.getItem(key) || '[]')
      const next = wasSaved
        ? savedPosts.filter(id => id !== post.id)
        : [...new Set([...savedPosts, post.id])]
      localStorage.setItem(key, JSON.stringify(next))
    } catch (e) {}

    // Persist to Supabase (forever)
    if (wasSaved) {
      const { error } = await sb.from('saved_posts').delete()
        .eq('user_id', currentUserId).eq('post_id', post.id)
      if (error) {
        console.error('[Save] delete error:', error.message)
        setToast({ msg: 'Failed to unsave', err: true })
      } else {
        setToast({ msg: '✓ Removed from saved' })
      }
    } else {
      const { error } = await sb.from('saved_posts').upsert({
        user_id: currentUserId, post_id: post.id,
      }, { onConflict: 'user_id,post_id' })
      if (error) {
        console.error('[Save] insert error:', error.message)
        setToast({ msg: 'Failed to save', err: true })
        setSaved(wasSaved) // revert
      } else {
        setToast({ msg: '🔖 Saved to your bookmarks' })
      }
    }
    setTimeout(() => setToast(null), 2500)
  }

  const toggleMute = async () => {
    if (!currentUserId) {
      alert('Please log in')
      setShowMenu(false)
      return
    }
    const wasMuted = muted
    setMuted(!wasMuted)
    setShowMenu(false)

    try {
      const key = 'muted_posts_' + currentUserId
      const mutedPosts = JSON.parse(localStorage.getItem(key) || '[]')
      const next = wasMuted
        ? mutedPosts.filter(id => id !== post.id)
        : [...new Set([...mutedPosts, post.id])]
      localStorage.setItem(key, JSON.stringify(next))
    } catch (e) {}

    if (wasMuted) {
      const { error } = await sb.from('muted_posts').delete()
        .eq('user_id', currentUserId).eq('post_id', post.id)
      if (error) {
        setMuted(wasMuted)
        setToast({ msg: 'Failed to unmute', err: true })
      } else {
        setToast({ msg: '🔔 Notifications unmuted' })
      }
    } else {
      const { error } = await sb.from('muted_posts').upsert({
        user_id: currentUserId, post_id: post.id,
      }, { onConflict: 'user_id,post_id' })
      if (error) {
        setMuted(wasMuted)
        setToast({ msg: 'Failed to mute', err: true })
      } else {
        setToast({ msg: '🔕 Notifications muted' })
      }
    }
    setTimeout(() => setToast(null), 2500)
  }

  const handleMessage = () => {
    if (onMessageUser && safeUser.id) onMessageUser(safeUser)
  }

  // Early returns after all hooks have run
  if (!post || !post.id) return null
  if (hidden) return null

  return (
    <div className="post-card" style={{ ...card(), marginBottom: 16, position: 'relative' }}>
      {/* Save toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 30,
          padding: '8px 14px', borderRadius: 10,
          background: toast.err ? 'rgba(239,71,71,0.95)' : 'rgba(123,110,255,0.95)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          animation: 'fadeInOut 2.5s ease',
        }}>{toast.msg}</div>
      )}

      <div className="post-card-body" style={{ padding: 16 }}>
        {/* Head */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div onClick={() => onViewUser && onViewUser({ id: safeUser.id, name: safeUser.name, img: safeUser.img })} style={{ cursor: 'pointer' }}>
            <Avatar user={safeUser} size={42} showOnline={safeUser.online} />
          </div>
          <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => onViewUser && onViewUser({ id: safeUser.id, name: safeUser.name, img: safeUser.img })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
              {safeUser.name} {safeUser.verified && <VerifiedBadge />}
            </div>
            <div style={{ fontSize: 12, color: C.t2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{safeUser.role}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.t3 }} />
              <span>{post.time}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.t3 }} />
              <span>🌐</span>
            </div>
          </div>
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v) }} style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.t2, background: 'none', border: 'none', cursor: 'pointer',
            }}>
              <div style={{ width: 16, height: 16 }}>{Icon.more()}</div>
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 36, zIndex: 20,
                background: C.bg2, border: `1px solid ${C.border}`,
                borderRadius: 10, minWidth: 200, padding: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {isOwner ? (
                  <>
                    <MenuItem icon="✏️" label="Edit Post" onClick={() => { setEditing(true); setShowMenu(false); setEditText(post.text) }} />
                    <MenuItem icon={saved ? '🔖' : '📑'} label={saved ? 'Unsave Post' : 'Save Post'} onClick={toggleSave} />
                    <MenuItem icon={muted ? '🔔' : '🔕'} label={muted ? 'Unmute Notifications' : 'Mute Notifications'} onClick={toggleMute} />
                    <MenuItem icon="🔗" label="Copy Link" onClick={() => {
                      navigator.clipboard.writeText('https://ring-in.vercel.app/post/' + post.id)
                      setShowMenu(false)
                      setToast({ msg: '🔗 Link copied!' })
                      setTimeout(() => setToast(null), 2000)
                    }} />
                    <MenuItem icon="🗑️" label="Delete Post" red onClick={() => { setShowMenu(false); onDelete() }} />
                  </>
                ) : (
                  <>
                    <MenuItem icon={saved ? '✓' : '🔖'} label={saved ? 'Unsave Post' : 'Save Post'} onClick={toggleSave} />
                    <MenuItem icon={muted ? '🔔' : '🔕'} label={muted ? 'Unmute Notifications' : 'Mute Notifications'} onClick={toggleMute} />
                    <MenuItem icon="🔗" label="Copy Link" onClick={() => {
                      navigator.clipboard.writeText('https://ring-in.vercel.app/post/' + post.id)
                      setShowMenu(false)
                      setToast({ msg: '🔗 Link copied!' })
                      setTimeout(() => setToast(null), 2000)
                    }} />
                    <MenuItem icon="🚫" label="Not Interested" onClick={() => {
                      setShowMenu(false)
                      setHidden(true)
                    }} />
                    <MenuItem icon="🚩" label="Report" red onClick={() => {
                      setShowMenu(false)
                      setToast({ msg: '🚩 Reported. Thanks for keeping RingIn safe.' })
                      setTimeout(() => setToast(null), 3000)
                    }} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Text */}
        {editing ? (
          <div style={{ marginBottom: 10 }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              style={{
                width: '100%', minHeight: 80, background: C.bg3, border: `1px solid ${C.ac}`,
                borderRadius: 8, padding: 12, color: C.text, fontSize: 14,
                outline: 'none', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setEditing(false)} style={{
                padding: '6px 14px', borderRadius: 8,
                background: C.bg4, border: `1px solid ${C.border}`, color: C.text,
                fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={submitEdit} style={{
                padding: '6px 14px', borderRadius: 8,
                background: C.ac, border: 'none', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Save</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 15, lineHeight: 1.55, color: C.text, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
            {post.text}
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {post.tags.map(t => (
              <span key={t} style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                borderRadius: 20, background: C.acg, color: C.ac,
              }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Image carousel */}
        {allImages.length > 0 && (
          <div style={{ margin: '0 -16px 10px', position: 'relative', background: C.bg3 }}>
            <img src={allImages[carouselIdx]} alt="" style={{ width: '100%', maxHeight: 520, objectFit: 'cover', display: 'block' }} />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setCarouselIdx(i => Math.max(0, i - 1))} disabled={carouselIdx === 0} style={carouselBtn('left')}>‹</button>
                <button onClick={() => setCarouselIdx(i => Math.min(allImages.length - 1, i + 1))} disabled={carouselIdx === allImages.length - 1} style={carouselBtn('right')}>›</button>
                <div style={{
                  position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: 4,
                }}>
                  {allImages.map((_, i) => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: i === carouselIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                    }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Video */}
        {post.video_url && (
          <div style={{ margin: '0 -16px 10px', background: C.bg3 }}>
            <video src={post.video_url} controls style={{ width: '100%', maxHeight: 520 }} />
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 12, color: C.t2, padding: '8px 0', borderBottom: `1px solid ${C.border}`,
        }}>
          <div
            onClick={() => post.likes > 0 && onShowLikers && onShowLikers(post)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: post.likes > 0 ? 'pointer' : 'default' }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%', background: C.grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
            }}>❤</span>
            <span>{(post.likes || 0).toLocaleString()}</span>
          </div>
          <div onClick={() => setShowComments(v => !v)} style={{ cursor: 'pointer' }}>
            {post.comments || 0} comments
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', borderTop: `1px solid ${C.border}`, padding: '4px 16px 6px' }}>
        <PostAction icon="heart" label="Like" active={post.liked} onClick={onLike} fillIcon={post.liked} activeColor={C.pink} />
        <PostAction icon="comment" label="Comment" onClick={() => setShowComments(v => !v)} />
        <PostAction icon="send" label="Message" onClick={handleMessage} />
        <PostAction icon="share" label="Share" onClick={sharePost} />
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ padding: '0 16px 12px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0' }}>
            <Avatar user={currentUser} size={32} />
            <input
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitComment() }}
              style={{
                flex: 1, background: C.bg3, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: '8px 14px', color: C.text,
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={submitComment} disabled={!commentText.trim()} style={{
              padding: '6px 14px', borderRadius: 18,
              background: commentText.trim() ? C.ac : C.bg4,
              color: '#fff', fontSize: 12, fontWeight: 700, border: 'none',
              cursor: commentText.trim() ? 'pointer' : 'default',
            }}>Send</button>
          </div>

          {(comments || []).map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
              <div onClick={() => onViewUser && onViewUser({ id: c.user_id, name: c.user_name, img: c.user_avatar })} style={{ cursor: 'pointer' }}>
                <Avatar user={{ id: c.user_id, name: c.user_name, img: c.user_avatar }} size={32} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  background: C.bg3, borderRadius: 16, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, cursor: 'pointer' }}
                    onClick={() => onViewUser && onViewUser({ id: c.user_id, name: c.user_name, img: c.user_avatar })}
                  >
                    {c.user_name}
                  </div>
                  <div style={{ fontSize: 13, color: C.text }}>{c.text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}

function carouselBtn(side) {
  return {
    position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
    borderRadius: '50%', width: 36, height: 36, fontSize: 22, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function PostAction({ icon, label, onClick, active, fillIcon, activeColor }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 10, borderRadius: 8,
      background: 'none', border: 'none', color: active ? activeColor : C.t2,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = C.bg3; e.currentTarget.style.color = C.text } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.t2 } }}
    >
      <div style={{ width: 18, height: 18 }}>
        {icon === 'heart' ? Icon.heart(fillIcon) : Icon[icon]()}
      </div>
      <span>{label}</span>
    </button>
  )
}

function MenuItem({ icon, label, onClick, red }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      borderRadius: 6, fontSize: 13, color: red ? C.red : C.text, cursor: 'pointer',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}
