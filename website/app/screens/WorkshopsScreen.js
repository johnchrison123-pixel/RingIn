'use client'

import { useState } from 'react'
import { Icon } from '../lib/icons'
import Avatar from '../components/Avatar'
import { LeftRail, RightRail } from '../components/Sidebars'
import { useFollow } from '../lib/useFollow'
import { sb } from '../lib/supabase'
import { WORKSHOPS, EXPERTS } from '../lib/mockData'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', amber: '#F5A623',
  red: '#EF4747', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
  acg: 'rgba(123,110,255,.14)',
}

const ALL_WORKSHOPS = [
  ...WORKSHOPS,
  { id: 'w3', title: 'LinkedIn That Lands Interviews', host: EXPERTS[2], live: false, viewers: 0, cover: 'linear-gradient(135deg,#2e0a1f,#C84B8A)', startsIn: 'Tomorrow, 7:00 PM', duration: '75 min', level: 'Beginner', desc: 'Rewrite your headline, fix the about section, and learn the outreach template.' },
  { id: 'w4', title: 'Beginner Strength Training Walkthrough', host: EXPERTS[5], live: false, viewers: 0, cover: 'linear-gradient(135deg,#2e0a00,#E8401A)', startsIn: 'Sat, 10:00 AM', duration: '60 min', level: 'Beginner', desc: 'Learn the four foundational lifts.' },
  { id: 'w5', title: 'Index Funds vs ETFs Explained Simply', host: EXPERTS[6], live: false, viewers: 0, cover: 'linear-gradient(135deg,#0a2e2a,#0F766E)', startsIn: 'Sun, 6:00 PM', duration: '45 min', level: 'Beginner', desc: 'Cut through the jargon.' },
]

export default function WorkshopsScreen({
  user, session, onJoinWorkshop, onGoToTab, onViewUser, onCallExpert,
}) {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [joinedReminders, setJoinedReminders] = useState([])

  const handleJoinClick = (workshop) => {
    if (onJoinWorkshop) {
      onJoinWorkshop(workshop)
      return
    }
    if (workshop.live) {
      // Default: opens viewer/host profile
      alert(`Joining "${workshop.title}" — live workshop viewer coming soon!`)
      onViewUser && onViewUser(workshop.host)
    } else {
      // Set reminder
      setJoinedReminders(prev => [...new Set([...prev, workshop.id])])
      try {
        const key = 'workshop_reminders'
        const r = JSON.parse(localStorage.getItem(key) || '[]')
        if (!r.includes(workshop.id)) {
          r.push(workshop.id)
          localStorage.setItem(key, JSON.stringify(r))
        }
      } catch (e) {}
      alert(`🔔 Reminder set for "${workshop.title}"`)
    }
  }
  const userId = session?.user?.id
  const { following, toggleFollow } = useFollow(sb, userId)

  let list = ALL_WORKSHOPS
  if (filter === 'live') list = list.filter(w => w.live)
  if (filter === 'upcoming') list = list.filter(w => !w.live)

  // Detail view
  if (selected) {
    return (
      <div className="ringin-page">
        <div className="left-rail">
          <LeftRail user={user} onGoToTab={onGoToTab} />
        </div>
        <main className="ringin-main">
          <button onClick={() => setSelected(null)} style={btnBack()}>
            <div style={{ width: 16, height: 16 }}>{Icon.back()}</div> Back to Workshops
          </button>

          <div style={{ ...card(), overflow: 'hidden' }}>
            <div style={{ height: 220, background: selected.cover, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ fontSize: 64 }}>🎙</div>
              {selected.live && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: C.red, padding: '5px 11px', borderRadius: 16,
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} className="blink" />
                  LIVE · {selected.viewers.toLocaleString()} watching
                </div>
              )}
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar user={selected.host} size={44} />
                <div>
                  <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>{selected.title}</div>
                  <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>by {selected.host.name}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <DetailStat icon="⏱" label="Duration" value={selected.duration} />
                <DetailStat icon="📊" label="Level" value={selected.level} />
                <DetailStat icon="🕐" label="Starts" value={selected.startsIn} />
              </div>

              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 20 }}>{selected.desc}</p>

              <button onClick={() => handleJoinClick(selected)} style={{
                width: '100%', padding: 14, borderRadius: 10,
                background: selected.live ? C.grad : C.bg4,
                border: selected.live ? 'none' : `1px solid ${C.border}`,
                color: selected.live ? '#fff' : C.text,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                {selected.live
                  ? '🔴 Join Live'
                  : joinedReminders.includes(selected.id) ? '✓ Reminder Set' : '🔔 Set Reminder'}
              </button>
            </div>
          </div>
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

  // Grid view
  return (
    <div className="ringin-page">
      <div className="left-rail">
        <LeftRail user={user} onGoToTab={onGoToTab} />
      </div>

      <main className="ringin-main">
        <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Workshops</h1>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['all', 'live', 'upcoming'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 18,
              background: filter === f ? C.acg : C.bg3,
              border: `1px solid ${filter === f ? C.ac : C.border}`,
              color: filter === f ? C.ac : C.t2,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>

        {/* Grid — smaller compact cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {list.map(w => (
            <div
              key={w.id}
              onClick={() => setSelected(w)}
              style={{
                ...card(), overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.ac
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Smaller cover */}
              <div style={{
                height: 110, background: w.cover, position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 30 }}>🎙</div>
                {w.live && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: C.red, padding: '2px 7px', borderRadius: 10,
                    color: '#fff', fontSize: 9, fontWeight: 700,
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} className="blink" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Compact body */}
              <div style={{ padding: 12 }}>
                <div style={{
                  fontFamily: 'Syne', fontSize: 13, fontWeight: 700,
                  marginBottom: 6, lineHeight: 1.25,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  minHeight: 32,
                }}>{w.title}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Avatar user={w.host} size={20} />
                  <span style={{
                    fontSize: 11, color: C.t2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{w.host.name}</span>
                </div>

                <div style={{ fontSize: 10, color: C.t3 }}>
                  {w.live
                    ? `${w.viewers.toLocaleString()} watching`
                    : w.startsIn}
                </div>
              </div>
            </div>
          ))}
        </div>

        {list.length === 0 && (
          <div style={{ ...card(), padding: 40, textAlign: 'center', color: C.t2, marginTop: 12 }}>
            No {filter} workshops.
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

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}
function btnBack() {
  return {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    padding: '8px 14px', borderRadius: 10,
    background: C.bg3, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 13, cursor: 'pointer',
  }
}
function DetailStat({ icon, label, value }) {
  return (
    <div style={{ background: C.bg3, padding: '7px 11px', borderRadius: 8, fontSize: 11 }}>
      <span style={{ marginRight: 5 }}>{icon}</span>
      <span style={{ color: C.t3 }}>{label}: </span>
      <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
