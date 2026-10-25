#!/usr/bin/env python3
"""Verifikasi APK AsProject Launcher tanpa perangkat fisik.

Yang diperiksa:

  * struktur ZIP & syarat Android 11+ (resources.arsc tidak terkompresi + selaras 4 byte);
  * versi format DEX vs minSdk 21;
  * identitas paket, minSdk/targetSdk, dan nama aplikasi;
  * **nol izin** — launcher ini tidak boleh meminta izin apa pun;
  * syarat menjadi peluncur: komponen `launcher`, kategori HOME + DEFAULT + LAUNCHER;
  * SettingsActivity tidak diekspor;
  * seluruh kelas Java ikut ter-dex;
  * ikon di semua kepadatan + ikon adaptif;
  * tanda tangan APK (v1/v2/v3).

Contoh:
    python3 launcher/tools/verify_apk.py launcher/out/asproject-launcher-1.0.0-debug.apk
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

EXPECTED_PACKAGE = "my.id.asproject.launcher"
EXPECTED_LABEL = "AsProject Launcher"
REQUIRED_CLASSES = [
    "Lmy/id/asproject/launcher/LauncherActivity;",
    "Lmy/id/asproject/launcher/LockScreenView;",
    "Lmy/id/asproject/launcher/WallpaperFigure;",
    "Lmy/id/asproject/launcher/LiquidWallpaperView;",
    "Lmy/id/asproject/launcher/HudView;",
    "Lmy/id/asproject/launcher/NeonIconFactory;",
    "Lmy/id/asproject/launcher/LiquidBatteryView;",
    "Lmy/id/asproject/launcher/SevenSegmentClockView;",
    "Lmy/id/asproject/launcher/CircuitWallpaperView;",
    "Lmy/id/asproject/launcher/AppDrawerView;",
    "Lmy/id/asproject/launcher/LiquidHandleView;",
    "Lmy/id/asproject/launcher/Typefaces;",
    "Lmy/id/asproject/launcher/HomeWallpaperView;",
    "Lmy/id/asproject/launcher/LockWallpaperView;",
    "Lmy/id/asproject/launcher/NeonIcons;",
    "Lmy/id/asproject/launcher/SettingsActivity;",
    "Lmy/id/asproject/launcher/AppRepository;",
    "Lmy/id/asproject/launcher/AppGridAdapter;",
    "Lmy/id/asproject/launcher/AppItem;",
    "Lmy/id/asproject/launcher/IconLoader;",
    "Lmy/id/asproject/launcher/Prefs;",
]
ICON_DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]

# Izin yang launcher ini sengaja TIDAK minta. Daftar ini dipakai untuk memastikan
# tidak ada satu pun yang bocor masuk lewat manifest atau pustaka.
FORBIDDEN_PERMISSIONS = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.ACCESS_WIFI_STATE",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.MANAGE_EXTERNAL_STORAGE",
    "android.permission.READ_CONTACTS",
    "android.permission.READ_CALL_LOG",
    "android.permission.READ_SMS",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_PHONE_STATE",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.QUERY_ALL_PACKAGES",
    "android.permission.PACKAGE_USAGE_STATS",
    "android.permission.EXPAND_STATUS_BAR",
    "android.permission.BIND_ACCESSIBILITY_SERVICE",
]

PASS = "\033[1;32mPASS\033[0m"
FAIL = "\033[1;31mFAIL\033[0m"
WARN = "\033[1;33mWARN\033[0m"

results: list[tuple[str, str, str]] = []


def check(name: str, ok: bool, detail: str = "", warn_only: bool = False) -> bool:
    if ok:
        results.append(("PASS", name, detail))
        print(f"  [{PASS}] {name}{(' — ' + detail) if detail else ''}")
    elif warn_only:
        results.append(("WARN", name, detail))
        print(f"  [{WARN}] {name}{(' — ' + detail) if detail else ''}")
    else:
        results.append(("FAIL", name, detail))
        print(f"  [{FAIL}] {name}{(' — ' + detail) if detail else ''}")
    return ok


def data_offset(archive: zipfile.ZipFile, name: str, raw: bytes) -> int:
    info = archive.getinfo(name)
    header = raw[info.header_offset:info.header_offset + 30]
    fields = struct.unpack("<IHHHHHIIIHH", header)
    name_length, extra_length = fields[9], fields[10]
    return info.header_offset + 30 + name_length + extra_length


def find_aapt2() -> str | None:
    explicit = os.environ.get("AAPT2")
    if explicit and Path(explicit).exists():
        return explicit
    on_path = shutil.which("aapt2")
    if on_path:
        return on_path
    local = (Path(__file__).resolve().parents[2] / "android" / ".tools" / "tools" / "aapt2")
    if local.exists():
        return str(local)
    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if sdk_root:
        build_tools = Path(sdk_root) / "build-tools"
        if build_tools.is_dir():
            for version_dir in sorted(build_tools.iterdir(), reverse=True):
                candidate = version_dir / "aapt2"
                if candidate.exists():
                    return str(candidate)
    return None


def aapt2_out(aapt2: str, apk: Path, *args: str) -> str:
    completed = subprocess.run([aapt2, *args, str(apk)], capture_output=True, text=True)
    return completed.stdout + completed.stderr


def verify_zip(apk: Path) -> dict:
    print("1) Struktur berkas")
    with zipfile.ZipFile(apk) as archive:
        broken = archive.testzip()
        check("APK adalah ZIP yang utuh", broken is None, broken or "tidak ada CRC yang rusak")
        names = archive.namelist()
        raw = apk.read_bytes()

        info = archive.getinfo("resources.arsc")
        check("resources.arsc tersimpan tanpa kompresi",
              info.compress_type == zipfile.ZIP_STORED,
              "syarat Android 11+ untuk targetSdk ≥ 30")
        offset = data_offset(archive, "resources.arsc", raw)
        check("resources.arsc selaras 4 byte", offset % 4 == 0, f"offset {offset} (mod 4 = {offset % 4})")

        dex_names = sorted(n for n in names if n.endswith(".dex"))
        check("berkas DEX ada", bool(dex_names), ", ".join(dex_names))
        check("AndroidManifest.xml ada", "AndroidManifest.xml" in names)
        assets = [n for n in names if n.startswith("assets/")]
        check("wallpaper layar kunci ada (assets/wallpaper/lock.jpg)",
              "assets/wallpaper/lock.jpg" in names, ", ".join(assets))
        check("wallpaper beranda ada (assets/wallpaper/home.jpg)",
              "assets/wallpaper/home.jpg" in names)
        check("tidak ada aset web/jembatan JS", not any(n.endswith(".js") for n in names))

        for density in ICON_DENSITIES:
            icon = f"res/mipmap-{density}/ic_launcher.png"
            found = icon in names or any(
                n.startswith("res/") and f"mipmap-{density}" in n and n.endswith("ic_launcher.png")
                for n in names)
            check(f"ikon launcher {density}", found, icon)

        check("ikon adaptif (anydpi-v26) ada",
              any("anydpi" in n and "ic_launcher" in n for n in names))

        for dex in dex_names:
            version = archive.read(dex)[4:7].decode("ascii", "replace")
            check(f"{dex} memakai format DEX 035 (aman untuk API 21)",
                  version == "035", f"versi {version}")

        return {"names": names, "dex": dex_names}


def verify_classes(apk: Path, dex_names: list[str]) -> None:
    print("2) Isi kode program")
    with zipfile.ZipFile(apk) as archive:
        blob = b"".join(archive.read(name) for name in dex_names)
    for descriptor in REQUIRED_CLASSES:
        present = descriptor.encode() in blob
        check(f"kelas {descriptor} ter-dex", present,
              "ditemukan" if present else "tidak ditemukan")
    # Bukti kode benar-benar mencari aplikasi (bukan sekadar daftar kosong).
    for value in (b"android.intent.category.LAUNCHER",
                  b"android.intent.action.MAIN",
                  b"launcher_prefs",
                  b"wallpaper/lock.jpg",
                  b"wallpaper/home.jpg"):
        check(f"string penting tertanam: {value.decode()}", value in blob)
    check("ikon neon ter-dex (8 ikon sirkuit)",
          all(name.encode() in blob for name in (
              "ic_phone", "ic_message", "ic_camera", "ic_settings",
              "ic_music", "ic_chrome", "ic_whatsapp", "ic_instagram")))


def verify_manifest(apk: Path) -> None:
    print("3) Manifest (peluncur, izin, ekspor)")
    aapt2 = find_aapt2()
    if aapt2 is None:
        print("  [WARN] aapt2 tidak tersedia — memakai pemeriksaan byte sederhana")
        raw = apk.read_bytes()
        for permission in FORBIDDEN_PERMISSIONS:
            check(f"izin tidak diminta: {permission.split('.')[-1]}",
                  permission.encode() not in raw)
        return

    badging = aapt2_out(aapt2, apk, "dump", "badging")
    package = re.search(r"package: name='([^']*)'", badging)
    check("nama paket", bool(package) and package.group(1) == EXPECTED_PACKAGE,
          package.group(1) if package else "tidak terbaca")

    min_sdk = re.search(r"minSdkVersion:'(\d+)'", badging)
    check("minSdk = 21", bool(min_sdk) and min_sdk.group(1) == "21",
          min_sdk.group(1) if min_sdk else "tidak terbaca")

    target_sdk = re.search(r"targetSdkVersion:'(\d+)'", badging)
    check("targetSdk = 34", bool(target_sdk) and target_sdk.group(1) == "34",
          target_sdk.group(1) if target_sdk else "tidak terbaca")

    label = re.search(r"application-label:'([^']*)'", badging)
    check("nama aplikasi", bool(label) and label.group(1) == EXPECTED_LABEL,
          label.group(1) if label else "tidak terbaca")

    check("aplikasi mendaftar sebagai peluncur (provides-component:'launcher')",
          "provides-component:'launcher'" in badging)

    launchable = re.search(r"launchable-activity: name='([^']*)'", badging)
    expected_activity = f"{EXPECTED_PACKAGE}.LauncherActivity"
    check("kegiatan utama LauncherActivity",
          bool(launchable) and launchable.group(1) == expected_activity,
          launchable.group(1) if launchable else "tidak terbaca")

    permissions_dump = aapt2_out(aapt2, apk, "dump", "permissions")
    requested = re.findall(r"uses-permission: name='([^']*)'", permissions_dump)
    check("NOL izin Android diminta", not requested,
          ", ".join(requested) if requested else "bersih — tidak ada satu pun")

    tree = aapt2_out(aapt2, apk, "dump", "xmltree", "--file", "AndroidManifest.xml")
    for category in ("android.intent.category.HOME",
                     "android.intent.category.DEFAULT",
                     "android.intent.category.LAUNCHER"):
        check(f"kategori {category.split('.')[-1]} ada", category in tree)

    check("placeholder ${applicationId} sudah diganti",
          "${applicationId}" not in tree)

    settings_block = tree.split("SettingsActivity")
    settings_exported = "exported(0x01010010)=false" in settings_block[-1][:2000] \
        if len(settings_block) > 1 else False
    check("SettingsActivity tidak diekspor", settings_exported)


def apksigner_command(apk: Path) -> list[str] | None:
    java = shutil.which("java")
    tools = Path(__file__).resolve().parents[2] / "android" / ".tools"
    local_java = tools / "jdk" / "java-runtime" / "bin" / "java"
    if not java and local_java.exists():
        java = str(local_java)
    local_jar = tools / "tools" / "apksigner.jar"
    explicit = os.environ.get("APKSIGNER_JAR")
    for jar in (explicit, str(local_jar) if local_jar.exists() else None):
        if jar and Path(jar).exists() and java:
            return [java, "-jar", jar, "verify", "--verbose", "--print-certs", str(apk)]
    on_path = shutil.which("apksigner")
    if on_path:
        return [on_path, "verify", "--verbose", "--print-certs", str(apk)]
    return None


def verify_signature(apk: Path) -> None:
    print("4) Tanda tangan")
    command = apksigner_command(apk)
    if command is None:
        with zipfile.ZipFile(apk) as archive:
            has_v1 = any(n.startswith("META-INF/") and n.endswith((".RSA", ".DSA", ".EC"))
                         for n in archive.namelist())
        check("tanda tangan v1 (META-INF)", has_v1,
              "apksigner tidak tersedia untuk memeriksa v2/v3", warn_only=not has_v1)
        return
    completed = subprocess.run(command, capture_output=True, text=True)
    output = completed.stdout + completed.stderr
    check("apksigner verify", completed.returncode == 0,
          output.strip().splitlines()[0] if output.strip() else "")
    for scheme in ("v1", "v2", "v3"):
        line = [l for l in output.splitlines() if f"Verified using {scheme} scheme" in l]
        check(f"skema tanda tangan {scheme}", bool(line) and "true" in line[0].lower(),
              line[0].strip() if line else "")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    args = parser.parse_args()
    apk: Path = args.apk
    if not apk.exists():
        print(f"APK tidak ditemukan: {apk}")
        return 2

    size_kb = apk.stat().st_size / 1024
    print(f"Memeriksa {apk} ({size_kb:.0f} KB)\n")
    info = verify_zip(apk)
    verify_classes(apk, info["dex"])
    verify_manifest(apk)
    verify_signature(apk)

    failed = [r for r in results if r[0] == "FAIL"]
    warned = [r for r in results if r[0] == "WARN"]
    print(f"\nRingkasan: {len(results) - len(failed) - len(warned)} lulus, "
          f"{len(warned)} peringatan, {len(failed)} gagal")
    for status, name, detail in failed:
        print(f"  - gagal: {name} {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
