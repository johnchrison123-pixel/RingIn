import React,{useState} from "react";
import "../styles/HomeScreen.css";
const CATS=[{id:"all",icon:"All",label:"All"},{id:"medical",icon:"Med",label:"Medical"},{id:"tech",icon:"Tech",label:"Tech"},{id:"legal",icon:"Law",label:"Legal"},{id:"trades",icon:"Fix",label:"Trades"},{id:"mental",icon:"Mind",label:"Mental"}];
const EXPERTS=[{id:1,initials:"PN",name:"Dr. Priya Nair",role:"General Physician",rate:120,rating:4.9,online:true,category:"medical",color:"linear-gradient(135deg,#1D9E75,#5DCAA5)"},{id:2,initials:"RM",name:"Ravi Menon",role:"Sr. Software Engineer",rate:80,rating:4.8,online:true,category:"tech",color:"linear-gradient(135deg,#534AB7,#7C6FFF)"},{id:3,initials:"SA",name:"Sara Al Zaabi",role:"Career Coach",rate:60,rating:4.7,online:true,category:"mental",color:"linear-gradient(135deg,#C84B8A,#E84D9A)"}];
export default function HomeScreen(){
  const [ac,setAc]=useState("all");
  const fe=ac==="all"?EXPERTS:EXPERTS.filter(e=>e.category===ac);
  return(
    <div className="hc">
      <div className="topbar">
        <div className="brand">RingIn</div>
        <div className="tbr">
          <div className="wchip"><div className="wc">C</div><span>1,240</span></div>
        </div>
      </div>
      <div className="sbwrap">
        <div className="sbar"><input placeholder="Search experts, topics, skills..."/></div>
        <div className="frow">{["All Locations","Dubai","Abu Dhabi","Online Only"].map(f=>(<div key={f} className={"ftag"+(f==="All Locations"?" on":"")}>{f}</div>))}</div>
      </div>
      <div className="sh"><div className="st">Categories</div><div className="sa">See all</div></div>
      <div className="cats">{CATS.map(c=>(<div key={c.id} className={"cp"+(ac===c.id?" on":"")} onClick={()=>setAc(c.id)}><div className="ci">{c.icon}</div><div className="cl">{c.label}</div></div>))}</div>
      <div className="sh"><div className="st">Online Now</div><div className="sa">See all</div></div>
      <div className="esc">{fe.filter(e=>e.online).map(e=>(<div key={e.id} className="ecsm"><div className="eav" style={{background:e.color}}>{e.initials}<div className="or"/></div><div className="enm">{e.name}</div><div className="erl">{e.role}</div><div style={{fontSize:"9px",color:"var(--amber)",marginBottom:"4px"}}>{e.rate} coins/min</div><button className="cbtn">Call Now</button></div>))}</div>
      <div style={{height:"12px"}}/>
    </div>
  );
}
