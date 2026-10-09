package my.id.asproject.floating;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;

/**
 * Membuka aplikasi lain dari gelembung melayang.
 *
 * <p>Urutan percobaan untuk satu entri:
 * <ol>
 *   <li>tiap paket pada {@link Shortcut#packages} sampai ada yang terpasang
 *       (WhatsApp Business, misalnya, memenuhi entri "WhatsApp");</li>
 *   <li>bila entri punya {@link Shortcut#uri}, tautan itu dibuka;</li>
 *   <li>terakhir: buka halaman aplikasi di toko aplikasi supaya pengguna bisa memasangnya.</li>
 * </ol>
 */
public final class AppOpener {

    private static final String TAG = "AsProjectFloating";

    private AppOpener() {
    }

    /**
     * Buka {@code shortcut} (layar penuh).
     *
     * @return {@code true} bila ada aplikasi/tautan yang berhasil dibuka.
     */
    public static boolean open(Context context, Shortcut shortcut) {
        return open(context, shortcut, false);
    }

    /**
     * Buka {@code shortcut}. Bila {@code preferFreeform} dan perangkat mendukung, coba buka
     * dalam jendela melayang lebih dulu; bila gagal, jatuh ke layar penuh.
     *
     * @return {@code true} bila ada aplikasi/tautan yang berhasil dibuka.
     */
    public static boolean open(Context context, Shortcut shortcut, boolean preferFreeform) {
        if (context == null || shortcut == null) {
            return false;
        }
        String installed = firstInstalled(context, shortcut.packages);
        if (installed != null && launchPackage(context, installed, preferFreeform)) {
            return true;
        }
        if (shortcut.uri != null && openUri(context, shortcut.uri, preferFreeform)) {
            return true;
        }
        // Tidak terpasang: arahkan ke toko aplikasi (bila entri berbasis paket).
        return shortcut.packages.length > 0 && openStore(context, shortcut.primaryPackage());
    }

    /** Paket pertama yang benar-benar terpasang, atau {@code null}. */
    public static String firstInstalled(Context context, String[] packages) {
        if (context == null || packages == null) {
            return null;
        }
        PackageManager pm = context.getPackageManager();
        for (String pkg : packages) {
            if (pkg == null || pkg.trim().isEmpty()) {
                continue;
            }
            try {
                pm.getPackageInfo(pkg.trim(), 0);
                return pkg.trim();
            } catch (PackageManager.NameNotFoundException ignored) {
                // coba varian berikutnya
            } catch (Exception e) {
                Log.w(TAG, "Gagal memeriksa paket " + pkg, e);
            }
        }
        return null;
    }

    public static boolean isInstalled(Context context, String[] packages) {
        return firstInstalled(context, packages) != null;
    }

    /** Luncurkan activity utama sebuah paket (layar penuh). */
    public static boolean launchPackage(Context context, String pkg) {
        return launchPackage(context, pkg, false);
    }

    /** Luncurkan activity utama sebuah paket, opsional sebagai jendela melayang. */
    public static boolean launchPackage(Context context, String pkg, boolean preferFreeform) {
        if (context == null || pkg == null || pkg.trim().isEmpty()) {
            return false;
        }
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(pkg.trim());
        if (intent == null) {
            intent = new Intent(Intent.ACTION_MAIN).setPackage(pkg.trim());
        }
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        if (preferFreeform && Freeform.launch(context, intent)) {
            return true;
        }
        return start(context, intent, "paket " + pkg);
    }

    /** Buka tautan (geo:, https:, dan sebagainya) layar penuh. */
    public static boolean openUri(Context context, String uri) {
        return openUri(context, uri, false);
    }

    /** Buka tautan, opsional sebagai jendela melayang. */
    public static boolean openUri(Context context, String uri, boolean preferFreeform) {
        if (context == null || uri == null || uri.trim().isEmpty()) {
            return false;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri.trim()));
        if (preferFreeform && Freeform.launch(context, intent)) {
            return true;
        }
        return start(context, intent, "tautan " + uri);
    }

    /**
     * Buka halaman aplikasi di toko aplikasi. Dicoba lewat skema {@code market://} lebih dulu,
     * lalu lewat Play Store di peramban bila tidak ada toko yang terpasang.
     */
    public static boolean openStore(Context context, String pkg) {
        if (context == null || pkg == null || pkg.trim().isEmpty()) {
            return false;
        }
        String id = pkg.trim();
        if (start(context, new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + id)),
                "market " + id)) {
            return true;
        }
        return start(context,
                new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=" + id)),
                "play store " + id);
    }

    private static boolean start(Context context, Intent intent, String label) {
        try {
            // Gelembung berjalan di dalam Service, jadi activity baru wajib punya task sendiri.
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "Tidak ada aplikasi untuk " + label);
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Gagal membuka " + label, e);
            return false;
        }
    }
}
