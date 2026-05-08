/* eslint-disable */
// Firebase Messaging Service Worker
// This file must be at the root of your domain
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

var firebaseConfig = {
  apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_YOUR_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_YOUR_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId: 'REPLACE_WITH_YOUR_APP_ID',
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
