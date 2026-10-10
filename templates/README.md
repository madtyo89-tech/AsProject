# Template undangan (Sage Blossom)

Dibuat dari `katalog-demo/undangan-sage.html`. Semua data pengantin diganti
dengan placeholder `{{...}}` sehingga bisa dipakai untuk klien baru.

## Cara pakai

1. Salin `contoh-data.json` jadi `data-klien.json`, lalu isi datanya.
2. Jalankan:

   ```
   python3 isi-template.py data-klien.json undangan-klien.html
   ```

3. Letakkan foto klien di folder yang sama dengan `undangan-klien.html`
   (nama file sesuai `FOTO_COVER_1` dan `FOTO_COVER_2`).

Script akan berhenti dan menyebut kunci yang belum diisi, jadi tidak ada
placeholder `{{...}}` yang tertinggal di hasil akhir.

## Daftar placeholder

| Placeholder | Isi |
|---|---|
| `NAMA_PENGANTIN_WANITA` / `NAMA_PENGANTIN_PRIA` | nama panggilan, misal Rahma / Dika |
| `NAMA_LENGKAP_WANITA` / `NAMA_LENGKAP_PRIA` | nama lengkap dengan gelar |
| `NAMA_LENGKAP_WANITA_REKENING` / `NAMA_LENGKAP_PRIA_REKENING` | nama di rekening (a.n.) |
| `AYAH_WANITA`, `IBU_WANITA`, `AYAH_PRIA`, `IBU_PRIA` | nama orang tua (tanpa "Bapak"/"Ibu") |
| `TANGGAL_ISO` | format `YYYY-MM-DDTHH:MM:SS+07:00`, dipakai hitung mundur |
| `TANGGAL_TITLE` | format `DD.MM.YYYY` untuk judul tab |
| `HARI_TANGGAL` | misal `Minggu, 12 Oktober 2026` |
| `JAM_AKAD`, `JAM_RESEPSI` | misal `08.00`, `11.00 – 15.00` |
| `NAMA_TEMPAT_AKAD`, `NAMA_TEMPAT_RESEPSI`, `ALAMAT_RESEPSI` | lokasi |
| `MAPS_AKAD`, `MAPS_RESEPSI` | kata pencarian Google Maps (spasi jadi `+`); otomatis dari nama tempat jika tidak diisi |
| `NO_REKENING`, `NO_HP_REKENING` | rekening dan nomor HP (format tampilan) |
| `NO_REKENING_POLOS`, `NO_HP_REKENING_POLOS` | angka saja; otomatis dari format tampilan |
| `NO_WA` | nomor WhatsApp konfirmasi, format 62xxxx |
| `BATAS_RSVP` | misal `30 September 2026` |
| `FOTO_COVER_1`, `FOTO_COVER_2` | nama file foto di folder undangan |

Placeholder yang diisi otomatis tidak perlu ditulis di JSON: `NAMA_PENGANTIN_*_URL`,
`NO_REKENING_POLOS`, `NO_HP_REKENING_POLOS`, `MAPS_AKAD`, `MAPS_RESEPSI`,
`NAMA_LENGKAP_*_REKENING`.

## Verifikasi

`contoh-data.json` memakai data contoh dari undangan asli. Hasil isian harus
sama persis dengan `katalog-demo/undangan-sage.html`:

```
python3 isi-template.py contoh-data.json /tmp/cek.html
diff ../katalog-demo/undangan-sage.html /tmp/cek.html   # harus kosong
```
