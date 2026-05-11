/* eslint-disable */
// ────────────────────────────────────────────────────────────────────────────
// RingIn Agora wrapper — joins a channel, publishes microphone, plays remote
// audio. Tokens are fetched from /api/agora-token (which keeps the App
// Certificate server-side). The App ID is public (loaded from REACT_APP env).
// ────────────────────────────────────────────────────────────────────────────
import AgoraRTC from 'agora-rtc-sdk-ng';

var APP_ID = process.env.REACT_APP_AGORA_APP_ID || 'a0d22a99058142b2af0d18e3e570b880';

// Allow override of the token endpoint when running locally
var TOKEN_URL = process.env.REACT_APP_AGORA_TOKEN_URL || '/api/agora-token';

// Quiet down Agora's verbose logs in production
try { AgoraRTC.setLogLevel(3); } catch (e) {}

// Build a uint32 numeric Agora UID from a Supabase user-id (UUID string) so we
// can dedupe across reconnects. Agora UIDs must be 0–4_294_967_295 integers.
export function hashUidToInt(s) {
  if (!s) return 0;
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  // make positive uint32
  return ((h >>> 0) % 4000000000) + 1;
}

async function fetchToken(channel, uid) {
  var res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channel, uid: uid }),
  });
  if (!res.ok) {
    var text = '';
    try { text = await res.text(); } catch (e) {}
    throw new Error('Token endpoint ' + res.status + ': ' + text);
  }
  return await res.json();
}

// One-shot call session. Returns a controller object with leave/setMuted hooks.
//
// Options:
//   channel          string  required — Agora channel name
//   uidString        string  required — caller's Supabase user id (used to derive uint32 uid)
//   onRemoteJoined   fn      optional — fires when the other peer joins
//   onRemoteLeft     fn      optional — fires when peer leaves
//   onError          fn      optional — fires on join/publish failure
//   onConnectionState fn     optional — passes Agora connection state changes
//
// Returns a Promise resolving to:
//   { leave(), setMuted(bool), client, localAudioTrack }
export async function startCallSession(opts) {
  if (!opts || !opts.channel || !opts.uidString) {
    throw new Error('startCallSession: channel and uidString required');
  }
  var uid = hashUidToInt(opts.uidString);
  var tokenData;
  try {
    tokenData = await fetchToken(opts.channel, uid);
  } catch (e) {
    if (opts.onError) opts.onError(new Error('Token fetch failed: ' + e.message));
    throw e;
  }

  var client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  var localAudioTrack = null;
  var remoteUsers = {};

  function attachRemoteAudio(user) {
    try {
      if (user && user.audioTrack) user.audioTrack.play();
    } catch (e) { /* ignore */ }
  }

  // Flip UI to "connected" the moment the peer joins the channel — don't wait for them
  // to publish audio. Audio attaches a moment later via user-published.
  var notifiedJoined = {};
  function notifyJoinedOnce(user){
    if (!user || notifiedJoined[user.uid]) return;
    notifiedJoined[user.uid] = true;
    remoteUsers[user.uid] = user;
    if (opts.onRemoteJoined) opts.onRemoteJoined(user);
  }

  client.on('user-joined', function (user) {
    notifyJoinedOnce(user);
  });

  client.on('user-published', async function (user, mediaType) {
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        remoteUsers[user.uid] = user;
        attachRemoteAudio(user);
        notifyJoinedOnce(user); // safe — only fires once per user
      }
    } catch (e) {
      if (opts.onError) opts.onError(new Error('Subscribe failed: ' + e.message));
    }
  });

  client.on('user-unpublished', function (user) {
    // Don't end the call on unpublish — peer may republish (network blip). Wait for user-left.
  });

  client.on('user-left', function (user) {
    delete remoteUsers[user.uid];
    delete notifiedJoined[user.uid];
    if (opts.onRemoteLeft) opts.onRemoteLeft(user);
  });

  client.on('connection-state-change', function (cur, prev) {
    if (opts.onConnectionState) opts.onConnectionState(cur, prev);
  });

  try {
    await client.join(tokenData.appId || APP_ID, opts.channel, tokenData.token, uid);
  } catch (e) {
    if (opts.onError) opts.onError(new Error('Join failed: ' + e.message));
    throw e;
  }
  // After joining, if any remote users are ALREADY in the channel (we were 2nd to join),
  // Agora's user-joined event may or may not fire for them depending on timing. Sweep
  // client.remoteUsers manually to make sure we flip onRemoteJoined for everyone present.
  try {
    var existing = client.remoteUsers || [];
    existing.forEach(function (u) { notifyJoinedOnce(u); });
  } catch (e) {}

  try {
    // Reuse a cached mic track across calls to avoid re-prompting permission every call.
    // The browser DOES remember permission per origin, but creating a fresh mic track can
    // re-trigger the prompt on some browsers (notably iOS Safari with strict settings).
    if (!window.__ringInMicTrack || !window.__ringInMicTrack._enabled) {
      window.__ringInMicTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'music_standard',
        ANS: true,
        AEC: true,
        AGC: true,
      });
      // Mark so we can reuse it next call
      window.__ringInMicTrack._enabled = true;
    } else {
      // Re-enable in case it was muted at the end of the last call
      try { window.__ringInMicTrack.setEnabled(true); } catch(e){}
    }
    localAudioTrack = window.__ringInMicTrack;
    await client.publish([localAudioTrack]);
  } catch (e) {
    // Fresh mic creation may have failed (cached one stale) — fall back to a new track
    if (opts.onError) opts.onError(new Error('Microphone unavailable: ' + e.message));
    try {
      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      window.__ringInMicTrack = localAudioTrack;
      window.__ringInMicTrack._enabled = true;
      await client.publish([localAudioTrack]);
    } catch (e2) { /* listen-only mode */ }
  }

  return {
    client: client,
    localAudioTrack: localAudioTrack,
    setMuted: function (muted) {
      try { if (localAudioTrack) localAudioTrack.setEnabled(!muted); } catch (e) {}
    },
    leave: async function () {
      try {
        if (localAudioTrack) {
          // Don't close/destroy — keep the mic track alive for the next call so the
          // browser doesn't re-prompt for permission. Just disable (mute) and
          // unpublish. We'll re-enable + republish on the next call.
          try { localAudioTrack.setEnabled(false); } catch (e) {}
          try { await client.unpublish([localAudioTrack]); } catch (e) {}
        }
        Object.keys(remoteUsers).forEach(function (uidKey) {
          var u = remoteUsers[uidKey];
          if (u && u.audioTrack) { try { u.audioTrack.stop(); } catch (e) {} }
        });
        await client.leave();
      } catch (e) { /* ignore */ }
    },
  };
}

export default { startCallSession: startCallSession, hashUidToInt: hashUidToInt };
