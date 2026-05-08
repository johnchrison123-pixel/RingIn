/* eslint-disable */
// Firebase Cloud Messaging setup
// Replace these with your actual Firebase config from console.firebase.google.com
var firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyCUg0EvH_4sWWZwrah53PiCl8L3-d3jkXQ',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'ring-in-23c07.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'ring-in-23c07',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'ring-in-23c07.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '849352826995',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:849352826995:web:2fd47580d8346e60b84a06',
  vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || 'BJVRM6-9tId75BVBkx48SUlAY2W_Z2pK8e-s5lhdkiLg7zRXA-hO1Ykt4V3RWAWrN3RjlzErH6GLM-0jJQoUx4M',
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
