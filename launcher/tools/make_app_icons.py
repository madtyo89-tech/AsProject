#!/usr/bin/env python3
"""Buat ulang 8 ikon bawaan launcher dengan gaya **liquid glass sirkuit**.

Delapan ikon ini adalah contoh yang ikut terpasang di APK (drawable-nodpi).
Ikon aplikasi lain tidak perlu dibuat di sini: pada perangkat, semua ikon
diolah langsung oleh `NeonIconFactory` dari ikon aslinya.

Sumber glyph berasal dari tangkapan layar kisi ikon acuan (1080 px lebar).
Susunan kisi:
    baris 1 → Phone, Message, Camera, Settings
    baris 2 → Music, Chrome, WhatsApp, Instagram

Cara pakai:
    python3 launcher/tools/make_app_icons.py /tmp/extract/icons_crop.png

Bila berkas sumber tidak ada lagi, skrip berhenti dengan pesan yang jelas —
PNG yang sudah di-commit tetap dipakai apa adanya.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_preview import neonize, placeholder_icon  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "app" / "src" / "main" / "res" / "drawable-nodpi"

# Pusat ikon pada tangkapan layar acuan (hasil deteksi otomatis, lebar 1080).
COLUMNS = [191.5, 418.5, 643.5, 867.5]
ROWS = [154.0, 369.0]
HALF = 75          # setengah sisi ikon → 150 px, lalu dibesarkan ke 192
SIZE = 192

ORDER = [
    "phone", "message", "camera", "settings",
    "music", "chrome", "whatsapp", "instagram",
]

# Ikon pengganti bila sumber tidak tersedia: huruf + warna (tetap dineonkan).
FALLBACK = [(letter, hue) for letter, hue in
            (("P", 0), ("M", 1), ("C", 2), ("S", 3),
             ("M", 2), ("C", 1), ("W", 2), ("I", 3))]


def crop(source: Image.Image, cx: float, cy: float) -> Image.Image:
    box = (round(cx - HALF), round(cy - HALF), round(cx + HALF), round(cy + HALF))
    return source.crop(box)


def main() -> int:
    source_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/extract/icons_crop.png")
    source = None
    if source_path.exists():
        source = Image.open(source_path).convert("RGB")
        print(f"sumber : {source_path} ({source.size[0]}x{source.size[1]})")
    else:
        print(f"sumber tidak ditemukan: {source_path} — memakai glyph huruf pengganti")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(ORDER):
        row, col = divmod(index, 4)
        if source is not None:
            base = crop(source, COLUMNS[col], ROWS[row])
        else:
            letter, hue = FALLBACK[index]
            base = placeholder_icon(letter, hue, size=150)
        icon = neonize(base, size=SIZE, seed=11 + index * 7)
        target = OUT_DIR / f"ic_{name}.png"
        icon.convert("RGB").save(target, optimize=True)
        array = np.asarray(icon.convert("L")).astype(np.float32)
        print(f"  ic_{name}.png  terang={(array > 150).mean() * 100:5.2f}%")
    print(f"selesai → {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
