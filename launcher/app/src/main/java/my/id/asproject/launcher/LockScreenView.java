package my.id.asproject.launcher;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextClock;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Layar kunci AsProject: bingkai liquid-chrome, jam neon, chip HUD berisi daya
 * baterai asli, dan gerakan "geser ke atas" untuk membuka.
 *
 * Tanpa izin apa pun: daya baterai dibaca dari {@link BatteryManager} yang tidak
 * memerlukan permission.
 */
public final class LockScreenView extends FrameLayout {

    /** Dipanggil saat pengguna selesai membuka layar kunci. */
    public interface Listener {
        void onUnlocked();
    }

    private final int touchSlop;
    private final int minVelocity;
    private final float unlockFraction;

    private Listener listener;
    private View content;
    private TextClock clock;
    private TextView dateView;
    private LiquidBatteryView batteryMeter;
    private HudView hud;
    private LockWallpaperView wallpaper;

    private VelocityTracker velocity;
    private float downRawY;
    private float lastY;
    private boolean dragging;
    private boolean unlocking;

    public LockScreenView(Context context) {
        this(context, null);
    }

    /** Dipakai saat di-inflate dari XML (activity_launcher.xml). */
    public LockScreenView(Context context, android.util.AttributeSet attrs) {
        super(context, attrs);
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
        minVelocity = (int) (900 * getResources().getDisplayMetrics().density);
        unlockFraction = 0.16f;
        setClickable(true);
        LayoutInflater.from(context).inflate(R.layout.view_lock_screen, this, true);

        content = findViewById(R.id.lockContent);
        clock = (TextClock) findViewById(R.id.lockClock);
        dateView = (TextView) findViewById(R.id.lockDate);
        batteryMeter = (LiquidBatteryView) findViewById(R.id.batteryMeter);
        hud = (HudView) findViewById(R.id.hud);
        wallpaper = (LockWallpaperView) findViewById(R.id.lockWallpaper);
    }

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    // ------------------------------------------------------------------ tampil

    /** Tampilkan layar kunci. */
    public void show(boolean animate) {
        unlocking = false;
        setVisibility(VISIBLE);
        content.setTranslationY(0f);
        content.setAlpha(1f);
        setAlpha(1f);
        refreshBattery();
        refreshDate();
        refreshHud();
        if (wallpaper != null) {
            wallpaper.setMotionEnabled(true);
        }
        if (animate) {
            setAlpha(0f);
            content.setTranslationY(dp(28));
            animate().alpha(1f).setDuration(220).setInterpolator(new DecelerateInterpolator()).start();
            content.animate().translationY(0f).setDuration(260)
                    .setInterpolator(new DecelerateInterpolator()).start();
        }
    }

    /** Sembunyikan seketika (mis. layar kunci dimatikan di pengaturan). */
    public void hideNow() {
        unlocking = false;
        setVisibility(GONE);
        content.setTranslationY(0f);
        setAlpha(1f);
        if (wallpaper != null) {
            wallpaper.setMotionEnabled(false);
        }
    }

    /** Terapkan pilihan tampilan dari Pengaturan. */
    public void applyPrefs(Prefs prefs) {
        boolean withHud = prefs.hudAnimation();
        if (hud != null) {
            hud.setVisibility(withHud ? View.VISIBLE : View.GONE);
        }
        // Beri ruang di bawah agar petunjuk "geser ke atas" tidak tertutup panel HUD
        // (panel 132dp + margin 18dp + jarak aman 10dp).
        View root = content;
        if (root != null) {
            int side = Math.round(26 * getResources().getDisplayMetrics().density);
            int bottom = Math.round((withHud ? 160 : 18) * getResources().getDisplayMetrics().density);
            root.setPadding(side, side, side, bottom);
        }
        if (wallpaper != null) {
            wallpaper.useFrameOnly(prefs.lockFrameOnly());
            wallpaper.setMotionEnabled(prefs.liquidMotion() && getVisibility() == VISIBLE);
        }
    }

    public boolean isShowingLock() {
        return getVisibility() == VISIBLE;
    }

    // ------------------------------------------------------------------ sentuh

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (unlocking) {
            return true;
        }
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                downRawY = event.getRawY();
                lastY = event.getRawY();
                dragging = false;
                if (velocity == null) {
                    velocity = VelocityTracker.obtain();
                }
                velocity.clear();
                velocity.addMovement(event);
                content.animate().cancel();
                return true;

            case MotionEvent.ACTION_MOVE:
                if (velocity != null) {
                    velocity.addMovement(event);
                }
                float delta = event.getRawY() - downRawY;
                if (!dragging && Math.abs(delta) > touchSlop) {
                    dragging = true;
                }
                if (dragging) {
                    float offset = Math.min(0f, delta);
                    content.setTranslationY(offset);
                    content.setAlpha(1f - Math.min(0.75f, -offset / (getHeight() * 0.6f)));
                }
                lastY = event.getRawY();
                return true;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                float travel = lastY - downRawY;
                float speed = 0f;
                if (velocity != null) {
                    velocity.addMovement(event);
                    velocity.computeCurrentVelocity(1000);
                    speed = velocity.getYVelocity();
                    velocity.recycle();
                    velocity = null;
                }
                boolean far = -travel > getHeight() * unlockFraction;
                boolean fast = -speed > minVelocity && -travel > touchSlop;
                if (dragging && (far || fast)) {
                    unlock();
                } else {
                    springBack();
                }
                dragging = false;
                return true;

            default:
                return super.onTouchEvent(event);
        }
    }

    private void springBack() {
        content.animate().translationY(0f).alpha(1f).setDuration(180)
                .setInterpolator(new DecelerateInterpolator()).start();
    }

    private void unlock() {
        unlocking = true;
        content.animate()
                .translationY(-getHeight() * 0.45f)
                .alpha(0f)
                .setDuration(210)
                .setInterpolator(new DecelerateInterpolator())
                .withEndAction(new Runnable() {
                    @Override
                    public void run() {
                        setVisibility(GONE);
                        content.setTranslationY(0f);
                        content.setAlpha(1f);
                        unlocking = false;
                        if (listener != null) {
                            listener.onUnlocked();
                        }
                    }
                })
                .start();
    }

    // ------------------------------------------------------------------ isi

    public void refreshBattery() {
        BatteryManager manager = (BatteryManager) getContext().getSystemService(Context.BATTERY_SERVICE);
        int level = -1;
        if (manager != null) {
            level = manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        }
        batteryMeter.setBattery(level, false);
    }

    /**
     * Bacaan baterai untuk HUD: persen, status mengisi, dan suhu baterai
     * (EXTRA_TEMPERATURE, sepersepuluh derajat Celsius). Semua dari siaran sticky
     * ACTION_BATTERY_CHANGED — tidak memerlukan izin.
     */
    public void refreshHud() {
        int level = -1;
        boolean charging = false;
        float temperature = Float.NaN;
        try {
            Intent battery = getContext().registerReceiver(null,
                    new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (battery != null) {
                int raw = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                if (raw >= 0 && scale > 0) {
                    level = Math.round(raw * 100f / scale);
                }
                int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                        || status == BatteryManager.BATTERY_STATUS_FULL;
                int tenths = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
                if (tenths != Integer.MIN_VALUE) {
                    temperature = tenths / 10f;
                }
            }
        } catch (RuntimeException ignored) {
            // sebagian ROM menolak siaran sticky; HUD menampilkan "--"
        }
        if (level < 0) {
            BatteryManager manager = (BatteryManager) getContext().getSystemService(Context.BATTERY_SERVICE);
            if (manager != null) {
                level = manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            }
        }
        if (hud != null) {
            hud.setBattery(level, charging, temperature);
        }
        batteryMeter.setBattery(level, charging);
    }

    public void refreshDate() {
        SimpleDateFormat format = new SimpleDateFormat("EEEE, d MMMM yyyy", new Locale("id", "ID"));
        dateView.setText(format.format(new Date()));
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ticker.postDelayed(tick, 1000L);
    }

    @Override
    protected void onDetachedFromWindow() {
        ticker.removeCallbacks(tick);
        super.onDetachedFromWindow();
    }

    private final android.os.Handler ticker = new android.os.Handler();
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (getVisibility() == VISIBLE) {
                refreshHud();   // sekaligus memperbarui chip baterai di atas
            }
            ticker.postDelayed(this, 1000L);
        }
    };
}
