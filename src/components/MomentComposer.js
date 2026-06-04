/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

/* R52: 15 Instagram-style filter presets. Each is a plain CSS filter
 * string — applied via <img style.filter> in the live preview AND via
 * canvas ctx.filter during export so the saved image has it baked in. */
var FILTERS = [
  { key:'original',  name:'Original',  css:'none' },
  { key:'clarendon', name:'Clarendon', css:'contrast(1.2) saturate(1.35)' },
  { key:'lark',      name:'Lark',      css:'contrast(0.9) brightness(1.1) saturate(1.1) hue-rotate(-7deg)' },
  { key:'juno',      name:'Juno',      css:'contrast(1.15) saturate(1.4) hue-rotate(-10deg)' },
  { key:'aden',      name:'Aden',      css:'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
  { key:'gingham',   name:'Gingham',   css:'brightness(1.05) hue-rotate(-10deg) sepia(0.04)' },
  { key:'slumber',   name:'Slumber',   css:'saturate(0.66) brightness(1.05) sepia(0.1)' },
  { key:'crema',     name:'Crema',     css:'contrast(0.9) brightness(1.1) saturate(0.9) sepia(0.1)' },
  { key:'reyes',     name:'Reyes',     css:'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
  { key:'mono',      name:'Mono',      css:'grayscale(1) contrast(1.1)' },
  { key:'valencia',  name:'Valencia',  css:'sepia(0.25) contrast(1.08) brightness(1.08) saturate(1.5)' },
  { key:'hudson',    name:'Hudson',    css:'brightness(1.2) contrast(0.9) saturate(1.1) hue-rotate(15deg)' },
  { key:'xpro2',     name:'X-Pro II',  css:'contrast(1.3) brightness(1.05) saturate(1.3) sepia(0.3)' },
  { key:'nashville', name:'Nashville', css:'sepia(0.2) contrast(1.2) brightness(1.05) saturate(1.2) hue-rotate(-15deg)' },
  { key:'inkwell',   name:'Inkwell',   css:'sepia(0.3) contrast(1.1) brightness(1.1) grayscale(1)' },
];

/* R52: quality presets. Drives canvas downscale + JPEG encoder quality.
 * Standard is the previous default (Insta-ish). HD bumps resolution for
 * users on faster networks. 4K preserves the full original (or close)
 * for users uploading from modern phone cameras. */
var QUALITY_PRESETS = [
  { key:'standard', name:'Standard', short:'SD',  maxWidth:1080, jpegQuality:0.85 },
  { key:'hd',       name:'HD',       short:'HD',  maxWidth:1920, jpegQuality:0.92 },
  { key:'4k',       name:'4K',       short:'4K',  maxWidth:3840, jpegQuality:0.95 },
];

/* R52: take a File, render it through canvas with a CSS filter applied
 * and scaled to maxWidth, return a new File. Used by handleShare so the
 * uploaded image has the filter baked in + is right-sized for storage. */
function applyFilterAndQuality(file, filterCss, maxWidth, jpegQuality){
  return new Promise(function(resolve, reject){
    var img = new Image();
    img.onload = function(){
      try {
        var ratio = img.naturalWidth > maxWidth ? (maxWidth / img.naturalWidth) : 1;
        var w = Math.max(1, Math.round(img.naturalWidth * ratio));
        var h = Math.max(1, Math.round(img.naturalHeight * ratio));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        /* ctx.filter accepts the same syntax as CSS filter. If the
         * runtime doesn't support it (very old browser), the image just
         * exports without the filter — preferable to crashing. */
        if (filterCss && filterCss !== 'none') {
          try { ctx.filter = filterCss; } catch(_){}
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob){
          if (!blob) { reject(new Error('Canvas processing failed')); return; }
          try {
            var out = new File([blob], (file.name || 'moment') + '.jpg', { type:'image/jpeg' });
            resolve(out);
          } catch(_){
            /* Old Android: File ctor unavailable. Fall back to the Blob
             * directly — Supabase upload accepts Blob, just lacks .name. */
            try { blob.name = 'moment.jpg'; } catch(__){}
            resolve(blob);
          }
        }, 'image/jpeg', jpegQuality);
      } catch (e) { reject(e); }
    };
    img.onerror = function(){ reject(new Error('Could not decode image')); };
    try { img.src = URL.createObjectURL(file); } catch(e){ reject(e); }
  });
}

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

  /* R52: Instagram-style color filter + resolution preset for the
   * shared image. Both apply during preview (CSS filter on the <img>)
   * AND during export (canvas processing in handleShare). */
  var selectedFilterKeyS = useState('original'); var selectedFilterKey = selectedFilterKeyS[0]; var setSelectedFilterKey = selectedFilterKeyS[1];
  var selectedQualityKeyS = useState('standard'); var selectedQualityKey = selectedQualityKeyS[0]; var setSelectedQualityKey = selectedQualityKeyS[1];

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
    /* R52: bake the chosen filter + scale into the exported file BEFORE
     * uploading, so the saved image matches what the user saw in preview
     * (filters need to persist on every viewer, not just the composer). */
    var filterDef = FILTERS.find(function(f){ return f.key === selectedFilterKey; }) || FILTERS[0];
    var qualityDef = QUALITY_PRESETS.find(function(q){ return q.key === selectedQualityKey; }) || QUALITY_PRESETS[0];
    var shouldProcess = filterDef.css !== 'none' || qualityDef.key !== 'standard';
    var processed = shouldProcess
      ? applyFilterAndQuality(file, filterDef.css, qualityDef.maxWidth, qualityDef.jpegQuality)
      : Promise.resolve(file);
    processed.then(function(outFile){
      return Promise.resolve(onShare && onShare(outFile, (caption || '').trim(), { closeFriendsOnly: closeFriendsOnly, filter: filterDef.key, quality: qualityDef.key }));
    }).then(function(){ /* parent closes us */ })
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
          /* R52: live filter preview. The exported image gets the same
           * filter baked in via canvas during handleShare. */
          filter: (FILTERS.find(function(f){ return f.key === selectedFilterKey; }) || FILTERS[0]).css,
          WebkitFilter: (FILTERS.find(function(f){ return f.key === selectedFilterKey; }) || FILTERS[0]).css,
        }
      })
    ),
    /* R52: Filter strip — horizontal scroll of 15 thumbnails. Each
     * thumbnail uses the preview URL with that filter pre-applied so
     * the user sees an instant per-filter preview without re-rendering
     * the whole image. */
    React.createElement('div', {
      style:{
        position:'absolute',
        left:0, right:0,
        bottom:'calc(218px + env(safe-area-inset-bottom, 0px))',
        padding:'0 12px',
        overflowX:'auto',
        WebkitOverflowScrolling:'touch',
        zIndex:2,
        display:'flex',
        gap:'8px',
        scrollbarWidth:'none',
      }
    },
      FILTERS.map(function(f){
        var sel = selectedFilterKey === f.key;
        return React.createElement('button', {
          key: f.key,
          onClick: function(){ setSelectedFilterKey(f.key); },
          style:{
            background:'transparent', border:'none', padding:0, cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
            flexShrink:0, fontFamily:'inherit',
          }
        },
          React.createElement('div', {
            style:{
              width:'58px', height:'58px', borderRadius:'10px',
              border: sel ? '2px solid #E84D9A' : '2px solid rgba(255,255,255,0.25)',
              overflow:'hidden', position:'relative',
              boxShadow: sel ? '0 0 12px rgba(232,77,154,0.5)' : 'none',
            }
          },
            React.createElement('img', {
              src: previewUrl, alt: f.name,
              style:{
                width:'100%', height:'100%', objectFit:'cover',
                filter: f.css, WebkitFilter: f.css,
              }
            })
          ),
          React.createElement('div', {
            style:{
              color: sel ? '#E84D9A' : 'rgba(255,255,255,0.85)',
              fontSize:'10px', fontWeight: sel ? 700 : 500,
              textShadow:'0 1px 3px rgba(0,0,0,0.6)',
            }
          }, f.name)
        );
      })
    ),

    /* R52: Quality picker — 3 pills (SD / HD / 4K). */
    React.createElement('div', {
      style:{
        position:'absolute',
        left:'14px', right:'14px',
        bottom:'calc(178px + env(safe-area-inset-bottom, 0px))',
        display:'flex', gap:'6px', alignItems:'center', justifyContent:'center',
        zIndex:2,
      }
    },
      QUALITY_PRESETS.map(function(q){
        var sel = selectedQualityKey === q.key;
        return React.createElement('button', {
          key: q.key,
          onClick: function(){ setSelectedQualityKey(q.key); },
          style:{
            background: sel ? 'rgba(232,77,154,0.85)' : 'rgba(0,0,0,0.55)',
            border: '1px solid ' + (sel ? '#E84D9A' : 'rgba(255,255,255,0.35)'),
            color:'#fff',
            padding:'5px 14px',
            borderRadius:'14px',
            fontSize:'11px',
            fontWeight: sel ? 800 : 600,
            cursor:'pointer',
            fontFamily:'inherit',
            letterSpacing: '0.5px',
          }
        }, q.short);
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
