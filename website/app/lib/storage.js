'use client'
/* Storage upload utility for images/videos */
import { sb } from './supabase'

export async function uploadFile({ file, bucket, path, upsert = false }) {
  if (!file) throw new Error('No file provided')

  const { data, error } = await sb.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert, contentType: file.type })

  if (error) throw error

  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path)
  return urlData.publicUrl
}

export async function uploadPostImage(file, userId) {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid image type')
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Image too large (max 10MB)')
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `posts/${userId}/post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`
  return uploadFile({ file, bucket: 'posts-media', path })
}

export async function uploadPostVideo(file, userId) {
  if (!file.type.startsWith('video/')) throw new Error('Not a video file')
  if (file.size > 100 * 1024 * 1024) throw new Error('Video too large (max 100MB)')
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `posts/${userId}/vid_${Date.now()}.${ext}`
  return uploadFile({ file, bucket: 'posts-media', path })
}

export async function uploadAvatar(file, userId) {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid image type')
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
  const path = `${userId}.jpg`
  return uploadFile({ file, bucket: 'avatars', path, upsert: true })
}

export async function uploadCover(file, userId) {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid image type')
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
  const path = `${userId}_cover.jpg`
  return uploadFile({ file, bucket: 'covers', path, upsert: true })
}

export async function uploadChatImage(file) {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid image type')
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`
  return uploadFile({ file, bucket: 'chat-images', path })
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return `${Math.floor(diff / 604800)}w`
}
