/* eslint-disable */
import {useState, useEffect} from 'react';

export function useFollow(supabase, currentUserId){
  var followingS = useState({}); var following = followingS[0]; var setFollowing = followingS[1];

  useEffect(function(){
    if(!supabase||!currentUserId) return;
    supabase.from('follows').select('following_id').eq('follower_id',currentUserId).then(function(res){
      if(res.data){
        var map = {};
        res.data.forEach(function(f){ map[f.following_id] = true; });
        setFollowing(map);
      }
    });
  },[currentUserId]);

  function toggleFollow(targetId, targetName, targetAvatar, targetRole){
    if(!supabase||!currentUserId) return;
    if(following[targetId]){
      // Unfollow
      supabase.from('follows').delete().eq('follower_id',currentUserId).eq('following_id',targetId).then(function(){
        setFollowing(function(prev){ var n=Object.assign({},prev); delete n[targetId]; return n; });
      });
    } else {
      // Follow
      supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: targetId,
        following_name: targetName||'',
        following_avatar: targetAvatar||'',
        following_role: targetRole||''
      }).then(function(){
        setFollowing(function(prev){ return Object.assign({},prev,{[targetId]:true}); });
      });
    }
  }

  return {following, toggleFollow};
}
