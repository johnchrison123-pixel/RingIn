import React,{useState} from 'react';
import LiveWorkshopScreen from './LiveWorkshopScreen';
import '../styles/HomeScreen.css';
import TopBarAvatar from '../components/TopBarAvatar';
import {sb} from '../utils/supabase';
import {useCoinBalance} from '../utils/coinBalance';
import {toastSuccess, toastInfo} from '../utils/toast';

// FIX #7: persist reminder request to localStorage. No scheduling here —
// just records the intent so we don't ship a button that does nothing.
function setWorkshopReminder(workshopId){
  try {
    var key = 'ringin_workshop_reminders';
    var cur = [];
    try { var s = localStorage.getItem(key); if (s) cur = JSON.parse(s); if (!Array.isArray(cur)) cur = []; } catch(_){ cur = []; }
    if (cur.indexOf(workshopId) >= 0) { toastInfo('Reminder already set'); return; }
    cur.push(workshopId);
    localStorage.setItem(key, JSON.stringify(cur));
    toastSuccess('⏰ Reminder set');
  } catch(_) {
    toastInfo('Could not save reminder');
  }
}

const LIVE = [
  {id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},
  {id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'},
];
const UPCOMING = [
  {id:3,title:'Tax Planning for Freelancers',host:'Carlos Rivera',free:false,price:15,color:'linear-gradient(135deg,#0a1a2e,#1A6B3C)',time:'Tomorrow 3PM'},
  {id:4,title:'Nutrition Myths Debunked',host:'Priya Sharma',free:true,color:'linear-gradient(135deg,#1a0a0e,#C84B8A)',time:'Today 6PM'},
];

export default function WorkshopsScreen(props){
  var lS=useState(null); var live=lS[0]; var setLive=lS[1];
  // Shared coin balance — synced with Home / Messages / Search / Wallet.
  // Hooks MUST be called before any conditional return, so this lives
  // above the live-workshop early return below.
  var session = props && props.session;
  var userId = session && session.user ? session.user.id : null;
  var coinBal = useCoinBalance(userId, sb);
  if(live) return React.createElement(LiveWorkshopScreen,{workshop:live,onLeave:function(){setLive(null);}});
  return(
    <div className="hc">
      <div className="topbar">
        <div className="brand">Workshops</div>
        <div className="tbr">
          <div className="wchip" onClick={function(){if(props&&props.onOpenWallet)props.onOpenWallet();}} style={{cursor:'pointer'}}>
            <div className="wc">C</div><span>{(Number(coinBal)||0).toLocaleString()}</span>
          </div>
          <TopBarAvatar
            session={props.session}
            onClick={function(){if(props&&props.onOpenProfile)props.onOpenProfile();}}
          />
        </div>
      </div>
      <div style={{padding:'0 18px',overflowY:'auto'}}>
        <div className="sh" style={{marginTop:'8px'}}><div className="st">Live Now</div></div>
        {LIVE.map(function(w){return(
          <div key={w.id} className="wb-card">
            <div className="wb-cover" style={{background:w.color}}>
              <div className="wb-live-badge"><div className="wb-live-dot"/>LIVE</div>
              <div className="wb-viewers">{w.viewers} viewers</div>
            </div>
            <div className="wb-info">
              <div className="wb-title">{w.title}</div>
              <div className="wb-meta">
                <span className="wb-host">by {w.host}</span>
                {w.free ? <span className="wb-free">FREE</span> : <span style={{fontSize:'10px',color:'var(--ac)',background:'var(--acg)',padding:'2px 7px',borderRadius:'20px'}}>{w.price} coins</span>}
              </div>
              <div className="wb-actions"><button className="wb-join" onClick={()=>setLive(w)}>Join Live</button></div>
            </div>
          </div>
        )})}
        <div className="sh" style={{marginTop:'8px'}}><div className="st">Upcoming</div></div>
        {UPCOMING.map(function(w){return(
          <div key={w.id} className="wb-card">
            <div className="wb-cover" style={{background:w.color}}>
              <div style={{position:'absolute',top:'8px',left:'8px',background:'var(--amber)',color:'#fff',fontSize:'9px',fontWeight:700,padding:'2px 7px',borderRadius:'20px'}}>SOON</div>
            </div>
            <div className="wb-info">
              <div className="wb-title">{w.title}</div>
              <div className="wb-meta">
                <span className="wb-host">by {w.host}</span>
                {w.free ? <span className="wb-free">FREE</span> : <span style={{fontSize:'10px',color:'var(--ac)',background:'var(--acg)',padding:'2px 7px',borderRadius:'20px'}}>{w.price} coins</span>}
                <span style={{fontSize:'10px',color:'var(--t2)'}}>{w.time}</span>
              </div>
              <div className="wb-actions">
                <button onClick={function(){setWorkshopReminder(w.id);}} style={{flex:1,padding:'6px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>Set Reminder</button>
              </div>
            </div>
          </div>
        )})}
        <div style={{height:'12px'}}/>
      </div>
    </div>
  );
}
