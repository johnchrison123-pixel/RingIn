'use client'

import { useState, useEffect } from 'react'
import { Icon } from '../lib/icons'
import Avatar from './Avatar'
import { sb } from '../lib/supabase'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', red: '#EF4747', green: '#27C96A',
  grad: 'linear-gradient(135deg, #7B6EFF, #E84D9A)',
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'experts', label: 'Experts', icon: 'grid' },
  { id: 'workshops', label: 'Workshops', icon: 'play' },
  { id: 'messages', label: 'Messages', icon: 'msg' },
]

export default function TopNav({ activeTab, onTabChange, unreadMsg = 0, unreadNotif = 0, user, coins, onViewUser }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifications, setNotifications] = useState([])

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await sb.from('profiles')
        .select('id, full_name, email, avatar_url, is_online, bio')
        .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(8)
      if (data) {
        setSearchResults(data.map(p => ({
          id: p.id,
          name: p.full_name || p.email?.split('@')[0] || 'User',
          email: p.email,
          img: p.avatar_url,
          online: p.is_online,
        })))
      }
    }, 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Load notifications
  useEffect(() => {
    if (!user?.id) return
    sb.from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifications(data) })

    const ch = sb.channel('notifs-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.' + user.id,
      }, (p) => {
        setNotifications(prev => [p.new, ...prev])
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [user?.id])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleSelectSearchResult = (u) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    setSearchResults([])
    if (onViewUser) onViewUser(u)
  }
  return (
    <header className="topnav-header" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '60px',
      background: 'rgba(17, 17, 23, 0.85)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.border}`,
      display: 'grid', gridTemplateColumns: '1fr 2fr 1fr',
      alignItems: 'center', padding: '0 20px', gap: '20px',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={() => onTabChange('home')} style={{
          fontFamily: 'Syne', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px',
          background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', cursor: 'pointer',
        }}>RingIn</div>

        <div className="topnav-search" style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: C.bg3, border: `1px solid ${C.border}`,
            borderRadius: '24px', padding: '8px 14px', width: '280px',
          }}>
            <div style={{ width: 16, height: 16, color: C.t3 }}>{Icon.search()}</div>
            <input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true) }}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: C.text, fontSize: '14px', width: '100%', fontFamily: 'inherit',
              }}
            />
          </div>
          {showSearchDropdown && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: 50, left: 0,
              width: 320, background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              maxHeight: 400, overflowY: 'auto', zIndex: 100,
            }}>
              {searchResults.map(u => (
                <div
                  key={u.id}
                  onMouseDown={() => handleSelectSearchResult(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 10, cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar user={u} size={32} showOnline />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showSearchDropdown && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: 50, left: 0,
              width: 320, background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: 16, textAlign: 'center', color: C.t3, fontSize: 12,
              zIndex: 100,
            }}>No users found</div>
          )}
        </div>
      </div>

      {/* Center - Tab buttons (desktop only; mobile uses BottomNav) */}
      <nav className="topnav-center-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {TABS.map((tab) => (
          <span key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => onTabChange(tab.id)}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '96px', height: '44px', borderRadius: '10px',
                color: activeTab === tab.id ? C.ac : C.t2,
                transition: 'background 0.15s ease',
                cursor: 'pointer', background: 'none', border: 'none',
              }}
              onMouseEnter={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.background = C.bg3; e.currentTarget.style.color = C.text } }}
              onMouseLeave={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.t2 } }}
            >
              <div style={{ width: 22, height: 22 }}>{Icon[tab.icon](activeTab === tab.id)}</div>
              {tab.id === 'messages' && unreadMsg > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 24, background: C.red,
                  borderRadius: 20, minWidth: 16, height: 16, fontSize: 10,
                  fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: '0 4px',
                }}>{unreadMsg > 99 ? '99+' : unreadMsg}</span>
              )}
              {activeTab === tab.id && (
                <span style={{
                  content: '""', position: 'absolute', bottom: -9, left: 0, right: 0,
                  height: 3, background: C.ac, borderRadius: 2,
                }} />
              )}
            </button>

            {/* Insert orb between Experts and Workshops */}
            {tab.id === 'experts' && (
              <button
                onClick={() => onTabChange('connect')}
                title="Anonymous Connect"
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7B6EFF, #E84D9A)',
                  border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative', margin: '0 4px',
                  boxShadow: activeTab === 'connect'
                    ? '0 0 0 2px rgba(255,255,255,.18), 0 5px 18px rgba(232,77,154,.6)'
                    : '0 3px 10px rgba(232,77,154,.4), inset 0 1px 0 rgba(255,255,255,.2)',
                  transition: 'transform 0.15s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px) scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 5px 16px rgba(232,77,154,.55), inset 0 1px 0 rgba(255,255,255,.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = activeTab === 'connect'
                    ? '0 0 0 2px rgba(255,255,255,.18), 0 5px 18px rgba(232,77,154,.6)'
                    : '0 3px 10px rgba(232,77,154,.4), inset 0 1px 0 rgba(255,255,255,.2)'
                }}
              >
                <div style={{ width: 16, height: 16, color: '#fff' }}>{Icon.phone(true)}</div>
                <span style={{
                  position: 'absolute', top: 2, right: 2, width: 9, height: 9,
                  borderRadius: '50%', background: C.green, border: `2px solid ${C.bg}`,
                }} />
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
        {/* Wallet chip */}
        <button
          onClick={() => onTabChange('wallet')}
          title={`${(coins || 0).toLocaleString()} coins`}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: C.bg3, border: `1px solid ${C.border}`,
            borderRadius: '24px', padding: '7px 14px', fontSize: '13px',
            fontWeight: 600, color: C.text, cursor: 'pointer',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = C.ac}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
        >
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'linear-gradient(135deg, #F5A623, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#fff',
          }}>C</span>
          <span className="topnav-wallet-label">{(coins || 0).toLocaleString()}</span>
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={async () => {
              setShowNotif(v => !v)
              // Mark all as read when opening
              if (!showNotif && unreadCount > 0 && user?.id) {
                await sb.from('notifications').update({ read: true })
                  .eq('user_id', user.id).eq('read', false)
                setNotifications(prev => prev.map(n => ({ ...n, read: true })))
              }
            }}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: C.bg3, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.text, position: 'relative', cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.bg4}
            onMouseLeave={(e) => e.currentTarget.style.background = C.bg3}
          >
            <div style={{ width: 18, height: 18 }}>{Icon.bell()}</div>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, background: C.red,
                borderRadius: 20, minWidth: 16, height: 16, fontSize: 10,
                fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '0 4px',
              }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <>
              <div onClick={() => setShowNotif(false)} style={{
                position: 'fixed', inset: 0, zIndex: 90,
              }} />
              <div style={{
                position: 'absolute', right: 0, top: 50, zIndex: 100,
                width: 'min(360px, calc(100vw - 20px))', background: C.bg2, border: `1px solid ${C.border}`,
                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                maxHeight: 'min(480px, calc(100vh - 80px))', overflowY: 'auto',
              }}>
                <div style={{
                  padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
                  fontFamily: 'Syne', fontSize: 16, fontWeight: 700,
                }}>Notifications</div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 13 }}>
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{
                      display: 'flex', gap: 10, padding: 12,
                      borderBottom: `1px solid ${C.border}`,
                      cursor: 'pointer',
                      background: n.read ? 'transparent' : 'rgba(123,110,255,0.06)',
                    }}
                      onClick={() => {
                        if (n.from_user_id && onViewUser) {
                          onViewUser({ id: n.from_user_id, name: n.from_user_name, img: n.from_user_avatar })
                          setShowNotif(false)
                        }
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                      onMouseLeave={(e) => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(123,110,255,0.06)'}
                    >
                      <Avatar user={{ id: n.from_user_id, name: n.from_user_name, img: n.from_user_avatar }} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>
                          <b>{n.from_user_name || 'Someone'}</b> {n.text}
                        </div>
                        <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* User Avatar */}
        <button
          onClick={() => onTabChange('profile')}
          style={{
            padding: 0, overflow: 'hidden',
            width: 40, height: 40, borderRadius: '50%',
            background: C.bg3, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
          <Avatar user={user} size={40} />
        </button>
      </div>
    </header>
  )
}
