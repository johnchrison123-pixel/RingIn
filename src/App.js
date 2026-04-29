import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
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
      case 'home': return <HomeScreen session={session} />;
      case 'search': return <SearchScreen />;
      case 'wallet': return <WalletScreen session={session} />;
      case 'profile': return <ProfileScreen session={session} supabase={supabase} />;
      default: return <HomeScreen session={session} />;
    }
  };

  return (
    <div className="app-container">
      <div className="screen-content">{renderScreen()}</div>
      <nav className="bottom-nav">
        {[
          { id: 'home', icon: '🏠', label: 'Home' },
          { id: 'search', icon: '🔍', label: 'Search' },
          { id: 'wallet', icon: '💰', label: 'Wallet' },
          { id: 'profile', icon: '👤', label: 'Profile' },
        ].map(tab => (
          <button key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
