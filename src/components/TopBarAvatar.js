/* eslint-disable */
import React, {useState, useEffect} from 'react';
import {sb} from '../utils/supabase';
import {useMomentUserIds} from '../utils/momentUsers';
import AvatarRing from './AvatarRing';

/**
 * Avatar button for the per-screen top bar.
 * - Reads from localStorage on mount (instant render).
 * - Falls back to fetching profiles.avatar_url from the DB when localStorage is empty
 *   (new device, cache cleared).
 * - Listens for `ringin-avatar-changed` window events fired by ProfileScreen on upload,
 *   so all topbars across all screens update without a remount.
 */
export default function TopBarAvatar(props) {
  var session = props.session;
  var onClick = props.onClick;
  var size = props.size || 30;
  var userId = session && session.user ? session.user.id : null;
  var email = session && session.user && session.user.email ? session.user.email : '';

  var initial = email ? email.charAt(0).toUpperCase() : 'U';

  var avatarS = useState(function(){
    try {
      if (!userId) return null;
      return localStorage.getItem('avatar_' + userId) || null;
    } catch (e) { return null; }
  });
  var avatar = avatarS[0];
  var setAvatar = avatarS[1];

  // DB fallback when localStorage is empty (new device, cache wipe)
  useEffect(function(){
    if (!userId) return;
    if (avatar) return; // already have it
    sb.from('profiles').select('avatar_url').eq('id', userId).single().then(function(res){
      if (res && res.data && res.data.avatar_url) {
        setAvatar(res.data.avatar_url);
        try { localStorage.setItem('avatar_' + userId, res.data.avatar_url); } catch(e){}
      }
    });
  }, [userId]);

  // Cross-screen sync — when user uploads new avatar in ProfileScreen, refresh everywhere
  useEffect(function(){
    function handle(ev){
      var d = ev && ev.detail;
      if (!d || !d.userId || d.userId !== userId) return;
      setAvatar(d.url || null);
    }
    // Also listen for storage events (other tabs updating avatar)
    function handleStorage(ev){
      if (ev && ev.key === 'avatar_' + userId) setAvatar(ev.newValue || null);
    }
    window.addEventListener('ringin-avatar-changed', handle);
    window.addEventListener('storage', handleStorage);
    return function(){
      window.removeEventListener('ringin-avatar-changed', handle);
      window.removeEventListener('storage', handleStorage);
    };
  }, [userId]);

  // Show the moments ring around the top-bar avatar when the current
  // user has an active moment posted. This keeps the visual treatment
  // consistent — your avatar with a ring follows you wherever it appears.
  var momentUserIds = useMomentUserIds();
  var hasMoment = userId ? momentUserIds.has(userId) : false;

  return React.createElement(AvatarRing, { show: hasMoment, thickness: 1.5 },
    React.createElement('button', {
      onClick: onClick,
      title: 'Profile',
      style: {
        width: size + 'px', height: size + 'px', borderRadius: '50%',
        background: 'var(--ac)', border: '1px solid var(--border)',
        padding: 0, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: '12px', flexShrink: 0,
      },
    },
      avatar
        ? React.createElement('img', {src: avatar, alt: 'profile', style: {width:'100%', height:'100%', objectFit:'cover'}})
        : initial
    )
  );
}
