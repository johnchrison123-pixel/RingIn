/* eslint-disable */
const { Icon: IC } = window.RD_C;

const NICK_SUGGEST = ['NightOwl','SunnyVibes','QuietRain','PixelDust','MidnightCoffee','LostKite','SoftRebel','TinyPlanet','BlueWander','RoamingFox'];
const AVATARS = ['🦉','🦊','🐼','🐨','🦋','🐙','🐳','🌙','☀','🌟','✨','🌈','🪐','☕','🍓','🎭','🎨','🎮','🎸','📚'];
const MOODS = ['😊 Happy','😴 Tired','🤩 Excited','🥺 Lonely','😂 Goofy','😐 Meh','😔 Sad','😡 Frustrated'];

const STRANGERS = [
  {nick:'NightOwl_22',av:'🦉',interests:['Late Night Talks','Music','Philosophy'],topic:'Friendly chat',mood:'😴 Tired',calls:48,fans:120,desc:'Insomniac. Talk about nothing and everything.',gender:'F',age:'22'},
  {nick:'PixelDust',av:'✨',interests:['Gaming','Anime','Coding'],topic:'Make a friend',mood:'🤩 Excited',calls:212,fans:830,desc:'Indie dev grinding side projects.',gender:'M',age:'25'},
  {nick:'SoftRebel',av:'🌙',interests:['Mental Health','Books','Heartbreak'],topic:'Need to vent',mood:'🥺 Lonely',calls:91,fans:402,desc:'Going through stuff. Just need someone to listen.',gender:'NB',age:'19'},
  {nick:'RoamingFox',av:'🦊',interests:['Travel','Photography','Languages'],topic:'Funny stories',mood:'😊 Happy',calls:67,fans:188,desc:'Backpacker. 14 countries. Ask me anything.',gender:'M',age:'28'},
  {nick:'MidnightCoffee',av:'☕',interests:['Career','Startups','Tech'],topic:'Quick advice',mood:'😊 Happy',calls:34,fans:74,desc:'Burnt out PM. Want to talk shop or distractions.',gender:'F',age:'29'},
  {nick:'LostKite',av:'🪁',interests:['Memes','Stand-up','Goofy'],topic:'Funny stories',mood:'😂 Goofy',calls:301,fans:1240,desc:'Will roast you with love. Bring jokes.',gender:'M',age:'21'},
];

const RECENT = [STRANGERS[1], STRANGERS[3], STRANGERS[5]];
const FRIENDS = [STRANGERS[0], STRANGERS[4]];

function TagInput({ value, onChange, placeholder, color = 'var(--ac)' }) {
  const [input, setInput] = React.useState('');
  const add = () => {
    const t = input.trim().replace(/^#/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput('');
  };
  return (
    <div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:value.length?'8px 8px 4px':0,background:value.length?'var(--bg3)':'transparent',border:value.length?'1px solid var(--border)':'none',borderRadius:10,marginBottom:8}}>
        {value.map(t => (
          <span key={t} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:14,background:'var(--acg)',color,fontSize:12,fontWeight:600}}>
            #{t}
            <button onClick={()=>onChange(value.filter(x=>x!==t))} style={{background:'none',border:'none',color,cursor:'pointer',padding:0,fontSize:14,lineHeight:1}}>×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={e=>setInput(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        style={{width:'100%',padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize:13,outline:'none'}}
      />
    </div>
  );
}

function StrangerCard({ s, onOpen, onCall, label }) {
  return (
    <div className="card" style={{padding:12,display:'flex',gap:12,alignItems:'center',cursor:'pointer'}} onClick={()=>onOpen(s)}>
      <div style={{width:48,height:48,borderRadius:'50%',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0,border:'1px solid var(--border)'}}>{s.av}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13}}>{s.nick}</div>
        <div style={{fontSize:11,color:'var(--t2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.interests.slice(0,2).map(i=>'#'+i).join(' ')}</div>
        <div style={{fontSize:10,color:'var(--t3)',marginTop:2}}>{label}</div>
      </div>
      <button className="btn btn-pri" style={{padding:'6px 10px',fontSize:11}} onClick={e=>{e.stopPropagation();onCall({name:s.nick,role:'Anonymous · '+s.interests[0],rate:0,initials:s.av,color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:null});}}>{IC.phone()}</button>
    </div>
  );
}

function ProfileSheet({ s, onClose, onCall, isMe, onEdit }) {
  if (!s) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(4px)'}}>
      <div onClick={e=>e.stopPropagation()} className="card" style={{width:'100%',maxWidth:480,padding:0,overflow:'hidden'}}>
        <div style={{height:90,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',position:'relative'}}>
          <button onClick={onClose} style={{position:'absolute',top:10,right:10,width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,.4)',border:'none',color:'#fff',fontSize:16,cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'0 22px 22px',marginTop:-44}}>
          <div style={{width:88,height:88,borderRadius:'50%',background:'var(--bg2)',border:'4px solid var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:44}}>{s.av}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginTop:10,gap:10}}>
            <div>
              <div style={{fontFamily:'Inter',fontSize:20,fontWeight:700}}>{s.nick}</div>
              <div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>{s.gender} · {s.age} · {s.mood}</div>
            </div>
            {isMe
              ? <button className="btn btn-out btn-icon" onClick={onEdit}>{IC.edit()} Edit</button>
              : <button className="btn btn-pri btn-icon" onClick={()=>onCall({name:s.nick,role:'Anonymous',rate:0,initials:s.av,color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:null})}>{IC.phone()} Call</button>}
          </div>
          <div style={{fontSize:13,color:'var(--t2)',marginTop:12,lineHeight:1.5}}>{s.desc}</div>
          <div style={{display:'flex',gap:18,padding:'14px 0',marginTop:12,borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
            <div><div style={{fontSize:11,color:'var(--t3)'}}>Followers</div><div style={{fontWeight:700,fontSize:16}}>{s.fans}</div></div>
            <div><div style={{fontSize:11,color:'var(--t3)'}}>Calls</div><div style={{fontWeight:700,fontSize:16}}>{s.calls}</div></div>
            <div><div style={{fontSize:11,color:'var(--t3)'}}>Topic</div><div style={{fontWeight:700,fontSize:13,marginTop:2}}>{s.topic}</div></div>
          </div>
          <div style={{marginTop:14}}>
            <div style={{fontSize:11,color:'var(--t3)',marginBottom:6,fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase'}}>Interests</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{s.interests.map(i=><span key={i} className="chip on">#{i}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnonConnect({ onCall }) {
  const [me, setMe] = React.useState({nick:'NightOwl',av:'🦉',desc:'Looking for genuine, low-key conversations.',gender:'F',age:'24',mood:'😊 Happy',topic:'Friendly chat',interests:['Music','Late Night Talks','Tech'],fans:34,calls:12});
  const [interests, setInterests] = React.useState(['Music','Late Night Talks','Tech']);
  const [topics, setTopics] = React.useState(['Friendly chat']);
  const [matchFilters, setMatchFilters] = React.useState({voice:true,video:false,sameInterest:true});
  const [searching, setSearching] = React.useState(false);
  const [matched, setMatched] = React.useState(null);
  const [viewing, setViewing] = React.useState(null);
  const [editing, setEditing] = React.useState(false);

  const startSearch = () => {
    setSearching(true);
    setTimeout(()=>{
      const overlap = STRANGERS.filter(s=>s.interests.some(i=>interests.includes(i)));
      const pool = overlap.length?overlap:STRANGERS;
      setMatched(pool[Math.floor(Math.random()*pool.length)]);
      setSearching(false);
    }, 2000);
  };
  const skip = () => { setMatched(null); startSearch(); };

  if (matched) return (
    <div className="page" style={{maxWidth:780}}>
      <div className="card" style={{padding:36,textAlign:'center'}}>
        <div style={{fontSize:12,color:'var(--green)',marginBottom:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase'}}>● MATCHED</div>
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:32,margin:'18px 0 24px'}}>
          <div style={{textAlign:'center'}}>
            <div style={{width:96,height:96,borderRadius:'50%',background:'var(--acg)',border:'3px solid var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,margin:'0 auto 8px'}}>{me.av}</div>
            <div style={{fontWeight:700}}>{me.nick}</div>
            <div style={{fontSize:12,color:'var(--t2)'}}>You</div>
          </div>
          <div style={{fontSize:32,color:'var(--ac)'}}>↔</div>
          <div style={{textAlign:'center',cursor:'pointer'}} onClick={()=>setViewing(matched)}>
            <div style={{width:96,height:96,borderRadius:'50%',background:'linear-gradient(135deg,#E84D9A,#F5A623)',border:'3px solid var(--pink)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,margin:'0 auto 8px'}}>{matched.av}</div>
            <div style={{fontWeight:700}}>{matched.nick}</div>
            <div style={{fontSize:11,color:'var(--t3)'}}>Tap to see profile</div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:18,flexWrap:'wrap'}}>
          {matched.interests.map(i=><span key={i} className="chip" style={{background:interests.includes(i)?'var(--acg)':'var(--bg3)',color:interests.includes(i)?'var(--ac)':'var(--t2)'}}>#{i}</span>)}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button className="btn btn-sec btn-lg btn-icon" onClick={skip}>Skip · Find new</button>
          <button className="btn btn-pri btn-lg btn-icon" onClick={()=>onCall({name:matched.nick,role:'Anonymous · '+matched.interests[0],rate:0,initials:matched.av,color:'linear-gradient(135deg,#7B6EFF,#E84D9A)',img:null})}>{IC.phone()} Connect — voice</button>
        </div>
      </div>
      <ProfileSheet s={viewing} onClose={()=>setViewing(null)} onCall={onCall}/>
    </div>
  );

  if (searching) return (
    <div className="page" style={{maxWidth:520}}>
      <div className="card" style={{padding:48,textAlign:'center'}}>
        <div style={{position:'relative',width:140,height:140,margin:'0 auto 24px'}}>
          <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'var(--acg)',animation:'pulseGlow 1.5s infinite'}}/>
          <div style={{position:'absolute',inset:14,borderRadius:'50%',background:'var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:54}}>🔮</div>
        </div>
        <h2 style={{fontFamily:'Inter',fontSize:22,fontWeight:700,marginBottom:8}}>Finding someone for you…</h2>
        <p style={{color:'var(--t2)',marginBottom:20,fontSize:13}}>Matching on <b style={{color:'var(--ac)'}}>{interests.slice(0,3).join(', ')}</b></p>
        <button className="btn btn-sec" onClick={()=>setSearching(false)}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="page" style={{maxWidth:980}}>
      <div className="page-h">
        <div>
          <div className="t" style={{fontFamily:'Inter',fontWeight:700,letterSpacing:'-.01em',color:'var(--text)'}}>Anonymous Connect</div>
          <div className="s">Random calls with real people. Type your interests &amp; topics — we'll match on what overlaps.</div>
        </div>
        <button className="btn btn-pri btn-lg btn-icon" onClick={startSearch} disabled={!interests.length}>{IC.phone()} Find someone now</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:16}}>
        {/* Profile card — compact, click to view full */}
        <div className="card" style={{padding:18,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:'var(--acg)',border:'3px solid var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,flexShrink:0}}>{me.av}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'Inter',fontWeight:700,fontSize:16}}>{me.nick}</div>
              <div style={{fontSize:11,color:'var(--t2)'}}>{me.gender} · {me.age} · {me.mood}</div>
              <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{me.fans} fans · {me.calls} calls</div>
            </div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-out" style={{flex:1,fontSize:12}} onClick={()=>setViewing({...me,interests,topic:topics[0]||'—'})}>View profile</button>
            <button className="btn btn-pri btn-icon" style={{flex:1,fontSize:12}} onClick={()=>setEditing(true)}>{IC.edit()} Edit</button>
          </div>
          <div style={{padding:'12px 0 0',borderTop:'1px solid var(--border)'}}>
            <div style={{fontSize:11,color:'var(--t3)',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6}}>Your stats</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
              <div><div style={{color:'var(--t3)',fontSize:11}}>Karma</div><div style={{fontWeight:700,color:'var(--green)'}}>+ 94%</div></div>
              <div><div style={{color:'var(--t3)',fontSize:11}}>Streak</div><div style={{fontWeight:700}}>🔥 5d</div></div>
            </div>
          </div>
        </div>

        {/* Main: tag inputs */}
        <div className="card" style={{padding:20}}>
          <h3 style={{fontFamily:'Inter',fontWeight:700,fontSize:15,marginBottom:4}}>Your interests</h3>
          <p style={{fontSize:12,color:'var(--t2)',marginBottom:10}}>Type anything — a hobby, a niche, a feeling. Hit <b style={{color:'var(--ac)'}}>Enter</b> to add. We'll match you with people sharing at least one.</p>
          <TagInput value={interests} onChange={setInterests} placeholder="e.g. lo-fi music, late night drives, anime…"/>

          <h3 style={{fontFamily:'Inter',fontWeight:700,fontSize:15,margin:'20px 0 4px'}}>What kind of chat?</h3>
          <p style={{fontSize:12,color:'var(--t2)',marginBottom:10}}>Type a vibe or topic for this call. Press <b style={{color:'var(--ac)'}}>Enter</b> to add.</p>
          <TagInput value={topics} onChange={setTopics} placeholder="e.g. need to vent, friendly chat, advice…"/>

          <div style={{display:'flex',gap:12,marginTop:18,paddingTop:14,borderTop:'1px solid var(--border)'}}>
            <label style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',background:'var(--bg3)',borderRadius:10,cursor:'pointer',fontSize:12}}><input type="checkbox" checked={matchFilters.voice} onChange={e=>setMatchFilters({...matchFilters,voice:e.target.checked})}/>Voice</label>
            <label style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',background:'var(--bg3)',borderRadius:10,cursor:'pointer',fontSize:12}}><input type="checkbox" checked={matchFilters.video} onChange={e=>setMatchFilters({...matchFilters,video:e.target.checked})}/>Video</label>
            <label style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',background:'var(--bg3)',borderRadius:10,cursor:'pointer',fontSize:12}}><input type="checkbox" checked={matchFilters.sameInterest} onChange={e=>setMatchFilters({...matchFilters,sameInterest:e.target.checked})}/>Must share interest</label>
          </div>
          <button className="btn btn-pri btn-lg btn-icon" style={{width:'100%',marginTop:14}} onClick={startSearch} disabled={!interests.length}>{IC.phone()} Connect anonymously</button>
        </div>
      </div>

      {/* Recently called */}
      <h3 style={{fontFamily:'Inter',fontWeight:700,fontSize:16,margin:'24px 0 10px'}}>Recently called</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {RECENT.map(s=><StrangerCard key={s.nick} s={s} onOpen={setViewing} onCall={onCall} label="Called 2d ago · 4 min"/>)}
      </div>

      {/* Added friends */}
      <h3 style={{fontFamily:'Inter',fontWeight:700,fontSize:16,margin:'24px 0 10px'}}>Added friends <span style={{fontSize:11,color:'var(--t3)',fontWeight:400}}>· anonymous strangers who became friends</span></h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {FRIENDS.map(s=><StrangerCard key={s.nick} s={s} onOpen={setViewing} onCall={onCall} label="● Online now"/>)}
      </div>

      <ProfileSheet s={viewing} onClose={()=>setViewing(null)} onCall={onCall} isMe={viewing && viewing.nick===me.nick} onEdit={()=>{setViewing(null);setEditing(true);}}/>

      {/* Edit profile sheet */}
      {editing && (
        <div onClick={()=>setEditing(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(4px)'}}>
          <div onClick={e=>e.stopPropagation()} className="card" style={{width:'100%',maxWidth:480,padding:22,maxHeight:'85vh',overflow:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h2 style={{fontFamily:'Inter',fontWeight:700,fontSize:18}}>Edit anonymous profile</h2>
              <button onClick={()=>setEditing(false)} style={{background:'none',border:'none',color:'var(--t2)',fontSize:20,cursor:'pointer'}}>×</button>
            </div>
            <div style={{textAlign:'center',marginBottom:8}}>
              <div style={{width:80,height:80,borderRadius:'50%',background:'var(--acg)',border:'3px solid var(--ac)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,margin:'0 auto 6px'}}>{me.av}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4,marginBottom:14}}>
              {AVATARS.map(a=><button key={a} onClick={()=>setMe({...me,av:a})} style={{padding:6,fontSize:18,borderRadius:6,background:me.av===a?'var(--acg)':'var(--bg3)',border:me.av===a?'1px solid var(--ac)':'1px solid var(--border)'}}>{a}</button>)}
            </div>
            <div className="field"><label>Nickname</label><input value={me.nick} onChange={e=>setMe({...me,nick:e.target.value})} maxLength={16}/>
              <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>{NICK_SUGGEST.slice(0,4).map(n=><button key={n} className="chip" style={{fontSize:10,padding:'3px 8px'}} onClick={()=>setMe({...me,nick:n})}>{n}</button>)}</div>
            </div>
            <div className="field"><label>Short bio</label><textarea rows={3} value={me.desc} onChange={e=>setMe({...me,desc:e.target.value})} maxLength={120}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field"><label>Show as</label><select value={me.gender} onChange={e=>setMe({...me,gender:e.target.value})}><option value="any">Any</option><option value="M">Male</option><option value="F">Female</option><option value="NB">Non-binary</option></select></div>
              <div className="field"><label>Age</label><input type="number" value={me.age} onChange={e=>setMe({...me,age:e.target.value})}/></div>
            </div>
            <div className="field"><label>Mood</label><select value={me.mood} onChange={e=>setMe({...me,mood:e.target.value})}>{MOODS.map(m=><option key={m}>{m}</option>)}</select></div>
            <button className="btn btn-pri btn-lg" style={{width:'100%',marginTop:8}} onClick={()=>setEditing(false)}>Save profile</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.RD_CONNECT = { AnonConnect };
