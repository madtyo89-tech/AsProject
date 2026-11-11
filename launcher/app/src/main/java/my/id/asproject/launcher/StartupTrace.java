package my.id.asproject.launcher;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Jejak checkpoint proses mulai (startup), untuk mendiagnosis ANR MURNI
 * (hang/macet tanpa exception) yang TIDAK bisa ditangkap oleh {@link CrashLog}
 * -- lihat catatan di {@link CrashLog} kenapa hang murni tidak melempar apa
 * pun untuk ditangkap.
 *
 * Cara kerja: setiap tahap penting di {@code onCreate()}/{@code onResume()}
 * menuliskan nama tahapnya sendiri ke SharedPreferences memakai
 * {@code commit()} (synchronous, BUKAN {@code apply()}) tepat SEBELUM baris
 * kode berikutnya dieksekusi. Kalau baris berikutnya itu yang ternyata
 * macet/hang selamanya (sampai akhirnya proses dibunuh paksa oleh sistem),
 * tulisan checkpoint tadi sudah pasti sempat tersimpan ke disk duluan.
 *
 * Begitu seluruh proses mulai selesai dengan selamat (akhir
 * {@code onResume()}), jejaknya dihapus lewat {@link #markDone(Context)}.
 * Jadi kalau pada peluncuran BERIKUTNYA ternyata jejak checkpoint masih ADA
 * (belum sempat dihapus), itu artinya peluncuran sebelumnya tidak pernah
 * selesai mulai -- dan nama checkpoint terakhir yang tersimpan adalah titik
 * PERSIS sebelum hang-nya terjadi.
 */
public final class StartupTrace {

    private static final String PREFS = "asproject_startup_trace";
    private static final String KEY_STEP = "step";
    private static final String KEY_TIME = "time";

    private StartupTrace() {
    }

    /** Catat tahap saat ini. Dipanggil berulang kali sepanjang onCreate()/onResume(). */
    public static void mark(Context context, String step) {
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_STEP, step)
                    .putLong(KEY_TIME, System.currentTimeMillis())
                    .commit();
        } catch (Throwable ignored) {
            // Pencatat checkpoint sendiri tidak boleh menimbulkan masalah baru.
        }
    }

    /** @return nama checkpoint terakhir yang tercatat belum selesai, atau null bila tak ada. */
    public static String lastStep(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STEP, null);
    }

    public static long lastTime(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_TIME, 0L);
    }

    /** Dipanggil di akhir onResume() yang berhasil: hapus jejak, tidak ada apa pun untuk dilaporkan. */
    public static void markDone(Context context) {
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit();
        } catch (Throwable ignored) {
        }
    }
}
