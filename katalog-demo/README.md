# Katalog Demo — templat jadi dari Google Drive

Folder ini menampung **templat undangan satu berkas** dari koleksi Google Drive
"Katalog demo" dan demo mandiri baru yang dibuat native untuk AsProject. Templat lama
sudah dibersihkan dari jejak deploy pihak ketiga dan seluruh koleksi di-brand sebagai
**AsProject**. File demo tetap halaman mandiri—Studio dan renderer live memakai versi
tema native, bukan mengimpor halaman demo. Sebagian demo ditautkan lewat tombol *Demo
Live* katalog publik; enam demo tambahan di bawah dibuka lewat URL langsung.

## Isi folder

| Berkas | Sumber di Drive | Dipakai oleh tema katalog |
|---|---|---|
| `undangan-sage.html` | *Sage Blossom* (statis) | Minimalist Sage |
| `undangan-demo.html` | *Emerald Gold* (statis) | Adat Jawa Elegan |
| `undangan-sky-blue.html` | *Ice Blue* (React) | Biru Ceria |
| `undangan-khitanan-basic.html` | *Khitanan Basic* (React) | demo cadang kategori Khitanan |
| `undangan-khitanan-premium.html` | *Khitanan Premium* (React) | Islamic Elegant |
| `undangan-wedding-gold.html` | *Premium Wedding* (React) | Floral Rustic |
| `undangan-luxury-gold.html` | *Luxury Invitation* (implementasi ulang native dari referensi React) | Luxury Gold |
| `undangan-wedding-rosewood.html` | Rosewood · blush & champagne | demo tambahan; tidak mengubah routing katalog |
| `undangan-wedding-sage-pearl.html` | Sage Pearl · sage & ivory | demo tambahan; tidak mengubah routing katalog |
| `undangan-wedding-midnight-navy.html` | Midnight Navy · navy & champagne | demo tambahan; tidak mengubah routing katalog |
| `undangan-khitanan-emerald.html` | Khitanan Emerald · emerald & gold | demo tambahan; tidak mengubah routing katalog |
| `undangan-aqiqah-natural.html` | Aqiqah Natural · ivory & sand | demo tambahan; tidak mengubah routing katalog |
| `undangan-ulang-tahun-ceria.html` | Pesta Ceria · plum & coral | demo tambahan; tidak mengubah routing katalog |
| `undangan-luxury-seal.html` | *Luxury Invitation No. 001* — artifact React dari sesi Arena, dipulihkan | demo mandiri; tidak di-route katalog |
| `perbandingan-tema.html` | dibangun `tools/bikin-perbandingan-tema.cjs` | 24 tema berdampingan + 15 model cover |
| `index.html` | halaman pengantar Drive | **legacy / `noindex`** — templat landing lama dengan harga & jumlah tema berbeda dari produk; lihat catatan di bawah |
| `foto-cover.jpg`, `foto-rahma-cover.jpg` | foto contoh | latar cover halaman-halaman di atas |

Enam demo tambahan di tabel tetap menjadi halaman mandiri untuk pratinjau langsung lewat
URL. Lapisan visual Gerbang Arch juga tersedia sebagai **enam pilihan Studio-only** yang
bisa dipilih per kategori dan dipakai saat publish ke renderer live. Tema-tema ini belum
ditambahkan sebagai listing atau harga baru di katalog publik. Floral Rustic tetap
menggunakan `undangan-wedding-gold.html`.

> **Status saat ini:** halaman `katalog-demo/index.html` adalah pengantar lama dan
> telah diganti dengan tautan menuju `/katalog/` serta `/harga/`; halaman tetap
> **`noindex, follow`** dan tidak didaftarkan di sitemap. Halaman-halaman lain di
> folder `katalog-demo/` adalah demo arsip dengan data contoh, diberi `noindex`, dan
> tidak mewakili harga/ketentuan saat ini. Katalog SEO aktif ada di `/katalog/` dan
> halaman detail aktif ada di `/template/{id}/`.

### Foto lokal untuk enam demo tambahan

Semua foto galeri memakai path lokal relatif dari folder `katalog-demo/`; foto tetap
tersedia offline dan tidak perlu diunduh dari URL eksternal.

- Rosewood: `../assets/demo/wedding/01-jawa-elegan.jpg`, `02-minimalist-sage.jpg`,
  `04-floral-rustic.jpg`; foto latar sampul: `foto-cover.jpg`.
- Sage Pearl: `../assets/demo/wedding/01-jawa-elegan.jpg`, `02-minimalist-sage.jpg`,
  `04-floral-rustic.jpg`; foto latar sampul: `foto-rahma-cover.jpg`.
- Midnight Navy: `../assets/demo/wedding/01-jawa-elegan.jpg`, `02-minimalist-sage.jpg`,
  `03-luxury-gold.jpg`; foto latar sampul: `foto-cover.jpg`.
- Khitanan Emerald: `../assets/demo/khitanan/01-islamic-elegant.jpg` dan
  `02-biru-ceria.jpg`.
- Aqiqah Natural: `../assets/demo/aqiqah/01-baby-boy.jpg`, `02-baby-girl.jpg`,
  `03-islamic-neutral.jpg`.
- Pesta Ceria: `../assets/demo/ultah/01-kids-party.jpg`, `02-sweet-17.jpg`,
  `03-adult-elegant.jpg`.

### Lapisan visual Gerbang Arch dari Drive

Referensi Drive `undangan_x5f_premium_x5f_gerbang_x5f_arch.html` memberi arah visual
untuk keenam demo mandiri dan varian Studio-only. Pembaruan menambahkan frame arch
berlapis pada foto sampul, foto utama, dan galeri; permukaan ivory; kontras charcoal;
serta aksen lembut dari palet tiap kategori. Pada halaman demo, amplop tetap menjadi
pintu masuk, sementara kartu lipat QR/peta, personalisasi, countdown, RSVP lokal, musik
opsional, dan konten kategori tetap dipertahankan.

- Tiga varian Pernikahan: Rosewood, Sage Pearl, dan Midnight Navy.
- Khitanan Emerald, Aqiqah Natural, dan Pesta Ceria.
- Keenamnya tersedia di pemilih tema Studio sesuai event. Hasil publish memakai skin
  arch pada renderer live, tanpa mengganti fitur RSVP, QR check-in, musik, atau editor.
- Varian bertanda `studioOnly`: tidak menambah baris harga/promosi di Studio maupun listing
  atau harga baru di katalog publik. Array Studio dan live tetap seirama; route Floral Rustic tidak berubah.

Foto pada demo mandiri tetap menggunakan aset lokal yang tercantum di bagian **Foto lokal
untuk enam demo tambahan** di atas.

### `undangan-luxury-seal.html` — artifact Arena yang dipulihkan

Undangan "Luxury Invitation No. 001 · Aurelia & Leonhard" ini **bukan** berasal dari
Google Drive dan **bukan** bagian dari sistem tema `TPL`. Aslinya dibuat sebagai
*chat artifact* di sesi Arena sebelumnya, jadi hanya hidup di dalam percakapan itu —
tidak pernah masuk repo, dan sandbox sesi lama sudah dibuang. Berkas ini adalah
pemulihan dari sumber yang ditempel ulang, supaya karyanya tidak hilang lagi.

Bedanya dari 12 demo lain:

- **React 18 + Tailwind**, satu komponen `_o()` dengan animasi bertahap
  (`idle → crack → flap → light → burst → rise → done`), bukan HTML/CSS statis.
- **Segel lilin interaktif**: pecah saat diklik, confetti emas, debum emas di kanvas,
  efek tilt mengikuti mouse/`deviceorientation`, jejak kursor bercahaya, dan audio
  WebAudio yang dibangkitkan saat runtime (tidak ada berkas suara).
- **Kartu bisa dibalik** dengan drag (mouse/sentuh) untuk melihat sisi belakang
  berisi QR dan peta.
- **CSS Tailwind di-inline** (dipanen dari artifact, hanya kelas yang dipakai) supaya
  tidak bergantung `cdn.tailwindcss.com`; React/ReactDOM diambil dari `unpkg.com`
  dan Google Fonts dari `fonts.googleapis.com`. **Butuh internet** untuk membuka.

Tiga penyesuaian dari versi artifact, semuanya di bagian atas `<script>` dan diberi
komentar:

1. Bundel React inline (~45 KB minified) diganti CDN + shim alias `F`, `gf`, `yf`,
   `f`, `w`, sehingga kode komponen di bawahnya tidak berubah sama sekali.
2. Shim `f`/`w` meniru **`jsx()`/`jsxs()` dari `react/jsx-runtime`**, bukan
   `React.createElement`. Ini wajib: pada jsx-runtime argumen ke-3 adalah *key*,
   pada createElement argumen ke-3 adalah *child*. Kalau salah peta, semua
   `.map((h,m)=>w(type,{...},m))` cuma merender angka indeksnya — timeline, galeri,
   ucapan, dan angka countdown jadi kosong.
3. Spasi antar-kata pada nama yang dipecah per huruf diganti `\xA0` (non-breaking
   space); tiap huruf adalah `inline-block`, jadi spasi biasa akan kolaps.

Chrome khusus Arena dibuang karena tidak berlaku di luar chat: `@font-face`
"Optimistic", `data-clippy-inline-media-manifest`, dan tiga `<script>` protokol
postMessage `ecto:*`. `<link>` Google Fonts **ditambahkan** — artifact aslinya tidak
punya, sehingga Cormorant Garamond / Great Vibes / Montserrat jatuh ke font serif
bawaan.

> **Catatan:** tanggal bawaan `2026-06-20T17:00` sudah lewat, jadi countdown
> menampilkan `00 : 00 : 00 : 00`. Ganti lewat tombol **✦ BUAT SEPERTI INI**
> (atau state awal `M` di baris `function _o()`). Semua perubahan hanya pratinjau
> lokal di memori — tidak tersimpan dan tidak terkirim ke mana pun, sama seperti
> RSVP-nya.

Sudah diverifikasi render headless (jsdom + React 18.3.1 UMD): cover, urutan buka
segel, timeline 4 item, galeri 4 kartu, ucapan 2 kartu, countdown 4 angka, QR 49 sel,
sisi belakang kartu, modal personalisasi (5 input + reset), dan modal RSVP (kirim →
"Terima kasih!" → tutup sendiri) semuanya muncul tanpa error runtime. Tampilan visual
tetap perlu dilihat langsung di browser karena sandbox tidak punya browser.

### Halaman perbandingan tema (`perbandingan-tema.html`)

Menampilkan **24 tema berdampingan** (18 publik + 6 varian Gerbang Arch khusus Studio)
beserta **15 model cover** dalam satu layar, supaya perbedaan antar tema bisa dinilai
tanpa membuka Studio satu per satu. Tiap kartu merender gradasi `g[0]→g[2]`, warna
aksen, warna tinta, font judul, dan pola latar — nilai yang sama persis dengan yang
dipakai renderer `undangan.html`.

Sejak rombakan kerangka 2026-10-15 tiap kartu juga menggambar **diagram kerangka**:
nama preset `layout`, shell CSS, varian urutan, daftar bagian bernomor sesuai susunan
yang benar-benar dirender, bagian eksklusif, dan tanda `4D` bila preset itu menyalakan
mesin parallax/partikel. Inilah yang membedakan tema selain palet — dua kartu bisa
dibandingkan susunannya secara langsung.

Mockup cover **tidak lagi** menggambar kicker, ornamen (`deco`), dan label template
(`chara`): sejak PR #21 renderer menyembunyikannya di cover lewat
`#cover .inner>.kicker,#cover .inner>.chara,#cover .inner>.orn{display:none!important}`.
`deco` tetap dipakai di divider dan footer; `chara` saat ini tidak tampil di mana pun.

Halaman ini **dibangun, bukan disunting manual**. Datanya dipanen dari `const TPL` /
`const CV_LAYOUTS` di `studio.html` dan `const FONTS` / `const LAYOUTS` / `const URUTAN`
/ `function patCss()` di `undangan.html`, lalu tekstur polanya di-inline saat build.
Setelah menambah tema baru di akhir array atau menambah preset layout, jalankan ulang:

```bash
node tools/bikin-perbandingan-tema.cjs
python3 tools/serve.py            # buka /katalog-demo/perbandingan-tema.html
```

Nomor `#` di tiap kartu adalah **indeks array TPL**, yaitu nilai kolom `theme` di
Supabase — berguna saat menelusuri undangan lama. Halaman ini tidak ditautkan dari
katalog publik dan tidak mengubah `DEMO_BY_NAME` / `DEMO_BY_CATEGORY`.

### Galeri pratinjau nyata (`galeri-kerangka.html`)

```bash
node tools/bikin-galeri-kerangka.cjs
python3 tools/serve.py            # buka /katalog-demo/galeri-kerangka.html
```

Melengkapi halaman perbandingan di atas. Bedanya mendasar:

| | `perbandingan-tema.html` | `galeri-kerangka.html` |
|---|---|---|
| Isi kartu | mockup HTML buatan tangan | **iframe ke renderer produksi** |
| Sumber | `TPL` + `CV_LAYOUTS` + `LAYOUTS` | `../undangan.html?demo=1&tpl=<id>&buka=1` |
| Guna | membandingkan spesifikasi & diagram kerangka | melihat hasil nyata yang diterima tamu |

24 tema dikelompokkan menurut **shell** (10 kelompok), tiap bingkai diberi label preset,
urutan, jumlah bagian, dan chip bagian eksklusifnya. Tiga tombol di kepala mengatur lebar
bingkai — **390 / 768 / 1100 px** — karena shell `split` baru berubah jadi dua kolom dengan
rail lengket pada 900 px ke atas, dan `poster` mengandalkan scroll-snap setinggi layar.

Parameter `demo=1&tpl=<id>&buka=1` bukan hal baru: pola yang sama sudah dipakai kartu
katalog di `index.html`. Mode demo sengaja **tidak memutar musik**, jadi memuat 24 iframe
sekaligus tidak menimbulkan suara bertumpuk. Semua iframe memakai `loading="lazy"` supaya
hanya yang terlihat yang benar-benar diambil.

Isi demo (nama, tanggal, foto) identik untuk semua tema, jadi perbedaan yang terlihat murni
berasal dari kerangka — bukan dari datanya. Berkas hasilnya jangan disunting tangan;
jalankan ulang generatornya.

## Yang diubah saat templat masuk repo

- identitas merek `Kartu Digital` / `KartuDigital` → **AsProject** (termasuk
  `PRODID:-//AsProject//ID` di berkas `.ics`);
- nomor WhatsApp `62895333335333` → **6285196755675** (nomor yang dipakai seluruh situs);
- 16 hotlink `images.unsplash.com` → `foto-cover.jpg` lokal, jadi tidak ada lagi
  request ke server orang lain;
- sisa deploy Cloudflare dibuang: `rocket-loader.min.js`, tag `<foreignObject>`, dan
  tipe skrip yang diobfuskasi (`type="a1b2…-module"` → `type="module"`). Tanpa ini
  halaman hasil simpanan Cloudflare **tidak menjalankan apa pun** di GitHub Pages;
- `<title>React Artifact</title>` diganti judul yang benar.

Empat berkas React lama tetap memakai `https://cdn.tailwindcss.com` dan Google Fonts.
Demo `undangan-luxury-gold.html` untuk tema Luxury Gold tidak memakai React atau Tailwind; tampilannya dibuat ulang dengan HTML/CSS/JavaScript biasa, palet dan tipografi katalog, serta identitas AsProject.My.Id. QR RSVP-nya memakai `assets/qrcode.js` lokal. Tema Floral Rustic tetap menggunakan demo `undangan-wedding-gold.html`.

## Pakai untuk klien

Salin satu berkas, lalu cari dan ganti string nama/tempat/tanggal di dalamnya (berkas
statis punya komentar "Cara ubah isi" di bagian atas). Ganti `foto-cover.jpg` dengan foto
klien — nama berkas ditahan supaya tidak perlu menyunting HTML-nya.

`undangan-luxury-gold.html` punya panel **Personalisasi** untuk pratinjau langsung; nilai
awal yang akan disalin ada di `DEFAULT_INVITATION` pada skrip bagian bawah. Pastikan
`assets/qrcode.js` ikut disalin bersama halaman. Foto cover dan galeri demo memakai gambar
lokal di `assets/demo/wedding/` serta `katalog-demo/foto-cover.jpg`; sertakan gambar-gambar
itu atau ganti URL-nya saat menyalin halaman. RSVP contoh disimpan di `localStorage`
browser, bukan dikirim ke server. Untuk produksi, sambungkan formulir ke penyimpanan RSVP
sebelum mengirimkan tautan kepada tamu.
