/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import {startCallSession} from '../utils/agora';
import {sb} from '../utils/supabase';

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
  // ringing: waiting for callee to pick up (caller-side only)
  // connected: both peers on the call
  // ended/declined: terminal
  var phaseS = useState(isIncoming ? 'connected' : 'ringing');
  var phase = phaseS[0]; var setPhase = phaseS[1];

  var secsS = useState(0); var secs = secsS[0]; var setSecs = secsS[1];
  var ringSecsS = useState(0); var ringSecs = ringSecsS[0]; var setRingSecs = ringSecsS[1];
  var localCoinsS = useState(coins); var localCoins = localCoinsS[0]; var setLocalCoins = localCoinsS[1];
  var mutedS = useState(false); var muted = mutedS[0]; var setMuted = mutedS[1];
  var errorS = useState(null); var error = errorS[0]; var setError = errorS[1];
  var endReasonS = useState(null); var endReason = endReasonS[0]; var setEndReason = endReasonS[1];

  var sessionRef = useRef(null);   // holds the Agora controller {leave, setMuted}
  var endedRef = useRef(false);    // guard against double-end

  // ── 1. Start the Agora session ASAP — both caller and callee need to join the channel.
  useEffect(function(){
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

  // ── 2. Subscribe to invite status changes so a remote reject/cancel ends the call here too
  useEffect(function(){
    if(!inviteId) return;
    var ch = sb.channel('call-invite-'+inviteId)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'call_invites',filter:'id=eq.'+inviteId},function(p){
        var st = p && p.new && p.new.status;
        if(st==='rejected'){ setPhase('declined'); hangup('rejected'); }
        else if(st==='cancelled'){ hangup('cancelled'); }
        else if(st==='ended'){ hangup('remote_hangup'); }
      })
      .subscribe();
    return function(){ try{ sb.removeChannel(ch); }catch(e){} };
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
    // Update invite row
    if(inviteId){
      var newStatus = (reason==='rejected') ? 'rejected' : (reason==='no_answer'?'missed':'ended');
      sb.from('call_invites').update({
        status: newStatus,
        ended_at: new Date().toISOString(),
        duration_secs: secs,
        end_reason: reason || 'caller_hangup',
      }).eq('id', inviteId).then(function(){});
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
    React.createElement('div',{style:{fontSize:'12px',color: phase==='connected' ? 'var(--green)' : 'var(--t3)',marginBottom:'20px',display:'flex',alignItems:'center',gap:'5px'}},
      React.createElement('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background: phase==='connected' ? 'var(--green)' : 'var(--t3)',display:'inline-block'}}),
      phase==='connected' ? 'Connected' : 'Call ended'
    ),
    phase==='connected'
      ? React.createElement('div',{style:{fontSize:'42px',fontWeight:800,color:'var(--text)',marginBottom:'8px'}}, fmt(secs))
      : React.createElement('div',{style:{fontSize:'14px',color:'var(--t2)',marginBottom:'24px'}}, endReason==='no_coins' ? 'Out of coins' : 'Call ended'),
    phase==='connected' ? React.createElement('div',{style:{fontSize:'13px',color:'var(--amber)',marginBottom:'40px'}}, localCoins+' coins remaining') : null,
    error ? React.createElement('div',{style:{fontSize:'12px',color:'#ef4444',marginBottom:'16px',maxWidth:'320px',textAlign:'center'}},error) : null,
    phase==='connected' ? React.createElement('div',{style:{display:'flex',gap:'20px'}},
      React.createElement('button',{
        onClick: toggleMute,
        title: muted ? 'Unmute' : 'Mute',
        style:{width:'52px',height:'52px',borderRadius:'50%',background: muted ? 'var(--ac)' : 'var(--bg3)', border:'1px solid var(--border)',color: muted ? '#fff' : 'var(--t2)',fontSize:'20px',cursor:'pointer'}
      }, muted ? '🔇' : '🎙'),
      React.createElement('button',{
        onClick:function(){ hangup('caller_hangup'); },
        style:{width:'64px',height:'64px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer',boxShadow:'0 4px 20px rgba(239,68,68,0.4)'}
      },'📵'),
      React.createElement('button',{
        title:'Speaker (browser default)',
        style:{width:'52px',height:'52px',borderRadius:'50%',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'20px',cursor:'pointer'}
      },'🔊')
    ) : React.createElement('button',{onClick:onEnd,style:{padding:'12px 32px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}},'Back')
  );
}
