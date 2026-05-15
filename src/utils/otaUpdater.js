/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// otaUpdater.js — self-hosted OTA web-bundle updates for the Capacitor APK.
//
// On native app start:
//   1. Mark the currently-running bundle as "good" (notifyAppReady).
//   2. Fetch /bundles/latest.json from ring-in.vercel.app.
//   3. If version > current installed version:
//        - download the bundle zip
//        - set it as next bundle
//        - schedule a reload on next safe moment (when user backgrounds OR
//          after they next return)
//   4. On any startup that crashes within 30 sec of an update, the Capgo
//      plugin auto-rolls back to the previous bundle.
//
// Web (PWA) does nothing — it already updates via the service worker.
// ──────────────────────────────────────────────────────────────────────────

var MANIFEST_URL = 'https://ring-in.vercel.app/bundles/latest.json';
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

export async function checkForUpdate() {
  if (!isNative()) return { skipped: true, reason: 'web' };
  var Capgo = getCapgo();
  if (!Capgo) return { skipped: true, reason: 'plugin-missing' };

  // Tell Capgo the current bundle is healthy (otherwise it rolls back).
  try { await Capgo.notifyAppReady(); } catch (_) {}

  var manifest;
  try {
    var res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return { skipped: true, reason: 'manifest-' + res.status };
    manifest = await res.json();
  } catch (e) {
    return { skipped: true, reason: 'manifest-fetch-failed', error: e && e.message };
  }

  if (!manifest || !manifest.version || !manifest.url) {
    return { skipped: true, reason: 'manifest-malformed' };
  }

  var current = getCurrentVersion();
  if (!isNewer(manifest.version, current)) {
    return { skipped: true, reason: 'already-current', current: current };
  }

  try {
    try { console.log('[ringin OTA] downloading', manifest.version, 'from', manifest.url); } catch(_){}
    var bundle = await Capgo.download({
      url: manifest.url,
      version: manifest.version,
    });
    await Capgo.set({ id: bundle.id });
    setCurrentVersion(manifest.version);
    try { console.log('[ringin OTA] installed', manifest.version, '— will activate on next reload'); } catch(_){}
    return { ok: true, installed: manifest.version, prev: current };
  } catch (e) {
    return { error: e && e.message };
  }
}

// Convenience entry point for App.js useEffect.
export function startOtaUpdater(){
  if (!isNative()) return;
  // Defer slightly so app boot isn't blocked by network.
  setTimeout(function(){
    checkForUpdate().then(function(r){
      try { console.log('[ringin OTA] check:', JSON.stringify(r)); } catch(_){}
    });
  }, 4000);
}
