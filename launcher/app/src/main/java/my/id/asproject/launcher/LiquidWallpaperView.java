package my.id.asproject.launcher;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
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
 * Empat lapis gerak:
 *  1. <b>Gelombang permukaan</b> — bitmap digambar lewat {@link Canvas#drawBitmapMesh}
 *     dengan simpul yang digeser tiga fungsi sinus berjalan plus riak halus;
 *     bagian atas bergerak lebih lebar daripada bagian bawah sehingga terasa
 *     seperti cairan, bukan kertas.
 *  2. <b>Kedalaman 3D</b> — tiap simpul kisi diputar (rotasi X/Y kecil) lalu
 *     dibagi jarak kamera, jadi sisi yang menjauh menyusut (keystone) dan
 *     bidang terasa punya dimensi, bukan sekadar gambar miring.
 *  3. <b>Parallax berlapis</b> — kelas turunan boleh mengembalikan lebih dari
 *     satu lapis ({@link #getLayerCount()}). Tiap lapis punya skala, kemiringan,
 *     dan simpangan sendiri sesuai {@link #layerDepth(int)}: lapis dekat
 *     bergerak lebih jauh daripada lapis jauh, sehingga tercipta ruang.
 *  4. <b>Kilau bergerak</b> — pita cahaya diagonal dengan mode ADD melintas
 *     mengikuti fase gelombang, memberi kesan pantulan krom.
 *
 * Lapis juga bisa diwarp perspektif ({@link #layerPerspective(int)}): papan
 * datar diproyeksikan seolah menjauh ke sebuah titik hilang, jadi wallpaper
 * sirkuit terbaca sebagai bidang 3D, bukan gambar datar yang diombak.
 *
 * Animasi hanya berjalan saat view terlihat; ~30 fps (bukan 60) supaya hemat
 * baterai, dan bisa dimatikan lewat Pengaturan.
 */
public class LiquidWallpaperView extends View implements Choreographer.FrameCallback {

    private static final int COLS = 20;
    private static final int ROWS = 34;

    /** Simpangan dasar gelombang, dalam dp (dikalikan density). */
    private static final float BASE_AMP = 10f;
    /** Bagian atas lebih "cair" daripada bagian bawah. */
    private static final float HEAVY_TOP = 1.35f;
    /** Seberapa besar lapis dekat diperbesar dibanding lapis jauh (parallax). */
    private static final float PARALLAX_SCALE = 0.18f;

    /** Jarak kamera dalam satuan lebar layar — makin kecil, keystone makin kuat. */
    private static final float CAMERA_DISTANCE = 0.40f;

    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);
    private final Paint sheenPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float[] verts = new float[(COLS + 1) * (ROWS + 1) * 2];
    private final float[] disp = new float[2];
    private final float[] point = new float[2];

    private String asset;
    private final boolean cover;

    private Bitmap[] layers;
    private float[][] layerBaseX;      // [lapis][(cols+1)*(rows+1)]
    private float[][] layerBaseY;      // [lapis][rows+1]
    private int[] meshCols;            // kepadatan kisi tiap lapis
    private int[] meshRows;
    private float[] layerDepth;
    private float[] layerPersp;
    private float[] layerAmp;
    private float[] layerT;            // fase gelombang tiap lapis (detik)
    private float tiltX;               // kemiringan frame ini (derajat)
    private float tiltY;

    private boolean animating;
    private boolean attached;
    private boolean motionRequested;
    private float density = 1f;
    private long lastFrameNanos;
    private float phase;

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
        rebuildLayers(getWidth(), getHeight());
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

    // ------------------------------------------------------------------ lapis

    /**
     * Berapa lapis yang digambar. Bawaan 1 (sama seperti versi sebelumnya);
     * {@link CircuitWallpaperView} memakai 3 (jauh / tengah / dekat).
     */
    protected int getLayerCount() {
        return 1;
    }

    /**
     * Gambar untuk lapis ke-{@code index}. Bawaan meneruskan ke
     * {@link #createBitmap(int, int)} supaya kelas turunan lama tetap jalan.
     */
    protected Bitmap createLayer(int index, int width, int height) {
        return createBitmap(width, height);
    }

    /** 0 = paling jauh (kecil & gerak kecil), 1 = paling dekat (besar & liar). */
    protected float layerDepth(int index) {
        return 0.5f;
    }

    /**
     * Warp perspektif: rasio lebar baris teratas terhadap baris terbawah
     * (0.35 = sangat menjauh, 0 = bidang datar tanpa perspektif).
     */
    protected float layerPerspective(int index) {
        return 0f;
    }

    /**
     * Kepadatan kisi lapis. Lapis yang jauh/tidak detail boleh memakai kisi
     * lebih jarang — hemat kerja tiap frame tanpa mengurangi ketajaman lapis
     * utama.
     */
    protected int meshCols(int layer) {
        return COLS;
    }

    protected int meshRows(int layer) {
        return ROWS;
    }

    /**
     * Pengali simpangan gelombang. Kelas turunan boleh menaikkannya sesaat
     * (mis. saat layar kunci dibuka) supaya cairannya "menyergap".
     */
    protected float amplitudeScale() {
        return 1f;
    }

    /** Zoom tambahan untuk lapis tertentu (1 = normal). */
    protected float layerZoom(int layer) {
        return 1f;
    }

    /** Opalitas lapis (0..1) — lapis jauh boleh dibuat lebih redup. */
    protected float layerAlpha(int index) {
        return 1f;
    }

    /**
     * Latar di balik semua lapis. Bawaan mengisi warna dasar gelap; kelas
     * turunan yang memakai perspektif memakainya untuk menggambar "kejauhan"
     * di sudut-sudut yang tidak terjangkau bidang.
     */
    protected void drawBackdrop(Canvas canvas, int width, int height) {
        canvas.drawColor(0xFF04070B);
    }

    /** Bitmap lapis ke-{@code index} (dipakai kelas turunan untuk ukuran & hitungan). */
    protected Bitmap layerBitmap(int index) {
        if (layers == null || index < 0 || index >= layers.length) {
            return null;
        }
        return layers[index];
    }

    /** Lapisan tambahan yang digambar menempel pada satu lapis (koordinat sudah kena kamera lapis). */
    protected void drawLayerExtras(Canvas canvas, int width, int height, float t, int layer) {
        // bawaan: tidak ada
    }

    // ------------------------------------------------------------------ gambar

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        rebuildLayers(width, height);
    }

    private void rebuildLayers(int width, int height) {
        if (width <= 0 || height <= 0) {
            return;
        }
        int count = Math.max(1, getLayerCount());
        // Setengah ukuran layar: cukup tajam untuk digambar ulang tiap frame,
        // memori kecil (3 lapis ≈ 7 MB di layar 1080p).
        int bw = Math.max(360, width / 2);
        int bh = Math.max(640, height / 2);

        Bitmap[] old = layers;
        layers = new Bitmap[count];
        layerBaseX = new float[count][];
        layerBaseY = new float[count][];
        meshCols = new int[count];
        meshRows = new int[count];
        layerDepth = new float[count];
        layerPersp = new float[count];
        layerAmp = new float[count];
        layerT = new float[count];
        int maxCols = COLS;
        int maxRows = ROWS;
        for (int i = 0; i < count; i++) {
            maxCols = Math.max(maxCols, meshCols(i));
            maxRows = Math.max(maxRows, meshRows(i));
        }
        verts = new float[(maxCols + 1) * (maxRows + 1) * 2];
        for (int i = 0; i < count; i++) {
            Bitmap bitmap = createLayer(i, bw, bh);
            layers[i] = bitmap;
            int mc = Math.max(2, meshCols(i));
            int mr = Math.max(2, meshRows(i));
            meshCols[i] = mc;
            meshRows[i] = mr;
            layerBaseX[i] = new float[(mc + 1) * (mr + 1)];
            layerBaseY[i] = new float[mr + 1];
            float depth = Math.max(0f, Math.min(1f, layerDepth(i)));
            layerDepth[i] = depth;
            layerPersp[i] = layerPerspective(i);
            layerAmp[i] = 0.55f + depth * 1.05f;      // lapis dekat lebih liar
            layerT[i] = i * 1.7f;                     // tiap lapis beda fase
            if (bitmap != null) {
                buildGrid(i, width, height, bw, bh);
            }
        }
        if (old != null) {
            for (int i = 0; i < old.length; i++) {
                if (old[i] != null && !old[i].isRecycled()) {
                    old[i].recycle();
                }
            }
        }
    }

    /**
     * Kisi dasar satu lapis. Bila {@link #layerPerspective(int)} > 0, kisi
     * diproyeksikan: baris atas menyempit & rapat (jauh), baris bawah lebar
     * (dekat) — papan datar jadi bidang yang menjauh.
     */
    private void buildGrid(int layer, int width, int height, int bw, int bh) {
        Bitmap bitmap = layers[layer];
        float scale = cover
                ? Math.max(width / (float) bw, height / (float) bh)
                : Math.min(width / (float) bw, height / (float) bh);
        float depth = layerDepth[layer];
        // Lapis jauh pas menutupi layar, lapis dekat diperbesar (terpotong).
        scale *= 1f + depth * PARALLAX_SCALE;
        float drawWidth = bw * scale;
        float drawHeight = bh * scale;

        float sTop = layerPersp[layer];
        float bottom = height * (1.02f + depth * 0.06f);
        float top = -height * (0.06f + (0.5f - depth) * 0.05f);
        float horizon;
        float spread;
        if (sTop > 0.01f) {
            // y(0) = horizon + spread * sTop = top ; y(1) = horizon + spread = bottom
            horizon = (top - sTop * bottom) / (1f - sTop);
            spread = bottom - horizon;
        } else {
            horizon = top;
            spread = bottom - top;
        }

        float cx = width / 2f;
        float[] bx = layerBaseX[layer];
        float[] by = layerBaseY[layer];
        int cols = meshCols[layer];
        int rows = meshRows[layer];
        for (int j = 0; j <= rows; j++) {
            float v = j / (float) rows;
            float s;
            if (sTop > 0.01f) {
                float k = 1f / sTop - 1f;
                s = 1f / (1f + k * (1f - v));
            } else {
                s = 1f;
            }
            by[j] = horizon + spread * s;
            float rowWidth = drawWidth * s;
            for (int i = 0; i <= cols; i++) {
                bx[j * (cols + 1) + i] = cx + (i / (float) cols - 0.5f) * rowWidth;
            }
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int width = getWidth();
        int height = getHeight();
        if (layers == null || width <= 0 || height <= 0) {
            return;
        }
        boolean gridReady = true;
        for (int i = 0; i < layers.length; i++) {
            if (layers[i] == null || layers[i].isRecycled()) {
                gridReady = false;
            }
        }
        if (!gridReady) {
            rebuildLayers(width, height);
            if (layers == null) {
                return;
            }
        }

        drawBackdrop(canvas, width, height);

        float t = phase;
        // Kemiringan 3D: kecil saja, cukup memberi kedalaman.
        tiltX = (float) Math.sin(t * 0.33f) * 3.2f;
        tiltY = (float) Math.cos(t * 0.27f) * 2.6f;

        for (int layer = 0; layer < layers.length; layer++) {
            Bitmap bitmap = layers[layer];
            if (bitmap == null || bitmap.isRecycled()) {
                continue;
            }
            computeVerts(layer, t, width, height);
            bitmapPaint.setAlpha(Math.round(255f * Math.max(0f, Math.min(1f, layerAlpha(layer)))));
            canvas.drawBitmapMesh(bitmap, meshCols[layer], meshRows[layer], verts, 0, null, 0, bitmapPaint);
            drawLayerExtras(canvas, width, height, t, layer);
        }
        bitmapPaint.setAlpha(255);
        drawSheen(canvas, width, height, t);
        drawExtras(canvas, width, height, t);
    }

    private void computeVerts(int layer, float t, int width, int height) {
        float[] bx = layerBaseX[layer];
        float[] by = layerBaseY[layer];
        int cols = meshCols[layer];
        int rows = meshRows[layer];
        float amp = BASE_AMP * density * layerAmp[layer] * amplitudeScale();
        float tp = t * (0.85f + layerDepth[layer] * 0.4f) + layerT[layer];
        float cx = width / 2f;
        float cy = height / 2f;
        float zoom = layerZoom(layer);
        float dist = Math.max(width, height) / CAMERA_DISTANCE;
        float strength = 0.45f + layerDepth[layer];
        float rx = (float) Math.toRadians(tiltX * strength);
        float ry = (float) Math.toRadians(tiltY * strength);
        int index = 0;
        for (int j = 0; j <= rows; j++) {
            float v = j / (float) rows;
            // Berat cairan: makin ke atas makin lebar, bawah hampir diam.
            float weight = HEAVY_TOP - (HEAVY_TOP - 0.35f) * v;
            for (int i = 0; i <= cols; i++) {
                float u = i / (float) cols;
                displacement(u, v, tp, amp, weight);
                project3D(cx + (bx[j * (cols + 1) + i] + disp[0] - cx) * zoom,
                        cy + (by[j] + disp[1] - cy) * zoom,
                        cx, cy, dist, rx, ry, verts, index);
                index += 2;
            }
        }
    }

    /**
     * Proyeksi 3D sederhana: putar bidang datar mengikuti kemiringan, lalu bagi
     * dengan jarak kamera. Hasilnya keystone — sisi yang menjauh menyusut —
     * sehingga bidang terasa punya dimensi, bukan sekadar gambar miring.
     */
    private static void project3D(float x, float y, float cx, float cy, float dist,
                                  float rx, float ry, float[] out, int offset) {
        float px = x - cx;
        float py = y - cy;
        float y1 = py * (float) Math.cos(rx);
        float z1 = py * (float) Math.sin(rx);
        float x2 = px * (float) Math.cos(ry) + z1 * (float) Math.sin(ry);
        float z2 = -px * (float) Math.sin(ry) + z1 * (float) Math.cos(ry);
        float f = dist / Math.max(1f, dist - z2);
        out[offset] = cx + x2 * f;
        out[offset + 1] = cy + y1 * f;
    }

    /** Simpangan cairan pada titik (u,v) — dipakai kisi dan {@link #projectLayer(int, float, float, float[])}. */
    private void displacement(float u, float v, float t, float amp, float weight) {
        // Tiga gelombang berjalan dengan arah berbeda → tidak terlihat periodik.
        float waveA = (float) Math.sin(v * 5.2f + t * 1.15f + u * 0.7f);
        float waveB = (float) Math.sin(u * 4.1f - t * 0.85f + v * 1.3f);
        float waveC = (float) Math.sin((u + v) * 3.0f + t * 0.55f);
        // Riak halus berfrekuensi tinggi: membuat permukaan tampak basah.
        float ripple = (float) Math.sin(u * 7.3f - v * 5.1f + t * 1.9f) * 0.34f;
        float dx = (waveA * 0.52f + waveC * 0.28f + ripple) * amp * weight;
        float dy = (waveB * 0.46f + waveC * 0.30f + ripple * 0.55f) * amp * 0.72f;

        // Bagian tengah sedikit "membusung" ke arah penonton (efek lensa).
        float bulge = (float) Math.sin(v * Math.PI) * (float) Math.sin(u * Math.PI);
        dx += (u - 0.5f) * bulge * 12f * density;
        dy += (v - 0.5f) * bulge * 16f * density;
        disp[0] = dx;
        disp[1] = dy;
    }

    /**
     * Sumber gambar yang dipakai mesh. Kelas turunan boleh menggantinya untuk
     * menggambar wallpaper sendiri (mis. sirkuit yang dibuat prosedural).
     */
    protected Bitmap createBitmap(int width, int height) {
        return asset == null ? null : WallpaperFigure.load(getContext(), asset, width);
    }

    /** Lapisan tambahan setelah semua lapis & kilau — kosong secara bawaan. */
    protected void drawExtras(Canvas canvas, int width, int height, float t) {
        // bawaan: tidak ada
    }

    /** Fase animasi saat ini (detik) — dipakai kelas turunan. */
    protected float getPhase() {
        return phase;
    }

    /** Jumlah lapis yang sedang digambar (dipakai kelas turunan). */
    protected int layerCount() {
        return layers == null ? 0 : layers.length;
    }

    /**
     * Posisi layar untuk titik (u,v) pada lapis tertentu — sudah termasuk
     * warp perspektif, simpangan gelombang, dan kemiringan kamera.
     * Dipakai denyut cahaya & gelembung supaya "menempel" pada cairan, bukan
     * melayang di atasnya.
     */
    protected boolean projectLayer(int layer, float u, float v, float[] out) {
        if (layers == null || layer < 0 || layer >= layers.length) {
            return false;
        }
        float[] bx = layerBaseX[layer];
        float[] by = layerBaseY[layer];
        if (bx == null || by == null) {
            return false;
        }
        int cols = meshCols[layer];
        int rows = meshRows[layer];
        float fi = Math.max(0f, Math.min(cols, u * cols));
        float fj = Math.max(0f, Math.min(rows, v * rows));
        int i0 = (int) Math.floor(fi);
        int j0 = (int) Math.floor(fj);
        int i1 = Math.min(cols, i0 + 1);
        int j1 = Math.min(rows, j0 + 1);
        float tu = fi - i0;
        float tv = fj - j0;

        float x0 = bx[j0 * (cols + 1) + i0] + (bx[j0 * (cols + 1) + i1] - bx[j0 * (cols + 1) + i0]) * tu;
        float x1 = bx[j1 * (cols + 1) + i0] + (bx[j1 * (cols + 1) + i1] - bx[j1 * (cols + 1) + i0]) * tu;
        float x = x0 + (x1 - x0) * tv;
        float y = by[j0] + (by[j1] - by[j0]) * tv;

        float amp = BASE_AMP * density * layerAmp[layer] * amplitudeScale();
        float tp = phase * (0.85f + layerDepth[layer] * 0.4f) + layerT[layer];
        float weight = HEAVY_TOP - (HEAVY_TOP - 0.35f) * v;
        displacement(u, v, tp, amp, weight);

        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float zoom = layerZoom(layer);
        x = cx + (x + disp[0] - cx) * zoom;
        y = cy + (y + disp[1] - cy) * zoom;

        float strength = 0.45f + layerDepth[layer];
        project3D(x, y, cx, cy,
                Math.max(getWidth(), getHeight()) / CAMERA_DISTANCE,
                (float) Math.toRadians(tiltX * strength),
                (float) Math.toRadians(tiltY * strength), out, 0);
        return true;
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
