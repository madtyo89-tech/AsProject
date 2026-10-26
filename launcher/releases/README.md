# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.3-debug.apk` | ±1,2 MB | APK uji, ditandatangani kunci **debug** Android |
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
a21c08dd6baaca4130fa03b64e7eb9d93ced4490d8cf8a931230399aa3fe056c
```

## Versi

`versionCode 4` / `versionName 1.0.3` — dinaikkan tiap build uji ANR supaya
pemasangan ulang dikenali Android sebagai **pembaruan** (tidak perlu
uninstall manual dulu), dan supaya versi yang terpasang bisa dicek lewat
**Pengaturan → Aplikasi → AsProject Launcher → lihat versi**.

## Build ini (1.0.3): paksa nonaktifkan animasi berat + detak jantung runtime

Build `1.0.2` (pelacak checkpoint `StartupTrace` di `onCreate()`/`onResume()`)
sudah dicoba di Vivo Y50 dan **tetap macet — kali ini TANPA dialog apa pun
yang muncul sama sekali**, bahkan dialog diagnostik checkpoint yang baru.
Itu artinya macetnya terjadi **SESUDAH** `onResume()` selesai dengan
selamat (checkpoint-nya sudah keburu terhapus otomatis) — jadi bukan hang
saat proses mulai, melainkan hang di tengah pemakaian normal, kemungkinan
besar gara-gara **animasi berat yang jalan terus-menerus di thread utama**
(wallpaper liquid 3D, HUD layar kunci).

Ditemukan juga kemungkinan bug lain yang menjelaskan kenapa perbaikan
"nonaktifkan animasi berat secara bawaan di perangkat kelas bawah"
(build-build sebelumnya) tidak pernah benar-benar berlaku: APK ini selalu
dipasang sebagai **pembaruan** (bukan uninstall bersih), jadi preferensi
tersimpan dari pemasangan PERTAMA (sebelum pengaman itu ada) ikut terbawa
terus — nilai "bawaan" yang baru tidak pernah sempat dipakai karena
key-nya sudah keburu ada isinya.

**Dua perubahan di build ini:**
1. `Prefs`: migrasi sekali-jalan yang MEMAKSA liquid motion & animasi HUD
   mati di perangkat kelas bawah, apa pun nilai yang sudah tersimpan
   sebelumnya (tidak lagi sekadar "nilai bawaan" yang bisa kalah oleh data
   lama). Tetap bisa dinyalakan lagi manual lewat Pengaturan kapan saja.
2. `StartupTrace` sekarang punya "detak jantung" yang menimpa checkpoint
   yang sama setiap 4 detik SELAMA aplikasi di layar depan (bukan cuma
   saat `onCreate()`/`onResume()`). Kalau macetnya memang terjadi di
   tengah animasi/pemakaian normal, checkpoint terakhir yang tertinggal
   seharusnya menunjukkan itu di peluncuran berikutnya.

Tolong pasang build ini, pakai seperti biasa, dan kalau macet lagi **buka
ulang aplikasinya (atau restart HP, lalu buka lagi)** — foto layar apa pun
yang muncul (dialog diagnostik atau tidak sama sekali) dan kabarkan juga
kalau animasinya terasa sudah berhenti/diam (tanda migrasi animasi di atas
berhasil jalan).

## Riwayat perbaikan sebelumnya

- **1.0.2** — `StartupTrace`: checkpoint di `onCreate()`/`onResume()`,
  dihapus begitu proses mulai selesai. Hasil tes: tetap macet, **tanpa
  dialog apa pun** → terbukti macetnya terjadi sesudah proses mulai
  selesai, bukan selama proses mulai (lihat bagian di atas).
- **1.0.1** — `showPendingCrashIfAny()` dipindah ke paling awal
  `onCreate()`, sebelum `setContentView()`. Hasil tes: tetap macet, dialog
  crash tetap tidak pernah muncul → mengonfirmasi ini bukan crash biasa
  (exception), melainkan dugaan ANR murni (hang).
- Perbaikan-perbaikan lebih awal (CrashLog di akhir `onCreate`, nilai
  bawaan animasi perangkat kelas bawah, `AppWidgetHost` try/catch) juga
  sudah dicoba dan tidak mengatasi macetnya — lihat riwayat commit di
  pull request untuk detail masing-masing.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini dan coba lagi.
