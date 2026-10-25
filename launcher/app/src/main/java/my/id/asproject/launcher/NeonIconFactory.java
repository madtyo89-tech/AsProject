package my.id.asproject.launcher;

import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;

import java.util.Random;

/**
 * Pembuat ikon bergaya "liquid glass sirkuit" untuk SEMUA aplikasi.
 *
 * Anatomi ikon (meniru paket ikon referensi):
 *  1. <b>Kaca gelap</b> — tile membulat dengan gradien hampir hitam.
 *  2. <b>Liquid chrome</b> — sapuan pantulan diagonal + sorotan tepi atas
 *     (rim light) sehingga permukaan terlihat seperti kaca/cairan, bukan warna datar.
 *  3. <b>Glyph sirkuit</b> — bentuk asli ikon diubah menjadi garis luar (outline)
 *     lalu digambar sebagai neon: glow lebar → glow sempit → inti terang.
 *  4. <b>Jejak sirkuit</b> — garis siku + titik sambung (pad) di sekitar glyph,
 *     posisinya tetap untuk paket yang sama sehingga tidak "berkedip" antar sesi.
 *
 * Semua dikerjakan di atas Canvas biasa: tidak butuh OpenGL maupun pustaka luar.
 */
public final class NeonIconFactory {

    // Palet neon sirkuit: cyan listrik dengan inti hampir putih.
    private static final int NEON = 0xFF5FCFFF;
    private static final int NEON_CORE = 0xFFEAFBFF;
    private static final int TRACE = 0x66A9E8FF;
    private static final int PAD = 0xCCBFEFFF;

    // Kaca
    private static final int GLASS_TOP = 0xFF101820;
    private static final int GLASS_BOTTOM = 0xFF04070B;
    private static final int RIM = 0x8FB9ECFF;

    private NeonIconFactory() {
    }

    /**
     * @param source ikon aplikasi asli
     * @param size   sisi ikon dalam piksel (mis. 52 dp dalam px)
     * @param seed   kunci stabil — biasanya "paket/aktivitas"
     * @return bitmap ikon, atau null bila gagal (pemanggil memakai ikon asli)
     */
    public static Bitmap create(Drawable source, int size, String seed) {
        if (source == null || size <= 0) {
            return null;
        }
        try {
            Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);
            float radius = size * 0.235f;

            drawLiquidGlass(canvas, size, radius);
            drawCircuits(canvas, size, radius, seed);

            float[] glyph = glyphMask(source, size);
            if (glyph != null) {
                float[] outline = outlineOf(glyph, size);
                drawGlyphCircuits(canvas, glyph, size, radius, seed);
                drawNeon(canvas, outline, size, radius);
            }
            return output;
        } catch (OutOfMemoryError error) {
            return null;
        } catch (RuntimeException error) {
            return null;
        }
    }

    // --------------------------------------------------------------- kaca cair

    private static void drawLiquidGlass(Canvas canvas, int size, float radius) {
        RectF box = new RectF(0, 0, size, size);
        Path clip = new Path();
        clip.addRoundRect(box, radius, radius, Path.Direction.CW);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(size * 0.15f, 0, size * 0.55f, size,
                GLASS_TOP, GLASS_BOTTOM, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(box, radius, radius, paint);

        canvas.save();
        canvas.clipPath(clip);

        // 1. Pantulan cair: pita diagonal terang melintasi kiri-atas.
        Paint sweep = new Paint(Paint.ANTI_ALIAS_FLAG);
        sweep.setShader(new LinearGradient(0, 0, size, size,
                new int[]{0x33BFE9FF, 0x0F8FD4FF, 0x00000000},
                new float[]{0f, 0.42f, 0.85f}, Shader.TileMode.CLAMP));
        canvas.drawRect(box, sweep);

        // 2. Sorotan atas yang lembut — bagian "membusung" kaca.
        Paint sheen = new Paint(Paint.ANTI_ALIAS_FLAG);
        sheen.setShader(new RadialGradient(size * 0.5f, -size * 0.12f, size * 0.85f,
                new int[]{0x40E8FBFF, 0x00000000}, new float[]{0f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(box, sheen);

        // 3. Kilau bawah-kanan tipis (cermin ganda seperti krom cair).
        Paint under = new Paint(Paint.ANTI_ALIAS_FLAG);
        under.setShader(new RadialGradient(size * 0.92f, size * 1.02f, size * 0.6f,
                new int[]{0x2258B4E8, 0x00000000}, new float[]{0f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(box, under);
        canvas.restore();

        // 4. Tepi kaca: garis terang dengan intensitas berbeda (atas lebih terang).
        Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
        rim.setStyle(Paint.Style.STROKE);
        rim.setStrokeWidth(Math.max(1f, size * 0.014f));
        rim.setShader(new LinearGradient(0, 0, 0, size,
                RIM, 0x336FA8C0, Shader.TileMode.CLAMP));
        float inset = rim.getStrokeWidth() / 2f;
        canvas.drawRoundRect(new RectF(inset, inset, size - inset, size - inset),
                radius - inset, radius - inset, rim);
    }

    /** Jejak sirkuit + pad; posisi diturunkan dari nama paket (deterministik). */
    private static void drawCircuits(Canvas canvas, int size, float radius, String seed) {
        Random random = new Random(seed == null ? 7L : seed.hashCode() * 31L);

        Paint trace = new Paint(Paint.ANTI_ALIAS_FLAG);
        trace.setStyle(Paint.Style.STROKE);
        trace.setStrokeCap(Paint.Cap.ROUND);
        trace.setStrokeWidth(Math.max(1f, size * 0.011f));
        trace.setColor(TRACE);

        Paint pad = new Paint(Paint.ANTI_ALIAS_FLAG);
        pad.setColor(PAD);

        Path clip = new Path();
        clip.addRoundRect(new RectF(0, 0, size, size), radius, radius, Path.Direction.CW);
        canvas.save();
        canvas.clipPath(clip);

        int traces = 3;
        for (int i = 0; i < traces; i++) {
            // Jejak dimulai dari tepi luar menjorok ke dalam, seperti PCB.
            boolean horizontal = random.nextBoolean();
            float start = size * (0.06f + 0.88f * random.nextFloat());
            float lane = size * (0.10f + 0.80f * random.nextFloat());
            float len = size * (0.10f + 0.16f * random.nextFloat())
                    * (random.nextBoolean() ? 1f : -1f);
            Path path = new Path();
            float x;
            float y;
            if (horizontal) {
                y = lane;
                x = start < size * 0.5f ? size * 0.04f : size * 0.96f;
                path.moveTo(x, y);
                path.lineTo(x + len, y);
                x += len;
                float drop = size * 0.10f * (random.nextBoolean() ? 1f : -1f);
                path.lineTo(x, y + drop);
                y += drop;
            } else {
                x = lane;
                y = start < size * 0.5f ? size * 0.04f : size * 0.96f;
                path.moveTo(x, y);
                path.lineTo(x, y + len);
                y += len;
                float shift = size * 0.10f * (random.nextBoolean() ? 1f : -1f);
                path.lineTo(x + shift, y);
                x += shift;
            }
            canvas.drawPath(path, trace);
            canvas.drawCircle(x, y, Math.max(1.1f, size * 0.013f), pad);
        }
        canvas.restore();
    }

    /**
     * Jejak sirkuit tipis di DALAM bentuk ikon — potong memakai siluet glyph,
     * sehingga motifnya mengikuti bentuk aplikasi, bukan sekadar latar.
     */
    private static void drawGlyphCircuits(Canvas canvas, float[] mask, int size, float radius,
                                          String seed) {
        Bitmap solid = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        int[] pixels = new int[mask.length];
        boolean any = false;
        for (int i = 0; i < mask.length; i++) {
            if (mask[i] > 0.43f) {
                pixels[i] = 0xFFFFFFFF;
                any = true;
            } else {
                pixels[i] = 0;
            }
        }
        if (!any) {
            solid.recycle();
            return;
        }
        solid.setPixels(pixels, 0, size, 0, 0, size, size);

        Random random = new Random((seed == null ? 5L : seed.hashCode()) ^ 0x5FD8FFL);
        Bitmap traces = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas traceCanvas = new Canvas(traces);

        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeCap(Paint.Cap.ROUND);
        line.setStrokeJoin(Paint.Join.ROUND);
        line.setStrokeWidth(Math.max(1f, size * 0.006f));
        line.setColor(0x66A0E1FF);

        Paint pad = new Paint(Paint.ANTI_ALIAS_FLAG);
        pad.setColor(0x99C8F0FF);

        for (int i = 0; i < 4; i++) {
            boolean horizontal = random.nextBoolean();
            float lane = size * (0.18f + 0.64f * random.nextFloat());
            float span = size * (0.22f + 0.30f * random.nextFloat());
            float center = size * (0.30f + 0.40f * random.nextFloat());
            Path path = new Path();
            float x;
            float y;
            if (horizontal) {
                path.moveTo(center - span, lane);
                path.lineTo(center, lane);
                path.lineTo(center, lane + span * 0.55f);
                x = center;
                y = lane + span * 0.55f;
            } else {
                path.moveTo(lane, center - span);
                path.lineTo(lane, center);
                path.lineTo(lane + span * 0.55f, center);
                x = lane + span * 0.55f;
                y = center;
            }
            traceCanvas.drawPath(path, line);
            traceCanvas.drawCircle(x, y, Math.max(1f, size * 0.009f), pad);
        }

        Paint cut = new Paint(Paint.ANTI_ALIAS_FLAG);
        cut.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_IN));
        traceCanvas.drawBitmap(solid, 0, 0, cut);

        Path tile = new Path();
        tile.addRoundRect(new RectF(0, 0, size, size), radius, radius, Path.Direction.CW);
        canvas.save();
        canvas.clipPath(tile);
        canvas.drawBitmap(traces, 0, 0, null);
        canvas.restore();

        traces.recycle();
        solid.recycle();
    }

    // ----------------------------------------------------------------- neon

    private static void drawNeon(Canvas canvas, float[] mask, int size, float radius) {
        Bitmap glow = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        int[] pixels = new int[mask.length];
        for (int i = 0; i < mask.length; i++) {
            int alpha = (int) (Math.min(1f, mask[i]) * 255f);
            pixels[i] = alpha << 24 | 0x00FFFFFF;
        }
        glow.setPixels(pixels, 0, size, 0, 0, size, size);

        Path tile = new Path();
        tile.addRoundRect(new RectF(0, 0, size, size), radius, radius, Path.Direction.CW);
        canvas.save();
        canvas.clipPath(tile);

        Paint wide = new Paint(Paint.ANTI_ALIAS_FLAG);
        wide.setColor(NEON);
        wide.setAlpha(102);
        wide.setMaskFilter(new BlurMaskFilter(size * 0.055f, BlurMaskFilter.Blur.NORMAL));
        canvas.drawBitmap(glow, 0, 0, wide);

        Paint mid = new Paint(Paint.ANTI_ALIAS_FLAG);
        mid.setColor(NEON);
        mid.setAlpha(199);
        mid.setMaskFilter(new BlurMaskFilter(size * 0.022f, BlurMaskFilter.Blur.NORMAL));
        canvas.drawBitmap(glow, 0, 0, mid);

        Paint core = new Paint(Paint.ANTI_ALIAS_FLAG);
        core.setColor(NEON_CORE);
        if (size >= 96) {
            core.setMaskFilter(new BlurMaskFilter(size * 0.007f, BlurMaskFilter.Blur.NORMAL));
        }
        // Dua kali: inti lampu neon harus benar-benar terang agar terbaca di 48 dp.
        canvas.drawBitmap(glow, 0, 0, core);
        canvas.drawBitmap(glow, 0, 0, core);
        canvas.restore();
        glow.recycle();
    }

    // ------------------------------------------------------------- masker

    /**
     * Peta intensitas glyph.
     *
     * Cara kerja (kunci agar ikon "bidang warna penuh" tidak berubah menjadi
     * cincin blob):
     *  1. Hitung <b>median</b> terang seluruh tile — itu warna latar ikon.
     *  2. Selisih mutlak tiap piksel terhadap median = seberapa jauh piksel itu
     *     "menonjol" dari latar. Jadi glyph yang lebih GELAP pun ikut terdeteksi.
     *  3. Tepi luar (7%) dibuang: potongan ikon kerap menyisakan latar tangkapan
     *     layar di sekelilingnya, dan itu menghasilkan cincin palsu.
     *  4. Ambang adaptif: hanya 30% piksel yang paling menonjol yang dipakai,
     *     lalu dilembutkan. Hasilnya: bentuk aplikasi, bukan kotak penuh.
     */
    private static float[] glyphMask(Drawable source, int size) {
        Bitmap icon = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas iconCanvas = new Canvas(icon);
        source.setBounds(0, 0, size, size);
        source.draw(iconCanvas);

        int[] pixels = new int[size * size];
        icon.getPixels(pixels, 0, size, 0, 0, size, size);
        icon.recycle();

        float[] luminance = new float[pixels.length];
        float[] alpha = new float[pixels.length];
        int[] levelHistogram = new int[256];
        for (int i = 0; i < pixels.length; i++) {
            int color = pixels[i];
            int a = (color >>> 24) & 0xFF;
            alpha[i] = a / 255f;
            float value = (0.299f * ((color >> 16) & 0xFF)
                    + 0.587f * ((color >> 8) & 0xFF)
                    + 0.114f * (color & 0xFF)) * alpha[i];
            luminance[i] = value;
            int bin = (int) value;
            if (bin > 255) {
                bin = 255;
            }
            levelHistogram[bin]++;
        }
        float background = histogramValue(levelHistogram, pixels.length, 0.5f, 255f);

        int band = Math.round(size * 0.07f);
        float[] delta = new float[pixels.length];
        float peak = 0f;
        int active = 0;
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                int i = y * size + x;
                boolean ring = y < band || y >= size - band || x < band || x >= size - band;
                if (ring) {
                    continue;
                }
                float d = Math.abs(luminance[i] - background);
                delta[i] = d;
                if (d > peak) {
                    peak = d;
                }
                active++;
            }
        }

        if (peak < 5f || active == 0) {
            // Ikon rata / hanya alpha: bentuk = alpha itu sendiri.
            return alpha;
        }

        // Ambang berdasar fraksi puncak (BUKAN persentil): glyph yang warnanya
        // rata — misal huruf putih di atas tile warna — punya nilai delta yang
        // seragam, dan ambang persentil justru menghapus seluruh isinya.
        float low = peak * 0.18f;
        float high = peak * 0.92f;
        int above = 0;
        for (int i = 0; i < delta.length; i++) {
            if (delta[i] > low) {
                above++;
            }
        }
        // Ikon bidang-warna-penuh: naikkan ambang agar tidak jadi blob/cincin.
        if (above > active * 0.5f) {
            low = peak * 0.45f;
            high = peak * 0.97f;
        }

        float[] out = new float[delta.length];
        float span = Math.max(1f, high - low);
        for (int i = 0; i < delta.length; i++) {
            float t = (delta[i] - low) / span;
            t = t < 0f ? 0f : (t > 1f ? 1f : t);
            out[i] = t * t * (3f - 2f * t);
        }
        return out;
    }

    /**
     * Nilai pada frasi ke-{@code fraction} dari sebuah histogram.
     * Histogram dipetakan ke 0..{@code max} dalam 256 tangga.
     */
    private static float histogramValue(int[] histogram, int total, float fraction, float max) {
        if (total <= 0) {
            return 0f;
        }
        long target = Math.round(total * fraction);
        long seen = 0;
        for (int bin = 0; bin < histogram.length; bin++) {
            seen += histogram[bin];
            if (seen >= target) {
                return max * bin / 255f;
            }
        }
        return max;
    }

    /**
     * Ambil garis luar (outline) dari peta glyph — inilah yang membuat ikon terlihat
     * seperti lampu neon berongga, bukan siluet penuh.
     *
     * Bila bentuk aslinya sudah tipis (line art), outline akan habis; dalam kasus
     * itu glyph asli dipakai dengan intensitas lebih rendah.
     */
    private static float[] outlineOf(float[] mask, int size) {
        int total = mask.length;
        float[] out = new float[total];
        int edgeCount = 0;
        for (int y = 0; y < size; y++) {
            int row = y * size;
            for (int x = 0; x < size; x++) {
                int i = row + x;
                float center = mask[i];
                if (center <= 0.12f) {
                    continue;
                }
                float left = x > 0 ? mask[i - 1] : 0f;
                float right = x < size - 1 ? mask[i + 1] : 0f;
                float up = y > 0 ? mask[i - size] : 0f;
                float down = y < size - 1 ? mask[i + size] : 0f;
                float min = Math.min(center, Math.min(Math.min(left, right), Math.min(up, down)));
                float edge = (center - min) * 1.6f;
                if (edge > 1f) {
                    edge = 1f;
                }
                // Akar kuadrat: garis menjadi tegas, tidak sekadar kabut tipis.
                out[i] = (float) Math.sqrt(edge);
                if (out[i] > 0.05f) {
                    edgeCount++;
                }
            }
        }

        // Bentuk akhir = garis luar terang + ISI glyph yang menyala setengah.
        // Isi ini penting: tanpa itu, ikon berukuran 48 dp tampak "polos"
        // karena yang tersisa hanya garis setebal satu piksel.
        float body = 0.5f;
        if (edgeCount < Math.max(16f, size * 0.4f)) {
            // Bentuk aslinya memang line art → isi lebih tebal.
            body = 0.6f;
        }
        for (int i = 0; i < total; i++) {
            float inner = mask[i] * body;
            if (out[i] < inner) {
                out[i] = inner;
            }
        }
        return out;
    }

}
