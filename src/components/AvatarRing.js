/* eslint-disable */
import React from 'react';

// ──────────────────────────────────────────────────────────────────────────
// AvatarRing — Instagram/Facebook/LinkedIn-style "story ring" around an
// avatar when the user behind that avatar has posted a moment in the last
// 24h. Renders a neon pink-purple gradient halo with a soft glow pulse.
//
// Implementation: wraps `children` in a position:relative inline-flex box
// and overlays a thin absolutely-positioned ring sibling that extends a
// few pixels beyond the avatar. The ring is drawn with a gradient
// background + CSS `mask-composite: exclude` to cut out the centre,
// leaving only the outline. Browsers without mask-composite support
// (legacy Chrome <120) degrade gracefully to a filled circle with a soft
// glow — still readable as a status indicator.
//
// Usage:
//   React.createElement(AvatarRing, { show: hasMoment },
//     /* the existing avatar element — its own size/styles are preserved */
//     React.createElement('div', { style: { width:36, height:36, ... } },
//       React.createElement('img', { src: avatarUrl, ... })
//     )
//   )
//
// Notes for callers:
// - When `show` is false, the wrapper is omitted entirely — the children
//   render exactly as before, with zero layout impact.
// - When `show` is true, the wrapper adds `display:inline-flex` and
//   `position:relative`. Flex layouts handle inline-flex children just
//   like raw divs — no visual difference except the ring on top.
// - The ring extends ~3px beyond the avatar in every direction. Make sure
//   the GRANDPARENT element doesn't have `overflow:hidden`, otherwise the
//   ring will be clipped (avatar render sites in RingIn all have their
//   clip on the avatar itself, not the parent, so this is generally OK).
// - `thickness` (default 2px) — ring stroke width.
// - `glow` (default true) — adds the soft drop-shadow glow.
// - `pulse` (default true) — adds the slow brightness animation via
//   `momentRingPulse` keyframes (defined in src/index.css).
// ──────────────────────────────────────────────────────────────────────────

export default function AvatarRing(props) {
  if (!props.show) {
    // No moment → render the children unchanged. We intentionally don't
    // wrap when show is false so existing layouts and click handlers
    // work exactly as they did before this component existed.
    return props.children || null;
  }

  var thickness = (props.thickness != null) ? props.thickness : 2;
  var inset = -(thickness + 1.5);  // ring extends slightly past the avatar's edge
  var glow = (props.glow !== false);
  var pulse = (props.pulse !== false);

  // The gradient ring. Painted into an absolute-positioned overlay that
  // sits on top of (and slightly past) the children. mask-composite cuts
  // out the centre so only the ring outline is visible.
  var ringStyle = {
    position: 'absolute',
    inset: inset,
    borderRadius: '50%',
    padding: thickness,
    background: 'linear-gradient(135deg,#FF6B6B 0%,#E84D9A 50%,#7B6EFF 100%)',
    pointerEvents: 'none',
    // The two-layer mask trick: first mask is content-box (centre area
    // only), second covers everything. Composite-exclude subtracts the
    // first from the second, leaving only the padding strip = the ring.
    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'xor',
    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    maskComposite: 'exclude',
    // Glow: stacked box-shadows for a neon look (close pink layer +
    // diffuse purple layer). Pulses via @keyframes momentRingPulse.
    boxShadow: glow
      ? '0 0 6px rgba(232,77,154,0.55), 0 0 14px rgba(123,110,255,0.4)'
      : 'none',
    animation: pulse ? 'momentRingPulse 2.4s ease-in-out infinite' : 'none',
  };

  return React.createElement('div', {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0,
      lineHeight: 0,
      verticalAlign: 'middle',
    }
  },
    props.children,
    React.createElement('div', {
      'aria-hidden': 'true',
      style: ringStyle,
    })
  );
}
