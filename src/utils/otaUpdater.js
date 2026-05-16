/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// otaUpdater.js — self-hosted OTA web-bundle updates for the Capacitor APK.
//
// USER FLOW (post-rewrite, no more silent auto-download):
//   1. On native app start, after 4s, fetch /bundles/latest.json.
//   2. If a newer version exists, fire onAvailable(info) with title +
//      release notes. NOTHING is downloaded yet.
//   3. UpdatePrompt shows a neon-green popup with the notes + Update button.
//   4. User taps Update → downloadAndApply() pulls the bundle, reports
//      progress, sets it, sets `ringin_just_updated=1`, then reloads.
//   5. After reload, the freshly-mounted UpdatePrompt sees the flag and
//      shows a brief frosted "finishing up" overlay so the user never
//      sees a blank page — then fades out once the app is interactive.
//
// Web (PWA) uses the service worker for updates; native path is the
// Capgo CapacitorUpdater plugin for binary bundle swaps.
// ──────────────────────────────────────────────────────────────────────────

// IMPORTANT: We host the OTA manifest + bundle zips on raw.githubusercontent.com
// instead of Vercel because Vercel's CDN is currently serving the React SPA
// fallback for every URL on ring-in.vercel.app (including .json and .zip),
// which breaks the manifest fetch (response is HTML, JSON.parse throws).
// GitHub raw is a flat CDN — no SPA fallback, returns the file as-is.
var MANIFEST_URL = 'https://raw.githubusercontent.com/johnchrison123-pixel/RingIn/main/public/bundles/latest.json';
var CURRENT_VERSION_KEY = 'ringin_ota_current_version';

function isNative(){
  try {
    if (typeof window === 'undefined') return false;
    var Cap = window.Capacitor;
    if (!Cap) return false;
    if (typeof Cap.isNativePlatform === 'function') return Cap.isNativePlatform();
    if (typeof Cap.getPlatform === 'function') return Cap.getPlatform() !== 'web';
    return false;
  } catch (_) { return false; }
}

function getCapgo(){
  try {
    var Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
    return Plugins.CapacitorUpdater || null;
  } catch (_) { return null; }
}

function getCurrentVersion(){
  try { return localStorage.getItem(CURRENT_VERSION_KEY) || '0.0.0'; } catch (_) { return '0.0.0'; }
}

function setCurrentVersion(v){
  try { localStorage.setItem(CURRENT_VERSION_KEY, v); } catch (_) {}
}

// Compare semver-ish versions. Treats 1.2.3 > 1.2.2. If either side is
// non-semver (e.g. a git sha), falls back to lexicographic compare which
// is fine because our publish workflow uses YYYY.MMDD.HHMM monotonically.
function isNewer(a, b){
  if (!a) return true;
  if (!b) return false;
  var pa = String(a).split(/[.\-]/).map(function(x){ return parseInt(x, 10); });
  var pb = String(b).split(/[.\-]/).map(function(x){ return parseInt(x, 10); });
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var na = pa[i] || 0;
    var nb = pb[i] || 0;
    if (isNaN(na) || isNaN(nb)) return String(a) > String(b);
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

// Check the manifest WITHOUT downloading. Returns the new version's
// metadata (title, notes, url) so the popup can show release notes
// alongside the Update button. User must tap Update to download.
export async function checkOnly() {
  if (!isNative()) return { available: false, reason: 'web' };
  var Capgo = getCapgo();
  if (!Capgo) return { available: false, reason: 'plugin-missing' };
  try { await Capgo.notifyAppReady(); } catch (_) {}
  var manifest;
  try {
    var res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return { available: false, reason: 'manifest-' + res.status };
    manifest = await res.json();
  } catch (e) {
    return { available: false, reason: 'manifest-fetch-failed', error: e && e.message };
  }
  if (!manifest || !manifest.version || !manifest.url) {
    return { available: false, reason: 'manifest-malformed' };
  }
  var current = getCurrentVersion();
  if (!isNewer(manifest.version, current)) {
    return { available: false, reason: 'already-current', current: current };
  }
  return {
    available: true,
    version: manifest.version,
    url: manifest.url,
    title: manifest.title || 'New RingIn update',
    notes: Array.isArray(manifest.notes) ? manifest.notes : [],
    current: current,
  };
}

// Download + activate + reload. Called when the user explicitly taps
// the Update button. onProgress(percent 0-100) fires repeatedly during
// the download so the frosted overlay can show real progress.
//
// Just before reload we set localStorage 'ringin_just_updated' = '1'
// — the freshly-mounted UpdatePrompt picks this up and briefly shows a
// "finishing up" overlay so the user never sees a blank page.
export async function downloadAndApply(version, url, onProgress) {
  var Capgo = getCapgo();
  if (!Capgo) {
    // Web fallback — just reload (SW handles bundle swap).
    try { localStorage.setItem('ringin_just_updated', '1'); } catch(_){}
    try { window.location.reload(); } catch(_){}
    return;
  }
  // Subscribe to Capgo download progress events if supported.
  var pluginListener = null;
  if (typeof Capgo.addListener === 'function' && typeof onProgress === 'function') {
    try {
      pluginListener = Capgo.addListener('download', function(info){
        try {
          var pct = (info && typeof info.percent === 'number') ? info.percent : 0;
          onProgress(Math.max(0, Math.min(100, pct)));
        } catch(_){}
      });
    } catch(_){}
  }
  try {
    try { console.log('[ringin OTA] downloading', version); } catch(_){}
    var bundle = await Capgo.download({ url: url, version: version });
    if (typeof onProgress === 'function') try { onProgress(90); } catch(_){}
    // CRITICAL: verify the bundle actually downloaded successfully.
    // If status is 'error' / 'pending', set() will silently do nothing
    // and we'll be left with the old bundle but a misleading "updated"
    // version label.
    if (bundle && bundle.status && bundle.status !== 'success' && bundle.status !== 'pending') {
      throw new Error('Bundle download failed: status=' + bundle.status);
    }
    try { console.log('[ringin OTA] downloaded bundle:', JSON.stringify(bundle)); } catch(_){}
    // Set the flags BEFORE set() because set() reloads immediately and
    // the JS context dies — anything after may never run.
    try { localStorage.setItem('ringin_just_updated', '1'); } catch(_){}
    setCurrentVersion(version);
    if (typeof onProgress === 'function') try { onProgress(95); } catch(_){}
    // Capgo's set() docs (line 230 of definitions.d.ts):
    //   "Set the current bundle and immediately reloads the app."
    // So we DON'T call reload() separately — set() does both. The
    // previous bug was calling reload() right after set() which sometimes
    // caused the reload to happen with the OLD bundle still active
    // (race between set's reload trigger and our explicit reload).
    await Capgo.set({ id: bundle.id });
    // If we get here without the app reloading, something went wrong.
    // Force a reload as a fallback.
    try { console.log('[ringin OTA] set() did not reload — forcing'); } catch(_){}
    if (typeof onProgress === 'function') try { onProgress(100); } catch(_){}
    setTimeout(function(){
      if (typeof Capgo.reload === 'function') {
        Capgo.reload().catch(function(){
          try { window.location.reload(); } catch(_){}
        });
      } else {
        try { window.location.reload(); } catch(_){}
      }
    }, 100);
  } finally {
    if (pluginListener && typeof pluginListener.remove === 'function') {
      try { await pluginListener.remove(); } catch(_){}
    }
  }
}

// Convenience entry point for App.js. Runs an opt-in check:
//   1. 4 seconds after app start
//   2. every 5 minutes thereafter (while online)
//   3. when the network goes offline → online
//   4. when the app comes from background → foreground (tab visible)
// Each time a newer bundle exists, onAvailable(info) fires so the popup
// can show. The popup itself only renders if not already visible — the
// user can dismiss and it'll come back on the next check.
export function startOtaUpdater(onAvailable){
  if (!isNative()) return;
  function doCheck(){
    try {
      checkOnly().then(function(r){
        try { console.log('[ringin OTA] check:', JSON.stringify(r)); } catch(_){}
        if (r && r.available && typeof onAvailable === 'function') {
          try { onAvailable(r); } catch(_){}
        }
      });
    } catch(_){}
  }
  // 1) Initial check after a short delay so boot isn't blocked.
  setTimeout(doCheck, 4000);
  // 2) Periodic check every 5 minutes.
  setInterval(doCheck, 5 * 60 * 1000);
  // 3) Re-check when device goes back online.
  try {
    window.addEventListener('online', doCheck);
  } catch(_){}
  // 4) Re-check when app comes back to foreground.
  try {
    document.addEventListener('visibilitychange', function(){
      if (!document.hidden) doCheck();
    });
  } catch(_){}
}

// Back-compat shim for the Profile screen's version pill, which calls
// checkForUpdate(). Returns the same shape as the old API so the alert
// branches still work, but routes through checkOnly + downloadAndApply
// when the user explicitly opts in via the alert dialog.
export async function checkForUpdate(){
  var r = await checkOnly();
  if (r && r.available) {
    // Don't auto-download here either — let the caller decide.
    return { ok: true, installed: r.version, prev: r.current, title: r.title, notes: r.notes, pending: true };
  }
  return { skipped: true, reason: (r && r.reason) || 'unknown' };
}

// Back-compat shim — old UpdatePrompt path called this to apply a
// previously-staged bundle. With the rewrite, downloadAndApply does
// the reload itself, so this is rarely needed. Kept so existing
// imports don't break.
export async function applyUpdateNow(){
  try { localStorage.setItem('ringin_just_updated', '1'); } catch(_){}
  var Capgo = getCapgo();
  if (Capgo && typeof Capgo.reload === 'function') {
    try { await Capgo.reload(); return; } catch(_){}
  }
  try { window.location.reload(); } catch(_){}
}
