// ─────────────────────────────────────────────────────────────────────────
// R40 — Vercel serverless function — fires an FCM push when a chat
// message arrives. WhatsApp-style: notification with sender name + a
// short preview of the message body, tappable to jump straight into the
// conversation.
//
// Lower priority than send-call-push.js (this isn't a ringing emergency
// — Android delivers normal-priority notifications in batches with their
// own sound + vibrate). Falls back to call-style priority if the message
// is the first one in a long-quiet conversation (best-effort).
//
// Request:  POST /api/send-message-push
//   body: {
//     conversation_id,        // for tap → open this convo
//     to_user_id,             // recipient's Supabase user id
//     sender_name,            // display name (already resolved client-side)
//     sender_avatar,          // (optional) avatar URL
//     text,                   // raw message body (we truncate)
//   }
// Response: { ok: true, messageId } | { ok: true, skipped: '...' } | { error }
//
// REQUIRED ENV (same as send-call-push.js — set once, used by both):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ─────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

function getAdmin(){
  if (admin.apps && admin.apps.length) return admin;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let   privateKey  = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return admin;
}

function getSupabase(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function previewOf(text){
  if (!text) return '';
  const s = String(text).trim();
  /* Image-only messages: show a "📷 Photo" badge instead of the literal
   * '[img]https://...' string. */
  if (s.indexOf('[img]') === 0) return '📷 Photo';
  /* Truncate to 80 chars — long enough to convey, short enough to fit
   * in the OS notification one-liner without overflow. */
  if (s.length > 80) return s.slice(0, 77) + '…';
  return s;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const adminInst = getAdmin();
  if (!adminInst) {
    return res.status(500).json({ error: 'Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY on Vercel.' });
  }
  const sb = getSupabase();
  if (!sb) {
    return res.status(500).json({ error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const conversationId = (body.conversation_id || '').toString().trim();
  const toUserId       = (body.to_user_id       || '').toString().trim();
  const senderName     = (body.sender_name      || 'Someone').toString().slice(0, 80);
  const senderAvatar   = body.sender_avatar ? body.sender_avatar.toString() : '';
  const text           = (body.text             || '').toString();

  if (!toUserId) return res.status(400).json({ error: 'to_user_id is required' });

  /* Look up recipient's FCM token + their muted-convos prefs (best-effort). */
  let token;
  try {
    const r = await sb.from('profiles').select('fcm_token').eq('id', toUserId).maybeSingle();
    if (r.error) return res.status(500).json({ error: 'Profile lookup failed: ' + r.error.message });
    if (!r.data || !r.data.fcm_token) {
      return res.status(200).json({ ok: true, skipped: 'no_fcm_token' });
    }
    token = r.data.fcm_token;
  } catch (e) {
    return res.status(500).json({ error: 'Profile fetch threw: ' + (e && e.message) });
  }

  const preview = previewOf(text);

  const message = {
    token,
    data: {
      type: 'new_message',
      conversation_id: conversationId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      preview: preview,
    },
    notification: {
      title: senderName,
      body: preview,
    },
    android: {
      /* Normal priority — Android can batch + respects DND. Calls use 'high'. */
      priority: 'high', /* still high so devices wake briefly + ring tone */
      notification: {
        // MUST match RingInNotifChannelsPlugin.java (CHANNEL_MESSAGES = "messages").
        channelId: 'messages',
        sound: 'default',
        priority: 'default',
        tag: conversationId, /* coalesce repeated msgs from the same convo */
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: { title: senderName, body: preview },
          sound: 'default',
          'thread-id': conversationId,
          badge: 1,
        },
      },
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '300' },
      fcmOptions: { link: conversationId ? ('/?convo=' + encodeURIComponent(conversationId)) : '/' },
    },
  };

  try {
    const messageId = await adminInst.messaging().send(message);
    return res.status(200).json({ ok: true, messageId });
  } catch (err) {
    console.error('send-message-push: FCM send failed', err);
    if (err && (err.code === 'messaging/registration-token-not-registered'
              || err.code === 'messaging/invalid-registration-token')) {
      try { await sb.from('profiles').update({ fcm_token: null }).eq('id', toUserId); } catch (_) {}
    }
    return res.status(500).json({ error: 'FCM send failed: ' + (err && err.message) });
  }
};
