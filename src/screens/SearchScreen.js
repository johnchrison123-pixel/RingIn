/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import CallScreen from './CallScreen';
import {sb} from '../utils/supabase';
import {useFollow} from './useFollow';
import {playSound} from '../utils/soundEngine';
import TopBarAvatar from '../components/TopBarAvatar';
import {useCoinBalance} from '../utils/coinBalance';
import {safeInitials} from '../utils/initials'; /* FIX #10: UTF-16 safe initials */
import {toastSuccess, toastError, toastWarn, toastInfo} from '../utils/toast'; /* R54: replace window.alert (banned per CLAUDE.md) */

// R24: hardcoded EXPERTS array (with i.pravatar.cc fake avatars) removed
// pre-launch. The list now comes from real Supabase profiles who have
// submitted an expert application (bio JSON contains an `expert_request`
// object). See loadRealExperts() inside SearchScreen — gracefully falls
// back to an empty state when no experts have applied yet.
//
// Color palette for synthesizing the gradient + cover when the profile
// doesn't have brand colors yet. Deterministic by user id so the same
// person always gets the same colors.
var EXPERT_PALETTE = [
  { color:'linear-gradient(135deg,#1D9E75,#5DCAA5)', cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)' },
  { color:'linear-gradient(135deg,#534AB7,#7C6FFF)', cover:'linear-gradient(135deg,#0a0a2e,#534AB7)' },
  { color:'linear-gradient(135deg,#C84B8A,#E84D9A)', cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)' },
  { color:'linear-gradient(135deg,#B8860B,#FFD700)', cover:'linear-gradient(135deg,#2e2200,#B8860B)' },
  { color:'linear-gradient(135deg,#9B59B6,#D98EF0)', cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)' },
  { color:'linear-gradient(135deg,#E8401A,#FF6B35)', cover:'linear-gradient(135deg,#2e0a00,#E8401A)' },
];

// Pick a deterministic palette entry for a given user id.
function paletteForId(id){
  var s = String(id || '');
  var n = 0;
  for (var i = 0; i < s.length; i++) n = (n + s.charCodeAt(i)) | 0;
  return EXPERT_PALETTE[Math.abs(n) % EXPERT_PALETTE.length];
}

// Map a Supabase profiles row into the shape the rest of the screen expects.
// Pulls expert_request from bio JSON (set by the Expert Application form
// in ProfileScreen). Falls back gracefully when fields are missing.
function profileToExpert(p){
  var bioJson = {};
  try {
    if (p && p.bio) {
      var b = (typeof p.bio === 'string') ? JSON.parse(p.bio) : p.bio;
      if (b && typeof b === 'object') bioJson = b;
    }
  } catch(_){}
  var req = bioJson.expert_request || {};
  var name = (req.name && String(req.name).trim()) || (p.full_name && String(p.full_name).trim()) || (p.email ? String(p.email).split('@')[0] : 'Expert');
  var initials = name.substring(0,2).toUpperCase();
  var pal = paletteForId(p.id);
  // expert_request.rate is the per-minute coin rate the applicant set.
  var rate = parseInt(req.rate, 10);
  if (!rate || Number.isNaN(rate)) rate = 30;
  return {
    id: p.id,
    // R: real verified signal (was hardcoded 'Verified' on every card). Gated
    // on profiles.is_verified like every other screen.
    verified: !!(p && p.is_verified),
    initials: initials,
    name: name,
    role: req.area || bioJson.tag || 'RingIn Expert',
    rate: rate,
    // Real metrics will require schema work. Placeholder defaults — UI shows
    // them as 0/—; we deliberately avoid faking 4.9★/842 calls/etc.
    rating: null,
    calls: 0,
    followers: '',
    online: false,
    color: pal.color,
    cover: pal.cover,
    loc: (bioJson.location && (bioJson.location.country_name || bioJson.location.country)) || '',
    bio: req.bio || bioJson.about || '',
    tags: [],
    img: p.avatar_url || null,
  };
}

function ExpertProfile({expert, onBack, onCall, following, toggleFollow, followLoaded, onGoToMessages, currentUserId}){
  // R24: experts are now real Supabase profiles (real UUIDs). The previous
  // `'mock_' + expert.id` namespacing was a workaround for the hardcoded
  // numeric IDs (1..6) that would have collided with real UUIDs in the
  // follows table. With real UUIDs everywhere, that prefix is no longer
  // needed — the follow key IS the expert's profile id directly.
  var followKey = expert.id;
  var isFollowing = following ? !!following[followKey] : false;

  /* R25: Creator subscription state.
   *  - subOffer = the expert's creator_subscriptions_offered row (if any)
   *  - mySubscription = my row in subscriptions_active for this creator (if any)
   *  - showSubModal = controls the Subscribe modal
   *  - subBuying = while a subscribe RPC is in flight (prevents double-tap)
   *
   * Fetched in a single useEffect on mount. Both queries fail-gracefully
   * (try/catch + maybeSingle) so a missing 0017 migration doesn't break
   * the profile screen — the Subscribe button just hides. */
  var subOfferS = useState(null); var subOffer = subOfferS[0]; var setSubOffer = subOfferS[1];
  var mySubS = useState(null); var mySub = mySubS[0]; var setMySub = mySubS[1];
  var showSubModalS = useState(false); var showSubModal = showSubModalS[0]; var setShowSubModal = showSubModalS[1];
  var subBuyingS = useState(false); var subBuying = subBuyingS[0]; var setSubBuying = subBuyingS[1];
  var subCountS = useState(0); var subCount = subCountS[0]; var setSubCount = subCountS[1];

  useEffect(function(){
    if (!expert || !expert.id) return;
    var cancelled = false;
    try {
      sb.from('creator_subscriptions_offered').select('*').eq('creator_id', expert.id).eq('enabled', true).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) setSubOffer(r.data);
      }).catch(function(){});
    } catch(_){}
    if (currentUserId) {
      try {
        sb.from('subscriptions_active').select('*').eq('subscriber_id', currentUserId).eq('creator_id', expert.id).maybeSingle().then(function(r){
          if (cancelled) return;
          if (r && !r.error && r.data) setMySub(r.data);
        }).catch(function(){});
      } catch(_){}
    }
    try {
      sb.from('creator_subscriber_count').select('active_count').eq('creator_id', expert.id).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) setSubCount(r.data.active_count || 0);
      }).catch(function(){});
    } catch(_){}
    return function(){ cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expert && expert.id, currentUserId]);

  // Format a price_cents + currency into a display string.
  function formatPrice(cents, currency){
    if (cents == null) return '';
    var amount = cents / 100;
    if (currency === 'INR') return '₹' + amount.toLocaleString('en-IN', {maximumFractionDigits: 0});
    if (currency === 'SAR') return 'SAR ' + amount.toLocaleString('en-US', {maximumFractionDigits: 0});
    if (currency === 'USD') return '$' + amount.toFixed(2);
    return amount + ' ' + (currency || '');
  }

  // Human-readable perk labels.
  var PERK_LABELS = {
    'sub_badge':      {icon:'💜', label:'Subscriber badge in chats &amp; rooms'},
    'priority_queue': {icon:'⚡',       label:'Priority call queue + 10% off the per-min rate'},
    'sub_only_rooms': {icon:'🎤', label:'Access to subscriber-only voice rooms'},
    'sub_only_dms':   {icon:'✉',       label:'Direct replies from the creator'},
    'sub_only_drops': {icon:'🎧', label:'Subscriber-only voice drops on the profile'},
    'entrance_sting': {icon:'🔔', label:'Voice entrance sting in creator\'s rooms'},
  };

  function startSubscription(mode){
    if (!currentUserId) { try { toastWarn('Please log in first'); } catch(_){} return; }
    if (!subOffer) return;
    setSubBuying(true);
    var nowMs = Date.now();
    var trialMs = (subOffer.trial_days || 0) * 24 * 60 * 60 * 1000;
    var monthMs = 30 * 24 * 60 * 60 * 1000;
    var row;
    if (mode === 'trial') {
      row = {
        subscriber_id: currentUserId,
        creator_id: expert.id,
        status: 'trialing',
        payment_method: 'trial',
        started_at: new Date(nowMs).toISOString(),
        expires_at: new Date(nowMs + (trialMs || monthMs)).toISOString(),
        renewal_enabled: false,
      };
    } else {
      // mode === 'real' — record the subscription intent. Real-money billing
      // wiring (Razorpay subscriptions / Apple-Google IAP) lands in v1.5.
      // For now we create a 'pending' row with a 30-day expires_at placeholder
      // so the UX flow works end-to-end; once payment lands, a webhook flips
      // status to 'active' and sets the real expires_at.
      row = {
        subscriber_id: currentUserId,
        creator_id: expert.id,
        status: 'pending',
        payment_method: 'real',
        payment_amount_cents: subOffer.price_cents,
        payment_currency: subOffer.currency,
        started_at: new Date(nowMs).toISOString(),
        expires_at: new Date(nowMs + monthMs).toISOString(),
        renewal_enabled: true,
      };
    }
    sb.from('subscriptions_active').upsert(row, { onConflict: 'subscriber_id,creator_id' }).select('*').maybeSingle().then(function(r){
      setSubBuying(false);
      if (r && r.error) {
        console.error('[ringin] subscribe error:', r.error);
        try { toastError('Could not subscribe: ' + (r.error.message || 'unknown error')); } catch(_){}
        return;
      }
      setMySub(r.data || row);
      setShowSubModal(false);
      try {
        if (mode === 'trial') {
          toastSuccess('Free trial started! You have access for ' + (subOffer.trial_days || 7) + ' days.');
        } else {
          toastInfo('Subscription pending — your access is recorded.');
        }
      } catch(_){}
    }).catch(function(e){
      setSubBuying(false);
      console.warn('[ringin] subscribe reject:', e && e.message);
      try { toastError('Network error — please try again'); } catch(_){}
    });
  }
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
            // R24: real expert UUID is the follow key now (no more 'mock_').
            onClick:function(){toggleFollow(followKey,expert.name,expert.img,expert.role);},
            style:{padding:'6px 16px',background:isFollowing?'var(--acg)':'var(--ac)',border:isFollowing?'1px solid var(--ac)':'none',borderRadius:'8px',color:isFollowing?'var(--ac)':'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer',minWidth:'80px'}
          }, isFollowing ? 'Following' : '+ Follow'),
          React.createElement('button',{onClick:function(){if(onGoToMessages)onGoToMessages({id:'expert_'+expert.id,name:expert.name,avatar:expert.img,role:expert.role,online:expert.online});},style:{padding:'6px 12px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Message'),
          React.createElement('button',{onClick:function(){if(onCall)onCall(expert);},style:{padding:'6px 12px',background:'var(--ac)',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px',fontWeight:600,cursor:'pointer'}},'Call'),
          /* R25: Subscribe button on expert profiles.
           * R44: hidden — per user direction, subscriptions are a separate
           * product from expert calls. Fans subscribe via UserProfileView
           * (tap any verified creator's profile from a post/comment/message
           * header). Subs tab in Messages then surfaces their feed. The
           * modal + state are kept around for any future re-enable. */
          false && subOffer ? React.createElement('button',{
            onClick:function(){ setShowSubModal(true); },
            style:{padding:'6px 12px',background: mySub ? 'rgba(123,110,255,0.18)' : 'linear-gradient(135deg,#7B6EFF,#E84D9A)',border: mySub ? '1px solid var(--ac)' : 'none',borderRadius:'8px',color: mySub ? 'var(--ac)' : '#fff',fontSize:'11px',fontWeight:700,cursor:'pointer'}
          }, mySub ? '💜 Subscribed' : '💜 Subscribe') : null
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
    ),
    /* R25: Subscribe modal — opens when the user taps the Subscribe button.
     * Shows price, perks, social proof (subscriber count), trial offer if
     * available, and a description set by the creator. Backdrop click and
     * Cancel both dismiss without subscribing. */
    showSubModal && subOffer ? React.createElement(React.Fragment, null,
      React.createElement('div',{
        style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:500,backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)'},
        onClick:function(){ setShowSubModal(false); }
      }),
      React.createElement('div',{
        onClick:function(e){ e.stopPropagation(); },
        style:{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:501,background:'linear-gradient(180deg,#1a1438 0%,#0f0b24 100%)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'20px',padding:'22px 22px 18px',width:'90%',maxWidth:'360px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.7),0 0 80px rgba(123,110,255,0.15)',color:'var(--text)',fontFamily:'inherit'}
      },
        // Creator avatar + name header
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}},
          React.createElement('div',{style:{width:'56px',height:'56px',borderRadius:'50%',background:expert.color||'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'18px',overflow:'hidden',flexShrink:0}},
            expert.img ? React.createElement('img',{src:expert.img,alt:expert.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : (expert.initials || expert.name.substring(0,2).toUpperCase())
          ),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}}, 'Subscribe to ' + expert.name),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}}, subCount > 0 ? ('Join ' + subCount + ' other ' + (subCount===1?'subscriber':'subscribers')) : 'Be the first to subscribe')
          )
        ),
        // Price hero
        React.createElement('div',{style:{textAlign:'center',padding:'18px',background:'linear-gradient(135deg,rgba(123,110,255,0.18),rgba(232,77,154,0.14))',border:'1px solid rgba(123,110,255,0.4)',borderRadius:'14px',marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'28px',fontWeight:800,color:'#fff',marginBottom:'2px'}}, formatPrice(subOffer.price_cents, subOffer.currency)),
          React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.7)'}}, 'per month')
        ),
        // Description
        subOffer.description ? React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.55,marginBottom:'14px',padding:'12px 14px',background:'rgba(255,255,255,0.04)',borderRadius:'10px',fontStyle:'italic'}}, '"' + subOffer.description + '"') : null,
        // Perks list
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'8px'}}, 'What you get'),
        React.createElement('div',{style:{marginBottom:'18px'}},
          (Array.isArray(subOffer.perks) ? subOffer.perks : []).map(function(perkKey){
            var p = PERK_LABELS[perkKey];
            if (!p) return null;
            return React.createElement('div',{key:perkKey,style:{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
              React.createElement('span',{style:{fontSize:'15px',width:'22px',textAlign:'center',flexShrink:0}}, p.icon),
              React.createElement('span',{style:{fontSize:'12px',color:'var(--text)',lineHeight:1.5}}, p.label)
            );
          })
        ),
        // Trial CTA (if creator offers a free trial AND user has no prior sub)
        subOffer.trial_days > 0 && !mySub ? React.createElement('button',{
          onClick:function(){ startSubscription('trial'); },
          disabled:subBuying,
          style:{width:'100%',padding:'13px',background:'rgba(39,201,106,0.18)',border:'1px solid rgba(39,201,106,0.5)',borderRadius:'12px',color:'#27C96A',fontSize:'13px',fontWeight:700,cursor:subBuying?'wait':'pointer',marginBottom:'10px',fontFamily:'inherit',opacity:subBuying?0.6:1}
        }, subBuying ? 'Starting trial…' : ('Start free ' + subOffer.trial_days + '-day trial')) : null,
        // Real-money Subscribe CTA
        React.createElement('button',{
          onClick:function(){ startSubscription('real'); },
          disabled:subBuying || !!mySub,
          style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:(subBuying||mySub)?'not-allowed':'pointer',marginBottom:'8px',fontFamily:'inherit',boxShadow:'0 4px 16px rgba(123,110,255,0.4)',opacity:(subBuying||mySub)?0.5:1}
        }, mySub ? 'Already subscribed' : (subBuying ? 'Processing…' : ('Subscribe for ' + formatPrice(subOffer.price_cents, subOffer.currency) + '/mo'))),
        // Fine print
        React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textAlign:'center',marginBottom:'8px',lineHeight:1.5}}, 'Cancel anytime. Access until the end of the billing cycle. Real-money billing wires up in v1.5 — current subscriptions are recorded as pending.'),
        // Cancel
        React.createElement('button',{
          onClick:function(){ setShowSubModal(false); },
          style:{width:'100%',padding:'10px',background:'transparent',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'10px',color:'rgba(255,255,255,0.7)',fontSize:'12px',cursor:'pointer',fontFamily:'inherit'}
        }, 'Maybe later')
      )
    ) : null
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
  // R24: real experts list (replaces hardcoded EXPERTS array). Initialized
  // empty; populated by the useEffect below from Supabase profiles with an
  // expert_request in their bio JSON.
  var expertsS = useState([]); var experts = expertsS[0]; var setExperts = expertsS[1];
  var expertsLoadingS = useState(true); var expertsLoading = expertsLoadingS[0]; var setExpertsLoading = expertsLoadingS[1];

  // Fetch real experts on mount. Wrapped in try/catch + handles each
  // failure mode (network reject, RLS reject, malformed bio JSON) so the
  // screen still renders even when the query fails.
  useEffect(function(){
    var cancelled = false;
    try {
      // Note: filtering server-side requires a JSON-path operator that some
      // older Supabase clients don't expose. Easier: fetch all profiles
      // (small early-stage population) and filter client-side.
      sb.from('profiles')
        .select('id,full_name,email,avatar_url,bio,is_verified')
        .not('bio', 'is', null)
        .limit(200)
        .then(function(res){
          if (cancelled) return;
          if (res.error) {
            console.warn('[ringin] experts fetch error:', res.error.message);
            setExperts([]); setExpertsLoading(false); return;
          }
          var rows = res.data || [];
          var mapped = rows
            .filter(function(p){ return p && typeof p.bio === 'string' && p.bio.indexOf('expert_request') >= 0; })
            .map(profileToExpert);
          setExperts(mapped);
          setExpertsLoading(false);
        })
        .catch(function(e){
          if (cancelled) return;
          console.warn('[ringin] experts fetch reject:', e && e.message);
          setExperts([]); setExpertsLoading(false);
        });
    } catch (e) {
      console.warn('[ringin] experts fetch throw:', e && e.message);
      setExperts([]); setExpertsLoading(false);
    }
    return function(){ cancelled = true; };
  }, []);

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
    /* R25: pass current user id so the Subscribe modal can check whether
     * the viewer already has a subscription to this creator (toggles the
     * button label to "Subscribed"). Computed inline from props.session
     * because the `currentUserId` var lower in the function isn't yet
     * defined at the point of this early return. */
    currentUserId: (props.session && props.session.user) ? props.session.user.id : null,
  });

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px 7px',gap:'8px'}},
      React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'26px',fontWeight:800,letterSpacing:'0.3px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'Experts'),
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
      // R24: use real experts state (populated from Supabase) instead of
      // the deleted hardcoded EXPERTS array. Same filter logic.
      var filtered = !q ? experts : experts.filter(function(e){
        if((e.name||'').toLowerCase().indexOf(q) >= 0) return true;
        if((e.role||'').toLowerCase().indexOf(q) >= 0) return true;
        if((e.loc||'').toLowerCase().indexOf(q) >= 0) return true;
        if(Array.isArray(e.tags) && e.tags.some(function(t){return (t||'').toLowerCase().indexOf(q) >= 0;})) return true;
        return false;
      });
      // Choose the right empty-state copy:
      //   loading → "Loading experts…"
      //   loaded, no query, zero results → "No experts have joined yet."
      //   loaded, query, zero results → "No experts match "<query>"."
      var emptyMsg = expertsLoading
        ? 'Loading experts…'
        : (q ? ('No experts match "'+searchQ+'"') : 'No experts have joined yet. Be the first — apply via Profile → Become an Expert.');
      return React.createElement('div',{style:{padding:'0 18px 14px'}},
        React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'8px'}}, q ? ('Results for "'+searchQ+'" ('+filtered.length+')') : 'All Experts'),
        filtered.length === 0
          ? React.createElement('div',{style:{padding:'24px 0',textAlign:'center',color:'var(--t3)',fontSize:'13px',lineHeight:1.5}}, emptyMsg)
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
              e.verified ? React.createElement('span',{style:{fontSize:'9px',fontWeight:600,color:'#fff',background:'linear-gradient(135deg,#1877F2,#42B3FF)',padding:'1px 5px',borderRadius:'20px'}},'Verified') : null
            ),
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)',marginBottom:'3px'}},e.role),
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'6px'}},
              React.createElement('span',{style:{fontSize:'9px',color:'var(--amber)',fontWeight:600}},e.rate+' coins/min'),
              e.rating != null ? React.createElement('span',{style:{fontSize:'9px',color:'var(--t2)'}},'★'+e.rating) : null
            )
          ),
          React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'5px',flexShrink:0}},
            React.createElement('button',{
              // R24: experts are real Supabase profiles now — pass their
              // real UUID through to __ringInStartCall so the call_invites
              // row is created with a valid receiver_id and the FCM push
              // delivery actually reaches the callee. (Previously this
              // wrapped the id with 'mock_' which made the UUID regex
              // reject the call.)
              onClick:function(ev){
                ev.stopPropagation();
                var target = Object.assign({}, e, {rate: e.rate || 30});
                if (typeof window !== 'undefined' && window.__ringInStartCall) {
                  window.__ringInStartCall(target, {rate: e.rate || 30});
                } else {
                  setActiveCall(e);
                }
              },
              style:{padding:'5px 12px',background:'var(--ac)',border:'none',borderRadius:'7px',color:'#fff',fontSize:'10px',fontWeight:600,cursor:'pointer'}
            },'Call'),
            // R24: real expert UUIDs — no more 'mock_' prefix on the follow key.
            (function(){
              var ek = e.id;
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
