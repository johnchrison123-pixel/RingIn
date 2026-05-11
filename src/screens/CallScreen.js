/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import {startCallSession} from '../utils/agora';
import {sb} from '../utils/supabase';
import {buildCallLog} from '../utils/callLog';

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
  var errorS = useState(null); var error = errorS[0]; var setError = errorS[1];
  var endReasonS = useState(null); var endReason = endReasonS[0]; var setEndReason = endReasonS[1];

  var sessionRef = useRef(null);   // holds the Agora controller {leave, setMuted}
  var endedRef = useRef(false);    // guard against double-end
  var wakeLockRef = useRef(null);  // navigator.wakeLock — keeps screen on (Chrome Android)
  var silentAudioRef = useRef(null); // hidden <audio> looping silent track — keeps iOS audio session alive

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
          wl.addEventListener('release', function(){
            // If lock dropped (e.g. tab backgrounded), try to re-acquire when visible
          });
        }
      }catch(e){ /* silently ignore */ }
    }
    function startSilentAudio(){
      try{
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
    acquireWakeLock();
    startSilentAudio();

    // Try to re-acquire wake lock when the tab regains visibility (system releases it when hidden)
    function onVis(){
      if(document.visibilityState === 'visible' && !wakeLockRef.current){
        acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', onVis);

    return function(){
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      try{ if(wakeLockRef.current){ wakeLockRef.current.release(); wakeLockRef.current = null; } }catch(e){}
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
        // Fall back gracefully — close after showing the error briefly
        setTimeout(function(){ if(!endedRef.current) hangup('start_failed'); }, 3500);
      }
    })();
    return function(){
      cancelled = true;
      var s = sessionRef.current;
      if (s) { try { s.leave(); } catch(e){} sessionRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[channel, myUserId]);

  // ── 2. Subscribe to invite status changes — REJECT/CANCEL/END close us here too,
  //      and crucially ACCEPTED flips us out of 'ringing' immediately even if Agora's
  //      onRemoteJoined hasn't fired yet (e.g. callee's mic-permission prompt is open).
  useEffect(function(){
    if(!inviteId) return;
    function applyStatus(st){
      if(!st) return;
      if(st==='accepted'){
        // Callee accepted but audio may not have started flowing yet — show 'Connecting…'.
        // We flip to 'connected' as soon as Agora's user-joined event fires.
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
    // Backup poll every 3s in case realtime drops the UPDATE
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
      // Find the SPECIFIC row we created (most recent ringing by me, last 30s) and cancel
      // only that one. Don't mass-update — would clobber any concurrent ringing call.
      sb.from('call_invites')
        .select('id')
        .eq('caller_id', session.user.id)
        .eq('status','ringing')
        .gte('created_at', new Date(Date.now() - 30000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .then(function(sel){
          if(!sel || !sel.data || !sel.data[0]) { console.log('[ringin] no ringing row to late-cancel'); return; }
          var rid = sel.data[0].id;
          sb.from('call_invites')
            .update({ status:newStatus, ended_at:new Date().toISOString(), duration_secs:secs, end_reason:reason||'caller_hangup' })
            .eq('id', rid)
            .then(function(u){
              if(u && u.error){ console.error('[ringin] late-cancel failed:', u.error); }
              else console.log('[ringin] late-cancel applied to', rid);
            });
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
    setTimeout(function(){ if(onEnd) onEnd(); }, 800);
  }

  function toggleMute(){
    setMuted(function(m){
      var next = !m;
      var s = sessionRef.current;
      if(s) try{ s.setMuted(next); }catch(e){}
      return next;
    });
  }

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
        React.createElement('div',{style:{position:'absolute',width:'120px',height:'120px',borderRadius:'50%',background:'rgba(123,110,255,0.15)',top:'-15px',left:'-15px',animation:'ripple 1.2s ease-out infinite'}}),
        React.createElement('div',{style:{position:'absolute',width:'140px',height:'140px',borderRadius:'50%',background:'rgba(123,110,255,0.08)',top:'-25px',left:'-25px',animation:'ripple 1.2s ease-out infinite 0.4s'}}),
        React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color||'var(--ac)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',position:'relative',zIndex:1}},
          expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (expert.initials||'?')
        )
      ),
      React.createElement('style',null,'@keyframes ripple{0%{transform:scale(0.8);opacity:1}100%{transform:scale(1.4);opacity:0}}'),
      React.createElement('div',{style:{fontSize:'20px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},expert.name||'User'),
      React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'8px'}},expert.role||'Member'),
      React.createElement('div',{style:{fontSize:'13px',color:'var(--t3)',marginBottom:'40px',display:'flex',alignItems:'center',gap:'6px'}},
        React.createElement('span',null,'Ringing'),
        React.createElement('span',{style:{letterSpacing:'2px'}},['.','..',  '...'][ringSecs%3])
      ),
      error ? React.createElement('div',{style:{fontSize:'12px',color:'#ef4444',marginBottom:'16px',maxWidth:'320px',textAlign:'center'}},error) : null,
      React.createElement('button',{
        onClick:function(){ hangup('caller_hangup'); },
        style:{width:'64px',height:'64px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'24px',cursor:'pointer',boxShadow:'0 4px 20px rgba(239,68,68,0.4)'}
      },'📵')
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
    (phase==='connected' || phase==='connecting') ? React.createElement('div',{style:{display:'flex',gap:'20px'}},
      React.createElement('button',{
        onClick: toggleMute,
        title: muted ? 'Unmute' : 'Mute',
        disabled: phase!=='connected',
        style:{width:'52px',height:'52px',borderRadius:'50%',background: muted ? 'var(--ac)' : 'var(--bg3)', border:'1px solid var(--border)',color: muted ? '#fff' : 'var(--t2)',fontSize:'20px',cursor: phase==='connected'?'pointer':'not-allowed',opacity:phase==='connected'?1:0.45}
      }, muted ? '🔇' : '🎙'),
      React.createElement('button',{
        onClick:function(){ hangup('caller_hangup'); },
        style:{width:'64px',height:'64px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer',boxShadow:'0 4px 20px rgba(239,68,68,0.4)'}
      },'📵'),
      React.createElement('button',{
        title:'Speaker (browser default)',
        disabled: phase!=='connected',
        style:{width:'52px',height:'52px',borderRadius:'50%',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'20px',cursor: phase==='connected'?'pointer':'not-allowed',opacity:phase==='connected'?1:0.45}
      },'🔊')
    ) : React.createElement('button',{onClick:onEnd,style:{padding:'12px 32px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}},'Back')
  );
}
