'use client'
/* Follow/unfollow hook — syncs across all instances via window events */
import { useEffect, useState, useRef } from 'react'

const FOLLOWS_EVENT = 'ringin-follows-changed'

export function useFollow(supabase, currentUserId) {
  const [following, setFollowing] = useState({})
  const pendingWrites = useRef(new Set())

  // Load + listen for cross-screen sync
  useEffect(() => {
    if (!currentUserId) return

    // 1) Instant load from cache
    try {
      const cached = localStorage.getItem('follows_' + currentUserId)
      if (cached) setFollowing(JSON.parse(cached))
    } catch (e) {}

    // 2) Background sync from Supabase
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .then(({ data, error }) => {
        if (error) return
        const map = {}
        ;(data || []).forEach(r => { map[r.following_id] = true })
        setFollowing(prev => {
          const merged = { ...map }
          pendingWrites.current.forEach(id => {
            if (prev[id]) merged[id] = true
            else delete merged[id]
          })
          try { localStorage.setItem('follows_' + currentUserId, JSON.stringify(merged)) } catch (e) {}
          return merged
        })
      })

    // 3) Listen to global follow events from other instances
    const handler = (e) => {
      if (!e.detail || e.detail.userId !== currentUserId) return
      setFollowing(prev => {
        const next = { ...prev }
        if (e.detail.isFollowing) next[e.detail.targetId] = true
        else delete next[e.detail.targetId]
        try { localStorage.setItem('follows_' + currentUserId, JSON.stringify(next)) } catch (err) {}
        return next
      })
    }
    window.addEventListener(FOLLOWS_EVENT, handler)
    return () => window.removeEventListener(FOLLOWS_EVENT, handler)
  }, [currentUserId])

  const toggleFollow = async (targetId, targetName, targetAvatar, targetRole) => {
    if (!currentUserId) {
      alert('Please log in to follow')
      return
    }
    if (targetId === currentUserId) return

    const isFollowing = !!following[targetId]
    const snapshot = { ...following }

    // Optimistic update
    const next = { ...following }
    if (isFollowing) delete next[targetId]
    else next[targetId] = true
    setFollowing(next)
    try { localStorage.setItem('follows_' + currentUserId, JSON.stringify(next)) } catch (e) {}

    // Broadcast to all other useFollow instances immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FOLLOWS_EVENT, {
        detail: { userId: currentUserId, targetId, isFollowing: !isFollowing },
      }))
    }

    pendingWrites.current.add(targetId)

    try {
      if (isFollowing) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', currentUserId).eq('following_id', targetId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: targetId,
          following_name: targetName || '',
          following_avatar: targetAvatar || '',
          following_role: targetRole || '',
        })
        if (error) throw error
      }
    } catch (err) {
      console.error('[useFollow] error:', err.message)
      setFollowing(snapshot)
      try { localStorage.setItem('follows_' + currentUserId, JSON.stringify(snapshot)) } catch (e) {}
      // Revert broadcast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FOLLOWS_EVENT, {
          detail: { userId: currentUserId, targetId, isFollowing },
        }))
      }
    } finally {
      pendingWrites.current.delete(targetId)
    }
  }

  return { following, toggleFollow, loaded: true }
}
