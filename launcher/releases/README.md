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
024c6430ae0a14584f70a31624d9651ebe079f92ec24e7c844688580f5d41db4
```

## Perbaikan terbaru (penting)

Build ini memperbaiki **bug macet (ANR)** yang bisa muncul tak lama setelah
AsProject dipasang sebagai launcher default di HP dengan banyak aplikasi
terpasang (umum di ROM vendor seperti Vivo/Oppo/Xiaomi): pemindaian daftar
aplikasi (`PackageManager`) yang sebelumnya berjalan di thread utama setiap
kali beranda muncul kembali, sekarang dipindah ke thread latar belakang.
Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini dan coba lagi.
