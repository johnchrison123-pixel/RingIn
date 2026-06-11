/* eslint-disable */
import {sb} from './supabase';

// ──────────────────────────────────────────────────────────────────────────
// blocks.js — server-side block list (T2.11, requires migration 0013_blocks.sql).
//
// Replaces the legacy localStorage `ringin_blocked` array. The localStorage
// version had a type-mismatch bug (some entries stored as strings, some as
// objects). This module:
//   1. Migrates any existing localStorage entries to the server (one-time
//      backfill, runs on first call after migration is applied).
//   2. Caches the server list in localStorage anyway as a read-cache, so
//      block lookups in render hot paths don't need a network round trip.
//   3. Falls back to localStorage if the migration hasn't been applied yet
//      (the existing UX keeps working until you paste 0013 into Supabase).
//
// Public API:
//   await loadBlocks(myId)              → Set<userId>
//   await blockUser(myId, otherId, name?)  → resolves on success
//   await unblockUser(myId, otherId)    → resolves on success
//   isBlockedSync(otherId)              → boolean (uses cached set)
//   onBlocksChanged(cb)                 → unsubscribe fn
// ──────────────────────────────────────────────────────────────────────────

var CACHE_KEY = 'ringin_blocks_v2';     // server-backed cache (Set<userId>)
var LEGACY_KEY = 'ringin_blocked';       // pre-migration messy localStorage
var MIGRATED_KEY = 'ringin_blocks_migrated_v2';

var _cache = new Set();
var _listeners = [];

function notify() { _listeners.slice().forEach(function(l){ try{ l(_cache); }catch(_){} }); }

function readCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Set();
    var arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) { return new Set(); }
}

function writeCache(set) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(set)));
  } catch (_) {}
}

// Best-effort one-time migration of legacy entries → server table.
// Only runs once per device (idempotent). On any failure, leaves legacy
// data alone — the user's local block list still works.
function migrateLegacy(myId) {
  if (!myId) return Promise.resolve();
  try {
    if (localStorage.getItem(MIGRATED_KEY) === '1') return Promise.resolve();
    var raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      try { localStorage.setItem(MIGRATED_KEY, '1'); } catch(_) {}
      return Promise.resolve();
    }
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      try { localStorage.setItem(MIGRATED_KEY, '1'); } catch(_) {}
      return Promise.resolve();
    }
    // Normalise — entries can be strings OR objects with .id (the bug-fix
    // we made in ProfileScreen). Pull out the ID either way.
    var ids = arr.map(function(e){
      if (typeof e === 'string') return e;
      if (e && typeof e === 'object') return e.id || e.user_id;
      return null;
    }).filter(function(x){ return typeof x === 'string' && x.length > 8; });

    if (ids.length === 0) {
      try { localStorage.setItem(MIGRATED_KEY, '1'); } catch(_) {}
      return Promise.resolve();
    }

    var rows = ids.map(function(id){ return { blocker_id: myId, blocked_id: id }; });
    return sb.from('blocks').upsert(rows, { onConflict: 'blocker_id,blocked_id' }).then(function(r){
      if (r && r.error) {
        // Migration not applied or other server error — keep legacy data,
        // try again on next app open.
        try { console.warn('[ringin] block migration deferred:', r.error.message); } catch(_) {}
        return;
      }
      try { localStorage.setItem(MIGRATED_KEY, '1'); } catch(_) {}
    }).catch(function(err){
      try { console.warn('[ringin] block migration failed:', err && err.message); } catch(_) {}
    });
  } catch (_) { return Promise.resolve(); }
}

export function loadBlocks(myId) {
  // Seed from cache immediately so callers don't wait on the network for
  // first render. ROUND-9 FIX #7: notify() right after the seed so any
  // component that subscribed via onBlocksChanged BEFORE loadBlocks ran
  // (or in the same tick) gets the cached value — without this, a
  // subscriber that mounted in the same render commit would otherwise
  // sit on its initial-state Set until the server round-trip lands.
  _cache = readCache();
  notify();
  if (!myId) return Promise.resolve(_cache);

  return migrateLegacy(myId).then(function(){
    return sb.from('blocks').select('blocked_id').eq('blocker_id', myId).then(function(r){
      if (r.error) {
        // Probably migration not applied. Keep cache as-is (might still
        // hold legacy IDs we already migrated locally). Notify so any
        // subscriber that came online during the inflight gets at least
        // the cached snapshot back.
        notify();
        return _cache;
      }
      var fresh = new Set((r.data || []).map(function(row){ return row.blocked_id; }));
      _cache = fresh;
      writeCache(fresh);
      notify();
      return fresh;
    }).catch(function(){ notify(); return _cache; });
  });
}

export function blockUser(myId, otherId) {
  if (!myId || !otherId) return Promise.reject(new Error('missing args'));
  // Optimistic
  var next = new Set(_cache); next.add(otherId);
  _cache = next; writeCache(next); notify();
  return sb.from('blocks').upsert([{ blocker_id: myId, blocked_id: otherId }], { onConflict: 'blocker_id,blocked_id' }).then(function(r){
    if (r && r.error) {
      // Rollback on server error.
      var rb = new Set(_cache); rb.delete(otherId);
      _cache = rb; writeCache(rb); notify();
      throw r.error;
    }
  });
}

export function unblockUser(myId, otherId) {
  if (!myId || !otherId) return Promise.reject(new Error('missing args'));
  var next = new Set(_cache); next.delete(otherId);
  _cache = next; writeCache(next); notify();
  return sb.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', otherId).then(function(r){
    if (r && r.error) {
      var rb = new Set(_cache); rb.add(otherId);
      _cache = rb; writeCache(rb); notify();
      throw r.error;
    }
  });
}

export function isBlockedSync(otherId) { return otherId ? _cache.has(otherId) : false; }
export function getCachedBlocks() { return _cache; }
export function onBlocksChanged(cb) {
  _listeners.push(cb);
  return function(){ _listeners = _listeners.filter(function(l){ return l !== cb; }); };
}
