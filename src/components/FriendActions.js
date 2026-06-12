/* eslint-disable */
import React from 'react';

/* Shared Follow + Add-Friend buttons used on Discover cards, the profile
 * preview sheet, and full profile pages — so the look + states are identical
 * everywhere.
 *
 *   FollowButton:    follow (one-way) -> "Following"
 *   AddFriendButton: friend REQUEST (needs acceptance) -> "Requested" -> "Friends"
 *   MessageButton:   only enabled once you're mutual friends.
 */

// Two-person outline + plus — the "add friend" mark.
function FriendsPlusIcon(props){
  var s = props.size || 16;
  return React.createElement('svg', {
    width:s, height:s, viewBox:'0 0 24 24', fill:'none',
    stroke:'currentColor', strokeWidth:1.9, strokeLinecap:'round', strokeLinejoin:'round'
  },
    // front person
    React.createElement('circle', {cx:'7.5', cy:'8', r:'3.1'}),
    React.createElement('path', {d:'M2.5 19.5v-1a4.4 4.4 0 0 1 4.4-4.4h1.2a4.4 4.4 0 0 1 4.4 4.4v1'}),
    // second person (behind, right)
    React.createElement('circle', {cx:'15.6', cy:'9', r:'2.5'}),
    React.createElement('path', {d:'M13 19.5v-.8a3.8 3.8 0 0 1 3.8-3.8h.2a3.8 3.8 0 0 1 2.4.86'}),
    // plus
    React.createElement('path', {d:'M20.4 4.6v3.6M18.6 6.4h3.6'})
  );
}

function CheckIcon(props){
  var s = props.size || 15;
  return React.createElement('svg', {width:s, height:s, viewBox:'0 0 24 24', fill:'none',
    stroke:'currentColor', strokeWidth:2.4, strokeLinecap:'round', strokeLinejoin:'round'},
    React.createElement('path', {d:'M20 6 9 17l-5-5'}));
}

// Small "request sent" mark (people + clock dot).
function SentIcon(props){
  var s = props.size || 15;
  return React.createElement('svg', {width:s, height:s, viewBox:'0 0 24 24', fill:'none',
    stroke:'currentColor', strokeWidth:1.9, strokeLinecap:'round', strokeLinejoin:'round'},
    React.createElement('circle', {cx:'9', cy:'8', r:'3.2'}),
    React.createElement('path', {d:'M3.5 19v-1a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5v1'}),
    React.createElement('circle', {cx:'18.5', cy:'7.5', r:'3.5'}),
    React.createElement('path', {d:'M18.5 6v1.6l1 .9'}));
}

function baseBtn(extra){
  return Object.assign({
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'5px',
    border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700,
    fontSize:'12px', padding:'8px 12px', borderRadius:'10px', lineHeight:1,
    WebkitTapHighlightColor:'transparent', outline:'none', userSelect:'none',
    transition:'transform .12s ease, background .15s ease, color .15s ease',
  }, extra || {});
}

/* Follow / Following */
function FollowButton(props){
  var following = !!props.following;
  var busy = !!props.busy;
  var style = following
    ? baseBtn({ background:'transparent', color:'var(--t2)', border:'1px solid var(--border2,var(--border))' })
    : baseBtn({ background:'linear-gradient(135deg,#7B6EFF,#E84D9A)', color:'#fff' });
  if (props.full) style.flex = 1;
  if (props.style) style = Object.assign(style, props.style);
  return React.createElement('button', {
    onClick: function(e){ if(e&&e.stopPropagation) e.stopPropagation(); if(!busy && props.onClick) props.onClick(e); },
    disabled: busy, style: style, title: following ? 'Following' : 'Follow'
  },
    following ? React.createElement(CheckIcon, {size:14}) : null,
    React.createElement('span', null, busy ? '…' : (following ? 'Following' : 'Follow'))
  );
}

/* Add Friend -> Requested -> Friends.  status: 'none' | 'pending' | 'friends' */
function AddFriendButton(props){
  var status = props.status || 'none';
  var busy = !!props.busy;
  var label, icon, style;
  if (status === 'friends'){
    label = 'Friends';
    icon = React.createElement(CheckIcon, {size:14});
    style = baseBtn({ background:'rgba(39,201,106,0.14)', color:'#27C96A', border:'1px solid rgba(39,201,106,0.35)' });
  } else if (status === 'pending'){
    label = 'Requested';
    icon = React.createElement(SentIcon, {size:15});
    style = baseBtn({ background:'transparent', color:'var(--t3)', border:'1px solid var(--border2,var(--border))' });
  } else {
    label = 'Add Friend';
    icon = React.createElement(FriendsPlusIcon, {size:16});
    style = baseBtn({ background:'rgba(123,110,255,0.16)', color:'var(--ac,#7B6EFF)', border:'1px solid rgba(123,110,255,0.4)' });
  }
  if (props.full) style.flex = 1;
  if (props.iconOnly){ style.padding = '8px'; }
  if (props.style) style = Object.assign(style, props.style);
  return React.createElement('button', {
    onClick: function(e){ if(e&&e.stopPropagation) e.stopPropagation(); if(!busy && status==='none' && props.onClick) props.onClick(e); },
    disabled: busy || status !== 'none', style: style, title: label
  },
    busy ? React.createElement('span', null, '…') : icon,
    props.iconOnly ? null : React.createElement('span', null, label)
  );
}

/* Message — disabled (locked) until you're mutual friends. */
function MessageButton(props){
  var enabled = !!props.enabled; // true only when friends
  var style = baseBtn(enabled
    ? { background:'var(--bg3,rgba(255,255,255,0.06))', color:'var(--text)', border:'1px solid var(--border)' }
    : { background:'transparent', color:'var(--t3)', border:'1px solid var(--border)', cursor:'not-allowed', opacity:0.65 });
  if (props.full) style.flex = 1;
  if (props.style) style = Object.assign(style, props.style);
  return React.createElement('button', {
    onClick: function(e){
      if(e&&e.stopPropagation) e.stopPropagation();
      if(enabled && props.onClick){ props.onClick(e); }
      else if(props.onLocked){ props.onLocked(e); }
    },
    style: style, title: enabled ? 'Message' : 'Become friends to message'
  },
    React.createElement('svg', {width:15, height:15, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.9, strokeLinecap:'round', strokeLinejoin:'round'},
      enabled
        ? React.createElement('path', {d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'})
        : React.createElement('path', {d:'M19 11h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h1M7 11V7a5 5 0 0 1 10 0v4'})
    ),
    React.createElement('span', null, props.label || 'Message')
  );
}

export { FollowButton, AddFriendButton, MessageButton, FriendsPlusIcon };
export default AddFriendButton;
