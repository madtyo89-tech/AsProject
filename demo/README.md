# Folder Demo Template

Isi folder ini dengan file template dari Google Drive → folder **"Katalog demo"**.
Begitu file-nya ada di sini dengan nama persis seperti di bawah, tombol **"Demo Live"**
otomatis muncul di modal tiap tema pada katalog (`index.html`). Kalau file belum ada,
tombolnya tidak ditampilkan (tidak akan ada link rusak / 404).

| Nama file yang diharapkan     | File asli di Drive                                  | Ukuran   |
| ----------------------------- | --------------------------------------------------- | -------- |
| `wedding-premium.html`        | `premium_wedding_invitation_template (2).html`      | 187.475 B |
| `khitanan-basic.html`         | `undangan-online-khitanan-basic.html`               | 190.232 B |
| `khitanan-premium.html`       | `undangan-online-khitanan-premium.html`             | 183.601 B |
| `ice-blue.html`               | `undangan_online_ice_blue.html`                     | 228.181 B |
| `ultah-anak.pdf`              | `Template Undangan Ulang Tahun Anak.pdf`            | 121.730 B |

## Peta tema → demo

Diatur di `index.html`, blok `/* ---- Konfigurasi ---- */` pada script `aspWaFab`:

- `DEMO_BY_NAME` — peta per nama tema (12 tema katalog).
- `DEMO_BY_CATEGORY` — cadangan per kategori (Pernikahan / Khitanan / Ulang Tahun / Aqiqah).

Peta saat ini masih tebakan berdasarkan nama file. Setelah file aslinya masuk,
pemetaannya disesuaikan dengan isi template yang sebenarnya.
