/* eslint-disable */
import React from 'react';

/* ────────────────────────────────────────────────────────────────────────
 * R40 — Verification badge.
 *
 * 12-point star (dodecagram) with a pink → purple gradient fill, white
 * tick inside, and a soft pink glow (drop-shadow filter). Shown next to
 * any name+avatar whenever profiles.is_verified === true.
 *
 * Usage:
 *   <VerificationBadge size={16} />
 *   <VerificationBadge size={20} style={{marginLeft:4}} />
 *
 * Renders nothing if `show` is explicitly false — lets callers do the
 * truthy check inline:
 *   <VerificationBadge show={profile.is_verified} />
 * ────────────────────────────────────────────────────────────────────────
 *
 * Star geometry — 24 points alternating between r=45 (outer) and r=36
 * (inner) around (50,50). Pre-computed so we don't run trig at render. */

var STAR_12_POINTS =
  '50,5 59.32,15.23 72.5,11.03 75.46,24.54 88.97,27.5 84.77,40.68 '+
  '95,50 84.77,59.32 88.97,72.5 75.46,75.46 72.5,88.97 59.32,84.77 '+
  '50,95 40.68,84.77 27.5,88.97 24.54,75.46 11.03,72.5 15.23,59.32 '+
  '5,50 15.23,40.68 11.03,27.5 24.54,24.54 27.5,11.03 40.68,15.23';

export default function VerificationBadge(props) {
  if (props && props.show === false) return null;
  var size = (props && props.size) || 16;
  var extraStyle = (props && props.style) || {};
  return React.createElement('svg', {
    viewBox: '0 0 100 100',
    width: size,
    height: size,
    'aria-label': 'Verified',
    style: Object.assign({
      display: 'inline-block',
      verticalAlign: 'middle',
      flexShrink: 0,
      /* The "shining" glow — soft pink halo around the star. */
      filter: 'drop-shadow(0 0 ' + Math.max(3, Math.floor(size/4)) + 'px rgba(232,77,154,0.55))',
    }, extraStyle),
  },
    React.createElement('defs', null,
      React.createElement('linearGradient', { id:'ringinVBg', x1:'0', y1:'0', x2:'1', y2:'1' },
        React.createElement('stop', { offset:'0%',   stopColor:'#E84D9A' }),
        React.createElement('stop', { offset:'50%',  stopColor:'#C44ED8' }),
        React.createElement('stop', { offset:'100%', stopColor:'#7B6EFF' })
      )
    ),
    React.createElement('polygon', {
      points: STAR_12_POINTS,
      fill: 'url(#ringinVBg)',
      stroke: 'rgba(255,255,255,0.35)',
      strokeWidth: 1.5,
      strokeLinejoin: 'round',
    }),
    /* White tick — proportional to the badge size. */
    React.createElement('path', {
      d: 'M 30 50 L 44 64 L 70 36',
      stroke: '#fff',
      strokeWidth: 9,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fill: 'none',
    })
  );
}
