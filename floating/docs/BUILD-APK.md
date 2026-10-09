# Membangun APK AsProject Floating

Ada dua jalur build yang memakai sumber yang sama:

| Jalur | Kapan dipakai | Perintah |
|-------|---------------|----------|
| **Skrip tanpa Gradle** (utama/terverifikasi) | Lingkungan tanpa SDK/Gradle | `bash buildkit/build-apk.sh` |
| **Gradle / Android Studio** | Pengembangan sehari-hari | buka folder `floating/` sebagai proyek |

Skrip perkakas Python (`prepare_manifest.py`, `apk_pack.py`, `fetch_tools.py`) dipakai
bersama dari `../android/tools` — satu salinan, tidak mungkin berbeda.

## 1. Jalur skrip tanpa Gradle

```bash
cd floating
./buildkit/build-apk.sh                 # pakai Android SDK + JDK bila sudah terpasang
FETCH_TOOLS=1 ./buildkit/build-apk.sh   # tanpa SDK: unduh alat (hash dipatok) lalu build
```

`FETCH_TOOLS=1` mengunduh (hanya bila belum ada): JDK 21 (PyPI `jdk4py`), aapt2 (npm),
`android.jar`/`d8.jar`/`apksigner.jar`/`ecj.jar` + debug keystore (npm `minapk`). Semua
sumber dipatok versi + SHA-256 di `../android/tools/fetch_tools.py`.

Keluaran: `floating/out/asproject-floating-1.0.0-debug.apk`.

### APK rilis dengan tanda tangan Anda

```bash
KEYSTORE=/path/asproject-release.jks \
KEYSTORE_PASSWORD=… KEY_ALIAS=… KEY_PASSWORD=… \
BUILD_TYPE=release ./buildkit/build-apk.sh
```

Keystore **tidak** disimpan di repositori; hanya diterima dari variabel lingkungan / rahasia CI.

## 2. Jalur Gradle / Android Studio

Buka folder `floating/` sebagai proyek Gradle (butuh Gradle 8.9+ dan JDK 17). Perintah:

```bash
cd floating
gradle :app:assembleDebug
```

## Verifikasi APK

```bash
python3 tools/verify_apk.py out/asproject-floating-1.0.0-debug.apk
```

Memeriksa struktur ZIP & syarat Android 11+, format DEX, daftar izin (tepat 5, tanpa
internet/lokasi/penyimpanan), kelas yang ter-dex, ikon semua kepadatan, dan tanda tangan
v1/v2/v3 (lewat `apksigner` bila tersedia, atau `androguard` bila terpasang).

## GitHub Actions

Workflow `.github/workflows/android-floating-apk.yml` menjalankan kedua jalur build plus
uji logika JVM dan verifikasi APK, lalu mengunggah artefak APK. Saat tag `v*` dipush dan
rahasia keystore diisi, APK rilis juga dibuat dan dilampirkan ke GitHub Release.
