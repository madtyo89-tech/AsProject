package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.View;

/**
 * **Liquid slide bar** — gagang tarik laci aplikasi.
 *
 * Empat gaya tersedia ({@link #setStyle(String)}), semuanya tetap merespons
 * tarikan ({@link #setStretch(float)}) dan pulsa ({@link #pulse()}):
 *  • {@code "ombak"}   — bawaan: tepi atas berupa gelombang berjalan yang
 *    "melengkung" saat diseret, dengan pil pegangan di tengah.
 *  • {@code "pil"}     — minimal: tepi datar, satu pil neon yang berdenyut
 *    pelan (napas cairan tanpa riak berlebihan).
 *  • {@code "titik"}   — baris pad sirkuit; satu pulsa terang menyapu dari
 *    kiri ke kanan terus-menerus, seperti lampu kejar.
 *  • {@code "sirkuit"} — jejak PCB bersudut siku dengan pad di tiap tikungan;
 *    pulsa terang menyusuri jejaknya.
 *
 * Seluruhnya Canvas 2D, aman dari Android 5.0.
 */
public final class LiquidHandleView extends View {

    private static final int STEPS = 28;
    private static final int DOT_COUNT = 9;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint edge = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();

    private String style = "ombak";
    private float phase;
    private float stretch;
    private float ripple = 0.35f;
    private boolean animating;
    private long lastFrame = 0L;

    public LiquidHandleView(Context context) {
        this(context, null);
    }

    public LiquidHandleView(Context context, AttributeSet attrs) {
        super(context, attrs);
        edge.setStyle(Paint.Style.STROKE);
    }

    /** Gaya gagang: "ombak" (bawaan), "pil", "titik", atau "sirkuit". */
    public void setStyle(String value) {
        String resolved = value == null ? "ombak" : value;
        if (!resolved.equals(style)) {
            style = resolved;
            invalidate();
        }
    }

    public String getStyle() {
        return style;
    }

    /** 0 = tepi rata, 1 = melengkung penuh (sedang ditarik melebihi batas). */
    public void setStretch(float value) {
        stretch = Math.max(0f, Math.min(1f, value));
        start();
        invalidate();
    }

    /** Picu riak sekali (mis. laci baru saja membuka). */
    public void pulse() {
        ripple = 1f;
        start();
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float width = getWidth();
        float height = getHeight();
        if (width <= 0f || height <= 0f) {
            return;
        }
        if ("pil".equals(style)) {
            drawPill(canvas, width, height);
        } else if ("titik".equals(style)) {
            drawDots(canvas, width, height);
        } else if ("sirkuit".equals(style)) {
            drawTrace(canvas, width, height);
        } else {
            drawLiquid(canvas, width, height);
        }
    }

    // ---------------------------------------------------------- gaya "ombak"

    private void drawLiquid(Canvas canvas, float width, float height) {
        float base = height * 0.42f;                       // garis air saat tenang
        float amp = height * 0.16f * (0.35f + 0.65f * ripple);
        float sag = height * 0.55f * stretch;              // melengkung saat ditarik

        path.rewind();
        path.moveTo(0f, height);
        path.lineTo(0f, surfaceY(0f, width, base, amp, sag));
        for (int i = 1; i <= STEPS; i++) {
            float x = width * i / (float) STEPS;
            path.lineTo(x, surfaceY(x, width, base, amp, sag));
        }
        path.lineTo(width, height);
        path.close();

        fill.setShader(new LinearGradient(0, 0, 0, height,
                0xE61A2632, 0xF2070B12, Shader.TileMode.CLAMP));
        canvas.drawPath(path, fill);
        fill.setShader(null);

        // Garis tepi neon mengikuti gelombang.
        edge.setStrokeWidth(Math.max(1f, height * 0.055f));
        edge.setColor(0xB35FD8FF);
        Path edgePath = new Path();
        edgePath.moveTo(0f, surfaceY(0f, width, base, amp, sag));
        for (int i = 1; i <= STEPS; i++) {
            float x = width * i / (float) STEPS;
            edgePath.lineTo(x, surfaceY(x, width, base, amp, sag));
        }
        canvas.drawPath(edgePath, edge);

        // Pil pegangan.
        float pillWidth = Math.min(width * 0.24f, height * 2.6f);
        float pillHeight = Math.max(2f, height * 0.10f);
        float left = (width - pillWidth) / 2f;
        float top = height * 0.62f - pillHeight / 2f;
        pill.setColor(0xCC7FD8FF);
        canvas.drawRoundRect(left, top, left + pillWidth, top + pillHeight,
                pillHeight / 2f, pillHeight / 2f, pill);
    }

    /**
     * Ketinggian permukaan cair pada posisi x: gelombang berjalan + lengkungan
     * yang paling dalam di tengah (seperti cairan yang ditarik ke atas).
     */
    private float surfaceY(float x, float width, float base, float amp, float sag) {
        float u = x / Math.max(1f, width);
        float wave = (float) Math.sin(phase * 6.2831853f + u * 9.424778f) * amp;
        float wave2 = (float) Math.sin(phase * 4.0f - u * 6.2831853f) * amp * 0.45f;
        float belly = (float) Math.sin(u * Math.PI) * sag;
        return base + wave + wave2 + belly;
    }

    // ------------------------------------------------------------ gaya "pil"

    /** Minimal: tepi datar yang sedikit melengkung saat ditarik, pil berdenyut. */
    private void drawPill(Canvas canvas, float width, float height) {
        float topBase = height * 0.30f;
        float bow = height * 0.50f * stretch;

        path.rewind();
        path.moveTo(0f, height);
        path.lineTo(0f, topBase);
        path.quadTo(width / 2f, topBase + bow, width, topBase);
        path.lineTo(width, height);
        path.close();
        fill.setShader(new LinearGradient(0, 0, 0, height,
                0xE61A2632, 0xF2070B12, Shader.TileMode.CLAMP));
        canvas.drawPath(path, fill);
        fill.setShader(null);

        Path edgePath = new Path();
        edgePath.moveTo(0f, topBase);
        edgePath.quadTo(width / 2f, topBase + bow, width, topBase);
        edge.setStrokeWidth(Math.max(1f, height * 0.045f));
        edge.setColor(0x885FD8FF);
        canvas.drawPath(edgePath, edge);

        // Napas pelan + kilau tambahan saat pulse() dipicu.
        float breathe = 0.5f + 0.5f * (float) Math.sin(phase * 12.566371f);
        float glow = Math.max(breathe * 0.6f, ripple - 0.35f);
        float pillWidth = width * (0.20f + 0.08f * glow);
        float pillHeight = Math.max(2f, height * (0.11f + 0.035f * glow));
        float left = (width - pillWidth) / 2f;
        float top = height * 0.62f - pillHeight / 2f;
        pill.setColor(0xCC7FD8FF);
        pill.setAlpha(Math.round(190 + 65 * glow));
        canvas.drawRoundRect(left, top, left + pillWidth, top + pillHeight,
                pillHeight / 2f, pillHeight / 2f, pill);
        pill.setAlpha(255);
    }

    // ----------------------------------------------------------- gaya "titik"

    /** Baris pad sirkuit dengan satu lampu kejar yang menyapu terus-menerus. */
    private void drawDots(Canvas canvas, float width, float height) {
        float lane = height * 0.5f - height * 0.20f * stretch;

        edge.setStrokeWidth(Math.max(1f, height * 0.035f));
        edge.setColor(0x405FD8FF);
        canvas.drawLine(width * 0.06f, lane, width * 0.94f, lane, edge);

        float chase = phase % 1f;
        float boost = Math.max(stretch, Math.max(0f, ripple - 0.35f) / 0.65f);
        float dotR = Math.max(2f, height * 0.095f);
        for (int i = 0; i < DOT_COUNT; i++) {
            float u = (i + 0.5f) / DOT_COUNT;
            float x = width * (0.06f + u * 0.88f);
            float dist = Math.abs(u - chase);
            dist = Math.min(dist, 1f - dist);
            float glow = Math.max(0f, 1f - dist * 7f);
            glow = Math.max(glow, boost * 0.85f);
            pill.setColor(0xFF7FD8FF);
            pill.setAlpha(Math.round(80 + 170 * glow));
            canvas.drawCircle(x, lane, dotR * (0.65f + 0.6f * glow), pill);
        }
        pill.setAlpha(255);
    }

    // ---------------------------------------------------------- gaya "sirkuit"

    /** Jejak PCB bersudut siku; pulsa terang menyusuri panjangnya. */
    private void drawTrace(Canvas canvas, float width, float height) {
        float drop = height * (0.22f + 0.14f * stretch);
        float midY = height * 0.40f;
        float[] xs = {width * 0.06f, width * 0.32f, width * 0.32f,
                width * 0.68f, width * 0.68f, width * 0.94f};
        float[] ys = {midY, midY, midY + drop, midY + drop, midY, midY};

        Path trace = new Path();
        trace.moveTo(xs[0], ys[0]);
        for (int i = 1; i < xs.length; i++) {
            trace.lineTo(xs[i], ys[i]);
        }
        edge.setStrokeWidth(Math.max(1f, height * 0.05f));
        edge.setColor(0x5A5FD8FF);
        canvas.drawPath(trace, edge);

        pill.setColor(0xAA7FD8FF);
        for (int i = 1; i < xs.length - 1; i++) {
            canvas.drawCircle(xs[i], ys[i], Math.max(1.6f, height * 0.085f), pill);
        }

        float[] segLen = new float[xs.length - 1];
        float total = 0f;
        for (int i = 0; i < segLen.length; i++) {
            segLen[i] = (float) Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]);
            total += segLen[i];
        }
        float travel = (phase % 1f) * total;
        float acc = 0f;
        float px = xs[0];
        float py = ys[0];
        for (int i = 0; i < segLen.length; i++) {
            float end = acc + segLen[i];
            if (travel <= end || i == segLen.length - 1) {
                float t = segLen[i] <= 0f ? 0f : Math.max(0f, Math.min(1f, (travel - acc) / segLen[i]));
                px = xs[i] + (xs[i + 1] - xs[i]) * t;
                py = ys[i] + (ys[i + 1] - ys[i]) * t;
                break;
            }
            acc = end;
        }
        float glowR = height * (0.17f + 0.08f * ripple);
        pill.setColor(0x885FD8FF);
        canvas.drawCircle(px, py, glowR, pill);
        pill.setColor(0xFFEAFBFF);
        canvas.drawCircle(px, py, Math.max(2f, glowR * 0.45f), pill);
        pill.setAlpha(255);
    }

    // ------------------------------------------------------------- animasi

    private void start() {
        if (animating) {
            return;
        }
        animating = true;
        lastFrame = 0L;
        post(ticker);
    }

    private void stop() {
        animating = false;
        removeCallbacks(ticker);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        start();
    }

    @Override
    protected void onDetachedFromWindow() {
        stop();
        super.onDetachedFromWindow();
    }

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!animating) {
                return;
            }
            long now = android.os.SystemClock.uptimeMillis();
            if (lastFrame == 0L) {
                lastFrame = now;
            }
            float delta = Math.min(0.1f, (now - lastFrame) / 1000f);
            lastFrame = now;

            phase += delta * 0.55f;
            if (phase > 1f) {
                phase -= 1f;
            }
            // Riak yang dipicu pulse() meredup sendiri; yang tersisa hanya
            // gelombang dasar yang pelan.
            if (ripple > 0.35f) {
                ripple -= delta * 1.1f;
                if (ripple < 0.35f) {
                    ripple = 0.35f;
                }
            }
            invalidate();

            if (ripple <= 0.35f && stretch <= 0f) {
                // Tetap beriak pelan walau tidak diseret (kesan cairan hidup).
                postDelayed(this, 48L);
            } else {
                postDelayed(this, 16L);
            }
        }
    };

    /** Dipakai pengujian: fase gelombang saat ini. */
    public float getPhase() {
        return phase;
    }
}
