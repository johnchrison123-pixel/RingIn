/* eslint-disable */
import React, { useEffect, useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// UpdatePrompt — a small bottom banner that appears when the service worker
// has detected a new RingIn version (a fresh sw.js + assets are sitting in
// the "waiting" state). User taps "Update" to apply the update — that
// triggers SKIP_WAITING on the new SW and a reload to pick up the new code.
//
// The "ringin-sw-update-available" window event is fired by
// src/utils/swRegistration.js whenever it spots a new SW in installed state
// AND the page is already controlled by an old SW.
//
// Without this banner, users would have to fully close and reopen the PWA
// to pick up new versions — discoverable maybe to power users, missed by
// everyone else. With the banner, it's a one-tap action.
// ──────────────────────────────────────────────────────────────────────────

export default function UpdatePrompt(){
  var availableS = useState(false);
  var available = availableS[0]; var setAvailable = availableS[1];
  var applyingS = useState(false);
  var applying = applyingS[0]; var setApplying = applyingS[1];
  // Track whether the available update came from the native OTA path
  // (Capgo bundle download) or the PWA service worker — they apply via
  // different mechanisms, so we route accordingly when the user taps Update.
  var sourceS = useState('sw');
  var source = sourceS[0]; var setSource = sourceS[1];

  useEffect(function(){
    function onReady(ev){
      try {
        var src = (ev && ev.detail && ev.detail.source) || 'sw';
        setSource(src);
      } catch(_) { setSource('sw'); }
      setAvailable(true);
    }
    try{ window.addEventListener('ringin-sw-update-available', onReady); }catch(_){}
    return function(){
      try{ window.removeEventListener('ringin-sw-update-available', onReady); }catch(_){}
    };
  }, []);

  function applyUpdate(){
    setApplying(true);
    // Give the fullscreen "Updating…" splash a beat to mount so the user
    // never sees the WhiteFlash that happens between the React tree
    // tear-down and the new bundle's first paint. Then route to the
    // correct apply function based on update source.
    setTimeout(function(){
      try{
        if (source === 'ota' && typeof window.__ringinApplyOtaUpdate === 'function'){
          window.__ringinApplyOtaUpdate();
        } else if (typeof window.__ringinApplySWUpdate === 'function'){
          window.__ringinApplySWUpdate();
        } else {
          try{ window.location.reload(); }catch(_){}
        }
      }catch(_){
        try{ window.location.reload(); }catch(_){}
      }
    }, 200);
  }

  function dismiss(){ setAvailable(false); }

  // When the user has tapped Update, take over the whole screen with a
  // dark "Updating RingIn…" splash + an indeterminate progress bar.
  // This covers the brief window between the React unmount and the new
  // bundle's first paint so the user never sees the white-flash that
  // used to happen.
  if (applying) {
    return React.createElement('div', {
      role: 'dialog', 'aria-label': 'Updating RingIn',
      style: {
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100dvh',
        background: '#09090E',
        color: '#fff',
        zIndex: 9999999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '22px',
        fontFamily: 'DM Sans, system-ui, sans-serif',
      }
    },
      // Logo / gradient mark
      React.createElement('div', {
        style: {
          width: '78px', height: '78px',
          borderRadius: '22px',
          background: 'linear-gradient(135deg,#5B4FD4,#E84D9A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '38px', fontWeight: 800,
          color: '#fff',
          boxShadow: '0 10px 40px rgba(232,77,154,0.35)',
          animation: 'ringinPulseGlow 1.6s ease-in-out infinite',
        }
      }, 'R'),
      React.createElement('div', { style: { fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' } }, 'Updating RingIn'),
      React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '-12px' } }, 'Fetching the latest version…'),
      // Indeterminate progress bar — looping gradient stripe
      React.createElement('div', {
        style: {
          width: '220px', height: '4px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          position: 'relative',
        }
      },
        React.createElement('div', {
          style: {
            position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
            background: 'linear-gradient(90deg, transparent, #B44FE8 30%, #5B4FD4 70%, transparent)',
            animation: 'ringinUpdateSlide 1.2s ease-in-out infinite',
            borderRadius: '2px',
          }
        })
      ),
      // Inject keyframes inline so we don't depend on an external stylesheet
      // for the splash to animate (the new bundle's CSS won't be loaded yet).
      React.createElement('style', null,
        '@keyframes ringinUpdateSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(550%)} }' +
        '@keyframes ringinPulseGlow { 0%,100%{box-shadow:0 10px 40px rgba(232,77,154,0.35)} 50%{box-shadow:0 10px 60px rgba(91,79,212,0.7)} }'
      )
    );
  }

  if (!available) return null;

  // Sits above the bottom-nav, slightly offset from the InstallPrompt's
  // 76px so they don't visually overlap on the rare occasion both could
  // show simultaneously. Uses brand gradient with a "fresh" green accent
  // to differentiate from the install pill.
  var pillStyle = {
    position:'fixed',
    left:'50%',
    transform:'translateX(-50%)',
    bottom:'calc(96px + env(safe-area-inset-bottom, 0px))',
    zIndex:860,
    width:'calc(100% - 24px)',
    maxWidth:'420px',
    background:'linear-gradient(135deg, #11998E 0%, #38EF7D 100%)',
    color:'#fff',
    borderRadius:'16px',
    boxShadow:'0 10px 30px rgba(9,9,14,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
    padding:'12px 14px',
    display:'flex',
    alignItems:'center',
    gap:'10px',
    fontFamily:'DM Sans, system-ui, sans-serif',
    animation:'ringinSlideUp 240ms ease-out',
  };

  return React.createElement('div', { style: pillStyle, role:'dialog', 'aria-label':'RingIn update available' },
    // Spinning sparkle while applying, otherwise static ✨
    React.createElement('div', {
      style:{
        width:'34px', height:'34px', borderRadius:'10px',
        background:'rgba(255,255,255,0.18)',
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0, fontSize:'18px',
      }
    }, applying ? '⏳' : '✨'),

    React.createElement('div', { style:{flex:1, minWidth:0} },
      React.createElement('div', { style:{fontSize:'13px', fontWeight:700, lineHeight:1.15} },
        applying ? 'Updating…' : 'New RingIn version available'
      ),
      React.createElement('div', { style:{fontSize:'11px', opacity:0.88, marginTop:'2px', lineHeight:1.3} },
        applying ? 'Reloading with the latest changes' : 'Tap to refresh — quick and seamless'
      )
    ),

    !applying ? React.createElement('button', {
      onClick: applyUpdate,
      className: 'ringin-tap',
      style:{
        background:'#fff', color:'#11998E',
        border:'none', borderRadius:'10px',
        padding:'8px 14px', fontSize:'12px', fontWeight:800,
        cursor:'pointer',
      }
    }, 'Update') : null,

    !applying ? React.createElement('button', {
      onClick: dismiss,
      className: 'ringin-tap',
      'aria-label':'Dismiss',
      style:{
        background:'transparent', color:'#fff',
        border:'none', padding:'4px', cursor:'pointer',
        opacity:0.75, lineHeight:0,
      }
    },
      React.createElement('svg', {viewBox:'0 0 24 24', width:16, height:16, fill:'none', stroke:'currentColor', strokeWidth:2.4, strokeLinecap:'round'},
        React.createElement('path', {d:'M18 6L6 18M6 6l12 12'})
      )
    ) : null
  );
}
