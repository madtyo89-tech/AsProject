# Hasil tes & keterbatasan — AsProject Launcher

Ditulis apa adanya: apa yang **sudah** diverifikasi mesin, apa yang belum, dan
di mana risikonya.

## 1. Sudah diverifikasi otomatis

`python3 launcher/tools/verify_apk.py launcher/releases/asproject-launcher-1.0.4-debug.apk`
→ **72 lulus, 0 peringatan, 0 gagal**.

| Kelompok | Yang diperiksa |
|----------|----------------|
| Struktur | ZIP utuh (CRC), `resources.arsc` tidak terkompresi **dan** selaras 4 byte (syarat Android 11+), DEX format `035` (aman untuk API 21) |
| Identitas | `my.id.asproject.launcher`, minSdk 21, targetSdk 34, label "AsProject Launcher" |
| Peluncur | `provides-component:'launcher'`, kategori **HOME**, **DEFAULT**, **LAUNCHER** pada `LauncherActivity` |
| Privasi | **nol** `<uses-permission>` (diperiksa lewat `aapt2 dump permissions`), 19 izin terlarang dicek tidak tertanam |
| Keamanan | `SettingsActivity` `exported=false`, tidak ada aset web, tidak ada placeholder `${applicationId}` |
| Kode | 21/21 kelas Java ter-dex; string `android.intent.category.LAUNCHER`, `android.intent.action.MAIN`, `launcher_prefs` tertanam |
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

### Efek buka kunci (`LockScreenView` + `CircuitWallpaperView.setUnlockProgress`)

Geser ke atas memberi umpan balik bertahap: konten mengikuti jari sambil
memudar (maksimal 75%), dan wallpaper ikut "menyergap" — simpangan ombak naik
bertahap sampai 0,6 progres. Saat lepas pada ambang (>16% tinggi atau
kecepatan >900 dp/s), `ValueAnimator` 300 ms menggerakkan progres ke 1,0
bersamaan dengan animasi konten (geser −55% tinggi, skala 1,08, memudar) dan
HUD yang memipih (skala Y 0,86).

Di dalam wallpaper, progres itu memicu empat hal:

| Efek | Cara |
|------|------|
| cairan menyergap | `amplitudeScale()` 1 → 3,2×; `layerZoom()` 1 → 1,05…1,12 (bidang dekat paling besar) |
| sapuan terang | pita gradien linear setinggi 55% layar yang naik dari bawah ke atas memakai `PorterDuff.ADD`, terang di tengah siklus (`sin(π·p)`) |
| gelombang shockwave | dua cincin neon melebar dari titik sentuh, tebal & alfa mengecil kuadratik |
| percikan | 16 titik pijar melesat dari titik sentuh dengan arah & kecepatan tetap, melambat lalu meredup |

Semuanya additive dan memakai sprite radial yang dibuat sekali — tidak ada
alokasi per frame.

Pratinjau HTML bisa memutarnya: **ketuk layar kunci** (atau tombol *Coba efek
buka kunci* di bawahnya).

### Folder & bentuk ikon per aplikasi (`HomeModel`, `AppItem.folder`, `NeonIconFactory.tilePath`)

Folder disimpan di `Prefs` sebagai baris teks `nama<TAB>kunci1,kunci2,…` —
tidak perlu tabel database. `HomeModel.build()` menggabungkan daftar aplikasi
dari `AppRepository` dengan folder itu setiap kali beranda dimuat ulang:
anggota yang sudah dicopot otomatis hilang dari folder, dan folder yang
akhirnya kosong ikut dibuang (lalu disimpan ulang, supaya pengaturan tidak
menumpuk sampah). Saat mencari, folder "dibongkar" sementara — hasil pencarian
menampilkan aplikasi aslinya satu per satu, supaya aplikasi di dalam folder
tetap bisa ditemukan.

Ikon folder bukan simbol generik: `IconLoader.renderFolder()` menggambar kaca
cair sirkuit kosong (`NeonIconFactory.drawFolderShell`) lalu menempelkan
mini-kisi 2×2 dari ikon anggotanya (maksimal 4) — jadi isinya kelihatan
sekilas tanpa harus dibuka. Dialognya sendiri (`view_folder.xml`) memakai
`GridView` kecil di atas panel kaca cair (`bg_folder_glass`), dan setiap
anggotanya bisa langsung diketuk atau ditekan-lama untuk opsi.

Bentuk tile ikon tidak lagi tunggal: `NeonIconFactory.tilePath()` punya empat
pilihan — squircle (bawaan), lingkaran, kotak bersudut tegas, dan segi delapan
— disimpan per aplikasi lewat `Prefs.iconStyle(key)`. Semua lapisan ikon (kaca,
sapuan, rim light, jejak sirkuit, glow neon) memakai `Path` yang sama, jadi
bentuknya konsisten di setiap lapis, bukan cuma pada clip terluar.

### Widget di beranda (`AppWidgetHost`, tanpa izin apa pun)

Beranda bisa menampung widget sistem sungguhan (jam, cuaca, kalender, musik,
dll — apa pun yang disediakan aplikasi lain), ditempel sebagai kartu kaca cair
(`bg_widget_frame`) yang digeser mendatar di atas kolom pencarian.

Alurnya sengaja dipilih supaya **tidak perlu mendeklarasikan izin apa pun** di
manifest (konsisten dengan prinsip izin minimal launcher ini — lihat §4):

1. `AppWidgetHost` dengan ID tetap (`WIDGET_HOST_ID`) dibuat di `onCreate`,
   `startListening()`/`stopListening()` mengikuti `onResume`/`onPause`.
2. Daftar widget terpasang diambil dari `AppWidgetManager.getInstalledProviders()`
   lalu ditawarkan lewat dialog buatan sendiri (bukan `ACTION_APPWIDGET_PICK`,
   yang tidak tersedia konsisten di semua ROM).
3. ID widget dialokasikan via `host.allocateAppWidgetId()`, lalu dicoba pasang
   langsung dengan `AppWidgetManager.bindAppWidgetIdIfAllowed()` — ini berhasil
   **tanpa izin BIND_APPWIDGET** selama AsProject Launcher sedang aktif sebagai
   Aplikasi beranda bawaan (sistem mempercayai launcher default untuk urusan
   widget).
4. Bila ditolak (mis. launcher belum dijadikan bawaan), sebagai jalan keluar
   dipakai `Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)` lewat
   `startActivityForResult` — sistem sendiri yang menampilkan dialog
   konfirmasi; **masih tanpa deklarasi izin apa pun**.
5. Widget yang minta layar konfigurasi (`info.configure != null`, mis. widget
   cuaca yang perlu memilih kota) diarahkan ke situ dulu lewat
   `ACTION_APPWIDGET_CONFIGURE` sebelum ditempel.
6. ID widget yang sedang ditempel disimpan di `Prefs.widgetIds()` (daftar
   angka dipisah koma) dan dipulihkan lagi saat beranda dibuat ulang
   (`restoreWidgets()`); widget yang providernya sudah hilang (aplikasinya
   dicopot) otomatis dibuang dari daftar.

Tekan lama kartu widget untuk melepasnya dari beranda (`confirmRemoveWidget`).

**Keterbatasan:** ukuran widget tidak bisa diseret untuk diperbesar/perkecil
(host hanya memakai ukuran minimum bawaan widget); beranda memuat widget
berjajar mendatar, bukan kisi bebas seperti launcher penuh fitur.

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

## 1d. Bug macet (ANR) di HP nyata — ditemukan & diperbaiki

**26 Okt 2026**: APK ini pertama kali dipasang & dijadikan beranda bawaan di
HP fisik (Vivo, Funtouch/OriginOS). Tak lama setelah itu, sistem "Mesin
Pintar" Vivo menampilkan notifikasi *"'AsProject Launcher' mengalami
macet"* (ANR generik, tanpa stack trace) dan layar beranda sempat kosong/abu-abu.

**Akar masalah (ditemukan lewat audit kode, bukan logcat — sandbox ini tidak
punya akses ADB ke perangkat fisik):** `reloadApps()` di `LauncherActivity`
memanggil `PackageManager.queryIntentActivities()` + memuat nama/label
**setiap** aplikasi terpasang, **secara sinkron di thread utama**, dan ini
dipanggil **setiap kali beranda muncul kembali** (`onResume()` — termasuk tiap
kali layar dinyalakan atau kembali dari aplikasi lain). Di lingkungan
pengembangan (emulator/sandbox nyaris tanpa aplikasi terpasang) ini cepat
sekali sehingga tidak pernah ketahuan. Di HP Vivo nyata dengan ratusan
aplikasi bawaan (dua toko aplikasi, bloatware vendor, dst.) + beban sistem
ekstra tepat setelah mengganti launcher default, pemindaian ini bisa cukup
lambat untuk memicu detektor ANR sistem.

**Macet masih terjadi setelah perbaikan di atas** (dilaporkan pengguna pada
percobaan ulang). Karena sandbox ini sama sekali tidak punya akses ADB/logcat
ke perangkat fisik, tidak mungkin melihat jejak tumpukan (stack trace) yang
sesungguhnya dengan cara biasa. Sebagai gantinya ditambahkan **`CrashLog`**
(lihat `CrashLog.java` + `AsProjectApp.java`): pencatat crash darurat
berbasis `Thread.setDefaultUncaughtExceptionHandler`, dipasang di
`Application.onCreate()` (sebelum komponen lain dibuat), yang menyimpan jejak
crash apa pun ke `SharedPreferences` (tanpa izin tambahan) lalu
menampilkannya sebagai dialog ("AsProject sempat berhenti sebelumnya") pada
peluncuran berikutnya yang berhasil, dengan tombol "Salin teks". Ini **tidak
menangkap ANR murni** (hang tanpa exception) — tapi kalau yang sebenarnya
terjadi adalah *crash* yang tersamar sebagai "macet" (karena aplikasi ini
launcher default, sistem langsung meluncurkannya ulang begitu proses mati,
jadi dialog "Aplikasi berhenti" bawaan Android mungkin tidak sempat
terlihat), dialog ini akan menampilkan bukti nyatanya pada percobaan
berikutnya.

**Masih macet juga setelah itu, dan pengguna mengonfirmasi perangkatnya:
Vivo Y50** — chipset Snapdragon 665 (Adreno 610), rilis 2020, Android
10/11 (Funtouch OS 10/11). Ini kelas menengah-bawah dengan GPU/CPU jauh
lebih lemah dari perangkat flagship yang biasa dipakai menguji tema
semacam ini. Dua perbaikan tambahan dilakukan:

1. **`showPendingCrashIfAny()` dipindah ke awal `onCreate()`** (sebelum
   `prefs`/`repository`/`icons` dibuat), bukan di akhir — supaya kalau
   aplikasinya crash berulang (loop, tak pernah sampai baris terakhir
   `onCreate()`), dialog crash dari percobaan sebelumnya tetap sempat
   ditampilkan di percobaan berikutnya sebelum kemungkinan crash yang sama
   terulang lagi.
2. **Nilai bawaan animasi berat (`liquidMotion`, `hudAnimation`) sekarang
   otomatis `false` di perangkat yang diperkirakan kelas menengah-bawah/lama**
   (heuristik di `Prefs.isLikelyLowEndDevice()`: `ActivityManager.isLowRamDevice()`
   ATAU `Build.VERSION.SDK_INT <= Build.VERSION_CODES.R` / Android ≤ 11).
   Ini HANYA memengaruhi nilai bawaan pemasangan baru yang belum pernah
   mengubah sakelarnya sendiri; pengguna tetap bisa menyalakannya manual
   lewat Pengaturan → Tampilan. Dugaannya: kedua animasi ini jalan terus
   lewat `Choreographer` sejak layar pertama dibuka (lock screen sirkuit 3D
   + HUD berputar), dan pada chipset selemah Snapdragon 665 bisa cukup berat
   untuk ikut menyumbang beban thread utama tepat di jendela waktu yang
   paling sensitif terhadap ANR (saat aplikasi baru dibuka / dijadikan
   launcher default). Ikon neon, jam, layar kunci, dan wallpaper tetap
   tampil seperti biasa — hanya kedua animasi kontinu ini yang diam di awal.

   **Catatan jujur:** ini masih dugaan berbasis audit kode + perkiraan
   performa kasar, bukan hasil pengukuran nyata (tidak ada cara mengukur FPS
   atau waktu render sesungguhnya dari sandbox ini). Kalau setelah build ini
   masih tetap macet, itu berarti dugaan ini salah dan penyebabnya ada di
   tempat lain yang belum teraudit.

**Masih macet juga setelah perbaikan animasi di atas** ("masih sama seperti
tadi", tanpa dialog `CrashLog` yang terlihat). Ini jadi petunjuk kuat bahwa
dugaan "animasi terlalu berat" SALAH, dan yang terjadi kemungkinan besar
adalah **crash berulang di titik yang sama setiap kali**, bukan
performa-terkait — dan dialog `CrashLog` mungkin tidak sempat dilihat
pengguna kalau jendelanya belum sempat menggambar satu frame pun sebelum
proses mati lagi. Audit ulang menemukan: **`AppWidgetHost.startListening()`
dan `stopListening()` dipanggil di SETIAP `onResume()`/`onPause()` tanpa
try/catch sama sekali** — padahal ini panggilan Binder ke layanan sistem
widget, dan di banyak ROM vendor dilaporkan bisa melempar `RuntimeException`
(membungkus `TransactionTooLargeException` atau `DeadObjectException`) kalau
layanan widgetnya bermasalah/lambat. AOSP Launcher3 sendiri membungkus
panggilan ini dengan try/catch persis karena alasan ini. Karena dipanggil di
SETIAP `onResume()` (yaitu SETIAP KALI aplikasi dibuka/kembali ke depan),
kalau ini penyebabnya maka aplikasi akan crash di titik yang sama persis
setiap kali — cocok dengan laporan "selalu macet, tidak pernah berhasil,
sama terus dari awal".

**Perbaikan:** `startListening()`/`stopListening()` sekarang dibungkus
try/catch(RuntimeException) lewat `safeStartListening()`/`safeStopListening()`;
konstruksi `AppWidgetManager`/`AppWidgetHost` di `onCreate()` juga dibungkus
try/catch — kalau gagal, keduanya diset `null` dan semua pemakai
(`restoreWidgets()`, `showWidgetPicker()`) diberi penjaga null supaya
beranda tetap bisa dibuka tanpa fitur widget alih-alih crash.

**Dikonfirmasi lebih lanjut: macetnya persis sama bahkan saat dibuka dari
app drawer biasa** (belum dijadikan launcher default), dan **tidak ada
dialog `CrashLog` yang terlihat sama sekali**. Audit ulang menemukan BUG DI
ALAT DIAGNOSISNYA SENDIRI: `showPendingCrashIfAny()` dicek **setelah**
`setContentView(R.layout.activity_launcher)` — padahal `setContentView()`
adalah baris yang mengonstruksi SEMUA View kustom (wallpaper, layar kunci,
jam, dll) lewat inflasi layout. Kalau crash-nya ada DI DALAM
`setContentView()` itu sendiri dan terjadi berulang di titik yang sama
persis setiap kali (deterministik), maka `showPendingCrashIfAny()` tidak
akan PERNAH tereksekusi pada percobaan manapun — bukan karena pencatatnya
gagal menyimpan jejak (bagian itu tetap jalan lewat
`Thread.setDefaultUncaughtExceptionHandler` yang global), tapi karena
baris yang MENAMPILKANNYA selalu gagal dilewati duluan.

**Perbaikan:** `showPendingCrashIfAny()` dipindah ke **paling awal
`onCreate()`, sebelum `setContentView()`** (`AlertDialog` punya Window
sendiri, tidak perlu menunggu `setContentView()` selesai). Build ini murni
build diagnosis: kalau dialognya akhirnya muncul, itu akan jadi bukti nyata
pertama. Kalau tetap tidak muncul apa pun dan macetnya sama persis, itu
petunjuk kuat bahwa ini benar-benar **hang murni (ANR tanpa exception)**,
bukan crash — dan artinya semua perbaikan try/catch sejauh ini (widget host,
dll.) bukan penyebabnya, perlu diaudit arah lain sama sekali.

## 2. Status uji di perangkat

Sebagian besar APK ini masih dibangun & diverifikasi lewat pemeriksaan
statis (`verify_apk.py`) dan simulasi pratinjau berbasis JS — **bukan**
menjalankan APK sungguhan — kecuali satu kali uji nyata di atas (yang
menemukan bug ANR). Semua perilaku runtime di bawah ini masih berupa hasil
pembacaan kode, bukan hasil observasi, kecuali disebutkan lain:

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

## 4. Kenapa hampir tanpa izin sama sekali

Launcher biasanya meminta `QUERY_ALL_PACKAGES` (Android 11+) atau
`PACKAGE_USAGE_STATS`. Keduanya tidak dipakai di sini:

- daftar aplikasi dibaca lewat `queryIntentActivities` untuk
  `ACTION_MAIN` + `CATEGORY_LAUNCHER`, dan keterlihatan paket dibuka dengan blok
  `<queries>` di manifest — cara yang disarankan Google untuk peluncur;
- tidak ada akses internet, sehingga tidak ada telemetri yang mungkin dikirim;
- semua preferensi ada di `SharedPreferences` (`launcher_prefs.xml`) dan ikut
  cadangan Android (`allowBackup=true`).

Satu-satunya pengecualian adalah fitur opsional **Spidometer mengambang**
(§4a) — nonaktif secara bawaan, dan izinnya baru diminta saat pengguna
menyalakan sakelarnya sendiri di Pengaturan.

### 4a. Spidometer mengambang — satu-satunya fitur yang memakai izin

`SpeedometerService.java` menampilkan bubble kecepatan (`SpeedGaugeView.java`)
yang tetap tampil di atas aplikasi lain dan menyalakan `FLAG_KEEP_SCREEN_ON`
supaya layar tidak meredup selama tampil. Tiga izin yang dipakai, semuanya
wajib menurut aturan Android untuk kasus ini (tidak ada cara lain):

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — kecepatan dihitung dari
  `Location.getSpeed()` (GPS), diminta lewat dialog izin biasa saat sakelar
  dinyalakan.
- `SYSTEM_ALERT_WINDOW` — supaya bubble bisa digambar di atas aplikasi lain
  (`WindowManager` + `TYPE_APPLICATION_OVERLAY`); harus disetujui lewat
  halaman Pengaturan Android sendiri (`ACTION_MANAGE_OVERLAY_PERMISSION`),
  Android tidak mengizinkan dialog biasa untuk izin ini.
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION` / `POST_NOTIFICATIONS`
  — Android 10+ hanya menganggap akses lokasi sebagai "latar depan" (tidak
  perlu `ACCESS_BACKGROUND_LOCATION`) selama berjalan sebagai layanan latar
  depan bertipe `location` dengan notifikasi yang selalu terlihat; notifikasi
  itulah yang memakai `POST_NOTIFICATIONS` (wajib sejak Android 13).

`SettingsActivity.advanceSpeedometerFlow()` meminta ketiganya berurutan (satu
per satu, bukan sekaligus) dan membatalkan sakelar bila salah satu ditolak.
Mematikan sakelar atau menekan "Matikan" di notifikasi langsung menghentikan
layanan (`stopSelf()`), melepas overlay, dan berhenti membaca lokasi.
