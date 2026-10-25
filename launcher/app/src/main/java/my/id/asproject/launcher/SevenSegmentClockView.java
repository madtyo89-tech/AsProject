package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.text.format.DateFormat;
import android.util.AttributeSet;
import android.view.View;

import java.util.Calendar;

/**
 * Jam bergaya **seven segment** (papan angka digital) dengan warna neon.
 *
 * Setiap angka digambar dari 7 ruas (a…g) berbentuk segi enam dengan ujung
 * miring, seperti LED digital sungguhan:
 *
 * <pre>
 *      aaa
 *     f   b
 *     f   b
 *      ggg
 *     e   c
 *     e   c
 *      ddd
 * </pre>
 *
 * Ruas menyala memakai neon cyan dengan glow; ruas padam tetap digambar sangat
 * redup ("ghost") supaya bentuk angkanya terbaca — ciri khas tampilan seven
 * segment. Titik dua berkedip tiap detik.
 *
 * Tidak memakai font apa pun: seluruhnya digambar di Canvas, jadi tampilannya
 * sama di semua perangkat (Android 5 ke atas).
 */
public final class SevenSegmentClockView extends View {

    /** Bit: 6=a 5=b 4=c 3=d 2=e 1=f 0=g */
    private static final int[] SEGMENTS = {
            0b1111110, // 0
            0b0110000, // 1
            0b1101101, // 2
            0b1111001, // 3
            0b0110011, // 4
            0b1011011, // 5
            0b1011111, // 6
            0b1110000, // 7
            0b1111111, // 8
            0b1111011, // 9
    };

    private static final int ON = 0xFF5FD8FF;         // neon cyan
    private static final int ON_CORE = 0xFFE6FBFF;    // inti hampir putih
    private static final int OFF = 0x1F5FD8FF;        // ruas padam (ghost)

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint colonPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path segment = new Path();

    private int hour = -1;
    private int minute = -1;
    private boolean colonOn = true;
    private boolean twentyFour;

    public SevenSegmentClockView(Context context) {
        this(context, null);
    }

    /** Dipakai saat di-inflate dari XML. */
    public SevenSegmentClockView(Context context, AttributeSet attrs) {
        super(context, attrs);
        twentyFour = DateFormat.is24HourFormat(context);
    }

    /** Ikuti perubahan format jam sistem (12/24 jam). */
    public void refreshFormat() {
        twentyFour = DateFormat.is24HourFormat(getContext());
        readTime();
        invalidate();
    }

    private void readTime() {
        Calendar now = Calendar.getInstance();
        int rawHour = now.get(Calendar.HOUR_OF_DAY);
        minute = now.get(Calendar.MINUTE);
        hour = twentyFour ? rawHour : (rawHour % 12 == 0 ? 12 : rawHour % 12);
        colonOn = now.get(Calendar.SECOND) % 2 == 0;
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        float density = getResources().getDisplayMetrics().density;
        int height = MeasureSpec.getSize(heightMeasureSpec);
        if (MeasureSpec.getMode(heightMeasureSpec) != MeasureSpec.EXACTLY) {
            height = Math.round(72 * density);
        }
        float digitHeight = height;
        float thickness = digitHeight * 0.115f;
        float digitWidth = digitHeight * 0.52f;
        float spacing = thickness * 1.7f;
        float colonWidth = thickness * 2.4f;
        float width = 4f * digitWidth + colonWidth + 4f * spacing;
        int measured = MeasureSpec.getSize(widthMeasureSpec);
        if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.EXACTLY) {
            measured = Math.round(width);
        }
        setMeasuredDimension(measured, height);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float width = getWidth();
        float height = getHeight();
        if (width <= 0f || height <= 0f) {
            return;
        }
        if (hour < 0) {
            readTime();
        }

        float thickness = height * 0.115f;
        float digitWidth = height * 0.52f;
        float spacing = thickness * 1.7f;
        float colonWidth = thickness * 2.4f;
        float total = 4f * digitWidth + colonWidth + 4f * spacing;
        float x = (width - total) / 2f;
        float y = 0f;

        // Hanya jam 1 digit (format 12 jam) → geser sedikit agar tetap tengah.
        int[] digits = new int[]{
                hour / 10, hour % 10, -1, minute / 10, minute % 10
        };
        if (hour < 10 && !twentyFour) {
            x += (digitWidth + spacing) / 2f;
        }

        for (int index = 0; index < digits.length; index++) {
            int value = digits[index];
            if (value < 0) {
                drawColon(canvas, x, y, colonWidth, height, thickness);
                x += colonWidth + spacing;
            } else {
                // Angka puluhan jam yang nol dibiarkan kosong seperti papan digital.
                if (!(index == 0 && value == 0 && !twentyFour)) {
                    drawDigit(canvas, x, y, value, digitWidth, height, thickness);
                }
                x += digitWidth + spacing;
            }
        }
    }

    private void drawDigit(Canvas canvas, float x, float y, int value,
                           float w, float h, float t) {
        int bits = SEGMENTS[value < 0 || value > 9 ? 0 : value];
        float half = h / 2f;
        float c = t * 0.5f;

        // a — atas
        segment(bits, 6, canvas, x, y, w, t, true);
        // g — tengah
        segment(bits, 0, canvas, x, y + half - t / 2f, w, t, true);
        // d — bawah
        segment(bits, 3, canvas, x, y + h - t, w, t, true);
        // f — kiri atas
        segment(bits, 1, canvas, x, y + c, half - c, t, false);
        // b — kanan atas
        segment(bits, 5, canvas, x + w - t, y + c, half - c, t, false);
        // e — kiri bawah
        segment(bits, 2, canvas, x, y + half, half - c, t, false);
        // c — kanan bawah
        segment(bits, 4, canvas, x + w - t, y + half, half - c, t, false);
    }

    /** Satu ruas: {@code horizontal} = palang mendatar, selain itu tegak. */
    private void segment(int bits, int bit, Canvas canvas, float x, float y,
                         float length, float t, boolean horizontal) {
        boolean on = ((bits >> bit) & 1) == 1;
        float c = t * 0.5f;
        segment.rewind();
        if (horizontal) {
            segment.moveTo(x + c, y);
            segment.lineTo(x + length - c, y);
            segment.lineTo(x + length, y + c);
            segment.lineTo(x + length - c, y + t);
            segment.lineTo(x + c, y + t);
            segment.lineTo(x, y + c);
        } else {
            segment.moveTo(x, y + c);
            segment.lineTo(x + c, y);
            segment.lineTo(x + t - c, y);
            segment.lineTo(x + t, y + c);
            segment.lineTo(x + t, y + length - c);
            segment.lineTo(x + t - c, y + length);
            segment.lineTo(x + c, y + length);
            segment.lineTo(x, y + length - c);
        }
        segment.close();

        if (on) {
            glow.setColor(ON);
            glow.setMaskFilter(new BlurMaskFilter(t * 1.35f, BlurMaskFilter.Blur.NORMAL));
            canvas.drawPath(segment, glow);
            glow.setMaskFilter(null);
            fill.setColor(ON_CORE);
            canvas.drawPath(segment, fill);
        } else {
            fill.setColor(OFF);
            canvas.drawPath(segment, fill);
        }
    }

    /** Titik dua berkedip. */
    private void drawColon(Canvas canvas, float x, float y, float w, float h, float t) {
        float dot = t * 1.05f;
        float cx = x + (w - dot) / 2f;
        float top = y + h * 0.34f - dot / 2f;
        float bottom = y + h * 0.68f - dot / 2f;
        colonPaint.setColor(colonOn ? ON : OFF);
        if (colonOn) {
            colonPaint.setMaskFilter(new BlurMaskFilter(t * 1.2f, BlurMaskFilter.Blur.NORMAL));
        }
        canvas.drawRect(cx, top, cx + dot, top + dot, colonPaint);
        canvas.drawRect(cx, bottom, cx + dot, bottom + dot, colonPaint);
        colonPaint.setMaskFilter(null);
    }

    // ------------------------------------------------------------- pembaruan

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        readTime();
        post(ticker);
    }

    @Override
    protected void onDetachedFromWindow() {
        removeCallbacks(ticker);
        super.onDetachedFromWindow();
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        super.onVisibilityChanged(changedView, visibility);
        if (visibility == VISIBLE && getHandler() != null
                && !getHandler().hasCallbacks(ticker)) {
            post(ticker);
        }
    }

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            readTime();
            invalidate();
            // Selaraskan ke detik berikutnya agar kedip titik dua tidak melenceng.
            long delay = 1000L - (System.currentTimeMillis() % 1000L);
            postDelayed(this, delay);
        }
    };

    /** Dipakai pengujian: teks jam saat ini, mis. "07:42". */
    public String getTimeText() {
        if (hour < 0) {
            readTime();
        }
        return (hour < 10 ? "0" : "") + hour + ":" + (minute < 10 ? "0" : "") + minute;
    }
}
