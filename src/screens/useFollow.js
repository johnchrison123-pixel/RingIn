/* eslint-disable */
import {useState, useEffect, useRef} from 'react';
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

  // R19 FIX #1: in-flight guard. Without this, rapid tap-tap-tap fires N
  // parallel insert/delete writes whose .then arrive out of order — the
  // last resolver's snapshot is stale, so the rollback baseline is wrong
  // and state ends up flipped from what the user actually wanted.
  // Mirrors HomeScreen.toggleLike's likingRef (R12 FIX #5).
  var pendingRef = useRef(new Set());

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
    // R19 FIX #1: drop if a write for this target is already in flight —
    // prevents race where rapid taps produce out-of-order resolvers.
    if (pendingRef.current.has(tid)) return;
    pendingRef.current.add(tid);
    if(following[tid]){
      // Unfollow instantly
      var snapUnfollow = Object.assign({},following);
      var newMap = Object.assign({},following);
      delete newMap[tid];
      setFollowing(newMap);
      try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(newMap));}catch(e){}
      broadcast(tid, false);
      sb.from('follows').delete().eq('follower_id',currentUserId).eq('following_id',tid).then(function(r){
        pendingRef.current.delete(tid);
        if(r.error){
          console.error('RingIn Error [unfollow]:', r.error);
          // Rollback
          setFollowing(snapUnfollow);
          try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(snapUnfollow));}catch(e){}
          broadcast(tid, true); // re-broadcast revert
          // R11 FIX #12: previously silent on failure — let the user know.
          try{ toastError('Couldn\'t update follow — try again'); }catch(_){}
        }
      /* R19 FIX #1: .catch on network reject (offline) — previously the
       * optimistic state was stuck forever and no toast fired. */
      }).catch(function(e){
        pendingRef.current.delete(tid);
        console.warn('[ringin] unfollow reject:', e&&e.message?e.message:e);
        setFollowing(snapUnfollow);
        try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(snapUnfollow));}catch(_){}
        broadcast(tid, true);
        try{ toastError('Couldn\'t update follow — try again'); }catch(_){}
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
        pendingRef.current.delete(tid);
        if(r.error){
          console.error('RingIn Error [follow]:', r.error);
          // Rollback
          setFollowing(snapFollow);
          try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(snapFollow));}catch(e){}
          broadcast(tid, false); // re-broadcast revert
          // R11 FIX #12: previously silent on failure — let the user know.
          try{ toastError('Couldn\'t update follow — try again'); }catch(_){}
        }
      /* R19 FIX #1: .catch on network reject (offline) */
      }).catch(function(e){
        pendingRef.current.delete(tid);
        console.warn('[ringin] follow reject:', e&&e.message?e.message:e);
        setFollowing(snapFollow);
        try{localStorage.setItem('follows_'+currentUserId, JSON.stringify(snapFollow));}catch(_){}
        broadcast(tid, false);
        try{ toastError('Couldn\'t update follow — try again'); }catch(_){}
      });
    }
  }

  return {following, toggleFollow, loaded:true};
}
