'use client'

import { useState, useRef } from 'react'
import { Icon } from '../lib/icons'
import Avatar from './Avatar'
import { uploadPostImage, uploadPostVideo } from '../lib/storage'
import { detectContent, autoTagPost } from '../lib/mlService'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  pink: '#E84D9A', red: '#EF4747',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '🙏', '💪', '🔥', '✨', '💯', '🎉', '❤️', '🚀', '💡', '👏', '🙌', '😢', '😡']

export default function Composer({ user, session, onSubmit }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [images, setImages] = useState([])
  const [video, setVideo] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const userId = session?.user?.id

  const handleImagePick = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (!userId) {
      alert('Please log in to upload')
      return
    }

    setUploading(true)
    const successful = []
    const failed = []
    for (const file of files) {
      try {
        const url = await uploadPostImage(file, userId)
        successful.push(url)
      } catch (err) {
        failed.push(file.name + ': ' + err.message)
      }
    }
    if (successful.length > 0) {
      setImages(prev => [...prev, ...successful])
    }
    if (failed.length > 0) {
      alert('Some uploads failed:\n' + failed.join('\n'))
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleVideoPick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!userId) {
      alert('Please log in to upload')
      return
    }

    setUploading(true)
    try {
      const url = await uploadPostVideo(file, userId)
      setVideo(url)
    } catch (err) {
      alert(err.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  const submit = async () => {
    if (!text.trim() && images.length === 0 && !video) return
    setPosting(true)
    try {
      // 1. Content moderation check via ML service
      if (text.trim().length > 0) {
        const detection = await detectContent(text, 'post')
        if (detection?.action === 'block') {
          alert(`Post blocked: detected ${detection.flags.join(', ')}. Please rewrite your post.`)
          setPosting(false)
          return
        }
        if (detection?.action === 'review') {
          if (!confirm(`Heads up: your post may contain ${detection.flags.join(', ')}. Post anyway?`)) {
            setPosting(false)
            return
          }
        }
      }

      // 2. Extract manual #tags
      const manualTags = (text.match(/#\w+/g) || []).map(t => t.slice(1))

      // 3. Auto-detect topics via ML service (additive, won't replace manual)
      let autoTags = []
      if (text.trim().length > 20) {
        const tagResult = await autoTagPost(text, 3)
        if (tagResult?.tags) {
          autoTags = tagResult.tags
            .filter(t => t.confidence >= 0.5)
            .map(t => t.topic)
        }
      }

      const allTags = [...new Set([...manualTags, ...autoTags])]

      await onSubmit({ text: text.trim(), images, video, tags: allTags })
      setText('')
      setImages([])
      setVideo(null)
      setShowEmoji(false)
      setOpen(false)
    } catch (err) {
      alert('Failed to post: ' + (err?.message || err))
    } finally {
      setPosting(false)
    }
  }

  const insertEmoji = (e) => {
    setText(prev => prev + e)
  }

  if (!open) {
    return (
      <div style={card()}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar user={user} size={42} />
            <div
              onClick={() => setOpen(true)}
              style={{
                flex: 1, background: C.bg3, border: `1px solid ${C.border}`,
                borderRadius: 24, padding: '12px 18px',
                color: C.t2, fontSize: 14, cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.bg4}
              onMouseLeave={(e) => e.currentTarget.style.background = C.bg3}
            >
              What's on your mind, {user.name?.split(' ')[0] || 'there'}?
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 8, gap: 4 }}>
            <ComposerActionButton icon="image" label="Photo / Video" color="#22c55e" onClick={() => setOpen(true)} />
            <ComposerActionButton icon="smile" label="Feeling / Activity" color="#facc15" onClick={() => setOpen(true)} />
            <ComposerActionButton icon="video" label="Go Live" color={C.pink} onClick={() => setOpen(true)} />
          </div>
        </div>
      </div>
    )
  }

  // Open modal
  return (
    <div
      className="composer-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={() => !posting && setOpen(false)}
    >
      <div
        className="composer-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, background: C.bg2,
          border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
          maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700 }}>Create Post</div>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', color: C.t2, fontSize: 24, cursor: 'pointer' }}
          >×</button>
        </div>

        {/* User row */}
        <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar user={user} size={42} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: C.t2 }}>🌐 Public</div>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`What's on your mind, ${user.name?.split(' ')[0] || 'there'}?`}
          autoFocus
          style={{
            width: '100%', minHeight: 120,
            background: 'transparent', border: 'none', outline: 'none',
            color: C.text, fontSize: 16, padding: '0 18px 12px',
            resize: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Image previews */}
        {images.length > 0 && (
          <div style={{ padding: '0 18px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
                <button
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  style={{
                    position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)',
                    color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24,
                    cursor: 'pointer', fontSize: 14,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Video preview */}
        {video && (
          <div style={{ padding: '0 18px 12px', position: 'relative' }}>
            <video src={video} controls style={{ width: '100%', maxHeight: 240, borderRadius: 8 }} />
            <button
              onClick={() => setVideo(null)}
              style={{
                position: 'absolute', top: 4, right: 22, background: 'rgba(0,0,0,0.7)',
                color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24,
                cursor: 'pointer', fontSize: 14,
              }}
            >×</button>
          </div>
        )}

        {uploading && (
          <div style={{ padding: '0 18px 12px', color: C.ac, fontSize: 12 }}>Uploading...</div>
        )}

        {/* Emoji picker */}
        {showEmoji && (
          <div style={{
            padding: '8px 18px', display: 'flex', flexWrap: 'wrap', gap: 6,
            borderTop: `1px solid ${C.border}`, background: C.bg3,
          }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => insertEmoji(e)}
                style={{
                  background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
                  width: 36, height: 36, borderRadius: 8,
                }}
                onMouseEnter={(ev) => ev.currentTarget.style.background = C.bg4}
                onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
              >{e}</button>
            ))}
          </div>
        )}

        {/* Action toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 18px', borderTop: `1px solid ${C.border}`,
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagePick}
            style={{ display: 'none' }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoPick}
            style={{ display: 'none' }}
          />
          <ToolButton onClick={() => fileInputRef.current?.click()} title="Photo">
            <div style={{ width: 22, height: 22, color: '#22c55e' }}>{Icon.image()}</div>
          </ToolButton>
          <ToolButton onClick={() => videoInputRef.current?.click()} title="Video">
            <div style={{ width: 22, height: 22, color: C.pink }}>{Icon.video()}</div>
          </ToolButton>
          <ToolButton onClick={() => setShowEmoji(v => !v)} title="Emoji">
            <div style={{ width: 22, height: 22, color: '#facc15' }}>{Icon.smile()}</div>
          </ToolButton>

          <button
            onClick={submit}
            disabled={posting || uploading || (!text.trim() && images.length === 0 && !video)}
            style={{
              marginLeft: 'auto', padding: '10px 24px', borderRadius: 10,
              background: C.grad, color: '#fff', fontWeight: 700, fontSize: 14,
              border: 'none', cursor: 'pointer',
              opacity: (posting || uploading || (!text.trim() && images.length === 0 && !video)) ? 0.5 : 1,
            }}
          >{posting ? 'Posting...' : 'Post'}</button>
        </div>
      </div>
    </div>
  )
}

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}

function ComposerActionButton({ icon, label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 8, borderRadius: 8, background: 'none', border: 'none',
      color: C.t2, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.color = C.text }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.t2 }}
    >
      <span style={{ width: 20, height: 20, color }}>{Icon[icon]()}</span>
      {label}
    </button>
  )
}

function ToolButton({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 38, height: 38, borderRadius: 8,
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >{children}</button>
  )
}
