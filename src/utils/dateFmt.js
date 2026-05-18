/* eslint-disable */
// Timezone-aware date/time formatters.
//
// Reads the user's preferred timezone from localStorage key `user_timezone`
// (matches the existing ad-hoc usage in MessagesScreen ChatBox). If unset,
// falls back to the browser-detected zone via toLocaleString defaults.
//
// All helpers tolerate null/undefined/invalid input by returning ''.
// Use in display-only paths — for elapsed-time math (e.g. "Just now",
// "5m ago") keep using ms subtraction, not these.

function getTz(){
  try { return localStorage.getItem('user_timezone') || undefined; } catch(_) { return undefined; }
}

function toDate(input){
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  var d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(input){
  var d = toDate(input); if (!d) return '';
  try {
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', timeZone: getTz() });
  } catch(_) {
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }
}

export function formatDate(input){
  var d = toDate(input); if (!d) return '';
  try {
    return d.toLocaleDateString([], { month:'short', day:'numeric', timeZone: getTz() });
  } catch(_) {
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
  }
}

export function formatDateTime(input){
  var d = toDate(input); if (!d) return '';
  try {
    return d.toLocaleString([], {
      month:'short', day:'numeric', hour:'2-digit', minute:'2-digit',
      timeZone: getTz()
    });
  } catch(_) {
    return d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }
}

// Safe localStorage.setItem wrapper — swallows the quota-exceeded / private-
// mode / disabled-storage SecurityError that browsers throw. Every unwrapped
// `localStorage.setItem` is a latent crash; this helper makes them all no-op
// gracefully. Returns true on success, false on failure. Logged via console
// at warn level only (not error) so debug output stays clean.
export function safeSetItem(key, value){
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    try { console.warn('[ringin] safeSetItem failed for ' + key + ':', e && e.message ? e.message : e); } catch(_){}
    return false;
  }
}

export default { formatTime: formatTime, formatDate: formatDate, formatDateTime: formatDateTime, safeSetItem: safeSetItem };
