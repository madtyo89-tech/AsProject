package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;

/**
 * Indikator baterai pojok kanan atas bergaya <b>liquid glass sirkuit</b>.
 *
 * Lapisan yang digambar, dari bawah ke atas:
 *  1. Kapsul kaca cair — gradien gelap tembus pandang + sorotan atas + rim light.
 *  2. Jejak sirkuit etsa — dua garis siku kecil di ujung kapsul.
 *  3. Sapuan cair (sheen) yang bergerak pelan melintasi kaca.
 *  4. Ikon baterai: cangkang kaca, lalu <b>cairan neon</b> yang permukaannya
 *     beriak mengikuti gelombang sinus; saat mengisi daya muncul kilat di tengah.
 *  5. Teks persen monospace dengan glow tipis.
 *
 * Tidak memakai OpenGL: seluruhnya Canvas 2D, aman untuk API 21+.
 */
public final class LiquidBatteryView extends View {

    private static final int GLASS_TOP = 0x66243033;
    private static final int GLASS_BOTTOM = 0xB304070B;
    private static final int RIM_TOP = 0xCCBFEFFF;
    private static final int RIM_BOTTOM = 0x4A6FA8C0;
    private static final int LIQUID_TOP = 0xFF8FE6FF;
    private static final int LIQUID_BOTTOM = 0xE62090C8;
    private static final int SHELL = 0xAA7FD8FF;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);

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
        text.setTextAlign(Paint.Align.LEFT);
        stroke.setStyle(Paint.Style.STROKE);
        glow.setStyle(Paint.Style.FILL);
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
            height = Math.round(26 * density);
        }
        int width = MeasureSpec.getSize(widthMeasureSpec);
        if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.EXACTLY) {
            text.setTextSize(10f * density);
            width = Math.round((8f + 22f + 6f) * density + text.measureText(label)
                    + 10f * density);
        }
        setMeasuredDimension(width, height);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float width = getWidth();
        float height = getHeight();
        if (width <= 0 || height <= 0) {
            return;
        }
        float radius = height / 2f;
        RectF box = new RectF(0.5f * density, 0.5f * density,
                width - 0.5f * density, height - 0.5f * density);
        Path capsule = new Path();
        capsule.addRoundRect(box, radius, radius, Path.Direction.CW);

        drawGlass(canvas, box, radius, density, width, height);
        drawEtchedCircuits(canvas, width, height, density);
        drawSheen(canvas, box, radius, width, density);

        float left = 8f * density;
        float shellWidth = 22f * density;
        float shellHeight = 11f * density;
        float shellTop = (height - shellHeight) / 2f;
        drawBattery(canvas, left, shellTop, shellWidth, shellHeight, density);

        text.setTextSize(10f * density);
        text.setColor(0xFFEAFBFF);
        text.setShadowLayer(6f * density, 0, 0, 0x997FD8FF);
        float textX = left + shellWidth + 6f * density;
        Paint.FontMetrics metrics = text.getFontMetrics();
        canvas.drawText(label, textX, height / 2f - (metrics.ascent + metrics.descent) / 2f, text);
        text.setShadowLayer(0, 0, 0, 0);

        // rim terakhir agar tidak tertutup isi
        stroke.setShader(new LinearGradient(0, 0, 0, height, RIM_TOP, RIM_BOTTOM,
                Shader.TileMode.CLAMP));
        stroke.setStrokeWidth(Math.max(1f, density));
        canvas.drawRoundRect(box, radius, radius, stroke);
        stroke.setShader(null);
    }

    // ------------------------------------------------------------- kaca cair

    private void drawGlass(Canvas canvas, RectF box, float radius, float density,
                           float width, float height) {
        canvas.save();
        Path clip = new Path();
        clip.addRoundRect(box, radius, radius, Path.Direction.CW);
        canvas.clipPath(clip);

        fill.setShader(new LinearGradient(0, 0, 0, height, GLASS_TOP, GLASS_BOTTOM,
                Shader.TileMode.CLAMP));
        canvas.drawRect(box, fill);

        // Sorotan atas: bagian kaca yang membusung.
        fill.setShader(new RadialGradient(width * 0.42f, -height * 0.35f, height * 1.15f,
                0x59E8FBFF, 0x00000000, Shader.TileMode.CLAMP));
        canvas.drawRect(box, fill);

        // Kilau bawah-kanan (pantulan ganda krom cair).
        fill.setShader(new RadialGradient(width * 0.95f, height * 1.15f, height * 0.75f,
                0x2E58B4E8, 0x00000000, Shader.TileMode.CLAMP));
        canvas.drawRect(box, fill);
        canvas.restore();
        fill.setShader(null);
    }

    /** Jejak sirkuit terukir di kaca: garis siku + pad di kedua ujung. */
    private void drawEtchedCircuits(Canvas canvas, float width, float height, float density) {
        stroke.setShader(null);
        stroke.setStrokeWidth(Math.max(1f, density * 0.8f));
        stroke.setColor(0x4A7FD8FF);
        stroke.setStrokeCap(Paint.Cap.ROUND);

        Path left = new Path();
        left.moveTo(2.6f * density, height * 0.72f);
        left.lineTo(2.6f * density, height * 0.30f);
        left.lineTo(width * 0.045f, height * 0.30f);
        canvas.drawPath(left, stroke);

        Path right = new Path();
        right.moveTo(width - 2.6f * density, height * 0.28f);
        right.lineTo(width - 2.6f * density, height * 0.70f);
        right.lineTo(width * 0.955f, height * 0.70f);
        canvas.drawPath(right, stroke);

        glow.setColor(0x99BFEFFF);
        canvas.drawCircle(width * 0.045f, height * 0.30f, density, glow);
        canvas.drawCircle(width * 0.955f, height * 0.70f, density, glow);
    }

    /** Sapuan terang yang bergerak pelan — memberi kesan permukaan cair. */
    private void drawSheen(Canvas canvas, RectF box, float radius, float width, float density) {
        float span = width * 2.2f;
        float shift = (phase % 1f) * span - width * 0.6f;
        canvas.save();
        Path clip = new Path();
        clip.addRoundRect(box, radius, radius, Path.Direction.CW);
        canvas.clipPath(clip);
        fill.setShader(new LinearGradient(shift, 0, shift + width * 0.55f, box.height(),
                new int[]{0x00000000, 0x2FBFE9FF, 0x00000000},
                new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(box, fill);
        canvas.restore();
        fill.setShader(null);
    }

    // --------------------------------------------------------------- baterai

    private void drawBattery(Canvas canvas, float left, float top,
                             float shellWidth, float shellHeight, float density) {
        float shellRadius = Math.max(1.5f, shellHeight * 0.26f);
        RectF shell = new RectF(left, top, left + shellWidth, top + shellHeight);

        // Cangkang kaca baterai.
        fill.setShader(new LinearGradient(0, top, 0, top + shellHeight,
                0x330A1018, 0x66060B12, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(shell, shellRadius, shellRadius, fill);
        fill.setShader(null);

        // Kutub baterai.
        float nubWidth = Math.max(1.5f, 2f * density);
        float nubHeight = shellHeight * 0.42f;
        fill.setColor(SHELL);
        canvas.drawRoundRect(new RectF(left + shellWidth + 1.2f * density,
                        top + (shellHeight - nubHeight) / 2f,
                        left + shellWidth + 1.2f * density + nubWidth,
                        top + (shellHeight + nubHeight) / 2f),
                nubWidth / 2f, nubWidth / 2f, fill);

        // Cairan neon setinggi daya, permukaannya beriak.
        float level = percent < 0 ? 0f : Math.min(1f, Math.max(0f, percent / 100f));
        float inset = Math.max(1f, density * 1.2f);
        RectF inner = new RectF(shell.left + inset, shell.top + inset,
                shell.right - inset, shell.bottom - inset);
        float innerRadius = shellRadius * 0.62f;

        if (level > 0.01f) {
            float fillHeight = inner.height() * level;
            float surface = inner.bottom - fillHeight;
            float wave = inner.height() * 0.055f;

            Path liquid = new Path();
            liquid.moveTo(inner.left, inner.bottom);
            liquid.lineTo(inner.left, surface);
            int steps = 12;
            for (int i = 0; i <= steps; i++) {
                float t = i / (float) steps;
                float x = inner.left + inner.width() * t;
                float y = surface + (float) Math.sin(phase * 6.2831853f + t * 4.712389f) * wave;
                liquid.lineTo(x, y);
            }
            liquid.lineTo(inner.right, inner.bottom);
            liquid.close();

            canvas.save();
            Path innerClip = new Path();
            innerClip.addRoundRect(inner, innerRadius, innerRadius, Path.Direction.CW);
            canvas.clipPath(innerClip);

            fill.setShader(new LinearGradient(0, surface, 0, inner.bottom,
                    LIQUID_TOP, LIQUID_BOTTOM, Shader.TileMode.CLAMP));
            canvas.drawPath(liquid, fill);
            fill.setShader(null);

            // Garis tegangan permukaan: pita terang tepat di batas cairan.
            stroke.setShader(null);
            stroke.setColor(0xCCEAFBFF);
            stroke.setStrokeWidth(Math.max(1f, density * 0.7f));
            Path surfacePath = new Path();
            surfacePath.moveTo(inner.left, surface);
            for (int i = 0; i <= steps; i++) {
                float t = i / (float) steps;
                float x = inner.left + inner.width() * t;
                float y = surface + (float) Math.sin(phase * 6.2831853f + t * 4.712389f) * wave;
                surfacePath.lineTo(x, y);
            }
            canvas.drawPath(surfacePath, stroke);
            canvas.restore();
        }

        // Cangkang luar + glow neon.
        stroke.setShader(null);
        stroke.setStrokeWidth(Math.max(1f, density));
        stroke.setColor(SHELL);
        stroke.setMaskFilter(new BlurMaskFilter(1.6f * density, BlurMaskFilter.Blur.NORMAL));
        canvas.drawRoundRect(shell, shellRadius, shellRadius, stroke);
        stroke.setMaskFilter(null);

        if (charging) {
            drawBolt(canvas, shell, density);
        }
    }

    /** Lambang kilat saat mengisi daya. */
    private void drawBolt(Canvas canvas, RectF shell, float density) {
        float cx = shell.centerX();
        float cy = shell.centerY();
        float h = shell.height() * 0.62f;
        Path bolt = new Path();
        bolt.moveTo(cx + h * 0.16f, cy - h * 0.5f);
        bolt.lineTo(cx - h * 0.20f, cy + h * 0.06f);
        bolt.lineTo(cx + h * 0.02f, cy + h * 0.06f);
        bolt.lineTo(cx - h * 0.14f, cy + h * 0.5f);
        bolt.lineTo(cx + h * 0.24f, cy - h * 0.04f);
        bolt.lineTo(cx + h * 0.02f, cy - h * 0.04f);
        bolt.close();

        glow.setColor(0xFFEAFBFF);
        glow.setMaskFilter(new BlurMaskFilter(2.4f * density, BlurMaskFilter.Blur.NORMAL));
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
                phase += delta * 0.28f;   // kira-kira satu sapuan per 3,6 detik
                if (phase > 1f) {
                    phase -= 1f;
                }
                invalidate();
            }
            postDelayed(this, 50L);
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
