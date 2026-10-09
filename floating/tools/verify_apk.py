#!/usr/bin/env python3
"""Verifikasi APK AsProject Floating: struktur, izin, dex, ikon, dan tanda tangan.

Menjawab "APK ini benar-benar bisa dipasang dan berisi apa yang diklaim?" tanpa perangkat
fisik. Memakai ``androguard`` bila tersedia (CI memasang lewat venv); bila tidak, jatuh ke
pemeriksaan teks UTF-16 pada biner manifest (cukup akurat untuk izin & nama paket).

Contoh:
    python3 floating/tools/verify_apk.py floating/out/asproject-floating-1.0.0-debug.apk
"""

from __future__ import annotations

import argparse
import os
import shutil
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

EXPECTED_PACKAGE = "my.id.asproject.floating"
EXPECTED_APP_NAME = "AsProject Floating"
EXPECTED_PERMISSIONS = {
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    # Hanya aktif bila pengguna memberi lewat ADB (pm grant) untuk freeform.
    "android.permission.WRITE_SECURE_SETTINGS",
}
REQUIRED_CLASSES = [
    "Lmy/id/asproject/floating/LauncherActivity;",
    "Lmy/id/asproject/floating/FloatingService;",
    "Lmy/id/asproject/floating/BootReceiver;",
    "Lmy/id/asproject/floating/OverlayPermission;",
    "Lmy/id/asproject/floating/AppOpener;",
    "Lmy/id/asproject/floating/ShortcutCatalog;",
    "Lmy/id/asproject/floating/ShortcutCodec;",
    "Lmy/id/asproject/floating/ShortcutStore;",
]
IMPORTANT_STRINGS = ["sinet.startup.inDriver", "com.google.android.apps.maps",
                     "com.grabtaxi.passenger", "com.gojek.app", "specialUse"]
ICON_DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]

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
    _, _, _, _, _, _, _, _, _, name_length, extra_length = struct.unpack("<IHHHHHIIIHH", header)
    return info.header_offset + 30 + name_length + extra_length


def verify_zip(apk: Path) -> dict:
    print("1) Struktur berkas")
    with zipfile.ZipFile(apk) as archive:
        broken = archive.testzip()
        check("APK adalah ZIP yang utuh", broken is None, broken or "tidak ada CRC rusak")
        names = archive.namelist()
        raw = apk.read_bytes()

        arsc = archive.getinfo("resources.arsc")
        check("resources.arsc tanpa kompresi", arsc.compress_type == zipfile.ZIP_STORED,
              "syarat Android 11+ untuk targetSdk >= 30")
        offset = data_offset(archive, "resources.arsc", raw)
        check("resources.arsc selaras 4 byte", offset % 4 == 0, f"offset {offset}")

        dex_names = sorted(n for n in names if n.endswith(".dex"))
        check("berkas DEX ada", bool(dex_names), ", ".join(dex_names))
        check("AndroidManifest.xml ada", "AndroidManifest.xml" in names)

        for density in ICON_DENSITIES:
            hits = [n for n in names if f"mipmap-{density}" in n and "ic_launcher.png" in n]
            check(f"ikon launcher {density}", bool(hits), hits[0] if hits else "tidak ada")
        check("ikon adaptif (anydpi-v26) ada",
              any("anydpi" in n and "ic_launcher" in n for n in names))

        for dex in dex_names:
            payload = archive.read(dex)
            version = payload[4:7].decode("ascii", "replace")
            check(f"{dex} format DEX 035 (aman API 21)", version == "035", f"versi {version}")

        return {"names": names, "dex": dex_names}


def verify_dex_classes(apk: Path, dex_names: list[str]) -> None:
    print("2) Isi kode program")
    with zipfile.ZipFile(apk) as archive:
        blob = b"".join(archive.read(name) for name in dex_names)
    for descriptor in REQUIRED_CLASSES:
        check(f"kelas {descriptor} ter-dex", descriptor.encode() in blob)
    for value in IMPORTANT_STRINGS:
        check(f"string tertanam: {value}", value.encode() in blob, warn_only=True)


def utf16(text: str) -> bytes:
    return text.encode("utf-16-le")


def verify_manifest(apk: Path) -> None:
    print("3) Manifest (izin, aktivitas, keamanan)")
    try:
        from loguru import logger
        logger.remove()
    except Exception:
        pass
    try:
        from androguard.core.apk import APK  # type: ignore
    except Exception:
        print("  [WARN] androguard tidak terpasang — memakai pemeriksaan teks UTF-16")
        with zipfile.ZipFile(apk) as archive:
            manifest = archive.read("AndroidManifest.xml")
        check("nama paket tertanam",
              utf16(EXPECTED_PACKAGE) in manifest or EXPECTED_PACKAGE.encode() in manifest)
        for permission in sorted(EXPECTED_PERMISSIONS):
            check(f"izin {permission}",
                  utf16(permission) in manifest or permission.encode() in manifest)
        check("tidak meminta QUERY_ALL_PACKAGES",
              utf16("QUERY_ALL_PACKAGES") not in manifest and b"QUERY_ALL_PACKAGES" not in manifest)
        return

    manifest = APK(str(apk))
    check("nama paket", manifest.get_package() == EXPECTED_PACKAGE, manifest.get_package())
    check("nama aplikasi", manifest.get_app_name() == EXPECTED_APP_NAME,
          str(manifest.get_app_name()))
    check("minSdk = 21", manifest.get_min_sdk_version() == "21", str(manifest.get_min_sdk_version()))
    check("targetSdk = 34", manifest.get_target_sdk_version() == "34",
          str(manifest.get_target_sdk_version()))

    permissions = set(manifest.get_permissions())
    extra = permissions - EXPECTED_PERMISSIONS
    missing = EXPECTED_PERMISSIONS - permissions
    check("izin tepat 6 (overlay, fgs, fgs-special, notifikasi, boot, secure[adb])",
          not extra and not missing, f"kurang={sorted(missing)} lebih={sorted(extra)}")

    dangerous = {
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_CONTACTS",
        "android.permission.READ_PHONE_STATE",
        "android.permission.INTERNET",
        "android.permission.QUERY_ALL_PACKAGES",
    }
    check("tidak ada izin jaringan/penyimpanan/lokasi (aplikasi offline)",
          not (permissions & dangerous),
          ", ".join(sorted(permissions & dangerous)) or "bersih")

    check("kegiatan utama",
          manifest.get_main_activity() == f"{EXPECTED_PACKAGE}.LauncherActivity",
          str(manifest.get_main_activity()))
    services = manifest.get_services()
    check("layanan gelembung terdaftar",
          f"{EXPECTED_PACKAGE}.FloatingService" in services, ", ".join(services))
    receivers = manifest.get_receivers()
    check("penerima boot terdaftar",
          f"{EXPECTED_PACKAGE}.BootReceiver" in receivers, ", ".join(receivers))


def _apksigner_command(apk: Path) -> list[str] | None:
    java = shutil.which("java")
    explicit = os.environ.get("APKSIGNER_JAR")
    if explicit and Path(explicit).exists() and java:
        return [java, "-jar", explicit, "verify", "--verbose", str(apk)]
    on_path = shutil.which("apksigner")
    if on_path:
        return [on_path, "verify", "--verbose", str(apk)]
    candidates = [
        Path(__file__).resolve().parent.parent / "out" / "tools" / "apksigner.jar",
        Path("/tmp/astools/tools/apksigner.jar"),
    ]
    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if sdk_root:
        build_tools = Path(sdk_root) / "build-tools"
        if build_tools.is_dir():
            for version_dir in sorted(build_tools.iterdir(), reverse=True):
                candidates.append(version_dir / "lib" / "apksigner.jar")
    for candidate in candidates:
        if candidate.suffix == ".jar" and candidate.exists() and java:
            return [java, "-jar", str(candidate), "verify", "--verbose", str(apk)]
        elif candidate.exists():
            return [str(candidate), "verify", "--verbose", str(apk)]
    return None


def verify_signature(apk: Path) -> None:
    print("4) Tanda tangan")
    command = _apksigner_command(apk)
    if command is None:
        with zipfile.ZipFile(apk) as archive:
            has_v1 = any(n.startswith("META-INF/") and n.endswith((".RSA", ".DSA", ".EC"))
                         for n in archive.namelist())
        check("tanda tangan v1 (META-INF)", has_v1, warn_only=not has_v1)
        return
    completed = subprocess.run(command, capture_output=True, text=True)
    output = completed.stdout + completed.stderr
    check("apksigner verify", completed.returncode == 0)
    for scheme in ("v1", "v2", "v3"):
        line = [l for l in output.splitlines() if f"Verified using {scheme} scheme" in l]
        check(f"skema tanda tangan {scheme}", bool(line) and "true" in line[0].lower(),
              line[0].strip() if line else "")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    args = parser.parse_args()

    print(f"Verifikasi APK: {args.apk}\n")
    info = verify_zip(args.apk)
    verify_dex_classes(args.apk, info["dex"])
    verify_manifest(args.apk)
    verify_signature(args.apk)

    failed = [r for r in results if r[0] == "FAIL"]
    print(f"\nTotal: {len(results)} pemeriksaan, {len(failed)} gagal")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
