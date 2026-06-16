package app.ringin.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RingInNotifChannels — categorises FCM notifications by purpose so the
 * user can mute one type (e.g. "Likes &amp; follows") without muting calls
 * (which they obviously want to keep). Mandatory on Android 8.0+ — without
 * a channel, notifications silently fail to deliver on those devices.
 *
 * Three channels:
 *   - "calls"     : MAX importance, bypasses DND, triggers full-screen
 *                   intent on lock screen, plays ringtone, vibrates.
 *   - "messages"  : DEFAULT importance, plays default notification sound.
 *   - "social"    : LOW importance, no sound. Likes, follows, comments.
 *
 * Call ensureChannels() once at app start (or on first plugin call). The
 * server (api/send-call-push.js) MUST set `notification.android_channel_id`
 * on the FCM payload to one of the IDs above, otherwise Android picks the
 * default channel and may downgrade the importance.
 *
 * Safe to call repeatedly — NotificationManager.createNotificationChannel
 * is documented as a no-op when the channel already exists with the same
 * importance + sound.
 */
@CapacitorPlugin(name = "RingInNotifChannels")
public class RingInNotifChannelsPlugin extends Plugin {

    // "calls_v2": a channel's sound/vibration is immutable once created, so we
    // can't silence the old "calls" channel in place — use a fresh id instead.
    public static final String CHANNEL_CALLS    = "calls_v2";
    public static final String CHANNEL_MESSAGES = "messages";
    public static final String CHANNEL_SOCIAL   = "social";

    // Must match RingInCallService / IncomingCallActivity CALL_NOTIF_ID.
    private static final int CALL_NOTIF_ID = 7001;

    @Override
    public void load() {
        ensureChannels(getContext());
    }

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Calls channel — high importance + bypasses DND so the full-screen
        // intent fires. Deliberately SILENT and NON-VIBRATING: the full-screen
        // IncomingCallActivity plays the phone's ringtone + vibrates itself, so a
        // channel sound/vibration here would double it (the user heard two
        // ringtones at once).
        NotificationChannel calls = new NotificationChannel(
            CHANNEL_CALLS, "Incoming calls", NotificationManager.IMPORTANCE_HIGH
        );
        calls.setDescription("Full-screen ringer when someone calls you on RingIn.");
        calls.enableVibration(false);
        calls.setBypassDnd(true);
        calls.setSound(null, null);
        nm.createNotificationChannel(calls);

        // Messages channel — default importance, normal notification sound.
        NotificationChannel msgs = new NotificationChannel(
            CHANNEL_MESSAGES, "Messages", NotificationManager.IMPORTANCE_DEFAULT
        );
        msgs.setDescription("New direct messages.");
        msgs.enableVibration(true);
        nm.createNotificationChannel(msgs);

        // Social channel — low importance, silent.
        NotificationChannel social = new NotificationChannel(
            CHANNEL_SOCIAL, "Likes, follows, comments", NotificationManager.IMPORTANCE_LOW
        );
        social.setDescription("Activity on your posts and profile. Quiet by default.");
        social.enableVibration(false);
        social.setSound(null, null);
        nm.createNotificationChannel(social);
    }

    @PluginMethod
    public void ensure(PluginCall call) {
        try {
            ensureChannels(getContext());
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("channels", new String[]{CHANNEL_CALLS, CHANNEL_MESSAGES, CHANNEL_SOCIAL});
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ensure failed: " + e.getMessage(), e);
        }
    }

    // The phone's DEFAULT ringtone, looped — used by the in-app (foreground)
    // IncomingCallModal so the web modal rings with the same system ringtone
    // the native full-screen IncomingCallActivity uses, instead of the synth
    // tone from soundEngine. (Browsers can't read the system ringtone; the
    // native plugin can.) Shared static so stopSystemRingtone() can reach it.
    private static MediaPlayer ringtonePlayer;

    @PluginMethod
    public void playSystemRingtone(PluginCall call) {
        try {
            // If a ringtone is already playing, tear it down first so we never
            // stack two MediaPlayers (which would double the ringtone).
            if (ringtonePlayer != null) {
                try { ringtonePlayer.stop(); } catch (Exception ignored) {}
                try { ringtonePlayer.release(); } catch (Exception ignored) {}
                ringtonePlayer = null;
            }

            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) {
                uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (uri == null) {
                // No ringtone available on this device — nothing to play.
                call.resolve();
                return;
            }

            MediaPlayer mp = new MediaPlayer();
            mp.setDataSource(getContext(), uri);
            mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            mp.setLooping(true);
            mp.prepare();
            mp.start();
            ringtonePlayer = mp;
        } catch (Exception e) {
            // Never reject — a missing/unreadable ringtone shouldn't break the
            // incoming-call flow. The modal still shows; it just won't ring.
        }
        call.resolve();
    }

    @PluginMethod
    public void stopSystemRingtone(PluginCall call) {
        try {
            if (ringtonePlayer != null) {
                try { ringtonePlayer.stop(); } catch (Exception ignored) {}
                try { ringtonePlayer.release(); } catch (Exception ignored) {}
                ringtonePlayer = null;
            }
        } catch (Exception e) {
            // best-effort — fall through to resolve.
        }
        call.resolve();
    }

    // Called from the web app when the callee accepts/declines the call from
    // within the app, so the native ringer notification + ringtone + any
    // showing full-screen IncomingCallActivity all get torn down.
    @PluginMethod
    public void dismissCallNotification(PluginCall call) {
        try {
            NotificationManager nm = (NotificationManager) getContext()
                .getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(CALL_NOTIF_ID);
        } catch (Exception ignored) {}

        // Stop the in-app system ringtone (same teardown as stopSystemRingtone).
        try {
            if (ringtonePlayer != null) {
                try { ringtonePlayer.stop(); } catch (Exception ignored) {}
                try { ringtonePlayer.release(); } catch (Exception ignored) {}
                ringtonePlayer = null;
            }
        } catch (Exception ignored) {}

        // Tell any showing full-screen IncomingCallActivity to stop + finish.
        try {
            getContext().sendBroadcast(
                new Intent("app.ringin.mobile.CALL_CANCELLED")
                    .setPackage(getContext().getPackageName()));
        } catch (Exception ignored) {}

        call.resolve();
    }
}
