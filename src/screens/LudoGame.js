/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// LudoGame — in-call / in-room 2-player Ludo.
//
// Backed by migration 0061_more_call_games.sql (on top of 0060). State is
// SERVER-AUTHORITATIVE: the dice roll, every legal move, captures, the home
// run and the winner are ALL decided by the SECURITY DEFINER RPCs
// (ludo_roll / ludo_move) + get_game / forfeit_game. This component NEVER
// rolls its own dice and NEVER computes an outcome — it only renders whatever
// game_sessions.state / status / winner report.
//
// game.state shape (from 0061):
//   { tokens:{ X:[p,p,p,p], O:[p,p,p,p] }, roll:1..6|null,
//     last_roll:1..6|null, must_move:bool }
//   token pos encoding: -1 base; 0..50 shared track (relative step);
//   51..56 home column; 57 = HOME (finished). Win = all four === 57.
//
// A token i of myMark (value t) is MOVABLE iff:
//   (t === -1 && roll === 6) OR (t >= 0 && t <= 56 && t + roll <= 57).
// We only use this to decide which chips are tappable / highlighted — the
// server re-validates and rejects anything illegal (we just no-op).
//
// Sync path mirrors TicTacToeGame.js exactly: seed via get_game on mount,
// subscribe to game_sessions UPDATE filtered to this id, setGame(payload.new)
// on each event, remove the channel on unmount, mountedRef guard.
//
// 0061 MAY NOT BE RUN YET. Every sb.rpc + the realtime subscribe is
// try/catch-guarded; if the function/table is missing we degrade to a calm
// 'Game unavailable' message and never crash the call/room screen.
//
// RENDERING CHOICE: a clear, unambiguous chip-per-token layout (Base /
// Step k/51 / Home lane k/6 / 🏠 Home) rather than a full 15×15 cross board.
// Correctness of state + an obvious movable affordance + playability are
// prioritised over pixel-perfect board art, per the brief's fallback option.
//
// Props (from caller):
//   gameId    - uuid of the game_sessions row
//   myMark    - 'X' | 'O'  (which side this user is)
//   myUserId  - this user's auth id (to resolve win/loss vs game.winner)
//   onClose   - () => void  (parent closes the game overlay)
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { sb } from '../utils/supabase';

var X_COLOR = '#5ad1ff';
var O_COLOR = '#ff7eb6';

var DIE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

export default function LudoGame(props){
  var gameId   = props.gameId;
  var myMark   = props.myMark;
  var myUserId = props.myUserId;
  var onClose  = props.onClose;

  // ── State (all hooks BEFORE any conditional return) ──
  var gameS = useState(null);          // the game_sessions row (server truth)
  var game = gameS[0]; var setGame = gameS[1];

  var loadingS = useState(true);
  var loading = loadingS[0]; var setLoading = loadingS[1];

  var errS = useState('');             // non-empty → backend unavailable
  var err = errS[0]; var setErr = errS[1];

  var busyS = useState(false);         // an rpc is in flight
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
      ch = sb.channel('ludo-' + gameId)
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
      // Realtime unavailable — get_game seeding still gives a usable snapshot;
      // we just won't get live opponent moves. Don't crash.
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
    if (tokens && Array.isArray(tokens[mark]) && tokens[mark].length === 4) return tokens[mark];
    return [-1, -1, -1, -1];
  }
  var myToks = tokArr(myMark);
  var oppToks = tokArr(oppMark);

  // Pure movable check — used ONLY for affordance; server re-validates.
  function isMovable(i){
    if (!myTurn || roll == null) return false;
    var t = myToks[i];
    if (t === -1) return roll === 6;
    if (t >= 0 && t <= 56) return (t + roll) <= 57;
    return false;
  }
  var anyMovable = isMovable(0) || isMovable(1) || isMovable(2) || isMovable(3);

  // Human-readable token state label.
  function tokenLabel(t){
    if (t === -1) return 'Base';
    if (t >= 0 && t <= 50) return 'Step ' + t + '/51';
    if (t >= 51 && t <= 56) return 'Home lane ' + (t - 50) + '/6';
    if (t === 57) return '🏠 Home';
    return '—';
  }

  function doRoll(){
    if (busy || !game || !myTurn || roll != null || err) return;
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('ludo_roll', { p_game: gameId });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);   // realtime will also confirm
        }
      } catch (_) {
        // swallow — server is the source of truth
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  function doMove(i){
    if (busy || !game || !myTurn || roll == null || err) return;
    if (!isMovable(i)) return;             // server re-validates; this is just UX
    setBusy(true);
    (async function(){
      try {
        var r = await sb.rpc('ludo_move', { p_game: gameId, p_token: i });
        if (!mountedRef.current) return;
        if (r && !r.error) {
          var row = r.data;
          if (Array.isArray(row)) row = row[0];
          if (row && row.id) setGame(row);
        }
        // On error (not_your_turn / illegal_move / race) we no-op — the
        // authoritative state from realtime/get_game stays correct.
      } catch (_) {
        // swallow
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
      if (game.winner && myUserId && game.winner === myUserId) return 'You won! 🎉';
      return 'You lost';
    }
    if (status === 'draw') return 'Draw';
    if (status === 'abandoned') {
      if (game.winner && myUserId && game.winner === myUserId) return 'Opponent forfeited — you win';
      return 'You forfeited';
    }
    if (status === 'waiting') return 'Waiting for opponent…';
    // active
    if (myTurn) {
      if (roll == null) return 'Your turn — roll the die';
      if (!anyMovable) return 'No moves — passing…';
      return 'You rolled ' + roll + ' — move a token';
    }
    return "Opponent's turn";
  }

  // ── Render building blocks ──
  var btnBase = {
    border: 'none', borderRadius: 12, padding: '10px 18px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer'
  };

  // Header.
  var header = React.createElement('div', {
    style: {
      fontSize: 18, fontWeight: 700, color: '#e8edf4',
      marginBottom: 4, textAlign: 'center'
    }
  }, 'Ludo');

  // Status line.
  var subStatus = React.createElement('div', {
    style: {
      fontSize: 15, fontWeight: 600,
      color: isOver ? '#9fb0c3' : (myTurn ? myColor : '#9fb0c3'),
      marginBottom: 12, textAlign: 'center', minHeight: 20
    }
  }, statusText());

  // Die display — show current roll prominently, else last_roll dimmed.
  var dieValue = (roll != null) ? roll : lastRoll;
  var dieFace = (dieValue != null && DIE_FACES[dieValue]) ? DIE_FACES[dieValue] : '🎲';
  var dieRow = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, marginBottom: 12, minHeight: 56
    }
  },
    React.createElement('div', {
      style: {
        fontSize: 44, lineHeight: '52px',
        color: roll != null ? myColor : '#6b7585',
        filter: roll != null ? 'none' : 'grayscale(40%)'
      }
    }, dieFace),
    React.createElement('div', {
      style: { fontSize: 12, color: '#9fb0c3', textAlign: 'left', minWidth: 92 }
    },
      (roll != null)
        ? ('Rolled ' + roll)
        : (lastRoll != null ? ('Last roll ' + lastRoll) : 'No roll yet')
    )
  );

  // Roll button — shown only when it's my turn and I haven't rolled.
  var rollBtn = null;
  if (myTurn && roll == null && !err) {
    rollBtn = React.createElement('button', {
      onClick: doRoll,
      disabled: busy,
      style: Object.assign({}, btnBase, {
        background: busy ? '#2a2f3a' : myColor,
        color: busy ? '#5f6776' : '#0a0d12',
        fontSize: 17, padding: '12px 26px', marginBottom: 14,
        cursor: busy ? 'default' : 'pointer'
      })
    }, '🎲 Roll');
  }

  // Token chip for one of my tokens (tappable when movable).
  function myChip(i){
    var t = myToks[i];
    var movable = isMovable(i) && !busy;
    return React.createElement('div', {
      key: 'my-' + i,
      onClick: movable ? function(){ doMove(i); } : undefined,
      role: 'button',
      'aria-label': 'your token ' + (i + 1) + ' ' + tokenLabel(t),
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '10px 12px', borderRadius: 12,
        background: movable ? 'rgba(90,209,255,0.10)' : '#11151c',
        border: movable ? ('1px solid ' + myColor) : '1px solid #232a36',
        boxShadow: movable ? ('0 0 0 1px ' + myColor + ', 0 0 12px rgba(90,209,255,0.35)') : 'none',
        cursor: movable ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'box-shadow .12s ease, background .12s ease'
      }
    },
      React.createElement('span', {
        style: {
          width: 14, height: 14, borderRadius: '50%',
          background: myColor, flex: '0 0 auto'
        }
      }),
      React.createElement('span', {
        style: { fontSize: 13, fontWeight: 700, color: '#e8edf4', flex: '1 1 auto' }
      }, 'Token ' + (i + 1) + ' · ' + tokenLabel(t)),
      React.createElement('span', {
        style: {
          fontSize: 11, fontWeight: 700,
          color: movable ? myColor : '#5f6776', flex: '0 0 auto'
        }
      }, movable ? 'TAP' : '')
    );
  }

  // Token chip for an opponent token (read-only).
  function oppChip(i){
    var t = oppToks[i];
    return React.createElement('div', {
      key: 'op-' + i,
      style: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 12,
        background: '#0e1218', border: '1px solid #1c2230',
        userSelect: 'none', opacity: 0.92
      }
    },
      React.createElement('span', {
        style: {
          width: 12, height: 12, borderRadius: '50%',
          background: oppColor, flex: '0 0 auto'
        }
      }),
      React.createElement('span', {
        style: { fontSize: 13, fontWeight: 600, color: '#9fb0c3' }
      }, 'Token ' + (i + 1) + ' · ' + tokenLabel(t))
    );
  }

  // My tokens section.
  var myChips = [];
  for (var a = 0; a < 4; a++) myChips.push(myChip(a));
  var mySection = React.createElement('div', {
    style: { width: '100%', marginBottom: 12 }
  },
    React.createElement('div', {
      style: { fontSize: 12, fontWeight: 700, color: myColor, marginBottom: 6 }
    }, 'You (' + myMark + ')'),
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: 8 }
    }, myChips)
  );

  // Opponent tokens section.
  var oppChips = [];
  for (var b = 0; b < 4; b++) oppChips.push(oppChip(b));
  var oppSection = React.createElement('div', {
    style: { width: '100%', marginBottom: 8 }
  },
    React.createElement('div', {
      style: { fontSize: 12, fontWeight: 700, color: oppColor, marginBottom: 6 }
    }, 'Opponent (' + oppMark + ')'),
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: 8 }
    }, oppChips)
  );

  // Legend + current turn.
  var legend = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 16, marginTop: 10, fontSize: 11, color: '#9fb0c3'
    }
  },
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: myColor } }),
      'You'
    ),
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: oppColor } }),
      'Opp'
    ),
    React.createElement('span', null,
      'Turn: ' + (isOver ? '—' : (turn ? (turn === myMark ? 'You' : 'Opp') : '—'))
    )
  );

  // Buttons.
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

  // Body — hide game internals when backend unavailable.
  var bodyChildren = [];
  if (!err) {
    bodyChildren.push(dieRow);
    if (rollBtn) bodyChildren.push(rollBtn);
    bodyChildren.push(mySection);
    bodyChildren.push(oppSection);
    bodyChildren.push(legend);
  }

  var body = React.createElement('div', {
    style: {
      width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }
  }, bodyChildren);

  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 20, borderRadius: 20,
      background: 'linear-gradient(180deg,#0d1117,#0a0d12)',
      border: '1px solid #1c2230',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      maxWidth: 360, margin: '0 auto',
      maxHeight: '90vh', overflowY: 'auto',
      color: '#e8edf4'
    }
  }, header, subStatus, body, buttons);
}
