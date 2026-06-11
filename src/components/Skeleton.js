/* eslint-disable */
import React, { useEffect } from 'react';

// Skeleton — shimmer placeholder for loading states.
//
// Props:
//   width   string | number  e.g. '100%' or 200
//   height  string | number  e.g. 16 or '1em'
//   radius  number           border-radius in px (default 8)
//   style   object           extra style overrides (optional)
//
// Also exports SkeletonRow — three stacked Skeleton rows as a convenience.

var KEYFRAMES_ID = 'ringin-skeleton-keyframes';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  try {
    var style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = [
      '@keyframes ringinShimmer {',
      '  0%   { background-position: 200% 0; }',
      '  100% { background-position: -200% 0; }',
      '}',
    ].join('');
    document.head.appendChild(style);
  } catch (_) {}
}

function Skeleton(props) {
  var width  = props.width  != null ? props.width  : '100%';
  var height = props.height != null ? props.height : 16;
  var radius = props.radius != null ? props.radius : 8;
  var extraStyle = props.style || {};

  // Inject keyframes once per page load.
  useEffect(function() {
    injectKeyframes();
  }, []);

  var skeletonStyle = Object.assign({
    width: typeof width === 'number' ? width + 'px' : width,
    height: typeof height === 'number' ? height + 'px' : height,
    borderRadius: radius + 'px',
    background: 'linear-gradient(90deg, #1a1d28 0%, #232735 50%, #1a1d28 100%)',
    backgroundSize: '200% 100%',
    animation: 'ringinShimmer 1.4s linear infinite',
    display: 'block',
    flexShrink: 0,
  }, extraStyle);

  return React.createElement('span', { style: skeletonStyle });
}

// SkeletonRow — three stacked rows for common list-item placeholders.
function SkeletonRow(props) {
  var gap = (props.gap != null) ? props.gap : 10;
  var wrapStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: gap + 'px',
    width: '100%',
  };
  return React.createElement('div', { style: wrapStyle },
    React.createElement(Skeleton, { width: '60%',  height: 14 }),
    React.createElement(Skeleton, { width: '100%', height: 14 }),
    React.createElement(Skeleton, { width: '80%',  height: 14 })
  );
}

export { Skeleton, SkeletonRow };
export default Skeleton;
