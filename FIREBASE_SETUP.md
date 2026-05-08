# Firebase FCM Setup for RingIn

## Steps to activate push notifications:

1. Go to https://console.firebase.google.com
2. Click "Create a project" → name it "RingIn"
3. Go to Project Settings → General → Add app → Web
4. Copy the firebaseConfig values
5. Add to Vercel environment variables:
   - REACT_APP_FIREBASE_API_KEY
   - REACT_APP_FIREBASE_AUTH_DOMAIN
   - REACT_APP_FIREBASE_PROJECT_ID
   - REACT_APP_FIREBASE_STORAGE_BUCKET
   - REACT_APP_FIREBASE_MESSAGING_SENDER_ID
   - REACT_APP_FIREBASE_APP_ID
6. Go to Firebase → Cloud Messaging → Web Push certificates
7. Generate VAPID key pair → copy public key
8. Add to Vercel: REACT_APP_FIREBASE_VAPID_KEY
9. Update public/firebase-messaging-sw.js with your config values
10. Run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token text;
11. Run the push_queue.sql in Supabase SQL editor
12. Redeploy on Vercel
