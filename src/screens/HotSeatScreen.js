/* eslint-disable */
// ════════════════════════════════════════════════════════════════════
// HotSeatScreen.js — live group audio room ("Hot Seat").
//
// 1 HOST + 1 GUEST SEAT (the hot seat) + N LISTENERS, with a paid door, a
// paid seat (FIFO waitlist → hot seat), in-room GIFTING (reuses send_gift),
// HOST/CO-HOST moderation, and an optional Tic-Tac-Toe mini-game.
//
// Backed by migration 0059_hot_seat_rooms.sql. EVERYTHING here is fully
// guarded: if 0059 hasn't been run yet (RPCs / tables / realtime missing),
// the screen shows a "Hot Seat is warming up" state with a working Leave
// button — it NEVER crashes.
//
// CODING RULES (CLAUDE.md):
//  - NO JSX — React.createElement only.
//  - State: var xS=useState(init); var x=xS[0]; var setX=xS[1];
//  - ALL hooks before any conditional return.
//  - Every realtime channel subscribe has a matching sb.removeChannel cleanup.
//  - The Agora room controller is leave()'d on unmount.
//  - Client NEVER writes coins/neons/profiles directly — only via RPCs.
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sb } from '../utils/supabase';
import { startRoomSession } from '../utils/agora';
import { loadGiftCatalog, giftByKey, giftColor } from '../utils/giftCatalog';
import TicTacToeGame from './TicTacToeGame';

export default function HotSeatScreen(props) {
  props = props || {};
  var roomId = props.roomId;
  var channel = props.channel;
  var isHost = !!props.isHost;
  var hostId = props.hostId;
  var myUserId = props.myUserId;
  var session = props.session;
  var onLeave = props.onLeave;

  // ── live room state (seeded by initial fetch, kept fresh by realtime) ──
  var partsS = useState([]); var participants = partsS[0]; var setParticipants = partsS[1];
  var seatS = useState(null); var seat = seatS[0]; var setSeat = seatS[1];
  var waitS = useState([]); var waitlist = waitS[0]; var setWaitlist = waitS[1];
  var roomRowS = useState(null); var roomRow = roomRowS[0]; var setRoomRow = roomRowS[1];

  // ── profile cache (id → {full_name, avatar_url}) for roster display ──
  var profilesS = useState({}); var profiles = profilesS[0]; var setProfiles = profilesS[1];

  // ── gift drawer ──
  var giftCatS = useState([]); var giftCat = giftCatS[0]; var setGiftCat = giftCatS[1];
  var giftTabS = useState(null); var giftTab = giftTabS[0]; var setGiftTab = giftTabS[1];
  var giftDrawerS = useState(false); var giftDrawerOpen = giftDrawerS[0]; var setGiftDrawerOpen = giftDrawerS[1];
  var giftSendingS = useState(null); var giftSending = giftSendingS[0]; var setGiftSending = giftSendingS[1];
  var giftPopS = useState(null); var giftPop = giftPopS[0]; var setGiftPop = giftPopS[1];

  // ── moderation menu (host/cohost) for a tapped listener ──
  var modTargetS = useState(null); var modTarget = modTargetS[0]; var setModTarget = modTargetS[1];

  // ── Tic-Tac-Toe overlay ──
  var gameS = useState(null); var game = gameS[0]; var setGame = gameS[1]; // { gameId, myMark }
  var gameStartingS = useState(false); var gameStarting = gameStartingS[0]; var setGameStarting = gameStartingS[1];

  // ── request-seat in-flight + transient banner ──
  var seatReqS = useState(false); var seatReqBusy = seatReqS[0]; var setSeatReqBusy = seatReqS[1];
  var bannerS = useState(null); var banner = bannerS[0]; var setBanner = bannerS[1];

  // ── degraded state: 0059 not run / fatal mount error ──
  var warmingS = useState(false); var warming = warmingS[0]; var setWarming = warmingS[1];

  // ── refs ──
  var controllerRef = useRef(null);   // agora room controller
  var myRoleRef = useRef(isHost ? 'host' : 'audience'); // last applied agora role
  var giftTimerRef = useRef(null);
  var bannerTimerRef = useRef(null);
  var mountedRef = useRef(true);

  // ── helper: short transient banner ──
  var flash = useCallback(function(msg){
    try { setBanner(msg); } catch(_){}
    if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); }
    bannerTimerRef.current = setTimeout(function(){
      if (mountedRef.current) setBanner(null);
      bannerTimerRef.current = null;
    }, 2600);
  }, []);

  // ── helper: ensure we have profiles for a set of ids (best-effort) ──
  var ensureProfiles = useCallback(function(ids){
    try {
      if (!ids || !ids.length) return;
      var missing = [];
      var have = profiles || {};
      ids.forEach(function(id){ if (id && !have[id] && missing.indexOf(id) < 0) missing.push(id); });
      if (!missing.length) return;
      sb.from('profiles').select('id,full_name,avatar_url').in('id', missing).then(function(r){
        if (!mountedRef.current) return;
        if (!r || r.error || !Array.isArray(r.data)) return;
        setProfiles(function(prev){
          var next = Object.assign({}, prev);
          r.data.forEach(function(p){ if (p && p.id) next[p.id] = p; });
          return next;
        });
      }).catch(function(){});
    } catch(_){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  function nameFor(id){
    if (!id) return '';
    if (id === myUserId) return 'You';
    var p = (profiles || {})[id];
    return (p && (p.full_name || p.name)) || 'Guest';
  }
  function avatarFor(id){
    var p = (profiles || {})[id];
    return (p && (p.avatar_url || p.avatar)) || null;
  }

  // ════════════════════════════════════════════════════════════════════
  // Agora room session — start on mount, leave on unmount.
  // ════════════════════════════════════════════════════════════════════
  useEffect(function(){
    mountedRef.current = true;
    var alive = true;
    if (!channel || !myUserId) return function(){};
    try {
      startRoomSession({
        channel: channel,
        uidString: myUserId,
        role: isHost ? 'host' : 'audience',
        onRemotePresent: function(){ /* presence only */ },
        onRemoteJoined: function(){ /* audio flowing */ },
        onRemoteLeft: function(){ /* peer gone */ },
        onError: function(){ /* surfaced via realtime/UI; never crash */ },
        onConnectionState: function(){ /* no-op */ },
      }).then(function(ctrl){
        if (!alive) { try { if (ctrl && ctrl.leave) ctrl.leave(); } catch(_){} return; }
        controllerRef.current = ctrl;
        try { myRoleRef.current = (ctrl && ctrl.getRole && ctrl.getRole()) || (isHost ? 'host' : 'audience'); } catch(_){}
      }).catch(function(){ /* agora failed — UI still works, just no audio */ });
    } catch(_){}
    return function(){
      alive = false;
      var c = controllerRef.current;
      controllerRef.current = null;
      try { if (c && c.leave) c.leave(); } catch(_){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, myUserId, isHost]);

  // ════════════════════════════════════════════════════════════════════
  // SEAT ROLE FLIP — when I become / stop being the seat holder, flip my
  // Agora publishing role. The host is always 'host' (never demoted here).
  // ════════════════════════════════════════════════════════════════════
  useEffect(function(){
    if (isHost) return; // host always publishes; never flipped by seat changes
    var ctrl = controllerRef.current;
    if (!ctrl || !ctrl.setRole) return;
    var holder = seat && seat.holder_id;
    var iHoldSeat = !!(holder && holder === myUserId);
    var want = iHoldSeat ? 'host' : 'audience';
    if (myRoleRef.current === want) return;
    try {
      var p = ctrl.setRole(want);
      myRoleRef.current = want;
      if (p && typeof p.catch === 'function') p.catch(function(){});
    } catch(_){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seat && seat.holder_id, isHost, myUserId]);

  // ════════════════════════════════════════════════════════════════════
  // Initial fetch + realtime subscriptions (each with removeChannel cleanup).
  // ════════════════════════════════════════════════════════════════════
  useEffect(function(){
    if (!roomId) return function(){};
    var channels = [];
    var anyTableError = false;

    // ── initial seed fetches ──
    try {
      sb.from('room_participants').select('*').eq('room_id', roomId).is('left_at', null).then(function(r){
        if (!mountedRef.current) return;
        if (r && r.error) { anyTableError = true; setWarming(true); return; }
        var rows = (r && Array.isArray(r.data)) ? r.data : [];
        setParticipants(rows);
        ensureProfiles(rows.map(function(x){ return x.user_id; }));
      }).catch(function(){ if (mountedRef.current) setWarming(true); });
    } catch(_){ setWarming(true); }

    try {
      sb.from('room_seat').select('*').eq('room_id', roomId).maybeSingle().then(function(r){
        if (!mountedRef.current) return;
        if (r && r.error) return;
        if (r && r.data) { setSeat(r.data); if (r.data.holder_id) ensureProfiles([r.data.holder_id]); }
      }).catch(function(){});
    } catch(_){}

    try {
      sb.from('room_waitlist').select('*').eq('room_id', roomId).order('created_at', { ascending: true }).then(function(r){
        if (!mountedRef.current) return;
        if (r && r.error) return;
        var rows = (r && Array.isArray(r.data)) ? r.data : [];
        setWaitlist(rows);
        ensureProfiles(rows.map(function(x){ return x.user_id; }));
      }).catch(function(){});
    } catch(_){}

    try {
      sb.from('rooms').select('*').eq('id', roomId).maybeSingle().then(function(r){
        if (!mountedRef.current) return;
        if (r && r.error) return;
        if (r && r.data) {
          setRoomRow(r.data);
          if (r.data.status === 'ended') { try { onLeave && onLeave(); } catch(_){} }
        }
      }).catch(function(){});
    } catch(_){}

    // ── realtime subscriptions ──
    try {
      var chParts = sb.channel('hotseat-parts-' + roomId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: 'room_id=eq.' + roomId }, function(){
          try {
            sb.from('room_participants').select('*').eq('room_id', roomId).is('left_at', null).then(function(r){
              if (!mountedRef.current || !r || r.error || !Array.isArray(r.data)) return;
              setParticipants(r.data);
              ensureProfiles(r.data.map(function(x){ return x.user_id; }));
            }).catch(function(){});
          } catch(_){}
        })
        .subscribe();
      channels.push(chParts);
    } catch(_){ anyTableError = true; }

    try {
      var chSeat = sb.channel('hotseat-seat-' + roomId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_seat', filter: 'room_id=eq.' + roomId }, function(p){
          var row = (p && p.new && p.new.room_id) ? p.new : null;
          if (!mountedRef.current) return;
          if (row) { setSeat(row); if (row.holder_id) ensureProfiles([row.holder_id]); }
          else {
            try {
              sb.from('room_seat').select('*').eq('room_id', roomId).maybeSingle().then(function(r){
                if (mountedRef.current && r && !r.error && r.data) setSeat(r.data);
              }).catch(function(){});
            } catch(_){}
          }
        })
        .subscribe();
      channels.push(chSeat);
    } catch(_){}

    try {
      var chWait = sb.channel('hotseat-wait-' + roomId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_waitlist', filter: 'room_id=eq.' + roomId }, function(){
          try {
            sb.from('room_waitlist').select('*').eq('room_id', roomId).order('created_at', { ascending: true }).then(function(r){
              if (!mountedRef.current || !r || r.error || !Array.isArray(r.data)) return;
              setWaitlist(r.data);
              ensureProfiles(r.data.map(function(x){ return x.user_id; }));
            }).catch(function(){});
          } catch(_){}
        })
        .subscribe();
      channels.push(chWait);
    } catch(_){}

    try {
      var chRoom = sb.channel('hotseat-room-' + roomId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: 'id=eq.' + roomId }, function(p){
          var row = (p && p.new) ? p.new : null;
          if (!mountedRef.current || !row) return;
          setRoomRow(row);
          if (row.status === 'ended') { try { onLeave && onLeave(); } catch(_){} }
        })
        .subscribe();
      channels.push(chRoom);
    } catch(_){}

    return function(){
      channels.forEach(function(ch){ try { sb.removeChannel(ch); } catch(_){} });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── load the gift catalog once ──
  useEffect(function(){
    try { loadGiftCatalog(sb).then(function(list){ if (mountedRef.current) setGiftCat(list || []); }).catch(function(){}); } catch(_){}
  }, []);

  // ── in-room gift INSERT listener (animate gifts to the seat/host) ──
  useEffect(function(){
    if (!roomId) return function(){};
    var ch = null;
    try {
      ch = sb.channel('hotseat-gifts-' + roomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gift_sends', filter: 'call_id=eq.' + roomId }, function(p){
          var row = p && p.new; if (!row || !mountedRef.current) return;
          var key = row.rolled_gift_key || row.gift_key;
          var g = giftByKey(key) || { icon: '🎁', coins: row.coins_spent, name: 'Gift', gift_key: key };
          firePop({ icon: g.icon || g.emoji || '🎁', coins: g.coins || row.coins_spent, name: g.name || 'Gift', gift_key: g.gift_key || key, color: g.color || null, category: g.category || null }, nameFor(row.sender_id));
        })
        .subscribe();
    } catch(_){}
    return function(){ try { if (ch) sb.removeChannel(ch); } catch(_){} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profiles]);

  // ── final-unmount cleanup of timers ──
  useEffect(function(){
    return function(){
      mountedRef.current = false;
      if (giftTimerRef.current) { clearTimeout(giftTimerRef.current); giftTimerRef.current = null; }
      if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
    };
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // Actions (ALL rpc wrapped in try/catch; degrade, never crash).
  // ════════════════════════════════════════════════════════════════════
  function firePop(g, fromName){
    try {
      setGiftPop({ icon: g.icon, coins: g.coins, name: g.name, gift_key: g.gift_key, color: g.color, category: g.category, fromName: fromName || '', ts: Date.now() });
    } catch(_){ return; }
    if (giftTimerRef.current) clearTimeout(giftTimerRef.current);
    giftTimerRef.current = setTimeout(function(){ if (mountedRef.current) setGiftPop(null); giftTimerRef.current = null; }, 3000);
  }

  // seat holder (preferred gift recipient) → else host
  function giftRecipient(){
    var holder = seat && seat.holder_id;
    if (holder && holder !== myUserId) return holder;
    if (hostId && hostId !== myUserId) return hostId;
    return holder || hostId || null;
  }

  function doRequestSeat(){
    if (seatReqBusy || !roomId) return;
    setSeatReqBusy(true);
    try {
      sb.rpc('request_seat', { p_room: roomId }).then(function(r){
        if (!mountedRef.current) return;
        setSeatReqBusy(false);
        var d = r && r.data;
        if ((r && r.error) || !d) { setWarmingMaybe(r); flash('Could not request the seat'); return; }
        if (d.status === 'ok') { flash(d.seated ? 'You took the hot seat!' : 'You joined the seat queue'); }
        else if (d.status === 'already_queued') { flash('You are already in the queue'); }
        else if (d.status === 'already_seated') { flash('You already hold the seat'); }
        else if (d.status === 'insufficient') { flash('Not enough coins for the seat'); }
        else if (d.status === 'is_host') { flash('You are the host'); }
        else if (d.status === 'not_in_room') { flash('Join the room first'); }
        else { flash('Could not request the seat'); }
      }).catch(function(){ if (mountedRef.current) { setSeatReqBusy(false); flash('Network error'); } });
    } catch(_){ setSeatReqBusy(false); flash('Could not request the seat'); }
  }

  function setWarmingMaybe(r){
    // if an RPC 404s because 0059 isn't deployed, surface the warming state
    try {
      var msg = r && r.error && (r.error.message || r.error.details || '');
      if (msg && /function|does not exist|schema cache|not find/i.test(String(msg))) setWarming(true);
    } catch(_){}
  }

  function doSendGift(g){
    if (!g || giftSending) return;
    var to = giftRecipient();
    if (!to) { flash('No one to gift'); return; }
    setGiftSending(g.gift_key);
    try {
      sb.rpc('send_gift', { p_gift_key: g.gift_key, p_to_user: to, p_call_id: roomId }).then(function(r){
        if (!mountedRef.current) return;
        setGiftSending(null);
        var d = r && r.data;
        if ((r && r.error) || !d || d.status !== 'ok') {
          flash(d && d.status === 'insufficient' ? 'Not enough coins' : 'Gift failed');
          return;
        }
        var dg = (d.gift_key && giftByKey(d.gift_key)) || null;
        firePop({
          icon: d.icon || g.icon, coins: d.coins || g.coins, name: d.name || g.name,
          gift_key: d.gift_key || g.gift_key,
          color: d.color || (dg && dg.color) || g.color || null,
          category: (dg && dg.category) || g.category || null,
        }, 'You');
        if (d.fullscreen || (d.coins || 0) > 99) setGiftDrawerOpen(false);
      }).catch(function(){ if (mountedRef.current) { setGiftSending(null); flash('Network error'); } });
    } catch(_){ setGiftSending(null); flash('Gift failed'); }
  }

  function doLeave(){
    var c = controllerRef.current;
    try { if (c && c.leave) c.leave(); } catch(_){}
    controllerRef.current = null;
    try {
      sb.rpc('leave_room', { p_room: roomId }).then(function(){}).catch(function(){});
    } catch(_){}
    try { onLeave && onLeave(); } catch(_){}
  }

  function doClose(){
    try {
      sb.rpc('close_room', { p_room: roomId }).then(function(r){
        if (!mountedRef.current) return;
        var d = r && r.data;
        // 'ok' or 'already_ended' both mean it's over from our POV.
        var c = controllerRef.current; controllerRef.current = null;
        try { if (c && c.leave) c.leave(); } catch(_){}
        try { onLeave && onLeave(); } catch(_){}
        if (r && r.error) { setWarmingMaybe(r); }
      }).catch(function(){ if (mountedRef.current) doLeave(); });
    } catch(_){ doLeave(); }
  }

  // ── moderation actions ──
  function doMod(action, targetId){
    setModTarget(null);
    if (!targetId) return;
    try {
      var fn = action === 'mute' ? 'mute_participant'
             : action === 'kick' ? 'kick_participant'
             : action === 'cohost' ? 'promote_cohost' : null;
      if (!fn) return;
      sb.rpc(fn, { p_room: roomId, p_target: targetId }).then(function(r){
        if (!mountedRef.current) return;
        var d = r && r.data;
        if ((r && r.error) || !d || d.status !== 'ok') { setWarmingMaybe(r); flash('Action failed'); return; }
        flash(action === 'mute' ? 'Muted' : action === 'kick' ? 'Kicked' : 'Promoted to co-host');
      }).catch(function(){ if (mountedRef.current) flash('Action failed'); });
    } catch(_){ flash('Action failed'); }
  }

  function doUnmute(targetId){
    if (!targetId) return;
    try {
      sb.rpc('unmute_participant', { p_room: roomId, p_target: targetId }).then(function(r){
        if (!mountedRef.current) return;
        var d = r && r.data;
        if ((r && r.error) || !d || d.status !== 'ok') { flash('Action failed'); return; }
        flash('Unmuted');
      }).catch(function(){ if (mountedRef.current) flash('Action failed'); });
    } catch(_){ flash('Action failed'); }
  }

  // ── start tic-tac-toe (host vs current seat holder) ──
  function doStartGame(){
    if (gameStarting) return;
    var opp = seat && seat.holder_id;
    if (!opp) { flash('No one is in the hot seat'); return; }
    setGameStarting(true);
    try {
      sb.rpc('create_game', { p_opponent: opp, p_context_id: roomId, p_context_kind: 'room' }).then(function(r){
        if (!mountedRef.current) return;
        setGameStarting(false);
        var d = r && r.data;
        if ((r && r.error) || !d) { setWarmingMaybe(r); flash('Could not start the game'); return; }
        var gid = d.game_id || d.id || (d.game && d.game.id) || null;
        var myMark = d.my_mark || d.mark || 'X';
        if (!gid) { flash('Could not start the game'); return; }
        setGame({ gameId: gid, myMark: myMark });
      }).catch(function(){ if (mountedRef.current) { setGameStarting(false); flash('Could not start the game'); } });
    } catch(_){ setGameStarting(false); flash('Could not start the game'); }
  }

  // ════════════════════════════════════════════════════════════════════
  // Derived view data (computed every render; no hooks below this point
  // before the first conditional return — all hooks are above).
  // ════════════════════════════════════════════════════════════════════
  var iAmModerator = (function(){
    if (isHost) return true;
    var me = (participants || []).filter(function(p){ return p.user_id === myUserId; })[0];
    return !!(me && (me.role === 'host' || me.role === 'cohost'));
  })();

  var hostPart = (participants || []).filter(function(p){ return p.role === 'host'; })[0] || null;
  var seatHolderId = seat && seat.holder_id;
  var seatPart = seatHolderId ? ((participants || []).filter(function(p){ return p.user_id === seatHolderId; })[0] || null) : null;
  var listeners = (participants || []).filter(function(p){ return p.role === 'listener' || p.role === 'cohost'; });

  var listenerCount = roomRow ? roomRow.listener_count : listeners.length;

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  var C = React.createElement;

  // ── degraded "warming up" view (0059 not deployed) — never crash ──
  if (warming) {
    return C('div', { style: shell() },
      C('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' } },
        C('div', { style: { fontSize: '40px', marginBottom: '14px' } }, '🎙️'),
        C('div', { style: { fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' } }, 'Hot Seat is warming up'),
        C('div', { style: { fontSize: '13px', color: '#9aa', maxWidth: '280px', lineHeight: 1.5, marginBottom: '24px' } }, 'Live rooms aren’t available just yet. Please check back in a little while.'),
        C('button', { onClick: doLeave, style: btn(true) }, 'Leave')
      )
    );
  }

  return C('div', { style: shell() },
    // ── header ──
    C('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } },
      C('div', { style: { flex: 1, minWidth: 0 } },
        C('div', { style: { fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
          (nameFor(hostId) === 'You' ? 'Your' : (nameFor(hostId) + '’s')) + ' Room'),
        C('div', { style: { fontSize: '12px', color: '#9aa', marginTop: '2px' } }, '👂 ' + (Number(listenerCount) || 0) + ' listening')
      ),
      isHost
        ? C('button', { onClick: doClose, style: btn(true, '#E84D9A') }, 'Close')
        : C('button', { onClick: doLeave, style: btn(true) }, 'Leave')
    ),

    // ── transient banner ──
    banner ? C('div', { style: { margin: '10px 16px 0', padding: '9px 12px', background: 'rgba(123,110,255,0.18)', border: '1px solid rgba(123,110,255,0.4)', borderRadius: '10px', color: '#fff', fontSize: '12px', fontWeight: 600, textAlign: 'center' } }, banner) : null,

    // ── scrollable body ──
    C('div', { style: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px' } },

      // stage: HOST + SEAT side by side
      C('div', { style: { display: 'flex', gap: '12px', marginBottom: '18px' } },
        stageCard('HOST', hostId, hostPart, '#7B6EFF'),
        seatHolderId
          ? stageCard('HOT SEAT', seatHolderId, seatPart, '#FFD93D')
          : emptySeatCard()
      ),

      // listeners
      C('div', { style: { marginBottom: '18px' } },
        C('div', { style: sectionLabel() }, 'Listeners · ' + listeners.length),
        listeners.length === 0
          ? C('div', { style: { fontSize: '12px', color: '#788', padding: '8px 2px' } }, 'No listeners yet')
          : C('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px' } },
              listeners.map(function(p){ return listenerChip(p); })
            )
      ),

      // waitlist
      (waitlist && waitlist.length)
        ? C('div', { style: { marginBottom: '18px' } },
            C('div', { style: sectionLabel() }, 'Seat queue · ' + waitlist.length),
            C('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              waitlist.map(function(w, i){
                return C('div', { key: w.id || w.user_id, style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px' } },
                  C('div', { style: { fontSize: '12px', fontWeight: 800, color: '#FFD93D', width: '18px' } }, '#' + (i + 1)),
                  avatarEl(w.user_id, 28),
                  C('div', { style: { fontSize: '13px', color: '#fff', fontWeight: 600 } }, nameFor(w.user_id))
                );
              })
            )
          )
        : null
    ),

    // ── footer action bar ──
    C('div', { style: { display: 'flex', gap: '10px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } },
      C('button', { onClick: doRequestSeat, disabled: seatReqBusy, style: btn(false, '#7B6EFF', seatReqBusy) }, seatReqBusy ? '…' : 'Request Seat'),
      C('button', { onClick: function(){ setGiftDrawerOpen(true); }, style: btn(false, '#E84D9A') }, '🎁 Gift')
      /* Games are NOT in Hot Seat — they belong in 1:1 calls (listeners
       * shouldn't have to watch two people play). Wired into CallScreen. */
    ),

    // ── moderation action sheet ──
    modTarget ? modSheet() : null,

    // ── gift drawer ──
    giftDrawerOpen ? giftDrawer() : null,

    // ── gift pop overlay ──
    giftPop ? giftPopOverlay() : null,

    // ── tic-tac-toe overlay ──
    game ? C('div', { style: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' } },
        (function(){
          try {
            return C(TicTacToeGame, { gameId: game.gameId, myMark: game.myMark, myUserId: myUserId, onClose: function(){ setGame(null); } });
          } catch(_){
            return C('div', { style: { background: '#1a1a22', borderRadius: '14px', padding: '24px', textAlign: 'center' } },
              C('div', { style: { color: '#fff', marginBottom: '14px' } }, 'Game unavailable'),
              C('button', { onClick: function(){ setGame(null); }, style: btn(true) }, 'Close')
            );
          }
        })()
      ) : null
  );

  // ════════════════════════════════════════════════════════════════════
  // Inline render helpers (closures over state — defined after return is
  // fine in JS function hoisting; these are function declarations).
  // ════════════════════════════════════════════════════════════════════
  function shell(){
    return { position: 'fixed', inset: 0, zIndex: 900, background: 'linear-gradient(180deg,#15131f 0%,#0d0c14 100%)', display: 'flex', flexDirection: 'column', color: '#fff' };
  }
  function sectionLabel(){
    return { fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#788', marginBottom: '10px' };
  }
  function btn(solid, color, busy){
    color = color || '#7B6EFF';
    return {
      flex: solid ? '0 0 auto' : 1,
      padding: solid ? '9px 18px' : '12px 10px',
      borderRadius: '12px',
      border: solid ? '1px solid rgba(255,255,255,0.16)' : '1px solid transparent',
      background: solid ? 'rgba(255,255,255,0.06)' : color,
      color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
      cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap'
    };
  }
  function avatarEl(id, size){
    var url = avatarFor(id);
    var nm = nameFor(id);
    if (url) {
      return C('img', { src: url, alt: '', style: { width: size + 'px', height: size + 'px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#2a2838' } });
    }
    return C('div', { style: { width: size + 'px', height: size + 'px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: (size * 0.42) + 'px', fontWeight: 800, color: '#fff' } }, (nm || '?').charAt(0).toUpperCase());
  }
  function stageCard(label, id, part, accent){
    var muted = !!(part && part.muted);
    return C('div', { style: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid ' + accent + '55', borderRadius: '16px', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' } },
      C('div', { style: { fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', color: accent } }, label),
      C('div', { style: { position: 'relative' } },
        avatarEl(id, 64),
        C('div', { style: { position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderRadius: '50%', background: muted ? '#444' : accent, border: '2px solid #15131f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' } }, muted ? '🔇' : '🎙️')
      ),
      C('div', { style: { fontSize: '13px', fontWeight: 700, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' } }, nameFor(id) || '—')
    );
  }
  function emptySeatCard(){
    return C('div', { style: { flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,217,61,0.4)', borderRadius: '16px', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '120px' } },
      C('div', { style: { fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', color: '#FFD93D' } }, 'HOT SEAT'),
      C('div', { style: { width: '64px', height: '64px', borderRadius: '50%', border: '2px dashed rgba(255,217,61,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#FFD93D88' } }, '+'),
      C('div', { style: { fontSize: '12px', color: '#9aa' } }, 'empty')
    );
  }
  function listenerChip(p){
    var canMod = iAmModerator && p.user_id !== myUserId && p.user_id !== hostId;
    return C('div', {
      key: p.user_id,
      onClick: function(){ if (canMod) setModTarget(p); },
      style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '64px', cursor: canMod ? 'pointer' : 'default' }
    },
      C('div', { style: { position: 'relative' } },
        avatarEl(p.user_id, 48),
        p.muted ? C('div', { style: { position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px', borderRadius: '50%', background: '#444', border: '2px solid #15131f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' } }, '🔇') : null,
        p.role === 'cohost' ? C('div', { style: { position: 'absolute', top: '-4px', right: '-4px', fontSize: '12px' } }, '⭐') : null
      ),
      C('div', { style: { fontSize: '11px', color: '#cdd', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '64px' } }, nameFor(p.user_id))
    );
  }
  function modSheet(){
    var t = modTarget;
    return C('div', { onClick: function(){ setModTarget(null); }, style: { position: 'fixed', inset: 0, zIndex: 995, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
      C('div', { onClick: function(e){ e.stopPropagation(); }, style: { width: '100%', maxWidth: '520px', background: '#1a1824', borderRadius: '18px 18px 0 0', padding: '16px', boxSizing: 'border-box' } },
        C('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' } },
          avatarEl(t.user_id, 40),
          C('div', { style: { fontSize: '15px', fontWeight: 800, color: '#fff' } }, nameFor(t.user_id))
        ),
        t.muted
          ? C('button', { onClick: function(){ setModTarget(null); doUnmute(t.user_id); }, style: modBtn() }, '🔊 Unmute')
          : C('button', { onClick: function(){ doMod('mute', t.user_id); }, style: modBtn() }, '🔇 Mute'),
        t.role !== 'cohost' && isHost ? C('button', { onClick: function(){ doMod('cohost', t.user_id); }, style: modBtn() }, '⭐ Make co-host') : null,
        C('button', { onClick: function(){ doMod('kick', t.user_id); }, style: modBtn('#E84D9A') }, '🚫 Kick from room'),
        C('button', { onClick: function(){ setModTarget(null); }, style: { width: '100%', padding: '13px', marginTop: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', color: '#9aa', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } }, 'Cancel')
      )
    );
  }
  function modBtn(danger){
    return { width: '100%', padding: '13px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid ' + (danger ? danger + '66' : 'rgba(255,255,255,0.1)'), borderRadius: '12px', color: danger || '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' };
  }
  function giftDrawer(){
    var to = giftRecipient();
    return C('div', { onClick: function(){ if (!giftSending) setGiftDrawerOpen(false); }, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 990, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
      C('div', { onClick: function(e){ e.stopPropagation(); }, style: { width: '100%', maxWidth: '520px', background: '#1a1824', borderRadius: '18px 18px 0 0', padding: '18px 16px 22px', boxSizing: 'border-box', maxHeight: '80vh', overflowY: 'auto' } },
        C('div', { style: { width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.18)', margin: '0 auto 14px' } }),
        C('div', { style: { fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '14px' } }, 'Send a gift to ' + (nameFor(to) || 'the host')),
        (function(){
          if (!giftCat.length) return C('div', { style: { padding: '34px', textAlign: 'center', color: '#9aa', fontSize: '13px' } }, 'Loading gifts…');
          var cats = []; var seen = {};
          giftCat.forEach(function(g){ if (!seen[g.category]) { seen[g.category] = 1; cats.push(g.category); } });
          var active = giftTab || cats[0] || null;
          var tabGifts = giftCat.filter(function(g){ return g.category === active; });
          return C('div', null,
            C('div', { style: { display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px', WebkitOverflowScrolling: 'touch' } },
              cats.map(function(cat){
                var on = cat === active;
                return C('button', { key: cat, onClick: function(){ setGiftTab(cat); }, style: { flex: '0 0 auto', padding: '7px 13px', borderRadius: '14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (on ? 'transparent' : 'rgba(255,255,255,0.14)'), background: on ? 'linear-gradient(135deg,#7B6EFF,#E84D9A)' : 'rgba(255,255,255,0.05)', color: on ? '#fff' : '#9aa' } }, cat);
              })
            ),
            C('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' } },
              tabGifts.map(function(g){
                var sending = giftSending === g.gift_key;
                return C('button', { key: g.gift_key, onClick: function(){ doSendGift(g); }, disabled: !!giftSending, style: { position: 'relative', padding: '14px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid ' + (g.tier === 'premium' ? 'rgba(255,217,61,0.4)' : 'rgba(255,255,255,0.1)'), borderRadius: '12px', cursor: giftSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', opacity: (giftSending && !sending) ? 0.5 : 1 } },
                  g.tier === 'premium' ? C('div', { style: { position: 'absolute', top: '4px', right: '5px', fontSize: '9px' } }, g.fullscreen ? '🎬' : '👑') : null,
                  C('div', { style: { fontSize: g.fullscreen ? '32px' : (g.tier === 'premium' ? '28px' : '24px'), lineHeight: 1 } }, g.icon),
                  C('div', { style: { fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.15 } }, g.name),
                  C('div', { style: { fontSize: '10px', color: '#FFD93D', fontWeight: 700 } }, sending ? '…' : (g.coins + ' 🪙'))
                );
              })
            )
          );
        })(),
        C('button', { onClick: function(){ if (!giftSending) setGiftDrawerOpen(false); }, style: { width: '100%', padding: '13px', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', color: '#9aa', fontSize: '13px', fontWeight: 600, cursor: giftSending ? 'wait' : 'pointer', marginTop: '8px', fontFamily: 'inherit' } }, 'Close')
      )
    );
  }
  function giftPopOverlay(){
    var col = giftColor(giftPop);
    var big = (giftPop.coins || 0) >= 399;
    return C('div', { style: { position: 'fixed', inset: 0, zIndex: 985, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      C('div', { style: { position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, ' + hexA(col.base, big ? 0.55 : 0.4) + ', transparent 65%)' } }),
      C('div', { style: { position: 'relative', textAlign: 'center' } },
        C('div', { style: { fontSize: big ? '96px' : '72px', lineHeight: 1, filter: 'drop-shadow(0 6px 26px ' + hexA(col.g1, 0.7) + ')' } }, giftPop.icon),
        C('div', { style: { fontSize: '13px', fontWeight: 800, color: '#fff', marginTop: '10px', textShadow: '0 2px 8px rgba(0,0,0,0.8)' } }, (giftPop.fromName || '') + ' sent ' + (giftPop.name || 'gift')),
        C('div', { style: { fontSize: '12px', fontWeight: 700, color: '#FFD93D', marginTop: '4px', textShadow: '0 2px 8px rgba(0,0,0,0.8)' } }, (giftPop.coins || 0) + ' 🪙')
      )
    );
  }
}

// hex + alpha → rgba (matches CallScreen's hexA helper for gift bursts).
function hexA(hex, a){
  try {
    var h = String(hex || '#7B6EFF').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  } catch (e) { return 'rgba(123,110,255,' + a + ')'; }
}
