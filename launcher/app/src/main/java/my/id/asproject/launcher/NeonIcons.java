package my.id.asproject.launcher;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Pemetaan aplikasi populer → ikon neon sirkuit AsProject (aset PNG di
 * res/drawable-nodpi, diekstrak dari paket ikon "circuit_icons_transparent").
 *
 * Ikon hanya dipakai bila paket aplikasinya benar-benar terpasang dan bila
 * pengguna menyalakan "Ikon neon" di Pengaturan beranda. Aplikasi lain memakai
 * ikon aslinya — jadi tidak ada ikon yang salah tempel.
 */
public final class NeonIcons {

    private static final Map<String, Integer> BY_PACKAGE = new HashMap<String, Integer>();

    static {
        BY_PACKAGE.put("com.android.dialer", R.drawable.ic_phone);
        BY_PACKAGE.put("com.google.android.dialer", R.drawable.ic_phone);
        BY_PACKAGE.put("com.samsung.android.dialer", R.drawable.ic_phone);
        BY_PACKAGE.put("com.oneplus.dialer", R.drawable.ic_phone);

        BY_PACKAGE.put("com.google.android.apps.messaging", R.drawable.ic_message);
        BY_PACKAGE.put("com.android.mms", R.drawable.ic_message);
        BY_PACKAGE.put("com.samsung.android.messaging", R.drawable.ic_message);
        BY_PACKAGE.put("com.android.messaging", R.drawable.ic_message);

        BY_PACKAGE.put("com.android.camera", R.drawable.ic_camera);
        BY_PACKAGE.put("com.android.camera2", R.drawable.ic_camera);
        BY_PACKAGE.put("com.google.android.GoogleCamera", R.drawable.ic_camera);
        BY_PACKAGE.put("com.samsung.android.camera", R.drawable.ic_camera);
        BY_PACKAGE.put("org.codeaurora.snapcam", R.drawable.ic_camera);

        BY_PACKAGE.put("com.android.settings", R.drawable.ic_settings);

        BY_PACKAGE.put("com.android.music", R.drawable.ic_music);
        BY_PACKAGE.put("com.sec.android.app.music", R.drawable.ic_music);
        BY_PACKAGE.put("com.spotify.music", R.drawable.ic_music);
        BY_PACKAGE.put("com.google.android.apps.youtube.music", R.drawable.ic_music);

        BY_PACKAGE.put("com.android.chrome", R.drawable.ic_chrome);
        BY_PACKAGE.put("com.chrome.beta", R.drawable.ic_chrome);

        BY_PACKAGE.put("com.whatsapp", R.drawable.ic_whatsapp);
        BY_PACKAGE.put("com.whatsapp.w4b", R.drawable.ic_whatsapp);

        BY_PACKAGE.put("com.instagram.android", R.drawable.ic_instagram);
    }

    private NeonIcons() {
    }

    /** @return id drawable neon, atau 0 bila aplikasi ini tidak punya versi neon. */
    public static int drawableFor(String packageName) {
        Integer res = BY_PACKAGE.get(packageName);
        return res == null ? 0 : res.intValue();
    }

    /** Daftar paket yang punya ikon neon (dipakai di layar Pengaturan). */
    public static Set<String> knownPackages() {
        return new HashSet<String>(BY_PACKAGE.keySet());
    }
}
