/* eslint-disable */
import React,{useState,useEffect,useRef,useCallback} from 'react';
import {startCallSession} from '../utils/agora';
import {sb} from '../utils/supabase';
import {buildCallLog} from '../utils/callLog';
import {playRingback,stopRingback,hapticPulse} from '../utils/soundEngine';

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
};
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
  var phase = phaseS[0]; var setPhase = phaseS[1];

  var secsS = useState(0); var secs = secsS[0]; var setSecs = secsS[1];
  var ringSecsS = useState(0); var ringSecs = ringSecsS[0]; var setRingSecs = ringSecsS[1];
  var localCoinsS = useState(coins); var localCoins = localCoinsS[0]; var setLocalCoins = localCoinsS[1];
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
      // iOS-ONLY. On Samsung Internet, a second <audio> element competes with
      // Agora's AudioContext for the device's audio focus path and runs el.play()'s
      // promise resolution on the main thread — slowing every subsequent button
      // tap by tens of ms. Skip entirely outside iOS.
      try{
        var ua = (navigator && navigator.userAgent) || '';
        var isIOS = /iP(hone|ad|od)/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
        if(!isIOS) return;
        var el = document.createElement('audio');
        el.setAttribute('playsinline','');
        el.setAttribute('muted','');
        el.loop = true;
        // A 1-second silent WAV (base64) — keeps the iOS audio session open
        el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        el.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
        document.body.appendChild(el);
        var p = el.play();
        if(p && p.catch){ p.catch(function(){}); }
        silentAudioRef.current = el;
      }catch(e){}
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
    var pollIv = setInterval(function(){
      sb.from('call_invites').select('status').eq('id', inviteId).single().then(function(r){
        if(r && r.data) applyStatus(r.data.status);
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
          setLocalCoins(function(c){
            var nc = c - rate;
            if(onCoinsChange) onCoinsChange(nc);
            if(nc <= 0){ hangup('no_coins'); return 0; }
            return nc;
          });
        }
        return next;
      });
    }, 1000);
    return function(){ clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase]);

  function fmt(s){var m=Math.floor(s/60);var ss=s%60;return m+':'+(ss<10?'0':'')+ss;}

  function hangup(reason){
    if(endedRef.current) return;
    endedRef.current = true;
    var s = sessionRef.current;
    if(s){ try{ s.leave(); }catch(e){} sessionRef.current = null; }
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

    setPhase('ended');
    endTimerRef.current = setTimeout(function(){
      endTimerRef.current = null;
      if(onEnd) onEnd();
    }, 800);
  }

  // Final unmount safety net — clear any remaining orphan timers.
  useEffect(function(){
    return function(){
      try { if(startFailedTimerRef.current){ clearTimeout(startFailedTimerRef.current); startFailedTimerRef.current = null; } } catch(e){}
      try { if(endTimerRef.current){ clearTimeout(endTimerRef.current); endTimerRef.current = null; } } catch(e){}
    };
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

  // Loudspeaker toggle. Boosts remote-audio volume on the playback side
  // (Agora's setVolume scale: 100 = normal, 250 = boosted for hands-free).
  // Browsers can't actually route to earpiece — this is a volume-based boost.
  var toggleSpeaker = useCallback(function(){
    setSpeakerOn(function(on){
      var next = !on;
      var s = sessionRef.current;
      if(s){ try{ s.setRemoteVolume(next ? 250 : 100); }catch(e){} }
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
      React.createElement('button',{
        onClick: onHangupClick,
        className: 'ringin-tap',
        title:'End call',
        style: HANGUP_BTN_STYLE
      })
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
      // ── HANGUP — darker plain red, no icon ─────────────────
      React.createElement('button',{
        onClick: onHangupClick,
        className: 'ringin-tap',
        title:'End call',
        style: HANGUP_BTN_STYLE,
      }),
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
