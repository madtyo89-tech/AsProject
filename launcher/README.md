# AsProject Launcher — beranda Android (APK)

Pengganti **layar beranda** Android: jam besar, pencarian instan, kisi aplikasi,
dock 5 ikon, **layar kunci bergaya HUD**, plus **wallpaper & 8 ikon neon sirkuit**
bawaan — semuanya satu tema: **liquid glass sirkuit** (permukaan kaca cair +
garis sirkuit neon). Dibuat dengan API framework Android saja — **tanpa AndroidX,
tanpa pustaka pihak ketiga, dan tanpa satu pun izin**.

- Paket: `my.id.asproject.launcher` · Nama: **AsProject Launcher**
- `minSdk 21` (Android 5.0) → `targetSdk 34` (Android 14)
- Ukuran APK ±1,15 MB (mayoritas: 1 wallpaper 1080 px + 8 ikon neon + font tema)
- Izin: **nol** — tidak ada INTERNET, lokasi, kontak, mikrofon, maupun penyimpanan
- Kode: 20 kelas Java, 5 layout XML, drawable + aset wallpaper/ikon & font tema

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
| **Layar kunci** | Muncul saat beranda dibuka dan setiap layar menyala; geser ke atas untuk membuka. Pojok kanan atas: **satu ikon baterai neon** seperti di bilah status |
| **Wallpaper neon** | Bingkai liquid-chrome di layar kunci (tidak terpotong), sirkuit neon + HUD di beranda. Bisa dimatikan di Pengaturan |
| **Ikon liquid glass sirkuit (semua aplikasi)** | 8 aplikasi populer memakai ikon contoh; **semua aplikasi lain** dibuatkan versi liquid glass otomatis dari ikon aslinya (`NeonIconFactory`): bentuk aplikasi jadi garis neon berongga di atas kaca cair, dengan jejak sirkuit di latar **dan** di dalam glyph — kisi jadi seragam tanpa menyiapkan gambar per aplikasi |
| **Laci aplikasi + liquid slide bar** | Geser ke atas di beranda → panel kaca cair meluncur dari bawah berisi SEMUA aplikasi, lengkap dengan kolom pencarian. Tepi atasnya beriak seperti cairan (liquid slide bar) dan beranda menyusut/memudar mengikuti gerakan laci |
| **Efek buka kunci dramatis** | Saat digeser, papan sirkuit ikut menyergap (simpangan ombak naik 3,2×, bidang memperbesar). Saat lepas: sapuan terang naik dari bawah, dua cincin shockwave melebar dari titik sentuh, percikan neon beterbangan, HUD memipih, dan konten melesat ke atas (300 ms) |
| **Efek scroll beranda** | Saat kisi aplikasi digulir, kepala (jam + tanggal) menyusut & memudar; saat laci dibuka, beranda menyusut + wallpaper memperbesar (parallax) |
| **Wallpaper sirkuit liquid 3D** | Layar kunci memakai **tiga bidang sirkuit** (jauh / tengah / dekat) yang digambar prosedural, diproyeksikan perspektif ke satu titik hilang, lalu diombak `drawBitmapMesh`; tiap bidang bergerak paralaks dengan sendirinya. Denyut cahaya, gelembung, dan kilau diproyeksikan ke koordinat yang sama, jadi ikut terombang-ambing bersama cairannya |
| **Font tema** | Share Tech Mono (OFL) ikut terpasang, dipakai di seluruh antarmuka |
| **Ikon baterai lingkaran bersegmen** | Cincin 20 ruas neon dengan aliran cair berjalan + angka persen di tengah; komet berputar saat mengisi daya | Ukuran kecil seperti ikon bilah status, di pojok kanan atas layar kunci: cairan neon beriak setinggi daya + kilat saat mengisi daya. Tidak ada ikon baterai kedua di HUD |
| **Jam seven segment** | Angka digital neon 7 ruas (ruas padam tetap terlihat redup), titik dua berkedip tiap detik; dipakai di layar kunci dan beranda. Mengikuti format 12/24 jam sistem |
| **HUD layar kunci (live)** | Panel di bawah layar kunci beranimasi: busur berputar, garis pindai, gelombang, jam berjalan, serta **daya & suhu baterai asli** |
| **Wallpaper liquid 3D** | Gambar digambar ulang tiap frame lewat mesh 20×34 (gelombang sinus berjalan) + kemiringan `Camera` + kilau melintas |
| **Kunci sekarang** | Tekan lama area kosong → Kunci layar |
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
│   │   ├── LockScreenView.java          layar kunci + gestur geser-ke-atas
│   │   ├── HomeWallpaperView.java       wallpaper sirkuit (mode cover)
│   │   ├── WallpaperFigure.java         decode + cache + mode gambar
│   │   ├── NeonIcons.java               peta paket → ikon neon khusus
│   │   ├── CircuitWallpaperView.java    papan sirkuit liquid 3D 3 bidang (layar kunci)
│   │   ├── AppDrawerView.java           laci aplikasi + gerakan geser
│   │   ├── LiquidHandleView.java        liquid slide bar (tepi beriak)
│   │   └── Typefaces.java               font tema (Share Tech Mono)
│   │   ├── NeonIconFactory.java         pembuat ikon liquid glass otomatis (semua aplikasi)
│   │   ├── LiquidBatteryView.java       ikon baterai neon (satu-satunya)
│   │   ├── SevenSegmentClockView.java   jam seven segment neon
│   │   ├── HudView.java                 HUD live (Canvas, busur/pindai/gelombang)
│   │   ├── LiquidWallpaperView.java     wallpaper mesh 3D berlapis (parallax)
│   │   ├── IconLoader.java              ikon + LruCache + topeng squircle
│   │   ├── AppItem.java                 satu entri aplikasi
│   │   └── Prefs.java                   SharedPreferences
│   ├── assets/wallpaper/                lock.jpg + home.jpg (dipakai LockScreenView)
│   └── res/                             layout, drawable vektor, nilai, ikon mipmap,
│                                        drawable-nodpi/ic_*.png (8 ikon neon)
├── buildkit/build-apk.sh                pembungkus build tanpa Gradle
├── tools/make_icons.py                  pembuat ulang ikon PNG (Pillow)
├── tools/make_preview.py                pembuat docs/pratinjau.html dari aset asli
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
| Ikon peluncur (mipmap) | `python3 launcher/tools/make_icons.py` (ubah skripnya) |
| Wallpaper | ganti `assets/wallpaper/lock.jpg` & `home.jpg` (JPEG potret, ±1080×2000) |
| Ikon neon khusus | ganti `res/drawable-nodpi/ic_*.png`, lalu sesuaikan `NeonIcons.java`; bisa juga dibuat ulang dari tangkapan layar acuan: `python3 launcher/tools/make_app_icons.py <berkas-potongan>` |
| Warna & kaca ikon otomatis | `NeonIconFactory` (konstanta `NEON`, `NEON_CORE`, `TRACE`, `GLASS_TOP/BOTTOM`, `RIM`) |
| Warna & ukuran ikon baterai | `LiquidBatteryView` (konstanta `SHELL_ON`, `LIQUID_*`, `GHOST`) |
| Jam seven segment | `SevenSegmentClockView` (tabel `SEGMENTS`, warna `ON`/`ON_CORE`/`OFF`, tebal ruas `0.115 × tinggi`) |
| Kecepatan liquid 3D | `LiquidWallpaperView` (`amplitude`, `phase`, `COLS/ROWS`) |
| Isi HUD | `HudView` (teks & tata letak per baris) |
| Font tema | ganti `app/src/main/assets/fonts/tech_mono.ttf` (atau konstanta `PATH` di `Typefaces`) |
| Papan sirkuit layar kunci | `CircuitWallpaperView` (`SEED`, jumlah jejak/chip/bus, `LAYER_PERSP`, warna jejak) |
| Kedalaman & parallax | `layerDepth()`, `layerPerspective()`, `layerAlpha()`, `meshCols()/meshRows()` di `CircuitWallpaperView`; `BASE_AMP`, `CAMERA_DISTANCE`, `PARALLAX_SCALE` di `LiquidWallpaperView` |
| Laci & slide bar | `AppDrawerView` (ambang buka `0.45`, durasi 260 ms), `LiquidHandleView` (riak & lengkungan) |
| Pratinjau HTML | `python3 launcher/tools/make_preview.py` |
