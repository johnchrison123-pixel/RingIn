'use client'

import { Icon } from '../lib/icons'

/**
 * BottomNav — mobile-only fixed bottom navigation.
 * Visibility is controlled purely by CSS (.bottom-nav in globals.css).
 * Mirrors the top-nav tabs but optimized for thumb reach on phones.
 */
const TABS_LEFT = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'experts', label: 'Experts', icon: 'grid' },
]
const TABS_RIGHT = [
  { id: 'workshops', label: 'Live', icon: 'play' },
  { id: 'messages', label: 'Chat', icon: 'msg' },
]

export default function BottomNav({ activeTab, onTabChange, unreadMsg = 0 }) {
  const renderTab = (tab) => {
    const active = activeTab === tab.id
    return (
      <button
        key={tab.id}
        type="button"
        className={`bottom-nav-btn ${active ? 'active' : ''}`}
        onClick={() => onTabChange(tab.id)}
        aria-label={tab.label}
      >
        <span className="bn-icon" style={{ position: 'relative' }}>
          {Icon[tab.icon](active)}
          {tab.id === 'messages' && unreadMsg > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -8,
              background: '#EF4747', borderRadius: 20, minWidth: 14, height: 14,
              fontSize: 9, fontWeight: 700, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}>{unreadMsg > 99 ? '99+' : unreadMsg}</span>
          )}
        </span>
        <span>{tab.label}</span>
      </button>
    )
  }

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Primary">
      {TABS_LEFT.map(renderTab)}

      {/* Anonymous Connect orb in the center */}
      <button
        type="button"
        onClick={() => onTabChange('connect')}
        aria-label="Anonymous Connect"
        className="bottom-nav-btn"
        style={{ flex: '0 0 auto' }}
      >
        <span
          className="bottom-nav-orb"
          style={{
            outline: activeTab === 'connect' ? '2px solid rgba(255,255,255,.25)' : 'none',
          }}
        >
          <span style={{ width: 22, height: 22, color: '#fff' }}>{Icon.phone(true)}</span>
        </span>
      </button>

      {TABS_RIGHT.map(renderTab)}
    </nav>
  )
}
