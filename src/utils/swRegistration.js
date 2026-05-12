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

  // Defer to idle/load so SW registration never delays first paint.
  function go(){
    try{
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function(reg){
          // Watch for updates. When a new SW is found and finishes installing,
          // tell it to skip waiting so it becomes active on next navigation.
          // (We don't force-reload — see top comment.)
          if (reg && reg.addEventListener){
            reg.addEventListener('updatefound', function(){
              var newSW = reg.installing;
              if (newSW){
                newSW.addEventListener('statechange', function(){
                  if (newSW.state === 'installed' && navigator.serviceWorker.controller){
                    try{ newSW.postMessage({ type: 'SKIP_WAITING' }); }catch(e){}
                  }
                });
              }
            });
            // Also poke for updates every 60 min while the app stays open
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
