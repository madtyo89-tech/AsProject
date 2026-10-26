# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.6-debug.apk` | ±1,2 MB | APK uji, ditandatangani kunci **debug** Android |
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
b752324e552a29243276c7413b2b10dc6823c0a7fffc808306943054b567e4b5
```

## Versi

`versionCode 7` / `versionName 1.0.6` — dinaikkan tiap build uji ANR supaya
pemasangan ulang dikenali Android sebagai **pembaruan** (tidak perlu
uninstall manual dulu), dan supaya versi yang terpasang bisa dicek lewat
**Pengaturan → Aplikasi → AsProject Launcher → lihat versi**.

## Isolasi ANR bertahap — ketemu tersangka kuat: AppWidgetHost

Build `1.0.5` (kerangka `LauncherActivity` + `AppWidgetManager`/
`AppWidgetHost` dibuat seperti biasa, semua fitur visual lain masih mati)
**TETAP MACET** di Vivo Y50, lagi-lagi **tepat sesudah dipasang** — pola
yang sama persis dengan hampir semua percobaan sebelumnya. Satu-satunya hal
baru & tidak bersyarat dibanding `1.0.4` (yang TERBUKTI lancar berjam-jam)
adalah pembuatan `AppWidgetManager`/`AppWidgetHost` di `onCreate()`.

`AppWidgetHost`/`AppWidgetManager` adalah panggilan **Binder ke
system_server**. Kalau layanan widget sistem di ROM ini lambat/bermasalah
merespons — terutama tepat sesudah instal, saat sistem mungkin masih sibuk
memproses paket yang baru dipasang — panggilan ini **bisa blocking/hang
untuk waktu lama atau selamanya, TANPA pernah melempar exception apa pun**.
Itulah kenapa `try/catch` yang sudah dipasang sejak lama tidak pernah
menolong: `try/catch` cuma melindungi dari exception, bukan dari panggilan
yang macet/menunggu selamanya.

**Build ini (1.0.6):** pembuatan `AppWidgetManager`/`AppWidgetHost`
**dinonaktifkan sepenuhnya** lewat flag `DIAGNOSTIC_WIDGETS_ENABLED = false`
di `LauncherActivity` — bukan dibungkus try/catch lagi (karena itu tidak
cukup), tapi benar-benar dilewati sama sekali. Semua kode yang bergantung
padanya (tombol widget, `restoreWidgets()`, `safeStartListening()`/
`safeStopListening()`) sudah lama dirancang aman menerima `null` di sini
(awalnya untuk kasus exception), jadi tidak perlu perubahan lain — beranda
akan tampil tanpa dukungan widget untuk sementara.

**Kalau build ini lancar** → `AppWidgetHost` TERBUKTI jadi biang kerok
ANR-nya, dan solusi permanennya: buat widget host-nya "malas" (`lazy-init`,
baru dibuat saat pengguna benar-benar membuka menu tambah widget), bukan
di setiap `onCreate()`. **Kalau build ini masih macet juga** → dugaan ini
salah, lanjut ke kandidat berikutnya (`Typefaces.apply()`, `AppDrawerView`,
atau `GestureDetector`).

## Riwayat tahap sebelumnya

- **1.0.5** — kerangka `LauncherActivity` + `AppWidgetHost`/
  `AppWidgetManager` dibuat seperti biasa, fitur visual lain mati. Hasil
  tes: **macet lagi**, tepat sesudah instal.
- **1.0.4** — beranda super polos (`MinimalLauncherActivity`), tanpa fitur
  berat apa pun (termasuk tanpa widget). Hasil tes: **lancar**, dipakai
  berjam-jam tanpa macet.
- **1.0.3** — `LauncherActivity` lengkap + paksa nonaktifkan animasi berat
  + detak jantung runtime. Hasil tes: tetap macet.
- **1.0.2** — `StartupTrace` checkpoint `onCreate()`/`onResume()`. Hasil
  tes: tetap macet, tanpa dialog apa pun.
- **1.0.1** — dialog `CrashLog` dipindah ke paling awal `onCreate()`. Hasil
  tes: tetap macet, dialog tetap tidak pernah muncul.
- Perbaikan-perbaikan lebih awal (CrashLog di akhir `onCreate`, nilai
  bawaan animasi perangkat kelas bawah, `AppWidgetHost` try/catch) juga
  sudah dicoba dan tidak mengatasi macetnya — lihat riwayat commit di
  pull request untuk detail masing-masing.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini dan coba lagi.
