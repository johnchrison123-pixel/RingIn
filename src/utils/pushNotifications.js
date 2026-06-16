/* eslint-disable */
import {requestNotificationPermission, onMessageListener} from './firebase';
import {sb} from './supabase';

// Native (Capacitor) detection — native uses @capacitor/push-notifications
// (real FCM on Android / APNs on iOS), which does NOT need the Web
// Notification/ServiceWorker APIs.
function isNativePlatform(){
  try{
    var Cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    return !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  }catch(_){ return false; }
}

export async function initPushNotifications(userId, onNotification){
  if(!userId) return;
  var native = isNativePlatform();
  // WEB ONLY: feature-detect the Web Push APIs. iOS Safari, private browsing,
  // and many embedded webviews don't have Notification + ServiceWorker — quietly
  // bail rather than throwing a console error every page load.
  // CRITICAL (R64): do NOT run this guard on native. The Capacitor Android/iOS
  // WebView usually has NO window.Notification, so this check was silently
  // aborting native push registration on EVERY device — no FCM token was ever
  // saved, so send-call-push found nothing to ring. This is why off-screen
  // call notifications never worked on any Android phone.
  if(!native){
    try{
      if(typeof window === 'undefined') return;
      if(!('Notification' in window)) return;
      if(!('serviceWorker' in navigator)) return;
    }catch(e){ return; }
  }
  try{
    var token = await requestNotificationPermission(userId, sb);
    // On native, requestNotificationPermission returns null BY DESIGN — the
    // FCM token arrives asynchronously via the 'registration' listener. So only
    // the WEB path may bail on a missing token; native must still wire
    // onMessageListener so foreground pushes + taps reach the app.
    if(!native && !token) return;
    onMessageListener(function(payload){
      if(!payload) return;
      if(onNotification) onNotification(payload);
    });
  }catch(e){
    // Don't log a noisy error — push notifications are best-effort
  }
}

export async function sendPushNotification(toUserId, title, body, data){
  // This should be called from a Supabase Edge Function in production
  // For now, save notification intent to Supabase and let edge function handle it
  if(!toUserId) return;
  try{
    await sb.from('push_queue').insert({
      to_user_id: toUserId,
      title: title,
      body: body,
      data: data || {},
      created_at: new Date().toISOString(),
    });
  }catch(e){
    console.error('Push queue error:', e.message);
  }
}
