package my.id.asproject.launcher;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.drawable.AdaptiveIconDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.util.LruCache;


/**
 * Memuat ikon aplikasi sekali per sesi, lalu menyimpannya di memori (LruCache).
 *
 * Ikon adaptif (Android 8+) digambar dengan topeng squircle supaya tampil rapi di
 * kisi beranda — sama seperti peluncur bawaan Pixel.
 */
public final class IconLoader {

    private final Context context;
    private final PackageManager manager;
    private final LruCache<String, Bitmap> cache;
    private final int sizePx;
    private boolean neonEnabled;

    public IconLoader(Context context, int sizePx) {
        this.context = context.getApplicationContext();
        this.manager = context.getPackageManager();
        this.sizePx = sizePx;

        long maxKb = Runtime.getRuntime().maxMemory() / 1024L;
        int budgetKb = (int) Math.max(512L, Math.min(16L * 1024L, maxKb / 8L));
        this.cache = new LruCache<String, Bitmap>(budgetKb) {
            @Override
            protected int sizeOf(String key, Bitmap value) {
                return Math.max(1, value.getByteCount() / 1024);
            }
        };
    }

    /** Nyalakan/matikan ikon neon; cache dibuang bila statusnya berubah. */
    public void setNeonEnabled(boolean enabled) {
        if (this.neonEnabled != enabled) {
            this.neonEnabled = enabled;
            cache.evictAll();
        }
    }

    public Bitmap get(AppItem item) {
        Bitmap cached = cache.get(item.key);
        if (cached != null) {
            return cached;
        }
        Bitmap bitmap = render(item);
        cache.put(item.key, bitmap);
        return bitmap;
    }

    /** Buang semua ikon (dipakai saat aplikasi dipasang/diperbarui/dicabut). */
    public void clear() {
        cache.evictAll();
    }

    private Bitmap render(AppItem item) {
        if (neonEnabled) {
            int neonRes = NeonIcons.drawableFor(item.packageName);
            if (neonRes != 0) {
                Bitmap neon = renderNeon(neonRes);
                if (neon != null) {
                    return neon;
                }
            }
        }
        Drawable drawable = null;
        try {
            drawable = manager.getActivityIcon(new ComponentName(item.packageName, item.activityName));
        } catch (PackageManager.NameNotFoundException notFound) {
            // ikon bawaan sistem dipakai di bawah
        } catch (RuntimeException ignored) {
            // idem
        }
        if (drawable == null) {
            drawable = manager.getDefaultActivityIcon();
        }

        Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && drawable instanceof AdaptiveIconDrawable) {
            canvas.clipPath(squircle());
        }
        drawable.setBounds(0, 0, sizePx, sizePx);
        drawable.draw(canvas);
        return bitmap;
    }

    private Bitmap renderNeon(int resId) {
        try {
            Drawable drawable = context.getResources().getDrawable(resId);
            if (drawable == null) {
                return null;
            }
            Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, sizePx, sizePx);
            drawable.draw(canvas);
            return bitmap;
        } catch (RuntimeException error) {
            return null;
        }
    }

    private Path squircle() {
        Path mask = new Path();
        float radius = sizePx * 0.24f;
        mask.addRoundRect(new RectF(0, 0, sizePx, sizePx), radius, radius, Path.Direction.CW);
        return mask;
    }
}
