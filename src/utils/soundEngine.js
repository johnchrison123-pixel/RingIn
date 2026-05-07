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

export function getSoundPrefs(){
  try{var s=localStorage.getItem('ringin_sound_prefs');if(s)return Object.assign({},DEFAULT_PREFS,JSON.parse(s));}catch(e){}
  return Object.assign({},DEFAULT_PREFS);
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
  try{if(navigator.vibrate)navigator.vibrate(pattern);}catch(e){}
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
  function gentleBell(ctx,vol){
    [[0,880,0.18],[0.13,1100,0.14]].forEach(function(p){
      var o=ctx.createOscillator();var g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(p[1],ctx.currentTime+p[0]);
      o.frequency.exponentialRampToValueAtTime(p[1]*0.96,ctx.currentTime+p[0]+0.38);
      g.gain.setValueAtTime(0,ctx.currentTime+p[0]);
      g.gain.linearRampToValueAtTime(vol*p[2],ctx.currentTime+p[0]+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+p[0]+0.42);
      o.start(ctx.currentTime+p[0]);o.stop(ctx.currentTime+p[0]+0.44);
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
  notification:{label:'Notification', icon:'🔔',variants:['Gentle Bell','Social Ping','Crystal Bell']},
};

export function previewSound(type,variant,vol){
  var ctx=getSCtx();if(!ctx)return;
  var fns=_TYPE_MAP[type];
  if(fns&&fns[variant]){try{fns[variant](ctx,vol!=null?vol:0.6);}catch(e){}}
}

export function playSound(type){
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
