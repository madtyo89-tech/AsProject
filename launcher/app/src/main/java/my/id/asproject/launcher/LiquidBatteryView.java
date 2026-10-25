package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;

/**
 * Satu-satunya ikon baterai di aplikasi ini: ukuran kecil seperti ikon bilah
 * status, warna **neon**, dan isinya tetap **cairan** yang permukaannya beriak
 * mengikuti sisa daya.
 *
 * Dulu ada dua penanda baterai (kapsul di layar kunci + 6 sel di HUD). Sekarang
 * cukup satu, di bilah notifikasi/status — sisanya cukup angka di HUD.
 *
 * Lapisan: cangkang kaca → ruas kosong redup → cairan neon beriak → garis
 * tegangan permukaan → kilat saat mengisi daya → angka persen.
 */
public final class LiquidBatteryView extends View {

    private static final int NEON = 0xFF5FD8FF;
    private static final int NEON_CORE = 0xFFE6FBFF;
    private static final int GHOST = 0x245FD8FF;      // ruas baterai yang kosong
    private static final int SHELL_ON = 0xCC5FD8FF;   // garis cangkang
    private static final int LIQUID_TOP = 0xFF8FE6FF;
    private static final int LIQUID_BOTTOM = 0xF21F90C8;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path shape = new Path();

    private int percent = -1;
    private boolean charging;
    private float phase;
    private long lastFrame;
    private boolean running;
    private String label = "--%";

    public LiquidBatteryView(Context context) {
        this(context, null);
    }

    /** Dipakai saat di-inflate dari XML (view_lock_screen.xml). */
    public LiquidBatteryView(Context context, AttributeSet attrs) {
        super(context, attrs);
        text.setTypeface(Typeface.MONOSPACE);
        stroke.setStyle(Paint.Style.STROKE);
    }

    /** Perbarui daya baterai; {@code percent} negatif bila belum diketahui. */
    public void setBattery(int percent, boolean charging) {
        this.percent = percent;
        this.charging = charging;
        label = (percent < 0 ? "--" : String.valueOf(percent)) + "%";
        invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        float density = getResources().getDisplayMetrics().density;
        int height = MeasureSpec.getSize(heightMeasureSpec);
        if (MeasureSpec.getMode(heightMeasureSpec) != MeasureSpec.EXACTLY) {
            height = Math.round(14 * density);
        }
        int width = MeasureSpec.getSize(widthMeasureSpec);
        if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.EXACTLY) {
            text.setTextSize(9.5f * density);
            width = Math.round(24f * density + 4f * density + text.measureText(label));
        }
        setMeasuredDimension(width, height);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float width = getWidth();
        float height = getHeight();
        if (width <= 0f || height <= 0f) {
            return;
        }

        // Ukuran cangkang mengikuti tinggi view (ikon bilah status itu kecil).
        float shellHeight = height;
        float shellWidth = shellHeight * 2.05f;
        float radius = Math.max(1.5f, shellHeight * 0.18f);
        float inset = Math.max(1f, density * 0.9f);
        RectF shell = new RectF(0f, 0f, shellWidth, shellHeight);

        // 1. Cangkang kaca + ruas kosong redup.
        fill.setShader(new LinearGradient(0, 0, 0, shellHeight,
                0x330A1018, 0x66060B12, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(shell, radius, radius, fill);
        fill.setShader(null);

        // 2. Kutub baterai (di kanan).
        float nubWidth = Math.max(1.5f, 1.8f * density);
        float nubHeight = shellHeight * 0.36f;
        fill.setColor(SHELL_ON);
        canvas.drawRoundRect(new RectF(shellWidth + 1f * density,
                        (shellHeight - nubHeight) / 2f,
                        shellWidth + 1f * density + nubWidth,
                        (shellHeight + nubHeight) / 2f),
                nubWidth / 2f, nubWidth / 2f, fill);

        // 3. Cairan neon setinggi daya, permukaannya beriak.
        RectF inner = new RectF(shell.left + inset, shell.top + inset,
                shell.right - inset, shell.bottom - inset);
        float level = percent < 0 ? 0f : Math.min(1f, Math.max(0f, percent / 100f));

        if (level > 0.01f) {
            float surface = inner.bottom - inner.height() * level;
            float wave = inner.height() * 0.10f;
            int steps = 10;

            shape.rewind();
            shape.moveTo(inner.left, inner.bottom);
            for (int i = 0; i <= steps; i++) {
                float t = i / (float) steps;
                float px = inner.left + inner.width() * t;
                float py = surface + (float) Math.sin(phase * 6.2831853f + t * 4.712389f) * wave;
                shape.lineTo(px, py);
            }
            shape.lineTo(inner.right, inner.bottom);
            shape.close();

            canvas.save();
            Path clip = new Path();
            clip.addRoundRect(inner, radius * 0.6f, radius * 0.6f, Path.Direction.CW);
            canvas.clipPath(clip);
            fill.setShader(new LinearGradient(0, surface, 0, inner.bottom,
                    LIQUID_TOP, LIQUID_BOTTOM, Shader.TileMode.CLAMP));
            canvas.drawPath(shape, fill);
            fill.setShader(null);

            // Garis tegangan permukaan.
            stroke.setStrokeWidth(Math.max(1f, density * 0.6f));
            stroke.setColor(0xDDEAFBFF);
            Path surfacePath = new Path();
            surfacePath.moveTo(inner.left, surface);
            for (int i = 0; i <= steps; i++) {
                float t = i / (float) steps;
                float px = inner.left + inner.width() * t;
                float py = surface + (float) Math.sin(phase * 6.2831853f + t * 4.712389f) * wave;
                surfacePath.lineTo(px, py);
            }
            canvas.drawPath(surfacePath, stroke);
            canvas.restore();
        } else {
            // Ruas kosong: isi redup seperti LED mati.
            fill.setColor(GHOST);
            canvas.drawRoundRect(inner, radius * 0.6f, radius * 0.6f, fill);
        }

        // 4. Garis cangkang neon + glow.
        stroke.setStrokeWidth(Math.max(1f, density));
        stroke.setColor(SHELL_ON);
        stroke.setMaskFilter(new BlurMaskFilter(1.8f * density, BlurMaskFilter.Blur.NORMAL));
        canvas.drawRoundRect(shell, radius, radius, stroke);
        stroke.setMaskFilter(null);

        // 5. Kilat saat mengisi daya.
        if (charging) {
            drawBolt(canvas, shell);
        }

        // 6. Angka persen.
        text.setTextSize(9.5f * density);
        text.setColor(NEON_CORE);
        text.setShadowLayer(6f * density, 0, 0, NEON);
        Paint.FontMetrics metrics = text.getFontMetrics();
        canvas.drawText(label, shellWidth + nubWidth + 4f * density,
                height / 2f - (metrics.ascent + metrics.descent) / 2f, text);
        text.setShadowLayer(0, 0, 0, 0);
    }

    /** Lambang kilat di tengah baterai saat mengisi daya. */
    private void drawBolt(Canvas canvas, RectF shell) {
        float cx = shell.centerX();
        float cy = shell.centerY();
        float h = shell.height() * 0.66f;
        Path bolt = new Path();
        bolt.moveTo(cx + h * 0.16f, cy - h * 0.5f);
        bolt.lineTo(cx - h * 0.20f, cy + h * 0.06f);
        bolt.lineTo(cx + h * 0.02f, cy + h * 0.06f);
        bolt.lineTo(cx - h * 0.14f, cy + h * 0.5f);
        bolt.lineTo(cx + h * 0.24f, cy - h * 0.04f);
        bolt.lineTo(cx + h * 0.02f, cy - h * 0.04f);
        bolt.close();
        fill.setColor(0xFFEAFBFF);
        fill.setMaskFilter(new BlurMaskFilter(2.2f * getResources().getDisplayMetrics().density,
                BlurMaskFilter.Blur.NORMAL));
        canvas.drawPath(bolt, fill);
        fill.setMaskFilter(null);
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
                phase += delta * 0.35f;
                if (phase > 1f) {
                    phase -= 1f;
                }
                invalidate();
            }
            postDelayed(this, 60L);
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
