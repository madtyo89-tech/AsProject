# Spesifikasi — Kantor AI (Dasbor Kendali) AsProject

Status: **fase inputan** (belum ada kode yang ditulis).
Tanggal: 2026-10-18 · Repo: `madtyo89-tech/AsProject` · Cabang: `arena/f254ae73-asproject`

---

## 1. Ringkasan

**Kantor AI** = satu halaman kendali privat untuk pemilik AsProject, tempat seluruh
operasi harian terkumpul: WhatsApp, Studio, Publish, Undangan Master, desain template,
marketing, dan akuntansi — ditambah satu asisten AI yang membantu mengoperasikan
semua itu.

Premis: hari ini pemilik bekerja di dalam `studio.html` (terkunci sandi), menerbitkan manual,
membagikan link WA satu per satu, mengubah harga katalog di tab yang sama, dan **tidak punya
catatan keuangan sama sekali**. Kantor AI tidak menggantikan Studio/Master — ia jadi
lapisan kendali di atasnya.

Target pengguna: **1 orang** (pemilik), dipakai di HP maupun laptop, sendiri — bukan
produk multi-tenant.

---

## 2. Batasan nyata repo (hasil verifikasi, bukan asumsi)

Hal-hal ini yang menentukan arsitektur. Semua sudah dicek di kode.

| # | Fakta | Konsekuensi untuk Kantor AI |
|---|---|---|
| B1 | Situs **100% statis** di GitHub Pages (`asproject.my.id`), tanpa build step. Tiap halaman = 1 file HTML mandiri + aset di `assets/` | Halaman baru harus satu file HTML (nanti 1–2 file JS di `assets/`), tanpa webpack/vite/npm runtime |
| B2 | Halaman di root = `index, studio, master, scan, checkin, undangan, 404, laporan-audit` (+18 di `demo/`, +10 di `katalog-demo/`) → **36 file HTML** | Penempatan di **root** = semua gerbang otomatis ikut pemeriksaan. Di subfolder = halaman justru lepas dari radar cek |
| B3 | `tools/cek-kesehatan.py` = **376 ok / 0 masalah** saat ini; menguji link lokal, `http://`, `localhost`, `node --check` per blok `<script>`, duplikat `id`, kata terlarang, urutan `TPL` studio↔undangan, blok pesan WA identik di 3 file, robots/sitemap, manifest PWA, kontras+landmark | Halaman baru **wajib** lolos; daftar `HALAMAN` dan daftar "halaman privat" di cek itu harus diperbarui |
| B4 | `data jsonb` pada `invitation_drafts` **bisa dibaca anon** (policy `public can read drafts`), dan policy `public can update drafts` ada di `supabase-schema.sql` | `masterKey` & snapshot bisa dibaca publik. **Jangan pernah** menaruh data keuangan/piutang di tabel yang bisa dibaca anon |
| B5 | Tabel yang ada: `invitation_drafts`, `rsvp`, `checkin`, `rate_limit` + fungsi `batas_laju()` (rate limit per IP) | Ada pola "SQL-only" di repo: policy idempoten + `security definer` + `set search_path` — bisa dipakai ulang untuk gerbang data sensitif |
| B6 | Draft Studio disimpan di `localStorage` key **`asproject_studio_v3`** (ori sama) + musik di IndexedDB `asproject-musik` | Halaman lain di origin yang sama **bisa membaca** draft & status publish → dasbor bisa menampilkan status tanpa kerja server |
| B7 | Pesan WA punya blok wajib-identik: `WA_TEMPLATE_DEFAULT`, `WA_SAPA_UMUM`, `WA_ACARA`, `isiPesanWa()`, `waUrl()` — di `studio.html`, `master.html`, `undangan.html` | Modul WA dasbor harus memakai **teks yang sama persis**; blok identik ditambahkan ke daftar pembanding di `cek-kesehatan.py` |
| B8 | `TPL` (24 tema) harus **urutan identik** di `studio.html` & `undangan.html` (kolom `theme` = index), dan `index.html` punya `Pn` (18 tema publik) yang harus cocok dengan subset non-Studio-only + teks "18 template" + rule CSS gradient | Menambah tema *built-in* = edit 3 file + teks + CSS. Harus lewat **skrip**, bukan ketik manual |
| B9 | Tema **kustom** sudah punya jalur end-to-end: `studio.html` → `state.tplCustom` → snapshot `data.tplCustom` → `undangan.html` (`customThemeFromDraft`) | Desain tema baru bisa jalan **tanpa** menyentuh `TPL` — aman, kompatibel |
| B10 | Harga publik ada di 2 tempat: `state.katalog` (localStorage perangkat) **dan** `Pn` di `index.html` (React, statis) | Yang diedit di Studio **tidak** mengubah katalog publik. Marketing butuh jalur tulis ke server |
| B11 | Gate CI: `cek-kesehatan.py` + **28** `tools/test-*.cjs` offline + job browser (axe-core, manifest, tooltip) | File baru memicu CI otomatis (paths `**.html`, `assets/**`, `tools/**`, `*.sql`) — harus hijau |
| B12 | `master.html` butuh `?slug=&k=masterKey`; `scan.html` butuh `?s=&k=`; `?demo=1` tersedia untuk uji | Dasbor bisa construct URL master/scan sendiri dari snapshot |
| B13 | Android: `android/` membungkus `studio.html` (WebView) | Kantor AI **tidak** masuk APK (bukan kebutuhan); cukup versi web |
| B14 | Halaman privat saat ini: `master.html`, `scan.html`, `checkin.html` (+`studio.html` ber-sandi) → `robots.txt` `Disallow`, tidak masuk `sitemap.xml` | Kantor AI ikut pola ini: privat, `Disallow`, tidak ada di sitemap |

**Catatan penting (B4) — perlu diverifikasi di Supabase Dashboard:** `supabase-schema.sql`
membuat policy `public can update drafts` (`using (true) with check (true)`) untuk role
`anon`. Bila policy itu memang aktif di proyek produksi, siapa pun yang tahu `slug` bisa
mengubah baris undangan (nama/tanggal/rekening). `tools/rsvp.sql` justru menyebutnya
"opsional" dan meng-comment-nya — jadi dua berkas ini tidak sinkron. **Ini prioritas
tertinggi sebelum data keuangan masuk server.**

---

## 3. Arsitektur

### 3.1 Peta berkas (target)

```
kantor.html                 # halaman kendali (root → ikut semua gerbang otomatis)
assets/kantor-core.js       # data layer: Supabase, IndexedDB terenkripsi, RPC, AI
assets/kantor-modul.js      # isi 8 modul (WA, Studio, Publish, Master, Template, Marketing, Accounting, Assistant)
tools/kantor.sql            # RPC gerbang data sensitif (security definer + rate limit)
tools/test-kantor-*.cjs     # uji regresi baru (payload publish, WA, harga, escrow)
```

Kenapa root: `cek_kerapian_halaman` (favicon, `lang="id"`, rujukan lokal) dan
`test-manifest-pwa` (`rel="manifest"`) hanya menyisir root + `demo/` + `katalog-demo/`.
Halaman di root otomatis **terjaga**; di folder baru ia justru lepas dari-radius cek.

### 3.2 Lapisan data

| Lapisan | Isi | Penyimpanan | Kenapa |
|---|---|---|---|
| **L1 — lokal terenkripsi** | Pesanan, pemasukan, biaya, prospek, catatan, pengaturan | IndexedDB `kantor-db`, AES-GCM, kunci = PBKDF2(passphrase) | Data paling sensitif. Tidak pernah menyentuh server tanpa pemilik menekan "Sinkronkan" |
| **L2 — Supabase publik (baca saja dari dasbor)** | Undangan published, RSVP, check-in | `invitation_drafts`, `rsvp`, `checkin` | Sudah ada, policy sudah ada, tidak perlu schema baru |
| **L3 — Supabase tulis lewat RPC** | Leads, publish log, katalog harga publik | tabel baru + fungsi `security definer` | Butuh "tulis tapi tidak bisa dibaca sembarang orang" → dicapai lewat RPC + secret + rate limit |
| **L4 — AI** | Kunci model (opsional), riwayat obrolan | `localStorage` (BYOK) atau secret server (nanti) | Lihat §5 M8 |

> Penamaan tabel L3: `kantor_lead`, `kantor_publish_log`, `kantor_katalog`.
> Semuanya *prefix* `kantor_` supaya jelas ini area baru, tidak bercampur dengan data tamu.

### 3.3 Gerbang akses (3 lapis)

1. **Lockscreen** — frasa sandi, **tidak** seperti `studio.html` yang menyimpan hash SHA-256
   di dalam source (itu bisa di-brute-force offline karena hash-nya publik). Di sini sandi
   di-derive PBKDF2 (≥200k iterasi, salt per instalasi) → kunci AES. localStorage hanya
   menyimpan salt + verifier, tidak pernah sandi.
2. **Passphrase** untuk enkripsi L1 (bisa sama dengan sandi unlock, atau dipisah).
3. **Secret RPC** untuk operasi tulis ke L3 — disimpan terenkripsi di IndexedDB, dikirim
   sebagai argumen fungsi; fungsi yang memeriksa hash-nya (via `crypt()`) dan mengunci
   attempt lewat `batas_laju()` yang sudah ada.

Alasannya: dasbor memegang data financial. Satu kunci yang tertinggal di source = kebocoran
data terbaik, dan `B4` membuktikan tabel publik tidak boleh jadi rumah data sensitif.

### 3.4 Gaya & aksesibilitas

Ikut token warna & komponen `studio.html` (dark + emas, kartu, `sm-btn`, toast) supaya
terasa satu produk. Wajib: satu `<main>`, satu `<h1>`, landmark lengkap, kontras AA,
`rel="manifest"`, favicon, `lang="id"`, target sentuh ≥44px — agar lolos `axe-core` +
`audit-landmark` yang menyisir semua halaman root.

---

## 4. Model data (desain awal)

### 4.1 L3 — Supabase (SQL idempoten, gaya `tools/rsvp.sql`)

```sql
-- Prospek / lead marketing
create table if not exists public.kantor_lead (
  id bigint generated always as identity primary key,
  nama text not null,
  kontak text not null default '',      -- WA / IG
  acara text not null default '',
  pesan text not null default '',
  status text not null default 'baru',  -- baru | Necakep | jadi | batal
  created_at timestamptz not null default now()
);
-- TIDAK ada policy select untuk anon → hanya bisa dibaca lewat RPC.
create policy "kantor_lead_anon_insert" on public.kantor_lead
  for insert to anon with check (true);

-- Log publish (audit trail + analitik)
create table if not exists public.kantor_publish_log (
  id bigint generated always as identity primary key,
  slug text not null,
  tema text not null default '',
  acara text not null default '',
  bayar text not null default '',        -- "Basic|Premium|Exclusive" (tier)
  amount integer not null default 0,
  created_at timestamptz not null default now()
);

-- Katalog publik (harga/promo yang dibaca index.html saat runtime)
create table if not exists public.kantor_katalog (
  id text primary key,                   -- id tema
  nama text not null default '',
  ev text not null default 'all',
  harga_normal integer not null default 0,
  harga_promo integer not null default 0,
  promo_aktif boolean not null default false,
  badge text not null default '',
  terjual integer not null default 0,
  updated_at timestamptz not null default now()
);
```

> Catatan: `kantor_lead` sengaja **tanpa** policy `select` untuk anon. Tulis boleh (form
> publik), baca hanya lewat RPC ber-secret. `kantor_publish_log` & `kantor_katalog` sama hal:
> select hanya lewat RPC.

### 4.2 RPC gerbang (gaya `batas_laju`)

```sql
create or replace function public.kantor_api(p_secret text, p_aksi text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  perform public.batas_laju('kantor:' || coalesce(p_secret,'') , 20, 60);
  select true into v_ok from public.kantor_secret
   where secret_hash = crypt(coalesce(p_secret,''), secret_hash) limit 1;
  if not coalesce(v_ok,false) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  -- dispatch p_aksi: 'lead_list' | 'lead_add' | 'log_publish'
  --                 | 'katalog_get' | 'katalog_set'
end;
$$;
```

`kantor_secret` (hash + `crypt`) diisi **di luar repo** (nilai rahasia tidak pernah masuk
Git). Digunakan dengan `revoke … from public; grant execute … to anon, authenticated;`
supaya tidak bisa dipanggil bebas.

### 4.3 L1 — lokal terenkripsi (IndexedDB `kantor-db`)

Store: `pesanan`, `pemasukan`, `biaya`, `prospek`, `catatan`, `pengaturan`, `ai_riwayat`.
`pesanan` (satu order = satu undangan berbayar):

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | dibuat lokal |
| `namaTamu` | text | pemilik acara |
| `acara` | enum | pernikahan / khitanan / ultah / aqiqah |
| `slug` | text | nyambung ke undangan published (opsional) |
| `tier` | enum | Basic / Premium / Exclusive / custom |
| `temaId` | text | tema yang dipilih |
| `harga` | int | harga final setelah promo |
| `promo` | int | nominal diskon |
| `status` | enum | dp / lunas / batal |
| `dp` | int | uang DP yang sudah masuk |
| `tanggal` | date | tanggal acara |
| `jualAt` | date | tanggal transaksi |
| `metode` | text | transfer / QRIS / tunai |
| `catatan` | text | bebas |
| `biayaLain` | int | biaya tambahan (bisa di-refund) |

Semua terenkripsi AES-GCM per-record (IV acak per record), kunci diturunkan dari passphrase.

---

## 5. Modul (8)

### M1 — WhatsApp 📱
- **Sumber:** snapshot `data.guestsRaw` + `guestCodes` (L2) & daftar prospek (L1/L3).
- **Kemampuan:** pilih penerima (semua / belum RSVP / belum check-in / prospek), pilih
  template pesan, hasilkan **link `wa.me` per tamu** (WA personal) + teks pratinjau (WYSIWYG),
  tandai "sudah dikirim" (manual, dicatat lokal), salin semua, ekspor CSV.
- **WAJIB:** pakai `WA_TEMPLATE_DEFAULT` + `isiPesanWa()` yang **identik** dengan
  `studio/master/undangan` (B7) — salin blok verbatim, lalu tambahkan `kantor.html` ke
  perbandingan di `cek-kesehatan.py` §[25] dan `tools/test-pesan-wa.cjs`.
- **Biaya (terhubung Accounting):** setiap pesan blast = biaya API (kalau pakai WA
  Business API) → dicatat ke store `biaya` otomatis.
- **Batas:** tanpa WA Business API, pengiriman tetap manual (wa.me membuka chat, pemilik
  menekan kirim). Vendor pihak ketiga (Fonnte/WA Gateway) = **opsional, fase akhir**,
  token disimpan lokal/rahasia, biaya per pesan masuk akuntansi.

### M2 — Studio 🎛️
- **Sumber:** `localStorage asproject_studio_v3` (B6) + `invitation_drafts` (L2).
- **Tampilan:** status draft (published / draft / *dirty* — bandingkan `pubSig` vs
  `draftSig`), tema aktif, jumlah tamu, field yang belum lengkap (nama/tanggal/jam/
  lokasi/slug), tombol "Buka Studio" (dalam tab baru).
- **Daftar semua undangan** (dari `invitation_drafts`, ≤60 baris seperti `muatRiwayat`):
  slug, nama, tanggal, tema, terakhir publish → tombol: Buka Live, Buka Master, Scan,
  Publish Ulang, Salin Link.
- **Penting:** status dirty hanya bisa dihitung di perangkat yang menyimpan draft —
  dasbor menampilkan "belum bisa dinilai di perangkat lain" bila `localStorage` kosong.
  Ini batas nyata, ditampilkan jujur, bukan disamarkan.

### M3 — Publish 🚀
- **Riwayat publish** (L3 `kantor_publish_log` + L2 `updated_at`), filter per bulan/tema.
- **Health check pra-publish:** field wajib (nama/tanggal/jam/lokasi/slug) — aturan sama
  dengan `publish()` di `studio.html` (jangan dua kali sumber kebenaran; better: aturan
  diekstrak ke `assets/kantor-core.js` **dan** dipakai Studio lewat impor — tapi ini
  menyentuh `studio.html`, jadi **Fase 2** dengan uji regresi).
- **Aksi publish dari dasbor:** *fase 1* = tombol "Buka Studio & publish" (butuh
  dukungan `?tab=terbit` di `studio.html` — tambahan kecil, terisolasi, ada ujinya).
  *Fase 2* = ekstrak `barisUndangan()` ke modul bersama `assets/publish-core.js` sehingga
  dasbor bisa publish sendiri **dengan payload identik** (dibuktikan uji: payload dari
  state yang sama → JSON sama). Ini satu-satunya cara agar dasbor benar-benar "mengopalkan"
  publish, dan harus dilakukan dengan hati-hati karena `studio.html` = 285 KB.

### M4 — Undangan Master 🔑
- Dari snapshot: `masterKey` → bangun `master.html?slug=…&k=…`; `scan.html?s=…&k=…`.
- **Rekap:** RSVP (hadir/ragu/tidak) + check-in real-time (L2), jumlah tamu terdaftar.
- **Tamu belum merespons** → dipakai M1 untuk blast follow-up.
- Tombol: Buka Master / Salin Link Master / Kirim via WA (wa.me, sama seperti
  `masterShareLink()` di `studio.html`).
- **Peringatan:** tautan master = akses pengelolaan (bisa edit info bank di UI) →
  selalu ada konfirmasi sebelum dikirim, dan UI menandai "JANGAN bagikan ke tamu/grup".

### M5 — Desain Template Undangan 🖌️
- **Desainer baru** (tema kustom): pilih jenis acara, palet 3 warna + accent + ink, font
  (dari 17 `FONTS`), border, ornamen, pola, char/maskot, tier, harga, badge, deskripsi.
- **Validasi** memakai aturan yang sama dengan `normalizeTplCustom()` (`studio.html`) dan
  `customThemeFromDraft()` (`undangan.html`): id harus `^custom-[a-z0-9][a-z0-9-]{2,80}$`,
  warna `#RRGGBB`, font harus ada di `FONTS`, `pat` harus di whitelist, ≤80 template.
  → Tema yang dihasilkan **pasti bisa dipakai** di Studio & undangan live (B9).
- **Simpan:** (a) ke draft Studio (`state.tplCustom`) → bisa langsung dipakai; (b) ke
  arsip lokal; (c) **ekspor paket tema built-in** → skrip `tools/tambah-tema.cjs` yang
  menyisipkan baris ke `TPL` (`studio.html` **dan** `undangan.html`, urutan sama), ke `Pn`
  + rule CSS gradient + teks "N template" di `index.html` (B8) — deterministik, lalu
  `cek-kesehatan.py` memverifikasi.
- **Pratinjau:** iframe `undangan.html?preview=1` (payload sama seperti Studio) — reuse
  `barisUndangan()` agar pratinjau = hasil publish (prinsip yang sudah diuji di repo).

### M6 — Marketing 📣
- **Harga & promo** (pindah ke L3 `kantor_katalog`): normal/promo, diskon %, periode,
  badge. `index.html` membaca `kantor_katalog` saat load dengan **fallback ke `Pn`**
  (offline / CDN diblokir → situs tetap jalan). Ini yang menghapus duplikasi B10.
- **Prospek:** form publik kecil di `index.html` (konsultasi) → `kantor_lead` (write-only
  untuk publik) + daftar di dasbor; status baru → negosiasi → jadi → batal.
- **Konten:** templat caption IG/WA, jadwal promo, butuh **1 sumber harga** (L3) supaya
  tidak bentrok dengan tema/Studio.
- **Kampanye:** "blast promo ke 40 prospek" → daftar `wa.me` + daftar penerima; jika WA Business API
  aktif → kirim massal & catat biaya per pesan.

### M7 — Accounting 💰
- **Sumber:** L1 (transaksi manual) + `kantor_publish_log` (omzet yang terpaut publish).
- **Isi:** pesanan (DP/lunas/batal), pemasukan, biaya (WA API, domain, hosting ~0, ads,
  alat kerja), utang pelanggan, kode promo, laporan bulanan (omzet, laba kotor, sisa
  tagihan, template paling laris).
- **Rekonsiliasi:** tiap order publish pertama kali → otomatis mencatat omzet dengan
  tier & harga dari `kantor_katalog` (bukan ketik manual) → mengurangi salah input.
- **Ekspor:** CSV (untuk Excel/Google Sheets) + JSON terenkripsi (backup).
- **Aturan main:** angka financial **tidak pernah** ditulis ke tabel yang bisa dibaca anon
  (B4). Default: L1 (lokal). Sync ke server hanya kalau pemilik memintanya.

### M8 — Assistant 🤖 (bagian "AI")
- Perintah **deterministik** (tanpa API, selalu jalan offline): "siapkan blast WA untuk
  tamu yang belum RSVP", "ringkas order bulan ini", "tema mana paling laris", "cek draft
  yang belum publish".
- Perintah **AI** (opsional, butuh kunci): draf/rewrite pesan WA per jenis acara, ringkas
  RSVP, usulkan palet + nama + deskripsi tema (lalu tetap harus **divalidasi M5** sebelum
  disimpan), narasi laporan bulanan, caption marketing.
- **Aturan main (non-negotiable):**
  1. AI **tidak pernah** mengirim WA sendiri, dan tidak pernah menulis ke L3 tanpa
     konfirmasi manusia.
  2. Semua keluaran AI melewati validator yang sama dengan UI (panjang, karakter, warna,
     font, escaping `esc()`/`jsEsc()` yang sudah ada di repo).
  3. Kunci API: default **BYOK** di perangkat sendiri (tidak masuk repo, tidak masuk
     log). Kalau mau satu kunci untuk semua perangkat → butuh proxy server-side
     (Edge Function) — itu **Fase 4**, bukan sekarang.
  4. Semua aksi ber-destructive (publish, hapus, kirim) butuh confirm + bisa di-undo
     (undo stack lokal).

---

## 6. Peta jalan

| Fase | Isi | Keluaran | Perkiraan |
|---|---|---|---|
| **F0 — Inputan** (sekarang) | Dokumen ini + keputusan terbuka | Spec disetujui | — |
| **F1 — Kerangka & L1** | `kantor.html` + `assets/kantor-core.js`, lockscreen PBKDF2, IndexedDB terenkripsi, modul Accounting & Marketing (lokal) | Dasbor jalan: order, biaya, laporan, ekspor CSV | 2–3 hari |
| **F2 — Integrasi Studio & Publish** | Baca `asproject_studio_v3`, status publish, health check pra-publish, "Buka Studio & publish" (`?tab=terbit`), log publish, RPC `kantor_api` + `tools/kantor.sql` | Publish bisa dipantau & dicatat dari dasbor | 2–3 hari |
| **F3 — WA & Master** | Blok WA identik, blast builder (per tamu/batch), status kirim, rekap RSVP/check-in, construct link master/scan, blast follow-up | Alur "publish → bagikan → pantau" utuh dari dasbor | 2–3 hari |
| **F4 — Template & Marketing** | Desainer tema kustom, ekspor paket tema built-in (`tools/tambah-tema.cjs`), `index.html` baca `kantor_katalog` dengan fallback, form prospek | Harga publik ikut berubah dari dasbor; tema baru bisa dibuat | 3–4 hari |
| **F5 — Assistant & opsional** | Perintah deterministik, AI BYOK (draf pesan, ringkasan, usulan tema), WA Business API (opsional, berbayar) | Kantor benar-benar "AI" | 2–4 hari |

F1 bisa mulai **tanpa** menyentuh halaman yang sudah dipakai tamu — semua tambahan terkurung
ke file baru. F2–F4 menyentuh `studio.html`/`index.html` → wajib lewat uji regresi
(28 file uji + cek-kesehatan) dan rollback mudah (commit terpisah per fase).

---

## 7. Gerbang kualitas (wajib lolos sebelum merge)

**Tambahan `tools/cek-kesehatan.py`:**
1. `kantor.html` masuk daftar `HALAMAN` (link lokal, `http://`, `localhost`, `node --check`,
   duplikat `id`, kata terlarang).
2. `kantor.html` masuk daftar "halaman privat" → `robots.txt` `Disallow` + **tidak**
   ada di `sitemap.xml` (cek §[31] sudah punya daftar; tambahkan).
3. Blok pesan WA di `kantor.html` **identik** dengan studio/master/undangan (§[25]).
4. Invarian baru: `assets/kantor-core.js` & `kantor-modul.js` lolos `node --check`;
   fungsi `validTema()` di `kantor-core.js` dan `normalizeTplCustom()` di `studio.html`
   memberi hasil identik untuk input sama (uji perbandingan).
5. `tools/kantor.sql` lolos parser (kalau `pgsql-ast-parser` terpasang) & idempoten.

**Uji baru (`tools/test-kantor-*.cjs`, gaya jsdom yang sudah ada):**
- `test-kantor-wa.cjs` — pesan dasbor = pesan studio (persis, semua jenis acara, mode personal/single).
- `test-kantor-publish.cjs` — payload dasbor = `barisUndangan()` untuk state contoh.
- `test-kantor-tema.cjs` — tema hasil desainer valid → diterima `normalizeTplCustom()`.
- `test-kantor-harga.cjs` — harga di dasbor = harga di `index.html` (fallback & L3).
- `test-kantor-akuntansi.cjs` — enkripsi round-trip, ekspor CSV, hitung laba.

**Tak boleh regresi:** `python3 tools/cek-kesehatan.py` (target: 376 ok → 0 masalah),
seluruh `tools/test-*.cjs` hijau, `axe-core` tanpa pelanggaran di `kantor.html`.

---

## 8. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Policy `public can update drafts` aktif (B4)** | Undangan bisa diubah siapa pun; `masterKey` bocor | Verifikasi di Supabase Dashboard **sekarang**; cabut policy itu, andalkan `masterKey` + RPC untuk master. Ini prasyarat sebelum data bisnis masuk server |
| `masterKey` ada di snapshot yang bisa dibaca anon | Master dashboard bisa dibuka pihak lain | Hash `masterKey` di snapshot, simpan aslinya di RPC privat (perlu migrasi `undangan.html`/`master.html` — F2/F3) |
| Ekstraksi `barisUndangan()` keluar dari `studio.html` | Publish bisa berubah → undangan rusak | Uji payload-identik (`test-kantor-publish.cjs`) + commit terpisah + publish manual 1 undangan uji sebelum merge |
| `index.html` ambil harga dari server | Katalog kosong saat Supabase lambat | Fallback ke `Pn` (bawaan) + timeout 3 detik + cache lokal |
| Key AI bocor dari browser | Penyalahgunaan kuota | BYOK lokal, tidak pernah di-commit; ikon "kunci tersimpan di perangkat ini" |
| Portabilitas L1 (data lokal hilang) | Data keuangan hilang | Auto-backup JSON terenkripsi mingguan + ekspor CSV manual; backup opsional ke L3 (bucket privat) |
| Terlalu banyak bagian | Timing molor | F1–F5 terpisah; tiap fase boleh dilepas sendiri |

---

## 9. Keputusan terbuka (butuh jawaban sebelum F1)

1. **Tempat halaman** — `kantor.html` di root (ikut semua gerbang, dijaga otomatis oleh CI) — *usulan: ya*.
2. **Simpan akuntansi** — lokal terenkripsi saja (default, paling aman) atau sinkron ke
   server lewat RPC (multi-perangkat, tapi butuh pengelolaan secret & Infrastruktur tambahan)?
3. **AI** — BYOK di perangkat sendiri (tanpa infra) atau satu kunci di server (Edge
   Function, perlu setup Supabase CLI)?
4. **WhatsApp blast** — wa.me manual (gratis, andal) dulu, atau langsung WA Business API
   (berbayar per pesan, butuh akun Meta Business + template disetujui)?
5. **Pemakaian bersama** — hanya pemilik, atau nanti ada admin/karyawan (berdampak ke
   desain hak akses & RPC)?

---

## 10. Di luar lingkup (v1)

Aplikasi Android, mode offline penuh, multi-tenant, integrasi marketplace/produk
kirimi, payment gateway otomatis (QRIS/Midtrans), dan notifikasi email.
