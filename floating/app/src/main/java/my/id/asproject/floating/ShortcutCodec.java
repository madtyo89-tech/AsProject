package my.id.asproject.floating;

import java.util.ArrayList;
import java.util.List;

/**
 * Ubah daftar {@link Shortcut} menjadi satu baris teks (dan sebaliknya) untuk disimpan di
 * {@code SharedPreferences}.
 *
 * <p>Format (versi 1):
 * <pre>
 *   v1;&lt;entri&gt;;&lt;entri&gt;;…
 *   entri = id|label|paket1,paket2|uri|warnaHex|aktif
 * </pre>
 * Karakter pemisah di dalam teks ({@code \}, {@code |}, {@code ;}, {@code ,}) di-escape agar
 * nama aplikasi seperti {@code Grab - Taxi & Food Delivery} tetap aman.
 *
 * <p>Murni Java sehingga bisa diuji di JVM.
 */
public final class ShortcutCodec {

    public static final String VERSION = "v1";

    private ShortcutCodec() {
    }

    public static String encode(List<Shortcut> list) {
        StringBuilder out = new StringBuilder(VERSION);
        if (list != null) {
            for (Shortcut item : list) {
                if (item == null || item.id.isEmpty()) {
                    continue;
                }
                out.append(';');
                out.append(escape(item.id)).append('|');
                out.append(escape(item.label)).append('|');
                StringBuilder pkgs = new StringBuilder();
                for (String pkg : item.packages) {
                    if (pkg == null || pkg.trim().isEmpty()) {
                        continue;
                    }
                    if (pkgs.length() > 0) {
                        pkgs.append(',');
                    }
                    pkgs.append(escape(pkg.trim()));
                }
                out.append(pkgs).append('|');
                out.append(item.uri == null ? "" : escape(item.uri)).append('|');
                out.append(Integer.toHexString(item.color)).append('|');
                out.append(item.enabled ? '1' : '0');
            }
        }
        return out.toString();
    }

    /**
     * Urai teks simpanan.
     *
     * @return daftar entri, atau {@code null} bila teks kosong/bukan format yang dikenal
     *         (pemanggil lalu memakai daftar bawaan).
     */
    public static List<Shortcut> decode(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        List<String> records = split(trimmed, ';');
        if (records.isEmpty() || !VERSION.equals(records.get(0))) {
            return null;
        }
        List<Shortcut> list = new ArrayList<Shortcut>();
        for (int i = 1; i < records.size(); i++) {
            List<String> fields = split(records.get(i), '|');
            if (fields.size() < 2) {
                continue;
            }
            String id = unescape(field(fields, 0));
            if (id.isEmpty()) {
                continue;
            }
            String label = unescape(field(fields, 1));
            List<String> packages = new ArrayList<String>();
            for (String pkg : split(field(fields, 2), ',')) {
                String clean = unescape(pkg).trim();
                if (!clean.isEmpty()) {
                    packages.add(clean);
                }
            }
            String uri = field(fields, 3);
            int color = parseColor(unescape(field(fields, 4)));
            boolean enabled = "1".equals(field(fields, 5));
            list.add(new Shortcut(id, label, packages.toArray(new String[0]),
                    uri.isEmpty() ? null : unescape(uri), color, enabled));
        }
        return list;
    }

    // ------------------------------------------------------------------ bantuan

    private static String field(List<String> fields, int index) {
        return index < fields.size() ? fields.get(index) : "";
    }

    /** Pisahkan teks pada {@code sep} yang tidak di-escape (didahului {@code \}). */
    private static List<String> split(String text, char sep) {
        List<String> parts = new ArrayList<String>();
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '\\' && i + 1 < text.length()) {
                current.append(c).append(text.charAt(i + 1));
                i++;
            } else if (c == sep) {
                parts.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        parts.add(current.toString());
        return parts;
    }

    private static String escape(String text) {
        if (text == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(text.length() + 4);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '\\' || c == '|' || c == ';' || c == ',') {
                out.append('\\');
            }
            out.append(c);
        }
        return out.toString();
    }

    private static String unescape(String text) {
        if (text == null || text.indexOf('\\') < 0) {
            return text == null ? "" : text;
        }
        StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '\\' && i + 1 < text.length()) {
                out.append(text.charAt(i + 1));
                i++;
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    private static int parseColor(String hex) {
        if (hex == null || hex.isEmpty()) {
            return Shortcut.DEFAULT_COLOR;
        }
        try {
            long value = Long.parseLong(hex, 16);
            return (int) value;
        } catch (NumberFormatException e) {
            return Shortcut.DEFAULT_COLOR;
        }
    }
}
