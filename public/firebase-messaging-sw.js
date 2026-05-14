/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────
// Firebase Messaging Service Worker — handles push notifications when the
// PWA is BACKGROUNDED or fully CLOSED. This is what lets RingIn ring on
// the lock screen / from cold-start.
//
// Two payload types we recognize, via the FCM `data` field:
//   - `incoming_call`  → high-priority Accept/Decline notification that
//                        opens the PWA at /?invite=<id> on click. The app's
//                        invite-param handler reads that and pops the
//                        IncomingCallModal immediately.
//   - anything else    → plain notification (message, like, follow, etc.)
//
// Must live at the ROOT of the domain (public/firebase-messaging-sw.js)
// because FCM auto-registers it at /firebase-messaging-sw.js scope.
// ─────────────────────────────────────────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

var firebaseConfig = {
  apiKey: 'AIzaSyCUg0EvH_4sWWZwrah53PiCl8L3-d3jkXQ',
  authDomain: 'ring-in-23c07.firebaseapp.com',
  projectId: 'ring-in-23c07',
  storageBucket: 'ring-in-23c07.firebasestorage.app',
  messagingSenderId: '849352826995',
  appId: '1:849352826995:web:2fd47580d8346e60b84a06',
};

firebase.initializeApp(firebaseConfig);
var messaging = firebase.messaging();

// ── Helper: open or focus the RingIn PWA at a given URL.
// If a RingIn window is already open, focus it and navigate. Otherwise
// open a fresh window. Used by both call-accept and notification-click.
function openOrFocusApp(url){
  return self.clients.matchAll({ type:'window', includeUncontrolled:true })
    .then(function(clientList){
      // Prefer an already-open RingIn tab/PWA
      for (var i = 0; i < clientList.length; i++){
        var c = clientList[i];
        if (c.url.indexOf(self.location.origin) === 0){
          try{ c.postMessage({ type:'navigate', url:url }); }catch(_){}
          return c.focus();
        }
      }
      // No existing window — open a new one
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    });
}

messaging.onBackgroundMessage(function(payload){
  var data = (payload && payload.data) || {};
  var notification = (payload && payload.notification) || {};

  // ── Incoming call — high-priority, vibrate, Accept/Decline ────────────
  if (data.type === 'incoming_call'){
    var callerName = data.caller_name || notification.title || 'Someone';
    var inviteId   = data.invite_id   || '';
    var callerAvatar = data.caller_avatar || '/logo192.png';

    var title = 'Incoming Call';
    var options = {
      body: callerName + ' is calling you',
      icon: callerAvatar,
      badge: '/logo192.png',
      // tag prevents dupes if FCM retries; ringin-call-<id> = unique per call
      tag: 'ringin-call-' + inviteId,
      renotify: true,
      requireInteraction: true,   // stays visible until user interacts
      vibrate: [400, 200, 400, 200, 400, 200, 400],
      data: { type:'incoming_call', invite_id: inviteId, caller_name: callerName },
      actions: [
        { action: 'accept',  title: 'Accept' },
        { action: 'decline', title: 'Decline' },
      ],
      // High-priority hints (some platforms only)
      priority: 'high',
      silent: false,
    };
    return self.registration.showNotification(title, options);
  }

  // ── Generic notification (messages, likes, follows, etc.) ─────────────
  var t = notification.title || 'RingIn';
  var b = notification.body  || 'You have a new notification';
  return self.registration.showNotification(t, {
    body: b,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: data || {},
    tag: data.tag || ('ringin-' + Date.now()),
  });
});

// ── Notification interactions ────────────────────────────────────────────
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var data = (event.notification && event.notification.data) || {};
  var action = event.action;

  // Incoming-call actions
  if (data.type === 'incoming_call' && data.invite_id){
    if (action === 'decline'){
      // Best-effort decline: open a short-lived page that updates the invite
      // to status=rejected, then closes. The page handles auth + Supabase.
      event.waitUntil(openOrFocusApp('/?invite=' + encodeURIComponent(data.invite_id) + '&action=decline'));
      return;
    }
    // Accept (or any other click on the body)
    event.waitUntil(openOrFocusApp('/?invite=' + encodeURIComponent(data.invite_id) + '&action=accept'));
    return;
  }

  // Generic: open the app at the URL stashed in data.url, or just root
  var url = data.url || '/';
  event.waitUntil(openOrFocusApp(url));
});

// Fired if the user dismisses/swipes the notification without acting on it.
// We don't auto-reject — the caller's 35s ring-timeout takes care of it.
self.addEventListener('notificationclose', function(event){
  // Could write analytics here. Best-effort, no-op for now.
});
