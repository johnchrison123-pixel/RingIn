import React,{useState,useEffect,useRef} from 'react';
import {useFollow} from './useFollow';
import {sb as sbHome} from '../utils/supabase';
import {usePostsRealtime} from '../utils/usePostsRealtime';
import '../styles/HomeScreen.css';
import CallScreen from './CallScreen';
import LiveWorkshopScreen from './LiveWorkshopScreen';
import {playSound,playUnlikeSound,hapticPulse} from '../utils/soundEngine';
import TopBarAvatar from '../components/TopBarAvatar';
import Moments from '../components/Moments';
import MomentComposer from '../components/MomentComposer';
import AvatarRing from '../components/AvatarRing';
import {useMomentUserIds, markMomentUser, refreshMomentUserIds} from '../utils/momentUsers';
import ReportModal, {flushQueuedReports} from '../components/ReportModal';
import compressImage from '../utils/compressImage';
import {useHideLikes} from '../utils/likeDisplayPref';
import {toastSuccess,toastError,toastWarn} from '../utils/toast';
// Final polish: dropped unused getRecommendedExperts from the destructure.
import {detectContent,autoTagPost} from '../utils/mlService';
import {useCoinBalance} from '../utils/coinBalance';
import {safeInitials} from '../utils/initials'; /* FIX #10: UTF-16 safe initials */
import {isBlockedSync, onBlocksChanged} from '../utils/blocks'; /* R15 FIX #1: filter blocked users from feed; R19 verifier-fix: subscribe to re-render on block-change */
import {acquireBodyScrollLock} from '../utils/bodyScrollLock'; /* R20 FIX #2: ref-counted lock prevents 2-modal overflow leak */
import {formatDateTime, formatDate, formatTime, safeSetItem} from '../utils/dateFmt'; /* R18: timezone-aware date display + safe localStorage wrapper */

function playKeyClick(){playSound('typing');}
function playEmojiClick(){playSound('emoji');}
function playPostSound(){playSound('send');}

// Copy a URL to the clipboard and toast ONLY on real success. Pre-fix,
// every Copy Link / Share fallback fired `alert('Link copied!')` even when
// the clipboard API silently failed (no permission, http://, iframe).
// Now: success → toast, failure → "Couldn't copy" error so users know to
// long-press the URL.
function copyToClipboardWithToast(url, successMsg){
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function(){
        toastSuccess(successMsg || '🔗 Link copied!');
      }).catch(function(){
        // Try the legacy execCommand fallback before reporting failure
        if (legacyCopy(url)) toastSuccess(successMsg || '🔗 Link copied!');
        else toastError('Couldn\'t copy — long-press the link to copy');
      });
      return;
    }
    if (legacyCopy(url)) toastSuccess(successMsg || '🔗 Link copied!');
    else toastError('Couldn\'t copy — long-press the link to copy');
  } catch(e) {
    if (legacyCopy(url)) toastSuccess(successMsg || '🔗 Link copied!');
    else toastError('Couldn\'t copy — long-press the link to copy');
  }
  function legacyCopy(t){
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch(_) { return false; }
  }
}
function playLikeSound(liked){
  if(liked){ playSound('like'); hapticPulse([18, 12, 30]); }
  else { playUnlikeSound(); hapticPulse([20]); }
}

var CATS=[{id:'all',icon:'All',label:'All'},{id:'medical',icon:'Med',label:'Medical'},{id:'tech',icon:'Tech',label:'Tech'},{id:'legal',icon:'Law',label:'Legal'},{id:'trades',icon:'Fix',label:'Trades'},{id:'mental',icon:'Mind',label:'Mental'}];
// FIX #7: EXPERTS is intentionally hardcoded mock data. The "experts"
// table does not exist in Supabase yet; migrating to a real table requires
// schema design (rate columns, ratings, FK to profiles, RLS policies) which
// is a separate task. Mock IDs are deliberately small INTEGERS (1..6) so
// they never collide with real Supabase UUIDs anywhere in the app. Any
// follow / chat / moments code path that references one of these mock IDs
// must keep them namespaced (see SearchScreen.js "mock_" prefix, and
// 'expert_<id>' convention for chat conversation IDs).
var EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,category:'medical',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine.',tags:['General Medicine','Preventive Care'],img:'https://i.pravatar.cc/150?img=47'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,category:'tech',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google alumni.',tags:['System Design','React'],img:'https://i.pravatar.cc/150?img=12'},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,category:'mental',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience.',tags:['Career Strategy','LinkedIn'],img:'https://i.pravatar.cc/150?img=23'},{id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,calls:389,followers:'1.8k',online:true,category:'legal',color:'linear-gradient(135deg,#B8860B,#FFD700)',cover:'linear-gradient(135deg,#2e2200,#B8860B)',loc:'Dubai, UAE',bio:'Senior lawyer with 12 years in UAE corporate law.',tags:['Corporate Law','Contracts'],img:'https://i.pravatar.cc/150?img=33'},{id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,calls:521,followers:'2.7k',online:true,category:'mental',color:'linear-gradient(135deg,#9B59B6,#D98EF0)',cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)',loc:'Abu Dhabi',bio:'Clinical psychologist specializing in anxiety and stress.',tags:['Anxiety','CBT','Stress'],img:'https://i.pravatar.cc/150?img=44'},{id:6,initials:'JT',name:'James Tanner',role:'Fitness & Nutrition Coach',rate:50,rating:4.7,calls:298,followers:'4.1k',online:true,category:'mental',color:'linear-gradient(135deg,#E8401A,#FF6B35)',cover:'linear-gradient(135deg,#2e0a00,#E8401A)',loc:'Remote',bio:'Certified personal trainer and nutritionist.',tags:['Weight Loss','Nutrition','Fitness'],img:'https://i.pravatar.cc/150?img=15'}];
var WORKSHOPS=[{id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},{id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'}];

// Build threaded tree from flat comments array using parent_comment_id
function buildCommentTree(comments){
  var map={};
  comments.forEach(function(c){map[c.id]=Object.assign({},c,{replies:[]});});
  var roots=[];
  comments.forEach(function(c){
    if(c.parent_comment_id&&map[c.parent_comment_id]){
      map[c.parent_comment_id].replies.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  return roots;
}

// Recursive threaded comment renderer
// opts: {likes, setLikes, onReply, collapsed, setCollapsed, timeAgo}
function renderCommentThread(nodes,depth,opts){
  if(!nodes||!nodes.length) return null;
  return nodes.map(function(c){
    var cLiked=(opts.likes[c.id]||0)>0;
    var hasReplies=c.replies&&c.replies.length>0;
    var isCollapsed=!!opts.collapsed[c.id];
    var indent=Math.min(depth,2)*44;
    var avSize=depth===0?32:26;
    return React.createElement(React.Fragment,{key:c.id},
      React.createElement('div',{style:{display:'flex',gap:'8px',marginBottom:'6px',marginLeft:indent+'px',position:'relative'}},
        depth>0?React.createElement('div',{style:{position:'absolute',left:'-22px',top:'4px',bottom:0,width:'2px',background:'rgba(255,255,255,0.08)',borderRadius:'1px'}}):null,
        React.createElement('div',{style:{width:avSize+'px',height:avSize+'px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:depth===0?'11px':'9px',fontWeight:700,color:'#fff',marginTop:'2px'}},
          c.user_avatar?React.createElement('img',{src:c.user_avatar,style:{width:'100%',height:'100%',objectFit:'cover'}}):safeInitials(c.user_name) /* FIX #10 */
        ),
        React.createElement('div',{style:{flex:1,minWidth:0}},
          React.createElement('div',{style:{background:depth===0?'var(--bg3)':'rgba(255,255,255,0.06)',borderRadius:'14px',padding:'8px 12px',marginBottom:'4px'}},
            React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:'6px',marginBottom:'2px',flexWrap:'wrap'}},
              React.createElement('span',{style:{fontSize:'12px',fontWeight:700,color:'var(--text)'}},(c.user_name||'User')),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.created_at?opts.timeAgo(c.created_at):'')
            ),
            React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.45,wordBreak:'break-word'}},c.text)
          ),
          React.createElement('div',{style:{display:'flex',gap:'16px',paddingLeft:'4px',alignItems:'center',marginBottom:'6px'}},
            React.createElement('button',{
              onClick:function(){var next=(opts.likes[c.id]||0)===0;playLikeSound(next);opts.setLikes(function(prev){var m=Object.assign({},prev);m[c.id]=next?1:0;return m;});},
              style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:cLiked?'#E84D9A':'var(--t3)',display:'flex',alignItems:'center',gap:'3px',padding:'2px 0',fontFamily:'DM Sans,sans-serif',fontWeight:cLiked?600:400}
            },React.createElement('span',{style:{fontSize:'13px'}},cLiked?'❤️':'🤍'),cLiked?'Liked':'Like'),
            React.createElement('button',{
              onClick:function(){opts.onReply(c);},
              style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:'var(--t3)',padding:'2px 0',fontFamily:'DM Sans,sans-serif'}
            },'Reply'),
            hasReplies?React.createElement('button',{
              onClick:function(){opts.setCollapsed(function(prev){var m=Object.assign({},prev);m[c.id]=!m[c.id];return m;});},
              style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:'var(--ac)',padding:'2px 0',fontFamily:'DM Sans,sans-serif'}
            },isCollapsed?'▶ '+c.replies.length+' repl'+(c.replies.length===1?'y':'ies'):'▼ Hide replies'):null
          )
        )
      ),
      hasReplies&&!isCollapsed?renderCommentThread(c.replies,depth+1,opts):null
    );
  });
}

// FIX #6/#7: shared <img> wrapper with onError fallback. Renders props.fallback
// (typically the initials bubble) when the source 404s / decode fails OR is
// empty. Accepts every native <img> prop (style, alt, loading, etc.) — they
// pass through verbatim. Defined as a proper component so we can use useState
// inside (a plain helper can't hold per-instance state).
function ImgWithFallback(props){
  var failedS = useState(false); var failed = failedS[0]; var setFailed = failedS[1];
  if (failed || !props.src) return props.fallback || null;
  // Strip "fallback" from the props passed to <img> — it's not a valid DOM attr.
  var rest = {};
  for (var k in props) { if (k !== 'fallback' && k !== 'onError') rest[k] = props[k]; }
  rest.onError = function(e){ setFailed(true); if (props.onError) props.onError(e); };
  return React.createElement('img', rest);
}

// Feed post image — 4:5 ratio (Instagram standard), objectFit:cover centers subject, crops dark edges
// FIX #9: add loading:'lazy' so feed images below the fold don't all decode
// eagerly on first paint (huge first-load win for users with long feeds).
function PostImage(props){
  var src=props.src; var onClick=props.onClick;
  return React.createElement('div',{
    style:{width:'100%',aspectRatio:'4/5',overflow:'hidden',background:'#111',cursor:onClick?'pointer':'default'},
    onClick:onClick
  },
    React.createElement(ImgWithFallback,{
      src:src,
      loading:'lazy',
      fallback: React.createElement('div',{style:{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--t3)',fontSize:'12px'}},'Image unavailable'),
      style:{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',display:'block'},
    })
  );
}

function timeAgoUtil(dateStr){
  if(!dateStr) return '';
  // Final polish: no manual 'Z' appending — see MessagesScreen.timeAgo for
  // the same fix. Browser handles ISO with or without TZ marker correctly.
  var now=new Date();
  var date=new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  var diff=Math.floor((now-date)/1000);
  // R11 FIX #2: clock skew (server ahead of client) → show 'Just now' instead of '-Nm ago'.
  if (diff < 0) return 'Just now';
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<172800) return 'Yesterday';
  return formatDate(date); /* R18: timezone-aware (was raw toLocaleDateString) */
}

export function UserProfileView(props){
  var user=props.user; var sbHome=props.sbHome;
  var currentUserId=props.currentUserId;
  var session=props.session;
  var _cachedUPosts=[];try{var _cup=localStorage.getItem('user_posts_'+user.id);if(_cup)_cachedUPosts=JSON.parse(_cup);}catch(e){}
  var _cachedUInfo={};try{var _cui=localStorage.getItem('profile_info_'+user.id);if(_cui)_cachedUInfo=JSON.parse(_cui);}catch(e){}

  function mapUPost(p){
    var likesArr=Array.isArray(p.likes)?p.likes:[];
    return {
      id:p.id, userId:p.user_id, text:p.text||'', tags:p.tags||[],
      likes:likesArr.length, liked:currentUserId?likesArr.includes(currentUserId):false,
      likedByIds:likesArr, comments:p.comments_count||0,
      img:p.images&&p.images[0]?p.images[0]:null,
      createdAt:p.created_at,
      isRaw:false
    };
  }

  var postsS=useState(_cachedUPosts.map(function(p){return p.isRaw===false?p:mapUPost(p);}));
  var userPosts=postsS[0]; var setUserPosts=postsS[1];
  var profileInfoS=useState(_cachedUInfo.name?_cachedUInfo:{name:(user.full_name||(user.email||'').split('@')[0]),tag:'',about:'',website_name:'',website_url:''}); var profileInfo=profileInfoS[0]; var setProfileInfo=profileInfoS[1];
  var coverS=useState(user.cover_url||localStorage.getItem('cover_'+user.id)||null); var coverUrl=coverS[0]; var setCoverUrl=coverS[1];
  var showLikersUS=useState(null); var showLikersU=showLikersUS[0]; var setShowLikersU=showLikersUS[1];
  var likersNamesUS=useState({}); var likersNamesU=likersNamesUS[0]; var setLikersNamesU=likersNamesUS[1];
  var showAvatarBigUS=useState(false); var showAvatarBigU=showAvatarBigUS[0]; var setShowAvatarBigU=showAvatarBigUS[1];
  // Shared moments registry — drives the Instagram-style avatar ring on
  // the profile cover avatar and on each post header.
  var momentUserIds=useMomentUserIds();
  // Per-user "hide like counts" preference.
  var hideLikesPair=useHideLikes(); var hideLikes=hideLikesPair[0];
  // Report modal state — replaces the previously fake alert("Thank you...").
  var reportTargetUS=useState(null); var reportTargetU=reportTargetUS[0]; var setReportTargetU=reportTargetUS[1];

  // R12 FIX #5: per-post in-flight guard for toggleLikeU — prevents the
  // double-toggle race where a fast tap fires two RPC calls and the second
  // (still-pending) `.then` reverts using a stale snapshot.
  var likingURef = useRef({});

  // Comments state
  var openCommentsUS=useState(null); var openCommentsU=openCommentsUS[0]; var setOpenCommentsU=openCommentsUS[1];
  var commentsCacheUS=useState({}); var commentsCacheU=commentsCacheUS[0]; var setCommentsCacheU=commentsCacheUS[1];
  var commentInputUS=useState(''); var commentInputU=commentInputUS[0]; var setCommentInputU=commentInputUS[1];
  var commentLoadingUS=useState(false); var commentLoadingU=commentLoadingUS[0]; var setCommentLoadingU=commentLoadingUS[1];
  var commentLikesUS=useState(function(){try{var s=localStorage.getItem('ringin_clikes');return s?JSON.parse(s):{}}catch(e){return {};}}); var commentLikesU=commentLikesUS[0]; var _setCommentLikesU=commentLikesUS[1];
  function setCommentLikesU(updater){_setCommentLikesU(function(prev){var next=typeof updater==='function'?updater(prev):updater;try{localStorage.setItem('ringin_clikes',JSON.stringify(next));}catch(e){}return next;});}

  // Post menu state
  var postMenuUS=useState(null); var postMenuU=postMenuUS[0]; var setPostMenuU=postMenuUS[1];
  // Local edit-post state (separate from HomeScreen's — UserProfileView is
  // a sibling component, can't reach HomeScreen's modal state). Same shape.
  var editPostUDataS=useState(null); var editPostUData=editPostUDataS[0]; var setEditPostUData=editPostUDataS[1];
  function saveEditPostU(){
    if(!editPostUData||!editPostUData.content||!editPostUData.content.trim()) return;
    var newText = editPostUData.content;
    var pid = editPostUData.id;
    var snap = userPosts.slice();
    setUserPosts(function(prev){return prev.map(function(x){return x.id===pid?Object.assign({},x,{text:newText}):x;});});
    setEditPostUData(null);
    sbHome.from('posts').update({text:newText}).eq('id',pid).then(function(r){
      if(r.error){
        console.error('RingIn Error [saveEditPostU]:', r.error && r.error.message ? r.error.message : 'Unknown error');
        setUserPosts(snap);
        try{ toastError('Failed to edit. Try again.'); }catch(e){}
        return;
      }
      try{ toastSuccess('✏️ Post updated'); }catch(e){}
    });
  }

  function loadCommentsU(postId){
    var cached=null;
    try{var c=localStorage.getItem('comments_'+postId);if(c)cached=JSON.parse(c);}catch(e){}
    if(cached) setCommentsCacheU(function(prev){return Object.assign({},prev,{[postId]:cached});});
    sbHome.from('comments').select('*').eq('post_id',postId).order('created_at',{ascending:true}).then(function(res){
      if(res.data){
        setCommentsCacheU(function(prev){return Object.assign({},prev,{[postId]:res.data});});
        try{localStorage.setItem('comments_'+postId,JSON.stringify(res.data));}catch(e){}
      }
    });
  }

  function submitCommentU(postId,text){
    if(!text.trim()||!currentUserId) return;
    var userName=session&&session.user?((session.user.email||'user').split('@')[0]||'user'):'User';
    var userAvatar=currentUserId?localStorage.getItem('avatar_'+currentUserId):null;
    var newComment={
      id:Date.now()+'_local',
      post_id:postId,
      user_id:currentUserId,
      user_name:userName,
      user_avatar:userAvatar,
      text:text.trim(),
      created_at:new Date().toISOString(),
      likes:[]
    };
    var snapCommentsU=null;
    setCommentsCacheU(function(prev){
      snapCommentsU=prev[postId]||[];
      var cur=snapCommentsU.concat([newComment]);
      try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
      return Object.assign({},prev,{[postId]:cur});
    });
    setCommentInputU('');
    setUserPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:(p.comments||0)+1}):p;});});
    sbHome.from('comments').insert({
      post_id:postId,
      user_id:currentUserId,
      user_name:userName,
      user_avatar:userAvatar||null,
      text:text.trim()
    }).select().then(function(res){
      if(res.error){
        console.error('RingIn Error [submitCommentU]:', res.error);
        setCommentsCacheU(function(prev){
          try{localStorage.setItem('comments_'+postId,JSON.stringify(snapCommentsU));}catch(e){}
          return Object.assign({},prev,{[postId]:snapCommentsU});
        });
        setUserPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:Math.max(0,(p.comments||1)-1)}):p;});});
        return;
      }
      if(res.data&&res.data[0]){
        setCommentsCacheU(function(prev){
          var cur=(prev[postId]||[]).map(function(c){return c.id===newComment.id?res.data[0]:c;});
          try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
          return Object.assign({},prev,{[postId]:cur});
        });
        // Persist count to DB
        sbHome.from('comments').select('id',{count:'exact',head:true}).eq('post_id',postId).then(function(r){
          if(r.count!==null) sbHome.from('posts').update({comments_count:r.count}).eq('id',postId).then(function(){
            // Notify post owner after comment count update succeeds
            var snapU=userPosts.find(function(p){return p.id===postId;});
            if(snapU&&snapU.userId&&snapU.userId!==currentUserId){
              sbHome.from('notifications').insert({
                user_id:snapU.userId,
                from_user_id:currentUserId,
                from_user_name:userName,
                from_user_avatar:userAvatar||'',
                type:'comment',
                post_id:snapU.id,
                message:userName+' commented on your post',
                read:false
              }).then(function(){});
            }
          });
        });
      }
    });
  }

  function toggleLikeU(pid){
    if(!currentUserId) return;
    // R12 FIX #5: in-flight guard — second tap during pending RPC is ignored
    if (likingURef.current[pid]) return;
    likingURef.current[pid] = true;
    // Capture snapshot before optimistic update for correct revert
    var snapU = userPosts.find(function(p){return p.id===pid;});
    if(!snapU){ likingURef.current[pid] = false; return; }
    var newLikedU = !snapU.liked;
    playLikeSound(newLikedU);
    var newIdsU = newLikedU ? [currentUserId].concat(snapU.likedByIds||[]) : (snapU.likedByIds||[]).filter(function(id){return id!==currentUserId;});
    setUserPosts(function(prev){
      return prev.map(function(p){
        if(p.id!==pid) return p;
        return Object.assign({},p,{liked:newLikedU,likes:newLikedU?snapU.likes+1:Math.max(0,snapU.likes-1),likedByIds:newIdsU});
      });
    });
    sbHome.rpc('toggle_like',{post_id:pid,user_id:currentUserId}).then(function(r){
      if(r.error){
        // Revert to exact pre-toggle snapshot
        setUserPosts(function(prev){return prev.map(function(p){
          if(p.id!==pid) return p;
          return Object.assign({},p,{liked:snapU.liked,likes:snapU.likes,likedByIds:snapU.likedByIds});
        });});
      }
      likingURef.current[pid] = false;
    }).catch(function(e){
      // R11 FIX #5: previously no .catch — rejected promise left optimistic
      // state in place and triggered an unhandled rejection.
      console.warn('[ringin] toggleLikeU reject:', e);
      setUserPosts(function(prev){return prev.map(function(p){
        if(p.id!==pid) return p;
        return Object.assign({},p,{liked:snapU.liked,likes:snapU.likes,likedByIds:snapU.likedByIds});
      });});
      likingURef.current[pid] = false;
    });
  }

  useEffect(function(){
    if(!user||!user.id) return;
    sbHome.from('profiles').select('*').eq('id',user.id).single().then(function(res){
      if(res.data){
        var d=res.data;
        var name=d.full_name||(d.email||'').split('@')[0];
        var bio=d.bio||'';
        var parsed={name:name,tag:'',about:'',website_name:'',website_url:''};
        try{var j=JSON.parse(bio);if(j&&typeof j==='object'){parsed.about=j.about||'';parsed.tag=j.tag||'';parsed.website_name=j.website_name||j.website||'';parsed.website_url=j.website_url||'';}}catch(e){parsed.about=bio;}
        setProfileInfo(parsed);
        try{localStorage.setItem('profile_info_'+user.id,JSON.stringify(parsed));}catch(e){}
        if(d.cover_url) setCoverUrl(d.cover_url);
        else { var savedCover=localStorage.getItem('cover_'+user.id); if(savedCover) setCoverUrl(savedCover); }
      }
    });
    sbHome.from('posts').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20).then(function(res){
      if(res.data){
        var mapped=res.data.map(mapUPost);
        setUserPosts(mapped);
        prefetchLikersU(mapped,{});
        try{localStorage.setItem('user_posts_'+user.id,JSON.stringify(mapped));}catch(e){}
        // Defer the N-post comment-cache parse to idle time. Synchronously parsing 20+
        // localStorage blobs blocks the UI thread for 100-500ms on Samsung Internet,
        // causing the feed-tab freeze the user reported.
        var runIdle = (typeof window !== 'undefined' && window.requestIdleCallback)
          ? function(fn){ window.requestIdleCallback(fn, { timeout: 1500 }); }
          : function(fn){ setTimeout(fn, 0); };
        runIdle(function(){
          var cmap={};
          for(var i=0;i<mapped.length;i++){
            try{ var c = localStorage.getItem('comments_'+mapped[i].id); if(c) cmap[mapped[i].id] = JSON.parse(c); }catch(e){}
          }
          if(Object.keys(cmap).length) setCommentsCacheU(cmap);
        });
      }
    });
  },[user.id]);

  // R18 FIX B: ESC closes the UserProfileView-local edit-post modal +
  // the inline comments expander. editPostUData is fullscreen-overlay style
  // (position:fixed top:0...) so it also locks body scroll while open.
  // openCommentsU is an inline panel under the post card (no backdrop), so
  // it gets ESC only. Lives in UserProfileView's scope because both states
  // are declared here — they're not visible from HomeScreen's scope.
  useEffect(function(){
    function onKey(ev){
      if (ev.key !== 'Escape') return;
      if (editPostUData) { setEditPostUData(null); return; }
      if (openCommentsU) { setOpenCommentsU(null); return; }
    }
    if (editPostUData || openCommentsU) {
      window.addEventListener('keydown', onKey);
    }
    /* R20 FIX #2: ref-counted body-scroll-lock; releases atomically on cleanup */
    var releaseLock = null;
    if (editPostUData) {
      releaseLock = acquireBodyScrollLock();
    }
    return function(){
      window.removeEventListener('keydown', onKey);
      if (releaseLock) releaseLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPostUData, openCommentsU]);

  // Realtime: sync likes + comment counts on user profile posts (shared hook)
  usePostsRealtime(sbHome,'userprofile-posts-'+user.id,currentUserId,setUserPosts,setCommentsCacheU);

  function prefetchLikersU(postsArr,existing){
    var allIds=[];
    postsArr.forEach(function(p){(p.likedByIds||[]).forEach(function(id){if(typeof id==='string'&&id.length>10&&!existing[id]&&allIds.indexOf(id)<0)allIds.push(id);});});
    if(!allIds.length) return;
    sbHome.from('profiles').select('id,full_name,email,avatar_url').in('id',allIds).then(function(res){
      if(res.data&&res.data.length){
        var map={};
        res.data.forEach(function(u){map[u.id]={name:u.full_name||(u.email||'').split('@')[0],avatar:u.avatar_url};});
        setLikersNamesU(function(prev){return Object.assign({},prev,map);});
      }
    });
  }

  var displayName = profileInfo.name || (user.full_name||(user.email||'?').split('@')[0]);
  var avatarUrl = user.avatar_url || localStorage.getItem('avatar_'+user.id) || null;
  var initials = safeInitials(displayName); /* FIX #10 */

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto',position:'relative'}},
    // Report modal — replaces previously fake alert("Thank you for reporting...").
    React.createElement(ReportModal,{target:reportTargetU,onClose:function(){setReportTargetU(null);},session:session}),
    // Likes popup modal
    showLikersU ? React.createElement('div',{
      onClick:function(){setShowLikersU(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'rgba(22,16,44,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'20px',width:'100%',maxWidth:'360px',maxHeight:'70vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}},
        React.createElement('div',{style:{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}},
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'#fff'}},(function(){
            var p=userPosts.find(function(x){return x.id===showLikersU;});
            if(!p) return 'Liked by';
            var ids=(p.likedByIds||[]).filter(function(l){return typeof l==='string'&&l.length>10;});
            var names=ids.map(function(id){return likersNamesU[id]?likersNamesU[id].name:null;}).filter(Boolean);
            var cnt=ids.length;
            if(cnt===0) return 'Liked by';
            if(cnt===1) return (names[0]||'Someone')+' liked this';
            if(cnt===2) return (names[0]||'Someone')+' and '+(names[1]||'someone')+' liked';
            return (names[0]||'Someone')+' and '+(cnt-1)+' others liked';
          })()),
          React.createElement('button',{onClick:function(){setShowLikersU(null);},style:{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}},'×')
        ),
        React.createElement('div',{style:{overflowY:'auto',padding:'8px 0'}},(function(){
          var p=userPosts.find(function(x){return x.id===showLikersU;});
          if(!p) return null;
          var ids=(p.likedByIds||[]).filter(function(l){return typeof l==='string'&&l.length>10;});
          if(!ids.length) return React.createElement('div',{style:{padding:'24px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}},'No likes yet');
          return ids.map(function(uid){
            var info=likersNamesU[uid]||{};
            var nm=info.name||'...'; var av=info.avatar||null;
            var canNav=uid!==currentUserId;
            return React.createElement('div',{key:uid,style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
              React.createElement('div',{
                onClick:function(){if(canNav&&props.onViewUser){setShowLikersU(null);props.onViewUser({id:uid,full_name:nm,avatar_url:av,email:''});}},
                style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',cursor:canNav?'pointer':'default'}
              },
                av?React.createElement('img',{src:av,alt:nm,style:{width:'100%',height:'100%',objectFit:'cover'}}):safeInitials(nm) /* FIX #10 */
              ),
              React.createElement('div',{
                onClick:function(){if(canNav&&props.onViewUser){setShowLikersU(null);props.onViewUser({id:uid,full_name:nm,avatar_url:av,email:''});}},
                style:{flex:1,minWidth:0,cursor:canNav?'pointer':'default'}
              },
                React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},nm),
                React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.4)'}},'RingIn Member')
              ),
              canNav?React.createElement('button',{
                onClick:function(){props.toggleFollow(uid,nm,av,'RingIn Member');},
                style:{padding:'6px 14px',background:props.following[uid]?'transparent':'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:props.following[uid]?'1px solid rgba(123,110,255,0.5)':'none',borderRadius:'20px',color:props.following[uid]?'#7B6EFF':'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0}
              },props.following[uid]?'Following':'+Follow'):null
            );
          });
        })())
      )
    ) : null,
    // Post 3-dot menu for UserProfileView
    postMenuU ? React.createElement('div',{
      onClick:function(){setPostMenuU(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9500,background:'rgba(0,0,0,0.2)'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(28,24,40,0.45)',backdropFilter:'blur(48px)',WebkitBackdropFilter:'blur(48px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'20px',width:'280px',boxShadow:'0 8px 40px rgba(0,0,0,0.35)',overflow:'hidden'}},
        (function(){
          var p=userPosts.find(function(x){return x.id===postMenuU;});
          if(!p) return null;
          var isOwn=p.userId===currentUserId;
          // UserProfileView scope: setEditPostData/setShowEditPost/mutedPosts/
          // toggleMutePost are all declared inside HomeScreen, NOT here. So we
          // mirror them locally — read mutedPosts straight from localStorage,
          // open an edit modal via local state below, and toggle via a small
          // helper. Without these mirrors, tapping the menu items crashed
          // with ReferenceError (same regression class as the mutedConvos bug).
          var _mutedListU = (function(){ try{ var s = localStorage.getItem('ringin_muted_posts'); return s ? JSON.parse(s) : []; }catch(e){ return []; } })();
          function _toggleMutePostU(pid){
            try {
              var cur = (function(){ try{ var s = localStorage.getItem('ringin_muted_posts'); return s ? JSON.parse(s) : []; }catch(e){ return []; } })();
              var next = cur.indexOf(pid) >= 0 ? cur.filter(function(x){ return x !== pid; }) : cur.concat([pid]);
              localStorage.setItem('ringin_muted_posts', JSON.stringify(next));
              /* R19 FIX #5: broadcast so other screens re-read */
              try { window.dispatchEvent(new CustomEvent('ringin-muted-posts-changed', { detail: { pid: pid, muted: next.indexOf(pid) >= 0 } })); } catch(_){}
              try { toastSuccess(next.indexOf(pid) >= 0 ? '🔕 Notifications off' : '🔔 Notifications on'); } catch(_){}
            } catch(_){}
          }
          var items=isOwn?[
            {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenuU(null);if(window.confirm('Delete this post?')){var snapU2=userPosts.slice();setUserPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});sbHome.from('posts').delete().eq('id',p.id).then(function(r){if(r.error){console.error('RingIn Error [deletePostU]:', r.error);setUserPosts(snapU2);toastError('Failed to delete post.');/* FIX #7 */}});}}},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;copyToClipboardWithToast(url,'🔗 Link copied!');setPostMenuU(null);}},
            {icon:'✏️',label:'Edit Post',fn:function(){setEditPostUData({id:p.id,content:p.text||p.content||''});setPostMenuU(null);}},
            {icon:'🔕',label:_mutedListU.indexOf(p.id)>=0?'Turn on notifications':'Turn off notifications',fn:function(){_toggleMutePostU(p.id);setPostMenuU(null);}}
          ]:[
            {icon:'🔖',label:'Save Post',fn:function(){
              setPostMenuU(null);
              if(!currentUserId){toastError('Please log in');return;}
              sbHome.from('saved_posts').upsert({user_id:currentUserId,post_id:p.id},{onConflict:'user_id,post_id'}).then(function(r){
                if(r.error){toastError('Failed to save');return;}
                try{var s=JSON.parse(localStorage.getItem('saved_posts_'+currentUserId)||'[]');if(s.indexOf(p.id)<0){s.push(p.id);localStorage.setItem('saved_posts_'+currentUserId,JSON.stringify(s));}}catch(e){}
                toastSuccess('🔖 Saved to your bookmarks');
              }).catch(function(){toastError('Failed to save');});
            }},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;copyToClipboardWithToast(url,'🔗 Link copied!');setPostMenuU(null);}},/* R12 FIX #2: use helper so toast only fires on actual copy success */
            {icon:'➕',label:(props.following&&props.following[p.userId]?'✓ Unfollow ':'Follow ')+displayName,fn:function(){props.toggleFollow(p.userId,displayName,avatarUrl,'RingIn Member');setPostMenuU(null);}},
            {icon:'😶',label:'Not interested',fn:function(){setUserPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});setPostMenuU(null);}},
            {icon:'🚩',label:'Report',red:true,fn:function(){setReportTargetU({type:'post',id:p.id,label:'this post'});setPostMenuU(null);}}
          ];
          return items.map(function(item,i){
            return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.07)':'none',cursor:'pointer'}},
              React.createElement('span',{style:{fontSize:'14px',fontWeight:500,color:item.red?'#ff453a':'rgba(255,255,255,0.9)'}},item.label)
            );
          });
        })()
      )
    ) : null,
    // Avatar full-screen viewer
    showAvatarBigU&&avatarUrl ? React.createElement('div',{
      onClick:function(){setShowAvatarBigU(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:99999,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center'}
    },
      React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'84vw',height:'84vw',maxWidth:'380px',maxHeight:'380px',borderRadius:'50%',objectFit:'cover',boxShadow:'0 0 60px rgba(123,110,255,0.4)'}})
    ) : null,
    // Cover
    React.createElement('div',{style:{height:'130px',background:coverUrl?'none':'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)',position:'relative',flexShrink:0,overflow:'visible'}},
      coverUrl?React.createElement('div',{style:{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden'}},React.createElement('img',{src:coverUrl,alt:'cover',style:{width:'100%',height:'100%',objectFit:'cover'}})):null,
      React.createElement('button',{onClick:props.onBack,title:'Back',style:{position:'absolute',top:'12px',left:'12px',background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:'34px',height:'34px',color:'#fff',padding:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3}},
        React.createElement('svg',{viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
          React.createElement('polyline',{points:'15 18 9 12 15 6'})
        )
      ),
      // Big profile-cover avatar — wrapped in AvatarRing so an active
      // moment poster gets the gradient halo on their cover too.
      // The wrapper itself becomes the absolute-positioned element so
      // the ring lives at the same coordinates as the original avatar.
      React.createElement('div',{
        style:{position:'absolute',bottom:'-40px',left:'18px',zIndex:4}
      },
        React.createElement(AvatarRing,{ show: momentUserIds.has(user.id), thickness: 3 },
          React.createElement('div',{
            onClick:function(){if(avatarUrl)setShowAvatarBigU(true);},
            style:{width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',overflow:'hidden',cursor:avatarUrl?'pointer':'default'}},
            avatarUrl?React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}):initials
          )
        )
      )
    ),
    // Name + info
    React.createElement('div',{style:{padding:'50px 18px 12px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
      React.createElement('div',{style:{flex:1,minWidth:0,paddingRight:'10px'}},
        React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},displayName),
        profileInfo.tag?React.createElement('div',{style:{fontSize:'12px',color:'#7B6EFF',fontWeight:600,marginBottom:'4px'}},profileInfo.tag):null,
        profileInfo.about?React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',lineHeight:1.5,marginBottom:'4px',whiteSpace:'pre-wrap'}},profileInfo.about):null,
        (profileInfo.website_name||profileInfo.website_url)?React.createElement('a',{href:profileInfo.website_url||(profileInfo.website_name&&profileInfo.website_name.startsWith('http')?profileInfo.website_name:'https://'+profileInfo.website_name),target:'_blank',rel:'noreferrer',style:{fontSize:'12px',color:'#7B6EFF',display:'flex',alignItems:'center',gap:'4px',marginBottom:'4px',textDecoration:'none'}},'🔗 '+(profileInfo.website_name||profileInfo.website_url)):null,
        user.is_online?React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'4px',fontSize:'11px',color:'#27C96A'}},React.createElement('div',{style:{width:'6px',height:'6px',borderRadius:'50%',background:'#27C96A'}}),'Online'):null
      ),
      React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}},
        React.createElement('button',{
          onClick:function(){props.toggleFollow(String(user.id),displayName,avatarUrl,'RingIn Member');},
          style:{padding:'8px 16px',background:props.following[String(user.id)]?'transparent':'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:props.following[String(user.id)]?'1px solid rgba(123,110,255,0.5)':'none',borderRadius:'20px',color:props.following[String(user.id)]?'#7B6EFF':'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}
        },props.following[String(user.id)]?'✓ Following':'+ Follow'),
        React.createElement('button',{
          onClick:function(){
            if(!props.currentUserId){return;}
            var convId=[props.currentUserId,user.id].sort().join('_');
            // CRITICAL: include otherId/receiverId (the user's UUID) so the chat header's
            // Call button can find a valid callee_id. Without these fields the Call button
            // falls back to convo.id (= conversation_id like "uuid_uuid") which fails UUID
            // validation in App.js startOutgoingCall.
            var convo={id:convId,convId:convId,otherId:user.id,receiverId:user.id,user_id:user.id,name:displayName,role:'RingIn Member',color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:avatarUrl,initials:initials};
            if(props.onGoToMessages) props.onGoToMessages(convo);
          },
          style:{padding:'8px 16px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--text)',fontSize:'13px',fontWeight:600,cursor:'pointer'}
        },'Message')
      )
    ),
    // Moments — this user's heart-shaped Stories. Currently UI-only; the
    // viewing user can't add to someone else's moments, so showAdd is false.
    React.createElement('div',{style:{padding:'2px 16px 0',borderTop:'1px solid var(--border)',marginTop:'8px'}},
      React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',paddingTop:'10px'}},'Moments')
    ),
    React.createElement(Moments, {
      compact: true,
      showAdd: false,
      moments: [],
    }),
    // Posts heading
    React.createElement('div',{style:{padding:'4px 18px 10px',borderTop:'1px solid var(--border)',marginTop:'4px'}},
      React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',paddingTop:'12px'}},userPosts.length+' Post'+(userPosts.length!==1?'s':''))
    ),
    // Posts list
    userPosts.length===0?React.createElement('div',{style:{textAlign:'center',padding:'40px',color:'var(--t2)'}},
      React.createElement('div',{style:{fontSize:'30px',marginBottom:'8px'}},'📝'),
      React.createElement('div',{style:{fontSize:'13px'}},'No posts yet')
    ):React.createElement('div',{style:{padding:'0 18px 80px'}},
      userPosts.map(function(p){
        var pAvatar=avatarUrl;
        var pTime=p.createdAt?timeAgoUtil(p.createdAt):'';
        var commentsArr=commentsCacheU[p.id]||[];
        return React.createElement('div',{key:p.id,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',marginBottom:'12px',overflow:'hidden'}},
          // Post header
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'11px 12px 8px',position:'relative'}},
            React.createElement(AvatarRing,{ show: momentUserIds.has(user.id) },
              React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
                /* FIX #6: ImgWithFallback for post header avatar */
                React.createElement(ImgWithFallback,{src:pAvatar,alt:displayName,fallback:initials,style:{width:'100%',height:'100%',objectFit:'cover'}})
              )
            ),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},displayName),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},pTime)
            ),
            React.createElement('button',{
              onClick:function(e){e.stopPropagation();setPostMenuU(postMenuU===p.id?null:p.id);},
              style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',position:'absolute',right:'4px',top:'6px'}
            },'⋯')
          ),
          // Post text
          React.createElement('div',{style:{padding:'0 12px 8px',fontSize:'13px',color:'var(--text)',lineHeight:1.6}},p.text),
          // Tags
          (p.tags||[]).length>0?React.createElement('div',{style:{padding:'0 12px 8px',display:'flex',flexWrap:'wrap',gap:'4px'}},
            (p.tags||[]).map(function(t){return React.createElement('span',{key:t,style:{fontSize:'11px',color:'#7B6EFF'}},('#'+t));})
          ):null,
          // Post image — full natural size, no crop
          p.img?React.createElement('div',{style:{width:'100%',background:'#000'}},
            React.createElement('img',{src:p.img,style:{width:'100%',height:'auto',display:'block',maxWidth:'100%'}})
          ):null,
          // Actions
          React.createElement('div',{style:{display:'flex',borderTop:'1px solid var(--border)'}},
            React.createElement('div',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}},
              React.createElement('button',{
                onClick:function(){toggleLikeU(p.id);},
                style:{display:'flex',alignItems:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:p.liked?'#E84D9A':'var(--t2)',fontWeight:p.liked?700:400}
              },
                React.createElement('svg',{viewBox:'0 0 24 24',width:'18',height:'18'},
                  p.liked?React.createElement('defs',null,React.createElement('linearGradient',{id:'ulg'+p.id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},React.createElement('stop',{offset:'0%',stopColor:'#5B4FD4'}),React.createElement('stop',{offset:'100%',stopColor:'#C4347A'}))):null,
                  React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:p.liked?'url(#ulg'+p.id+')':'none',stroke:p.liked?'none':'var(--t2)',strokeWidth:'2'})
                ),
                React.createElement('span',{onClick:function(e){e.stopPropagation();if((p.likedByIds||[]).length>0){setShowLikersU(p.id);}},style:{cursor:(p.likedByIds||[]).length>0?'pointer':'default'}},
                  // Hide-likes toggle: when ON, show "Liked" label only (count hidden).
                  hideLikes ? ((Array.isArray(p.likedByIds)?p.likedByIds.length:p.likes) > 0 ? 'Liked' : '0 Likes')
                            : ((Array.isArray(p.likedByIds)?p.likedByIds.length:p.likes)+' Like')
                )
              )
            ),
            React.createElement('button',{
              onClick:function(){
                var newOpen=openCommentsU===p.id?null:p.id;
                setOpenCommentsU(newOpen);
                if(newOpen) loadCommentsU(newOpen);
              },
              style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
            },'💬 '+(commentsCacheU[p.id]?commentsCacheU[p.id].length:p.comments||0)),
            React.createElement('button',{
              onClick:function(){
                var url='https://ring-in.vercel.app/post/'+p.id;
                if(navigator.share){navigator.share({title:'Check this out on RingIn',text:(p.text||'').substring(0,100),url:url}).catch(function(){});} // ROUND 8 FIX #5: guard null p.text
                else{copyToClipboardWithToast(url,'🔗 Link copied to clipboard');}
              },
              style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
            },'↗ Share')
          ),
          // Comment section
          openCommentsU===p.id?React.createElement('div',{style:{borderTop:'1px solid var(--border)',background:'var(--bg4)'}},
            React.createElement('div',{style:{maxHeight:'360px',overflowY:'auto',padding:'8px 12px'}},
              commentsArr.length===0?React.createElement('div',{style:{textAlign:'center',padding:'12px',color:'var(--t3)',fontSize:'12px'}},'No comments yet. Be the first!'):
              commentsArr.map(function(c){
                var cLiked=(commentLikesU[c.id]||0)>0;
                return React.createElement('div',{key:c.id,style:{display:'flex',gap:'8px',marginBottom:'12px'}},
                  React.createElement(AvatarRing,{ show: momentUserIds.has(c.user_id), thickness: 1.5 },
                    React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                      c.user_avatar?React.createElement('img',{src:c.user_avatar,alt:c.user_name,style:{width:'100%',height:'100%',objectFit:'cover'}}):safeInitials(c.user_name) /* FIX #10 */
                    )
                  ),
                  React.createElement('div',{style:{flex:1}},
                    React.createElement('div',{style:{background:'var(--bg4)',borderRadius:'12px',padding:'7px 10px',marginBottom:'4px'}},
                      React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:'6px',marginBottom:'2px'}},
                        React.createElement('span',{style:{fontSize:'12px',fontWeight:700,color:'var(--text)'}},(c.user_name||'User')),
                        React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.created_at?timeAgoUtil(c.created_at):'')
                      ),
                      React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.4}},c.text)
                    ),
                    React.createElement('div',{style:{display:'flex',gap:'14px',paddingLeft:'4px'}},
                      React.createElement('button',{onClick:function(){setCommentLikesU(function(prev){var m=Object.assign({},prev);m[c.id]=(m[c.id]||0)===0?1:0;return m;});},style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:cLiked?'#E84D9A':'var(--t3)',display:'flex',alignItems:'center',gap:'3px',padding:'0',fontFamily:'DM Sans,sans-serif'}},
                        React.createElement('span',{style:{fontSize:'13px'}},cLiked?'❤️':'🤍'), cLiked?'Liked':'Like'
                      ),
                      React.createElement('button',{onClick:function(){setCommentInputU('@'+(c.user_name||'User')+' ');},style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:'var(--t3)',padding:'0',fontFamily:'DM Sans,sans-serif'}},'Reply')
                    )
                  )
                );
              })
            ),
            React.createElement('div',{style:{display:'flex',gap:'8px',padding:'8px 12px',borderTop:'1px solid var(--border)'}},
              React.createElement(AvatarRing,{ show: momentUserIds.has(currentUserId), thickness: 1.5 },
                React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                  currentUserId&&localStorage.getItem('avatar_'+currentUserId)?React.createElement('img',{src:localStorage.getItem('avatar_'+currentUserId),style:{width:'100%',height:'100%',objectFit:'cover'}}):(session&&session.user&&session.user.email?safeInitials(session.user.email):'?') /* FIX #10 */
                )
              ),
              React.createElement('input',{
                value:commentInputU,
                onChange:function(e){playKeyClick();setCommentInputU(e.target.value);},
                onKeyDown:function(e){if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && commentInputU.trim()){submitCommentU(p.id,commentInputU);}}, /* FIX #2: IME composition guard */
                placeholder:'Write a comment...',
                style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
              }),
              React.createElement('button',{
                onClick:function(){if(commentInputU.trim()){playPostSound();submitCommentU(p.id,commentInputU);}},
                style:{padding:'6px 14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
              },'Send')
            )
          ):null
        );
      })
    ),
    // Edit Post modal — UserProfileView's own (separate from HomeScreen's).
    editPostUData ? React.createElement('div',{
      onClick:function(){setEditPostUData(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:10000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'16px',width:'320px',padding:'20px',boxShadow:'0 8px 40px rgba(0,0,0,0.4)'}},
        React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)',marginBottom:'14px'}},'Edit Post'),
        React.createElement('textarea',{
          value:editPostUData.content,
          onChange:function(ev){setEditPostUData(function(prev){return Object.assign({},prev,{content:ev.target.value});});},
          style:{width:'100%',minHeight:'100px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',fontSize:'14px',color:'var(--text)',resize:'vertical',outline:'none',fontFamily:'DM Sans,sans-serif',boxSizing:'border-box'}
        }),
        React.createElement('div',{style:{display:'flex',gap:'10px',marginTop:'14px',justifyContent:'flex-end'}},
          React.createElement('button',{onClick:function(){setEditPostUData(null);},style:{padding:'8px 18px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'13px',cursor:'pointer',fontWeight:500}},'Cancel'),
          React.createElement('button',{onClick:saveEditPostU,style:{padding:'8px 18px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'13px',cursor:'pointer',fontWeight:600}},'Save')
        )
      )
    ) : null
  );
}

export default function HomeScreen(props){
  var acState = useState('all');
  // Load cached feed but drop it if names look stale ("User"/empty) — those entries
  // were written before the name fix and would persist forever otherwise.
  var _cachedPosts=[];
  try{
    var _c=localStorage.getItem('feed_posts_cache');
    if(_c){
      var _parsed = JSON.parse(_c);
      var _stale = _parsed.filter(function(p){return !p.name||p.name==='User'||p.name==='';}).length;
      if(_stale > 0 && _stale >= _parsed.length/2){
        try{localStorage.removeItem('feed_posts_cache');}catch(e){}
        _cachedPosts = [];
      } else {
        _cachedPosts = _parsed;
      }
    }
  }catch(e){}
  var postsS=useState(_cachedPosts.length>0?_cachedPosts:[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',time:'2m ago',text:'Fever above 38.5C for more than 3 days needs medical attention. Stay hydrated and consult a doctor.',tags:['Health','Medical'],likes:47,comments:12,rate:120,expertId:1,img:'https://i.pravatar.cc/150?img=47',postImg:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',time:'15m ago',text:'The best code is code you do not write. Simplicity is the ultimate sophistication in engineering.',tags:['Tech','Engineering'],likes:93,comments:28,rate:80,expertId:2,img:'https://i.pravatar.cc/150?img=12',postImg:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80'}]);
  var posts=postsS[0]; var setPosts=postsS[1];

  // Comments state
  var openCommentsS=useState(null); var openComments=openCommentsS[0]; var setOpenComments=openCommentsS[1];
  var commentsCacheS=useState({}); var commentsCache=commentsCacheS[0]; var setCommentsCache=commentsCacheS[1];
  var commentInputS=useState(''); var commentInput=commentInputS[0]; var setCommentInput=commentInputS[1];
  var commentLoadingS=useState(false); var commentLoading=commentLoadingS[0]; var setCommentLoading=commentLoadingS[1];

  // Post menu state
  var postMenuS=useState(null); var postMenu=postMenuS[0]; var setPostMenu=postMenuS[1];
  var showEditPostS=useState(false); var showEditPost=showEditPostS[0]; var setShowEditPost=showEditPostS[1];
  var editPostDataS=useState(null); var editPostData=editPostDataS[0]; var setEditPostData=editPostDataS[1];
  /* R19 verifier-fix: bump on every blocks-changed so isBlockedSync filters
   * (lines 1747, 3016) re-evaluate without waiting for any other state change.
   * onBlocksChanged is fired by blocks.js after any block mutation, including
   * the 3 legacy direct-write sites that now dispatch the window event. */
  var blocksTickS = useState(0); var blocksTick = blocksTickS[0]; var setBlocksTick = blocksTickS[1];
  useEffect(function(){
    try { return onBlocksChanged(function(){ setBlocksTick(function(n){ return n + 1; }); }); } catch(_){ return; }
  }, []);

  var mutedPostsS=useState(function(){try{var s=localStorage.getItem('ringin_muted_posts');return s?JSON.parse(s):[];}catch(e){return [];}});
  var mutedPosts=mutedPostsS[0]; var setMutedPosts=mutedPostsS[1];
  /* R19 FIX #5: re-sync mutedPosts when toggled from ProfileScreen or
   * UserProfileView (same window event pattern as ringin-muted-convos-changed). */
  useEffect(function(){
    function onMutedChanged(){
      try {
        var s = localStorage.getItem('ringin_muted_posts');
        setMutedPosts(s ? JSON.parse(s) : []);
      } catch(_){}
    }
    function onStorage(e){ if (e && e.key === 'ringin_muted_posts') onMutedChanged(); }
    try { window.addEventListener('ringin-muted-posts-changed', onMutedChanged); } catch(_){}
    try { window.addEventListener('storage', onStorage); } catch(_){}
    return function(){
      try { window.removeEventListener('ringin-muted-posts-changed', onMutedChanged); } catch(_){}
      try { window.removeEventListener('storage', onStorage); } catch(_){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var currentUserId = props.session&&props.session.user ? props.session.user.id : null;
  var currentUserName = props.session&&props.session.user ? ((props.session.user.email||'').split('@')[0] || null) : null;
  var currentUserAvatar = currentUserId ? localStorage.getItem('avatar_'+currentUserId) : null;

  // R12 FIX #5: per-post in-flight guard for toggleLike — prevents the
  // double-toggle race where a fast tap fires two RPC calls and the second
  // (still-pending) `.then` reverts using a stale snapshot.
  var likingRef = useRef({});

  // ── Moments: file picker + composer state ──────────────────────────────
  // Real user-posted moments fetched from Supabase (`moments` table) and
  // cached in localStorage so the poster sees their own immediately even
  // if the network is slow / table is missing.
  var momentFileRef = useRef(null);
  var pendingMomentFileS = useState(null);
  var pendingMomentFile = pendingMomentFileS[0]; var setPendingMomentFile = pendingMomentFileS[1];
  var realMomentsS = useState([]);
  var realMoments = realMomentsS[0]; var setRealMoments = realMomentsS[1];

  // Report modal state — used by feed posts, photo viewer, and any
  // user/comment/message reports. setReportTarget({type,id,label}).
  var reportTargetS = useState(null);
  var reportTarget = reportTargetS[0]; var setReportTarget = reportTargetS[1];

  // Drain any queued reports from previous sessions where the `reports`
  // table didn't exist yet — best-effort, runs once on mount.
  useEffect(function(){
    flushQueuedReports().then(function(n){
      if (n > 0) try{ console.log('[ringin] flushed ' + n + ' queued reports to Supabase'); }catch(_){}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared Set<user_id> of users who have an active moment in the last 24h.
  // Drives the Instagram-style ring around their avatar EVERYWHERE — feed,
  // comments, like popup, online experts strip. Same hook is called in
  // ProfileScreen, MessagesScreen, etc. so they all share one fetch.
  var momentUserIds = useMomentUserIds();

  function groupMomentsByUser(rows, profMap){
    profMap = profMap || {};
    var grouped = {};
    var order = [];
    rows.forEach(function(r){
      var uid = r.user_id;
      if(!grouped[uid]){
        var p = profMap[uid] || {};
        var name = (p.full_name && p.full_name.trim())
          || (p.email && p.email.indexOf('@')>=0 ? p.email.split('@')[0] : null)
          || (uid === currentUserId ? 'You' : 'User');
        var avatar = p.avatar_url || null;
        if(!avatar){
          try{ avatar = localStorage.getItem('avatar_'+uid) || null; }catch(_){}
        }
        grouped[uid] = {
          id: 'user-'+uid,
          userId: uid,
          userName: uid === currentUserId ? 'You' : name,
          userAvatar: avatar,
          color: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
          slides: [],
          hasNew: true,
          isSelf: uid === currentUserId,
          // T2.7 — set true if ANY slide in this user's set is close-friends-only
          closeFriendsOnly: false,
        };
        order.push(uid);
      }
      grouped[uid].slides.push({
        id: r.id,
        imageUrl: r.image_url,
        caption: r.caption || '',
        createdAt: r.created_at,
        closeFriendsOnly: !!r.close_friends_only,
      });
      if (r.close_friends_only) grouped[uid].closeFriendsOnly = true;
    });
    // Sort: self first, then by latest slide timestamp desc
    var arr = order.map(function(u){ return grouped[u]; });
    arr.sort(function(a,b){
      if(a.isSelf && !b.isSelf) return -1;
      if(!a.isSelf && b.isSelf) return 1;
      var aT = a.slides.length ? new Date(a.slides[0].createdAt).getTime() : 0;
      var bT = b.slides.length ? new Date(b.slides[0].createdAt).getTime() : 0;
      return bT - aT;
    });
    // Slides inside each user are oldest → newest so they play in order
    arr.forEach(function(u){
      u.slides.sort(function(x,y){ return new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(); });
    });
    return arr;
  }

  function loadOwnLocalMoments(){
    if(!currentUserId) return [];
    try{
      var raw = localStorage.getItem('ringin_my_moments_'+currentUserId);
      if(!raw) return [];
      var list = JSON.parse(raw) || [];
      var cutoff = Date.now() - 24*60*60*1000;
      return list.filter(function(r){ return new Date(r.created_at).getTime() > cutoff; });
    }catch(_){ return []; }
  }

  function loadRealMoments(){
    if(!currentUserId) return;
    var cutoffIso = new Date(Date.now() - 24*60*60*1000).toISOString();
    sbHome.from('moments').select('*').gt('created_at', cutoffIso).order('created_at',{ascending:false}).then(function(r){
      var rows;
      if(r.error){
        // Likely the migration hasn't run yet. Fall back to localStorage so
        // the poster still sees their own moments.
        rows = loadOwnLocalMoments();
      } else {
        rows = r.data || [];
        // Merge any localStorage-cached own moments not yet reflected (offline insert, etc)
        var ownLocal = loadOwnLocalMoments();
        ownLocal.forEach(function(or){
          if(!rows.find(function(rr){ return rr.id === or.id; })) rows.push(or);
        });
      }
      if(rows.length === 0){ setRealMoments([]); return; }
      var uids = []; var seen = {};
      rows.forEach(function(rr){ if(!seen[rr.user_id]){ seen[rr.user_id] = true; uids.push(rr.user_id); } });
      sbHome.from('profiles').select('id,full_name,avatar_url,email').in('id', uids).then(function(pr){
        var profMap = {};
        (pr.data || []).forEach(function(p){ profMap[p.id] = p; });
        setRealMoments(groupMomentsByUser(rows, profMap));
      });
    });
  }

  useEffect(function(){ loadRealMoments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentUserId]);

  function pickMomentFile(){
    if(momentFileRef.current) momentFileRef.current.click();
  }

  function onMomentFileChosen(e){
    var f = e.target && e.target.files && e.target.files[0];
    // Reset value so the user can pick the same file twice in a row
    try{ e.target.value = ''; }catch(_){}
    if(!f) return;
    // R12 FIX #1: MIME + size guards. Pre-fix, picking a 50MB DSLR JPG or a
    // video file would either OOM the canvas decode on Android or silently
    // upload to chat-images and fail at insert. Validate BEFORE compress.
    var allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/heic','image/heif'];
    if (f.type && allowed.indexOf(f.type) < 0) {
      try { toastWarn('Only images supported for moments (JPG, PNG, GIF, WebP)'); } catch(_){}
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      try { toastWarn('Image must be under 10MB'); } catch(_){}
      return;
    }
    setPendingMomentFile(f);
  }

  function postMoment(file, caption, opts){
    if(!file || !currentUserId) return Promise.reject(new Error('Not signed in'));
    var closeFriendsOnly = !!(opts && opts.closeFriendsOnly);
    // Client-side compression first — typically 70-90% size cut on raw
    // phone camera images. compressImage returns the original file if
    // it's already small or browser can't decode (e.g. HEIC on Chrome).
    return compressImage(file, { maxEdge: 1600, quality: 0.82 }).then(function(compressed){
      var ef = compressed || file;
      var safeExt = ((ef.name||'').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      var fileName = 'moments/' + currentUserId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2,7) + '.' + safeExt;
      return uploadMomentInner(ef, fileName, caption, closeFriendsOnly);
    });
  }

  function uploadMomentInner(file, fileName, caption, closeFriendsOnly){
    return sbHome.storage.from('chat-images').upload(fileName, file, {contentType: file.type || 'image/jpeg'}).then(function(up){
      if(up.error) throw up.error;
      var url = sbHome.storage.from('chat-images').getPublicUrl(fileName).data.publicUrl;
      var nowIso = new Date().toISOString();
      var pending = {
        // Temporary id until Supabase returns one — keeps the row valid in
        // localStorage even if the table isn't there yet.
        id: 'local-'+Date.now()+'-'+Math.random().toString(36).slice(2,5),
        user_id: currentUserId,
        image_url: url,
        caption: (caption||'').trim() || null,
        created_at: nowIso,
      };
      // T2.7 — include close_friends_only when migration 0009 is applied.
      // If the column doesn't exist yet, retry without it (graceful fallback).
      var insertRow = {user_id:currentUserId, image_url:url, caption: pending.caption};
      if (closeFriendsOnly) insertRow.close_friends_only = true;
      return sbHome.from('moments').insert([insertRow]).select().single().then(function(ins){
        if (ins.error && /close_friends_only/.test(ins.error.message || '')) {
          var fb = Object.assign({}, insertRow); delete fb.close_friends_only;
          return sbHome.from('moments').insert([fb]).select().single();
        }
        return ins;
      }).then(function(ins){
        if(ins.data) pending = ins.data;
        // Cache locally so it's still there if the table read fails.
        try{
          var key = 'ringin_my_moments_'+currentUserId;
          var raw = localStorage.getItem(key);
          var list = raw ? JSON.parse(raw) : [];
          list.unshift(pending);
          var cutoff = Date.now() - 24*60*60*1000;
          list = list.filter(function(r){ return new Date(r.created_at).getTime() > cutoff; });
          safeSetItem(key, JSON.stringify(list)); /* R18: safeSetItem (was bare setItem) */
        }catch(_){}
        // Close the composer + refresh strip
        setPendingMomentFile(null);
        loadRealMoments();
        // Optimistic ring update — flag the current user as "has moment"
        // immediately so their avatar shows the gradient halo everywhere
        // without waiting for the next moments-table refetch (which races
        // with replication and would leave a 1–2s window with no ring).
        markMomentUser(currentUserId);
        return pending;
      }).catch(function(err){
        // Insert failed (table missing or RLS) — still cache locally so the
        // user sees their moment, then surface a non-fatal hint via console.
        try{
          var key = 'ringin_my_moments_'+currentUserId;
          var raw = localStorage.getItem(key);
          var list = raw ? JSON.parse(raw) : [];
          list.unshift(pending);
          safeSetItem(key, JSON.stringify(list)); /* R18: safeSetItem (was bare setItem) */
        }catch(_){}
        console.warn('[ringin] moments insert failed, using local cache:', err && err.message ? err.message : err);
        setPendingMomentFile(null);
        loadRealMoments();
        // Optimistic ring update even on insert failure — the local-cached
        // moment is still rendered in the strip, so the user's avatar
        // should match.
        markMomentUser(currentUserId);
        return pending;
      });
    });
  }

  function loadComments(postId){
    var cached=null;
    try{var c=localStorage.getItem('comments_'+postId);if(c)cached=JSON.parse(c);}catch(e){}
    if(cached) setCommentsCache(function(prev){return Object.assign({},prev,{[postId]:cached});});
    sbHome.from('comments').select('*').eq('post_id',postId).order('created_at',{ascending:true}).then(function(res){
      if(res.data){
        setCommentsCache(function(prev){return Object.assign({},prev,{[postId]:res.data});});
        try{localStorage.setItem('comments_'+postId,JSON.stringify(res.data));}catch(e){}
      }
    });
  }

  function submitComment(postId,text){
    if(!text.trim()||!currentUserId) return;
    var parentId=replyingTo?replyingTo.id:null;
    var newComment={
      id:Date.now()+'_local',
      post_id:postId,
      user_id:currentUserId,
      user_name:currentUserName,
      user_avatar:currentUserAvatar,
      text:text.trim(),
      parent_comment_id:parentId||null,
      created_at:new Date().toISOString(),
      likes:[]
    };
    var snapComments=null;
    setCommentsCache(function(prev){
      snapComments=prev[postId]||[];
      var cur=snapComments.concat([newComment]);
      try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
      return Object.assign({},prev,{[postId]:cur});
    });
    setCommentInput('');
    setReplyingTo(null);
    setPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:(p.comments||0)+1}):p;});});
    sbHome.from('comments').insert({
      post_id:postId,
      user_id:currentUserId,
      user_name:currentUserName,
      user_avatar:currentUserAvatar||null,
      text:text.trim(),
      parent_comment_id:parentId||null
    }).select().then(function(res){
      if(res.error){
        console.error('RingIn Error [submitComment]:', res.error);
        // Rollback optimistic comment
        setCommentsCache(function(prev){
          try{localStorage.setItem('comments_'+postId,JSON.stringify(snapComments));}catch(e){}
          return Object.assign({},prev,{[postId]:snapComments});
        });
        setPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:Math.max(0,(p.comments||1)-1)}):p;});});
        return;
      }
      if(res.data&&res.data[0]){
        setCommentsCache(function(prev){
          var cur=(prev[postId]||[]).map(function(c){return c.id===newComment.id?res.data[0]:c;});
          try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
          return Object.assign({},prev,{[postId]:cur});
        });
        // Persist count to DB
        sbHome.from('comments').select('id',{count:'exact',head:true}).eq('post_id',postId).then(function(r){
          if(r.count!==null) sbHome.from('posts').update({comments_count:r.count}).eq('id',postId).then(function(){
            // Notify post owner after comment count update succeeds
            var snap=posts.find(function(p){return p.id===postId;});
            if(snap&&snap.userId&&snap.userId!==currentUserId){
              sbHome.from('notifications').insert({
                user_id:snap.userId,
                from_user_id:currentUserId,
                from_user_name:currentUserName,
                from_user_avatar:currentUserAvatar||'',
                type:'comment',
                post_id:snap.id,
                message:currentUserName+' commented on your post',
                read:false
              }).then(function(){});
            }
          });
        });
      }
    }).catch(function(e){
      // R11 FIX #6: previously no .catch — a rejected insert (offline /
      // network drop) left the optimistic local-id comment in the cache
      // and the post comment count bumped. Symmetric rollback with the
      // .then's res.error branch above.
      console.warn('[ringin] submitComment reject:', e);
      setCommentsCache(function(prev){
        try{localStorage.setItem('comments_'+postId,JSON.stringify(snapComments));}catch(_){}
        return Object.assign({},prev,{[postId]:snapComments});
      });
      setPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:Math.max(0,(p.comments||1)-1)}):p;});});
    });
  }

  function toggleLike(pid){
    var session = props.session;
    var userId = session&&session.user ? session.user.id : null;
    var userName = session&&session.user ? ((session.user.email||'someone').split("@")[0]||'someone') : "Someone";
    var userAvatar = userId ? localStorage.getItem("avatar_"+userId) : null;
    if(!userId) return;
    if(typeof pid !== "string") return;
    // R12 FIX #5: in-flight guard — second tap during pending RPC is ignored
    if (likingRef.current[pid]) return;
    likingRef.current[pid] = true;
    // Capture snapshot BEFORE optimistic update — used for correct revert + notification
    var snap = posts.find(function(p){return p.id===pid;});
    if(!snap){ likingRef.current[pid] = false; return; }
    var newLiked = !snap.liked;
    playLikeSound(newLiked);
    var newLikes = newLiked ? snap.likes+1 : Math.max(0,snap.likes-1);
    var newLikedBy = newLiked ? [userName].concat(snap.likedBy||[]) : (snap.likedBy||[]).filter(function(n){return n!==userName;});
    var newLikedByIds = newLiked ? [userId].concat(snap.likedByIds||[]) : (snap.likedByIds||[]).filter(function(id){return id!==userId;});
    setPosts(function(prev){
      return prev.map(function(p){
        if(p.id!==pid) return p;
        return Object.assign({},p,{liked:newLiked,likes:newLikes,likedBy:newLikedBy,likedByIds:newLikedByIds});
      });
    });
    sbHome.rpc("toggle_like",{post_id:pid,user_id:userId}).then(function(r){
      if(r.error){
        console.error('RingIn Error [toggleLike]:', r.error);
        // Revert to exact pre-toggle snapshot — not a re-toggle, a true restore
        setPosts(function(prev){return prev.map(function(p){
          if(p.id!==pid) return p;
          return Object.assign({},p,{liked:snap.liked,likes:snap.likes,likedBy:snap.likedBy,likedByIds:snap.likedByIds});
        });});
        likingRef.current[pid] = false;
        return;
      }
      // Notify post owner only when this was a like action (snap.liked was false)
      if(!snap.liked&&snap.userId&&snap.userId!==userId){
        sbHome.from("notifications").insert([{user_id:snap.userId,from_user_id:userId,from_user_name:userName,from_user_avatar:userAvatar||'',type:"like",message:userName+" liked your post",post_id:pid,read:false}]).then(function(){});
      }
      likingRef.current[pid] = false;
    }).catch(function(e){
      // R11 FIX #5: previously no .catch — a rejected promise (offline /
      // network drop) left the optimistic state in place and threw an
      // unhandled rejection. Match the .then's revert pattern.
      console.warn('[ringin] toggleLike reject:', e);
      setPosts(function(prev){return prev.map(function(p){
        if(p.id!==pid) return p;
        return Object.assign({},p,{liked:snap.liked,likes:snap.likes,likedBy:snap.likedBy,likedByIds:snap.likedByIds});
      });});
      likingRef.current[pid] = false;
    });
  }

  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var liveS=useState(null); var activeLive=liveS[0]; var setActiveLive=liveS[1];
  var ac = acState[0];
  var setAc = acState[1];
  var onViewExpert = props.onViewExpert;
  var onOpenWallet = props.onOpenWallet;
  var compTextS=useState(''); var compText=compTextS[0]; var setCompText=compTextS[1];
  var hasMoreHS=useState(false); var hasMoreH=hasMoreHS[0]; var setHasMoreH=hasMoreHS[1];
  var showLikersS=useState(null); var showLikers=showLikersS[0]; var setShowLikers=showLikersS[1];
  var likersNamesS=useState({}); var likersNames=likersNamesS[0]; var setLikersNames=likersNamesS[1];

  function prefetchLikerNames(postsArr, existingNames){
    var allIds = [];
    postsArr.forEach(function(p){
      (p.likedByIds||[]).forEach(function(id){
        if(!existingNames[id]&&allIds.indexOf(id)<0) allIds.push(id);
      });
    });
    if(allIds.length===0) return;
    sbHome.from('profiles').select('id,full_name,email,avatar_url').in('id',allIds).then(function(res){
      if(res.data&&res.data.length>0){
        var map={};
        res.data.forEach(function(u){map[u.id]={name:u.full_name||(u.email||'').split('@')[0],avatar:u.avatar_url};});
        setLikersNames(function(prev){return Object.assign({},prev,map);});
      }
    });
  }

  function openLikersPopup(e, p){
    e.stopPropagation();
    if(!p||p.likes<=0) return;
    if(showLikers===p.id){setShowLikers(null);return;}
    setShowLikers(p.id);
  }
  var loadMoreHS=useState(false); var loadMoreH=loadMoreHS[0]; var setLoadMoreH=loadMoreHS[1];
  var notifsS=useState([]); var notifs=notifsS[0]; var setNotifs=notifsS[1];
  var unreadNotifS=useState(0); var unreadNotif=unreadNotifS[0]; var setUnreadNotif=unreadNotifS[1];
  // Shared coin balance — synced across HomeScreen / Messages / Search /
  // Wallet via the useCoinBalance hook. Single source of truth, realtime.
  var coinBal = useCoinBalance(currentUserId, sbHome);
  var showNotifsS=useState(false); var showNotifs=showNotifsS[0]; var setShowNotifs=showNotifsS[1];
  var compImgsS=useState([]); var compImgs=compImgsS[0]; var setCompImgs=compImgsS[1];
  var compVideoS=useState(null); var compVideo=compVideoS[0]; var setCompVideo=compVideoS[1];
  // FIX #1 — track the last URL.createObjectURL we handed to <video> so we
  // can revoke it when compVideo changes / clears / the component unmounts.
  // Without this, every "pick video → cancel → pick video" cycle leaked
  // the prior blob URL (and the underlying decoded frames) in memory.
  var compVideoPrevUrlRef = useRef(null);
  useEffect(function(){
    var nextUrl = (compVideo && compVideo.localUrl) || null;
    var prevUrl = compVideoPrevUrlRef.current;
    if (prevUrl && prevUrl !== nextUrl) {
      try { URL.revokeObjectURL(prevUrl); } catch(_){}
    }
    compVideoPrevUrlRef.current = nextUrl;
  }, [compVideo]);
  useEffect(function(){
    // Unmount cleanup — drop any URL still held when the screen tears down.
    return function(){
      var u = compVideoPrevUrlRef.current;
      if (u) { try { URL.revokeObjectURL(u); } catch(_){} compVideoPrevUrlRef.current = null; }
    };
  }, []);
  var compMediaTypeS=useState('photo'); var compMediaType=compMediaTypeS[0]; var setCompMediaType=compMediaTypeS[1];
  var uploadingMediaS=useState(false); var uploadingMedia=uploadingMediaS[0]; var setUploadingMedia=uploadingMediaS[1];
  // Carousel index keyed by post id. Persisted to localStorage so a tab
  // switch (Home → Messages → Home) doesn't reset every multi-image post
  // back to the first slide. Capped to 200 entries so the storage blob
  // can't grow unbounded over months of use.
  var carouselIdxS=useState(function(){
    try { var raw = localStorage.getItem('ringin_carousel_idx'); return raw ? (JSON.parse(raw) || {}) : {}; } catch(_) { return {}; }
  });
  var carouselIdx=carouselIdxS[0];
  var setCarouselIdxRaw=carouselIdxS[1];
  // FIX #3 — debounce the localStorage write. Every carousel swipe used to
  // synchronously stringify-and-write the entire {postId:idx} blob, which
  // on a phone with 50+ carousel posts ran into 20-30ms main-thread stalls
  // mid-swipe. Now we coalesce writes into 400ms windows.
  var carouselIdxWriteTimer = useRef(null);
  function setCarouselIdx(updater){
    setCarouselIdxRaw(function(prev){
      var next = typeof updater === 'function' ? updater(prev) : updater;
      // Trim to the 200 most-recently-touched post ids to bound storage.
      try {
        var keys = Object.keys(next);
        if (keys.length > 200) {
          var trimmed = {};
          keys.slice(-200).forEach(function(k){ trimmed[k] = next[k]; });
          next = trimmed;
        }
      } catch(_) {}
      if (carouselIdxWriteTimer.current) clearTimeout(carouselIdxWriteTimer.current);
      carouselIdxWriteTimer.current = setTimeout(function(){
        try { localStorage.setItem('ringin_carousel_idx', JSON.stringify(next)); } catch(_){}
      }, 400);
      return next;
    });
  }
  useEffect(function(){
    // Clear any pending debounced write on unmount so we don't fire after
    // the component is gone.
    return function(){
      if (carouselIdxWriteTimer.current) { clearTimeout(carouselIdxWriteTimer.current); carouselIdxWriteTimer.current = null; }
    };
  }, []);
  var postDetailS=useState(null); var postDetail=postDetailS[0]; var setPostDetail=postDetailS[1];
  var postDetailIdxS=useState(0); var postDetailIdx=postDetailIdxS[0]; var setPostDetailIdx=postDetailIdxS[1];
  var pdMenuOpenS=useState(false); var pdMenuOpen=pdMenuOpenS[0]; var setPdMenuOpen=pdMenuOpenS[1];
  var pdUiVisibleS=useState(true); var pdUiVisible=pdUiVisibleS[0]; var setPdUiVisible=pdUiVisibleS[1];
  var pdShowCommentsS=useState(false); var pdShowComments=pdShowCommentsS[0]; var setPdShowComments=pdShowCommentsS[1];
  var commentLikesS=useState(function(){try{var s=localStorage.getItem('ringin_clikes');return s?JSON.parse(s):{}}catch(e){return {};}}); var commentLikes=commentLikesS[0]; var _setCommentLikes=commentLikesS[1];
  function setCommentLikes(updater){_setCommentLikes(function(prev){var next=typeof updater==='function'?updater(prev):updater;try{localStorage.setItem('ringin_clikes',JSON.stringify(next));}catch(e){}return next;});}
  var replyingToS=useState(null); var replyingTo=replyingToS[0]; var setReplyingTo=replyingToS[1];
  var collapsedThreadsS=useState({}); var collapsedThreads=collapsedThreadsS[0]; var setCollapsedThreads=collapsedThreadsS[1];
  var postingS=useState(false); var posting=postingS[0]; var setPosting=postingS[1];
  var showCompS=useState(false); var showComp=showCompS[0]; var setShowComp=showCompS[1];
  // Per-post audience selector (T2.3, requires migration 0005_audience.sql).
  // 'public' = anyone signed in. 'followers' = only people who follow you.
  // 'private' = only you. Default to last-used (saved in localStorage).
  var compAudienceS=useState(function(){try{return localStorage.getItem('ringin_last_audience')||'public';}catch(_){return 'public';}});
  var compAudience=compAudienceS[0]; var setCompAudience=compAudienceS[1];
  var compAudienceMenuS=useState(false); var compAudienceMenu=compAudienceMenuS[0]; var setCompAudienceMenu=compAudienceMenuS[1];
  // Hashtag filter (T1.14) — tap any tag chip in feed → filters to only posts
  // with that tag. Click "× Clear filter" banner to restore the full feed.
  var selectedTagS=useState(null); var selectedTag=selectedTagS[0]; var setSelectedTag=selectedTagS[1];
  // Per-user "hide like counts" preference (T1.12). When true, post like
  // labels render "Liked" / "0 Likes" instead of the raw count. Same hook is
  // also called inside UserProfileView so both scopes can read the toggle.
  var hideLikesPair=useHideLikes(); var hideLikes=hideLikesPair[0];
  var compEmojiS=useState(false); var compEmoji=compEmojiS[0]; var setCompEmoji=compEmojiS[1];
  var loadingS=useState(_cachedPosts.length===0); var loading=loadingS[0]; var setLoading=loadingS[1];
  // Pull-to-refresh state (new — was missing from HomeScreen).
  var refreshingHS=useState(false); var refreshingH=refreshingHS[0]; var setRefreshingH=refreshingHS[1];
  var pullStartHS=useState(0); var pullStartH=pullStartHS[0]; var setPullStartH=pullStartHS[1];
  var pullDistHS=useState(0); var pullDistH=pullDistHS[0]; var setPullDistH=pullDistHS[1];
  var fileInputRef=useRef(null);
  var typingTimerRef=useRef(null);
  // R17 FIX #1a: monotonically-increasing sequence guard for doSearch (header
  // search). A fast-typed earlier query could resolve AFTER a newer one and
  // clobber the visible results. Each call captures mySeq; on resolve, if
  // it's not the latest, bail.
  var doSearchSeqRef = useRef(0);
  // R16 FIX #8: typingTimerRef sets a setTimeout on each comment keystroke
  // (line ~3040). If HomeScreen unmounts mid-debounce, the timer fires on
  // a dead component (no actual setState here, but it leaks the closure
  // until it runs). Cancel on unmount for hygiene.
  useEffect(function(){
    return function(){
      if (typingTimerRef.current) { try { clearTimeout(typingTimerRef.current); } catch(_){} typingTimerRef.current = null; }
    };
  }, []);
  // FIX #6 — hoisted from below so the back-handler useEffect's dep array
  // sees a defined value on first render. Was at line ~1503 originally;
  // moving it up keeps the same React hook call order (just earlier in
  // the function body), which is still consistent across renders.
  var selUserS=useState(null); var selectedUser=selUserS[0]; var setSelectedUser=selUserS[1];
  // FIX #4 — single-instance IntersectionObserver for the infinite-scroll
  // sentinel. The old inline ref callback was constructing a new observer
  // on EVERY render, and each one kept a stale closure over hasMoreH /
  // loadMoreH, so they all kept firing loadMoreFeed in a loop. Hold the
  // observer + sentinel element in refs; recreate the observer only when
  // the closure inputs change.
  var obsRef = useRef(null);
  var sentinelRef = useRef(null);
  var EMOJIS=['😊','😂','❤️','🔥','👍','🙌','😍','🤔','👏','🎉','💪','✨','🚀','💡','🎯','😎','🙏','💯','😅','🤣'];
  // FIX #4 (cont.) — recreate observer when hasMoreH / loadMoreH change so
  // the entries callback closes over the latest values. Old observer is
  // explicitly disconnected first to prevent multiple observers piling up.
  useEffect(function(){
    // ALWAYS disconnect any prior observer first so we never accumulate.
    if (obsRef.current) { try { obsRef.current.disconnect(); } catch(_){} obsRef.current = null; }
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;
    if (!hasMoreH) return; // nothing to observe
    if (!sentinelRef.current) return; // sentinel not mounted yet
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting && hasMoreH && !loadMoreH) loadMoreFeed();
      });
    }, { rootMargin: '300px 0px' });
    obs.observe(sentinelRef.current);
    obsRef.current = obs;
    return function(){
      if (obsRef.current) { try { obsRef.current.disconnect(); } catch(_){} obsRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreH, loadMoreH]);
  useEffect(function(){
    if(!currentUserId||!currentUserName) return;
    setLikersNames(function(prev){
      if(prev[currentUserId]) return prev;
      var m=Object.assign({},prev);
      m[currentUserId]={name:currentUserName,avatar:currentUserAvatar};
      return m;
    });
  },[currentUserId]);

  // Android back / edge-swipe handler — close any open overlay
  // (post detail, edit-post modal, notifications panel, comments) before
  // App.js falls through to tab-level back nav. Innermost first.
  // FIX #6 — consume the back gesture for the additional overlays
  // (postMenu, showLikers, selectedUser profile sub-view, the audience
  // popover) BEFORE the existing overlays, so a back press dismisses the
  // topmost overlay first. The Moments viewer is intentionally NOT in this
  // list — Moments owns its own 'ringin:back' listener.
  useEffect(function(){
    function onBack(ev){
      // Innermost transient popovers first.
      if (postMenu) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setPostMenu(null);
        return;
      }
      if (compAudienceMenu) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setCompAudienceMenu(false);
        return;
      }
      if (showLikers) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setShowLikers(null);
        return;
      }
      if (showEditPost) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setShowEditPost(false); setEditPostData(null);
        return;
      }
      if (postDetail) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setPostDetail(null); setPostDetailIdx(0);
        return;
      }
      if (showNotifs) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setShowNotifs(false);
        return;
      }
      if (openComments) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setOpenComments(null);
        return;
      }
      // selectedUser is a full sub-screen (UserProfileView); pop it last
      // before falling through to App.js's tab-level back.
      if (selectedUser) {
        if (ev && ev.preventDefault) ev.preventDefault();
        setSelectedUser(null);
        return;
      }
    }
    window.addEventListener('ringin:back', onBack);
    return function(){ window.removeEventListener('ringin:back', onBack); };
  }, [showEditPost, postDetail, showNotifs, openComments, postMenu, showLikers, selectedUser, compAudienceMenu]);

  // R18 FIX B: ESC closes post-detail, edit-post modal, notifications panel,
  // and comments panel (the inline expand under each post card). Also locks
  // body scroll while any of the three FULLSCREEN overlays (postDetail,
  // showEditPost, showNotifs) are open so the page behind doesn't scroll
  // when the user drag-scrolls inside the modal on touch devices. The
  // openComments expand is inline (no backdrop), so it gets ESC only — no
  // scroll lock. Single useEffect covers all four because they share the
  // same window keydown listener and overflow restore.
  useEffect(function(){
    var anyFullscreen = !!(postDetail || showEditPost || showNotifs);
    function onKey(ev){
      if (ev.key !== 'Escape') return;
      // Innermost first — same priority order as the ringin:back handler so
      // ESC and the Android back gesture behave identically.
      if (postDetail) {
        setPostDetail(null); setPostDetailIdx(0); setPdMenuOpen(false); setPdUiVisible(true); setPdShowComments(false); setReplyingTo(null);
        return;
      }
      if (showEditPost) {
        setShowEditPost(false); setEditPostData(null);
        return;
      }
      if (showNotifs) { setShowNotifs(false); return; }
      if (openComments) { setOpenComments(null); return; }
    }
    if (postDetail || showEditPost || showNotifs || openComments) {
      window.addEventListener('keydown', onKey);
    }
    /* R20 FIX #2: ref-counted body-scroll-lock; releases atomically on cleanup */
    var releaseLock = null;
    if (anyFullscreen) {
      releaseLock = acquireBodyScrollLock();
    }
    return function(){
      window.removeEventListener('keydown', onKey);
      if (releaseLock) releaseLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postDetail, showEditPost, showNotifs, openComments]);

  // Listen for the bell-click event from the App-level top bar to open notifications panel
  useEffect(function(){
    var handler=function(){
      setShowNotifs(true);
      if(props.session&&props.session.user){
        // R11 FIX #4: mark-all-read was fire-and-forget — a failed UPDATE
        // left the badge at 0 in the UI but DB still flagged unread rows,
        // so the next session would resurface them. Snapshot + rollback.
        var snap = unreadNotif;
        setUnreadNotif(0);
        sbHome.from('notifications').update({read:true}).eq('user_id',props.session.user.id).eq('read',false).then(function(r){
          if(r && r.error){
            console.error('[ringin] mark-read failed:', r.error);
            setUnreadNotif(snap);
            try { toastError('Couldn\'t mark notifications as read'); } catch(_){}
          }
        }).catch(function(e){
          console.warn('[ringin] mark-read reject:', e);
          setUnreadNotif(snap);
        });
      }
    };
    window.addEventListener('ringin-open-notifs', handler);
    return function(){ window.removeEventListener('ringin-open-notifs', handler); };
  },[props.session,unreadNotif]);
  // FIX R10-2 (consumer half): App.js routes 'ringin:open-post-detail' from
  // SavedPostsScreen here as 'ringin:home-open-post'. We resolve the postId
  // against the current `posts` array and open the post detail view.
  useEffect(function(){
    function onOpen(ev){
      var pid = ev && ev.detail && ev.detail.postId;
      if (!pid) return;
      var p = posts.find(function(x){return x.id===pid;});
      if (p) { setPostDetail(p); setPostDetailIdx(0); }
    }
    window.addEventListener('ringin:home-open-post', onOpen);
    return function(){ window.removeEventListener('ringin:home-open-post', onOpen); };
  },[posts]);
  useEffect(function(){
    if(!props.session||!props.session.user) return;
    var uid = props.session.user.id;
    // Check if user is banned
    sbHome.from('profiles').select('banned').eq('id', uid).single().then(function(r){
      if(r.data && r.data.banned){
        sbHome.auth.signOut();
        toastError('Your account has been suspended. Please contact support.');/* FIX #7 */
      }
    });
    sbHome.from('notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(20).then(function(res){
      if(res.data){
        setNotifs(res.data);
        setUnreadNotif(res.data.filter(function(n){return !n.read;}).length);
      }
    });
    // R12 FIX #6: append a random suffix so a fast remount (StrictMode dev
    // double-mount or session refresh) doesn't collide on the same channel
    // name. The cleanup still removes the exact channel instance via `ch`.
    var notifsChanName = 'notifs-' + uid + '-' + Math.random().toString(36).slice(2);
    var ch = sbHome.channel(notifsChanName)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+uid},function(p){
        setNotifs(function(prev){return [p.new].concat(prev);});
        setUnreadNotif(function(n){return n+1;});
        var mp=[];try{var ms=localStorage.getItem('ringin_muted_posts');if(ms)mp=JSON.parse(ms);}catch(e){}
        if(!mp.includes(p.new.post_id)) playSound('notification');
      }).subscribe();
    return function(){sbHome.removeChannel(ch);};
  // R16 FIX #5: dep was [props.session] — the session object reference
  // changes on every TOKEN_REFRESHED (~hourly), so the whole effect tore
  // down + rebuilt the notifs realtime channel every hour. Depend on the
  // user id only so the effect re-runs only on actual sign-in / sign-out.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.session && props.session.user && props.session.user.id]);

  function saveEditPost(){
    if(!editPostData||!editPostData.content||!editPostData.content.trim()) return;
    var newText = editPostData.content;
    var pid = editPostData.id;
    var snapPosts = posts.slice();
    // Optimistic update on the main feed only — userPosts (UserProfileView)
    // is in a sibling component scope, refreshes via the realtime
    // 'public-posts' channel listener after the DB write lands.
    setPosts(function(prev){return prev.map(function(x){return x.id===pid?Object.assign({},x,{text:newText}):x;});});
    setShowEditPost(false);
    setEditPostData(null);
    sbHome.from('posts').update({text:newText}).eq('id',pid).then(function(r){
      if(r.error){
        console.error('RingIn Error [saveEditPost]:', r.error && r.error.message ? r.error.message : 'Unknown error');
        setPosts(snapPosts);
        try{toastError('Failed to edit. Try again.');}catch(e){console.warn('[ringin] toast failed:', e);}/* FIX #7 */
        return;
      }
      try{toastSuccess('✏️ Post updated');}catch(e){}
    });
  }
  function toggleMutePost(pid){
    /* R19 verifier-fix: compute next OUTSIDE the updater so StrictMode (which
     * double-invokes updaters in dev) doesn't dispatch the event twice. The
     * functional state-update still uses an updater for concurrency safety,
     * but the side-effects (LS write + window event) only fire once. */
    var cur = mutedPosts || [];
    var next = cur.includes(pid) ? cur.filter(function(x){return x!==pid;}) : cur.concat([pid]);
    setMutedPosts(next);
    try{ localStorage.setItem('ringin_muted_posts', JSON.stringify(next)); }catch(e){}
    /* R19 FIX #5: broadcast so UserProfileView menu label + ProfileScreen mutedPostsProf re-render */
    try { window.dispatchEvent(new CustomEvent('ringin-muted-posts-changed', { detail: { pid: pid, muted: next.includes(pid) } })); } catch(_){}
  }

  function loadMoreFeed(){
    if(loadMoreH||!hasMoreH) return;
    // FIX #5 — if there are NO real (string-id, i.e. Supabase) posts, the
    // pagination query previously used `now()` as the high-water mark and
    // returned nothing, which left hasMoreH=true and the
    // IntersectionObserver re-fired loadMoreFeed in a tight loop. Bail out
    // cleanly so the observer stops trying.
    var realPosts = posts.filter(function(p){return typeof p.id==='string';});
    var oldest = realPosts[realPosts.length-1];
    if (!oldest || !oldest.createdAt) { setHasMoreH(false); setLoadMoreH(false); return; }
    setLoadMoreH(true);
    var oldestDate = oldest.createdAt;
    sbHome.from('posts').select('*').order('created_at',{ascending:false}).lt('created_at',oldestDate).limit(12).then(function(res){
      if(res.data&&res.data.length>0){
        var morePosts=res.data.map(mapPost);
        setPosts(function(prev){return prev.concat(morePosts);});
        setHasMoreH(res.data.length===12);
        prefetchLikerNames(morePosts, likersNames);
      } else {
        setHasMoreH(false);
      }
      setLoadMoreH(false);
    });
  }

  function mapPost(p){
    var session = props.session;
    var userId = session&&session.user?session.user.id:null;
    var likesArr = Array.isArray(p.likes)?p.likes:[];
    return {
      id:p.id,
      userId:p.user_id,
      initials:safeInitials(p.user_name), /* FIX #10 */
      name:p.user_name||'User',
      role:'RingIn Member',
      color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
      img:p.user_avatar||null,
      time:formatDateTime(p.created_at), /* R18: timezone-aware (was raw toLocaleString) */
      createdAt:p.created_at,
      text:p.text||'',
      tags:p.tags||[],
      likes:likesArr.length,
      liked:userId?likesArr.includes(userId):false,
      likedBy:[],
      likedByIds:likesArr,
      comments:p.comments_count||0,
      rate:0,
      expertId:null,
      postImg:p.images&&p.images.length>0?p.images[0]:null,
      extraImgs:p.images&&p.images.length>1?p.images.slice(1):[],
      video_url:p.video_url||null,
      audience:p.audience||'public',
      isUserPost:true
    };
  }


  // Refetch the feed from Supabase — used by initial mount AND
  // pull-to-refresh.
  function refreshFeed(){
    return sbHome.from('posts').select('*').order('created_at',{ascending:false}).limit(12).then(function(res){
      setLoading(false);
      if(res.error){ console.error('Error fetching posts:', res.error); return; }
      if(res.data&&res.data.length>0){
        var dbPosts = res.data.map(mapPost);
        // Replace server posts with the fresh list, preserve any optimistic
        // (numeric-id) drafts the user hasn't published yet.
        setPosts(function(prev){
          var optimistic = prev.filter(function(p){return typeof p.id === 'number';});
          return dbPosts.concat(optimistic);
        });
        setHasMoreH(res.data.length===12);
        try{localStorage.setItem('feed_posts_cache',JSON.stringify(dbPosts));}catch(e){}
        prefetchLikerNames(dbPosts, {});
      }
    });
  }
  useEffect(function(){
    sbHome.from('posts').select('*').order('created_at',{ascending:false}).limit(12).then(function(res){
      setLoading(false);
      if(res.error){ console.error('Error fetching posts:', res.error); return; }
      if(res.data&&res.data.length>0){
        var dbPosts = res.data.map(mapPost);
        setPosts(function(prev){return dbPosts.concat(prev.filter(function(p){return typeof p.id === 'number';}));});
        setHasMoreH(res.data.length===12);
        try{localStorage.setItem('feed_posts_cache',JSON.stringify(dbPosts));}catch(e){}
        prefetchLikerNames(dbPosts, {});
        // Defer the N-post comment-cache parse to idle time — synchronous parse of
        // 20+ localStorage blobs blocks the UI thread for 100-500ms on Samsung
        // Internet, freezing the feed tab. Same fix as the other forEach above.
        var runIdle = (typeof window !== 'undefined' && window.requestIdleCallback)
          ? function(fn){ window.requestIdleCallback(fn, { timeout: 1500 }); }
          : function(fn){ setTimeout(fn, 0); };
        runIdle(function(){
          var cmap={};
          for(var i=0;i<dbPosts.length;i++){
            try{ var c = localStorage.getItem('comments_'+dbPosts[i].id); if(c) cmap[dbPosts[i].id] = JSON.parse(c); }catch(e){}
          }
          if(Object.keys(cmap).length) setCommentsCache(cmap);
        });
      }
    });
  },[]);
  // Realtime: likes, comment counts, new posts in feed (shared hook)
  usePostsRealtime(sbHome,'public-posts',currentUserId,setPosts,setCommentsCache,{
    onNewPost:function(raw){
      // R15 FIX #1: skip realtime INSERT for blocked authors so they can't
      // re-appear in the feed via a fresh post even though render-time
      // filter would also catch it (avoids unnecessary state churn).
      if (raw && isBlockedSync(raw.user_id || raw.userId)) return;
      var newPost=mapPost(raw);
      setPosts(function(prev){
        if(prev.find(function(pp){return pp.id===newPost.id;})) return prev;
        return [newPost].concat(prev);
      });
    }
  });
  var followHook = useFollow(sbHome, currentUserId);
  var following = followHook.following;
  var toggleFollow = followHook.toggleFollow;
  var searchQS=useState(''); var searchQ=searchQS[0]; var setSearchQ=searchQS[1];
  var searchResS=useState(null); var searchRes=searchResS[0]; var setSearchRes=searchResS[1];
  var searchingS=useState(false); var searching=searchingS[0]; var setSearching=searchingS[1];
  // FIX #6 — selUserS hoisted earlier (see comment near typingTimerRef).
  var locFilterS=useState('all'); var locFilter=locFilterS[0]; var setLocFilter=locFilterS[1];
  var supabase = props.supabase;

  var ALL_EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,img:'https://i.pravatar.cc/150?img=47',type:'expert'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,img:'https://i.pravatar.cc/150?img=12',type:'expert'},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,img:'https://i.pravatar.cc/150?img=23',type:'expert'},{id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,img:'https://i.pravatar.cc/150?img=33',type:'expert'},{id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,img:'https://i.pravatar.cc/150?img=44',type:'expert'},{id:6,initials:'JT',name:'James Tanner',role:'Fitness Coach',rate:50,rating:4.7,img:'https://i.pravatar.cc/150?img=15',type:'expert'}];
  var ALL_SKILLS=['React Development','System Design','Career Planning','Public Speaking','Python','Machine Learning','Digital Marketing','UI/UX Design','Financial Planning','Legal Consulting'];
  var ALL_WORKSHOPS=[{title:'How to Crack Google Interview',host:'Ravi Menon'},{title:'Managing Anxiety in 2026',host:'Dr. Layla Khalid'}];

  function doSearch(q){
    if(!q||!q.trim()){setSearchRes(null);return;}
    // R17 FIX #1a: capture sequence for this invocation so a slower
    // earlier resolve can't overwrite a newer one.
    var mySeq = ++doSearchSeqRef.current;
    setSearching(true);
    var ql = q.toLowerCase();
    var experts = ALL_EXPERTS.filter(function(e){return e.name.toLowerCase().includes(ql)||e.role.toLowerCase().includes(ql);});
    var skills = ALL_SKILLS.filter(function(s){return s.toLowerCase().includes(ql);});
    var workshops = ALL_WORKSHOPS.filter(function(w){return w.title.toLowerCase().includes(ql)||w.host.toLowerCase().includes(ql);});
    if(supabase){
      // FIX #3: add .catch so a rejected profile search doesn't leave the spinner stuck
      supabase.from('profiles').select('*').or('email.ilike.%'+q+'%,full_name.ilike.%'+q+'%').then(function(res){
        if (mySeq !== doSearchSeqRef.current) return; // R17 FIX #1a: newer query in flight
        var users = res.data||[];
        setSearchRes({experts:experts,skills:skills,workshops:workshops,users:users});
        setSearching(false);
      }).catch(function(e){
        if (mySeq !== doSearchSeqRef.current) return; // R17 FIX #1a: don't flip spinner if superseded
        setSearching(false); console.warn('[ringin] doSearch reject:', e);
      });
    } else {
      setSearchRes({experts:experts,skills:skills,workshops:workshops,users:[]});
      setSearching(false);
    }
  }

  useEffect(function(){
    var timer = setTimeout(function(){doSearch(searchQ);},300);
    return function(){clearTimeout(timer);};
  },[searchQ]);
  var notifS=useState(false); var showNotif=notifS[0]; var setShowNotif=notifS[1];
  // Final polish: removed dead NOTIFS mock array (never read anywhere after
  // the notifications feature switched to live Supabase data).
  var onOpenWallet2 = props.onOpenWallet;
  function timeAgo(dateStr){
    if(!dateStr) return '';
    // Final polish: no manual 'Z' appending. See MessagesScreen.timeAgo.
    var now = new Date();
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    var diff = Math.floor((now - date) / 1000);
    // R11 FIX #2: clock skew (server ahead of client) → show 'Just now' instead of '-Nm ago'.
    if (diff < 0) return 'Just now';
    if(diff < 60) return 'Just now';
    if(diff < 3600) return Math.floor(diff/60) + 'm ago';
    if(diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if(diff < 172800) return 'Yesterday';
    return formatDate(date); /* R18: timezone-aware (was raw toLocaleDateString) */
  }

  // Pass the real coin balance from useCoinBalance hook (was hardcoded 50,
  // making call deduction start from a fake balance and write the wrong
  // value back to profiles.coins on hangup — same regression already fixed
  // in MessagesScreen + SearchScreen + App.js).
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coinBal,onCoinsChange:function(){},onEnd:function(){setActiveCall(null);},session:props.session});

  if(postDetail){
    // Always derive pd from live posts array so likes/comments stay in sync
    // with realtime updates and toggleLike — falls back to snapshot if removed
    var pd=posts.find(function(p){return p.id===postDetail.id;})||postDetail;
    var pdImgs=pd.postImg?[pd.postImg].concat(pd.extraImgs||[]):[];
    var pdComments=commentsCache[pd.id]||[];
    var curImg=pdImgs[postDetailIdx]||null;
    function closePd(){setPostDetail(null);setPostDetailIdx(0);setPdMenuOpen(false);setPdUiVisible(true);setPdShowComments(false);setReplyingTo(null);}
    function savePhoto(){
      if(!curImg) return;
      var a=document.createElement('a'); a.href=curImg; a.download='ringin-photo.jpg'; a.target='_blank'; a.click();
      setPdMenuOpen(false);
    }
    function sharePhoto(){
      var url=curImg||window.location.href;
      if(navigator.share){navigator.share({title:'Check this on RingIn',url:url}).catch(function(){});}
      else{copyToClipboardWithToast(url,'🔗 Link copied!');}
      setPdMenuOpen(false);
    }
    function toggleCommentLike(cid){
      setCommentLikes(function(prev){var m=Object.assign({},prev);m[cid]=(m[cid]||0)===0?1:0;return m;});
    }
    var uiTrans='opacity 0.25s ease, visibility 0.25s ease';
    return React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#000',zIndex:9999,display:'flex',flexDirection:'column',overflowY:'auto'}},

      // ── IMAGE — natural height, max 90vh, tap toggles UI ──
      React.createElement('div',{style:{position:'relative',width:'100%',flexShrink:0,cursor:'pointer'},onClick:function(){setPdUiVisible(function(v){return !v;});}},
        pd.video_url
          ? React.createElement('video',{src:pd.video_url,controls:true,playsInline:true,autoPlay:false,onClick:function(e){e.stopPropagation();},style:{width:'100%',maxHeight:'90vh',display:'block',objectFit:'contain',background:'#000'}})
          : pdImgs.length>0
            /* FIX #6: ImgWithFallback wraps the post-detail lightbox img */
            ? React.createElement(ImgWithFallback,{src:pdImgs[postDetailIdx],fallback:React.createElement('div',{style:{width:'100%',height:'200px',display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontSize:'13px',background:'#111'}},'Image unavailable'),style:{width:'100%',height:'auto',maxHeight:'90vh',display:'block',objectFit:'contain'}})
            : null,
        // Floating X — top left
        React.createElement('button',{onClick:function(e){e.stopPropagation();closePd();},style:{position:'absolute',top:'48px',left:'16px',width:'36px',height:'36px',borderRadius:'50%',background:'rgba(30,30,40,0.7)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',border:'none',color:'#fff',fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4,opacity:pdUiVisible?1:0,visibility:pdUiVisible?'visible':'hidden',transition:uiTrans}},'✕'),
        // Floating ⋮ — top right
        React.createElement('button',{onClick:function(e){e.stopPropagation();setPdMenuOpen(function(v){return !v;});},style:{position:'absolute',top:'48px',right:'16px',width:'36px',height:'36px',borderRadius:'50%',background:'rgba(30,30,40,0.7)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4,letterSpacing:'-1px',opacity:pdUiVisible?1:0,visibility:pdUiVisible?'visible':'hidden',transition:uiTrans}},'⋮'),
        // Carousel dots
        pdImgs.length>1?React.createElement('div',{style:{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',display:'flex',gap:'5px',zIndex:3,opacity:pdUiVisible?1:0,transition:uiTrans}},
          pdImgs.map(function(_,di){return React.createElement('div',{key:di,style:{width:di===postDetailIdx?'18px':'6px',height:'6px',borderRadius:'3px',background:di===postDetailIdx?'#fff':'rgba(255,255,255,0.45)',transition:'all 0.2s'}});})
        ):null,
        // Carousel arrows
        pdImgs.length>1&&postDetailIdx>0?React.createElement('button',{onClick:function(e){e.stopPropagation();setPostDetailIdx(function(i){return i-1;});},style:{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,0.5)',border:'none',color:'#fff',borderRadius:'50%',width:'36px',height:'36px',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3}},'‹'):null,
        pdImgs.length>1&&postDetailIdx<pdImgs.length-1?React.createElement('button',{onClick:function(e){e.stopPropagation();setPostDetailIdx(function(i){return i+1;});},style:{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,0.5)',border:'none',color:'#fff',borderRadius:'50%',width:'36px',height:'36px',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3}},'›'):null
      ),

      // ── BELOW IMAGE: author + caption + action bar + comments ──
      React.createElement('div',{style:{background:'var(--bg)',flexShrink:0}},
        // Author
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px 6px'}},
          pd.img?React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',overflow:'hidden',flexShrink:0}},React.createElement('img',{src:pd.img,style:{width:'100%',height:'100%',objectFit:'cover'}})):
            React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:pd.color||'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'13px',fontWeight:700,flexShrink:0}},pd.initials),
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}},pd.name),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)'}},pd.createdAt?timeAgo(pd.createdAt):(pd.time||''))
          )
        ),
        // Caption + tags
        pd.text?React.createElement('div',{style:{padding:'0 16px 10px'}},
          React.createElement('div',{style:{fontSize:'14px',color:'var(--text)',lineHeight:1.6}},pd.text),
          pd.tags&&pd.tags.length>0?React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'6px'}},
            pd.tags.map(function(t){return React.createElement('span',{key:t,style:{fontSize:'11px',color:'var(--ac)',background:'var(--acg)',padding:'2px 8px',borderRadius:'20px'}},'#'+t);})):null
        ):null,
        // Action bar
        React.createElement('div',{style:{display:'flex',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}},
          React.createElement('button',{
            onClick:function(){toggleLike(pd.id);},
            style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'13px 4px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:pd.liked?'#B44FE8':'var(--t2)',fontWeight:pd.liked?700:400}
          },
            React.createElement('svg',{viewBox:'0 0 24 24',width:'20',height:'20'},
              pd.liked?React.createElement('defs',null,React.createElement('linearGradient',{id:'lgpd',x1:'0%',y1:'0%',x2:'100%',y2:'100%'},React.createElement('stop',{offset:'0%',stopColor:'#5B4FD4'}),React.createElement('stop',{offset:'100%',stopColor:'#C4347A'}))):null,
              React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:pd.liked?'url(#lgpd)':'none',stroke:pd.liked?'none':'var(--t2)',strokeWidth:'2'})
            ),
            pd.likes+' Likes'
          ),
          React.createElement('button',{
            onClick:function(){setPdShowComments(function(v){return !v;});},
            style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'13px 4px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:pdShowComments?'var(--ac)':'var(--t2)'}
          },'💬 '+(pdComments.length||pd.comments||0)+' Comments'),
          React.createElement('button',{onClick:sharePhoto,style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'13px 4px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}},'↗ Share')
        ),
        // Comments section — only visible when toggled
        pdShowComments?React.createElement('div',{style:{borderTop:'1px solid var(--border)'}},
          // Comment list — threaded
          React.createElement('div',{style:{padding:'10px 16px',maxHeight:'40vh',overflowY:'auto'}},
            pdComments.length===0?React.createElement('div',{style:{textAlign:'center',padding:'16px',color:'var(--t3)',fontSize:'13px'}},'No comments yet. Be the first!'):
            renderCommentThread(buildCommentTree(pdComments),0,{
              likes:commentLikes,
              setLikes:setCommentLikes,
              onReply:function(c){setReplyingTo(c);setCommentInput('@'+(c.user_name||'User')+' ');},
              collapsed:collapsedThreads,
              setCollapsed:setCollapsedThreads,
              timeAgo:timeAgoUtil
            })
          ),
          // Comment input
          replyingTo?React.createElement('div',{style:{padding:'4px 16px 0',fontSize:'12px',color:'var(--ac)',display:'flex',alignItems:'center',gap:'6px'}},
            'Replying to @'+(replyingTo.user_name||'User'),
            React.createElement('button',{onClick:function(){setReplyingTo(null);setCommentInput('');},style:{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',padding:'0'}},'✕')
          ):null,
          React.createElement('div',{style:{display:'flex',gap:'8px',padding:'10px 14px'}},
            React.createElement('div',{style:{width:'30px',height:'30px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
              currentUserAvatar?React.createElement('img',{src:currentUserAvatar,style:{width:'100%',height:'100%',objectFit:'cover'}}):safeInitials(currentUserName) /* FIX #10 */
            ),
            React.createElement('input',{value:commentInput,onChange:function(e){playKeyClick();setCommentInput(e.target.value);},autoFocus:true,
              onKeyDown:function(e){if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && commentInput.trim()){submitComment(pd.id,commentInput);setReplyingTo(null);setPostDetail(function(prev){return prev?Object.assign({},prev,{comments:(prev.comments||0)+1}):prev;});setCommentInput('');}}, /* FIX #2: IME composition guard */
              placeholder:'Add a comment...',
              style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'22px',padding:'8px 14px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
            }),
            React.createElement('button',{onClick:function(){if(commentInput.trim()){playPostSound();submitComment(pd.id,commentInput);setReplyingTo(null);setPostDetail(function(prev){return prev?Object.assign({},prev,{comments:(prev.comments||0)+1}):prev;});setCommentInput('');}},
              style:{padding:'8px 16px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'22px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
            },'Post')
          )
        ):null
      ),

      // ── FROSTED GLASS 3-DOT MENU ──
      pdMenuOpen?React.createElement('div',{onClick:function(){setPdMenuOpen(false);},style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.55)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center'}},
        React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'rgba(28,24,40,0.82)',backdropFilter:'blur(48px)',WebkitBackdropFilter:'blur(48px)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'20px',width:'270px',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}},
          [{label:'Save Photo',icon:'⬇️',action:savePhoto},{label:'Share',icon:'↗️',action:sharePhoto},{label:'Report Photo',icon:'🚩',action:function(){setPdMenuOpen(false);var pd=postDetail; if(pd) setReportTarget({type:'photo',id:(pd.img||pd.id)+'',label:'this photo'});}},{label:'Cancel',icon:'',action:function(){setPdMenuOpen(false);},danger:true}]
          .map(function(item,i,arr){
            return React.createElement('button',{key:item.label,onClick:item.action,style:{display:'flex',alignItems:'center',gap:'12px',width:'100%',padding:'16px 20px',background:'none',border:'none',borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.08)':'none',color:item.danger?'rgba(255,80,80,0.9)':'var(--text)',fontSize:'15px',fontWeight:item.danger?400:500,cursor:'pointer',textAlign:'left',fontFamily:'DM Sans,sans-serif'}},
              item.icon?React.createElement('span',{style:{fontSize:'17px'}},item.icon):null, item.label
            );
          })
        )
      ):null
    );
  }
  if(activeLive) return React.createElement(LiveWorkshopScreen,{workshop:activeLive,onLeave:function(){setActiveLive(null);}});
  var fe = ac==='all' ? EXPERTS : EXPERTS.filter(function(e){return e.category===ac;});
  // Location filter (wired from .frow chips above)
  if(locFilter && locFilter!=='all'){
    fe = fe.filter(function(e){
      var l = (e.loc||'').toLowerCase();
      if(locFilter==='dubai') return l.indexOf('dubai')>=0;
      if(locFilter==='abudhabi') return l.indexOf('abu dhabi')>=0;
      if(locFilter==='online') return l.indexOf('remote')>=0 || l.indexOf('online')>=0;
      return true;
    });
  }
  var onlineExperts = fe.filter(function(e){return e.online===true;});

  function submitPost(){
    // FIX #10: guard against double-submit (Enter + Tap race). `posting` is set
    // true at the start of an in-flight submit and only cleared on completion,
    // error path, or moderation-cancel — so this early-return blocks the second
    // call from ever firing the duplicate insert.
    if(posting) return;
    if(!compText.trim()&&compImgs.length===0&&!compVideo){toastWarn('Write something or add a photo/video!');return;}
    if(compVideo&&compVideo.uploading){toastWarn('Video is still uploading, please wait...');return;}
    if(uploadingMedia){toastWarn('Media is still uploading, please wait...');return;}
    playPostSound();
    var session = props.session;
    if(!session||!session.user){toastError('Please log in to post');return;}
    setPosting(true);

    // ML content moderation + auto-tag pipeline
    var moderationPromise = compText.trim().length > 0
      ? detectContent(compText, 'post').catch(function(){return null;})
      : Promise.resolve(null);

    moderationPromise.then(function(detection){
      // Block harmful content
      if (detection && detection.action === 'block') {
        toastError('Post blocked: ' + (detection.flags||[]).join(', ') + '. Please rewrite.');
        setPosting(false);
        return;
      }
      // Warn user on borderline content
      if (detection && detection.action === 'review') {
        if (!window.confirm('Heads up: your post may contain ' + (detection.flags||[]).join(', ') + '. Post anyway?')) {
          setPosting(false);
          return;
        }
      }

      // Auto-tag posts
      // FIX #9: lowercase manual hashtags so `#Health` and `#health` collapse
      // into the same tag instead of fragmenting search results.
      var manualTags = (compText.match(/#[a-zA-Z0-9]+/g)||[]).map(function(t){return t.replace('#','').toLowerCase();});
      var autoTagPromise = compText.trim().length > 20
        ? autoTagPost(compText, 3).catch(function(){return null;})
        : Promise.resolve(null);

      autoTagPromise.then(function(tagResult){
        var autoTags = [];
        if (tagResult && tagResult.tags) {
          autoTags = tagResult.tags.filter(function(t){return t.confidence >= 0.5;}).map(function(t){return t.topic;});
        }
        var allTags = manualTags.concat(autoTags.filter(function(t){return manualTags.indexOf(t)<0;}));

        // Use the user's chosen full_name from profile, NOT the email prefix.
        // Fall back to email prefix only when no full_name is set.
        var myProfileName = null;
        try {
          var pi = localStorage.getItem('profile_info_'+session.user.id);
          if(pi){ var pj=JSON.parse(pi); if(pj && pj.name) myProfileName = pj.name; }
        } catch(e){}
        var safeEmail = (session.user.email||'user').split('@')[0] || 'user';
        var postData = {
          user_id: session.user.id,
          user_name: myProfileName || safeEmail,
          user_avatar: localStorage.getItem('avatar_'+session.user.id)||null,
          text: compText,
          images: compImgs,
          video_url: compVideo&&compVideo.supaUrl?compVideo.supaUrl:null,
          tags: allTags,
          likes: [],
          comments_count: 0,
          // Audience selector (T2.3, requires migration 0005). If the column
          // doesn't exist yet the insert will fail with "column does not
          // exist" — caught and retried below WITHOUT this field, so the
          // post still goes through (defaults to public).
          audience: compAudience,
        };
        // Remember last-used audience so the next post defaults to it.
        try{ localStorage.setItem('ringin_last_audience', compAudience); }catch(_){}
        function handleInsertResult(res, isRetry){
          isRetry = isRetry || false;
          // ROUND-9 FIX #8: bound the retry so we don't infinite-loop if
          // /audience/ keeps appearing in the error message even after the
          // column is removed from the payload (e.g. the server hit is a
          // different /audience/ trigger or RLS rule). One retry max.
          if (res.error && /audience/.test(res.error.message || '') && !isRetry) {
            // Migration 0005 not applied yet — retry without the audience
            // field so the post still goes through (defaults to public).
            var fallback = Object.assign({}, postData); delete fallback.audience;
            return sbHome.from('posts').insert([fallback]).select().then(function(r){ handleInsertResult(r, true); });
          }
      if(res.error){console.error('RingIn Error [submitPost]:', res.error && res.error.message ? res.error.message : 'Unknown error');toastError('Something went wrong. Please try again.');/* FIX #7 */setPosting(false);return;}
      if(res.data&&res.data[0]){
        // FIX #1: N+1 query elimination. Previously this code did a per-follower
        // .single() lookup against notification_settings (1000 followers = 1000
        // round-trips). Now: ONE batched .in(...) query to fetch all prefs at
        // once, build a map, filter recipients, then ONE batched .insert(rows).
        // Preserves the defensive try/catch in case the table doesn't exist yet.
        var newPostRow = res.data[0];
        sbHome.from('follows').select('follower_id').eq('following_id',session.user.id).then(function(fres){
          if(!fres.data || fres.data.length===0) return;
          var followerIds = fres.data.map(function(f){return f.follower_id;}).filter(Boolean);
          if(followerIds.length===0) return;

          // Batch-fetch every follower's notification setting for THIS author
          // in one round-trip. If notification_settings table/columns are
          // missing, we still proceed and treat everyone as opted-in.
          var prefsPromise;
          try {
            prefsPromise = sbHome.from('notification_settings')
              .select('user_id, notify_posts')
              .eq('following_id', session.user.id)
              .in('user_id', followerIds)
              .then(function(r){ return (r && !r.error && r.data) ? r.data : []; })
              .catch(function(){ return []; });
          } catch(_) {
            prefsPromise = Promise.resolve([]);
          }

          prefsPromise.then(function(prefs){
            // Map of user_id -> notify_posts. Missing entry = default true.
            var prefMap = {};
            (prefs||[]).forEach(function(p){ if(p && p.user_id) prefMap[p.user_id] = p.notify_posts; });
            var recipients = followerIds.filter(function(uid){
              var v = prefMap[uid];
              return v !== false; // undefined or true → include
            });
            if(recipients.length===0) return;

            var rows = recipients.map(function(uid){
              return {
                user_id: uid,
                from_user_id: session.user.id,
                from_user_name: postData.user_name||'Someone',
                from_user_avatar: postData.user_avatar||'',
                type: 'new_post',
                message: (postData.user_name||'Someone')+' posted: '+postData.text.substring(0,50)+(postData.text.length>50?'...':''),
                post_id: newPostRow.id,
                read: false
              };
            });
            // Single batched insert (instead of N inserts).
            try {
              sbHome.from('notifications').insert(rows).then(function(){}).catch(function(){});
            } catch(_) {}
          });
        });
      }
      if(res.data&&res.data[0]){
        var newPost = {
          id:res.data[0].id,
          userId:session.user.id,
          initials:safeInitials(postData.user_name), /* FIX #10 */
          name:postData.user_name,
          role:'RingIn Member',
          color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
          img:postData.user_avatar,
          time:'Just now',
          text:postData.text,
          tags:postData.tags,
          likes:0,
          liked:false,
          likedByIds:[],
          comments:0,
          rate:0,
          expertId:null,
          postImg:compImgs[0]||null,
          extraImgs:compImgs.slice(1),
          video_url:postData.video_url||null,
          isUserPost:true
        };
        setPosts(function(prev){return [newPost].concat(prev);});
      }
      setCompText('');
      setCompImgs([]);
      setCompVideo(null);
      setCompMediaType('photo');
      setShowComp(false);
      setPosting(false);
        }  // close handleInsertResult body
        // Kick off the insert with retry handler.
        sbHome.from('posts').insert([postData]).select().then(handleInsertResult);
      });
    });
  }

  function handleImageUpload(files){
    if(!files||files.length===0) return;
    var session = props.session;
    if(!session||!session.user){toastWarn('Please log in to add photos');/* FIX #7 */return;}
    setUploadingMedia(true);
    var uid = session.user.id;
    var uploads = Array.from(files).map(function(file){
      // Validate file type
      var allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
      if(!allowed.includes(file.type)){
        toastWarn('Only images allowed (JPG, PNG, GIF, WebP)');/* FIX #7 */
        return Promise.resolve(null);
      }
      // Validate file size (max 10MB)
      if(file.size > 10 * 1024 * 1024){
        toastWarn('Image must be under 10MB');/* FIX #7 */
        return Promise.resolve(null);
      }
      var ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'webp';
      var safeFileName = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
      var path = 'posts/'+uid+'/'+safeFileName;
      return sbHome.storage.from('posts-media').upload(path, file, {upsert:true}).then(function(res){
        if(res.error){console.error('img upload err',res.error && res.error.message ? res.error.message : 'Unknown error');return null;}
        // FIX #3: null-guard getPublicUrl. If publicUrl is undefined, treat as failure.
        var pub = sbHome.storage.from('posts-media').getPublicUrl(path);
        if(!pub || !pub.data || !pub.data.publicUrl){
          console.warn('[ringin] getPublicUrl returned no URL for', path);
          return null;
        }
        return pub.data.publicUrl;
      }).catch(function(e){
        console.warn('[ringin] image upload failed:', e);
        return null;
      });
    });
    // FIX #3: ensure setUploadingMedia(false) ALWAYS runs even on error paths.
    Promise.all(uploads).then(function(urls){
      var valid = urls.filter(Boolean);
      setCompImgs(function(prev){return prev.concat(valid);});
      setUploadingMedia(false);
    }).catch(function(e){
      console.warn('[ringin] handleImageUpload failed:', e);
      setUploadingMedia(false);
      toastError('Image upload failed');
    });
  }

  function handleVideoUpload(file){
    if(!file) return;
    var session = props.session;
    if(!session||!session.user){toastWarn('Please log in to add video');/* FIX #7 */return;}
    var maxMB = 100;
    if(file.size > maxMB*1024*1024){toastWarn('Video must be under '+maxMB+'MB');/* FIX #7 */return;}
    var localUrl = URL.createObjectURL(file);
    setCompVideo({localUrl:localUrl, supaUrl:null, uploading:true});
    setUploadingMedia(true);
    var uid = session.user.id;
    var ext = (file.name||'video').split('.').pop()||'mp4';
    var path = 'posts/'+uid+'/vid_'+Date.now()+'.'+ext;
    sbHome.storage.from('posts-media').upload(path, file, {upsert:true}).then(function(res){
      if(res.error){toastError('Something went wrong. Please try again.');/* FIX #7 */setCompVideo(null);setUploadingMedia(false);return;}
      // FIX #3: null-guard getPublicUrl. If publicUrl is undefined, treat as failure.
      var pub = sbHome.storage.from('posts-media').getPublicUrl(path);
      if(!pub || !pub.data || !pub.data.publicUrl){
        console.warn('[ringin] video getPublicUrl returned no URL for', path);
        setCompVideo(null);
        setUploadingMedia(false);
        toastError('Video upload failed');
        return;
      }
      var publicUrl = pub.data.publicUrl;
      setCompVideo({localUrl:localUrl, supaUrl:publicUrl, uploading:false});
      setUploadingMedia(false);
    }).catch(function(e){
      // FIX #3: video upload no .catch. Always reset uploadingMedia + compVideo on failure.
      console.warn('[ringin] video upload failed:', e);
      setUploadingMedia(false);
      setCompVideo(null);
      toastError('Video upload failed');
    });
  }

  function goToExpert(expert){
    if(onViewExpert) onViewExpert(expert);
  }

  function goToExpertById(id){
    var exp = EXPERTS.find(function(e){return e.id===id;});
    if(exp && onViewExpert) onViewExpert(exp);
  }

  // ── Moments → chat bridge ────────────────────────────────────────────────
  // Writes a chat message (like or reply) into the localStorage thread for a
  // mock expert. The message text uses two prefixes that MessagesScreen
  // recognises:
  //   [mlike]<caption>             — renders as "Liked your status" + quote
  //   [mreply]<caption>|<reply>    — renders as "Replied to status" + quote
  // Both are persisted via the same `msgs_<convId>` localStorage key
  // ChatBox already reads from, and the expert is added to
  // `ringin_expert_convos_<myId>` so it shows in the inbox.
  function writeMomentChat(m, slide, text){
    if(!currentUserId || !m) return;
    var convId = 'expert_' + m.expertId;
    var nowIso = new Date().toISOString();
    var msg = {
      id: 'local-mreply-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
      conversation_id: convId,
      sender_id: currentUserId,
      sender_name: currentUserName || 'You',
      receiver_id: convId,
      text: text,
      read: true,
      created_at: nowIso,
    };
    try{
      var msgsKey = 'msgs_' + convId;
      var prev = []; try{ var raw = localStorage.getItem(msgsKey); if(raw) prev = JSON.parse(raw); }catch(_){ }
      prev.push(msg);
      safeSetItem(msgsKey, JSON.stringify(prev)); /* R18: safeSetItem (was bare setItem) */
    }catch(_){}
    try{
      var ecKey = 'ringin_expert_convos_' + currentUserId;
      var ec = []; try{ var ecRaw = localStorage.getItem(ecKey); if(ecRaw) ec = JSON.parse(ecRaw); }catch(_){ }
      var idx = -1; for(var i=0; i<ec.length; i++){ if(ec[i] && ec[i].convId === convId){ idx = i; break; } }
      var entry = {
        id: convId,
        convId: convId,
        otherId: convId,
        receiverId: convId,
        name: m.userName || 'Expert',
        img: m.userAvatar || null,
        role: m.expertRole || '',
        color: m.color || 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
        initials: safeInitials(m.userName, '??'), /* FIX #10 */
        isOnline: true,
        lastMsg: text,
        lastTime: nowIso,
        unreadCount: 0,
        isExpertMock: true,
      };
      if(idx >= 0) ec[idx] = Object.assign({}, ec[idx], entry); else ec.unshift(entry);
      safeSetItem(ecKey, JSON.stringify(ec)); /* R18: safeSetItem (was bare setItem) */
    }catch(_){}
  }

  function goToUserProfile(userId, cachedInfo){
    if(!userId) return;
    if(userId === currentUserId){
      if(props.onGoToProfile) props.onGoToProfile();
      return;
    }
    var info = cachedInfo || likersNames[userId] || {};
    setSelectedUser({
      id: userId,
      full_name: info.name || null,
      email: (info.name || userId.substring(0,8)) + '@ringin.app',
      avatar_url: info.avatar || null,
      is_online: false
    });
    sbHome.from('profiles').select('*').eq('id', userId).single().then(function(res){
      if(res.data) setSelectedUser(res.data);
    });
  }

  if(selectedUser) return React.createElement(UserProfileView,{
    user:selectedUser,
    currentUserId:currentUserId,
    session:props.session,
    following:following,
    toggleFollow:toggleFollow,
    onBack:function(){setSelectedUser(null);},
    onViewUser:function(u){setSelectedUser(u);},
    onGoToMessages:props.onGoToMessages,
    sbHome:sbHome
  });

  // Moments rendering: pull the current user's grouped moment OUT of the
  // strip and pass it as `ownMoment`. This way the "+" tile doubles as the
  // user's own moments tile (tap → view their slides) instead of rendering
  // as a separate "You" heart NEXT to the "+", which is the bug — you'd
  // see two tiles representing the same user after posting.
  var ownMomentForStrip = realMoments.find(function(m){ return m.isSelf; }) || null;
  var otherRealMoments = realMoments.filter(function(m){ return !m.isSelf; });

  return React.createElement('div', {
    className:'hc',
    // ── Pull-to-refresh ──
    // Reads scroll position from the .feed-scroll wrapper (App.js owns
    // the actual scroll container). We only arm when the user is already
    // at the top, so a downward gesture mid-feed still scrolls normally.
    onTouchStart:function(e){
      if(refreshingH) return;
      // Find the nearest scrollable ancestor and bail if not at top.
      var el = e.target;
      while (el && el !== document.body) {
        var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
        var ov = cs && (cs.overflowY||cs.overflow);
        if (ov && (ov === 'auto' || ov === 'scroll')) {
          if (el.scrollTop > 0) return;
          break;
        }
        el = el.parentNode;
      }
      var t = e.touches && e.touches[0]; if(!t) return;
      setPullStartH(t.clientY);
    },
    onTouchMove:function(e){
      if(refreshingH||!pullStartH) return;
      var t = e.touches && e.touches[0]; if(!t) return;
      var d = t.clientY - pullStartH;
      if (d > 0) setPullDistH(Math.min(d, 120));
    },
    onTouchEnd:function(){
      if(refreshingH) return;
      if (pullDistH > 50) {
        setRefreshingH(true);
        try { hapticPulse([20]); } catch(_){}
        Promise.resolve(refreshFeed()).finally(function(){ setRefreshingH(false); });
      }
      setPullStartH(0);
      setPullDistH(0);
    },
  },
    // Pull-to-refresh indicator
    pullDistH>20||refreshingH ? React.createElement('div',{key:'ptr-h',style:{textAlign:'center',padding:'8px',fontSize:'12px',color:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}},
      refreshingH ? React.createElement('div',{style:{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid var(--ac)',borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}) : '↓',
      refreshingH ? 'Refreshing feed…' : pullDistH>50 ? 'Release to refresh' : 'Pull to refresh'
    ) : null,
    // Report modal — replaces the previously fake alert("Thank you for reporting...").
    React.createElement(ReportModal,{target:reportTarget,onClose:function(){setReportTarget(null);},session:props.session}),
    // Likes popup
    showLikers ? React.createElement('div',{
      onClick:function(){setShowLikers(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}
    },
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{background:'rgba(22,16,44,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'20px',padding:'0',width:'100%',maxWidth:'360px',maxHeight:'70vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}
      },
        React.createElement('div',{style:{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'2px'}},
              (function(){
                var p=posts.find(function(x){return x.id===showLikers;});
                if(!p) return 'Liked by';
                var ids=p.likedByIds||[];
                var names=ids.map(function(id){return likersNames[id]?likersNames[id].name:null;}).filter(Boolean);
                if(ids.length===0) return 'Liked by';
                if(ids.length===1) return (names[0]||'Someone')+' liked this';
                if(ids.length===2) return (names[0]||'Someone')+' and '+(names[1]||'someone')+' liked';
                return (names[0]||'Someone')+' and '+(ids.length-1)+' others liked';
              })()
            ),
            React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,0.45)'}},
              (function(){var p=posts.find(function(x){return x.id===showLikers;});return p?(p.likedByIds||[]).length+' likes total':'';})()
            )
          ),
          React.createElement('button',{onClick:function(){setShowLikers(null);},style:{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},'×')
        ),
        React.createElement('div',{style:{overflowY:'auto',padding:'8px 0'}},
          (function(){
            var p=posts.find(function(x){return x.id===showLikers;});
            if(!p) return null;
            var ids=p.likedByIds||[];
            if(ids.length===0) return React.createElement('div',{style:{padding:'24px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}},'No likes yet');
            return ids.map(function(uid){
              var info=likersNames[uid]||{};
              var name=info.name||'Loading...';
              var av=info.avatar||null;
              return React.createElement('div',{key:uid,style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
                React.createElement(AvatarRing,{ show: momentUserIds.has(uid) },
                  React.createElement('div',{
                    onClick:function(){setShowLikers(null);goToUserProfile(uid,{name:name,avatar:av});},
                    style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',cursor:'pointer'}
                  },
                    av?React.createElement('img',{src:av,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}):safeInitials(name) /* FIX #10 */
                  )
                ),
                React.createElement('div',{
                  onClick:function(){setShowLikers(null);goToUserProfile(uid,{name:name,avatar:av});},
                  style:{flex:1,minWidth:0,cursor:'pointer'}
                },
                  React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},name),
                  React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.4)'}},'RingIn Member')
                ),
                uid!==currentUserId?React.createElement('button',{
                  onClick:function(){toggleFollow(uid,name,av,'RingIn Member');},
                  style:{padding:'6px 14px',background:following[uid]?'transparent':'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:following[uid]?'1px solid rgba(123,110,255,0.5)':'none',borderRadius:'20px',color:following[uid]?'#7B6EFF':'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}
                },following[uid]?'Following':'+Follow'):null
              );
            });
          })()
        )
      )
    ) : null,
    // Post 3-dot menu popup
    postMenu ? React.createElement('div',{
      onClick:function(){setPostMenu(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9500,background:'rgba(0,0,0,0.2)'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(28,24,40,0.45)',backdropFilter:'blur(48px)',WebkitBackdropFilter:'blur(48px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'20px',width:'280px',boxShadow:'0 8px 40px rgba(0,0,0,0.35)',overflow:'hidden'}},
        (function(){
          var p=posts.find(function(x){return x.id===postMenu;});
          if(!p) return null;
          var isOwn=p.userId===currentUserId;
          var items=isOwn?[
            {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenu(null);if(window.confirm('Delete this post?')){var snapBefore=posts.slice();setPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});sbHome.from('posts').delete().eq('id',p.id).then(function(r){if(r.error){console.error('RingIn Error [deletePost]:', r.error);setPosts(snapBefore);toastError('Failed to delete post.');/* FIX #7 */}});}}},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;copyToClipboardWithToast(url,'🔗 Link copied!');setPostMenu(null);}},
            {icon:'✏️',label:'Edit Post',fn:function(){setEditPostData({id:p.id,content:p.text||p.content||''});setShowEditPost(true);setPostMenu(null);}},
            {icon:'🔕',label:mutedPosts.includes(p.id)?'Turn on notifications':'Turn off notifications',fn:function(){toggleMutePost(p.id);setPostMenu(null);}}
          ]:[
            {icon:'🔖',label:'Save Post',fn:function(){
              setPostMenu(null);
              if(!currentUserId){toastError('Please log in');return;}
              sbHome.from('saved_posts').upsert({user_id:currentUserId,post_id:p.id},{onConflict:'user_id,post_id'}).then(function(r){
                if(r.error){toastError('Failed to save');return;}
                try{var s=JSON.parse(localStorage.getItem('saved_posts_'+currentUserId)||'[]');if(s.indexOf(p.id)<0){s.push(p.id);localStorage.setItem('saved_posts_'+currentUserId,JSON.stringify(s));}}catch(e){}
                toastSuccess('🔖 Saved to your bookmarks');
              }).catch(function(){toastError('Failed to save');});
            }},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;copyToClipboardWithToast(url,'🔗 Link copied!');setPostMenu(null);}},/* R12 FIX #2: use helper so toast only fires on actual copy success */
            {icon:'➕',label:(following[p.userId]?'✓ Unfollow ':'Follow ')+p.name,fn:function(){toggleFollow(p.userId,p.name,p.img,'RingIn Member');setPostMenu(null);}},
            {icon:'😶',label:'Not interested',fn:function(){setPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});setPostMenu(null);}},
            {icon:'🚩',label:'Report',red:true,fn:function(){setReportTarget({type:'post',id:p.id,label:'this post'});setPostMenu(null);}}
          ];
          return items.map(function(item,i){
            return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.07)':'none',cursor:'pointer'}},
              React.createElement('span',{style:{fontSize:'14px',fontWeight:500,color:item.red?'#ff453a':'rgba(255,255,255,0.9)'}},item.label)
            );
          });
        })()
      )
    ) : null,
    // Per-screen top bar: RingIn brand + coin chip + bell + avatar (Profile)
    React.createElement('div', {className:'topbar'},
      React.createElement('div', {className:'brand'}, 'RingIn'),
      React.createElement('div', {className:'tbr'},
        React.createElement('div', {className:'wchip', onClick:function(){if(onOpenWallet)onOpenWallet();}, style:{cursor:'pointer'}},
          React.createElement('div', {className:'wc'}, 'C'),
          React.createElement('span', null, (Number(coinBal)||0).toLocaleString())
        ),
        React.createElement('div', {className:'ibt', onClick:function(){
          setShowNotifs(!showNotifs);
          if(!showNotifs&&props.session&&props.session.user){
            // R11 FIX #4: same fire-and-forget bug as the bell-event handler
            // above — snapshot + rollback so the badge stays accurate on failure.
            var snap2 = unreadNotif;
            setUnreadNotif(0);
            sbHome.from('notifications').update({read:true}).eq('user_id',props.session.user.id).eq('read',false).then(function(r){
              if(r && r.error){
                console.error('[ringin] mark-read failed:', r.error);
                setUnreadNotif(snap2);
                try { toastError('Couldn\'t mark notifications as read'); } catch(_){}
              }
            }).catch(function(e){
              console.warn('[ringin] mark-read reject:', e);
              setUnreadNotif(snap2);
            });
          }
        }, style:{cursor:'pointer',position:'relative'}},
          React.createElement('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'var(--t2)',strokeWidth:2,width:15,height:15},
            React.createElement('path', {d:'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'})
          ),
          unreadNotif>0 ? React.createElement('div', {className:'nd', style:{background:'#ef4444',minWidth:'14px',height:'14px',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',color:'#fff',top:'3px',right:'3px',padding:'0 2px'}}, unreadNotif>9?'9+':String(unreadNotif)) : null
        ),
        // Avatar → Profile (centralized component with DB fallback + cross-screen sync)
        React.createElement(TopBarAvatar, {
          session: props.session,
          onClick: function(){ if(props.onOpenProfile) props.onOpenProfile(); else if(props.onGoToProfile) props.onGoToProfile(); },
        })
      )
    ),
    showNotifs ? React.createElement('div', {style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:999}},
      React.createElement('div', {onClick:function(){setShowNotifs(false);}, style:{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)'}}),
      React.createElement('div', {style:{position:'absolute',top:0,left:0,right:0,background:'var(--bg)',borderBottomLeftRadius:'16px',borderBottomRightRadius:'16px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)',zIndex:1000,maxHeight:'80vh',overflowY:'auto'}},
        // R13 FIX #4: respect iOS notch / Dynamic Island so the header
        // text doesn't slide under the status bar. Replaces the padding
        // shorthand with explicit per-side props.
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'calc(16px + env(safe-area-inset-top, 0px))',paddingLeft:'18px',paddingRight:'18px',paddingBottom:'10px'}},
          React.createElement('div', {style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Notifications'),
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},
            // FIX R10-3: Clear all had no rollback — silent failure left UI
            // showing zero notifs but DB still had them; the next session
            // would resurface them, confusing the user. Snapshot + rollback.
            notifs.length>0?React.createElement('button',{onClick:function(){
              var uid=props.session&&props.session.user?props.session.user.id:null;
              if(!uid){ setNotifs([]); setUnreadNotif(0); return; }
              var snap = notifs.slice();
              var snapUnread = unreadNotif;
              setNotifs([]); setUnreadNotif(0);
              sbHome.from('notifications').delete().eq('user_id',uid).then(function(r){
                if(r && r.error){
                  console.error('[ringin] clear notifs failed:', r.error);
                  setNotifs(snap); setUnreadNotif(snapUnread);
                  try { toastError('Failed to clear — try again'); } catch(_){}
                }
              }).catch(function(e){
                console.warn('[ringin] clear notifs reject:', e);
                setNotifs(snap); setUnreadNotif(snapUnread);
                try { toastError('Failed to clear — network error'); } catch(_){}
              });
            },style:{background:'none',border:'none',color:'var(--ac)',fontSize:'12px',fontWeight:600,cursor:'pointer'}},'Clear all'):null,
            React.createElement('button',{onClick:function(){setShowNotifs(false);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'18px',cursor:'pointer'}},'✕')
          )
        ),
        notifs.length===0 ? React.createElement('div',{style:{textAlign:'center',padding:'24px',color:'var(--t2)',fontSize:'13px'}},'No notifications yet') :
        // Notification batching: collapse adjacent same-type same-target
        // notifications into a single "Alice and N others ___" line so the
        // user isn't drowning in identical-shape notifications. Reduces
        // notification fatigue per Section 6 of the research doc.
        // Grouping rule: same type AND same post_id, within ~30 min window.
        (function(){
          var BATCH_WINDOW_MS = 30 * 60 * 1000;
          var batched = [];
          for (var i = 0; i < notifs.length; i++) {
            var n = notifs[i];
            var last = batched[batched.length - 1];
            if (last && last.type === n.type && last.post_id != null && last.post_id === n.post_id) {
              var dt = Math.abs(new Date(last.created_at).getTime() - new Date(n.created_at).getTime());
              if (dt < BATCH_WINDOW_MS) {
                last._extras = (last._extras || []).concat([n]);
                if (!last.read || !n.read) last.read = false;
                continue;
              }
            }
            batched.push(Object.assign({}, n, { _extras: [] }));
          }
          // Rewrite messages for batched groups so the user sees a clean
          // "Alice and N others liked your post" instead of N rows.
          batched.forEach(function(g){
            var extras = g._extras || [];
            if (extras.length === 0) return;
            var firstName = (g.from_user_name || 'Someone');
            var verb = (g.message || '').replace(/^[^ ]+ /, ''); // drop the original sender's name from "Alice liked your post"
            g.message = firstName + ' and ' + extras.length + ' other' + (extras.length === 1 ? '' : 's') + ' ' + (verb || 'reacted to your post');
          });
          return batched;
        })().map(function(n){
          return React.createElement('div', {key:n.id, style:{display:'flex',alignItems:'flex-start',gap:'12px',padding:'12px 18px',borderTop:'1px solid var(--border)',background:!n.read?'rgba(123,110,255,0.06)':'transparent'}},
            React.createElement('div', {style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:'#fff',flexShrink:0}},
              /* FIX #6: ImgWithFallback for notification avatar */
              React.createElement(ImgWithFallback,{src:n.from_user_avatar,fallback:safeInitials(n.from_user_name||n.message||'?'),style:{width:'100%',height:'100%',objectFit:'cover'}})
            ),
            React.createElement('div', {style:{flex:1}},
              React.createElement('div', {style:{fontSize:'12px',color:'var(--text)',lineHeight:1.4,marginBottom:'3px'}}, n.message||'New notification'),
              React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)'}}, formatDateTime(n.created_at)) /* R18: timezone-aware (was raw toLocaleString) */
            ),
            !n.read ? React.createElement('div', {style:{width:'7px',height:'7px',borderRadius:'50%',background:'var(--ac)',flexShrink:0,marginTop:'4px'}}) : null
          );
        })
      )
    ) : null,
    React.createElement('div', {className:'sbwrap'},
      React.createElement('div', {className:'sbar'},
        React.createElement('input', {
          placeholder:'Search experts, skills, workshops...',
          value:searchQ,
          onChange:function(e){setSearchQ(e.target.value);},
          style:{width:'100%'}
        })
      ),
      React.createElement('div', {className:'frow'},
        React.createElement('div', {className:'ftag'+(locFilter==='all'?' on':''),onClick:function(){setLocFilter('all');}}, 'All Locations'),
        React.createElement('div', {className:'ftag'+(locFilter==='dubai'?' on':''),onClick:function(){setLocFilter('dubai');}}, 'Dubai'),
        React.createElement('div', {className:'ftag'+(locFilter==='abudhabi'?' on':''),onClick:function(){setLocFilter('abudhabi');}}, 'Abu Dhabi'),
        React.createElement('div', {className:'ftag'+(locFilter==='online'?' on':''),onClick:function(){setLocFilter('online');}}, 'Online Only')
      )
    ),
    searchQ && searchQ.trim() ? React.createElement('div',{style:{padding:'0 18px',marginBottom:'8px'}},
      searching ? React.createElement('div',{style:{textAlign:'center',padding:'20px',color:'var(--t2)',fontSize:'13px'}},'Searching...') :
      searchRes ? React.createElement('div',null,
        searchRes.users && searchRes.users.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'People'),
          searchRes.users.map(function(u,i){
            return React.createElement('div',{key:i,onClick:function(){setSearchQ('');if(props.session&&props.session.user&&u.id===props.session.user.id){if(props.onGoToProfile)props.onGoToProfile();}else{setSelectedUser(u);}},style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
              React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}},
                /* FIX #6: ImgWithFallback for people search results avatar */
                React.createElement(ImgWithFallback,{src:u.avatar_url,alt:u.full_name,fallback:safeInitials(u.full_name||u.email||'?'),style:{width:'100%',height:'100%',objectFit:'cover'}})
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},(u.full_name||u.email||'').split('@')[0]),
                React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'RingIn Member')
              ),
              (props.session&&props.session.user&&u.id===props.session.user.id) ? React.createElement('button',{
                onClick:function(ev){ev.stopPropagation();setSearchQ('');if(props.onGoToProfile)props.onGoToProfile();},
                style:{padding:'5px 12px',background:'var(--ac)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}
              }, 'View Profile')
              : React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'6px'}},
                // Message button
                React.createElement('button',{
                  onClick:function(ev){ev.stopPropagation();setSearchQ('');
                    if(props.onGoToMessages){
                      var myId=props.session&&props.session.user?props.session.user.id:null;
                      if(!myId) return;
                      var convId=[myId,u.id].sort().join('_');
                      props.onGoToMessages({id:convId,convId:convId,otherId:u.id,receiverId:u.id,name:(u.full_name||u.email||'User').split('@')[0],img:u.avatar_url||null});
                    }
                  },
                  title:'Message',
                  style:{width:'30px',height:'30px',borderRadius:'50%',background:'var(--bg4)',border:'1px solid var(--border)',color:'var(--text)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:0}
                },
                  React.createElement('svg',{viewBox:'0 0 24 24',width:'14',height:'14',fill:'none',stroke:'currentColor',strokeWidth:'2',strokeLinecap:'round',strokeLinejoin:'round'},
                    React.createElement('path',{d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'})
                  )
                ),
                // Call button
                React.createElement('button',{
                  onClick:function(ev){ev.stopPropagation();setSearchQ('');
                    var target={id:u.id,user_id:u.id,name:(u.full_name||u.email||'User').split('@')[0],img:u.avatar_url||null,role:'Member',color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',rate:30};
                    if(typeof window!=='undefined'&&window.__ringInStartCall) window.__ringInStartCall(target,{rate:30});
                  },
                  title:'Call',
                  style:{width:'30px',height:'30px',borderRadius:'50%',background:'var(--ac)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:0}
                },
                  React.createElement('svg',{viewBox:'0 0 24 24',width:'14',height:'14',fill:'none',stroke:'currentColor',strokeWidth:'2.4',strokeLinecap:'round',strokeLinejoin:'round'},
                    React.createElement('path',{d:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11L8.09 10.18a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z'})
                  )
                ),
                // Follow button
                React.createElement('button',{
                  onClick:function(ev){ev.stopPropagation();toggleFollow(String(u.id),u.full_name||u.email,u.avatar_url,'Member');},
                  style:{padding:'5px 12px',background:following[String(u.id)]?'var(--acg)':'var(--bg4)',border:'1px solid '+(following[String(u.id)]?'var(--ac)':'var(--border)'),borderRadius:'20px',color:following[String(u.id)]?'var(--ac)':'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer'}
                }, following[String(u.id)]?'✓':'+')
              )
            );
          })
        ) : null,
        searchRes.experts && searchRes.experts.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Experts'),
          searchRes.experts.map(function(e,i){
            return React.createElement('div',{key:i,onClick:function(){if(onViewExpert)onViewExpert(e);setSearchQ('');},style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
              React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0,background:e.color||'var(--ac)'}},
                /* FIX #6: ImgWithFallback for expert search result avatar */
                React.createElement(ImgWithFallback,{src:e.img,fallback:e.initials,style:{width:'100%',height:'100%',objectFit:'cover'}})
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},e.name),
                React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},e.role)
              ),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--amber)',fontWeight:600}},e.rate+' c/min')
            );
          })
        ) : null,
        searchRes.skills && searchRes.skills.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Skills'),
          React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px'}},
            searchRes.skills.map(function(s,i){
              return React.createElement('div',{key:i,style:{padding:'6px 12px',background:'var(--acg)',border:'1px solid var(--ac)',borderRadius:'20px',fontSize:'12px',color:'var(--ac)',cursor:'pointer'}},s);
            })
          )
        ) : null,
        searchRes.workshops && searchRes.workshops.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Workshops'),
          searchRes.workshops.map(function(w,i){
            return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
              React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'10px',background:'linear-gradient(135deg,#1a1a2e,#534AB7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}},'🎓'),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},w.title),
                React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'by '+w.host)
              )
            );
          })
        ) : null,
        searchRes.experts.length===0 && searchRes.users.length===0 && searchRes.skills.length===0 && searchRes.workshops.length===0 ?
          React.createElement('div',{style:{textAlign:'center',padding:'24px',color:'var(--t2)',fontSize:'13px'}},'No results for "'+searchQ+'"') : null
      ) : null
    ) : null,

    // Hidden file input — opened by the + tile in the Moments strip.
    React.createElement('input', {
      ref: momentFileRef,
      type:'file',
      accept:'image/*',
      style:{display:'none'},
      onChange: onMomentFileChosen,
    }),

    // Composer overlay (only when a file is picked & waiting to post)
    pendingMomentFile ? React.createElement(MomentComposer, {
      file: pendingMomentFile,
      onCancel: function(){ setPendingMomentFile(null); },
      onShare: postMoment,
    }) : null,

    // ── Moments — RingIn's heart-shaped Stories, Instagram-style.
    // Real user-posted moments (from Supabase) come first, then mock
    // expert moments fill out the strip for demo purposes.
    React.createElement(Moments, {
      ownAvatar: (props.session && props.session.user && (function(){ try{ return localStorage.getItem('avatar_'+props.session.user.id) || null; }catch(_){ return null; } })()) || null,
      ownName: 'Moments',
      showAdd: true,
      myUserId: currentUserId,  // T2.5 — passed through to MomentViewer for view tracking
      // Self moment (if any) goes into the "+" tile — tap it to view your
      // own slides, tap the "+" badge to add another. The strip below
      // shows OTHER users' moments + the mock experts.
      ownMoment: ownMomentForStrip,
      moments: otherRealMoments.concat((onlineExperts || []).slice(0, 8).map(function(e){
        // expertId + role carried through so the reply/like callbacks can
        // build the right chat target (mock experts use 'expert_<id>' conv IDs)
        return { id: e.id, expertId: e.id, expertRole: e.role, userName: e.name, userAvatar: e.img || null, color: e.color, hasNew: true };
      })),
      // + tile → open the hidden file input to pick a photo
      onAdd: pickMomentFile,
      // Like → drops a tiny "Liked your status" message into the chat with
      // that expert. Reply → drops "Replied to status: <quote>" + the typed
      // reply. For real users (expertId undefined) the chat write is a no-op
      // — those interactions can be wired to real DMs later.
      onLike: function(m, slide){
        if(m && m.expertId != null) writeMomentChat(m, slide, '[mlike]'+(slide && slide.text ? slide.text : (slide && slide.caption ? slide.caption : '')));
      },
      onReply: function(m, slide, text){
        if(m && m.expertId != null) writeMomentChat(m, slide, '[mreply]'+(slide && slide.text ? slide.text : (slide && slide.caption ? slide.caption : ''))+'|'+text);
      },
      onViewProfile: function(m){
        // Mock expert → open expert profile via Search tab.
        if(m && m.expertId != null){
          var exp = EXPERTS.find(function(e){ return e.id === m.expertId; });
          if(exp && onViewExpert) onViewExpert(exp);
          return;
        }
        // Real user → open their user profile view.
        if(m && m.userId && props.session && props.session.user && m.userId !== props.session.user.id){
          goToUserProfile(m.userId, { name: m.userName, avatar: m.userAvatar });
        }
      },
    }),

    React.createElement('div', {className:'sh'},
      React.createElement('div', {className:'st'}, 'Online Now'),
      React.createElement('div', {className:'sa',onClick:function(){if(props.onGoToSearch)props.onGoToSearch();},style:{cursor:'pointer'}}, 'See all')
    ),
    // NOTE: removed onMouseDown:preventDefault — it blocked vertical
    // scroll on Android Webview when user touched a card and tried to
    // swipe down. Card's onClick still navigates to the expert.
    // onTouchStart stopPropagation also removed for safety.
    React.createElement('div', {className:'esc'},
      onlineExperts.map(function(e){
        // Mock experts populate the moments strip via slice(0,8). For
        // consistency, also show the ring on those same experts in the
        // "Online Now" row — so their identity reads as "has a moment"
        // everywhere they appear, not just in the moments strip itself.
        // Real users with Supabase moments are tracked via momentUserIds.
        var mockHasMoment = onlineExperts.indexOf(e) < 8;
        var hasMoment = momentUserIds.has(e.id) || mockHasMoment;
        return React.createElement('div', {key:e.id, className:'ecsm', style:{cursor:'pointer'}, onClick:function(){goToExpert(e);}},
          React.createElement('div', {style:{position:'relative',width:'48px',height:'48px',marginBottom:'6px'}},
            React.createElement(AvatarRing, { show: hasMoment },
              React.createElement('div', {style:{width:'48px',height:'48px',borderRadius:'50%',background:e.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff'}},
                /* FIX #6: ImgWithFallback for online-experts strip avatar */
                React.createElement(ImgWithFallback,{src:e.img,alt:e.name,fallback:e.initials,style:{width:'100%',height:'100%',objectFit:'cover'}})
              )
            ),
            React.createElement('div', {style:{position:'absolute',bottom:'1px',right:'1px',width:'11px',height:'11px',borderRadius:'50%',background:'#27C96A',border:'2px solid #09090E'}})
          ),
          React.createElement('div', {style:{marginBottom:'1px'}},
            React.createElement('div', {className:'enm'}, e.name)
          ),
          React.createElement('div', {className:'erl'}, e.role),
          React.createElement('div', {style:{fontSize:'9px',color:'#F5A623',marginBottom:'5px'}}, '⭐ '+e.rating+' · '+e.rate+' c/min'),
          React.createElement('div', {style:{display:'flex',gap:'4px'}},
            // Quick-message: opens Messages tab with this expert's convo.
            // Same pattern SearchScreen uses for its expert Message button.
            React.createElement('button', {
              onClick:function(ev){
                ev.stopPropagation();
                if (props.onGoToMessages) {
                  props.onGoToMessages({id:'expert_'+e.id, name:e.name, avatar:e.img, role:e.role, online:!!e.online, rate:e.rate});
                }
              },
              title:'Message '+e.name,
              style:{flex:'0 0 28px',height:'24px',padding:0,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--t2)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}
            }, '💬'),
            React.createElement('button', {className:'cbtn', style:{flex:1}, onClick:function(ev){ev.stopPropagation();setActiveCall(e);}}, 'Call')
          )
        );
      })
    ),

    null,
    false&&WORKSHOPS.map(function(w){
      return React.createElement('div', {key:w.id, className:'wb-card'},
        React.createElement('div', {className:'wb-cover', style:{background:w.color}},
          React.createElement('div', {className:'wb-live-badge'},
            React.createElement('div', {className:'wb-live-dot'}), 'LIVE'
          ),
          React.createElement('div', {className:'wb-viewers'}, w.viewers+' viewers')
        ),
        React.createElement('div', {className:'wb-info'},
          React.createElement('div', {className:'wb-title'}, w.title),
          React.createElement('div', {className:'wb-meta'},
            React.createElement('span', {className:'wb-host'}, 'by '+w.host),
            w.free ? React.createElement('span', {className:'wb-free'}, 'FREE') : React.createElement('span', {style:{fontSize:'10px',color:'var(--ac)',background:'var(--acg)',padding:'2px 7px',borderRadius:'20px'}}, w.price+' coins')
          ),
          React.createElement('div', {className:'wb-actions'},
            React.createElement('button', {className:'wb-join', onClick:function(){setActiveLive(w);}}, 'Join Live')
          )
        )
      );
    }),
    // Feed header — labeled "Latest" so users know it's chronological,
    // not algorithm-curated. Lean into the 2026 sentiment shift away
    // from algorithmic feeds.
    React.createElement('div', {className:'sh', style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
      React.createElement('div', {className:'st'}, 'Feed'),
      React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'4px',fontSize:'10px',color:'var(--t2)',fontWeight:600,letterSpacing:'0.3px'}},
        React.createElement('span', {style:{display:'inline-block',width:'5px',height:'5px',borderRadius:'50%',background:'#27C96A'}}),
        'LATEST FIRST'
      )
    ),
    React.createElement('div', {className:'composer', onClick:function(){if(!showComp)setShowComp(true);}},
      React.createElement('div', {className:'comp-top'},
        React.createElement('div', {
          className:'comp-av',
          style:{background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}
        },
          /* FIX #6: ImgWithFallback for composer your-avatar */
          React.createElement(ImgWithFallback,{
            src: props.session&&props.session.user ? localStorage.getItem('avatar_'+props.session.user.id) : null,
            fallback: (props.session&&props.session.user&&props.session.user.email ? safeInitials(props.session.user.email) : 'Y'),
            style:{width:'100%',height:'100%',objectFit:'cover'},
          })
        ),
        showComp ?
          React.createElement('textarea', {
            className:'comp-ta',
            placeholder:"What's on your mind?",
            value:compText,
            autoFocus:true,
            onChange:function(e){setCompText(e.target.value);},
            onClick:function(e){e.stopPropagation();}
          }) :
          React.createElement('div', {
            style:{flex:1,padding:'8px 12px',fontSize:'13px',color:'var(--t3)',cursor:'pointer'}
          }, "What's on your mind?")
      ),
      showComp ? React.createElement('div',null,
        // Media type tabs
        React.createElement('div',{style:{display:'flex',gap:'0',marginBottom:'8px',borderRadius:'10px',overflow:'hidden',background:'var(--bg3)',border:'1px solid var(--border)'}},
          React.createElement('button',{
            onClick:function(){setCompMediaType('photo');setCompVideo(null);},
            style:{flex:1,padding:'7px',border:'none',background:compMediaType==='photo'?'linear-gradient(135deg,#7B6EFF,#E84D9A)':'transparent',color:compMediaType==='photo'?'#fff':'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer',transition:'all 0.2s'}
          },'🖼️ Photo / Carousel'),
          React.createElement('button',{
            onClick:function(){setCompMediaType('video');setCompImgs([]);},
            style:{flex:1,padding:'7px',border:'none',background:compMediaType==='video'?'linear-gradient(135deg,#7B6EFF,#E84D9A)':'transparent',color:compMediaType==='video'?'#fff':'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer',transition:'all 0.2s'}
          },'🎬 Video')
        ),
        // Image previews (carousel)
        compImgs.length>0 ? React.createElement('div',null,
          React.createElement('div',{style:{display:'flex',gap:'6px',padding:'0 0 8px',overflowX:'auto',paddingBottom:'8px'}},
            compImgs.map(function(img,i){
              return React.createElement('div',{key:i,style:{position:'relative',flexShrink:0,width:'80px',height:'80px',borderRadius:'8px',overflow:'hidden',border:'2px solid var(--border)'}},
                React.createElement('img',{src:img,style:{width:'100%',height:'100%',objectFit:'cover'}}),
                React.createElement('button',{
                  onClick:function(e){e.stopPropagation();setCompImgs(function(prev){return prev.filter(function(_,idx){return idx!==i;});});},
                  style:{position:'absolute',top:'2px',right:'2px',width:'18px',height:'18px',borderRadius:'50%',background:'rgba(0,0,0,0.75)',border:'none',color:'#fff',fontSize:'10px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'✕'),
                i===0?React.createElement('div',{style:{position:'absolute',bottom:'2px',left:'2px',background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:'8px',padding:'1px 4px',borderRadius:'4px'}},'Cover'):null
              );
            })
          ),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',marginBottom:'6px'}},compImgs.length+' photo'+(compImgs.length>1?'s — will show as carousel':''))
        ) : null,
        // Video preview
        compVideo ? React.createElement('div',{style:{position:'relative',marginBottom:'8px',borderRadius:'10px',overflow:'hidden',border:'2px solid var(--border)'}},
          React.createElement('video',{src:compVideo.localUrl,controls:true,playsInline:true,style:{width:'100%',maxHeight:'200px',display:'block',background:'#000',objectFit:'contain'}}),
          compVideo.uploading?React.createElement('div',{style:{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'13px',fontWeight:600}},'⏳ Uploading video...'):null,
          React.createElement('button',{
            onClick:function(){setCompVideo(null);},
            style:{position:'absolute',top:'6px',right:'6px',width:'22px',height:'22px',borderRadius:'50%',background:'rgba(0,0,0,0.75)',border:'none',color:'#fff',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}},'✕')
        ) : null,
        // Upload progress
        uploadingMedia&&!compVideo?React.createElement('div',{style:{padding:'8px',textAlign:'center',color:'var(--t3)',fontSize:'12px'}},'⏳ Uploading photos...'):null,
        compEmoji ? React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',padding:'8px 0',borderTop:'1px solid var(--border)'}},
          EMOJIS.map(function(em){
            return React.createElement('span',{key:em,onClick:function(){playEmojiClick();setCompText(function(t){return t+em;});},style:{fontSize:'22px',cursor:'pointer',padding:'2px'}},em);
          })
        ) : null,
        React.createElement('div', {className:'comp-btns'},
          React.createElement('div', {className:'comp-att'},
            compMediaType==='photo'?React.createElement('label',{className:'comp-att-btn',style:{cursor:'pointer',opacity:compImgs.length>=10?0.5:1}},
              '🖼️ '+(compImgs.length===0?'Add Photo':'Add More'),
              React.createElement('input',{type:'file',accept:'image/*',multiple:true,style:{display:'none'},disabled:compImgs.length>=10,onChange:function(e){handleImageUpload(e.target.files);}})
            ):React.createElement('label',{className:'comp-att-btn',style:{cursor:'pointer',opacity:compVideo?0.5:1}},
              '🎬 '+(compVideo?'Change Video':'Add Video'),
              React.createElement('input',{type:'file',accept:'video/*',style:{display:'none'},disabled:!!compVideo,onChange:function(e){if(e.target.files[0])handleVideoUpload(e.target.files[0]);}})
            ),
            React.createElement('div',{className:'comp-att-btn',style:{cursor:'pointer'},onClick:function(){setCompEmoji(function(v){return !v;});}},compEmoji?'😊 Hide':'😊 Emoji'),
            React.createElement('div',{className:'comp-att-btn',style:{cursor:'pointer'},onClick:function(){setShowComp(false);setCompText('');setCompImgs([]);setCompVideo(null);setCompEmoji(false);}},'✕ Cancel'),
            // ── Audience selector chip (T2.3) ──
            React.createElement('div',{style:{position:'relative'}},
              React.createElement('div',{className:'comp-att-btn',style:{cursor:'pointer'},onClick:function(){setCompAudienceMenu(function(v){return !v;});}},
                (compAudience==='public'?'🌐 Public':compAudience==='followers'?'👥 Followers':'🔒 Only me')+' ▾'
              ),
              compAudienceMenu ? React.createElement('div',{style:{position:'absolute',bottom:'calc(100% + 4px)',left:0,background:'var(--bg2,#161028)',border:'1px solid var(--border)',borderRadius:'10px',padding:'4px',boxShadow:'0 6px 20px rgba(0,0,0,0.4)',zIndex:50,minWidth:'180px'}},
                [['public','🌐','Public','Anyone signed in can see'],['followers','👥','Followers','Only people who follow you'],['private','🔒','Only me','Drafts / personal notes']].map(function(opt){
                  var active=compAudience===opt[0];
                  return React.createElement('div',{key:opt[0],onClick:function(){setCompAudience(opt[0]);setCompAudienceMenu(false);},style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',borderRadius:'6px',cursor:'pointer',background:active?'rgba(123,110,255,0.12)':'transparent'}},
                    React.createElement('span',{style:{fontSize:'16px'}},opt[1]),
                    React.createElement('div',{style:{flex:1}},
                      React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--text)'}},opt[2]),
                      React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},opt[3])
                    ),
                    active?React.createElement('span',{style:{color:'var(--ac)',fontWeight:700}},'✓'):null
                  );
                })
              ) : null
            )
          ),
          React.createElement('button', {
            className:'comp-post-btn',
            disabled:posting||uploadingMedia||(compVideo&&compVideo.uploading),
            onClick:submitPost
          }, posting?'Posting...':(uploadingMedia||(compVideo&&compVideo.uploading)?'Uploading...':'Post'))
        )
      ) : null
    ),
    loading ? React.createElement('div',{style:{padding:'0'}},
      [0,1,2].map(function(i){
        return React.createElement('div',{key:i,style:{margin:'0 0 2px',padding:'16px',background:'var(--bg2)',borderBottom:'1px solid var(--border)'}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}},
            React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:'var(--bg3)',animation:'shimmer 1.4s ease-in-out infinite'}}),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{height:'12px',borderRadius:'6px',background:'var(--bg3)',width:'40%',marginBottom:'6px',animation:'shimmer 1.4s ease-in-out infinite'}}),
              React.createElement('div',{style:{height:'10px',borderRadius:'6px',background:'var(--bg3)',width:'25%',animation:'shimmer 1.4s ease-in-out infinite'}})
            )
          ),
          React.createElement('div',{style:{height:'14px',borderRadius:'6px',background:'var(--bg3)',width:'90%',marginBottom:'8px',animation:'shimmer 1.4s ease-in-out infinite'}}),
          React.createElement('div',{style:{height:'14px',borderRadius:'6px',background:'var(--bg3)',width:'70%',animation:'shimmer 1.4s ease-in-out infinite'}})
        );
      })
    ) : null,
    // Hashtag filter banner — appears when user tapped a tag chip.
    selectedTag ? React.createElement('div', {
      style:{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--acg, rgba(123,110,255,0.08))',borderBottom:'1px solid var(--border)'}
    },
      React.createElement('div', {style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}}, 'Showing #' + selectedTag),
      React.createElement('button', {
        onClick:function(){ setSelectedTag(null); },
        style:{background:'transparent',border:'1px solid var(--border)',borderRadius:'14px',padding:'4px 10px',fontSize:'11px',color:'var(--t2)',cursor:'pointer',fontFamily:'inherit'}
      }, '× Clear filter')
    ) : null,
    React.createElement('div', {style:{padding:'0'}},
      // R17 FIX #3 + #5: feed is wrapped in an outer IIFE so we can branch on
      // length===0 → empty-state. Mirrors the userPosts empty-state pattern
      // at ~line 619-621. Hashtag-filtered empty produces a tag-specific msg.
      (function(){
      // Optional hashtag filter applied client-side. When selectedTag is null,
      // the full feed renders unchanged.
      var feedArr = (function(){
        var src = selectedTag
          ? posts.filter(function(p){ return Array.isArray(p.tags) && p.tags.indexOf(selectedTag) >= 0; })
          : posts.slice();
        // Audience filter (server has audience column; client enforces visibility too).
        // 'public' → everyone | 'followers' → only follower-of-author | 'only_me' → only author
        src = src.filter(function(p){
          var aud = p.audience || 'public';
          if (aud === 'public') return true;
          if (!currentUserId) return false;
          if (p.userId === currentUserId) return true;
          if (aud === 'followers') return !!(following && following[p.userId]);
          if (aud === 'only_me') return false;
          return true;
        });
        // R15 FIX #1: hide posts whose author the current user has blocked.
        // Uses the cached Set from blocks.js (warmed at App level) so this is O(1).
        src = src.filter(function(p){ return !isBlockedSync(p.userId || p.user_id); });
        // Diversity cap: stop the same author from dominating the feed via
        // 4+ consecutive posts. Pulls a same-author run > 3 down past the
        // next available different-author post. Preserves overall ordering;
        // only swaps adjacent runs. (Not a full re-rank — chronological
        // remains the dominant signal, this just breaks up clumps.)
        // Skipped while a hashtag filter is active (the user's intent is
        // explicit there).
        if (!selectedTag) {
          var run = 0; var lastAuthor = null;
          for (var i = 0; i < src.length; i++) {
            var aid = src[i].userId || src[i].user_id || src[i].expertId;
            if (aid === lastAuthor) {
              run += 1;
              if (run >= 3) {
                // Look ahead for the next post by a different author and
                // swap it up. Cap the search window so we don't waste cycles.
                var swapWith = -1;
                for (var j = i + 1; j < Math.min(i + 8, src.length); j++) {
                  var aj = src[j].userId || src[j].user_id || src[j].expertId;
                  if (aj !== aid) { swapWith = j; break; }
                }
                if (swapWith > 0) {
                  var tmp = src[i + 1];
                  src[i + 1] = src[swapWith];
                  src[swapWith] = tmp;
                  // Reset run count after the swap-in.
                  run = 0;
                  lastAuthor = src[i + 1].userId || src[i + 1].user_id || src[i + 1].expertId;
                  continue;
                }
              }
            } else {
              run = 1;
              lastAuthor = aid;
            }
          }
        }
        return src;
      })();
      // R17 FIX #3 + #5: empty-state branches. Style mirrors userPosts at
      // line ~619-621. Tag-specific copy when a hashtag filter is on.
      if (feedArr.length === 0) {
        if (selectedTag) {
          return React.createElement('div',{style:{textAlign:'center',padding:'40px',color:'var(--t2)'}},
            React.createElement('div',{style:{fontSize:'30px',marginBottom:'8px'}},'#'),
            React.createElement('div',{style:{fontSize:'13px'}},'No posts tagged #'+selectedTag+' yet — be the first to post.')
          );
        }
        return React.createElement('div',{style:{textAlign:'center',padding:'40px',color:'var(--t2)'}},
          React.createElement('div',{style:{fontSize:'30px',marginBottom:'8px'}},'📝'),
          React.createElement('div',{style:{fontSize:'13px'}},'No posts in your feed yet — follow some experts or check back later.')
        );
      }
      return feedArr.map(function(p){
        var commentsArr=commentsCache[p.id]||[];
        return React.createElement('div', {key:p.id, className:'fpost'},
          React.createElement('div', {className:'ph', style:{position:'relative'}},
            // Post author avatar — wrapped with AvatarRing so it shows the
            // moments halo when the author has posted a moment in the last 24h.
            React.createElement(AvatarRing, { show: momentUserIds.has(p.userId) },
              React.createElement('div', {
                className:'pav',
                style:{background:p.color, cursor:'pointer', overflow:'hidden', padding:0},
                onClick:function(){p.expertId ? goToExpertById(p.expertId) : goToUserProfile(p.userId, {name:p.name, avatar:p.img});}
              }, p.img ? React.createElement('img',{src:p.img,alt:p.name,style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}) : p.initials)
            ),
            React.createElement('div', null,
              React.createElement('div', {
                className:'pn',
                style:{cursor:'pointer'},
                onClick:function(){p.expertId ? goToExpertById(p.expertId) : goToUserProfile(p.userId, {name:p.name, avatar:p.img});}
              }, p.name),
              React.createElement('div', {className:'pt'}, p.createdAt?timeAgo(p.createdAt):(p.time||''))
            ),
            React.createElement('button',{
              onClick:function(e){e.stopPropagation();setPostMenu(postMenu===p.id?null:p.id);},
              style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',position:'absolute',right:'0',top:'4px'}
            },'⋯')
          ),
          (function(){
            var allImgs = p.postImg ? [p.postImg].concat(p.extraImgs||[]) : [];
            var cidx = carouselIdx[p.id]||0;
            function openDetail(e){e.stopPropagation();loadComments(p.id);setPostDetail(p);setPostDetailIdx(cidx);}
            // Video — 16:9 container, contain so nothing is cut
            if(p.video_url){
              return React.createElement('div',{style:{width:'100%',aspectRatio:'16/9',background:'#000',overflow:'hidden'}},
                React.createElement('video',{src:p.video_url,controls:true,playsInline:true,preload:'metadata',style:{width:'100%',height:'100%',objectFit:'contain',display:'block'}})
              );
            }
            if(allImgs.length===0) return null;
            // Single image — PostImage auto-measures ratio, clamps 4:5 ↔ 1.91:1, covers perfectly
            if(allImgs.length===1){
              return React.createElement(PostImage,{src:allImgs[0],onClick:openDetail});
            }
            // Carousel — PostImage for current slide, nav controls overlay
            return React.createElement('div',{style:{position:'relative'}},
              React.createElement(PostImage,{src:allImgs[cidx],onClick:openDetail}),
              cidx>0?React.createElement('button',{
                onClick:function(e){e.stopPropagation();setCarouselIdx(function(prev){var m=Object.assign({},prev);m[p.id]=cidx-1;return m;});},
                style:{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,0.55)',border:'none',color:'#fff',borderRadius:'50%',width:'32px',height:'32px',fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}
              },'‹'):null,
              cidx<allImgs.length-1?React.createElement('button',{
                onClick:function(e){e.stopPropagation();setCarouselIdx(function(prev){var m=Object.assign({},prev);m[p.id]=cidx+1;return m;});},
                style:{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,0.55)',border:'none',color:'#fff',borderRadius:'50%',width:'32px',height:'32px',fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}
              },'›'):null,
              React.createElement('div',{style:{position:'absolute',bottom:'10px',left:'50%',transform:'translateX(-50%)',display:'flex',gap:'5px',zIndex:2}},
                allImgs.map(function(_,di){return React.createElement('div',{key:di,style:{width:di===cidx?'18px':'6px',height:'6px',borderRadius:'3px',background:di===cidx?'#fff':'rgba(255,255,255,0.45)',transition:'all 0.2s'}});})
              ),
              React.createElement('div',{style:{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:'11px',padding:'2px 8px',borderRadius:'10px',zIndex:2}},(cidx+1)+'/'+allImgs.length)
            );
          })(),
          React.createElement('div', {className:'pb'},
            React.createElement('div', {className:'ptxt'}, p.text),
            React.createElement('div', null,
              p.tags.map(function(t){return React.createElement('span', {key:t, className:'ptag', onClick:function(e){e.stopPropagation();setSelectedTag(t);try{window.scrollTo({top:0,behavior:'smooth'});}catch(_){}}, style:{cursor:'pointer'}}, '#'+t);})
            )
          ),
          p.rate&&p.rate>0&&p.expertId ? React.createElement('div', {className:'cstrip'},
            React.createElement('span', {className:'cstrip-l'}, 'Call '+p.name),
            React.createElement('span', {className:'cstrip-r'}, p.rate+' coins/min')
          ) : null,
          React.createElement('div', {className:'pacts'},
            React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',flex:1}},
            React.createElement('button',{className:'pa'+(p.liked?' liked':''),onClick:function(){toggleLike(p.id);},style:{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',padding:'8px 2px',fontSize:'13px',fontWeight:p.liked?700:400}},
              React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22'},
                p.liked?React.createElement('defs',null,React.createElement('linearGradient',{id:'lg'+p.id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},React.createElement('stop',{offset:'0%',stopColor:'#5B4FD4'}),React.createElement('stop',{offset:'100%',stopColor:'#C4347A'}))):null,
                React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:p.liked?'url(#lg'+p.id+')':'none',stroke:p.liked?'none':'var(--t2)',strokeWidth:'2'})
              ),
              React.createElement('span',{onClick:function(e){openLikersPopup(e,p);},style:{color:p.liked?'#B44FE8':'var(--t2)',cursor:p.likes>0?'pointer':'default'}},
                hideLikes ? (p.likes > 0 ? 'Liked' : '0 Likes') : (p.likes + ' Likes')
              )
            )
          ),
            React.createElement('button', {className:'pa', onClick:function(){
              var newOpen=openComments===p.id?null:p.id;
              setOpenComments(newOpen);
              if(newOpen) loadComments(newOpen);
            }}, '💬 '+(commentsCache[p.id]?commentsCache[p.id].length:p.comments||0)),
            React.createElement('button', {className:'pa', onClick:function(){
              var url='https://ring-in.vercel.app/post/'+p.id;
              if(navigator.share){navigator.share({title:'Check this out on RingIn',text:(p.text||'').substring(0,100),url:url}).catch(function(){});}
              else{copyToClipboardWithToast(url,'🔗 Link copied to clipboard');}
            }}, '↗ Share')
          ),
          // Comment section
          openComments===p.id?React.createElement('div',{style:{borderTop:'1px solid var(--border)',background:'var(--bg4)'}},
            React.createElement('div',{style:{maxHeight:'360px',overflowY:'auto',padding:'8px 12px'}},
              commentsArr.length===0?React.createElement('div',{style:{textAlign:'center',padding:'12px',color:'var(--t3)',fontSize:'12px'}},'No comments yet. Be the first!'):
              renderCommentThread(buildCommentTree(commentsArr),0,{
                likes:commentLikes,
                setLikes:setCommentLikes,
                onReply:function(c){setReplyingTo(c);setCommentInput('@'+(c.user_name||'User')+' ');},
                collapsed:collapsedThreads,
                setCollapsed:setCollapsedThreads,
                timeAgo:timeAgoUtil
              })
            ),
            replyingTo?React.createElement('div',{style:{padding:'2px 12px 0',fontSize:'12px',color:'var(--ac)',display:'flex',alignItems:'center',gap:'6px'}},
              'Replying to @'+(replyingTo.user_name||'User'),
              React.createElement('button',{onClick:function(){setReplyingTo(null);setCommentInput('');},style:{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'14px',padding:'0'}},'✕')
            ):null,
            React.createElement('div',{style:{display:'flex',gap:'8px',padding:'8px 12px',borderTop:'1px solid var(--border)'}},
              React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                currentUserAvatar?React.createElement('img',{src:currentUserAvatar,style:{width:'100%',height:'100%',objectFit:'cover'}}):safeInitials(currentUserName) /* FIX #10 */
              ),
              React.createElement('input',{
                value:commentInput,
                onChange:function(e){setCommentInput(e.target.value);clearTimeout(typingTimerRef.current);typingTimerRef.current=setTimeout(function(){playKeyClick();},80);},
                onKeyDown:function(e){if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && commentInput.trim()){submitComment(p.id,commentInput);}}, /* FIX #2: IME composition guard */
                placeholder:'Write a comment...',
                style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
              }),
              React.createElement('button',{
                onClick:function(){if(commentInput.trim()){playPostSound();submitComment(p.id,commentInput);}},
                style:{padding:'6px 14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
              },'Send')
            )
          ):null
        );
      });
      })()
    ),
    // Auto-load sentinel — IntersectionObserver (managed via FIX #4
    // useEffect above) triggers loadMoreFeed() as soon as this div enters
    // the viewport. Element ref binds the sentinel; effect handles
    // observer lifecycle.
    hasMoreH ? React.createElement('div',{
      ref: sentinelRef,
      style:{textAlign:'center',padding:'16px 0'}
    },
      React.createElement('div',{style:{display:'inline-flex',alignItems:'center',gap:'8px',color:'var(--t2)',fontSize:'12px'}},
        React.createElement('div',{style:{width:'14px',height:'14px',borderRadius:'50%',border:'2px solid var(--ac)',borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}),
        'Loading more posts…'
      )
    ) : null,
    React.createElement('div', {style:{height:'12px'}}),
    showEditPost&&editPostData ? React.createElement('div',{
      onClick:function(){setShowEditPost(false);setEditPostData(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:10000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'16px',width:'320px',padding:'20px',boxShadow:'0 8px 40px rgba(0,0,0,0.4)'}},
        React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)',marginBottom:'14px'}},'Edit Post'),
        React.createElement('textarea',{
          value:editPostData.content,
          onChange:function(ev){setEditPostData(function(prev){return Object.assign({},prev,{content:ev.target.value});});},
          style:{width:'100%',minHeight:'100px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',fontSize:'14px',color:'var(--text)',resize:'vertical',outline:'none',fontFamily:'DM Sans,sans-serif',boxSizing:'border-box'}
        }),
        React.createElement('div',{style:{display:'flex',gap:'10px',marginTop:'14px',justifyContent:'flex-end'}},
          React.createElement('button',{onClick:function(){setShowEditPost(false);setEditPostData(null);},style:{padding:'8px 18px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'13px',cursor:'pointer',fontWeight:500}},'Cancel'),
          React.createElement('button',{onClick:saveEditPost,style:{padding:'8px 18px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'13px',cursor:'pointer',fontWeight:600}},'Save')
        )
      )
    ) : null
  );
}
