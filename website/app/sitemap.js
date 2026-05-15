/* Dynamic sitemap — discovers profiles + posts from DB */
import { createServerClient, SITE_URL } from './lib/supabaseServer'
import { getWorkshopIds } from './lib/workshops'

const CATEGORIES = ['health', 'tech', 'career', 'legal', 'finance', 'fitness', 'design', 'business']
const WORKSHOPS = getWorkshopIds()

export default async function sitemap() {
  const sb = createServerClient()
  const now = new Date()

  // Static pages
  const staticPages = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/experts`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/workshops`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/signin`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  // Category pages
  const categoryPages = CATEGORIES.map(cat => ({
    url: `${SITE_URL}/experts/${cat}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Workshop pages
  const workshopPages = WORKSHOPS.map(id => ({
    url: `${SITE_URL}/workshops/${id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Dynamic: profiles
  let profilePages = []
  try {
    const { data: profiles } = await sb.from('profiles').select('id, last_seen').limit(500)
    if (profiles) {
      profilePages = profiles.map(p => ({
        url: `${SITE_URL}/u/${p.id}`,
        lastModified: p.last_seen ? new Date(p.last_seen) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      }))
    }
  } catch (e) {}

  // Dynamic: posts
  let postPages = []
  try {
    const { data: posts } = await sb.from('posts').select('id, created_at, updated_at').order('created_at', { ascending: false }).limit(500)
    if (posts) {
      postPages = posts.map(p => ({
        url: `${SITE_URL}/post/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(p.created_at),
        changeFrequency: 'weekly',
        priority: 0.6,
      }))
    }
  } catch (e) {}

  return [...staticPages, ...categoryPages, ...workshopPages, ...profilePages, ...postPages]
}
