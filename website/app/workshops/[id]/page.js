/* Public workshop detail — SSR for SEO */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_URL, SITE_NAME } from '../../lib/supabaseServer'
import { WORKSHOPS as SHARED_WORKSHOPS, getWorkshopById } from '../../lib/workshops'

// Build flattened lookup for compat with existing code
const WORKSHOPS = SHARED_WORKSHOPS.reduce((acc, w) => {
  acc[w.id] = {
    id: w.id,
    title: w.title,
    host: w.host.name,
    live: w.live,
    viewers: w.viewers,
    cover: w.cover,
    desc: w.desc,
    duration: w.duration,
    level: w.level,
    startsIn: w.startsIn,
    startDateISO: w.startDateISO,
  }
  return acc
}, {})

const C = { bg: '#09090E', bg2: '#111117', text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A', border: '#28283A', ac: '#7B6EFF', red: '#EF4747', grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)' }

export async function generateMetadata({ params }) {
  const { id } = await params
  const w = WORKSHOPS[id]
  if (!w) return { title: 'Workshop not found' }
  return {
    title: `${w.title} — ${w.host} | ${SITE_NAME}`,
    description: w.desc,
    alternates: { canonical: `${SITE_URL}/workshops/${id}` },
    openGraph: {
      title: w.title,
      description: w.desc,
      url: `${SITE_URL}/workshops/${id}`,
      siteName: SITE_NAME,
      type: 'website',
    },
  }
}

export async function generateStaticParams() {
  return Object.keys(WORKSHOPS).map(id => ({ id }))
}

export default async function WorkshopPage({ params }) {
  const { id } = await params
  const w = WORKSHOPS[id]
  if (!w) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: w.title,
    description: w.desc,
    url: `${SITE_URL}/workshops/${id}`,
    startDate: w.startDateISO,
    eventStatus: w.live ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    organizer: { '@type': 'Person', name: w.host },
    location: { '@type': 'VirtualLocation', url: `${SITE_URL}/workshops/${id}` },
    offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', price: '0', priceCurrency: 'INR', url: `${SITE_URL}/workshops/${id}` },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        <PublicHeader />
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 80px' }}>
          <nav style={{ fontSize: 13, color: C.t2, marginBottom: 16 }}>
            <Link href="/workshops" style={{ color: C.ac, textDecoration: 'none' }}>← All Workshops</Link>
          </nav>

          <article style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ height: 280, background: w.cover, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ fontSize: 72 }}>🎙</div>
              {w.live && (
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: C.red, padding: '6px 12px', borderRadius: 16,
                  color: '#fff', fontSize: 12, fontWeight: 700,
                }}>
                  ● LIVE — {w.viewers} watching
                </div>
              )}
            </div>
            <div style={{ padding: 28 }}>
              <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                {w.title}
              </h1>
              <p style={{ fontSize: 14, color: C.t2, marginBottom: 16 }}>by {w.host}</p>

              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <Stat icon="⏱" label="Duration" value={w.duration} />
                <Stat icon="📊" label="Level" value={w.level} />
                <Stat icon="🕐" label={w.live ? 'Started' : 'Starts'} value={w.live ? 'Now' : w.startsIn} />
              </div>

              <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                {w.desc}
              </p>

              <Link href={`/?workshop=${id}`} style={{
                display: 'block', padding: 14, textAlign: 'center', borderRadius: 10,
                background: w.live ? C.grad : '#1E1E28',
                border: w.live ? 'none' : `1px solid ${C.border}`,
                color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                {w.live ? '🔴 Join Live Now' : '🔔 Set Reminder'}
              </Link>
            </div>
          </article>
        </main>
      </div>
    </>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div style={{ background: '#17171F', padding: '8px 14px', borderRadius: 10, fontSize: 13 }}>
      <span style={{ marginRight: 6 }}>{icon}</span>
      <span style={{ color: '#52526A' }}>{label}: </span>
      <span style={{ color: '#EEEEF8', fontWeight: 600 }}>{value}</span>
    </div>
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
