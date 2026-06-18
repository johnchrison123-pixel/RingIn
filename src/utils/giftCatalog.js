/* eslint-disable */
// giftCatalog.js — loads the DB-driven virtual-gift catalog (migration 0054)
// once per session and caches it. The catalog is server-authoritative; this is
// read-only (price/payout are enforced inside the send_gift RPC, never here).
import { sb as defaultClient } from './supabase';

var _cache = null;       // array of gift rows
var _inflight = null;    // de-dupe concurrent loads

// Resolves to the gift array (empty array on any failure / before migration runs).
export function loadGiftCatalog(client){
  var c = client || defaultClient;
  if (_cache) return Promise.resolve(_cache);
  if (_inflight) return _inflight;
  _inflight = c.from('gift_catalog').select('*').eq('active', true)
    .order('sort', { ascending: true })
    .then(function(r){
      _cache = (r && !r.error && Array.isArray(r.data)) ? r.data : [];
      _inflight = null;
      return _cache;
    })
    .catch(function(){ _inflight = null; return []; });
  return _inflight;
}

export function giftByKey(key){
  return (_cache || []).find(function(g){ return g.gift_key === key; }) || null;
}

export function cachedGifts(){ return _cache || []; }
