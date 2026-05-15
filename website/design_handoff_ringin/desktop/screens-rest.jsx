/* eslint-disable */
const { Icon, Avatar, VerifiedBadge } = window.RD_C;
const D2 = window.RING_DATA;

// ============ MY PROFILE ============
function MyProfile({ goExpert, goSettings, goWallet, openCall }) {
  const [tab, setTab] = React.useState('posts');
  const [editing, setEditing] = React.useState(false);
  const [user, setUser] = React.useState(D2.CURRENT_USER);
  const [draft, setDraft] = React.useState(user);
  const myPosts = D2.POSTS.filter(p=>p.user.id==='me' || p.user.id===user.id);

  const saveEdit = () => { setUser(draft); D2.CURRENT_USER.name=draft.name; D2.CURRENT_USER.bio=draft.bio; D2.CURRENT_USER.role=draft.role; D2.CURRENT_USER.location=draft.location; setEditing(false); };

  const COVERS = [
    'linear-gradient(135deg,#7B6EFF,#E84D9A)',
    'linear-gradient(135deg,#1D9E75,#5DCAA5)',
    'linear-gradient(135deg,#0EA5E9,#7B6EFF)',
    'linear-gradient(135deg,#F5A623,#E8401A)',
    'linear-gradient(135deg,#9B59B6,#534AB7)',
    'linear-gradient(135deg,#0F766E,#14B8A6)',
  ];

  return (
    <div className="profile-page" style={{paddingTop:0,maxWidth:1100}}>
      <div className="profile-hero">
        <div className="profile-hero-bg" style={{background:user.cover}}/>
        <div className="profile-hero-grid">
          <div style={{position:'relative'}}>
            <Avatar user={user} size={128}/>
            <button className="icon-btn" style={{position:'absolute',bottom:0,right:0,width:34,height:34,background:'var(--ac)',color:'#fff',borderColor:'var(--ac)'}} onClick={()=>setEditing(true)}>{Icon.camera()}</button>
          </div>
          <div className="meta">
            <h1>{user.name}</h1>
            <div className="role">{user.role}</div>
            <div className="id-chips">
              <span>{Icon.pin()} {user.location}</span>
              <span>{user.joined}</span>
              <span><b style={{color:'var(--text)'}}>{user.followers}</b> followers · <b style={{color:'var(--text)'}}>{user.following}</b> following</span>
              <span>🪙 <b style={{color:'var(--amber)'}}>{user.coins}</b> coins</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-pri btn-icon" onClick={()=>setEditing(true)}>{Icon.edit()} Edit profile</button>
            <button className="btn btn-sec btn-icon" onClick={goWallet}>{Icon.wallet()} Wallet</button>
            <button className="btn btn-sec btn-icon" onClick={goSettings}>{Icon.settings()} Settings</button>
          </div>
        </div>
      </div>
      <div className="profile-tabs">
        {['posts','about','saved','followers'].map(t => (
          <button key={t} className={"profile-tab"+(tab===t?' on':'')} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <div className="profile-grid">
        <aside className="card profile-info-card">
          <h3>Intro</h3>
          <div className="bio">{user.bio}</div>
          <div className="info-row">{Icon.pin()}<span>Lives in <b>{user.location}</b></span></div>
          <div className="info-row">{Icon.user()}<span>{user.handle}</span></div>
          <div className="info-row">{Icon.shield()}<span>Member since Jan 2025</span></div>
          <button className="btn btn-out" style={{width:'100%',marginTop:10}} onClick={()=>setEditing(true)}>Edit details</button>
          <div className="stat-grid">
            <div className="stat-cell"><div className="v">{user.posts}</div><div className="l">Posts</div></div>
            <div className="stat-cell"><div className="v">{user.followers}</div><div className="l">Followers</div></div>
            <div className="stat-cell"><div className="v">{user.following}</div><div className="l">Following</div></div>
            <div className="stat-cell"><div className="v">{user.coins}</div><div className="l">Coins</div></div>
          </div>
          <h3 style={{marginTop:16}}>Interests</h3>
          <div className="tag-list">{['Design','Engineering','Career','Wellness'].map(t=><span key={t}>{t}</span>)}</div>
        </aside>
        <div>
          {tab==='posts' && (
            <>
              <div className="card composer" style={{marginBottom:16}}>
                <div className="composer-top">
                  <Avatar user={user} size={42}/>
                  <div className="composer-input">Share an update, {user.name.split(' ')[0]}…</div>
                </div>
              </div>
              {myPosts.length===0 && <div className="card" style={{padding:32,textAlign:'center',color:'var(--t2)'}}>You haven't posted yet. Share your first update above.</div>}
              {myPosts.map(p => (
                <div key={p.id} className="card" style={{marginBottom:16,padding:18}}>
                  <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
                    <Avatar user={user} size={42}/>
                    <div>
                      <div style={{fontWeight:700}}>{user.name}</div>
                      <div style={{fontSize:12,color:'var(--t3)'}}>{p.time}</div>
                    </div>
                  </div>
                  <div style={{fontSize:14,lineHeight:1.55}}>{p.text}</div>
                </div>
              ))}
            </>
          )}
          {tab==='about' && (
            <div className="card" style={{padding:22}}>
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,marginBottom:14}}>About</h3>
              <p style={{color:'var(--t2)',lineHeight:1.65,marginBottom:18}}>{user.bio}</p>
              <div className="info-row">{Icon.pin()}<span><b>Lives in</b> {user.location}</span></div>
              <div className="info-row">{Icon.user()}<span><b>Username</b> {user.handle}</span></div>
              <div className="info-row">{Icon.globe()}<span><b>Speaks</b> English, Hindi</span></div>
              <div className="info-row">{Icon.shield()}<span><b>Joined</b> January 2025</span></div>
            </div>
          )}
          {tab==='saved' && (
            <div className="card" style={{padding:32,textAlign:'center',color:'var(--t2)'}}>
              <div style={{fontSize:48,marginBottom:10}}>🔖</div>
              <h3 style={{fontFamily:'Syne,sans-serif'}}>Saved posts</h3>
              <p>Posts you save will appear here. Tap the bookmark on any post to save it.</p>
            </div>
          )}
          {tab==='followers' && (
            <div className="card" style={{padding:18}}>
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,marginBottom:14}}>Followers · {user.followers}</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {D2.EXPERTS.slice(0,6).map(e=>(
                  <div key={e.id} style={{display:'flex',gap:12,alignItems:'center',padding:10,background:'var(--bg3)',borderRadius:10}}>
                    <Avatar user={e} size={42}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14}}>{e.name}</div>
                      <div style={{fontSize:12,color:'var(--t2)'}}>{e.role}</div>
                    </div>
                    <button className="btn btn-sec" style={{padding:'5px 10px',fontSize:11}}>View</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <div className="search-modal" onClick={()=>setEditing(false)}>
          <div className="search-box" style={{width:560,paddingBottom:0}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:800}}>Edit profile</h3>
              <button className="icon-btn" onClick={()=>setEditing(false)}>✕</button>
            </div>
            <div style={{padding:'18px 22px',maxHeight:'70vh',overflowY:'auto'}}>
              <div style={{fontSize:12,color:'var(--t3)',textTransform:'uppercase',fontWeight:700,letterSpacing:'.08em',marginBottom:8}}>Cover</div>
              <div style={{height:90,borderRadius:10,background:draft.cover,marginBottom:10,border:'1px solid var(--border)'}}/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6,marginBottom:18}}>
                {COVERS.map(c=>(
                  <div key={c} onClick={()=>setDraft({...draft,cover:c})} style={{height:36,borderRadius:8,background:c,cursor:'pointer',border:draft.cover===c?'2px solid var(--ac)':'1px solid var(--border)'}}/>
                ))}
              </div>
              <div style={{fontSize:12,color:'var(--t3)',textTransform:'uppercase',fontWeight:700,letterSpacing:'.08em',marginBottom:8}}>Profile photo</div>
              <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:18}}>
                <Avatar user={draft} size={64}/>
                <button className="btn btn-sec btn-icon">{Icon.camera()} Upload new</button>
              </div>
              <div className="field"><label>Display name</label><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></div>
              <div className="field"><label>Headline</label><input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}/></div>
              <div className="field"><label>Bio</label><textarea value={draft.bio} onChange={e=>setDraft({...draft,bio:e.target.value})} rows={3}/></div>
              <div className="field"><label>Location</label><input value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/></div>
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:10,justifyContent:'flex-end',background:'var(--bg2)'}}>
              <button className="btn btn-sec" onClick={()=>{setDraft(user);setEditing(false);}}>Cancel</button>
              <button className="btn btn-pri" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ MESSAGES ============
function MessagesScreen({ initialConvo, onCall, onViewExpert }) {
  const [activeId, setActiveId] = React.useState(initialConvo || 'cv1');
  const [text, setText] = React.useState('');
  const [convos, setConvos] = React.useState(D2.CONVERSATIONS);
  const [msgsByConvo, setMsgsByConvo] = React.useState(D2.MESSAGES_BY_CONVO);
  const active = convos.find(c=>c.id===activeId) || convos[0];
  const msgs = msgsByConvo[active.id] || [];

  const send = () => {
    if(!text.trim()) return;
    const nm = {id:'n'+Date.now(),from:'me',text:text.trim(),time:'now'};
    setMsgsByConvo(p=>({...p,[active.id]:[...(p[active.id]||[]),nm]}));
    setText('');
  };

  return (
    <div className="messenger">
      <aside className="msg-side">
        <div className="msg-side-h">
          <div className="t">Messages</div>
          <button className="icon-btn" style={{width:34,height:34}}>{Icon.edit()}</button>
        </div>
        <div className="msg-search">
          <div className="msg-search-pill">{Icon.search()}<input placeholder="Search Messenger"/></div>
        </div>
        <div style={{padding:'0 12px 8px',display:'flex',gap:6}}>
          <button className="chip on" style={{flex:1}}>Inbox</button>
          <button className="chip" style={{flex:1}}>Unread</button>
          <button className="chip" style={{flex:1}}>Experts</button>
        </div>
        <div className="msg-list">
          {convos.map(cv => (
            <div key={cv.id} className={"msg-item"+(activeId===cv.id?' on':'')+(cv.unread?' unread':'')} onClick={()=>setActiveId(cv.id)}>
              <Avatar user={cv.user} size={48} showOnline={cv.online}/>
              <div className="info">
                <div className="top-row"><div className="nm">{cv.user.name}</div><div className="ts">{cv.time}</div></div>
                <div className="top-row"><div className="preview">{cv.preview}</div>{cv.unread?<span className="badge-u">{cv.unread}</span>:null}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="chat-pane">
        <div className="chat-h">
          <Avatar user={active.user} size={40} showOnline={active.online}/>
          <div>
            <div className="nm">{active.user.name}</div>
            <div className="pres">{active.online?'Active now':'Last seen 3h ago'}</div>
          </div>
          <div className="grow"/>
          <div className="actions">
            <button className="icon-btn" onClick={()=>onCall(active.user)}>{Icon.phone()}</button>
            <button className="icon-btn">{Icon.video()}</button>
            <button className="icon-btn">{Icon.more()}</button>
          </div>
        </div>
        <div className="chat-msgs">
          <div className="day-sep">Today</div>
          {msgs.map((m,i) => {
            const isImg = m.type==='image';
            return (
              <React.Fragment key={m.id}>
                <div className={"bubble "+(m.from==='me'?'b-me':'b-them')+(isImg?' b-img':'')}>
                  {isImg ? <img src={m.img} alt=""/> : m.text}
                </div>
                {i===msgs.length-1 && <div className="bubble-meta">{m.from==='me'?'Sent · '+m.time+' ✓✓':m.time}</div>}
              </React.Fragment>
            );
          })}
          {active.online && <div className="typing-row"><span/><span/><span/></div>}
        </div>
        <div className="chat-composer">
          <button className="ic-btn">{Icon.plus()}</button>
          <button className="ic-btn">{Icon.image()}</button>
          <button className="ic-btn">{Icon.attachment()}</button>
          <div className="input-wrap">
            <input placeholder={"Message "+active.user.name.split(' ')[0]+"..."} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')send();}}/>
            <button className="ic-btn">{Icon.smile()}</button>
          </div>
          <button className="send-lever" onClick={send}>{Icon.send()}</button>
        </div>
      </section>

      <aside className="chat-side">
        <div className="hero">
          <Avatar user={active.user} size={80} showOnline={active.online}/>
          <div className="nm" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>{active.user.name} {active.user.verified && <VerifiedBadge/>}</div>
          <div className="role">{active.user.role} · {active.user.loc}</div>
          <div className="actions">
            <button className="btn btn-sec btn-icon">{Icon.user()} Profile</button>
            <button className="btn btn-pri btn-icon" onClick={()=>onCall(active.user)}>{Icon.phone()} Call · {active.user.rate}🪙/min</button>
          </div>
        </div>
        <div className="group">
          <div className="gh">Customize chat</div>
          <a className="side-row"><span className="ic">{Icon.bell()}</span>Mute notifications</a>
          <a className="side-row"><span className="ic">{Icon.pin()}</span>Pin conversation</a>
          <a className="side-row"><span className="ic">🎨</span>Theme</a>
        </div>
        <div className="group">
          <div className="gh">Privacy & support</div>
          <a className="side-row"><span className="ic">{Icon.shield()}</span>Block {active.user.name.split(' ')[0]}</a>
          <a className="side-row"><span className="ic">⚠</span>Report</a>
          <a className="side-row danger"><span className="ic">{Icon.trash()}</span>Clear all chat</a>
        </div>
        <div className="group">
          <div className="gh">Shared media</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:6}}>
            <div style={{aspectRatio:'1/1',background:'var(--bg3)',borderRadius:8}}/>
            <div style={{aspectRatio:'1/1',background:'var(--bg3)',borderRadius:8}}/>
            <div style={{aspectRatio:'1/1',background:'var(--bg3)',borderRadius:8}}/>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ============ WORKSHOPS ============
function WorkshopsScreen() {
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="t brand-grad">Live Workshops</div>
          <div className="s">Group sessions hosted by experts. Join live, ask questions, learn together.</div>
        </div>
        <button className="btn btn-pri btn-lg btn-icon">{Icon.plus()} Host a Workshop</button>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:18}}>
        {['All','Live now','Today','This week','Free','Premium'].map(t=>(
          <button key={t} className={"chip"+(t==='All'?' on':'')}>{t}</button>
        ))}
      </div>
      <div className="workshops-grid">
        {D2.WORKSHOPS.map(w => (
          <div key={w.id} className="ws-card">
            <div className="ws-cover" style={{background:w.cover}}>
              {w.live && <div className="ws-live-badge"><span style={{width:5,height:5,borderRadius:'50%',background:'#fff',animation:'blink 1s infinite'}}/>LIVE</div>}
              {w.live && <div className="ws-views">👁 {w.viewers.toLocaleString()}</div>}
              {!w.live && <div className="ws-views">⏰ {w.startsIn}</div>}
            </div>
            <div className="ws-body">
              <div className="ws-title">{w.title}</div>
              <div className="ws-host">
                <Avatar user={w.host} size={24}/>
                <span>{w.host.name}</span>
                {w.host.verified && <VerifiedBadge/>}
              </div>
              <div className="ws-meta">
                <span className={"ws-tag "+(w.price==='free'?'free':'pro')}>{w.price==='free'?'FREE':'PREMIUM · 15 🪙'}</span>
              </div>
              <button className="ws-join">{w.live?'Join Live':'Set Reminder'}</button>
            </div>
            <div className="ws-detail">
              <div className="ws-host" style={{marginBottom:10}}>
                <Avatar user={w.host} size={28}/>
                <span style={{fontWeight:700,color:'var(--text)'}}>{w.host.name}</span>
                {w.host.verified && <VerifiedBadge/>}
              </div>
              <h4>{w.title}</h4>
              <p>{w.desc}</p>
              <div className="meta-row">
                <span>⏱ <b>{w.duration}</b></span>
                <span>📊 <b>{w.level}</b></span>
                <span>{w.live?'🔴 Live now':'📅 '+w.startsIn}</span>
              </div>
              <button className="ws-join">{w.live?'Join Live →':'Set Reminder →'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ WALLET ============
function WalletScreen({ onBack }) {
  const [selected, setSelected] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const [pay, setPay] = React.useState('card');

  if (done && selected) return (
    <div className="page" style={{maxWidth:520,paddingTop:80}}>
      <div className="card" style={{padding:48,textAlign:'center'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(39,201,106,.15)',color:'var(--green)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 18px'}}>✓</div>
        <h2 style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,marginBottom:6}}>Payment Successful</h2>
        <p style={{color:'var(--t2)',marginBottom:18}}>You received</p>
        <div className="brand-grad" style={{fontSize:42,fontWeight:800,marginBottom:24}}>🪙 {selected.coins+(selected.bonus||0)}</div>
        <button className="btn btn-pri btn-lg" onClick={()=>{setDone(false);setSelected(null);}}>Back to Wallet</button>
      </div>
    </div>
  );

  if (selected) return (
    <div className="page" style={{maxWidth:680}}>
      <button className="btn btn-sec btn-icon" onClick={()=>setSelected(null)} style={{marginBottom:16}}>{Icon.back()} Back</button>
      <div className="card" style={{padding:32,marginBottom:18}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:13,color:'var(--t2)',marginBottom:4}}>You are buying</div>
          <div style={{fontSize:42,fontWeight:800,fontFamily:'Syne,sans-serif',color:'var(--ac)'}}>🪙 {selected.coins} coins</div>
          {selected.bonus>0 && <div style={{fontSize:12,color:'var(--green)'}}>+ {selected.bonus} bonus coins included</div>}
          <div style={{fontSize:24,fontWeight:700,marginTop:10}}>₹{selected.price}</div>
        </div>
        <h3 style={{fontFamily:'Syne,sans-serif',marginBottom:10}}>Payment method</h3>
        <div style={{display:'flex',gap:8,marginBottom:18}}>
          {[['card','💳 Card'],['upi','📱 UPI'],['paypal','🅿 PayPal']].map(([k,l])=>(
            <button key={k} className={"btn "+(pay===k?'btn-out':'btn-sec')+" btn-fl"} onClick={()=>setPay(k)}>{l}</button>
          ))}
        </div>
        {pay==='card' ? (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div className="field"><label>Cardholder name</label><input placeholder="John Chrison"/></div>
            <div className="field"><label>Card number</label><input placeholder="1234 5678 9012 3456" maxLength={19}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div className="field"><label>Expiry</label><input placeholder="MM/YY"/></div>
              <div className="field"><label>CVV</label><input placeholder="123"/></div>
            </div>
          </div>
        ) : pay==='upi' ? (
          <div className="field"><label>UPI ID</label><input placeholder="yourname@upi"/></div>
        ) : (
          <div style={{padding:18,textAlign:'center',background:'var(--bg3)',borderRadius:10,color:'var(--t2)'}}>You'll be redirected to PayPal to complete checkout.</div>
        )}
        <button className="btn btn-pri btn-lg" style={{width:'100%',marginTop:18}} onClick={()=>setDone(true)}>Pay ₹{selected.price} →</button>
      </div>
    </div>
  );

  return (
    <div className="wallet-page">
      {onBack && <button className="btn btn-sec btn-icon" onClick={onBack} style={{marginBottom:16}}>{Icon.back()} Back</button>}
      <div className="page-h" style={{marginBottom:18}}>
        <div className="t brand-grad">My Wallet</div>
      </div>
      <div className="wallet-hero">
        <div>
          <div className="lbl">Coin Balance</div>
          <div className="bal"><span className="coin-big">🪙</span>{D2.CURRENT_USER.coins.toLocaleString()}</div>
          <div className="equiv">≈ ₹{D2.CURRENT_USER.coins.toLocaleString()} value</div>
        </div>
        <div className="actions">
          <button className="btn btn-pri btn-lg btn-icon">{Icon.plus()} Add Coins</button>
          <button className="btn btn-sec btn-lg">Send to Expert</button>
        </div>
      </div>

      <h3 style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:800,marginBottom:14}}>Buy Coins</h3>
      <div className="wallet-grid">
        {D2.PACKAGES.map(p => (
          <div key={p.id} className={"pkg"+(p.popular?' popular':'')} onClick={()=>setSelected(p)}>
            {p.popular && <div className="pop-pill">POPULAR</div>}
            <div style={{fontSize:32}}>🪙</div>
            <div className="coins">{p.coins} coins</div>
            <div className="label">{p.label}</div>
            {p.bonus>0 && <div className="bonus">+ {p.bonus} bonus coins</div>}
            <div className="price">
              {p.bonus>0 && <s>₹{p.coins}</s>}
              <span>₹{p.price}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:'14px 22px 4px'}}>
        <h3 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,marginBottom:6}}>Recent Activity</h3>
        <div className="tx-list">
          {D2.TRANSACTIONS.map(tx => (
            <div key={tx.id} className="tx-row">
              <div className="tx-ic">{tx.type==='call'?'📞':tx.type==='workshop'?'🎙':'💳'}</div>
              <div className="info">
                <div className="lbl">{tx.label}</div>
                <div className="dt">{tx.date}</div>
              </div>
              <div className={"amt "+(tx.coins>0?'pos':'neg')}>{tx.coins>0?'+':''}{tx.coins} 🪙</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ PROFILE / SETTINGS ============
function ProfileScreen({ goExpert }) {
  const [page, setPage] = React.useState('profile');
  const [tweaks, setTweaks] = React.useState({sound:true,haptics:true,onlineStatus:true,readReceipts:true,push:true,email:false,private:false});
  const toggle = (k) => setTweaks(p=>({...p,[k]:!p[k]}));

  const sections = [
    {gh:'Account',rows:[['profile','👤 Profile'],['security','🔒 Security'],['privacy','🛡 Privacy'],['notif','🔔 Notifications']]},
    {gh:'Experience',rows:[['sound','🎵 Sound & Haptics'],['theme','🎨 Theme'],['language','🌐 Language']]},
    {gh:'Support',rows:[['data','💾 Download my data'],['blocked','🚫 Blocked users'],['muted','🔕 Muted words'],['help','❓ Help & Support'],['become','⭐ Become an expert']]},
  ];

  return (
    <div className="settings-layout">
      <aside className="settings-side">
        {sections.map(s=>(
          <React.Fragment key={s.gh}>
            <div className="gh">{s.gh}</div>
            {s.rows.map(([id,l])=><button key={id} className={"row"+(page===id?' on':'')} onClick={()=>setPage(id)}>{l}</button>)}
          </React.Fragment>
        ))}
        <div className="gh">Session</div>
        <button className="row" style={{color:'var(--red)'}}>↪ Sign out</button>
      </aside>
      <div className="settings-content">
        {page==='profile' && (
          <>
            <div className="card sec">
              <h2>Profile</h2>
              <div style={{display:'flex',gap:18,alignItems:'center',marginBottom:18}}>
                <Avatar user={D2.CURRENT_USER} size={88}/>
                <div>
                  <button className="btn btn-pri btn-icon">{Icon.camera()} Change photo</button>
                  <button className="btn btn-sec" style={{marginLeft:8}}>Remove</button>
                </div>
              </div>
              <div className="field"><label>Full name</label><input defaultValue={D2.CURRENT_USER.name}/></div>
              <div className="field"><label>Username</label><input defaultValue={D2.CURRENT_USER.handle}/></div>
              <div className="field"><label>Headline / role</label><input defaultValue={D2.CURRENT_USER.role}/></div>
              <div className="field"><label>Bio</label><textarea defaultValue={D2.CURRENT_USER.bio}/></div>
              <div className="field"><label>Location</label><input defaultValue={D2.CURRENT_USER.location}/></div>
              <button className="btn btn-pri btn-lg">Save changes</button>
            </div>
            <div className="card sec">
              <h2>Become an expert</h2>
              <p style={{color:'var(--t2)',marginBottom:14}}>Verified experts can host calls and workshops, and earn coins. Apply once you have a portfolio or proof of expertise to share.</p>
              <button className="btn btn-out btn-lg btn-icon">{Icon.shield()} Apply now</button>
            </div>
          </>
        )}
        {page==='sound' && (
          <div className="card sec">
            <h2>Sound & Haptics</h2>
            <div className="toggle-row"><div><div className="ti">App sounds</div><div className="ds">Like, message, typing, notification chimes</div></div><div className={"toggle"+(tweaks.sound?' on':'')} onClick={()=>toggle('sound')}/></div>
            <div className="toggle-row"><div><div className="ti">Haptic feedback</div><div className="ds">Vibration on lever-send, lever-call</div></div><div className={"toggle"+(tweaks.haptics?' on':'')} onClick={()=>toggle('haptics')}/></div>
            {['Like','Notification','Typing','Message'].map(t=>(
              <div key={t} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600}}>{t} sound</div>
                    <div style={{fontSize:12,color:'var(--t2)'}}>Variant: Default · Volume 70%</div>
                  </div>
                  <button className="btn btn-sec">▶ Preview</button>
                </div>
                <input type="range" min="0" max="100" defaultValue="70" className="range"/>
              </div>
            ))}
          </div>
        )}
        {page==='privacy' && (
          <div className="card sec">
            <h2>Privacy</h2>
            <div className="toggle-row"><div><div className="ti">Show online status</div><div className="ds">Others see when you're active</div></div><div className={"toggle"+(tweaks.onlineStatus?' on':'')} onClick={()=>toggle('onlineStatus')}/></div>
            <div className="toggle-row"><div><div className="ti">Read receipts</div><div className="ds">Show when you've read messages</div></div><div className={"toggle"+(tweaks.readReceipts?' on':'')} onClick={()=>toggle('readReceipts')}/></div>
            <div className="toggle-row"><div><div className="ti">Private profile</div><div className="ds">Only followers see your posts</div></div><div className={"toggle"+(tweaks.private?' on':'')} onClick={()=>toggle('private')}/></div>
          </div>
        )}
        {page==='notif' && (
          <div className="card sec">
            <h2>Notifications</h2>
            <div className="toggle-row"><div><div className="ti">Push notifications</div><div className="ds">On this device</div></div><div className={"toggle"+(tweaks.push?' on':'')} onClick={()=>toggle('push')}/></div>
            <div className="toggle-row"><div><div className="ti">Email digest</div><div className="ds">Weekly highlights to your inbox</div></div><div className={"toggle"+(tweaks.email?' on':'')} onClick={()=>toggle('email')}/></div>
            {['New messages','Comments on your posts','Likes','Follows','Live workshops','Expert availability'].map(t=>(
              <div key={t} className="toggle-row"><div><div className="ti">{t}</div></div><div className="toggle on"/></div>
            ))}
          </div>
        )}
        {page==='blocked' && (
          <div className="card sec">
            <h2>Blocked users</h2>
            <p style={{color:'var(--t2)',marginBottom:14}}>You haven't blocked anyone yet.</p>
            <div className="card" style={{background:'var(--bg3)',padding:16,display:'flex',alignItems:'center',gap:12,borderRadius:10}}>
              <div style={{fontSize:24}}>🚫</div>
              <div style={{flex:1}}><div style={{fontWeight:700}}>How blocking works</div><div style={{fontSize:13,color:'var(--t2)'}}>Blocked users can't message you, see your posts, or call you.</div></div>
            </div>
          </div>
        )}
        {page==='muted' && (
          <div className="card sec">
            <h2>Muted words</h2>
            <p style={{color:'var(--t2)',marginBottom:10}}>Posts and comments containing these words won't appear in your feed.</p>
            <div className="chip-input">
              <span className="ch">crypto<span className="x">×</span></span>
              <span className="ch">spoiler<span className="x">×</span></span>
              <input placeholder="Add word and press Enter"/>
            </div>
          </div>
        )}
        {page==='data' && (
          <div className="card sec">
            <h2>Download my data</h2>
            <p style={{color:'var(--t2)',marginBottom:14}}>Get a JSON export of your posts, comments, messages, follows, and call history.</p>
            <button className="btn btn-pri btn-lg btn-icon">{Icon.download()} Request download</button>
          </div>
        )}
        {page==='security' && (
          <div className="card sec">
            <h2>Security</h2>
            <div className="field"><label>Email</label><input defaultValue="john@example.com"/></div>
            <div className="field"><label>New password</label><input type="password" placeholder="••••••••"/></div>
            <div className="toggle-row"><div><div className="ti">Two-factor authentication</div><div className="ds">Use your phone to verify logins</div></div><div className="toggle"/></div>
            <div className="toggle-row"><div><div className="ti">Sign-in alerts</div><div className="ds">Email me on new device sign-in</div></div><div className="toggle on"/></div>
            <button className="btn btn-pri btn-lg">Update security</button>
          </div>
        )}
        {page==='theme' && (
          <div className="card sec">
            <h2>Theme</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {[['Dark','linear-gradient(135deg,#09090E,#1E1E28)','on'],['Light','linear-gradient(135deg,#fff,#e5e5ea)',''],['Auto','linear-gradient(90deg,#09090E 50%,#fff 50%)','']].map(([n,bg,on])=>(
                <div key={n} className={"card"+(on?' popular':'')} style={{padding:14,cursor:'pointer',border:on?'2px solid var(--ac)':'1px solid var(--border)'}}>
                  <div style={{height:80,borderRadius:8,background:bg,border:'1px solid var(--border)',marginBottom:10}}/>
                  <div style={{fontWeight:700}}>{n}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {page==='language' && (
          <div className="card sec">
            <h2>Language</h2>
            <div className="field"><label>Display language</label>
              <select defaultValue="en"><option value="en">English</option><option value="ar">العربية</option><option value="hi">हिन्दी</option><option value="es">Español</option></select>
            </div>
          </div>
        )}
        {page==='help' && (
          <div className="card sec">
            <h2>Help & Support</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[['📚 Help center','Articles & guides'],['💬 Contact support','Reply within 24h'],['🐞 Report a bug','Help us improve'],['💡 Feature request','We listen']].map(([t,d])=>(
                <a key={t} className="card" style={{padding:16}}><div style={{fontWeight:700,marginBottom:4}}>{t}</div><div style={{fontSize:12,color:'var(--t2)'}}>{d}</div></a>
              ))}
            </div>
          </div>
        )}
        {page==='become' && (
          <div className="card sec">
            <h2>Become an expert</h2>
            <p style={{color:'var(--t2)',marginBottom:14}}>Tell us about your expertise. We review applications within 3 business days.</p>
            <div className="field"><label>Field of expertise</label><select><option>Choose...</option><option>Health & Medical</option><option>Tech & Engineering</option><option>Career Coaching</option><option>Legal</option><option>Finance</option><option>Fitness & Wellness</option><option>Design</option><option>Business</option></select></div>
            <div className="field"><label>Years of experience</label><input type="number" placeholder="5"/></div>
            <div className="field"><label>Proposed rate (coins/min)</label><input type="number" placeholder="60"/></div>
            <div className="field"><label>Why people should book you</label><textarea placeholder="Describe your background, certifications, notable work..."/></div>
            <div className="field"><label>Portfolio / LinkedIn URL</label><input placeholder="https://..."/></div>
            <button className="btn btn-pri btn-lg">Submit application</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CALL MODAL ============
function CallModal({ expert, onEnd }) {
  const [phase, setPhase] = React.useState('ringing');
  const [secs, setSecs] = React.useState(0);
  const [coins, setCoins] = React.useState(D2.CURRENT_USER.coins);
  const [muted, setMuted] = React.useState(false);
  const [speaker, setSpeaker] = React.useState(false);

  React.useEffect(() => {
    if (phase!=='ringing') return;
    const t = setTimeout(()=>setPhase('connected'), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  React.useEffect(() => {
    if (phase!=='connected') return;
    const iv = setInterval(()=>{
      setSecs(s=>s+1);
      setCoins(c=>{const nc=c-Math.ceil(expert.rate/60);if(nc<=0){clearInterval(iv);setPhase('ended');}return Math.max(0,nc);});
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, expert.rate]);

  const fmt = s => Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);

  return (
    <div className="call-modal">
      <div className="call-card">
        <div className="call-avatar-wrap">
          {phase==='ringing' && <><div className="ring"/><div className="ring"/></>}
          <Avatar user={expert} size={140}/>
        </div>
        <div className="nm">{expert.name}</div>
        <div className="role">{expert.role}</div>
        {phase==='ringing' && <div className="status" style={{color:'var(--ac)'}}><span className="dt" style={{background:'var(--ac)'}}/>Calling…</div>}
        {phase==='connected' && <div className="status"><span className="dt"/>Connected</div>}
        {phase==='ended' && <div className="status" style={{color:'var(--red)'}}>Call ended — out of coins</div>}
        {phase!=='ringing' && <div className="timer">{fmt(secs)}</div>}
        {phase==='connected' && <div className="coins-info">🪙 {coins} coins remaining · –{expert.rate}/min</div>}
        <div className="call-controls">
          {phase!=='ringing' && <button className={"call-btn"} onClick={()=>setMuted(v=>!v)} title="Mute">{muted?'🔇':'🎙'}</button>}
          <button className="call-btn end" onClick={onEnd}>{Icon.phone()}</button>
          {phase!=='ringing' && <button className="call-btn" onClick={()=>setSpeaker(v=>!v)} title="Speaker">{speaker?'🔊':'🔉'}</button>}
        </div>
      </div>
    </div>
  );
}

// ============ NOTIFICATIONS POPOVER ============
function NotifPopover({ onClose }) {
  return (
    <div style={{position:'fixed',top:60,right:80,zIndex:80,width:380,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,boxShadow:'0 12px 40px rgba(0,0,0,.6)'}}>
      <div className="card-h"><div className="t">Notifications</div><a className="a">Mark all read</a></div>
      <div style={{maxHeight:480,overflowY:'auto'}}>
        {D2.NOTIFICATIONS.map(n=>(
          <div key={n.id} style={{display:'flex',gap:12,padding:'12px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
            <Avatar user={n.from} size={42}/>
            <div style={{flex:1,fontSize:13}}>
              <div><b>{n.from.name}</b> {n.text}</div>
              <div style={{fontSize:11,color:'var(--ac)',marginTop:4}}>{n.time}</div>
            </div>
            <div style={{width:8,height:8,borderRadius:'50%',background:'var(--ac)',marginTop:6}}/>
          </div>
        ))}
      </div>
    </div>
  );
}

window.RD_S2 = { MessagesScreen, WorkshopsScreen, WalletScreen, ProfileScreen, CallModal, NotifPopover, MyProfile };
