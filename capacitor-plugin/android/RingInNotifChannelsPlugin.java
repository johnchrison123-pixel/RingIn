package app.ringin.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
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
}
