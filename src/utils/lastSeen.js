/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// lastSeen — periodic ping that updates `profiles.last_seen_at` for the
// current user. Drives the "Active 5m ago" / "Online" indicator that
// appears next to other users' names.
//
// Pattern:
// - On app foreground + every 60 sec while foregrounded: UPDATE the
//   profile row with last_seen_at = now().
// - On visibility change (tab hidden / app backgrounded): stop the ticker.
// - On visibility change back to visible: ping immediately + restart ticker.
//
// Privacy is enforced server-side via the `profile_last_seen` view
// (defined in supabase/migrations/0006_last_seen.sql). The view returns
// NULL when the viewer is not allowed to see the timestamp — so we never
// have to gatekeep client-side.
//
// Graceful fallback: if the column doesn't exist yet (migration 0006 not
// applied), the UPDATE silently fails and last_seen displays nothing.
// ──────────────────────────────────────────────────────────────────────────

import {sb} from './supabase';

var TICK_MS = 60 * 1000;
var _tickerId = null;
var _userId = null;
var _attached = false;
// FIX #13 — track the focus/blur/pagehide handlers we attach so we can
// remove them in stopLastSeen(). Previously these listeners leaked: every
// sign-in re-attached new closures while the old ones remained, and
// stopLastSeen() only touched the visibilitychange listener.
var _focusHandler = null;
var _blurHandler = null;
var _pagehideHandler = null;

function ping() {
  if (!_userId) return;
  try {
    sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', _userId).then(function(){});
  } catch (_) {}
}

function startTicker() {
  if (_tickerId) return; // already ticking — caller should ping separately if a fresh ping is desired
  // ping now
  if (_userId) ping();
  _tickerId = setInterval(function(){ if (_userId) ping(); }, TICK_MS);
}

function stopTicker() {
  if (_tickerId) { clearInterval(_tickerId); _tickerId = null; }
}

function onVis() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') {
    // FIX #5: ping immediately on visibility regain regardless of ticker state.
    // Previously startTicker() early-returned if _tickerId existed, so the
    // re-ping on focus never fired when the ticker was already running
    // (which happens often via the focus/blur listeners attached separately).
    if (_userId) ping();
    startTicker();
  } else {
    stopTicker();
  }
}

// Call once when the app boots (or when the user signs in).
export function startLastSeen(userId) {
  if (!userId) return;
  _userId = userId;
  if (!_attached) {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    if (typeof window !== 'undefined') {
      _focusHandler = startTicker;
      _blurHandler = stopTicker;
      // FIX #14 — sendBeacon('') is a no-op (empty URL does nothing). The
      // pagehide handler now just runs the regular ping(); the
      // visibilitychange handler already covers the common backgrounded case.
      _pagehideHandler = function(){ ping(); };
      window.addEventListener('focus', _focusHandler);
      window.addEventListener('blur', _blurHandler);
      window.addEventListener('pagehide', _pagehideHandler);
    }
    _attached = true;
  }
  startTicker();
}

export function stopLastSeen() {
  stopTicker();
  if (typeof document !== 'undefined' && _attached) document.removeEventListener('visibilitychange', onVis);
  // FIX #13 — also remove the window-level listeners we attached.
  if (typeof window !== 'undefined' && _attached) {
    if (_focusHandler) { window.removeEventListener('focus', _focusHandler); _focusHandler = null; }
    if (_blurHandler) { window.removeEventListener('blur', _blurHandler); _blurHandler = null; }
    if (_pagehideHandler) { window.removeEventListener('pagehide', _pagehideHandler); _pagehideHandler = null; }
  }
  _attached = false;
  _userId = null;
}

// Format a last_seen_at timestamp into a friendly relative string.
// Null → empty (privacy-restricted or never seen). Within 2 min → "Online".
// Within 60 min → "Active Nm ago". Within 24h → "Active Nh ago". Else
// "Active <date>".
export function formatLastSeen(iso) {
  if (!iso) return '';
  try {
    var t = new Date(iso).getTime();
    if (!t || isNaN(t)) return '';
    var diff = Math.max(0, Date.now() - t);
    var s = Math.floor(diff / 1000);
    if (s < 120) return 'Online';
    var m = Math.floor(s / 60);
    if (m < 60) return 'Active ' + m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return 'Active ' + h + 'h ago';
    var d = Math.floor(h / 24);
    if (d < 7) return 'Active ' + d + 'd ago';
    return 'Active ' + new Date(iso).toLocaleDateString();
  } catch (_) { return ''; }
}
