/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {sb} from '../utils/supabase';
import {useFollow} from './useFollow';
import {playSound} from '../utils/soundEngine';
import TopBarAvatar from '../components/TopBarAvatar';
import {useCoinBalance} from '../utils/coinBalance';
import {safeInitials} from '../utils/initials'; /* FIX #10: UTF-16 safe initials */

const EXPERTS = [
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine. Specializes in preventive care and chronic disease management.',tags:['General Medicine','Preventive Care','Chronic Disease'],img:'https://i.pravatar.cc/150?img=47'},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google and Meta alumni. Specializes in system design and technical interviews.',tags:['System Design','React','Node.js'],img:'https://i.pravatar.cc/150?img=12'},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience. Helped 500+ professionals land their dream jobs.',tags:['Career Strategy','LinkedIn','Interviews'],img:'https://i.pravatar.cc/150?img=23'},
  {id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,calls:389,followers:'1.8k',online:true,color:'linear-gradient(135deg,#B8860B,#FFD700)',cover:'linear-gradient(135deg,#2e2200,#B8860B)',loc:'Dubai, UAE',bio:'Senior lawyer with 12 years in UAE corporate law.',tags:['Corporate Law','Contracts'],img:'https://i.pravatar.cc/150?img=33'},
  {id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,calls:521,followers:'2.7k',online:true,color:'linear-gradient(135deg,#9B59B6,#D98EF0)',cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)',loc:'Abu Dhabi',bio:'Clinical psychologist specializing in anxiety and stress.',tags:['Anxiety','CBT','Stress'],img:'https://i.pravatar.cc/150?img=44'},
  {id:6,initials:'JT',name:'James Tanner',role:'Fitness & Nutrition Coach',rate:50,rating:4.7,calls:298,followers:'4.1k',online:true,color:'linear-gradient(135deg,#E8401A,#FF6B35)',cover:'linear-gradient(135deg,#2e0a00,#E8401A)',loc:'Remote',bio:'Certified personal trainer and nutritionist.',tags:['Weight Loss','Nutrition','Fitness'],img:'https://i.pravatar.cc/150?img=15'},
];

function ExpertProfile({expert, onBack, onCall, following, toggleFollow, followLoaded, onGoToMessages}){
  // FIX #6: namespace mock-expert follow IDs with 'mock_' to prevent
  // collisions with real UUID follows from the `follows` table. Numeric
  // mock IDs (1..6) would otherwise overlap with future real UUIDs that
  // happen to start with the same digit, or with localStorage entries
  // that other code writes using real IDs.
  var mockKey = 'mock_' + expert.id;
  var isFollowing = following ? !!following[mockKey] : false;
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto',position:'relative'}},
    React.createElement('button',{onClick:onBack,title:'Back',style:{position:'absolute',top:'12px',left:'12px',zIndex:10,background:'rgba(0,0,0,.55)',border:'none',borderRadius:'50%',width:'34px',height:'34px',color:'#fff',padding:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},
      React.createElement('svg',{viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
        React.createElement('polyline',{points:'15 18 9 12 15 6'})
      )
    ),
    React.createElement('div',{style:{position:'relative',flexShrink:0}},
      React.createElement('div',{style:{height:'140px',background:expert.cover}}),
      React.createElement('div',{style:{position:'absolute',bottom:'-36px',left:'16px',width:'72px',height:'72px',borderRadius:'50%',background:expert.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:'700',color:'#fff',border:'4px solid #09090E',zIndex:5,overflow:'hidden'}},
        expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : expert.initials
      )
    ),
    React.createElement('div',{style:{height:'44px'}}),
    React.createElement('div',{style:{padding:'0 16px'}},
      React.createElement('div',{style:{display:'flex',alignItems:'flex-end',justifyContent:'flex-end',marginBottom:'10px'}},
        React.createElement('div',{style:{display:'flex',gap:'6px',paddingBottom:'4px'}},
          React.createElement('button',{
            // FIX #6: use the mockKey so the follow state lives under a
            // dedicated namespace (matches the read above).
            onClick:function(){toggleFollow(mockKey,expert.name,expert.img,expert.role);},
            style:{padding:'6px 16px',background:isFollowing?'var(--acg)':'var(--ac)',border:isFollowing?'1px solid var(--ac)':'none',borderRadius:'8px',color:isFollowing?'var(--ac)':'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer',minWidth:'80px'}
          }, isFollowing ? 'Following' : '+ Follow'),
          React.createElement('button',{onClick:function(){if(onGoToMessages)onGoToMessages({id:'expert_'+expert.id,name:expert.name,avatar:expert.img,role:expert.role,online:expert.online});},style:{padding:'6px 12px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Message'),
          React.createElement('button',{onClick:function(){if(onCall)onCall(expert);},style:{padding:'6px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Call')
        )
      ),
      React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},expert.name),
      React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginBottom:'6px'}},expert.role),
      React.createElement('div',{style:{display:'flex',gap:'6px',marginBottom:'8px',flexWrap:'wrap'}},
        expert.online ? React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'9px',color:'var(--green)',background:'rgba(39,201,106,.1)',padding:'2px 7px',borderRadius:'20px'}},
          React.createElement('span',{style:{width:'4px',height:'4px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}), 'Online') : null,
        React.createElement('span',{style:{fontSize:'9px',color:'var(--t2)',background:'var(--bg4)',padding:'2px 7px',borderRadius:'20px'}},(expert.loc||''))
      ),
      React.createElement('div',{style:{fontSize:'11px',color:'var(--text)',lineHeight:1.6,marginBottom:'10px'}},(expert.bio||'')),
      React.createElement('div',{style:{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'12px'}},
        (expert.tags||[]).map(function(t){return React.createElement('span',{key:t,style:{fontSize:'10px',padding:'3px 8px',borderRadius:'20px',background:'var(--acg)',color:'var(--ac)'}},t);})
      ),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        [{v:expert.rating,l:'Rating'},{v:expert.calls,l:'Calls'},{v:(expert.followers||'0'),l:'Followers'},{v:expert.rate+'/m',l:'Rate'}].map(function(s){
          return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'8px',textAlign:'center'}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}},s.v),
            React.createElement('div',{style:{fontSize:'9px',color:'var(--t3)'}},s.l)
          );
        })
      ),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',marginBottom:'8px'}},
        React.createElement('div',{style:{fontSize:'12px',color:'var(--text)',lineHeight:1.5}},'No posts yet.')
      )
    )
  );
}

export default function SearchScreen(props){
  // ALL useState FIRST
  var selS = useState(props.initExpert || null); var selected = selS[0]; var setSelected = selS[1];
  var callS = useState(null); var activeCall = callS[0]; var setActiveCall = callS[1];
  // FIX #10: removed `coinsS = useState(50)` stub. Hardcoded 50-coin
  // state was bypassing the real wallet balance — useCoinBalance hook
  // (coinBal, below) gives the real number, and the CallScreen render
  // now uses it.
  var acS = useState('all'); var activecat = acS[0]; var setAc = acS[1];
  var searchQS = useState(''); var searchQ = searchQS[0]; var setSearchQ = searchQS[1];
  var typingTimerRef = useRef(null);
  // ── T2.8: Global FTS results (people + posts via Postgres FTS RPCs).
  // Fires when the search query has 2+ chars. Results render BELOW the
  // existing experts filter list.
  var ftsPeopleS = useState([]); var ftsPeople = ftsPeopleS[0]; var setFtsPeople = ftsPeopleS[1];
  var ftsPostsS = useState([]); var ftsPosts = ftsPostsS[0]; var setFtsPosts = ftsPostsS[1];
  var ftsLoadingS = useState(false); var ftsLoading = ftsLoadingS[0]; var setFtsLoading = ftsLoadingS[1];
  var ftsDebounceRef = useRef(null);
  // R17 FIX #1b: monotonically-increasing sequence guard for the FTS query
  // so a slower earlier resolve can't clobber a newer one's results.
  var ftsSearchSeqRef = useRef(0);
  // R17 FIX #6: live mirror of searchQ so an in-flight RPC's .then() can
  // see the CURRENT input state (the effect closure's `searchQ` is stale).
  var searchQLiveRef = useRef('');

  // ── T2.12: Trending hashtags from the materialized view (0014_trending.sql).
  // Shown when there's no active search query. Tap a tag → seeds search with #tag.
  var trendingS = useState([]); var trending = trendingS[0]; var setTrending = trendingS[1];
  useEffect(function(){
    try {
      sb.from('trending_tags').select('tag, post_count').limit(8).then(function(r){
        if (r && !r.error && r.data) setTrending(r.data);
      }).catch(function(){});
    } catch(_) {}
  }, []);
  // CUSTOM HOOKS AFTER useState
  var session = props.session;
  var currentUserId = session&&session.user ? session.user.id : null;
  var followHook = useFollow(sb, currentUserId);
  var following = followHook.following;
  var toggleFollow = followHook.toggleFollow;
  var followLoaded = followHook.loaded;
  // Shared coin balance — synced with HomeScreen / Messages / Wallet.
  var coinBal = useCoinBalance(currentUserId, sb);
  // useEffect LAST
  useEffect(function(){ if(props.initExpert) setSelected(props.initExpert); }, [props.initExpert]);

  // R16 FIX #9: typingTimerRef debounces the search-typing sound (line ~192).
  // If SearchScreen unmounts mid-debounce, clear the timer so the closure
  // doesn't leak.
  useEffect(function(){
    return function(){
      if (typingTimerRef.current) { try { clearTimeout(typingTimerRef.current); } catch(_){} typingTimerRef.current = null; }
    };
  }, []);

  // R17 FIX #6: mirror searchQ into a ref every render so an in-flight
  // RPC's resolve callback can compare against the LIVE input value, not
  // the captured-at-effect-start one.
  searchQLiveRef.current = searchQ;
  // T2.8 — debounced FTS query against the new search_posts / search_profiles
  // RPCs. Fires 250ms after the user stops typing, only when query >= 2 chars.
  useEffect(function(){
    if (ftsDebounceRef.current) clearTimeout(ftsDebounceRef.current);
    var q = (searchQ || '').trim();
    if (q.length < 2) { setFtsPeople([]); setFtsPosts([]); setFtsLoading(false); return; }
    setFtsLoading(true);
    // R17 FIX #1b: capture sequence for this invocation so a slower
    // earlier resolve can't overwrite newer results.
    var mySeq = ++ftsSearchSeqRef.current;
    ftsDebounceRef.current = setTimeout(function(){
      Promise.all([
        sb.rpc('search_profiles', { q: q, lim: 8 }).then(function(r){ return (r && !r.error && r.data) ? r.data : []; }).catch(function(){ return []; }),
        sb.rpc('search_posts',    { q: q, lim: 8 }).then(function(r){ return (r && !r.error && r.data) ? r.data : []; }).catch(function(){ return []; }),
      ]).then(function(results){
        // R17 FIX #6: bail if user cleared input or typed something
        // different while the RPC was in flight.
        var liveQ = (searchQLiveRef.current || '').trim();
        if (liveQ.length < 2 || liveQ !== q) return;
        // R17 FIX #1b: newer query in flight, don't overwrite its result.
        if (mySeq !== ftsSearchSeqRef.current) return;
        setFtsPeople(results[0]);
        setFtsPosts(results[1]);
        setFtsLoading(false);
      });
    }, 250);
    return function(){ if (ftsDebounceRef.current) clearTimeout(ftsDebounceRef.current); };
  }, [searchQ]);
  // CONDITIONAL RETURNS AFTER ALL HOOKS
  // FIX #10: pass the real `coinBal` from the hook; onCoinsChange is a
  // no-op because CallScreen now broadcasts via setSharedCoinBalance
  // (which the hook auto-listens for).
  if(activeCall) return React.createElement(CallScreen,{expert:activeCall,session:session,coins:coinBal,onCoinsChange:function(){},onEnd:function(){setActiveCall(null);}});
  if(selected) return React.createElement(ExpertProfile,{
    expert:selected,
    following:following,
    toggleFollow:toggleFollow,
    followLoaded:followLoaded,
    onCall:function(exp){
      // BUG FIX (was: setActiveCall(exp) → opened the legacy local CallScreen,
      // bypassing the call_invites pipeline so the callee never got a ring).
      // Use the same global startCall hook that HomeScreen uses so a real
      // call_invites row is created and FCM push fires for the callee.
      try {
        if (window && typeof window.__ringInStartCall === 'function') {
          window.__ringInStartCall(exp);
        } else {
          // Fallback for sessions where the global isn't installed yet —
          // legacy behavior (no real ringing for mock-id experts, but
          // doesn't crash).
          setActiveCall(exp);
        }
      } catch (_) { setActiveCall(exp); }
    },
    onBack:function(){setSelected(null);if(props.onBack)props.onBack();},
    onGoToMessages: props.onGoToMessages,
  });

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px',gap:'8px'}},
      React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'26px',fontWeight:800,letterSpacing:'-0.5px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Experts'),
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'6px'}},
        React.createElement('div',{onClick:function(){if(props.onOpenWallet)props.onOpenWallet();},style:{display:'flex',alignItems:'center',gap:'5px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'4px 10px',fontSize:'12px',color:'var(--text)',cursor:'pointer'}},
          React.createElement('div',{style:{width:'15px',height:'15px',borderRadius:'50%',background:'linear-gradient(135deg,#F5A623,#f97316)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7px',color:'#fff',fontWeight:700}},'C'),
          React.createElement('span',null,(Number(coinBal)||0).toLocaleString())
        ),
        React.createElement(TopBarAvatar, {
          session: props.session,
          onClick: function(){ if(props.onOpenProfile) props.onOpenProfile(); },
        })
      )
    ),
    React.createElement('div',{style:{padding:'0 18px 8px'}},
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'7px 11px',display:'flex',alignItems:'center',gap:'7px'}},
        React.createElement('input',{
          value: searchQ,
          placeholder:'Search experts by name, role, or tag...',
          onChange:function(e){
            setSearchQ(e.target.value);
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(function(){ playSound('typing'); }, 80);
          },
          style:{background:'none',border:'none',outline:'none',fontSize:'13px',color:'var(--text)',flex:1,fontFamily:'DM Sans,sans-serif'}
        }),
        searchQ ? React.createElement('span', {
          onClick: function(){ setSearchQ(''); },
          style: {color:'var(--t3)', fontSize:'14px', cursor:'pointer', padding:'0 4px'}
        }, '✕') : null
      )
    ),

    // ── T2.12: Trending hashtags chip strip ──
    // Visible only when search is empty + we have data from 0014_trending.sql.
    (!searchQ && trending && trending.length > 0) ? React.createElement('div',{style:{padding:'4px 18px 10px'}},
      React.createElement('div',{style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}, '🔥 Trending Tags'),
      React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px'}},
        trending.map(function(t){
          return React.createElement('button',{
            key:t.tag,
            onClick:function(){ setSearchQ('#' + t.tag); },
            style:{display:'inline-flex',alignItems:'center',gap:'4px',padding:'4px 10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',color:'var(--text)',fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}
          },
            React.createElement('span',{style:{color:'#7B6EFF',fontWeight:600}}, '#' + t.tag),
            React.createElement('span',{style:{color:'var(--t3)',fontSize:'10px'}}, t.post_count)
          );
        })
      )
    ) : null,
    (function(){
      var q = (searchQ||'').trim().toLowerCase();
      var filtered = !q ? EXPERTS : EXPERTS.filter(function(e){
        if((e.name||'').toLowerCase().indexOf(q) >= 0) return true;
        if((e.role||'').toLowerCase().indexOf(q) >= 0) return true;
        if((e.loc||'').toLowerCase().indexOf(q) >= 0) return true;
        if(Array.isArray(e.tags) && e.tags.some(function(t){return (t||'').toLowerCase().indexOf(q) >= 0;})) return true;
        return false;
      });
      return React.createElement('div',{style:{padding:'0 18px 14px'}},
        React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'8px'}}, q ? ('Results for "'+searchQ+'" ('+filtered.length+')') : 'All Experts'),
        filtered.length === 0
          ? React.createElement('div',{style:{padding:'24px 0',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'No experts match "'+searchQ+'"')
          : filtered.map(function(e){
        return React.createElement('div',{
          key:e.id,
          onClick:function(){setSelected(e);},
          style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'11px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'11px',cursor:'pointer'}
        },
          React.createElement('div',{style:{width:'46px',height:'46px',borderRadius:'50%',background:e.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff',flexShrink:0,position:'relative',overflow:'hidden'}},
            e.img ? React.createElement('img',{src:e.img,alt:e.name,style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}) : e.initials,
            e.online ? React.createElement('div',{style:{position:'absolute',bottom:0,right:0,width:'10px',height:'10px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg3)'}}) : null
          ),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'5px',marginBottom:'2px'}},
              React.createElement('span',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},e.name),
              React.createElement('span',{style:{fontSize:'9px',fontWeight:600,color:'#fff',background:'linear-gradient(135deg,#1877F2,#42B3FF)',padding:'1px 5px',borderRadius:'20px'}},'Verified')
            ),
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)',marginBottom:'3px'}},e.role),
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'6px'}},
              React.createElement('span',{style:{fontSize:'9px',color:'var(--amber)',fontWeight:600}},e.rate+' coins/min'),
              React.createElement('span',{style:{fontSize:'9px',color:'var(--t2)'}},'★'+e.rating)
            )
          ),
          React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'5px',flexShrink:0}},
            React.createElement('button',{
              // ROUND-9 FIX #1: list-view Call button was using legacy
              // setActiveCall(e) path — bypassed call_invites pipeline so
              // callee never got a ring. Same fix already applied to
              // ExpertProfile.onCall (above); apply here too. For mock
              // experts (numeric ids), App.js's startOutgoingCall UUID
              // guard alerts gracefully. For real experts the global
              // path creates a real call_invites row + fires FCM push.
              onClick:function(ev){
                ev.stopPropagation();
                var target = Object.assign({}, e, {id: 'mock_' + e.id, rate: e.rate || 30});
                if (typeof window !== 'undefined' && window.__ringInStartCall) {
                  window.__ringInStartCall(target, {rate: e.rate || 30});
                } else {
                  setActiveCall(e);
                }
              },
              style:{padding:'5px 12px',background:'var(--ac)',border:'none',borderRadius:'7px',color:'#fff',fontSize:'10px',fontWeight:600,cursor:'pointer'}
            },'Call'),
            // FIX #6: namespace the mock expert follow IDs with 'mock_' to
            // avoid colliding with real UUIDs from the `follows` table.
            (function(){
              var ek = 'mock_' + e.id;
              var isF = !!following[ek];
              return React.createElement('button',{
                onClick:function(ev){ev.stopPropagation();toggleFollow(ek,e.name,e.img,e.role);},
                style:{padding:'5px 12px',background:isF?'var(--acg)':'var(--bg4)',border:isF?'1px solid var(--ac)':'1px solid var(--border)',borderRadius:'7px',color:isF?'var(--ac)':'var(--text)',fontSize:'10px',fontWeight:600,cursor:'pointer'}
              }, isF?'Following':'Follow');
            })()
          )
        );
      })
      );
    })(),

    // ── T2.8: Global FTS results (people + posts) ──
    // Renders below the experts list when there's a query >= 2 chars.
    // Uses search_profiles + search_posts RPCs from migration 0010.
    (function(){
      var q = (searchQ || '').trim();
      if (q.length < 2) return null;
      return React.createElement('div',{style:{padding:'0 18px 80px'}},
        ftsLoading ? React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'11px',padding:'8px'}},'Searching…') : null,
        // People
        ftsPeople.length > 0 ? React.createElement('div',{style:{marginTop:'6px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'10px 0 6px'}}, 'People · ' + ftsPeople.length),
          ftsPeople.map(function(p){
            var name = (p.full_name && p.full_name.trim()) || (p.email ? p.email.split('@')[0] : 'User');
            return React.createElement('div',{
              key:p.id,
              onClick:function(){
                if (props.onGoToMessages) {
                  // Open a 1:1 chat with this person via existing messages flow.
                  var convId = [currentUserId, p.id].sort().join('_');
                  props.onGoToMessages({id:convId,convId:convId,otherId:p.id,receiverId:p.id,user_id:p.id,name:name,role:'RingIn Member',color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:p.avatar_url||null,initials:safeInitials(name)}); /* FIX #10 */
                }
              },
              style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',marginBottom:'6px',cursor:'pointer'}
            },
              React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'14px',flexShrink:0}},
                p.avatar_url ? React.createElement('img',{src:p.avatar_url,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : safeInitials(name) /* FIX #10 */
              ),
              React.createElement('div',{style:{flex:1,minWidth:0}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
                p.bio ? React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, p.bio.substring(0,80)) : null
              )
            );
          })
        ) : null,
        // Posts
        ftsPosts.length > 0 ? React.createElement('div',{style:{marginTop:'6px'}},
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'10px 0 6px'}}, 'Posts · ' + ftsPosts.length),
          ftsPosts.map(function(p){
            return React.createElement('div',{
              key:p.id,
              style:{padding:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',marginBottom:'6px'}
            },
              React.createElement('div',{style:{fontSize:'12px',color:'var(--text)',lineHeight:1.4,marginBottom:'4px'}}, (p.text||'').substring(0,140) + (p.text && p.text.length > 140 ? '…' : '')),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}}, (p.user_name || 'Someone') + ' · ' + (p.created_at ? new Date(p.created_at).toLocaleDateString() : ''))
            );
          })
        ) : null,
        // Empty state — both empty but query active
        (!ftsLoading && ftsPeople.length === 0 && ftsPosts.length === 0) ? React.createElement('div',{style:{textAlign:'center',color:'var(--t3)',fontSize:'12px',padding:'14px 0'}},'No people or posts match "'+q+'"') : null
      );
    })()
  );
}
