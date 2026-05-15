/* Server-rendered SEO landing content — visible to crawlers (via noscript) AND logged-out users */
import Link from 'next/link'

const C = {
  bg: '#09090E', bg2: '#111117', bg3: '#17171F', bg4: '#1E1E28',
  text: '#EEEEF8', t2: '#8F8FAA', t3: '#52526A',
  border: '#28283A', ac: '#7B6EFF',
  grad: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
}

export default function SeoLandingContent({ experts = [], posts = [], showLoginCta, onShowLogin }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Top nav for logged-out users */}
      <nav className="seo-nav" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(17,17,23,0.85)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
      }}>
        <Link href="/" style={{
          fontFamily: 'Syne', fontSize: 22, fontWeight: 800,
          background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textDecoration: 'none', flexShrink: 0,
        }}>RingIn</Link>
        <div className="seo-nav-links" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/experts" className="seo-nav-link" style={{ fontSize: 14, color: C.text, textDecoration: 'none', fontWeight: 600 }}>Experts</Link>
          <Link href="/workshops" className="seo-nav-link" style={{ fontSize: 14, color: C.text, textDecoration: 'none', fontWeight: 600 }}>Workshops</Link>
          {onShowLogin ? (
            <button onClick={onShowLogin} style={{
              padding: '8px 18px', borderRadius: 8, background: C.grad,
              color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}>Sign In</button>
          ) : (
            <Link href="#" style={{
              padding: '8px 18px', borderRadius: 8, background: C.grad,
              color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>Sign In</Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <header className="seo-hero" style={{
        background: 'linear-gradient(180deg, rgba(123,110,255,0.08), transparent)',
        padding: '60px 20px', textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, marginBottom: 16,
          background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', lineHeight: 1.1,
        }}>
          Talk to Verified Experts Instantly
        </h1>
        <p style={{ fontSize: 'clamp(15px, 1.8vw, 19px)', color: C.t2, maxWidth: 720, margin: '0 auto 28px', lineHeight: 1.5 }}>
          Connect with verified doctors, lawyers, career coaches, financial advisors, tech mentors, fitness trainers, UX designers, and marketing strategists. Pay per minute via secure call.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/experts" style={{
            padding: '14px 32px', background: C.grad, color: '#fff',
            borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}>Browse Experts</Link>
          {showLoginCta && onShowLogin ? (
            <button onClick={onShowLogin} style={{
              padding: '14px 32px', background: C.bg3, border: `1px solid ${C.border}`,
              color: C.text, borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>Sign Up Free</button>
          ) : (
            <Link href="/workshops" style={{
              padding: '14px 32px', background: C.bg3, border: `1px solid ${C.border}`,
              color: C.text, borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none',
            }}>Live Workshops</Link>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
        {/* Categories */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
            Browse Experts by Category
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { id: 'health', icon: '🏥', label: 'Health & Medical', desc: 'Doctors, psychologists' },
              { id: 'tech', icon: '💻', label: 'Tech & Engineering', desc: 'System design, code mentors' },
              { id: 'career', icon: '🎯', label: 'Career Coaching', desc: 'Interview prep, LinkedIn' },
              { id: 'legal', icon: '⚖️', label: 'Legal Advice', desc: 'Contracts, compliance' },
              { id: 'finance', icon: '💰', label: 'Finance', desc: 'Investment, tax planning' },
              { id: 'fitness', icon: '💪', label: 'Fitness & Wellness', desc: 'Trainers, nutrition' },
              { id: 'design', icon: '🎨', label: 'Design', desc: 'UX/UI, portfolio review' },
              { id: 'business', icon: '📈', label: 'Business', desc: 'Growth, marketing' },
            ].map(c => (
              <Link key={c.id} href={`/experts/${c.id}`} style={{
                background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: 18, textAlign: 'center', textDecoration: 'none', color: C.text,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: C.t3 }}>{c.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Experts */}
        {experts.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
              Featured Experts on RingIn
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {experts.map(e => (
                <Link key={e.id} href={`/u/${e.id}`} style={{
                  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: 18, textAlign: 'center', textDecoration: 'none', color: C.text,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: e.img ? `url(${e.img}) center/cover` : C.ac,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 10px', color: '#fff', fontWeight: 700, fontSize: 20,
                  }}>{!e.img && (e.name || '?').charAt(0)}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{e.tag}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Posts */}
        {posts.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
              Recent Expert Insights
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {posts.map(p => (
                <Link key={p.id} href={`/post/${p.id}`} style={{
                  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: 18, textDecoration: 'none', color: C.text,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ac, marginBottom: 8 }}>{p.user_name}</div>
                  <p style={{
                    fontSize: 14, lineHeight: 1.5, color: C.text,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  }}>{p.text}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Why RingIn */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
            Why RingIn?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: '✓', title: 'Verified Experts', desc: 'Every expert application is reviewed' },
              { icon: '🪙', title: 'Pay Per Minute', desc: 'No upfront commitment, fair pricing' },
              { icon: '🇮🇳', title: 'Built for India', desc: 'UPI, GPay, PhonePe, card payments' },
              { icon: '🎭', title: 'Anonymous Connect', desc: 'Talk to strangers privately by interest' },
              { icon: '💰', title: 'Earn as Expert', desc: 'Set your rate, get paid per call' },
              { icon: '📺', title: 'Live Workshops', desc: 'Learn from experts in real-time' },
            ].map((item, i) => (
              <div key={i} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
                <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
            Frequently Asked Questions
          </h2>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {[
              { q: 'How do I connect with an expert?', a: 'Browse experts by category, view their profile, and tap Call. You pay per minute using RingIn coins.' },
              { q: 'Are experts verified?', a: 'Yes — all expert applications are reviewed. Verified experts get a blue checkmark.' },
              { q: 'How much does it cost?', a: 'Browsing is free. Calls cost coins per minute (usually 50-150 coins/min). 1 coin ≈ ₹1.' },
              { q: 'Can I become an expert?', a: 'Yes! Apply via Settings → Become an Expert. Set your rate and earn coins.' },
              { q: 'Available in India and Kerala?', a: 'Yes — RingIn is built in India with a strong focus on Kerala launch.' },
            ].map((item, i) => (
              <div key={i} style={{
                background: C.bg2, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: 20, marginBottom: 10,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.q}</h3>
                <p style={{ fontSize: 14, color: C.t2, lineHeight: 1.6 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Ready to talk to an expert?</h2>
          <p style={{ fontSize: 16, color: C.t2, marginBottom: 24 }}>Sign up free and get your first 100 coins on us</p>
          {showLoginCta && onShowLogin ? (
            <button onClick={onShowLogin} style={{
              padding: '16px 40px', background: C.grad, color: '#fff', borderRadius: 12,
              fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
            }}>Sign Up Free</button>
          ) : (
            <Link href="/experts" style={{
              display: 'inline-block', padding: '16px 40px', background: C.grad,
              color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 16, textDecoration: 'none',
            }}>Browse Experts</Link>
          )}
        </section>
      </main>

      <footer style={{
        background: C.bg2, padding: '40px 20px', borderTop: `1px solid ${C.border}`,
        textAlign: 'center', fontSize: 13, color: C.t3,
      }}>
        <p>© 2026 RingIn — Talk to Verified Experts Instantly · India</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/experts" style={{ color: C.t2, textDecoration: 'none' }}>Experts</Link>
          <Link href="/workshops" style={{ color: C.t2, textDecoration: 'none' }}>Workshops</Link>
          <a href="mailto:support@ringin.app" style={{ color: C.t2, textDecoration: 'none' }}>Support</a>
        </div>
      </footer>
    </div>
  )
}
