import Foundation
import Capacitor
import AVFoundation

/**
 * RingInAudio — native audio routing plugin for the Capacitor iOS shell.
 *
 * Web/PWA on iOS can NOT switch between earpiece and loudspeaker while a
 * mic-using call is active — Safari's audioSession API doesn't expose the
 * `defaultToSpeaker` option. Inside the Capacitor native wrapper we get
 * direct access to AVAudioSession, which DOES.
 *
 * JS API (exposed via Capacitor.Plugins.RingInAudio):
 *   startCallMode()                  → AVAudioSession.playAndRecord
 *   endCallMode()                    → AVAudioSession.ambient
 *   setSpeakerphone({enabled: bool}) → override route to speaker / receiver
 *
 * Wired to src/utils/nativeAudio.js — same JS interface as the Android
 * plugin so the React code is platform-agnostic.
 */
@objc(RingInAudioPlugin)
public class RingInAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RingInAudioPlugin"
    public let jsName = "RingInAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startCallMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCallMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeakerphone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
    ]

    /**
     * Configure AVAudioSession for two-way voice. Mirrors what CallKit /
     * native dialer apps do at call start.
     */
    @objc func startCallMode(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                // .allowBluetoothA2DP gives the user the option to switch to
                // AirPods / Bluetooth speakers via the system route picker.
                options: [.allowBluetooth, .allowBluetoothA2DP]
            )
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            // Default to EARPIECE (.none = receiver). User toggles speaker
            // via setSpeakerphone for hands-free.
            try session.overrideOutputAudioPort(.none)
            call.resolve([
                "ok": true,
                "category": "playAndRecord",
                "mode": "voiceChat"
            ])
        } catch {
            call.reject("startCallMode failed: \(error.localizedDescription)", nil, error)
        }
    }

    /**
     * Tear down the call audio session. Pairs with the call lifecycle in
     * CallScreen.js (hangup → endCallMode).
     */
    @objc func endCallMode(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.overrideOutputAudioPort(.none)
            try session.setActive(false, options: .notifyOthersOnDeactivation)
            // Reset to soloAmbient so future media playback (notification
            // sounds, ringtones) work normally instead of being stuck in
            // call mode.
            try session.setCategory(.soloAmbient, mode: .default, options: [])
            call.resolve(["ok": true])
        } catch {
            call.reject("endCallMode failed: \(error.localizedDescription)", nil, error)
        }
    }

    /**
     * Toggle speakerphone routing mid-call. Equivalent to tapping the
     * speaker button in WhatsApp.
     */
    @objc func setSpeakerphone(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled", false)
        do {
            let session = AVAudioSession.sharedInstance()
            // overrideOutputAudioPort requires the session to be active
            // AND in .playAndRecord category. startCallMode() sets both.
            if session.category != .playAndRecord {
                try session.setCategory(
                    .playAndRecord,
                    mode: .voiceChat,
                    options: [.allowBluetooth, .allowBluetoothA2DP]
                )
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            }
            try session.overrideOutputAudioPort(enabled ? .speaker : .none)
            call.resolve([
                "ok": true,
                "enabled": enabled,
                "currentRoute": session.currentRoute.outputs.first?.portName ?? "unknown"
            ])
        } catch {
            call.reject("setSpeakerphone failed: \(error.localizedDescription)", nil, error)
        }
    }

    /**
     * Read back current state. Sanity-check helper.
     */
    @objc func getState(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        call.resolve([
            "category": session.category.rawValue,
            "mode": session.mode.rawValue,
            "currentRoute": session.currentRoute.outputs.map { $0.portName }
        ])
    }
}
