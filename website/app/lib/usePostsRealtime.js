'use client'
/* Shared realtime hook — keeps posts (likes + comment counts) in sync */
import { useEffect } from 'react'

export function usePostsRealtime(sb, channelName, currentUserId, setPosts, setCommentsCache, opts) {
  useEffect(() => {
    if (!sb || !channelName) return
    const likesAsArray = opts && opts.likesAsArray
    const onNewPost = opts && opts.onNewPost

    let ch = sb.channel(channelName)
      // Likes + comment count when any post row is updated
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (p) => {
        const likesArr = Array.isArray(p.new.likes) ? p.new.likes : []
        const newCommentsCount = p.new.comments_count

        setPosts(prev => prev.map(post => {
          if (post.id !== p.new.id) return post

          // Skip if our local state already matches (prevents own-toggle echo)
          const currentLikesCount = likesAsArray
            ? (Array.isArray(post.likes) ? post.likes.length : 0)
            : post.likes
          const currentCommentsCount = post.comments

          const sameLikes = currentLikesCount === likesArr.length &&
            (post.likedByIds || []).length === likesArr.length &&
            (post.likedByIds || []).every(id => likesArr.includes(id))
          const sameComments = newCommentsCount == null || currentCommentsCount === newCommentsCount

          if (sameLikes && sameComments) return post

          return {
            ...post,
            likes: likesAsArray ? likesArr : likesArr.length,
            liked: currentUserId ? likesArr.includes(currentUserId) : post.liked,
            likedByIds: likesArr,
            comments: newCommentsCount != null ? newCommentsCount : post.comments,
          }
        }))
      })
      // Comment count when anyone comments
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (p) => {
        // Skip own comment - already handled optimistically
        if (currentUserId && p.new.user_id === currentUserId) return

        setPosts(prev => prev.map(post => {
          if (post.id !== p.new.post_id) return post
          return { ...post, comments: (post.comments || 0) + 1 }
        }))

        if (setCommentsCache) {
          setCommentsCache(prev => {
            const existing = prev[p.new.post_id]
            if (!existing) return prev
            if (existing.find(c => c.id === p.new.id)) return prev
            const updated = existing.concat([p.new])
            try { localStorage.setItem('comments_' + p.new.post_id, JSON.stringify(updated)) } catch (e) {}
            return { ...prev, [p.new.post_id]: updated }
          })
        }
      })

    if (onNewPost) {
      ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (p) => {
        // Skip own post echo - HomeScreen already added optimistically
        if (currentUserId && p.new.user_id === currentUserId) return
        onNewPost(p.new)
      })
    }

    ch.subscribe()
    return () => { sb.removeChannel(ch) }
  }, [channelName, currentUserId])
}
