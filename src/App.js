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
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage('Account created! You can now log in.');
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-logo">
            <span className="logo-ring">Ring</span><span className="logo-in">In</span>
          </div>
          <p className="auth-tagline">Connect with expert minds, instantly.</p>
          <form onSubmit={handleAuth}>
            <input className="auth-input" type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required />
            <input className="auth-input" type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required />
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </form>
          {message && <p className="auth-message">{message}</p>}
          <p className="auth-switch" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </p>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home': return <HomeScreen session={session} onViewExpert={setSelectedExpert} />;
      case 'search': return <SearchScreen initExpert={selectedExpert} onClearExpert={function(){setSelectedExpert(null);}} />;
      case 'workshops': return <WorkshopsScreen />;
      case 'messages': return <MessagesScreen />;
      case 'profile': return <ProfileScreen session={session} supabase={supabase} />;
      default: return <HomeScreen session={session} />;
    }
  };

  return (
    <div className="app-container">
      <div className="screen-content">{renderScreen()}</div>
      <nav className="bottom-nav">
        {[
          { id: "home", label: "Home", svg: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
          { id: "search", label: "Experts", svg: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
          { id: "workshops", label: "Workshops", svg: "M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" },
          { id: "messages", label: "Messages", svg: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
          { id: "profile", label: "Profile", svg: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 7a4 4 0 100 8 4 4 0 000-8z" },
        ].map(tab => (
          <button key={tab.id}
            className={"nav-tab " + (activeTab === tab.id ? "active" : "")}
            onClick={() => setActiveTab(tab.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={tab.svg}/>
            </svg>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
