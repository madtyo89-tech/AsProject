# Folder Demo Template

Isi folder ini dengan file template dari Google Drive → folder **"Katalog demo"**.
Begitu file-nya ada di sini dengan nama persis seperti di bawah, tombol **"Demo Live"**
otomatis muncul di modal tema pada katalog (`index.html`). Kalau file belum ada,
tombolnya tidak ditampilkan (tidak akan ada link rusak / 404).

| Nama file yang diharapkan | File asli di Drive | Ukuran | Status |
| --- | --- | --- | --- |
| `ice-blue.html` | `undangan_online_ice_blue.html` | 228.181 B | ⏳ menunggu file |
| `wedding-premium.html` | `premium_wedding_invitation_template (2).html` | 187.475 B | ⏳ menunggu file |
| `khitanan-premium.html` | `undangan-online-khitanan-premium.html` | 183.601 B | ⏳ menunggu file |
| `khitanan-basic.html` | `undangan-online-khitanan-basic.html` | 190.232 B | ⏳ menunggu file |
| `ultah-anak.pdf` | `Template Undangan Ulang Tahun Anak.pdf` | 121.730 B | ⏳ menunggu file |

> Sandbox tempat pengerjaan tidak punya akses internet keluar, jadi file Drive tidak
> bisa diunduh langsung dari sini. File perlu dikirim sebagai **lampiran file** di chat
> (bukan paste teks) atau di-upload ke folder `demo/` lewat web GitHub.

## Peta tema → demo

Diatur di `index.html`, blok `/* ---- Konfigurasi ---- */` pada script `aspWaFab`.
Nilainya boleh string atau **array** — array dicoba berurutan dan dipakai file pertama
yang benar-benar ada, jadi pemetaannya menyesuaikan sendiri seiring file masuk.

- `DEMO_BY_NAME` — override per nama tema.
- `DEMO_BY_CATEGORY` — cadangan per kategori chip di kartu.

```
Pernikahan  → wedding-premium.html, lalu ice-blue.html
Khitanan    → khitanan-premium.html, lalu khitanan-basic.html
Ulang Tahun → ultah-anak.pdf
Aqiqah      → (belum ada template-nya)
```

## Tema di Studio

`studio.html` sudah punya 3 tema hasil baca template **Ice Blue** (palet, font, dan
nama variannya diambil dari template aslinya):

| id | nama | palet | harga |
| --- | --- | --- | --- |
| `ice-blue` | Ice Blue Floral | `#F0F9FF → #BAE6FD → #7DD3FC`, aksen `#0EA5E9` | 75.000 |
| `minimalist-frost` | Minimalist Frost | `#FCFEFF → #F0F9FF → #E0F2FE`, aksen `#38BDF8` | 75.000 |
| `ocean-breeze` | Ocean Breeze | `#BAE6FD → #7DD3FC → #38BDF8`, aksen `#0284C7` | 79.000 |

Template baru di `TPL` otomatis ditambahkan ke `state.katalog` yang sudah tersimpan di
localStorage (lihat blok migrasi di `studio.html`), jadi tidak perlu reset data Studio.

## Catatan untuk `ice-blue.html` (dibaca dari isi template)

Yang perlu dibereskan begitu file-nya masuk:

1. **Branding masih `KartuDigital.My.Id`** (header, footer, copyright) → ganti ke `AsProject.My.Id`.
2. **Ada kata "beb"** di placeholder form RSVP: `Tulis namamu beb` → `Tulis namamu, Kak`.
3. Link footer masih `href="#"` dan "Chat WhatsApp Support Premium" cuma teks →
   arahkan ke `wa.me/6285196755675` dan `instagram.com/asproject.my.id`.
4. Script bawaan platform pembuatnya (`ecto:*` postMessage, `@font-face` Optimistic yang
   menunjuk `/fonts/...`) → bisa dibuang biar bersih & tidak 404.
