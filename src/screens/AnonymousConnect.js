/* eslint-disable */
import React, {useState, useRef, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastError, toastInfo} from '../utils/toast';

// R31: removed SUGGESTED chips per user request. Interests are now free-text
// with space-to-add UX.

// R31: 6 anonymous avatars — 3 "girl"-styled + 3 "boy"-styled. Uses emoji
// so we don't ship image assets; each gets a distinct gradient background
// for visual variety. The 'id' is what's stored in profiles.anon_avatar.
var ANON_AVATARS = [
  { id:'girl1', emoji:'👩',  gender:'f', bg:'linear-gradient(135deg,#FF6B9D,#E84D9A)' },
  { id:'girl2', emoji:'👧',  gender:'f', bg:'linear-gradient(135deg,#A78BFA,#7B6EFF)' },
  { id:'girl3', emoji:'🧕',  gender:'f', bg:'linear-gradient(135deg,#FB7185,#F43F5E)' },
  { id:'boy1',  emoji:'👨',  gender:'m', bg:'linear-gradient(135deg,#3B82F6,#1D4ED8)' },
  { id:'boy2',  emoji:'👦',  gender:'m', bg:'linear-gradient(135deg,#10B981,#059669)' },
  { id:'boy3',  emoji:'🧔',  gender:'m', bg:'linear-gradient(135deg,#F59E0B,#D97706)' },
];
function getAvatar(id){ return ANON_AVATARS.find(function(a){ return a.id === id; }) || ANON_AVATARS[0]; }

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
  var matchS = useState(null); var match = matchS[0]; var setMatch = matchS[1];
  var excludeS = useState([]); var exclude = excludeS[0]; var setExclude = excludeS[1];
  var errS = useState(null); var err = errS[0]; var setErr = errS[1];
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
  /* R31: anonymous identity (nickname + avatar + gender + preference). */
  var nickS = useState(''); var nick = nickS[0]; var setNick = nickS[1];
  var avatarIdS = useState('girl1'); var avatarId = avatarIdS[0]; var setAvatarId = avatarIdS[1];
  var genderS = useState('f'); var gender = genderS[0]; var setGender = genderS[1];
  var preferenceS = useState('both'); var preference = preferenceS[0]; var setPreference = preferenceS[1];
  var profileSavedRef = useRef(false);
  var saveProfileTimerRef = useRef(null);

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
   * deduction. The callee gets the standard incoming call ring. */
  function startMatchedCall(matchData){
    var partner = matchData.partner_id;
    if (matchData.is_caller) {
      var target = {
        id: partner,
        name: 'Anonymous',
        avatar: null,
        role: 'Anonymous Connect',
        online: true,
      };
      try {
        if (typeof window !== 'undefined' && typeof window.__ringInStartCall === 'function') {
          window.__ringInStartCall(target, { rate: 0, anonymous: true });
        } else {
          toastError('Call pipeline not ready — try again');
        }
      } catch(e){ console.warn('[anon] start call failed:', e); toastError('Could not start call'); }
    } else {
      /* Callee side — the partner is dialing us via the standard call_invites
       * pipeline. App.js's incoming-call listener will pop the ring modal.
       * Nothing for us to do except wait + show a quick toast. */
      try { toastInfo('Matched! Incoming call from a stranger…'); } catch(_){}
    }
  }

  function find(excludeOverride) {
    if (!userId) { toastError('Please log in'); return; }
    /* R30: auto-enable availability so others can see + match with us. */
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
    setSearching(true); setErr(null); setMatch(null); setSecsLeft(30);
    var useExclude = Array.isArray(excludeOverride) ? excludeOverride : exclude;
    deadlineRef.current = Date.now() + 30 * 1000;

    function handleMatched(matchData){
      stopSearching();
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

  function skip() {
    /* Skipped a match — add the partner to exclude list and re-find. */
    if (!match) return;
    var skippedId = match.user_id || match.id;
    var newExclude = (exclude || []).concat(skippedId ? [skippedId] : []);
    setExclude(newExclude);
    setMatch(null);
    find(newExclude);
  }

  /* Cleanup on unmount — leave the queue + clear timers so we don't keep
   * polling after the screen is gone. */
  useEffect(function(){
    return function(){ stopSearching(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* R30: load initial availability state + start polling the live count
   * every 15 sec. Also heartbeat the expiry every 5 min so the user
   * stays "available" while the screen is open. R31: also loads the
   * persistent anonymous profile (nickname/avatar/gender/preference). */
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    // Initial fetch: availability + anonymous profile
    try {
      sb.from('profiles').select('is_available_anon,available_until,anon_nickname,anon_avatar,anon_gender,anon_preference').eq('id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) {
          var stillValid = !r.data.available_until || new Date(r.data.available_until) > new Date();
          setAvailable(!!r.data.is_available_anon && stillValid);
          // R31: hydrate anonymous profile (don't overwrite user's local edits)
          if (r.data.anon_nickname) setNick(r.data.anon_nickname);
          if (r.data.anon_avatar)   setAvatarId(r.data.anon_avatar);
          if (r.data.anon_gender)   setGender(r.data.anon_gender);
          if (r.data.anon_preference) setPreference(r.data.anon_preference);
          profileSavedRef.current = true;
        }
      }).catch(function(){});
    } catch(_){}
    function pollCount(){
      try {
        sb.from('available_anon_count').select('count').maybeSingle().then(function(r){
          if (cancelled) return;
          if (r && !r.error && r.data) setOnlineCount(r.data.count || 0);
        }).catch(function(){});
      } catch(_){}
    }
    pollCount();
    countPollRef.current = setInterval(pollCount, 15000);
    return function(){
      cancelled = true;
      if (countPollRef.current) { clearInterval(countPollRef.current); countPollRef.current = null; }
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
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
   * stops typing/changing — avoids spamming the RPC on every keystroke. */
  useEffect(function(){
    if (!userId) return;
    // Don't save on initial mount before we've loaded
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
          else profileSavedRef.current = true;
        }).catch(function(){});
      } catch(_){}
    }, 600);
    return function(){
      if (saveProfileTimerRef.current) { clearTimeout(saveProfileTimerRef.current); saveProfileTimerRef.current = null; }
    };
  }, [nick, avatarId, gender, preference, userId]);

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

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div', {style:{position:'sticky',top:0,zIndex:10,background:'var(--bg2)',padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid var(--border)'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'26px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🎭 Anonymous Connect')
    ),

    /* R30: live-online card. Always visible at the top. Big animated green
     * dot when ON + live count of available users in the entire app. */
    React.createElement('div', {style:{margin:'14px 16px 0',padding:'16px',background:'var(--bg2)',border:'1px solid '+(available ? 'rgba(39,201,106,0.35)' : 'var(--border)'),borderRadius:'14px',display:'flex',alignItems:'center',gap:'14px',boxShadow:available?'0 0 0 1px rgba(39,201,106,0.2),0 4px 16px rgba(39,201,106,0.15)':'none',transition:'all 0.25s'}},
      // Dot + label
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
      // Toggle
      React.createElement('button', {
        onClick: toggleAvailable,
        disabled: availToggling,
        style:{width:'46px',height:'26px',borderRadius:'13px',background:available?'#27C96A':'var(--border)',border:'none',cursor:availToggling?'wait':'pointer',position:'relative',flexShrink:0,transition:'background 0.2s',opacity:availToggling?0.6:1}
      },
        React.createElement('div', {style:{position:'absolute',top:'3px',left:available?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
      )
    ),

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

    // Match found — R31: shows partner's avatar emoji + nickname + gender
    match && !searching && (function(){
      var pa = getAvatar(match.partner_avatar || match.avatarId || 'girl1');
      return React.createElement('div', {style:{padding:'24px',margin:'16px',background:'linear-gradient(135deg,rgba(123,110,255,0.15),rgba(232,77,154,0.1))',border:'1px solid var(--ac)',borderRadius:'14px',textAlign:'center'}},
        React.createElement('div', {style:{width:'80px',height:'80px',borderRadius:'50%',background:pa.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'40px',margin:'0 auto'}}, pa.emoji),
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'20px',fontWeight:700,color:'var(--text)',marginTop:'14px'}}, match.partner_nickname || 'Anonymous'),
        match.partner_gender ? React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'4px'}}, match.partner_gender === 'f' ? '👧 Girl' : '👦 Boy') : null,
      // R27: Connect Voice — uses same window.__ringInStartCall pipeline as expert calls
      React.createElement('div', {style:{display:'flex',gap:'10px',marginTop:'20px',justifyContent:'center'}},
        React.createElement('button', {
          onClick:skip,
          style:{padding:'10px 18px',borderRadius:'10px',background:'var(--bg4)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontWeight:700,cursor:'pointer'}
        }, 'Skip'),
        React.createElement('button', {
          onClick:function(){
            var target = {
              id: match.partner_id || match.user_id,
              name: match.partner_nickname || 'Anonymous',
              avatar: null,
              role: 'Anonymous Connect',
              online: true,
            };
            if (!target.id) { toastError('Match has no user id — cannot connect'); return; }
            try {
              if (typeof window !== 'undefined' && typeof window.__ringInStartCall === 'function') {
                /* Anonymous calls are free — rate=0 means no coin deduction. */
                window.__ringInStartCall(target, { rate: 0, anonymous: true });
              } else {
                toastError('Call pipeline not ready — try again in a sec');
              }
            } catch(e){ console.warn('[anon-connect] start call failed:', e); toastError('Could not start call'); }
          },
          style:{padding:'10px 22px',borderRadius:'10px',background:'linear-gradient(135deg,#27C96A,#1D9E75)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',boxShadow:'0 4px 14px rgba(39,201,106,0.35)'}
        }, '📞 Connect Voice')
      )
    );
    })(),

    // Setup — R31 layout: anonymous profile card → interests → gender prefs → geo → find
    !searching && !match && React.createElement('div', {style:{padding:'16px'}},

      // ── R31: Anonymous identity card (nickname + avatar + gender) ──
      React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'12px'}}, 'Your Anonymous Identity'),
        // Nickname
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Nickname'),
        React.createElement('input', {
          value:nick,
          onChange:function(e){setNick(e.target.value.slice(0,30));},
          placeholder:'e.g. Riya, Arjun, Whoever',
          maxLength:30,
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'14px',outline:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}
        }),
        // Avatar grid
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}, 'Pick an avatar'),
        React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'8px',marginBottom:'14px'}},
          ANON_AVATARS.map(function(a){
            var sel = avatarId === a.id;
            return React.createElement('button', {
              key:a.id,
              onClick:function(){ setAvatarId(a.id); /* auto-align gender to avatar's gender as a sensible default */ if (a.gender !== gender) setGender(a.gender); },
              style:{aspectRatio:'1/1',borderRadius:'50%',background:a.bg,border:sel?'3px solid #fff':'3px solid transparent',outline:sel?'2px solid var(--ac)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',cursor:'pointer',padding:0,boxShadow:sel?'0 4px 14px rgba(123,110,255,0.5)':'none',transition:'all 0.15s'},
              title:a.id
            }, a.emoji);
          })
        ),
        // Gender chooser
        React.createElement('div', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, "I'm a"),
        React.createElement('div', {style:{display:'flex',gap:'8px',marginBottom:'4px'}},
          [{k:'f',l:'👧 Girl'},{k:'m',l:'👦 Boy'}].map(function(g){
            var sel = gender === g.k;
            return React.createElement('button', {
              key:g.k, onClick:function(){ setGender(g.k); },
              style:{flex:1,padding:'10px',border:sel?'2px solid var(--ac)':'1px solid var(--border)',background:sel?'rgba(123,110,255,0.12)':'var(--bg3)',color:sel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
            }, g.l);
          })
        )
      ),

      // ── R31: Preference filter — who do you want to match with? ──
      React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}}, 'I want to talk to'),
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginBottom:'12px'}}, "We'll only match you with people who also want to talk to your gender."),
        React.createElement('div', {style:{display:'flex',gap:'8px'}},
          [{k:'women',l:'👧 Girls'},{k:'men',l:'👦 Boys'},{k:'both',l:'✨ Anyone'}].map(function(p){
            var sel = preference === p.k;
            return React.createElement('button', {
              key:p.k, onClick:function(){ setPreference(p.k); },
              style:{flex:1,padding:'10px 6px',border:sel?'2px solid var(--ac)':'1px solid var(--border)',background:sel?'rgba(123,110,255,0.12)':'var(--bg3)',color:sel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
            }, p.l);
          })
        )
      ),

      // ── R31: Interests (no chip suggestions, space-to-add) ──
      React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}}, 'Your Interests'),
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginBottom:'10px'}}, 'Type and hit space to add. People with shared interests get matched first.'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px',minHeight:interests.length===0?'0':'30px'}},
          interests.map(function(i){
            return React.createElement('span', {key:i, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--acg)',color:'var(--ac)',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}},
              i,
              React.createElement('span', {onClick:function(){removeInterest(i);}, style:{cursor:'pointer',fontSize:'14px',lineHeight:1}}, '×')
            );
          })
        ),
        React.createElement('input', {
          value:input,
          onChange:onInterestInputChange,
          onKeyDown:function(e){
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && input.trim()) {
              addInterest(input);
            }
          },
          placeholder:'Type an interest + space (e.g. music tech travel)',
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'13px',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}
        })
      ),

      // ── Geography toggle ──
      React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'14px',marginBottom:'14px',display:'flex',alignItems:'center',justifyContent:'space-between'}},
        React.createElement('div', null,
          React.createElement('div', {style:{fontWeight:600,fontSize:'13px',color:'var(--text)'}}, 'Match local users only'),
          React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, 'Prefer people in your city/state')
        ),
        React.createElement('button', {onClick:function(){setSameGeo(!sameGeo);}, style:{width:'44px',height:'24px',borderRadius:'12px',background:sameGeo?'var(--ac)':'var(--bg4)',border:'none',position:'relative',cursor:'pointer'}},
          React.createElement('div', {style:{position:'absolute',top:'2px',left:sameGeo?'22px':'2px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}})
        )
      ),

      err && React.createElement('div', {style:{padding:'12px',background:'rgba(239,71,71,0.1)',border:'1px solid var(--red)',borderRadius:'10px',color:'var(--red)',fontSize:'12px',marginBottom:'12px'}}, err),

      React.createElement('button', {onClick:find, style:{width:'100%',padding:'14px',borderRadius:'12px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer'}}, '🎯 Find Someone to Talk To')
    )
  );
}
