#!/usr/bin/env bash
#
# build-apk.sh — membangun APK AsProject Studio tanpa Gradle.
#
# Dipakai karena lingkungan penyusunan tidak memiliki Android SDK/Gradle. Skrip ini
# menjalankan rangkaian alat resmi Android satu per satu:
#
#   aapt2 compile/link  →  javac (atau ecj)  →  d8  →  apksigner
#
# Cara pakai:
#   ./build-apk.sh                 # debug APK, pakai tool dari Android SDK bila ada
#   FETCH_TOOLS=1 ./build-apk.sh    # unduh alat (JDK/Toolchain) dari sumber publik bila tidak ada
#   BUILD_TYPE=release ./build-apk.sh   # APK release, wajib set variabel signing
#
# Variabel signing untuk release (JANGAN disimpan di Git):
#   KEYSTORE=/path/asproject-release.jks
#   KEYSTORE_PASSWORD=...  KEY_ALIAS=...  KEY_PASSWORD=...
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/app"
WEB_DIR="$ROOT/web"
TOOLS_DIR="${ANDROID_TOOLS_DIR:-$ROOT/.tools}"

BUILD_DIR="${BUILD_DIR:-$ROOT/out/build}"
OUT_DIR="${OUT_DIR:-$ROOT/out}"

APP_ID="my.id.asproject.studio"
MIN_SDK=21
TARGET_SDK=34
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"

BUILD_TYPE="${BUILD_TYPE:-debug}"
FETCH_TOOLS="${FETCH_TOOLS:-0}"

log()  { printf '\033[1;36m›\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- alat bawaan

find_java() {
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    echo "$JAVA_HOME/bin/java"; return
  fi
  if command -v java >/dev/null 2>&1; then command -v java; return; fi
  if [[ -x "$TOOLS_DIR/jdk/bin/java" ]]; then echo "$TOOLS_DIR/jdk/bin/java"; return; fi
  if [[ -x "$TOOLS_DIR/jdk/java-runtime/bin/java" ]]; then echo "$TOOLS_DIR/jdk/java-runtime/bin/java"; return; fi
  return 1
}

fetch_tools() {
  log "Menyiapkan alat bantu di $TOOLS_DIR (JAVA_HOME, aapt2, android.jar, d8, apksigner)"
  mkdir -p "$TOOLS_DIR"; cd "$TOOLS_DIR"
  python3 "$ROOT/tools/fetch_tools.py" --dest "$TOOLS_DIR"
  cd - >/dev/null
}

# ---------------------------------------------------------------- deteksi alat

if [[ "$FETCH_TOOLS" == "1" ]]; then
  fetch_tools
fi

JAVA_BIN="$(find_java || true)"
if [[ -z "$JAVA_BIN" ]]; then
  die "Java tidak ditemukan. Pasang JDK 17+, atau jalankan FETCH_TOOLS=1 ./build-apk.sh"
fi
JAVA_HOME_LOCAL="$(cd "$(dirname "$JAVA_BIN")/.." && pwd)"

AAPT2="${AAPT2:-}"
ANDROID_JAR="${ANDROID_JAR:-}"
D8_JAR="${D8_JAR:-}"
APKSIGNER_JAR="${APKSIGNER_JAR:-}"
ECJ_JAR="${ECJ_JAR:-}"

# 1) Android SDK (bila tersedia) — build-tools + platforms.
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$SDK_ROOT" && -d "$TOOLS_DIR/sdk" ]]; then SDK_ROOT="$TOOLS_DIR/sdk"; fi
if [[ -n "$SDK_ROOT" && -d "$SDK_ROOT" ]]; then
  BT="$(ls -d "$SDK_ROOT"/build-tools/*/ 2>/dev/null | sort -V | tail -1 || true)"
  PL="$(ls -d "$SDK_ROOT"/platforms/android-*/ 2>/dev/null | sort -V | tail -1 || true)"
  [[ -z "$AAPT2" && -n "$BT" && -x "${BT}aapt2" ]] && AAPT2="${BT}aapt2"
  [[ -z "$D8_JAR" && -n "$BT" && -f "${BT}lib/d8.jar" ]] && D8_JAR="${BT}lib/d8.jar"
  [[ -z "$APKSIGNER_JAR" && -n "$BT" && -f "${BT}lib/apksigner.jar" ]] && APKSIGNER_JAR="${BT}lib/apksigner.jar"
  [[ -z "$ANDROID_JAR" && -n "$PL" && -f "${PL}android.jar" ]] && ANDROID_JAR="${PL}android.jar"
  if [[ -z "$ANDROID_JAR" && -f "$SDK_ROOT/platforms/android-34/android.jar" ]]; then
    ANDROID_JAR="$SDK_ROOT/platforms/android-34/android.jar"
  fi
fi

# 2) Alat yang sudah disiapkan skrip fetch (atau manual).
[[ -z "$AAPT2" && -x "$TOOLS_DIR/tools/aapt2" ]] && AAPT2="$TOOLS_DIR/tools/aapt2"
[[ -z "$ANDROID_JAR" && -f "$TOOLS_DIR/tools/android.jar" ]] && ANDROID_JAR="$TOOLS_DIR/tools/android.jar"
[[ -z "$D8_JAR" && -f "$TOOLS_DIR/tools/d8.jar" ]] && D8_JAR="$TOOLS_DIR/tools/d8.jar"
[[ -z "$APKSIGNER_JAR" && -f "$TOOLS_DIR/tools/apksigner.jar" ]] && APKSIGNER_JAR="$TOOLS_DIR/tools/apksigner.jar"
[[ -z "$ECJ_JAR" && -f "$TOOLS_DIR/tools/ecj.jar" ]] && ECJ_JAR="$TOOLS_DIR/tools/ecj.jar"

[[ -n "$AAPT2" && -x "$AAPT2" ]] || die "aapt2 tidak ditemukan (set AAPT2=… atau FETCH_TOOLS=1)"
[[ -f "$ANDROID_JAR" ]] || die "android.jar tidak ditemukan (set ANDROID_JAR=… atau FETCH_TOOLS=1)"
[[ -f "$D8_JAR" ]] || die "d8.jar tidak ditemukan (set D8_JAR=… atau FETCH_TOOLS=1)"
[[ -f "$APKSIGNER_JAR" ]] || die "apksigner.jar tidak ditemukan (set APKSIGNER_JAR=… atau FETCH_TOOLS=1)"

JAVAC_BIN=""
[[ -x "$JAVA_HOME_LOCAL/bin/javac" ]] && JAVAC_BIN="$JAVA_HOME_LOCAL/bin/javac"

log "java      : $JAVA_BIN"
log "aapt2     : $AAPT2"
log "android   : $ANDROID_JAR"
log "d8        : $D8_JAR"
log "apksigner : $APKSIGNER_JAR"
if [[ -n "$JAVAC_BIN" ]]; then log "javac     : $JAVAC_BIN"; else log "javac     : (tidak ada — memakai ecj: ${ECJ_JAR:-tidak ada})"; fi
[[ -n "$JAVAC_BIN" || -f "$ECJ_JAR" ]] || die "Tidak ada javac maupun ecj.jar untuk mengompilasi Java"

# ---------------------------------------------------------------- aset web

mkdir -p "$APP_DIR/src/main/assets"
cp "$WEB_DIR/native-bridge.js" "$APP_DIR/src/main/assets/native-bridge.js"
log "native-bridge.js disalin ke assets/"

# ---------------------------------------------------------------- manifest

rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR"/{compiled,gen,classes,dex}
MANIFEST_SRC="$APP_DIR/src/main/AndroidManifest.xml"
MANIFEST="$BUILD_DIR/AndroidManifest.xml"
# aapt2 butuh atribut package (AGP 8 justru menolaknya di sumber), dan placeholder
# ${applicationId} dipakai untuk authority penyedia berkas.
python3 "$ROOT/tools/prepare_manifest.py" \
  --input "$MANIFEST_SRC" \
  --output "$MANIFEST" \
  --package "$APP_ID" \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME"

# ---------------------------------------------------------------- 1. resource

log "[1/6] aapt2 compile"
"$AAPT2" compile --dir "$APP_DIR/src/main/res" -o "$BUILD_DIR/compiled/res.zip"

log "[2/6] aapt2 link"
"$AAPT2" link \
  -o "$BUILD_DIR/resources.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$MANIFEST" \
  --java "$BUILD_DIR/gen" \
  -A "$APP_DIR/src/main/assets" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  --no-version-vectors \
  "$BUILD_DIR/compiled/res.zip"

# ---------------------------------------------------------------- 2. javac

log "[3/6] kompilasi Java"
# Catatan: android.jar ditaruh di classpath, bukan bootclasspath. Stub android.jar tidak
# memuat java.lang.invoke.LambdaMetafactory sehingga ekspresi lambda (Java 8) tidak bisa
# dikompilasi bila android.jar dijadikan bootclasspath tunggal. Kelas java.* diambil dari
# JDK yang menjalankan kompiler, kemudian D8 men-desugar lambda agar berjalan di API 21+.
mapfile -t SOURCES < <(find "$APP_DIR/src/main/java" "$BUILD_DIR/gen" -name '*.java' | sort)
if [[ -n "$JAVAC_BIN" ]]; then
  JAVAC_MAJOR="$("$JAVAC_BIN" -version 2>&1 | sed -n 's/^javac \(1\.\)\?\([0-9]*\).*/\2/p')"
  if [[ -n "${JAVAC_MAJOR:-}" && "$JAVAC_MAJOR" -ge 9 ]]; then
    "$JAVAC_BIN" -encoding UTF-8 --release 8 -nowarn \
      -classpath "$ANDROID_JAR" -d "$BUILD_DIR/classes" "${SOURCES[@]}"
  else
    # Sama: android.jar di classpath saja (bukan bootclasspath) — lihat catatan di atas.
    "$JAVAC_BIN" -encoding UTF-8 -source 8 -target 8 -nowarn \
      -classpath "$ANDROID_JAR" -d "$BUILD_DIR/classes" "${SOURCES[@]}"
  fi
else
  # ecj (Eclipse Compiler for Java) dipakai bila JDK tanpa javac (mis. distribusi JRE).
  "$JAVA_BIN" -jar "$ECJ_JAR" -1.8 -nowarn -proc:none \
    -classpath "$ANDROID_JAR" -d "$BUILD_DIR/classes" "${SOURCES[@]}"
fi
[[ -d "$BUILD_DIR/classes/my" ]] || die "kompilasi gagal: tidak ada kelas yang dihasilkan"

# ---------------------------------------------------------------- 3. d8

log "[4/6] d8 (dex)"
mapfile -t CLASSES < <(find "$BUILD_DIR/classes" -name '*.class' | sort)
"$JAVA_BIN" -cp "$D8_JAR" com.android.tools.r8.D8 \
  --min-api "$MIN_SDK" \
  --lib "$ANDROID_JAR" \
  --release \
  --output "$BUILD_DIR/dex" \
  "${CLASSES[@]}"

# ---------------------------------------------------------------- 4. kemas APK

log "[5/6] kemas APK (aapt2 + classes.dex)"
mkdir -p "$OUT_DIR"
UNSIGNED="$BUILD_DIR/app-unsigned.apk"
python3 "$ROOT/tools/apk_pack.py" \
  --resources "$BUILD_DIR/resources.apk" \
  --dex "$BUILD_DIR/dex" \
  --output "$UNSIGNED" \
  --check-alignment

# ---------------------------------------------------------------- 5. tanda tangan

log "[6/6] apksigner ($BUILD_TYPE)"
APKSIGNER=("$JAVA_BIN" -jar "$APKSIGNER_JAR" sign
  --min-sdk-version "$MIN_SDK"
  --v1-signing-enabled true
  --v2-signing-enabled true
  --v3-signing-enabled true)

if [[ "$BUILD_TYPE" == "release" ]]; then
  : "${KEYSTORE:?Set KEYSTORE=/path/keystore.jks untuk build release}"
  : "${KEYSTORE_PASSWORD:?Set KEYSTORE_PASSWORD}"
  : "${KEY_ALIAS:?Set KEY_ALIAS}"
  : "${KEY_PASSWORD:?Set KEY_PASSWORD}"
  OUTPUT_APK="$OUT_DIR/asproject-studio-$VERSION_NAME-release.apk"
  "${APKSIGNER[@]}" \
    --ks "$KEYSTORE" \
    --ks-pass "env:KEYSTORE_PASSWORD" \
    --ks-key-alias "$KEY_ALIAS" \
    --key-pass "env:KEY_PASSWORD" \
    --out "$OUTPUT_APK" \
    "$UNSIGNED"
else
  DEBUG_KEYSTORE="${DEBUG_KEYSTORE:-$TOOLS_DIR/tools/debug.keystore}"
  if [[ ! -f "$DEBUG_KEYSTORE" ]]; then
    log "membuat debug keystore di $DEBUG_KEYSTORE"
    # Folder tujuan bisa belum ada (jalur SDK tanpa fetch_tools).
    mkdir -p "$(dirname "$DEBUG_KEYSTORE")"
    "$JAVA_HOME_LOCAL/bin/keytool" -genkeypair -v \
      -keystore "$DEBUG_KEYSTORE" -storepass android -keypass android \
      -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1 \
      || die "gagal membuat debug keystore (butuh keytool dari JDK)"
  fi
  OUTPUT_APK="$OUT_DIR/asproject-studio-$VERSION_NAME-debug.apk"
  "${APKSIGNER[@]}" \
    --ks "$DEBUG_KEYSTORE" \
    --ks-pass pass:android \
    --ks-key-alias androiddebugkey \
    --key-pass pass:android \
    --out "$OUTPUT_APK" \
    "$UNSIGNED"
fi

"$JAVA_BIN" -jar "$APKSIGNER_JAR" verify --verbose --print-certs "$OUTPUT_APK" \
  | sed 's/^/    /'

echo
log "APK siap: $OUTPUT_APK"
ls -lh "$OUTPUT_APK" | awk '{print "    ukuran: " $5}'
sha256sum "$OUTPUT_APK" | awk '{print "    sha256: " $1}'
