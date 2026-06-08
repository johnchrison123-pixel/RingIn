/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// Service-worker registration helper.
//
// Defaults are conservative:
//   • Only runs in production (NODE_ENV === 'production'). Skips in dev so it
//     doesn't fight react-scripts hot-reloading.
//   • Defers registration until after `window.load` so it never competes with
//     React's initial mount.
//   • Detects same-origin scope so it works on Vercel previews AND the prod
//     domain without config.
//   • On finding a new waiting SW, sends it SKIP_WAITING so the next page
//     load picks up the new code automatically. We deliberately do NOT
//     force a reload — that would interrupt anyone mid-call.
// ──────────────────────────────────────────────────────────────────────────

export function registerAppShellSW(){
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Skip in dev — react-scripts' webpack-dev-server doesn't play well with SW caching.
  if (process.env.NODE_ENV !== 'production') return;

  /* R61 CRITICAL FIX: skip SW entirely on native Capacitor (APK / iOS app).
   *
   * Why: the SW caches index.html + the static/ JS chunks for offline use.
   * When the Capgo OTA plugin swaps in a new bundle and triggers a reload,
   * the WebView fetches /index.html — which the SW intercepts and serves
   * from cache (the OLD index.html, pointing at the OLD JS chunks). The
   * result: localStorage `ringin_ota_current_version` updates to the new
   * version (we wrote it pre-reload), but the actual code running is the
   * stale cached bundle. This has silently no-op'd every native OTA update
   * since the SW was first added. Web users still need the SW for the
   * install-to-home-screen + offline-start benefits.
   *
   * Also: if a SW was registered in a prior bundle, unregister it now and
   * nuke all caches so the post-rebuild APK starts clean. */
  try {
    var Cap = window.Capacitor;
    var isNative = Cap && (
      (typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform()) ||
      (typeof Cap.getPlatform === 'function' && Cap.getPlatform() !== 'web')
    );
    if (isNative) {
      try {
        navigator.serviceWorker.getRegistrations().then(function(regs){
          regs.forEach(function(r){
            try { r.unregister(); } catch(_){}
          });
        });
      } catch(_){}
      try {
        if (typeof caches !== 'undefined' && caches.keys) {
          caches.keys().then(function(keys){
            keys.forEach(function(k){
              try { caches.delete(k); } catch(_){}
            });
          });
        }
      } catch(_){}
      try { console.log('[ringin] SW skipped on native — Capgo OTA handles updates'); } catch(_){}
      return;
    }
  } catch(_){}

  // Expose an apply-update function the UI banner can call. It tells the
  // waiting SW to take over and reloads when it does. Defined on window so
  // the React component can call it without prop drilling through the SW
  // registration helper.
  if (typeof window !== 'undefined' && !window.__ringinApplySWUpdate){
    window.__ringinApplySWUpdate = function(){
      try{
        if (!navigator || !navigator.serviceWorker) return;
        navigator.serviceWorker.getRegistration().then(function(reg){
          if (!reg || !reg.waiting) {
            // No waiting SW — just reload to be safe
            try{ window.location.reload(); }catch(_){}
            return;
          }
          // When the new SW takes control, refresh so its code runs
          var listener = function(){
            try{ navigator.serviceWorker.removeEventListener('controllerchange', listener); }catch(_){}
            try{ window.location.reload(); }catch(_){}
          };
          navigator.serviceWorker.addEventListener('controllerchange', listener);
          // Hand off control
          try{ reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }catch(_){}
        });
      }catch(_){}
    };
  }

  // Defer to idle/load so SW registration never delays first paint.
  function go(){
    try{
      /* R20 FIX #8: add cache-busting query param so browsers can't serve a
       * stale /sw.js from HTTP cache. Without this, if Vercel's static-asset
       * cache headers ever changed to allow caching of /sw.js, clients would
       * be stuck on whatever SW version they had registered until something
       * else forced an update. The query param doesn't change the SW file's
       * cache identity (browsers byte-compare the file body, not the URL),
       * but it ensures the FETCH of /sw.js bypasses HTTP cache. Using the
       * REACT_APP_BUILD_ID env var if available, otherwise a hardcoded
       * fallback that we bump per deploy (or just timestamp). */
      var swVer = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BUILD_ID)
        ? process.env.REACT_APP_BUILD_ID
        : 'v23'; // R20 bump (was no cache-buster); bump per round
      navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(swVer), { scope: '/', updateViaCache: 'none' })
        .then(function(reg){
          // Watch for updates. When a new SW finishes installing AND there's
          // already an active controller (so this isn't the first-ever
          // install), broadcast a window event so the React banner can
          // surface the "update ready" pill. We deliberately do NOT auto-
          // skipWaiting anymore — the user taps the banner to apply.
          if (reg && reg.addEventListener){
            function watchInstall(sw){
              if (!sw) return;
              sw.addEventListener('statechange', function(){
                if (sw.state === 'installed' && navigator.serviceWorker.controller){
                  try{ window.dispatchEvent(new Event('ringin-sw-update-available')); }catch(_){}
                }
              });
            }
            // Catch a SW already installing (page loaded between install + activate)
            if (reg.installing) watchInstall(reg.installing);
            // Catch new SWs found later while the app stays open
            reg.addEventListener('updatefound', function(){ watchInstall(reg.installing); });
            // If a SW is already waiting (from a previous session), surface immediately
            if (reg.waiting && navigator.serviceWorker.controller){
              try{ window.dispatchEvent(new Event('ringin-sw-update-available')); }catch(_){}
            }
            // Periodic update check while the app stays open (every 60 min)
            setInterval(function(){ try{ reg.update(); }catch(e){} }, 60 * 60 * 1000);
          }
        })
        .catch(function(err){
          // Don't crash the app if SW registration fails — the site keeps working
          // exactly as before, just without the install/offline benefits.
          try{ console.warn('[ringin] SW registration failed:', err && err.message); }catch(e){}
        });
    }catch(e){
      try{ console.warn('[ringin] SW registration threw:', e && e.message); }catch(e2){}
    }
  }

  if (document.readyState === 'complete') {
    // Already loaded — defer one tick anyway so we don't block anything synchronous
    setTimeout(go, 0);
  } else {
    window.addEventListener('load', go, { once: true });
  }
}
