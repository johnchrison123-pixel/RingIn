#!/usr/bin/env node
/**
 * install-native-plugins.mjs
 *
 * After you run `npx cap add android` (and optionally `npx cap add ios`)
 * for the first time, run this script. It copies our native audio plugin
 * source files into the right places inside the generated platform folders
 * AND patches MainActivity.java to register the plugin with Capacitor.
 *
 * Safe to re-run — it overwrites the plugin files but the MainActivity
 * patch is idempotent (only adds the import + register line if missing).
 *
 * Usage:
 *   node tools/install-native-plugins.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const log = (...args) => console.log('[install-native-plugins]', ...args);
const warn = (...args) => console.warn('[install-native-plugins]', ...args);

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { mkdirp(path.dirname(p)); fs.writeFileSync(p, s); }

// ── ANDROID ──────────────────────────────────────────────────────────────
function installAndroid() {
  const androidRoot = path.join(ROOT, 'android');
  if (!exists(androidRoot)) {
    warn('android/ folder not found — run `npx cap add android` first. Skipping Android install.');
    return;
  }

  // 1. Copy native plugin Java files into the package directory the Android app uses.
  //    Capacitor's default Android scaffold is Java-only — no Kotlin plugin
  //    is applied — so plugins must be Java to be picked up by the
  //    compiler. appId is `app.ringin.mobile` per capacitor.config.json, so
  //    files live in android/app/src/main/java/app/ringin/mobile/.
  const PLUGIN_FILES = [
    'RingInAudioPlugin.java',         // earpiece/loudspeaker switching (audio fix)
    'RingInNotifChannelsPlugin.java', // Android notification channels (T1.17)
  ];
  PLUGIN_FILES.forEach(function(name){
    const src = path.join(ROOT, 'capacitor-plugin', 'android', name);
    if (!exists(src)) { warn('plugin source missing:', src); return; }
    const dst = path.join(
      androidRoot, 'app', 'src', 'main', 'java', 'app', 'ringin', 'mobile', name
    );
    write(dst, read(src));
    log('✔ Wrote', dst);
  });

  // 1b. Copy the native Service + Activity that power full-screen incoming calls.
  //     These are NOT Capacitor plugins (no registerPlugin) — they are declared
  //     in AndroidManifest.xml instead (see the manifest patch below).
  const NATIVE_FILES = [
    'RingInCallService.java',     // replaces Capacitor's FCM service; raises the ringer
    'IncomingCallActivity.java',  // the WhatsApp-style full-screen call UI
  ];
  NATIVE_FILES.forEach(function(name){
    const src = path.join(ROOT, 'capacitor-plugin', 'android', name);
    if (!exists(src)) { warn('native source missing:', src); return; }
    const dst = path.join(
      androidRoot, 'app', 'src', 'main', 'java', 'app', 'ringin', 'mobile', name
    );
    write(dst, read(src));
    log('✔ Wrote', dst);
  });

  // 2. Patch MainActivity.java so Capacitor knows about the plugin.
  //    MainActivity must call registerPlugin(RingInAudioPlugin::class.java)
  //    inside onCreate, AFTER super.onCreate().
  //    Capacitor's default MainActivity.java is barebones — we add an
  //    onCreate override if missing, else just inject the registerPlugin call.
  const mainActivityPath = path.join(
    androidRoot, 'app', 'src', 'main', 'java', 'app', 'ringin', 'mobile', 'MainActivity.java'
  );
  if (!exists(mainActivityPath)) {
    warn('MainActivity.java not found at', mainActivityPath, '— check `npx cap add android` succeeded.');
    return;
  }
  let mainSrc = read(mainActivityPath);
  // Each plugin we want registered. Idempotent — only injects what's missing.
  const TO_REGISTER = ['RingInAudioPlugin', 'RingInNotifChannelsPlugin'];
  const missing = TO_REGISTER.filter(function(p){ return !mainSrc.includes(p + '.class'); });
  if (missing.length === 0) {
    log('• MainActivity.java already registers all plugins — skipping patch.');
  } else if (mainSrc.includes('public void onCreate(')) {
    // Already has an onCreate — append registerPlugin lines just after the
    // opening brace.
    missing.forEach(function(p){
      mainSrc = mainSrc.replace(
        /(public void onCreate\([^)]*\)\s*\{)/,
        (m) => m + '\n        registerPlugin(' + p + '.class);'
      );
    });
    write(mainActivityPath, mainSrc);
    log('✔ Patched', mainActivityPath, '(registerPlugin lines added: ' + missing.join(', ') + ')');
  } else {
    // Inject a fresh onCreate override registering all required plugins.
    const regLines = TO_REGISTER.map(function(p){ return '        registerPlugin(' + p + '.class);'; }).join('\n');
    const inject = `
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
${regLines}
        super.onCreate(savedInstanceState);
    }
`;
    mainSrc = mainSrc.replace(
      /public class MainActivity extends BridgeActivity \{/,
      (m) => m + inject
    );
    write(mainActivityPath, mainSrc);
    log('✔ Patched', mainActivityPath, '(onCreate added with: ' + TO_REGISTER.join(', ') + ')');
  }

  // 3. Ensure the app has all required permissions.
  //    Re-running this script (or running it for the first time after
  //    `npx cap add android`) re-injects any missing permission. Idempotent.
  //
  //    R23: added POST_NOTIFICATIONS (Android 13+ runtime permission to show
  //    notifications at all), VIBRATE (incoming-call haptic ringtone +
  //    per-message vibration), WAKE_LOCK (wake the screen on incoming call
  //    push), and USE_FULL_SCREEN_INTENT (full-screen ringer notification
  //    on Android 14+ — required to present incoming calls like WhatsApp).
  const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (exists(manifestPath)) {
    let manifest = read(manifestPath);
    const perms = [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.INTERNET',
      // R23 — push + call wake
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
      'android.permission.USE_FULL_SCREEN_INTENT',
    ];
    let patched = false;
    for (const perm of perms) {
      if (!manifest.includes(perm)) {
        manifest = manifest.replace(
          /<manifest[^>]*>/,
          (m) => m + `\n    <uses-permission android:name="${perm}" />`
        );
        patched = true;
      }
    }
    // ── Full-screen incoming calls: tools namespace + deep link + service/activity ──
    // (a) xmlns:tools on <manifest> (required for tools:node="remove" below).
    if (!manifest.includes('xmlns:tools=')) {
      manifest = manifest.replace(
        'xmlns:android="http://schemas.android.com/apk/res/android"',
        'xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools"'
      );
      patched = true;
    }
    // (b) ringin:// deep-link intent-filter on MainActivity — the native ringer
    //     hands Accept/Decline back to the web app, which App.js routes via its
    //     appUrlOpen handler into the real accept / reject flow.
    if (!manifest.includes('android:scheme="ringin"')) {
      manifest = manifest.replace(
        /(<category android:name="android.intent.category.LAUNCHER"\s*\/>\s*<\/intent-filter>)/,
        '$1\n\n            <intent-filter>\n' +
        '                <action android:name="android.intent.action.VIEW" />\n' +
        '                <category android:name="android.intent.category.DEFAULT" />\n' +
        '                <category android:name="android.intent.category.BROWSABLE" />\n' +
        '                <data android:scheme="ringin" />\n' +
        '            </intent-filter>'
      );
      patched = true;
    }
    // (c) Replace Capacitor's default FCM service with ours, and declare the
    //     full-screen incoming-call activity. RingInCallService extends the
    //     Capacitor service and delegates non-call messages to super, so token
    //     registration + normal notifications are preserved.
    if (!manifest.includes('app.ringin.mobile.RingInCallService')) {
      const callBlock =
        '\n        <!-- Full-screen incoming calls (WhatsApp style). Ours replaces\n' +
        '             Capacitor\'s FCM receiver but extends it (super for non-calls). -->\n' +
        '        <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />\n' +
        '        <service\n' +
        '            android:name="app.ringin.mobile.RingInCallService"\n' +
        '            android:exported="false">\n' +
        '            <intent-filter>\n' +
        '                <action android:name="com.google.firebase.MESSAGING_EVENT" />\n' +
        '            </intent-filter>\n' +
        '        </service>\n' +
        '        <activity\n' +
        '            android:name="app.ringin.mobile.IncomingCallActivity"\n' +
        '            android:exported="false"\n' +
        '            android:launchMode="singleTask"\n' +
        '            android:excludeFromRecents="true"\n' +
        '            android:showWhenLocked="true"\n' +
        '            android:turnScreenOn="true"\n' +
        '            android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen" />\n';
      manifest = manifest.replace(/(\n?[ \t]*)<\/application>/, callBlock + '$1</application>');
      patched = true;
    }

    // (d) MainActivity over the lock screen. When a call is accepted, the web
    //     app (call screen) opens via the ringin:// deep link. Without
    //     showWhenLocked it launches BEHIND the keyguard, so the call only
    //     connects after the user manually unlocks. showWhenLocked + turnScreenOn
    //     let the call screen appear AND connect over the lock screen.
    if (/android:name="\.MainActivity"/.test(manifest) &&
        !/android:name="\.MainActivity"[^>]*android:showWhenLocked/.test(manifest)) {
      manifest = manifest.replace(
        /(android:name="\.MainActivity")/,
        '$1\n            android:showWhenLocked="true"\n            android:turnScreenOn="true"'
      );
      patched = true;
    }

    // (e) IncomingCallActivity launchMode: singleTop → singleTask. singleTask
    //     guarantees a single ringer instance (no second activity → no double
    //     ringtone). Idempotent: only rewrites if currently singleTop. Earlier
    //     installs (and the callBlock above on first run) may have used singleTop.
    if (/IncomingCallActivity[\s\S]*?android:launchMode="singleTop"/.test(manifest)) {
      manifest = manifest.replace(
        /(android:name="app\.ringin\.mobile\.IncomingCallActivity"[\s\S]*?android:launchMode=)"singleTop"/,
        '$1"singleTask"'
      );
      patched = true;
    }

    if (patched) {
      write(manifestPath, manifest);
      log('✔ Patched AndroidManifest.xml (permissions + call service/activity/deep-link + MainActivity lock-screen)');
    } else {
      log('• AndroidManifest.xml already fully patched');
    }
  }

  // 4. Put firebase-messaging on the APP module's compile classpath.
  //    RingInCallService extends FirebaseMessagingService (via Capacitor's
  //    MessagingService). @capacitor/push-notifications declares firebase-messaging
  //    as `implementation` (not `api`), so the app module can't see the
  //    FirebaseMessagingService -> Context hierarchy and every inherited Context
  //    call (getSystemService, getPackageName, `this` as Context) fails to compile.
  //    Declaring it here fixes that. Pinned to the SAME version the plugin uses
  //    (23.3.1) to avoid a version skew.
  const appGradlePath = path.join(androidRoot, 'app', 'build.gradle');
  if (exists(appGradlePath)) {
    let g = read(appGradlePath);
    if (!/com\.google\.firebase:firebase-messaging/.test(g)) {
      g = g.replace(/dependencies\s*\{/, function(m){
        return m +
          '\n    // Full-screen call ringer: RingInCallService extends FirebaseMessagingService,' +
          '\n    // which needs firebase-messaging on the app module\'s compile classpath.' +
          '\n    // Pinned to @capacitor/push-notifications\' version to avoid a skew.' +
          '\n    implementation "com.google.firebase:firebase-messaging:23.3.1"';
      });
      write(appGradlePath, g);
      log('✔ Patched app/build.gradle (firebase-messaging for the full-screen call service)');
    } else {
      log('• app/build.gradle already has firebase-messaging');
    }
  }
}

// ── iOS ──────────────────────────────────────────────────────────────────
function installIos() {
  const iosRoot = path.join(ROOT, 'ios');
  if (!exists(iosRoot)) {
    warn('ios/ folder not found — run `npx cap add ios` first (Mac + Xcode required). Skipping iOS install.');
    return;
  }

  // Copy the Swift plugin into App/App/
  const pluginSrc = path.join(ROOT, 'capacitor-plugin', 'ios', 'RingInAudioPlugin.swift');
  const pluginDst = path.join(iosRoot, 'App', 'App', 'RingInAudioPlugin.swift');
  write(pluginDst, read(pluginSrc));
  log('✔ Wrote', pluginDst);
  log('  → After running this, open ios/App/App.xcworkspace in Xcode and verify');
  log('    RingInAudioPlugin.swift appears under the App target. If not, drag it in.');
  log('  → Also add NSMicrophoneUsageDescription to Info.plist (Xcode will warn otherwise).');
}

// ── Main ─────────────────────────────────────────────────────────────────
log('Installing native plugins...');
installAndroid();
installIos();
log('Done. Next: npx cap sync   (then npx cap open android)');
