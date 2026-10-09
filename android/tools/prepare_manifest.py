#!/usr/bin/env python3
"""Siapkan salinan AndroidManifest.xml untuk build tanpa Gradle.

Dua penyesuaian:

1. Menambahkan atribut ``package`` pada elemen ``<manifest>``. AGP 8 menolak atribut ini
   di berkas sumber (memakai ``namespace`` di build.gradle), sedangkan aapt2
   memerlukannya. Berkas sumber tetap bersih; hanya salinan build yang diubah.
2. Mengganti placeholder ``${applicationId}`` (dipakai pada authority penyedia berkas)
   dengan applicationId yang sebenarnya.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--package", required=True)
    parser.add_argument("--version-code", default=None)
    parser.add_argument("--version-name", default=None)
    args = parser.parse_args()

    text = args.input.read_text(encoding="utf-8")

    if re.search(r"<manifest[^>]*\bpackage=", text) is None:
        text = re.sub(
            r"<manifest\b",
            f'<manifest package="{args.package}"',
            text,
            count=1,
        )

    if "${applicationId}" in text:
        text = text.replace("${applicationId}", args.package)

    if args.version_code and "android:versionCode" not in text:
        text = re.sub(r"<manifest\b", f'<manifest android:versionCode="{args.version_code}"',
                      text, count=1)
    if args.version_name and "android:versionName" not in text:
        text = re.sub(r"<manifest\b", f'<manifest android:versionName="{args.version_name}"',
                      text, count=1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    print(f"manifest build ditulis: {args.output} (package={args.package})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
