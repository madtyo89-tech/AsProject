package my.id.asproject.floating;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.List;

/**
 * Penyimpanan pilihan pengguna: daftar aplikasi di gelembung, posisi gelembung, dan setelan.
 *
 * <p>Memakai {@code SharedPreferences} biasa (tanpa basis data) karena isinya hanya satu
 * baris teks daftar + beberapa angka.
 */
public final class ShortcutStore {

    private static final String PREFS = "asproject_floating";

    private static final String KEY_SHORTCUTS = "shortcuts";
    private static final String KEY_BUBBLE_X = "bubble_x";
    private static final String KEY_BUBBLE_Y = "bubble_y";
    private static final String KEY_SHOW_UNINSTALLED = "show_uninstalled";
    private static final String KEY_AUTOSTART = "autostart";

    private final SharedPreferences prefs;

    public ShortcutStore(Context context) {
        this.prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Daftar aplikasi sesuai urutan pengguna, sudah digabung dengan entri bawaan baru. */
    public List<Shortcut> load() {
        List<Shortcut> saved = ShortcutCodec.decode(prefs.getString(KEY_SHORTCUTS, null));
        return ShortcutCatalog.merge(saved);
    }

    public void save(List<Shortcut> list) {
        prefs.edit().putString(KEY_SHORTCUTS, ShortcutCodec.encode(list)).apply();
    }

    /** Hanya entri yang ikut tampil di gelembung. */
    public List<Shortcut> loadEnabled() {
        List<Shortcut> enabled = new ArrayList<Shortcut>();
        for (Shortcut item : load()) {
            if (item.enabled) {
                enabled.add(item);
            }
        }
        return enabled;
    }

    /** Kembalikan daftar ke bawaan aplikasi. */
    public void reset() {
        prefs.edit().remove(KEY_SHORTCUTS).apply();
    }

    /** {@code -1} berarti "belum pernah digeser" → pakai posisi awal. */
    public int bubbleX() {
        return prefs.getInt(KEY_BUBBLE_X, -1);
    }

    public int bubbleY() {
        return prefs.getInt(KEY_BUBBLE_Y, -1);
    }

    public void saveBubblePosition(int x, int y) {
        prefs.edit().putInt(KEY_BUBBLE_X, x).putInt(KEY_BUBBLE_Y, y).apply();
    }

    /** Tampilkan juga aplikasi yang belum terpasang di layar pengaturan. */
    public boolean showUninstalled() {
        return prefs.getBoolean(KEY_SHOW_UNINSTALLED, false);
    }

    public void setShowUninstalled(boolean value) {
        prefs.edit().putBoolean(KEY_SHOW_UNINSTALLED, value).apply();
    }

    /** Nyalakan gelembung otomatis setelah perangkat dinyalakan ulang. */
    public boolean autostart() {
        return prefs.getBoolean(KEY_AUTOSTART, false);
    }

    public void setAutostart(boolean value) {
        prefs.edit().putBoolean(KEY_AUTOSTART, value).apply();
    }
}
