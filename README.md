# AsProject

Studio undangan digital online (pernikahan, khitanan, ultah, aqiqah) —
asproject.my.id, dihosting GitHub Pages + Supabase.

## Alur tautan undangan (penting — jangan diurai)

1. **Studio** (`studio.html`) → tombol **Publish** menyimpan draft ke
   Supabase tabel `invitation_drafts` (kolom dasar + snapshot jsonb `data`).
2. Link tamu yang dihasilkan: **`https://asproject.my.id/u/{slug}`**
   (atau `{customDomain}/u/{slug}`). Format path ini sengaja dipakai karena
   selalu resolvable di GitHub Pages tanpa wildcard DNS.
3. GitHub Pages tidak punya path fisik `/u/{slug}` → sajikan **`404.html`**,
   yang merute (JS) ke **`/undangan.html?slug={slug}`** (query `?to=…`
   dipertahankan).
4. **`undangan.html`** fetch draft dari Supabase berdasarkan slug dan
   merender undangan live (tema, doa, countdown, amplop, galeri, musik).
   Slug juga bisa terbaca dari subdomain wildcard `{slug}.asproject.my.id`
   (bila DNS memakai wildcard) — untuk itu `index.html` punya router kecil
   yang mengarahkan root subdomain ke `undangan.html`.
5. QR check-in tamu menunjuk **`checkin.html`** (root).

Catatan:

- Urutan array `TPL` di `studio.html` dan `undangan.html` **harus identik**
  (kolom `theme` adalah index ke array itu) — dicek otomatis oleh
  `python3 tools/cek-kesehatan.py` (bagian [11]).
- Kolom snapshot `data jsonb` ditambahkan idempoten di `supabase-schema.sql`;
  jalankan ulang di SQL Editor Supabase agar publish baru menyimpan snapshot
  lengkap. Draft lama (tanpa `data`) tetap bisa dibuka — renderer memakai
  kolom dasar + template.
- Bila kolom `data` belum ada (error PGRST204), **Publish tidak gagal total**:
  studio menyimpan kolom dasar saja, menampilkan peringatan amber berisi
  tombol **Salin SQL perbaikan** (`alter table … add column if not exists
  data jsonb;`), dan undangan live dirender dari kolom dasar + template.
  Setelah schema diperbarui, Publish ulang untuk menyimpan snapshot lengkap.
- Uji pipeline: `python3 tools/cek-kesehatan.py` dan
  server lokal `python3 tools/serve.py` (emulasi 404-routing Pages, default :8080).

## Alur membuat undangan di Studio

- Kunjungan pertama menampilkan **Membuat Undangan**. Nama, tanggal, lokasi,
  tamu, rekening, galeri, dan isi slide dimulai kosong; pengaturan desain tetap
  memiliki nilai awal. Draft yang sudah tersimpan tidak dihapus saat refresh.
- Header atas Studio tidak berisi toolbar. Kontrol ada di area editor:
  **Template & Menu**, **Selesaikan Undangan**, dan **Undangan Baru**.
- **Selesaikan Undangan** memvalidasi nama, tanggal, jam, lokasi, dan slug.
  Layar **Undangan sudah jadi!** baru muncul setelah Supabase mengonfirmasi
  penyimpanan snapshot lengkap. Kegagalan jaringan/database tidak dianggap sukses.
  Publish memakai Supabase JS bila CDN tersedia, dengan fallback REST bila CDN diblokir;
  jika Supabase menolak simpan, Studio menampilkan pesan penyebab dan langkah perbaikannya.
- Layar selesai menyediakan salin link tamu, WhatsApp, lihat undangan, edit,
  serta akses menu master terpisah. Link master bersifat privat.
- Membuat undangan baru meminta konfirmasi sebelum mengganti draft aktif.
  Arsip/katalog tetap dipertahankan dan kunci master baru dibuat.

Uji publish tanpa menulis ke database produksi: `node tools/test-publish-fallback.cjs`
(dengan `jsdom`). Uji UI opsional: pasang `jsdom`, `playwright-core`, dan
`@sparticuz/chromium` melalui npm dengan `--no-save --package-lock=false`. Jalankan
`node tools/test-floating-preview.cjs`, `node tools/test-scroll-effects.cjs`,
dan (setelah server lokal aktif di :8080) `node tools/test-mobile-browser.cjs`.
Browser memerlukan library sistem Chromium; atur `LD_LIBRARY_PATH` bila memakai
library bundled. Tes publish memakai fixture lokal, **bukan database produksi**.

## Pembaruan template pernikahan

Cover pernikahan kini memakai susunan editorial seperti contoh: judul undangan, nama pasangan,
tanggal, jam, lokasi, pesan singkat, dan tombol menuju detail/RSVP. Kartu, aksen, dan halaman
isi mengambil palet dari template yang dipilih. Setiap desain tetap dibedakan menurut namanya:
Adat Jawa Elegan memakai bingkai batik kawung/parang, Minimalist Sage memakai watercolor
eucalyptus, Ice Blue memakai artwork floral es biru, dan tema lain mempertahankan artwork
serta palet khas masing-masing. Preview Studio dan undangan live memakai skin yang sama;
artwork ringan juga disematkan saat menyimpan file HTML mandiri.

Uji: `node tools/test-wedding-templates.cjs` (dengan `jsdom` untuk uji render; tanpa `jsdom`
tetap memeriksa pasangan tema/aset secara statis).

## Efek gulir undangan

Editor menyediakan 34 pilihan Scroll Reveal; 10 efek baru mencakup Tilt Masuk, Flip Samping,
Gulir Masuk, Lenting, Wipe Vertikal/Horizontal, Buka Lipatan, Lentur, Glow, dan Blur Turun.
Efek bisa diseragamkan atau dibuat bervariasi otomatis per bagian; reveal diputar ulang saat scroll naik/turun dan arah masuk mengikuti gerak. Perilakunya sama di Studio dan undangan live, serta CSS/observer disematkan pada unduhan HTML mandiri agar tetap berjalan offline.

Uji: `node tools/test-scroll-effects.cjs`.

## Bantuan tombol

Di Studio, katalog, undangan live, dan dashboard master: tekan dan tahan tombol
atau tautan sekitar 1 detik untuk membaca keterangan tanpa menjalankan aksinya.
Ketuk singkat tetap menjalankan aksi biasa. Gerakan menggulir membatalkan bantuan.
Pengguna keyboard dapat memfokuskan tombol lalu menekan **F1**, dan **Esc** untuk
menutup. Tombol khusus dapat diberi `data-help="Keterangan"`; event delegation
mendukung tombol yang dirender ulang. Tes: `node tools/test-button-help.cjs`
(dengan server dan dependensi browser seperti tes mobile di atas).

## Kontras teks tema undangan

Beberapa palet tema sengaja memakai warna teks ("ink") terang karena covernya gelap —
contoh **Balap Mobil** `#F0F0F0`, **Naga Api** `#FBE9E4`, **Ninja Cilik** `#ECEFF3`.
Cover-nya tetap memakai warna tema apa adanya, tetapi **kartu konten di halaman tamu
selalu berlatar terang**, jadi dulu teksnya nyaris tidak terlihat (nama, tanggal,
countdown, alamat, doa). Sekarang `assets/theme-contrast.js` menghitung ulang warna
teks konten saat halaman dibuka:

- **teks konten** (nama, tanggal, countdown, alamat, doa) minimal **4.5:1** terhadap
  latar kartu; bila ink tema terlalu terang, dipakai **nada paling gelap dari gradasi
  tema itu sendiri** (mis. Balap Mobil → `#26292E`, Naga Api → `#3A1418`) supaya tetap
  sewarna, bukan abu-abu generik;
- **label/ornamen aksen** minimal **3:1** — hanya tema yang aksennya benar-benar pudar
  yang disesuaikan;
- **cover tidak diubah** (teks & aksen cover diuji tetap ≥ 3:1 terhadap gradasinya);
- **file HTML mandiri** dari tombol *Simpan File HTML* di Studio ikut menyematkan aturan
  ini, jadi teks tetap terbaca walau dibuka offline tanpa folder `assets/`.

Uji: `node tools/test-kontras-tema.cjs` (tanpa jsdom: cek palet & rumus; dengan jsdom:
merender `undangan.html` sungguhan dengan tema Balap Mobil dan memeriksa variabel yang
dipasang). Pemeriksa repo `python3 tools/cek-kesehatan.py` ikut menjalankannya.

## Foto cover undangan (9 gaya, bisa digeser)

Foto utama yang diunggah di Studio (**Foto & Galeri → Foto Utama / Cover**) bisa
dipasang di cover undangan dengan **9 gaya**, dan posisinya bisa digeser/di-zoom
supaya bagian penting fotonya pas di bingkai. Berlaku semua jenis acara:
pernikahan, khitanan, aqiqah, dan ulang tahun.

| # | Gaya | Bentuk |
|---|------|--------|
| 1 | `kotak` | persegi membulat (bawaan) |
| 2 | `oval` | oval klasik berbingkai emas |
| 3 | `lingkaran` | bulat penuh berbingkai emas |
| 4 | `arch` | lengkung atas (arch) |
| 5 | `polaroid` | kartu polaroid putih |
| 6 | `emas` | bingkai ganda emas |
| 7 | `kapsul` | kapsul tinggi membulat |
| 8 | `full` | foto penuh jadi latar cover + panel kaca gelap |
| 9 | `none` | tanpa foto di cover (foto tetap tampil di bagian galeri) |

Cara mengatur (di Studio, tab undangan):

1. unggah **Foto Utama / Cover**;
2. pilih salah satu dari **9 gaya** (pratinjau memakai foto Anda sendiri);
3. **geser fotonya** di kotak “geser foto” (jari/mouse) — perpindahan dihitung dari
   ukuran gambar asli supaya gerakannya pas 1:1 — lalu atur **zoom** (1×–2,2×);
4. tekan **Publikasikan** agar gaya + posisi foto ikut tersimpan ke undangan live
   (undangan yang sudah terbit perlu diterbitkan ulang).

Catatan teknis:

- posisi/zoom disimpan sebagai `coverPos:{x,y,z}` (persen) dan dipakai lewat
  `object-position` + `transform:scale()`; gaya disimpan sebagai `coverStyle`;
- gaya **`full`** memakai lapisan gelap + panel kaca `rgba(10,8,6,.84)` di belakang
  teks, sehingga teks putih tetap ≥ 4.5:1 **walau fotonya serba putih** (diuji);
- cover bisa **digulir** dan bingkai mengecil di layar pendek, jadi tombol
  *Buka Undangan* tidak pernah terpotong karena tambahan foto;
- undangan tanpa foto tampil **persis seperti sebelumnya** (tidak ada bingkai kosong).

Kartu **“Preview Undangan”** di dashboard master (`master.html`) juga menampilkan foto
cover itu beserta nama gayanya — termasuk latar gelap untuk gaya `full`, dan keterangan
*“Belum ada foto cover”* bila belum diatur. Data diambil dari snapshot undangan yang
sudah dipublish, jadi tekan **Selesaikan Undangan** dulu agar ikut terbarui.

Uji: `node tools/test-foto-cover.cjs` (86 pemeriksaan, termasuk potongan
`cvCoverMini()` dari `master.html`) dan bagian `[17]` di `tools/cek-kesehatan.py`.
Lembar perbandingan: `pilihan-gaya-foto-cover.png` dan `master-preview-foto-cover.png`
(di luar repositori; dibuat dengan skrip sharp, bukan bagian aplikasi).

## Link Scan QR Panitia (check-in tamu)

Sekarang QR di tab **Tamu & QR** adalah **QR asli** (bukan hiasan) — setiap QR berisi
link `checkin.html?guest=…&id=…&s=…`. Saat tamu datang, panitia cukup memindai QR itu
di pintu masuk; kehadiran langsung tercatat.

**Cara pakai (3 langkah):**

1. **Pasang tabel check-in sekali**: buka Supabase → SQL Editor → jalankan
   `tools/checkin.sql` (tabel `checkin` terpisah dari `rsvp`: RSVP = "akan hadir",
   check-in = "sudah tiba").
2. **Bagikan link scan**: dashboard **Undangan Master** → kartu **🔗 Link Scan QR
   Panitia (Check-in)** → tombol **Salin** / **💬 Share via WhatsApp**.
   Link berbentuk `scan.html?s=<slug>&k=<kunci>` — privat (kunci sama dengan link
   master), jangan dibagikan ke tamu.
3. **Panitia bertugas**: buka link di HP → **📷 Mulai Pindai** → arahkan ke QR tamu.
   Nama tamu muncul + suara/getar, check-in tersimpan, dan muncul di **Daftar Hadir**
   (halaman scan) serta rekap **"N tamu sudah check-in"** di Undangan Master.

**Fallback di halaman scan:** *Pindai dari Galeri* (foto QR) dan **cari manual**
(nama/kode) — untuk QR rusak atau HP tanpa pemindai otomatis.

**QR Undangan (opsional):** di tab **Tamu & QR** kini ada dua QR per tamu —
**QR Check-in** (untuk panitia) dan **QR Undangan** (untuk tamu). QR Undangan berisi
link undangan personal; bagus dicetak di kartu undangan/souvenir — tamu scan lalu
undangan langsung terbuka. Keduanya punya tombol **Download QR** sendiri.

**Unduh Daftar Hadir:** tombol **⬇ Unduh Daftar Hadir (CSV)** tersedia di Undangan
Master (semua tamu + RSVP + waktu check-in) dan di halaman scan (daftar check-in).
CSV ber-BOM, langsung rapi di Excel.

**Anti gagal-scan:** pemindai otomatis memakai **BarcodeDetector** (Chrome/Android),
dan bila tidak tersedia (iOS Safari/Firefox) otomatis memakai **jsQR** (decoder
cadangan di `assets/jsqr.js`) pada frame kamera — jadi tetap bisa scan. QR digambar
dengan **quiet zone 4 modul** sesuai standar, modul integer tanpa celah piksel, dan
label emas di luar area QR (tidak mengganggu pemindaian). Aplikasi Android
mengizinkan kamera web untuk halaman scan (izin runtime, mikrofon tetap ditolak).

Teknis: `scan.html` memakai **BarcodeDetector** (kamera belakang, HTTPS) dan upsert ke
tabel `checkin` (`unique(slug, guest)` — scan ulang memperbarui waktu). QR digenerate
dengan pustaka `assets/qrcode.js` (*qrcode-generator*, MIT, © Kazuhiko Arase), level
koreksi M + quiet zone 6 modul supaya nyaman dipindai.

## Latar artwork tema (ulang tahun & pernikahan)

Tema **ulang tahun** dan **pernikahan** memakai latar artwork realistis dari
`assets/tema-3d/<id-tema>.webp` (rasio 2:3, ≤ 250 KB per berkas):

**Ulang tahun (10 tema):** Balap Mobil, Naga Api, Ninja Cilik, Super Hero, Bajak Laut
Cilik, Putri Peri, Unicorn Magic, Buket Mawar, Kids Party, Sweet 17.
*(Adult Elegant menyusul.)*

**Pernikahan (9 tema) — sesuai nama masing-masing:**

| Tema | Nuansa artwork |
|------|----------------|
| `burgundy-regal` | maroon beludru + filigree bunga emas di 4 sudut |
| `luxury-gold` | marmer hitam + ornamen art-deco emas |
| `navy-royal` | navy beludru + ornamen barok emas |
| `charcoal-gold` | batu arang + geometris emas art-deco |
| `forest-classic` | dedaunan hijau hutan + cahaya keemasan |
| `jawa-elegan` | coklat hangat + motif ukir/batik emas |
| `floral-rustic` | kayu tua + pampas & mawar kering terracotta |
| `ocean-breeze` | biru laut + gelombang lembut & karang |
| `ice-blue` | es biru muda + kristal & bunga beku |

Tema **`minimalist-sage`, `minimalist-frost`, `slate-sage`** sengaja **tetap bersih**
tanpa artwork — itu arti namanya. Tema ini tetap 100% berfungsi seperti sebelumnya.

Cara kerja: sama dengan tema 3D ulang tahun — artwork jadi latar cover, teks cover
otomatis memakai warna terang (≥ 7:1 terukur di atas artwork, termasuk yang paling
terang), **teks kartu isi tetap terbaca** (nada gelap tema), foto pengantin tetap bisa
dipasang lewat 9 gaya bingkai, dan undangan tanpa artwork tampil persis seperti semula.

## Tema 3D ulang tahun (artwork realistis)

Tema **ulang tahun** memakai latar artwork 3D realistis (bukan ilustrasi flat):
`assets/tema-3d/<id-tema>.webp` — satu berkas per tema, ≤ 250 KB.

| Tema | Berkas | Tema | Berkas |
|------|--------|------|--------|
| Balap Mobil (`race-car`) | `race-car.webp` | Putri Peri (`fairy-princess`) | `fairy-princess.webp` |
| Naga Api (`dragon-fire`) | `dragon-fire.webp` | Unicorn Magic (`unicorn-magic`) | `unicorn-magic.webp` |
| Ninja Cilik (`ninja-mastery`) | `ninja-mastery.webp` | Buket Mawar (`rose-bouquet`) | `rose-bouquet.webp` |
| Super Hero (`superhero-power`) | `superhero-power.webp` | Kids Party (`kids-party`) | `kids-party.webp` |
| Bajak Laut Cilik (`pirate-sea`) | `pirate-sea.webp` | Sweet 17 (`sweet-17`) | `sweet-17.webp` |

Cara kerjanya:

- tema dengan kode `bg3d:'assets/tema-3d/…'` di `TPL` memakai gambar itu sebagai
  **latar cover** undangan; tema lain tetap memakai gradasi seperti semula;
- lapisan gelap tipis (`body.art3d #cover`) menjaga teks tetap terbaca — diuji
  ≥ 14:1 untuk warna teks cover yang dipakai;
- **foto utama undangan** (diatur di Studio) tampil dalam **bingkai kaca** di tengah
  cover, seperti konsep “pasang foto di sini” pada artwork-nya;
- pratinjau di Studio ikut memakai latar 3D (label *3D* di atas pratinjau), dan tombol
  *Simpan File HTML* **menyematkan artwork** ke berkas (base64, bila < 300 KB) supaya
  file yang disimpan tetap tampil benar walau folder `assets/` tidak ikut dibawa.

Mengganti/menambah artwork: taruh berkas `<id-tema>.webp` (rasio 2:3, sisi panjang
± 1300 px, latar atas & bawah dibuat agak gelap agar teks terbaca), lalu tambahkan
`bg3d:'assets/tema-3d/<id-tema>.webp'` pada tema di **kedua** berkas (`studio.html`
dan `undangan.html` — daftar `TPL` harus tetap identik). Uji:
`node tools/test-tema-3d.cjs`.

> Artwork dibuat khusus untuk AsProject (gambar hasil AI, disimpan di repositori ini);
> tidak memakai aset berhak cipta pihak lain.

## Aplikasi Android (pembungkus Studio)

Studio juga tersedia sebagai aplikasi Android yang memuat
**https://asproject.my.id/studio.html** langsung dari server (bukan salinan offline),
sehingga pembaruan Studio langsung terlihat tanpa memasang ulang APK. Kode sumbernya ada
di folder **[`android/`](android/)** — terpisah dari berkas situs, dan tidak mengubah
fitur situs yang sudah berjalan.

- APK uji: `android/out/asproject-studio-1.0.0-debug.apk` (tanda tangan debug Android).
- Petunjuk build + APK rilis dengan keystore sendiri: [`android/docs/BUILD-APK.md`](android/docs/BUILD-APK.md).
- Hasil tes & keterbatasan: [`android/docs/HASIL-TES-DAN-KETERBATASAN.md`](android/docs/HASIL-TES-DAN-KETERBATASAN.md).
- Workflow APK otomatis: `.github/workflows/android-apk.yml` (artefak tiap push yang
  menyentuh `android/**`, dan Release saat tag `v*` dipush).
