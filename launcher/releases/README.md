# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.0-debug.apk` | ±1,6 MB | APK uji, ditandatangani kunci **debug** Android |
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
8d6b36c509964e61dd3f8a25edf5fa2e382c0c7774660511c71546af6c880031
```

## Perbaikan terbaru (penting)

Masih dilaporkan macet di **Vivo Y50** walau sudah dicoba dua perbaikan
sebelumnya. Audit kode ditemukan **satu titik lagi yang belum pernah
dibungkus try/catch**: `AppWidgetHost.startListening()`/`stopListening()`
dipanggil di SETIAP `onResume()`/`onPause()` tanpa pengaman — padahal ini
panggilan Binder ke layanan sistem yang dilaporkan bisa melempar
`RuntimeException` (membungkus `TransactionTooLargeException` /
`DeadObjectException`) di berbagai ROM vendor kalau layanan widgetnya
bermasalah. Launcher resmi (AOSP Launcher3) sendiri membungkus panggilan
ini dengan try/catch untuk alasan yang sama. Kalau ini penyebabnya,
aplikasi akan crash di SETIAP `onResume()` — yaitu tiap kali dibuka —
cocok dengan gejala "selalu macet sejak awal, tidak pernah berhasil".

**Perubahan di build ini:**
- `AppWidgetHost.startListening()`/`stopListening()` dan konstruksi
  `AppWidgetManager`/`AppWidgetHost` di `onCreate()` sekarang dibungkus
  try/catch — kalau gagal, fitur widget sekadar tidak tersedia, beranda
  tetap bisa dibuka.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini (uninstall dulu yang lama) dan coba lagi.
