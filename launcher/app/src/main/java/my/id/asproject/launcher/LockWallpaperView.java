package my.id.asproject.launcher;

import android.content.Context;
import android.util.AttributeSet;

/**
 * Wallpaper layar kunci.
 *
 * Bawaan memakai gambar ber-HUD (agar panel HUD animasi di bawah menyatu dengan
 * bingkai), mode COVER supaya mengisi penuh layar. Bila pengguna memilih
 * "bingkai tenang", dipakai frame liquid-chrome tanpa HUD.
 */
public final class LockWallpaperView extends LiquidWallpaperView {

    public LockWallpaperView(Context context, AttributeSet attrs) {
        super(context, WallpaperFigure.ASSET_HUD, true);
    }

    /** Ganti antara gambar ber-HUD dan bingkai kosong. */
    public void useFrameOnly(boolean frameOnly) {
        setAsset(frameOnly ? WallpaperFigure.ASSET_FRAME : WallpaperFigure.ASSET_HUD);
    }
}
