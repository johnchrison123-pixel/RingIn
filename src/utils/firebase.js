/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────
// Push notification + FCM token management.
//
// R23 — split native vs web paths.
//
//   Web (PWA / desktop browser): keep using the Firebase JS SDK web push,
//   which requires the Web Push API + a service worker. Works in Chrome,
//   Edge, Firefox, and Safari 16.4+ (when installed as a PWA).
//
//   Native (Capacitor Android & iOS): use @capacitor/push-notifications
//   which routes through the real OS push systems (FCM on Android, APNs
//   on iOS). The Firebase JS SDK does NOT work inside Capacitor WKWebView
//   on iOS at all (no Web Push API) and is fragile on Android.
//
// Public API stays the same so the rest of the app doesn't change:
//   - requestNotificationPermission(userId, sb) → registers + persists token
//   - clearFcmToken(sb, userId)                 → wipes token on sign-out
//   - onMessageListener(callback)               → foreground-message hook
// ─────────────────────────────────────────────────────────────────────────

var firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyCUg0EvH_4sWWZwrah53PiCl8L3-d3jkXQ',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'ring-in-23c07.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'ring-in-23c07',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'ring-in-23c07.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '849352826995',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:849352826995:web:2fd47580d8346e60b84a06',
  vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || 'BJVRM6-9tId75BVBkx48SUlAY2W_Z2pK8e-s5lhdkiLg7zRXA-hO1Ykt4V3RWAWrN3RjlzErH6GLM-0jJQoUx4M',
};

function isNative(){
  try {
    var Cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    return !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  } catch(_) { return false; }
}

// ── Web path (Firebase JS SDK) ────────────────────────────────────────────
var _app = null;
var _messaging = null;

export function initFirebase(){
  if(!firebaseConfig.apiKey) return null;
  try{
    var firebase = require('firebase/app');
    var messaging = require('firebase/messaging');
    if(!_app){
      _app = firebase.initializeApp(firebaseConfig);
      _messaging = messaging.getMessaging(_app);
    }
    return _messaging;
  }catch(e){
    console.error('Firebase init error:', e.message);
    return null;
  }
}

/* R20 FIX #5: track whether we've already called requestPermission this
 * session. Per spec, browsers don't re-prompt after deny — calling it again
 * is wasted work AND on Firefox/Safari we then spend a getToken+DB roundtrip
 * we don't need. Also dedupe DB writes: only update profiles.fcm_token if
 * the value actually changed since last write (cached in fcm_token_<userId>). */
var _permissionAskedThisSession = false;

// Native (Capacitor) path — dedupes by tracking last-cached token in localStorage
// and module-scope unsubscribe handles for the listener so we don't stack them.
var _nativePushBootstrapped = false;
var _nativeRegHandle = null;
var _nativeErrHandle = null;
var _nativeRecvHandle = null;
var _nativeActHandle = null;
// Module-scope callbacks: each onMessageListener call overrides the prior
// (matches the web path's _onMessageUnsub behavior — never stacks).
var _foregroundCallback = null;
var _actionCallback = null;

async function bootstrapNativePush(userId, sb){
  if (_nativePushBootstrapped) return;
  try {
    var mod = await import('@capacitor/push-notifications');
    var PN = mod && (mod.PushNotifications || mod.default || mod);
    if (!PN || !PN.addListener) {
      console.warn('[ringin] @capacitor/push-notifications not available');
      return;
    }
    _nativePushBootstrapped = true;
    // Listen for the registration event → this is when Android/iOS hands us
    // the OS-issued token (FCM token on Android, APNs token on iOS).
    _nativeRegHandle = await PN.addListener('registration', function(t){
      try {
        var token = t && t.value;
        if (!token) return;
        if (userId && sb) {
          var cachedKey = 'fcm_token_' + userId;
          var lastToken = null;
          try { lastToken = localStorage.getItem(cachedKey); } catch(_){}
          if (lastToken !== token) {
            try { localStorage.setItem(cachedKey, token); } catch(_){}
            sb.from('profiles').update({fcm_token: token}).eq('id', userId).then(function(r){
              if (r && r.error) console.warn('[ringin] native push: fcm_token write failed:', r.error.message);
            });
          }
        }
      } catch (e) { console.warn('[ringin] native push registration handler error:', e); }
    });
    _nativeErrHandle = await PN.addListener('registrationError', function(err){
      console.warn('[ringin] native push registration error:', err);
    });
    // pushNotificationReceived fires when a push lands while the app is in the
    // FOREGROUND (background pushes go straight to the OS notif center). We
    // forward to the registered callback (set by onMessageListener) so the
    // existing in-app handling pipeline still fires.
    _nativeRecvHandle = await PN.addListener('pushNotificationReceived', function(notif){
      try {
        if (_foregroundCallback) {
          // Normalise to the same shape the web SDK's onMessage passes:
          // { notification: { title, body }, data: {...} }
          _foregroundCallback({
            notification: { title: notif && notif.title, body: notif && notif.body },
            data: (notif && notif.data) || {}
          });
        }
      } catch (e) { console.warn('[ringin] foregroundCallback error:', e); }
    });
    // pushNotificationActionPerformed fires when the user taps a notif (or
    // an action button) — same shape forwarding.
    _nativeActHandle = await PN.addListener('pushNotificationActionPerformed', function(action){
      try {
        if (_actionCallback) {
          _actionCallback({
            notification: { title: action && action.notification && action.notification.title, body: action && action.notification && action.notification.body },
            data: (action && action.notification && action.notification.data) || {},
            actionId: action && action.actionId
          });
        }
      } catch (e) { console.warn('[ringin] actionCallback error:', e); }
    });
  } catch (e) {
    console.warn('[ringin] @capacitor/push-notifications bootstrap failed:', e && e.message);
  }
}

export async function requestNotificationPermission(userId, sb){
  // ── NATIVE PATH (Capacitor Android / iOS) ───────────────────────────
  if (isNative()) {
    try {
      var mod = await import('@capacitor/push-notifications');
      var PN = mod && (mod.PushNotifications || mod.default || mod);
      if (!PN) { console.warn('[ringin] PushNotifications plugin missing'); return null; }
      // Permission ask (returns 'granted' | 'denied' | 'prompt').
      var permRes = await PN.requestPermissions();
      if (!permRes || permRes.receive !== 'granted') {
        return null;
      }
      // Wire listeners FIRST, then register — so the 'registration' event
      // (which fires immediately on success) doesn't race the listener wiring.
      await bootstrapNativePush(userId, sb);
      await PN.register();
      // Token arrives via the 'registration' listener (above), not here.
      return null; // we don't have the token synchronously on native
    } catch (e) {
      console.warn('[ringin] native push request error:', e && e.message);
      return null;
    }
  }

  // ── WEB PATH (Firebase JS SDK / PWA) ────────────────────────────────
  if(!('Notification' in window)){
    console.log('Browser does not support notifications');
    return null;
  }
  try{
    var messaging = initFirebase();
    if(!messaging) return null;

    var {getToken} = require('firebase/messaging');
    /* R20 FIX #5: gate on Notification.permission BEFORE calling requestPermission.
     * If 'denied', bail immediately — browser won't re-prompt anyway, and we
     * avoid the getToken roundtrip. If 'default', only ask ONCE per session
     * (guarded by _permissionAskedThisSession). If 'granted', skip the prompt
     * entirely and proceed directly to getToken. */
    var perm = (typeof Notification !== 'undefined' && Notification.permission) || 'default';
    if (perm === 'denied') return null;
    if (perm === 'default') {
      if (_permissionAskedThisSession) return null;
      _permissionAskedThisSession = true;
      var permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    }
    // perm === 'granted' (or just granted in the prompt above) — fetch token

    var token = await getToken(messaging, {vapidKey: firebaseConfig.vapidKey});
    if(token && userId && sb){
      /* R20 FIX #5: dedupe DB writes — only update profiles.fcm_token if it
       * actually differs from the last value we cached locally for this user.
       * Saves a write per hourly TOKEN_REFRESHED. */
      var cachedKey = 'fcm_token_' + userId;
      var lastToken = null;
      try { lastToken = localStorage.getItem(cachedKey); } catch(_){}
      if (lastToken !== token) {
        try { localStorage.setItem(cachedKey, token); } catch(_){}
        await sb.from('profiles').update({fcm_token: token}).eq('id', userId);
      }
    }
    return token;
  }catch(e){
    console.error('FCM token error:', e.message);
    return null;
  }
}

// R16 FIX #3: clear the fcm_token row when the user signs out, so the
// device doesn't keep receiving call pushes intended for the previous
// account. Called from App.js's SIGNED_OUT branch BEFORE the cache wipe.
// R23: also tears down native push listeners so they don't double-fire after
// the next user signs in.
export function clearFcmToken(sb, userId){
  // Native: remove listeners + ask plugin to clear delivered notifications.
  if (isNative()) {
    try {
      if (_nativeRegHandle && _nativeRegHandle.remove) { _nativeRegHandle.remove(); _nativeRegHandle = null; }
      if (_nativeErrHandle && _nativeErrHandle.remove) { _nativeErrHandle.remove(); _nativeErrHandle = null; }
      if (_nativeRecvHandle && _nativeRecvHandle.remove) { _nativeRecvHandle.remove(); _nativeRecvHandle = null; }
      if (_nativeActHandle && _nativeActHandle.remove) { _nativeActHandle.remove(); _nativeActHandle = null; }
      _nativePushBootstrapped = false;
    } catch(_){}
  }
  if(!sb || !userId) return;
  try{
    sb.from('profiles').update({fcm_token: null}).eq('id', userId).then(function(r){
      if(r && r.error) console.warn('[ringin] clearFcmToken error:', r.error.message);
    }).catch(function(e){ console.warn('[ringin] clearFcmToken reject:', e && e.message); });
  }catch(e){ console.warn('[ringin] clearFcmToken throw:', e && e.message); }
}

// R16 FIX #4: each onAuthStateChange call (including hourly TOKEN_REFRESHED)
// was registering a fresh onMessage listener — leaked listeners stacked up
// per hour and fired callback N times per push. Track the unsubscribe in
// module scope; cleanly unsub any prior listener before registering.
// R23: on native, just overrides the module-scope _foregroundCallback used
// by the persistent native listener — same single-callback contract.
var _onMessageUnsub = null;
export function onMessageListener(callback){
  // Native: the persistent PushNotifications listeners (set up in
  // bootstrapNativePush) call _foregroundCallback / _actionCallback. Just
  // store the new callback; the unsubscribe just nulls it back.
  if (isNative()) {
    if (callback) {
      _foregroundCallback = callback;
      // Also wire actions (tap) to the same callback so a single onMessage
      // contract handles both received-in-foreground AND user-tapped flows.
      _actionCallback = callback;
      return function unsub(){
        if (_foregroundCallback === callback) _foregroundCallback = null;
        if (_actionCallback === callback) _actionCallback = null;
      };
    }
    return Promise.resolve(null); // no legacy one-shot on native
  }
  var messaging = initFirebase();
  if(!messaging){
    if(callback) return function(){};
    return Promise.resolve(null);
  }
  try{
    var {onMessage} = require('firebase/messaging');
    if(callback){
      // Unsubscribe prior listener (if any) to prevent stacking on reauth.
      if (_onMessageUnsub) { try { _onMessageUnsub(); } catch(_){} _onMessageUnsub = null; }
      try {
        _onMessageUnsub = onMessage(messaging, function(payload){
          callback(payload);
        });
      } catch (e) {
        _onMessageUnsub = null;
      }
      return function unsub(){
        if (_onMessageUnsub) { try { _onMessageUnsub(); } catch(_){} _onMessageUnsub = null; }
      };
    }
    // Legacy one-shot promise (kept for backwards compat)
    return new Promise(function(resolve){
      var unsub = onMessage(messaging, function(payload){
        unsub();
        resolve(payload);
      });
    });
  }catch(e){
    if(callback) return function(){};
    return Promise.resolve(null);
  }
}
