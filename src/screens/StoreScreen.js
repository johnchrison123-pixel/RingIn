/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// StoreScreen — coin-bought profile cosmetics: neon title tags, PFP frames
// (incl. winged VIP), 3D-style neon stickers (zodiac / music / vibes), and
// neon themes. Buys/equips via the buy_cosmetic / equip_cosmetic RPCs
// (migration 0049). Forward-compatible: if the migration hasn't run, the
// catalog is empty and the screen shows a friendly empty-state.
// ──────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { sb as defaultClient } from '../utils/supabase';
import { useCoinBalance, setSharedCoinBalance } from '../utils/coinBalance';
import { loadCatalog, getCachedCatalog, TagPill, Sticker, frameOverlay, frameSrc, hexA } from '../utils/cosmetics';
import { toastError, toastSuccess, toastWarn, toastInfo } from '../utils/toast';

var EMPTY_CAT = { byId:{}, byKind:{ tag:[], frame:[], sticker:[], theme:[] }, rows:[] };
// Canonical category order per kind, so section headings render in a stable
// order regardless of DB sort-value hygiene (defends the pre-0052 state).
var SECTION_ORDER = { frame: ['Neon Wings','VIP Wings','Classic Rings'], theme: [], tag: [], sticker: [] };

export default function StoreScreen(props){
  var sb = props.sb || defaultClient;
  var userId = props.userId;
  var coinBalance = useCoinBalance(userId, sb);

  var catS = useState(function(){ return getCachedCatalog() || EMPTY_CAT; });
  var cat = catS[0]; var setCat = catS[1];
  var ownedS = useState({}); var owned = ownedS[0]; var setOwned = ownedS[1];
  var equippedS = useState({}); var equipped = equippedS[0]; var setEquipped = equippedS[1];
  var busyS = useState({}); var busy = busyS[0]; var setBusy = busyS[1];
  var activeKindS = useState('frame'); var activeKind = activeKindS[0]; var setActiveKind = activeKindS[1];
  // Distinguish "still loading on a cold install" from "genuinely empty" so we
  // don't show the warming-up empty-state during a normal first fetch.
  var loadingS = useState(function(){ return !getCachedCatalog(); }); var loading = loadingS[0]; var setLoading = loadingS[1];
  var scrollRef = useRef(null); // reset scroll to top when switching category tabs

  useEffect(function(){
    var cancelled = false;
    loadCatalog(sb).then(function(c){ if (!cancelled){ if (c) setCat(c); setLoading(false); } });
    if (userId){
      try {
        sb.from('profiles').select('owned_cosmetics,equipped').eq('id', userId).maybeSingle().then(function(r){
          if (cancelled || !r || r.error || !r.data) return;
          var om = {};
          (Array.isArray(r.data.owned_cosmetics) ? r.data.owned_cosmetics : []).forEach(function(id){ om[id] = true; });
          setOwned(om);
          setEquipped(r.data.equipped && typeof r.data.equipped === 'object' ? r.data.equipped : {});
        }).catch(function(){});
      } catch(_){}
    }
    return function(){ cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function setBusyId(id, on){
    setBusy(function(b){ var n = Object.assign({}, b); if (on) n[id] = true; else delete n[id]; return n; });
  }

  function buy(item){
    if (busy[item.id] || owned[item.id]) return;
    // No client-side balance pre-check — useCoinBalance can be momentarily stale
    // (0 before it hydrates), which would wrongly bounce a valid buy to the wallet.
    // buy_cosmetic checks coins server-side and returns 'insufficient' if truly short.
    setBusyId(item.id, true);
    sb.rpc('buy_cosmetic', { p_item_id: item.id }).then(function(r){
      setBusyId(item.id, false);
      if (r && r.error){ try{ toastError('Purchase failed: ' + r.error.message); }catch(_){} return; }
      var st = r && r.data && r.data.status;
      if (st === 'ok' || st === 'already_owned'){
        setOwned(function(o){ var n = Object.assign({}, o); n[item.id] = true; return n; });
        if (st === 'ok'){
          if (typeof r.data.balance === 'number') setSharedCoinBalance(r.data.balance, { userId: userId, supabase: sb });
          try{ toastSuccess('Unlocked ' + item.name + ' ✨'); }catch(_){}
          doEquip(item, true);
        }
      } else if (st === 'insufficient'){
        try{ toastWarn('Not enough coins.'); }catch(_){}
        if (props.onOpenWallet) props.onOpenWallet();
      } else {
        try{ toastError('Could not unlock this item.'); }catch(_){}
      }
    }).catch(function(){ setBusyId(item.id, false); try{ toastError('Network error — try again.'); }catch(_){} });
  }

  function doEquip(item, silent){
    var prev = equipped[item.kind] || null;
    var isEq = prev === item.id;
    var target = isEq ? '' : item.id; // tapping the equipped one unequips it
    setEquipped(function(e){ var n = Object.assign({}, e); n[item.kind] = target || null; return n; });
    sb.rpc('equip_cosmetic', { p_kind: item.kind, p_item_id: target }).then(function(r){
      if (r && r.error){
        setEquipped(function(e){ var n = Object.assign({}, e); n[item.kind] = prev; return n; });
        try{ toastError('Could not equip.'); }catch(_){}
        return;
      }
      if (!silent){ try{ toastInfo(target ? ('Equipped ' + item.name) : ('Removed ' + item.name)); }catch(_){} }
      try{ window.dispatchEvent(new CustomEvent('ringin-cosmetics-changed')); }catch(_){}
    }).catch(function(){
      setEquipped(function(e){ var n = Object.assign({}, e); n[item.kind] = prev; return n; });
      try{ toastError('Network error — try again.'); }catch(_){}
    });
  }

  // ── preview node per kind ──
  function preview(item){
    if (item.kind === 'tag') return React.createElement(TagPill, { item: item });
    if (item.kind === 'sticker') return React.createElement(Sticker, { item: item, size: 34 });
    if (item.kind === 'theme'){
      var p = item.payload || {};
      return React.createElement('div', { style:{ width:'46px', height:'46px', borderRadius:'50%',
        background:'linear-gradient(135deg,' + (p.accent||'#7B6EFF') + ',' + (p.accent2||'#E84D9A') + ')',
        boxShadow:'0 0 12px ' + (p.glow || hexA(p.accent||'#7B6EFF',0.5)) } });
    }
    // frame — real PNG shows contained in the cell (no overflow); vector rings use a mini avatar.
    // display:block + maxHeight bound to the 72px cell so the winged art is fully contained
    // and can never spill upward over the section heading above this card.
    if (item.payload && item.payload.img) {
      return React.createElement('img', { src:frameSrc(item.payload.img), alt:item.name, style:{ display:'block', maxWidth:'100%', maxHeight:'100%', width:'auto', height:'auto', objectFit:'contain' } });
    }
    // Vector frames: the overlay is an absolutely-positioned SVG whose wings/glow
    // extend well past the mini-avatar. Keep it contained so it can never spill
    // up over the section heading — this wrapper clips it to the preview cell.
    return React.createElement('div', { style:{ position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' } },
      React.createElement('div', { style:{ position:'relative', width:'28px', height:'28px', borderRadius:'50%', background:'linear-gradient(135deg,#7B6EFF,#E84D9A)' } }),
      frameOverlay(item, 28)
    );
  }

  function card(item){
    var isOwned = !!owned[item.id];
    var isEq = equipped[item.kind] === item.id;
    var btn;
    if (!isOwned){
      var price = Number(item.price_coins) || 0;
      // bal>0 gate avoids a stale-0 false-negative before the balance hydrates;
      // tap stays enabled (server is the source of truth) — this is just an affordance.
      var bal = Number(coinBalance) || 0;
      var cantAfford = price > 0 && bal > 0 && price > bal;
      btn = React.createElement('button', { onClick:function(){ buy(item); }, disabled:!!busy[item.id], style:{
        marginTop:'8px', width:'100%', padding:'7px', borderRadius:'10px', border:'none', cursor:'pointer',
        background:'linear-gradient(135deg,#7B6EFF,#E84D9A)', color:'#fff', fontSize:'12px', fontWeight:700,
        opacity: busy[item.id] ? 0.6 : (cantAfford ? 0.5 : 1), fontFamily:'inherit'
      } }, busy[item.id] ? '…' : (item.price_coins > 0 ? ('🪙 ' + item.price_coins) : 'Free'));
    } else {
      btn = React.createElement('button', { onClick:function(){ doEquip(item, false); }, style:{
        marginTop:'8px', width:'100%', padding:'7px', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit',
        background: isEq ? 'rgba(39,201,106,0.16)' : 'var(--bg4)',
        border:'1px solid ' + (isEq ? 'rgba(39,201,106,0.5)' : 'var(--border)'),
        color: isEq ? '#27C96A' : 'var(--text)', fontSize:'12px', fontWeight:700
      } }, isEq ? '✓ Equipped' : 'Equip');
    }
    return React.createElement('div', { key:item.id, style:{
      background:'var(--bg3)', border:'1px solid ' + (isEq ? 'rgba(123,110,255,0.5)' : 'var(--border)'),
      borderRadius:'14px', padding:'12px 10px', textAlign:'center', position:'relative'
    } },
      item.is_premium ? React.createElement('div', { style:{ position:'absolute', top:'6px', right:'8px', fontSize:'9px', fontWeight:800, color:'#FFD93D', letterSpacing:'.5px' } }, 'VIP') : null,
      React.createElement('div', { style:{ position:'relative', height:'72px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'6px', overflow:'hidden', borderRadius:'10px' } }, preview(item)),
      React.createElement('div', { style:{ fontSize:'12px', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' } }, item.name),
      btn
    );
  }

  // group a kind's items by section in a DETERMINISTIC order: canonical
  // SECTION_ORDER first, then any leftover sections by their min sort. Items
  // within a section sort by their own sort value. Robust to colliding sort
  // bands across sections (the pre-0052 state) so headings never reshuffle.
  function sectionsFor(kind){
    var items = (cat.byKind && cat.byKind[kind]) || [];
    var map = {};
    items.forEach(function(it){ var s = it.section || ''; if (!map[s]) map[s] = []; map[s].push(it); });
    Object.keys(map).forEach(function(s){ map[s].sort(function(a,b){ return (a.sort==null?0:a.sort) - (b.sort==null?0:b.sort); }); });
    var canon = SECTION_ORDER[kind] || [];
    var seen = {}; var ordered = [];
    canon.forEach(function(s){ if (map[s]){ ordered.push(s); seen[s] = true; } });
    Object.keys(map).filter(function(s){ return !seen[s]; }).sort(function(a,b){
      var ma = Math.min.apply(null, map[a].map(function(x){ return x.sort==null?0:x.sort; }));
      var mb = Math.min.apply(null, map[b].map(function(x){ return x.sort==null?0:x.sort; }));
      return ma !== mb ? ma - mb : (a < b ? -1 : 1);
    }).forEach(function(s){ ordered.push(s); });
    return ordered.map(function(s){ return { section:s, items:map[s] }; });
  }

  var hasCatalog = cat && cat.rows && cat.rows.length > 0;

  return React.createElement('div', { ref: scrollRef, style:{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)', overflowY:'auto' } },
    // Header
    React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'12px', padding:'16px 18px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--bg)', zIndex:10 } },
      React.createElement('button', { onClick: props.onClose, style:{ background:'none', border:'none', color:'var(--text)', cursor:'pointer', padding:'4px', display:'flex' } },
        React.createElement('svg', { viewBox:'0 0 24 24', width:'22', height:'22', fill:'none', stroke:'currentColor', strokeWidth:'2.3', strokeLinecap:'round', strokeLinejoin:'round' }, React.createElement('polyline', { points:'15 18 9 12 15 6' }))
      ),
      React.createElement('div', { style:{ fontSize:'16px', fontWeight:700, color:'var(--text)', flex:1 } }, '✨ Style Store'),
      React.createElement('div', { onClick: props.onOpenWallet, style:{ display:'flex', alignItems:'center', gap:'5px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'20px', padding:'5px 11px', cursor:'pointer' } },
        React.createElement('span', { style:{ fontSize:'14px' } }, '🪙'),
        React.createElement('span', { style:{ fontSize:'13px', fontWeight:800, color:'var(--text)' } }, (Number(coinBalance)||0).toLocaleString())
      )
    ),
    // Category tabs — each kind is its own view (no long scroll)
    hasCatalog ? React.createElement('div', { role:'tablist', 'aria-label':'Store categories', style:{ display:'flex', gap:'6px', padding:'10px 12px', borderBottom:'1px solid var(--border)', position:'sticky', top:'56px', background:'var(--bg)', zIndex:9, overflowX:'auto' } },
      [{k:'frame',l:'Frames'},{k:'theme',l:'Themes'},{k:'tag',l:'Tags'},{k:'sticker',l:'Stickers'}].map(function(t){
        var on = activeKind === t.k;
        return React.createElement('button', { key:t.k, role:'tab', 'aria-selected': on, onClick:function(){ setActiveKind(t.k); try{ if (scrollRef.current) scrollRef.current.scrollTop = 0; }catch(_){} }, style:{
          flex:'1 0 auto', padding:'8px 14px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontSize:'13px', fontWeight:700, whiteSpace:'nowrap',
          background: on ? 'linear-gradient(135deg,#7B6EFF,#E84D9A)' : 'var(--bg3)',
          color: on ? '#fff' : 'var(--t2)', border:'1px solid ' + (on ? 'transparent' : 'var(--border)')
        } }, t.l);
      })
    ) : null,
    React.createElement('div', { role:'tabpanel', 'aria-label': activeKind, style:{ padding:'14px 16px 24px' } },
      (loading && !hasCatalog)
        ? React.createElement('div', { style:{ textAlign:'center', padding:'60px 24px', color:'var(--t2)' } },
            React.createElement('div', { style:{ fontSize:'30px', marginBottom:'12px' } }, '✨'),
            React.createElement('div', { style:{ fontSize:'13px', fontWeight:600, color:'var(--text)' } }, 'Loading the store…')
          )
      : !hasCatalog
        ? React.createElement('div', { style:{ textAlign:'center', padding:'60px 24px', color:'var(--t2)' } },
            React.createElement('div', { style:{ fontSize:'40px', marginBottom:'12px' } }, '✨'),
            React.createElement('div', { style:{ fontSize:'14px', fontWeight:600, color:'var(--text)', marginBottom:'6px' } }, 'Store is warming up'),
            React.createElement('div', { style:{ fontSize:'12px', lineHeight:1.5 } }, 'Neon tags, winged frames, stickers and themes are on the way. Check back in a moment.')
          )
        : sectionsFor(activeKind).map(function(grp, gi){
            // Each section: heading on its own line with clear breathing room above
            // (so the previous row's glowing cards never crowd/cover it) and below.
            // scrollMarginTop keeps an anchored heading clear of the sticky header+tabs.
            return React.createElement('div', { key:activeKind + '-' + grp.section, style:{ marginTop: gi === 0 ? '2px' : '28px', marginBottom:'14px' } },
              React.createElement('div', { role:'heading', 'aria-level':2, style:{ fontSize:'13px', fontWeight:700, color:'var(--text)', margin:'0 0 12px', paddingBottom:'2px', display:'flex', alignItems:'center', gap:'7px', position:'relative', zIndex:1, scrollMarginTop:'112px' } }, grp.section),
              React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', alignItems:'start' } },
                grp.items.map(function(it){ return card(it); })
              )
            );
          })
    )
  );
}
