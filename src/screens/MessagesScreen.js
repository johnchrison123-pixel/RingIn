/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {createClient} from '@supabase/supabase-js';
var sb=createClient(process.env.REACT_APP_SUPABASE_URL,process.env.REACT_APP_SUPABASE_ANON_KEY);

var EXPERT_CONVOS=[
  {id:'e1',initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',last:'Thank you for your question!',time:'2m ago',unread:2,img:'https://i.pravatar.cc/150?img=47',rate:120},
  {id:'e2',initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',last:'I will send you the resources.',time:'1h ago',unread:0,img:'https://i.pravatar.cc/150?img=12',rate:80},
  {id:'e3',initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',last:'Great progress! Keep it up.',time:'Yesterday',unread:1,img:'https://i.pravatar.cc/150?img=23',rate:60},
];

function ChatBox({convo,session,onBack,onViewExpert,onCall,onMessageSent}){
  var mS=useState([]); var msgs=mS[0]; var setMsgs=mS[1];
  var tS=useState(''); var txt=tS[0]; var setTxt=tS[1];
  var bottomRef=useRef(null);
  var myId = session&&session.user ? session.user.id : 'guest';
  var myName = session&&session.user ? session.user.email.split('@')[0] : 'You';
  var convId = convo.convId || convo.id;

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

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:onBack,style:{background:'none',border:'none',color:'var(--ac)',fontSize:'20px',cursor:'pointer'}},'<'),
      React.createElement('div',{style:{width:'38px',height:'38px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',overflow:'hidden',flexShrink:0}},
        convo.img ? React.createElement('img',{src:convo.img,alt:convo.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (convo.initials||(convo.name||'?').substring(0,2).toUpperCase())
      ),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'var(--text)'}},convo.name),
        convo.isOnline ? React.createElement('div',{style:{fontSize:'10px',color:'var(--green)',display:'flex',alignItems:'center',gap:'3px'}},
          React.createElement('span',{style:{width:'5px',height:'5px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}), 'Online'
        ) : React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},convo.role||'Member')
      ),
      convo.rate ? React.createElement('button',{onClick:function(){if(onCall)onCall(convo);},style:{padding:'6px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Call') : null
    ),
    React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}},
      msgs.length===0 && React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',marginTop:'40px'}},'No messages yet. Say hi! 👋'),
      msgs.map(function(m){
        var isMe = m.sender_id===myId;
        return React.createElement('div',{key:m.id,style:{display:'flex',justifyContent:isMe?'flex-end':'flex-start',alignItems:'flex-end',gap:'6px'}},
          !isMe ? React.createElement('div',{style:{width:'26px',height:'26px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}},
            convo.img ? React.createElement('img',{src:convo.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (convo.initials||'?')
          ) : null,
          React.createElement('div',null,
            React.createElement('div',{style:{maxWidth:'260px',padding:'9px 13px',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',background:isMe?'var(--ac)':'var(--bg3)',border:isMe?'none':'1px solid var(--border)',fontSize:'13px',color:isMe?'#fff':'var(--text)',lineHeight:1.4}},m.text),
            isMe ? React.createElement('div',{style:{fontSize:'9px',color:'var(--t3)',textAlign:'right',marginTop:'2px'}}, m.read?'✓✓ Seen':'✓ Sent') : null
          )
        );
      }),
      React.createElement('div',{ref:bottomRef})
    ),
    React.createElement('div',{style:{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0,alignItems:'center'}},
      React.createElement('input',{value:txt,onChange:function(e){setTxt(e.target.value);},onKeyDown:function(e){if(e.key==='Enter')send();},placeholder:'Type a message...',style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'22px',padding:'10px 16px',fontSize:'14px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}}),
      React.createElement('button',{onClick:send,disabled:!txt.trim(),style:{width:'40px',height:'40px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'18px',cursor:'pointer',flexShrink:0,opacity:txt.trim()?1:0.4,display:'flex',alignItems:'center',justifyContent:'center'}},'↑')
    )
  );
}

export default function MessagesScreen(props){
  var session = props.session;
  var myId = session&&session.user ? session.user.id : null;
  var activeS=useState(props.initConvo||null); var active=activeS[0]; var setActive=activeS[1];
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var coinsS=useState(50); var coins=coinsS[0]; var setCoins=coinsS[1];
  var searchS=useState(''); var search=searchS[0]; var setSearch=searchS[1];
  var searchResS=useState([]); var searchRes=searchResS[0]; var setSearchRes=searchResS[1];
  var showNewS=useState(false); var showNew=showNewS[0]; var setShowNew=showNewS[1];
  var userConvosS=useState([]); var userConvos=userConvosS[0]; var setUserConvos=userConvosS[1];
  var unreadS=useState({}); var unread=unreadS[0]; var setUnread=unreadS[1];
  var totalUnreadS=useState(0); var totalUnread=totalUnreadS[0]; var setTotalUnread=totalUnreadS[1];

  // Load real user conversations
  useEffect(function(){
    if(!myId) return;
    // Get all messages where I am sender or receiver
    sb.from('messages').select('*').or('sender_id.eq.'+myId+',receiver_id.eq.'+myId).order('created_at',{ascending:false}).then(function(res){
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
            otherName: m.sender_id===myId ? m.receiver_id : m.sender_name,
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

  function handleMessageSent(convo, text){
    setUserConvos(function(prev){
      var exists = prev.find(function(c){return c.convId===convo.convId;});
      if(exists){
        return prev.map(function(c){
          if(c.convId!==convo.convId) return c;
          return Object.assign({},c,{lastMsg:text});
        });
      }
      return [Object.assign({},convo,{lastMsg:text,unreadCount:0})].concat(prev);
    });
  }

  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coins,onCoinsChange:setCoins,onEnd:function(){setActiveCall(null);}});
  if(active) return React.createElement(ChatBox,{convo:active,session:session,onBack:function(){setActive(null);},onViewExpert:props.onViewExpert,onCall:function(exp){setActiveCall(exp);},onMessageSent:handleMessageSent});

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},
    // Header
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px'}},
        React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Messages'),
        totalUnread>0 ? React.createElement('div',{style:{width:'18px',height:'18px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},totalUnread>9?'9+':totalUnread) : null
      ),
      React.createElement('button',{onClick:function(){setShowNew(!showNew);},style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+')
    ),
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
                React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.lastTime?new Date(c.lastTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'')
              ),
              React.createElement('div',{style:{fontSize:'11px',color:c.unreadCount>0?'var(--text)':'var(--t3)',fontWeight:c.unreadCount>0?600:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},c.lastMsg||'Start a conversation')
            ),
            c.unreadCount>0 ? React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff',flexShrink:0}},c.unreadCount>9?'9+':c.unreadCount) : null
          );
        })
      ) : null,
      // Expert conversations
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Experts'),
      EXPERT_CONVOS.map(function(c){
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
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)',marginBottom:'2px'}},c.role),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},c.last)
          ),
          c.unread>0 ? React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff',flexShrink:0}},c.unread) : null
        );
      })
    )
  );
}
