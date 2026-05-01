/* eslint-disable */
import React,{useState,useEffect} from 'react';

export default function ProfileScreen({session, supabase, onOpenWallet}){
  var email = session && session.user ? session.user.email : '';
  var initials = email ? email.substring(0,2).toUpperCase() : 'ME';
  var settingsS=useState(false); var showSettings=settingsS[0]; var setShowSettings=settingsS[1];
  var tabS=useState('posts'); var activeTab=tabS[0]; var setActiveTab=tabS[1];
  var rateS=useState(0); var rateVal=rateS[0]; var setRateVal=rateS[1];
  var rateDoneS=useState(false); var rateDone=rateDoneS[0]; var setRateDone=rateDoneS[1];
  var showRateS=useState(false); var showRate=showRateS[0]; var setShowRate=showRateS[1];

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

  var postsS=useState([
    {id:1,text:'Just had an incredible consultation with Dr. Priya Nair. She explained everything so clearly. Highly recommend her to anyone!',likes:['Ahmed K.','Fatima M.','Sara Z.'],liked:false,time:'1h ago',img:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80',comments:[]},
    {id:2,text:'Learning system design with Ravi Menon on RingIn. Best investment I made this month. Already cracked 2 interviews!',likes:['Ravi M.','James T.','Layla K.'],liked:false,time:'Yesterday',img:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',comments:[]},
    {id:3,text:'Sara Al Zaabi helped me rebuild my LinkedIn profile from scratch. Got 3 recruiter messages in one week after that session!',likes:['Dr. Priya','Ahmed K.','Fatima M.'],liked:false,time:'2 days ago',img:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',comments:[]},
  ]); var myPosts=postsS[0]; var setMyPosts=postsS[1];
  var postTextS=useState(''); var postText=postTextS[0]; var setPostText=postTextS[1];
  var showEmojiS=useState(false); var showEmoji=showEmojiS[0]; var setShowEmoji=showEmojiS[1];
  var EMOJIS=['😊','😂','❤️','🔥','👏','🎉','💪','🙌','😍','🤔','👍','✨','🚀','💡','🎯'];

  // Settings panel
  if(showSettings) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)'}},
      React.createElement('button',{onClick:function(){setShowSettings(false);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer'}},'<'),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Settings')
    ),
    React.createElement('div',{style:{padding:'12px 18px'}},
      // Stats
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        [{v:'12',l:'Calls Made',icon:'📞'},{v:'1,240',l:'Coins',icon:'🪙'},{v:'4.8★',l:'Avg Rating',icon:'⭐'}].map(function(s){
          return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',textAlign:'center',cursor:s.l==='Coins'?'pointer':'default'},onClick:function(){if(s.l==='Coins'&&onOpenWallet){setShowSettings(false);onOpenWallet();}}},
            React.createElement('div',{style:{fontSize:'20px',marginBottom:'4px'}},s.icon),
            React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)',marginBottom:'2px'}},s.v),
            React.createElement('div',{style:{fontSize:'9px',color:'var(--t2)'}},s.l)
          );
        })
      ),
      // Menu items
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}},
        [
          {icon:'🎓',label:'Become an Expert',sub:'Start earning by sharing your knowledge',action:function(){alert('Expert application coming soon!');}},
          {icon:'🔔',label:'Notifications',sub:'Manage your alerts',action:function(){alert('Notification settings coming soon!');}},
          {icon:'🔒',label:'Privacy & Security',sub:'Password, 2FA, data',action:function(){alert('Privacy settings coming soon!');}},
          {icon:'💬',label:'Help & Support',sub:'FAQs and contact us',action:function(){window.open('mailto:support@ringin.app');}},
          {icon:'⭐',label:'Rate the App',sub:'Enjoying RingIn? Let us know!',action:function(){setShowRate(true);}},
        ].map(function(item,i){
          return React.createElement('div',{key:i,onClick:item.action,style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
            React.createElement('span',{style:{fontSize:'18px',width:'28px',textAlign:'center'}},item.icon),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}},item.label),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},item.sub)
            ),
            React.createElement('span',{style:{color:'var(--t3)',fontSize:'16px'}},'›')
          );
        })
      ),
      // Rate modal
      showRate ? React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}},
        rateDone ? React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'32px',marginBottom:'8px'}},'🎉'),
          React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}}),'Thanks for rating us!',
          React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',marginTop:'4px'}},rateVal+' stars — we appreciate it!')
        ) : React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'12px'}},'Rate RingIn'),
          React.createElement('div',{style:{display:'flex',justifyContent:'center',gap:'8px',marginBottom:'16px'}},
            [1,2,3,4,5].map(function(s){
              return React.createElement('span',{key:s,onClick:function(){setRateVal(s);},style:{fontSize:'32px',cursor:'pointer',opacity:s<=rateVal?1:0.3}},s<=rateVal?'⭐':'☆');
            })
          ),
          rateVal>0 && React.createElement('button',{onClick:function(){setRateDone(true);},style:{padding:'10px 24px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer'}},'Submit Rating')
        )
      ) : null,
      React.createElement('button',{
        style:{width:'100%',padding:'13px',background:'rgba(239,71,71,.1)',border:'1px solid rgba(239,71,71,.3)',borderRadius:'12px',color:'var(--red)',fontSize:'14px',fontWeight:600,cursor:'pointer'},
        onClick:function(){supabase.auth.signOut();}
      },'Sign Out')
    )
  );

  // Main profile page
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    // Cover photo
    React.createElement('div',{style:{height:'130px',background:coverUrl?'none':'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)',position:'relative',flexShrink:0,cursor:'pointer',overflow:'hidden'}},
      coverUrl ? React.createElement('img',{src:coverUrl,alt:'cover',style:{width:'100%',height:'100%',objectFit:'cover'}}) : null,
      React.createElement('label',{style:{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'4px 10px',fontSize:'10px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}},
        uploading?'Uploading...':'✏️ Edit Cover',
        React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0])uploadCover(e.target.files[0]);}})
      ),
      // Avatar
      React.createElement('div',{style:{position:'absolute',bottom:'-36px',left:'18px',width:'72px',height:'72px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',cursor:'pointer',zIndex:2,overflow:'hidden'}},
        avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials,
        React.createElement('label',{style:{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',height:'24px',cursor:'pointer',fontSize:'12px'}},
          uploading?'..':'📷',
          React.createElement('input',{type:'file',accept:'image/*',capture:'user',style:{display:'none'},onChange:function(e){if(e.target.files[0])uploadAvatar(e.target.files[0]);}})
        )
      )
    ),
    // Name row
    React.createElement('div',{style:{padding:'44px 18px 8px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
      React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'17px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},email.split('@')[0]),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginBottom:'6px'}},email),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)'}},'Member since April 2026')
      ),
      React.createElement('button',{onClick:function(){setShowSettings(true);},style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px'}},'⚙️')
    ),
    // Stats row
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'0 18px 14px'}},
      [{v:'12',l:'Calls'},{v:'1,240',l:'Coins'},{v:'0',l:'Reviews'}].map(function(s){
        return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)'}},s.v),
          React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},s.l)
        );
      })
    ),
    // Tabs
    React.createElement('div',{style:{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:'12px',padding:'0 18px'}},
      ['posts','friends','skills','reviews'].map(function(t){
        return React.createElement('div',{key:t,onClick:function(){setActiveTab(t);},style:{flex:1,padding:'8px 4px',textAlign:'center',fontSize:'11px',fontWeight:activeTab===t?700:500,color:activeTab===t?'var(--ac)':'var(--t2)',cursor:'pointer',borderBottom:activeTab===t?'2px solid var(--ac)':'2px solid transparent',textTransform:'capitalize'}},t);
      })
    ),
    // Tab content
    React.createElement('div',{style:{padding:'0 18px 80px'}},
      activeTab==='posts' ? React.createElement('div',null,
        // Composer
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px',marginBottom:'14px'}},
          React.createElement('div',{style:{display:'flex',gap:'10px',alignItems:'flex-start',marginBottom:'10px'}},
            React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},initials),
            React.createElement('textarea',{
              value:postText,
              onChange:function(e){setPostText(e.target.value);},
              placeholder:"What's on your mind?",
              style:{flex:1,background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',padding:'9px 11px',fontSize:'13px',color:'var(--text)',outline:'none',resize:'none',minHeight:'70px',fontFamily:'DM Sans,sans-serif',lineHeight:1.5}
            })
          ),
          // Emoji picker
          showEmoji ? React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',padding:'8px',background:'var(--bg4)',borderRadius:'10px',marginBottom:'8px'}},
            EMOJIS.map(function(em){
              return React.createElement('span',{key:em,onClick:function(){setPostText(function(t){return t+em;});setShowEmoji(false);},style:{fontSize:'22px',cursor:'pointer',padding:'2px'}},em);
            })
          ) : null,
          // Action buttons row
          React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            React.createElement('div',{style:{display:'flex',gap:'6px'}},
              React.createElement('button',{onClick:function(){alert('Image upload coming soon!');},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'11px',cursor:'pointer',fontWeight:500}},
                React.createElement('span',null,'🖼️'),'Photo'
              ),
              React.createElement('button',{onClick:function(){alert('GIF picker coming soon!');},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'11px',cursor:'pointer',fontWeight:500}},
                React.createElement('span',null,'🎞️'),'GIF'
              ),
              React.createElement('button',{onClick:function(){setShowEmoji(!showEmoji);},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:showEmoji?'var(--acg)':'var(--bg4)',border:'1px solid '+(showEmoji?'var(--ac)':'var(--border)'),borderRadius:'20px',color:showEmoji?'var(--ac)':'var(--t2)',fontSize:'11px',cursor:'pointer',fontWeight:500}},
                React.createElement('span',null,'😊'),'Emoji'
              )
            ),
            React.createElement('button',{
              onClick:function(){
                if(!postText.trim()){alert('Write something first!');return;}
                var newPost={id:Date.now(),text:postText,likes:[],liked:false,time:'Just now',img:null,comments:[]};
                setMyPosts(function(prev){return [newPost,...prev];});
                setPostText('');
              },
              style:{padding:'7px 18px',background:'var(--ac)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}
            },'Post')
          )
        ),
        // Posts list
        myPosts.map(function(p){
          return React.createElement('div',{key:p.id,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',marginBottom:'12px',overflow:'hidden'}},
            // Post header
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'11px 12px 8px'}},
              React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},initials),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},email.split('@')[0]),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},p.time)
              )
            ),
            // Post text
            React.createElement('div',{style:{padding:'0 12px 8px',fontSize:'13px',color:'var(--text)',lineHeight:1.6}},p.text),
            // Post image
            p.img ? React.createElement('img',{src:p.img,alt:'post',style:{width:'100%',height:'220px',objectFit:'cover',display:'block'}}) : null,
            // Likes count
            p.likes.length>0 ? React.createElement('div',{style:{padding:'6px 12px',fontSize:'11px',color:'var(--t3)',borderTop:'1px solid var(--border)'}},
              '❤️ '+p.likes.join(', ')+' liked this'
            ) : null,
            // Action buttons
            React.createElement('div',{style:{display:'flex',borderTop:'1px solid var(--border)'}},
              React.createElement('button',{
                onClick:function(){setMyPosts(function(prev){return prev.map(function(pp){if(pp.id!==p.id)return pp;var newLikes=p.liked?p.likes.slice(0,-1):[...p.likes,'You'];return Object.assign({},pp,{liked:!pp.liked,likes:newLikes});});});},
                style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:p.liked?'#E84D9A':'var(--t2)',fontWeight:p.liked?700:400}
              },React.createElement('span',{style:{fontSize:'18px'}},p.liked?'❤️':'🤍'),p.likes.length,' Like'),
              React.createElement('button',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}},
                React.createElement('span',{style:{fontSize:'16px'}},'💬'),'Comment'
              ),
              React.createElement('button',{
                onClick:function(){try{navigator.clipboard.writeText(p.text);}catch(e){}alert('Copied!');},
                style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
              },React.createElement('span',{style:{fontSize:'16px'}},'↗'),'Share')
            )
          );
        })
      ) : null,
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
      activeTab==='reviews' ? React.createElement('div',null,
        REVIEWS.length===0 ? React.createElement('div',{style:{textAlign:'center',padding:'32px',color:'var(--t2)',fontSize:'13px'}},'No reviews yet') :
        REVIEWS.map(function(r,i){
          return React.createElement('div',{key:i,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'10px'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}},
              React.createElement('div',{style:{width:'32px',height:'32px',borderRadius:'50%',overflow:'hidden',background:'var(--bg4)',flexShrink:0}},
                React.createElement('img',{src:r.img,alt:r.name,style:{width:'100%',height:'100%',objectFit:'cover'}})
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--text)'}},r.name),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--amber)'}},'⭐'.repeat(r.rating))
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
