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
- Layar selesai menyediakan salin link tamu, WhatsApp, lihat undangan, edit,
  serta akses menu master terpisah. Link master bersifat privat.
- Membuat undangan baru meminta konfirmasi sebelum mengganti draft aktif.
  Arsip/katalog tetap dipertahankan dan kunci master baru dibuat.

Uji UI opsional: pasang `jsdom`, `playwright-core`, dan `@sparticuz/chromium`
melalui npm dengan `--no-save --package-lock=false`. Jalankan
`node tools/test-floating-preview.cjs`, `node tools/test-scroll-effects.cjs`,
dan (setelah server lokal aktif di :8080) `node tools/test-mobile-browser.cjs`.
Browser memerlukan library sistem Chromium; atur `LD_LIBRARY_PATH` bila memakai
library bundled. Tes publish menggunakan fixture lokal, **bukan database produksi**.

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

Uji: `node tools/test-foto-cover.cjs` (61 pemeriksaan) dan bagian `[17]` di
`tools/cek-kesehatan.py`. Lembar perbandingan 9 gaya: `pilihan-gaya-foto-cover.png`
(di luar repositori; dibuat dengan `tools/`-style skrip sharp, bukan bagian aplikasi).

## Tema 3D ulang tahun (artwork realistis)

Tema **ulang tahun** memakai latar artwork 3D realistis (bukan ilustrasi flat):
`assets/tema-3d/<id-tema>.webp` — satu berkas per tema, ≤ 250 KB, total ± 860 KB.

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
