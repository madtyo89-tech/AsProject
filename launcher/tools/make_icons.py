#!/usr/bin/env python3
"""Buat ikon AsProject Launcher (PNG) untuk semua kepadatan layar.

Desain: kotak membulat hitam pekat (#0A0A0A) dengan glyph 2×2 emas — sebuah
"kisi aplikasi" yang sekaligus menjadi tanda AsProject (hitam + emas onyx).

Keluaran (launcher/app/src/main/res/):
  mipmap-<kepadatan>/ic_launcher.png            48…192 px
  mipmap-<kepadatan>/ic_launcher_round.png      48…192 px (lingkaran)
  mipmap-<kepadatan>/ic_launcher_foreground.png 108…432 px, latar transparan
                                                (adaptive-icon Android 8+)

Cara pakai:
    python3 -m pip install --user pillow
    python3 launcher/tools/make_icons.py

PNG hasilnya ikut di-commit; skrip ini hanya perlu dijalankan ulang bila desain
ikon berubah.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
RES = HERE.parent / "app" / "src" / "main" / "res"

INK = (10, 10, 10, 255)
GOLD_TOP = (247, 231, 179)
GOLD_BOTTOM = (193, 143, 38)
GOLD_HAIRLINE = (212, 175, 55, 70)

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

SUPERSAMPLE = 4


def gold_gradient(size: int) -> Image.Image:
    """Gradien emas vertikal (terang di atas, lebih tua di bawah)."""
    column = Image.new("RGB", (1, size))
    pixels = column.load()
    for y in range(size):
        t = y / max(1, size - 1)
        pixels[0, y] = tuple(
            int(GOLD_TOP[i] + (GOLD_BOTTOM[i] - GOLD_TOP[i]) * t) for i in range(3)
        )
    return column.resize((size, size), Image.NEAREST)


def glyph(size: int, box_ratio: float) -> Image.Image:
    """Glyph 2×2 kotak membulat emas pada kanvas transparan."""
    canvas = size * SUPERSAMPLE
    box = int(canvas * box_ratio)
    offset = (canvas - box) // 2
    gap = int(box * 0.15)
    cell = (box - gap) // 2
    radius = int(cell * 0.30)

    mask = Image.new("L", (canvas, canvas), 0)
    draw = ImageDraw.Draw(mask)
    for row in (0, 1):
        for col in (0, 1):
            x = offset + col * (cell + gap)
            y = offset + row * (cell + gap)
            draw.rounded_rectangle([x, y, x + cell, y + cell], radius=radius, fill=255)

    layer = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    layer.paste(gold_gradient(canvas), (0, 0), mask)
    return layer.resize((size, size), Image.LANCZOS)


def background(size: int, shape: str) -> Image.Image:
    canvas = size * SUPERSAMPLE
    layer = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    inset = max(1, int(canvas * 0.015))
    if shape == "circle":
        draw.ellipse([inset, inset, canvas - inset, canvas - inset], fill=INK)
    else:
        draw.rounded_rectangle(
            [inset, inset, canvas - inset, canvas - inset],
            radius=int(canvas * 0.22),
            fill=INK,
        )
    # Garis rambut emas tipis agar ikon tidak menyatu dengan wallpaper gelap.
    width = max(1, int(canvas * 0.008))
    if shape == "circle":
        draw.ellipse(
            [inset, inset, canvas - inset, canvas - inset],
            outline=GOLD_HAIRLINE,
            width=width,
        )
    else:
        draw.rounded_rectangle(
            [inset, inset, canvas - inset, canvas - inset],
            radius=int(canvas * 0.22),
            outline=GOLD_HAIRLINE,
            width=width,
        )
    return layer.resize((size, size), Image.LANCZOS)


def legacy_icon(size: int, shape: str) -> Image.Image:
    layer = background(size, shape)
    layer.alpha_composite(glyph(size, 0.56))
    return layer


def adaptive_foreground(size: int) -> Image.Image:
    # Zona aman adaptive-icon adalah 66/108 dp; glyph 56% kanvas aman di dalamnya.
    return glyph(size, 0.56)


def main() -> None:
    written = []
    for density, size in LEGACY.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        legacy_icon(size, "square").save(folder / "ic_launcher.png", optimize=True)
        legacy_icon(size, "circle").save(folder / "ic_launcher_round.png", optimize=True)
        written.append(folder / "ic_launcher.png")
    for density, size in ADAPTIVE.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        adaptive_foreground(size).save(folder / "ic_launcher_foreground.png", optimize=True)
        written.append(folder / "ic_launcher_foreground.png")

    adaptive = RES / "mipmap-anydpi-v26"
    adaptive.mkdir(parents=True, exist_ok=True)
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (adaptive / name).write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@color/icon_background" />\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
            '</adaptive-icon>\n',
            encoding="utf-8",
        )
        written.append(adaptive / name)

    for path in written:
        print(path.relative_to(RES.parents[3]))


if __name__ == "__main__":
    main()
