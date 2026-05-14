package app.ringin.mobile;

import android.content.Context;
import android.media.AudioManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    @PluginMethod
    public void startCallMode(PluginCall call) {
        try {
            AudioManager m = am();
            m.setMode(AudioManager.MODE_IN_COMMUNICATION);
            // Default to EARPIECE on call start. User toggles speaker
            // explicitly for hands-free.
            m.setSpeakerphoneOn(false);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("mode", "MODE_IN_COMMUNICATION");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("startCallMode failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void endCallMode(PluginCall call) {
        try {
            AudioManager m = am();
            m.setSpeakerphoneOn(false);
            m.setMode(AudioManager.MODE_NORMAL);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("endCallMode failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void setSpeakerphone(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", false);
            AudioManager m = am();
            // setSpeakerphoneOn only takes effect while in
            // MODE_IN_COMMUNICATION — make sure we're in the right mode.
            if (m.getMode() != AudioManager.MODE_IN_COMMUNICATION) {
                m.setMode(AudioManager.MODE_IN_COMMUNICATION);
            }
            m.setSpeakerphoneOn(enabled);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("enabled", enabled);
            ret.put("isSpeakerphoneOn", m.isSpeakerphoneOn());
            call.resolve(ret);
        } catch (Exception e) {
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
        } catch (Exception e) {
            call.reject("getState failed: " + e.getMessage(), e);
        }
    }
}
