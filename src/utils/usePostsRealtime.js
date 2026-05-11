/* eslint-disable */
import {useEffect} from 'react';

/**
 * Shared realtime hook — keeps posts (likes + comment counts) in sync
 * across Home feed, UserProfileView, and ProfileScreen.
 *
 * @param {object} sb             - Supabase client
 * @param {string} channelName    - Unique channel name per screen instance
 * @param {string} currentUserId  - Logged-in user's ID (to skip own events)
 * @param {function} setPosts     - State setter for posts array
 * @param {function} setCommentsCache - State setter for comments cache object
 * @param {object}  opts
 *   @param {boolean} opts.likesAsArray  - true if posts store likes as array (ProfileScreen),
 *                                         false if stored as a count number (Home/UserProfile)
 *   @param {function} opts.onNewPost    - called with raw DB row when a new post is inserted
 *                                         (Home feed only — shows new posts in real time)
 */
export function usePostsRealtime(sb, channelName, currentUserId, setPosts, setCommentsCache, opts) {
  useEffect(function() {
    if (!sb || !channelName) return;
    var likesAsArray = opts && opts.likesAsArray;
    var onNewPost    = opts && opts.onNewPost;

    var ch = sb.channel(channelName)

      // ── Likes + comment count when any post row is updated ──
      .on('postgres_changes', {event:'UPDATE', schema:'public', table:'posts'}, function(p) {
        var likesArr = Array.isArray(p.new.likes) ? p.new.likes : [];
        var newCommentsCount = p.new.comments_count;
        setPosts(function(prev) {
          return prev.map(function(post) {
            if (post.id !== p.new.id) return post;
            // Echo-skip: if local state matches incoming, skip (prevents 2→3→1 flicker)
            var currentLikesCount = likesAsArray
              ? (Array.isArray(post.likes) ? post.likes.length : 0)
              : post.likes;
            var sameLikes = currentLikesCount === likesArr.length &&
              (post.likedByIds || []).length === likesArr.length &&
              (post.likedByIds || []).every(function(id){ return likesArr.indexOf(id) >= 0; });
            var sameComments = newCommentsCount == null || post.comments === newCommentsCount;
            if (sameLikes && sameComments) return post;
            return Object.assign({}, post, {
              likes:       likesAsArray ? likesArr : likesArr.length,
              liked:       currentUserId ? likesArr.includes(currentUserId) : post.liked,
              likedByIds:  likesArr,
              comments:    newCommentsCount != null ? newCommentsCount : post.comments
            });
          });
        });
      })

      // ── Comment count when anyone comments ──
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'comments'}, function(p) {
        // Skip own comment — already handled optimistically by submitComment
        if (currentUserId && p.new.user_id === currentUserId) return;

        // Bump post.comments (used when commentsCache not yet loaded for this post)
        setPosts(function(prev) {
          return prev.map(function(post) {
            if (post.id !== p.new.post_id) return post;
            return Object.assign({}, post, {comments: (post.comments || 0) + 1});
          });
        });

        // Also append to commentsCache so cache.length stays accurate
        // (the UI shows cache.length when cache exists, otherwise post.comments)
        if (setCommentsCache) {
          setCommentsCache(function(prev) {
            var existing = prev[p.new.post_id];
            if (!existing) return prev; // cache not loaded yet — no action needed
            if (existing.find(function(c) { return c.id === p.new.id; })) return prev;
            var updated = existing.concat([p.new]);
            try { localStorage.setItem('comments_' + p.new.post_id, JSON.stringify(updated)); } catch(e) {}
            return Object.assign({}, prev, {[p.new.post_id]: updated});
          });
        }
      });

    // ── New post inserted (Home feed only) ──
    if (onNewPost) {
      ch = ch.on('postgres_changes', {event:'INSERT', schema:'public', table:'posts'}, function(p) {
        onNewPost(p.new);
      });
    }

    ch.subscribe();
    return function() { sb.removeChannel(ch); };
  }, [channelName]); // channelName is stable — safe to use as dep
}
