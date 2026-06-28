/* eslint-disable */
import React,{useState,useEffect} from 'react';
import {sb} from '../utils/supabase';

// Stable-ish gradient from a string, so avatar fallbacks aren't all the
// same color (mirrors the pattern used in FriendsScreen).
function gradientFromString(str){
  var s = str || '';
  var h = 0;
  for (var i=0; i<s.length; i++){ h = (h*31 + s.charCodeAt(i)) & 0xffffff; }
  var h1 = h % 360; var h2 = (h1 + 48) % 360;
  return 'linear-gradient(135deg,hsl('+h1+',62%,52%),hsl('+h2+',62%,42%))';
}

function initialOf(name){
  return (name && name.trim().length > 0) ? name.trim().charAt(0).toUpperCase() : '?';
}

// Build a "Tier · Lv N" label, gracefully tolerating missing fields so a
// partially-populated RPC row never blanks the whole line.
function tierLabel(tier, level){
  var t = (tier && String(tier).trim()) ? String(tier).trim() : null;
  var hasLv = (level !== null && level !== undefined && level !== '');
  if (t && hasLv) return t + ' · Lv ' + level;
  if (t) return t;
  if (hasLv) return 'Lv ' + level;
  return '';
}

export default function LeaderboardScreen(props){
  var onBack = props.onBack;
  var onViewUser = props.onViewUser;

  var rowsS=useState([]); var rows=rowsS[0]; var setRows=rowsS[1];
  var statusS=useState(null); var status=statusS[0]; var setStatus=statusS[1];
  var loadingS=useState(true); var loading=loadingS[0]; var setLoading=loadingS[1];
  var errS=useState(false); var err=errS[0]; var setErr=errS[1];

  useEffect(function(){
    var alive = true;

    // Leaderboard list — host_leaderboard RPC. Wrapped so a not-yet-run
    // migration (function does not exist) degrades to the empty/error state
    // rather than crashing the screen.
    (async function(){
      try {
        var r = await sb.rpc('host_leaderboard', { p_limit: 50 });
        if (!alive) return;
        if (r && r.error) { setErr(true); }
        else { setRows((r && Array.isArray(r.data)) ? r.data : []); }
      } catch(_) {
        if (alive) setErr(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Caller's own status — my_status RPC. Independent try/catch: if this
    // function isn't deployed yet we simply hide the "Your status" card.
    (async function(){
      try {
        var s = await sb.rpc('my_status', {});
        if (!alive) return;
        if (s && !s.error && s.data) {
          // RPC may return a single row object or an array of one row.
          var d = Array.isArray(s.data) ? (s.data[0] || null) : s.data;
          setStatus(d || null);
        }
      } catch(_) { /* hide the card */ }
    })();

    return function(){ alive = false; };
  },[]);

  // ---- header (always rendered) ----
  var header = React.createElement('div',{style:{padding:'14px 18px 8px',display:'flex',alignItems:'center',gap:'10px'}},
    onBack && React.createElement('button',{onClick:onBack,title:'Back',style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px 4px 4px 0',display:'flex',alignItems:'center',justifyContent:'center'}},
      React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
        React.createElement('polyline',{points:'15 18 9 12 15 6'})
      )
    ),
    React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Leaderboard')
  );

  // ---- "Your status" card ----
  var statusCard = null;
  if (status) {
    var hostLine = tierLabel(status.host_tier, status.host_level);
    var spendLine = tierLabel(status.spender_tier, status.spender_level);
    statusCard = React.createElement('div',{style:{margin:'0 18px 16px',background:'linear-gradient(135deg,#1a1040,#2d1b6e)',border:'1px solid rgba(123,110,255,.3)',borderRadius:'16px',padding:'16px 18px'}},
      React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,.6)',marginBottom:'10px',fontWeight:600,letterSpacing:'.3px'}},'Your status'),
      React.createElement('div',{style:{display:'flex',gap:'10px'}},
        React.createElement('div',{style:{flex:1,background:'rgba(255,255,255,.06)',borderRadius:'12px',padding:'12px'}},
          React.createElement('div',{style:{fontSize:'10px',color:'rgba(255,255,255,.5)',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.5px'}},'🎙 Host'),
          React.createElement('div',{style:{fontSize:'14px',fontWeight:800,color:'#fff'}}, hostLine || '—')
        ),
        React.createElement('div',{style:{flex:1,background:'rgba(255,255,255,.06)',borderRadius:'12px',padding:'12px'}},
          React.createElement('div',{style:{fontSize:'10px',color:'rgba(255,255,255,.5)',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.5px'}},'🪙 Spender'),
          React.createElement('div',{style:{fontSize:'14px',fontWeight:800,color:'#fff'}}, spendLine || '—')
        )
      )
    );
  }

  // ---- body: loading / error / empty / list ----
  var body;
  if (loading) {
    body = React.createElement('div',{style:{padding:'40px 18px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'Loading leaderboard…');
  } else if (err) {
    body = React.createElement('div',{style:{padding:'40px 18px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'Leaderboard will appear once activity starts');
  } else if (!rows || rows.length === 0) {
    body = React.createElement('div',{style:{padding:'40px 18px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'Leaderboard will appear once activity starts');
  } else {
    body = React.createElement('div',{style:{padding:'0 18px 24px'}},
      rows.map(function(row, idx){
        var rank = (typeof row.rank === 'number') ? row.rank : (idx + 1);
        var name = row.full_name || row.name || 'RingIn Member';
        var avatar = row.avatar_url || null;
        var verified = !!row.is_verified;
        var sub = tierLabel(row.tier, row.level);
        var score = (row.week_received !== null && row.week_received !== undefined) ? row.week_received : 0;
        var uid = row.id || row.user_id || null;
        var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

        return React.createElement('div',{
          key: uid || ('r'+rank+'-'+idx),
          onClick: (onViewUser && uid) ? function(){ onViewUser(uid); } : undefined,
          style:{display:'flex',alignItems:'center',gap:'12px',padding:'11px 0',borderBottom:'1px solid var(--border)',cursor:(onViewUser && uid)?'pointer':'default'}
        },
          // rank / medal
          React.createElement('div',{style:{width:'30px',textAlign:'center',fontSize:medal?'18px':'15px',fontWeight:800,color:rank<=3?'var(--text)':'var(--t3)',flexShrink:0}}, medal || ('#'+rank)),
          // avatar
          React.createElement('div',{style:{width:'42px',height:'42px',borderRadius:'50%',background: avatar ? ('url('+avatar+') center/cover') : gradientFromString(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:800,color:'#fff',flexShrink:0}},
            avatar ? null : initialOf(name)
          ),
          // name + tier
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'5px'}},
              React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
              verified && React.createElement('span',{title:'Verified',style:{color:'#3B9EFF',fontSize:'13px',flexShrink:0}},'✓')
            ),
            sub && React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'1px'}}, sub)
          ),
          // score
          React.createElement('div',{style:{fontSize:'13px',fontWeight:800,color:'var(--ac)',flexShrink:0}},'🔥 '+score)
        );
      })
    );
  }

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    header,
    statusCard,
    React.createElement('div',{style:{padding:'0 18px 6px'}},
      React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'10px'}},'Top Hosts This Week')
    ),
    body
  );
}
