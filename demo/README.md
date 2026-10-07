# Folder Demo Template

Folder ini berisi halaman **demo live** yang ditautkan tombol "Demo Live" pada modal
tema di katalog (`index.html`). Kalau file-nya belum ada, tombolnya tidak ditampilkan
(tidak akan pernah ada link rusak / 404).

| Nama file | Sumber | Ukuran | Status |
| --- | --- | --- | --- |
| `ice-blue.html` | **Bikinan ulang** — desain mengikuti template Drive `undangan_online_ice_blue.html` | 58 KB | ✅ aktif |
| `wedding-premium.html` | **Bikinan ulang** — 4 kulit Pernikahan, palet persis katalog | 58 KB | ✅ aktif |
| `khitanan-premium.html` | **Bikinan ulang** — kulit Islamic Elegant & Biru Ceria (mesin bersama) | kecil | ✅ aktif |
| `khitanan-basic.html` | **Bikinan ulang** — pengalaman paket Basic (sengaja sederhana) | kecil | ✅ aktif |
| `ultah-anak.html` | **Bikinan ulang** — 3 kulit: Kids Party, Sweet 17, Adult Elegant (menggantikan rencana PDF) | kecil | ✅ aktif |
| `aqiqah.html` | **Bikinan ulang** — 3 kulit: Baby Boy, Baby Girl, Islamic Neutral | kecil | ✅ aktif |

Kini **12/12 tema katalog punya tombol Demo Live** dengan kulitnya masing-masing
(parameter `?tema=`), jadi kartu "Luxury Gold" membuka demo emas gelap, kartu
"Baby Girl" membuka demo pink blush, dan seterusnya.

## Kenapa `ice-blue.html` bikinan ulang, bukan file asli Drive?

File Drive tidak bisa dipindahkan ke repo dari sini: sandbox tidak punya akses internet
keluar (kecuali GitHub), dan menarik 228 KB lewat percakapan butuh ±350 ribu token karena
connector Drive hanya bisa membaca dari awal file (tidak ada offset). Jadi halaman demo
ditulis ulang dari nol, **setia ke desain template aslinya**:

- palet biru es `#F8FCFF #FCFEFF #F0F9FF #E0F2FE #BAE6FD #7DD3FC #38BDF8 #0EA5E9 #0284C7`
- font **Playfair Display** (judul) + **Outfit** (isi)
- efek *glass* (`bg-white/60` + blur), garis `#BAE6FD`, motif butiran salju ❄
- data contoh asli: **Rahmad & Lina**, The Ice Blue Hall, Jakarta
- 3 varian: **Ice Blue Floral** (Best Seller), **Minimalist Frost** (Elegan), **Ocean Breeze** (Baru)
- harga `Rp 75rb` (coret `Rp 150rb`), "Sekali bayar, aktif selamanya • Garansi 7 hari"

Keuntungannya: tanpa React/Tailwind → **58 KB, ±4× lebih ringan**, tidak ada script bawaan
platform, sudah ber-brand **AsProject.My.Id**, "Dibuat dengan cinta di Bandung.", dan
semua tautan WhatsApp mengarah ke **085196755675**.

Kalau suatu saat file aslinya bisa masuk: timpa `demo/ice-blue.html`, lalu jalankan
`python3 tools/rapikan-demo-ice-blue.py --check` (md5 file asli:
`d7375a83f6074be49f5bdb6f11445881`).

## Isi demo `ice-blue.html`

- **Sampul** "Buka Undangan" + musik `music/backsound-asproject.mp3` (tombol putar/stop di bilah atas).
- **Custom nama tamu**: lewat URL `demo/ice-blue.html?to=Nama%20Tamu`, atau kotak
  "Tulis namamu, Kak" di sampul (nama ikut mengisi form RSVP).
- **Hitung mundur** — hari-H dihitung `hari ini + 47 hari` (sama seperti template aslinya),
  jadi angkanya tidak pernah nol dan tanggalnya selalu masuk akal.
- Seksi: mempelai · love story · acara + peta Google Maps · galeri · amplop digital
  (salin nomor ke papan klip) · RSVP & ucapan · varian & harga · penutup.
- **Ucapan tersimpan di localStorage** (`asproject_demo_iceblue_ucapan_v1`) + 3 contoh,
  ada rekap "hadir / berhalangan".
- **3 varian tema bisa diganti langsung di halaman** (klik kartu di seksi "Paket"):
  halaman berganti kulit saat itu juga, pilihan tersimpan, bisa dipaksa lewat
  `?varian=ocean-breeze`. Pesan WhatsApp-nya otomatis menyebut varian yang aktif.
- Galeri memakai **6 foto AI** (±1,4 MB) di folder `assets/demo/ice-blue/`, dimuat malas
  (`loading="lazy"`). Gradian biru es di belakang tile tetap jadi cadangan: kalau gambar
  gagal dimuat, `onerror` menyembunyikannya dan tile kembali tampil sebagai gradian.
  Di versi produksi tinggal ganti file-nya — kode HTML/CSS-nya tidak berubah.

## Peta tema → demo

Diatur di `index.html`, blok `/* ---- Konfigurasi ---- */` pada script `aspWaFab`.
Nilainya boleh string atau **array** — array dicoba berurutan dan dipakai file pertama
yang benar-benar ada (dicek pakai `HEAD`, hasilnya di-cache), jadi pemetaannya
menyesuaikan sendiri seiring file masuk.

- `DEMO_BY_NAME` — override per nama tema.
- `DEMO_BY_CATEGORY` — cadangan per kategori chip di kartu.

```
Pernikahan  → wedding-premium.html (?tema=... per tema) + ice-blue.html cadangan
Khitanan    → khitanan-premium.html (?tema=...), cadangan khitanan-basic.html
Ulang Tahun → ultah-anak.html (?tema=kids-party | sweet-17 | adult-elegant)
Aqiqah      → aqiqah.html (?tema=baby-boy | baby-girl | islamic-neutral)
```

### Mesin bersama (`_mesin.css` + `_mesin.js`)

Empat halaman kategori (khitanan ×2, ultah, aqiqah) tidak menulis ulang mesin:
mereka hanya menyediakan `window.ASP_DEMO = {...}` (palet tema, tokoh, acara,
galeri, ucapan contoh) lalu memuat `_mesin.js`. Menambah kulit baru cukup
menambah satu entri tema di config — tanpa CSS baru. Halaman wedding & ice-blue
tetap mandiri (standalone) karena sudah lebih dulu tayang.

## Tema di Studio

`studio.html` punya 3 tema hasil baca template **Ice Blue** (palet, font, dan nama
variannya diambil dari template aslinya):

| id | nama | palet | harga |
| --- | --- | --- | --- |
| `ice-blue` | Ice Blue Floral | `#F0F9FF → #BAE6FD → #7DD3FC`, aksen `#0EA5E9` | 75.000 |
| `minimalist-frost` | Minimalist Frost | `#FCFEFF → #F0F9FF → #E0F2FE`, aksen `#38BDF8` | 75.000 |
| `ocean-breeze` | Ocean Breeze | `#BAE6FD → #7DD3FC → #38BDF8`, aksen `#0284C7` | 79.000 |

Template baru di `TPL` otomatis ditambahkan ke `state.katalog` yang sudah tersimpan di
localStorage (lihat blok migrasi di `studio.html`), jadi tidak perlu reset data Studio.
Harga 3 varian di halaman demo juga mengikuti angka-angka ini.

## Kalau file asli dari Drive masuk

`tools/rapikan-demo-ice-blue.py` merapikan 5 hal pada template aslinya (mode `--check`
tersedia, setiap replacement memakai assert jumlah kemunculan):

1. Rebrand `KartuDigital.My.Id` → `AsProject.My.Id` (+ judul tab, copyright `© 2026`).
2. `Dibuat dengan cinta di Jakarta.` → `...di Bandung.` (baris venue acara dibiarkan).
3. Placeholder RSVP `Tulis namamu beb` → `Tulis namamu, Kak`.
4. Link mati `href="#"` → IG `@asproject.my.id`, `mailto:hello@asproject.my.id`, dan
   teks "Chat WhatsApp Support Premium" / "WhatsApp Support" → `wa.me/6285196755675`.
5. Buang `@font-face` "Optimistic" (404 di domain kita) + 3 script artifact `ecto:*`.

## Periksa kesehatan sebelum publish

Jalankan `python3 tools/cek-kesehatan.py` (exit code 1 kalau ada masalah).
Sepuluh pemeriksaan statis: tautan/aset lokal ada, tidak ada `http://` polos atau
`localhost`, sintaks semua `<script>` (`node --check`), id duplikat, selector blok
injeksi, konten terlarang ("beb", KartuDigital, script artifact), injeksi tidak
terduplikasi, peta demo vs file, simulasi tombol Demo Live per tema katalog, dan
audit anchor lintas halaman. Yang tetap butuh mata manusia: tampilan, animasi,
autoplay musik — sandbox pengerjaan tidak punya browser.
