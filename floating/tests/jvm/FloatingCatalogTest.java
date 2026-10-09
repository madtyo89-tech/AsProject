/*
 * Uji logika murni (tanpa Android, cukup JVM) untuk modul AsProject Floating.
 *
 *   javac -d /tmp/float \
 *     floating/app/src/main/java/my/id/asproject/floating/Shortcut.java \
 *     floating/app/src/main/java/my/id/asproject/floating/ShortcutCatalog.java \
 *     floating/app/src/main/java/my/id/asproject/floating/ShortcutCodec.java \
 *     floating/tests/jvm/FloatingCatalogTest.java
 *   java -cp /tmp/float FloatingCatalogTest
 *
 * Fokus: daftar bawaan benar (paket inDrive & Maps tepat, tanpa id ganda) dan
 * codec simpan/muat tidak mengubah urutan, nama, paket, warna, maupun status centang.
 */

import java.util.List;

import my.id.asproject.floating.Shortcut;
import my.id.asproject.floating.ShortcutCatalog;
import my.id.asproject.floating.ShortcutCodec;

public final class FloatingCatalogTest {

    private static int passed = 0;
    private static int failed = 0;

    private static void expect(String label, boolean actual, boolean expected) {
        if (actual == expected) {
            passed++;
            System.out.println("  [PASS] " + label);
        } else {
            failed++;
            System.out.println("  [FAIL] " + label + " (diharapkan " + expected + ", dapat " + actual + ")");
        }
    }

    private static void expectEquals(String label, String actual, String expected) {
        if (expected.equals(actual)) {
            passed++;
            System.out.println("  [PASS] " + label);
        } else {
            failed++;
            System.out.println("  [FAIL] " + label + " (diharapkan \"" + expected + "\", dapat \"" + actual + "\")");
        }
    }

    public static void main(String[] args) {
        System.out.println("FloatingCatalogTest — logika modul AsProject Floating\n");

        List<Shortcut> defaults = ShortcutCatalog.defaults();

        System.out.println("1) Daftar bawaan");
        expect("daftar bawaan tidak kosong", !defaults.isEmpty(), true);
        expect("ada minimal 8 entri", defaults.size() >= 8, true);
        Shortcut indrive = ShortcutCatalog.findById(defaults, "indrive");
        Shortcut maps = ShortcutCatalog.findById(defaults, "maps");
        Shortcut wa = ShortcutCatalog.findById(defaults, "whatsapp");
        expect("inDrive ada", indrive != null, true);
        expect("Google Maps ada", maps != null, true);
        expect("WhatsApp ada", wa != null, true);
        expectEquals("paket inDrive tepat", indrive == null ? "" : indrive.primaryPackage(),
                "sinet.startup.inDriver");
        expectEquals("paket Maps tepat", maps == null ? "" : maps.primaryPackage(),
                "com.google.android.apps.maps");
        expect("inDrive aktif bawaan", indrive != null && indrive.enabled, true);
        expect("Maps aktif bawaan", maps != null && maps.enabled, true);
        expect("Telegram tidak aktif bawaan",
                ShortcutCatalog.findById(defaults, "telegram") != null
                        && !ShortcutCatalog.findById(defaults, "telegram").enabled, true);

        boolean unique = ShortcutCatalog.deduplicate(defaults).size() == defaults.size();
        expect("id bawaan tidak ganda", unique, true);

        System.out.println("\n2) Codec simpan/muat (round-trip)");
        String encoded = ShortcutCodec.encode(defaults);
        List<Shortcut> decoded = ShortcutCodec.decode(encoded);
        expect("decode tidak null", decoded != null, true);
        expect("jumlah entri sama", decoded != null && decoded.size() == defaults.size(), true);
        boolean sameOrder = true;
        boolean sameContent = true;
        if (decoded != null) {
            for (int i = 0; i < defaults.size(); i++) {
                Shortcut a = defaults.get(i);
                Shortcut b = decoded.get(i);
                if (!a.id.equals(b.id)) {
                    sameOrder = false;
                }
                if (!a.label.equals(b.label) || !a.primaryPackage().equals(b.primaryPackage())
                        || a.enabled != b.enabled || a.color != b.color) {
                    sameContent = false;
                }
            }
        }
        expect("urutan terjaga", sameOrder, true);
        expect("nama/paket/warna/centang terjaga", sameContent, true);

        System.out.println("\n3) Label dengan karakter khusus");
        List<Shortcut> special = new java.util.ArrayList<Shortcut>();
        special.add(Shortcut.app("app:com.x", "Grab | Taxi; Food, Delivery\\", true, "com.grabtaxi.passenger"));
        List<Shortcut> back = ShortcutCodec.decode(ShortcutCodec.encode(special));
        expect("label khusus round-trip",
                back != null && back.size() == 1
                        && "Grab | Taxi; Food, Delivery\\".equals(back.get(0).label), true);

        System.out.println("\n4) Perilaku decode pada masukan buruk");
        expect("teks kosong -> null", ShortcutCodec.decode("") == null, true);
        expect("null -> null", ShortcutCodec.decode(null) == null, true);
        expect("versi asing -> null", ShortcutCodec.decode("v9;xyz") == null, true);

        System.out.println("\n5) Penggabungan daftar tersimpan + bawaan");
        List<Shortcut> merged = ShortcutCatalog.merge(null);
        expect("merge(null) = bawaan", merged.size() == defaults.size(), true);
        List<Shortcut> saved = ShortcutCatalog.deduplicate(defaults);
        saved.remove(saved.size() - 1);            // buang satu entri bawaan
        saved.add(Shortcut.app("app:com.gojek.app", "Gojek (manual)", true, "com.gojek.app"));
        List<Shortcut> merged2 = ShortcutCatalog.merge(saved);
        expect("entri manual tetap ada",
                ShortcutCatalog.findById(merged2, "app:com.gojek.app") != null, true);
        // entri bawaan yang dibuang akan ditambahkan lagi di belakang
        expect("entri bawaan yang hilang dikembalikan",
                merged2.size() == saved.size() + 1, true);
        expectEquals("entri manual berada di depan entri bawaan yang dikembalikan",
                merged2.get(saved.size() - 1).id, "app:com.gojek.app");

        System.out.println("\n6) Pencocokan pencarian");
        expect("cari 'indri' ketemu inDrive", indrive != null && indrive.matches("indri"), true);
        expect("cari 'SINET' ketemu inDrive (paket)", indrive != null && indrive.matches("SINET"), true);
        expect("cari kosong selalu benar", wa != null && wa.matches("   "), true);
        expect("cari 'zzz' tidak ketemu", wa != null && !wa.matches("zzz"), true);

        System.out.println("\nHasil: " + passed + " lulus, " + failed + " gagal");
        if (failed > 0) {
            System.exit(1);
        }
    }
}
