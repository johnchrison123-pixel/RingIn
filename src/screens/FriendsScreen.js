/* eslint-disable */
/* ════════════════════════════════════════════════════════════════════
 * FriendsScreen.js — Real Friends Phase 1 (R63).
 *
 * Lets users find people from their community (home language) who live
 * in the same current city. The "I just moved to Dubai from Kerala,
 * find me Malayalis" use case.
 *
 * Phase 1 scope:
 *   - 3 profile fields (home_language, home_town, current_city)
 *   - Filter dropdowns: language + city
 *   - List of matching profiles
 *   - "Send Connection Request" → reuses existing anon connection flow
 *   - Empty state when filters yield no results
 *
 * Deferred to Phase 2:
 *   - Voice rooms by city
 *   - Audio profile snippets
 *   - KYC liveness verification
 *   - Push notifications for new matching joiners
 *   - Premium boost / contact reveal
 * ════════════════════════════════════════════════════════════════════ */

import React, {useState, useEffect, useRef} from 'react';
import {sb} from '../utils/supabase';
import {toastError, toastInfo} from '../utils/toast';

/* 12 languages the Phase 1 audit identified as the strongest demand. */
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

/* Seed cities — the autosuggest will gradually surface real cities from
 * the user base via list_distinct_friend_cities, but on Day 1 there are
 * zero entries, so we provide a sensible starter set covering Gulf,
 * Indian metros + tier-2, and English-speaking diaspora hubs. */
var CITY_SUGGESTIONS = [
  /* Gulf — high-demand diaspora */
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Riyadh', 'Jeddah', 'Dammam', 'Doha', 'Kuwait City', 'Manama', 'Muscat',
  /* India metros */
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  /* India tier-2 */
  'Kochi', 'Kozhikode', 'Thiruvananthapuram', 'Thrissur', 'Coimbatore', 'Madurai', 'Visakhapatnam',
  'Vijayawada', 'Mysore', 'Mangalore', 'Nagpur', 'Indore', 'Jaipur', 'Lucknow', 'Bhopal',
  'Chandigarh', 'Ludhiana', 'Amritsar', 'Surat', 'Vadodara', 'Gurgaon', 'Noida',
  /* US diaspora */
  'New York', 'San Francisco', 'Chicago', 'Los Angeles', 'Houston', 'Dallas', 'Atlanta', 'Seattle',
  'Boston', 'Washington DC', 'Detroit', 'San Jose', 'Austin',
  /* UK + EU + Canada + Australia diaspora */
  'London', 'Manchester', 'Birmingham', 'Edinburgh',
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Mississauga', 'Brampton',
  'Sydney', 'Melbourne', 'Brisbane', 'Perth',
  'Singapore', 'Kuala Lumpur',
  /* Pakistan */
  'Karachi', 'Lahore', 'Islamabad',
];

function languageLabel(v) {
  for (var i = 0; i < LANGUAGES.length; i++) {
    if (LANGUAGES[i].value === v) return LANGUAGES[i].label;
  }
  return v ? (v.charAt(0).toUpperCase() + v.slice(1)) : 'Any';
}

function gradientFromString(s) {
  /* Stable color hash so the same nickname always gets the same gradient
   * (no random reroll on every render). */
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

export default function FriendsScreen(props) {
  var session = props.session;
  var userId = session && session.user ? session.user.id : null;
  var onOpenProfile = props.onOpenProfile;

  /* My own community fields — drive the default filter values. */
  var myLangS = useState(''); var myLang = myLangS[0]; var setMyLang = myLangS[1];
  var myHomeS = useState(''); var myHome = myHomeS[0]; var setMyHome = myHomeS[1];
  var myCityS = useState(''); var myCity = myCityS[0]; var setMyCity = myCityS[1];

  /* Filter state — what the user is currently querying. */
  var filterLangS = useState(''); var filterLang = filterLangS[0]; var setFilterLang = filterLangS[1];
  var filterCityS = useState(''); var filterCity = filterCityS[0]; var setFilterCity = filterCityS[1];

  /* Loaded list state */
  var resultsS = useState([]); var results = resultsS[0]; var setResults = resultsS[1];
  var countS = useState(0); var count = countS[0]; var setCount = countS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];

  /* Setup modal — first-time prompt to fill in language + city. */
  var setupOpenS = useState(false); var setupOpen = setupOpenS[0]; var setSetupOpen = setupOpenS[1];
  var setupLangS = useState(''); var setupLang = setupLangS[0]; var setSetupLang = setupLangS[1];
  var setupHomeS = useState(''); var setupHome = setupHomeS[0]; var setSetupHome = setupHomeS[1];
  var setupCityS = useState(''); var setupCity = setupCityS[0]; var setSetupCity = setupCityS[1];
  var savingSetupS = useState(false); var savingSetup = savingSetupS[0]; var setSavingSetup = savingSetupS[1];

  /* Profile view modal */
  var viewProfileS = useState(null); var viewProfile = viewProfileS[0]; var setViewProfile = viewProfileS[1];
  var connSendingS = useState(false); var connSending = connSendingS[0]; var setConnSending = connSendingS[1];

  /* City suggestions surfaced from the actual user base — replaces
   * the hard-coded seed list once real data starts flowing in. */
  var cityListS = useState(CITY_SUGGESTIONS); var cityList = cityListS[0]; var setCityList = cityListS[1];

  /* Load my own community fields from profiles + decide if setup modal needs to show. */
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    sb.from('profiles')
      .select('home_language,home_town,current_city')
      .eq('id', userId)
      .maybeSingle()
      .then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) {
          var lang = r.data.home_language || '';
          var home = r.data.home_town || '';
          var city = r.data.current_city || '';
          setMyLang(lang); setMyHome(home); setMyCity(city);
          /* Default the filter to my own values so I land on a useful
           * result list ("Malayalis in Dubai") instead of an empty grid. */
          setFilterLang(lang);
          setFilterCity(city);
          if (!lang || !city) {
            setSetupLang(lang); setSetupHome(home); setSetupCity(city);
            setSetupOpen(true);
          }
        } else {
          setSetupOpen(true);
        }
      }).catch(function(){
        /* Profile fetch failed — show setup anyway so user can fill it in. */
        setSetupOpen(true);
      });
    return function(){ cancelled = true; };
  }, [userId]);

  /* Pull list of real cities from the DB to enrich the autosuggest. */
  useEffect(function(){
    if (!userId) return;
    sb.rpc('list_distinct_friend_cities', { p_limit: 100 }).then(function(r){
      if (r && !r.error && Array.isArray(r.data) && r.data.length > 0) {
        var live = r.data.map(function(row){ return row.city; });
        /* Merge live cities with the seed list, dedupe. */
        var merged = live.concat(CITY_SUGGESTIONS);
        var seen = {}, out = [];
        for (var i = 0; i < merged.length; i++) {
          var c = (merged[i] || '').trim();
          var k = c.toLowerCase();
          if (c && !seen[k]) { seen[k] = 1; out.push(c); }
        }
        setCityList(out);
      }
    }).catch(function(){});
  }, [userId]);

  /* Load matching friends whenever the filter changes. */
  useEffect(function(){
    if (!userId) return;
    if (!filterLang && !filterCity) {
      /* Filter is fully open — show a global recent list, capped low. */
      setLoading(true);
      sb.rpc('list_community_friends', { p_language: null, p_city: null, p_limit: 30 })
        .then(function(r){
          setLoading(false);
          if (r && !r.error && Array.isArray(r.data)) setResults(r.data);
        }).catch(function(){ setLoading(false); });
      sb.rpc('count_community_friends', { p_language: null, p_city: null })
        .then(function(r){ if (r && !r.error && typeof r.data === 'number') setCount(r.data); });
      return;
    }
    setLoading(true);
    sb.rpc('list_community_friends', {
      p_language: filterLang || null,
      p_city: filterCity || null,
      p_limit: 100,
    }).then(function(r){
      setLoading(false);
      if (r && !r.error && Array.isArray(r.data)) setResults(r.data);
      else if (r && r.error) console.warn('[friends] list error:', r.error);
    }).catch(function(){ setLoading(false); });
    sb.rpc('count_community_friends', {
      p_language: filterLang || null,
      p_city: filterCity || null,
    }).then(function(r){
      if (r && !r.error && typeof r.data === 'number') setCount(r.data);
    }).catch(function(){});
  }, [userId, filterLang, filterCity]);

  /* Save the setup modal — writes the 3 community fields to my profile. */
  function saveSetup() {
    if (savingSetup) return;
    setSavingSetup(true);
    var payload = {
      home_language: (setupLang || '').trim() || null,
      home_town: (setupHome || '').trim() || null,
      current_city: (setupCity || '').trim() || null,
    };
    sb.from('profiles').update(payload).eq('id', userId).then(function(r){
      setSavingSetup(false);
      if (r && r.error) {
        toastError('Could not save: ' + (r.error.message || 'try again'));
        return;
      }
      setMyLang(payload.home_language || '');
      setMyHome(payload.home_town || '');
      setMyCity(payload.current_city || '');
      setFilterLang(payload.home_language || '');
      setFilterCity(payload.current_city || '');
      setSetupOpen(false);
      try { toastInfo('Profile updated — finding your community now'); } catch(_){}
    }).catch(function(){
      setSavingSetup(false);
      toastError('Network error');
    });
  }

  /* Send a connection request to the user shown in the profile modal.
   * Re-uses the existing anon connection flow so accepted requests show
   * up in the Connections list. */
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
      if (status === 'already_connected') {
        try { toastInfo('You are already connected'); } catch(_){}
      } else if (status === 'already_pending') {
        try { toastInfo('Request already sent — waiting for response'); } catch(_){}
      } else {
        try { toastInfo('Connection request sent ✓'); } catch(_){}
      }
      setViewProfile(null);
    }).catch(function(){
      setConnSending(false);
      toastError('Network error');
    });
  }

  /* ── RENDERS ──────────────────────────────────────────────────────── */

  function renderSetupModal() {
    if (!setupOpen) return null;
    return React.createElement('div', {
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}
    },
      React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',padding:'22px',maxWidth:'440px',width:'100%',maxHeight:'90vh',overflowY:'auto'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',marginBottom:'4px'}}, '🤝 Find your people'),
        React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',marginBottom:'18px',lineHeight:1.5}}, 'Tell us your language community + current city. We will surface people you can connect with.'),

        /* Language */
        React.createElement('label', {style:{display:'block',fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Your home language'),
        React.createElement('select', {
          value: setupLang,
          onChange: function(e){ setSetupLang(e.target.value); },
          style:{width:'100%',padding:'12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'14px',marginBottom:'14px',fontFamily:'inherit'}
        },
          React.createElement('option', {value:''}, 'Select…'),
          LANGUAGES.map(function(l){ return React.createElement('option', {key:l.value, value:l.value}, l.label); })
        ),

        /* Hometown (optional) */
        React.createElement('label', {style:{display:'block',fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Where you are originally from (optional)'),
        React.createElement('input', {
          value: setupHome,
          onChange: function(e){ setSetupHome(e.target.value); },
          placeholder: 'e.g. Kochi, Chennai, Lahore',
          style:{width:'100%',padding:'12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'14px',marginBottom:'14px',fontFamily:'inherit',boxSizing:'border-box'}
        }),

        /* Current city */
        React.createElement('label', {style:{display:'block',fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, 'Current city'),
        React.createElement('input', {
          value: setupCity,
          onChange: function(e){ setSetupCity(e.target.value); },
          placeholder: 'e.g. Dubai, Gurgaon, London',
          list: 'friends-city-suggestions',
          style:{width:'100%',padding:'12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'14px',marginBottom:'18px',fontFamily:'inherit',boxSizing:'border-box'}
        }),
        React.createElement('datalist', {id:'friends-city-suggestions'},
          cityList.slice(0, 100).map(function(c){ return React.createElement('option', {key:c, value:c}); })
        ),

        /* Buttons */
        React.createElement('div', {style:{display:'flex',gap:'10px'}},
          React.createElement('button', {
            onClick: function(){ setSetupOpen(false); },
            style:{flex:1,padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Skip for now'),
          React.createElement('button', {
            onClick: saveSetup,
            disabled: savingSetup || !setupLang || !setupCity,
            style:{flex:2,padding:'12px',borderRadius:'10px',background: (savingSetup || !setupLang || !setupCity) ? 'var(--bg3)' : 'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor: (savingSetup || !setupLang || !setupCity) ? 'not-allowed' : 'pointer',fontFamily:'inherit',opacity: (savingSetup || !setupLang || !setupCity) ? 0.6 : 1}
          }, savingSetup ? '...' : 'Find my community')
        )
      )
    );
  }

  function renderProfileModal() {
    if (!viewProfile) return null;
    var p = viewProfile;
    var name = p.full_name || p.anon_nickname || 'Anonymous';
    return React.createElement('div', {
      onClick: function(){ setViewProfile(null); },
      style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}
    },
      React.createElement('div', {
        onClick: function(e){ e.stopPropagation(); },
        style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'18px',padding:'24px',maxWidth:'420px',width:'100%'}
      },
        /* Avatar */
        React.createElement('div', {style:{width:'88px',height:'88px',borderRadius:'50%',margin:'0 auto 14px',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), display:'flex',alignItems:'center',justifyContent:'center',fontSize:'34px',fontWeight:800,color:'#fff'}},
          p.avatar_url ? null : initialOf(name)
        ),
        /* Name */
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'22px',fontWeight:800,color:'var(--text)',textAlign:'center'}}, name),
        /* Community line */
        React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',textAlign:'center',marginTop:'4px'}},
          (p.home_language ? ('🗣 ' + languageLabel(p.home_language)) : '') +
          (p.home_town ? (' · From ' + p.home_town) : '') +
          (p.current_city ? (' · Lives in ' + p.current_city) : '')
        ),
        /* Bio */
        p.bio ? React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',marginTop:'14px',padding:'12px',background:'var(--bg2)',borderRadius:'10px',lineHeight:1.5,whiteSpace:'pre-wrap'}}, typeof p.bio === 'string' ? p.bio.slice(0, 280) : '') : null,

        /* Send connection request */
        React.createElement('button', {
          onClick: function(){ sendConnectionRequest(p); },
          disabled: connSending,
          style:{width:'100%',marginTop:'18px',padding:'14px',borderRadius:'12px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'14px',fontWeight:700,cursor: connSending ? 'wait' : 'pointer',fontFamily:'inherit',opacity: connSending ? 0.7 : 1}
        }, connSending ? 'Sending…' : '➕ Send Friend Request'),

        React.createElement('button', {
          onClick: function(){ setViewProfile(null); },
          style:{width:'100%',marginTop:'10px',padding:'12px',borderRadius:'10px',background:'transparent',border:'1px solid var(--border)',color:'var(--t2)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
        }, 'Close')
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
      /* Avatar */
      React.createElement('div', {style:{width:'48px',height:'48px',borderRadius:'50%',background: p.avatar_url ? ('url(' + p.avatar_url + ') center/cover') : gradientFromString(name), display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:800,color:'#fff',flexShrink:0,position:'relative'}},
        p.avatar_url ? null : initialOf(name),
        p.is_online ? React.createElement('div', {style:{position:'absolute',bottom:'-2px',right:'-2px',width:'12px',height:'12px',borderRadius:'50%',background:'#27C96A',border:'2px solid var(--bg2)'}}) : null
      ),
      /* Text block */
      React.createElement('div', {style:{flex:1,minWidth:0}},
        React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
        React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)',marginTop:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},
          (p.home_language ? ('🗣 ' + languageLabel(p.home_language)) : '') +
          (p.current_city ? (' · 📍 ' + p.current_city) : '') +
          (p.home_town ? (' · From ' + p.home_town) : '')
        )
      ),
      /* Chevron */
      React.createElement('div', {style:{fontSize:'18px',color:'var(--t3)',flexShrink:0}}, '›')
    );
  }

  /* Header sentence — "127 Malayalis in Dubai" / "Recently joined" etc. */
  var headerText = (function(){
    if (filterLang && filterCity) {
      return count + ' ' + (count === 1 ? 'person' : 'people') + ' who speak ' + languageLabel(filterLang) + ' in ' + filterCity;
    }
    if (filterLang) {
      return count + ' ' + languageLabel(filterLang) + ' speakers worldwide';
    }
    if (filterCity) {
      return count + ' people in ' + filterCity;
    }
    return 'Recently joined RingIn';
  })();

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    /* Header */
    React.createElement('div', {style:{padding:'14px 18px 4px'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'24px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🤝 Real Friends')
    ),
    React.createElement('div', {style:{padding:'2px 18px 14px',fontSize:'12px',color:'var(--t2)'}}, 'Find people from your community in your city'),

    /* My profile chip — clickable to re-open setup */
    React.createElement('div', {
      onClick: function(){
        setSetupLang(myLang); setSetupHome(myHome); setSetupCity(myCity);
        setSetupOpen(true);
      },
      style:{margin:'0 16px 14px',padding:'12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px'}
    },
      React.createElement('div', {style:{fontSize:'22px'}}, '🪪'),
      React.createElement('div', {style:{flex:1,minWidth:0}},
        React.createElement('div', {style:{fontSize:'12px',color:'var(--t3)',fontWeight:600}}, 'YOUR COMMUNITY'),
        React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginTop:'2px'}},
          (myLang ? languageLabel(myLang) : 'Set your language') +
          (myCity ? (' · ' + myCity) : '') +
          (myHome ? (' · from ' + myHome) : '')
        )
      ),
      React.createElement('div', {style:{fontSize:'11px',color:'var(--ac)',fontWeight:700}}, 'Edit')
    ),

    /* Filter row */
    React.createElement('div', {style:{display:'flex',gap:'8px',padding:'0 16px 12px'}},
      React.createElement('select', {
        value: filterLang,
        onChange: function(e){ setFilterLang(e.target.value); },
        style:{flex:1,padding:'10px 8px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontFamily:'inherit'}
      },
        React.createElement('option', {value:''}, 'All languages'),
        LANGUAGES.map(function(l){ return React.createElement('option', {key:l.value, value:l.value}, l.label); })
      ),
      React.createElement('input', {
        value: filterCity,
        onChange: function(e){ setFilterCity(e.target.value); },
        placeholder: 'City',
        list: 'friends-city-suggestions',
        style:{flex:1,padding:'10px 12px',borderRadius:'10px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontFamily:'inherit',boxSizing:'border-box'}
      })
    ),

    /* Result header */
    React.createElement('div', {style:{padding:'4px 18px 6px',fontSize:'12px',fontWeight:700,color:'var(--t2)'}}, headerText),

    /* Results */
    loading ? React.createElement('div', {style:{padding:'40px 16px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}}, 'Loading…')
    : results.length === 0
      ? React.createElement('div', {style:{padding:'40px 24px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'48px',marginBottom:'10px',opacity:0.4}}, '🌱'),
          React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}}, 'No one here yet'),
          React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,maxWidth:'280px',margin:'0 auto'}},
            (filterLang && filterCity)
              ? ('Be the first ' + languageLabel(filterLang) + ' speaker in ' + filterCity + '. Tell a friend to join.')
              : 'Try changing the filter or expanding to a nearby city.'
          )
        )
      : React.createElement('div', {style:{padding:'4px 16px 90px'}},
          results.map(renderResultRow)
        ),

    renderSetupModal(),
    renderProfileModal()
  );
}
