'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '../lib/icons'
import Avatar from '../components/Avatar'
import { LeftRail, RightRail } from '../components/Sidebars'
import { useFollow } from '../lib/useFollow'
import { sb } from '../lib/supabase'
import { uploadChatImage, timeAgo } from '../lib/storage'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  amber: '#F5A623', red: '#EF4747', pink: '#E84D9A', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function MessagesScreen({ user, session, initConvo, onConvoConsumed, onUnreadCount, onViewUser, onGoToTab, onCallExpert }) {
  const [convos, setConvos] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchRes, setSearchRes] = useState([])
  const [showNew, setShowNew] = useState(false)

  const userId = session?.user?.id
  const { following, toggleFollow } = useFollow(sb, userId)

  // Load conversations
  useEffect(() => {
    if (!userId) return

    // Cache load
    try {
      const cached = localStorage.getItem('convos_' + userId)
      if (cached) {
        const arr = JSON.parse(cached)
        if (Array.isArray(arr)) setConvos(arr)
      }
    } catch (e) {}

    refreshConvos()

    // Realtime - new messages
    const ch = sb.channel('inbox-' + userId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'receiver_id=eq.' + userId,
      }, () => {
        refreshConvos()
      })
      .subscribe()

    return () => { sb.removeChannel(ch) }
  }, [userId])

  // Handle initConvo
  useEffect(() => {
    if (initConvo) {
      setActive(initConvo)
      onConvoConsumed && onConvoConsumed()
    }
  }, [initConvo])

  const refreshConvos = async () => {
    if (!userId) return
    const { data, error } = await sb.from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Messages] Error:', error.message)
      setLoading(false)
      return
    }

    if (!data) { setLoading(false); return }

    // Group by conversation_id
    const groups = {}
    data.forEach(m => {
      if (!groups[m.conversation_id]) groups[m.conversation_id] = m
    })

    const otherIds = []
    Object.values(groups).forEach(m => {
      const other = m.sender_id === userId ? m.receiver_id : m.sender_id
      if (other && !otherIds.includes(other)) otherIds.push(other)
    })

    let profiles = {}
    if (otherIds.length > 0) {
      const { data: pd } = await sb.from('profiles')
        .select('id, full_name, email, avatar_url, is_online, bio')
        .in('id', otherIds)
      if (pd) pd.forEach(p => { profiles[p.id] = p })
    }

    // Also build name + avatar lookup from messages (fallback if profile missing)
    const nameLookup = {}
    const avatarLookup = {}
    data.forEach(m => {
      if (m.sender_id && m.sender_name && !nameLookup[m.sender_id]) {
        nameLookup[m.sender_id] = m.sender_name
      }
      if (m.sender_id && m.sender_avatar && !avatarLookup[m.sender_id]) {
        avatarLookup[m.sender_id] = m.sender_avatar
      }
    })

    // Compute unread per conversation
    const unreadByConv = {}
    data.forEach(m => {
      if (m.receiver_id === userId && !m.read) {
        unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1
      }
    })

    const newConvos = Object.entries(groups).map(([cid, msg]) => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
      const profile = profiles[otherId] || {}
      let bioJson = {}
      try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}

      // Use multiple fallbacks for name
      const name = profile.full_name
        || profile.email?.split('@')[0]
        || nameLookup[otherId]
        || 'User'

      // Avatar fallback chain: DB column → bio JSON → message field → deterministic storage URL
      const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${otherId}.jpg`
      const img = profile.avatar_url || bioJson.avatar_url || avatarLookup[otherId] || storageUrl

      return {
        id: cid, convId: cid,
        user: {
          id: otherId,
          name,
          img,
          online: profile.is_online,
        },
        preview: msg.text,
        time: timeAgo(msg.created_at),
        lastTime: msg.created_at,
        unread: unreadByConv[cid] || 0,
      }
    })

    // Filter out blocked users
    let blocked = []
    try { blocked = JSON.parse(localStorage.getItem('ringin_blocked') || '[]') } catch (e) {}
    const visibleConvos = newConvos.filter(c => !blocked.includes(c.user?.id))

    visibleConvos.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime))
    setConvos(visibleConvos)
    try { localStorage.setItem('convos_' + userId, JSON.stringify(visibleConvos)) } catch (e) {}

    const total = visibleConvos.reduce((s, c) => s + (c.unread || 0), 0)
    onUnreadCount && onUnreadCount(total)
    setLoading(false)
  }

  // Search users
  useEffect(() => {
    if (!search.trim()) { setSearchRes([]); return }
    const t = setTimeout(async () => {
      const { data } = await sb.from('profiles')
        .select('id, full_name, email, avatar_url, is_online')
        .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
        .limit(10)
      if (data) setSearchRes(data.filter(p => p.id !== userId))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const startConvo = (targetUser) => {
    const convId = [userId, targetUser.id].sort().join('_')
    setActive({
      id: convId, convId,
      user: {
        id: targetUser.id,
        name: targetUser.full_name || targetUser.email?.split('@')[0],
        img: targetUser.avatar_url,
        online: targetUser.is_online,
      },
    })
    setShowNew(false)
    setSearch('')
  }

  return (
    <div className="ringin-page">
      <div className="left-rail">
        <LeftRail user={user} onGoToTab={onGoToTab} />
      </div>

      <main className="ringin-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700 }}>Messages</h1>
        <button onClick={() => setShowNew(true)} style={{
          padding: '10px 16px', borderRadius: 10,
          background: C.ac, color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ New Message</button>
      </div>

      {loading && <SkeletonInbox />}

      {!loading && convos.length === 0 && (
        <div style={{ ...card(), padding: 40, textAlign: 'center', color: C.t2 }}>
          No conversations yet. Click "New Message" to start one!
        </div>
      )}

      <div style={{ ...card() }}>
        {convos.map((c, i) => (
          <div
            key={c.id}
            onClick={() => setActive(c)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 14, cursor: 'pointer',
              borderBottom: i < convos.length - 1 ? `1px solid ${C.border}` : 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Avatar user={c.user} size={48} showOnline />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: c.unread > 0 ? 700 : 600, color: C.text }}>{c.user?.name || 'User'}</div>
                <div style={{ fontSize: 11, color: C.t3 }}>{c.time}</div>
              </div>
              <div style={{
                fontSize: 13, color: c.unread > 0 ? C.text : C.t2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontWeight: c.unread > 0 ? 600 : 400,
              }}>
                {c.preview && c.preview.startsWith('[img]') ? '📷 Photo' : c.preview}
              </div>
            </div>
            {c.unread > 0 && (
              <div style={{
                background: C.red, color: '#fff', borderRadius: 12,
                minWidth: 22, height: 22, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 6px',
              }}>{c.unread > 9 ? '9+' : c.unread}</div>
            )}
          </div>
        ))}
      </div>

      {/* New Message Modal */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', zIndex: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, background: C.bg2,
            border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 18, height: 18, color: C.t3 }}>{Icon.search()}</div>
              <input
                autoFocus
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14 }}
              />
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {searchRes.map(u => (
                <div key={u.id} onClick={() => startConvo(u)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, cursor: 'pointer',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar user={{ name: u.full_name || u.email, img: u.avatar_url }} size={36} showOnline={u.is_online} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name || u.email?.split('@')[0]}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>{u.email}</div>
                  </div>
                </div>
              ))}
              {search && searchRes.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 13 }}>No users found</div>
              )}
            </div>
          </div>
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

      {/* Floating chat popup (bottom-right, LinkedIn/FB style) */}
      {active && (
        <ChatPopup
          convo={active}
          session={session}
          currentUser={user}
          onClose={() => { setActive(null); refreshConvos() }}
          onViewUser={onViewUser}
        />
      )}
    </div>
  )
}

function SkeletonInbox() {
  return (
    <div style={{ ...card() }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: 14,
          borderBottom: i < 3 ? `1px solid ${C.border}` : 'none',
        }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.bg3 }} className="blink" />
          <div style={{ flex: 1 }}>
            <div style={{ width: '60%', height: 14, background: C.bg3, borderRadius: 4, marginBottom: 8 }} className="blink" />
            <div style={{ width: '90%', height: 12, background: C.bg3, borderRadius: 4 }} className="blink" />
          </div>
        </div>
      ))}
    </div>
  )
}

function card() {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14 }
}

// ============ CHAT POPUP (floating bottom-right LinkedIn/FB style) ============
function ChatPopup({ convo, session, currentUser, onClose, onViewUser }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [longPressMsg, setLongPressMsg] = useState(null)
  const [sending, setSending] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const longPressTimer = useRef(null)
  const userId = session?.user?.id

  const convId = convo.convId || convo.id
  const otherId = convo.user?.id

  // Load messages + cache
  useEffect(() => {
    if (!convId) return

    // Cache
    try {
      const cached = localStorage.getItem('msgs_' + convId)
      if (cached) {
        const arr = JSON.parse(cached)
        if (Array.isArray(arr)) setMsgs(arr)
      }
    } catch (e) {}

    sb.from('messages').select('*').eq('conversation_id', convId).order('created_at').then(({ data }) => {
      if (data) {
        setMsgs(data)
        try { localStorage.setItem('msgs_' + convId, JSON.stringify(data)) } catch (e) {}
      }
    })

    // Mark unread as read + update local state for ✓✓
    sb.from('messages').update({ read: true }).eq('conversation_id', convId).neq('sender_id', userId).then(() => {
      setMsgs(prev => prev.map(m => m.sender_id !== userId ? { ...m, read: true } : m))
    })

    // Realtime — use unique channel name to prevent collisions
    const channelName = 'chat-' + convId + '-' + Math.random().toString(36).slice(2, 8)
    const ch = sb.channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, (p) => {
        setMsgs(prev => {
          if (prev.find(m => m.id === p.new.id)) return prev
          return [...prev, p.new]
        })
        // Mark received as read
        if (p.new.sender_id !== userId) {
          sb.from('messages').update({ read: true }).eq('id', p.new.id).then(() => {})
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, (p) => {
        setMsgs(prev => prev.filter(m => m.id !== p.old.id))
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, (p) => {
        setMsgs(prev => prev.map(m => m.id === p.new.id ? { ...m, ...p.new } : m))
      })
      .subscribe()

    return () => { sb.removeChannel(ch) }
  }, [convId, userId])

  // Auto-scroll — depend on last msg id (covers optimistic → real swap)
  const lastMsgId = msgs.length > 0 ? msgs[msgs.length - 1].id : null
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [msgs.length, lastMsgId])

  const send = async () => {
    if (!text.trim() || sending) return
    const tempId = 'tmp_' + Date.now()
    const optimistic = {
      id: tempId, conversation_id: convId,
      sender_id: userId, sender_name: currentUser.name,
      receiver_id: otherId, text: text.trim(),
      read: false, created_at: new Date().toISOString(),
    }
    setMsgs(prev => [...prev, optimistic])
    setText('')
    setSending(true)

    const { data, error } = await sb.from('messages').insert([{
      conversation_id: convId, sender_id: userId, sender_name: currentUser.name,
      receiver_id: otherId, text: optimistic.text, read: false,
    }]).select()

    if (error) {
      alert('Failed: ' + error.message)
      setMsgs(prev => prev.filter(m => m.id !== tempId))
    } else if (data?.[0]) {
      setMsgs(prev => prev.map(m => m.id === tempId ? data[0] : m))
    }
    setSending(false)
  }

  const sendImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSending(true)
    try {
      const url = await uploadChatImage(file)
      if (!url) throw new Error('Upload returned no URL')
      const { error } = await sb.from('messages').insert([{
        conversation_id: convId, sender_id: userId, sender_name: currentUser.name,
        receiver_id: otherId, text: '[img]' + url, read: false,
      }])
      if (error) throw error
    } catch (err) {
      alert('Failed to send image: ' + (err.message || err))
    } finally {
      setSending(false)
      e.target.value = ''
    }
  }

  const unsendMsg = async (msgId) => {
    setMsgs(prev => prev.filter(m => m.id !== msgId))
    setLongPressMsg(null)
    await sb.from('messages').delete().eq('id', msgId)
  }

  const clearAllMessages = async () => {
    if (!confirm('Clear all messages? This cannot be undone.')) return
    setMsgs([])
    setShowMenu(false)
    // Clear msgs cache too
    try { localStorage.removeItem('msgs_' + convId) } catch (e) {}
    await sb.from('messages').delete().eq('conversation_id', convId)
    // Close popup so inbox refreshes via parent's onClose
    onClose()
  }

  const blockUser = async () => {
    if (!confirm(`Block ${convo.user?.name || 'User'}?`)) return
    setShowMenu(false)
    await sb.from('blocked_users').upsert({ blocker_id: userId, blocked_id: otherId }).then(() => {})
    try {
      const blocked = JSON.parse(localStorage.getItem('ringin_blocked') || '[]')
      if (!blocked.includes(otherId)) {
        blocked.push(otherId)
        localStorage.setItem('ringin_blocked', JSON.stringify(blocked))
      }
      // Also remove conversation messages cache + convos cache to hide from inbox
      localStorage.removeItem('msgs_' + convId)
    } catch (e) {}
    onClose()
  }

  const handleLongPress = (msg) => {
    if (msg.sender_id !== userId) return
    longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500)
  }
  const cancelLongPress = () => clearTimeout(longPressTimer.current)

  // Minimized — show small bar at bottom right
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 0, right: 20, zIndex: 150,
          width: 'min(280px, calc(100vw - 40px))', background: C.bg2,
          border: `1px solid ${C.border}`, borderBottom: 'none',
          borderRadius: '14px 14px 0 0', cursor: 'pointer',
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <Avatar user={convo.user} size={32} showOnline />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {convo.user?.name || 'User'}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          style={{
            background: 'none', border: 'none', color: C.t2, fontSize: 18,
            cursor: 'pointer', padding: 4,
          }}
        >×</button>
      </div>
    )
  }

  return (
    <div className="chat-popup" style={{
      position: 'fixed', bottom: 0, right: 20, zIndex: 150,
      width: 'min(360px, calc(100vw - 40px))', height: 'min(520px, calc(100vh - 80px))',
      maxHeight: 'calc(100vh - 80px)',
      display: 'flex', flexDirection: 'column',
      background: C.bg2, border: `1px solid ${C.border}`, borderBottom: 'none',
      borderRadius: '14px 14px 0 0',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', background: 'rgba(123,110,255,0.08)',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div onClick={() => onViewUser && onViewUser(convo.user)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}>
          <Avatar user={convo.user} size={36} showOnline />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {convo.user?.name || 'User'}
            </div>
            <div style={{ fontSize: 10, color: convo.user?.online ? C.green : C.t3 }}>
              {convo.user?.online ? '● Online' : 'Offline'}
            </div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t2, padding: 6 }}>
            <div style={{ width: 16, height: 16 }}>{Icon.more()}</div>
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 32, zIndex: 20,
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 10, minWidth: 160, padding: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <MenuItem icon="🗑️" label="Clear Chat" onClick={clearAllMessages} />
              <MenuItem icon="🚫" label="Block User" red onClick={blockUser} />
            </div>
          )}
        </div>
        <button
          onClick={() => setMinimized(true)}
          title="Minimize"
          style={{
            background: 'none', border: 'none', color: C.t2, fontSize: 18,
            cursor: 'pointer', padding: 6,
          }}
        >−</button>
        <button
          onClick={onClose}
          title="Close"
          style={{
            background: 'none', border: 'none', color: C.t2, fontSize: 20,
            cursor: 'pointer', padding: 6, lineHeight: 1,
          }}
        >×</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto',
        background: C.bg, padding: 12,
      }}>
        {msgs.length === 0 && <div style={{ textAlign: 'center', color: C.t2, padding: 40 }}>No messages yet. Say hi!</div>}
        {msgs.map((m, i) => {
          const isMe = m.sender_id === userId
          const isImg = m.text && m.text.startsWith('[img]')
          return (
            <div key={m.id} style={{
              display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
              marginBottom: 8, gap: 8, alignItems: 'flex-end',
            }}>
              {!isMe && <Avatar user={convo.user} size={28} />}
              <div
                onMouseDown={() => handleLongPress(m)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                style={{
                  maxWidth: '70%', padding: isImg ? 0 : '10px 14px',
                  borderRadius: 16, background: isMe ? C.ac : C.bg3,
                  color: '#fff', position: 'relative', cursor: isMe ? 'pointer' : 'default',
                  overflow: 'hidden',
                }}
              >
                {isImg ? (
                  <img src={m.text.slice(5)} alt="" style={{ maxWidth: 280, display: 'block' }} />
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                )}
                {isMe && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, padding: isImg ? '4px 8px' : 0, textAlign: 'right' }}>
                    {m.read ? '✓✓' : '✓'} {timeAgo(m.created_at)}
                  </div>
                )}
                {longPressMsg?.id === m.id && (
                  <div style={{
                    position: 'absolute', top: -36, right: 0,
                    background: C.bg2, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                    fontSize: 12, color: C.red, fontWeight: 700,
                  }} onClick={() => unsendMsg(m.id)}>Unsend</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: 10, background: C.bg2,
        borderTop: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={sendImage} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: C.t2, padding: 6,
        }}>
          <div style={{ width: 20, height: 20 }}>{Icon.image()}</div>
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Type a message..."
          style={{
            flex: 1, padding: '8px 14px', borderRadius: 20,
            background: C.bg3, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={send} disabled={!text.trim() || sending} style={{
          padding: 8, borderRadius: '50%',
          background: text.trim() && !sending ? C.ac : C.bg4,
          color: '#fff', border: 'none', cursor: 'pointer',
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 16, height: 16 }}>{Icon.send()}</div>
        </button>
      </div>
    </div>
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
