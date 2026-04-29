import React from 'react';

export default function ProfileScreen({session, supabase}){
  var email = session && session.user ? session.user.email : '';
  var initials = email ? email.substring(0,2).toUpperCase() : 'ME';

  return React.createElement('div', {style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div', {style:{height:'120px',background:'linear-gradient(135deg,#534AB7,#7C6FFF)',position:'relative',flexShrink:0}},
      React.createElement('div', {style:{position:'absolute',bottom:'-30px',left:'18px',width:'64px',height:'64px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)'}}, initials)
    ),
    React.createElement('div', {style:{padding:'40px 18px 12px'}},
      React.createElement('div', {style:{fontSize:'16px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}}, email),
      React.createElement('div', {style:{fontSize:'11px',color:'var(--t2)',marginBottom:'12px'}}, 'Member since April 2026'),
      React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        React.createElement('div', {style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'18px',fontWeight:800,color:'var(--text)'}}, '0'),
          React.createElement('div', {style:{fontSize:'10px',color:'var(--t2)'}}, 'Calls')
        ),
        React.createElement('div', {style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'18px',fontWeight:800,color:'var(--text)'}}, '50'),
          React.createElement('div', {style:{fontSize:'10px',color:'var(--t2)'}}, 'Coins')
        ),
        React.createElement('div', {style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
          React.createElement('div', {style:{fontSize:'18px',fontWeight:800,color:'var(--text)'}}, '0'),
          React.createElement('div', {style:{fontSize:'10px',color:'var(--t2)'}}, 'Reviews')
        )
      ),
      React.createElement('div', {style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}},
        [
          {icon:'🎓',label:'Become an Expert',sub:'Start earning by sharing your knowledge'},
          {icon:'🔔',label:'Notifications',sub:'Manage your alerts'},
          {icon:'🔒',label:'Privacy & Security',sub:'Password, 2FA, data'},
          {icon:'💬',label:'Help & Support',sub:'FAQs and contact us'},
          {icon:'⭐',label:'Rate the App',sub:'Enjoying RingIn? Let us know!'},
        ].map(function(item, i){
          return React.createElement('div', {key:i, style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}},
            React.createElement('span', {style:{fontSize:'18px',width:'28px',textAlign:'center'}}, item.icon),
            React.createElement('div', {style:{flex:1}},
              React.createElement('div', {style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}}, item.label),
              React.createElement('div', {style:{fontSize:'10px',color:'var(--t2)'}}, item.sub)
            ),
            React.createElement('span', {style:{color:'var(--t3)',fontSize:'16px'}}, '›')
          );
        })
      ),
      React.createElement('button', {
        style:{width:'100%',padding:'13px',background:'rgba(239,71,71,.1)',border:'1px solid rgba(239,71,71,.3)',borderRadius:'12px',color:'var(--red)',fontSize:'14px',fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif'},
        onClick:function(){supabase.auth.signOut();}
      }, 'Sign Out')
    )
  );
}
