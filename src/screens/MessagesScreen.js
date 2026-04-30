/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {createClient} from '@supabase/supabase-js';
var EXPERTS=[
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:2,rating:4.9,calls:842,followers:'2.1k',online:true,color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine.',tags:['General Medicine','Preventive Care']},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:1,rating:4.8,calls:631,followers:'1.4k',online:true,color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google alumni.',tags:['System Design','React']},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:1,rating:4.7,calls:412,followers:'3.2k',online:true,color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience.',tags:['Career Strategy','LinkedIn']},
  {id:4,initials:'JO',name:'James Okafor',role:'Corporate Lawyer',rate:2,rating:4.6,calls:310,followers:'1.1k',online:false,color:'linear-gradient(135deg,#B8860B,#F5A623)',cover:'linear-gradient(135deg,#1a0a00,#B8860B)',loc:'Dubai, UAE',bio:'10+ years in corporate law.',tags:['Corporate Law','Contracts']}
];
var sb=createClient(process.env.REACT_APP_SUPABASE_URL,process.env.REACT_APP_SUPABASE_ANON_KEY);
const CONVOS = [
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',last:'Thank you for your question!',time:'2m ago',unread:2},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',last:'I will send you the resources.',time:'1h ago',unread:0},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',last:'Great progress! Keep it up.',time:'Yesterday',unread:1},
  {id:4,initials:'JO',name:'James Okafor',role:'Corporate Lawyer',color:'linear-gradient(135deg,#B8860B,#F5A623)',last:'The contract looks good.',time:'2 days ago',unread:0},
];

function ChatBox({convo,onBack,onViewExpert}){
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var coinsS=useState(50); var coins=coinsS[0]; var setCoins=coinsS[1];
  var mS=useState([]); var msgs=mS[0]; var setMsgs=mS[1];
  var tS=useState(''); var txt=tS[0]; var setTxt=tS[1];
  var uid='user_'+convo.id;
  var bottomRef=useRef(null);
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coins,onCoinsChange:setCoins,onEnd:function(){setActiveCall(null);}});
  useEffect(function(){
    sb.from('messages').select('*').eq('conversation_id',convo.id).order('created_at').then(function(r){if(r.data)setMsgs(r.data);});
    var ch=sb.channel('ch-'+convo.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+convo.id},function(p){setMsgs(function(prev){return prev.concat([p.new]);});}).subscribe();
    return function(){sb.removeChannel(ch);};
  },[convo.id]);
  useEffect(function(){bottomRef.current&&bottomRef.current.scrollIntoView({behavior:'smooth'});},[msgs]);
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coins,onCoinsChange:setCoins,onEnd:function(){setActiveCall(null);}});
  function send(){
    if(!txt.trim()) return;
    var m={conversation_id:convo.id,sender_id:uid,sender_name:'You',text:txt.trim()};
    setMsgs(function(prev){return prev.concat([{id:Date.now(),sender_id:uid,text:txt.trim()}]);});
    setTxt('');
    sb.from('messages').insert([m]).then(function(r){if(r.error)console.error(r.error);});
  }
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:onBack,style:{background:'none',border:'none',color:'var(--ac)',fontSize:'20px',cursor:'pointer'}},'<'),
      React.createElement('div',{style:{width:'34px',height:'34px',borderRadius:'50%',background:convo.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:'#fff'}},convo.initials),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{onClick:function(){var exp=EXPERTS.find(function(e){return e.name===convo.name;})||convo;if(onViewExpert)onViewExpert(exp);},style:{fontSize:'13px',fontWeight:600,color:'var(--text)',cursor:'pointer'}},convo.name),
        React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},convo.role)
      ),
      React.createElement('button',{onClick:function(){var exp=EXPERTS.find(function(e){return e.name===convo.name;})||{...convo,rate:2,color:convo.color};setActiveCall(exp);},style:{padding:'5px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Call')
    ),
    React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px',scrollbarWidth:'thin',scrollbarColor:'#4a4a6a transparent',}},
      msgs.length===0&&React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',marginTop:'40px'}},'No messages yet. Say hi!'),
      msgs.map(function(m){
        var isMe=m.sender_id==='me'||m.sender_name==='You'||m.sender_id===uid;
        return React.createElement('div',{key:m.id,style:{display:'flex',justifyContent:isMe?'flex-end':'flex-start'}},
          React.createElement('div',{style:{maxWidth:'72%',padding:'8px 12px',borderRadius:isMe?'16px 16px 4px 16px':'16px 16px 16px 4px',background:isMe?'var(--ac)':'var(--bg3)',border:isMe?'none':'1px solid var(--border)',fontSize:'12px',color:isMe?'#fff':'var(--text)'}},m.text)
        );
      }),
      React.createElement('div',{ref:bottomRef})
    ),
    React.createElement('div',{style:{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0}},
      React.createElement('input',{value:txt,onChange:function(e){setTxt(e.target.value);},onKeyDown:function(e){if(e.key==='Enter')send();},placeholder:'Type a message...',style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'9px 14px',fontSize:'12px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}}),
      React.createElement('button',{onClick:send,disabled:!txt.trim(),style:{width:'36px',height:'36px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'16px',cursor:'pointer',flexShrink:0,opacity:txt.trim()?1:0.4}},'>') 
    )
  );
}

export default function MessagesScreen(props){
  var activeS=useState(null); var active=activeS[0]; var setActive=activeS[1];
  if(active) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},React.createElement(ChatBox,{convo:active,onBack:function(){setActive(null);},onViewExpert:props.onViewExpert}));
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"var(--bg)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px 7px"}}>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:"21px",fontWeight:800,background:"linear-gradient(135deg,#7B6EFF,#E84D9A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Messages</div>
        <div style={{display:"flex",alignItems:"center",gap:"5px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"20px",padding:"4px 10px",fontSize:"12px",color:"var(--text)"}}><div style={{width:"15px",height:"15px",borderRadius:"50%",background:"linear-gradient(135deg,#F5A623,#f97316)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px",color:"#fff",fontWeight:700}}>C</div><span>1,240</span></div>
      </div>
      <div style={{padding:"0 16px",overflowY:"auto",flex:1}}>
        {CONVOS.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:"11px",padding:"11px 0",borderBottom:"1px solid var(--border)",cursor:"pointer"}} onClick={()=>setActive(c)}>
            <div style={{width:"42px",height:"42px",borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:700,color:"#fff",flexShrink:0}}>{c.initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}>
                <span style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{c.name}</span>
                <span style={{fontSize:"10px",color:"var(--t3)"}}>{c.time}</span>
              </div>
              <div style={{fontSize:"10px",color:"var(--t2)",marginBottom:"2px"}}>{c.role}</div>
              <div style={{fontSize:"11px",color:"var(--t3)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.last}</div>
            </div>
            {c.unread>0&&<div style={{width:"18px",height:"18px",borderRadius:"50%",background:"var(--ac)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:700,color:"#fff",flexShrink:0}}>{c.unread}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
