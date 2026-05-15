'use client'

import { useState } from 'react'
import { sb } from '../lib/supabase'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', red: '#EF4747',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function LoginScreen({ onClose }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) setMessage(error.message)
      } else {
        const { error } = await sb.auth.signUp({ email, password })
        if (error) setMessage(error.message)
        else setMessage('Account created! Check your email to verify.')
      }
    } catch (err) {
      setMessage(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: C.bg2, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 32,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'Syne', fontSize: 40, fontWeight: 800, letterSpacing: '-1px',
            background: C.grad, WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: 8,
          }}>RingIn</h1>
          <p style={{ color: C.t2, fontSize: 14 }}>Connect with expert minds, instantly.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '14px 16px', background: C.bg3,
              border: `1px solid ${C.border}`, borderRadius: 10,
              color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '14px 16px', background: C.bg3,
              border: `1px solid ${C.border}`, borderRadius: 10,
              color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px', borderRadius: 10,
              background: C.grad, color: '#fff',
              fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
              opacity: loading ? 0.6 : 1, marginTop: 4,
            }}
          >
            {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        {message && (
          <p style={{
            marginTop: 16, padding: 12, borderRadius: 8,
            background: 'rgba(239, 71, 71, 0.1)',
            color: C.red, fontSize: 13, textAlign: 'center',
          }}>{message}</p>
        )}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <p
            onClick={() => setIsLogin(!isLogin)}
            style={{ color: C.ac, fontSize: 13, cursor: 'pointer' }}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </p>

          <button
            onClick={onClose}
            style={{
              color: C.t3, fontSize: 12, background: 'none',
              border: 'none', cursor: 'pointer',
            }}
          >← Continue browsing as guest</button>
        </div>
      </div>
    </div>
  )
}
