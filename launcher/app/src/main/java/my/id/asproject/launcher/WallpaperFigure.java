package my.id.asproject.launcher;

import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.util.LruCache;

import java.io.IOException;
import java.io.InputStream;

/**
 * Wallpaper bawaan AsProject ("liquid chrome + sirkuit neon") dan cara menggambarnya.
 *
 * Aset berada di `assets/wallpaper/`:
 *   • lock.jpg — frame liquid-chrome kosong di tengah  → dipakai di layar kunci
 *   • home.jpg — liquid chrome + HUD status di bawah   → dipakai di beranda
 *
 * Dua mode gambar:
 *   • CONTAIN — seluruh gambar terlihat (bingkai tidak terpotong), sisa ruang diisi
 *     warna tepi gambar sehingga menyatu dengan latar gelap. Dipakai untuk layar kunci.
 *   • COVER   — mengisi penuh layar, dipotong di tepi. Dipakai untuk beranda.
 */
public final class WallpaperFigure {

    public static final String ASSET_LOCK = "wallpaper/lock.jpg";
    public static final String ASSET_HOME = "wallpaper/home.jpg";

    private static final Paint PAINT = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);

    /** Cache kecil: satu bitmap per (aset, lebar). Bitmap lama didaur ulang. */
    private static final LruCache<String, Bitmap> CACHE = new LruCache<String, Bitmap>(2) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return 1;
        }
        // Bitmap sengaja TIDAK didaur ulang di sini: satu bitmap bisa masih dipakai
        // View saat entri lain menggantikannya. Biarkan GC yang membersihkan.
    };

    private WallpaperFigure() {
    }

    /** @return bitmap siap gambar, atau null bila aset tidak ada (mis. build tanpa aset). */
    public static Bitmap load(Context context, String asset, int targetWidth) {
        String key = asset + "@" + targetWidth;
        Bitmap cached = CACHE.get(key);
        if (cached != null) {
            return cached;
        }
        Bitmap bitmap = decode(context, asset, targetWidth);
        if (bitmap != null) {
            CACHE.put(key, bitmap);
        }
        return bitmap;
    }

    private static Bitmap decode(Context context, String asset, int targetWidth) {
        AssetManager assets = context.getAssets();
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try {
            InputStream stream = assets.open(asset);
            try {
                BitmapFactory.decodeStream(stream, null, bounds);
            } finally {
                stream.close();
            }
        } catch (IOException missing) {
            return null;
        }
        if (bounds.outWidth <= 0) {
            return null;
        }

        int sample = 1;
        while (bounds.outWidth / (sample * 2) >= targetWidth) {
            sample *= 2;
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.RGB_565;
        try {
            InputStream stream = assets.open(asset);
            try {
                return BitmapFactory.decodeStream(stream, null, options);
            } finally {
                stream.close();
            }
        } catch (IOException error) {
            return null;
        } catch (OutOfMemoryError error) {
            CACHE.evictAll();
            return null;
        }
    }

    /** Gambar penuh layar, dipotong di tepi (mode beranda). */
    public static void drawCover(Canvas canvas, Bitmap source, int width, int height) {
        if (source == null || width <= 0 || height <= 0) {
            return;
        }
        float scale = Math.max(width / (float) source.getWidth(), height / (float) source.getHeight());
        float drawWidth = source.getWidth() * scale;
        float drawHeight = source.getHeight() * scale;
        float left = (width - drawWidth) / 2f;
        float top = (height - drawHeight) / 2f;
        canvas.drawBitmap(source, null, new android.graphics.RectF(
                left, top, left + drawWidth, top + drawHeight), PAINT);
    }

    /**
     * Seluruh gambar terlihat dan diletakkan di tengah; ruang sisa diisi warna
     * sudut gambar (mode layar kunci, supaya bingkai tidak terpotong).
     */
    public static void drawContain(Canvas canvas, Bitmap source, int width, int height) {
        if (source == null || width <= 0 || height <= 0) {
            return;
        }
        canvas.drawColor(edgeColor(source));
        float scale = Math.min(width / (float) source.getWidth(), height / (float) source.getHeight());
        float drawWidth = source.getWidth() * scale;
        float drawHeight = source.getHeight() * scale;
        float left = (width - drawWidth) / 2f;
        float top = (height - drawHeight) / 2f;
        canvas.drawBitmap(source, null, new android.graphics.RectF(
                left, top, left + drawWidth, top + drawHeight), PAINT);
    }

    /** Warna rata-rata di dekat sudut kiri-atas — dipakai sebagai warna letterbox. */
    private static int edgeColor(Bitmap source) {
        int step = Math.max(1, source.getWidth() / 24);
        long r = 0;
        long g = 0;
        long b = 0;
        int count = 0;
        for (int x = 0; x < source.getWidth(); x += step) {
            int color = source.getPixel(x, Math.min(2, source.getHeight() - 1));
            r += (color >> 16) & 0xFF;
            g += (color >> 8) & 0xFF;
            b += color & 0xFF;
            count++;
        }
        if (count == 0) {
            return 0xFF06080C;
        }
        return 0xFF000000 | ((int) (r / count) << 16) | ((int) (g / count) << 8) | (int) (b / count);
    }
}
