/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';

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
  var onClose = props.onClose;
  var idxS = useState(0);
  var idx = idxS[0]; var setIdx = idxS[1];
  var timerRef = useRef(null);
  var SLIDE_MS = 4500;

  // Auto-advance
  useEffect(function(){
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    timerRef.current = setTimeout(function(){
      if (idx < slides.length - 1) setIdx(idx + 1);
      else if (onClose) onClose();
    }, SLIDE_MS);
    return function(){ if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slides.length]);

  // Tap left third = back, tap right two-thirds = next
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

  if (!slides.length) return null;
  var cur = slides[idx];

  return React.createElement('div', {
    onClick: handleTap,
    style: {
      position:'fixed', inset:0, zIndex:9999,
      background: cur.bg,
      color:'#fff',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'24px',
      userSelect:'none', WebkitUserSelect:'none',
      cursor:'pointer',
    }
  },
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
    // Header
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(24px + env(safe-area-inset-top, 0px))',
        left:'14px', right:'14px',
        display:'flex', alignItems:'center', gap:'10px',
        zIndex:2,
      }
    },
      user.avatar ? React.createElement('img', {
        src: user.avatar, alt:'',
        style:{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',border:'1.5px solid rgba(255,255,255,0.5)'}
      }) : React.createElement('div', {
        style:{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700}
      }, (user.name||'?').charAt(0).toUpperCase()),
      React.createElement('div', {style:{flex:1,fontSize:'14px',fontWeight:700,textShadow:'0 1px 4px rgba(0,0,0,0.3)'}}, user.name || ''),
      React.createElement('button', {
        onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); if(onClose) onClose(); },
        className:'ringin-tap',
        style:{background:'transparent',border:'none',color:'#fff',fontSize:'26px',lineHeight:1,cursor:'pointer',padding:'4px 6px',fontWeight:300}
      }, '×')
    ),
    // Caption
    React.createElement('div', {
      style:{
        fontSize:'26px', fontWeight:800, lineHeight:1.3,
        textAlign:'center', maxWidth:'82%',
        textShadow:'0 2px 16px rgba(0,0,0,0.35)',
        fontFamily:'Syne, DM Sans, sans-serif',
      }
    }, cur.text)
  );
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
    var slides = setForId(m.id);
    setViewer({
      user: { name: m.userName || '', avatar: m.userAvatar || null },
      slides: slides,
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
      onClose: closeViewer,
    }) : null
  );
}
