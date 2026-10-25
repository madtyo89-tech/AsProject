package my.id.asproject.launcher;

import android.content.Context;
import android.util.AttributeSet;

/** Wallpaper beranda: sirkuit neon + HUD, mode COVER (mengisi layar). */
public final class HomeWallpaperView extends WallpaperView {

    public HomeWallpaperView(Context context, AttributeSet attrs) {
        super(context, WallpaperFigure.ASSET_HOME, true);
    }
}
