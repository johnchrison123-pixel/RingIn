'use client'

import { useState, useEffect, useRef } from 'react'
import Avatar from '../components/Avatar'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF',
  amber: '#F5A623', red: '#EF4747', green: '#27C96A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function CallScreen({ expert, coins, onCoinsChange, onEnd }) {
  const [ringing, setRinging] = useState(true)
  const [ringSecs, setRingSecs] = useState(0)
  const [secs, setSecs] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speaker, setSpeaker] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [ended, setEnded] = useState(false)
  const [localCoins, setLocalCoins] = useState(coins || 0)

  // Auto-answer after 5s
  useEffect(() => {
    if (!ringing) return
    const t = setInterval(() => {
      setRingSecs(s => {
        if (s >= 4) {
          setRinging(false)
          clearInterval(t)
          return s
        }
        return s + 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [ringing])

  // Connected timer + coin deduction
  useEffect(() => {
    if (ringing || declined || ended) return
    const t = setInterval(() => {
      setSecs(s => s + 1)
      setLocalCoins(c => {
        const nc = c - 1
        if (nc <= 0) {
          setEnded(true)
          clearInterval(t)
          if (onCoinsChange) onCoinsChange(0)
          setTimeout(() => onEnd && onEnd(), 1500)
          return 0
        }
        if (onCoinsChange) onCoinsChange(nc)
        return nc
      })
    }, 1000)
    return () => clearInterval(t)
  }, [ringing, declined, ended])

  const decline = () => {
    setDeclined(true)
    setTimeout(() => onEnd && onEnd(), 800)
  }

  const endCall = () => {
    setEnded(true)
    setTimeout(() => onEnd && onEnd(), 500)
  }

  if (declined) {
    return (
      <div style={overlay}>
        <Avatar user={expert} size={120} />
        <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginTop: 20 }}>{expert.name}</div>
        <div style={{ fontSize: 14, color: C.red, marginTop: 8 }}>Call Declined</div>
        <button onClick={onEnd} style={{ ...btn(), background: C.bg3, color: C.text, marginTop: 30 }}>Back</button>
      </div>
    )
  }

  return (
    <div style={overlay}>
      {/* Avatar with rings */}
      <div style={{ position: 'relative', marginBottom: 30 }}>
        {ringing && (
          <>
            <div style={ring(0)} />
            <div style={ring(1)} />
            <div style={ring(2)} />
          </>
        )}
        <Avatar user={expert} size={140} />
        {!ringing && !ended && (
          <div style={{
            position: 'absolute', bottom: -8, right: -8,
            background: C.green, color: '#fff',
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, border: `3px solid ${C.bg2}`,
          }}>●</div>
        )}
      </div>

      {/* Name */}
      <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700 }}>{expert.name}</div>
      <div style={{ fontSize: 14, color: C.t2, marginTop: 4 }}>{expert.role}</div>

      {/* Status */}
      {ringing ? (
        <div style={{ fontSize: 16, color: C.amber, marginTop: 30 }}>Calling...</div>
      ) : ended ? (
        <div style={{ fontSize: 16, color: C.red, marginTop: 30 }}>Call ended - no coins</div>
      ) : (
        <>
          <div style={{ fontFamily: 'Syne', fontSize: 36, fontWeight: 700, marginTop: 30 }}>{fmt(secs)}</div>
          <div style={{ fontSize: 13, color: C.amber, marginTop: 8, fontWeight: 600 }}>{localCoins} 🪙 remaining</div>
        </>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 24, marginTop: 50 }}>
        {!ringing && !ended && (
          <>
            <ControlBtn onClick={() => setMuted(!muted)} active={muted} icon={muted ? '🔇' : '🎤'} label={muted ? 'Unmute' : 'Mute'} />
          </>
        )}
        <ControlBtn onClick={ringing ? decline : endCall} icon="📵" label="End" red />
        {!ringing && !ended && (
          <ControlBtn onClick={() => setSpeaker(!speaker)} active={speaker} icon="🔊" label="Speaker" />
        )}
      </div>
    </div>
  )
}

function ControlBtn({ onClick, icon, label, red, active }) {
  return (
    <button onClick={onClick} style={{
      width: 70, height: 70, borderRadius: '50%',
      background: red ? C.red : (active ? C.ac : C.bg3),
      color: '#fff', border: 'none', cursor: 'pointer',
      fontSize: 28, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      boxShadow: red ? `0 8px 24px rgba(239,71,71,0.4)` : '0 4px 12px rgba(0,0,0,0.3)',
    }} title={label}>{icon}</button>
  )
}

const overlay = {
  position: 'fixed', inset: 0, background: 'radial-gradient(circle at center, #1a1a2e 0%, #09090E 100%)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: 40, color: C.text,
}

function ring(i) {
  return {
    position: 'absolute', inset: -16 - i * 16,
    borderRadius: '50%', border: `2px solid ${C.ac}`,
    opacity: 0.4 - i * 0.1,
    animation: `ringPulse 2s ease-out ${i * 0.3}s infinite`,
  }
}

function btn() {
  return {
    padding: '12px 24px', borderRadius: 10, border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  }
}
