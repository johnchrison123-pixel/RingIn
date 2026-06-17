/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// cosmetics.js — coin-bought profile customization (tags / frames / stickers
// / themes). See migration 0049_cosmetics.sql.
//
// The DB (catalog_items) is the source of truth for what exists, the price,
// and a small `payload` (color / glyph / css-key). This module:
//   1. loads + caches the catalog (localStorage, instant paint),
//   2. resolves an equipped id → its catalog row,
//   3. renders the visuals (tag pill, neon sticker, PFP frame incl. wings,
//      theme accent vars) from the payload — so real 3D art can swap in
//      later by editing payload, no code change.
//
// Everything is defensive: if the catalog hasn't loaded or the 0049 migration
// hasn't run, helpers return null and the profile renders normally.
// ──────────────────────────────────────────────────────────────────────────
import React from 'react';
import { sb as defaultClient } from './supabase';

var CACHE_KEY = 'ringin_cosmetics_catalog_v1';
var _mem = null; // { byId, byKind, rows }

function indexCatalog(rows){
  var byId = {};
  var byKind = { tag:[], frame:[], sticker:[], theme:[] };
  (rows || []).forEach(function(r){
    byId[r.id] = r;
    if (byKind[r.kind]) byKind[r.kind].push(r);
  });
  return { byId: byId, byKind: byKind, rows: rows || [] };
}

export function getCachedCatalog(){
  if (_mem) return _mem;
  try {
    var s = localStorage.getItem(CACHE_KEY);
    if (s) { _mem = indexCatalog(JSON.parse(s)); return _mem; }
  } catch(_){}
  return null;
}

// Fetch the catalog from Supabase, cache it, return the indexed structure.
// Resolves to the cached/empty structure on any failure (forward-compatible).
export function loadCatalog(supabase){
  var client = supabase || defaultClient;
  return new Promise(function(resolve){
    try {
      client.from('catalog_items').select('*').eq('active', true)
        .order('sort', { ascending: true })
        .then(function(r){
          if (r && !r.error && Array.isArray(r.data)) {
            _mem = indexCatalog(r.data);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(r.data)); } catch(_){}
            resolve(_mem);
          } else {
            resolve(getCachedCatalog() || indexCatalog([]));
          }
        })
        .catch(function(){ resolve(getCachedCatalog() || indexCatalog([])); });
    } catch(_){ resolve(getCachedCatalog() || indexCatalog([])); }
  });
}

export function cosmeticById(id){
  if (!id) return null;
  var cat = getCachedCatalog();
  return (cat && cat.byId[id]) ? cat.byId[id] : null;
}

// Resolve profiles.equipped[kind] (an id) → catalog row, or null.
export function equippedItem(equipped, kind){
  if (!equipped) return null;
  var id = equipped[kind];
  if (!id) return null;
  return cosmeticById(id);
}

// #RRGGBB (or #RGB) → rgba() string. Falls back to the input on parse error.
export function hexA(hex, a){
  try {
    var h = String(hex).replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
  } catch(_){ return hex; }
}

// ── Title tag pill (neon text flair) ──────────────────────────────────────
export function TagPill(props){
  var item = props.item; if (!item) return null;
  var color = (item.payload && item.payload.color) || '#7B6EFF';
  return React.createElement('span', { style: {
    display:'inline-flex', alignItems:'center',
    fontSize: props.small ? '9px' : '10px', fontWeight:800,
    color: color, padding:'2px 9px', borderRadius:'20px',
    border:'1px solid ' + color, background: hexA(color, 0.12),
    textShadow:'0 0 8px ' + hexA(color, 0.7),
    boxShadow:'0 0 10px ' + hexA(color, 0.25),
    letterSpacing:'.4px', whiteSpace:'nowrap'
  } }, (item.name || '').toUpperCase());
}

// ── Neon sticker glyph ────────────────────────────────────────────────────
export function Sticker(props){
  var item = props.item; if (!item) return null;
  var p = item.payload || {};
  var color = p.color || '#7B6EFF';
  var glyph = p.glyph || '✦';
  var size = props.size || 40;
  return React.createElement('span', { 'aria-label': item.name, style: {
    fontSize: size + 'px', lineHeight: 1, display:'inline-block',
    filter: 'drop-shadow(0 0 6px ' + hexA(color,0.85) + ') drop-shadow(0 0 14px ' + hexA(color,0.5) + ')'
  } }, glyph);
}

// ── PFP frame overlay (rings + winged VIP) ────────────────────────────────
// Returns an array of absolutely-positioned nodes to drop INSIDE the avatar's
// positioned container (the avatar wrapper must be position:absolute/relative).
// `size` = avatar diameter in px.
export function frameOverlay(item, size){
  if (!item) return null;
  var p = item.payload || {};
  var color = p.css ? (p.color || '#7B6EFF') : '#7B6EFF';
  var css = p.css || 'ring-solid';
  var nodes = [];

  if (css === 'wings'){
    nodes.push(wingNode(item, size, true));
    nodes.push(wingNode(item, size, false));
  }

  var glow = (css === 'ring-pulse')
    ? ('0 0 16px ' + hexA(color,0.9) + ', 0 0 30px ' + hexA(color,0.5))
    : ('0 0 10px ' + hexA(color,0.8));
  var ringStyle = {
    position:'absolute', left:'50%', top:'50%',
    width:(size + 8) + 'px', height:(size + 8) + 'px',
    transform:'translate(-50%,-50%)', borderRadius:'50%',
    pointerEvents:'none', zIndex:5, boxSizing:'border-box',
    border:'2px solid ' + color,
    boxShadow: glow + ', inset 0 0 6px ' + hexA(color,0.45)
  };
  if (css === 'ring-double'){ ringStyle.outline = '2px solid ' + hexA(color,0.55); ringStyle.outlineOffset = '3px'; }
  if (css === 'ring-gradient'){ ringStyle.boxShadow = '0 0 10px ' + hexA(color,0.8) + ', 0 0 18px ' + hexA(p.color2 || '#E84D9A', 0.6); }
  nodes.push(React.createElement('div', { key:'ring', style: ringStyle }));
  return nodes;
}

function wingNode(item, size, left){
  var p = item.payload || {};
  var color = p.color || '#fff';
  var glow = p.glow || color;
  var w = Math.round(size * 0.95), h = Math.round(size * 1.1);
  return React.createElement('svg', {
    key: left ? 'wl' : 'wr', width: w, height: h, viewBox:'0 0 60 70', 'aria-hidden':'true',
    style: {
      position:'absolute', top:'50%', left:'50%',
      transform:'translateY(-50%) translateX(' + (left ? '-100%' : '0') + ') ' + (left ? 'scaleX(-1)' : ''),
      marginLeft: left ? (-size*0.32)+'px' : (size*0.32)+'px',
      pointerEvents:'none', zIndex:1, filter:'drop-shadow(0 0 6px ' + glow + ')'
    }
  },
    React.createElement('path', {
      d:'M58 35 C40 8 18 6 4 14 C20 16 26 26 24 34 C30 30 40 30 46 36 C36 36 30 44 30 52 C40 40 52 40 58 44 Z',
      fill: color, opacity: 0.92
    })
  );
}

// ── Theme accent vars (spread onto a profile container's style) ────────────
export function themeStyle(item){
  if (!item || !item.payload || !item.payload.accent) return null;
  var p = item.payload;
  return { '--ac': p.accent, '--acg': hexA(p.accent, 0.16) };
}
