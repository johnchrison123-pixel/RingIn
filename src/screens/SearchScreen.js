import React, { useState } from 'react';
import '../styles/HomeScreen.css';
const ALL_EXPERTS = [
  { id: 1, name: 'Dr. Sarah Chen', category: 'Medical', rating: 4.9, rate: 8, verified: true, online: true, img: 'https://i.pravatar.cc/150?img=47' },
  { id: 2, name: 'James Okafor', category: 'Legal', rating: 4.8, rate: 12, verified: true, online: true, img: 'https://i.pravatar.cc/150?img=12' },
  { id: 3, name: 'Dr. Aisha Malik', category: 'Psychology', rating: 4.9, rate: 10, verified: true, online: false, img: 'https://i.pravatar.cc/150?img=56' },
  { id: 4, name: 'Carlos Rivera', category: 'Finance', rating: 4.7, rate: 9, verified: true, online: true, img: 'https://i.pravatar.cc/150?img=33' },
  { id: 5, name: 'Emily Watson', category: 'Career', rating: 4.8, rate: 6, verified: true, online: true, img: 'https://i.pravatar.cc/150?img=44' },
  { id: 6, name: 'Marcus Johnson', category: 'Fitness', rating: 4.6, rate: 5, verified: true, online: false, img: 'https://i.pravatar.cc/150?img=15' },
  { id: 7, name: 'Priya Sharma', category: 'Nutrition', rating: 4.9, rate: 7, verified: true, online: true, img: 'https://i.pravatar.cc/150?img=49' },
  { id: 8, name: 'David Kim', category: 'IT Support', rating: 4.7, rate: 6, verified: true, online: true, img: 'https://i.pravatar.cc/150?img=18' },
];
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const filtered = ALL_EXPERTS.filter(e => e.name.toLowerCase().includes(query.toLowerCase()) || e.category.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="home-container">
      <div className="home-header"><h1 className="home-title">Search <span className="gradient-text">Experts</span></h1></div>
      <div className="search-bar">
        <span>🔍</span>
        <input className="search-input" placeholder="Search by name or category..." value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="experts-grid" style={{marginTop:16}}>
        {filtered.map(expert => (
          <div key={expert.id} className="expert-card">
            <div className="card-top">
              <div className="avatar-wrap">
                <img src={expert.img} alt={expert.name} className="expert-avatar" />
                {expert.online && <span className="online-dot" />}
              </div>
              <div className="card-info">
                <div className="name-row"><span className="expert-name">{expert.name}</span>{expert.verified && <span className="verified-badge">✓</span>}</div>
                <span className="expert-category-tag">{expert.category}</span>
                <div className="rating-row"><span>⭐</span><span className="rating">{expert.rating}</span></div>
              </div>
            </div>
            <div className="card-bottom">
              <div className="rate-info"><span>🪙</span><span className="rate-amount">{expert.rate}</span><span className="rate-label"> coins/min</span></div>
              <button className="call-btn">Call Now</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
