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
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

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
        maybeRequestOverlayPermission();
    }

    // "Display over other apps" (SYSTEM_ALERT_WINDOW) is what lets
    // RingInCallService launch the full-screen incoming-call screen OVER other
    // apps / the launcher when the phone is UNLOCKED and RingIn is
    // backgrounded/minimised. Without it Android only shows a heads-up banner.
    // Prompt once after install (the user can also toggle it later in Settings →
    // Apps → RingIn → "Display over other apps"). canDrawOverlays short-circuits
    // once it's granted, so we never nag after that.
    private void maybeRequestOverlayPermission() {
        try {
            Context ctx = getContext();
            if (ctx == null) return;
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;  // <23: granted at install
            if (Settings.canDrawOverlays(ctx)) return;                  // already granted
            android.content.SharedPreferences sp =
                ctx.getSharedPreferences("ringin_perms", Context.MODE_PRIVATE);
            if (sp.getBoolean("overlay_asked", false)) return;          // auto-ask only once
            sp.edit().putBoolean("overlay_asked", true).apply();
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Throwable ignored) { /* never block app start on this */ }
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

    // ────────────────────────────────────────────────────────────────────────
    // THE single, app-wide ringtone owner.
    //
    // There is exactly ONE ringtone for the whole incoming-call flow, owned by
    // these static fields. The FCM service (RingInCallService), the full-screen
    // ringer (IncomingCallActivity) and this plugin (for the in-app foreground
    // modal) all call the SAME startRingtone()/stopRingtone() — so no matter how
    // many of those paths fire for a single call, only one ringtone + one
    // vibration ever plays, and a single stopRingtone() silences everything.
    //
    // startRingtone() is idempotent: it tears down any existing player/vibrator
    // first, so calling it twice never stacks audio.
    // ────────────────────────────────────────────────────────────────────────
    private static MediaPlayer ringtonePlayer;
    private static Vibrator ringtoneVibrator;

    /**
     * Start (or restart) the single app-wide ringtone + looping vibration.
     * Idempotent / tears-down-first: safe to call from multiple code paths for
     * the same call. Plays the phone's default TYPE_RINGTONE (falling back to
     * TYPE_NOTIFICATION) on a loop with USAGE_NOTIFICATION_RINGTONE attributes.
     */
    public static void startRingtone(Context ctx) {
        if (ctx == null) return;

        // Always tear down any existing player FIRST so we never stack two
        // MediaPlayers (which would double the ringtone).
        if (ringtonePlayer != null) {
            try { ringtonePlayer.stop(); } catch (Exception ignored) {}
            try { ringtonePlayer.release(); } catch (Exception ignored) {}
            ringtonePlayer = null;
        }
        // And cancel any in-flight vibration so we don't stack waveforms either.
        if (ringtoneVibrator != null) {
            try { ringtoneVibrator.cancel(); } catch (Exception ignored) {}
            ringtoneVibrator = null;
        }

        // Ringtone (best-effort — a missing/unreadable ringtone must not break
        // the incoming-call flow; the UI still shows, it just won't ring).
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) {
                uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (uri != null) {
                MediaPlayer mp = new MediaPlayer();
                mp.setDataSource(ctx, uri);
                mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                mp.setLooping(true);
                mp.prepare();
                mp.start();
                ringtonePlayer = mp;
            }
        } catch (Exception ignored) { /* ring is best-effort */ }

        // Looping vibration (best-effort).
        try {
            Vibrator vib = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (vib != null && vib.hasVibrator()) {
                long[] pattern = {0, 1000, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vib.vibrate(pattern, 0);
                }
                ringtoneVibrator = vib;
            }
        } catch (Exception ignored) { /* vibrate is best-effort */ }
    }

    /** Stop + release the single app-wide ringtone and cancel its vibration. */
    public static void stopRingtone() {
        if (ringtonePlayer != null) {
            try { ringtonePlayer.stop(); } catch (Exception ignored) {}
            try { ringtonePlayer.release(); } catch (Exception ignored) {}
            ringtonePlayer = null;
        }
        if (ringtoneVibrator != null) {
            try { ringtoneVibrator.cancel(); } catch (Exception ignored) {}
            ringtoneVibrator = null;
        }
    }

    // The phone's DEFAULT ringtone, looped — used by the in-app (foreground)
    // IncomingCallModal so the web modal rings with the same system ringtone the
    // native full-screen IncomingCallActivity uses, instead of the synth tone
    // from soundEngine. (Browsers can't read the system ringtone; the native
    // plugin can.) Delegates to the single static owner above.
    @PluginMethod
    public void playSystemRingtone(PluginCall call) {
        try {
            startRingtone(getContext());
        } catch (Exception ignored) {
            // Never reject — a missing/unreadable ringtone shouldn't break the
            // incoming-call flow.
        }
        call.resolve();
    }

    @PluginMethod
    public void stopSystemRingtone(PluginCall call) {
        try {
            stopRingtone();
        } catch (Exception ignored) {
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

        // Stop the single app-wide ringtone + vibration.
        try { stopRingtone(); } catch (Exception ignored) {}

        // Tell any showing full-screen IncomingCallActivity to stop + finish.
        try {
            getContext().sendBroadcast(
                new Intent("app.ringin.mobile.CALL_CANCELLED")
                    .setPackage(getContext().getPackageName()));
        } catch (Exception ignored) {}

        call.resolve();
    }
}
