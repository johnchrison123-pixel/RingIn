/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import WorkshopsScreen from './screens/WorkshopsScreen';
import MessagesScreen from './screens/MessagesScreen';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function App() {
  var sessionS = useState(null); var session = sessionS[0]; var setSession = sessionS[1];
  var tabS = useState('home'); var activeTab = tabS[0]; var setActiveTab = tabS[1];
  var prevTabS = useState('home'); var prevTab = prevTabS[0]; var setPrevTab = prevTabS[1];
  var expS = useState(null); var selectedExpert = expS[0]; var setSelectedExpert = expS[1];
  var emailS = useState(''); var email = emailS[0]; var setEmail = emailS[1];
  var passS = useState(''); var password = passS[0]; var setPassword = passS[1];
  var loginS = useState(true); var isLogin = loginS[0]; var setIsLogin = loginS[1];
  var loadS = useState(false); var loading = loadS[0]; var setLoading = loadS[1];
  var msgS = useState(''); var message = msgS[0]; var setMessage = msgS[1];

  useEffect(function() {
    supabase.auth.getSession().then(function(res) { setSession(res.data.session); });
    supabase.auth.onAuthStateChange(function(_event, session) {
      setSession(session);
      if(session && session.user){
        supabase.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.email.split('@')[0]
        },{onConflict:'id'}).then(function(){});
      }
    });
  }, []);

  function openWallet() { setPrevTab(activeTab); setActiveTab('wallet'); }
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
    if (activeTab === 'home') return React.createElement(HomeScreen, {session:session, supabase:supabase, onViewExpert:function(exp){setSelectedExpert(exp);setActiveTab('search');}, onOpenWallet:openWallet, onGoToProfile:function(){setActiveTab('profile');}});
    if (activeTab === 'search') return React.createElement(SearchScreen, {key:selectedExpert?selectedExpert.id:'search', initExpert:selectedExpert, session:session, onClearExpert:function(){setSelectedExpert(null);}, onBack:function(){setSelectedExpert(null);setActiveTab(prevTab);}, onOpenWallet:openWallet});
    if (activeTab === 'workshops') return React.createElement(WorkshopsScreen, {onOpenWallet:openWallet});
    if (activeTab === 'messages') return React.createElement(MessagesScreen, {session:session, onViewExpert:function(exp){setSelectedExpert(exp);setPrevTab('messages');setActiveTab('search');}, onOpenWallet:openWallet});
    if (activeTab === 'profile') return React.createElement(ProfileScreen, {session:session, supabase:supabase, onOpenWallet:openWallet});
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

  return React.createElement('div', {className:'app-container'},
    React.createElement('div', {className:'screen-content'}, renderScreen()),
    React.createElement('nav', {className:'bottom-nav'},
      tabs.map(function(tab) {
        return React.createElement('button', {
          key:tab.id,
          className:'nav-tab '+(activeTab===tab.id?'active':''),
          onClick:function(){setActiveTab(tab.id);}
        },
          React.createElement('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},
            React.createElement('path', {d:tab.svg})
          ),
          React.createElement('span', null, tab.label)
        );
      })
    )
  );
}
