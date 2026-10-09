package my.id.asproject.floating;

import android.app.ActivityOptions;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Rect;
import android.os.Build;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;

import java.lang.reflect.Method;

/**
 * Upaya membuka aplikasi lain dalam <i>jendela melayang</i> (mode freeform Android 7+).
 *
 * <p><b>Realitanya:</b> Android tidak punya API publik untuk memaksa aplikasi pihak ketiga
 * tampil melayang. Produk "floating apps" mengakalinya dengan (1) menyalakan mode freeform
 * lewat {@code WRITE_SECURE_SETTINGS} (izin khusus yang hanya bisa diberi lewat ADB sekali),
 * lalu (2) meluncurkan activity dengan windowing-mode freeform + batas jendela. Kelas ini
 * melakukan keduanya secara <i>best-effort</i>: bila perangkat/ROM tidak mendukung, panggilan
 * gagal dengan aman dan pemanggil jatuh ke peluncuran layar penuh biasa.
 *
 * <p>Tidak ada yang dilempar keluar: semua jalur berbahaya dibungkus try/catch.
 */
public final class Freeform {

    private static final String TAG = "AsProjectFloating";

    /** Izin khusus (signature/ADB) untuk menulis setelan global, dipakai menyalakan freeform. */
    public static final String PERMISSION_WRITE_SECURE_SETTINGS =
            "android.permission.WRITE_SECURE_SETTINGS";

    /** {@code WindowManager.LayoutParams.WINDOWING_MODE_FREEFORM}. */
    private static final int WINDOWING_MODE_FREEFORM = 5;

    private static final String KEY_FREEFORM = "enable_freeform_support";
    private static final String KEY_FORCE_RESIZABLE = "force_resizable_activities";

    private Freeform() {
    }

    /** Freeform hanya ada sejak Android 7.0 (N). */
    public static boolean supported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N;
    }

    public static boolean hasSecureSettings(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return false;
        }
        try {
            return context.checkSelfPermission(PERMISSION_WRITE_SECURE_SETTINGS)
                    == PackageManager.PERMISSION_GRANTED;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Nyalakan dukungan freeform bila kita memegang {@code WRITE_SECURE_SETTINGS}.
     * Menulis kunci global yang sama dengan opsi pengembang "enable freeform" &
     * "force activities to be resizable".
     *
     * @return {@code true} bila setelan berhasil ditulis.
     */
    public static boolean enableSupport(Context context) {
        if (!supported() || !hasSecureSettings(context)) {
            return false;
        }
        try {
            Settings.Global.putInt(context.getContentResolver(), KEY_FREEFORM, 1);
            Settings.Global.putInt(context.getContentResolver(), KEY_FORCE_RESIZABLE, 1);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Gagal menyalakan freeform", e);
            return false;
        }
    }

    public static boolean isSupportEnabled(Context context) {
        if (!supported()) {
            return false;
        }
        try {
            return Settings.Global.getInt(context.getContentResolver(), KEY_FREEFORM, 0) == 1;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Coba luncurkan {@code intent} dalam jendela freeform.
     *
     * @return {@code true} bila activity diluncurkan dengan opsi freeform. {@code false} bila
     *         perangkat tidak mendukung / refleksi diblokir — pemanggil harus jatuh ke
     *         peluncuran biasa.
     */
    public static boolean launch(Context context, Intent intent) {
        if (context == null || intent == null || !supported()) {
            return false;
        }
        try {
            ActivityOptions options = ActivityOptions.makeBasic();
            if (!setWindowingMode(options)) {
                return false;   // tanpa windowing-mode freeform, bukan jendela melayang
            }
            setLaunchBounds(options, context);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent, options.toBundle());
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "Peluncuran freeform gagal, jatuh ke layar penuh", t);
            return false;
        }
    }

    /** Panggil metode tersembunyi {@code setLaunchWindowingMode(int)}. */
    private static boolean setWindowingMode(ActivityOptions options) {
        try {
            Method method = ActivityOptions.class.getMethod("setLaunchWindowingMode", int.class);
            method.invoke(options, WINDOWING_MODE_FREEFORM);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Panggil {@code setLaunchBounds(Rect)} agar jendela freeform punya ukuran awal. */
    private static void setLaunchBounds(ActivityOptions options, Context context) {
        try {
            DisplayMetrics metrics = context.getResources().getDisplayMetrics();
            int width = metrics.widthPixels;
            int height = metrics.heightPixels;
            int freeWidth = (int) (width * 0.86f);
            int freeHeight = (int) (height * 0.70f);
            int left = (width - freeWidth) / 2;
            int top = (int) (height * 0.10f);
            Method method = ActivityOptions.class.getMethod("setLaunchBounds", Rect.class);
            method.invoke(options, new Rect(left, top, left + freeWidth, top + freeHeight));
        } catch (Throwable ignored) {
            // ukuran awal opsional; freeform tetap bisa jalan tanpa ini
        }
    }

    /** Perintah ADB satu-kali untuk memberi izin menulis setelan (dijalankan di komputer). */
    public static String adbCommand(String packageName) {
        return "adb shell pm grant " + packageName + " " + PERMISSION_WRITE_SECURE_SETTINGS;
    }
}
