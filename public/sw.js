/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// RingIn — App-shell Service Worker
//
// Purpose: make RingIn installable as a PWA and let it open instantly on slow
// connections. We're VERY deliberate about what gets cached, because caching
// the wrong thing would break Supabase realtime, Agora tokens, or live data.
//
// Strategy summary:
//   - NETWORK-ONLY (never cached, never intercepted):
//       • supabase.co        → all REST + Realtime websocket traffic
//       • /api/*             → Vercel serverless functions (incl. agora-token)
//       • agora.io / sd-rtn  → Agora's own signaling + media servers
//       • Firebase / FCM     → push messaging endpoints
//       • Any non-GET request (POST/PUT/DELETE/PATCH)
//       • WebSocket upgrade requests
//   - NETWORK-FIRST with cache fallback:
//       • Navigation requests (HTML) → fresh deploys propagate instantly,
//         offline opens last-known shell
//   - CACHE-FIRST with stale-while-revalidate:
//       • Hashed static assets (/static/js/*.js, /static/css/*.css, images)
//         — CRA fingerprints these so new builds get new URLs
//
// Coexists with public/firebase-messaging-sw.js — that one is registered at
// /firebase-messaging-sw.js and has its own scope. This one is at /sw.js.
// They do not conflict because we only listen for events relevant to the
// app-shell strategy and don't touch push messaging.
// ──────────────────────────────────────────────────────────────────────────

var CACHE_VERSION = 'ringin-v21';
var APP_SHELL_CACHE = CACHE_VERSION + '-shell';
var ASSET_CACHE     = CACHE_VERSION + '-assets';

// Files we proactively cache at install time so the app opens offline.
// Keep this list MINIMAL — only the entry HTML. Everything else (JS, CSS,
// images) gets cached lazily on first fetch via the runtime strategy below.
var PRECACHE_URLS = [
  '/',
  '/index.html',
];

// Host-allow-list for runtime caching. We never cache anything from hosts
// not in this list — protects Supabase / Agora / Firebase from accidental
// caching that would break realtime + auth + calling.
function isSameOriginStatic(url){
  try{
    var u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    // Don't cache the SW files themselves, source maps, or the manifest.
    if (/\/(sw|firebase-messaging-sw)\.js$/.test(u.pathname)) return false;
    if (/\.map$/.test(u.pathname)) return false;
    return true;
  }catch(e){ return false; }
}

// Anything we should NEVER intercept, no matter where it comes from.
function shouldBypass(request){
  try{
    var url = request.url || '';
    // Only handle GET. POSTs to /api/, supabase RPCs, etc. must always go through.
    if (request.method && request.method !== 'GET') return true;
    // Don't intercept range requests (audio streaming, video, etc.)
    if (request.headers && request.headers.get && request.headers.get('range')) return true;
    // Don't touch WebSocket upgrades
    if (url.indexOf('ws://') === 0 || url.indexOf('wss://') === 0) return true;
    // Third-party / dynamic services
    if (url.indexOf('supabase.co') !== -1) return true;
    if (url.indexOf('supabase.in') !== -1) return true;
    if (url.indexOf('agora.io') !== -1) return true;
    if (url.indexOf('sd-rtn.com') !== -1) return true;          // Agora media servers
    if (url.indexOf('agoraio.cn') !== -1) return true;
    if (url.indexOf('firebaseio.com') !== -1) return true;
    if (url.indexOf('googleapis.com') !== -1) return true;
    if (url.indexOf('fcm.googleapis.com') !== -1) return true;
    if (url.indexOf('gstatic.com') !== -1) return true;
    if (url.indexOf('jsdelivr.net') !== -1) return true;       // Eruda CDN
    // Same-origin /api/* routes (Vercel serverless functions)
    if (url.indexOf(self.location.origin + '/api/') === 0) return true;
    return false;
  }catch(e){ return true; }
}

self.addEventListener('install', function(event){
  // Precache the entry shell. Best-effort — if it fails, the SW still installs
  // and runtime caching will pick things up on first navigation.
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function(cache){
      return cache.addAll(PRECACHE_URLS).catch(function(){ /* offline at install? ignore */ });
    }).then(function(){
      // Take over from the previous SW (if any) as soon as we activate.
      // Safe because we don't break in-progress fetches — they continue against
      // whichever SW was handling them. The new SW only intercepts NEW fetches.
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      // Nuke caches from older versions of this SW.
      return Promise.all(keys.map(function(k){
        if (k !== APP_SHELL_CACHE && k !== ASSET_CACHE && k.indexOf('ringin-') === 0){
          return caches.delete(k);
        }
        return null;
      }));
    }).then(function(){
      // Claim existing clients (open tabs) so the new SW is in control immediately.
      // This is safe: we use network-first for HTML so any tab that's already open
      // will pick up the latest build on next navigation.
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event){
  var request = event.request;
  if (shouldBypass(request)) return; // let it hit the network normally

  // Navigation requests (the HTML document): NETWORK-FIRST so users always
  // get the latest deployed shell. Fall back to cache only when offline.
  if (request.mode === 'navigate'){
    event.respondWith(
      fetch(request).then(function(res){
        // Cache the latest copy of the shell for offline fallback
        var copy = res.clone();
        caches.open(APP_SHELL_CACHE).then(function(c){ try{ c.put('/index.html', copy); }catch(e){} });
        return res;
      }).catch(function(){
        return caches.match('/index.html').then(function(cached){
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // Lazy-loaded JS chunks (e.g. /static/js/agora-sdk.abc123.chunk.js):
  // NETWORK-FIRST. If we ever cache a partial/broken response — common when
  // a chunk request races a deploy — stale-while-revalidate would keep
  // serving that broken copy forever, breaking calls until the user nukes
  // their PWA. Fetching fresh each time costs an extra ~100ms but is
  // bulletproof. Cache is kept as offline fallback only.
  if (isSameOriginStatic(request.url) && /\.chunk\.js$/.test(new URL(request.url).pathname)){
    event.respondWith(
      fetch(request).then(function(res){
        if (res && res.status === 200 && res.type !== 'opaque'){
          var copy = res.clone();
          caches.open(ASSET_CACHE).then(function(c){ try{ c.put(request, copy); }catch(e){} });
        }
        return res;
      }).catch(function(){ return caches.match(request); })
    );
    return;
  }

  // Same-origin static assets: STALE-WHILE-REVALIDATE.
  // CRA fingerprints these (e.g., /static/js/main.abc123.js), so a cached
  // copy is always valid for the URL we have. New deploys produce new URLs,
  // so we never serve stale code — only stale icons/fonts at worst.
  if (isSameOriginStatic(request.url)){
    event.respondWith(
      caches.open(ASSET_CACHE).then(function(cache){
        return cache.match(request).then(function(cached){
          var network = fetch(request).then(function(res){
            // Don't cache opaque or error responses
            if (res && res.status === 200 && res.type !== 'opaque'){
              try{ cache.put(request, res.clone()); }catch(e){}
            }
            return res;
          }).catch(function(){ return cached; });
          // Return cached immediately if we have it, otherwise wait on network
          return cached || network;
        });
      })
    );
    return;
  }

  // Anything else: let it hit the network normally, no caching.
});

// Allow the page to force-activate a waiting SW after a deploy (used by the
// optional update notification in swRegistration.js). The page does:
//   navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'})
self.addEventListener('message', function(event){
  try{
    if (event && event.data && event.data.type === 'SKIP_WAITING'){
      self.skipWaiting();
    }
  }catch(e){}
});
