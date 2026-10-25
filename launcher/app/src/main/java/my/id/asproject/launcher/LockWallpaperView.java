package my.id.asproject.launcher;

import android.content.Context;
import android.util.AttributeSet;

/**
 * Wallpaper layar kunci: bingkai liquid-chrome, mode CONTAIN supaya seluruh
 * bingkai terlihat di rasio layar apa pun (sisa ruang diisi warna tepi gambar).
 */
public final class LockWallpaperView extends WallpaperView {

    public LockWallpaperView(Context context, AttributeSet attrs) {
        super(context, WallpaperFigure.ASSET_LOCK, false);
    }
}
