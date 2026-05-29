/* eslint-disable */
import React, {useEffect, useRef, useState} from 'react';
import {sb} from '../utils/supabase';
import {playRingtone, stopRingtone, hapticPulse} from '../utils/soundEngine';
import {hashUidToInt, prefetchAgora} from '../utils/agora';
import {safeInitials} from '../utils/initials'; /* FIX #10: UTF-16 safe initials */
import VerificationBadge from './VerificationBadge'; /* R40 */

// Full-screen overlay shown when someone calls this user.
// Props:
//   invite    object   the call_invites row (has caller_id, caller_name, caller_avatar, channel, rate_per_min, id)
//   session   object?  Supabase auth session — used to derive the callee's Agora uid so we can pre-fetch the join token
//   onAccept  fn       called when user accepts — receives the invite so parent can open CallScreen
//   onReject  fn       called after the invite is marked rejected
export default function IncomingCallModal(props){
  var invite = props.invite || {};
  var session = props.session;
  var hapticRef = useRef(null);
  /* R19 verifier-fix: track whether the user ACCEPTED the call. If true,
   * unmount cleanup must NOT delete the prefetched Agora token — CallScreen
   * mounts in the same commit and reads the stash asynchronously (after a
   * rAF yield). Deleting in cleanup wins the race and defeats the prefetch
   * optimization (Saves ~200-500ms of perceived call-setup latency). */
  var acceptedRef = useRef(false);
  // ROUND-9 FIX #3: prevent double-reject. If the user double-taps the
  // decline button OR taps it while the UPDATE is in-flight, we'd
  // previously fire two UPDATEs and two onReject() calls, occasionally
  // leaving the modal in a partially-dismissed state. One-shot guard.
  var rejectedRef = useRef(false);
  // R13 FIX #8: caller_avatar can 404 (deleted/expired Supabase storage URL,
  // CDN hiccup, etc.). Without onError, broken image icons appear inside the
  // gradient circle. Fall back to initials when the network/decode fails.
  var imgFailedS = useState(false); var imgFailed = imgFailedS[0]; var setImgFailed = imgFailedS[1];
  /* R40: caller's verified flag — lazy fetched from profiles on mount. */
  var callerVerifiedS = useState(false); var callerVerified = callerVerifiedS[0]; var setCallerVerified = callerVerifiedS[1];
  useEffect(function(){
    if (!invite || !invite.caller_id) return;
    var cancelled = false;
    try {
      sb.from('profiles').select('is_verified').eq('id', invite.caller_id).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) setCallerVerified(!!r.data.is_verified);
      }).catch(function(){});
    } catch(_){}
    return function(){ cancelled = true; };
  }, [invite && invite.caller_id]);

  // Real ringtone (warm two-stroke bell, loops every 2.4s, capped at 6 cycles).
  // Shorter haptic pattern (single ~250ms buzz per cycle) to avoid Samsung Internet
  // queuing long vibrate patterns — accumulated vibrate calls there can freeze
  // the JS thread when the call is finally accepted. Haptic also caps at 6 cycles.
  useEffect(function(){
    try{ playRingtone(); }catch(e){}
    var hapticCount = 0;
    function pulse(){ try{ hapticPulse([250]); }catch(e){} }
    pulse();
    hapticRef.current = setInterval(function(){
      hapticCount++;
      if(hapticCount >= 6){ if(hapticRef.current){ clearInterval(hapticRef.current); hapticRef.current = null; } return; }
      pulse();
    }, 2400);
    return function(){
      try{ stopRingtone(); }catch(e){}
      if(hapticRef.current){ clearInterval(hapticRef.current); hapticRef.current = null; }
    };
  },[]);

  // ── Pre-flight: warm up everything we'll need the moment the user taps
  // Accept, so the connecting → connected transition is as fast as possible.
  //
  //  (a) prefetchAgora() — ensures the agora-rtc-sdk-ng chunk is downloaded
  //      and parsed (no surprise lazy-load on tap).
  //  (b) Fetch the /api/agora-token NOW while the modal is ringing. By the
  //      time the user taps Accept, the token is already cached on window.
  //      startCallSession picks it up instead of doing the network roundtrip
  //      AFTER the tap. Saves ~200-500ms of perceived call-setup latency.
  useEffect(function(){
    try{ prefetchAgora(); }catch(e){}
    var channel = invite.channel || invite.id;
    if(!channel) return;
    if(!session || !session.user || !session.user.id) return;
    var uidStr = session.user.id;
    var uidInt = hashUidToInt(uidStr);
    var cancelled = false;
    try{
      fetch('/api/agora-token', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ channel: channel, uid: uidInt }),
        keepalive: true,
      }).then(function(r){
        if(cancelled || !r || !r.ok) return null;
        return r.json();
      }).then(function(data){
        if(cancelled || !data || !data.token) return;
        try{
          // ROUND-9 FIX #10: tag the prefetched-token stash with this
          // invite's id, so a stale token from a previous (or concurrent)
          // ring can't be accidentally consumed by a different call.
          // agora.js already gates on channel+uid match — inviteId is a
          // belt-and-braces audit trail (consumed-side check can be
          // strengthened later without breaking the existing contract).
          window.__ringinPrefetchedAgoraToken = {
            ts: Date.now(),
            inviteId: invite.id,
            channel: channel,
            uid: uidInt,
            token: data.token,
            appId: data.appId,
            expiresAt: data.expiresAt,
          };
        }catch(_){}
      }).catch(function(){ /* network hiccup — fall back to inline fetch later */ });
    }catch(e){ /* never block the modal on a pre-fetch error */ }
    return function(){
      cancelled = true;
      /* R19 FIX #7 (corrected after verifier review): clear the prefetched-token
       * stash on unmount IF this modal was for the same invite we stashed for
       * AND the user did NOT accept the call. On accept, CallScreen mounts in
       * the same commit and reads the stash AFTER a rAF yield — deleting here
       * would defeat the entire prefetch optimization. acceptedRef is set
       * inside accept() BEFORE props.onAccept triggers unmount, so we can tell
       * the difference between accept-path unmount and reject/dismiss unmount. */
      try {
        if (acceptedRef.current) return; // accept path — leave stash alone
        var stash = window.__ringinPrefetchedAgoraToken;
        if (stash && stash.inviteId === invite.id) {
          delete window.__ringinPrefetchedAgoraToken;
        }
      } catch(_){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function accept(){
    /* R19 verifier-fix: flag accepted BEFORE props.onAccept (which triggers
     * unmount). The cleanup below reads this ref and skips the stash-delete
     * so CallScreen → startCallSession → agora.js can still pick up the
     * prefetched token after its rAF yield. */
    acceptedRef.current = true;
    try{ stopRingtone(); }catch(e){}
    if(hapticRef.current){ clearInterval(hapticRef.current); hapticRef.current = null; }
    if(props.onAccept) props.onAccept(invite);
  }
  function reject(){
    // ROUND-9 FIX #3: dedupe — if user double-taps or tap fires while the
    // first UPDATE is in flight, bail. We also always call onReject (even
    // on error) so the modal closes; App.js's dismissedInvitesRef prevents
    // re-show from realtime/polling.
    if (rejectedRef.current) return;
    rejectedRef.current = true;
    try{ stopRingtone(); }catch(e){}
    if(hapticRef.current){ clearInterval(hapticRef.current); hapticRef.current = null; }
    try {
      if(invite.id){
        var p = sb.from('call_invites').update({status:'rejected', ended_at:new Date().toISOString(), end_reason:'callee_rejected'}).eq('id', invite.id);
        if (p && p.then) {
          p.then(function(){ if(props.onReject) props.onReject(invite); })
           .catch(function(){ if(props.onReject) props.onReject(invite); });
        } else {
          if(props.onReject) props.onReject(invite);
        }
      } else {
        if(props.onReject) props.onReject(invite);
      }
    } catch (_) {
      if(props.onReject) props.onReject(invite);
    }
  }

  var name = invite.caller_name || 'Someone';
  var avatar = invite.caller_avatar || null;
  var initials = safeInitials(name); /* FIX #10 */

  // Note: NO backdrop-filter — Samsung Internet/Galaxy GPUs run backdrop-filter
  // on the CPU which pegs a core during the ripple animations. Solid alpha bg
  // looks nearly identical and costs ~0 CPU. Keyframes live in src/index.css.
  // R13 FIX #1: zIndex raised from 1000 → 999999 so the ring overlay always
  // sits ABOVE the Moments cube/clickGuard (zIndex 9997/9998/99999). Without
  // this, a user watching a moment couldn't see or answer an incoming call
  // because the Moments viewer covered the IncomingCallModal.
  return React.createElement('div',{
    style:{position:'fixed',inset:0,zIndex:999999,background:'rgba(9,9,14,0.98)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px'}
  },
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'18px',textTransform:'uppercase',letterSpacing:'2px',fontWeight:700}},'Incoming Call'),
    React.createElement('div',{style:{position:'relative',marginBottom:'24px'}},
      React.createElement('div',{style:{position:'absolute',width:'140px',height:'140px',borderRadius:'50%',background:'rgba(123,110,255,0.15)',top:'-25px',left:'-25px',animation:'ripple 1.2s ease-out infinite'}}),
      React.createElement('div',{style:{position:'absolute',width:'170px',height:'170px',borderRadius:'50%',background:'rgba(232,77,154,0.10)',top:'-40px',left:'-40px',animation:'ripple 1.2s ease-out infinite 0.5s'}}),
      React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',position:'relative',zIndex:1}},
        (avatar && !imgFailed) ? React.createElement('img',{src:avatar,alt:name,onError:function(){ setImgFailed(true); },style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
      )
    ),
    React.createElement('div',{style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,color:'var(--text)',marginBottom:'6px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}},
      React.createElement('span',null,name),
      /* R40: show verification badge if caller is verified (lazy-fetched above). */
      callerVerified ? React.createElement(VerificationBadge,{size:22}) : null
    ),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'40px'}}, 'is calling you'),

    React.createElement('div',{style:{display:'flex',gap:'40px',alignItems:'center'}},
      React.createElement('div',{style:{textAlign:'center'}},
        React.createElement('button',{
          onClick:reject,
          className:'ringin-tap',
          title:'Decline',
          /* R40: red hangup with the standard handset-down icon inside. */
          style:{width:'70px',height:'70px',borderRadius:'50%',background:'#E13B2F',border:'none',color:'#fff',cursor:'pointer',boxShadow:'0 6px 22px rgba(225,59,47,0.65)',willChange:'transform',display:'flex',alignItems:'center',justifyContent:'center'}
        },
          /* Handset rotated 135° = the universal "hang up" icon. */
          React.createElement('svg',{viewBox:'0 0 24 24',width:'28',height:'28',fill:'none',stroke:'currentColor',strokeWidth:'2.2',strokeLinecap:'round',strokeLinejoin:'round',style:{transform:'rotate(135deg)'}},
            React.createElement('path',{d:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11L8.09 10.18a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z'})
          )
        ),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'8px'}},'Decline')
      ),
      React.createElement('div',{style:{textAlign:'center'}},
        React.createElement('button',{
          onClick:accept,
          className:'ringin-tap',
          title:'Accept',
          style:{width:'68px',height:'68px',borderRadius:'50%',background:'var(--green)',border:'none',color:'#fff',fontSize:'26px',cursor:'pointer',boxShadow:'0 6px 22px rgba(39,201,106,0.55)',animation:'ringinPulse 1.5s ease-in-out infinite',display:'flex',alignItems:'center',justifyContent:'center',willChange:'transform'}
        },
          React.createElement('svg',{viewBox:'0 0 24 24',width:'26',height:'26',fill:'none',stroke:'currentColor',strokeWidth:'2.2',strokeLinecap:'round',strokeLinejoin:'round'},
            React.createElement('path',{d:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11L8.09 10.18a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z'})
          )
        ),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'8px'}},'Accept')
      )
    )
  );
}
