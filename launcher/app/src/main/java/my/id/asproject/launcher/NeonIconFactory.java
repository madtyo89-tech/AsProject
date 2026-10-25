package my.id.asproject.launcher;

import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;

import java.util.Random;

/**
 * Membuat versi NEON dari ikon aplikasi apa pun, di dalam perangkat.
 *
 * Tidak ada gambar per aplikasi yang perlu disiapkan: bentuk ikon asli diubah
 * menjadi "peta cahaya" lalu digambar ulang sebagai garis neon di atas kaca
 * gelap, sehingga SEMUA aplikasi mendapat gaya yang sama.
 *
 * Cara kerja:
 *  1. Ikon digambar ke bitmap, lalu tiap piksel dihitung luminansinya.
 *  2. Selisih luminansi terhadap warna latar (cincin terluar ikon) dijadikan
 *     intensitas; ini mempertahankan bentuk/glyph dan membuang latar polos.
 *     Bila ikon berlatar terang dengan glyph gelap, polaritasnya dibalik.
 *  3. Hasilnya digambar beberapa kali dengan BlurMaskFilter (glow lebar →
 *     glow sempit → inti tajam) supaya tampak seperti lampu neon.
 *  4. Ditambah jejak sirkuit kecil yang deterministik per paket, plus bingkai
 *     kaca gelap bergaris neon.
 */
public final class NeonIconFactory {

    private static final int NEON = 0xFF7FD8FF;
    private static final int NEON_CORE = 0xFFE6F9FF;
    private static final int TRACE = 0x4DA8E6FF;
    private static final int TILE_TOP = 0xFF121821;
    private static final int TILE_BOTTOM = 0xFF070A0F;
    private static final int TILE_STROKE = 0x557FD8FF;

    private NeonIconFactory() {
    }

    /**
     * @param source ikon aplikasi asli
     * @param size   sisi ikon dalam piksel
     * @param seed   kunci stabil (mis. "paket/aktivitas") agar jejak sirkuit tidak
     *               berubah-ubah setiap kali digambar
     * @return bitmap ikon neon, atau null bila gagal (pemanggil memakai ikon asli)
     */
    public static Bitmap create(Drawable source, int size, String seed) {
        if (source == null || size <= 0) {
            return null;
        }
        try {
            Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);
            float radius = size * 0.24f;

            drawGlassTile(canvas, size, radius);
            drawCircuits(canvas, size, radius, seed);

            Bitmap glow = glyphGlow(source, size);
            if (glow != null) {
                drawNeon(canvas, glow, size, radius);
                glow.recycle();
            }
            return output;
        } catch (OutOfMemoryError error) {
            return null;
        } catch (RuntimeException error) {
            return null;
        }
    }

    // ------------------------------------------------------------------ lapisan

    private static void drawGlassTile(Canvas canvas, int size, float radius) {
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setShader(new LinearGradient(0, 0, size * 0.35f, size,
                TILE_TOP, TILE_BOTTOM, Shader.TileMode.CLAMP));
        RectF box = new RectF(0, 0, size, size);
        canvas.drawRoundRect(box, radius, radius, fill);

        // Kilau tipis di sisi atas — memberi kesan kaca.
        Paint sheen = new Paint(Paint.ANTI_ALIAS_FLAG);
        sheen.setShader(new LinearGradient(0, 0, 0, size * 0.55f,
                0x1FFFFFFF, 0x00FFFFFF, Shader.TileMode.CLAMP));
        Path top = new Path();
        top.addRoundRect(box, radius, radius, Path.Direction.CW);
        canvas.save();
        canvas.clipPath(top);
        canvas.drawRect(0, 0, size, size * 0.55f, sheen);
        canvas.restore();

        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(1f, size * 0.012f));
        stroke.setColor(TILE_STROKE);
        canvas.drawRoundRect(new RectF(size * 0.006f, size * 0.006f,
                size - size * 0.006f, size - size * 0.006f), radius, radius, stroke);
    }

    /** Jejak sirkuit halus; posisinya tetap untuk paket yang sama. */
    private static void drawCircuits(Canvas canvas, int size, float radius, String seed) {
        Random random = new Random(seed == null ? 0L : seed.hashCode() * 31L);
        Paint trace = new Paint(Paint.ANTI_ALIAS_FLAG);
        trace.setStyle(Paint.Style.STROKE);
        trace.setStrokeWidth(Math.max(1f, size * 0.01f));
        trace.setColor(TRACE);

        Path clip = new Path();
        clip.addRoundRect(new RectF(0, 0, size, size), radius, radius, Path.Direction.CW);
        canvas.save();
        canvas.clipPath(clip);

        int traces = 4;
        for (int i = 0; i < traces; i++) {
            float x = size * (0.08f + 0.84f * random.nextFloat());
            float y = size * (0.08f + 0.84f * random.nextFloat());
            Path path = new Path();
            path.moveTo(x, y);
            int segments = 2 + random.nextInt(2);
            for (int s = 0; s < segments; s++) {
                boolean horizontal = random.nextBoolean();
                float length = size * (0.06f + 0.14f * random.nextFloat()) * (random.nextBoolean() ? 1 : -1);
                if (horizontal) {
                    x += length;
                } else {
                    y += length;
                }
                path.lineTo(x, y);
            }
            canvas.drawPath(path, trace);
            Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
            dot.setColor(TRACE);
            canvas.drawCircle(x, y, Math.max(1.2f, size * 0.014f), dot);
        }
        canvas.restore();
    }

    private static void drawNeon(Canvas canvas, Bitmap glow, int size, float radius) {
        // Cahaya dibatasi bentuk kaca: tanpa ini, glow membuat sudut ikon terlihat
        // kotak terang dan merusak kesan tombol kaca.
        Path tile = new Path();
        tile.addRoundRect(new RectF(0, 0, size, size), radius, radius, Path.Direction.CW);
        canvas.save();
        canvas.clipPath(tile);

        // 1. Lingkaran cahaya lebar
        Paint wide = new Paint(Paint.ANTI_ALIAS_FLAG);
        wide.setColor(NEON);
        wide.setAlpha(150);
        wide.setMaskFilter(new BlurMaskFilter(size * 0.11f, BlurMaskFilter.Blur.NORMAL));
        canvas.drawBitmap(glow, 0, 0, wide);

        // 2. Cahaya menengah
        Paint mid = new Paint(Paint.ANTI_ALIAS_FLAG);
        mid.setColor(NEON);
        mid.setAlpha(215);
        mid.setMaskFilter(new BlurMaskFilter(size * 0.05f, BlurMaskFilter.Blur.NORMAL));
        canvas.drawBitmap(glow, 0, 0, mid);

        // 3. Inti terang (garis neon sesungguhnya)
        Paint core = new Paint(Paint.ANTI_ALIAS_FLAG);
        core.setColor(NEON_CORE);
        if (size >= 96) {
            core.setMaskFilter(new BlurMaskFilter(size * 0.012f, BlurMaskFilter.Blur.NORMAL));
        }
        canvas.drawBitmap(glow, 0, 0, core);
        canvas.restore();
    }

    // ------------------------------------------------------------------ masker

    /**
     * Peta intensitas: bagian ikon yang berbeda dari warna latarnya menjadi putih,
     * latar polos menjadi transparan. Hasilnya bitmap putih dengan alpha.
     */
    private static Bitmap glyphGlow(Drawable source, int size) {
        Bitmap icon = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas iconCanvas = new Canvas(icon);
        source.setBounds(0, 0, size, size);
        source.draw(iconCanvas);

        int[] pixels = new int[size * size];
        icon.getPixels(pixels, 0, size, 0, 0, size, size);
        icon.recycle();

        float[] luminance = new float[pixels.length];
        for (int i = 0; i < pixels.length; i++) {
            int color = pixels[i];
            int alpha = (color >>> 24) & 0xFF;
            int red = (color >> 16) & 0xFF;
            int green = (color >> 8) & 0xFF;
            int blue = color & 0xFF;
            // Luminans persepsi (Rec. 601) — stabil untuk ikon berwarna apa pun.
            luminance[i] = (0.299f * red + 0.587f * green + 0.114f * blue) * (alpha / 255f);
            pixels[i] = alpha;
        }

        float border = borderLuminance(luminance, size);
        float center = centerLuminance(luminance, size);
        float polarity = center + 6f < border ? -1f : 1f;

        float peak = 0f;
        for (int i = 0; i < luminance.length; i++) {
            float delta = (luminance[i] - border) * polarity;
            if (delta > peak) {
                peak = delta;
            }
        }

        int[] out = new int[pixels.length];
        if (peak < 5f) {
            // Ikon rata / monokrom: pakai kanal alpha saja sebagai bentuk.
            for (int i = 0; i < pixels.length; i++) {
                int alpha = (int) (pixels[i] * 0.85f);
                out[i] = alpha << 24 | 0x00FFFFFF;
            }
        } else {
            float low = peak * 0.20f;
            float high = peak * 0.92f;
            // Ikon "blok warna penuh" (WhatsApp/Chrome/Instagram) akan menjadi blob
            // bila seluruh bidang ikut menyala. Untuk ikon seperti itu ambang
            // dinaikkan supaya hanya garis tepi & detail yang digambar — hasilnya
            // gaya outline neon, bukan bidang putih.
            int covered = 0;
            for (int i = 0; i < luminance.length; i++) {
                if ((luminance[i] - border) * polarity > low) {
                    covered++;
                }
            }
            if (covered > luminance.length * 0.5f) {
                low = peak * 0.45f;
                high = peak * 0.97f;
            }
            float span = Math.max(1f, high - low);
            for (int i = 0; i < luminance.length; i++) {
                float delta = (luminance[i] - border) * polarity;
                float t = (delta - low) / span;
                t = t < 0f ? 0f : (t > 1f ? 1f : t);
                t = t * t * (3f - 2f * t);          // halus (smoothstep)
                int alpha = (int) (t * 255f);
                out[i] = alpha << 24 | 0x00FFFFFF;
            }
        }

        Bitmap mask = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        mask.setPixels(out, 0, size, 0, 0, size, size);
        return mask;
    }

    /** Rata-rata luminans 12% area terluar (dipakai sebagai "warna latar" ikon). */
    private static float borderLuminance(float[] luminance, int size) {
        int band = Math.max(2, Math.round(size * 0.12f));
        float sum = 0f;
        int count = 0;
        for (int y = 0; y < size; y++) {
            boolean edgeRow = y < band || y >= size - band;
            for (int x = 0; x < size; x++) {
                if (edgeRow || x < band || x >= size - band) {
                    sum += luminance[y * size + x];
                    count++;
                }
            }
        }
        return count == 0 ? 0f : sum / count;
    }

    private static float centerLuminance(float[] luminance, int size) {
        int from = Math.round(size * 0.3f);
        int to = Math.round(size * 0.7f);
        float sum = 0f;
        int count = 0;
        for (int y = from; y < to; y++) {
            for (int x = from; x < to; x++) {
                sum += luminance[y * size + x];
                count++;
            }
        }
        return count == 0 ? 0f : sum / count;
    }
}
