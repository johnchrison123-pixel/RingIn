#!/usr/bin/env node
/**
 * generate-research-pdf.mjs
 *
 * Builds two artefacts from RESEARCH-COMPARISON-2026.md:
 *   1. public/research-2026.html — mobile-responsive viewer with embedded
 *      markdown, rendered client-side via marked.js (loaded from a CDN).
 *      Has a "Save as PDF" button that triggers the browser's print dialog
 *      with print-friendly CSS.
 *   2. public/research-2026.pdf  — true PDF generated via Chrome headless
 *      printing the HTML viewer. Uses the same print CSS so the PDF and
 *      browser-print output match.
 *
 * Usage:
 *   node tools/generate-research-pdf.mjs
 *
 * Then commit `public/research-2026.html` + `public/research-2026.pdf`,
 * merge to main, and Vercel serves them at:
 *   https://ring-in.vercel.app/research-2026.html
 *   https://ring-in.vercel.app/research-2026.pdf
 *
 * Re-run after editing the source .md to refresh both.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const MD_SRC = path.join(ROOT, 'RESEARCH-COMPARISON-2026.md');
const PUBLIC = path.join(ROOT, 'public');
const HTML_OUT = path.join(PUBLIC, 'research-2026.html');
const PDF_OUT = path.join(PUBLIC, 'research-2026.pdf');

if (!fs.existsSync(MD_SRC)) {
  console.error('Source markdown not found:', MD_SRC);
  process.exit(1);
}
if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC, { recursive: true });

const md = fs.readFileSync(MD_SRC, 'utf8');
console.log('source markdown:', md.length, 'bytes');

// Escape `</script>` inside the markdown so embedding doesn't terminate the
// host <script> block early. (Standard trick: split the closing tag.)
const safeMd = md.replace(/<\/script>/gi, '<\\/script>');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#7B6EFF">
<meta name="robots" content="noindex">
<title>RingIn vs. Big Platforms — 2026 Research</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
<style>
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --bg-soft: #f6f6f8;
  --text: #1a1a1f;
  --muted: #666;
  --accent: #7B6EFF;
  --accent-2: #E84D9A;
  --code-bg: rgba(0,0,0,0.05);
  --border: rgba(0,0,0,0.1);
  --link: #5746af;
  --quote-bg: #f6f4ff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0c0c12;
    --bg-soft: #15151c;
    --text: #ebebef;
    --muted: #8b8b94;
    --code-bg: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.12);
    --link: #b8aaff;
    --quote-bg: rgba(123,110,255,0.08);
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.62;
  background: var(--bg);
  color: var(--text);
}
.wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 18px 96px;
}
.toolbar {
  position: sticky; top: 0;
  background: var(--bg);
  padding: 10px 18px;
  margin: 0 -18px 14px;
  border-bottom: 1px solid var(--border);
  display: flex; gap: 10px; align-items: center;
  z-index: 10;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.toolbar small {
  flex: 1; color: var(--muted); font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.toolbar button {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; border: none; padding: 8px 14px;
  border-radius: 999px; cursor: pointer;
  font-size: 13px; font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(123,110,255,0.35);
}
.toolbar button:active { transform: scale(0.96); }

article {
  padding-top: 8px;
}

h1, h2, h3, h4 {
  line-height: 1.25;
  margin: 1.5em 0 0.55em;
  font-weight: 700;
}
h1:first-child { margin-top: 0.4em; }
h1 { font-size: 1.95em; letter-spacing: -0.01em; }
h2 {
  font-size: 1.45em;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  letter-spacing: -0.005em;
}
h3 {
  font-size: 1.15em;
  color: var(--accent);
}
h4 { font-size: 1em; color: var(--muted); }
p { margin: 0.7em 0; }
ul, ol { padding-left: 1.45em; margin: 0.6em 0; }
li { margin: 0.3em 0; }
li > p { margin: 0.3em 0; }
a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
  word-break: break-word;
}
a:hover { text-decoration-thickness: 2px; }
strong { font-weight: 700; }
em { font-style: italic; }

code {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 0.88em;
}
pre {
  background: var(--code-bg);
  padding: 14px;
  border-radius: 10px;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.5;
}
pre code { background: none; padding: 0; }

blockquote {
  border-left: 3px solid var(--accent);
  margin: 1.1em 0;
  padding: 0.6em 0 0.6em 1.1em;
  background: var(--quote-bg);
  border-radius: 0 10px 10px 0;
  color: var(--text);
}
blockquote p { margin: 0.45em 0; }
blockquote p:first-child { margin-top: 0; }
blockquote p:last-child { margin-bottom: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.92em;
}
.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1em -4px;
}
th, td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}
th {
  background: var(--bg-soft);
  font-weight: 700;
}

hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 0;
}
img { max-width: 100%; height: auto; }

#loading {
  text-align: center;
  padding: 80px 0;
  color: var(--muted);
  font-size: 14px;
}

/* Print / PDF rendering */
@media print {
  @page { size: A4; margin: 14mm 12mm 16mm; }
  .toolbar { display: none !important; }
  .wrap { max-width: none; padding: 0; }
  body { font-size: 10.5pt; line-height: 1.5; background: #fff; color: #000; }
  h1 { font-size: 18pt; }
  h2 { font-size: 14.5pt; padding-top: 8pt; }
  h3 { font-size: 12pt; color: #5746af; }
  h4 { font-size: 11pt; color: #444; }
  h1, h2, h3 { page-break-after: avoid; }
  blockquote, pre, table { page-break-inside: avoid; }
  a { color: #1a1a1a; text-decoration: none; }
  /* External links print their URL after them; in-doc anchors don't */
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 8.5pt; color: #666; word-break: break-all;
  }
  pre, blockquote, code {
    background: #f5f5f5 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  th { background: #efefef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { font-size: 9.5pt; }
}
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <small>RingIn Research · 2026 · ~9.2K words · ~40 min read</small>
    <button onclick="window.print()" title="Use your browser's Save as PDF option">Save as PDF</button>
  </div>
  <article id="content"><div id="loading">Rendering markdown…</div></article>
</div>
<script id="md-source" type="text/markdown">${safeMd}</script>
<script>
(function() {
  function render() {
    if (typeof marked === 'undefined') {
      // marked.js still loading from CDN; retry
      return setTimeout(render, 80);
    }
    var src = document.getElementById('md-source').textContent;
    var html = marked.parse(src, { gfm: true, breaks: false, headerIds: true });
    var article = document.getElementById('content');
    article.innerHTML = html;
    // Open external links in a new tab on phone — better UX
    article.querySelectorAll('a[href^="http"]').forEach(function(a) {
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
    });
    // Wrap tables for horizontal scroll on narrow screens
    article.querySelectorAll('table').forEach(function(t) {
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
    // Signal to the headless-print runner that rendering is complete
    document.documentElement.setAttribute('data-rendered', '1');
  }
  render();
})();
</script>
</body>
</html>`;

fs.writeFileSync(HTML_OUT, html);
console.log('✔ wrote', HTML_OUT, '(' + html.length + ' bytes)');

// ── Generate PDF via Chrome headless ──────────────────────────────────────
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) {
  console.warn('No Chrome/Edge found — skipping PDF generation. HTML is written.');
  process.exit(0);
}
console.log('printing PDF using:', CHROME);

const absHtml = path.resolve(HTML_OUT).replace(/\\/g, '/');
const fileUrl = 'file:///' + absHtml;

try {
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--virtual-time-budget=10000',
    '--print-to-pdf=' + path.resolve(PDF_OUT),
    fileUrl,
  ], { stdio: 'inherit' });
  const stat = fs.statSync(PDF_OUT);
  console.log('✔ wrote', PDF_OUT, '(' + stat.size + ' bytes)');
} catch (e) {
  console.error('✗ Chrome PDF generation failed:', e.message);
  console.log('  HTML is still written; you can print it from any browser.');
  process.exit(2);
}

// ── Also copy raw .md alongside, in case anyone wants the source ──────────
const MD_OUT = path.join(PUBLIC, 'research-2026.md');
fs.copyFileSync(MD_SRC, MD_OUT);
console.log('✔ copied raw markdown to', MD_OUT);

console.log('\\nAll done. After commit + merge to main, files will be live at:');
console.log('  https://ring-in.vercel.app/research-2026.html');
console.log('  https://ring-in.vercel.app/research-2026.pdf');
console.log('  https://ring-in.vercel.app/research-2026.md');
