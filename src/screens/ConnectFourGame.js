/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// ConnectFourGame — in-call / in-room 2-player Connect Four (POLISHED v2).
//
// Backed by migration 0061_more_call_games.sql (on top of 0060). State is
// SERVER-AUTHORITATIVE: the board (a 42-char row-major string in
// game.state.g, idx = row*7 + col, row 0 = TOP, row 5 = BOTTOM), the turn,
// and ALL win/draw detection are decided by the SECURITY DEFINER RPCs
// (create_game / c4_drop / get_game / forfeit_game). This component NEVER
// computes a winner client-side — it only renders whatever the server reports.
//
// OPTIMISTIC MOVES: the instant the user taps a droppable column we render
// their disc in the lowest empty cell locally (with the drop animation) so it
// appears immediately, THEN call c4_drop. Any authoritative state that arrives
// (RPC return OR realtime UPDATE) supersedes and clears the optimistic disc.
// On RPC error the next server state corrects it — we never block on the
// round-trip.
//
// Sync path: on mount we seed via get_game, then subscribe to game_sessions
// UPDATE (filtered to this game id) over the existing Supabase Realtime.
// Every payload.new replaces our local state. mountedRef guards async writes.
//
// 0060/0061 MAY NOT BE RUN YET. Every sb.rpc + the realtime subscribe is
// try/catch-guarded; if the function/table is missing we degrade to a calm
// 'Game unavailable' message and never crash the call/room screen.
//
// Props (from caller):
//   gameId      - uuid of the game_sessions row
//   myMark      - 'X' | 'O'  (which side this user is)
//   myUserId    - this user's auth id (to resolve win/loss vs game.winner)
//   onClose     - () => void  (parent closes the game overlay)
//   onMinimize  - () => void  (parent hides overlay, game keeps running)
//
// Also exports a helper for callers that want to START a game:
//   startConnectFour(sb, opponentId, contextId, contextKind) -> Promise<gameId|null>
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var EMPTY_BOARD = '__________________________________________'; // 42 underscores
var COLS = 7;
var ROWS = 6;
var X_C = '#5ad1ff';
var O_C = '#ff7eb6';
// L5: dedicated disc fills with stronger contrast against the dark board.
// The X (blue) disc gets a brighter cyan core + darker navy rim so it no
// longer blends into the indigo board base.
var X_DISC = '#3ec8ff';
var O_DISC = '#ff7eb6';

// Helper for initiators: create a Connect Four game, return its id (or null).
export async function startConnectFour(sbClient, opponentId, contextId, contextKind){
  var client = sbClient || sb;
  try {
    var r = await client.rpc('create_game', {
      p_opponent: opponentId,
      p_context_id: contextId || null,
      p_context_kind: contextKind || null,
      p_type: 'connect_four'
    });
    if (r && r.error) return null;
    var row = r ? r.data : null;
    if (Array.isArray(row)) row = row[0];
    return row && row.id ? row.id : null;
  } catch (_) {
    return null;
  }
}

export default function ConnectFourGame(props){
  var gameId     = props.gameId;
  var myMark     = props.myMark;
  var myUserId   = props.myUserId;
  var onClose    = props.onClose;
  var onMinimize = props.onMinimize;

  // ── State (all hooks BEFORE any conditional return) ──
  var gameS = useState(null);          // the game_sessions row (server truth)
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');             // non-empty → backend unavailable / load failed
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);         // a c4_drop/forfeit rpc is in flight
  var busy = busyS[0]; var setBusy = busyS[1];

  // Optimistic disc: { idx, mark } shown immediately on my tap, cleared when
  // the server's board catches up (or supersedes).
  var optS = useState(null);
  var opt = optS[0]; var setOpt = optS[1];

  var mountedRef = useRef(true);
  // Marks which idx most recently changed so we only run the drop animation on
  // the freshly-landed disc, not the whole board on every re-render.
  var lastDropRef = useRef(-1);
  var prevBoardRef = useRef(EMPTY_BOARD);
  // Set of cell indices that became filled on the most recent board change —
  // every disc in here plays the drop animation (handles batched drops).
  var animSetRef = useRef({});
  // H5 LOCKOUT watchdog: if an optimistic disc is never superseded by the
  // server (lost realtime UPDATE + an RPC that returned no usable row), the
  // board can lock with a ghost disc and a turn that never flips. This timer
  // clears the stale opt and re-seeds authoritative state via get_game.
  var optWatchRef = useRef(null);

  function clearOptWatch(){
    if (optWatchRef.current) { try { clearTimeout(optWatchRef.current); } catch (_) {} optWatchRef.current = null; }
  }

  // Re-seed authoritative state from the server (used by the watchdog + the
  // realtime reconnect path).
  function reseed(){
    (async function(){
      try {
        var r = await sb.rpc('get_game', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && r.error) return;
        var row = r ? r.data : null;
        if (Array.isArray(row)) row = row[0];
        if (row && row.id) applyServer(row);
      } catch (_) {}
    })();
  }

  // Server truth arrived → clear any optimistic disc it now covers.
  function applyServer(row){
    if (!row || !row.id) return;
    if (optWatchRef.current) { try { clearTimeout(optWatchRef.current); } catch (_) {} optWatchRef.current = null; }
    setGame(row);
    setOpt(null);
  }

  // Seed from get_game on mount.
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
        setGame(row);
        setLoading(false);
      } catch (_) {
        if (cancelled || !mountedRef.current) return;
        setErr('Game unavailable');
        setLoading(false);
      }
    })();
    return function(){ cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Realtime subscription to this game's UPDATE events.
  useEffect(function(){
    var ch = null;
    try {
      ch = sb.channel('c4-' + gameId)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: 'id=eq.' + gameId
        }, function(p){
          if (!mountedRef.current) return;
          var n = p && p['new'];
          if (n && n.id) applyServer(n);
        })
        .subscribe(function(s){
          // H7 RECONNECT: a dropped/errored channel can leave us stuck on a
          // stale board (esp. with a pending optimistic disc). Re-seed truth.
          if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            if (mountedRef.current) reseed();
          }
        });
    } catch (_) {
      ch = null;
    }
    return function(){
      if (ch) { try { sb.removeChannel(ch); } catch (_) {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(function(){
    return function(){ mountedRef.current = false; clearOptWatch(); };
  }, []);

  // ── Derived values (safe regardless of game being null) ──
  var serverBoardRaw = (game && game.state && typeof game.state.g === 'string')
                         ? game.state.g : EMPTY_BOARD;
  var serverBoard = (serverBoardRaw.length === ROWS * COLS) ? serverBoardRaw : EMPTY_BOARD;

  // Merge optimistic disc on top of the server board for rendering.
  var board = serverBoard;
  if (opt && serverBoard.charAt(opt.idx) === '_') {
    board = serverBoard.substr(0, opt.idx) + opt.mark + serverBoard.substr(opt.idx + 1);
  } else if (opt) {
    // Server already filled that cell — optimistic disc is now redundant.
    // (Cleared via setOpt in render-safe effect below.)
  }

  var status = game ? game.status : null;
  var turn   = game ? game.turn : null;
  var isOver = status === 'won' || status === 'draw' || status === 'abandoned';
  var myTurn = !!(game && status === 'active' && turn === myMark) && !opt;

  // M8 Drop-animation tracking: figure out EVERY idx that just became filled
  // vs the previous rendered board, so a batch of opponent drops (two server
  // UPDATEs coalesced into one render) ALL animate, not just the last one.
  // Each disc also gets a stable key (cell idx + mark) so React keeps the same
  // element and the drop animation actually plays on the freshly-landed discs.
  var animSet = animSetRef.current;
  if (board !== prevBoardRef.current) {
    var fresh = {};
    for (var k = 0; k < board.length; k++){
      if (board.charAt(k) !== prevBoardRef.current.charAt(k) && board.charAt(k) !== '_'){
        fresh[k] = true;
        lastDropRef.current = k;
      }
    }
    animSet = fresh;
    animSetRef.current = fresh;
    prevBoardRef.current = board;
  }

  // Clear a stale optimistic disc once the server board covers it.
  useEffect(function(){
    if (opt && serverBoard.charAt(opt.idx) !== '_') setOpt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverBoard]);

  // A column is droppable when it's my turn, the TOP cell of that column is
  // empty, nothing's in flight/optimistic, and the backend is reachable.
  function colDroppable(c){
    if (!myTurn || busy || err) return false;
    return board.charAt(0 * COLS + c) === '_';
  }

  function lowestEmpty(c){
    for (var rr = ROWS - 1; rr >= 0; rr--){
      if (board.charAt(rr * COLS + c) === '_') return rr * COLS + c;
    }
    return -1;
  }

  // Tap a column → optimistic disc immediately, then server-validated c4_drop.
  function dropCol(c){
    if (busy || !game || !myTurn || err) return;
    var idx = lowestEmpty(c);
    if (idx < 0) return;  // column full

    // 1) Optimistic: show MY disc right now with the drop animation.
    setOpt({ idx: idx, mark: myMark });
    lastDropRef.current = idx;

    // H5 LOCKOUT watchdog: if no authoritative state supersedes this disc in
    // ~3s (lost realtime UPDATE + RPC that didn't return a usable row), clear
    // the ghost disc and re-seed truth via get_game so the board never locks.
    clearOptWatch();
    optWatchRef.current = setTimeout(function(){
      optWatchRef.current = null;
      if (!mountedRef.current) return;
      setOpt(null);
      reseed();
    }, 3000);

    // 2) Fire the RPC; server state supersedes the optimistic disc.
    setBusy(true);
    (async function(){
      var got = false;
      try {
        var r = await sb.rpc('c4_drop', { p_game: gameId, p_col: c });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) { got = true; applyServer(row); }   // realtime also confirms
        } else {
          // Rejected (not_your_turn / col_full / race) → drop the optimistic
          // disc; authoritative state stays correct.
          clearOptWatch();
          setOpt(null);
        }
      } catch (_) {
        if (mountedRef.current) { clearOptWatch(); setOpt(null); }
      } finally {
        if (mountedRef.current) {
          setBusy(false);
          // No usable row came back (error already handled above; this also
          // covers an RPC that resolved with neither error nor a row) → don't
          // lock on the optimistic disc: clear it + re-seed authoritative state.
          if (!got) { clearOptWatch(); setOpt(null); reseed(); }
        }
      }
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
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) applyServer(row);
        }
      } catch (_) {
        // swallow
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  // ── Status / result text (driven purely by server status + winner) ──
  var iWon = !!(game && game.winner && myUserId && game.winner === myUserId);

  function statusText(){
    if (err) return 'Game unavailable';
    if (loading || !game) return 'Loading…';
    if (isOver) {
      if (status === 'draw') return 'Draw';
      if (status === 'abandoned') return iWon ? 'Opponent forfeited' : 'You forfeited';
      return iWon ? 'You win!' : 'You lost';
    }
    if (status === 'waiting') return 'Waiting for opponent…';
    return myTurn ? 'Your turn' : "Opponent's turn";
  }

  // ── Render ──
  var DISC = 42;
  var GAP  = 6;
  var activeColor = (turn === 'O') ? O_C : X_C;
  var statusColor = isOver ? '#e8edf4' : (myTurn ? activeColor : '#9fb0c3');

  // Header: title + turn pill (pulses the active side).
  var header = React.createElement('div', {
    style: { textAlign: 'center', marginBottom: 10 }
  },
    React.createElement('div', {
      style: {
        fontSize: 20, fontWeight: 800, letterSpacing: .3,
        background: 'linear-gradient(90deg,#5ad1ff,#7c8bff,#ff7eb6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }
    }, 'Connect Four'),
    React.createElement('div', {
      className: (!isOver && !err && myTurn) ? 'ringin-turn-glow' : undefined,
      style: {
        display: 'inline-block', marginTop: 8,
        padding: '5px 16px', borderRadius: 999,
        fontSize: 14, fontWeight: 700,
        color: statusColor,
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        minWidth: 120,
        transition: 'color .15s ease'
      }
    }, statusText())
  );

  // Column drop-arrow header — only lights for droppable columns.
  var dropBtns = [];
  for (var c0 = 0; c0 < COLS; c0++){
    (function(col){
      var ok = colDroppable(col);
      dropBtns.push(
        React.createElement('button', {
          key: 'drop-' + col,
          className: 'ringin-tap' + (ok ? ' ringin-turn-glow' : ''),
          onClick: ok ? function(){ dropCol(col); } : undefined,
          disabled: !ok,
          'aria-label': 'drop in column ' + (col + 1),
          style: {
            width: DISC, height: 26,
            border: 'none', borderRadius: 8, padding: 0,
            background: ok ? 'rgba(124,139,255,.18)' : 'transparent',
            color: ok ? activeColor : '#2c3340',
            fontSize: 15, fontWeight: 900, lineHeight: '26px',
            cursor: ok ? 'pointer' : 'default',
            userSelect: 'none'
          }
        }, '▼')
      );
    })(c0);
  }
  var dropRow = React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + COLS + ', ' + DISC + 'px)',
      gap: GAP, marginBottom: 6, justifyContent: 'center'
    }
  }, dropBtns);

  // The 6×7 grid of holes. The board panel is a glossy blue/indigo gradient;
  // each hole is a recessed dark circle, filled holes hold a glossy disc.
  var cells = [];
  for (var r = 0; r < ROWS; r++){
    for (var c = 0; c < COLS; c++){
      (function(row, col){
        var idx  = row * COLS + col;
        var mark = board.charAt(idx);
        var filled = (mark === 'X' || mark === 'O');
        var clickable = colDroppable(col);
        var isX = mark === 'X';
        var dc = isX ? X_DISC : O_DISC;
        // L5: darker rim per side so the disc edge separates from the board.
        var rim = isX ? 'rgba(2,30,55,.95)' : 'rgba(60,8,28,.85)';

        var disc = filled
          ? React.createElement('div', {
              key: 'disc-' + idx + '-' + mark,
              className: (animSet && animSet[idx]) ? 'ringin-disc-drop' : undefined,
              style: {
                width: '100%', height: '100%', borderRadius: '50%',
                background: 'radial-gradient(circle at 32% 28%, '
                  + 'rgba(255,255,255,.92) 0%, ' + dc + ' 40%, ' + dc + ' 68%, '
                  + rim + ' 100%)',
                boxShadow: isX
                  ? '0 2px 6px rgba(0,0,0,.5), 0 0 8px rgba(62,200,255,.45), inset 0 -3px 6px rgba(0,0,0,.4)'
                  : '0 2px 5px rgba(0,0,0,.45), inset 0 -3px 6px rgba(0,0,0,.35)'
              }
            })
          : null;

        cells.push(
          React.createElement('div', {
            key: 'cell-' + idx,
            className: clickable ? 'ringin-tap' : undefined,
            onClick: clickable ? function(){ dropCol(col); } : undefined,
            role: 'button',
            'aria-label': 'row ' + (row + 1) + ' col ' + (col + 1) +
              (filled ? ' ' + mark : ' empty'),
            style: {
              width: DISC, height: DISC, borderRadius: '50%',
              background: filled
                ? 'transparent'
                : 'radial-gradient(circle at 50% 45%, #070b12 0%, #0a1018 60%, #0e1626 100%)',
              boxShadow: filled
                ? 'none'
                : 'inset 0 3px 6px rgba(0,0,0,.7), inset 0 -2px 3px rgba(120,150,255,.12)',
              cursor: clickable ? 'pointer' : 'default',
              userSelect: 'none',
              overflow: 'hidden'
            }
          }, disc)
        );
      })(r, c);
    }
  }

  var boardGrid = React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + COLS + ', ' + DISC + 'px)',
      gridTemplateRows: 'repeat(' + ROWS + ', ' + DISC + 'px)',
      gap: GAP, padding: 10, borderRadius: 18,
      // L5: darken the board to match the dark brand (#0d1117) — the top is
      // darkest so high discs read clearly; a faint indigo lift at the base
      // keeps the Connect-Four identity without washing out the X discs.
      background: 'linear-gradient(160deg,#0d1117 0%,#101a3a 55%,#16205c 100%)',
      border: '1px solid rgba(124,139,255,.30)',
      boxShadow: '0 10px 28px rgba(8,12,30,.6), inset 0 1px 0 rgba(255,255,255,.08)',
      justifyContent: 'center',
      opacity: err ? 0.6 : 1
    }
  }, cells);

  var youAre = React.createElement('div', {
    style: { fontSize: 12, color: '#6b7585', marginTop: 12, textAlign: 'center' }
  },
    React.createElement('span', {
      style: {
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        background: myMark === 'O' ? O_C : X_C, marginRight: 6,
        verticalAlign: 'middle'
      }
    }),
    'You are ' + (myMark === 'X' ? 'X (blue)' : myMark === 'O' ? 'O (pink)' : '?')
  );

  // ── Control row: Minimise (prominent) / Forfeit (active only) / Close ──
  var btnBase = {
    border: 'none', borderRadius: 12, padding: '11px 14px',
    fontSize: 14, fontWeight: 800, cursor: 'pointer'
  };

  var minimiseBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onMinimize) onMinimize(); },
    style: Object.assign({}, btnBase, {
      flex: 1.4,
      background: 'linear-gradient(135deg,#5ad1ff,#7c8bff)',
      color: '#08111c',
      boxShadow: '0 4px 14px rgba(90,209,255,.35)'
    })
  }, '▽ Minimise');

  var forfeitDisabled = busy || isOver || !!err || !game;
  var forfeitBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: doForfeit,
    disabled: forfeitDisabled,
    style: Object.assign({}, btnBase, {
      flex: 1,
      background: '#3a2230',
      color: '#ff8fb0'
    })
  }, 'Forfeit');

  var closeBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onClose) onClose(); },
    style: Object.assign({}, btnBase, { flex: 1, background: '#1c222c', color: '#cfd8e3' })
  }, 'Close');

  var controlChildren = [minimiseBtn];
  if (!isOver && !err && game) controlChildren.push(forfeitBtn);
  controlChildren.push(closeBtn);

  var controls = React.createElement('div', {
    style: { display: 'flex', gap: 8, marginTop: 16, width: '100%' }
  }, controlChildren);

  // ── Win / lose / draw celebration overlay (inside the card) ──
  var overlay = null;
  if (isOver && !err) {
    var won = status === 'won' && iWon;
    var abandonWin = status === 'abandoned' && iWon;
    var winLike = won || abandonWin;
    var draw = status === 'draw';

    var bigText = draw ? 'Draw'
      : winLike ? 'You win! 🎉'
      : 'You lost';
    var bigColor = draw ? '#cfd8e3' : winLike ? '#ffe27a' : '#ff9bb6';

    var overlayKids = [];

    // Radiating rays + confetti only on a win.
    if (winLike) {
      overlayKids.push(
        React.createElement('div', {
          key: 'ray',
          className: 'ringin-win-ray',
          style: {
            position: 'absolute', width: 200, height: 200, borderRadius: '50%',
            background: 'conic-gradient(from 0deg,'
              + 'rgba(255,226,122,.55),rgba(90,209,255,0) 25%,'
              + 'rgba(124,139,255,.55) 50%,rgba(255,126,182,0) 75%,'
              + 'rgba(255,226,122,.55))',
            pointerEvents: 'none'
          }
        })
      );
      var confColors = ['#5ad1ff','#ff7eb6','#ffe27a','#7c8bff','#7CFFB2'];
      for (var ci = 0; ci < 14; ci++){
        (function(i){
          overlayKids.push(
            React.createElement('div', {
              key: 'conf-' + i,
              className: 'ringin-confetti',
              style: {
                position: 'absolute', top: 0,
                left: (6 + (i * 6.4)) + '%',
                width: 8, height: 12, borderRadius: 2,
                background: confColors[i % confColors.length],
                animationDelay: (i * 0.09) + 's',
                pointerEvents: 'none'
              }
            })
          );
        })(ci);
      }
    }

    overlayKids.push(
      React.createElement('div', {
        key: 'big',
        className: winLike ? 'ringin-game-win' : 'ringin-game-lose',
        style: {
          position: 'relative', zIndex: 2,
          fontSize: 30, fontWeight: 900, color: bigColor,
          textShadow: '0 3px 14px rgba(0,0,0,.6)', textAlign: 'center'
        }
      }, bigText)
    );

    if (status === 'abandoned') {
      overlayKids.push(
        React.createElement('div', {
          key: 'sub', className: 'ringin-result-in',
          style: { position: 'relative', zIndex: 2, marginTop: 8, fontSize: 14, color: '#9fb0c3' }
        }, abandonWin ? 'Opponent forfeited' : 'You forfeited')
      );
    }

    overlayKids.push(
      React.createElement('div', {
        key: 'ovctrl',
        style: { position: 'relative', zIndex: 2, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }
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
      )
    );

    overlay = React.createElement('div', {
      style: {
        position: 'absolute', inset: 0, borderRadius: 20,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 40%, rgba(10,14,20,.86), rgba(8,11,18,.97))',
        overflow: 'hidden', zIndex: 5
      }
    }, overlayKids);
  }

  var card = React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 20, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 360, margin: '0 auto',
      overflowY: 'auto', maxHeight: '90vh'
    }
  }, header, dropRow, boardGrid, youAre, controls, overlay);

  return card;
}
