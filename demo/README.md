# Folder Demo Template

> [!NOTE]
> **Catatan 2026-10-21:** semua halaman di folder ini adalah demo dengan data contoh,
> bukan testimoni atau bukti bahwa acara pelanggan telah berlangsung. Tema Ice Blue
> sudah tidak ada di katalog produksi dan halamannya `noindex`. Tema katalog aktif
> membuka renderer produksi `undangan.html?demo=1&tpl=<id>`; harga dan syarat resmi ada
> di `/harga/`, bukan di paket contoh pada file demo lama.


Folder ini berisi beberapa demo kategori/legacy untuk melihat mesin undangan. Halaman
produk dan tombol demo untuk setiap tema aktif sekarang dibuat dari renderer produksi
serta ditautkan melalui `/template/{id}/` dan `/katalog/`. Semua demo mandiri diberi banner
"data contoh"; jangan memperlakukan teks/harga di demo sebagai penawaran layanan.

| Nama file | Sumber | Ukuran | Status |
| --- | --- | --- | --- |
| `ice-blue.html` | Demo arsip yang mengikuti referensi Ice Blue lama; bukan tema katalog aktif | 58 KB | noindex |
| `wedding-premium.html` | **Bikinan ulang** — demo 4 kulit Pernikahan dengan data contoh | 58 KB | demo |
| `khitanan-premium.html` | **Bikinan ulang** — kulit Islamic Elegant & Biru Ceria (mesin bersama) | kecil | ✅ aktif |
| `khitanan-basic.html` | **Bikinan ulang** — demo tampilan khitanan sederhana (bukan paket harga) | kecil | demo |
| `ultah-anak.html` | **Bikinan ulang** — 3 kulit: Kids Party, Sweet 17, Adult Elegant (menggantikan rencana PDF) | kecil | ✅ aktif |
| `aqiqah.html` | **Bikinan ulang** — 3 kulit: Baby Boy, Baby Girl, Islamic Neutral | kecil | ✅ aktif |

Katalog produksi berisi 34 tema publik. Tombol demo produk aktif memakai renderer
langsung (`undangan.html?demo=1&tpl=<id>`) supaya palet dan layout sama dengan yang
akan dilihat tamu; data pada `demo/*.html` hanya contoh standalone/legacy.

## Kenapa `ice-blue.html` bikinan ulang, bukan file asli Drive?

File Drive tidak bisa dipindahkan ke repo dari sini: sandbox tidak punya akses internet
keluar (kecuali GitHub), dan menarik 228 KB lewat percakapan butuh ±350 ribu token karena
connector Drive hanya bisa membaca dari awal file (tidak ada offset). Jadi halaman demo
ditulis ulang dari nol, **setia ke desain template aslinya**:

- palet biru es `#F8FCFF #FCFEFF #F0F9FF #E0F2FE #BAE6FD #7DD3FC #38BDF8 #0EA5E9 #0284C7`
- font **Playfair Display** (judul) + **Outfit** (isi)
- efek *glass* (`bg-white/60` + blur), garis `#BAE6FD`, motif butiran salju ❄
- data contoh asli: **Rahmad & Lina**, The Ice Blue Hall, Jakarta
- 3 varian visual untuk melihat palet dan tata letak (tidak ada label bestseller/ulasan).
- Harga, garansi, revisi, watermark, dan masa aktif pada demo arsip tidak berlaku sebagai penawaran; rujuk `/harga/` dan konfirmasi ke admin.

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

Untuk setiap nama template publik, `DEMO_BY_NAME` pada `index.html` menunjuk ke
renderer produk: `undangan.html?demo=1&tpl=<id>&buka=1`. Data yang tampil di sana
adalah contoh. Generator `tools/bangun-halaman-publik.cjs` menjaga rute ini sinkron
dengan `kerangka/template.js`. Halaman standalone di folder ini/katalog-demo hanya
arsip referensi, diberi banner demo, dan tidak menjadi bukti pelanggan atau sumber harga.

- `DEMO_BY_NAME` — renderer live per tema publik.
- `DEMO_BY_CATEGORY` — demo renderer cadangan per kategori.


### Mesin bersama (`_mesin.css` + `_mesin.js`)

Empat halaman kategori (khitanan ×2, ultah, aqiqah) tidak menulis ulang mesin:
mereka hanya menyediakan `window.ASP_DEMO = {...}` (palet tema, tokoh, acara,
galeri, ucapan contoh) lalu memuat `_mesin.js`. Menambah kulit baru cukup
menambah satu entri tema di config — tanpa CSS baru. Halaman wedding & ice-blue
tetap mandiri (standalone) karena sudah lebih dulu tayang.

## Status Ice Blue di Studio

Daftar `ice-blue`, `minimalist-frost`, dan `ocean-breeze` di bawah adalah catatan
historis dari eksperimen katalog lama; id tersebut tidak termasuk TPL produksi saat ini.
Harga 75.000/79.000 yang pernah dicantumkan di demo lama **bukan harga AsProject saat
ini**. Sumber harga template publik yang dipakai sekarang adalah `kerangka/template.js`;
data katalog saat ini mencatat Rp49.000 per tema. Ketentuan lain harus dikonfirmasi
sebelum transaksi.

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
