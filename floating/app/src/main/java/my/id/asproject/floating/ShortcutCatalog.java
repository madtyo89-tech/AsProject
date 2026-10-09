package my.id.asproject.floating;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Daftar bawaan aplikasi yang bisa ditaruh di gelembung melayang.
 *
 * <p>Nama paket ditulis apa adanya dari aplikasi aslinya (mis. inDrive memakai
 * {@code sinet.startup.inDriver}, bukan {@code com.indrive}). Bila sebuah aplikasi mengubah
 * nama paketnya, tambahkan saja varian baru di sini — {@code AppOpener} mencoba semua varian
 * secara berurutan, jadi entri lama tetap jalan.
 *
 * <p>Murni Java (tanpa {@code android.*}) sehingga diuji di JVM oleh
 * {@code floating/tests/jvm/FloatingCatalogTest.java}.
 */
public final class ShortcutCatalog {

    /** Pengenal entri bawaan yang langsung aktif pada pemasangan pertama. */
    public static final String[] DEFAULT_ENABLED = {
            "indrive", "maps", "whatsapp", "grab", "gojek",
    };

    private ShortcutCatalog() {
    }

    /**
     * Daftar bawaan, diurutkan seperti yang ditampilkan pada layar pengaturan.
     * Selalu mengembalikan salinan baru.
     */
    public static List<Shortcut> defaults() {
        List<Shortcut> list = new ArrayList<Shortcut>();
        list.add(Shortcut.app("indrive", "inDrive", false, "sinet.startup.inDriver"));
        list.add(Shortcut.app("maps", "Google Maps", false,
                "com.google.android.apps.maps", "com.google.android.apps.maps.go"));
        list.add(Shortcut.app("whatsapp", "WhatsApp", false, "com.whatsapp", "com.whatsapp.w4b"));
        list.add(Shortcut.app("grab", "Grab", false, "com.grabtaxi.passenger"));
        list.add(Shortcut.app("gojek", "Gojek", false, "com.gojek.app", "com.gojek.customer"));
        list.add(Shortcut.app("maxim", "Maxim", false, "com.taxsee.taxsee", "com.taxsee.driver"));
        list.add(Shortcut.app("telegram", "Telegram", false, "org.telegram.messenger"));
        list.add(Shortcut.app("browser", "Browser", false,
                "com.android.chrome", "com.brave.browser", "org.mozilla.firefox",
                "com.opera.browser", "com.sec.android.app.sbrowser"));
        list.add(Shortcut.link("maps_here", "Maps: lokasi saya", false, "geo:0,0?q="));
        for (Shortcut item : list) {
            item.enabled = isDefaultEnabled(item.id);
        }
        return list;
    }

    public static boolean isDefaultEnabled(String id) {
        for (String enabled : DEFAULT_ENABLED) {
            if (enabled.equals(id)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gabungkan daftar tersimpan dengan daftar bawaan.
     *
     * <p>Urutan mengikuti {@code saved} (pilihan pengguna). Entri bawaan yang belum pernah
     * dilihat pengguna ditambahkan di belakang, supaya pembaruan aplikasi yang menambah entri
     * baru tetap muncul tanpa menimpa urutan pengguna.
     */
    public static List<Shortcut> merge(List<Shortcut> saved) {
        Map<String, Shortcut> byId = new LinkedHashMap<String, Shortcut>();
        if (saved != null) {
            for (Shortcut item : saved) {
                if (item != null && !item.id.isEmpty() && !byId.containsKey(item.id)) {
                    byId.put(item.id, item);
                }
            }
        }
        List<Shortcut> result = new ArrayList<Shortcut>(byId.values());
        for (Shortcut preset : defaults()) {
            if (!byId.containsKey(preset.id)) {
                result.add(preset);
            }
        }
        return result;
    }

    /** Cari entri berdasarkan pengenal; {@code null} bila tidak ada. */
    public static Shortcut findById(List<Shortcut> list, String id) {
        if (list == null || id == null) {
            return null;
        }
        for (Shortcut item : list) {
            if (id.equals(item.id)) {
                return item;
            }
        }
        return null;
    }

    /** Buang pengenal ganda, jaga kemunculan pertama. */
    public static List<Shortcut> deduplicate(List<Shortcut> list) {
        Map<String, Shortcut> byId = new LinkedHashMap<String, Shortcut>();
        if (list != null) {
            for (Shortcut item : list) {
                if (item != null && !item.id.isEmpty() && !byId.containsKey(item.id)) {
                    byId.put(item.id, item);
                }
            }
        }
        return new ArrayList<Shortcut>(byId.values());
    }
}
