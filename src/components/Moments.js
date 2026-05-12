/* eslint-disable */
import React from 'react';

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
          onClick: function(){ if(props.onView) props.onView(m); else { try{ alert('Moment from ' + (m.userName || 'this user') + ' — playback coming soon.'); }catch(e){} } },
        }),
        React.createElement('div', {
          style:{fontSize:'10px',color:'var(--text)',maxWidth:size+8,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}
        }, m.userName || '')
      );
    }),

    // Empty-state pad so the last tile has a bit of right margin when scrolling
    React.createElement('div', {style:{minWidth:'4px',flexShrink:0}})
  );
}
