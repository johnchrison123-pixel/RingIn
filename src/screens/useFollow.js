/* eslint-disable */
import {useState, useEffect} from 'react';
import {createClient} from '@supabase/supabase-js';
var sb = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

export function useFollow(supabase, currentUserId){
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
      if(res.data){
        var map = {};
        res.data.forEach(function(f){ map[f.following_id] = true; });
        setFollowing(map);
        setLoaded(true);
        localStorage.setItem('follows_'+currentUserId, JSON.stringify(map));
      }
    });
  },[currentUserId]);

  function toggleFollow(targetId, targetName, targetAvatar, targetRole){
    if(!currentUserId){alert('Please log in to follow');return;}
    var tid = String(targetId);
    if(following[tid]){
      // Unfollow instantly
      var newMap = Object.assign({},following);
      delete newMap[tid];
      setFollowing(newMap);
      localStorage.setItem('follows_'+currentUserId, JSON.stringify(newMap));
      sb.from('follows').delete().eq('follower_id',currentUserId).eq('following_id',tid).then(function(r){
        if(r.error) console.log('unfollow error:',r.error);
      });
    } else {
      // Follow instantly
      var newMap2 = Object.assign({},following,{[tid]:true});
      setFollowing(newMap2);
      localStorage.setItem('follows_'+currentUserId, JSON.stringify(newMap2));
      sb.from('follows').insert({
        follower_id: currentUserId,
        following_id: tid,
        following_name: targetName||'',
        following_avatar: targetAvatar||'',
        following_role: targetRole||''
      }).then(function(r){
        if(r.error) console.log('follow error:',r.error);
      });
    }
  }

  return {following, toggleFollow, loaded:true};
}
