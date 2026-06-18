/* eslint-disable */
// giftAnimQueue.js — single in-flight gift animation with a FIFO queue.
// Cheap "small-pop" regular gifts bypass the queue (they're meant to STACK for
// combo spam); centre + fullscreen gifts serialize so two Taj Mahals don't
// render on top of each other. CallScreen registers its renderer via
// setGiftPlayer(); everything else calls enqueueGift(evt).
var _q = [];
var _busy = false;
var _player = null;

export function setGiftPlayer(fn){ _player = fn; }

export function enqueueGift(evt){
  if (!evt) return;
  // small-pop combos render immediately + stack
  if (evt.tier === 'regular' && !evt.fullscreen){ if (_player) _player(evt); return; }
  _q.push(evt);
  _drain();
}

function _drain(){
  if (_busy || !_q.length || !_player) return;
  _busy = true;
  var evt = _q.shift();
  var dur = evt.fullscreen ? 5500 : 3500;
  try { _player(evt); } catch(_){}
  setTimeout(function(){ _busy = false; _drain(); }, dur);
}

export function clearGiftQueue(){ _q = []; _busy = false; }
