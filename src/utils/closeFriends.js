/* eslint-disable */
import {useEffect, useState} from 'react';
import {sb} from './supabase';

// ──────────────────────────────────────────────────────────────────────────
// closeFriends.js — list of user IDs you've added to your Close Friends.
// Mirrors the Instagram pattern. Stored in the `close_friends` table
// (migration 0009_close_friends.sql).
//
// Asymmetric — A having B on their list doesn't mean B has A. There is
// intentionally NO notification when you add someone (matching IG).
//
// Public API:
//   useCloseFriends()            React hook → returns Set<userId>
//   addCloseFriend(userId)       async — adds to server + cache
//   removeCloseFriend(userId)    async — deletes from server + cache
//   isCloseFriendSync(userId)    sync — uses cached set
// ──────────────────────────────────────────────────────────────────────────

var CACHE_KEY = 'ringin_close_friends';
var _cache = new Set();
var _listeners = [];
var _myId = null;

function notify(){ _listeners.slice().forEach(function(l){ try{ l(_cache); }catch(_){} }); }

function readCache(){
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Set();
    var arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch(_) { return new Set(); }
}
function writeCache(set){
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(set))); } catch(_) {}
}

export function startCloseFriends(myId){
  if (!myId) return;
  _myId = myId;
  _cache = readCache();
  notify();
  // Refresh from server.
  sb.from('close_friends').select('friend_id').eq('owner_id', myId).then(function(r){
    if (r && !r.error && r.data) {
      var fresh = new Set(r.data.map(function(row){ return row.friend_id; }));
      _cache = fresh;
      writeCache(fresh);
      notify();
    }
  }).catch(function(){});
}

export function addCloseFriend(friendId){
  if (!_myId || !friendId) return Promise.reject(new Error('not initialized'));
  var next = new Set(_cache); next.add(friendId);
  _cache = next; writeCache(next); notify();
  return sb.from('close_friends').upsert([{ owner_id: _myId, friend_id: friendId }], { onConflict: 'owner_id,friend_id' }).then(function(r){
    if (r && r.error) {
      var rb = new Set(_cache); rb.delete(friendId);
      _cache = rb; writeCache(rb); notify();
      throw r.error;
    }
  });
}

export function removeCloseFriend(friendId){
  if (!_myId || !friendId) return Promise.reject(new Error('not initialized'));
  var next = new Set(_cache); next.delete(friendId);
  _cache = next; writeCache(next); notify();
  return sb.from('close_friends').delete().eq('owner_id', _myId).eq('friend_id', friendId).then(function(r){
    if (r && r.error) {
      var rb = new Set(_cache); rb.add(friendId);
      _cache = rb; writeCache(rb); notify();
      throw r.error;
    }
  });
}

export function isCloseFriendSync(friendId){
  return friendId ? _cache.has(friendId) : false;
}

export function getCloseFriendsSync(){ return _cache; }

export function useCloseFriends(){
  var s = useState(_cache);
  var ids = s[0]; var setIds = s[1];
  useEffect(function(){
    function listener(newSet){ setIds(newSet); }
    _listeners.push(listener);
    return function(){ _listeners = _listeners.filter(function(l){ return l !== listener; }); };
  }, []);
  return ids;
}
