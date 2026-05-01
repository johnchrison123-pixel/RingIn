/* eslint-disable */
import React,{useState} from 'react';

var PACKAGES=[
  {id:1,coins:100,price:100,label:'Starter',bonus:0,popular:false},
  {id:2,coins:200,price:200,label:'Basic',bonus:0,popular:false},
  {id:3,coins:500,price:500,label:'Popular',bonus:0,popular:true},
  {id:4,coins:1000,price:900,label:'Best Value',bonus:100,popular:false},
  {id:5,coins:2000,price:1700,label:'Power',bonus:300,popular:false},
];

var TRANSACTIONS=[
  {id:1,type:'call',label:'Call with Dr. Priya Nair',coins:-24,date:'Today, 2:15 PM'},
  {id:2,type:'purchase',label:'Purchased 500 coins',coins:500,date:'Today, 1:00 PM'},
  {id:3,type:'call',label:'Call with Ravi Menon',coins:-36,date:'Yesterday'},
  {id:4,type:'purchase',label:'Purchased 100 coins',coins:100,date:'Apr 27'},
];

export default function WalletScreen(props){
  var onBack = props.onBack;
  var balS=useState(1240); var balance=balS[0];
  var selS=useState(null); var selected=selS[0]; var setSelected=selS[1];
  var payS=useState('card'); var payMethod=payS[0]; var setPayMethod=payS[1];
  var upiS=useState(''); var upiId=upiS[0]; var setUpiId=upiS[1];
  var cardS=useState({number:'',expiry:'',cvv:'',name:''}); var card=cardS[0]; var setCard=cardS[1];
  var doneS=useState(false); var done=doneS[0]; var setDone=doneS[1];

  function updateCard(field,val){setCard(function(p){return Object.assign({},p,{[field]:val});});}

  if(done) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',alignItems:'center',justifyContent:'center',padding:'32px'}},
    React.createElement('div',{style:{fontSize:'56px',marginBottom:'16px'}},'🎉'),
    React.createElement('div',{style:{fontSize:'20px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}},'Payment Successful!'),
    React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'4px'}},'You received'),
    React.createElement('div',{style:{fontSize:'32px',fontWeight:800,color:'var(--ac)',marginBottom:'24px'}},'🪙 '+selected.coins+' coins'),
    React.createElement('button',{onClick:function(){setSelected(null);setDone(false);setUpiId('');setCard({number:'',expiry:'',cvv:'',name:''}); },style:{padding:'12px 32px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer'}},'Back to Wallet')
  );

  if(selected) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{padding:'14px 18px',display:'flex',alignItems:'center',gap:'10px',borderBottom:'1px solid var(--border)'}},
      React.createElement('button',{onClick:function(){setSelected(null);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'0 6px 0 0'}},'<'),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Buy Coins')
    ),
    React.createElement('div',{style:{margin:'16px 18px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',textAlign:'center'}},
      React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'4px'}},'You are buying'),
      React.createElement('div',{style:{fontSize:'28px',fontWeight:800,color:'var(--ac)',marginBottom:'4px'}},'🪙 '+selected.coins+' coins'),
      selected.bonus>0 && React.createElement('div',{style:{fontSize:'11px',color:'var(--green)',marginBottom:'4px'}},'Includes '+selected.bonus+' bonus coins!'),
      React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)'}})
    ),
    React.createElement('div',{style:{padding:'0 18px 10px'}},
      React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'10px'}},'Payment Method'),
      React.createElement('div',{style:{display:'flex',gap:'8px',marginBottom:'16px'}},
        React.createElement('button',{onClick:function(){setPayMethod('card');},style:{flex:1,padding:'10px',borderRadius:'10px',border:'2px solid '+(payMethod==='card'?'var(--ac)':'var(--border)'),background:payMethod==='card'?'var(--acg)':'var(--bg3)',color:'var(--text)',fontWeight:600,cursor:'pointer',fontSize:'12px'}},'💳 Card'),
        React.createElement('button',{onClick:function(){setPayMethod('upi');},style:{flex:1,padding:'10px',borderRadius:'10px',border:'2px solid '+(payMethod==='upi'?'var(--ac)':'var(--border)'),background:payMethod==='upi'?'var(--acg)':'var(--bg3)',color:'var(--text)',fontWeight:600,cursor:'pointer',fontSize:'12px'}},'📱 UPI')
      ),
      payMethod==='card' ? React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'10px'}},
        React.createElement('input',{placeholder:'Cardholder Name',value:card.name,onChange:function(e){updateCard('name',e.target.value);},style:{padding:'11px 13px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}}),
        React.createElement('input',{placeholder:'Card Number (16 digits)',value:card.number,maxLength:16,onChange:function(e){updateCard('number',e.target.value.replace(/\D/g,''));},style:{padding:'11px 13px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}}),
        React.createElement('div',{style:{display:'flex',gap:'10px'}},
          React.createElement('input',{placeholder:'MM/YY',value:card.expiry,maxLength:5,onChange:function(e){updateCard('expiry',e.target.value);},style:{flex:1,padding:'11px 13px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}}),
          React.createElement('input',{placeholder:'CVV',value:card.cvv,maxLength:3,onChange:function(e){updateCard('cvv',e.target.value.replace(/\D/g,''));},style:{flex:1,padding:'11px 13px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}})
        )
      ) : React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'10px'}},
        React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',marginBottom:'4px'}},'Enter your UPI ID (e.g. name@upi, phone@paytm)'),
        React.createElement('input',{placeholder:'yourname@upi',value:upiId,onChange:function(e){setUpiId(e.target.value);},style:{padding:'11px 13px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}}),
        React.createElement('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap'}},
          ['GPay','PhonePe','Paytm','BHIM'].map(function(app){
            return React.createElement('div',{key:app,style:{padding:'6px 12px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',fontSize:'11px',color:'var(--t2)',cursor:'pointer'}},app);
          })
        )
      )
    ),
    React.createElement('div',{style:{padding:'0 18px 24px',marginTop:'8px'}},
      React.createElement('button',{
        onClick:function(){
          if(payMethod==='card'){
            if(card.number.length<16||!card.expiry||card.cvv.length<3||!card.name){alert('Please fill all card details.');return;}
          } else {
            if(!upiId||!upiId.includes('@')){alert('Please enter a valid UPI ID.');return;}
          }
          setDone(true);
        },
        style:{width:'100%',padding:'14px',background:'var(--ac)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer'}
      },'Pay ₹'+selected.price+' →')
    )
  );

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{padding:'14px 18px 8px',display:'flex',alignItems:'center',gap:'10px'}},
      onBack && React.createElement('button',{onClick:onBack,style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'0 6px 0 0'}},'<'),
      React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'My Wallet')
    ),
    React.createElement('div',{style:{margin:'0 18px 16px',background:'linear-gradient(135deg,#1a1040,#2d1b6e)',border:'1px solid rgba(123,110,255,.3)',borderRadius:'16px',padding:'20px',textAlign:'center'}},
      React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,.6)',marginBottom:'6px'}},'Coin Balance'),
      React.createElement('div',{style:{fontSize:'36px',fontWeight:800,color:'#fff',marginBottom:'4px'}},'🪙 '+balance),
      React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,.5)'}},'≈ ₹'+(balance).toFixed(0)+' value')
    ),
    React.createElement('div',{style:{padding:'0 18px 6px'}},
      React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'10px'}},'Buy Coins'),
      PACKAGES.map(function(pkg){
        return React.createElement('div',{
          key:pkg.id,
          onClick:function(){setSelected(pkg);},
          style:{background:'var(--bg3)',border:'1px solid '+(pkg.popular?'var(--ac)':'var(--border)'),borderRadius:'12px',padding:'13px 14px',marginBottom:'8px',display:'flex',alignItems:'center',cursor:'pointer',position:'relative',overflow:'hidden'}
        },
          pkg.popular && React.createElement('div',{style:{position:'absolute',top:0,right:0,background:'var(--ac)',fontSize:'9px',fontWeight:700,color:'#fff',padding:'3px 8px',borderRadius:'0 12px 0 8px'}},'POPULAR'),
          React.createElement('div',{style:{fontSize:'24px',marginRight:'12px'}},'🪙'),
          React.createElement('div',{style:{flex:1}},
            React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'var(--text)'}},''+pkg.coins+' coins'+(pkg.bonus>0?' + '+pkg.bonus+' bonus':'')),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},''+pkg.label)
          ),
          React.createElement('div',{style:{textAlign:'right'}},
            pkg.bonus>0 && React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textDecoration:'line-through',marginBottom:'1px'}},'₹'+(pkg.coins)),
            React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--ac)'}},'₹'+pkg.price)
          )
        );
      })
    ),
    React.createElement('div',{style:{padding:'0 18px 24px'}},
      React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'10px'}},'Recent Activity'),
      TRANSACTIONS.map(function(tx){
        return React.createElement('div',{key:tx.id,style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid var(--border)'}},
          React.createElement('div',{style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--bg4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',flexShrink:0}},tx.type==='call'?'📞':'💳'),
          React.createElement('div',{style:{flex:1}},
            React.createElement('div',{style:{fontSize:'12px',fontWeight:500,color:'var(--text)',marginBottom:'2px'}},tx.label),
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},tx.date)
          ),
          React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:tx.coins>0?'var(--green)':'var(--red)'}},(tx.coins>0?'+':'')+tx.coins+'🪙')
        );
      })
    )
  );
}
