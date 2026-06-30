/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// LudoGame — in-call / in-room 2-player Ludo, rebuilt as a CLASSIC 4-COLOR,
// animated board. Server-authoritative: ludo_roll / ludo_move / get_game /
// forfeit_game decide everything. We never roll our own dice and never compute
// the winner — we render game_sessions.state.
//
// state (0061): { tokens:{X:[p,p,p,p],O:[p,p,p,p]}, roll:1..6|null,
//                 last_roll:1..6|null, must_move:bool }
//   pos: -1 base; 0..50 shared track (abs=(entry+pos)%52, entry X=0/O=26);
//        51..55 home lane (5 cells); 56 lane tip; 57 = HOME (center).
//        Win = all four === 57.
//
// BOARD: classic 15×15 grid. RED(top-left)=X, YELLOW(bottom-right)=O (matches
// entry X=0 / O=26). GREEN(top-right)+BLUE(bottom-left) render full solid color
// (decorative — no live tokens). BOARD is classic; TOKEN DISCS keep brand colors
// (X #5ad1ff, O #ff7eb6) so "me vs them" is obvious. 52-cell track derived as a
// contiguous clockwise loop (4 canonical corner L-turns, no orphan cell).
//
// ANIMATIONS: dice shake gated on BOTH timer + server roll (pendingRoll); per-
// cell hop (one abs cell every ~180ms via setInterval, mountedRef-guarded);
// capture fly-back diffed from realtime; out-of-base pop; turn glow / locked dim
// / nudge on illegal tap; clear "need a 6" messaging.
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';
import { playUnlikeSound } from '../utils/soundEngine';

// Token disc brand colors (me vs them) — board is classic, discs are brand.
var X_COLOR = '#5ad1ff';
var O_COLOR = '#ff7eb6';
var X_DARK  = '#2a86a8';
var O_DARK  = '#b8497f';

// Classic board palette.
var RED    = '#E94B4B'; // top-left  (X)
var GREEN  = '#3FC36B'; // top-right (decorative)
var YELLOW = '#F2C230'; // bottom-right (O)
var BLUE   = '#3B9BE0'; // bottom-left (decorative)
var GRID_LINE = '#C9D4E3';
var TRACK_WHITE = '#ffffff';

var DIE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

// ── 52-cell shared TRACK (abs 0..51), 0-indexed [row,col] on the 15×15 grid.
// Clockwise from RED(X) entry (6,1) === abs0. O(YELLOW) entry === abs26 (8,13).
// The 4 corner turns are the canonical Ludo L-steps (each turn cell belongs to a
// home lane, not the track) — every loop cell is visited, no orphan.
var TRACK = [
  [6,1],[6,2],[6,3],[6,4],[6,5],            // 0-4   left arm, row6
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],      // 5-10  up col6
  [0,7],                                    // 11    top centre top
  [0,8],                                    // 12
  [1,8],[2,8],[3,8],[4,8],[5,8],            // 13-17 down col8
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14], // 18-23 right arm, row6
  [7,14],                                   // 24
  [8,14],                                   // 25
  [8,13],[8,12],[8,11],[8,10],[8,9],        // 26-30 left along row8
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8], // 31-36 down col8
  [14,7],                                   // 37    bottom centre
  [14,6],                                   // 38
  [13,6],[12,6],[11,6],[10,6],[9,6],        // 39-43 up col6
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],      // 44-49 left along row8
  [7,0],                                    // 50    left centre
  [6,0]                                     // 51
];

// Home lanes (5 colored cells), pos 51..55 (lane), 56 = lane tip.
// X(RED): row7 cols 1..5 → tip (7,6). O(YELLOW): row7 cols 13..9 → tip (7,8).
var HOME_LANE_X = [[7,1],[7,2],[7,3],[7,4],[7,5]];
var TIP_X = [7,6];
var HOME_LANE_O = [[7,13],[7,12],[7,11],[7,10],[7,9]];
var TIP_O = [7,8];
var CENTER = [7, 7];

// Decorative GREEN (top, col7) + BLUE (bottom, col7) home lanes — no live
// tokens (only X/O play) but painted full color so the board reads as an
// authentic 4-color classic Ludo board. GREEN: col7 rows 1..5 → tip (6,7).
// BLUE: col7 rows 13..9 → tip (8,7).
var HOME_LANE_GREEN = [[1,7],[2,7],[3,7],[4,7],[5,7]];
var TIP_GREEN = [6,7];
var HOME_LANE_BLUE = [[13,7],[12,7],[11,7],[10,7],[9,7]];
var TIP_BLUE = [8,7];

// SAFE stars at these abs cells. Colored entries vs neutral handled at paint.
var SAFE = { 0:1, 8:1, 13:1, 21:1, 26:1, 34:1, 39:1, 47:1 };
var COLORED_ENTRY = { 0:1, 13:1, 26:1, 39:1 }; // get a colored star

// Base pocket anchors (2×2 inside each 6×6 corner base).
var BASE_X  = [[1,1],[1,4],[4,1],[4,4]];          // RED  top-left  (X)
var BASE_O  = [[10,10],[10,13],[13,10],[13,13]];  // YELLOW bottom-right (O)

// Micro-grid sub-cell offsets for fanning >1 same-color token on a cell.
var SUB = [[0.30,0.30],[0.70,0.30],[0.30,0.70],[0.70,0.70]];

function darker(c){ return c === X_COLOR ? X_DARK : O_DARK; }

export default function LudoGame(props){
  var gameId   = props.gameId;
  var myMark   = props.myMark;
  var myUserId = props.myUserId;
  var onClose  = props.onClose;
  var onMinimize = props.onMinimize;
  // SHARED CONTRACT: only the INITIATOR (canClose !== false) may drive game
  // lifecycle (Close / Other games / Play again). The host (canClose === false)
  // gets only Minimise + Forfeit; their window is closed via initiator broadcast.
  var canClose = props.canClose !== false;

  // ── State (all hooks BEFORE any conditional return) ──
  var gameS = useState(null);
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);
  var busy = busyS[0]; var setBusy = busyS[1];

  var shakingS = useState(false);     // dice mid-roll (cosmetic)
  var shaking = shakingS[0]; var setShaking = shakingS[1];

  var fakeFaceS = useState(1);        // spinning cosmetic face during shake
  var fakeFace = fakeFaceS[0]; var setFakeFace = fakeFaceS[1];

  var settleS = useState(false);      // play dice-settle once authoritative roll lands
  var settle = settleS[0]; var setSettle = settleS[1];

  // Optimistic move overlay: { mark, idx, pos } — supersedes server tokens for
  // my moving token while the per-cell hop plays out.
  var optS = useState(null);
  var opt = optS[0]; var setOpt = optS[1];

  // Token key (mark+'-'+i) currently hopping → re-trigger hop/land/pop classes.
  var animS = useState(null);         // { key, cls }
  var anim = animS[0]; var setAnim = animS[1];

  // Capture animation overlay: map of "mark-idx" → { dx,dx2,dy2 } currently flying.
  var capS = useState(null);
  var cap = capS[0]; var setCap = capS[1];

  // Transient toast (e.g. "need a 6").
  var toastS = useState('');
  var toast = toastS[0]; var setToast = toastS[1];

  // Container width for responsive sizing.
  var cwS = useState(0);
  var cw = cwS[0]; var setCw = cwS[1];

  var mountedRef = useRef(true);
  var bodyRef = useRef(null);
  var shakeTimerRef = useRef(null);
  var spinTimerRef = useRef(null);
  var settleTimerRef = useRef(null);
  var animTimerRef = useRef(null);
  var toastTimerRef = useRef(null);
  var capTimerRef = useRef(null);
  var hopIvRef = useRef(null);
  var pollRef = useRef(null);           // finishThenApply hop-completion poll (tracked so unmount can clear it)
  var pendingRollRef = useRef(false);   // a server roll is mid-flight
  var prevTokensRef = useRef(null);     // last-known authoritative tokens (capture diff)
  var diceSpinRef = useRef(0);          // accumulating full-turn count so each roll tumbles further

  function clearHopIv(){ if (hopIvRef.current) { clearInterval(hopIvRef.current); hopIvRef.current = null; } }

  // ── Measure container width ──
  useEffect(function(){
    function measure(){
      if (!mountedRef.current) return;
      var w = (bodyRef.current && bodyRef.current.clientWidth) || (window.innerWidth - 52);
      setCw(w);
    }
    measure();
    window.addEventListener('resize', measure);
    return function(){ window.removeEventListener('resize', measure); };
  }, []);

  // ── Seed from get_game ──
  function reseed(){
    (async function(){
      try {
        var r = await sb.rpc('get_game', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && r.error) { setErr('Game unavailable'); setLoading(false); return; }
        var row = r ? r.data : null;
        if (Array.isArray(row)) row = row[0];
        if (!row) { setErr('Game unavailable'); setLoading(false); return; }
        // N1: honor a close that happened while we were disconnected (the realtime
        // UPDATE can be missed) so the host's window closes on reconnect too.
        if (row.closed_at) { clearHopIv(); if (onClose) onClose(); return; }
        prevTokensRef.current = readTokens(row);
        setGame(row); setLoading(false);
      } catch (_) {
        if (!mountedRef.current) return;
        setErr('Game unavailable'); setLoading(false);
      }
    })();
  }

  useEffect(function(){
    mountedRef.current = true;
    reseed();
    return function(){};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ── Realtime UPDATE subscription + reconnect re-seed ──
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
          if (n && n.id) applyServer(n);
        })
        .subscribe(function(stt){
          if (!mountedRef.current) return;
          if (stt === 'CHANNEL_ERROR' || stt === 'TIMED_OUT' || stt === 'CLOSED') {
            // Don't freeze — re-seed from authoritative state.
            try { reseed(); } catch (_) {}
          }
        });
    } catch (_) { ch = null; }
    return function(){ if (ch) { try { sb.removeChannel(ch); } catch (_) {} } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ── Cleanup ──
  useEffect(function(){
    return function(){
      mountedRef.current = false;
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      clearHopIv();
    };
  }, []);

  // ── Helpers to read tokens off a row ──
  function readTokens(row){
    var st = row && row.state && typeof row.state === 'object' ? row.state : null;
    var tk = st && st.tokens && typeof st.tokens === 'object' ? st.tokens : null;
    function arr(m){
      if (tk && Array.isArray(tk[m]) && tk[m].length === 4) return tk[m].slice();
      return [-1,-1,-1,-1];
    }
    return { X: arr('X'), O: arr('O') };
  }

  // ── Apply an authoritative server row: diff for captures, then commit ──
  function applyServer(row){
    // N1: initiator closed the game (durable closed_at marker) → mirror the
    // dismissal even if the broadcast was lost. Stop any hop animation first (B7).
    // Never set during play / on a result. undefined pre-migration → no-op.
    if (row && row.closed_at) { clearHopIv(); if (onClose) onClose(); return; }
    var next = readTokens(row);
    var prev = prevTokensRef.current;
    var oppMarkLocal = myMark === 'X' ? 'O' : 'X';
    // Capture fly-back: any OPPONENT token going 0..50 → -1 since last known.
    if (prev) {
      var flying = {};
      var found = false;
      for (var i = 0; i < 4; i++) {
        var pPrev = prev[oppMarkLocal][i];
        var pNext = next[oppMarkLocal][i];
        if (pPrev >= 0 && pPrev <= 50 && pNext === -1) {
          // direction toward captured token's base corner
          var fromCell = TRACK[((oppMarkLocal === 'X' ? 0 : 26) + pPrev) % 52];
          var toCell = (oppMarkLocal === 'X' ? BASE_X[i] : BASE_O[i]);
          var dx = (toCell[1] - fromCell[1]);
          var dy = (toCell[0] - fromCell[0]);
          flying[oppMarkLocal + '-' + i] = {
            dx: Math.max(-30, Math.min(30, dx * 6)),
            dx2: dx * 14,
            dy2: dy * 14
          };
          found = true;
        }
      }
      if (found) {
        setCap(flying);
        try { playUnlikeSound(); } catch (_) {}
        if (capTimerRef.current) clearTimeout(capTimerRef.current);
        capTimerRef.current = setTimeout(function(){ if (mountedRef.current) setCap(null); }, 440);
      }
    }
    prevTokensRef.current = next;
    // Settle the dice if a fresh roll arrived.
    pendingRollRef.current = false;
    setGame(row);
    // Server supersedes any optimistic overlay — but only once the hop finished.
    if (!hopIvRef.current) setOpt(null);
  }

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

  // Apply optimistic overlay (intermediate hop step) to my tokens.
  var myToks = myToksRaw.slice();
  if (opt && opt.mark === myMark && opt.idx >= 0 && opt.idx < 4) {
    myToks[opt.idx] = opt.pos;
  }

  // Movable: server rule, NO clamp. Locked while a hop or optimistic move plays.
  function isMovable(i){
    if (!myTurn || roll == null || opt || hopIvRef.current) return false;
    var t = myToksRaw[i];
    if (t === -1) return roll === 6;
    if (t >= 0 && t <= 56) return (t + roll) <= 57;
    return false;
  }
  var anyMovable = isMovable(0) || isMovable(1) || isMovable(2) || isMovable(3);
  var allInBase = myToksRaw[0] === -1 && myToksRaw[1] === -1 && myToksRaw[2] === -1 && myToksRaw[3] === -1;

  // ── Toast helper ──
  function showToast(msg, ms){
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(function(){ if (mountedRef.current) setToast(''); }, ms || 1400);
  }

  // ── Actions ──
  function doRoll(){
    if (busy || shaking || !game || !myTurn || roll != null || err) return;
    setBusy(true);
    setShaking(true);
    setSettle(false);
    pendingRollRef.current = true;
    // add a few extra full turns each roll so the cube keeps tumbling forward
    diceSpinRef.current = (diceSpinRef.current || 0) + 3;
    // cosmetic spinning face during the shake
    spinTimerRef.current = setInterval(function(){
      if (!mountedRef.current) return;
      setFakeFace(Math.floor(Math.random() * 6) + 1);
    }, 70);
    var timerDone = false;
    var serverDone = false;
    function maybeStop(){
      if (!mountedRef.current) return;
      if (timerDone && serverDone) {
        if (spinTimerRef.current) { clearInterval(spinTimerRef.current); spinTimerRef.current = null; }
        setShaking(false);
        // play the authoritative settle
        setSettle(true);
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(function(){ if (mountedRef.current) setSettle(false); }, 280);
      }
    }
    // Gate shake-END on BOTH the timer AND the server roll arriving.
    shakeTimerRef.current = setTimeout(function(){ timerDone = true; maybeStop(); }, 520);
    (async function(){
      try {
        var r = await sb.rpc('ludo_roll', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data; if (Array.isArray(row)) row = row[0];
          if (row && row.id) applyServer(row);
        }
      } catch (_) {} finally {
        pendingRollRef.current = false;
        if (mountedRef.current) { setBusy(false); serverDone = true; maybeStop(); }
      }
    })();
  }

  // Predicted final pos — exactly t+roll (no clamp; gated by movable rule).
  function predictPos(i){
    var t = myToksRaw[i];
    if (t === -1) return 0;
    return t + (roll || 0);
  }

  function doMove(i){
    if (busy || !game || !myTurn || roll == null || err || opt || hopIvRef.current) {
      // tapping a not-yet-movable token → nudge + toast
      if (myTurn && roll != null && !isMovable(i)) {
        nudge(myMark + '-' + i);
        showToast(allInBase ? 'Roll a 6 to leave base' : 'Need exact roll');
      }
      return;
    }
    if (!isMovable(i)) {
      nudge(myMark + '-' + i);
      showToast(allInBase ? 'Roll a 6 to leave base' : 'Need exact roll');
      return;
    }

    var start = myToksRaw[i];
    var dest = predictPos(i);
    var leavingBase = (start === -1);
    setBusy(true);

    // Build the path of intermediate positions and advance one cell per ~180ms.
    var path = [];
    if (leavingBase) {
      path = [0]; // -1 → 0 (single step out of base)
    } else {
      for (var p = start + 1; p <= dest; p++) path.push(p);
    }

    // Out-of-base pop on the first frame; else hop.
    if (leavingBase) {
      triggerAnim(myMark + '-' + i, 'ringin-token-pop');
      setOpt({ mark: myMark, idx: i, pos: 0 });
    }

    var step = 0;
    function advance(){
      if (!mountedRef.current) { clearHopIv(); return; }
      var pos = path[step];
      setOpt({ mark: myMark, idx: i, pos: pos });
      triggerAnim(myMark + '-' + i, 'ringin-token-land');
      step++;
      if (step >= path.length) {
        clearHopIv();
      }
    }

    if (leavingBase) {
      // already placed at 0 via pop; no multi-step hop interval needed
      clearHopIv();
    } else {
      // first hop immediately, then interval
      triggerAnim(myMark + '-' + i, 'ringin-token-hop');
      advance();
      if (step < path.length) {
        hopIvRef.current = setInterval(function(){
          triggerAnim(myMark + '-' + i, 'ringin-token-hop');
          advance();
        }, 180);
      }
    }

    (async function(){
      var got = false;
      try {
        var r = await sb.rpc('ludo_move', { p_game: gameId, p_token: i });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data; if (Array.isArray(row)) row = row[0];
          if (row && row.id) {
            // Wait for the local hop to finish before letting server supersede.
            got = true; finishThenApply(row);
          }
        } else {
          clearHopIv(); setOpt(null);   // rejected → revert
        }
      } catch (_) {
        if (mountedRef.current) { clearHopIv(); setOpt(null); }
      } finally {
        if (mountedRef.current) setBusy(false);
        if (mountedRef.current && !got && !hopIvRef.current) { clearHopIv(); setOpt(null); reseed(); }
      }
    })();
  }

  // Hold the authoritative row until the multi-step hop animation completes.
  function finishThenApply(row){
    function commit(){
      if (!mountedRef.current) return;
      clearHopIv();
      setOpt(null);
      applyServer(row);
    }
    if (hopIvRef.current) {
      // poll until the interval cleared itself (step reached end)
      var waited = 0;
      pollRef.current = setInterval(function(){
        waited += 60;
        if (!mountedRef.current || !hopIvRef.current || waited > 2000) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          commit();
        }
      }, 60);
    } else {
      // tiny delay so the last land frame is visible
      setTimeout(commit, 120);
    }
  }

  function triggerAnim(key, cls){
    setAnim({ key: key, cls: cls });
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(function(){ if (mountedRef.current) setAnim(null); }, 320);
  }

  function nudge(key){
    triggerAnim(key, 'ringin-token-nudge');
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
      if (shaking || pendingRollRef.current) return 'Rolling…';
      if (roll == null) return 'Your turn — roll the die';
      if (opt || hopIvRef.current) return 'Moving…';
      if (!anyMovable) {
        if (allInBase) return 'Rolled ' + roll + ' — need a 6 to leave base';
        return 'Rolled ' + roll + ' — no moves, passing…';
      }
      return 'You rolled ' + roll + ' — tap a glowing token';
    }
    return "Opponent's turn";
  }

  // ── Map a token's pos → [row,col] ──
  function cellFor(mark, pos){
    var entry = mark === 'X' ? 0 : 26;
    if (pos === -1) return null; // base — handled separately (fanned anchors)
    if (pos >= 0 && pos <= 50) return TRACK[(entry + pos) % 52];
    if (pos >= 51 && pos <= 55) {
      var idx = pos - 51;
      return (mark === 'X') ? HOME_LANE_X[idx] : HOME_LANE_O[idx];
    }
    if (pos === 56) return (mark === 'X') ? TIP_X : TIP_O;
    if (pos === 57) return CENTER;
    return CENTER;
  }

  // ── Responsive sizing ──
  var CELL = Math.max(18, Math.floor(Math.min(cw || 320, 330) / 15));
  var BOARD = CELL * 15;
  var DISC = Math.round(CELL * 0.72);

  // ── Build static grid backgrounds ──
  function cellKey(r, c){ return r + ',' + c; }
  var trackSet = {};
  for (var ti = 0; ti < TRACK.length; ti++) trackSet[cellKey(TRACK[ti][0], TRACK[ti][1])] = ti;
  var xLaneSet = {}; for (var li = 0; li < HOME_LANE_X.length; li++) xLaneSet[cellKey(HOME_LANE_X[li][0], HOME_LANE_X[li][1])] = 1;
  xLaneSet[cellKey(TIP_X[0], TIP_X[1])] = 1;
  var oLaneSet = {}; for (var lj = 0; lj < HOME_LANE_O.length; lj++) oLaneSet[cellKey(HOME_LANE_O[lj][0], HOME_LANE_O[lj][1])] = 1;
  oLaneSet[cellKey(TIP_O[0], TIP_O[1])] = 1;
  // Decorative green/blue lane cells (tips fall in the center region, drawn by the
  // triangles SVG, so only the 5 lane cells each are painted here).
  var gLaneSet = {}; for (var lg = 0; lg < HOME_LANE_GREEN.length; lg++) gLaneSet[cellKey(HOME_LANE_GREEN[lg][0], HOME_LANE_GREEN[lg][1])] = 1;
  var bLaneSet = {}; for (var lb = 0; lb < HOME_LANE_BLUE.length; lb++) bLaneSet[cellKey(HOME_LANE_BLUE[lb][0], HOME_LANE_BLUE[lb][1])] = 1;

  function inBox(r, c, r0, c0){ return r >= r0 && r < r0 + 6 && c >= c0 && c < c0 + 6; }

  var gridCells = [];
  for (var rr = 0; rr < 15; rr++) {
    for (var cc = 0; cc < 15; cc++) {
      var k = cellKey(rr, cc);
      var style = {
        position: 'absolute',
        left: cc * CELL, top: rr * CELL, width: CELL, height: CELL,
        boxSizing: 'border-box'
      };
      var content = null;

      var TL = inBox(rr, cc, 0, 0);   // RED  (X)
      var TR = inBox(rr, cc, 0, 9);   // GREEN (decorative)
      var BL = inBox(rr, cc, 9, 0);   // BLUE  (decorative)
      var BR = inBox(rr, cc, 9, 9);   // YELLOW (O)
      var inCenter = rr >= 6 && rr <= 8 && cc >= 6 && cc <= 8;

      if (inCenter) {
        // center finish — rendered by the SVG triangles overlay; keep cell plain
        style.background = '#0e1320';
      } else if (TL || TR || BL || BR) {
        // ALL FOUR corner bases render SOLID/vivid (classic 4-color board).
        var col = TL ? RED : TR ? GREEN : BL ? BLUE : YELLOW;
        style.background = col;
        style.border = '1px solid ' + GRID_LINE;
        // Full base styling drawn once per base, anchored at its top-left cell:
        // colored 6×6 square (this background) + inner white panel + 4 token pockets.
        var anchorR = TL ? 0 : TR ? 0 : BL ? 9 : 9;
        var anchorC = TL ? 0 : TR ? 9 : BL ? 0 : 9;
        if (rr === anchorR && cc === anchorC) {
          // white rounded panel inset 1 cell (4×4)
          var panel = React.createElement('div', {
            key: 'panel',
            style: {
              position: 'absolute', left: CELL, top: CELL,
              width: CELL * 4, height: CELL * 4,
              background: 'rgba(255,255,255,0.92)',
              borderRadius: Math.round(CELL * 0.5),
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.18)'
            }
          });
          // 4 colored token pockets centered inside the white panel (2×2 layout)
          var pocketSize = Math.round(CELL * 0.9);
          var pockOff = [[1.55, 1.55], [3.45, 1.55], [1.55, 3.45], [3.45, 3.45]];
          var pockets = [];
          for (var pk = 0; pk < 4; pk++) {
            pockets.push(React.createElement('div', {
              key: 'pock-' + pk,
              style: {
                position: 'absolute',
                left: Math.round(pockOff[pk][0] * CELL - pocketSize / 2),
                top: Math.round(pockOff[pk][1] * CELL - pocketSize / 2),
                width: pocketSize, height: pocketSize, borderRadius: '50%',
                background: col,
                border: '2px solid rgba(255,255,255,0.95)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)'
              }
            }));
          }
          content = React.createElement('div', {
            style: { position: 'absolute', left: 0, top: 0, width: CELL * 6, height: CELL * 6, pointerEvents: 'none' }
          }, [panel].concat(pockets));
        }
      } else if (xLaneSet[k]) {
        style.background = RED;
        style.border = '1px solid ' + GRID_LINE;
      } else if (oLaneSet[k]) {
        style.background = YELLOW;
        style.border = '1px solid ' + GRID_LINE;
      } else if (gLaneSet[k]) {
        style.background = GREEN;
        style.border = '1px solid ' + GRID_LINE;
      } else if (bLaneSet[k]) {
        style.background = BLUE;
        style.border = '1px solid ' + GRID_LINE;
      } else if (trackSet.hasOwnProperty(k)) {
        var absIdx = trackSet[k];
        style.background = TRACK_WHITE;
        style.border = '1px solid ' + GRID_LINE;
        style.display = 'flex'; style.alignItems = 'center'; style.justifyContent = 'center';
        if (absIdx === 0) { style.background = RED; }
        else if (absIdx === 13) { style.background = GREEN; }
        else if (absIdx === 26) { style.background = YELLOW; }
        else if (absIdx === 39) { style.background = BLUE; }
        if (SAFE[absIdx]) {
          var starColor = COLORED_ENTRY[absIdx]
            ? (absIdx === 0 ? '#fff' : absIdx === 13 ? '#fff' : absIdx === 26 ? '#fff' : '#fff')
            : '#888';
          content = React.createElement('span', {
            style: { fontSize: Math.round(CELL * 0.62), lineHeight: 1, color: starColor, textShadow: '0 0 1px rgba(0,0,0,0.3)' }
          }, '★');
        }
      } else {
        style.background = '#0e1320';
      }

      gridCells.push(React.createElement('div', { key: 'g-' + rr + '-' + cc, style: style }, content));
    }
  }

  // ── Center triangles SVG (replaces 🏠) ──
  var triSize = CELL * 3;
  var triLeft = 6 * CELL, triTop = 6 * CELL;
  var triEl = React.createElement('svg', {
    width: triSize, height: triSize, viewBox: '0 0 100 100',
    style: { position: 'absolute', left: triLeft, top: triTop, zIndex: 2 }
  },
    // LEFT = RED (X)
    React.createElement('polygon', { points: '0,0 0,100 50,50', fill: RED }),
    // TOP = GREEN (full color)
    React.createElement('polygon', { points: '0,0 100,0 50,50', fill: GREEN }),
    // RIGHT = YELLOW (O)
    React.createElement('polygon', { points: '100,0 100,100 50,50', fill: YELLOW }),
    // BOTTOM = BLUE (full color)
    React.createElement('polygon', { points: '0,100 100,100 50,50', fill: BLUE }),
    // small white home glyph
    React.createElement('circle', { cx: 50, cy: 50, r: 9, fill: 'rgba(255,255,255,0.92)' }),
    React.createElement('text', { x: 50, y: 54, fontSize: 11, textAnchor: 'middle', fill: '#1a2233' }, '⌂')
  );

  // ── Token discs ──
  // Group same-color tokens by cell to fan overlaps + show ×N pill.
  function buildDiscs(mark, toks, tappable){
    var out = [];
    // group by cell key (only on-board / lane / home; base uses fixed anchors)
    var byCell = {};   // cellKey → [indices]
    for (var i = 0; i < 4; i++) {
      var pos = toks[i];
      if (pos === -1) continue;
      var cell = cellFor(mark, pos);
      if (!cell) continue;
      var ck = cell[0] + ',' + cell[1];
      if (!byCell[ck]) byCell[ck] = [];
      byCell[ck].push(i);
    }
    // base tokens at fixed pocket anchors
    var baseAnchors = (mark === 'X') ? BASE_X : BASE_O;
    for (var bi = 0; bi < 4; bi++) {
      if (toks[bi] !== -1) continue;
      out.push(makeDisc(mark, bi, baseAnchors[bi], 0, 1, tappable));
    }
    // on-board, fanned
    for (var ckk in byCell) {
      if (!byCell.hasOwnProperty(ckk)) continue;
      var idxs = byCell[ckk];
      var parts = ckk.split(',');
      var cellRC = [parseInt(parts[0], 10), parseInt(parts[1], 10)];
      var n = idxs.length;
      for (var s = 0; s < n; s++) {
        out.push(makeDisc(mark, idxs[s], cellRC, n > 1 ? s : -1, n, tappable));
      }
    }
    return out;
  }

  function makeDisc(mark, i, cell, subIdx, count, tappable){
    var color = mark === 'X' ? X_COLOR : O_COLOR;
    var dk = darker(color);
    var key = mark + '-' + i;
    var movable = tappable && isMovable(i);
    var cx, cy;
    if (subIdx >= 0) {
      var so = SUB[subIdx % 4];
      cx = cell[1] * CELL + so[0] * CELL;
      cy = cell[0] * CELL + so[1] * CELL;
    } else {
      cx = cell[1] * CELL + CELL / 2;
      cy = cell[0] * CELL + CELL / 2;
    }
    var size = (count > 1) ? Math.round(DISC * 0.62) : DISC;
    var left = cx - size / 2;
    var top  = cy - size / 2;

    var animCls = (anim && anim.key === key) ? (' ' + anim.cls) : '';
    var capCls = (cap && cap[key]) ? ' ringin-capture-fly' : '';
    var glow = movable ? ' ringin-turn-glow' : '';
    var cls = 'ringin-tap' + animCls + capCls + glow;

    var style = {
      position: 'absolute', left: left, top: top, width: size, height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fff, ' + color + ' 45%, ' + dk + ')',
      border: '1.6px solid #fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.3)',
      zIndex: movable ? 6 : 4,
      transition: 'left .26s cubic-bezier(.34,1.56,.64,1), top .26s cubic-bezier(.34,1.56,.64,1)',
      pointerEvents: 'none'
    };
    if (cap && cap[key]) {
      style['--dx'] = cap[key].dx + 'px';
      style['--dx2'] = cap[key].dx2 + 'px';
      style['--dy2'] = cap[key].dy2 + 'px';
    }

    var discDiv = React.createElement('div', { key: key, className: cls, style: style });

    // invisible ~32px hit-area so small movable discs stay tappable
    var hit = null;
    if (tappable) {
      var hitSize = Math.max(32, size + 12);
      hit = React.createElement('div', {
        key: key + '-hit',
        onClick: function(){ doMove(i); },
        role: 'button',
        'aria-label': (mark === myMark ? 'your' : 'opponent') + ' token ' + (i + 1),
        style: {
          position: 'absolute',
          left: cx - hitSize / 2, top: cy - hitSize / 2,
          width: hitSize, height: hitSize,
          borderRadius: '50%',
          background: 'transparent',
          zIndex: 7,
          cursor: movable ? 'pointer' : 'default'
        }
      });
    }

    var pill = null;
    if (count > 1 && subIdx === 0) {
      pill = React.createElement('div', {
        key: key + '-pill',
        style: {
          position: 'absolute',
          left: cell[1] * CELL + CELL - 8,
          top: cell[0] * CELL - 2,
          minWidth: 14, height: 14, padding: '0 3px',
          borderRadius: 7, background: '#101620', color: '#fff',
          fontSize: 9, fontWeight: 800, lineHeight: '14px', textAlign: 'center',
          border: '1px solid ' + color, zIndex: 8
        }
      }, '×' + count);
    }

    var kids = [discDiv];
    if (pill) kids.push(pill);
    if (hit) kids.push(hit);
    return kids;
  }

  var discs = [];
  // opponent first (under), then mine (on top + interactive)
  var oppDiscs = buildDiscs(oppMark, oppToks, false);
  var myDiscs = buildDiscs(myMark, myToks, true);
  for (var od = 0; od < oppDiscs.length; od++) discs = discs.concat(oppDiscs[od]);
  for (var md = 0; md < myDiscs.length; md++) discs = discs.concat(myDiscs[md]);

  var boardWrap = React.createElement('div', {
    style: {
      position: 'relative', width: BOARD, height: BOARD,
      borderRadius: 14, overflow: 'hidden',
      background: '#0e1320',
      border: '2px solid #1c2230',
      boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
      margin: '0 auto',
      opacity: (!isOver && status === 'active' && !myTurn) ? 0.85 : 1,
      transition: 'opacity .25s ease'
    }
  }, gridCells.concat([triEl]).concat(discs));

  // in-board toast
  var toastEl = null;
  if (toast) {
    toastEl = React.createElement('div', {
      className: 'ringin-result-in',
      style: {
        position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)',
        background: 'rgba(16,22,32,0.92)', color: '#fff', fontSize: 12, fontWeight: 700,
        padding: '6px 12px', borderRadius: 10, border: '1px solid #2a3344',
        whiteSpace: 'nowrap', zIndex: 12, pointerEvents: 'none'
      }
    }, toast);
  }

  var boardEl = React.createElement('div', {
    style: { position: 'relative', width: BOARD, margin: '0 auto' }
  }, boardWrap, toastEl);

  // ── Dice: realistic 3D CSS cube ──
  // Authoritative face = server roll (roll, else lastRoll). The tumble is purely
  // cosmetic; the SETTLED orientation always shows the real server value.
  var DIE_PX = 72;                       // cube edge size
  var DIE_HALF = DIE_PX / 2;             // translateZ depth for each face
  // Standard western die: opposite faces sum to 7.
  //   front=1  back=6  right=3  left=4  top=5  bottom=2
  // Each face's place transform (rotate into position, then push out by half).
  var FACE_PLACE = {
    front:  'rotateY(0deg) translateZ(' + DIE_HALF + 'px)',
    back:   'rotateY(180deg) translateZ(' + DIE_HALF + 'px)',
    right:  'rotateY(90deg) translateZ(' + DIE_HALF + 'px)',
    left:   'rotateY(-90deg) translateZ(' + DIE_HALF + 'px)',
    top:    'rotateX(90deg) translateZ(' + DIE_HALF + 'px)',
    bottom: 'rotateX(-90deg) translateZ(' + DIE_HALF + 'px)'
  };
  var FACE_VALUE = { front: 1, back: 6, right: 3, left: 4, top: 5, bottom: 2 };
  // Cube rotation that brings the given value's face to the front (the viewer).
  var SHOW_FACE = {
    1: { x: 0,   y: 0 },     // front
    6: { x: 0,   y: 180 },   // back
    3: { x: 0,   y: -90 },   // right → swing left to front
    4: { x: 0,   y: 90 },    // left  → swing right to front
    5: { x: -90, y: 0 },     // top   → tip down to front
    2: { x: 90,  y: 0 }      // bottom→ tip up to front
  };
  // Pip grid positions (3x3 cells, 1-indexed 1..9) per value.
  var PIP_CELLS = {
    1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9], 6: [1, 3, 7, 9, 4, 6]
  };
  function faceEl(faceKey){
    var val = FACE_VALUE[faceKey];
    var cells = PIP_CELLS[val] || [];
    var pips = [];
    for (var c = 1; c <= 9; c++){
      var on = cells.indexOf(c) !== -1;
      pips.push(React.createElement('span', {
        key: 'p' + c,
        style: {
          width: '70%', height: '70%', borderRadius: '50%', margin: 'auto',
          alignSelf: 'center', justifySelf: 'center',
          visibility: on ? 'visible' : 'hidden',
          background: 'radial-gradient(circle at 35% 30%, #4a5260, #181d27 70%)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), 0 1px 1px rgba(0,0,0,0.5)'
        }
      }));
    }
    return React.createElement('div', {
      key: faceKey,
      style: {
        position: 'absolute', width: DIE_PX, height: DIE_PX,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)',
        padding: DIE_PX * 0.13, gap: DIE_PX * 0.02,
        borderRadius: 14,
        background: 'linear-gradient(145deg,#ffffff 0%,#eef1f6 55%,#d4dae6 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7), inset 0 -6px 10px rgba(140,150,170,0.35), inset 0 4px 8px rgba(255,255,255,0.85)',
        backfaceVisibility: 'hidden',
        transform: FACE_PLACE[faceKey]
      }
    }, pips);
  }
  // Resolve target orientation. While shaking we tumble on multiple axes plus the
  // accumulated full spins; once landed we ease to the authoritative face.
  var authVal = (roll != null ? roll : lastRoll);
  var spins = (diceSpinRef.current || 0) * 360;
  var cubeTransform, cubeTransition;
  if (shaking) {
    // mid-air tumble — large multi-axis rotation; the 70ms fakeFace flicker keeps
    // it lively while this transform animates toward a spun-up orientation.
    cubeTransform = 'rotateX(' + (spins + 720 + fakeFace * 47) + 'deg) rotateY(' + (spins + 540 + fakeFace * 61) + 'deg) rotateZ(' + (fakeFace * 23) + 'deg)';
    cubeTransition = 'transform 0.55s cubic-bezier(.25,.7,.35,1)';
  } else if (authVal != null && SHOW_FACE[authVal]) {
    var f = SHOW_FACE[authVal];
    // settle: keep the accumulated spins so it lands forward, then expose face N.
    cubeTransform = 'rotateX(' + (spins + f.x) + 'deg) rotateY(' + (spins + f.y) + 'deg) rotateZ(0deg)';
    cubeTransition = 'transform 0.9s cubic-bezier(.2,.8,.3,1)';
  } else {
    cubeTransform = 'rotateX(-22deg) rotateY(28deg) rotateZ(0deg)';
    cubeTransition = 'transform 0.6s cubic-bezier(.2,.8,.3,1)';
  }
  var cube = React.createElement('div', {
    style: {
      position: 'absolute', top: 0, left: 0, width: DIE_PX, height: DIE_PX,
      transformStyle: 'preserve-3d',
      transform: cubeTransform,
      transition: cubeTransition
    }
  }, faceEl('front'), faceEl('back'), faceEl('right'), faceEl('left'), faceEl('top'), faceEl('bottom'));
  var dieEl = React.createElement('div', {
    style: {
      width: DIE_PX, height: DIE_PX,
      perspective: 620, perspectiveOrigin: '50% 45%',
      flex: '0 0 auto'
    }
  }, React.createElement('div', {
    // soft contact shadow under the die for grounding
    style: {
      position: 'relative', width: DIE_PX, height: DIE_PX,
      filter: 'drop-shadow(0 6px 7px rgba(0,0,0,0.55))'
    }
  }, cube));

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
    style: { fontSize: 13, color: '#9fb0c3', minWidth: 90, textAlign: 'center' }
  }, roll != null ? ('Rolled ' + roll) : (lastRoll != null ? ('Last roll ' + lastRoll) : 'No roll yet')));

  // persistent hint while all my tokens are in base on my turn
  var baseHint = null;
  if (myTurn && allInBase && !shaking) {
    baseHint = React.createElement('div', {
      style: { fontSize: 12, color: '#ffd45a', textAlign: 'center', marginTop: 2, fontWeight: 700 }
    }, 'Roll a 6 to get a token out');
  }

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
      marginBottom: 8, textAlign: 'center', minHeight: 18
    }
  }, statusText());

  // ── Controls row: Minimise / Forfeit / Close ──
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

  var closeBtn = canClose ? React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onClose) onClose(); },
    style: {
      border: 'none', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 14,
      background: '#1c222c', color: '#cfd8e3', cursor: 'pointer'
    }
  }, 'Close') : null;

  var controlsKids = [minBtn, forfeitBtn];
  if (closeBtn) controlsKids.push(closeBtn);
  var controls = React.createElement('div', {
    style: { display: 'flex', gap: 9, marginTop: 14, width: '100%' }
  }, controlsKids);

  // ── Win/Lose/Draw overlay ──
  var overlay = null;
  if (isOver) {
    var iWon = !!(game && game.winner && myUserId && game.winner === myUserId);
    var isDraw = status === 'draw';
    var big, bigCls, accent;
    if (isDraw) { big = 'Draw'; bigCls = 'ringin-game-win'; accent = '#cfd8e3'; }
    else if (iWon) { big = 'You win! 🎉'; bigCls = 'ringin-game-win'; accent = myColor; }
    else { big = 'You lost'; bigCls = 'ringin-game-lose'; accent = '#9fb0c3'; }

    var overlayKids = [];

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

    // SHARED CONTRACT: only the initiator (canClose) drives lifecycle. The host
    // (canClose false) gets a Back-to-call (Minimise) button — this overlay
    // covers the footer Minimise and they have no Close, else they'd be trapped.
    if (canClose) {
      overlayKids.push(React.createElement('div', {
        key: 'ovctrl',
        style: { position: 'relative', zIndex: 2, marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }
      },
        React.createElement('button', {
          className: 'ringin-tap',
          onClick: function(){ if (props.onPlayAgain) props.onPlayAgain(); },
          style: { border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg,#5ad1ff,#5a8bff)', color: '#08121c', boxShadow: '0 6px 16px rgba(90,139,255,.4)' }
        }, '🔄 Play again'),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', {
            className: 'ringin-tap',
            onClick: function(){ if (props.onPickAnother) props.onPickAnother(); },
            style: { flex: 1, border: '1px solid #2a3344', borderRadius: 12, padding: '12px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: '#141a24', color: '#cfd8e3' }
          }, '🎮 Other games'),
          React.createElement('button', {
            className: 'ringin-tap',
            onClick: function(){ if (onClose) onClose(); },
            style: { flex: 1, border: '1px solid #232b3a', borderRadius: 12, padding: '12px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: '#161b24', color: '#cfd8e3' }
          }, 'Close')
        )
      ));
    } else {
      overlayKids.push(React.createElement('div', {
        key: 'ovctrl',
        style: { position: 'relative', zIndex: 2, marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280, alignItems: 'center' }
      },
        React.createElement('button', {
          className: 'ringin-tap',
          onClick: function(){ if (onMinimize) onMinimize(); },
          style: { border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%', background: 'linear-gradient(180deg,#1e2a3a,#16202c)', color: '#cfe6ff' }
        }, '⬇ Back to call'),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#7e8a9c' } }, 'The other player can start a new game')
      ));
    }

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
    if (baseHint) bodyKids.push(React.createElement('div', { key: 'hint' }, baseHint));
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
       ref: bodyRef,
       style: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }
     }, bodyKids),
     controls, overlay);
}
