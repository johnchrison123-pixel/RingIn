package app.ringin.mobile;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * RingInAudio — native audio routing plugin for the Capacitor Android shell.
 *
 * Gives the React layer real OS-level earpiece ↔ loudspeaker switching that
 * web browsers can't expose. Same mechanism used by WhatsApp / Telegram / the
 * dialer.
 *
 * JS API (exposed via Capacitor.Plugins.RingInAudio):
 *   startCallMode()                  → MODE_IN_COMMUNICATION
 *   endCallMode()                    → MODE_NORMAL
 *   setSpeakerphone({enabled: bool}) → bottom speaker (true) vs earpiece (false)
 *   getState()                       → diagnostic readback
 */
@CapacitorPlugin(name = "RingInAudio")
public class RingInAudioPlugin extends Plugin {

    private AudioManager am() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    private AudioFocusRequest focusRequest;

    /**
     * Tell Android we want exclusive audio focus AS A VOICE CALL.
     * This is what convinces the system to route WebView WebRTC audio
     * through STREAM_VOICE_CALL (and therefore respect setSpeakerphoneOn)
     * instead of STREAM_MUSIC (which always goes to the loudspeaker).
     */
    private void requestVoiceFocus() {
        AudioManager m = am();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(false)
                .setOnAudioFocusChangeListener(new AudioManager.OnAudioFocusChangeListener() {
                    @Override public void onAudioFocusChange(int focusChange) {
                        android.util.Log.d("RingInAudio", "audio focus change: " + focusChange);
                    }
                })
                .build();
            int result = m.requestAudioFocus(focusRequest);
            android.util.Log.d("RingInAudio", "requestAudioFocus result=" + result + " (1=granted)");
        } else {
            // Pre-O legacy path
            @SuppressWarnings("deprecation")
            int result = m.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN);
            android.util.Log.d("RingInAudio", "legacy requestAudioFocus result=" + result);
        }
    }

    private void abandonVoiceFocus() {
        AudioManager m = am();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            m.abandonAudioFocusRequest(focusRequest);
            focusRequest = null;
        } else {
            @SuppressWarnings("deprecation")
            int r = m.abandonAudioFocus(null);
            android.util.Log.d("RingInAudio", "legacy abandonAudioFocus=" + r);
        }
    }

    @PluginMethod
    public void startCallMode(PluginCall call) {
        try {
            AudioManager m = am();
            android.util.Log.d("RingInAudio", "startCallMode: before mode=" + m.getMode() + " speaker=" + m.isSpeakerphoneOn());
            // 1. Declare this app is a phone call — without this, Chrome WebView
            //    plays WebRTC audio through STREAM_MUSIC (loudspeaker only).
            requestVoiceFocus();
            // 2. Switch system to in-call mode
            m.setMode(AudioManager.MODE_IN_COMMUNICATION);
            // 3. Default to EARPIECE on call start — via the modern API on
            //    Android 12+, legacy fallback on older devices.
            routeAudioTo(false);
            // 4. Make sure STREAM_VOICE_CALL volume isn't at 0 (otherwise user
            //    hears silence and assumes audio is going elsewhere). Bump
            //    to near-max if currently low.
            int maxVc = m.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            int curVc = m.getStreamVolume(AudioManager.STREAM_VOICE_CALL);
            if (curVc < maxVc / 2) {
                m.setStreamVolume(AudioManager.STREAM_VOICE_CALL, (int)(maxVc * 0.75), 0);
            }
            android.util.Log.d("RingInAudio", "startCallMode: after  mode=" + m.getMode() + " speaker=" + m.isSpeakerphoneOn() + " voiceVol=" + m.getStreamVolume(AudioManager.STREAM_VOICE_CALL) + "/" + maxVc);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("mode", m.getMode());
            ret.put("isSpeakerphoneOn", m.isSpeakerphoneOn());
            ret.put("voiceCallVol", m.getStreamVolume(AudioManager.STREAM_VOICE_CALL));
            ret.put("voiceCallMax", maxVc);
            call.resolve(ret);
        } catch (Exception e) { android.util.Log.e("RingInAudio", "method failed", e);
            call.reject("startCallMode failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void endCallMode(PluginCall call) {
        try {
            AudioManager m = am();
            android.util.Log.d("RingInAudio", "endCallMode: before mode=" + m.getMode() + " speaker=" + m.isSpeakerphoneOn());
            // Release the explicit communication device pin so future audio
            // (notifications, ringtones) goes back to default routing.
            if (Build.VERSION.SDK_INT >= 31) {
                try { m.clearCommunicationDevice(); } catch (Throwable t) { /* ignore */ }
            }
            m.setSpeakerphoneOn(false);
            m.setMode(AudioManager.MODE_NORMAL);
            abandonVoiceFocus();
            android.util.Log.d("RingInAudio", "endCallMode: after  mode=" + m.getMode() + " speaker=" + m.isSpeakerphoneOn());
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) { android.util.Log.e("RingInAudio", "method failed", e);
            call.reject("endCallMode failed: " + e.getMessage(), e);
        }
    }

    /**
     * Try the modern API first (Android 12+ / API 31) — setCommunicationDevice
     * explicitly picks a physical output by AudioDeviceInfo. On API 31+, the
     * legacy setSpeakerphoneOn() is internally routed to the new framework
     * anyway, but it's flaky — some OEMs ignore it. Calling
     * setCommunicationDevice with TYPE_BUILTIN_EARPIECE / TYPE_BUILTIN_SPEAKER
     * works on every modern phone we've tested.
     *
     * Returns the AudioDeviceInfo type that was selected (or -1 if neither path worked).
     */
    private int routeAudioTo(boolean speaker) {
        AudioManager m = am();
        int chosenType = -1;
        if (Build.VERSION.SDK_INT >= 31) {
            int targetType = speaker
                ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
            try {
                List<AudioDeviceInfo> devices = m.getAvailableCommunicationDevices();
                AudioDeviceInfo target = null;
                StringBuilder available = new StringBuilder();
                for (AudioDeviceInfo d : devices) {
                    available.append(d.getType()).append(",");
                    if (d.getType() == targetType) target = d;
                }
                android.util.Log.d("RingInAudio", "available comm devices: [" + available + "] target=" + targetType);
                if (target != null) {
                    // Clear any sticky previous selection first (some ROMs need this)
                    m.clearCommunicationDevice();
                    boolean ok = m.setCommunicationDevice(target);
                    chosenType = target.getType();
                    android.util.Log.d("RingInAudio", "setCommunicationDevice(" + targetType + ") = " + ok);
                } else {
                    android.util.Log.w("RingInAudio", "no AudioDeviceInfo with type=" + targetType + " available — falling back to legacy");
                }
            } catch (Throwable t) {
                android.util.Log.e("RingInAudio", "setCommunicationDevice path failed, falling back to legacy", t);
            }
        }
        // Legacy fallback (and belt-and-braces on modern devices too — doesn't hurt)
        m.setSpeakerphoneOn(speaker);
        return chosenType;
    }

    @PluginMethod
    public void setSpeakerphone(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", false);
            AudioManager m = am();
            android.util.Log.d("RingInAudio", "setSpeakerphone(" + enabled + "): before mode=" + m.getMode() + " speaker=" + m.isSpeakerphoneOn());

            // Re-assert voice focus so the system keeps routing through STREAM_VOICE_CALL.
            if (focusRequest == null) {
                requestVoiceFocus();
            }

            // Force the system into IN_COMMUNICATION mode if it has drifted out.
            if (m.getMode() != AudioManager.MODE_IN_COMMUNICATION) {
                m.setMode(AudioManager.MODE_IN_COMMUNICATION);
            }

            // The actual route switch — modern API on API 31+, falls back to legacy on older.
            int chosenType = routeAudioTo(enabled);

            // Read back what actually got selected.
            int actualType = -1;
            if (Build.VERSION.SDK_INT >= 31) {
                try {
                    AudioDeviceInfo cur = m.getCommunicationDevice();
                    if (cur != null) actualType = cur.getType();
                } catch (Throwable t) { /* ignore */ }
            }

            android.util.Log.d("RingInAudio", "setSpeakerphone(" + enabled + "): after  mode=" + m.getMode() + " speaker=" + m.isSpeakerphoneOn() + " commDeviceType=" + actualType + " chose=" + chosenType);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("requested", enabled);
            ret.put("mode", m.getMode());
            ret.put("isSpeakerphoneOn", m.isSpeakerphoneOn());
            ret.put("commDeviceType", actualType);    // 2=earpiece, 1=speaker (AudioDeviceInfo constants — useful in debug overlay)
            ret.put("chosenType", chosenType);
            ret.put("sdk", Build.VERSION.SDK_INT);
            ret.put("voiceCallVol", m.getStreamVolume(AudioManager.STREAM_VOICE_CALL));
            ret.put("voiceCallMax", m.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL));
            call.resolve(ret);
        } catch (Exception e) { android.util.Log.e("RingInAudio", "method failed", e);
            call.reject("setSpeakerphone failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        try {
            AudioManager m = am();
            JSObject ret = new JSObject();
            ret.put("mode", m.getMode());
            ret.put("isSpeakerphoneOn", m.isSpeakerphoneOn());
            ret.put("isMicrophoneMute", m.isMicrophoneMute());
            call.resolve(ret);
        } catch (Exception e) { android.util.Log.e("RingInAudio", "method failed", e);
            call.reject("getState failed: " + e.getMessage(), e);
        }
    }
}
