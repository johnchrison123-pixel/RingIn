/* eslint-disable */
import React,{useState,useEffect} from 'react';
import {useFollow} from './useFollow';
import {createClient} from '@supabase/supabase-js';
var sbProfile = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

export default function ProfileScreen({session, supabase, onOpenWallet}){
  var email = session && session.user ? session.user.email : '';
  var initials = email ? email.substring(0,2).toUpperCase() : 'ME';
  var userId = session && session.user ? session.user.id : null;

  var settingsS=useState(false); var showSettings=settingsS[0]; var setShowSettings=settingsS[1];
  var tabS=useState('posts'); var activeTab=tabS[0]; var setActiveTab=tabS[1];
  var rateS=useState(0); var rateVal=rateS[0]; var setRateVal=rateS[1];
  var rateDoneS=useState(false); var rateDone=rateDoneS[0]; var setRateDone=rateDoneS[1];
  var showRateS=useState(false); var showRate=showRateS[0]; var setShowRate=showRateS[1];
  var avatarS=useState(null); var avatarUrl=avatarS[0]; var setAvatarUrl=avatarS[1];
  var coverS=useState(null); var coverUrl=coverS[0]; var setCoverUrl=coverS[1];
  var uploadingS=useState(false); var uploading=uploadingS[0]; var setUploading=uploadingS[1];
  var followHook = useFollow(sbProfile, userId);
  var following = followHook.following;
  var toggleFollow = followHook.toggleFollow;
  var avatarMenuS=useState(false); var showAvatarMenu=avatarMenuS[0]; var setShowAvatarMenu=avatarMenuS[1];
  var avatarViewS=useState(false); var showAvatarView=avatarViewS[0]; var setShowAvatarView=avatarViewS[1];
  var adjustS=useState(false); var showAdjust=adjustS[0]; var setShowAdjust=adjustS[1];
  var adjustImgS=useState(null); var adjustImg=adjustImgS[0]; var setAdjustImg=adjustImgS[1];
  var offsetS=useState({x:0,y:0}); var offset=offsetS[0]; var setOffset=offsetS[1];
  var draggingS=useState(false); var dragging=draggingS[0]; var setDragging=draggingS[1];
  var dragStartS=useState({x:0,y:0}); var dragStart=dragStartS[0]; var setDragStart=dragStartS[1];
  var showCoverAdjustS=useState(false); var showCoverAdjust=showCoverAdjustS[0]; var setShowCoverAdjust=showCoverAdjustS[1];
  var coverAdjustImgS=useState(null); var coverAdjustImg=coverAdjustImgS[0]; var setCoverAdjustImg=coverAdjustImgS[1];
  var coverOffsetS=useState({x:0,y:0}); var coverOffset=coverOffsetS[0]; var setCoverOffset=coverOffsetS[1];
  var coverDraggingS=useState(false); var coverDragging=coverDraggingS[0]; var setCoverDragging=coverDraggingS[1];
  var coverDragStartS=useState({x:0,y:0}); var coverDragStart=coverDragStartS[0]; var setCoverDragStart=coverDragStartS[1];
  var coverImgNatS=useState({w:1,h:1}); var coverImgNat=coverImgNatS[0]; var setCoverImgNat=coverImgNatS[1];
  var coverUserScaleS=useState(1); var coverUserScale=coverUserScaleS[0]; var setCoverUserScale=coverUserScaleS[1];
  var coverPinchDistS=useState(0); var coverPinchDist=coverPinchDistS[0]; var setCoverPinchDist=coverPinchDistS[1];
  var coverPinchScaleStartS=useState(1); var coverPinchScaleStart=coverPinchScaleStartS[0]; var setCoverPinchScaleStart=coverPinchScaleStartS[1];
  var postTextS=useState(''); var postText=postTextS[0]; var setPostText=postTextS[1];
  var showEmojiS=useState(false); var showEmoji=showEmojiS[0]; var setShowEmoji=showEmojiS[1];
  var showEditProfileS=useState(false); var showEditProfile=showEditProfileS[0]; var setShowEditProfile=showEditProfileS[1];
  var editNameS=useState(''); var editName=editNameS[0]; var setEditName=editNameS[1];
  var editTagS=useState(''); var editTag=editTagS[0]; var setEditTag=editTagS[1];
  var editAboutS=useState(''); var editAbout=editAboutS[0]; var setEditAbout=editAboutS[1];
  var editWebsiteNameS=useState(''); var editWebsiteName=editWebsiteNameS[0]; var setEditWebsiteName=editWebsiteNameS[1];
  var editWebsiteUrlS=useState(''); var editWebsiteUrl=editWebsiteUrlS[0]; var setEditWebsiteUrl=editWebsiteUrlS[1];
  var _cachedPInfo={}; try{var _cp=localStorage.getItem('profile_info_'+(session&&session.user?session.user.id:''));if(_cp)_cachedPInfo=JSON.parse(_cp);}catch(e){}
  var profileInfoS=useState(_cachedPInfo.name?_cachedPInfo:{name:'',tag:'',about:'',website_name:'',website_url:''}); var profileInfo=profileInfoS[0]; var setProfileInfo=profileInfoS[1];
  var savingEditS=useState(false); var savingEdit=savingEditS[0]; var setSavingEdit=savingEditS[1];
  var _cachedMyPosts=[];try{var _cmp=localStorage.getItem('my_posts_cache_'+(session&&session.user?session.user.id:''));if(_cmp){var _raw=JSON.parse(_cmp);var _uid2=session&&session.user?session.user.id:null;_cachedMyPosts=_raw.map(function(p){var la=Array.isArray(p.likes)?p.likes:(Array.isArray(p.likedByIds)?p.likedByIds:[]);return Object.assign({},p,{liked:_uid2?la.includes(_uid2):false,likes:la,likedByIds:la});});}}catch(e){}
  var postsS=useState(_cachedMyPosts); var myPosts=postsS[0]; var setMyPosts=postsS[1];
  var showLikersProfS=useState(null); var showLikersProf=showLikersProfS[0]; var setShowLikersProf=showLikersProfS[1];
  var likersNamesProfS=useState({}); var likersNamesProf=likersNamesProfS[0]; var setLikersNamesProf=likersNamesProfS[1];
  var openCommentsProfS=useState(null); var openCommentsProf=openCommentsProfS[0]; var setOpenCommentsProf=openCommentsProfS[1];
  var commentsCacheProfS=useState({}); var commentsCacheProf=commentsCacheProfS[0]; var setCommentsCacheProf=commentsCacheProfS[1];
  var commentInputProfS=useState(''); var commentInputProf=commentInputProfS[0]; var setCommentInputProf=commentInputProfS[1];
  var postMenuProfS=useState(null); var postMenuProf=postMenuProfS[0]; var setPostMenuProf=postMenuProfS[1];

  function prefetchLikerNamesProf(postsArr, existingNames){
    var allIds=[];
    postsArr.forEach(function(p){
      (p.likes||[]).forEach(function(id){
        if(typeof id==='string'&&id.length>10&&!existingNames[id]&&allIds.indexOf(id)<0) allIds.push(id);
      });
    });
    if(allIds.length===0) return;
    sbProfile.from('profiles').select('id,full_name,email,avatar_url').in('id',allIds).then(function(res){
      if(res.data&&res.data.length>0){
        var map={};
        res.data.forEach(function(u){map[u.id]={name:u.full_name||(u.email||'').split('@')[0],avatar:u.avatar_url};});
        setLikersNamesProf(function(prev){return Object.assign({},prev,map);});
      }
    });
  }

  function openLikersPopupProf(e,p){
    e.stopPropagation();
    if(!p||!p.likes||p.likes.length===0) return;
    if(showLikersProf===p.id){setShowLikersProf(null);return;}
    setShowLikersProf(p.id);
  }

  function loadCommentsProf(postId){
    var cached=null;
    try{var c=localStorage.getItem('comments_'+postId);if(c)cached=JSON.parse(c);}catch(e){}
    if(cached) setCommentsCacheProf(function(prev){return Object.assign({},prev,{[postId]:cached});});
    sbProfile.from('comments').select('*').eq('post_id',postId).order('created_at',{ascending:true}).then(function(res){
      if(res.data){
        setCommentsCacheProf(function(prev){return Object.assign({},prev,{[postId]:res.data});});
        try{localStorage.setItem('comments_'+postId,JSON.stringify(res.data));}catch(e){}
      }
    });
  }

  function submitCommentProf(postId,text){
    if(!text.trim()||!userId) return;
    var userName=email.split('@')[0];
    var userAvatar=avatarUrl||null;
    var newComment={
      id:Date.now()+'_local',
      post_id:postId,
      user_id:userId,
      user_name:userName,
      user_avatar:userAvatar,
      text:text.trim(),
      created_at:new Date().toISOString(),
      likes:[]
    };
    setCommentsCacheProf(function(prev){
      var cur=(prev[postId]||[]).concat([newComment]);
      try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
      return Object.assign({},prev,{[postId]:cur});
    });
    setCommentInputProf('');
    setMyPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:(p.comments||0)+1}):p;});});
    sbProfile.from('comments').insert({
      post_id:postId,
      user_id:userId,
      user_name:userName,
      user_avatar:userAvatar,
      text:text.trim()
    }).select().then(function(res){
      if(res.data&&res.data[0]){
        setCommentsCacheProf(function(prev){
          var cur=(prev[postId]||[]).map(function(c){return c.id===newComment.id?res.data[0]:c;});
          try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
          return Object.assign({},prev,{[postId]:cur});
        });
      }
    });
  }

  var EMOJIS=['😊','😂','❤️','🔥','👏','🎉','💪','🙌','😍','🤔','👍','✨','🚀','💡','🎯'];
  var FRIENDS=[
    {initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',img:'https://i.pravatar.cc/150?img=47'},
    {initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',img:'https://i.pravatar.cc/150?img=12'},
    {initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',img:'https://i.pravatar.cc/150?img=23'},
  ];
  var SKILLS=[
    {label:'React Development',level:80},
    {label:'System Design',level:65},
    {label:'Career Planning',level:90},
    {label:'Public Speaking',level:55},
  ];
  var REVIEWS=[
    {name:'Ahmed K.',text:'Great session, very helpful!',rating:5,time:'2 days ago',img:'https://i.pravatar.cc/150?img=33'},
    {name:'Fatima M.',text:'Learned a lot from this call.',rating:4,time:'1 week ago',img:'https://i.pravatar.cc/150?img=44'},
  ];

  useEffect(function(){
    if(!userId) return;
    sbProfile.from('profiles').select('full_name,bio').eq('id',userId).single().then(function(res){
      if(res.data){
        var name = res.data.full_name || email.split('@')[0];
        var bio = res.data.bio || '';
        var parsed = {name:name,tag:'',about:'',website_name:'',website_url:''};
        try{ var j=JSON.parse(bio); if(j&&typeof j==='object'){parsed.about=j.about||'';parsed.tag=j.tag||'';parsed.website_name=j.website_name||j.website||'';parsed.website_url=j.website_url||'';} }catch(e){ parsed.about=bio; }
        setProfileInfo(parsed);
        try{localStorage.setItem('profile_info_'+userId,JSON.stringify(parsed));}catch(e){}
      }
    });
  },[userId]);

  function openEditProfile(){
    setEditName(profileInfo.name||email.split('@')[0]);
    setEditTag(profileInfo.tag||'');
    setEditAbout(profileInfo.about||'');
    setEditWebsiteName(profileInfo.website_name||'');
    setEditWebsiteUrl(profileInfo.website_url||'');
    setShowEditProfile(true);
  }

  function saveEditProfile(){
    if(!userId) return;
    setSavingEdit(true);
    var newBio = JSON.stringify({about:editAbout,tag:editTag,website_name:editWebsiteName,website_url:editWebsiteUrl});
    sbProfile.from('profiles').update({full_name:editName,bio:newBio}).eq('id',userId).then(function(res){
      setSavingEdit(false);
      var updated={name:editName,tag:editTag,about:editAbout,website_name:editWebsiteName,website_url:editWebsiteUrl};
      setProfileInfo(updated);
      try{localStorage.setItem('profile_info_'+userId,JSON.stringify(updated));}catch(e){}
      setShowEditProfile(false);
    });
  }

  function renderAbout(text){
    if(!text) return null;
    var parts = text.split(/(#\w+|https?:\/\/\S+)/g);
    return React.createElement('span',null,parts.map(function(part,i){
      if(/^#\w+$/.test(part)) return React.createElement('span',{key:i,style:{color:'#7B6EFF',fontWeight:600}},part);
      if(/^https?:\/\//.test(part)) return React.createElement('a',{key:i,href:part,target:'_blank',rel:'noreferrer',style:{color:'#7B6EFF',textDecoration:'underline'}},part);
      return React.createElement('span',{key:i},part);
    }));
  }

  useEffect(function(){
    if(!userId) return;
    // Load user posts from Supabase
    sbProfile.from('posts').select('*').eq('user_id',userId).order('created_at',{ascending:false}).then(function(res){
      if(res.data&&res.data.length>0){
        var dbPosts = res.data.map(function(p){
          var likesArr = Array.isArray(p.likes)?p.likes:[];
          return {
            id:p.id,
            text:p.text||'',
            likes:likesArr,
            liked:likesArr.includes(userId),
            likedByIds:likesArr,
            time:new Date(p.created_at).toLocaleDateString(),
            createdAt:p.created_at,
            img:p.images&&p.images[0]?p.images[0]:null,
            tags:p.tags||[],
            comments:p.comments_count||0
          };
        });
        setMyPosts(dbPosts);
        prefetchLikerNamesProf(dbPosts, {});
        try{localStorage.setItem('my_posts_cache_'+userId,JSON.stringify(dbPosts));}catch(e){}
      }
    });
  },[userId]);

  useEffect(function(){
    if(!userId) return;
    var saved = localStorage.getItem('avatar_'+userId);
    var savedCover = localStorage.getItem('cover_'+userId);
    if(saved){
      setAvatarUrl(saved);
    } else {
      // Load from Supabase if not in localStorage
      supabase.from('profiles').select('avatar_url').eq('id',userId).single().then(function(res){
        if(res.data&&res.data.avatar_url){
          setAvatarUrl(res.data.avatar_url);
          localStorage.setItem('avatar_'+userId,res.data.avatar_url);
        }
      });
    }
    if(savedCover) setCoverUrl(savedCover);
  },[userId]);

  function uploadAvatar(file){
    if(!file||!userId) return;
    var reader = new FileReader();
    reader.onload = function(e){
      setAdjustImg(e.target.result);
      setOffset({x:0,y:0});
      setShowAdjust(true);
    };
    reader.readAsDataURL(file);
  }

  function saveAvatar(){
    if(!adjustImg||!userId) return;
    // Use canvas to capture the adjusted position
    var canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 280;
    var ctx = canvas.getContext('2d');
    // Draw circle clip
    ctx.beginPath();
    ctx.arc(140,140,140,0,Math.PI*2);
    ctx.clip();
    var img = new Image();
    img.onload = function(){
      // Calculate size to fit full image
      var scale = Math.min(500/img.width, 500/img.height);
      var w = img.width * scale;
      var h = img.height * scale;
      var x = 140 - w/2 + offset.x;
      var y = 140 - h/2 + offset.y;
      ctx.drawImage(img, x, y, w, h);
      canvas.toBlob(function(blob){
        setUploading(true);
        setShowAdjust(false);
        var fileName = userId+'.jpg';
        supabase.storage.from('avatars').upload(fileName,blob,{upsert:true,contentType:'image/jpeg'}).then(function(res){
          if(res.error){alert('Upload failed: '+res.error.message);setUploading(false);return;}
          var pub = supabase.storage.from('avatars').getPublicUrl(fileName);
          var url = pub.data.publicUrl+'?t='+Date.now();
          setAvatarUrl(url);
          localStorage.setItem('avatar_'+userId,url);
          var userEmail = (session&&session.user)?session.user.email:email;
          supabase.from('profiles').upsert({id:userId,avatar_url:url,email:userEmail,full_name:userEmail.split('@')[0]},{onConflict:'id'}).then(function(r){console.log('avatar saved to profiles',r);});
          setUploading(false);
        });
      },'image/jpeg',0.9);
    };
    img.src = adjustImg;
  }

  function uploadCover(file){
    if(!file||!userId) return;
    var reader = new FileReader();
    reader.onload = function(e){
      var tmp = new Image();
      tmp.onload = function(){
        setCoverImgNat({w:tmp.naturalWidth, h:tmp.naturalHeight});
        setCoverAdjustImg(e.target.result);
        setCoverOffset({x:0,y:0});
        setCoverUserScale(1);
        setShowCoverAdjust(true);
      };
      tmp.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function saveCover(){
    if(!coverAdjustImg||!userId) return;
    var CANVAS_W = 800;
    var CANVAS_H = 260;
    var PREV_H = 160;
    var prevW = (window.innerWidth||375);
    var canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function(){
      var natW = img.naturalWidth||img.width;
      var natH = img.naturalHeight||img.height;
      // Base scale: cover-fill (same as preview)
      var previewBaseScale = Math.max(prevW / natW, PREV_H / natH);
      var canvasBaseScale = Math.max(CANVAS_W / natW, CANVAS_H / natH);
      // Apply user zoom on top of base
      var previewTotalScale = previewBaseScale * coverUserScale;
      var canvasTotalScale = canvasBaseScale * coverUserScale;
      var imgCW = natW * canvasTotalScale;
      var imgCH = natH * canvasTotalScale;
      var baseX = (CANVAS_W - imgCW) / 2;
      var baseY = (CANVAS_H - imgCH) / 2;
      // Scale the screen-pixel offset to canvas-pixel offset
      var offsetRatio = canvasTotalScale / previewTotalScale;
      ctx.fillStyle = '#1a1040';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, baseX + coverOffset.x * offsetRatio, baseY + coverOffset.y * offsetRatio, imgCW, imgCH);
      canvas.toBlob(function(blob){
        setUploading(true);
        setShowCoverAdjust(false);
        var fileName = userId+'_cover.jpg';
        supabase.storage.from('covers').upload(fileName, blob, {upsert:true, contentType:'image/jpeg'}).then(function(res){
          if(res.error){alert('Upload failed: '+res.error.message);setUploading(false);return;}
          var pub = supabase.storage.from('covers').getPublicUrl(fileName);
          var url = pub.data.publicUrl+'?t='+Date.now();
          setCoverUrl(url);
          try{localStorage.setItem('cover_'+userId, url);}catch(e){}
          supabase.from('profiles').update({cover_url:url}).eq('id',userId).then(function(){});
          setUploading(false);
        });
      }, 'image/jpeg', 0.92);
    };
    img.src = coverAdjustImg;
  }

  function toggleLike(id){
    if(!userId) return;
    if(typeof id !== 'string') return;
    // Instant UI update
    setMyPosts(function(prev){return prev.map(function(p){
      if(p.id!==id) return p;
      var newLiked = !p.liked;
      var curIds = Array.isArray(p.likedByIds)?p.likedByIds:(Array.isArray(p.likes)?p.likes:[]);
      var newIds = newLiked ? [userId].concat(curIds.filter(function(x){return x!==userId;})) : curIds.filter(function(x){return x!==userId;});
      return Object.assign({},p,{liked:newLiked,likes:newIds,likedByIds:newIds});
    });});
    // Save to Supabase in background
    sbProfile.rpc('toggle_like',{post_id:id,user_id:userId}).then(function(r){
      if(r.error){
        console.log('like error:',r.error);
        // Revert on error
        setMyPosts(function(prev){return prev.map(function(p){
          if(p.id!==id) return p;
          var rev=!p.liked;
          var curIds=Array.isArray(p.likedByIds)?p.likedByIds:[];
          var revIds=rev?[userId].concat(curIds.filter(function(x){return x!==userId;})):curIds.filter(function(x){return x!==userId;});
          return Object.assign({},p,{liked:rev,likes:revIds,likedByIds:revIds});
        });});
      }
    });
  }

  function submitPost(){
    if(!postText.trim()){alert('Write something first!');return;}
    if(!userId){alert('Please log in to post');return;}
    var postData = {
      user_id: userId,
      user_name: email.split('@')[0],
      user_avatar: avatarUrl||null,
      text: postText,
      images: [],
      tags: [],
      likes: [],
      comments_count: 0
    };
    sbProfile.from('posts').insert([postData]).select().then(function(res){
      if(res.error){alert('Failed to post: '+res.error.message);return;}
      if(res.data&&res.data[0]){
        var newPost={
          id:res.data[0].id,
          text:postText,
          likes:[],
          liked:false,
          time:'Just now',
          img:null,
          comments:[]
        };
        setMyPosts(function(prev){return [newPost].concat(prev);});
        setPostText('');
      }
    });
  }

  // SETTINGS SCREEN
  if(showSettings) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)'}},
      React.createElement('button',{onClick:function(){setShowSettings(false);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'22px',cursor:'pointer'}},'<'),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Settings')
    ),
    React.createElement('div',{style:{padding:'14px 18px'}},
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        [{v:'12',l:'Calls Made',icon:'📞'},{v:'1,240',l:'Coins',icon:'🪙'},{v:'4.8★',l:'Rating',icon:'⭐'}].map(function(s){
          return React.createElement('div',{key:s.l,
            onClick:function(){if(s.l==='Coins'&&onOpenWallet){setShowSettings(false);onOpenWallet();}},
            style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',textAlign:'center',cursor:s.l==='Coins'?'pointer':'default'}},
            React.createElement('div',{style:{fontSize:'20px',marginBottom:'4px'}},s.icon),
            React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)',marginBottom:'2px'}},s.v),
            React.createElement('div',{style:{fontSize:'9px',color:'var(--t2)'}},s.l)
          );
        })
      ),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}},
        [
          {icon:'🎓',label:'Become an Expert',sub:'Start earning by sharing your knowledge',fn:function(){alert('Expert application coming soon!');}},
          {icon:'🔔',label:'Notifications',sub:'Manage your alerts',fn:function(){alert('Notification settings coming soon!');}},
          {icon:'🔒',label:'Privacy & Security',sub:'Password, 2FA, data',fn:function(){alert('Privacy settings coming soon!');}},
          {icon:'💬',label:'Help & Support',sub:'FAQs and contact us',fn:function(){window.open('mailto:support@ringin.app');}},
          {icon:'⭐',label:'Rate the App',sub:'Enjoying RingIn? Let us know!',fn:function(){setShowRate(true);}},
        ].map(function(item,i){
          return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
            React.createElement('span',{style:{fontSize:'18px',width:'28px',textAlign:'center'}},item.icon),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}},item.label),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},item.sub)
            ),
            React.createElement('span',{style:{color:'var(--t3)',fontSize:'16px'}},'>')
          );
        })
      ),
      showRate ? React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}},
        rateDone
          ? React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'32px',marginBottom:'8px'}},'🎉'),
              React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},'Thanks for rating us!'),
              React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)'}},rateVal+' stars — we appreciate it!')
            )
          : React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'12px'}},'Rate RingIn'),
              React.createElement('div',{style:{display:'flex',justifyContent:'center',gap:'8px',marginBottom:'16px'}},
                [1,2,3,4,5].map(function(s){
                  return React.createElement('span',{key:s,onClick:function(){setRateVal(s);},style:{fontSize:'32px',cursor:'pointer',opacity:s<=rateVal?1:0.3}},s<=rateVal?'⭐':'☆');
                })
              ),
              rateVal>0 ? React.createElement('button',{onClick:function(){setRateDone(true);},style:{padding:'10px 24px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer'}},'Submit') : null
            )
      ) : null,
      React.createElement('button',{
        onClick:function(){supabase.auth.signOut();},
        style:{width:'100%',padding:'13px',background:'rgba(239,71,71,.1)',border:'1px solid rgba(239,71,71,.3)',borderRadius:'12px',color:'#ef4747',fontSize:'14px',fontWeight:600,cursor:'pointer'}
      },'Sign Out')
    )
  );

  // MAIN PROFILE
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    showLikersProf ? React.createElement('div',{
      onClick:function(){setShowLikersProf(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}
    },
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{background:'rgba(22,16,44,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'20px',width:'100%',maxWidth:'360px',maxHeight:'70vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}
      },
        React.createElement('div',{style:{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'2px'}},
              (function(){
                var p=myPosts.find(function(x){return x.id===showLikersProf;});
                if(!p) return 'Liked by';
                var ids=p.likes.filter(function(l){return typeof l==='string'&&l.length>10;});
                var names=ids.map(function(id){return likersNamesProf[id]?likersNamesProf[id].name:null;}).filter(Boolean);
                var staticNames=p.likeNames||[];
                var allNames=names.length>0?names:staticNames;
                if(p.likes.length===0) return 'Liked by';
                if(allNames.length===0) return p.likes.length+' '+(p.likes.length===1?'like':'likes');
                if(p.likes.length===1) return allNames[0]+' liked this';
                if(p.likes.length===2) return (allNames[0]||'Someone')+' and '+(allNames[1]||'someone')+' liked';
                return (allNames[0]||'Someone')+' and '+(p.likes.length-1)+' others liked';
              })()
            ),
            React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,0.45)'}},
              (function(){var p=myPosts.find(function(x){return x.id===showLikersProf;});return p?p.likes.length+' likes total':'';})()
            )
          ),
          React.createElement('button',{onClick:function(){setShowLikersProf(null);},style:{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},'×')
        ),
        React.createElement('div',{style:{overflowY:'auto',padding:'8px 0'}},
          (function(){
            var p=myPosts.find(function(x){return x.id===showLikersProf;});
            if(!p) return null;
            var ids=p.likes.filter(function(l){return typeof l==='string'&&l.length>10;});
            var staticNames=p.likeNames||[];
            if(p.likes.length===0) return React.createElement('div',{style:{padding:'24px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}},'No likes yet');
            if(ids.length===0&&staticNames.length>0){
              return staticNames.map(function(name,i){
                return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
                  React.createElement('div',{style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff'}},name.substring(0,2).toUpperCase()),
                  React.createElement('div',{style:{flex:1}},React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'#fff'}},name),React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.4)'}},'RingIn Member'))
                );
              });
            }
            return ids.map(function(uid){
              var info=likersNamesProf[uid]||{};
              var name=info.name||'Loading...';
              var av=info.avatar||null;
              function goToLiker(){
                if(uid===userId) return;
                setShowLikersProf(null);
                if(props.onViewUser) props.onViewUser({id:uid,full_name:name,avatar_url:av,email:''});
              }
              return React.createElement('div',{key:uid,style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
                React.createElement('div',{onClick:goToLiker,style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',cursor:uid!==userId?'pointer':'default'}},
                  av?React.createElement('img',{src:av,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}):name.substring(0,2).toUpperCase()
                ),
                React.createElement('div',{onClick:goToLiker,style:{flex:1,minWidth:0,cursor:uid!==userId?'pointer':'default'}},
                  React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},name),
                  React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.4)'}},'RingIn Member')
                ),
                uid!==userId?React.createElement('button',{
                  onClick:function(e){e.stopPropagation();toggleFollow(uid,name,av,'RingIn Member');},
                  style:{padding:'6px 14px',background:following[uid]?'transparent':'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:following[uid]?'1px solid rgba(123,110,255,0.5)':'none',borderRadius:'20px',color:following[uid]?'#7B6EFF':'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}
                },following[uid]?'Following':'+Follow'):null
              );
            });
          })()
        )
      )
    ) : null,
    // Avatar view modal
    showAvatarView ? React.createElement('div',{
      onClick:function(){setShowAvatarView(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.9)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}},
      React.createElement('div',{style:{width:'280px',height:'280px',borderRadius:'50%',overflow:'hidden',border:'4px solid #fff'}},
        avatarUrl
          ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}})
          : React.createElement('div',{style:{width:'100%',height:'100%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'72px',fontWeight:700,color:'#fff'}},initials)
      )
    ) : null,
    // Adjust/crop screen
    showAdjust ? React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#000',zIndex:10000,display:'flex',flexDirection:'column'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px',color:'#fff'}},
        React.createElement('button',{onClick:function(){setShowAdjust(false);},style:{background:'none',border:'none',color:'#fff',fontSize:'14px',cursor:'pointer'}},'Cancel'),
        React.createElement('div',{style:{fontSize:'15px',fontWeight:600}},'Adjust Photo'),
        React.createElement('button',{onClick:saveAvatar,style:{background:'var(--ac)',border:'none',color:'#fff',fontSize:'14px',fontWeight:700,padding:'6px 14px',borderRadius:'20px',cursor:'pointer'}},'Save')
      ),
      React.createElement('div',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}},
        React.createElement('div',{style:{width:'280px',height:'280px',borderRadius:'50%',overflow:'hidden',border:'3px solid #fff',position:'relative',cursor:'grab'},
          onMouseDown:function(e){setDragging(true);setDragStart({x:e.clientX-offset.x,y:e.clientY-offset.y});},
          onMouseMove:function(e){if(!dragging)return;setOffset({x:e.clientX-dragStart.x,y:e.clientY-dragStart.y});},
          onMouseUp:function(){setDragging(false);},
          onTouchStart:function(e){setDragging(true);setDragStart({x:e.touches[0].clientX-offset.x,y:e.touches[0].clientY-offset.y});},
          onTouchMove:function(e){if(!dragging)return;e.preventDefault();setOffset({x:e.touches[0].clientX-dragStart.x,y:e.touches[0].clientY-dragStart.y});},
          onTouchEnd:function(){setDragging(false);}
        },
          React.createElement('img',{src:adjustImg,style:{maxWidth:'500px',maxHeight:'500px',width:'auto',height:'auto',position:'absolute',top:'50%',left:'50%',transform:'translate(calc(-50% + '+offset.x+'px), calc(-50% + '+offset.y+'px))',transition:dragging?'none':'transform 0.1s',userSelect:'none',pointerEvents:'none',display:'block'}})
        )
      ),
      React.createElement('div',{style:{padding:'16px',textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'12px'}},'Drag to reposition your photo')
    ) : null,
    // Cover adjust/reposition screen
    showCoverAdjust ? (function(){
      var PREV_H = 160;
      var prevW = window.innerWidth||375;
      var natW = coverImgNat.w||1; var natH = coverImgNat.h||1;
      // Base scale = cover-fill: image fills the strip completely (like object-fit:cover)
      var baseScale = Math.max(prevW / natW, PREV_H / natH);
      var totalScale = baseScale * coverUserScale;
      var imgDW = Math.round(natW * totalScale);
      var imgDH = Math.round(natH * totalScale);
      return React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#111',zIndex:10001,display:'flex',flexDirection:'column'}},
        // Header
        React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',color:'#fff',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.08)'}},
          React.createElement('button',{onClick:function(){setShowCoverAdjust(false);},style:{background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:'15px',cursor:'pointer',padding:'4px 0'}},'Cancel'),
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'#fff'}},'Adjust Cover'),
          React.createElement('button',{onClick:saveCover,style:{background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'14px',fontWeight:700,padding:'8px 20px',borderRadius:'20px',cursor:'pointer'}},'Save')
        ),
        // Instruction
        React.createElement('div',{style:{textAlign:'center',padding:'20px 20px 16px',color:'rgba(255,255,255,0.45)',fontSize:'13px'}},'Drag to move  •  Pinch to zoom'),
        // Cover preview strip — full width, exact cover height
        React.createElement('div',{
          style:{width:'100%',height:PREV_H+'px',overflow:'hidden',position:'relative',cursor:'grab',flexShrink:0,background:'#1a1040'},
          onMouseDown:function(e){setCoverDragging(true);setCoverDragStart({x:e.clientX-coverOffset.x,y:e.clientY-coverOffset.y});},
          onMouseMove:function(e){if(!coverDragging)return;setCoverOffset({x:e.clientX-coverDragStart.x,y:e.clientY-coverDragStart.y});},
          onMouseUp:function(){setCoverDragging(false);},
          onWheel:function(e){e.preventDefault();var delta=e.deltaY>0?0.92:1.08;setCoverUserScale(function(s){return Math.max(0.5,Math.min(6,s*delta));});},
          onTouchStart:function(e){
            if(e.touches.length===2){
              var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
              setCoverPinchDist(d); setCoverPinchScaleStart(coverUserScale);
            } else {
              setCoverDragging(true);
              setCoverDragStart({x:e.touches[0].clientX-coverOffset.x,y:e.touches[0].clientY-coverOffset.y});
            }
          },
          onTouchMove:function(e){
            e.preventDefault();
            if(e.touches.length===2){
              var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
              if(coverPinchDist>0) setCoverUserScale(Math.max(0.5,Math.min(6,coverPinchScaleStart*(d/coverPinchDist))));
            } else if(coverDragging){
              setCoverOffset({x:e.touches[0].clientX-coverDragStart.x,y:e.touches[0].clientY-coverDragStart.y});
            }
          },
          onTouchEnd:function(e){
            if(e.touches.length<2){setCoverPinchDist(0);}
            if(e.touches.length===0){setCoverDragging(false);}
          }
        },
          coverAdjustImg ? React.createElement('img',{
            src:coverAdjustImg,
            style:{position:'absolute',top:'50%',left:'50%',width:imgDW+'px',height:imgDH+'px',transform:'translate(calc(-50% + '+coverOffset.x+'px), calc(-50% + '+coverOffset.y+'px))',transition:'none',userSelect:'none',pointerEvents:'none',display:'block'}
          }) : null
        ),
        // Profile preview label
        React.createElement('div',{style:{textAlign:'center',padding:'16px 20px',color:'rgba(255,255,255,0.3)',fontSize:'12px'}},'↑  This is exactly how your cover looks on your profile  ↑'),
        // Zoom buttons for easier control
        React.createElement('div',{style:{display:'flex',justifyContent:'center',gap:'16px',padding:'8px 20px'}},
          React.createElement('button',{onClick:function(){setCoverUserScale(function(s){return Math.max(0.5,s*0.85);});},style:{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'50%',width:'44px',height:'44px',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'−'),
          React.createElement('button',{onClick:function(){setCoverUserScale(1);setCoverOffset({x:0,y:0});},style:{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'20px',padding:'0 16px',height:'44px',color:'rgba(255,255,255,0.6)',fontSize:'12px',cursor:'pointer'}},'Reset'),
          React.createElement('button',{onClick:function(){setCoverUserScale(function(s){return Math.min(6,s*1.15);});},style:{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'50%',width:'44px',height:'44px',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+')
        )
      );
    })() : null,
    // iOS frosted glass avatar menu
    showAvatarMenu ? React.createElement('div',{
      onClick:function(){setShowAvatarMenu(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9998,backdropFilter:'blur(2px)'}},
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{position:'absolute',top:'155px',left:'14px',background:'rgba(30,30,40,0.85)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderRadius:'14px',minWidth:'200px',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.6)',border:'1px solid rgba(255,255,255,0.1)'}},
        React.createElement('div',{onClick:function(){setShowAvatarMenu(false);setShowAvatarView(true);},
          style:{padding:'13px 16px',fontSize:'14px',fontWeight:500,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)'}},'View Photo'),
        React.createElement('label',{style:{display:'block',padding:'13px 16px',fontSize:'14px',fontWeight:500,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)'}},
          'Take Photo',
          React.createElement('input',{type:'file',accept:'image/*',capture:'user',style:{display:'none'},onChange:function(e){if(e.target.files[0]){setShowAvatarMenu(false);uploadAvatar(e.target.files[0]);}}})
        ),
        React.createElement('label',{style:{display:'block',padding:'13px 16px',fontSize:'14px',fontWeight:500,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)'}},
          'Upload from Gallery',
          React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0]){setShowAvatarMenu(false);uploadAvatar(e.target.files[0]);}}})
        ),
        React.createElement('div',{onClick:function(){setShowAvatarMenu(false);},
          style:{padding:'13px 16px',fontSize:'14px',fontWeight:600,color:'#ff453a',cursor:'pointer'}},'Cancel')
      )
    ) : null,
    // Edit Profile Modal
    showEditProfile ? React.createElement('div',{
      onClick:function(){setShowEditProfile(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:10000,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}
    },
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{background:'rgba(18,12,36,0.65)',backdropFilter:'blur(30px)',WebkitBackdropFilter:'blur(30px)',border:'1px solid rgba(123,110,255,0.25)',borderRadius:'20px',width:'100%',maxWidth:'380px',maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}
      },
        React.createElement('div',{style:{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('span',{style:{fontSize:'17px',fontWeight:700,color:'#fff'}},'Edit Profile'),
          React.createElement('button',{onClick:function(){setShowEditProfile(false);},style:{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}},'×')
        ),
        React.createElement('div',{style:{padding:'18px'}},
          // Display Name
          React.createElement('div',{style:{marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Display Name'),
            React.createElement('input',{value:editName,onChange:function(e){setEditName(e.target.value);},placeholder:'Your name',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',boxSizing:'border-box'}})
          ),
          // Tag
          React.createElement('div',{style:{marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Tag / Handle'),
            React.createElement('input',{value:editTag,onChange:function(e){setEditTag(e.target.value.startsWith('#')?e.target.value:'#'+e.target.value);},placeholder:'#yourtag',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#7B6EFF',outline:'none',boxSizing:'border-box'}})
          ),
          // About Me
          React.createElement('div',{style:{marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'About Me'),
            React.createElement('textarea',{value:editAbout,onChange:function(e){setEditAbout(e.target.value);},placeholder:'Tell people about yourself...',rows:3,style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',resize:'none',boxSizing:'border-box',fontFamily:'DM Sans,sans-serif',lineHeight:1.5}})
          ),
          // Website / Social Links
          React.createElement('div',{style:{marginBottom:'24px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Website / Social Link'),
            React.createElement('input',{value:editWebsiteName,onChange:function(e){setEditWebsiteName(e.target.value);},placeholder:'Display name (e.g. www.google.com)',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',boxSizing:'border-box',marginBottom:'8px'}}),
            React.createElement('input',{value:editWebsiteUrl,onChange:function(e){setEditWebsiteUrl(e.target.value);},placeholder:'URL (e.g. https://google.com)',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',boxSizing:'border-box'}})
          ),
          React.createElement('button',{
            onClick:saveEditProfile,
            style:{width:'100%',padding:'13px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer'}
          },savingEdit?'Saving...':'Save Profile')
        )
      )
    ) : null,
    // Cover
    React.createElement('div',{style:{height:'130px',background:coverUrl?'none':'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)',position:'relative',flexShrink:0,overflow:'visible'}},
      coverUrl ? React.createElement('img',{src:coverUrl,alt:'cover',style:{width:'100%',height:'100%',objectFit:'cover'}}) : null,
      React.createElement('label',{style:{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'5px 10px',fontSize:'10px',color:'#fff',cursor:'pointer'}},
        uploading?'Uploading...':'✏️ Edit Cover',
        React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0])uploadCover(e.target.files[0]);}})
      ),
      // Avatar
      React.createElement('div',{onClick:function(){setShowAvatarMenu(true);},style:{position:'absolute',bottom:'-40px',left:'18px',width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',zIndex:2,overflow:'hidden',cursor:'pointer'}},
        avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
      )
    ),
    // Name row
    React.createElement('div',{style:{padding:'50px 18px 8px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
      React.createElement('div',{style:{flex:1,minWidth:0,paddingRight:'10px'}},
        React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},profileInfo.name||email.split('@')[0]),
        profileInfo.tag ? React.createElement('div',{style:{fontSize:'12px',color:'#7B6EFF',fontWeight:600,marginBottom:'4px'}},profileInfo.tag) : null,
        profileInfo.about ? React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',lineHeight:1.5,marginBottom:'4px',whiteSpace:'pre-wrap'}},renderAbout(profileInfo.about)) : null,
        (profileInfo.website_name||profileInfo.website_url) ? React.createElement('a',{href:profileInfo.website_url||(profileInfo.website_name&&profileInfo.website_name.startsWith('http')?profileInfo.website_name:'https://'+profileInfo.website_name),target:'_blank',rel:'noreferrer',style:{fontSize:'12px',color:'#7B6EFF',display:'flex',alignItems:'center',gap:'4px',marginBottom:'4px',textDecoration:'none'}},'🔗 '+(profileInfo.website_name||profileInfo.website_url)) : null,
        React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},'Member since April 2026')
      ),
      React.createElement('div',{style:{display:'flex',gap:'8px',flexShrink:0}},
        React.createElement('button',{onClick:openEditProfile,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',display:'flex',alignItems:'center',gap:'4px',cursor:'pointer',fontSize:'12px',color:'var(--text)',fontWeight:600}},'✏️ Edit'),
        React.createElement('button',{onClick:function(){setShowSettings(true);},style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px'}},'⚙️')
      )
    ),
    // Stats
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'0 18px 12px'}},
      [{v:'12',l:'Calls'},{v:'1,240',l:'Coins'},{v:'0',l:'Reviews'}].map(function(s){
        return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)'}},s.v),
          React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},s.l)
        );
      })
    ),
    // Tabs
    React.createElement('div',{style:{display:'flex',borderBottom:'1px solid var(--border)',padding:'0 18px',marginBottom:'12px'}},
      ['posts','friends','skills','reviews'].map(function(t){
        return React.createElement('div',{key:t,onClick:function(){setActiveTab(t);},style:{flex:1,padding:'8px 4px',textAlign:'center',fontSize:'11px',fontWeight:activeTab===t?700:500,color:activeTab===t?'var(--ac)':'var(--t2)',cursor:'pointer',borderBottom:activeTab===t?'2px solid var(--ac)':'2px solid transparent',textTransform:'capitalize'}},t);
      })
    ),
    // Tab content
    React.createElement('div',{style:{padding:'0 18px 80px'}},
      // POSTS TAB
      activeTab==='posts' ? React.createElement('div',null,
        // Composer
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px',marginBottom:'14px'}},
          React.createElement('div',{style:{display:'flex',gap:'10px',alignItems:'flex-start',marginBottom:'10px'}},
            React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
              avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'me',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
            ),
            React.createElement('textarea',{value:postText,onChange:function(e){setPostText(e.target.value);},placeholder:"What's on your mind?",style:{flex:1,background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',padding:'9px 11px',fontSize:'13px',color:'var(--text)',outline:'none',resize:'none',minHeight:'70px',fontFamily:'DM Sans,sans-serif',lineHeight:1.5}})
          ),
          showEmoji ? React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',padding:'8px',background:'var(--bg4)',borderRadius:'10px',marginBottom:'8px'}},
            EMOJIS.map(function(em){return React.createElement('span',{key:em,onClick:function(){setPostText(function(t){return t+em;});setShowEmoji(false);},style:{fontSize:'22px',cursor:'pointer',padding:'2px'}},em);})
          ) : null,
          React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            React.createElement('div',{style:{display:'flex',gap:'6px'}},
              React.createElement('button',{onClick:function(){alert('Image upload coming soon!');},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'11px',cursor:'pointer'}},'🖼️ Photo'),
              React.createElement('button',{onClick:function(){alert('GIF coming soon!');},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'11px',cursor:'pointer'}},'🎞️ GIF'),
              React.createElement('button',{onClick:function(){setShowEmoji(!showEmoji);},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:showEmoji?'var(--acg)':'var(--bg4)',border:'1px solid '+(showEmoji?'var(--ac)':'var(--border)'),borderRadius:'20px',color:showEmoji?'var(--ac)':'var(--t2)',fontSize:'11px',cursor:'pointer'}},'😊 Emoji')
            ),
            React.createElement('button',{onClick:submitPost,style:{padding:'7px 18px',background:'var(--ac)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}},'Post')
          )
        ),
        // 3-dot menu popup for ProfileScreen
        postMenuProf ? React.createElement('div',{
          onClick:function(){setPostMenuProf(null);},
          style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9500,background:'rgba(0,0,0,0.2)'}
        },
          React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(28,24,40,0.45)',backdropFilter:'blur(48px)',WebkitBackdropFilter:'blur(48px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'20px',width:'280px',boxShadow:'0 8px 40px rgba(0,0,0,0.35)',overflow:'hidden'}},
            (function(){
              var p=myPosts.find(function(x){return x.id===postMenuProf;});
              if(!p) return null;
              var items=[
                {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenuProf(null);if(window.confirm('Delete this post?')){sbProfile.from('posts').delete().eq('id',p.id).then(function(){});setMyPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});}}},
                {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied!');setPostMenuProf(null);}},
                {icon:'✏️',label:'Edit Post',fn:function(){alert('Edit coming soon');setPostMenuProf(null);}},
                {icon:'🔕',label:'Turn off notifications',fn:function(){alert('Notifications paused');setPostMenuProf(null);}}
              ];
              return items.map(function(item,i){
                return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.07)':'none',cursor:'pointer'}},
                  React.createElement('span',{style:{fontSize:'14px',fontWeight:500,color:item.red?'#ff453a':'rgba(255,255,255,0.9)'}},item.label)
                );
              });
            })()
          )
        ) : null,
        // Posts list
        myPosts.map(function(p){
          var commentsArr=commentsCacheProf[p.id]||[];
          return React.createElement('div',{key:p.id,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',marginBottom:'12px',overflow:'hidden'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'11px 12px 8px',position:'relative'}},
              React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
                avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'me',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},email.split('@')[0]),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},p.time)
              ),
              React.createElement('button',{
                onClick:function(e){e.stopPropagation();setPostMenuProf(postMenuProf===p.id?null:p.id);},
                style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',position:'absolute',right:'4px',top:'6px'}
              },'⋯')
            ),
            React.createElement('div',{style:{padding:'0 12px 8px',fontSize:'13px',color:'var(--text)',lineHeight:1.6}},p.text),
            p.img ? React.createElement('img',{src:p.img,alt:'post',style:{width:'100%',height:'220px',objectFit:'cover',display:'block'}}) : null,
            React.createElement('div',{style:{display:'flex',borderTop:'1px solid var(--border)'}},
              React.createElement('div',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}},
                React.createElement('button',{onClick:function(){toggleLike(p.id);},style:{display:'flex',alignItems:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:p.liked?'#E84D9A':'var(--t2)',fontWeight:p.liked?700:400}},
                  React.createElement('svg',{viewBox:'0 0 24 24',width:'18',height:'18'},
                    p.liked?React.createElement('defs',null,React.createElement('linearGradient',{id:'plg'+p.id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},React.createElement('stop',{offset:'0%',stopColor:'#5B4FD4'}),React.createElement('stop',{offset:'100%',stopColor:'#C4347A'}))):null,
                    React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:p.liked?'url(#plg'+p.id+')':'none',stroke:p.liked?'none':'var(--t2)',strokeWidth:'2'})
                  ),
                  React.createElement('span',{onClick:function(e){openLikersPopupProf(e,p);},style:{cursor:p.likes.length>0?'pointer':'default'}},p.likes.length,' Like')
                )
              ),
              React.createElement('button',{
                onClick:function(){
                  var newOpen=openCommentsProf===p.id?null:p.id;
                  setOpenCommentsProf(newOpen);
                  if(newOpen) loadCommentsProf(newOpen);
                },
                style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
              },'💬 '+(commentsCacheProf[p.id]?commentsCacheProf[p.id].length:p.comments||0)),
              React.createElement('button',{
                onClick:function(){
                  var url='https://ring-in.vercel.app/post/'+p.id;
                  if(navigator.share){navigator.share({title:'Check this out on RingIn',text:(p.text||'').substring(0,100),url:url});}
                  else{try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied to clipboard!');}
                },
                style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
              },'↗ Share')
            ),
            // Comment section
            openCommentsProf===p.id?React.createElement('div',{style:{borderTop:'1px solid var(--border)',background:'var(--bg4)'}},
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
                        React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},new Date(c.created_at).toLocaleDateString())
                      ),
                      React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.4,marginTop:'2px'}},c.text)
                    )
                  );
                })
              ),
              React.createElement('div',{style:{display:'flex',gap:'8px',padding:'8px 12px',borderTop:'1px solid var(--border)'}},
                React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                  avatarUrl?React.createElement('img',{src:avatarUrl,style:{width:'100%',height:'100%',objectFit:'cover'}}):initials.substring(0,2)
                ),
                React.createElement('input',{
                  value:commentInputProf,
                  onChange:function(e){setCommentInputProf(e.target.value);},
                  onKeyDown:function(e){if(e.key==='Enter'&&commentInputProf.trim()){submitCommentProf(p.id,commentInputProf);}},
                  placeholder:'Write a comment...',
                  style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
                }),
                React.createElement('button',{
                  onClick:function(){if(commentInputProf.trim())submitCommentProf(p.id,commentInputProf);},
                  style:{padding:'6px 14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
                },'Send')
              )
            ):null
          );
        })
      ) : null,
      // FRIENDS TAB
      activeTab==='friends' ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px'}},'Experts You Follow'),
        FRIENDS.map(function(f,i){
          return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'10px',marginBottom:'8px'}},
            React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:f.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
              f.img ? React.createElement('img',{src:f.img,alt:f.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : f.initials
            ),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},f.name),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},f.role)
            ),
            React.createElement('button',{onClick:function(){toggleFollow(String(f.id||f.name),f.name,f.img,f.role);},style:{fontSize:'10px',color:following[String(f.id||f.name)]?'var(--ac)':'#fff',background:following[String(f.id||f.name)]?'var(--acg)':'var(--ac)',border:following[String(f.id||f.name)]?'1px solid var(--ac)':'none',padding:'5px 10px',borderRadius:'20px',cursor:'pointer',fontWeight:600}},following[String(f.id||f.name)]?'Following':'+Follow')
          );
        })
      ) : null,
      // SKILLS TAB
      activeTab==='skills' ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px'}},'Skills Learned'),
        SKILLS.map(function(s,i){
          return React.createElement('div',{key:i,style:{marginBottom:'14px'}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'5px'}},
              React.createElement('span',{style:{fontSize:'12px',fontWeight:500,color:'var(--text)'}},s.label),
              React.createElement('span',{style:{fontSize:'11px',color:'var(--ac)'}},s.level+'%')
            ),
            React.createElement('div',{style:{height:'6px',background:'var(--bg4)',borderRadius:'10px',overflow:'hidden'}},
              React.createElement('div',{style:{height:'100%',width:s.level+'%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',borderRadius:'10px'}})
            )
          );
        })
      ) : null,
      // REVIEWS TAB
      activeTab==='reviews' ? React.createElement('div',null,
        REVIEWS.map(function(r,i){
          return React.createElement('div',{key:i,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'10px'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}},
              React.createElement('div',{style:{width:'32px',height:'32px',borderRadius:'50%',overflow:'hidden',background:'var(--bg4)',flexShrink:0}},
                React.createElement('img',{src:r.img,alt:r.name,style:{width:'100%',height:'100%',objectFit:'cover'}})
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--text)'}},r.name),
                React.createElement('div',{style:{fontSize:'10px',color:'#F5A623'}},'⭐'.repeat(r.rating))
              ),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},r.time)
            ),
            React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5}},r.text)
          );
        })
      ) : null
    )
  );
}
