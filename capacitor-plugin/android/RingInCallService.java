package app.ringin.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

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

        // Full-screen intent → our native ringer activity (shows over lock screen).
        Intent fsIntent = new Intent(this, IncomingCallActivity.class);
        fsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fsIntent.putExtra("invite_id", inviteId);
        fsIntent.putExtra("caller_name", callerName);
        PendingIntent fsPending = PendingIntent.getActivity(this, 1001, fsIntent, piFlags);

        // NO Accept/Decline buttons on the notification. The user wants a tap on
        // the banner to OPEN THE FULL CALL SCREEN (and choose Accept/Decline
        // there) — never to accept/decline straight from the banner. So BOTH the
        // full-screen intent (locked/screen-off) and the tap content intent
        // (unlocked heads-up) point at the full-screen ringer activity. Result:
        // tapping the banner anywhere = the call screen opens, never auto-accept.
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, "calls_v2")
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Incoming Call")
            .setContentText(callerName + " is calling you")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(true)
            .setFullScreenIntent(fsPending, true)
            .setContentIntent(fsPending);

        // Cold-boot fix: on a data-only FCM wake the Capacitor bridge / plugin
        // load() may not have run, so the "calls_v2" channel might not exist yet.
        // On Android 8+ posting to a missing channel SILENTLY drops the
        // notification (no ring, no full-screen intent). Re-create it here —
        // createNotificationChannel is a no-op when it already exists.
        RingInNotifChannelsPlugin.ensureChannels(this);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(CALL_NOTIF_ID, b.build());

        // Force the full-screen ringer to the FRONT even when the phone is
        // UNLOCKED and RingIn is backgrounded/minimised. Android downgrades a
        // full-screen INTENT to a heads-up banner while the screen is on, so we
        // ALSO launch the activity directly. A background startActivity is allowed
        // on Android 10+ only if the user granted "Display over other apps"
        // (SYSTEM_ALERT_WINDOW) — RingInNotifChannelsPlugin requests it on launch.
        // Without that permission this is blocked and we fall back to the heads-up
        // banner above. Safe against double-launch now: IncomingCallActivity is
        // launchMode=singleTask and the ringtone is a static singleton, so even if
        // the full-screen intent also fires there is only ever ONE activity + ONE
        // ringtone.
        try {
            startActivity(fsIntent);
        } catch (Throwable t) {
            /* no overlay permission (or OEM block) → the heads-up banner above is the fallback */
        }
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
