/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

// ── Mock moment slides used when no real data is wired up ─────────────────
// Each "expert" gets a deterministic set of 3–4 gradient cards with captions
// — chosen by hashing their id so the same person always sees the same set.
var SAMPLE_SETS = [
  [
    { id:'s0-1', bg:'linear-gradient(135deg,#FF6B6B,#FFE66D)', text:'Available for calls today 🎯' },
    { id:'s0-2', bg:'linear-gradient(135deg,#4ECDC4,#45B7D1)', text:'Just wrapped a great session — thanks for the trust 💜' },
    { id:'s0-3', bg:'linear-gradient(135deg,#7B6EFF,#E84D9A)', text:'Tip of the day: small consistent steps win.' },
  ],
  [
    { id:'s1-1', bg:'linear-gradient(135deg,#A8E063,#56AB2F)', text:'Online now — let\'s talk 📞' },
    { id:'s1-2', bg:'linear-gradient(135deg,#F093FB,#F5576C)', text:'New article dropping this week' },
    { id:'s1-3', bg:'linear-gradient(135deg,#4FACFE,#00F2FE)', text:'Q&A this Friday at 7pm' },
    { id:'s1-4', bg:'linear-gradient(135deg,#FA709A,#FEE140)', text:'Sunset coffee thoughts ☕' },
  ],
  [
    { id:'s2-1', bg:'linear-gradient(135deg,#667EEA,#764BA2)', text:'3 callers helped today, 2 slots left ✨' },
    { id:'s2-2', bg:'linear-gradient(135deg,#F7971E,#FFD200)', text:'New skill unlocked. Ask me about it.' },
    { id:'s2-3', bg:'linear-gradient(135deg,#11998E,#38EF7D)', text:'Grateful for this community 🌱' },
  ],
  [
    { id:'s3-1', bg:'linear-gradient(135deg,#FC466B,#3F5EFB)', text:'Behind the scenes today' },
    { id:'s3-2', bg:'linear-gradient(135deg,#FDBB2D,#22C1C3)', text:'New session times posted on my profile' },
    { id:'s3-3', bg:'linear-gradient(135deg,#EE0979,#FF6A00)', text:'Hot take 🔥 simple > clever' },
    { id:'s3-4', bg:'linear-gradient(135deg,#00C9FF,#92FE9D)', text:'Tap the Call button — let\'s connect' },
  ],
];

function setForId(id){
  if (id == null) return SAMPLE_SETS[0];
  var s = String(id);
  var n = 0;
  for (var i = 0; i < s.length; i++) n = (n + s.charCodeAt(i)) | 0;
  return SAMPLE_SETS[Math.abs(n) % SAMPLE_SETS.length];
}

// ── MomentViewer — full-screen Insta-style story player ───────────────────
function MomentViewer(props){
  var user = props.user || {};
  var slides = props.slides || [];
  var moment = props.moment || {};
  var onClose = props.onClose;
  var onLike = props.onLike;
  var onReply = props.onReply;
  var idxS = useState(0);
  var idx = idxS[0]; var setIdx = idxS[1];
  var timerRef = useRef(null);
  var SLIDE_MS = 4500;

  // Reply state
  var replyTextS = useState('');
  var replyText = replyTextS[0]; var setReplyText = replyTextS[1];
  var pausedS = useState(false);
  var paused = pausedS[0]; var setPaused = pausedS[1];
  var sentToastS = useState('');
  var sentToast = sentToastS[0]; var setSentToast = sentToastS[1];

  // Like state per slide. Persisted in localStorage keyed by
  // momentId-slideId, so reopening shows the same heart fill state.
  function likesKey(){ try{ return 'ringin_moment_likes'; }catch(_){ return 'ringin_moment_likes'; } }
  function likedSet(){
    try{ var raw = localStorage.getItem(likesKey()); return raw ? JSON.parse(raw) : {}; }catch(_){ return {}; }
  }
  function isLikedFor(slideId){
    var k = (moment.id != null ? moment.id : 'na') + ':' + slideId;
    var s = likedSet();
    return !!s[k];
  }
  function setLikedFor(slideId, val){
    var k = (moment.id != null ? moment.id : 'na') + ':' + slideId;
    var s = likedSet();
    if(val) s[k] = true; else delete s[k];
    try{ localStorage.setItem(likesKey(), JSON.stringify(s)); }catch(_){}
  }
  var likedNowS = useState(false);
  var likedNow = likedNowS[0]; var setLikedNow = likedNowS[1];
  useEffect(function(){
    var cur = slides[idx]; if(!cur) return;
    setLikedNow(isLikedFor(cur.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slides.length]);

  // Auto-advance — pauses while the user is composing a reply so they don't
  // lose their place mid-typing.
  useEffect(function(){
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (paused) return;
    timerRef.current = setTimeout(function(){
      if (idx < slides.length - 1) setIdx(idx + 1);
      else if (onClose) onClose();
    }, SLIDE_MS);
    return function(){ if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slides.length, paused]);

  // Tap left third = back, tap right two-thirds = next. Taps on the
  // composer / like row are stopPropagation'd so they don't navigate.
  function handleTap(e){
    try{
      var rect = e.currentTarget.getBoundingClientRect();
      var x = (e.clientX != null ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0)) - rect.left;
      var w = rect.width;
      if (x < w * 0.33){
        if (idx > 0) setIdx(idx - 1);
      } else {
        if (idx < slides.length - 1) setIdx(idx + 1);
        else if (onClose) onClose();
      }
    }catch(_){}
  }

  function showToast(text){
    setSentToast(text);
    setTimeout(function(){ setSentToast(''); }, 1400);
  }

  function toggleLike(e){
    if(e && e.stopPropagation) e.stopPropagation();
    var cur = slides[idx]; if(!cur) return;
    var nowLiked = !likedNow;
    setLikedFor(cur.id, nowLiked);
    setLikedNow(nowLiked);
    // Only drop a chat message on the transition from unliked → liked, so
    // toggling on/off doesn't spam the recipient's chat.
    if(nowLiked && typeof onLike === 'function'){
      try{ onLike(moment, cur); }catch(_){}
      showToast('Liked ❤️');
    }
  }

  function sendReply(e){
    if(e && e.stopPropagation) e.stopPropagation();
    var t = (replyText || '').trim();
    if(!t) return;
    var cur = slides[idx]; if(!cur) return;
    if(typeof onReply === 'function'){
      try{ onReply(moment, cur, t); }catch(_){}
    }
    setReplyText('');
    setPaused(false);
    showToast('Sent ✓');
    // Close shortly after so the toast is visible.
    setTimeout(function(){ if(onClose) onClose(); }, 900);
  }

  if (!slides.length) return null;
  var cur = slides[idx];
  // Image moment vs gradient/text moment — real user-posted moments carry
  // an imageUrl and (optional) caption; mock expert moments use cur.bg + cur.text.
  var hasImage = !!cur.imageUrl;
  var captionText = cur.caption != null ? cur.caption : (cur.text || '');

  // Portal to document.body — a `position:fixed` element inside .moments-strip
  // gets trapped by the .app-container / .screen-content stacking context on
  // some browsers (iOS Safari especially), which renders the viewer at the
  // strip's bounds instead of the full viewport. Portalling sidesteps all of
  // that by mounting the overlay at document.body.
  var overlay = React.createElement('div', {
    onClick: handleTap,
    // Block parent's swipe-back and scroll while the viewer is open.
    onTouchStart: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    onTouchMove: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    style: {
      position:'fixed',
      // top/left + height in dvh — this makes the overlay's bottom edge end
      // at the DYNAMIC viewport bottom (i.e. just above Safari's URL bar
      // when it's visible). With plain `100vh` the overlay extends behind
      // the URL bar and the composer at bottom:18px gets clipped.
      top:0, left:0,
      width:'100vw', height:'100dvh',
      zIndex:9999,
      background: hasImage ? '#000' : cur.bg,
      color:'#fff',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'24px',
      userSelect:'none', WebkitUserSelect:'none',
      cursor:'pointer',
      overflow:'hidden',
    }
  },
    // Image layer (real moments) — sits below the chrome (progress bars,
    // header, composer). object-fit:contain so portraits/landscapes both
    // render without cropping; black letterbox via the parent bg.
    hasImage ? React.createElement('img', {
      src: cur.imageUrl, alt:'',
      onError: function(e){ try{ e.target.style.display='none'; }catch(_){} },
      style:{
        position:'absolute',
        top:0, left:0, width:'100%', height:'100%',
        objectFit:'contain',
        zIndex:0,
      }
    }) : null,
    // Progress bars
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(10px + env(safe-area-inset-top, 0px))',
        left:8, right:8,
        display:'flex', gap:'4px',
        zIndex:2,
      }
    },
      slides.map(function(s, i){
        return React.createElement('div', { key:s.id, style:{flex:1,height:'3px',background:'rgba(255,255,255,0.3)',borderRadius:'2px',overflow:'hidden'} },
          React.createElement('div', {
            style:{
              height:'100%', background:'#fff',
              width: i < idx ? '100%' : (i === idx ? '0%' : '0%'),
              animation: i === idx ? 'momentBarFill ' + SLIDE_MS + 'ms linear forwards' : 'none',
            }
          })
        );
      })
    ),
    // Header — avatar + name are tappable to open the expert's profile
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(24px + env(safe-area-inset-top, 0px))',
        left:'14px', right:'14px',
        display:'flex', alignItems:'center', gap:'10px',
        zIndex:2,
      }
    },
      React.createElement('div', {
        onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); if(props.onViewProfile) props.onViewProfile(props.moment); },
        style:{display:'flex', alignItems:'center', gap:'10px', flex:1, cursor:'pointer'},
      },
        user.avatar ? React.createElement('img', {
          src: user.avatar, alt:'',
          style:{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',border:'1.5px solid rgba(255,255,255,0.5)'}
        }) : React.createElement('div', {
          style:{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700}
        }, (user.name||'?').charAt(0).toUpperCase()),
        React.createElement('div', {style:{fontSize:'14px',fontWeight:700,textShadow:'0 1px 4px rgba(0,0,0,0.3)'}}, user.name || '')
      ),
      React.createElement('button', {
        onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); if(onClose) onClose(); },
        className:'ringin-tap',
        style:{background:'transparent',border:'none',color:'#fff',fontSize:'26px',lineHeight:1,cursor:'pointer',padding:'4px 6px',fontWeight:300}
      }, '×')
    ),
    // Caption — gradient slides: big centred text. Image slides: smaller
    // text sitting above the composer with a subtle dark backdrop so it
    // stays legible over any photo.
    captionText ? (hasImage ? React.createElement('div', {
      style:{
        position:'absolute',
        left:'14px', right:'14px',
        bottom:'calc(74px + env(safe-area-inset-bottom, 0px))',
        background:'rgba(0,0,0,0.42)',
        backdropFilter:'blur(4px)',
        WebkitBackdropFilter:'blur(4px)',
        borderRadius:'14px',
        padding:'10px 14px',
        fontSize:'14px',
        fontWeight:600,
        lineHeight:1.35,
        textAlign:'center',
        zIndex:2,
        textShadow:'0 1px 6px rgba(0,0,0,0.4)',
      }
    }, captionText) : React.createElement('div', {
      style:{
        fontSize:'26px', fontWeight:800, lineHeight:1.3,
        textAlign:'center', maxWidth:'82%',
        textShadow:'0 2px 16px rgba(0,0,0,0.35)',
        fontFamily:'Syne, DM Sans, sans-serif',
        position:'relative', zIndex:1,
      }
    }, captionText)) : null,
    // ── Reply composer + Like row (bottom) ────────────────────────────────
    // Sits above the home-indicator safe area. Tapping anywhere here MUST
    // NOT trigger the tap-navigate handler on the parent, so every event
    // is stopPropagation'd. Pauses the auto-advance while focused.
    React.createElement('div', {
      onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      style:{
        position:'absolute',
        left:'14px', right:'14px',
        // 10px above the safe-area inset puts the composer right above the
        // home-indicator blank zone — like Instagram. env() handles both
        // PWA (≈34px home-indicator inset) and Safari (URL bar already
        // excluded by the 100dvh overlay above).
        bottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
        display:'flex', alignItems:'center', gap:'8px',
        zIndex:3,
      }
    },
      React.createElement('input', {
        type:'text',
        value: replyText,
        placeholder: 'Reply to '+ (user.name ? user.name.split(' ')[0] : 'this moment') + '…',
        onFocus: function(){ setPaused(true); },
        onBlur: function(){ setPaused(false); },
        onChange: function(e){ setReplyText(e.target.value); },
        onKeyDown: function(e){ if(e.key === 'Enter'){ sendReply(e); } },
        style:{
          flex:1,
          background:'rgba(0,0,0,0.32)',
          border:'1px solid rgba(255,255,255,0.35)',
          borderRadius:'24px',        // +10% from 22px
          padding:'11px 15px',        // +10% from 10px/14px
          fontSize:'15.4px',          // +10% from 14px
          color:'#fff',
          outline:'none',
          fontFamily:'DM Sans, sans-serif',
          WebkitAppearance:'none',
        }
      }),
      (replyText && replyText.trim()) ? React.createElement('button', {
        onClick: sendReply,
        className:'ringin-tap',
        style:{
          background:'#fff', border:'none',
          color:'#222', fontWeight:700,
          fontSize:'14.3px',          // +10% from 13px
          padding:'10px 15px',        // +10% from 9px/14px
          borderRadius:'24px',
          cursor:'pointer',
        }
      }, 'Send') : React.createElement('button', {
        onClick: toggleLike,
        className:'ringin-tap',
        title: likedNow ? 'Unlike' : 'Like',
        style:{
          background:'rgba(0,0,0,0.32)',
          border:'1px solid rgba(255,255,255,0.35)',
          color:'#fff',
          width:'44px', height:'44px', // +10% from 40px
          borderRadius:'50%',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'22px', lineHeight:1, // +10% from 20px
          cursor:'pointer',
        }
      }, likedNow ? '❤️' : '🤍')
    ),
    // Brief "Sent ✓" / "Liked ❤️" toast — auto-hides after ~1.4s
    sentToast ? React.createElement('div', {
      style:{
        position:'absolute',
        bottom:'calc(74px + env(safe-area-inset-bottom, 0px))',
        left:'50%', transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.55)',
        color:'#fff',
        padding:'7px 14px',
        borderRadius:'20px',
        fontSize:'12px', fontWeight:600,
        zIndex:4,
        pointerEvents:'none',
      }
    }, sentToast) : null
  );

  // SSR guard — document is undefined during server render; we only need
  // the portal on the client anyway.
  if (typeof document === 'undefined' || !document.body) return overlay;
  return createPortal(overlay, document.body);
}

// ──────────────────────────────────────────────────────────────────────────
// Moments — RingIn's take on Stories / Status. Where Facebook uses circles
// and Instagram uses rounded squares, we use a HEART. The clip-path below
// is a 12-point polygon approximation of a heart, which renders cleanly
// at any size and across all modern browsers.
//
// Used in three places: HomeScreen (feed top), ProfileScreen (own profile),
// and UserProfileView (other users' profiles). The same component with
// different props.
//
// Currently UI-only — no Supabase persistence yet. Real moments storage
// can be added later by wiring `moments` prop to a fetch / realtime sub.
// ──────────────────────────────────────────────────────────────────────────

var HEART_CLIP_PATH =
  'polygon(50% 95%, 20% 80%, 3% 50%, 3% 25%, 20% 5%, 35% 5%, 50% 22%, 65% 5%, 80% 5%, 97% 25%, 97% 50%, 80% 80%)';

// One heart tile. Renders the avatar (or initials) inside a heart-shaped
// clip, optionally wrapped in a gradient "unread" ring. For the "add"
// tile (isAdd=true), overlays a small + badge in the bottom-right corner
// so the affordance stays visible even when the user has an avatar.
function HeartTile(props){
  var size = props.size || 68;
  var ring = !!props.ring;
  var src = props.src || null;
  var initials = props.initials || '?';
  var bg = props.bg || 'linear-gradient(135deg,#7B6EFF,#E84D9A)';
  var onClick = props.onClick;
  var isAdd = !!props.isAdd;

  // OUTER button is unclipped so the + badge can sit ON TOP of the heart
  // without being chopped by the heart's clip-path. We use a nested
  // <div> with the clip-path for the actual heart silhouette.
  var buttonStyle = {
    position: 'relative',
    width: size, height: size,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'block',
  };
  // The heart silhouette wrapper (handles the optional gradient ring)
  var heartWrapStyle = {
    position: 'absolute',
    inset: 0,
    clipPath: HEART_CLIP_PATH,
    background: ring ? 'linear-gradient(135deg,#FF6B6B,#E84D9A,#7B6EFF)' : 'transparent',
    padding: ring ? 3 : 0,
    boxSizing: 'border-box',
  };
  var heartInnerStyle = {
    width: '100%', height: '100%',
    clipPath: HEART_CLIP_PATH,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: (isAdd && !src) ? '24px' : '16px',
    fontWeight: 700,
    overflow: 'hidden',
    position: 'relative',
  };
  // + badge for "add" tiles. Sits outside the clip so it's always visible
  // even when an avatar is shown.
  var badgeStyle = {
    position: 'absolute',
    bottom: '-2px',
    right: '6px',
    width: '22px', height: '22px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
    border: '2px solid var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1,
    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
    pointerEvents: 'none',  /* click goes to the button, not the badge */
  };

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    title: isAdd ? 'Add a Moment' : (props.label || 'View Moment'),
    style: buttonStyle,
  },
    React.createElement('div', {style: heartWrapStyle},
      React.createElement('div', {style: heartInnerStyle},
        src
          ? React.createElement('img', {
              src: src, alt: '',
              style:{width:'100%',height:'100%',objectFit:'cover'},
              onError:function(e){ try{ e.target.style.display='none'; }catch(_){ } },
            })
          : (isAdd ? '+' : initials)
      )
    ),
    // + badge — only on the user's own "add" tile, only when they have an
    // avatar in the heart (otherwise the big "+" in the center is the cue).
    (isAdd && src) ? React.createElement('div', {style: badgeStyle}, '+') : null
  );
}

// The strip — horizontal scrollable row of heart tiles with names below.
// Props:
//   ownAvatar     string?  current user's avatar (shown in the "+ add" tile)
//   ownName       string?  label under the add tile (default "Your Moment")
//   showAdd       bool     show the "+" tile (default true)
//   moments       array    [{ id, userName, userAvatar, hasNew? }]
//   onAdd         fn       called when user taps the "+" tile
//   onView        fn       called with a moment object when its tile is tapped
//   compact       bool     smaller size for profile pages (default false)
export default function Moments(props){
  var moments = props.moments || [];
  var showAdd = props.showAdd !== false;
  var compact = !!props.compact;
  var size = compact ? 60 : 68;

  // Internal viewer state — when set, MomentViewer overlay is rendered
  var viewerS = useState(null);
  var viewer = viewerS[0]; var setViewer = viewerS[1];

  function openViewerFor(m){
    // Real moments come with their own slides (image + caption); mock
    // expert moments fall back to deterministic gradient sample sets.
    var slides = (m.slides && m.slides.length > 0) ? m.slides : setForId(m.id);
    setViewer({
      user: { name: m.userName || '', avatar: m.userAvatar || null },
      slides: slides,
      moment: m,
    });
  }
  function closeViewer(){ setViewer(null); }

  // Defensive: total nav strip height is heart (size) + label gap (5px) +
  // label height (~12px) + top padding (12px) + bottom padding (16px) =
  // size + 45 px. Setting an explicit min-height stops any flex parent
  // from squashing the strip into a 15px sliver.
  var stripMinHeight = size + 45;

  return React.createElement('div', {
    className:'moments-strip',
    style:{
      display:'flex',
      gap:'14px',
      padding:'12px 16px 16px',
      overflowX:'auto',
      overflowY:'hidden',
      scrollbarWidth:'none',
      msOverflowStyle:'none',
      WebkitOverflowScrolling:'touch',
      borderBottom:'1px solid var(--border)',
      marginBottom:'4px',
      // Defenses against flex / grid parents trying to shrink the strip:
      flexShrink:0,
      minHeight: stripMinHeight + 'px',
      boxSizing:'border-box',
    },
    onTouchStart:function(ev){ ev.stopPropagation && ev.stopPropagation(); },
  },
    showAdd ? React.createElement('div', {
      style:{display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',flexShrink:0}
    },
      React.createElement(HeartTile, {
        src: props.ownAvatar || null,
        initials: '+',
        isAdd: true,
        size: size,
        bg: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
        onClick: function(){ if(props.onAdd) props.onAdd(); else { try{ alert('Moments coming soon — capture & post photos/videos that vanish after 24h.'); }catch(e){} } },
      }),
      React.createElement('div', {
        style:{fontSize:'10px',color:'var(--t2)',maxWidth:size+8,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}
      }, props.ownName || 'Your Moment')
    ) : null,

    moments.map(function(m){
      return React.createElement('div', {
        key: m.id,
        style:{display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',flexShrink:0}
      },
        React.createElement(HeartTile, {
          src: m.userAvatar || null,
          initials: m.userName ? m.userName.charAt(0).toUpperCase() : '?',
          bg: m.color || 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
          ring: m.hasNew !== false,
          size: size,
          label: m.userName,
          // Always open the internal viewer. If parent passes onView it runs
          // first (e.g. for analytics) but we still open the viewer.
          onClick: function(){ try{ if(props.onView) props.onView(m); }catch(_){} openViewerFor(m); },
        }),
        React.createElement('div', {
          style:{fontSize:'10px',color:'var(--text)',maxWidth:size+8,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}
        }, m.userName || '')
      );
    }),

    // Empty-state pad so the last tile has a bit of right margin when scrolling
    React.createElement('div', {style:{minWidth:'4px',flexShrink:0}}),

    // Full-screen Insta-style viewer (rendered as last child; position:fixed
    // takes it out of flow regardless of where it sits in the DOM).
    viewer ? React.createElement(MomentViewer, {
      user: viewer.user,
      slides: viewer.slides,
      moment: viewer.moment,
      onClose: closeViewer,
      onLike: props.onLike,
      onReply: props.onReply,
      onViewProfile: props.onViewProfile,
    }) : null
  );
}
