/* eslint-disable */
// Firebase Cloud Messaging setup
// Replace these with your actual Firebase config from console.firebase.google.com
var firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyCUg0EvH_4sWWZwrah53PiCl8L3-d3jkXQ',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'ring-in-23c07.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'ring-in-23c07',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'ring-in-23c07.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '849352826995',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:849352826995:web:2fd47580d8346e60b84a06',
  vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || 'BJVRM6-9tId75BVBkx48SUlAY2W_Z2pK8e-s5lhdkiLg7zRXA-hO1Ykt4V3RWAWrN3RjlzErH6GLM-0jJQoUx4M',
};

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
export async function requestNotificationPermission(userId, sb){
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
export function clearFcmToken(sb, userId){
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
var _onMessageUnsub = null;
export function onMessageListener(callback){
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
