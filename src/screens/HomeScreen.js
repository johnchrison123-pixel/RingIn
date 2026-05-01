import React,{useState,useEffect} from 'react';
import '../styles/HomeScreen.css';
import CallScreen from './CallScreen';
import LiveWorkshopScreen from './LiveWorkshopScreen';

var CATS=[{id:'all',icon:'All',label:'All'},{id:'medical',icon:'Med',label:'Medical'},{id:'tech',icon:'Tech',label:'Tech'},{id:'legal',icon:'Law',label:'Legal'},{id:'trades',icon:'Fix',label:'Trades'},{id:'mental',icon:'Mind',label:'Mental'}];
var EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,category:'medical',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine.',tags:['General Medicine','Preventive Care'],img:'https://i.pravatar.cc/150?img=47'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,category:'tech',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google alumni.',tags:['System Design','React'],img:'https://i.pravatar.cc/150?img=12'},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,category:'mental',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience.',tags:['Career Strategy','LinkedIn'],img:'https://i.pravatar.cc/150?img=23'},{id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,calls:389,followers:'1.8k',online:true,category:'legal',color:'linear-gradient(135deg,#B8860B,#FFD700)',cover:'linear-gradient(135deg,#2e2200,#B8860B)',loc:'Dubai, UAE',bio:'Senior lawyer with 12 years in UAE corporate law.',tags:['Corporate Law','Contracts'],img:'https://i.pravatar.cc/150?img=33'},{id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,calls:521,followers:'2.7k',online:true,category:'mental',color:'linear-gradient(135deg,#9B59B6,#D98EF0)',cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)',loc:'Abu Dhabi',bio:'Clinical psychologist specializing in anxiety and stress.',tags:['Anxiety','CBT','Stress'],img:'https://i.pravatar.cc/150?img=44'},{id:6,initials:'JT',name:'James Tanner',role:'Fitness & Nutrition Coach',rate:50,rating:4.7,calls:298,followers:'4.1k',online:true,category:'mental',color:'linear-gradient(135deg,#E8401A,#FF6B35)',cover:'linear-gradient(135deg,#2e0a00,#E8401A)',loc:'Remote',bio:'Certified personal trainer and nutritionist.',tags:['Weight Loss','Nutrition','Fitness'],img:'https://i.pravatar.cc/150?img=15'}];
var WORKSHOPS=[{id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},{id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'}];

export default function HomeScreen(props){
  var acState = useState('all');
  var postsS=useState([{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',time:'2m ago',text:'Fever above 38.5C for more than 3 days needs medical attention. Stay hydrated and consult a doctor.',tags:['Health','Medical'],likes:47,comments:12,rate:120,expertId:1,img:'https://i.pravatar.cc/150?img=47',postImg:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',time:'15m ago',text:'The best code is code you do not write. Simplicity is the ultimate sophistication in engineering.',tags:['Tech','Engineering'],likes:93,comments:28,rate:80,expertId:2,img:'https://i.pravatar.cc/150?img=12',postImg:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80'}]);
  var posts=postsS[0]; var setPosts=postsS[1];
  var cpS=useState(null); var commentPost=cpS[0]; var setCommentPost=cpS[1];
  var ctS=useState(''); var commentText=ctS[0]; var setCommentText=ctS[1];
  function toggleLike(pid){setPosts(function(prev){return prev.map(function(p){if(p.id!==pid)return p;return Object.assign({},p,{liked:!p.liked,likes:p.liked?p.likes-1:p.likes+1});});});}
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var liveS=useState(null); var activeLive=liveS[0]; var setActiveLive=liveS[1];
  var ac = acState[0];
  var setAc = acState[1];
  var onViewExpert = props.onViewExpert;
  var onOpenWallet = props.onOpenWallet;
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
    // Search experts
    var experts = ALL_EXPERTS.filter(function(e){return e.name.toLowerCase().includes(ql)||e.role.toLowerCase().includes(ql);});
    // Search skills
    var skills = ALL_SKILLS.filter(function(s){return s.toLowerCase().includes(ql);});
    // Search workshops
    var workshops = ALL_WORKSHOPS.filter(function(w){return w.title.toLowerCase().includes(ql)||w.host.toLowerCase().includes(ql);});
    // Search real users from Supabase
    if(supabase){
      supabase.from('profiles').select('*').ilike('email',q+'%').then(function(res){
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
  var onOpenWallet = props.onOpenWallet;
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:50,onCoinsChange:function(){},onEnd:function(){setActiveCall(null);}});
  if(activeLive) return React.createElement(LiveWorkshopScreen,{workshop:activeLive,onLeave:function(){setActiveLive(null);}});
  var fe = ac==='all' ? EXPERTS : EXPERTS.filter(function(e){return e.category===ac;});
  var onlineExperts = fe.filter(function(e){return e.online===true;});

  function goToExpert(expert){
    if(onViewExpert) onViewExpert(expert);
  }

  function goToExpertById(id){
    var exp = EXPERTS.find(function(e){return e.id===id;});
    if(exp && onViewExpert) onViewExpert(exp);
  }

  if(selectedUser) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    // Cover
    React.createElement('div',{style:{height:'130px',background:'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)',position:'relative',flexShrink:0}},
      React.createElement('button',{onClick:function(){setSelectedUser(null);},style:{position:'absolute',top:'12px',left:'12px',background:'rgba(0,0,0,0.4)',border:'none',borderRadius:'20px',color:'#fff',padding:'5px 12px',cursor:'pointer',fontSize:'12px',fontWeight:600}},'< Back'),
      React.createElement('div',{style:{position:'absolute',bottom:'-36px',left:'18px',width:'72px',height:'72px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',overflow:'hidden',zIndex:2}},
        selectedUser.avatar_url ? React.createElement('img',{src:selectedUser.avatar_url,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}) : (selectedUser.full_name||selectedUser.email||'?').substring(0,2).toUpperCase()
      )
    ),
    React.createElement('div',{style:{padding:'44px 18px 12px'}},
      React.createElement('div',{style:{fontSize:'17px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},(selectedUser.full_name||selectedUser.email||'').split('@')[0]),
      React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginBottom:'4px'}},'RingIn Member'),
      React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginBottom:'16px'}},'Joined '+new Date(selectedUser.created_at||Date.now()).toLocaleDateString('en-US',{month:'long',year:'numeric'})),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        [{v:'0',l:'Calls'},{v:'0',l:'Posts'},{v:'0',l:'Reviews'}].map(function(s){
          return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
            React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)'}},s.v),
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},s.l)
          );
        })
      ),
      React.createElement('button',{style:{width:'100%',padding:'12px',background:'var(--ac)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',marginBottom:'8px'}},'+ Follow'),
      React.createElement('button',{style:{width:'100%',padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}},'Message')
    )
  );

  return React.createElement('div', {className:'hc'},
    React.createElement('div', {className:'topbar'},
      React.createElement('div', {className:'brand'}, 'RingIn'),
      React.createElement('div', {className:'tbr'},
        React.createElement('div', {className:'wchip', onClick:function(){if(onOpenWallet)onOpenWallet();}, style:{cursor:'pointer'}},
          React.createElement('div', {className:'wc'}, 'C'),
          React.createElement('span', null, '1,240')
        ),
        React.createElement('div', {className:'ibt', onClick:function(){setShowNotif(!showNotif);}, style:{cursor:'pointer',position:'relative'}},
          React.createElement('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'var(--t2)',strokeWidth:2,width:15,height:15},
            React.createElement('path', {d:'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'})
          ),
          React.createElement('div', {className:'nd'})
        )
      )
    ),
    showNotif ? React.createElement('div', {style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:999}},
      React.createElement('div', {onClick:function(){setShowNotif(false);}, style:{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)'}}),
      React.createElement('div', {style:{position:'absolute',top:0,left:0,right:0,background:'var(--bg)',borderBottomLeftRadius:'16px',borderBottomRightRadius:'16px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)',zIndex:1000,maxHeight:'80vh',overflowY:'auto'}},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px 10px'}},
          React.createElement('div', {style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Notifications'),
          React.createElement('button', {onClick:function(){setShowNotif(false);}, style:{background:'none',border:'none',color:'var(--t2)',fontSize:'18px',cursor:'pointer'}},'✕')
        ),
        NOTIFS.map(function(n){
          return React.createElement('div', {key:n.id, style:{display:'flex',alignItems:'flex-start',gap:'12px',padding:'12px 18px',borderTop:'1px solid var(--border)',background:n.unread?'rgba(123,110,255,0.06)':'transparent'}},
            React.createElement('div', {style:{fontSize:'20px',flexShrink:0}}, n.icon),
            React.createElement('div', {style:{flex:1}},
              React.createElement('div', {style:{fontSize:'12px',color:'var(--text)',lineHeight:1.4,marginBottom:'3px'}}, n.text),
              React.createElement('div', {style:{fontSize:'10px',color:'var(--t3)'}}, n.time)
            ),
            n.unread ? React.createElement('div', {style:{width:'7px',height:'7px',borderRadius:'50%',background:'var(--ac)',flexShrink:0,marginTop:'4px'}}) : null
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
        // Users results
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
              React.createElement('button',{onClick:function(ev){ev.stopPropagation();setSearchQ('');if(props.session&&props.session.user&&u.id===props.session.user.id){if(props.onGoToProfile)props.onGoToProfile();}else{setSelectedUser(u);}},style:{padding:'5px 12px',background:'var(--acg)',border:'1px solid var(--ac)',borderRadius:'20px',color:'var(--ac)',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'View Profile')
            );
          })
        ) : null,
        // Experts results
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
        // Skills results
        searchRes.skills && searchRes.skills.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Skills'),
          React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px'}},
            searchRes.skills.map(function(s,i){
              return React.createElement('div',{key:i,style:{padding:'6px 12px',background:'var(--acg)',border:'1px solid var(--ac)',borderRadius:'20px',fontSize:'12px',color:'var(--ac)',cursor:'pointer'}},s);
            })
          )
        ) : null,
        // Workshops results
        searchRes.workshops && searchRes.workshops.length>0 ? React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Workshops'),
          searchRes.workshops.map(function(w,i){
            return React.createElement('div',{key:i,onClick:function(){setSearchQ('');if(props.session&&props.session.user&&u.id===props.session.user.id){if(props.onGoToProfile)props.onGoToProfile();}else{setSelectedUser(u);}},style:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
              React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'10px',background:'linear-gradient(135deg,#1a1a2e,#534AB7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}},'🎓'),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},w.title),
                React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'by '+w.host)
              )
            );
          })
        ) : null,
        // No results
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
    React.createElement('div', {className:'sh'},
      React.createElement('div', {className:'st'}, 'Live Workshops'),
      React.createElement('div', {className:'sa'}, 'See all')
    ),
    WORKSHOPS.map(function(w){
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
    React.createElement('div', {className:'composer'},
      React.createElement('div', {className:'comp-top'},
        React.createElement('div', {className:'comp-av'}, 'Y'),
        React.createElement('textarea', {className:'comp-ta', placeholder:'Share something...'})
      ),
      React.createElement('div', {className:'comp-btns'},
        React.createElement('div', {className:'comp-att'},
          React.createElement('div', {className:'comp-att-btn'}, 'Photo'),
          React.createElement('div', {className:'comp-att-btn'}, 'Video')
        ),
        React.createElement('button', {className:'comp-post-btn', onClick:function(){alert('Post submitted!');}}, 'Post')
      )
    ),
    React.createElement('div', {style:{padding:'0 18px'}},
      posts.map(function(p){
        return React.createElement('div', {key:p.id, className:'fpost'},
          React.createElement('div', {className:'ph'},
            React.createElement('div', {
              className:'pav',
              style:{background:p.color, cursor:'pointer', overflow:'hidden', padding:0},
              onClick:function(){goToExpertById(p.expertId);}
            }, p.img ? React.createElement('img',{src:p.img,alt:p.name,style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}) : p.initials),
            React.createElement('div', null,
              React.createElement('div', {
                className:'pn',
                style:{cursor:'pointer'},
                onClick:function(){goToExpertById(p.expertId);}
              }, p.name),
              React.createElement('div', {className:'pr'}, p.role)
            ),
            React.createElement('div', {className:'pt'}, p.time)
          ),
          p.postImg ? React.createElement('img',{src:p.postImg,alt:'post',style:{width:'100%',height:'280px',objectFit:'cover',display:'block'}}) : null,
          React.createElement('div', {className:'pb'},
            React.createElement('div', {className:'ptxt'}, p.text),
            React.createElement('div', null,
              p.tags.map(function(t){return React.createElement('span', {key:t, className:'ptag'}, '#'+t);})
            )
          ),
          React.createElement('div', {className:'cstrip'},
            React.createElement('span', {className:'cstrip-l'}, 'Call '+p.name.split(' ')[1]),
            React.createElement('span', {className:'cstrip-r'}, p.rate+' coins/min')
          ),
          React.createElement('div', {className:'pacts'},
            React.createElement('button', {className:'pa'+(p.liked?' liked':''), style:{color:p.liked?'#E84D9A':'var(--t2)',fontSize:'13px',fontWeight:p.liked?700:400,gap:'5px'}, onClick:function(){toggleLike(p.id);}}, React.createElement('span',{style:{fontSize:'18px',lineHeight:1}},p.liked?'❤️':'🤍'), React.createElement('span',null,p.likes)),
            React.createElement('button', {className:'pa', onClick:function(){setCommentPost(commentPost===p.id?null:p.id);}}, '💬 '+p.comments.length+' Comments'),
            React.createElement('button', {className:'pa', onClick:function(){if(navigator.share){navigator.share({title:p.name,text:p.text});}else{try{navigator.clipboard.writeText(p.text);}catch(e){}alert('Copied!');}}}, '↗ Share')
          )
        );
      })
    ),
    React.createElement('div', {style:{height:'12px'}})
  );
}
