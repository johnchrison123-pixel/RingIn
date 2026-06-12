/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import FrostyFluidGlassNav from './components/FrostyFluidGlassNav';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import {startLastSeen, stopLastSeen} from './utils/lastSeen';
import {loadBlocks, resetBlocksCache} from './utils/blocks'; /* R20 FIX #3: reset on SIGNED_OUT */
import {startCloseFriends} from './utils/closeFriends';
import {startOtaUpdater, downloadAndApply} from './utils/otaUpdater';
import HomeScreen, {UserProfileView} from './screens/HomeScreen';
import {useFollow} from './screens/useFollow';
import SearchScreen from './screens/SearchScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import WorkshopsScreen from './screens/WorkshopsScreen';
import FriendsScreen from './screens/FriendsScreen';
import MessagesScreen from './screens/MessagesScreen';
import SavedPostsScreen from './screens/SavedPostsScreen';
import AnonymousConnect from './screens/AnonymousConnect';
import CallScreen from './screens/CallScreen';
import IncomingCallModal from './components/IncomingCallModal';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import {sb as supabase} from './utils/supabase';
import {initPushNotifications} from './utils/pushNotifications';
import {clearFcmToken} from './utils/firebase'; /* R16 FIX #3 */
import {playSound} from './utils/soundEngine';
import {prefetchAgora} from './utils/agora';
import {useCoinBalance, getCachedCoinBalance} from './utils/coinBalance';
import {ANON_AVATAR_LOOKUP} from './utils/anonAvatars'; /* R37: shared with AnonymousConnect — single source of truth */
// Final polish: native alert() blocks the JS thread + looks system-y on Android.
// Replaced with non-blocking toasts via the existing toast utility.
import {toastError, toastWarn, toastInfo} from './utils/toast';
import {safeInitials} from './utils/initials'; /* FIX #10: UTF-16 safe initials */

// ROUND-9 FIX #6: getComputedStyle in the swipe-back touchstart walker
// was running for every node on every touch — measurable jank on big
// trees (think nested carousel feeds). WeakMap-cache the answer per
// node so repeated touches in the same DOM tree pay only the first
// computation. WeakMap auto-cleans entries when the node is GC'd.
var _hscrollCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
function isHorizontalScrollAncestor(node){
  if (!node) return false;
  if (_hscrollCache && _hscrollCache.has(node)) return _hscrollCache.get(node);
  var hasHScroll = false;
  try {
    var cs = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(node) : null;
    if (cs && /auto|scroll/.test(cs.overflowX) && node.scrollWidth > node.clientWidth) {
      hasHScroll = true;
    }
  } catch (_) {}
  if (_hscrollCache) {
    try { _hscrollCache.set(node, hasHScroll); } catch (_) {}
  }
  return hasHScroll;
}

export default function App() {
  var sessionS = useState(null); var session = sessionS[0]; var setSession = sessionS[1];
  var tabS = useState('home'); var activeTab = tabS[0]; var setActiveTab = tabS[1];
  var prevTabS = useState('home'); var prevTab = prevTabS[0]; var setPrevTab = prevTabS[1];
  var expS = useState(null); var selectedExpert = expS[0]; var setSelectedExpert = expS[1];
  var initConvoS = useState(null); var initConvo = initConvoS[0]; var setInitConvo = initConvoS[1];
  var viewUserStackS = useState([]); var viewUserStack = viewUserStackS[0]; var setViewUserStack = viewUserStackS[1];
  var unreadMsgS = useState(0); var unreadMsg = unreadMsgS[0]; var setUnreadMsg = unreadMsgS[1];
  var unreadNotifS = useState(0); var unreadNotif = unreadNotifS[0]; var setUnreadNotif = unreadNotifS[1];
  /* R20 verifier-cleanup: msgResetKey state removed — was used by Fix #7 prior
   * (key='messages-N' for remount-on-tap). Now in-place reset via window event. */
  // Incoming call: a row inserted into call_invites where callee_id = me
  var incomingCallS = useState(null); var incomingCall = incomingCallS[0]; var setIncomingCall = incomingCallS[1];
  // Active call (rendered above everything): set when user starts an outgoing call OR accepts an incoming one
  var activeCallS = useState(null); var activeCall = activeCallS[0]; var setActiveCall = activeCallS[1];
  function pushViewUser(u){ setViewUserStack(function(prev){return prev.concat([u]);}); }
  function popViewUser(){ setViewUserStack(function(prev){return prev.slice(0,-1);}); }
  var emailS = useState(''); var email = emailS[0]; var setEmail = emailS[1];
  var passS = useState(''); var password = passS[0]; var setPassword = passS[1];
  var loginS = useState(true); var isLogin = loginS[0]; var setIsLogin = loginS[1];
  var loadS = useState(false); var loading = loadS[0]; var setLoading = loadS[1];
  var msgS = useState(''); var message = msgS[0]; var setMessage = msgS[1];
  // R23: show/hide password toggle (industry-standard mobile UX baseline)
  var showPwS = useState(false); var showPw = showPwS[0]; var setShowPw = showPwS[1];
  // R23: Forgot Password flow on the login screen. forgotMode = false (login),
  // 'enter' (collecting email), 'sent' (reset email dispatched).
  var forgotModeS = useState(false); var forgotMode = forgotModeS[0]; var setForgotMode = forgotModeS[1];
  var forgotLoadS = useState(false); var forgotLoad = forgotLoadS[0]; var setForgotLoad = forgotLoadS[1];
  var forgotErrS = useState(''); var forgotErr = forgotErrS[0]; var setForgotErr = forgotErrS[1];
  var appUserId = session&&session.user?session.user.id:null;
  var appFollowHook = useFollow(supabase, appUserId);
  var appFollowing = appFollowHook.following;
  var appToggleFollow = appFollowHook.toggleFollow;
  // App-level coin balance — passed to CallScreen as the starting `coins`
  // prop so the call timer charges against the user's real balance, not a
  // hardcoded 1240. The hook itself keeps every screen's chip in sync.
  var appCoinBal = useCoinBalance(appUserId, supabase);

  // ── Centralized back-navigation (Android hardware back + edge-swipe) ──
  // Priority chain (most specific → least):
  //   1. Sub-screens can intercept via the cancelable 'ringin:back' window
  //      event (e.g. MessagesScreen closes the open chat). If a listener
  //      calls preventDefault, we stop here.
  //   2. Incoming-call modal → dismiss
  //   3. Active in-call screen → end the call gracefully (let CallScreen do it)
  //   4. UserProfileView stack → pop one
  //   5. Search tab with selected expert → clear the expert (back to list)
  //   6. Modal-ish tabs (wallet/saved/connect) → return to prevTab
  //   7. Any non-home top-level tab → go home
  //   8. Already on home → let the OS exit the app
  // We stash this in a ref so the Capacitor backButton listener (which is
  // registered once with empty deps) always reads the latest state.
  var goBackRef = useRef(null);
  function goBack(){
    // 1. Try to let an active sub-screen consume it (cancelable event).
    try {
      var ev = new CustomEvent('ringin:back', { cancelable: true });
      var notConsumed = window.dispatchEvent(ev);
      if (!notConsumed || ev.defaultPrevented) return true;
    } catch(_) {}
    // 2-7. App-level nav
    if (incomingCall) { setIncomingCall(null); return true; }
    if (activeCall) {
      // ROUND 8 FIX #6: nulling activeCall directly leaked the Agora client
      // + left the DB invite row in 'ringing' state + skipped the coin
      // transactions row write. Dispatch event first so CallScreen runs
      // its hangup('caller_hangup') sequence (leave + DB update + tx
      // write + coin persist + broadcast) BEFORE we unmount it.
      try { window.dispatchEvent(new CustomEvent('ringin:back-call')); } catch(_){}
      setActiveCall(null);
      return true;
    }
    if (viewUserStack && viewUserStack.length > 0) { popViewUser(); return true; }
    if (activeTab === 'search' && selectedExpert) { setSelectedExpert(null); return true; }
    if (activeTab === 'wallet') { setActiveTab(prevTab); return true; }
    if (activeTab === 'saved') { setActiveTab(prevTab); return true; }
    if (activeTab === 'connect') { setActiveTab(prevTab); return true; }
    if (activeTab !== 'home') { setActiveTab('home'); return true; }
    // 8. Nothing to pop — caller decides whether to exit.
    return false;
  }
  // Keep the ref current so the back-button listener (registered once)
  // always invokes the latest goBack — avoids stale state closures.
  goBackRef.current = goBack;

  // Register the Android hardware back button listener.
  // Capacitor v6: import('@capacitor/app').App.addListener('backButton', ...)
  // Without this, the default behavior is to exit the app on every back press.
  useEffect(function(){
    // Use a cancelled flag + ref so the cleanup can also tear down a
    // handle that gets assigned AFTER the cleanup fires (otherwise an
    // unmount during the dynamic-import resolve window leaks a listener).
    var cancelled = false;
    var handleRef = { current: null };
    var Cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return; // web/PWA path uses popstate naturally
    try {
      // Dynamic import so web builds don't blow up if the module isn't bundled.
      import('@capacitor/app').then(function(mod){
        if (cancelled) return; // unmounted before import resolved
        var CapApp = mod && (mod.App || mod.default || mod);
        if (!CapApp || !CapApp.addListener) return;
        CapApp.addListener('backButton', function(){
          var consumed = goBackRef.current ? goBackRef.current() : false;
          if (!consumed) {
            // Truly at root — exit the app.
            try { CapApp.exitApp(); } catch(_) {}
          }
        }).then(function(h){
          if (cancelled) {
            // Unmounted between addListener and its promise resolving —
            // remove immediately so the listener doesn't leak.
            try { if (h && h.remove) h.remove(); } catch(_){}
            return;
          }
          handleRef.current = h;
        }).catch(function(){});
      }).catch(function(){});
    } catch(_) {}
    return function(){
      cancelled = true;
      try { if (handleRef.current && handleRef.current.remove) handleRef.current.remove(); } catch(_){}
    };
  }, []);

  // R23: Capacitor appUrlOpen deep-link listener.
  // When the OS opens the app via a URL — e.g. a password-reset email link, an
  // Android App Link click, or a custom-scheme handoff — Capacitor fires the
  // `appUrlOpen` event with the full URL string. We parse it and route the
  // user accordingly. Currently we handle:
  //   - /reset-password?code=...        → land on the auth/Privacy reset flow
  //   - /post/<id>, /profile/<id>, etc  → existing rewrite handlers cover SSR
  //
  // For the password-reset case Supabase's email link contains a recovery
  // session token; the supabase-js client already picks it up automatically
  // from the URL hash, so we just need to make sure the WebView navigates
  // there. We set window.location.hash so the auth state listener picks up
  // the PASSWORD_RECOVERY event.
  useEffect(function(){
    var cancelled = false;
    var handleRef = { current: null };
    var Cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return; // web/PWA picks links up via normal nav
    try {
      import('@capacitor/app').then(function(mod){
        if (cancelled) return;
        var CapApp = mod && (mod.App || mod.default || mod);
        if (!CapApp || !CapApp.addListener) return;
        CapApp.addListener('appUrlOpen', function(data){
          try {
            var url = data && data.url;
            if (!url) return;
            console.log('[ringin] appUrlOpen:', url);
            // Strip any custom scheme / host so we get just the path+search+hash
            var u;
            try { u = new URL(url); } catch(_){ u = null; }
            if (!u) return;
            // Route by path. Supabase recovery emails put the session token in
            // the URL fragment (#access_token=...&type=recovery) — supabase-js
            // auto-detects this when the location updates, so just navigate.
            if (u.pathname && /reset-password|recovery/i.test(u.pathname + u.hash)) {
              try {
                window.location.hash = u.hash || '';
                // Drop the user on the login screen — supabase will fire
                // PASSWORD_RECOVERY which the auth listener (below) handles.
              } catch(_){}
            }
            // Future deep links (post, profile, moment) can be added here.
          } catch (e) {
            console.warn('[ringin] appUrlOpen handler failed:', e);
          }
        }).then(function(h){
          if (cancelled) { try { if (h && h.remove) h.remove(); } catch(_){} return; }
          handleRef.current = h;
        }).catch(function(){});
      }).catch(function(){});
    } catch(_) {}
    return function(){
      cancelled = true;
      try { if (handleRef.current && handleRef.current.remove) handleRef.current.remove(); } catch(_){}
    };
  }, []);

  // PWA shortcut deep-link — manifest.json advertises `/?tab=messages` and
  // `/?tab=search` as home-screen long-press shortcuts. Read the query once on
  // mount and jump to the requested tab. Pure additive: if there's no `?tab=`
  // param, behavior is identical to before (default to 'home').
  useEffect(function(){
    try{
      var params = new URLSearchParams(window.location.search);
      var requestedTab = params.get('tab');
      /* R27: workshops re-added per user request (tab restored to bottom nav). */
      var allowed = {home:1, messages:1, search:1, workshops:1, profile:1};
      if(requestedTab && allowed[requestedTab]){
        setActiveTab(requestedTab);
      }
    }catch(e){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX R10-2: SavedPostsScreen dispatches 'ringin:open-post-detail' with a
  // postId when the user taps a saved post. Previously had ZERO consumers
  // — clicks were silently dropped. Three-hop chain:
  //   SavedPosts  → dispatches 'ringin:open-post-detail' {postId}
  //   App.js      → switches to home tab + dispatches 'ringin:home-open-post'
  //   HomeScreen  → listens for 'ringin:home-open-post' → opens postDetail
  useEffect(function(){
    function onOpenPostDetail(ev){
      var postId = ev && ev.detail && ev.detail.postId;
      if (!postId) return;
      setActiveTab('home');
      try { window.dispatchEvent(new CustomEvent('ringin:home-open-post', {detail:{postId:postId}})); } catch(_){}
    }
    window.addEventListener('ringin:open-post-detail', onOpenPostDetail);
    return function(){ window.removeEventListener('ringin:open-post-detail', onOpenPostDetail); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lock-screen notification deep-link handler ─────────────────────────
  // When the user taps an incoming-call push notification, the service
  // worker opens the PWA at /?invite=<id>&action=accept|decline. Read
  // those params after auth resolves, fetch the invite, and act:
  //   - action=accept  → open the call screen directly (skip ring modal)
  //   - action=decline → mark the invite rejected and stay on home
  //   - no action      → fetch and show the incoming-call modal
  // We wait for `session` to be populated since Supabase RLS requires it.
  useEffect(function(){
    if(!session || !session.user) return;
    try{
      var params = new URLSearchParams(window.location.search);
      var inviteIdParam = params.get('invite');
      if(!inviteIdParam) return;
      var actionParam = params.get('action');
      // Clean the URL so a future refresh doesn't re-trigger this
      try{ window.history.replaceState({}, '', window.location.pathname); }catch(_){}

      supabase.from('call_invites').select('*').eq('id', inviteIdParam).maybeSingle().then(function(r){
        if(!r || !r.data) return;
        var inv = r.data;
        // Belt-and-suspenders: ignore if I'm not the callee
        if(inv.callee_id !== session.user.id) return;
        // Only act on ringing invites; anything ended/cancelled is stale
        if(inv.status !== 'ringing') return;

        if(actionParam === 'decline'){
          supabase.from('call_invites').update({
            status:'rejected', ended_at:new Date().toISOString(), end_reason:'rejected_from_notification',
          }).eq('id', inviteIdParam).then(function(){});
          return;
        }
        /* R21 FIX #1: previously the actionParam==='accept' branch tried to
         * call acceptIncomingCall directly — but that's declared LATER in this
         * component as a function expression (line 607+) and is `undefined`
         * inside this earlier useEffect due to var hoisting. The check silently
         * failed every time, so push-Accept did nothing (user thought app
         * froze). Always opening the ring modal works for both Accept and
         * default cases — user taps Accept on the in-app modal, which uses the
         * real (fully-declared) acceptIncomingCall. Costs one extra tap but
         * always works. */
        setIncomingCall(inv);
      });
    }catch(e){ /* never break the app on a URL parse error */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(function() {
    // Eagerly start fetching the Agora SDK chunk on app mount. The idle-callback
    // prefetch in agora.js may never fire on a busy page; this guarantees the
    // SDK is downloaded + parsed long before the user accepts a call, so call
    // accept doesn't trigger a 200-1500ms synchronous parse hang on Samsung Internet.
    try { prefetchAgora(); } catch(e){}
    // OTA: check for a newer web bundle on app start. NO auto-download —
    // we just check the manifest, then dispatch an event with the new
    // version's release notes. UpdatePrompt renders the neon-green popup
    // with notes + an Update button; tapping it triggers downloadAndApply
    // which pulls the bundle, shows progress, and reloads — all while a
    // frosted overlay covers the brief reload flash.
    try {
      // Global download helper that UpdatePrompt calls when user taps Update.
      // It looks up the pending update info we stashed on window during the
      // check, and triggers the actual download + reload.
      try {
        window.__ringinDownloadOtaUpdate = function(onProgress){
          var info = window.__ringinPendingOtaUpdate;
          if (!info) return Promise.reject(new Error('no-pending-update'));
          return downloadAndApply(info.version, info.url, onProgress);
        };
      } catch(_){}
      startOtaUpdater(function(info){
        // Stash so __ringinDownloadOtaUpdate can find the version/url.
        try { window.__ringinPendingOtaUpdate = info; } catch(_){}
        // Dispatch event with full release-note info.
        try {
          var ev = new CustomEvent('ringin-sw-update-available', {
            detail: {
              source: 'ota',
              version: info && info.version,
              title: info && info.title,
              notes: info && info.notes,
            }
          });
          window.dispatchEvent(ev);
        } catch(_){}
      });
    } catch(e){}

    supabase.auth.getSession().then(function(res) {
      setSession(res.data.session);
      // Start last_seen heartbeat — pings profiles.last_seen_at every 60s
      // while app is foregrounded. T2.4, requires migration 0006_last_seen.sql.
      if (res.data.session && res.data.session.user) {
        try { startLastSeen(res.data.session.user.id); } catch(_){}
        // T2.11 — load + migrate blocks. Fires the one-time legacy
        // localStorage → server migration on first run after the migration
        // is applied. Idempotent thereafter.
        try { loadBlocks(res.data.session.user.id); } catch(_){}
        // T2.7 — load Close Friends list (cached + server refresh).
        try { startCloseFriends(res.data.session.user.id); } catch(_){}
      }
    });
    // FIX #6: track the previous user id so we can wipe their per-user caches
    // on SIGNED_OUT (where `session` is null and we'd otherwise have no id).
    // supabase-js v2 has no sync supabase.auth.user(), so seed via the
    // getSession promise and update on every auth event.
    var _prevAuthUserId = null;
    try {
      supabase.auth.getSession().then(function(r){
        if (r && r.data && r.data.session && r.data.session.user) {
          _prevAuthUserId = r.data.session.user.id;
        }
      });
    } catch(_){}
    var sub = supabase.auth.onAuthStateChange(function(_event, session) {
      setSession(session);
      // Restart heartbeat on auth change (sign-in / sign-out).
      try {
        if (session && session.user) startLastSeen(session.user.id);
        else stopLastSeen();
      } catch(_) {}
      // FIX #6: SIGNED_OUT — clear per-user + shared caches so the next user
      // signing in doesn't see leftover data from the previous account.
      if (_event === 'SIGNED_OUT') {
        try {
          var prevId = _prevAuthUserId || ((session && session.user) ? session.user.id : null);
          // R16 FIX #3: clear fcm_token on the signed-out user's row BEFORE
          // wiping the local cache. Otherwise the device keeps receiving
          // call pushes intended for the previous account.
          if (prevId) { try { clearFcmToken(supabase, prevId); } catch(_){} }
          if (prevId) {
            /* R20 FIX #3: also wipe follows cache for prev user (was leaving the
             * next user with prev user's follow map until first server fetch). */
            var keysToWipe = ['convos_'+prevId, 'profile_info_'+prevId, 'avatar_'+prevId, 'ringin_coin_balance_'+prevId, 'saved_posts_'+prevId, 'user_posts_'+prevId, 'follows_'+prevId, 'fcm_token_'+prevId];
            keysToWipe.forEach(function(k){ try { localStorage.removeItem(k); } catch(_){} });
          }
          /* R20 FIX #3: wipe server-backed blocks cache (CACHE_KEY + MIGRATED_KEY) +
           * reset blocks.js module-scope _cache so the next user gets a clean slate
           * (previously the live in-memory Set survived auth-change). */
          ['ringin_clikes', 'ringin_muted_posts', 'ringin_muted_convos', 'ringin_blocked', 'ringin_blocks_v2', 'ringin_blocks_migrated_v2', 'ringin_muted_words', 'ringin_muted_moment_users', 'ringin_carousel_idx', 'feed_posts_cache'].forEach(function(k){ try { localStorage.removeItem(k); } catch(_){} });
          try { resetBlocksCache(); } catch(_){}
        } catch(_){}
        // also stop lastSeen + close any open chats
        try { stopLastSeen(); } catch(_){}
        _prevAuthUserId = null;
      } else if (session && session.user) {
        _prevAuthUserId = session.user.id;
      }
      if(session && session.user){
        var email = session.user.email || '';
        var emailPrefix = email.indexOf('@') > 0 ? email.split('@')[0] : 'user';
        // CRITICAL: do NOT overwrite full_name on every session. Check if profile exists
        // first; only set full_name on initial insert. This protects custom names users
        // set via Edit Profile from being wiped on every login.
        supabase.from('profiles').select('full_name').eq('id',session.user.id).single().then(function(r){
          var exists = !!(r && r.data);
          // Respect the user's "Show Online Status" privacy toggle. If they've turned it
          // off, don't force is_online=true on every auth state change.
          var showOnline = true;
          try { showOnline = localStorage.getItem('show_online') !== '0'; } catch(e) {}
          var payload = {
            id: session.user.id,
            email: email,
            last_seen: new Date().toISOString(),
          };
          if(showOnline) payload.is_online = true;
          // Only seed full_name if no row yet OR existing row has no name
          if(!exists || !r.data.full_name){ payload.full_name = emailPrefix; }
          supabase.from('profiles').upsert(payload,{onConflict:'id'}).then(function(){});
        });
        // Initialize push notifications
        initPushNotifications(session.user.id, function(payload){
          if(payload && payload.notification){
            try{ playSound('notification'); }catch(e){}
          }
        });
      }
    });
    // Use visibilitychange + pagehide instead of onbeforeunload (mobile-friendly).
    // Respect the "Show Online Status" privacy toggle — if off, leave is_online untouched.
    function markOffline(){
      try{
        var showOnline = localStorage.getItem('show_online') !== '0';
        if(!showOnline) return; // privacy toggle off — user opted out of presence
        var sess = supabase.auth.getSession();
        if(sess && sess.then){ sess.then(function(r){
          if(r.data && r.data.session && r.data.session.user){
            supabase.from('profiles').update({is_online:false,last_seen:new Date().toISOString()}).eq('id',r.data.session.user.id).then(function(){});
          }
        });}
      }catch(e){}
    }
    // Named handler so the cleanup actually unbinds it (anonymous fn leaks per remount).
    function onVisibilityHidden(){ if(document.visibilityState==='hidden') markOffline(); }
    window.addEventListener('pagehide', markOffline);
    window.addEventListener('visibilitychange', onVisibilityHidden);
    return function() {
      if(sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
      window.removeEventListener('pagehide', markOffline);
      window.removeEventListener('visibilitychange', onVisibilityHidden);
    };
  }, []);

  // R15 FIX #5: app-level restricted-users set so the global badge listener
  // can suppress badge bumps + notification sound from restricted senders.
  // Mirrored into a ref because the badge channel useEffect deps are
  // [appUserId] only and would otherwise read a stale snapshot.
  var appRestrictedSetRef = useRef(new Set());
  useEffect(function(){
    if(!appUserId) return;
    function load(){
      try {
        supabase.from('restricted_users').select('restricted_id').eq('restrictor_id', appUserId).then(function(r){
          if (r && !r.error && r.data) {
            appRestrictedSetRef.current = new Set(r.data.map(function(x){ return x.restricted_id; }));
          }
        });
      } catch(_) {}
    }
    load();
    window.addEventListener('ringin:restricted-changed', load);
    return function(){ window.removeEventListener('ringin:restricted-changed', load); };
  },[appUserId]);

  // ── Global message badge listener — always active regardless of tab ──
  useEffect(function(){
    if(!appUserId) return;
    // Load initial unread count from DB
    supabase.from('messages').select('id',{count:'exact',head:true})
      .eq('receiver_id',appUserId).eq('read',false)
      .then(function(r){ if(r.count!=null) setUnreadMsg(r.count); });
    // Realtime: increment badge when new message arrives
    var ch = supabase.channel('app-inbox-badge-'+appUserId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'receiver_id=eq.'+appUserId},function(p){
        // R15 FIX #5: silent for restricted senders — no badge bump, no sound.
        if (p && p.new && appRestrictedSetRef.current.has(p.new.sender_id)) return;
        // Don't increment if user is currently on messages tab (MessagesScreen handles it there)
        setActiveTab(function(currentTab){
          if(currentTab !== 'messages'){
            setUnreadMsg(function(prev){ return prev+1; });
            var mc=[]; try{var ms=localStorage.getItem('ringin_muted_convos');if(ms)mc=JSON.parse(ms);}catch(e){}
            if(!mc.includes(p.new.conversation_id)) playSound('notification');
          }
          return currentTab;
        });
      })
      .subscribe();
    return function(){ supabase.removeChannel(ch); };
  },[appUserId]);

  // Notification count for the bell badge (independent from messages)
  useEffect(function(){
    if(!appUserId) return;
    supabase.from('notifications').select('id',{count:'exact',head:true})
      .eq('user_id',appUserId).eq('read',false)
      .then(function(r){ if(r.count!=null) setUnreadNotif(r.count); });
    var ch = supabase.channel('app-notif-badge-'+appUserId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+appUserId},function(){
        setUnreadNotif(function(prev){return prev+1;});
      })
      .subscribe();
    return function(){ supabase.removeChannel(ch); };
  },[appUserId]);

  // Refs that always reflect current state (avoids stale-closure bugs in subscription callbacks)
  var activeCallRef = useRef(null);
  var incomingCallRef = useRef(null);
  var dismissedInvitesRef = useRef(new Set());  // invites we've already handled — never re-show
  var outgoingPendingRef = useRef(false);       // double-tap guard for outgoing call button
  /* R34: track anon call context so we can dispatch a 'ringin:anoncallend'
   * event when the call ends — AnonymousConnect listens and saves a row to
   * anon_call_logs. Cleared in the onEnd handler. */
  var anonCallContextRef = useRef(null);
  /* R37: ANON_AVATAR_LOOKUP imported from utils/anonAvatars (was duplicated
   * here with different emoji/gradient values — caused caller and callee
   * to see different avatars for the same person). Now both screens
   * literally share the same JavaScript object. */
  useEffect(function(){ activeCallRef.current = activeCall; },[activeCall]);
  useEffect(function(){ incomingCallRef.current = incomingCall; },[incomingCall]);

  // Incoming Agora call — listen for call_invites rows where callee_id = me with status='ringing'.
  useEffect(function(){
    if(!appUserId) return;

    function handleInvite(inv){
      if(!inv || inv.status !== 'ringing') return;
      // Stale invites (>5min old) — caller has given up.
      // R11 FIX #1: tolerate clock skew. If user clock is BEHIND server
      // (rawAge negative — server timestamp is "future"), treat as fresh
      // instead of dropping. If user clock is AHEAD by minutes, the old
      // 60s window would drop legit calls — widen to 5 min for safety.
      try{
        var rawAge = Date.now() - new Date(inv.created_at).getTime();
        var ageMs = rawAge < 0 ? 0 : rawAge;
        if(ageMs > 5 * 60 * 1000) return;
      }catch(e){}
      // Never re-show a previously dismissed/accepted/rejected invite
      if(dismissedInvitesRef.current.has(inv.id)) return;
      // Don't ring during an active call
      if(activeCallRef.current) return;
      // Already showing THIS invite? don't re-trigger
      if(incomingCallRef.current && incomingCallRef.current.id === inv.id) return;
      setIncomingCall(inv);
    }

    console.log('[ringin] subscribing to call_invites for callee_id =', appUserId);
    // STRICT FILTER on realtime — only deliver rows where callee_id matches my auth.uid.
    // Combined with the strict-filtered polling fallback below, only the intended
    // recipient gets the ring. Critically: NO unfiltered subscription, or every signed-in
    // user receives every call.
    var ch = supabase.channel('app-call-invites-'+appUserId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'call_invites',filter:'callee_id=eq.'+appUserId},function(p){
        var inv = p && p.new;
        if(!inv || inv.status !== 'ringing') return;
        console.log('[ringin] call_invites INSERT (filtered):', inv.id);
        handleInvite(inv);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'call_invites',filter:'callee_id=eq.'+appUserId},function(p){
        var inv = p && p.new;
        if(!inv || inv.status !== 'ringing') return;
        console.log('[ringin] call_invites UPDATE (filtered):', inv.id);
        handleInvite(inv);
      })
      .subscribe(function(status){ console.log('[ringin] subscription status:', status); });

    // Initial check — anything ringing that's <30s old?
    supabase.from('call_invites')
      .select('*')
      .eq('callee_id', appUserId)
      .eq('status', 'ringing')
      .gte('created_at', new Date(Date.now() - 30000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .then(function(r){
        if(r && r.data && r.data[0]){
          console.log('[ringin] startup found a ringing invite', r.data[0]);
          handleInvite(r.data[0]);
        }
      });

    function pollOnce(){
      // FIX #12 — skip work when the tab is hidden. Polling kept running
      // every 4s indefinitely while the user was on another tab or had
      // the phone screen off; the visibilitychange handler below catches
      // any missed invites the moment the tab becomes visible again.
      if(typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      // Skip while on an active call or showing an incoming ring
      if(activeCallRef.current || incomingCallRef.current) return;
      // STRICT FILTER — only rows where I'm the callee. Combined with strict realtime,
      // only the intended user gets the ring.
      supabase.from('call_invites')
        .select('*')
        .eq('callee_id', appUserId)
        .eq('status', 'ringing')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .then(function(r){
          if(r && r.data && r.data[0]) handleInvite(r.data[0]);
        });
    }
    // Polling fallback — every 4s, catch anything realtime missed
    var pollIv = setInterval(pollOnce, 4000);

    // Immediate poll on visibility regain (unlocked phone, re-focused tab) — fires within 1s
    function onVisibility(){ if(document.visibilityState==='visible') pollOnce(); }
    function onFocus(){ pollOnce(); }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);

    return function(){
      try{ supabase.removeChannel(ch); }catch(e){}
      clearInterval(pollIv);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[appUserId]);

  // When an incoming-call modal is showing, watch its row for status changes —
  // if the caller cancels/ends, auto-dismiss the modal.
  useEffect(function(){
    if(!incomingCall || !incomingCall.id) return;
    var inviteId = incomingCall.id;
    var ch = supabase.channel('incoming-watch-'+inviteId)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'call_invites',filter:'id=eq.'+inviteId},function(p){
        var nw = p && p.new;
        if(!nw) return;
        if(nw.status !== 'ringing'){
          console.log('[ringin] incoming invite status changed to', nw.status, '— closing modal');
          dismissedInvitesRef.current.add(inviteId);
          setIncomingCall(null);
        }
      })
      .subscribe();
    // Also poll the row every 3s in case realtime drops the update
    var pollIv = setInterval(function(){
      supabase.from('call_invites').select('status').eq('id', inviteId).single().then(function(r){
        if(r && r.data && r.data.status !== 'ringing'){
          dismissedInvitesRef.current.add(inviteId);
          setIncomingCall(null);
        }
      });
    }, 3000);
    return function(){ try{ supabase.removeChannel(ch); }catch(e){} clearInterval(pollIv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[incomingCall && incomingCall.id]);

  function acceptIncomingCall(inv){
    // Mark this invite as handled IMMEDIATELY so polling doesn't re-show the modal
    dismissedInvitesRef.current.add(inv.id);
    setIncomingCall(null);
    // Update DB so the caller knows we accepted (also stops further ringing events)
    supabase.from('call_invites').update({status:'accepted', started_at: new Date().toISOString()}).eq('id', inv.id).then(function(){});
    /* R34: for anonymous calls, render the anon avatar emoji big in CallScreen
     * (ImgWithFallback uses expert.initials as the fallback text). Also stash
     * partner info so the call-end log save fires. */
    var isAnon = !!inv.is_anonymous;
    var anonAv = isAnon && inv.caller_avatar ? ANON_AVATAR_LOOKUP[inv.caller_avatar] : null;
    var initials = anonAv ? anonAv.emoji : safeInitials(inv.caller_name);
    var color = anonAv ? anonAv.bg : 'linear-gradient(135deg,#7B6EFF,#E84D9A)';
    if (isAnon) {
      anonCallContextRef.current = {
        startedAt: Date.now(),
        partner_id: inv.caller_id,
        partner_nickname: inv.caller_name || 'Anonymous',
        partner_avatar: inv.caller_avatar || null,
        partner_gender: null, /* not on the invite row; null is fine for log */
        wasCaller: false,
      };
    } else {
      anonCallContextRef.current = null;
    }
    setActiveCall({
      isIncoming: true,
      inviteId: inv.id,
      // Fall back to inv.id if channel is missing or still 'pending' (old caller stuck mid-update).
      // After the UUID pre-gen fix, channel always equals inv.id anyway.
      channel: (inv.channel && inv.channel !== 'pending') ? inv.channel : inv.id,
      expert: {
        id: inv.caller_id,
        name: inv.caller_name || 'User',
        img: null, /* anon callers don't have a real image URL */
        initials: initials,
        color: color,
        role: isAnon ? 'Anonymous Connect' : 'Member',
        rate: isAnon ? 0 : (inv.rate_per_min || 30),
        /* R35: pass partner-avatar id through so the CallScreen's
         * "View Profile" button has data to show. */
        _partnerAvatar: isAnon ? (inv.caller_avatar || null) : null,
        _partnerGender: null,
      },
    });
  }
  function startOutgoingCall(otherUser, opts){
    if(!appUserId) return;
    opts = opts || {};
    var rate = parseInt(opts.rate||otherUser.rate, 10) || 30;
    // 1) Pick the callee's REAL user UUID — NOT conversation_id. Some callers pass a convo
    //    object whose `id` is "<uuid1>_<uuid2>" (the convo id), so we prefer user-uuid
    //    fields first and only fall back to `id` if it actually looks like a UUID.
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var candidates = [otherUser.user_id, otherUser.otherId, otherUser.receiverId, otherUser.callee_id, otherUser.id];
    var calleeId = null;
    for(var i=0;i<candidates.length;i++){ if(candidates[i] && UUID_RE.test(String(candidates[i]))) { calleeId = candidates[i]; break; } }
    if(!calleeId){
      // Final polish: was alert() — non-blocking toast instead.
      toastWarn('Calls only work with real signed-in users (not demo experts).');
      return;
    }
    if(calleeId===appUserId){ toastWarn('You cannot call yourself.'); return; }
    var callerName = (session && session.user && session.user.email) ? (session.user.email.split('@')[0]||'You') : 'You';
    var callerAvatar = null;
    try{ callerAvatar = localStorage.getItem('avatar_'+appUserId)||null; }catch(e){}
    /* R33 BUG FIX: anonymous call name leak.
     * Without this, when AnonymousConnect started a call, the call_invites
     * row was populated with the caller's REAL name from their email/profile.
     * IncomingCallModal then showed the real name to the callee — breaking
     * the whole "anonymous" promise. Now: if opts.anonymous, override the
     * stored caller name + avatar with what the anon-profile UI passed in
     * via target.name / target.avatar (those carry the nickname + avatar id). */
    var isAnonCall = !!(opts && opts.anonymous);
    /* R57: paidHostCall = anonymous identity (nickname/avatar) + paid rate.
     * Used by the FRND-style host browser/random-host flows. We still
     * override caller_name with the anon nickname so identity stays hidden,
     * but is_anonymous in call_invites stays FALSE so deduct_call_coins
     * runs the per-minute charge + credits the host 40% as neons. */
    var isPaidHostCall = !!(opts && opts.paidHostCall);
    if (isAnonCall || isPaidHostCall) {
      callerName = (otherUser && otherUser._myNickname) || 'Anonymous';
      callerAvatar = (otherUser && otherUser._myAvatar) || null;
      /* R34: stash partner info so onEnd can save a call log row.
       * R59: also carry is_paid_host_call + invite_id (filled below after
       * we generate inviteUuid) so the post-call sheet knows to show the
       * 5-star host rating widget. */
      anonCallContextRef.current = {
        startedAt: Date.now(),
        partner_id: calleeId,
        partner_nickname: (otherUser && otherUser.name) || 'Anonymous',
        partner_avatar: (otherUser && otherUser._partnerAvatar) || null,
        partner_gender: (otherUser && otherUser._partnerGender) || null,
        wasCaller: true,
        is_paid_host_call: isPaidHostCall,
        invite_id: null, /* filled in below once inviteUuid exists */
      };
    } else {
      anonCallContextRef.current = null;
    }
    /* R57: is_anonymous flag controls whether deduct_call_coins runs.
     * Only TRUE for free anon calls (matchmaker). Paid host calls go through
     * with full charging despite using anon nicknames. */
    var isAnonInDb = isAnonCall && !isPaidHostCall;
    // Double-tap guard — don't fire two inserts for one button press
    if(activeCallRef.current){ console.log('[ringin] startOutgoingCall ignored — already on a call'); return; }
    if(outgoingPendingRef.current){ console.log('[ringin] startOutgoingCall ignored — already pending'); return; }
    // R12 FIX #4: also guard against stacking an outgoing call on top of a
    // ringing incoming one — otherwise the user who taps "Call" while their
    // phone is ringing ends up with two `calls` rows and both UIs fight.
    if(incomingCallRef.current){ console.log('[ringin] startOutgoingCall ignored — incoming ring active'); return; }
    outgoingPendingRef.current = true;

    // CRITICAL: pre-generate the invite UUID client-side and use it as BOTH the row id
    // AND the Agora channel name. This eliminates the channel='pending' → channel=inv.id
    // race condition that left caller and callee on different Agora channels (caller
    // stuck on 'Ringing', callee stuck on 'Connecting' forever).
    var inviteUuid;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      inviteUuid = crypto.randomUUID();
    } else {
      inviteUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
        var r = Math.random()*16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    /* R59: backfill invite_id into anon-call context so the rating RPC
     * can attach the rating to the specific call. */
    if (anonCallContextRef.current) {
      anonCallContextRef.current.invite_id = inviteUuid;
    }

    // Optimistic UI — show "Calling..." instantly with the REAL channel ready.
    setActiveCall({
      isIncoming: false,
      inviteId: inviteUuid,
      channel: inviteUuid,
      expert: Object.assign({}, otherUser, {rate: rate}),
    });

    var payload = {
      id: inviteUuid,            // explicit UUID so Postgres uses it as PK
      caller_id: appUserId,
      caller_name: callerName,
      caller_avatar: callerAvatar,
      callee_id: calleeId,
      callee_name: otherUser.name || null,
      callee_avatar: otherUser.img || otherUser.avatar_url || null,
      channel: inviteUuid,       // same UUID — both sides agree, no race
      status: 'ringing',
      rate_per_min: rate,
      /* R33: tag anonymous calls so the callee UI can show the anonymous
       * badge instead of treating it like a regular expert call.
       * R57: paid host calls use anon nicknames but are NOT marked
       * is_anonymous, so deduct_call_coins charges them. */
      is_anonymous: isAnonInDb,
    };
    console.log('[ringin] inserting call_invite', payload);
    supabase.from('call_invites').insert(payload).then(function(r){
      outgoingPendingRef.current = false;
      if(r.error){
        console.error('[ringin] call_invites insert failed:', r.error);
        setActiveCall(null);
        /* R62: reverse-call race. The 0042 partial unique index rejects
         * a second ringing invite between the same pair with code 23505
         * (unique_violation). Translate this into a helpful toast and
         * point the user to the incoming ringer instead of a confusing
         * generic "permission" error. */
        var msg = (r.error.message || '').toLowerCase();
        var isReverseRace = (r.error.code === '23505') ||
          /unique|duplicate|call_invites_ringing_pair/i.test(msg);
        if (isReverseRace) {
          toastInfo('They are calling you — answer the incoming ring');
        } else {
          // Final polish: was alert() — non-blocking toast.
          toastError('Could not start call: '+(r.error.message||'permission'));
        }
        return;
      }
      console.log('[ringin] call_invite inserted', inviteUuid);
      // ── Fire FCM push so the callee rings even with PWA closed/locked.
      // Best-effort: failure here doesn't abort the call (the realtime
      // listener will still fire when the callee's PWA is open). Silently
      // swallow errors — they're already logged server-side.
      try{
        // Absolute URL so this also works in native Capacitor APK
        // (where '/api/...' resolves to 'https://localhost/...' = nothing).
        // In PWA, absolute URL is identical to the relative one.
        fetch((process.env.REACT_APP_API_BASE_URL || 'https://ring-in.vercel.app') + '/api/send-call-push', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({
            invite_id: inviteUuid,
            callee_id: calleeId,
            caller_name: callerName,
            caller_avatar: callerAvatar,
          }),
          keepalive: true,    // let it complete even if the page navigates
        }).catch(function(e){ console.warn('[ringin] push trigger failed:', e && e.message); });
      }catch(e){ /* never block the call */ }
    });
  }
  // Expose to window so any nested component can call it without prop-drilling
  useEffect(function(){
    window.__ringInStartCall = function(u, opts){ startOutgoingCall(u, opts||{}); };
    // Debug helper — paste `__ringInDebug()` in the Eruda console to see everything
    window.__ringInDebug = function(){
      console.log('========= RINGIN DEBUG =========');
      console.log('My user id (appUserId):', appUserId);
      console.log('My email:', session && session.user ? session.user.email : '(no session)');
      supabase.from('call_invites').select('*').eq('callee_id', appUserId).order('created_at',{ascending:false}).limit(5).then(function(r){
        console.log('Last 5 invites WHERE callee_id = me:', r.data, 'error:', r.error);
      });
      supabase.from('call_invites').select('*').eq('caller_id', appUserId).order('created_at',{ascending:false}).limit(5).then(function(r){
        console.log('Last 5 invites WHERE caller_id = me:', r.data, 'error:', r.error);
      });
      supabase.from('call_invites').select('id,caller_id,callee_id,status,created_at').order('created_at',{ascending:false}).limit(5).then(function(r){
        console.log('GLOBAL Last 5 invites (whatever RLS lets me see):', r.data, 'error:', r.error);
      });
      console.log('================================');
    };
    if(appUserId){ console.log('[ringin] my user id =', appUserId, '  (run __ringInDebug() to diagnose)'); }
    return function(){ try{ delete window.__ringInStartCall; delete window.__ringInDebug; }catch(e){} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId, session]);

  function openWallet() { setPrevTab(activeTab); setActiveTab('wallet'); }

  function goToTab(tab) { setActiveTab(tab); }

  var handleAuth = async function(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    // R16 FIX #1: handleAuth previously had no try/catch around the await
    // calls. If supabase.auth threw (network drop, DNS fail, etc.), the
    // function rejected before setLoading(false) ran, leaving the
    // "Please wait..." button stuck forever. Wrap each branch.
    if (isLogin) {
      try {
        var res = await supabase.auth.signInWithPassword({ email: email, password: password });
        if (res.error) { setMessage(res.error.message); setLoading(false); return; }
      } catch (e) {
        console.warn('[ringin] handleAuth signIn reject:', e);
        setMessage('Network error — try again');
        setLoading(false);
        return;
      }
    } else {
      try {
        var res2 = await supabase.auth.signUp({ email: email, password: password });
        if (res2.error) { setMessage(res2.error.message); setLoading(false); return; }
        setMessage('Account created! You can now log in.');
      } catch (e) {
        console.warn('[ringin] handleAuth signUp reject:', e);
        setMessage('Network error — try again');
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  };

  if (!session) {
    // R23: Forgot Password flow — when forgotMode is set, render the reset
    // screen instead of the login form. Lives inside the same `if(!session)`
    // branch so we don't accidentally route to the rest of the app.
    if (forgotMode) {
      var doSendReset = function(e){
        if (e && e.preventDefault) e.preventDefault();
        var addr = (email||'').trim();
        if (!addr) { setForgotErr('Enter your email'); return; }
        setForgotLoad(true); setForgotErr('');
        // R23: redirectTo uses the live web origin so the email link lands
        // somewhere we control. For native deep-link, App Links or a custom
        // scheme can be wired later — the appUrlOpen listener below already
        // re-routes any matching URL into the app.
        var redirect = (typeof window !== 'undefined' && window.location && window.location.origin)
          ? window.location.origin + '/reset-password'
          : 'https://ring-in.vercel.app/reset-password';
        supabase.auth.resetPasswordForEmail(addr, { redirectTo: redirect }).then(function(res){
          setForgotLoad(false);
          if (res.error) { setForgotErr(res.error.message || 'Could not send reset email'); return; }
          setForgotMode('sent');
        }).catch(function(err){
          setForgotLoad(false);
          console.warn('[ringin] forgot password reject:', err);
          setForgotErr('Network error — try again');
        });
      };
      return React.createElement('div', {className:'auth-container'},
        React.createElement('div', {className:'auth-box'},
          React.createElement('div', {className:'auth-logo'},
            React.createElement('span', {className:'logo-ring'}, 'Ring'),
            React.createElement('span', {className:'logo-in'}, 'In')
          ),
          React.createElement('p', {className:'auth-tagline'},
            forgotMode === 'sent' ? 'Check your inbox' : 'Reset your password'),
          forgotMode === 'sent'
            ? React.createElement('div', {style:{textAlign:'center',padding:'20px 8px'}},
                React.createElement('div', {style:{fontSize:'42px',marginBottom:'12px'}}, '📧'),
                React.createElement('p', {style:{fontSize:'14px',color:'var(--text)',marginBottom:'18px',lineHeight:1.5}},
                  'If an account exists for ', React.createElement('strong', null, email || 'that email'),
                  ', a reset link has been sent. Check your inbox (and spam folder).'),
                React.createElement('button', {
                  className:'auth-btn',
                  onClick:function(){ setForgotMode(false); setForgotErr(''); },
                }, 'Back to login')
              )
            : React.createElement(React.Fragment, null,
                React.createElement('p', {style:{fontSize:'13px',color:'rgba(255,255,255,0.7)',textAlign:'center',marginBottom:'14px'}},
                  'Enter the email you signed up with. We\'ll send you a link to reset your password.'),
                React.createElement('form', {onSubmit:doSendReset},
                  React.createElement('input', {className:'auth-input',type:'email',placeholder:'Email',value:email,onChange:function(e){setEmail(e.target.value);},required:true,autoFocus:true}),
                  React.createElement('button', {className:'auth-btn',type:'submit',disabled:forgotLoad},
                    forgotLoad ? 'Sending…' : 'Send reset link')
                ),
                forgotErr ? React.createElement('p', {className:'auth-message'}, forgotErr) : null,
                React.createElement('p', {className:'auth-switch',onClick:function(){ setForgotMode(false); setForgotErr(''); }},
                  '← Back to login')
              )
        )
      );
    }
    return React.createElement('div', {className:'auth-container'},
      React.createElement('div', {className:'auth-box'},
        React.createElement('div', {className:'auth-logo'},
          React.createElement('span', {className:'logo-ring'}, 'Ring'),
          React.createElement('span', {className:'logo-in'}, 'In')
        ),
        React.createElement('p', {className:'auth-tagline'}, 'Connect with expert minds, instantly.'),
        React.createElement('form', {onSubmit:handleAuth},
          React.createElement('input', {className:'auth-input',type:'email',placeholder:'Email',value:email,onChange:function(e){setEmail(e.target.value);},required:true}),
          // R23: password input now has a show/hide eye toggle wrapper.
          React.createElement('div', {style:{position:'relative',width:'100%'}},
            React.createElement('input', {
              className:'auth-input',
              type: showPw ? 'text' : 'password',
              placeholder:'Password',
              value:password,
              onChange:function(e){setPassword(e.target.value);},
              required:true,
              style:{paddingRight:'48px',width:'100%',boxSizing:'border-box'}
            }),
            React.createElement('button', {
              type:'button',
              onClick:function(){ setShowPw(!showPw); },
              'aria-label': showPw ? 'Hide password' : 'Show password',
              style:{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'transparent',border:'none',color:'rgba(255,255,255,0.7)',cursor:'pointer',padding:'6px 10px',fontSize:'13px',fontFamily:'inherit'}
            }, showPw ? 'Hide' : 'Show')
          ),
          React.createElement('button', {className:'auth-btn',type:'submit',disabled:loading}, loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up')
        ),
        message ? React.createElement('p', {className:'auth-message'}, message) : null,
        // R23: Forgot Password — only on Login mode, since Sign Up users
        // haven't set a password they could forget yet.
        isLogin ? React.createElement('p', {
          className:'auth-switch',
          onClick:function(){ setForgotMode('enter'); setForgotErr(''); setMessage(''); },
          style:{marginTop:'6px',fontSize:'13px',opacity:0.85}
        }, 'Forgot password?') : null,
        React.createElement('p', {className:'auth-switch',onClick:function(){setIsLogin(!isLogin); setMessage('');}},
          isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'
        )
      )
    );
  }

  function renderScreen() {
    if (viewUserStack.length > 0) return React.createElement(UserProfileView, {
      user:viewUserStack[viewUserStack.length-1],
      sbHome:supabase,
      currentUserId:appUserId,
      session:session,
      following:appFollowing,
      toggleFollow:appToggleFollow,
      onBack:popViewUser,
      onViewUser:pushViewUser,
      onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');setViewUserStack([]);}
    });
    if (activeTab === 'home') return React.createElement(HomeScreen, {session:session, supabase:supabase, onViewExpert:function(exp){setSelectedExpert(exp);setActiveTab('search');}, onOpenWallet:openWallet, onGoToProfile:function(){setActiveTab('profile');}, onOpenProfile:function(){setPrevTab('home');setActiveTab('profile');}, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}, onGoToSearch:function(){setPrevTab('home');setActiveTab('search');}, onOpenSaved:function(){setPrevTab('home');setActiveTab('saved');}, onOpenConnect:function(){setPrevTab('home');setActiveTab('connect');}});
    if (activeTab === 'search') return React.createElement(SearchScreen, {key:selectedExpert?selectedExpert.id:'search', initExpert:selectedExpert, session:session, onClearExpert:function(){setSelectedExpert(null);}, onBack:function(){setSelectedExpert(null);setActiveTab(prevTab);}, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('search');setActiveTab('profile');}, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}});
    if (activeTab === 'workshops') return React.createElement(WorkshopsScreen, {session:session, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('workshops');setActiveTab('profile');}});
    /* R63: new Real Friends tab — replaces Workshops in the bottom nav.
     * Workshops screen kept as a dead route in case we want to bring it
     * back later, but no nav button surfaces it anymore.
     * R64.10: onViewUser wired so tapping the avatar/name inside the
     * Friends profile-summary modal pushes a full UserProfileView. */
    if (activeTab === 'friends') return React.createElement(FriendsScreen, {session:session, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('friends');setActiveTab('profile');}, onViewUser:pushViewUser, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}});
    /* R20 FIX #7: removed key='messages-'+msgResetKey to avoid remount race.
     * When user taps Messages tab while already on Messages, React-18's stable-
     * parent reconciliation could mount the NEW MessagesScreen BEFORE the old
     * one's cleanup ran — two Supabase realtime channels with identical names
     * would collide, then cleanup of the OLD instance would remove the channel
     * the NEW instance had just adopted, breaking realtime until next nav.
     * Now: tap-while-on-tab dispatches a window event the existing MessagesScreen
     * consumes in-place (scroll-to-top + close any open chat). No remount. */
    if (activeTab === 'messages') return React.createElement(MessagesScreen, {key:'messages', session:session, initConvo:initConvo, onConvoConsumed:function(){setInitConvo(null);}, onViewExpert:function(exp){setSelectedExpert(exp);setPrevTab('messages');setActiveTab('search');}, onViewUser:pushViewUser, onOpenWallet:openWallet, onOpenProfile:function(){setPrevTab('messages');setActiveTab('profile');}, onUnreadCount:setUnreadMsg});
    if (activeTab === 'profile') return React.createElement(ProfileScreen, {session:session, supabase:supabase, onOpenWallet:openWallet, onGoToMessages:function(convo){setInitConvo(convo);setActiveTab('messages');}, onViewUser:function(u){setViewUserStack([u]);}, onSwitchTab:function(t){setActiveTab(t);}});
    if (activeTab === 'wallet') return React.createElement(WalletScreen, {session:session, onBack:function(){setActiveTab(prevTab);}});
    if (activeTab === 'saved') return React.createElement(SavedPostsScreen, {session:session, onBack:function(){setActiveTab(prevTab);}, onViewUser:pushViewUser});
    if (activeTab === 'connect') return React.createElement(AnonymousConnect, {session:session, onBack:function(){setActiveTab(prevTab);}});
    return React.createElement(HomeScreen, {session:session, onOpenWallet:openWallet});
  }

  /* R63: Final nav layout — Home / Friends / Experts / Messages.
   *  - Friends takes the 2nd slot (was Experts) — primary growth bet
   *    per the Phase 1 research, where the diaspora "find my community"
   *    pattern is the strongest documented demand signal.
   *  - Experts moves to the 3rd slot (was Workshops) — still monetized,
   *    just less prominent.
   *  - Workshops removed entirely from the nav. The screen + route still
   *    exist for potential future re-introduction (e.g. via a deep link
   *    or a profile menu entry), but no nav button surfaces it. */
  var tabs = [
    {id:'home',     label:'Home',     svg:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'},
    {id:'friends',  label:'Friends',  svg:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'},
    {id:'search',   label:'Experts',  svg:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'},
    {id:'messages', label:'Messages', svg:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'},
  ];

  // Avatar for top bar (cached from localStorage)
  var avatarTopUrl = appUserId ? (localStorage.getItem('avatar_'+appUserId) || null) : null;
  var avatarInitial = session && session.user && session.user.email ? session.user.email.charAt(0).toUpperCase() : 'U';

  return React.createElement('div', {
    className:'app-container',
    // ── Swipe-back gesture ────────────────────────────────────────────────
    // Standard iOS / Android pattern: touch starts within ~28px of the LEFT
    // edge of the screen, then swipes RIGHT. We deliberately require the
    // start to be near the left edge so inner horizontal swipes (carousels,
    // photo galleries, message swipe-actions) keep working without conflict.
    // Disabled during active or incoming calls so a stray swipe can't
    // accidentally tear down a live call.
    onTouchStart:function(e){
      if(activeCall || incomingCall){ window._swX = -1; return; }
      // Bail out when the touch starts inside any horizontally-scrollable
      // ancestor — carousels (.frow, .cats, expert pills) need to be able
      // to handle a rightward drag from their left edge without us hijacking
      // it for back-navigation.
      try{
        var node = e.target;
        while(node && node !== document.body){
          // ROUND-9 FIX #6: use the WeakMap-cached helper instead of
          // running getComputedStyle on every touchstart.
          if(isHorizontalScrollAncestor(node)){
            window._swX = -1;
            return;
          }
          node = node.parentElement;
        }
      }catch(_){}
      window._swX = e.touches[0].clientX;
      window._swY = e.touches[0].clientY;
    },
    onTouchEnd:function(e){
      var startX = window._swX;
      if(typeof startX !== 'number' || startX < 0) return;
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dy = Math.abs(endY - (window._swY||0));
      var screenW = window.innerWidth;
      var EDGE = 28;        // start zone (px from left edge)
      var MIN_DX = Math.max(80, screenW*0.22); // min rightward travel
      var dx = endX - startX;
      // Reset for safety so a stale value doesn't trigger next time
      window._swX = -1;

      if(startX > EDGE) return;       // didn't start near the left edge
      if(dx < MIN_DX) return;          // didn't swipe far enough right
      if(dy > 80) return;              // too vertical — was probably a scroll

      // Delegate to the single source of truth — same priority chain the
      // Android hardware back button uses.
      goBack();
    }
  },
    // Global top bar removed — each screen renders its own header (RingIn/Workshops/Experts/...) with coin + bell + avatar
    React.createElement('div', {className:'screen-content',
      /* floating nav is position:fixed (out of flow) so the scroll area
       * needs bottom clearance or the last items hide behind the capsule.
       * Covers browser + PWA (overrides the .screen-content PWA 80px). */
      style:{paddingBottom:'calc(96px + env(safe-area-inset-bottom, 0px))'}},
      React.createElement(ErrorBoundary, { scope: activeTab + ' tab' }, renderScreen())
    ),

    // ── Active call overlay (above bottom nav) ──
    // Wrapped in ErrorBoundary so a crash in the call UI ends the call
    // gracefully instead of blanking the entire app while audio is live.
    activeCall ? React.createElement('div',{style:{position:'fixed',inset:0,zIndex:900,background:'var(--bg)'}},
      React.createElement(ErrorBoundary, {
        scope: 'call',
        onError: function(){ try { setActiveCall(null); } catch(_){} },
      },
        React.createElement(CallScreen, {
          expert: activeCall.expert,
          session: session,
          inviteId: activeCall.inviteId,
          channel: activeCall.channel,
          isIncoming: !!activeCall.isIncoming,
          // FIX #8: pass per-user cached balance fallback. With the
          // per-user cache in coinBalance.js, getCachedCoinBalance(appUserId)
          // returns the right user's last known coins even if the hook
          // hasn't fetched yet — preventing the 0-initial coin disaster
          // where CallScreen mounts with localCoins=0 and the per-second
          // tick immediately fires hangup('no_coins'). CallScreen now has
          // its own guard too, but this belt-and-braces approach gives it
          // a real number to start with.
          coins: appCoinBal || getCachedCoinBalance(appUserId) || 0,
          onCoinsChange: function(){},
          onEnd: function(){
            /* R34: if this was an anonymous call, fire a window event so
             * AnonymousConnect can save the call log + refresh the Call Logs tab. */
            try {
              var ctx = anonCallContextRef.current;
              if (ctx) {
                var dur = Math.max(0, Math.round((Date.now() - ctx.startedAt) / 1000));
                window.dispatchEvent(new CustomEvent('ringin:anoncallend', { detail: Object.assign({}, ctx, { duration_seconds: dur }) }));
                anonCallContextRef.current = null;
              }
            } catch(e){ console.warn('[ringin] anon call-end dispatch failed:', e); }
            setActiveCall(null);
          },
        })
      )
    ) : null,

    // ── Incoming call ring overlay (above the active-call overlay shouldn't happen because we suppress incoming when activeCall) ──
    incomingCall ? React.createElement(IncomingCallModal, {
      invite: incomingCall,
      session: session,
      onAccept: acceptIncomingCall,
      onReject: function(){
        if(incomingCall && incomingCall.id) dismissedInvitesRef.current.add(incomingCall.id);
        setIncomingCall(null);
      },
    }) : null,

    // ── PWA install prompt — non-intrusive bottom pill, dismissible, hidden when
    //    already running standalone, hidden during an active or incoming call.
    !activeCall && !incomingCall ? React.createElement(InstallPrompt, null) : null,

    // ── PWA update prompt — appears when a new SW version is waiting. Tapping
    //    Update fires SKIP_WAITING + reload so users get fresh code in one tap
    //    (instead of having to fully close + reopen the PWA). Suppressed during
    //    a live call so we never reload mid-conversation.
    !activeCall && !incomingCall ? React.createElement(UpdatePrompt, null) : null,

    /* Frosty Fluid Glass floating nav — translucent droplet follows the
     * finger/cursor across the bar and settles on the selected tab. */
    React.createElement(FrostyFluidGlassNav, {
      tabs: tabs,
      activeTab: activeTab,
      unreadMsg: unreadMsg,
      connectActive: activeTab === 'connect',
      onSelectTab: function(tabId){
        if(tabId==='messages' && activeTab==='messages'){ try { window.dispatchEvent(new CustomEvent('ringin:messages-reset')); } catch(_){} }
        if(tabId==='messages'){ setUnreadMsg(0); }
        setPrevTab('home');
        setActiveTab(tabId);
        if (viewUserStack && viewUserStack.length > 0) setViewUserStack([]);
      },
      onOrb: function(){
        setPrevTab(activeTab);
        setActiveTab('connect');
        if (viewUserStack && viewUserStack.length > 0) setViewUserStack([]);
      }
    })
  );
}
