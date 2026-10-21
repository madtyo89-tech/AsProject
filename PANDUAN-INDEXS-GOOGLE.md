# Panduan: membuat `asproject.my.id` muncul di Google

Panduan ini melengkapi bagian README **“Pemeriksaan ulang Google (2026-10-20)”**.
Semua langkah di sini dilakukan **di luar repo** — dikerjakan pemilik akun.

Perkiraan total waktu: **25–40 menit** (langkah 1–5 ±15 menit, backlink ±20 menit).
Yang tidak bisa dipercepat: Google tetap butuh **3 hari–3 minggu** untuk indeks pertama.

---

## Langkah 0 — Merge PR dulu (2 menit)

Perubahan SEO di PR **#32** belum terbit. Selama belum di-merge, sitemap yang
dilayani `asproject.my.id` **masih versi lama (25 URL, memuat `undangan.html` dan
`katalog-demo/index.html`)** — sudah dicek 2026-10-20.

Setelah PR di-merge ke `main`, tunggu GitHub Actions/Pages selesai (±2 menit),
lalu cek di browser:

```
https://asproject.my.id/sitemap.xml
```

Harus berisi **23 URL** dan **tidak ada** `undangan.html`. Kalau masih 25, tunggu
build Pages lagi (cek tab **Actions** di GitHub).

> Verifikasi Google Search Console tetap bisa dilakukan **sekarang**, tidak perlu
> menunggu merge — berkas verifikasi sudah hidup (dicek 2026-10-20).

---

## Langkah 1 — Verifikasi di Google Search Console (5 menit)

1. Buka **https://search.google.com/search-console** di Chrome (HP boleh; kalau
   tampilan sempit, aktifkan **⋮ → Desktop site**).
2. Login dengan akun Google yang mau dipakai permanen milik bisnis — **bukan akun
   pribadi yang bisa hilang**.
3. Klik **Add property / Tambahkan properti**. Muncul dua kotak:

   | Kotak | Isi | Catatan |
   | --- | --- | --- |
   | **Domain** (kiri) | `asproject.my.id` | butuh rekaman **DNS TXT** di Jagoan Hosting |
   | **URL prefix** (kanan) | `https://asproject.my.id/` | cukup tag HTML yang **sudah terpasang** |

4. **Pilih yang kanan dulu — URL prefix.** Tulis persis
   `https://asproject.my.id/` (pakai `https://` dan garis miring di akhir), lalu
   **Continue**.
5. Di halaman verifikasi, buka tab **HTML file** atau **HTML tag** — **keduanya
   sudah siap** di repo:
   - **HTML file** → Google memeriksa
     `https://asproject.my.id/googlefku5Lf9fobFfFrM0tS5D20DLpLYw_4Am-pps2HQ1pzw.html`
     (sudah dicek hidup & isinya cocok, 2026-10-20).
   - **HTML tag** → `<meta name="google-site-verification" ...>` sudah ada di
     `<head>` `index.html`.
6. Klik **Verify / Verifikasi**. Kalau muncul “Ownership verified” → selesai.

**Kenapa tidak langsung Domain property?** Domain property lebih bagus (mencakup
http, https, www, dan semua subdomain), tapi wajib DNS TXT. NS domain ini ada di
**Jagoan Hosting** (`ns1.jagoanhosting.com`, `ns2.jagoanhosting.com`), jadi TXT
ditambahkan di panel DNS Jagoan Hosting. Lakukan ini **nanti** setelah URL prefix
aktif — tidak perlu buru-buru.

### Kalau verifikasi gagal

| Pesan | Penyebab & solusi |
| --- | --- |
| “We couldn't find the verification file” | Properti ditulis salah (mis. `asproject.my.id/` tanpa `https://`, atau `www`). Hapus properti, tambah ulang persis `https://asproject.my.id/` |
| “The file is empty” | Cloudflare/cache perantara mengubah isi. Buka berkasnya di mode incognito; kalau benar, tunggu 5 menit lalu Verify lagi |
| “Verification failed” padahal tag ada | Tag HTML hanya dibaca dari **halaman utama**. Pastikan tag masih di `index.html` baris atas (`grep google-site-verification index.html`) |
| Sudah pernah daftar dengan akun lain | Cek email/akun Google lain dulu — properti yang sudah terverifikasi tidak bisa didaftarkan ulang sembarangan |

---

## Langkah 2 — Submit sitemap (2 menit)

1. Di sidebar kiri: **Indexing → Sitemaps**.
2. Kotak “Add a new sitemap” sudah berisi `https://asproject.my.id/`.
3. Ketik `sitemap.xml` → **Submit**.
4. Status harus **Success** dengan keterangan “Discovered URLs: 23”.

Kalau sebelumnya pernah submit sitemap lama, klik ulang nama `sitemap.xml` →
**Resubmit** supaya Google membaca komposisi baru (tanpa `undangan.html`).

---

## Langkah 3 — Minta Google mengindeks halaman penting (5 menit)

1. Kolom pencarian paling atas (**URL Inspection / Periksa URL**).
2. Tempel `https://asproject.my.id/` → Enter.
3. Klik **Request Indexing / Minta Pengindeksan**.
4. Ulangi untuk **3 halaman saja** (jangan semua):

```
https://asproject.my.id/demo/wedding-premium.html
https://asproject.my.id/katalog-demo/perbandingan-tema.html
https://asproject.my.id/demo/khitanan-premium.html
```

Kuota *Request Indexing* terbatas (umumnya sekitar **10 URL per hari** per
properti), jadi sisakan untuk halaman yang benar-benar dijual.

> **Jangan** minta indeks untuk `https://asproject.my.id/u/{slug}` — itu undangan
> privat milik tamu, dan sengaja tidak diindeks.

---

## Langkah 4 — Bing & mesin pencari AI (5 menit)

Bing dipakai **Copilot** dan **ChatGPT search**, jadi hasilnya terasa juga di AI.

1. Buka **https://www.bing.com/webmasters** → login.
2. Pilih **Import from Google Search Console** → izinkan → pilih properti
   `asproject.my.id`. Sitemap & verifikasi ikut terbawa otomatis.
3. Kalau import gagal: **Add site manually** → `https://asproject.my.id/` →
   verifikasi dengan meta tag (tambahkan ke `<head>`, minta bantuan agent kalau perlu).

---

## Langkah 5 — Backlink & profil bisnis (20 menit, ini yang paling berpengaruh)

Google butuh “bukti” bahwa situs ini nyata. Satu backlink dari profil bisnis
lebih bernilai daripada 20 kali Request Indexing.

### 5a. Instagram `@asproject.my.id`

- **Name** (bisa dicari di kolom search IG, ≤30 karakter):
  `AsProject | Undangan Digital`
- **Bio** (≤150 karakter, ini versi 140 karakter — sisa 10):

  ```
  Undangan digital pernikahan, khitanan, ultah & aqiqah ✨ 18 tema siap pakai, revisi unlimited, jadi 1 hari. Mulai Rp49rb. Konsultasi gratis 👇
  ```
- **Link**: `https://asproject.my.id` (pakai satu link saja, jangan Linktree).
- Setiap caption: sisipkan `asproject.my.id` sebagai teks **dan** tautan di bio.
  Jangan taruh URL mentah di caption jika tidak perlu — teks merek saja sudah cukup
  untuk sinyal.

### 5b. Google Business Profile (paling penting untuk pencarian lokal)

1. Buka **https://business.google.com** → **Add business**.
2. **Nama bisnis**: `AsProject` — **jangan** ditambah kata kunci seperti
   “AsProject Undangan Digital Bandung”, itu melanggar pedoman dan bisa
   ditangguhkan.
3. Kategori yang paling mendekati (pilih dari daftar yang muncul):
   - utama: **Graphic designer** atau **Website designer**
   - tambahan: **Invitation printing service**, **Marketing agency** (kalau ada)
4. **Alamat**: karena melayani online se-Indonesia, pilih **“I deliver goods and
   services to my customers”** lalu **sembunyikan alamat** (*hide address*), dan
   isi area layanan: Kota Bandung, Kab. Bandung, Cimahi, Bandung Barat (+kota
   sekitar bila mau).
5. **Website**: `https://asproject.my.id`
6. **Deskripsi** (≤750 karakter, ini 524 karakter — tanpa URL, sesuai aturan Google):

   ```
   AsProject adalah studio undangan digital online yang berbasis di Bandung dan melayani seluruh Indonesia. Kami membuat undangan pernikahan, khitanan, ulang tahun, dan aqiqah dalam bentuk satu tautan yang mudah dibagikan lewat WhatsApp, lengkap dengan RSVP dan buku tamu digital, hitung mundur hari-H, peta lokasi, galeri foto, musik latar, amplop digital, serta QR check-in tamu.

   Tersedia 18 tema siap pakai dengan revisi unlimited dan pengerjaan 1 hari. Konsultasi gratis setiap hari pukul 09.00-22.00 WIB melalui WhatsApp.
   ```
7. **Jam buka**: Senin–Minggu 09.00–22.00.
8. **Verifikasi**: Google biasanya meminta **video singkat** (rekam layar/meja
   kerja, tunjukkan alat kerja & akses ke akun bisnis). Siapkan HP dengan kamera;
   proses review bisa 1–7 hari.
9. Setelah hidup: upload **foto** (logo + 3–5 contoh undangan), lalu minta
   **review** dari klien lama — review adalah faktor peringkat lokal terkuat.

### 5c. WhatsApp Business

- **About** (≤139 karakter, ini 116):

  ```
  Undangan digital pernikahan, khitanan, ultah & aqiqah • 18 tema • jadi 1 hari • mulai Rp49rb • Bandung, se-Indonesia
  ```
- **Description** (≤512 karakter, ini 365):

  ```
  AsProject — studio undangan digital online di Bandung, melayani seluruh Indonesia. Undangan pernikahan, khitanan, ulang tahun, dan aqiqah dalam satu tautan: RSVP & buku tamu digital, hitung mundur, peta lokasi, galeri foto, musik latar, amplop digital, dan QR check-in tamu. 18 tema, revisi unlimited, jadi 1 hari, mulai Rp49.000. Konsultasi gratis 09.00-22.00 WIB.
  ```
- **Business website / catalog link**: `https://asproject.my.id`

### 5d. Backlink lain yang cepat & halal

| Tempat | Caranya | Nilai |
| --- | --- | --- |
| Status WhatsApp | Tempel `asproject.my.id` + 1 gambar contoh undangan | sedang |
| Bio TikTok/Facebook Page | Sama seperti IG | sedang |
| YouTube (kalau ada) | Deskripsi channel + “About” | sedang |
| README GitHub repo ini | Sudah memuat `asproject.my.id` (backlink dari github.com) | **tinggi** |
| Direktori UMKM Bandung / komunitas | Daftar gratis, isi URL | rendah–sedang |
| Marketplace undangan (Bridestory, Weddingku, dsb.) | Profil vendor → tautan situs | **tinggi** (relevan) |
| Blog/konten | Artikel “cara memilih undangan digital” di blog sendiri | sedang, jangka panjang |

---

## Langkah 6 — Pantau hasilnya (jangan tiap jam, bikin panik)

| Kapan | Yang dicek | Yang diharapkan |
| --- | --- | --- |
| H+1 | Search Console → **Sitemaps** | status Success, 23 URL |
| H+2–3 | Search Console → **Indexing → Pages** | beranda masuk “Indexed” atau “Discovered” |
| H+7 | Google: `site:asproject.my.id` | minimal 1 hasil (beranda) |
| H+7 | Google: `AsProject undangan digital` | mulai muncul di halaman 1–5 |
| H+14 | Search Console → **Performance** | ada impresi pertama |
| H+30 | Bing + GBP | muncul di Maps untuk “undangan digital Bandung” |

Catatan: `site:` bukan angka resmi, cuma indikasi. Laporan **Pages** di Search
Console yang jadi acuan sebenarnya.

---

## Yang jangan dilakukan

1. **Jangan beli backlink murah** (“100 backlink Rp50rb”) — pola ini paling cepat
   memicu penalti dan bisa membuat situs hilang dari indeks.
2. **Jangan submit semua URL sekaligus** ke Request Indexing — kuota habis dan
   tidak menambah kecepatan.
3. **Jangan daftarkan URL undangan tamu** (`/u/{slug}`) — itu privat dan sudah
   `noindex`.
4. **Jangan isi nama bisnis GBP dengan kata kunci** (“AsProject Undangan Digital
   Termurah Bandung”) — risiko suspend.
5. **Jangan ubah `sitemap.xml`/`canonical` manual tanpa menjalankan**
   `python3 tools/cek-kesehatan.py` — penjaga di bagian [31] akan menolak kalau
   canonical tidak cocok dengan URL sitemap.

---

## Kalau nanti mau memperluas

- **Domain property** (DNS TXT) di Jagoan Hosting → mencakup `www` & subdomain
  wildcard `{slug}.asproject.my.id` di Search Console.
- **Google Analytics 4 / Clarity** untuk melihat kata kunci yang mendatangkan
  pengunjung (Clarity gratis + heatmap).
- **Halaman artikel** di `asproject.my.id` (mis. `/artikel/`) untuk menangkap
  pencarian seperti “undangan digital Bandung” — saat ini semua halaman isinya
  katalog/demo, belum ada konten informasional.
- **Domain kembar** `aproject.my.id` (kurang huruf *s*) sudah terdaftar dan
  nameserver-nya mati. Pantau saja; kalau nanti dipakai pihak lain untuk mengaku
  AsProject, itu urusan merek/registrar, bukan repo.
