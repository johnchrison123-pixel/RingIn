/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// coinBalance.js — single source of truth for the user's coin balance.
//
// Before this hook existed, each screen that showed the wallet chip
// (HomeScreen, MessagesScreen, SearchScreen, ProfileScreen, WalletScreen)
// loaded `profiles.coins` independently on mount. A purchase in
// WalletScreen updated only that screen — the chip on Home and Messages
// stayed stuck on the old number until you killed the app.
//
// This hook fixes that by:
//   1. Reading the cached value from localStorage on mount for instant paint.
//   2. Fetching fresh from Supabase on mount.
//   3. Subscribing to a custom window event 'ringin:coin-balance' so any
//      screen that calls setSharedCoinBalance() propagates to ALL hook
//      instances in the same tab (within a render frame).
//   4. Subscribing to Supabase realtime UPDATEs on the profiles row so
//      cross-device / call-deduct / promotion-credit pushes show up live.
//
// Usage:
//   var balance = useCoinBalance(userId, supabase);     // reactive value
//   setSharedCoinBalance(newValue);                     // after a purchase / call deduct
// ──────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { sb as defaultClient } from './supabase';

// FIX #1: per-user STORAGE_KEY. Previously a single global
// 'ringin_coin_balance' key was shared across ALL users on a device — so
// logging out + logging in as a different account showed the previous
// user's balance until the network fetch landed (and could overwrite the
// new user's value if the previous user's stale cache was higher). Now
// every user gets their own namespaced key, with a legacy-key fallback
// so existing single-user installs don't see a "0 coins" flash on first
// load after this deploy.
var LEGACY_STORAGE_KEY = 'ringin_coin_balance';
var STORAGE_KEY_PREFIX = 'ringin_coin_balance_';
var EVENT_NAME = 'ringin:coin-balance';

function getStorageKey(userId){
  return STORAGE_KEY_PREFIX + (userId || 'anon');
}

// Read the cached balance synchronously so the chip can paint a
// reasonable number before any network call lands.
// FIX #1: takes a userId now. Falls back to the legacy global key on
// first read (older installs) and copies the value forward for a real
// userId. When userId is null/undefined (called during login bootstrap),
// still consult the legacy key so the chip doesn't flash 0 — but DON'T
// write it back to a per-user key yet (we don't know which user).
function readCachedBalance(userId){
  try {
    var key = getStorageKey(userId);
    var v = localStorage.getItem(key);
    if (v == null || v === '') {
      // Legacy fallback — never delete the legacy key, let it linger
      // for compatibility per the migration expand-contract rule.
      var legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy != null && legacy !== '') {
        var ln = Number(legacy);
        if (!isNaN(ln)) {
          // Only forward-write to per-user key when we have a real
          // userId (avoid polluting the 'anon' key with another user's
          // value if userId hasn't arrived yet).
          if (userId) {
            try { localStorage.setItem(key, String(ln)); } catch(_){}
          }
          return ln;
        }
      }
      return 0;
    }
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  } catch (_) {
    return 0;
  }
}

function writeCachedBalance(userId, n){
  try { localStorage.setItem(getStorageKey(userId), String(n)); } catch (_) {}
}

/**
 * Broadcast a new coin balance to every useCoinBalance() consumer in this tab,
 * cache it in localStorage, and (optionally) write it back to Supabase.
 *
 * Call this from anywhere that changes the balance (WalletScreen purchase,
 * post-call deduction, daily-bonus credit, admin grant, etc).
 *
 * @param {number} newBalance  The user's new coin total
 * @param {object} opts        { writeToDb: boolean, userId: string, supabase?: client }
 */
export function setSharedCoinBalance(newBalance, opts){
  opts = opts || {};
  var n = Number(newBalance);
  if (isNaN(n)) return;
  // FIX #1: write to BOTH the per-user key (if we know whose balance this
  // is) AND the legacy global key so any code still reading the legacy
  // key sees the new value during the migration window.
  writeCachedBalance(opts.userId || null, n);
  try { localStorage.setItem(LEGACY_STORAGE_KEY, String(n)); } catch(_){}
  try {
    var ev = new CustomEvent(EVENT_NAME, { detail: { balance: n, userId: opts.userId || null } });
    window.dispatchEvent(ev);
  } catch (_) {
    // Old browsers — fall back to a regular Event (no detail).
    try { window.dispatchEvent(new Event(EVENT_NAME)); } catch (_) {}
  }
  if (opts.writeToDb && opts.userId) {
    var client = opts.supabase || defaultClient;
    try {
      var p = client.from('profiles').update({ coins: n }).eq('id', opts.userId);
      if (p && p.then) p.then(function(){});
      if (p && p.catch) p.catch(function(){});
    } catch (_) {}
  }
}

/**
 * React hook — returns the current coin balance for the given user, kept
 * in sync via localStorage cache + Supabase fetch + window event + Supabase
 * realtime UPDATE subscription.
 *
 * Pass `null` userId during loading; the hook will just return the cached
 * value until a real id arrives.
 *
 * @param {string|null} userId
 * @param {object}      supabase  Optional client override (defaults to sb)
 * @returns {number} balance
 */
export function useCoinBalance(userId, supabase){
  var client = supabase || defaultClient;
  // FIX #1: seed the cache read with userId so we don't show another
  // user's leftover balance from before logout.
  var balS = useState(function(){ return readCachedBalance(userId); });
  var balance = balS[0];
  var setBalance = balS[1];

  // Custom event listener — within-tab sync. Fired by setSharedCoinBalance.
  useEffect(function(){
    function onEvent(ev){
      var n = (ev && ev.detail && typeof ev.detail.balance === 'number')
        ? ev.detail.balance
        : readCachedBalance(userId);
      setBalance(n);
    }
    window.addEventListener(EVENT_NAME, onEvent);
    // Cross-tab sync (PWA across two tabs, or after a hard reload).
    // FIX #1: react to the per-user storage key (or the legacy key for
    // back-compat) instead of a single fixed STORAGE_KEY.
    function onStorage(e){
      if (!e || !e.key) return;
      var myKey = getStorageKey(userId);
      if (e.key === myKey || e.key === LEGACY_STORAGE_KEY) setBalance(readCachedBalance(userId));
    }
    window.addEventListener('storage', onStorage);
    return function(){
      window.removeEventListener(EVENT_NAME, onEvent);
      window.removeEventListener('storage', onStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Initial fetch from Supabase + realtime subscription per user.
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    // FIX #1: when userId arrives, re-read the cache for that user (the
    // initial useState seed may have been done with null userId during
    // login bootstrap, returning 0).
    var seeded = readCachedBalance(userId);
    if (seeded) setBalance(seeded);

    // FIX #2: .maybeSingle() instead of .single(). A brand-new user with
    // no `profiles` row yet would error with PGRST116 ("row not found")
    // and leave the balance stuck at 0 forever (the error swallows the
    // first .then()). .maybeSingle() returns {data: null, error: null}
    // for the no-row case — we treat that as "new user, 0 balance".
    var fetchPromise = client.from('profiles').select('coins').eq('id', userId).maybeSingle();
    if (fetchPromise && fetchPromise.then) {
      fetchPromise.then(function(r){
        // FIX #3: guard the write so a slow fetch from a previous userId
        // can't write into the new userId's cache after switching users.
        if (cancelled) return;
        if (r && r.error) {
          // PGRST116 = no row found; treat as 0 (new user, no error).
          if (r.error.code !== 'PGRST116') return;
        }
        if (r && r.data && r.data.coins != null) {
          var n = Number(r.data.coins) || 0;
          writeCachedBalance(userId, n);
          setBalance(n);
        }
        // r.data === null with no error → new user, leave at cached (likely 0).
      });
      if (fetchPromise.catch) {
        fetchPromise.catch(function(){ /* offline / network — keep cached value */ });
      }
    }

    // Realtime — listen for any UPDATE on this user's profile row and
    // pull the new coins value if it changed. This catches:
    //   - Calls deducting coins server-side
    //   - Other devices buying coins
    //   - Promo / referral credits applied by edge functions
    //
    // FIX #4: append a per-instance unique suffix to the channel name.
    // When multiple components (HomeScreen chip + MessagesScreen chip +
    // WalletScreen) all subscribe `coin-balance-<userId>`, each cleanup
    // calls removeChannel on the SAME topic — which tears down the
    // sibling subscriptions too. Per-instance suffix means each instance
    // only removes its own channel.
    var ch = null;
    var channelName = 'coin-balance-' + userId + '-' + (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    );
    try {
      ch = client.channel(channelName)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'id=eq.' + userId
        }, function(payload){
          // FIX #3: same guard — don't write a previous-user's realtime
          // event into a now-different-user's cache.
          if (cancelled) return;
          var newCoins = payload && payload.new && payload.new.coins;
          if (newCoins != null) {
            var n = Number(newCoins) || 0;
            writeCachedBalance(userId, n);
            setBalance(n);
          }
        })
        .subscribe();
    } catch (_) {}

    return function(){
      cancelled = true;
      if (ch && client.removeChannel) {
        try { client.removeChannel(ch); } catch (_) {}
      }
    };
  }, [userId]);

  return balance;
}

// Sync helper — useful for non-hook callers that need to know the latest
// balance synchronously (e.g. a "do you have enough coins?" check before
// opening a paywall modal).
// FIX #1: takes an optional userId. When called with a userId, returns
// the per-user cached value (with legacy-key fallback). When called
// argument-less (back-compat), falls back to the legacy global key — so
// existing callers that have no userId on hand still get the last known
// balance from any user on this device.
export function getCachedCoinBalance(userId){
  if (userId) return readCachedBalance(userId);
  // No userId — try legacy key directly (preserves pre-fix behavior).
  try {
    var v = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (v == null || v === '') return 0;
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  } catch (_) { return 0; }
}
