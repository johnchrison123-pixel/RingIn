// FIX #10: safe initials helper — handles emoji-prefix names (4-byte surrogate pairs)
// .substring(0,2) splits 4-byte chars in half producing garbage; Array.from iterates by code point.
export function safeInitials(name, fallback){
  fallback = fallback || '?';
  if (!name || typeof name !== 'string') return fallback;
  try {
    var chars = Array.from(name.trim());
    if (chars.length === 0) return fallback;
    var s = chars.slice(0, 2).join('');
    return s.toUpperCase();
  } catch (_) {
    return fallback;
  }
}
