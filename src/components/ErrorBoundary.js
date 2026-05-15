/* eslint-disable */
import React from 'react';

// ──────────────────────────────────────────────────────────────────────────
// ErrorBoundary — catches render-time errors in any subtree so a single
// crash doesn't blank the whole app. Modeled after Sentry's pattern but
// without the Sentry SDK dependency. When Sentry (or another reporter) is
// added later, plug it into componentDidCatch — the rest of the contract
// stays the same.
//
// Usage:
//   <ErrorBoundary scope="CallScreen" fallback={<MinimalCallFallback/>}>
//     <CallScreen ... />
//   </ErrorBoundary>
//
// Props:
//   scope     string — short label for the failing region (shown in fallback
//                       and in the console). Used as a tag if/when Sentry is wired.
//   fallback  ReactNode? — optional custom fallback UI. Default is a small
//                       "Something went wrong" tile with a Reload button.
//   onError   (err, info) => void? — optional extra handler.
//   children  ReactNode
//
// We use a class component because React only exposes error-boundary
// behavior on classes (not hooks, as of React 19). Single class. ~80 lines.
// ──────────────────────────────────────────────────────────────────────────

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
    this.handleReload = this.handleReload.bind(this);
    this.handleClear = this.handleClear.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error: error };
  }

  componentDidCatch(error, info) {
    var scope = this.props.scope || 'unknown';
    // Surface to console for local debugging. When we wire Sentry, replace
    // this block with: Sentry.captureException(error, { tags: { scope }, extra: { componentStack: info.componentStack } });
    try {
      console.error('[ringin] ErrorBoundary caught in scope=' + scope, error);
      if (info && info.componentStack) console.error('[ringin]   componentStack:', info.componentStack);
    } catch (_) {}

    // Persist a tiny diagnostic crumb to localStorage so the next session can
    // surface it (e.g. "looks like the call screen crashed last time — was
    // it the speaker toggle?"). Capped at 5 entries.
    try {
      var key = 'ringin_crash_log';
      var raw = localStorage.getItem(key);
      var log = raw ? JSON.parse(raw) : [];
      log.unshift({
        scope: scope,
        message: (error && error.message) || String(error),
        ts: new Date().toISOString(),
        url: (typeof location !== 'undefined' && location.href) || null,
        ua: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
      });
      log = log.slice(0, 5);
      localStorage.setItem(key, JSON.stringify(log));
    } catch (_) {}

    this.setState({ info: info });

    if (typeof this.props.onError === 'function') {
      try { this.props.onError(error, info); } catch (_) {}
    }
  }

  handleReload() {
    try { window.location.reload(); } catch (_) {}
  }

  handleClear() {
    // "Try again" — clears the boundary's error state. If the underlying
    // bug is deterministic, it'll re-throw on next render (and we end up
    // back here). If it was a transient (e.g. network race), it's gone.
    this.setState({ error: null, info: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    // If parent provided a custom fallback (e.g. a tiny "Call interrupted"
    // banner instead of a generic error tile), use it.
    if (this.props.fallback) {
      // Allow function-form fallback for full control
      if (typeof this.props.fallback === 'function') {
        try { return this.props.fallback(this.state.error, this.handleClear, this.handleReload); }
        catch (_) { /* fall through to default */ }
      } else {
        return this.props.fallback;
      }
    }

    var scope = this.props.scope || 'this part of the app';
    var msg = (this.state.error && this.state.error.message) || 'Something broke.';

    // Default fallback: tasteful + minimally invasive. Doesn't block the
    // rest of the app from working — it just replaces the failing subtree.
    return React.createElement('div', {
      role: 'alert',
      style: {
        background: 'var(--bg2, #161028)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: '14px',
        padding: '20px',
        margin: '12px auto',
        maxWidth: '380px',
        textAlign: 'center',
        color: 'var(--text, #ebebef)',
        fontFamily: 'inherit',
      }
    },
      React.createElement('div', { style: { fontSize: '32px', marginBottom: '6px' } }, '⚠️'),
      React.createElement('div', { style: { fontWeight: 700, fontSize: '14px', marginBottom: '4px' } },
        scope.charAt(0).toUpperCase() + scope.slice(1) + ' hit a snag'
      ),
      React.createElement('div', { style: { fontSize: '12px', color: 'var(--t2, #888)', marginBottom: '14px', wordBreak: 'break-word' } },
        msg
      ),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
        React.createElement('button', {
          onClick: this.handleClear,
          style: {
            background: 'var(--bg3, rgba(255,255,255,0.06))',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            padding: '8px 16px', borderRadius: '20px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }
        }, 'Try again'),
        React.createElement('button', {
          onClick: this.handleReload,
          style: {
            background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
            color: '#fff', border: 'none',
            padding: '8px 18px', borderRadius: '20px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }
        }, 'Reload app')
      )
    );
  }
}
