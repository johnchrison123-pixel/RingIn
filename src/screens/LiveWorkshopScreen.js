import React,{useState,useEffect,useRef} from 'react';
var SEED=[
  {id:1,author:'Host',text:'Welcome everyone!',isHost:true},
  {id:2,author:'Ahmed',text:'Excited for this!',isHost:false},
  {id:3,author:'Sara',text:'Will this be recorded?',isHost:false},
  {id:4,author:'Host',text:'Yes, available 48hrs after.',isHost:true},
];
export default function LiveWorkshopScreen({workshop,onLeave}){
  var m=useState(SEED),msgs=m[0],setMsgs=m[1];
  var t=useState(''),text=t[0],setText=t[1];
  var v=useState(workshop.viewers||500),viewers=v[0],setViewers=v[1];
  var bottomRef=useRef(null);
  useEffect(function(){
    var iv=setInterval(function(){setViewers(function(x){return x+Math.floor(Math.random()*3)-1;});},5000);
    return function(){clearInterval(iv);};
  },[]);
  useEffect(function(){bottomRef.current&&bottomRef.current.scrollIntoView({behavior:'smooth'});},[ msgs]);
  function send(){
    if(!text.trim()) return;
    setMsgs(function(prev){return prev.concat([{id:Date.now(),author:'You',text:text.trim(),isHost:false}]);});
    setText('');
  }
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'#0a0a0e'}},
    React.createElement('div',{style:{height:'200px',background:workshop.color,position:'relative',flexShrink:0}},
      React.createElement('div',{style:{position:'absolute',top:'12px',left:'12px',background:'#ef4444',borderRadius:'20px',padding:'3px 10px',fontSize:'10px',fontWeight:700,color:'#fff'}},'LIVE - '+viewers+' watching'),
      React.createElement('button',{onClick:onLeave,style:{position:'absolute',top:'12px',right:'12px',background:'rgba(0,0,0,.5)',border:'none',borderRadius:'20px',color:'#fff',padding:'5px 12px',cursor:'pointer',fontSize:'11px'}},'Leave'),
      React.createElement('div',{style:{position:'absolute',bottom:'12px',left:'12px'}},
        React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'#fff'}},workshop.title),
        React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,.7)'}},'by '+workshop.host)
      )
    ),
    React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'8px 14px',display:'flex',flexDirection:'column',gap:'6px'}},
      msgs.map(function(msg){
        return React.createElement('div',{key:msg.id,style:{display:'flex',gap:'8px'}},
          React.createElement('div',{style:{width:'22px',height:'22px',borderRadius:'50%',background:msg.isHost?'var(--ac)':'var(--bg3)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700,color:msg.isHost?'#fff':'var(--t2)',flexShrink:0}},msg.author[0]),
          React.createElement('div',null,
            React.createElement('span',{style:{fontSize:'10px',fontWeight:600,color:msg.isHost?'var(--ac)':'var(--text)',marginRight:'5px'}},msg.author+(msg.isHost?' [Host]':'')),
            React.createElement('span',{style:{fontSize:'11px',color:'var(--t2)'}},msg.text)
          )
        );
      }),
      React.createElement('div',{ref:bottomRef})
    ),
    React.createElement('div',{style:{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',background:'var(--bg)'}},
      React.createElement('input',{value:text,onChange:function(e){setText(e.target.value);},onKeyDown:function(e){if(e.key==='Enter')send();},placeholder:'Say something...',style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'9px 14px',fontSize:'12px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}}),
      React.createElement('button',{onClick:send,style:{width:'36px',height:'36px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'16px',cursor:'pointer',flexShrink:0}},'>') 
    )
  );
}
