# Katalog Demo — templat jadi dari Google Drive

Folder ini berisi **templat undangan satu berkas** yang selama ini dibagikan lewat Google
Drive (koleksi "Katalog demo"). Sudah dibersihkan dari jejak deploy pihak ketiga dan
**di-rebrand jadi AsProject**. Isinya berdiri sendiri: tidak dibaca `studio.html` maupun
`undangan.html`, hanya dibuka lewat tautan *Demo Live* di katalog publik.

## Isi folder

| Berkas | Sumber di Drive | Dipakai oleh tema katalog |
|---|---|---|
| `undangan-sage.html` | *Sage Blossom* (statis) | Minimalist Sage |
| `undangan-demo.html` | *Emerald Gold* (statis) | Adat Jawa Elegan |
| `undangan-sky-blue.html` | *Ice Blue* (React) | Biru Ceria |
| `undangan-khitanan-basic.html` | *Khitanan Basic* (React) | demo cadang kategori Khitanan |
| `undangan-khitanan-premium.html` | *Khitanan Premium* (React) | Islamic Elegant |
| `undangan-wedding-gold.html` | *Premium Wedding* (React) | Luxury Gold, Floral Rustic |
| `index.html` | halaman pengantar Drive | daftar 12 tema + tautan ke demo di atas |
| `foto-cover.jpg`, `foto-rahma-cover.jpg` | foto contoh | latar cover halaman-halaman di atas |

Tema ulang tahun (Kids Party, Sweet 17, Adult Elegant) dan seluruh tema aqiqah **belum**
punya berkas demo sendiri — tidak ada tombol *Demo Live* untuk tema itu, sesuai cara
`index.html` menyembunyikan tombol kalau berkasnya tidak ada.

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

Yang sengaja dibiarkan: `https://cdn.tailwindcss.com` dan Google Fonts — empat berkas
React memang butuh Tailwind runtime. Keduanya HTTPS; kalau mau lepas total dari CDN,
bundelnya harus dibangun ulang (di luar lingkup folder ini).

## Pakai untuk klien

Salin satu berkas, lalu cari dan ganti string nama/tempat/tanggal di dalamnya (berkas
statis punya komentar "Cara ubah isi" di bagian atas). Ganti `foto-cover.jpg` dengan foto
klien — nama berkas ditahan supaya tidak perlu menyunting HTML-nya.
