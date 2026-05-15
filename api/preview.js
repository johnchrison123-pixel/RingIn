// ─────────────────────────────────────────────────────────────────────────
// Vercel serverless function — serves crawler-friendly HTML for any
// public URL (post / profile / generic). Returns a static HTML page with
// real OG meta tags + Twitter Card + JSON-LD structured data, fetched
// from Supabase.
//
// Why this exists: RingIn is a CRA SPA. When WhatsApp / Slack / X /
// LinkedIn / Discord / Facebook / iMessage fetch a shared URL to render
// a link preview, they DO NOT execute JavaScript — they parse the
// initial HTML response only. Without this endpoint, every preview is
// empty/generic because the meta tags only get set after React boots.
//
// Routing: the middleware at /middleware.js detects crawler user-agents
// and rewrites their request to /api/preview?path=<original>. Real
// users hit the SPA as normal — they never see this endpoint.
//
// Query params:
//   path  — the original path that was requested (e.g. /post/<id>, /profile/<id>)
//
// Always returns 200 + text/html, even on error — a generic OG card is
// better than an HTTP error code which crawlers may interpret as
// "preview unavailable forever" and cache.
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const ORIGIN = 'https://ring-in.vercel.app';
const DEFAULT_IMG = ORIGIN + '/logo512.png';
const SITE_NAME = 'RingIn';
const SITE_TAGLINE = 'Talk to experts, by the minute.';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fnthuegoevgicqmzhwcw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudGh1ZWdvZXZnaWNxbXpod2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjkxNzcsImV4cCI6MjA5Mjk0NTE3N30.RyUVn23aZOt8in-BiMhK0c2EfR9GN8wQ2HRA5cMJm7s';

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s, n) {
  s = String(s || '').trim().replace(/\s+/g, ' ');
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

function buildHtml(meta) {
  const title       = meta.title       || (SITE_NAME + ' — ' + SITE_TAGLINE);
  const description = meta.description || SITE_TAGLINE;
  const image       = meta.image       || DEFAULT_IMG;
  const url         = meta.url         || ORIGIN + '/';
  const type        = meta.type        || 'website';
  const jsonLd      = meta.jsonLd      || null;

  // Note: we still load the React bundle via a <script defer> at the
  // bottom so that if a HUMAN user accidentally lands here (e.g. by
  // copy-pasting a debug URL), they get the real app instead of just
  // the OG card.
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    '<title>' + escape(title) + '</title>',
    '<meta name="description" content="' + escape(description) + '" />',
    '<link rel="canonical" href="' + escape(url) + '" />',
    '<link rel="icon" href="/favicon.ico" />',
    // OpenGraph
    '<meta property="og:site_name" content="' + escape(SITE_NAME) + '" />',
    '<meta property="og:type" content="' + escape(type) + '" />',
    '<meta property="og:url" content="' + escape(url) + '" />',
    '<meta property="og:title" content="' + escape(title) + '" />',
    '<meta property="og:description" content="' + escape(description) + '" />',
    '<meta property="og:image" content="' + escape(image) + '" />',
    '<meta property="og:locale" content="en_US" />',
    // Twitter Card
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + escape(title) + '" />',
    '<meta name="twitter:description" content="' + escape(description) + '" />',
    '<meta name="twitter:image" content="' + escape(image) + '" />',
    // JSON-LD per-page schema
    jsonLd ? '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' : '',
    // Theme + branding
    '<meta name="theme-color" content="#09090E" />',
    '<style>html,body{margin:0;padding:0;background:#09090E;color:#ebebef;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}.fallback{padding:60px 20px;max-width:520px;margin:0 auto;text-align:center;}.fallback h1{font-size:22px;}.fallback p{color:#888;font-size:14px;}.fallback a{color:#7B6EFF;text-decoration:none;}</style>',
    '</head>',
    '<body>',
    // Human-fallback content (crawlers ignore visible body text for OG; humans
    // see this if they ever land here directly).
    '<div class="fallback">',
    '  <h1>' + escape(title) + '</h1>',
    '  <p>' + escape(description) + '</p>',
    '  <p><a href="' + escape(url) + '">Open in RingIn →</a></p>',
    '</div>',
    '</body>',
    '</html>',
  ].join('\n');
}

async function fetchPost(sb, id) {
  if (!id) return null;
  try {
    const r = await sb.from('posts').select('id, user_id, text, images, created_at, tags').eq('id', id).single();
    if (r.error || !r.data) return null;
    const post = r.data;
    let authorName = 'Someone';
    let authorAvatar = null;
    try {
      const p = await sb.from('profiles').select('full_name, email, avatar_url').eq('id', post.user_id).single();
      if (p.data) {
        authorName = (p.data.full_name && p.data.full_name.trim())
          || (p.data.email && p.data.email.split('@')[0])
          || 'Someone';
        authorAvatar = p.data.avatar_url || null;
      }
    } catch (_) {}
    return { post, authorName, authorAvatar };
  } catch (_) { return null; }
}

async function fetchProfile(sb, id) {
  if (!id) return null;
  try {
    const r = await sb.from('profiles').select('id, full_name, email, avatar_url, bio').eq('id', id).single();
    if (r.error || !r.data) return null;
    return r.data;
  } catch (_) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Crawlers cache aggressively — 1h is sane.
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

  let rawPath = (req.query && req.query.path) || '/';
  if (Array.isArray(rawPath)) rawPath = rawPath[0];
  // Defense: never let an attacker control output via the path.
  const path = String(rawPath || '/').slice(0, 256);

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  let meta = null;

  // /post/<id> — render post preview
  const mPost = path.match(/^\/post\/([^/?#]+)/);
  if (mPost) {
    const data = await fetchPost(sb, mPost[1]);
    if (data) {
      const { post, authorName, authorAvatar } = data;
      const text = post.text || '';
      const firstImage = (post.images && post.images[0]) || authorAvatar || DEFAULT_IMG;
      meta = {
        title: authorName + ' on RingIn',
        description: truncate(text || 'A post on RingIn.', 155),
        image: firstImage,
        url: ORIGIN + '/post/' + post.id,
        type: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SocialMediaPosting',
          'headline': truncate(text || authorName + ' posted on RingIn', 110),
          'datePublished': post.created_at,
          'author': {
            '@type': 'Person',
            'name': authorName,
            'image': authorAvatar || undefined,
          },
          'image': firstImage,
          'url': ORIGIN + '/post/' + post.id,
          'keywords': (post.tags || []).join(', '),
        },
      };
    }
  }

  // /profile/<id> — render profile preview
  const mProfile = !meta && path.match(/^\/profile\/([^/?#]+)/);
  if (mProfile) {
    const p = await fetchProfile(sb, mProfile[1]);
    if (p) {
      const name = (p.full_name && p.full_name.trim())
        || (p.email && p.email.split('@')[0])
        || 'A RingIn member';
      meta = {
        title: name + ' — on RingIn',
        description: truncate(p.bio || 'Connect on RingIn — talk to experts by the minute.', 155),
        image: p.avatar_url || DEFAULT_IMG,
        url: ORIGIN + '/profile/' + p.id,
        type: 'profile',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          'mainEntity': {
            '@type': 'Person',
            'name': name,
            'description': p.bio || undefined,
            'image': p.avatar_url || undefined,
            'url': ORIGIN + '/profile/' + p.id,
          },
        },
      };
    }
  }

  // Fallback: generic site card
  if (!meta) {
    meta = {
      title: SITE_NAME + ' — ' + SITE_TAGLINE,
      description: 'Connect, message, and call experts in real time. Pay-per-minute audio consultations. No ads, no algorithm.',
      image: DEFAULT_IMG,
      url: ORIGIN + path,
      type: 'website',
    };
  }

  res.status(200).send(buildHtml(meta));
};
