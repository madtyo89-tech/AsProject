# Hasil tes & keterbatasan — AsProject Launcher

Ditulis apa adanya: apa yang **sudah** diverifikasi mesin, apa yang belum, dan
di mana risikonya.

## 1. Sudah diverifikasi otomatis

`python3 launcher/tools/verify_apk.py launcher/releases/asproject-launcher-1.0.0-debug.apk`
→ **50 lulus, 0 peringatan, 0 gagal**.

| Kelompok | Yang diperiksa |
|----------|----------------|
| Struktur | ZIP utuh (CRC), `resources.arsc` tidak terkompresi **dan** selaras 4 byte (syarat Android 11+), DEX format `035` (aman untuk API 21) |
| Identitas | `my.id.asproject.launcher`, minSdk 21, targetSdk 34, label "AsProject Launcher" |
| Peluncur | `provides-component:'launcher'`, kategori **HOME**, **DEFAULT**, **LAUNCHER** pada `LauncherActivity` |
| Privasi | **nol** `<uses-permission>` (diperiksa lewat `aapt2 dump permissions`), 19 izin terlarang dicek tidak tertanam |
| Keamanan | `SettingsActivity` `exported=false`, tidak ada aset web, tidak ada placeholder `${applicationId}` |
| Kode | 13/13 kelas Java ter-dex; string `android.intent.category.LAUNCHER`, `android.intent.action.MAIN`, `launcher_prefs` tertanam |
| Sumber daya | ikon `ic_launcher.png` di 5 kepadatan + ikon adaptif `mipmap-anydpi-v26` |
| Aset baru | `assets/wallpaper/lock.jpg` & `home.jpg` ada, 8 ikon neon tertanam (`ic_phone` … `ic_instagram`), tidak ada berkas JS |
| Tanda tangan | apksigner: v1 ✔, v2 ✔, v3 ✔ |

Yang **tidak** dilakukan mesin verifikasi: menjalankan aplikasinya.

## 1b. Aset wallpaper & ikon: asal dan batasannya

Wallpaper dan ikon berasal dari **screenshot yang dikirim pemilik proyek**
(`image_20261025_181759.webp` dan paket `circuit_icons_transparent.png`), lalu
diekstrak ulang dari tangkapan layar Meta AI — bukan berkas aslinya:

| Aset | Sumber di repo | Perlakuan |
|------|----------------|-----------|
| `assets/wallpaper/lock.jpg` | potongan y=346…2330 dari `Screenshot_20261025_225134.jpg` | dibersihkan dari bar UI Meta AI, JPEG q93 |
| `assets/wallpaper/home.jpg` | potongan y=306…2330 dari `Screenshot_20261025_225128.jpg` | idem |
| `res/drawable-nodpi/ic_*.png` | 8 tile 150 px dari `Screenshot_20261025_224613.jpg` | dipotong presisi, diperbesar ke 192 px + unsharp mask |
| `res/drawable-nodpi/wallpaper_*_thumb.jpg` | turunan 300 px | hanya untuk kartu di Pengaturan |

Konsekuensi yang harus diketahui:

- **Resolusi terbatas.** Wallpaper asli kemungkinan 1024×1536 (webp); yang
  tersedia di sini hasil tangkapan layar 1080 px. Pada layar 1440p gambar akan
  tampak sedikit lembut — bukan pecah, karena hanya diperbesar halus.
- **Ikon neon hanya 8** (sesuai paket). Aplikasi lain tetap memakai ikon
  aslinya; tidak ada ikon yang dipasangkan ke paket yang salah (pemetaan ada di
  `NeonIcons.java` dan hanya berlaku untuk paket yang dikenal).
- **Ikon neon bertema merek** (Chrome, WhatsApp, Instagram, dsb.). Mengganti
  ikon aplikasi pihak ketiga secara pribadi di perangkat sendiri umumnya wajar,
  tetapi **jangan** memakainya sebagai aset promosi/publikasi tanpa izin pemilik
  merek, dan jangan mengemas ulang aplikasi pihak ketiga dengan ikon tersebut.
- Berkas asli berukuran penuh tidak disimpan di repo (hanya hasil ekstraksi yang
  dipakai APK) agar repositori tetap ringan: total aset baru ±1,4 MB.

## 2. Belum diuji di perangkat

APK ini dibangun di lingkungan tanpa emulator dan tanpa ponsel fisik, jadi
**belum ada satu pun uji interaksi nyata**. Semua perilaku runtime di bawah ini
adalah hasil pembacaan kode, bukan hasil observasi:

- tampilan jam mengikuti format 12/24 jam sistem (`TextClock`);
- penyaringan kisi saat mengetik;
- tekan lama ikon → dialog opsi;
- tekan lama area kosong → dialog beranda;
- daftar aplikasi muncul lengkap di Android 11+ (butuh `<queries>`);
- ikon adaptif terpotong rapi (squircle);
- pengaturan tersimpan setelah beranda ditutup.

**Checklist uji manual yang disarankan** (5 menit):

1. Pasang APK → jadikan beranda bawaan → tekan Home.
2. Pastikan **semua** aplikasi muncul (bukan hanya sebagian) — ini menguji `<queries>`.
3. Ketuk beberapa ikon: aplikasi terbuka, dan menekan Home kembali ke beranda tanpa animasi aneh.
4. Ketik di pencarian: kisi menyaring; tombol ✕ muncul; Kembali menghapus kata lebih dulu.
5. Tekan lama ikon → Sembunyikan → aplikasi hilang dari kisi → muncul lagi lewat Pengaturan beranda → Pilih aplikasi… (centang ulang untuk memunculkan).
6. Tekan lama ikon → Taruh di dock; ulangi sampai 5 ikon; ikon ke-6 memberi pesan "dock penuh".
7. Pasang aplikasi baru dari Play Store → ikon baru muncul tanpa membuka ulang beranda.
8. Putar layar: kisi menyesuaikan, pencarian tidak hilang.
9. Tekan lama area kosong → **Kunci layar** → layar kunci muncul; **geser ke atas** → kembali ke beranda.
10. Roda gigi → matikan "Nama aplikasi", ubah kolom ke 5 → kembali: perubahan langsung terlihat.
11. Roda gigi → matikan **Ikon neon** → ikon WhatsApp/Chrome/kamera kembali ke ikon aslinya.
12. Roda gigi → matikan **Layar kunci** → tekan Home: tidak ada layar kunci.
13. Matikan layar (tombol daya), nyalakan lagi → layar kunci muncul dengan chip
    "BATERAI xx%" yang angkanya **sama** dengan indikator baterai sistem.
14. Layar kunci: geser sedikit lalu lepas → kembali ke atas (tidak terbuka);
    geser jauh/cepat → terbuka.

## 3. Keterbatasan yang diketahui

| Keterbatasan | Sebab / jalan keluar |
|--------------|----------------------|
| Launcher ini **tidak bisa** menjadi "Recents"/pengganti penuh sistem | Android hanya mengizinkan satu beranda; panel recent apps tetap milik sistem. Perilaku ini normal untuk launcher pihak ketiga. |
| Tidak ada widget | Widget butuh `AppWidgetHost` (ratusan baris + banyak kasus tepi). Belum termasuk di 1.0.0. |
| Tidak ada folder, ikon kustom, maupun penataan urutan manual | Kisi selalu urut abjad (Locale `id`). Fitur ini kandidat 1.1. |
| Wallpaper hanya bisa diganti lewat pemilih bawaan Android | Launcher tidak meminta izin penyimpanan; ia memanggil `ACTION_SET_WALLPAPER`. |
| Tidak ada animasi transisi khusus | `windowAnimationStyle=@null` agar perpindahan ke beranda terasa instan seperti launcher Pixel. |
| Ikon hanya di memori (LruCache) | Setiap proses beranda dimulai ulang, ikon dibaca ulang dari PackageManager. Untuk ±150 aplikasi ini masih di bawah 50 ms; tidak ada cache disk agar tidak menulis apa pun ke penyimpanan. |
| APK uji bertanda debug | Pembaruan di atasnya hanya dari APK bertanda kunci yang sama. Untuk rilis, lihat [BUILD-APK.md](BUILD-APK.md) §4. |
| Ponsel Xiaomi/Oppo/Vivo kadang "mengembalikan" beranda bawaan setelah pembaruan sistem | Batasan ROM, bukan aplikasi: set ulang di Pengaturan → Beranda. |
| Layar kunci ini **bukan** pengganti lock screen sistem | Android tidak mengizinkan aplikasi biasa menggantikan keyguard (butuh izin/aksesibilitas khusus yang sengaja tidak diminta). Yang ada: layar kunci milik beranda — muncul saat beranda dibuka dan saat layar menyala. Lock screen sistem tetap ada sebelum itu. |
| Wallpaper hanya mengubah tampilan beranda/layar kunci bawaan aplikasi | Tidak memanggil `WallpaperManager` (butuh izin `SET_WALLPAPER`), jadi wallpaper sistem & wallpaper layar kunci sistem tidak diubah. |
| Mode layar kunci memakai *contain* | Supaya bingkai liquid-chrome tidak terpotong; di layar sangat lebar/landscape akan ada ruang berwarna gelap di kiri-kanan. |

## 4. Kenapa tanpa izin sama sekali

Launcher biasanya meminta `QUERY_ALL_PACKAGES` (Android 11+) atau
`PACKAGE_USAGE_STATS`. Keduanya tidak dipakai di sini:

- daftar aplikasi dibaca lewat `queryIntentActivities` untuk
  `ACTION_MAIN` + `CATEGORY_LAUNCHER`, dan keterlihatan paket dibuka dengan blok
  `<queries>` di manifest — cara yang disarankan Google untuk peluncur;
- tidak ada akses internet, sehingga tidak ada telemetri yang mungkin dikirim;
- semua preferensi ada di `SharedPreferences` (`launcher_prefs.xml`) dan ikut
  cadangan Android (`allowBackup=true`).
