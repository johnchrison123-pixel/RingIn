/* Public workshops list — SSR for SEO */
import Link from 'next/link'
import { SITE_URL, SITE_NAME } from '../lib/supabaseServer'
import { WORKSHOPS as SHARED_WORKSHOPS } from '../lib/workshops'

export const metadata = {
  title: `Live Workshops & Masterclasses by Verified Experts | ${SITE_NAME}`,
  description: 'Join live workshops on tech, finance, mental health, fitness, and more. Learn directly from experts via video. Free and pro sessions available.',
  keywords: ['live workshops', 'online masterclass', 'expert workshops', 'video learning', 'live training'],
  alternates: { canonical: `${SITE_URL}/workshops` },
  openGraph: {
    title: `Live Workshops | ${SITE_NAME}`,
    description: 'Learn from experts in real-time video workshops',
    url: `${SITE_URL}/workshops`,
    siteName: SITE_NAME,
    type: 'website',
  },
}

const C = {
  bg: '#09090E', bg2: '#111117', text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', red: '#EF4747',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

// Use shared workshop data — single source of truth
const WORKSHOPS = SHARED_WORKSHOPS.map(w => ({
  id: w.id,
  title: w.title,
  host: w.host.name,
  live: w.live,
  viewers: w.viewers,
  cover: w.cover,
  desc: w.desc,
  startsIn: w.startsIn,
}))

export default function WorkshopsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: WORKSHOPS.map((w, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: w.title,
        description: w.desc,
        url: `${SITE_URL}/workshops/${w.id}`,
        eventStatus: w.live ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        organizer: { '@type': 'Person', name: w.host },
        location: { '@type': 'VirtualLocation', url: `${SITE_URL}/workshops/${w.id}` },
      },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        <PublicHeader />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontSize: 42, fontWeight: 800, marginBottom: 12 }}>
            Live Workshops & Masterclasses
          </h1>
          <p style={{ fontSize: 18, color: C.t2, marginBottom: 32, maxWidth: 720 }}>
            Learn from verified experts in real-time. Ask questions, get personalized answers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {WORKSHOPS.map(w => (
              <Link key={w.id} href={`/workshops/${w.id}`} style={{
                background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                overflow: 'hidden', textDecoration: 'none', color: C.text,
              }}>
                <div style={{
                  height: 160, background: w.cover, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
                }}>
                  🎙
                  {w.live && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: C.red, padding: '4px 10px', borderRadius: 14,
                      color: '#fff', fontSize: 10, fontWeight: 700,
                    }}>● LIVE</div>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  <h2 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
                    {w.title}
                  </h2>
                  <div style={{ fontSize: 12, color: C.t2 }}>by {w.host}</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                    {w.live ? `${w.viewers} watching` : w.startsIn}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </>
  )
}

function PublicHeader() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(17,17,23,0.85)', backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${C.border}`,
      padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href="/" style={{
        fontFamily: 'Syne', fontSize: 22, fontWeight: 800,
        background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        textDecoration: 'none',
      }}>RingIn</Link>
      <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Link href="/experts" style={{ fontSize: 14, color: C.text, textDecoration: 'none', fontWeight: 600 }}>Experts</Link>
        <Link href="/workshops" style={{ fontSize: 14, color: C.text, textDecoration: 'none', fontWeight: 600 }}>Workshops</Link>
        <Link href="/" style={{
          padding: '8px 18px', borderRadius: 8, background: C.grad,
          color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>Open App</Link>
      </nav>
    </header>
  )
}
