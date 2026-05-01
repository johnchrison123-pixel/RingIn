/* eslint-disable */
import React,{useState} from 'react';

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

  var POSTS=[
    {text:'Just had an amazing call with Dr. Priya! Highly recommend.',likes:12,time:'1h ago'},
    {text:'Learning React step by step with RingIn experts.',likes:8,time:'Yesterday'},
  ];

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
    React.createElement('div',{style:{height:'130px',background:'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)',position:'relative',flexShrink:0,cursor:'pointer'}},
      React.createElement('div',{style:{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.4)',borderRadius:'20px',padding:'4px 10px',fontSize:'10px',color:'#fff',cursor:'pointer'}},'✏️ Edit Cover'),
      // Avatar
      React.createElement('div',{style:{position:'absolute',bottom:'-36px',left:'18px',width:'72px',height:'72px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',cursor:'pointer',zIndex:2}},
        initials,
        React.createElement('div',{style:{position:'absolute',bottom:'2px',right:'2px',background:'var(--ac)',borderRadius:'50%',width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',border:'2px solid var(--bg)'}},'✏️')
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
        POSTS.map(function(p,i){
          return React.createElement('div',{key:i,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'10px'}},
            React.createElement('div',{style:{fontSize:'12px',color:'var(--text)',lineHeight:1.5,marginBottom:'8px'}},p.text),
            React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},p.time),
              React.createElement('span',{style:{fontSize:'11px',color:'var(--t2)'}},'❤️ '+p.likes)
            )
          );
        }),
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px dashed var(--border)',borderRadius:'12px',padding:'20px',textAlign:'center',cursor:'pointer'}},
          React.createElement('div',{style:{fontSize:'24px',marginBottom:'6px'}},'✏️'),
          React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)'}},'Write a post')
        )
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
