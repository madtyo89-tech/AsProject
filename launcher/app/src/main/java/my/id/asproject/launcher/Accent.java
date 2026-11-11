package my.id.asproject.launcher;

import android.graphics.Color;

/**
 * **Warna aksen neon global.** Semua warna "neon" di kode (ikon, HUD, baterai,
 * jam, wallpaper sirkuit, slide bar) ditulis dalam keluarga cyan dasar
 * (hue ≈ 195°). {@link #shift(int)} memutar hue warna itu ke aksen pilihan
 * pengguna, sambil mempertahankan saturasi/nilai/alpha aslinya — sehingga
 * seluruh hierarki terang/gelap & transparansi yang sudah dirancang tetap
 * terjaga, hanya "warnanya" yang berganti.
 *
 * Latar gelap (saturasi/nilai sangat rendah) otomatis nyaris tak berubah
 * karena hue tak berarti pada warna abu-abu/hitam — tidak perlu daftar
 * pengecualian manual.
 */
public final class Accent {

    /** Hue dasar yang dipakai semua konstanta warna neon di kode saat ini. */
    private static final float BASE_HUE = 195f;

    private static volatile float hueShift = 0f;
    private static volatile String current = "biru";

    private Accent() {
    }

    /** Terapkan aksen sesuai Prefs ("biru", "hijau", "ungu", atau "pink"). */
    public static void configure(String style) {
        current = style == null ? "biru" : style;
        hueShift = hueFor(current) - BASE_HUE;
    }

    public static String current() {
        return current;
    }

    private static float hueFor(String style) {
        if ("hijau".equals(style)) {
            return 140f;
        }
        if ("ungu".equals(style)) {
            return 275f;
        }
        if ("pink".equals(style)) {
            return 328f;
        }
        return BASE_HUE; // "biru" — bawaan, sama persis seperti sebelumnya.
    }

    /** Putar warna ARGB sejauh pergeseran hue aktif; alpha tetap, S/V tetap. */
    public static int shift(int argb) {
        if (hueShift == 0f) {
            return argb;
        }
        int alpha = (argb >>> 24) & 0xFF;
        float[] hsv = new float[3];
        Color.colorToHSV(argb | 0xFF000000, hsv);
        hsv[0] = (hsv[0] + hueShift + 360f) % 360f;
        return (alpha << 24) | (Color.HSVToColor(hsv) & 0x00FFFFFF);
    }
}
