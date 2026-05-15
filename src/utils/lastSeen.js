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

function ping() {
  if (!_userId) return;
  try {
    sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', _userId).then(function(){});
  } catch (_) {}
}

function startTicker() {
  if (_tickerId) return;
  ping(); // immediate
  _tickerId = setInterval(ping, TICK_MS);
}

function stopTicker() {
  if (_tickerId) { clearInterval(_tickerId); _tickerId = null; }
}

function onVis() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') startTicker();
  else stopTicker();
}

// Call once when the app boots (or when the user signs in).
export function startLastSeen(userId) {
  if (!userId) return;
  _userId = userId;
  if (!_attached) {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', startTicker);
      window.addEventListener('blur', stopTicker);
      // Best-effort "I'm leaving" — fire a final ping on pagehide.
      window.addEventListener('pagehide', function(){
        try { navigator.sendBeacon && navigator.sendBeacon(''); } catch(_) {}
        ping();
      });
    }
    _attached = true;
  }
  startTicker();
}

export function stopLastSeen() {
  stopTicker();
  if (typeof document !== 'undefined' && _attached) document.removeEventListener('visibilitychange', onVis);
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
