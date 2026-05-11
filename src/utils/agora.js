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

  client.on('user-published', async function (user, mediaType) {
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        remoteUsers[user.uid] = user;
        attachRemoteAudio(user);
        if (opts.onRemoteJoined) opts.onRemoteJoined(user);
      }
    } catch (e) {
      if (opts.onError) opts.onError(new Error('Subscribe failed: ' + e.message));
    }
  });

  client.on('user-unpublished', function (user) {
    delete remoteUsers[user.uid];
    if (opts.onRemoteLeft) opts.onRemoteLeft(user);
  });

  client.on('user-left', function (user) {
    delete remoteUsers[user.uid];
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

  try {
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'music_standard',
      ANS: true,  // ambient-noise suppression
      AEC: true,  // acoustic-echo cancellation
      AGC: true,  // automatic-gain control
    });
    await client.publish([localAudioTrack]);
  } catch (e) {
    // If mic permission denied, the user can still HEAR but not speak.
    if (opts.onError) opts.onError(new Error('Microphone unavailable: ' + e.message));
    // Don't throw — being able to listen is still useful.
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
          try { localAudioTrack.stop(); } catch (e) {}
          try { localAudioTrack.close(); } catch (e) {}
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
