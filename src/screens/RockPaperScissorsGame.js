/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// RockPaperScissorsGame — in-call 2-player Rock-Paper-Scissors (best of 5,
// simultaneous, hidden picks). FAST · COLORFUL · ANIMATED rebuild.
//
// Backed by migration 0061_more_call_games.sql (game_type 'rps'). State is
// SERVER-AUTHORITATIVE: scores, round resolution and the match winner are ALL
// decided by the SECURITY DEFINER RPC rps_throw. This component NEVER computes
// a winner/round outcome client-side — it only renders what game_sessions.state
// reports. The opponent's current-round pick is hidden server-side (private
// rps_picks table) until BOTH players throw, so we never read it.
//
// State shape (0061):
//   game.state = { best_of:5, round:N, score:{X,O},
//                  thrown:{X:bool,O:bool},
//                  last:{X:choice,O:choice,winner:'X'|'O'|'tie'}|null }
// RPC: sb.rpc('rps_throw',{p_game,p_choice:'rock'|'paper'|'scissors'})
//      sb.rpc('forfeit_game',{p_game})
//      sb.rpc('get_game',{p_game})  (seed)
//
// OPTIMISTIC: the instant you tap a hand we lock the local "shoot/waiting"
// state (your pick shown, buttons disabled) BEFORE the RPC returns, so the
// move feels instant. Authoritative server state (RPC return OR realtime)
// always supersedes it; on RPC error the next server state corrects it.
//
// Sync: seed via get_game; subscribe to game_sessions UPDATE (filtered to this
// id); setGame(payload.new); remove channel on unmount; mountedRef guard.
// Every rpc + the subscribe is try/catch-guarded → calm 'Game unavailable'.
//
// Props: gameId, myMark ('X'|'O'), myUserId, onClose, onMinimize.
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var TXT = '#e8edf4', MUTED = '#9fb0c3', X_ACC = '#5ad1ff', O_ACC = '#ff7eb6';

var CHOICES = [
  { key: 'rock',     emoji: '✊', label: 'Rock',     g: 'linear-gradient(150deg,#ff9a6b,#ff5e7e)' },
  { key: 'paper',    emoji: '✋', label: 'Paper',    g: 'linear-gradient(150deg,#5ad1ff,#5a8bff)' },
  { key: 'scissors', emoji: '✌️', label: 'Scissors', g: 'linear-gradient(150deg,#b06bff,#ff6bd6)' }
];

function choiceEmoji(c){
  if (c === 'rock') return '✊';
  if (c === 'paper') return '✋';
  if (c === 'scissors') return '✌️';
  return '';
}

export default function RockPaperScissorsGame(props){
  var gameId     = props.gameId;
  var myMark     = props.myMark;
  var myUserId   = props.myUserId;
  var onClose    = props.onClose;
  var onMinimize = props.onMinimize;
  // Close-button gating (SHARED CONTRACT): the INITIATOR (player_x → myMark 'X')
  // drives the game lifecycle and may Close; the host (myMark 'O') cannot — their
  // window is closed for them via a broadcast from the initiator. Default TRUE
  // when undefined so this stays backward-compatible.
  var canClose = props.canClose !== false;

  // ── State (ALL hooks BEFORE any conditional return) ──
  var gameS = useState(null);
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);
  var busy = busyS[0]; var setBusy = busyS[1];

  // Optimistic local pick for the CURRENT round. {round, choice} or null.
  // Set the instant the user taps; cleared once the server confirms we've
  // thrown (server thrown flag flips) or the round advances.
  var optS = useState(null);
  var opt = optS[0]; var setOpt = optS[1];

  // Toggle to retrigger the result-reveal animation when last changes.
  var revealKeyS = useState(0);
  var revealKey = revealKeyS[0]; var setRevealKey = revealKeyS[1];

  var mountedRef = useRef(true);
  var roundRef   = useRef(null);
  var lastSigRef = useRef(null);

  // Brief post-resolution window where we SHOW the round result (both hands +
  // win/lose banner) even though the server already advanced the round and
  // reset the thrown flags. Without this you'd snap straight back to the picker
  // and never see who won the round.
  var revealingS = useState(false);
  var revealing = revealingS[0]; var setRevealing = revealingS[1];
  var revealTimerRef = useRef(null);

  // H6 DECIDING-ROUND REVEAL: when the MATCH ends we still want to flash both
  // hands of the deciding round (last.X / last.O) with .ringin-hand-reveal for
  // ~1.2s BEFORE the win/lose overlay slides in — otherwise the final round's
  // hands never show (the normal `revealing` window is skipped once isOver).
  var decRevealS = useState(false);
  var decReveal = decRevealS[0]; var setDecReveal = decRevealS[1];
  var decTimerRef = useRef(null);
  var decDoneSigRef = useRef(null);

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
          if (!n || !n.id) return;
          // N1: initiator closed the game (durable closed_at marker) → mirror the
          // dismissal even if the broadcast was lost. Never set during play / on a
          // result, so it can't swallow an outcome. undefined pre-migration → no-op.
          if (n.closed_at) { if (onClose) onClose(); return; }
          setGame(n);
        })
        .subscribe(function(s){
          // H7 RECONNECT: a dropped/errored realtime channel can leave the
          // round stuck (e.g. opponent threw but we never got the UPDATE).
          // Re-seed authoritative state via get_game.
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
      if (revealTimerRef.current) { try { clearTimeout(revealTimerRef.current); } catch (_) {} }
      if (decTimerRef.current) { try { clearTimeout(decTimerRef.current); } catch (_) {} }
    };
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

  var serverIThrew = thrown[myMark] === true;
  // Optimistic "I threw this round" merges the server flag with the local pick.
  var optActive = !!(opt && opt.round === round);
  var iThrew    = serverIThrew || optActive;
  var oppThrew  = thrown[otherMark] === true;

  // What hand am I showing this round (optimistic first, then nothing — the
  // server never echoes my pick back into state mid-round, only via last).
  var myShownChoice = optActive ? opt.choice : null;

  // Clear the optimistic pick the MOMENT the server advances to a new round, so
  // the next round starts clean (buttons re-enabled, NO leftover "you picked X"
  // highlight bleeding through from the prior round). This is the round-2-lag
  // fix: previously the stale opt could survive into the new round because the
  // only guaranteed trigger was serverIThrew flipping. Now we drive purely off
  // state.round — if opt belongs to any round other than the current server
  // round, it is dead and must be dropped immediately.
  useEffect(function(){
    if (roundRef.current === null) { roundRef.current = round; }
    var roundChanged = round !== roundRef.current;
    if (roundChanged) roundRef.current = round;
    if (!mountedRef.current) return;
    // Stale optimistic pick from a previous round → drop it now. (Covers both
    // the round-advanced case AND any case where opt.round drifted from the
    // authoritative server round.)
    if (opt && opt.round !== round) {
      setOpt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, serverIThrew]);

  // When a round resolves (last changes) retrigger the reveal animation AND hold
  // a ~1.6s window where the result (both hands + win/lose banner) stays on
  // screen before dropping back to the picker for the next round. Skipped once
  // the match is over (the match-end overlay takes over instead).
  useEffect(function(){
    var sig = last ? (round + ':' + (last.winner || '') + ':' + (last.X || '') + (last.O || '')) : null;
    if (sig && sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      if (!mountedRef.current) return;
      setRevealKey(function(k){ return k + 1; });
      if (!isOver) {
        setRevealing(true);
        if (revealTimerRef.current) { try { clearTimeout(revealTimerRef.current); } catch (_) {} }
        revealTimerRef.current = setTimeout(function(){
          if (mountedRef.current) setRevealing(false);
        }, 1600);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, round, isOver]);

  // H6: when the match ENDS and we have the deciding round's hands, flash a
  // brief reveal window (~1.2s) before the overlay. We key it on the last
  // signature so it fires exactly once for the deciding round.
  useEffect(function(){
    if (!isOver) return;
    var hasHands = !!(last && (last.X || last.O));
    if (!hasHands) return;
    var sig = (last.winner || '') + ':' + (last.X || '') + ':' + (last.O || '');
    if (decDoneSigRef.current === sig) return;
    decDoneSigRef.current = sig;
    if (!mountedRef.current) return;
    setDecReveal(true);
    if (decTimerRef.current) { try { clearTimeout(decTimerRef.current); } catch (_) {} }
    decTimerRef.current = setTimeout(function(){
      if (mountedRef.current) setDecReveal(false);
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver, last]);

  // ── Actions ──
  // Re-seed authoritative state from the server (realtime reconnect path).
  function reseed(){
    (async function(){
      try {
        var r = await sb.rpc('get_game', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && r.error) return;
        var row = r ? r.data : null;
        if (Array.isArray(row)) row = row[0];
        // N1: honor a close that happened while we were disconnected (the
        // realtime UPDATE can be missed) so the host's window closes on reconnect.
        if (row && row.closed_at) { if (onClose) onClose(); return; }
        if (row && row.id) setGame(row);
      } catch (_) {}
    })();
  }

  function doThrow(choice){
    if (busy || !game || err || isOver || iThrew) return;
    setOpt({ round: round, choice: choice });   // OPTIMISTIC: lock in instantly
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('rps_throw', { p_game: gameId, p_choice: choice });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);
        }
        // On error (bad_choice / not_active / race) we no-op — the server's
        // authoritative state (realtime/get_game) stays correct & supersedes opt.
      } catch (_) {
        // swallow — server is source of truth
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
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  // ── Status / result text (server-driven only) ──
  function statusText(){
    if (err) return 'Game unavailable';
    if (loading || !game) return 'Loading…';
    if (status === 'won')   return (game.winner && myUserId && game.winner === myUserId) ? 'You win! 🎉' : 'You lost';
    if (status === 'draw')  return 'Draw';
    if (status === 'abandoned')
      return (game.winner && myUserId && game.winner === myUserId) ? 'Opponent forfeited' : 'You forfeited';
    if (revealing && last && last.winner) {
      if (last.winner === 'tie') return 'Tie round';
      return last.winner === myMark ? 'You won the round! 🎉' : 'You lost the round';
    }
    if (iThrew && !oppThrew) return 'Rock… Paper… Scissors…';
    if (iThrew && oppThrew)  return 'Resolving…';
    return 'Make your pick';
  }

  function lastResultText(){
    if (!last || !last.winner) return '';
    if (last.winner === 'tie') return 'Tie';
    return last.winner === myMark ? 'You won that round!' : 'You lost that round';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Header.
  var header = React.createElement('div', {
    style: {
      fontSize: 19, fontWeight: 800, letterSpacing: .3, marginBottom: 8, textAlign: 'center',
      backgroundImage: 'linear-gradient(90deg,' + X_ACC + ',' + O_ACC + ')',
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      WebkitTextFillColor: 'transparent', color: X_ACC
    }
  }, 'Rock · Paper · Scissors');

  // Status line — pulse while it's my turn to pick.
  var statusActiveColor = (iThrew && !oppThrew) ? O_ACC : X_ACC;
  var statusLine = React.createElement('div', {
    className: (!isOver && !iThrew && !err && !loading) ? 'ringin-turn-glow' : undefined,
    style: {
      fontSize: 14, fontWeight: 700,
      color: isOver ? MUTED : statusActiveColor,
      margin: '0 auto 12px', textAlign: 'center', minHeight: 20,
      padding: '6px 14px', borderRadius: 999,
      background: isOver ? 'transparent' : 'rgba(90,209,255,.06)',
      border: isOver ? '1px solid transparent' : '1px solid rgba(90,209,255,.18)'
    }
  }, statusText());

  // Scoreboard "You N — M Opp".
  function pip(filled, color){
    return React.createElement('span', {
      style: {
        width: 8, height: 8, borderRadius: '50%',
        background: filled ? color : 'rgba(255,255,255,.12)',
        boxShadow: filled ? ('0 0 6px ' + color) : 'none',
        transition: 'background .2s ease'
      }
    });
  }
  var needWin = Math.ceil(bestOf / 2);
  function pipRow(count, color){
    var dots = [];
    for (var i = 0; i < needWin; i++) dots.push(pip(i < count, color));
    return React.createElement('div', { style: { display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4 } }, dots);
  }

  var scoreboard = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      marginBottom: 4, width: '100%'
    }
  },
    React.createElement('div', { style: { textAlign: 'center', flex: 1 } },
      React.createElement('div', { style: { fontSize: 12, color: MUTED, fontWeight: 600 } }, 'You'),
      React.createElement('div', { style: { fontSize: 34, fontWeight: 900, color: X_ACC, lineHeight: 1.05, textShadow: '0 0 16px rgba(90,209,255,.45)' } }, String(myScore)),
      pipRow(myScore, X_ACC)
    ),
    React.createElement('div', { style: { fontSize: 18, color: '#3a4150', fontWeight: 800 } }, '—'),
    React.createElement('div', { style: { textAlign: 'center', flex: 1 } },
      React.createElement('div', { style: { fontSize: 12, color: MUTED, fontWeight: 600 } }, 'Opp'),
      React.createElement('div', { style: { fontSize: 34, fontWeight: 900, color: O_ACC, lineHeight: 1.05, textShadow: '0 0 16px rgba(255,126,182,.45)' } }, String(oppScore)),
      pipRow(oppScore, O_ACC)
    )
  );

  var roundLine = React.createElement('div', {
    style: { fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 14, textAlign: 'center' }
  }, 'Round ' + round + ' · best of ' + bestOf);

  // ── Centre arena: either the choice buttons, or the shoot/reveal stage ──
  var arena;

  // The reveal arena shows during the active shoot/waiting phase, the brief
  // post-round reveal window, AND (H6) the deciding-round reveal once the match
  // is over but we still have the final hands to flash.
  var showArena = (iThrew && status === 'active') || (revealing && last) || (decReveal && last);

  if (showArena) {
    // SHOOT / WAITING / REVEAL stage.
    // My hand: shaking until opponent in (no reveal yet), then settle to last.
    var hasReveal = !!(last && (last.X || last.O));
    var myHand = myShownChoice ? choiceEmoji(myShownChoice) : '✊';
    var oppHand = '✊';
    if (hasReveal) {
      myHand  = choiceEmoji(last[myMark]) || myHand;
      oppHand = choiceEmoji(last[otherMark]) || '✊';
    }

    var shaking = !hasReveal;
    // H6: the deciding-round flash uses the springy reveal pop on both hands.
    var decidingFlash = decReveal && hasReveal;

    // handCell(emoji, color, who, opts)
    //   opts.shake  → shake ONLY this hand (L6: my hand while waiting)
    //   opts.dim    → render the opponent placeholder dimmed until reveal (L6)
    //   opts.reveal → use the springy .ringin-hand-reveal on reveal (H6)
    function handCell(emoji, color, who, opts){
      opts = opts || {};
      var anim = opts.shake ? 'ringin-hand-shake'
        : (hasReveal ? (opts.reveal ? 'ringin-hand-reveal' : 'ringin-result-in') : undefined);
      return React.createElement('div', {
        style: {
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: opts.dim ? 0.45 : 1, transition: 'opacity .2s ease'
        }
      },
        React.createElement('div', {
          key: who + '-' + revealKey + (shaking ? '-shake' : '-rev') + (decidingFlash ? '-dec' : ''),
          className: anim,
          style: {
            width: 84, height: 84, borderRadius: 22, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 46,
            // L7: nudge the glyph baseline so ✌️ (which sits high) lines up
            // vertically with ✊ / ✋. Lift line-height + tiny translate.
            lineHeight: 1,
            background: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,.10),rgba(255,255,255,0) 60%), #11151c',
            border: '1px solid ' + color + '55',
            boxShadow: '0 0 18px ' + color + '33, inset 0 1px 0 rgba(255,255,255,.06)'
          }
        }, React.createElement('span', {
          style: { display: 'inline-block', transform: (emoji === '✌️') ? 'translateY(3px)' : 'none' }
        }, emoji)),
        React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: color } }, who)
      );
    }

    var resultBanner = null;
    if (hasReveal) {
      var rText = lastResultText();
      var rColor = (last.winner === 'tie') ? MUTED : (last.winner === myMark ? X_ACC : O_ACC);
      resultBanner = React.createElement('div', {
        key: 'rb-' + revealKey,
        className: 'ringin-result-in',
        style: {
          marginTop: 12, padding: '8px 16px', borderRadius: 999,
          fontSize: 15, fontWeight: 800, color: rColor,
          background: rColor + '14', border: '1px solid ' + rColor + '44',
          textShadow: (last.winner === 'tie') ? 'none' : ('0 0 12px ' + rColor + '66')
        }
      }, rText);
    }

    arena = React.createElement('div', {
      style: {
        width: '100%', marginBottom: 14, padding: '18px 8px', borderRadius: 18,
        background: 'linear-gradient(180deg,#0b0f15,#0a0d12)',
        border: '1px solid #1c2230', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' } },
        // L6: shake ONLY my hand while waiting for the opponent.
        handCell(myHand, X_ACC, 'You', { shake: shaking, reveal: decidingFlash }),
        React.createElement('div', { style: { fontSize: 16, fontWeight: 800, color: '#3a4150' } }, 'VS'),
        // L6: opp side stays dimmed (✊/?) until the reveal lands.
        handCell(hasReveal ? oppHand : '?', O_ACC, 'Opp', { dim: !hasReveal, reveal: decidingFlash })
      ),
      resultBanner,
      (!hasReveal)
        ? React.createElement('div', { style: { fontSize: 12, color: MUTED, marginTop: 12, fontWeight: 600 } },
            oppThrew ? 'Resolving…' : 'Waiting for opponent…')
        : null
    );
  } else {
    // CHOICE buttons (active & not yet thrown, OR game over → disabled+dim).
    var disabledAll = !!err || isOver || iThrew || busy || !game;
    var choiceBtns = CHOICES.map(function(c){
      var picked = myShownChoice === c.key;
      var disabled = disabledAll;
      return React.createElement('button', {
        key: c.key,
        className: 'ringin-tap',
        onClick: disabled ? undefined : function(){ doThrow(c.key); },
        disabled: disabled,
        'aria-label': c.label,
        style: {
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, padding: '18px 6px', borderRadius: 18,
          background: disabled ? '#11151c' : c.g,
          border: picked ? ('2px solid ' + TXT) : '1px solid rgba(255,255,255,.10)',
          color: disabled ? '#5f6776' : '#0b0f15',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: disabled ? 'none' : '0 6px 18px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35)',
          transition: 'transform .12s ease, opacity .15s ease'
        }
      },
        React.createElement('span', { style: { fontSize: 36, lineHeight: 1, filter: disabled ? 'grayscale(1)' : 'none' } }, c.emoji),
        React.createElement('span', { style: { fontSize: 12, fontWeight: 800 } }, c.label)
      );
    });
    arena = React.createElement('div', {
      style: { display: 'flex', gap: 10, width: '100%', marginBottom: 14 }
    }, choiceBtns);
  }

  // ── Controls: Minimise (prominent) · Forfeit (active only) · Close ──
  var btnBase = {
    border: 'none', borderRadius: 12, padding: '11px 14px',
    fontSize: 14, fontWeight: 800, cursor: 'pointer', flex: 1, whiteSpace: 'nowrap'
  };

  var minimiseBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onMinimize) onMinimize(); },
    style: Object.assign({}, btnBase, {
      background: 'linear-gradient(150deg,#5ad1ff,#5a8bff)',
      color: '#0b0f15', flex: 1.4,
      boxShadow: '0 6px 16px rgba(90,139,255,.35), inset 0 1px 0 rgba(255,255,255,.4)'
    })
  }, '▽ Minimise');

  var forfeitDisabled = busy || isOver || !!err || !game;
  var forfeitBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: forfeitDisabled ? undefined : doForfeit,
    disabled: forfeitDisabled,
    style: Object.assign({}, btnBase, {
      background: forfeitDisabled ? '#2a2f3a' : '#3a2230',
      color: forfeitDisabled ? '#5f6776' : '#ff8fb0',
      cursor: forfeitDisabled ? 'default' : 'pointer'
    })
  }, 'Forfeit');

  var closeBtn = React.createElement('button', {
    className: 'ringin-tap',
    onClick: function(){ if (onClose) onClose(); },
    style: Object.assign({}, btnBase, { background: '#1c222c', color: '#cfd8e3' })
  }, 'Close');

  var controlChildren = [minimiseBtn];
  if (status === 'active') controlChildren.push(forfeitBtn);
  // Only the initiator gets Close; the host keeps just Minimise (+ Forfeit while active).
  if (canClose) controlChildren.push(closeBtn);
  var controls = React.createElement('div', {
    style: { display: 'flex', gap: 8, marginTop: 6, width: '100%' }
  }, controlChildren);

  var youAre = React.createElement('div', {
    style: { fontSize: 11, color: '#6b7585', marginTop: 10, textAlign: 'center' }
  }, 'You are ' + (myMark || '?'));

  // ── Win/Lose/Draw celebration overlay (inside the card) ──
  // H6: hold the overlay back while the deciding-round hands flash (decReveal),
  // so the final round's reveal is visible before the win/lose takes over.
  var overlay = null;
  if (isOver && !decReveal) {
    var iWon = (status === 'won' || status === 'abandoned') && game && myUserId && game.winner === myUserId;
    var isDraw = status === 'draw';
    var bigText = isDraw ? 'Draw' : (iWon ? 'You win! 🎉' : 'You lost');
    var bigColor = isDraw ? MUTED : (iWon ? X_ACC : O_ACC);

    var overlayKids = [];

    // Radiating rays (only on a win).
    if (iWon) {
      for (var ri = 0; ri < 6; ri++) {
        overlayKids.push(React.createElement('div', {
          key: 'ray' + ri,
          className: 'ringin-win-ray',
          style: {
            position: 'absolute', top: '38%', left: '50%', width: 6, height: 150,
            marginLeft: -3, marginTop: -75, borderRadius: 3,
            background: 'linear-gradient(' + bigColor + ',transparent)',
            transform: 'rotate(' + (ri * 60) + 'deg)', transformOrigin: '50% 50%',
            animationDelay: (ri * 0.05) + 's', opacity: 0
          }
        }));
      }
      // Confetti.
      var confColors = [X_ACC, O_ACC, '#ffd166', '#06d6a0', '#ff9a6b', '#b06bff'];
      for (var ci = 0; ci < 14; ci++) {
        overlayKids.push(React.createElement('div', {
          key: 'conf' + ci,
          className: 'ringin-confetti',
          style: {
            position: 'absolute', top: 0, left: (6 + (ci * 6.5)) + '%',
            width: 8, height: 12, borderRadius: 2,
            background: confColors[ci % confColors.length],
            animationDelay: ((ci % 7) * 0.12) + 's', opacity: 0
          }
        }));
      }
    }

    overlayKids.push(React.createElement('div', {
      key: 'big',
      className: iWon ? 'ringin-game-win' : (isDraw ? 'ringin-result-in' : 'ringin-game-lose'),
      style: {
        position: 'relative', zIndex: 2, fontSize: 34, fontWeight: 900,
        color: bigColor, textShadow: isDraw ? 'none' : ('0 0 24px ' + bigColor + '88'),
        textAlign: 'center'
      }
    }, bigText));

    overlayKids.push(React.createElement('div', {
      key: 'sub', style: { position: 'relative', zIndex: 2, marginTop: 6, fontSize: 14, color: MUTED, fontWeight: 600 }
    }, 'Final score  ' + myScore + ' — ' + oppScore));

    // Lifecycle controls (Play again / Other games / Close) drive the game
    // session, so ONLY the initiator (canClose) gets them. The host (canClose
    // false) gets a Back-to-call (Minimise) button — this overlay covers the
    // footer Minimise and they have no Close, so otherwise they'd be trapped.
    if (canClose) {
      overlayKids.push(React.createElement('div', {
        key: 'ovctrl',
        style: { position: 'relative', zIndex: 2, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }
      },
        React.createElement('button', {
          className: 'ringin-tap',
          onClick: function(){ if (props.onPlayAgain) props.onPlayAgain(); },
          style: Object.assign({}, btnBase, {
            background: 'linear-gradient(135deg,#5ad1ff,#5a8bff)', color: '#08121c',
            boxShadow: '0 6px 16px rgba(90,139,255,.4)'
          })
        }, '🔄 Play again'),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', {
            className: 'ringin-tap',
            onClick: function(){ if (props.onPickAnother) props.onPickAnother(); },
            style: Object.assign({}, btnBase, { background: '#141a24', color: '#cfd8e3', border: '1px solid #2a3344' })
          }, '🎮 Other games'),
          React.createElement('button', {
            className: 'ringin-tap',
            onClick: function(){ if (onClose) onClose(); },
            style: Object.assign({}, btnBase, { background: '#1c222c', color: '#cfd8e3' })
          }, 'Close')
        )
      ));
    } else {
      overlayKids.push(React.createElement('div', {
        key: 'ovctrl',
        style: { position: 'relative', zIndex: 2, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280, alignItems: 'center' }
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
        position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden',
        background: 'linear-gradient(180deg,rgba(13,17,23,.94),rgba(10,13,18,.97))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, boxSizing: 'border-box'
      }
    }, overlayKids);
  }

  // ── Compose card body ──
  var bodyChildren = [header, statusLine, scoreboard, roundLine, arena, controls, youAre];

  return React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 20, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 360, width: '100%', margin: '0 auto',
      maxHeight: '90vh', overflowY: 'auto',
      boxSizing: 'border-box'
    }
  }, bodyChildren.concat(overlay ? [overlay] : []));
}
