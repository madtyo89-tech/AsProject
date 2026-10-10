# Template undangan

Dua template, dibuat dari file di `katalog-demo/`:

| Kode | Template | Asal | Contoh data |
|---|---|---|---|
| `sage` | Sage Blossom (`undangan-sage-template.html`) | `undangan-sage.html` | `contoh-data.json` |
| `demo` | Emerald Gold (`undangan-demo-template.html`) | `undangan-demo.html` | `contoh-data-demo.json` |

Semua data pengantin diganti dengan placeholder `{{...}}`.

## Cara pakai

1. Salin contoh data sesuai template, lalu isi datanya:
   `cp contoh-data-demo.json data-klien.json`
2. Jalankan:

   ```
   python3 isi-template.py demo data-klien.json undangan-klien.html
   python3 isi-template.py sage data-klien.json undangan-klien.html
   ```

3. Letakkan foto klien di folder yang sama dengan hasil undangan, dengan nama
   sesuai `FOTO_COVER_1` / `FOTO_COVER_2` (sage) atau `FOTO_COVER` (demo).

Script berhenti dan menyebut kunci yang belum diisi, jadi tidak ada placeholder
`{{...}}` yang tertinggal. Nilai yang bisa dihitung sendiri (misalnya nomor
polos dari nomor tampilan, atau tautan Google Maps) diisi otomatis bila tidak
ditulis di JSON.

## Placeholder template sage

| Placeholder | Isi |
|---|---|
| `NAMA_PENGANTIN_WANITA` / `NAMA_PENGANTIN_PRIA` | nama panggilan |
| `NAMA_LENGKAP_WANITA` / `NAMA_LENGKAP_PRIA` | nama lengkap dengan gelar |
| `NAMA_LENGKAP_WANITA_REKENING` / `NAMA_LENGKAP_PRIA_REKENING` | nama di rekening (a.n.), otomatis dari nama lengkap |
| `AYAH_WANITA`, `IBU_WANITA`, `AYAH_PRIA`, `IBU_PRIA` | nama orang tua, tanpa "Bapak"/"Ibu" |
| `TANGGAL_ISO` | `YYYY-MM-DDTHH:MM:SS+07:00`, untuk hitung mundur |
| `TANGGAL_TITLE` | `DD.MM.YYYY`, untuk judul tab |
| `HARI_TANGGAL` | misal `Minggu, 12 Oktober 2026` |
| `JAM_AKAD`, `JAM_RESEPSI` | misal `08.00`, `11.00 – 15.00` |
| `NAMA_TEMPAT_AKAD`, `NAMA_TEMPAT_RESEPSI`, `ALAMAT_RESEPSI` | lokasi |
| `MAPS_AKAD`, `MAPS_RESEPSI` | kata cari Google Maps, otomatis dari nama tempat |
| `NO_REKENING`, `NO_HP_REKENING` | rekening dan nomor HP (format tampilan) |
| `NO_WA` | nomor WhatsApp konfirmasi, format 62xxxx |
| `BATAS_RSVP` | misal `30 September 2026` |
| `FOTO_COVER_1`, `FOTO_COVER_2` | nama file foto |

## Placeholder template demo

| Placeholder | Isi |
|---|---|
| `NAMA_PENGANTIN_PRIA` / `NAMA_PENGANTIN_WANITA` | nama panggilan (dipakai juga di cerita & judul) |
| `NAMA_LENGKAP_PRIA` / `NAMA_LENGKAP_WANITA` | nama lengkap dengan gelar |
| `NAMA_REKENING_PRIA` / `NAMA_REKENING_WANITA` | nama di amplop digital, otomatis dari nama lengkap |
| `IG_PRIA`, `IG_WANITA` | akun Instagram, misal `@rakaaditya` |
| `ORTU_PRIA`, `ORTU_WANITA` | kalimat orang tua lengkap, misal `Bpk. ... &amp; Ibu ...` |
| `TANGGAL_HEADER` | misal `SABTU ✦ 12 DESEMBER 2026 ✦ BANDUNG` |
| `HARI_TANGGAL` | misal `Sabtu, 12 Desember 2026` |
| `TANGGAL_ISO`, `TANGGAL_TITLE`, `TANGGAL_GALERI` | tanggal untuk hitung mundur, judul, dan galeri |
| `JAM_AKAD`, `JAM_RESEPSI` | misal `08.00 – 10.00`, `11.00 – 14.00` |
| `JAM_AKAD_RINGKAS`, `JAM_RESEPSI_RINGKAS` | versi ringkas untuk deskripsi kalender, misal `08.00`, `11.00-14.00` |
| `NAMA_TEMPAT`, `ALAMAT_TEMPAT`, `MAPS_QUERY` | lokasi dan kata cari Google Maps |
| `NO_REKENING`, `NO_REKENING_POLOS` | rekening (format tampilan & angka saja) |
| `BANK_1`, `NO_EWALLET`, `NO_EWALLET_POLOS`, `BANK_2` | e-wallet |
| `HASHTAG`, `UID_ICS` | hashtag dan ID unik untuk file kalender (.ics) |

Catatan: cerita perjalanan cinta (mis. "Lamaran 2023"), ucapan tamu contoh,
dan galeri foto di template demo masih berisi teks contoh. Ganti langsung di
hasil akhir atau tambahkan placeholder baru bila sering dipakai.

## Gaya Premium

Kedua template sudah memakai gaya Premium (palet emas, font Cormorant Garamond
dan Playfair Display), mengikuti referensi "Premium Wedding" di
`references/drive-katalog/`. Perubahannya dibuat oleh `premiumkan.py`, dan
hanya perlu dijalankan sekali. File sumber di `katalog-demo/` tidak berubah.

## Contoh hasil

`contoh-hasil/sage/index.html` dan `contoh-hasil/demo/index.html` adalah hasil
isian dengan data contoh, dengan foto yang sudah disalin. Buka lewat server
lokal, misalnya `python3 -m http.server 8000` di folder `contoh-hasil`.

## Verifikasi

Semua placeholder harus habis setelah diisi, dan tag HTML harus seimbang:

```
python3 isi-template.py sage contoh-data.json /tmp/s.html
python3 isi-template.py demo contoh-data-demo.json /tmp/d.html
grep -c "{{" /tmp/s.html /tmp/d.html        # harus 0
```

Tampilan belum dicek di browser dari sandbox ini. Cek visual perlu dilakukan
manual di browser.

## Template tambahan (dari referensi Drive)

Dibuat oleh `buat-tema-turunan.py` dari template sage, dengan palet dan font
dari `references/drive-katalog/`:

| Kode | Template | Acuan | Data contoh |
|---|---|---|---|
| `ice` | Ice Blue (pernikahan) | `undangan_x5f_online_x5f_ice_x5f_blue.html` | `contoh-data.json` |
| `khitanan-basic` | Khitanan dasar, hijau terang, Amiri & Poppins | `undangan-online-khitanan-basic.html` | `contoh-data-khitanan.json` |
| `khitanan-premium` | Khitanan premium, hijau gelap & emas, Cormorant & Poppins | `undangan-online-khitanan-premium.html` | `contoh-data-khitanan.json` |

Untuk khitanan, bagian pasangan diganti data anak dan orang tua, bagian
"Love Story" dihapus, dan kata "pernikahan/kado" diganti "khitanan/tanda kasih".
Placeholder khitanan: `NAMA_ANAK`, `NAMA_LENGKAP_ANAK`, `INISIAL_ANAK`,
`AYAH_ORTU`, `IBU_ORTU`, `NAMA_REKENING_1`, `NAMA_REKENING_2`.

Catatan: palet gelap pada `khitanan-premium` dibuat dari palet terang secara
otomatis. Cek kontras teks di browser sebelum dipakai ke klien.

Contoh hasil ada di `contoh-hasil/<kode>/index.html`.
Kode `ice`, `khitanan-basic`, `khitanan-premium` juga bisa dipakai di
`isi-template.py` dengan cara yang sama seperti `sage` dan `demo`.

## Struktur mengikuti referensi

Urutan bagian ketiga template tambahan disamakan dengan referensi Drive oleh
`susun-struktur.py`. Jalankan setelah `buat-tema-turunan.py`:

```
python3 buat-tema-turunan.py
python3 susun-struktur.py
```

| Template | Urutan bagian |
|---|---|
| `ice` | Pembuka & mempelai → Detail Acara (akad & resepsi) → Hitung Mundur → RSVP → Amplop Digital → Penutup |
| `khitanan-basic` | Pembuka → Save the Date → Hitung Mundur → Doa & Harapan → Buku Tamu → Penutup (Wassalamualaikum, Keluarga Besar) |
| `khitanan-premium` | Walimatul Khitan (hadis) → Detail Acara → Hitung Mundur → Doa Khitan → Konfirmasi & Doa → Penutup |

Bagian yang dihapus dari template sage agar sama dengan referensi: Love Story,
Galeri Foto, Dress Code, dan Lokasi terpisah (lokasi sudah ada di Detail Acara).
Amplop Digital hanya ada di `ice`. Untuk khitanan, bagian ini bisa dikembalikan
jika diperlukan.
