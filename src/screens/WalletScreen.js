/* eslint-disable */
import React,{useState,useEffect} from 'react';
import {sb} from '../utils/supabase';
import {toastSuccess,toastError} from '../utils/toast';
import {useCoinBalance, setSharedCoinBalance} from '../utils/coinBalance';

var PACKAGES=[
  {id:1,coins:100,price:100,label:'Starter',bonus:0,popular:false},
  {id:2,coins:200,price:200,label:'Basic',bonus:0,popular:false},
  {id:3,coins:500,price:500,label:'Popular',bonus:0,popular:true},
  {id:4,coins:1000,price:900,label:'Best Value',bonus:100,popular:false},
  {id:5,coins:2000,price:1700,label:'Power',bonus:300,popular:false},
  {id:6,coins:5000,price:4000,label:'Pro',bonus:1000,popular:false},
];

export default function WalletScreen(props){
  var onBack = props.onBack;
  var session = props.session;
  var userId = session && session.user ? session.user.id : null;

  // Balance comes from the shared hook so any change here (purchase)
  // propagates instantly to HomeScreen / Messages / Search chips, and
  // any change there (call deduct, promo) lands here too.
  var balance = useCoinBalance(userId, sb);
  function setBalance(n){ setSharedCoinBalance(n); } // local helper that broadcasts
  var selS=useState(null); var selected=selS[0]; var setSelected=selS[1];
  var payS=useState('card'); var payMethod=payS[0]; var setPayMethod=payS[1];
  var upiS=useState(''); var upiId=upiS[0]; var setUpiId=upiS[1];
  var cardS=useState({number:'',expiry:'',cvv:'',name:''}); var card=cardS[0]; var setCard=cardS[1];
  var doneS=useState(false); var done=doneS[0]; var setDone=doneS[1];
  var txS=useState([]); var transactions=txS[0]; var setTransactions=txS[1];
  var payingS=useState(false); var paying=payingS[0]; var setPaying=payingS[1];

  // Load balance + transactions from Supabase
  useEffect(function(){
    if(!userId) return;
    sb.from('profiles').select('coins').eq('id',userId).single().then(function(r){
      if(r.data && r.data.coins != null) setBalance(Number(r.data.coins) || 0);
    }).catch(function(){toastError('Failed to load balance');});
    sb.from('transactions').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(20).then(function(r){
      if(r.data) setTransactions(r.data);
    }).catch(function(){});
  },[userId]);

  function processPayment(){
    if(!userId){toastError('Please log in');return;}
    if(payMethod==='card'){
      if(card.number.length<16||!card.expiry||card.cvv.length<3||!card.name){toastError('Please fill all card details.');setPaying(false);return;}
    } else {
      if(!upiId||!upiId.includes('@')){toastError('Please enter a valid UPI ID.');setPaying(false);return;}
    }
    setPaying(true);

    // Simulate payment processing
    setTimeout(function(){
      var addedCoins = selected.coins + (selected.bonus || 0);
      var newBalance = balance + addedCoins;
      setBalance(newBalance);

      // Update profile in DB
      sb.from('profiles').update({coins:newBalance}).eq('id',userId).then(function(){});

      // Insert transaction
      sb.from('transactions').insert([{
        user_id:userId,
        type:'purchase',
        label:'Purchased '+selected.coins+(selected.bonus?'+'+selected.bonus+' bonus':'')+' coins',
        coins:addedCoins,
        amount:selected.price,
      }]).select().then(function(r){
        if(r.data && r.data[0]){
          setTransactions(function(prev){return [r.data[0]].concat(prev);});
        }
      });

      setDone(true);
      setPaying(false);
      toastSuccess('🎉 Payment successful! +'+addedCoins+' coins');
    },1200);
  }

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
          if(paying) return;
          processPayment();
        },
        style:{width:'100%',padding:'14px',background:paying?'var(--bg3)':'var(--ac)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:paying?'default':'pointer',opacity:paying?0.6:1}
      },paying?'Processing...':'Pay ₹'+selected.price+' →')
    )
  );

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{padding:'14px 18px 8px',display:'flex',alignItems:'center',gap:'10px'}},
      onBack && React.createElement('button',{onClick:onBack,title:'Back',style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px 4px 4px 0',display:'flex',alignItems:'center',justifyContent:'center'}},
        React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
          React.createElement('polyline',{points:'15 18 9 12 15 6'})
        )
      ),
      React.createElement('div',{style:{fontFamily:'Syne,sans-serif',fontSize:'21px',fontWeight:800,background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}},'My Wallet')
    ),
    React.createElement('div',{style:{margin:'0 18px 16px',background:'linear-gradient(135deg,#1a1040,#2d1b6e)',border:'1px solid rgba(123,110,255,.3)',borderRadius:'16px',padding:'20px',textAlign:'center'}},
      React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,.6)',marginBottom:'6px'}},'Coin Balance'),
      React.createElement('div',{style:{fontSize:'36px',fontWeight:800,color:'#fff',marginBottom:'4px'}},'🪙 '+balance),
      React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,.5)'}},'≈ ₹'+(Number(balance)||0).toFixed(0)+' value')
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
      transactions.length===0 && React.createElement('div',{style:{padding:'20px',textAlign:'center',color:'var(--t3)',fontSize:'12px'}},'No transactions yet'),
      transactions.map(function(tx){
        var dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '';
        return React.createElement('div',{key:tx.id,style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid var(--border)'}},
          React.createElement('div',{style:{width:'34px',height:'34px',borderRadius:'50%',background:'var(--bg4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',flexShrink:0}},tx.type==='call'?'📞':tx.type==='workshop'?'🎙':'💳'),
          React.createElement('div',{style:{flex:1}},
            React.createElement('div',{style:{fontSize:'12px',fontWeight:500,color:'var(--text)',marginBottom:'2px'}},tx.label),
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},dateStr)
          ),
          React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:tx.coins>0?'var(--green)':'var(--red)'}},(tx.coins>0?'+':'')+tx.coins+'🪙')
        );
      })
    )
  );
}
