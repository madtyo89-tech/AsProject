# Laporan Simulasi Menyeluruh — AsProject

Ringkasan satu halaman: **semua uji digelembungkan, 6 bug nyata ditemukan & diperbaiki,
1 celah keamanan serius masih terbuka** (siapa pun bisa menulis setting katalog).

---

## 1. Apa yang dijalankan

| Simulasi | Cakupan | Hasil |
|---|---|---|
| 47 berkas `tools/test-*.cjs` | seluruh mesin undangan, studio, katalog, peta, QR, AI, migrasi SQL | 41 lulus penuh; 6 sisanya butuh browser (lihat §5) |
| `tools/cek-kesehatan.py` penuh (2×) | 579 pemeriksaan statis + 14 rangkaian uji | **0 masalah, exit 0** |
| **baru**: `tools/test-katalog-ketahanan.cjs` | 38 kasus data aneh + tabrakan dengan pencarian/urut katalog + halaman kategori | 38 lulus, 0 gagal |
| Uji langsung ke DB produksi | `catalog_settings` (1 baris), `invitation_drafts` (4 draf) | data lama utuh, setting contoh masih terbaca |
| Render katalog dengan data cloud asli | jsdom + `assets/katalog-live.js` | kartu 1 Luxury Gold · badge `BEST SELLER` · `Rp 39.000` (coret `Rp 49.000`) · 44 kartu |

Sebelum perbaikan, uji ketahanan yang baru ini **gagal 6 dari 25 kasus** — semuanya bug
yang tidak terlihat karena uji lama hanya memakai data "rapi" (semua field terisi).

---

## 2. Bug nyata yang ditemukan lalu diperbaiki

| # | Temuan | Akibatnya di pengunjung | Perbaikan |
|---|---|---|---|
| 1 | Promo tema dimatikan (`promoAktif:false`) tetap menampilkan **harga promo** | harga 39.000 tampil padahal admin mematikan promo | harga utama kembali ke `hargaNormal`, coretan promo dilepas |
| 2 | Tema hanya diatur **badge/deskripsi** (harga tidak dikirim) → `Number(undefined)` | harga kartu jadi **Rp 0**, halaman detail jadi **Rp NaN** | angka yang tidak ada tidak lagi menimpa harga bawaan |
| 3 | Hanya satu tema diberi `order: 0` | kartu itu **tidak naik**, dan tema tanpa setting melompat menimpanya | tema tanpa setting memakai urutan build (bukan 0) |
| 4 | Pengunjung memakai **urut/pencarian**, lalu kembali ke "Unggulan" | urutan dari cloud **hilang** (kembali ke urutan build) | urutan live disimpan sebagai `data-live-rank`, dihormati `katalog-v2.js` |
| 5 | Urut **harga termurah** | memakai harga build 49.000, bukan harga setting 39.000 | `data-price` ikut diperbarui |
| 6 | Hitungan "N tema ditampilkan" saat pencarian/filter | tema tersembunyi **ikut dihitung**; kalimatnya berubah jadi angka telanjang "44" | tema `.asp-live-hide` tidak dihitung, kalimat dipertahankan |
| 7 | Halaman kategori `undangan/<acara>/` | urutan/unggulan **tidak berlaku**, judul tetap "22 pilihan" walau 3 disembunyikan | grid & judul kategori ikut diperbarui |
| 8 | Promo **global** dimatikan (label studio: "menyembunyikan harga promo di kartu") | kartu tanpa setting **tetap** menampilkan promo | harga normal diambil dari angka coret bawaan (99.000), coretan dilepas |
| 9 | `updatedAt` di dalam JSON cloud | tertinggal satu kali simpan | cap waktu disamakan sebelum menulis |
| 10 | `data` tersimpan sebagai teks JSON (dobel-encode) | setting diabaikan tanpa pesan | teks JSON diurai dulu |
| 11 | `tools/test-ornamen.cjs` menunjuk `studio-template.html` | uji merah padahal fitur ada (label pindah ke `assets/studio-template.js`) | target uji dikoreksi → 74 lulus |
| 12 | `tools/test-nyawa.cjs` memakai tanggal mati `2026-11-02` | uji merah karena hitungan mundur dianggap "hari bahagia telah tiba" | tanggal dibuat dinamis (hari ini + 3) → 18 lulus |

Bukti sesudah perbaikan (semua diulang):

```
node tools/test-katalog-ketahanan.cjs   → 38 lulus, 0 gagal
node tools/test-katalog-live.cjs        → 21 lulus, 0 gagal
node tools/test-katalog-v2.cjs          → lulus (pencarian, filter, urut, favorit, empty state)
node tools/test-katalog-admin.cjs       → 23 lulus, 0 gagal
node tools/test-kartu-katalog.cjs       → 55 lulus, 0 gagal
```

---

## 3. Risiko yang BELUM ditutup (perlu keputusanmu)

### R1 — TINGGI: siapa pun bisa mengubah harga katalog
Tabel `catalog_settings` punya policy tulis untuk peran **anon**
(`public can write catalog settings`, `public can update catalog settings`), dan
**anon key-nya tertanam di `assets/katalog-live.js`** yang dimuat di 46 halaman publik.
Artinya siapa pun yang membuka "view source" bisa:

```bash
curl -X PATCH "https://aalrhvirqwjtbbxmteeg.supabase.co/rest/v1/catalog_settings?id=eq.default" \
  -H "apikey: <anon key dari halaman>" -H "Content-Type: application/json" \
  -d '{"data":{"themes":{}}}'   # harga & tampilan katalog berubah seketika
```

Bisa menyembunyikan semua tema, mengubah harga jadi Rp 1, atau menaruh badge apa pun.
PIN studio tidak menolong: gerbangnya ada di browser, dan penulis REST tidak melewatinya.
Anon key **bukan** rahasia (memang harus publik), jadi satu-satunya obat adalah
**berhenti mengizinkan tulis dari anon**.

Usulan (bisa saya kerjakan): fungsi Edge `katalog-simpan` dengan `service_role` +
verifikasi PIN di sisi server, lalu RLS `catalog_settings` hanya `select` untuk anon.
Perubahan tulis hanya lewat fungsi itu.

### R2 — SEDANG: endpoint AI bisa dipakai orang lain
`supabase/functions/ai-tema` dideploy `--no-verify-jwt` dengan CORS `*`, dan
pembatas laju hanya per-IP di memori (hilang setiap cold start). Kalau nanti dideploy,
siapa pun yang tahu URL-nya bisa menghabiskan kuota Gemini.
Usulan: kunci ke `Authorization` (anon JWT), tambah kuota harian di tabel, atau
`verify_jwt` + kirim apikey dari `tema-ai-proxy.js`.

### R3 — SEDANG: harga di HTML statis & JSON-LD tidak ikut setting
Pengunjung melihat Rp 39.000, tetapi `<script type="application/ld+json">` masih
`"price":"49000"` dan halaman `/harga/` masih 9× "Rp49.000". Google bisa menandai
**price mismatch** dan calon pembeli melihat dua harga berbeda.
Obatnya bukan JavaScript, tetapi: **Studio → Setting Katalog → Ekspor JSON**,
letakkan `katalog-setting.json` di akar repo, lalu
`node tools/bangun-halaman-publik.cjs`. Skrip live hanya jembatan sementara.

### R4 — SEDANG: simpan cloud tanpa cek versi
Dua admin (HP + laptop) bisa saling menimpa tanpa peringatan; yang terakhir menekan
"Simpan ke cloud" menang. Usulan: baca `updated_at` sebelum menulis dan tawarkan
"Muat ulang setting terbaru".

### R5 — RENDAH: "disembunyikan" bukan "tidak terbit"
Tema dengan `visible:false` hilang dari katalog, tetapi halaman detailnya tetap ada,
tetap 200, dan tetap ada di `sitemap.xml`. Kalau maksudnya benar-benar ditarik,
perlu `noindex`/410 saat build.

### R6 — RENDAH: satu permintaan Supabase per kunjungan + kedip harga
`katalog-live.js` mengambil setting setelah halaman tampil: harga bisa "berkedip"
(CLS) dan setiap kunjungan katalog/detail/harga menambah satu permintaan.
Usulan: cache 5 menit di `localStorage`, atau (lebih baik) tempel hasil build (R3).

### R7 — RENDAH: nama kelas badge di halaman detail
Halaman detail memakai `.asp-live-badge` (kelas yang dulu menyebabkan bug badge
menumpuk di kartu). Sekarang posisinya statis dan tidak bertumpuk, sudah diuji,
tetapi sebaiknya diseragamkan jadi `.ap-new-badge` saat halaman dibangun ulang.

---

## 4. Yang terbukti aman (bukan asumsi — ada ujinya)

- **XSS**: badge, deskripsi, `ribbon`, `ribbonSub`, `catatan` diisi
  `<img src=x onerror=…>` dan `<script>` → semuanya jadi teks biasa, tidak ada elemen
  baru, tidak ada skrip yang jalan (katalog **dan** halaman detail).
- **Data rusak dari cloud**: `themes` berupa `[]`, `"teks"`, `42`, `null`;
  `data: null`; harga berupa string `"49000"`; `order: "abc"` → halaman tetap 44 kartu,
  tanpa NaN, tanpa error konsol.
- **Jaringan mati / tabel belum ada** → katalog dibiarkan apa adanya.
- **Data lama Supabase utuh**: `invitation_drafts` 4 draf, `studio_cloud_drafts` 0,
  bucket `music` ada; hanya `catalog_settings` yang disentuh.
- **44 halaman template** semuanya punya `.ap-product-copy`, `.ap-lead`, `.ap-price`,
  dan `data-template-id` — jadi setting tidak "diam-diam tidak berlaku" di sebagian tema.
- Struktur & perilaku ini dikunci oleh `tools/test-katalog-ketahanan.cjs` (38 kasus)
  yang kini ikut dijalankan `cek-kesehatan.py`.

---

## 5. Yang tidak bisa dijalankan di sandbox ini

6 berkas uji butuh `playwright-core` + Chromium, yang tidak bisa diunduh di sandbox:

```
test-aksesibilitas.cjs   test-button-help.cjs      test-manifest-pwa.cjs
test-mobile-browser.cjs  test-public-layout-browser.cjs  test-template-custom-browser.cjs
```

Jalankan di mesinmu: `npm i playwright && npx playwright install chromium && node tools/test-<nama>.cjs`.
Dua uji lain (`test-scan-panitia`, `test-sql-rsvp`) sempat merah hanya karena modul
opsional (`jsqr`, `qrcode-generator`, `pgsql-ast-parser`) belum terpasang; setelah
dipasang keduanya lulus (67 dan 19 kasus).

---

## 6. Berkas yang berubah pada simulasi ini

```
assets/katalog-live.js          +penjaga harga, promo global, urutan, hitungan, kategori
assets/katalog-v2.js            +hormati urutan live (data-live-rank), +jangan hitung tema tersembunyi
assets/studio-katalog.js        updatedAt JSON = updatedAt baris
tools/test-katalog-ketahanan.cjs  BARU — 38 kasus ketahanan
tools/test-katalog-live.cjs     penyesuaian kalimat hitungan
tools/test-nyawa.cjs            tanggal fixture dinamis
tools/test-ornamen.cjs          target berkas studio-template dikoreksi
tools/cek-kesehatan.py          ikut menjalankan uji ketahanan
```

Perintah cepat:

```bash
npm i jsdom --no-save            # hanya untuk uji
node tools/test-katalog-ketahanan.cjs
python3 tools/cek-kesehatan.py
```

---

## 7. Yang saya sarankan sebagai langkah berikutnya

1. **R1 dulu** (paling mendesak): matikan tulis anon ke `catalog_settings`, pindahkan
   penulisan ke Edge Function. Saya bisa siapkan fungsi + migrasi RLS-nya sekarang.
2. **R3**: setelah setting final, ekspor JSON lalu bangun ulang halaman publik agar
   JSON-LD, `/harga/`, dan harga tampil sama — dan hilangkan kedip harga.
3. **R4**: tambahkan cek versi saat menyimpan (kecil, aman).
4. Jalankan 6 uji browser di mesinmu untuk menutup celah terakhir.
