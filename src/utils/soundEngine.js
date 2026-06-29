/* eslint-disable */
// ─── RingIn Central Sound Engine ───────────────────────────────────────────
var _sCtx=null;
export function getSCtx(){
  if(!_sCtx){try{_sCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(_sCtx&&_sCtx.state==='suspended'){try{_sCtx.resume();}catch(e){}}
  return _sCtx;
}

var DEFAULT_PREFS={
  typing:      {variant:0,volume:0.55,enabled:true},
  emoji:       {variant:0,volume:0.55,enabled:true},
  send:        {variant:0,volume:0.55,enabled:true},
  like:        {variant:0,volume:0.55,enabled:true},
  likeThumb:   {variant:0,volume:0.55,enabled:true},
  notification:{variant:0,volume:0.55,enabled:true},
};

// Deep-merge stored prefs with DEFAULT_PREFS per-key so a partial save like
// {like:{enabled:false}} doesn't accidentally wipe volume/variant for other keys
// and doesn't strip the `enabled:true` defaults from untouched keys.
export function getSoundPrefs(){
  var out = {};
  try{
    Object.keys(DEFAULT_PREFS).forEach(function(k){ out[k] = Object.assign({}, DEFAULT_PREFS[k]); });
    var s = localStorage.getItem('ringin_sound_prefs');
    if(s){
      var parsed = JSON.parse(s) || {};
      Object.keys(parsed).forEach(function(k){
        if(parsed[k] && typeof parsed[k] === 'object'){
          out[k] = Object.assign({}, out[k] || DEFAULT_PREFS[k] || {}, parsed[k]);
        }
      });
    }
  }catch(e){}
  return out;
}
export function saveSoundPrefs(prefs){
  try{localStorage.setItem('ringin_sound_prefs',JSON.stringify(prefs));}catch(e){}
}

// ─── HAPTICS ───────────────────────────────────────────────────────────────
export function getHapticsEnabled(){
  try{return localStorage.getItem('ringin_haptics')!=='0';}catch(e){return true;}
}
export function setHapticsEnabled(val){
  try{localStorage.setItem('ringin_haptics',val?'1':'0');}catch(e){}
}
// Vibrate only if haptics pref is on and device supports it
export function hapticPulse(pattern){
  if(!getHapticsEnabled())return;
  try{if(typeof navigator!=='undefined' && navigator.vibrate)navigator.vibrate(pattern);}catch(e){}
}
// Force-vibrate (used by Settings "Test Haptic" button — ignores pref so user can verify hardware).
// Returns true if the vibrate call was attempted, false if API unsupported (e.g. iOS Safari).
export function forceHaptic(pattern){
  try{
    if(typeof navigator==='undefined' || !navigator.vibrate) return false;
    navigator.vibrate(pattern || [40]);
    return true;
  }catch(e){ return false; }
}
// Detector for UI hint — true on Android Chrome / most non-iOS; false on iOS Safari / desktop browsers.
export function isHapticSupported(){
  try{ return !!(typeof navigator!=='undefined' && navigator.vibrate); }catch(e){ return false; }
}

// ─── TYPING ────────────────────────────────────────────────────────────────
var TYPING_VARIANTS=[
  function crystal(ctx,vol){// Crystal — bandpass noise
    var buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.05),ctx.sampleRate);
    var d=buf.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    var src=ctx.createBufferSource();src.buffer=buf;
    var bpf=ctx.createBiquadFilter();bpf.type='bandpass';bpf.frequency.value=3200;bpf.Q.value=2.5;
    var g=ctx.createGain();src.connect(bpf);bpf.connect(g);g.connect(ctx.destination);
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol*0.11,ctx.currentTime+0.003);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.048);
    src.start();src.stop(ctx.currentTime+0.05);
  },
  function softTap(ctx,vol){// Soft Tap — low-freq noise
    var buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.058),ctx.sampleRate);
    var d=buf.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    var src=ctx.createBufferSource();src.buffer=buf;
    var bpf=ctx.createBiquadFilter();bpf.type='bandpass';bpf.frequency.value=1400;bpf.Q.value=1.8;
    var g=ctx.createGain();src.connect(bpf);bpf.connect(g);g.connect(ctx.destination);
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol*0.13,ctx.currentTime+0.005);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.054);
    src.start();src.stop(ctx.currentTime+0.06);
  },
  function classicClick(ctx,vol){// Classic Click — sine tone
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(1100,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(700,ctx.currentTime+0.04);
    g.gain.setValueAtTime(vol*0.12,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.055);
    o.start();o.stop(ctx.currentTime+0.06);
  }
];

// ─── EMOJI TAP ─────────────────────────────────────────────────────────────
var EMOJI_VARIANTS=[
  function chime(ctx,vol){
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(1400,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1000,ctx.currentTime+0.05);
    g.gain.setValueAtTime(vol*0.12,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.07);
    o.start();o.stop(ctx.currentTime+0.07);
  },
  function bubble(ctx,vol){
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(420,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(900,ctx.currentTime+0.06);
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol*0.16,ctx.currentTime+0.010);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.08);
    o.start();o.stop(ctx.currentTime+0.09);
  },
  function sparkle(ctx,vol){
    [[0,1600,2100],[0.03,2000,2600]].forEach(function(p){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(p[1],ctx.currentTime+p[0]);
      o.frequency.exponentialRampToValueAtTime(p[2],ctx.currentTime+p[0]+0.06);
      g.gain.setValueAtTime(vol*0.09,ctx.currentTime+p[0]);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+p[0]+0.07);
      o.start(ctx.currentTime+p[0]);o.stop(ctx.currentTime+p[0]+0.08);
    });
  }
];

// ─── SEND / POST ───────────────────────────────────────────────────────────
var SEND_VARIANTS=[
  function swoosh(ctx,vol){
    var sw=ctx.createOscillator();var swg=ctx.createGain();
    sw.connect(swg);swg.connect(ctx.destination);
    sw.type='sine';sw.frequency.setValueAtTime(380,ctx.currentTime);
    sw.frequency.exponentialRampToValueAtTime(980,ctx.currentTime+0.18);
    swg.gain.setValueAtTime(0,ctx.currentTime);
    swg.gain.linearRampToValueAtTime(vol*0.18,ctx.currentTime+0.07);
    swg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.20);
    sw.start();sw.stop(ctx.currentTime+0.20);
    var tk=ctx.createOscillator();var tkg=ctx.createGain();
    tk.connect(tkg);tkg.connect(ctx.destination);
    tk.type='sine';tk.frequency.setValueAtTime(1600,ctx.currentTime+0.14);
    tk.frequency.exponentialRampToValueAtTime(2200,ctx.currentTime+0.24);
    tkg.gain.setValueAtTime(0,ctx.currentTime+0.14);
    tkg.gain.linearRampToValueAtTime(vol*0.14,ctx.currentTime+0.18);
    tkg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.30);
    tk.start(ctx.currentTime+0.14);tk.stop(ctx.currentTime+0.30);
  },
  function launch(ctx,vol){
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='triangle';o.frequency.setValueAtTime(200,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1400,ctx.currentTime+0.14);
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol*0.22,ctx.currentTime+0.04);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.16);
    o.start();o.stop(ctx.currentTime+0.16);
    var o2=ctx.createOscillator();var g2=ctx.createGain();
    o2.connect(g2);g2.connect(ctx.destination);
    o2.type='sine';o2.frequency.setValueAtTime(2400,ctx.currentTime+0.10);
    o2.frequency.exponentialRampToValueAtTime(2800,ctx.currentTime+0.22);
    g2.gain.setValueAtTime(vol*0.09,ctx.currentTime+0.10);
    g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.24);
    o2.start(ctx.currentTime+0.10);o2.stop(ctx.currentTime+0.25);
  },
  function shimmer(ctx,vol){
    [[0,660,0.22],[0.04,880,0.18],[0.08,1100,0.14]].forEach(function(p){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(p[1],ctx.currentTime+p[0]);
      o.frequency.exponentialRampToValueAtTime(p[1]*1.15,ctx.currentTime+p[0]+0.22);
      g.gain.setValueAtTime(0,ctx.currentTime+p[0]);
      g.gain.linearRampToValueAtTime(vol*p[2],ctx.currentTime+p[0]+0.03);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+p[0]+0.28);
      o.start(ctx.currentTime+p[0]);o.stop(ctx.currentTime+p[0]+0.30);
    });
  }
];

// ─── HEART LIKE RELEASE ────────────────────────────────────────────────────
var LIKE_VARIANTS=[
  function heartbeat(ctx,vol){
    var o1=ctx.createOscillator();var g1=ctx.createGain();
    o1.connect(g1);g1.connect(ctx.destination);
    o1.type='sine';o1.frequency.setValueAtTime(90,ctx.currentTime);
    g1.gain.setValueAtTime(vol*0.28,ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.20);
    o1.start();o1.stop(ctx.currentTime+0.20);
    var o2=ctx.createOscillator();var g2=ctx.createGain();
    o2.connect(g2);g2.connect(ctx.destination);
    o2.type='sine';o2.frequency.setValueAtTime(680,ctx.currentTime+0.05);
    o2.frequency.exponentialRampToValueAtTime(960,ctx.currentTime+0.30);
    g2.gain.setValueAtTime(vol*0.18,ctx.currentTime+0.05);
    g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.36);
    o2.start(ctx.currentTime+0.05);o2.stop(ctx.currentTime+0.36);
    var o3=ctx.createOscillator();var g3=ctx.createGain();
    o3.connect(g3);g3.connect(ctx.destination);
    o3.type='sine';o3.frequency.setValueAtTime(1320,ctx.currentTime+0.13);
    o3.frequency.exponentialRampToValueAtTime(1680,ctx.currentTime+0.28);
    g3.gain.setValueAtTime(vol*0.08,ctx.currentTime+0.13);
    g3.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.32);
    o3.start(ctx.currentTime+0.13);o3.stop(ctx.currentTime+0.32);
  },
  function bloom(ctx,vol){
    [[0,220,0.24],[0.03,440,0.20],[0.07,660,0.16],[0.12,880,0.10]].forEach(function(p){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(p[1],ctx.currentTime+p[0]);
      o.frequency.exponentialRampToValueAtTime(p[1]*1.02,ctx.currentTime+p[0]+0.35);
      g.gain.setValueAtTime(0,ctx.currentTime+p[0]);
      g.gain.linearRampToValueAtTime(vol*p[2],ctx.currentTime+p[0]+0.04);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+p[0]+0.40);
      o.start(ctx.currentTime+p[0]);o.stop(ctx.currentTime+p[0]+0.42);
    });
  },
  function flutter(ctx,vol){
    [0,0.06,0.11,0.16].forEach(function(t,i){
      var freq=600+i*280;
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(freq,ctx.currentTime+t);
      o.frequency.exponentialRampToValueAtTime(freq*1.22,ctx.currentTime+t+0.09);
      g.gain.setValueAtTime(vol*(0.22-i*0.04),ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.11);
      o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.12);
    });
  }
];

// ─── THUMBS LIKE RELEASE ───────────────────────────────────────────────────
var LIKETHUMB_VARIANTS=[
  function popChord(ctx,vol){
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(380,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(620,ctx.currentTime+0.12);
    g.gain.setValueAtTime(vol*0.132,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
    o.start();o.stop(ctx.currentTime+0.15);
    var ob=ctx.createOscillator();var gb=ctx.createGain();
    ob.connect(gb);gb.connect(ctx.destination);
    ob.type='sine';ob.frequency.setValueAtTime(880,ctx.currentTime+0.07);
    gb.gain.setValueAtTime(vol*0.066,ctx.currentTime+0.07);
    gb.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.24);
    ob.start(ctx.currentTime+0.07);ob.stop(ctx.currentTime+0.24);
    var oc=ctx.createOscillator();var gc=ctx.createGain();
    oc.connect(gc);gc.connect(ctx.destination);
    oc.type='sine';oc.frequency.setValueAtTime(1200,ctx.currentTime+0.10);
    oc.frequency.exponentialRampToValueAtTime(1560,ctx.currentTime+0.26);
    gc.gain.setValueAtTime(vol*0.038,ctx.currentTime+0.10);
    gc.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.30);
    oc.start(ctx.currentTime+0.10);oc.stop(ctx.currentTime+0.30);
  },
  function tapUp(ctx,vol){
    [[0,440],[0.05,660],[0.09,880]].forEach(function(p){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(p[1],ctx.currentTime+p[0]);
      o.frequency.exponentialRampToValueAtTime(p[1]*1.18,ctx.currentTime+p[0]+0.08);
      g.gain.setValueAtTime(vol*0.16,ctx.currentTime+p[0]);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+p[0]+0.10);
      o.start(ctx.currentTime+p[0]);o.stop(ctx.currentTime+p[0]+0.11);
    });
  },
  function bounce(ctx,vol){
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(500,ctx.currentTime);
    o.frequency.linearRampToValueAtTime(200,ctx.currentTime+0.08);
    o.frequency.linearRampToValueAtTime(620,ctx.currentTime+0.17);
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol*0.18,ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.20);
    o.start();o.stop(ctx.currentTime+0.20);
  }
];

// ─── NOTIFICATION ──────────────────────────────────────────────────────────
var NOTIF_VARIANTS=[
  // WhatsApp-style two-tone boop — short, warm, low-pitched. Default variant.
  function whatsappBoop(ctx,vol){
    [[0, 660, 0.16, 0.12], [0.07, 880, 0.20, 0.18]].forEach(function(p){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';
      o.frequency.setValueAtTime(p[1],ctx.currentTime+p[0]);
      o.frequency.exponentialRampToValueAtTime(p[1]*1.04,ctx.currentTime+p[0]+p[3]);
      g.gain.setValueAtTime(0,ctx.currentTime+p[0]);
      g.gain.linearRampToValueAtTime(vol*p[2],ctx.currentTime+p[0]+0.015);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+p[0]+p[3]);
      o.start(ctx.currentTime+p[0]);o.stop(ctx.currentTime+p[0]+p[3]+0.02);
    });
  },
  function socialPing(ctx,vol){
    [0,0.07,0.13].forEach(function(t,i){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(900+i*180,ctx.currentTime+t);
      o.frequency.exponentialRampToValueAtTime(1200+i*200,ctx.currentTime+t+0.07);
      g.gain.setValueAtTime(vol*0.18,ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.09);
      o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.10);
    });
  },
  function crystalBell(ctx,vol){
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(1760,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+0.45);
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol*0.20,ctx.currentTime+0.015);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.50);
    o.start();o.stop(ctx.currentTime+0.52);
    var o2=ctx.createOscillator();var g2=ctx.createGain();
    o2.connect(g2);g2.connect(ctx.destination);
    o2.type='sine';o2.frequency.setValueAtTime(3520,ctx.currentTime);
    o2.frequency.exponentialRampToValueAtTime(1760,ctx.currentTime+0.38);
    g2.gain.setValueAtTime(vol*0.07,ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.36);
    o2.start();o2.stop(ctx.currentTime+0.37);
  }
];

var _TYPE_MAP={typing:TYPING_VARIANTS,emoji:EMOJI_VARIANTS,send:SEND_VARIANTS,like:LIKE_VARIANTS,likeThumb:LIKETHUMB_VARIANTS,notification:NOTIF_VARIANTS};

export var SOUND_META={
  typing:      {label:'Typing',        icon:'⌨️',variants:['Crystal','Soft Tap','Classic']},
  emoji:       {label:'Emoji Tap',     icon:'😊',variants:['Chime','Bubble','Sparkle']},
  send:        {label:'Send / Post',   icon:'✉️',variants:['Swoosh','Launch','Shimmer']},
  like:        {label:'Heart Like',    icon:'❤️',variants:['Heartbeat','Bloom','Flutter']},
  likeThumb:   {label:'Thumbs Like',   icon:'👍',variants:['Pop Chord','Tap Up','Bounce']},
  notification:{label:'Notification', icon:'🔔',variants:['WhatsApp Boop','Social Ping','Crystal Bell']},
};

// ─── INCOMING CALL RINGTONE ────────────────────────────────────────────────
// Warm, classic "ring ring" pattern (~2s long). Designed to be looped while a
// call is ringing. Bypasses sound prefs so muted users still hear the ringer.
var _ringtoneCtxRef = { stop: null };
export function playRingtone(){
  try{ if(_sCtx && _sCtx.state==='suspended') _sCtx.resume(); }catch(e){}
  var ctx = getSCtx();
  if(!ctx) return;
  stopRingtone(); // clear any prior loop
  function ringOnce(){
    // Two warm bell strikes — fundamental + harmonic — separated by a short gap
    var strikes = [
      [0.00, 850],
      [0.50, 850],
    ];
    strikes.forEach(function(p){
      // Main fundamental
      var o1=ctx.createOscillator(); var g1=ctx.createGain();
      o1.connect(g1); g1.connect(ctx.destination);
      o1.type='sine';
      o1.frequency.setValueAtTime(p[1], ctx.currentTime+p[0]);
      g1.gain.setValueAtTime(0, ctx.currentTime+p[0]);
      g1.gain.linearRampToValueAtTime(0.18, ctx.currentTime+p[0]+0.02);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+p[0]+0.42);
      o1.start(ctx.currentTime+p[0]); o1.stop(ctx.currentTime+p[0]+0.45);
      // Harmonic shimmer
      var o2=ctx.createOscillator(); var g2=ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.type='sine';
      o2.frequency.setValueAtTime(p[1]*2.0, ctx.currentTime+p[0]);
      g2.gain.setValueAtTime(0, ctx.currentTime+p[0]);
      g2.gain.linearRampToValueAtTime(0.06, ctx.currentTime+p[0]+0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+p[0]+0.35);
      o2.start(ctx.currentTime+p[0]); o2.stop(ctx.currentTime+p[0]+0.38);
    });
  }
  ringOnce();
  // R15 FIX #8: backgrounded tab/PWA shouldn't keep ringing audibly when the
  // user has navigated away. Stops on visibilitychange→hidden (matches what
  // native dialers do — incoming-call sound mutes when screen locks).
  // Declared BEFORE the interval so the interval's cleanup branch can read it.
  var visHandler = function(){
    if (typeof document !== 'undefined' && document.hidden) {
      try { stopRingtone(); } catch(_){}
    }
  };
  try { if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visHandler); } catch(_){}
  // Cap at 6 cycles (~15s of ringing). Beyond that the AudioContext starts to
  // accumulate scheduled oscillators on low-end Android browsers (esp. Samsung
  // Internet) which contributes to "page unresponsive" warnings when the call
  // is finally accepted. The IncomingCallModal stays visible — only the audio
  // stops.
  var count = 1;
  var iv = setInterval(function(){
    count++;
    if (count > 6) {
      try{ clearInterval(iv); }catch(e){}
      try{ if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visHandler); }catch(e){}
      return;
    }
    ringOnce();
  }, 2400);
  _ringtoneCtxRef.stop = function(){
    try{ clearInterval(iv); }catch(e){}
    try{ if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visHandler); }catch(e){}
    _ringtoneCtxRef.stop=null;
  };
}
export function stopRingtone(){
  if(_ringtoneCtxRef.stop){ _ringtoneCtxRef.stop(); }
}

// ─── CALLER-SIDE RINGBACK TONE ────────────────────────────────────────────
// Standard phone "ringback" — softer than the incoming ringtone, plays for the
// CALLER while they wait for the callee to pick up. Mimics WhatsApp's outgoing-call
// audio feedback so the caller knows the call is actually going through.
// 1-second "brr" tone every 3s, capped at 12 cycles (~36s of patience).
var _ringbackRef = { stop: null };
export function playRingback(){
  try{ if(_sCtx && _sCtx.state==='suspended') _sCtx.resume(); }catch(e){}
  var ctx = getSCtx();
  if(!ctx) return;
  stopRingback();
  function brrOnce(){
    // A single long ~1s tone at 440Hz/480Hz mixed (the classic phone ring frequency)
    [[0, 440], [0, 480]].forEach(function(p){
      var o=ctx.createOscillator(); var g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type='sine';
      o.frequency.setValueAtTime(p[1], ctx.currentTime+p[0]);
      g.gain.setValueAtTime(0, ctx.currentTime+p[0]);
      g.gain.linearRampToValueAtTime(0.07, ctx.currentTime+p[0]+0.05);
      g.gain.setValueAtTime(0.07, ctx.currentTime+p[0]+0.95);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+p[0]+1.0);
      o.start(ctx.currentTime+p[0]); o.stop(ctx.currentTime+p[0]+1.02);
    });
  }
  brrOnce();
  var count = 1;
  var iv = setInterval(function(){
    count++;
    if (count > 12) { try{ clearInterval(iv); }catch(e){} return; }
    brrOnce();
  }, 3000);
  _ringbackRef.stop = function(){ try{ clearInterval(iv); }catch(e){} _ringbackRef.stop = null; };
}
export function stopRingback(){
  if(_ringbackRef.stop){ _ringbackRef.stop(); }
}

export function previewSound(type,variant,vol){
  // Ensure context is created AND resumed (resume() is idempotent and required after user-gesture)
  try{ if(_sCtx && _sCtx.state==='suspended') _sCtx.resume(); }catch(e){}
  var ctx=getSCtx();if(!ctx)return;
  var fns=_TYPE_MAP[type];
  if(fns&&fns[variant]){try{fns[variant](ctx,vol!=null?vol:0.6);}catch(e){}}
}

// Always-play helper for the Settings "Test Sound" button — bypasses prefs entirely so the
// user can verify their device actually plays audio even if their prefs have everything muted.
// Returns true on attempt, false if AudioContext could not be acquired (e.g. browser blocked it).
export function forceSound(type, variant){
  try{ if(_sCtx && _sCtx.state==='suspended') _sCtx.resume(); }catch(e){}
  var ctx=getSCtx();
  if(!ctx) return false;
  var fns=_TYPE_MAP[type||'notification'];
  if(!fns) return false;
  var v = (typeof variant==='number') ? variant : 0;
  try{ fns[v](ctx, 0.7); return true; }catch(e){ return false; }
}

export function playSound(type){
  try{ if(_sCtx && _sCtx.state==='suspended') _sCtx.resume(); }catch(e){}
  var ctx=getSCtx();if(!ctx)return;
  var prefs=getSoundPrefs();
  var p=prefs[type];
  if(!p||p.enabled===false)return;
  var fns=_TYPE_MAP[type];
  if(fns&&fns[p.variant]){try{fns[p.variant](ctx,p.volume);}catch(e){}}
}

// Unlike sound — soft descending tone, respects like volume pref
export function playUnlikeSound(){
  var ctx=getSCtx();if(!ctx)return;
  var prefs=getSoundPrefs();
  var p=prefs['like'];
  if(!p||p.enabled===false)return;
  var vol=p.volume;
  try{
    var o=ctx.createOscillator();var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';
    o.frequency.setValueAtTime(680,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(320,ctx.currentTime+0.18);
    g.gain.setValueAtTime(vol*0.13,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.20);
    o.start();o.stop(ctx.currentTime+0.20);
  }catch(e){}
}

// Gift sounds — self-contained (don't depend on the _TYPE_MAP/prefs variants).
// kind: 'bell' (regular tap) | 'chime' (premium) | 'fanfare' (fullscreen mega).
// Gated on the 'gift' pref, falling back to 'notification' so a user who muted
// notifications also mutes gift sounds.
export function playGiftSound(kind){
  try{ if(_sCtx && _sCtx.state==='suspended') _sCtx.resume(); }catch(e){}
  var ctx=getSCtx(); if(!ctx) return;
  var prefs=getSoundPrefs();
  var p=(prefs && (prefs.gift || prefs.notification)) || {enabled:true, volume:0.6};
  if(p && p.enabled===false) return;
  var vol=(p && p.volume!=null) ? p.volume : 0.6;
  var t0=ctx.currentTime;
  // ── Magic-bell partial: a bright detuned chime with a fast attack + gentle
  // exponential decay. We layer two slightly-detuned oscillators per note so it
  // shimmers (a tiny "beat" between them gives that fairy-dust glassiness), plus
  // a faint octave-up harmonic for extra crystalline sparkle.
  function sparkleNote(freq, start, dur, peak, type){
    try{
      var wave=type||'sine';
      // Two detuned voices (±~6 cents) → shimmering beat.
      [1.0, 1.0035].forEach(function(mult, idx){
        var o=ctx.createOscillator(), g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type=wave;
        o.frequency.setValueAtTime(freq*mult, t0+start);
        // tiny upward glide on the body for an "ascending magic" feel
        o.frequency.exponentialRampToValueAtTime(freq*mult*1.012, t0+start+dur*0.6);
        g.gain.setValueAtTime(0.0001, t0+start);
        g.gain.exponentialRampToValueAtTime(vol*peak*(idx===0?1:0.7), t0+start+0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0+start+dur);
        o.start(t0+start); o.stop(t0+start+dur+0.03);
      });
      // Octave-up harmonic glint — quieter, snappier, triangle for a glassy edge.
      var oh=ctx.createOscillator(), gh=ctx.createGain();
      oh.connect(gh); gh.connect(ctx.destination);
      oh.type='triangle';
      oh.frequency.setValueAtTime(freq*2, t0+start);
      gh.gain.setValueAtTime(0.0001, t0+start);
      gh.gain.exponentialRampToValueAtTime(vol*peak*0.28, t0+start+0.006);
      gh.gain.exponentialRampToValueAtTime(0.0001, t0+start+dur*0.7);
      oh.start(t0+start); oh.stop(t0+start+dur*0.7+0.03);
    }catch(e){}
  }
  // ── High "fairy-dust" sparkle tail: a flurry of very short, very high random
  // glints scattered over a window — the twinkly settle after the cascade.
  function sparkleTail(startBase, count, lo, hi, span, peak){
    try{
      for(var i=0;i<count;i++){
        var st=startBase + Math.random()*span;
        var f=lo + Math.random()*(hi-lo);
        var o=ctx.createOscillator(), g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='sine';
        o.frequency.setValueAtTime(f, t0+st);
        o.frequency.exponentialRampToValueAtTime(f*1.05, t0+st+0.06);
        g.gain.setValueAtTime(0.0001, t0+st);
        g.gain.exponentialRampToValueAtTime(vol*peak, t0+st+0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0+st+0.09);
        o.start(t0+st); o.stop(t0+st+0.12);
      }
    }catch(e){}
  }
  // Bright major-pentatonic note pool (C major-ish) so any subset sounds magical.
  if(kind==='fanfare'){
    // Grand magical flourish — a full rising shimmer cascade then a sparkling
    // bloom + a long high sparkle tail (fairy-dust raining down).
    var grand=[523,659,784,880,1047,1319,1568,2093];
    grand.forEach(function(f,i){ sparkleNote(f, i*0.07, 0.6, 0.16, 'sine'); });
    // shimmering top "bloom" chord
    [1568,2093,2637].forEach(function(f,i){ sparkleNote(f, 0.62+i*0.02, 0.9, 0.12, 'sine'); });
    sparkleTail(0.45, 16, 2600, 5200, 0.9, 0.06);
  } else if(kind==='chime'){
    // Fuller shimmer cascade — a quick bright arpeggio + a modest sparkle tail.
    [659,880,1175,1568,1976].forEach(function(f,i){ sparkleNote(f, i*0.06, 0.45, 0.17, 'sine'); });
    sparkleTail(0.32, 8, 2400, 4200, 0.45, 0.05);
  } else {
    // 'bell' (default) — a short 3-4 note sparkle: quick bright upward chime
    // with a few high glints. Snappy, magical, used for normal gifts.
    [988,1319,1760,2349].forEach(function(f,i){ sparkleNote(f, i*0.05, 0.3, 0.18, 'sine'); });
    sparkleTail(0.18, 4, 2800, 4600, 0.22, 0.05);
  }
}

// ─── AUDIO UNLOCK (autoplay-policy workaround) ──────────────────────────────
// Web Audio contexts start 'suspended' and can ONLY be resumed during/just
// after a real user gesture. If an incoming call arrives when the user hasn't
// interacted recently, playRingtone()'s own resume() is silently ignored and
// the ringtone plays into a dead context — THIS is why the ring "sometimes"
// didn't sound. Fix: on the FIRST user gesture of the session, resume the
// context and play a 0-volume blip so it stays 'running' for the rest of the
// session. Every later ringtone/notification/like sound then plays regardless
// of whether a gesture is active at that exact moment. Idempotent; the
// self-installed listener removes itself once the context is confirmed running.
var _audioUnlocked=false;
export function unlockAudio(){
  if(_audioUnlocked) return;
  try{
    var ctx=getSCtx();
    if(!ctx) return;
    if(ctx.state==='suspended'){
      try{ var pr=ctx.resume(); if(pr&&pr.then){ pr.then(function(){ if(ctx.state==='running') _audioUnlocked=true; }).catch(function(){}); } }catch(e){}
    }
    // Silent 1-frame buffer — required to satisfy the gesture-unlock on iOS Safari.
    try{
      var b=ctx.createBuffer(1,1,22050);
      var src=ctx.createBufferSource();
      src.buffer=b; src.connect(ctx.destination); src.start(0);
    }catch(e){}
    if(ctx.state==='running') _audioUnlocked=true;
  }catch(e){}
}
// Self-install a one-time global gesture listener so no caller has to remember
// to unlock. Capture + passive so it never interferes with app interactions.
try{
  if(typeof window!=='undefined' && typeof document!=='undefined'){
    var _unlockOpts={capture:true, passive:true};
    var _unlockOnce=function(){
      unlockAudio();
      if(_audioUnlocked){
        try{
          document.removeEventListener('pointerdown',_unlockOnce,_unlockOpts);
          document.removeEventListener('touchstart',_unlockOnce,_unlockOpts);
          document.removeEventListener('touchend',_unlockOnce,_unlockOpts);
          document.removeEventListener('click',_unlockOnce,_unlockOpts);
          document.removeEventListener('keydown',_unlockOnce,_unlockOpts);
        }catch(e){}
      }
    };
    document.addEventListener('pointerdown',_unlockOnce,_unlockOpts);
    document.addEventListener('touchstart',_unlockOnce,_unlockOpts);
    document.addEventListener('touchend',_unlockOnce,_unlockOpts);
    document.addEventListener('click',_unlockOnce,_unlockOpts);
    document.addEventListener('keydown',_unlockOnce,_unlockOpts);
  }
}catch(e){}
