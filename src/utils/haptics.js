/* eslint-disable */
// haptics.js — Capacitor haptics helper with safe web fallback.
//
// Each function is a no-op when:
//   - Running in a plain browser (not Capacitor native shell), or
//   - The Haptics plugin isn't registered, or
//   - Any error occurs at call time.
//
// Impact styles match @capacitor/haptics ImpactStyle enum:
//   HEAVY | MEDIUM | LIGHT
// Notification styles match NotificationType enum:
//   SUCCESS | WARNING | ERROR
//
// Usage:
//   import { hapticTap, hapticMedium, hapticSuccess } from '../utils/haptics';
//   hapticTap();       // tab taps, button presses
//   hapticMedium();    // like, send, follow
//   hapticHeavy();     // destructive actions
//   hapticSuccess();   // positive confirmation
//   hapticWarning();   // caution feedback
//   hapticError();     // failure / rejection

function isNative() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_) {
    return false;
  }
}

function getHapticsPlugin() {
  try {
    var Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
    return Plugins.Haptics || null;
  } catch (_) {
    return null;
  }
}

function impact(style) {
  try {
    if (!isNative()) return;
    var H = getHapticsPlugin();
    if (H && typeof H.impact === 'function') {
      H.impact({ style: style }).catch(function() {});
    }
  } catch (_) {}
}

function notification(type) {
  try {
    if (!isNative()) return;
    var H = getHapticsPlugin();
    if (H && typeof H.notification === 'function') {
      H.notification({ type: type }).catch(function() {});
    }
  } catch (_) {}
}

// Light — tab taps, button presses, selection.
function hapticTap() { impact('LIGHT'); }

// Medium — like, send, follow, toggle.
function hapticMedium() { impact('MEDIUM'); }

// Heavy — destructive actions (delete, block).
function hapticHeavy() { impact('HEAVY'); }

// Notification: SUCCESS — positive confirmation, payment, match.
function hapticSuccess() { notification('SUCCESS'); }

// Notification: WARNING — caution dialog, low balance.
function hapticWarning() { notification('WARNING'); }

// Notification: ERROR — failed action, invalid input.
function hapticError() { notification('ERROR'); }

module.exports = {
  hapticTap: hapticTap,
  hapticMedium: hapticMedium,
  hapticHeavy: hapticHeavy,
  hapticSuccess: hapticSuccess,
  hapticWarning: hapticWarning,
  hapticError: hapticError,
};
