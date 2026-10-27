# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.7-debug.apk` | ±1,2 MB | APK uji, ditandatangani kunci **debug** Android |
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
861d119d0496c83125d01640f0c4b73e3bba55a13c0182944611e5e13ad266e6
```

## Versi

`versionCode 8` / `versionName 1.0.7` — dinaikkan tiap build uji ANR supaya
pemasangan ulang dikenali Android sebagai **pembaruan** (tidak perlu
uninstall manual dulu), dan supaya versi yang terpasang bisa dicek lewat
**Pengaturan → Aplikasi → AsProject Launcher → lihat versi**.

## Isolasi ANR bertahap — AppWidgetHost GUGUR, kandidat baru: jam seven-segment

`1.0.6` (AppWidgetHost/AppWidgetManager dinonaktifkan total, fitur visual
lain masih mati lewat flag) **TETAP MACET** — tepat sesudah instal, pola
yang sama persis. Ini membuktikan `AppWidgetHost` **bukan** penyebabnya
(atau bukan satu-satunya).

Temuan penting sesudahnya: mematikan flag `figureWallpaper`/`lockScreen`/
`neonIcons` lewat `Prefs` **tidak** mencegah empat kelas `View` kustom yang
berat (`HomeWallpaperView`, `SevenSegmentClockView`, `AppDrawerView`,
`LockScreenView`) untuk tetap dibuat (constructor + `onAttachedToWindow()`)
saat `activity_launcher.xml` di-*inflate* — flag itu cuma mengatur
`setVisibility()`/perilaku SESUDAH objeknya dibuat, bukan apakah objeknya
dibuat sama sekali. Artinya tahap `1.0.5`/`1.0.6` sebenarnya TIDAK pernah
benar-benar mengisolasi "cuma plumbing" seperti yang dikira — keempat kelas
itu tetap aktif di baliknya.

Dari keempatnya, hanya **satu** yang benar-benar tampil & menggambar ulang
tiap detik tanpa syarat di tahap `1.0.5`/`1.0.6`: **`SevenSegmentClockView`**
(jam di beranda). `HomeWallpaperView` dan `LockScreenView` default-nya
`GONE` kalau fiturnya dimatikan (`View` yang `GONE` dilewati total dari
proses ukur/tata letak/gambar oleh Android), begitu juga `AppDrawerView`
(laci tertutup = `GONE`). Jadi kalau ada kelas `View` kustom yang masih
"hidup" dan berpotensi jadi biang ANR di tahap sebelumnya, jam inilah
kandidat yang paling masuk akal.

**Build ini (1.0.7):** jam `SevenSegmentClockView` di beranda **diganti
sementara** dengan `TextView` polos yang hanya menampilkan jam:menit,
diperbarui tiap menit lewat mekanisme yang sudah ada (`clockHandler`).
Tidak ada lagi `Canvas.drawPath`/trigonometri/`Shader` yang jalan di
beranda. Semua yang lain tetap sama seperti `1.0.6` (widget sistem
dinonaktifkan, wallpaper/layar kunci/ikon neon dipaksa mati).

**Kalau build ini lancar** → `SevenSegmentClockView` (atau logika gambar
seven-segment-nya) TERBUKTI jadi biang ANR-nya, dan solusinya: perbaiki/
sederhanakan `onDraw()` jam tersebut (atau render ke `Bitmap` cache sekali
lalu gambar ulang `Bitmap` itu saja tiap detik, bukan menggambar ulang path
segmen dari nol tiap kali). **Kalau build ini masih macet juga** →
`SevenSegmentClockView` bukan penyebabnya, dan fokus pindah ke kemungkinan
yang lebih mendasar: overhead verifikasi kelas/dexopt ART untuk method
bytecode besar & kompleks tepat sesudah instal di perangkat kelas bawah ini
(Snapdragon 665) — bukan bug di kode, melainkan performa sistem Android itu
sendiri saat pertama kali menjalankan kelas besar baru terpasang.

## Riwayat tahap sebelumnya

- **1.0.6** — `AppWidgetHost`/`AppWidgetManager` dinonaktifkan total (bukan
  cuma try/catch). Hasil tes: **macet lagi**, tepat sesudah instal. Kandidat
  AppWidgetHost gugur.
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
