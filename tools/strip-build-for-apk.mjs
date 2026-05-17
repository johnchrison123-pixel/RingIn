#!/usr/bin/env node
/**
 * strip-build-for-apk.mjs
 *
 * Strips non-app assets from build/ before `npx cap sync android`.
 *
 * Why: CRA copies every file in public/ to build/. We use public/ as the
 * staging area for OTA bundles + audit/progress/research PDFs that are
 * served to users via raw.githubusercontent.com. Those files should NOT
 * be packed into the Android APK — they balloon the install from ~13 MB
 * to ~280+ MB and accomplish nothing (the OTA fetcher reads the manifest
 * from GitHub raw, not from in-APK assets).
 *
 * Run this AFTER `npm run build` and BEFORE `npx cap sync android`.
 *
 * Idempotent. Safe to re-run.
 */

import { rm, stat, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(__dirname, '..', 'build');

// Top-level entries to remove (relative to build/)
const DIRS_TO_REMOVE = ['bundles'];
const FILES_TO_REMOVE = [
  'audit.html', 'audit.pdf',
  'audit-fixes.html', 'audit-fixes.pdf',
  'progress.html', 'progress.pdf',
  'research-2026.html', 'research-2026.md', 'research-2026.pdf',
  'updates.html', 'updates.pdf',
  'strategy.html',
];

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function dirSize(p) {
  let total = 0;
  try {
    const entries = await readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const child = join(p, e.name);
      if (e.isDirectory()) total += await dirSize(child);
      else { const s = await stat(child); total += s.size; }
    }
  } catch {}
  return total;
}

function fmt(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

async function main() {
  if (!await exists(BUILD)) {
    console.error('[strip-build-for-apk] build/ not found — run `npm run build` first');
    process.exit(1);
  }

  const beforeSize = await dirSize(BUILD);
  let removed = 0;

  for (const d of DIRS_TO_REMOVE) {
    const p = join(BUILD, d);
    if (await exists(p)) {
      const sz = await dirSize(p);
      await rm(p, { recursive: true, force: true });
      console.log(`  - removed dir  ${d}/ (${fmt(sz)})`);
      removed += sz;
    }
  }
  for (const f of FILES_TO_REMOVE) {
    const p = join(BUILD, f);
    if (await exists(p)) {
      const sz = (await stat(p)).size;
      await rm(p, { force: true });
      console.log(`  - removed file ${f} (${fmt(sz)})`);
      removed += sz;
    }
  }

  const afterSize = await dirSize(BUILD);
  console.log(`[strip-build-for-apk] build/ size: ${fmt(beforeSize)} → ${fmt(afterSize)} (saved ${fmt(removed)})`);
}

main().catch(err => {
  console.error('[strip-build-for-apk] failed:', err);
  process.exit(1);
});
