import React,{useState} from 'react';
import '../styles/HomeScreen.css';

const CATS=[{id:'all',icon:'All',label:'All'},{id:'medical',icon:'Med',label:'Medical'},{id:'tech',icon:'Tech',label:'Tech'},{id:'legal',icon:'Law',label:'Legal'},{id:'trades',icon:'Fix',label:'Trades'},{id:'mental',icon:'Mind',label:'Mental'}];
const EXPERTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,online:true,category:'medical',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)'},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,online:true,category:'tech',color:'linear-gradient(135deg,#534AB7,#7C6FFF)'},{id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,online:true,category:'mental',color:'linear-gradient(135deg,#C84B8A,#E84D9A)'},{id:4,initials:'JO',name:'James Okafor',role:'Corporate Lawyer',rate:150,rating:4.9,online:false,category:'legal',color:'linear-gradient(135deg,#B8860B,#F5A623)'},{id:5,initials:'AM',name:'Dr. Aisha Malik',role:'Psychologist',rate:100,rating:4.9,online:true,category:'mental',color:'linear-gradient(135deg,#6A4C93,#9B72CF)'}];
const WORKSHOPS=[{id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},{id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'}];
const POSTS=[{id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',time:'2m ago',emoji:'medical',text:'Fever above 38.5C for more than 3 days needs medical attention.',tags:['Health','Medical'],likes:47,comments:12,rate:120},{id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',time:'15m ago',emoji:'tech',text:'The best code is code you do not write.',tags:['Tech','Engineering'],likes:93,comments:28,rate:80}];

export default function HomeScreen(){
  var ac = useState('all');
  var activecat = ac[0];
  var setAc = ac[1];
  var fe = activecat==='all' ? EXPERTS : EXPERTS.filter(function(e){return e.category===activecat;});
  var onlineExperts = fe.filter(function(e){return e.online===true;});

  return React.createElement('div', {className:'hc'},
    React.createElement('div', {className:'topbar'},
      React.createElement('div', {className:'brand'}, 'RingIn'),
      React.createElement('div', {className:'tbr'},
        React.createElement('div', {className:'wchip'},
          React.createElement('div', {className:'wc'}, 'C'),
          React.createElement('span', null, '1,240')
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
        return React.createElement('div', {key:c.id, className:'cp'+(activecat===c.id?' on':''), onClick:function(){setAc(c.id);}},
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
        return React.createElement('div', {key:e.id, className:'ecsm'},
          React.createElement('div', {className:'eav', style:{background:e.color}},
            e.initials,
            React.createElement('div', {className:'or'})
          ),
          React.createElement('div', {className:'enm'}, e.name),
          React.createElement('div', {className:'erl'}, e.role),
          React.createElement('div', {style:{fontSize:'9px',color:'var(--amber)',marginBottom:'4px'}}, e.rate+' coins/min'),
          React.createElement('button', {className:'cbtn'}, 'Call Now')
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
            React.createElement('div', {className:'wb-live-dot'}),
            'LIVE'
          ),
          React.createElement('div', {className:'wb-viewers'}, w.viewers+' viewers')
        ),
        React.createElement('div', {className:'wb-info'},
          React.createElement('div', {className:'wb-title'}, w.title),
          React.createElement('div', {className:'wb-meta'},
            React.createElement('span', {className:'wb-host'}, 'by '+w.host),
            w.free ? React.createElement('span', {className:'wb-free'}, 'FREE') : React.createElement('span', {style:{fontSize:'10px',color:'var(--ac)'}}, w.price+' coins')
          ),
          React.createElement('div', {className:'wb-actions'},
            React.createElement('button', {className:'wb-join'}, 'Join Live')
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
        React.createElement('button', {className:'comp-post-btn'}, 'Post')
      )
    ),
    React.createElement('div', {style:{padding:'0 18px'}},
      POSTS.map(function(p){
        return React.createElement('div', {key:p.id, className:'fpost'},
          React.createElement('div', {className:'ph'},
            React.createElement('div', {className:'pav', style:{background:p.color}}, p.initials),
            React.createElement('div', null,
              React.createElement('div', {className:'pn'}, p.name),
              React.createElement('div', {className:'pr'}, p.role)
            ),
            React.createElement('div', {className:'pt'}, p.time)
          ),
          React.createElement('div', {className:'piph'}, p.emoji),
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
            React.createElement('button', {className:'pa'}, p.likes+' Likes'),
            React.createElement('button', {className:'pa'}, p.comments+' Comments'),
            React.createElement('button', {className:'pa'}, 'Share')
          )
        );
      })
    ),
    React.createElement('div', {style:{height:'12px'}})
  );
}
