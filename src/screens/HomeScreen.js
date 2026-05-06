import React,{useState,useEffect,useRef} from 'react';
import {useFollow} from './useFollow';
import {createClient} from '@supabase/supabase-js';
var sbHome = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
import '../styles/HomeScreen.css';
import CallScreen from './CallScreen';
import LiveWorkshopScreen from './LiveWorkshopScreen';

var CATS=[{id:'all',icon:'All',label:'All'},{id:'medical',icon:'Med',label:'Medical'},{id:'tech',icon:'Tech',label:'Tech'},{id:'legal',icon:'Law',label:'Legal'},{id:'trades',icon:'Fix',label:'Trades'},{id:'mental',icon:'Mind',label:'Mental'}];
var EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,category:'medical',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine.',tags:['General Medicine','Preventive Care'],img:'https://i.pravatar.cc/150?img=47'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,category:'tech',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google alumni.',tags:['System Design','React'],img:'https://i.pravatar.cc/150?img=12'},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,category:'mental',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience.',tags:['Career Strategy','LinkedIn'],img:'https://i.pravatar.cc/150?img=23'},{id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,calls:389,followers:'1.8k',online:true,category:'legal',color:'linear-gradient(135deg,#B8860B,#FFD700)',cover:'linear-gradient(135deg,#2e2200,#B8860B)',loc:'Dubai, UAE',bio:'Senior lawyer with 12 years in UAE corporate law.',tags:['Corporate Law','Contracts'],img:'https://i.pravatar.cc/150?img=33'},{id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,calls:521,followers:'2.7k',online:true,category:'mental',color:'linear-gradient(135deg,#9B59B6,#D98EF0)',cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)',loc:'Abu Dhabi',bio:'Clinical psychologist specializing in anxiety and stress.',tags:['Anxiety','CBT','Stress'],img:'https://i.pravatar.cc/150?img=44'},{id:6,initials:'JT',name:'James Tanner',role:'Fitness & Nutrition Coach',rate:50,rating:4.7,calls:298,followers:'4.1k',online:true,category:'mental',color:'linear-gradient(135deg,#E8401A,#FF6B35)',cover:'linear-gradient(135deg,#2e0a00,#E8401A)',loc:'Remote',bio:'Certified personal trainer and nutritionist.',tags:['Weight Loss','Nutrition','Fitness'],img:'https://i.pravatar.cc/150?img=15'}];
var WORKSHOPS=[{id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},{id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'}];

function timeAgoUtil(dateStr){
  if(!dateStr) return '';
  var now=new Date();
  var str=dateStr.toString();
  if(!str.includes('Z')&&!str.includes('+')) str=str+'Z';
  var date=new Date(str);
  var diff=Math.floor((now-date)/1000);
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<172800) return 'Yesterday';
  return date.toLocaleDateString([],{month:'short',day:'numeric'});
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

  // Comments state
  var openCommentsUS=useState(null); var openCommentsU=openCommentsUS[0]; var setOpenCommentsU=openCommentsUS[1];
  var commentsCacheUS=useState({}); var commentsCacheU=commentsCacheUS[0]; var setCommentsCacheU=commentsCacheUS[1];
  var commentInputUS=useState(''); var commentInputU=commentInputUS[0]; var setCommentInputU=commentInputUS[1];
  var commentLoadingUS=useState(false); var commentLoadingU=commentLoadingUS[0]; var setCommentLoadingU=commentLoadingUS[1];

  // Post menu state
  var postMenuUS=useState(null); var postMenuU=postMenuUS[0]; var setPostMenuU=postMenuUS[1];

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
    var userName=session&&session.user?session.user.email.split('@')[0]:'User';
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
    setCommentsCacheU(function(prev){
      var cur=(prev[postId]||[]).concat([newComment]);
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
      if(res.data&&res.data[0]){
        setCommentsCacheU(function(prev){
          var cur=(prev[postId]||[]).map(function(c){return c.id===newComment.id?res.data[0]:c;});
          try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
          return Object.assign({},prev,{[postId]:cur});
        });
        // Persist count to DB
        sbHome.from('comments').select('id',{count:'exact',head:true}).eq('post_id',postId).then(function(r){
          if(r.count!==null) sbHome.from('posts').update({comments_count:r.count}).eq('id',postId).then(function(){});
        });
      }
    });
  }

  function toggleLikeU(pid){
    if(!currentUserId) return;
    setUserPosts(function(prev){
      return prev.map(function(p){
        if(p.id!==pid) return p;
        var newLiked=!p.liked;
        var newLikedByIds=newLiked?[currentUserId].concat(p.likedByIds||[]):(p.likedByIds||[]).filter(function(id){return id!==currentUserId;});
        return Object.assign({},p,{liked:newLiked,likes:newLiked?p.likes+1:Math.max(0,p.likes-1),likedByIds:newLikedByIds});
      });
    });
    sbHome.rpc('toggle_like',{post_id:pid,user_id:currentUserId}).then(function(r){
      if(r.error){
        setUserPosts(function(prev){return prev.map(function(p){if(p.id!==pid)return p;var rev=!p.liked;return Object.assign({},p,{liked:rev,likes:rev?p.likes+1:Math.max(0,p.likes-1)});});});
      }
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
        // Preload comment counts from localStorage cache
        var cmap={};
        mapped.forEach(function(p){try{var c=localStorage.getItem('comments_'+p.id);if(c)cmap[p.id]=JSON.parse(c);}catch(e){} });
        if(Object.keys(cmap).length) setCommentsCacheU(cmap);
      }
    });
  },[user.id]);

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
  var initials = displayName.substring(0,2).toUpperCase();

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto',position:'relative'}},
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
                av?React.createElement('img',{src:av,alt:nm,style:{width:'100%',height:'100%',objectFit:'cover'}}):nm.substring(0,2).toUpperCase()
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
          var items=isOwn?[
            {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenuU(null);if(window.confirm('Delete this post?')){sbHome.from('posts').delete().eq('id',p.id).then(function(){});setUserPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});}}},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied!');setPostMenuU(null);}},
            {icon:'✏️',label:'Edit Post',fn:function(){alert('Edit coming soon');setPostMenuU(null);}},
            {icon:'🔕',label:'Turn off notifications',fn:function(){alert('Notifications paused');setPostMenuU(null);}}
          ]:[
            {icon:'🔖',label:'Save Post',fn:function(){try{var s=JSON.parse(localStorage.getItem('saved_posts')||'[]');s.push(p.id);localStorage.setItem('saved_posts',JSON.stringify(s));}catch(e){}alert('Post saved!');setPostMenuU(null);}},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied!');setPostMenuU(null);}},
            {icon:'➕',label:(props.following&&props.following[p.userId]?'✓ Unfollow ':'Follow ')+displayName,fn:function(){props.toggleFollow(p.userId,displayName,avatarUrl,'RingIn Member');setPostMenuU(null);}},
            {icon:'😶',label:'Not interested',fn:function(){setUserPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});setPostMenuU(null);}},
            {icon:'🚩',label:'Report',red:true,fn:function(){alert('Thank you for reporting. We\'ll review this post.');setPostMenuU(null);}}
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
      React.createElement('button',{onClick:props.onBack,style:{position:'absolute',top:'12px',left:'12px',background:'rgba(0,0,0,0.45)',border:'none',borderRadius:'20px',color:'#fff',padding:'5px 14px',cursor:'pointer',fontSize:'12px',fontWeight:600,zIndex:3}},'< Back'),
      React.createElement('div',{
        onClick:function(){if(avatarUrl)setShowAvatarBigU(true);},
        style:{position:'absolute',bottom:'-40px',left:'18px',width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',overflow:'hidden',zIndex:4,cursor:avatarUrl?'pointer':'default'}},
        avatarUrl?React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}):initials
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
            var convo={id:convId,convId:convId,name:displayName,role:'RingIn Member',color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:avatarUrl,initials:initials};
            if(props.onGoToMessages) props.onGoToMessages(convo);
          },
          style:{padding:'8px 16px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--text)',fontSize:'13px',fontWeight:600,cursor:'pointer'}
        },'Message')
      )
    ),
    // Posts heading
    React.createElement('div',{style:{padding:'4px 18px 10px',borderTop:'1px solid var(--border)',marginTop:'8px'}},
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
            React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
              pAvatar?React.createElement('img',{src:pAvatar,alt:displayName,style:{width:'100%',height:'100%',objectFit:'cover'}}):initials
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
          // Post image
          p.img?React.createElement('img',{src:p.img,alt:'post',style:{width:'100%',height:'220px',objectFit:'cover',display:'block'}}):null,
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
                React.createElement('span',{onClick:function(e){e.stopPropagation();if((p.likedByIds||[]).length>0){setShowLikersU(p.id);}},style:{cursor:(p.likedByIds||[]).length>0?'pointer':'default'}},(Array.isArray(p.likedByIds)?p.likedByIds.length:p.likes)+' Like')
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
                if(navigator.share){navigator.share({title:'Check this out on RingIn',text:p.text.substring(0,100),url:url});}
                else{try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied to clipboard!');}
              },
              style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
            },'↗ Share')
          ),
          // Comment section
          openCommentsU===p.id?React.createElement('div',{style:{borderTop:'1px solid var(--border)',background:'var(--bg4)'}},
            React.createElement('div',{style:{maxHeight:'200px',overflowY:'auto',padding:'8px 12px'}},
              commentsArr.length===0?React.createElement('div',{style:{textAlign:'center',padding:'12px',color:'var(--t3)',fontSize:'12px'}},'No comments yet. Be the first!'):
              commentsArr.map(function(c){
                return React.createElement('div',{key:c.id,style:{display:'flex',gap:'8px',marginBottom:'10px'}},
                  React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                    c.user_avatar?React.createElement('img',{src:c.user_avatar,alt:c.user_name,style:{width:'100%',height:'100%',objectFit:'cover'}}):(c.user_name||'?').substring(0,2).toUpperCase()
                  ),
                  React.createElement('div',{style:{flex:1}},
                    React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:'6px'}},
                      React.createElement('span',{style:{fontSize:'12px',fontWeight:700,color:'var(--text)'}},(c.user_name||'User')),
                      React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.created_at?timeAgoUtil(c.created_at):'')
                    ),
                    React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.4,marginTop:'2px'}},c.text)
                  )
                );
              })
            ),
            React.createElement('div',{style:{display:'flex',gap:'8px',padding:'8px 12px',borderTop:'1px solid var(--border)'}},
              React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                currentUserId&&localStorage.getItem('avatar_'+currentUserId)?React.createElement('img',{src:localStorage.getItem('avatar_'+currentUserId),style:{width:'100%',height:'100%',objectFit:'cover'}}):(session&&session.user?session.user.email.substring(0,2).toUpperCase():'?')
              ),
              React.createElement('input',{
                value:commentInputU,
                onChange:function(e){setCommentInputU(e.target.value);},
                onKeyDown:function(e){if(e.key==='Enter'&&commentInputU.trim()){submitCommentU(p.id,commentInputU);}},
                placeholder:'Write a comment...',
                style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
              }),
              React.createElement('button',{
                onClick:function(){if(commentInputU.trim())submitCommentU(p.id,commentInputU);},
                style:{padding:'6px 14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
              },'Send')
            )
          ):null
        );
      })
    )
  );
}

export default function HomeScreen(props){
  var acState = useState('all');
  var _cachedPosts=[];try{var _c=localStorage.getItem('feed_posts_cache');if(_c)_cachedPosts=JSON.parse(_c);}catch(e){}
  var postsS=useState(_cachedPosts.length>0?_cachedPosts:[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',time:'2m ago',text:'Fever above 38.5C for more than 3 days needs medical attention. Stay hydrated and consult a doctor.',tags:['Health','Medical'],likes:47,comments:12,rate:120,expertId:1,img:'https://i.pravatar.cc/150?img=47',postImg:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',time:'15m ago',text:'The best code is code you do not write. Simplicity is the ultimate sophistication in engineering.',tags:['Tech','Engineering'],likes:93,comments:28,rate:80,expertId:2,img:'https://i.pravatar.cc/150?img=12',postImg:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80'}]);
  var posts=postsS[0]; var setPosts=postsS[1];

  // Comments state
  var openCommentsS=useState(null); var openComments=openCommentsS[0]; var setOpenComments=openCommentsS[1];
  var commentsCacheS=useState({}); var commentsCache=commentsCacheS[0]; var setCommentsCache=commentsCacheS[1];
  var commentInputS=useState(''); var commentInput=commentInputS[0]; var setCommentInput=commentInputS[1];
  var commentLoadingS=useState(false); var commentLoading=commentLoadingS[0]; var setCommentLoading=commentLoadingS[1];

  // Post menu state
  var postMenuS=useState(null); var postMenu=postMenuS[0]; var setPostMenu=postMenuS[1];

  var currentUserId = props.session&&props.session.user ? props.session.user.id : null;
  var currentUserName = props.session&&props.session.user ? props.session.user.email.split('@')[0] : null;
  var currentUserAvatar = currentUserId ? localStorage.getItem('avatar_'+currentUserId) : null;

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
    var newComment={
      id:Date.now()+'_local',
      post_id:postId,
      user_id:currentUserId,
      user_name:currentUserName,
      user_avatar:currentUserAvatar,
      text:text.trim(),
      created_at:new Date().toISOString(),
      likes:[]
    };
    setCommentsCache(function(prev){
      var cur=(prev[postId]||[]).concat([newComment]);
      try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
      return Object.assign({},prev,{[postId]:cur});
    });
    setCommentInput('');
    setPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:(p.comments||0)+1}):p;});});
    sbHome.from('comments').insert({
      post_id:postId,
      user_id:currentUserId,
      user_name:currentUserName,
      user_avatar:currentUserAvatar||null,
      text:text.trim()
    }).select().then(function(res){
      if(res.data&&res.data[0]){
        setCommentsCache(function(prev){
          var cur=(prev[postId]||[]).map(function(c){return c.id===newComment.id?res.data[0]:c;});
          try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
          return Object.assign({},prev,{[postId]:cur});
        });
        // Persist count to DB
        sbHome.from('comments').select('id',{count:'exact',head:true}).eq('post_id',postId).then(function(r){
          if(r.count!==null) sbHome.from('posts').update({comments_count:r.count}).eq('id',postId).then(function(){});
        });
      }
    });
  }

  function toggleLike(pid){
    var session = props.session;
    var userId = session&&session.user ? session.user.id : null;
    var userName = session&&session.user ? session.user.email.split("@")[0] : "Someone";
    var userAvatar = userId ? localStorage.getItem("avatar_"+userId) : null;
    if(!userId) return;
    if(typeof pid !== "string") return;
    var postOwner = null;
    setPosts(function(prev){
      return prev.map(function(p){
        if(p.id!==pid) return p;
        postOwner = p;
        var newLiked = !p.liked;
        var newLikes = newLiked ? p.likes+1 : Math.max(0,p.likes-1);
        var newLikedBy = newLiked ? [userName].concat(p.likedBy||[]) : (p.likedBy||[]).filter(function(n){return n!==userName;});
        var newLikedByIds = newLiked ? [userId].concat(p.likedByIds||[]) : (p.likedByIds||[]).filter(function(id){return id!==userId;});
        return Object.assign({},p,{liked:newLiked,likes:newLikes,likedBy:newLikedBy,likedByIds:newLikedByIds});
      });
    });
    sbHome.rpc("toggle_like",{post_id:pid,user_id:userId}).then(function(r){
      if(r.error){console.log("like error:",r.error);
        setPosts(function(prev){return prev.map(function(p){if(p.id!==pid)return p;return Object.assign({},p,{liked:!p.liked,likes:p.liked?p.likes+1:Math.max(0,p.likes-1)});});});
        return;
      }
      if(postOwner&&!postOwner.liked&&postOwner.userId&&postOwner.userId!==userId){
        sbHome.from("notifications").insert([{user_id:postOwner.userId,from_user_id:userId,from_user_name:userName,from_user_avatar:userAvatar,type:"like",message:userName+" liked your post",post_id:pid,read:false}]).then(function(){});
      }
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
  var showNotifsS=useState(false); var showNotifs=showNotifsS[0]; var setShowNotifs=showNotifsS[1];
  var compImgsS=useState([]); var compImgs=compImgsS[0]; var setCompImgs=compImgsS[1];
  var postingS=useState(false); var posting=postingS[0]; var setPosting=postingS[1];
  var showCompS=useState(false); var showComp=showCompS[0]; var setShowComp=showCompS[1];
  var compEmojiS=useState(false); var compEmoji=compEmojiS[0]; var setCompEmoji=compEmojiS[1];
  var fileInputRef=useRef(null);
  var EMOJIS=['😊','😂','❤️','🔥','👍','🙌','😍','🤔','👏','🎉','💪','✨','🚀','💡','🎯','😎','🙏','💯','😅','🤣'];
  useEffect(function(){
    if(!currentUserId||!currentUserName) return;
    setLikersNames(function(prev){
      if(prev[currentUserId]) return prev;
      var m=Object.assign({},prev);
      m[currentUserId]={name:currentUserName,avatar:currentUserAvatar};
      return m;
    });
  },[currentUserId]);
  useEffect(function(){
    if(!props.session||!props.session.user) return;
    var uid = props.session.user.id;
    sbHome.from('notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(20).then(function(res){
      if(res.data){
        setNotifs(res.data);
        setUnreadNotif(res.data.filter(function(n){return !n.read;}).length);
      }
    });
    var ch = sbHome.channel('notifs-'+uid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+uid},function(p){
        setNotifs(function(prev){return [p.new].concat(prev);});
        setUnreadNotif(function(n){return n+1;});
      }).subscribe();
    return function(){sbHome.removeChannel(ch);};
  },[props.session]);

  function loadMoreFeed(){
    if(loadMoreH||!hasMoreH) return;
    setLoadMoreH(true);
    var realPosts = posts.filter(function(p){return typeof p.id==='string';});
    var oldest = realPosts[realPosts.length-1];
    var oldestDate = oldest&&oldest.createdAt?oldest.createdAt:new Date().toISOString();
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
      initials:(p.user_name||'?').substring(0,2).toUpperCase(),
      name:p.user_name||'User',
      role:'RingIn Member',
      color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
      img:p.user_avatar||null,
      time:new Date(p.created_at).toLocaleString(),
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
      isUserPost:true
    };
  }

  useEffect(function(){
    sbHome.from('posts').select('*').order('created_at',{ascending:false}).limit(12).then(function(res){
      if(res.data&&res.data.length>0){
        var dbPosts = res.data.map(mapPost);
        setPosts(function(prev){return dbPosts.concat(prev.filter(function(p){return typeof p.id === 'number';}));});
        setHasMoreH(res.data.length===12);
        try{localStorage.setItem('feed_posts_cache',JSON.stringify(dbPosts));}catch(e){}
        prefetchLikerNames(dbPosts, {});
        // Preload comment counts from localStorage cache
        var cmap={};
        dbPosts.forEach(function(p){try{var c=localStorage.getItem('comments_'+p.id);if(c)cmap[p.id]=JSON.parse(c);}catch(e){} });
        if(Object.keys(cmap).length) setCommentsCache(cmap);
      }
    });
    var ch = sbHome.channel('public-posts')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'posts'},function(p){
        var session = props.session;
        var userId = session&&session.user?session.user.id:null;
        var likesArr = Array.isArray(p.new.likes)?p.new.likes:[];
        setPosts(function(prev){
          return prev.map(function(post){
            if(post.id!==p.new.id) return post;
            return Object.assign({},post,{
              likes:likesArr.length,
              liked:userId?likesArr.includes(userId):post.liked
            });
          });
        });
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'posts'},function(p){
        var newPost = mapPost(p.new);
        setPosts(function(prev){
          if(prev.find(function(pp){return pp.id===newPost.id;})) return prev;
          return [newPost].concat(prev);
        });
      }).subscribe();
    return function(){sbHome.removeChannel(ch);};
  },[]);
  var followHook = useFollow(sbHome, currentUserId);
  var following = followHook.following;
  var toggleFollow = followHook.toggleFollow;
  var searchQS=useState(''); var searchQ=searchQS[0]; var setSearchQ=searchQS[1];
  var searchResS=useState(null); var searchRes=searchResS[0]; var setSearchRes=searchResS[1];
  var searchingS=useState(false); var searching=searchingS[0]; var setSearching=searchingS[1];
  var selUserS=useState(null); var selectedUser=selUserS[0]; var setSelectedUser=selUserS[1];
  var supabase = props.supabase;

  var ALL_EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,img:'https://i.pravatar.cc/150?img=47',type:'expert'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,img:'https://i.pravatar.cc/150?img=12',type:'expert'},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,img:'https://i.pravatar.cc/150?img=23',type:'expert'},{id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,img:'https://i.pravatar.cc/150?img=33',type:'expert'},{id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,img:'https://i.pravatar.cc/150?img=44',type:'expert'},{id:6,initials:'JT',name:'James Tanner',role:'Fitness Coach',rate:50,rating:4.7,img:'https://i.pravatar.cc/150?img=15',type:'expert'}];
  var ALL_SKILLS=['React Development','System Design','Career Planning','Public Speaking','Python','Machine Learning','Digital Marketing','UI/UX Design','Financial Planning','Legal Consulting'];
  var ALL_WORKSHOPS=[{title:'How to Crack Google Interview',host:'Ravi Menon'},{title:'Managing Anxiety in 2026',host:'Dr. Layla Khalid'}];

  function doSearch(q){
    if(!q||!q.trim()){setSearchRes(null);return;}
    setSearching(true);
    var ql = q.toLowerCase();
    var experts = ALL_EXPERTS.filter(function(e){return e.name.toLowerCase().includes(ql)||e.role.toLowerCase().includes(ql);});
    var skills = ALL_SKILLS.filter(function(s){return s.toLowerCase().includes(ql);});
    var workshops = ALL_WORKSHOPS.filter(function(w){return w.title.toLowerCase().includes(ql)||w.host.toLowerCase().includes(ql);});
    if(supabase){
      supabase.from('profiles').select('*').or('email.ilike.%'+q+'%,full_name.ilike.%'+q+'%').then(function(res){
        var users = res.data||[];
        setSearchRes({experts:experts,skills:skills,workshops:workshops,users:users});
        setSearching(false);
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
  var NOTIFS=[
    {id:1,icon:'📞',text:'Dr. Priya Nair accepted your call request',time:'2m ago',unread:true},
    {id:2,icon:'🪙',text:'You received 50 bonus coins! Limited offer.',time:'15m ago',unread:true},
    {id:3,icon:'❤️',text:'Ravi Menon liked your post',time:'1h ago',unread:true},
    {id:4,icon:'💬',text:'Sara Al Zaabi commented on your post',time:'2h ago',unread:false},
    {id:5,icon:'🎓',text:'New workshop: Crack Google Interview — starts in 1 hour',time:'3h ago',unread:false},
    {id:6,icon:'⭐',text:'You have a new review from a recent call',time:'Yesterday',unread:false},
  ];
  var onOpenWallet2 = props.onOpenWallet;
  function timeAgo(dateStr){
    if(!dateStr) return '';
    var now = new Date();
    var str = dateStr.toString();
    if(!str.includes('Z') && !str.includes('+')) str = str + 'Z';
    var date = new Date(str);
    var diff = Math.floor((now - date) / 1000);
    if(diff < 60) return 'Just now';
    if(diff < 3600) return Math.floor(diff/60) + 'm ago';
    if(diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if(diff < 172800) return 'Yesterday';
    return date.toLocaleDateString([],{month:'short',day:'numeric'});
  }

  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:50,onCoinsChange:function(){},onEnd:function(){setActiveCall(null);}});
  if(activeLive) return React.createElement(LiveWorkshopScreen,{workshop:activeLive,onLeave:function(){setActiveLive(null);}});
  var fe = ac==='all' ? EXPERTS : EXPERTS.filter(function(e){return e.category===ac;});
  var onlineExperts = fe.filter(function(e){return e.online===true;});

  function submitPost(){
    if(!compText.trim()&&compImgs.length===0){alert('Write something or add a photo!');return;}
    var session = props.session;
    if(!session||!session.user){alert('Please log in to post');return;}
    setPosting(true);
    var tags = compText.match(/#[a-zA-Z0-9]+/g)||[];
    var postData = {
      user_id: session.user.id,
      user_name: session.user.email.split('@')[0],
      user_avatar: localStorage.getItem('avatar_'+session.user.id)||null,
      text: compText,
      images: compImgs,
      tags: tags.map(function(t){return t.replace('#','');}),
      likes: [],
      comments_count: 0
    };
    sbHome.from('posts').insert([postData]).select().then(function(res){
      if(res.data&&res.data[0]){
        sbHome.from('follows').select('follower_id').eq('following_id',session.user.id).then(function(fres){
          if(fres.data&&fres.data.length>0){
            var notifPromises = fres.data.map(function(f){
              return sbHome.from('notification_settings').select('notify_posts').eq('user_id',f.follower_id).eq('following_id',session.user.id).single().then(function(ns){
                if(!ns.data||ns.data.notify_posts!==false){
                  return sbHome.from('notifications').insert([{
                    user_id:f.follower_id,
                    from_user_id:session.user.id,
                    from_user_name:postData.user_name,
                    from_user_avatar:postData.user_avatar,
                    type:'new_post',
                    message:postData.user_name+' posted: '+postData.text.substring(0,50)+(postData.text.length>50?'...':''),
                    post_id:res.data[0].id,
                    read:false
                  }]);
                }
              });
            });
          }
        });
      }
      if(res.error){alert('Failed to post: '+res.error.message);setPosting(false);return;}
      if(res.data&&res.data[0]){
        var newPost = {
          id:res.data[0].id,
          userId:session.user.id,
          initials:(postData.user_name||'?').substring(0,2).toUpperCase(),
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
          isUserPost:true
        };
        setPosts(function(prev){return [newPost].concat(prev);});
      }
      setCompText('');
      setCompImgs([]);
      setShowComp(false);
      setPosting(false);
    });
  }

  function handleImageUpload(files){
    if(!files||files.length===0) return;
    var newImgs = [];
    var remaining = files.length;
    Array.from(files).forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(e){
        newImgs.push(e.target.result);
        remaining--;
        if(remaining===0){
          setCompImgs(function(prev){return prev.concat(newImgs);});
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function goToExpert(expert){
    if(onViewExpert) onViewExpert(expert);
  }

  function goToExpertById(id){
    var exp = EXPERTS.find(function(e){return e.id===id;});
    if(exp && onViewExpert) onViewExpert(exp);
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

  return React.createElement('div', {className:'hc'},
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
                React.createElement('div',{
                  onClick:function(){setShowLikers(null);goToUserProfile(uid,{name:name,avatar:av});},
                  style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',cursor:'pointer'}
                },
                  av?React.createElement('img',{src:av,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}):name.substring(0,2).toUpperCase()
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
            {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenu(null);if(window.confirm('Delete this post?')){sbHome.from('posts').delete().eq('id',p.id).then(function(){});setPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});}}},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied!');setPostMenu(null);}},
            {icon:'✏️',label:'Edit Post',fn:function(){alert('Edit coming soon');setPostMenu(null);}},
            {icon:'🔕',label:'Turn off notifications',fn:function(){alert('Notifications paused');setPostMenu(null);}}
          ]:[
            {icon:'🔖',label:'Save Post',fn:function(){try{var s=JSON.parse(localStorage.getItem('saved_posts')||'[]');s.push(p.id);localStorage.setItem('saved_posts',JSON.stringify(s));}catch(e){}alert('Post saved!');setPostMenu(null);}},
            {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied!');setPostMenu(null);}},
            {icon:'➕',label:(following[p.userId]?'✓ Unfollow ':'Follow ')+p.name,fn:function(){toggleFollow(p.userId,p.name,p.img,'RingIn Member');setPostMenu(null);}},
            {icon:'😶',label:'Not interested',fn:function(){setPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});setPostMenu(null);}},
            {icon:'🚩',label:'Report',red:true,fn:function(){alert('Thank you for reporting. We\'ll review this post.');setPostMenu(null);}}
          ];
          return items.map(function(item,i){
            return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.07)':'none',cursor:'pointer'}},
              React.createElement('span',{style:{fontSize:'14px',fontWeight:500,color:item.red?'#ff453a':'rgba(255,255,255,0.9)'}},item.label)
            );
          });
        })()
      )
    ) : null,
    React.createElement('div', {className:'topbar'},
      React.createElement('div', {className:'brand'}, 'RingIn'),
      React.createElement('div', {className:'tbr'},
        React.createElement('div', {className:'wchip', onClick:function(){if(onOpenWallet)onOpenWallet();}, style:{cursor:'pointer'}},
          React.createElement('div', {className:'wc'}, 'C'),
          React.createElement('span', null, '1,240')
        ),
        React.createElement('div', {className:'ibt', onClick:function(){
          setShowNotifs(!showNotifs);
          if(!showNotifs&&props.session&&props.session.user){
            sbHome.from('notifications').update({read:true}).eq('user_id',props.session.user.id).eq('read',false).then(function(){});
            setUnreadNotif(0);
          }
        }, style:{cursor:'pointer',position:'relative'}},
          React.createElement('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'var(--t2)',strokeWidth:2,width:15,height:15},
            React.createElement('path', {d:'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'})
          ),
          unreadNotif>0 ? React.createElement('div', {className:'nd', style:{background:'#ef4444',minWidth:'14px',height:'14px',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',color:'#fff',top:'3px',right:'3px',padding:'0 2px'}}, unreadNotif>9?'9+':String(unreadNotif)) : React.createElement('div',{className:'nd'})
        )
      )
    ),
    showNotifs ? React.createElement('div', {style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:999}},
      React.createElement('div', {onClick:function(){setShowNotifs(false);}, style:{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)'}}),
      React.createElement('div', {style:{position:'absolute',top:0,left:0,right:0,background:'var(--bg)',borderBottomLeftRadius:'16px',borderBottomRightRadius:'16px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)',zIndex:1000,maxHeight:'80vh',overflowY:'auto'}},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px 10px'}},
          React.createElement('div', {style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Notifications'),
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},
            notifs.length>0?React.createElement('button',{onClick:function(){var uid=props.session&&props.session.user?props.session.user.id:null;if(uid)sbHome.from('notifications').delete().eq('user_id',uid).then(function(){});setNotifs([]);setUnreadNotif(0);},style:{background:'none',border:'none',color:'var(--ac)',fontSize:'12px',fontWeight:600,cursor:'pointer'}},'Clear all'):null,
            React.createElement('button',{onClick:function(){setShowNotifs(false);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'18px',cursor:'pointer'}},'✕')
          )
        ),
        notifs.length===0 ? React.createElement('div',{style:{textAlign:'center',padding:'24px',color:'var(--t2)',fontSize:'13px'}},'No notifications yet') :
        notifs.map(function(n){
          return React.createElement('div', {key:n.id, style:{display:'flex',alignItems:'flex-start',gap:'12px',padding:'12px 18px',borderTop:'1px solid var(--border)',background:!n.read?'rgba(123,110,255,0.06)':'transparent'}},
            React.createElement('div', {style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:'#fff',flexShrink:0}},
              n.from_user_avatar ? React.createElement('img',{src:n.from_user_avatar,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (n.from_user_name||'?').substring(0,2).toUpperCase()
            ),
            React.createElement('div', {style:{flex:1}},
              React.createElement('div', {style:{fontSize:'12px',color:'var(--text)',lineHeight:1.4,marginBottom:'3px'}}, n.message||'New notification'),
              React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)'}}, new Date(n.created_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))
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
        React.createElement('div', {className:'ftag on'}, 'All Locations'),
        React.createElement('div', {className:'ftag'}, 'Dubai'),
        React.createElement('div', {className:'ftag'}, 'Abu Dhabi'),
        React.createElement('div', {className:'ftag'}, 'Online Only')
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
                u.avatar_url ? React.createElement('img',{src:u.avatar_url,alt:u.full_name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (u.full_name||u.email||'?').substring(0,2).toUpperCase()
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},(u.full_name||u.email||'').split('@')[0]),
                React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'RingIn Member')
              ),
              React.createElement('button',{onClick:function(ev){ev.stopPropagation();if(props.session&&props.session.user&&u.id===props.session.user.id){setSearchQ('');if(props.onGoToProfile)props.onGoToProfile();}else{toggleFollow(String(u.id),u.full_name||u.email,u.avatar_url,'Member');}},style:{padding:'5px 12px',background:following[String(u.id)]?'var(--acg)':'var(--ac)',border:following[String(u.id)]?'1px solid var(--ac)':'none',borderRadius:'20px',color:following[String(u.id)]?'var(--ac)':'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}}, props.session&&props.session.user&&u.id===props.session.user.id ? 'View Profile' : (following[String(u.id)]?'Following':'+Follow'))
            );
          })
        ) : null,
        searchRes.experts && searchRes.experts.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Experts'),
          searchRes.experts.map(function(e,i){
            return React.createElement('div',{key:i,onClick:function(){if(onViewExpert)onViewExpert(e);setSearchQ('');},style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
              React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0,background:e.color||'var(--ac)'}},
                e.img ? React.createElement('img',{src:e.img,style:{width:'100%',height:'100%',objectFit:'cover'}}) : e.initials
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
    React.createElement('div', {className:'sh'},
      React.createElement('div', {className:'st'}, 'Categories'),
      React.createElement('div', {className:'sa'}, 'See all')
    ),
    React.createElement('div', {className:'cats'},
      CATS.map(function(c){
        return React.createElement('div', {key:c.id, className:'cp'+(ac===c.id?' on':''), onClick:function(){setAc(c.id);}},
          React.createElement('div', {className:'ci'}, c.icon),
          React.createElement('div', {className:'cl'}, c.label)
        );
      })
    ),
    React.createElement('div', {className:'sh'},
      React.createElement('div', {className:'st'}, 'Online Now'),
      React.createElement('div', {className:'sa'}, 'See all')
    ),
    React.createElement('div', {className:'esc', onTouchStart:function(ev){ev.stopPropagation();}, onMouseDown:function(ev){ev.preventDefault&&ev.preventDefault();}},
      onlineExperts.map(function(e){
        return React.createElement('div', {key:e.id, className:'ecsm', style:{cursor:'pointer'}, onClick:function(){goToExpert(e);}},
          React.createElement('div', {style:{position:'relative',width:'48px',height:'48px',marginBottom:'6px'}},
            React.createElement('div', {style:{width:'48px',height:'48px',borderRadius:'50%',background:e.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff'}},
              e.img ? React.createElement('img',{src:e.img,alt:e.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : e.initials
            ),
            React.createElement('div', {style:{position:'absolute',bottom:'1px',right:'1px',width:'11px',height:'11px',borderRadius:'50%',background:'#27C96A',border:'2px solid #09090E'}})
          ),
          React.createElement('div', {style:{marginBottom:'1px'}},
            React.createElement('div', {className:'enm'}, e.name)
          ),
          React.createElement('div', {className:'erl'}, e.role),
          React.createElement('div', {style:{fontSize:'9px',color:'#F5A623',marginBottom:'5px'}}, '⭐ '+e.rating+' · '+e.rate+' c/min'),
          React.createElement('button', {className:'cbtn', onClick:function(ev){ev.stopPropagation();setActiveCall(e);}}, 'Call Now')
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
    React.createElement('div', {className:'sh'},
      React.createElement('div', {className:'st'}, 'Feed')
    ),
    React.createElement('div', {className:'composer', onClick:function(){if(!showComp)setShowComp(true);}},
      React.createElement('div', {className:'comp-top'},
        React.createElement('div', {
          className:'comp-av',
          style:{background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}
        },
          props.session&&props.session.user&&localStorage.getItem('avatar_'+props.session.user.id) ?
            React.createElement('img',{src:localStorage.getItem('avatar_'+props.session.user.id),style:{width:'100%',height:'100%',objectFit:'cover'}}) :
            (props.session&&props.session.user ? props.session.user.email.substring(0,2).toUpperCase() : 'Y')
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
        compImgs.length>0 ? React.createElement('div',{style:{display:'flex',gap:'6px',padding:'0 0 8px',flexWrap:'wrap'}},
          compImgs.map(function(img,i){
            return React.createElement('div',{key:i,style:{position:'relative',width:'70px',height:'70px',borderRadius:'8px',overflow:'hidden'}},
              React.createElement('img',{src:img,style:{width:'100%',height:'100%',objectFit:'cover'}}),
              React.createElement('button',{
                onClick:function(){setCompImgs(function(prev){return prev.filter(function(_,idx){return idx!==i;});});},
                style:{position:'absolute',top:'2px',right:'2px',width:'18px',height:'18px',borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',fontSize:'10px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'✕')
            );
          })
        ) : null,
        compEmoji ? React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',padding:'8px 0',borderTop:'1px solid var(--border)'}},
          EMOJIS.map(function(em){
            return React.createElement('span',{key:em,onClick:function(){setCompText(function(t){return t+em;});setCompEmoji(false);},style:{fontSize:'22px',cursor:'pointer',padding:'2px'}},em);
          })
        ) : null,
        React.createElement('div', {className:'comp-btns'},
          React.createElement('div', {className:'comp-att'},
            React.createElement('label',{className:'comp-att-btn',style:{cursor:'pointer'}},
              '🖼️ Photo',
              React.createElement('input',{type:'file',accept:'image/*',multiple:true,style:{display:'none'},onChange:function(e){handleImageUpload(e.target.files);}})
            ),
            React.createElement('label',{className:'comp-att-btn',style:{cursor:'pointer'}},
              '📎 File',
              React.createElement('input',{type:'file',style:{display:'none'},onChange:function(e){if(e.target.files[0])alert('File sharing coming soon!');}})
            ),
            React.createElement('div',{className:'comp-att-btn',style:{cursor:'pointer'},onClick:function(){setCompEmoji(function(v){return !v;});}},compEmoji?'😊 Hide':'😊 Emoji'),
            React.createElement('div',{className:'comp-att-btn',style:{cursor:'pointer'},onClick:function(){setShowComp(false);setCompText('');setCompImgs([]);setCompEmoji(false);}},'✕ Cancel')
          ),
          React.createElement('button', {
            className:'comp-post-btn',
            disabled:posting,
            onClick:submitPost
          }, posting?'Posting...':'Post')
        )
      ) : null
    ),
    React.createElement('div', {style:{padding:'0'}},
      posts.map(function(p){
        var commentsArr=commentsCache[p.id]||[];
        return React.createElement('div', {key:p.id, className:'fpost'},
          React.createElement('div', {className:'ph', style:{position:'relative'}},
            React.createElement('div', {
              className:'pav',
              style:{background:p.color, cursor:'pointer', overflow:'hidden', padding:0},
              onClick:function(){p.expertId ? goToExpertById(p.expertId) : goToUserProfile(p.userId, {name:p.name, avatar:p.img});}
            }, p.img ? React.createElement('img',{src:p.img,alt:p.name,style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}) : p.initials),
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
          p.postImg ? React.createElement('img',{src:p.postImg,alt:'post',style:{width:'100%',height:'280px',objectFit:'cover',display:'block'}}) : null,
          React.createElement('div', {className:'pb'},
            React.createElement('div', {className:'ptxt'}, p.text),
            React.createElement('div', null,
              p.tags.map(function(t){return React.createElement('span', {key:t, className:'ptag'}, '#'+t);})
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
              React.createElement('span',{onClick:function(e){openLikersPopup(e,p);},style:{color:p.liked?'#B44FE8':'var(--t2)',cursor:p.likes>0?'pointer':'default'}},p.likes,' Likes')
            )
          ),
            React.createElement('button', {className:'pa', onClick:function(){
              var newOpen=openComments===p.id?null:p.id;
              setOpenComments(newOpen);
              if(newOpen) loadComments(newOpen);
            }}, '💬 '+(commentsCache[p.id]?commentsCache[p.id].length:p.comments||0)),
            React.createElement('button', {className:'pa', onClick:function(){
              var url='https://ring-in.vercel.app/post/'+p.id;
              if(navigator.share){navigator.share({title:'Check this out on RingIn',text:(p.text||'').substring(0,100),url:url});}
              else{try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied to clipboard!');}
            }}, '↗ Share')
          ),
          // Comment section
          openComments===p.id?React.createElement('div',{style:{borderTop:'1px solid var(--border)',background:'var(--bg4)'}},
            React.createElement('div',{style:{maxHeight:'200px',overflowY:'auto',padding:'8px 12px'}},
              commentsArr.length===0?React.createElement('div',{style:{textAlign:'center',padding:'12px',color:'var(--t3)',fontSize:'12px'}},'No comments yet. Be the first!'):
              commentsArr.map(function(c){
                return React.createElement('div',{key:c.id,style:{display:'flex',gap:'8px',marginBottom:'10px'}},
                  React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                    c.user_avatar?React.createElement('img',{src:c.user_avatar,alt:c.user_name,style:{width:'100%',height:'100%',objectFit:'cover'}}):(c.user_name||'?').substring(0,2).toUpperCase()
                  ),
                  React.createElement('div',{style:{flex:1}},
                    React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:'6px'}},
                      React.createElement('span',{style:{fontSize:'12px',fontWeight:700,color:'var(--text)'}},(c.user_name||'User')),
                      React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.created_at?timeAgoUtil(c.created_at):'')
                    ),
                    React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.4,marginTop:'2px'}},c.text)
                  )
                );
              })
            ),
            React.createElement('div',{style:{display:'flex',gap:'8px',padding:'8px 12px',borderTop:'1px solid var(--border)'}},
              React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                currentUserAvatar?React.createElement('img',{src:currentUserAvatar,style:{width:'100%',height:'100%',objectFit:'cover'}}):(currentUserName||'?').substring(0,2).toUpperCase()
              ),
              React.createElement('input',{
                value:commentInput,
                onChange:function(e){setCommentInput(e.target.value);},
                onKeyDown:function(e){if(e.key==='Enter'&&commentInput.trim()){submitComment(p.id,commentInput);}},
                placeholder:'Write a comment...',
                style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
              }),
              React.createElement('button',{
                onClick:function(){if(commentInput.trim())submitComment(p.id,commentInput);},
                style:{padding:'6px 14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
              },'Send')
            )
          ):null
        );
      })
    ),
    hasMoreH ? React.createElement('div',{style:{textAlign:'center',padding:'16px 0'}},
      React.createElement('button',{
        onClick:loadMoreFeed,
        style:{padding:'10px 28px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'13px',cursor:'pointer',fontWeight:500}
      }, loadMoreH?'Loading...':'Load more posts')
    ) : null,
    React.createElement('div', {style:{height:'12px'}})
  );
}
