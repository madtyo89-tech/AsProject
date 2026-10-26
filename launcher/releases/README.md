# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.4-debug.apk` | ±1,2 MB | APK uji, ditandatangani kunci **debug** Android |
| `SHA256SUMS.txt` | — | Sidik jari SHA-256 berkas di atas |

## Memasang

1. Salin APK ke ponsel (kabel, Google Drive, atau tautan langsung).
2. Buka berkasnya → izinkan **"Pasang aplikasi tidak dikenal"** untuk aplikasi
   yang membuka berkas (Files/Chrome).
3. Setelah terpasang: **Pengaturan → Aplikasi → Aplikasi default → Aplikasi
   beranda → AsProject Launcher**, atau tekan Home lalu pilih
   "AsProject Launcher → Selalu".

## Memeriksa keaslian berkas

```bash
sha256sum -c SHA256SUMS.txt
```

## Catatan tanda tangan

Kunci debug Android **bukan kunci rahasia**, tetapi juga bukan kunci rilis:
Play Store menolak APK bertanda debug, dan pembaruan hanya bisa dipasang di atas
APK yang ditandatangani kunci yang sama. Untuk APK rilis, lihat
[../docs/BUILD-APK.md](../docs/BUILD-APK.md) §4.

SHA-256 APK saat ini:

```
05ceb83a08363ba11b2bebd231a534ac388411706c75e685877c580ef96abea5
```

## Versi

`versionCode 5` / `versionName 1.0.4` — dinaikkan tiap build uji ANR supaya
pemasangan ulang dikenali Android sebagai **pembaruan** (tidak perlu
uninstall manual dulu), dan supaya versi yang terpasang bisa dicek lewat
**Pengaturan → Aplikasi → AsProject Launcher → lihat versi**.

## PENTING — build ini (1.0.4) adalah beranda SUPER POLOS, sementara

Build `1.0.3` (paksa matikan animasi berat + detak jantung runtime) sudah
dicoba di Vivo Y50 dan **masih macet persis sama**, dan ketiga mekanisme
diagnostik yang sudah dipasang (`CrashLog`, checkpoint `StartupTrace`, detak
jantung runtime) **tetap tidak pernah mencatat apa pun**. Karena tiga
pendekatan instrumentasi yang berbeda semuanya nihil, dugaan berubah: boleh
jadi penyebabnya BUKAN bug di kode fitur `LauncherActivity` (wallpaper
liquid 3D, HUD, widget, dll), melainkan sesuatu yang lebih mendasar.

**Build ini sengaja mengganti beranda yang tampil dengan versi
SE-POLOS-POLOSNYA (`MinimalLauncherActivity`)**: cuma kisi aplikasi standar
(ikon & label APA ADANYA dari sistem, tanpa ikon neon) + jam digital teks
biasa. **Tidak ada** wallpaper kustom, animasi Canvas, layar kunci, widget
sistem, atau spidometer sama sekali. `LauncherActivity` yang lengkap (semua
fitur fancy) tetap ada di dalam APK tapi untuk sementara TIDAK didaftarkan
sebagai "Aplikasi beranda" — supaya bisa diuji terpisah dari kompleksitas
fitur-fiturnya.

**Tujuan tes ini:** kalau beranda SEPOLOS INI ternyata **masih macet** di
HP yang sama, itu bukti kuat masalahnya bukan di kode fitur kita, melainkan
sesuatu yang lain (misalnya perilaku ROM Vivo terhadap status "aplikasi
beranda default" itu sendiri). Kalau beranda polos ini **lancar/tidak
macet**, baru fitur-fitur fancy-nya dikembalikan satu per satu sampai
ketemu biang keroknya.

Mekanisme diagnostik (`CrashLog` + `StartupTrace` + detak jantung) tetap
aktif di build ini — kalau ternyata tetap macet, tolong buka ulang
aplikasinya dan foto apa pun yang muncul (atau kabarkan kalau tidak ada
apa-apa lagi).

## Riwayat perbaikan sebelumnya

- **1.0.3** — paksa nonaktifkan animasi berat (liquid motion & HUD) di
  perangkat kelas bawah + detak jantung runtime 4 detik. Hasil tes: tetap
  macet, tanpa dialog apa pun.
- **1.0.2** — `StartupTrace`: checkpoint di `onCreate()`/`onResume()`.
  Hasil tes: tetap macet, tanpa dialog apa pun.
- **1.0.1** — `showPendingCrashIfAny()` dipindah ke paling awal
  `onCreate()`, sebelum `setContentView()`. Hasil tes: tetap macet, dialog
  crash tetap tidak pernah muncul.
- Perbaikan-perbaikan lebih awal (CrashLog di akhir `onCreate`, nilai
  bawaan animasi perangkat kelas bawah, `AppWidgetHost` try/catch) juga
  sudah dicoba dan tidak mengatasi macetnya — lihat riwayat commit di
  pull request untuk detail masing-masing.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini dan coba lagi.
