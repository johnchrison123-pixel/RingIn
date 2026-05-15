/* Root page — server-rendered SEO landing + client app */
import { createServerClient, SITE_URL, SITE_NAME } from './lib/supabaseServer'
import HomeClient from './HomeClient'
import SeoLandingContent from './components/SeoLandingContent'

export const metadata = {
  title: `${SITE_NAME} — Talk to Verified Experts Instantly | Doctors, Coaches, Engineers`,
  description: 'Connect with verified domain experts on RingIn. Book 1-on-1 calls with doctors, lawyers, career coaches, financial advisors, tech mentors. Pay per minute. Built in India.',
  alternates: { canonical: SITE_URL },
}

async function getFeaturedContent() {
  const sb = createServerClient()
  try {
    const [{ data: profiles }, { data: posts }] = await Promise.all([
      sb.from('profiles').select('id, full_name, email, avatar_url, bio, is_online').limit(8),
      sb.from('posts').select('id, user_id, user_name, text, created_at, comments_count, likes').order('created_at', { ascending: false }).limit(6),
    ])
    return { profiles: profiles || [], posts: posts || [] }
  } catch (e) {
    return { profiles: [], posts: [] }
  }
}

export default async function HomePage() {
  const { profiles, posts } = await getFeaturedContent()

  const experts = profiles.map(p => {
    let bioJson = {}
    try { bioJson = JSON.parse(p.bio || '{}') } catch (e) {}
    return {
      id: p.id,
      name: p.full_name || p.email?.split('@')[0] || 'Member',
      tag: bioJson.tag || 'Member',
      img: p.avatar_url || bioJson.avatar_url,
      online: p.is_online,
    }
  })

  // FAQ schema for Google rich snippets
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How do I connect with an expert on RingIn?', acceptedAnswer: { '@type': 'Answer', text: 'Browse experts by category, view their profile, and tap Call. You pay per minute using RingIn coins.' } },
      { '@type': 'Question', name: 'Are experts on RingIn verified?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — all expert applications are reviewed. Verified experts get a blue checkmark.' } },
      { '@type': 'Question', name: 'How much does it cost to use RingIn?', acceptedAnswer: { '@type': 'Answer', text: 'Browsing is free. Calls cost coins per minute (set by each expert, usually 50-150 coins/min). 1 coin ≈ ₹1.' } },
      { '@type': 'Question', name: 'Can I become an expert and earn money?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Apply via Settings → Become an Expert. Set your hourly rate and earn coins from every call you take.' } },
      { '@type': 'Question', name: 'Is RingIn available in India and Kerala?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — RingIn is built in India with a strong focus on Kerala launch. Pay via UPI, GPay, PhonePe, or card.' } },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Server-rendered SEO content for crawlers (also serves no-JS users) */}
      <noscript>
        <SeoLandingContent experts={experts} posts={posts} />
      </noscript>

      {/* Client app — shows SEO landing when not logged in, full app when logged in */}
      <HomeClient seoExperts={experts} seoPosts={posts} />
    </>
  )
}
