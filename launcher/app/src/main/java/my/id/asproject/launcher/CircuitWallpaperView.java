package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.util.AttributeSet;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Wallpaper layar kunci: **papan sirkuit liquid 3D** yang dibuat prosedural.
 *
 * Tidak ada berkas JPEG yang diulang-ulang — semuanya digambar di Canvas, dan
 * kedalamannya dibangun dari tiga hal:
 *
 *  1. <b>Ruang berlapis (parallax)</b> — tiga bidang terpisah: jauh, tengah,
 *     dan dekat. Masing-masing punya skala, kemiringan 3D, dan simpangan
 *     gelombang sendiri (lihat {@link LiquidWallpaperView#layerDepth(int)}):
 *     bidang dekat bergerak paling liar, bidang jauh paling kalem. Selisih
 *     gerak itulah yang membuat mata membaca "ruang", bukan gambar datar.
 *  2. <b>Proyeksi perspektif</b> — tiap bidang diwarp menjauh ke sebuah titik
 *     hilang di atas layar ({@link #layerPerspective(int)}). Jejak sirkuit yang
 *     tadinya ortogonal jadi menyatu ke kejauhan, menyempit dan menipis; chip
 *     dan pad ikut terforesing pendek. Jarak juga dikabutkan (fog).
 *  3. <b>Cairan</b> — di atasnya, permukaan diombak tiga gelombang berjalan
 *     plus riak halus. Denyut cahaya, gelembung, dan kilau semuanya
 *     diproyeksikan lewat {@link LiquidWallpaperView#projectLayer(int, float, float, float[])}
 *     sehingga mereka **ikut terombang-ambing bersama cairannya**, bukan
 *     melayang kaku di atasnya.
 *
 * Tidak memakai OpenGL maupun pustaka tambahan.
 */
public final class CircuitWallpaperView extends LiquidWallpaperView {

    private static final int SEED = 20261025;
    private static final int LAYER_COUNT = 3;

    /** Bidang 0 = jauh, 1 = tengah (papan utama), 2 = dekat (latar depan). */
    private static final int LAYER_FAR = 0;
    private static final int LAYER_MID = 1;
    private static final int LAYER_NEAR = 2;

    private static final int PULSES_MID = 7;
    private static final int PULSES_NEAR = 2;
    private static final int BUBBLES = 9;
    private static final int GLINTS = 4;

    /** Denyut cahaya: titik-titik jejak dalam koordinat 0..1 + lapisnya. */
    private final List<Integer> pulseLayer = new ArrayList<Integer>();
    private final List<float[]> pulseX = new ArrayList<float[]>();
    private final List<float[]> pulseY = new ArrayList<float[]>();
    private final List<Float> pulseLength = new ArrayList<Float>();
    private final List<Float> pulseOffset = new ArrayList<Float>();
    private final List<Float> pulseSpeed = new ArrayList<Float>();
    private final List<Float> pulseWidth = new ArrayList<Float>();

    /** Gelembung cairan yang naik perlahan. */
    private final float[] bubbleU = new float[BUBBLES];
    private final float[] bubbleR = new float[BUBBLES];
    private final float[] bubbleSpeed = new float[BUBBLES];
    private final float[] bubbleOffset = new float[BUBBLES];
    private final float[] bubbleDrift = new float[BUBBLES];

    private final Paint trace = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pad = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint chip = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint core = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint sprite = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final Paint addSprite = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);

    private final float[] projected = new float[2];

    /** Progres buka kunci 0..1 (0 = diam) + asal sentuhan, untuk efek dramatis. */
    private float unlock;
    private float unlockU = 0.5f;
    private float unlockV = 0.86f;
    private static final int SPARKS = 16;

    private Bitmap glowSprite;
    private Bitmap bubbleSprite;
    private Bitmap poolSprite;
    private boolean spritesReady;
    private String spritesAccent;

    public CircuitWallpaperView(Context context, AttributeSet attrs) {
        super(context, null, true);
        // Harus punya konstruktor (Context, AttributeSet) karena di-inflate dari XML.
        addSprite.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
        Random random = new Random(SEED + 31);
        for (int i = 0; i < BUBBLES; i++) {
            bubbleU[i] = 0.08f + random.nextFloat() * 0.84f;
            bubbleR[i] = 0.012f + random.nextFloat() * 0.030f;
            bubbleSpeed[i] = 0.035f + random.nextFloat() * 0.055f;
            bubbleOffset[i] = random.nextFloat();
            bubbleDrift[i] = 0.004f + random.nextFloat() * 0.012f;
        }
    }

    /**
     * Nyalakan efek buka kunci. {@code progress} 0..1: cairan menyergap, bidang
     * memperbesar, gelombang shockwave melebar dari titik sentuh, dan percikan
     * beterbangan. Koordinat asal dalam piksel view (boleh negatif bila tidak ada).
     */
    public void setUnlockProgress(float progress, float originX, float originY) {
        unlock = Math.max(0f, Math.min(1f, progress));
        int w = getWidth();
        int h = getHeight();
        if (originX >= 0f && w > 0) {
            unlockU = originX / w;
        }
        if (originY >= 0f && h > 0) {
            unlockV = originY / h;
        }
        invalidate();
    }

    /** Progres efek buka kunci saat ini (0..1). */
    public float unlockProgress() {
        return unlock;
    }

    @Override
    protected float amplitudeScale() {
        // Cairan "menyergap" saat dibuka: simpangan naik sampai 3,2×.
        return 1f + unlock * 2.2f;
    }

    @Override
    protected float layerZoom(int layer) {
        // Bidang dekat memperbesar lebih banyak → kesan menerjang ke penonton.
        return 1f + unlock * (0.05f + 0.07f * layerDepth(layer));
    }

    // ------------------------------------------------------------------ lapis

    @Override
    protected int getLayerCount() {
        return LAYER_COUNT;
    }

    @Override
    protected int meshCols(int layer) {
        // Papan utama paling rapat; lapis jauh & dekat cukup jarang (hemat frame).
        return layer == LAYER_MID ? 20 : (layer == LAYER_FAR ? 12 : 14);
    }

    @Override
    protected int meshRows(int layer) {
        return layer == LAYER_MID ? 34 : (layer == LAYER_FAR ? 20 : 24);
    }

    @Override
    protected float layerDepth(int index) {
        if (index == LAYER_FAR) {
            return 0f;
        }
        return index == LAYER_MID ? 0.55f : 1f;
    }

    @Override
    protected float layerPerspective(int index) {
        // Bidang dekat menyatu lebih tajam ke titik hilang daripada bidang jauh.
        if (index == LAYER_FAR) {
            return 0.55f;
        }
        return index == LAYER_MID ? 0.46f : 0.36f;
    }

    @Override
    protected float layerAlpha(int index) {
        return index == LAYER_FAR ? 0.9f : 1f;
    }

    /** Langit/kejauhan di balik semua bidang — mengisi sudut yang tidak terjangkau papan. */
    @Override
    protected void drawBackdrop(Canvas canvas, int width, int height) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(0, 0, 0, height,
                Accent.shift(0xFF04080F), Accent.shift(0xFF070E18), Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, paint);
        paint.setShader(null);
        // Cahaya kejauhan di sekitar titik hilang (atas tengah).
        float r = Math.max(width, height) * 0.55f;
        paint.setShader(new RadialGradient(width * 0.5f, -height * 0.05f, r,
                Accent.shift(0x334FC3F7), Accent.shift(0x00000000), Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, paint);
        paint.setShader(null);
    }

    // ---------------------------------------------------------- papan sirkuit

    @Override
    protected Bitmap createLayer(int index, int width, int height) {
        if (width <= 0 || height <= 0) {
            return null;
        }
        if (index == LAYER_FAR) {
            pulseLayer.clear();
            pulseX.clear();
            pulseY.clear();
            pulseLength.clear();
            pulseOffset.clear();
            pulseSpeed.clear();
            pulseWidth.clear();
        }
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Random random = new Random(SEED + index * 7919);
        if (index == LAYER_FAR) {
            drawFar(canvas, width, height, random);
        } else if (index == LAYER_MID) {
            drawMid(canvas, width, height, random);
        } else {
            drawNear(canvas, width, height, random);
        }
        return bitmap;
    }

    /** Bidang jauh: jejak kecil, redup, dan dikabutkan oleh jarak. */
    private void drawFar(Canvas canvas, int w, int h, Random random) {
        float unit = w / 26f;
        dots(canvas, w, h, w / 34f, Accent.shift(0x10BFE9FF), w * 0.0013f);
        busLines(canvas, w, h, random, 8, w * 0.0022f, Accent.shift(0x3A4FC3F7), Accent.shift(0x3A7FD8FF), 0f, 1f);
        for (int i = 0; i < 18; i++) {
            float[] path = randomPath(random, w, h, unit, 0f, 1f, 3, 5);
            stroke(canvas, path, Math.max(0.6f, w * 0.0018f), Accent.shift(0x324FC3F7));
            if (i < 7) {
                cornerPads(canvas, path, Math.max(0.8f, w * 0.0024f), Accent.shift(0x40B3E8FF));
            }
        }
        for (int i = 0; i < 3; i++) {
            float cw = unit * (1.2f + random.nextFloat());
            float left = random.nextFloat() * (w - cw);
            float top = (0.10f + random.nextFloat() * 0.7f) * h;
            drawChip(canvas, left, top, cw, cw * 0.5f, 0.10f, Accent.shift(0x2A7FD8FF), Accent.shift(0x180A1018), w * 0.0016f);
        }
        fog(canvas, w, h, 0.40f, Accent.shift(0xA8060B12));
    }

    /** Bidang tengah: papan utama — jejak, pad, pin berdiri, dan chip menonjol. */
    private void drawMid(Canvas canvas, int w, int h, Random random) {
        float unit = w / 16f;
        dots(canvas, w, h, w / 20f, Accent.shift(0x14BFE9FF), w * 0.0016f);
        busLines(canvas, w, h, random, 5, w * 0.0034f, Accent.shift(0x554FC3F7), Accent.shift(0x7FB3E8FF), 0f, 1f);

        int pulses = 0;
        for (int i = 0; i < 26; i++) {
            boolean power = i % 5 == 0;                // sebagian jejak "bertegangan"
            float strokeWidth = Math.max(1f, w * (power ? 0.0058f : 0.0030f));
            float[] path = randomPath(random, w, h, unit, 0.02f, 1f, 3, 6);
            // Jejak biasa: dua tarikan (pijar redup + inti) supaya tampak menyala.
            stroke(canvas, path, strokeWidth * 2.1f, power ? Accent.shift(0x2A4FC3F7) : Accent.shift(0x184FC3F7));
            stroke(canvas, path, strokeWidth, power ? Accent.shift(0x7A4FC3F7) : Accent.shift(0x404FC3F7));
            if (power) {
                stroke(canvas, path, strokeWidth * 0.35f, Accent.shift(0xBFE6FBFF));
            }
            cornerPads(canvas, path, strokeWidth * 1.35f, power ? Accent.shift(0x99B3E8FF) : Accent.shift(0x667FD8FF));
            if (power) {
                // Pin berdiri: garis vertikal pendek + kepala terang → kesan 3D.
                risers(canvas, path, h * 0.020f, strokeWidth * 0.8f, Accent.shift(0x8FBFE9FF));
            }
            if (power && pulses < PULSES_MID) {
                addPulse(LAYER_MID, path, random, strokeWidth);
                pulses++;
            }
        }

        for (int i = 0; i < 4; i++) {
            float cw = unit * (1.6f + random.nextFloat() * 1.5f);
            float ch = cw * (0.44f + random.nextFloat() * 0.26f);
            float left = random.nextFloat() * (w - cw);
            float top = (0.12f + random.nextFloat() * 0.7f) * h;
            drawChip(canvas, left, top, cw, ch, 0.16f, Accent.shift(0x6E7FD8FF), Accent.shift(0x2E0A1018), w * 0.0026f);
        }
        fog(canvas, w, h, 0.30f, Accent.shift(0x99060B12));
    }

    /**
     * Bidang dekat: latar depan yang sedikit di luar fokus — jejak besar
     * menyala, cincin pad lebar, dan boket cair. Sengaja jarang supaya papan
     * di belakangnya tetap terbaca.
     */
    private void drawNear(Canvas canvas, int w, int h, Random random) {
        float unit = w / 7f;
        busLines(canvas, w, h, random, 3, w * 0.010f, Accent.shift(0x5A4FC3F7), Accent.shift(0x99BFE9FF), 0.5f, 1.2f);
        hBusLines(canvas, w, h, random, 2, w * 0.009f, Accent.shift(0x504FC3F7), Accent.shift(0x7AE6FBFF), Accent.shift(0x99BFE9FF), 0.84f, 1.16f);
        for (int i = 0; i < 7; i++) {
            float strokeWidth = Math.max(2f, w * (0.010f + random.nextFloat() * 0.008f));
            float[] path = randomPath(random, w, h, unit, 0.55f, 1.25f, 2, 4);
            stroke(canvas, path, strokeWidth * 2.6f, Accent.shift(0x184FC3F7));
            stroke(canvas, path, strokeWidth, Accent.shift(0x5A4FC3F7));
            stroke(canvas, path, strokeWidth * 0.34f, Accent.shift(0x9AE6FBFF));
            cornerPads(canvas, path, strokeWidth * 1.5f, Accent.shift(0xB3BFE9FF));
            risers(canvas, path, h * 0.035f, strokeWidth * 0.9f, Accent.shift(0x99BFE9FF));
            if (i < PULSES_NEAR) {
                addPulse(LAYER_NEAR, path, random, strokeWidth * 1.25f);
            }
        }
        // Boket lembut: bercak cair di sangat dekat dengan kamera.
        for (int i = 0; i < 5; i++) {
            float r = w * (0.10f + random.nextFloat() * 0.16f);
            float cx = random.nextFloat() * w;
            float cy = (0.6f + random.nextFloat() * 0.55f) * h;
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setShader(new RadialGradient(cx, cy, r,
                    new int[]{Accent.shift(0x223A6E8F), Accent.shift(0x142A5470), Accent.shift(0x00000000)},
                    new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP));
            canvas.drawCircle(cx, cy, r, paint);
            paint.setShader(null);
        }
    }

    /**
     * Jejak vertikal panjang ("bus"). Sesudah diproyeksikan, deretan garis ini
     * menyatu ke titik hilang — penanda perspektif yang paling kuat dibaca mata.
     */
    private void busLines(Canvas canvas, int w, int h, Random random, int count,
                          float strokeWidth, int color, int padColor,
                          float vTop, float vBottom) {
        trace.setStyle(Paint.Style.STROKE);
        trace.setStrokeCap(Paint.Cap.ROUND);
        trace.setStrokeWidth(Math.max(0.6f, strokeWidth));
        trace.setColor(color);
        pad.setStyle(Paint.Style.FILL);
        for (int i = 0; i < count; i++) {
            float x = (float) (Math.round(random.nextFloat() * 16f) * (w / 16f));
            float y0 = vTop * h;
            float y1 = vBottom * h;
            canvas.drawLine(x, y0, x, y1, trace);
            int joints = 2 + random.nextInt(2);
            for (int k = 0; k < joints; k++) {
                float jy = y0 + (y1 - y0) * ((k + 0.5f + random.nextFloat() * 0.4f) / (joints + 0.4f));
                float dir = random.nextBoolean() ? 1f : -1f;
                float len = w * (0.03f + random.nextFloat() * 0.07f);
                canvas.drawLine(x, jy, x + dir * len, jy, trace);
                pad.setColor(padColor);
                canvas.drawCircle(x + dir * len, jy, strokeWidth * 1.35f, pad);
            }
            pad.setColor(padColor);
            canvas.drawCircle(x, y0, strokeWidth * 1.2f, pad);
            canvas.drawCircle(x, y1, strokeWidth * 1.2f, pad);
        }
    }

    /** Jejak mendatar panjang — di bidang dekat tampak sebagai pita lebar. */
    private void hBusLines(Canvas canvas, int w, int h, Random random, int count,
                           float strokeWidth, int color, int coreColor, int padColor,
                           float vTop, float vBottom) {
        for (int i = 0; i < count; i++) {
            float y = (vTop + random.nextFloat() * (vBottom - vTop)) * h;
            float x0 = -w * 0.05f;
            float x1 = w * (0.75f + random.nextFloat() * 0.5f);
            stroke(canvas, new float[]{2, x0, y, x1, y}, strokeWidth * 2.0f, color);
            stroke(canvas, new float[]{2, x0, y, x1, y}, strokeWidth, color);
            stroke(canvas, new float[]{2, x0, y, x1, y}, strokeWidth * 0.34f, coreColor);
            pad.setStyle(Paint.Style.FILL);
            pad.setColor(padColor);
            canvas.drawCircle(x0 + w * 0.06f, y, strokeWidth * 1.5f, pad);
            canvas.drawCircle(x0 + w * 0.42f, y, strokeWidth * 1.5f, pad);
            canvas.drawCircle(Math.min(x1, w * 0.92f), y, strokeWidth * 1.5f, pad);
        }
    }

    // ------------------------------------------------------------- penggambar

    /** Jejak ortogonal acak; hasilnya dipakai berulang supaya pad/denyut searah. */
    private static float[] randomPath(Random random, int w, int h, float unit,
                                      float vTop, float vBottom, int minCorners, int maxCorners) {
        float x = (float) (Math.round(random.nextFloat() * 16f) * (w / 16f));
        float y = (vTop + random.nextFloat() * (vBottom - vTop)) * h;
        int corners = minCorners + random.nextInt(maxCorners - minCorners + 1);
        boolean horizontal = random.nextBoolean();
        float[] out = new float[(corners + 1) * 2 + 1];
        out[0] = corners + 1;                        // jumlah titik disimpan di depan
        out[1] = x;
        out[2] = y;
        for (int c = 0; c < corners; c++) {
            float length = unit * (1f + random.nextInt(3));
            if (horizontal) {
                x += random.nextBoolean() ? length : -length;
            } else {
                y += random.nextBoolean() ? length : -length;
            }
            x = Math.max(-unit, Math.min(w + unit, x));
            y = Math.max(vTop * h - unit, Math.min(vBottom * h + unit, y));
            out[3 + c * 2] = x;
            out[4 + c * 2] = y;
            horizontal = !horizontal;
        }
        return out;
    }

    private static Path toPath(float[] pts) {
        int count = (int) pts[0];
        Path path = new Path();
        path.moveTo(pts[1], pts[2]);
        for (int i = 1; i < count; i++) {
            path.lineTo(pts[1 + i * 2], pts[2 + i * 2]);
        }
        return path;
    }

    private void stroke(Canvas canvas, float[] pts, float width, int color) {
        trace.setStyle(Paint.Style.STROKE);
        trace.setStrokeCap(Paint.Cap.ROUND);
        trace.setStrokeJoin(Paint.Join.ROUND);
        trace.setStrokeWidth(width);
        trace.setColor(color);
        canvas.drawPath(toPath(pts), trace);
    }

    private void cornerPads(Canvas canvas, float[] pts, float radius, int color) {
        int count = (int) pts[0];
        pad.setStyle(Paint.Style.FILL);
        for (int i = 0; i < count; i++) {
            float px = pts[1 + i * 2];
            float py = pts[2 + i * 2];
            pad.setColor(color);
            canvas.drawCircle(px, py, radius, pad);
            pad.setColor(Accent.shift(0x22EAFBFF));
            canvas.drawCircle(px, py, radius * 0.42f, pad);
        }
    }

    /** Pin yang berdiri tegak dari papan — penanda ketinggian yang paling jelas. */
    private void risers(Canvas canvas, float[] pts, float length, float width, int color) {
        int count = (int) pts[0];
        core.setStyle(Paint.Style.FILL);
        for (int i = 1; i < count; i += 2) {
            float px = pts[1 + i * 2];
            float py = pts[2 + i * 2];
            core.setColor(color);
            canvas.drawRect(px - width * 0.5f, py - length, px + width * 0.5f, py, core);
            canvas.drawCircle(px, py - length, width * 0.95f, core);
            core.setColor(Accent.shift(0x33EAFBFF));
            canvas.drawCircle(px, py - length, width * 2.2f, core);
        }
    }

    /** Kotak IC dengan sisi yang diekstrusi sedikit (topi lebih terang dari badan). */
    private void drawChip(Canvas canvas, float left, float top, float cw, float ch,
                          float extrude, int edge, int body, float strokeWidth) {
        float lift = ch * extrude;
        // Badan (sisi depan).
        chip.setStyle(Paint.Style.FILL);
        chip.setColor(body);
        canvas.drawRoundRect(new RectF(left, top, left + cw, top + ch), ch * 0.12f, ch * 0.12f, chip);
        // Sisi atas hasil ekstrusi: segiempat yang menghubungkan badan ke tutup.
        Path side = new Path();
        side.moveTo(left, top);
        side.lineTo(left, top - lift);
        side.lineTo(left + cw, top - lift);
        side.lineTo(left + cw, top);
        side.close();
        chip.setColor(Accent.shift(0x3A16222E));
        canvas.drawPath(side, chip);
        // Tutup.
        chip.setColor(Accent.shift(0x2A0C1420));
        canvas.drawRoundRect(new RectF(left, top - lift, left + cw, top - lift + ch * 0.9f),
                ch * 0.12f, ch * 0.12f, chip);
        chip.setStyle(Paint.Style.STROKE);
        chip.setStrokeWidth(strokeWidth);
        chip.setColor(edge);
        canvas.drawRoundRect(new RectF(left, top - lift, left + cw, top - lift + ch * 0.9f),
                ch * 0.12f, ch * 0.12f, chip);
        // Kaki kiri-kanan.
        chip.setStyle(Paint.Style.FILL);
        chip.setColor(edge & 0x66FFFFFF);
        int legs = 4;
        for (int l = 0; l < legs; l++) {
            float ly = top + ch * (l + 0.5f) / legs;
            canvas.drawRect(left - cw * 0.06f, ly - ch * 0.02f, left, ly + ch * 0.02f, chip);
            canvas.drawRect(left + cw, ly - ch * 0.02f, left + cw + cw * 0.06f, ly + ch * 0.02f, chip);
        }
    }

    private static void dots(Canvas canvas, int w, int h, float step, int color, float radius) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        float r = Math.max(0.6f, radius);
        for (float y = step * 0.5f; y < h; y += step) {
            for (float x = step * 0.5f; x < w; x += step) {
                canvas.drawCircle(x, y, r, paint);
            }
        }
    }

    /** Kabut jarak: bagian atas bidang (yang paling jauh) memudar ke warna dasar. */
    private static void fog(Canvas canvas, int w, int h, float amount, int color) {
        if (amount <= 0f) {
            return;
        }
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(0, 0, 0, h * amount, color, Accent.shift(0x00000000),
                Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, w, h * amount, paint);
        paint.setShader(null);
    }

    // ------------------------------------------------------------- denyut

    private void addPulse(int layer, float[] pts, Random random, float width) {
        int count = (int) pts[0];
        float[] xs = new float[count];
        float[] ys = new float[count];
        float total = 0f;
        for (int i = 0; i < count; i++) {
            xs[i] = pts[1 + i * 2];
            ys[i] = pts[2 + i * 2];
            if (i > 0) {
                float dx = xs[i] - xs[i - 1];
                float dy = ys[i] - ys[i - 1];
                total += (float) Math.sqrt(dx * dx + dy * dy);
            }
        }
        if (total <= 0f) {
            return;
        }
        pulseLayer.add(Integer.valueOf(layer));
        pulseX.add(xs);
        pulseY.add(ys);
        pulseLength.add(Float.valueOf(total));
        pulseOffset.add(Float.valueOf(random.nextFloat()));
        pulseSpeed.add(Float.valueOf(0.05f + random.nextFloat() * 0.09f));
        pulseWidth.add(Float.valueOf(width));
    }

    @Override
    protected void drawLayerExtras(Canvas canvas, int width, int height, float t, int layer) {
        if (pulseX.isEmpty() || width <= 0 || height <= 0) {
            return;
        }
        ensureSprites();
        for (int i = 0; i < pulseX.size(); i++) {
            if (pulseLayer.get(i).intValue() != layer) {
                continue;
            }
            float[] xs = pulseX.get(i);
            float[] ys = pulseY.get(i);
            float total = pulseLength.get(i);
            if (total <= 0f) {
                continue;
            }
            float head = (t * pulseSpeed.get(i).floatValue() + pulseOffset.get(i).floatValue()) % 1f;
            if (head < 0f) {
                head += 1f;
            }
            int widthPx = Math.max(2, Math.round(pulseWidth.get(i).floatValue()
                    * (width / (float) bitmapWidth(layer))));
            float r = Math.max(2.2f, widthPx * 1.15f) * (1f + unlock * 1.1f);

            // Ekor: beberapa titik memudar di belakang kepala.
            for (int k = 6; k >= 1; k--) {
                float p = head - k * 0.014f;
                if (p < 0f) {
                    p += 1f;
                }
                pointAt(xs, ys, total, p, projected);
                if (!projectLayer(layer, projected[0] / bitmapWidth(layer),
                        projected[1] / bitmapHeight(layer), projected)) {
                    continue;
                }
                int alpha = Math.round(150f * (1f - k / 7f));
                sprite.setAlpha(alpha);
                float rr = r * (1.35f - k * 0.11f);
                drawSprite(canvas, glowSprite, projected[0], projected[1], rr, rr, 0f, sprite);
            }

            // Kepala denyut: pijar lebar + inti putih.
            pointAt(xs, ys, total, head, projected);
            if (projectLayer(layer, projected[0] / bitmapWidth(layer),
                    projected[1] / bitmapHeight(layer), projected)) {
                sprite.setAlpha(255);
                drawSprite(canvas, glowSprite, projected[0], projected[1],
                        r * (2.6f + unlock * 2.2f), r * (2.6f + unlock * 2.2f), 0f, sprite);
                core.setStyle(Paint.Style.FILL);
                core.setColor(Accent.shift(0xFFEAFBFF));
                canvas.drawCircle(projected[0], projected[1], r * (0.62f + unlock * 0.35f), core);
            }
        }
        sprite.setAlpha(255);
    }

    // ------------------------------------------------- cairan: gelembung & kilau

    @Override
    protected void drawExtras(Canvas canvas, int width, int height, float t) {
        if (width <= 0 || height <= 0) {
            return;
        }
        ensureSprites();
        int layers = layerCount();
        if (layers <= 0) {
            return;
        }

        // Kolam cahaya: dua bercak besar yang berkelana pelan di atas papan.
        for (int i = 0; i < 2; i++) {
            float u = 0.5f + 0.42f * (float) Math.sin(t * (0.07f + i * 0.03f) + i * 2.1f);
            float v = 0.45f + 0.3f * (float) Math.cos(t * (0.05f + i * 0.04f) + i);
            if (!projectLayer(LAYER_MID, u, v, projected)) {
                continue;
            }
            float r = Math.max(width, height) * (0.34f + i * 0.12f);
            addSprite.setAlpha(46 + i * 12);
            drawSprite(canvas, poolSprite, projected[0], projected[1], r, r * 0.62f, 0f, addSprite);
        }

        // Kilau memanjang yang mengikuti lengkung ombak — tanda permukaan basah.
        for (int i = 0; i < GLINTS; i++) {
            float u = (i + 0.5f) / GLINTS + 0.06f * (float) Math.sin(t * 0.31f + i * 1.7f);
            float v = 0.35f + 0.5f * ((t * 0.035f + i * 0.23f) % 1f);
            if (u < 0f) {
                u += 1f;
            }
            if (u > 1f) {
                u -= 1f;
            }
            if (!projectLayer(LAYER_MID, u, v, projected)) {
                continue;
            }
            float rot = 0.5f * (float) Math.sin(t * 0.5f + i);
            float rr = width * (0.10f + 0.05f * (float) Math.sin(t * 0.7f + i * 2.2f));
            addSprite.setAlpha(70);
            drawSprite(canvas, poolSprite, projected[0], projected[1], rr, rr * 0.16f, rot, addSprite);
        }

        // Gelembung cairan yang naik perlahan sambil berayun.
        for (int i = 0; i < BUBBLES; i++) {
            float p = (t * bubbleSpeed[i] + bubbleOffset[i]) % 1f;
            float v = 1.08f - p * 1.20f;                 // dari bawah ke atas
            float u = bubbleU[i] + bubbleDrift[i] * (float) Math.sin(t * 0.9f + i * 1.3f);
            if (u < 0.02f) {
                u = 0.02f;
            }
            if (u > 0.98f) {
                u = 0.98f;
            }
            if (!projectLayer(LAYER_MID, u, v, projected)) {
                continue;
            }
            float fade = (float) Math.sin(Math.PI * Math.max(0f, Math.min(1f, p)));
            float r = width * bubbleR[i] * (0.7f + 0.5f * fade);
            sprite.setAlpha(Math.round(190f * fade));
            drawSprite(canvas, bubbleSprite, projected[0], projected[1], r, r, 0f, sprite);
        }
        sprite.setAlpha(255);
        addSprite.setAlpha(255);
        if (unlock > 0f) {
            drawUnlock(canvas, width, height);
        }
    }

    /**
     * Efek buka kunci: **sapuan terang** naik dari bawah, **gelombang
     * shockwave** melebar dari titik sentuh, dan **percikan** neon yang
     * beterbangan. Semuanya additive, jadi hanya menambah cahaya.
     */
    private void drawUnlock(Canvas canvas, int width, int height) {
        float p = unlock;
        float ease = p * p * (3f - 2f * p);              // smoothstep
        float fade = 1f - p;

        // 1. Sapuan terang yang naik melewati layar.
        float band = height * 0.55f;
        float center = height * (1.25f - ease * 1.9f);
        Paint paint = addSprite;
        paint.setShader(new LinearGradient(0, center - band, 0, center + band,
                new int[]{Accent.shift(0x00000000), Accent.shift(0x668FE6FF), Accent.shift(0x00000000)},
                new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
        paint.setAlpha(Math.round(190f * (float) Math.sin(Math.PI * p)));
        canvas.drawRect(0, 0, width, height, paint);
        paint.setShader(null);

        // 2. Shockwave: dua cincin yang melebar dari titik sentuh.
        float ox = unlockU * width;
        float oy = unlockV * height;
        float reach = (float) Math.hypot(width, height) * 1.15f;
        Paint ring = core;
        ring.setStyle(Paint.Style.STROKE);
        for (int k = 0; k < 2; k++) {
            float rp = Math.max(0f, ease * (1f + k * 0.55f) - k * 0.30f);
            if (rp <= 0f) {
                continue;
            }
            float radius = reach * rp;
            float alpha = (1f - rp) * (1f - rp) * (k == 0 ? 210f : 120f);
            ring.setStrokeWidth(Math.max(1f, width * (0.014f - k * 0.004f) * (1f - rp * 0.6f)));
            ring.setColor(Accent.shift(0xFF8FE6FF));
            ring.setAlpha(Math.round(alpha));
            canvas.drawCircle(ox, oy, radius, ring);
        }
        ring.setAlpha(255);
        ring.setStyle(Paint.Style.FILL);

        // 3. Percikan: melesat dari titik sentuh, melambat sambil meredup.
        for (int i = 0; i < SPARKS; i++) {
            float seed = i * 12.9898f;
            float angle = (float) (seed % 6.2832f) + (i % 2 == 0 ? 0.4f : -0.4f);
            float speed = 0.55f + (i % 5) * 0.16f;
            float spread = width * speed * ease;
            float sx = ox + (float) Math.cos(angle) * spread;
            float sy = oy + (float) Math.sin(angle) * spread - height * 0.55f * ease * ease;
            float size = width * (0.020f + (i % 3) * 0.006f) * (1f - ease * 0.55f);
            sprite.setAlpha(Math.round(230f * fade * (0.5f + 0.5f * (i % 4) / 3f)));
            drawSprite(canvas, glowSprite, sx, sy, size, size, 0f, sprite);
        }
        sprite.setAlpha(255);
    }

    // ------------------------------------------------------------------ sprite

    private void ensureSprites() {
        // Bitmap sprite "membakar" warna aksen saat dibuat; bangun ulang bila
        // pengguna mengganti aksen (mis. kembali dari Pengaturan).
        if (spritesReady && Accent.current().equals(spritesAccent)) {
            return;
        }
        int size = 128;
        glowSprite = radial(size,
                new int[]{Accent.shift(0xE68FE6FF), Accent.shift(0x805FD8FF), Accent.shift(0x1A4FC3F7), Accent.shift(0x00000000)},
                new float[]{0f, 0.22f, 0.55f, 1f});
        bubbleSprite = radial(size,
                new int[]{Accent.shift(0x00000000), Accent.shift(0x0A5FD8FF), Accent.shift(0x66BFE9FF), Accent.shift(0xCCEAFBFF), Accent.shift(0x00000000)},
                new float[]{0f, 0.55f, 0.78f, 0.90f, 1f});
        poolSprite = radial(size,
                new int[]{Accent.shift(0x666FCFFF), Accent.shift(0x2A4FC3F7), Accent.shift(0x00000000)},
                new float[]{0f, 0.45f, 1f});
        spritesReady = glowSprite != null && bubbleSprite != null && poolSprite != null;
        spritesAccent = Accent.current();
    }

    private static Bitmap radial(int size, int[] colors, float[] stops) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new RadialGradient(size / 2f, size / 2f, size / 2f,
                colors, stops, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, size, size, paint);
        return bitmap;
    }

    /** Gambar sprite berpusat di (x,y) dengan jari-jari rx/ry dan rotasi (radian). */
    private static void drawSprite(Canvas canvas, Bitmap sprite, float x, float y,
                                   float rx, float ry, float rot, Paint paint) {
        if (sprite == null || rx <= 0f || ry <= 0f) {
            return;
        }
        int save = canvas.save();
        canvas.translate(x, y);
        if (rot != 0f) {
            canvas.rotate((float) Math.toDegrees(rot));
        }
        canvas.scale(rx, ry);
        canvas.drawBitmap(sprite, -0.5f, -0.5f, paint);
        canvas.restoreToCount(save);
    }

    // ------------------------------------------------------------------ utilitas

    private int bitmapWidth(int layer) {
        Bitmap bitmap = layerBitmap(layer);
        return bitmap == null ? 1 : bitmap.getWidth();
    }

    private int bitmapHeight(int layer) {
        Bitmap bitmap = layerBitmap(layer);
        return bitmap == null ? 1 : bitmap.getHeight();
    }

    /** Titik pada posisi {@code p} (0..1) menyusuri jejak, dalam koordinat bitmap. */
    private static void pointAt(float[] xs, float[] ys, float total, float p, float[] out) {
        float target = total * p;
        float walked = 0f;
        for (int i = 1; i < xs.length; i++) {
            float dx = xs[i] - xs[i - 1];
            float dy = ys[i] - ys[i - 1];
            float segment = (float) Math.sqrt(dx * dx + dy * dy);
            if (segment <= 0f) {
                continue;
            }
            if (walked + segment >= target) {
                float ratio = (target - walked) / segment;
                out[0] = xs[i - 1] + dx * ratio;
                out[1] = ys[i - 1] + dy * ratio;
                return;
            }
            walked += segment;
        }
        out[0] = xs[xs.length - 1];
        out[1] = ys[ys.length - 1];
    }

    /** Dipakai pengujian: jumlah jejak yang dilalui denyut. */
    public int pulseCount() {
        return pulseX.size();
    }

    /** Dipakai pengujian: jumlah lapis papan. */
    public int boardLayers() {
        return getLayerCount();
    }
}
