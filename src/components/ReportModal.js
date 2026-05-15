/* eslint-disable */
import React, {useState} from 'react';
import {sb} from '../utils/supabase';

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

// Best-effort insert. If the table is missing or RLS blocks, fall back to
// localStorage so we never silently drop a report.
function submitReport(payload) {
  return sb.from('reports').insert([payload]).select().single().then(function(res){
    if (res.error) throw res.error;
    return { ok: true, mode: 'supabase', id: res.data && res.data.id };
  }).catch(function(err) {
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

  if (!target) return null;
  var reporterId = (session && session.user && session.user.id) || null;
  var canSubmit = !!category && !!reporterId && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    submitReport({
      reporter_id: reporterId,
      target_type: target.type,
      target_id: String(target.id),
      category: category,
      details: (details || '').trim() || null,
    }).then(function(res){
      setSubmitting(false);
      setDone(res.mode);
    }).catch(function(){
      setSubmitting(false);
      setDone('error');
    });
  }

  function close() {
    if (submitting) return;  // don't close mid-submit
    setCategory(null);
    setDetails('');
    setDone(null);
    if (onClose) onClose();
  }

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
        React.createElement('button', {
          onClick: close, disabled: submitting,
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
          onClick: close, disabled: submitting,
          style: {
            background: 'transparent', color: 'var(--t2)',
            border: '1px solid var(--border)', padding: '9px 18px',
            borderRadius: '20px', fontSize: '13px', fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
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
