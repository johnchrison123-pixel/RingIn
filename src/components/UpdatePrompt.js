/* eslint-disable */
import React, { useEffect, useState, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// UpdatePrompt — three discrete UI states:
//
//   1. AVAILABLE  — neon-green popup with release notes + "Update" button.
//                   Triggered by the 'ringin-sw-update-available' window
//                   event (dispatched by App.js after OTA manifest check
//                   OR by swRegistration.js when a new service worker is
//                   waiting in the PWA path).
//
//   2. APPLYING   — full-screen frosted overlay. Spinner + progress bar.
//                   Stays up across the page reload because we also
//                   render it on mount when localStorage flag is set.
//
//   3. FINISHING  — same frosted overlay, briefly shown post-reload (when
//                   ringin_just_updated=1 is in localStorage), then fades
//                   out so user lands seamlessly in the fresh app.
//
// No auto-update, no white flash. User taps Update → frosted overlay
// covers everything until the new bundle is live.
// ──────────────────────────────────────────────────────────────────────────

export default function UpdatePrompt(){
  // AVAILABLE state — popup is showing
  var availableS = useState(false);
  var available = availableS[0]; var setAvailable = availableS[1];
  // Pending update info from the event detail
  var updateInfoS = useState({ version: '', title: '', notes: [], source: 'sw' });
  var updateInfo = updateInfoS[0]; var setUpdateInfo = updateInfoS[1];
  // APPLYING state — frosted overlay with progress
  var applyingS = useState(false);
  var applying = applyingS[0]; var setApplying = applyingS[1];
  var progressS = useState(0);
  var progress = progressS[0]; var setProgress = progressS[1];
  // FINISHING state — brief post-reload overlay
  var finishingS = useState(false);
  var finishing = finishingS[0]; var setFinishing = finishingS[1];
  // Slow indeterminate progress ticker (used when Capgo doesn't fire
  // real percentage events — at least gives the bar something to do).
  var fakeTickerRef = useRef(null);

  // On mount: check for ringin_just_updated flag → show finishing
  // overlay AND hide the inline boot overlay from index.html once
  // we're ready to show our own. The hand-off avoids any visible gap.
  // Progress continues from 85% (where APPLYING left off pre-reload)
  // and animates to 100% slowly so the bar feels continuous.
  useEffect(function(){
    try {
      if (localStorage.getItem('ringin_just_updated') === '1') {
        setFinishing(true);
        setProgress(85);  // pick up where the pre-reload APPLYING left off
        try { localStorage.removeItem('ringin_just_updated'); } catch(_){}
        // Hide the inline boot overlay after a tiny delay so React's
        // overlay is painted first → seamless visual hand-off.
        setTimeout(function(){
          try { if (typeof window.__ringinHideBootUpdating === 'function') window.__ringinHideBootUpdating(); } catch(_){}
        }, 80);
        // Animate progress 85 → 100 over ~1.0s — the CSS transition on
        // the bar makes this smooth. Then hold at 100 for another ~600ms
        // so the user perceives completion before the overlay fades.
        var progT = setTimeout(function(){ setProgress(100); }, 200);
        var dismissT = setTimeout(function(){ setFinishing(false); }, 1700);
        return function(){ clearTimeout(progT); clearTimeout(dismissT); };
      }
    } catch(_){}
  }, []);

  useEffect(function(){
    function onReady(ev){
      try {
        var d = (ev && ev.detail) || {};
        setUpdateInfo({
          version: d.version || '',
          title: d.title || 'A new RingIn update is ready',
          notes: Array.isArray(d.notes) ? d.notes : [],
          source: d.source || 'sw',
        });
      } catch(_){}
      setAvailable(true);
    }
    try{ window.addEventListener('ringin-sw-update-available', onReady); }catch(_){}
    return function(){
      try{ window.removeEventListener('ringin-sw-update-available', onReady); }catch(_){}
    };
  }, []);

  function applyUpdate(){
    setApplying(true);
    setProgress(0);
    // Slow fake ticker — caps at 85% so there's room for the real
    // post-reload "finishing" stage to fill the rest (85 → 100).
    // 2% every 280ms ≈ ~14s to reach 85%. Most updates land faster,
    // and real Capgo progress events will jump ahead naturally.
    var fakeProgress = 5;
    fakeTickerRef.current = setInterval(function(){
      fakeProgress = Math.min(85, fakeProgress + 2);
      setProgress(function(p){ return Math.max(p, fakeProgress); });
    }, 280);

    function done(){
      if (fakeTickerRef.current) clearInterval(fakeTickerRef.current);
      fakeTickerRef.current = null;
    }
    // Route to the correct apply function based on update source.
    setTimeout(function(){
      try {
        if (updateInfo.source === 'ota' && typeof window.__ringinDownloadOtaUpdate === 'function') {
          window.__ringinDownloadOtaUpdate(function(pct){
            // Real progress from Capgo — overrides the fake ticker if higher.
            setProgress(function(p){ return Math.max(p, pct); });
          }).catch(function(){
            done();
            setApplying(false);
          });
          // On success, the page reloads. localStorage flag → finishing overlay on next mount.
        } else if (typeof window.__ringinApplySWUpdate === 'function') {
          // PWA path
          try { localStorage.setItem('ringin_just_updated', '1'); } catch(_){}
          setProgress(100);
          done();
          setTimeout(function(){ window.__ringinApplySWUpdate(); }, 250);
        } else {
          try { localStorage.setItem('ringin_just_updated', '1'); } catch(_){}
          done();
          setTimeout(function(){ try{ window.location.reload(); }catch(_){} }, 250);
        }
      } catch(_) {
        done();
        try{ localStorage.setItem('ringin_just_updated', '1'); window.location.reload(); }catch(_){}
      }
    }, 250);
  }

  function dismiss(){ setAvailable(false); }

  // ── RENDER: frosted overlay (applying OR finishing) ───────────────
  if (applying || finishing) {
    var label = applying ? 'Updating RingIn' : 'Almost ready';
    var sub   = applying
      ? (progress >= 95 ? 'Finishing up…' : 'Downloading the latest version')
      : (progress >= 99 ? 'You are good to go!' : 'Loading your fresh app…');
    // Use the live progress in BOTH states — the bar animates
    // continuously from pre-reload (~85) through to 100 post-reload.
    var pct = Math.round(progress);
    return React.createElement('div', {
      role: 'dialog',
      'aria-label': label,
      style: {
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100dvh',
        zIndex: 9999999,
        background: 'rgba(8, 8, 18, 0.78)',
        backdropFilter: 'blur(22px) saturate(140%)',
        WebkitBackdropFilter: 'blur(22px) saturate(140%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '20px',
        color: '#fff',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        opacity: finishing && !applying ? 1 : 1,
        transition: 'opacity 380ms ease-out',
        animation: finishing && !applying ? 'ringinFadeIn 200ms ease-out' : 'none',
      }
    },
      // Logo — neon green pulse during applying, brand gradient during finishing
      React.createElement('div', {
        style: {
          width: '76px', height: '76px',
          borderRadius: '22px',
          background: applying
            ? 'linear-gradient(135deg, #39FF14 0%, #00FF7F 100%)'
            : 'linear-gradient(135deg, #5B4FD4 0%, #E84D9A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '38px', fontWeight: 800,
          color: applying ? '#062a08' : '#fff',
          boxShadow: applying
            ? '0 0 36px rgba(57,255,20,0.55), 0 0 70px rgba(0,255,127,0.35), inset 0 0 14px rgba(255,255,255,0.2)'
            : '0 10px 40px rgba(232,77,154,0.4)',
          animation: 'ringinUpdatePulse 1.6s ease-in-out infinite',
        }
      }, applying ? '⬇' : '✓'),
      React.createElement('div', { style: { fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' } }, label),
      React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '-12px', maxWidth: '280px', textAlign: 'center' } }, sub),
      // Progress bar
      React.createElement('div', {
        style: {
          width: '240px', height: '5px',
          borderRadius: '3px',
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          position: 'relative',
        }
      },
        React.createElement('div', {
          style: {
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: pct + '%',
            background: 'linear-gradient(90deg, #39FF14, #00FF7F)',
            borderRadius: '3px',
            boxShadow: '0 0 12px rgba(57,255,20,0.7)',
            transition: 'width 220ms ease-out',
          }
        })
      ),
      React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'ui-monospace, monospace' } }, pct + '%'),
      // Inline keyframes — bundle CSS may not be loaded yet during finishing state.
      React.createElement('style', null,
        '@keyframes ringinUpdatePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }' +
        '@keyframes ringinFadeIn { from{opacity:0} to{opacity:1} }'
      )
    );
  }

  if (!available) return null;

  // ── RENDER: neon-green AVAILABLE popup ─────────────────────────────
  // Final polish: was ['Performance improvements', 'Bug fixes'] when notes
  // were missing — claims work that may not exist. Replaced with a single
  // vague-but-honest line. The real notes (when supplied via OTA manifest)
  // override this.
  var notes = (updateInfo.notes && updateInfo.notes.length)
    ? updateInfo.notes.slice(0, 4)
    : ['Updates and improvements'];

  var cardStyle = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
    zIndex: 860,
    width: 'calc(100% - 20px)',
    maxWidth: '440px',
    background: 'linear-gradient(135deg, #0d2a14 0%, #06170a 100%)',
    color: '#eafff0',
    borderRadius: '20px',
    border: '1.5px solid rgba(57,255,20,0.55)',
    boxShadow: '0 0 30px rgba(57,255,20,0.35), 0 0 60px rgba(0,255,127,0.15), 0 16px 40px rgba(0,0,0,0.5)',
    padding: '16px 16px 14px',
    display: 'flex', flexDirection: 'column',
    gap: '10px',
    fontFamily: 'DM Sans, system-ui, sans-serif',
    animation: 'ringinSlideUp 280ms cubic-bezier(0.22,0.61,0.36,1)',
  };

  return React.createElement('div', { style: cardStyle, role: 'dialog', 'aria-label': 'RingIn update available' },
    // Header row — title + dismiss
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px' } },
      // Sparkle badge
      React.createElement('div', {
        style: {
          width: '38px', height: '38px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #39FF14, #00FF7F)',
          color: '#062a08',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '20px', fontWeight: 800,
          boxShadow: '0 0 16px rgba(57,255,20,0.5)',
        }
      }, '✨'),
      // Title block
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: '15px', fontWeight: 800, color: '#fff', textShadow: '0 0 8px rgba(57,255,20,0.4)' } },
          updateInfo.title || 'New update available'
        ),
        updateInfo.version ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(195,255,210,0.6)', marginTop: '2px', fontFamily: 'ui-monospace, monospace' } },
          'Version ' + updateInfo.version
        ) : null
      ),
      // Dismiss button
      React.createElement('button', {
        onClick: dismiss,
        className: 'ringin-tap',
        'aria-label': 'Dismiss',
        style: {
          background: 'transparent', color: 'rgba(195,255,210,0.6)',
          border: 'none', padding: '4px', cursor: 'pointer',
          fontSize: '16px', lineHeight: 0, fontFamily: 'inherit',
        }
      },
        React.createElement('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12' })
        )
      )
    ),
    // Release notes list — bug fixes / new features
    React.createElement('ul', {
      style: {
        margin: '4px 0 6px',
        padding: '0 0 0 18px',
        listStyle: 'none',
        fontSize: '13px',
        color: 'rgba(220,255,228,0.88)',
        lineHeight: 1.5,
      }
    },
      notes.map(function(line, i){
        return React.createElement('li', {
          key: i,
          style: {
            position: 'relative',
            marginBottom: i < notes.length - 1 ? '4px' : 0,
          }
        },
          React.createElement('span', {
            style: {
              position: 'absolute',
              left: '-14px', top: '7px',
              width: '6px', height: '6px',
              borderRadius: '50%',
              background: '#39FF14',
              boxShadow: '0 0 6px rgba(57,255,20,0.7)',
            }
          }),
          line
        );
      })
    ),
    // Update button — bright neon
    React.createElement('button', {
      onClick: applyUpdate,
      className: 'ringin-tap',
      style: {
        marginTop: '4px',
        width: '100%',
        background: 'linear-gradient(135deg, #39FF14 0%, #00FF7F 100%)',
        color: '#062a08',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px', fontWeight: 800,
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: '0 0 16px rgba(57,255,20,0.5), inset 0 -2px 0 rgba(0,0,0,0.12)',
        letterSpacing: '0.2px',
      }
    }, 'Update Now')
  );
}
