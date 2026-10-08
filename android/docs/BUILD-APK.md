# Membangun APK AsProject Studio

Aplikasi ini adalah pembungkus WebView untuk **https://asproject.my.id/studio.html**.
Ada tiga cara membangun APK, dari yang paling tidak butuh alat sampai yang paling nyaman.

| Cara | Butuh apa | Cocok untuk |
|------|-----------|-------------|
| 1. Skrip tanpa Gradle | JDK 17+ (± Android SDK) | build cepat di server/CI, tanpa Gradle |
| 2. Android Studio / Gradle | Android Studio (SDK + JDK 17) | pengembangan sehari-hari |
| 3. GitHub Actions | tidak ada (semua di runner GitHub) | APK otomatis tiap push/tag |

---

## 1. Membangun tanpa Gradle (jalur yang dipakai untuk APK debug di folder `out/`)

Skrip `build/build-apk.sh` menjalankan rangkaian alat resmi Android satu per satu:

```
aapt2 compile → aapt2 link → javac/ecj → d8 → (kemas) → apksigner
```

### Prasyarat

- **JDK 17 atau lebih baru** (`java`, `keytool`; `javac` bila ada). Bila tidak ada JDK,
  skrip bisa mengunduh JDK 21 dari PyPI.
- **Android SDK opsional.** Bila ada (`ANDROID_HOME`/`ANDROID_SDK_ROOT`), skrip memakai
  `build-tools/*/aapt2`, `build-tools/*/lib/d8.jar`, `build-tools/*/lib/apksigner.jar`,
  dan `platforms/android-34/android.jar` dari SDK tersebut.
- Bila SDK tidak ada, jalankan dengan `FETCH_TOOLS=1`: skrip mengunduh
  `android.jar`, `d8.jar`, `apksigner.jar`, `ecj.jar`, `aapt2`, dan `debug.keystore`
  dari sumber publik yang **dipatok versi + SHA-256**-nya (`tools/fetch_tools.py`).
  Seluruh unduhan diverifikasi hash-nya sebelum dipakai.

### Perintah

```bash
cd android

# APK debug — pakai SDK bila terpasang:
./build/build-apk.sh

# APK debug — tanpa SDK sama sekali (unduh alat dari PyPI + npm):
FETCH_TOOLS=1 ./build/build-apk.sh

# Tanpa javac (mis. hanya JRE): skrip otomatis memakai ecj.jar
# Hasil: android/out/asproject-studio-<versi>-debug.apk
```

### Mengarahkan alat secara manual (opsional)

```bash
ANDROID_TOOLS_DIR=/path/ke-tools JAVA_HOME=/path/ke/jdk17 ./build/build-apk.sh
# atau satu per satu:
AAPT2=… ANDROID_JAR=… D8_JAR=… APKSIGNER_JAR=… ECJ_JAR=… ./build/build-apk.sh
```

### Hasil

```
android/out/asproject-studio-1.0.0-debug.apk     ← APK siap dipasang
android/build/offline/                            ← berkas antara (boleh dihapus)
```

Skrip berakhir dengan `apksigner verify --print-certs`; pastikan muncul
`Verifies` beserta `v1 scheme: true`, `v2 scheme: true`, `v3 scheme: true`.

---

## 2. Membangun dengan Android Studio / Gradle

Proyek Gradle sudah disiapkan di `android/`:

```
android/settings.gradle          pluginManagement + repositori
android/build.gradle             AGP 8.5.2
android/app/build.gradle         namespace, minSdk 21, targetSdk 34, signingConfigs
android/gradle.properties        useAndroidX=false (aplikasi tidak memakai AndroidX)
android/gradle/wrapper/…         distribusi Gradle 8.9
```

**Android Studio:** `File → Open…` → pilih folder `android/`, tunggu Gradle sync,
lalu `Build → Build Bundle(s) / APK(s) → Build APK(s)`.

**Baris perintah** (butuh Gradle 8.9+ dan JDK 17+):

```bash
cd android
gradle :app:assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
gradle :app:assembleRelease      # → app/build/outputs/apk/release/app-release-unsigned.apk
```

Belum ada `gradlew` di repositori (berkas `gradle-wrapper.jar` adalah biner dan
sengaja tidak di-commit). Sekali saja:

```bash
cd android && gradle wrapper --gradle-version 8.9
# setelah itu bisa memakai ./gradlew
```

> Dua jalur build memakai berkas sumber yang sama. `AndroidManifest.xml` tidak memuat
> atribut `package` (AGP 8 menolaknya) dan memakai `${applicationId}` pada authority
> penyedia berkas; jalur tanpa Gradle menyuntikkan keduanya lewat
> `tools/prepare_manifest.py` saat menyalin manifest.

---

## 3. GitHub Actions (APK otomatis)

Workflow: `.github/workflows/android-apk.yml`

- **push ke `main`** yang menyentuh `android/**` → build APK debug + seluruh uji + verifikasi.
- **tag `v*`** (mis. `git tag v1.0.0 && git push origin v1.0.0`) → APK dilampirkan ke GitHub Release.
- **workflow_dispatch** → tombol "Run workflow" di tab Actions.

Unduh hasil: tab **Actions → run terakhir → Artifacts → `asproject-studio-apk`**
(berisi APK + `SHA256SUMS.txt`). Bila `install from unknown sources` aktif di ponsel,
APK bisa dipasang langsung dari ponsel setelah diunduh.

Workflow ini sudah dijalankan dan **kedua job-nya lulus** (PR #9, run `37742550663`).
Debug keystore disimpan di cache `actions/cache` (kunci `asproject-debug-keystore-v1`)
supaya APK antar-run memakai kunci yang sama dan bisa saling memperbarui tanpa copot
pemasangan.

Workflow menjalankan dua job:

1. `apk-offline` — jalur skrip tanpa Gradle **plus** uji JVM, uji jembatan JS, dan
   pemeriksaan isi APK (`tools/verify_apk.py`).
2. `apk-gradle` — build Gradle/AGP standar (bersifat pelengkap; bila gagal,
   artefak dari job pertama tetap ada).

---

## 4. APK rilis dengan keystore Anda sendiri

> **Keystore dan kata sandinya tidak boleh masuk Git.** Repositori sudah mengabaikan
> `*.jks` dan `*.keystore`. Jangan pernah menempelkan kata sandi ke kode, issue, atau chat.

### 4.1 Buat keystore (sekali saja, simpan berkas + kata sandinya di tempat aman)

```bash
keytool -genkeypair -v \
  -keystore asproject-release.jks -alias asproject \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

### 4.2 Bangun APK rilis

**Lewat skrip:**

```bash
cd android
KEYSTORE=/aman/asproject-release.jks \
KEYSTORE_PASSWORD='…' KEY_ALIAS=asproject KEY_PASSWORD='…' \
BUILD_TYPE=release VERSION_NAME=1.0.0 VERSION_CODE=1 \
./build/build-apk.sh
# → android/out/asproject-studio-1.0.0-release.apk
```

**Lewat Gradle** (mis. lewat `~/.gradle/gradle.properties` di komputer Anda, bukan di repo):

```properties
asprojectKeystoreFile=/aman/asproject-release.jks
asprojectKeystorePassword=…
asprojectKeyAlias=asproject
asprojectKeyPassword=…
```

atau variabel lingkungan:

```bash
export ASPROJECT_KEYSTORE_FILE=/aman/asproject-release.jks
export ASPROJECT_KEYSTORE_PASSWORD='…'
export ASPROJECT_KEY_ALIAS=asproject
export ASPROJECT_KEY_PASSWORD='…'
cd android && gradle :app:assembleRelease
```

### 4.3 Rilis otomatis dari GitHub Actions

Isi empat **Secrets** di `Settings → Secrets and variables → Actions`:

| Nama | Isi |
|------|-----|
| `KEYSTORE_BASE64` | hasil `base64 -w0 asproject-release.jks` (satu baris) |
| `KEYSTORE_PASSWORD` | kata sandi keystore |
| `RELEASE_KEY_ALIAS` | alias kunci |
| `RELEASE_KEY_PASSWORD` | kata sandi kunci |

Lalu buat tag: `git tag v1.0.0 && git push origin v1.0.0`. APK debug + rilis akan
dilampirkan ke Release `v1.0.0`. Tanpa rahasia tersebut, workflow tetap berhasil —
hanya langkah rilis yang dilewati (dengan catatan `::notice::`).

### 4.4 Menjaga kunci yang sama untuk pembaruan

Android hanya mengizinkan pembaruan aplikasi bila ditandatangani kunci yang **sama**.
Simpan keystore rilis di tempat aman (mis. manajer kata sandi + cadangan). Bila
keystore hilang, aplikasi tidak bisa diperbarui lagi — pengguna harus memasang ulang.

---

## 5. Verifikasi APK

```bash
python3 android/tools/verify_apk.py android/out/asproject-studio-1.0.0-debug.apk
```

Pemeriksa ini memeriksa: keutuhan ZIP, `resources.arsc` tanpa kompresi **dan** selaras
4 byte (syarat Android 11+ untuk `targetSdk ≥ 30`), versi format DEX, izin, aktivitas,
penyedia berkas, konfigurasi keamanan jaringan, kelengkapan ikon, dan tanda tangan
v1/v2/v3. Skrip butuh `androguard` (`pip install androguard`) untuk bagian manifest dan
memakai `apksigner` dari `APKSIGNER_JAR`, `PATH`, atau `$ANDROID_HOME/build-tools/*/`.

Uji lain:

```bash
# Aturan navigasi/keamanan (JVM, tanpa Android):
javac -d /tmp/out android/app/src/main/java/my/id/asproject/studio/UrlPolicy.java \
      android/tests/jvm/UrlPolicyTest.java && java -cp /tmp/out UrlPolicyTest

# Jembatan web ↔ Android (Node + jsdom):
npm install --no-save --package-lock=false jsdom
NODE_PATH=./node_modules node android/tests/js/native-bridge.test.cjs
```

---

## 6. Pasang di ponsel

1. Salin `asproject-studio-1.0.0-debug.apk` ke perangkat (atau unduh dari artefak/release).
2. Buka berkasnya → izinkan **Pasang aplikasi tidak dikenal** bila diminta.
3. Jalankan **AsProject Studio**. APK debug ditandatangani kunci debug Android, jadi
   cocok untuk uji coba — untuk dibagikan, buat APK rilis dengan keystore Anda (bagian 4).

## 7. Bila ada masalah

| Gejala | Penyebab & penanganan |
|--------|----------------------|
| `aapt2 tidak ditemukan` | Pasang Android SDK atau jalankan `FETCH_TOOLS=1 ./build/build-apk.sh` |
| `Tidak ada javac maupun ecj.jar` | Pasang JDK 17+, atau `FETCH_TOOLS=1` (ecj dipakai bila hanya ada JRE) |
| `resources.arsc tidak selaras` | Jangan mengemas ulang APK dengan alat zip biasa setelah `aapt2 link`; pakai `build/build-apk.sh` |
| `apksigner verify` gagal | Pastikan `apksigner.jar` sesuai SDK dan `--min-sdk-version 21` dipakai |
| Ikon tidak berubah | Jalankan `node android/tools/make_icons.mjs` (butuh `sharp` sekali pakai) |
| Halaman lama masih tampil | Cache mengikuti header server (`LOAD_DEFAULT`); tekan tombol muat ulang |
