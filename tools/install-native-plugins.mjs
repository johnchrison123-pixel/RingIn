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
    if (patched) {
      write(manifestPath, manifest);
      log('✔ Patched AndroidManifest.xml (added missing permissions)');
    } else {
      log('• AndroidManifest.xml already has required permissions');
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
