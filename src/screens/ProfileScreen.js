/* eslint-disable */
import React,{useState,useEffect} from 'react';

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
  var avatarMenuS=useState(false); var showAvatarMenu=avatarMenuS[0]; var setShowAvatarMenu=avatarMenuS[1];
  var avatarViewS=useState(false); var showAvatarView=avatarViewS[0]; var setShowAvatarView=avatarViewS[1];
  var postTextS=useState(''); var postText=postTextS[0]; var setPostText=postTextS[1];
  var showEmojiS=useState(false); var showEmoji=showEmojiS[0]; var setShowEmoji=showEmojiS[1];
  var postsS=useState([
    {id:1,text:'Just had an incredible consultation with Dr. Priya Nair. She explained everything so clearly. Highly recommend!',likes:['Ahmed K.','Fatima M.','Sara Z.'],liked:false,time:'1h ago',img:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80'},
    {id:2,text:'Learning system design with Ravi Menon on RingIn. Best investment I made this month. Already cracked 2 interviews!',likes:['Ravi M.','James T.','Layla K.'],liked:false,time:'Yesterday',img:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80'},
    {id:3,text:'Sara Al Zaabi helped me rebuild my LinkedIn profile from scratch. Got 3 recruiter messages in one week!',likes:['Dr. Priya','Ahmed K.','Fatima M.'],liked:false,time:'2 days ago',img:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'},
  ]); var myPosts=postsS[0]; var setMyPosts=postsS[1];

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
    var saved = localStorage.getItem('avatar_'+userId);
    var savedCover = localStorage.getItem('cover_'+userId);
    if(saved) setAvatarUrl(saved);
    if(savedCover) setCoverUrl(savedCover);
  },[userId]);

  function uploadAvatar(file){
    if(!file||!userId) return;
    setUploading(true);
    var ext = file.name.split('.').pop();
    var fileName = userId+'.'+ext;
    supabase.storage.from('avatars').upload(fileName,file,{upsert:true}).then(function(res){
      if(res.error){alert('Upload failed: '+res.error.message);setUploading(false);return;}
      var pub = supabase.storage.from('avatars').getPublicUrl(fileName);
      var url = pub.data.publicUrl+'?t='+Date.now();
      setAvatarUrl(url);
      localStorage.setItem('avatar_'+userId,url);
      setUploading(false);
    });
  }

  function uploadCover(file){
    if(!file||!userId) return;
    setUploading(true);
    var ext = file.name.split('.').pop();
    var fileName = userId+'_cover.'+ext;
    supabase.storage.from('covers').upload(fileName,file,{upsert:true}).then(function(res){
      if(res.error){alert('Upload failed: '+res.error.message);setUploading(false);return;}
      var pub = supabase.storage.from('covers').getPublicUrl(fileName);
      var url = pub.data.publicUrl+'?t='+Date.now();
      setCoverUrl(url);
      localStorage.setItem('cover_'+userId,url);
      setUploading(false);
    });
  }

  function toggleLike(id){
    setMyPosts(function(prev){return prev.map(function(p){
      if(p.id!==id) return p;
      var newLikes = p.liked ? p.likes.filter(function(l){return l!=='You';}) : [...p.likes,'You'];
      return Object.assign({},p,{liked:!p.liked,likes:newLikes});
    });});
  }

  function submitPost(){
    if(!postText.trim()){alert('Write something first!');return;}
    var newPost={id:Date.now(),text:postText,likes:[],liked:false,time:'Just now',img:null};
    setMyPosts(function(prev){return [newPost,...prev];});
    setPostText('');
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
    // Avatar menu modal
    showAvatarMenu ? React.createElement('div',{
      onClick:function(){setShowAvatarMenu(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9998,display:'flex',alignItems:'flex-end',justifyContent:'center'}},
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{width:'100%',maxWidth:'480px',background:'var(--bg)',borderRadius:'20px 20px 0 0',padding:'16px',paddingBottom:'32px'}},
        React.createElement('div',{style:{width:'36px',height:'4px',background:'var(--border)',borderRadius:'2px',margin:'0 auto 16px'}}),
        React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',textAlign:'center',marginBottom:'16px'}},'Profile Photo'),
        [
          {icon:'👁️',label:'View Photo',fn:function(){setShowAvatarMenu(false);setShowAvatarView(true);}},
          {icon:'📷',label:'Take Photo',fn:function(){setShowAvatarMenu(false);document.getElementById('avatarCameraInput').click();}},
          {icon:'🖼️',label:'Upload from Gallery',fn:function(){setShowAvatarMenu(false);document.getElementById('avatarFileInput').click();}},
        ].map(function(opt,i){
          return React.createElement('div',{key:i,onClick:opt.fn,style:{display:'flex',alignItems:'center',gap:'14px',padding:'14px',borderRadius:'12px',cursor:'pointer',marginBottom:'4px',background:'var(--bg3)'}},
            React.createElement('span',{style:{fontSize:'22px'}},opt.icon),
            React.createElement('span',{style:{fontSize:'14px',fontWeight:500,color:'var(--text)'}},opt.label)
          );
        }),
        React.createElement('div',{onClick:function(){setShowAvatarMenu(false);},style:{display:'flex',alignItems:'center',justifyContent:'center',padding:'14px',borderRadius:'12px',cursor:'pointer',marginTop:'8px',background:'var(--bg3)'}},
          React.createElement('span',{style:{fontSize:'14px',fontWeight:600,color:'#ef4747'}},'Cancel')
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
      React.createElement('div',{style:{position:'absolute',bottom:'-40px',left:'18px',width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',zIndex:2,overflow:'hidden'}},
        avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials,
        React.createElement('label',{style:{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',height:'22px',cursor:'pointer',fontSize:'12px'}},
          uploading?'...':'📷',
          React.createElement('input',{type:'file',accept:'image/*',capture:'user',style:{display:'none'},onChange:function(e){if(e.target.files[0])uploadAvatar(e.target.files[0]);}})
        )
      )
    ),
    // Name row
    React.createElement('div',{style:{padding:'50px 18px 8px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
      React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'17px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},email.split('@')[0]),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginBottom:'4px'}},email),
        React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},'Member since April 2026')
      ),
      React.createElement('button',{onClick:function(){setShowSettings(true);},style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px'}},'⚙️')
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
        // Posts list
        myPosts.map(function(p){
          return React.createElement('div',{key:p.id,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',marginBottom:'12px',overflow:'hidden'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'11px 12px 8px'}},
              React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
                avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'me',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},email.split('@')[0]),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},p.time)
              )
            ),
            React.createElement('div',{style:{padding:'0 12px 8px',fontSize:'13px',color:'var(--text)',lineHeight:1.6}},p.text),
            p.img ? React.createElement('img',{src:p.img,alt:'post',style:{width:'100%',height:'220px',objectFit:'cover',display:'block'}}) : null,
            p.likes.length>0 ? React.createElement('div',{style:{padding:'6px 12px',fontSize:'11px',color:'var(--t3)',borderTop:'1px solid var(--border)'}},
              '❤️ '+p.likes.join(', ')
            ) : null,
            React.createElement('div',{style:{display:'flex',borderTop:'1px solid var(--border)'}},
              React.createElement('button',{onClick:function(){toggleLike(p.id);},style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:p.liked?'#E84D9A':'var(--t2)',fontWeight:p.liked?700:400}},
                React.createElement('span',{style:{fontSize:'18px'}},p.liked?'❤️':'🤍'),p.likes.length,' Like'
              ),
              React.createElement('button',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}},
                React.createElement('span',{style:{fontSize:'16px'}},'💬'),' Comment'
              ),
              React.createElement('button',{onClick:function(){try{navigator.clipboard.writeText(p.text);}catch(e){}alert('Copied!');},style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}},
                React.createElement('span',{style:{fontSize:'16px'}},'↗'),' Share'
              )
            )
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
            React.createElement('span',{style:{fontSize:'10px',color:'var(--ac)',background:'var(--acg)',padding:'3px 8px',borderRadius:'20px'}},'Following')
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
