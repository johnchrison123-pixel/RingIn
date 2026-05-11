/* eslint-disable */
import React, { useState, useEffect } from 'react';
import './App.css';
import HomeScreen, {UserProfileView} from './screens/HomeScreen';
import {useFollow} from './screens/useFollow';
import SearchScreen from './screens/SearchScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import WorkshopsScreen from './screens/WorkshopsScreen';
import MessagesScreen from './screens/MessagesScreen';
import SavedPostsScreen from './screens/SavedPostsScreen';
import AnonymousConnect from './screens/AnonymousConnect';
import CallScreen from './screens/CallScreen';
import IncomingCallModal from './components/IncomingCallModal';
import {sb as supabase} from './utils/supabase';
import {initPushNotifications} from './utils/pushNotifications';
import {playSound} from './utils/soundEngine';

export default function App() {
  var sessionS = useState(null); var session = sessionS[0]; var setSession = sessionS[1];
  var tabS = useState('home'); var activeTab = tabS[0]; var setActiveTab = tabS[1];
  var prevTabS = useState('home'); var prevTab = prevTabS[0]; var setPrevTab = prevTabS[1];
  var expS = useState(null); var selectedExpert = expS[0]; var setSelectedExpert = expS[1];
  var initConvoS = useState(null); var initConvo = initConvoS[0]; var setInitConvo = initConvoS[1];
  var viewUserStackS = useState([]); var viewUserStack = viewUserStackS[0]; var setViewUserStack = viewUserStackS[1];
  var unreadMsgS = useState(0); var unreadMsg = unreadMsgS[0]; var setUnreadMsg = unreadMsgS[1];
  var unreadNotifS = useState(0); var unreadNotif = unreadNotifS[0]; var setUnreadNotif = unreadNotifS[1];
  var msgResetKeyS = useState(0); var msgResetKey = msgResetKeyS[0]; var setMsgResetKey = msgResetKeyS[1];
  // Incoming call: a row inserted into call_invites where callee_id = me
  var incomingCallS = useState(null); var incomingCall = incomingCallS[0]; var setIncomingCall = incomingCallS[1];
  // Active call (rendered above everything): set when user starts an outgoing call OR accepts an incoming one
  var activeCallS = useState(null); var activeCall = activeCallS[0]; var setActiveCall = activeCallS[1];
  function pushViewUser(u){ setViewUserStack(function(prev){return prev.concat([u]);}); }
  function popViewUser(){ setViewUserStack(function(prev){return prev.slice(0,-1);}); }
  var swXS = useState(0); var swX = swXS[0]; var setSwX = swXS[1];
  var swYS = useState(0); var swY = swYS[0]; var setSwY = swYS[1];
  var emailS = useState(''); var email = emailS[0]; var setEmail = emailS[1];
  var passS = useState(''); var password = passS[0]; var setPassword = passS[1];
  var loginS = useState(true); var isLogin = loginS[0]; var setIsLogin = loginS[1];
  var loadS = useState(false); var loading = loadS[0]; var setLoading = loadS[1];
  var msgS = useState(''); var message = msgS[0]; var setMessage = msgS[1];
  var appUserId = session&&session.user?session.user.id:null;
  var appFollowHook = useFollow(supabase, appUserId);
  var appFollowing = appFollowHook.following;
  var appToggleFollow = appFollowHook.toggleFollow;

  useEffect(function() {
    supabase.auth.getSession().then(function(res) { setSession(res.data.session); });
    var sub = supabase.auth.onAuthStateChange(function(_event, session) {
      setSession(session);
      if(session && session.user){
        var email = session.user.email || '';
        var emailPrefix = email.indexOf('@') > 0 ? email.split('@')[0] : 'user';
        // CRITICAL: do NOT overwrite full_name on every session. Check if profile exists
        // first; only set full_name on initial insert. This protects custom names users
        // set via Edit Profile from being wiped on every login.
        supabase.from('profiles').select('full_name').eq('id',session.user.id).single().then(function(r){
          var exists = !!(r && r.data);
          var payload = {
            id: session.user.id,
            email: email,
            is_online: true,
            last_seen: new Date().toISOString(),
          };
          // Only seed full_name if no row yet OR existing row has no name
          if(!exists || !r.data.full_name){ payload.full_name = emailPrefix; }
          supabase.from('profiles').upsert(payload,{onConflict:'id'}).then(function(){});
        });
        // Initialize push notifications
        initPushNotifications(session.user.id, function(payload){
          if(payload && payload.notification){
            try{ playSound('notification'); }catch(e){}
          }
        });
      }
    });
    // Use visibilitychange + pagehide instead of onbeforeunload (mobile-friendly)
    function markOffline(){
      var s = sub && sub.data && sub.data.session;
      try{
        var sess = supabase.auth.getSession();
        if(sess && sess.then){ sess.then(function(r){
          if(r.data && r.data.session && r.data.session.user){
            supabase.from('profiles').update({is_online:false,last_seen:new Date().toISOString()}).eq('id',r.data.session.user.id).then(function(){});
          }
        });}
      }catch(e){}
    }
    window.addEventListener('pagehide', markOffline);
    window.addEventListener('visibilitychange', function(){if(document.visibilityState==='hidden')markOffline();});
    return function() {
      if(sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
      window.removeEventListener('pagehide', markOffline);
    };
  }, []);

  // ── Global message badge listener — always active regardless of tab ──
  useEffect(function(){
    if(!appUserId) return;
    // Load initial unread count from DB
    supabase.from('messages').select('id',{count:'exact',head:true})
      .eq('receiver_id',appUserId).eq('read',false)
      .then(function(r){ if(r.count!=null) setUnreadMsg(r.count); });
    // Realtime: increment badge when new message arrives
    var ch = supabase.channel('app-inbox-badge-'+appUserId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'receiver_id=eq.'+appUserId},function(p){
        // Don't increment if user is currently on messages tab (MessagesScreen handles it there)
        setActiveTab(function(currentTab){
          if(currentTab !== 'messages'){
            setUnreadMsg(function(prev){ return prev+1; });
            var mc=[]; try{var ms=localStorage.getItem('ringin_muted_convos');if(ms)mc=JSON.parse(ms);}catch(e){}
            if(!mc.includes(p.new.conversation_id)) playSound('notification');
          }
          return currentTab;
        });
      })
      .subscribe();
    return function(){ supabase.removeChannel(ch); };
  },[appUserId]);

  // Notification count for the bell badge (independent from messages)
  useEffect(function(){
    if(!appUserId) return;
    supabase.from('notifications').select('id',{count:'exact',head:true})
      .eq('user_id',appUserId).eq('read',false)
      .then(function(r){ if(r.count!=null) setUnreadNotif(r.count); });
    var ch = supabase.channel('app-notif-badge-'+appUserId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+appUserId},function(){
        setUnreadNotif(function(prev){return prev+1;});
      })
      .subscribe();
    return function(){ supabase.removeChannel(ch); };
  },[appUserId]);

  // Incoming Agora call — listen for call_invites rows where callee_id = me with status='ringing'
  useEffect(function(){
    if(!appUserId) return;
    var ch = supabase.channel('app-call-invites-'+appUserId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'call_invites',filter:'callee_id=eq.'+appUserId},function(p){
        var inv = p && p.new;
        if(!inv || inv.status !== 'ringing') return;
        // Ignore if already on a call (don't stack incoming rings)
        if(activeCall) return;
        setIncomingCall(inv);
      })
      .subscribe();
    return function(){ try{ supabase.removeChannel(ch); }catch(e){} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[appUserId]);

  function acceptIncomingCall(inv){
    setIncomingCall(null);
    setActiveCall({
      isIncoming: true,
      inviteId: inv.id,
      channel: inv.channel,
      expert: {
        id: inv.caller_id,
        name: inv.caller_name || 'User',
        img: inv.caller_avatar,
        initials: (inv.caller_name||'?').substring(0,2).toUpperCase(),
        color: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
        role: 'Member',
        rate: inv.rate_per_min || 30,
      },
    });
  }
  function startOutgoingCall(otherUser, opts){
    if(!appUserId) return;
    opts = opts || {};
    var rate = parseInt(opts.rate||otherUser.rate, 10) || 30;
    // 1) Insert the invite row
    var calleeId = otherUser.id || otherUser.user_id || otherUser.otherId || otherUser.receiverId;
    if(!calleeId || calleeId===appUserId){ alert('Cannot start call: invalid user'); return; }
    var callerName = (session && session.user && session.user.email) ? (session.user.email.split('@')[0]||'You') : 'You';
    var callerAvatar = null;
    try{ callerAvatar = localStorage.getItem('avatar_'+appUserId)||null; }catch(e){}
    supabase.from('call_invites').insert({
      caller_id: appUserId,
      caller_name: callerName,
      caller_avatar: callerAvatar,
      callee_id: calleeId,
      callee_name: otherUser.name || null,
      callee_avatar: otherUser.img || otherUser.avatar_url || null,
      channel: '', // filled in after we know the row id
      status: 'ringing',
      rate_per_min: rate,
    }).select().single().then(function(r){
      if(r.error){
        console.error('call_invites insert failed', r.error);
        alert('Could not start call: '+(r.error.message||'permission'));
        return;
      }
      var inv = r.data;
      // Channel = invite id (unique per call)
      supabase.from('call_invites').update({channel: inv.id}).eq('id', inv.id).then(function(){});
      setActiveCall({
        isIncoming: false,
        inviteId: inv.id,
        channel: inv.id,
        expert: Object.assign({}, otherUser, {rate: rate}),
      });
    });
  }
  // Expose to window so any nested component can call it without prop-drilling
  useEffect(function(){
    window.__ringInStartCall = function(u, opts){ startOutgoingCall(u, opts||{}); };
    return function(){ try{ delete window.__ringInStartCall; }catch(e){} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId, session]);

  function openWallet() { setPrevTab(activeTab); setActiveTab('wallet'); }

  function handleSwipeStart(e){ setSwX(e.touches[0].clientX); setSwY(e.touches[0].clientY); }
  function handleSwipeMove(e){
    var dx = e.touches[0].clientX - swX;
    var dy = Math.abs(e.touches[0].clientY - swY);
    if(swX < 40 && dx > 0 && dy < 60){
      e.preventDefault();
    }
  }
  function handleSwipeEnd(e){
    var dx = e.changedTouches[0].clientX - swX;
    var dy = Math.abs(e.changedTouches[0].clientY - swY);
    if(swX < 40 && dx > 80 && dy < 60){
      if(activeTab==='wallet') setActiveTab(prevTab);
      else if(activeTab==='search' && selectedExpert) setSelectedExpert(null);
    }
  }
  function goToTab(tab) { setActiveTab(tab); }

  var handleAuth = async function(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    if (isLogin) {
      var res = await supabase.auth.signInWithPassword({ email: email, password: password });
      if (res.error) setMessage(res.error.message);
    } else {
      var res2 = await supabase.auth.signUp({ email: email, password: password });
      if (res2.error) setMessage(res2.error.message);
      else setMessage('Account created! You can now log in.');
    }
    setLoading(false);
  };

  if (!session) {
    return React.createElement('div', {className:'auth-container'},
      React.createElement('div', {className:'auth-box'},
        React.createElement('div', {className:'auth-logo'},
          React.createElement('span', {className:'logo-ring'}, 'Ring'),
          React.createElement('span', {className:'logo-in'}, 'In')
        ),
        React.createElement('p', {className:'auth-tagline'}, 'Connect with expert minds, instantly.'),
        React.createElement('form', {onSubmit:handleAuth},
          React.createElement('input', {className:'auth-input',type:'email',placeholder:'Email',value:email,onChange:function(e){setEmail(e.target.value);},required:true}),
          React.createElement('input', {className:'auth-input',type:'password',placeholder:'Password',value:password,onChange:function(e){setPassword(e.target.value);},required:true}),
          React.createElement('button', {className:'auth-btn',type:'submit',disabled:loading}, loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up')
        ),
        message ? React.createElement('p', {className:'auth-message'}, message) : null,
        React.createElement('p', {className:'auth-switch',onClick:function(){setIsLogin(!isLogin);}},
          isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'
        )
      )
    );
  }

  function renderScreen() {
    if (viewUserStack.length > 0) return React.createElement(UserProfileView, {
      user:viewUserStack[viewUserStack.length-1],
      sbHome:supabase,
      currentUserId:appUserId,
      session:session,
      following:appFollowing,
      toggleFollow:appToggleFollow,
      onBack:popViewUser,
      onViewUser:pushViewUser,
      onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');setViewUserStack([]);}
    });
    if (activeTab === 'home') return React.createElement(HomeScreen, {session:session, supabase:supabase, onViewExpert:function(exp){setSelectedExpert(exp);setActiveTab('search');}, onOpenWallet:openWallet, onGoToProfile:function(){setActiveTab('profile');}, onOpenProfile:function(){setPrevTab('home');setActiveTab('profile');}, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}, onOpenSaved:function(){setPrevTab('home');setActiveTab('saved');}, onOpenConnect:function(){setPrevTab('home');setActiveTab('connect');}});
    if (activeTab === 'search') return React.createElement(SearchScreen, {key:selectedExpert?selectedExpert.id:'search', initExpert:selectedExpert, session:session, onClearExpert:function(){setSelectedExpert(null);}, onBack:function(){setSelectedExpert(null);setActiveTab(prevTab);}, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('search');setActiveTab('profile');}, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}});
    if (activeTab === 'workshops') return React.createElement(WorkshopsScreen, {session:session, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('workshops');setActiveTab('profile');}});
    if (activeTab === 'messages') return React.createElement(MessagesScreen, {key:'messages-'+msgResetKey, session:session, initConvo:initConvo, onConvoConsumed:function(){setInitConvo(null);}, onViewExpert:function(exp){setSelectedExpert(exp);setPrevTab('messages');setActiveTab('search');}, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('messages');setActiveTab('profile');}, onUnreadCount:setUnreadMsg});
    if (activeTab === 'profile') return React.createElement(ProfileScreen, {session:session, supabase:supabase, onOpenWallet:openWallet, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}, onViewUser:function(u){setViewUserStack([u]);}});
    if (activeTab === 'wallet') return React.createElement(WalletScreen, {session:session, onBack:function(){setActiveTab(prevTab);}});
    if (activeTab === 'saved') return React.createElement(SavedPostsScreen, {session:session, onBack:function(){setActiveTab(prevTab);}, onViewUser:pushViewUser});
    if (activeTab === 'connect') return React.createElement(AnonymousConnect, {session:session, onBack:function(){setActiveTab(prevTab);}});
    return React.createElement(HomeScreen, {session:session, onOpenWallet:openWallet});
  }

  var tabs = [
    {id:'home', label:'Home', svg:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'},
    {id:'search', label:'Experts', svg:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'},
    {id:'workshops', label:'Workshops', svg:'M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z'},
    {id:'messages', label:'Messages', svg:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'},
  ];

  // Avatar for top bar (cached from localStorage)
  var avatarTopUrl = appUserId ? (localStorage.getItem('avatar_'+appUserId) || null) : null;
  var avatarInitial = session && session.user && session.user.email ? session.user.email.charAt(0).toUpperCase() : 'U';

  return React.createElement('div', {
    className:'app-container',
    onTouchStart:function(e){
      window._swX=e.touches[0].clientX;
      window._swY=e.touches[0].clientY;
    },
    onTouchEnd:function(e){
      var startX=window._swX||0;
      var endX=e.changedTouches[0].clientX;
      var dy=Math.abs(e.changedTouches[0].clientY-(window._swY||0));
      var screenW=window.innerWidth;
      var dx=startX-endX;
      // Right to left swipe covering 70% of screen starting from right 30% area
      if(startX>screenW*0.7 && dx>screenW*0.5 && dy<120){
        if(activeTab==='wallet'){setActiveTab(prevTab);}
        else if(activeTab==='search'&&selectedExpert){setSelectedExpert(null);}
        else if(activeTab==='search'){setActiveTab('home');}
        else if(activeTab==='messages'){setActiveTab('home');}
        else if(activeTab==='workshops'){setActiveTab('home');}
        else if(activeTab==='profile'){setActiveTab('home');}
        else if(activeTab==='saved'){setActiveTab(prevTab);}
        else if(activeTab==='connect'){setActiveTab(prevTab);}
      }
    }
  },
    // Global top bar removed — each screen renders its own header (RingIn/Workshops/Experts/...) with coin + bell + avatar
    React.createElement('div', {className:'screen-content'}, renderScreen()),

    // ── Active call overlay (above bottom nav) ──
    activeCall ? React.createElement('div',{style:{position:'fixed',inset:0,zIndex:900,background:'var(--bg)'}},
      React.createElement(CallScreen, {
        expert: activeCall.expert,
        session: session,
        inviteId: activeCall.inviteId,
        channel: activeCall.channel,
        isIncoming: !!activeCall.isIncoming,
        coins: 1240, // TODO: pull live coin balance via wallet hook
        onCoinsChange: function(){},
        onEnd: function(){ setActiveCall(null); },
      })
    ) : null,

    // ── Incoming call ring overlay (above the active-call overlay shouldn't happen because we suppress incoming when activeCall) ──
    incomingCall ? React.createElement(IncomingCallModal, {
      invite: incomingCall,
      onAccept: acceptIncomingCall,
      onReject: function(){ setIncomingCall(null); },
    }) : null,

    React.createElement('nav', {className:'bottom-nav'},
      tabs.map(function(tab, idx) {
        var btn = React.createElement('button', {
          key:tab.id,
          className:'nav-tab '+(activeTab===tab.id?'active':''),
          onClick:function(){
            if(tab.id==='messages' && activeTab==='messages'){
              setMsgResetKey(function(k){return k+1;});
            }
            if(tab.id==='messages'){
              setUnreadMsg(0);
            }
            setActiveTab(tab.id);
          }
        },
          React.createElement('div', {style:{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center'}},
            React.createElement('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},
              React.createElement('path', {d:tab.svg})
            ),
            tab.id==='messages' && unreadMsg>0 ? React.createElement('div', {
              style:{position:'absolute',top:'-4px',right:'-6px',
                background:'#FF4757',borderRadius:'50%',
                minWidth:'16px',height:'16px',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'9px',fontWeight:700,color:'#fff',padding:'0 3px'}
            }, unreadMsg>99 ? '99+' : String(unreadMsg)) : null
          ),
          React.createElement('span', null, tab.label)
        );
        // Insert anonymous connect orb after Experts (search)
        if (tab.id === 'search') {
          var orb = React.createElement('button', {
            key:'connect-orb',
            onClick:function(){setPrevTab(activeTab);setActiveTab('connect');},
            style:{
              width:'40px',height:'40px',borderRadius:'50%',
              background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
              border:'none',cursor:'pointer',position:'relative',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:activeTab==='connect'?'0 0 0 3px rgba(123,110,255,0.4),0 4px 14px rgba(232,77,154,0.5)':'0 3px 10px rgba(232,77,154,0.4)',
              flexShrink:0,margin:'0 2px',
            },
            title:'Anonymous Connect',
          },
            React.createElement('svg',{viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'#fff',strokeWidth:2.4},
              React.createElement('path',{d:'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z'})
            ),
            React.createElement('span',{style:{position:'absolute',top:'2px',right:'2px',width:'8px',height:'8px',borderRadius:'50%',background:'#27C96A',border:'2px solid #09090E'}})
          );
          return [btn, orb];
        }
        return btn;
      })
    )
  );
}
