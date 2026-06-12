/* eslint-disable */
/* ════════════════════════════════════════════════════════════════════
 * FriendsScreen.js — Real Friends v3 (R64.1).
 *
 * Replaces the v2 vertical filter panel with a LinkedIn-style horizontal
 * scrollable pill row. Each pill is a filter chip — tap to open a
 * bottom sheet picker for that one filter. Suggestion cards are now
 * Instagram/LinkedIn-style block cards in a horizontal scroll lane.
 *
 * UI structure:
 *   - Header
 *   - Search bar
 *   - Horizontal filter pill row (no scrollbar visible)
 *   - "Suggested for you" — horizontal block cards (no scrollbar visible)
 *   - Result list (vertical)
 *   - Bottom sheet picker (appears when a pill is tapped)
 *   - Setup modal (first time + edit)
 *   - Profile modal (tap any result)
 * ════════════════════════════════════════════════════════════════════ */

import React, {useState, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastError, toastInfo} from '../utils/toast';
import {searchCities} from '../utils/worldCities';
import {Skeleton} from '../components/Skeleton'; /* R54: shimmer skeleton on initial load (Bug 6) */
import {FollowButton, AddFriendButton, MessageButton} from '../components/FriendActions'; /* R55: shared follow + friend-request + message buttons */

/* Inject scrollbar-hide CSS once — used by every horizontal scroll
 * lane (filter pills + suggestion blocks). React inline styles can't
 * target ::-webkit-scrollbar, so a tiny global class is the cleanest
 * solution.
 *
 * R64.4: bumped ID + made the rule bulletproof with !important and
 * explicit 0 width/height. The previous version (v1) only said
 * 'display:none' which some Android WebView builds ignored. */
if (typeof document !== 'undefined') {
  /* Remove any earlier version of the style block. */
  var __oldStyle = document.getElementById('ringin-noscrollbar-css');
  if (__oldStyle) { try { __oldStyle.remove(); } catch(_){} }
  if (!document.getElementById('ringin-noscrollbar-css-v2')) {
    var __s = document.createElement('style');
    __s.id = 'ringin-noscrollbar-css-v2';
    __s.textContent = (
      '.ringin-hscroll{-ms-overflow-style:none !important;scrollbar-width:none !important}' +
      '.ringin-hscroll::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;background:transparent !important}' +
      '.ringin-hscroll::-webkit-scrollbar-track{display:none !important}' +
      '.ringin-hscroll::-webkit-scrollbar-thumb{display:none !important}'
    );
    document.head.appendChild(__s);
  }
}

var LANGUAGES = [
  { value: 'malayalam', label: 'Malayalam' },
  { value: 'tamil',     label: 'Tamil' },
  { value: 'telugu',    label: 'Telugu' },
  { value: 'kannada',   label: 'Kannada' },
  { value: 'hindi',     label: 'Hindi' },
  { value: 'punjabi',   label: 'Punjabi' },
  { value: 'bengali',   label: 'Bengali' },
  { value: 'marathi',   label: 'Marathi' },
  { value: 'gujarati',  label: 'Gujarati' },
  { value: 'arabic',    label: 'Arabic' },
  { value: 'urdu',      label: 'Urdu' },
  { value: 'english',   label: 'English' },
];

var INTEREST_SUGGESTIONS = [
  'films','music','cricket','football','tech','coding','food','travel',
  'photography','books','dance','yoga','gym','hiking','art','design','coffee',
  'tea','startup','business','fashion','beauty','gaming','anime','spirituality',
  'meditation','poetry','classical music','rap','singing','cooking','baking',
  'shopping','hospitality','medicine','nursing','teaching','finance'
];

function languageLabel(v) {
  for (var i = 0; i < LANGUAGES.length; i++) {
    if (LANGUAGES[i].value === v) return LANGUAGES[i].label;
  }
  return v ? (v.charAt(0).toUpperCase() + v.slice(1)) : '';
}

function gradientFromString(s) {
  var h = 0;
  for (var i = 0; i < (s || '').length; i++) h = ((h << 5) - h) + (s || '').charCodeAt(i);
  var palette = [
    'linear-gradient(135deg,#7B6EFF,#E84D9A)',
    'linear-gradient(135deg,#27C96A,#1D9E75)',
    'linear-gradient(135deg,#FFD700,#E84D9A)',
    'linear-gradient(135deg,#4A90E2,#7B6EFF)',
    'linear-gradient(135deg,#F5A623,#E84D9A)',
    'linear-gradient(135deg,#9013FE,#4A90E2)',
  ];
  return palette[Math.abs(h) % palette.length];
}

function initialOf(name) {
  return (name && name.trim().length > 0) ? name.trim().charAt(0).toUpperCase() : '?';
}

/* R64.8: parseBio — many existing users have their bio stored as a JSON
 * blob ({"about":"...","tag":"...","website_name":"...","typing":{...
 * sound prefs...},...}). Showing the raw blob in a profile modal looks
 * terrible. This extracts:
 *   - about: the actual human-readable bio
 *   - tag:   short occupation/role tag (e.g. "Digital marketing manager")
 *   - website: optional website name
 *
 * Handles three storage formats:
 *   1. JSON object string (most live RingIn users): {"about":"...",...}
 *   2. Plain string wrapped in quotes (our dummy seed): "Coffee + code..."
 *   3. Plain string (legacy users): just text. */
function parseBio(bio) {
  var empty = { about: '', tag: '', website: '' };
  if (!bio || typeof bio !== 'string') return empty;
  var s = bio.trim();
  if (!s) return empty;

  /* Format 2: outer quotes — peel them off. JSON.parse handles escaped
   * sequences like \n correctly. */
  if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
    try {
      var unwrapped = JSON.parse(s);
      if (typeof unwrapped === 'string') s = unwrapped;
    } catch (_) {
      s = s.slice(1, -1);
    }
  }

  /* Format 1: JSON object — extract about / tag / website. */
  if (s.length > 0 && s.charAt(0) === '{') {
    try {
      var obj = JSON.parse(s);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return {
          about: typeof obj.about === 'string' ? obj.about
                 : (typeof obj.bio === 'string' ? obj.bio
                    : (typeof obj.description === 'string' ? obj.description : '')),
          tag: typeof obj.tag === 'string' ? obj.tag
               : (typeof obj.title === 'string' ? obj.title : ''),
          website: typeof obj.website_name === 'string' ? obj.website_name : '',
        };
      }
    } catch (_) {
      /* Not valid JSON — fall through and treat as plain text. */
    }
  }

  /* Format 3 (or fallback): plain text. */
  return { about: s, tag: '', website: '' };
}

/* ── FilterPill — chip in the horizontal filter row ─────────────────
 * R64.2: bumped 20% bigger (12→14px text, 8/14→11/18px padding) per
 * user feedback the previous pills were too small to read. */
function FilterPill(props) {
  var active = !!props.value;
  return React.createElement('button', {
    onClick: props.onClick,
    style:{
      padding:'11px 18px',
      borderRadius:'22px',
      background: active ? 'linear-gradient(135deg,rgba(123,110,255,0.28),rgba(232,77,154,0.20))' : 'var(--bg2)',
      border: active ? '1.5px solid var(--ac)' : '1px solid var(--border)',
      color: active ? 'var(--text)' : 'var(--t2)',
      fontSize:'14px',
      fontWeight: active ? 700 : 600,
      cursor:'pointer',
      whiteSpace:'nowrap',
      flexShrink: 0,
      display:'flex',
      alignItems:'center',
      gap:'7px',
      fontFamily:'inherit',
      transition:'all 0.18s',
      lineHeight:1
    }
  },
    React.createElement('span', {style:{fontSize:'17px',lineHeight:1}}, props.icon),
    React.createElement('span', null, active ? props.value : props.label),
    React.createElement('span', {style:{fontSize:'11px',opacity: active ? 0.9 : 0.5}}, '▾')
  );
}

/* ── Reusable typing-only city input (used inside pickers). */
function CityInputInner(props) {
  var value = props.value || '';
  var setValue = props.onChange;
  var placeholder = props.placeholder || 'Type a city';
  var openS = useState(false); var open = openS[0]; var setOpen = openS[1];
  var sug = (value && value.length > 0) ? searchCities(value, 12) : [];
  return React.createElement('div', {style:{position:'relative'}},
    React.createElement('input', {
      value: value,
      onChange: function(e){ setValue(e.target.value); setOpen(true); },
      onFocus: function(){ setOpen(true); },
      onBlur: function(){ setTimeout(function(){ setOpen(false); }, 150); },
      autoFocus: true,
      placeholder: placeholder,
      style:{width:'100%',padding:'12px 14px',borderRadius:'12px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'14px',fontFamily:'inherit',boxSizing:'border-box'}
    }),
    (open && sug.length > 0) ? React.createElement('div', {
      style:{marginTop:'8px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',maxHeight:'280px',overflowY:'auto'}
    },
      sug.map(function(c){
        return React.createElement('div', {
          key: c,
          onMouseDown: function(e){ e.preventDefault(); setValue(c); setOpen(false); if (props.onPick) props.onPick(c); },
          style:{padding:'12px 16px',cursor:'pointer',fontSize:'13px',color:'var(--text)',borderBottom:'1px solid var(--border)'}
        }, '📍 ' + c);
      })
    ) : null
  );
}

export default function FriendsScreen(props) {
  var session = props.session;
  var userId = session && session.user ? session.user.id : null;
  /* R64.10: onViewUser navigates to a full UserProfileView. Wired from
   * App.js so tapping a profile's avatar/name in our summary modal
   * routes through the same flow as MessagesScreen + HomeScreen. */
  var onViewUser = props.onViewUser;

  /* Navigate to a user's full profile page. Closes the summary modal
   * first so the back stack is clean. Falls back to no-op if the host
   * didn't wire onViewUser. */
  function openFullProfile(p) {
    if (!p || !onViewUser) return;
    var u = {
      id: p.user_id || p.id,
      full_name: p.full_name || p.anon_nickname || 'Anonymous',
      avatar_url: p.avatar_url || null,
      is_online: !!p.is_online,
    };
    setViewProfile(null);
    try { onViewUser(u); } catch (_) {}
  }

  /* My own community fields */
  var myLangS = useState(''); var myLang = myLangS[0]; var setMyLang = myLangS[1];
  var myHomeS = useState(''); var myHome = myHomeS[0]; var setMyHome = myHomeS[1];
  var myCityS = useState(''); var myCity = myCityS[0]; var setMyCity = myCityS[1];
  var myOccS  = useState(''); var myOcc  = myOccS[0];  var setMyOcc  = myOccS[1];
  var myGenderS = useState(''); var myGender = myGenderS[0]; var setMyGender = myGenderS[1];
  var myInterestsS = useState([]); var myInterests = myInterestsS[0]; var setMyInterests = myInterestsS[1];

  /* Search box */
  var searchS = useState(''); var search = searchS[0]; var setSearch = searchS[1];

  /* 7 filter values */
  var fLangS = useState(''); var fLang = fLangS[0]; var setFLang = fLangS[1];
  var fHomeS = useState(''); var fHome = fHomeS[0]; var setFHome = fHomeS[1];
  var fCityS = useState(''); var fCity = fCityS[0]; var setFCity = fCityS[1];
  var fOccS  = useState(''); var fOcc  = fOccS[0];  var setFOcc  = fOccS[1];
  var fGenderS = useState(''); var fGender = fGenderS[0]; var setFGender = fGenderS[1];
  var fInterestsS = useState([]); var fInterests = fInterestsS[0]; var setFInterests = fInterestsS[1];
  var fOnlineS = useState(false); var fOnline = fOnlineS[0]; var setFOnline = fOnlineS[1];

  /* Which picker is open: 'lang' | 'home' | 'city' | 'occ' | 'gender' | 'interests' | null */
  var pickerS = useState(null); var picker = pickerS[0]; var setPicker = pickerS[1];

  /* Results + suggestions */
  var resultsS = useState([]); var results = resultsS[0]; var setResults = resultsS[1];
  var suggestedS = useState([]); var suggested = suggestedS[0]; var setSuggested = suggestedS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];

  /* R64.7: "See all" toggle for the Suggested strip.
   *   - false (default): show only 9 cards in 1 row
   *   - true: show up to 28 cards in 2 rows (CSS grid horizontal flow) */
  var showAllSuggestedS = useState(false);
  var showAllSuggested = showAllSuggestedS[0];
  var setShowAllSuggested = showAllSuggestedS[1];

  /* Setup modal + profile modal */
  var setupOpenS = useState(false); var setupOpen = setupOpenS[0]; var setSetupOpen = setupOpenS[1];
  var savingSetupS = useState(false); var savingSetup = savingSetupS[0]; var setSavingSetup = savingSetupS[1];
  var viewProfileS = useState(null); var viewProfile = viewProfileS[0]; var setViewProfile = viewProfileS[1];
  var connSendingS = useState(false); var connSending = connSendingS[0]; var setConnSending = connSendingS[1];
  var followSendingS = useState(false); var followSending = followSendingS[0]; var setFollowSending = followSendingS[1];

  /* R55: per-profile follow + friend status. Maps keyed by user_id.
   *   followedMap[uid] = true            (one-way follow)
   *   friendMap[uid]   = true            (accepted mutual connection)
   *   pendingMap[uid]  = true            (friend request I sent, awaiting accept)
   * busyMap tracks in-flight per-button so taps don't double-fire. */
  var followedMapS = useState({}); var followedMap = followedMapS[0]; var setFollowedMap = followedMapS[1];
  var friendMapS = useState({});   var friendMap = friendMapS[0];   var setFriendMap = friendMapS[1];
  var pendingMapS = useState({});  var pendingMap = pendingMapS[0]; var setPendingMap = pendingMapS[1];
  var busyMapS = useState({});     var busyMap = busyMapS[0];       var setBusyMap = busyMapS[1];

  function friendStatusOf(uid){ return friendMap[uid] ? 'friends' : (pendingMap[uid] ? 'pending' : 'none'); }

  /* Load my follow + connection + outgoing-pending state so the buttons show
   * the right label without a tap. Best-effort: any piece failing just leaves
   * that map empty (buttons default to actionable). */
  function loadFriendStatus(){
    if (!userId) return;
    try {
      sb.from('follows').select('following_id').eq('follower_id', userId).then(function(r){
        if (r && !r.error && Array.isArray(r.data)){
          var m = {}; r.data.forEach(function(x){ if(x.following_id) m[x.following_id] = true; });
          setFollowedMap(m);
        }
      }).catch(function(){});
      sb.rpc('list_anon_connections').then(function(r){
        if (r && !r.error && Array.isArray(r.data)){
          var m = {}; r.data.forEach(function(x){ if(x.user_id) m[x.user_id] = true; });
          setFriendMap(m);
        }
      }).catch(function(){});
      sb.from('anon_connection_requests').select('recipient_id,status').eq('requester_id', userId).eq('status','pending').then(function(r){
        if (r && !r.error && Array.isArray(r.data)){
          var m = {}; r.data.forEach(function(x){ if(x.recipient_id) m[x.recipient_id] = true; });
          setPendingMap(m);
        }
      }).catch(function(){});
    } catch(_){}
  }
  useEffect(function(){ loadFriendStatus(); /* eslint-disable-next-line */ }, [userId]);

  /* ── Load my profile ────────────────────────────────────────────── */
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    sb.from('profiles')
      .select('home_language,home_town,current_city,occupation,gender,interests')
      .eq('id', userId)
      .maybeSingle()
      .then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) {
          setMyLang(r.data.home_language || '');
          setMyHome(r.data.home_town || '');
          setMyCity(r.data.current_city || '');
          setMyOcc(r.data.occupation || '');
          setMyGender(r.data.gender || '');
          setMyInterests(Array.isArray(r.data.interests) ? r.data.interests : []);
          if (!r.data.home_language || !r.data.current_city) {
            setSetupOpen(true);
          }
        } else {
          setSetupOpen(true);
        }
      });
    return function(){ cancelled = true; };
  }, [userId]);

  /* ── Load suggestions ──────────────────────────────────────────────
   * R64.7: bumped limit 8 → 28. R64.9: filter out incomplete profiles
   * (no occupation OR no current_city OR no home_language) — those
   * look ugly in card form (button row shifts up because there are
   * fewer text rows). Per user request: incomplete profiles must NOT
   * appear in Suggestions OR Discover. */
  useEffect(function(){
    if (!userId) return;
    sb.rpc('suggest_friends', { p_limit: 28 }).then(function(r){
      if (r && !r.error && Array.isArray(r.data)) {
        var clean = r.data.filter(function(p){
          return p.occupation && p.current_city && p.home_language;
        });
        setSuggested(clean);
      }
    });
  }, [userId, myLang, myCity]);

  /* ── Load results (debounced) ──────────────────────────────────── */
  useEffect(function(){
    if (!userId) return;
    setLoading(true);
    var t = setTimeout(function(){
      sb.rpc('list_community_friends', {
        p_language: fLang || null,
        p_city: fCity || null,
        p_home_town: fHome || null,
        p_occupation: fOcc || null,
        p_gender: fGender || null,
        p_interests: fInterests.length > 0 ? fInterests : [],
        p_search: search || null,
        p_limit: 50,
      }).then(function(r){
        setLoading(false);
        if (r && !r.error && Array.isArray(r.data)) {
          var rows = r.data;
          /* R64.9: when the user is NOT actively searching by name/id,
           * hide profiles missing occupation/city/language — keeps cards
           * visually consistent in Discover. When they ARE searching,
           * show all matches so they can still find john-by-name even
           * with incomplete data. */
          if (!search) {
            rows = rows.filter(function(p){
              return p.occupation && p.current_city && p.home_language;
            });
          }
          if (fOnline) rows = rows.filter(function(x){ return x.is_online; });
          setResults(rows);
        } else if (r && r.error) {
          console.warn('[friends] list error:', r.error);
          setResults([]);
        }
      }).catch(function(){ setLoading(false); });
    }, 250);
    return function(){ clearTimeout(t); };
  }, [userId, search, fLang, fHome, fCity, fOcc, fGender, fInterests, fOnline]);

  /* ── Save setup ────────────────────────────────────────────────────
   * R64.11: was doing `sb.from('profiles').update(...)` directly, which
   * failed with "permission denied for table profiles" because the
   * R58 security lockdown revoked direct UPDATE on gender (and other
   * sensitive columns). Now uses the update_friends_profile SECURITY
   * DEFINER RPC which runs as postgres and bypasses column grants. */
  function saveSetup() {
    if (savingSetup) return;
    setSavingSetup(true);
    sb.rpc('update_friends_profile', {
      p_home_language: (myLang  || '').trim() || null,
      p_home_town:     (myHome  || '').trim() || null,
      p_current_city:  (myCity  || '').trim() || null,
      p_occupation:    (myOcc   || '').trim() || null,
      p_interests:     myInterests.length > 0 ? myInterests : [],
      p_gender:        myGender || null,
    }).then(function(r){
      setSavingSetup(false);
      if (r && r.error) {
        toastError('Could not save: ' + (r.error.message || 'try again'));
        return;
      }
      setSetupOpen(false);
      toastInfo('Profile updated');
    }).catch(function(){
      setSavingSetup(false);
      toastError('Network error');
    });
  }

  function sendConnectionRequest(p) {
    if (!p || !p.user_id) return;
    var uid = p.user_id;
    if (busyMap['fr_'+uid] || friendMap[uid] || pendingMap[uid]) return;
    setBusyMap(function(b){ var n=Object.assign({},b); n['fr_'+uid]=true; return n; });
    setPendingMap(function(m){ var n=Object.assign({},m); n[uid]=true; return n; }); // optimistic
    sb.rpc('request_anon_connection', { p_recipient: uid }).then(function(r){
      setBusyMap(function(b){ var n=Object.assign({},b); delete n['fr_'+uid]; return n; });
      if (r && r.error) {
        setPendingMap(function(m){ var n=Object.assign({},m); delete n[uid]; return n; });
        toastError('Could not send: ' + (r.error.message || 'error')); return;
      }
      var status = r && r.data && r.data.status;
      if (status === 'accepted' || status === 'already_connected') {
        // auto-accepted (dummy) or already friends -> promote to friend
        setPendingMap(function(m){ var n=Object.assign({},m); delete n[uid]; return n; });
        setFriendMap(function(m){ var n=Object.assign({},m); n[uid]=true; return n; });
        toastInfo(status === 'accepted' ? 'You are now friends ✓' : 'You are already connected');
      } else if (status === 'already_pending') {
        toastInfo('Request already sent');
      } else {
        toastInfo('Friend request sent ✓');
      }
    }).catch(function(){
      setBusyMap(function(b){ var n=Object.assign({},b); delete n['fr_'+uid]; return n; });
      setPendingMap(function(m){ var n=Object.assign({},m); delete n[uid]; return n; });
      toastError('Network error');
    });
  }

  function toggleFollowUser(p) {
    if (!p || !p.user_id) return;
    var uid = p.user_id;
    if (busyMap['fo_'+uid]) return;
    var was = !!followedMap[uid];
    setBusyMap(function(b){ var n=Object.assign({},b); n['fo_'+uid]=true; return n; });
    setFollowedMap(function(m){ var n=Object.assign({},m); if(was) delete n[uid]; else n[uid]=true; return n; });
    var op = was
      ? sb.from('follows').delete().eq('follower_id', userId).eq('following_id', uid)
      : sb.from('follows').upsert({ follower_id: userId, following_id: uid });
    op.then(function(r){
      setBusyMap(function(b){ var n=Object.assign({},b); delete n['fo_'+uid]; return n; });
      if (r && r.error) {
        setFollowedMap(function(m){ var n=Object.assign({},m); if(was) n[uid]=true; else delete n[uid]; return n; });
        toastError('Follow failed: ' + (r.error.message || 'error')); return;
      }
      if (!was) toastInfo('Following ' + (p.full_name || p.anon_nickname || ''));
    }).catch(function(){
      setBusyMap(function(b){ var n=Object.assign({},b); delete n['fo_'+uid]; return n; });
      setFollowedMap(function(m){ var n=Object.assign({},m); if(was) n[uid]=true; else delete n[uid]; return n; });
      toastError('Network error');
    });
  }

  function toggleInterestFilter(it) {
    var idx = fInterests.indexOf(it);
    if (idx >= 0) setFInterests(fInterests.filter(function(x){ return x !== it; }));
    else setFInterests(fInterests.concat([it]));
  }
  function toggleMyInterest(it) {
    var idx = myInterests.indexOf(it);
    if (idx >= 0) setMyInterests(myInterests.filter(function(x){ return x !== it; }));
    else setMyInterests(myInterests.concat([it]));
  }

  /* ══════ PICKER SHEET ══════════════════════════════════════════════
   * Bottom sheet shown when a filter pill is tapped. One sheet, content
   * switches based on `picker` state. */
  function renderPickerSheet() {
    if (!picker) return null;
    var title = '';
    var content = null;

    if (picker === 'lang') {
      title = '🌐 Pick a language';
      content = React.createElement('div', null,
        React.createElement('div', {
          onClick: function(){ setFLang(''); setPicker(null); },
          style:{padding:'14px',marginBottom:'8px',borderRadius:'10px',background: !fLang ? 'rgba(123,110,255,0.18)' : 'var(--bg2)',border:'1px solid var(--border)',cursor:'pointer',fontSize:'13px',color:'var(--text)',fontWeight:600}
        }, 'Any language'),
        React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}},
          LANGUAGES.map(function(l){
            var sel = fLang === l.value;
            return React.createElement('div', {
              key: l.value,
              onClick: function(){ setFLang(l.value); setPicker(null); },
              style:{padding:'12px',borderRadius:'10px',background: sel ? 'linear-gradient(135deg,rgba(123,110,255,0.25),rgba(232,77,154,0.18))' : 'var(--bg2)',border: sel ? '1px solid var(--ac)' : '1px solid var(--border)',cursor:'pointer',fontSize:'13px',color:'var(--text)',fontWeight: sel ? 700 : 600,textAlign:'center'}
            }, l.label);
          })
        )
      );

    } else if (picker === 'city') {
      title = '📍 Current city';
      content = React.createElement('div', null,
        React.createElement(CityInputInner, {
          value: fCity, onChange: setFCity, placeholder: 'Type a city',
          onPick: function(){ setPicker(null); }
        }),
        fCity ? React.createElement('button', {
          onClick: function(){ setFCity(''); setPicker(null); },
          style:{marginTop:'12px',width:'100%',padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
        }, 'Clear current city') : null
      );

    } else if (picker === 'home') {
      title = '🏠 Hometown';
      content = React.createElement('div', null,
        React.createElement(CityInputInner, {
          value: fHome, onChange: setFHome, placeholder: 'Type a hometown',
          onPick: function(){ setPicker(null); }
        }),
        fHome ? React.createElement('button', {
          onClick: function(){ setFHome(''); setPicker(null); },
          style:{marginTop:'12px',width:'100%',padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
        }, 'Clear hometown') : null
      );

    } else if (picker === 'occ') {
      title = '💼 Occupation';
      content = React.createElement('div', null,
        React.createElement('input', {
          value: fOcc,
          onChange: function(e){ setFOcc(e.target.value); },
          placeholder: 'e.g. Engineer, Doctor, Designer',
          autoFocus: true,
          style:{width:'100%',padding:'12px 14px',borderRadius:'12px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'14px',fontFamily:'inherit',boxSizing:'border-box'}
        }),
        React.createElement('div', {style:{display:'flex',gap:'8px',marginTop:'14px'}},
          React.createElement('button', {
            onClick: function(){ setFOcc(''); setPicker(null); },
            style:{flex:1,padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Clear'),
          React.createElement('button', {
            onClick: function(){ setPicker(null); },
            style:{flex:2,padding:'12px',borderRadius:'10px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
          }, 'Apply')
        )
      );

    } else if (picker === 'gender') {
      title = '👤 Gender';
      content = React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}},
        [{v:'',l:'Any'},{v:'f',l:'👧 Girl'},{v:'m',l:'👦 Boy'},{v:'other',l:'🌈 Other'}].map(function(g){
          var sel = fGender === g.v;
          return React.createElement('div', {
            key: g.v || 'any',
            onClick: function(){ setFGender(g.v); setPicker(null); },
            style:{padding:'18px',borderRadius:'12px',background: sel ? 'linear-gradient(135deg,rgba(123,110,255,0.25),rgba(232,77,154,0.18))' : 'var(--bg2)',border: sel ? '1px solid var(--ac)' : '1px solid var(--border)',cursor:'pointer',fontSize:'14px',color:'var(--text)',fontWeight: sel ? 700 : 600,textAlign:'center'}
          }, g.l);
        })
      );

    } else if (picker === 'interests') {
      title = '🏷 Interests';
      content = React.createElement('div', null,
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginBottom:'10px'}}, 'Tap chips to add. We will surface people who share any of these.'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',maxHeight:'320px',overflowY:'auto'}},
          INTEREST_SUGGESTIONS.map(function(it){
            var sel = fInterests.indexOf(it) >= 0;
            return React.createElement('button', {
              key: it,
              onClick: function(){ toggleInterestFilter(it); },
              style:{padding:'8px 12px',borderRadius:'14px',background: sel ? 'linear-gradient(135deg,rgba(123,110,255,0.3),rgba(232,77,154,0.2))' : 'var(--bg2)',border: sel ? '1px solid var(--ac)' : '1px solid var(--border)',color: sel ? 'var(--text)' : 'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
            }, (sel ? '✓ ' : '') + it);
          })
        ),
        React.createElement('div', {style:{display:'flex',gap:'8px',marginTop:'14px'}},
          React.createElement('button', {
            onClick: function(){ setFInterests([]); setPicker(null); },
            style:{flex:1,padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Clear all'),
          React.createElement('button', {
            onClick: function(){ setPicker(null); },
            style:{flex:2,padding:'12px',borderRadius:'10px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
          }, 'Done (' + fInterests.length + ')')
        )
      );
    }

    return React.createElement('div', {
      onClick: function(){ setPicker(null); },
      /* R54: nav stays visible on top (z90 < nav 100); the bottom sheet rests
       * ABOVE the floating nav via paddingBottom — never under/touching it. */
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',zIndex:90,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:'calc(88px + env(safe-area-inset-bottom, 0px))'}
    },
      React.createElement('div', {
        onClick: function(e){ e.stopPropagation(); },
        style:{background:'var(--bg)',border:'1px solid var(--border)',borderTopLeftRadius:'18px',borderTopRightRadius:'18px',padding:'18px',maxWidth:'520px',width:'100%',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 -10px 30px rgba(0,0,0,0.4)'}
      },
        /* Drag handle */
        React.createElement('div', {style:{width:'40px',height:'4px',borderRadius:'2px',background:'var(--border)',margin:'0 auto 14px'}}),
        React.createElement('div', {style:{fontSize:'15px',fontWeight:800,color:'var(--text)',marginBottom:'14px'}}, title),
        content
      )
    );
  }

  /* ══════ SETUP MODAL ══════════════════════════════════════════════ */
  function renderSetupModal() {
    if (!setupOpen) return null;
    /* R54: keep the floating nav VISIBLE on top (zIndex 90 < nav's 100) and
     * constrain the card to sit ABOVE the nav with a gap — never under it,
     * never touching it. paddingBottom reserves the nav footprint; the card
     * maxHeight keeps it inside the area above the nav (scrolls internally). */
    var navClear = 'calc(96px + env(safe-area-inset-bottom, 0px))';
    return React.createElement('div', {style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:90,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px',paddingBottom:navClear}},
      React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',maxWidth:'480px',width:'100%',maxHeight:'calc(100vh - 130px)',display:'flex',flexDirection:'column',overflow:'hidden'}},
        /* R54: sticky header — stays put while the body scrolls */
        React.createElement('div', {style:{flexShrink:0,padding:'20px 20px 12px',borderBottom:'1px solid var(--border)',background:'var(--bg)'}},
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',marginBottom:'4px'}}, '🤝 Tell us about you'),
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)'}}, 'These help find better friend matches. Skip anything optional.')
        ),
        /* R54: scrollable body — frosted dark scrollbar via .ringin-frost-scroll */
        React.createElement('div', {className:'ringin-frost-scroll', style:{flex:1,overflowY:'auto',padding:'16px 20px'}},
        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'HOME LANGUAGE'),
        React.createElement('select', {
          value: myLang,
          onChange: function(e){ setMyLang(e.target.value); },
          style:{width:'100%',padding:'10px 12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontFamily:'inherit',marginBottom:'12px'}
        },
          React.createElement('option', {value:''}, 'Select…'),
          LANGUAGES.map(function(l){ return React.createElement('option', {key:l.value, value:l.value}, l.label); })
        ),

        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'HOMETOWN'),
        React.createElement(CityInputInner, { value: myHome, onChange: setMyHome, placeholder: 'Type your hometown' }),
        React.createElement('div', {style:{height:'12px'}}),

        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'CURRENT CITY'),
        React.createElement(CityInputInner, { value: myCity, onChange: setMyCity, placeholder: 'Type where you live now' }),
        React.createElement('div', {style:{height:'12px'}}),

        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'OCCUPATION'),
        React.createElement('input', {
          value: myOcc,
          onChange: function(e){ setMyOcc(e.target.value); },
          placeholder: 'e.g. Software Engineer, Nurse, Student',
          style:{width:'100%',padding:'10px 12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'12px'}
        }),

        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'GENDER'),
        React.createElement('div', {style:{display:'flex',gap:'8px',marginBottom:'14px'}},
          ['', 'f', 'm', 'other'].map(function(g){
            var label = g === '' ? 'Skip' : (g === 'f' ? '👧 Girl' : (g === 'm' ? '👦 Boy' : '🌈 Other'));
            var sel = myGender === g;
            return React.createElement('button', {
              key: g,
              onClick: function(){ setMyGender(g); },
              style:{flex:1,padding:'10px 4px',borderRadius:'10px',background: sel ? 'linear-gradient(135deg,#7B6EFF,#E84D9A)' : 'var(--bg2)',border: sel ? 'none' : '1px solid var(--border)',color: sel ? '#fff' : 'var(--t2)',fontSize:'12px',fontWeight: sel ? 700 : 600,cursor:'pointer',fontFamily:'inherit'}
            }, label);
          })
        ),

        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'INTERESTS · TAP TO SELECT'),
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'4px'}},
          INTEREST_SUGGESTIONS.map(function(it){
            var sel = myInterests.indexOf(it) >= 0;
            return React.createElement('button', {
              key: it,
              onClick: function(){ toggleMyInterest(it); },
              style:{padding:'6px 10px',borderRadius:'14px',background: sel ? 'linear-gradient(135deg,rgba(123,110,255,0.3),rgba(232,77,154,0.2))' : 'var(--bg2)',border: sel ? '1px solid var(--ac)' : '1px solid var(--border)',color: sel ? 'var(--text)' : 'var(--t2)',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
            }, (sel ? '✓ ' : '') + it);
          })
        )
      ),
        /* R54: sticky footer — Skip + Save stay put while the body scrolls */
        React.createElement('div', {style:{flexShrink:0,padding:'12px 20px',borderTop:'1px solid var(--border)',background:'var(--bg)',display:'flex',gap:'10px'}},
          React.createElement('button', {
            onClick: function(){ setSetupOpen(false); },
            style:{flex:1,padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Skip'),
          React.createElement('button', {
            onClick: saveSetup,
            disabled: savingSetup,
            style:{flex:2,padding:'12px',borderRadius:'10px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity: savingSetup ? 0.6 : 1}
          }, savingSetup ? '...' : 'Save & find friends')
        )
      )
    );
  }

  /* ══════ PROFILE MODAL ══════════════════════════════════════════ */
  function renderProfileModal() {
    if (!viewProfile) return null;
    var p = viewProfile;
    var name = p.full_name || p.anon_nickname || 'Anonymous';
    /* R64.8: parse bio JSON blob into clean fields. */
    var bioData = parseBio(p.bio);
    var displayOccupation = p.occupation || bioData.tag || '';
    var coverStyle = p.cover_url
      ? { background: 'url(' + p.cover_url + ') center/cover', height: '110px' }
      : { background: gradientFromString(name + 'cover'), height: '110px' };
    return React.createElement('div', {
      onClick: function(){ setViewProfile(null); },
      /* R54: nav stays visible on top (z90 < nav 100); card constrained above it. */
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:90,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px',paddingBottom:'calc(96px + env(safe-area-inset-bottom, 0px))'}
    },
      React.createElement('div', {
        onClick: function(e){ e.stopPropagation(); },
        style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',maxWidth:'440px',width:'100%',maxHeight:'calc(100vh - 130px)',overflowY:'auto',overflowX:'hidden'}
      },
        React.createElement('div', {style: Object.assign({width:'100%',position:'relative'}, coverStyle)},
          /* R64.10: clicking the avatar OR the name navigates to the
           * user's full profile page (UserProfileView). */
          React.createElement('div', {
            onClick: function(){ openFullProfile(p); },
            style:{position:'absolute',bottom:'-30px',left:'50%',transform:'translateX(-50%)',width:'82px',height:'82px',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), border:'3px solid var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:800,color:'#fff',cursor:'pointer'}
          },
            p.avatar_url ? null : initialOf(name)
          )
        ),
        React.createElement('div', {style:{padding:'40px 22px 22px'}},
          React.createElement('div', {
            onClick: function(){ openFullProfile(p); },
            style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',textAlign:'center',cursor:'pointer'}
          }, name),
          displayOccupation ? React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',textAlign:'center',marginTop:'4px'}}, '💼 ' + displayOccupation) : null,
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t3)',textAlign:'center',marginTop:'6px'}},
            (p.home_language ? ('🗣 ' + languageLabel(p.home_language)) : '') +
            (p.home_town ? (' · From ' + p.home_town) : '') +
            (p.current_city ? (' · 📍 ' + p.current_city) : '')
          ),
          /* R64.8: render parsed about (clean text), then website on a
           * separate line if present. No more raw JSON blob. */
          bioData.about ? React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',marginTop:'14px',padding:'12px',background:'var(--bg2)',borderRadius:'10px',lineHeight:1.5,whiteSpace:'pre-wrap'}}, bioData.about) : null,
          bioData.website ? React.createElement('div', {style:{fontSize:'12px',color:'var(--ac)',marginTop:'8px',textAlign:'center',fontWeight:600}}, '🔗 ' + bioData.website) : null,
          (Array.isArray(p.interests) && p.interests.length > 0)
            ? React.createElement('div', {style:{marginTop:'14px'}},
                React.createElement('div', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',marginBottom:'6px',letterSpacing:'0.5px'}}, 'INTERESTS'),
                React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'5px'}},
                  p.interests.map(function(it){
                    return React.createElement('span', {key:it,style:{padding:'4px 8px',borderRadius:'10px',background:'var(--bg2)',color:'var(--t2)',fontSize:'10px',fontWeight:600}}, '#' + it);
                  })
                )
              )
            : null,
          React.createElement('div', {style:{display:'flex',gap:'8px',marginTop:'18px'}},
            React.createElement(FollowButton, {
              following: !!followedMap[p.user_id], busy: !!busyMap['fo_'+p.user_id], full: true,
              onClick: function(){ toggleFollowUser(p); },
              style: { padding:'12px', fontSize:'13px', borderRadius:'12px' }
            }),
            React.createElement(AddFriendButton, {
              status: friendStatusOf(p.user_id), busy: !!busyMap['fr_'+p.user_id], full: true,
              onClick: function(){ sendConnectionRequest(p); },
              style: { padding:'12px', fontSize:'13px', borderRadius:'12px' }
            })
          ),
          /* Message — only works once they accept your friend request. */
          React.createElement('div', {style:{marginTop:'8px'}},
            React.createElement(MessageButton, {
              enabled: friendMap[p.user_id] === true, full: true,
              label: friendMap[p.user_id] ? 'Message' : 'Message · friends only',
              onClick: function(){
                var nm = p.full_name || p.anon_nickname || 'Anonymous';
                var convId = [userId, p.user_id].sort().join('_');
                if (props.onGoToMessages){
                  props.onGoToMessages({id:convId,convId:convId,otherId:p.user_id,receiverId:p.user_id,user_id:p.user_id,name:nm,role:'RingIn Member',color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:p.avatar_url||null,initials:initialOf(nm)});
                  setViewProfile(null);
                }
              },
              onLocked: function(){ toastInfo('You can message them once you are friends'); },
              style: { padding:'12px', fontSize:'13px', borderRadius:'12px', width:'100%' }
            })
          ),
          React.createElement('button', {
            onClick: function(){ setViewProfile(null); },
            style:{width:'100%',marginTop:'10px',padding:'10px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Close')
        )
      )
    );
  }

  /* ══════ RESULT ROWS ════════════════════════════════════════════ */
  function renderResultRow(p) {
    var name = p.full_name || p.anon_nickname || 'Anonymous';
    return React.createElement('div', {
      key: p.user_id,
      onClick: function(){ setViewProfile(p); },
      style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',marginBottom:'8px',cursor:'pointer'}
    },
      React.createElement('div', {style:{width:'48px',height:'48px',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:800,color:'#fff',flexShrink:0,position:'relative'}},
        p.avatar_url ? null : initialOf(name),
        p.is_online ? React.createElement('div', {style:{position:'absolute',bottom:'-2px',right:'-2px',width:'12px',height:'12px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg2)'}}) : null
      ),
      React.createElement('div', {style:{flex:1,minWidth:0}},
        React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
        p.occupation ? React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, '💼 ' + p.occupation) : null,
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
          (p.home_language ? ('🗣 ' + languageLabel(p.home_language)) : '') +
          (p.current_city ? (' · 📍 ' + p.current_city) : '') +
          (p.home_town ? (' · From ' + p.home_town) : '')
        )
      ),
      React.createElement('div', {style:{fontSize:'18px',color:'var(--t3)',flexShrink:0}}, '›')
    );
  }

  /* ══════ FRIEND CARD — Home "Online Now" style ═══════════════════
   * R64.3: matches the existing Home > Online Now card design. Round
   * gradient ring around avatar, name + occupation + city centered,
   * 2-button action row at bottom (message + add friend).
   *
   * Used for BOTH the horizontal "Suggested" strip AND the 2-column
   * Discover grid below. Same component, same look. */
  function renderFriendCard(p, opts) {
    opts = opts || {};
    var name = p.full_name || p.anon_nickname || 'Anonymous';
    /* R64.10: per user request — discover cards now show ONLY location
     * + main language. Occupation removed from the card. Avatar bumped
     * 64→84px (room freed up by dropping the occupation row).
     *
     * R64.10: card has FIXED height (210px) and the entire card outer
     * div is clickable → opens the profile-summary modal. Action row
     * uses marginTop:'auto' which, combined with fixed height,
     * guarantees the buttons sit at exactly the same Y position on
     * every card regardless of name/city length. */
    var cardStyle = opts.grid
      ? {width:'100%',height:'210px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px 8px 10px',display:'flex',flexDirection:'column',alignItems:'center',boxSizing:'border-box',overflow:'hidden',cursor:'pointer'}
      : {flex:'0 0 170px',minWidth:'170px',width:'170px',height:'210px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px 8px 10px',display:'flex',flexDirection:'column',alignItems:'center',boxSizing:'border-box',overflow:'hidden',cursor:'pointer'};
    return React.createElement('div', {
      key: p.user_id,
      /* R64.10: whole card is clickable, opens profile summary modal. */
      onClick: function(){ setViewProfile(p); },
      style: cardStyle
    },
      /* Avatar with gradient ring + online dot. R64.10: 64 → 84px (bigger).
       * The inner click handler is removed — the parent card handles it. */
      React.createElement('div', {
        style:{position:'relative',marginBottom:'10px'}
      },
        React.createElement('div', {
          style:{width:'84px',height:'84px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',padding:'3px',boxSizing:'border-box'}
        },
          React.createElement('div', {
            style:{width:'100%',height:'100%',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name),border:'3px solid var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:800,color:'#fff',boxSizing:'border-box'}
          }, p.avatar_url ? null : initialOf(name))
        ),
        p.is_online ? React.createElement('div', {
          style:{position:'absolute',bottom:'3px',right:'3px',width:'14px',height:'14px',borderRadius:'50%',background:'#27C96A',border:'2.5px solid var(--bg2)'}
        }) : null
      ),
      /* Name */
      React.createElement('div', {style:{fontSize:'14px',fontWeight:800,color:'var(--text)',textAlign:'center',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'100%',padding:'0 4px',boxSizing:'border-box'}}, name),
      /* City + main language only (R64.10: occupation removed) */
      React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',textAlign:'center',marginTop:'3px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'100%',padding:'0 4px',boxSizing:'border-box'}},
        (p.current_city ? ('📍 ' + p.current_city) : '') +
        (p.home_language ? (' · ' + languageLabel(p.home_language)) : '')
      ),
      /* Action row anchored to bottom by marginTop:'auto' (works because
       * the card has fixed height). All cards' buttons line up exactly. */
      React.createElement('div', {style:{display:'flex',gap:'6px',marginTop:'auto',paddingTop:'10px',width:'100%',alignItems:'center'}},
        React.createElement(FollowButton, {
          following: !!followedMap[p.user_id],
          busy: !!busyMap['fo_'+p.user_id],
          onClick: function(e){ if(e&&e.stopPropagation)e.stopPropagation(); toggleFollowUser(p); },
          style: { flex:1, padding:'9px 6px', fontSize:'12px', borderRadius:'12px' }
        }),
        React.createElement(AddFriendButton, {
          status: friendStatusOf(p.user_id),
          busy: !!busyMap['fr_'+p.user_id],
          iconOnly: true,
          onClick: function(e){ if(e&&e.stopPropagation)e.stopPropagation(); sendConnectionRequest(p); },
          style: { flexShrink:0, width:'38px', height:'36px', padding:'8px', borderRadius:'12px' }
        })
      )
    );
  }
  /* Backwards-compat alias — the JSX below still calls the old name. */
  var renderSuggestionBlock = function(p){ return renderFriendCard(p, {grid:false}); };

  /* ── Search-result row — vertical full-width layout for search ──
   * Used when the user types in the search box. Easier to scan than
   * cards because you see name + location at a glance with no scroll. */
  function renderSearchResultRow(p) {
    var name = p.full_name || p.anon_nickname || 'Anonymous';
    return React.createElement('div', {
      key: p.user_id,
      onClick: function(){ setViewProfile(p); },
      style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',cursor:'pointer'}
    },
      /* Avatar with ring */
      React.createElement('div', {style:{position:'relative',flexShrink:0}},
        React.createElement('div', {style:{width:'52px',height:'52px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',padding:'2px',boxSizing:'border-box'}},
          React.createElement('div', {style:{width:'100%',height:'100%',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name),border:'2px solid var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:800,color:'#fff',boxSizing:'border-box'}}, p.avatar_url ? null : initialOf(name))
        ),
        p.is_online ? React.createElement('div', {style:{position:'absolute',bottom:'0',right:'0',width:'12px',height:'12px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg2)'}}) : null
      ),
      React.createElement('div', {style:{flex:1,minWidth:0}},
        React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
          (p.current_city ? ('📍 ' + p.current_city) : '') +
          (p.home_language ? (' · ' + languageLabel(p.home_language)) : '')
        )
      ),
      /* Follow + Add-Friend on the right */
      React.createElement('div', {style:{display:'flex',gap:'6px',flexShrink:0,alignItems:'center'}},
        React.createElement(FollowButton, {
          following: !!followedMap[p.user_id],
          busy: !!busyMap['fo_'+p.user_id],
          onClick: function(e){ if(e&&e.stopPropagation)e.stopPropagation(); toggleFollowUser(p); }
        }),
        React.createElement(AddFriendButton, {
          status: friendStatusOf(p.user_id),
          busy: !!busyMap['fr_'+p.user_id],
          iconOnly: true,
          onClick: function(e){ if(e&&e.stopPropagation)e.stopPropagation(); sendConnectionRequest(p); },
          style: { width:'40px', height:'38px', padding:'8px' }
        })
      )
    );
  }

  /* ══════ FILTER PILLS BAR ═══════════════════════════════════════ */
  var activeCount = (fLang?1:0) + (fCity?1:0) + (fHome?1:0) + (fOcc?1:0) + (fGender?1:0) + (fInterests.length>0?1:0) + (fOnline?1:0);

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    /* Header */
    React.createElement('div', {style:{padding:'14px 18px 4px'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,letterSpacing:'0.3px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🤝 Real Friends')
    ),
    React.createElement('div', {style:{padding:'2px 18px 12px',fontSize:'11px',color:'var(--t2)'}}, 'Search · Filter · Discover'),

    /* Search box */
    React.createElement('div', {style:{padding:'0 16px 10px'}},
      React.createElement('div', {style:{position:'relative'}},
        React.createElement('input', {
          value: search,
          onChange: function(e){ setSearch(e.target.value); },
          placeholder: 'Search by name, city, or user ID',
          style:{width:'100%',padding:'12px 14px 12px 42px',borderRadius:'12px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontFamily:'inherit',boxSizing:'border-box'}
        }),
        React.createElement('div', {style:{position:'absolute',left:'14px',top:'50%',transform:'translateY(-50%)',fontSize:'15px',color:'var(--t3)'}}, '🔍')
      )
    ),

    /* HORIZONTAL FILTER PILLS (no scrollbar visible).
     * R64.2: explicit flexWrap:'nowrap' + minWidth:'max-content' on inner
     * container forces strict horizontal layout — earlier version was
     * wrapping vertically because the parent flex column was constraining
     * width. */
    React.createElement('div', {
      className: 'ringin-hscroll',
      style:{display:'flex',gap:'10px',padding:'0 16px 16px',overflowX:'auto',overflowY:'hidden',scrollbarWidth:'none',msOverflowStyle:'none',WebkitOverflowScrolling:'touch',flexWrap:'nowrap',flexShrink:0}
    },
      React.createElement(FilterPill, {
        icon:'🌐', label:'Language',
        value: fLang ? languageLabel(fLang) : null,
        onClick: function(){ setPicker('lang'); }
      }),
      React.createElement(FilterPill, {
        icon:'📍', label:'City',
        value: fCity || null,
        onClick: function(){ setPicker('city'); }
      }),
      React.createElement(FilterPill, {
        icon:'🏠', label:'From',
        value: fHome || null,
        onClick: function(){ setPicker('home'); }
      }),
      React.createElement(FilterPill, {
        icon:'💼', label:'Job',
        value: fOcc || null,
        onClick: function(){ setPicker('occ'); }
      }),
      React.createElement(FilterPill, {
        icon:'👤', label:'Gender',
        value: fGender ? (fGender === 'f' ? 'Girl' : fGender === 'm' ? 'Boy' : 'Other') : null,
        onClick: function(){ setPicker('gender'); }
      }),
      React.createElement(FilterPill, {
        icon:'🏷', label:'Interests',
        value: fInterests.length > 0 ? (fInterests.length + ' picked') : null,
        onClick: function(){ setPicker('interests'); }
      }),
      React.createElement(FilterPill, {
        icon:'🟢', label:'Online',
        value: fOnline ? 'Yes' : null,
        onClick: function(){ setFOnline(!fOnline); }
      }),
      /* Clear button — only visible when at least one filter is active */
      activeCount > 0 ? React.createElement('button', {
        onClick: function(){ setFLang(''); setFHome(''); setFCity(''); setFOcc(''); setFGender(''); setFInterests([]); setFOnline(false); },
        style:{padding:'8px 14px',borderRadius:'20px',background:'transparent',border:'1px solid var(--border)',color:'var(--t3)',fontSize:'12px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit'}
      }, '✕ Clear all') : null
    ),

    /* SUGGESTED FOR YOU — R64.7
     *   Default: 9 cards, 1 row, horizontal scroll
     *   Expanded (See All): up to 28 cards, 2 rows, horizontal scroll
     *
     * Both modes use the same card. The 2-row mode uses CSS grid with
     * grid-auto-flow:column so items fill the first column top-to-bottom
     * then move to the next column. */
    (search.length === 0 && activeCount === 0 && suggested.length > 0)
      ? React.createElement('div', {style:{flexShrink:0}},
          /* Header row with See All / Show Less toggle */
          React.createElement('div', {style:{padding:'6px 18px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}},
            React.createElement('span', {style:{fontSize:'15px',fontWeight:800,color:'var(--text)'}}, '✨ Suggested for you'),
            suggested.length > 9 ? React.createElement('button', {
              onClick: function(){ setShowAllSuggested(!showAllSuggested); },
              style:{background:'transparent',border:'none',color:'var(--ac)',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',padding:'4px 6px'}
            }, showAllSuggested ? '← Show less' : ('See all (' + Math.min(suggested.length, 28) + ') →')) : null
          ),
          /* Scroll lane — single row or 2-row grid based on toggle */
          showAllSuggested
            ? React.createElement('div', {
                className: 'ringin-hscroll',
                style:{display:'grid',gridTemplateRows:'auto auto',gridAutoFlow:'column',gridAutoColumns:'170px',gap:'10px',padding:'0 16px 20px',overflowX:'auto',overflowY:'hidden',scrollbarWidth:'none',msOverflowStyle:'none',WebkitOverflowScrolling:'touch'}
              },
                suggested.slice(0, 28).map(function(p){ return renderFriendCard(p, {grid:true}); })
              )
            : React.createElement('div', {
                className: 'ringin-hscroll',
                style:{display:'flex',gap:'12px',padding:'0 16px 20px',overflowX:'auto',overflowY:'hidden',scrollbarWidth:'none',msOverflowStyle:'none',WebkitOverflowScrolling:'touch',flexWrap:'nowrap',flexShrink:0}
              },
                suggested.slice(0, 9).map(renderSuggestionBlock)
              )
        )
      : null,

    /* RESULTS LIST — R64.2: bumped padding-top to clear overlap with
     * the suggestions strip above, and the header text is bigger now
     * to match the larger filter pills (15px vs 12px). */
    React.createElement('div', {style:{padding:'12px 18px 8px',fontSize:'15px',fontWeight:800,color:'var(--text)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,borderTop:'1px solid var(--border)',marginTop:'4px'}},
      React.createElement('span', null,
        search.length > 0 ? '🔎 Search results' : (activeCount > 0 ? '🎯 Filter results' : '🌍 Discover')
      ),
      React.createElement('span', {style:{color:'var(--t3)',fontWeight:600,fontSize:'12px'}}, results.length + (results.length === 1 ? ' person' : ' people'))
    ),

    loading ? React.createElement('div', {
        className: 'ringin-hscroll',
        style:{display:'flex',gap:'12px',padding:'10px 16px 90px 16px',overflowX:'hidden',flexWrap:'nowrap'}
      },
        /* R54 (Bug 6): shimmer skeleton cards on initial load — matches the
         * Discover card footprint so the layout doesn't jump when data lands. */
        [1,2,3,4,5].map(function(i){
          return React.createElement('div', {
            key:'sk'+i,
            style:{flex:'0 0 168px',height:'210px',background:'var(--bg2,#161028)',border:'1px solid var(--border)',borderRadius:'18px',padding:'14px',display:'flex',flexDirection:'column',alignItems:'center',gap:'10px'}
          },
            React.createElement(Skeleton, {width:84,height:84,radius:42}),
            React.createElement(Skeleton, {width:'80%',height:14,style:{marginTop:'4px'}}),
            React.createElement(Skeleton, {width:'58%',height:10}),
            React.createElement(Skeleton, {width:'90%',height:32,radius:16,style:{marginTop:'auto'}})
          );
        })
      )
    : results.length === 0
      ? React.createElement('div', {style:{padding:'40px 24px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'48px',marginBottom:'10px',opacity:0.4}}, '🌱'),
          React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}, 'No matches yet'),
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,maxWidth:'280px',margin:'0 auto'}}, 'Try expanding your filters or searching by a different city.')
        )
      /* R64.10: when SEARCHING, results go in a vertical list (rows)
       * under Discover label — easier to scan when looking for a
       * specific person. When NOT searching, Discover is a horizontal
       * scroll of cards (Online-Now style). */
      : search.length > 0
        ? React.createElement('div', {style:{padding:'10px 16px 90px 16px',display:'flex',flexDirection:'column',gap:'10px'}},
            results.map(renderSearchResultRow)
          )
        : React.createElement('div', {
            className: 'ringin-hscroll',
            style:{display:'flex',gap:'12px',padding:'10px 16px 90px 16px',overflowX:'auto',overflowY:'hidden',scrollbarWidth:'none',msOverflowStyle:'none',WebkitOverflowScrolling:'touch',flexWrap:'nowrap'}
          },
            results.map(function(p){ return renderFriendCard(p, {grid:false}); })
          ),

    renderSetupModal(),
    renderProfileModal(),
    renderPickerSheet()
  );
}
