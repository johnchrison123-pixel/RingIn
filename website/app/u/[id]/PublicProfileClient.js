'use client'

import Link from 'next/link'
import Avatar, { VerifiedBadge } from '../../components/Avatar'
import { timeAgo } from '../../lib/storage'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  pink: '#E84D9A', amber: '#F5A623',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function PublicProfileClient({ profile, bioJson, posts, name, avatar, cover, followersCount, followingCount }) {
  const profileUser = { id: profile.id, name, img: avatar, online: profile.is_online }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <PublicHeader />

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Hero */}
        <article style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ height: 240, background: cover ? `url(${cover}) center/cover` : C.grad }} />
          <div style={{ padding: '0 28px 28px' }}>
            <div style={{
              marginTop: -56, display: 'inline-block',
              border: `4px solid ${C.bg2}`, borderRadius: '50%',
            }}>
              <Avatar user={profileUser} size={112} showOnline />
            </div>
            <h1 style={{
              marginTop: 16, fontFamily: 'Syne', fontSize: 32, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {name} {profile.verified && <VerifiedBadge />}
            </h1>
            {bioJson.tag && (
              <div style={{ fontSize: 16, color: C.t2, marginTop: 4 }}>{bioJson.tag}</div>
            )}
            {bioJson.about && (
              <p style={{ fontSize: 15, color: C.text, marginTop: 14, lineHeight: 1.6 }}>
                {bioJson.about}
              </p>
            )}
            {bioJson.website_url && (
              <a href={bioJson.website_url} target="_blank" rel="noopener noreferrer nofollow" style={{
                fontSize: 14, color: C.ac, marginTop: 10, display: 'inline-block',
              }}>🔗 {bioJson.website_name || bioJson.website_url}</a>
            )}

            {/* Location */}
            {bioJson.location && (bioJson.location.city || bioJson.location.country_name) && (
              <div style={{ fontSize: 13, color: C.t2, marginTop: 8 }}>
                📍 {[bioJson.location.city, bioJson.location.state, bioJson.location.country_name]
                  .filter(Boolean).join(', ')}
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: 32, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{posts.length}</div>
                <div style={{ fontSize: 12, color: C.t2 }}>POSTS</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{followersCount}</div>
                <div style={{ fontSize: 12, color: C.t2 }}>FOLLOWERS</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{followingCount}</div>
                <div style={{ fontSize: 12, color: C.t2 }}>FOLLOWING</div>
              </div>
            </div>

            {/* CTA */}
            <Link href={`/?user=${profile.id}`} style={{
              display: 'inline-block', marginTop: 24, padding: '12px 28px',
              background: C.grad, color: '#fff', borderRadius: 10,
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>+ Follow / Message — Open in App</Link>
          </div>
        </article>

        {/* Posts */}
        {posts.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 16, padding: '0 4px' }}>
              Recent Posts
            </h2>
            {posts.map(p => (
              <Link key={p.id} href={`/post/${p.id}`} style={{
                display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 14,
              }}>
                <article style={{
                  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: 18, transition: 'border-color 0.2s, transform 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.ac; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Avatar user={profileUser} size={36} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
                      <div style={{ fontSize: 11, color: C.t3 }}>{timeAgo(p.created_at)}</div>
                    </div>
                  </div>
                  <p style={{
                    fontSize: 14, lineHeight: 1.5, color: C.text,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  }}>{p.text}</p>
                  {(Array.isArray(p.images) && p.images[0]) && (
                    <img src={p.images[0]} alt="" style={{
                      width: '100%', maxHeight: 280, objectFit: 'cover',
                      borderRadius: 10, marginTop: 10,
                    }} />
                  )}
                  <div style={{
                    display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: C.t2,
                  }}>
                    <span>❤ {Array.isArray(p.likes) ? p.likes.length : 0}</span>
                    <span>💬 {p.comments_count || 0}</span>
                  </div>
                </article>
              </Link>
            ))}
          </section>
        )}

        <PublicFooterCta />
      </main>
    </div>
  )
}

function PublicHeader() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(17,17,23,0.85)', backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${C.border}`,
      padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href="/" style={{
        fontFamily: 'Syne', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px',
        background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        textDecoration: 'none',
      }}>RingIn</Link>
      <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Link href="/experts" style={{ fontSize: 14, color: C.text, textDecoration: 'none', fontWeight: 600 }}>Experts</Link>
        <Link href="/workshops" style={{ fontSize: 14, color: C.text, textDecoration: 'none', fontWeight: 600 }}>Workshops</Link>
        <Link href="/" style={{
          padding: '8px 18px', borderRadius: 8, background: C.grad,
          color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>Open App</Link>
      </nav>
    </header>
  )
}

function PublicFooterCta() {
  return (
    <section style={{
      marginTop: 32, padding: 32, textAlign: 'center',
      background: 'linear-gradient(135deg, rgba(123,110,255,.15), rgba(232,77,154,.1))',
      border: `1px solid ${C.border}`, borderRadius: 14,
    }}>
      <h3 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Discover more experts on RingIn
      </h3>
      <p style={{ fontSize: 14, color: C.t2, marginBottom: 20 }}>
        Connect with verified professionals — pay per minute, learn fast.
      </p>
      <Link href="/" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: 10,
        background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)', color: '#fff',
        fontWeight: 700, fontSize: 14, textDecoration: 'none',
      }}>Sign Up Free</Link>
    </section>
  )
}
