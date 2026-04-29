import React,{useState} from 'react';
const CONVOS = [
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',last:'Thank you for your question!',time:'2m ago',unread:2},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',last:'I will send you the resources.',time:'1h ago',unread:0},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',last:'Great progress! Keep it up.',time:'Yesterday',unread:1},
  {id:4,initials:'JO',name:'James Okafor',role:'Corporate Lawyer',color:'linear-gradient(135deg,#B8860B,#F5A623)',last:'The contract looks good.',time:'2 days ago',unread:0},
];
export default function MessagesScreen(){
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"var(--bg)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px 7px"}}>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:"21px",fontWeight:800,background:"linear-gradient(135deg,#7B6EFF,#E84D9A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Messages</div>
        <div style={{display:"flex",alignItems:"center",gap:"5px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"20px",padding:"4px 10px",fontSize:"12px",color:"var(--text)"}}><div style={{width:"15px",height:"15px",borderRadius:"50%",background:"linear-gradient(135deg,#F5A623,#f97316)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px",color:"#fff",fontWeight:700}}>C</div><span>1,240</span></div>
      </div>
      <div style={{padding:"0 16px",overflowY:"auto",flex:1}}>
        {CONVOS.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:"11px",padding:"11px 0",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
            <div style={{width:"42px",height:"42px",borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:700,color:"#fff",flexShrink:0}}>{c.initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}>
                <span style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{c.name}</span>
                <span style={{fontSize:"10px",color:"var(--t3)"}}>{c.time}</span>
              </div>
              <div style={{fontSize:"10px",color:"var(--t2)",marginBottom:"2px"}}>{c.role}</div>
              <div style={{fontSize:"11px",color:"var(--t3)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.last}</div>
            </div>
            {c.unread>0&&<div style={{width:"18px",height:"18px",borderRadius:"50%",background:"var(--ac)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:700,color:"#fff",flexShrink:0}}>{c.unread}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
