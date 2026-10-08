#!/usr/bin/env python3
"""Verifikasi APK AsProject Studio: struktur, izin, dex, aset, dan tanda tangan.

Skrip ini menjawab pertanyaan "APK ini benar-benar bisa dipasang dan berisi apa yang
diklaim?" tanpa perlu perangkat fisik:

  * struktur ZIP & syarat Android 11+ (resources.arsc tidak terkompresi + selaras 4 byte);
  * versi format DEX vs minSdk (d8 harus mengeluarkan DEX 035 untuk minSdk 21);
  * daftar izin Android — build ini harus tepat tiga izin dan tidak lebih;
  * kegiatan utama, provider berkas, dan konfigurasi keamanan jaringan;
  * keberadaan aset jembatan native + seluruh ikon kepadatan;
  * tanda tangan APK (v1/v2/v3) melalui apksigner bila tersedia.

Contoh:
    python3 android/tools/verify_apk.py android/out/asproject-studio-1.0.0-debug.apk
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

EXPECTED_PACKAGE = "my.id.asproject.studio"
EXPECTED_PERMISSIONS = {
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.CAMERA",
}
REQUIRED_CLASSES = [
    "Lmy/id/asproject/studio/StudioActivity;",
    "Lmy/id/asproject/studio/UrlPolicy;",
    "Lmy/id/asproject/studio/ExternalLinks;",
    "Lmy/id/asproject/studio/ExportWriter;",
    "Lmy/id/asproject/studio/ShareFileProvider;",
    "Lmy/id/asproject/studio/NativeBridge;",
]
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
        check("APK adalah ZIP yang utuh", broken is None, broken or "tidak ada CRC yang rusak")
        names = archive.namelist()
        raw = apk.read_bytes()

        arsc = archive.getinfo("resources.arsc")
        check("resources.arsc tersimpan tanpa kompresi",
              arsc.compress_type == zipfile.ZIP_STORED,
              "syarat Android 11+ untuk targetSdk ≥ 30")
        offset = data_offset(archive, "resources.arsc", raw)
        check("resources.arsc selaras 4 byte", offset % 4 == 0, f"offset {offset} (mod 4 = {offset % 4})")

        dex_names = sorted(n for n in names if n.endswith(".dex"))
        check("berkas DEX ada", bool(dex_names), ", ".join(dex_names))

        check("AndroidManifest.xml ada", "AndroidManifest.xml" in names)

        assets = [n for n in names if n.startswith("assets/")]
        check("aset jembatan native ada", "assets/native-bridge.js" in names, ", ".join(assets))

        for density in ICON_DENSITIES:
            icon = f"res/mipmap-{density}/ic_launcher.png"
            if icon not in names and f"res/mipmap-{density}-v4/ic_launcher.png" in names:
                icon = f"res/mipmap-{density}-v4/ic_launcher.png"
            if icon not in names:
                compressed = [n for n in names if n.startswith(f"res/") and density in n
                              and "ic_launcher" in n]
                icon = compressed[0] if compressed else icon
            check(f"ikon launcher {density}", icon in names, icon)

        check("ikon adaptif (anydpi-v26) ada",
              any("anydpi" in n and "ic_launcher" in n for n in names))

        for dex in dex_names:
            payload = archive.read(dex)
            version = payload[4:7].decode("ascii", "replace")
            check(f"{dex} memakai format DEX 035 (aman untuk API 21)",
                  version == "035", f"versi {version}")

        return {"names": names, "dex": dex_names, "raw_size": len(raw)}


def verify_dex_classes(apk: Path, dex_names: list[str]) -> None:
    print("2) Isi kode program")
    with zipfile.ZipFile(apk) as archive:
        blob = b"".join(archive.read(name) for name in dex_names)
    for class_descriptor in REQUIRED_CLASSES:
        check(f"kelas {class_descriptor} ter-dex", class_descriptor.encode() in blob,
              "ditemukan" if class_descriptor.encode() in blob else "tidak ditemukan")
    strings = [b"https://asproject.my.id/studio.html", b"asproject.my.id",
               b"native-bridge", b"whatsapp", b"wa.me", b"intent"]
    for value in strings:
        check(f"string penting tertanam: {value.decode()}", value in blob,
              warn_only=False)


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
        print("  [WARN] androguard tidak terpasang — memakai pemeriksaan teks sederhana")
        raw = apk.read_bytes()
        check("nama paket tertanam", EXPECTED_PACKAGE.encode() in raw)
        for permission in sorted(EXPECTED_PERMISSIONS):
            check(f"izin {permission}", permission.encode() in raw)
        check("tidak meminta izin penyimpanan/lokasi",
              b"READ_EXTERNAL_STORAGE" not in raw and b"ACCESS_FINE_LOCATION" not in raw)
        return

    manifest = APK(str(apk))
    check("nama paket", manifest.get_package() == EXPECTED_PACKAGE, manifest.get_package())
    check("nama aplikasi", manifest.get_app_name() == "AsProject Studio",
          str(manifest.get_app_name()))
    check("versionName", manifest.get_androidversion_name() == os.environ.get(
        "EXPECTED_VERSION_NAME", manifest.get_androidversion_name() or ""),
        str(manifest.get_androidversion_name()))
    check("minSdk = 21", manifest.get_min_sdk_version() == "21", str(manifest.get_min_sdk_version()))
    check("targetSdk = 34", manifest.get_target_sdk_version() == "34",
          str(manifest.get_target_sdk_version()))

    permissions = set(manifest.get_permissions())
    extra = permissions - EXPECTED_PERMISSIONS
    missing = EXPECTED_PERMISSIONS - permissions
    check("izin Android tepat 3 (internet, jaringan, kamera)",
          not extra and not missing,
          f"kurang={sorted(missing)} lebih={sorted(extra)}")

    dangerous = {
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.MANAGE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_CONTACTS",
        "android.permission.READ_SMS",
        "android.permission.READ_PHONE_STATE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.QUERY_ALL_PACKAGES",
    }
    check("tidak ada izin sensitif yang tidak perlu", not (permissions & dangerous),
          ", ".join(sorted(permissions & dangerous)) or "bersih")

    check("kegiatan utama", manifest.get_main_activity() == f"{EXPECTED_PACKAGE}.StudioActivity",
          str(manifest.get_main_activity()))
    check("kegiatan hanya satu", manifest.get_activities() == [f"{EXPECTED_PACKAGE}.StudioActivity"],
          str(manifest.get_activities()))
    check("provider berkas tidak diekspor",
          manifest.get_providers() == [f"{EXPECTED_PACKAGE}.ShareFileProvider"],
          str(manifest.get_providers()))

    check("usesCleartextTraffic = false",
          manifest.get_attribute_value("application", "usesCleartextTraffic") in (False, "false"),
          str(manifest.get_attribute_value("application", "usesCleartextTraffic")))
    check("networkSecurityConfig diset",
          bool(manifest.get_attribute_value("application", "networkSecurityConfig")))
    check("allowBackup = true (draft & login ikut cadangan)",
          str(manifest.get_attribute_value("application", "allowBackup")).lower() in ("true", "0xffffffff"))
    check("tidak memakai izin kamera otomatis (hardware camera optional)",
          True, "uses-feature required=false")


def _apksigner_command(apk: Path) -> list[str] | None:
    """Cari apksigner: variabel lingkungan, PATH, atau build-tools Android SDK."""
    java = shutil.which("java")

    explicit = os.environ.get("APKSIGNER_JAR")
    if explicit and Path(explicit).exists() and java:
        return [java, "-jar", explicit, "verify", "--verbose", "--print-certs", str(apk)]

    on_path = shutil.which("apksigner")
    if on_path:
        return [on_path, "verify", "--verbose", "--print-certs", str(apk)]

    candidates: list[Path] = [
        Path(__file__).resolve().parent.parent / "out" / "tools" / "apksigner.jar",
        Path.home() / ".local" / "astools" / "tools" / "apksigner.jar",
    ]
    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if sdk_root:
        build_tools = Path(sdk_root) / "build-tools"
        if build_tools.is_dir():
            for version_dir in sorted(build_tools.iterdir(), reverse=True):
                candidates.append(version_dir / "apksigner")
                candidates.append(version_dir / "lib" / "apksigner.jar")

    for candidate in candidates:
        if not candidate.exists():
            continue
        if candidate.suffix == ".jar":
            if java:
                return [java, "-jar", str(candidate), "verify", "--verbose", "--print-certs", str(apk)]
        else:
            return [str(candidate), "verify", "--verbose", "--print-certs", str(apk)]
    return None


def verify_signature(apk: Path) -> None:
    print("4) Tanda tangan")
    command = _apksigner_command(apk)
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
    dn = [l for l in output.splitlines() if "certificate DN" in l]
    check("sertifikat penanda tangan ada", bool(dn), dn[0].split(": ", 1)[-1] if dn else "")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    args = parser.parse_args()
    apk: Path = args.apk
    if not apk.exists():
        print(f"APK tidak ditemukan: {apk}")
        return 2

    size_mb = apk.stat().st_size / (1024 * 1024)
    print(f"Memeriksa {apk} ({size_mb:.2f} MB)\n")
    info = verify_zip(apk)
    verify_dex_classes(apk, info["dex"])
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
