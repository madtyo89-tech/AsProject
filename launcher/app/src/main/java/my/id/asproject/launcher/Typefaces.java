package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Typeface;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

/**
 * Font utama launcher: **Share Tech Mono** — huruf monospace bergaya terminal
 * yang senada dengan tema sirkuit neon.
 *
 * Berkasnya ikut terpasang di APK (`assets/fonts/tech_mono.ttf`, lisensi
 * OFL-1.1), jadi tampilannya sama di semua perangkat dan tidak bergantung pada
 * font sistem. Kalau berkasnya tidak ada, jatuh ke {@link Typeface#MONOSPACE}.
 */
public final class Typefaces {

    private static final String PATH = "fonts/tech_mono.ttf";

    private static Typeface cached;
    private static boolean tried;

    private Typefaces() {
    }

    /** Font tema; tidak pernah null (paling buruk memakai monospace sistem). */
    public static Typeface get(Context context) {
        if (cached == null && !tried) {
            tried = true;
            try {
                cached = Typeface.createFromAsset(context.getAssets(), PATH);
            } catch (RuntimeException ignored) {
                cached = null;
            }
            if (cached == null) {
                cached = Typeface.MONOSPACE;
            }
        }
        if (cached == null) {
            cached = Typeface.MONOSPACE;
        }
        return cached;
    }

    /** Pasang font tema ke satu TextView. */
    public static void apply(Context context, TextView view) {
        if (view != null) {
            view.setTypeface(get(context));
        }
    }

    /**
     * Pasang font tema ke seluruh TextView di dalam sebuah view (menelusuri
     * anaknya sampai habis). Jam seven segment dilewati karena ia menggambar
     * angkanya sendiri di Canvas.
     */
    public static void apply(Context context, View root) {
        if (root == null) {
            return;
        }
        if (root instanceof SevenSegmentClockView) {
            return;
        }
        if (root instanceof TextView) {
            ((TextView) root).setTypeface(get(context));
            return;
        }
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                apply(context, group.getChildAt(i));
            }
        }
    }
}
