import React from 'react';
import '../styles/ProfileScreen.css';
export default function ProfileScreen({ session, supabase }) {
  const email = session?.user?.email || '';
  const initials = email.substring(0, 2).toUpperCase();
  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar-big">{initials}</div>
        <h2 className="profile-name">{email}</h2>
        <p className="profile-member">Member since April 2026</p>
      </div>
      <div className="profile-stats">
        <div className="stat-box"><span className="stat-num">0</span><span className="stat-lbl">Calls</span></div>
        <div className="stat-box"><span className="stat-num">50</span><span className="stat-lbl">Coins</span></div>
        <div className="stat-box"><span className="stat-num">0</span><span className="stat-lbl">Reviews</span></div>
      </div>
      <div className="profile-menu">
        {[
          { icon: '🎓', label: 'Become an Expert', sub: 'Start earning by sharing your knowledge' },
          { icon: '🔔', label: 'Notifications', sub: 'Manage your alerts' },
          { icon: '🔒', label: 'Privacy & Security', sub: 'Password, 2FA, data' },
          { icon: '💬', label: 'Help & Support', sub: 'FAQs and contact us' },
          { icon: '⭐', label: 'Rate the App', sub: 'Enjoying RingIn? Let us know!' },
        ].map((item, i) => (
          <div key={i} className="menu-item">
            <span className="menu-icon">{item.icon}</span>
            <div className="menu-text"><p className="menu-label">{item.label}</p><p className="menu-sub">{item.sub}</p></div>
            <span className="menu-arrow">›</span>
          </div>
        ))}
      </div>
      <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Sign Out</button>
    </div>
  );
}
