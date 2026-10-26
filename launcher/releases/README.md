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
38c1fd6f92f9c2f966db7f18b3858dbe7079f3f61ed4c255161fb12adf615261
```

## Perbaikan terbaru (penting)

Dilaporkan masih macet (ANR) di **Vivo Y50** (Snapdragon 665, Android
10/11) bahkan setelah pemindaian aplikasi dipindah ke thread latar
belakang. Dugaan kuat berikutnya: perangkat ini kelas menengah-bawah rilis
2020, dan animasi Canvas berat (liquid wallpaper 3D + HUD berputar) yang
berjalan terus-menerus di thread utama sejak layar pertama dibuka mungkin
terlalu berat untuk GPU/CPU-nya.

**Perubahan di build ini:**
- **Nilai bawaan animasi berat sekarang otomatis dimatikan di HP yang
  terdeteksi kelas menengah-bawah/lama** (heuristik: `isLowRamDevice()` atau
  Android ≤ 11 / API ≤ 30) — animasi liquid motion & HUD berputar tidak
  menyala otomatis di pemasangan baru pada perangkat seperti itu. Ikon neon,
  jam, dan layar kunci tetap tampil seperti biasa, hanya animasinya yang
  diam di awal. Bisa dinyalakan manual lewat Pengaturan kalau ternyata
  perangkatnya lancar-lancar saja.
- Pencatat crash darurat (`CrashLog`) sekarang dicek **sedini mungkin** di
  `onCreate()` (bukan di akhir), supaya tetap sempat tampil walau aplikasi
  crash berulang sebelum sempat selesai memuat.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini (uninstall dulu yang lama) dan coba lagi.
