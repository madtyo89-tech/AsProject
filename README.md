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

- Urutan array `TPL` di `studio.html`, `undangan.html`, dan katalog `Pn` di `index.html`
  **harus identik** (kolom `theme` adalah index ke array itu) — dicek otomatis oleh
  `python3 tools/cek-kesehatan.py` (bagian [11], [12], [13]). Sejak 2026-10-10 katalog
  berisi satu tema dasar + 12 tema warisan Google Drive + 5 tema elegan seri
  *Golden Onyx*; lihat **Katalog tema** di bawah.
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

## Katalog tema (direset + diisi ulang 2026-10-10)

Katalog lama berisi 72 tema lengkap dengan artwork-nya. Seluruhnya dihapus, lalu diisi
ulang dengan **12 tema dari halaman katalog AsProject di Google Drive** (data nama,
kategori, harga, palet, rating, dan deskripsi diambil apa adanya dari sana). Jadi sekarang:
**1 tema dasar** `ivory-klasik` / *Ivory Klasik* — `ev:'all'`, selalu di indeks 0 — diikuti
4 tema pernikahan, 2 khitanan, 3 ulang tahun, dan 3 aqiqah. Yang ikut terhapus bersamanya:
`assets/tema-3d/` (50 artwork webp), `assets/wedding/` (2 paper art), dan folder
`templates/` (pipeline isi-manual Python).

Tema-tema itu **tidak** membawa artwork (`bg3d`/`bgPaper` kosong), jadi halaman tamu
memakai gradasi + pola SVG (`pat`) + ornamen (`deco`) dari paletnya. Contoh tampilan
hidupnya ada di folder **`katalog-demo/`** — templat jadi satu berkas dari Drive yang
sudah dibersihkan dan di-rebrand ke AsProject (lihat README di folder itu).

Mesinnya sengaja **tidak** dihapus dan tetap diuji: skin cover pernikahan
(`body.wedding-cover`, kartu stationery, paper art), kelas `art3d` untuk tema
ber-artwork, partikel VIP 4D, penyesuaian kontras, 17 font, 32 border, 34 efek gulir,
9 gaya foto cover, dan sematan artwork base64 saat *Simpan File HTML*.

Menambah tema = menambah **satu baris di tiga tempat** yang urutannya wajib sama:

1. `const TPL` di `studio.html` — lengkap:
   `id, nama, ev, harga, g[3], accent, ink, badge, tier, char, bg3d, bgPaper, deco, pat, ft, desc`;
2. `const TPL` di `undangan.html` — `id, nama, ev, g[3], accent, ink, char, bg3d, bgPaper,
   deco, pat, ft` (tanpa harga/desc/badge);
3. `var Pn` di `index.html` (katalog publik) — `id, name, category, price, rating, reviews,
   gradient, accent, description`; tiga warna `gradient:"from-[#…] via-[#…] to-[#…]"`
   **harus** punya rule CSS `.from-\[#…]` / `.via-\[#…]` / `.to-\[#…]` di berkas yang sama.

12 tema Drive tadi dipasang dengan aturan yang sama: `ink` dihitung dari aksen tema sendiri
(nada gelap sewarna, minimum kontras 3:1 terhadap `g[0]` dan `g[2]` — syarat
`node tools/test-kontras-tema.cjs`), `ev` dipetakan dari kategori (`Pernikahan` →
`pernikahan`, `Ulang Tahun` → `ultah`), dan tiap nama tema didaftarkan di `DEMO_BY_NAME` /
`DEMO_BY_CATEGORY` hanya kalau berkas demonya benar-benar ada. Teks jumlah di hero katalog
(`"18 template"`) dan daftar kategori (`Xm`) ikut berubah — keduanya diperiksa oleh
`tools/cek-kesehatan.py` bagian [12].

**Tambahan 2026-10-10 (seri Golden Onyx, +5 tema elegan campuran kategori)** —
ditaruh di **akhir** array dengan urutan sama di ketiga file:
`midnight-gold` (pernikahan, onyx + gold foil), `emerald-royal` (pernikahan,
zamrud + emas), `navy-crest` (khitanan, navy + crest emas), `golden-jubilee`
(ultah, champagne gold milestone), `pearl-ivory` (aqiqah, mutiara & ivory).
Katalog publik `index.html` ikut dirancang ulang dengan tema visual *Golden Onyx*
(palette onyx + emas + serif Cinzel/Cormorant; blok `AsProject · Katalog enhancement`
di akhir berkas — bundle React tidak disentuh) dan kilau emas interaktif
menggantikan kupu-kupu. Alur studio diperjelas dengan stepper 4 langkah
(Data Acara → Desain & Slide → Konten → Tamu & Terbit), checklist kesiapan
(Nama/Tanggal/Jam/Lokasi/Link), dan urutan tab mengikuti alur kerja.

Daftar `TEMA_LAMA` di `tools/cek-kesehatan.py` dan `tools/test-wedding-templates.cjs` menjaga
agar id tema lama tidak kembali. Empat id (`jawa-elegan`, `minimalist-sage`, `luxury-gold`,
`floral-rustic`) sengaja **tidak** lagi masuk daftar itu: sejak 2026-10-10 id tersebut dipakai
ulang oleh katalog AsProject dengan palet dan mesin tema repo — bukan salinan desain lama.

Uji: `python3 tools/cek-kesehatan.py` (bagian [11], [12], [13], [16], [20]) dan
`node tools/test-wedding-templates.cjs`. Kolom `theme` di Supabase adalah **indeks**
array ini — tambah tema selalu di **akhir** agar undangan yang sudah terbit tidak
berpindah tema. Draft lama yang temanya sudah tidak ada otomatis jatuh ke tema dasar;
`LEGACY_EV` di `undangan.html` menjaga jenis acara (pernikahan vs satu nama) tetap benar
untuk draft tanpa snapshot `data`.

## Pembaruan template pernikahan

Cover pernikahan memakai susunan editorial: judul undangan, nama pasangan, tanggal, jam,
lokasi, pesan singkat, dan tombol menuju detail/RSVP. Kartu, aksen, dan halaman isi
mengambil palet dari tema yang dipilih. Dulu tiap tema pernikahan punya artwork kertas
sendiri (batik kawung/parang untuk Adat Jawa, watercolor eucalyptus untuk Minimalist
Sage, floral es biru untuk Ice Blue); artwork itu dihapus bersama katalog lama, jadi
semua tema kini memakai lapisan warna/gradasi dari paletnya. Saat menambahkan tema
pernikahan baru, tambahkan `bgPaper:'assets/wedding/<id-tema>.webp'` (opsional, ≤ 300 KB)
di **kedua** berkas — skin `wedding-paper-art` dan sematan base64-nya masih terpasang.
Folder `assets/wedding/` dan `assets/tema-3d/` sudah dihapus beserta katalog lama, jadi
buat foldernya lebih dulu kalau mau memakai artwork lagi; `tools/cek-kesehatan.py` [16]
memastikan jumlah tema ber-artwork sama dengan jumlah berkas di disk.

Uji: `node tools/test-wedding-templates.cjs` (dengan `jsdom` untuk uji render; tanpa
`jsdom` tetap memeriksa paritas katalog studio/live/publik, palet, dan rule CSS gradient).

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
begitu pula tema-tema lama seperti *Balap Mobil* `#F0F0F0` dan *Naga Api* `#FBE9E4`
(keduanya sudah tidak ada sejak katalog direset 2026-10-10; polanya tetap sama).
Cover-nya tetap memakai warna tema apa adanya, tetapi **kartu konten di halaman tamu
selalu berlatar terang**, jadi dulu teksnya nyaris tidak terlihat (nama, tanggal,
countdown, alamat, doa). Sekarang `assets/theme-contrast.js` menghitung ulang warna
teks konten saat halaman dibuka:

- **teks konten** (nama, tanggal, countdown, alamat, doa) minimal **4.5:1** terhadap
  latar kartu; bila ink tema terlalu terang, dipakai **nada paling gelap dari gradasi
  tema itu sendiri** (mis. `#26292E` untuk palet arang) supaya tetap
  sewarna, bukan abu-abu generik;
- **label/ornamen aksen** minimal **3:1** — hanya tema yang aksennya benar-benar pudar
  yang disesuaikan;
- **cover tidak diubah** (teks & aksen cover diuji tetap ≥ 3:1 terhadap gradasinya);
- **file HTML mandiri** dari tombol *Simpan File HTML* di Studio ikut menyematkan aturan
  ini, jadi teks tetap terbaca walau dibuka offline tanpa folder `assets/`.

Uji: `node tools/test-kontras-tema.cjs` (tanpa jsdom: cek palet & rumus; dengan jsdom:
merender `undangan.html` sungguhan dengan tema paling gelap di katalog dan memeriksa variabel yang
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

## Latar artwork tema (opsional)

Tema boleh membawa gambar latar cover: `bg3d:'assets/tema-3d/<id-tema>.webp'` untuk
latar penuh, dan/atau `bgPaper:'assets/wedding/<id-tema>.webp'` untuk kertas bertas.
Katalog hasil reset belum punya tema ber-artwork, jadi kedua folder itu tidak ada di
repo — mesinnya tetap siap dan tetap diuji.

Cara kerja:

- tema dengan `bg3d` memakai gambar itu sebagai **latar cover**; tema lain tetap memakai
  gradasi seperti semula;
- teks cover otomatis diterangkan (`#F7F2E9`) dan dilapis gelap (`body.art3d #cover`)
  supaya kontras ≥ 7:1 terukur; teks kartu isi tetap memakai nada gelap tema;
- **foto utama undangan** (diatur di Studio) tampil dalam bingkai kaca di tengah cover;
- pratinjau Studio ikut memakai artwork (label *3D*), dan *Simpan File HTML*
  **menyematkan artwork** sebagai base64 (bila < 300 KB) supaya file mandiri tetap
  tampil benar tanpa folder `assets/`.

Menambah artwork: taruh `<id-tema>.webp` (rasio 2:3, sisi panjang ± 1300 px, bagian
atas & bawah agak gelap agar teks terbaca, ≤ 250 KB), lalu tambahkan `bg3d:` pada tema di
**kedua** berkas (`studio.html` dan `undangan.html` — daftar `TPL` harus tetap identik).
Uji: `node tools/test-tema-3d.cjs` (memeriksa pairing dua arah: setiap berkas webp
dipakai tema, dan setiap `bg3d:` menunjuk berkas yang ada).

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
