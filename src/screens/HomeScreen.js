import React,{useState} from 'react';
import '../styles/HomeScreen.css';
import CallScreen from './CallScreen';
import LiveWorkshopScreen from './LiveWorkshopScreen';

var CATS=[{id:'all',icon:'All',label:'All'},{id:'medical',icon:'Med',label:'Medical'},{id:'tech',icon:'Tech',label:'Tech'},{id:'legal',icon:'Law',label:'Legal'},{id:'trades',icon:'Fix',label:'Trades'},{id:'mental',icon:'Mind',label:'Mental'}];
var EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,category:'medical',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine.',tags:['General Medicine','Preventive Care']},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,category:'tech',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google alumni.',tags:['System Design','React']},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,category:'mental',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience.',tags:['Career Strategy','LinkedIn']}];
var WORKSHOPS=[{id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},{id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'}];

export default function HomeScreen(props){
  var acState = useState('all');
  var postsS=useState([{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',time:'2m ago',text:'Fever above 38.5C for more than 3 days needs medical attention.',tags:['Health','Medical'],likes:47,comments:12,rate:120,expertId:1},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',time:'15m ago',text:'The best code is code you do not write.',tags:['Tech','Engineering'],likes:93,comments:28,rate:80,expertId:2}];);
  var posts=postsS[0]; var setPosts=postsS[1];
  function toggleLike(pid){setPosts(function(prev){return prev.map(function(p){if(p.id!==pid)return p;return Object.assign({},p,{liked:!p.liked,likes:p.liked?p.likes-1:p.likes+1});});});}
  function addComment(pid,txt){if(!txt.trim())return;setPosts(function(prev){return prev.map(function(p){if(p.id!==pid)return p;var nc={id:Date.now(),text:txt,author:'You'};return Object.assign({},p,{comments:p.comments.concat([nc])});});});}
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var liveS=useState(null); var activeLive=liveS[0]; var setActiveLive=liveS[1];
  var ac = acState[0];
  var setAc = acState[1];
  var onViewExpert = props.onViewExpert;
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

  return React.createElement('div', {className:'hc'},
    React.createElement('div', {className:'topbar'},
      React.createElement('div', {className:'brand'}, 'RingIn'),
      React.createElement('div', {className:'tbr'},
        React.createElement('div', {className:'wchip'},
          React.createElement('div', {className:'wc'}, 'C'),
          React.createElement('span', null, '1,240')
        ),
        React.createElement('div', {className:'ibt'},
          React.createElement('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'var(--t2)',strokeWidth:2,width:15,height:15},
            React.createElement('path', {d:'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'})
          ),
          React.createElement('div', {className:'nd'})
        )
      )
    ),
    React.createElement('div', {className:'sbwrap'},
      React.createElement('div', {className:'sbar'},
        React.createElement('input', {placeholder:'Search experts, topics, skills...'})
      ),
      React.createElement('div', {className:'frow'},
        React.createElement('div', {className:'ftag on'}, 'All Locations'),
        React.createElement('div', {className:'ftag'}, 'Dubai'),
        React.createElement('div', {className:'ftag'}, 'Abu Dhabi'),
        React.createElement('div', {className:'ftag'}, 'Online Only')
      )
    ),
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
    React.createElement('div', {className:'esc'},
      onlineExperts.map(function(e){
        return React.createElement('div', {key:e.id, className:'ecsm', style:{cursor:'pointer'}, onClick:function(){goToExpert(e);}},
          React.createElement('div', {className:'eav', style:{background:e.color}},
            e.initials,
            React.createElement('div', {className:'or'})
          ),
          React.createElement('div', {className:'enm'}, e.name),
          React.createElement('div', {className:'erl'}, e.role),
          React.createElement('div', {style:{fontSize:'9px',color:'var(--amber)',marginBottom:'4px'}}, e.rate+' coins/min'),
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
              style:{background:p.color, cursor:'pointer'},
              onClick:function(){goToExpertById(p.expertId);}
            }, p.initials),
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
          React.createElement('div', {className:'piph'}, 'post'),
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
            React.createElement('button', {className:'pa'+(p.liked?' liked':''), style:{color:p.liked?'var(--ac)':'var(--t2)'}, onClick:function(){toggleLike(p.id);}}, (p.liked?'❤ ':'🤍 ')+p.likes+' Likes'),
            React.createElement('button', {className:'pa', onClick:function(){setCommentPost(commentPost===p.id?null:p.id);}}, '💬 '+p.comments.length+' Comments'),
            React.createElement('button', {className:'pa', onClick:function(){if(navigator.share){navigator.share({title:p.name,text:p.text});}else{try{navigator.clipboard.writeText(p.text);}catch(e){}alert('Copied!');}}}, '↗ Share')
          )
        );
      })
    ),
    React.createElement('div', {style:{height:'12px'}})
  );
}
