package app.ringin.mobile;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * IncomingCallActivity — the full-screen, WhatsApp-style ringer shown over the
 * lock screen when a call push lands and the app is not in the foreground.
 *
 * Pure native (extends Activity, not Capacitor's BridgeActivity) so it can show
 * instantly from a cold FCM wake without booting the WebView. On Accept/Decline
 * it hands off to the web app via the ringin:// deep link, which App.js routes
 * into the real accept / reject flow.
 *
 * UI is built programmatically (no XML/res) so the whole feature is two .java
 * files the installer can drop in — nothing else to sync into res/.
 */
public class IncomingCallActivity extends Activity {

    private static final int CALL_NOTIF_ID = 7001;

    private MediaPlayer player;
    private Vibrator vibrator;
    private String inviteId = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over the lock screen + turn the screen on.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                try { km.requestDismissKeyguard(this, null); } catch (Throwable ignored) {}
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        Intent it = getIntent();
        if (it != null) {
            inviteId = orEmpty(it.getStringExtra("invite_id"));
        }
        String callerName = it != null ? it.getStringExtra("caller_name") : null;
        if (callerName == null || callerName.isEmpty()) callerName = "Someone";

        setContentView(buildUi(callerName));
        startRinging();
    }

    private View buildUi(String callerName) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#0B0B12"));
        root.setPadding(dp(28), dp(80), dp(28), dp(56));

        TextView appName = new TextView(this);
        appName.setText("RingIn");
        appName.setTextColor(Color.parseColor("#7B6EFF"));
        appName.setTextSize(18);
        appName.setTypeface(Typeface.DEFAULT_BOLD);
        appName.setGravity(Gravity.CENTER);
        root.addView(appName);

        TextView sub = new TextView(this);
        sub.setText("Incoming call");
        sub.setTextColor(Color.parseColor("#9AA0B5"));
        sub.setTextSize(14);
        sub.setGravity(Gravity.CENTER);
        root.addView(sub, marginTop(dp(8)));

        // Avatar circle with the caller's initial.
        TextView avatar = new TextView(this);
        String trimmed = callerName.trim();
        String initial = trimmed.isEmpty() ? "?" : trimmed.substring(0, 1).toUpperCase();
        avatar.setText(initial);
        avatar.setTextColor(Color.WHITE);
        avatar.setTextSize(60);
        avatar.setTypeface(Typeface.DEFAULT_BOLD);
        avatar.setGravity(Gravity.CENTER);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.parseColor("#7B6EFF"));
        avatar.setBackground(circle);
        LinearLayout.LayoutParams avLp = new LinearLayout.LayoutParams(dp(140), dp(140));
        avLp.topMargin = dp(52);
        avatar.setLayoutParams(avLp);
        root.addView(avatar);

        TextView name = new TextView(this);
        name.setText(callerName);
        name.setTextColor(Color.WHITE);
        name.setTextSize(28);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        name.setGravity(Gravity.CENTER);
        root.addView(name, marginTop(dp(28)));

        // Push the buttons to the bottom.
        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(0, 0, 1f));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);

        Button decline = pillButton("Decline", "#E5484D");
        decline.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { handOff("decline"); }
        });
        Button accept = pillButton("Accept", "#27C96A");
        accept.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { handOff("accept"); }
        });

        LinearLayout.LayoutParams bLp = new LinearLayout.LayoutParams(dp(132), dp(58));
        bLp.leftMargin = dp(14);
        bLp.rightMargin = dp(14);
        row.addView(decline, bLp);
        row.addView(accept, bLp);
        root.addView(row);

        return root;
    }

    private Button pillButton(String label, String color) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(17);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setStateListAnimator(null);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dp(30));
        bg.setColor(Color.parseColor(color));
        btn.setBackground(bg);
        return btn;
    }

    private void startRinging() {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (uri != null) {
                player = new MediaPlayer();
                player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                player.setDataSource(this, uri);
                player.setLooping(true);
                player.prepare();
                player.start();
            }
        } catch (Throwable t) { /* ring is best-effort */ }

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Throwable t) { /* vibrate is best-effort */ }
    }

    private void stopRinging() {
        try { if (player != null) { player.stop(); player.release(); player = null; } } catch (Throwable t) {}
        try { if (vibrator != null) vibrator.cancel(); } catch (Throwable t) {}
    }

    private void clearNotif() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(CALL_NOTIF_ID);
        } catch (Throwable t) {}
    }

    // Hand off to the web app via the ringin:// deep link (App.js routes it).
    private void handOff(String action) {
        stopRinging();
        clearNotif();
        try {
            Intent i = new Intent(Intent.ACTION_VIEW,
                Uri.parse("ringin://call?invite=" + Uri.encode(inviteId) + "&action=" + action));
            i.setPackage(getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
        } catch (Throwable t) { /* ignore */ }
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRinging();
    }

    private LinearLayout.LayoutParams marginTop(int top) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = top;
        return lp;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private static String orEmpty(String s) { return s == null ? "" : s; }
}
