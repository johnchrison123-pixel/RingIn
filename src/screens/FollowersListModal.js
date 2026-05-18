/* eslint-disable */
import React, {useState, useEffect} from 'react';
import {sb} from '../utils/supabase';

export default function FollowersListModal(props) {
  // type: 'followers' | 'following'
  var type = props.type;
  var userId = props.userId;
  var currentUserId = props.currentUserId;
  var following = props.following || {};
  var toggleFollow = props.toggleFollow;
  var onClose = props.onClose;
  var onViewUser = props.onViewUser;

  var usersS = useState([]); var users = usersS[0]; var setUsers = usersS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];

  useEffect(function(){
    if (!userId) return;
    // R17 FIX #7: reset to empty + loading at the START so switching the
    // modal from 'followers' → 'following' (or reopening on a different
    // user) doesn't briefly show the previous list while the new query
    // is in flight.
    setUsers([]); setLoading(true);
    var col = type === 'followers' ? 'following_id' : 'follower_id';
    var otherCol = type === 'followers' ? 'follower_id' : 'following_id';

    // FIX #1: add .catch on both queries so a network/RLS rejection doesn't leave a stuck spinner
    sb.from('follows').select('*').eq(col, userId).then(function(r){
      if (!r.data || r.data.length === 0) { setUsers([]); setLoading(false); return; }
      var otherIds = r.data.map(function(x){return x[otherCol];}).filter(Boolean);
      if (otherIds.length === 0) { setLoading(false); return; }

      sb.from('profiles').select('id, full_name, email, avatar_url, is_online, bio').in('id', otherIds).then(function(pr){
        var mapped = (pr.data || []).map(function(p){
          var bioJson = {};
          try { bioJson = JSON.parse(p.bio || '{}'); } catch(e){}
          return {
            id: p.id,
            name: p.full_name || (p.email ? p.email.split('@')[0] : 'User'),
            img: p.avatar_url,
            role: bioJson.tag || 'Member',
            online: p.is_online,
          };
        });
        setUsers(mapped);
        setLoading(false);
      }).catch(function(e){ setLoading(false); console.warn('[ringin] FollowersListModal query reject:', e); });
    }).catch(function(e){ setLoading(false); console.warn('[ringin] FollowersListModal query reject:', e); });
  }, [userId, type]);

  return React.createElement('div', {
    onClick: onClose,
    style: {position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'},
  },
    React.createElement('div', {
      onClick: function(e){e.stopPropagation();},
      style: {width:'100%',maxWidth:'560px',maxHeight:'80vh',background:'var(--bg2)',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'},
    },
      // Header
      React.createElement('div', {style:{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}},
        React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'18px',fontWeight:700,color:'var(--text)',textTransform:'capitalize'}}, type + (users.length > 0 ? ' (' + users.length + ')' : '')),
        React.createElement('button', {onClick:onClose, style:{background:'none',border:'none',color:'var(--t2)',fontSize:'24px',cursor:'pointer'}}, '×')
      ),

      // List
      React.createElement('div', {style:{overflowY:'auto',flex:1}},
        loading && React.createElement('div', {style:{padding:'40px',textAlign:'center',color:'var(--t2)'}}, 'Loading...'),
        !loading && users.length === 0 && React.createElement('div', {style:{padding:'40px',textAlign:'center',color:'var(--t2)'}},
          type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'
        ),
        users.map(function(u){
          return React.createElement('div', {key:u.id, style:{display:'flex',alignItems:'center',gap:'12px',padding:'14px 18px',borderBottom:'1px solid var(--border)'}},
            React.createElement('div', {onClick:function(){onViewUser && onViewUser(u); onClose();}, style:{cursor:'pointer'}},
              u.img
                ? React.createElement('img', {src:u.img, alt:'', style:{width:'42px',height:'42px',borderRadius:'50%',objectFit:'cover'}})
                : React.createElement('div', {style:{width:'42px',height:'42px',borderRadius:'50%',background:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'14px'}}, u.name.charAt(0).toUpperCase())
            ),
            React.createElement('div', {onClick:function(){onViewUser && onViewUser(u); onClose();}, style:{flex:1,minWidth:0,cursor:'pointer'}},
              React.createElement('div', {style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}}, u.name),
              React.createElement('div', {style:{fontSize:'12px',color:'var(--t2)'}}, u.role)
            ),
            currentUserId && currentUserId !== u.id && toggleFollow && React.createElement('button', {
              onClick: function(){ toggleFollow(u.id, u.name, u.img, u.role); },
              style:{padding:'6px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:600,border:following[u.id]?'1px solid var(--ac)':'none',background:following[u.id]?'var(--acg)':'var(--ac)',color:following[u.id]?'var(--ac)':'#fff',cursor:'pointer'},
            }, following[u.id] ? '✓ Following' : '+ Follow')
          );
        })
      )
    )
  );
}
