import React, {useState} from 'react';
import '../styles/HomeScreen.css';

const EXPERTS = [
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,online:true,category:'medical',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',loc:'Dubai, UAE'},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,online:true,category:'tech',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',loc:'Remote'},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,online:true,category:'career',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',loc:'Abu Dhabi'},
  {id:4,initials:'JO',name:'James Okafor',role:'Corporate Lawyer',rate:150,rating:4.9,calls:289,online:false,category:'legal',color:'linear-gradient(135deg,#B8860B,#F5A623)',loc:'Dubai, UAE'},
  {id:5,initials:'AM',name:'Dr. Aisha Malik',role:'Clinical Psychologist',rate:100,rating:4.9,calls:521,online:true,category:'psychology',color:'linear-gradient(135deg,#6A4C93,#9B72CF)',loc:'Remote'},
  {id:6,initials:'CR',name:'Carlos Rivera',role:'CFA Wealth Manager',rate:90,rating:4.7,calls:334,online:false,category:'finance',color:'linear-gradient(135deg,#1A6B3C,#27C96A)',loc:'Remote'},
  {id:7,initials:'PS',name:'Priya Sharma',role:'Registered Dietitian',rate:70,rating:4.9,calls:298,online:true,category:'nutrition',color:'linear-gradient(135deg,#8B1A4A,#E84D9A)',loc:'Dubai, UAE'},
  {id:8,initials:'DK',name:'David Kim',role:'IT Support & Security',rate:60,rating:4.7,calls:412,online:true,category:'tech',color:'linear-gradient(135deg,#1a3a5c,#2196F3)',loc:'Remote'},
];

const CATS = [
  {id:'all',icon:'✦',label:'All'},
  {id:'medical',icon:'🩺',label:'Medical'},
  {id:'tech',icon:'💻',label:'Tech'},
  {id:'legal',icon:'⚖️',label:'Legal'},
  {id:'career',icon:'🎯',label:'Career'},
  {id:'psychology',icon:'🧠',label:'Mental'},
  {id:'finance',icon:'💹',label:'Finance'},
  {id:'nutrition',icon:'🥗',label:'Nutrition'},
];

export default function SearchScreen(){
  const [ac, setAc] = useState('all');
  const [query, setQuery] = useState('');
  
  const filtered = EXPERTS.filter(function(e){
    const matchCat = ac === 'all' || e.category === ac;
    const matchQ = e.name.toLowerCase().includes(query.toLowerCase()) || e.role.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return(
    <div className="hc">
      <div className="topbar">
        <div className="brand">Experts</div>
        <div className="tbr">
          <div className="wchip"><div className="wc">C</div><span>1,240</span></div>
        </div>
      </div>
      <div className="sbwrap">
        <div className="sbar">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" width="13" height="13"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search experts..." value={query} onChange={function(e){setQuery(e.target.value)}}/>
        </div>
      </div>
      <div className="cats">
        {CATS.map(function(c){return(
          <div key={c.id} className={"cp"+(ac===c.id?" on":"")} onClick={function(){setAc(c.id)}}>
            <div className="ci">{c.icon}</div>
            <div className="cl">{c.label}</div>
          </div>
        )})}
      </div>
      <div className="sh">
        <div className="st">{ac==='all'?'All Experts':CATS.find(function(c){return c.id===ac})?.label}</div>
        <div className="sa">{filtered.length} available</div>
      </div>
      <div style={{padding:'0 18px',overflowY:'auto'}}>
        {filtered.map(function(e){return(
          <div key={e.id} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'11px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'11px',cursor:'pointer',transition:'border-color .2s'}}>
            <div style={{width:'42px',height:'42px',borderRadius:'50%',background:e.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0,position:'relative'}}>
              {e.initials}
              {e.online && <div style={{position:'absolute',bottom:0,right:0,width:'9px',height:'9px',borderRadius:'50%',background:'var(--green)',border:'2px solid var(--bg3)'}}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'2px'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:'var(--text)'}}>{e.name}</span>
                <span style={{fontSize:'9px',fontWeight:600,color:'#fff',background:'linear-gradient(135deg,#1877F2,#42B3FF)',padding:'1px 5px',borderRadius:'20px'}}>✓ Verified</span>
              </div>
              <div style={{fontSize:'10px',color:'var(--t2)',marginBottom:'3px'}}>{e.role}</div>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                {e.online ? <span style={{display:'inline-flex',alignItems:'center',gap:'2px',fontSize:'9px',color:'var(--green)',background:'rgba(39,201,106,.1)',padding:'1px 5px',borderRadius:'20px'}}><span style={{width:'4px',height:'4px',borderRadius:'50%',background:'var(--green)',display:'inline-block'}}/>Online</span> : <span style={{fontSize:'9px',color:'var(--t3)'}}>Offline</span>}
                <span style={{fontSize:'9px',color:'var(--amber)',fontWeight:600}}>{e.rate} coins/min</span>
                <span style={{fontSize:'9px',color:'var(--t2)'}}>★{e.rating}</span>
                <span style={{fontSize:'9px',color:'var(--t2)',background:'var(--bg4)',padding:'1px 5px',borderRadius:'20px'}}>{e.loc}</span>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'5px',flexShrink:0}}>
              <button style={{padding:'5px 12px',background:'var(--ac)',border:'none',borderRadius:'7px',color:'#fff',fontSize:'10px',fontWeight:600,cursor:'pointer'}}>Call</button>
              <button style={{padding:'5px 12px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'7px',color:'var(--text)',fontSize:'10px',fontWeight:600,cursor:'pointer'}}>Follow</button>
            </div>
          </div>
        )})}
        <div style={{height:'12px'}}/>
      </div>
    </div>
  );
}
