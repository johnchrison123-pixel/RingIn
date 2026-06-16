package app.ringin.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.List;
import java.util.Map;

/**
 * RingInCallService — replaces Capacitor's default FCM MessagingService so we
 * can raise a TRUE full-screen incoming-call ringer (WhatsApp / Telegram style)
 * over the lock screen, instead of a small heads-up banner.
 *
 * It EXTENDS Capacitor's service and delegates every non-call message back to
 * super.onMessageReceived(...), so the push plugin's normal behaviour (token
 * registration, foreground message delivery to JS, message/social notifications)
 * is fully preserved. onNewToken is inherited unchanged.
 *
 * For this to work the CALL push MUST be a DATA-ONLY FCM message (no
 * `notification` / `android.notification` block). A notification-type message is
 * shown by the system tray when the app is backgrounded and onMessageReceived
 * never runs — so api/send-call-push.js sends data-only on purpose.
 *
 * Declared (and Capacitor's default removed) via AndroidManifest patches in
 * tools/install-native-plugins.mjs.
 */
public class RingInCallService extends MessagingService {

    private static final int CALL_NOTIF_ID = 7001;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;

        // Caller hung up / cancelled before the callee answered → dismiss the
        // ringer notification and broadcast so any showing IncomingCallActivity
        // stops ringing + finishes. Do NOT call super and do NOT show a call.
        if ("call_cancelled".equals(type)) {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel(CALL_NOTIF_ID);
                // Silence the single app-wide ringtone owned by the plugin (the
                // service started it in showFullScreenCall), then broadcast so any
                // showing IncomingCallActivity stops + finishes.
                RingInNotifChannelsPlugin.stopRingtone();
                sendBroadcast(new Intent("app.ringin.mobile.CALL_CANCELLED").setPackage(getPackageName()));
            } catch (Throwable ignored) {}
            return;
        }

        boolean isCall = "incoming_call".equals(type);
        if (!isCall) {
            // Messages / social / everything else → let the push plugin handle it.
            super.onMessageReceived(remoteMessage);
            return;
        }
        // App already open & in front → the in-app realtime listener shows the
        // incoming-call modal. Don't double up with the native full-screen ringer.
        if (isAppInForeground()) {
            return;
        }
        try {
            showFullScreenCall(data);
        } catch (Throwable t) {
            // Never crash the FCM service — fall back to default handling.
            try { super.onMessageReceived(remoteMessage); } catch (Throwable ignored) {}
        }
    }

    private void showFullScreenCall(Map<String, String> data) {
        String inviteId   = orEmpty(data.get("invite_id"));
        String callerName = data.get("caller_name");
        if (callerName == null || callerName.isEmpty()) callerName = "Someone";

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Full-screen intent → our native ringer activity. Used ONLY for the
        // LOCKED / screen-off case: Android fires the full-screen intent then,
        // showing IncomingCallActivity over the keyguard. When the phone is
        // UNLOCKED, Android instead surfaces the CallStyle banner below (with
        // Answer/Decline) and the FSI stays dormant — no SYSTEM_ALERT_WINDOW hack.
        Intent fsIntent = new Intent(this, IncomingCallActivity.class);
        fsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fsIntent.putExtra("invite_id", inviteId);
        fsIntent.putExtra("caller_name", callerName);
        PendingIntent fsPending = PendingIntent.getActivity(this, 1001, fsIntent, piFlags);

        // Answer / Decline actions for the CallStyle banner → the ringin:// deep
        // link, which App.js routes into the real accept / reject flow (same
        // handoff IncomingCallActivity uses on its own buttons).
        PendingIntent answerPending  = deepLink(1002, inviteId, "accept",  piFlags);
        PendingIntent declinePending = deepLink(1003, inviteId, "decline", piFlags);

        // CallStyle incoming-call notification: gives a proper system call banner
        // with Answer/Decline (unlocked) and drives the full-screen ringer via the
        // FSI (locked). The "calls_v2" channel is SILENT — the ringtone is played
        // by the single static owner (started just below), not by the channel.
        Person caller = new Person.Builder().setName(callerName).build();
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, "calls_v2")
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setFullScreenIntent(fsPending, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePending, answerPending));

        // Cold-boot fix: on a data-only FCM wake the Capacitor bridge / plugin
        // load() may not have run, so the "calls_v2" channel might not exist yet.
        // On Android 8+ posting to a missing channel SILENTLY drops the
        // notification (no ring, no full-screen intent). Re-create it here —
        // createNotificationChannel is a no-op when it already exists.
        RingInNotifChannelsPlugin.ensureChannels(this);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(CALL_NOTIF_ID, b.build());

        // The SERVICE owns the ringtone now — start the single app-wide ringtone
        // (+ vibration) for BOTH the locked full-screen case and the unlocked
        // CallStyle banner. startRingtone() tears down first, so even if
        // IncomingCallActivity (FSI) also calls it there is only ever ONE
        // ringtone. The old SYSTEM_ALERT_WINDOW startActivity(fsIntent) hack is
        // gone: locked relies on the FSI, unlocked relies on the CallStyle banner.
        RingInNotifChannelsPlugin.startRingtone(this);
    }

    private PendingIntent deepLink(int reqCode, String inviteId, String action, int piFlags) {
        Intent i = new Intent(Intent.ACTION_VIEW,
            Uri.parse("ringin://call?invite=" + Uri.encode(inviteId) + "&action=" + action));
        i.setPackage(getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, reqCode, i, piFlags);
    }

    private boolean isAppInForeground() {
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return false;
            List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
            if (procs == null) return false;
            String pkg = getPackageName();
            for (ActivityManager.RunningAppProcessInfo p : procs) {
                if (p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                        && p.processName != null && p.processName.equals(pkg)) {
                    return true;
                }
            }
        } catch (Throwable t) { /* best-effort */ }
        return false;
    }

    private static String orEmpty(String s) { return s == null ? "" : s; }
}
