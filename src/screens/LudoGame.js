/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// LudoGame — in-call / in-room 2-player Ludo, REBUILT as a real, colorful,
// animated board (classic 15×15 CSS-grid cross). Server-authoritative:
// ludo_roll / ludo_move / get_game / forfeit_game decide everything. We never
// roll our own dice and never compute the winner — we render game_sessions.
//
// state (0061): { tokens:{X:[p,p,p,p],O:[p,p,p,p]}, roll:1..6|null,
//                 last_roll:1..6|null, must_move:bool }
//   pos: -1 base; 0..50 shared track (abs=(entry+pos)%52, entry X=0/O=26);
//        51..56 home column; 57 = HOME. Win = all four === 57.
//
// BOARD APPROACH: classic Ludo CROSS — a 15×15 grid (~21px cells → ~315px).
// Four 6×6 corner bases (the two ACTIVE colors lit, two muted), a white plus
// track ringing the centre, two colored home-stretch lanes feeding a central
// 🏠. Tokens are glossy discs placed ON their mapped board cell; a moving
// token animates ringin-token-hop; movable tokens pulse ringin-turn-glow.
//
// OPTIMISTIC: a tapped roll starts the dice-shake + 'rolling…' instantly
// (result is server RNG); a tapped move hops the token to its predicted cell
// immediately via local optimistic tokens, superseded by server state on
// return / realtime. RPC errors self-correct from the next authoritative state.
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var X_COLOR = '#5ad1ff';
var O_COLOR = '#ff7eb6';
var DIE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

// ── Board geometry (15×15, rows 0..14 top→bottom, cols 0..14 left→right) ──
// Shared 52-cell track, indexed by ABSOLUTE cell 0..51. abs 0 = X entry,
// abs 26 = O entry. Standard clockwise Ludo path. [row,col] per abs cell.
var TRACK = [
  // abs 0..12  (X entry strip → up the left of top arm)
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  // abs 13..25 (down the right of top arm → across to right base)
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  // abs 26..38 (O entry strip → down the right of bottom arm)
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  // abs 39..51 (up the left of bottom arm → back to X base)
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0]
];
// X home lane: rows 1..6 in column 7 (down toward centre). pos 51..56.
var HOME_LANE_X = [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]];
// O home lane: col 7..? — O enters at abs26 (8,13) and runs the centre row.
var HOME_LANE_O = [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]];
var CENTER = [7, 7];

// 6×6 base pockets — 4 disc anchor cells inside each corner base.
var BASE_X  = [[1,1],[1,4],[4,1],[4,4]];   // top-left  (X)
var BASE_O  = [[10,10],[10,13],[13,10],[13,13]]; // bottom-right (O)
var BASE_TL_MUTE = [[1,10],[1,13],[4,10],[4,13]]; // top-right (muted)
var BASE_BL_MUTE = [[10,1],[10,4],[13,1],[13,4]]; // bottom-left (muted)
var SAFE = { 0:1,8:1,13:1,21:1,26:1,34:1,39:1,47:1 };

export default function LudoGame(props){
  var gameId   = props.gameId;
  var myMark   = props.myMark;
  var myUserId = props.myUserId;
  var onClose  = props.onClose;
  var onMinimize = props.onMinimize;

  // ── State (all hooks BEFORE any conditional return) ──
  var gameS = useState(null);
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);
  var busy = busyS[0]; var setBusy = busyS[1];

  var shakingS = useState(false);     // dice mid-roll (optimistic)
  var shaking = shakingS[0]; var setShaking = shakingS[1];

  var fakeFaceS = useState(1);        // spinning cosmetic face during shake
  var fakeFace = fakeFaceS[0]; var setFakeFace = fakeFaceS[1];

  // Optimistic move overlay: { mark, idx, pos } — supersedes server tokens
  // until the next authoritative state lands.
  var optS = useState(null);
  var opt = optS[0]; var setOpt = optS[1];

  // Token index that just moved → gets ringin-token-hop for one render window.
  var hopS = useState(null);
  var hop = hopS[0]; var setHop = hopS[1];

  var mountedRef = useRef(true);
  var shakeTimer = useRef(null);
  var spinTimer = useRef(null);
  var hopTimer = useRef(null);

  // Seed from get_game.
  useEffect(function(){
    mountedRef.current = true;
    var cancelled = false;
    (async function(){
      try {
        var r = await sb.rpc('get_game', { p_game: gameId });
        if (cancelled || !mountedRef.current) return;
        if (r && r.error) { setErr('Game unavailable'); setLoading(false); return; }
        var row = r ? r.data : null;
        if (Array.isArray(row)) row = row[0];
        if (!row) { setErr('Game unavailable'); setLoading(false); return; }
        setGame(row); setLoading(false);
      } catch (_) {
        if (cancelled || !mountedRef.current) return;
        setErr('Game unavailable'); setLoading(false);
      }
    })();
    return function(){ cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Realtime UPDATE subscription. Server state clears any optimistic overlay.
  useEffect(function(){
    var ch = null;
    try {
      ch = sb.channel('ludo-' + gameId)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'game_sessions',
          filter: 'id=eq.' + gameId
        }, function(p){
          if (!mountedRef.current) return;
          var n = p && p['new'];
          if (n && n.id) { setGame(n); setOpt(null); }
        })
        .subscribe();
    } catch (_) { ch = null; }
    return function(){ if (ch) { try { sb.removeChannel(ch); } catch (_) {} } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(function(){
    return function(){
      mountedRef.current = false;
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (spinTimer.current) clearInterval(spinTimer.current);
      if (hopTimer.current) clearTimeout(hopTimer.current);
    };
  }, []);

  // ── Derived (safe with null game) ──
  var state  = (game && game.state && typeof game.state === 'object') ? game.state : null;
  var tokens = (state && state.tokens && typeof state.tokens === 'object') ? state.tokens : null;
  var roll   = state ? state.roll : null;
  var lastRoll = state ? state.last_roll : null;
  var status = game ? game.status : null;
  var turn   = game ? game.turn : null;
  var isOver = status === 'won' || status === 'draw' || status === 'abandoned';
  var myTurn = !isOver && status === 'active' && turn === myMark;

  var oppMark = myMark === 'X' ? 'O' : 'X';
  var myColor = myMark === 'X' ? X_COLOR : O_COLOR;
  var oppColor = oppMark === 'X' ? X_COLOR : O_COLOR;

  function tokArr(mark){
    if (tokens && Array.isArray(tokens[mark]) && tokens[mark].length === 4) return tokens[mark].slice();
    return [-1, -1, -1, -1];
  }
  var myToksRaw = tokArr(myMark);
  var oppToks = tokArr(oppMark);

  // Apply optimistic overlay to my tokens for instant feedback.
  var myToks = myToksRaw.slice();
  if (opt && opt.mark === myMark && opt.idx >= 0 && opt.idx < 4) {
    myToks[opt.idx] = opt.pos;
  }

  function isMovable(i){
    if (!myTurn || roll == null || opt) return false;
    var t = myToksRaw[i];
    if (t === -1) return roll === 6;
    if (t >= 0 && t <= 56) return (t + roll) <= 57;
    return false;
  }
  var anyMovable = isMovable(0) || isMovable(1) || isMovable(2) || isMovable(3);

  // ── Actions ──
  function doRoll(){
    if (busy || shaking || !game || !myTurn || roll != null || err) return;
    setBusy(true);
    setShaking(true);
    // cosmetic spinning face
    spinTimer.current = setInterval(function(){
      if (!mountedRef.current) return;
      setFakeFace(Math.floor(Math.random() * 6) + 1);
    }, 70);
    shakeTimer.current = setTimeout(function(){
      if (!mountedRef.current) return;
      if (spinTimer.current) { clearInterval(spinTimer.current); spinTimer.current = null; }
      setShaking(false);
    }, 520);
    (async function(){
      try {
        var r = await sb.rpc('ludo_roll', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data; if (Array.isArray(row)) row = row[0];
          if (row && row.id) { setGame(row); setOpt(null); }
        }
      } catch (_) {} finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  function predictPos(i){
    var t = myToksRaw[i];
    if (t === -1) return 0;            // entering on a 6
    return Math.min(57, t + (roll || 0));
  }

  function doMove(i){
    if (busy || !game || !myTurn || roll == null || err || opt) return;
    if (!isMovable(i)) return;
    var pos = predictPos(i);
    // Optimistic: hop the token to its predicted cell immediately.
    setOpt({ mark: myMark, idx: i, pos: pos });
    setHop(myMark + '-' + i);   // must match the disc key (mark+'-'+i) so the hop animates
    if (hopTimer.current) clearTimeout(hopTimer.current);
    hopTimer.current = setTimeout(function(){ if (mountedRef.current) setHop(null); }, 340);
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('ludo_move', { p_game: gameId, p_token: i });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data; if (Array.isArray(row)) row = row[0];
          if (row && row.id) { setGame(row); setOpt(null); }
        } else { setOpt(null); }   // rejected → revert to server state
      } catch (_) { if (mountedRef.current) setOpt(null); }
      finally { if (mountedRef.current) setBusy(false); }
    })();
  }

  function doForfeit(){
    if (busy || !game || isOver) return;
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('forfeit_game', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data; if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);
        }
      } catch (_) {} finally { if (mountedRef.current) setBusy(false); }
    })();
  }

  // ── Status text ──
  function statusText(){
    if (err) return 'Game unavailable';
    if (loading || !game) return 'Loading…';
    if (status === 'won') return (game.winner && myUserId && game.winner === myUserId) ? 'You won! 🎉' : 'You lost';
    if (status === 'draw') return 'Draw';
    if (status === 'abandoned') return (game.winner && myUserId && game.winner === myUserId) ? 'Opponent forfeited' : 'You forfeited';
    if (status === 'waiting') return 'Waiting for opponent…';
    if (myTurn) {
      if (shaking) return 'Rolling…';
      if (roll == null) return 'Your turn — roll the die';
      if (opt) return 'Moving…';
      if (!anyMovable) return 'No moves — passing…';
      return 'You rolled ' + roll + ' — tap a glowing token';
    }
    return "Opponent's turn";
  }

  // ── Map a token's pos → [row,col] on the 15×15 grid ──
  function cellFor(mark, i, pos){
    var entry = mark === 'X' ? 0 : 26;
    if (pos === -1) {
      // base pocket
      if (mark === 'X') return BASE_X[i];
      return BASE_O[i];
    }
    if (pos >= 0 && pos <= 50) {
      var abs = (entry + pos) % 52;
      return TRACK[abs];
    }
    if (pos >= 51 && pos <= 56) {
      var laneIdx = pos - 51; // 0..5
      return (mark === 'X') ? HOME_LANE_X[laneIdx] : HOME_LANE_O[laneIdx];
    }
    if (pos === 57) return CENTER;
    return CENTER;
  }

  // ── Build the 15×15 board ──
  var CELL = 21;  // px
  var BOARD = CELL * 15; // 315

  // classify each grid cell for background painting
  function cellKey(r, c){ return r + ',' + c; }
  var trackSet = {};
  for (var ti = 0; ti < TRACK.length; ti++) trackSet[cellKey(TRACK[ti][0], TRACK[ti][1])] = ti;
  var xLaneSet = {}; for (var li = 0; li < HOME_LANE_X.length; li++) xLaneSet[cellKey(HOME_LANE_X[li][0], HOME_LANE_X[li][1])] = 1;
  var oLaneSet = {}; for (var lj = 0; lj < HOME_LANE_O.length; lj++) oLaneSet[cellKey(HOME_LANE_O[lj][0], HOME_LANE_O[lj][1])] = 1;

  function inBox(r, c, r0, c0){ return r >= r0 && r < r0 + 6 && c >= c0 && c < c0 + 6; }

  function paintCell(r, c){
    var k = cellKey(r, c);
    // bases (6×6 corners)
    var TL = inBox(r, c, 0, 0);     // X
    var TR = inBox(r, c, 0, 9);     // muted
    var BL = inBox(r, c, 9, 0);     // muted
    var BR = inBox(r, c, 9, 9);     // O
    if (TL || TR || BL || BR) {
      var lit = (TL && myMark === 'X') || (BR && myMark === 'O') ||
                (TL && oppMark === 'X') || (BR && oppMark === 'O');
      // X always top-left, O always bottom-right (fixed colors); other two muted
      var bg = '#0e1320';
      var bd = '#1a2233';
      if (TL) { bg = 'rgba(90,209,255,0.16)'; bd = 'rgba(90,209,255,0.45)'; }
      else if (BR) { bg = 'rgba(255,126,182,0.16)'; bd = 'rgba(255,126,182,0.45)'; }
      // inner pocket frame: draw a rounded inner panel on the corner anchor only
      return { type: 'base', bg: bg, bd: bd };
    }
    if (r === 7 && c === 7) return { type: 'home' };
    if (xLaneSet[k]) return { type: 'lane', color: X_COLOR };
    if (oLaneSet[k]) return { type: 'lane', color: O_COLOR };
    if (trackSet.hasOwnProperty(k)) {
      var absIdx = trackSet[k];
      var isSafe = SAFE[absIdx] === 1;
      var isXentry = absIdx === 0;
      var isOentry = absIdx === 26;
      return { type: 'track', safe: isSafe, xentry: isXentry, oentry: isOentry };
    }
    return { type: 'empty' };
  }

  // Render grid background cells
  var gridCells = [];
  for (var rr = 0; rr < 15; rr++) {
    for (var cc = 0; cc < 15; cc++) {
      var p = paintCell(rr, cc);
      var style = {
        position: 'absolute',
        left: cc * CELL, top: rr * CELL, width: CELL, height: CELL,
        boxSizing: 'border-box'
      };
      if (p.type === 'base') {
        style.background = p.bg;
        style.border = '1px solid ' + p.bd;
      } else if (p.type === 'home') {
        style.background = 'radial-gradient(circle at 50% 40%, #1b2435, #0c1018)';
        style.border = '1px solid #2a3a52';
        style.display = 'flex'; style.alignItems = 'center'; style.justifyContent = 'center';
        style.fontSize = 13; style.zIndex = 1;
      } else if (p.type === 'lane') {
        style.background = p.color;
        style.opacity = 0.55;
        style.border = '1px solid rgba(255,255,255,0.18)';
      } else if (p.type === 'track') {
        style.background = p.safe ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.80)';
        style.border = '1px solid #c9d4e3';
        if (p.xentry) { style.background = 'rgba(90,209,255,0.85)'; style.border = '1px solid #5ad1ff'; }
        if (p.oentry) { style.background = 'rgba(255,126,182,0.85)'; style.border = '1px solid #ff7eb6'; }
        if (p.safe && !p.xentry && !p.oentry) style.boxShadow = 'inset 0 0 0 2px rgba(120,140,170,0.35)';
      } else {
        style.background = 'transparent';
      }
      gridCells.push(React.createElement('div', {
        key: 'g-' + rr + '-' + cc,
        style: style
      }, p.type === 'home' ? '🏠' : null));
    }
  }

  // ── Token discs (placed on mapped cells, on top of grid) ──
  function discEl(mark, i, pos, tappable){
    var cell = cellFor(mark, i, pos);
    var color = mark === 'X' ? X_COLOR : O_COLOR;
    var key = mark + '-' + i;
    var hopping = hop === key;
    var movable = tappable && isMovable(i);
    // slight offset so two discs on same cell don't fully overlap
    var jitter = (i % 2) * 3 - 1;
    var size = 16;
    var left = cell[1] * CELL + (CELL - size) / 2 + jitter;
    var top  = cell[0] * CELL + (CELL - size) / 2 - jitter;
    var cls = 'ringin-tap' + (hopping ? ' ringin-token-hop' : '') + (movable ? ' ringin-turn-glow' : '');
    var style = {
      position: 'absolute', left: left, top: top, width: size, height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, ' + color + ' 45%, ' + color + ' 100%)',
      border: '1.5px solid rgba(255,255,255,0.85)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
      zIndex: movable ? 6 : 4,
      cursor: movable ? 'pointer' : 'default',
      transition: 'left .28s cubic-bezier(.34,1.56,.64,1), top .28s cubic-bezier(.34,1.56,.64,1)'
    };
    return React.createElement('div', {
      key: key,
      onClick: movable ? function(){ doMove(i); } : undefined,
      role: movable ? 'button' : undefined,
      'aria-label': (mark === myMark ? 'your' : 'opponent') + ' token ' + (i + 1),
      style: style
    });
  }

  var discs = [];
  // opponent first (under), then mine (on top + interactive)
  for (var oi = 0; oi < 4; oi++) discs.push(discEl(oppMark, oi, oppToks[oi], false));
  for (var mi = 0; mi < 4; mi++) discs.push(discEl(myMark, mi, myToks[mi], true));

  var boardEl = React.createElement('div', {
    style: {
      position: 'relative', width: BOARD, height: BOARD,
      borderRadius: 16, overflow: 'hidden',
      background: 'linear-gradient(135deg,#0a0e16,#0d1320)',
      border: '1px solid #1c2230',
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
      margin: '0 auto'
    }
  }, gridCells.concat(discs));

  // ── Dice + roll button ──
  var dieShown = shaking ? fakeFace : (roll != null ? roll : lastRoll);
  var dieFace = (dieShown != null && DIE_FACES[dieShown]) ? DIE_FACES[dieShown] : '🎲';
  var dieEl = React.createElement('div', {
    className: shaking ? 'ringin-dice-shake' : '',
    style: {
      width: 52, height: 52, borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 38, lineHeight: '52px',
      background: 'linear-gradient(145deg,#f5f7fb,#cdd6e4)',
      color: (roll != null || shaking) ? '#1a2233' : '#6b7585',
      boxShadow: '0 3px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)'
    }
  }, dieFace);

  var rollBtn = null;
  if (myTurn && roll == null && !err) {
    rollBtn = React.createElement('button', {
      className: 'ringin-tap',
      onClick: doRoll,
      disabled: busy || shaking,
      style: {
        border: 'none', borderRadius: 14, padding: '12px 30px',
        fontSize: 17, fontWeight: 800,
        background: (busy || shaking) ? '#2a2f3a' : ('linear-gradient(135deg,' + myColor + ',#9bf0ff)'),
        color: (busy || shaking) ? '#5f6776' : '#06121a',
        cursor: (busy || shaking) ? 'default' : 'pointer',
        boxShadow: (busy || shaking) ? 'none' : ('0 4px 16px ' + myColor + '66')
      }
    }, shaking ? 'Rolling…' : '🎲 Roll');
  }

  var dieRow = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, margin: '12px 0 4px', minHeight: 56
    }
  }, dieEl, rollBtn || React.createElement('div', {
    style: { fontSize: 13, color: '#9fb0c3', minWidth: 90 }
  }, roll != null ? ('Rolled ' + roll) : (lastRoll != null ? ('Last roll ' + lastRoll) : 'No roll yet')));

  // ── Legend + turn indicator ──
  function chipDot(color){
    return React.createElement('span', {
      style: { width: 11, height: 11, borderRadius: '50%', display: 'inline-block',
        background: 'radial-gradient(circle at 35% 30%, #fff, ' + color + ' 60%)',
        border: '1px solid rgba(255,255,255,0.6)' }
    });
  }
  var legend = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 10, fontSize: 12, color: '#9fb0c3' }
  },
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, chipDot(myColor), 'You (' + myMark + ')'),
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, chipDot(oppColor), 'Opp (' + oppMark + ')'),
    React.createElement('span', {
      style: { fontWeight: 700, color: isOver ? '#9fb0c3' : (myTurn ? myColor : oppColor) }
    }, 'Turn: ' + (isOver ? '—' : (turn ? (turn === myMark ? 'You' : 'Opp') : '—')))
  );

  // ── Header + status ──
  var header = React.createElement('div', {
    style: { fontSize: 19, fontWeight: 800, color: '#e8edf4', marginBottom: 2, textAlign: 'center', letterSpacing: 0.3 }
  }, '🎲 Ludo');

  var subStatus = React.createElement('div', {
    style: {
      fontSize: 14, fontWeight: 700,
      color: isOver ? '#9fb0c3' : (myTurn ? myColor : '#9fb0c3'),
      marginBottom: 8, textAlign: 'center', minHeight: 18,
      animation: myTurn && roll == null && !shaking ? undefined : undefined
    }
  }, statusText());

  // ── Controls row: Minimise (prominent) / Forfeit / Close ──
  var minBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onMinimize) onMinimize(); },
    style: {
      border: 'none', borderRadius: 12, padding: '11px 16px', fontWeight: 800, fontSize: 14,
      flex: '1 1 auto',
      background: 'linear-gradient(135deg,#2b6cff,#5a8dff)', color: '#fff',
      boxShadow: '0 4px 14px rgba(43,108,255,0.4)', cursor: 'pointer'
    }
  }, '▽ Minimise');

  var forfeitBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: doForfeit,
    disabled: busy || isOver || !!err || !game,
    style: {
      border: 'none', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 14,
      background: (busy || isOver || err || !game) ? '#23262f' : '#3a2230',
      color: (busy || isOver || err || !game) ? '#5f6776' : '#ff8fb0',
      cursor: (busy || isOver || err || !game) ? 'default' : 'pointer'
    }
  }, 'Forfeit');

  var closeBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onClose) onClose(); },
    style: {
      border: 'none', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 14,
      background: '#1c222c', color: '#cfd8e3', cursor: 'pointer'
    }
  }, 'Close');

  var controls = React.createElement('div', {
    style: { display: 'flex', gap: 9, marginTop: 14, width: '100%' }
  }, minBtn, forfeitBtn, closeBtn);

  // ── Win/Lose/Draw celebration overlay (inside card) ──
  var overlay = null;
  if (isOver) {
    var iWon = !!(game && game.winner && myUserId && game.winner === myUserId);
    var isDraw = status === 'draw';
    var big, bigCls, accent;
    if (isDraw) { big = 'Draw'; bigCls = 'ringin-game-win'; accent = '#cfd8e3'; }
    else if (iWon) { big = 'You win! 🎉'; bigCls = 'ringin-game-win'; accent = myColor; }
    else { big = 'You lost'; bigCls = 'ringin-game-lose'; accent = '#9fb0c3'; }

    var overlayKids = [];

    // radiating rays + confetti only on a win
    if (iWon) {
      var rays = [];
      for (var ry = 0; ry < 8; ry++) {
        rays.push(React.createElement('div', {
          key: 'ray-' + ry, className: 'ringin-win-ray',
          style: {
            position: 'absolute', left: '50%', top: '42%',
            width: 5, height: 120, marginLeft: -2.5, marginTop: -60,
            background: 'linear-gradient(' + accent + ',transparent)',
            transformOrigin: '50% 100%',
            transform: 'rotate(' + (ry * 45) + 'deg)',
            opacity: 0, borderRadius: 3
          }
        }));
      }
      overlayKids.push(React.createElement('div', {
        key: 'rays', style: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }
      }, rays));

      var confColors = [myColor, '#ffd45a', '#9bf0ff', '#ff7eb6', '#7CFFB2', '#fff'];
      var conf = [];
      for (var ci = 0; ci < 14; ci++) {
        conf.push(React.createElement('div', {
          key: 'c-' + ci, className: 'ringin-confetti',
          style: {
            position: 'absolute', top: -10, left: (6 + ci * 6.6) + '%',
            width: 8, height: 12, borderRadius: 2,
            background: confColors[ci % confColors.length],
            animationDelay: (ci * 0.08) + 's',
            transform: 'rotate(' + (ci * 33) + 'deg)'
          }
        }));
      }
      overlayKids.push(React.createElement('div', {
        key: 'conf', style: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }
      }, conf));
    }

    overlayKids.push(React.createElement('div', {
      key: 'big', className: bigCls,
      style: {
        position: 'relative', zIndex: 2,
        fontSize: 32, fontWeight: 900, color: accent,
        textShadow: '0 4px 18px rgba(0,0,0,0.6)', textAlign: 'center'
      }
    }, big));

    if (status === 'abandoned') {
      overlayKids.push(React.createElement('div', {
        key: 'ff', className: 'ringin-result-in',
        style: { position: 'relative', zIndex: 2, marginTop: 8, fontSize: 14, color: '#9fb0c3' }
      }, iWon ? 'Opponent forfeited' : 'You forfeited'));
    }

    overlayKids.push(React.createElement('button', {
      key: 'done', className: 'ringin-tap',
      onClick: function(){ if (onClose) onClose(); },
      style: {
        position: 'relative', zIndex: 2, marginTop: 22,
        border: 'none', borderRadius: 12, padding: '11px 28px', fontWeight: 800, fontSize: 15,
        background: iWon ? ('linear-gradient(135deg,' + accent + ',#fff)') : '#1c222c',
        color: iWon ? '#06121a' : '#cfd8e3', cursor: 'pointer'
      }
    }, 'Done'));

    overlay = React.createElement('div', {
      style: {
        position: 'absolute', inset: 0, borderRadius: 20,
        background: 'rgba(8,11,18,0.82)', backdropFilter: 'blur(3px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 20, overflow: 'hidden'
      }
    }, overlayKids);
  }

  // ── Body ──
  var bodyKids = [];
  if (err) {
    bodyKids.push(React.createElement('div', {
      key: 'err', style: { padding: '30px 10px', textAlign: 'center', color: '#9fb0c3', fontSize: 14 }
    }, 'Game unavailable. Please try again later.'));
  } else if (loading || !game) {
    bodyKids.push(React.createElement('div', {
      key: 'load', style: { padding: '40px 10px', textAlign: 'center', color: '#9fb0c3', fontSize: 14 }
    }, 'Loading…'));
  } else {
    bodyKids.push(React.createElement('div', { key: 'board' }, boardEl));
    bodyKids.push(React.createElement('div', { key: 'die' }, dieRow));
    bodyKids.push(React.createElement('div', { key: 'leg' }, legend));
  }

  return React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 18, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 360, margin: '0 auto',
      maxHeight: '90vh', overflowY: 'auto',
      color: '#e8edf4'
    }
  }, header, subStatus,
     React.createElement('div', {
       key: 'body',
       style: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }
     }, bodyKids),
     controls, overlay);
}
