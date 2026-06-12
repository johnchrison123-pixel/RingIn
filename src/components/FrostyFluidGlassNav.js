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

  // Droplet geometry as motion values — center X + width/height/radius — so the
  // droplet can MORPH to each target's shape: a wide capsule on the tabs, a
  // circle on the round connect orb.
  var blobX = useMotionValue(0);
  var blobW = useMotionValue(BLOB_W);
  var blobH = useMotionValue(44);
  var blobR = useMotionValue(22);
  // SOFT + SMOOTH glide: low stiffness = unhurried travel, high damping = no
  // harsh bounce/overshoot. The droplet eases between tabs instead of snapping.
  var xSpring = useSpring(blobX, { stiffness: 170, damping: 30, mass: 1.1 });
  var wSpring = useSpring(blobW, { stiffness: 210, damping: 32 });
  var hSpring = useSpring(blobH, { stiffness: 210, damping: 32 });
  var rSpring = useSpring(blobR, { stiffness: 210, damping: 32 });
  // Left edge = center - half (current) width; top offset = -half height (so
  // top:50% + this y keeps it vertically centered as the height morphs).
  var xLeft = useTransform([xSpring, wSpring], function(v){ return v[0] - v[1] / 2; });
  var yTop  = useTransform(hSpring, function(h){ return -h / 2; });
  // Velocity -> gentle fluid stretch: a soft elongation as it glides, rounding
  // out once it settles. Kept subtle so it reads as "fluid", not rubber-band.
  var xVel = useVelocity(xSpring);
  var scaleX = useTransform(xVel, [-2200, 0, 2200], [1.28, 1, 1.28]);
  var scaleY = useTransform(xVel, [-2200, 0, 2200], [0.74, 1, 0.74]);
  // Lead the stretch slightly toward the direction of travel.
  var originX = useTransform(xVel, function(v){
    if(v > 120) return '28%';     // moving right -> stretch leads rightward
    if(v < -120) return '72%';    // moving left  -> stretch leads leftward
    return '50%';
  });

  var activeIsTab = tabs.some(function(t){ return t.id === activeTab; });
  var showBlob = activeIsTab || props.connectActive || dragging || hovering;

  // Read a target's geometry: tab = capsule (inset from the button box); orb =
  // a circle slightly larger than the orb so the frosty glass frames it, the
  // same way the capsule frames a tab icon.
  function geomOf(el){
    if(!el) return null;
    var center = el.offsetLeft + el.offsetWidth / 2;
    if(el.getAttribute('data-orb') === '1'){
      var dia = el.offsetHeight + 12;
      return { id: '__orb__', center: center, w: dia, h: dia, r: dia / 2 };
    }
    return { id: el.getAttribute('data-navtab'), center: center, w: el.offsetWidth - 6, h: el.offsetHeight - 8, r: 20 };
  }
  function applyGeom(g){
    if(!g) return;
    blobX.set(g.center); blobW.set(g.w); blobH.set(g.h); blobR.set(g.r);
    snapTabRef.current = g.id;
  }
  function settleToActive(){
    var nav = navRef.current; if(!nav) return;
    var el = props.connectActive
      ? nav.querySelector('[data-orb="1"]')
      : nav.querySelector('[data-navtab="'+activeTab+'"]');
    if(el) applyGeom(geomOf(el));
  }
  // Settle on mount, when the active tab / connect state changes, and on resize.
  useLayoutEffect(function(){ settleToActive(); }, [activeTab, props.connectActive, tabs.length]);
  useEffect(function(){
    function onResize(){ settleToActive(); }
    window.addEventListener('resize', onResize);
    return function(){ window.removeEventListener('resize', onResize); };
  }, [activeTab]);

  function follow(clientX){
    var nav = navRef.current; if(!nav) return;
    var rect = nav.getBoundingClientRect();
    var x = clientX - rect.left;
    // MAGNETIC SNAP across tabs AND the orb: snap to the nearest target and
    // morph the droplet to its shape (capsule on a tab, circle on the orb).
    var els = nav.querySelectorAll('[data-navtab],[data-orb="1"]');
    var best = null, bestD = Infinity;
    for(var i=0;i<els.length;i++){
      var c = els[i].offsetLeft + els[i].offsetWidth/2;
      var d = Math.abs(c - x);
      if(d < bestD){ bestD = d; best = els[i]; }
    }
    if(best) applyGeom(geomOf(best));
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
      // Commit to whatever the droplet magnetically stuck to (fallback: the
      // element under the release point). Orb -> connect; tab -> select.
      var pick = snapTabRef.current || targetUnderPoint(e.clientX, e.clientY);
      snapTabRef.current = null;
      if(pick === '__orb__'){ tapOrb(); return; }
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
    var nav = navRef.current;
    if(nav){ var el = nav.querySelector('[data-navtab="'+tabId+'"]'); if(el) applyGeom(geomOf(el)); }
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
        position:'absolute', top:'50%', left:0,
        width: wSpring, height: hSpring, x: xLeft, y: yTop,
        scaleX: scaleX, scaleY: scaleY, transformOrigin: originX,
        borderRadius: rSpring, pointerEvents:'none', zIndex:0,
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
