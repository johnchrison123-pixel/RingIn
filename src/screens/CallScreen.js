/* eslint-disable */
import React,{useState,useEffect,useRef,useCallback} from 'react';
import {startCallSession, setAudioOutputMode} from '../utils/agora';
import * as NativeAudio from '../utils/nativeAudio';
import {sb} from '../utils/supabase';
import {buildCallLog} from '../utils/callLog';
import {playRingback,stopRingback,hapticPulse} from '../utils/soundEngine';
import {setSharedCoinBalance} from '../utils/coinBalance';

// ── Module-level SVG nodes ─────────────────────────────────────────────────
// React.createElement creates a fresh object on every render. Hoisting the
// inner SVG bodies up here gives us stable references — the diff for the
// Mute/Speaker buttons becomes "did the wrapping <button> change?" rather than
// "rebuild every <path>". Materially cuts re-render cost on low-end Android.
var MIC_PATHS = [
  React.createElement('rect',{key:'b',x:'9',y:'2',width:'6',height:'12',rx:'3'}),
  React.createElement('path',{key:'s',d:'M5 10v2a7 7 0 0 0 14 0v-2'}),
  React.createElement('line',{key:'st',x1:'12',y1:'19',x2:'12',y2:'23'}),
];
var MIC_SLASH = React.createElement('line',{key:'x',x1:'4',y1:'4',x2:'20',y2:'20',strokeWidth:'2.6'});
var SPEAKER_PATHS = [
  React.createElement('polygon',{key:'sp',points:'11 5 6 9 2 9 2 15 6 15 11 19 11 5'}),
  React.createElement('path',{key:'w1',d:'M15.54 8.46a5 5 0 0 1 0 7.07'}),
  React.createElement('path',{key:'w2',d:'M19.07 4.93a10 10 0 0 1 0 14.14'}),
];
var SVG_ATTRS = {viewBox:'0 0 24 24',width:'24',height:'24',fill:'none',stroke:'currentColor',strokeWidth:'2.2',strokeLinecap:'round',strokeLinejoin:'round'};

// ── Build version stamp ───────────────────────────────────────────────────
// Bumped whenever we change call audio handling. Shown as a tiny text label
// at the bottom of the connected-call screen and logged on call start so we
// can verify whether the user is actually running the latest code (or stuck
// on a cached old build via service worker).
var RINGIN_BUILD = '';

// ── Module-level style constants ───────────────────────────────────────────
// Every secs/coin tick re-renders the connected-call view. Hoisting the style
// objects means React doesn't allocate new objects on the hot path — and
// dropping the `transition:'background ...'` from gradient buttons kills the
// per-frame CPU repaint that Samsung Internet performs (it doesn't promote
// gradient transitions to the compositor like Chrome desktop does).
var BTN_BASE = {
  width:'54px', height:'54px', borderRadius:'50%',
  border:'none', padding:0,
  display:'flex', alignItems:'center', justifyContent:'center',
  // Only `transform` is transitioned — the press feedback comes from the
  // .ringin-tap:active class which scales the button. Background stays
  // static on purpose: gradient↔solid transitions are the worst case for
  // Samsung Internet's paint pipeline.
  willChange:'transform',
};
var BTN_GRADIENT = 'linear-gradient(135deg,#7B6EFF,#E84D9A)';
var BTN_SHADOW_BRAND = '0 4px 14px rgba(123,110,255,0.4)';
var BTN_SHADOW_WHITE = '0 4px 14px rgba(255,255,255,0.18)';
var HANGUP_BTN_STYLE = {
  width:'70px', height:'70px', borderRadius:'50%',
  background:'#c0392b', border:'none', cursor:'pointer',
  boxShadow:'0 6px 22px rgba(192,57,43,0.65)',
  willChange:'transform',
  display:'flex', alignItems:'center', justifyContent:'center',
  padding:0,
};
// Standard "call_end" icon — phone handset on a wave shape, rotated. Same
// silhouette WhatsApp / Signal / iOS use so users recognize it instantly.
var HANGUP_ICON = React.createElement('svg', {
  viewBox:'0 0 24 24', width:'30', height:'30', fill:'#fff',
  style:{transform:'rotate(0deg)'}
},
  React.createElement('path', {
    d:'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z'
  })
);
var RIPPLE_1 = {position:'absolute',width:'120px',height:'120px',borderRadius:'50%',background:'rgba(123,110,255,0.15)',top:'-15px',left:'-15px',animation:'ripple 1.2s ease-out infinite'};
var RIPPLE_2 = {position:'absolute',width:'140px',height:'140px',borderRadius:'50%',background:'rgba(123,110,255,0.08)',top:'-25px',left:'-25px',animation:'ripple 1.2s ease-out infinite 0.4s'};

// Props:
//   expert            object   the remote party (name, img, initials, color, role, rate, id?)
//   coins             number   caller's current coin balance
//   onCoinsChange     fn       called with new balance after each deduction
//   onEnd             fn       called when the call screen closes
//   inviteId          string?  call_invites.id — if present, we update its status as the call progresses
//   channel           string?  Agora channel — defaults to inviteId, falls back to a derived id
//   session           object?  Supabase auth session — used to derive our own UID for Agora
//   isIncoming        bool?    true if this is an answered incoming call (caller-side skips ring UI)
export default function CallScreen(props){
  var expert = props.expert || {};
  var coins = props.coins;
  var onCoinsChange = props.onCoinsChange;
  var onEnd = props.onEnd;
  var inviteId = props.inviteId || null;
  var session = props.session;
  var isIncoming = !!props.isIncoming;
  var myUserId = session && session.user ? session.user.id : null;
  var channel = props.channel || inviteId || ('call_'+(expert.id||'x')+'_'+(myUserId||'x'));

  // ── UI phases ──
  // ringing:    waiting for callee to pick up (caller-side only)
  // connecting: callee accepted, both sides joining Agora — no timer yet
  // connected:  both peers actually exchanging audio
  // ended/declined: terminal
  var phaseS = useState(isIncoming ? 'connecting' : 'ringing');
  // Diagnostic state — shown at bottom of call screen so the user can see
  // exactly what AudioManager state is. Updated on every Speaker toggle.
  var audioDbgS = useState(''); var audioDbg = audioDbgS[0]; var setAudioDbg = audioDbgS[1];
  var phase = phaseS[0]; var setPhase = phaseS[1];

  var secsS = useState(0); var secs = secsS[0]; var setSecs = secsS[1];
  var ringSecsS = useState(0); var ringSecs = ringSecsS[0]; var setRingSecs = ringSecsS[1];
  var localCoinsS = useState(coins); var localCoins = localCoinsS[0]; var setLocalCoins = localCoinsS[1];
  // Ref mirror of localCoins — needed because hangup() is a plain
  // function (not memoized) and the per-minute interval captures it via
  // stale closure. Reading `localCoins` directly inside hangup would
  // return the at-render value, so the final DB write would undo every
  // deduction. The ref is updated in a useEffect below.
  var localCoinsRef = useRef(coins);
  useEffect(function(){ localCoinsRef.current = localCoins; }, [localCoins]);
  // ROUND 8 FIX #6: phaseRef mirror — the 'ringin:back-call' listener is
  // registered once with empty deps so it can't read the latest `phase`
  // directly. The mirror lets the listener bail if the call already ended.
  var phaseRef = useRef(phase);
  useEffect(function(){ phaseRef.current = phase; }, [phase]);
  var mutedS = useState(false); var muted = mutedS[0]; var setMuted = mutedS[1];
  // Speaker off = normal call volume (100). Speaker on = loudspeaker boost (250).
  // Browser can't actually route to earpiece — this is volume-based "loudspeaker" mode.
  var speakerOnS = useState(false); var speakerOn = speakerOnS[0]; var setSpeakerOn = speakerOnS[1];
  var errorS = useState(null); var error = errorS[0]; var setError = errorS[1];
  var endReasonS = useState(null); var endReason = endReasonS[0]; var setEndReason = endReasonS[1];

  var sessionRef = useRef(null);   // holds the Agora controller {leave, setMuted}
  var endedRef = useRef(false);    // guard against double-end
  var wakeLockRef = useRef(null);  // navigator.wakeLock — keeps screen on (Chrome Android)
  var silentAudioRef = useRef(null); // hidden <audio> looping silent track — keeps iOS audio session alive
  // Track orphan timeouts so they can be cancelled on unmount. Otherwise they
  // fire hangup() / onEnd() on a torn-down component long after the user navigates away.
  var startFailedTimerRef = useRef(null);
  var endTimerRef = useRef(null);
  // Wake-lock release handler held in a ref so we can removeEventListener on cleanup.
  var wakeLockReleaseHandlerRef = useRef(null);

  // ── Keep the device awake + audio session alive while on a call.
  // Wake Lock keeps the screen from sleeping on Chrome Android (~85% of Android users).
  // On iOS Safari (no wake-lock), a silent looping audio element keeps the audio session
  // active so the WebRTC call doesn't drop instantly when the screen turns off. Both
  // are best-effort — neither prevents iOS from killing the call after a few seconds of
  // screen-off; full background calling needs a native PWA wrapper or Web Push wake.
  useEffect(function(){
    var cancelled = false;
    async function acquireWakeLock(){
      try{
        if(navigator && navigator.wakeLock && navigator.wakeLock.request){
          var wl = await navigator.wakeLock.request('screen');
          if(cancelled){ try{ wl.release(); }catch(e){} return; }
          wakeLockRef.current = wl;
          // Stash the handler in a ref so we can remove it on cleanup. Anonymous
          // listeners leak across call/end cycles, each holding a closure over
          // its prior CallScreen state.
          var handler = function(){ /* lock dropped — re-acquire on visibility */ };
          wakeLockReleaseHandlerRef.current = handler;
          wl.addEventListener('release', handler);
        }
      }catch(e){ /* silently ignore */ }
    }
    function startSilentAudio(){
      // PREVIOUSLY: iOS-only silent <audio> loop to keep the audio session alive
      // when the screen locked. Causes problems now: it's a second audio
      // element competing with Agora's playback, and was suspected of causing
      // the user-reported "audio comes from speaker AND earpiece simultaneously"
      // bug on iPhone PWA. Skip it: while a call is active, Agora's mic
      // publishing keeps the audio session alive on its own (verified across
      // iOS 16-18). If reports of calls dropping on screen-off come back,
      // we'll reinstate this with stricter routing controls.
      return;
    }
    // Yield to the main thread BEFORE doing wake-lock + silent-audio + listener
    // registration. The call accept happens in the same tick that this CallScreen
    // mounts, while the IncomingCallModal is still unmounting + cleaning up. Doing
    // everything synchronously stalls the JS thread long enough on Samsung
    // Internet to trigger the "page unresponsive" dialog. By deferring with
    // setTimeout 0 we let the browser paint the call screen first, then init.
    var wakeLockTimer = setTimeout(function(){ if(!cancelled) acquireWakeLock(); }, 0);
    var silentAudioTimer = setTimeout(function(){ if(!cancelled) startSilentAudio(); }, 30);

    // Try to re-acquire wake lock when the tab regains visibility (system releases it when hidden)
    function onVis(){
      if(document.visibilityState === 'visible' && !wakeLockRef.current){
        acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', onVis);

    return function(){
      cancelled = true;
      try { clearTimeout(wakeLockTimer); } catch(e){}
      try { clearTimeout(silentAudioTimer); } catch(e){}
      document.removeEventListener('visibilitychange', onVis);
      try{
        if(wakeLockRef.current){
          if(wakeLockReleaseHandlerRef.current){
            try { wakeLockRef.current.removeEventListener('release', wakeLockReleaseHandlerRef.current); } catch(e){}
            wakeLockReleaseHandlerRef.current = null;
          }
          wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      }catch(e){}
      try{
        if(silentAudioRef.current){
          silentAudioRef.current.pause();
          if(silentAudioRef.current.parentNode) silentAudioRef.current.parentNode.removeChild(silentAudioRef.current);
          silentAudioRef.current = null;
        }
      }catch(e){}
    };
  }, []);

  // ── 1. Start the Agora session — wait for a real channel id (not the optimistic
  //      'pending-...' placeholder we use to show the UI instantly).
  useEffect(function(){
    if(!channel || (typeof channel==='string' && channel.indexOf('pending-')===0)) return;
    try{ console.log('[ringin] CallScreen mount BUILD=' + RINGIN_BUILD + ' channel=' + channel); }catch(_){}
    // Capacitor native shell only: put the audio session into call mode
    // BEFORE Agora grabs the mic. iOS sets AVAudioSession to playAndRecord,
    // Android sets AudioManager.MODE_IN_COMMUNICATION. No-op on web/PWA.
    try{
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RingInAudio){
        window.Capacitor.Plugins.RingInAudio.startCallMode().then(function(res){
          setAudioDbg('startCallMode: mode=' + res.mode + ' speakerOn=' + res.isSpeakerphoneOn);
        }).catch(function(e){ setAudioDbg('startCallMode error: ' + (e && e.message)); });
      } else {
        setAudioDbg('Capacitor.Plugins.RingInAudio NOT FOUND — running as web/PWA OR plugin not registered');
      }
    }catch(e){ setAudioDbg('startCallMode throw: ' + (e && e.message)); }
    var cancelled = false;
    (async function(){
      try {
        // Yield one tick BEFORE startCallSession runs so the call-screen UI gets a
        // chance to paint. startCallSession does the user-activation getUserMedia
        // dance — yielding here doesn't break iOS Safari because Promise microtasks
        // preserve the activation context, but setTimeout 0 does NOT. Use
        // requestAnimationFrame instead — it preserves activation AND lets one paint.
        await new Promise(function(resolve){
          if(typeof requestAnimationFrame === 'function') requestAnimationFrame(function(){ resolve(); });
          else resolve();
        });
        if(cancelled) return;
        var s = await startCallSession({
          channel: channel,
          uidString: myUserId || ('anon-'+Math.random().toString(36).slice(2)),
          onRemoteJoined: function(){
            if(cancelled) return;
            setPhase('connected');
            // Default to EARPIECE-style audio when the call goes live:
            //  - audioSession pinned to play-and-record (mic alive)
            //  - Agora's setVolume reduced to 50 (private feel) on web/PWA
            //  - In native (Capacitor) shell, the native plugin handles real
            //    earpiece routing.
            try{ setAudioOutputMode('earpiece'); }catch(e){}
            var s = sessionRef.current;
            if (s) { try { s.setRemoteVolume(50); } catch(_){} }
            // Once both peers are present, mark the invite as accepted/started
            if(inviteId){
              sb.from('call_invites').update({status:'accepted',started_at:new Date().toISOString()}).eq('id',inviteId).then(function(){});
            }
          },
          onRemoteLeft: function(){
            if(cancelled) return;
            // Remote hung up
            hangup('remote_hangup');
          },
          onError: function(e){ setError(e.message || String(e)); },
        });
        if(cancelled){ try{ s.leave(); }catch(e){} return; }
        sessionRef.current = s;
      } catch (e){
        setError('Couldn\'t start call: ' + (e.message || e));
        // Fall back gracefully — close after showing the error briefly.
        // Track in a ref so we cancel on unmount (avoids hangup firing on a torn-down component).
        startFailedTimerRef.current = setTimeout(function(){
          startFailedTimerRef.current = null;
          if(!endedRef.current) hangup('start_failed');
        }, 3500);
      }
    })();
    return function(){
      cancelled = true;
      if(startFailedTimerRef.current){ clearTimeout(startFailedTimerRef.current); startFailedTimerRef.current = null; }
      var s = sessionRef.current;
      if (s) { try { s.leave(); } catch(e){} sessionRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[channel, myUserId]);

  // ── 2. Subscribe to invite status changes: handle accepted/rejected/cancelled/ended.
  //      Crucially, 'accepted' flips caller out of 'ringing' the moment the callee taps
  //      Accept — even if Agora's onRemoteJoined hasn't fired yet (callee may still be
  //      on the mic-permission prompt). We move to 'connecting' until audio arrives.
  useEffect(function(){
    if(!inviteId) return;
    function applyStatus(st){
      if(!st) return;
      if(st==='accepted'){
        setPhase(function(prev){ return prev==='ringing' ? 'connecting' : prev; });
      }
      else if(st==='rejected'){ setPhase('declined'); hangup('rejected'); }
      else if(st==='cancelled'){ hangup('cancelled'); }
      else if(st==='ended'){ hangup('remote_hangup'); }
    }
    var ch = sb.channel('call-invite-'+inviteId)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'call_invites',filter:'id=eq.'+inviteId},function(p){
        applyStatus(p && p.new && p.new.status);
      })
      .subscribe();
    // 3-second poll backup in case realtime drops the UPDATE
    // FIX #11 — once the row reaches a terminal state (accepted / ended /
    // rejected / cancelled), tear down the interval. Previously the poll
    // kept hammering Supabase every 3s for the entire call duration.
    var pollIv = setInterval(function(){
      sb.from('call_invites').select('status').eq('id', inviteId).single().then(function(r){
        if(r && r.data){
          var st = r.data.status;
          applyStatus(st);
          if(st === 'accepted' || st === 'ended' || st === 'rejected' || st === 'cancelled'){
            clearInterval(pollIv);
          }
        }
      });
    }, 3000);
    return function(){ try{ sb.removeChannel(ch); }catch(e){} clearInterval(pollIv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[inviteId]);

  // ── 3. Ringing timer — caller side; auto-give-up after 35s if no answer
  useEffect(function(){
    if(phase!=='ringing' || isIncoming) return;
    var iv = setInterval(function(){
      setRingSecs(function(s){
        if(s >= 35){ clearInterval(iv); hangup('no_answer'); return s; }
        return s+1;
      });
    }, 1000);
    return function(){ clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase, isIncoming]);

  // ── 3b. Caller-side ringback tone + haptic pulse — gives the caller the same
  //       audio/tactile feedback WhatsApp does so they know the call is going through.
  //       Stops the moment phase flips to connecting/connected/ended, and on unmount.
  useEffect(function(){
    if(phase!=='ringing' || isIncoming) return;
    try{ playRingback(); }catch(e){}
    var hapticCount = 0;
    var hapticIv = setInterval(function(){
      hapticCount++;
      // Cap haptics at 8 pulses (~24s) — keeps Samsung Internet from queuing
      // vibrate calls that then fire mid-call when the user accepts.
      if(hapticCount > 8){ try{ clearInterval(hapticIv); }catch(e){} return; }
      try{ hapticPulse([180]); }catch(e){}
    }, 3000);
    // Fire one pulse immediately
    try{ hapticPulse([180]); }catch(e){}
    return function(){
      try{ stopRingback(); }catch(e){}
      try{ clearInterval(hapticIv); }catch(e){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase, isIncoming]);

  // ── 4. Connected timer + coin deduction (every 60s, charge rate_per_min)
  useEffect(function(){
    if(phase!=='connected') return;
    var rate = parseInt(expert.rate, 10) || 30; // coins per minute
    var iv = setInterval(function(){
      setSecs(function(s){
        var next = s+1;
        // Deduct rate/60 coins every second (rate per minute)
        if(next % 60 === 0){
          // FIX #8: don't deduct if localCoins hasn't been populated yet
          // (hook fetch hasn't landed). Skipping the deduction this
          // minute is better than auto-hanging up "no_coins" on a user
          // who actually has a positive balance — the next minute tick
          // will get a real number once the prop arrives.
          if (!localCoinsRef.current || localCoinsRef.current <= 0) {
            return next;
          }
          setLocalCoins(function(c){
            var nc = c - rate;
            if(onCoinsChange) onCoinsChange(nc);
            // FIX #7: schedule the broadcast OUTSIDE the updater. React
            // updaters must be pure — in StrictMode they run twice. The
            // old code called setSharedCoinBalance inside the updater,
            // broadcasting twice (and producing visible chip jitter). By
            // deferring with Promise.resolve().then() we run the
            // broadcast in the next microtask, after React commits, so
            // it only fires once per real deduction.
            Promise.resolve().then(function(){
              try { setSharedCoinBalance(Math.max(0, nc), {userId: myUserId}); } catch(_) {}
            });
            if(nc <= 0){
              // FIX #8: don't fire no_coins hangup at the very first
              // minute tick (next === 60) if the call has barely run —
              // gives the hook fetch one more chance to arrive with a
              // real balance before we tear down the call.
              if (next === 60) return 0;
              hangup('no_coins');
              return 0;
            }
            return nc;
          });
        }
        return next;
      });
    }, 1000);
    return function(){ clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase]);

  // FIX #8: when the `coins` prop changes from 0 to a real number (the
  // useCoinBalance hook finished fetching after CallScreen already
  // mounted), update localCoins so the call has a real balance to deduct
  // against. Only fires when localCoins is still 0 — won't constantly
  // overwrite the deducted value with the prop.
  useEffect(function(){
    if (typeof coins === 'number' && coins > 0 && localCoins === 0) {
      setLocalCoins(coins);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins]);

  function fmt(s){var m=Math.floor(s/60);var ss=s%60;return m+':'+(ss<10?'0':'')+ss;}

  function hangup(reason){
    if(endedRef.current) return;
    endedRef.current = true;
    var s = sessionRef.current;
    if(s){ try{ s.leave(); }catch(e){} sessionRef.current = null; }
    // Restore the native audio session to idle (no-op on web/PWA).
    try{ NativeAudio.endCallMode(); }catch(_){}
    setEndReason(reason || 'caller_hangup');
    // Update invite row. If we hang up BEFORE the insert returns (inviteId is null),
    // mark the most recent ringing invite WE created as cancelled — this catches
    // the race where user taps Call then immediately taps red.
    var newStatus = (reason==='rejected') ? 'rejected' : (reason==='no_answer'?'missed':(reason==='caller_hangup' && phase==='ringing' ? 'cancelled' : 'ended'));
    if(inviteId){
      sb.from('call_invites').update({
        status: newStatus,
        ended_at: new Date().toISOString(),
        duration_secs: secs,
        end_reason: reason || 'caller_hangup',
      }).eq('id', inviteId).then(function(){});
    } else if(session && session.user){
      // Try to find the row we created (most recent ringing where caller=me) and cancel it
      sb.from('call_invites')
        .update({ status:newStatus, ended_at:new Date().toISOString(), duration_secs:secs, end_reason:reason||'caller_hangup' })
        .eq('caller_id', session.user.id)
        .eq('status','ringing')
        .gte('created_at', new Date(Date.now() - 30000).toISOString())
        .then(function(r){
          if(r && r.error){ console.error('[ringin] late-cancel failed:', r.error); }
          else console.log('[ringin] late-cancel applied');
        });
    }
    // Write an in-chat call log message. Only the CALLER writes (to avoid duplicates).
    // The callee's hangup() runs locally but they don't insert — the caller's onRemoteLeft
    // will fire and they'll write the log on their side.
    if(!isIncoming && session && session.user){
      try {
        var otherId = (expert && (expert.id || expert.user_id || expert.otherId || expert.receiverId)) || null;
        var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if(otherId && UUID_RE.test(String(otherId)) && otherId !== session.user.id){
          var convId = [session.user.id, otherId].sort().join('_');
          var logText = buildCallLog({
            d: secs,
            s: newStatus,
            r: reason || 'caller_hangup',
            cid: session.user.id,
          });
          sb.from('messages').insert({
            conversation_id: convId,
            sender_id: session.user.id,
            sender_name: 'system',
            receiver_id: otherId,
            text: logText,
            read: false,
          }).then(function(r){
            if(r && r.error) console.error('[ringin] call log insert failed:', r.error);
          });
        }
      } catch(e){ console.error('[ringin] call log error:', e); }
    }

    // Persist the final coin total to Supabase (caller only — callees
    // don't get charged). The realtime UPDATE listener in useCoinBalance
    // will then push the new value to every other open device.
    // CRITICAL: read from localCoinsRef.current (NOT the captured
    // `localCoins` const) so we get the latest deducted value rather
    // than the at-render value from when this hangup closure was built.
    if (!isIncoming && session && session.user) {
      try {
        var finalCoins = Math.max(0, Number(localCoinsRef.current) || 0);
        sb.from('profiles').update({ coins: finalCoins }).eq('id', session.user.id).then(function(r){
          if (r && r.error) console.warn('[ringin] coin persist failed:', r.error.message || r.error);
        });
        // Log the deduction so the user can see it in Wallet transactions.
        var deducted = (Number(coins) || 0) - finalCoins;
        if (deducted > 0) {
          sb.from('transactions').insert([{
            user_id: session.user.id,
            type: 'call',
            label: 'Call with ' + (expert && expert.name ? expert.name : 'expert'),
            coins: -deducted,
            amount: 0,
          }]).then(function(){});
        }
        // Broadcast one last time in case the per-minute tick missed a
        // partial-minute deduction at the very end.
        // FIX #1: pass userId so the per-user cache key gets updated.
        setSharedCoinBalance(finalCoins, {userId: myUserId});
      } catch(_) {}
    }

    setPhase('ended');
    endTimerRef.current = setTimeout(function(){
      endTimerRef.current = null;
      if(onEnd) onEnd();
    }, 800);
  }

  // Final unmount safety net — clear any remaining orphan timers, and reset
  // the iOS audio session back to default so ringtones/notifications after
  // the call don't stay stuck in earpiece-routing mode.
  useEffect(function(){
    return function(){
      try { if(startFailedTimerRef.current){ clearTimeout(startFailedTimerRef.current); startFailedTimerRef.current = null; } } catch(e){}
      try { if(endTimerRef.current){ clearTimeout(endTimerRef.current); endTimerRef.current = null; } } catch(e){}
      // Restore audio session to 'auto' so iOS picks the right category
      // based on the next thing the app does. Do NOT set to 'playback' —
      // that would lock the session to media-only and the NEXT call's
      // getUserMedia would fail with "AudioSession category is not
      // compatible with audio capture". Safe no-op on browsers without
      // the API.
      try{
        if (navigator && navigator.audioSession){
          navigator.audioSession.type = 'auto';
        }
      }catch(e){}
    };
  }, []);

  // ROUND 8 FIX #6: Hardware-back during an active call used to just
  // setActiveCall(null) at the App.js level — that ripped CallScreen out
  // of the tree without running hangup(), leaking the Agora client +
  // leaving the call_invites row stuck in 'ringing' + skipping the coin
  // persist + transactions write. App.js now dispatches this event before
  // unmounting so we can hangup cleanly first.
  useEffect(function(){
    function onBackCall(){
      try {
        if (phaseRef.current !== 'ended' && !endedRef.current) hangup('caller_hangup');
      } catch(_){}
    }
    window.addEventListener('ringin:back-call', onBackCall);
    return function(){ window.removeEventListener('ringin:back-call', onBackCall); };
  }, []);

  // Mute/Speaker handlers — wrapped in useCallback with empty deps so the
  // <button onClick={...}> references stay stable. Without this, every parent
  // re-render (coin tick, secs tick) creates new function instances and React
  // re-creates the button props, multiplying the render cost on the hot path.
  var toggleMute = useCallback(function(){
    setMuted(function(m){
      var next = !m;
      var s = sessionRef.current;
      if(s) try{ s.setMuted(next); }catch(e){}
      return next;
    });
  }, []);

  // Loudspeaker toggle.
  //
  // WHEN RUNNING AS NATIVE APP (via Capacitor): calls the native audio plugin
  // to physically switch between earpiece routing (AVAudioSession.playAndRecord
  // / AudioManager.MODE_IN_COMMUNICATION + speakerphoneOff) and loudspeaker.
  // This is the ONLY way to get true earpiece/speaker switching that works
  // identically to WhatsApp, Telegram, etc.
  //
  // WHEN RUNNING AS PWA / WEB (no native plugin available): falls back to
  // reducing Agora's playback volume (100 → 50) for "private mode". Cannot
  // amplify above 100 — Web platform limit for WebRTC remote tracks.
  var toggleSpeaker = useCallback(function(){
    setSpeakerOn(function(on){
      var next = !on;
      try{ setAudioOutputMode('earpiece'); }catch(e){}
      // Native plugin path (Capacitor) — true OS audio routing switch.
      // No-op on web/PWA. Surface the result on screen so we can see
      // whether the native plugin is being called + what AudioManager state
      // actually IS after the toggle. If the audio doesn't switch despite
      // a successful plugin call, that tells us Agora's WebRTC is
      // ignoring AudioManager (which would need a different fix).
      try{
        NativeAudio.setSpeakerphone(next).then(function(res){
          var summary = res
            ? ('plugin: mode=' + res.mode + ' speakerOn=' + res.isSpeakerphoneOn + ' (requested=' + next + ')')
            : ('plugin: NOT REGISTERED (running as web?)');
          setAudioDbg(summary);
        }).catch(function(e){ setAudioDbg('plugin error: ' + (e && e.message)); });
      }catch(e){ setAudioDbg('throw: ' + (e && e.message)); }
      var s = sessionRef.current;
      if(s){
        // Volume contrast for PWA fallback: 50 (private feel) ↔ 100 (full).
        // Browsers can't amplify above 100 for WebRTC remote tracks.
        try{ s.setRemoteVolume(next ? 100 : 50); }catch(e){}
      }
      return next;
    });
  }, []);

  var onHangupClick = useCallback(function(){ hangup('caller_hangup'); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  // ── Render ────────────────────────────────────────────────────────────────
  if(phase==='declined' || (phase==='ended' && endReason==='rejected')){
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
      React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color||'var(--ac)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',marginBottom:'16px'}},
        expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (expert.initials||'?')
      ),
      React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}},expert.name||'User'),
      React.createElement('div',{style:{fontSize:'14px',color:'#ef4444',marginBottom:'32px'}},'Call Declined'),
      React.createElement('button',{onClick:onEnd,style:{padding:'12px 32px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}},'Back')
    );
  }

  if(phase==='ringing'){
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
      React.createElement('div',{style:{position:'relative',marginBottom:'24px'}},
        React.createElement('div',{style:RIPPLE_1}),
        React.createElement('div',{style:RIPPLE_2}),
        React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color||'var(--ac)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',position:'relative',zIndex:1}},
          expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (expert.initials||'?')
        )
      ),
      React.createElement('div',{style:{fontSize:'20px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},expert.name||'User'),
      React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'8px'}},expert.role||'Member'),
      React.createElement('div',{style:{fontSize:'13px',color:'var(--t3)',marginBottom:'40px',display:'flex',alignItems:'center',gap:'6px'}},
        React.createElement('span',null,'Ringing'),
        React.createElement('span',{style:{letterSpacing:'2px'}},['.','..',  '...'][ringSecs%3])
      ),
      error ? React.createElement('div',{style:{fontSize:'12px',color:'#ef4444',marginBottom:'16px',maxWidth:'320px',textAlign:'center'}},error) : null,

      // Same three buttons as the connected state — gives the caller a familiar
      // call-controls layout while ringing. Mute and Speaker are visible but
      // disabled until the call actually connects (no audio to control yet).
      React.createElement('div',{style:{display:'flex',gap:'22px',alignItems:'center'}},
        // ── MUTE (disabled while ringing) ──
        React.createElement('button',{
          onClick: toggleMute,
          className: 'ringin-tap',
          title: muted ? 'Unmute' : 'Mute',
          disabled: true,
          style: Object.assign({}, BTN_BASE, {
            background: muted ? '#ffffff' : BTN_GRADIENT,
            color: muted ? '#7B6EFF' : '#ffffff',
            cursor: 'not-allowed',
            opacity: 0.45,
            boxShadow: muted ? BTN_SHADOW_WHITE : BTN_SHADOW_BRAND,
          })
        },
          React.createElement('svg', SVG_ATTRS,
            MIC_PATHS[0], MIC_PATHS[1], MIC_PATHS[2],
            muted ? MIC_SLASH : null
          )
        ),
        // ── HANGUP (with icon) ──
        React.createElement('button',{
          onClick: onHangupClick,
          className: 'ringin-tap',
          title:'End call',
          style: HANGUP_BTN_STYLE,
        }, HANGUP_ICON),
        // ── SPEAKER (disabled while ringing) ──
        React.createElement('button',{
          onClick: toggleSpeaker,
          className: 'ringin-tap',
          title: speakerOn ? 'Switch off loudspeaker' : 'Switch on loudspeaker',
          disabled: true,
          style: Object.assign({}, BTN_BASE, {
            background: speakerOn ? '#ffffff' : BTN_GRADIENT,
            color: speakerOn ? '#7B6EFF' : '#ffffff',
            cursor: 'not-allowed',
            opacity: 0.45,
            boxShadow: speakerOn ? BTN_SHADOW_WHITE : BTN_SHADOW_BRAND,
          })
        },
          React.createElement('svg', SVG_ATTRS,
            SPEAKER_PATHS[0], SPEAKER_PATHS[1], SPEAKER_PATHS[2]
          )
        )
      )
    );
  }

  // Connected / ended
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
    React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color||'var(--ac)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',marginBottom:'12px'}},
      expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (expert.initials||'?')
    ),
    React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},expert.name||'User'),
    React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',marginBottom:'6px'}},expert.role||'Member'),
    React.createElement('div',{style:{fontSize:'12px',color: phase==='connected' ? 'var(--green)' : (phase==='connecting' ? 'var(--amber)' : 'var(--t3)'),marginBottom:'20px',display:'flex',alignItems:'center',gap:'5px'}},
      React.createElement('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background: phase==='connected' ? 'var(--green)' : (phase==='connecting' ? 'var(--amber)' : 'var(--t3)'),display:'inline-block'}}),
      phase==='connected' ? 'Connected' : (phase==='connecting' ? 'Connecting…' : 'Call ended')
    ),
    phase==='connected'
      ? React.createElement('div',{style:{fontSize:'42px',fontWeight:800,color:'var(--text)',marginBottom:'8px'}}, fmt(secs))
      : phase==='connecting'
        ? React.createElement('div',{style:{fontSize:'14px',color:'var(--t2)',marginBottom:'24px'}}, 'Connecting audio…')
        : React.createElement('div',{style:{fontSize:'14px',color:'var(--t2)',marginBottom:'24px'}}, endReason==='no_coins' ? 'Out of coins' : 'Call ended'),
    phase==='connected' ? React.createElement('div',{style:{fontSize:'13px',color:'var(--amber)',marginBottom:'40px'}}, localCoins+' coins remaining') : null,
    // Final polish: build stamp only renders when ringin_debug flag is set.
    // Used to leak the internal "v2.0-native-debug" string to every prod user.
    (function(){ try { return localStorage.getItem('ringin_debug') === '1' ? React.createElement('div',{style:{position:'fixed',bottom:'6px',left:'8px',fontSize:'8px',color:'rgba(255,255,255,0.2)',pointerEvents:'none',fontFamily:'monospace'}}, RINGIN_BUILD) : null; } catch(_){ return null; } })(),
    // Audio diagnostic line — visible while debugging audio routing on
    // native APK. Shows whether the Capacitor RingInAudio plugin is
    // registered and what AudioManager state is after each toggle.
    // Final polish: also gated on ringin_debug so prod users don't see
    // "plugin: NOT REGISTERED" green text plastered across the call UI.
    (function(){ try { var dbg = localStorage.getItem('ringin_debug') === '1'; return (dbg && audioDbg) ? React.createElement('div',{style:{position:'fixed',bottom:'20px',left:'8px',right:'8px',fontSize:'10px',color:'rgba(0,255,128,0.9)',fontFamily:'monospace',background:'rgba(0,0,0,0.7)',padding:'4px 8px',borderRadius:'4px',pointerEvents:'none',textAlign:'center',wordBreak:'break-all'}}, audioDbg) : null; } catch(_){ return null; } })(),
    error ? React.createElement('div',{style:{fontSize:'12px',color:'#ef4444',marginBottom:'16px',maxWidth:'320px',textAlign:'center'}},error) : null,
    (phase==='connected' || phase==='connecting') ? React.createElement('div',{style:{display:'flex',gap:'22px',alignItems:'center'}},
      // ── MIC / MUTE ─────────────────────────────────────────
      // The .ringin-tap class provides the press feedback via :active scale —
      // we deliberately do NOT transition the background or box-shadow because
      // Samsung Internet repaints the full gradient each frame during transition.
      React.createElement('button',{
        onClick: toggleMute,
        className: 'ringin-tap',
        title: muted ? 'Unmute' : 'Mute',
        disabled: phase!=='connected',
        style: Object.assign({}, BTN_BASE, {
          background: muted ? '#ffffff' : BTN_GRADIENT,
          color: muted ? '#7B6EFF' : '#ffffff',
          cursor: phase==='connected' ? 'pointer' : 'not-allowed',
          opacity: phase==='connected' ? 1 : 0.45,
          boxShadow: muted ? BTN_SHADOW_WHITE : BTN_SHADOW_BRAND,
        })
      },
        React.createElement('svg', SVG_ATTRS,
          MIC_PATHS[0], MIC_PATHS[1], MIC_PATHS[2],
          muted ? MIC_SLASH : null
        )
      ),
      // ── HANGUP — darker red with the call_end (handset) icon ──
      React.createElement('button',{
        onClick: onHangupClick,
        className: 'ringin-tap',
        title:'End call',
        style: HANGUP_BTN_STYLE,
      }, HANGUP_ICON),
      // ── SPEAKER (loudspeaker boost) ────────────────────────
      React.createElement('button',{
        onClick: toggleSpeaker,
        className: 'ringin-tap',
        title: speakerOn ? 'Switch off loudspeaker' : 'Switch on loudspeaker',
        disabled: phase!=='connected',
        style: Object.assign({}, BTN_BASE, {
          background: speakerOn ? '#ffffff' : BTN_GRADIENT,
          color: speakerOn ? '#7B6EFF' : '#ffffff',
          cursor: phase==='connected' ? 'pointer' : 'not-allowed',
          opacity: phase==='connected' ? 1 : 0.45,
          boxShadow: speakerOn ? BTN_SHADOW_WHITE : BTN_SHADOW_BRAND,
        })
      },
        React.createElement('svg', SVG_ATTRS,
          SPEAKER_PATHS[0], SPEAKER_PATHS[1], SPEAKER_PATHS[2]
        )
      )
    ) : React.createElement('button',{onClick:onEnd,className:'ringin-tap',style:{padding:'12px 32px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}},'Back')
  );
}
