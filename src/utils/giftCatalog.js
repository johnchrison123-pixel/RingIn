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

// giftColor(gift) → { base, g1, g2 } neon-burst palette for the in-call gift pop.
// Pure + synchronous, no DB. Resolution order:
//   (a) an explicit gift.color (tolerates the column not existing yet),
//   (b) a hero-gift key/icon override (heart/dil/pyaar/love → pink→yellow),
//   (c) a category palette, (d) the brand-violet default.
var _CAT_COLORS = {
  Love:      { base:'#FF4D9A', g1:'#FF4D9A', g2:'#FFD93D' },
  Romance:   { base:'#FF4D9A', g1:'#FF4D9A', g2:'#FFD93D' },
  Flex:      { base:'#FFC83D', g1:'#FFC83D', g2:'#FF8A3D' },
  Luxury:    { base:'#FFC83D', g1:'#FFC83D', g2:'#FF8A3D' },
  Legendary: { base:'#7B6EFF', g1:'#7B6EFF', g2:'#E84D9A' },
  Epic:      { base:'#7B6EFF', g1:'#7B6EFF', g2:'#E84D9A' },
  Festive:   { base:'#FF8A3D', g1:'#FF8A3D', g2:'#FFD93D' },
};
export function giftColor(gift){
  var def = { base:'#7B6EFF', g1:'#7B6EFF', g2:'#E84D9A' };
  if (!gift) return def;
  // (a) explicit per-gift color (future gift_catalog.color column)
  if (gift.color && gift.color.base) return gift.color;
  // (b) hero-gift override — heart/love family glows pink→yellow like the reference
  var hay = String((gift.gift_key||'') + ' ' + (gift.icon||gift.emoji||'') + ' ' + (gift.name||'')).toLowerCase();
  if (hay.indexOf('heart') >= 0 || hay.indexOf('dil') >= 0 || hay.indexOf('pyaar') >= 0 || hay.indexOf('love') >= 0) {
    return { base:'#FF7AC0', g1:'#FF4D9A', g2:'#FFD93D' };
  }
  // (c) category palette
  if (gift.category && _CAT_COLORS[gift.category]) return _CAT_COLORS[gift.category];
  // (d) brand-violet default
  return def;
}
