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

// API base for backend calls. Defaults to the live production deploy so
// relative '/api/...' calls also work from native Capacitor APKs (where
// '/api/...' would resolve to 'https://localhost/...' = nothing). In PWA
// mode, the absolute URL behaves identically to the relative one.
var API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://ring-in.vercel.app';
var TOKEN_URL = process.env.REACT_APP_AGORA_TOKEN_URL || (API_BASE + '/api/agora-token');

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

// ── Audio output mode (call-time audio session pinning) ───────────────────
// IMPORTANT iOS PWA limitation: we cannot truly switch between earpiece and
// loudspeaker in a browser the way native apps do. iOS Safari only exposes
// `navigator.audioSession.type` with a fixed enum:
//
//   'play-and-record'   bidirectional audio, EARPIECE output (mic works ✓)
//   'playback'          output-only, LOUDSPEAKER output (mic DEAD ✗)
//
// Switching to 'playback' for "loudspeaker mode" silently kills the user's
// mic and the call goes one-way. Native apps use AVAudioSession.playAndRecord
// with the `defaultToSpeaker` OPTION to route to speaker while keeping
// recording — web doesn't expose those options.
//
// So this function now ALWAYS pins the session to 'play-and-record' — the
// mode argument is accepted for API compatibility but ignored at the
// session-category level. The "loudspeaker" toggle in CallScreen achieves
// its effect by boosting Agora's playback volume (100 → 250), not by
// changing routing. On iOS PWA "speaker mode" = louder earpiece. On Android
// PWA there's no audioSession API at all and audio plays through whatever
// Android routes to (usually the loud media speaker).
//
// Returns true if we touched audioSession.type, false otherwise (Android,
// older browsers).
export function setAudioOutputMode(mode){
  try{
    var ns = navigator;
    if (ns && ns.audioSession && typeof ns.audioSession === 'object'){
      try{
        // Always 'play-and-record' so the mic stays alive. mode is intentionally ignored.
        if (ns.audioSession.type !== 'play-and-record'){
          ns.audioSession.type = 'play-and-record';
        }
        return true;
      }catch(e){}
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
  // R16 FIX #2: previously had no timeout — if /api/agora-token never
  // responded (rare backend stall), the call promise hung forever and
  // the caller's onError never fired. 15-second AbortController bound
  // to the fetch so we surface a "Failed to fetch Agora token" up the
  // chain, which the call screen can show / retry.
  var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timeoutId = setTimeout(function(){ try { if (controller) controller.abort(); } catch(_){} }, 15000);
  try {
    var res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channel, uid: uid }),
      signal: controller ? controller.signal : undefined,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      var text = '';
      try { text = await res.text(); } catch (e) {}
      throw new Error('Token endpoint ' + res.status + ': ' + text);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error('Failed to fetch Agora token: ' + (e && e.message ? e.message : 'timeout'));
  }
}

// One-shot call session. Returns a controller object with leave/setMuted hooks.
//
// Options:
//   channel          string  required — Agora channel name
//   uidString        string  required — caller's Supabase user id (used to derive uint32 uid)
//   onRemoteJoined   fn      optional — fires when the other peer PUBLISHES audio
//                                       (NOT just joins — they have to publish too).
//                                       Use for "audio is flowing" indicators.
//   onRemotePresent  fn      optional — fires the instant the other peer joins the
//                                       channel (BEFORE they publish). Use this for
//                                       UI phase transitions so 'connecting' flips
//                                       to 'connected' without waiting for a publish
//                                       that may be slow or even fail. R42 fix.
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
  // The previous code awaited fetchToken BEFORE creating the mic, defeating this
  // comment and reintroducing the iOS one-way-audio + slow-connect bug. We now:
  //   1. kick off createMicrophoneAudioTrack synchronously (inside the activation window),
  //   2. kick off the token resolution CONCURRENTLY (prefetched → resolved instantly,
  //      otherwise fetchToken in flight — no added latency),
  //   3. await the mic first (preserves iOS activation), then await the token.
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

  // CPU profile: speech_standard (16kHz mono) instead of music_standard (48kHz stereo)
  // is a ~3-4× CPU reduction on low-end Android (Samsung Internet's main pain point).
  // Voice calls don't need music fidelity — speech is the right tool for the job.
  // Keep echo-cancel + noise-suppression but drop AGC (auto-gain) which adds processing
  // overhead and can pump the mic level mid-call on weak hardware.
  // Start mic creation NOW (synchronously, inside the user-activation window).
  var micPromise = AgoraRTC.createMicrophoneAudioTrack({
    encoderConfig: 'speech_standard',
    ANS: true, AEC: true, AGC: false,
  });
  // Start token resolution concurrently — already-warmed prefetch resolves instantly,
  // otherwise the network fetch runs in parallel with mic init (no added latency).
  var tokenPromise = tokenData ? Promise.resolve(tokenData) : fetchToken(opts.channel, uid);
  // Guard so an early token-fetch rejection doesn't trigger an unhandled-rejection
  // warning while we're still awaiting the mic. We await/handle it explicitly below.
  try { if (tokenPromise && typeof tokenPromise.catch === 'function') tokenPromise.catch(function(){}); } catch (e) {}

  try {
    localAudioTrack = await micPromise;   // await mic FIRST to preserve iOS activation
  } catch (e) {
    // Make this VISIBLE — silently going to listen-only is what caused the "one-way audio" bug
    var errMsg = 'Microphone unavailable: ' + (e && e.message ? e.message : 'permission denied') + '. Tap Call again, or check site permissions.';
    if (opts.onError) opts.onError(new Error(errMsg));
    /* R21 FIX #4: replaced blocking alert() with non-blocking toast — was
     * blocking the JS thread mid-WebRTC handshake (CLAUDE.md ban). The
     * opts.onError path above already surfaces the message via setError()
     * in CallScreen, so this is a secondary surface only. */
    try { var t = require('./toast'); if (t && t.toastError) t.toastError(errMsg); } catch (e2) {}
    throw e;
  }

  function attachRemoteAudio(user) {
    try {
      if (user && user.audioTrack) {
        user.audioTrack.play();
        // Apply current speaker volume so peers that join after a Speaker toggle
        // inherit the same loudness. Agora's setVolume is the same as setting
        // audioElement.volume internally — capped at unity gain.
        if (typeof user.audioTrack.setVolume === 'function') {
          try { user.audioTrack.setVolume(currentRemoteVolume); } catch (e) {}
        }
      }
    } catch (e) { /* ignore */ }
  }

  /* R42 fix: separate the "peer is in the channel" event from the
   * "peer started publishing audio" event. Previously we only listened
   * for user-published, so if the remote side's mic publish failed or
   * was slow (mic permission delay, Android wakelock, etc.), the caller
   * stayed on "Connecting…" forever even though the call had been
   * accepted and both peers were in the channel. user-joined gives an
   * earlier, more reliable "we're connected" signal. */
  client.on('user-joined', function (user) {
    try {
      if (opts.onRemotePresent) opts.onRemotePresent(user);
    } catch (e) { /* ignore */ }
  });

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

  // Now resolve the token — already in flight (prefetch resolved instantly, or
  // fetchToken was started concurrently with mic creation above), so this adds
  // no latency on top of the mic init we just awaited.
  try {
    tokenData = await tokenPromise;
  } catch (e) {
    if (opts.onError) opts.onError(new Error('Token fetch failed: ' + e.message));
    // Clean up the mic track we already created so we don't leak it
    try { if (localAudioTrack) localAudioTrack.close(); } catch (e2) {}
    throw e;
  }

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
        /* R21 FIX #4: non-blocking toast (was alert blocking iOS PWA AudioContext) */
        try { var t2 = require('./toast'); if (t2 && t2.toastError) t2.toastError(pubErr); } catch (e2) {}
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
