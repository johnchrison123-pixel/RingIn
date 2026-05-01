/* eslint-disable */
import React,{useState,useEffect} from 'react';
import CallScreen from './CallScreen';

const EXPERTS = [
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine. Specializes in preventive care and chronic disease management.',tags:['General Medicine','Preventive Care','Chronic Disease'],img:'https://i.pravatar.cc/150?img=47'},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google and Meta alumni. Specializes in system design and technical interviews.',tags:['System Design','React','Node.js'],img:'https://i.pravatar.cc/150?img=12'},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience. Helped 500+ professionals land their dream jobs.',tags:['Career Strategy','LinkedIn','Interviews'],img:'https://i.pravatar.cc/150?img=23'},
];

function ExpertProfile({expert, onBack, onCall}){
  var follow = useState(false);
  var isFollowing = follow[0];
  var setFollow = follow[1];

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto',position:'relative'}},
    React.createElement('button', {
      onClick:onBack,
      style:{position:'absolute',top:'12px',left:'12px',zIndex:10,background:'rgba(0,0,0,.4)',border:'none',borderRadius:'20px',color:'#fff',padding:'5px 10px',cursor:'pointer',fontSize:'12px',fontWeight:600}
    }, '< Back'),
    React.createElement('div', {style:{position:'relative',flexShrink:0}},
      React.createElement('div', {style:{height:'140px',background:expert.cover}}),
      React.createElement('div', {style:{position:'absolute',bottom:'-36px',left:'16px',width:'72px',height:'72px',borderRadius:'50%',background:expert.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:'700',color:'#fff',border:'4px solid #09090E',zIndex:5,overflow:'hidden'}}, expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}) : expert.initials)
    ),
    React.createElement('div', {style:{height:'44px'}}),
    React.createElement('div', {style:{padding:'0 16px'}},
      React.createElement('div', {style:{display:'flex',alignItems:'flex-end',justifyContent:'flex-end',marginBottom:'10px'}},
        React.createElement('div', {style:{display:'none'}}, expert.initials),
        React.createElement('div', {style:{display:'flex',gap:'6px',paddingBottom:'4px'}},
          React.createElement('button', {
            onClick:function(){setFollow(!isFollowing);},
            style:{padding:'6px 12px',background:isFollowing?'var(--acg)':'var(--ac)',border:isFollowing?'1px solid var(--ac)':'none',borderRadius:'8px',color:isFollowing?'var(--ac)':'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}
          }, isFollowing ? 'Following' : '+ Follow'),
          React.createElement('button', {onClick:function(){alert('Message '+expert.name+' coming soon!');},style:{padding:'6px 12px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer'}}, 'Message'),
          React.createElement('button', {onClick:function(){if(onCall)onCall(expert);},style:{padding:'6px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}}, 'Call')
        )
      ),
      React.createElement('div', {style:{fontSize:'15px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}}, expert.name),
      React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',marginBottom:'6px'}}, expert.role),
      React.createElement('div', {style:{display:'flex',gap:'6px',marginBottom:'8px',flexWrap:'wrap'}},
        (expert.online) ? React.createElement('span', {style:{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'9px',color:'var(--green)',background:'rgba(39,201,106,.1)',padding:'2px 7px',borderRadius:'20px'}},
          React.createElement('span', {style:{width:'4px',height:'4px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}),
          'Online'
        ) : null,
        React.createElement('span', {style:{fontSize:'9px',color:'var(--t2)',background:'var(--bg4)',padding:'2px 7px',borderRadius:'20px'}}, (expert.loc||''))
      ),
      React.createElement('div', {style:{fontSize:'11px',color:'var(--text)',lineHeight:1.6,marginBottom:'10px'}}, (expert.bio||'')),
      React.createElement('div', {style:{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'12px'}},
        (expert.tags||[]).map(function(t){return React.createElement('span', {key:t,style:{fontSize:'10px',padding:'3px 8px',borderRadius:'20px',background:'var(--acg)',color:'var(--ac)'}}, t);})
      ),
      React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        [{v:expert.rating,l:'Rating'},{v:expert.calls,l:'Calls'},{v:(expert.followers||'0'),l:'Followers'},{v:expert.rate+'/m',l:'Rate'}].map(function(s){
          return React.createElement('div', {key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'8px',textAlign:'center'}},
            React.createElement('div', {style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, s.v),
            React.createElement('div', {style:{fontSize:'9px',color:'var(--t3)'}}, s.l)
          );
        })
      ),
      React.createElement('div', {style:{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:'12px'}},
        ['Posts','Reviews','About'].map(function(t){
          return React.createElement('div', {key:t,style:{flex:1,padding:'8px',textAlign:'center',fontSize:'11px',fontWeight:500,color:'var(--t2)',cursor:'pointer',borderBottom:'2px solid transparent'}}, t);
        })
      ),
      React.createElement('div', {style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',marginBottom:'8px'}},
        React.createElement('div', {style:{fontSize:'12px',color:'var(--text)',lineHeight:1.5}},'No posts yet.')
      )
    )
  );
}

export default function SearchScreen(props){
  var onOpenWallet = props.onOpenWallet;
  var sel = useState(props.initExpert || null);
  var selected = sel[0];
  var setSelected = sel[1];
  var callS=useState(null); var activeCall=callS[0]; var setActiveCall=callS[1];
  var coinsS=useState(50); var coins=coinsS[0]; var setCoins=coinsS[1];
  var ac = useState('all');
  var activecat = ac[0];
  var setAc = ac[1];
  useEffect(function(){ if(props.initExpert) setSelected(props.initExpert); }, [props.initExpert]);
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,coins:coins,onCoinsChange:setCoins,onEnd:function(){setActiveCall(null);}});
  if(selected){
    return React.createElement(ExpertProfile, {
    expert:selected,
    onCall:function(exp){setActiveCall(exp);},
    onBack:function(){
      setSelected(null);
      if(props.onBack) props.onBack();
    }
  });
  }

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px'}},
      React.createElement('div', {style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}, 'Experts'),
      React.createElement('div', {onClick:function(){if(onOpenWallet)onOpenWallet();}, style:{display:'flex',alignItems:'center',gap:'5px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'4px 10px',fontSize:'12px',color:'var(--text)',cursor:'pointer'}},
        React.createElement('div', {style:{width:'15px',height:'15px',borderRadius:'50%',background:'linear-gradient(135deg,#F5A623,#f97316)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7px',color:'#fff',fontWeight:700}}, 'C'),
        React.createElement('span', null, '1,240')
      )
    ),
    React.createElement('div', {style:{padding:'0 18px 8px'}},
      React.createElement('div', {style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'7px 11px',display:'flex',alignItems:'center',gap:'7px'}},
        React.createElement('input', {placeholder:'Search experts...',style:{background:'none',border:'none',outline:'none',fontSize:'13px',color:'var(--text)',flex:1,fontFamily:'DM Sans,sans-serif'}})
      )
    ),
    React.createElement('div', {style:{padding:'0 18px 14px'}},
      React.createElement('div', {style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'8px'}}, 'All Experts'),
      EXPERTS.map(function(e){
        return React.createElement('div', {
          key:e.id,
          onClick:function(){setSelected(e);},
          style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'11px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'11px',cursor:'pointer'}
        },
          React.createElement('div', {style:{width:'46px',height:'46px',borderRadius:'50%',background:e.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',flexShrink:0,position:'relative',overflow:'hidden'}},
            e.img ? React.createElement('img',{src:e.img,alt:e.name,style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}) : e.initials,
            e.online ? React.createElement('div', {style:{position:'absolute',bottom:0,right:0,width:'10px',height:'10px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg3)'}}) : null
          ),
          React.createElement('div', {style:{flex:1,minWidth:0}},
            React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'5px',marginBottom:'2px'}},
              React.createElement('span', {style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}}, e.name),
              React.createElement('span', {style:{fontSize:'9px',fontWeight:600,color:'#fff',background:'linear-gradient(135deg,#1877F2,#42B3FF)',padding:'1px 5px',borderRadius:'20px'}}, 'Verified')
            ),
            React.createElement('div', {style:{fontSize:'10px',color:'var(--t2)',marginBottom:'3px'}}, e.role),
            React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'6px'}},
              React.createElement('span', {style:{fontSize:'9px',color:'var(--amber)',fontWeight:600}}, e.rate+' coins/min'),
              React.createElement('span', {style:{fontSize:'9px',color:'var(--t2)'}}, '★'+e.rating)
            )
          ),
          React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:'5px',flexShrink:0}},
            React.createElement('button', {
              onClick:function(ev){ev.stopPropagation();setActiveCall(e);},
              style:{padding:'5px 12px',background:'var(--ac)',border:'none',borderRadius:'7px',color:'#fff',fontSize:'10px',fontWeight:600,cursor:'pointer'}
            }, 'Call'),
            React.createElement('button', {
              onClick:function(ev){ev.stopPropagation();alert('Follow '+e.name+'!');},
              style:{padding:'5px 12px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'7px',color:'var(--text)',fontSize:'10px',fontWeight:600,cursor:'pointer'}
            }, 'Follow')
          )
        );
      })
    )
  );
}
