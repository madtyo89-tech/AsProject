/*
 * Uji aturan navigasi & keamanan (tanpa Android, cukup JVM).
 *
 *   javac -d /tmp/out android/app/src/main/java/my/id/asproject/studio/UrlPolicy.java \
 *         android/tests/jvm/UrlPolicyTest.java
 *   java -cp /tmp/out UrlPolicyTest
 *
 * Fokus: hanya permintaan HTTPS ke domain Studio (atau sub-domainnya) yang boleh dimuat di
 * dalam aplikasi; tautan lain harus dibuka di aplikasi/peramban luar.
 */

import my.id.asproject.studio.UrlPolicy;

public final class UrlPolicyTest {

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
        System.out.println("UrlPolicyTest — aturan navigasi AsProject Studio\n");

        System.out.println("1) Titik masuk Studio");
        expectEquals("STUDIO_URL", UrlPolicy.STUDIO_URL, "https://asproject.my.id/studio.html");
        expect("studio.html boleh dimuat di dalam aplikasi",
                UrlPolicy.isInternalNavigable(UrlPolicy.STUDIO_URL), true);

        System.out.println("\n2) Halaman internal lain");
        expect("halaman undangan /u/{slug}", 
                UrlPolicy.isInternalNavigable("https://asproject.my.id/u/dina-bagas"), true);
        expect("dashboard master",
                UrlPolicy.isInternalNavigable("https://asproject.my.id/master.html?k=abc"), true);
        expect("sub-domain wildcard",
                UrlPolicy.isInternalNavigable("https://dina-bagas.asproject.my.id/"), true);
        expect("404 router",
                UrlPolicy.isInternalNavigable("https://asproject.my.id/404.html"), true);

        System.out.println("\n3) Domain lain harus keluar aplikasi");
        expect("domain lain", UrlPolicy.isInternalNavigable("https://example.com/"), false);
        expect("whatsapp", UrlPolicy.isInternalNavigable("https://wa.me/?text=hai"), false);
        expect("google maps", UrlPolicy.isInternalNavigable("https://maps.google.com/?q=x"), false);
        expect("supabase", UrlPolicy.isInternalNavigable(
                "https://aalrhvirqwjtbbxmteeg.supabase.co/rest/v1/"), false);
        expect("jsdelivr", UrlPolicy.isInternalNavigable("https://cdn.jsdelivr.net/npm/x"), false);

        System.out.println("\n4) Upaya penyamaran host (tidak boleh dianggap internal)");
        expect("asproject.my.id.evil.com", UrlPolicy.isInternalNavigable("https://asproject.my.id.evil.com/studio.html"), false);
        expect("evil.com/asproject.my.id", UrlPolicy.isInternalNavigable("https://evil.com/asproject.my.id"), false);
        expect("notasproject.my.id", UrlPolicy.isInternalNavigable("https://notasproject.my.id/"), false);
        expect("xasproject.my.id", UrlPolicy.isInternalNavigable("https://xasproject.my.id/"), false);
        expect("evil.my.id", UrlPolicy.isInternalNavigable("https://evil.my.id/"), false);
        expect("host huruf besar tetap dikenali",
                UrlPolicy.isInternalNavigable("HTTPS://ASPROJECT.MY.ID/studio.html"), true);
        expect("userinfo: evil.com@asproject.my.id tetap domain Studio",
                UrlPolicy.isInternalNavigable("https://evil.com@asproject.my.id/studio.html"), true);
        expect("titik di akhir host dinormalisasi",
                UrlPolicy.isInternalNavigable("https://asproject.my.id./studio.html"), true);

        System.out.println("\n5) HTTP dinaikkan ke HTTPS (tidak pernah dimuat sebagai HTTP)");
        expect("http internal bukan rute internal",
                UrlPolicy.isInternalNavigable("http://asproject.my.id/studio.html"), false);
        expect("http internal dikenali sebagai domain Studio",
                UrlPolicy.isInternalHost("http://asproject.my.id/studio.html"), true);
        expectEquals("http dinaikkan ke https",
                UrlPolicy.upgradeToHttps("http://asproject.my.id/studio.html"),
                "https://asproject.my.id/studio.html");
        expectEquals("http domain lain tidak diubah",
                UrlPolicy.upgradeToHttps("http://example.com/x"), "http://example.com/x");

        System.out.println("\n6) Skema internal WebView (blob:, data:, javascript:)");
        expect("blob tidak dianggap navigasi biasa",
                UrlPolicy.isNonNavigableScheme("blob:https://asproject.my.id/1234"), true);
        expect("data url", UrlPolicy.isNonNavigableScheme("data:text/html,<b>x</b>"), true);
        expect("javascript url", UrlPolicy.isNonNavigableScheme("javascript:void(0)"), true);
        expect("blob bukan tautan luar",
                UrlPolicy.shouldOpenExternally("blob:https://asproject.my.id/1234"), false);
        expect("data url bukan tautan luar",
                UrlPolicy.shouldOpenExternally("data:text/plain,hi"), false);

        System.out.println("\n7) Tautan ke aplikasi lain");
        expect("whatsapp:", UrlPolicy.isExternalAppScheme("whatsapp://send?text=hai"), true);
        expect("tel:", UrlPolicy.isExternalAppScheme("tel:+628123456789"), true);
        expect("mailto:", UrlPolicy.isExternalAppScheme("mailto:a@b.c"), true);
        expect("intent:", UrlPolicy.isExternalAppScheme("intent://scan/#Intent;scheme=zxing;end"), true);
        expect("https bukan skema aplikasi",
                UrlPolicy.isExternalAppScheme("https://wa.me/"), false);
        expect("wa.me dikirim ke luar", UrlPolicy.shouldOpenExternally("https://wa.me/?text=x"), true);
        expect("maps dikirim ke luar", UrlPolicy.shouldOpenExternally("https://maps.app.goo.gl/abc"), true);
        expect("halaman Studio tidak dikirim ke luar",
                UrlPolicy.shouldOpenExternally("https://asproject.my.id/studio.html"), false);
        expect("jadwal kosong tidak membuka apa pun", UrlPolicy.shouldOpenExternally(""), false);
        expect("null tidak membuka apa pun", UrlPolicy.shouldOpenExternally(null), false);

        System.out.println("\n8) Penguraian URL");
        UrlPolicy.Parts parts = UrlPolicy.parse("https://asproject.my.id:8443/studio.html?a=1#b");
        expectEquals("skema", parts.scheme, "https");
        expectEquals("host tanpa port", parts.host, "asproject.my.id");
        expectEquals("skema relatif kosong", UrlPolicy.parse("/studio.html").scheme, "");
        expectEquals("host relatif kosong", UrlPolicy.parse("/studio.html").host, "");
        expectEquals("skema tak dikenal", UrlPolicy.parse("ftp://files.example/x").scheme, "ftp");

        System.out.println("\nRingkasan: " + passed + " lulus, " + failed + " gagal");
        if (failed > 0) {
            System.exit(1);
        }
    }
}
