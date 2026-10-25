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
 * Tepi atasnya bukan garis lurus: berupa gelombang berjalan yang "melengkung"
 * saat diseret dan beriak pelan saat diam, seperti permukaan cairan. Di
 * tengahnya ada pil (batang pendek) sebagai pegangan.
 *
 * Perilaku:
 *  • {@link #setStretch(float)} — seberapa jauh tepi melengkung (0 = rata,
 *    1 = melengkung penuh). Diisi dari kelebihan tarikan laci.
 *  • {@link #pulse()} — memicu riak yang meredup sendiri (dipakai saat laci
 *    membuka/menutup).
 *
 * Seluruhnya Canvas 2D, aman dari Android 5.0.
 */
public final class LiquidHandleView extends View {

    private static final int STEPS = 28;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint edge = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();

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
