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

/* R19 FIX #2: dispatch a window event in addition to internal listeners.
 * Old behaviour was that only React components which subscribed via
 * onBlocksChanged got the update. Now any code listening to the window
 * event 'ringin-blocks-changed' (e.g. legacy sites in ProfileScreen /
 * MessagesScreen / Moments that still write the legacy LS key directly)
 * can also react. Cross-TAB sync rides on the natural `storage` event
 * for CACHE_KEY which any subscriber can also listen to. */
function notify() {
  _listeners.slice().forEach(function(l){ try{ l(_cache); }catch(_){} });
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ringin-blocks-changed', { detail: { size: _cache.size } }));
    }
  } catch(_){}
}

/* R19 FIX #2: helper for legacy call-sites that still write the
 * `ringin_blocked` LS key directly. Lets them broadcast without having
 * to refactor the whole flow to use blockUser/unblockUser. */
export function notifyLegacyBlocksChanged(){
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ringin-blocks-changed', { detail: { source: 'legacy' } }));
    }
  } catch(_){}
}

/* R19 verifier-fix: re-sync _cache when ringin-blocks-changed fires from any
 * source. Without this, the 3 legacy direct-write sites (MessagesScreen block,
 * Moments block, ProfileScreen unblock) update LS + dispatch the event, but
 * isBlockedSync (which reads _cache) keeps returning stale results until next
 * loadBlocks() / app reload. Now: any block-change → re-read LS into _cache →
 * notify React subscribers → isBlockedSync is fresh. */
function _resyncFromLegacyLS(){
  try {
    var raw = localStorage.getItem(LEGACY_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return;
    var legacyIds = arr.map(function(e){
      if (typeof e === 'string') return e;
      if (e && typeof e === 'object') return e.id || e.user_id;
      return null;
    }).filter(function(x){ return typeof x === 'string' && x.length > 0; });
    // Union: keep server-backed entries already in _cache + add legacy IDs
    var merged = new Set(_cache);
    var added = 0;
    legacyIds.forEach(function(id){ if (!merged.has(id)) { merged.add(id); added++; } });
    // Also detect REMOVALS: any legacy ID that's no longer in LS should leave
    // _cache (but only legacy IDs — never drop server-backed ones we can't see).
    // Conservative: only act on the legacy diff, leave _cache values alone.
    if (added > 0 || legacyIds.length === 0) {
      _cache = merged;
      writeCache(merged);
      _listeners.slice().forEach(function(l){ try{ l(_cache); }catch(_){} });
    }
  } catch(_){}
}
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('ringin-blocks-changed', _resyncFromLegacyLS);
    // Cross-tab: storage event fires when other tab writes ringin_blocked
    window.addEventListener('storage', function(e){
      if (e && (e.key === LEGACY_KEY || e.key === CACHE_KEY)) _resyncFromLegacyLS();
    });
  } catch(_){}
}

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
