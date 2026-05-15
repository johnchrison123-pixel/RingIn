'use client'

import { Icon } from '../lib/icons'
import Avatar from './Avatar'
import { TRENDING_TOPICS, EXPERTS, WORKSHOPS } from '../lib/mockData'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  amber: '#F5A623', red: '#EF4747', pink: '#E84D9A', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export function LeftRail({ user, onGoToTab, onOpenSettings, onOpenSavedPosts, onOpenExpertApply }) {
  return (
    <aside style={railStyle}>
      {/* Me Card */}
      <div style={{ ...card(), overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => onGoToTab && onGoToTab('profile')}
      >
        <div style={{ height: 72, width: '100%', background: user.cover || C.grad }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 16px' }}>
          <div style={{ marginTop: -36, position: 'relative', zIndex: 1, border: `4px solid ${C.bg2}`, borderRadius: '50%' }}>
            <Avatar user={user} size={72} />
          </div>
          <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginTop: 8 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: C.t2 }}>{user.role}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
            {[
              ['posts', user.posts || 0, 'Posts'],
              ['followers', user.followers || 0, 'Followers'],
              ['following', user.following || 0, 'Following'],
            ].map(([k, v, l]) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{v}</div>
                <div style={{ fontSize: 11, color: C.t3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div style={card()}>
        <div style={cardHeader()}><div style={cardHeaderTitle()}>Shortcuts</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 2 }}>
          <Shortcut icon="wallet" label="My Wallet" badge={`🪙 ${user.coins || 0}`} onClick={() => onGoToTab && onGoToTab('wallet')} />
          <Shortcut icon="play" label="Live Workshops" badge="2 live" onClick={() => onGoToTab && onGoToTab('workshops')} />
          <Shortcut icon="bookmark" label="Saved Posts" onClick={onOpenSavedPosts} />
          <Shortcut icon="star" label="Following Experts" onClick={() => onGoToTab && onGoToTab('experts')} />
          <Shortcut icon="phone" label="Anonymous Connect" badgeGrad="NEW" onClick={() => onGoToTab && onGoToTab('connect')} />
          <Shortcut icon="shield" label="Become an Expert" onClick={onOpenExpertApply} />
          <Shortcut icon="settings" label="Settings" onClick={onOpenSettings} />
        </div>
      </div>

      {/* Trending Topics */}
      <div style={card()}>
        <div style={cardHeader()}><div style={cardHeaderTitle()}>Trending Topics</div></div>
        <div style={{ padding: '4px 8px 14px' }}>
          {TRENDING_TOPICS.map(({ tag, count }) => (
            <a
              key={tag}
              onClick={() => {
                // Pass tag to home for filtering — set localStorage so HomeScreen can pick up
                try { localStorage.setItem('pending_tag_filter', tag.replace('#', '')) } catch (e) {}
                onGoToTab && onGoToTab('home')
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ac }}>{tag}</div>
                <div style={{ fontSize: 11, color: C.t3 }}>{count}</div>
              </div>
              <div style={{ width: 16, height: 16, color: C.ac }}>{Icon.trend()}</div>
            </a>
          ))}
        </div>
      </div>
    </aside>
  )
}

export function RightRail({ experts, onlineExperts, onCallExpert, onViewUser, onGoToTab, following = {}, toggleFollow }) {
  const onlineList = (onlineExperts || experts || EXPERTS).filter(e => e.online).slice(0, 6)
  const suggested = (experts || EXPERTS).slice(6, 9)

  return (
    <aside style={railStyle}>
      {/* Online Experts */}
      <div style={card()}>
        <div style={cardHeader()}>
          <div style={cardHeaderTitle()}>Online Experts</div>
          <a style={cardHeaderLink()} onClick={() => onGoToTab && onGoToTab('experts')}>See all</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px 12px' }}>
          {onlineList.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: C.t3 }}>No experts online</div>
          ) : onlineList.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
            }}
              onClick={() => onViewUser && onViewUser(e)}
              onMouseEnter={(ev) => ev.currentTarget.style.background = C.bg3}
              onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
            >
              <Avatar user={e} size={36} showOnline />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                <div style={{ fontSize: 11, color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.role}</div>
                <div style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>{e.rate || 50} 🪙/min</div>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); onCallExpert && onCallExpert(e) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 20, background: C.ac,
                  color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              ><div style={{ width: 12, height: 12 }}>{Icon.phone()}</div></button>
            </div>
          ))}
        </div>
      </div>

      {/* Live Now */}
      <div style={card()}>
        <div style={cardHeader()}>
          <div style={cardHeaderTitle()}>Live Now</div>
          <a style={cardHeaderLink()} onClick={() => onGoToTab && onGoToTab('workshops')}>All</a>
        </div>
        {WORKSHOPS.filter(w => w.live).slice(0, 2).map(w => (
          <div key={w.id} style={{
            padding: 12, display: 'flex', gap: 10, alignItems: 'center',
            borderTop: `1px solid ${C.border}`, cursor: 'pointer',
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 10, background: w.cover,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>🎙</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</div>
              <div style={{ fontSize: 11, color: C.t2 }}>by {w.host.name.split(' ').slice(-1)[0]}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: C.red, padding: '2px 6px', borderRadius: 20,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} className="blink" />
                  LIVE
                </span>
                <span style={{ fontSize: 11, color: C.t3 }}>{w.viewers.toLocaleString()} watching</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Suggested for You */}
      <div style={card()}>
        <div style={cardHeader()}><div style={cardHeaderTitle()}>Suggested for You</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px 12px' }}>
          {suggested.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
            }}
              onClick={() => onViewUser && onViewUser(e)}
            >
              <Avatar user={e} size={36} showOnline={e.online} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{e.name}</div>
                <div style={{ fontSize: 11, color: C.t2 }}>{e.role}</div>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); toggleFollow && toggleFollow(e.id, e.name, e.img, e.role) }}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  background: following[e.id] ? C.acg : C.bg4,
                  border: `1px solid ${following[e.id] ? C.ac : C.border}`,
                  color: following[e.id] ? C.ac : C.text,
                  borderRadius: 8, cursor: 'pointer',
                }}
              >{following[e.id] ? '✓ Following' : '+ Follow'}</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.t3, padding: '4px 12px', lineHeight: 1.6 }}>
        About · Help · Privacy · Terms · Cookies · Become Expert · Wallet · Workshops · © 2026 RingIn
      </div>
    </aside>
  )
}

const railStyle = {
  display: 'flex', flexDirection: 'column', gap: 16,
  position: 'sticky', top: '84px', alignSelf: 'flex-start',
  maxHeight: 'calc(100vh - 84px - 24px)', overflowY: 'auto', paddingRight: 4,
}

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}
function cardHeader() {
  return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }
}
function cardHeaderTitle() {
  return { fontFamily: 'Syne', fontSize: 15, fontWeight: 700, color: C.text }
}
function cardHeaderLink() {
  return { fontSize: 12, color: C.ac, cursor: 'pointer' }
}

function Shortcut({ icon, label, badge, badgeGrad, onClick }) {
  return (
    <a onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 10, color: C.text,
      fontSize: 14, fontWeight: 500, cursor: onClick ? 'pointer' : 'default',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 20, height: 20, color: C.ac, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {Icon[icon]()}
      </div>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          background: C.acg, color: C.ac, fontSize: 11,
          fontWeight: 700, padding: '2px 8px', borderRadius: 12,
        }}>{badge}</span>
      )}
      {badgeGrad && (
        <span style={{
          background: C.grad, color: '#fff', fontSize: 11,
          fontWeight: 700, padding: '2px 8px', borderRadius: 12,
        }}>{badgeGrad}</span>
      )}
    </a>
  )
}
