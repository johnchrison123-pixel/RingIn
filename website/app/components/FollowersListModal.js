'use client'

import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { sb } from '../lib/supabase'

const C = {
  bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  red: '#EF4747',
}

export default function FollowersListModal({ userId, type, onClose, onViewUser, currentUserId, following = {}, toggleFollow }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const loadList = async () => {
      // type='followers' = people who follow userId (their follower_id is what we want)
      // type='following' = people userId follows (their following_id is what we want)
      const column = type === 'followers' ? 'following_id' : 'follower_id'
      const otherColumn = type === 'followers' ? 'follower_id' : 'following_id'

      const { data: follows } = await sb.from('follows')
        .select('*')
        .eq(column, userId)

      if (!follows || follows.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      // Get the other user IDs
      const otherIds = follows.map(f => f[otherColumn]).filter(Boolean)
      if (otherIds.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      // Fetch their profiles
      const { data: profiles } = await sb.from('profiles')
        .select('id, full_name, email, avatar_url, is_online, bio')
        .in('id', otherIds)

      const mapped = (profiles || []).map(p => {
        let bioJson = {}
        try { bioJson = JSON.parse(p.bio || '{}') } catch (e) {}
        return {
          id: p.id,
          name: p.full_name || p.email?.split('@')[0] || 'User',
          email: p.email,
          img: p.avatar_url || bioJson.avatar_url || null,
          role: bioJson.tag || 'Member',
          online: p.is_online,
        }
      })
      setUsers(mapped)
      setLoading(false)
    }
    loadList()
  }, [userId, type])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, background: C.bg2,
          border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, textTransform: 'capitalize' }}>
            {type} {users.length > 0 && `(${users.length})`}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.t2, fontSize: 24, cursor: 'pointer',
          }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: C.t2 }}>Loading...</div>
          )}

          {!loading && users.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.t2 }}>
              {type === 'followers'
                ? 'No followers yet.'
                : 'Not following anyone yet.'}
            </div>
          )}

          {users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 14,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div onClick={() => { onViewUser && onViewUser(u); onClose() }} style={{ cursor: 'pointer' }}>
                <Avatar user={u} size={44} showOnline />
              </div>
              <div onClick={() => { onViewUser && onViewUser(u); onClose() }}
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{u.name}</div>
                <div style={{ fontSize: 12, color: C.t2 }}>{u.role}</div>
              </div>

              {currentUserId && currentUserId !== u.id && toggleFollow && (
                <button
                  onClick={() => toggleFollow(u.id, u.name, u.img, u.role)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: following[u.id] ? `1px solid ${C.ac}` : 'none',
                    background: following[u.id] ? C.acg : C.ac,
                    color: following[u.id] ? C.ac : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {following[u.id] ? '✓ Following' : '+ Follow'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
