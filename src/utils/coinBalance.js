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

var STORAGE_KEY = 'ringin_coin_balance';
var EVENT_NAME = 'ringin:coin-balance';

// Read the cached balance synchronously so the chip can paint a
// reasonable number before any network call lands.
function readCachedBalance(){
  try {
    var v = localStorage.getItem(STORAGE_KEY);
    if (v == null || v === '') return 0;
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  } catch (_) {
    return 0;
  }
}

function writeCachedBalance(n){
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
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
  writeCachedBalance(n);
  try {
    var ev = new CustomEvent(EVENT_NAME, { detail: { balance: n } });
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
  var balS = useState(function(){ return readCachedBalance(); });
  var balance = balS[0];
  var setBalance = balS[1];

  // Custom event listener — within-tab sync. Fired by setSharedCoinBalance.
  useEffect(function(){
    function onEvent(ev){
      var n = (ev && ev.detail && typeof ev.detail.balance === 'number')
        ? ev.detail.balance
        : readCachedBalance();
      setBalance(n);
    }
    window.addEventListener(EVENT_NAME, onEvent);
    // Cross-tab sync (PWA across two tabs, or after a hard reload).
    function onStorage(e){
      if (e && e.key === STORAGE_KEY) setBalance(readCachedBalance());
    }
    window.addEventListener('storage', onStorage);
    return function(){
      window.removeEventListener(EVENT_NAME, onEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Initial fetch from Supabase + realtime subscription per user.
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    var fetchPromise = client.from('profiles').select('coins').eq('id', userId).single();
    if (fetchPromise && fetchPromise.then) {
      fetchPromise.then(function(r){
        if (cancelled) return;
        if (r && r.data && r.data.coins != null) {
          var n = Number(r.data.coins) || 0;
          writeCachedBalance(n);
          setBalance(n);
        }
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
    var ch = null;
    try {
      ch = client.channel('coin-balance-' + userId)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'id=eq.' + userId
        }, function(payload){
          if (cancelled) return;
          var newCoins = payload && payload.new && payload.new.coins;
          if (newCoins != null) {
            var n = Number(newCoins) || 0;
            writeCachedBalance(n);
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
export function getCachedCoinBalance(){
  return readCachedBalance();
}
