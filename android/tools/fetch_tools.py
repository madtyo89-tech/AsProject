#!/usr/bin/env python3
"""Unduh & siapkan perkakas build Android untuk jalur "tanpa Gradle".

Dipakai oleh ``buildkit/build-apk.sh`` ketika ``FETCH_TOOLS=1`` dijalankan, atau berdiri
sendiri. Semua sumber dipatok versi + SHA-256; bila hash tidak cocok, skrip berhenti dan
tidak memakai berkas tersebut.

Yang diunduh (hanya bila belum ada / hash belum cocok):

  JDK 21 (Temurin)      PyPI      jdk4py-21.0.8.2-py3-none-manylinux_2_17_x86_64.whl
  aapt2 (linux-x64)     npm       aaptjs3-2.0.2.tgz       → package/bin/x64/linux/aapt2
  android.jar API 34    npm       minapk-0.4.0.tgz        → package/tools/android.jar
  d8.jar (R8)           npm       minapk-0.4.0.tgz        → package/tools/d8.jar
  apksigner.jar         npm       minapk-0.4.0.tgz        → package/tools/apksigner.jar
  ecj.jar (compiler)    npm       minapk-0.4.0.tgz        → package/tools/ecj-3.45.0.jar
  debug.keystore        npm       minapk-0.4.0.tgz        → package/tools/debug.keystore

Catatan: bila Android SDK sudah terpasang (``ANDROID_HOME``/``ANDROID_SDK_ROOT``),
``build-apk.sh`` memakai aapt2/d8/apksigner/android.jar dari SDK tersebut dan skrip ini
tidak perlu dijalankan sama sekali.

Contoh:
    python3 android/tools/fetch_tools.py --dest /path/ke/.tools
    python3 android/tools/fetch_tools.py --dest /path/ke/.tools --no-jdk
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import stat
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

USER_AGENT = "AsProjectStudio-build/1.0 (+https://asproject.my.id)"

JDK = {
    "name": "jdk4py-21.0.8.2-py3-none-manylinux_2_17_x86_64.whl",
    "url": "https://files.pythonhosted.org/packages/a2/61/"
           "f3b5936908ff6de66c61aef69bf1074cb468fb883f5a0bb9e15e67a6b484/"
           "jdk4py-21.0.8.2-py3-none-manylinux_2_17_x86_64.whl",
    "sha256": "85addfcb57c7051dad6145b9f816fc519337e9a0c705ef01edc9dc7818ee0356",
    "inner": "jdk4py/java-runtime",
}

MINAPK = {
    "name": "minapk-0.4.0.tgz",
    "url": "https://registry.npmjs.org/@drxiaozhi/minapk/-/minapk-0.4.0.tgz",
    "sha256": "d22fccaba9a909cf02f196c91ca1e45ac9cb4b32c6e16cf0493182d26c071417",
    # nama di dalam tarball → nama berkas tujuan → hash berkas
    "members": {
        "package/tools/android.jar": (
            "android.jar",
            "6cea1df3efb77103ac3e2beb9bf4718964b0e0869ab16d39d29d5cbae1c147ad",
        ),
        "package/tools/d8.jar": (
            "d8.jar",
            "d43c8a94c9b1f1da1a7cc49c32b81e8cee1708b37ee8b530a81a0688222b42c0",
        ),
        "package/tools/apksigner.jar": (
            "apksigner.jar",
            "eefdd6aed9db9fb849e4c98a50d8741e19d1b674ba6547220bcb9c3ed152123a",
        ),
        "package/tools/ecj-3.45.0.jar": (
            "ecj.jar",
            "c8f5e66787ea6e4e0394ba3051c86a4edc50683ce9850f71739646529a99a2d7",
        ),
        "package/tools/debug.keystore": (
            "debug.keystore",
            "cd85088049a4f13bea16ffa4236ff70c77407b387dae3f9baaa7500bddd7ce39",
        ),
        "package/LICENSES/R8-LICENSE.txt": ("R8-LICENSE.txt", None),
    },
}

AAPTJS = {
    "name": "aaptjs3-2.0.2.tgz",
    "url": "https://registry.npmjs.org/aaptjs3/-/aaptjs3-2.0.2.tgz",
    "sha256": "26031bd1acb577edce91675ae92daf63cf85795d4e2399333edeb994dd9197e9",
    "members": {
        "package/bin/x64/linux/aapt2": (
            "aapt2",
            "e4dff6060827a3e401bce376e47916f2f93a89602af54973ffd3fdfc2528be3f",
        ),
        "package/THIRD_PARTY_NOTICES": ("AAPT2-NOTICE.txt", None),
        "package/LICENSE": ("AAPTJS-LICENSE.txt", None),
    },
}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, target: Path, expected_sha256: str | None) -> Path:
    if target.exists() and expected_sha256 and sha256_of(target) == expected_sha256:
        print(f"  • sudah ada: {target.name}")
        return target
    if target.exists():
        print(f"  • hash tidak cocok, unduh ulang: {target.name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"  ↓ {url}")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as out:
        shutil.copyfileobj(response, out, length=1 << 20)
    if expected_sha256:
        actual = sha256_of(target)
        if actual != expected_sha256:
            raise SystemExit(
                f"Hash SHA-256 tidak cocok untuk {target.name}:\n"
                f"  diharapkan {expected_sha256}\n  dapat      {actual}"
            )
    return target


def extract_members(archive: Path, members: dict, dest: Path) -> None:
    with tarfile.open(archive, "r:gz") as tar:
        for member_name, (out_name, expected_sha256) in members.items():
            handle = tar.extractfile(member_name)
            if handle is None:
                raise SystemExit(f"Anggota tidak ada di dalam {archive.name}: {member_name}")
            data = handle.read()
            target = dest / out_name
            target.write_bytes(data)
            if expected_sha256:
                actual = hashlib.sha256(data).hexdigest()
                if actual != expected_sha256:
                    raise SystemExit(
                        f"Hash anggota tidak cocok untuk {out_name}:\n"
                        f"  diharapkan {expected_sha256}\n  dapat      {actual}"
                    )
            if out_name in ("aapt2",):
                target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            print(f"  ✓ {out_name}")


def extract_jdk(wheel: Path, dest: Path) -> Path:
    runtime = dest / "jdk" / "java-runtime"
    if (runtime / "bin" / "java").exists():
        print(f"  • sudah ada: {runtime}")
        return runtime
    runtime.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(wheel) as archive:
        for entry in archive.infolist():
            if not entry.filename.startswith(JDK["inner"] + "/"):
                continue
            relative = entry.filename[len(JDK["inner"]) + 1:]
            if not relative:
                continue
            target = runtime / relative
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open("wb") as out:
                shutil.copyfileobj(source, out)
            mode = entry.external_attr >> 16
            if mode:
                os.chmod(target, mode & 0o7777)
    java_bin = runtime / "bin" / "java"
    if not java_bin.exists():
        raise SystemExit("Ekstraksi JDK gagal: bin/java tidak ditemukan")
    java_bin.chmod(java_bin.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    print(f"  ✓ Java runtime: {runtime}")
    return runtime


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", required=True, type=Path,
                        help="folder tujuan (isi: tools/, jdk/, cache/)")
    parser.add_argument("--no-jdk", action="store_true",
                        help="lewati JDK (bila JAVA_HOME sudah tersedia)")
    args = parser.parse_args()

    dest: Path = args.dest
    tools_dir = dest / "tools"
    cache_dir = dest / "cache"
    tools_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    print("1) Perkakas Android (android.jar, d8, apksigner, ecj, debug keystore)")
    minapk = download(MINAPK["url"], cache_dir / MINAPK["name"], MINAPK["sha256"])
    extract_members(minapk, MINAPK["members"], tools_dir)

    print("2) aapt2 (Linux x86_64)")
    aapt = download(AAPTJS["url"], cache_dir / AAPTJS["name"], AAPTJS["sha256"])
    extract_members(aapt, AAPTJS["members"], tools_dir)

    if not args.no_jdk:
        print("3) JDK 21")
        wheel = download(JDK["url"], cache_dir / JDK["name"], JDK["sha256"])
        extract_jdk(wheel, dest)
    else:
        print("3) JDK dilewati (--no-jdk)")

    print("\nSelesai. Jalankan: build-apk.sh (tanpa FETCH_TOOLS lagi).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
