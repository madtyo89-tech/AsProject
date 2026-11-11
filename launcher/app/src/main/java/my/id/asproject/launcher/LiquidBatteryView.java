package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.SweepGradient;
import android.util.AttributeSet;
import android.view.View;

/**
 * Ikon baterai **lingkaran bersegmen** bernuansa neon — satu-satunya ikon
 * baterai di aplikasi ini.
 *
 * Tampilannya:
 *  • cincin dari 20 segmen (ruas) yang menyala mengikuti sisa daya;
 *  • ruas yang menyala memakai gradien melingkar neon + glow, ruas kosong
 *    digambar redup supaya lingkarannya tetap terbaca;
 *  • ada **aliran cair** berjalan mengelilingi cincin (ruas berkedip pelan
 *    bergiliran) sehingga terasa "liquid", bukan gauge mati;
 *  • angka persen di tengah memakai font tema;
 *  • saat mengisi daya, sebuah "komet" terang berputar mengelilingi cincin.
 *
 * Semua digambar di Canvas (tanpa OpenGL), aman dari Android 5.0.
 */
public final class LiquidBatteryView extends View {

    private static final int SEGMENTS = 20;
    private static final int NEON = 0xFF5FD8FF;
    private static final int NEON_BRIGHT = 0xFFE6FBFF;
    private static final int GHOST = 0x2A5FD8FF;

    private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ghost = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF box = new RectF();
    private final Path bolt = new Path();

    private int percent = -1;
    private boolean charging;
    private float phase;
    private long lastFrame;
    private boolean running;
    private String label = "--";

    public LiquidBatteryView(Context context) {
        this(context, null);
    }

    /** Dipakai saat di-inflate dari XML (view_lock_screen.xml). */
    public LiquidBatteryView(Context context, AttributeSet attrs) {
        super(context, attrs);
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeCap(Paint.Cap.BUTT);
        ghost.setStyle(Paint.Style.STROKE);
        ghost.setStrokeCap(Paint.Cap.BUTT);
        ghost.setColor(Accent.shift(GHOST));
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typefaces.get(context));
    }

    /** Perbarui daya baterai; {@code percent} negatif bila belum diketahui. */
    public void setBattery(int percent, boolean charging) {
        this.percent = percent;
        this.charging = charging;
        label = percent < 0 ? "--" : String.valueOf(percent);
        invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        float density = getResources().getDisplayMetrics().density;
        int fallback = Math.round(30 * density);
        int width = MeasureSpec.getSize(widthMeasureSpec);
        if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.EXACTLY) {
            width = fallback;
        }
        int height = MeasureSpec.getSize(heightMeasureSpec);
        if (MeasureSpec.getMode(heightMeasureSpec) != MeasureSpec.EXACTLY) {
            height = fallback;
        }
        setMeasuredDimension(width, height);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float size = Math.min(getWidth(), getHeight());
        if (size <= 0f) {
            return;
        }
        float stroke = Math.max(2f, size * 0.115f);
        float radius = size / 2f - stroke / 2f - 1f;
        box.set(getWidth() / 2f - radius, getHeight() / 2f - radius,
                getWidth() / 2f + radius, getHeight() / 2f + radius);

        float level = percent < 0 ? 0f : Math.min(1f, Math.max(0f, percent / 100f));
        int filled = Math.round(SEGMENTS * level);
        float sweep = 360f / SEGMENTS;
        float gap = sweep * 0.28f;          // celah antar ruas

        // Gradien melingkar supaya warna ruas berubah halus mengitari cincin.
        ring.setShader(new SweepGradient(box.centerX(), box.centerY(),
                new int[]{Accent.shift(NEON), Accent.shift(NEON_BRIGHT), Accent.shift(NEON)},
                new float[]{0f, 0.5f, 1f}));
        ring.setStrokeWidth(stroke);
        ghost.setStrokeWidth(stroke);
        ghost.setColor(Accent.shift(GHOST));

        for (int i = 0; i < SEGMENTS; i++) {
            float start = -90f + i * sweep + gap / 2f;
            float length = sweep - gap;
            if (i < filled) {
                // Aliran cair: terang sedikit bergelombang mengitari cincin.
                float flow = 0.72f + 0.28f * (float) Math.sin(phase * 6.2831853f - i * 0.55f);
                ring.setAlpha(Math.round(255 * Math.max(0.45f, flow)));
                if (flow > 0.9f) {
                    ring.setMaskFilter(new BlurMaskFilter(stroke * 0.5f, BlurMaskFilter.Blur.NORMAL));
                } else {
                    ring.setMaskFilter(null);
                }
                canvas.drawArc(box, start, length, false, ring);
            } else {
                canvas.drawArc(box, start, length, false, ghost);
            }
        }
        ring.setMaskFilter(null);
        ring.setShader(null);
        ring.setAlpha(255);

        // Komet berputar saat mengisi daya.
        if (charging) {
            float head = -90f + (phase * 360f);
            glow.setStyle(Paint.Style.STROKE);
            glow.setStrokeWidth(stroke);
            glow.setColor(Accent.shift(NEON_BRIGHT));
            glow.setMaskFilter(new BlurMaskFilter(stroke * 0.9f, BlurMaskFilter.Blur.NORMAL));
            canvas.drawArc(box, head, 26f, false, glow);
            glow.setMaskFilter(null);
        }

        // Angka persen di tengah.
        float centerY = getHeight() / 2f;
        if (charging) {
            drawBolt(canvas, size, centerY - size * 0.30f);
        }
        text.setTextSize(size * 0.34f);
        text.setColor(Accent.shift(NEON_BRIGHT));
        text.setShadowLayer(size * 0.18f, 0, 0, Accent.shift(NEON));
        Paint.FontMetrics metrics = text.getFontMetrics();
        float baseline = centerY - (metrics.ascent + metrics.descent) / 2f;
        canvas.drawText(label, getWidth() / 2f, baseline, text);
        text.setShadowLayer(0, 0, 0, 0);
    }

    /** Kilat kecil di atas angka saat mengisi daya. */
    private void drawBolt(Canvas canvas, float size, float centerY) {
        float h = size * 0.20f;
        float cx = getWidth() / 2f;
        bolt.rewind();
        bolt.moveTo(cx + h * 0.16f, centerY - h * 0.5f);
        bolt.lineTo(cx - h * 0.20f, centerY + h * 0.06f);
        bolt.lineTo(cx + h * 0.02f, centerY + h * 0.06f);
        bolt.lineTo(cx - h * 0.14f, centerY + h * 0.5f);
        bolt.lineTo(cx + h * 0.24f, centerY - h * 0.04f);
        bolt.lineTo(cx + h * 0.02f, centerY - h * 0.04f);
        bolt.close();
        glow.setStyle(Paint.Style.FILL);
        glow.setColor(Accent.shift(NEON_BRIGHT));
        glow.setMaskFilter(new BlurMaskFilter(size * 0.06f, BlurMaskFilter.Blur.NORMAL));
        canvas.drawPath(bolt, glow);
        glow.setMaskFilter(null);
    }

    // ------------------------------------------------------------ animasi

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        running = true;
        lastFrame = android.os.SystemClock.uptimeMillis();
        post(animator);
    }

    @Override
    protected void onDetachedFromWindow() {
        running = false;
        removeCallbacks(animator);
        super.onDetachedFromWindow();
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        super.onVisibilityChanged(changedView, visibility);
        if (visibility == VISIBLE && running && getHandler() != null
                && !getHandler().hasCallbacks(animator)) {
            lastFrame = android.os.SystemClock.uptimeMillis();
            post(animator);
        }
    }

    private final Runnable animator = new Runnable() {
        @Override
        public void run() {
            if (!running) {
                return;
            }
            long now = android.os.SystemClock.uptimeMillis();
            float delta = Math.min(0.1f, (now - lastFrame) / 1000f);
            lastFrame = now;
            if (getVisibility() == VISIBLE && getWindowVisibility() == VISIBLE) {
                phase += delta * (charging ? 0.5f : 0.22f);
                if (phase > 1f) {
                    phase -= 1f;
                }
                invalidate();
            }
            postDelayed(this, 66L);
        }
    };

    /** Dipakai pengujian: apakah animasi sedang berjalan. */
    public boolean isAnimating() {
        return running;
    }

    /** Dipakai pengujian: nilai terakhir yang ditampilkan. */
    public String getLabel() {
        return label;
    }
}
