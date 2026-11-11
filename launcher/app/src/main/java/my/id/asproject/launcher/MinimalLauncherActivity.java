package my.id.asproject.launcher;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.os.Handler;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Peluncur BERANDA SUPER POLOS -- dipakai KHUSUS untuk diagnosis ANR.
 *
 * Latar belakang: 6 percobaan perbaikan berturut-turut terhadap
 * {@link LauncherActivity} (versi lengkap dengan wallpaper liquid 3D, HUD,
 * ikon neon, widget sistem, spidometer, dll) gagal mengatasi macet di
 * Vivo Y50, dan TIGA mekanisme diagnostik berbeda ({@link CrashLog},
 * {@link StartupTrace} checkpoint, serta detak jantung runtime-nya) semua
 * tidak pernah mencatat apa pun sama sekali -- pertanda macetnya
 * kemungkinan terjadi di luar kode Java kita, atau terkait kompleksitas
 * render yang berat di perangkat kelas bawah ini.
 *
 * Activity ini sengaja dibuat TANPA satu pun fitur berat: tidak ada
 * wallpaper kustom/animasi Canvas apa pun, tidak ada layar kunci, tidak
 * ada widget sistem, tidak ada ikon neon (ikon aplikasi APA ADANYA dari
 * sistem), tidak ada spidometer. Hanya: jam digital teks biasa + kisi
 * aplikasi standar. Tujuannya satu: membuktikan apakah peluncur
 * SEPOLOS-POLOSNYA pun masih macet di perangkat ini, atau justru lancar
 * -- itu akan menentukan apakah biang keroknya memang kompleksitas fitur
 * {@link LauncherActivity}, atau sesuatu yang sama sekali lain (mis.
 * perilaku ROM/sistem terhadap status "aplikasi beranda default").
 *
 * Mekanisme diagnostik {@link CrashLog} & {@link StartupTrace} TETAP
 * dipasang di sini (sama seperti di {@link LauncherActivity}) supaya
 * kalau build ini TERNYATA tetap macet, kita masih py peluang menangkap
 * petunjuknya.
 */
public final class MinimalLauncherActivity extends Activity implements AdapterView.OnItemClickListener {

    private static final long HEARTBEAT_MS = 4000L;

    private final Handler handler = new Handler();
    private final List<AppItem> apps = new ArrayList<AppItem>();
    private final List<Drawable> icons = new ArrayList<Drawable>();
    private SimpleAppAdapter adapter;
    private TextView clockView;

    private final Runnable clockTick = new Runnable() {
        @Override
        public void run() {
            updateClock();
            handler.postDelayed(this, 1000L);
        }
    };

    private final Runnable heartbeatTick = new Runnable() {
        @Override
        public void run() {
            StartupTrace.mark(MinimalLauncherActivity.this,
                    "minimal:runtime:masih berjalan normal (detak rutin)");
            handler.postDelayed(this, HEARTBEAT_MS);
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        showPendingCrashIfAny();
        showPendingHangIfAny();
        StartupTrace.mark(this, "minimal:onCreate:sebelum setContentView");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);

        clockView = new TextView(this);
        clockView.setTextColor(Color.WHITE);
        clockView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 40f);
        clockView.setTypeface(Typeface.MONOSPACE);
        clockView.setGravity(Gravity.CENTER);
        int pad = dp(32);
        clockView.setPadding(pad, dp(56), pad, dp(16));
        column.addView(clockView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView hint = new TextView(this);
        hint.setText("Mode diagnosis super polos -- tanpa wallpaper/animasi/widget");
        hint.setTextColor(Color.GRAY);
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(pad, 0, pad, dp(16));
        column.addView(hint, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        GridView grid = new GridView(this);
        grid.setNumColumns(4);
        grid.setVerticalSpacing(dp(16));
        grid.setHorizontalSpacing(dp(8));
        grid.setPadding(dp(8), 0, dp(8), dp(24));
        grid.setGravity(Gravity.CENTER);
        adapter = new SimpleAppAdapter();
        grid.setAdapter(adapter);
        grid.setOnItemClickListener(this);
        column.addView(grid, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        root.addView(column, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        StartupTrace.mark(this, "minimal:onCreate:sesudah setContentView+susun tampilan");

        loadApps();
        StartupTrace.mark(this, "minimal:onCreate:sesudah memicu loadApps (thread baru)");
    }

    @Override
    protected void onResume() {
        super.onResume();
        StartupTrace.mark(this, "minimal:onResume:mulai");
        updateClock();
        handler.removeCallbacks(clockTick);
        handler.postDelayed(clockTick, 1000L);
        StartupTrace.mark(this, "minimal:onResume:sesudah pasang jam");
        handler.removeCallbacks(heartbeatTick);
        handler.postDelayed(heartbeatTick, HEARTBEAT_MS);
        StartupTrace.markDone(this);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(clockTick);
        handler.removeCallbacks(heartbeatTick);
        StartupTrace.markDone(this);
    }

    @Override
    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
        if (position < 0 || position >= apps.size()) {
            return;
        }
        try {
            startActivity(apps.get(position).launchIntent());
        } catch (ActivityNotFoundException | SecurityException error) {
            Toast.makeText(this, "Tidak bisa membuka aplikasi ini", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateClock() {
        clockView.setText(new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date()));
    }

    private void loadApps() {
        final AppRepository repository = new AppRepository(this);
        final PackageManager manager = getPackageManager();
        new Thread("AsProjectMinimalAppScan") {
            @Override
            public void run() {
                List<AppItem> loaded = repository.loadApps();
                List<Drawable> loadedIcons = new ArrayList<Drawable>(loaded.size());
                for (int i = 0; i < loaded.size(); i++) {
                    Drawable icon;
                    try {
                        icon = manager.getApplicationIcon(loaded.get(i).packageName);
                    } catch (PackageManager.NameNotFoundException | RuntimeException error) {
                        icon = null;
                    }
                    loadedIcons.add(icon);
                }
                final List<AppItem> finalLoaded = loaded;
                final List<Drawable> finalIcons = loadedIcons;
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (isFinishing() || isDestroyed()) {
                            return;
                        }
                        apps.clear();
                        apps.addAll(finalLoaded);
                        icons.clear();
                        icons.addAll(finalIcons);
                        adapter.notifyDataSetChanged();
                    }
                });
            }
        }.start();
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics()));
    }

    /** Lihat {@link LauncherActivity#showPendingCrashIfAny()} -- logika yang sama persis. */
    private void showPendingCrashIfAny() {
        final String trace = CrashLog.lastTrace(this);
        if (trace == null || trace.length() == 0) {
            return;
        }
        CrashLog.clear(this);
        final String shown = trace.length() > 3500 ? trace.substring(0, 3500) + "\n…(terpotong)" : trace;
        new AlertDialog.Builder(this)
                .setTitle("AsProject (mode polos) sempat berhenti sebelumnya")
                .setMessage(shown)
                .setPositiveButton("Salin teks", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        copyToClipboard(trace);
                    }
                })
                .setNegativeButton("Tutup", null)
                .setCancelable(true)
                .show();
    }

    /** Lihat {@link LauncherActivity#showPendingHangIfAny()} -- logika yang sama persis. */
    private void showPendingHangIfAny() {
        final String step = StartupTrace.lastStep(this);
        if (step == null || step.length() == 0) {
            return;
        }
        final long when = StartupTrace.lastTime(this);
        StartupTrace.markDone(this);
        final String whenText = when > 0
                ? new SimpleDateFormat("dd MMM HH:mm:ss", Locale.getDefault()).format(new Date(when))
                : "?";
        final String message = "Peluncuran sebelumnya (" + whenText + ") TIDAK PERNAH SELESAI. "
                + "Checkpoint terakhir:\n\n" + step
                + "\n\n(Ini adalah build DIAGNOSIS SUPER POLOS -- tanpa wallpaper, animasi, "
                + "widget, atau ikon neon sama sekali.)";
        new AlertDialog.Builder(this)
                .setTitle("AsProject (mode polos) macet di tengah proses")
                .setMessage(message)
                .setPositiveButton("Salin teks", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        copyToClipboard(message);
                    }
                })
                .setNegativeButton("Tutup", null)
                .setCancelable(true)
                .show();
    }

    private void copyToClipboard(String text) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText("asproject_minimal", text));
            Toast.makeText(this, "Disalin ke papan klip", Toast.LENGTH_SHORT).show();
        }
    }

    /** Adapter sesederhana mungkin: ikon sistem APA ADANYA + label, tanpa cache/bitmap kustom. */
    private final class SimpleAppAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return apps.size();
        }

        @Override
        public Object getItem(int position) {
            return apps.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            LinearLayout row;
            ImageView icon;
            TextView label;
            if (convertView instanceof LinearLayout) {
                row = (LinearLayout) convertView;
                icon = (ImageView) row.getChildAt(0);
                label = (TextView) row.getChildAt(1);
            } else {
                row = new LinearLayout(MinimalLauncherActivity.this);
                row.setOrientation(LinearLayout.VERTICAL);
                row.setGravity(Gravity.CENTER);
                int pad = dp(6);
                row.setPadding(pad, pad, pad, pad);

                icon = new ImageView(MinimalLauncherActivity.this);
                int iconSize = dp(48);
                row.addView(icon, new LinearLayout.LayoutParams(iconSize, iconSize));

                label = new TextView(MinimalLauncherActivity.this);
                label.setTextColor(Color.WHITE);
                label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f);
                label.setGravity(Gravity.CENTER);
                label.setMaxLines(2);
                label.setPadding(0, dp(4), 0, 0);
                row.addView(label, new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            }
            AppItem item = apps.get(position);
            Drawable drawable = position < icons.size() ? icons.get(position) : null;
            icon.setImageDrawable(drawable);
            label.setText(item.label);
            return row;
        }
    }
}
