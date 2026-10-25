package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Camera;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Shader;
import android.view.Choreographer;
import android.view.View;

/**
 * Wallpaper "liquid chrome" yang bergerak — tanpa OpenGL, jadi tetap jalan di
 * Android 5.0 dan tidak menambah satu pustaka pun.
 *
 * Tiga lapis gerak:
 *  1. <b>Gelombang permukaan</b> — bitmap digambar lewat {@link Canvas#drawBitmapMesh}
 *     dengan simpul yang digeser fungsi sinus berjalan; bagian atas bergerak lebih
 *     lebar daripada bagian bawah sehingga terasa seperti cairan, bukan kertas.
 *  2. <b>Kedalaman 3D</b> — seluruh mesh dimiringkan memakai {@link Camera}
 *     (rotasi X/Y kecil + sedikit zoom), jadi tepi menjauh/mendekat seperti
 *     objek berdimensi.
 *  3. <b>Kilau bergerak</b> — pita cahaya diagonal dengan mode ADD melintas
 *     mengikuti fase gelombang, memberi kesan pantulan krom.
 *
 * Animasi hanya berjalan saat view terlihat; 30 fps (bukan 60) supaya hemat
 * baterai, dan bisa dimatikan lewat Pengaturan.
 */
public class LiquidWallpaperView extends View implements Choreographer.FrameCallback {

    private static final int COLS = 20;
    private static final int ROWS = 34;
    private static final float AO = 0.42f;        // kedalaman miring (rotasi X)

    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);
    private final Paint sheenPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Camera camera = new Camera();
    private final Matrix cameraMatrix = new Matrix();
    private final float[] verts = new float[(COLS + 1) * (ROWS + 1) * 2];
    private final float[] baseX = new float[COLS + 1];
    private final float[] baseY = new float[ROWS + 1];

    private String asset;
    private final boolean cover;

    private Bitmap bitmap;
    private boolean animating;
    private boolean attached;
    private boolean motionRequested;
    private float density = 1f;
    private long lastFrameNanos;
    private float phase;
    private float tiltX;
    private float tiltY;

    public LiquidWallpaperView(Context context, String asset, boolean cover) {
        super(context);
        this.asset = asset;
        this.cover = cover;
        density = getResources().getDisplayMetrics().density;
        setWillNotDraw(false);
        sheenPaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
    }

    /** Ganti sumber gambar (mis. HUD ⇄ bingkai kosong) tanpa membuat ulang view. */
    public void setAsset(String newAsset) {
        if (newAsset == null || newAsset.equals(asset)) {
            return;
        }
        this.asset = newAsset;
        bitmap = WallpaperFigure.load(getContext(), asset, Math.max(360, getWidth() / 2));
        if (bitmap != null) {
            rebuildBaseGrid(getWidth(), getHeight());
        }
        invalidate();
    }

    /** Nyalakan/matikan gerakan; saat mati wallpaper tetap tampil (statis). */
    public void setMotionEnabled(boolean enabled) {
        motionRequested = enabled;
        if (enabled) {
            start();
        } else {
            stop();
        }
    }

    public boolean isMoving() {
        return animating;
    }

    /** Apakah gerakan diminta (walau view sedang tidak terlihat). */
    public boolean isMotionRequested() {
        return motionRequested;
    }

    // ------------------------------------------------------------- siklus hidup

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        attached = true;
        if (motionRequested) {
            start();
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        attached = false;
        stop();
        super.onDetachedFromWindow();
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        super.onWindowVisibilityChanged(visibility);
        if (visibility != VISIBLE) {
            stop();
        }
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        super.onVisibilityChanged(changedView, visibility);
        if (visibility != VISIBLE) {
            stop();
        }
    }

    private void start() {
        if (animating || !attached) {
            return;
        }
        animating = true;
        lastFrameNanos = 0L;
        Choreographer.getInstance().postFrameCallback(this);
    }

    private void stop() {
        if (!animating) {
            return;
        }
        animating = false;
        Choreographer.getInstance().removeFrameCallback(this);
    }

    @Override
    public void doFrame(long frameTimeNanos) {
        if (!animating) {
            return;
        }
        if (lastFrameNanos != 0L) {
            float delta = (frameTimeNanos - lastFrameNanos) / 1_000_000_000f;
            if (delta > 0.2f) {
                delta = 0.2f;                     // jangan melompat setelah jeda
            }
            phase += delta;
        }
        lastFrameNanos = frameTimeNanos;
        // ~30 fps: jadwalkan frame berikutnya sedikit di depan.
        Choreographer.getInstance().postFrameCallbackDelayed(this, 24);
        invalidate();
    }

    // ------------------------------------------------------------------ gambar

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        // Setengah lebar: cukup tajam untuk digambar ulang tiap frame, memori kecil.
        bitmap = createBitmap(Math.max(360, width / 2), Math.max(640, height / 2));
        if (bitmap != null) {
            rebuildBaseGrid(width, height);
        }
    }

    private void rebuildBaseGrid(int width, int height) {
        float scale = cover
                ? Math.max(width / (float) bitmap.getWidth(), height / (float) bitmap.getHeight())
                : Math.min(width / (float) bitmap.getWidth(), height / (float) bitmap.getHeight());
        float drawWidth = bitmap.getWidth() * scale;
        float drawHeight = bitmap.getHeight() * scale;
        float left = (width - drawWidth) / 2f;
        float top = (height - drawHeight) / 2f;
        for (int i = 0; i <= COLS; i++) {
            baseX[i] = left + drawWidth * i / COLS;
        }
        for (int j = 0; j <= ROWS; j++) {
            baseY[j] = top + drawHeight * j / ROWS;
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (bitmap == null || bitmap.isRecycled()) {
            return;
        }
        int width = getWidth();
        int height = getHeight();
        if (baseX[COLS] == 0f) {
            rebuildBaseGrid(width, height);
        }

        float t = phase;
        float amplitude = 7f * density;            // simpangan dasar (dp → px)
        float heavyTop = 1.35f;                    // bagian atas lebih "cair"

        int index = 0;
        for (int j = 0; j <= ROWS; j++) {
            float v = j / (float) ROWS;
            // Berat cairan: makin ke atas makin lebar, bawah hampir diam.
            float weight = heavyTop - (heavyTop - 0.35f) * v;
            for (int i = 0; i <= COLS; i++) {
                float u = i / (float) COLS;
                // Dua gelombang berjalan dengan arah berbeda → tidak terlihat periodik.
                float waveA = (float) Math.sin(v * 5.2f + t * 1.15f + u * 0.7f);
                float waveB = (float) Math.sin(u * 4.1f - t * 0.85f + v * 1.3f);
                float waveC = (float) Math.sin((u + v) * 3.0f + t * 0.55f);
                float dx = (waveA * 0.62f + waveC * 0.38f) * amplitude * weight;
                float dy = (waveB * 0.55f + waveC * 0.45f) * amplitude * 0.75f;

                // Bagian tengah sedikit "membusung" ke arah penonton (efek lensa).
                float bulge = (float) Math.sin(v * Math.PI) * (float) Math.sin(u * Math.PI);
                dx += (u - 0.5f) * bulge * 12f * density;
                dy += (v - 0.5f) * bulge * 16f * density;

                verts[index++] = baseX[i] + dx;
                verts[index++] = baseY[j] + dy;
            }
        }

        // Kemiringan 3D seluruh bidang (kecil saja, cukup memberi kedalaman).
        tiltX = (float) Math.sin(t * 0.33f) * 1.6f;
        tiltY = (float) Math.cos(t * 0.27f) * 1.2f;
        camera.save();
        camera.rotateX(tiltX);
        camera.rotateY(tiltY);
        camera.setLocation(0f, 0f, -8f * getResources().getDisplayMetrics().density);
        camera.getMatrix(cameraMatrix);
        camera.restore();
        cameraMatrix.preTranslate(-width / 2f, -height / 2f);
        cameraMatrix.postTranslate(width / 2f, height / 2f);

        int save = canvas.save();
        canvas.concat(cameraMatrix);
        canvas.drawBitmapMesh(bitmap, COLS, ROWS, verts, 0, null, 0, bitmapPaint);
        drawSheen(canvas, width, height, t);
        drawExtras(canvas, width, height, t);
        canvas.restoreToCount(save);
    }

    /**
     * Sumber gambar yang dipakai mesh. Kelas turunan boleh menggantinya untuk
     * menggambar wallpaper sendiri (mis. sirkuit yang dibuat prosedural).
     */
    protected Bitmap createBitmap(int width, int height) {
        return asset == null ? null : WallpaperFigure.load(getContext(), asset, width);
    }

    /** Lapisan tambahan setelah gambar & kilau — kosong secara bawaan. */
    protected void drawExtras(Canvas canvas, int width, int height, float t) {
        // bawaan: tidak ada
    }

    /** Fase animasi saat ini (detik) — dipakai kelas turunan. */
    protected float getPhase() {
        return phase;
    }

    /** Pita kilau diagonal yang melintas pelan — pantulan krom. */
    private void drawSheen(Canvas canvas, int width, int height, float t) {
        float travel = ((t * 0.09f) % 1f + 1f) % 1f;
        float centerX = width * (-0.35f + 1.7f * travel);
        float band = width * 0.55f;
        sheenPaint.setShader(new LinearGradient(centerX - band, 0, centerX + band, height,
                new int[]{0x00000000, 0x14BFE9FF, 0x00000000},
                new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, sheenPaint);
    }
}
