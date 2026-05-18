/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';
import {sb} from '../utils/supabase';
// FIX #10: toastError for actual failures (was misusing toastSuccess)
import {toastSuccess, toastError} from '../utils/toast';
/* R18: shared image fallback + timezone-aware date + safe localStorage */
import ImgWithFallback from '../components/ImgWithFallback';
import {formatDate, safeSetItem} from '../utils/dateFmt';

export default function SavedPostsScreen(props) {
  var onBack = props.onBack;
  var session = props.session;
  var onViewUser = props.onViewUser;
  var userId = session && session.user ? session.user.id : null;

  var postsS = useState([]); var posts = postsS[0]; var setPosts = postsS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];
  // FIX #17: ref for the 8s safety timeout so we can clear it from the
  // success path AND from unmount cleanup, instead of letting it fire late.
  var safetyTimerRef = useRef(null);

  useEffect(function(){
    if (!userId) { setLoading(false); return; }

    var done = false;
    safetyTimerRef.current = setTimeout(function(){ if(!done) setLoading(false); }, 8000);
    function clearSafety(){ if(safetyTimerRef.current){ clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; } }

    sb.from('saved_posts').select('post_id, created_at').eq('user_id', userId).order('created_at', {ascending:false}).then(function(r){
      if (r.error || !r.data || r.data.length === 0) {
        done = true; clearSafety(); setPosts([]); setLoading(false); return;
      }
      var ids = r.data.map(function(s){return s.post_id;});

      sb.from('posts').select('*').in('id', ids).then(function(pr){
        if (pr.error || !pr.data) { done = true; clearSafety(); setPosts([]); setLoading(false); return; }

        var userIds = [];
        pr.data.forEach(function(p){ if(p.user_id && userIds.indexOf(p.user_id)<0) userIds.push(p.user_id); });

        if (userIds.length === 0) {
          done = true; clearSafety();
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

          done = true; clearSafety();
          setPosts(mapped);
          setLoading(false);
        }).catch(function(){ done = true; clearSafety(); setLoading(false); });
      }).catch(function(){ done = true; clearSafety(); setLoading(false); });
    }).catch(function(){ done = true; clearSafety(); setLoading(false); });

    return function(){ clearSafety(); };
  }, [userId]);

  function unsave(postId) {
    var snapshot = posts;
    setPosts(function(prev){ return prev.filter(function(p){return p.id !== postId;}); });
    try{
      var key='saved_posts_'+userId;
      var s = JSON.parse(localStorage.getItem(key) || '[]');
      /* R18: safeSetItem won't crash in private/full storage */
      safeSetItem(key, JSON.stringify(s.filter(function(x){return x!==postId;})));
    }catch(e){}
    sb.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId).then(function(r){
      if (r.error) {
        setPosts(snapshot); // revert
        // FIX #10: was toastSuccess (green) — should be red error
        toastError('Failed to unsave');
      } else {
        toastSuccess('Removed from saved');
      }
    }).catch(function(){
      setPosts(snapshot);
      // FIX #10: was toastSuccess (green) — should be red error
      toastError('Failed to unsave');
    });
  }

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    // Header
    React.createElement('div', {style:{position:'sticky',top:0,zIndex:10,background:'var(--bg2)',padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid var(--border)'}},
      onBack && React.createElement('button', {onClick:onBack, title:'Back', style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px 4px 4px 0',display:'flex',alignItems:'center',justifyContent:'center'}},
        React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
          React.createElement('polyline',{points:'15 18 9 12 15 6'})
        )
      ),
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
        // FIX #9: clicking the post body dispatches an open-detail event.
        // HomeScreen (or any listener) can pick it up and open the detail
        // view. The dispatch alone is harmless even with no listener.
        function openDetail(e){
          // Skip if the click came from an interactive child (avatar, unsave button)
          var t = e && e.target;
          while (t && t !== e.currentTarget) {
            if (t.tagName === 'BUTTON' || (t.getAttribute && t.getAttribute('data-stop')==='1')) return;
            t = t.parentNode;
          }
          try { window.dispatchEvent(new CustomEvent('ringin:open-post-detail', { detail: { postId: p.id } })); } catch(_){}
        }
        return React.createElement('div', {key:p.id, onClick:openDetail, style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'14px',padding:'14px',marginBottom:'12px',cursor:'pointer'}},
          React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}},
            React.createElement('div', {onClick:function(e){ e.stopPropagation(); onViewUser && onViewUser({id:p.user_id, name:p.author_name, img:p.author_avatar});}, style:{cursor:'pointer',width:'36px',height:'36px',borderRadius:'50%',overflow:'hidden',flexShrink:0}, 'data-stop':'1'},
              /* R18: ImgWithFallback for author avatar */
              React.createElement(ImgWithFallback, {
                src: p.author_avatar, alt: p.author_name,
                fallback: 'avatar', fallbackInitial: (p.author_name||'?').charAt(0),
                style: {width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover'}
              })
            ),
            React.createElement('div', {style:{flex:1,minWidth:0}},
              React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, p.author_name),
              /* R18: timezone-aware date display */
              React.createElement('div', {style:{fontSize:'11px',color:'var(--t3)'}}, p.created_at ? formatDate(p.created_at) : '')
            ),
            React.createElement('button', {onClick:function(){unsave(p.id);}, style:{background:'rgba(239,71,71,0.12)',border:'1px solid var(--red)',color:'var(--red)',padding:'5px 12px',borderRadius:'8px',fontSize:'11px',fontWeight:700,cursor:'pointer'}}, '🗑 Unsave')
          ),
          React.createElement('div', {style:{fontSize:'14px',lineHeight:1.5,color:'var(--text)',whiteSpace:'pre-wrap',marginBottom:'8px'}}, p.text || ''),
          /* R18: ImgWithFallback for post thumbnail */
          images[0] && React.createElement(ImgWithFallback, {src:images[0], alt:'Post image', fallback:'image', style:{width:'100%',maxHeight:'320px',objectFit:'cover',borderRadius:'10px',marginBottom:'8px',display:'block'}}),
          React.createElement('div', {style:{display:'flex',gap:'14px',fontSize:'12px',color:'var(--t2)'}},
            React.createElement('span', null, '❤ ' + (Array.isArray(p.likes) ? p.likes.length : 0)),
            React.createElement('span', null, '💬 ' + (p.comments_count || 0))
          )
        );
      })
    )
  );
}
