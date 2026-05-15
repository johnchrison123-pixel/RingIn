/* eslint-disable */
import React, {useState, useEffect} from 'react';
import {createPortal} from 'react-dom';

// MomentComposer — full-screen overlay that shows the picked photo,
// lets the user add an optional caption, and posts via the provided
// onShare callback. Mounted via portal so it always covers the viewport.
export default function MomentComposer(props){
  var file = props.file;
  var onCancel = props.onCancel;
  var onShare = props.onShare;  // async (file, caption, opts) => row

  var captionS = useState(''); var caption = captionS[0]; var setCaption = captionS[1];
  var uploadingS = useState(false); var uploading = uploadingS[0]; var setUploading = uploadingS[1];
  var previewUrlS = useState(null); var previewUrl = previewUrlS[0]; var setPreviewUrl = previewUrlS[1];
  var errorS = useState(''); var error = errorS[0]; var setError = errorS[1];
  // T2.7 — close-friends-only toggle. When true, the moment is only
  // visible to users on the poster's close_friends list (and gets the
  // green ring variant in the strip).
  var closeFriendsOnlyS = useState(false); var closeFriendsOnly = closeFriendsOnlyS[0]; var setCloseFriendsOnly = closeFriendsOnlyS[1];

  useEffect(function(){
    if(!file) return;
    var url;
    try{ url = URL.createObjectURL(file); }catch(_){}
    if(url) setPreviewUrl(url);
    return function(){ try{ if(url) URL.revokeObjectURL(url); }catch(_){} };
  }, [file]);

  function handleShare(){
    if(uploading || !file) return;
    setUploading(true);
    setError('');
    Promise.resolve(onShare && onShare(file, (caption || '').trim(), { closeFriendsOnly: closeFriendsOnly }))
      .then(function(){ /* parent closes us */ })
      .catch(function(err){
        setError((err && err.message) ? err.message : 'Failed to share. Please try again.');
        setUploading(false);
      });
  }

  if(!file || !previewUrl) return null;

  var overlay = React.createElement('div', {
    onTouchStart: function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    onTouchMove:  function(e){ if(e && e.stopPropagation) e.stopPropagation(); },
    style: {
      position:'fixed', top:0, left:0,
      width:'100vw', height:'100dvh',
      zIndex:10000,
      background:'#000',
      display:'flex', flexDirection:'column',
    }
  },
    // Image preview — contained, centred. Dark fallback bg fills letterbox.
    React.createElement('div', {
      style:{flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'}
    },
      React.createElement('img', {
        src: previewUrl, alt:'preview',
        style:{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}
      })
    ),

    // Header — cancel + label
    React.createElement('div', {
      style:{
        position:'absolute',
        top:'calc(12px + env(safe-area-inset-top, 0px))',
        left:'12px', right:'12px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        zIndex:1,
      }
    },
      React.createElement('button', {
        onClick: function(){ if(!uploading && onCancel) onCancel(); },
        className:'ringin-tap',
        title:'Cancel',
        style:{
          background:'rgba(0,0,0,0.5)', border:'none', color:'#fff',
          width:'36px', height:'36px', borderRadius:'50%',
          fontSize:'22px', lineHeight:1, cursor:'pointer',
        }
      }, '×'),
      React.createElement('div', {style:{color:'#fff',fontSize:'14px',fontWeight:700,fontFamily:'Syne, DM Sans, sans-serif',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}, 'New Moment'),
      React.createElement('div', {style:{width:'36px'}}) // spacer to keep label centred
    ),

    // Error toast (if any)
    error ? React.createElement('div', {
      style:{
        position:'absolute',
        bottom:'calc(82px + env(safe-area-inset-bottom, 0px))',
        left:'50%', transform:'translateX(-50%)',
        background:'rgba(239,71,71,0.92)', color:'#fff',
        padding:'8px 16px', borderRadius:'20px',
        fontSize:'12px', fontWeight:600,
        zIndex:2,
        maxWidth:'80%',
        textAlign:'center',
      }
    }, error) : null,

    // T2.7 — Audience chip (Public ↔ Close Friends). Sits above the
    // caption input. Tap to toggle. Green when close-friends-only.
    React.createElement('div', {
      style:{
        position:'absolute',
        left:'12px',
        bottom:'calc(60px + env(safe-area-inset-bottom, 0px))',
        zIndex:1,
      }
    },
      React.createElement('button', {
        onClick: function(){ setCloseFriendsOnly(function(v){ return !v; }); },
        className:'ringin-tap',
        style:{
          background: closeFriendsOnly ? 'rgba(39,201,106,0.85)' : 'rgba(0,0,0,0.55)',
          border: '1px solid ' + (closeFriendsOnly ? '#27C96A' : 'rgba(255,255,255,0.35)'),
          color:'#fff',
          padding:'6px 12px',
          borderRadius:'18px',
          fontSize:'12px',
          fontWeight:600,
          cursor:'pointer',
          fontFamily:'inherit',
          display:'inline-flex',
          alignItems:'center',
          gap:'5px',
        }
      }, closeFriendsOnly ? '★ Close Friends' : '🌐 Public')
    ),

    // Caption + Share row
    React.createElement('div', {
      style:{
        position:'absolute',
        left:'12px', right:'12px',
        bottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
        display:'flex', gap:'8px', alignItems:'center',
        zIndex:1,
      }
    },
      React.createElement('input', {
        type:'text',
        value: caption,
        placeholder:'Add a caption (optional)…',
        onChange: function(e){ setCaption(e.target.value); },
        disabled: uploading,
        style:{
          flex:1,
          background:'rgba(0,0,0,0.55)',
          border:'1px solid rgba(255,255,255,0.35)',
          borderRadius:'24px',
          padding:'11px 15px',
          fontSize:'15.4px',
          color:'#fff',
          outline:'none',
          fontFamily:'DM Sans, sans-serif',
          WebkitAppearance:'none',
        }
      }),
      React.createElement('button', {
        onClick: handleShare,
        disabled: uploading,
        className:'ringin-tap',
        style:{
          background: uploading ? 'rgba(255,255,255,0.55)' : '#fff',
          border:'none',
          color:'#222', fontWeight:700,
          fontSize:'14.3px',
          padding:'10px 16px',
          borderRadius:'24px',
          cursor: uploading ? 'wait' : 'pointer',
          minWidth:'74px',
        }
      }, uploading ? 'Sharing…' : 'Share')
    )
  );

  if(typeof document === 'undefined' || !document.body) return overlay;
  return createPortal(overlay, document.body);
}
