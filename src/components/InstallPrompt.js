/* eslint-disable */
import React, { useEffect, useState, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// InstallPrompt — small bottom-anchored banner offering to install RingIn
// to the home screen.
//
// Three install paths, in priority order:
//   1. Native install API (Chromium fires `beforeinstallprompt`) — we
//      capture this event super early in index.html so it's never lost
//      to a React mount race. Tapping "Install" calls prompt() directly.
//   2. iOS Safari — no event API; we show "Tap Share → Add to Home Screen"
//      instructions, since iOS only allows install via the Safari Share menu.
//   3. Fallback — for browsers that meet PWA criteria but don't fire the
//      event (Samsung Internet's own install flow, Firefox Android, etc.),
//      we still show a pill after 7s with browser-menu instructions.
//
// Always-on dismiss + 14-day re-ask window. Hides if running standalone.
// ──────────────────────────────────────────────────────────────────────────

var STORAGE_KEY = 'ringin_install_dismissed';
var STORAGE_TS_KEY = 'ringin_install_dismissed_at';
var RESHOW_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(){
  try{
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true; // iOS
    return false;
  }catch(e){ return false; }
}

// Final polish: stricter iOS detection. The old `/Mac/ && maxTouchPoints>1`
// branch tripped on touchscreen MacBooks (rare today but increasingly real
// — and any future hybrid Mac). True iPadOS reports as Macintosh in UA but
// has 'ontouchstart' in window. Real desktop Macs don't. Require BOTH
// signals before treating a Macintosh UA as iOS.
function isIOS(ua){
  if (/iP(hone|ad|od)/.test(ua)) return true;
  // iPadOS-as-Mac path — must have touch APIs AND multi-touch capacity.
  if (ua.indexOf('Macintosh') >= 0
      && (window.navigator.maxTouchPoints || 0) > 1
      && ('ontouchstart' in window)) {
    return true;
  }
  return false;
}

function detectPlatform(){
  try{
    var ua = window.navigator.userAgent || '';
    if (isIOS(ua)) return 'ios';
    if (/SamsungBrowser/i.test(ua)) return 'samsung';
    if (/Firefox/i.test(ua)) return 'firefox';
    if (/Edg\//.test(ua)) return 'edge';
    if (/Chrome|Chromium|CriOS/.test(ua)) return 'chrome';
    return 'other';
  }catch(e){ return 'other'; }
}

function wasRecentlyDismissed(){
  try{
    if (!localStorage.getItem(STORAGE_KEY)) return false;
    var ts = parseInt(localStorage.getItem(STORAGE_TS_KEY) || '0', 10);
    if (!ts) return true;
    return (Date.now() - ts) < RESHOW_AFTER_MS;
  }catch(e){ return false; }
}

// Per-platform install instructions for the fallback mode (when the
// native beforeinstallprompt event doesn't fire — true for iOS Safari
// always, and for Samsung Internet / Firefox in many configurations).
function instructionsFor(platform){
  if (platform === 'ios')     return 'Tap Share, then "Add to Home Screen".';
  if (platform === 'samsung') return 'Tap menu (☰), then "Add page to → Home screen".';
  if (platform === 'firefox') return 'Tap menu (⋮), then "Install" or "Add to Home Screen".';
  if (platform === 'edge')    return 'Tap menu (…), then "Add to phone".';
  // chrome + everything else
  return 'Tap menu (⋮), then "Install app" or "Add to Home Screen".';
}

export default function InstallPrompt(){
  var visibleS = useState(false);
  var visible = visibleS[0]; var setVisible = visibleS[1];
  // 'native' = use beforeinstallprompt prompt(), 'manual' = show menu instructions
  var modeS = useState('native');
  var mode = modeS[0]; var setMode = modeS[1];
  var promptEventRef = useRef(null);
  var platformRef = useRef('other');

  useEffect(function(){
    if (isStandalone()) return;          // Already installed
    if (wasRecentlyDismissed()) return;  // User said no recently

    platformRef.current = detectPlatform();

    // (1) Grab any beforeinstallprompt event that fired before React mounted
    // (captured by the early script in public/index.html).
    if (window.__ringinDeferredInstall){
      promptEventRef.current = window.__ringinDeferredInstall;
      setMode('native');
      // Tiny delay so the pill animates in cleanly after first paint
      setTimeout(function(){
        if (!isStandalone() && !wasRecentlyDismissed()) setVisible(true);
      }, 800);
    }

    // (2) Listen for the event in case it fires AFTER mount (typical on
    // first-ever visit, where SW takes a moment to install + activate).
    function onReady(){
      promptEventRef.current = window.__ringinDeferredInstall;
      if (!promptEventRef.current) return;
      setMode('native');
      if (!isStandalone() && !wasRecentlyDismissed()) setVisible(true);
    }
    function onInstalled(){
      // FIX #12: user accepted install — just hide the prompt. Do NOT
      // set the dismissed_at flag (was the same as explicit-dismiss
      // before, locking the user out of re-prompts for 14 days even
      // though they did the thing we wanted).
      setVisible(false);
    }
    window.addEventListener('ringin-install-ready', onReady);
    window.addEventListener('ringin-install-done', onInstalled);

    // (3) Fallback path. If after 7s no native prompt event fired AND we
    // haven't already shown the pill, show it anyway in "manual" mode with
    // browser-specific menu instructions. Covers:
    //   - iOS Safari (no API at all)
    //   - Samsung Internet (uses its own menu)
    //   - Firefox Android (uses its own menu)
    //   - First-ever visit where SW hasn't activated yet
    var fallbackTimer = setTimeout(function(){
      if (isStandalone() || wasRecentlyDismissed()) return;
      if (promptEventRef.current) return; // native path already showing
      setMode('manual');
      setVisible(true);
    }, 7000);

    return function(){
      window.removeEventListener('ringin-install-ready', onReady);
      window.removeEventListener('ringin-install-done', onInstalled);
      clearTimeout(fallbackTimer);
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
    if (!ev || !ev.prompt){
      // No native event — flip to manual instructions instead of dismissing
      setMode('manual');
      return;
    }
    try{
      ev.prompt();
      ev.userChoice.then(function(choice){
        promptEventRef.current = null;
        // FIX #12: only set the 14-day dismissed cooldown when the user
        // EXPLICITLY dismissed. If they accepted, just hide the prompt —
        // the appinstalled event will fire shortly and onInstalled will
        // hide it for good without locking re-prompts.
        if (choice && choice.outcome === 'dismissed') {
          dismiss();
        } else {
          setVisible(false);
        }
      }).catch(function(){ setVisible(false); });
    }catch(e){ setVisible(false); }
  }

  if (!visible) return null;

  var platform = platformRef.current;
  var isIosManual = (mode === 'manual' && platform === 'ios');
  var bodyText = mode === 'native'
    ? 'Add to home screen for instant access.'
    : instructionsFor(platform);

  var pillStyle = {
    position:'fixed',
    left:'50%',
    transform:'translateX(-50%)',
    bottom:'76px',
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
      React.createElement('div', { style:{fontSize:'11px', opacity:0.88, marginTop:'2px', lineHeight:1.3} }, bodyText)
    ),
    // Action button: native prompt if we have one, otherwise "Got it"
    mode === 'native'
      ? React.createElement('button', {
          onClick: install,
          className: 'ringin-tap',
          style:{
            background:'#fff', color:'#7B6EFF',
            border:'none', borderRadius:'10px',
            padding:'8px 14px', fontSize:'12px', fontWeight:800,
            cursor:'pointer',
          }
        }, 'Install')
      : React.createElement('button', {
          onClick: dismiss,
          className: 'ringin-tap',
          style:{
            background:'rgba(255,255,255,0.18)', color:'#fff',
            border:'none', borderRadius:'10px',
            padding:'8px 12px', fontSize:'12px', fontWeight:700,
            cursor:'pointer',
          }
        }, 'Got it'),
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
