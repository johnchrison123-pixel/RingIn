/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';
import {sb} from '../utils/supabase';
import {toastInfo} from '../utils/toast';
import {acquireBodyScrollLock} from '../utils/bodyScrollLock'; /* R20 FIX #2 */

// ──────────────────────────────────────────────────────────────────────────
// ReportModal — replaces the previously fake `alert("Thank you for
// reporting...")` with a real submit-to-Supabase flow. Uses the `reports`
// table defined in supabase/migrations/0002_reports.sql.
//
// If the table doesn't exist yet (migration not applied), the report is
// queued in localStorage under `ringin_reports_queue` so we still have a
// record. Next time we run the migration AND a user opens the app, a
// background flush sends the queued reports to Supabase.
//
// R18 additions:
//   - ESC closes modal + body-scroll-lock (Fix A)
//   - 10s abort timeout on Supabase insert + X-button closable mid-submit (Fix B)
//   - 60s per-target dedupe to stop spam-re-submit (Fix C)
//
// Usage:
//   var [open, setOpen] = useState(null);  // null or { type, id, label? }
//   <ReportModal target={open} onClose={() => setOpen(null)} session={session} />
//
// To open: setOpen({ type: 'post', id: postId })
//                    or { type: 'user', id: userId, label: userName }
//                    or { type: 'comment', id: commentId }
//                    or { type: 'photo', id: photoUrl }
//                    or { type: 'message', id: messageId }
//                    or { type: 'moment', id: momentId }
// ──────────────────────────────────────────────────────────────────────────

var CATEGORIES = [
  {id:'spam',       label:'Spam or scam',         icon:'🚫', help:'Repetitive, deceptive, or commercial.'},
  {id:'harassment', label:'Harassment or bullying', icon:'😡', help:'Targets a person with cruelty or threats.'},
  {id:'hate',       label:'Hate speech',          icon:'⚠️', help:'Attacks based on race, religion, gender, etc.'},
  {id:'sexual',     label:'Sexual content',       icon:'🔞', help:'Explicit content or nudity outside policy.'},
  {id:'violence',   label:'Violence or self-harm', icon:'🛑', help:'Graphic violence, threats, or self-harm.'},
  {id:'misinfo',    label:'False information',    icon:'❓', help:'Knowingly false claims meant to mislead.'},
  {id:'other',      label:'Something else',       icon:'•',  help:'Tell us in the box below.'},
];

// R18 Fix C — module-scope dedupe map. Key = type+':'+id, value = timestamp.
// Survives modal unmount/remount so the user can't spam-resubmit the same
// target by tap-tap-tap.
var lastReportedTargets = new Map();
var DEDUPE_WINDOW_MS = 60000;

// R18 Fix B — Best-effort insert with optional AbortSignal. If table is
// missing, RLS blocks, or signal aborts, falls back to localStorage queue.
function submitReport(payload, signal) {
  var insertPromise = sb.from('reports').insert([payload]).select().single().then(function(res){
    if (res.error) throw res.error;
    return { ok: true, mode: 'supabase', id: res.data && res.data.id };
  });
  // Race against an abort promise so we don't hang on slow networks
  if (signal && typeof AbortController !== 'undefined') {
    var abortPromise = new Promise(function(_, reject){
      if (signal.aborted) return reject(new Error('aborted'));
      signal.addEventListener('abort', function(){ reject(new Error('aborted')); });
    });
    insertPromise = Promise.race([insertPromise, abortPromise]);
  }
  return insertPromise.catch(function(err) {
    try {
      var queue = JSON.parse(localStorage.getItem('ringin_reports_queue') || '[]');
      queue.push(Object.assign({}, payload, {
        local_id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        local_at: new Date().toISOString(),
        local_error: (err && err.message) || String(err),
      }));
      localStorage.setItem('ringin_reports_queue', JSON.stringify(queue));
    } catch(_) {}
    return { ok: true, mode: 'local', error: err };
  });
}

// Background flush on next app load — call this from App.js useEffect
// once the migration is applied. Drains the localStorage queue into Supabase.
export function flushQueuedReports() {
  try {
    var raw = localStorage.getItem('ringin_reports_queue');
    if (!raw) return Promise.resolve(0);
    var queue = JSON.parse(raw) || [];
    if (queue.length === 0) return Promise.resolve(0);
    var rows = queue.map(function(q) {
      var c = Object.assign({}, q);
      delete c.local_id; delete c.local_at; delete c.local_error;
      return c;
    });
    return sb.from('reports').insert(rows).then(function(res){
      if (res.error) return 0;
      try { localStorage.removeItem('ringin_reports_queue'); } catch(_) {}
      return rows.length;
    });
  } catch(_) { return Promise.resolve(0); }
}

export default function ReportModal(props) {
  var target = props.target;            // { type, id, label? }
  var onClose = props.onClose;
  var session = props.session;

  var catS = useState(null);
  var category = catS[0]; var setCategory = catS[1];
  var detailsS = useState('');
  var details = detailsS[0]; var setDetails = detailsS[1];
  var submittingS = useState(false);
  var submitting = submittingS[0]; var setSubmitting = submittingS[1];
  var doneS = useState(null);
  var done = doneS[0]; var setDone = doneS[1];

  // R18 Fix B — refs for in-flight abort controller + first-render guard + latest-close ref (for ESC)
  var ctrlRef = useRef(null);
  var firstTargetRef = useRef(true);
  var closeRef = useRef(null);

  // R18 Fix A — ESC closes + body-scroll-lock (gated on whether modal has a target)
  // R20 FIX #2 — switched to ref-counted lock so opening ReportModal over post-detail no longer leaks overflow:hidden
  useEffect(function(){
    if (!target) return;
    var releaseLock = acquireBodyScrollLock();
    function onKey(e){
      if (e.key === 'Escape' || e.keyCode === 27) {
        try { closeRef.current && closeRef.current(); } catch(_){}
      }
    }
    try { document.addEventListener('keydown', onKey); } catch(_){}
    return function(){
      try { document.removeEventListener('keydown', onKey); } catch(_){}
      releaseLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // R18 Fix B reset — reset submitting + abort controller on target change
  // (skip first render so we don't kill the very first submit before it starts)
  useEffect(function(){
    if (firstTargetRef.current) { firstTargetRef.current = false; return; }
    setSubmitting(false);
    if (ctrlRef.current) {
      try { ctrlRef.current.abort(); } catch(_){}
      ctrlRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target && target.id]);

  if (!target) return null;
  var reporterId = (session && session.user && session.user.id) || null;
  var canSubmit = !!category && !!reporterId && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    // R18 Fix C — dedupe check
    var dedupeKey = target.type + ':' + String(target.id);
    var lastTs = lastReportedTargets.get(dedupeKey);
    if (lastTs && (Date.now() - lastTs) < DEDUPE_WINDOW_MS) {
      try { toastInfo('Already reported — thanks'); } catch(_){}
      setDone('supabase'); // treat as success splash
      return;
    }
    setSubmitting(true);
    // Soft cap on map size — clear if huge
    if (lastReportedTargets.size > 200) {
      var cutoff = Date.now() - DEDUPE_WINDOW_MS;
      var toDelete = [];
      lastReportedTargets.forEach(function(ts, k){ if (ts < cutoff) toDelete.push(k); });
      toDelete.forEach(function(k){ lastReportedTargets.delete(k); });
    }
    // R18 Fix B — 10s abort timer
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    ctrlRef.current = ctrl;
    var timeoutId = null;
    if (ctrl) {
      timeoutId = setTimeout(function(){ try { ctrl.abort(); } catch(_){} }, 10000);
    }
    submitReport({
      reporter_id: reporterId,
      target_type: target.type,
      target_id: String(target.id),
      category: category,
      details: (details || '').trim() || null,
    }, ctrl ? ctrl.signal : null).then(function(res){
      if (timeoutId) clearTimeout(timeoutId);
      ctrlRef.current = null;
      setSubmitting(false);
      setDone(res.mode);
      lastReportedTargets.set(dedupeKey, Date.now());
    }).catch(function(){
      if (timeoutId) clearTimeout(timeoutId);
      ctrlRef.current = null;
      setSubmitting(false);
      setDone('error');
    });
  }

  function close() {
    // R18 Fix B — allow close mid-submit; just abort in-flight insert
    if (submitting && ctrlRef.current) {
      try { ctrlRef.current.abort(); } catch(_){}
      ctrlRef.current = null;
      setSubmitting(false);
    }
    setCategory(null);
    setDetails('');
    setDone(null);
    if (onClose) onClose();
  }
  // Keep ESC handler pointing to the latest close (re-declared every render)
  closeRef.current = close;

  // Backdrop + card
  return React.createElement('div', {
    onClick: close,
    style: {
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '20px 12px',
    }
  },
    React.createElement('div', {
      onClick: function(e){ e.stopPropagation(); },
      style: {
        background: 'var(--bg2, #161028)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: '20px',
        width: '100%', maxWidth: '420px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }
    },
      // Header
      React.createElement('div', {
        style: { padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }
      },
        React.createElement('div', { style: { fontSize: '20px' } }, '🚩'),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontSize: '15px', fontWeight: 700, color: 'var(--text)' } },
            done ? 'Report submitted' : 'Report ' + (target.label ? target.label : target.type)
          ),
          React.createElement('div', { style: { fontSize: '11px', color: 'var(--t2)' } },
            done ? 'Thanks. We will review within 24h.' : 'Tell us what is wrong. Reports are anonymous to the other party.'
          )
        ),
        // R18 Fix B — X button stays clickable mid-submit
        React.createElement('button', {
          onClick: close,
          style: { background: 'none', border: 'none', color: 'var(--t2)', fontSize: '24px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }
        }, '×')
      ),

      // Body
      done
        ? React.createElement('div', { style: { padding: '24px 20px', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '40px', marginBottom: '12px' } }, '✓'),
            React.createElement('div', { style: { fontSize: '13px', color: 'var(--text)', marginBottom: '4px' } },
              done === 'error' ? 'Couldn\'t reach the server, but we saved it locally — it will resync automatically.' :
              done === 'local' ? 'Saved locally — will sync once the database table is set up.' :
              'Got it. We will look into it.'
            ),
            React.createElement('button', {
              onClick: close,
              style: {
                marginTop: '16px',
                background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
                color: '#fff', border: 'none', padding: '10px 28px',
                borderRadius: '20px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit'
              }
            }, 'Done')
          )
        : React.createElement('div', { style: { padding: '12px 20px 16px', overflowY: 'auto', flex: 1 } },
            // Category list
            CATEGORIES.map(function(c) {
              var active = category === c.id;
              return React.createElement('button', {
                key: c.id,
                onClick: function(){ setCategory(c.id); },
                style: {
                  display: 'flex', width: '100%', alignItems: 'flex-start', gap: '12px',
                  padding: '10px 12px', marginBottom: '6px',
                  background: active ? 'var(--acg, rgba(123,110,255,0.15))' : 'var(--bg3, rgba(255,255,255,0.03))',
                  border: '1px solid ' + (active ? 'var(--ac, #7B6EFF)' : 'var(--border)'),
                  borderRadius: '12px',
                  color: 'var(--text)', textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }
              },
                React.createElement('div', { style: { fontSize: '18px', flexShrink: 0 } }, c.icon),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '2px' } }, c.label),
                  React.createElement('div', { style: { fontSize: '11px', color: 'var(--t2)' } }, c.help)
                ),
                active ? React.createElement('div', { style: { color: 'var(--ac)', fontSize: '14px', fontWeight: 700 } }, '✓') : null
              );
            }),
            // Details textarea (always visible, optional)
            React.createElement('div', { style: { marginTop: '10px' } },
              React.createElement('div', {
                style: { fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }
              }, 'Anything else we should know? (optional)'),
              React.createElement('textarea', {
                value: details,
                onChange: function(e){ setDetails(e.target.value); },
                maxLength: 500,
                placeholder: 'Add context, links, screenshots descriptions...',
                style: {
                  width: '100%', minHeight: '64px', resize: 'vertical',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '8px 10px',
                  color: 'var(--text)', fontSize: '13px',
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }
              })
            )
          ),

      // Footer
      done ? null : React.createElement('div', {
        style: { padding: '12px 20px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }
      },
        React.createElement('button', {
          onClick: close,
          style: {
            background: 'transparent', color: 'var(--t2)',
            border: '1px solid var(--border)', padding: '9px 18px',
            borderRadius: '20px', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }
        }, 'Cancel'),
        React.createElement('button', {
          onClick: handleSubmit, disabled: !canSubmit,
          style: {
            background: canSubmit ? 'linear-gradient(135deg,#7B6EFF,#E84D9A)' : 'var(--bg3)',
            color: canSubmit ? '#fff' : 'var(--t3)',
            border: 'none', padding: '9px 22px',
            borderRadius: '20px', fontSize: '13px', fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            opacity: submitting ? 0.7 : 1,
          }
        }, submitting ? 'Submitting…' : 'Submit report')
      )
    )
  );
}
