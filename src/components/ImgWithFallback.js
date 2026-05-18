/* eslint-disable */
import React,{useState,useEffect} from 'react';

// Shared <img> wrapper with onError fallback. When the source 404s / decode
// fails OR is empty (null / undefined / ''), it renders one of:
//   - props.fallback: a React node (highest priority)
//   - props.fallback === 'avatar': initials bubble using props.fallbackInitial
//   - props.fallback === 'image':  generic "Image unavailable" placeholder
//
// Every other native <img> prop (style, alt, loading, onClick, className, etc.)
// passes through verbatim. Extracted from HomeScreen so MessagesScreen,
// ProfileScreen and others can share one definition.
//
// Defined as a proper component (not a plain helper) so it can hold per-instance
// `failed` state via useState.
function ImgWithFallback(props){
  var failedS = useState(false); var failed = failedS[0]; var setFailed = failedS[1];

  /* R18 verifier-fix: reset failed state when src changes (positional key=i lists
   * — e.g. MessagesScreen people-search — would otherwise keep failed=true even
   * when a new user with a valid avatar maps into the same slot). */
  useEffect(function(){ setFailed(false); }, [props.src]);

  function renderFallback(){
    var fb = props.fallback;
    if (fb && typeof fb === 'object') return fb; // already a React element
    if (fb === 'avatar') {
      var initial = (props.fallbackInitial || '?').toString().substring(0,2).toUpperCase();
      var avStyle = Object.assign({
        width:'100%',height:'100%',display:'flex',alignItems:'center',
        justifyContent:'center',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',
        color:'#fff',fontWeight:700,fontSize:'13px',fontFamily:'inherit'
      }, props.fallbackStyle || {});
      return React.createElement('div',{style:avStyle, onClick: props.onClick, title: props.alt||''}, initial);
    }
    if (fb === 'image') {
      var imStyle = Object.assign({
        width:'100%',height:'100%',display:'flex',alignItems:'center',
        justifyContent:'center',color:'#888',fontSize:'12px',background:'#111'
      }, props.fallbackStyle || {});
      return React.createElement('div',{style:imStyle}, 'Image unavailable');
    }
    if (typeof fb === 'string') return fb; // raw string fallback (initials)
    return null;
  }

  if (failed || !props.src) return renderFallback();

  // Strip non-DOM props before passing to <img>.
  var blocked = { fallback:1, fallbackInitial:1, fallbackStyle:1, onError:1 };
  var rest = {};
  for (var k in props) { if (!blocked[k]) rest[k] = props[k]; }
  rest.onError = function(e){ setFailed(true); if (props.onError) props.onError(e); };
  return React.createElement('img', rest);
}

export default ImgWithFallback;
