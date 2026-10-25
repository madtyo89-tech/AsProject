package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.View;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Wallpaper layar kunci: **papan sirkuit liquid 3D** yang dibuat prosedural.
 *
 * Sebelumnya layar kunci memakai foto bingkai liquid-chrome. Sekarang gambarnya
 * dibuat sendiri di Canvas — jadi tidak ada berkas JPEG yang diulang-ulang dan
 * motifnya bisa dibuat selaras dengan tema:
 *
 *  1. <b>Papan sirkuit</b> — jejak ortogonal (garis siku), pad/titik sambung,
 *     dan beberapa "chip" yang digambar sekali ke bitmap (acak-tertentu, jadi
 *     motifnya stabil antar sesi).
 *  2. <b>Liquid 3D</b> — bitmap itu digambar ulang tiap frame lewat
 *     {@code drawBitmapMesh} 20×34 yang diombak tiga fungsi sinus lalu
 *     dimiringkan {@code Camera} ±1.6° (diwarisi dari LiquidWallpaperView).
 *  3. <b>Denyut berjalan</b> — beberapa titik cahaya melaju menyusuri jejak,
 *     lengkap dengan ekornya, seolah arus listrik mengalir di atas kaca cair.
 *
 * Tidak memakai OpenGL maupun pustaka tambahan.
 */
public final class CircuitWallpaperView extends LiquidWallpaperView {

    private static final int SEED = 20261025;
    private static final int TRACES = 26;
    private static final int PULSES = 7;

    /** Jejak yang dilalui denyut, tersimpan dalam koordinat 0..1. */
    private final List<float[]> pulseX = new ArrayList<float[]>();
    private final List<float[]> pulseY = new ArrayList<float[]>();
    private final List<Float> pulseLength = new ArrayList<Float>();
    private final List<Float> pulseOffset = new ArrayList<Float>();
    private final List<Float> pulseSpeed = new ArrayList<Float>();

    private final Paint trace = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pad = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint chip = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pulse = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);

    public CircuitWallpaperView(Context context, AttributeSet attrs) {
        super(context, null, true);
        // Harus punya konstruktor (Context, AttributeSet) karena di-inflate dari XML.
    }

    // ---------------------------------------------------------- papan sirkuit

    @Override
    protected Bitmap createBitmap(int width, int height) {
        if (width <= 0 || height <= 0) {
            return null;
        }
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Random random = new Random(SEED);

        // 1. Dasar kaca gelap + kabut di bawah.
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(0, 0, 0, height,
                0xFF060B12, 0xFF0A121C, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, paint);

        // 2. Kisi titik redup — memberi kesan PCB.
        float step = width / 22f;
        paint.setShader(null);
        paint.setColor(0x14BFE9FF);
        for (float y = step; y < height; y += step) {
            for (float x = step; x < width; x += step) {
                canvas.drawCircle(x, y, Math.max(0.7f, width * 0.0018f), paint);
            }
        }

        // 3. Jejak sirkuit.
        float unit = width / 16f;
        pulseX.clear();
        pulseY.clear();
        pulseLength.clear();
        pulseOffset.clear();
        pulseSpeed.clear();

        trace.setStyle(Paint.Style.STROKE);
        trace.setStrokeCap(Paint.Cap.ROUND);
        trace.setStrokeJoin(Paint.Join.ROUND);

        for (int i = 0; i < TRACES; i++) {
            boolean power = i % 6 == 0;               // sebagian jejak "bertegangan"
            float strokeWidth = Math.max(1f, width * (power ? 0.0055f : 0.0032f));
            trace.setStrokeWidth(strokeWidth);
            trace.setColor(power ? 0x664FC3F7 : 0x304FC3F7);

            float x = (float) (Math.round(random.nextFloat() * 16f) * unit);
            float y = (float) ((0.06f + random.nextFloat() * 0.88f) * height);
            Path path = new Path();
            path.moveTo(x, y);
            List<Float> xs = new ArrayList<Float>();
            List<Float> ys = new ArrayList<Float>();
            xs.add(x / width);
            ys.add(y / height);

            int corners = 3 + random.nextInt(4);
            boolean horizontal = random.nextBoolean();
            for (int c = 0; c < corners; c++) {
                float length = unit * (1f + random.nextInt(3));
                if (horizontal) {
                    x += random.nextBoolean() ? length : -length;
                } else {
                    y += random.nextBoolean() ? length : -length;
                }
                x = Math.max(-unit, Math.min(width + unit, x));
                y = Math.max(0f, Math.min(height, y));
                path.lineTo(x, y);
                xs.add(x / width);
                ys.add(y / height);
                horizontal = !horizontal;
            }
            canvas.drawPath(path, trace);

            // Pad di setiap tikungan + node terang di ujung.
            pad.setColor(power ? 0x99B3E8FF : 0x667FD8FF);
            for (int c = 0; c < xs.size(); c++) {
                float px = xs.get(c) * width;
                float py = ys.get(c) * height;
                canvas.drawCircle(px, py, strokeWidth * 0.9f, pad);
            }
            if (power && pulseX.size() < PULSES) {
                pulseX.add(toArray(xs));
                pulseY.add(toArray(ys));
                pulseLength.add(length(xs, ys));
                pulseOffset.add(random.nextFloat());
                pulseSpeed.add(0.06f + random.nextFloat() * 0.07f);
            }
        }

        // 4. Beberapa chip (kotak IC) dengan kaki kiri-kanan.
        chip.setStyle(Paint.Style.FILL);
        chip.setColor(0x330A1018);
        Paint chipEdge = new Paint(Paint.ANTI_ALIAS_FLAG);
        chipEdge.setStyle(Paint.Style.STROKE);
        chipEdge.setColor(0x557FD8FF);
        chipEdge.setStrokeWidth(Math.max(1f, width * 0.0025f));
        Paint leg = new Paint(Paint.ANTI_ALIAS_FLAG);
        leg.setColor(0x887FD8FF);
        for (int i = 0; i < 5; i++) {
            float cw = unit * (1.6f + random.nextFloat() * 1.6f);
            float ch = cw * (0.42f + random.nextFloat() * 0.3f);
            float left = random.nextFloat() * (width - cw);
            float top = (0.12f + random.nextFloat() * 0.72f) * height;
            RectF body = new RectF(left, top, left + cw, top + ch);
            canvas.drawRoundRect(body, ch * 0.14f, ch * 0.14f, chip);
            canvas.drawRoundRect(body, ch * 0.14f, ch * 0.14f, chipEdge);
            int legs = 4;
            for (int l = 0; l < legs; l++) {
                float ly = top + ch * (l + 0.5f) / legs;
                canvas.drawRect(left - unit * 0.22f, ly - ch * 0.02f,
                        left, ly + ch * 0.02f, leg);
                canvas.drawRect(left + cw, ly - ch * 0.02f,
                        left + cw + unit * 0.22f, ly + ch * 0.02f, leg);
            }
        }

        // 5. Tepi agak gelap (vignette) supaya HUD di bawah lebih terbaca.
        paint.setShader(new RadialGradient(width * 0.5f, height * 0.42f,
                Math.max(width, height) * 0.72f,
                0x00000000, 0xCC02040A, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, paint);
        paint.setShader(null);
        return bitmap;
    }

    // ------------------------------------------------------------- denyut

    @Override
    protected void drawExtras(Canvas canvas, int width, int height, float t) {
        if (pulseX.isEmpty() || width <= 0 || height <= 0) {
            return;
        }
        float radius = Math.max(1.6f, width * 0.0075f);
        float tail = Math.max(1f, width * 0.0045f);
        for (int i = 0; i < pulseX.size(); i++) {
            float[] xs = pulseX.get(i);
            float[] ys = pulseY.get(i);
            float total = pulseLength.get(i);
            if (total <= 0f) {
                continue;
            }
            float head = (t * pulseSpeed.get(i) + pulseOffset.get(i)) % 1f;

            // Ekor: dua titik di belakang kepala.
            for (int k = 2; k >= 1; k--) {
                float p = head - k * 0.022f;
                if (p < 0f) {
                    p += 1f;
                }
                float[] point = pointAt(xs, ys, total, p);
                pulse.setColor(0x556FD8FF);
                canvas.drawCircle(point[0] * width, point[1] * height, tail * (3f - k) * 0.6f, pulse);
            }

            // Kepala denyut + glow.
            float[] point = pointAt(xs, ys, total, head);
            float px = point[0] * width;
            float py = point[1] * height;
            glow.setColor(0xFF8FE6FF);
            glow.setMaskFilter(new BlurMaskFilter(radius * 2.2f, BlurMaskFilter.Blur.NORMAL));
            canvas.drawCircle(px, py, radius * 0.9f, glow);
            glow.setMaskFilter(null);
            pulse.setColor(0xFFEAFBFF);
            canvas.drawCircle(px, py, radius * 0.5f, pulse);
        }
    }

    /** Titik pada posisi {@code p} (0..1) menyusuri jejak. */
    private static float[] pointAt(float[] xs, float[] ys, float total, float p) {
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
                return new float[]{xs[i - 1] + dx * ratio, ys[i - 1] + dy * ratio};
            }
            walked += segment;
        }
        return new float[]{xs[xs.length - 1], ys[ys.length - 1]};
    }

    private static float length(List<Float> xs, List<Float> ys) {
        float total = 0f;
        for (int i = 1; i < xs.size(); i++) {
            float dx = xs.get(i) - xs.get(i - 1);
            float dy = ys.get(i) - ys.get(i - 1);
            total += (float) Math.sqrt(dx * dx + dy * dy);
        }
        return total;
    }

    private static float[] toArray(List<Float> values) {
        float[] out = new float[values.size()];
        for (int i = 0; i < out.length; i++) {
            out[i] = values.get(i);
        }
        return out;
    }

    /** Dipakai pengujian: jumlah jejak yang dilalui denyut. */
    public int pulseCount() {
        return pulseX.size();
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        super.onVisibilityChanged(changedView, visibility);
    }
}
