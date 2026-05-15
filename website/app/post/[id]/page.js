/* Public post page — Server-side rendered for SEO */
import { createServerClient, SITE_URL, SITE_NAME } from '../../lib/supabaseServer'
import { notFound } from 'next/navigation'
import PublicPostClient from './PublicPostClient'

// Generate per-post metadata for SEO
export async function generateMetadata({ params }) {
  const { id } = await params
  const sb = createServerClient()
  const { data: post } = await sb.from('posts').select('*').eq('id', id).single()

  if (!post) {
    return {
      title: 'Post not found | ' + SITE_NAME,
      description: 'This post does not exist or has been removed.',
    }
  }

  const title = (post.text || '').slice(0, 60).trim() || 'A post on RingIn'
  const description = (post.text || '').slice(0, 160).trim() ||
    `${post.user_name || 'A user'} posted on RingIn — connect with experts instantly.`
  const author = post.user_name || 'RingIn user'
  const image = (Array.isArray(post.images) && post.images[0]) || post.image_url || null
  const url = `${SITE_URL}/post/${id}`

  return {
    title: `${title} — ${author} | ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${author}: ${title}`,
      description,
      url,
      siteName: SITE_NAME,
      type: 'article',
      publishedTime: post.created_at,
      authors: [author],
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${author}: ${title}`,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function PostPage({ params }) {
  const { id } = await params
  const sb = createServerClient()
  const { data: post, error } = await sb.from('posts').select('*').eq('id', id).single()

  if (error || !post) notFound()

  // Fetch author profile
  const { data: profile } = await sb.from('profiles')
    .select('id, full_name, email, avatar_url, bio, is_online')
    .eq('id', post.user_id)
    .single()

  // Fetch comments for SEO
  const { data: comments } = await sb.from('comments')
    .select('id, user_name, text, created_at')
    .eq('post_id', id)
    .order('created_at', { ascending: true })
    .limit(20)

  // JSON-LD structured data
  let bioJson = {}
  try { bioJson = JSON.parse(profile?.bio || '{}') } catch (e) {}
  const authorName = profile?.full_name || profile?.email?.split('@')[0] || post.user_name || 'RingIn User'
  const authorAvatar = profile?.avatar_url || bioJson.avatar_url || null
  const image = (Array.isArray(post.images) && post.images[0]) || post.image_url || null
  const likes = Array.isArray(post.likes) ? post.likes.length : 0

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: (post.text || '').slice(0, 110),
    articleBody: post.text || '',
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    author: {
      '@type': 'Person',
      name: authorName,
      url: `${SITE_URL}/u/${profile?.id}`,
      ...(authorAvatar && { image: authorAvatar }),
    },
    image: image ? [image] : undefined,
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: { '@type': 'LikeAction' }, userInteractionCount: likes },
      { '@type': 'InteractionCounter', interactionType: { '@type': 'CommentAction' }, userInteractionCount: post.comments_count || 0 },
    ],
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicPostClient
        post={post}
        profile={profile}
        bioJson={bioJson}
        comments={comments || []}
        authorName={authorName}
        authorAvatar={authorAvatar}
        image={image}
        likes={likes}
      />
    </>
  )
}
