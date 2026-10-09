# Lisensi & komponen pihak ketiga

## 1. Kode aplikasi di repositori ini

Seluruh kode di `android/` (Java, XML, skrip Python/shell/Node) adalah bagian dari
proyek AsProject dan tidak memuat pustaka pihak ketiga:

- **Tidak ada dependensi Gradle** (`dependencies { }` sengaja kosong).
- **Tidak memakai AndroidX** — hanya API framework Android (`android.jar` dari SDK).
- Seluruh ikon dibuat dari `assets/logo-asproject.svg` milik repositori ini
  (`android/tools/make_icons.mjs`); tidak ada aset grafis pihak ketiga.

Android adalah merek dagang Google LLC. Aplikasi ini tidak berafiliasi dengan Google.

## 2. Perkakas build (tidak disimpan di repositori)

`android/buildkit/build-apk.sh` memakai perkakas resmi berikut. Semuanya **diunduh saat
build** dan tidak pernah di-commit; unduhan dipatok versi + SHA-256 di
`android/tools/fetch_tools.py`.

| Komponen | Asal | Lisensi |
|----------|------|---------|
| `aapt2` (Android Asset Packaging Tool 2) | Android Open Source Project (via npm `aaptjs3`) | Apache License 2.0 |
| `d8.jar` (bagian dari R8) | R8 Project / Android Open Source Project (via npm `@drxiaozhi/minapk`) | BSD 3-Clause (R8 project authors) |
| `apksigner.jar` | Android Open Source Project (via npm `@drxiaozhi/minapk`) | Apache License 2.0 |
| `ecj.jar` (Eclipse Compiler for Java) | Eclipse Foundation (via npm `@drxiaozhi/minapk`) | Eclipse Public License 2.0 |
| `android.jar` (Android 34 SDK platform) | Android Open Source Project (via npm `@drxiaozhi/minapk`) | Apache License 2.0 + [Android SDK Terms](https://developer.android.com/studio/terms) |
| `src.zip`/`android-stubs` — tidak dipakai | — | — |
| JDK 21 (Temurin, distribusi `jdk4py`) | Eclipse Temurin / PyPI | GPLv2 + Classpath Exception |
| `debug.keystore` bawaan build | dibuat ulang lokal dengan `keytool` | — (kunci debug, bukan rahasia) |

Bila Anda membangun lewat **Android Studio / Gradle**, komponen berikut dipakai dari
repositori resmi Maven (diunduh oleh Gradle, tidak disimpan di repositori ini):

| Komponen | Lisensi |
|----------|---------|
| Android Gradle Plugin (AGP) | Apache License 2.0 |
| Gradle | Apache License 2.0 |
| Kotlin stdlib (transitif AGP) | Apache License 2.0 |

## 3. Perkakas uji

| Komponen | Asal | Lisensi |
|----------|------|---------|
| `androguard` | PyPI | Apache License 2.0 |
| `jsdom` | npm | MIT |
| `sharp` (hanya untuk `make_icons.mjs`) | npm | Apache License 2.0 |
| `PyYAML` (validasi workflow) | PyPI | MIT |

Semua pustaka di atas hanya dipakai saat **pengembangan/CI**, tidak dimuat ke dalam APK.

## 4. Konten runtime

APK hanya memuat kode aplikasi + aset ikon. Halaman web Studio
(HTML/CSS/JS, termasuk pustaka sisi klien situs) dimuat langsung dari
`https://asproject.my.id/` saat aplikasi dijalankan dan tetap tunduk pada lisensi
masing-masing (mis. Tailwind CSS — MIT).
