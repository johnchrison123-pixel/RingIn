/* eslint-disable */
const { Icon, Avatar, TopNav } = window.RD_C;
const D3 = window.RING_DATA;
const { HomeScreen, ExpertsScreen, ExpertProfile } = window.RD_S1;
const { MessagesScreen, WorkshopsScreen, WalletScreen, ProfileScreen, CallModal, NotifPopover, MyProfile } = window.RD_S2;
const { AnonConnect } = window.RD_CONNECT;

function App() {
  const [tab, setTab] = React.useState('home');
  const [viewedExpert, setViewedExpert] = React.useState(null);
  const [callExpert, setCallExpert] = React.useState(null);
  const [activeConvo, setActiveConvo] = React.useState(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQ, setSearchQ] = React.useState('');

  const goExpert = (e) => { setViewedExpert(e); setTab('expert'); };
  const goMessages = (cv) => { setActiveConvo(cv||null); setTab('messages'); };
  const goWallet = () => setTab('wallet');
  const onCall = (e) => setCallExpert(e);

  React.useEffect(() => {
    const onConnect = () => setTab('connect');
    window.addEventListener('go-connect', onConnect);
    return () => window.removeEventListener('go-connect', onConnect);
  }, []);

  React.useEffect(() => {
    const onKey = (e) => {
      if((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setSearchOpen(true); }
      if(e.key==='Escape') { setSearchOpen(false); setNotifOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ringin-app">
      <TopNav
        active={tab}
        setActive={(t)=>{setTab(t);setNotifOpen(false);}}
        unreadMsg={3}
        unreadNotif={5}
        onProfile={()=>setTab('myprofile')}
        onWallet={goWallet}
        onNotif={()=>setNotifOpen(v=>!v)}
      />
      <main className="app-body">
        {tab==='home' && <HomeScreen goExpert={goExpert} goMessages={goMessages} goWallet={goWallet}/>}
        {tab==='experts' && <ExpertsScreen goExpert={goExpert} onCall={onCall}/>}
        {tab==='expert' && viewedExpert && <ExpertProfile expert={viewedExpert} onBack={()=>setTab('experts')} onCall={onCall} onMessage={(e)=>goMessages('cv'+e.id)}/>}
        {tab==='workshops' && <WorkshopsScreen/>}
        {tab==='messages' && <MessagesScreen initialConvo={activeConvo} onCall={onCall} onViewExpert={goExpert}/>}
        {tab==='wallet' && <WalletScreen onBack={()=>setTab('home')}/>}
        {tab==='profile' && <ProfileScreen goExpert={goExpert}/>}
        {tab==='myprofile' && <MyProfile goExpert={goExpert} goSettings={()=>setTab('profile')} goWallet={goWallet} openCall={onCall}/>}
        {tab==='connect' && <AnonConnect onCall={onCall}/>}
      </main>
      {notifOpen && <NotifPopover onClose={()=>setNotifOpen(false)}/>}
      {callExpert && <CallModal expert={callExpert} onEnd={()=>setCallExpert(null)}/>}
      {searchOpen && (
        <div className="search-modal" onClick={()=>setSearchOpen(false)}>
          <div className="search-box" onClick={e=>e.stopPropagation()}>
            <div className="search-input">
              {Icon.search()}
              <input autoFocus placeholder="Search experts, posts, workshops..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
              <kbd style={{fontSize:11,color:'var(--t3)',padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4}}>ESC</kbd>
            </div>
            <div style={{padding:'8px 0'}}>
              <div style={{padding:'8px 22px 4px',fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700}}>Experts</div>
              {D3.EXPERTS.filter(e=>!searchQ || e.name.toLowerCase().includes(searchQ.toLowerCase()) || e.role.toLowerCase().includes(searchQ.toLowerCase())).slice(0,5).map(e=>(
                <a key={e.id} className="search-row" onClick={()=>{goExpert(e);setSearchOpen(false);}}>
                  <Avatar user={e} size={38} showOnline={e.online}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{e.name}</div>
                    <div style={{fontSize:12,color:'var(--t2)'}}>{e.role}</div>
                  </div>
                  <span style={{fontSize:12,color:'var(--amber)'}}>{e.rate} 🪙/min</span>
                </a>
              ))}
              <div style={{padding:'12px 22px 4px',fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700}}>Quick actions</div>
              <a className="search-row" onClick={()=>{setTab('experts');setSearchOpen(false);}}><span style={{width:38,height:38,borderRadius:'50%',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center'}}>👥</span><div>Browse all experts</div></a>
              <a className="search-row" onClick={()=>{setTab('wallet');setSearchOpen(false);}}><span style={{width:38,height:38,borderRadius:'50%',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center'}}>🪙</span><div>Add coins to wallet</div></a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
