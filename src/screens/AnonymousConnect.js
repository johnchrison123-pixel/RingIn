/* eslint-disable */
import React, {useState, useRef, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastError, toastInfo} from '../utils/toast';
import {ANON_AVATARS, getAvatar} from '../utils/anonAvatars'; /* R37: single source of truth */

/* R47: virtual gift catalog (Tango/Bigo-style 3-tier model).
 * - sticker: small cheap reactions (10-25 coins)
 * - premium: signature gifts (50-200 coins)
 * - mega: full-screen celebration gifts (500-2000 coins)
 * Recipient earns 70% of every gift in coins. */
var GIFT_CATALOG = [
  /* Tier: sticker */
  { key:'wave',  emoji:'👋', name:'Wave',     tier:'sticker', coins:10 },
  { key:'heart', emoji:'❤️', name:'Heart',    tier:'sticker', coins:15 },
  { key:'rose',  emoji:'🌹', name:'Rose',     tier:'sticker', coins:25 },
  /* Tier: premium */
  { key:'cake',  emoji:'🎂', name:'Cake',     tier:'premium', coins:50 },
  { key:'kiss',  emoji:'💋', name:'Kiss',     tier:'premium', coins:100 },
  { key:'crown', emoji:'👑', name:'Crown',    tier:'premium', coins:200 },
  /* Tier: mega */
  { key:'car',     emoji:'🏎',  name:'Sports Car', tier:'mega', coins:500 },
  { key:'castle',  emoji:'🏰', name:'Castle',    tier:'mega', coins:1000 },
  { key:'diamond', emoji:'💎', name:'Diamond',   tier:'mega', coins:2000 },
];
function getGiftByKey(k){ return GIFT_CATALOG.find(function(g){ return g.key === k; }) || null; }

// Inject pulse keyframes once
if (typeof document !== 'undefined' && !document.getElementById('ringin-pulse-kf')) {
  var s = document.createElement('style');
  s.id = 'ringin-pulse-kf';
  s.textContent = '@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:0.85}}';
  document.head.appendChild(s);
}

export default function AnonymousConnect(props) {
  var session = props.session;
  var onBack = props.onBack;
  var userId = session && session.user ? session.user.id : null;

  var interestsS = useState([]); var interests = interestsS[0]; var setInterests = interestsS[1];
  var inputS = useState(''); var input = inputS[0]; var setInput = inputS[1];
  var geoS = useState(true); var sameGeo = geoS[0]; var setSameGeo = geoS[1];
  var searchingS = useState(false); var searching = searchingS[0]; var setSearching = searchingS[1];
  /* R37: removed the dead `match` preview state. We auto-connect on match
   * (Omegle/FRND-style). Post-call sheet handles Add Connection / Next. */
  var excludeS = useState([]); var exclude = excludeS[0]; var setExclude = excludeS[1];
  var errS = useState(null); var err = errS[0]; var setErr = errS[1];
  /* R37: post-call sheet — bottom drawer that pops up when an anon call
   * ends so the user can Add Connection / Find Next / Block + Report. */
  var postCallS = useState(null); var postCall = postCallS[0]; var setPostCall = postCallS[1];
  /* R29: countdown shown during the 30-sec search window so the user sees
   * "Searching... 24s left" rather than a static spinner. */
  var secsLeftS = useState(30); var secsLeft = secsLeftS[0]; var setSecsLeft = secsLeftS[1];
  /* Refs to poll-interval + countdown-interval so we can cancel cleanly
   * on unmount / skip / match-found / user cancel. */
  var pollRef = useRef(null);
  var countdownRef = useRef(null);
  var deadlineRef = useRef(0);
  /* R30: availability toggle + live count of who's online. FRND-style. */
  var availableS = useState(false); var available = availableS[0]; var setAvailable = availableS[1];
  var availTogglingS = useState(false); var availToggling = availTogglingS[0]; var setAvailToggling = availTogglingS[1];
  var onlineCountS = useState(0); var onlineCount = onlineCountS[0]; var setOnlineCount = onlineCountS[1];
  var countPollRef = useRef(null);
  var heartbeatRef = useRef(null);
  /* R31/R32: anonymous identity. Gender now comes from REAL profile
   * (profiles.gender) — set during onboarding, displayed but not editable
   * in the anon screen. Other fields stay editable. */
  var nickS = useState(''); var nick = nickS[0]; var setNick = nickS[1];
  var avatarIdS = useState('girl1'); var avatarId = avatarIdS[0]; var setAvatarId = avatarIdS[1];
  var genderS = useState('f'); var gender = genderS[0]; var setGender = genderS[1];
  var preferenceS = useState('both'); var preference = preferenceS[0]; var setPreference = preferenceS[1];
  var profileSavedRef = useRef(false);
  var saveProfileTimerRef = useRef(null);
  /* R32: onboarding wizard state. Shown once on first Anonymous Connect open. */
  var onboardedS = useState(true); var onboarded = onboardedS[0]; var setOnboarded = onboardedS[1];
  var checkingOnboardS = useState(true); var checkingOnboard = checkingOnboardS[0]; var setCheckingOnboard = checkingOnboardS[1];
  var obGenderS = useState(''); var obGender = obGenderS[0]; var setObGender = obGenderS[1];
  var obNickS = useState(''); var obNick = obNickS[0]; var setObNick = obNickS[1];
  var obAvatarS = useState(''); var obAvatar = obAvatarS[0]; var setObAvatar = obAvatarS[1];
  var obPrefS = useState('both'); var obPref = obPrefS[0]; var setObPref = obPrefS[1];
  var obSubmittingS = useState(false); var obSubmitting = obSubmittingS[0]; var setObSubmitting = obSubmittingS[1];
  /* R37: obStep state removed — never used. */
  /* R33: 4-tab structure (Connections / Messages / Call Logs / Profile).
   * Default landing tab is connections (where Find Someone + connection
   * list live). Profile is where the identity + preferences + interests
   * get edited. */
  var activeTabS = useState('connections'); var activeTab = activeTabS[0]; var setActiveTab = activeTabS[1];
  var connectionsS = useState([]); var connections = connectionsS[0]; var setConnections = connectionsS[1];
  var pendingReqsS = useState([]); var pendingReqs = pendingReqsS[0]; var setPendingReqs = pendingReqsS[1];
  var lastMatchPartnerS = useState(null); var lastMatchPartner = lastMatchPartnerS[0]; var setLastMatchPartner = lastMatchPartnerS[1];
  var connReqSendingS = useState(false); var connReqSending = connReqSendingS[0]; var setConnReqSending = connReqSendingS[1];
  var connectionsPollRef = useRef(null);

  /* R34: extended anonymous profile fields (caption, languages, from). The
   * Profile tab now renders as a real profile view (avatar + nickname +
   * caption + chips) with an Edit Profile button that opens a modal. */
  var captionS = useState(''); var caption = captionS[0]; var setCaption = captionS[1];
  var languagesS = useState([]); var languages = languagesS[0]; var setLanguages = languagesS[1];
  var fromLocS = useState(''); var fromLoc = fromLocS[0]; var setFromLoc = fromLocS[1];
  var langInputS = useState(''); var langInput = langInputS[0]; var setLangInput = langInputS[1];
  var editProfileOpenS = useState(false); var editProfileOpen = editProfileOpenS[0]; var setEditProfileOpen = editProfileOpenS[1];
  /* R34: profile-view modal for tapping a connection (their avatar + bio). */
  var viewingProfileS = useState(null); var viewingProfile = viewingProfileS[0]; var setViewingProfile = viewingProfileS[1];
  /* R34: call logs */
  var callLogsS = useState([]); var callLogs = callLogsS[0]; var setCallLogs = callLogsS[1];

  /* R45: Anonymous messaging state.
   *  - anonConvos: list of conversation rows (one per connection) with last
   *    message + unread count, sorted by last_message_at desc.
   *  - activeChat: { partner_id, nickname, avatar, gender, is_online } —
   *    when set, the Messages tab renders a chat view for this partner.
   *    Null = show conversation list.
   *  - chatMessages: rows from anon_messages for the active chat (asc by
   *    created_at so the bubble feed reads bottom-up like every chat app).
   *  - chatInput: composer text. */
  var anonConvosS = useState([]); var anonConvos = anonConvosS[0]; var setAnonConvos = anonConvosS[1];
  var activeChatS = useState(null); var activeChat = activeChatS[0]; var setActiveChat = activeChatS[1];
  var chatMessagesS = useState([]); var chatMessages = chatMessagesS[0]; var setChatMessages = chatMessagesS[1];
  var chatInputS = useState(''); var chatInput = chatInputS[0]; var setChatInput = chatInputS[1];
  var chatSendingS = useState(false); var chatSending = chatSendingS[0]; var setChatSending = chatSendingS[1];
  var anonConvosPollRef = useRef(null);
  var chatRealtimeRef = useRef(null);
  var chatScrollRef = useRef(null);

  /* R46: Modern Block/Report bottom-sheet state.
   *   - safetySheetFor:  { partner_id, nickname, avatar, context }
   *                      context = 'call' | 'connection' | 'profile' | 'message'
   *                      Setting this non-null opens the first-level sheet.
   *   - reportSheetFor:  same shape; opens the reason-picker after Report is tapped
   *   - reportSendingFor: post id being reported (disables Send button while in-flight)
   * Both sheets dismiss to null on backdrop/cancel tap, Hardware-back, or after action. */
  var safetySheetForS = useState(null); var safetySheetFor = safetySheetForS[0]; var setSafetySheetFor = safetySheetForS[1];
  var reportSheetForS = useState(null); var reportSheetFor = reportSheetForS[0]; var setReportSheetFor = reportSheetForS[1];
  var reportSendingS = useState(false); var reportSending = reportSendingS[0]; var setReportSending = reportSendingS[1];

  /* R47: chat gifts + reactions state.
   *  - giftDrawerOpen: toggles the slide-up gift picker in chat
   *  - giftSendingKey: which gift is mid-send (disables tile)
   *  - chatGifts: gift rows from anon_chat_gifts for the active chat
   *  - chatReactions: { message_id: [{emoji, count, mine}, ...] }
   *  - reactionPickerFor: message_id currently showing the 5-emoji picker */
  var giftDrawerOpenS = useState(false); var giftDrawerOpen = giftDrawerOpenS[0]; var setGiftDrawerOpen = giftDrawerOpenS[1];
  var giftSendingKeyS = useState(null); var giftSendingKey = giftSendingKeyS[0]; var setGiftSendingKey = giftSendingKeyS[1];
  var chatGiftsS = useState([]); var chatGifts = chatGiftsS[0]; var setChatGifts = chatGiftsS[1];
  var chatReactionsS = useState({}); var chatReactions = chatReactionsS[0]; var setChatReactions = chatReactionsS[1];
  var reactionPickerForS = useState(null); var reactionPickerFor = reactionPickerForS[0]; var setReactionPickerFor = reactionPickerForS[1];

  function addLanguage(l){
    var v = (l || '').trim();
    if (!v) { setLangInput(''); return; }
    /* R37: case-insensitive dedup — "English" and "english" should be one. */
    var lower = v.toLowerCase();
    var dupe = languages.some(function(x){ return x.toLowerCase() === lower; });
    if (!dupe) setLanguages(languages.concat([v]));
    setLangInput('');
  }
  function removeLanguage(l){ setLanguages(languages.filter(function(x){ return x !== l; })); }
  function onLangInputChange(e){
    var raw = e.target.value;
    if (raw.length > 0 && raw.endsWith(' ')) { var w = raw.trim(); if (w) addLanguage(w); return; }
    setLangInput(raw);
  }

  /* R45: load conversation list (one row per connection with last msg + unread).
   * Called on Messages-tab open + every 15s while that tab is active +
   * after every send/receive. Forward-compatible — silently no-ops if
   * migration 0028 hasn't been pasted yet. */
  function loadAnonConvos(){
    if (!userId) return;
    try {
      sb.rpc('list_anon_conversations').then(function(r){
        if (r && !r.error && Array.isArray(r.data)) setAnonConvos(r.data);
      }).catch(function(){});
    } catch(_){}
  }

  /* R45: load chat history for the active conversation.
   * R47: also load gifts + reactions for the chat. */
  function loadAnonChat(partnerId){
    if (!partnerId) return;
    try {
      sb.rpc('list_anon_messages', { p_partner_id: partnerId, p_limit: 200 }).then(function(r){
        if (r && !r.error && Array.isArray(r.data)) {
          setChatMessages(r.data);
          /* R47: after we have the message ids, fetch their reactions in one call. */
          var ids = r.data.map(function(m){ return m.id; }).filter(function(x){ return !!x; });
          if (ids.length > 0) {
            try {
              sb.rpc('list_anon_message_reactions', { p_message_ids: ids }).then(function(rr){
                if (rr && !rr.error && Array.isArray(rr.data)) {
                  var grouped = {};
                  rr.data.forEach(function(row){
                    if (!grouped[row.message_id]) grouped[row.message_id] = [];
                    grouped[row.message_id].push({ emoji: row.emoji, count: row.count, mine: !!row.mine });
                  });
                  setChatReactions(grouped);
                }
              }).catch(function(){});
            } catch(_){}
          } else {
            setChatReactions({});
          }
          setTimeout(function(){
            if (chatScrollRef.current) { try { chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; } catch(_){} }
          }, 50);
        }
      }).catch(function(){});
    } catch(_){}
    /* R47: load chat gifts. */
    try {
      sb.rpc('list_anon_chat_gifts', { p_partner_id: partnerId, p_limit: 200 }).then(function(r){
        if (r && !r.error && Array.isArray(r.data)) setChatGifts(r.data);
      }).catch(function(){});
    } catch(_){}
    try { sb.rpc('mark_anon_chat_read', { p_partner_id: partnerId }).then(function(){}).catch(function(){}); } catch(_){}
  }

  /* R47: send a gift in the active chat. Atomic on the server — debits +
   * credits + inserts. Refreshes gift list on success. */
  function sendChatGift(gift){
    if (!gift || !activeChat || !activeChat.partner_id) return;
    if (giftSendingKey) return;
    setGiftSendingKey(gift.key);
    sb.rpc('send_anon_chat_gift', {
      p_recipient: activeChat.partner_id,
      p_gift_key: gift.key,
      p_emoji: gift.emoji,
      p_tier: gift.tier,
      p_coins: gift.coins,
      p_message_id: null,
    }).then(function(r){
      setGiftSendingKey(null);
      if (r && r.error) { try { toastError(r.error.message || 'Gift failed'); } catch(_){} return; }
      try { toastInfo('You sent a ' + gift.emoji + ' ' + gift.name + ' (' + gift.coins + ' 🪙)'); } catch(_){}
      setGiftDrawerOpen(false);
      /* Reload the gift list so the new bubble appears. */
      if (activeChat && activeChat.partner_id) {
        try {
          sb.rpc('list_anon_chat_gifts', { p_partner_id: activeChat.partner_id, p_limit: 200 }).then(function(rr){
            if (rr && !rr.error && Array.isArray(rr.data)) setChatGifts(rr.data);
          }).catch(function(){});
        } catch(_){}
      }
      /* Scroll to bottom. */
      setTimeout(function(){
        if (chatScrollRef.current) { try { chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; } catch(_){} }
      }, 100);
    }).catch(function(){
      setGiftSendingKey(null);
      try { toastError('Network error'); } catch(_){}
    });
  }

  /* R47: toggle an emoji reaction on a message. Optimistic update + rollback. */
  function reactToMsg(messageId, emoji){
    if (!messageId || !emoji) return;
    /* Optimistic flip in chatReactions. */
    var prev = chatReactions;
    var existing = (prev[messageId] || []).slice();
    var idx = -1; for (var i=0;i<existing.length;i++) if (existing[i].emoji === emoji) { idx = i; break; }
    if (idx >= 0) {
      if (existing[idx].mine) {
        existing[idx] = Object.assign({}, existing[idx], { count: Math.max(0, existing[idx].count - 1), mine: false });
        if (existing[idx].count === 0) existing.splice(idx, 1);
      } else {
        existing[idx] = Object.assign({}, existing[idx], { count: existing[idx].count + 1, mine: true });
      }
    } else {
      existing.push({ emoji: emoji, count: 1, mine: true });
    }
    var next = Object.assign({}, prev); next[messageId] = existing;
    setChatReactions(next);
    setReactionPickerFor(null);
    sb.rpc('react_to_anon_message', { p_message_id: messageId, p_emoji: emoji }).then(function(r){
      if (r && r.error) { setChatReactions(prev); try { toastError('Reaction failed'); } catch(_){} }
    }).catch(function(){ setChatReactions(prev); });
  }

  /* R45: send a text message in the active chat. Optimistic — append to
   * chatMessages immediately, roll back if the RPC fails. */
  function sendAnonChatMessage(){
    if (chatSending || !activeChat || !activeChat.partner_id) return;
    var text = (chatInput || '').trim();
    if (!text) return;
    setChatSending(true);
    var tempId = 'tmp-' + Date.now();
    var optimistic = {
      id: tempId,
      sender_id: userId,
      receiver_id: activeChat.partner_id,
      text: text,
      read: false,
      created_at: new Date().toISOString(),
    };
    setChatMessages(function(prev){ return prev.concat([optimistic]); });
    setChatInput('');
    setTimeout(function(){
      if (chatScrollRef.current) { try { chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; } catch(_){} }
    }, 50);
    sb.rpc('send_anon_message', { p_recipient: activeChat.partner_id, p_text: text }).then(function(r){
      setChatSending(false);
      if (r && r.error) {
        /* Rollback the optimistic row + restore the draft. */
        setChatMessages(function(prev){ return prev.filter(function(m){ return m.id !== tempId; }); });
        setChatInput(text);
        try { toastError('Could not send: ' + (r.error.message || 'unknown')); } catch(_){}
        return;
      }
      /* Replace temp id with real id from server. */
      var realId = r && r.data && r.data.id;
      if (realId) {
        setChatMessages(function(prev){ return prev.map(function(m){ return m.id === tempId ? Object.assign({}, m, { id: realId }) : m; }); });
      }
      loadAnonConvos(); /* refresh last-msg preview on the list */
    }).catch(function(){
      setChatSending(false);
      setChatMessages(function(prev){ return prev.filter(function(m){ return m.id !== tempId; }); });
      setChatInput(text);
      try { toastError('Network error — try again'); } catch(_){}
    });
  }

  /* R45: open chat with a specific connection (called from the
   * connections-list 💬 button + from the conversation list). */
  function openAnonChat(conn){
    if (!conn || !conn.user_id) return;
    var seed = {
      partner_id: conn.user_id,
      nickname: conn.nickname || 'Anonymous',
      avatar: conn.avatar || 'girl1',
      gender: conn.gender || null,
      is_online: !!conn.is_online,
    };
    setActiveChat(seed);
    setChatMessages([]);
    setActiveTab('messages');
    loadAnonChat(conn.user_id);
  }

  /* R46: open safety sheet for a user (call / post-call / connection / profile). */
  function openSafetySheet(target, context){
    if (!target) return;
    setSafetySheetFor({
      partner_id: target.partner_id || target.user_id || target.id,
      nickname: target.nickname || target.partner_nickname || target.name || 'Anonymous',
      avatar: target.avatar || target.partner_avatar || 'girl1',
      context: context || 'call',
      context_id: target.context_id || null,
    });
  }
  /* R46: confirm + perform block. */
  function performBlock(){
    var s = safetySheetFor; if (!s || !s.partner_id) return;
    setSafetySheetFor(null);
    sb.rpc('block_anon', { p_target: s.partner_id }).then(function(r){
      if (r && r.error) { try { toastError('Block failed: ' + r.error.message); } catch(_){} return; }
      try { toastInfo('Blocked. You won\'t match with them again.'); } catch(_){}
      loadConnectionsAndRequests();
      /* If we're currently on a call with them, end it. */
      try {
        if (typeof window !== 'undefined' && window.__ringInHangup) window.__ringInHangup();
      } catch(_){}
    }).catch(function(){ try { toastError('Network error'); } catch(_){} });
  }
  /* R46: open the report-reason picker. */
  function openReportPicker(){
    setReportSheetFor(safetySheetFor);
    setSafetySheetFor(null);
  }
  /* R46: send report with chosen reason. */
  function performReport(reason){
    var s = reportSheetFor; if (!s || !s.partner_id || reportSending) return;
    setReportSending(true);
    sb.rpc('report_anon', {
      p_target: s.partner_id,
      p_reason: reason,
      p_context: s.context || 'call',
      p_context_id: s.context_id || null,
      p_note: null
    }).then(function(r){
      setReportSending(false);
      if (r && r.error) { try { toastError('Report failed: ' + r.error.message); } catch(_){} return; }
      try { toastInfo('Report sent. Thank you for keeping RingIn safe.'); } catch(_){}
      setReportSheetFor(null);
    }).catch(function(){ setReportSending(false); try { toastError('Network error'); } catch(_){} });
  }

  function loadCallLogs(){
    try {
      sb.rpc('list_anon_call_logs').then(function(r){
        if (r && !r.error && Array.isArray(r.data)) setCallLogs(r.data);
      }).catch(function(){});
    } catch(_){}
  }

  function openConnectionProfile(conn){
    /* Try server fetch (returns latest data + RLS-gates to connections);
     * fall back to the cached `conn` row if RPC fails. */
    try {
      sb.rpc('get_anon_profile', { p_user_id: conn.user_id }).then(function(r){
        if (r && !r.error && r.data && r.data[0]) setViewingProfile(r.data[0]);
        else setViewingProfile(conn);
      }).catch(function(){ setViewingProfile(conn); });
    } catch(_){ setViewingProfile(conn); }
  }

  function addInterest(i) {
    var v = (i || '').trim().toLowerCase();
    if (v && interests.indexOf(v) < 0) setInterests(interests.concat([v]));
    setInput('');
  }
  function removeInterest(i) {
    setInterests(interests.filter(function(x){ return x !== i; }));
  }

  /* R31: space-to-add interest. Watches the input value; when it ends with
   * a space, commits the trimmed value as an interest chip. Mirrors how
   * hashtag inputs feel — type "music<space>" and music is chipified. */
  function onInterestInputChange(e){
    var raw = e.target.value;
    if (raw.length > 0 && raw.endsWith(' ')) {
      var w = raw.trim();
      if (w) addInterest(w);
      return; // setInput('') already happened inside addInterest
    }
    setInput(raw);
  }

  /* R29: stop everything — clears poll, countdown, leaves the queue server-
   * side. Safe to call multiple times. */
  function stopSearching(){
    if (pollRef.current)     { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current){ clearInterval(countdownRef.current); countdownRef.current = null; }
    try { sb.rpc('anonymous_leave_queue').then(function(){}).catch(function(){}); } catch(_){}
    setSearching(false);
  }

  /* When the matchmaker returns 'matched' for us, fire the actual call.
   * Deterministic role assignment via is_caller (larger UUID dials). Same
   * call_invites + Agora pipeline as expert calls — rate=0 so no coin
   * deduction. The callee gets the standard incoming call ring.
   * R37: Omegle/FRND-style auto-connect — no preview, no confirmation.
   * The match → call transition is instant. After the call ends, the
   * post-call sheet shows Add Connection / Find Next / Block. */
  async function startMatchedCall(matchData){
    var partner = matchData.partner_id;
    if (matchData.is_caller) {
      /* R36: fetch fresh identity (guards against stale 'Anonymous' nick). */
      var me = await getMyIdentityForCall();
      var pa34 = getAvatar(matchData.partner_avatar || 'girl1');
      var target = {
        id: partner,
        name: matchData.partner_nickname || 'Anonymous',
        avatar: null,
        initials: pa34.emoji,
        color: pa34.bg,
        role: 'Anonymous Connect',
        online: true,
        _myNickname: me.nickname,
        _myAvatar: me.avatar,
        _partnerAvatar: matchData.partner_avatar || null,
        _partnerGender: matchData.partner_gender || null,
      };
      try {
        if (typeof window !== 'undefined' && typeof window.__ringInStartCall === 'function') {
          window.__ringInStartCall(target, { rate: 0, anonymous: true });
        } else {
          toastError('Call pipeline not ready — try again');
        }
      } catch(e){ console.warn('[anon] start call failed:', e); toastError('Could not start call'); }
    }
    /* R37: Bug #6 fixed — removed the toastInfo on the callee side.
     * The IncomingCallModal from App.js already fires; the double-toast was
     * redundant + noisy. Callee gets a normal incoming-call ring instead. */
  }

  function find(excludeOverride) {
    if (!userId) { toastError('Please log in'); return; }
    /* R37: dismiss any leftover post-call sheet when starting a new search. */
    setPostCall(null);
    /* R30: auto-enable availability so others can see + match with us.
     * R37: Bug #7 fix — only bump count if we were OFF before (no double-counting). */
    if (!available) {
      setAvailable(true);
      try { sb.rpc('set_anon_available', { p_available: true }).then(function(){}).catch(function(){}); } catch(_){}
      setOnlineCount(function(c){ return c + 1; });
    }
    /* R29 — real matchmaking queue with 30-sec poll.
     *
     * Flow:
     *  1. Call anonymous_enqueue_and_match RPC — atomically enqueues me
     *     AND tries to find a partner from existing waiters.
     *  2. If matched immediately → start the call, done.
     *  3. If still waiting → poll anonymous_check_match every 2 sec for
     *     up to 30 sec. When ANOTHER user enqueues and matches with me,
     *     my row flips to 'matched' and the poll detects it.
     *  4. On timeout (30 sec, no match) → leave queue + show toast.
     */
    setSearching(true); setErr(null); setSecsLeft(30);
    var useExclude = Array.isArray(excludeOverride) ? excludeOverride : exclude;
    deadlineRef.current = Date.now() + 30 * 1000;

    function handleMatched(matchData){
      stopSearching();
      // R33: remember the partner so user can later "Add as Connection"
      setLastMatchPartner(matchData);
      startMatchedCall(matchData);
    }

    function pollOnce(){
      if (Date.now() >= deadlineRef.current) {
        // Timeout
        stopSearching();
        setErr('No matches available right now. Try again in a moment!');
        return;
      }
      sb.rpc('anonymous_check_match').then(function(r){
        if (!r || r.error) {
          console.warn('[anon] check_match error:', r && r.error);
          return;
        }
        if (r.data && r.data.status === 'matched') { handleMatched(r.data); }
      }).catch(function(e){ console.warn('[anon] check_match reject:', e); });
    }

    // Live countdown for the user (visual reassurance)
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(function(){
      var ms = deadlineRef.current - Date.now();
      setSecsLeft(Math.max(0, Math.ceil(ms / 1000)));
    }, 250);

    // Step 1: enqueue + first match attempt
    sb.rpc('anonymous_enqueue_and_match', {
      p_interests: interests,
      p_same_geo: sameGeo,
      p_geo_country: null,
      p_geo_city: null,
      p_exclude: useExclude,
    }).then(function(r){
      if (!r || r.error) {
        console.warn('[anon] enqueue error:', r && r.error);
        stopSearching();
        setErr('Could not start search: ' + ((r && r.error && r.error.message) || 'unknown error'));
        return;
      }
      if (r.data && r.data.status === 'matched') { handleMatched(r.data); return; }
      // Step 2: start polling every 2 sec until match or timeout
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollOnce, 2000);
    }).catch(function(e){
      console.warn('[anon] enqueue reject:', e);
      stopSearching();
      setErr('Network error — try again');
    });
  }

  /* Cancel button — user explicitly wants to stop searching. */
  function cancelSearch(){
    stopSearching();
    setErr(null);
  }

  /* R37: skip() removed — the match preview screen never showed (Bug #2)
   * and we now go straight from match → call (Omegle/FRND-style). To get
   * a new person, user ends the call and the post-call sheet's "Find
   * Next" button calls find() with the partner pushed onto exclude.
   * R46: also persists the exclude to anon_excluded so we never re-match
   * the same person even on a fresh app session. */
  function findNext(){
    var p = postCall && postCall.partner_id;
    if (p) {
      var nextExclude = (exclude || []).concat([p]);
      setExclude(nextExclude);
      try { sb.rpc('add_anon_exclude', { p_target: p }).then(function(){}).catch(function(){}); } catch(_){}
      setPostCall(null);
      find(nextExclude);
    } else {
      setPostCall(null);
      find();
    }
  }

  /* Cleanup on unmount — leave the queue + clear timers so we don't keep
   * polling after the screen is gone. */
  useEffect(function(){
    return function(){ stopSearching(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* R37: Bug #9 fix — Capacitor Android hardware-back button should close
   * any open modal/sheet first (instead of exiting the app). Falls back
   * to no-op on web (browser back is handled by the React Router root). */
  useEffect(function(){
    var Cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
    var handle = null;
    (async function(){
      try {
        var mod = await import('@capacitor/app');
        var App = mod && (mod.App || mod.default || mod);
        if (!App || !App.addListener) return;
        handle = await App.addListener('backButton', function(){
          /* Close in priority order — most-recent UI first. */
          /* R47: gift drawer takes top priority when open. */
          if (giftDrawerOpen) { setGiftDrawerOpen(false); return; }
          /* R46: safety sheets take next priority. */
          if (reportSheetFor) { setReportSheetFor(null); return; }
          if (safetySheetFor) { setSafetySheetFor(null); return; }
          if (viewingProfile) { setViewingProfile(null); return; }
          if (editProfileOpen) { setEditProfileOpen(false); return; }
          /* R45: chat view goes back to conversation list before closing. */
          if (activeChat) { setActiveChat(null); setChatMessages([]); loadAnonConvos(); return; }
          if (postCall) { setPostCall(null); return; }
          if (searching) { cancelSearch(); return; }
          /* Nothing to close — let the OS handle it (exits the app). */
          try { App.exitApp(); } catch(_){}
        });
      } catch(_){}
    })();
    return function(){ try { if (handle && handle.remove) handle.remove(); } catch(_){} };
  }, [viewingProfile, editProfileOpen, activeChat, postCall, searching, safetySheetFor, reportSheetFor, giftDrawerOpen]);

  /* R46: listen for events from CallScreen — tap ⋯ on the in-call action row
   * dispatches `ringin:anonsafety` with the partner context. */
  useEffect(function(){
    function onSafety(ev){
      var d = ev && ev.detail; if (!d) return;
      openSafetySheet({ partner_id: d.partner_id, nickname: d.nickname, avatar: d.avatar, context_id: d.context_id || null }, d.context || 'call');
    }
    window.addEventListener('ringin:anonsafety', onSafety);
    return function(){ window.removeEventListener('ringin:anonsafety', onSafety); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* R30: load initial availability state + start polling the live count
   * every 15 sec. Also heartbeat the expiry every 5 min so the user
   * stays "available" while the screen is open. R31: also loads the
   * persistent anonymous profile (nickname/avatar/gender/preference). */
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    // Initial fetch: availability + anonymous profile + REAL gender + onboarded flag
    try {
      /* R34: forward-compatible select — anon_caption/anon_languages/anon_from
       * may not exist yet if migration 0024 hasn't run. Try the wide select
       * first; on column-missing error fall back to the narrow one. */
      sb.from('profiles').select('is_available_anon,available_until,anon_nickname,anon_avatar,anon_gender,anon_preference,gender,anon_onboarded,full_name,anon_caption,anon_languages,anon_from').eq('id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && r.error && /column .* does not exist/i.test(r.error.message || '')) {
          /* fall back without the new columns */
          return sb.from('profiles').select('is_available_anon,available_until,anon_nickname,anon_avatar,anon_gender,anon_preference,gender,anon_onboarded,full_name').eq('id', userId).maybeSingle();
        }
        return r;
      }).then(function(r){
        if (cancelled || !r) return;
        setCheckingOnboard(false);
        if (r && !r.error && r.data) {
          var stillValid = !r.data.available_until || new Date(r.data.available_until) > new Date();
          setAvailable(!!r.data.is_available_anon && stillValid);
          if (r.data.anon_nickname) setNick(r.data.anon_nickname);
          if (r.data.anon_avatar)   setAvatarId(r.data.anon_avatar);
          // R34: extended profile fields
          if (r.data.anon_caption)  setCaption(r.data.anon_caption);
          if (r.data.anon_languages && Array.isArray(r.data.anon_languages)) setLanguages(r.data.anon_languages);
          if (r.data.anon_from)     setFromLoc(r.data.anon_from);
          // R32: gender is REAL gender (from profiles.gender) — not editable here
          var realGender = r.data.gender || r.data.anon_gender || 'f';
          setGender(realGender);
          if (r.data.anon_preference) setPreference(r.data.anon_preference);
          // R32: onboarded flag — if false, show the setup wizard
          var hasGender = !!r.data.gender;
          var hasNick = r.data.anon_nickname && r.data.anon_nickname.trim().length > 0;
          var ob = !!r.data.anon_onboarded && hasGender && hasNick;
          setOnboarded(ob);
          // Pre-fill onboarding fields with sensible defaults
          if (!ob) {
            setObGender(realGender || '');
            setObNick(r.data.anon_nickname || (r.data.full_name ? r.data.full_name.split(' ')[0] : ''));
            setObAvatar(r.data.anon_avatar || (realGender === 'm' ? 'boy1' : 'girl1'));
            setObPref(r.data.anon_preference || 'both');
          }
          profileSavedRef.current = true;
        }
      }).catch(function(e){ setCheckingOnboard(false); console.warn('[anon] profile fetch reject:', e); });
    } catch(_){ setCheckingOnboard(false); }
    function pollCount(){
      /* R46: count of users actively waiting in the queue (last 40s), not
       * the full set of "available" users. Falls back to the old view if
       * migration 0029 hasn't been applied yet. */
      try {
        sb.from('actively_searching_count').select('count').maybeSingle().then(function(r){
          if (cancelled) return;
          if (r && !r.error && r.data) {
            setOnlineCount(r.data.count || 0);
            return;
          }
          /* Forward-compat fallback to old view if the new one is missing. */
          sb.from('available_anon_count').select('count').maybeSingle().then(function(r2){
            if (cancelled) return;
            if (r2 && !r2.error && r2.data) setOnlineCount(r2.data.count || 0);
          }).catch(function(){});
        }).catch(function(){});
      } catch(_){}
    }
    pollCount();
    countPollRef.current = setInterval(pollCount, 15000);
    return function(){
      cancelled = true;
      if (countPollRef.current) { clearInterval(countPollRef.current); countPollRef.current = null; }
      /* R37: Bug #14 — removed dup heartbeat cleanup here; the [available]
       * effect below owns the heartbeat lifecycle. */
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* When available is ON, heartbeat the 30-min expiry every 5 min. When OFF,
   * clear the heartbeat. */
  useEffect(function(){
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (!available) return;
    heartbeatRef.current = setInterval(function(){
      try { sb.rpc('touch_anon_availability').then(function(){}).catch(function(){}); } catch(_){}
    }, 5 * 60 * 1000);
    return function(){
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    };
  }, [available]);

  /* R31: debounced save of anonymous profile. Runs 600ms after the user
   * stops typing/changing — avoids spamming the RPC on every keystroke.
   * R34: also persists caption/languages/from via a direct UPDATE
   * (set_anon_profile RPC doesn't know about those columns; the user's
   * RLS update policy on their own row handles it). */
  useEffect(function(){
    if (!userId) return;
    /* R37: Bug #3 fix — gate save on profileSavedRef being TRUE (set after
     * the initial load completes). Without this, the debounced save fires
     * on mount with empty state and nukes the user's saved nickname when
     * the load takes >600ms. */
    if (!profileSavedRef.current) return;
    if (saveProfileTimerRef.current) clearTimeout(saveProfileTimerRef.current);
    saveProfileTimerRef.current = setTimeout(function(){
      try {
        sb.rpc('set_anon_profile', {
          p_nickname: nick || null,
          p_avatar: avatarId,
          p_gender: gender,
          p_preference: preference,
        }).then(function(r){
          if (r && r.error) console.warn('[anon] save profile error:', r.error);
        }).catch(function(){});
      } catch(_){}
      /* R34: extended fields — try direct update, swallow column-missing errors. */
      try {
        sb.from('profiles').update({
          anon_caption: caption || null,
          anon_languages: languages || [],
          anon_from: fromLoc || null,
        }).eq('id', userId).then(function(r){
          if (r && r.error && !/column .* does not exist/i.test(r.error.message || '')) {
            console.warn('[anon] extended profile save error:', r.error);
          }
        }).catch(function(){});
      } catch(_){}
    }, 600);
    return function(){
      if (saveProfileTimerRef.current) { clearTimeout(saveProfileTimerRef.current); saveProfileTimerRef.current = null; }
    };
  }, [nick, avatarId, gender, preference, caption, languages, fromLoc, userId]);

  /* R45: load conversation list whenever Messages tab is open + poll every
   * 15s to catch new messages. Realtime subscription handles instant updates
   * for messages while a chat is open; the poll is the safety net for the
   * list view when no chat is active. */
  useEffect(function(){
    if (!userId || !onboarded) return;
    if (activeTab !== 'messages') return;
    loadAnonConvos();
    anonConvosPollRef.current = setInterval(loadAnonConvos, 15000);
    return function(){
      if (anonConvosPollRef.current) { clearInterval(anonConvosPollRef.current); anonConvosPollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, onboarded, activeTab]);

  /* R45: realtime subscription on anon_messages targeted at me. Used to
   * append incoming messages to the active chat instantly + bump the convo
   * list to the top. RLS already gates this — Supabase realtime only
   * forwards rows where my SELECT policy returns true. */
  useEffect(function(){
    if (!userId) return;
    var ch = sb.channel('anon-msg-' + userId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'anon_messages',
        filter: 'receiver_id=eq.' + userId,
      }, function(p){
        var m = p && p.new;
        if (!m) return;
        /* If chat with this partner is open, append the bubble + mark read. */
        if (activeChat && activeChat.partner_id === m.sender_id) {
          setChatMessages(function(prev){
            /* dedupe by id */
            if (prev.some(function(x){ return x.id === m.id; })) return prev;
            return prev.concat([m]);
          });
          setTimeout(function(){
            if (chatScrollRef.current) { try { chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; } catch(_){} }
          }, 50);
          try { sb.rpc('mark_anon_chat_read', { p_partner_id: m.sender_id }).then(function(){}).catch(function(){}); } catch(_){}
        }
        /* Bump conversation list (cheap refresh — RPC returns sorted). */
        loadAnonConvos();
      })
      .subscribe();
    chatRealtimeRef.current = ch;
    return function(){ try { sb.removeChannel(ch); } catch(_){} chatRealtimeRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeChat && activeChat.partner_id]);

  /* R34: load anon call logs on mount + when this tab is opened. Listen for
   * the global 'ringin:anoncallend' event dispatched by App.js when an
   * anonymous call ends — save a row to anon_call_logs + refresh the list. */
  useEffect(function(){
    if (!userId) return;
    loadCallLogs();
    function onAnonCallEnd(ev){
      var d = ev && ev.detail;
      if (!d) return;
      try {
        sb.rpc('save_anon_call_log', {
          p_partner_id: d.partner_id || null,
          p_partner_nickname: d.partner_nickname || null,
          p_partner_avatar: d.partner_avatar || null,
          p_partner_gender: d.partner_gender || null,
          p_duration_seconds: d.duration_seconds || 0,
          p_was_caller: !!d.wasCaller,
        }).then(function(r){
          if (r && r.error) console.warn('[anon] save call log error:', r.error);
          loadCallLogs();
        }).catch(function(){});
      } catch(_){}
      /* R37: pop the post-call sheet (Omegle/FRND-style) so the user can
       * Add Connection / Find Next / Block right after hanging up. */
      if (d.partner_id) {
        setPostCall({
          partner_id: d.partner_id,
          nickname: d.partner_nickname || 'Anonymous',
          avatar: d.partner_avatar || 'girl1',
          gender: d.partner_gender || null,
          duration_seconds: d.duration_seconds || 0,
        });
        /* Land them on the Connections tab if they're elsewhere so they
         * see the sheet (post-call sheet only renders in Connections). */
        setActiveTab('connections');
      }
    }
    window.addEventListener('ringin:anoncallend', onAnonCallEnd);

    /* R35: CallScreen dispatches this when the user taps "View Profile"
     * during an anonymous call. We open the profile-view modal with what
     * the call screen already knows (nickname + avatar + gender), then
     * try to upgrade with a get_anon_profile RPC call in the background
     * (will succeed silently if they're already connected). */
    function onViewAnonPartner(ev){
      var d = ev && ev.detail;
      if (!d) return;
      var seed = { user_id: d.user_id, nickname: d.nickname, avatar: d.avatar, gender: d.gender, is_online: !!d.is_online };
      setViewingProfile(seed);
      if (d.user_id) {
        try {
          sb.rpc('get_anon_profile', { p_user_id: d.user_id }).then(function(r){
            if (r && !r.error && r.data && r.data[0]) setViewingProfile(r.data[0]);
          }).catch(function(){});
        } catch(_){}
      }
    }
    window.addEventListener('ringin:viewanonpartner', onViewAnonPartner);

    return function(){
      window.removeEventListener('ringin:anoncallend', onAnonCallEnd);
      window.removeEventListener('ringin:viewanonpartner', onViewAnonPartner);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* R32: complete onboarding — saves real gender + anon nickname/avatar/pref
   * in one RPC. After this, the wizard never shows again for this user. */
  function completeOnboarding(){
    if (!obGender) { toastError('Please pick your gender'); return; }
    if (!obNick || obNick.trim().length === 0) { toastError('Please pick a nickname'); return; }
    if (!obAvatar) { toastError('Please pick an avatar'); return; }
    setObSubmitting(true);
    sb.rpc('complete_anon_onboarding', {
      p_gender: obGender,
      p_nickname: obNick.trim(),
      p_avatar: obAvatar,
      p_preference: obPref,
    }).then(function(r){
      setObSubmitting(false);
      if (r && r.error) {
        console.warn('[anon onboard] error:', r.error);
        toastError('Could not save: ' + (r.error.message || 'unknown error'));
        return;
      }
      // Hydrate the main-screen state from what we just saved
      setGender(obGender);
      setNick(obNick.trim());
      setAvatarId(obAvatar);
      setPreference(obPref);
      setOnboarded(true);
      try { toastInfo("You're all set! Tap Find Someone to start."); } catch(_){}
    }).catch(function(e){
      setObSubmitting(false);
      console.warn('[anon onboard] reject:', e);
      toastError('Network error — try again');
    });
  }

  /* R33: load my connections + pending requests. Polls every 30 sec while
   * the screen is open so new requests/accepts show up reasonably fast
   * without WebSocket complexity. */
  function loadConnectionsAndRequests(){
    if (!userId) return;
    try {
      sb.rpc('list_anon_connections').then(function(r){
        if (r && !r.error && Array.isArray(r.data)) setConnections(r.data);
      }).catch(function(){});
      sb.rpc('list_pending_anon_requests').then(function(r){
        if (r && !r.error && Array.isArray(r.data)) setPendingReqs(r.data);
      }).catch(function(){});
    } catch(_){}
  }
  useEffect(function(){
    if (!userId || !onboarded) return;
    loadConnectionsAndRequests();
    connectionsPollRef.current = setInterval(loadConnectionsAndRequests, 30000);
    return function(){
      if (connectionsPollRef.current) { clearInterval(connectionsPollRef.current); connectionsPollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, onboarded]);

  /* R33: send a connection request to the last person we just matched with.
   * R37: prefer postCall (most recent — set when call ends) over
   * lastMatchPartner (set when match was made — could be stale). */
  function sendConnectionRequest(){
    var pid = (postCall && postCall.partner_id) || (lastMatchPartner && lastMatchPartner.partner_id);
    if (!pid) { toastError('No recent match to connect with'); return; }
    setConnReqSending(true);
    sb.rpc('request_anon_connection', { p_recipient: pid }).then(function(r){
      setConnReqSending(false);
      if (r && r.error) {
        console.warn('[anon] conn request error:', r.error);
        toastError('Could not send request: ' + (r.error.message || 'unknown'));
        return;
      }
      var st = r && r.data && r.data.status;
      if (st === 'already_connected') {
        try { toastInfo("You're already connected."); } catch(_){}
      } else {
        try { toastInfo('Request sent! Waiting for them to accept.'); } catch(_){}
      }
      setLastMatchPartner(null);
      setPostCall(null); /* dismiss post-call sheet on success */
    }).catch(function(e){
      setConnReqSending(false); console.warn('[anon] conn request reject:', e);
      toastError('Network error — try again');
    });
  }

  /* R33: respond to an incoming connection request.
   * R37: Bug #8 fix — optimistically remove from pendingReqs so the tab
   * badge clears immediately (was waiting up to 30 sec for next poll). */
  function respondToRequest(reqId, accept){
    var snapshot = pendingReqs;
    setPendingReqs(pendingReqs.filter(function(r){ return r.id !== reqId; }));
    sb.rpc('respond_anon_connection', { p_request_id: reqId, p_accept: accept }).then(function(r){
      if (r && r.error) {
        console.warn('[anon] respond error:', r.error);
        toastError('Action failed');
        setPendingReqs(snapshot); /* rollback */
        return;
      }
      try { toastInfo(accept ? 'Connected!' : 'Request declined.'); } catch(_){}
      loadConnectionsAndRequests();
    }).catch(function(e){
      console.warn('[anon] respond reject:', e);
      toastError('Network error');
      setPendingReqs(snapshot); /* rollback */
    });
  }

  /* R33: call a connection directly (re-use the existing call pipeline). */
  /* R36: defensive identity fetch — guarantees the caller_name field on
   * call_invites is the user's REAL anon nickname (or a derived fallback
   * from full_name), never literal 'Anonymous' just because `nick` state
   * was stale at call time. Called by every code path that starts a call. */
  async function getMyIdentityForCall(){
    /* 1) Use state if it's already populated. */
    if (nick && nick.trim()) return { nickname: nick.trim(), avatar: avatarId || 'girl1' };
    /* 2) State empty — fetch fresh from DB. */
    try {
      var r = await sb.from('profiles').select('anon_nickname,anon_avatar,full_name').eq('id', userId).maybeSingle();
      if (r && !r.error && r.data) {
        var n = (r.data.anon_nickname && r.data.anon_nickname.trim())
              || (r.data.full_name && r.data.full_name.trim().split(' ')[0])
              || null;
        var av = r.data.anon_avatar || avatarId || 'girl1';
        if (n) {
          /* Cache for next time so we don't re-fetch every call. */
          setNick(n);
          if (r.data.anon_avatar) setAvatarId(r.data.anon_avatar);
          return { nickname: n, avatar: av };
        }
      }
    } catch(_) {}
    /* 3) Truly nothing — last-resort fallback. */
    return { nickname: 'Anonymous', avatar: avatarId || 'girl1' };
  }

  /* R34: re-call an accepted connection with full anon context.
   * R36: now async — awaits identity fetch to guarantee a real nickname. */
  async function callConnection(conn){
    if (!conn || !conn.user_id) { toastError('Invalid connection'); return; }
    var me = await getMyIdentityForCall();
    var pa = getAvatar(conn.avatar || 'girl1');
    var target = {
      id: conn.user_id,
      name: conn.nickname || 'Anonymous',
      avatar: null,
      initials: pa.emoji,
      color: pa.bg,
      role: 'Anonymous Connection',
      online: !!conn.is_online,
      _myNickname: me.nickname,
      _myAvatar: me.avatar,
      _partnerAvatar: conn.avatar || null,
      _partnerGender: conn.gender || null,
    };
    try {
      if (typeof window !== 'undefined' && typeof window.__ringInStartCall === 'function') {
        window.__ringInStartCall(target, { rate: 0, anonymous: true });
      } else { toastError('Call pipeline not ready'); }
    } catch(e){ console.warn('[anon] call connection failed:', e); toastError('Could not start call'); }
  }

  function toggleAvailable(){
    if (availToggling) return;
    setAvailToggling(true);
    var next = !available;
    /* Optimistic flip — feels instant. Roll back on RPC failure. */
    setAvailable(next);
    sb.rpc('set_anon_available', { p_available: next }).then(function(r){
      setAvailToggling(false);
      if (r && r.error) {
        console.warn('[anon] toggle error:', r.error);
        setAvailable(!next); // rollback
        toastError('Could not update availability');
        return;
      }
      /* Bump the live count immediately so the UI reflects our own flip
       * without waiting for the next poll. */
      setOnlineCount(function(c){ return Math.max(0, c + (next ? 1 : -1)); });
    }).catch(function(e){
      setAvailToggling(false);
      console.warn('[anon] toggle reject:', e);
      setAvailable(!next); // rollback
      toastError('Network error — try again');
    });
  }

  /* R32: first-time setup wizard — shown until the user picks gender + nick + avatar + preference once. */
  if (!checkingOnboard && !onboarded) {
    var obAvatarsToShow = obGender === 'm' ? ANON_AVATARS.filter(function(a){ return a.gender === 'm'; })
                       : obGender === 'f' ? ANON_AVATARS.filter(function(a){ return a.gender === 'f'; })
                       : ANON_AVATARS;
    return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      React.createElement('div', {style:{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'10px'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🎭 Welcome')
      ),
      React.createElement('div', {style:{padding:'18px'}},
        React.createElement('h2', {style:{fontSize:'18px',fontWeight:800,color:'var(--text)',margin:'0 0 6px',fontFamily:'Syne, sans-serif'}}, 'Set up your anonymous profile'),
        React.createElement('p', {style:{fontSize:'13px',color:'var(--t2)',margin:'0 0 18px',lineHeight:1.5}}, 'This is the identity strangers see when you connect anonymously. You can edit nickname, avatar and preferences anytime — but gender stays tied to your real RingIn profile.'),

        // STEP 1 — Gender (only if not set on real profile)
        React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
          React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}, "I'm a"),
          React.createElement('div', {style:{display:'flex',gap:'8px'}},
            [{k:'f',l:'👧 Girl'},{k:'m',l:'👦 Boy'},{k:'other',l:'🌈 Other'}].map(function(g){
              var sel = obGender === g.k;
              return React.createElement('button', {
                key:g.k, onClick:function(){ setObGender(g.k); /* reset avatar to first matching one */ setObAvatar(g.k === 'm' ? 'boy1' : 'girl1'); },
                style:{flex:1,padding:'12px 6px',border:sel?'2px solid var(--ac)':'1px solid var(--border)',background:sel?'rgba(123,110,255,0.12)':'var(--bg3)',color:sel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
              }, g.l);
            })
          ),
          React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'8px',lineHeight:1.5}}, 'This saves to your real profile and is used for matching. Cannot be changed later from this screen.')
        ),

        // STEP 2 — Nickname
        React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
          React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}, 'Nickname'),
          React.createElement('input', {
            value:obNick,
            onChange:function(e){ setObNick(e.target.value.slice(0,30)); },
            placeholder:'e.g. Riya, Arjun, Whoever',
            maxLength:30,
            style:{width:'100%',padding:'11px 13px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'14px',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}
          })
        ),

        // STEP 3 — Avatar (filtered by gender if set)
        React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
          React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}, 'Pick an avatar'),
          React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat('+(obAvatarsToShow.length<6?'3':'6')+',1fr)',gap:'10px'}},
            obAvatarsToShow.map(function(a){
              var sel = obAvatar === a.id;
              return React.createElement('button', {
                key:a.id, onClick:function(){ setObAvatar(a.id); },
                style:{aspectRatio:'1/1',borderRadius:'50%',background:a.bg,border:sel?'3px solid #fff':'3px solid transparent',outline:sel?'2px solid var(--ac)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',cursor:'pointer',padding:0,boxShadow:sel?'0 4px 14px rgba(123,110,255,0.5)':'none',transition:'all 0.15s'}
              }, a.emoji);
            })
          )
        ),

        // STEP 4 — Preference
        React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'18px'}},
          React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}, 'I want to talk to'),
          React.createElement('div', {style:{display:'flex',gap:'8px'}},
            [{k:'women',l:'👧 Girls'},{k:'men',l:'👦 Boys'},{k:'both',l:'✨ Anyone'}].map(function(p){
              var sel = obPref === p.k;
              return React.createElement('button', {
                key:p.k, onClick:function(){ setObPref(p.k); },
                style:{flex:1,padding:'12px 6px',border:sel?'2px solid var(--ac)':'1px solid var(--border)',background:sel?'rgba(123,110,255,0.12)':'var(--bg3)',color:sel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
              }, p.l);
            })
          )
        ),

        // Submit
        React.createElement('button', {
          onClick: completeOnboarding, disabled: obSubmitting,
          style:{width:'100%',padding:'15px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:800,cursor:obSubmitting?'wait':'pointer',opacity:obSubmitting?0.7:1,fontFamily:'inherit',boxShadow:'0 4px 16px rgba(123,110,255,0.4)'}
        }, obSubmitting ? 'Saving…' : '✨ Get Started')
      )
    );
  }

  /* R33: 4 top tabs (Instagram-style). Connections is the default landing. */
  var TABS = [
    { key:'connections', label:'Connections', icon:'🤝' },
    { key:'messages',    label:'Messages',    icon:'💬' },
    { key:'calllogs',    label:'Call Logs',   icon:'📞' },
    { key:'profile',     label:'Profile',     icon:'👤' },
  ];
  var pendingCount = (pendingReqs && pendingReqs.length) || 0;

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    /* R34: simple header (title only, no longer sticky). */
    React.createElement('div', {style:{padding:'14px 18px 4px'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🎭 Anonymous Connect')
    ),

    /* R34: Online toggle card — moved OUT of connections tab so it's visible
     * on every tab (per user feedback). */
    React.createElement('div', {style:{margin:'8px 16px 0',padding:'16px',background:'var(--bg2)',border:'1px solid '+(available ? 'rgba(39,201,106,0.35)' : 'var(--border)'),borderRadius:'14px',display:'flex',alignItems:'center',gap:'14px',boxShadow:available?'0 0 0 1px rgba(39,201,106,0.2),0 4px 16px rgba(39,201,106,0.15)':'none',transition:'all 0.25s'}},
      React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'10px',flex:1,minWidth:0}},
        React.createElement('div', {style:{position:'relative',width:'12px',height:'12px',flexShrink:0}},
          React.createElement('div', {style:{position:'absolute',inset:0,borderRadius:'50%',background:available?'#27C96A':'var(--t3)',boxShadow:available?'0 0 12px rgba(39,201,106,0.7)':'none',transition:'all 0.2s'}}),
          available ? React.createElement('div', {style:{position:'absolute',inset:-3,borderRadius:'50%',border:'2px solid #27C96A',opacity:0.6,animation:'pulse 1.8s ease-in-out infinite'}}) : null
        ),
        React.createElement('div', {style:{flex:1,minWidth:0}},
          React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, available ? "You're available to chat" : 'Set yourself available'),
          React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',marginTop:'2px'}}, onlineCount > 0
            ? ('🟢 ' + onlineCount + ' ' + (onlineCount === 1 ? 'person' : 'people') + ' online now')
            : 'Be the first one online')
        )
      ),
      React.createElement('button', {
        onClick: toggleAvailable, disabled: availToggling,
        style:{width:'46px',height:'26px',borderRadius:'13px',background:available?'#27C96A':'var(--border)',border:'none',cursor:availToggling?'wait':'pointer',position:'relative',flexShrink:0,transition:'background 0.2s',opacity:availToggling?0.6:1}
      },
        React.createElement('div', {style:{position:'absolute',top:'3px',left:available?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
      )
    ),

    /* R34: BIGGER tab bar — sits below the online card now. Card-style
     * pills with icon-above-label, much more tappable than the old thin
     * underline bar. */
    React.createElement('div', {style:{display:'flex',gap:'6px',padding:'14px 12px 8px',overflowX:'auto',scrollbarWidth:'none'}},
      TABS.map(function(t){
        var sel = activeTab === t.key;
        var badge = (t.key === 'connections' && pendingCount > 0) ? pendingCount : 0;
        return React.createElement('button', {
          key:t.key,
          onClick:function(){ setActiveTab(t.key); },
          style:{flex:1,minWidth:'70px',padding:'12px 6px',background:sel?'linear-gradient(135deg,rgba(123,110,255,0.20),rgba(232,77,154,0.14))':'var(--bg2)',border:sel?'1.5px solid var(--ac)':'1px solid var(--border)',borderRadius:'14px',color:sel?'var(--text)':'var(--t2)',fontSize:'11px',fontWeight:sel?700:600,cursor:'pointer',fontFamily:'inherit',position:'relative',whiteSpace:'nowrap',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',transition:'all 0.18s'}
        },
          React.createElement('span', {style:{fontSize:'22px',lineHeight:1}}, t.icon),
          React.createElement('span', null, t.label),
          badge > 0 ? React.createElement('span', {style:{position:'absolute',top:'6px',right:'8px',background:'#FF4757',color:'#fff',fontSize:'10px',fontWeight:700,padding:'2px 6px',borderRadius:'10px',minWidth:'18px',textAlign:'center'}}, badge) : null
        );
      })
    ),

    /* ════════ CONNECTIONS TAB ════════ */
    activeTab === 'connections' && React.createElement(React.Fragment, null,

    // Searching — R29: live 30-sec countdown + cancel button
    searching && React.createElement('div', {style:{padding:'48px 24px',textAlign:'center'}},
      React.createElement('div', {style:{width:'80px',height:'80px',borderRadius:'50%',margin:'0 auto 18px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',animation:'pulse 1.5s ease-in-out infinite'}}, '📞'),
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'20px',fontWeight:700,color:'var(--text)'}}, 'Finding someone…'),
      React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',marginTop:'6px'}}, sameGeo ? 'Searching in your area' : 'Searching globally'),
      React.createElement('div', {style:{fontSize:'13px',color:'var(--ac)',marginTop:'18px',fontWeight:700,letterSpacing:'0.5px'}}, secsLeft + 's left'),
      interests.length > 0
        ? React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'8px'}}, 'Looking for shared interests: ' + interests.join(', '))
        : React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'8px'}}, 'Anyone available right now'),
      React.createElement('button', {
        onClick: cancelSearch,
        style:{marginTop:'24px',padding:'10px 24px',background:'transparent',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
      }, 'Cancel search')
    ),

    /* R37: Dead match-preview UI removed (Bug #2). Match → call is now
     * instant (Omegle/FRND-style). All "Add Connection / Skip" controls
     * live on the CallScreen (during the call) and the post-call sheet
     * (after hang-up) instead of in a pre-call preview that never showed. */

    /* R37: Post-call sheet — pops up when an anon call ends. */
    postCall && !searching && (function(){
      var pa = getAvatar(postCall.avatar || 'girl1');
      var dur = postCall.duration_seconds || 0;
      var durStr = dur < 60 ? (dur + 's') : (Math.floor(dur/60) + 'm ' + (dur%60) + 's');
      return React.createElement('div', {style:{padding:'20px',margin:'12px 16px',background:'linear-gradient(135deg,rgba(123,110,255,0.12),rgba(232,77,154,0.08))',border:'1px solid var(--ac)',borderRadius:'14px',textAlign:'center'}},
        React.createElement('div', {style:{width:'72px',height:'72px',borderRadius:'50%',background:pa.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'34px',margin:'0 auto'}}, pa.emoji),
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'18px',fontWeight:700,color:'var(--text)',marginTop:'10px'}}, postCall.nickname || 'Anonymous'),
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',marginTop:'4px'}}, dur > 0 ? 'Call ended · ' + durStr : 'Call ended'),
        React.createElement('div', {style:{display:'flex',gap:'8px',marginTop:'16px',justifyContent:'center',flexWrap:'wrap'}},
          React.createElement('button', {
            onClick: sendConnectionRequest,
            disabled: connReqSending,
            style:{padding:'10px 16px',borderRadius:'10px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'12px',fontWeight:700,cursor:connReqSending?'wait':'pointer',opacity:connReqSending?0.6:1}
          }, connReqSending ? '...' : '➕ Add Connection'),
          React.createElement('button', {
            onClick: findNext,
            style:{padding:'10px 16px',borderRadius:'10px',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'12px',fontWeight:700,cursor:'pointer'}
          }, '⏭ Find Next'),
          React.createElement('button', {
            onClick: function(){ setPostCall(null); },
            style:{padding:'10px 14px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer'}
          }, 'Close'),
          /* R46: ⋯ opens the safety sheet from the post-call view (so you
           * can block/report someone you just hung up on). */
          React.createElement('button', {
            onClick: function(){ openSafetySheet({ partner_id: postCall.partner_id, nickname: postCall.nickname, avatar: postCall.avatar }, 'call'); },
            style:{padding:'10px 14px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t3)',fontSize:'18px',cursor:'pointer',lineHeight:1}
          }, '⋯')
        )
      );
    })(),

    /* ── Connections tab body — main list area. R37: removed dead `match`
     * check; post-call sheet now renders ABOVE this block instead. ── */
    !searching && React.createElement('div', {style:{padding:'16px'}},

      /* R33: Pending incoming connection requests */
      pendingReqs.length > 0 ? React.createElement('div', {style:{marginBottom:'16px'}},
        React.createElement('div', {style:{fontSize:'12px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}}, '✨ Pending Requests (' + pendingReqs.length + ')'),
        pendingReqs.map(function(req){
          var ra = getAvatar(req.requester_avatar || 'girl1');
          return React.createElement('div', {key:req.id,style:{background:'var(--bg2)',border:'1px solid var(--ac)',borderRadius:'12px',padding:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'10px'}},
            React.createElement('div', {style:{width:'40px',height:'40px',borderRadius:'50%',background:ra.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}, ra.emoji),
            React.createElement('div', {style:{flex:1,minWidth:0}},
              React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, req.requester_nickname || 'Anonymous'),
              React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'1px'}}, 'wants to connect')
            ),
            React.createElement('button', {onClick:function(){respondToRequest(req.id, false);},style:{padding:'7px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--t2)',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}, 'Decline'),
            React.createElement('button', {onClick:function(){respondToRequest(req.id, true);},style:{padding:'7px 14px',background:'linear-gradient(135deg,#27C96A,#1D9E75)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}, 'Accept')
          );
        })
      ) : null,

      /* R33: Find Someone (was at bottom of setup; now top of Connections tab) */
      err && React.createElement('div', {style:{padding:'12px',background:'rgba(239,71,71,0.1)',border:'1px solid var(--red)',borderRadius:'10px',color:'var(--red)',fontSize:'12px',marginBottom:'12px'}}, err),
      /* R46: Interest chip row — inline so people set match preferences
       * without diving into the Edit Profile modal. Adds + removes work
       * on the same `interests` state used by the matchmaker scoring. */
      React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'10px 12px',marginBottom:'12px'}},
        React.createElement('div', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}},
          'Your interests · helps us find better matches'
        ),
        interests.length > 0 ? React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}},
          interests.map(function(i){
            return React.createElement('span', {key:i, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--acg)',color:'var(--ac)',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}},
              '#' + i,
              React.createElement('span', {onClick:function(){removeInterest(i);}, style:{cursor:'pointer',fontSize:'14px',lineHeight:1}}, '×')
            );
          })
        ) : null,
        React.createElement('input', {
          value: input,
          onChange: onInterestInputChange,
          onKeyDown: function(e){ if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && input.trim()) { e.preventDefault(); addInterest(input); } },
          placeholder: interests.length > 0 ? 'Add another (type + space)' : 'Type music, tech, travel + space…',
          style:{width:'100%',padding:'8px 10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'12px',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}
        })
      ),
      React.createElement('button', {onClick:find, style:{width:'100%',padding:'14px',borderRadius:'12px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer',marginBottom:'16px'}}, '🎯 Find Someone to Talk To'),

      /* R33: Accepted connections list */
      React.createElement('div', {style:{fontSize:'12px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}}, 'Your Connections (' + connections.length + ')'),
      connections.length === 0
        ? React.createElement('div', {style:{padding:'24px 16px',textAlign:'center',background:'var(--bg2)',border:'1px dashed var(--border)',borderRadius:'12px',color:'var(--t3)',fontSize:'12px'}},
            React.createElement('div', {style:{fontSize:'32px',marginBottom:'8px',opacity:0.5}}, '🤝'),
            'No connections yet. Match with someone and tap "Add Connection" to keep in touch.'
          )
        : connections.map(function(c){
            var ca = getAvatar(c.avatar || 'girl1');
            return React.createElement('div', {key:c.user_id,style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'10px'}},
              /* R34: tap avatar OR name to open the profile-view modal. */
              React.createElement('div', {onClick:function(){ openConnectionProfile(c); }, style:{width:'42px',height:'42px',borderRadius:'50%',background:ca.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',flexShrink:0,position:'relative',cursor:'pointer'}},
                ca.emoji,
                c.is_online ? React.createElement('div', {style:{position:'absolute',bottom:'-2px',right:'-2px',width:'12px',height:'12px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg)'}}) : null
              ),
              React.createElement('div', {onClick:function(){ openConnectionProfile(c); }, style:{flex:1,minWidth:0,cursor:'pointer'}},
                React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, c.nickname || 'Anonymous'),
                React.createElement('div', {style:{fontSize:'10px',color:c.is_online?'#27C96A':'var(--t3)',marginTop:'1px'}}, c.is_online ? '🟢 Online now' : 'Offline')
              ),
              /* R45: 💬 now opens the anon chat with this connection.
               * (R37 had toast → "coming soon"; chat ships in R45.) */
              React.createElement('button', {onClick:function(){ openAnonChat(c); },style:{padding:'7px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}, '💬'),
              React.createElement('button', {onClick:function(){ callConnection(c); },disabled:!c.is_online,style:{padding:'7px 12px',background:c.is_online?'linear-gradient(135deg,#27C96A,#1D9E75)':'var(--bg4)',border:c.is_online?'none':'1px solid var(--border)',borderRadius:'8px',color:c.is_online?'#fff':'var(--t3)',fontSize:'11px',fontWeight:700,cursor:c.is_online?'pointer':'not-allowed',fontFamily:'inherit'}}, '📞'),
              /* R46: ⋯ opens the safety sheet (Block / Report / Mute). */
              React.createElement('button', {onClick:function(){ openSafetySheet({ partner_id: c.user_id, nickname: c.nickname, avatar: c.avatar }, 'connection'); },style:{padding:'7px 8px',background:'transparent',border:'none',color:'var(--t3)',fontSize:'18px',cursor:'pointer',fontFamily:'inherit',lineHeight:1}}, '⋯')
            );
          })
    )
    ), /* close activeTab === 'connections' fragment */

    /* ════════ MESSAGES TAB (R45) ════════ */
    /* Two render modes: conversation list (default) vs active chat view. */
    activeTab === 'messages' && !activeChat && React.createElement('div', {style:{padding:'12px 16px 16px'}},
      anonConvos.length === 0
        ? React.createElement('div', {style:{padding:'40px 24px',textAlign:'center'}},
            React.createElement('div', {style:{fontSize:'52px',marginBottom:'12px',opacity:0.4}}, '💬'),
            React.createElement('div', {style:{fontSize:'15px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}, 'No conversations yet'),
            React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,maxWidth:'280px',margin:'0 auto'}}, 'Tap the 💬 button on any connection to start a chat. Messages are private to the two of you.')
          )
        : (function(){
            return React.createElement(React.Fragment, null,
              React.createElement('div', {style:{fontSize:'12px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}}, 'Conversations (' + anonConvos.length + ')'),
              anonConvos.map(function(c){
                var ca = getAvatar(c.partner_avatar || 'girl1');
                var preview = c.last_message
                  ? ((c.last_sender_id === userId ? 'You: ' : '') + c.last_message)
                  : 'No messages yet — say hi 👋';
                var when = c.last_message_at ? new Date(c.last_message_at) : null;
                var whenStr = when ? when.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
                return React.createElement('div', {
                  key: c.partner_id,
                  onClick: function(){ openAnonChat({ user_id: c.partner_id, nickname: c.partner_nickname, avatar: c.partner_avatar, is_online: c.partner_is_online }); },
                  style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}
                },
                  React.createElement('div', {style:{width:'46px',height:'46px',borderRadius:'50%',background:ca.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0,position:'relative'}},
                    ca.emoji,
                    c.partner_is_online ? React.createElement('div', {style:{position:'absolute',bottom:'-2px',right:'-2px',width:'12px',height:'12px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg)'}}) : null
                  ),
                  React.createElement('div', {style:{flex:1,minWidth:0}},
                    React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}},
                      React.createElement('div', {style:{fontSize:'13px',fontWeight: c.unread_count > 0 ? 800 : 700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, c.partner_nickname || 'Anonymous'),
                      whenStr ? React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',flexShrink:0}}, whenStr) : null
                    ),
                    React.createElement('div', {style:{fontSize:'11px',color: c.unread_count > 0 ? 'var(--text)' : 'var(--t3)',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight: c.unread_count > 0 ? 600 : 400}}, preview)
                  ),
                  c.unread_count > 0 ? React.createElement('div', {style:{minWidth:'20px',height:'20px',borderRadius:'10px',background:'#E84D9A',color:'#fff',fontSize:'10px',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 6px',flexShrink:0}}, String(c.unread_count)) : null
                );
              })
            );
          })()
    ),

    /* ── Active chat view — renders ABOVE the tab content area when set. ── */
    activeTab === 'messages' && activeChat && (function(){
      var pa = getAvatar(activeChat.avatar || 'girl1');
      return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'calc(100vh - 260px)',minHeight:'400px',background:'var(--bg)'}},
        /* Chat header */
        React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',borderBottom:'1px solid var(--border)',background:'var(--bg2)'}},
          React.createElement('button', {
            onClick: function(){ setActiveChat(null); setChatMessages([]); loadAnonConvos(); },
            style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}
          },
            React.createElement('svg', {viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
              React.createElement('polyline', {points:'15 18 9 12 15 6'})
            )
          ),
          React.createElement('div', {style:{width:'36px',height:'36px',borderRadius:'50%',background:pa.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0,position:'relative'}},
            pa.emoji,
            activeChat.is_online ? React.createElement('div', {style:{position:'absolute',bottom:'-1px',right:'-1px',width:'10px',height:'10px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg)'}}) : null
          ),
          React.createElement('div', {style:{flex:1,minWidth:0}},
            React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}}, activeChat.nickname || 'Anonymous'),
            React.createElement('div', {style:{fontSize:'10px',color: activeChat.is_online ? '#27C96A' : 'var(--t3)'}}, activeChat.is_online ? '🟢 Online' : 'Offline')
          ),
          /* Call shortcut — only when partner is online */
          activeChat.is_online ? React.createElement('button', {
            onClick: function(){ callConnection({ user_id: activeChat.partner_id, nickname: activeChat.nickname, avatar: activeChat.avatar, gender: activeChat.gender, is_online: true }); },
            style:{padding:'7px 10px',borderRadius:'8px',background:'linear-gradient(135deg,#27C96A,#1D9E75)',border:'none',color:'#fff',fontSize:'13px',cursor:'pointer'}
          }, '📞') : null
        ),
        /* Message bubbles — R47: interleaved with gift bubbles by timestamp.
         * Gifts render as a special centered bubble with a big emoji + name +
         * coin amount; reaction taps show a 5-emoji picker, counts appear
         * under the bubble. */
        React.createElement('div', {
          ref: chatScrollRef,
          style:{flex:1,overflowY:'auto',padding:'12px 14px'}
        },
          (function(){
            /* Merge messages + gifts into one sorted feed. */
            var feed = [];
            chatMessages.forEach(function(m){ feed.push({ kind:'msg', t: m.created_at, data: m }); });
            chatGifts.forEach(function(g){ feed.push({ kind:'gift', t: g.created_at, data: g }); });
            feed.sort(function(a,b){ return new Date(a.t) - new Date(b.t); });
            if (feed.length === 0) {
              return React.createElement('div', {style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',padding:'30px 16px'}}, 'No messages yet. Say something 👋');
            }
            return feed.map(function(item){
              if (item.kind === 'gift') {
                var g = item.data;
                var sentByMe = g.sender_id === userId;
                var tierBg = g.tier === 'mega' ? 'linear-gradient(135deg,rgba(255,215,0,0.18),rgba(232,77,154,0.18))'
                           : g.tier === 'premium' ? 'linear-gradient(135deg,rgba(123,110,255,0.18),rgba(232,77,154,0.12))'
                           : 'rgba(123,110,255,0.10)';
                var tierBorder = g.tier === 'mega' ? '1px solid rgba(255,215,0,0.5)'
                               : g.tier === 'premium' ? '1px solid rgba(123,110,255,0.4)'
                               : '1px solid var(--border)';
                return React.createElement('div', {
                  key: 'gift-' + g.id,
                  style:{display:'flex',justifyContent:'center',marginBottom:'10px'}
                },
                  React.createElement('div', {
                    style:{maxWidth:'86%',padding:'12px 18px',borderRadius:'16px',background: tierBg, border: tierBorder, textAlign:'center'}
                  },
                    React.createElement('div', {style:{fontSize: g.tier === 'mega' ? '44px' : (g.tier === 'premium' ? '36px' : '28px'),lineHeight:1,marginBottom:'4px'}}, g.emoji),
                    React.createElement('div', {style:{fontSize:'11px',color:'var(--text)',fontWeight:700}}, (sentByMe ? 'You sent' : 'They sent you') + ' a ' + (getGiftByKey(g.gift_key) ? getGiftByKey(g.gift_key).name : 'gift')),
                    React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, g.coins + ' 🪙')
                  )
                );
              }
              /* msg */
              var m = item.data;
              var mine = m.sender_id === userId;
              var reactions = chatReactions[m.id] || [];
              return React.createElement('div', {
                key: m.id,
                style:{display:'flex',flexDirection:'column',alignItems: mine ? 'flex-end' : 'flex-start',marginBottom:'8px'}
              },
                React.createElement('div', {
                  onClick: function(){ setReactionPickerFor(reactionPickerFor === m.id ? null : m.id); },
                  style:{maxWidth:'78%',padding:'8px 12px',borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',background: mine ? 'linear-gradient(135deg,#7B6EFF,#E84D9A)' : 'var(--bg3)',color: mine ? '#fff' : 'var(--text)',fontSize:'13px',lineHeight:1.45,whiteSpace:'pre-wrap',wordBreak:'break-word',cursor:'pointer'}
                }, m.text),
                /* Reaction counts row */
                reactions.length > 0 ? React.createElement('div', {style:{display:'flex',gap:'4px',marginTop:'3px',flexWrap:'wrap',justifyContent: mine ? 'flex-end' : 'flex-start'}},
                  reactions.map(function(r){
                    return React.createElement('button', {
                      key: r.emoji,
                      onClick: function(e){ e.stopPropagation(); reactToMsg(m.id, r.emoji); },
                      style:{padding:'2px 7px',borderRadius:'10px',background: r.mine ? 'rgba(232,77,154,0.18)' : 'var(--bg3)',border:'1px solid '+(r.mine ? 'var(--ac)' : 'var(--border)'),fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}
                    }, r.emoji + ' ' + r.count);
                  })
                ) : null,
                /* Reaction picker — appears when this message is tapped */
                reactionPickerFor === m.id ? React.createElement('div', {style:{display:'flex',gap:'4px',marginTop:'4px',padding:'4px 8px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px'}},
                  ['❤️','🔥','😂','😮','🙏'].map(function(e){
                    return React.createElement('button', {
                      key: e,
                      onClick: function(ev){ ev.stopPropagation(); reactToMsg(m.id, e); },
                      style:{padding:'4px 8px',background:'transparent',border:'none',fontSize:'18px',cursor:'pointer',lineHeight:1}
                    }, e);
                  })
                ) : null
              );
            });
          })()
        ),
        /* Composer — R47: 🎁 gift button between textarea and Send */
        React.createElement('div', {style:{padding:'10px 12px',borderTop:'1px solid var(--border)',display:'flex',gap:'6px',alignItems:'flex-end',background:'var(--bg2)'}},
          React.createElement('textarea', {
            value: chatInput,
            onChange: function(e){ setChatInput(e.target.value.slice(0, 2000)); },
            onKeyDown: function(e){
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                sendAnonChatMessage();
              }
            },
            placeholder: 'Type a message…',
            rows: 1,
            style:{flex:1,padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'18px',color:'var(--text)',fontSize:'13px',outline:'none',resize:'none',fontFamily:'inherit',maxHeight:'120px',boxSizing:'border-box'}
          }),
          /* R47: 🎁 opens the gift drawer. */
          React.createElement('button', {
            onClick: function(){ setGiftDrawerOpen(true); },
            style:{padding:'10px 12px',borderRadius:'18px',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'18px',cursor:'pointer',fontFamily:'inherit',flexShrink:0,lineHeight:1}
          }, '🎁'),
          React.createElement('button', {
            onClick: sendAnonChatMessage,
            disabled: chatSending || !chatInput.trim(),
            style:{padding:'10px 14px',borderRadius:'18px',background: chatSending || !chatInput.trim() ? 'var(--bg4)' : 'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color: chatSending || !chatInput.trim() ? 'var(--t3)' : '#fff',fontSize:'13px',fontWeight:700,cursor: chatSending || !chatInput.trim() ? 'not-allowed' : 'pointer',fontFamily:'inherit',flexShrink:0}
          }, chatSending ? '...' : 'Send')
        )
      );
    })(),

    /* ════════ CALL LOGS TAB (R34: real data from anon_call_logs) ════════ */
    activeTab === 'calllogs' && (callLogs.length === 0
      ? React.createElement('div', {style:{padding:'40px 24px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'52px',marginBottom:'12px',opacity:0.4}}, '📞'),
          React.createElement('div', {style:{fontSize:'15px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}, 'No calls yet'),
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,maxWidth:'280px',margin:'0 auto'}}, 'Make your first anonymous call from the Connections tab — call history saves automatically.')
        )
      : React.createElement('div', {style:{padding:'12px 16px 16px'}},
          React.createElement('div', {style:{fontSize:'12px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}}, 'Recent Calls (' + callLogs.length + ')'),
          callLogs.map(function(log){
            var la = getAvatar(log.partner_avatar || 'girl1');
            var dur = log.duration_seconds || 0;
            var durStr = dur < 60 ? (dur + 's') : (Math.floor(dur/60) + 'm ' + (dur%60) + 's');
            var when = log.ended_at ? new Date(log.ended_at) : null;
            var whenStr = when ? when.toLocaleString() : '';
            return React.createElement('div', {key:log.id, style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'10px'}},
              React.createElement('div', {style:{width:'44px',height:'44px',borderRadius:'50%',background:la.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',flexShrink:0}}, la.emoji),
              React.createElement('div', {style:{flex:1,minWidth:0}},
                React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, log.partner_nickname || 'Anonymous'),
                React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, (log.was_caller ? '📤 Outgoing' : '📥 Incoming') + ' · ' + whenStr)
              ),
              React.createElement('div', {style:{fontSize:'12px',color:dur > 0 ? 'var(--ac)' : 'var(--t3)',fontWeight:700,flexShrink:0}}, dur > 0 ? durStr : 'Missed')
            );
          })
        )
    ),

    /* ════════ PROFILE TAB (R34: clean profile VIEW + Edit button) ════════ */
    activeTab === 'profile' && (function(){
      var pa = getAvatar(avatarId || 'girl1');
      return React.createElement('div', {style:{padding:'16px',display:'flex',flexDirection:'column',alignItems:'center'}},
        /* Big avatar */
        React.createElement('div', {style:{width:'120px',height:'120px',borderRadius:'50%',background:pa.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'60px',margin:'4px 0 14px',boxShadow:'0 6px 20px rgba(123,110,255,0.25)'}}, pa.emoji),
        /* Nickname */
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,color:'var(--text)',textAlign:'center'}}, nick || 'Set your nickname'),
        /* Gender (read-only badge under name) */
        React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',marginTop:'4px'}},
          gender === 'm' ? '👦 Boy' : gender === 'f' ? '👧 Girl' : '🌈 Other'
        ),
        /* Caption */
        caption ? React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',textAlign:'center',marginTop:'14px',fontStyle:'italic',maxWidth:'320px',lineHeight:1.4,padding:'0 12px'}}, '"' + caption + '"') : null,
        /* From */
        fromLoc ? React.createElement('div', {style:{fontSize:'12px',color:'var(--text)',marginTop:'12px',display:'flex',alignItems:'center',gap:'4px'}}, '📍 ' + fromLoc) : null,
        /* Languages chips */
        languages.length > 0 ? React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',justifyContent:'center',marginTop:'12px',padding:'0 16px'}},
          languages.map(function(l){
            return React.createElement('span', {key:l, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',fontWeight:600}}, '🗣 ' + l);
          })
        ) : null,
        /* Interests chips */
        interests.length > 0 ? React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',justifyContent:'center',marginTop:'8px',padding:'0 16px'}},
          interests.map(function(i){
            return React.createElement('span', {key:i, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--acg)',color:'var(--ac)',fontSize:'11px',fontWeight:600}}, '#' + i);
          })
        ) : null,
        /* Preference */
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'16px'}}, 'Looking for: ',
          React.createElement('span', {style:{color:'var(--text)',fontWeight:700}},
            preference === 'women' ? '👧 Girls' : preference === 'men' ? '👦 Boys' : '✨ Anyone'
          )
        ),
        /* Edit button */
        React.createElement('button', {
          onClick:function(){ setEditProfileOpen(true); },
          style:{marginTop:'24px',padding:'12px 32px',borderRadius:'12px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',boxShadow:'0 4px 14px rgba(123,110,255,0.35)'}
        }, '✏️ Edit Profile')
      );
    })(),

    /* ════════ EDIT PROFILE MODAL ════════ */
    editProfileOpen ? React.createElement('div', {
      onClick:function(){ setEditProfileOpen(false); },
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}
    },
      React.createElement('div', {
        onClick:function(e){ e.stopPropagation(); },
        style:{width:'100%',maxWidth:'520px',maxHeight:'90vh',overflowY:'auto',background:'var(--bg)',borderRadius:'18px 18px 0 0',padding:'18px',boxSizing:'border-box'}
      },
        /* Modal header */
        React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}},
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'18px',fontWeight:800,color:'var(--text)'}}, 'Edit Profile'),
          React.createElement('button', {onClick:function(){ setEditProfileOpen(false); }, style:{background:'transparent',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer'}}, '✕')
        ),
        React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',textAlign:'right',marginBottom:'12px'}}, 'Auto-saves as you type'),

        /* Avatar picker (gender-filtered) */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}, 'Avatar'),
        (function(){
          var filtered = gender === 'm' ? ANON_AVATARS.filter(function(a){ return a.gender === 'm'; })
                       : gender === 'f' ? ANON_AVATARS.filter(function(a){ return a.gender === 'f'; })
                       : ANON_AVATARS;
          return React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat(' + (filtered.length<6?'3':'6') + ',1fr)',gap:'10px',marginBottom:'14px'}},
            filtered.map(function(a){
              var sel = avatarId === a.id;
              return React.createElement('button', {
                key:a.id, onClick:function(){ setAvatarId(a.id); },
                style:{aspectRatio:'1/1',borderRadius:'50%',background:a.bg,border:sel?'3px solid #fff':'3px solid transparent',outline:sel?'2px solid var(--ac)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',cursor:'pointer',padding:0,boxShadow:sel?'0 4px 14px rgba(123,110,255,0.5)':'none',transition:'all 0.15s'}
              }, a.emoji);
            })
          );
        })(),

        /* Nickname */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Nickname'),
        React.createElement('input', {
          value:nick, onChange:function(e){setNick(e.target.value.slice(0,30));},
          placeholder:'e.g. Riya, Arjun', maxLength:30,
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'14px',outline:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}
        }),

        /* Caption */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Caption / Bio'),
        React.createElement('input', {
          value:caption, onChange:function(e){setCaption(e.target.value.slice(0,80));},
          placeholder:'Tell people something about you', maxLength:80,
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'13px',outline:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}
        }),

        /* From */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'From'),
        React.createElement('input', {
          value:fromLoc, onChange:function(e){setFromLoc(e.target.value.slice(0,40));},
          placeholder:'e.g. Mumbai, India', maxLength:40,
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'13px',outline:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}
        }),

        /* Languages (space-to-add chips) */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Languages'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}},
          languages.map(function(l){
            return React.createElement('span', {key:l, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--bg3)',color:'var(--text)',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}},
              l,
              React.createElement('span', {onClick:function(){removeLanguage(l);}, style:{cursor:'pointer',fontSize:'14px',lineHeight:1}}, '×')
            );
          })
        ),
        React.createElement('input', {
          value:langInput, onChange:onLangInputChange,
          onKeyDown:function(e){ if (e.key === 'Enter' && langInput.trim()) addLanguage(langInput); },
          placeholder:'Type a language + space (English Hindi Tamil)',
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'13px',outline:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}
        }),

        /* Interests */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Interests'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}},
          interests.map(function(i){
            return React.createElement('span', {key:i, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--acg)',color:'var(--ac)',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}},
              i,
              React.createElement('span', {onClick:function(){removeInterest(i);}, style:{cursor:'pointer',fontSize:'14px',lineHeight:1}}, '×')
            );
          })
        ),
        React.createElement('input', {
          value:input, onChange:onInterestInputChange,
          onKeyDown:function(e){ if (e.key === 'Enter' && input.trim()) addInterest(input); },
          placeholder:'Type an interest + space (music tech travel)',
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'13px',outline:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}
        }),

        /* Preference */
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'I want to talk to'),
        React.createElement('div', {style:{display:'flex',gap:'8px',marginBottom:'14px'}},
          [{k:'women',l:'👧 Girls'},{k:'men',l:'👦 Boys'},{k:'both',l:'✨ Anyone'}].map(function(p){
            var sel = preference === p.k;
            return React.createElement('button', {
              key:p.k, onClick:function(){ setPreference(p.k); },
              style:{flex:1,padding:'10px 6px',border:sel?'2px solid var(--ac)':'1px solid var(--border)',background:sel?'rgba(123,110,255,0.12)':'var(--bg3)',color:sel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
            }, p.l);
          })
        ),

        /* Geo toggle */
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',marginBottom:'14px',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}},
          React.createElement('div', null,
            React.createElement('div', {style:{fontSize:'12px',fontWeight:600,color:'var(--text)'}}, 'Match local users only'),
            React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, 'Prefer your city/state')
          ),
          React.createElement('button', {onClick:function(){setSameGeo(!sameGeo);}, style:{width:'44px',height:'24px',borderRadius:'12px',background:sameGeo?'var(--ac)':'var(--bg4)',border:'none',position:'relative',cursor:'pointer'}},
            React.createElement('div', {style:{position:'absolute',top:'2px',left:sameGeo?'22px':'2px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}})
          )
        ),

        /* Done button */
        React.createElement('button', {
          onClick:function(){ setEditProfileOpen(false); },
          style:{width:'100%',padding:'13px',borderRadius:'12px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer'}
        }, 'Done')
      )
    ) : null,

    /* ════════ VIEW CONNECTION PROFILE MODAL ════════ */
    viewingProfile ? (function(){
      var vp = viewingProfile;
      var va = getAvatar(vp.avatar || 'girl1');
      var vlangs = (vp.languages && Array.isArray(vp.languages)) ? vp.languages : [];
      return React.createElement('div', {
        onClick:function(){ setViewingProfile(null); },
        /* R35: zIndex 950 so this overlay sits ABOVE the in-progress
         * CallScreen (which is at zIndex 900). Lets the user view a
         * connection's profile during a call without ending the call. */
        style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:950,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}
      },
        React.createElement('div', {
          onClick:function(e){ e.stopPropagation(); },
          style:{width:'100%',maxWidth:'380px',background:'var(--bg)',borderRadius:'18px',padding:'24px 20px',boxSizing:'border-box',textAlign:'center',position:'relative'}
        },
          React.createElement('button', {onClick:function(){ setViewingProfile(null); }, style:{position:'absolute',top:'10px',right:'12px',background:'transparent',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer'}}, '✕'),
          React.createElement('div', {style:{width:'110px',height:'110px',borderRadius:'50%',background:va.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'54px',margin:'4px auto 14px',boxShadow:'0 6px 20px rgba(123,110,255,0.25)',position:'relative'}},
            va.emoji,
            vp.is_online ? React.createElement('div', {style:{position:'absolute',bottom:'6px',right:'6px',width:'16px',height:'16px',borderRadius:'50%',background:'#27C96A',border:'3px solid var(--bg)'}}) : null
          ),
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)'}}, vp.nickname || 'Anonymous'),
          React.createElement('div', {style:{fontSize:'12px',color:vp.is_online?'#27C96A':'var(--t3)',marginTop:'4px'}}, vp.is_online ? '🟢 Online now' : 'Offline'),
          vp.gender ? React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',marginTop:'6px'}}, vp.gender === 'm' ? '👦 Boy' : vp.gender === 'f' ? '👧 Girl' : '🌈 Other') : null,
          vp.caption ? React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',marginTop:'12px',fontStyle:'italic',lineHeight:1.4}}, '"' + vp.caption + '"') : null,
          vp.from_loc ? React.createElement('div', {style:{fontSize:'12px',color:'var(--text)',marginTop:'10px'}}, '📍 ' + vp.from_loc) : null,
          vlangs.length > 0 ? React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',justifyContent:'center',marginTop:'12px'}},
            vlangs.map(function(l){ return React.createElement('span', {key:l, style:{padding:'4px 9px',borderRadius:'12px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',fontWeight:600}}, '🗣 ' + l); })
          ) : null,
          React.createElement('div', {style:{display:'flex',gap:'8px',marginTop:'20px',justifyContent:'center'}},
            React.createElement('button', {
              /* R45: opens the chat with this connection directly. */
              onClick:function(){ setViewingProfile(null); openAnonChat({ user_id: vp.user_id, nickname: vp.nickname, avatar: vp.avatar, gender: vp.gender, is_online: vp.is_online }); },
              style:{padding:'10px 20px',borderRadius:'10px',background:'var(--bg4)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'12px',fontWeight:700,cursor:'pointer'}
            }, '💬 Message'),
            React.createElement('button', {
              onClick:function(){ setViewingProfile(null); callConnection({ user_id: vp.user_id, nickname: vp.nickname, avatar: vp.avatar, gender: vp.gender, is_online: vp.is_online }); },
              disabled: !vp.is_online,
              style:{padding:'10px 22px',borderRadius:'10px',background:vp.is_online?'linear-gradient(135deg,#27C96A,#1D9E75)':'var(--bg4)',border:vp.is_online?'none':'1px solid var(--border)',color:vp.is_online?'#fff':'var(--t3)',fontSize:'12px',fontWeight:700,cursor:vp.is_online?'pointer':'not-allowed'}
            }, '📞 Call')
          )
        )
      );
    })() : null,

    /* ════════ R46: Safety bottom sheet — Block / Report / Mute ════════ */
    safetySheetFor ? (function(){
      var sa = getAvatar(safetySheetFor.avatar || 'girl1');
      return React.createElement('div', {
        onClick: function(){ setSafetySheetFor(null); },
        /* zIndex 960 — above the CallScreen (900) and the profile-view modal
         * (950) so you can pull this up while on a call. */
        style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:960,display:'flex',alignItems:'flex-end',justifyContent:'center'}
      },
        React.createElement('div', {
          onClick: function(e){ e.stopPropagation(); },
          style:{width:'100%',maxWidth:'520px',background:'var(--bg2)',borderRadius:'18px 18px 0 0',padding:'18px 16px 22px',boxSizing:'border-box',boxShadow:'0 -6px 28px rgba(0,0,0,0.4)'}
        },
          React.createElement('div', {style:{width:'40px',height:'4px',borderRadius:'2px',background:'var(--border)',margin:'0 auto 16px'}}),
          React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'18px'}},
            React.createElement('div', {style:{width:'36px',height:'36px',borderRadius:'50%',background:sa.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}, sa.emoji),
            React.createElement('div', {style:{flex:1,minWidth:0}},
              React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'15px',fontWeight:800,color:'var(--text)'}}, 'Make a quiet move'),
              React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)'}}, 'For ' + (safetySheetFor.nickname || 'Anonymous'))
            )
          ),
          /* Block (destructive — red) */
          React.createElement('button', {
            onClick: performBlock,
            style:{width:'100%',padding:'14px',background:'rgba(225,59,47,0.08)',border:'1px solid rgba(225,59,47,0.3)',borderRadius:'12px',color:'#E13B2F',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:'8px',display:'flex',alignItems:'center',gap:'10px',textAlign:'left'}
          },
            React.createElement('span', {style:{fontSize:'18px'}}, '🚫'),
            React.createElement('span', null, 'Block & end call'),
            React.createElement('span', {style:{flex:1}}, ''),
            React.createElement('span', {style:{fontSize:'11px',color:'rgba(225,59,47,0.6)',fontWeight:500}}, "You won't see them again")
          ),
          /* Report */
          React.createElement('button', {
            onClick: openReportPicker,
            style:{width:'100%',padding:'14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:'8px',display:'flex',alignItems:'center',gap:'10px',textAlign:'left'}
          },
            React.createElement('span', {style:{fontSize:'18px'}}, '🚩'),
            React.createElement('span', null, 'Report (anonymous)'),
            React.createElement('span', {style:{flex:1}}, ''),
            React.createElement('span', {style:{fontSize:'11px',color:'var(--t3)',fontWeight:500}}, "They won't know")
          ),
          /* Cancel */
          React.createElement('button', {
            onClick: function(){ setSafetySheetFor(null); },
            style:{width:'100%',padding:'13px',background:'transparent',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',marginTop:'6px'}
          }, 'Cancel')
        )
      );
    })() : null,

    /* ════════ R47: Gift drawer — Tango/Bigo-style 3-tier picker ════════ */
    giftDrawerOpen && activeChat ? React.createElement('div', {
      onClick: function(){ if (!giftSendingKey) setGiftDrawerOpen(false); },
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:960,display:'flex',alignItems:'flex-end',justifyContent:'center'}
    },
      React.createElement('div', {
        onClick: function(e){ e.stopPropagation(); },
        style:{width:'100%',maxWidth:'520px',background:'var(--bg2)',borderRadius:'18px 18px 0 0',padding:'18px 16px 22px',boxSizing:'border-box',boxShadow:'0 -6px 28px rgba(0,0,0,0.4)',maxHeight:'80vh',overflowY:'auto'}
      },
        React.createElement('div', {style:{width:'40px',height:'4px',borderRadius:'2px',background:'var(--border)',margin:'0 auto 16px'}}),
        React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}},
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'17px',fontWeight:800,color:'var(--text)',flex:1}}, 'Send a gift to ' + (activeChat.nickname || 'Anonymous'))
        ),
        /* Tier sections */
        ['sticker','premium','mega'].map(function(tier){
          var label = tier === 'sticker' ? '💌 Stickers' : tier === 'premium' ? '💎 Premium' : '🚀 Mega';
          var gifts = GIFT_CATALOG.filter(function(g){ return g.tier === tier; });
          return React.createElement('div', {key: tier, style:{marginBottom:'18px'}},
            React.createElement('div', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}, label),
            React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}},
              gifts.map(function(g){
                var sending = giftSendingKey === g.key;
                return React.createElement('button', {
                  key: g.key,
                  onClick: function(){ sendChatGift(g); },
                  disabled: !!giftSendingKey,
                  style:{padding:'14px 8px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',cursor: giftSendingKey ? 'wait' : 'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',opacity: giftSendingKey && !sending ? 0.5 : 1, transition:'transform 0.12s'}
                },
                  React.createElement('div', {style:{fontSize: tier === 'mega' ? '34px' : (tier === 'premium' ? '30px' : '26px'),lineHeight:1}}, g.emoji),
                  React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--text)'}}, g.name),
                  React.createElement('div', {style:{fontSize:'10px',color:'var(--ac)',fontWeight:700}}, sending ? 'Sending…' : (g.coins + ' 🪙'))
                );
              })
            )
          );
        }),
        React.createElement('button', {
          onClick: function(){ if (!giftSendingKey) setGiftDrawerOpen(false); },
          style:{width:'100%',padding:'13px',background:'transparent',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor: giftSendingKey ? 'wait' : 'pointer',marginTop:'8px'}
        }, 'Close')
      )
    ) : null,

    /* ════════ R46: Report-reason picker ════════ */
    reportSheetFor ? (function(){
      var reasons = [
        { k:'harassment', l:'😡 Harassment',     hint:'Threats, hate, abusive language' },
        { k:'sexual',     l:'🔞 Sexual content', hint:'Explicit or inappropriate' },
        { k:'underage',   l:'🚸 Underage',       hint:'Appears under 18' },
        { k:'scam',       l:'💸 Scam / spam',     hint:'Asking for money or links' },
        { k:'hate',       l:'🛑 Hate speech',     hint:'Targeting identity' },
        { k:'other',      l:'❓ Other',           hint:'Something else' },
      ];
      return React.createElement('div', {
        onClick: function(){ if (!reportSending) setReportSheetFor(null); },
        style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:960,display:'flex',alignItems:'flex-end',justifyContent:'center'}
      },
        React.createElement('div', {
          onClick: function(e){ e.stopPropagation(); },
          style:{width:'100%',maxWidth:'520px',background:'var(--bg2)',borderRadius:'18px 18px 0 0',padding:'18px 16px 22px',boxSizing:'border-box',boxShadow:'0 -6px 28px rgba(0,0,0,0.4)',maxHeight:'80vh',overflowY:'auto'}
        },
          React.createElement('div', {style:{width:'40px',height:'4px',borderRadius:'2px',background:'var(--border)',margin:'0 auto 16px'}}),
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'17px',fontWeight:800,color:'var(--text)',marginBottom:'4px'}}, 'Why are you reporting?'),
          React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginBottom:'16px'}}, 'Reports are anonymous. We review every one.'),
          reasons.map(function(r){
            return React.createElement('button', {
              key: r.k,
              onClick: function(){ performReport(r.k); },
              disabled: reportSending,
              style:{width:'100%',padding:'14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor: reportSending ? 'wait' : 'pointer',fontFamily:'inherit',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px',textAlign:'left',opacity: reportSending ? 0.5 : 1}
            },
              React.createElement('span', {style:{fontSize:'16px',flexShrink:0}}, r.l.split(' ')[0]),
              React.createElement('div', {style:{flex:1,minWidth:0}},
                React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, r.l.split(' ').slice(1).join(' ')),
                React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'1px'}}, r.hint)
              ),
              React.createElement('span', {style:{fontSize:'16px',color:'var(--t3)'}}, '›')
            );
          }),
          React.createElement('button', {
            onClick: function(){ if (!reportSending) setReportSheetFor(null); },
            style:{width:'100%',padding:'13px',background:'transparent',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor: reportSending ? 'wait' : 'pointer',marginTop:'10px'}
          }, 'Cancel')
        )
      );
    })() : null
  );
}
