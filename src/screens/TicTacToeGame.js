/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// TicTacToeGame — in-call / in-room 2-player tic-tac-toe.
//
// Backed by migration 0060_in_room_games.sql. State is SERVER-AUTHORITATIVE:
// the board (a 9-char row-major string), turn, win/draw detection and the
// winner are ALL decided by the SECURITY DEFINER RPCs (create_game /
// make_move / get_game / forfeit_game). This component NEVER computes a
// winner client-side — it only renders whatever the server reports.
//
// Sync path: on mount we seed via get_game, then subscribe to
// game_sessions UPDATE (filtered to this game id) over the existing
// Supabase Realtime. Every payload.new replaces our local state.
//
// 0060 MAY NOT BE RUN YET. Every sb.rpc + the realtime subscribe is
// try/catch-guarded; if the function/table is missing we degrade to a
// graceful error message and never crash the call/room screen.
//
// Props (from caller):
//   gameId    - uuid of the game_sessions row
//   myMark    - 'X' | 'O'  (which side this user is)
//   myUserId  - this user's auth id (to resolve win/loss vs game.winner)
//   onClose   - () => void  (parent closes the game overlay)
//
// Also exports a helper for callers that want to START a game:
//   startTicTacToe(sb, opponentId, contextId, contextKind) -> Promise<gameId|null>
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var EMPTY_BOARD = '_________';

// Helper for initiators: create a game, return its id (or null on failure).
// contextKind must be 'call' | 'room' | null/undefined. Guarded so a missing
// 0060 migration just yields null and the caller can no-op gracefully.
export async function startTicTacToe(sbClient, opponentId, contextId, contextKind){
  var client = sbClient || sb;
  try {
    var r = await client.rpc('create_game', {
      p_opponent: opponentId,
      p_context_id: contextId || null,
      p_context_kind: contextKind || null,
      p_type: 'tic_tac_toe'
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

export default function TicTacToeGame(props){
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

  var busyS = useState(false);         // a move/forfeit rpc is in flight
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
      ch = sb.channel('ttt-' + gameId)
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
      // Realtime unavailable (e.g. table not in publication / 0060 unrun).
      // get_game seeding still gives a usable snapshot; we just won't get
      // live opponent moves. Don't crash.
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
  var board  = (game && typeof game.board === 'string' && game.board.length === 9)
                 ? game.board : EMPTY_BOARD;
  var status = game ? game.status : null;
  var turn   = game ? game.turn : null;
  var isOver = status === 'won' || status === 'draw' || status === 'abandoned';
  var myTurn = !isOver && status === 'active' && turn === myMark;

  // Tap an empty cell → server-validated make_move.
  function tapCell(i){
    if (busy || !game || !myTurn) return;
    if (board.charAt(i) !== '_') return;
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('make_move', { p_game: gameId, p_cell: i });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);   // realtime will also confirm
        }
        // On error (not_your_turn / cell_taken / race) we simply do nothing —
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
  function statusText(){
    if (err) return 'Game unavailable';
    if (loading || !game) return 'Loading…';
    if (status === 'won' || status === 'abandoned') {
      if (game.winner && myUserId && game.winner === myUserId) return 'You won! 🎉';
      return 'You lost';
    }
    if (status === 'draw') return "It's a draw";
    if (status === 'waiting') return 'Waiting for opponent…';
    // active
    return myTurn ? 'Your turn' : "Opponent's turn";
  }

  // ── Render ──
  var cellStyle = function(mark, clickable){
    return {
      width: 80, height: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 40, fontWeight: 800,
      borderRadius: 14,
      background: '#11151c',
      border: '1px solid #232a36',
      color: mark === 'X' ? '#5ad1ff' : (mark === 'O' ? '#ff7eb6' : '#3a4150'),
      cursor: clickable ? 'pointer' : 'default',
      userSelect: 'none',
      transition: 'transform .08s ease, background .12s ease'
    };
  };

  var cells = [];
  for (var i = 0; i < 9; i++){
    (function(idx){
      var mark = board.charAt(idx);
      var displayMark = (mark === 'X' || mark === 'O') ? mark : '';
      var clickable = myTurn && mark === '_' && !busy && !err;
      cells.push(
        React.createElement('div', {
          key: 'cell-' + idx,
          onClick: clickable ? function(){ tapCell(idx); } : undefined,
          style: cellStyle(mark, clickable),
          role: 'button',
          'aria-label': 'cell ' + idx + (displayMark ? ' ' + displayMark : ' empty')
        }, displayMark)
      );
    })(i);
  }

  var boardGrid = React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 80px)',
      gridTemplateRows: 'repeat(3, 80px)',
      gap: 8,
      opacity: (err || isOver) ? 0.85 : 1
    }
  }, cells);

  var header = React.createElement('div', {
    style: {
      fontSize: 18, fontWeight: 700, color: '#e8edf4',
      marginBottom: 4, textAlign: 'center'
    }
  }, 'Tic-Tac-Toe');

  var subStatus = React.createElement('div', {
    style: {
      fontSize: 15, fontWeight: 600,
      color: isOver ? '#9fb0c3' : (myTurn ? '#5ad1ff' : '#9fb0c3'),
      marginBottom: 14, textAlign: 'center', minHeight: 20
    }
  }, statusText());

  var youAre = React.createElement('div', {
    style: { fontSize: 12, color: '#6b7585', marginTop: 12, textAlign: 'center' }
  }, 'You are ' + (myMark || '?'));

  var btnBase = {
    border: 'none', borderRadius: 12, padding: '10px 18px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer'
  };

  var forfeitBtn = React.createElement('button', {
    onClick: doForfeit,
    disabled: busy || isOver || !!err || !game,
    style: Object.assign({}, btnBase, {
      background: (busy || isOver || err || !game) ? '#2a2f3a' : '#3a2230',
      color: (busy || isOver || err || !game) ? '#5f6776' : '#ff8fb0',
      cursor: (busy || isOver || err || !game) ? 'default' : 'pointer'
    })
  }, 'Forfeit');

  var closeBtn = React.createElement('button', {
    onClick: function(){ if (onClose) onClose(); },
    style: Object.assign({}, btnBase, { background: '#1c222c', color: '#cfd8e3' })
  }, 'Close');

  var buttons = React.createElement('div', {
    style: { display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }
  }, forfeitBtn, closeBtn);

  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 20, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 320, margin: '0 auto'
    }
  }, header, subStatus, boardGrid, youAre, buttons);
}
