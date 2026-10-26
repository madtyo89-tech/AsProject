package my.id.asproject.launcher;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.drawable.AdaptiveIconDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.util.LruCache;

import java.util.List;

/**
 * Memuat ikon aplikasi sekali per sesi, lalu menyimpannya di memori (LruCache).
 *
 * Dua gaya dasar:
 *   • Neon (bawaan) — 8 aplikasi populer memakai ikon neon buatan tangan
 *     ({@link NeonIcons}); SEMUA aplikasi lain dibuatkan versi neon otomatis oleh
 *     {@link NeonIconFactory}, sehingga seluruh kisi seragam.
 *   • Asli — ikon aplikasi apa adanya; ikon adaptif (Android 8+) dipotong
 *     squircle supaya rapi di kisi beranda.
 *
 * Per aplikasi pengguna boleh memilih bentuk tile ({@link Prefs#iconStyle}):
 * otomatis (squircle), lingkaran, kotak tegas, atau segi delapan. Folder
 * mendapat ikon sendiri: kaca cair berisi mini-tile dari ikon anggotanya.
 */
public final class IconLoader {

    private final Context context;
    private final PackageManager manager;
    private final Prefs prefs;
    private final LruCache<String, Bitmap> cache;
    private final int sizePx;
    private boolean neonEnabled;

    public IconLoader(Context context, Prefs prefs, int sizePx) {
        this.context = context.getApplicationContext();
        this.manager = context.getPackageManager();
        this.prefs = prefs;
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

    public boolean isNeonEnabled() {
        return neonEnabled;
    }

    public Bitmap get(AppItem item) {
        String cacheKey = cacheKey(item);
        Bitmap cached = cache.get(cacheKey);
        if (cached != null) {
            return cached;
        }
        Bitmap bitmap = item.folder ? renderFolder(item) : render(item);
        cache.put(cacheKey, bitmap);
        return bitmap;
    }

    private String cacheKey(AppItem item) {
        if (item.folder) {
            StringBuilder key = new StringBuilder(item.key).append('@');
            List<AppItem> members = item.members;
            for (int i = 0; i < Math.min(4, members.size()); i++) {
                key.append(members.get(i).key).append(',');
            }
            return key.toString();
        }
        return item.key + "#" + prefs.iconStyle(item.key);
    }

    /** Buang semua ikon (dipakai saat aplikasi dipasang/diperbarui/dicabut). */
    public void clear() {
        cache.evictAll();
    }

    private Bitmap render(AppItem item) {
        String style = prefs.iconStyle(item.key);
        Drawable drawable = loadDrawable(item);

        if (neonEnabled && !"asli".equals(style)) {
            int handcrafted = NeonIcons.drawableFor(item.packageName);
            if (handcrafted != 0) {
                Bitmap neon = renderResource(handcrafted);
                if (neon != null) {
                    return neon;
                }
            }
            Bitmap generated = NeonIconFactory.create(drawable, sizePx, item.key, style);
            if (generated != null) {
                return generated;
            }
        }

        Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && drawable instanceof AdaptiveIconDrawable) {
            canvas.clipPath(tileMask(style));
        }
        drawable.setBounds(0, 0, sizePx, sizePx);
        drawable.draw(canvas);
        return bitmap;
    }

    /**
     * Ikon folder: tile kaca cair sirkuit berisi kisi 2×2 mini-ikon dari
     * anggotanya (sampai 4), supaya sekilas kelihatan isinya tanpa dibuka.
     */
    private Bitmap renderFolder(AppItem item) {
        Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        NeonIconFactory.drawFolderShell(canvas, sizePx);

        List<AppItem> members = item.members;
        int count = Math.min(4, members.size());
        float pad = sizePx * 0.17f;
        float gap = sizePx * 0.045f;
        float cell = (sizePx - pad * 2 - gap) / 2f;
        Paint clipPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < count; i++) {
            Bitmap icon = get(members.get(i));
            if (icon == null) {
                continue;
            }
            float col = i % 2;
            float row = i / 2;
            float left = pad + col * (cell + gap);
            float top = pad + row * (cell + gap);
            RectF dest = new RectF(left, top, left + cell, top + cell);
            canvas.save();
            Path mini = new Path();
            float r = cell * 0.22f;
            mini.addRoundRect(dest, r, r, Path.Direction.CW);
            canvas.clipPath(mini);
            canvas.drawBitmap(icon, null, dest, clipPaint);
            canvas.restore();
        }
        return bitmap;
    }

    private Drawable loadDrawable(AppItem item) {
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
        return drawable;
    }

    private Bitmap renderResource(int resId) {
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

    private Path tileMask(String style) {
        return NeonIconFactory.tilePath(sizePx, style);
    }
}
