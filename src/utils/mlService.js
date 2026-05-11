/* eslint-disable */
/* ML service client for the mobile app */

var ML_BASE = process.env.REACT_APP_ML_SERVICE_URL || 'http://localhost:8000';

function call(path, options) {
  options = options || {};
  // 4-second timeout to prevent UI hangs
  var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timeoutId = controller ? setTimeout(function(){controller.abort();}, options.timeout || 4000) : null;

  return fetch(ML_BASE + path, {
    method: options.method || 'GET',
    headers: Object.assign({'Content-Type': 'application/json'}, options.headers || {}),
    body: options.body,
    signal: controller ? controller.signal : undefined,
  }).then(function(r) {
    if (timeoutId) clearTimeout(timeoutId);
    if (!r.ok) { console.warn('[ML] ' + path + ' returned ' + r.status); return null; }
    return r.json();
  }).catch(function(e) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('[ML] ' + path + ' failed: ' + (e.message || 'unknown'));
    return null;
  });
}

export function getRecommendedExperts(userId, limit) {
  limit = limit || 8;
  return call('/api/recommend/experts/' + userId + '?limit=' + limit);
}

export function getSimilarUsers(userId, limit) {
  limit = limit || 10;
  return call('/api/recommend/similar-users/' + userId + '?limit=' + limit);
}

export function getTrendingExperts(limit) {
  limit = limit || 10;
  return call('/api/recommend/trending-experts?limit=' + limit);
}

export function getPersonalizedFeed(userId, limit) {
  limit = limit || 20;
  return call('/api/feed/personalized/' + userId + '?limit=' + limit);
}

export function matchAnonymous(opts) {
  return call('/api/match/anonymous', {
    method: 'POST',
    body: JSON.stringify({
      user_id: opts.userId,
      interests: opts.interests || [],
      same_geography: opts.sameGeography !== false,
      exclude_user_ids: opts.excludeUserIds || [],
    }),
  });
}

export function matchByGeography(userId, radius, limit) {
  return call('/api/match/geography/' + userId + '?radius=' + (radius || 'city') + '&limit=' + (limit || 20));
}

export function matchByInterests(interests, userId, limit) {
  var q = encodeURIComponent(interests.join(','));
  return call('/api/match/by-interests?interests=' + q + '&user_id=' + (userId || '') + '&limit=' + (limit || 20));
}

export function detectContent(text, context) {
  return call('/api/detect/', {
    method: 'POST',
    body: JSON.stringify({text: text, context: context || 'post'}),
  });
}

export function autoTagPost(text, maxTags) {
  return call('/api/ai/auto-tag', {
    method: 'POST',
    body: JSON.stringify({text: text, max_tags: maxTags || 5}),
  });
}

export function summarizeText(text, maxSentences) {
  return call('/api/ai/summarize', {
    method: 'POST',
    body: JSON.stringify({text: text, max_sentences: maxSentences || 3}),
  });
}

export function getTrendingTopics(hours, limit) {
  return call('/api/ai/trending-topics?hours=' + (hours || 24) + '&limit=' + (limit || 10));
}

export function checkMLServiceHealth() {
  return fetch(ML_BASE + '/health').then(function(r) { return r.ok; }).catch(function() { return false; });
}
