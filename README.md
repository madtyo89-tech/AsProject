# AsProject

Studio undangan digital online (pernikahan, khitanan, ultah, aqiqah) —
asproject.my.id, dihosting GitHub Pages + Supabase.

## Alur tautan undangan (penting — jangan diurai)

Catatan: sejak 2026-10-18 literal `const TPL=[…]` di `studio.html` &
`undangan.html` **dibangkitkan** dari `kerangka/` lewat
`node tools/bangun-tpl.cjs` (lihat **Kerangka template baru** di bawah) —
jangan edit manual.

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

## Floating preview undangan di Studio (tombol kembali ke cover, 2026-10-14)

Mini HP melayang (`#floatPrev`) menampilkan undangan yang sedang dibuat dan ikut
berubah setiap isian/tema disunting. Kontrol di bilah judulnya:

- **⤒ Kembali ke cover** — menggulir isi preview kembali ke cover undangan di
  bagian paling atas (halus bila browser mendukung; tetap bekerja di jsdom).
- **⤢ / ⤡** perbesar/perkecil, dan **–** menyembunyikan preview (jadi pil
  📱 Preview). Judul bisa digeser untuk memindahkan widget.
- Posisi, ukuran, dan pilihan sembunyikan bertahan setelah refresh; posisi
  dijepit ke dalam layar saat jendela diperkecil. Di layar **Undangan sudah
  jadi!** widget disembunyikan karena fokus pada link.

Dicek otomatis oleh `python3 tools/cek-kesehatan.py` (bagian floating preview)
dan `node tools/test-floating-preview.cjs`.

## Pesan WhatsApp undangan seragam di semua tombol (2026-10-15)

Masukan pengguna: tulisan yang ikut terkirim berbeda-beda di tiap tombol link — ada yang
lengkap, ada yang tidak. Sekarang **semua tombol yang mengirim/membagikan link undangan
memakai satu pesan yang sama**, yaitu teks *💬 Tulisan Undangan untuk WA* di Studio → tab
**Tamu & QR**. Bawaannya:

```
Assalamualaikum Bapak/Ibu/Saudara/i 🙏

Dengan memohon rahmat Allah SWT, kami mengundang untuk hadir di acara Tasyakuran Khitanan kami:

https://asproject.my.id/u/satrio-pandu-mahardika

Merupakan kebahagiaan bagi kami atas kehadiran & doanya.

Terima kasih 🤍
Satrio Pandu Mahardika
```

| Tombol | Sebelumnya | Sekarang |
| --- | --- | --- |
| Studio · WA per tamu & 📤 Kirim Link via WhatsApp | lengkap | tetap lengkap (sapaan nama tamu + link `?to=` bila tamu dipilih) |
| Studio · layar *Undangan sudah jadi!* → Bagikan via WhatsApp | "Dengan hormat, kami mengundang Anda ke acara …" | pesan lengkap, link untuk semua tamu |
| Master · 🌐 Link untuk Semua → 💬 Share via WhatsApp | "Halo! Berikut undangan digital …" | pesan lengkap, link untuk semua tamu |
| Master · Share via WhatsApp per tamu | "Halo {nama} 👋 Kamu kami undang …" | pesan lengkap, sapaan nama + link personal |
| Undangan live · 🔗 Bagikan | "Undangan {nama} — {tanggal}" + URL yang sedang dibuka (bisa membawa `?to=` tamu lain) | pesan lengkap, link `/u/{slug}` tanpa nama |

- Variabel: `{nama_tamu}` (link tanpa nama → *Bapak/Ibu/Saudara/i*), `{link_undangan}`,
  `{nama_pengantin}`, `{acara}` (*Pernikahan*, *Tasyakuran Khitanan*, *Sweet Birthday Party*,
  *Tasyakuran Aqiqah*; dulu pernikahan terbaca "acara The Wedding Of kami"). Setiap variabel
  diganti di semua kemunculannya (dulu hanya yang pertama); bila
  `{link_undangan}` terhapus dari teks, link tetap ditambahkan di akhir pesan.
- Teks milik pemilik ikut snapshot publish (`data.waTemplate`), sehingga Master dan undangan
  live memakai teks yang sama dengan Studio. Mengubah teks menyalakan status **Publish Ulang**;
  tombol **↺ Kembalikan teks bawaan** muncul setelah teks diubah, dan pratinjau pesan ikut
  berubah saat mengetik. Master punya **👁 Lihat isi pesan WhatsApp** untuk mengecek isinya.
- Tombol **Salin** tetap menyalin link saja. Di luar cakupan (tujuannya berbeda): share link
  scan panitia, kirim RSVP ke WA, link master privat, dan tombol WA bisnis AsProject.
- Kode bersama ada di blok `/* ==== PESAN WA UNDANGAN … */` yang wajib identik di
  `studio.html`, `master.html`, dan `undangan.html`. Dicek otomatis oleh
  `tools/cek-kesehatan.py` (bagian [25]) dan `node tools/test-pesan-wa.cjs` (jsdom, offline).

## Kerangka berbeda per tema (2026-10-15)

Sebelum rombakan ini, 18 tema publik berbagi **satu kerangka DOM**: tiap bagian
dibungkus `<div class="card rv">` + `<div class="kicker">` dengan urutan terkunci
1→7 (Kepada YTH · Doa · Profil · Waktu & Tempat · slide konten · Buku Tamu ·
Galeri · Amplop · Ucapan). Tema hanya menyuntik warna, font, pola, bingkai, dan
ornamen — jadi tema Rp49.000 dan tema Rp99.000 berbeda **cat** saja, bukan bentuk.

Sekarang tiap entri `TPL` membawa `layout:` yang menunjuk satu preset di
`const LAYOUTS` (`undangan.html`). Satu preset menentukan empat hal:

| Bidang | Arti |
|---|---|
| `shell` | kelas body `lay-<shell>` — bentuk & tata letak bagian (10 shell) |
| `urutan` | varian susunan bagian A–E — alur baca ikut berbeda |
| `ekstra` | bagian eksklusif yang hanya lahir di preset itu |
| `vip` | menyalakan mesin 4D (parallax 3 lapis + partikel + entrance sinematik) |

**18 tema publik memakai 18 preset berbeda**, jadi tidak ada dua tema yang
berkerangka sama. Enam varian Gerbang Arch (Studio-only) memakai lima preset yang
sudah ada ditambah `panggung-gerbang`.

Sepuluh shell: `klasik` (kerangka lama, tanpa aturan CSS), `editorial` (majalah
tanpa kotak kartu), `bab` (pembatas gelap + angka romawi), `split` (rail lengket
dua kolom di ≥900px), `zigzag` (panel selang-seling saling tumpang), `kaca`
(panel blur lebar beragam), `poster` (tiap bagian setinggi layar + scroll snap),
`arsip` (kertas bergaris + label cap), `lembut` (kartu miring berserak),
`panggung` (sinematik + pita foto full-bleed).

Enam bagian eksklusif — semuanya dibangun dari data yang **sudah ada** di
snapshot, jadi undangan lama ikut dapat tanpa pemiliknya mengisi apa pun:
`navDot` (navigasi titik lengket), `babAngka` (angka romawi per bagian),
`kutipBesar` (pita kutipan full-bleed), `heroFoto` (pita foto dari galeri),
`galeriStrip` (galeri geser mendatar), `jamFlip` (countdown gaya flip-clock).

### Cara kerjanya

- Bagian tidak lagi langsung dirangkai ke `h`. Tiap bagian jadi pembangun bernama
  di `B{}`, lalu `LX.urutan` yang menyusun lewat `susunBagian()`. Bagian dibangun
  **dalam urutan tampil** supaya nomor `scroll-reveal` (`RV()`) tetap mengikuti
  alur baca.
- `liveSlides()` dipecah jadi `slideBag()` yang mengembalikan kantong per-slide;
  `liveSlides()` dipertahankan sebagai pembungkus yang tetap mengembalikan
  **string** dengan urutan lama — `tools/test-peta.cjs` memanggilnya langsung dan
  `tools/cek-kesehatan.py` aturan 9 memeriksa ke-10 id slide di dalamnya.
- Kartu sengaja tetap **terang** di semua shell: banyak warna teks di
  `liveSlides()` di-hardcode (`#57503f`, `#4a4436`, `#8a7f72`) sehingga kartu
  gelap akan membuat teks tak terbaca. Yang didramatisir adalah ruang **antar**
  bagian, bukan kartunya.
- `#cover` tidak diubah: kerangka cover tetap diatur tema + `CVL` + `arch`.

### Jaminan regresi

Preset `klasik` melepas bagian apa adanya tanpa pembungkus, sehingga Ivory Klasik
— dan undangan lama yang snapshot-nya tidak membawa `layout` — menghasilkan HTML
**identik byte-per-byte** dengan sebelum rombakan. Daftar 20 bagian beserta kelas
body-nya direkam dari `origin/main` ke `tools/layout-klasik-golden.json` dan
dibandingkan setiap kali `tools/test-layout-tema.cjs` dijalankan.

Urutan `TPL` tidak digeser (indeks = nilai kolom `theme` di Supabase); rombakan
hanya **menambah** field. Studio mendapat `LAYOUT_NAMA` untuk melabeli pemilih
tema ("▦ Editorial Sage"), dijaga sinkron dengan `LAYOUTS[id].nama` oleh tes.

### Dua bug laten yang ikut diperbaiki

1. `AsVip4d.mount()` dipanggil **sebelum** `$('app').innerHTML=h`, padahal mount
   mencari `#cover` lewat `getElementById`. Cover selalu `null`, jadi mesin 4D
   tidak pernah benar-benar jalan meskipun CSS dan modulnya lengkap. Mount
   dipindah ke setelah DOM terpasang.
2. `tools/test-vip-4d.cjs` mengekstrak entri TPL per **baris**, padahal baris TPL
   dikemas beberapa tema sekaligus. Pola `/\{id:'x'[^\n]*?tier:'vip'/` menganggap
   `tier:'vip'` milik tema lain di baris yang sama sebagai milik tema pertama —
   saat diuji, `midnight-gold` yang bertier vip dilaporkan sebagai `ivory-klasik`.
   Diganti extractor per-objek yang menghormati kedalaman kurung dan string.

Lihat perbedaannya berdampingan di `katalog-demo/perbandingan-tema.html`
(bangun ulang: `node tools/bikin-perbandingan-tema.cjs`).

## Kerangka template baru: Blok + Token (2026-10-18, prototipe)

Kerangka template lama mengunci warna + layout dalam satu objek `TPL`
yang disalin ke tiga file (`studio.html`, `undangan.html`, `index.html`).
Kerangka baru memisah keduanya supaya tema dan layout bisa dipadangkan
bebas, dan template baru bisa dibuat tanpa menyentuh JavaScript:

- **Token** (`kerangka/token-tema.js`) — palet, font, ornamen, border,
  pola, deretan dekorasi. 27 token: 24 migrasi (id sama dengan TPL lama)
  + 3 baru (*Kopi Sunda*, *Langit Pagi*, *Senja Kencana*).
- **Blok** (`kerangka/registry-blok.js`) — 21 unit konten bernama
  (sampul, doa, mempelai, …) masing-masing dengan varian.
- **Template** (`kerangka/template.js`) = token + susunan blok
  (preset A–E atau array bebas) + varian per blok + ekstra.
  24 migrasi 1:1 + 8 template baru.
- **Motor** (`kerangka/motor.js`) — `kompilasiLama()` mengubah template
  baru menjadi entri TPL lama bila kombinasinya setara (renderer lama
  tetap bisa memakainya); `renderUndangan()` merender demo mandiri.
- **Demo** — buka `kerangka-demo.html`: galeri semua template, pratinjau
  render, panel DNA (token, susunan, varian blok) + JSON kompilasi legacy.

Jaminan keamanan (semua otomatis, `node tools/cek-kerangka.cjs`):

1. Referensi token diverifikasi terhadap registry `FONTS`/`ORNAMEN`/
   `POLA`/`BORDERS` di `undangan.html` — tidak ada id mengambang.
2. **Round-trip**: setiap template migrasi dikompilasi mundur dan
   dibandingkan field demi field dengan entri TPL asli — harus identik,
   jadi tidak ada tema lama yang berubah tampilannya.
3. Snapshot `LAYOUTS`/`URUTAN` (`kerangka/layouts-lama.js`) dibandingkan
   dengan `undangan.html` setiap jalan — tidak ada drift diam-diam.
4. Uji asap: seluruh 33 template dirender tanpa error.

**Integrasi produksi (2026-10-18):** literal `const TPL=[…]` di
`studio.html` & `undangan.html` kini **dibangkitkan** dari `kerangka/`
lewat `node tools/bangun-tpl.cjs` — kerangka/ adalah sumber kebenaran
tunggal. Yang masuk produksi: 24 tema migrasi (identik field-dem-field,
dibuktikan round-trip oleh `cek-kerangka.cjs` [6]) + 8 tema baru,
semuanya bertanda **Studio-only** dulu (pola Gerbang: tersedia di
pemilih tema Studio, belum di katalog publik `index.html` — bundle
React minified, disunting terpisah).

Enam template kombinasi bebas (*Noir Kutip*, *Sultan Arsip*, *Pop
Zigzag*, *Mentari Poster*, *Telur Emas*, *Kopi Jurnal*) merender
**live** lewat field `kb` di TPL: `layoutOf()` memakai shell &
susunan dari `kb`, `susunBagian()` mengikuti urutan bebas (kunci
section sudah diterjemahkan generator ke nama builder lama), dan
`kb.cover` menjadi hint model cover (dipakai Studio bila pemilik
belum memilih model lain, tersimpan sebagai `data.coverLayout`).
Varian blok selain cover (profil side, timeline horizontal, galeri
slider, …) mengikuti bawaan builder hingga builder mendukung varian.

Jaminan invariansi yang dijaga otomatis:
- Entry baru **selalu di akhir** array — kolom `theme` di Supabase
  (index ke array) untuk undangan lama tidak berubah.
- `cek-kerangka.cjs` [10] memastikan literal TPL di HTML == hasil
  generator (anti-drift); `cek-kesehatan.py` [11][13] memastikan
  urutan id studio == undangan dan katalog publik tetap 18 tema.
- `tools/test-kerangka-bebas.cjs` (jsdom, diikat di cek-kesehatan
  [35]) merender 6 template kb + 2 kompilasi legacy di renderer
  live: shell, urutan bebas, penomoran bab, strip galeri, jam
  flip, foto hero, dan hint cover diverifikasi satu per satu.
- Alur edit tema: ubah `kerangka/template.js` / `token-tema.js`,
  jalankan `node tools/bangun-tpl.cjs`, lalu `node tools/cek-kerangka.cjs`
  dan `python3 tools/cek-kesehatan.py`.

## Link undangan untuk semua tamu (tanpa nama) di Master & Studio (2026-10-15)

- Halaman **master.html** mendapat kartu **🌐 Link Undangan untuk Semua**: satu tautan
  tanpa `?to=` (sapaan pembuka umum *Bapak/Ibu/Saudara/i*) dengan tombol **Salin**,
  **💬 Share via WhatsApp**, dan **↗ Buka Undangan** — cocok untuk grup/media sosial;
  RSVP & buku tamu tetap tercatat. Saat mode *1 LINK* aktif, kartu menegaskan bahwa
  link inilah yang dipakai semua tamu.
- Sejak 2026-10-16 mode *personal ↔ 1 LINK* bisa diganti langsung dari dashboard Master
  (kartu **🧷 Mode Link Tamu**) dan daftar tamu bisa ditambah/diubah di sana — lihat
  **Mode link tamu & daftar tamu langsung dari Master (2026-10-16)** di bawah.
- Tab **Domain** di Studio kini menampilkan dua tautan terpisah: *Link untuk semua
  tamu (tanpa nama)* dan *contoh link personal* (`?to=NamaTamu`), masing-masing dengan
  tombol salinnya sendiri — sebelumnya tombol salin selalu membawa placeholder
  `?to=NamaTamu` sehingga rawan ikut terbagikan.
- Dicek otomatis oleh `tools/cek-kesehatan.py` (bagian link untuk semua tamu).

## Ronde 4: tata letak rapat, galeri grid, 5 model cover, musik lokal awet, urutan Studio (2026-10-15)

Masukan pengguna ronde ini: bagian bawah template jangan kosong memanjang, musik upload harus tetap
bersuara saat dipakai lagi, sediakan pilihan jenis cover (5 dulu), susun ulang urutan pengisian Studio,
dan galeri undangan jangan digeser — tampilkan beberapa foto sekaligus.

- **Galeri grid di undangan live** (`undangan.html`): carousel geser `.galx` diganti grid dua kolom
  (`.gal-grid`/`.gal-cell`) — foto pertama lebar penuh, maksimal enam foto tampil, sisanya ditandai
  overlay "+N foto"; ketuk foto tetap membuka lightbox. Petunjuk berubah jadi "Ketuk foto untuk memperbesar".
- **Slide tanpa ruang kosong**: `setupNavPager()` mengukur tinggi tiap bagian saat aliran normal lalu
  menggabung bagian pendek (greedy, maks `innerHeight-150`) ke satu slide (`.pslide-multi`); isi slide
  ditengahkan vertikal (`justify-content:safe center`) supaya slide pendek tidak menyisakan bawah kosong.
- **15 model cover pembuka** (`coverLayout`): lima model lama — Amplop Klasik (bawaan), Kartu Stationery,
  Foto Penuh, Gerbang Lengkung, Minimalis — ditambah Batik Nusantara (`batik`), Taman Sakura (`sakura`),
  Langit Malam (`night`), Tiket Kenangan (`ticket`), Editorial Majalah (`editorial`), Tumpukan Polaroid
  (`polaroid`), Kaca Embun (`glass`), Royal Nusantara (`royal`), Surat Arsip (`archive`), dan Neon Kota
  (`neon`). Tiap model baru memiliki komposisi dan suasana visual tersendiri. Pilihan ada di tab *Desain & Cover*
  Studio (`CV_LAYOUTS`/`setCvLayout`), tersimpan di draft, template kustom, arsip, dan payload publish, serta
  dirender undangan live lewat class `body.cvl-*` (+ monogram untuk model minimalis). Pratinjau Studio = iframe
  `undangan.html?preview=1` sehingga selalu sama dengan hasil publish.
- **Musik upload awet**: blob musik lokal disimpan ke IndexedDB (`asproject-musik`), bukan data URL di
  localStorage (penyebab kuota jebol & musik bisu saat dipakai lagi). `syncAudio()` mengambil blob URL dari
  IndexedDB; jika blob hilang muncul peringatan, dan publish mengingatkan bahwa musik lokal tidak ikut ke tamu.
- **Urutan Studio dirapikan**: 7 tab — Info Acara, Desain & Cover, Slide & Animasi, Musik & Galeri,
  Amplop & Ucapan, Tamu & QR, **Terbit & Bagikan** (gabungan Kirim Master + Domain) — plus tombol
  Lanjut/Mundur antar langkah di bawah isi tab; stepbar dan menu navigasi mengikuti susunan baru.
- Bukti tampilan: `.preview-shots/20-studio-picker-cover.png` s.d. `28-slide-2.png`.
- Dicek otomatis: `tools/cek-kesehatan.py` bagian 20–23 (galeri grid, packing slide, model cover, musik IDB,
  susunan tab) serta seluruh suite `tools/test-*.cjs`.

## Ronde 5: Simpan sebagai Template Baru (2026-10-15)

- Tab **Desain & Cover** menyediakan kartu **💾 Simpan sebagai Template Baru**. Template menyimpan palet,
  warna aksen, font judul/isi, border, ornamen, serta model dan gaya cover; foto undangan tidak disalin
  ke template. Nama template dibatasi 60 karakter.
- Perpustakaan `tplCustom` tersimpan di perangkat (maksimal 80), memiliki ID `custom-*`, badge **CUSTOM**,
  serta aksi **Nama**, **Salin**, dan **Hapus**. Saat template aktif dihapus, Studio memilih tema aman.
  Template baru dan hasil duplikasi bersifat khusus Studio secara bawaan.
- Centang **Tambahkan ke Katalog Publik** untuk membuat baris harga/promo di **Katalog Template** Studio.
  Tema publik dapat disembunyikan dari picker; menghapus baris katalognya mengembalikan tema menjadi khusus
  Studio. Array publik `TPL` tidak berubah sehingga indeks `theme` lama tetap stabil.
- Snapshot publish, arsip lokal, ekspor HTML, preview, dan pemulihan draft membawa definisi `tplCustom`.
  `undangan.html` memvalidasi ID, palet, font, pola, karakter, dan path aset sebelum memilih tema kustom;
  bila tema tidak dikenal, renderer tetap memakai fallback TPL publik. Draft lama tanpa `tplCustom` tetap
  dapat dibuka dan mempertahankan perpustakaan lokal yang sudah ada.
- Bantuan aksi baru menggunakan Bahasa Indonesia. Bukti Playwright berurutan setelah ronde sebelumnya:
  `.preview-shots/29-mobile-simpan-template.png`, `.preview-shots/30-desktop-template-kustom.png`,
  dan `.preview-shots/31-undangan-live-template-kustom.png`.
- Uji tambahan: `node tools/test-template-custom.cjs` dan (dengan server `python3 tools/serve.py 8080`)
  `node tools/test-template-custom-browser.cjs`. Suite lain yang mencakup regresi terkait: `tools/test-wedding-templates.cjs`,
  `tools/test-publish-fallback.cjs`, `tools/test-button-help.cjs`, dan `tools/test-mobile-browser.cjs`;
  seluruh suite diperiksa lagi oleh `python3 tools/cek-kesehatan.py`.

## Tambahan 10 model cover pembuka (2026-10-15)

Lima model cover yang sudah ada tetap tersedia; Studio kini menawarkan sepuluh gaya baru yang berbeda:

| ID | Nama di Studio | Arah visual |
|---|---|---|
| `batik` | Batik Nusantara | Bingkai geometris dan palet batik hangat |
| `sakura` | Taman Sakura | Kelopak merah muda, sudut lembut, nuansa musim semi |
| `night` | Langit Malam | Langit gelap bertabur bintang dan tipografi terang |
| `ticket` | Tiket Kenangan | Kartu tiket acara dengan perforasi dan garis putus-putus |
| `editorial` | Editorial Majalah | Tata letak asimetris, tipografi dan aksen editorial |
| `polaroid` | Tumpukan Polaroid | Bingkai foto putih miring seperti album kenangan |
| `glass` | Kaca Embun | Panel kaca buram dan kilau lembut |
| `royal` | Royal Nusantara | Zamrud gelap, garis berlapis, dan aksen emas |
| `archive` | Surat Arsip | Kertas bertekstur lawas dan tinta klasik |
| `neon` | Neon Kota | Latar urban gelap dengan cahaya neon kontras |

Semua model tersedia di grid responsif **Desain & Cover**, memiliki label/bantuan berbahasa Indonesia,
serta ikut tersimpan di draft, template kustom, snapshot publish, arsip, dan ekspor HTML. Renderer
`undangan.html` menerima ID yang sama; pemilih Studio dan renderer tidak mengubah urutan tema publik `TPL`.

Bukti Playwright berurutan: `.preview-shots/32-mobile-15-model-cover.png`,
`.preview-shots/33-cover-batik-nusantara.png`, dan `.preview-shots/34-cover-neon-kota.png`.
Pemeriksaan mencakup 15 model di renderer live, persistensi cover `neon` pada template kustom, serta
pemilih responsif di 320, 390, 768, dan 1280 px. Jalankan `node tools/test-wedding-templates.cjs`,
`node tools/test-template-custom.cjs`, `node tools/test-template-custom-browser.cjs` (dengan server lokal),
`node tools/test-button-help.cjs`, dan `python3 tools/cek-kesehatan.py`.

## Perbaikan alur Studio: publish ulang, riwayat, tombol kembali, pratinjau = hasil akhir (2026-10-14)

Empat keluhan alur kerja diperbaiki sekaligus:

1. **Publish ulang & penanda perubahan.** Setelah publish, setiap suntingan membuat
   bar editor menampilkan `● Ada perubahan belum dipublikasikan` dan tombol utama
   berubah jadi **🔁 Publish Ulang** (kuning saat ada perubahan). Penanda memakai
   `draftSig()` (hash isian, bukan foto base64) sehingga murah dihitung tiap ketikan;
   setelah publish ulang status kembali "undangan live sudah sinkron".
2. **Riwayat undangan yang pernah dibuat.** Halaman *Folder / Arsip* kini punya kartu
   **Riwayat dari server**: daftar semua slug yang pernah di-publish diambil dari
   Supabase (`muatRiwayat()`), dan **Buka** memuat isi lengkapnya ke editor
   (`bukaRiwayatServer()` → kolom jsonb `data`). Entri arsip lokal juga menyimpan
   snapshot lengkap (amplop, galeri, foto mempelai, daftar tamu, link mode) lewat
   `applyDraftData()`; foto base64 tidak ikut disimpan di perangkat (diambil ulang
   dari server) supaya `localStorage` tidak cepat penuh. `save()` kini tidak menelan
   `QuotaExceededError` diam-diam: arsip diringkas bertahap dan pemilik diberi tahu.
   Catatan privasi policy database ditampilkan di kartu riwayat.
3. **Tombol kembali.** Editor punya **← Layar Awal** (layar pembuka Studio; draft
   aman, ada tombol *▶ Lanjutkan Undangan*) dan **← Halaman Utama** (keluar situs);
   halaman Katalog/Arsip mendapat **← Halaman Utama** mendampingi *← Kembali ke
   Editor*.
4. **Pratinjau sama dengan hasil publish.** Studio tidak lagi menggambar ulang
   undangan: panel kanan dan floating preview memuat **`undangan.html?preview=1`**
   di iframe dan mengirim isian lewat `postMessage` (`barisUndangan()` — bentuk data
   yang sama persis dengan payload `publish()`). Mode pratinjau menyembunyikan tombol
   kontrol Studio, tidak menulis RSVP ke server, dan tidak mengulang animasi saat
   data diperbarui. Karena hanya ada satu renderer, perbaikan tampilan otomatis ikut
   ke pratinjau.

Dicek otomatis oleh `tools/cek-kesehatan.py` (bagian publish ulang/riwayat/tombol
kembali/pratinjau iframe), `tools/test-floating-preview.cjs` (iframe, drag, ⤒ cover),
`tools/test-wedding-templates.cjs` & `tools/test-foto-cover.cjs` (payload gaya/tema
ke renderer live), dan `tools/test-mobile-browser.cjs` (tanpa overflow 320–1280 px).

## Tombol kembali ke cover di undangan live (2026-10-14)

Selain tombol di Studio, undangan live (`undangan.html`) sekarang punya tombol
**⤒ Cover** di kanan bawah. Perilakunya:

- **Muncul hanya setelah undangan dibuka** (`body.opened`) — di layar cover
  pembuka tombol disembunyikan, jadi tamu tidak melihat kontrol sebelum masuk.
- Menekannya menghapus keadaan `opened`: undangan kembali ke cover pembuka dan
  tamu bisa menekan **Buka Undangan** lagi. Musik latar sengaja **tidak**
  dihentikan (sama seperti perilaku tombol musik).
- Otomatis **naik ke atas bar navigasi slide** saat undangan memakai mode
  `navpager`, dan **disembunyikan di hero katalog** (`index.html` memuat
  `undangan.html?demo=1&buka=1` dan menandai `body.embed-buka`) supaya iframe
  pratinjau tidak menampilkan kontrol yang tidak perlu.
- Bantuan tombol (tekan-tahan / F1) tersedia lewat `assets/button-help.js`.

Dicek otomatis oleh `python3 tools/cek-kesehatan.py` (bagian tombol kembali ke
cover), `node tools/test-ketahanan.cjs` (membalik `opened`, aman dipanggil
berulang), dan `node tools/test-mobile-browser.cjs` (muncul/sembunyi, ukuran
sentuh ≥44px, tanpa tumpang tindih dengan tombol musik atau bar slide).

## Halaman Katalog Template & Arsip di Studio (perbaikan 2026-10-12)

Menu **Katalog Template** (edit harga/promo) dan **Folder / Arsip** dibuka dari sidebar
*Menu Studio*. Di HP sidebar itu tersembunyi, dan dulu kedua halaman tidak punya tombol
apa pun untuk kembali — pengguna terjebak (halaman aktif ikut tersimpan, jadi *refresh*
pun tidak menolong). Sekarang:

- Kedua halaman punya toolbar lengket **← Kembali ke Editor** + **☰ Template & Menu**
  (`pageActions()`); pindah halaman lewat `goPage(id)` menutup menu HP dan mulai dari atas.
- Tiap baris katalog punya tombol **🗑 Hapus** (`delKat`, dengan konfirmasi). Baris buatan
  sendiri (dari **+ Tambah Template**) langsung hilang. Tema bawaan yang dihapus dicatat di
  `state.katalogDel` (tombstone) supaya **tidak ditambahkan lagi otomatis** saat halaman
  dibuka ulang — migrasi boot hanya menambah tema TPL yang belum ada **dan** tidak ada di
  daftar itu. Tombol **↺ Pulihkan Bawaan (n)** mengembalikannya; katalog kosong menampilkan
  tombol pulihkan juga. Menghapus dari katalog **tidak** menyembunyikan tema dari pilihan
  tema Studio — untuk itu tetap pakai tombol 👁️ (`katalogHide`).
- **+ Tambah Template** kini menggulir ke baris baru, memfokuskan kolom nama, dan memberi
  notifikasi (dulu tanpa umpan balik, sehingga mudah tertekan berkali-kali).
- Baris katalog **bertumpuk** (nama → harga → promo/badge → aksi) sebagai bawaan, lalu jadi
  satu baris hanya bila lebar daftarnya cukup (`@container kat (min-width:640px)` pada
  `.kat-list`). Lebar layar bukan ukuran yang tepat: kolom tengah desktop ≥ 1200 px hanya
  480 px, sementara di 1024 px justru ~730 px. Dulu di HP teksnya remuk per huruf.

Uji: `node tools/test-katalog-admin.cjs` (42 pemeriksaan jsdom: navigasi, hapus, buka ulang
dengan localStorage yang sama, pulihkan, katalog kosong, Undangan Baru) dan bagian `[23]`
di `tools/cek-kesehatan.py`.

## Rapikan total: bug yang ditemukan & diperbaiki (2026-10-16)

Pemeriksaan menyeluruh (statis + jsdom + Chromium sungguhan) menemukan enam hal yang
benar-benar salah. Semuanya sudah diperbaiki dan dikunci uji:

| # | Gejala yang dilihat pemilik/tamu | Sebab | Perbaikan |
| --- | --- | --- | --- |
| 1 | Nama tamu seperti **O'Brien** → tombol **QR / Copy / Download QR** di Studio diam saja (tanpa pesan). Konsol: *missing ) after argument list* | Nama disisipkan ke `onclick="fn('NAMA')"` hanya dengan `esc()`. Parser HTML mengubah `&#39;` kembali jadi apostrof, jadi JavaScript-nya rusak | `jsEsc()` (aman untuk atribut HTML **dan** literal string JS); dipakai di tombol yang memuat nama/link/no. rekening/slug pemilik |
| 2 | Mengetik daftar tamu di **Tamu & QR**: "Daftar Tamu & Link" tetap **0 tamu**, kartu QR & pratinjau pesan WA basi — nama baru muncul setelah pindah tab | `oninput` hanya menyimpan + memperbarui pratinjau iframe; daftar digambar ulang cuma oleh `render()` | `refreshTamu()` + `jadwalRefreshTamu()` (jeda 320 ms): jumlah, baris, kartu QR, dan pratinjau WA diperbarui langsung **tanpa** render penuh — kursor tetap di tempatnya |
| 3 | Bantuan tombol (tahan / F1) kadang tidak muncul di Studio (uji browser flaky) | Handler gulir selalu `hide()`. `focus()`/F1 **memicu gulir** → tooltip yang baru dibuat langsung dihapus. Race: kadang menang, kadang kalah | `place()` menghitung ulang posisi saat halaman bergulir; tooltip hanya ditutup bila tombolnya keluar layar. Gulir *sebelum* tooltip muncul tetap membatalkannya |
| 4 | `katalog-demo/undangan-luxury-seal.html` → **layar kosong** begitu unpkg diblokir/lambat (*React is not defined*) | Halaman demo mengambil React & ReactDOM dari CDN tepat saat halaman dibuka | React 18.3.1 UMD (MIT) disimpan di `assets/react*.production.min.js` + pesan gagal yang jelas bila berkas hilang |
| 5 | `tools/rsvp.sql` gagal dari Supabase SQL Editor | `create policy "rsvp_anon_read"` ditulis **dua kali** (dan tidak idempoten) | Ditulis ulang: tiap policy `drop policy if exists` + `create`, dijalankan berulang tetap aman |
| 6 | Ikon tab hilang di 24 halaman (master, demo, katalog-demo), semua halaman demo `lang="en"`, katalog utama tanpa keterangan/pratinjau tautan | Belum pernah ditambahkan | `assets/favicon.svg` (latar hitam + monogram emas) & `assets/apple-touch-icon.png` dipasang di semua 30 halaman, `lang="id"` diperbaiki, plus `description`/`og:*`/`theme-color` |

Tambahan kecil yang menyertainya:

- Undangan live kini mengisi **og:judul, og:keterangan, og:foto** dari data undangan
  (dulu teks bawaan "Undangan digital dari AsProject"); `og:image` dipakai hanya bila
  fotonya URL publik — foto lokal pemilik berbentuk `data:` diabaikan perayap.
- `katalog-demo/undangan-luxury-seal.html` masih satu-satunya demo yang butuh React;
  demo lain tetap murni HTML/CSS/JS.
- Rute tautan diperiksa ulang di server emulasi Pages: `/u/{slug}`, `/u/{slug}/` dengan
  `?to=` (termasuk `?to=` berisi `&`), `/checkin`, dan `/u/{slug}/checkin` semuanya mendarat
  di halaman yang benar; nama tamu berisi HTML/atribut (`?to=`) tidak menghasilkan satu pun
  elemen atau skrip baru (diuji 4 pola serangan di Chromium).

Laporan lengkap (termasuk yang sudah benar dan saran yang belum dikerjakan):
`LAPORAN-AUDIT-2026-10-16.md`, versi halaman siap cetak/PDF → **`laporan-audit.html`**
(ditandai `noindex`, dibuka lokal lewat `python3 tools/serve.py`:
`http://localhost:8080/laporan-audit.html`).

Uji & pemeriksa yang dikunci bersamanya:

- `node tools/test-bantuan-tombol.cjs` — 27 pemeriksaan jsdom (bantuan bertahan saat
  menggulir, tetap dibatalkan oleh gulir saat menahan, Escape/resize/pointer tetap menutup).
- `node tools/test-pesan-wa.cjs` — bertambah jadi 47 pemeriksaan: nama ber-apostrof
  (`O'Brien`) & ber-tanda kutip, daftar tamu hidup saat mengetik, pilihan tamu direset
  saat namanya dihapus dari daftar.
- `python3 tools/cek-kesehatan.py` — bagian **[29] Kerapian halaman** (ikon tab, `lang`,
  tidak ada skrip CDN yang bisa mematikan halaman, semua rujukan berkas lokal ada, og tags)
  dan **[30] Nama tamu aman di onclick & daftar tamu hidup**; ringkasan sekarang
  **383 ok, 0 masalah, 31 catatan** (setelah bab C di bawah).

## Aksesibilitas, mesin pencari, PWA & batas laju (bab C, 2026-10-17)

Tindak lanjut laporan audit: enam temuan "belum dikerjakan" pada bab C dikerjakan
seluruhnya, lalu diukur ulang dengan alat yang sama.

### Kontras teks (31 halaman → 0 temuan)

`tools/audit-kontras.cjs` mengukur seluruh pasangan teks/latar di Chromium (termasuk
gradien, opasitas, dan pseudo-elemen) memakai rumus WCAG. Awalnya 3 halaman katalog,
`index.html`, `scan.html`, `checkin.html`, dan undangan live punya temuan — semuanya
teks abu-abu di atas latar terang. Warna digelapkan **seminimal mungkin** lewat
`tools/audit-kontras-perbaiki.cjs --terap` (aturan CSS ditaruh di blok
`[aksesibilitas-c]` di tiap halaman), jadi tampilan tetap sama:

- katalog & halaman statis: 0 temuan (31 halaman);
- undangan live dengan 24 tema: teks konten ≥ 4.5:1, label ≥ 3:1 (lihat bagian
  *Kontras teks tema undangan*);
- state demo `master.html?demo=1`: 62 temuan → 0; sublabel tombol mode yang semula
  `opacity:.8` dinaikkan ke 1 (warna dasarnya sudah digelapkan).

Ulangi: `node tools/audit-kontras.cjs [--detail] [halaman…]` (butuh server `:8080`).

### Landmark & struktur judul

Setiap halaman kini punya tepat satu `<main>` (atau `role="main"`), header/footer di
luar main, dan satu `h1` yang terlihat. Sampul & panel mengambang di
`katalog-demo/undangan-wedding-gold.html` diberi `role="region"` + `aria-label`
sehingga isinya tidak lagi dilaporkan "di luar landmark". Hasil axe-core: **region
450 → 0**, halaman tanpa `<main>` **10 → 0**, tanpa `h1` **2 → 0**.

Ulangi: `node tools/audit-landmark.cjs`.

### `robots.txt` & `sitemap.xml`

- `robots.txt` mengizinkan semua halaman publik, menutup `/master.html`, `/scan.html`,
  `/checkin.html`, dan `/android/` (halaman internal & berkas unduhan), serta menunjuk
  `https://asproject.my.id/sitemap.xml`.
- `sitemap.xml` berisi 23 URL (beranda, 6 demo, 16 halaman katalog); halaman
  `noindex`, 404, studio, `undangan.html`, dan laporan audit sengaja tidak
  didaftarkan. Perubahan komposisi ini dijelaskan di bagian
  **Pemeriksaan ulang Google (2026-10-20)** di bawah.

### Web app manifest (PWA)

`manifest.webmanifest`: nama "AsProject — Undangan Digital", `start_url` `/`,
`display` standalone, warna `#0a0a0a`, ikon 192/512 + maskable 512 (dirender dari
`assets/favicon.svg`), dan pintasan ke Katalog & Studio. Tautan `<link rel="manifest">`
dipasang di 30 halaman (kecuali `laporan-audit.html`). Uji:
`node tools/test-manifest-pwa.cjs`.

### Batas laju RSVP & check-in

`tools/rsvp.sql` menambah tabel `public.rate_limit` (RLS aktif tanpa policy),
fungsi `batas_laju(kunci, maks, detik)` (security definer + `search_path` kosong),
lalu trigger `rsvp_batas_laju_trg`:

| Aksi | Batas |
| --- | --- |
| RSVP per IP | 12/menit & 60/jam |
| RSVP per (slug, tamu) | 30/jam |
| Check-in per IP | 30/menit & 200/jam |

IP diambil dari `x-forwarded-for`; bila header tidak ada, kuncinya jatuh ke
`tanpa-ip` sehingga pembatas tetap bekerja. Bila suatu saat perlu dilonggarkan:
`drop trigger rsvp_batas_laju_trg on public.rsvp;` (idem untuk check-in).
`tools/checkin.sql` bergantung pada `batas_laju()` dari `rsvp.sql`, jadi jalankan
`rsvp.sql` lebih dulu. Uji statis (parser SQL + idempotensi `create`/`drop`):
`node tools/test-sql-rsvp.cjs` — 19 lulus.

### Uji browser masuk CI

Workflow `.github/workflows/cek-kesehatan.yml` kini punya job **`browser`** yang
memasang `playwright-core`, `@sparticuz/chromium`, dan `axe-core`, menyalakan
`tools/serve.py :8080`, lalu menjalankan:

- `tools/test-button-help.cjs` (tooltip bantuan),
- `tools/test-template-custom-browser.cjs` (template kustom + screenshot),
- `tools/test-manifest-pwa.cjs` (manifest, ikon, tautan di 30 halaman),
- `tools/test-aksesibilitas.cjs` — axe-core di 11 halaman (kontras, region,
  satu `<main>`, satu `h1`, manifest) pada viewport 390×844: **59 lulus, 0 gagal**.

`tools/test-mobile-browser.cjs` tetap dijalankan manual karena beberapa
pemeriksaannya bergantung pada waktu animasi (mudah goyah). Di sandbox ini semuanya
lulus; pemeriksa repo: **383 ok, 0 masalah, 31 catatan**.

## Kenapa belum muncul di Google + persiapan pengindeksan (2026-10-18)

Laporan pemilik: **"kalo cari AsProject.my.id di Google ga ketemu"**. Hasil cek
(`site:asproject.my.id` di mesin pencari → **0 hasil**): situsnya memang **belum
sama sekali terindeks Google**, bukan kalah peringkat. Sebab-sebabnya:

| # | Sebab | Sifat |
| --- | --- | --- |
| 1 | **Belum didaftarkan ke Google Search Console** — tidak ada token verifikasi & sitemap belum pernah disubmit. Google tidak akan "tahu" situs baru tanpa pendaftaran/backlink | manual (perlu akun Google pemilik) |
| 2 | **Situs baru & tanpa backlink** — domain baru, belum ada tautan masuk dari situs lain yang bisa ditemukan perayap | butuh waktu + promosi |
| 3 | **Isi halaman dirender JavaScript** (`<main id="root">` kosong di HTML mentah) — perayap awal Google melihat halaman nyaris kosong | sudah diperbaiki di repo |
| 4 | **`og:image` berupa SVG** — perayap sosial/Google sering mengabaikan SVG untuk pratinjau; tidak ada JSON-LD/canonical | sudah diperbaiki di repo |

### Yang diubah di repo (bisa langsung terbit)

1. **Fallback SEO statis di `index.html`** — isi `<main id="root">` kini memuat
   kerangka konten nyata (h1 "Undangan Digital Online untuk Pernikahan, Khitanan,
   Ulang Tahun & Aqiqah", kategori + tautan demo, fitur, harga, kontak) yang
   **terbaca tanpa JavaScript**. React tetap mengganti isi `#root` dengan katalog
   hidup begitu aplikasi termuat (`createRoot().render()`), jadi tampilan pengguna
   tidak berubah.
2. **JSON-LD** (`Organization` + `WebSite` + `Service`/`AggregateOffer` Rp49.000–
   Rp99.000) di `<head>` — sinyal mesin pencari berstruktur.
3. **`<link rel="canonical">`, `og:url`, `og:site_name`, `og:locale`, twitter card`,
   `meta robots index,follow`**, plus judul/deskripsi yang memuat kata kunci
   pencarian ("undangan digital online pernikahan khitanan ulang tahun aqiqah").
4. **`assets/og-asproject.png`** (1200×630, onyx + emas) menggantikan SVG sebagai
   `og:image` di `index.html` & default `undangan.html` (undangan live tetap
   menimpa dengan foto cover bila ada).
5. `sitemap.xml` `lastmod` ikut diperbarui.
6. **Token verifikasi Google Search Console** — meta `google-site-verification`
   + berkas `google…html` di root (lihat langkah pemilik di bawah).

### Yang HARUS dilakukan pemilik (tidak bisa dari repo)

1. **Daftar Google Search Console** (search.google.com/search-console) →
   *Tambah properti* → pilih **Prefix URL** `https://asproject.my.id/`.
2. **Verifikasi** — token Search Console sudah terpasang di repo (2026-10-18):
   meta tag `google-site-verification` di `<head>` `index.html` **dan** berkas
   `/googlefku5Lf9fobFfFrM0tS5D20DLpLYw_4Am-pps2HQ1pzw.html` (metode *Tag HTML*
   maupun *Berkas HTML* sama-sama sah). Setelah deploy, cukup klik **Verifikasi**
   di Search Console. (Alternatif permanen: DNS TXT lewat registrar domain.)
3. **Sitemaps** → ketik `sitemap.xml` → **Submit**.
4. **URL Inspection** pada `https://asproject.my.id/` → **Request Indexing**
   (ulangi untuk `/demo/wedding-premium.html` dst. bila mau lebih cepat).
5. **Backlink**: pasang tautan `asproject.my.id` di bio Instagram
   `@asproject.my.id`, Google Business Profile, status WA, dan undangan yang sudah
   terbit (link `asproject.my.id/u/…` ikut menaikkan otoritas domain).
6. Tunggu **beberapa hari–2 minggu** untuk pengindeksan pertama; cek berkala dengan
   pencarian `site:asproject.my.id` (dari 0 hasil → minimal beranda muncul).

Catatan: `master.html`, `scan.html`, `checkin.html` sudah `noindex`/dilarang di
robots — memang sengaja tidak diindeks. Setelah Search Console aktif, halaman
**Jangan kirim URL undangan tamu** (`/u/{slug}`) ke *Request Indexing* — itu halaman
privat tamu.

## Pemeriksaan ulang Google: situs hidup, tapi belum masuk indeks (2026-10-20)

Laporan pemilik: **"di Google masih belum kelihatan link asproject.my.id"**.
Pemeriksaan langsung dari sandbox pada 2026-10-20 (bukan tebakan):

| Yang diperiksa | Hasil |
| --- | --- |
| `https://asproject.my.id/` | **HTTP 200**, judul & isi beranda tampil benar |
| `http://asproject.my.id/` | dialihkan ke HTTPS (HSTS/`https_enforced: true`) |
| `robots.txt`, `sitemap.xml` | terambil normal, sitemap XML valid |
| `/u/satrio-pandu-mahardika` | dirutekan `404.html` → `undangan.html?slug=…` (render "Membuka undangan…") |
| GitHub Pages build | `built`, selesai 2026-10-20 10:07 WIB, commit `d05326c` |
| Sertifikat & DNS | `approved` s.d. 2027-01-04; A record ke 185.199.108–111.153 (IP resmi Pages) |
| Verifikasi Search Console | token `google-site-verification` ada di `index.html` **dan** berkas HTML di akar |

Kesimpulan: **server tidak pernah mati.** Pesan `PAGE_NOT_FOUND` di percakapan
sebelumnya berasal dari alat penjelajah AI (kode internalnya), bukan dari GitHub
Pages — 404 milik repo ini berbunyi "Halaman tidak ditemukan — AsProject" dan 404
GitHub berbunyi "There isn't a GitHub Pages site here". Yang benar-benar terjadi:
halaman **sudah dirayapi** (Ringkasan AI Google mengutip kalimat dari blok SEO
statis kita: "studio penyedia undangan digital online … di Bandung … Rp49.000
hingga Rp99.000"), tetapi **belum masuk indeks** — `site:asproject.my.id` masih
0 hasil, jadi ini urusan pengindeksan, bukan hosting.

### Temuan penting: hasil #1 untuk "asproject.my.id" milik domain lain

Kueri `asproject.my.id` memunculkan **`aproject.my.id`** (kurang satu huruf *s*)
berjudul "AProject - Solusi Digital Modern". Saat dicek lewat DoH:

```json
{"Status":2,"Comment":"Name servers did not respond [exp2.liqu.id. (103.30.147.16)]"}
```

Artinya domain itu **nameserver-nya tidak menjawab** (mati/parking rusak) —
jadi hasil tersebut adalah **entri indeks basi**, bukan pesaing yang aktif.
Dua implikasi:

1. Google memakai domain berhuruf mirip karena belum punya halaman sendiri yang
   terindeks untuk nama itu → prioritas utama tetap memasukkan beranda ke indeks.
2. Nama merek rawan ditumpangi domain kembar. Sebaiknya `aproject.my.id` dan
   varian typo lain dipantau; kalau dipakai pihak lain untuk mengaku AsProject,
   itu ranah merek/registrar, bukan repo ini.

### Yang diperbaiki di repo kali ini

1. **Nomor WhatsApp contoh masih terbit di 4 halaman sitemap.**
   `katalog-demo/index.html`, `undangan-khitanan-basic.html`,
   `undangan-khitanan-premium.html`, dan `undangan-sage.html` masih memakai
   `6281234567890` — pengunjung yang menekan "Chat WhatsApp" tidak sampai ke
   pemilik. Semua diganti ke nomor resmi `6285196755675`.
2. **`canonical` + `description` + Open Graph untuk 23 halaman publik** lewat
   `tools/pasang-tag-seo.py` (idempoten, bisa dijalankan ulang). Sebelumnya
   tidak ada satu pun halaman demo/katalog yang punya `canonical`, sehingga
   Google melihat 20+ salinan mirip tanpa penanda halaman utama.
3. **`katalog-demo/index.html` dikeluarkan dari sitemap dan diberi `noindex`.**
   Halaman itu templat landing lama: harga Rp79rb/149rb/299rb, "50+ tema",
   "25+ tema", "No. 1" — berbeda dari produk yang dijual di `index.html`
   (18 tema, Rp49.000–Rp99.000, revisi unlimited). Dua daftar harga yang saling
   bertentangan di satu domain merusak kepercayaan pembeli sekaligus bersaing
   dengan beranda di hasil pencarian.
4. **`undangan.html` keluar dari sitemap dan kini `noindex, follow`.**
   Tanpa `?slug=` halamannya berbunyi "Undangan tidak ditemukan" (soft 404),
   dan undangan asli memang privat untuk tamu.
5. **`<meta charset>` `index.html` dipindah ke baris pertama `<head>`** —
   sebelumnya berada di byte 1051, lewat batas 1024 byte yang disarankan,
   karena ada router skrip di atasnya.
6. **Penjaga baru di `tools/cek-kesehatan.py` bagian [31]:** setiap URL di
   sitemap wajib punya `canonical` yang cocok + `description` ≥40 karakter, dan
   nomor WA contoh `6281234567890` dilarang muncul lagi di halaman terbit
   (`references/` dikecualikan karena itu salinan asli Drive).

### Yang tetap harus dilakukan pemilik (tidak bisa dari repo)

1. Buka **Search Console** → properti `https://asproject.my.id/` → **Verifikasi**
   (token sudah terpasang sejak 2026-10-18; cukup klik).
2. **Sitemaps** → submit `sitemap.xml` (23 URL). Kalau pernah submit versi lama,
   klik **Resubmit** supaya Google membaca komposisi baru.
3. **URL Inspection** → `https://asproject.my.id/` → **Request Indexing**.
   Ulangi untuk 2–3 halaman demo terpenting, jangan semua sekaligus.
4. **Bing Webmaster Tools** juga (Bing dipakai Copilot/ChatGPT search).
5. **Backlink nyata**: bio Instagram `@asproject.my.id`, Google Business Profile
   (Bandung), tautan di undangan yang sudah terbit, status WA, katalog eksternal.
   Ini satu-satunya cara mempercepat otoritas domain baru.
6. Cek berkala `site:asproject.my.id` (7–14 hari). Dari 0 hasil → minimal beranda.

> Catatan: perubahan ini membantu *kelayakan* indeks, bukan menjamin tanggal
> masuknya. Untuk domain baru, Google biasanya butuh 1–3 minggu setelah sitemap
> disubmit dan ada minimal beberapa tautan masuk.

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

Cara mengatur (di Studio, tab **Musik & Galeri**):

1. unggah **Foto Utama / Cover**;
2. pilih salah satu dari **9 gaya** (pratinjau memakai foto Anda sendiri);
3. atur **zoom (1×–4×)**, lalu geser fotonya di kotak “geser foto” (jari/mouse).
   Rentang geser mengikuti seluruh bidang crop setelah zoom, jadi foto bisa digeser
   sampai tepi bingkai;
4. bila salah pilih, tekan tombol **×** pada thumbnail untuk menghapus cover, foto
   pasangan/anak, foto galeri satu per satu, atau foto cerita;
5. tekan **Publikasikan** agar gaya + posisi foto ikut tersimpan ke undangan live
   (undangan yang sudah terbit perlu diterbitkan ulang).

Catatan teknis:

- posisi/zoom disimpan sebagai `coverPos:{x,y,z}` (persen). Renderer menyesuaikan
  ukuran foto terhadap bingkai dan menghitung `left/top` dari ruang crop yang tersedia;
  gaya disimpan sebagai `coverStyle`;
- gaya **`full`** memakai lapisan gelap + panel kaca `rgba(10,8,6,.84)` di belakang
  teks, sehingga teks putih tetap ≥ 4.5:1 **walau fotonya serba putih** (diuji);
- cover memakai tinggi viewport dinamis, menghormati safe area/notch, dan merapatkan
  tata letak pada layar pendek. Nama panjang bisa membungkus; konten tetap bisa
  digulir bila tinggi layar memang tidak cukup;
- undangan tanpa foto tampil **persis seperti sebelumnya** (tidak ada bingkai kosong).

Kartu **“Preview Undangan”** di dashboard master (`master.html`) juga menampilkan foto
cover itu beserta nama gayanya — termasuk crop yang sama, latar gelap untuk gaya `full`,
dan keterangan *“Belum ada foto cover”* bila belum diatur. Data diambil dari snapshot
undangan yang sudah dipublish, jadi tekan **Selesaikan Undangan** dulu agar ikut terbarui.

Uji: `node tools/test-foto-cover.cjs` (crop setelah zoom, tombol hapus, dan pratinjau
Master) dan bagian `[17]` di `tools/cek-kesehatan.py`.
Lembar perbandingan: `pilihan-gaya-foto-cover.png` dan `master-preview-foto-cover.png`
(di luar repositori; dibuat dengan skrip sharp, bukan bagian aplikasi).

## Peta lokasi undangan: ubin sendiri, embed Google jadi lapisan opsional (2026-10-16)

Tamu melaporkan slide **Peta** cuma bidang biru kosong, lengkap dengan kotak galat dari
Google sendiri ("Maaf, ka…" — terlihat di tangkapan layar ponsel tamu). Perbaikan
sebelumnya (iframe tidak dirender di dalam slide `display:none`, query tanpa duplikasi,
host kanonik `www.google.com/maps`) tetap ada dan tetap benar — dan tetap tidak cukup:
iframe-nya memang dimuat, footer Google ("Pintasan keyboard", "Data peta ©2026") juga
tergambar, **tapi ubin petanya tidak pernah datang**.

Isi iframe itu lintas-asal: status HTTP, geometri, sampai pesan galat di dalamnya tidak
bisa dibaca — dan tidak bisa diperbaiki — dari halaman kita. Karena itu tampilan peta
yang **wajib** muncul tidak lagi bergantung pada embed.

### Yang berubah

- **Pratinjau ubin sendiri** (`petaGambarUbin`): kanvas 3×3 ubin 256 px (zoom 17) dari
  tiga penyedia tanpa kunci API yang dicoba berurutan **per ubin** — CARTO Voyager
  (`@2x`, tetap tajam di layar rapat) → OpenStreetMap → Esri. Satu CDN yang diblokir
  jaringan tamu tidak lagi berarti peta kosong; ubin yang gagal cuma pindah penyedia.
- **Pin & atribusi digambar sendiri.** Pin SVG memakai aksen tema; teks atribusi
  mengikuti CDN yang benar-benar terpakai dan menautkan ke
  `openstreetmap.org/copyright` — syarat lisensi ubin.
- **Skala penutup dihitung, bukan ditebak.** Kanvas digeser supaya titik lokasi tepat di
  tengah kartu, lalu diskalakan seminimal mungkin yang masih menutupi seluruh kartu —
  tidak ada celah di tepi, berapa pun lebar layarnya (diuji 96 kombinasi titik × ukuran).
- **Koordinat dulu, jaringan belakangan.** Tautan Maps pemilik yang membawa koordinat
  (`@lat,lng`, `!3d/!4d`, `q=lat,lng`) dipakai langsung tanpa satu pun permintaan
  jaringan. Tautan pendek (`maps.app.goo.gl`) tidak membawa koordinat dan alamat
  tujuannya tidak bisa dibaca dari peramban, jadi jalur itu geokode **Nominatim** lalu
  **Photon** (batas 4,5 detik), hasilnya disimpan di `localStorage`
  (`asp-peta:<query>`, 30 hari) supaya membuka undangan berikutnya tidak menghubungi
  server geokode lagi. Catatan privasi: pada jalur itu nama tempat dikirim ke layanan
  geokode publik — sama seperti sebelumnya nama tempat dikirim ke Google lewat embed.
- **Embed Google jadi tombol, bukan tampilan wajib.** Tombol **🗺️ Peta interaktif**
  memasang iframe Google di atas pratinjau; menekannya lagi (teksnya berubah jadi
  **↩︎ Pratinjau peta**) mencabut `src`-nya supaya kuota tamu tidak dipakai untuk peta
  yang sedang tidak dilihat. Membuka undangan tidak pernah lagi memasang iframe itu
  sendirian. **↻ Muat ulang** hanya tampil di mode interaktif.
- **Selalu ada jalan keluar.** Tombol **🧭 Rute ke Lokasi**
  (`maps/dir/?api=1&destination=…`) membuka navigasi Google Maps langsung dari ponsel.
  Kalau pratinjau gagal (tiga CDN ubin diblokir **dan** geokode pun gagal), kartu masuk
  mode `.peta-gagal`: pesannya mengarahkan ke Google Maps dan seluruh area peta bisa
  ditekan. Tidak ada lagi bidang biru tanpa penjelasan.

### Jaminan regresi

`node tools/test-peta.cjs` (jsdom, 76 pemeriksaan) mengunci kontrak di atas: iframe lahir
tanpa `src` dan tetap tanpa `src` setelah pratinjau siap, 9 ubin dari penyedia pertama,
tiap `error` ubin berpindah CDN, geokode dipakai sekali lalu dari cache, mode gagal
memunculkan tautan keluar, alamat ber-tag tetap ter-escape, plus uji properti geometri:
96 kombinasi titik (Indonesia, lintang ekstrem, bujur 0) × ukuran kartu harus tertutup
penuh dengan pin tepat di tengah. `python3 tools/cek-kesehatan.py` menjalankan tes yang
sama sebagai bagian repo (aturan `[26]`).

## Kartu QR check-in di dalam undangan (2026-10-16)

QR check-in dulu hanya bisa **diunduh dari Studio** sebagai PNG, jadi tamu yang datang
tanpa cetakan tidak punya apa pun untuk dipindai panitia. Sekarang undangan menampilkan
QR itu untuk tamunya sendiri, di kartu **🎟️ Kartu Tamu · QR Check-in** yang menempel di
bagian **RSVP** (bukan slide baru — urutan 10 slide tetap sama).

### Isi QR = sama persis dengan yang diunduh dari Studio

`checkin.html?guest=<nama>&id=<KODE>&s=<slug>` — dibangun dari basis akar situs, jadi
tetap benar walau undangan dibuka lewat `/u/{slug}` (segmen `/u/` dipotong lebih dulu,
lihat `qrBasisUrl`). Panitia memindainya dengan `scan.html` seperti biasa, atau tamu
tinggal menekan **⬇ Simpan QR** (PNG 600 px + pita emas berisi kode & nama, seragam
dengan berkas dari Studio) kalau ingin menyimpannya di galeri.

### Bagaimana nama tamunya didapat

- **Tautan personal** (`?to=Nama`) → QR langsung tampil begitu undangan dibuka.
- **Mode 1 link untuk semua** → kartu QR mulai kosong dengan petunjuk, lalu QR muncul
  begitu tamu menulis namanya di kolom RSVP (dengan jeda 300 ms supaya tidak digambar
  ulang tiap ketukan).
- Nama yang **tidak ada di daftar tamu** tetap dapat QR, tapi tanpa `id` — panitia
  mencatat kehadiran dari namanya. Hanya kecocokan **persis** (tanpa beda huruf besar/
  kecil) yang boleh memakai kode, supaya nama yang mirip tidak tercatat sebagai tamu lain.
- RSVP dimatikan? Kartu QR tetap tampil sendiri di posisi yang sama.

### Ramah kuota & tanpa layanan luar

`assets/qrcode.js` (MIT) **dimuat malas** — tamu yang tidak menyentuh RSVP tidak
mengunduh 56 KB ekstra. QR-nya digambar sebagai SVG (tajam di layar rapat, quiet zone
4 modul, modul gelap digabung per baris), tanpa panggilan ke layanan pembuat QR mana pun.
Berkas HTML mandiri (`file://`) tidak menampilkan kartunya karena tidak punya alamat
publik untuk QR. Kalau pustaka/penggambaran gagal, kartunya bilang apa adanya dan
mengarahkan panitia mencatat manual.

### Mode pindai & centang "sudah check-in" (2026-10-16)

- **🔆 Mode pindai** membuka lapisan **layar putih penuh** berisi QR yang lebih besar
  (disalin dari kartu, bukan digambar ulang, jadi yang dipindai panitia persis QR yang
  sama), nama, kode, dan tombol Tutup. Layar **ditahan tetap nyala** (`navigator.wakeLock`)
  dan **layar penuh** diminta — keduanya opsional: peramban yang tidak mendukung atau
  menolaknya tidak mengganggu tampilan, dan keduanya dilepas saat ditutup. Lapisan ini
  juga bisa ditutup dengan tombol Escape atau menekan area kosongnya.
- **✅ Sudah check-in** muncul di kartu QR (dan di mode pindai) setelah panitia memindai
  QR tamu di `scan.html` — kartu membaca **satu baris tamu itu sendiri** dari tabel
  `checkin`, sekali saat QR digambar lalu tiap 60 detik selama undangan masih dibuka,
  dan ikut mengecek saat tab kembali aktif. Permintaannya **satu pada satu waktu**
  (tidak menumpuk), berhenti begitu tamunya sudah tercatat, dan diam saja kalau tabel
  `checkin` belum dibuat, jaringan putus, atau undangan sedang mode demo/pratinjau —
  tidak ada lencana palsu dan tidak ada galat halaman.

### Jaminan regresi

`node tools/test-qr-undangan.cjs` (jsdom, 78 pemeriksaan) mengunci: panel menempel di
kartu RSVP, nama dari `?to=` vs nama yang diketik, aturan kecocokan kode, basis URL di
`/u/{slug}`, XSS nama ber-tag, jalur unduh PNG → SVG, dan yang terpenting — **QR yang
benar-benar digambar dibaca kembali oleh `assets/jsqr.js`** (dekoder yang dipakai
`scan.html`) menjadi URL check-in yang utuh. `python3 tools/cek-kesehatan.py` menjalankan
tes yang sama sebagai aturan `[27]`.

## Mode link tamu & daftar tamu langsung dari Master (2026-10-16)

Laporan pemilik: **"Link personal sama yang semua tamu sama"** dan **"di undangan
master mau isi yang personal juga ga ada opsinya"**. Tautannya tidak salah — undangan
yang sudah di-publish memakai snapshot dengan `data.linkMode = "single"` (mode *1 LINK*),
dan di mode itu Master memang mengirim satu tautan tanpa nama untuk semua tamu, termasuk
di kartu *Link Personal Tamu* yang tetap memamerkan tautan tanpa `?to=`. Yang hilang cuma
satu: **cara berpindah mode tanpa kembali ke Studio.**

### 🧷 Kartu Mode Link Tamu

- Dua pilihan: **👤 Link Personal — beda tiap tamu** (`?to=Nama` per tamu, sapaan
  *Kepada Yth.* di undangan otomatis menyebut namanya) dan **🔗 1 Link untuk semua tamu**
  (satu tautan tanpa nama, praktis untuk grup WhatsApp & status). Kartu menuliskan mode
  aktif + jumlah tamu.
- Menekan salah satu langsung menyimpan: `PATCH /rest/v1/invitation_drafts?slug=eq.…`
  dengan **body `{data:…}` saja**. Snapshot diklon lebih dulu, jadi `form`, `amplop`,
  `guestsRaw`, `guestCodes`, galeri, dan slide tidak ikut hilang. Undangan yang sudah
  di-publish membaca baris yang sama → **tidak perlu publish ulang**.
- Menekan mode yang sudah aktif tidak mengirim permintaan apa pun.
- Database menolak (RLS/schema lama) atau jaringan putus → perubahan tetap terlihat di
  dashboard + pesan jujur berisi arahan ke **Studio → tab Tamu & QR** lalu publish ulang.
  Tidak pernah diam-diam tampak "tersimpan". Mode demo berubah di layar dengan pesan
  "hanya pratinjau", tanpa menyentuh jaringan.

### 👥 Kartu Link Personal Tamu selalu bisa dipakai

- Walau mode 1 LINK aktif, tautan `...?to=NamaTamu` tetap **ditampilkan dan tetap bekerja**
  di undangan live, lengkap dengan tombol **👤 Pakai mode personal** dan **📋 Salin link
  personal semua** (daftar `Nama: link` siap tempel).
- Baris tamu diberi tanda **link umum**/**link personal**; di mode 1 LINK tiap baris dapat
  tombol **👤 Salin link personal** sendiri.
- **Salin Semua** mengikuti mode: 1 LINK → link umum sekali + petunjuk cara pindah mode;
  personal → daftar per tamu. Tombol WhatsApp per tamu & **Bagikan Semua** ikut mode yang
  sama (Bagikan Semua tetap memakai link umum, sesuai fungsinya).

### ✍️ Tambah / Ubah Daftar Tamu dari dashboard

- Satu nama per baris di kotak editor. **💾 Simpan Daftar Tamu** merapikan spasi ganda,
  membuang baris kosong & duplikat (tanpa peduli huruf besar/kecil & spasi), lalu
  menyimpan lewat jalur `PATCH {data}` yang sama — tanpa publish ulang.
- **Kode QR tamu lama tidak berubah**: nama yang cuma dirapikan tulisannya
  (`pak andi` → `Pak Andi`) tetap memakai kode yang sama, jadi QR yang sudah dicetak atau
  dibagikan tetap sahih. Nama baru mendapat kode 8 huruf/angka kapital dengan aturan yang
  sama seperti Studio, langsung terbaca di undangan live.
- Tombol **↺ Kembalikan** mengembalikan isi kotak ke daftar yang tersimpan; pesan hasil
  menyebut jumlah tamu baru/dihapus dan total tamunya.

### Jaminan regresi

`node tools/test-master-link.cjs` (jsdom, 63 pemeriksaan) mengunci: kartu mode & tombol
"Pakai mode personal" ada, ganti mode mengirim PATCH kolom `data` berisi `linkMode` baru
sementara `form`/`amplop`/`guestsRaw`/`guestCodes` tetap utuh, tampilan (link per baris,
tag, tombol salin, pesan WA) ikut berubah, RLS menolak & jaringan putus tetap jujur di
layar, editor tamu (rapikan, dedupe, kode lama, kode baru), XSS nama ber-tag, dan mode demo
tidak menembak jaringan. `python3 tools/cek-kesehatan.py` menjalankan tes yang sama sebagai
aturan `[28]`.

## Amplop digital hilang dari undangan — satu bentuk data untuk Studio, Master & tamu (2026-10-17)

Laporan pemilik: **"bagian amplop nya ga muncul di undangan"**. Penyebabnya bukan tema
atau urutan bagian, melainkan **dua bentuk data amplop yang saling bertabrakan**:

| Halaman | Bentuk yang ditulis |
| --- | --- |
| Studio | `{ showAmplop, bank, noRek, pemilik, ewallet, noEwallet, showCopy }` |
| Master (versi lama) | `{ on, name, acc, holder }` |
| undangan.html | hanya membaca bentuk Studio |

Akibatnya, membuka **Undangan Master → Edit Info Bank** menampilkan kolom kosong untuk
undangan yang diisi dari Studio. Lebih parah, menekan **Simpan Perubahan Bank**
mengganti seluruh objek `amplop` dengan bentuk lama, sehingga syarat
`showAmplop && (noRek || noEwallet)` tidak pernah benar dan kartu **Amplop Digital**
lenyap dari undangan tamu.

### Yang diperbaiki

- **Satu normalisasi** (`amplopNormal`) di `undangan.html`, `master.html`, dan
  `studio.html`. Kedua bentuk dibaca; `acc`/`holder`/`on` diterjemahkan ke
  `noRek`/`pemilik`/`showAmplop`. Snapshot yang sudah terbit **pulih tanpa publish
  ulang**.
- **Master menyimpan dengan `Object.assign`**: hanya kunci bank yang diperbarui,
  sedangkan `ewallet`, `noEwallet`, dan `showCopy` dari Studio tetap utuh. Bentuk lama
  tetap ditulis agar dashboard lama tidak kehilangan arti.
- **Studio** menormalkan snapshot lama saat dibuka (isian bank tidak lagi tampak kosong),
  mempertahankan nama bank bebas dari Master sebagai pilihan, dan menampilkan peringatan
  **“Amplop sudah diisi, tapi belum ditampilkan”** + tombol **Tampilkan sekarang** bila
  nomor sudah diisi tetapi kotak *Tampilkan* belum dicentang. Peringatan yang sama muncul
  setelah Publish.
- **Sakelar tetap dihormati**: `showAmplop:false`/`on:false` menyembunyikan bagian
  amplop (data rekening tidak pernah tampil tanpa izin). Data lama yang punya nomor
  tetapi tidak punya penanda tampil/sembunyi dianggap tampil agar isian yang terlanjur
  tersimpan tidak jadi tak terlihat.

### Cara pakai (bila amplop masih belum muncul)

1. Buka **Studio → tab Amplop & Ucapan**. Isi Bank, No Rekening, dan Nama Pemilik.
2. Centang **Tampilkan** (kotak di kanan judul kartu). Tombol **Tampilkan sekarang**
   pada peringatan juga bisa dipakai.
3. **Publish** ulang. Untuk snapshot yang terakhir disimpan dari Master lama, undangan
   live langsung membaca bentuk barunya tanpa publish ulang.

### Jaminan regresi

`node tools/test-amplop.cjs` (jsdom, 27 pemeriksaan) mengunci: Master membaca isian
Studio, menyimpan tanpa menghapus e-wallet, undangan menampilkan bentuk Studio **dan**
bentuk Master lama, sakelar Tampilkan & tombol Salin, XSS nama bank/nomor rekening, serta
normalisasi + peringatan di Studio. `python3 tools/cek-kesehatan.py` menjalankannya
sebagai aturan `[34]`.

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
