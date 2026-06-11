/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ConfirmSheet — bottom-sheet replacement for window.confirm().
// Uses motion/react for spring-animated entry/exit. Rendered via portal-style
// fixed overlay so it's unaffected by parent stacking contexts.
//
// Props:
//   open          boolean — controls visibility
//   title         string  — e.g. "Delete post?"
//   message       string  — e.g. "This can't be undone."
//   confirmLabel  string  — button text (default "Confirm")
//   cancelLabel   string  — button text (default "Cancel")
//   destructive   boolean — confirm button red (#dc2626) vs green (#22c55e)
//   onConfirm     function
//   onCancel      function

function ConfirmSheet(props) {
  // All hooks before conditional returns.
  var openProp = props.open;
  var title = props.title || '';
  var message = props.message || '';
  var confirmLabel = props.confirmLabel || 'Confirm';
  var cancelLabel = props.cancelLabel || 'Cancel';
  var destructive = !!props.destructive;
  var onConfirm = props.onConfirm || function() {};
  var onCancel = props.onCancel || function() {};

  if (!openProp) return null;

  var backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 9000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  };

  var sheetStyle = {
    width: '100%',
    maxWidth: '480px',
    background: 'rgba(15, 18, 26, 0.96)',
    borderRadius: '18px 18px 0 0',
    padding: '20px',
    color: '#e8e8ee',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  var titleStyle = {
    fontWeight: 700,
    fontSize: '17px',
    marginBottom: message ? '8px' : '18px',
    color: '#e8e8ee',
  };

  var messageStyle = {
    fontSize: '14px',
    color: '#999aaa',
    marginBottom: '20px',
    lineHeight: 1.45,
  };

  var confirmBtnStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: destructive ? '#dc2626' : '#22c55e',
    color: '#fff',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: '10px',
  };

  var cancelBtnStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#e8e8ee',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  var springBtn = { type: 'spring', stiffness: 300, damping: 18 };
  var springSheet = { type: 'spring', stiffness: 250, damping: 28 };

  return React.createElement('div', { style: backdropStyle, onClick: onCancel },
    React.createElement(AnimatePresence, null,
      React.createElement(motion.div, {
        key: 'confirm-sheet',
        style: sheetStyle,
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: springSheet,
        onClick: function(e) { e.stopPropagation(); },
      },
        title
          ? React.createElement('div', { style: titleStyle }, title)
          : null,
        message
          ? React.createElement('div', { style: messageStyle }, message)
          : null,
        React.createElement(motion.button, {
          style: confirmBtnStyle,
          whileTap: { scale: 0.97 },
          transition: springBtn,
          onClick: onConfirm,
        }, confirmLabel),
        React.createElement(motion.button, {
          style: cancelBtnStyle,
          whileTap: { scale: 0.97 },
          transition: springBtn,
          onClick: onCancel,
        }, cancelLabel)
      )
    )
  );
}

export { ConfirmSheet };
export default ConfirmSheet;
