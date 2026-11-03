# AI tema — jalur LLM (opsional, belum aktif)

Generator tema bawaan **berjalan lokal** di browser (`assets/tema-ai.js`): tanpa
kunci API, tanpa jaringan, hasil selalu lolos validasi id + kontras. Dokumen ini
hanya untuk **opsi B**: memakai LLM sungguhan lewat Supabase Edge Function.

## Kenapa harus lewat fungsi server

Situs ini statis (GitHub Pages). Kunci API yang ditaruh di `assets/` bisa dibaca
siapa pun lewat DevTools, jadi **jangan pernah** menaruh `OPENAI_API_KEY` /
`GEMINI_API_KEY` di repo. Fungsi Edge memegang kunci; browser hanya memanggil
endpoint-nya.

## 1. Deploy fungsi

Berkas siap pakai: `supabase/functions/ai-tema/index.ts`.

```bash
supabase functions deploy ai-tema --no-verify-jwt
supabase secrets set GEMINI_API_KEY=...        # atau GEMINI_API_KEY
```

`--no-verify-jwt` dipakai karena studio memakai PIN sendiri, bukan login
Supabase. Karena itu fungsi **wajib** punya pembatas laju + batas panjang prompt
(sudah ada di contoh: 20 permintaan/jam per IP, prompt ≤ 500 karakter).

## 2. Aktifkan di studio

Tambahkan satu baris di `<head>` `studio-template.html`:

```html
<meta name="asp-ai-endpoint" content="https://<proyek>.supabase.co/functions/v1/ai-tema">
```

…atau set `window.ASP_AI_ENDPOINT` sebelum `assets/tema-ai-proxy.js` dimuat.
Setelah itu tombol **Pakai LLM** muncul di panel ✨ AI. Tanpa baris ini, panel
tetap memakai mesin lokal (tidak ada permintaan jaringan sama sekali).

## 3. Kontrak

Permintaan:

```json
{ "prompt": "pernikahan adat Sunda, hijau zaitun", "ev": "pernikahan", "jumlah": 3, "keberanian": 1 }
```

Balasan: `{ "kandidat": [ token, … ] }` dengan bentuk token sama seperti output
lokal (`nama, ev, g, accent, ink, ft, orn, pat, border, deco, desc, cover, buka`).
Batasan di sisi server: hanya field itu, hex `#RRGGBB`, panjang teks dibatasi.
Sesampainya di browser, **setiap kandidat divalidasi ulang** oleh
`TEMA_AI.validasi()` — id font/pola/border/cover yang tidak terdaftar dibuang,
jadi server tidak bisa menyuntik CSS/JS atau id asing.

## 4. Biaya & risiko

- Pemakaian LLM berbayar per token; batasi `jumlah` ≤ 5 dan prompt ≤ 500 char.
- Tanpa login, endpoint bisa disalahgunakan orang lain → **wajib** rate limit
  (contoh memakai peta memori sederhana; untuk produksi pakai tabel/Upstash).
- Kalau fungsi mati, studio tetap jalan: pesan galat muncul dan pengguna bisa
  kembali ke generator lokal. Tidak ada ketergantungan wajib.

## 5. Status

Contoh fungsi ini **belum dideploy dan belum diuji** di proyek Supabase
sungguhan. Yang sudah diuji: generator lokal, validasi JSON tempelan, dan
pembungkusan `TEMA_AI_PROXY` (lihat `tools/test-tema-ai.cjs`).
