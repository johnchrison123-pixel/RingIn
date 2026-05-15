'use client'

import { useState, useEffect } from 'react'
import { Icon } from '../lib/icons'
import { sb } from '../lib/supabase'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', amber: '#F5A623',
  red: '#EF4747', green: '#27C96A', pink: '#E84D9A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

const PACKAGES = [
  { id: 1, coins: 100, price: 100, label: 'Starter', bonus: 0, popular: false },
  { id: 2, coins: 200, price: 200, label: 'Basic', bonus: 0, popular: false },
  { id: 3, coins: 500, price: 500, label: 'Popular', bonus: 0, popular: true },
  { id: 4, coins: 1000, price: 900, label: 'Best Value', bonus: 100, popular: false },
  { id: 5, coins: 2000, price: 1700, label: 'Power', bonus: 300, popular: false },
  { id: 6, coins: 5000, price: 4000, label: 'Pro', bonus: 1000, popular: false },
]

export default function WalletScreen({ user, session, onBack }) {
  const [balance, setBalance] = useState(user.coins || 0)
  const [transactions, setTransactions] = useState([])
  const [selected, setSelected] = useState(null)
  const [payMethod, setPayMethod] = useState('card')
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', name: '' })
  const [upiId, setUpiId] = useState('')
  const [done, setDone] = useState(false)
  const [paying, setPaying] = useState(false)

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return
    sb.from('profiles').select('coins').eq('id', userId).single().then(({ data }) => {
      if (data && data.coins != null) setBalance(data.coins)
    })
    sb.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      if (data) setTransactions(data)
    })
  }, [userId])

  const updateCard = (field, val) => setCardForm(c => ({ ...c, [field]: val }))

  const validate = () => {
    if (payMethod === 'card') {
      if (!/^\d{16}$/.test(cardForm.number.replace(/\s/g, ''))) return 'Invalid card number'
      if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) return 'Invalid expiry'
      if (!/^\d{3}$/.test(cardForm.cvv)) return 'Invalid CVV'
      if (!cardForm.name.trim()) return 'Cardholder name required'
    } else {
      if (!upiId.includes('@')) return 'Invalid UPI ID'
    }
    return null
  }

  const pay = async () => {
    const err = validate()
    if (err) return alert(err)
    setPaying(true)

    // Simulate payment
    await new Promise(r => setTimeout(r, 1500))

    const newBalance = balance + selected.coins + (selected.bonus || 0)
    setBalance(newBalance)

    // Update DB
    if (userId) {
      await sb.from('profiles').update({ coins: newBalance }).eq('id', userId)
      const { data: newTx } = await sb.from('transactions').insert([{
        user_id: userId, type: 'purchase',
        label: `Purchased ${selected.coins}${selected.bonus ? '+' + selected.bonus : ''} coins`,
        coins: selected.coins + (selected.bonus || 0),
        amount: selected.price,
      }]).select()
      // Refresh in-memory transaction list immediately
      if (newTx && newTx[0]) setTransactions(prev => [newTx[0], ...prev])
    }

    setDone(true)
    setPaying(false)
  }

  // Reset form when returning from success
  const resetAndGoBack = () => {
    setSelected(null)
    setDone(false)
    setCardForm({ number: '', expiry: '', cvv: '', name: '' })
    setUpiId('')
    setPayMethod('card')
  }

  if (done) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ ...card(), padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 80 }}>🎉</div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Payment Successful!</h2>
          <p style={{ color: C.t2, marginBottom: 24 }}>{selected.coins + (selected.bonus || 0)} coins added to your wallet</p>
          <p style={{ fontSize: 16, marginBottom: 24 }}>New Balance: <b className="brand-grad" style={{ fontSize: 24 }}>{balance}</b></p>
          <button onClick={resetAndGoBack} style={btnPri()}>Back to Wallet</button>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 80px' }}>
        <button onClick={() => setSelected(null)} style={btnBack()}>
          <div style={{ width: 16, height: 16 }}>{Icon.back()}</div> Back
        </button>

        <div style={{ ...card(), padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{selected.label}</h2>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.amber }}>{selected.coins} 🪙</div>
          {selected.bonus > 0 && <div style={{ fontSize: 13, color: C.green, marginTop: 4 }}>+ {selected.bonus} bonus coins!</div>}
          <div style={{ fontSize: 18, color: C.text, marginTop: 12 }}>₹{selected.price}</div>
        </div>

        <div style={{ ...card(), padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Payment Method</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setPayMethod('card')} style={{
              flex: 1, padding: 12, borderRadius: 10,
              background: payMethod === 'card' ? C.acg : C.bg3,
              border: `1px solid ${payMethod === 'card' ? C.ac : C.border}`,
              color: payMethod === 'card' ? C.ac : C.text,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>💳 Card</button>
            <button onClick={() => setPayMethod('upi')} style={{
              flex: 1, padding: 12, borderRadius: 10,
              background: payMethod === 'upi' ? C.acg : C.bg3,
              border: `1px solid ${payMethod === 'upi' ? C.ac : C.border}`,
              color: payMethod === 'upi' ? C.ac : C.text,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>📱 UPI</button>
          </div>

          {payMethod === 'card' ? (
            <>
              <Field label="Cardholder Name">
                <input value={cardForm.name} onChange={(e) => updateCard('name', e.target.value)} style={inp()} />
              </Field>
              <Field label="Card Number">
                <input value={cardForm.number} onChange={(e) => updateCard('number', e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="1234 5678 9012 3456" style={inp()} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Expiry">
                  <input value={cardForm.expiry} onChange={(e) => updateCard('expiry', e.target.value.slice(0, 5))} placeholder="MM/YY" style={inp()} />
                </Field>
                <Field label="CVV">
                  <input value={cardForm.cvv} onChange={(e) => updateCard('cvv', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="123" style={inp()} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="UPI ID">
                <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" style={inp()} />
              </Field>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(u => (
                  <span key={u} style={{
                    padding: '4px 10px', borderRadius: 12,
                    background: C.bg3, fontSize: 11, color: C.t2,
                  }}>{u}</span>
                ))}
              </div>
            </>
          )}

          <button onClick={pay} disabled={paying} style={{ ...btnPri(), marginTop: 20 }}>
            {paying ? 'Processing...' : `Pay ₹${selected.price}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}>
      {onBack && (
        <button onClick={onBack} style={btnBack()}>
          <div style={{ width: 16, height: 16 }}>{Icon.back()}</div> Back
        </button>
      )}

      <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20 }}>Wallet</h1>

      {/* Balance card */}
      <div style={{
        background: C.grad, borderRadius: 18, padding: 28, marginBottom: 20,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Your Balance</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          {(Number(balance) || 0).toLocaleString()} <span style={{ fontSize: 28 }}>🪙</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>RingIn Coins</div>
      </div>

      {/* Packages */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Top Up</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {PACKAGES.map(pkg => (
            <div key={pkg.id} onClick={() => setSelected(pkg)} style={{
              ...card(), padding: 18, cursor: 'pointer',
              border: pkg.popular ? `2px solid ${C.ac}` : `1px solid ${C.border}`,
              position: 'relative', transition: 'transform 0.2s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {pkg.popular && (
                <div style={{
                  position: 'absolute', top: -10, right: 10,
                  background: C.grad, color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 12,
                }}>POPULAR</div>
              )}
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 4 }}>{pkg.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.amber }}>{pkg.coins} 🪙</div>
              {pkg.bonus > 0 && (
                <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>+ {pkg.bonus} bonus</div>
              )}
              <div style={{ fontSize: 16, color: C.text, marginTop: 8, fontWeight: 700 }}>₹{pkg.price}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Recent Activity</h2>
        <div style={{ ...card() }}>
          {transactions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.t2 }}>No transactions yet</div>
          ) : (
            transactions.map((t, i) => (
              <div key={t.id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: i < transactions.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{new Date(t.created_at || Date.now()).toLocaleDateString()}</div>
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: t.coins > 0 ? C.green : C.red,
                }}>
                  {t.coins > 0 ? '+' : ''}{t.coins} 🪙
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function card(extra = {}) {
  return { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, ...extra }
}
function btnBack() {
  return {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    padding: '8px 14px', borderRadius: 10,
    background: C.bg3, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 13, cursor: 'pointer',
  }
}
function btnPri() {
  return {
    width: '100%', padding: 14, borderRadius: 10,
    background: C.grad, color: '#fff', border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  }
}
function inp() {
  return {
    width: '100%', padding: '10px 14px', background: C.bg3,
    border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  }
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
