# Bot WhatsApp Studio AsProject (`wa-bot`)

Bot WhatsApp untuk studio undangan digital AsProject. Dibangun sebagai
**Supabase Edge Function** karena data studio (draft, RSVP) sudah ada di Supabase,
dan webhook WhatsApp butuh endpoint HTTPS publik (GitHub Pages hanya statis).

## Apa yang bisa dilakukan

**Untuk calon klien (siapa pun yang chat nomor bisnis):**

| Ketik | Hasil |
|---|---|
| `menu` / halo | daftar perintah |
| `harga` / `paket` | daftar harga tema per jenis acara (dibaca dari `tema.mjs`) |
| `demo` / `contoh` | link katalog demo |
| `pesan` | format data acara yang harus diisi |
| `admin` / `hubungi` | pesan diteruskan ke admin |
| data acara (`Jenis: …`, `Pria: …`, dst.) | disimpan sebagai **lead**, pelanggan dapat nomor pesanan, admin diberi tahu |

**Untuk admin studio** (nomor di `ADMIN_PHONES`):

| Perintah | Fungsi |
|---|---|
| `/daftar` | 10 undangan terbaru |
| `/buat` + format data | buat draft undangan langsung dari WhatsApp |
| `/leads` | calon klien yang belum diambil |
| `/ambil <id>` | ubah lead jadi draft (status lead jadi `diambil`) |
| `/rekap <slug>` | jumlah hadir / ragu / tidak hadir + ucapan terbaru (dari tabel `rsvp`) |
| `/link <slug>` | link tamu dan link master (privat) |

Format data (dipakai `/buat` dan oleh calon klien):

```
Jenis: pernikahan            (atau khitanan / ultah / aqiqah)
Pria: Budi                   (pernikahan)
Wanita: Sari                 (pernikahan)
Nama: Rafa                   (khitanan / ultah / aqiqah)
Tanggal: 20/12/2026          (atau 2026-12-20 / 20 Desember 2026)
Jam: 09:00
Lokasi: Gedung A, Bandung
Slug: budi-sari              (opsional; otomatis bila kosong)
```

### Dari WhatsApp ke Studio

1. Bot menyimpan draft ke tabel `invitation_drafts` dengan snapshot `data` yang
   berbentuk sama seperti `barisUndangan()` di `studio.html`.
2. Di Studio: **Folder / Arsip → Riwayat dari server → Buka** pada slug tersebut.
3. Lengkapi foto, galeri, musik, dan tema di Studio, lalu tekan **Publish**.

Draft dari bot memakai tema dasar *Ivory Klasik*. Field yang belum diisi bot
(foto, galeri, amplop, slide) dibiarkan ke nilai default Studio.

## Berkas

| Berkas | Isi |
|---|---|
| `index.ts` | entry point Deno (`Deno.serve`) |
| `handler.mjs` | webhook: verifikasi, tanda tangan HMAC, dedupe, Supabase REST, WhatsApp Cloud API |
| `logic.mjs` | parsing perintah & data, validasi, bentuk draft, teks balasan (tanpa I/O) |
| `tema.mjs` | salinan daftar tema publik + harga dari `const TPL` di `studio.html` |
| `../../../wa-bot-schema.sql` | tabel `wa_processed` dan `wa_leads` (RLS aktif, tanpa akses publik) |
| `../../config.toml` | `verify_jwt = false` untuk fungsi `wa-bot` |
| `../../../tools/test-wa-bot.mjs` | uji otomatis |

## Setup (sekali)

### 1. Akun WhatsApp Cloud API (Meta)

1. Buat app di [developers.facebook.com](https://developers.facebook.com) dengan produk **WhatsApp**.
2. Tambahkan nomor bisnis studio. Catat **Phone Number ID**.
3. Buat **System User** dengan token permanen (izin `whatsapp_business_messaging`
   dan `whatsapp_business_management`). Ini nilai `WA_TOKEN`.
4. Catat **App Secret** (App settings → Basic). Ini nilai `WA_APP_SECRET`.
5. Tentukan sendiri `WA_VERIFY_TOKEN` (string acak bebas, mis. hasil `openssl rand -hex 16`).

> Nomor yang belum pernah dipakai di Cloud API perlu didaftarkan & diverifikasi dulu.
> Nomor yang sudah dipakai WhatsApp Business App biasa harus dipindah. Ikuti panduan Meta.

### 2. Database Supabase

Buka **SQL Editor** project Supabase, lalu jalankan isi `wa-bot-schema.sql` (aman diulang).

### 3. Deploy Edge Function

Dari root repository (Supabase CLI sudah terpasang):

```bash
supabase login
supabase link --project-ref <REF_PROJECT_ANDA>   # ganti project_id di supabase/config.toml bila perlu
supabase functions deploy wa-bot --no-verify-jwt
```

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sudah otomatis tersedia untuk Edge Function.

### 4. Secrets

```bash
supabase secrets set \
  WA_VERIFY_TOKEN=<token-verifikasi-pilihan-anda> \
  WA_APP_SECRET=<app-secret> \
  WA_TOKEN=<system-user-token> \
  WA_PHONE_NUMBER_ID=<phone-number-id> \
  ADMIN_PHONES=0812xxxxxxx,0813xxxxxxx
```

Opsional: `PUBLIC_BASE` (default `https://asproject.my.id`), `WA_GRAPH_VERSION` (default `v21.0`).

> **Jangan** memasukkan `SUPABASE_SERVICE_ROLE_KEY` atau token WhatsApp ke berkas repo
> atau ke kode browser. Kunci service role melewati RLS.

### 5. Hubungkan webhook di Meta

1. WhatsApp → Configuration → Webhook → **Edit**.
2. Callback URL: `https://<REF_PROJECT_ANDA>.supabase.co/functions/v1/wa-bot`
3. Verify token: sama dengan `WA_VERIFY_TOKEN`.
4. Subscribe ke field **messages**.

### 6. Uji

- Kirim `menu` dari nomor lain → harus dibalas menu.
- Kirim `/daftar` dari nomor admin → harus dibalas daftar undangan.
- Kirim data acara lengkap dari nomor lain → lead tersimpan, admin mendapat notifikasi.

## Aturan WhatsApp yang perlu diketahui

- **Jendela 24 jam:** balasan bebas hanya bisa dikirim dalam 24 jam setelah pelanggan
  terakhir mengirim pesan. Karena itu admin sebaiknya selalu membalas lewat perintah bot
  (mis. `menu`) secara berkala. Notifikasi lead ke admin yang sudah lewat 24 jam akan
  ditolak Meta sampai admin mengirim pesan lagi.
  Untuk notifikasi terjadwal yang andal, perlu **template pesan** yang disetujui Meta
  (belum dibuat di versi ini).
- Bot hanya memproses **pesan teks**. Foto, stiker, dan tombol diabaikan.
- Setiap pesan diklaim di `wa_processed`, jadi kiriman ulang Meta tidak membuat lead ganda.

## Menjaga harga tetap sinkron

Daftar harga diambil dari `const TPL` di `studio.html`, disalin ke `tema.mjs`.
Setelah mengubah `TPL`, perbarui `tema.mjs`. Uji `node --test tools/test-wa-bot.mjs`
akan gagal bila keduanya tidak sama.

## Uji lokal

```bash
node --test tools/test-wa-bot.mjs      # 35 tes: logika, webhook, alur admin & pelanggan (fetch disimulasikan)
deno check supabase/functions/wa-bot/index.ts
```

Menjalankan fungsi secara lokal (butuh Deno ≥ 1.4x / Supabase CLI):

```bash
supabase functions serve wa-bot --no-verify-jwt --env-file supabase/functions/wa-bot/.env.local
```

Berkas `.env.local` berisi nilai rahasia; jangan di-commit.

## Keterbatasan yang diketahui

- Belum ada percakapan multi-langkah. Calon klien mengisi format sekali kirim.
- Pembayaran tidak diproses bot. Admin mengonfirmasi lead secara manual.
- Notifikasi di luar jendela 24 jam membutuhkan template (lihat di atas).
- Lead menyimpan nomor telepon (data pribadi). Akses hanya lewat service role.
  Tinjau kebijakan privasi sebelum membuka layanan ke publik.
