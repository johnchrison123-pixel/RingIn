/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// ConnectFourGame — in-call / in-room 2-player Connect Four.
//
// Backed by migration 0061_more_call_games.sql (on top of 0060). State is
// SERVER-AUTHORITATIVE: the board (a 42-char row-major string in
// game.state.g, idx = row*7 + col, row 0 = TOP, row 5 = BOTTOM), the turn,
// and ALL win/draw detection are decided by the SECURITY DEFINER RPCs
// (create_game / c4_drop / get_game / forfeit_game). This component NEVER
// computes a winner client-side — it only renders whatever the server reports.
//
// Sync path: on mount we seed via get_game, then subscribe to game_sessions
// UPDATE (filtered to this game id) over the existing Supabase Realtime.
// Every payload.new replaces our local state.
//
// 0060/0061 MAY NOT BE RUN YET. Every sb.rpc + the realtime subscribe is
// try/catch-guarded; if the function/table is missing we degrade to a calm
// 'Game unavailable' message and never crash the call/room screen.
//
// Props (from caller):
//   gameId    - uuid of the game_sessions row
//   myMark    - 'X' | 'O'  (which side this user is)
//   myUserId  - this user's auth id (to resolve win/loss vs game.winner)
//   onClose   - () => void  (parent closes the game overlay)
//
// Also exports a helper for callers that want to START a game:
//   startConnectFour(sb, opponentId, contextId, contextKind) -> Promise<gameId|null>
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var EMPTY_BOARD = '__________________________________________'; // 42 underscores
var COLS = 7;
var ROWS = 6;

// Helper for initiators: create a Connect Four game, return its id (or null).
// contextKind must be 'call' | 'room' | null/undefined. Guarded so a missing
// 0060/0061 migration just yields null and the caller can no-op gracefully.
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
    // create_game returns the full game_sessions row (object). Some PostgREST
    // setups wrap a single composite return in an array — handle both.
    if (Array.isArray(row)) row = row[0];
    return row && row.id ? row.id : null;
  } catch (_) {
    return null;
  }
}

export default function ConnectFourGame(props){
  var gameId   = props.gameId;
  var myMark   = props.myMark;
  var myUserId = props.myUserId;
  var onClose  = props.onClose;

  // ── State (all hooks BEFORE any conditional return) ──
  var gameS = useState(null);          // the game_sessions row (server truth)
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');             // non-empty → backend unavailable / load failed
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);         // a c4_drop/forfeit rpc is in flight
  var busy = busyS[0]; var setBusy = busyS[1];

  var mountedRef = useRef(true);

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
          if (n && n.id) setGame(n);
        })
        .subscribe();
    } catch (_) {
      // Realtime unavailable (e.g. table not in publication / migration unrun).
      // get_game seeding still gives a usable snapshot; we just won't get live
      // opponent moves. Don't crash.
      ch = null;
    }
    return function(){
      if (ch) { try { sb.removeChannel(ch); } catch (_) {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(function(){
    return function(){ mountedRef.current = false; };
  }, []);

  // ── Derived values (safe regardless of game being null) ──
  var boardRaw = (game && game.state && typeof game.state.g === 'string')
                   ? game.state.g : EMPTY_BOARD;
  var board  = (boardRaw.length === ROWS * COLS) ? boardRaw : EMPTY_BOARD;
  var status = game ? game.status : null;
  var turn   = game ? game.turn : null;
  var isOver = status === 'won' || status === 'draw' || status === 'abandoned';
  var myTurn = !!(game && status === 'active' && turn === myMark);

  // A column is droppable when it's my turn, the TOP cell of that column is
  // empty, nothing's in flight, and the backend is reachable.
  function colDroppable(c){
    if (!myTurn || busy || err) return false;
    return board.charAt(0 * COLS + c) === '_';   // top row of column empty
  }

  // Click anywhere in a column → server-validated c4_drop.
  function dropCol(c){
    if (busy || !game || !myTurn) return;
    if (board.charAt(0 * COLS + c) !== '_') return;  // column full
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('c4_drop', { p_game: gameId, p_col: c });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);   // realtime will also confirm
        }
        // On error (not_your_turn / col_full / race) we simply do nothing —
        // the authoritative state from realtime/get_game stays correct.
      } catch (_) {
        // swallow — server is the source of truth
      } finally {
        if (mountedRef.current) setBusy(false);
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
          if (row && row.id) setGame(row);
        }
      } catch (_) {
        // swallow
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  // ── Status / result text (driven purely by server status + winner) ──
  function resultText(){
    if (status === 'won' || status === 'abandoned') {
      if (game && game.winner && myUserId && game.winner === myUserId) {
        return status === 'abandoned' ? 'Opponent forfeited — you win' : 'You won! 🎉';
      }
      return status === 'abandoned' ? 'You forfeited' : 'You lost';
    }
    if (status === 'draw') return 'Draw';
    return '';
  }

  function statusText(){
    if (err) return 'Game unavailable';
    if (loading || !game) return 'Loading…';
    if (isOver) return resultText();
    if (status === 'waiting') return 'Waiting for opponent…';
    return myTurn ? 'Your turn' : "Opponent's turn";
  }

  // ── Render ──
  var DISC = 46;   // disc diameter
  var GAP  = 6;

  // Header row of 7 ▼ drop buttons (one per column).
  var dropBtns = [];
  for (var c0 = 0; c0 < COLS; c0++){
    (function(col){
      var ok = colDroppable(col);
      dropBtns.push(
        React.createElement('button', {
          key: 'drop-' + col,
          onClick: ok ? function(){ dropCol(col); } : undefined,
          disabled: !ok,
          'aria-label': 'drop in column ' + (col + 1),
          style: {
            width: DISC, height: 28,
            border: 'none', borderRadius: 8,
            background: ok ? 'rgba(90,209,255,.14)' : 'transparent',
            color: ok ? (myMark === 'O' ? '#ff7eb6' : '#5ad1ff') : '#39414f',
            fontSize: 16, fontWeight: 800, lineHeight: '28px',
            cursor: ok ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'background .12s ease'
          }
        }, '▼')
      );
    })(c0);
  }

  var dropRow = React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + COLS + ', ' + DISC + 'px)',
      gap: GAP,
      marginBottom: 6,
      justifyContent: 'center'
    }
  }, dropBtns);

  // The 6×7 grid of disc cells, rendered top → bottom, left → right.
  var cells = [];
  for (var r = 0; r < ROWS; r++){
    for (var c = 0; c < COLS; c++){
      (function(row, col){
        var idx  = row * COLS + col;
        var mark = board.charAt(idx);
        var filled = (mark === 'X' || mark === 'O');
        var clickable = colDroppable(col);
        cells.push(
          React.createElement('div', {
            key: 'cell-' + idx,
            onClick: clickable ? function(){ dropCol(col); } : undefined,
            role: 'button',
            'aria-label': 'row ' + (row + 1) + ' col ' + (col + 1) +
              (filled ? ' ' + mark : ' empty'),
            style: {
              width: DISC, height: DISC, borderRadius: '50%',
              background: mark === 'X' ? '#5ad1ff'
                        : mark === 'O' ? '#ff7eb6'
                        : '#11151c',
              border: filled ? 'none' : '2px solid #232a36',
              boxShadow: filled ? 'inset 0 -3px 6px rgba(0,0,0,.35)' : 'none',
              cursor: clickable ? 'pointer' : 'default',
              userSelect: 'none',
              transition: 'background .12s ease'
            }
          })
        );
      })(r, c);
    }
  }

  var boardGrid = React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + COLS + ', ' + DISC + 'px)',
      gridTemplateRows: 'repeat(' + ROWS + ', ' + DISC + 'px)',
      gap: GAP,
      padding: 8,
      borderRadius: 14,
      background: '#0a0d14',
      border: '1px solid #1c2230',
      justifyContent: 'center',
      opacity: (err || isOver) ? 0.85 : 1
    }
  }, cells);

  var header = React.createElement('div', {
    style: {
      fontSize: 18, fontWeight: 700, color: '#e8edf4',
      marginBottom: 4, textAlign: 'center'
    }
  }, 'Connect Four');

  var subStatus = React.createElement('div', {
    style: {
      fontSize: 15, fontWeight: 600,
      color: isOver ? '#9fb0c3' : (myTurn ? '#5ad1ff' : '#9fb0c3'),
      marginBottom: 14, textAlign: 'center', minHeight: 20
    }
  }, statusText());

  var youAre = React.createElement('div', {
    style: { fontSize: 12, color: '#6b7585', marginTop: 12, textAlign: 'center' }
  }, 'You are ' + (myMark === 'X' ? 'X (blue)' : myMark === 'O' ? 'O (pink)' : '?'));

  var btnBase = {
    border: 'none', borderRadius: 12, padding: '10px 18px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer'
  };

  var forfeitDisabled = busy || isOver || !!err || !game;
  var forfeitBtn = React.createElement('button', {
    onClick: doForfeit,
    disabled: forfeitDisabled,
    style: Object.assign({}, btnBase, {
      background: forfeitDisabled ? '#2a2f3a' : '#3a2230',
      color: forfeitDisabled ? '#5f6776' : '#ff8fb0',
      cursor: forfeitDisabled ? 'default' : 'pointer'
    })
  }, 'Forfeit');

  var closeBtn = React.createElement('button', {
    onClick: function(){ if (onClose) onClose(); },
    style: Object.assign({}, btnBase, { background: '#1c222c', color: '#cfd8e3' })
  }, 'Close');

  // Forfeit only while the game is active (per contract); Close always shown.
  var buttonsChildren = [];
  if (!isOver && !err && game) buttonsChildren.push(forfeitBtn);
  buttonsChildren.push(closeBtn);

  var buttons = React.createElement('div', {
    style: { display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }
  }, buttonsChildren);

  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 20, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 360, margin: '0 auto',
      overflowY: 'auto', maxHeight: '90vh'
    }
  }, header, subStatus, dropRow, boardGrid, youAre, buttons);
}
