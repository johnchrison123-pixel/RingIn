/* eslint-disable */
/* ────────────────────────────────────────────────────────────────────────
 * R37 — Single source of truth for anonymous avatars.
 *
 * Before this file existed, ANON_AVATARS was duplicated in:
 *   - AnonymousConnect.js  (used in profile, connections list, match-found)
 *   - App.js               (ANON_AVATAR_LOOKUP, used by CallScreen for incoming calls)
 *
 * Both copies drifted: caller picked 👩 in their profile, callee saw 👧
 * during the call — different emoji, different gradient, same person.
 * Now every consumer imports from here so they can NEVER drift again.
 * ──────────────────────────────────────────────────────────────────────── */

export var ANON_AVATARS = [
  { id:'girl1', emoji:'👩',  gender:'f', bg:'linear-gradient(135deg,#FF6B9D,#E84D9A)' },
  { id:'girl2', emoji:'👧',  gender:'f', bg:'linear-gradient(135deg,#A78BFA,#7B6EFF)' },
  { id:'girl3', emoji:'🧕',  gender:'f', bg:'linear-gradient(135deg,#FB7185,#F43F5E)' },
  { id:'boy1',  emoji:'👨',  gender:'m', bg:'linear-gradient(135deg,#3B82F6,#1D4ED8)' },
  { id:'boy2',  emoji:'👦',  gender:'m', bg:'linear-gradient(135deg,#10B981,#059669)' },
  { id:'boy3',  emoji:'🧔',  gender:'m', bg:'linear-gradient(135deg,#F59E0B,#D97706)' },
];

export function getAvatar(id){
  return ANON_AVATARS.find(function(a){ return a.id === id; }) || ANON_AVATARS[0];
}

/* Object form keyed by id — App.js used to keep its own copy of this. */
export var ANON_AVATAR_LOOKUP = ANON_AVATARS.reduce(function(acc, a){
  acc[a.id] = { emoji: a.emoji, bg: a.bg, gender: a.gender };
  return acc;
}, {});
