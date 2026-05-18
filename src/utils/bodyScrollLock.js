/* eslint-disable */
/* R20 FIX #2 — reference-counted body-scroll-lock.
 *
 * The R18 modal-a11y rollout added `document.body.style.overflow = 'hidden'`
 * in 6+ independent useEffects (HomeScreen post-detail + edit-post,
 * ProfileScreen phone-code-picker + tz-picker, FollowersListModal,
 * ReportModal). Each effect captured its OWN snapshot of the prior overflow
 * value and restored on cleanup. That's fine for one modal at a time, but
 * when 2 modals are open simultaneously (e.g. open post-detail → tap to open
 * edit-post over it), the second effect captures `'hidden'` as the "prior"
 * value and restores to `'hidden'` on its cleanup — leaving the body
 * permanently unscrollable once both modals close.
 *
 * Fix: ref-counted lock. The TRUE original value is captured once on 0→1
 * transition, restored exactly once on 1→0 transition.
 *
 * Usage:
 *   useEffect(function(){
 *     if (!isOpen) return;
 *     var release = acquireBodyScrollLock();
 *     return release;
 *   }, [isOpen]);
 */

var _count = 0;
var _originalOverflow = null; // captured once on first acquire

function _isClient(){ return typeof document !== 'undefined' && document.body; }

/* Acquire a lock. Returns a release function that decrements the counter.
 * Call release() ONCE — multiple calls are no-ops, no double-decrement. */
export function acquireBodyScrollLock(){
  if (!_isClient()) return function(){};
  if (_count === 0) {
    try { _originalOverflow = document.body.style.overflow || ''; } catch(_){ _originalOverflow = ''; }
    try { document.body.style.overflow = 'hidden'; } catch(_){}
  }
  _count++;
  var released = false;
  return function release(){
    if (released) return;
    released = true;
    if (_count > 0) _count--;
    if (_count === 0) {
      try { document.body.style.overflow = _originalOverflow != null ? _originalOverflow : ''; } catch(_){}
      _originalOverflow = null;
    }
  };
}

/* Diagnostic — current depth. Don't depend on this in production logic. */
export function _getLockDepth(){ return _count; }
