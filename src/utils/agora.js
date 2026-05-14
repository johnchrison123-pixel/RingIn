/* eslint-disable */
// ────────────────────────────────────────────────────────────────────────────
// RingIn Agora wrapper — joins a channel, publishes microphone, plays remote
// audio. Tokens are fetched from /api/agora-token (which keeps the App
// Certificate server-side). The App ID is public (loaded from REACT_APP env).
//
// LAZY-LOADED: the agora-rtc-sdk-ng package is ~250KB. We dynamic-import it via
// `import()` so webpack splits it into its own chunk — the main bundle ships
// without it. To minimize "first-call lag" we kick off the import on idle time
// (requestIdleCallback fallback to setTimeout) AND whenever a chat is opened.
// By the time the user taps Call, the SDK is usually already cached.
// ────────────────────────────────────────────────────────────────────────────

var APP_ID = process.env.REACT_APP_AGORA_APP_ID || 'a0d22a99058142b2af0d18e3e570b880';

// Allow override of the token endpoint when running locally
var TOKEN_URL = process.env.REACT_APP_AGORA_TOKEN_URL || '/api/agora-token';

// ── Lazy-load gate ─────────────────────────────────────────────────────────
var _agoraPromise = null;
export function getAgoraRTC() {
  if (!_agoraPromise) {
    _agoraPromise = import(/* webpackChunkName: "agora-sdk" */ 'agora-rtc-sdk-ng').then(function (m) {
      var rtc = m.default || m;
      try { rtc.setLogLevel(3); } catch (e) {}
      return rtc;
    });
  }
  return _agoraPromise;
}

// Kick off the import in idle time so the SDK is cached by the time the user
// taps Call. Cheap on devices that support requestIdleCallback; safe fallback.
if (typeof window !== 'undefined') {
  var _prefetchAgora = function () { try { getAgoraRTC(); } catch (e) {} };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(_prefetchAgora, { timeout: 3000 });
  } else {
    setTimeout(_prefetchAgora, 2500);
  }
}

// Exposed so any screen (e.g., MessagesScreen ChatBox) can warm the SDK when
// the user is likely about to call.
export function prefetchAgora() { try { getAgoraRTC(); } catch (e) {} }

// ── Audio output mode (earpiece vs loudspeaker) ────────────────────────────
// Default phone-call behavior is to route audio through the earpiece (you hold
// the phone to your ear) and only switch to the loudspeaker when explicitly
// toggled. WebRTC in browsers doesn't expose audio routing directly the way
// native AVAudioSession / AudioManager do, but iOS Safari 16.4+ added
// `navigator.audioSession.type` which IS controllable from JS and DOES route
// the call audio correctly when set to:
//   'play-and-record'  → earpiece  (private, like a normal cellular call)
//   'playback'         → loudspeaker (hands-free)
//
// On Android Chromium and older iOS there's no equivalent web API, so we fall
// back to Agora's playback volume — lower for "private" mode (user holds phone
// close), higher for speaker mode. Best we can do without a native shell.
//
// `mode` is either 'earpiece' or 'speaker'. Returns true if a real OS-level
// audio session switch happened (iOS 16.4+ PWA), false if we only adjusted
// volume (everything else). Callers shouldn't depend on the return value —
// it's just for telemetry/debug.
export function setAudioOutputMode(mode){
  try{
    var ns = navigator;
    if (ns && ns.audioSession && typeof ns.audioSession === 'object'){
      // iOS Safari 16.4+ — actual routing switch
      try{
        ns.audioSession.type = (mode === 'speaker') ? 'playback' : 'play-and-record';
        return true;
      }catch(e){ /* fall through to volume fallback */ }
    }
  }catch(e){}
  return false;
}

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
  // Resolve the (lazy-loaded) SDK first. Almost always already cached because of
  // the idle prefetch above + the prefetchAgora() call from ChatBox mount.
  var AgoraRTC = await getAgoraRTC();

  var uid = hashUidToInt(opts.uidString);
  var tokenData;
  // Consume the pre-fetched token if IncomingCallModal warmed it up. Saves
  // the ~200-500ms network roundtrip after the user taps Accept.
  try {
    var pf = (typeof window !== 'undefined') ? window.__ringinPrefetchedAgoraToken : null;
    var nowSecs = Math.floor(Date.now() / 1000);
    if (pf && pf.channel === opts.channel && pf.uid === uid && pf.token
        && (!pf.expiresAt || pf.expiresAt > nowSecs + 60)) {
      tokenData = { token: pf.token, appId: pf.appId, channel: pf.channel, uid: pf.uid, expiresAt: pf.expiresAt };
      try { window.__ringinPrefetchedAgoraToken = null; } catch (e) {}
    }
  } catch (e) { /* ignore — fall through to fresh fetch */ }
  if (!tokenData) {
    try {
      tokenData = await fetchToken(opts.channel, uid);
    } catch (e) {
      if (opts.onError) opts.onError(new Error('Token fetch failed: ' + e.message));
      throw e;
    }
  }

  var client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  var localAudioTrack = null;
  var remoteUsers = {};
  // Speaker volume on Agora's 0–400 scale (100 = original, 250 = loudspeaker boost).
  var currentRemoteVolume = 100;

  // CRITICAL: create the microphone track FIRST, before the network roundtrip for the
  // token + the websocket-y client.join. iOS Safari requires getUserMedia to be called
  // within the same user-activation window as the tap that initiated the call — if we
  // wait until after fetchToken (slow), the activation expires and mic creation
  // silently fails, leaving the user unable to be heard while still hearing the peer.
  //
  // iOS PWA audio session: must be 'play-and-record' BEFORE calling getUserMedia.
  // If the previous call set it to 'playback' (media-only), Agora throws
  // PERMISSION_DENIED with "AudioSession category is not compatible with audio
  // capture". Defensive — always force it to play-and-record before mic creation.
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = 'play-and-record';
    }
  } catch (e) { /* not supported on this browser — fine */ }
  try {
    // CPU profile: speech_standard (16kHz mono) instead of music_standard (48kHz stereo)
    // is a ~3-4× CPU reduction on low-end Android (Samsung Internet's main pain point).
    // Voice calls don't need music fidelity — speech is the right tool for the job.
    // Keep echo-cancel + noise-suppression but drop AGC (auto-gain) which adds processing
    // overhead and can pump the mic level mid-call on weak hardware.
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'speech_standard',
      ANS: true, AEC: true, AGC: false,
    });
  } catch (e) {
    // Make this VISIBLE — silently going to listen-only is what caused the "one-way audio" bug
    var errMsg = 'Microphone unavailable: ' + (e && e.message ? e.message : 'permission denied') + '. Tap Call again, or check site permissions.';
    if (opts.onError) opts.onError(new Error(errMsg));
    try { alert(errMsg); } catch (e2) {}
    throw e;
  }

  function attachRemoteAudio(user) {
    try {
      if (user && user.audioTrack) {
        user.audioTrack.play();
        // Apply current speaker volume so peers that join after a Speaker toggle
        // inherit the same loudness.
        if (typeof user.audioTrack.setVolume === 'function') {
          try { user.audioTrack.setVolume(currentRemoteVolume); } catch (e) {}
        }
      }
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
    // Don't end the call on user-unpublished — peers may just be muting (Agora can
    // fire this when a local track is disabled/unpublished mid-call). Only treat
    // user-left (peer actually leaving the channel) as a hangup signal.
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
    // Clean up the mic track we created so we don't leak it
    try { if (localAudioTrack) localAudioTrack.close(); } catch (e2) {}
    throw e;
  }

  // Publish the mic with one retry. If publish fails, the peer can't hear us — make
  // it visible rather than silently degrading to listen-only.
  var publishAttempt = 0;
  var publishOk = false;
  while (publishAttempt < 2 && !publishOk) {
    publishAttempt++;
    try {
      await client.publish([localAudioTrack]);
      publishOk = true;
    } catch (e) {
      if (publishAttempt >= 2) {
        var pubErr = 'Could not send mic audio to the other side: ' + (e && e.message ? e.message : 'publish failed');
        if (opts.onError) opts.onError(new Error(pubErr));
        try { alert(pubErr); } catch (e2) {}
      } else {
        // Brief pause before retry
        await new Promise(function (r) { setTimeout(r, 250); });
      }
    }
  }

  return {
    client: client,
    localAudioTrack: localAudioTrack,
    setMuted: function (muted) {
      // CRITICAL: use Agora's setMuted (not setEnabled). setEnabled stops/unpublishes
      // the track and the peer sees user-unpublished — which previously ended the
      // call entirely. setMuted just silences audio data while keeping the track
      // published, so the other side stays connected.
      try {
        if (!localAudioTrack) return;
        if (typeof localAudioTrack.setMuted === 'function') {
          localAudioTrack.setMuted(muted);
        } else {
          // Older SDK fallback — but DO publish back immediately so peer doesn't drop us
          localAudioTrack.setEnabled(!muted);
        }
      } catch (e) {}
    },
    // Apply a volume to ALL remote audio tracks. Agora's range is 0–400 (100 = original).
    // CallScreen passes 100 (normal) or 250 (loudspeaker boost). Was previously clamped
    // to 100 which broke loudspeaker mode.
    setRemoteVolume: function (volume) {
      currentRemoteVolume = Math.max(0, Math.min(400, volume));
      Object.keys(remoteUsers).forEach(function (uidKey) {
        var u = remoteUsers[uidKey];
        if (u && u.audioTrack && u.audioTrack.setVolume) {
          try { u.audioTrack.setVolume(currentRemoteVolume); } catch (e) {}
        }
      });
    },
    // setPlaybackDevice removed — was routing audio to invalid outputs on some devices,
    // causing one-way audio. Loudspeaker is now achieved purely via setRemoteVolume.
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
