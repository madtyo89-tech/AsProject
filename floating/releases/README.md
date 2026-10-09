# APK uji AsProject Floating

Berkas `asproject-floating-1.0.0-debug.apk` adalah **APK debug** untuk uji coba cepat di
ponsel — tidak perlu membangun sendiri.

- Bertanda tangan kunci debug Android (bukan kunci rilis). Untuk produksi, bangun APK rilis
  dengan keystore Anda (lihat [../docs/BUILD-APK.md](../docs/BUILD-APK.md)).
- Integritas: `SHA256SUMS.txt` berisi hash SHA-256 APK; cocokkan setelah mengunduh.
- APK ini dibuat dari commit yang sama oleh build tanpa Gradle dan diverifikasi CI
  (workflow `android-floating-apk.yml`).

Memasang: salin APK ke ponsel → buka → izinkan "Pasang aplikasi tidak dikenal" → pasang.
