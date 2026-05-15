#!/usr/bin/env node
// Builds public/progress.html + public/progress.pdf from TIER1-2-PROGRESS.md
// Same pattern as generate-research-pdf.mjs, narrower scope.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const MD_SRC = path.join(ROOT, 'TIER1-2-PROGRESS.md');
const PUBLIC = path.join(ROOT, 'public');
const HTML_OUT = path.join(PUBLIC, 'progress.html');
const PDF_OUT = path.join(PUBLIC, 'progress.pdf');

if (!fs.existsSync(MD_SRC)) { console.error('missing:', MD_SRC); process.exit(1); }
if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC, { recursive: true });

const md = fs.readFileSync(MD_SRC, 'utf8');
const safeMd = md.replace(/<\/script>/gi, '<\\/script>');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#7B6EFF">
<meta name="robots" content="noindex">
<title>RingIn — Tier 1 + 2 Progress</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
<style>
:root{color-scheme:light dark;--bg:#fff;--bg-soft:#f6f6f8;--text:#1a1a1f;--muted:#666;--accent:#7B6EFF;--accent-2:#E84D9A;--code-bg:rgba(0,0,0,0.05);--border:rgba(0,0,0,0.1);--link:#5746af;--quote-bg:#f6f4ff}
@media(prefers-color-scheme:dark){:root{--bg:#0c0c12;--bg-soft:#15151c;--text:#ebebef;--muted:#8b8b94;--code-bg:rgba(255,255,255,0.07);--border:rgba(255,255,255,0.12);--link:#b8aaff;--quote-bg:rgba(123,110,255,0.08)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',system-ui,sans-serif;font-size:16px;line-height:1.62;background:var(--bg);color:var(--text)}
.wrap{max-width:760px;margin:0 auto;padding:0 18px 96px}
.toolbar{position:sticky;top:0;background:var(--bg);padding:10px 18px;margin:0 -18px 14px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;z-index:10;backdrop-filter:blur(10px)}
.toolbar small{flex:1;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.toolbar button{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border:none;padding:8px 14px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;white-space:nowrap}
article{padding-top:8px}
h1,h2,h3,h4{line-height:1.25;margin:1.5em 0 .55em;font-weight:700}
h1:first-child{margin-top:.4em}h1{font-size:1.95em;letter-spacing:-0.01em}
h2{font-size:1.45em;padding-top:18px;border-top:1px solid var(--border)}
h3{font-size:1.15em;color:var(--accent)}h4{font-size:1em;color:var(--muted)}
p{margin:.7em 0}ul,ol{padding-left:1.45em;margin:.6em 0}li{margin:.3em 0}
a{color:var(--link);text-decoration:underline;text-underline-offset:2px;word-break:break-word}
strong{font-weight:700}em{font-style:italic}
code{background:var(--code-bg);padding:2px 6px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em}
pre{background:var(--code-bg);padding:14px;border-radius:10px;overflow-x:auto;font-size:.85em;line-height:1.5}
pre code{background:none;padding:0}
blockquote{border-left:3px solid var(--accent);margin:1.1em 0;padding:.6em 0 .6em 1.1em;background:var(--quote-bg);border-radius:0 10px 10px 0}
table{width:100%;border-collapse:collapse;margin:1em 0;font-size:.92em}
.table-wrap{overflow-x:auto;margin:1em -4px}
th,td{border:1px solid var(--border);padding:8px 12px;text-align:left;vertical-align:top}
th{background:var(--bg-soft);font-weight:700}
hr{border:none;border-top:1px solid var(--border);margin:2em 0}
@media print{
  @page{size:A4;margin:14mm 12mm 16mm}
  .toolbar{display:none!important}
  .wrap{max-width:none;padding:0}
  body{font-size:10.5pt;line-height:1.5;background:#fff;color:#000}
  h1{font-size:18pt}h2{font-size:14.5pt;padding-top:8pt}
  h3{font-size:12pt;color:#5746af}h4{font-size:11pt;color:#444}
  h1,h2,h3{page-break-after:avoid}
  blockquote,pre,table{page-break-inside:avoid}
  a{color:#1a1a1a;text-decoration:none}
  a[href^="http"]::after{content:" ("attr(href)")";font-size:8.5pt;color:#666;word-break:break-all}
  pre,blockquote,code{background:#f5f5f5!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  th{background:#efefef!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  table{font-size:9.5pt}
}
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <small>RingIn · Tier 1+2 Progress · ${new Date().toLocaleDateString()}</small>
    <button onclick="window.print()">Save as PDF</button>
  </div>
  <article id="content"><div style="padding:80px 0;text-align:center;color:#888">Rendering…</div></article>
</div>
<script id="md-source" type="text/markdown">${safeMd}</script>
<script>
(function(){function r(){if(typeof marked==='undefined')return setTimeout(r,80);var s=document.getElementById('md-source').textContent;var h=marked.parse(s,{gfm:true,breaks:false,headerIds:true});var a=document.getElementById('content');a.innerHTML=h;a.querySelectorAll('a[href^="http"]').forEach(function(x){x.target='_blank';x.rel='noreferrer noopener'});a.querySelectorAll('table').forEach(function(t){var w=document.createElement('div');w.className='table-wrap';t.parentNode.insertBefore(w,t);w.appendChild(t)});document.documentElement.setAttribute('data-rendered','1')}r()})();
</script>
</body></html>`;

fs.writeFileSync(HTML_OUT, html);
console.log('wrote', HTML_OUT, html.length, 'bytes');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
if (!CHROME) { console.warn('no Chrome — HTML only'); process.exit(0); }
const fileUrl = 'file:///' + path.resolve(HTML_OUT).replace(/\\/g,'/');
try {
  execFileSync(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--no-pdf-header-footer','--virtual-time-budget=10000','--print-to-pdf=' + path.resolve(PDF_OUT), fileUrl], { stdio:'inherit' });
  console.log('wrote', PDF_OUT, fs.statSync(PDF_OUT).size, 'bytes');
} catch (e) { console.error('PDF failed:', e.message); }
