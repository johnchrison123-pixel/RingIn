/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {createClient} from '@supabase/supabase-js';
var sb=createClient(process.env.REACT_APP_SUPABASE_URL,process.env.REACT_APP_SUPABASE_ANON_KEY);

var EXPERT_CONVOS=[
  {id:'e1',initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',last:'Thank you for your question!',time:'2m ago',unread:2,img:'https://i.pravatar.cc/150?img=47',rate:120},
  {id:'e2',initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',last:'I will send you the resources.',time:'1h ago',unread:0,img:'https://i.pravatar.cc/150?img=12',rate:80},
  {id:'e3',initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',last:'Great progress! Keep it up.',time:'Yesterday',unread:1,img:'https://i.pravatar.cc/150?img=23',rate:60},
  {id:'e4',initials:'JO',name:'James Okafor',role:'Corporate Lawyer',color:'linear-gradient(135deg,#B8860B,#F5A623)',last:'The contract looks good.',time:'2 days ago',unread:0,img:'https://i.pravatar.cc/150?img=33',rate:150},
];

function ChatBox({convo,session,onBack,onViewExpert,onCall}){
  var mS=useState([]); var msgs=mS[0]; var setMsgs=mS[1];
  var tS=useState(''); var txt=tS[0]; var setTxt=tS[1];
  var bottomRef=useRef(null);
  var myId = session&&session.user ? session.user.id : 'guest';
  var convId = convo.convId || convo.id;

  useEffect(function(){
    sb.from('messages').select('*').eq('conversation_id',convId).order('created_at').then(function(r){if(r.data)setMsgs(r.data);});
    var ch=sb.channel('ch-'+convId).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+convId},function(p){setMsgs(function(prev){return prev.concat([p.new]);});}).subscribe();
    return function(){sb.removeChannel(ch);};
  },[convId]);

  useEffect(function(){bottomRef.current&&bottomRef.current.scrollIntoView({behavior:'smooth'});},[msgs]);

  function send(){
    if(!txt.trim()) return;
    var senderName = session&&session.user ? session.user.email.split('@')[0] : 'You';
    var m={conversation_id:convId,sender_id:myId,sender_name:senderName,text:txt.trim()};
    setMsgs(function(prev){return prev.concat([Object.assign({},m,{id:Date.now()})]);});
    setTxt('');
    sb.from('messages').insert([m]).then(function(r){if(r.error)console.error(r.error);});
  }

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},
    // Header
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:onBack,style:{background:'none',border:'none',color:'var(--ac)',fontSize:'20px',cursor:'pointer'}},'<'),
      React.createElement('div',{style:{width:'38px',height:'38px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',overflow:'hidden',flexShrink:0}},
        convo.img ? React.createElement('img',{src:convo.img,alt:convo.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (convo.initials||(convo.name||'?').substring(0,2).toUpperCase())
      ),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'var(--text)',cursor:'pointer'},onClick:function(){if(onViewExpert&&convo.rate)onViewExpert(convo);}},convo.name),
        React.createElement('div',{style:{fontSize:'10px',color:'var(--green)',display:'flex',alignItems:'center',gap:'3px'}},
          React.createElement('span',{style:{width:'5px',height:'5px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}),
          convo.role||'Member'
        )
      ),
      convo.rate ? React.createElement('button',{onClick:function(){if(onCall)onCall(convo);},style:{padding:'6px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Call') : null
    ),
    // Messages
    React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}},
      msgs.length===0 && React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',marginTop:'40px'}},'No messages yet. Say hi! 👋'),
      msgs.map(function(m){
        var isMe = m.sender_id===myId;
        return React.createElement('div',{key:m.id,style:{display:'flex',justifyContent:isMe?'flex-end':'flex-start',alignItems:'flex-end',gap:'6px'}},
          !isMe ? React.createElement('div',{style:{width:'24px',height:'24px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}},
            convo.img ? React.createElement('img',{src:convo.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (convo.initials||'?')
          ) : null,
          React.createElement('div',{style:{maxWidth:'72%',padding:'9px 13px',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',background:isMe?'var(--ac)':'var(--bg3)',border:isMe?'none':'1px solid var(--border)',fontSize:'13px',color:isMe?'#fff':'var(--text)',lineHeight:1.4}},m.text)
        );
      }),
      React.createElement('div',{ref:bottomRef})
    ),
    // Input
    React.createElement('div',{style:{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0,alignItems:'center'}},
      React.createElement('input',{value:txt,onChange:function(e){setTxt(e.target.value);},onKeyDown:function(e){if(e.key==='Enter')send();},placeholder:'Type a message...',style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'22px',padding:'10px 16px',fontSize:'14px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}}),
      React.createElement('button',{onClick:send,disabled:!txt.trim(),style:{width:'40px',height:'40px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'18px',cursor:'pointer',flexShrink:0,opacity:txt.trim()?1:0.4,display:'flex',alignItems:'center',justifyContent:'center'}},'↑')
    )
  );
}

export default function MessagesScreen(props){
  var session = props.session;
  var activeS=useState(props.initConvo||null); var active=activeS[0]; var setActive=activeS[1];
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var coinsS=useState(50); var coins=coinsS[0]; var setCoins=coinsS[1];
  var searchS=useState(''); var search=searchS[0]; var setSearch=searchS[1];
  var usersS=useState([]); var users=usersS[0]; var setUsers=usersS[1];
  var searchResS=useState([]); var searchRes=searchResS[0]; var setSearchRes=searchResS[1];
  var showNewS=useState(false); var showNew=showNewS[0]; var setShowNew=showNewS[1];

  useEffect(function(){
    if(!search.trim()){setSearchRes([]);return;}
    sb.from('profiles').select('*').or('email.ilike.%'+search+'%,full_name.ilike.%'+search+'%').then(function(res){
      setSearchRes(res.data||[]);
    });
  },[search]);

  function startConvo(user){
    var myId = session&&session.user ? session.user.id : null;
    if(!myId) return;
    var convId = [myId,user.id].sort().join('_');
    var convo = {
      id: convId,
      convId: convId,
      name: user.full_name||user.email.split('@')[0],
      role: 'RingIn Member',
      color: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
      img: user.avatar_url||null,
      initials: (user.full_name||user.email||'?').substring(0,2).toUpperCase(),
    };
    setShowNew(false);
    setSearch('');
    setActive(convo);
  }

  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coins,onCoinsChange:setCoins,onEnd:function(){setActiveCall(null);}});
  if(active) return React.createElement(ChatBox,{convo:active,session:session,onBack:function(){setActive(null);},onViewExpert:props.onViewExpert,onCall:function(exp){setActiveCall(exp);}});

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},
    // Header
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px'}},
      React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Messages'),
      React.createElement('button',{onClick:function(){setShowNew(!showNew);},style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+')
    ),
    // New message search
    showNew ? React.createElement('div',{style:{padding:'0 18px 10px',borderBottom:'1px solid var(--border)'}},
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'8px 12px',display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}},
        React.createElement('span',{style:{color:'var(--t3)',fontSize:'14px'}},'🔍'),
        React.createElement('input',{
          autoFocus:true,
          placeholder:'Search people to message...',
          value:search,
          onChange:function(e){setSearch(e.target.value);},
          style:{flex:1,background:'none',border:'none',outline:'none',fontSize:'13px',color:'var(--text)',fontFamily:'DM Sans,sans-serif'}
        })
      ),
      searchRes.length>0 ? React.createElement('div',null,
        searchRes.map(function(u,i){
          var myId = session&&session.user ? session.user.id : null;
          if(u.id===myId) return null;
          return React.createElement('div',{key:i,onClick:function(){startConvo(u);},style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px',borderRadius:'10px',cursor:'pointer',background:'var(--bg3)',marginBottom:'6px'}},
            React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0}},
              u.avatar_url ? React.createElement('img',{src:u.avatar_url,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (u.full_name||u.email||'?').substring(0,2).toUpperCase()
            ),
            React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},(u.full_name||u.email||'').split('@')[0]),
              React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'RingIn Member')
            )
          );
        })
      ) : search.trim() ? React.createElement('div',{style:{textAlign:'center',padding:'16px',color:'var(--t2)',fontSize:'13px'}},'No users found') : null
    ) : null,
    // Conversations list
    React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'0 16px'}},
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Experts'),
      EXPERT_CONVOS.map(function(c){
        return React.createElement('div',{key:c.id,onClick:function(){setActive(c);},style:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
          React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:c.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden',position:'relative'}},
            c.img ? React.createElement('img',{src:c.img,alt:c.name,style:{width:'100%',height:'100%',objectFit:'cover',position:'absolute',top:0,left:0}}) : c.initials,
            React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'10px',height:'10px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)'}})
          ),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'2px'}},
              React.createElement('span',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}}),c.name,
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}}),c.time
            ),
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)',marginBottom:'2px'}},c.role),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},c.last)
          ),
          c.unread>0 ? React.createElement('div',{style:{width:'18px',height:'18px',borderRadius:'50%',background:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0}},c.unread) : null
        );
      })
    )
  );
}
