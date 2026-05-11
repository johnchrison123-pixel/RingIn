/* eslint-disable */
import React, {useEffect, useRef} from 'react';
import {sb} from '../utils/supabase';
import {playSound} from '../utils/soundEngine';

// Full-screen overlay shown when someone calls this user.
// Props:
//   invite    object   the call_invites row (has caller_id, caller_name, caller_avatar, channel, rate_per_min, id)
//   onAccept  fn       called when user accepts — receives the invite so parent can open CallScreen
//   onReject  fn       called after the invite is marked rejected
export default function IncomingCallModal(props){
  var invite = props.invite || {};
  var ringTimerRef = useRef(null);

  // Loop a notification chime until accepted/rejected
  useEffect(function(){
    function ring(){ try{ playSound('notification'); }catch(e){} }
    ring();
    ringTimerRef.current = setInterval(ring, 2500);
    return function(){ if(ringTimerRef.current) clearInterval(ringTimerRef.current); };
  },[]);

  function accept(){
    if(ringTimerRef.current) clearInterval(ringTimerRef.current);
    if(props.onAccept) props.onAccept(invite);
  }
  function reject(){
    if(ringTimerRef.current) clearInterval(ringTimerRef.current);
    if(invite.id){
      sb.from('call_invites').update({status:'rejected', ended_at:new Date().toISOString(), end_reason:'rejected'}).eq('id', invite.id).then(function(){});
    }
    if(props.onReject) props.onReject(invite);
  }

  var name = invite.caller_name || 'Someone';
  var avatar = invite.caller_avatar || null;
  var initials = (name || '?').substring(0,2).toUpperCase();

  return React.createElement('div',{
    style:{position:'fixed',inset:0,zIndex:1000,background:'rgba(9,9,14,0.96)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px'}
  },
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'18px',textTransform:'uppercase',letterSpacing:'2px',fontWeight:700}},'Incoming Call'),
    React.createElement('div',{style:{position:'relative',marginBottom:'24px'}},
      React.createElement('div',{style:{position:'absolute',width:'140px',height:'140px',borderRadius:'50%',background:'rgba(123,110,255,0.15)',top:'-25px',left:'-25px',animation:'ripple 1.2s ease-out infinite'}}),
      React.createElement('div',{style:{position:'absolute',width:'170px',height:'170px',borderRadius:'50%',background:'rgba(232,77,154,0.10)',top:'-40px',left:'-40px',animation:'ripple 1.2s ease-out infinite 0.5s'}}),
      React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',position:'relative',zIndex:1}},
        avatar ? React.createElement('img',{src:avatar,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
      )
    ),
    React.createElement('style',null,'@keyframes ripple{0%{transform:scale(0.8);opacity:1}100%{transform:scale(1.6);opacity:0}}'),
    React.createElement('div',{style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,color:'var(--text)',marginBottom:'6px'}}, name),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'40px'}}, 'is calling you'),

    React.createElement('div',{style:{display:'flex',gap:'40px',alignItems:'center'}},
      React.createElement('div',{style:{textAlign:'center'}},
        React.createElement('button',{
          onClick:reject,
          style:{width:'68px',height:'68px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'26px',cursor:'pointer',boxShadow:'0 6px 22px rgba(239,68,68,0.5)'}
        },'📵'),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'8px'}},'Decline')
      ),
      React.createElement('div',{style:{textAlign:'center'}},
        React.createElement('button',{
          onClick:accept,
          style:{width:'68px',height:'68px',borderRadius:'50%',background:'var(--green)',border:'none',color:'#fff',fontSize:'26px',cursor:'pointer',boxShadow:'0 6px 22px rgba(39,201,106,0.5)',animation:'pulse 1.5s ease-in-out infinite'}
        },'📞'),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'8px'}},'Accept')
      )
    ),
    React.createElement('style',null,'@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}')
  );
}
