/* eslint-disable */
// Firebase Messaging Service Worker
// This file must be at the root of your domain
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

var firebaseConfig = {
  apiKey: 'AIzaSyCUg0EvH_4sWWZwrah53PiCl8L3-d3jkXQ',
  authDomain: 'ring-in-23c07.firebaseapp.com',
  projectId: 'ring-in-23c07',
  storageBucket: 'ring-in-23c07.firebasestorage.app',
  messagingSenderId: '849352826995',
  appId: '1:849352826995:web:2fd47580d8346e60b84a06',
};

firebase.initializeApp(firebaseConfig);
var messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){
  var title = payload.notification && payload.notification.title ? payload.notification.title : 'RingIn';
  var body = payload.notification && payload.notification.body ? payload.notification.body : 'You have a new notification';
  var options = {
    body: body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
