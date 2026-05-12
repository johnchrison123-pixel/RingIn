import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerAppShellSW } from './utils/swRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register the app-shell service worker (production only, deferred until
// after window.load). This is what lets RingIn install to the home screen
// and open instantly offline. No behavior change for users still on the web —
// the SW only takes effect once it's registered and the next page loads.
registerAppShellSW();
