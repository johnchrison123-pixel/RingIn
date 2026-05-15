/* Public expert category page — SSR for SEO */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient, SITE_URL, SITE_NAME } from '../../lib/supabaseServer'
import Avatar from '../../components/Avatar'

const CATEGORIES = {
  health: { label: 'Health & Medical', icon: '🏥', desc: 'Doctors, psychologists, dietitians, and medical specialists. Book a consultation in minutes.', keywords: ['online doctor consultation', 'medical advice', 'general physician', 'psychologist'] },
  tech: { label: 'Tech & Engineering', icon: '💻', desc: 'Senior software engineers, system designers, and code mentors. Pay per minute for expert tech advice.', keywords: ['tech mentor', 'system design', 'software engineering', 'coding help'] },
  career: { label: 'Career Coaching', icon: '🎯', desc: 'Career coaches, interview prep specialists, LinkedIn experts. Land your dream job.', keywords: ['career coach', 'interview prep', 'linkedin optimization', 'job advice'] },
  legal: { label: 'Legal Advice', icon: '⚖️', desc: 'Lawyers and legal advisors for contracts, compliance, and dispute resolution.', keywords: ['legal advice online', 'lawyer consultation', 'contract review'] },
  finance: { label: 'Finance & Investments', icon: '💰', desc: 'Financial advisors, investment specialists, tax planners, retirement experts.', keywords: ['financial advisor', 'investment advice', 'retirement planning', 'tax help'] },
  fitness: { label: 'Fitness & Wellness', icon: '💪', desc: 'Personal trainers, nutritionists, and wellness coaches. Build sustainable healthy habits.', keywords: ['personal trainer', 'nutritionist', 'fitness coach', 'wellness'] },
  design: { label: 'Design', icon: '🎨', desc: 'UI/UX designers, brand specialists, and portfolio reviewers.', keywords: ['ux designer', 'design feedback', 'portfolio review'] },
  business: { label: 'Business & Growth', icon: '📈', desc: 'Business strategists, marketing experts, and growth hackers.', keywords: ['business strategy', 'marketing consultant', 'growth hacking'] },
}

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export async function generateMetadata({ params }) {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) return { title: 'Category not found' }
  return {
    title: `${cat.label} Experts — Pay Per Minute Consultation | ${SITE_NAME}`,
    description: cat.desc,
    keywords: cat.keywords,
    alternates: { canonical: `${SITE_URL}/experts/${category}` },
    openGraph: {
      title: `${cat.label} Experts | ${SITE_NAME}`,
      description: cat.desc,
      url: `${SITE_URL}/experts/${category}`,
      siteName: SITE_NAME,
      type: 'website',
    },
  }
}

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map(category => ({ category }))
}

export default async function CategoryPage({ params }) {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) notFound()

  const sb = createServerClient()
  // Filter experts by category in their bio.expert_request.area
  const { data: profiles } = await sb.from('profiles')
    .select('id, full_name, email, avatar_url, is_online, bio')
    .limit(40)

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
      area: (bioJson.expert_request?.area || '').toLowerCase(),
    }
  }).filter(e => !e.area || e.area === category || cat.label.toLowerCase().includes(e.area))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${cat.label} Experts on ${SITE_NAME}`,
    description: cat.desc,
    url: `${SITE_URL}/experts/${category}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: experts.slice(0, 20).map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Person',
          name: e.name,
          url: `${SITE_URL}/u/${e.id}`,
          ...(e.img && { image: e.img }),
        },
      })),
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        <PublicHeader />
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 80px' }}>
          {/* Breadcrumb */}
          <nav style={{ fontSize: 13, color: C.t2, marginBottom: 20 }}>
            <Link href="/" style={{ color: C.ac, textDecoration: 'none' }}>Home</Link> ›{' '}
            <Link href="/experts" style={{ color: C.ac, textDecoration: 'none' }}>Experts</Link> ›{' '}
            {cat.label}
          </nav>

          {/* Hero */}
          <section style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>{cat.icon}</div>
            <h1 style={{ fontFamily: 'Syne', fontSize: 38, fontWeight: 800, marginBottom: 12 }}>
              {cat.label} Experts
            </h1>
            <p style={{ fontSize: 18, color: C.t2, maxWidth: 720, lineHeight: 1.5 }}>
              {cat.desc}
            </p>
          </section>

          {/* Experts grid */}
          <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
            {experts.length} Available Experts
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
              </Link>
            ))}
          </div>

          {/* Other categories */}
          <section style={{ marginTop: 60 }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
              Other Categories
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CATEGORIES).filter(([id]) => id !== category).map(([id, c]) => (
                <Link key={id} href={`/experts/${id}`} style={{
                  padding: '8px 16px', background: C.bg2, border: `1px solid ${C.border}`,
                  borderRadius: 20, color: C.text, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none',
                }}>
                  {c.icon} {c.label}
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
