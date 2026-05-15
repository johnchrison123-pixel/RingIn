'use client'

import { useState, useEffect } from 'react'

export default function Avatar({ user, size = 40, showOnline = false }) {
  const [imgError, setImgError] = useState(false)
  const [cachedImg, setCachedImg] = useState(null)
  const [fallbackTried, setFallbackTried] = useState(false)

  const safe = user || {}
  const id = safe.id || safe.user_id

  useEffect(() => {
    // Reset state when user changes
    setImgError(false)
    setCachedImg(null)
    setFallbackTried(false)

    if (!id) return
    try {
      const cached = localStorage.getItem('avatar_' + id)
      if (cached) setCachedImg(cached)
    } catch (e) {}
  }, [id, safe.img, safe.avatar, safe.avatar_url])

  const initials = (safe.name || safe.full_name || safe.initials || '?')
    .toString()
    .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()

  const bg = safe.color || '#1E1E28'
  const isOnline = showOnline && !!(safe.online || safe.is_online)

  // Pick image with ordered fallback: prop URL → cached → null
  let img = null
  if (!imgError) {
    img = safe.img || safe.avatar || safe.avatar_url
  } else if (!fallbackTried && cachedImg) {
    // First fallback attempt: try cached image from localStorage
    img = cachedImg
  }

  const handleImgError = () => {
    if (!fallbackTried && cachedImg && cachedImg !== img) {
      // Try cached as fallback
      setFallbackTried(true)
      setImgError(false)
    } else {
      // Final fallback: show initials
      setImgError(true)
    }
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, flexShrink: 0,
        overflow: 'hidden', background: img ? '#1E1E28' : bg,
        position: 'relative', fontSize: Math.max(10, size * 0.34),
        fontFamily: 'Syne, sans-serif',
      }}
    >
      {img ? (
        <img
          src={img}
          alt={safe.name || ''}
          onError={handleImgError}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initials}

      {isOnline && (
        <div
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: `${size * 0.25}px`, height: `${size * 0.25}px`,
            background: '#27C96A', borderRadius: '50%',
            border: `2px solid #111117`,
          }}
        />
      )}
    </div>
  )
}

export function VerifiedBadge() {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 9, fontWeight: 700, color: '#fff',
        background: 'linear-gradient(135deg, #1877F2, #42B3FF)',
        padding: '2px 6px', borderRadius: 20,
      }}
    >✓</span>
  )
}
