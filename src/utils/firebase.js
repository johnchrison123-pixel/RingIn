/* eslint-disable */
// Firebase Cloud Messaging setup
// Replace these with your actual Firebase config from console.firebase.google.com
var firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
  vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || '',
};

var _app = null;
var _messaging = null;

export function initFirebase(){
  if(!firebaseConfig.apiKey) return null;
  try{
    var firebase = require('firebase/app');
    var messaging = require('firebase/messaging');
    if(!_app){
      _app = firebase.initializeApp(firebaseConfig);
      _messaging = messaging.getMessaging(_app);
    }
    return _messaging;
  }catch(e){
    console.error('Firebase init error:', e.message);
    return null;
  }
}

export async function requestNotificationPermission(userId, sb){
  if(!('Notification' in window)){
    console.log('Browser does not support notifications');
    return null;
  }
  try{
    var messaging = initFirebase();
    if(!messaging) return null;

    var {getToken} = require('firebase/messaging');
    var permission = await Notification.requestPermission();
    if(permission !== 'granted'){
      console.log('Notification permission denied');
      return null;
    }

    var token = await getToken(messaging, {vapidKey: firebaseConfig.vapidKey});
    if(token && userId && sb){
      // Save token to Supabase profiles table
      await sb.from('profiles').update({fcm_token: token}).eq('id', userId);
    }
    return token;
  }catch(e){
    console.error('FCM token error:', e.message);
    return null;
  }
}

export function onMessageListener(){
  var messaging = initFirebase();
  if(!messaging) return Promise.resolve(null);
  try{
    var {onMessage} = require('firebase/messaging');
    return new Promise(function(resolve){
      onMessage(messaging, function(payload){
        resolve(payload);
      });
    });
  }catch(e){
    return Promise.resolve(null);
  }
}
