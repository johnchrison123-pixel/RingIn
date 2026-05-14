/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// momentUsers — shared registry of user IDs who have an active moment.
//
// Drives the Instagram-style avatar ring (see src/components/AvatarRing.js).
// Every screen that renders user avatars wants the same answer to the
// question "does this user currently have a moment posted in the last 24h?".
// Rather than each screen running its own Supabase query, this module owns
// a single shared Set, fetches once, dedupes concurrent fetches, and
// notifies all subscribed components via the `useMomentUserIds` hook.
//
// Why a module-level Set rather than React context: avatars are rendered
// in DEEPLY nested children (post lists, comment threads, chat lists),
// and a context provider would need to wrap App.js and re-render all
// consumers on every change. A module-level cache + subscription pattern
// avoids prop drilling AND avoids context-induced re-renders.
//
// Public API:
//   useMomentUserIds()             - React hook → returns the current Set.
//                                    Triggers a fetch on first mount if
//                                    cache is stale (>5 min) or empty.
//   refreshMomentUserIds()         - Force-refetch. Returns a Promise.
//                                    De-duped — concurrent calls share
//                                    the same inflight request.
//   markMomentUser(userId)         - Optimistic insert: mark a user as
//                                    having an active moment immediately
//                                    (used after they post, before the
//                                    next Supabase fetch confirms it).
//   hasActiveMoment(userId)        - Sync check, no React involvement.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { sb } from './supabase';

// Cache TTL — re-fetch at most every 5 min. Moments expire after 24h so
// 5-min staleness is plenty for the UI; this avoids hammering Supabase
// every time a screen mounts.
var STALE_MS = 5 * 60 * 1000;

// Module-singleton cache.
var _ids = new Set();          // Set<userId>
var _fetchedAt = 0;            // epoch ms of last successful fetch
var _inflight = null;          // de-dupe concurrent refreshes
var _listeners = [];           // subscribed React components

function notify() {
  _listeners.slice().forEach(function(l){
    try { l(_ids); } catch (_) { /* listener fault is its own problem */ }
  });
}

export function hasActiveMoment(userId){
  if (!userId) return false;
  return _ids.has(userId);
}

// Refresh from Supabase. Returns a Promise that resolves with the latest
// Set. Concurrent calls share the same inflight request — safe to call
// from multiple components mounting in the same tick.
export function refreshMomentUserIds(){
  if (_inflight) return _inflight;
  var cutoffIso = new Date(Date.now() - 24*60*60*1000).toISOString();
  _inflight = sb
    .from('moments')
    .select('user_id')
    .gt('created_at', cutoffIso)
    .then(function(r){
      _inflight = null;
      // On error (e.g. table not yet created, RLS denial, network),
      // keep the existing cache. The avatar ring is a cosmetic feature
      // — failing silently here is far better than throwing into the
      // render path.
      if (r.error) return _ids;
      var next = new Set();
      (r.data || []).forEach(function(row){
        if (row && row.user_id) next.add(row.user_id);
      });
      _ids = next;
      _fetchedAt = Date.now();
      notify();
      return _ids;
    })
    .catch(function(){
      _inflight = null;
      return _ids;
    });
  return _inflight;
}

// Optimistic insert. Used right after a user posts a moment, so their
// own avatar gets a ring INSTANTLY without waiting for a fresh Supabase
// query (which would race with replication). Idempotent.
export function markMomentUser(userId){
  if (!userId || _ids.has(userId)) return;
  // Replace with a new Set so the reference changes — that's what makes
  // useMomentUserIds-consuming components actually re-render via setState.
  var next = new Set(_ids);
  next.add(userId);
  _ids = next;
  notify();
}

// React hook. Returns the current Set; component re-renders when the
// underlying cache changes. Triggers a refresh on first mount if stale.
export function useMomentUserIds(){
  var s = useState(_ids);
  var ids = s[0]; var setIds = s[1];

  useEffect(function(){
    function listener(newIds){ setIds(newIds); }
    _listeners.push(listener);
    // Fetch if we've never fetched, or our cache is stale.
    var stale = (Date.now() - _fetchedAt) > STALE_MS;
    if (stale) refreshMomentUserIds();
    return function(){
      _listeners = _listeners.filter(function(l){ return l !== listener; });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ids;
}
