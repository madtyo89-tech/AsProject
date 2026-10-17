# Laporan Audit Menyeluruh — AsProject (2026-10-16)

Perintah pemeriksaan yang dijalankan (semua dari akar repo):

```bash
python3 tools/cek-kesehatan.py                     # 322 ok, 0 masalah
python3 tools/serve.py &                           # emulasi GitHub Pages :8080
for t in tools/test-*.cjs; do node "$t"; done       # 28 berkas uji, semuanya lulus
LD_LIBRARY_PATH=… node tools/test-mobile-browser.cjs         # Chromium sungguhan
LD_LIBRARY_PATH=… node tools/test-button-help.cjs
LD_LIBRARY_PATH=… node tools/test-template-custom-browser.cjs
```

Selain itu: pemeriksaan silang seluruh halaman di Chromium (30 halaman HTML), audit
aksesibilitas **axe-core**, penyisiran ulang rute `/u/{slug}` & `/checkin`, uji XSS pada
`?to=`, pemeriksaan jumlah `node --check` untuk setiap blok `<script>` inline, dan
pemeriksaan checksum APK di `android/releases/`.

---

## A. Bug yang ditemukan dan sudah diperbaiki

| # | Tingkat | Gejala (dari sisi pemilik/tamu) | Akar masalah | Perbaikan + uji |
| --- | --- | --- | --- | --- |
| 1 | Tinggi | Nama tamu ber-apostrof (mis. **O'Brien**) membuat tombol **QR**, **Copy**, dan **Download QR** di Studio tidak bereaksi. Pesan di konsol: *missing ) after argument list* | Nama disisipkan ke `onclick="fn('NAMA')"` hanya dengan `esc()`. `&#39;` dikembalikan menjadi apostrof oleh parser HTML → JavaScript rusak | `jsEsc()` baru (aman untuk atribut **dan** literal string) dipakai di semua tombol bernama/link/no-rek/slug pemilik; `tools/test-pesan-wa.cjs` + `cek-kesehatan.py [30]` |
| 2 | Tinggi | Di tab **Tamu & QR**, setelah mengetik daftar nama, kartu "Daftar Tamu & Link" tetap **0 tamu**, kartu QR & pratinjau pesan WA basi — nama baru muncul setelah pindah tab | `oninput` hanya menyimpan + memperbarui pratinjau iframe; daftar hanya digambar ulang oleh `render()` penuh | `refreshTamu()` + `jadwalRefreshTamu()` (jeda 320 ms) memperbarui jumlah, baris, kartu QR, label & pratinjau WA **tanpa** render penuh sehingga kursor pemilik tidak melompat |
| 3 | Sedang | Bantuan tombol (tahan jari / F1) kadang muncul, kadang tidak — uji browser jadi flaky | Handler gulir selalu `hide()`. Di Studio, `focus()`/F1 **memicu gulir** (browser menggulir tombol ke dalam layar) → tooltip yang baru dibuat langsung dihapus. Balapan waktu: kadang menang, kadang kalah | `place()` menghitung ulang posisi saat halaman bergulir; tooltip hanya ditutup bila tombolnya keluar layar; gulir *sebelum* tooltip muncul tetap membatalkan. Uji baru `tools/test-bantuan-tombol.cjs` (27 pemeriksaan) — diuji juga terhadap kode lama: 7 pemeriksaan gagal di sana |
| 4 | Sedang | `katalog-demo/undangan-luxury-seal.html` **layar kosong** bila `unpkg.com` diblokir/lambat (*React is not defined*) — di sekolah/kantor/gawai dengan pemblokir CDN, halaman ini gagal total | React & ReactDOM diambil dari CDN saat halaman dibuka | React 18.3.1 UMD (MIT, © Meta) disimpan di `assets/react.production.min.js` + `assets/react-dom.production.min.js`, plus pesan kegagalan yang jelas bila berkas hilang |
| 5 | Sedang | `tools/rsvp.sql` gagal dijalankan di SQL Editor Supabase | `create policy "rsvp_anon_read"` ditulis dua kali dan tanpa `drop policy if exists` | Ditulis ulang idempoten (`drop … if exists` lalu `create`) — aman dijalankan berulang; idem untuk `tools/checkin.sql` |
| 6 | Rendah | Tidak ada ikon tab di 24 halaman (master, semua `demo/`, semua `katalog-demo/`); 5 halaman ber-`lang="en"`; katalog utama tanpa keterangan/pratinjau tautan | Belum pernah ditambahkan | `assets/favicon.svg` (latar hitam + monogram emas, konsisten dengan ikon APK) + `assets/apple-touch-icon.png` dipasang di seluruh 30 halaman; `lang="id"`; `description`, `og:*`, `theme-color` |
| 7 | Rendah | Nama tamu berisi `<` (mis. `Budi <b>`) — `esc()` Studio tidak meng-escape `>` | `esc()` hanya menangani `&`, `<`, `"` | `>` ikut di-escape |

Peningkatan aksesibilitas yang menyertai: kolom **nama**, **pilihan kehadiran**, dan
**ucapan** di kartu RSVP undangan live kini punya `aria-label` (axe-core semula menandainya
`critical: select-name` dan `moderate: label`).

Bonus (bukan bug): undangan live sekarang mengisi **og:judul / og:keterangan / og:foto**
dari data undangan — dulu selalu teks bawaan. `og:image` hanya dipasang bila fotonya URL
publik; foto lokal pemilik (`data:`) diabaikan perayap. Katalog utama juga dapat
`description` + `og:*`.

## B. Diperiksa dan sudah benar (tidak perlu diubah)

- **Rute tautan**: `/u/{slug}`, `/u/{slug}/?to=…` (termasuk nilai ber-`&`), `/checkin`,
  `/u/{slug}/checkin`, dan base path `/AsProject/…` (github.io project page) semuanya
  mendarat di halaman yang tepat; halaman asing menampilkan 404 ramah.
- **XSS**: empat pola serangan lewat `?to=` (tag `<img onerror>`, penutup atribut,
  `</div><script>`, `<svg onload>`) tidak menghasilkan elemen/skrip baru di Chromium.
- **Kunci master**: `invitation_drafts` bisa dibaca siapa pun (memang publik), tetapi ubah
  data di Master hanya lewat `k=masterKey`; baris tamu di Master memakai indeks
  (`onSelectIdx(0)`) sehingga aman dari nama ber-apostrof/kutip.
- **Android**: checksum APK di `android/releases/` cocok dengan `SHA256SUMS.txt`, uji
  jembatan JS lulus (21 pemeriksaan), aturan izin kamera mikrofon ketat, dan workflow CI
  sudah memverifikasi isi + tanda tangan APK.
- **Berkas lokal**: seluruh rujukan `src`/`href` lokal di 30 halaman ada di disk; tidak ada
  skrip pihak ketiga lagi selain Supabase JS yang memang punya fallback REST.
- **`.nojekyll`** sudah ada — penting agar berkas `demo/_mesin.js` & `demo/_mesin.css`
  (awalan `_`) tetap disajikan GitHub Pages.

## C. Tindak lanjut (dikerjakan 2026-10-17)

Keenam temuan di bab ini sudah dikerjakan dan diukur ulang dengan alat yang sama.

| # | Temuan awal | Yang dikerjakan | Hasil ukur |
| --- | --- | --- | --- |
| 1 | Kontras warna: 8 temuan `index.html`, 12–16 `katalog-demo/*`, 3–4 `scan`/`checkin`, 4 undangan live | Warna digelapkan seminimal mungkin lewat blok `[aksesibilitas-c]`; `opacity:.8` pada sublabel tombol mode dinaikkan | **31 halaman: 0 temuan**; `master.html?demo=1` 62 → 0 |
| 2 | Landmark: bagian belum dibungkus `<main>`/`header` | `main` di 31 halaman, `aside` untuk tautan mengambang, `role="region"` untuk sampul & panel di demo wedding-gold | axe **region 450 → 0**, tanpa `<main>` **10 → 0**, tanpa `h1` **2 → 0** |
| 3 | Belum ada `robots.txt`/`sitemap.xml` | Keduanya dibuat; halaman internal (master, scan, checkin, android) ditutup, 25 URL publik didaftarkan | sitemap valid (25 URL), robots menunjuk `https://asproject.my.id/sitemap.xml` |
| 4 | Belum ada web app manifest | `manifest.webmanifest` + ikon 192/512/maskable dari `assets/favicon.svg`; tautan dipasang di 30 halaman | `test-manifest-pwa.cjs` lulus (nama, ikon, tautan) |
| 5 | `rsvp` & `checkin` tanpa pembatas laju | Tabel `rate_limit`, fungsi `batas_laju()`, trigger per IP dan per (slug, tamu) | `test-sql-rsvp.cjs` 19 lulus; RPC tak bisa diuji dari sandbox (tanpa jaringan) |
| 6 | Uji Chromium belum jalan di CI | Job `browser` di workflow: server `:8080` + 4 uji | lulus lokal; `test-aksesibilitas.cjs` 59 lulus / 0 gagal |

Rincian batas laju: RSVP 12/menit & 60/jam per IP, 30/jam per (slug, tamu);
check-in 30/menit & 200/jam per IP. Bila perlu dilonggarkan:
`drop trigger rsvp_batas_laju_trg on public.rsvp;` (idem check-in).
`checkin.sql` memakai `batas_laju()` dari `rsvp.sql`, jadi jalankan `rsvp.sql` dulu.

### Sisa temuan tingkat rendah (belum dikerjakan)

- `katalog-demo/undangan-wedding-gold.html`: 1 `label-content-name-mismatch` + 4 `label`
  (atribut label belum terhubung ke input).
- `index.html`: 25 `button-name` + 3 `link-name` (tombol/tautan ikon tanpa teks alternatif).
- `katalog-demo/perbandingan-tema.html`: `heading-order` (h3 muncul tanpa h2).

Ketiganya tidak menghalangi pemakaian; dicatat agar tidak hilang.

## D. Menjalankan ulang pemeriksaan ini

```bash
npm install --no-save --package-lock=false jsdom jsqr qrcode-generator pgsql-ast-parser
python3 tools/cek-kesehatan.py
node tools/test-sql-rsvp.cjs

# uji browser (butuh Chromium + server lokal)
npm install --no-save --package-lock=false playwright-core @sparticuz/chromium axe-core
python3 tools/serve.py 8080 &
node tools/test-aksesibilitas.cjs
node tools/test-manifest-pwa.cjs
```

Workflow `.github/workflows/cek-kesehatan.yml` menjalankan pemeriksa + seluruh uji offline
pada setiap push/PR, plus job **`browser`** berisi empat uji Chromium di atas.
`test-mobile-browser.cjs` tetap manual karena beberapa pemeriksaannya peka waktu animasi.
