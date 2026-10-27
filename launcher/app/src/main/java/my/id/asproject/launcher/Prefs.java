package my.id.asproject.launcher;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    private static final String KEY_SLIDE_BAR_STYLE = "slide_bar_style";
    private static final String KEY_ACCENT_STYLE = "accent_style";
    private static final String KEY_FOLDERS = "folders";
    private static final String KEY_ICON_STYLE = "icon_style_";
    private static final String KEY_WIDGET_IDS = "widget_ids";
    private static final String KEY_SPEEDOMETER_ENABLED = "speedometer_enabled";
    private static final String KEY_SPEED_UNIT = "speed_unit";
    private static final String KEY_SPEED_POS_X = "speed_pos_x";
    private static final String KEY_SPEED_POS_Y = "speed_pos_y";
    private static final String KEY_SAFE_MODE_MIGRATED_V1 = "safe_mode_migrated_v1";
    private static final String KEY_DIAGNOSTIC_STAGE_APPLIED = "diagnostic_stage_applied";

    /**
     * Tahap isolasi ANR saat ini (lihat {@link #applyDiagnosticStageOnce()}).
     * NAIKKAN SATU ANGKA tiap kali satu fitur baru mau dites kembali
     * dinyalakan, setelah build sebelumnya terbukti LANCAR di HP uji.
     * Kalau build di suatu tahap ternyata MACET, fitur yang baru ditambah
     * di tahap itulah biang keroknya -- berhenti di situ, jangan dinaikkan
     * lagi sebelum itu diperbaiki/dirombak.
     *
     * 0 = (tidak dipakai lagi setelah diagnosis selesai)
     * 1 = kerangka LauncherActivity TANPA fitur berat apa pun: wallpaper,
     *     layar kunci, ikon neon, animasi HUD/liquid semua mati paksa.
     *     Tujuannya: tes apakah kerangka dasarnya sendiri (findViewById,
     *     AppDrawerView, GestureDetector, AppWidgetHost init, dll) aman.
     */
    private static final int DIAGNOSTIC_STAGE = 1;

    public static final int MIN_COLUMNS = 3;
    public static final int MAX_COLUMNS = 6;
    public static final int DEFAULT_COLUMNS = 4;
    public static final int MAX_DOCK = 5;

    private final SharedPreferences prefs;
    private final Context appContext;

    public Prefs(Context context) {
        this.appContext = context.getApplicationContext();
        this.prefs = appContext.getSharedPreferences(FILE, Context.MODE_PRIVATE);
        forceSafeModeOnceIfLowEnd();
        applyDiagnosticStageOnce();
    }

    /**
     * Isolasi ANR bertahap: kembali ke {@link LauncherActivity} (kerangka
     * lengkap) sebagai beranda, tapi fitur beratnya dinyalakan SATU PER SATU
     * lewat {@link #DIAGNOSTIC_STAGE} supaya ketahuan persis fitur mana yang
     * bikin macet -- bukan cuma "macet lagi" tanpa tau sebabnya. Dipaksa
     * SEKALI per kenaikan angka tahap (ditandai lewat
     * {@code diagnostic_stage_applied}), supaya kalau pengguna sempat
     * mengubah sakelar manual di Pengaturan selama tahap berjalan, itu
     * tidak langsung ketiban force lagi di peluncuran berikutnya.
     */
    private void applyDiagnosticStageOnce() {
        int applied = prefs.getInt(KEY_DIAGNOSTIC_STAGE_APPLIED, 0);
        if (applied >= DIAGNOSTIC_STAGE) {
            return;
        }
        SharedPreferences.Editor editor = prefs.edit();
        if (DIAGNOSTIC_STAGE >= 1) {
            // Tahap 1: cuma kerangka dasar LauncherActivity -- semua fitur
            // berat dipaksa MATI (liquid motion & HUD sudah dipaksa mati
            // lewat forceSafeModeOnceIfLowEnd() di atas; di sini tambahan
            // wallpaper kustom, layar kunci, dan ikon neon).
            editor.putBoolean(KEY_FIGURE_WALLPAPER, false);
            editor.putBoolean(KEY_LOCK_SCREEN, false);
            editor.putBoolean(KEY_NEON_ICONS, false);
        }
        editor.putInt(KEY_DIAGNOSTIC_STAGE_APPLIED, DIAGNOSTIC_STAGE);
        editor.commit();
    }

    /**
     * PENTING: {@link #hudAnimation()}/{@link #liquidMotion()} hanya memakai
     * {@code isLikelyLowEndDevice()} sebagai nilai BAWAAN -- yaitu nilai yang
     * dipakai HANYA kalau key-nya belum pernah tersimpan sama sekali. Masalahnya:
     * APK ini terus dipasang sebagai "pembaruan" di atas versi sebelumnya
     * (bukan uninstall bersih), jadi SharedPreferences (termasuk
     * {@code hud_animation}/{@code liquid_motion}) ikut terbawa dari
     * pemasangan PERTAMA KALI -- yaitu sebelum pengaman "perangkat kelas
     * bawah" ini ada, waktu nilainya masih implisit "menyala". Akibatnya,
     * perbaikan "nonaktifkan animasi berat di perangkat kelas bawah" bisa
     * TIDAK PERNAH benar-benar berlaku walau kodenya sudah berubah, karena
     * key lama yang sudah tersimpan selalu menang atas nilai bawaan baru.
     *
     * Migrasi SEKALI JALAN ini memaksa animasi berat MATI kalau perangkat
     * terdeteksi kelas bawah, APA PUN nilai yang sudah tersimpan sebelumnya
     * -- lalu menandai migrasi ini sudah dijalankan supaya tidak mengulang
     * terus-menerus dan tidak mengunci pengguna: dari Pengaturan, sakelarnya
     * tetap bisa dinyalakan lagi kapan saja seperti biasa.
     */
    private void forceSafeModeOnceIfLowEnd() {
        if (prefs.getBoolean(KEY_SAFE_MODE_MIGRATED_V1, false)) {
            return;
        }
        if (isLikelyLowEndDevice()) {
            prefs.edit()
                    .putBoolean(KEY_HUD_ANIMATION, false)
                    .putBoolean(KEY_LIQUID_MOTION, false)
                    .putBoolean(KEY_SAFE_MODE_MIGRATED_V1, true)
                    .commit();
        } else {
            prefs.edit().putBoolean(KEY_SAFE_MODE_MIGRATED_V1, true).commit();
        }
    }

    /**
     * Perkiraan kasar "HP kelas bawah/lama": dipakai sebagai nilai BAWAAN
     * untuk animasi berat (liquid motion & HUD) yang jalan terus-menerus di
     * thread utama. Hanya memengaruhi pemasangan baru yang belum pernah
     * mengubah sakelarnya sendiri — pengguna tetap bebas menyalakannya lewat
     * Pengaturan kalau perangkatnya ternyata lancar.
     *
     * Dasarnya: dilaporkan macet (ANR) nyata di Vivo Y50 (Snapdragon 665,
     * Android 10/11) saat animasi ini menyala terus sejak awal — perangkat
     * kelas menengah-bawah rilis lama lebih berisiko kesulitan merender
     * Canvas prosedural terus-menerus di thread utama.
     */
    private boolean isLikelyLowEndDevice() {
        try {
            android.app.ActivityManager manager = (android.app.ActivityManager)
                    appContext.getSystemService(Context.ACTIVITY_SERVICE);
            if (manager != null && manager.isLowRamDevice()) {
                return true;
            }
        } catch (RuntimeException ignored) {
            // abaikan; lanjut ke perkiraan berikutnya
        }
        // HP yang masih di Android 11 (API 30) ke bawah kebanyakan rilis
        // 2019–2021 kelas menengah-bawah (mis. Snapdragon 6xx).
        return Build.VERSION.SDK_INT <= Build.VERSION_CODES.R;
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
        return prefs.getBoolean(KEY_HUD_ANIMATION, !isLikelyLowEndDevice());
    }

    public void setHudAnimation(boolean enabled) {
        prefs.edit().putBoolean(KEY_HUD_ANIMATION, enabled).apply();
    }

    /** Wallpaper liquid bergerak (efek 3D). */
    public boolean liquidMotion() {
        return prefs.getBoolean(KEY_LIQUID_MOTION, !isLikelyLowEndDevice());
    }

    public void setLiquidMotion(boolean enabled) {
        prefs.edit().putBoolean(KEY_LIQUID_MOTION, enabled).apply();
    }

    /**
     * Gaya liquid slide bar (gagang laci): {@code "ombak"} (bawaan),
     * {@code "pil"}, {@code "titik"}, atau {@code "sirkuit"}.
     */
    public String slideBarStyle() {
        return prefs.getString(KEY_SLIDE_BAR_STYLE, "ombak");
    }

    public void setSlideBarStyle(String style) {
        prefs.edit().putString(KEY_SLIDE_BAR_STYLE, style == null ? "ombak" : style).apply();
    }

    /**
     * Warna aksen neon global: {@code "biru"} (bawaan), {@code "hijau"},
     * {@code "ungu"}, atau {@code "pink"}. Berlaku di ikon, HUD, baterai,
     * jam, wallpaper sirkuit, dan slide bar sekaligus.
     */
    public String accentStyle() {
        return prefs.getString(KEY_ACCENT_STYLE, "biru");
    }

    public void setAccentStyle(String style) {
        prefs.edit().putString(KEY_ACCENT_STYLE, style == null ? "biru" : style).apply();
    }


    // ------------------------------------------------------------ spidometer

    /**
     * Spidometer digital mengambang (bubble di atas aplikasi lain). Nonaktif
     * secara bawaan — satu-satunya fitur di launcher ini yang perlu izin
     * Lokasi, "Gambar di atas aplikasi lain", dan notifikasi tetap tampil.
     */
    public boolean speedometerEnabled() {
        return prefs.getBoolean(KEY_SPEEDOMETER_ENABLED, false);
    }

    public void setSpeedometerEnabled(boolean enabled) {
        prefs.edit().putBoolean(KEY_SPEEDOMETER_ENABLED, enabled).apply();
    }

    /** Satuan kecepatan: {@code "kmh"} (bawaan) atau {@code "mph"}. */
    public String speedUnit() {
        return prefs.getString(KEY_SPEED_UNIT, "kmh");
    }

    public void setSpeedUnit(String unit) {
        prefs.edit().putString(KEY_SPEED_UNIT, "mph".equals(unit) ? "mph" : "kmh").apply();
    }

    /** Posisi terakhir bubble spidometer di layar (px), supaya tidak loncat tiap dibuka. */
    public int[] speedometerPosition() {
        return new int[]{prefs.getInt(KEY_SPEED_POS_X, 24), prefs.getInt(KEY_SPEED_POS_Y, 220)};
    }

    public void setSpeedometerPosition(int x, int y) {
        prefs.edit().putInt(KEY_SPEED_POS_X, x).putInt(KEY_SPEED_POS_Y, y).apply();
    }

    // ---------------------------------------------------------------- folder

    /**
     * Daftar folder beranda: nama → kunci aplikasi anggotanya.
     * Disimpan satu baris per folder: {@code nama<TAB>kunci1,kunci2}.
     */
    public LinkedHashMap<String, List<String>> folders() {
        LinkedHashMap<String, List<String>> folders = new LinkedHashMap<String, List<String>>();
        String raw = prefs.getString(KEY_FOLDERS, "");
        if (raw == null || raw.length() == 0) {
            return folders;
        }
        String[] lines = raw.split("\n");
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].length() == 0) {
                continue;
            }
            String[] parts = lines[i].split("\t", -1);
            if (parts.length < 2 || parts[0].length() == 0) {
                continue;
            }
            List<String> members = new ArrayList<String>();
            String[] keys = parts[1].split(",");
            for (int k = 0; k < keys.length; k++) {
                String name = keys[k].trim();
                if (name.length() > 0 && !members.contains(name)) {
                    members.add(name);
                }
            }
            folders.put(parts[0], members);
        }
        return folders;
    }

    /** Simpan seluruh peta folder (menggantikan isi sebelumnya). */
    public void saveFolders(LinkedHashMap<String, List<String>> folders) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, List<String>> entry : folders.entrySet()) {
            if (entry.getKey().length() == 0 || entry.getValue().isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(entry.getKey()).append('\t');
            for (int i = 0; i < entry.getValue().size(); i++) {
                if (i > 0) {
                    builder.append(',');
                }
                builder.append(entry.getValue().get(i));
            }
        }
        prefs.edit().putString(KEY_FOLDERS, builder.toString()).apply();
    }

    // --------------------------------------------------------------- ikon

    /** Gaya ikon per aplikasi: "auto", "asli", "cincin", "hexa", atau "sudut". */
    public String iconStyle(String key) {
        return prefs.getString(KEY_ICON_STYLE + key, "auto");
    }

    public void setIconStyle(String key, String style) {
        if (style == null || style.equals("auto")) {
            prefs.edit().remove(KEY_ICON_STYLE + key).apply();
        } else {
            prefs.edit().putString(KEY_ICON_STYLE + key, style).apply();
        }
    }

    // ----------------------------------------------------------------- widget

    /** ID widget sistem yang sedang ditempel di beranda, berurutan sesuai tampilan. */
    public List<Integer> widgetIds() {
        List<Integer> ids = new ArrayList<Integer>();
        String raw = prefs.getString(KEY_WIDGET_IDS, "");
        if (raw == null || raw.length() == 0) {
            return ids;
        }
        for (String part : raw.split(",")) {
            try {
                if (part.trim().length() > 0) {
                    ids.add(Integer.parseInt(part.trim()));
                }
            } catch (NumberFormatException ignored) {
                // abaikan entri rusak
            }
        }
        return ids;
    }

    public void addWidgetId(int id) {
        List<Integer> ids = widgetIds();
        if (!ids.contains(id)) {
            ids.add(id);
            saveWidgetIds(ids);
        }
    }

    public void removeWidgetId(int id) {
        List<Integer> ids = widgetIds();
        if (ids.remove(Integer.valueOf(id))) {
            saveWidgetIds(ids);
        }
    }

    private void saveWidgetIds(List<Integer> ids) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append(ids.get(i));
        }
        prefs.edit().putString(KEY_WIDGET_IDS, builder.toString()).apply();
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
