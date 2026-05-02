/* eslint-disable */
import {useState, useEffect} from 'react';
import {createClient} from '@supabase/supabase-js';
var sb = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

export function useFollow(supabase, currentUserId){
  var followingS = useState({}); var following = followingS[0]; var setFollowing = followingS[1];

  useEffect(function(){
    if(!currentUserId) return;
    sb.from('follows').select('following_id,following_name').eq('follower_id',currentUserId).then(function(res){
      if(res.data){
        var map = {};
        res.data.forEach(function(f){ map[f.following_id] = true; });
        setFollowing(map);
      }
      if(res.error) console.log('load follows error:',res.error);
    });
  },[currentUserId]);

  function toggleFollow(targetId, targetName, targetAvatar, targetRole){
    if(!currentUserId){alert('Please log in to follow');return;}
    var tid = String(targetId);
    if(following[tid]){
      sb.from('follows').delete().eq('follower_id',currentUserId).eq('following_id',tid).then(function(r){
        if(r.error){console.log('unfollow error:',r.error);return;}
        setFollowing(function(prev){ var n=Object.assign({},prev); delete n[tid]; return n; });
      });
    } else {
      sb.from('follows').insert({
        follower_id: currentUserId,
        following_id: tid,
        following_name: targetName||'',
        following_avatar: targetAvatar||'',
        following_role: targetRole||''
      }).then(function(r){
        if(r.error){console.log('follow error:',r.error);return;}
        setFollowing(function(prev){ return Object.assign({},prev,{[tid]:true}); });
      });
    }
  }

  return {following, toggleFollow};
}
