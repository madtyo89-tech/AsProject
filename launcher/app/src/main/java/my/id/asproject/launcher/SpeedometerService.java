package my.id.asproject.launcher;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;

/**
 * Spidometer digital mengambang: satu bubble kaca cair neon yang tetap
 * tampil di atas aplikasi lain (gaya "chat head"), bisa digeser bebas, dan
 * menyalakan {@code FLAG_KEEP_SCREEN_ON} supaya layar tidak meredup/terkunci
 * selama bubble ini tampil — persis seperti permintaan: "floating dan tidak
 * redup layar".
 *
 * Ini SATU-SATUNYA fitur di launcher ini yang memakai izin Android: Lokasi
 * (kecepatan dihitung dari GPS), "Gambar di atas aplikasi lain", dan
 * notifikasi (wajib oleh sistem selama layanan latar depan berjalan). Semua
 * izin diminta oleh {@link SettingsActivity} hanya saat pengguna menyalakan
 * sakelar spidometer; layanan ini langsung berhenti sendiri bila salah satu
 * izin ternyata belum ada.
 */
public final class SpeedometerService extends Service implements LocationListener {

    public static final String ACTION_STOP = "my.id.asproject.launcher.action.STOP_SPEEDOMETER";

    private static final int NOTIF_ID = 421;
    private static final String CHANNEL_ID = "speedometer";
    private static final long FRAME_MS = 66L;

    private WindowManager windowManager;
    private SpeedGaugeView gaugeView;
    private WindowManager.LayoutParams params;
    private LocationManager locationManager;
    private Prefs prefs;
    private final Handler frameHandler = new Handler(Looper.getMainLooper());
    private long lastFrame;
    private boolean overlayAdded;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new Prefs(this);
        Accent.configure(prefs.accentStyle());

        if (!hasRequiredPermissions()) {
            prefs.setSpeedometerEnabled(false);
            stopSelf();
            return;
        }

        startInForeground();
        addOverlay();
        if (overlayAdded) {
            startLocationUpdates();
            lastFrame = SystemClock.uptimeMillis();
            frameHandler.postDelayed(frameTick, FRAME_MS);
        } else {
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        frameHandler.removeCallbacks(frameTick);
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) {
                // izin dicabut tepat sebelum layanan berhenti — aman diabaikan
            }
        }
        if (overlayAdded && windowManager != null && gaugeView != null) {
            try {
                windowManager.removeView(gaugeView);
            } catch (IllegalArgumentException ignored) {
                // sudah terlepas (mis. layar beranda dibangun ulang sistem)
            }
        }
        prefs.setSpeedometerEnabled(false);
        super.onDestroy();
    }

    // -------------------------------------------------------------- izin

    private boolean hasRequiredPermissions() {
        boolean hasLocation = Build.VERSION.SDK_INT < 23
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED;
        boolean hasOverlay = Build.VERSION.SDK_INT < 23
                || android.provider.Settings.canDrawOverlays(this);
        return hasLocation && hasOverlay;
    }

    // --------------------------------------------------------- notifikasi

    private void startInForeground() {
        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && manager != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                    getString(R.string.speedometer_channel), NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setDescription(getString(R.string.speedometer_channel_desc));
            manager.createNotificationChannel(channel);
        }

        int flags = Build.VERSION.SDK_INT >= 23
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        Intent stopIntent = new Intent(this, SpeedometerService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 0, stopIntent, flags);

        Intent openIntent = new Intent(this, SettingsActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, openIntent, flags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_notif_speedometer)
                .setContentTitle(getString(R.string.speedometer_notif_title))
                .setContentText(getString(R.string.speedometer_notif_text))
                .setContentIntent(openPending)
                .addAction(0, getString(R.string.speedometer_notif_stop), stopPending)
                .setOngoing(true)
                .setShowWhen(false);

        Notification notification = builder.build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, notification);
        }
    }

    // ------------------------------------------------------------ overlay

    private void addOverlay() {
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) {
            return;
        }
        gaugeView = new SpeedGaugeView(this);
        gaugeView.setUnit(prefs.speedUnit());

        float density = getResources().getDisplayMetrics().density;
        int sizePx = Math.round(118 * density);

        @SuppressWarnings("deprecation")
        int type = Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
                sizePx, sizePx, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        int[] pos = prefs.speedometerPosition();
        params.x = pos[0];
        params.y = pos[1];

        gaugeView.setOnTouchListener(new DragTouchListener());
        try {
            windowManager.addView(gaugeView, params);
            overlayAdded = true;
        } catch (Exception failed) {
            overlayAdded = false;
        }
    }

    // -------------------------------------------------------------- lokasi

    private void startLocationUpdates() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) {
            return;
        }
        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return;
        }
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 700L, 1f, this);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1500L, 3f, this);
            }
        } catch (SecurityException ignored) {
            stopSelf();
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (gaugeView == null) {
            return;
        }
        float speedMs = location.hasSpeed() ? location.getSpeed() : 0f;
        gaugeView.setSpeedKmh(speedMs * 3.6f);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // tidak dipakai
    }

    @Override
    public void onProviderEnabled(String provider) {
        // tidak dipakai
    }

    @Override
    public void onProviderDisabled(String provider) {
        // tidak dipakai
    }

    // --------------------------------------------------------------- animasi

    private final Runnable frameTick = new Runnable() {
        @Override
        public void run() {
            long now = SystemClock.uptimeMillis();
            float delta = Math.min(0.1f, (now - lastFrame) / 1000f);
            lastFrame = now;
            if (gaugeView != null) {
                gaugeView.tick(delta);
            }
            frameHandler.postDelayed(this, FRAME_MS);
        }
    };

    // ---------------------------------------------------------------- geser

    /**
     * Geser bebas: sentuh-tahan-tarik memindah bubble (posisi disimpan ke
     * Prefs begitu dilepas); ketuk singkat menukar satuan km/h ⇄ mph;
     * tekan lama mematikan bubble (sama seperti tombol "Matikan" di
     * notifikasi atau sakelar di Pengaturan).
     */
    private final class DragTouchListener implements View.OnTouchListener {
        private int startX;
        private int startY;
        private float startTouchX;
        private float startTouchY;
        private boolean moved;

        private final GestureDetector gestures = new GestureDetector(SpeedometerService.this,
                new GestureDetector.SimpleOnGestureListener() {
                    @Override
                    public boolean onSingleTapUp(MotionEvent event) {
                        String next = "mph".equals(prefs.speedUnit()) ? "kmh" : "mph";
                        prefs.setSpeedUnit(next);
                        gaugeView.setUnit(next);
                        return true;
                    }

                    @Override
                    public void onLongPress(MotionEvent event) {
                        Toast.makeText(SpeedometerService.this,
                                R.string.speedometer_stopped, Toast.LENGTH_SHORT).show();
                        stopSelf();
                    }
                });

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            gestures.onTouchEvent(event);
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = params.x;
                    startY = params.y;
                    startTouchX = event.getRawX();
                    startTouchY = event.getRawY();
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    int dx = Math.round(event.getRawX() - startTouchX);
                    int dy = Math.round(event.getRawY() - startTouchY);
                    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                        moved = true;
                    }
                    params.x = startX + dx;
                    params.y = startY + dy;
                    try {
                        windowManager.updateViewLayout(gaugeView, params);
                    } catch (IllegalArgumentException ignored) {
                        // bubble sudah terlepas di tengah gerakan — abaikan
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (moved) {
                        prefs.setSpeedometerPosition(params.x, params.y);
                    }
                    return true;
                default:
                    return false;
            }
        }
    }
}
