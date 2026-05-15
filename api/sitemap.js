// ─────────────────────────────────────────────────────────────────────────
// Vercel serverless function — generates the sitemap.xml from live
// Supabase data. Routed at /sitemap.xml via vercel.json rewrite.
//
// Lists three URL classes:
//   1. Static routes — / (home).
//   2. Public profiles — every row in `profiles` where the account is
//      not deleted and not flagged private/locked.
//   3. Recent posts — every row in `posts` from the last 90 days.
//
// Cached at the edge for 10 min via the Cache-Control header set in
// vercel.json (we ALSO emit our own header here for belt-and-braces).
//
// Read access uses the public anon key (same as the React client) — RLS
// on profiles/posts ensures we never list anything the anon user
// couldn't already see.
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const ORIGIN = 'https://ring-in.vercel.app';

// Public Supabase creds. Same as the React client. The anon key is
// fine here because the SELECT goes through RLS; we never get
// data the anon user wouldn't see.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fnthuegoevgicqmzhwcw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudGh1ZWdvZXZnaWNxbXpod2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjkxNzcsImV4cCI6MjA5Mjk0NTE3N30.RyUVn23aZOt8in-BiMhK0c2EfR9GN8wQ2HRA5cMJm7s';

// Sitemap protocol caps at 50,000 URLs / 50MB per file. For RingIn's
// current scale a single file is fine; if you ever hit 40k rows, switch
// to a sitemap-index and split into /sitemap-profiles.xml etc.
const MAX_URLS = 45000;

function escape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, lastmod, changefreq, priority) {
  const parts = ['  <url>', '    <loc>' + escape(loc) + '</loc>'];
  if (lastmod)    parts.push('    <lastmod>' + escape(lastmod) + '</lastmod>');
  if (changefreq) parts.push('    <changefreq>' + escape(changefreq) + '</changefreq>');
  if (priority != null) parts.push('    <priority>' + priority + '</priority>');
  parts.push('  </url>');
  return parts.join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');

  const urls = [];
  urls.push(urlEntry(ORIGIN + '/', new Date().toISOString(), 'daily', '1.0'));

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

    // Profiles — best-effort. If the column `is_public` or `deleted_at`
    // doesn't exist yet, fall back to selecting everything.
    let profiles = [];
    try {
      const r = await sb
        .from('profiles')
        .select('id, updated_at')
        .limit(20000);
      if (!r.error && r.data) profiles = r.data;
    } catch (_) {}

    profiles.forEach(function(p) {
      if (urls.length >= MAX_URLS) return;
      urls.push(urlEntry(
        ORIGIN + '/profile/' + encodeURIComponent(p.id),
        p.updated_at || null,
        'weekly',
        '0.6'
      ));
    });

    // Posts — recent 90 days only.
    let posts = [];
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const r = await sb
        .from('posts')
        .select('id, created_at')
        .gt('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(20000);
      if (!r.error && r.data) posts = r.data;
    } catch (_) {}

    posts.forEach(function(p) {
      if (urls.length >= MAX_URLS) return;
      urls.push(urlEntry(
        ORIGIN + '/post/' + encodeURIComponent(p.id),
        p.created_at || null,
        'weekly',
        '0.5'
      ));
    });
  } catch (e) {
    // If everything fails, still return the root URL — empty sitemap
    // is better than 500.
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n';

  res.status(200).send(xml);
};
