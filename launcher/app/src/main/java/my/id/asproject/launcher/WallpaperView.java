package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;

/**
 * View yang menggambar wallpaper bawaan AsProject (tanpa ImageView besar).
 * Lihat {@link HomeWallpaperView} dan {@link LockWallpaperView}.
 */
public class WallpaperView extends View {

    private final String asset;
    private final boolean cover;
    private Bitmap bitmap;

    public WallpaperView(Context context) {
        this(context, WallpaperFigure.ASSET_HOME, true);
    }

    public WallpaperView(Context context, String asset, boolean cover) {
        super(context);
        this.asset = asset;
        this.cover = cover;
        setWillNotDraw(false);
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        // Setengah lebar sudah cukup: foto diperbesar saat digambar, memori ~1 MB
        // per aliran (bukan ~4 MB), penting untuk perangkat API 21.
        bitmap = WallpaperFigure.load(getContext(), asset, Math.max(360, width / 2));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (bitmap == null || bitmap.isRecycled()) {
            return;
        }
        if (cover) {
            WallpaperFigure.drawCover(canvas, bitmap, getWidth(), getHeight());
        } else {
            WallpaperFigure.drawContain(canvas, bitmap, getWidth(), getHeight());
        }
    }
}
