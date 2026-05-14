package app.ringin.mobile

import android.content.Context
import android.media.AudioManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * RingInAudio — native audio routing plugin for the Capacitor Android shell.
 *
 * Web/PWA can't do TRUE earpiece ↔ loudspeaker switching for WebRTC voice
 * calls. Inside the Capacitor native wrapper we get direct access to
 * AudioManager, which IS the same mechanism native call apps (WhatsApp,
 * Telegram, the dialer) use.
 *
 * JS API (exposed via Capacitor.Plugins.RingInAudio):
 *   startCallMode()                  → sets MODE_IN_COMMUNICATION
 *   endCallMode()                    → sets MODE_NORMAL
 *   setSpeakerphone({enabled: bool}) → toggles bottom speaker (true) vs
 *                                      earpiece (false)
 *
 * Wired to src/utils/nativeAudio.js — when running natively, every speaker
 * toggle in CallScreen calls these.
 */
@CapacitorPlugin(name = "RingInAudio")
class RingInAudioPlugin : Plugin() {

    private val audioManager: AudioManager
        get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    /**
     * Put the system into "in-call" mode. This is what tells Android to
     * route audio for two-way voice — and is required for setSpeakerphoneOn
     * to take effect. Native phone apps do exactly this when a call starts.
     */
    @PluginMethod
    fun startCallMode(call: PluginCall) {
        try {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            // Default to EARPIECE on call start. The user explicitly toggles
            // speaker via setSpeakerphone if they want hands-free.
            audioManager.isSpeakerphoneOn = false
            val ret = JSObject()
            ret.put("ok", true)
            ret.put("mode", "MODE_IN_COMMUNICATION")
            call.resolve(ret)
        } catch (e: Throwable) {
            call.reject("startCallMode failed: ${e.message}", e)
        }
    }

    /**
     * Restore the audio session to its idle state after the call ends.
     * Without this, Android keeps routing media audio through the earpiece
     * for a while — feels weird until the user does something else.
     */
    @PluginMethod
    fun endCallMode(call: PluginCall) {
        try {
            // Speaker off + back to normal mode mirrors what AOSP's
            // Telephony stack does at call-end.
            audioManager.isSpeakerphoneOn = false
            audioManager.mode = AudioManager.MODE_NORMAL
            val ret = JSObject()
            ret.put("ok", true)
            call.resolve(ret)
        } catch (e: Throwable) {
            call.reject("endCallMode failed: ${e.message}", e)
        }
    }

    /**
     * Toggle speakerphone routing mid-call.
     * @param enabled  true = bottom (loud) speaker, false = earpiece
     */
    @PluginMethod
    fun setSpeakerphone(call: PluginCall) {
        try {
            val enabled = call.getBoolean("enabled", false) ?: false
            // setSpeakerphoneOn ONLY works while audioManager.mode is
            // MODE_IN_COMMUNICATION. If JS calls this before startCallMode,
            // make sure we're in the right mode.
            if (audioManager.mode != AudioManager.MODE_IN_COMMUNICATION) {
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            }
            audioManager.isSpeakerphoneOn = enabled
            val ret = JSObject()
            ret.put("ok", true)
            ret.put("enabled", enabled)
            ret.put("isSpeakerphoneOn", audioManager.isSpeakerphoneOn)
            call.resolve(ret)
        } catch (e: Throwable) {
            call.reject("setSpeakerphone failed: ${e.message}", e)
        }
    }

    /**
     * Read back current state. Useful for sanity checks.
     */
    @PluginMethod
    fun getState(call: PluginCall) {
        try {
            val ret = JSObject()
            ret.put("mode", audioManager.mode)
            ret.put("isSpeakerphoneOn", audioManager.isSpeakerphoneOn)
            ret.put("isMicrophoneMute", audioManager.isMicrophoneMute)
            call.resolve(ret)
        } catch (e: Throwable) {
            call.reject("getState failed: ${e.message}", e)
        }
    }
}
