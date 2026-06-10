import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerAppShellSW } from './utils/swRegistration';

/* R66 CRITICAL — fire CapacitorUpdater.notifyAppReady() IMMEDIATELY at app
 * startup, before React renders.
 *
 * Why: Capgo's `appReadyTimeout` is 10 seconds. If notifyAppReady() isn't
 * called within that window after a new bundle loads, Capgo marks the
 * bundle as broken and rolls back to the previous bundle. Our previous
 * implementation called it inside the OTA check loop which fires after a
 * 4-second setTimeout — meaning if the user force-closed the app in those
 * 4 seconds, the new bundle was never confirmed good and rolled back on
 * next open. Result: OTAs only "stuck" if you happened to leave the app
 * open >4 sec before backgrounding.
 *
 * Now we notify within milliseconds, before any render. The bundle is
 * confirmed good immediately so any subsequent force-close is harmless. */
(function fireNotifyAppReadyAtStartup(){
  try {
    if (typeof window === 'undefined') return;
    if (!window.Capacitor || typeof window.Capacitor.isNativePlatform !== 'function') return;
    if (!window.Capacitor.isNativePlatform()) return;
    /* Try the runtime Plugins registry first — that's where the Capgo
     * plugin lives once Capacitor bootstraps. Fall back to a dynamic
     * import if not yet registered (rare but possible during cold start). */
    var Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
    var Capgo = Plugins.CapacitorUpdater;
    if (Capgo && typeof Capgo.notifyAppReady === 'function') {
      Capgo.notifyAppReady().catch(function(){});
      try { console.log('[ringin OTA] notifyAppReady fired at startup (sync)'); } catch(_){}
      return;
    }
    /* Plugin not registered yet — dynamic import + best-effort. */
    import('@capgo/capacitor-updater').then(function(mod){
      try {
        var CU = mod && (mod.CapacitorUpdater || (mod.default && mod.default.CapacitorUpdater));
        if (CU && typeof CU.notifyAppReady === 'function') {
          CU.notifyAppReady().catch(function(){});
          try { console.log('[ringin OTA] notifyAppReady fired at startup (lazy)'); } catch(_){}
        }
      } catch(_){}
    }).catch(function(){});
  } catch(_){}
})();

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
