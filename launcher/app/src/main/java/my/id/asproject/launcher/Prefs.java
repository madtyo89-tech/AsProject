package my.id.asproject.launcher;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Preferensi beranda. Semua nilai disimpan lokal di perangkat ini saja —
 * launcher tidak meminta izin jaringan sama sekali.
 */
public final class Prefs {

    private static final String FILE = "launcher_prefs";

    private static final String KEY_COLUMNS = "columns";
    private static final String KEY_CLOCK = "show_clock";
    private static final String KEY_SEARCH = "show_search";
    private static final String KEY_LABELS = "show_labels";
    private static final String KEY_DOCK = "dock";
    private static final String KEY_HIDDEN = "hidden";
    private static final String KEY_FIGURE_WALLPAPER = "figure_wallpaper";
    private static final String KEY_LOCK_SCREEN = "lock_screen";
    private static final String KEY_NEON_ICONS = "neon_icons";
    private static final String KEY_HUD_ANIMATION = "hud_animation";
    private static final String KEY_LIQUID_MOTION = "liquid_motion";

    public static final int MIN_COLUMNS = 3;
    public static final int MAX_COLUMNS = 6;
    public static final int DEFAULT_COLUMNS = 4;
    public static final int MAX_DOCK = 5;

    private final SharedPreferences prefs;

    public Prefs(Context context) {
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------------ grid

    public int columns() {
        return clamp(prefs.getInt(KEY_COLUMNS, DEFAULT_COLUMNS), MIN_COLUMNS, MAX_COLUMNS);
    }

    public void setColumns(int columns) {
        prefs.edit().putInt(KEY_COLUMNS, clamp(columns, MIN_COLUMNS, MAX_COLUMNS)).apply();
    }

    // ------------------------------------------------------------- tampilan

    public boolean showClock() {
        return prefs.getBoolean(KEY_CLOCK, true);
    }

    public void setShowClock(boolean show) {
        prefs.edit().putBoolean(KEY_CLOCK, show).apply();
    }

    public boolean showSearch() {
        return prefs.getBoolean(KEY_SEARCH, true);
    }

    public void setShowSearch(boolean show) {
        prefs.edit().putBoolean(KEY_SEARCH, show).apply();
    }

    public boolean showLabels() {
        return prefs.getBoolean(KEY_LABELS, true);
    }

    public void setShowLabels(boolean show) {
        prefs.edit().putBoolean(KEY_LABELS, show).apply();
    }

    // ------------------------------------------------------------ wallpaper & layar kunci

    /** Wallpaper neon AsProject (bingkai di layar kunci, sirkuit di beranda). */
    public boolean figureWallpaper() {
        return prefs.getBoolean(KEY_FIGURE_WALLPAPER, true);
    }

    public void setFigureWallpaper(boolean enabled) {
        prefs.edit().putBoolean(KEY_FIGURE_WALLPAPER, enabled).apply();
    }

    /** Layar kunci bawaan AsProject. */
    public boolean lockScreen() {
        return prefs.getBoolean(KEY_LOCK_SCREEN, true);
    }

    public void setLockScreen(boolean enabled) {
        prefs.edit().putBoolean(KEY_LOCK_SCREEN, enabled).apply();
    }

    /** Ikon neon sirkuit untuk aplikasi populer yang terpasang. */
    public boolean neonIcons() {
        return prefs.getBoolean(KEY_NEON_ICONS, true);
    }

    public void setNeonIcons(boolean enabled) {
        prefs.edit().putBoolean(KEY_NEON_ICONS, enabled).apply();
    }

    /** HUD layar kunci beranimasi (cincin berputar, garis pindai, gelombang). */
    public boolean hudAnimation() {
        return prefs.getBoolean(KEY_HUD_ANIMATION, true);
    }

    public void setHudAnimation(boolean enabled) {
        prefs.edit().putBoolean(KEY_HUD_ANIMATION, enabled).apply();
    }

    /** Wallpaper liquid bergerak (efek 3D). */
    public boolean liquidMotion() {
        return prefs.getBoolean(KEY_LIQUID_MOTION, true);
    }

    public void setLiquidMotion(boolean enabled) {
        prefs.edit().putBoolean(KEY_LIQUID_MOTION, enabled).apply();
    }



    // ------------------------------------------------------------------ dock

    /** Daftar paket di dock; kosong berarti pengguna belum pernah mengaturnya. */
    public List<String> dock() {
        List<String> out = new ArrayList<String>();
        String raw = prefs.getString(KEY_DOCK, "");
        if (raw == null || raw.length() == 0) {
            return out;
        }
        String[] parts = raw.split("\n");
        for (int i = 0; i < parts.length; i++) {
            String name = parts[i].trim();
            if (name.length() > 0 && !out.contains(name)) {
                out.add(name);
            }
        }
        return out;
    }

    public boolean hasDock() {
        return prefs.contains(KEY_DOCK);
    }

    public void setDock(List<String> packages) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < packages.size() && i < MAX_DOCK; i++) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(packages.get(i));
        }
        prefs.edit().putString(KEY_DOCK, builder.toString()).apply();
    }

    /** @return false bila dock sudah penuh atau paket sudah ada di dalamnya. */
    public boolean addToDock(String packageName) {
        List<String> current = dock();
        if (current.size() >= MAX_DOCK || current.contains(packageName)) {
            return false;
        }
        current.add(packageName);
        setDock(current);
        return true;
    }

    public void removeFromDock(String packageName) {
        List<String> current = dock();
        if (current.remove(packageName)) {
            setDock(current);
        }
    }

    public void clearDock() {
        prefs.edit().remove(KEY_DOCK).apply();
    }

    // --------------------------------------------------------------- tersembunyi

    public Set<String> hidden() {
        Set<String> stored = prefs.getStringSet(KEY_HIDDEN, null);
        return stored == null ? new HashSet<String>() : new HashSet<String>(stored);
    }

    public boolean isHidden(String packageName) {
        return hidden().contains(packageName);
    }

    public void setHidden(String packageName, boolean hidden) {
        Set<String> current = hidden();
        if (hidden) {
            current.add(packageName);
        } else {
            current.remove(packageName);
        }
        setHidden(current);
    }

    public void setHidden(Set<String> packages) {
        prefs.edit().putStringSet(KEY_HIDDEN, new HashSet<String>(packages)).apply();
    }

    // ------------------------------------------------------------------ util

    private static int clamp(int value, int min, int max) {
        return value < min ? min : (value > max ? max : value);
    }
}
