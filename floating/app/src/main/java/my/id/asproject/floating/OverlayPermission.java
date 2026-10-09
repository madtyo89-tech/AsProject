package my.id.asproject.floating;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

/**
 * Pembantu izin "Tampil di atas aplikasi lain" ({@code SYSTEM_ALERT_WINDOW}).
 *
 * <p>Sejak Android 6.0 izin ini <b>tidak</b> bisa diminta lewat dialog biasa: pengguna harus
 * menyalakannya sendiri di Pengaturan. Pada Android 5.x izin diberikan saat pemasangan, jadi
 * {@link #canDrawOverlays(Context)} langsung {@code true}.
 */
public final class OverlayPermission {

    private static final String TAG = "AsProjectFloating";

    private OverlayPermission() {
    }

    public static boolean isUserActionRequired() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M;
    }

    public static boolean canDrawOverlays(Context context) {
        if (!isUserActionRequired()) {
            return true;
        }
        try {
            return Settings.canDrawOverlays(context);
        } catch (Exception e) {
            Log.w(TAG, "Gagal memeriksa izin overlay", e);
            return false;
        }
    }

    /** Buka layar Pengaturan untuk menyalakan izin overlay aplikasi ini. */
    public static boolean request(Context context) {
        if (context == null) {
            return false;
        }
        Intent withPackage = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + context.getPackageName()));
        if (start(context, withPackage)) {
            return true;
        }
        // Sebagian ROM tidak punya halaman per-aplikasi: pakai daftar umum.
        if (start(context, new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))) {
            return true;
        }
        return start(context, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.getPackageName())));
    }

    private static boolean start(Context context, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Tidak bisa membuka pengaturan: " + intent);
            return false;
        }
    }
}
