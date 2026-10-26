# APK AsProject Launcher

| Berkas | Ukuran | Keterangan |
|--------|--------|------------|
| `asproject-launcher-1.0.5-debug.apk` | ±1,2 MB | APK uji, ditandatangani kunci **debug** Android |
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
4fd8a09984627829252fc821c89e63e862c9c450b365efe50a9046401b1fef7f
```

## Versi

`versionCode 6` / `versionName 1.0.5` — dinaikkan tiap build uji ANR supaya
pemasangan ulang dikenali Android sebagai **pembaruan** (tidak perlu
uninstall manual dulu), dan supaya versi yang terpasang bisa dicek lewat
**Pengaturan → Aplikasi → AsProject Launcher → lihat versi**.

## Isolasi ANR bertahap (build ini: tahap 1 dari rencana)

Build `1.0.4` (beranda SUPER POLOS, `MinimalLauncherActivity`) sudah dicoba
beberapa jam di Vivo Y50 **TANPA macet sama sekali**. Ini bukti kuat
masalahnya ada di salah satu fitur berat `LauncherActivity` (wallpaper
liquid, HUD, layar kunci, ikon neon, widget) — bukan di status "aplikasi
beranda default" itu sendiri.

**Rencana sekarang: nyalakan fitur satu per satu**, bukan sekaligus seperti
sebelum-sebelumnya, supaya kalau macet lagi ketahuan PERSIS fitur mana yang
jadi biang kerok.

**Build ini (tahap 1):** HOME dikembalikan ke `LauncherActivity` (kerangka
lengkap), TAPI lewat `Prefs.DIAGNOSTIC_STAGE` semua fitur berat masih
dipaksa MATI: wallpaper kustom, layar kunci, ikon neon, animasi
HUD/liquid. Yang beda dari `1.0.4` di tahap ini cuma kerangka dasarnya
(`findViewById` yang lebih banyak, `AppDrawerView`, `GestureDetector`,
inisialisasi `AppWidgetHost`/`AppWidgetManager`, dll) — fitur visualnya
masih nonaktif semua. `MinimalLauncherActivity` masih ada di APK, bisa
dibuka manual dari laci aplikasi kapan pun untuk pembanding, tapi bukan
beranda default lagi.

**Kalau build tahap 1 ini lancar** → tahap berikutnya nyalain wallpaper,
lalu layar kunci, lalu animasi, lalu ikon neon, satu-satu dengan cara yang
sama (naikkan `DIAGNOSTIC_STAGE` + versi). **Kalau build ini malah macet**
→ bukan di fitur visualnya, melainkan di kerangka dasar `LauncherActivity`
sendiri (kemungkinan `AppWidgetHost`/`AppWidgetManager`, yang dibuat selalu
tanpa syarat di `onCreate()`).

Mekanisme diagnostik (`CrashLog` + `StartupTrace` + detak jantung) tetap
aktif. Kalau macet, buka ulang aplikasinya dan foto apa pun yang muncul.

## Riwayat tahap sebelumnya

- **1.0.4** — beranda super polos (`MinimalLauncherActivity`), tanpa fitur
  berat apa pun. Hasil tes: **lancar**, dipakai berjam-jam tanpa macet.
- **1.0.3** — `LauncherActivity` lengkap + paksa nonaktifkan animasi berat
  di perangkat kelas bawah + detak jantung runtime. Hasil tes: tetap macet.
- **1.0.2** — `StartupTrace` checkpoint `onCreate()`/`onResume()`. Hasil
  tes: tetap macet, tanpa dialog apa pun.
- **1.0.1** — dialog `CrashLog` dipindah ke paling awal `onCreate()`. Hasil
  tes: tetap macet, dialog tetap tidak pernah muncul.
- Perbaikan-perbaikan lebih awal (CrashLog di akhir `onCreate`, nilai
  bawaan animasi perangkat kelas bawah, `AppWidgetHost` try/catch) juga
  sudah dicoba dan tidak mengatasi macetnya — lihat riwayat commit di
  pull request untuk detail masing-masing.

Jika sebelumnya pernah mengalami notifikasi "AsProject Launcher mengalami
macet", pasang ulang APK ini dan coba lagi.
