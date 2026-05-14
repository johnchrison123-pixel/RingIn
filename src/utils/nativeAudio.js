/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// Native audio routing abstraction.
//
// When RingIn is running inside the Capacitor native shell (Phase 4),
// we use a custom native plugin to set the OS-level audio route:
//   - iOS: AVAudioSession.setCategory(.playAndRecord, options: .defaultToSpeaker)
//          or .allowBluetooth — gives us TRUE earpiece ↔ loudspeaker switching
//          while keeping the mic alive.
//   - Android: AudioManager.setMode(MODE_IN_COMMUNICATION) +
//              setSpeakerphoneOn(true/false) — same native call-style routing
//              used by WhatsApp/Telegram/etc.
//
// When running as a plain PWA / browser tab, the native plugin isn't
// registered. Every call here becomes a safe no-op and the existing PWA
// fallback (Agora's setRemoteVolume reduction) handles best-effort
// volume contrast in toggleSpeaker.
//
// The native plugin will be implemented in the Capacitor android/ios
// platforms (next commit). For now this file is the public API the
// React code calls — it'll just no-op until the native side is wired up.
// ──────────────────────────────────────────────────────────────────────────

// Returns true if RingIn is running inside the Capacitor shell.
export function isNative() {
  try {
    if (typeof window === 'undefined') return false;
    var cap = window.Capacitor;
    if (!cap) return false;
    // Capacitor 6 exposes either isNativePlatform() or getPlatform() !== 'web'
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    if (typeof cap.getPlatform === 'function') return cap.getPlatform() !== 'web';
    return false;
  } catch (e) { return false; }
}

// Returns 'ios', 'android', or 'web'.
export function getPlatform() {
  try {
    if (typeof window === 'undefined') return 'web';
    var cap = window.Capacitor;
    if (cap && typeof cap.getPlatform === 'function') return cap.getPlatform();
    var ua = (navigator && navigator.userAgent) || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'web';   // iOS Safari, not native
    if (/Android/i.test(ua)) return 'web';            // Android Chrome, not native
    return 'web';
  } catch (e) { return 'web'; }
}

// Resolve the native audio plugin. Returns null if not running natively
// or the plugin isn't registered yet (e.g., dev build without native side).
function getPlugin() {
  try {
    if (!isNative()) return null;
    // Capacitor 6 registers plugins under Capacitor.Plugins.<PluginName>.
    var Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
    if (Plugins.RingInAudio) return Plugins.RingInAudio;
    // Legacy global path some plugin templates expose
    if (window.RingInNativeAudio) return window.RingInNativeAudio;
    return null;
  } catch (e) { return null; }
}

// Switch audio output between earpiece (false) and loudspeaker (true).
// On web/PWA: no-op (returns false). On native: calls the OS audio router.
// Returns true if the native plugin handled it, false if we fell through.
export async function setSpeakerphone(on) {
  try {
    var p = getPlugin();
    if (!p) return false;
    if (typeof p.setSpeakerphone === 'function') {
      await p.setSpeakerphone({ enabled: !!on });
      return true;
    }
    return false;
  } catch (e) {
    try { console.warn('[ringin] native setSpeakerphone failed:', e && e.message); } catch (_) {}
    return false;
  }
}

// Tell the native audio session we're starting a call (so AVAudioSession /
// AudioManager get put into the right mode BEFORE Agora grabs the mic).
// Pure no-op on web/PWA.
export async function startCallMode() {
  try {
    var p = getPlugin();
    if (!p) return false;
    if (typeof p.startCallMode === 'function') {
      await p.startCallMode();
      return true;
    }
    return false;
  } catch (e) { return false; }
}

// Restore the audio session to its idle state when the call ends.
export async function endCallMode() {
  try {
    var p = getPlugin();
    if (!p) return false;
    if (typeof p.endCallMode === 'function') {
      await p.endCallMode();
      return true;
    }
    return false;
  } catch (e) { return false; }
}
