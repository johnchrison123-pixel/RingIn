/* eslint-disable */
import React,{useState,useEffect} from 'react';
export default function CallScreen({expert, coins, onCoinsChange, onEnd}){
  var ringS=useState(true); var ringing=ringS[0]; var setRinging=ringS[1];
  var decS=useState(false); var declined=decS[0]; var setDeclined=decS[1];
  var secsS=useState(0); var secs=secsS[0]; var setSecs=secsS[1];
  var endedS=useState(false); var ended=endedS[0]; var setEnded=endedS[1];
  var localCoinsS=useState(coins); var localCoins=localCoinsS[0]; var setLocalCoins=localCoinsS[1];
  var ringSecsS=useState(0); var ringSecs=ringSecsS[0]; var setRingSecs=ringSecsS[1];

  // Ringing timer - auto answer after 5 seconds
  useEffect(function(){
    if(!ringing) return;
    var iv=setInterval(function(){
      setRingSecs(function(s){
        if(s>=4){clearInterval(iv);setRinging(false);return 0;}
        return s+1;
      });
    },1000);
    return function(){clearInterval(iv);};
  },[ringing]);

  // Call timer after connected
  useEffect(function(){
    if(ringing||ended) return;
    var iv=setInterval(function(){
      setSecs(function(s){return s+1;});
      setLocalCoins(function(c){
        var nc=c-1;
        if(onCoinsChange) onCoinsChange(nc);
        if(nc<=0){clearInterval(iv);setEnded(true);}
        return nc;
      });
    },1000);
    return function(){clearInterval(iv);};
  },[ringing,ended]);

  function fmt(s){var m=Math.floor(s/60);var ss=s%60;return m+':'+(ss<10?'0':'')+ss;}

  // Declined screen
  if(declined) return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
    React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',marginBottom:'16px'}},
      expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : expert.initials
    ),
    React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}},expert.name),
    React.createElement('div',{style:{fontSize:'14px',color:'#ef4444',marginBottom:'32px'}},'Call Declined'),
    React.createElement('button',{onClick:onEnd,style:{padding:'12px 32px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}},'Back')
  );

  // Ringing screen
  if(ringing) return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
    React.createElement('div',{style:{position:'relative',marginBottom:'24px'}},
      React.createElement('div',{style:{position:'absolute',width:'120px',height:'120px',borderRadius:'50%',background:'rgba(123,110,255,0.15)',top:'-15px',left:'-15px',animation:'ripple 1.2s ease-out infinite'}}),
      React.createElement('div',{style:{position:'absolute',width:'140px',height:'140px',borderRadius:'50%',background:'rgba(123,110,255,0.08)',top:'-25px',left:'-25px',animation:'ripple 1.2s ease-out infinite 0.4s'}}),
      React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',position:'relative',zIndex:1}},
        expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : expert.initials
      )
    ),
    React.createElement('style',null,'@keyframes ripple{0%{transform:scale(0.8);opacity:1}100%{transform:scale(1.4);opacity:0}}'),
    React.createElement('div',{style:{fontSize:'20px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}),
    React.createElement('div',{style:{fontSize:'20px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},expert.name),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'8px'}},expert.role),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t3)',marginBottom:'40px',display:'flex',alignItems:'center',gap:'6px'}},
      React.createElement('span',null,'Calling'),
      React.createElement('span',{style:{letterSpacing:'2px',animation:'dots 1.5s infinite'}},['.','..',  '...'][ringSecs%3])
    ),
    React.createElement('style',null,'@keyframes dots{0%,100%{opacity:1}50%{opacity:0.3}}'),
    React.createElement('button',{
      onClick:function(){setDeclined(true);},
      style:{width:'64px',height:'64px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'24px',cursor:'pointer',boxShadow:'0 4px 20px rgba(239,68,68,0.4)'}
    },'📵')
  );

  // Active call screen
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
    React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',marginBottom:'12px'}},
      expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : expert.initials
    ),
    React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},expert.name),
    React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',marginBottom:'6px'}},expert.role),
    React.createElement('div',{style:{fontSize:'12px',color:'var(--green)',marginBottom:'20px',display:'flex',alignItems:'center',gap:'5px'}},
      React.createElement('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}),
      'Connected'
    ),
    ended
      ? React.createElement('div',{style:{fontSize:'14px',color:'#ef4444',marginBottom:'24px'}},'Call ended - no coins')
      : React.createElement('div',{style:{fontSize:'42px',fontWeight:800,color:'var(--text)',marginBottom:'8px'}},fmt(secs)),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--amber)',marginBottom:'40px'}},localCoins+' coins remaining'),
    React.createElement('div',{style:{display:'flex',gap:'20px'}},
      React.createElement('button',{style:{width:'52px',height:'52px',borderRadius:'50%',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'20px',cursor:'pointer'}},'🔇'),
      React.createElement('button',{onClick:function(){setEnded(true);setTimeout(onEnd,500);},style:{width:'64px',height:'64px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer',boxShadow:'0 4px 20px rgba(239,68,68,0.4)'}},'📵'),
      React.createElement('button',{style:{width:'52px',height:'52px',borderRadius:'50%',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'20px',cursor:'pointer'}},'🔊')
    )
  );
}