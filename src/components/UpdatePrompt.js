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
    // Small delay so the user sees the spinner state, then route to the
    // correct apply function based on update source:
    //   - 'ota' (native APK with a staged Capgo bundle) → __ringinApplyOtaUpdate
    //   - 'sw'  (PWA with a waiting service worker)     → __ringinApplySWUpdate
    setTimeout(function(){
      try{
        if (source === 'ota' && typeof window.__ringinApplyOtaUpdate === 'function'){
          window.__ringinApplyOtaUpdate();
        } else if (typeof window.__ringinApplySWUpdate === 'function'){
          window.__ringinApplySWUpdate();
        } else {
          // Fallback if neither helper is there — just reload
          try{ window.location.reload(); }catch(_){}
        }
      }catch(_){
        try{ window.location.reload(); }catch(_){}
      }
    }, 80);
  }

  function dismiss(){ setAvailable(false); }

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
