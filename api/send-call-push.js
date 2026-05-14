// ─────────────────────────────────────────────────────────────────────────
// Vercel serverless function — fires a high-priority FCM push to the
// callee's device when an incoming call is created. This is what lets the
// RingIn PWA ring on the lock screen / from a fully-closed state.
//
// Request:  POST /api/send-call-push
//   body: {
//     invite_id,              // call_invites.id (UUID)
//     callee_id,              // Supabase user id of the recipient
//     caller_name,            // display name shown in the notification
//     caller_avatar           // (optional) avatar URL for the icon
//   }
// Response: { ok: true, messageId } on success; { error } on failure.
//
// ─────────────────────────────────────────────────────────────────────────
// REQUIRED ENV VARS on Vercel (Project Settings → Environment Variables):
//
//   FIREBASE_PROJECT_ID         e.g. 'ring-in-23c07'
//   FIREBASE_CLIENT_EMAIL       e.g. 'firebase-adminsdk-...@<project>.iam.gserviceaccount.com'
//   FIREBASE_PRIVATE_KEY        the private_key field from the service
//                               account JSON (with literal \n line breaks).
//                               In Vercel, paste with \n; we replace them
//                               with real newlines below.
//   SUPABASE_URL                from project settings
//   SUPABASE_SERVICE_ROLE_KEY   service_role key (NOT anon) — server-side
//                               only, never expose to the client.
//
// All five must exist or this function will return 500.
// ─────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Initialize Firebase Admin (only once per Vercel cold-start)
function getAdmin(){
  if (admin.apps && admin.apps.length) return admin;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let   privateKey  = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;
  // Vercel stores newlines as the literal string "\n" — convert to real \n
  privateKey = privateKey.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return admin;
}

// Server-side Supabase client (uses service_role key — bypasses RLS).
// Only safe because this is a server function; never expose this key.
function getSupabase(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = async (req, res) => {
  // CORS — same pattern as agora-token.js
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const adminInst = getAdmin();
  if (!adminInst) {
    return res.status(500).json({
      error: 'Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY on Vercel.',
    });
  }
  const sb = getSupabase();
  if (!sb) {
    return res.status(500).json({
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.',
    });
  }

  // Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const inviteId    = (body.invite_id    || '').toString().trim();
  const calleeId    = (body.callee_id    || '').toString().trim();
  const callerName  = (body.caller_name  || 'Someone').toString();
  const callerAvatar = body.caller_avatar ? body.caller_avatar.toString() : '';

  if (!inviteId || !calleeId) {
    return res.status(400).json({ error: 'invite_id and callee_id are required' });
  }

  // Look up the callee's FCM token
  let token;
  try {
    const r = await sb
      .from('profiles')
      .select('fcm_token, full_name')
      .eq('id', calleeId)
      .maybeSingle();
    if (r.error) {
      console.error('send-call-push: profiles lookup error', r.error);
      return res.status(500).json({ error: 'Profile lookup failed: ' + r.error.message });
    }
    if (!r.data || !r.data.fcm_token) {
      // No token = callee hasn't granted notification permission yet.
      // Not an error — the realtime listener will still fire when the
      // PWA is open. We just can't wake them from a closed state.
      return res.status(200).json({ ok: true, skipped: 'no_fcm_token' });
    }
    token = r.data.fcm_token;
  } catch (e) {
    console.error('send-call-push: profile fetch threw', e);
    return res.status(500).json({ error: 'Profile fetch threw: ' + (e && e.message) });
  }

  // Build the FCM payload. `data` is what the service worker reads.
  // `notification` is the fallback for platforms that don't run the SW
  // handler (some background states on Android).
  const message = {
    token,
    data: {
      type: 'incoming_call',
      invite_id: inviteId,
      caller_name: callerName,
      caller_avatar: callerAvatar,
    },
    notification: {
      title: 'Incoming Call',
      body: callerName + ' is calling you',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'ringin_calls',
        sound: 'default',
        priority: 'max',
        // Vibration handled by the SW notification options too
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: { title: 'Incoming Call', body: callerName + ' is calling you' },
          sound: 'default',
          badge: 1,
          // iOS-specific call handling. PWAs can't access CallKit, but
          // mutable-content lets the service worker mutate before display.
          'mutable-content': 1,
        },
      },
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '60' },
      fcmOptions: { link: '/?invite=' + encodeURIComponent(inviteId) + '&action=accept' },
    },
  };

  try {
    const messageId = await adminInst.messaging().send(message);
    return res.status(200).json({ ok: true, messageId });
  } catch (err) {
    console.error('send-call-push: FCM send failed', err);
    // If the token is invalid / expired, blank it out so we stop retrying
    if (err && (err.code === 'messaging/registration-token-not-registered'
              || err.code === 'messaging/invalid-registration-token')) {
      try {
        await sb.from('profiles').update({ fcm_token: null }).eq('id', calleeId);
      } catch (_) { /* best-effort */ }
    }
    return res.status(500).json({ error: 'FCM send failed: ' + (err && err.message) });
  }
};
