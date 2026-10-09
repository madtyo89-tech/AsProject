package my.id.asproject.floating;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Layanan yang menahan gelembung melayang di atas aplikasi lain.
 *
 * <p>Dijalankan sebagai <i>foreground service</i> (tipe {@code specialUse}) supaya sistem tidak
 * mematikan gelembung saat aplikasi ditutup. Izin "tampil di atas aplikasi lain"
 * ({@code SYSTEM_ALERT_WINDOW}) wajib diberikan pengguna lewat Pengaturan Android —
 * {@link LauncherActivity} yang mengarahkannya.
 *
 * <p>Gelembung: digeser untuk memindah, diketuk untuk membuka panel, diketuk lagi (atau tombol
 * ✕) untuk menutup panel. Posisi terakhir disimpan, dan gelembung selalu menempel ke tepi
 * kiri/kanan layar setelah dilepas.
 */
public final class FloatingService extends Service {

    public static final String ACTION_START = "my.id.asproject.floating.action.START";
    public static final String ACTION_STOP = "my.id.asproject.floating.action.STOP";
    public static final String ACTION_REFRESH = "my.id.asproject.floating.action.REFRESH";

    private static final String CHANNEL_ID = "asproject.floating.bubble";
    private static final int NOTIFICATION_ID = 4101;

    private static final int COLOR_INK = 0xF20A0A0A;
    private static final int COLOR_GOLD = 0xFFD4AF37;
    private static final int COLOR_GOLD_DEEP = 0xFF9C7A24;
    private static final int COLOR_TEXT = 0xFFF2F2F2;
    private static final int COLOR_MUTED = 0xFFB8B2A6;

    /** Kolom maksimum pada panel aplikasi. */
    private static final int PANEL_COLUMNS = 3;

    private static volatile boolean running;

    private WindowManager windowManager;
    private ShortcutStore store;
    private View bubbleView;
    private WindowManager.LayoutParams bubbleParams;
    private View panelView;
    private WindowManager.LayoutParams panelParams;
    private int bubbleSize;
    private int touchSlop;

    public static boolean isRunning() {
        return running;
    }

    public static void start(Context context) {
        Intent intent = new Intent(context, FloatingService.class).setAction(ACTION_START);
        startCompat(context, intent);
    }

    public static void stop(Context context) {
        startCompat(context, new Intent(context, FloatingService.class).setAction(ACTION_STOP));
    }

    /** Perbarui isi panel setelah daftar aplikasi diubah (hanya bila gelembung aktif). */
    public static void refresh(Context context) {
        if (!running) {
            return;
        }
        startCompat(context, new Intent(context, FloatingService.class).setAction(ACTION_REFRESH));
    }

    private static void startCompat(Context context, Intent intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            // Android 8+ menolak startService dari latar belakang; abaikan saja —
            // gelembung akan dinyalakan lagi saat pengguna membuka aplikasi ini.
        }
    }

    // ------------------------------------------------------------------ siklus layanan

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        store = new ShortcutStore(this);
        bubbleSize = dp(56);
        touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            removeBubble();
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        running = true;
        if (ACTION_REFRESH.equals(action)) {
            if (panelView != null) {
                removePanel();
                showPanel();
            }
            return START_STICKY;
        }
        if (bubbleView == null) {
            if (!OverlayPermission.canDrawOverlays(this)) {
                stopSelf();
                return START_NOT_STICKY;
            }
            addBubble();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        removeBubble();
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ------------------------------------------------------------------ gelembung

    private void addBubble() {
        LinearLayout bubble = new LinearLayout(this);
        bubble.setOrientation(LinearLayout.VERTICAL);
        bubble.setGravity(Gravity.CENTER);
        bubble.setBackground(circleDrawable(COLOR_INK, COLOR_GOLD_DEEP, dp(2)));
        bubble.setContentDescription(getString(R.string.bubble_description));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_bubble_grid);
        int iconSize = dp(26);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(iconSize, iconSize);
        bubble.addView(icon, iconParams);

        bubbleParams = new WindowManager.LayoutParams(
                bubbleSize,
                bubbleSize,
                overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = initialX();
        bubbleParams.y = initialY();
        bubble.setOnTouchListener(new BubbleTouchListener());
        bubbleView = bubble;
        try {
            windowManager.addView(bubbleView, bubbleParams);
        } catch (Exception e) {
            bubbleView = null;
            stopSelf();
        }
    }

    private void removeBubble() {
        removePanel();
        if (bubbleView != null) {
            try {
                windowManager.removeView(bubbleView);
            } catch (Exception ignored) {
                // sudah lepas
            }
            bubbleView = null;
        }
    }

    private int initialX() {
        int saved = store.bubbleX();
        if (saved >= 0) {
            return clampX(saved);
        }
        return screenWidth() - bubbleSize - dp(8);
    }

    private int initialY() {
        int saved = store.bubbleY();
        if (saved >= 0) {
            return clampY(saved);
        }
        return (int) (screenHeight() * 0.38f);
    }

    // ------------------------------------------------------------------ panel aplikasi

    private void showPanel() {
        if (bubbleView == null) {
            return;
        }
        List<Shortcut> items = store.loadEnabled();

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackground(roundedDrawable(COLOR_INK, COLOR_GOLD_DEEP, dp(1), dp(16)));
        int pad = dp(12);
        panel.setPadding(pad, pad, pad, pad);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText(R.string.panel_title);
        title.setTextColor(COLOR_GOLD);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        title.setLetterSpacing(0.08f);
        LinearLayout.LayoutParams titleParams =
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        header.addView(title, titleParams);

        TextView close = new TextView(this);
        close.setText("✕");
        close.setTextColor(COLOR_MUTED);
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        close.setPadding(dp(8), 0, 0, 0);
        close.setContentDescription(getString(R.string.panel_close));
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                removePanel();
            }
        });
        header.addView(close);
        panel.addView(header, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        if (items.isEmpty()) {
            panel.addView(emptyHint(), hintParams());
        } else {
            List<List<Shortcut>> rows = chunk(items, PANEL_COLUMNS);
            for (List<Shortcut> row : rows) {
                panel.addView(buildRow(row));
            }
        }

        panelParams = new WindowManager.LayoutParams(
                panelWidth(),
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT);
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panelView = panel;
        positionPanel();
        try {
            windowManager.addView(panelView, panelParams);
        } catch (Exception e) {
            panelView = null;
        }
    }

    private void removePanel() {
        if (panelView != null) {
            try {
                windowManager.removeView(panelView);
            } catch (Exception ignored) {
                // sudah lepas
            }
            panelView = null;
        }
    }

    /** Lebar panel: tiga kolom, tapi tidak pernah lebih lebar daripada layar. */
    private int panelWidth() {
        return Math.min(screenWidth() - dp(16), dp(296));
    }

    /** Taruh panel di sisi gelembung yang masih punya ruang, lalu jepit agar tetap di layar. */
    private void positionPanel() {
        if (panelView == null || bubbleParams == null) {
            return;
        }
        panelView.measure(
                View.MeasureSpec.makeMeasureSpec(panelWidth(), View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(screenHeight(), View.MeasureSpec.AT_MOST));
        int width = panelParams.width > 0 ? panelParams.width : panelView.getMeasuredWidth();
        int height = panelView.getMeasuredHeight();
        int gap = dp(8);

        int x;
        if (bubbleParams.x + bubbleSize + gap + width <= screenWidth()) {
            x = bubbleParams.x + bubbleSize + gap;          // ruang di kanan gelembung
        } else {
            x = bubbleParams.x - gap - width;               // pindah ke kiri
        }
        x = Math.max(dp(4), Math.min(x, screenWidth() - width - dp(4)));
        int y = Math.max(dp(4), Math.min(bubbleParams.y, screenHeight() - height - dp(4)));
        panelParams.x = x;
        panelParams.y = y;
        try {
            windowManager.updateViewLayout(panelView, panelParams);
        } catch (Exception ignored) {
            // panel sudah dilepas
        }
    }

    private LinearLayout buildRow(List<Shortcut> row) {
        LinearLayout line = new LinearLayout(this);
        line.setOrientation(LinearLayout.HORIZONTAL);
        line.setBaselineAligned(false);
        LinearLayout.LayoutParams lineParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lineParams.topMargin = dp(10);
        for (Shortcut item : row) {
            line.addView(buildEntry(item), new LinearLayout.LayoutParams(0,
                    LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        }
        // Sisakan ruang kosong bila baris terakhir tidak penuh agar lebar kolom tetap.
        for (int i = row.size(); i < PANEL_COLUMNS; i++) {
            View spacer = new View(this);
            line.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
        }
        line.setLayoutParams(lineParams);
        return line;
    }

    private View buildEntry(final Shortcut item) {
        LinearLayout cell = new LinearLayout(this);
        cell.setOrientation(LinearLayout.VERTICAL);
        cell.setGravity(Gravity.CENTER_HORIZONTAL);
        cell.setPadding(dp(2), dp(4), dp(2), dp(4));
        cell.setContentDescription(item.label);

        TextView badge = new TextView(this);
        badge.setText(item.initial());
        badge.setTextColor(COLOR_INK);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setBackground(circleDrawable(item.color, 0, 0));
        int badgeSize = dp(44);
        cell.addView(badge, new LinearLayout.LayoutParams(badgeSize, badgeSize));

        TextView label = new TextView(this);
        label.setText(item.label);
        label.setTextColor(COLOR_TEXT);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        label.setGravity(Gravity.CENTER);
        label.setSingleLine(true);
        label.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        labelParams.topMargin = dp(4);
        cell.addView(label, labelParams);

        cell.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                removePanel();
                AppOpener.open(FloatingService.this, item, store.preferFreeform());
            }
        });
        return cell;
    }

    private TextView emptyHint() {
        TextView hint = new TextView(this);
        hint.setText(R.string.panel_empty);
        hint.setTextColor(COLOR_MUTED);
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        return hint;
    }

    private LinearLayout.LayoutParams hintParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(200),
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(10);
        return params;
    }

    // ------------------------------------------------------------------ sentuhan & posisi

    private final class BubbleTouchListener implements View.OnTouchListener {
        private int startX;
        private int startY;
        private int originX;
        private int originY;
        private boolean dragging;

        @SuppressLint("ClickableViewAccessibility")
        @Override
        public boolean onTouch(View v, MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = (int) event.getRawX();
                    startY = (int) event.getRawY();
                    originX = bubbleParams.x;
                    originY = bubbleParams.y;
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    int dx = (int) event.getRawX() - startX;
                    int dy = (int) event.getRawY() - startY;
                    if (!dragging && Math.hypot(dx, dy) > touchSlop) {
                        dragging = true;
                    }
                    if (dragging) {
                        bubbleParams.x = clampX(originX + dx);
                        bubbleParams.y = clampY(originY + dy);
                        windowManager.updateViewLayout(v, bubbleParams);
                        if (panelView != null) {
                            positionPanel();
                        }
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (dragging) {
                        snapToEdge();
                    } else if (event.getActionMasked() == MotionEvent.ACTION_UP) {
                        togglePanel();
                    }
                    return true;
                default:
                    return false;
            }
        }
    }

    private void togglePanel() {
        if (panelView != null) {
            removePanel();
        } else {
            showPanel();
        }
    }

    /** Setelah dilepas, gelembung menempel ke tepi kiri atau kanan (lebih mudah dijangkau). */
    private void snapToEdge() {
        int center = bubbleParams.x + bubbleSize / 2;
        bubbleParams.x = center < screenWidth() / 2 ? dp(8) : screenWidth() - bubbleSize - dp(8);
        bubbleParams.y = clampY(bubbleParams.y);
        try {
            windowManager.updateViewLayout(bubbleView, bubbleParams);
        } catch (Exception ignored) {
            return;
        }
        store.saveBubblePosition(bubbleParams.x, bubbleParams.y);
        if (panelView != null) {
            positionPanel();
        }
    }

    private int clampX(int x) {
        return Math.max(-dp(24), Math.min(x, screenWidth() - bubbleSize + dp(24)));
    }

    private int clampY(int y) {
        int top = statusBarHeight();
        int bottom = screenHeight() - bubbleSize - dp(8);
        return Math.max(top, Math.min(y, Math.max(top, bottom)));
    }

    // ------------------------------------------------------------------ utilitas tampilan

    private int overlayType() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        }
        return WindowManager.LayoutParams.TYPE_PHONE;
    }

    private int screenWidth() {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        return metrics.widthPixels;
    }

    private int screenHeight() {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        return metrics.heightPixels;
    }

    private int statusBarHeight() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : dp(24);
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics()));
    }

    private GradientDrawable circleDrawable(int fill, int stroke, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(fill);
        if (strokeWidth > 0) {
            drawable.setStroke(strokeWidth, stroke);
        }
        return drawable;
    }

    private GradientDrawable roundedDrawable(int fill, int stroke, int strokeWidth, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(radius);
        drawable.setColor(fill);
        if (strokeWidth > 0) {
            drawable.setStroke(strokeWidth, stroke);
        }
        return drawable;
    }

    private static <T> List<List<T>> chunk(List<T> items, int size) {
        List<List<T>> rows = new ArrayList<List<T>>();
        for (int i = 0; i < items.size(); i += size) {
            rows.add(new ArrayList<T>(items.subList(i, Math.min(items.size(), i + size))));
        }
        return rows;
    }

    // ------------------------------------------------------------------ notifikasi

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                getString(R.string.notif_channel_name), NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.notif_channel_description));
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, LauncherActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, flags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        builder.setContentTitle(getString(R.string.notif_title))
                .setContentText(getString(R.string.notif_text))
                .setSmallIcon(R.drawable.ic_bubble_grid)
                .setOngoing(true)
                .setContentIntent(pending);
        return builder.build();
    }
}
