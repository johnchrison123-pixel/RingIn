/* eslint-disable */
import React, { useEffect, useState, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// InstallPrompt — small bottom-anchored banner offering to install RingIn
// to the home screen. Purely additive: if the user dismisses or installs,
// it never shows again (persisted in localStorage). Listens for
// `beforeinstallprompt` on Android/Chromium; on iOS Safari shows brief
// "Tap Share → Add to Home Screen" instructions since iOS doesn't expose
// the prompt API.
//
// Mounted at the top of <App> and renders a fixed-position pill above the
// bottom-nav so it never interferes with screen content. Auto-hides when
// the app is already running standalone (display-mode: standalone).
// ──────────────────────────────────────────────────────────────────────────

var STORAGE_KEY = 'ringin_install_dismissed';
var STORAGE_TS_KEY = 'ringin_install_dismissed_at';
// Re-show 14 days after dismissal so we don't nag, but don't disappear
// forever — useful for users who tap "Not now" without thinking.
var RESHOW_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(){
  try{
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true; // iOS
    return false;
  }catch(e){ return false; }
}

function isIOS(){
  try{
    var ua = window.navigator.userAgent || '';
    if (/iP(hone|ad|od)/.test(ua)) return true;
    // iPad Pro running iOS 13+ reports as Mac with touch
    if (/Mac/.test(ua) && window.navigator.maxTouchPoints > 1) return true;
    return false;
  }catch(e){ return false; }
}

function wasRecentlyDismissed(){
  try{
    if (!localStorage.getItem(STORAGE_KEY)) return false;
    var ts = parseInt(localStorage.getItem(STORAGE_TS_KEY) || '0', 10);
    if (!ts) return true; // dismissed but no timestamp — keep dismissed
    return (Date.now() - ts) < RESHOW_AFTER_MS;
  }catch(e){ return false; }
}

export default function InstallPrompt(){
  var visibleS = useState(false);
  var visible = visibleS[0]; var setVisible = visibleS[1];
  var iosS = useState(false);
  var ios = iosS[0]; var setIos = iosS[1];
  var promptEventRef = useRef(null);

  useEffect(function(){
    if (isStandalone()) return;            // Already installed — never show
    if (wasRecentlyDismissed()) return;    // User said no recently — respect it

    // Android / Chromium: capture the install prompt so we can trigger it later
    function onBeforeInstall(e){
      try{ e.preventDefault(); }catch(_){}
      promptEventRef.current = e;
      // Delay showing so we don't blast the user the instant they land.
      // Three seconds is enough that they've seen the app.
      setTimeout(function(){
        if (!isStandalone() && !wasRecentlyDismissed()) setVisible(true);
      }, 3000);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari: no event. Show instructions instead, but only if NOT already
    // running standalone. Delay a little longer so we don't pop up mid-onboarding.
    var iosTimer = null;
    if (isIOS() && !isStandalone()){
      iosTimer = setTimeout(function(){
        if (!isStandalone() && !wasRecentlyDismissed()){
          setIos(true);
          setVisible(true);
        }
      }, 6000);
    }

    // If the user installs from the browser menu, hide ourselves
    function onInstalled(){
      setVisible(false);
      try{
        localStorage.setItem(STORAGE_KEY, '1');
        localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
      }catch(_){}
    }
    window.addEventListener('appinstalled', onInstalled);

    return function(){
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss(){
    setVisible(false);
    try{
      localStorage.setItem(STORAGE_KEY, '1');
      localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
    }catch(_){}
  }

  function install(){
    var ev = promptEventRef.current;
    if (!ev || !ev.prompt){ dismiss(); return; }
    try{
      ev.prompt();
      ev.userChoice.then(function(){
        // Whether they accepted or dismissed the native prompt, hide ours
        promptEventRef.current = null;
        dismiss();
      }).catch(function(){ dismiss(); });
    }catch(e){ dismiss(); }
  }

  if (!visible) return null;

  // Pill banner sits ABOVE the bottom-nav (which has class .bottom-nav).
  // Using position:fixed with bottom offset so it never affects layout flow.
  // Z-index 850 = above content, below the call overlay (zIndex 900) so a
  // ringing call always takes priority.
  var pillStyle = {
    position:'fixed',
    left:'50%',
    transform:'translateX(-50%)',
    bottom:'76px',     // sits just above the bottom-nav
    zIndex:850,
    width:'calc(100% - 24px)',
    maxWidth:'420px',
    background:'linear-gradient(135deg, rgba(123,110,255,0.95), rgba(232,77,154,0.95))',
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

  return React.createElement('div', { style: pillStyle, role:'dialog', 'aria-label':'Install RingIn' },
    // RingIn pill mini-icon
    React.createElement('div', {
      style:{
        width:'34px', height:'34px', borderRadius:'10px',
        background:'rgba(255,255,255,0.18)',
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }
    },
      React.createElement('svg', {viewBox:'0 0 24 24', width:18, height:18, fill:'none', stroke:'#fff', strokeWidth:2.4, strokeLinecap:'round', strokeLinejoin:'round'},
        React.createElement('path', {d:'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z'})
      )
    ),
    React.createElement('div', { style:{flex:1, minWidth:0} },
      React.createElement('div', { style:{fontSize:'13px', fontWeight:700, lineHeight:1.15} }, 'Install RingIn'),
      React.createElement('div', { style:{fontSize:'11px', opacity:0.85, marginTop:'2px', lineHeight:1.25} },
        ios ? 'Tap Share, then "Add to Home Screen".' : 'Add to home screen for instant access.'
      )
    ),
    // Action button
    ios
      ? React.createElement('button', {
          onClick: dismiss,
          className: 'ringin-tap',
          style:{
            background:'rgba(255,255,255,0.18)', color:'#fff',
            border:'none', borderRadius:'10px',
            padding:'8px 12px', fontSize:'12px', fontWeight:700,
            cursor:'pointer',
          }
        }, 'Got it')
      : React.createElement('button', {
          onClick: install,
          className: 'ringin-tap',
          style:{
            background:'#fff', color:'#7B6EFF',
            border:'none', borderRadius:'10px',
            padding:'8px 14px', fontSize:'12px', fontWeight:800,
            cursor:'pointer',
          }
        }, 'Install'),
    React.createElement('button', {
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
    )
  );
}
