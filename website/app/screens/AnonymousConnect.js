'use client'

import { useState } from 'react'
import { Icon } from '../lib/icons'
import Avatar from '../components/Avatar'
import { matchAnonymous } from '../lib/mlService'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF', acg: 'rgba(123,110,255,.14)',
  green: '#27C96A', red: '#EF4747', pink: '#E84D9A',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

const SUGGESTED_INTERESTS = [
  'tech', 'startups', 'fitness', 'music', 'travel', 'finance',
  'mental health', 'career', 'parenting', 'design', 'food',
  'movies', 'gaming', 'meditation', 'philosophy',
]

export default function AnonymousConnect({ user, session }) {
  const [interests, setInterests] = useState([])
  const [interestInput, setInterestInput] = useState('')
  const [sameGeography, setSameGeography] = useState(true)
  const [searching, setSearching] = useState(false)
  const [match, setMatch] = useState(null)
  const [excludedIds, setExcludedIds] = useState([])
  const [error, setError] = useState(null)

  const addInterest = (interest) => {
    const cleaned = interest.trim().toLowerCase()
    if (!cleaned) { setInterestInput(''); return }
    setInterests(prev => prev.indexOf(cleaned) < 0 ? [...prev, cleaned] : prev)
    setInterestInput('')
  }

  const removeInterest = (i) => {
    setInterests(interests.filter(x => x !== i))
  }

  const findMatch = async (overrideExclude) => {
    if (!session?.user?.id) {
      setError('Please log in to use Anonymous Connect')
      return
    }
    setSearching(true)
    setError(null)
    setMatch(null)

    try {
      const result = await matchAnonymous({
        userId: session.user.id,
        interests,
        sameGeography,
        excludeUserIds: overrideExclude || excludedIds,
      })

      if (!result || !result.match) {
        setError(result?.reason || 'No matches available right now. Try again in a moment!')
        setSearching(false)
        return
      }

      setMatch(result.match)
    } catch (e) {
      setError('Failed to find match: ' + (e.message || e))
    }
    setSearching(false)
  }

  const skipMatch = () => {
    // Build new exclusion list and pass it directly (avoid stale closure)
    const newExcluded = match && match.user_id
      ? [...excludedIds, match.user_id]
      : excludedIds
    setExcludedIds(newExcluded)
    setMatch(null)
    findMatch(newExcluded)
  }

  return (
    <div className="anon-page" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 90px' }}>
      <h1 className="anon-h1" style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, color: C.text, marginBottom: 8 }}>
        🎭 Anonymous Connect
      </h1>
      <p style={{ fontSize: 14, color: C.t2, marginBottom: 24 }}>
        Talk to a stranger by interests + geography. No profiles shared until you both agree.
      </p>

      {/* Searching state */}
      {searching && (
        <div style={{
          background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: 60, textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
            background: C.grad, animation: 'pulse-orb 1.5s ease-in-out infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          }}>📞</div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700 }}>Finding someone...</h2>
          <p style={{ color: C.t2, fontSize: 13, marginTop: 8 }}>
            Searching {sameGeography ? 'in your area' : 'globally'}
            {interests.length > 0 && ` who's into ${interests.slice(0, 2).join(', ')}`}
          </p>
        </div>
      )}

      {/* Match found */}
      {match && !searching && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(123,110,255,0.15), rgba(232,77,154,0.1))',
          border: `1px solid ${C.ac}`, borderRadius: 14,
          padding: 32, textAlign: 'center', marginBottom: 24,
        }}>
          <Avatar user={{ name: match.profile?.name || 'Anonymous', img: match.profile?.avatar_url }} size={88} />
          <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginTop: 16 }}>
            {match.profile?.name || 'Anonymous Match'}
          </h2>
          <p style={{ color: C.t2, fontSize: 14, marginTop: 4 }}>{match.profile?.tag}</p>
          {match.profile?.city && (
            <p style={{ color: C.t3, fontSize: 12, marginTop: 4 }}>
              📍 {match.profile.city}{match.profile.country && `, ${match.profile.country}`}
            </p>
          )}
          {match.reasons?.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {match.reasons.map((r, i) => (
                <span key={i} style={{
                  padding: '4px 12px', borderRadius: 12, background: C.acg, color: C.ac,
                  fontSize: 11, fontWeight: 600,
                }}>{r}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
            <button onClick={skipMatch} style={{
              padding: '12px 24px', borderRadius: 10,
              background: C.bg4, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Skip</button>
            <button onClick={() => alert('Voice call coming soon!')} style={{
              padding: '12px 24px', borderRadius: 10,
              background: C.grad, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>📞 Connect Voice</button>
          </div>
        </div>
      )}

      {/* Setup screen */}
      {!searching && !match && (
        <>
          <div style={{
            background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 24, marginBottom: 16,
          }}>
            <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Your Interests
            </h3>
            <p style={{ fontSize: 12, color: C.t2, marginBottom: 12 }}>
              Add what you want to talk about — we'll find someone who shares them
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {interests.map(i => (
                <span key={i} style={{
                  padding: '6px 12px', borderRadius: 16, background: C.acg, color: C.ac,
                  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {i}
                  <span onClick={() => removeInterest(i)} style={{ cursor: 'pointer', fontSize: 14 }}>×</span>
                </span>
              ))}
            </div>

            <input
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && interestInput.trim()) {
                  addInterest(interestInput)
                }
              }}
              placeholder="Type and press Enter (e.g. 'travel')"
              style={{
                width: '100%', padding: '10px 14px',
                background: C.bg3, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.text, fontSize: 14, outline: 'none',
              }}
            />

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>Quick add:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUGGESTED_INTERESTS.filter(s => !interests.includes(s)).slice(0, 8).map(s => (
                  <button key={s} onClick={() => addInterest(s)} style={{
                    padding: '4px 10px', borderRadius: 12,
                    background: C.bg3, border: `1px solid ${C.border}`,
                    color: C.t2, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>+ {s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Geography toggle */}
          <div style={{
            background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 16, marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Match local users only</div>
              <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                Prefer people in your city/state
              </div>
            </div>
            <button
              onClick={() => setSameGeography(!sameGeography)}
              style={{
                width: 48, height: 28, borderRadius: 14,
                background: sameGeography ? C.ac : C.bg4, border: 'none',
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: sameGeography ? 22 : 2,
                width: 24, height: 24, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {error && (
            <div style={{
              padding: 14, background: 'rgba(239,71,71,0.1)', border: `1px solid ${C.red}`,
              borderRadius: 10, color: C.red, fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          <button onClick={findMatch} style={{
            width: '100%', padding: 16, borderRadius: 12,
            background: C.grad, color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>
            🎯 Find Someone to Talk To
          </button>
        </>
      )}
    </div>
  )
}
