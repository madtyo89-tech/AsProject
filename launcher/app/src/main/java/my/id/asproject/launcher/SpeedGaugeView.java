package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.util.AttributeSet;
import android.view.View;

/**
 * Gauge spidometer digital — kaca cair bundar dengan cincin neon bersegmen
 * (gaya sama dengan {@link LiquidBatteryView}) dan angka kecepatan besar di
 * tengah. Dipakai sebagai bubble mengambang oleh {@link SpeedometerService},
 * dan juga dipakai apa adanya kalau suatu saat ditaruh di layar lain.
 */
public final class SpeedGaugeView extends View {

    private static final int SEGMENTS = 24;
    private static final int NEON = 0xFF5FD8FF;
    private static final int NEON_BRIGHT = 0xFFE6FBFF;
    private static final int GHOST = 0x2A5FD8FF;
    private static final int UNIT_COLOR = 0xFFAEEBFF;
    private static final float MAX_SPEED_KMH = 180f;
    private static final float SWEEP_START = 135f;   // mulai kiri-bawah
    private static final float SWEEP_TOTAL = 270f;   // tiga per empat lingkaran
    private static final float KMH_TO_MPH = 0.621371f;

    private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ghost = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glass = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint unitText = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF box = new RectF();

    private float speedKmh = 0f;
    private boolean mph = false;
    private float phase;

    public SpeedGaugeView(Context context) {
        this(context, null);
    }

    public SpeedGaugeView(Context context, AttributeSet attrs) {
        super(context, attrs);
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeCap(Paint.Cap.BUTT);
        ghost.setStyle(Paint.Style.STROKE);
        ghost.setStrokeCap(Paint.Cap.BUTT);
        glass.setStyle(Paint.Style.FILL);
        rim.setStyle(Paint.Style.STROKE);
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typefaces.get(context));
        unitText.setTextAlign(Paint.Align.CENTER);
        unitText.setTypeface(Typefaces.get(context));
    }

    /** Kecepatan asli dalam km/h (dikonversi ke mph saat digambar bila perlu). */
    public void setSpeedKmh(float kmh) {
        this.speedKmh = Math.max(0f, kmh);
        invalidate();
    }

    /** {@code "kmh"} atau {@code "mph"}. */
    public void setUnit(String unit) {
        this.mph = "mph".equals(unit);
        invalidate();
    }

    /** Dipanggil ~15x/detik supaya aliran cair di cincin tetap hidup walau diam. */
    public void tick(float deltaSeconds) {
        phase += deltaSeconds * 0.2f;
        if (phase > 1f) {
            phase -= 1f;
        }
        invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        float density = getResources().getDisplayMetrics().density;
        int fallback = Math.round(118 * density);
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
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float stroke = Math.max(2f, size * 0.09f);
        float radius = size / 2f - stroke / 2f - 2f;
        box.set(cx - radius, cy - radius, cx + radius, cy + radius);

        // Kaca cair dasar + rim light, sama seperti panel HUD/baterai.
        float glassRadius = radius - stroke / 2f - 1f;
        glass.setShader(new RadialGradient(cx, cy - glassRadius * 0.3f, glassRadius * 1.3f,
                new int[]{0xE0101820, 0xF0060A10}, null, Shader.TileMode.CLAMP));
        canvas.drawCircle(cx, cy, glassRadius, glass);
        glass.setShader(null);
        rim.setStrokeWidth(Math.max(1f, size * 0.012f));
        rim.setColor(Accent.shift(0x33FFFFFF));
        canvas.drawCircle(cx, cy, glassRadius, rim);

        float display = convert(speedKmh);
        float max = convert(MAX_SPEED_KMH);
        float level = max <= 0f ? 0f : Math.min(1f, display / max);
        int filled = Math.round(SEGMENTS * level);
        float sweep = SWEEP_TOTAL / SEGMENTS;
        float gap = sweep * 0.22f;

        ring.setShader(new SweepGradient(cx, cy,
                new int[]{Accent.shift(NEON), Accent.shift(NEON_BRIGHT), Accent.shift(NEON)},
                new float[]{0f, 0.5f, 1f}));
        ring.setStrokeWidth(stroke);
        ghost.setStrokeWidth(stroke);
        ghost.setColor(Accent.shift(GHOST));

        for (int i = 0; i < SEGMENTS; i++) {
            float start = SWEEP_START + i * sweep + gap / 2f;
            float length = sweep - gap;
            if (i < filled) {
                float flow = 0.75f + 0.25f * (float) Math.sin(phase * 6.2831853f * 3f - i * 0.5f);
                ring.setAlpha(Math.round(255 * Math.max(0.5f, flow)));
                canvas.drawArc(box, start, length, false, ring);
            } else {
                canvas.drawArc(box, start, length, false, ghost);
            }
        }
        ring.setAlpha(255);
        ring.setShader(null);

        // Angka digital besar di tengah + satuan di bawahnya.
        String label = String.valueOf(Math.round(display));
        text.setTextSize(size * 0.30f);
        text.setColor(Accent.shift(NEON_BRIGHT));
        text.setShadowLayer(size * 0.16f, 0, 0, Accent.shift(NEON));
        Paint.FontMetrics metrics = text.getFontMetrics();
        float baseline = cy - size * 0.02f - (metrics.ascent + metrics.descent) / 2f;
        canvas.drawText(label, cx, baseline, text);
        text.setShadowLayer(0, 0, 0, 0);

        unitText.setTextSize(size * 0.115f);
        unitText.setColor(Accent.shift(UNIT_COLOR));
        canvas.drawText(mph ? "mph" : "km/h", cx, cy + size * 0.27f, unitText);
    }

    private float convert(float kmh) {
        return mph ? kmh * KMH_TO_MPH : kmh;
    }
}
