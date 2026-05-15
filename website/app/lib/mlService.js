/* Client-side wrapper for the Python ML service */

const ML_BASE = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000'

async function call(path, options = {}) {
  // Timeout to prevent UI hangs
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null
  const timeoutId = controller ? setTimeout(() => controller.abort(), options.timeout || 4000) : null

  try {
    const r = await fetch(`${ML_BASE}${path}`, {
      ...options,
      signal: controller?.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    if (timeoutId) clearTimeout(timeoutId)
    if (!r.ok) {
      console.warn(`[ML Service] ${path} returned ${r.status}`)
      return null
    }
    return await r.json()
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId)
    console.warn(`[ML Service] ${path} failed:`, e.message)
    return null
  }
}

// ---- Recommendations ----
export async function getRecommendedExperts(userId, limit = 8) {
  return call(`/api/recommend/experts/${userId}?limit=${limit}`)
}

export async function getSimilarUsers(userId, limit = 10) {
  return call(`/api/recommend/similar-users/${userId}?limit=${limit}`)
}

export async function getTrendingExperts(limit = 10) {
  return call(`/api/recommend/trending-experts?limit=${limit}`)
}

// ---- Feed ranking ----
export async function getPersonalizedFeed(userId, limit = 20) {
  return call(`/api/feed/personalized/${userId}?limit=${limit}`)
}

// ---- Matching ----
export async function matchAnonymous({ userId, interests, sameGeography = true, excludeUserIds = [] }) {
  return call('/api/match/anonymous', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      interests,
      same_geography: sameGeography,
      exclude_user_ids: excludeUserIds,
    }),
  })
}

export async function matchByGeography(userId, radius = 'city', limit = 20) {
  return call(`/api/match/geography/${userId}?radius=${radius}&limit=${limit}`)
}

export async function matchByInterests(interests, userId, limit = 20) {
  const q = encodeURIComponent(interests.join(','))
  return call(`/api/match/by-interests?interests=${q}&user_id=${userId || ''}&limit=${limit}`)
}

// ---- Detection ----
export async function detectContent(text, context = 'post') {
  return call('/api/detect/', {
    method: 'POST',
    body: JSON.stringify({ text, context }),
  })
}

// ---- AI ----
export async function autoTagPost(text, maxTags = 5) {
  return call('/api/ai/auto-tag', {
    method: 'POST',
    body: JSON.stringify({ text, max_tags: maxTags }),
  })
}

export async function summarizeText(text, maxSentences = 3) {
  return call('/api/ai/summarize', {
    method: 'POST',
    body: JSON.stringify({ text, max_sentences: maxSentences }),
  })
}

export async function getTrendingTopics(hours = 24, limit = 10) {
  return call(`/api/ai/trending-topics?hours=${hours}&limit=${limit}`)
}

export async function extractKeywords(text) {
  return call('/api/ai/extract-keywords', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

// ---- Service health ----
export async function checkMLServiceHealth() {
  try {
    const r = await fetch(`${ML_BASE}/health`, { method: 'GET' })
    return r.ok
  } catch {
    return false
  }
}
