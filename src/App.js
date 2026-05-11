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
  var msgResetKeyS = useState(0); var msgResetKey = msgResetKeyS[0]; var setMsgResetKey = msgResetKeyS[1];
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
    supabase.auth.onAuthStateChange(function(_event, session) {
      setSession(session);
      if(session && session.user){
        supabase.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.email.split('@')[0],
          is_online: true,
          last_seen: new Date().toISOString()
        },{onConflict:'id'}).then(function(){});
        // Initialize push notifications
        initPushNotifications(session.user.id, function(payload){
          if(payload && payload.notification){
            try{ playSound('notification'); }catch(e){}
          }
        });
        // Set offline when window closes
        window.onbeforeunload = function(){
          supabase.from('profiles').update({is_online:false,last_seen:new Date().toISOString()}).eq('id',session.user.id).then(function(){});
        };
      } else {
        window.onbeforeunload = null;
      }
    });
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
    if (activeTab === 'home') return React.createElement(HomeScreen, {session:session, supabase:supabase, onViewExpert:function(exp){setSelectedExpert(exp);setActiveTab('search');}, onOpenWallet:openWallet, onGoToProfile:function(){setActiveTab('profile');}, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}});
    if (activeTab === 'search') return React.createElement(SearchScreen, {key:selectedExpert?selectedExpert.id:'search', initExpert:selectedExpert, session:session, onClearExpert:function(){setSelectedExpert(null);}, onBack:function(){setSelectedExpert(null);setActiveTab(prevTab);}, onOpenWallet:openWallet, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}});
    if (activeTab === 'workshops') return React.createElement(WorkshopsScreen, {onOpenWallet:openWallet});
    if (activeTab === 'messages') return React.createElement(MessagesScreen, {key:'messages-'+msgResetKey, session:session, initConvo:initConvo, onConvoConsumed:function(){setInitConvo(null);}, onViewExpert:function(exp){setSelectedExpert(exp);setPrevTab('messages');setActiveTab('search');}, onOpenWallet:openWallet, onUnreadCount:setUnreadMsg});
    if (activeTab === 'profile') return React.createElement(ProfileScreen, {session:session, supabase:supabase, onOpenWallet:openWallet, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}, onViewUser:function(u){setViewUserStack([u]);}});
    if (activeTab === 'wallet') return React.createElement(WalletScreen, {onBack:function(){setActiveTab(prevTab);}});
    return React.createElement(HomeScreen, {session:session, onOpenWallet:openWallet});
  }

  var tabs = [
    {id:'home', label:'Home', svg:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'},
    {id:'search', label:'Experts', svg:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'},
    {id:'workshops', label:'Workshops', svg:'M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z'},
    {id:'messages', label:'Messages', svg:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'},
    {id:'profile', label:'Profile', svg:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 7a4 4 0 100 8 4 4 0 000-8z'},
  ];

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
      }
    }
  },
    React.createElement('div', {className:'screen-content'}, renderScreen()),
    React.createElement('nav', {className:'bottom-nav'},
      tabs.map(function(tab) {
        return React.createElement('button', {
          key:tab.id,
          className:'nav-tab '+(activeTab===tab.id?'active':''),
          onClick:function(){
            if(tab.id==='messages' && activeTab==='messages'){
              setMsgResetKey(function(k){return k+1;});
            }
            if(tab.id==='messages'){
              // Clear badge when opening Messages tab
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
      })
    )
  );
}
