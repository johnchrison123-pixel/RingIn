import React, { useState } from 'react';
import '../styles/WalletScreen.css';
const PACKAGES = [
  { id: 1, coins: 20, price: 2, label: 'Starter', popular: false },
  { id: 2, coins: 55, price: 5, label: 'Popular', popular: true },
  { id: 3, coins: 120, price: 10, label: 'Pro', popular: false },
  { id: 4, coins: 260, price: 20, label: 'Power', popular: false },
];
const TRANSACTIONS = [
  { id: 1, type: 'call', label: 'Call with Dr. Sarah Chen', coins: -24, date: 'Today, 2:15 PM' },
  { id: 2, type: 'purchase', label: 'Purchased 55 coins', coins: 55, date: 'Today, 1:00 PM' },
  { id: 3, type: 'call', label: 'Call with James Okafor', coins: -36, date: 'Yesterday' },
  { id: 4, type: 'purchase', label: 'Purchased 20 coins', coins: 20, date: 'Apr 27' },
];
export default function WalletScreen() {
  const [balance] = useState(50);
  return (
    <div className="wallet-container">
      <div className="wallet-header"><h1 className="wallet-title">My Wallet</h1></div>
      <div className="balance-card">
        <p className="balance-label">Coin Balance</p>
        <div className="balance-amount"><span className="balance-coin">🪙</span><span className="balance-number">{balance}</span></div>
        <p className="balance-sub">≈ ${(balance * 0.09).toFixed(2)} USD value</p>
      </div>
      <h2 className="section-heading">Buy Coins</h2>
      <div className="packages-grid">
        {PACKAGES.map(pkg => (
          <div key={pkg.id} className={`package-card ${pkg.popular ? 'popular' : ''}`}>
            {pkg.popular && <span className="popular-tag">Most Popular</span>}
            <div className="package-coins">🪙 {pkg.coins}</div>
            <div className="package-price">${pkg.price}</div>
            <div className="package-label">{pkg.label}</div>
            <button className="buy-btn">Buy</button>
          </div>
        ))}
      </div>
      <h2 className="section-heading">Recent Activity</h2>
      <div className="transactions-list">
        {TRANSACTIONS.map(tx => (
          <div key={tx.id} className="tx-item">
            <div className="tx-icon">{tx.type === 'call' ? '📞' : '💳'}</div>
            <div className="tx-details"><p className="tx-label">{tx.label}</p><p className="tx-date">{tx.date}</p></div>
            <div className={`tx-amount ${tx.coins > 0 ? 'positive' : 'negative'}`}>{tx.coins > 0 ? '+' : ''}{tx.coins} 🪙</div>
          </div>
        ))}
      </div>
    </div>
  );
}
