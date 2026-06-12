/* eslint-disable */
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { motion, useMotionValue, useSpring, useVelocity, useTransform } from 'motion/react';
import { hapticTap } from '../utils/haptics';

/* FrostyFluidGlassNav — Frosty Fluid Glass floating tab bar.
 *
 * A translucent glass droplet rests on the active tab and FOLLOWS the
 * finger / cursor as it moves across the bar, deforming like water (it
 * stretches in the direction of travel via velocity-driven scaleX/scaleY),
 * then springs to settle on whichever tab you land on.
 *
 * Props:
 *   tabs:        [{id, label, svg}]
 *   activeTab:   string
 *   unreadMsg:   number (badge on the messages tab)
 *   onSelectTab: (tabId) => void   — host does the real navigation
 *   onOrb:       () => void        — center anonymous-connect orb
 *   connectActive: boolean         — orb is the active surface
 */
var BLOB_W = 60; // fixed droplet width keeps centering cheap + motion smooth

function FrostyFluidGlassNav(props){
  var tabs = props.tabs || [];
  var activeTab = props.activeTab;
  var unreadMsg = props.unreadMsg || 0;

  var navRef = useRef(null);
  // Dedup so a tap (which fires BOTH pointerup-select and the click fallback)
  // doesn't double-select / double-haptic.
  var lastSelRef = useRef({ id: null, t: 0 });
  // draggingRef is SYNCHRONOUS — React state updates lag behind fast touch
  // gestures, so the pointerup handler would read a stale `dragging=false`
  // and skip release-to-select. The ref is the source of truth for logic;
  // the `dragging` state only drives the droplet's visibility.
  var draggingRef = useRef(false);
  var snapTabRef = useRef(null); // tab the droplet is magnetically snapped to mid-drag
  var draggingS = useState(false); var dragging = draggingS[0]; var setDragging = draggingS[1];
  var hoverS = useState(false); var hovering = hoverS[0]; var setHovering = hoverS[1];

  // Droplet horizontal CENTER (px, relative to the nav's padding box).
  var blobX = useMotionValue(0);
  // Springy + slightly under-damped so the magnetic snap between tabs has a
  // visible elastic pull (it overshoots a touch, then settles).
  var xSpring = useSpring(blobX, { stiffness: 300, damping: 19, mass: 1 });
  // Left edge = center - half width (kept on the compositor via transform).
  var xLeft = useTransform(xSpring, function(v){ return v - BLOB_W / 2; });
  // Velocity -> fluid stretch: the droplet elongates as it's pulled toward
  // the tab it's attracted to, then rounds out once it sticks. The stronger
  // range makes the "magnet" stretch clearly visible.
  var xVel = useVelocity(xSpring);
  var scaleX = useTransform(xVel, [-2800, 0, 2800], [1.85, 1, 1.85]);
  var scaleY = useTransform(xVel, [-2800, 0, 2800], [0.46, 1, 0.46]);
  // Lead the stretch toward the direction of travel (origin trails behind),
  // so the droplet visibly reaches toward the nav it's snapping to.
  var originX = useTransform(xVel, function(v){
    if(v > 80) return '12%';      // moving right -> stretch leads rightward
    if(v < -80) return '88%';     // moving left  -> stretch leads leftward
    return '50%';
  });

  var activeIsTab = tabs.some(function(t){ return t.id === activeTab; });
  var showBlob = activeIsTab || dragging || hovering;

  function tabCenter(tabId){
    var nav = navRef.current; if(!nav) return null;
    var btn = nav.querySelector('[data-navtab="'+tabId+'"]');
    if(!btn) return null;
    return btn.offsetLeft + btn.offsetWidth / 2;
  }
  function settleToActive(){
    var c = tabCenter(activeTab);
    if(c != null) blobX.set(c);
  }
  // Settle on mount, when the active tab changes, and on resize.
  useLayoutEffect(function(){ settleToActive(); }, [activeTab, tabs.length]);
  useEffect(function(){
    function onResize(){ settleToActive(); }
    window.addEventListener('resize', onResize);
    return function(){ window.removeEventListener('resize', onResize); };
  }, [activeTab]);

  function follow(clientX){
    var nav = navRef.current; if(!nav) return;
    var rect = nav.getBoundingClientRect();
    var x = clientX - rect.left;
    // MAGNETIC SNAP: pull the droplet to the CENTER of the nearest tab, so it
    // sticks to whichever nav it's closest to as it glides (it never floats
    // free between tabs). The spring + velocity stretch make it reach/pull
    // toward each tab it snaps onto.
    var btns = nav.querySelectorAll('[data-navtab]');
    var bestC = null, bestId = null, bestD = Infinity;
    for(var i=0;i<btns.length;i++){
      var c = btns[i].offsetLeft + btns[i].offsetWidth/2;
      var d = Math.abs(c - x);
      if(d < bestD){ bestD = d; bestC = c; bestId = btns[i].getAttribute('data-navtab'); }
    }
    if(bestC != null){ blobX.set(bestC); snapTabRef.current = bestId; }
  }
  function onPointerMove(e){
    if(e.pointerType === 'mouse' && !draggingRef.current){ setHovering(true); follow(e.clientX); }
    else if(draggingRef.current){ follow(e.clientX); }
  }
  function onPointerDown(e){ draggingRef.current = true; setDragging(true); follow(e.clientX); }

  // Which nav element is under a screen point (walks up from svg/span children).
  function targetUnderPoint(x, y){
    try {
      var el = document.elementFromPoint(x, y);
      while(el && el !== document.body){
        if(el.getAttribute){
          var t = el.getAttribute('data-navtab');
          if(t) return t;
          if(el.getAttribute('data-orb') === '1') return '__orb__';
        }
        el = el.parentElement;
      }
    } catch(_){}
    return null;
  }
  // Release-to-select (iOS-26): wherever you lift your finger becomes the
  // selected surface — so dragging the droplet to Experts and letting go
  // sticks it there instead of springing back to the active tab.
  function onPointerUp(e){
    if(draggingRef.current){
      draggingRef.current = false; setDragging(false);
      var over = targetUnderPoint(e.clientX, e.clientY);
      if(over === '__orb__'){ snapTabRef.current = null; tapOrb(); return; }
      // Commit to the tab the droplet magnetically stuck to (fallback: tab
      // under the release point).
      var pick = snapTabRef.current || over;
      snapTabRef.current = null;
      if(pick){ selectTab(pick); return; }
    }
    settleToActive();
  }
  function onPointerLeave(){ draggingRef.current = false; setHovering(false); setDragging(false); settleToActive(); }
  function onPointerCancel(){ draggingRef.current = false; setDragging(false); settleToActive(); }

  function selectTab(tabId){
    var now = Date.now();
    if(lastSelRef.current.id === tabId && (now - lastSelRef.current.t) < 500) return; // dedup tap's pointerup+click
    lastSelRef.current = { id: tabId, t: now };
    hapticTap();
    var c = tabCenter(tabId); if(c != null) blobX.set(c);
    if(props.onSelectTab) props.onSelectTab(tabId);
  }
  function tapOrb(){
    var now = Date.now();
    if(lastSelRef.current.id === '__orb__' && (now - lastSelRef.current.t) < 500) return;
    lastSelRef.current = { id: '__orb__', t: now };
    hapticTap();
    if(props.onOrb) props.onOrb();
  }

  function renderTab(tab){
    var isActive = activeTab === tab.id;
    return React.createElement(motion.button, {
      key: tab.id,
      'data-navtab': tab.id,
      whileTap: { scale: 0.9 },
      transition: { type: 'spring', stiffness: 420, damping: 24 },
      onClick: function(){ selectTab(tab.id); },
      style: {
        position:'relative', zIndex:1, flex:'0 0 auto', minWidth:'60px',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'3px', padding:'9px 14px', border:'none', background:'transparent',
        cursor:'pointer', color: isActive ? '#fff' : 'rgba(255,255,255,0.52)',
        WebkitTapHighlightColor:'transparent', outline:'none', WebkitTouchCallout:'none', userSelect:'none', WebkitUserSelect:'none',
      }
    },
      React.createElement('div', {style:{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center'}},
        React.createElement('svg', {viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor',strokeWidth:2},
          React.createElement('path', {d:tab.svg})
        ),
        (tab.id==='messages' && unreadMsg>0) ? React.createElement('div', {
          style:{position:'absolute',top:'-4px',right:'-6px',background:'#FF4757',borderRadius:'50%',
            minWidth:'16px',height:'16px',display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'9px',fontWeight:700,color:'#fff',padding:'0 3px'}
        }, unreadMsg>99 ? '99+' : String(unreadMsg)) : null
      ),
      React.createElement('span', {style:{fontSize:'9.5px',fontWeight:600,letterSpacing:'0.2px'}}, tab.label)
    );
  }

  var canBlur = (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) > 4);

  return React.createElement(motion.nav, {
    ref: navRef,
    onPointerMove: onPointerMove,
    onPointerDown: onPointerDown,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerCancel,
    onPointerLeave: onPointerLeave,
    style: {
      position:'fixed', left:'50%', right:'auto',
      bottom:'calc(14px + env(safe-area-inset-bottom, 0px))',
      transform:'translateX(-50%)',
      display:'flex', alignItems:'center', justifyContent:'center', gap:'2px',
      width:'auto', maxWidth:'calc(100% - 24px)', padding:'6px 8px',
      borderRadius:'30px',
      background: canBlur ? 'rgba(18, 20, 30, 0.55)' : 'rgba(18, 20, 30, 0.92)',
      backdropFilter: canBlur ? 'blur(22px) saturate(180%)' : 'none',
      WebkitBackdropFilter: canBlur ? 'blur(22px) saturate(180%)' : 'none',
      border:'1px solid rgba(255,255,255,0.10)',
      boxShadow:'0 12px 40px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)',
      zIndex:100, touchAction:'none',
    }
  },
    // ── The frosty-fluid-glass droplet ────────────────────────────────────────
    React.createElement(motion.div, {
      'aria-hidden': true,
      animate: { opacity: showBlob ? 1 : 0 },
      transition: { duration: 0.2 },
      style: {
        position:'absolute', top:'6px', left:0, height:'calc(100% - 12px)',
        width: BLOB_W + 'px', x: xLeft, scaleX: scaleX, scaleY: scaleY,
        transformOrigin: originX,
        borderRadius:'22px', pointerEvents:'none', zIndex:0,
        background:'linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08))',
        border:'1px solid rgba(255,255,255,0.30)',
        boxShadow:'inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(0,0,0,0.12), 0 4px 16px rgba(123,110,255,0.30)',
      }
    }),
    // ── Tabs + center orb (orb sits after 'friends', visual center) ─────
    tabs.map(function(tab){
      if(tab.id === 'friends'){
        var orb = React.createElement(motion.button, {
          key:'connect-orb',
          'data-orb':'1',
          whileHover:{ scale: 1.1, y: -2 },
          whileTap:{ scale: 0.9 },
          transition:{ type:'spring', stiffness:420, damping:20 },
          onClick: tapOrb,
          title:'Anonymous Connect',
          style:{
            position:'relative', zIndex:1, width:'46px', height:'46px', borderRadius:'50%',
            background:'linear-gradient(135deg,#7B6EFF,#E84D9A)', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, margin:'0 4px',
            /* remove the square light-blue tap highlight / focus outline on tap */
            WebkitTapHighlightColor:'transparent', outline:'none', WebkitTouchCallout:'none', userSelect:'none', WebkitUserSelect:'none',
            boxShadow: props.connectActive
              ? '0 0 0 3px rgba(123,110,255,0.45),0 6px 18px rgba(232,77,154,0.55)'
              : '0 4px 14px rgba(232,77,154,0.45)',
          }
        },
          React.createElement('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'#fff',strokeWidth:2.4},
            React.createElement('path',{d:'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z'})
          ),
          React.createElement('span',{style:{position:'absolute',top:'2px',right:'2px',width:'8px',height:'8px',borderRadius:'50%',background:'#27C96A',border:'2px solid #09090E'}})
        );
        return [renderTab(tab), orb];
      }
      return renderTab(tab);
    })
  );
}

export default FrostyFluidGlassNav;
export { FrostyFluidGlassNav };
