/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {sb} from '../utils/supabase';
import {playSound,getSCtx,getSoundPrefs,hapticPulse} from '../utils/soundEngine';
import TopBarAvatar from '../components/TopBarAvatar';
import AvatarRing from '../components/AvatarRing';
import {useMomentUserIds} from '../utils/momentUsers';
import compressImage from '../utils/compressImage';
import {isCallLog, parseCallLog, describeCallLog, previewCallLog} from '../utils/callLog';
import {useCoinBalance} from '../utils/coinBalance';
// FIX #7: server-side block list unification — see src/utils/blocks.js.
import {blockUser as serverBlockUser, isBlockedSync, loadBlocks} from '../utils/blocks';

var EXPERT_CONVOS_BASE=[
  {id:'e1',initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',last:'Thank you for your question!',time:'2m ago',unread:2,img:'https://i.pravatar.cc/150?img=47',rate:120},
  {id:'e2',initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',last:'I will send you the resources.',time:'1h ago',unread:0,img:'https://i.pravatar.cc/150?img=12',rate:80},
  {id:'e3',initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',last:'Great progress! Keep it up.',time:'Yesterday',unread:1,img:'https://i.pravatar.cc/150?img=23',rate:60},
];

function timeAgo(dateStr){
  if(!dateStr) return '';
  // Final polish: no manual 'Z' appending. The old code forced UTC
  // interpretation by appending 'Z', which shifted display by the local TZ
  // offset whenever the source string was already local (e.g. a Date
  // .toString() value with no TZ marker). The Date constructor handles
  // ISO strings with or without 'Z' correctly on its own.
  var now = new Date();
  var date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  var diff = Math.floor((now - date)/1000);
  // R11 FIX #2: clock skew (server ahead of client) → show 'Just now' instead of '-Nm ago'.
  if (diff < 0) return 'Just now';
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<172800) return 'Yesterday';
  return date.toLocaleDateString([],{month:'short',day:'numeric'});
}

// ── Audio engine — swoosh routed through central sound engine ──
var _swooshRef={osc:null,gain:null,ctx:null};
function startSwooshMs(isHeart){
  stopSwooshMs();
  var ctx=getSCtx();if(!ctx)return;
  // Read like volume from user prefs so Settings volume slider controls this too
  var prefs=getSoundPrefs();
  var likeP=prefs&&prefs.like;
  var vol=(likeP&&likeP.enabled!==false)?((likeP.volume||0.55)):(0);
  if(vol<=0)return;
  var osc=ctx.createOscillator();
  var gain=ctx.createGain();
  var filter=ctx.createBiquadFilter();
  osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
  filter.type='lowpass';filter.frequency.value=isHeart?2200:1800;filter.Q.value=0.5;
  osc.type='sine';
  osc.frequency.setValueAtTime(isHeart?260:220,ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(isHeart?680:520,ctx.currentTime+2.0);
  // Scale gain by vol (default 0.55 → original 0.038/0.055 targets)
  var scale=vol/0.55;
  gain.gain.setValueAtTime(0.001,ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.038*scale,ctx.currentTime+0.35);
  gain.gain.linearRampToValueAtTime(0.055*scale,ctx.currentTime+2.0);
  osc.start();
  _swooshRef.osc=osc;_swooshRef.gain=gain;_swooshRef.ctx=ctx;
}
function stopSwooshMs(){
  if(_swooshRef.osc){
    try{
      var ctx=_swooshRef.ctx;
      _swooshRef.gain.gain.setValueAtTime(_swooshRef.gain.gain.value||0.03,ctx.currentTime);
      _swooshRef.gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.12);
      _swooshRef.osc.stop(ctx.currentTime+0.13);
    }catch(e){}
    _swooshRef.osc=null;_swooshRef.gain=null;_swooshRef.ctx=null;
  }
}
function playReleaseMs(isHeart){if(isHeart)playSound("like");else playSound("likeThumb");}

function playMsKeyClick(){playSound("typing");}
function playMsEmojiClick(){playSound("emoji");}
function playMsSendSound(){playSound("send");}
// Flat gradient heart — strong signature colors #7B6EFF → #E84D9A
function HeartSvg(props){
  var sz=props.size||60; var id=props.id||'hsvg';
  return React.createElement('svg',{viewBox:'0 0 24 24',width:sz,height:sz,style:{overflow:'visible'}},
    React.createElement('defs',null,
      React.createElement('linearGradient',{id:id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},
        React.createElement('stop',{offset:'0%',stopColor:'#8B7FFF'}),
        React.createElement('stop',{offset:'50%',stopColor:'#D455AA'}),
        React.createElement('stop',{offset:'100%',stopColor:'#F03D8E'})
      )
    ),
    React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:'url(#'+id+')',stroke:'none'})
  );
}

function ChatBox({convo,session,onBack,onViewExpert,onViewUser,onCall,onMessageSent}){
  var myId = session&&session.user ? session.user.id : 'guest';
  // Prefer the user's chosen full_name (from profile cache) over the email prefix.
  // This is the sender_name stamped onto every outgoing message — it's what the
  // other person will see in their inbox preview.
  var _cachedProfileName = null;
  try { if(myId && myId !== 'guest'){ var _pi = localStorage.getItem('profile_info_'+myId); if(_pi){ var _pj = JSON.parse(_pi); if(_pj && _pj.name) _cachedProfileName = _pj.name; } } } catch(e){}
  var _safeEmailPrefix = session&&session.user&&session.user.email ? (session.user.email.split('@')[0] || 'user') : 'user';
  var myName = _cachedProfileName || (session&&session.user ? _safeEmailPrefix : 'You');
  var convId = convo.convId || convo.id;
  var initMsgs = [];
  try{ var cm=localStorage.getItem('msgs_'+convId); if(cm) initMsgs=JSON.parse(cm); }catch(e){}
  var mS=useState(initMsgs); var msgs=mS[0]; var setMsgs=mS[1];
  var tS=useState(''); var txt=tS[0]; var setTxt=tS[1];
  var emojiS=useState(false); var showEmoji=emojiS[0]; var setShowEmoji=emojiS[1];
  var LMAX=28;
  var levYS=useState(0); var levY=levYS[0]; var setLevY=levYS[1];
  var levStartS=useState(null); var levStart=levStartS[0]; var setLevStart=levStartS[1];
  // levActive: null | 'heart' | 'thumbs'  — set the moment lever crosses threshold
  var levActiveS=useState(null); var levActive=levActiveS[0]; var setLevActive=levActiveS[1];
  // levHoldPct: 0→1 over 1.5s while holding past threshold
  var levHoldPctS=useState(0); var levHoldPct=levHoldPctS[0]; var setLevHoldPct=levHoldPctS[1];
  var msgMenuS=useState(null); var msgMenu=msgMenuS[0]; var setMsgMenu=msgMenuS[1];
  var toastS=useState(''); var toast=toastS[0]; var setToast=toastS[1];
  var chatMenuOpenS=useState(false); var chatMenuOpen=chatMenuOpenS[0]; var setChatMenuOpen=chatMenuOpenS[1];

  // Per-conversation read-receipts toggle (reciprocal — like WhatsApp).
  // Stored in localStorage `ringin_rr_off` as a Set of conversation IDs.
  // When OFF for this convo: (a) we don't mark messages as read in the DB,
  // so the other side never sees our ✓✓ blue tick. (b) We also don't
  // display ✓✓ for our own sent messages — keeping the deal reciprocal.
  function loadReadReceiptsOffSet(){
    try{
      var raw=localStorage.getItem('ringin_rr_off');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    }catch(_){ return new Set(); }
  }
  var rrOffSetS=useState(loadReadReceiptsOffSet());
  var rrOffSet=rrOffSetS[0]; var setRrOffSet=rrOffSetS[1];
  var convIdKey = convo ? (convo.convId || convo.id) : null;
  var readReceiptsOffHere = convIdKey ? rrOffSet.has(convIdKey) : false;

  function toggleReadReceipts(){
    if (!convIdKey) return;
    var next = new Set(rrOffSet);
    if (next.has(convIdKey)) next.delete(convIdKey);
    else next.add(convIdKey);
    setRrOffSet(next);
    try{ localStorage.setItem('ringin_rr_off', JSON.stringify(Array.from(next))); }catch(_){}
    setChatMenuOpen(false);
  }

  // T2.1 — Restrict mode (Instagram's anti-harassment 3-tier).
  // The other party can still send DMs / comment, but their actions
  // are isolated until you choose to surface them. Reads/writes to the
  // restricted_users table (migration 0003_restrict.sql).
  var restrictedSetS = useState(new Set());
  var restrictedSet = restrictedSetS[0]; var setRestrictedSet = restrictedSetS[1];
  // R15 FIX #4: mirror restrictedSet into a ref so the chat realtime INSERT
  // handler (deps [convId]) reads the freshest set instead of a stale snapshot.
  var restrictedSetRef = useRef(new Set());
  useEffect(function(){ restrictedSetRef.current = restrictedSet; }, [restrictedSet]);
  useEffect(function(){
    if (!myId) return;
    try {
      sb.from('restricted_users').select('restricted_id').eq('restrictor_id', myId).then(function(r){
        if (r && !r.error && r.data) setRestrictedSet(new Set(r.data.map(function(row){ return row.restricted_id; })));
      });
    } catch(_) {}
  }, [myId]);
  var otherIdForRestrict = (convo && (convo.otherId || convo.receiverId || convo.user_id)) || null;
  var isRestrictedHere = otherIdForRestrict ? restrictedSet.has(otherIdForRestrict) : false;
  function toggleRestrict(){
    if (!myId || !otherIdForRestrict) return;
    setChatMenuOpen(false);
    if (isRestrictedHere) {
      // Optimistic remove.
      var nset = new Set(restrictedSet); nset.delete(otherIdForRestrict); setRestrictedSet(nset);
      sb.from('restricted_users').delete().eq('restrictor_id', myId).eq('restricted_id', otherIdForRestrict).then(function(r){
        if (r && r.error) {
          var rb = new Set(restrictedSet); rb.add(otherIdForRestrict); setRestrictedSet(rb);
          alert('Failed to unrestrict: ' + r.error.message);
        } else {
          // FIX #5: notify MessagesScreen so its inboxRestrictedSet refetches.
          try { window.dispatchEvent(new CustomEvent('ringin:restricted-changed')); } catch(_) {}
        }
      });
    } else {
      var nset2 = new Set(restrictedSet); nset2.add(otherIdForRestrict); setRestrictedSet(nset2);
      sb.from('restricted_users').upsert([{ restrictor_id: myId, restricted_id: otherIdForRestrict }], { onConflict: 'restrictor_id,restricted_id' }).then(function(r){
        if (r && r.error) {
          var rb2 = new Set(restrictedSet); rb2.delete(otherIdForRestrict); setRestrictedSet(rb2);
          alert('Failed to restrict: ' + r.error.message);
        } else {
          // FIX #5: notify MessagesScreen so its inboxRestrictedSet refetches.
          try { window.dispatchEvent(new CustomEvent('ringin:restricted-changed')); } catch(_) {}
          setToast('Restricted. They won\'t know.');
          setTimeout(function(){ setToast(''); }, 2200);
        }
      });
    }
  }
  var mutedConvosS=useState(function(){try{var s=localStorage.getItem('ringin_muted_convos');return s?JSON.parse(s):[];}catch(e){return [];}}); var mutedConvos=mutedConvosS[0]; var setMutedConvos=mutedConvosS[1];
  var pressTimerRef=useRef(null);

  // ── 6-emoji message reactions (T2.2, requires migration 0004_reactions.sql) ──
  // Map: message_id (string|number) → { emoji: [user_id1, user_id2, ...] }
  // Lets us render "❤️ 3" badges + know if the current user already reacted.
  var REACTION_EMOJIS = ['❤️','😂','😮','😢','🙏','👍'];
  var reactionsByMsgS = useState({});
  var reactionsByMsg = reactionsByMsgS[0]; var setReactionsByMsg = reactionsByMsgS[1];
  // Reaction picker floating bar — shows above a long-pressed message.
  var reactionPickerS = useState(null);  // {msgId, x, y} or null
  var reactionPicker = reactionPickerS[0]; var setReactionPicker = reactionPickerS[1];

  function openReactionPicker(msg, ev) {
    try {
      var target = ev && ev.currentTarget;
      var rect = target ? target.getBoundingClientRect() : { left: 60, top: 200, width: 0, height: 0 };
      setReactionPicker({
        msgId: msg.id,
        isMine: msg.sender_id === myId,
        x: rect.left, y: rect.top,
      });
    } catch (_) {
      setReactionPicker({ msgId: msg.id, isMine: msg.sender_id === myId, x: 60, y: 200 });
    }
  }

  function toggleReaction(msgId, emoji) {
    var curMap = reactionsByMsg[msgId] || {};
    var alreadyReacted = (curMap[emoji] || []).indexOf(myId) >= 0;
    // Optimistic update.
    setReactionsByMsg(function(prev){
      var next = Object.assign({}, prev);
      var msgMap = Object.assign({}, prev[msgId] || {});
      if (alreadyReacted) {
        msgMap[emoji] = (msgMap[emoji] || []).filter(function(u){ return u !== myId; });
        if (msgMap[emoji].length === 0) delete msgMap[emoji];
      } else {
        msgMap[emoji] = (msgMap[emoji] || []).concat([myId]);
      }
      next[msgId] = msgMap;
      return next;
    });
    setReactionPicker(null);
    // Persist — try/catch in case the migration isn't applied.
    // FIX R10-8: snapshot for rollback symmetric to the INSERT branch below.
    var rxnSnap = reactionsByMsg;
    try {
      if (alreadyReacted) {
        sb.from('message_reactions').delete()
          .eq('message_id', msgId).eq('user_id', myId).eq('emoji', emoji)
          .then(function(r){
            if (r && r.error) {
              // Rollback optimistic remove on failure — restore previous state.
              setReactionsByMsg(rxnSnap);
              try { console.warn('[ringin] reaction delete failed:', r.error.message); } catch(_){}
            }
          })
          .catch(function(e){
            setReactionsByMsg(rxnSnap);
            try { console.warn('[ringin] reaction delete reject:', e); } catch(_){}
          });
      } else {
        sb.from('message_reactions').insert([{ message_id: msgId, user_id: myId, emoji: emoji }])
          .then(function(r){
            if (r && r.error) {
              // Rollback optimistic add on failure (likely migration not applied yet).
              setReactionsByMsg(function(prev){
                var next = Object.assign({}, prev);
                var mm = Object.assign({}, prev[msgId] || {});
                if (mm[emoji]) mm[emoji] = mm[emoji].filter(function(u){ return u !== myId; });
                if (mm[emoji] && mm[emoji].length === 0) delete mm[emoji];
                next[msgId] = mm;
                return next;
              });
              try { console.warn('[ringin] reaction insert failed:', r.error.message); } catch(_){}
            }
          })
          .catch(function(e){
            // R11 FIX #8: Round 10 added .catch to the DELETE branch — the
            // INSERT counterpart was missed. Symmetric rollback so a rejected
            // promise (offline / network drop) doesn't leave a stuck emoji.
            setReactionsByMsg(rxnSnap);
            try { console.warn('[ringin] reaction insert reject:', e); } catch(_){}
          });
      }
    } catch (_) {}
  }

  // Clear reactions immediately on chat switch — otherwise the new chat
  // briefly shows the previous chat's reactions until the fetch lands.
  useEffect(function(){
    setReactionsByMsg({});
  }, [convId]);

  // Load reactions for all currently-loaded messages whenever the message
  // list changes or the active chat changes. Cheap query, single round-trip.
  useEffect(function(){
    if (!msgs || msgs.length === 0) return;
    var ids = msgs.map(function(m){ return m.id; }).filter(function(x){ return x != null && (typeof x === 'number' || (typeof x === 'string' && x.indexOf('tmp_') !== 0)); });
    if (ids.length === 0) return;
    try {
      sb.from('message_reactions').select('message_id,user_id,emoji').in('message_id', ids).then(function(r){
        if (r.error || !r.data) return;  // table may not exist yet — silent fallback
        var grouped = {};
        r.data.forEach(function(row){
          if (!grouped[row.message_id]) grouped[row.message_id] = {};
          if (!grouped[row.message_id][row.emoji]) grouped[row.message_id][row.emoji] = [];
          grouped[row.message_id][row.emoji].push(row.user_id);
        });
        setReactionsByMsg(grouped);
      });
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length, convId]);
  var fileInputRef=useRef(null);
  var chatTypingTimerRef=useRef(null);

  // ── Typing-indicator state (Supabase Realtime broadcast) ────────────
  // We piggyback on the existing chat channel (subscribed at line ~234).
  // - When I type, broadcast {typing:true} every ~3s (debounced).
  // - 3s after I stop typing, broadcast {typing:false}.
  // - When I receive a broadcast from the other side: set otherTyping=true
  //   for 5s, auto-clearing on timeout.
  var otherTypingS=useState(false); var otherTyping=otherTypingS[0]; var setOtherTyping=otherTypingS[1];
  var typingChannelRef=useRef(null);    // populated in the same useEffect that subscribes for messages
  var typingClearTimerRef=useRef(null); // clears otherTyping after silence
  var typingSendTimerRef=useRef(null);  // debounces my outgoing typing-stop broadcast
  var lastTypingSentAtRef=useRef(0);    // throttle typing-start broadcasts to once per 2.5s

  function broadcastTyping(isTyping){
    var ch = typingChannelRef.current;
    if (!ch) return;
    try {
      ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing: !!isTyping } });
    } catch(_) {}
  }

  function onTypingKeystroke(){
    var now = Date.now();
    if (now - lastTypingSentAtRef.current > 2500) {
      lastTypingSentAtRef.current = now;
      broadcastTyping(true);
    }
    // Reset the "stop typing" timer.
    if (typingSendTimerRef.current) clearTimeout(typingSendTimerRef.current);
    typingSendTimerRef.current = setTimeout(function(){
      broadcastTyping(false);
      lastTypingSentAtRef.current = 0;
    }, 3000);
  }
  var levHoldIntervalRef=useRef(null);
  var levHapticIntervalRef=useRef(null); // separate haptic ticker
  var levHoldStartRef=useRef(null);
  var levHoldPctRef=useRef(0); // always-current pct for use in event handlers
  var lastHapticRef=useRef(0);
  var lastHapticTierRef=useRef(0);

  // ── CRITICAL: clear all intervals/timers when ChatBox unmounts ──
  // If user starts holding the send-lever then tab-switches or navigates, these
  // intervals would fire forever — calling navigator.vibrate() every 100ms and
  // setLevHoldPct on a torn-down component. Samsung Internet specifically
  // throttles/queues vibrate calls and freezes the UI thread under accumulation.
  // Same pattern protects the long-press timer + the chat typing debouncer.
  useEffect(function(){
    return function(){
      try { if(levHoldIntervalRef.current) { clearInterval(levHoldIntervalRef.current); levHoldIntervalRef.current = null; } } catch(e){}
      try { if(levHapticIntervalRef.current) { clearInterval(levHapticIntervalRef.current); levHapticIntervalRef.current = null; } } catch(e){}
      try { if(pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; } } catch(e){}
      try { if(chatTypingTimerRef.current) { clearTimeout(chatTypingTimerRef.current); chatTypingTimerRef.current = null; } } catch(e){}
    };
  }, []);

  var bottomRef=useRef(null);
  var headerRef=useRef(null);
  var chatBoxRef=useRef(null);
  // FIX #1: msgsRef mirrors msgs so the reactions realtime handler can
  // read the current message id list without resubscribing on every msg change.
  var msgsRef=useRef(msgs);
  useEffect(function(){ msgsRef.current = msgs; },[msgs]);
  // FIX #12: track whether the user has scrolled up to read history. We use
  // this to suppress the auto-scroll-to-bottom behaviour when new messages
  // arrive (no more yanking the user down). Set true when not at bottom.
  var userScrolledUpS=useState(false); var userScrolledUp=userScrolledUpS[0]; var setUserScrolledUp=userScrolledUpS[1];
  var msgsScrollRef=useRef(null);

  // Keep the ChatBox header pinned to the visual viewport top, even when the mobile
  // keyboard opens. position:fixed alone isn't enough on iOS Safari — its visual
  // viewport offset shifts when the keyboard appears. We track that and apply a
  // matching translateY so the header always rides at the visible top.
  useEffect(function(){
    if(typeof window === 'undefined') return;
    var vv = window.visualViewport;
    if(!vv) return; // older browsers — position:fixed alone will handle most cases
    function syncHeader(){
      if(!headerRef.current) return;
      // offsetTop is positive when the keyboard pushes the visual viewport down (iOS Safari)
      var y = Math.max(0, vv.offsetTop);
      headerRef.current.style.transform = 'translateY(' + y + 'px)';
    }
    syncHeader();
    vv.addEventListener('resize', syncHeader);
    vv.addEventListener('scroll', syncHeader);
    return function(){
      vv.removeEventListener('resize', syncHeader);
      vv.removeEventListener('scroll', syncHeader);
      if(headerRef.current) headerRef.current.style.transform='';
    };
  },[]);

  // Fresh-avatar state for the OTHER person in this chat — kept in local state so we can
  // refresh from DB and fall back to localStorage when convo.img is null.
  var _initialOtherAvatar = convo && convo.img ? convo.img : (function(){
    try { return convo && convo.receiverId ? localStorage.getItem('avatar_'+convo.receiverId) : null; } catch(e){ return null; }
  })();
  var _initialOtherName = (convo && convo.name) || 'User';
  var otherAvatarS = useState(_initialOtherAvatar); var otherAvatar = otherAvatarS[0]; var setOtherAvatar = otherAvatarS[1];
  var otherNameS = useState(_initialOtherName); var otherName = otherNameS[0]; var setOtherName = otherNameS[1];
  // "Last seen" + live online state — surfaced in the chat header subtitle
  // when convo.isOnline is false (matches WhatsApp / Instagram pattern).
  var otherLastSeenS = useState(null); var otherLastSeen = otherLastSeenS[0]; var setOtherLastSeen = otherLastSeenS[1];
  var otherOnlineS = useState(!!(convo && convo.isOnline)); var otherOnline = otherOnlineS[0]; var setOtherOnline = otherOnlineS[1];

  // Fetch fresh profile for the other user — covers cases where convo was passed in
  // stale (e.g., entering chat from a notification or a UserProfileView message button).
  useEffect(function(){
    var otherId = convo && (convo.receiverId || convo.other_user_id || convo.id);
    if (!otherId || (typeof otherId === 'string' && otherId.indexOf('_') >= 0)) return; // not a UUID
    // FIX #11: clear stale last_seen / online state from the PREVIOUS chat
    // before we fetch the new one. Otherwise the header subtitle briefly
    // shows "last seen 2h ago" from the wrong person.
    setOtherLastSeen(null);
    setOtherOnline(false);
    // Try with last_seen first; fall back if the column doesn't exist yet.
    sb.from('profiles').select('id,full_name,email,avatar_url,is_online,last_seen').eq('id', otherId).single().then(function(r){
      var row = r && r.data ? r.data : null;
      if (!row && r && r.error && /last_seen/i.test(r.error.message||'')) {
        // Column missing — retry without it.
        sb.from('profiles').select('id,full_name,email,avatar_url,is_online').eq('id', otherId).single().then(function(r2){
          if (r2 && r2.data) applyProfile(r2.data, false);
        });
        return;
      }
      if (row) applyProfile(row, true);
      function applyProfile(d, withLastSeen){
        if (d.avatar_url) {
          setOtherAvatar(d.avatar_url);
          try { localStorage.setItem('avatar_'+otherId, d.avatar_url); } catch(e){}
        }
        var fresh = (d.full_name && d.full_name.trim()) ||
                    (d.email && d.email.indexOf('@')>=0 ? d.email.split('@')[0] : d.email) ||
                    null;
        if (fresh) setOtherName(fresh);
        setOtherOnline(!!d.is_online);
        if (withLastSeen && d.last_seen) setOtherLastSeen(d.last_seen);
      }
    });
  }, [convo && convo.receiverId, convo && convo.id]);

  // Format "last seen" timestamp for the header subtitle.
  function formatLastSeen(iso){
    if (!iso) return null;
    var t = new Date(iso).getTime();
    if (isNaN(t)) return null;
    var diff = Date.now() - t;
    if (diff < 60*1000) return 'last seen just now';
    if (diff < 60*60*1000) return 'last seen '+Math.floor(diff/60000)+'m ago';
    if (diff < 24*60*60*1000) return 'last seen '+Math.floor(diff/3600000)+'h ago';
    if (diff < 7*24*60*60*1000) return 'last seen '+Math.floor(diff/86400000)+'d ago';
    var d = new Date(iso);
    return 'last seen ' + d.toLocaleDateString([], {month:'short', day:'numeric'});
  }

  useEffect(function(){
    // Load messages
    sb.from('messages').select('*').eq('conversation_id',convId).order('created_at').then(function(r){
      if(r.data) setMsgs(r.data);
      // Mark as read
      // Skip the read-marking write if the user has disabled read receipts
      // for this conversation — keeps the deal reciprocal (we don't tell
      // them we read them, so we don't see their ✓✓ blue tick either).
      // FIX #2: filter by .eq('read', false) so we don't rewrite every old
      // message on every chat open. Reduces DB write amplification.
      if (!readReceiptsOffHere) {
        sb.from('messages').update({read:true}).eq('conversation_id',convId).neq('sender_id',myId).eq('read',false).then(function(){});
      }
    });
    // Realtime subscription — chat messages + typing broadcasts on the
    // same channel so we only pay for one ws connection per conversation.
    var ch=sb.channel('chat-'+convId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+convId},function(p){
        setMsgs(function(prev){
          if(prev.find(function(m){return m.id===p.new.id;})) return prev;
          return prev.concat([p.new]);
        });
        // Mark received messages as read + play notification sound.
        // RESTRICT enforcement: when the sender is in restrictedSet,
        // suppress notification sound (Instagram-style silent delivery).
        if(p.new.sender_id!==myId){
          if (!readReceiptsOffHere) {
            sb.from('messages').update({read:true}).eq('id',p.new.id).then(function(){});
          }
          var mc=[]; try{var ms=localStorage.getItem('ringin_muted_convos');if(ms)mc=JSON.parse(ms);}catch(e){}
          // R15 FIX #4: read from ref (fresh) instead of closure (stale, captured at convId change).
          var _rs = restrictedSetRef.current;
          var senderRestricted = _rs && _rs.has && _rs.has(p.new.sender_id);
          if(!senderRestricted && !mc.includes(p.new.conversation_id) && !isCallLog(p.new.text)) playSound('notification');
        }
      })
      // FIX #1: UPDATE event — handles remote read-receipts (✓→✓✓) and edits.
      // Replace the message in msgs array by id without re-sorting.
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:'conversation_id=eq.'+convId},function(p){
        if (!p || !p.new || p.new.id == null) return;
        setMsgs(function(prev){
          return prev.map(function(m){ return m.id === p.new.id ? Object.assign({}, m, p.new) : m; });
        });
      })
      // FIX #1: DELETE event — handles remote unsends. Filter the message
      // out by id (note: p.old contains the deleted row's primary key only
      // by default on Supabase, which is sufficient here).
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages',filter:'conversation_id=eq.'+convId},function(p){
        var deletedId = p && p.old && p.old.id;
        if (deletedId == null) return;
        setMsgs(function(prev){ return prev.filter(function(m){ return m.id !== deletedId; }); });
      })
      // FIX #1: reactions changes — any INSERT/UPDATE/DELETE on
      // message_reactions triggers a refetch of reactions for the
      // currently-loaded messages. Cheap query, single round-trip.
      .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},function(p){
        try {
          var currMsgIds = (msgsRef.current || []).map(function(m){ return m.id; })
            .filter(function(x){ return x != null && (typeof x === 'number' || (typeof x === 'string' && x.indexOf('tmp_') !== 0)); });
          if (currMsgIds.length === 0) return;
          // Only refetch when the affected message is actually loaded here.
          var affectedId = (p && (p.new && p.new.message_id)) || (p && (p.old && p.old.message_id));
          if (affectedId != null && currMsgIds.indexOf(affectedId) < 0) return;
          sb.from('message_reactions').select('message_id,user_id,emoji').in('message_id', currMsgIds).then(function(r){
            if (r.error || !r.data) return;
            var grouped = {};
            r.data.forEach(function(row){
              if (!grouped[row.message_id]) grouped[row.message_id] = {};
              if (!grouped[row.message_id][row.emoji]) grouped[row.message_id][row.emoji] = [];
              grouped[row.message_id][row.emoji].push(row.user_id);
            });
            setReactionsByMsg(grouped);
          });
        } catch(_) {}
      })
      .on('broadcast', { event: 'typing' }, function(msg){
        // Ignore my own echoes (Supabase broadcasts include the sender by default).
        var pl = msg && msg.payload;
        if (!pl || !pl.user_id || pl.user_id === myId) return;
        // RESTRICT enforcement: hide typing indicator from restricted users.
        // R15 FIX #4: read via ref (channel useEffect deps are [convId]).
        var _rs2 = restrictedSetRef.current;
        if (_rs2 && _rs2.has && _rs2.has(pl.user_id)) return;
        if (pl.typing) {
          setOtherTyping(true);
          if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
          // Auto-clear 5s after the last typing=true ping in case the
          // typing=false broadcast gets dropped.
          typingClearTimerRef.current = setTimeout(function(){ setOtherTyping(false); }, 5000);
        } else {
          setOtherTyping(false);
          if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
        }
      })
      .subscribe();
    typingChannelRef.current = ch;
    return function(){
      // Best-effort "I stopped typing" before leaving so the other side
      // doesn't see lingering bouncing dots.
      try { broadcastTyping(false); } catch(_) {}
      if (typingClearTimerRef.current) { clearTimeout(typingClearTimerRef.current); typingClearTimerRef.current = null; }
      if (typingSendTimerRef.current) { clearTimeout(typingSendTimerRef.current); typingSendTimerRef.current = null; }
      typingChannelRef.current = null;
      sb.removeChannel(ch);
    };
  },[convId]);

  // FIX #12: only auto-scroll-to-bottom when the user is already AT the
  // bottom of the chat, or when the newest message is from them (sending
  // your own message always scrolls down). Otherwise reading older history
  // gets yanked away.
  useEffect(function(){
    if(!bottomRef.current) return;
    var lastMsg = msgs && msgs.length ? msgs[msgs.length-1] : null;
    var myOwn = lastMsg && lastMsg.sender_id === myId;
    if (!userScrolledUp || myOwn) {
      try { bottomRef.current.scrollIntoView({behavior:'smooth'}); } catch(_){}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[msgs]);

  function getCY(e){
    if(e.touches&&e.touches.length)return e.touches[0].clientY;
    if(e.changedTouches&&e.changedTouches.length)return e.changedTouches[0].clientY;
    return e.clientY;
  }

  function activateLever(type){
    if(levActive===type) return;
    setLevActive(type);
    setLevHoldPct(0);
    levHoldStartRef.current=Date.now();
    lastHapticRef.current=0;
    lastHapticTierRef.current=0;
    clearInterval(levHoldIntervalRef.current);
    clearInterval(levHapticIntervalRef.current);
    startSwooshMs(type==='heart');

    // ── Immediate activation buzz — called directly from touch event stack
    // so it always fires even on strict Chrome user-activation builds
    hapticPulse([80]);

    // ── Animation loop (16ms) — graphics + pct only, no haptics here
    levHoldPctRef.current=0;
    levHoldIntervalRef.current=setInterval(function(){
      var elapsed=(Date.now()-levHoldStartRef.current)/1500;
      var pct=Math.min(elapsed,1);
      setLevHoldPct(pct);
      levHoldPctRef.current=pct;
      if(elapsed>=1)clearInterval(levHoldIntervalRef.current);
    },16);

    // ── Haptic loop (100ms tick) — completely separate from animation
    // Each interval is longer than the vibration pattern so buzzes fully complete
    // Tier durations (on, off, on …):
    //   tier 1  30-50%  [70]ms             every 500ms
    //   tier 2  50-70%  [80,45,80]ms       every 450ms  (205ms pat)
    //   tier 3  70-90%  [100,50,100]ms     every 400ms  (250ms pat)
    //   tier 4  90-99%  [120,55,120,55,120]ms  every 600ms  (470ms pat)
    //   tier 5  100%    [150,65,150,65,150]ms  every 700ms  (580ms pat)
    levHapticIntervalRef.current=setInterval(function(){
      var elapsed=(Date.now()-levHoldStartRef.current)/1500;
      var pct=Math.min(elapsed,1);
      var now=Date.now();
      var tier,gap,pattern;
      if(pct>=1)       {tier=5;gap=700; pattern=[150,65,150,65,150];}
      else if(pct>=0.9){tier=4;gap=600; pattern=[120,55,120,55,120];}
      else if(pct>=0.7){tier=3;gap=400; pattern=[100,50,100];}
      else if(pct>=0.5){tier=2;gap=450; pattern=[80,45,80];}
      else if(pct>=0.3){tier=1;gap=500; pattern=[70];}
      else             {tier=0;gap=9999;pattern=null;}
      if(pattern&&(now-lastHapticRef.current)>=gap){
        hapticPulse(pattern);
        lastHapticRef.current=now;
        lastHapticTierRef.current=tier;
      }
    },100);
  }

  function deactivateLever(){
    clearInterval(levHoldIntervalRef.current);
    clearInterval(levHapticIntervalRef.current);
    try{if(navigator.vibrate)navigator.vibrate(0);}catch(e){} // cancel any ongoing buzz
    stopSwooshMs();
    setLevActive(null);
    setLevHoldPct(0);
  }

  function sendReactionEmoji(emoji){
    var receiverId=convo.receiverId||(convId.replace(myId,'').replace('_',''));
    var tempId='tmp_'+Date.now();
    var m={conversation_id:convId,sender_id:myId,sender_name:myName,receiver_id:receiverId,text:emoji,read:false};
    var optimisticMsg=Object.assign({},m,{id:tempId,created_at:new Date().toISOString()});
    setMsgs(function(prev){return prev.concat([optimisticMsg]);});
    sb.from('messages').insert([m]).select().then(function(r){
      if(r.error){
        console.error('RingIn Error [sendReactionEmoji]:', r.error&&r.error.message?r.error.message:'Unknown error');
        setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
        return;
      }
      if(r.data&&r.data[0]){
        setMsgs(function(prev){
          var hasReal=prev.find(function(msg){return msg.id===r.data[0].id;});
          if(hasReal) return prev.filter(function(msg){return msg.id!==tempId;});
          return prev.map(function(msg){return msg.id===tempId?r.data[0]:msg;});
        });
      }
      if(onMessageSent)onMessageSent(convo,emoji);
    });
  }

  function leverRelease(){
    // Release thump — use ref so pct is never stale in this closure
    var relPct=levHoldPctRef.current;
    if(relPct>=0.9)     hapticPulse([130,60,130]);  // full send — strong double
    else if(relPct>=0.5)hapticPulse([90,45,90]);    // partial — medium double
    else if(relPct>=0.3)hapticPulse([70]);           // light tap
    var active=levActive;
    deactivateLever();
    setLevY(0);
    setLevStart(null);
    if(active){
      sendReactionEmoji(active==='heart'?'❤️':'👍');
      playReleaseMs(active==='heart');
    }
  }

  function blockUser(){
    setChatMenuOpen(false);
    var otherId = convo.receiverId || convo.other_user_id || convo.id;
    var otherName = convo.name || 'this person';
    if(!window.confirm('Block '+otherName+'? They will not be able to message you.')) return;
    // FIX R10-6: previous code wrote to localStorage + fired onBack BEFORE
    // checking the DB write — so a failed server write left a UI that
    // claimed "blocked" while the other user could still message us. Now
    // wait for the server write to succeed before persisting locally and
    // closing the chat. Preserves Round 2 fix (also calls serverBlockUser
    // from blocks.js — both legacy + new paths run on success).
    sb.from('blocked_users').upsert({blocker_id: myId, blocked_id: otherId}).then(function(r){
      if(r && r.error){
        console.error('[ringin] blockUser failed:', r.error);
        setToast('Failed to block — try again');
        setTimeout(function(){setToast('');}, 2500);
        return;
      }
      // Persist to legacy localStorage path
      var blocked = [];
      try{ var bs=localStorage.getItem('ringin_blocked'); if(bs) blocked=JSON.parse(bs); }catch(e){}
      if(!blocked.includes(otherId)){
        blocked.push(otherId);
        try{ localStorage.setItem('ringin_blocked', JSON.stringify(blocked)); }catch(e){}
      }
      // FIX #7 (preserved): server-backed blocks table via blocks.js.
      try { serverBlockUser(myId, otherId).catch(function(){}); } catch(_) {}
      if(onBack) onBack();
    }).catch(function(e){
      console.warn('[ringin] blockUser reject:', e);
      setToast('Failed to block — network error');
      setTimeout(function(){setToast('');}, 2500);
    });
  }

  function toggleMuteConvo(){
    setChatMenuOpen(false);
    var convId2 = convo.convId || convo.id;
    setMutedConvos(function(prev){
      var next = prev.includes(convId2) ? prev.filter(function(x){return x!==convId2;}) : prev.concat([convId2]);
      try{ localStorage.setItem('ringin_muted_convos', JSON.stringify(next)); }catch(e){}
      // FIX #6: same-tab 'storage' event doesn't fire — dispatch a custom
      // event so MessagesScreen's inbox-mute listener can re-read.
      try{ window.dispatchEvent(new CustomEvent('ringin:muted-convos-changed')); }catch(_){}
      return next;
    });
  }

  function clearAllChat(){
    setChatMenuOpen(false);
    if(!window.confirm('Clear all messages in this conversation? This cannot be undone.')) return;
    var convId2 = convo.convId || convo.id;
    var snap = msgs.slice();
    setMsgs([]);
    sb.from('messages').delete().eq('conversation_id', convId2).then(function(r){
      if(r.error){
        console.error('RingIn Error [clearAllChat]:', r.error&&r.error.message?r.error.message:'Unknown error');
        setMsgs(snap);
        setToast('Failed to clear chat');
        setTimeout(function(){setToast('');}, 2000);
      } else {
        setToast('Chat cleared');
        setTimeout(function(){setToast('');}, 2000);
      }
    });
  }

  function send(){
    if(!txt.trim()) return;
    // Check if other user is blocked.
    // BUG (pre-fix): used convo.id as a fallback for otherId. But convo.id
    // here is the conversation_id (`uuid1_uuid2`), NOT a single UUID — it
    // would never match anything in the blocked list, so the guard was a
    // no-op for older convo objects loaded from the cache.
    // FIX: derive otherId from convo.other_user_id OR convo.otherId OR
    // convo.receiverId OR by splitting convId and removing myId.
    var blockedList=[];
    try{var bs=localStorage.getItem('ringin_blocked');if(bs)blockedList=JSON.parse(bs);}catch(e){}
    var otherId = convo.other_user_id || convo.otherId || convo.receiverId || null;
    if (!otherId && convId && typeof convId === 'string' && myId) {
      var parts = convId.split('_').filter(function(s){ return s && s !== myId; });
      if (parts.length) otherId = parts[0];
    }
    if(otherId && blockedList.includes(String(otherId))){
      setToast('You have blocked this user');
      setTimeout(function(){setToast('');},2500);
      return;
    }
    // FIX #7: also consult the server-side blocks cache (blocks.js). Either
    // path saying "blocked" is enough — keeps legacy + new in lockstep.
    if(otherId && isBlockedSync(otherId)){
      setToast('You have blocked this user');
      setTimeout(function(){setToast('');},2500);
      return;
    }
    playMsSendSound();
    var receiverId = convo.receiverId || (convId.replace(myId,'').replace('_',''));
    var sentText = txt.trim();
    var tempId = 'tmp_'+Date.now();
    var m={
      conversation_id:convId,
      sender_id:myId,
      sender_name:myName,
      receiver_id:receiverId,
      text:sentText,
      read:false
    };
    setTxt('');
    // Optimistic insert — realtime will dedup via id check
    var optimisticMsg = Object.assign({},m,{id:tempId,created_at:new Date().toISOString()});
    setMsgs(function(prev){return prev.concat([optimisticMsg]);});
    sb.from('messages').insert([m]).select().then(function(r){
      if(r.error){
        console.error('RingIn Error [send message]:', r.error&&r.error.message?r.error.message:'Unknown error');
        // Remove optimistic message on failure
        setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
        // FIX R10-7 (part 1): surface error to the user instead of silently
        // disappearing their message — same UX as the .catch reject branch.
        setToast('Message failed — try again');
        setTimeout(function(){setToast('');}, 2500);
        return;
      }
      // Replace temp with real message from server
      if(r.data&&r.data[0]){
        setMsgs(function(prev){
          // If realtime already added it, just remove the temp
          var hasReal = prev.find(function(msg){return msg.id===r.data[0].id;});
          if(hasReal) return prev.filter(function(msg){return msg.id!==tempId;});
          return prev.map(function(msg){return msg.id===tempId?r.data[0]:msg;});
        });
      }
      if(onMessageSent) onMessageSent(convo, sentText);
    }).catch(function(e){
      // FIX R10-7 (part 2): raw promise rejects (network/abort/CORS) used to
      // bubble up uncaught — leaving the optimistic message stuck forever
      // with no error toast. Rollback + toast, symmetric to r.error branch.
      console.warn('[ringin] send msg reject:', e);
      setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
      setToast('Message failed — try again');
      setTimeout(function(){setToast('');}, 2500);
    });
  }

  function openMsgMenu(msg,ev){
    if(msg.sender_id!==myId) return;
    var rect=ev.currentTarget?ev.currentTarget.getBoundingClientRect():{left:0,top:0,width:0,height:0};
    setMsgMenu({msgId:msg.id,x:rect.left,y:rect.top});
  }

  function unsendMessage(msgId){
    var snap=msgs.find(function(m){return m.id===msgId;});
    setMsgs(function(prev){return prev.filter(function(m){return m.id!==msgId;});});
    setMsgMenu(null);
    setToast('Message unsent');
    setTimeout(function(){setToast('');},2000);
    sb.from('messages').delete().eq('id',msgId).then(function(r){
      if(r.error){
        console.error('RingIn Error [unsendMessage]:',r.error&&r.error.message?r.error.message:'Unknown error');
        if(snap) setMsgs(function(prev){
          var idx=prev.findIndex(function(m){return m.id>msgId;});
          if(idx===-1) return prev.concat([snap]);
          return prev.slice(0,idx).concat([snap]).concat(prev.slice(idx));
        });
        setToast('Failed to unsend');
        setTimeout(function(){setToast('');},2000);
      }
    });
  }

  var overlayScale = 1 + levHoldPct * 2; // 1x → 3x
  var glowRadius = 10 + levHoldPct * 30;

  return React.createElement('div',{
    ref:chatBoxRef,
    // Reserve top space so messages don't slide under the FIXED header (56px ≈
    // header height in browser mode). The .ringin-chat-wrap class lets
    // App.css bump this reserve by env(safe-area-inset-top) ONLY when the app
    // is installed as a PWA — so the messages don't slide under the iOS
    // status bar overlay there.
    className:'ringin-chat-wrap',
    style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',paddingTop:'56px',position:'relative'},
  },
    // ── Header — position:FIXED so it pins to the viewport regardless of nested scroll
    // containers, and a visualViewport listener (above) keeps it glued to the visible top
    // even when iOS Safari shifts the layout for the keyboard.
    // .ringin-chat-header className lets App.css push the back / name / call
    // content below the iOS status bar in PWA mode — Safari browser tab is
    // untouched.
    React.createElement('div',{ref:headerRef,className:'ringin-chat-header',style:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0,justifyContent:'space-between',position:'fixed',top:0,left:0,right:0,zIndex:50,background:'var(--bg)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',willChange:'transform'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',flex:1,minWidth:0}},
        React.createElement('button',{onClick:onBack,title:'Back',style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},
          React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
            React.createElement('polyline',{points:'15 18 9 12 15 6'})
          )
        ),
        // Avatar + name both open the other user's profile (whole left cluster is clickable)
        (function(){
          var otherUid = convo.otherId || convo.receiverId || convo.user_id;
          function openProfile(){
            if(!otherUid || !onViewUser) return;
            onViewUser({ id: otherUid, full_name: otherName, avatar_url: otherAvatar||convo.img||null, is_online: !!convo.isOnline });
          }
          return [
            React.createElement('div',{key:'av',onClick:openProfile,style:{width:'38px',height:'38px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',overflow:'hidden',flexShrink:0,cursor:otherUid?'pointer':'default'}},
              otherAvatar?React.createElement('img',{src:otherAvatar,alt:otherName,style:{width:'100%',height:'100%',objectFit:'cover'}}):(convo.initials||(otherName||'?').substring(0,2).toUpperCase())
            ),
            React.createElement('div',{key:'nm',onClick:openProfile,style:{flex:1,minWidth:0,cursor:otherUid?'pointer':'default'}},
              React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'var(--text)'}},otherName),
              // Subtitle priority: typing → Online dot → "last seen Xm ago" → role.
              otherTyping ? React.createElement('div',{style:{fontSize:'10px',color:'var(--ac)',fontStyle:'italic'}},'typing…')
                : (otherOnline||convo.isOnline) ? React.createElement('div',{style:{fontSize:'10px',color:'var(--green)',display:'flex',alignItems:'center',gap:'3px'}},
                    React.createElement('span',{style:{width:'5px',height:'5px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}),'Online'
                  )
                : formatLastSeen(otherLastSeen) ? React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},formatLastSeen(otherLastSeen))
                : React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},convo.role||'Member')
            )
          ];
        })(),
        // Simple theme-color Call button — icon only, no text
        React.createElement('button',{
          onClick:function(){if(onCall)onCall(Object.assign({},convo,{rate:convo.rate||30,name:otherName,img:otherAvatar||convo.img}));},
          title:'Call',
          style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0,boxShadow:'0 3px 10px rgba(123,110,255,0.35)'}
        },
          React.createElement('svg',{viewBox:'0 0 24 24',width:'16',height:'16',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
            React.createElement('path',{d:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11L8.09 10.18a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z'})
          )
        )
      ),
      React.createElement('button',{
        onClick:function(e){e.stopPropagation();setChatMenuOpen(function(v){return !v;});},
        style:{background:'none',border:'none',color:'var(--text)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',lineHeight:1,flexShrink:0}
      },'⋮')
    ),

    // ── Chat header 3-dot menu dropdown ──
    // Floating reaction picker — appears on long-press of any message.
    reactionPicker ? React.createElement(React.Fragment, null,
      React.createElement('div', {
        style:{position:'fixed',inset:0,zIndex:400},
        onClick:function(){ setReactionPicker(null); }
      }),
      React.createElement('div', {
        onClick:function(e){ e.stopPropagation(); },
        style:{
          position:'fixed',
          left: Math.max(12, Math.min(reactionPicker.x, (typeof window!=='undefined'?window.innerWidth:360) - 280)),
          top: Math.max(80, reactionPicker.y - 56),
          zIndex:401,
          background:'var(--bg2,#161028)',
          border:'1px solid var(--border)',
          borderRadius:'24px',
          padding:'6px 10px',
          display:'flex',
          gap:'6px',
          boxShadow:'0 10px 30px rgba(0,0,0,0.55)',
        }
      },
        REACTION_EMOJIS.map(function(e){
          return React.createElement('button',{
            key:e,
            onClick:function(){ toggleReaction(reactionPicker.msgId, e); },
            style:{background:'none',border:'none',cursor:'pointer',fontSize:'22px',padding:'4px',lineHeight:1,fontFamily:'inherit'}
          }, e);
        }),
        // For OWN messages, also offer the legacy "•••" → unsend menu.
        reactionPicker.isMine ? React.createElement('button',{
          onClick:function(){
            var msg = msgs.find(function(m){ return m.id === reactionPicker.msgId; });
            setReactionPicker(null);
            if (msg) openMsgMenu(msg, { currentTarget: { getBoundingClientRect: function(){ return { left: reactionPicker.x, top: reactionPicker.y, width:0, height:0 }; } } });
          },
          style:{background:'none',border:'none',cursor:'pointer',fontSize:'18px',padding:'4px 8px',color:'var(--t2)',fontFamily:'inherit'}
        }, '⋯') : null
      )
    ) : null,
    chatMenuOpen ? React.createElement(React.Fragment, null,
      React.createElement('div',{
        style:{position:'fixed',inset:0,zIndex:300},
        onClick:function(){setChatMenuOpen(false);}
      }),
      React.createElement('div',{
        style:{position:'fixed',top:'56px',right:'12px',zIndex:301,
          background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',
          padding:'6px',boxShadow:'0 4px 24px rgba(0,0,0,0.5)',minWidth:'200px'}
      },
        React.createElement('button',{
          onClick:toggleMuteConvo,
          style:{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 14px',
            background:'none',border:'none',borderRadius:'8px',color:'var(--text)',
            fontSize:'13px',fontWeight:500,cursor:'pointer',textAlign:'left'}
        }, mutedConvos.includes(convo&&(convo.convId||convo.id)) ? '🔔 Unmute Conversation' : '🔕 Mute Conversation'),
        React.createElement('div',{style:{height:'1px',background:'var(--border)',margin:'2px 0'}}),
        // Per-conversation read-receipts toggle. Reciprocal — when off, the
        // other side sees no ✓✓ blue from us AND we see no ✓✓ blue from them.
        React.createElement('button',{
          onClick:toggleReadReceipts,
          style:{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 14px',
            background:'none',border:'none',borderRadius:'8px',color:'var(--text)',
            fontSize:'13px',fontWeight:500,cursor:'pointer',textAlign:'left'}
        }, readReceiptsOffHere ? '👁 Show Read Receipts' : '🙈 Hide Read Receipts'),
        React.createElement('div',{style:{height:'1px',background:'var(--border)',margin:'2px 0'}}),
        // T2.1 — Restrict mode. The other side has no notification or
        // visible signal that anything has changed (anti-retaliation).
        React.createElement('button',{
          onClick:toggleRestrict,
          style:{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 14px',
            background:'none',border:'none',borderRadius:'8px',color:'var(--text)',
            fontSize:'13px',fontWeight:500,cursor:'pointer',textAlign:'left'}
        }, isRestrictedHere ? '✓ Unrestrict' : '⚠ Restrict ' + (convo && convo.name ? convo.name.split(' ')[0] : 'User')),
        React.createElement('div',{style:{height:'1px',background:'var(--border)',margin:'2px 0'}}),
        React.createElement('button',{
          onClick:clearAllChat,
          style:{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 14px',
            background:'none',border:'none',borderRadius:'8px',color:'var(--amber)',
            fontSize:'13px',fontWeight:500,cursor:'pointer',textAlign:'left'}
        }, '🗑 Clear All Chat'),
        React.createElement('div',{style:{height:'1px',background:'var(--border)',margin:'2px 0'}}),
        React.createElement('button',{
          onClick:blockUser,
          style:{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 14px',
            background:'none',border:'none',borderRadius:'8px',color:'#FF4757',
            fontSize:'13px',fontWeight:500,cursor:'pointer',textAlign:'left'}
        }, '🚫 Block '+(convo&&convo.name ? convo.name.split(' ')[0] : 'User'))
      )
    ) : null,

    // ── Chat messages area with reaction overlay ──
    React.createElement('div',{style:{flex:1,position:'relative',overflow:'hidden'}},
      React.createElement('div',{
        ref:msgsScrollRef,
        // FIX #12: track whether the user has scrolled away from the bottom
        // so the auto-scroll effect can stop yanking them down when new
        // messages arrive (e.g. reading older history).
        onScroll:function(e){
          var el = e.currentTarget;
          if (!el) return;
          var atBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 80;
          setUserScrolledUp(!atBottom);
        },
        style:{height:'100%',overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px',scrollbarWidth:'none',msOverflowStyle:'none'}
      },
        msgs.length===0&&React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',marginTop:'40px'}},'No messages yet. Say hi! 👋'),
        msgs.map(function(m){
          var isMe=m.sender_id===myId;
          // ── Call-log system message: centered bubble, not alignment-based ──
          if(isCallLog(m.text)){
            var log = parseCallLog(m.text);
            var d = describeCallLog(log, myId);
            return React.createElement('div',{key:m.id,style:{display:'flex',justifyContent:'center',padding:'4px 0'}},
              React.createElement('div',{style:{
                display:'inline-flex',alignItems:'center',gap:'8px',
                padding:'6px 14px',borderRadius:'14px',
                background: d.isMissed ? 'rgba(239,68,68,0.12)' : 'var(--bg3)',
                border: '1px solid '+(d.isMissed?'rgba(239,68,68,0.3)':'var(--border)'),
                fontSize:'11px',color: d.color, fontWeight:600,
                maxWidth:'80%',
              }},
                React.createElement('span',{style:{fontSize:'13px'}}, d.icon),
                React.createElement('span',null, d.label),
                m.created_at ? React.createElement('span',{style:{color:'var(--t3)',fontWeight:400,marginLeft:'4px'}}, ' · '+new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})) : null
              )
            );
          }
          return React.createElement('div',{key:m.id,style:{display:'flex',justifyContent:isMe?'flex-end':'flex-start',alignItems:'flex-end',gap:'6px'}},
            !isMe?React.createElement('div',{style:{width:'26px',height:'26px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}},
              otherAvatar?React.createElement('img',{src:otherAvatar,style:{width:'100%',height:'100%',objectFit:'cover'}}):(convo.initials||(otherName||'?').substring(0,2).toUpperCase())
            ):null,
            React.createElement('div',null,
              React.createElement('div',{
                style:{maxWidth:'260px',padding:'9px 13px',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',background:isMe?'var(--ac)':'var(--bg3)',border:isMe?'none':'1px solid var(--border)',fontSize:'13px',color:isMe?'#fff':'var(--text)',lineHeight:1.4},
                onMouseDown:function(ev){pressTimerRef.current=setTimeout(function(){openReactionPicker(m,ev);},500);},
                onMouseUp:function(){clearTimeout(pressTimerRef.current);},
                onMouseLeave:function(){clearTimeout(pressTimerRef.current);},
                onTouchStart:function(ev){pressTimerRef.current=setTimeout(function(){openReactionPicker(m,{currentTarget:ev.currentTarget});},500);},
                onTouchEnd:function(){clearTimeout(pressTimerRef.current);}
              },
                m.text&&m.text.startsWith('[img]')
                  ?React.createElement('img',{src:m.text.slice(5),alt:'image',style:{maxWidth:'180px',maxHeight:'200px',borderRadius:'8px',display:'block'}})
                  // FIX #2: [mshare] body was showing as raw text. Render as a clickable card.
                  // Format: [mshare]<link>|<caption>
                  :(m.text&&m.text.startsWith('[mshare]'))
                    ?(function(){
                        var body=m.text.slice(8);
                        var sep=body.indexOf('|');
                        var link=sep>=0?body.slice(0,sep):body;
                        var cap=sep>=0?body.slice(sep+1):'';
                        return React.createElement('div',{style:{padding:'8px',border:'1px solid var(--border)',borderRadius:'10px',background:'var(--bg3)',maxWidth:'240px'}},
                          React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginBottom:'4px'}}, '✨ Shared a moment'),
                          cap?React.createElement('div',{style:{fontSize:'12px',color:'var(--text)',marginBottom:'6px',wordBreak:'break-word'}}, cap):null,
                          React.createElement('a',{href:link,target:'_blank',rel:'noopener noreferrer',style:{fontSize:'11px',color:'var(--ac)',textDecoration:'none'}}, 'View moment →')
                        );
                      })()
                  :(m.text&&(m.text.startsWith('[mreply]')||m.text.startsWith('[mlike]')))
                    ?(function(){
                        var isLike=m.text.startsWith('[mlike]');
                        var body=isLike?m.text.slice(7):m.text.slice(8);
                        var caption=body, replyText='';
                        if(!isLike){
                          var sep=body.indexOf('|');
                          if(sep>=0){caption=body.slice(0,sep);replyText=body.slice(sep+1);} else replyText=body;
                        }
                        // Quote block above the (optional) reply body. The
                        // colour palette is muted for both sides of the chat
                        // so it reads as a referenced status rather than the
                        // primary message.
                        return React.createElement('div',{style:{minWidth:'140px'}},
                          React.createElement('div',{style:{
                            fontSize:'10px',
                            opacity:0.8,
                            marginBottom:'4px',
                            fontWeight:600,
                          }}, isLike?'Liked your status ❤️':'Replied to your status'),
                          React.createElement('div',{style:{
                            background:isMe?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.05)',
                            border:isMe?'1px solid rgba(255,255,255,0.25)':'1px solid var(--border)',
                            borderRadius:'10px',
                            padding:'6px 10px',
                            fontSize:'12px',
                            lineHeight:1.35,
                            color:isMe?'rgba(255,255,255,0.92)':'var(--t2)',
                            fontStyle:'italic',
                            maxWidth:'240px',
                            wordBreak:'break-word',
                          }}, caption || '(status)'),
                          replyText?React.createElement('div',{style:{
                            marginTop:'6px',
                            fontSize:'13px',
                            lineHeight:1.4,
                            wordBreak:'break-word',
                          }}, replyText):null
                        );
                      })()
                    :React.createElement('span',null,m.text)
              ),
              React.createElement('div',{style:{fontSize:'9px',color:'var(--t3)',textAlign:isMe?'right':'left',marginTop:'3px',display:'flex',alignItems:'center',justifyContent:isMe?'flex-end':'flex-start',gap:'4px'}},
                m.created_at?React.createElement('span',null,new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',timeZone:localStorage.getItem('user_timezone')||undefined})):null,
                // Tick state: ✓ = sent (not yet read), ✓✓ blue = read.
                // If the user has read receipts disabled for this convo,
                // we never show ✓✓ blue — the deal is reciprocal: we don't
                // see theirs, we don't show ours.
                isMe?React.createElement('span',{style:{color:(m.read && !readReceiptsOffHere)?'#4A9CFF':'var(--t3)',fontWeight:600,letterSpacing:'-1px'}},(m.read && !readReceiptsOffHere)?'✓✓':'✓'):null
              ),
              // Reaction badges below the message — one chip per emoji with count.
              (function(){
                var rmap = reactionsByMsg[m.id]; if (!rmap) return null;
                var emojis = Object.keys(rmap).filter(function(e){ return rmap[e] && rmap[e].length > 0; });
                if (emojis.length === 0) return null;
                return React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'4px',justifyContent:isMe?'flex-end':'flex-start'}},
                  emojis.map(function(e){
                    var users = rmap[e] || [];
                    var iReacted = users.indexOf(myId) >= 0;
                    return React.createElement('button',{
                      key:e,
                      onClick:function(){ toggleReaction(m.id, e); },
                      style:{
                        display:'inline-flex',alignItems:'center',gap:'3px',
                        padding:'2px 7px',borderRadius:'12px',
                        background:iReacted?'rgba(232,77,154,0.15)':'var(--bg3)',
                        border:'1px solid '+(iReacted?'#E84D9A':'var(--border)'),
                        fontSize:'11px',color:'var(--text)',cursor:'pointer',fontFamily:'inherit',
                      }
                    },
                      React.createElement('span',null,e),
                      users.length>1?React.createElement('span',{style:{fontSize:'10px',fontWeight:600,opacity:0.8}}, users.length):null
                    );
                  })
                );
              })()
            )
          );
        }),
        // Typing indicator — appears at the bottom of the message list when
        // the other party is typing. Three dots with staggered bounce.
        otherTyping ? React.createElement('div',{
          style:{display:'flex',alignItems:'center',gap:'6px',padding:'4px 8px 0',animation:'ringin-typing-fade 0.15s ease-out'}
        },
          React.createElement('div',{style:{width:'24px',height:'24px',borderRadius:'50%',background:convo.color||'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}},
            otherAvatar?React.createElement('img',{src:otherAvatar,style:{width:'100%',height:'100%',objectFit:'cover'}}):(convo.initials||(otherName||'?').substring(0,2).toUpperCase())
          ),
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'4px',padding:'9px 13px',borderRadius:'18px 18px 18px 4px',background:'var(--bg3)',border:'1px solid var(--border)'}},
            React.createElement('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:'var(--t2)',animation:'ringin-typing-dot 1.2s ease-in-out infinite',animationDelay:'0s'}}),
            React.createElement('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:'var(--t2)',animation:'ringin-typing-dot 1.2s ease-in-out infinite',animationDelay:'0.2s'}}),
            React.createElement('span',{style:{width:'6px',height:'6px',borderRadius:'50%',background:'var(--t2)',animation:'ringin-typing-dot 1.2s ease-in-out infinite',animationDelay:'0.4s'}})
          )
        ) : null,
        React.createElement('div',{ref:bottomRef})
      ),

      // ── Reaction overlay in chat window ──
      levActive?React.createElement('div',{style:{
        position:'absolute',inset:0,
        display:'flex',alignItems:'center',justifyContent:'center',
        pointerEvents:'none',
        zIndex:10,
        background:'transparent'
      }},
        // shine — grows with heart, fully dissolves to rgba(0) at 100%
        React.createElement('div',{style:{
          position:'absolute',
          width:(overlayScale*200)+'px',
          height:(overlayScale*200)+'px',
          borderRadius:'50%',
          background:levActive==='heart'
            ?'radial-gradient(circle,'
              +'rgba(139,127,255,0.60) 0%,'
              +'rgba(170,90,210,0.50) 8%,'
              +'rgba(200,75,180,0.40) 18%,'
              +'rgba(225,70,155,0.30) 28%,'
              +'rgba(240,61,142,0.20) 38%,'
              +'rgba(220,70,150,0.13) 48%,'
              +'rgba(190,80,195,0.08) 57%,'
              +'rgba(165,95,215,0.05) 65%,'
              +'rgba(150,100,220,0.03) 72%,'
              +'rgba(145,110,225,0.018) 78%,'
              +'rgba(142,118,230,0.010) 83%,'
              +'rgba(140,122,232,0.005) 88%,'
              +'rgba(139,125,255,0.002) 92%,'
              +'rgba(139,127,255,0.001) 95%,'
              +'rgba(139,127,255,0.000) 98%,'
              +'rgba(139,127,255,0.000) 100%)'
            :'radial-gradient(circle,'
              +'rgba(139,127,255,0.60) 0%,'
              +'rgba(139,127,255,0.46) 10%,'
              +'rgba(139,127,255,0.32) 22%,'
              +'rgba(139,127,255,0.20) 34%,'
              +'rgba(139,127,255,0.12) 46%,'
              +'rgba(139,127,255,0.07) 56%,'
              +'rgba(139,127,255,0.04) 65%,'
              +'rgba(139,127,255,0.020) 73%,'
              +'rgba(139,127,255,0.010) 80%,'
              +'rgba(139,127,255,0.004) 86%,'
              +'rgba(139,127,255,0.001) 92%,'
              +'rgba(139,127,255,0.000) 97%,'
              +'rgba(139,127,255,0.000) 100%)',
          transition:'none',
          pointerEvents:'none'
        }}),
        // emoji / heart centered, growing with earthquake shake
        (function(){
          var pct=levHoldPct;
          var shaking=pct>0.06;
          var animName=pct>0.55?'quake2':'quake1';
          // duration shrinks 0.50s → 0.08s as pct goes 0→1 (gets more frantic)
          var animDur=(0.50-pct*0.42)+'s';
          // shake offset magnitude grows with pct (used inside keyframes via CSS var)
          var baseStyle={
            position:'relative',
            transformOrigin:'center',
            transition:'none',
            display:'inline-block'
          };
          if(shaking){
            // use CSS var for scale so keyframes can embed it
            baseStyle['--qs']=String(overlayScale);
            baseStyle.animationName=animName;
            baseStyle.animationDuration=animDur;
            baseStyle.animationTimingFunction='linear';
            baseStyle.animationIterationCount='infinite';
          } else {
            baseStyle.transform='scale('+overlayScale+')';
          }
          return React.createElement('div',{style:baseStyle},
            levActive==='heart'
              ?React.createElement(HeartSvg,{size:64,id:'chatOverlayHeart'})
              :React.createElement('div',{style:{
                  fontSize:'60px',lineHeight:1,
                  filter:'drop-shadow(0 0 '+(8+levHoldPct*22)+'px rgba(123,110,255,'+(0.7+levHoldPct*0.3)+')'
                }},'👍')
          );
        })()
      ):null,

      // ── Toast ──
      toast?React.createElement('div',{style:{position:'absolute',bottom:'70px',left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,0.75)',color:'#fff',padding:'6px 16px',borderRadius:'20px',fontSize:'12px',fontWeight:600,pointerEvents:'none',zIndex:100}},toast):null,

      // ── Message context menu ──
      msgMenu?React.createElement('div',{
        style:{position:'fixed',inset:0,zIndex:200},
        onClick:function(){setMsgMenu(null);}
      },
        React.createElement('div',{
          // Final polish: add Math.max(8, ...) left clamp so the menu
          // doesn't get pushed offscreen-left when msgMenu.x is small
          // (long-press near the left edge of the screen).
          style:{position:'fixed',left:Math.max(8, Math.min(msgMenu.x, window.innerWidth-160))+'px',top:(msgMenu.y-48)+'px',
            background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',
            padding:'4px',boxShadow:'0 4px 20px rgba(0,0,0,0.4)',zIndex:201,minWidth:'140px'},
          onClick:function(e){e.stopPropagation();}
        },
          React.createElement('button',{
            onClick:function(){unsendMessage(msgMenu.msgId);},
            style:{display:'flex',alignItems:'center',gap:'8px',width:'100%',padding:'8px 12px',
              background:'none',border:'none',borderRadius:'8px',color:'#FF4757',fontSize:'13px',
              fontWeight:600,cursor:'pointer',textAlign:'left'}
          },'🗑 Unsend')
        )
      ):null
    ),

    showEmoji?React.createElement('div',{style:{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:'6px',background:'var(--bg)'}},
      ['😊','😂','❤️','🔥','👍','🙌','😍','🤔','👏','🎉','💪','✨','😢','😮','🥳','😎','🙏','💯','😅','🤣'].map(function(em){
        return React.createElement('span',{key:em,onClick:function(){playMsEmojiClick();setTxt(function(t){return t+em;});},style:{fontSize:'22px',cursor:'pointer',padding:'3px'}},em);
      })
    ):null,

    // ── Input bar ──
    React.createElement('div',{style:{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0,alignItems:'center',background:'var(--bg)'}},
      React.createElement('button',{
        onClick:function(){fileInputRef.current&&fileInputRef.current.click();},
        style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--bg3)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:'16px'}
      },'📷'),
      React.createElement('input',{
        ref:fileInputRef,
        type:'file',
        accept:'image/*',
        style:{display:'none'},
        onChange:function(ev){
          var file=ev.target.files&&ev.target.files[0];
          if(!file) return;
          // Validate file type
          var allowed=['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
          if(!allowed.includes(file.type)){
            setToast('Only images allowed (JPG, PNG, GIF, WebP)');
            setTimeout(function(){setToast('');},2500);
            ev.target.value='';
            return;
          }
          // Validate file size (max 5MB) — checked BEFORE compression so users
          // get a clean error on a 12MB photo instead of silently compressing
          // a 20MB monster. After compression the actual upload is usually
          // 200-600KB.
          if(file.size>5*1024*1024){
            setToast('Image must be under 5MB');
            setTimeout(function(){setToast('');},2500);
            ev.target.value='';
            return;
          }
          var tempId='tmp_img_'+Date.now();
          var localUrl=URL.createObjectURL(file);
          var receiverId=convo.receiverId||(convId.replace(myId,'').replace('_',''));
          // Optimistic placeholder while uploading
          var optimisticMsg={id:tempId,conversation_id:convId,sender_id:myId,sender_name:myName,receiver_id:receiverId,text:'[img]'+localUrl,read:false,created_at:new Date().toISOString()};
          setMsgs(function(prev){return prev.concat([optimisticMsg]);});
          // Compress before upload — saves bandwidth + Supabase Storage cost.
          // GIF compression would destroy the animation, so skip it for that type.
          var compressP = file.type === 'image/gif'
            ? Promise.resolve(file)
            : compressImage(file, { maxEdge: 1600, quality: 0.82 });
          compressP.then(function(ef){
            var uploadFile = ef || file;
            var ext = uploadFile.type === 'image/jpeg' ? 'jpg' :
                      uploadFile.type === 'image/png'  ? 'png' :
                      uploadFile.type === 'image/gif'  ? 'gif' :
                      uploadFile.type === 'image/webp' ? 'webp' : 'jpg';
            var fileName = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
          // Helper — revokes the blob URL we created for the optimistic
          // preview, so the browser can free the underlying File memory.
          // Without this, every chat photo leaks ~size-of-photo until the
          // tab is closed. Especially bad on Android with large camera shots.
          function revokeLocal(){ try{ URL.revokeObjectURL(localUrl); }catch(e){} }
          sb.storage.from('chat-images').upload(fileName,uploadFile,{contentType:uploadFile.type}).then(function(r){
            if(r.error){
              console.error('RingIn Error [chatPhotoUpload]:', r.error&&r.error.message?r.error.message:'Unknown error');
              setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
              revokeLocal();
              // ROUND 8 FIX #7: replace blocking alert with non-modal toast (matches
              // the other failure paths in this same function, line 1319/1331)
              try { setToast('Photo upload failed: '+(r.error.message||'')); setTimeout(function(){setToast('');},2500); } catch(_){ }
              return;
            }
            // FIX #9: getPublicUrl().data.publicUrl can be undefined — guard
            // it and treat as upload failure (remove temp, revoke blob, toast).
            var pub = sb.storage.from('chat-images').getPublicUrl(fileName);
            var url = pub && pub.data && pub.data.publicUrl;
            if(!url){
              console.error('RingIn Error [chatPhotoUpload]: missing publicUrl');
              setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
              revokeLocal();
              setToast('Photo upload failed');
              setTimeout(function(){setToast('');},2500);
              return;
            }
            sb.from('messages').insert([{conversation_id:convId,sender_id:myId,sender_name:myName,receiver_id:receiverId,text:'[img]'+url,read:false}]).select().then(function(mr){
              if(mr.error){
                // FIX #9: on insert error, KEEP the blob URL valid (do NOT
                // revoke yet) so the optimistic temp message keeps rendering
                // its preview. Previously revokeLocal() ran on error too,
                // which left a broken image icon when the temp was kept
                // around. Pair this with a toast so the user sees it failed.
                console.error('RingIn Error [chatPhotoInsert]:', mr.error&&mr.error.message?mr.error.message:'Unknown error');
                setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
                setToast('Photo send failed');
                setTimeout(function(){setToast('');},2500);
                // Defer the revoke to a later tick so the blob is briefly
                // alive in case any in-flight render still references it.
                setTimeout(revokeLocal, 0);
                return;
              }
              if(mr.data&&mr.data[0]){
                setMsgs(function(prev){
                  var hasReal=prev.find(function(msg){return msg.id===mr.data[0].id;});
                  if(hasReal) return prev.filter(function(msg){return msg.id!==tempId;});
                  return prev.map(function(msg){return msg.id===tempId?mr.data[0]:msg;});
                });
              }
              // Real CDN URL now in the message — the blob preview is no
              // longer rendered, safe to release the local object.
              // FIX #9: revoke only on success path.
              revokeLocal();
              if(onMessageSent) onMessageSent(convo,'📷 Photo');
            });
          });
          }).catch(function(err){
            // FIX #10: compression itself failed (rare) — fall back to
            // uploading raw AND insert the messages row, otherwise the
            // optimistic blob bubble lives forever.
            console.warn('[ringin] image compress failed, uploading raw', err);
            var ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'webp';
            var fileName = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
            function revokeLocal2(){ try{ URL.revokeObjectURL(localUrl); }catch(e){} }
            sb.storage.from('chat-images').upload(fileName,file,{contentType:file.type}).then(function(r){
              if(r && r.error){
                console.error('RingIn Error [chatPhotoUpload-raw]:', r.error&&r.error.message?r.error.message:'Unknown error');
                setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
                revokeLocal2();
                setToast('Photo upload failed');
                setTimeout(function(){setToast('');},2500);
                return;
              }
              var pub = sb.storage.from('chat-images').getPublicUrl(fileName);
              var url = pub && pub.data && pub.data.publicUrl;
              if(!url){
                console.error('RingIn Error [chatPhotoUpload-raw]: missing publicUrl');
                setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
                revokeLocal2();
                setToast('Photo upload failed');
                setTimeout(function(){setToast('');},2500);
                return;
              }
              sb.from('messages').insert([{conversation_id:convId,sender_id:myId,sender_name:myName,receiver_id:receiverId,text:'[img]'+url,read:false}]).select().then(function(mr){
                if(mr && mr.error){
                  // FIX #9 (raw fallback): on insert error, defer revoke so
                  // the blob is briefly alive — previously the temp was
                  // filtered and the blob was revoked in the SAME microtask
                  // as the setMsgs filter, occasionally causing a broken
                  // image flash before the temp was removed.
                  console.error('RingIn Error [chatPhotoInsert-raw]:', mr.error&&mr.error.message?mr.error.message:'Unknown error');
                  setMsgs(function(prev){return prev.filter(function(msg){return msg.id!==tempId;});});
                  setToast('Photo upload failed');
                  setTimeout(function(){setToast('');},2500);
                  setTimeout(revokeLocal2, 0);
                  return;
                }
                if(mr.data&&mr.data[0]){
                  setMsgs(function(prev){
                    var hasReal=prev.find(function(msg){return msg.id===mr.data[0].id;});
                    if(hasReal) return prev.filter(function(msg){return msg.id!==tempId;});
                    return prev.map(function(msg){return msg.id===tempId?mr.data[0]:msg;});
                  });
                }
                // FIX #9: revoke only on success path.
                revokeLocal2();
                if(onMessageSent) onMessageSent(convo,'📷 Photo');
              });
            });
          });
          ev.target.value='';
        }
      }),
      React.createElement('button',{
        onClick:function(){setShowEmoji(function(v){return !v;});},
        style:{width:'34px',height:'34px',borderRadius:'50%',background:showEmoji?'var(--acg)':'var(--bg3)',border:showEmoji?'1px solid var(--ac)':'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:'16px',color:showEmoji?'var(--ac)':'var(--text)'}
      },'😊'),
      // R13 FIX #6: iOS keyboard polish for chat composer — show the
      // blue "Send" return key, enable sentence-cap + autocorrect to
      // match native messaging apps.
      React.createElement('input',{
        value:txt,
        onChange:function(e){setTxt(e.target.value);clearTimeout(chatTypingTimerRef.current);chatTypingTimerRef.current=setTimeout(function(){playMsKeyClick();},80);onTypingKeystroke();},
        onKeyDown:function(e){if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229)send();}, /* FIX #2: skip Enter while IME composing (CJK) */
        placeholder:'Type a message...',
        enterKeyHint:'send',
        autoCapitalize:'sentences',
        autoCorrect:'on',
        style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'22px',padding:'10px 14px',fontSize:'14px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
      }),

      // ── Lever ──
      (function(){
        var pct=Math.min(Math.abs(levY)/LMAX,1);
        var knobGlow=levActive==='heart'?'rgba(232,77,154,'+(0.3+levHoldPct*0.5)+')':levActive==='thumbs'?'rgba(123,110,255,'+(0.3+levHoldPct*0.5)+')':'rgba(123,110,255,0.25)';
        return React.createElement('div',{style:{position:'relative',flexShrink:0,width:'38px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',userSelect:'none',touchAction:'none'}},
          // ── housing ──
          React.createElement('div',{
            style:{
              width:'38px',height:'82px',borderRadius:'19px',
              background:'rgba(16,12,28,0.9)',
              backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
              border:'1px solid '+(levActive==='heart'?'rgba(232,77,154,0.45)':levActive==='thumbs'?'rgba(123,110,255,0.45)':'rgba(255,255,255,0.12)'),
              boxShadow:'0 6px 28px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.08)'
                +(levActive?', 0 0 20px '+(levActive==='heart'?'rgba(232,77,154,0.25)':'rgba(123,110,255,0.25)'):''),
              position:'relative',overflow:'hidden',cursor:'ns-resize',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',
              padding:'10px 0',
              transition:'border-color 0.2s,box-shadow 0.2s'
            },
            onTouchStart:function(e){e.preventDefault();setLevStart(getCY(e));},
            onTouchMove:function(e){
              e.preventDefault();
              if(levStart===null)return;
              var dy=getCY(e)-levStart;
              var clamped=Math.max(-LMAX,Math.min(LMAX,dy));
              setLevY(clamped);
              if(clamped<=-14)activateLever('heart');
              else if(clamped>=14)activateLever('thumbs');
              else deactivateLever();
            },
            onTouchEnd:function(e){e.preventDefault();leverRelease();},
            onMouseDown:function(e){setLevStart(getCY(e));},
            onMouseMove:function(e){
              if(levStart===null)return;
              var dy=getCY(e)-levStart;
              var clamped=Math.max(-LMAX,Math.min(LMAX,dy));
              setLevY(clamped);
              if(clamped<=-14)activateLever('heart');
              else if(clamped>=14)activateLever('thumbs');
              else deactivateLever();
            },
            onMouseUp:function(){leverRelease();},
            onMouseLeave:function(){if(levStart!==null)leverRelease();}
          },
            // heart icon top
            React.createElement('div',{style:{opacity:levActive==='heart'?0.9+levHoldPct*0.1:0.28,transition:'opacity 0.15s'}},
              React.createElement(HeartSvg,{size:14,id:'levHTop'})
            ),
            // knob
            (function(){
              var atMax=levHoldPct>=1;
              var knobBg=levActive==='heart'
                ?'linear-gradient(145deg,#8B7FFF,#D455AA,#F03D8E)'
                :levActive==='thumbs'
                ?'linear-gradient(145deg,#7B6EFF,#B44FD4,#E84D9A)'
                :'linear-gradient(145deg,#8B7FFF,#D455AA,#F03D8E)';
              var shakeAnim=atMax?'knobShake 0.18s ease-in-out infinite':'none';
              return React.createElement('div',{style:{
                width:'30px',height:'30px',borderRadius:'50%',flexShrink:0,
                background:knobBg,
                boxShadow:'0 3px 14px rgba(0,0,0,0.5), 0 0 0 2px '+knobGlow+(atMax?', 0 0 18px rgba(232,77,154,0.65)':''),
                transform:'translateY('+levY+'px)',
                transition:levStart!==null?'box-shadow 0.15s,background 0.3s':'transform 0.42s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.15s,background 0.3s',
                animation:shakeAnim,
                display:'flex',alignItems:'center',justifyContent:'center',zIndex:2
              }},
                React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'3.5px',alignItems:'center'}},
                  React.createElement('div',{style:{width:'13px',height:'1.5px',borderRadius:'1px',background:'rgba(255,255,255,0.45)'}}),
                  React.createElement('div',{style:{width:'9px',height:'1.5px',borderRadius:'1px',background:'rgba(255,255,255,0.28)'}}),
                  React.createElement('div',{style:{width:'13px',height:'1.5px',borderRadius:'1px',background:'rgba(255,255,255,0.45)'}})
                )
              );
            })(),
            // thumbs icon bottom
            React.createElement('div',{style:{fontSize:'12px',opacity:levActive==='thumbs'?0.9+levHoldPct*0.1:0.28,transition:'opacity 0.15s'}},'👍')
          ),
          // label
          React.createElement('div',{style:{fontSize:'7.5px',color:levActive?'var(--ac)':'var(--t3)',fontFamily:'DM Sans,sans-serif',textAlign:'center',letterSpacing:'0.2px',transition:'color 0.2s'}},
            levActive==='heart'?'♥ hold':levActive==='thumbs'?'👍 hold':'react'
          )
        );
      })(),

      // send button
      React.createElement('button',{
        onClick:send,disabled:!txt.trim(),
        style:{width:'40px',height:'40px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'18px',cursor:txt.trim()?'pointer':'default',flexShrink:0,opacity:txt.trim()?1:0.32,display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity 0.2s'}
      },'✓')
    )
  );
}

export default function MessagesScreen(props){
  var session = props.session;
  var myId = session&&session.user ? session.user.id : null;
  // Shared moments registry — wraps a ring around the conversation
  // partner's avatar in the convo list when they have an active moment.
  var momentUserIds = useMomentUserIds();
  var expertConvosS=useState(EXPERT_CONVOS_BASE); var expertConvos=expertConvosS[0]; var setExpertConvos=expertConvosS[1];
  var activeS=useState(props.initConvo||null); var active=activeS[0]; var setActive=activeS[1];
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  // FIX #9: removed `coinsS = useState(50)` stub. That hardcoded 50-coin
  // local state was bypassing the real wallet balance — a user with 1000
  // coins would still see CallScreen mounted with coins=50. The
  // useCoinBalance hook below already provides the real balance.
  // Shared coin balance — synced across all screens. Replaces the
  // per-screen local cache that didn't update after a wallet purchase.
  var coinBal = useCoinBalance(myId, sb);
  // Muted conversations list — read at MessagesScreen scope so the inbox
  // can render the 🔕 icon next to muted convos. (ChatBox has its own copy
  // for the chat-header mute menu.)
  var inboxMutedConvosS=useState(function(){try{var s=localStorage.getItem('ringin_muted_convos');return s?JSON.parse(s):[];}catch(e){return [];}}); var inboxMutedConvos=inboxMutedConvosS[0]; var setInboxMutedConvos=inboxMutedConvosS[1];
  // Keep inboxMutedConvos in sync with localStorage whenever the
  // active chat's mute state changes (ChatBox writes the key on toggle).
  // FIX #6: 'storage' event only fires for OTHER tabs — add a same-tab
  // custom-event listener that ChatBox dispatches after toggling mute.
  useEffect(function(){
    function reload(){
      try{var s=localStorage.getItem('ringin_muted_convos');setInboxMutedConvos(s?JSON.parse(s):[]);}catch(e){}
    }
    window.addEventListener('storage', reload);
    window.addEventListener('ringin:muted-convos-changed', reload);
    return function(){
      window.removeEventListener('storage', reload);
      window.removeEventListener('ringin:muted-convos-changed', reload);
    };
  },[]);
  // Inbox-scope restricted-users set — the inbox realtime handler reads
  // it to suppress notification badge bumps + sounds for restricted
  // senders. (ChatBox has its own copy for the chat-header restrict
  // toggle + chat-message realtime handler.)
  var inboxRestrictedSetS=useState(new Set()); var inboxRestrictedSet=inboxRestrictedSetS[0]; var setInboxRestrictedSet=inboxRestrictedSetS[1];
  // FIX #5: re-fetch when ChatBox dispatches 'ringin:restricted-changed'
  // after its toggleRestrict completes (storage event doesn't fire same-tab).
  useEffect(function(){
    if(!myId) return;
    function load(){
      try {
        sb.from('restricted_users').select('restricted_id').eq('restrictor_id', myId).then(function(r){
          if (r && !r.error && r.data) setInboxRestrictedSet(new Set(r.data.map(function(row){ return row.restricted_id; })));
        });
      } catch(_) {}
    }
    load();
    window.addEventListener('ringin:restricted-changed', load);
    return function(){ window.removeEventListener('ringin:restricted-changed', load); };
  },[myId]);
  var searchS=useState(''); var search=searchS[0]; var setSearch=searchS[1];
  var searchResS=useState([]); var searchRes=searchResS[0]; var setSearchRes=searchResS[1];
  var showNewS=useState(false); var showNew=showNewS[0]; var setShowNew=showNewS[1];
  var refreshingS=useState(false); var refreshing=refreshingS[0]; var setRefreshing=refreshingS[1];
  var pullStartS=useState(0); var pullStart=pullStartS[0]; var setPullStart=pullStartS[1];
  var pullDistS=useState(0); var pullDist=pullDistS[0]; var setPullDist=pullDistS[1];
  // Mock-expert conversations stored locally (driven by Moments likes /
  // replies). Merged into userConvos alongside Supabase-loaded convos.
  function loadExpertConvos(){
    if(!myId) return [];
    try{
      var raw = localStorage.getItem('ringin_expert_convos_'+myId);
      if(!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function mergeExpertConvos(list){
    var experts = loadExpertConvos();
    if(!experts.length) return list;
    // De-dupe: prefer the localStorage expert entries (they own the lastMsg
    // / lastTime fields for mock-expert threads).
    var byId = {};
    list.forEach(function(c){ if(c && c.convId) byId[c.convId] = c; });
    experts.forEach(function(e){ if(e && e.convId) byId[e.convId] = e; });
    var merged = Object.keys(byId).map(function(k){ return byId[k]; });
    merged.sort(function(a,b){
      var ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
      var tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
      return tb - ta;
    });
    return merged;
  }

  var userConvosS=useState(function(){
    try{
      var cc=localStorage.getItem('convos_'+myId);
      if(cc){
        var parsed = JSON.parse(cc);
        // Drop the cache if (a) most entries are stale "User" placeholders, OR
        // (b) most entries are missing avatars but localStorage has them — that means
        // the cache was written before we started cross-caching other users' avatars.
        var staleName = parsed.filter(function(c){return !c.name||c.name==='User';}).length;
        var missingAvatar = 0;
        parsed.forEach(function(c){
          if(!c.img && c.otherId){
            try { if (localStorage.getItem('avatar_'+c.otherId)) missingAvatar++; } catch(e){}
          }
        });
        if((staleName > 0 && staleName >= parsed.length/2) || (missingAvatar > 0 && missingAvatar >= parsed.length/2)){
          try{localStorage.removeItem('convos_'+myId);}catch(e){}
          return [];
        }
        // Hydrate missing avatars from per-user localStorage cache
        parsed = parsed.map(function(c){
          if(!c.img && c.otherId){
            try { var av = localStorage.getItem('avatar_'+c.otherId); if(av) c.img = av; } catch(e){}
          }
          return c;
        });
        return mergeExpertConvos(parsed);
      }
    }catch(e){}
    return mergeExpertConvos([]);
  }); var userConvos=userConvosS[0]; var setUserConvos=userConvosS[1];
  var unreadS=useState({}); var unread=unreadS[0]; var setUnread=unreadS[1];
  var _hasCachedConvos=(function(){try{var cc=localStorage.getItem('convos_'+myId);return !!(cc&&JSON.parse(cc).length);}catch(e){return false;}})();
  var loadingConvosS=useState(!_hasCachedConvos); var loadingConvos=loadingConvosS[0]; var setLoadingConvos=loadingConvosS[1];
  // Tabs at top of inbox — Insta Reels/Friends pattern. Filters which
  // conversations show in the list below.
  //   'friends'  → real user-to-user chats (no expert/business role)
  //   'experts'  → expert profile chats (users with role='expert')
  //   'business' → business profile chats (users with role='business')
  var tabS = useState('friends'); var activeTab = tabS[0]; var setActiveTab = tabS[1];
  var typingTimerRef=useRef(null);
  // FIX #4: mirror `active` to a ref so the inbox INSERT realtime handler
  // can read it synchronously without wrapping the side-effect-laden state
  // updates inside setActive(currentActive => ...). That pattern violates
  // updater purity and double-fires in React StrictMode.
  var activeRef=useRef(null);
  useEffect(function(){ activeRef.current = active; },[active]);
  // R15 FIX #3: mirror inboxRestrictedSet into a ref so the inbox channel
  // useEffect (deps [myId]) sees the freshest set after a restrict toggle.
  // Without this the inbox INSERT handler reads a stale snapshot captured
  // when the channel was first subscribed.
  var inboxRestrictedSetRef=useRef(new Set());
  useEffect(function(){ inboxRestrictedSetRef.current = inboxRestrictedSet; },[inboxRestrictedSet]);
  // FIX #7: warm up the server-side blocks cache (blocks.js) so the send()
  // guard in ChatBox has fresh data the first time it runs.
  useEffect(function(){
    if (!myId) return;
    try { loadBlocks(myId); } catch(_) {}
  },[myId]);
  var totalUnreadS=useState(function(){
    try{ var cc=localStorage.getItem('convos_'+myId); if(cc){var c=JSON.parse(cc);return c.reduce(function(s,x){return s+(x.unreadCount||0);},0);} }catch(e){}
    return 0;
  }); var totalUnread=totalUnreadS[0]; var setTotalUnread=totalUnreadS[1];

  useEffect(function(){
    if(props.initConvo){
      setActive(props.initConvo);
      if(props.onConvoConsumed) props.onConvoConsumed();
    }
  },[props.initConvo]);

  // Android back / edge-swipe handler — if a chat is open, close it back
  // to the inbox before App.js's goBack moves us off the Messages tab.
  // Consumes the cancelable 'ringin:back' event so the tab nav doesn't fire.
  useEffect(function(){
    function onBack(ev){
      if (active) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setActive(null);
      }
    }
    window.addEventListener('ringin:back', onBack);
    return function(){ window.removeEventListener('ringin:back', onBack); };
  }, [active]);

  // Refresh conversations when user comes back to tab (don't remove channels — ChatBox manages its own)
  useEffect(function(){
    function handleVisibility(){
      if(document.visibilityState==='visible' && myId){
        refreshConvos();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return function(){document.removeEventListener('visibilitychange', handleVisibility);};
  },[myId]);

  useEffect(function(){
    if(!myId) return;
    // Get all messages where I am sender or receiver
    sb.from('messages').select('*').or('sender_id.eq.'+myId+',receiver_id.eq.'+myId).order('created_at',{ascending:false}).then(function(res){
      setLoadingConvos(false);
      if(!res.data||res.data.length===0) return;
      // FIX #8: only drop mock expert convo IDs (e1, e2, e3…). The old
      // startsWith('e') filter killed every UUID starting with 'e'.
      res.data = res.data.filter(function(m){
        if(!m.conversation_id) return false;
        if(typeof m.conversation_id === 'string' && /^e\d+$/.test(m.conversation_id)) return false;
        return true;
      });
      if(!res.data) return;
      // Group by conversation_id
      var convMap = {};
      res.data.forEach(function(m){
        if(!convMap[m.conversation_id]){
          convMap[m.conversation_id] = {
            id: m.conversation_id,
            convId: m.conversation_id,
            lastMsg: m.text,
            lastTime: m.created_at,
            unreadCount: 0,
            otherId: m.sender_id===myId ? m.receiver_id : m.sender_id,
            otherName: m.sender_id===myId ? '' : (m.sender_name||''),
          };
        } else if(!convMap[m.conversation_id].otherName && m.sender_id!==myId && m.sender_name){
          // Capture the other person's name from any of their messages (latest may be mine)
          convMap[m.conversation_id].otherName = m.sender_name;
        }
        if(!m.read && m.sender_id!==myId) convMap[m.conversation_id].unreadCount++;
      });

      // Load profiles for each conversation
      var convList = Object.values(convMap);
      var otherIds = convList.map(function(c){return c.otherId;}).filter(Boolean);
      if(otherIds.length===0) return;

      sb.from('profiles').select('*').in('id',otherIds).then(function(pr){
        var profileMap = {};
        if(pr.data) pr.data.forEach(function(p){profileMap[p.id]=p;});
        var enriched = convList.map(function(c){
          var prof = profileMap[c.otherId]||{};
          // Name fallback: full_name → sender_name (from messages) → email → 'User'
          var senderPrefix = c.otherName && c.otherName.indexOf('@')>=0 ? c.otherName.split('@')[0] : c.otherName;
          var emailPrefix = prof.email && prof.email.indexOf('@')>=0 ? prof.email.split('@')[0] : prof.email;
          var displayName = (prof.full_name && prof.full_name.trim()) || (senderPrefix && senderPrefix.trim()) || (emailPrefix && emailPrefix.trim()) || 'User';
          // Avatar fallback: DB avatar_url → previously-cached avatar for this user in localStorage.
          // We cache other users' avatars under `avatar_<userId>` so subsequent loads still show
          // their photo even if RLS blocks avatar_url or the column comes back null.
          var dbAvatar = prof.avatar_url || null;
          var cachedAvatar = null;
          try { cachedAvatar = localStorage.getItem('avatar_'+c.otherId); } catch(e){}
          var finalAvatar = dbAvatar || cachedAvatar || null;
          // Refresh the cache when DB has a newer URL
          if (dbAvatar) { try { localStorage.setItem('avatar_'+c.otherId, dbAvatar); } catch(e){} }
          return Object.assign({},c,{
            name: displayName,
            img: finalAvatar,
            isOnline: prof.is_online||false,
            color: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
            initials: displayName.substring(0,2).toUpperCase(),
            receiverId: c.otherId,
          });
        });
        try{localStorage.setItem('convos_'+myId, JSON.stringify(enriched));}catch(e){}
        // Merge in mock-expert conversations driven by Moments likes/replies
        // — these are localStorage-only and would otherwise be wiped out by
        // this Supabase-derived setter.
        setUserConvos(mergeExpertConvos(enriched));
        // Count total unread
        var total = enriched.reduce(function(sum,c){return sum+(c.unreadCount||0);},0);
        setTotalUnread(total);
        if(props.onUnreadCount) props.onUnreadCount(total);
      });
    });

    // Realtime - new message notification
    // FIX #4: read currentActive synchronously from activeRef instead of
    // wrapping the side effects inside setActive(updater). The updater
    // pattern was double-firing in React StrictMode, double-bumping unread.
    var ch = sb.channel('inbox-'+myId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'receiver_id=eq.'+myId},function(p){
        var currentActive = activeRef.current;
        var isViewingThisConvo = currentActive && (currentActive.convId===p.new.conversation_id || currentActive.id===p.new.conversation_id);
        // RESTRICT enforcement at inbox layer — silent badge bump only,
        // no badge/sound for messages from restricted users.
        // R15 FIX #3: read via ref (channel useEffect deps are [myId]).
        var _irs = inboxRestrictedSetRef.current;
        var senderRestricted = _irs && _irs.has && _irs.has(p.new.sender_id);
        if(!isViewingThisConvo){
          // Not viewing this chat — increment badge and unread count (skip if restricted)
          if(!senderRestricted){
            setTotalUnread(function(t){return t+1;});
            if(props.onUnreadCount) props.onUnreadCount(function(prev){return prev+1;});
          }
          setUserConvos(function(prev){
            var exists=prev.find(function(c){return c.convId===p.new.conversation_id;});
            if(exists){
              return prev.map(function(c){
                if(c.convId!==p.new.conversation_id) return c;
                // For restricted users, update preview but don't increment unread count
                return Object.assign({},c,{lastMsg:p.new.text,lastTime:p.new.created_at||c.lastTime,unreadCount:senderRestricted?(c.unreadCount||0):((c.unreadCount||0)+1)});
              });
            }
            return prev;
          });
          var mc=[];try{var ms=localStorage.getItem('ringin_muted_convos');if(ms)mc=JSON.parse(ms);}catch(e){}
          if(!senderRestricted && !mc.includes(p.new.conversation_id) && !isCallLog(p.new.text)) playSound('notification');
        } else {
          // Already viewing this chat — just update last message preview, no badge
          setUserConvos(function(prev){
            return prev.map(function(c){
              if(c.convId!==p.new.conversation_id) return c;
              return Object.assign({},c,{lastMsg:p.new.text,lastTime:p.new.created_at||c.lastTime});
            });
          });
        }
      })
      // FIX #3: messages I send don't fire the receiver_id filter above. Add
      // a sender-side chain so when I send a message (from anywhere — chat,
      // another device, etc.), the inbox preview updates. Never bumps unread.
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'sender_id=eq.'+myId},function(p){
        if (!p || !p.new) return;
        setUserConvos(function(prev){
          var exists = prev.find(function(c){ return c.convId === p.new.conversation_id; });
          if (!exists) return prev; // unknown convo — let the full refresh path pick it up
          return prev.map(function(c){
            if (c.convId !== p.new.conversation_id) return c;
            return Object.assign({}, c, { lastMsg: p.new.text, lastTime: p.new.created_at || c.lastTime });
          });
        });
      }).subscribe();
    return function(){sb.removeChannel(ch);};
  },[myId]);

  // Search users
  useEffect(function(){
    if(!search.trim()){setSearchRes([]);return;}
    sb.from('profiles').select('*').or('email.ilike.%'+search+'%,full_name.ilike.%'+search+'%').then(function(res){
      setSearchRes((res.data||[]).filter(function(u){return u.id!==myId;}));
    });
  },[search]);

  function refreshConvos(){
    if(!myId||refreshing) return;
    setRefreshing(true);
    sb.from('messages').select('*').or('sender_id.eq.'+myId+',receiver_id.eq.'+myId).order('created_at',{ascending:false}).then(function(res){
      if(!res.data){setRefreshing(false);return;}
      // FIX #8: only drop mock expert convo IDs (e1, e2, e3…). UUIDs that
      // happen to start with 'e' must pass through.
      res.data = res.data.filter(function(m){
        if(!m.conversation_id) return false;
        if(typeof m.conversation_id === 'string' && /^e\d+$/.test(m.conversation_id)) return false;
        return true;
      });
      var convMap={};
      res.data.forEach(function(m){
        if(!convMap[m.conversation_id]){
          convMap[m.conversation_id]={id:m.conversation_id,convId:m.conversation_id,lastMsg:m.text,lastTime:m.created_at,unreadCount:0,otherId:m.sender_id===myId?m.receiver_id:m.sender_id,otherName:m.sender_id===myId?'':(m.sender_name||'')};
        } else if(!convMap[m.conversation_id].otherName && m.sender_id!==myId && m.sender_name){
          convMap[m.conversation_id].otherName = m.sender_name;
        }
        if(!m.read&&m.sender_id!==myId) convMap[m.conversation_id].unreadCount++;
      });
      var convList=Object.values(convMap);
      var otherIds=convList.map(function(c){return c.otherId;}).filter(Boolean);
      if(otherIds.length===0){setRefreshing(false);return;}
      sb.from('profiles').select('*').in('id',otherIds).then(function(pr){
        var profileMap={};
        if(pr.data) pr.data.forEach(function(p){profileMap[p.id]=p;});
        var enriched=convList.map(function(c){
          var prof=profileMap[c.otherId]||{};
          var senderPrefix = c.otherName && c.otherName.indexOf('@')>=0 ? c.otherName.split('@')[0] : c.otherName;
          var emailPrefix = prof.email && prof.email.indexOf('@')>=0 ? prof.email.split('@')[0] : prof.email;
          var displayName = (prof.full_name && prof.full_name.trim()) || (senderPrefix && senderPrefix.trim()) || (emailPrefix && emailPrefix.trim()) || 'User';
          // Avatar fallback to localStorage cache; refresh cache when DB has the URL
          var dbAvatar = prof.avatar_url || null;
          var cachedAvatar = null;
          try { cachedAvatar = localStorage.getItem('avatar_'+c.otherId); } catch(e){}
          var finalAvatar = dbAvatar || cachedAvatar || null;
          if (dbAvatar) { try { localStorage.setItem('avatar_'+c.otherId, dbAvatar); } catch(e){} }
          return Object.assign({},c,{name:displayName,img:finalAvatar,isOnline:prof.is_online||false,color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',initials:displayName.substring(0,2).toUpperCase(),receiverId:c.otherId});
        });
        try{localStorage.setItem('convos_'+myId,JSON.stringify(enriched));}catch(e){}
        setUserConvos(mergeExpertConvos(enriched));
        var total=enriched.reduce(function(sum,c){return sum+(c.unreadCount||0);},0);
        setTotalUnread(total);
        if(props.onUnreadCount) props.onUnreadCount(total);
        setRefreshing(false);
      });
    });
  }

  function startConvo(user){
    var convId = [myId,user.id].sort().join('_');
    var _userEmailPrefix = user.email && user.email.indexOf('@')>=0 ? user.email.split('@')[0] : (user.email||'User');
    // Avatar: prefer fresh, fall back to localStorage cache, persist when fresh
    var _dbAvatar = user.avatar_url || null;
    var _cachedAvatar = null;
    try { _cachedAvatar = localStorage.getItem('avatar_'+user.id); } catch(e){}
    if (_dbAvatar) { try { localStorage.setItem('avatar_'+user.id, _dbAvatar); } catch(e){} }
    var convo = {
      id:convId, convId:convId,
      name:user.full_name||_userEmailPrefix||'User',
      role:user.is_online?'Online':'Member',
      isOnline:user.is_online,
      color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
      img:_dbAvatar || _cachedAvatar || null,
      initials:(user.full_name||user.email||'?').substring(0,2).toUpperCase(),
      receiverId:user.id,
    };
    setShowNew(false);
    setSearch('');
    setActive(convo);
  }

  function formatTime(date){
    var d = date ? new Date(date) : new Date();
    var now = new Date();
    var diff = Math.floor((now-d)/1000);
    if(diff<60) return 'Just now';
    if(diff<3600) return Math.floor(diff/60)+'m ago';
    if(diff<86400) return Math.floor(diff/3600)+'h ago';
    return d.toLocaleDateString([],{month:'short',day:'numeric'});
  }

  function handleMessageSent(convo, text){
    // Update user convos and persist to localStorage
    setUserConvos(function(prev){
      var updated;
      var exists = prev.find(function(c){return c.convId===convo.convId;});
      if(exists){
        updated = prev.map(function(c){
          if(c.convId!==convo.convId) return c;
          return Object.assign({},c,{lastMsg:text,lastTime:new Date().toISOString()});
        });
      } else {
        updated = [Object.assign({},convo,{lastMsg:text,unreadCount:0,lastTime:new Date().toISOString()})].concat(prev);
      }
      try{localStorage.setItem('convos_'+myId, JSON.stringify(updated));}catch(e){}
      return updated;
    });
    // Update expert convos
    setExpertConvos(function(prev){
      return prev.map(function(c){
        if(c.id!==convo.id) return c;
        return Object.assign({},c,{last:'You: '+text,time:'Just now'});
      });
    });
  }

  // FIX #9: pass the real `coinBal` from the hook instead of the deleted
  // `coins` stub state. `onCoinsChange` is a no-op — CallScreen now
  // broadcasts via setSharedCoinBalance, which the hook auto-listens for,
  // so we don't need a setter callback. (This local CallScreen render is
  // a fallback; the App-level path through window.__ringInStartCall is
  // the primary one.)
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,session:session,coins:coinBal,onCoinsChange:function(){},onEnd:function(){setActiveCall(null);}});
  if(active) return React.createElement(ChatBox,{convo:active,session:session,onBack:function(){setActive(null);},onViewExpert:props.onViewExpert,onViewUser:props.onViewUser,onCall:function(exp){
    // CRITICAL: prefer the actual user UUID fields (otherId/receiverId/user_id) over `id`,
    // because convo.id is the conversation_id (e.g. "userA_userB"), NOT a UUID. Using it
    // as callee_id would fail the Supabase insert with "invalid input syntax for type uuid".
    var realUserId = exp.user_id || exp.otherId || exp.receiverId || exp.id;
    var target = Object.assign({}, exp, {id: realUserId});
    if(typeof window !== 'undefined' && window.__ringInStartCall) window.__ringInStartCall(target, {rate: exp.rate||30});
    else setActiveCall(exp);
  },onMessageSent:handleMessageSent});

  // FIX #8: PTR handlers were on the outer flex container which has no
  // overflow:auto, so e.currentTarget.scrollTop was always 0 — the "scrolled
  // to top" guard always passed, and the inner inbox scroller never got the
  // touch events. Handlers are now mounted on the inner scrolling div
  // (line ~2051 — `flex:1,overflowY:'auto'`).
  return React.createElement('div',{
    style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'},
  },
    // Header
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px',gap:'8px'}},
      React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'26px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Messages'),
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'6px'}},
        // + New message — moved to LEFT of the coin chip
        React.createElement('button',{onClick:function(){setShowNew(!showNew);},title:'New message',style:{width:'30px',height:'30px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+'),
        React.createElement('div',{onClick:function(){if(props.onOpenWallet)props.onOpenWallet();},style:{display:'flex',alignItems:'center',gap:'5px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'4px 10px',fontSize:'12px',color:'var(--text)',cursor:'pointer'}},
          React.createElement('div',{style:{width:'15px',height:'15px',borderRadius:'50%',background:'linear-gradient(135deg,#F5A623,#f97316)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7px',color:'#fff',fontWeight:700}},'C'),
          React.createElement('span',null,(Number(coinBal)||0).toLocaleString())
        ),
        React.createElement(TopBarAvatar, {
          session: props.session,
          onClick: function(){ if(props.onOpenProfile) props.onOpenProfile(); },
        })
      )
    ),
    pullDist>20||refreshing ? React.createElement('div',{style:{textAlign:'center',padding:'8px',fontSize:'12px',color:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}},
      refreshing ? React.createElement('div',{style:{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid var(--ac)',borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}) : '↓',
      refreshing ? 'Refreshing...' : pullDist>50 ? 'Release to refresh' : 'Pull to refresh'
    ) : null,
    // New message search
    showNew ? React.createElement('div',{style:{padding:'0 18px 10px',borderBottom:'1px solid var(--border)'}},
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'8px 12px',display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}},
        React.createElement('span',{style:{color:'var(--t3)',fontSize:'14px'}},'🔍'),
        // R13 FIX #6: people-search input — "Search" return key, no autocaps,
        // no autocorrect (names get mangled by autocorrect, e.g. "Joao"→"Jean").
        React.createElement('input',{autoFocus:true,placeholder:'Search people...',value:search,onChange:function(e){setSearch(e.target.value);},enterKeyHint:'search',autoCapitalize:'none',autoCorrect:'off',style:{flex:1,background:'none',border:'none',outline:'none',fontSize:'13px',color:'var(--text)',fontFamily:'DM Sans,sans-serif'}})
      ),
      searchRes.map(function(u,i){
        return React.createElement('div',{key:i,onClick:function(){startConvo(u);},style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px',borderRadius:'10px',cursor:'pointer',background:'var(--bg3)',marginBottom:'6px'}},
          React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0,position:'relative'}},
            u.avatar_url ? React.createElement('img',{src:u.avatar_url,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (u.full_name||u.email||'?').substring(0,2).toUpperCase(),
            u.is_online ? React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'10px',height:'10px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)'}}) : null
          ),
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},(u.full_name||u.email||'').split('@')[0]),
            React.createElement('div',{style:{fontSize:'11px',color:u.is_online?'var(--green)':'var(--t2)'}},u.is_online?'Online':'Member')
          )
        );
      })
    ) : null,
    // Tabs — Friends / Experts / Business (Instagram Reels/Friends style)
    React.createElement('div',{
      style:{
        display:'flex', justifyContent:'center', alignItems:'center',
        gap:'24px', padding:'6px 18px 12px',
        borderBottom:'1px solid var(--border)',
      }
    },
      ['friends','experts','groups','business'].map(function(tab){
        var labels = { friends:'Friends', experts:'Experts', groups:'Groups', business:'Business' };
        var isActive = activeTab === tab;
        return React.createElement('button',{
          key:tab,
          onClick:function(){ setActiveTab(tab); },
          style:{
            background:'none', border:'none',
            padding:'6px 2px', cursor:'pointer',
            fontFamily:'inherit',
            fontSize:'15px',
            fontWeight: isActive ? 800 : 600,
            color: isActive ? 'var(--text)' : 'var(--t3)',
            position:'relative',
            letterSpacing:'-0.2px',
            transition:'color 180ms',
          }
        },
          labels[tab],
          isActive ? React.createElement('div',{
            style:{
              position:'absolute', left:'50%', bottom:'-12px',
              transform:'translateX(-50%)',
              width:'30px', height:'3px',
              borderRadius:'2px',
              background:'linear-gradient(90deg,#7B6EFF,#E84D9A)',
            }
          }) : null
        );
      })
    ),
    // Conversations
    React.createElement('div',{
      style:{flex:1,overflowY:'auto',padding:'0 16px'},
      // FIX #8: PTR handlers moved here from the outer container so
      // e.currentTarget.scrollTop reflects the actual scroll position.
      onTouchStart:function(e){
        if(refreshing) return;
        // Only arm PTR when we're already scrolled to the very top of the
        // inbox container. Otherwise swipe-down should keep scrolling content.
        var sc = e.currentTarget;
        if (sc && sc.scrollTop > 0) return;
        var t = e.touches && e.touches[0]; if(!t) return;
        setPullStart(t.clientY);
      },
      onTouchMove:function(e){
        if(refreshing||!pullStart) return;
        var t = e.touches && e.touches[0]; if(!t) return;
        var d = t.clientY - pullStart;
        if (d > 0) setPullDist(Math.min(d, 120));
      },
      onTouchEnd:function(){
        if(refreshing) return;
        if (pullDist > 50) { refreshConvos(); }
        setPullStart(0);
        setPullDist(0);
      },
    },
      loadingConvos ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'People'),
        [0,1,2].map(function(i){
          return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 0',borderBottom:'1px solid var(--border)'}},
            React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:'var(--bg3)',flexShrink:0,animation:'shimmer 1.4s ease-in-out infinite'}}),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{height:'12px',borderRadius:'6px',background:'var(--bg3)',width:'50%',marginBottom:'7px',animation:'shimmer 1.4s ease-in-out infinite'}}),
              React.createElement('div',{style:{height:'10px',borderRadius:'6px',background:'var(--bg3)',width:'75%',animation:'shimmer 1.4s ease-in-out infinite'}})
            )
          );
        })
      ) : null,
      // Real user conversations — only on the FRIENDS tab
      activeTab === 'friends' && !loadingConvos && userConvos.length>0 ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'People'),
        userConvos.map(function(c){
          // Helper to open the other user's profile from avatar/name clicks
          function openTheirProfile(ev){
            if(ev) ev.stopPropagation();
            var otherUid = c.otherId || c.receiverId || c.user_id;
            if(!otherUid || !props.onViewUser) return;
            props.onViewUser({
              id: otherUid,
              full_name: c.name,
              avatar_url: c.img,
              email: c.email || null,
              is_online: !!c.isOnline,
            });
          }
          return React.createElement('div',{key:c.id,onClick:function(){
            setActive(c);
            setUserConvos(function(prev){return prev.map(function(p){return p.id===c.id?Object.assign({},p,{unreadCount:0}):p;});});
            setTotalUnread(function(t){return Math.max(0,t-(c.unreadCount||0));});
            if(props.onUnreadCount) props.onUnreadCount(function(prev){return Math.max(0,prev-(c.unreadCount||0));});
          },style:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
            React.createElement('div',{onClick:openTheirProfile,style:{position:'relative',flexShrink:0,cursor:'pointer'}},
              React.createElement(AvatarRing,{ show: momentUserIds.has(c.otherId || c.receiverId || c.user_id) },
                React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',overflow:'hidden'}},
                  c.img ? React.createElement('img',{src:c.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : c.initials
                )
              ),
              c.isOnline ? React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'11px',height:'11px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)',zIndex:1}}) : null
            ),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'2px',alignItems:'center'}},
                React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'5px',minWidth:0}},
                  React.createElement('span',{onClick:openTheirProfile,style:{fontSize:'13px',fontWeight:c.unreadCount>0?700:600,color:'var(--text)',cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},c.name),
                  // Mute icon — shows when this conversation is in ringin_muted_convos.
                  // Matches Instagram / WhatsApp inbox convention.
                  inboxMutedConvos.indexOf(c.convId||c.id) >= 0 ? React.createElement('span',{title:'Notifications muted',style:{fontSize:'11px',color:'var(--t3)',flexShrink:0,lineHeight:1}},'🔕') : null
                ),
                React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)',flexShrink:0,marginLeft:'6px'}},c.lastTime?timeAgo(c.lastTime):'')
              ),
              React.createElement('div',{style:{fontSize:'11px',color:c.unreadCount>0?'var(--text)':'var(--t3)',fontWeight:c.unreadCount>0?600:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
                (function(){
                  var lm = c.lastMsg;
                  if(!lm) return 'Start a conversation';
                  if(isCallLog(lm)) return previewCallLog(parseCallLog(lm), myId);
                  if(typeof lm==='string' && lm.indexOf('[img]')===0) return '📷 Photo';
                  // FIX #2: inbox preview for shared moment
                  if(typeof lm==='string' && lm.indexOf('[mshare]')===0) return '✨ Shared a moment';
                  if(typeof lm==='string' && lm.indexOf('[mlike]')===0) return '❤️ Liked your status';
                  if(typeof lm==='string' && lm.indexOf('[mreply]')===0){
                    var body=lm.slice(8); var sep=body.indexOf('|');
                    return '↩️ ' + (sep>=0?body.slice(sep+1):body);
                  }
                  return lm;
                })()
              )
            ),
            c.unreadCount>0 ? React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff',flexShrink:0}},c.unreadCount>9?'9+':c.unreadCount) : null,
            // Call button on each row — stop propagation so it doesn't open the chat
            React.createElement('button',{
              onClick:function(e){e.stopPropagation();
                var target = Object.assign({},c,{id: c.otherId||c.receiverId||c.id, rate:c.rate||30});
                if(typeof window!=='undefined' && window.__ringInStartCall) window.__ringInStartCall(target,{rate:c.rate||30});
                else setActiveCall(target);
              },
              title:'Call',
              style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:'4px'}
            },
              React.createElement('svg',{viewBox:'0 0 24 24',width:'14',height:'14',fill:'none',stroke:'currentColor',strokeWidth:'2.4',strokeLinecap:'round',strokeLinejoin:'round'},
                React.createElement('path',{d:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11L8.09 10.18a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z'})
              )
            )
          );
        })
      ) : null,
      // Expert conversations — only on the EXPERTS tab
      activeTab === 'experts' ? React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',padding:'10px 0 6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Experts') : null,
      activeTab === 'experts' ? expertConvos.map(function(c){
        return React.createElement('div',{key:c.id,onClick:function(){setActive(c);},style:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
          React.createElement('div',{style:{position:'relative',flexShrink:0}},
            React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:c.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',overflow:'hidden'}},
              c.img ? React.createElement('img',{src:c.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : c.initials
            ),
            React.createElement('div',{style:{position:'absolute',bottom:'1px',right:'1px',width:'11px',height:'11px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg)'}})
          ),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'2px'}},
              React.createElement('span',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},c.name),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.time)
            ),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:'2px'}},c.last||'Tap to start chatting')
          ),
          c.unread>0 ? React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff',flexShrink:0}},c.unread) : null,
          // Call button on each expert row
          React.createElement('button',{
            onClick:function(e){e.stopPropagation();
              // Expert-row call. NOTE: expert mock IDs (e1, e2, e3) are NOT real Supabase user ids,
              // so window.__ringInStartCall would fail RLS on the insert. Keep local fallback for experts.
              var isMockExpert = typeof c.id==='string' && c.id.indexOf('e')===0;
              if(!isMockExpert && typeof window!=='undefined' && window.__ringInStartCall) window.__ringInStartCall(c,{rate:c.rate||30});
              else setActiveCall(c);
            },
            title:'Call',
            style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:'4px'}
          },
            React.createElement('svg',{viewBox:'0 0 24 24',width:'14',height:'14',fill:'none',stroke:'currentColor',strokeWidth:'2.4',strokeLinecap:'round',strokeLinejoin:'round'},
              React.createElement('path',{d:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11L8.09 10.18a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z'})
            )
          )
        );
      }) : null,
      // Empty state for Groups tab (group conversations not wired up yet).
      activeTab === 'groups' ? React.createElement('div',{
        style:{
          textAlign:'center', padding:'60px 24px',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
        }
      },
        React.createElement('div',{style:{width:'56px',height:'56px',borderRadius:'16px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'26px'}}, '👥'),
        React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'var(--text)'}}, 'Groups coming soon'),
        React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',maxWidth:'260px',lineHeight:1.5}}, 'Chat with multiple people at once. Sit tight — group chats are on the way.')
      ) : null,
      // Empty state for Business tab (no business accounts wired up yet).
      activeTab === 'business' ? React.createElement('div',{
        style:{
          textAlign:'center', padding:'60px 24px',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
        }
      },
        React.createElement('div',{style:{width:'56px',height:'56px',borderRadius:'16px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'26px'}}, '🏢'),
        React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'var(--text)'}}, 'Business chats coming soon'),
        React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',maxWidth:'260px',lineHeight:1.5}}, 'When verified businesses send you messages, they will land here.')
      ) : null,
      // Empty state for Friends tab when there are no real user chats yet
      activeTab === 'friends' && !loadingConvos && userConvos.length === 0 ? React.createElement('div',{
        style:{textAlign:'center', padding:'60px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}
      },
        React.createElement('div',{style:{width:'56px',height:'56px',borderRadius:'16px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'26px'}}, '👥'),
        React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'var(--text)'}}, 'No conversations yet'),
        React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',maxWidth:'260px',lineHeight:1.5}}, 'Tap + at the top to start a chat with someone.')
      ) : null
    )
  );
}
