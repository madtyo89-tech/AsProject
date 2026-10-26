package my.id.asproject.launcher;

import android.app.Application;

/**
 * Titik masuk proses. Satu-satunya tugasnya: memasang {@link CrashLog}
 * sedini mungkin (sebelum Activity/Service mana pun dibuat) supaya kalau
 * proses ini crash karena sebab apa pun, jejaknya tersimpan dan bisa
 * ditampilkan pada peluncuran berikutnya — lihat {@link CrashLog} untuk
 * alasan kenapa ini perlu (sandbox pengembangan tidak punya akses ADB/logcat
 * ke perangkat fisik mana pun).
 */
public class AsProjectApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        CrashLog.install(this);
    }
}
