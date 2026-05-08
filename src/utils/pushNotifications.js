/* eslint-disable */
import {requestNotificationPermission, onMessageListener} from './firebase';
import {sb} from './supabase';

export async function initPushNotifications(userId, onNotification){
  if(!userId) return;
  // Request permission and get token
  var token = await requestNotificationPermission(userId, sb);
  if(!token) return;
  // Listen for foreground messages (persistent — fires on every message)
  onMessageListener(function(payload){
    if(!payload) return;
    if(onNotification) onNotification(payload);
  });
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
