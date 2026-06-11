/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

// MomentComposer — full-screen overlay that shows the picked photo,
// lets the user add an optional caption, and posts via the provided
// onShare callback. Mounted via portal so it always covers the viewport.
export default function MomentComposer(props){
  var file = props.file;
  var onCancel = props.onCancel;
  var onShare = props.onShare;  // async (file, caption, opts) => row

  var captionS = useState(''); var caption = captionS[0]; var setCaption = captionS[1];
  var uploadingS = useState(false); var uploading = uploadingS[0]; var setUploading = uploadingS[1];
  var previewUrlS = useState(null); var previewUrl = previewUrlS[0]; var setPreviewUrl = previewUrlS[1];
  var errorS = useState(''); var error = errorS[0]; var setError = errorS[1];
  // T2.7 — close-friends-only toggle. When true, the moment is only
  // visible to users on the poster's close_friends list (and gets the
  // green ring variant in the strip).
  var closeFriendsOnlyS = useState(false); var closeFriendsOnly = closeFriendsOnlyS[0]; var setCloseFriendsOnly = closeFriendsOnlyS[1];

  // ── Pinch-zoom + pan state ────────────────────────────────────────────
  // scale is the zoom factor (1 = natural). translate is the pan offset in
  // CSS px applied AFTER scaling. Slider controls scale; finger-drag pans.
  var scaleS = useState(1); var scale = scaleS[0]; var setScale = scaleS[1];
  var txS = useState(0); var tx = txS[0]; var setTx = txS[1];
  var tyS = useState(0); var ty = tyS[0]; var setTy = tyS[1];
  // Live gesture state held in refs so we don't re-render on every pointer
  // move. Direct DOM writes via imageRef during drag — React touches in
  // only on pointer-down/-up.
  var imageRef = useRef(null);
  var dragRef = useRef(null);   // { startX, startY, baseTx, baseTy }
  var pinchRef = useRef(null);  // { startDist, baseScale, midX, midY }
  // Track all active pointers (for two-finger pinch).
  var pointersRef = useRef({});

  function applyImageTransform(s, x, y){
    if (imageRef.current) {
      imageRef.current.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + s + ')';
    }
  }

  // When slider scale changes, push to the DOM immediately.
  useEffect(function(){
    applyImageTransform(scale, tx, ty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  function onImagePointerDown(e){
    try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch(_){}
    pointersRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointersRef.current);
    if (ids.length === 1) {
      // Single finger → start pan
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        baseTx: tx, baseTy: ty,
      };
    } else if (ids.length === 2) {
      // Two fingers → start pinch
      var p1 = pointersRef.current[ids[0]];
      var p2 = pointersRef.current[ids[1]];
      var dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      pinchRef.current = { startDist: dist, baseScale: scale };
      dragRef.current = null;  // disable pan while pinching
    }
  }
  function onImagePointerMove(e){
    if (!pointersRef.current[e.pointerId]) return;
    pointersRef.current[e.pointerId].x = e.clientX;
    pointersRef.current[e.pointerId].y = e.clientY;
    var ids = Object.keys(pointersRef.current);
    if (ids.length === 2 && pinchRef.current) {
      var p1 = pointersRef.current[ids[0]];
      var p2 = pointersRef.current[ids[1]];
      var dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      var newScale = Math.max(0.5, Math.min(4, pinchRef.current.baseScale * (dist / pinchRef.current.startDist)));
      applyImageTransform(newScale, tx, ty);
      // Stash so pointer-up commits the final value to React state.
      pinchRef.current.lastScale = newScale;
    } else if (ids.length === 1 && dragRef.current) {
      var dx = e.clientX - dragRef.current.startX;
      var dy = e.clientY - dragRef.current.startY;
      var nx = dragRef.current.baseTx + dx;
      var ny = dragRef.current.baseTy + dy;
      applyImageTransform(scale, nx, ny);
      dragRef.current.lastTx = nx;
      dragRef.current.lastTy = ny;
    }
  }
  function onImagePointerUp(e){
    delete pointersRef.current[e.pointerId];
    // Commit final values to React state.
    if (pinchRef.current && pinchRef.current.lastScale != null) {
      setScale(pinchRef.current.lastScale);
    }
    if (dragRef.current && dragRef.current.lastTx != null) {
      setTx(dragRef.current.lastTx);
      setTy(dragRef.current.lastTy);
    }
    var ids = Object.keys(pointersRef.current);
    if (ids.length === 0) { dragRef.current = null; pinchRef.current = null; }
    else if (ids.length === 1) {
      // Dropped from 2 → 1 finger: re-arm pan from current position
      pinchRef.current = null;
      var only = pointersRef.current[ids[0]];
      dragRef.current = {
        startX: only.x, startY: only.y,
        baseTx: tx, baseTy: ty,
      };
    }
  }
  function resetAdjust(){
    setScale(1); setTx(0); setTy(0);
    applyImageTransform(1, 0, 0);
  }

  useEffect(function(){
    if(!file) return;
    var url;
    try{ url = URL.createObjectURL(file); }catch(_){}
    if(url) setPreviewUrl(url);
    return function(){
      // ROUND-9 FIX #9: defer the revoke past the next render commit so
      // the new previewUrl (or null) has already painted by the time the
      // old object URL is revoked. Without this, switching files briefly
      // flashes a broken-image icon because we revoke the URL on the
      // OLD <img> before React swaps in the new src.
      var oldUrl = url;
      setTimeout(function(){ try{ if(oldUrl) URL.revokeObjectURL(oldUrl); }catch(_){} }, 0);
    };
  }, [file]);

  function handleShare(){
    if(uploading || !file) return;
    setUploading(true);
    setError('');
    Promise.resolve(onShare && onShare(file, (caption || '').trim(), { closeFriendsOnly: closeFriendsOnly }))
      .then(function(){ /* parent closes us */ })
      .catch(function(err){
        setError((err && err.message) ? err.message : 'Failed to share. Please try again.');
        setUploading(false);
      });
  }

  if(!file || !previewUrl) return null;

  var overlay = React.createElement('div', {
    onTouchStart: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    onTouchMove:  function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    style: {
      position:'fixed', top:0, left:0,
      width:'100vw', height:'100dvh',
      zIndex:10000,
      background:'#000',
      display:'flex', flexDirection:'column',
    }
  },
    // Image preview — pinch-zoom + pan supported. The wrapper handles
    // pointer events (gestures) and clips overflow; the image inside is
    // transform-scaled/translated via the ref directly for smooth 60fps.
    React.createElement('div', {
      onPointerDown: onImagePointerDown,
      onPointerMove: onImagePointerMove,
      onPointerUp: onImagePointerUp,
      onPointerCancel: onImagePointerUp,
      style:{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        overflow:'hidden',
        touchAction:'none',  // browser-side panning off; we drive it
        userSelect:'none', WebkitUserSelect:'none',
        WebkitTouchCallout:'none', WebkitTapHighlightColor:'transparent',
      }
    },
      React.createElement('img', {
        ref: imageRef,
        src: previewUrl, alt:'preview',
        draggable: false,
        style:{
          maxWidth:'100%', maxHeight:'100%', objectFit:'contain',
          transform: 'translate3d(0,0,0) scale(1)',
          transformOrigin: 'center center',
          willChange: 'transform',
          pointerEvents: 'none',
          WebkitUserDrag: 'none',
        }
      })
    ),
    // Zoom slider — sits above the caption input. Drag handle from 0.5×
    // to 4× zoom; tap "Reset" to snap back to 1× + recentered.
    React.createElement('div', {
      style:{
        position:'absolute',
        left:'14px', right:'14px',
        bottom:'calc(120px + env(safe-area-inset-bottom, 0px))',
        display:'flex', alignItems:'center', gap:'10px',
        background:'rgba(0,0,0,0.45)',
        backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
        borderRadius:'24px',
        padding:'8px 14px',
        zIndex:2,
      }
    },
      React.createElement('span', {style:{color:'#fff', fontSize:'13px', minWidth:'24px', textAlign:'center'}}, '−'),
      React.createElement('input', {
        type:'range',
        min:'0.5', max:'4', step:'0.05',
        value: String(scale),
        onChange: function(e){
          var v = parseFloat(e.target.value);
          if (!isNaN(v)) setScale(v);
        },
        style:{
          flex:1,
          accentColor:'#E84D9A',
          background:'transparent',
        }
      }),
      React.createElement('span', {style:{color:'#fff', fontSize:'13px', minWidth:'24px', textAlign:'center'}}, '+'),
      React.createElement('button', {
        onClick: resetAdjust,
        style:{
          background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
          padding:'4px 10px', borderRadius:'14px', fontSize:'11px', fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
          marginLeft:'4px',
        }
      }, 'Reset')
    ),

    // Header — cancel + label
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(12px + env(safe-area-inset-top, 0px))',
        left:'12px', right:'12px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        zIndex:1,
      }
    },
      React.createElement('button', {
        onClick: function(){ if(!uploading && onCancel) onCancel(); },
        className:'ringin-tap',
        title:'Cancel',
        style:{
          background:'rgba(0,0,0,0.5)', border:'none', color:'#fff',
          width:'36px', height:'36px', borderRadius:'50%',
          fontSize:'22px', lineHeight:1, cursor:'pointer',
        }
      }, '×'),
      React.createElement('div', {style:{color:'#fff',fontSize:'14px',fontWeight:700,fontFamily:'Syne, DM Sans, sans-serif',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}, 'New Moment'),
      React.createElement('div', {style:{width:'36px'}}) // spacer to keep label centred
    ),

    // Error toast (if any)
    error ? React.createElement('div', {
      style:{
        position:'absolute',
        bottom:'calc(82px + env(safe-area-inset-bottom, 0px))',
        left:'50%', transform:'translateX(-50%)',
        background:'rgba(239,71,71,0.92)', color:'#fff',
        padding:'8px 16px', borderRadius:'20px',
        fontSize:'12px', fontWeight:600,
        zIndex:2,
        maxWidth:'80%',
        textAlign:'center',
      }
    }, error) : null,

    // T2.7 — Audience chip (Public ↔ Close Friends). Sits above the
    // caption input. Tap to toggle. Green when close-friends-only.
    React.createElement('div', {
      style:{
        position:'absolute',
        left:'12px',
        bottom:'calc(60px + env(safe-area-inset-bottom, 0px))',
        zIndex:1,
      }
    },
      React.createElement('button', {
        onClick: function(){ setCloseFriendsOnly(function(v){ return !v; }); },
        className:'ringin-tap',
        style:{
          background: closeFriendsOnly ? 'rgba(39,201,106,0.85)' : 'rgba(0,0,0,0.55)',
          border: '1px solid ' + (closeFriendsOnly ? '#27C96A' : 'rgba(255,255,255,0.35)'),
          color:'#fff',
          padding:'6px 12px',
          borderRadius:'18px',
          fontSize:'12px',
          fontWeight:600,
          cursor:'pointer',
          fontFamily:'inherit',
          display:'inline-flex',
          alignItems:'center',
          gap:'5px',
        }
      }, closeFriendsOnly ? '★ Close Friends' : '🌐 Public')
    ),

    // Caption + Share row
    React.createElement('div', {
      style:{
        position:'absolute',
        left:'12px', right:'12px',
        bottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
        display:'flex', gap:'8px', alignItems:'center',
        zIndex:1,
      }
    },
      React.createElement('input', {
        type:'text',
        value: caption,
        placeholder:'Add a caption (optional)…',
        onChange: function(e){ setCaption(e.target.value); },
        disabled: uploading,
        style:{
          flex:1,
          background:'rgba(0,0,0,0.55)',
          border:'1px solid rgba(255,255,255,0.35)',
          borderRadius:'24px',
          padding:'11px 15px',
          fontSize:'15.4px',
          color:'#fff',
          outline:'none',
          fontFamily:'DM Sans, sans-serif',
          WebkitAppearance:'none',
        }
      }),
      React.createElement('button', {
        onClick: handleShare,
        disabled: uploading,
        className:'ringin-tap',
        style:{
          background: uploading ? 'rgba(255,255,255,0.55)' : '#fff',
          border:'none',
          color:'#222', fontWeight:700,
          fontSize:'14.3px',
          padding:'10px 16px',
          borderRadius:'24px',
          cursor: uploading ? 'wait' : 'pointer',
          minWidth:'74px',
        }
      }, uploading ? 'Sharing…' : 'Share')
    )
  );

  if(typeof document === 'undefined' || !document.body) return overlay;
  return createPortal(overlay, document.body);
}
