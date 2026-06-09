/* eslint-disable */
/* ════════════════════════════════════════════════════════════════════
 * FriendsScreen.js — Real Friends v2 (R64).
 *
 * Major upgrade over v1:
 *   - Search bar at top (name / city / userId)
 *   - Expandable LinkedIn-style filter panel with 7 optional filters:
 *       1. Language
 *       2. Hometown      (typing-only autosuggest, world cities)
 *       3. Current city  (typing-only autosuggest, world cities)
 *       4. Occupation    (free text)
 *       5. Gender
 *       6. Interests     (multi-select chips)
 *       7. Online status
 *   - "Suggested for You" section above results, daily-rotating
 *     algorithm (suggest_friends RPC)
 *   - Profile modal with Follow + Send Friend Request
 *   - Cover image + avatar + bio in profile modal
 * ════════════════════════════════════════════════════════════════════ */

import React, {useState, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastError, toastInfo} from '../utils/toast';
import {searchCities} from '../utils/worldCities';

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

/* Common interests — chips users can multi-select. */
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

/* Reusable typing-only city input. Renders a small popover with up to 8
 * suggestions; collapses when user clears the input. Calls onChange
 * on every keystroke. */
function CityInput(props) {
  var value = props.value || '';
  var setValue = props.onChange;
  var placeholder = props.placeholder || 'Type a city';
  var openS = useState(false); var open = openS[0]; var setOpen = openS[1];
  var sug = (value && value.length > 0) ? searchCities(value, 8) : [];
  return React.createElement('div', {style:{position:'relative'}},
    React.createElement('input', {
      value: value,
      onChange: function(e){ setValue(e.target.value); setOpen(true); },
      onFocus: function(){ setOpen(true); },
      onBlur: function(){ setTimeout(function(){ setOpen(false); }, 150); },
      placeholder: placeholder,
      style:{width:'100%',padding:'10px 12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontFamily:'inherit',boxSizing:'border-box'}
    }),
    (open && sug.length > 0) ? React.createElement('div', {
      style:{position:'absolute',top:'100%',left:0,right:0,marginTop:'4px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',boxShadow:'0 6px 24px rgba(0,0,0,0.5)',maxHeight:'240px',overflowY:'auto',zIndex:10}
    },
      sug.map(function(c){
        return React.createElement('div', {
          key: c,
          onMouseDown: function(e){ e.preventDefault(); setValue(c); setOpen(false); },
          style:{padding:'10px 14px',cursor:'pointer',fontSize:'13px',color:'var(--text)',borderBottom:'1px solid var(--border)'}
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

  /* Search box (free text) */
  var searchS = useState(''); var search = searchS[0]; var setSearch = searchS[1];

  /* Filter panel open/closed + the 7 filter fields */
  var filtersOpenS = useState(false); var filtersOpen = filtersOpenS[0]; var setFiltersOpen = filtersOpenS[1];
  var fLangS = useState(''); var fLang = fLangS[0]; var setFLang = fLangS[1];
  var fHomeS = useState(''); var fHome = fHomeS[0]; var setFHome = fHomeS[1];
  var fCityS = useState(''); var fCity = fCityS[0]; var setFCity = fCityS[1];
  var fOccS  = useState(''); var fOcc  = fOccS[0];  var setFOcc  = fOccS[1];
  var fGenderS = useState(''); var fGender = fGenderS[0]; var setFGender = fGenderS[1];
  var fInterestsS = useState([]); var fInterests = fInterestsS[0]; var setFInterests = fInterestsS[1];
  var fOnlineS = useState(false); var fOnline = fOnlineS[0]; var setFOnline = fOnlineS[1];

  /* Results + suggestions */
  var resultsS = useState([]); var results = resultsS[0]; var setResults = resultsS[1];
  var suggestedS = useState([]); var suggested = suggestedS[0]; var setSuggested = suggestedS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];

  /* Setup modal */
  var setupOpenS = useState(false); var setupOpen = setupOpenS[0]; var setSetupOpen = setupOpenS[1];
  var savingSetupS = useState(false); var savingSetup = savingSetupS[0]; var setSavingSetup = savingSetupS[1];

  /* Profile view modal */
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

  /* ── Load suggestions on mount + when my profile loads ─────────── */
  useEffect(function(){
    if (!userId) return;
    sb.rpc('suggest_friends', { p_limit: 8 }).then(function(r){
      if (r && !r.error && Array.isArray(r.data)) setSuggested(r.data);
    });
  }, [userId, myLang, myCity]);

  /* ── Load results — debounced search whenever filter/search changes ── */
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
    sb.from('profiles').update(payload).eq('id', userId).then(function(r){
      setSavingSetup(false);
      if (r && r.error) {
        toastError('Could not save: ' + (r.error.message || 'try again'));
        return;
      }
      setSetupOpen(false);
      toastInfo('Profile updated');
    });
  }

  /* ── Send friend request (reuses existing anon connection RPC) ─── */
  function sendConnectionRequest(p) {
    if (!p || !p.user_id || connSending) return;
    setConnSending(true);
    sb.rpc('request_anon_connection', { p_recipient: p.user_id }).then(function(r){
      setConnSending(false);
      if (r && r.error) {
        toastError('Could not send: ' + (r.error.message || 'error'));
        return;
      }
      var status = r && r.data && r.data.status;
      if (status === 'already_connected') toastInfo('You are already connected');
      else if (status === 'already_pending') toastInfo('Request already sent');
      else toastInfo('Friend request sent ✓');
      setViewProfile(null);
    }).catch(function(){
      setConnSending(false);
      toastError('Network error');
    });
  }

  /* ── Follow (best-effort — falls back gracefully if RPC missing) ── */
  function followUser(p) {
    if (!p || !p.user_id || followSending) return;
    setFollowSending(true);
    sb.from('follows').upsert({ follower_id: userId, following_id: p.user_id })
      .then(function(r){
        setFollowSending(false);
        if (r && r.error) {
          toastError('Follow failed: ' + (r.error.message || 'error'));
          return;
        }
        toastInfo('Following ' + (p.full_name || p.anon_nickname || ''));
      })
      .catch(function(){
        setFollowSending(false);
        toastError('Network error');
      });
  }

  /* ── Toggle an interest chip ───────────────────────────────────── */
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

  /* ══════ RENDERS ══════════════════════════════════════════════════ */

  function renderSetupModal() {
    if (!setupOpen) return null;
    return React.createElement('div', {style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}},
      React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',padding:'20px',maxWidth:'480px',width:'100%',maxHeight:'92vh',overflowY:'auto'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',marginBottom:'4px'}}, '🤝 Tell us about you'),
        React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',marginBottom:'16px'}}, 'These help us find better friend matches. Skip anything you do not want to fill.'),

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
        React.createElement(CityInput, { value: myHome, onChange: setMyHome, placeholder: 'Type your hometown (e.g. Kochi)' }),
        React.createElement('div', {style:{height:'12px'}}),

        React.createElement('label', {style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'6px'}}, 'CURRENT CITY'),
        React.createElement(CityInput, { value: myCity, onChange: setMyCity, placeholder: 'Type where you live now' }),
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
        style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',maxWidth:'440px',width:'100%',maxHeight:'92vh',overflowY:'auto',overflow:'hidden'}
      },
        /* Cover */
        React.createElement('div', {style: Object.assign({width:'100%',position:'relative'}, coverStyle)},
          /* Avatar overlapping bottom of cover */
          React.createElement('div', {style:{position:'absolute',bottom:'-30px',left:'50%',transform:'translateX(-50%)',width:'82px',height:'82px',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), border:'3px solid var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:800,color:'#fff'}},
            p.avatar_url ? null : initialOf(name)
          )
        ),
        React.createElement('div', {style:{padding:'40px 22px 22px'}},
          React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',textAlign:'center'}}, name),
          /* Occupation */
          p.occupation ? React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',textAlign:'center',marginTop:'4px'}}, '💼 ' + p.occupation) : null,
          /* Community line */
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t3)',textAlign:'center',marginTop:'6px'}},
            (p.home_language ? ('🗣 ' + languageLabel(p.home_language)) : '') +
            (p.home_town ? (' · From ' + p.home_town) : '') +
            (p.current_city ? (' · 📍 ' + p.current_city) : '')
          ),
          /* Bio */
          p.bio ? React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',marginTop:'14px',padding:'12px',background:'var(--bg2)',borderRadius:'10px',lineHeight:1.5,whiteSpace:'pre-wrap'}}, typeof p.bio === 'string' ? p.bio.replace(/^"|"$/g, '') : '') : null,
          /* Interests */
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
          /* Actions */
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

  /* Suggested card — smaller, horizontal scroll */
  function renderSuggestionCard(p) {
    var name = p.full_name || 'Anonymous';
    return React.createElement('div', {
      key: p.user_id,
      onClick: function(){ setViewProfile(p); },
      style:{minWidth:'140px',padding:'14px 10px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',marginRight:'8px',cursor:'pointer',textAlign:'center',flexShrink:0}
    },
      React.createElement('div', {style:{width:'56px',height:'56px',margin:'0 auto 8px',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:800,color:'#fff'}},
        p.avatar_url ? null : initialOf(name)
      ),
      React.createElement('div', {style:{fontSize:'12px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
      React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
        (p.current_city || '') + (p.home_language ? (' · ' + languageLabel(p.home_language)) : '')
      )
    );
  }

  /* Active filter count badge */
  var activeFilters = 0;
  if (fLang) activeFilters++;
  if (fHome) activeFilters++;
  if (fCity) activeFilters++;
  if (fOcc)  activeFilters++;
  if (fGender) activeFilters++;
  if (fInterests.length > 0) activeFilters++;
  if (fOnline) activeFilters++;

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    /* Header */
    React.createElement('div', {style:{padding:'14px 18px 4px'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🤝 Real Friends')
    ),
    React.createElement('div', {style:{padding:'2px 18px 12px',fontSize:'11px',color:'var(--t2)'}}, 'Search · Filter · Suggest'),

    /* Search box */
    React.createElement('div', {style:{padding:'0 16px 8px'}},
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

    /* Filter toggle + active count */
    React.createElement('div', {style:{padding:'0 16px 10px',display:'flex',gap:'8px',alignItems:'center'}},
      React.createElement('button', {
        onClick: function(){ setFiltersOpen(!filtersOpen); },
        style:{flex:1,padding:'10px 14px',borderRadius:'10px',background: filtersOpen ? 'linear-gradient(135deg,rgba(123,110,255,0.2),rgba(232,77,154,0.15))' : 'var(--bg2)',border: filtersOpen ? '1px solid var(--ac)' : '1px solid var(--border)',color:'var(--text)',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between'}
      },
        React.createElement('span', null, '🎛 Filters' + (activeFilters > 0 ? ' · ' + activeFilters + ' active' : '')),
        React.createElement('span', {style:{fontSize:'13px',transition:'transform 0.2s',transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)',display:'inline-block'}}, '▾')
      ),
      activeFilters > 0 ? React.createElement('button', {
        onClick: function(){ setFLang(''); setFHome(''); setFCity(''); setFOcc(''); setFGender(''); setFInterests([]); setFOnline(false); },
        style:{padding:'10px 12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
      }, 'Clear') : null
    ),

    /* Expandable filter panel */
    filtersOpen ? React.createElement('div', {style:{margin:'0 16px 12px',padding:'14px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px'}},
      /* Language */
      React.createElement('label', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'5px',letterSpacing:'0.5px'}}, 'LANGUAGE'),
      React.createElement('select', {
        value: fLang,
        onChange: function(e){ setFLang(e.target.value); },
        style:{width:'100%',padding:'9px 10px',borderRadius:'8px',background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'12px',fontFamily:'inherit',marginBottom:'10px'}
      },
        React.createElement('option', {value:''}, 'Any language'),
        LANGUAGES.map(function(l){ return React.createElement('option', {key:l.value, value:l.value}, l.label); })
      ),
      /* Hometown */
      React.createElement('label', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'5px',letterSpacing:'0.5px'}}, 'HOMETOWN'),
      React.createElement(CityInput, { value: fHome, onChange: setFHome, placeholder: 'Type a hometown' }),
      React.createElement('div', {style:{height:'10px'}}),
      /* Current city */
      React.createElement('label', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'5px',letterSpacing:'0.5px'}}, 'CURRENT CITY'),
      React.createElement(CityInput, { value: fCity, onChange: setFCity, placeholder: 'Type a city' }),
      React.createElement('div', {style:{height:'10px'}}),
      /* Occupation */
      React.createElement('label', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'5px',letterSpacing:'0.5px'}}, 'OCCUPATION'),
      React.createElement('input', {
        value: fOcc,
        onChange: function(e){ setFOcc(e.target.value); },
        placeholder: 'e.g. Engineer, Doctor, Student',
        style:{width:'100%',padding:'9px 10px',borderRadius:'8px',background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'12px',fontFamily:'inherit',marginBottom:'10px',boxSizing:'border-box'}
      }),
      /* Gender */
      React.createElement('label', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'5px',letterSpacing:'0.5px'}}, 'GENDER'),
      React.createElement('div', {style:{display:'flex',gap:'6px',marginBottom:'10px'}},
        ['', 'f', 'm', 'other'].map(function(g){
          var label = g === '' ? 'Any' : (g === 'f' ? '👧 Girl' : (g === 'm' ? '👦 Boy' : '🌈 Other'));
          var sel = fGender === g;
          return React.createElement('button', {
            key: g,
            onClick: function(){ setFGender(g); },
            style:{flex:1,padding:'8px 4px',borderRadius:'8px',background: sel ? 'linear-gradient(135deg,#7B6EFF,#E84D9A)' : 'var(--bg)',border: sel ? 'none' : '1px solid var(--border)',color: sel ? '#fff' : 'var(--t2)',fontSize:'11px',fontWeight: sel ? 700 : 600,cursor:'pointer',fontFamily:'inherit'}
          }, label);
        })
      ),
      /* Interests */
      React.createElement('label', {style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',display:'block',marginBottom:'5px',letterSpacing:'0.5px'}}, 'INTERESTS · TAP TO ADD'),
      React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:'10px',maxHeight:'110px',overflowY:'auto'}},
        INTEREST_SUGGESTIONS.map(function(it){
          var sel = fInterests.indexOf(it) >= 0;
          return React.createElement('button', {
            key: it,
            onClick: function(){ toggleInterestFilter(it); },
            style:{padding:'5px 9px',borderRadius:'12px',background: sel ? 'linear-gradient(135deg,rgba(123,110,255,0.3),rgba(232,77,154,0.2))' : 'var(--bg)',border: sel ? '1px solid var(--ac)' : '1px solid var(--border)',color: sel ? 'var(--text)' : 'var(--t2)',fontSize:'10px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, (sel ? '✓ ' : '') + it);
        })
      ),
      /* Online toggle */
      React.createElement('div', {
        onClick: function(){ setFOnline(!fOnline); },
        style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px',cursor:'pointer'}
      },
        React.createElement('div', {style:{width:'34px',height:'20px',borderRadius:'10px',background: fOnline ? '#27C96A' : 'var(--border)',position:'relative',transition:'background 0.2s'}},
          React.createElement('div', {style:{position:'absolute',top:'2px',left: fOnline ? '16px' : '2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}})
        ),
        React.createElement('span', {style:{fontSize:'12px',color:'var(--text)',fontWeight:600}}, 'Online now only')
      )
    ) : null,

    /* Suggested for You */
    (search.length === 0 && activeFilters === 0 && suggested.length > 0)
      ? React.createElement('div', null,
          React.createElement('div', {style:{padding:'2px 18px 8px',fontSize:'12px',fontWeight:700,color:'var(--text)'}}, '✨ Suggested for you'),
          React.createElement('div', {style:{display:'flex',padding:'0 16px 12px',overflowX:'auto',scrollbarWidth:'none'}},
            suggested.map(renderSuggestionCard)
          )
        )
      : null,

    /* Results header */
    React.createElement('div', {style:{padding:'4px 18px 6px',fontSize:'12px',fontWeight:700,color:'var(--t2)',display:'flex',justifyContent:'space-between'}},
      React.createElement('span', null,
        search.length > 0 ? 'Search results' : (activeFilters > 0 ? 'Filter results' : 'Discover')
      ),
      React.createElement('span', {style:{color:'var(--t3)',fontWeight:600}}, results.length + (results.length === 1 ? ' person' : ' people'))
    ),

    /* Results */
    loading ? React.createElement('div', {style:{padding:'40px 16px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}}, 'Loading…')
    : results.length === 0
      ? React.createElement('div', {style:{padding:'40px 24px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'48px',marginBottom:'10px',opacity:0.4}}, '🌱'),
          React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}, 'No matches yet'),
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,maxWidth:'280px',margin:'0 auto'}},
            'Try expanding your filters or searching by a different city.'
          )
        )
      : React.createElement('div', {style:{padding:'4px 16px 90px'}},
          results.map(renderResultRow)
        ),

    renderSetupModal(),
    renderProfileModal()
  );
}
