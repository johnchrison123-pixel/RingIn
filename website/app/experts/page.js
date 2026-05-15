/* Public experts directory — SSR for SEO */
import Link from 'next/link'
import { createServerClient, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../lib/supabaseServer'
import Avatar from '../components/Avatar'

export const metadata = {
  title: `Find Verified Experts in Tech, Health, Finance, Career & More | ${SITE_NAME}`,
  description: 'Browse 1000+ verified experts on RingIn. Get instant 1-on-1 advice from doctors, lawyers, coaches, engineers, financial advisors. Pay per minute.',
  keywords: ['expert consultation', 'online doctor consultation', 'career coach', 'financial advisor', 'legal advice', 'tech mentor', 'expert calling app', 'india', 'kerala'],
  alternates: { canonical: `${SITE_URL}/experts` },
  openGraph: {
    title: `Find Experts | ${SITE_NAME}`,
    description: 'Connect with 1000+ verified experts. Pay per minute, learn instantly.',
    url: `${SITE_URL}/experts`,
    siteName: SITE_NAME,
    type: 'website',
  },
}

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', amber: '#F5A623',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

const CATEGORIES = [
  { id: 'all', label: 'All Experts', icon: '⚡' },
  { id: 'health', label: 'Health & Medical', icon: '🏥' },
  { id: 'tech', label: 'Tech & Engineering', icon: '💻' },
  { id: 'career', label: 'Career Coaching', icon: '🎯' },
  { id: 'legal', label: 'Legal', icon: '⚖️' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'fitness', label: 'Fitness & Wellness', icon: '💪' },
  { id: 'design', label: 'Design', icon: '🎨' },
  { id: 'business', label: 'Business', icon: '📈' },
]

export default async function ExpertsPage() {
  const sb = createServerClient()
  const { data: profiles } = await sb.from('profiles')
    .select('id, full_name, email, avatar_url, is_online, bio')
    .limit(60)

  const experts = (profiles || []).map(p => {
    let bioJson = {}
    try { bioJson = JSON.parse(p.bio || '{}') } catch (e) {}
    return {
      id: p.id,
      name: p.full_name || p.email?.split('@')[0] || 'Member',
      tag: bioJson.tag || 'Member',
      about: bioJson.about || '',
      img: p.avatar_url || bioJson.avatar_url,
      online: p.is_online,
      area: bioJson.expert_request?.area || null,
    }
  })

  // JSON-LD ItemList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: experts.slice(0, 20).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: e.name,
        url: `${SITE_URL}/u/${e.id}`,
        ...(e.img && { image: e.img }),
        jobTitle: e.tag,
      },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        <PublicHeader />

        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 80px' }}>
          {/* Hero */}
          <section style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontFamily: 'Syne', fontSize: 42, fontWeight: 800, marginBottom: 12 }}>
              Find an Expert in Minutes
            </h1>
            <p style={{ fontSize: 18, color: C.t2, maxWidth: 600, margin: '0 auto' }}>
              Browse verified specialists across health, tech, career, finance, and more.
              Pay per minute, learn instantly.
            </p>
          </section>

          {/* Category links */}
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
              Browse by Category
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <Link key={c.id} href={`/experts/${c.id}`} style={{
                  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: 20, textAlign: 'center', textDecoration: 'none', color: C.text,
                  transition: 'border-color 0.2s, transform 0.2s',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</div>
                </Link>
              ))}
            </div>
          </section>

          {/* Featured experts */}
          <section>
            <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
              Featured Experts
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {experts.map(e => (
                <Link key={e.id} href={`/u/${e.id}`} style={{
                  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: 20, textAlign: 'center', textDecoration: 'none', color: C.text,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <Avatar user={e} size={64} showOnline />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>{e.tag}</div>
                  {e.about && (
                    <p style={{
                      fontSize: 12, color: C.t3, marginTop: 8, lineHeight: 1.4,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{e.about}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
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
