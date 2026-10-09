package my.id.asproject.floating;

/**
 * Satu entri pada gelembung melayang: nama, paket aplikasi yang bisa memenuhinya, dan
 * warna lingkaran ikonnya.
 *
 * <p>Kelas ini <b>murni Java</b> (tanpa satu pun impor {@code android.*}) supaya bisa diuji
 * langsung di JVM — sama seperti {@code UrlPolicy} pada aplikasi AsProject Studio.
 */
public final class Shortcut {

    /** Warna lingkaran bawaan: emas AsProject ({@code #FFD4AF37}). */
    public static final int DEFAULT_COLOR = 0xFFD4AF37;

    /** Pengenal unik, stabil antar-pemasangan (mis. {@code indrive}, {@code app:com.whatsapp}). */
    public final String id;

    /** Nama yang tampil di gelembung dan di layar pengaturan. */
    public final String label;

    /**
     * Daftar paket aplikasi, dicoba berurutan. Lebih dari satu isi dipakai untuk aplikasi yang
     * punya beberapa varian (mis. WhatsApp biasa & Business, atau beberapa peramban).
     */
    public final String[] packages;

    /**
     * Tautan yang dibuka bila {@link #packages} kosong (mis. {@code geo:0,0?q=…}).
     * {@code null} bila entri ini diluncurkan lewat paket aplikasi.
     */
    public final String uri;

    /** Warna ARGB lingkaran ikon. */
    public final int color;

    /** {@code true} bila entri ini ikut ditampilkan di gelembung. */
    public boolean enabled;

    public Shortcut(String id, String label, String[] packages, String uri, int color, boolean enabled) {
        this.id = id == null ? "" : id.trim();
        this.label = label == null ? "" : label.trim();
        this.packages = packages == null ? new String[0] : packages.clone();
        this.uri = (uri == null || uri.trim().isEmpty()) ? null : uri.trim();
        this.color = color;
        this.enabled = enabled;
    }

    /** Pintasan membuat entri berbasis paket aplikasi. */
    public static Shortcut app(String id, String label, boolean enabled, String... packages) {
        return new Shortcut(id, label, packages, null, DEFAULT_COLOR, enabled);
    }

    /** Pintasan membuat entri berbasis tautan (dipakai bila aplikasi tidak terpasang). */
    public static Shortcut link(String id, String label, boolean enabled, String uri) {
        return new Shortcut(id, label, new String[0], uri, DEFAULT_COLOR, enabled);
    }

    /** Salinan bebas, supaya daftar bawaan tidak pernah berubah oleh layar pengaturan. */
    public Shortcut copy() {
        return new Shortcut(id, label, packages, uri, color, enabled);
    }

    /** Huruf kapital pertama nama — dipakai sebagai isi lingkaran ikon (tanpa aset gambar). */
    public String initial() {
        String text = label.trim();
        if (text.isEmpty()) {
            return "?";
        }
        return text.substring(0, 1).toUpperCase(java.util.Locale.ROOT);
    }

    /** Paket pertama bila ada. */
    public String primaryPackage() {
        return packages.length > 0 ? packages[0] : "";
    }

    /** Cocok dengan pencarian sederhana (nama atau paket). */
    public boolean matches(String query) {
        if (query == null || query.trim().isEmpty()) {
            return true;
        }
        String needle = query.trim().toLowerCase(java.util.Locale.ROOT);
        if (label.toLowerCase(java.util.Locale.ROOT).contains(needle)) {
            return true;
        }
        for (String pkg : packages) {
            if (pkg.toLowerCase(java.util.Locale.ROOT).contains(needle)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public String toString() {
        return label + " (" + id + ")";
    }
}
