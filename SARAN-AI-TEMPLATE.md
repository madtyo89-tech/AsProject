# SARAN — "AI" pembuat template baru (Studio Template)

Status: **usulan, belum ada kode.** Ditulis 2026-11-03.
Konteks: Anda minta "tambahkan AI untuk membuat template baru". Sesuai
kesepakatan sebelumnya, saya beri saran dulu sebelum menulis kode.

---

## 1. Posisi fitur (agar tidak bentrok dengan keputusan lama)

Keputusan yang sudah Anda setujui: **studio isi data tidak membuat template**,
dan pembuatan template pindah ke `studio-template.html`. Maka AI ini **hanya
hidup di Studio Template** dan hasilnya selalu **draf**, bukan template
produksi:

```
prompt  →  AI  →  1–3 kandidat token  →  draf (custom-*)  →  pratinjau renderer asli
                                              ↓
                             ekspor kerangka/token-tema.js + entri template.js
                                              ↓
                          node tools/bangun-tpl.cjs  →  jadi tema ke-45, 46, …
```

Promosi ke produksi tetap lewat build, jadi tema baru **tidak** bisa muncul
di tengah katalog tanpa `TPL` ikut dibangun ulang (urutan indeks `theme`
undangan lama tidak boleh bergeser).

## 2. Tiga arti "AI" yang mungkin — pilih satu

| | Mesin | Butuh apa | Kelebihan | Kekurangan |
|---|---|---|---|---|
| **A** | **Generator lokal** (heuristik + kosakata tema) | tidak ada (offline) | gratis, tanpa kunci, jalan di GitHub Pages, hasil selalu sah & konsisten, bisa diuji otomatis | "AI" berbasis aturan, bukan LLM; tidak bisa menulis puisi/deskripsi bebas |
| **B** | **LLM sungguhan** (Gemini/OpenAI) | API key + proxy | deskripsi & nama tema lebih kreatif, prompt bebas | situs statis tidak punya backend → key harus di **Supabase Edge Function** (deploy, kuota, biaya, risiko penyalahgunaan) |
| **C** | **Tempel JSON dari LLM mana pun** | tidak ada (manual) | memakai LLM apa pun gratis (ChatGPT/Gemini), tidak ada key di repo | pengguna harus copy-paste; tetap perlu validasi ketat |

**Rekomendasi saya: A + C sekarang, B nanti bila perlu** (opsi "hibrida").
Alasannya: A langsung memberi pengalaman "ketik deskripsi → jadi tema", C
membuka pintu LLM tanpa risiko key bocor, dan B bisa ditambah tanpa mengubah
UI (cukup ganti "mesin" di belakang tombol yang sama).

## 3. Kosakata yang benar-benar sah (hasil audit kode)

AI tidak boleh mengarang id. Ini daftar tertutup dari `undangan.html`:

| Registry | Jumlah | Id |
|---|---|---|
| `FONTS` | 17 | cormorant, playfair, poppins, inter, lora, montserrat, bebas, oswald, ebgaramond, merriweather, work-sans, pacifico, dancing, caveat, sacramento, cinzel, marcellus |
| `ORNAMEN` | 18 | klasik, botanical, arabesque, deco, confetti, mutiara, awan, bunga, bintang, onyx, batik, mawar, geometrik, bulan, pita, zaitun, coretan, mahkota |
| `POLA` | 22 | batik, botanical, frost, arab, confetti, mendung, parang, kawung, damask, girih, deco, sulur, renda, marmer, ombak, zigzag, tabur, surya, rimbun, monstera, kraft, washi |
| `BORDERS` | 32 | none … vip-diamond (lihat `undangan.html`) |

Sisanya berupa nilai bebas yang tetap dibatasi: `g[3]` (3 warna hex), `accent`,
`ink`, `char` (≤ 12 huruf kapital), `deco` (1–3 glif), `desc` (≤ 180 char),
`ev` (pernikahan/khitanan/ultah/aqiqah/all), `arch` (bool).

## 4. Cara kerja generator lokal (opsi A)

1. **Baca prompt** → kata kunci Indonesia + Inggris ("hijau zaitun", "rustic",
   "adat Jawa", "elegan gelap", "ultah anak", "emas", "pantai").
2. **Pilih "mood"** → 8 arketipe: `hangat-organik`, `mewah-gelap`,
   `bersih-minimal`, `ceria-anak`, `islami-tenang`, `tropis-segar`,
   `nostalgia-kertas`, `editorial-berani`. Tiap arketipe punya palet dasar,
   pasangan font, dan keluarga ornamen/pola/border yang serasi.
3. **Rakit palet** → 3 stop (`g`) + `accent` + `ink`; bila prompt menyebut
   warna (hijau/emas/biru/pink/krem/navy/maroon), geser hue-nya.
4. **Perbaiki kontras otomatis** → rasio WCAG `ink` vs `g[0]` dan `accent` vs
   `g[0]` minimal **4.5:1**; kalau gagal, gelapkan/terangkan bertahap
   (maks 12 langkah, selalu konvergen).
5. **RNG ber-seed** → `seed = hash(prompt + variasi)`, jadi hasil bisa
   direproduksi dan tombol "acak lagi" menghasilkan kandidat berbeda tanpa
   duplikat di antara 3 kandidat.

Contoh keluaran nyata (id semuanya terdaftar):

```json
{
  "nama": "Zaitun Senja",
  "ev": "pernikahan",
  "g": ["#F3F1E7", "#DFE0CE", "#B9BE9E"],
  "accent": "#5E6B45",
  "ink": "#3C412F",
  "ft": "ebgaramond",
  "char": "ZAITUN",
  "orn": "zaitun",
  "pat": "kawung",
  "border": "laurel",
  "deco": "❀ ✦ ❀",
  "desc": "Zaitun lembut untuk akad siang — tenang, natural, tidak ramai",
  "arch": false
}
```

Contoh prompt uji: *"pernikahan adat Sunda, hijau zaitun, elegan, motif kawung"*
→ arketipe `hangat-organik`, font Marcellus/EB Garamond, pola `kawung`,
border `frame2`, ornamen `zaitun`.

## 5. UX di `studio-template.html`

Panel baru di atas daftar draf:

```
✨ Buat tema dengan AI
[ Pernikahan ▾ ]  [ deskripsi: "hijau zaitun, adat Sunda, elegan, kawung" ]
[ Buat 3 kandidat ]  [ 🎲 Acak ]   kepercayaan: (aman) ──●── (berani)
```

Hasil: 3 kartu kandidat berisi swatch 3 warna, nama tema, font, pola/border,
**skor kontras** (badge "Aman WCAG"), dan tombol **Pakai** → langsung menjadi
draf `custom-…` yang bisa diedit manual, dipratinjau penuh, lalu diekspor.

Tambahan kecil yang berguna: **kunci** (lock) palet atau font supaya "acak"
hanya mengubah sisanya, dan riwayat 5 generasi terakhir.

## 6. Kalau memilih LLM sungguhan (opsi B)

Karena GitHub Pages statis, kunci API **tidak boleh** ada di `assets/`.
Jalurnya: `studio-template.html` → `POST /functions/v1/ai-tema` (Supabase Edge
Function) → LLM → JSON. Fungsi itu yang memegang secret, plus rate limit per
IP dan validasi skema. Kontrak JSON-nya sama dengan §4, jadi UI tidak berubah.

Skema yang dipaksa (dipotong): hanya field di atas, `ft/orn/pat/border/ev`
harus cocok daftar tertutup, `g` 3 × `#RRGGBB`, panjang teks dibatasi, tolak
field lain. **Tidak ada** eksekusi kode/CSS dari model.

Opsi C (tempel JSON) memakai validator yang sama, jadi bisa dikerjakan lebih
dulu tanpa proxy.

## 7. Gerbang kualitas & tes

- `tools/bangun-tema-kosakata.cjs` → `assets/tema-kosakata.js` (id font/ornamen/
  pola/border + contoh tema) dibangkitkan dari sumber, bukan disalin manual.
- `tools/test-tema-ai.cjs` (jsdom + node):
  - 200 prompt acak → **semua id valid**, semua hex sah, `desc` ≤ 180;
  - kontras ≥ 4.5:1 untuk semua hasil;
  - deterministik (seed sama → hasil sama), 3 kandidat tidak identik;
  - hasil hanya menyentuh draf `custom-*` — 44 tema tidak berubah;
  - ekspor token AI lolos `node tools/cek-kerangka.cjs`.
- Bagian baru di `cek-kesehatan.py`: cek kosakata AI sinkron dengan registry
  `undangan.html`, dan cek negatif (tidak ada `fetch` ke domain luar di
  `assets/tema-ai.js`).

## 8. Fase kerja (usulan)

| Fase | Isi | Perkiraan |
|---|---|---|
| 0 | kosakata + mesin generator + tes (tanpa UI) | 1 sesi |
| 1 | panel AI + 3 kandidat + "Pakai jadi draf" | 1 sesi |
| 2 | lock/acak/riwayat + skor kontras di UI | ½ sesi |
| 3 | (opsional) tempel JSON / proxy Supabase | 1 sesi + deploy |

## 9. Keputusan yang saya butuh

1. Mesin AI: **A** (lokal, tanpa kunci), **A+C** (lokal + tempel JSON), **B**
   (LLM via proxy Supabase, perlu key & biaya), atau **A+B+C**.
2. Kandidat per prompt: 1, 3, atau 5.
3. Cakupan: **token saja** (warna/font/pola/border/ornamen/cover arch), atau
   **token + model cover & cara buka** (lebih "jadi", tapi mengubah dua setelan
   yang sekarang manual di tab Cover).

Setelah tiga hal ini jelas, saya kerjakan fase 0–2 sekaligus dan laporkan hasil
tesnya seperti biasa.

---

## 10. Status implementasi (2026-11-03)

Keputusan Anda: mesin **A+B+C** (lokal + tempel JSON + siapkan proxy),
**3 kandidat**, dan cakupan **token + cover & cara buka**. Fase 0–2 selesai,
fase 3 disiapkan tetapi belum dideploy.

| Bagian | Berkas | Status |
|---|---|---|
| Kosakata tertutup | `tools/bangun-tema-kosakata.cjs` → `assets/tema-kosakata.js` | ✅ dibangkitkan otomatis dari registry |
| Mesin lokal | `assets/tema-ai.js` (8 arketipe, seed, kontras ≥ 4.5:1) | ✅ |
| Validator + tempel JSON | `TEMA_AI.validasi` / `TEMA_AI.dariJSON` | ✅ |
| Panel ✨ AI | `studio-template.html` + `assets/studio-template.js` + CSS | ✅ |
| Kunci palet/font, acak, riwayat, salin JSON | panel yang sama | ✅ |
| Proxy LLM | `assets/tema-ai-proxy.js`, `supabase/functions/ai-tema/index.ts`, `docs/ai-tema-proxy.md` | ⏳ belum deploy & belum diuji di Supabase |
| Tes | `tools/test-tema-ai.cjs` (30 cek) + cek-kesehatan [25] | ✅ |

Yang **tidak** berubah: AI tidak menulis ke `kerangka/` dan tidak publish.
Tema hasil AI tetap harus diekspor lalu dibangun lewat `bangun-tpl.cjs`.
