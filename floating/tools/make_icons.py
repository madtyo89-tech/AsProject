#!/usr/bin/env python3
"""Buat ikon peluncur AsProject Floating tanpa pustaka pihak ketiga.

Ikon digambar langsung (kotak membulat gelap + cincin & empat titik emas) lalu ditulis
sebagai PNG memakai ``zlib``/``struct`` bawaan Python — jadi skrip ini bisa dijalankan di
mana saja tanpa ``sharp``/Pillow, berbeda dari ``android/tools/make_icons.mjs``.

Hasil (di floating/app/src/main/res/):
  mipmap-<kepadatan>/ic_launcher.png            48…192 px, kotak hitam membulat
  mipmap-<kepadatan>/ic_launcher_round.png      48…192 px, lingkaran hitam
  mipmap-<kepadatan>/ic_launcher_foreground.png 108…432 px, latar transparan (adaptive icon)

Cara pakai:
    python3 floating/tools/make_icons.py
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

RES = Path(__file__).resolve().parent.parent / "app" / "src" / "main" / "res"

INK = (10, 10, 10)          # #0A0A0A — sama dengan @color/brand_ink
GOLD = (212, 175, 55)       # #D4AF37 — sama dengan @color/brand_gold

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

SUPERSAMPLE = 3


# ------------------------------------------------------------------ bentuk (SDF)

def sdf_rounded_rect(x: float, y: float, half: float, radius: float) -> float:
    """Jarak bertanda ke persegi membulat berpusat di (0,0). Negatif = di dalam."""
    dx = abs(x) - (half - radius)
    dy = abs(y) - (half - radius)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    outside = math.hypot(ax, ay)
    inside = min(max(dx, dy), 0.0)
    return outside + inside - radius


def sdf_circle(x: float, y: float, radius: float) -> float:
    return math.hypot(x, y) - radius


def sdf_ring(x: float, y: float, radius: float, thickness: float) -> float:
    return abs(math.hypot(x, y) - radius) - thickness / 2.0


def glyph_sdf(x: float, y: float, scale: float) -> float:
    """Cincin + empat titik, dalam satuan ikon (0…1) lalu diskalakan."""
    best = sdf_ring(x, y, 0.30 * scale, 0.055 * scale)
    offset = 0.155 * scale
    dot = 0.052 * scale
    for sx in (-1, 1):
        for sy in (-1, 1):
            best = min(best, sdf_circle(x - sx * offset, y - sy * offset, dot))
    return best


# ------------------------------------------------------------------ render

def render(size: int, mode: str) -> bytes:
    """Kembalikan piksel RGBA (bytes) untuk satu ikon."""
    half = size / 2.0
    corner = 0.22 * size
    glyph_scale = size * (0.60 if mode == "foreground" else 1.0)
    step = 1.0 / SUPERSAMPLE
    pixels = bytearray(size * size * 4)

    for py in range(size):
        for px in range(size):
            r_sum = g_sum = b_sum = a_sum = 0.0
            for sy in range(SUPERSAMPLE):
                y = py + (sy + 0.5) * step - half
                for sx in range(SUPERSAMPLE):
                    x = px + (sx + 0.5) * step - half
                    color = None
                    if glyph_sdf(x, y, glyph_scale) < 0:
                        color = GOLD
                    elif mode == "square" and sdf_rounded_rect(x, y, half, corner) < 0:
                        color = INK
                    elif mode == "round" and sdf_circle(x, y, half) < 0:
                        color = INK
                    if color is not None:
                        r_sum += color[0]
                        g_sum += color[1]
                        b_sum += color[2]
                        a_sum += 1.0
            total = SUPERSAMPLE * SUPERSAMPLE
            alpha = a_sum / total
            index = (py * size + px) * 4
            if alpha <= 0:
                pixels[index:index + 4] = b"\x00\x00\x00\x00"
            else:
                pixels[index] = int(round(r_sum / a_sum))
                pixels[index + 1] = int(round(g_sum / a_sum))
                pixels[index + 2] = int(round(b_sum / a_sum))
                pixels[index + 3] = int(round(alpha * 255))
    return bytes(pixels)


def write_png(path: Path, size: int, pixels: bytes) -> None:
    stride = size * 4
    raw = bytearray()
    for y in range(size):
        raw.append(0)                                   # filter: None
        raw += pixels[y * stride:(y + 1) * stride]
    chunks = [b"IHDR" + struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0),
              b"IDAT" + zlib.compress(bytes(raw), 9),
              b"IEND"]
    out = bytearray(b"\x89PNG\r\n\x1a\n")
    for chunk in chunks:
        body = chunk
        out += struct.pack(">I", len(body) - 4)
        out += body
        out += struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(out))
    print(f"  {path.relative_to(RES.parent.parent.parent)}  ({size}×{size}, {path.stat().st_size} byte)")


def main() -> int:
    print("Membuat ikon AsProject Floating:")
    for density, size in LEGACY.items():
        write_png(RES / f"mipmap-{density}" / "ic_launcher.png", size, render(size, "square"))
        write_png(RES / f"mipmap-{density}" / "ic_launcher_round.png", size, render(size, "round"))
    for density, size in ADAPTIVE.items():
        write_png(RES / f"mipmap-{density}" / "ic_launcher_foreground.png", size,
                  render(size, "foreground"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
