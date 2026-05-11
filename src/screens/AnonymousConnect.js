/* eslint-disable */
import React, {useState} from 'react';
import {matchAnonymous} from '../utils/mlService';
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

  function addInterest(i) {
    var v = (i || '').trim().toLowerCase();
    if (v && interests.indexOf(v) < 0) setInterests(interests.concat([v]));
    setInput('');
  }
  function removeInterest(i) {
    setInterests(interests.filter(function(x){ return x !== i; }));
  }

  function find() {
    if (!userId) { toastError('Please log in'); return; }
    setSearching(true); setErr(null); setMatch(null);

    matchAnonymous({
      userId: userId,
      interests: interests,
      sameGeography: sameGeo,
      excludeUserIds: exclude,
    }).then(function(r){
      setSearching(false);
      if (!r || !r.match) {
        setErr(r && r.reason ? r.reason : 'No matches available right now. Try again in a moment!');
        return;
      }
      setMatch(r.match);
    });
  }

  function skip() {
    if (match) setExclude(exclude.concat([match.user_id]));
    setMatch(null);
    find();
  }

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div', {style:{position:'sticky',top:0,zIndex:10,background:'var(--bg2)',padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid var(--border)'}},
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}, '🎭 Anonymous Connect')
    ),

    // Searching
    searching && React.createElement('div', {style:{padding:'48px 24px',textAlign:'center'}},
      React.createElement('div', {style:{width:'80px',height:'80px',borderRadius:'50%',margin:'0 auto 18px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',animation:'pulse 1.5s ease-in-out infinite'}}, '📞'),
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'20px',fontWeight:700,color:'var(--text)'}}, 'Finding someone...'),
      React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)',marginTop:'6px'}}, sameGeo ? 'Searching in your area' : 'Searching globally')
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
      React.createElement('div', {style:{display:'flex',gap:'10px',marginTop:'20px',justifyContent:'center'}},
        React.createElement('button', {onClick:skip, style:{padding:'10px 18px',borderRadius:'10px',background:'var(--bg4)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}, 'Skip'),
        React.createElement('button', {onClick:function(){toastInfo('Voice call coming soon!');}, style:{padding:'10px 20px',borderRadius:'10px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer'}}, '📞 Connect Voice')
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
          onKeyDown:function(e){if(e.key==='Enter' && input.trim()){addInterest(input);}},
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
