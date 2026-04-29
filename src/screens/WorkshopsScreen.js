import React from 'react';
import '../styles/HomeScreen.css';

const LIVE = [
  {id:1,title:'How to Crack Google Interview',host:'Ravi Menon',viewers:847,free:true,color:'linear-gradient(135deg,#1a1a2e,#534AB7)'},
  {id:2,title:'Managing Anxiety in 2026',host:'Dr. Aisha Malik',viewers:312,free:false,price:20,color:'linear-gradient(135deg,#1a0a2e,#6A4C93)'},
];
const UPCOMING = [
  {id:3,title:'Tax Planning for Freelancers',host:'Carlos Rivera',free:false,price:15,color:'linear-gradient(135deg,#0a1a2e,#1A6B3C)',time:'Tomorrow 3PM'},
  {id:4,title:'Nutrition Myths Debunked',host:'Priya Sharma',free:true,color:'linear-gradient(135deg,#1a0a0e,#C84B8A)',time:'Today 6PM'},
];

export default function WorkshopsScreen(){
  return(
    <div className="hc">
      <div className="topbar">
        <div className="brand">Workshops</div>
        <div className="tbr">
          <div className="wchip"><div className="wc">C</div><span>1,240</span></div>
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
              <div className="wb-actions"><button className="wb-join">Join Live</button></div>
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
                <button style={{flex:1,padding:'6px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>Set Reminder</button>
              </div>
            </div>
          </div>
        )})}
        <div style={{height:'12px'}}/>
      </div>
    </div>
  );
}
