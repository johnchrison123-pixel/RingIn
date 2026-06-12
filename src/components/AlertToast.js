/* eslint-disable */
import React, { useEffect } from 'react';
import { motion } from 'motion/react';

// AlertToast — bottom-center toast replacement for window.alert().
// Auto-dismisses after 3 seconds, calling onDone.
//
// Props:
//   message  string
//   onDone   function — called after 3 s (or when unmounted)
//   tone     'info' | 'warning' | 'error'  (default 'info')

var TONE_BG = {
  info:    'rgba(20, 24, 36, 0.96)',
  warning: 'rgba(245, 158, 11, 0.95)',
  error:   'rgba(220, 38, 38, 0.95)',
};

function AlertToast(props) {
  var message = props.message || '';
  var onDone = props.onDone || function() {};
  var tone = props.tone || 'info';
  var bg = TONE_BG[tone] || TONE_BG.info;

  // Auto-dismiss.
  useEffect(function() {
    var t = setTimeout(onDone, 3000);
    return function() { clearTimeout(t); };
  }, []);

  var containerStyle = {
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '340px',
    width: 'calc(100% - 32px)',
    padding: '12px 18px',
    borderRadius: '12px',
    background: bg,
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1.45,
    fontFamily: 'inherit',
    zIndex: 9500,
    pointerEvents: 'none',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    textAlign: 'center',
  };

  return React.createElement(motion.div, {
    style: containerStyle,
    initial: { y: 30, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 30, opacity: 0 },
    transition: { type: 'spring', stiffness: 280, damping: 24 },
  }, message);
}

export { AlertToast };
export default AlertToast;
