/* eslint-disable */
const { Icon, Avatar, VerifiedBadge } = window.RD_C;
const D = window.RING_DATA;

// ============ HOME ============
function HomeScreen({ goExpert, goMessages, goWallet }) {
  const [filter, setFilter] = React.useState('all');
  const [posts, setPosts] = React.useState(D.POSTS);
  const [composerOpen, setComposerOpen] = React.useState(false);

  const toggleLike = (id) => setPosts(ps => ps.map(p => p.id===id ? {...p, liked: !p.liked, likes: p.likes + (p.liked?-1:1)} : p));

  const filters = ['All','Following','Trending','Health','Tech','Career','Finance'];

  return (
    <div className="three-col">
      {/* LEFT RAIL */}
      <aside className="rail">
        <div className="card me-card">
          <div className="me-cover" style={{background:D.CURRENT_USER.cover}}/>
          <Avatar user={D.CURRENT_USER} size={72}/>
          <div className="nm">{D.CURRENT_USER.name}</div>
          <div className="ml">{D.CURRENT_USER.role}</div>
          <div className="stats">
            <div><div className="v">{D.CURRENT_USER.posts}</div><div className="l">Posts</div></div>
            <div><div className="v">{D.CURRENT_USER.followers}</div><div className="l">Followers</div></div>
            <div><div className="v">{D.CURRENT_USER.following}</div><div className="l">Following</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><div className="t">Shortcuts</div></div>
          <div className="shortcut-list">
            <a className="shortcut" onClick={goWallet}>{Icon.wallet()}<span>My Wallet</span><span className="badge">🪙 {D.CURRENT_USER.coins}</span></a>
            <a className="shortcut">{Icon.play()}<span>Live Workshops</span><span className="badge">2 live</span></a>
            <a className="shortcut">{Icon.bookmark()}<span>Saved Posts</span></a>
            <a className="shortcut">{Icon.star()}<span>Following Experts</span></a>
            <a className="shortcut" onClick={()=>window.dispatchEvent(new CustomEvent('go-connect'))} style={{cursor:'pointer'}}>{Icon.phone()}<span>Anonymous Connect</span><span className="badge" style={{background:'linear-gradient(90deg,#7B6EFF,#E84D9A)',color:'#fff'}}>NEW</span></a>
            <a className="shortcut">{Icon.shield()}<span>Become an Expert</span></a>
            <a className="shortcut">{Icon.settings()}<span>Settings</span></a>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><div className="t">Trending Topics</div></div>
          <div style={{padding:'4px 8px 14px'}}>
            {[
              ['#SystemDesign','142 posts'],
              ['#AnxietyTools','98 posts'],
              ['#CareerSwitch','76 posts'],
              ['#IndexFunds','54 posts'],
            ].map(([t,c])=>(
              <a key={t} className="shortcut" style={{justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--ac)'}}>{t}</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>{c}</div>
                </div>
                {Icon.trend()}
              </a>
            ))}
          </div>
        </div>
      </aside>

      {/* CENTER */}
      <main className="center-col">
        <div className="card composer">
          <div className="composer-top">
            <Avatar user={D.CURRENT_USER} size={42}/>
            <div className="composer-input" onClick={()=>setComposerOpen(true)}>What's on your mind, {D.CURRENT_USER.name.split(' ')[0]}?</div>
          </div>
          <div className="composer-actions">
            <button className="composer-act"><span className="ico" style={{color:'#22c55e'}}>{Icon.image()}</span>Photo / Video</button>
            <button className="composer-act"><span className="ico" style={{color:'#facc15'}}>{Icon.smile()}</span>Feeling / Activity</button>
            <button className="composer-act"><span className="ico" style={{color:'var(--pink)'}}>{Icon.video()}</span>Go Live</button>
          </div>
        </div>

        <div className="card" style={{marginTop:16,marginBottom:16}}>
          <div className="filters">
            {filters.map(f => (
              <button key={f} className={"chip"+(filter===f.toLowerCase()?' on':'')} onClick={()=>setFilter(f.toLowerCase())}>{f}</button>
            ))}
          </div>
        </div>

        {posts.map(p => <Post key={p.id} post={p} onLike={()=>toggleLike(p.id)} onMessage={()=>goMessages('cv'+p.user.id)} onView={()=>goExpert(p.user)}/>)}
      </main>

      {/* RIGHT RAIL */}
      <aside className="rail">
        <div className="card">
          <div className="card-h"><div className="t">Online Experts</div><a className="a" onClick={()=>{}}>See all</a></div>
          <div className="online-list">
            {D.EXPERTS.filter(e=>e.online).slice(0,6).map(e=>(
              <div key={e.id} className="online-row">
                <Avatar user={e} size={36} showOnline={true}/>
                <div className="info">
                  <div className="nm">{e.name}</div>
                  <div className="role">{e.role}</div>
                  <div className="rate">{e.rate} 🪙/min</div>
                </div>
                <button className="call-pill" onClick={()=>goExpert(e)}>{Icon.phone()}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><div className="t">Live Now</div><a className="a">All</a></div>
          {D.WORKSHOPS.filter(w=>w.live).slice(0,2).map(w=>(
            <div key={w.id} className="workshop-rail-card" style={{borderTop:'1px solid var(--border)'}}>
              <div className="img" style={{background:w.cover}}>🎙</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.title}</div>
                <div style={{fontSize:11,color:'var(--t2)'}}>by {w.host.name.split(' ').slice(-1)}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                  <span className="live"><span className="ld"/>LIVE</span>
                  <span style={{fontSize:11,color:'var(--t3)'}}>{w.viewers.toLocaleString()} watching</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><div className="t">Suggested for You</div></div>
          <div className="online-list">
            {D.EXPERTS.slice(6,9).map(e=>(
              <div key={e.id} className="online-row">
                <Avatar user={e} size={36} showOnline={e.online}/>
                <div className="info">
                  <div className="nm">{e.name}</div>
                  <div className="role">{e.role}</div>
                </div>
                <button className="btn btn-sec" style={{padding:'5px 12px',fontSize:11}}>+ Follow</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:'var(--t3)',padding:'4px 12px',lineHeight:1.6}}>
          About · Help · Privacy · Terms · Cookies · Become Expert · Wallet · Workshops · © 2026 RingIn
        </div>
      </aside>
    </div>
  );
}

function Post({ post, onLike, onMessage, onView }) {
  const [showComments, setShowComments] = React.useState(false);
  const [commentText, setCommentText] = React.useState('');
  const cs = D.COMMENTS_BY_POST[post.id] || [];
  return (
    <div className="card" style={{marginBottom:16}}>
      <div className="post">
        <div className="post-head">
          <Avatar user={post.user} size={42} showOnline={post.user.online}/>
          <div onClick={onView} style={{cursor:'pointer'}}>
            <div className="nm" style={{display:'flex',alignItems:'center',gap:6}}>{post.user.name} {post.user.verified && <VerifiedBadge/>}</div>
            <div className="meta"><span>{post.user.role}</span><span className="dot"/><span>{post.time}</span><span className="dot"/><span>🌐</span></div>
          </div>
          <button className="menu">{Icon.more()}</button>
        </div>
        <div className="post-text">{post.text}</div>
        {post.tags && <div className="post-tags">{post.tags.map(t=><span key={t} className="post-tag">#{t.replace(/\s/g,'')}</span>)}</div>}
        {post.img && <div className="post-img"><img src={post.img} alt=""/></div>}
        <div className="post-stats">
          <div className="l"><span className="heart">❤</span><span>{post.likes.toLocaleString()}</span></div>
          <div className="l"><span>{post.comments} comments</span></div>
        </div>
      </div>
      <div className="post-acts" style={{padding:'4px 16px 6px'}}>
        <button className={"post-act"+(post.liked?' liked':'')} onClick={onLike}>{Icon.heart(post.liked)} <span>Like</span></button>
        <button className="post-act" onClick={()=>setShowComments(v=>!v)}>{Icon.comment()} <span>Comment</span></button>
        <button className="post-act" onClick={onMessage}>{Icon.send()} <span>Message</span></button>
        <button className="post-act">{Icon.share()} <span>Share</span></button>
      </div>
      {showComments && (
        <div className="comments">
          <div className="comment-input">
            <Avatar user={D.CURRENT_USER} size={32}/>
            <input placeholder="Write a comment..." value={commentText} onChange={e=>setCommentText(e.target.value)}/>
          </div>
          {cs.map(c => (
            <div key={c.id} className="comment-row">
              <Avatar user={c.user} size={32}/>
              <div style={{flex:1}}>
                <div className="comment-bubble">
                  <div className="nm">{c.user.name}</div>
                  <div className="tx">{c.text}</div>
                </div>
                <div className="comment-meta"><span>Like</span><span>Reply</span><span>{c.time}</span><span style={{marginLeft:'auto',color:'var(--pink)'}}>❤ {c.likes}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ EXPERTS ============
function ExpertsScreen({ goExpert, onCall }) {
  const [cat, setCat] = React.useState('all');
  const [sort, setSort] = React.useState('relevant');
  const list = cat==='all' ? D.EXPERTS : D.EXPERTS.filter(e=>e.cat===cat);

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="t brand-grad">Experts</div>
          <div className="s">Connect with verified specialists. Pay per minute, on-demand.</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <select className="btn btn-sec" style={{padding:'8px 12px'}} value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="relevant">Most relevant</option>
            <option value="rating">Top rated</option>
            <option value="cheapest">Cheapest</option>
            <option value="online">Online now</option>
          </select>
        </div>
      </div>
      <div className="experts-layout">
        <aside className="filters-side">
          <div className="gh">Category</div>
          {D.CATEGORIES.map(c => (
            <button key={c.id} className={"cat-row"+(cat===c.id?' on':'')} onClick={()=>setCat(c.id)}>
              <span className="icn">{c.icon}</span><span>{c.label}</span>
            </button>
          ))}
          <div className="gh">Availability</div>
          <button className="cat-row"><span className="icn">🟢</span><span>Online now</span></button>
          <button className="cat-row"><span className="icn">⏰</span><span>Available today</span></button>
          <div className="gh">Price (coins/min)</div>
          <input type="range" min="0" max="200" defaultValue="200" className="range" style={{margin:'8px 12px'}}/>
        </aside>
        <div className="experts-grid">
          {list.map(e => (
            <div key={e.id} className="expert-card" onClick={()=>goExpert(e)}>
              <div className="expert-cover" style={{background:e.cover}}/>
              <div className="expert-body">
                <Avatar user={e} size={64} showOnline={e.online}/>
                <div className="nm">{e.name} {e.verified && <VerifiedBadge/>}</div>
                <div className="rl">{e.role} · {e.loc}</div>
                <div className="meta"><span className="rate">{e.rate} 🪙/min</span><span className="star">★ {e.rating}</span><span>{e.calls} calls</span></div>
                <div className="tags">{e.tags.slice(0,3).map(t=><span key={t}>{t}</span>)}</div>
                <div className="actions">
                  <button className="btn btn-pri btn-fl" onClick={(ev)=>{ev.stopPropagation();onCall(e);}}>{Icon.phone()} Call</button>
                  <button className="btn btn-sec" onClick={(ev)=>ev.stopPropagation()}>+ Follow</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ EXPERT PROFILE ============
function ExpertProfile({ expert, onBack, onCall, onMessage }) {
  const [tab, setTab] = React.useState('about');
  const [following, setFollowing] = React.useState(false);
  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-hero-bg" style={{background:expert.cover}}/>
        <div className="profile-hero-grid">
          <Avatar user={expert} size={128} showOnline={expert.online}/>
          <div className="meta">
            <h1>{expert.name} {expert.verified && <VerifiedBadge/>}</h1>
            <div className="role">{expert.role}</div>
            <div className="id-chips">
              <span>{Icon.pin()} {expert.loc}</span>
              <span>★ <b style={{color:'var(--text)'}}>{expert.rating}</b> · {expert.calls} calls</span>
              <span><b style={{color:'var(--text)'}}>{expert.followers}</b> followers</span>
              <span className="live"><span className="ld"/>{expert.online?'Online now':'Offline'}</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-sec btn-icon" onClick={onBack}>{Icon.back()} Back</button>
            <button className={"btn btn-icon "+(following?'btn-out':'btn-pri')} onClick={()=>setFollowing(v=>!v)}>{following?'✓ Following':'+ Follow'}</button>
            <button className="btn btn-sec btn-icon" onClick={()=>onMessage(expert)}>{Icon.msg()} Message</button>
            <button className="btn btn-pri btn-icon" onClick={()=>onCall(expert)}>{Icon.phone()} Call · {expert.rate} 🪙/min</button>
          </div>
        </div>
      </div>
      <div className="profile-tabs">
        {['about','posts','reviews','availability'].map(t => (
          <button key={t} className={"profile-tab"+(tab===t?' on':'')} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <div className="profile-grid">
        <aside className="card profile-info-card">
          <h3>About</h3>
          <div className="bio">{expert.bio}</div>
          <div className="info-row">{Icon.pin()}<span>Lives in <b>{expert.loc}</b></span></div>
          <div className="info-row">{Icon.globe()}<span>Speaks English, Arabic</span></div>
          <div className="info-row">{Icon.shield()}<span>Verified expert</span></div>
          <div className="stat-grid">
            <div className="stat-cell"><div className="v">★{expert.rating}</div><div className="l">Rating</div></div>
            <div className="stat-cell"><div className="v">{expert.calls}</div><div className="l">Calls</div></div>
            <div className="stat-cell"><div className="v">{expert.followers}</div><div className="l">Followers</div></div>
            <div className="stat-cell"><div className="v">{expert.rate}</div><div className="l">Coins/min</div></div>
          </div>
          <h3 style={{marginTop:16}}>Specializes in</h3>
          <div className="tag-list">{expert.tags.map(t=><span key={t}>{t}</span>)}</div>
        </aside>
        <div>
          {tab==='about' && (
            <div className="card" style={{padding:18,marginBottom:16}}>
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,marginBottom:10}}>What you'll get</h3>
              <ul style={{paddingLeft:0,listStyle:'none',display:'flex',flexDirection:'column',gap:10}}>
                {['1-on-1 video or voice call, on-demand','Personalized advice based on your specific situation','Follow-up notes shared after the session','Free 2-min preview if rating drops below ★ 4'].map((t,i)=>(
                  <li key={i} style={{display:'flex',alignItems:'flex-start',gap:10,fontSize:14,color:'var(--text)'}}>
                    <span style={{color:'var(--green)',marginTop:2}}>{Icon.check()}</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab==='posts' && D.POSTS.filter(p=>p.user.id===expert.id).map(p=><Post key={p.id} post={p} onLike={()=>{}}/>)}
          {tab==='posts' && D.POSTS.filter(p=>p.user.id===expert.id).length===0 && (
            <div className="card" style={{padding:24,textAlign:'center',color:'var(--t2)'}}>No posts yet from {expert.name.split(' ')[0]}.</div>
          )}
          {tab==='reviews' && (
            <div className="card" style={{padding:18}}>
              {[
                {n:'Aisha P.',av:'https://i.pravatar.cc/100?img=20',t:'Incredibly clear and patient. Walked me through my situation step by step.',r:5,d:'2 days ago'},
                {n:'Karan B.',av:'https://i.pravatar.cc/100?img=53',t:'Worth every coin. Booked again.',r:5,d:'1 week ago'},
                {n:'Sam K.',av:'https://i.pravatar.cc/100?img=58',t:'Got real advice, not generic answers.',r:4,d:'2 weeks ago'},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                  <Avatar user={{img:r.av,name:r.n}} size={42}/>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <b style={{fontSize:14}}>{r.n}</b>
                      <span style={{fontSize:12,color:'var(--amber)'}}>{'★'.repeat(r.r)}</span>
                      <span style={{fontSize:12,color:'var(--t3)',marginLeft:'auto'}}>{r.d}</span>
                    </div>
                    <div style={{fontSize:13,lineHeight:1.5}}>{r.t}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==='availability' && (
            <div className="card" style={{padding:18}}>
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,marginBottom:14}}>This week</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8}}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>(
                  <div key={d} style={{textAlign:'center',padding:10,background:i<5?'var(--bg3)':'var(--bg4)',borderRadius:8,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:11,color:'var(--t3)'}}>{d}</div>
                    <div style={{fontSize:13,fontWeight:700,marginTop:2,color:i<5?'var(--green)':'var(--t3)'}}>{i<5?'9-6':'Off'}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,fontSize:13,color:'var(--t2)'}}>Average response time: <b style={{color:'var(--text)'}}>2 minutes</b></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.RD_S1 = { HomeScreen, ExpertsScreen, ExpertProfile, Post };
