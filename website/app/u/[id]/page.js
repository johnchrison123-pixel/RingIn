/* Public user profile — Server-side rendered for SEO */
import { createServerClient, SITE_URL, SITE_NAME } from '../../lib/supabaseServer'
import { notFound } from 'next/navigation'
import PublicProfileClient from './PublicProfileClient'

export async function generateMetadata({ params }) {
  const { id } = await params
  const sb = createServerClient()
  const { data: profile } = await sb.from('profiles').select('*').eq('id', id).single()

  if (!profile) {
    return {
      title: 'Profile not found | ' + SITE_NAME,
      description: 'This profile does not exist.',
    }
  }

  let bioJson = {}
  try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}

  const name = profile.full_name || profile.email?.split('@')[0] || 'RingIn User'
  const tag = bioJson.tag || ''
  const about = bioJson.about || `${name} is on RingIn — connect with experts instantly.`
  const avatar = profile.avatar_url || bioJson.avatar_url
  const url = `${SITE_URL}/u/${id}`

  return {
    title: `${name} ${tag ? `(${tag})` : ''} | ${SITE_NAME}`,
    description: about.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      title: `${name} on ${SITE_NAME}`,
      description: about.slice(0, 160),
      url,
      siteName: SITE_NAME,
      type: 'profile',
      ...(avatar && { images: [{ url: avatar, width: 400, height: 400 }] }),
    },
    twitter: {
      card: avatar ? 'summary_large_image' : 'summary',
      title: `${name} on ${SITE_NAME}`,
      description: about.slice(0, 160),
      ...(avatar && { images: [avatar] }),
    },
  }
}

export default async function ProfilePage({ params }) {
  const { id } = await params
  const sb = createServerClient()

  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', id).single()
  if (error || !profile) notFound()

  let bioJson = {}
  try { bioJson = JSON.parse(profile.bio || '{}') } catch (e) {}

  // Respect privacy settings — check profile.bio.privacy.profile_visibility
  let visibility = 'public'
  try {
    const b = JSON.parse(profile?.bio || '{}')
    visibility = b.privacy?.profile_visibility || 'public'
  } catch (e) {}

  // If profile is private, don't show posts publicly
  let posts = []
  if (visibility !== 'private') {
    const { data } = await sb.from('posts').select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    posts = data || []
  }

  // Counts
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    sb.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
    sb.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
  ])

  const name = profile.full_name || profile.email?.split('@')[0] || 'RingIn User'
  const avatar = profile.avatar_url || bioJson.avatar_url
  const cover = profile.cover_url || bioJson.cover_url

  // JSON-LD Person schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: `${SITE_URL}/u/${id}`,
    description: bioJson.about || '',
    ...(avatar && { image: avatar }),
    ...(bioJson.tag && { jobTitle: bioJson.tag.replace('#', '') }),
    ...(bioJson.website_url && { sameAs: [bioJson.website_url] }),
    ...(bioJson.location && {
      address: {
        '@type': 'PostalAddress',
        addressLocality: bioJson.location.city,
        addressRegion: bioJson.location.state,
        addressCountry: bioJson.location.country_name || bioJson.location.country,
      },
    }),
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'FollowAction' },
      userInteractionCount: followersCount || 0,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicProfileClient
        profile={profile}
        bioJson={bioJson}
        posts={posts || []}
        name={name}
        avatar={avatar}
        cover={cover}
        followersCount={followersCount || 0}
        followingCount={followingCount || 0}
      />
    </>
  )
}
