/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// RockPaperScissorsGame — in-call 2-player Rock-Paper-Scissors (best of 5,
// simultaneous, hidden picks).
//
// Backed by migration 0061_more_call_games.sql (game_type 'rps'). State is
// SERVER-AUTHORITATIVE: scores, round resolution and the match winner are ALL
// decided by the SECURITY DEFINER RPC rps_throw. This component NEVER computes
// a winner/round outcome client-side — it only renders what game_sessions.state
// reports. The opponent's current-round pick is hidden server-side (private
// rps_picks table) until BOTH players throw, so we never try to read it.
//
// Sync path mirrors TicTacToeGame.js: on mount seed via get_game, subscribe to
// game_sessions UPDATE (filtered to this id), replace local state on every
// payload.new, remove the channel on unmount, guard with mountedRef.
//
// 0061 MAY NOT BE RUN YET. Every sb.rpc + the realtime subscribe is
// try/catch-guarded; if the function/table is missing we degrade to a calm
// 'Game unavailable' message and never crash the call screen.
//
// Props:
//   gameId    - uuid of the game_sessions row
//   myMark    - 'X' | 'O'  (which side this user is)
//   myUserId  - this user's auth id (to resolve win/loss vs game.winner)
//   onClose   - () => void  (parent closes the game overlay)
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var CHOICES = [
  { key: 'rock',     emoji: '✊', label: 'Rock' },
  { key: 'paper',    emoji: '✋', label: 'Paper' },
  { key: 'scissors', emoji: '✌️', label: 'Scissors' }
];

function choiceEmoji(c){
  if (c === 'rock') return '✊';
  if (c === 'paper') return '✋';
  if (c === 'scissors') return '✌️';
  return '';
}

export default function RockPaperScissorsGame(props){
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

  var busyS = useState(false);         // a throw/forfeit rpc is in flight
  var busy = busyS[0]; var setBusy = busyS[1];

  var myPickS = useState(null);        // local-only: choice I last tapped this round
  var myPick = myPickS[0]; var setMyPick = myPickS[1];

  var mountedRef = useRef(true);
  var roundRef = useRef(null);         // tracks round to clear local pick on resolve

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
      ch = sb.channel('rps-' + gameId)
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
      // Realtime unavailable (table not in publication / 0061 unrun). get_game
      // seeding still gives a usable snapshot; just no live opponent updates.
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
  var state   = (game && game.state && typeof game.state === 'object') ? game.state : null;
  var status  = game ? game.status : null;
  var isOver  = status === 'won' || status === 'draw' || status === 'abandoned';

  var bestOf  = (state && state.best_of != null) ? state.best_of : 5;
  var round   = (state && state.round   != null) ? state.round   : 1;
  var score   = (state && state.score && typeof state.score === 'object') ? state.score : { X: 0, O: 0 };
  var thrown  = (state && state.thrown && typeof state.thrown === 'object') ? state.thrown : { X: false, O: false };
  var last    = (state && state.last) ? state.last : null;

  var otherMark = myMark === 'X' ? 'O' : 'X';
  var myScore  = (score[myMark] != null) ? score[myMark] : 0;
  var oppScore = (score[otherMark] != null) ? score[otherMark] : 0;

  var iThrew  = thrown[myMark] === true;
  var myTurn  = !!(game && status === 'active' && !iThrew); // can still act this round

  // Clear the local pick whenever the round advances (server resolved a round).
  useEffect(function(){
    if (roundRef.current === null) { roundRef.current = round; return; }
    if (round !== roundRef.current) {
      roundRef.current = round;
      if (mountedRef.current) setMyPick(null);
    }
  }, [round]);

  // Throw a choice → server-validated rps_throw.
  function doThrow(choice){
    if (busy || !game || err || isOver || iThrew) return;
    setMyPick(choice); // local immediate feedback only; server is source of truth
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('rps_throw', { p_game: gameId, p_choice: choice });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);   // realtime will also confirm
        }
        // On error (bad_choice / game_not_active / race) we no-op — the
        // authoritative state from realtime/get_game stays correct.
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
    if (status === 'won') {
      return (game.winner && myUserId && game.winner === myUserId) ? 'You won! 🎉' : 'You lost';
    }
    if (status === 'draw') return 'Draw';
    if (status === 'abandoned') {
      return (game.winner && myUserId && game.winner === myUserId)
        ? 'Opponent forfeited — you win'
        : 'You forfeited';
    }
    // active
    if (iThrew) return 'Waiting for opponent…';
    return 'Make your pick';
  }

  // Last-round result text relative to me.
  function lastResultText(){
    if (!last || !last.winner) return '';
    if (last.winner === 'tie') return 'Tie';
    return last.winner === myMark ? 'You won that round' : 'You lost that round';
  }

  // ── Render ──
  var TXT = '#e8edf4', MUTED = '#9fb0c3', X_ACC = '#5ad1ff', O_ACC = '#ff7eb6';

  var header = React.createElement('div', {
    style: { fontSize: 18, fontWeight: 700, color: TXT, marginBottom: 4, textAlign: 'center' }
  }, 'Rock · Paper · Scissors');

  var statusLine = React.createElement('div', {
    style: {
      fontSize: 15, fontWeight: 600,
      color: isOver ? MUTED : (myTurn ? X_ACC : MUTED),
      marginBottom: 12, textAlign: 'center', minHeight: 20
    }
  }, statusText());

  // Scoreboard: "You N — M Opp"
  var scoreboard = React.createElement('div', {
    style: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginBottom: 4 }
  },
    React.createElement('span', { style: { fontSize: 13, color: MUTED } }, 'You'),
    React.createElement('span', { style: { fontSize: 28, fontWeight: 800, color: X_ACC } }, String(myScore)),
    React.createElement('span', { style: { fontSize: 20, color: '#3a4150' } }, '—'),
    React.createElement('span', { style: { fontSize: 28, fontWeight: 800, color: O_ACC } }, String(oppScore)),
    React.createElement('span', { style: { fontSize: 13, color: MUTED } }, 'Opp')
  );

  var roundLine = React.createElement('div', {
    style: { fontSize: 12, color: MUTED, marginBottom: 14, textAlign: 'center' }
  }, 'Round ' + round + ' · best of ' + bestOf);

  // Three choice buttons.
  var disabledAll = !!err || isOver || iThrew || busy || !game;
  var choiceBtns = CHOICES.map(function(c){
    var picked = myPick === c.key;
    var disabled = disabledAll;
    return React.createElement('button', {
      key: c.key,
      onClick: disabled ? undefined : function(){ doThrow(c.key); },
      disabled: disabled,
      'aria-label': c.label,
      style: {
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4,
        padding: '14px 6px',
        borderRadius: 14,
        background: picked ? '#15202c' : '#11151c',
        border: picked ? ('1px solid ' + X_ACC) : '1px solid #232a36',
        color: disabled && !picked ? '#5f6776' : TXT,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !picked ? 0.6 : 1,
        userSelect: 'none',
        transition: 'background .12s ease, border .12s ease'
      }
    },
      React.createElement('span', { style: { fontSize: 30, lineHeight: 1 } }, c.emoji),
      React.createElement('span', { style: { fontSize: 12, fontWeight: 600 } }, c.label)
    );
  });

  var choiceRow = React.createElement('div', {
    style: { display: 'flex', gap: 8, width: '100%', marginBottom: 14 }
  }, choiceBtns);

  // Last-round summary (your pick vs opponent pick + result).
  var lastBlock = null;
  if (last && (last.X || last.O)) {
    var myLast  = last[myMark];
    var oppLast = last[otherMark];
    var resText = lastResultText();
    var resColor = (last.winner === 'tie')
      ? MUTED
      : (last.winner === myMark ? X_ACC : O_ACC);
    lastBlock = React.createElement('div', {
      style: {
        width: '100%', padding: '10px 12px', borderRadius: 12,
        background: '#0b0f15', border: '1px solid #1c2230',
        textAlign: 'center', marginBottom: 6
      }
    },
      React.createElement('div', { style: { fontSize: 11, color: '#6b7585', marginBottom: 4 } }, 'Last round'),
      React.createElement('div', { style: { fontSize: 24, marginBottom: 4 } },
        React.createElement('span', null, choiceEmoji(myLast) || '–'),
        React.createElement('span', { style: { fontSize: 14, color: MUTED, margin: '0 8px' } }, 'vs'),
        React.createElement('span', null, choiceEmoji(oppLast) || '–')
      ),
      React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: resColor } }, resText)
    );
  }

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

  // Forfeit only shown while the game is active.
  var buttonsChildren = [];
  if (status === 'active') buttonsChildren.push(forfeitBtn);
  buttonsChildren.push(closeBtn);
  var buttons = React.createElement('div', {
    style: { display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center', width: '100%' }
  }, buttonsChildren);

  var youAre = React.createElement('div', {
    style: { fontSize: 12, color: '#6b7585', marginTop: 12, textAlign: 'center' }
  }, 'You are ' + (myMark || '?'));

  var bodyChildren = [header, statusLine, scoreboard, roundLine, choiceRow];
  if (lastBlock) bodyChildren.push(lastBlock);
  bodyChildren.push(buttons, youAre);

  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 20, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 360, width: '100%', margin: '0 auto',
      maxHeight: '90vh', overflowY: 'auto',
      boxSizing: 'border-box'
    }
  }, bodyChildren);
}
