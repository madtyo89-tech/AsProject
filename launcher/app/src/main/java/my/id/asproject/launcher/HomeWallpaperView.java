package my.id.asproject.launcher;

import android.content.Context;
import android.util.AttributeSet;

/**
 * Wallpaper beranda: sirkuit neon + HUD, mengisi layar (mode COVER) dan
 * bergerak seperti cairan (lihat {@link LiquidWallpaperView}).
 */
public final class HomeWallpaperView extends LiquidWallpaperView {

    public HomeWallpaperView(Context context, AttributeSet attrs) {
        super(context, WallpaperFigure.ASSET_HUD, true);
    }
}
