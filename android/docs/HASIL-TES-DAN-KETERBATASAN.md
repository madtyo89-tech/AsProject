# Hasil tes & keterbatasan yang belum terselesaikan

Dokumen ini menyertakan apa yang **sudah** dibuktikan dan apa yang **belum** bisa
dibuktikan di lingkungan penyusunan (tanpa perangkat Android).

Tanggal: 2026-10-08 · Versi: 1.0.0 (`versionCode` 1)

---

## 1. Ringkasan

| Bagian | Alat | Hasil |
|--------|------|-------|
| Aturan navigasi & keamanan URL | `tests/jvm/UrlPolicyTest.java` (JVM) | **43/43 lulus** |
| Jembatan web ↔ Android | `tests/js/native-bridge.test.cjs` (Node + jsdom) | **21/21 lulus** |
| Isi & tanda tangan APK | `tools/verify_apk.py` + apksigner | **44/44 lulus** |
| Build APK | `build/build-apk.sh` (aapt2 → ecj → d8 → apksigner) | **berhasil** |
| Workflow GitHub Actions | run [#37742550663](https://github.com/madtyo89-tech/AsProject/actions/runs/37742550663) | **dua job lulus** (skrip 47 dtk, Gradle 49 dtk) |
| Cakupan perangkat nyata | — | **belum diuji** (lihat §4) |

APK uji: `android/out/asproject-studio-1.0.0-debug.apk` (256 KB,
SHA-256 `c12cd2b1d01c27f48b555c866538e3515e58563087120501247a7076a3dfaf73`).
Dua build terpisah (perkakas lama vs. hasil `tools/fetch_tools.py`) menghasilkan
SHA-256 yang sama — build deterministik untuk sumber yang sama.
Pemeriksaan tanda tangan: v1 `true`, v2 `true`, v3 `true`, sertifikat
`CN=Android Debug, O=Android, C=US` (kunci debug Android).

---

## 2. Yang sudah diuji (dan hasilnya)

### 2.1 Aturan navigasi — `UrlPolicyTest` (43 lulus)

- Hanya `https://asproject.my.id/*` dan sub-domainnya yang boleh dimuat di dalam aplikasi.
- Upaya penyamaran host ditolak: `asproject.my.id.evil.com`, `evil.com/asproject.my.id`,
  `notasproject.my.id`, `xasproject.my.id`, `evil.my.id`.
- `https://evil.com@asproject.my.id/…` **dianggap domain Studio** (yang benar: host-nya
  `asproject.my.id`); huruf besar dan titik di akhir host tetap dikenali.
- `http://` tidak pernah dimuat sebagai HTTP — selalu dinaikkan ke HTTPS.
- `blob:`/`data:`/`javascript:` tidak dianggap tautan luar (tetap di dalam WebView).
- `wa.me`, `maps.*`, `tel:`, `mailto:`, `whatsapp:`, `intent:` dirutekan ke aplikasi luar;
  halaman Studio tidak pernah dikirim keluar.

### 2.2 Jembatan web ↔ Android — `native-bridge.test.cjs` (21 lulus)

Dijalankan di jsdom dengan `window.AsProject` tiruan yang meniru `NativeBridge`:

- `navigator.clipboard.writeText` tersedia dan memanggil `copyText` native
  (WebView lama tidak punya Clipboard API).
- `window.open('https://wa.me/…')` dan tautan Google Maps diteruskan ke `openExternal`
  → dibuka aplikasi WhatsApp/Maps; `window.open` bawaan **tidak** ikut berjalan.
- Tautan internal (`/master.html`, `/studio.html`) tetap di WebView.
- Bila aplikasi luar tidak bisa dibuka, `window.open` bawaan dipakai sebagai cadangan.
- Ekspor `blob:` (HTML undangan, CSV tamu, QR PNG) dicegat, isi berkas dirakit ulang
  dari potongan base64 dan **byte-nya identik** dengan blob asli; nama & MIME benar.
- Berkas 2,5 MB terkirim utuh dalam potongan 1 MiB (yang terakhir lebih pendek) —
  memastikan batas Binder tidak terlampaui.
- Kegagalan penyimpanan (ditolak / potongan gagal) berakhir dengan pesan kesalahan,
  bukan gagal senyap: `saveFinish` tidak dipanggil setelah `saveChunk` gagal.
- Memuat skrip dua kali tidak menggandakan penanganan; tanpa `window.AsProject`
  skrip tidak melakukan apa pun.
- Salinan aset `app/src/main/assets/native-bridge.js` identik dengan sumber
  `android/web/native-bridge.js` (mencegah berkas jembatan basi).

### 2.3 Isi & tanda tangan APK — `verify_apk.py` (44 lulus)

- Struktur ZIP utuh; `resources.arsc` **tidak terkompresi** dan **selaras 4 byte**
  (syarat Android 11+ untuk `targetSdk ≥ 30`).
- `classes.dex` berformat **DEX 035** → aman untuk `minSdk 21`.
- Enam kelas inti ada di DEX: `StudioActivity`, `UrlPolicy`, `ExternalLinks`,
  `ExportWriter`, `ShareFileProvider`, `NativeBridge`; string penting tertanam
  (`https://asproject.my.id/studio.html`, `native-bridge`, `wa.me`, `whatsapp`).
- Manifest: paket `my.id.asproject.studio`, label **AsProject Studio**, 1.0.0/1,
  minSdk 21, targetSdk 34, **tepat 3 izin** (INTERNET, ACCESS_NETWORK_STATE, CAMERA),
  satu aktivitas (`StudioActivity`, launcher), satu provider tidak diekspor,
  `usesCleartextTraffic=false`, `networkSecurityConfig` terpasang, `allowBackup=true`,
  kamera sebagai fitur opsional (`required=false`).
- Ikon: 5 kepadatan (mdpi…xxxhdpi) + ikon adaptif `anydpi-v26`.
- Tanda tangan v1/v2/v3 terverifikasi oleh `apksigner`.

### 2.4 Build

- `build/build-apk.sh` berjalan dari nol (aapt2 compile/link → ecj → d8 → kemas →
  apksigner) dan menghasilkan APK yang lolos `apksigner verify` — diuji dua kali dengan
  rangkaian perkakas berbeda (keduanya menghasilkan SHA-256 identik).
- **Workflow GitHub Actions sudah dijalankan sungguhan** (PR #9, run
  `37742550663`): job `apk-offline` lulus (build + uji JVM + uji JS + verifikasi APK)
  dan job `apk-gradle` lulus (build Gradle/AGP) — keduanya menghasilkan artefak APK.
  Temuan pertama dari CI: `build-apk.sh` gagal membuat debug keystore karena folder
  tujuannya belum ada (muncul hanya di lingkungan tanpa `fetch_tools`); sudah
  diperbaiki dengan `mkdir -p` dan dibuktikan hijau pada run berikutnya.
- `tools/fetch_tools.py` diuji ulang dari cache: seluruh arsip diverifikasi SHA-256-nya,
  anggota yang diekstrak diperiksa lagi, `aapt2 2.20` dan JDK 21 (`openjdk 21.0.8`) hasil
  ekstraksi terbukti dapat dipakai.
- Seluruh perkakas build dipatok SHA-256 dan diunduh dari sumber publik
  (PyPI + npm) karena lingkungan ini tidak punya Android SDK/Gradle
  (dl.google.com, repo1.maven.org, services.gradle.org tidak dapat diakses).
- Dua jebakan yang sudah ditangani dan diberi komentar di kode:
  1. `android.jar` diletakkan di *classpath* (bukan `-bootclasspath`) agar lambda
     (`java.lang.invoke.LambdaMetafactory`) bisa dikompilasi;
  2. `tools/apk_pack.py` **menyambung** `classes.dex` ke APK aapt2 tanpa menulis ulang
     ZIP — menulis ulang dengan alat zip biasa menghapus padding `resources.arsc`
     dan membuat APK ditolak Android 11+.

---

## 3. Pemetaan ke 12 permintaan

| # | Permintaan | Cara dipenuhi | Status uji |
|---|-----------|---------------|-----------|
| 1 | Logo repo jadi ikon | `tools/make_icons.mjs` dari `assets/logo-asproject.svg` | ✓ terverifikasi di APK (5 kepadatan + adaptif) |
| 2 | Login, draf, editor, preview, publish, share | memuat `studio.html` asli, tanpa mengganti apa pun | ✓ statis (halaman asli dimuat) |
| 3 | Unggah foto, galeri, musik, impor berkas | `onShowFileChooser` + kamera/galeri/dokumen/musik | ✓ statis + uji jembatan; **belum di perangkat** |
| 4 | Salin link, unduh HTML/CSV/QR, tautan blob | `NativeBridge` + `ExportWriter` + bilah "Buka/Bagikan" | ✓ uji jembatan (byte identik, 2,5 MB) |
| 5 | WhatsApp, Maps, tautan luar | `ExternalLinks` (intent + cadangan peramban) | ✓ uji JVM + uji jembatan |
| 6 | Tombol muat ulang, indikator, halaman gagal + Coba Lagi | tata letak `activity_studio.xml` + `StudioWebViewClient` | ✓ statis |
| 7 | Kembali ke halaman sebelumnya; konfirmasi keluar di awal | `onBackPressed` + dialog | ✓ statis |
| 8 | Login & draf bertahan saat dibuka ulang/diperbarui | `app_webview/` + `allowBackup` + aturan cadangan | ✓ statis (aturan cadangan ada) |
| 9 | Cache tidak menyematkan versi lama; tidak memuat ulang otomatis | `LOAD_DEFAULT` + reload manual berkonfirmasi | ✓ statis |
| 10 | HTTPS saja, sertifikat tidak diabaikan, domain dibatasi, izin minimal | `UrlPolicy`, `onReceivedSslError` → `cancel()`, tepat 3 izin | ✓ uji JVM + verifikasi APK |
| 11 | Tampilan ponsel responsif (keyboard, status bar, navigasi) | `adjustResize` + insets IME + warna bilah + `configChanges` | ✓ statis; **belum di perangkat** |
| 12 | Petunjuk build + workflow GitHub Actions | `docs/BUILD-APK.md` + `.github/workflows/android-apk.yml` | ✓ **dijalankan & lulus di GitHub Actions** (dua job, artefak APK) |

---

## 4. Keterbatasan yang belum terselesaikan

1. **Belum ada uji di perangkat nyata.** Lingkungan penyusunan tidak punya perangkat
   Android maupun emulator (tanpa akselerasi KVM + citra sistem), jadi hal-hal berikut
   **belum dibuktikan secara runtime**: pemasangan APK, tampilan WebView, pengunggahan
   berkas dari kamera/galeri, penyimpanan hasil ekspor ke folder Unduhan/MediaStore,
   handoff ke WhatsApp & Google Maps, perilaku keyboard/status bar saat mengedit.
   Yang tersedia sebagai bukti: uji JVM, uji jembatan di jsdom, dan pemeriksaan
   statis APK/DEX/manifest.
2. **APK debug, bukan untuk dibagikan.** Ditandatangani kunci debug Android
   (`CN=Android Debug`). Untuk distribusi, buat APK rilis dengan keystore Anda
   (`docs/BUILD-APK.md` §4). Aplikasi yang dipasang dengan kunci berbeda tidak dapat
   menimpa aplikasi yang sama — harus dicopot pemasangannya lebih dulu.
3. **Tanda tangan APK debug antar-run CI.** Setiap build kini memakai ulang debug
   keystore dari cache `actions/cache` (kunci `asproject-debug-keystore-v1`) supaya
   pembaruan tidak minta copot pemasangan. Bila cache itu kedaluwarsa/dibersihkan,
   APK berikutnya memakai kunci baru → Android menolak memperbarui aplikasi lama;
   copot pemasangan dulu. Untuk uji serius, pakai APK dari workspace ini atau bangun
   sendiri dengan keystore tetap (bagian 4 `docs/BUILD-APK.md`).
4. **Belum ada paket AAB / Play Store.** Hanya APK (debug & rilis) yang disiapkan;
   format `.aab` untuk Google Play di luar cakupan permintaan.
5. **Tombol muat ulang diletakkan di kiri-bawah**, bukan kanan-bawah, karena
   `studio.html` punya tombol melayangnya sendiri (`#floatPrev`) di kanan-bawah
   (`right:16px; bottom:16px`). Bila Studio menambah kontrol di kiri-bawah,
   tombol ini bisa menutupinya.
6. **Bilah hasil ekspor** sesaat menutupi pil status milik situs di tengah-bawah
   (hilang sendiri setelah 12 detik atau lewat tombol Tutup).
7. **Kamera & lokasi di dalam halaman web tidak diaktifkan.**
   `onPermissionRequest` menolak permintaan kamera/mikrofon dari halaman dan
   geolokasi ditolak. Foto diambil lewat pemilih berkas Android (kamera/galeri) —
   bukan lewat `getUserMedia`. Bila Studio kelak memerlukan kamera dalam halaman,
   penangan izin ini harus diperluas.
8. **Ekspor besar lewat jembatan base64.** Berkas ekspor dialirkan sebagai base64
   dalam potongan 1 MiB; diuji sampai 2,5 MB. Ekspor puluhan MB pada perangkat
   kelas bawah berisiko kehabisan memori — jembatan melaporkan kegagalan, bukan
   menggantung.
9. **Privat/keamanan bawaan WebView.** Aplikasi tidak menambah penyimpanan
   terenkripsi sendiri; sesi login & draf tersimpan di penyimpanan WebView
   (`app_webview/`), sama seperti peramban. Siapa pun yang memegang perangkat yang
   sudah terbuka dapat membuka aplikasi.
10. **Tanpa notifikasi push & tanpa mode offline.** Aplikasi selalu memuat versi
    terbaru dari server; bila perangkat offline, halaman "gagal koneksi" muncul
    (sesuai permintaan, bukan salinan offline).
11. **Halaman 4xx ditangani situs, bukan aplikasi.** Halaman gagal koneksi native
    hanya muncul untuk kegagalan jaringan, kesalahan sertifikat, dan respons 5xx;
    routing `/u/{slug}` yang memakai `404.html` tetap dirender situs (agar tidak
    merusak tautan undangan).
12. **Berkas `gradle-wrapper.jar` tidak di-commit** (biner). Jalankan
    `gradle wrapper --gradle-version 8.9` sekali bila ingin memakai `./gradlew`.
