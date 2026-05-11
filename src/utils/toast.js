/* eslint-disable */
/* Lightweight toast notifications — no dependencies */
var container = null;

function ensureContainer() {
  if (typeof document === 'undefined') return null;
  // Recreate if cached container was removed from DOM
  if (container && !container.isConnected) container = null;
  if (container) return container;
  // Try finding existing one first (e.g. on HMR / multiple modules)
  var existing = document.getElementById('ringin-toast-container');
  if (existing) { container = existing; return container; }
  container = document.createElement('div');
  container.id = 'ringin-toast-container';
  container.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;width:90%;max-width:380px;align-items:center;';
  document.body.appendChild(container);
  return container;
}

export function showToast(message, opts) {
  opts = opts || {};
  var type = opts.type || 'info'; // info | success | error | warn
  var duration = opts.duration || 2500;
  var c = ensureContainer();
  if (!c) return;

  var colors = {
    info: 'rgba(123,110,255,0.95)',
    success: 'rgba(39,201,106,0.95)',
    error: 'rgba(239,71,71,0.95)',
    warn: 'rgba(245,166,35,0.95)',
  };

  var t = document.createElement('div');
  t.style.cssText = [
    'background:' + (colors[type] || colors.info),
    'color:#fff',
    'padding:12px 20px',
    'border-radius:12px',
    'font-size:14px',
    'font-weight:600',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    'backdrop-filter:blur(8px)',
    'pointer-events:auto',
    'animation:toastSlide 0.3s ease-out',
    'max-width:100%',
    'text-align:center',
  ].join(';');
  t.textContent = message;

  // CSS keyframes if not present
  if (!document.getElementById('ringin-toast-styles')) {
    var s = document.createElement('style');
    s.id = 'ringin-toast-styles';
    s.textContent = '@keyframes toastSlide{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}@keyframes toastFade{to{opacity:0;transform:translateY(-10px);}}';
    document.head.appendChild(s);
  }

  c.appendChild(t);

  setTimeout(function() {
    t.style.animation = 'toastFade 0.3s ease forwards';
    setTimeout(function() {
      try { c.removeChild(t); } catch (e) {}
    }, 300);
  }, duration);
}

export function toastSuccess(msg) { showToast(msg, {type: 'success'}); }
export function toastError(msg) { showToast(msg, {type: 'error'}); }
export function toastWarn(msg) { showToast(msg, {type: 'warn'}); }
export function toastInfo(msg) { showToast(msg, {type: 'info'}); }
