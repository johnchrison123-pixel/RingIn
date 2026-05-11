/* eslint-disable */
// Helpers for inline call-log messages stored in the `messages` table.
// Format:  text = '[call] {"d":45,"s":"ended","r":"caller_hangup","cid":"<caller_uuid>"}'
//   d   = duration in seconds
//   s   = status: 'ended' | 'cancelled' | 'missed' | 'rejected'
//   r   = end_reason: 'caller_hangup' | 'remote_hangup' | 'no_answer' | 'rejected' | etc.
//   cid = caller_id (so each user can render perspective without extra lookups)

export var CALL_PREFIX = '[call] ';

export function isCallLog(text){
  return !!(text && typeof text === 'string' && text.indexOf(CALL_PREFIX) === 0);
}

export function buildCallLog(payload){
  // payload: { d, s, r, cid }
  return CALL_PREFIX + JSON.stringify({
    d: typeof payload.d === 'number' ? Math.max(0, Math.floor(payload.d)) : 0,
    s: payload.s || 'ended',
    r: payload.r || '',
    cid: payload.cid || '',
  });
}

export function parseCallLog(text){
  if(!isCallLog(text)) return null;
  try {
    var raw = text.substring(CALL_PREFIX.length);
    var obj = JSON.parse(raw);
    return {
      duration: typeof obj.d === 'number' ? obj.d : 0,
      status: obj.s || 'ended',
      endReason: obj.r || '',
      callerId: obj.cid || '',
    };
  } catch(e){
    return null;
  }
}

function fmtDuration(secs){
  var s = Math.max(0, Math.floor(secs));
  var m = Math.floor(s/60);
  var ss = s % 60;
  return m + ':' + (ss<10?'0':'') + ss;
}

// Returns { icon, label, color, isMissed } given the parsed log + my user id.
export function describeCallLog(log, myUserId){
  if(!log) return { icon:'📞', label:'Call', color:'var(--t2)', isMissed:false };
  var iWasCaller = log.callerId === myUserId;
  var s = log.status;
  var connected = log.duration > 0;
  var icon = '📞', color = 'var(--t2)', label, isMissed = false;

  if(iWasCaller){
    if(s === 'ended' && connected){
      label = 'Outgoing call · ' + fmtDuration(log.duration);
      if(log.endReason === 'remote_hangup') label += ' · ended by them';
    } else if(s === 'cancelled'){
      label = 'Outgoing · Cancelled';
    } else if(s === 'missed'){
      label = 'Outgoing · No answer';
      color = 'var(--t2)';
    } else if(s === 'rejected'){
      label = 'Outgoing · Declined';
    } else {
      label = 'Outgoing call';
    }
  } else {
    if(s === 'ended' && connected){
      label = 'Incoming call · ' + fmtDuration(log.duration);
      if(log.endReason === 'remote_hangup') label += ' · they hung up';
    } else if(s === 'missed'){
      label = 'Missed call';
      color = '#ef4444';
      icon = '📵';
      isMissed = true;
    } else if(s === 'cancelled'){
      label = 'Missed call (cancelled)';
      color = '#ef4444';
      icon = '📵';
      isMissed = true;
    } else if(s === 'rejected'){
      label = 'You declined';
    } else {
      label = 'Incoming call';
    }
  }

  return { icon: icon, label: label, color: color, isMissed: isMissed };
}

// Compact preview for the inbox row's last-message line.
export function previewCallLog(log, myUserId){
  var d = describeCallLog(log, myUserId);
  return d.icon + ' ' + d.label;
}
