#!/usr/bin/env bash
#
# build-apk.sh — membangun AsProject Launcher tanpa Gradle.
#
# Skrip ini hanya menyiapkan jalur, identitas paket, dan nama keluaran, lalu
# menjalankan android/buildkit/build-apk.sh (aapt2 → kompilasi → d8 → apksigner)
# yang dipakai bersama dengan aplikasi AsProject Studio.
#
# Cara pakai:
#   ./buildkit/build-apk.sh                    # APK debug
#   FETCH_TOOLS=1 ./buildkit/build-apk.sh      # unduh JDK/aapt2/d8 lebih dulu bila belum ada
#   BUILD_TYPE=release KEYSTORE=… ./buildkit/build-apk.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE="$(cd "$HERE/../android" && pwd)/buildkit/build-apk.sh"

[[ -x "$CORE" ]] || { echo "✗ skrip inti tidak ditemukan: $CORE" >&2; exit 1; }

export APP_DIR="$HERE/app"
export WEB_DIR="$HERE/web"                 # tidak dipakai (SKIP_WEB_ASSETS=1)
export SKIP_WEB_ASSETS=1
export APP_ID="my.id.asproject.launcher"
export OUTPUT_NAME="asproject-launcher"
export VERSION_CODE="9"
export VERSION_NAME="1.0.8"
export BUILD_DIR="$HERE/out/build"
export OUT_DIR="$HERE/out"

exec "$CORE" "$@"
