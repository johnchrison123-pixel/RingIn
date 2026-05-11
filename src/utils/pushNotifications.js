/* eslint-disable */
import {requestNotificationPermission, onMessageListener} from './firebase';
import {sb} from './supabase';

export async function initPushNotifications(userId, onNotification){
  if(!userId) return;
  // Feature-detect first. iOS Safari, private browsing, and many embedded webviews
  // don't have Notification + ServiceWorker + Firebase Messaging — quietly bail rather
  // than throwing a console error every page load.
  try{
    if(typeof window === 'undefined') return;
    if(!('Notification' in window)) return;
    if(!('serviceWorker' in navigator)) return;
  }catch(e){ return; }
  try{
    var token = await requestNotificationPermission(userId, sb);
    if(!token) return;
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
