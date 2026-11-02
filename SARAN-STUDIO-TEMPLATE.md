# Saran: Pisahkan "Studio Template" dari "Studio Isi Data" + Setting Katalog

Status: **usulan, belum ada kode yang diubah.** Tanggal: 2026-11-01.

---

## 1. Temuan di repo (ini yang bikin usulan berubah arah)

| Fakta | Bukti |
|---|---|
| Studio sekarang **satu berkas** 335 KB, isinya editor + desain + kustom template + katalog + arsip, di balik gerbang sandi admin | `studio.html` baris ±460 (`#lockscreen`, `asproject_studio_auth`) |
| Tema **bukan** dibuat di browser: 44 tema ditulis di `kerangka/`, lalu `node tools/bangun-tpl.cjs` menulis literal `const TPL=[…]` ke `studio.html` **dan** `undangan.html` | `kerangka/template.js`, `tools/bangun-tpl.cjs`, komentar "JANGAN EDIT MANUAL" di studio.html |
| Katalog publik (katalog, /template/<id>/, harga, sitemap) dibangkitkan dari `kerangka/template.js` + `kerangka/motor.js` | `tools/bangun-halaman-publik.cjs` baris 9–23 |
| Halaman **Katalog Template di studio** (harga normal/promo, badge, sembunyikan per tema/kategori, hapus, pulihkan) hanya disimpan ke `localStorage` (`asproject_studio_v3`) | `save()` studio.html:1486, `function katalog()` 3216–3258 |
| Fitur bikin template di studio = **Template kustom** (buat dari tema aktif, ganti nama, salin, hapus, "Tambahkan ke Katalog Publik") + tab **Desain & Cover** (warna aksen, font judul/isi, border, ornamen, pola, bandingkan tema) | `tabDesain()` 2690, `saveCustomTemplate/renameCustomTpl/duplicateCustomTpl/deleteCustomTpl`, `state.tplCustom` |
| Supabase baru punya `invitation_drafts` (+ `data jsonb`), `studio_cloud_drafts`, bucket `music`. **Belum ada tabel katalog.** | `supabase-schema.sql` |
| Fitur-fitur di atas dikunci tes: `cek_template_custom`, `cek_katalog_admin`, `test-template-custom.cjs`, `test-katalog-admin.cjs`, `test-studio-theme-compare.cjs` | `tools/cek-kesehatan.py` 929–1001 |
| `kerangka-demo.html` sudah ada: galeri 44 tema + panel info token (font/ornamen/pola/border) — **belum bisa diedit** | `kerangka-demo.html` |

**Dua kesimpulan:**

1. "Studio untuk bikin template" versi browser **tidak bisa benar-benar membuat template baru** selama template = kode di `kerangka/`. Yang realistis: studio itu jadi **peracik template** (token + shell + cover) yang mengeluarkan **file ekspor** (`JSON` + potongan `kerangka/template.js`), lalu tetap lewat `bangun-tpl.cjs`. Ini yang aman & tidak merusak 44 template yang ada.
2. "Katalog setting" di studio sekarang **ilusi**: diubah di HP, tapi katalog publik tidak ikut berubah. Jadi wajar terasa "mengganggu" — dua-duanya menumpuk di satu layar tanpa efek nyata.

---

## 2. Usulan: 3 pintu, bukan 1

```
/users/... satu situs statis
├── studio.html            → STUDIO UNDANGAN (isi data, 1 pesanan)
├── studio-template.html   → STUDIO TEMPLATE (racik tema, admin)     [BARU]
└── studio-katalog.html    → SETTING KATALOG (toko, admin)           [BARU]
```

| Halaman | Untuk | Isi | Menulis ke |
|---|---|---|---|
| `studio.html` **Studio Undangan** | operator/admin | pilih **1 dari 44 tema** (kartu read-only + thumbnail + tombol demo), lalu isi data: Info, Musik & Galeri, Amplop & Ucapan, Tamu & QR, Terbit & Bagikan, pratinjau, Publish | `invitation_drafts` (Supabase) seperti sekarang |
| `studio-template.html` **Studio Template** | admin | racik tema baru dari token: palet, font judul/isi, ornamen, pola, border, shell & susunan, cover, cara buka; live preview iframe `undangan.html?preview=1`; duplikat dari tema lama; bandingkan; checklist "siap katalog"; **Ekspor** JSON + potongan `kerangka/template.js` + entri TPL | draft template (localStorage/IndexedDB) **saja** — produksi tidak tersentuh |
| `studio-katalog.html` **Setting Katalog** | admin | visibilitas, urutan/featured, harga normal & promo, periode, badge, tag NEW, kategori, deskripsi pendek, thumbnail, preview kartu; simpan draft + **Ekspor `katalog-setting.json`** + riwayat/undo | `katalog-setting.json` di repo (lalu build) |

Menu di studio dirapikan jadi 2 grup:

```
Studio Undangan
  ├─ ✦ Editor Undangan
  └─ ⧉ Folder / Arsip
Desain & Toko   (khusus admin)
  ├─ 🎨 Studio Template      → studio-template.html
  └─ 🏷️ Setting Katalog      → studio-katalog.html
```

---

## 3. Dua cara implementasi

**Opsi A — pisah berkas (rekomendasi).**
Buat `assets/studio-core.js` berisi yang dipakai bersama (state, `TPL`, `barisUndangan()`, preview iframe, editor status, auth PIN, Supabase client). `studio.html` tinggal data + publish (±150 KB, jauh lebih ringan di HP). Halaman template & katalog memuat core yang sama.
+ Risiko tabrakan kecil, tiap halaman bisa dites sendiri, studio pelanggan jadi ringan.
− Kerja lebih besar (refactor 1× di awal), tes lama perlu disesuaikan sekali.

**Opsi B — satu berkas + mode.**
`studio.html?mode=template` dan `?mode=katalog`, menu Desain/Katalog hanya dirender kalau `OWNER_TOOLS` aktif.
+ Cepat (bisa 1 hari), tidak ada duplikasi kode.
− Studio tetap 335 KB+ (berat di HP), semua fitur tetap satu nyawa, rawan "kecelakaan" edit template saat sedang isi data.

Usul saya: **A**, tapi dikerjakan bertahap (Fase 0–1 di bawah) supaya bisa berhenti di tengah tanpa merusak apa pun.

---

## 4. Nasib fitur yang sekarang ada di studio

| Fitur | Keputusan | Catatan |
|---|---|---|
| Info Acara, Waktu & Lokasi | **tetap** | inti "isi data" |
| Slide & Animasi | tetap | data per undangan |
| Musik & Galeri | tetap | data per undangan |
| Amplop & Ucapan | tetap | data per undangan |
| Tamu & QR, Terbit & Bagikan | tetap | data per undangan |
| Folder / Arsip | tetap | |
| Foto cover, posisi & ukuran foto | **tetap** | ini data pemilik, bukan desain tema |
| 15 model cover & 9 cara buka | **tetap, tapi dijadikan "opsi bawaan tema + boleh ganti"** | draft lama menyimpan `coverLayout`/`buka`; jangan dihapus dari `undangan.html` |
| Warna aksen, font judul, font isi, border, ornamen, pola | **pindah** ke Studio Template | di draft lama tetap dibaca, hanya UI-nya hilang |
| Bandingkan dua tema | **pindah** ke Studio Template | alat desain, bukan alat isi data |
| Template kustom (buat/nama/salin/hapus) | **pindah** ke Studio Template | `state.tplCustom` **wajib tetap dibaca** `undangan.html` supaya undangan lama tidak rusak |
| "Tambahkan ke Katalog Publik" | **pindah** ke Setting Katalog | jadi langkah eksplisit, bukan centangan di tab desain |
| Katalog Template di studio (harga/promo/badge/hide/hapus) | **pindah** ke Setting Katalog | berhenti jadi localStorage liar |
| Tombol keluar, gerbang sandi, floating preview | tetap | |

Prinsipnya: **studio undangan tidak lagi bisa “menyentuh” identitas template.** Paling jauh hanya memilih.

---

## 5. Isi Setting Katalog yang saya sarankan

Per tema: `id`, nama tampil, kategori, **tampil/tidak**, urutan, **featured di beranda**, harga normal, harga promo, promo aktif + periode, badge (BEST SELLER/NEW TEMPLATE/…), deskripsi pendek (dipakai SEO), thumbnail, tautan demo.
Aksi: simpan draft, **pratinjau kartu katalog**, ekspor `katalog-setting.json`, impor, reset ke bawaan, riwayat/undo, dan indikator "belum dibangun ke situs" (lihat §6).

Yang **jangan** dijadikan setting bebas: urutan array `TPL` dan ID tema — karena kolom `theme` di Supabase adalah **index** ke array itu. Menambah/menggeser = undangan lama berubah tema.

---

## 6. Supaya setting katalog benar-benar mengubah situs

| Tingkat | Cara | Efek | Saran |
|---|---|---|---|
| 0 (sekarang) | localStorage di studio | **tidak ada** efek ke situs | ditinggalkan |
| **1 (rekomendasi)** | Setting Katalog → **Ekspor `katalog-setting.json`** → commit → `node tools/bangun-halaman-publik.cjs` → `python3 tools/bangun-sitemap.py` → `python3 tools/cek-kesehatan.py` | harga, promo, badge, visibilitas, urutan katalog **ikut berubah**, SEO & JSON-LD tetap benar | mulai dari sini |
| 2 (opsional) | simpan setting ke Supabase (`catalog_settings`, 1 baris JSON) + `assets/katalog-v2.js` membacanya saat load | badge/promo/hidden berubah tanpa build; **HTML statis & JSON-LD tidak sinkron** | hanya untuk hal non-SEO (badge, promo flag) |
| 3 | render katalog di server/edge | penuh realtime | di luar cakupan sekarang |

Jadi jawaban jujur untuk "caranya gimana?": **tetap harus ada 1 langkah build**, karena situsnya statis di GitHub Pages. Bedanya, sekarang langkah itu tidak ada sama sekali.

---

## 7. Risiko & pengaman

1. **Jangan edit literal `const TPL` manual** di `studio.html`/`undangan.html` — akan ditimpa `bangun-tpl.cjs`.
2. **Index tema stabil** — tema baru selalu di akhir; jangan ubah urutan/ID yang ada.
3. **Undangan lama** yang memakai `data.tplCustom`, `accent/font/border/ornamen` tetap harus dirender `undangan.html`. Yang dihapus hanya UI-nya, bukan pembacaan di renderer.
4. **Tes & health check** yang mengunci fitur ini harus diubah di fase yang sama: `tools/test-template-custom.cjs`, `tools/test-katalog-admin.cjs`, `tools/test-studio-theme-compare.cjs`, `tools/test-studio-demo.cjs`, `tools/cek-kesehatan.py` (`cek_template_custom`, `cek_katalog_admin`). Jangan dihapus diam-diam — ganti jadi tes untuk fitur barunya.
5. **Halaman admin baru**: PIN sama, `noindex,nofollow`, `Disallow` di `robots.txt`, jangan masuk `tools/public-page-urls.json`/sitemap.
6. **Rollback**: kerjakan per fase dengan commit terpisah, supaya kalau tidak cocok bisa kembali ke `studio.html` versi sekarang.
7. **Menambah tema baru** (dari Studio Template) tetap butuh 5 langkah: `kerangka/template.js` → `bangun-tpl.cjs` → `bangun-halaman-publik.cjs` → `bangun-sitemap.py` → `cek-kesehatan.py`. Ini akan saya jadikan dokumentasi singkat di halaman Studio Template supaya tidak lupa.

---

## 8. Rencana bertahap

| Fase | Isi | Perkiraan | Risiko |
|---|---|---|---|
| **0** | "Katalog Template" dipindah ke `studio-katalog.html` (PIN sama) + tombol Ekspor JSON. Studio lama kehilangan 1 menu. | ± 0,5 hari | sangat kecil |
| **1** | `studio-template.html` v1: daftar 44 tema + editor token + live preview + ekspor. Read-only terhadap produksi. | ± 1–2 hari | kecil |
| **2** | Studio Undangan diringkas: tab Desain dipangkas jadi "Cover & Foto", template kustom & bandingkan dipindah. Draft lama dimigrasi aman. | ± 1 hari | sedang (tes harus ikut) |
| **3** | Generator katalog membaca `katalog-setting.json`; badge/promo/visibilitas/urutan ikut; README + tes diperbarui. | ± 0,5 hari | kecil |
| **4** | (opsional) Supabase untuk setting + riwayat lintas perangkat. | ± 1 hari | kecil |

Fase 0 dan 1 saja sudah menjawab keluhan utama: **studio tidak lagi "bikin template" di tempat yang salah**, dan template yang ada tidak bisa kesenggol.

---

## 9. Yang perlu diputuskan dulu

1. "Studio yang ada dihilangkan" maksudnya: **dipindah** ke Studio Template, **dimatikan total**, atau **disembunyikan** pakai flag?
2. Studio Template jadi **halaman terpisah** (Opsi A) atau **mode di dalam studio.html** (Opsi B)?
3. Setting Katalog: cukup **ekspor JSON + build** (Tingkat 1), atau mau **Supabase biar langsung berubah** (Tingkat 2)?
4. Studio ini khusus **admin (PIN)**, atau nanti juga dipakai **pelanggan** (butuh login/tenant)?

---

## 10. Status implementasi (2026-11-02)

Keputusan yang diambil: **pindah** (bukan hapus total), **halaman terpisah**,
**Setting Katalog via Supabase**, **khusus admin (PIN)**.

Yang sudah dikerjakan:

| Usulan | Wujudnya |
|---|---|
| Studio Template terpisah | `studio-template.html` + `assets/studio-template.js` (racik palet/font/pola/border/cover, pratinjau renderer asli, bandingkan asal vs draf, ekspor token/entri `kerangka/`, kirim ke Setting Katalog) |
| Studio isi data diringkas | tab **Desain & Cover** → **Cover & Animasi**; warna aksen/font/border/ornamen/pola, bandingkan tema, dan pembuat template kustom keluar dari `studio.html` |
| Setting Katalog sendiri | `studio-katalog.html` + `assets/studio-katalog.js` (visibilitas, urutan, harga & promo, badge, deskripsi, ekspor/impor, reset) |
| Setting benar-benar berpengaruh | jalur cloud: tabel `catalog_settings` + `assets/katalog-live.js`; jalur build: `katalog-setting.json` dibaca `tools/bangun-halaman-publik.cjs` |
| Sumber data bersama | `assets/tpl-data.js` dibangkitkan `tools/bangun-tpl-data.cjs` (dipanggil dari `bangun-tpl.cjs`) |
| Keamanan | tiga halaman `noindex,nofollow`, `Disallow` di `robots.txt`, satu sandi studio |
| Kompatibilitas | `state.tplCustom` tetap dibaca saat publish & render, jadi undangan lama tidak rusak |
| Tes | `test-template-custom.cjs`, `test-katalog-admin.cjs`, `test-studio-theme-compare.cjs` diarahkan ke halaman baru; `test-simulasi`, `test-pola`, `test-ornamen`, `test-wedding-templates`, `test-cover-opsi` disesuaikan |

Belum dikerjakan (opsional, sesuai urutan di §8): Supabase untuk menyimpan **draf
tema** lintas perangkat (sekarang masih lokal), dan penghapusan otomatis halaman
detail tema yang dinonaktifkan saat build.
