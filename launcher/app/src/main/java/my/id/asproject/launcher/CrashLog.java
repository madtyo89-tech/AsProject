package my.id.asproject.launcher;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Pencatat crash darurat tanpa izin apa pun dan tanpa ADB/logcat.
 *
 * Sandbox pengembangan ini tidak punya akses ke perangkat fisik sama sekali
 * (tidak ada ADB, tidak ada emulator), jadi satu-satunya cara mendapatkan
 * jejak tumpukan (stack trace) yang SESUNGGUHNYA dari HP pengguna adalah
 * dengan menuliskannya sendiri ke penyimpanan lokal aplikasi (SharedPreferences,
 * selalu tersedia tanpa izin) begitu terjadi, lalu menampilkannya sebagai
 * dialog pada peluncuran berikutnya yang berhasil — pengguna tinggal
 * memfoto/menyalin isinya.
 *
 * Ini TIDAK menangkap ANR murni (hang tanpa exception) karena tidak ada apa
 * pun yang "dilempar" pada kasus itu — hanya berguna bila penyebabnya
 * sebenarnya adalah crash (Java exception) yang selama ini terlihat seperti
 * macet dari luar (mis. karena aplikasi ini adalah launcher default, sistem
 * langsung meluncurkannya ulang begitu proses mati, sehingga penggunanya tak
 * sempat melihat dialog "Aplikasi berhenti" bawaan Android).
 */
public final class CrashLog {

    private static final String PREFS = "asproject_crash_log";
    private static final String KEY_TRACE = "trace";
    private static final String KEY_TIME = "time";

    private CrashLog() {
    }

    /** Pasang sekali di {@link AsProjectApp#onCreate()}, sebelum komponen lain dibuat. */
    public static void install(final Context appContext) {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable error) {
                try {
                    StringWriter sw = new StringWriter();
                    PrintWriter pw = new PrintWriter(sw);
                    pw.println("Thread: " + thread.getName());
                    error.printStackTrace(pw);
                    pw.flush();
                    SharedPreferences prefs =
                            appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                    prefs.edit()
                            .putString(KEY_TRACE, sw.toString())
                            .putLong(KEY_TIME, System.currentTimeMillis())
                            .commit(); // commit (bukan apply): proses mungkin mati sesaat lagi
                } catch (Throwable loggingFailed) {
                    // Jangan sampai si pencatat sendiri menimbulkan masalah baru.
                }
                if (previous != null) {
                    previous.uncaughtException(thread, error);
                } else {
                    android.os.Process.killProcess(android.os.Process.myPid());
                    System.exit(10);
                }
            }
        });
    }

    /** @return jejak crash terakhir yang belum ditampilkan, atau null bila tidak ada. */
    public static String lastTrace(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TRACE, null);
    }

    public static long lastTime(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_TIME, 0L);
    }

    public static void clear(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_TRACE)
                .remove(KEY_TIME)
                .apply();
    }
}
