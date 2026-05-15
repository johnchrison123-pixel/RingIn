#!/usr/bin/env node
// Renders public/updates.html → public/updates.pdf via headless Chrome.
// Same pattern as generate-progress-pdf.mjs but skips the markdown step
// because updates.html is hand-authored.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const HTML_IN = path.join(ROOT, 'public', 'updates.html');
const PDF_OUT = path.join(ROOT, 'public', 'updates.pdf');

if (!fs.existsSync(HTML_IN)) { console.error('missing:', HTML_IN); process.exit(1); }

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => fs.existsSync(p));

if (!CHROME) { console.error('no Chrome found — install Chrome to generate PDF'); process.exit(1); }

const fileUrl = 'file:///' + path.resolve(HTML_IN).replace(/\\/g, '/');

try {
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--virtual-time-budget=10000',
    '--print-to-pdf=' + path.resolve(PDF_OUT),
    '--print-to-pdf-no-header',
    fileUrl,
  ], { stdio: 'inherit' });
  console.log('wrote', PDF_OUT, fs.statSync(PDF_OUT).size, 'bytes');
} catch (e) {
  console.error('PDF failed:', e.message);
  process.exit(1);
}
