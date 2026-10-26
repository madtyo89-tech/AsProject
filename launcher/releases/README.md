# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.2-debug.apk` | ±1,2 MB | APK uji, ditandatangani kunci **debug** Android |
| `SHA256SUMS.txt` | — | Sidik jari SHA-256 berkas di atas |

## Memasang

1. Salin APK ke ponsel (kabel, Google Drive, atau tautan langsung).
2. Buka berkasnya → izinkan **"Pasang aplikasi tidak dikenal"** untuk aplikasi
   yang membuka berkas (Files/Chrome).
3. Setelah terpasang: **Pengaturan → Aplikasi → Aplikasi default → Aplikasi
   beranda → AsProject Launcher**, atau tekan Home lalu pilih
   "AsProject Launcher → Selalu".

## Memeriksa keaslian berkas

```bash
sha256sum -c SHA256SUMS.txt
```

## Catatan tanda tangan

Kunci debug Android **bukan kunci rahasia**, tetapi juga bukan kunci rilis:
Play Store menolak APK bertanda debug, dan pembaruan hanya bisa dipasang di atas
APK yang ditandatangani kunci yang sama. Untuk APK rilis, lihat
[../docs/BUILD-APK.md](../docs/BUILD-APK.md) §4.

SHA-256 APK saat ini:

```
e1e51b285e0bb648fb183b21656ae7d6eba2b6a1541bdbf7c52b77798d38dba1
```

## Versi

`versionCode 3` / `versionName 1.0.2` — dinaikkan tiap build uji ANR supaya
pemasangan ulang dikenali Android sebagai **pembaruan** (tidak perlu
uninstall manual dulu), dan supaya versi yang terpasang bisa dicek lewat
**Pengaturan → Aplikasi → AsProject Launcher → lihat versi**.

## Build ini: pelacak checkpoint startup (StartupTrace)

Build sebelumnya (`1.0.1`, checkpoint dialog crash dipindah ke awal
`onCreate()`) sudah dicoba di Vivo Y50 dan **gagal** — macetnya masih
identik dan dialog crash (`CrashLog`) tetap tidak pernah muncul. Ini
mengonfirmasi dugaan: ini kemungkinan besar **ANR murni (hang tanpa
exception)**, bukan crash — dan `CrashLog` memang tidak dirancang untuk
menangkap hang murni (tidak ada apa pun yang "dilempar" untuk dicatat).

Build ini menambahkan mekanisme baru, `StartupTrace`: puluhan "checkpoint"
ditulis satu per satu ke penyimpanan lokal (synchronous, bukan `apply()`)
di sepanjang `onCreate()`/`onResume()`, TEPAT sebelum setiap tahap
berisiko (setContentView, inisialisasi widget host, setup drawer, apply
font tema, apply wallpaper, dst). Begitu seluruh proses mulai selesai
dengan selamat, checkpoint-nya dihapus. Kalau peluncuran berikutnya
ternyata masih menemukan checkpoint tersisa, itu bukti peluncuran
sebelumnya tidak pernah selesai mulai — dan nama checkpoint terakhir yang
tersimpan menunjuk PERSIS ke baris kode sebelum macetnya terjadi.

**Build ini murni untuk diagnosis** (belum ada perbaikan baru terhadap
hang-nya sendiri). Kalau sesudah dipasang launcher tetap macet seperti
biasa, tolong **buka lagi aplikasinya (atau restart HP)** setelah macet
itu — dialog baru "AsProject macet di tengah proses mulai" seharusnya
muncul di peluncuran berikutnya dengan nama checkpoint terakhir. Foto
layar dialog itu dan kirim ke pengembang; itu akan menunjukkan baris kode
persis mana yang harus diperbaiki.

## Perbaikan terbaru (penting)

Dikonfirmasi: di Vivo Y50, macetnya terjadi **persis sama bahkan saat dibuka
dari app drawer biasa** (belum dijadikan launcher default), dan **tidak ada
dialog apa pun yang terlihat** — termasuk dialog pencatat crash darurat
(`CrashLog`) yang sudah ditambahkan sebelumnya. Ternyata ada bug di urutan
pengecekannya sendiri: dialog itu dicek **setelah** `setContentView()`,
padahal `setContentView()` adalah tempat SEMUA View kustom (wallpaper,
layar kunci, jam, dll) dikonstruksi — kalau crash-nya ada di situ dan
terjadi berulang di titik yang sama persis tiap kali, pengecekan dialog
tidak akan pernah sampai tereksekusi, pada percobaan manapun.

**Perubahan di build ini:** `showPendingCrashIfAny()` dipindah ke **paling
awal `onCreate()`, sebelum `setContentView()`** — dialog punya Window
sendiri jadi tidak perlu menunggu layout selesai dibuat. Build ini murni
build diagnosis: kalau sekarang muncul dialog "AsProject sempat berhenti
sebelumnya", itu bukti nyata pertama yang kita punya. Kalau tetap tidak ada
dialog apa pun dan macetnya sama persis, itu petunjuk kuat bahwa ini
benar-benar hang (ANR murni, tanpa exception), bukan crash.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini (uninstall dulu yang lama) dan coba lagi.
