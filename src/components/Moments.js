/* eslint-disable */
import React, {useState, useEffect, useRef} from 'react';
import {sb} from '../utils/supabase';
import {createPortal} from 'react-dom';

// ── Mock moment slides used when no real data is wired up ─────────────────
// Each "expert" gets a deterministic set of 3–4 gradient cards with captions
// — chosen by hashing their id so the same person always sees the same set.
var SAMPLE_SETS = [
  [
    { id:'s0-1', bg:'linear-gradient(135deg,#FF6B6B,#FFE66D)', text:'Available for calls today 🎯' },
    { id:'s0-2', bg:'linear-gradient(135deg,#4ECDC4,#45B7D1)', text:'Just wrapped a great session — thanks for the trust 💜' },
    { id:'s0-3', bg:'linear-gradient(135deg,#7B6EFF,#E84D9A)', text:'Tip of the day: small consistent steps win.' },
  ],
  [
    { id:'s1-1', bg:'linear-gradient(135deg,#A8E063,#56AB2F)', text:'Online now — let\'s talk 📞' },
    { id:'s1-2', bg:'linear-gradient(135deg,#F093FB,#F5576C)', text:'New article dropping this week' },
    { id:'s1-3', bg:'linear-gradient(135deg,#4FACFE,#00F2FE)', text:'Q&A this Friday at 7pm' },
    { id:'s1-4', bg:'linear-gradient(135deg,#FA709A,#FEE140)', text:'Sunset coffee thoughts ☕' },
  ],
  [
    { id:'s2-1', bg:'linear-gradient(135deg,#667EEA,#764BA2)', text:'3 callers helped today, 2 slots left ✨' },
    { id:'s2-2', bg:'linear-gradient(135deg,#F7971E,#FFD200)', text:'New skill unlocked. Ask me about it.' },
    { id:'s2-3', bg:'linear-gradient(135deg,#11998E,#38EF7D)', text:'Grateful for this community 🌱' },
  ],
  [
    { id:'s3-1', bg:'linear-gradient(135deg,#FC466B,#3F5EFB)', text:'Behind the scenes today' },
    { id:'s3-2', bg:'linear-gradient(135deg,#FDBB2D,#22C1C3)', text:'New session times posted on my profile' },
    { id:'s3-3', bg:'linear-gradient(135deg,#EE0979,#FF6A00)', text:'Hot take 🔥 simple > clever' },
    { id:'s3-4', bg:'linear-gradient(135deg,#00C9FF,#92FE9D)', text:'Tap the Call button — let\'s connect' },
  ],
];

function setForId(id){
  if (id == null) return SAMPLE_SETS[0];
  var s = String(id);
  var n = 0;
  for (var i = 0; i < s.length; i++) n = (n + s.charCodeAt(i)) | 0;
  return SAMPLE_SETS[Math.abs(n) % SAMPLE_SETS.length];
}

// ── MomentViewer — full-screen Insta-style story player ───────────────────
function MomentViewer(props){
  var user = props.user || {};
  var slides = props.slides || [];
  var moment = props.moment || {};
  var onClose = props.onClose;
  var onLike = props.onLike;
  var onReply = props.onReply;
  var myUserId = props.myUserId || null;       // T2.5
  var isOwn = !!props.isOwn;                    // T2.5
  var idxS = useState(0);
  var idx = idxS[0]; var setIdx = idxS[1];
  var timerRef = useRef(null);
  var SLIDE_MS = 4500;
  // T2.5 — moment_views integration. As viewer changes slides, upsert
  // a view row. If isOwn, fetch + display the viewer count for this slide.
  var viewCountS = useState(0);
  var viewCount = viewCountS[0]; var setViewCount = viewCountS[1];
  var viewerListS = useState([]);
  var viewerList = viewerListS[0]; var setViewerList = viewerListS[1];
  var showViewersS = useState(false);
  var showViewers = showViewersS[0]; var setShowViewers = showViewersS[1];

  // Reply state
  var replyTextS = useState('');
  var replyText = replyTextS[0]; var setReplyText = replyTextS[1];
  var pausedS = useState(false);
  var paused = pausedS[0]; var setPaused = pausedS[1];
  // Instagram-style press-and-hold-to-pause. Separate from `paused` (which
  // is for reply composer focus) so they OR together cleanly without
  // accidentally resuming when the input is still focused.
  var holdPausedS = useState(false);
  var holdPaused = holdPausedS[0]; var setHoldPaused = holdPausedS[1];
  var sentToastS = useState('');
  var sentToast = sentToastS[0]; var setSentToast = sentToastS[1];
  // Owner-only 3-dot menu (Delete moment, Save to phone, Copy link).
  var ownMenuS = useState(false);
  var ownMenu = ownMenuS[0]; var setOwnMenu = ownMenuS[1];
  // viewer_id → profile {id, full_name, avatar_url}. Hydrated when the
  // owner opens the "Seen by N" sheet so we render real names + avatars
  // instead of raw UUIDs.
  var viewerProfilesS = useState({});
  var viewerProfiles = viewerProfilesS[0]; var setViewerProfiles = viewerProfilesS[1];
  // Refs for the press-and-hold gesture. A 220ms long-press timer flips
  // holdPaused→true; movement past the slop cancels it and starts a drag.
  var pressTimerRef = useRef(null);
  var gestureRef = useRef(null);

  // Direct-DOM refs for live drag. The viewer used to re-render on every
  // pointermove via setState, which on mid-range Android pushed render
  // budget into 16ms per frame just for React reconciliation of a 600-line
  // component. Now we write transforms straight to the slide elements,
  // so the only thing that has to happen per-frame is a single style
  // assignment + a GPU composite. No virtual DOM diff, no reflow.
  var mainOverlayRef = useRef(null);
  var prevGhostRef = useRef(null);
  var nextGhostRef = useRef(null);
  var backdropRef = useRef(null);
  // ONE ref drives the whole cube — we only write a single transform per
  // pointer move (the cube's rotation), not three. Faces are children of
  // this cube and ride along rigidly. This is the true Instagram cube,
  // not the "two independent flaps" model I had before.
  var cubeRef = useRef(null);
  // rAF handle so we coalesce multiple pointermove events fired in the
  // same frame into a single transform write.
  var rafRef = useRef(0);

  // Rubber-band damping distance — how far past an edge the slide can
  // travel before clamping. 70px feels resistive without drifting.
  var RUBBER_BAND_MAX = 70;

  // Like state per slide. Persisted in localStorage keyed by
  // momentId-slideId, so reopening shows the same heart fill state.
  function likesKey(){ try{ return 'ringin_moment_likes'; }catch(_){ return 'ringin_moment_likes'; } }
  function likedSet(){
    try{ var raw = localStorage.getItem(likesKey()); return raw ? JSON.parse(raw) : {}; }catch(_){ return {}; }
  }
  function isLikedFor(slideId){
    var k = (moment.id != null ? moment.id : 'na') + ':' + slideId;
    var s = likedSet();
    return !!s[k];
  }
  function setLikedFor(slideId, val){
    var k = (moment.id != null ? moment.id : 'na') + ':' + slideId;
    var s = likedSet();
    if(val) s[k] = true; else delete s[k];
    try{ localStorage.setItem(likesKey(), JSON.stringify(s)); }catch(_){}
  }
  var likedNowS = useState(false);
  var likedNow = likedNowS[0]; var setLikedNow = likedNowS[1];
  // Once the user interacts with a slide (like or reply), auto-advance
  // stops and the viewer "stays still" — only an explicit tap moves on.
  // Reset back to false when the user manually navigates to a different
  // slide, so each new slide gets its own dwell timer until interacted with.
  var interactedS = useState(false);
  var interacted = interactedS[0]; var setInteracted = interactedS[1];

  // T2.5 — record a view + (if own moment) fetch view count + viewer list
  // each time the visible slide changes. UPSERT on (moment_id, viewer_id)
  // so viewing twice doesn't insert twice. Graceful fallback if migration
  // 0007_moment_views.sql isn't applied.
  useEffect(function(){
    var cur = slides[idx]; if (!cur || !cur.id) return;
    // Only track real moment slides (the Supabase ones), not the deterministic
    // demo slides (their ids look like 's0-1', 's1-2' etc. — short).
    var looksLikeRealId = typeof cur.id === 'string' && cur.id.length > 12;
    if (!looksLikeRealId || !myUserId) { setViewCount(0); setViewerList([]); return; }
    // Don't record self-views.
    if (!isOwn) {
      try {
        sb.from('moment_views').upsert(
          [{ moment_id: cur.id, viewer_id: myUserId, viewed_at: new Date().toISOString() }],
          { onConflict: 'moment_id,viewer_id' }
        ).then(function(){});
      } catch(_) {}
    } else {
      // Owner — fetch viewers for this slide.
      try {
        sb.from('moment_views').select('viewer_id, viewed_at').eq('moment_id', cur.id).order('viewed_at', { ascending: false }).limit(50).then(function(r){
          if (r.error || !r.data) { setViewCount(0); setViewerList([]); return; }
          setViewCount(r.data.length);
          setViewerList(r.data);
        });
      } catch(_) { setViewCount(0); setViewerList([]); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slides.length]);
  useEffect(function(){
    var cur = slides[idx]; if(!cur) return;
    setLikedNow(isLikedFor(cur.id));
    setInteracted(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slides.length]);

  // Auto-advance — pauses while the user is composing a reply, while they
  // are press-and-holding the slide (Insta-style), and STOPS entirely once
  // they've liked or replied to this slide.
  useEffect(function(){
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (paused || holdPaused || interacted) return;
    timerRef.current = setTimeout(function(){
      if (idx < slides.length - 1) setIdx(idx + 1);
      else if (onClose) onClose();
    }, SLIDE_MS);
    return function(){ if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slides.length, paused, holdPaused, interacted]);

  // Hydrate viewer profile names + avatars when the owner opens the
  // "Seen by N" sheet. JOINs moment_views.viewer_id → profiles.id. Without
  // this we'd render raw truncated UUIDs — useless to the owner.
  useEffect(function(){
    if (!isOwn || !viewerList || viewerList.length === 0) return;
    var ids = viewerList.map(function(v){ return v.viewer_id; }).filter(Boolean);
    // Skip ids we've already cached this session.
    var unknown = ids.filter(function(id){ return !viewerProfiles[id]; });
    if (!unknown.length) return;
    try {
      sb.from('profiles').select('id, full_name, avatar_url').in('id', unknown).then(function(r){
        if (r.error || !r.data) return;
        setViewerProfiles(function(prev){
          var next = Object.assign({}, prev);
          r.data.forEach(function(p){ next[p.id] = p; });
          return next;
        });
      });
    } catch(_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerList, isOwn]);

  // Helper — render "2h" / "3m" / "now" relative to slide.createdAt.
  function relativeTime(iso){
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var diff = Math.max(0, Date.now() - t);
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + 'm';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h';
    var d = Math.floor(hr / 24);
    return d + 'd';
  }

  // Send a quick emoji reaction — same payload shape as a text reply, but
  // bypasses the composer so it's a single-tap interaction (matches the
  // Instagram quick-reactions row).
  function sendQuickReaction(emoji){
    var cur = slides[idx]; if (!cur) return;
    if (typeof onReply === 'function') {
      try { onReply(moment, cur, emoji); } catch(_){}
    }
    setInteracted(true);
    showToast(emoji + ' sent');
  }

  // Owner-only delete (matches Instagram's "Delete" option on own stories).
  function deleteOwnMoment(){
    setOwnMenu(false);
    var cur = slides[idx]; if (!cur) return;
    var ok = true;
    try { ok = window.confirm('Delete this moment? It will disappear for everyone.'); } catch(_){}
    if (!ok) return;
    try {
      sb.from('moments').delete().eq('id', cur.id).then(function(){
        showToast('Deleted');
        // Close the viewer — parent will re-fetch the list on next mount.
        setTimeout(function(){ if (onClose) onClose(); }, 600);
      });
    } catch(_){}
  }

  // Tap zones (Instagram pattern):
  //   left 33%  → previous slide; if first slide, jump to previous user
  //   right 67% → next slide;    if last slide,  jump to next user
  // Tapping NEVER closes the viewer — only the × button or a vertical
  // swipe-down can dismiss. (This is what fixes the "center tap exits and
  // bleeds through to whatever was behind" bug — there's no exit path
  // through center anymore.)
  function handleTap(e){
    try{
      var rect = e.currentTarget.getBoundingClientRect();
      var x = (e.clientX != null ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0)) - rect.left;
      var w = rect.width;
      if (x < w * 0.33){
        if (idx > 0) { setIdx(idx - 1); }
        else if (typeof props.onNextUser === 'function') { props.onNextUser(-1); }
        // If no previous user either, do nothing — viewer stays on
        // the first slide (no accidental close).
      } else {
        if (idx < slides.length - 1) { setIdx(idx + 1); }
        else if (typeof props.onNextUser === 'function') { props.onNextUser(1); }
        // If no next user (we're on the last slide of the last user),
        // do nothing. User must explicitly tap × to close.
      }
    }catch(_){}
  }

  function showToast(text){
    setSentToast(text);
    setTimeout(function(){ setSentToast(''); }, 1400);
  }

  function toggleLike(e){
    if(e && e.stopPropagation) e.stopPropagation();
    var cur = slides[idx]; if(!cur) return;
    var nowLiked = !likedNow;
    setLikedFor(cur.id, nowLiked);
    setLikedNow(nowLiked);
    // Liking pins the slide — viewer stays still and auto-advance halts.
    setInteracted(true);
    // Only drop a chat message on the transition from unliked → liked, so
    // toggling on/off doesn't spam the recipient's chat.
    if(nowLiked && typeof onLike === 'function'){
      try{ onLike(moment, cur); }catch(_){}
      showToast('Liked ❤️');
    }
  }

  function sendReply(e){
    if(e && e.stopPropagation) e.stopPropagation();
    var t = (replyText || '').trim();
    if(!t) return;
    var cur = slides[idx]; if(!cur) return;
    if(typeof onReply === 'function'){
      try{ onReply(moment, cur, t); }catch(_){}
    }
    setReplyText('');
    setPaused(false);
    // Pin the slide after sending — don't auto-advance, don't auto-close.
    // The user taps to move on when they're ready.
    setInteracted(true);
    showToast('Sent ✓');
  }

  if (!slides.length) return null;
  var cur = slides[idx];
  // Image moment vs gradient/text moment — real user-posted moments carry
  // an imageUrl and (optional) caption; mock expert moments use cur.bg + cur.text.
  var hasImage = !!cur.imageUrl;
  var captionText = cur.caption != null ? cur.caption : (cur.text || '');

  // Portal to document.body — a `position:fixed` element inside .moments-strip
  // gets trapped by the .app-container / .screen-content stacking context on
  // some browsers (iOS Safari especially), which renders the viewer at the
  // strip's bounds instead of the full viewport. Portalling sidesteps all of
  // that by mounting the overlay at document.body.
  // Returns true if a pointer event originated from an interactive child
  // (button / input / link). We use this to skip the press-and-hold gesture
  // when the user is actually tapping the composer, like button, 3-dot
  // menu, header avatar, etc. — only the bare slide area should pause/nav.
  function isInteractive(e){
    try {
      var el = e && e.target;
      var stop = e && e.currentTarget;
      while (el && el !== stop) {
        var tag = el.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'A' || tag === 'IMG') return true;
        if (el.getAttribute && el.getAttribute('data-moment-skip-press') === '1') return true;
        el = el.parentNode;
      }
    } catch(_){}
    return false;
  }

  // Viewport size (read each render — pretty cheap).
  var VW = typeof window !== 'undefined' ? window.innerWidth : 360;
  var VH = typeof window !== 'undefined' ? window.innerHeight : 640;

  // Adjacent moments — peeks rendered as siblings of the current overlay.
  var prevMoment = (typeof props.getAdjacent === 'function') ? props.getAdjacent(-1) : null;
  var nextMoment = (typeof props.getAdjacent === 'function') ? props.getAdjacent(1) : null;

  // Rubber-band f(x) = max * (1 - 1/(1 + x/max)) — soft resistance.
  function rubberBand(over){
    var sign = over < 0 ? -1 : 1;
    var v = Math.abs(over);
    return sign * (RUBBER_BAND_MAX * (1 - 1 / (1 + v / RUBBER_BAND_MAX)));
  }

  // TRUE RIGID 3D CUBE (Instagram Stories pattern).
  //
  // The cube has three faces (prev / current / next) positioned on its
  // surfaces — each pre-rotated and pushed out from the cube center by
  // translateZ(half-face-width). At rest, only the current face is in
  // front of the camera; prev and next are perpendicular, edge-on, and
  // invisible.
  //
  // Dragging rotates the ENTIRE CUBE around its central vertical axis.
  // Faces ride along rigidly. As the cube turns, the previously-visible
  // face swings off to the side while the adjacent face swings into
  // view, meeting at the shared edge — that's the seam the user sees
  // moving across the screen.
  //
  // Math:
  //   ratio = dx / VW   (-1 fully swiped to next, +1 fully swiped to prev)
  //   cube rotation = -ratio * 90deg  (swipe-left → cube turns counter-clockwise)
  //
  // Plus a subtle scale-down at midpoint (1.0 → 0.96 → 1.0) so the cube
  // appears to recede slightly during rotation — the polish the other
  // AI flagged ("scale down during middle of swipe to prevent corners
  // from looking distorted").
  //
  // halfDepth: cube faces sit at translateZ(halfDepth). To keep the
  // current face at the viewport plane (no perspective magnification at
  // rest), we also pull the cube back by translateZ(-halfDepth). Net Z
  // of current face at rest = 0.
  function buildCubeTransform(dx, dy){
    // Vertical dismiss only applies to the cube as a whole — drags the
    // whole stack downward with a scale fade.
    if (dy > 0) {
      var dismissScale = 1 - 0.10 * Math.min(1, dy / (VH * 0.6));
      return 'translate3d(0,' + dy + 'px,0) scale(' + dismissScale + ')';
    }
    var ratio = Math.max(-1, Math.min(1, dx / VW));
    // CSS rotateY direction:
    //   Right face (next) is at +X, normal +X. To bring it into view from
    //   the front the cube must rotate NEGATIVELY around Y (right face
    //   swings toward viewer). So when swiping right-to-left (dx<0) we
    //   want NEGATIVE rotation. Sign was inverted before — that's why
    //   the user saw "swipe left goes to previous" — wrong face peeked in.
    var rot = ratio * 90;  // dx<0 → rot<0 → next face comes forward
    // Subtle recede + zoom-out at midpoint (Insta polish).
    var midDist = Math.abs(ratio);
    var scale = 1 - 0.04 * midDist;
    var halfDepth = Math.round(VW / 2);
    return 'translateZ(' + (-halfDepth) + 'px) rotateY(' + rot + 'deg) scale(' + scale + ')';
  }

  // Single write per frame — only the cube wrapper's transform changes.
  // Faces inside are positioned with rotateY+translateZ at mount time
  // and never need per-frame updates.
  function writeCubeTransform(dx, dy, kind){
    if (cubeRef.current) {
      cubeRef.current.style.transition = 'none';
      cubeRef.current.style.transform = buildCubeTransform(dx, dy);
    }
    if (backdropRef.current && kind === 'v') {
      backdropRef.current.style.transition = 'none';
      backdropRef.current.style.opacity = String(Math.max(0.25, 1 - dy / (VH * 0.6)));
    }
  }

  // Animate cube to a target pose with a CSS transition. GPU does the
  // work; React stays out of it.
  function animateCubeTo(targetDx, targetDy, kind, durationMs){
    var ease = 'transform ' + durationMs + 'ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    if (cubeRef.current) {
      cubeRef.current.style.transition = ease;
      cubeRef.current.style.transform = buildCubeTransform(targetDx, targetDy);
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = 'opacity ' + durationMs + 'ms ease-out';
      var op = 1;
      if (kind === 'v' && targetDy > 0) {
        op = Math.max(0, 1 - targetDy / (VH * 0.6));
      }
      backdropRef.current.style.opacity = String(op);
    }
  }

  // Compatibility shims — handler functions below still call writeTransforms
  // and animateTo by their old names.
  var writeTransforms = writeCubeTransform;
  var animateTo = animateCubeTo;

  // Tracks where the live drag is right now — separate from gestureRef
  // because pointerup needs to know the final dx/dy without reading the
  // DOM. Updated every pointermove via the rAF callback.
  var dragNowRef = useRef({ dx: 0, dy: 0, kind: null });

  var overlay = React.createElement('div', {
    ref: mainOverlayRef,
    // Pointer gesture handler — covers tap, press-hold, horizontal swipe
    // between users (live drag) and vertical swipe-to-dismiss (live drag).
    // All drag updates go DIRECTLY to the DOM via writeTransforms() — no
    // React re-render until release. That's what makes the drag actually
    // smooth instead of the laggy state-driven version the user flagged.
    onPointerDown: function(e){
      if (isInteractive(e)) return;
      // EDGE REJECTION — on Android phones with gesture navigation,
      // swipes that start within ~22px of the screen edge trigger the
      // SYSTEM BACK gesture (which closes the viewer via popstate).
      // Ignore those: let Android handle them. The user can still
      // swipe between users — they just need to start further inside.
      var startX = (e && e.clientX) || 0;
      var EDGE_REJECT = 22;
      if (startX < EDGE_REJECT || startX > (VW - EDGE_REJECT)) {
        return;  // do not capture, do not pause — system handles it
      }
      try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch(_){}
      gestureRef.current = {
        x: startX,
        y: (e && e.clientY) || 0,
        t: Date.now(),
        moved: false,
        kind: null,
      };
      dragNowRef.current = { dx: 0, dy: 0, kind: null };
      // INSTANT pause — touching the slide pauses immediately (Insta pattern).
      setHoldPaused(true);
    },
    onPointerMove: function(e){
      var g = gestureRef.current;
      if (!g) return;
      if (g.held) return;
      var cx = (e && e.clientX) || 0;
      var cy = (e && e.clientY) || 0;
      var rawDx = cx - g.x;
      var rawDy = cy - g.y;
      var absDx = Math.abs(rawDx);
      var absDy = Math.abs(rawDy);
      // Decide drag axis once movement crosses the slop threshold.
      if (!g.kind && (absDx > 10 || absDy > 10)) {
        try { clearTimeout(pressTimerRef.current); } catch(_){}
        if (absDx > absDy) g.kind = 'h';
        else if (rawDy > 0) g.kind = 'v';
        else return;  // ignore upward
        g.moved = true;
        setHoldPaused(true);
        // First frame in a drag — arm the GPU layer on the cube wrapper.
        if (cubeRef.current) cubeRef.current.style.willChange = 'transform';
      }
      if (!g.kind) return;
      // Apply rubber-band when swiping toward a non-existent neighbour.
      var dx = rawDx, dy = rawDy;
      if (g.kind === 'h') {
        if (dx < 0 && !nextMoment) dx = rubberBand(dx);
        else if (dx > 0 && !prevMoment) dx = rubberBand(dx);
        dy = 0;
      } else {
        dx = 0;
        dy = Math.max(0, dy);
      }
      dragNowRef.current = { dx: dx, dy: dy, kind: g.kind };
      // Coalesce multiple events fired in the same frame.
      if (rafRef.current) return;
      rafRef.current = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : function(cb){ return setTimeout(cb, 16); })(function(){
        rafRef.current = 0;
        var d = dragNowRef.current;
        if (!d) return;
        writeTransforms(d.dx, d.dy, d.kind);
      });
    },
    onPointerUp: function(e){
      if (isInteractive(e)) return;
      var g = gestureRef.current;
      gestureRef.current = null;
      // Cancel any pending rAF write so we control the final pose.
      if (rafRef.current) {
        try { cancelAnimationFrame(rafRef.current); } catch(_){}
        rafRef.current = 0;
      }
      if (!g) return;
      var d = dragNowRef.current || { dx: 0, dy: 0, kind: null };
      dragNowRef.current = null;
      // If the user moved (drag), handle below. If they DIDN'T move:
      //   - short touch (<300ms): treat as a tap → resume + advance
      //   - long touch (held >300ms): pure pause-and-release → just resume
      // setHoldPaused(false) is called at the end of each branch.
      if (!g.kind) {
        var heldFor = Date.now() - (g.t || 0);
        if (heldFor < 300) {
          // Was a tap → resume and run handleTap (advance based on zone).
          setHoldPaused(false);
          handleTap(e);
          return;
        }
        // Was a hold-release — just resume, no advance.
        setHoldPaused(false);
        return;
      }
      // Horizontal drag — commit or snap back.
      if (g.kind === 'h') {
        var commitThreshold = VW * 0.22;
        var canCommit = (d.dx < 0 && nextMoment) || (d.dx > 0 && prevMoment);
        if (Math.abs(d.dx) > commitThreshold && canCommit) {
          var direction = d.dx < 0 ? 1 : -1;
          // Animate ALL THREE slides to the commit position (the strip
          // slides by exactly one screen width); then ask parent to
          // mount the next user.
          animateTo(direction > 0 ? -VW : VW, 0, 'h', 260);
          setHoldPaused(false);
          setTimeout(function(){
            try { props.onNextUser(direction); } catch(_){}
          }, 260);
          return;
        }
        // Snap back — animate to neutral.
        animateTo(0, 0, 'h', 240);
        setHoldPaused(false);
        return;
      }
      if (g.kind === 'v') {
        var commitDownThreshold = VH * 0.18;
        if (d.dy > commitDownThreshold) {
          animateTo(0, VH, 'v', 240);
          setHoldPaused(false);
          setTimeout(function(){ try { if (onClose) onClose(); } catch(_){} }, 230);
          return;
        }
        animateTo(0, 0, 'v', 220);
        setHoldPaused(false);
        return;
      }
    },
    onPointerCancel: function(){
      if (rafRef.current) { try { cancelAnimationFrame(rafRef.current); } catch(_){} rafRef.current = 0; }
      gestureRef.current = null;
      dragNowRef.current = null;
      setHoldPaused(false);
      animateTo(0, 0, 'h', 200);
    },
    onPointerLeave: function(){
      // Drag finger off the screen → release pause.
      setHoldPaused(false);
    },
    // Block parent's swipe-back and scroll while the viewer is open.
    onTouchStart: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    onTouchMove: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    style: {
      // ABSOLUTE inside the perspective cube stage (which is itself fixed
      // and full-viewport). Was 'fixed' when the overlay lived standalone
      // at document.body; now that it's a cube face it must be absolute
      // so it inherits the parent's 3D context.
      position:'absolute',
      top:0, left:0,
      width:'100%', height:'100%',
      background: hasImage ? '#000' : cur.bg,
      color:'#fff',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'24px',
      userSelect:'none', WebkitUserSelect:'none',
      WebkitTouchCallout:'none',
      WebkitTapHighlightColor:'transparent',
      touchAction:'none',
      cursor:'pointer',
      overflow:'hidden',
      pointerEvents: 'auto',  // parent cube stage has pointer-events:none
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      // Current face sits on the cube's front surface. The cube wrapper
      // translates back by halfDepth so this face ends up at viewport
      // z=0 (no perspective magnification at rest).
      transform: 'translateZ(' + Math.round(VW / 2) + 'px)',
      transformOrigin: 'center center',
    }
  },
    // Image layer (real moments) — rendered as a CSS background-image div
    // instead of an <img> tag. Browsers (Chrome on Android especially)
    // draw a blue selection rectangle when long-pressing an <img>, even
    // with pointer-events:none and user-select:none. Background-images
    // are immune to that — no selection UI, no save-image context menu,
    // no drag-to-save preview. Fully transparent to the user's gestures.
    hasImage ? React.createElement('div', {
      'aria-label': 'moment image',
      style:{
        position:'absolute',
        top:0, left:0, width:'100%', height:'100%',
        backgroundImage: 'url("' + cur.imageUrl + '")',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000',
        zIndex:0,
        pointerEvents:'none',
        userSelect:'none',
        WebkitUserSelect:'none',
        WebkitTouchCallout:'none',
        WebkitTapHighlightColor:'transparent',
      }
    }) : null,
    // Progress bars
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(10px + env(safe-area-inset-top, 0px))',
        left:8, right:8,
        display:'flex', gap:'4px',
        zIndex:2,
      }
    },
      slides.map(function(s, i){
        return React.createElement('div', { key:s.id, style:{flex:1,height:'3px',background:'rgba(255,255,255,0.3)',borderRadius:'2px',overflow:'hidden'} },
          React.createElement('div', {
            style:{
              height:'100%', background:'#fff',
              width: i < idx ? '100%' : (i === idx ? '0%' : '0%'),
              animation: i === idx ? 'momentBarFill ' + SLIDE_MS + 'ms linear forwards' : 'none',
              // Freeze the bar mid-fill when the user is composing a reply,
              // press-holding the slide (Insta-style), or has just liked /
              // replied — matches the timer behaviour above.
              animationPlayState: (i === idx && (paused || holdPaused || interacted)) ? 'paused' : 'running',
            }
          })
        );
      })
    ),
    // Header — avatar + name are tappable to open the expert's profile
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(24px + env(safe-area-inset-top, 0px))',
        left:'14px', right:'14px',
        display:'flex', alignItems:'center', gap:'10px',
        zIndex:2,
      }
    },
      React.createElement('div', {
        onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); if(props.onViewProfile) props.onViewProfile(props.moment); },
        style:{display:'flex', alignItems:'center', gap:'10px', flex:1, cursor:'pointer', minWidth:0},
      },
        user.avatar ? React.createElement('img', {
          src: user.avatar, alt:'',
          style:{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',border:'1.5px solid rgba(255,255,255,0.5)',flexShrink:0}
        }) : React.createElement('div', {
          style:{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,flexShrink:0}
        }, (user.name||'?').charAt(0).toUpperCase()),
        React.createElement('div', {style:{display:'flex',alignItems:'baseline',gap:'7px',minWidth:0,overflow:'hidden'}},
          React.createElement('div', {style:{fontSize:'14px',fontWeight:700,textShadow:'0 1px 4px rgba(0,0,0,0.3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, user.name || ''),
          // Story timestamp ("2h", "now") — Instagram pattern, sits next to name.
          React.createElement('div', {style:{fontSize:'12px',color:'rgba(255,255,255,0.75)',fontWeight:500,textShadow:'0 1px 3px rgba(0,0,0,0.3)',flexShrink:0}}, relativeTime(cur.createdAt))
        )
      ),
      // (T2.5 "👁 N" badge moved out of the header — it now lives in the
      // bottom row, left of the reply composer, per user feedback.)
      // 3-dot menu for own moments — Delete / Save / Copy link (Insta-style).
      isOwn ? React.createElement('button', {
        onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); setOwnMenu(true); },
        className:'ringin-tap',
        style:{background:'transparent',border:'none',color:'#fff',fontSize:'22px',lineHeight:1,cursor:'pointer',padding:'4px 8px',fontWeight:700,flexShrink:0}
      }, '⋯') : null,
      React.createElement('button', {
        onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); if(onClose) onClose(); },
        className:'ringin-tap',
        style:{background:'transparent',border:'none',color:'#fff',fontSize:'26px',lineHeight:1,cursor:'pointer',padding:'4px 6px',fontWeight:300,flexShrink:0}
      }, '×')
    ),
    // Caption — image slides get a small blur card above the composer,
    // text-only slides get big centered text. Both use a position:absolute
    // wrapper that fills the face + flex-centers the caption inside.
    // This pattern is rock-solid under 3D-transformed parents (cube swipe)
    // where the previous flex/transform-translateY approaches silently
    // dropped the caption from the render.
    captionText ? (hasImage ? React.createElement('div', {
      // Image caption: wrapper anchored to BOTTOM of the face. Inner
      // blur-card is in normal flow inside the wrapper.
      style:{
        position:'absolute',
        left:'14px', right:'14px',
        bottom:'calc(74px + env(safe-area-inset-bottom, 0px))',
        zIndex:2,
        pointerEvents:'none',
      }
    },
      React.createElement('div', {
        style:{
          background:'rgba(0,0,0,0.42)',
          backdropFilter:'blur(4px)',
          WebkitBackdropFilter:'blur(4px)',
          borderRadius:'14px',
          padding:'10px 14px',
          fontSize:'14px',
          fontWeight:600,
          lineHeight:1.35,
          textAlign:'center',
          color:'#fff',
          textShadow:'0 1px 6px rgba(0,0,0,0.4)',
        }
      }, captionText)
    ) : React.createElement('div', {
      // Text caption: wrapper FILLS the face (inset:0), flex-centers
      // the inner text block. No transform on the inner element so
      // 3D-transformed ancestors don't break it.
      style:{
        position:'absolute',
        top:0, right:0, bottom:0, left:0,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:'24px',
        zIndex:1,
        pointerEvents:'none',
      }
    },
      React.createElement('div', {
        style:{
          fontSize:'26px', fontWeight:800, lineHeight:1.3,
          textAlign:'center', maxWidth:'82%',
          color:'#fff',
          textShadow:'0 2px 16px rgba(0,0,0,0.35)',
          fontFamily:'Syne, DM Sans, sans-serif',
        }
      }, captionText)
    )) : null,
    // ── Reply composer + actions row (bottom) ─────────────────────────────
    // Sits above the home-indicator safe area. Tapping anywhere here MUST
    // NOT trigger the tap-navigate handler on the parent, so every event
    // is stopPropagation'd. Pauses the auto-advance while focused.
    //
    // Layout (no text typed):
    //   [👁 N (own only)]  [reply input ___]  [♡ Like]  [↗ Share]
    // Layout (typing):
    //   [reply input typing...]  [Send]
    React.createElement('div', {
      onClick: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      onPointerDown: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      onPointerUp: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      style:{
        position:'absolute',
        left:'14px', right:'14px',
        // 10px above the safe-area inset puts the composer right above the
        // home-indicator blank zone — like Instagram.
        bottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
        display:'flex', alignItems:'center', gap:'8px',
        zIndex:3,
      }
    },
      // Eye / Seen-by-N button (own moments only, left of input).
      // ALWAYS visible — even with 0 views — opens the viewer sheet which
      // shows "No one has viewed this yet" with a friendly empty state.
      (isOwn && !(replyText && replyText.trim())) ? React.createElement('button', {
        onClick:function(e){ if(e&&e.stopPropagation) e.stopPropagation(); setShowViewers(true); },
        className:'ringin-tap',
        title:'See who viewed',
        style:{
          display:'inline-flex', alignItems:'center', gap:'4px',
          background:'rgba(0,0,0,0.4)',
          border:'1px solid rgba(255,255,255,0.32)',
          borderRadius:'22px',
          padding:'9px 12px',
          color:'#fff',
          fontSize:'13px', fontWeight:600,
          cursor:'pointer', flexShrink:0,
          fontFamily:'inherit',
          minHeight:'44px',
        }
      }, '👁 ', viewCount) : null,
      React.createElement('input', {
        type:'text',
        value: replyText,
        placeholder: 'Reply to '+ (user.name ? user.name.split(' ')[0] : 'this moment') + '…',
        onFocus: function(){ setPaused(true); },
        onBlur: function(){ setPaused(false); },
        onChange: function(e){ setReplyText(e.target.value); },
        onKeyDown: function(e){ if(e.key === 'Enter'){ sendReply(e); } },
        style:{
          flex:1,
          background:'rgba(0,0,0,0.32)',
          border:'1px solid rgba(255,255,255,0.35)',
          borderRadius:'24px',
          padding:'11px 15px',
          fontSize:'15.4px',
          color:'#fff',
          outline:'none',
          fontFamily:'DM Sans, sans-serif',
          WebkitAppearance:'none',
          minWidth:0,
        }
      }),
      (replyText && replyText.trim()) ? React.createElement('button', {
        onClick: sendReply,
        className:'ringin-tap',
        style:{
          background:'#fff', border:'none',
          color:'#222', fontWeight:700,
          fontSize:'14.3px',
          padding:'10px 15px',
          borderRadius:'24px',
          cursor:'pointer', flexShrink:0,
        }
      }, 'Send') : [
        // Heart / Like button.
        React.createElement('button', {
          key:'like',
          onClick: toggleLike,
          className:'ringin-tap',
          title: likedNow ? 'Unlike' : 'Like',
          style:{
            background:'rgba(0,0,0,0.32)',
            border:'1px solid rgba(255,255,255,0.35)',
            color:'#fff',
            width:'44px', height:'44px',
            borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'22px', lineHeight:1,
            cursor:'pointer', flexShrink:0,
          }
        }, likedNow ? '❤️' : '🤍'),
        // Share button (right of heart). Uses the Web Share API where
        // available (native Android share sheet, iOS PWA share sheet);
        // falls back to copying a link to the clipboard.
        React.createElement('button', {
          key:'share',
          onClick: function(e){
            if (e && e.stopPropagation) e.stopPropagation();
            var cur4 = slides[idx]; if (!cur4) return;
            var link = 'https://ring-in.vercel.app/?moment=' + encodeURIComponent(cur4.id);
            var shareData = { title: 'Moment on RingIn', text: captionText || 'Check this moment on RingIn', url: link };
            try {
              if (navigator.share) {
                navigator.share(shareData).then(function(){ showToast('Shared'); }).catch(function(){});
              } else {
                try { navigator.clipboard.writeText(link); } catch(_){}
                showToast('Link copied');
              }
            } catch(_) {
              try { navigator.clipboard.writeText(link); } catch(_){}
              showToast('Link copied');
            }
          },
          className:'ringin-tap',
          title:'Share',
          style:{
            background:'rgba(0,0,0,0.32)',
            border:'1px solid rgba(255,255,255,0.35)',
            color:'#fff',
            width:'44px', height:'44px',
            borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'19px', lineHeight:1,
            cursor:'pointer', flexShrink:0,
          }
        },
          // ↗ paper-plane glyph (Insta-style)
          React.createElement('svg', {viewBox:'0 0 24 24', width:'19', height:'19', fill:'none', stroke:'#fff', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round'},
            React.createElement('line', {x1:22, y1:2, x2:11, y2:13}),
            React.createElement('polygon', {points:'22 2 15 22 11 13 2 9 22 2'})
          )
        )
      ]
    ),
    // Brief "Sent ✓" / "Liked ❤️" toast — auto-hides after ~1.4s
    sentToast ? React.createElement('div', {
      style:{
        position:'absolute',
        bottom:'calc(74px + env(safe-area-inset-bottom, 0px))',
        left:'50%', transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.55)',
        color:'#fff',
        padding:'7px 14px',
        borderRadius:'20px',
        fontSize:'12px', fontWeight:600,
        zIndex:4,
        pointerEvents:'none',
      }
    }, sentToast) : null,
    // (Quick-emoji-reactions row removed per user feedback — the bottom
    // composer now has just the Eye/Reply/Like/Share row, matching the
    // requested Instagram-like layout.)
    // Owner-only 3-dot menu. Slides up from bottom with Delete / Save options.
    ownMenu ? React.createElement('div', {
      onClick: function(){ setOwnMenu(false); },
      onPointerDown: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      onPointerUp: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      style:{position:'absolute', inset:0, zIndex:11, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', justifyContent:'center'}
    },
      React.createElement('div', {
        onClick: function(e){ e.stopPropagation(); },
        style:{background:'#0c0c12', borderTopLeftRadius:'18px', borderTopRightRadius:'18px', width:'100%', maxWidth:'460px', color:'#fff', padding:'8px 0 calc(20px + env(safe-area-inset-bottom, 0px))', display:'flex', flexDirection:'column', boxShadow:'0 -8px 30px rgba(0,0,0,0.5)'}
      },
        React.createElement('div', {style:{width:'40px', height:'4px', background:'rgba(255,255,255,0.25)', borderRadius:'2px', margin:'4px auto 12px'}}),
        React.createElement('button', {
          onClick: deleteOwnMoment,
          style:{background:'none', border:'none', color:'#FF5C7A', fontSize:'15px', fontWeight:600, padding:'14px 18px', textAlign:'left', cursor:'pointer', fontFamily:'inherit'}
        }, '🗑  Delete moment'),
        React.createElement('button', {
          onClick: function(){
            setOwnMenu(false);
            var cur2 = slides[idx];
            if (cur2 && cur2.imageUrl) {
              try { window.open(cur2.imageUrl, '_blank'); } catch(_){}
              showToast('Opening image…');
            }
          },
          style:{background:'none', border:'none', color:'#fff', fontSize:'15px', fontWeight:500, padding:'14px 18px', textAlign:'left', cursor:'pointer', fontFamily:'inherit'}
        }, '💾  Save / open image'),
        React.createElement('button', {
          onClick: function(){
            setOwnMenu(false);
            var cur3 = slides[idx];
            if (cur3) {
              var link = 'https://ring-in.vercel.app/?moment=' + encodeURIComponent(cur3.id);
              try { navigator.clipboard.writeText(link); } catch(_){}
              showToast('Link copied');
            }
          },
          style:{background:'none', border:'none', color:'#fff', fontSize:'15px', fontWeight:500, padding:'14px 18px', textAlign:'left', cursor:'pointer', fontFamily:'inherit'}
        }, '🔗  Copy link'),
        React.createElement('button', {
          onClick: function(){ setOwnMenu(false); },
          style:{background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'14px', fontWeight:500, padding:'14px 18px', textAlign:'center', cursor:'pointer', fontFamily:'inherit', borderTop:'1px solid rgba(255,255,255,0.08)', marginTop:'6px'}
        }, 'Cancel')
      )
    ) : null,
    // T2.5 — viewer list popup. Owner-only, opened by tapping "👁 N" badge.
    // Now shows the viewer's actual name + avatar (hydrated from profiles
    // table) and has a friendly empty state when no one has viewed yet.
    showViewers ? React.createElement('div',{
      onClick:function(){ setShowViewers(false); },
      onPointerDown: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      onPointerUp: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
      style:{position:'absolute',inset:0,zIndex:10,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}
    },
      React.createElement('div',{
        onClick:function(e){ e.stopPropagation(); },
        style:{background:'#0c0c12',borderTopLeftRadius:'18px',borderTopRightRadius:'18px',width:'100%',maxWidth:'460px',maxHeight:'72%',display:'flex',flexDirection:'column',color:'#fff',padding:'14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',boxShadow:'0 -8px 30px rgba(0,0,0,0.5)'}
      },
        React.createElement('div', {style:{width:'40px', height:'4px', background:'rgba(255,255,255,0.25)', borderRadius:'2px', margin:'0 auto 10px'}}),
        React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}},
          React.createElement('div',{style:{fontSize:'15px',fontWeight:700}}, viewerList.length === 0 ? 'Views' : ('Seen by ' + viewerList.length)),
          React.createElement('button',{onClick:function(){ setShowViewers(false); },style:{background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:'22px',cursor:'pointer',fontFamily:'inherit',padding:'0 4px'}},'×')
        ),
        viewerList.length === 0
          ? React.createElement('div',{style:{textAlign:'center',padding:'30px 16px 18px',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}},
              React.createElement('div',{style:{width:'56px',height:'56px',borderRadius:'50%',background:'rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'26px'}}, '👁'),
              React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'#fff'}}, 'No one has viewed this yet'),
              React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,0.55)',maxWidth:'260px',lineHeight:1.4}}, 'When someone watches your moment, their name will appear here.')
            )
          : React.createElement('div',{style:{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}},
              viewerList.map(function(v){
                var prof = viewerProfiles[v.viewer_id] || {};
                var displayName = prof.full_name || (v.viewer_id ? v.viewer_id.substring(0, 8) + '…' : 'Anonymous');
                var avatar = prof.avatar_url || null;
                var initial = (prof.full_name || v.viewer_id || '?').charAt(0).toUpperCase();
                return React.createElement('div',{key:v.viewer_id,style:{display:'flex',alignItems:'center',gap:'12px',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}},
                  avatar
                    ? React.createElement('img', {src: avatar, alt:'', style:{width:'38px',height:'38px',borderRadius:'50%',objectFit:'cover',flexShrink:0,border:'1px solid rgba(255,255,255,0.1)'}})
                    : React.createElement('div',{style:{width:'38px',height:'38px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,flexShrink:0}}, initial),
                  React.createElement('div',{style:{flex:1,minWidth:0}},
                    React.createElement('div',{style:{fontSize:'13.5px',color:'#fff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, displayName),
                    React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.5)',marginTop:'1px'}}, v.viewed_at ? relativeTime(v.viewed_at) + ' ago' : 'recently')
                  )
                );
              })
            )
      )
    ) : null
  );

  // Build a peek for an adjacent user. Positioned as a face on the cube:
  //   offset=+1 (next): rotated +90° (faces right), pushed out by halfDepth
  //   offset=-1 (prev): rotated -90° (faces left),  pushed out by halfDepth
  // The cube wrapper does ALL the rotation per-frame; this face's transform
  // is set once at mount and never touched again.
  function renderGhost(m, offset, refToAttach, halfDepthPx){
    if (!m) return null;
    var first = (m.slides && m.slides[0]) || null;
    var hasImg = !!(first && first.imageUrl);
    var bg = hasImg ? '#000' : (first && first.bg) || 'linear-gradient(135deg,#7B6EFF,#E84D9A)';
    var name = m.userName || '';
    var avatar = m.userAvatar || null;
    var caption = first ? (first.caption || first.text || '') : '';
    // Position on the cube surface.
    var faceRot = offset > 0 ? 90 : -90;
    var faceTransform = 'rotateY(' + faceRot + 'deg) translateZ(' + halfDepthPx + 'px)';
    return React.createElement('div', {
      key: 'ghost-' + offset,
      ref: refToAttach,
      'aria-hidden': 'true',
      style: {
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        background: bg,
        pointerEvents: 'none',
        overflow: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: faceTransform,
      }
    },
      // Image layer — same renderer as current slide (background-image
      // div, not <img>) so the visual matches exactly during the swipe.
      hasImg ? React.createElement('div', {
        style: {
          position: 'absolute', top:0, left:0, width:'100%', height:'100%',
          backgroundImage: 'url("' + first.imageUrl + '")',
          backgroundSize: 'contain', backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat', backgroundColor: '#000',
        }
      }) : null,
      // User name pill at the TOP (same place as the current slide)
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: 'calc(24px + env(safe-area-inset-top, 0px))',
          left: '14px',
          display: 'flex', alignItems: 'center', gap: '10px',
          color: '#fff', fontSize: '14px', fontWeight: 700,
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }
      },
        avatar ? React.createElement('img', {
          src: avatar, alt: '',
          style: { width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover', border:'1.5px solid rgba(255,255,255,0.5)' }
        }) : React.createElement('div', {
          style: { width:'32px', height:'32px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700 }
        }, (name || '?').charAt(0).toUpperCase()),
        React.createElement('div', null, name)
      ),
      // Caption — same wrapper+flex pattern as the current slide so the
      // transition is seamless. The flex-centered inner element renders
      // reliably under the parent face's 3D rotation.
      caption ? (hasImg ? React.createElement('div', {
        style: {
          position: 'absolute',
          left: '14px', right: '14px',
          bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
          zIndex: 2,
        }
      },
        React.createElement('div', {
          style: {
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            borderRadius: '14px',
            padding: '10px 14px',
            fontSize: '14px', fontWeight: 600, lineHeight: 1.35,
            textAlign: 'center', color: '#fff',
            textShadow: '0 1px 6px rgba(0,0,0,0.4)',
          }
        }, caption)
      ) : React.createElement('div', {
        style: {
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 1,
        }
      },
        React.createElement('div', {
          style: {
            fontSize: '24px', fontWeight: 800, lineHeight: 1.3,
            textAlign: 'center', maxWidth: '82%',
            color: '#fff',
            textShadow: '0 2px 16px rgba(0,0,0,0.35)',
            fontFamily: 'Syne, DM Sans, sans-serif',
          }
        }, caption)
      )) : null,
      // Simple progress bar placeholder so the chrome matches the current slide
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: 'calc(10px + env(safe-area-inset-top, 0px))',
          left: 8, right: 8, height: '3px',
          background: 'rgba(255,255,255,0.3)',
          borderRadius: '2px',
        }
      })
    );
  }

  // Backdrop — sits BEHIND every slide. Opacity tweaked directly via
  // ref during vertical dismiss drag (no setState).
  var backdrop = React.createElement('div', {
    key: 'backdrop',
    ref: backdropRef,
    'aria-hidden': 'true',
    style: {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh',
      background: '#000',
      opacity: 1,
      zIndex: 9997,
      pointerEvents: 'none',
    }
  });

  // TRUE 3D CUBE structure (Insta Stories pattern):
  //
  //   <perspectiveWrapper>     -- fixed full screen, perspective: 800
  //     <cubeWrapper>          -- preserve-3d, rotateY(theta) via ref
  //       <prevFace>           -- rotateY(-90deg) translateZ(halfDepth)
  //       <currentFace>        -- translateZ(halfDepth)
  //       <nextFace>           -- rotateY(+90deg) translateZ(halfDepth)
  //
  // The cubeWrapper is the only thing that rotates per-frame. Faces are
  // glued to their cube sides and ride along rigidly.
  //
  // halfDepth = VW/2 so faces sit on a cube of side length VW. The
  // cubeWrapper translateZ(-halfDepth) brings the current face back to
  // the viewport plane (z=0) at rest, so no perspective magnification.
  var halfDepth = Math.round(VW / 2);
  var cubeStage = React.createElement('div', {
    style: {
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100dvh',
      perspective: '800px',          // tighter perspective = more dramatic 3D
      perspectiveOrigin: '50% 50%',
      zIndex: 9998,
      pointerEvents: 'none',
      overflow: 'hidden',            // clip cube to viewport bounds
    }
  },
    React.createElement('div', {
      ref: cubeRef,
      style: {
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        // Initial pose — current face at viewport plane.
        transform: 'translateZ(' + (-halfDepth) + 'px) rotateY(0deg)',
        transformOrigin: '50% 50%',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }
    },
      // Left face (prev user). Rotated to point left from cube center.
      renderGhost(prevMoment, -1, prevGhostRef, halfDepth),
      // Front face (current user). Has the chrome (header, composer, etc).
      overlay,
      // Right face (next user). Rotated to point right from cube center.
      renderGhost(nextMoment, 1, nextGhostRef, halfDepth)
    )
  );

  var portalRoot = React.createElement(React.Fragment, null,
    backdrop,
    cubeStage
  );

  // SSR guard — document is undefined during server render; we only need
  // the portal on the client anyway.
  if (typeof document === 'undefined' || !document.body) return portalRoot;
  return createPortal(portalRoot, document.body);
}

// ──────────────────────────────────────────────────────────────────────────
// Moments — RingIn's take on Stories / Status. Where Facebook uses circles
// and Instagram uses rounded squares, we use a HEART. The clip-path below
// is a 12-point polygon approximation of a heart, which renders cleanly
// at any size and across all modern browsers.
//
// Used in three places: HomeScreen (feed top), ProfileScreen (own profile),
// and UserProfileView (other users' profiles). The same component with
// different props.
//
// Currently UI-only — no Supabase persistence yet. Real moments storage
// can be added later by wiring `moments` prop to a fetch / realtime sub.
// ──────────────────────────────────────────────────────────────────────────

var HEART_CLIP_PATH =
  'polygon(50% 95%, 20% 80%, 3% 50%, 3% 25%, 20% 5%, 35% 5%, 50% 22%, 65% 5%, 80% 5%, 97% 25%, 97% 50%, 80% 80%)';

// One heart tile. Renders the avatar (or initials) inside a heart-shaped
// clip, optionally wrapped in a gradient "unread" ring. For the "add"
// tile (isAdd=true), overlays a small + badge in the bottom-right corner
// so the affordance stays visible even when the user has an avatar.
//
// When `onAddClick` is also passed, the + badge becomes its OWN click
// target — tapping the badge opens the uploader, while tapping the heart
// itself fires `onClick` (typically opening the viewer for your own
// already-posted moments). This is the Instagram pattern: one tile per
// user, with a separate "+" affordance to add more.
function HeartTile(props){
  var size = props.size || 68;
  var ring = !!props.ring;
  // T2.7 — ringVariant='close-friends' renders the ring in green (matches
  // Instagram's Close Friends Story tier).
  var ringVariant = props.ringVariant || 'moment';
  var src = props.src || null;
  var initials = props.initials || '?';
  var bg = props.bg || 'linear-gradient(135deg,#7B6EFF,#E84D9A)';
  var onClick = props.onClick;
  var onAddClick = props.onAddClick;
  var isAdd = !!props.isAdd;

  // OUTER button is unclipped so the + badge can sit ON TOP of the heart
  // without being chopped by the heart's clip-path. We use a nested
  // <div> with the clip-path for the actual heart silhouette.
  var buttonStyle = {
    position: 'relative',
    width: size, height: size,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'block',
  };
  // The heart silhouette wrapper (handles the optional gradient ring)
  var heartWrapStyle = {
    position: 'absolute',
    inset: 0,
    clipPath: HEART_CLIP_PATH,
    background: ring
      ? (ringVariant === 'close-friends'
          ? 'linear-gradient(135deg,#27C96A,#1FA858,#0F6E3A)'
          : 'linear-gradient(135deg,#FF6B6B,#E84D9A,#7B6EFF)')
      : 'transparent',
    padding: ring ? 3 : 0,
    boxSizing: 'border-box',
  };
  var heartInnerStyle = {
    width: '100%', height: '100%',
    clipPath: HEART_CLIP_PATH,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: (isAdd && !src) ? '24px' : '16px',
    fontWeight: 700,
    overflow: 'hidden',
    position: 'relative',
  };
  // + badge for "add" tiles. Sits outside the clip so it's always visible
  // even when an avatar is shown. If onAddClick is wired, the badge
  // becomes a clickable button (intercepts the tap so the heart's main
  // onClick — typically "open viewer" — doesn't fire).
  var badgeClickable = isAdd && !!onAddClick;
  var badgeStyle = {
    position: 'absolute',
    bottom: '-2px',
    right: '6px',
    width: '22px', height: '22px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
    border: '2px solid var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1,
    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
    pointerEvents: badgeClickable ? 'auto' : 'none',
    cursor: badgeClickable ? 'pointer' : 'default',
  };

  // Outer is a <div> with role="button" rather than a <button>, so we can
  // safely nest a clickable + badge inside without creating invalid HTML
  // (nested <button> elements). Accessibility: tabIndex + keyboard handler.
  return React.createElement('div', {
    role: 'button',
    tabIndex: 0,
    onClick: onClick,
    onKeyDown: function(e){
      if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(e); }
    },
    title: isAdd ? 'Add a Moment' : (props.label || 'View Moment'),
    style: buttonStyle,
  },
    React.createElement('div', {style: heartWrapStyle},
      React.createElement('div', {style: heartInnerStyle},
        src
          ? React.createElement('img', {
              src: src, alt: '',
              style:{width:'100%',height:'100%',objectFit:'cover'},
              onError:function(e){ try{ e.target.style.display='none'; }catch(_){ } },
            })
          : (isAdd ? '+' : initials)
      )
    ),
    // + badge — only on the user's own "add" tile, only when they have an
    // avatar in the heart (otherwise the big "+" in the center is the cue).
    (isAdd && src) ? React.createElement(badgeClickable ? 'button' : 'div', {
      type: badgeClickable ? 'button' : undefined,
      style: badgeStyle,
      onClick: badgeClickable ? function(e){
        try{ e.stopPropagation && e.stopPropagation(); }catch(_){}
        onAddClick();
      } : undefined,
      'aria-label': badgeClickable ? 'Add a Moment' : undefined,
      title: badgeClickable ? 'Add a Moment' : undefined,
    }, '+') : null
  );
}

// The strip — horizontal scrollable row of heart tiles with names below.
// Props:
//   ownAvatar     string?  current user's avatar (shown in the "+ add" tile)
//   ownName       string?  label under the add tile (default "Your Moment")
//   showAdd       bool     show the "+" tile (default true)
//   ownMoment     object?  current user's OWN grouped moment ({ slides:[…] })
//                          — when present and non-empty, tapping the "+" tile
//                          opens the viewer for the user's own slides, and
//                          the "+" corner badge becomes a separate "add
//                          another" button. Without this prop, posting a
//                          moment makes a second "You" tile appear next to
//                          the "+" tile — the bug we're fixing.
//   moments       array    [{ id, userName, userAvatar, hasNew? }] — OTHER
//                          users' moments only (parent should exclude self)
//   onAdd         fn       called when user wants to add a moment ("+" tile
//                          when no own slides, "+" badge when slides exist)
//   onView        fn       called with a moment object when its tile is tapped
//   compact       bool     smaller size for profile pages (default false)
export default function Moments(props){
  var moments = props.moments || [];
  var showAdd = props.showAdd !== false;
  var compact = !!props.compact;
  var size = compact ? 60 : 68;
  var ownMoment = props.ownMoment || null;
  var hasOwnSlides = !!(ownMoment && ownMoment.slides && ownMoment.slides.length > 0);

  // Internal viewer state — when set, MomentViewer overlay is rendered
  var viewerS = useState(null);
  var viewer = viewerS[0]; var setViewer = viewerS[1];

  // Build the ordered list of users-with-moments. Used by horizontal
  // swipe (next/prev user). Self is always first when showAdd &&
  // hasOwnSlides, then the moments[] prop (which the parent already
  // excludes self from).
  function buildOrderedList(){
    var list = [];
    if (hasOwnSlides) list.push(ownMoment);
    moments.forEach(function(m){ list.push(m); });
    return list;
  }

  // Click-blocker — a brief transparent overlay rendered for ~400ms after
  // the viewer closes, to absorb the synthetic `click` event that a
  // touchscreen fires on the element underneath what was just dismissed.
  // Without this, dismissing a moment by tapping × OR by swipe-down often
  // accidentally taps the expert avatar / Comments button / heart tile
  // that was sitting behind the viewer.
  var clickGuardS = useState(false);
  var clickGuard = clickGuardS[0]; var setClickGuard = clickGuardS[1];

  function openViewerFor(m, enterDir){
    // Real moments come with their own slides (image + caption); mock
    // expert moments fall back to deterministic gradient sample sets.
    var slides = (m.slides && m.slides.length > 0) ? m.slides : setForId(m.id);
    setViewer({
      user: { name: m.userName || '', avatar: m.userAvatar || null },
      slides: slides,
      moment: m,
      // T2.5 — flag own moments so the viewer shows the "Seen by N" badge
      // and skips recording self-views.
      isOwn: !!m.isSelf,
      enterDir: enterDir || 0,
      // Force-remount the viewer between users so its state (idx, paused,
      // viewerList) doesn't leak. We bump a key per open call.
      key: 'mv-' + m.id + '-' + Date.now(),
    });
  }
  function closeViewer(){
    setViewer(null);
    // Arm the click-blocker for the first ~400ms after close.
    setClickGuard(true);
    setTimeout(function(){ setClickGuard(false); }, 400);
  }

  // Android back-button handler — split into TWO effects to avoid the
  // bug where swiping between users (which changes `viewer` but doesn't
  // close it) was firing history.back() in cleanup → popstate after the
  // new listener was registered → setViewer(null) → exit moments.
  //
  // viewerOpenRef tracks the actual open/closed state separate from
  // React's dep tracking. Only push history on open, only pop on close,
  // never touch history on user-to-user transitions.
  var viewerOpenRef = useRef(false);
  useEffect(function(){
    var isNowOpen = !!viewer;
    var wasOpen = viewerOpenRef.current;
    viewerOpenRef.current = isNowOpen;
    if (isNowOpen && !wasOpen) {
      // CLOSED → OPEN: push a history entry so hw back will close.
      try { history.pushState({ ringinMomentViewer: 1 }, '', ''); } catch(_){}
    } else if (!isNowOpen && wasOpen) {
      // OPEN → CLOSED: pop our history entry to keep the stack clean.
      try {
        if (history.state && history.state.ringinMomentViewer) {
          history.back();
        }
      } catch(_){}
    }
    // OPEN → OPEN (user swipe): do nothing. History stays put.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  // Popstate listener — mounted once. Fires when the user (or Android
  // hardware back) navigates back. Closes viewer if it's open.
  useEffect(function(){
    function onPopState(){
      if (viewerOpenRef.current) {
        viewerOpenRef.current = false;
        setViewer(null);
        setClickGuard(true);
        setTimeout(function(){ setClickGuard(false); }, 400);
      }
    }
    window.addEventListener('popstate', onPopState);
    return function(){ window.removeEventListener('popstate', onPopState); };
  }, []);

  // Called by MomentViewer on a horizontal swipe — moves to next/prev
  // user in the ordered list. Matches Instagram's swipe-between-stories.
  //
  // DEFENSIVE: this function NEVER closes the viewer. If the current
  // moment isn't found in the list (race condition) or we're already
  // at an edge, we just return — the viewer stays open on whatever it
  // was showing. Previously we called closeViewer() on these edge
  // cases, which caused the "viewer exits on swipe" bug.
  function jumpToUser(direction){
    if (!viewer) return;
    var list = buildOrderedList();
    var currentId = viewer.moment && viewer.moment.id;
    var i = -1;
    for (var k = 0; k < list.length; k++) { if (list[k].id === currentId) { i = k; break; } }
    if (i < 0) return;                  // current moment not in list — bail without closing
    var next = i + direction;
    if (next < 0 || next >= list.length) return;  // at edge — stay put
    openViewerFor(list[next], direction);
  }

  // Returns the moment object at the given offset from the currently-open
  // viewer, or null if we're at the edge. Used by MomentViewer during a
  // live horizontal drag so it can render the adjacent user's first slide
  // as a peek (Instagram-style "both stories visible during the swipe").
  function getAdjacentMoment(direction){
    if (!viewer) return null;
    var list = buildOrderedList();
    var currentId = viewer.moment && viewer.moment.id;
    var i = -1;
    for (var k = 0; k < list.length; k++) { if (list[k].id === currentId) { i = k; break; } }
    if (i < 0) return null;
    var nextIdx = i + direction;
    if (nextIdx < 0 || nextIdx >= list.length) return null;
    return list[nextIdx];
  }

  // Window event hook — lets OTHER screens (e.g. ProfileScreen's avatar
  // menu) open the user's own moments through THIS Moments instance.
  // We listen here because Moments owns the MomentViewer, so triggering
  // it from elsewhere would otherwise require duplicating the viewer.
  // The listener is gated to instances that have showAdd (i.e. the
  // user's-own context) so we don't open from a Moments strip embedded
  // on another user's profile.
  useEffect(function(){
    if (!showAdd) return;
    function onOpenOwn(){
      if (hasOwnSlides) openViewerFor(ownMoment);
    }
    try { window.addEventListener('ringin-open-own-moment', onOpenOwn); } catch(_){}
    return function(){
      try { window.removeEventListener('ringin-open-own-moment', onOpenOwn); } catch(_){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd, hasOwnSlides, ownMoment]);

  // Defensive: total nav strip height is heart (size) + label gap (5px) +
  // label height (~12px) + top padding (12px) + bottom padding (16px) =
  // size + 45 px. Setting an explicit min-height stops any flex parent
  // from squashing the strip into a 15px sliver.
  var stripMinHeight = size + 45;

  return React.createElement('div', {
    className:'moments-strip',
    style:{
      display:'flex',
      gap:'14px',
      padding:'12px 16px 16px',
      overflowX:'auto',
      overflowY:'hidden',
      scrollbarWidth:'none',
      msOverflowStyle:'none',
      WebkitOverflowScrolling:'touch',
      borderBottom:'1px solid var(--border)',
      marginBottom:'4px',
      // Defenses against flex / grid parents trying to shrink the strip:
      flexShrink:0,
      minHeight: stripMinHeight + 'px',
      boxSizing:'border-box',
    },
    onTouchStart:function(ev){ ev.stopPropagation && ev.stopPropagation(); },
  },
    showAdd ? React.createElement('div', {
      style:{display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',flexShrink:0}
    },
      React.createElement(HeartTile, {
        src: props.ownAvatar || null,
        initials: '+',
        isAdd: true,
        size: size,
        // Show "unread" gradient ring when the user has fresh own moments —
        // matches the visual treatment of other users' moment tiles.
        ring: hasOwnSlides && (ownMoment.hasNew !== false),
        // T2.7 — green ring if your latest moment is close-friends-only.
        ringVariant: (ownMoment && ownMoment.closeFriendsOnly) ? 'close-friends' : 'moment',
        bg: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
        // Main tile tap:
        //   - user has own moments → open viewer directly (Instagram pattern)
        //   - no own moments yet   → open uploader
        // The "+" corner badge is the dedicated affordance for adding
        // ANOTHER moment when you already have one.
        onClick: function(){
          if (hasOwnSlides) {
            openViewerFor(ownMoment);
            return;
          }
          if (props.onAdd) props.onAdd();
          else { try{ alert('Moments coming soon — capture & post photos/videos that vanish after 24h.'); }catch(e){} }
        },
        // When user already has slides, the "+" corner badge becomes a
        // separate clickable affordance for adding ANOTHER slide. Without
        // this, the only way to add a new one would be to first watch all
        // your old ones (the main tile only opens the viewer).
        onAddClick: hasOwnSlides && props.onAdd ? props.onAdd : null,
      }),
      React.createElement('div', {
        style:{fontSize:'10px',color:'var(--t2)',maxWidth:size+8,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}
      }, props.ownName || 'Your Moment')
    ) : null,

    moments.map(function(m){
      return React.createElement('div', {
        key: m.id,
        style:{display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',flexShrink:0}
      },
        React.createElement(HeartTile, {
          src: m.userAvatar || null,
          initials: m.userName ? m.userName.charAt(0).toUpperCase() : '?',
          bg: m.color || 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
          ring: m.hasNew !== false,
          ringVariant: m.closeFriendsOnly ? 'close-friends' : 'moment',
          size: size,
          label: m.userName,
          // Always open the internal viewer. If parent passes onView it runs
          // first (e.g. for analytics) but we still open the viewer.
          onClick: function(){ try{ if(props.onView) props.onView(m); }catch(_){} openViewerFor(m); },
        }),
        React.createElement('div', {
          style:{fontSize:'10px',color:'var(--text)',maxWidth:size+8,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}
        }, m.userName || '')
      );
    }),

    // Empty-state pad so the last tile has a bit of right margin when scrolling
    React.createElement('div', {style:{minWidth:'4px',flexShrink:0}}),

    // (Per user feedback: the avatar PICKER lives on the ProfileScreen
    // avatar tap, NOT on the home-feed Moments strip. Tapping the heart
    // tile here goes straight to the viewer — restored that behaviour.)
    // Full-screen Insta-style viewer (rendered as last child; position:fixed
    // takes it out of flow regardless of where it sits in the DOM).
    viewer ? React.createElement(MomentViewer, {
      key: viewer.key,
      user: viewer.user,
      slides: viewer.slides,
      moment: viewer.moment,
      onClose: closeViewer,
      onLike: props.onLike,
      onReply: props.onReply,
      onViewProfile: props.onViewProfile,
      // T2.5 — view count tracking
      myUserId: props.myUserId || null,
      isOwn: viewer.isOwn === true,
      // Horizontal swipe → jump to next/prev user in the strip.
      onNextUser: jumpToUser,
      // Live drag: viewer queries this during a horizontal drag to render
      // the adjacent user's first slide as a peek. Returns null at edges.
      getAdjacent: getAdjacentMoment,
    }) : null,
    // Click-blocker — absorbs the synthetic click that fires on the
    // underlying page right after the viewer dismisses, so we don't
    // accidentally open an expert profile / Comments / heart tile.
    clickGuard ? React.createElement('div', {
      'aria-hidden': 'true',
      onClick: function(e){ e.stopPropagation(); e.preventDefault(); },
      onPointerDown: function(e){ e.stopPropagation(); e.preventDefault(); },
      onPointerUp: function(e){ e.stopPropagation(); e.preventDefault(); },
      onTouchStart: function(e){ e.stopPropagation(); },
      onTouchEnd: function(e){ e.stopPropagation(); },
      style: {
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100dvh',
        zIndex: 99999,
        background: 'transparent',
        cursor: 'default',
      }
    }) : null
  );
}
