package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.View;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * HUD "SECURE MONITOR" yang hidup: cincin berputar, garis pindai, gelombang suara,
 * dan bacaan yang benar-benar mengikuti perangkat — jam (setiap detik), daya
 * baterai, serta suhu baterai.
 *
 * Semua gambar dilakukan manual di Canvas (tanpa pustaka animasi) dan hanya
 * berjalan saat HUD terlihat.
 */
public final class HudView extends View implements Choreographer.FrameCallback {

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF box = new RectF();
    private final Path path = new Path();
    private final float density;

    private final SimpleDateFormat clock24 = new SimpleDateFormat("HH:mm", Locale.getDefault());
    private String clockText = "--:--";
    private long lastClockSecond = -1L;

    private boolean animating;
    private boolean attached;
    private long startNanos;
    private float phase;

    private int batteryPercent = -1;
    private boolean charging;
    private float batteryTempC = Float.NaN;
    private long lastValueUpdate;
    private float latency = 0.2f;
    private float integrity = 98.2f;
    private String latencyText = "EST 0.22 ms";
    private String integrityText = "98.2%";
    private String temperatureText = "--.-";

    public HudView(Context context) {
        this(context, null);
    }

    /** Dipakai saat di-inflate dari XML (view_lock_screen.xml). */
    public HudView(Context context, android.util.AttributeSet attrs) {
        super(context, attrs);
        density = getResources().getDisplayMetrics().density;
        text.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL));
        stroke.setStyle(Paint.Style.STROKE);
        setWillNotDraw(false);
    }

    // ------------------------------------------------------------------ data

    public void setBattery(int percent, boolean charging, float temperatureC) {
        this.batteryPercent = percent;
        this.charging = charging;
        this.batteryTempC = temperatureC;
        this.temperatureText = Float.isNaN(temperatureC)
                ? "--.-" : String.format(Locale.US, "%.1f", temperatureC);
        invalidate();
    }

    // ------------------------------------------------------------- animasi

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        attached = true;
        start();
    }

    @Override
    protected void onDetachedFromWindow() {
        attached = false;
        stop();
        super.onDetachedFromWindow();
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        super.onVisibilityChanged(changedView, visibility);
        if (visibility == VISIBLE) {
            start();
        } else {
            stop();
        }
    }

    private void start() {
        if (animating || !attached) {
            return;
        }
        animating = true;
        startNanos = 0L;
        Choreographer.getInstance().postFrameCallback(this);
    }

    private void stop() {
        if (!animating) {
            return;
        }
        animating = false;
        Choreographer.getInstance().removeFrameCallback(this);
    }

    @Override
    public void doFrame(long frameTimeNanos) {
        if (!animating) {
            return;
        }
        if (startNanos == 0L) {
            startNanos = frameTimeNanos;
        }
        phase = (frameTimeNanos - startNanos) / 1_000_000_000f;
        long wall = System.currentTimeMillis();
        long second = wall / 1000L;
        if (second != lastClockSecond) {
            lastClockSecond = second;
            clockText = clock24.format(new Date(wall));
        }
        long now = SystemClock.elapsedRealtime();
        if (now - lastValueUpdate > 700L) {
            lastValueUpdate = now;
            // Angka "jaringan" sedikit berubah agar terasa hidup; nilaianya
            // deterministik dan tidak mengklaim mengukur apa pun yang nyata.
            float wobble = (float) Math.sin(phase * 2.7f) * 0.06f
                    + (float) Math.cos(phase * 1.3f) * 0.04f;
            latency = Math.max(0.1f, 0.22f + wobble);
            float base = batteryPercent < 0 ? 99.0f : 95f + batteryPercent * 0.04f;
            integrity = Math.min(99.9f, base + wobble * 6f);
            latencyText = String.format(Locale.US, "EST %.2f ms", latency);
            integrityText = String.format(Locale.US, "%.1f%%", integrity);
        }
        Choreographer.getInstance().postFrameCallbackDelayed(this, 16);
        invalidate();
    }

    // ------------------------------------------------------------------ gambar

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int width = getWidth();
        int height = getHeight();
        if (width == 0 || height == 0) {
            return;
        }
        float pad = 6f * density;
        box.set(pad, pad, width - pad, height - pad);

        drawPanel(canvas, box);
        drawScanLine(canvas, box);
        drawLeftColumn(canvas, box);
        drawRightColumn(canvas, box);
        drawGauge(canvas, box);
        drawWaveform(canvas, box);
        drawCorners(canvas, box);
    }

    private void drawPanel(Canvas canvas, RectF frame) {
        float radius = 9f * density;
        Path clip = new Path();
        clip.addRoundRect(frame, radius, radius, Path.Direction.CW);

        // Kaca cair: dasar gradien gelap + sorotan atas + sapuan cair pelan.
        paint.setStyle(Paint.Style.FILL);
        canvas.save();
        canvas.clipPath(clip);
        paint.setShader(new LinearGradient(0, frame.top, 0, frame.bottom,
                Accent.shift(0xF0131B25), Accent.shift(0xF004070B), Shader.TileMode.CLAMP));
        canvas.drawRect(frame, paint);
        paint.setShader(new RadialGradient(frame.centerX(),
                frame.top - frame.height() * 0.35f, frame.height() * 1.1f,
                Accent.shift(0x2EE8FBFF), Accent.shift(0x00000000), Shader.TileMode.CLAMP));
        canvas.drawRect(frame, paint);
        float band = frame.width() * 0.55f;
        float shift = frame.left - band + (phase - (float) Math.floor(phase))
                * (frame.width() + band * 2f);
        paint.setShader(new LinearGradient(shift, frame.top, shift + band, frame.bottom,
                new int[]{Accent.shift(0x00000000), Accent.shift(0x1A8FD4FF), Accent.shift(0x00000000)},
                new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(frame, paint);
        paint.setShader(null);
        canvas.restore();

        // Tepi kaca: rim lebih terang di atas daripada bawah.
        stroke.setShader(new LinearGradient(0, frame.top, 0, frame.bottom,
                Accent.shift(0x99BFEFFF), Accent.shift(0x446FA8C0), Shader.TileMode.CLAMP));
        stroke.setStrokeWidth(1f * density);
        canvas.drawRoundRect(frame, radius, radius, stroke);
        stroke.setShader(null);

        // Garis pemisah tipis di bawah judul.
        stroke.setColor(Accent.shift(0x33A8E6FF));
        canvas.drawLine(frame.left + 8 * density, frame.top + 20 * density,
                frame.right - 8 * density, frame.top + 20 * density, stroke);
    }

    private void drawCorners(Canvas canvas, RectF frame) {
        float arm = 12f * density;
        stroke.setColor(Accent.shift(0xCC7FD8FF));
        stroke.setStrokeWidth(1.6f * density);
        // kiri atas
        canvas.drawLine(frame.left, frame.top, frame.left + arm, frame.top, stroke);
        canvas.drawLine(frame.left, frame.top, frame.left, frame.top + arm, stroke);
        // kanan atas
        canvas.drawLine(frame.right, frame.top, frame.right - arm, frame.top, stroke);
        canvas.drawLine(frame.right, frame.top, frame.right, frame.top + arm, stroke);
        // kiri bawah
        canvas.drawLine(frame.left, frame.bottom, frame.left + arm, frame.bottom, stroke);
        canvas.drawLine(frame.left, frame.bottom, frame.left, frame.bottom - arm, stroke);
        // kanan bawah
        canvas.drawLine(frame.right, frame.bottom, frame.right - arm, frame.bottom, stroke);
        canvas.drawLine(frame.right, frame.bottom, frame.right, frame.bottom - arm, stroke);
    }

    /** Garis pindai yang bergerak bolak-balik di dalam panel. */
    private void drawScanLine(Canvas canvas, RectF frame) {
        float travel = (float) ((Math.sin(phase * 1.8f) + 1f) / 2f);
        float x = frame.left + 10 * density + travel * (frame.width() - 20 * density);
        paint.setShader(new LinearGradient(x - 34 * density, 0, x + 34 * density, 0,
                new int[]{Accent.shift(0x00000000), Accent.shift(0x557FD8FF), Accent.shift(0x00000000)},
                new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(x - 34 * density, frame.top + 2 * density,
                x + 34 * density, frame.bottom - 2 * density, paint);
        paint.setShader(null);
    }

    private void drawLeftColumn(Canvas canvas, RectF frame) {
        float x = frame.left + 12 * density;
        float top = frame.top + 30 * density;
        float lineHeight = 15f * density;

        label(canvas, "SYS STATUS", x, top, Accent.shift(0x99A8C7D8), 7.6f);
        value(canvas, "ONLINE", x + 58 * density, top, Accent.shift(0xFFB3E8FF), 8.6f);

        // titik status berkedip
        boolean on = ((int) (phase * 2f)) % 2 == 0;
        paint.setColor(on ? Accent.shift(0xFF7FD8FF) : Accent.shift(0x3360A0C0));
        canvas.drawCircle(x + 50 * density, top + 1.2f * density, 2.6f * density, paint);

        label(canvas, "BIO-LOCK", x, top + lineHeight, Accent.shift(0x99A8C7D8), 7.6f);
        value(canvas, "ARMED", x + 58 * density, top + lineHeight, Accent.shift(0xFFB3E8FF), 8.6f);

        label(canvas, "POWER", x, top + lineHeight * 2, Accent.shift(0x99A8C7D8), 7.6f);
        String percent = batteryPercent < 0 ? "--" : String.valueOf(batteryPercent);
        value(canvas, percent + "%", x + 58 * density, top + lineHeight * 2,
                charging ? Accent.shift(0xFFB6FFCF) : Accent.shift(0xFFB3E8FF), 8.6f);

        // Catatan: dulu di sini ada 6 sel baterai. Ikon baterai kini hanya satu,
        // di bilah status (LiquidBatteryView), jadi HUD cukup menampilkan angkanya.
    }

    private void drawRightColumn(Canvas canvas, RectF frame) {
        float right = frame.right - 12 * density;
        float top = frame.top + 30 * density;
        float lineHeight = 15f * density;

        // Label ditaruh cukup jauh dari nilai (kanan) agar tidak bertumpuk pada
        // lebar layar kecil; "INTEGRITY" disingkat supaya tetap muat.
        float labelX = right - 62 * density;
        textRight(canvas, "TEMP", labelX, top, Accent.shift(0x99A8C7D8), 7.6f);
        textRight(canvas, temperatureText + "\u00B0C", right, top, Accent.shift(0xFFB3E8FF), 8.6f);

        textRight(canvas, "SIGNAL", labelX, top + lineHeight, Accent.shift(0x99A8C7D8), 7.6f);
        textRight(canvas, "LINK OK", right, top + lineHeight, Accent.shift(0xFFB3E8FF), 8.6f);

        textRight(canvas, "INTEGR", labelX, top + lineHeight * 2, Accent.shift(0x99A8C7D8), 7.6f);
        textRight(canvas, integrityText, right, top + lineHeight * 2, Accent.shift(0xFFB3E8FF), 8.6f);
    }

    /** Cincin tengah: busur berputar + jam besar + latensi. */
    private void drawGauge(Canvas canvas, RectF frame) {
        float cx = frame.centerX();
        float cy = frame.top + 62 * density;
        float radius = 34f * density;

        stroke.setStrokeWidth(1.2f * density);
        stroke.setColor(Accent.shift(0x336FA8C0));
        canvas.drawCircle(cx, cy, radius, stroke);

        stroke.setColor(Accent.shift(0x557FD8FF));
        stroke.setStrokeWidth(1.6f * density);
        canvas.drawCircle(cx, cy, radius * 0.78f, stroke);

        // Busur berputar (arah berbeda-beda)
        RectF arc = new RectF(cx - radius, cy - radius, cx + radius, cy + radius);
        stroke.setStrokeWidth(2.2f * density);
        stroke.setColor(Accent.shift(0xDD7FD8FF));
        float startA = (phase * 90f) % 360f;
        canvas.drawArc(arc, startA, 52f, false, stroke);

        RectF inner = new RectF(cx - radius * 0.78f, cy - radius * 0.78f,
                cx + radius * 0.78f, cy + radius * 0.78f);
        stroke.setStrokeWidth(2f * density);
        stroke.setColor(Accent.shift(0xAA4FA8D8));
        float startB = 360f - (phase * 130f) % 360f;
        canvas.drawArc(inner, startB, 34f, false, stroke);

        // titik orbit
        double angle = phase * 1.4f;
        paint.setColor(Accent.shift(0xFFB3E8FF));
        canvas.drawCircle(cx + (float) Math.cos(angle) * radius,
                cy + (float) Math.sin(angle) * radius, 2.2f * density, paint);

        // denyut halus
        float pulse = 1f + 0.06f * (float) Math.sin(phase * 4f);
        stroke.setStrokeWidth(1f * density);
        stroke.setColor(Accent.shift(0x557FD8FF));
        canvas.drawCircle(cx, cy, radius * 0.62f * pulse, stroke);

        // Jam — diperbarui tiap detik (bukan tiap frame) agar hemat CPU.
        text.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        text.setColor(Accent.shift(0xFFE9FBFF));
        text.setTextSize(19f * density);
        text.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(clockText, cx, cy + 3f * density, text);
        text.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL));

        text.setColor(Accent.shift(0x99A8C7D8));
        text.setTextSize(6.6f * density);
        canvas.drawText("SECURE LINK", cx, cy + 13f * density, text);
        text.setColor(Accent.shift(0xFFB3E8FF));
        text.setTextSize(7.4f * density);
        canvas.drawText(latencyText, cx, cy + 22f * density, text);
        text.setTextAlign(Paint.Align.LEFT);
    }

    /** Gelombang "audio" kecil di bawah panel. */
    private void drawWaveform(Canvas canvas, RectF frame) {
        int bars = 14;
        float span = frame.right - frame.left - 24 * density;
        float step = span / bars;
        float baseY = frame.bottom - 14f * density;
        for (int i = 0; i < bars; i++) {
            float amp = 3f + 9f * Math.abs((float) Math.sin(phase * 3.2f + i * 0.7f)
                    * (float) Math.cos(phase * 1.1f + i * 0.35f));
            float x = frame.left + 12 * density + i * step;
            paint.setColor(i % 3 == 0 ? Accent.shift(0xCC7FD8FF) : Accent.shift(0x777FD8FF));
            canvas.drawRect(x, baseY - amp * density, x + step * 0.45f, baseY, paint);
        }
    }

    // ------------------------------------------------------------------ teks

    private void label(Canvas canvas, String value, float x, float y, int color, float sizeSp) {
        text.setColor(color);
        text.setTextSize(sizeSp * density);
        text.setTextAlign(Paint.Align.LEFT);
        canvas.drawText(value, x, y, text);
    }

    private void value(Canvas canvas, String value, float x, float y, int color, float sizeSp) {
        text.setColor(color);
        text.setTextSize(sizeSp * density);
        text.setTextAlign(Paint.Align.LEFT);
        canvas.drawText(value, x, y + 2.4f * density, text);
    }

    private void textRight(Canvas canvas, String value, float x, float y, int color, float sizeSp) {
        text.setColor(color);
        text.setTextSize(sizeSp * density);
        text.setTextAlign(Paint.Align.RIGHT);
        canvas.drawText(value, x, y + 2.4f * density, text);
        text.setTextAlign(Paint.Align.LEFT);
    }
}
