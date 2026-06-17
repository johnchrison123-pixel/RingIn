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

// ── PFP frame overlay — rich SVG winged frames ────────────────────────────
// Returns ONE absolutely-positioned SVG centered on the avatar: layered wings
// + glowing ring + optional crown + optional badge (VIP/PREMIUM/Σ) + gems.
// Drop it INSIDE the avatar's positioned container (the avatar shows through
// the open center; wings/crown extend beyond it). `size` = avatar diameter px.
// payload: { wing:'angel'|'butterfly'|'demon'|'feather', c1, c2 (gradient),
//   crown:'king'|'tiara'|null, badge:'VIP'|'PREMIUM'|'Σ'|null,
//   img (optional transparent-PNG override → exact art with no code change) }
// Cache-bust frame asset URLs: public/ PNGs keep their filename across deploys,
// so browsers serve stale versions. Bump FRAME_ASSET_V whenever the art changes.
var FRAME_ASSET_V = '3';
export function frameSrc(u){ return u ? (u + (u.indexOf('?') < 0 ? ('?v=' + FRAME_ASSET_V) : '')) : u; }

export function frameOverlay(item, size){
  if (!item) return null;
  var p = item.payload || {};

  // Image-override path: a transparent PNG renders directly (exact art). The
  // cleaned frames are ring-centred in a square canvas, so a plain centre
  // translate lands the ring on the avatar. ~3.5x avatar width fits the ring
  // to the photo with the wings extending beyond.
  if (p.img){
    return React.createElement('img', { key:'fimg', src:frameSrc(p.img), alt:'', 'aria-hidden':'true', style:{
      position:'absolute', left:'50%', top:'50%', width:(size*3.5)+'px', height:'auto',
      transform:'translate(-50%,-50%)', pointerEvents:'none', zIndex:1
    } });
  }

  var c1 = p.c1 || p.color || '#7B6EFF';
  var c2 = p.c2 || p.color2 || c1;
  var wing = p.wing || (p.css === 'wings' ? 'angel' : null);

  // Legacy ring-only frame (no wings/crown/badge) → simple glowing ring.
  if (!wing && !p.crown && !p.badge){
    return React.createElement('div', { key:'ring', style:{
      position:'absolute', left:'50%', top:'50%', width:(size+8)+'px', height:(size+8)+'px',
      transform:'translate(-50%,-50%)', borderRadius:'50%', pointerEvents:'none', zIndex:5,
      boxSizing:'border-box', border:'2px solid '+c1, boxShadow:'0 0 10px '+hexA(c1,0.8)+', inset 0 0 6px '+hexA(c1,0.45)
    } });
  }

  var uid = 'f_' + (item.id || 'x');
  var gid = uid + '_g', rid = uid + '_r', gold = uid + '_au', glowId = uid + '_gl';

  return React.createElement('svg', {
    key:'frame', width: Math.round(size*2.7), height: Math.round(size*2.45),
    viewBox:'0 0 240 200', 'aria-hidden':'true', style:{
      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      pointerEvents:'none', zIndex:1, overflow:'visible'
    }
  },
    React.createElement('defs', null,
      grad(gid, c1, c2, false),
      grad(rid, c1, c2, true),
      grad(gold, '#FFE7A0', '#B8860B', true),
      React.createElement('filter', { id:glowId, x:'-40%', y:'-40%', width:'180%', height:'180%' },
        React.createElement('feGaussianBlur', { stdDeviation:'2.3', result:'b' }),
        React.createElement('feMerge', null,
          React.createElement('feMergeNode', { in:'b' }),
          React.createElement('feMergeNode', { in:'SourceGraphic' })
        )
      )
    ),
    React.createElement('g', { filter:'url(#'+glowId+')' },
      React.createElement('path', { d: wingPath(wing||'angel'), fill:'url(#'+gid+')', opacity:0.95 }),
      React.createElement('path', { d: wingPath(wing||'angel'), fill:'url(#'+gid+')', opacity:0.95, transform:'scale(-1,1) translate(-240,0)' })
    ),
    React.createElement('circle', { cx:120, cy:100, r:50, fill:'none', stroke:'url(#'+rid+')', strokeWidth:3.5, filter:'url(#'+glowId+')' }),
    gem(70,100,c1), gem(170,100,c1),
    p.crown ? crownNode(p.crown, gold, c1, glowId) : null,
    p.badge ? badgeNode(p.badge, gold, glowId) : null
  );
}

function grad(id, c1, c2, vertical){
  return React.createElement('linearGradient', { id:id, x1:'0', y1:'0', x2: vertical?'0':'1', y2: vertical?'1':'0' },
    React.createElement('stop', { offset:'0%', stopColor:c1 }),
    React.createElement('stop', { offset:'100%', stopColor:c2 })
  );
}

function gem(x, y, color){
  return React.createElement('rect', { key:'gem'+x, x:x-4, y:y-4, width:8, height:8, fill:color, transform:'rotate(45 '+x+' '+y+')', opacity:0.9 });
}

function wingPath(style){
  if (style === 'butterfly')
    return 'M150 96 C182 58 228 64 228 94 C214 98 196 98 158 100 C196 104 216 112 222 138 C196 146 166 128 150 110 Z';
  if (style === 'demon')
    return 'M150 98 C176 86 200 80 234 74 L218 86 L232 92 L214 99 L228 108 L208 112 L218 124 L196 115 L200 128 L180 115 L150 116 Z';
  if (style === 'feather')
    return 'M150 95 C184 80 212 72 238 58 C224 69 218 80 226 89 C209 82 201 89 208 100 C193 93 185 100 191 110 C178 103 165 105 152 116 Z';
  return 'M150 98 C178 84 206 76 234 62 C220 73 214 84 221 93 C206 86 198 93 205 103 C192 96 184 103 189 112 C176 105 162 109 150 116 Z';
}

function crownNode(kind, goldId, color, glowId){
  if (kind === 'tiara'){
    return React.createElement('g', { key:'crown', filter:'url(#'+glowId+')' },
      React.createElement('path', { d:'M100 56 C108 40 132 40 140 56 L134 56 L126 46 L120 54 L114 46 L106 56 Z', fill:'url(#'+goldId+')', stroke: hexA(color,0.6), strokeWidth:0.6 }),
      React.createElement('circle', { cx:120, cy:44, r:3.4, fill:color })
    );
  }
  return React.createElement('g', { key:'crown', filter:'url(#'+glowId+')' },
    React.createElement('path', { d:'M96 58 L102 36 L111 52 L120 32 L129 52 L138 36 L144 58 Z', fill:'url(#'+goldId+')', stroke: hexA(color,0.55), strokeWidth:0.6 }),
    React.createElement('rect', { x:96, y:58, width:48, height:7, rx:2, fill:'url(#'+goldId+')' }),
    React.createElement('circle', { cx:120, cy:34, r:3.2, fill:color }),
    React.createElement('circle', { cx:102, cy:38, r:2, fill:color }),
    React.createElement('circle', { cx:138, cy:38, r:2, fill:color })
  );
}

function badgeNode(label, goldId, glowId){
  var w = label.length > 3 ? 70 : 40;
  var x = 120 - w/2;
  return React.createElement('g', { key:'badge', filter:'url(#'+glowId+')' },
    React.createElement('rect', { x:x, y:158, width:w, height:20, rx:5, fill:'#13101f', stroke:'url(#'+goldId+')', strokeWidth:1.5 }),
    React.createElement('text', { x:120, y:172, textAnchor:'middle', fontSize: label.length>3?'11':'12', fontWeight:'800', fill:'url(#'+goldId+')', fontFamily:'inherit', letterSpacing: label.length>3?'1':'1.5' }, label)
  );
}

// ── Theme accent vars (spread onto a profile container's style) ────────────
export function themeStyle(item){
  if (!item || !item.payload || !item.payload.accent) return null;
  var p = item.payload;
  return { '--ac': p.accent, '--acg': hexA(p.accent, 0.16) };
}
