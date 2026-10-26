# Membangun & menandatangani APK AsProject Launcher

Panduan ini menjelaskan tiga hal: build cepat tanpa SDK, build lewat Android
Studio/Gradle, dan APK rilis bertanda tangan kunci Anda sendiri.

---

## 1. Build cepat (tanpa Gradle, tanpa Android SDK)

Cara tercepat — dipakai untuk menghasilkan APK di `releases/`:

```bash
cd launcher
FETCH_TOOLS=1 ./buildkit/build-apk.sh
```

`FETCH_TOOLS=1` mengunduh perkakas resmi yang dipatok versi + SHA-256
(JDK Temurin, `aapt2`, `android.jar`, `d8`, `apksigner`, `ecj`) ke
`android/.tools/` — folder yang sama dipakai aplikasi Studio, jadi tidak
diunduh dua kali. Bila JDK 17+ dan Android SDK sudah terpasang, cukup:

```bash
./buildkit/build-apk.sh
```

Keluaran:

```
launcher/out/asproject-launcher-1.0.2-debug.apk
```

Rangkaian alat yang dijalankan (sama persis dengan aplikasi Studio):

```
aapt2 compile → aapt2 link → kompilasi Java (javac/ecj) → d8 → apk_pack → apksigner
```

Verifikasi APK tanpa perangkat:

```bash
python3 launcher/tools/verify_apk.py launcher/out/asproject-launcher-1.0.2-debug.apk
```

Contoh hasil: **72 lulus, 0 peringatan, 0 gagal** — termasuk "hanya 6 izin fitur
Spidometer mengambang yang diminta (tidak lebih, tidak kurang)",
`provides-component:'launcher'`, kategori HOME/DEFAULT/LAUNCHER, dan tanda
tangan v1+v2+v3.

---

## 2. Build lewat Android Studio / Gradle

Buka folder **`launcher/`** (bukan folder `android/`) sebagai proyek Gradle.

```bash
cd launcher
gradle --no-daemon :app:assembleDebug     # → app/build/outputs/apk/debug/app-debug.apk
gradle --no-daemon :app:assembleRelease   # → app/build/outputs/apk/release/
```

Kebutuhan: JDK 17+, AGP 8.5.2, Gradle 8.9+ (`gradle/wrapper` belum disertakan —
pakai Gradle yang terpasang atau `gradle wrapper` sekali di komputer Anda).
Tidak ada dependensi apa pun, jadi tidak ada unduhan pustaka pihak ketiga.

---

## 3. Menaikkan versi

Versi ada di tiga tempat dan harus sama:

| Berkas | Yang diubah |
|--------|-------------|
| `launcher/app/build.gradle` | `versionCode`, `versionName` |
| `buildkit/build-apk.sh` (pemanggil) | variabel `VERSION_CODE` / `VERSION_NAME` bila perlu |
| `launcher/tools/verify_apk.py` | bila Anda mematok versi tertentu di pemeriksaan |

Untuk build tanpa Gradle, versi bisa ditimpa dari lingkungan:

```bash
VERSION_CODE=2 VERSION_NAME=1.1.0 ./buildkit/build-apk.sh
```

---

## 4. APK rilis dengan keystore Anda sendiri

Kunci rilis **tidak boleh** masuk Git. Buat sekali di komputer Anda:

```bash
keytool -genkeypair -v -keystore launcher-release.jks \
  -alias launcher -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=AsProject, O=AsProject, C=ID"
```

Build rilis:

```bash
cd launcher
BUILD_TYPE=release \
KEYSTORE=/path/launcher-release.jks \
KEYSTORE_PASSWORD='…' \
KEY_ALIAS=launcher \
KEY_PASSWORD='…' \
./buildkit/build-apk.sh
```

Keluaran: `out/asproject-launcher-1.0.2-release.apk`.

Untuk Gradle, isi lewat variabel lingkungan yang dibaca `app/build.gradle`:

```
LAUNCHER_KEYSTORE_FILE ~/.keys/launcher-release.jks
LAUNCHER_KEYSTORE_PASSWORD …
LAUNCHER_KEY_ALIAS launcher
LAUNCHER_KEY_PASSWORD …
```

Tanpa variabel itu, `assembleRelease` menghasilkan APK **belum tertanda**
(`…-release-unsigned.apk`) — normal dan aman.

> **Penting:** Google Play dan pembaruan APK mensyaratkan kunci yang sama terus.
> Simpan `launcher-release.jks` + kata sandinya di tempat aman (bukan di repo).

---

## 5. CI (GitHub Actions)

Workflow `.github/workflows/android-launcher-apk.yml` berjalan saat ada push
yang menyentuh `launcher/**` atau `.github/workflows/android-launcher-apk.yml`:

1. Siapkan JDK 17, pakai cache debug keystore (agar tanda tangan antar-run sama);
2. Bangun APK tanpa Gradle;
3. Jalankan `launcher/tools/verify_apk.py` — build **gagal** bila ada izin bocor
   atau tanda tangan tidak sah;
4. Unggah artefak `asproject-launcher-apk`;
5. Saat tag `v*` dipush: buat GitHub Release.

Rahasia opsional untuk rilis bertanda tangan (Settings → Secrets):

```
LAUNCHER_KEYSTORE_BASE64   launcher-release.jks yang di-base64
LAUNCHER_KEYSTORE_PASSWORD kata sandi keystore
LAUNCHER_KEY_ALIAS         alias kunci
LAUNCHER_KEY_PASSWORD      kata sandi kunci
```
