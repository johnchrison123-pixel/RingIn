'use client'

import { useState, useEffect } from 'react'
import { Icon } from '../lib/icons'
import Avatar, { VerifiedBadge } from '../components/Avatar'
import { sb } from '../lib/supabase'
import { useFollow } from '../lib/useFollow'
import { EXPERTS, CATEGORIES } from '../lib/mockData'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', ac2: '#5d50e0', acg: 'rgba(123,110,255,.14)',
  amber: '#F5A623', red: '#EF4747', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function ExpertsScreen({ user, session, onCallExpert, onViewUser, onGoToMessages, onGoToTab }) {
  const [experts, setExperts] = useState(EXPERTS)
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState('relevant')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [maxRate, setMaxRate] = useState(200)

  const userId = session?.user?.id
  const { following, toggleFollow } = useFollow(sb, userId)

  // Debounce search to prevent re-render storm
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Load real users from Supabase as experts (with cleanup)
  useEffect(() => {
    let ignore = false
    sb.from('profiles')
      .select('id, full_name, email, avatar_url, is_online, bio')
      .limit(30)
      .then(({ data }) => {
        if (ignore) return
        if (data && data.length > 0) {
          const real = data.map((p, i) => {
            let bioJson = {}
            try { bioJson = JSON.parse(p.bio || '{}') } catch (e) {}
            return {
              id: p.id,
              name: p.full_name || p.email?.split('@')[0] || 'User',
              role: bioJson.tag || 'Member',
              loc: 'Online',
              bio: bioJson.about || '',
              tags: ['Expert'],
              rate: [50, 60, 80, 90, 110, 120][i % 6],
              rating: 4.5 + Math.random() * 0.4,
              calls: Math.floor(Math.random() * 500) + 50,
              followers: '1.2k',
              img: p.avatar_url,
              online: p.is_online,
              verified: false,
              cat: ['health', 'tech', 'career', 'design', 'business'][i % 5],
              cover: 'linear-gradient(135deg,#0a0a2e,#534AB7)',
            }
          })
          // Mix mock experts with real users
          setExperts([...EXPERTS, ...real])
        }
      })
    return () => { ignore = true }
  }, [])

  // Auth-checked call handler
  const handleCallClick = (expert) => {
    if (!session) {
      alert('Please log in to call experts')
      return
    }
    onCallExpert && onCallExpert(expert)
  }

  let list = experts
  if (cat !== 'all') list = list.filter(e => e.cat === cat)
  if (onlineOnly) list = list.filter(e => e.online)
  if (maxRate < 200) list = list.filter(e => e.rate <= maxRate)
  if (debouncedSearch) {
    const s = debouncedSearch.toLowerCase()
    list = list.filter(e =>
      (e.name || '').toLowerCase().includes(s) ||
      (e.role || '').toLowerCase().includes(s) ||
      (e.tags || []).some(t => t.toLowerCase().includes(s))
    )
  }

  if (sort === 'rating') list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else if (sort === 'cheapest') list = [...list].sort((a, b) => (a.rate || 0) - (b.rate || 0))
  else if (sort === 'online') list = [...list].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))

  return (
    <div className="experts-page" style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Header */}
      <div className="experts-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="brand-grad" style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800 }}>Experts</h1>
          <p style={{ fontSize: 14, color: C.t2, marginTop: 4 }}>Connect with verified specialists. Pay per minute, on-demand.</p>
        </div>
        <div className="experts-search-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Search experts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: C.bg3, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 13, outline: 'none', width: 240, maxWidth: '100%',
            }}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{
            padding: '8px 12px', borderRadius: 10,
            background: C.bg4, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, cursor: 'pointer',
          }}>
            <option value="relevant">Most relevant</option>
            <option value="rating">Top rated</option>
            <option value="cheapest">Cheapest</option>
            <option value="online">Online now</option>
          </select>
        </div>
      </div>

      <div className="experts-grid-container" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Sidebar */}
        <aside style={{ position: 'sticky', top: 84, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={catGroupHeader}>Category</div>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10,
              fontSize: 13, fontWeight: 500, width: '100%',
              border: cat === c.id ? `1px solid ${C.ac}` : '1px solid transparent',
              background: cat === c.id ? C.acg : 'transparent',
              color: cat === c.id ? C.ac : C.text,
              cursor: 'pointer',
            }}
              onMouseEnter={(e) => { if (cat !== c.id) e.currentTarget.style.background = C.bg3 }}
              onMouseLeave={(e) => { if (cat !== c.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}

          <div style={catGroupHeader}>Availability</div>
          <button onClick={() => setOnlineOnly(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 10,
            fontSize: 13, fontWeight: 500, width: '100%',
            border: onlineOnly ? `1px solid ${C.ac}` : '1px solid transparent',
            background: onlineOnly ? C.acg : 'transparent',
            color: onlineOnly ? C.ac : C.text,
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 18 }}>🟢</span>
            <span>Online now</span>
          </button>

          <div style={catGroupHeader}>Price (coins/min)</div>
          <div style={{ padding: '0 12px' }}>
            <input
              type="range" min="0" max="200" value={maxRate}
              onChange={(e) => setMaxRate(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 11, color: C.t2, textAlign: 'center', marginTop: 4 }}>Up to {maxRate} 🪙/min</div>
          </div>
        </aside>

        {/* Grid */}
        <div className="experts-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {list.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: C.t2, ...card() }}>
              No experts match your filters.
            </div>
          )}
          {list.map(e => (
            <div key={e.id} onClick={() => onViewUser && onViewUser(e)} style={{
              ...card(), overflow: 'hidden', cursor: 'pointer',
              transition: 'transform 0.2s, border-color 0.2s',
            }}
              onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = C.ac; ev.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = C.border; ev.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ height: 80, background: e.cover || C.grad }} />
              <div style={{ padding: '0 16px 16px', marginTop: -32 }}>
                <Avatar user={e} size={64} showOnline />
                <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {e.name} {e.verified && <VerifiedBadge />}
                </div>
                <div style={{ fontSize: 12, color: C.t2, marginBottom: 6 }}>{e.role}{e.loc ? ' · ' + e.loc : ''}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.t2, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ color: C.amber, fontWeight: 700 }}>{e.rate} 🪙/min</span>
                  <span>·</span>
                  <span style={{ color: C.text }}>★ {(e.rating || 0).toFixed(1)}</span>
                  <span>·</span>
                  <span>{e.calls} calls</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12, minHeight: 22 }}>
                  {(e.tags || []).slice(0, 3).map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: C.bg4, color: C.t2,
                    }}>{t}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={(ev) => { ev.stopPropagation(); handleCallClick(e) }}
                    style={btnPri()}
                  >
                    <div style={{ width: 14, height: 14 }}>{Icon.phone()}</div>
                    Call
                  </button>
                  <button
                    onClick={(ev) => { ev.stopPropagation(); toggleFollow(e.id, e.name, e.img, e.role) }}
                    style={following[e.id] ? btnOut() : btnSec()}
                  >{following[e.id] ? '✓' : '+'} Follow</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const catGroupHeader = {
  fontSize: 11, fontWeight: 700, color: C.t3,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  margin: '14px 4px 6px',
}

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}

function btnPri() {
  return {
    flex: 1, padding: '8px 14px', borderRadius: 8,
    background: C.ac, color: '#fff', border: 'none',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }
}
function btnSec() {
  return {
    flex: 1, padding: '8px 14px', borderRadius: 8,
    background: C.bg4, border: `1px solid ${C.border}`, color: C.text,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}
function btnOut() {
  return {
    flex: 1, padding: '8px 14px', borderRadius: 8,
    background: C.acg, border: `1px solid ${C.ac}`, color: C.ac,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}
