/* eslint-disable */
import React, {useState, useRef, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastError, toastInfo} from '../utils/toast';

var SUGGESTED = ['tech','startups','fitness','music','travel','finance','mental health','career','parenting','design','food','movies','gaming','meditation','philosophy'];

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

  function addInterest(i) {
    var v = (i || '').trim().toLowerCase();
    if (v && interests.indexOf(v) < 0) setInterests(interests.concat([v]));
    setInput('');
  }
  function removeInterest(i) {
    setInterests(interests.filter(function(x){ return x !== i; }));
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
   * stays "available" while the screen is open. */
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    // Initial fetch: am I available?
    try {
      sb.from('profiles').select('is_available_anon,available_until').eq('id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) {
          var stillValid = !r.data.available_until || new Date(r.data.available_until) > new Date();
          setAvailable(!!r.data.is_available_anon && stillValid);
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

    // Match found
    match && !searching && React.createElement('div', {style:{padding:'24px',margin:'16px',background:'linear-gradient(135deg,rgba(123,110,255,0.15),rgba(232,77,154,0.1))',border:'1px solid var(--ac)',borderRadius:'14px',textAlign:'center'}},
      match.profile && match.profile.avatar_url
        ? React.createElement('img', {src:match.profile.avatar_url, alt:'', style:{width:'80px',height:'80px',borderRadius:'50%',objectFit:'cover',margin:'0 auto'}})
        : React.createElement('div', {style:{width:'80px',height:'80px',borderRadius:'50%',background:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'32px',margin:'0 auto'}}, (match.profile && match.profile.name || 'A').charAt(0)),
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'20px',fontWeight:700,color:'var(--text)',marginTop:'14px'}}, (match.profile && match.profile.name) || 'Anonymous'),
      match.profile && match.profile.city && React.createElement('div', {style:{fontSize:'12px',color:'var(--t3)',marginTop:'4px'}}, '📍 ' + match.profile.city + (match.profile.country ? ', ' + match.profile.country : '')),
      match.reasons && match.reasons.length > 0 && React.createElement('div', {style:{marginTop:'12px',display:'flex',flexWrap:'wrap',gap:'6px',justifyContent:'center'}},
        match.reasons.map(function(r, i){
          return React.createElement('span', {key:i, style:{padding:'4px 10px',borderRadius:'12px',background:'var(--acg)',color:'var(--ac)',fontSize:'11px',fontWeight:600}}, r);
        })
      ),
      // R27: Connect Voice restored. Uses the same window.__ringInStartCall
      // pipeline as expert calls — creates a real call_invites row, fires
      // FCM push to the matched user, both join an Agora channel. Anonymous
      // calls have rate=0 (free). Match's user_id IS a real Supabase UUID
      // so the call_invites UUID regex passes.
      React.createElement('div', {style:{display:'flex',gap:'10px',marginTop:'20px',justifyContent:'center'}},
        React.createElement('button', {
          onClick:skip,
          style:{padding:'10px 18px',borderRadius:'10px',background:'var(--bg4)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontWeight:700,cursor:'pointer'}
        }, 'Skip'),
        React.createElement('button', {
          onClick:function(){
            var target = {
              id: match.user_id || (match.profile && match.profile.id),
              name: (match.profile && match.profile.name) || 'Anonymous',
              avatar: (match.profile && match.profile.avatar_url) || null,
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
    ),

    // Setup
    !searching && !match && React.createElement('div', {style:{padding:'16px'}},
      React.createElement('p', {style:{fontSize:'13px',color:'var(--t2)',marginBottom:'18px'}}, 'Talk to a stranger by interests and geography. Privacy-first.'),

      React.createElement('div', {style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'12px'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}}, 'Your Interests'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px',minHeight:'30px'}},
          interests.map(function(i){
            return React.createElement('span', {key:i, style:{padding:'5px 10px',borderRadius:'14px',background:'var(--acg)',color:'var(--ac)',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}},
              i,
              React.createElement('span', {onClick:function(){removeInterest(i);}, style:{cursor:'pointer'}}, '×')
            );
          })
        ),
        React.createElement('input', {
          value:input,
          onChange:function(e){setInput(e.target.value);},
          onKeyDown:function(e){if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && input.trim()){addInterest(input);}}, /* FIX #2: IME composition guard */
          placeholder:'Type and press Enter',
          style:{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'13px',outline:'none',boxSizing:'border-box'},
        }),
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'10px',marginBottom:'6px'}}, 'Quick add:'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'5px'}},
          SUGGESTED.filter(function(s){return interests.indexOf(s)<0;}).slice(0,8).map(function(s){
            return React.createElement('button', {key:s, onClick:function(){addInterest(s);}, style:{padding:'4px 10px',borderRadius:'12px',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'11px',fontWeight:600,cursor:'pointer'}}, '+ ' + s);
          })
        )
      ),

      // Geography toggle
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
