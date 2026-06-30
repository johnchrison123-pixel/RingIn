/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// TicTacToeGame — in-call / in-room 2-player Tic-Tac-Toe, now a BEST-OF-5 MATCH.
//
// SERVER-AUTHORITATIVE (migrations 0060 + 0062). We NEVER compute a winner or a
// score ourselves — every authoritative value (board, turn, status, winner and
// the match `state` { bo, round, score:{X,O}, last:{round,winner,board} }) comes
// from the SECURITY DEFINER RPCs and realtime UPDATEs on game_sessions.
//
//   • board column  = the CURRENT round's 9-char board (NOT state).
//   • state.round   = current round number (1..bo).
//   • state.score   = { X, O } round wins.
//   • state.last    = the just-finished round { round, winner:'X'|'O'|'draw',
//                     board:9-char } — drives the ROUND-RESULT banner.
//
// FAST FEEL — OPTIMISTIC MOVES: the instant you tap an empty cell we paint your
// mark locally (optimistic overlay) with the pop animation, THEN call make_move.
// Authoritative state (RPC return OR realtime) supersedes/clears the optimism.
// A rejected move just no-ops; the next server state corrects everything.
//
// Sync: seed via get_game on mount; subscribe to postgres_changes UPDATE on
// game_sessions filtered to this id; every payload.new → setGame. Channel removed
// on unmount, mountedRef guards async. Every sb.rpc + the subscribe is
// try/catch-guarded → calm 'Game unavailable' fallback, never crashes the call.
//
// Props: gameId, myMark ('X'|'O'), myUserId, onClose, onMinimize.
//
// Helper export for initiators: startTicTacToe(sb, opponentId, ctxId, ctxKind).
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var EMPTY_BOARD = '_________';
var X_C = '#5ad1ff';
var O_C = '#ff7eb6';

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
    if (Array.isArray(row)) row = row[0];
    return row && row.id ? row.id : null;
  } catch (_) {
    return null;
  }
}

export default function TicTacToeGame(props){
  var gameId    = props.gameId;
  var myMark    = props.myMark;
  var myUserId  = props.myUserId;
  var onClose   = props.onClose;
  var onMinimize = props.onMinimize;
  var otherMark = myMark === 'X' ? 'O' : 'X';
  var canClose = props.canClose !== false;   // default TRUE; host (canClose===false) sees no Close

  // ── State (ALL hooks before any conditional return) ──
  var gameS = useState(null);            // server-authoritative game_sessions row
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);
  var busy = busyS[0]; var setBusy = busyS[1];

  // optimistic = { cell:int, mark:'X'|'O', board:'9-char' } | null
  var optS = useState(null);
  var opt = optS[0]; var setOpt = optS[1];

  // round-result banner = { round, winner, board } | null
  var bannerS = useState(null);
  var banner = bannerS[0]; var setBanner = bannerS[1];

  var mountedRef = useRef(true);
  var seenRoundRef = useRef(null);       // last round we've shown a transition for
  var bannerTimerRef = useRef(null);
  // M7: the round number of the last-result we've already shown a banner for.
  // Driving the banner off state.last.round (rather than the live round, which
  // never advances on the deciding round) lets the DECIDING round's result show.
  var seenLastRoundRef = useRef(null);

  // Seed via get_game.
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
        if (row.closed_at) { if (onClose) onClose(); return; }   // N1: don't seed a game the initiator already closed
        var st = row.state || {};
        seenRoundRef.current = (st && st.round) ? st.round : 1;
        // M7: don't replay a banner for a round that already finished before we
        // mounted — seed the seen-last marker from the current last-result.
        seenLastRoundRef.current = (st && st.last && st.last.round != null) ? st.last.round : null;
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

  // Realtime UPDATEs.
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
          if (!n || !n.id) return;
          // N1: initiator closed the game (durable closed_at marker) → mirror the
          // dismissal here even if the realtime broadcast was lost. closed_at is
          // never set during play, and a win/draw/forfeit never sets it, so this
          // can't swallow a result overlay. undefined pre-migration → no-op.
          if (n.closed_at) { if (onClose) onClose(); return; }
          setGame(n);
        })
        .subscribe(function(s){
          // H7 RECONNECT: a dropped/errored realtime channel can strand us on a
          // stale board (opponent moved but the UPDATE never arrived). Re-seed
          // authoritative state via get_game.
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
    return function(){
      mountedRef.current = false;
      if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); }
    };
  }, []);

  // ── Whenever authoritative state arrives, clear stale optimism + maybe fire
  //    a round-result banner. Server state ALWAYS supersedes the optimistic mark.
  useEffect(function(){
    if (!game) return;
    // Server truth is in; drop the optimistic overlay (it has been superseded).
    if (opt) setOpt(null);

    var st = game.state || {};
    var round = (st && st.round) ? st.round : 1;
    var last = st && st.last ? st.last : null;
    var over = game.status === 'won' || game.status === 'draw' || game.status === 'abandoned';

    // M7: fire the round-result banner whenever a NEW last-result appears
    // (keyed on last.round, not the live round which doesn't advance on the
    // deciding round). This way the DECIDING round's outcome shows too — and on
    // abandon (forfeit) there's no new last, so no spurious banner. When the
    // match is over we show it briefly BEFORE the match overlay (which is gated
    // on !banner), giving a smooth "Round N → match result" hand-off.
    if (last && last.round != null && last.round !== seenLastRoundRef.current
        && game.status !== 'abandoned') {
      seenLastRoundRef.current = last.round;
      setBanner({ round: last.round, winner: last.winner, board: last.board });
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(function(){
        if (mountedRef.current) setBanner(null);
      }, over ? 1400 : 1800);
    }
    seenRoundRef.current = round;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // ── Derived (safe even when game is null) ──
  var serverBoard = (game && typeof game.board === 'string' && game.board.length === 9)
                      ? game.board : EMPTY_BOARD;
  var status = game ? game.status : null;
  var turn   = game ? game.turn : null;
  var isOver = status === 'won' || status === 'draw' || status === 'abandoned';
  var myTurn = !isOver && status === 'active' && turn === myMark;

  var st = (game && game.state) ? game.state : {};
  var bo = st.bo || 5;
  var roundNo = st.round || 1;
  var score = st.score || { X: 0, O: 0 };
  var myScore = score[myMark] || 0;
  var oppScore = score[otherMark] || 0;

  // Board to actually render = server board with the optimistic mark painted in,
  // ONLY while the optimistic mark still applies to the live board (same empty cell).
  var board = serverBoard;
  var optCell = -1;
  if (opt && opt.board && !banner && !isOver) {
    if (serverBoard.charAt(opt.cell) === '_') {
      board = opt.board;
      optCell = opt.cell;
    }
  }

  // ── Actions ──
  function tapCell(i){
    if (busy || !game || !myTurn) return;
    if (board.charAt(i) !== '_') return;
    // OPTIMISTIC: paint my mark immediately so it appears with the pop animation.
    var optimisticBoard = serverBoard.substr(0, i) + myMark + serverBoard.substr(i + 1);
    setOpt({ cell: i, mark: myMark, board: optimisticBoard });
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('make_move', { p_game: gameId, p_cell: i });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);   // supersedes optimism via the effect
        }
        // On RPC error (not_your_turn / cell_taken / race) → no-op; realtime/
        // next state corrects the optimistic overlay.
      } catch (_) {
        // server is the source of truth
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  // Re-seed authoritative state from the server (realtime reconnect path).
  // Routes through setGame so the [game] effect re-runs; seenLastRoundRef keeps
  // a re-seed of the same round from re-firing the banner.
  function reseed(){
    (async function(){
      try {
        var r = await sb.rpc('get_game', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && r.error) return;
        var row = r ? r.data : null;
        if (Array.isArray(row)) row = row[0];
        // N1: the initiator may have closed the game while we were disconnected;
        // the realtime broadcast/UPDATE can be missed, so honor closed_at on the
        // reconnect (reseed) path too — else the host's window stays open.
        if (row && row.closed_at) { if (onClose) onClose(); return; }
        if (row && row.id) setGame(row);
      } catch (_) {}
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
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  // ── Build a 3x3 board grid (reusable for the live board + banner mini board) ──
  function buildGrid(boardStr, opts){
    opts = opts || {};
    var size = opts.size || 88;
    var gap = opts.gap || 9;
    var fontSize = opts.fontSize || 46;
    var interactive = !!opts.interactive;
    var popCell = (opts.popCell != null) ? opts.popCell : -1;
    var cells = [];
    for (var i = 0; i < 9; i++){
      (function(idx){
        var mark = boardStr.charAt(idx);
        var displayMark = (mark === 'X' || mark === 'O') ? mark : '';
        var clickable = interactive && myTurn && mark === '_' && !busy && !err;
        var mColor = mark === 'X' ? X_C : (mark === 'O' ? O_C : 'transparent');
        var cellCls = 'ringin-tap';
        var markCls = (idx === popCell) ? 'ringin-mark-pop' : '';
        var glossy = mark === 'X'
          ? 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.35), rgba(90,209,255,0) 60%)'
          : (mark === 'O'
            ? 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.35), rgba(255,126,182,0) 60%)'
            : 'none');
        cells.push(
          React.createElement('div', {
            key: 'c' + idx,
            className: cellCls,
            onClick: clickable ? function(){ tapCell(idx); } : undefined,
            role: interactive ? 'button' : undefined,
            'aria-label': 'cell ' + idx + (displayMark ? ' ' + displayMark : ' empty'),
            style: {
              width: size, height: size,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: fontSize, fontWeight: 900, lineHeight: 1,
              borderRadius: Math.round(size * 0.18),
              background: 'linear-gradient(160deg,#161c26,#0f141c)',
              border: clickable
                ? '1px solid rgba(90,209,255,.45)'
                : '1px solid #232b3a',
              boxShadow: clickable
                ? 'inset 0 1px 0 rgba(255,255,255,.05), 0 0 12px rgba(90,209,255,.18)'
                : 'inset 0 1px 0 rgba(255,255,255,.04)',
              cursor: clickable ? 'pointer' : 'default',
              position: 'relative',
              transition: 'border-color .15s ease'
            }
          },
            displayMark
              ? React.createElement('span', {
                  className: markCls,
                  style: {
                    color: mColor,
                    textShadow: '0 0 16px ' + mColor + '88, 0 2px 4px rgba(0,0,0,.5)',
                    backgroundImage: glossy,
                    WebkitBackgroundClip: 'text',
                    display: 'inline-block'
                  }
                }, displayMark)
              : null
          )
        );
      })(i);
    }
    return React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, ' + size + 'px)',
        gridTemplateRows: 'repeat(3, ' + size + 'px)',
        gap: gap,
        padding: gap,
        borderRadius: Math.round(size * 0.22),
        background: 'linear-gradient(180deg,#0b0f16,#0a0d13)',
        border: '1px solid #1b2230'
      }
    }, cells);
  }

  // ── Header: title + scoreboard + round ──
  function statusLine(){
    if (err) return 'Game unavailable';
    if (loading || !game) return 'Loading…';
    if (status === 'waiting') return 'Waiting for opponent…';
    if (isOver) return 'Match complete';
    return myTurn ? 'Your turn' : "Opponent's turn";
  }

  var title = React.createElement('div', {
    style: {
      fontSize: 20, fontWeight: 900, letterSpacing: .3, textAlign: 'center',
      background: 'linear-gradient(90deg,' + X_C + ',' + O_C + ')',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      backgroundClip: 'text', color: X_C
    }
  }, 'Tic-Tac-Toe');

  var roundLine = React.createElement('div', {
    style: { fontSize: 12.5, fontWeight: 700, color: '#8a97a9', textAlign: 'center', marginTop: 2 }
  }, 'Round ' + roundNo + ' of ' + bo);

  function scorePill(label, val, color, active){
    return React.createElement('div', {
      className: active ? 'ringin-turn-glow' : '',
      style: {
        flex: 1, textAlign: 'center', padding: '7px 6px', borderRadius: 12,
        background: active
          ? 'linear-gradient(180deg,' + color + '22,' + color + '11)'
          : 'rgba(255,255,255,.03)',
        border: '1px solid ' + (active ? color + '99' : '#1f2735')
      }
    },
      React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: '#7e8a9c' } }, label),
      React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: color, lineHeight: 1.1 } }, String(val))
    );
  }

  var scoreboard = React.createElement('div', {
    style: { display: 'flex', gap: 8, alignItems: 'stretch', margin: '12px 0 4px', width: '100%' }
  },
    scorePill('You (' + myMark + ')', myScore, myMark === 'X' ? X_C : O_C, myTurn && !isOver && !banner),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', color: '#3c4555', fontWeight: 900, fontSize: 16 } }, '—'),
    scorePill('Opp (' + otherMark + ')', oppScore, otherMark === 'X' ? X_C : O_C, !myTurn && status === 'active' && !banner)
  );

  var statusBadge = React.createElement('div', {
    style: {
      fontSize: 14.5, fontWeight: 800, textAlign: 'center', margin: '6px 0 12px',
      minHeight: 20,
      color: err ? '#8a97a9' : (isOver ? '#9fb0c3' : (myTurn ? (myMark === 'X' ? X_C : O_C) : '#9fb0c3'))
    }
  }, statusLine());

  // ── Live board ──
  var liveBoard = buildGrid(board, { interactive: true, popCell: optCell });

  // ── Round-result banner overlay (inside card) ──
  // M7: show for any active round transition AND for the deciding round (where
  // isOver is already true) — the match overlay below is gated on !banner so it
  // waits until this banner clears.
  var bannerOverlay = null;
  if (banner) {
    var bWin = banner.winner; // 'X' | 'O' | 'draw'
    var bText = bWin === 'draw'
      ? 'Round ' + banner.round + ': Draw'
      : (bWin === myMark ? 'Round ' + banner.round + ': You won!' : 'Round ' + banner.round + ': Opponent won');
    var bColor = bWin === 'draw' ? '#cfd8e3' : (bWin === myMark ? '#7bf0a4' : '#ff9bb5');
    bannerOverlay = React.createElement('div', {
      className: 'ringin-result-in',
      style: {
        position: 'absolute', inset: 0, zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, borderRadius: 20,
        background: 'radial-gradient(circle at 50% 38%, rgba(13,17,23,.92), rgba(8,11,16,.97))',
        backdropFilter: 'blur(2px)'
      }
    },
      React.createElement('div', {
        style: { fontSize: 19, fontWeight: 900, color: bColor, textShadow: '0 0 18px ' + bColor + '66' }
      }, bText),
      buildGrid(banner.board || EMPTY_BOARD, { interactive: false, size: 54, gap: 6, fontSize: 26 }),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: '#7e8a9c' } },
        isOver ? 'Final round' : 'Next round starting…')
    );
  }

  // ── Match-end celebration overlay (inside card) ──
  // M7: hold it back while the deciding-round banner is still showing.
  var resultOverlay = null;
  if (isOver && !banner) {
    var won = !!(game && game.winner && myUserId && game.winner === myUserId);
    var draw = status === 'draw';
    var bigText = draw ? 'Draw' : (won ? 'You win! 🎉' : 'You lost');
    var bigColor = draw ? '#cfd8e3' : (won ? '#7bf0a4' : '#ff9bb5');
    var bigCls = draw ? 'ringin-game-lose' : (won ? 'ringin-game-win' : 'ringin-game-lose');

    var rays = won ? React.createElement('div', {
      style: { position: 'absolute', width: 200, height: 200, pointerEvents: 'none' }
    },
      [0,1,2].map(function(k){
        return React.createElement('div', {
          key: 'ray' + k,
          className: 'ringin-win-ray',
          style: {
            position: 'absolute', left: '50%', top: '50%', width: 200, height: 200,
            marginLeft: -100, marginTop: -100, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, ' + X_C + '55, transparent 25%, ' + O_C + '55 50%, transparent 75%, ' + X_C + '55)',
            animationDelay: (k * 0.28) + 's'
          }
        });
      })
    ) : null;

    var confetti = won ? React.createElement('div', {
      style: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 20 }
    },
      [0,1,2,3,4,5,6,7,8,9,10,11].map(function(k){
        var colors = [X_C, O_C, '#7bf0a4', '#ffe066', '#b388ff'];
        return React.createElement('div', {
          key: 'cf' + k,
          className: 'ringin-confetti',
          style: {
            position: 'absolute', top: -20,
            left: (5 + (k * 8)) + '%',
            width: 8, height: 12, borderRadius: 2,
            background: colors[k % colors.length],
            animationDelay: ((k % 6) * 0.12) + 's'
          }
        });
      })
    ) : null;

    resultOverlay = React.createElement('div', {
      style: {
        position: 'absolute', inset: 0, zIndex: 6,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, borderRadius: 20,
        background: 'radial-gradient(circle at 50% 40%, rgba(13,17,23,.94), rgba(8,11,16,.98))'
      }
    },
      rays,
      confetti,
      React.createElement('div', {
        className: bigCls,
        style: {
          fontSize: 34, fontWeight: 900, color: bigColor, textAlign: 'center',
          textShadow: '0 0 26px ' + bigColor + '77', position: 'relative', zIndex: 2
        }
      }, bigText),
      React.createElement('div', {
        style: { fontSize: 15, fontWeight: 800, color: '#cfd8e3', position: 'relative', zIndex: 2 }
      }, 'Final score  ' + myScore + ' — ' + oppScore),
      React.createElement('div', {
        style: { fontSize: 12.5, fontWeight: 600, color: '#7e8a9c', position: 'relative', zIndex: 2 }
      }, status === 'abandoned' ? 'Match ended' : 'Best of ' + bo),
      canClose ? React.createElement('div', {
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
      ) : React.createElement('div', {
        /* HOST (canClose===false): the result overlay covers the footer Minimise,
         * and the host has no Play-again/Close — without this they'd be trapped on
         * the result with the whole call UI covered. Give them Back-to-call. */
        style: { position: 'relative', zIndex: 2, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280, alignItems: 'center' }
      },
        React.createElement('button', {
          className: 'ringin-tap',
          onClick: function(){ if (onMinimize) onMinimize(); },
          style: { border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%', background: 'linear-gradient(180deg,#1e2a3a,#16202c)', color: '#cfe6ff' }
        }, '⬇ Back to call'),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#7e8a9c' } }, 'The other player can start a new game')
      )
    );
  }

  // ── Footer: Minimise (prominent) / Forfeit (active only) / Close ──
  var btnBase = {
    border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14,
    cursor: 'pointer'
  };

  var minimiseBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onMinimize) onMinimize(); },
    style: Object.assign({}, btnBase, {
      flex: 1.4, padding: '13px 14px',
      background: 'linear-gradient(180deg,#1e2a3a,#16202c)',
      color: '#cfe6ff',
      border: '1px solid rgba(90,209,255,.45)',
      boxShadow: '0 0 14px rgba(90,209,255,.18)'
    })
  }, '▽ Minimise');

  var forfeitBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: doForfeit,
    disabled: busy || isOver || !!err || !game,
    style: Object.assign({}, btnBase, {
      flex: 1, padding: '13px 12px',
      background: (busy || isOver || err || !game) ? '#1b1f27' : 'linear-gradient(180deg,#3a2230,#2a1822)',
      color: (busy || isOver || err || !game) ? '#525a68' : '#ff9bb5',
      cursor: (busy || isOver || err || !game) ? 'default' : 'pointer'
    })
  }, 'Forfeit');

  var closeBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onClose) onClose(); },
    style: Object.assign({}, btnBase, {
      flex: 1, padding: '13px 12px',
      background: '#161b24', color: '#cfd8e3', border: '1px solid #232b3a'
    })
  }, 'Close');

  var footer = React.createElement('div', {
    style: { display: 'flex', gap: 9, marginTop: 16, width: '100%' }
  }, minimiseBtn, (isOver || err) ? null : forfeitBtn, canClose ? closeBtn : null);

  // ── Card ──
  var boardWrap = React.createElement('div', {
    style: { position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }
  }, liveBoard, bannerOverlay);

  return React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 18, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 14px 48px rgba(0,0,0,.55)',
      maxWidth: 360, width: '100%', margin: '0 auto',
      maxHeight: '90vh', overflowY: 'auto'
    }
  },
    title,
    roundLine,
    scoreboard,
    statusBadge,
    boardWrap,
    footer,
    resultOverlay
  );
}
