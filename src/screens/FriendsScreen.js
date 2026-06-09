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

  /* Setup modal + profile modal */
  var setupOpenS = useState(false); var setupOpen = setupOpenS[0]; var setSetupOpen = setupOpenS[1];
  var savingSetupS = useState(false); var savingSetup = savingSetupS[0]; var setSavingSetup = savingSetupS[1];
  var viewProfileS = useState(null); var viewProfile = viewProfileS[0]; var setViewProfile = viewProfileS[1];
  var connSendingS = useState(false); var connSending = connSendingS[0]; var setConnSending = connSendingS[1];
  var followSendingS = useState(false); var followSending = followSendingS[0]; var setFollowSending = followSendingS[1];

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

  /* ── Load suggestions ──────────────────────────────────────────── */
  useEffect(function(){
    if (!userId) return;
    sb.rpc('suggest_friends', { p_limit: 8 }).then(function(r){
      if (r && !r.error && Array.isArray(r.data)) setSuggested(r.data);
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

  /* ── Save setup ────────────────────────────────────────────────── */
  function saveSetup() {
    if (savingSetup) return;
    setSavingSetup(true);
    var payload = {
      home_language: (myLang || '').trim() || null,
      home_town: (myHome || '').trim() || null,
      current_city: (myCity || '').trim() || null,
      occupation: (myOcc || '').trim() || null,
      interests: myInterests.length > 0 ? myInterests : [],
    };
    if (myGender) payload.gender = myGender;
    sb.from('profiles').update(payload).eq('id', userId).then(function(r){
      setSavingSetup(false);
      if (r && r.error) { toastError('Could not save: ' + (r.error.message || 'try again')); return; }
      setSetupOpen(false);
      toastInfo('Profile updated');
    });
  }

  function sendConnectionRequest(p) {
    if (!p || !p.user_id || connSending) return;
    setConnSending(true);
    sb.rpc('request_anon_connection', { p_recipient: p.user_id }).then(function(r){
      setConnSending(false);
      if (r && r.error) { toastError('Could not send: ' + (r.error.message || 'error')); return; }
      var status = r && r.data && r.data.status;
      if (status === 'already_connected') toastInfo('You are already connected');
      else if (status === 'already_pending') toastInfo('Request already sent');
      else toastInfo('Friend request sent ✓');
      setViewProfile(null);
    }).catch(function(){ setConnSending(false); toastError('Network error'); });
  }

  function followUser(p) {
    if (!p || !p.user_id || followSending) return;
    setFollowSending(true);
    sb.from('follows').upsert({ follower_id: userId, following_id: p.user_id }).then(function(r){
      setFollowSending(false);
      if (r && r.error) { toastError('Follow failed: ' + (r.error.message || 'error')); return; }
      toastInfo('Following ' + (p.full_name || p.anon_nickname || ''));
    }).catch(function(){ setFollowSending(false); toastError('Network error'); });
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
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center'}
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
    return React.createElement('div', {style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}},
      React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',padding:'20px',maxWidth:'480px',width:'100%',maxHeight:'92vh',overflowY:'auto'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',marginBottom:'4px'}}, '🤝 Tell us about you'),
        React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',marginBottom:'16px'}}, 'These help find better friend matches. Skip anything optional.'),

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
        React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'16px',maxHeight:'140px',overflowY:'auto'}},
          INTEREST_SUGGESTIONS.map(function(it){
            var sel = myInterests.indexOf(it) >= 0;
            return React.createElement('button', {
              key: it,
              onClick: function(){ toggleMyInterest(it); },
              style:{padding:'6px 10px',borderRadius:'14px',background: sel ? 'linear-gradient(135deg,rgba(123,110,255,0.3),rgba(232,77,154,0.2))' : 'var(--bg2)',border: sel ? '1px solid var(--ac)' : '1px solid var(--border)',color: sel ? 'var(--text)' : 'var(--t2)',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
            }, (sel ? '✓ ' : '') + it);
          })
        ),

        React.createElement('div', {style:{display:'flex',gap:'10px'}},
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
    var coverStyle = p.cover_url
      ? { background: 'url(' + p.cover_url + ') center/cover', height: '110px' }
      : { background: gradientFromString(name + 'cover'), height: '110px' };
    return React.createElement('div', {
      onClick: function(){ setViewProfile(null); },
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}
    },
      React.createElement('div', {
        onClick: function(e){ e.stopPropagation(); },
        style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',maxWidth:'440px',width:'100%',maxHeight:'92vh',overflowY:'auto',overflowX:'hidden'}
      },
        React.createElement('div', {style: Object.assign({width:'100%',position:'relative'}, coverStyle)},
          React.createElement('div', {style:{position:'absolute',bottom:'-30px',left:'50%',transform:'translateX(-50%)',width:'82px',height:'82px',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), border:'3px solid var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:800,color:'#fff'}},
            p.avatar_url ? null : initialOf(name)
          )
        ),
        React.createElement('div', {style:{padding:'40px 22px 22px'}},
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',textAlign:'center'}}, name),
          p.occupation ? React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',textAlign:'center',marginTop:'4px'}}, '💼 ' + p.occupation) : null,
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t3)',textAlign:'center',marginTop:'6px'}},
            (p.home_language ? ('🗣 ' + languageLabel(p.home_language)) : '') +
            (p.home_town ? (' · From ' + p.home_town) : '') +
            (p.current_city ? (' · 📍 ' + p.current_city) : '')
          ),
          p.bio ? React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',marginTop:'14px',padding:'12px',background:'var(--bg2)',borderRadius:'10px',lineHeight:1.5,whiteSpace:'pre-wrap'}}, typeof p.bio === 'string' ? p.bio.replace(/^"|"$/g, '') : '') : null,
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
            React.createElement('button', {
              onClick: function(){ followUser(p); },
              disabled: followSending,
              style:{flex:1,padding:'12px',borderRadius:'12px',background:'var(--bg2)',border:'1px solid var(--ac)',color:'var(--ac)',fontSize:'13px',fontWeight:700,cursor: followSending ? 'wait' : 'pointer',fontFamily:'inherit',opacity: followSending ? 0.7 : 1}
            }, followSending ? '...' : '👁 Follow'),
            React.createElement('button', {
              onClick: function(){ sendConnectionRequest(p); },
              disabled: connSending,
              style:{flex:2,padding:'12px',borderRadius:'12px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor: connSending ? 'wait' : 'pointer',fontFamily:'inherit',opacity: connSending ? 0.7 : 1}
            }, connSending ? 'Sending…' : '➕ Friend Request')
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
    /* R64.6: tightened card size + removed the flex:1 spacer.
     * Was 190x250 with a `flex:1` text container that pushed the
     * button down — caused visible blank space inside the card.
     * Now 170px wide with auto height (content + padding only). */
    var cardStyle = opts.grid
      ? {width:'100%',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px 8px 10px',display:'flex',flexDirection:'column',alignItems:'center',boxSizing:'border-box'}
      : {flex:'0 0 170px',minWidth:'170px',width:'170px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px 8px 10px',display:'flex',flexDirection:'column',alignItems:'center',boxSizing:'border-box'};
    return React.createElement('div', { key: p.user_id, style: cardStyle },
      /* Avatar with gradient ring + online dot. R64.6: 72→64px. */
      React.createElement('div', {
        onClick: function(){ setViewProfile(p); },
        style:{position:'relative',marginBottom:'8px',cursor:'pointer'}
      },
        React.createElement('div', {
          style:{width:'64px',height:'64px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',padding:'2.5px',boxSizing:'border-box'}
        },
          React.createElement('div', {
            style:{width:'100%',height:'100%',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name),border:'2.5px solid var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:800,color:'#fff',boxSizing:'border-box'}
          }, p.avatar_url ? null : initialOf(name))
        ),
        p.is_online ? React.createElement('div', {
          style:{position:'absolute',bottom:'2px',right:'2px',width:'12px',height:'12px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg2)'}
        }) : null
      ),
      /* Name */
      React.createElement('div', {style:{fontSize:'13px',fontWeight:800,color:'var(--text)',textAlign:'center',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'100%',padding:'0 4px',boxSizing:'border-box'}}, name),
      /* Occupation */
      p.occupation ? React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',textAlign:'center',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'100%',padding:'0 4px',boxSizing:'border-box'}}, p.occupation) : null,
      /* City + language */
      React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',textAlign:'center',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'100%',padding:'0 4px',boxSizing:'border-box'}},
        (p.current_city ? ('📍 ' + p.current_city) : '') +
        (p.home_language ? (' · ' + languageLabel(p.home_language)) : '')
      ),
      /* Action row: message + add friend.
       * R64.6: removed marginTop:'auto' (the flex spacer that caused
       * blank space). Now the button row sits right under the text
       * with a tight 10px gap. */
      React.createElement('div', {style:{display:'flex',gap:'6px',marginTop:'10px',width:'100%',alignItems:'center'}},
        React.createElement('button', {
          onClick: function(e){ e.stopPropagation(); setViewProfile(p); },
          style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--bg)',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'14px',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',padding:0}
        }, '💬'),
        React.createElement('button', {
          onClick: function(e){ e.stopPropagation(); sendConnectionRequest(p); },
          disabled: connSending,
          style:{flex:1,padding:'9px 8px',borderRadius:'17px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',opacity: connSending ? 0.7 : 1}
        }, 'Add')
      )
    );
  }
  /* Backwards-compat alias — the JSX below still calls the old name. */
  var renderSuggestionBlock = function(p){ return renderFriendCard(p, {grid:false}); };

  /* ══════ FILTER PILLS BAR ═══════════════════════════════════════ */
  var activeCount = (fLang?1:0) + (fCity?1:0) + (fHome?1:0) + (fOcc?1:0) + (fGender?1:0) + (fInterests.length>0?1:0) + (fOnline?1:0);

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    /* Header */
    React.createElement('div', {style:{padding:'14px 18px 4px'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🤝 Real Friends')
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

    /* SUGGESTED FOR YOU — horizontal SQUARE block cards (LinkedIn/IG style).
     * R64.2: added flexWrap:'nowrap' + flexShrink:0 to the outer wrapper
     * + larger marginTop on the Discover header below to prevent overlap. */
    (search.length === 0 && activeCount === 0 && suggested.length > 0)
      ? React.createElement('div', {style:{flexShrink:0}},
          React.createElement('div', {style:{padding:'6px 18px 10px',fontSize:'15px',fontWeight:800,color:'var(--text)',display:'flex',alignItems:'center',gap:'8px'}},
            React.createElement('span', null, '✨ Suggested for you')
          ),
          React.createElement('div', {
            className: 'ringin-hscroll',
            style:{display:'flex',gap:'12px',padding:'0 16px 20px',overflowX:'auto',overflowY:'hidden',scrollbarWidth:'none',msOverflowStyle:'none',WebkitOverflowScrolling:'touch',flexWrap:'nowrap',flexShrink:0}
          },
            suggested.map(renderSuggestionBlock)
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

    loading ? React.createElement('div', {style:{padding:'40px 16px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}}, 'Loading…')
    : results.length === 0
      ? React.createElement('div', {style:{padding:'40px 24px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'48px',marginBottom:'10px',opacity:0.4}}, '🌱'),
          React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}, 'No matches yet'),
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,maxWidth:'280px',margin:'0 auto'}}, 'Try expanding your filters or searching by a different city.')
        )
      /* R64.5: switched Discover from 2-column vertical grid to a
       * horizontal scrolling row of cards per user request. Same card
       * size as Suggested above (190px wide), swipe sideways through
       * all results. */
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
