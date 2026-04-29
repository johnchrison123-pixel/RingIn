/* eslint-disable */
import React,{useState,useEffect} from 'react';
export default function CallScreen({expert,coins,onCoinsChange,onEnd}){
  var s=useState(0),secs=s[0],setSecs=s[1];
  var lc=useState(coins),localCoins=lc[0],setLocalCoins=lc[1];
  var en=useState(false),ended=en[0],setEnded=en[1];
  useEffect(function(){
    if(ended) return;
    var iv=setInterval(function(){
      setSecs(function(prev){
        var ns=prev+1;
        if(ns%60===0){
          setLocalCoins(function(c){
            var nc=Math.max(0,c-expert.rate);
            onCoinsChange(nc);
            if(nc<=0){clearInterval(iv);setEnded(true);}
            return nc;
          });
        }
        return ns;
      });
    },1000);
    return function(){clearInterval(iv);};
  },[ended]);
  function fmt(s){var m=Math.floor(s/60);var ss=s%60;return m+':'+(ss<10?'0':'')+ss;}
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'var(--bg)',padding:'24px'}},
    React.createElement('div',{style:{width:'90px',height:'90px',borderRadius:'50%',background:expert.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:700,color:'#fff',marginBottom:'16px'}},expert.initials),
    React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},expert.name),
    React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',marginBottom:'24px'}},expert.role),
    ended
      ? React.createElement('div',{style:{fontSize:'14px',color:'red',marginBottom:'24px'}},'Call ended - no coins')
      : React.createElement('div',{style:{fontSize:'36px',fontWeight:800,color:'var(--text)',marginBottom:'8px'}},fmt(secs)),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--amber)',marginBottom:'32px'}},localCoins+' coins remaining'),
    React.createElement('button',{onClick:function(){setEnded(true);setTimeout(onEnd,300);},style:{width:'60px',height:'60px',borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}},'X')
  );
}
