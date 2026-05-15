'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '../../lib/icons'
import Avatar from '../../components/Avatar'
import { timeAgo } from '../../lib/storage'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  pink: '#E84D9A', red: '#EF4747',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function PublicPostClient({ post, profile, bioJson, comments, authorName, authorAvatar, image, likes }) {
  const [carouselIdx, setCarouselIdx] = useState(0)
  const allImages = [...(Array.isArray(post.images) ? post.images : (post.image_url ? [post.image_url] : []))].filter(Boolean)
  const tags = Array.isArray(post.tags) ? post.tags : []

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Public header */}
      <PublicHeader />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Post card */}
        <article style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* Header */}
          <header style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href={`/u/${profile?.id}`} style={{ textDecoration: 'none' }}>
              <Avatar user={{ id: profile?.id, name: authorName, img: authorAvatar }} size={48} showOnline={profile?.is_online} />
            </Link>
            <div style={{ flex: 1 }}>
              <Link href={`/u/${profile?.id}`} style={{
                fontSize: 16, fontWeight: 700, color: C.text, textDecoration: 'none',
              }}>
                {authorName}
              </Link>
              <div style={{ fontSize: 12, color: C.t2 }}>
                {bioJson?.tag || 'Member'} · {timeAgo(post.created_at)}
              </div>
            </div>
          </header>

          {/* Body */}
          <div style={{ padding: '0 20px 16px', fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {post.text}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ padding: '0 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(t => (
                <Link key={t} href={`/?tag=${t}`} style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 12px',
                  borderRadius: 20, background: C.acg, color: C.ac, textDecoration: 'none',
                }}>#{t}</Link>
              ))}
            </div>
          )}

          {/* Image carousel */}
          {allImages.length > 0 && (
            <div style={{ position: 'relative', background: C.bg3 }}>
              <img
                src={allImages[carouselIdx]}
                alt={`Post by ${authorName}`}
                style={{ width: '100%', maxHeight: 560, objectFit: 'cover', display: 'block' }}
              />
              {allImages.length > 1 && (
                <>
                  <button onClick={() => setCarouselIdx(i => Math.max(0, i - 1))} style={navBtn('left')}>‹</button>
                  <button onClick={() => setCarouselIdx(i => Math.min(allImages.length - 1, i + 1))} style={navBtn('right')}>›</button>
                </>
              )}
            </div>
          )}

          {/* Video */}
          {post.video_url && (
            <video src={post.video_url} controls style={{ width: '100%', maxHeight: 560 }} />
          )}

          {/* Stats */}
          <div style={{
            padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
            fontSize: 13, color: C.t2, borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', background: C.grad,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}>❤</span>
              <span>{likes.toLocaleString()} likes</span>
            </div>
            <span>{post.comments_count || 0} comments</span>
          </div>

          {/* CTA */}
          <Link
            href={`/?post=${post.id}`}
            style={{
              display: 'block', padding: 16, textAlign: 'center',
              background: C.grad, color: '#fff', fontWeight: 700,
              textDecoration: 'none', fontSize: 14,
            }}
          >
            🔥 Like, Comment & Share — Open in App
          </Link>
        </article>

        {/* Comments preview (SEO-rich) */}
        {comments.length > 0 && (
          <section style={{
            background: C.bg2, border: `1px solid ${C.border}`,
            borderRadius: 14, marginTop: 16, padding: 20,
          }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {comments.length} Comment{comments.length === 1 ? '' : 's'}
            </h2>
            {comments.map(c => (
              <div key={c.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{c.user_name}</div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{c.text}</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{timeAgo(c.created_at)}</div>
              </div>
            ))}
          </section>
        )}

        {/* Sign up CTA */}
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
        <Link href="/experts" style={navLinkStyle}>Experts</Link>
        <Link href="/workshops" style={navLinkStyle}>Workshops</Link>
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
      marginTop: 24, padding: 32, textAlign: 'center',
      background: 'linear-gradient(135deg, rgba(123,110,255,.15), rgba(232,77,154,.1))',
      border: `1px solid ${C.border}`, borderRadius: 14,
    }}>
      <h3 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Want more conversations like this?
      </h3>
      <p style={{ fontSize: 14, color: C.t2, marginBottom: 20 }}>
        Join RingIn and connect with verified experts in tech, health, finance, and more.
      </p>
      <Link href="/" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: 10,
        background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)', color: '#fff',
        fontWeight: 700, fontSize: 14, textDecoration: 'none',
      }}>Sign Up Free</Link>
    </section>
  )
}

const navLinkStyle = { fontSize: 14, color: '#EEEEF8', textDecoration: 'none', fontWeight: 600 }

function navBtn(side) {
  return {
    position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
    borderRadius: '50%', width: 36, height: 36, fontSize: 22, cursor: 'pointer',
  }
}
