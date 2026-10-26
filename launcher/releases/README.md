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
41d541149bb851cc08c2fd7a76971e4bada88b6c96dcee1f2212e8ad763cbc2c
```

## Perbaikan terbaru (penting)

Dikonfirmasi: di Vivo Y50, macetnya terjadi **persis sama bahkan saat dibuka
dari app drawer biasa** (belum dijadikan launcher default), dan **tidak ada
dialog apa pun yang terlihat** — termasuk dialog pencatat crash darurat
(`CrashLog`) yang sudah ditambahkan sebelumnya. Ternyata ada bug di urutan
pengecekannya sendiri: dialog itu dicek **setelah** `setContentView()`,
padahal `setContentView()` adalah tempat SEMUA View kustom (wallpaper,
layar kunci, jam, dll) dikonstruksi — kalau crash-nya ada di situ dan
terjadi berulang di titik yang sama persis tiap kali, pengecekan dialog
tidak akan pernah sampai tereksekusi, pada percobaan manapun.

**Perubahan di build ini:** `showPendingCrashIfAny()` dipindah ke **paling
awal `onCreate()`, sebelum `setContentView()`** — dialog punya Window
sendiri jadi tidak perlu menunggu layout selesai dibuat. Build ini murni
build diagnosis: kalau sekarang muncul dialog "AsProject sempat berhenti
sebelumnya", itu bukti nyata pertama yang kita punya. Kalau tetap tidak ada
dialog apa pun dan macetnya sama persis, itu petunjuk kuat bahwa ini
benar-benar hang (ANR murni, tanpa exception), bukan crash.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini (uninstall dulu yang lama) dan coba lagi.
