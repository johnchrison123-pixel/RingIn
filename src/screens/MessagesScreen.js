/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {createClient} from '@supabase/supabase-js';
var sb=createClient(process.env.REACT_APP_SUPABASE_URL,process.env.REACT_APP_SUPABASE_ANON_KEY);

var EXPERT_CONVOS_BASE=[
  {id:'e1',initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',last:'Thank you for your question!',time:'2m ago',unread:2,img:'https://i.pravatar.cc/150?img=47',rate:120},
  {id:'e2',initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',last:'I will send you the resources.',time:'1h ago',unread:0,img:'https://i.pravatar.cc/150?img=12',rate:80},
  {id:'e3',initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',last:'Great progress! Keep it up.',time:'Yesterday',unread:1,img:'https://i.pravatar.cc/150?img=23',rate:60},
];

function timeAgo(dateStr){
  if(!dateStr) return '';
  var now = new Date();
  var str = dateStr.toString();
  if(!str.includes('Z')&&!str.includes('+')) str = str+'Z';
  var date = new Date(str);
  var diff = Math.floor((now-date)/1000);
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<172800) return 'Yesterday';
  return date.toLocaleDateString([],{month:'short',day:'numeric'});
}

// ── Audio engine ──
var _msCtx=null;
function getMsCtx(){if(!_msCtx){try{_msCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return _msCtx;}
var _swooshRef={osc:null,gain:null};
function startSwooshMs(isHeart){
  stopSwooshMs();
  var ctx=getMsCtx();if(!ctx)return;
  var osc=ctx.createOscillator();
  var gain=ctx.createGain();
  var filter=ctx.createBiquadFilter();
  osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
  filter.type='bandpass';filter.frequency.value=isHeart?600:400;filter.Q.value=2;
  osc.type='sawtooth';
  osc.frequency.setValueAtTime(isHeart?180:140,ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(isHeart?560:380,ctx.currentTime+2.0);
  gain.gain.setValueAtTime(0.001,ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.07,ctx.currentTime+0.25);
  gain.gain.linearRampToValueAtTime(0.14,ctx.currentTime+2.0);
  osc.start();
  _swooshRef.osc=osc;_swooshRef.gain=gain;_swooshRef.ctx=ctx;
}
function stopSwooshMs(){
  if(_swooshRef.osc){
    try{
      var ctx=_swooshRef.ctx;
      _swooshRef.gain.gain.setValueAtTime(_swooshRef.gain.gain.value||0.05,ctx.currentTime);
      _swooshRef.gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.08);
      _swooshRef.osc.stop(ctx.currentTime+0.09);
    }catch(e){}
    _swooshRef.osc=null;_swooshRef.gain=null;
  }
}
function playReleaseMs(isHeart){
  var ctx=getMsCtx();if(!ctx)return;
  if(isHeart){
    // soft thud + rising chime = heartbeat
    var o1=ctx.createOscillator();var g1=ctx.createGain();
    o1.connect(g1);g1.connect(ctx.destination);
    o1.type='sine';o1.frequency.setValueAtTime(90,ctx.currentTime);
    g1.gain.setValueAtTime(0.28,ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.18);
    o1.start();o1.stop(ctx.currentTime+0.18);
    var o2=ctx.createOscillator();var g2=ctx.createGain();
    o2.connect(g2);g2.connect(ctx.destination);
    o2.type='sine';o2.frequency.setValueAtTime(680,ctx.currentTime+0.05);
    o2.frequency.exponentialRampToValueAtTime(920,ctx.currentTime+0.28);
    g2.gain.setValueAtTime(0.18,ctx.currentTime+0.05);
    g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.34);
    o2.start(ctx.currentTime+0.05);o2.stop(ctx.currentTime+0.34);
    // third sparkle
    var o3=ctx.createOscillator();var g3=ctx.createGain();
    o3.connect(g3);g3.connect(ctx.destination);
    o3.type='sine';o3.frequency.setValueAtTime(1200,ctx.currentTime+0.12);
    g3.gain.setValueAtTime(0.08,ctx.currentTime+0.12);
    g3.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.26);
    o3.start(ctx.currentTime+0.12);o3.stop(ctx.currentTime+0.26);
  } else {
    // thumbs: crisp pop + chord
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='triangle';o.frequency.setValueAtTime(320,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(560,ctx.currentTime+0.10);
    g.gain.setValueAtTime(0.24,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.13);
    o.start();o.stop(ctx.currentTime+0.13);
    var ob=ctx.createOscillator();var gb=ctx.createGain();
    ob.connect(gb);gb.connect(ctx.destination);
    ob.type='sine';ob.frequency.setValueAtTime(880,ctx.currentTime+0.06);
    gb.gain.setValueAtTime(0.12,ctx.currentTime+0.06);
    gb.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);
    ob.start(ctx.currentTime+0.06);ob.stop(ctx.currentTime+0.22);
    var oc=ctx.createOscillator();var gc=ctx.createGain();
    oc.connect(gc);gc.connect(ctx.destination);
    oc.type='sine';oc.frequency.setValueAtTime(1100,ctx.currentTime+0.09);
    gc.gain.setValueAtTime(0.07,ctx.currentTime+0.09);
    gc.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.20);
    oc.start(ctx.currentTime+0.09);oc.stop(ctx.currentTime+0.20);
  }
}

// Flat gradient heart — strong signature colors #7B6EFF → #E84D9A
function HeartSvg(props){
  var sz=props.size||60; var id=props.id||'hsvg';
  return React.createElement('svg',{viewBox:'0 0 24 24',width:sz,height:sz,style:{overflow:'visible'}},
    React.createElement('defs',null,
      React.createElement('linearGradient',{id:id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},
        React.createElement('stop',{offset:'0%',stopColor:'#8B7FFF'}),
        React.createElement('stop',{offset:'50%',stopColor:'#D455AA'}),
        React.createElement('stop',{offset:'100%',stopColor:'#F03D8E'})
      )
    ),
    React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:'url(#'+id+')',stroke:'none'})
  );
}

function ChatBox({convo,session,onBack,onViewExpert,onCall,onMessageSent}){
  var myId = session&&session.user ? session.user.id : 'guest';
  var myName = session&&session.user ? session.user.email.split('@')[0] : 'You';
  var convId = convo.convId || convo.id;
  var initMsgs = [];
  try{ var cm=localStorage.getItem('msgs_'+convId); if(cm) initMsgs=JSON.parse(cm); }catch(e){}
  var mS=useState(initMsgs); var msgs=mS[0]; var setMsgs=mS[1];
  var tS=useState(''); var txt=tS[0]; var setTxt=tS[1];
  var emojiS=useState(false); var showEmoji=emojiS[0]; var setShowEmoji=emojiS[1];
  var LMAX=28;
  var levYS=useState(0); var levY=levYS[0]; var setLevY=levYS[1];
  var levStartS=useState(null); var levStart=levStartS[0]; var setLevStart=levStartS[1];
  // levActive: null | 'heart' | 'thumbs'  — set the moment lever crosses threshold
  var levActiveS=useState(null); var levActive=levActiveS[0]; var setLevActive=levActiveS[1];
  // levHoldPct: 0→1 over 1.5s while holding past threshold
  var levHoldPctS=useState(0); var levHoldPct=levHoldPctS[0]; var setLevHoldPct=levHoldPctS[1];
  var levHoldIntervalRef=useRef(null);
  var levHoldStartRef=useRef(null);

  var bottomRef=useRef(null);

  useEffect(function(){
    // Load messages
    sb.from('messages').select('*').eq('conversation_id',convId).order('created_at').then(function(r){
      if(r.data) setMsgs(r.data);
      // Mark as read
      sb.from('messages').update({read:true}).eq('conversation_id',convId).neq('sender_id',myId).then(function(){});
    });
    // Realtime subscription
    var ch=sb.channel('chat-'+convId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+convId},function(p){
        setMsgs(function(prev){
          if(prev.find(function(m){return m.id===p.new.id;})) return prev;
          return prev.concat([p.new]);
        });
        // Mark received messages as read
        if(p.new.sender_id!==myId){
          sb.from('messages').update({read:true}).eq('id',p.new.id).then(function(){});
        }
      }).subscribe();
    return function(){sb.removeChannel(ch);};
  },[convId]);

  useEffect(function(){bottomRef.current&&bottomRef.current.scrollIntoView({behavior:'smooth'});},[msgs]);

  function getCY(e){
    if(e.touches&&e.touches.length)return e.touches[0].clientY;
    if(e.changedTouches&&e.changedTouches.length)return e.changedTouches[0].clientY;
    return e.clientY;
  }

  function activateLever(type){
    if(levActive===type) return;
    setLevActive(type);
    setLevHoldPct(0);
    levHoldStartRef.current=Date.now();
    clearInterval(levHoldIntervalRef.current);
    startSwooshMs(type==='heart');
    levHoldIntervalRef.current=setInterval(function(){
      var elapsed=(Date.now()-levHoldStartRef.current)/1500;
      setLevHoldPct(Math.min(elapsed,1));
      if(elapsed>=1)clearInterval(levHoldIntervalRef.current);
    },16);
  }

  function deactivateLever(){
    clearInterval(levHoldIntervalRef.current);
    stopSwooshMs();
    setLevActive(null);
    setLevHoldPct(0);
  }

  function sendReactionEmoji(emoji){
    var receiverId=convo.receiverId||(convId.replace(myId,'').replace('_',''));
    var m={conversation_id:convId,sender_id:myId,sender_name:myName,receiver_id:receiverId,text:emoji,read:false};
    sb.from('messages').insert([m]).then(function(r){
      if(r.error)console.error(r.error);
      else if(onMessageSent)onMessageSent(convo,emoji);
    });
  }

  function leverRelease(){
    var active=levActive;
    deactivateLever();
    setLevY(0);
    setLevStart(null);
    if(active){
      sendReactionEmoji(active==='heart'?'❤️':'👍');
      playReleaseMs(active==='heart');
    }
  }

  function send(){
    if(!txt.trim()) return;
    var receiverId = convo.receiverId || (convId.replace(myId,'').replace('_',''));
    var m={
      conversation_id:convId,
      sender_id:myId,
      sender_name:myName,
      receiver_id:receiverId,
      text:txt.trim(),
      read:false
    };
    setTxt('');
    sb.from('messages').insert([m]).then(function(r){
      if(r.error) console.error(r.error);
      else if(onMessageSent) onMessageSent(convo, txt.trim());
    });
  }

  var overlayScale = 1 + levHoldPct * 2; // 1x → 3x
  var glowRadius = 10 + levHoldPct * 30;

  return React.createElement('div',{
    style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'},
  },
    // ── Header ──
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:onBack,style:{background:'none',border:'none',color:'var(--ac)',fontSize:'20px',cursor:'pointer'}},'<'),
      React.createElement('div',{style:{width:'38px',height:'38px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',overflow:'hidden',flexShrink:0}},
        convo.img?React.createElement('img',{src:convo.img,alt:convo.name,style:{width:'100%',height:'100%',objectFit:'cover'}}):(convo.initials||(convo.name||'?').substring(0,2).toUpperCase())
      ),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'var(--text)'}},convo.name),
        convo.isOnline?React.createElement('div',{style:{fontSize:'10px',color:'var(--green)',display:'flex',alignItems:'center',gap:'3px'}},
          React.createElement('span',{style:{width:'5px',height:'5px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}),'Online'
        ):React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},convo.role||'Member')
      ),
      convo.rate?React.createElement('button',{onClick:function(){if(onCall)onCall(convo);},style:{padding:'6px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Call'):null
    ),

    // ── Chat messages area with reaction overlay ──
    React.createElement('div',{style:{flex:1,position:'relative',overflow:'hidden'}},
      React.createElement('div',{style:{height:'100%',overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px',scrollbarWidth:'none',msOverflowStyle:'none'}},
        msgs.length===0&&React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',marginTop:'40px'}},'No messages yet. Say hi! 👋'),
        msgs.map(function(m){
          var isMe=m.sender_id===myId;
          return React.createElement('div',{key:m.id,style:{display:'flex',justifyContent:isMe?'flex-end':'flex-start',alignItems:'flex-end',gap:'6px'}},
            !isMe?React.createElement('div',{style:{width:'26px',height:'26px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}},
              convo.img?React.createElement('img',{src:convo.img,style:{width:'100%',height:'100%',objectFit:'cover'}}):(convo.initials||'?')
            ):null,
            React.createElement('div',null,
              React.createElement('div',{style:{maxWidth:'260px',padding:'9px 13px',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',background:isMe?'var(--ac)':'var(--bg3)',border:isMe?'none':'1px solid var(--border)',fontSize:'13px',color:isMe?'#fff':'var(--text)',lineHeight:1.4}},m.text),
              React.createElement('div',{style:{fontSize:'9px',color:'var(--t3)',textAlign:isMe?'right':'left',marginTop:'3px',display:'flex',alignItems:'center',justifyContent:isMe?'flex-end':'flex-start',gap:'4px'}},
                m.created_at?React.createElement('span',null,new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',timeZone:localStorage.getItem('user_timezone')||undefined})):null,
                isMe?React.createElement('span',{style:{color:m.read?'var(--ac)':'var(--t3)'}},m.read?'✓✓':'✓'):null
              )
            )
          );
        }),
        React.createElement('div',{ref:bottomRef})
      ),

      // ── Reaction overlay in chat window ──
      levActive?React.createElement('div',{style:{
        position:'absolute',inset:0,
        display:'flex',alignItems:'center',justifyContent:'center',
        pointerEvents:'none',
        zIndex:10,
        background:'transparent'
      }},
        // shine — grows with heart, fully dissolves to rgba(0) at 100%
        React.createElement('div',{style:{
          position:'absolute',
          width:(overlayScale*200)+'px',
          height:(overlayScale*200)+'px',
          borderRadius:'50%',
          background:levActive==='heart'
            ?'radial-gradient(circle,'
              +'rgba(139,127,255,0.60) 0%,'
              +'rgba(170,90,210,0.50) 8%,'
              +'rgba(200,75,180,0.40) 18%,'
              +'rgba(225,70,155,0.30) 28%,'
              +'rgba(240,61,142,0.20) 38%,'
              +'rgba(220,70,150,0.13) 48%,'
              +'rgba(190,80,195,0.08) 57%,'
              +'rgba(165,95,215,0.05) 65%,'
              +'rgba(150,100,220,0.03) 72%,'
              +'rgba(145,110,225,0.018) 78%,'
              +'rgba(142,118,230,0.010) 83%,'
              +'rgba(140,122,232,0.005) 88%,'
              +'rgba(139,125,255,0.002) 92%,'
              +'rgba(139,127,255,0.001) 95%,'
              +'rgba(139,127,255,0.000) 98%,'
              +'rgba(139,127,255,0.000) 100%)'
            :'radial-gradient(circle,'
              +'rgba(139,127,255,0.60) 0%,'
              +'rgba(139,127,255,0.46) 10%,'
              +'rgba(139,127,255,0.32) 22%,'
              +'rgba(139,127,255,0.20) 34%,'
              +'rgba(139,127,255,0.12) 46%,'
              +'rgba(139,127,255,0.07) 56%,'
              +'rgba(139,127,255,0.04) 65%,'
              +'rgba(139,127,255,0.020) 73%,'
              +'rgba(139,127,255,0.010) 80%,'
              +'rgba(139,127,255,0.004) 86%,'
              +'rgba(139,127,255,0.001) 92%,'
              +'rgba(139,127,255,0.000) 97%,'
              +'rgba(139,127,255,0.000) 100%)',
          transition:'none',
          pointerEvents:'none'
        }}),
        // emoji / heart centered, growing
        React.createElement('div',{style:{
          position:'relative',
          transform:'scale('+overlayScale+')',
          transformOrigin:'center',
          transition:'none'
        }},
          levActive==='heart'
            ?React.createElement(HeartSvg,{size:64,id:'chatOverlayHeart'})
            :React.createElement('div',{style:{
                fontSize:'60px',lineHeight:1,
                filter:'drop-shadow(0 0 '+(8+levHoldPct*22)+'px rgba(123,110,255,'+(0.7+levHoldPct*0.3)+')'
              }},'👍')
        )
      ):null
    ),

    showEmoji?React.createElement('div',{style:{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:'6px',background:'var(--bg)'}},
      ['😊','😂','❤️','🔥','👍','🙌','😍','🤔','👏','🎉','💪','✨','😢','😮','🥳','😎','🙏','💯','😅','🤣'].map(function(em){
        return React.createElement('span',{key:em,onClick:function(){setTxt(function(t){return t+em;});setShowEmoji(false);},style:{fontSize:'22px',cursor:'pointer',padding:'3px'}},em);
      })
    ):null,

    // ── Input bar ──
    React.createElement('div',{style:{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0,alignItems:'center',background:'var(--bg)'}},
      React.createElement('label',{style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--bg3)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:'16px'}},
        '📷',
        React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0])alert('Photo sharing coming soon!');}})
      ),
      React.createElement('button',{
        onClick:function(){setShowEmoji(function(v){return !v;});},
        style:{width:'34px',height:'34px',borderRadius:'50%',background:showEmoji?'var(--acg)':'var(--bg3)',border:showEmoji?'1px solid var(--ac)':'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:'16px',color:showEmoji?'var(--ac)':'var(--text)'}
      },'😊'),
      React.createElement('input',{
        value:txt,
        onChange:function(e){setTxt(e.target.value);},
        onKeyDown:function(e){if(e.key==='Enter')send();},
        placeholder:'Type a message...',
        style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'22px',padding:'10px 14px',fontSize:'14px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
      }),

      // ── Lever ──
      (function(){
        var pct=Math.min(Math.abs(levY)/LMAX,1);
        var knobGlow=levActive==='heart'?'rgba(232,77,154,'+(0.3+levHoldPct*0.5)+')':levActive==='thumbs'?'rgba(123,110,255,'+(0.3+levHoldPct*0.5)+')':'rgba(123,110,255,0.25)';
        return React.createElement('div',{style:{position:'relative',flexShrink:0,width:'38px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',userSelect:'none',touchAction:'none'}},
          // ── housing ──
          React.createElement('div',{
            style:{
              width:'38px',height:'82px',borderRadius:'19px',
              background:'rgba(16,12,28,0.9)',
              backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
              border:'1px solid '+(levActive==='heart'?'rgba(232,77,154,0.45)':levActive==='thumbs'?'rgba(123,110,255,0.45)':'rgba(255,255,255,0.12)'),
              boxShadow:'0 6px 28px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.08)'
                +(levActive?', 0 0 20px '+(levActive==='heart'?'rgba(232,77,154,0.25)':'rgba(123,110,255,0.25)'):''),
              position:'relative',overflow:'hidden',cursor:'ns-resize',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',
              padding:'10px 0',
              transition:'border-color 0.2s,box-shadow 0.2s'
            },
            onTouchStart:function(e){e.preventDefault();setLevStart(getCY(e));},
            onTouchMove:function(e){
              e.preventDefault();
              if(levStart===null)return;
              var dy=getCY(e)-levStart;
              var clamped=Math.max(-LMAX,Math.min(LMAX,dy));
              setLevY(clamped);
              if(clamped<=-14)activateLever('heart');
              else if(clamped>=14)activateLever('thumbs');
              else deactivateLever();
            },
            onTouchEnd:function(e){e.preventDefault();leverRelease();},
            onMouseDown:function(e){setLevStart(getCY(e));},
            onMouseMove:function(e){
              if(levStart===null)return;
              var dy=getCY(e)-levStart;
              var clamped=Math.max(-LMAX,Math.min(LMAX,dy));
              setLevY(clamped);
              if(clamped<=-14)activateLever('heart');
              else if(clamped>=14)activateLever('thumbs');
              else deactivateLever();
            },
            onMouseUp:function(){leverRelease();},
            onMouseLeave:function(){if(levStart!==null)leverRelease();}
          },
            // heart icon top
            React.createElement('div',{style:{opacity:levActive==='heart'?0.9+levHoldPct*0.1:0.28,transition:'opacity 0.15s'}},
              React.createElement(HeartSvg,{size:14,id:'levHTop'})
            ),
            // knob
            React.createElement('div',{style:{
              width:'30px',height:'30px',borderRadius:'50%',flexShrink:0,
              background:'linear-gradient(145deg,#FFFFFF,#EDE8FF)',
              boxShadow:'0 3px 12px rgba(0,0,0,0.45), 0 0 0 2px '+knobGlow,
              transform:'translateY('+levY+'px)',
              transition:levStart!==null?'box-shadow 0.15s':'transform 0.42s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.15s',
              display:'flex',alignItems:'center',justifyContent:'center',zIndex:2
            }},
              React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'3.5px',alignItems:'center'}},
                React.createElement('div',{style:{width:'13px',height:'1.5px',borderRadius:'1px',background:'rgba(80,60,160,0.28)'}}),
                React.createElement('div',{style:{width:'9px',height:'1.5px',borderRadius:'1px',background:'rgba(80,60,160,0.18)'}}),
                React.createElement('div',{style:{width:'13px',height:'1.5px',borderRadius:'1px',background:'rgba(80,60,160,0.28)'}})
              )
            ),
            // thumbs icon bottom
            React.createElement('div',{style:{fontSize:'12px',opacity:levActive==='thumbs'?0.9+levHoldPct*0.1:0.28,transition:'opacity 0.15s'}},'👍')
          ),
          // label
          React.createElement('div',{style:{fontSize:'7.5px',color:levActive?'var(--ac)':'var(--t3)',fontFamily:'DM Sans,sans-serif',textAlign:'center',letterSpacing:'0.2px',transition:'color 0.2s'}},
            levActive==='heart'?'♥ hold':levActive==='thumbs'?'👍 hold':'react'
          )
        );
      })(),

      // send button
      React.createElement('button',{
        onClick:send,disabled:!txt.trim(),
        style:{width:'40px',height:'40px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'18px',cursor:txt.trim()?'pointer':'default',flexShrink:0,opacity:txt.trim()?1:0.32,display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity 0.2s'}
      },'✓')
    )
  );
}

export default function MessagesScreen(props){
  var session = props.session;
  var myId = session&&session.user ? session.user.id : null;
  var expertConvosS=useState(EXPERT_CONVOS_BASE); var expertConvos=expertConvosS[0]; var setExpertConvos=expertConvosS[1];
  var activeS=useState(props.initConvo||null); var active=activeS[0]; var setActive=activeS[1];
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var coinsS=useState(50); var coins=coinsS[0]; var setCoins=coinsS[1];
  var searchS=useState(''); var search=searchS[0]; var setSearch=searchS[1];
  var searchResS=useState([]); var searchRes=searchResS[0]; var setSearchRes=searchResS[1];
  var showNewS=useState(false); var showNew=showNewS[0]; var setShowNew=showNewS[1];
  var refreshingS=useState(false); var refreshing=refreshingS[0]; var setRefreshing=refreshingS[1];
  var pullStartS=useState(0); var pullStart=pullStartS[0]; var setPullStart=pullStartS[1];
  var pullDistS=useState(0); var pullDist=pullDistS[0]; var setPullDist=pullDistS[1];
  var userConvosS=useState(function(){
    try{var cc=localStorage.getItem('convos_'+myId);if(cc)return JSON.parse(cc);}catch(e){}
    return [];
  }); var userConvos=userConvosS[0]; var setUserConvos=userConvosS[1];
  var unreadS=useState({}); var unread=unreadS[0]; var setUnread=unreadS[1];
  var totalUnreadS=useState(function(){
    try{ var cc=localStorage.getItem('convos_'+myId); if(cc){var c=JSON.parse(cc);return c.reduce(function(s,x){return s+(x.unreadCount||0);},0);} }catch(e){}
    return 0;
  }); var totalUnread=totalUnreadS[0]; var setTotalUnread=totalUnreadS[1];

  // Load real user conversations
  useEffect(function(){
    // Auto reconnect when user comes back to tab
    function handleVisibility(){
      if(document.visibilityState==='visible'){
        sb.removeAllChannels();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return function(){document.removeEventListener('visibilitychange', handleVisibility);};
  },[]);

  useEffect(function(){
    if(!myId) return;
    // Get all messages where I am sender or receiver
    sb.from('messages').select('*').or('sender_id.eq.'+myId+',receiver_id.eq.'+myId).order('created_at',{ascending:false}).then(function(res){
      if(!res.data||res.data.length===0) return;
      // Filter out expert fake convos
      res.data = res.data.filter(function(m){return m.conversation_id&&!m.conversation_id.startsWith('e');});
      if(!res.data) return;
      // Group by conversation_id
      var convMap = {};
      res.data.forEach(function(m){
        if(!convMap[m.conversation_id]){
          convMap[m.conversation_id] = {
            id: m.conversation_id,
            convId: m.conversation_id,
            lastMsg: m.text,
            lastTime: m.created_at,
            unreadCount: 0,
            otherId: m.sender_id===myId ? m.receiver_id : m.sender_id,
            otherName: m.sender_id===myId ? '' : (m.sender_name||''),
          };
        }
        if(!m.read && m.sender_id!==myId) convMap[m.conversation_id].unreadCount++;
      });

      // Load profiles for each conversation
      var convList = Object.values(convMap);
      var otherIds = convList.map(function(c){return c.otherId;}).filter(Boolean);
      if(otherIds.length===0) return;

      sb.from('profiles').select('*').in('id',otherIds).then(function(pr){
        var profileMap = {};
        if(pr.data) pr.data.forEach(function(p){profileMap[p.id]=p;});
        var enriched = convList.map(function(c){
          var prof = profileMap[c.otherId]||{};
          return Object.assign({},c,{
            name: prof.full_name||prof.email||c.otherName||'User',
            img: prof.avatar_url||null,
            isOnline: prof.is_online||false,
            color: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
            initials: (prof.full_name||prof.email||'U').substring(0,2).toUpperCase(),
            receiverId: c.otherId,
          });
        });
        setUserConvos(enriched);
        try{localStorage.setItem('convos_'+myId, JSON.stringify(enriched));}catch(e){}
        // Count total unread
        var total = enriched.reduce(function(sum,c){return sum+(c.unreadCount||0);},0);
        setTotalUnread(total);
      });
    });

    // Realtime - new message notification
    var ch = sb.channel('inbox-'+myId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'receiver_id=eq.'+myId},function(p){
        setTotalUnread(function(t){return t+1;});
        setUserConvos(function(prev){
          var exists = prev.find(function(c){return c.convId===p.new.conversation_id;});
          if(exists){
            return prev.map(function(c){
              if(c.convId!==p.new.conversation_id) return c;
              return Object.assign({},c,{lastMsg:p.new.text,unreadCount:(c.unreadCount||0)+1});
            });
          }
          return prev;
        });
      }).subscribe();
    return function(){sb.removeChannel(ch);};
  },[myId]);

  // Search users
  useEffect(function(){
    if(!search.trim()){setSearchRes([]);return;}
    sb.from('profiles').select('*').or('email.ilike.%'+search+'%,full_name.ilike.%'+search+'%').then(function(res){
      setSearchRes((res.data||[]).filter(function(u){return u.id!==myId;}));
    });
  },[search]);

  function refreshConvos(){
    if(!myId||refreshing) return;
    setRefreshing(true);
    sb.from('messages').select('*').or('sender_id.eq.'+myId+',receiver_id.eq.'+myId).order('created_at',{ascending:false}).then(function(res){
      if(!res.data){setRefreshing(false);return;}
      res.data = res.data.filter(function(m){return m.conversation_id&&!m.conversation_id.startsWith('e');});
      var convMap={};
      res.data.forEach(function(m){
        if(!convMap[m.conversation_id]){
          convMap[m.conversation_id]={id:m.conversation_id,convId:m.conversation_id,lastMsg:m.text,lastTime:m.created_at,unreadCount:0,otherId:m.sender_id===myId?m.receiver_id:m.sender_id,otherName:m.sender_id===myId?'':m.sender_name};
        }
        if(!m.read&&m.sender_id!==myId) convMap[m.conversation_id].unreadCount++;
      });
      var convList=Object.values(convMap);
      var otherIds=convList.map(function(c){return c.otherId;}).filter(Boolean);
      if(otherIds.length===0){setRefreshing(false);return;}
      sb.from('profiles').select('*').in('id',otherIds).then(function(pr){
        var profileMap={};
        if(pr.data) pr.data.forEach(function(p){profileMap[p.id]=p;});
        var enriched=convList.map(function(c){
          var prof=profileMap[c.otherId]||{};
          return Object.assign({},c,{name:prof.full_name||prof.email||c.otherName||'User',img:prof.avatar_url||null,isOnline:prof.is_online||false,color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',initials:(prof.full_name||prof.email||'U').substring(0,2).toUpperCase(),receiverId:c.otherId});
        });
        setUserConvos(enriched);
        try{localStorage.setItem('convos_'+myId,JSON.stringify(enriched));}catch(e){}
        var total=enriched.reduce(function(sum,c){return sum+(c.unreadCount||0);},0);
        setTotalUnread(total);
        setRefreshing(false);
      });
    });
  }

  function startConvo(user){
    var convId = [myId,user.id].sort().join('_');
    var convo = {
      id:convId, convId:convId,
      name:user.full_name||user.email.split('@')[0],
      role:user.is_online?'Online':'Member',
      isOnline:user.is_online,
      color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
      img:user.avatar_url||null,
      initials:(user.full_name||user.email||'?').substring(0,2).toUpperCase(),
      receiverId:user.id,
    };
    setShowNew(false);
    setSearch('');
    setActive(convo);
  }

  function formatTime(date){
    var d = date ? new Date(date) : new Date();
    var now = new Date();
    var diff = Math.floor((now-d)/1000);
    if(diff<60) return 'Just now';
    if(diff<3600) return Math.floor(diff/60)+'m ago';
    if(diff<86400) return Math.floor(diff/3600)+'h ago';
    return d.toLocaleDateString([],{month:'short',day:'numeric'});
  }

  function handleMessageSent(convo, text){
    // Update user convos
    setUserConvos(function(prev){
      var exists = prev.find(function(c){return c.convId===convo.convId;});
      if(exists){
        return prev.map(function(c){
          if(c.convId!==convo.convId) return c;
          return Object.assign({},c,{lastMsg:text,lastTime:new Date().toISOString()});
        });
      }
      return [Object.assign({},convo,{lastMsg:text,unreadCount:0,lastTime:new Date().toISOString()})].concat(prev);
    });
    // Update expert convos
    setExpertConvos(function(prev){
      return prev.map(function(c){
        if(c.id!==convo.id) return c;
        return Object.assign({},c,{last:'You: '+text,time:'Just now'});
      });
    });
  }

  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coins,onCoinsChange:setCoins,onEnd:function(){setActiveCall(null);}});
  if(active) return React.createElement(ChatBox,{convo:active,session:session,onBack:function(){setActive(null);},onViewExpert:props.onViewExpert,onCall:function(exp){setActiveCall(exp);},onMessageSent:handleMessageSent});

  return React.createElement('div',{
    style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'},
  },
    // Header
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px'}},
        React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Messages'),
        totalUnread>0 ? React.createElement('div',{style:{width:'18px',height:'18px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},totalUnread>9?'9+':totalUnread) : null
      ),
      React.createElement('button',{onClick:function(){setShowNew(!showNew);},style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+')
    ),
    pullDist>20||refreshing ? React.createElement('div',{style:{textAlign:'center',padding:'8px',fontSize:'12px',color:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}},
      refreshing ? React.createElement('div',{style:{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid var(--ac)',borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}) : '↓',
      refreshing ? 'Refreshing...' : pullDist>50 ? 'Release to refresh' : 'Pull to refresh'
    ) : null,
    // New message search
    showNew ? React.createElement('div',{style:{padding:'0 18px 10px',borderBottom:'1px solid var(--border)'}},
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'8px 12px',display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}},
        React.createElement('span',{style:{color:'var(--t3)',fontSize:'14px'}},'🔍'),
        React.createElement('input',{autoFocus:true,placeholder:'Search people...',value:search,onChange:function(e){setSearch(e.target.value);},style:{flex:1,background:'none',border:'none',outline:'none',fontSize:'13px',color:'var(--text)',fontFamily:'DM Sans,sans-serif'}})
      ),
      searchRes.map(function(u,i){
        return React.createElement('div',{key:i,onClick:function(){startConvo(u);},style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px',borderRadius:'10px',cursor:'pointer',background:'var(--bg3)',marginBottom:'6px'}},
          React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0,position:'relative'}},
            u.avatar_url ? React.createElement('img',{src:u.avatar_url,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (u.full_name||u.email||'?').substring(0,2).toUpperCase(),
            u.is_online ? React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'10px',height:'10px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)'}}) : null
          ),
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},(u.full_name||u.email||'').split('@')[0]),
            React.createElement('div',{style:{fontSize:'11px',color:u.is_online?'var(--green)':'var(--t2)'}},u.is_online?'Online':'Member')
          )
        );
      })
    ) : null,
    // Conversations
    React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'0 16px'}},
      // Real user conversations
      userConvos.length>0 ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'People'),
        userConvos.map(function(c){
          return React.createElement('div',{key:c.id,onClick:function(){
            setActive(c);
            setUserConvos(function(prev){return prev.map(function(p){return p.id===c.id?Object.assign({},p,{unreadCount:0}):p;});});
            setTotalUnread(function(t){return Math.max(0,t-(c.unreadCount||0));});
          },style:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
            React.createElement('div',{style:{position:'relative',flexShrink:0}},
              React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',overflow:'hidden'}},
                c.img ? React.createElement('img',{src:c.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : c.initials
              ),
              c.isOnline ? React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'11px',height:'11px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)'}}) : null
            ),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'2px'}},
                React.createElement('span',{style:{fontSize:'13px',fontWeight:c.unreadCount>0?700:600,color:'var(--text)'}},c.name),
                React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.lastTime?timeAgo(c.lastTime):'')
              ),
              React.createElement('div',{style:{fontSize:'11px',color:c.unreadCount>0?'var(--text)':'var(--t3)',fontWeight:c.unreadCount>0?600:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},c.lastMsg||'Start a conversation')
            ),
            c.unreadCount>0 ? React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff',flexShrink:0}},c.unreadCount>9?'9+':c.unreadCount) : null
          );
        })
      ) : null,
      // Expert conversations
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Experts'),
      expertConvos.map(function(c){
        return React.createElement('div',{key:c.id,onClick:function(){setActive(c);},style:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
          React.createElement('div',{style:{position:'relative',flexShrink:0}},
            React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:c.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',overflow:'hidden'}},
              c.img ? React.createElement('img',{src:c.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : c.initials
            ),
            React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'11px',height:'11px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)'}})
          ),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'2px'}},
              React.createElement('span',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},c.name),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.time)
            ),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:'2px'}},c.last||'Tap to start chatting')
          ),
          c.unread>0 ? React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff',flexShrink:0}},c.unread) : null
        );
      })
    )
  );
}
