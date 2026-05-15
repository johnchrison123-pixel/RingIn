'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  green: '#27C96A', amber: '#F5A623', red: '#EF4747',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

const ML_SERVICE_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000'

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [overview, setOverview] = useState(null)
  const [daily, setDaily] = useState(null)
  const [topPosts, setTopPosts] = useState(null)
  const [topFollowers, setTopFollowers] = useState(null)
  const [geography, setGeography] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Try saved key on mount
  useEffect(() => {
    const saved = localStorage.getItem('ringin_admin_key')
    if (saved) {
      setAdminKey(saved)
      verify(saved)
    }
  }, [])

  const verify = async (key) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${ML_SERVICE_URL}/api/analytics/overview`, {
        headers: { 'x-admin-key': key },
      })
      if (!r.ok) throw new Error('Invalid admin key')
      const data = await r.json()
      setOverview(data)
      setAuthenticated(true)
      localStorage.setItem('ringin_admin_key', key)
      loadAll(key)
    } catch (e) {
      setError(e.message)
      localStorage.removeItem('ringin_admin_key')
    }
    setLoading(false)
  }

  const loadAll = async (key) => {
    setLoading(true)
    const headers = { 'x-admin-key': key }
    const safeJson = async (url) => {
      try {
        const r = await fetch(url, { headers })
        if (!r.ok) {
          console.warn(`[Admin] ${url} returned ${r.status}`)
          return null
        }
        return await r.json()
      } catch (e) {
        console.warn(`[Admin] ${url} failed:`, e.message)
        return null
      }
    }
    const [overviewR, dailyR, topPostsR, topFollowersR, geoR, funnelR] = await Promise.all([
      safeJson(`${ML_SERVICE_URL}/api/analytics/overview`),
      safeJson(`${ML_SERVICE_URL}/api/analytics/daily-active?days=14`),
      safeJson(`${ML_SERVICE_URL}/api/analytics/top-users?by=posts&limit=10`),
      safeJson(`${ML_SERVICE_URL}/api/analytics/top-users?by=followers&limit=10`),
      safeJson(`${ML_SERVICE_URL}/api/analytics/geography`),
      safeJson(`${ML_SERVICE_URL}/api/analytics/funnel`),
    ])
    // Each tab independently set — partial failures don't crash the page
    if (overviewR) setOverview(overviewR)
    if (dailyR) setDaily(dailyR)
    if (topPostsR) setTopPosts(topPostsR)
    if (topFollowersR) setTopFollowers(topFollowersR)
    if (geoR) setGeography(geoR)
    if (funnelR) setFunnel(funnelR)
    // Show error if everything failed
    if (!overviewR && !dailyR && !topPostsR && !topFollowersR && !geoR && !funnelR) {
      setError('ML service unreachable. Check that Python service is running.')
    }
    setLoading(false)
  }

  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh', background: C.bg, color: C.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: 400, background: C.bg2,
          border: `1px solid ${C.border}`, borderRadius: 18, padding: 32,
        }}>
          <h1 className="brand-grad" style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>RingIn Admin</h1>
          <p style={{ color: C.t2, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>Enter your admin API key to continue</p>
          <input
            type="password"
            placeholder="Admin API key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verify(adminKey)}
            style={{
              width: '100%', padding: '12px 14px', background: C.bg3,
              border: `1px solid ${C.border}`, borderRadius: 10,
              color: C.text, fontSize: 14, outline: 'none', marginBottom: 12,
            }}
          />
          {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
          <button
            onClick={() => verify(adminKey)}
            disabled={loading || !adminKey}
            style={{
              width: '100%', padding: 12, borderRadius: 10,
              background: C.grad, color: '#fff', border: 'none',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              opacity: loading || !adminKey ? 0.5 : 1,
            }}
          >{loading ? 'Verifying...' : 'Sign In'}</button>
          <Link href="/" style={{
            display: 'block', textAlign: 'center', marginTop: 20,
            color: C.t3, fontSize: 12, textDecoration: 'none',
          }}>← Back to RingIn</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(17,17,23,0.85)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="brand-grad" style={{ fontSize: 22 }}>RingIn Admin</h1>
          <span style={{ fontSize: 11, color: C.green, padding: '4px 8px', borderRadius: 12, background: 'rgba(39,201,106,0.1)' }}>● LIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => loadAll(adminKey)}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: C.bg3, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 12, cursor: 'pointer',
            }}
          >{loading ? '⟳' : '↻'} Refresh</button>
          <button
            onClick={() => {
              localStorage.removeItem('ringin_admin_key')
              setAuthenticated(false)
              setAdminKey('')
            }}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(239,71,71,0.1)', border: `1px solid ${C.red}`,
              color: C.red, fontSize: 12, cursor: 'pointer',
            }}
          >Sign Out</button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{
        display: 'flex', gap: 4, padding: '0 24px', borderBottom: `1px solid ${C.border}`,
      }}>
        {['overview', 'users', 'content', 'geography', 'funnel'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '14px 20px', background: 'none', border: 'none',
              color: activeTab === t ? C.ac : C.t2, fontSize: 14, fontWeight: 700,
              borderBottom: activeTab === t ? `2px solid ${C.ac}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', textTransform: 'capitalize',
            }}
          >{t}</button>
        ))}
      </nav>

      <main style={{ padding: 24 }}>
        {activeTab === 'overview' && <OverviewTab overview={overview} daily={daily} />}
        {activeTab === 'users' && <UsersTab topPosts={topPosts} topFollowers={topFollowers} />}
        {activeTab === 'content' && <ContentTab overview={overview} daily={daily} />}
        {activeTab === 'geography' && <GeographyTab geography={geography} />}
        {activeTab === 'funnel' && <FunnelTab funnel={funnel} />}
      </main>
    </div>
  )
}

function OverviewTab({ overview, daily }) {
  if (!overview) return <Loading />
  const o = overview
  return (
    <>
      <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard label="Total Users" value={o.users?.total} subtitle={`+${o.users?.new_last_7d || 0} this week`} color={C.ac} />
        <KpiCard label="Online Now" value={o.users?.online_now} subtitle="Live users" color={C.green} />
        <KpiCard label="Total Posts" value={o.content?.total_posts} subtitle={`+${o.content?.new_posts_24h || 0} today`} color={C.amber} />
        <KpiCard label="Total Messages" value={o.engagement?.total_messages} subtitle={`+${o.engagement?.new_messages_24h || 0} today`} color="#E84D9A" />
        <KpiCard label="Total Comments" value={o.content?.total_comments} subtitle="All time" color="#42B3FF" />
      </div>

      {daily?.days && (
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Daily Active Users (Last 14 Days)</h3>
          <DailyChart data={daily.days} />
        </div>
      )}
    </>
  )
}

function UsersTab({ topPosts, topFollowers }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <RankList title="Top Posters" data={topPosts?.top} unit="posts" />
      <RankList title="Most Followed" data={topFollowers?.top} unit="followers" />
    </div>
  )
}

function ContentTab({ overview, daily }) {
  return (
    <>
      <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Content Activity</h2>
      {daily?.days && (
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Posts & Comments (Daily)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.t2 }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Active Users</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Posts</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Comments</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Messages</th>
              </tr>
            </thead>
            <tbody>
              {daily.days.map(d => (
                <tr key={d.date} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 8px' }}>{d.date}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.ac, fontWeight: 700 }}>{d.active_users}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{d.posts}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{d.comments}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{d.messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function GeographyTab({ geography }) {
  if (!geography) return <Loading />
  return (
    <>
      <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginBottom: 16 }}>User Geography</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <RankList title="Countries" data={geography.countries} unit="users" />
        <RankList title="States" data={geography.states} unit="users" />
        <RankList title="Cities" data={geography.cities} unit="users" />
      </div>
    </>
  )
}

function FunnelTab({ funnel }) {
  if (!funnel) return <Loading />
  return (
    <>
      <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Conversion Funnel</h2>
      <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
        {funnel.funnel?.map((step, i) => (
          <div key={step.step} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                {step.step.replace(/_/g, ' ')}
              </span>
              <span style={{ color: C.t2 }}>
                {step.users.toLocaleString()} users ({step.pct}%)
              </span>
            </div>
            <div style={{ height: 32, background: C.bg3, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', width: `${step.pct}%`, background: C.grad,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// === HELPERS ===

function KpiCard({ label, value, subtitle, color }) {
  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ fontSize: 12, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'Syne', fontSize: 36, fontWeight: 800, color: color || C.text }}>
        {(value || 0).toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{subtitle}</div>
    </div>
  )
}

function RankList({ title, data, unit }) {
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
      <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{title}</h3>
      {!data || data.length === 0 ? (
        <div style={{ color: C.t3, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No data</div>
      ) : (
        data.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: i < data.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: C.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.t2 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13 }}>{item.name || item.user_id}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ac }}>
              {(item.count || 0).toLocaleString()} {unit}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function DailyChart({ data }) {
  const max = Math.max(...data.map(d => d.active_users), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, color: C.t3 }}>{d.active_users}</div>
          <div style={{
            width: '100%', height: `${(d.active_users / max) * 170}px`,
            background: C.grad, borderRadius: 4, minHeight: 2,
          }} title={`${d.active_users} active users on ${d.date}`} />
          <div style={{ fontSize: 10, color: C.t3, transform: 'rotate(-45deg)', whiteSpace: 'nowrap', marginTop: 8 }}>
            {d.date.slice(5)}
          </div>
        </div>
      ))}
    </div>
  )
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: 60, color: C.t2 }}>Loading...</div>
}
