# AsProject Studio — aplikasi Android (pembungkus WebView)

Aplikasi Android yang menampilkan **https://asproject.my.id/studio.html** secara langsung.
Aplikasi ini **tidak** menyalin situs: halaman selalu dimuat dari server, sehingga setiap
pembaruan Studio langsung terlihat tanpa memasang ulang APK.

- Paket: `my.id.asproject.studio` · Nama: **AsProject Studio**
- `minSdk 21` (Android 5.0) → `targetSdk 34` (Android 14)
- Izin: **tepat tiga** — INTERNET, ACCESS_NETWORK_STATE, CAMERA (kamera opsional)
- Tanpa AndroidX / tanpa pustaka pihak ketiga (hanya API framework Android)

## Memasang APK uji

```
android/out/asproject-studio-1.0.0-debug.apk
```

Salin ke ponsel → buka → izinkan "Pasang aplikasi tidak dikenal". APK ini bertanda
tangan kunci debug Android, jadi hanya untuk uji coba (lihat
[docs/BUILD-APK.md](docs/BUILD-APK.md) §4 untuk APK rilis dengan kunci Anda sendiri).

## Membangun sendiri

```bash
cd android
./build/build-apk.sh                 # pakai Android SDK + JDK yang sudah dipasang
FETCH_TOOLS=1 ./build/build-apk.sh   # tanpa SDK: unduh alat (hash dipatok) lalu build
```

Android Studio: buka folder `android/` sebagai proyek Gradle.

Petunjuk lengkap, termasuk APK rilis + tanda tangan dan GitHub Actions:
[docs/BUILD-APK.md](docs/BUILD-APK.md).

## Yang dikerjakan aplikasi (di luar WebView biasa)

| Kebutuhan situs | Jembatan native |
|-----------------|-----------------|
| **Salin link** | `navigator.clipboard.writeText` disediakan lewat `ClipboardManager` (WebView lama tidak punya Clipboard API) |
| **Unduh HTML/CSV/QR & ekspor blob** | klik `<a download href="blob:…">` dicegat, isinya dialirkan ke `ExportWriter` (potongan base64 1 MiB) → tersimpan di folder **Unduhan**, muncul bilah **Buka / Bagikan** |
| **Unggah foto/galeri/musik/impor berkas** | `onShowFileChooser` → pemilih Android: **Kamera**, **Galeri/Foto**, **Berkas (dokumen, musik, CSV)** |
| **WhatsApp / Google Maps / tautan luar** | `ExternalLinks`: `wa.me` / `whatsapp://` → aplikasi WhatsApp, `maps.*` → Google Maps, sisanya → peramban; tautan internal tetap di aplikasi |
| **Login & draf tidak hilang** | penyimpanan WebView + `allowBackup` dengan `app_webview/` ikut dicadangkan; `configChanges` menjaga WebView tidak dibangun ulang saat rotasi |
| **Cache tidak menyematkan versi lama** | `LOAD_DEFAULT` (mengikuti `Cache-Control`/ETag server); **tidak ada** muat ulang otomatis — muat ulang hanya lewat tombol, dengan konfirmasi |
| **Muat ulang, indikator, gagal koneksi** | tombol melayang kiri-bawah, progress bar 3 dp + layar pemuatan, halaman gagal dengan **Coba Lagi** / **Buka di browser** |
| **Tombol kembali** | kembali ke halaman sebelumnya; di halaman awal muncul konfirmasi keluar |
| **HTTPS saja, sertifikat tidak diabaikan** | `UrlPolicy` (hanya `https://asproject.my.id` + sub-domain), `http://` dinaikkan ke HTTPS, `onReceivedSslError` selalu `cancel()` |
| **Keyboard & sistem bar** | `adjustResize` + penanganan inset IME, warna bilah status/navigasi mengikuti tema |

Rincian: [docs/HASIL-TES-DAN-KETERBATASAN.md](docs/HASIL-TES-DAN-KETERBATASAN.md).

## Struktur folder

```
android/
├── app/src/main/            kode aplikasi (7 kelas Java + res/)
│   ├── java/my/id/asproject/studio/
│   │   ├── StudioActivity.java     WebView, navigasi, pemilih berkas, unduhan, tombol kembali
│   │   ├── UrlPolicy.java          daftar-putih domain, HTTPS, skema internal
│   │   ├── ExternalLinks.java      wa.me / Maps / tel / mailto → aplikasi luar
│   │   ├── ExportWriter.java       simpan ekspor (blob/base64) ke Unduhan/MediaStore
│   │   ├── ShareFileProvider.java  penyedia berkas internal (kamera & Bagikan)
│   │   └── NativeBridge.java       jembatan @JavascriptInterface (dengan pemeriksaan halaman tepercaya)
│   ├── assets/native-bridge.js     skrip yang disuntikkan ke halaman (salinan build)
│   └── res/                        tata letak, ikon, warna, aturan cadangan
├── web/native-bridge.js     sumber skrip jembatan (disalin ke assets/ saat build)
├── build/build-apk.sh       build tanpa Gradle (aapt2 → javac/ecj → d8 → apksigner)
├── tools/                   fetch_tools.py, prepare_manifest.py, apk_pack.py,
│                            verify_apk.py, make_icons.mjs
├── tests/                   uji JVM (UrlPolicy) & uji jembatan JS (jsdom)
├── docs/                    petunjuk build, hasil tes & keterbatasan, lisensi pihak ketiga
├── settings.gradle, build.gradle, app/build.gradle, gradle/   jalur Gradle/Android Studio
└── out/                     APK hasil build (tidak di-commit)
```

## Kontrak jembatan

`window.AsProject` (hanya aktif bila halaman yang dimuat ada di domain Studio):

```
platform() copyText(t) openExternal(u) toast(m) log(m)
saveBegin(nama, mime) → token
saveChunk(token, base64) → bool
saveFinish(token) → JSON {ok, name, mime, uri, location, error}
saveFile(nama, mime, base64) → JSON      // berkas kecil, satu panggilan
shareSavedFile(uri, mime, nama)  openSavedFile(uri, mime)
```

Hasil ekspor juga diumumkan ke halaman lewat `window.AsProjectDownloader.onSaved(json)`
dan event `asproject:export-saved`.

## Uji

```bash
javac -d /tmp/out app/src/main/java/my/id/asproject/studio/UrlPolicy.java \
      tests/jvm/UrlPolicyTest.java && java -cp /tmp/out UrlPolicyTest

npm install --no-save --package-lock=false jsdom
NODE_PATH=./node_modules node tests/js/native-bridge.test.cjs

python3 tools/verify_apk.py out/asproject-studio-1.0.0-debug.apk
```

## Lisensi pihak ketiga

Perkakas build yang diunduh saat membangun (aapt2, d8/R8, apksigner, ecj, JDK) tidak
disimpan di repositori; daftar lisensinya ada di
[docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
