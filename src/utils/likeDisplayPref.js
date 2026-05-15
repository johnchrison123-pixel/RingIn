/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// likeDisplayPref — per-user "Hide like counts" preference (localStorage).
//
// Mirrors Instagram's 2021 setting: when ON, the viewer sees "Liked by
// Alice and others" instead of a number. Doesn't change anything
// server-side — the post itself still records likes; only the rendered
// count is hidden for the user who flipped this switch.
//
// Stored under `ringin_hide_likes` as a JSON boolean. Cross-tab updates
// via the `storage` event + a custom `ringin-hide-likes-changed` event
// fired by the setter so React components in the same tab also re-render.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

var KEY = 'ringin_hide_likes';
var EVT = 'ringin-hide-likes-changed';

export function getHideLikes() {
  try {
    var raw = localStorage.getItem(KEY);
    return raw === 'true' || raw === '1';
  } catch (_) { return false; }
}

export function setHideLikes(v) {
  try {
    if (v) localStorage.setItem(KEY, 'true');
    else localStorage.removeItem(KEY);
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { value: !!v } })); } catch (_) {}
  } catch (_) {}
}

// React hook — returns [hide, setHide]. Re-renders on cross-tab + same-tab
// changes so toggling in Settings updates the feed instantly.
export function useHideLikes() {
  var s = useState(getHideLikes());
  var hide = s[0]; var setLocal = s[1];

  useEffect(function() {
    function onStorage(ev) {
      if (ev && ev.key === KEY) setLocal(getHideLikes());
    }
    function onCustom(ev) {
      var v = ev && ev.detail && ev.detail.value;
      setLocal(typeof v === 'boolean' ? v : getHideLikes());
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener(EVT, onCustom);
    return function() {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVT, onCustom);
    };
  }, []);

  function setBoth(v) {
    setHideLikes(v);
    setLocal(!!v);
  }
  return [hide, setBoth];
}
