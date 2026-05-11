/* eslint-disable */
import React, {useState, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastSuccess} from '../utils/toast';

export default function SavedPostsScreen(props) {
  var onBack = props.onBack;
  var session = props.session;
  var onViewUser = props.onViewUser;
  var userId = session && session.user ? session.user.id : null;

  var postsS = useState([]); var posts = postsS[0]; var setPosts = postsS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];

  useEffect(function(){
    if (!userId) { setLoading(false); return; }

    var done = false;
    var safetyTimeout = setTimeout(function(){ if(!done) setLoading(false); }, 8000);

    sb.from('saved_posts').select('post_id, created_at').eq('user_id', userId).order('created_at', {ascending:false}).then(function(r){
      if (r.error || !r.data || r.data.length === 0) {
        done = true; setPosts([]); setLoading(false); return;
      }
      var ids = r.data.map(function(s){return s.post_id;});

      sb.from('posts').select('*').in('id', ids).then(function(pr){
        if (pr.error || !pr.data) { done = true; setPosts([]); setLoading(false); return; }

        var userIds = [];
        pr.data.forEach(function(p){ if(p.user_id && userIds.indexOf(p.user_id)<0) userIds.push(p.user_id); });

        if (userIds.length === 0) {
          done = true;
          var quickMapped = pr.data.map(function(p){ return Object.assign({}, p, {author_name: 'User'}); });
          setPosts(quickMapped); setLoading(false); return;
        }

        sb.from('profiles').select('id, full_name, email, avatar_url, is_online').in('id', userIds).then(function(pf){
          var profMap = {};
          (pf.data || []).forEach(function(p){ profMap[p.id] = p; });

          var mapped = ids.map(function(id){
            var p = pr.data.find(function(x){return x.id === id;});
            if (!p) return null;
            var prof = profMap[p.user_id] || {};
            return Object.assign({}, p, {
              author_name: prof.full_name || (prof.email ? prof.email.split('@')[0] : 'User'),
              author_avatar: prof.avatar_url,
              author_online: prof.is_online,
            });
          }).filter(Boolean);

          done = true;
          setPosts(mapped);
          setLoading(false);
        }).catch(function(){ done = true; setLoading(false); });
      }).catch(function(){ done = true; setLoading(false); });
    }).catch(function(){ done = true; setLoading(false); });

    return function(){ clearTimeout(safetyTimeout); };
  }, [userId]);

  function unsave(postId) {
    var snapshot = posts;
    setPosts(function(prev){ return prev.filter(function(p){return p.id !== postId;}); });
    try{
      var key='saved_posts_'+userId;
      var s = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(s.filter(function(x){return x!==postId;})));
    }catch(e){}
    sb.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId).then(function(r){
      if (r.error) {
        setPosts(snapshot); // revert
        toastSuccess('Failed to unsave');
      } else {
        toastSuccess('Removed from saved');
      }
    }).catch(function(){
      setPosts(snapshot);
      toastSuccess('Failed to unsave');
    });
  }

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    // Header
    React.createElement('div', {style:{position:'sticky',top:0,zIndex:10,background:'var(--bg2)',padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid var(--border)'}},
      onBack && React.createElement('button', {onClick:onBack, style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'0 6px 0 0'}}, '<'),
      React.createElement('div', {style:{fontSize:'18px',fontWeight:700,color:'var(--text)',flex:1}}, '🔖 Saved Posts'),
      posts.length > 0 && React.createElement('span', {style:{padding:'3px 10px',background:'var(--acg)',color:'var(--ac)',fontSize:'11px',fontWeight:700,borderRadius:'10px'}}, posts.length)
    ),

    // Loading
    loading && React.createElement('div', {style:{padding:'40px',textAlign:'center',color:'var(--t2)'}}, 'Loading...'),

    // Empty state
    !loading && posts.length === 0 && React.createElement('div', {style:{padding:'60px 24px',textAlign:'center'}},
      React.createElement('div', {style:{fontSize:'48px',marginBottom:'16px'}}, '🔖'),
      React.createElement('div', {style:{fontFamily:'Syne, sans-serif',fontSize:'18px',fontWeight:700,marginBottom:'8px',color:'var(--text)'}}, 'No Saved Posts Yet'),
      React.createElement('div', {style:{fontSize:'13px',color:'var(--t2)',lineHeight:1.5}}, 'Tap the 3-dot menu on any post and select Save Post to bookmark it for later.')
    ),

    // Posts
    React.createElement('div', {style:{padding:'14px 16px'}},
      posts.map(function(p){
        var images = Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []);
        return React.createElement('div', {key:p.id, style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'14px',marginBottom:'12px'}},
          React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}},
            React.createElement('div', {onClick:function(){onViewUser && onViewUser({id:p.user_id, name:p.author_name, img:p.author_avatar});}, style:{cursor:'pointer'}},
              p.author_avatar
                ? React.createElement('img', {src:p.author_avatar, alt:'', style:{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover'}})
                : React.createElement('div', {style:{width:'36px',height:'36px',borderRadius:'50%',background:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'13px'}}, (p.author_name||'?').charAt(0).toUpperCase())
            ),
            React.createElement('div', {style:{flex:1,minWidth:0}},
              React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, p.author_name),
              React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)'}}, p.created_at ? new Date(p.created_at).toLocaleDateString() : '')
            ),
            React.createElement('button', {onClick:function(){unsave(p.id);}, style:{background:'rgba(239,71,71,0.12)',border:'1px solid var(--red)',color:'var(--red)',padding:'5px 12px',borderRadius:'8px',fontSize:'11px',fontWeight:700,cursor:'pointer'}}, '🗑 Unsave')
          ),
          React.createElement('div', {style:{fontSize:'14px',lineHeight:1.5,color:'var(--text)',whiteSpace:'pre-wrap',marginBottom:'8px'}}, p.text || ''),
          images[0] && React.createElement('img', {src:images[0], alt:'', style:{width:'100%',maxHeight:'320px',objectFit:'cover',borderRadius:'10px',marginBottom:'8px'}}),
          React.createElement('div', {style:{display:'flex',gap:'14px',fontSize:'12px',color:'var(--t2)'}},
            React.createElement('span', null, '❤ ' + (Array.isArray(p.likes) ? p.likes.length : 0)),
            React.createElement('span', null, '💬 ' + (p.comments_count || 0))
          )
        );
      })
    )
  );
}
