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
