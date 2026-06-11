/* eslint-disable */
import {useState, useEffect} from 'react';
import {sb as _sb} from '../utils/supabase';
// R11 FIX #12: replace alert() with toast + give user feedback when
// follow/unfollow rolls back (previously silent + console.error only).
import {toastError, toastWarn} from '../utils/toast';

var FOLLOWS_EVENT = 'ringin-follows-changed';

export function useFollow(supabase, currentUserId){
  var sb = supabase || _sb;
  // Load from localStorage instantly - no flash
  var initial = {};
  try{
    var cached = localStorage.getItem('follows_'+currentUserId);
    if(cached) initial = JSON.parse(cached);
  }catch(e){}

  var followingS = useState(initial);
  var following = followingS[0];
  var setFollowing = followingS[1];
  var loadedS = useState(Object.keys(initial).length > 0);
  var loaded = loadedS[0];
  var setLoaded = loadedS[1];

  useEffect(function(){
    if(!currentUserId) return;
    // Sync with Supabase in background
    sb.from('follows').select('following_id').eq('follower_id',currentUserId).then(function(res){
      if(res.error){ console.error('RingIn Error [loadFollows]:', res.error); return; }
      if(res.data){
        var map = {};
        res.data.forEach(function(f){ map[f.following_id] = true; });
        setFollowing(map);
        setLoaded(true);
        try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(map));}catch(e){}
      }
    });

    // Listen to cross-instance follow events (sync between multiple useFollow consumers)
    function handler(e){
      if(!e.detail || e.detail.userId !== currentUserId) return;
      setFollowing(function(prev){
        var next = Object.assign({}, prev);
        if(e.detail.isFollowing) next[e.detail.targetId] = true;
        else delete next[e.detail.targetId];
        try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(next));}catch(err){}
        return next;
      });
    }
    if(typeof window !== 'undefined') window.addEventListener(FOLLOWS_EVENT, handler);
    return function(){
      if(typeof window !== 'undefined') window.removeEventListener(FOLLOWS_EVENT, handler);
    };
  },[currentUserId]);

  function broadcast(targetId, isFollowing){
    if(typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(FOLLOWS_EVENT, {
      detail: {userId: currentUserId, targetId: targetId, isFollowing: isFollowing},
    }));
  }

  function toggleFollow(targetId, targetName, targetAvatar, targetRole){
    // R11 FIX #12: replace blocking alert() with non-blocking toast.
    if(!currentUserId){ try{ toastWarn('Please log in to follow'); }catch(_){} return; }
    var tid = String(targetId);
    if(following[tid]){
      // Unfollow instantly
      var snapUnfollow = Object.assign({},following);
      var newMap = Object.assign({},following);
      delete newMap[tid];
      setFollowing(newMap);
      try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(newMap));}catch(e){}
      broadcast(tid, false);
      sb.from('follows').delete().eq('follower_id',currentUserId).eq('following_id',tid).then(function(r){
        if(r.error){
          console.error('RingIn Error [unfollow]:', r.error);
          // Rollback
          setFollowing(snapUnfollow);
          try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(snapUnfollow));}catch(e){}
          broadcast(tid, true); // re-broadcast revert
          // R11 FIX #12: previously silent on failure — let the user know.
          try{ toastError('Couldn\'t update follow — try again'); }catch(_){}
        }
      });
    } else {
      // Follow instantly
      var snapFollow = Object.assign({},following);
      var newMap2 = Object.assign({},following,{[tid]:true});
      setFollowing(newMap2);
      try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(newMap2));}catch(e){}
      broadcast(tid, true);
      sb.from('follows').insert({
        follower_id: currentUserId,
        following_id: tid,
        following_name: targetName||'',
        following_avatar: targetAvatar||'',
        following_role: targetRole||''
      }).then(function(r){
        if(r.error){
          console.error('RingIn Error [follow]:', r.error);
          // Rollback
          setFollowing(snapFollow);
          try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(snapFollow));}catch(e){}
          broadcast(tid, false); // re-broadcast revert
          // R11 FIX #12: previously silent on failure — let the user know.
          try{ toastError('Couldn\'t update follow — try again'); }catch(_){}
        }
      });
    }
  }

  return {following, toggleFollow, loaded:true};
}
