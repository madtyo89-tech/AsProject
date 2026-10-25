# Hasil tes & keterbatasan — AsProject Launcher

Ditulis apa adanya: apa yang **sudah** diverifikasi mesin, apa yang belum, dan
di mana risikonya.

## 1. Sudah diverifikasi otomatis

`python3 launcher/tools/verify_apk.py launcher/releases/asproject-launcher-1.0.0-debug.apk`
→ **62 lulus, 0 peringatan, 0 gagal**.

| Kelompok | Yang diperiksa |
|----------|----------------|
| Struktur | ZIP utuh (CRC), `resources.arsc` tidak terkompresi **dan** selaras 4 byte (syarat Android 11+), DEX format `035` (aman untuk API 21) |
| Identitas | `my.id.asproject.launcher`, minSdk 21, targetSdk 34, label "AsProject Launcher" |
| Peluncur | `provides-component:'launcher'`, kategori **HOME**, **DEFAULT**, **LAUNCHER** pada `LauncherActivity` |
| Privasi | **nol** `<uses-permission>` (diperiksa lewat `aapt2 dump permissions`), 19 izin terlarang dicek tidak tertanam |
| Keamanan | `SettingsActivity` `exported=false`, tidak ada aset web, tidak ada placeholder `${applicationId}` |
| Kode | 20/20 kelas Java ter-dex; string `android.intent.category.LAUNCHER`, `android.intent.action.MAIN`, `launcher_prefs` tertanam |
| Sumber daya | ikon `ic_launcher.png` di 5 kepadatan + ikon adaptif `mipmap-anydpi-v26` |
| Aset baru | `assets/wallpaper/lock.jpg` & `home.jpg` ada, 8 ikon neon tertanam (`ic_phone` … `ic_instagram`), tidak ada berkas JS |
| Tanda tangan | apksigner: v1 ✔, v2 ✔, v3 ✔ |

Yang **tidak** dilakukan mesin verifikasi: menjalankan aplikasinya.

## 1b. Aset wallpaper & ikon: asal dan batasannya

Wallpaper dan ikon berasal dari **screenshot yang dikirim pemilik proyek**
(`image_20261025_181759.webp` dan paket `circuit_icons_transparent.png`), lalu
diekstrak ulang dari tangkapan layar Meta AI — bukan berkas aslinya:

| Aset | Sumber di repo | Perlakuan |
|------|----------------|-----------|
| `assets/wallpaper/lock.jpg` | potongan y=346…2330 dari `Screenshot_20261025_225134.jpg` | dibersihkan dari bar UI Meta AI, JPEG q93 |
| `assets/wallpaper/home.jpg` | potongan y=306…2330 dari `Screenshot_20261025_225128.jpg` | idem |
| `res/drawable-nodpi/ic_*.png` | 8 tile 150 px dari `Screenshot_20261025_224613.jpg` | dipotong presisi, diperbesar ke 192 px + unsharp mask |
| `res/drawable-nodpi/wallpaper_*_thumb.jpg` | turunan 300 px | hanya untuk kartu di Pengaturan |

Konsekuensi yang harus diketahui:

- **Resolusi terbatas.** Wallpaper asli kemungkinan 1024×1536 (webp); yang
  tersedia di sini hasil tangkapan layar 1080 px. Pada layar 1440p gambar akan
  tampak sedikit lembut — bukan pecah, karena hanya diperbesar halus.
- **Ikon neon hanya 8** (sesuai paket). Aplikasi lain tetap memakai ikon
  aslinya; tidak ada ikon yang dipasangkan ke paket yang salah (pemetaan ada di
  `NeonIcons.java` dan hanya berlaku untuk paket yang dikenal).
- **Ikon neon bertema merek** (Chrome, WhatsApp, Instagram, dsb.). Mengganti
  ikon aplikasi pihak ketiga secara pribadi di perangkat sendiri umumnya wajar,
  tetapi **jangan** memakainya sebagai aset promosi/publikasi tanpa izin pemilik
  merek, dan jangan mengemas ulang aplikasi pihak ketiga dengan ikon tersebut.
- Berkas asli berukuran penuh tidak disimpan di repo (hanya hasil ekstraksi yang
  dipakai APK) agar repositori tetap ringan: total aset baru ±1,4 MB.

## 1c. Ikon neon untuk SEMUA aplikasi, HUD live, dan liquid 3D

### Ikon neon otomatis (`NeonIconFactory`)

Tidak ada gambar per aplikasi. Saat ikon pertama kali dibutuhkan:

1. ikon asli digambar ke bitmap 52 dp dan tiap piksel dihitung luminansinya;
2. **median** terang seluruh tile dipakai sebagai "warna latar" ikon, lalu selisih
   *mutlak* tiap piksel terhadap median menjadi intensitas. Memakai selisih mutlak
   berarti glyph yang lebih gelap dari latarnya pun ikut terdeteksi; memakai median
   (bukan rerata tepi) membuat ikon bidang-warna-penuh — WhatsApp, Chrome,
   Instagram — tidak berubah menjadi satu cincin raksasa;
3. tepi terluar (7%) dibuang: potongan ikon sering menyisakan latar tangkapan layar
   di sekelilingnya, dan itu menghasilkan cincin palsu;
4. ambang adaptif: hanya **30% piksel paling menonjol** yang dipertahankan, jadi
   yang digambar adalah *bentuk aplikasi*, bukan kotak penuh;
5. glyph diubah jadi **garis luar** (outline) lalu digambar sebagai lampu neon —
   glow lebar → glow sempit → inti tajam (inti digambar dua kali agar terbaca di
   48 dp) — di atas **kaca cair**: gradien gelap, sapuan diagonal, sorotan atas,
   kilau bawah, dan tepi terang (rim light);
6. terakhir, **jejak sirkuit** digambar dua kali: di latar kaca (acak-tertentu per
   paket) dan **di dalam bentuk glyph** dengan `PorterDuff.Mode.DST_IN`, sehingga
   motifnya mengikuti bentuk aplikasi, bukan sekadar latar.

Biaya: sekali per ikon (±5–15 ms di perangkat 2020-an; lebih lama di Android 5
karena blur berbasis CPU), hasilnya disimpan di `LruCache` sehingga tidak dihitung
ulang selama sesi. Cache dibuang saat aplikasi dipasang/dicabut/diperbarui.

**Batasan yang harus diketahui:** semua ikon memakai warna neon biru yang sama —
identitas warna merek (hijau WhatsApp, merah YouTube) hilang. Ini memang tujuan
gaya "sirkuit neon", tetapi berarti ikon tidak lagi membantu membedakan aplikasi
secepat ikon aslinya. Bisa dimatikan kapan saja di Pengaturan → Ikon.

### HUD layar kunci

| Elemen | Sumber |
|--------|--------|
| Jam (`22:51`) | waktu perangkat, diformat ulang tiap detik |
| `POWER 74%` + sel baterai | `ACTION_BATTERY_CHANGED` (sticky) / `BatteryManager` |
| `TEMP 22.4°C` | `EXTRA_TEMPERATURE` baterai (bukan suhu CPU) |
| `BIO-LOCK ARMED`, `SYS STATUS ONLINE`, `SIGNAL LINK OK`, `EST 0.23 ms`, `INTEGRITAS 98.2%` | **dekoratif** — angka EST/INTEGRITAS bergerak halus agar terasa hidup, bukan hasil pengukuran apa pun |

Animasi (busur berputar, garis pindai, gelombang, denyut) digambar di Canvas
60 fps dan hanya berjalan saat layar kunci terlihat.

### Tema liquid glass sirkuit

Satu tema untuk seluruh antarmuka: permukaan **kaca cair** (gradien gelap +
sorotan atas + sapuan bergerak + rim light) dengan **garis sirkuit neon** di
atasnya.

| Bagian | Wujud liquid glass-nya |
|--------|------------------------|
| Ikon aplikasi (`NeonIconFactory`) | tile kaca, glyph jadi garis neon berongga, jejak sirkuit di latar **dan** di dalam glyph |
| Ikon baterai pojok kanan atas (`LiquidBatteryView`) | ukuran kecil seperti ikon bilah status: cangkang + cairan neon beriak + kilat saat mengisi daya |
| Chip status kiri atas (`bg_glass_chip`) | kapsul kaca dengan garis tepi terang |
| Panel HUD (`HudView.drawPanel`) | kaca cair dengan sapuan terang yang berjalan pelan |

### Ikon baterai neon — cuma satu (`LiquidBatteryView`)

Dulu ada dua penanda baterai: kapsul di layar kunci **dan** 6 sel di HUD. Atas
permintaan, sekarang cukup **satu** ikon, di pojok kanan atas (posisi bilah
notifikasi), dan HUD hanya menampilkan angkanya. Digambar penuh di Canvas:

1. cangkang kaca berukuran `2.05 × tinggi` dengan sudut membulat;
2. kutub baterai di sisi kanan;
3. **cairan neon** setinggi daya, permukaannya beriak (10 segmen sinus) dengan
   garis tegangan permukaan yang terang — bagian "liquid" dari tema;
4. ruas kosong digambar redup (`GHOST`) saat daya tidak terbaca;
5. garis cangkang neon dengan glow, kilat saat mengisi daya, lalu angka persen
   monospace.

Animasi berjalan ~16 fps dan berhenti saat view tidak terlihat.

### Jam seven segment (`SevenSegmentClockView`)

Jam layar kunci dan beranda **bukan teks**: tiap angka digambar dari 7 ruas
(a…g) berbentuk segi enam berujung miring, persis papan LED digital.

- ruas menyala: neon `0xFF5FD8FF` + glow `BlurMaskFilter` + inti `0xFFE6FBFF`;
- ruas padam: `0x1F5FD8FF` — tetap digambar supaya bentuk angkanya terbaca
  (ciri khas seven segment);
- titik dua berkedip tiap detik; pembaruan dijadwalkan **tepat pada pergantian
  detik** (`1000 - millis % 1000`) supaya kedipnya tidak melenceng;
- mengikuti format 12/24 jam sistem lewat `DateFormat.is24HourFormat()`, dan
  angka puluhan jam yang nol dikosongkan pada format 12 jam;
- tidak memakai font apa pun → tampilannya identik di semua perangkat.

Catatan: jam di dalam HUD tetap memakai teks monospace (ia bagian dari panel
data "SECURE MONITOR", bukan jam utama).

### Laci aplikasi + liquid slide bar (`AppDrawerView`, `LiquidHandleView`)

Geser ke atas pada area kosong beranda (fling > 600 px/detik) membuka laci;
tarik gagang ke bawah, geser ke bawah saat kisi di posisi teratas, atau tombol
Kembali untuk menutup. Posisi disimpan dalam `progress` 0…1, dan tiap perubahan
dikirim ke `LauncherActivity.applyDrawerParallax()`:

| Elemen | Efek |
|--------|------|
| beranda | skala 1 → 0,90; alpha 1 → 0,55; geser −26 dp |
| wallpaper beranda | zoom 1 → 1,07 (parallax) |
| dock | alpha 1 → 0 |
| panel laci | alpha 0 → 1, skala 0,96 → 1 |

Gagangnya (`LiquidHandleView`) berupa gelombang berjalan 28 segmen: saat laci
ditarik melebihi batas, tepinya **melengkung** ke bawah (`setStretch`), dan
setiap kali laci membuka/menutup atau kisi digulir kencang, riaknya dipicu
(`pulse()`) lalu meredup sendiri.

### Efek scroll beranda

Saat kisi aplikasi digulir, kepala (jam seven segment + tanggal) menyusut 18%,
memudar, dan naik −18 dp; kolom pencarian ikut memudar. Jarak gulung
diperkirakan dari baris pertama yang terlihat, jadi pada perangkat dengan
tinggi baris berbeda efeknya tetap proporsional.

### Wallpaper sirkuit liquid 3D (`CircuitWallpaperView`)

Kedalaman dibangun dari tiga hal, bukan satu bidang yang diombak:

1. **Tiga bidang terpisah (parallax).** `jauh`, `tengah` (papan utama), dan
   `dekat` (latar depan sedikit di luar fokus). Tiap bidang punya skala,
   kemiringan, dan simpangan gelombang sendiri: bidang dekat bergerak ±1,6×
   lebih liar daripada bidang jauh, jadi mata membaca *ruang*.
2. **Proyeksi perspektif.** Tiap bidang diwarp ke satu titik hilang di atas
   layar (rasio lebar baris atas : bawah = 0,55 / 0,46 / 0,36). Jejak yang
   tadinya ortogonal jadi menyatu ke kejauhan, menyempit & menipis; chip dan
   pad ikut terforesing pendek. **Jejak "bus" vertikal panjang** sengaja
   ditambahkan karena garis lurus yang menyatu ke titik hilang adalah penanda
   3D yang paling kuat. Jarak juga dikabutkan (fog) sehingga bidang jauh
   memudar.
3. **Cairan.** Di atasnya, tiap bidang diombak tiga gelombang berjalan + riak
   halus (simpangan dasar 10 dp, lebih besar di bagian atas), lalu diberi
   keystone kamera. Yang terpenting: **denyut cahaya, gelembung, dan kilau
   diproyeksikan lewat `projectLayer()`** — memakai koordinat bidang yang sama
   — sehingga mereka ikut terombang-ambing mengikuti permukaannya, bukan
   melayang kaku di atasnya. Denyut kini berjalan menyusuri 9 jejak dengan
   ekor 6 titik + pijar lebar; 9 gelembung cairan naik perlahan sambil
   berayun; 4 kilau memanjang dan 2 kolam cahaya menandai permukaan basah.

Seni papannya (acak-tertentu, seed tetap): kisi titik, jejak ortogonal, jejak
"bertegangan" yang lebih terang, **pin berdiri** di sebagian sambungan, chip IC
bersisi ekstrusi, dan boket lembut di bidang dekat.

**Hemat kerja:** kisi tiap bidang berbeda kepadatannya — papan utama 20×34,
bidang jauh 12×20, bidang dekat 14×24 — total ~1.100 segiempat per frame,
bukan 2.100 bila semuanya seragam.

### Font tema (`Typefaces`)

`Share Tech Mono` (lisensi OFL-1.1) ikut terpasang di
`assets/fonts/tech_mono.ttf` (34 KB). Dipasang ke seluruh `TextView` di beranda,
laci, layar kunci, dan pengaturan lewat penelusuran rekursif; bila berkas tidak
ada, jatuh ke `Typeface.MONOSPACE`.

### Liquid 3D

`LiquidWallpaperView` menggambar ulang tiap bidang lewat `drawBitmapMesh` yang
simpulnya digeser tiga fungsi sinus + riak halus (amplitudo lebih besar di
bagian atas, sehingga terasa seperti cairan menumpuk). Setiap simpul lalu
diputar (rotasi X/Y ±3,2°) dan dibagi jarak kamera — sisi yang menjauh
menyusut (keystone) — sehingga bidang punya dimensi, bukan sekadar gambar
miring. Terakhir, satu pita kilau `PorterDuff.ADD` melintas pelan. Target
30 fps. Wallpaper beranda otomatis berhenti beranimasi saat layar kunci
menutupinya.

Kelas ini kini **berlapis**: turunan dapat mengembalikan lebih dari satu bidang
(`getLayerCount`, `createLayer`, `layerDepth`, `layerPerspective`,
`layerAlpha`, `meshCols/meshRows`) dan memakai hook `drawBackdrop`,
`drawLayerExtras`, `drawExtras`, serta `projectLayer()` untuk menempelkan
objek pada permukaan cair. Wallpaper foto (beranda) tetap satu bidang datar,
jadi perilakunya tidak berubah selain ombaknya yang sedikit lebih hidup.

**Perkiraan beban:** satu frame = 3 × `drawBitmapMesh` (total ~1.100
segiempat) + ~20 sprite (pijar/gelembung/kilau, digambar dari bitmap radial
yang dibuat sekali, bukan `BlurMaskFilter` per frame) + 1 gradien kilau. Di
perangkat kelas menengah seharusnya ringan, tetapi pada Android 5 (tanpa
hardware-accelerated mesh penuh) bisa terasa lebih berat. Karena itu ada
sakelar "Wallpaper liquid bergerak (3D)" dan "HUD layar kunci beranimasi".

## 2. Belum diuji di perangkat

APK ini dibangun di lingkungan tanpa emulator dan tanpa ponsel fisik, jadi
**belum ada satu pun uji interaksi nyata**. Semua perilaku runtime di bawah ini
adalah hasil pembacaan kode, bukan hasil observasi:

- tampilan jam mengikuti format 12/24 jam sistem (`TextClock`);
- penyaringan kisi saat mengetik;
- tekan lama ikon → dialog opsi;
- tekan lama area kosong → dialog beranda;
- daftar aplikasi muncul lengkap di Android 11+ (butuh `<queries>`);
- ikon adaptif terpotong rapi (squircle);
- pengaturan tersimpan setelah beranda ditutup.

**Checklist uji manual yang disarankan** (5 menit):

1. Pasang APK → jadikan beranda bawaan → tekan Home.
2. Pastikan **semua** aplikasi muncul (bukan hanya sebagian) — ini menguji `<queries>`.
3. Ketuk beberapa ikon: aplikasi terbuka, dan menekan Home kembali ke beranda tanpa animasi aneh.
4. Ketik di pencarian: kisi menyaring; tombol ✕ muncul; Kembali menghapus kata lebih dulu.
5. Tekan lama ikon → Sembunyikan → aplikasi hilang dari kisi → muncul lagi lewat Pengaturan beranda → Pilih aplikasi… (centang ulang untuk memunculkan).
6. Tekan lama ikon → Taruh di dock; ulangi sampai 5 ikon; ikon ke-6 memberi pesan "dock penuh".
7. Pasang aplikasi baru dari Play Store → ikon baru muncul tanpa membuka ulang beranda.
8. Putar layar: kisi menyesuaikan, pencarian tidak hilang.
9. Tekan lama area kosong → **Kunci layar** → layar kunci muncul; **geser ke atas** → kembali ke beranda.
10. Roda gigi → matikan "Nama aplikasi", ubah kolom ke 5 → kembali: perubahan langsung terlihat.
11. Roda gigi → matikan **Ikon neon** → ikon WhatsApp/Chrome/kamera kembali ke ikon aslinya.
12. Roda gigi → matikan **Layar kunci** → tekan Home: tidak ada layar kunci.
13. Matikan layar (tombol daya), nyalakan lagi → layar kunci muncul dengan chip
    "BATERAI xx%" yang angkanya **sama** dengan indikator baterai sistem.
14. Layar kunci: geser sedikit lalu lepas → kembali ke atas (tidak terbuka);
    geser jauh/cepat → terbuka.
15. **Ikon semua aplikasi**: buka kisi → setiap aplikasi (bukan hanya 8 yang
    khusus) tampil dengan gaya neon; aplikasi yang baru dipasang juga ikut.
16. **HUD live**: perhatikan busur berputar & garis pindai; jam di tengah HUD
    berubah tiap menit; `TEMP` masuk akal (bukan 0.0 atau --).
17. **Liquid bergerak**: perhatikan tepi cairan di beranda — bergerak halus,
    tidak "bergetar" atau patah; matikan sakelar animasi → gambar diam.
18. **Baterai**: dengan HUD + liquid menyala ±10 menit, cek pemakaian baterai di
    Pengaturan → Baterai. Bila terlalu tinggi, matikan salah satu animasi.

## 3. Keterbatasan yang diketahui

| Keterbatasan | Sebab / jalan keluar |
|--------------|----------------------|
| Launcher ini **tidak bisa** menjadi "Recents"/pengganti penuh sistem | Android hanya mengizinkan satu beranda; panel recent apps tetap milik sistem. Perilaku ini normal untuk launcher pihak ketiga. |
| Tidak ada widget | Widget butuh `AppWidgetHost` (ratusan baris + banyak kasus tepi). Belum termasuk di 1.0.0. |
| Tidak ada folder, ikon kustom, maupun penataan urutan manual | Kisi selalu urut abjad (Locale `id`). Fitur ini kandidat 1.1. |
| Wallpaper hanya bisa diganti lewat pemilih bawaan Android | Launcher tidak meminta izin penyimpanan; ia memanggil `ACTION_SET_WALLPAPER`. |
| Tidak ada animasi transisi khusus | `windowAnimationStyle=@null` agar perpindahan ke beranda terasa instan seperti launcher Pixel. |
| Ikon hanya di memori (LruCache) | Setiap proses beranda dimulai ulang, ikon dibaca ulang dari PackageManager. Untuk ±150 aplikasi ini masih di bawah 50 ms; tidak ada cache disk agar tidak menulis apa pun ke penyimpanan. |
| APK uji bertanda debug | Pembaruan di atasnya hanya dari APK bertanda kunci yang sama. Untuk rilis, lihat [BUILD-APK.md](BUILD-APK.md) §4. |
| Ponsel Xiaomi/Oppo/Vivo kadang "mengembalikan" beranda bawaan setelah pembaruan sistem | Batasan ROM, bukan aplikasi: set ulang di Pengaturan → Beranda. |
| Layar kunci ini **bukan** pengganti lock screen sistem | Android tidak mengizinkan aplikasi biasa menggantikan keyguard (butuh izin/aksesibilitas khusus yang sengaja tidak diminta). Yang ada: layar kunci milik beranda — muncul saat beranda dibuka dan saat layar menyala. Lock screen sistem tetap ada sebelum itu. |
| Wallpaper hanya mengubah tampilan beranda/layar kunci bawaan aplikasi | Tidak memanggil `WallpaperManager` (butuh izin `SET_WALLPAPER`), jadi wallpaper sistem & wallpaper layar kunci sistem tidak diubah. |
| Mode layar kunci memakai *cover* (bawaan) | Dipilih agar panel HUD animasi menyatu dengan gambar; pada rasio layar tak biasa, tepi bingkai bisa sedikit terpotong. Tersedia opsi "bingkai kosong" (tanpa HUD) bila ingin tampilan utuh. |
| Ikon neon memakai satu warna (biru) | Identitas warna merek hilang; lihat §1c. Bisa dimatikan. |
| Blur neon memakai CPU di Android lama | Ikon pertama kali muncul bisa terasa 20–40 ms di perangkat 2015; setelah masuk cache tidak ada biaya lagi. |

## 4. Kenapa tanpa izin sama sekali

Launcher biasanya meminta `QUERY_ALL_PACKAGES` (Android 11+) atau
`PACKAGE_USAGE_STATS`. Keduanya tidak dipakai di sini:

- daftar aplikasi dibaca lewat `queryIntentActivities` untuk
  `ACTION_MAIN` + `CATEGORY_LAUNCHER`, dan keterlihatan paket dibuka dengan blok
  `<queries>` di manifest — cara yang disarankan Google untuk peluncur;
- tidak ada akses internet, sehingga tidak ada telemetri yang mungkin dikirim;
- semua preferensi ada di `SharedPreferences` (`launcher_prefs.xml`) dan ikut
  cadangan Android (`allowBackup=true`).
