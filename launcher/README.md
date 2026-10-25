# AsProject Launcher — beranda Android (APK)

Pengganti **layar beranda** Android: jam besar, pencarian instan, kisi aplikasi,
dan dock 5 ikon. Dibuat dengan API framework Android saja — **tanpa AndroidX,
tanpa pustaka pihak ketiga, dan tanpa satu pun izin**.

- Paket: `my.id.asproject.launcher` · Nama: **AsProject Launcher**
- `minSdk 21` (Android 5.0) → `targetSdk 34` (Android 14)
- Ukuran APK ±143 KB
- Izin: **nol** — tidak ada INTERNET, lokasi, kontak, mikrofon, maupun penyimpanan
- Kode: 7 kelas Java, 3 layout XML, 9 drawable vektor

## APK siap pasang

```
launcher/releases/asproject-launcher-1.0.0-debug.apk
```

Salin ke ponsel → buka → izinkan "Pasang aplikasi tidak dikenal". APK ini
bertanda tangan kunci debug Android, jadi hanya untuk uji coba (lihat
[docs/BUILD-APK.md](docs/BUILD-APK.md) §4 untuk APK rilis dengan kunci Anda).

Setelah terpasang, jadikan beranda bawaan:

> **Pengaturan → Aplikasi → Aplikasi default → Aplikasi beranda → AsProject Launcher**

Di sebagian ponsel (Xiaomi/Oppo/Vivo) jalurnya ada di **Pengaturan → Beranda**
atau cukup tekan tombol Home lalu pilih "AsProject Launcher → Selalu".

## Membangun sendiri

```bash
launcher/buildkit/build-apk.sh                 # butuh JDK 17+ dan Android SDK
FETCH_TOOLS=1 launcher/buildkit/build-apk.sh   # tanpa SDK: unduh alat (hash dipatok) lalu build
python3 launcher/tools/verify_apk.py launcher/out/asproject-launcher-1.0.0-debug.apk
```

Android Studio: buka folder `launcher/` sebagai proyek Gradle.
Skrip build memakai ulang mesin build `android/buildkit/build-apk.sh`
(aapt2 → kompilasi → d8 → apksigner), jadi tidak ada logika build yang diduplikasi.

## Yang bisa dilakukan

| Fitur | Cara pakai |
|-------|-----------|
| **Membuka aplikasi** | Ketuk ikon di kisi atau di dock |
| **Pencarian instan** | Ketik di kolom cari — kisi menyaring sambil mengetik (tidak peka huruf besar/kecil) |
| **Opsi per aplikasi** | Tekan lama ikon: Buka · Taruh/Keluarkan dari dock · Sembunyikan · Info aplikasi |
| **Mengatur dock** | Tekan lama ikon → Taruh di dock (maks 5). Bawaan diisi otomatis dari Telepon, Pesan, Peramban, Kamera, Galeri yang terpasang |
| **Menyembunyikan aplikasi** | Tekan lama ikon → Sembunyikan, atau lewat Pengaturan beranda → Pilih aplikasi… |
| **Ganti wallpaper** | Tekan lama area kosong beranda → Ganti wallpaper |
| **Mengatur tampilan** | Tombol roda gigi kanan atas: jam/tanggal, kolom pencarian, nama aplikasi, jumlah kolom (4/5/6) |
| **Ikut perubahan aplikasi** | Memasang/mencabut/memperbarui aplikasi langsung menyegarkan kisi tanpa perlu membuka ulang |

Detail teknis & keputusan desain: [docs/HASIL-TES-DAN-KETERBATASAN.md](docs/HASIL-TES-DAN-KETERBATASAN.md).

## Struktur folder

```
launcher/
├── app/src/main/
│   ├── AndroidManifest.xml              kategori HOME + LAUNCHER, <queries>, tanpa izin
│   ├── java/my/id/asproject/launcher/
│   │   ├── LauncherActivity.java        beranda: jam, cari, kisi, dock, dialog
│   │   ├── SettingsActivity.java        pengaturan beranda
│   │   ├── AppRepository.java           daftar aplikasi + tebakan isi dock
│   │   ├── AppGridAdapter.java          adaptor kisi
│   │   ├── IconLoader.java              ikon + LruCache + topeng squircle
│   │   ├── AppItem.java                 satu entri aplikasi
│   │   └── Prefs.java                   SharedPreferences
│   └── res/                             layout, drawable vektor, nilai, ikon mipmap
├── buildkit/build-apk.sh                pembungkus build tanpa Gradle
├── tools/make_icons.py                  pembuat ulang ikon PNG (Pillow)
├── tools/verify_apk.py                  verifikasi APK tanpa perangkat
├── releases/                            APK uji + SHA-256
└── docs/BUILD-APK.md                    build, tanda tangan rilis, CI
```

## Kustomisasi cepat

| Ingin | Ubah di |
|-------|---------|
| Warna emas/hitam | `app/src/main/res/values/colors.xml` |
| Ukuran ikon, jarak | `app/src/main/res/values/dimens.xml` |
| Teks & terjemahan | `app/src/main/res/values/strings.xml` |
| Jam besar / tema | `app/src/main/res/values/styles.xml`, `layout/activity_launcher.xml` |
| Ikon aplikasi | `python3 launcher/tools/make_icons.py` (ubah skripnya) |
