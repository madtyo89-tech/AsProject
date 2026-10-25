#!/usr/bin/env python3
"""Buat pratinjau HTML mandiri (satu berkas) dari layout launcher + aset asli.

Pratinjau ini meniru perilaku aplikasi:
  • jam & tanggal berjalan real-time (JavaScript),
  • panel HUD layar kunci beranimasi (busur berputar, garis pindai, gelombang),
  • wallpaper liquid bergerak (lapisan geser + kilau melintas),
  • ikon neon untuk 8 aplikasi populer (aset asli) DAN contoh ikon neon otomatis
    untuk aplikasi lain — dibuat dengan algoritma yang sama seperti
    NeonIconFactory.java, hanya dijalankan di Python.

Keluaran: launcher/docs/pratinjau.html — tanpa berkas pendamping.

Cara pakai:
    python3 -m pip install --user pillow numpy
    python3 launcher/tools/make_preview.py
"""

from __future__ import annotations

import base64
import random
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                                   # launcher/
APP = ROOT / "app" / "src" / "main"
WALL = APP / "assets" / "wallpaper"
ICONS = APP / "res" / "drawable-nodpi"
OUT = ROOT / "docs" / "pratinjau.html"

NEON = ["phone", "message", "camera", "settings", "music", "chrome", "whatsapp", "instagram"]
GENERIC = [("play", "play", 2), ("maps", "pin", 0), ("gmail", "mail", 1), ("youtube", "tube", 3)]
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
S = 192


# --------------------------------------------------------------------- aset

def jpeg_b64(path: Path, width: int, quality: int = 80) -> str:
    image = Image.open(path).convert("RGB")
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def png_b64(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def placeholder_icon(kind: str, hue: int, size: int = S) -> Image.Image:
    """Ikon aplikasi tiruan: tile berwarna + glyph putih berbentuk nyata."""
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    color = {0: (66, 133, 244), 1: (234, 67, 53), 2: (52, 168, 83), 3: (251, 188, 5)}[hue % 4]
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=color + (255,))
    white = (255, 255, 255, 255)
    cx = cy = size / 2
    if kind == "play":                       # segitiga main
        r = size * 0.26
        draw.polygon([(cx - r * 0.55, cy - r), (cx - r * 0.55, cy + r), (cx + r, cy)], fill=white)
    elif kind == "pin":                      # penanda peta
        r = size * 0.15
        draw.ellipse([cx - r * 1.5, cy - r * 2.0, cx + r * 1.5, cy + r * 1.0], fill=white)
        draw.polygon([(cx - r * 1.3, cy + r * 0.4), (cx + r * 1.3, cy + r * 0.4),
                      (cx, cy + r * 2.1)], fill=white)
    elif kind == "mail":                     # amplop
        w, h = size * 0.56, size * 0.38
        draw.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
                               radius=int(size * 0.04), fill=white)
        draw.polygon([(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx, cy + h * 0.12)],
                     fill=(66, 133, 244, 255))
    elif kind == "tube":                     # layar + tombol main
        w, h = size * 0.60, size * 0.42
        draw.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
                               radius=int(size * 0.10), fill=white)
        r = size * 0.13
        draw.polygon([(cx - r * 0.5, cy - r * 0.62), (cx - r * 0.5, cy + r * 0.62),
                      (cx + r * 0.85, cy)], fill=(229, 57, 53, 255))
    else:                                    # huruf cadangan
        font = ImageFont.truetype(FONT_BOLD, int(size * 0.52))
        left, top, right, bottom = draw.textbbox((0, 0), kind, font=font)
        draw.text(((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top),
                  kind, font=font, fill=white)
    return image


def mask_of(icon: Image.Image, size: int = S, inset: float = 0.07,
            keep: float = 0.30) -> np.ndarray:
    """Peta intensitas glyph — salinan glyphMask() di NeonIconFactory.java.

    Median terang = warna latar; selisih mutlak terhadapnya = bagian yang
    menonjol (glyph). Tepi luar dibuang agar potongan ikon tidak memunculkan
    cincin palsu, lalu hanya 30% piksel paling menonjol yang dipertahankan.
    """
    pixels = np.asarray(icon.convert("RGBA")).astype(np.float32)
    alpha = pixels[..., 3] / 255.0
    luminance = (0.299 * pixels[..., 0] + 0.587 * pixels[..., 1] + 0.114 * pixels[..., 2]) * alpha

    background = float(np.median(luminance))
    delta = np.abs(luminance - background)

    band = round(size * inset)
    ring = np.ones((size, size), bool)
    ring[band:size - band, band:size - band] = False
    delta[ring] = 0.0

    peak = float(delta.max())
    if peak < 5.0:
        return alpha.copy()

    # Ambang berdasar fraksi puncak (BUKAN persentil): glyph yang warnanya rata
    # punya delta seragam, dan ambang persentil justru menghapus seluruh isinya.
    low, high = peak * 0.18, peak * 0.92
    if float((delta > low).mean()) > 0.5:      # ikon bidang-warna-penuh
        low, high = peak * 0.45, peak * 0.97
    t = np.clip((delta - low) / max(1e-6, high - low), 0, 1)
    mask = t * t * (3 - 2 * t)
    mask[ring] = 0.0
    return mask


def outline_of(mask: np.ndarray, size: int = S) -> np.ndarray:
    """Garis luar glyph — inti gaya neon sirkuit (berongga, bukan siluet)."""
    left = np.roll(mask, 1, axis=1); left[:, 0] = 0
    right = np.roll(mask, -1, axis=1); right[:, -1] = 0
    up = np.roll(mask, 1, axis=0); up[0, :] = 0
    down = np.roll(mask, -1, axis=0); down[-1, :] = 0
    low = np.minimum.reduce([mask, left, right, up, down])
    edge = np.where(mask > 0.12, np.clip((mask - low) * 1.6, 0, 1), 0)
    # Bentuk akhir = garis luar terang + ISI glyph menyala setengah. Tanpa isi,
    # ikon 48 dp tampak "polos" karena yang tersisa hanya garis 1 piksel.
    if int((edge > 0.05).sum()) < max(16, size * 0.4):
        return np.maximum(mask * 0.6, np.sqrt(edge))
    return np.maximum(np.sqrt(edge), mask * 0.5)


def liquid_glass(size: int = S) -> Image.Image:
    """Kaca cair dasar: gradien gelap + sapuan diagonal + sorotan atas + kilau bawah."""
    glass = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(glass)
    for y in range(size):
        f = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=(int(0x10 + (0x04 - 0x10) * f),
                                             int(0x18 + (0x07 - 0x18) * f),
                                             int(0x20 + (0x0B - 0x20) * f), 255))
    tile_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                                radius=int(size * 0.235), fill=255)
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(glass, (0, 0), tile_mask)

    yy, xx = np.mgrid[0:size, 0:size]

    def layer(builder):
        lay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        builder(lay)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(lay, (0, 0), tile_mask)
        return out

    def sweep(lay):
        d = ImageDraw.Draw(lay)
        for i in range(size):
            t = i / (size - 1)
            a = int(255 * max(0.0, 0.20 * (1 - t / 0.8)))
            d.line([(i, 0), (0, i)], fill=(191, 233, 255, max(0, a)))

    def top_glow(lay):
        arr = np.zeros((size, size, 4), np.uint8)
        dist = np.sqrt(((xx - size * 0.5) / (size * 0.85)) ** 2
                       + ((yy + size * 0.12) / (size * 0.85)) ** 2)
        arr[..., 3] = np.clip((1 - dist) * 255 * 0.26, 0, 255).astype(np.uint8)
        arr[..., 0] = 232; arr[..., 1] = 251; arr[..., 2] = 255
        lay.paste(Image.fromarray(arr, "RGBA"), (0, 0))

    def bottom_glow(lay):
        arr = np.zeros((size, size, 4), np.uint8)
        dist = np.sqrt(((xx - size * 0.92) / (size * 0.60)) ** 2
                       + ((yy - size * 1.02) / (size * 0.60)) ** 2)
        arr[..., 3] = np.clip((1 - dist) * 255 * 0.16, 0, 255).astype(np.uint8)
        arr[..., 0] = 88; arr[..., 1] = 180; arr[..., 2] = 232
        lay.paste(Image.fromarray(arr, "RGBA"), (0, 0))

    for builder in (sweep, top_glow, bottom_glow):
        tile = Image.alpha_composite(tile, layer(builder))
    return tile, tile_mask


def circuit_traces(size: int, seed: int, inside: bool) -> Image.Image:
    """Jejak sirkuit acak-tertentu; inside=True menempel di latar, False di tepi."""
    lay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    rnd = random.Random(seed)
    count = 4 if inside else 3
    for _ in range(count):
        if inside:
            horizontal = rnd.random() > 0.5
            lane = size * (0.18 + 0.64 * rnd.random())
            span = size * (0.22 + 0.30 * rnd.random())
            center = size * (0.30 + 0.40 * rnd.random())
            if horizontal:
                pts = [(center - span, lane), (center, lane), (center, lane + span * 0.55)]
                x, y = pts[-1]
            else:
                pts = [(lane, center - span), (lane, center), (lane + span * 0.55, center)]
                x, y = pts[-1]
            d.line(pts, fill=(160, 225, 255, 102), width=max(1, round(size * 0.006)))
            r = max(1.0, size * 0.009)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 240, 255, 170))
        else:
            horizontal = rnd.random() > 0.5
            start = size * (0.06 + 0.88 * rnd.random())
            lane = size * (0.10 + 0.80 * rnd.random())
            length = size * (0.10 + 0.16 * rnd.random()) * (1 if rnd.random() > 0.5 else -1)
            if horizontal:
                y = lane
                x = size * 0.04 if start < size * 0.5 else size * 0.96
                pts = [(x, y), (x + length, y)]
                x += length
                drop = size * 0.10 * (1 if rnd.random() > 0.5 else -1)
                pts.append((x, y + drop))
                y += drop
            else:
                x = lane
                y = size * 0.04 if start < size * 0.5 else size * 0.96
                pts = [(x, y), (x, y + length)]
                y += length
                shift = size * 0.10 * (1 if rnd.random() > 0.5 else -1)
                pts.append((x + shift, y))
                x += shift
            d.line(pts, fill=(169, 232, 255, 90), width=max(1, round(size * 0.011)), joint="curve")
            r = max(1.0, size * 0.013)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(191, 239, 255, 190))
    return lay


def neonize(icon: Image.Image, size: int = S, seed: int = 7) -> Image.Image:
    """Salinan algoritma NeonIconFactory.java: kaca cair + jejak sirkuit + neon."""
    if icon.size != (size, size):
        icon = icon.resize((size, size), Image.LANCZOS)
    mask = mask_of(icon, size)
    outline = outline_of(mask, size)

    tile, tile_mask = liquid_glass(size)

    # 1. jejak sirkuit latar
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg.paste(circuit_traces(size, seed, inside=False), (0, 0), tile_mask)
    tile = Image.alpha_composite(tile, bg)

    # 2. jejak sirkuit di dalam bentuk ikon
    solid = Image.fromarray(((mask > 0.43) * 255).astype(np.uint8), "L")
    inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner.paste(circuit_traces(size, seed + 1, inside=True), (0, 0), solid)
    tile = Image.alpha_composite(tile, inner)

    # 3. neon tiga lapis (inti digambar dua kali agar terang di ukuran kecil)
    source = Image.fromarray((np.clip(outline, 0, 1) * 255).astype(np.uint8), "L")
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for blur, color, amount in ((size * 0.055, (95, 207, 255), 0.40),
                                (size * 0.022, (95, 207, 255), 0.78),
                                (size * 0.007, (234, 251, 255), 1.00),
                                (size * 0.007, (234, 251, 255), 1.00)):
        blurred = source.filter(ImageFilter.GaussianBlur(blur))
        layer = Image.new("RGBA", (size, size), color + (0,))
        layer.putalpha(blurred.point(lambda v: int(v * amount)))
        glow = Image.alpha_composite(glow, layer)

    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(glow, (0, 0), tile_mask)
    out = Image.alpha_composite(tile, clipped)

    rim = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle([1, 1, size - 2, size - 2],
                                          radius=int(size * 0.235),
                                          outline=(185, 236, 255, 140), width=2)
    return Image.alpha_composite(out, rim)


# --------------------------------------------------------------------- html

def build() -> None:
    lock = jpeg_b64(WALL / "lock.jpg", 430, 82)
    home = jpeg_b64(WALL / "home.jpg", 430, 82)

    classes = []
    for name in NEON:
        classes.append(f".ic-{name}{{background-image:url(\"{png_b64(Image.open(ICONS / f'ic_{name}.png').convert('RGBA').resize((112, 112), Image.LANCZOS))}\")}}")
    for index, (name, kind, hue) in enumerate(GENERIC):
        classes.append(f".ic-gen-{name}{{background-image:url(\"{png_b64(neonize(placeholder_icon(kind, hue), seed=31 + index * 5).resize((112, 112), Image.LANCZOS))}\")}}")

    html = (TEMPLATE
            .replace("__LOCK__", lock)
            .replace("__HOME__", home)
            .replace("__ICON_CSS__", "\n".join(classes)))
    OUT.write_text(html, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT.parent)} — {OUT.stat().st_size / 1024:.0f} KB")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pratinjau — AsProject Launcher</title>
<style>
  @font-face{font-family:'TechMono';font-display:swap;
    src:url("data:font/woff2;base64,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") format('woff2')}
  :root{
    --dp:.876px;
    --ink:#0A0A0A; --gold:#D4AF37; --gold-soft:#F0DCA0;
    --neon:#7FD8FF; --neon-soft:#B3E8FF; --neon-dim:#4FA8D8;
    --text:#fff;
    --lock:url("__LOCK__");
    --home:url("__HOME__");
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{
    margin:0;min-height:100vh;padding:26px 16px 56px;
    background:#0b0b0d radial-gradient(70% 45% at 50% 0%,#0f1b26 0%,#0b0b0d 72%);
    color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    display:flex;flex-direction:column;align-items:center;gap:18px;
  }
  header{text-align:center;max-width:700px}
  h1{margin:0 0 8px;font-size:18px;font-weight:600}
  h1 span{color:var(--neon)}
  p.note{margin:0;font-size:12.5px;line-height:1.65;color:#8f9aa3}
  .stage{display:flex;gap:36px;flex-wrap:wrap;justify-content:center;align-items:flex-start;margin-top:8px}
  .col{display:flex;flex-direction:column;align-items:center}
  .caption{margin-top:12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7d8890}
  .hint{margin-top:5px;font-size:11px;color:#5f6a72;max-width:340px;text-align:center;line-height:1.55}

  .phone{position:relative;width:360px;height:780px;border-radius:34px;overflow:hidden;
    box-shadow:0 28px 70px rgba(0,0,0,.75),0 0 0 7px #0a0a0b,0 0 0 8px #24262a;background:#05080c}
  .statusbar{position:absolute;left:0;right:0;top:0;height:calc(var(--dp)*26);z-index:8;
    display:flex;align-items:center;justify-content:space-between;padding:0 calc(var(--dp)*16);
    font-size:calc(var(--dp)*11);color:#e9eef2;opacity:.9}
  .statusbar .right{display:flex;align-items:center;gap:calc(var(--dp)*4)}
  .sig{font-size:calc(var(--dp)*8.5);opacity:.85}
  .bars{display:flex;align-items:flex-end;gap:1.5px;height:calc(var(--dp)*9)}
  .bars i{width:2.5px;background:#e9eef2;border-radius:1px}
  .batt{width:calc(var(--dp)*17);height:calc(var(--dp)*8.5);border:1px solid #e9eef2;border-radius:2px;position:relative}
  .batt::before{content:"";position:absolute;inset:1px;width:72%;background:#e9eef2;border-radius:1px}

  /* ------------------------------------------------ wallpaper liquid bergerak */
  .liquid{position:absolute;inset:-6%;background-repeat:no-repeat;background-position:center;
    background-size:cover;animation:drift 26s ease-in-out infinite alternate}
  .liquid::after{content:"";position:absolute;inset:0;
    background:linear-gradient(105deg,transparent 30%,rgba(191,233,255,.22) 47%,transparent 62%);
    background-size:260% 100%;animation:sheen 13s linear infinite}
  @keyframes drift{
    0%{transform:scale(1.06) translate3d(-1.2%,-0.8%,0) rotate(-.5deg)}
    50%{transform:scale(1.1) translate3d(1%,0.6%,0) rotate(.35deg)}
    100%{transform:scale(1.06) translate3d(1.4%,1%,0) rotate(-.2deg)}
  }
  @keyframes sheen{0%{background-position:-140% 0}100%{background-position:240% 0}}
  .lock .liquid{background-image:var(--home)}
  .home .liquid{background-image:var(--home)}
  .lock .veil,.home .veil{position:absolute;inset:0}

  /* ------------------------------------------------- sirkuit & laci (baru) */
  .circuit{position:absolute;inset:0;width:100%;height:100%;display:block}
  .slidebar{width:100%;height:calc(var(--dp)*30);display:block;margin-top:calc(var(--dp)*2)}
  .dimmed{transform:scale(.9);opacity:.5;transform-origin:50% 42%}
  .drawer{position:absolute;inset:0;z-index:7}
  .drawer .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.72) 100%)}
  .drawerpanel{position:absolute;left:0;right:0;bottom:0;top:calc(var(--dp)*46);
    display:flex;flex-direction:column;padding:0 calc(var(--dp)*10);
    background:linear-gradient(180deg,rgba(36,48,51,.92) 0%,rgba(10,16,24,.98) 22%);
    border-top-left-radius:calc(var(--dp)*26);border-top-right-radius:calc(var(--dp)*26);
    border:1px solid rgba(191,239,255,.32);border-bottom:0}
  .drawerpanel .grid{margin-top:calc(var(--dp)*8)}
  /* ------------------------------------------------------------- layar kunci */
  .lock{position:absolute;inset:0;z-index:5}
  .lock .veil{background:linear-gradient(180deg,rgba(0,0,0,.58) 0%,rgba(0,0,0,.22) 26%,rgba(0,0,0,.4) 66%,rgba(0,0,0,.78) 100%)}
  .lockcontent{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
    padding:calc(var(--dp)*40) calc(var(--dp)*26) calc(var(--dp)*160)}
  .chips{display:flex;justify-content:space-between;width:100%}
  .chip{font-family:ui-monospace,Menlo,monospace;font-size:calc(var(--dp)*9);letter-spacing:.08em;
    color:var(--neon-soft);padding:calc(var(--dp)*5) calc(var(--dp)*10);border-radius:calc(var(--dp)*13);
    border:1px solid rgba(191,239,255,.6);
    background:linear-gradient(180deg,rgba(36,48,51,.60) 0%,rgba(4,7,11,.60) 100%);
    box-shadow:inset 0 calc(var(--dp)*1) 0 rgba(232,251,255,.28),
               0 0 calc(var(--dp)*8) rgba(127,216,255,.18);
    text-shadow:0 0 calc(var(--dp)*6) rgba(127,216,255,.45)}
  /* meter baterai liquid glass, pojok kanan atas */
  .batt{position:relative;width:calc(var(--dp)*30);height:calc(var(--dp)*30);flex:0 0 auto}
  .batt canvas{width:100%;height:100%;display:block}
  .brand{margin-top:calc(var(--dp)*30);font-family:ui-monospace,Menlo,monospace;
    font-size:calc(var(--dp)*10);letter-spacing:.42em;color:var(--neon-dim);text-indent:.42em}
  .lock .clock{margin-top:calc(var(--dp)*4);height:calc(var(--dp)*72);width:calc(var(--dp)*226);
    display:block}
  .lock .date{margin-top:calc(var(--dp)*10);font-size:calc(var(--dp)*13);letter-spacing:.06em;color:var(--neon-soft)}
  .grow{flex:1}
  .unlockhint{font-family:ui-monospace,Menlo,monospace;font-size:calc(var(--dp)*11);
    letter-spacing:.14em;color:rgba(255,255,255,.72)}
  .arrow{margin-top:calc(var(--dp)*6);width:calc(var(--dp)*18);height:calc(var(--dp)*18);
    animation:bob 1.8s ease-in-out infinite}
  .arrow svg{width:100%;height:100%;fill:var(--neon)}
  @keyframes bob{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}

  /* ------------------------------------------------------------------- HUD */
  .hud{position:absolute;left:calc(var(--dp)*10);right:calc(var(--dp)*10);
    bottom:calc(var(--dp)*18);height:calc(var(--dp)*132);z-index:6;border-radius:calc(var(--dp)*9);
    background:linear-gradient(180deg,rgba(19,27,37,.97) 0%,rgba(4,7,11,.97) 100%);
    border:1px solid rgba(191,239,255,.55);overflow:hidden;
    box-shadow:inset 0 calc(var(--dp)*1) 0 rgba(232,251,255,.18);
    font-family:ui-monospace,Menlo,monospace}
  .hud::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(105deg,transparent 38%,rgba(143,212,255,.10) 50%,transparent 62%);
    background-size:220% 100%;animation:glassweep 7s linear infinite}
  @keyframes glassweep{0%{background-position:120% 0}100%{background-position:-120% 0}}
  .hud .hairline{position:absolute;left:calc(var(--dp)*8);right:calc(var(--dp)*8);top:calc(var(--dp)*20);
    height:1px;background:rgba(168,230,255,.2)}
  .hud .scan{position:absolute;top:calc(var(--dp)*2);bottom:calc(var(--dp)*2);width:calc(var(--dp)*68);
    background:linear-gradient(90deg,transparent,rgba(127,216,255,.20),transparent);
    animation:scan 6.5s ease-in-out infinite alternate}
  @keyframes scan{0%{left:2%}100%{left:80%}}
  .hud .corner{position:absolute;width:calc(var(--dp)*12);height:calc(var(--dp)*12);
    border:calc(var(--dp)*1.6) solid rgba(127,216,255,.8)}
  .hud .c1{left:0;top:0;border-right:0;border-bottom:0}
  .hud .c2{right:0;top:0;border-left:0;border-bottom:0}
  .hud .c3{left:0;bottom:0;border-right:0;border-top:0}
  .hud .c4{right:0;bottom:0;border-left:0;border-top:0}
  .hud .left{position:absolute;left:calc(var(--dp)*12);top:calc(var(--dp)*30);
    font-size:calc(var(--dp)*7.8);line-height:calc(var(--dp)*15);color:#A8C7D8}
  .hud .left b{color:var(--neon-soft);font-weight:400}
  .hud .right{position:absolute;right:calc(var(--dp)*12);top:calc(var(--dp)*30);text-align:right;
    font-size:calc(var(--dp)*7.8);line-height:calc(var(--dp)*15);color:#A8C7D8}
  .hud .right b{display:block;margin-top:calc(var(--dp)*-5);color:var(--neon-soft);font-weight:400}
  .hud .dot{display:inline-block;width:calc(var(--dp)*5);height:calc(var(--dp)*5);border-radius:50%;
    background:var(--neon);margin-left:calc(var(--dp)*4);animation:blink 2s steps(1) infinite;vertical-align:middle}
  @keyframes blink{50%{opacity:.25}}
  .hud .cells{display:flex;gap:calc(var(--dp)*2);margin-top:calc(var(--dp)*4)}
  .hud .cells i{width:calc(var(--dp)*7);height:calc(var(--dp)*5);background:rgba(127,216,255,.75)}
  .hud .cells i.off{background:rgba(128,160,176,.22)}
  .gauge{position:absolute;left:50%;top:calc(var(--dp)*62);transform:translate(-50%,-50%);
    width:calc(var(--dp)*68);height:calc(var(--dp)*68);border-radius:50%;
    border:calc(var(--dp)*1.2) solid rgba(111,168,192,.22)}
  .gauge .inner{position:absolute;inset:calc(var(--dp)*7);border-radius:50%;
    border:calc(var(--dp)*1.4) solid rgba(127,216,255,.32)}
  .gauge .arc{position:absolute;inset:0;border-radius:50%;animation:spin 4.6s linear infinite;
    background:conic-gradient(from 0deg,rgba(127,216,255,.9) 0 14%,transparent 14% 100%);
    -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));
            mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px))}
  .gauge .arc2{position:absolute;inset:calc(var(--dp)*7);border-radius:50%;animation:spin 6.2s linear infinite reverse;
    background:conic-gradient(from 0deg,rgba(79,168,216,.75) 0 9%,transparent 9% 100%);
    -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));
            mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px))}
  @keyframes spin{to{transform:rotate(360deg)}}
  .gauge .orbit{position:absolute;inset:0;animation:spin 4.6s linear infinite}
  .gauge .orbit i{position:absolute;left:50%;top:0;transform:translate(-50%,-50%);
    width:calc(var(--dp)*4.4);height:calc(var(--dp)*4.4);border-radius:50%;background:var(--neon-soft);
    box-shadow:0 0 calc(var(--dp)*8) rgba(127,216,255,.9)}
  .gauge .clocktext{position:absolute;inset:0;display:grid;place-items:center;
    font-size:calc(var(--dp)*19);font-weight:700;color:#E9FBFF;letter-spacing:.02em}
  .gauge .sub{position:absolute;left:0;right:0;top:calc(50% + var(--dp)*11);text-align:center;
    font-size:calc(var(--dp)*6.6);letter-spacing:.12em;color:#A8C7D8}
  .gauge .sub2{position:absolute;left:0;right:0;top:calc(50% + var(--dp)*20);text-align:center;
    font-size:calc(var(--dp)*7.4);color:var(--neon-soft)}
  .wave{position:absolute;left:calc(var(--dp)*12);right:calc(var(--dp)*12);bottom:calc(var(--dp)*8);
    height:calc(var(--dp)*14);display:flex;align-items:flex-end;gap:calc(var(--dp)*3)}
  .wave i{flex:1;background:rgba(127,216,255,.55);animation:wv 1.1s ease-in-out infinite alternate}
  .wave i:nth-child(3n){background:rgba(127,216,255,.9)}
  @keyframes wv{from{height:14%}to{height:92%}}

  /* ----------------------------------------------------------------- beranda */
  .home{position:absolute;inset:0;z-index:2}
  .home .veil{background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.16) 28%,rgba(0,0,0,.26) 62%,rgba(0,0,0,.7) 100%)}
  .homecontent{position:absolute;inset:0;display:flex;flex-direction:column;
    padding:calc(var(--dp)*42) calc(var(--dp)*16) calc(var(--dp)*12)}
  .head{position:relative;text-align:center;padding-top:calc(var(--dp)*34)}
  .home .clock{height:calc(var(--dp)*64);width:calc(var(--dp)*201);display:block;margin:0 auto}
  .home .date{margin-top:calc(var(--dp)*6);font-size:calc(var(--dp)*14);letter-spacing:.04em;color:#dff2ff}
  .gear{position:absolute;right:0;top:calc(var(--dp)*-6);width:calc(var(--dp)*44);
    height:calc(var(--dp)*44);display:grid;place-items:center;opacity:.7}
  .gear svg{width:calc(var(--dp)*20);height:calc(var(--dp)*20);fill:#dfe7ec}
  .search{margin-top:calc(var(--dp)*18);height:calc(var(--dp)*52);border-radius:calc(var(--dp)*26);
    background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.14);
    display:flex;align-items:center;gap:calc(var(--dp)*12);padding:0 calc(var(--dp)*16)}
  .search svg{width:calc(var(--dp)*20);height:calc(var(--dp)*20);fill:rgba(255,255,255,.72)}
  .search span{font-size:calc(var(--dp)*16);color:rgba(255,255,255,.55)}
  .grid{margin-top:calc(var(--dp)*14);display:grid;grid-template-columns:repeat(4,1fr);gap:calc(var(--dp)*14) 0}
  .app{display:flex;flex-direction:column;align-items:center;gap:calc(var(--dp)*7)}
  .ico{width:calc(var(--dp)*52);height:calc(var(--dp)*52);border-radius:calc(var(--dp)*13);
    background-size:cover;background-position:center}
  .app span{font-size:calc(var(--dp)*11);color:#f2f6f8;max-width:calc(var(--dp)*76);overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap;text-shadow:0 calc(var(--dp)*1) calc(var(--dp)*6) rgba(0,0,0,.9)}
  .dockwrap{flex:1;display:flex;align-items:flex-end}
  .dock{width:100%;height:calc(var(--dp)*76);border-radius:calc(var(--dp)*26);
    background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.12);
    display:flex;align-items:center;justify-content:space-around;padding:0 calc(var(--dp)*6)}
  .dock .ico{width:calc(var(--dp)*54);height:calc(var(--dp)*54);border-radius:calc(var(--dp)*14)}
  .navbar{height:calc(var(--dp)*22);display:flex;align-items:center;justify-content:center;
    gap:calc(var(--dp)*54);opacity:.55}
  .navbar i{display:block;width:calc(var(--dp)*13);height:calc(var(--dp)*13)}
  .navbar i.tri{width:0;height:0;border:calc(var(--dp)*7) solid transparent;border-bottom-color:#fff;opacity:.9}
  .navbar i.cir{border:1.6px solid #fff;border-radius:50%}
  .navbar i.sq{border:1.6px solid #fff;border-radius:calc(var(--dp)*3)}

  /* --------------------------------------------------------------- pengaturan */
  .settings{position:absolute;inset:0;z-index:3;background:var(--ink);display:flex;flex-direction:column}
  .settings .top{display:flex;align-items:center;gap:calc(var(--dp)*8);
    padding:calc(var(--dp)*40) calc(var(--dp)*16) calc(var(--dp)*4)}
  .settings .top svg{width:calc(var(--dp)*20);height:calc(var(--dp)*20);fill:var(--gold-soft)}
  .settings .top b{font-size:calc(var(--dp)*19);font-weight:600}
  .settings .body{padding:0 calc(var(--dp)*22);overflow:hidden}
  .label{font-size:calc(var(--dp)*10.5);letter-spacing:.16em;text-transform:uppercase;color:var(--gold);
    font-weight:600;margin:calc(var(--dp)*18) 0 calc(var(--dp)*5)}
  .row{display:flex;justify-content:space-between;align-items:center;padding:calc(var(--dp)*10) 0;
    font-size:calc(var(--dp)*14)}
  .sw{width:calc(var(--dp)*42);height:calc(var(--dp)*24);border-radius:calc(var(--dp)*12);
    background:#3a3a3a;position:relative;flex:0 0 auto}
  .sw.on{background:rgba(127,216,255,.3);border:1px solid rgba(127,216,255,.55)}
  .sw::after{content:"";position:absolute;top:calc(var(--dp)*3);left:calc(var(--dp)*3);
    width:calc(var(--dp)*18);height:calc(var(--dp)*18);border-radius:50%;background:#c9c9c9}
  .sw.on::after{left:auto;right:calc(var(--dp)*3);background:var(--neon)}
  .thumbs{display:flex;gap:calc(var(--dp)*10);padding:calc(var(--dp)*4) 0}
  .thumbs div{flex:1;height:calc(var(--dp)*118);border-radius:calc(var(--dp)*14);
    border:1px solid rgba(212,175,55,.25);background-position:center;background-size:cover}
  .small{font-size:calc(var(--dp)*11);color:#9aa4ab;line-height:1.55;padding-top:calc(var(--dp)*4)}

__ICON_CSS__

  @media (max-width:880px){ .phone{transform:scale(.92);transform-origin:top center;margin-bottom:-60px} }
</style>
</head>
<body>
  <header>
    <h1>Pratinjau <span>AsProject Launcher</span></h1>
    <p class="note">Jam, tanggal, HUD, dan gerakan liquid di halaman ini <strong>hidup</strong> (JavaScript/CSS).
      Di APK, gerakan liquid memakai mesh 3D (Canvas <code>drawBitmapMesh</code> + <code>Camera</code>) dan HUD digambar
      di Canvas 60 fps. Kotak neon abu-abu = contoh ikon otomatis untuk aplikasi lain; di ponsel ikon itu dibuat dari
      ikon asli tiap aplikasi.</p>
  </header>

  <div class="stage">
    <!-- ---------------------------------------------------------- layar kunci -->
    <div class="col">
      <div class="phone">
        <div class="statusbar"><span id="sbLock">00:00</span>
          <span class="right"><span class="sig">4G</span>
            <span class="bars"><i style="height:3px"></i><i style="height:5px"></i><i style="height:7px"></i><i style="height:9px"></i></span>
            <span class="batt"></span></span></div>
        <div class="lock">
          <canvas class="circuit" id="lockCircuit" width="360" height="780"></canvas>
          <div class="veil"></div>
          <div class="lockcontent">
            <div class="chips">
              <span class="chip">SISTEM AKTIF</span>
              <span class="batt"><canvas id="battMeter" width="120" height="120"></canvas></span>
            </div>
            <div class="brand">ASPROJECT SECURE</div>
            <canvas class="clock" id="clockLock" width="452" height="144"></canvas>
            <div class="date" data-date>—</div>
            <div class="grow"></div>
            <div class="arrow"><svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></div>
            <div class="unlockhint">GESER KE ATAS UNTUK MEMBUKA</div>
          </div>

          <div class="hud">
            <div class="scan"></div>
            <div class="corner c1"></div><div class="corner c2"></div>
            <div class="corner c3"></div><div class="corner c4"></div>
            <div class="hairline"></div>
            <div class="left">
              SYS STATUS <b>ONLINE</b><span class="dot"></span><br>
              BIO-LOCK <b>ARMED</b><br>
              POWER <b>74%</b>
              <div class="cells"><i></i><i></i><i></i><i></i><i></i><i class="off"></i></div>
            </div>
            <div class="right">
              TEMP <b>22.4&deg;C</b>
              SIGNAL <b>LINK OK</b>
              INTEGR <b>98.2%</b>
            </div>
            <div class="gauge">
              <div class="arc"></div><div class="arc2"></div>
              <div class="orbit"><i></i></div>
              <div class="clocktext" data-clock data-size="hud">00:00</div>
              <div class="sub">SECURE LINK</div>
              <div class="sub2">EST 0.23 ms</div>
            </div>
            <div class="wave">
              <i style="animation-delay:0s"></i><i style="animation-delay:.09s"></i><i style="animation-delay:.18s"></i>
              <i style="animation-delay:.27s"></i><i style="animation-delay:.36s"></i><i style="animation-delay:.45s"></i>
              <i style="animation-delay:.54s"></i><i style="animation-delay:.63s"></i><i style="animation-delay:.72s"></i>
              <i style="animation-delay:.81s"></i><i style="animation-delay:.9s"></i><i style="animation-delay:.99s"></i>
              <i style="animation-delay:1.08s"></i><i style="animation-delay:1.17s"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="caption">Layar kunci + HUD live</div>
      <div class="hint">Pojok kanan atas: meter baterai <strong>liquid glass</strong> dengan cairan
        neon beriak. HUD menampilkan jam (detik berjalan), baterai, dan suhu baterai asli perangkat.</div>
    </div>

    <!-- -------------------------------------------------------------- beranda -->
    <div class="col">
      <div class="phone">
        <div class="statusbar"><span id="sbHome">00:00</span>
          <span class="right"><span class="sig">4G</span>
            <span class="bars"><i style="height:3px"></i><i style="height:5px"></i><i style="height:7px"></i><i style="height:9px"></i></span>
            <span class="batt"></span></span></div>
        <div class="home">
          <div class="liquid"></div>
          <div class="veil"></div>
          <div class="homecontent">
            <div class="head">
              <canvas class="clock" id="clockHome" width="452" height="144"></canvas>
              <div class="date" data-date>—</div>
              <div class="gear"><svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 13.92 2.4h-3.84a.49.49 0 0 0-.47.41L9.25 5.35c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg></div>
            </div>
            <div class="search">
              <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
              <span>Cari aplikasi</span>
            </div>
            <div class="grid">
              <div class="app"><div class="ico ic-whatsapp"></div><span>WhatsApp</span></div>
              <div class="app"><div class="ico ic-instagram"></div><span>Instagram</span></div>
              <div class="app"><div class="ico ic-music"></div><span>Musik</span></div>
              <div class="app"><div class="ico ic-settings"></div><span>Setelan</span></div>
              <div class="app"><div class="ico ic-camera"></div><span>Kamera</span></div>
              <div class="app"><div class="ico ic-chrome"></div><span>Chrome</span></div>
              <div class="app"><div class="ico ic-gen-play"></div><span>Play Store</span></div>
              <div class="app"><div class="ico ic-gen-maps"></div><span>Maps</span></div>
              <div class="app"><div class="ico ic-gen-gmail"></div><span>Gmail</span></div>
              <div class="app"><div class="ico ic-gen-youtube"></div><span>YouTube</span></div>
              <div class="app"><div class="ico ic-message"></div><span>Pesan</span></div>
              <div class="app"><div class="ico ic-phone"></div><span>Telepon</span></div>
            </div>
            <div class="dockwrap">
              <div class="dock">
                <div class="ico ic-phone"></div><div class="ico ic-message"></div>
                <div class="ico ic-chrome"></div><div class="ico ic-camera"></div>
                <div class="ico ic-gen-play"></div>
              </div>
            </div>
            <canvas class="slidebar" id="homeSlideBar" width="720" height="72"></canvas>
            <div class="navbar"><i class="tri"></i><i class="cir"></i><i class="sq"></i></div>
          </div>
        </div>
      </div>
      <div class="caption">Beranda — semua ikon neon</div>
      <div class="hint">Ikon generik (Play Store, Maps, Gmail, YouTube) memakai versi neon otomatis dari ikon aslinya.</div>
    </div>

    <!-- -------------------------------------------------------------- laci -->
    <div class="col">
      <div class="phone">
        <div class="home">
          <div class="liquid"></div>
          <div class="veil"></div>
          <div class="homecontent dimmed">
            <div class="head">
              <canvas class="clock" id="clockDrawer" width="452" height="144"></canvas>
              <div class="date" data-date>—</div>
            </div>
            <div class="grid">
              <div class="app"><div class="ico ic-whatsapp"></div><span>WhatsApp</span></div>
              <div class="app"><div class="ico ic-instagram"></div><span>Instagram</span></div>
              <div class="app"><div class="ico ic-camera"></div><span>Kamera</span></div>
              <div class="app"><div class="ico ic-chrome"></div><span>Chrome</span></div>
            </div>
          </div>
          <div class="drawer">
            <div class="scrim"></div>
            <div class="drawerpanel">
              <canvas class="slidebar" id="drawerHandle" width="720" height="72"></canvas>
              <div class="search">
                <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
                <span>Cari semua aplikasi</span>
              </div>
              <div class="grid">
                <div class="app"><div class="ico ic-phone"></div><span>Telepon</span></div>
                <div class="app"><div class="ico ic-message"></div><span>Pesan</span></div>
                <div class="app"><div class="ico ic-camera"></div><span>Kamera</span></div>
                <div class="app"><div class="ico ic-settings"></div><span>Setelan</span></div>
                <div class="app"><div class="ico ic-music"></div><span>Musik</span></div>
                <div class="app"><div class="ico ic-chrome"></div><span>Chrome</span></div>
                <div class="app"><div class="ico ic-whatsapp"></div><span>WhatsApp</span></div>
                <div class="app"><div class="ico ic-instagram"></div><span>Instagram</span></div>
                <div class="app"><div class="ico ic-gen-play"></div><span>Play Store</span></div>
                <div class="app"><div class="ico ic-gen-maps"></div><span>Maps</span></div>
                <div class="app"><div class="ico ic-gen-gmail"></div><span>Gmail</span></div>
                <div class="app"><div class="ico ic-gen-youtube"></div><span>YouTube</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="caption">Laci aplikasi — liquid slide bar</div>
      <div class="hint">Geser ke atas di beranda untuk membuka laci. Tepi atasnya beriak
        seperti cairan, dan beranda menyusut + memudar mengikuti gerakan laci.</div>
    </div>

    <!-- ----------------------------------------------------------- pengaturan -->
    <div class="col">
      <div class="phone">
        <div class="settings">
          <div class="top">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"/></svg>
            <b>Pengaturan beranda</b>
          </div>
          <div class="body">
            <div class="label">Wallpaper</div>
            <div class="thumbs">
              <div style="background-image:var(--lock)"></div>
              <div style="background-image:var(--home)"></div>
            </div>
            <div class="row"><span>Pakai wallpaper neon AsProject</span><span class="sw on"></span></div>

            <div class="label">Layar kunci</div>
            <div class="row"><span>Aktifkan layar kunci</span><span class="sw on"></span></div>
            <div class="row"><span>Bingkai kosong (tanpa HUD)</span><span class="sw"></span></div>

            <div class="label">Ikon</div>
            <div class="row"><span>Ikon neon sirkuit</span><span class="sw on"></span></div>
            <div class="small">Berlaku untuk semua aplikasi — dibuat otomatis dari ikon aslinya.</div>

            <div class="label">Animasi</div>
            <div class="row"><span>Wallpaper liquid bergerak (3D)</span><span class="sw on"></span></div>
            <div class="row"><span>HUD layar kunci beranimasi</span><span class="sw on"></span></div>

            <div class="label">Tampilan</div>
            <div class="row"><span>Jam dan tanggal besar</span><span class="sw on"></span></div>
            <div class="row"><span>Kolom pencarian</span><span class="sw on"></span></div>
          </div>
        </div>
      </div>
      <div class="caption">Pengaturan</div>
      <div class="hint">Dua sakelar animasi baru: gerak liquid 3D dan HUD live.</div>
    </div>
  </div>

<script>
(function () {
  var HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli",
               "Agustus","September","Oktober","November","Desember"];
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function tick() {
    var now = new Date();
    var jam = pad(now.getHours()) + ":" + pad(now.getMinutes());
    var tanggal = HARI[now.getDay()] + ", " + now.getDate() + " " +
                  BULAN[now.getMonth()] + " " + now.getFullYear();

    document.querySelectorAll("[data-clock]").forEach(function (el) {
      el.textContent = jam;
      if (el.dataset.size === "lock") { el.style.fontSize = ""; }
    });
    document.querySelectorAll("[data-date]").forEach(function (el) { el.textContent = tanggal; });
    document.getElementById("sbLock").textContent = jam;
    document.getElementById("sbHome").textContent = jam;
  }

  /* ------------------------------------------------------------------
     Jam seven segment — salinan SevenSegmentClockView.java.
     Tiap angka dari 7 ruas (a..g); ruas padam tetap digambar redup,
     titik dua berkedip tiap detik.
  ------------------------------------------------------------------ */
  var SEG = [126, 48, 109, 121, 51, 91, 95, 112, 127, 123];
  var NEON = "#5FD8FF", CORE = "#E6FBFF", GHOST = "rgba(95,216,255,0.13)";

  function segPath(c, horizontal, x, y, len, t) {
    var ch = t / 2;
    c.beginPath();
    if (horizontal) {
      c.moveTo(x + ch, y);
      c.lineTo(x + len - ch, y); c.lineTo(x + len, y + ch);
      c.lineTo(x + len - ch, y + t); c.lineTo(x + ch, y + t); c.lineTo(x, y + ch);
    } else {
      c.moveTo(x, y + ch);
      c.lineTo(x + ch, y); c.lineTo(x + t - ch, y); c.lineTo(x + t, y + ch);
      c.lineTo(x + t, y + len - ch); c.lineTo(x + t - ch, y + len);
      c.lineTo(x + ch, y + len); c.lineTo(x, y + len - ch);
    }
    c.closePath();
  }

  function drawDigit(c, x, y, value, w, h, t) {
    var bits = SEG[value] || 0, half = h / 2, ch = t / 2;
    var segs = [
      [(bits >> 6) & 1, 1, x, y, w],
      [(bits >> 0) & 1, 1, x, y + half - t / 2, w],
      [(bits >> 3) & 1, 1, x, y + h - t, w],
      [(bits >> 1) & 1, 0, x, y + ch, half - ch],
      [(bits >> 5) & 1, 0, x + w - t, y + ch, half - ch],
      [(bits >> 2) & 1, 0, x, y + half, half - ch],
      [(bits >> 4) & 1, 0, x + w - t, y + half, half - ch]
    ];
    for (var i = 0; i < segs.length; i++) {
      var on = segs[i][0];
      segPath(c, segs[i][1] === 1, segs[i][2], segs[i][3], segs[i][4], t);
      if (on) {
        c.shadowColor = NEON; c.shadowBlur = t * 1.35; c.fillStyle = CORE;
        c.fill();
        c.shadowBlur = 0;
      } else {
        c.fillStyle = GHOST; c.fill();
      }
    }
  }

  function drawClock(canvas, hours, minutes, colonOn) {
    if (!canvas) { return; }
    var c = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    var t = H * 0.115, dw = H * 0.52, sp = t * 1.7, cw = t * 2.4;
    var total = 4 * dw + cw + 4 * sp;
    var x = (W - total) / 2, y = (H - H) / 2;

    drawDigit(c, x, y, Math.floor(hours / 10), dw, H, t); x += dw + sp;
    drawDigit(c, x, y, hours % 10, dw, H, t); x += dw + sp;

    var dot = t * 1.05, cx = x + (cw - dot) / 2;
    c.fillStyle = colonOn ? NEON : GHOST;
    c.shadowColor = NEON; c.shadowBlur = colonOn ? t * 1.2 : 0;
    c.fillRect(cx, H * 0.34 - dot / 2, dot, dot);
    c.fillRect(cx, H * 0.68 - dot / 2, dot, dot);
    c.shadowBlur = 0;
    x += cw + sp;

    drawDigit(c, x, y, Math.floor(minutes / 10), dw, H, t); x += dw + sp;
    drawDigit(c, x, y, minutes % 10, dw, H, t);
  }

  /* ------------------------------------------------------------------
     Papan sirkuit liquid 3D — salinan CircuitWallpaperView.java.
     Tiga bidang (jauh / tengah / dekat) diproyeksikan ke satu titik hilang,
     lalu tiap bidang diombak tiga gelombang berjalan, diberi keystone 3D,
     dan digerakkan paralaks (bidang dekat paling liar). Denyut cahaya,
     gelembung, dan kilau diproyeksikan ke koordinat yang sama sehingga
     mereka ikut terombang-ambing mengikuti cairannya.
  ------------------------------------------------------------------ */
  var SEED = 20261025;
  var MESH_COLS = 8, MESH_ROWS = 14;      // pratinjau: kisi lebih kasar dari APK (20x34)
  var LAYER_DEPTH = [0, 0.55, 1];
  var LAYER_PERSP = [0.55, 0.46, 0.36];
  var LAYER_ALPHA = [0.9, 1, 1];
  var CAMERA_DISTANCE = 0.40;
  var BASE_AMP = 10, HEAVY_TOP = 1.35, PARALLAX_SCALE = 0.18;
  var BUBBLES = 9, GLINTS = 4;

  var circuit = null;
  var pulses = [];
  var sprites = null;
  var bubbleU = [], bubbleR = [], bubbleSpeed = [], bubbleOffset = [], bubbleDrift = [];
  var frame = { t: 0, w: 0, h: 0 };
  var tmpPt = [0, 0];

  function makeRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function col(argb, mul) {
    var a = ((argb >>> 24) & 255) / 255;
    if (mul !== undefined) { a *= mul; }
    return "rgba(" + ((argb >>> 16) & 255) + "," + ((argb >>> 8) & 255) + "," +
      (argb & 255) + "," + a.toFixed(3) + ")";
  }

  /* ------------------------------------------------------- seni papan per bidang */

  function boardDots(c, w, h, step, color, radius) {
    c.fillStyle = color;
    for (var y = step * 0.5; y < h; y += step) {
      for (var x = step * 0.5; x < w; x += step) {
        c.beginPath(); c.arc(x, y, radius, 0, 6.2832); c.fill();
      }
    }
  }

  function randomPath(rnd, w, h, unit, vTop, vBottom, minC, maxC) {
    var x = Math.round(rnd() * 16) * (w / 16), y = (vTop + rnd() * (vBottom - vTop)) * h;
    var corners = minC + Math.floor(rnd() * (maxC - minC + 1));
    var horiz = rnd() > 0.5, pts = [{ x: x, y: y }];
    for (var k = 0; k < corners; k++) {
      var len = unit * (1 + Math.floor(rnd() * 3));
      if (horiz) { x += rnd() > 0.5 ? len : -len; } else { y += rnd() > 0.5 ? len : -len; }
      x = Math.max(-unit, Math.min(w + unit, x));
      y = Math.max(vTop * h - unit, Math.min(vBottom * h + unit, y));
      pts.push({ x: x, y: y });
      horiz = !horiz;
    }
    return pts;
  }

  function strokePath(c, pts, width, color) {
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) { c.lineTo(pts[i].x, pts[i].y); }
    c.stroke();
  }

  function cornerPads(c, pts, radius, color) {
    c.fillStyle = color;
    for (var i = 0; i < pts.length; i++) {
      c.beginPath(); c.arc(pts[i].x, pts[i].y, radius, 0, 6.2832); c.fill();
      c.fillStyle = col(0x22EAFBFF);
      c.beginPath(); c.arc(pts[i].x, pts[i].y, radius * 0.42, 0, 6.2832); c.fill();
      c.fillStyle = color;
    }
  }

  /* Pin berdiri: penanda ketinggian yang paling jelas dibaca mata. */
  function risers(c, pts, len, width, color) {
    for (var i = 1; i < pts.length; i += 2) {
      c.fillStyle = color;
      c.fillRect(pts[i].x - width * 0.5, pts[i].y - len, width, len);
      c.beginPath(); c.arc(pts[i].x, pts[i].y - len, width * 0.95, 0, 6.2832); c.fill();
      c.fillStyle = col(0x33EAFBFF);
      c.beginPath(); c.arc(pts[i].x, pts[i].y - len, width * 2.2, 0, 6.2832); c.fill();
    }
  }

  function chip3d(c, left, top, cw, ch, extrude, edge, body, lw) {
    var lift = ch * extrude, rr = ch * 0.12;
    function box(y, hh) {
      c.beginPath();
      if (c.roundRect) { c.roundRect(left, y, cw, hh, rr); } else { c.rect(left, y, cw, hh); }
    }
    c.fillStyle = col(body); box(top, ch); c.fill();
    c.fillStyle = col(0x3A16222E);
    c.beginPath();
    c.moveTo(left, top); c.lineTo(left, top - lift);
    c.lineTo(left + cw, top - lift); c.lineTo(left + cw, top);
    c.closePath(); c.fill();
    c.fillStyle = col(0x2A0C1420); box(top - lift, ch * 0.9); c.fill();
    c.strokeStyle = col(edge); c.lineWidth = lw; box(top - lift, ch * 0.9); c.stroke();
    c.fillStyle = col(edge, 0.4);
    for (var l = 0; l < 4; l++) {
      var ly = top + ch * (l + 0.5) / 4;
      c.fillRect(left - cw * 0.06, ly - ch * 0.02, cw * 0.06, ch * 0.04);
      c.fillRect(left + cw, ly - ch * 0.02, cw * 0.06, ch * 0.04);
    }
  }

  function fogTop(c, w, h, amount, color) {
    if (amount <= 0) { return; }
    var g = c.createLinearGradient(0, 0, 0, h * amount);
    g.addColorStop(0, col(color)); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h * amount);
  }

  function pathLength(pts) {
    var total = 0;
    for (var i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return total;
  }

  function addPulse(layer, pts, rnd, width, artW, artH) {
    var total = pathLength(pts);
    if (total <= 0) { return; }
    pulses.push({
      layer: layer, pts: pts, total: total,
      offset: rnd(), speed: 0.05 + rnd() * 0.09,
      width: Math.max(2, width), artW: artW, artH: artH
    });
  }

  /* Jejak vertikal panjang ("bus"): sesudah diproyeksikan deretan ini menyatu
     ke titik hilang — penanda perspektif yang paling kuat dibaca mata. */
  function busLines(c, w, h, rnd, count, sw, color, padColor, vTop, vBottom) {
    c.strokeStyle = col(color); c.lineWidth = Math.max(0.6, sw);
    c.lineCap = "round"; c.lineJoin = "round";
    for (var i = 0; i < count; i++) {
      var x = Math.round(rnd() * 16) * (w / 16), y0 = vTop * h, y1 = vBottom * h;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
      var joints = 2 + Math.floor(rnd() * 2);
      for (var k = 0; k < joints; k++) {
        var jy = y0 + (y1 - y0) * ((k + 0.5 + rnd() * 0.4) / (joints + 0.4));
        var dir = rnd() > 0.5 ? 1 : -1, len = w * (0.03 + rnd() * 0.07);
        c.beginPath(); c.moveTo(x, jy); c.lineTo(x + dir * len, jy); c.stroke();
        c.fillStyle = col(padColor);
        c.beginPath(); c.arc(x + dir * len, jy, sw * 1.35, 0, 6.2832); c.fill();
      }
      c.fillStyle = col(padColor);
      c.beginPath(); c.arc(x, y0, sw * 1.2, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(x, y1, sw * 1.2, 0, 6.2832); c.fill();
    }
  }

  /* Jejak mendatar panjang — di bidang dekat tampak sebagai pita lebar. */
  function hBusLines(c, w, h, rnd, count, sw, color, coreColor, padColor, vTop, vBottom) {
    for (var i = 0; i < count; i++) {
      var y = (vTop + rnd() * (vBottom - vTop)) * h;
      var x0 = -w * 0.05, x1 = w * (0.75 + rnd() * 0.5);
      var pts = [{ x: x0, y: y }, { x: x1, y: y }];
      strokePath(c, pts, sw * 2.0, col(color));
      strokePath(c, pts, sw, col(color));
      strokePath(c, pts, sw * 0.34, col(coreColor));
      c.fillStyle = col(padColor);
      [x0 + w * 0.06, x0 + w * 0.42, Math.min(x1, w * 0.92)].forEach(function (px) {
        c.beginPath(); c.arc(px, y, sw * 1.5, 0, 6.2832); c.fill();
      });
    }
  }

  function farBoard(c, w, h, rnd) {
    var unit = w / 26;
    boardDots(c, w, h, w / 34, col(0x10BFE9FF), w * 0.0013);
    busLines(c, w, h, rnd, 8, w * 0.0022, 0x3A4FC3F7, 0x3A7FD8FF, 0, 1);
    for (var i = 0; i < 18; i++) {
      var path = randomPath(rnd, w, h, unit, 0, 1, 3, 5);
      strokePath(c, path, Math.max(0.6, w * 0.0018), col(0x324FC3F7));
      if (i < 7) { cornerPads(c, path, Math.max(0.8, w * 0.0024), col(0x40B3E8FF)); }
    }
    for (var k = 0; k < 3; k++) {
      var cw = unit * (1.2 + rnd());
      chip3d(c, rnd() * (w - cw), (0.10 + rnd() * 0.7) * h, cw, cw * 0.5,
        0.10, 0x2A7FD8FF, 0x180A1018, w * 0.0016);
    }
    fogTop(c, w, h, 0.40, 0xA8060B12);
  }

  function midBoard(c, w, h, rnd) {
    var unit = w / 16, pulseCount = 0;
    boardDots(c, w, h, w / 20, col(0x14BFE9FF), w * 0.0016);
    busLines(c, w, h, rnd, 5, w * 0.0034, 0x554FC3F7, 0x7FB3E8FF, 0, 1);
    for (var i = 0; i < 26; i++) {
      var power = i % 5 === 0;
      var sw = Math.max(1, w * (power ? 0.0058 : 0.0030));
      var path = randomPath(rnd, w, h, unit, 0.02, 1, 3, 6);
      strokePath(c, path, sw * 2.1, col(power ? 0x2A4FC3F7 : 0x184FC3F7));
      strokePath(c, path, sw, col(power ? 0x7A4FC3F7 : 0x404FC3F7));
      if (power) { strokePath(c, path, sw * 0.35, col(0xBFE6FBFF)); }
      cornerPads(c, path, sw * 1.35, col(power ? 0x99B3E8FF : 0x667FD8FF));
      if (power) { risers(c, path, h * 0.020, sw * 0.8, col(0x8FBFE9FF)); }
      if (power && pulseCount < 7) { addPulse(1, path, rnd, sw, w, h); pulseCount++; }
    }
    for (var k = 0; k < 4; k++) {
      var cw = unit * (1.6 + rnd() * 1.5), ch = cw * (0.44 + rnd() * 0.26);
      chip3d(c, rnd() * (w - cw), (0.12 + rnd() * 0.7) * h, cw, ch,
        0.16, 0x6E7FD8FF, 0x2E0A1018, w * 0.0026);
    }
    fogTop(c, w, h, 0.30, 0x99060B12);
  }

  function nearBoard(c, w, h, rnd) {
    var unit = w / 7;
    busLines(c, w, h, rnd, 3, w * 0.010, 0x5A4FC3F7, 0x99BFE9FF, 0.5, 1.2);
    hBusLines(c, w, h, rnd, 2, w * 0.009, 0x504FC3F7, 0x7AE6FBFF, 0x99BFE9FF, 0.84, 1.16);
    for (var i = 0; i < 7; i++) {
      var sw = Math.max(2, w * (0.010 + rnd() * 0.008));
      var path = randomPath(rnd, w, h, unit, 0.55, 1.25, 2, 4);
      strokePath(c, path, sw * 2.6, col(0x184FC3F7));
      strokePath(c, path, sw, col(0x5A4FC3F7));
      strokePath(c, path, sw * 0.34, col(0x9AE6FBFF));
      cornerPads(c, path, sw * 1.5, col(0xB3BFE9FF));
      risers(c, path, h * 0.035, sw * 0.9, col(0x99BFE9FF));
      if (i < 2) { addPulse(2, path, rnd, sw * 1.25, w, h); }
    }
    for (var b = 0; b < 5; b++) {
      var r = w * (0.10 + rnd() * 0.16), cx = rnd() * w, cy = (0.6 + rnd() * 0.55) * h;
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col(0x223A6E8F)); g.addColorStop(0.55, col(0x142A5470));
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill();
    }
  }

  /* ------------------------------------------------------------- geometri & proyeksi */

  function buildGeom(w, h, depth, sTop) {
    var drawWidth = w * (1 + depth * PARALLAX_SCALE);
    var bottom = h * (1.02 + depth * 0.06);
    var top = -h * (0.06 + (0.5 - depth) * 0.05);
    var horizon = (top - sTop * bottom) / (1 - sTop);
    var spread = bottom - horizon;
    var k = 1 / sTop - 1;
    var bx = new Float64Array((MESH_COLS + 1) * (MESH_ROWS + 1));
    var by = new Float64Array(MESH_ROWS + 1);
    for (var j = 0; j <= MESH_ROWS; j++) {
      var v = j / MESH_ROWS;
      var s = 1 / (1 + k * (1 - v));
      by[j] = horizon + spread * s;
      var rowW = drawWidth * s;
      for (var i = 0; i <= MESH_COLS; i++) {
        bx[j * (MESH_COLS + 1) + i] = w / 2 + (i / MESH_COLS - 0.5) * rowW;
      }
    }
    return { bx: bx, by: by };
  }

  function layerFrame(L) {
    var depth = LAYER_DEPTH[L], strength = 0.45 + depth;
    return {
      rx: Math.sin(frame.t * 0.33) * 3.2 * strength * Math.PI / 180,
      ry: Math.cos(frame.t * 0.27) * 2.6 * strength * Math.PI / 180,
      dist: Math.max(frame.w, frame.h) / CAMERA_DISTANCE,
      amp: BASE_AMP * (0.55 + depth * 1.05),
      tp: frame.t * (0.85 + depth * 0.4) + L * 1.7,
      depth: depth
    };
  }

  function waveAt(u, v, t, amp, weight) {
    var waveA = Math.sin(v * 5.2 + t * 1.15 + u * 0.7);
    var waveB = Math.sin(u * 4.1 - t * 0.85 + v * 1.3);
    var waveC = Math.sin((u + v) * 3.0 + t * 0.55);
    var ripple = Math.sin(u * 7.3 - v * 5.1 + t * 1.9) * 0.34;
    var dx = (waveA * 0.52 + waveC * 0.28 + ripple) * amp * weight;
    var dy = (waveB * 0.46 + waveC * 0.30 + ripple * 0.55) * amp * 0.72;
    var bulge = Math.sin(v * Math.PI) * Math.sin(u * Math.PI);
    dx += (u - 0.5) * bulge * 12;
    dy += (v - 0.5) * bulge * 16;
    return [dx, dy];
  }

  function project3D(x, y, cx, cy, dist, rx, ry) {
    var px = x - cx, py = y - cy;
    var y1 = py * Math.cos(rx), z1 = py * Math.sin(rx);
    var x2 = px * Math.cos(ry) + z1 * Math.sin(ry);
    var z2 = -px * Math.sin(ry) + z1 * Math.cos(ry);
    var f = dist / Math.max(1, dist - z2);
    return [cx + x2 * f, cy + y1 * f];
  }

  /** Posisi layar untuk titik (u,v) pada bidang L — berikut ombak & keystone. */
  function projectLayer(L, u, v, out) {
    if (!circuit) { return false; }
    var g = circuit.layers[L].geom, f = layerFrame(L);
    var fi = Math.max(0, Math.min(MESH_COLS, u * MESH_COLS));
    var fj = Math.max(0, Math.min(MESH_ROWS, v * MESH_ROWS));
    var i0 = Math.floor(fi), j0 = Math.floor(fj);
    var i1 = Math.min(MESH_COLS, i0 + 1), j1 = Math.min(MESH_ROWS, j0 + 1);
    var tu = fi - i0, tv = fj - j0, W = MESH_COLS + 1;
    var x0 = g.bx[j0 * W + i0] + (g.bx[j0 * W + i1] - g.bx[j0 * W + i0]) * tu;
    var x1 = g.bx[j1 * W + i0] + (g.bx[j1 * W + i1] - g.bx[j1 * W + i0]) * tu;
    var x = x0 + (x1 - x0) * tv;
    var y = g.by[j0] + (g.by[j1] - g.by[j0]) * tv;
    var d = waveAt(u, v, f.tp, f.amp, HEAVY_TOP - (HEAVY_TOP - 0.35) * v);
    var p = project3D(x + d[0], y + d[1], frame.w / 2, frame.h / 2, f.dist, f.rx, f.ry);
    out[0] = p[0]; out[1] = p[1];
    return true;
  }

  /* --------------------------------------------------------------------- sprite */

  function buildSprites() {
    sprites = {
      glow: radialSprite([[0, "rgba(143,230,255,0.90)"], [0.22, "rgba(95,216,255,0.50)"],
        [0.55, "rgba(79,195,247,0.10)"], [1, "rgba(79,195,247,0)"]]),
      bubble: radialSprite([[0, "rgba(95,216,255,0)"], [0.55, "rgba(95,216,255,0.05)"],
        [0.78, "rgba(191,233,255,0.40)"], [0.90, "rgba(234,251,255,0.80)"],
        [1, "rgba(234,251,255,0)"]]),
      pool: radialSprite([[0, "rgba(111,207,255,0.40)"], [0.45, "rgba(79,195,247,0.16)"],
        [1, "rgba(79,195,247,0)"]])
    };
  }

  function radialSprite(stops) {
    var size = 128, cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    var c = cv.getContext("2d");
    var g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (var i = 0; i < stops.length; i++) { g.addColorStop(stops[i][0], stops[i][1]); }
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    return cv;
  }

  function drawSprite(c, sprite, x, y, rx, ry, rot, alpha, additive) {
    if (!sprite || rx <= 0 || ry <= 0) { return; }
    c.save();
    c.globalAlpha = alpha;
    if (additive) { c.globalCompositeOperation = "lighter"; }
    c.translate(x, y);
    if (rot) { c.rotate(rot); }
    c.scale(rx, ry);
    c.drawImage(sprite, -0.5, -0.5, 1, 1);
    c.restore();
  }

  /* ------------------------------------------------------------ kanvas per frame */

  function drawBackdrop(c, w, h) {
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#04080F"); g.addColorStop(1, "#070E18");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    var r = Math.max(w, h) * 0.55;
    var g2 = c.createRadialGradient(w * 0.5, -h * 0.05, 0, w * 0.5, -h * 0.05, r);
    g2.addColorStop(0, "rgba(79,195,247,0.20)"); g2.addColorStop(1, "rgba(79,195,247,0)");
    c.fillStyle = g2; c.fillRect(0, 0, w, h);
  }

  function grow(p, cx, cy) {
    var dx = p[0] - cx, dy = p[1] - cy, l = Math.sqrt(dx * dx + dy * dy) || 1;
    return [p[0] + dx / l * 0.8, p[1] + dy / l * 0.8];
  }

  function drawMesh(c, art, pts) {
    var sw = art.width / MESH_COLS, sh = art.height / MESH_ROWS, W = MESH_COLS + 1;
    for (var j = 0; j < MESH_ROWS; j++) {
      for (var i = 0; i < MESH_COLS; i++) {
        var p00 = pts[j * W + i], p10 = pts[j * W + i + 1];
        var p11 = pts[(j + 1) * W + i + 1], p01 = pts[(j + 1) * W + i];
        // Sedikit diperbesar & di-clip: tetangga beririsan sehingga tak ada jahitan.
        var cx = (p00[0] + p10[0] + p11[0] + p01[0]) / 4;
        var cy = (p00[1] + p10[1] + p11[1] + p01[1]) / 4;
        var q = [grow(p00, cx, cy), grow(p10, cx, cy), grow(p11, cx, cy), grow(p01, cx, cy)];
        c.save();
        c.beginPath();
        c.moveTo(q[0][0], q[0][1]); c.lineTo(q[1][0], q[1][1]);
        c.lineTo(q[2][0], q[2][1]); c.lineTo(q[3][0], q[3][1]);
        c.closePath();
        c.clip();
        c.transform((q[1][0] - q[0][0]) / sw, (q[1][1] - q[0][1]) / sw,
          (q[3][0] - q[0][0]) / sh, (q[3][1] - q[0][1]) / sh, q[0][0], q[0][1]);
        c.drawImage(art, i * sw, j * sh, sw, sh, 0, 0, sw, sh);
        c.restore();
      }
    }
  }

  function drawPulses(c, L, t) {
    if (!sprites) { return; }
    for (var i = 0; i < pulses.length; i++) {
      var p = pulses[i];
      if (p.layer !== L) { continue; }
      var head = (t * p.speed + p.offset) % 1;
      var r = Math.max(2.2, p.width * 1.15);
      for (var k = 6; k >= 1; k--) {
        var q = head - k * 0.014;
        if (q < 0) { q += 1; }
        pointAlong(p.pts, q, tmpPt);
        if (!projectLayer(L, tmpPt[0] / p.artW, tmpPt[1] / p.artH, tmpPt)) { continue; }
        var rr = r * (1.35 - k * 0.11);
        drawSprite(c, sprites.glow, tmpPt[0], tmpPt[1], rr, rr, 0,
          Math.max(0, 0.59 * (1 - k / 7)), true);
      }
      pointAlong(p.pts, head, tmpPt);
      if (projectLayer(L, tmpPt[0] / p.artW, tmpPt[1] / p.artH, tmpPt)) {
        drawSprite(c, sprites.glow, tmpPt[0], tmpPt[1], r * 2.6, r * 2.6, 0, 1, true);
        c.fillStyle = "#EAFBFF";
        c.beginPath(); c.arc(tmpPt[0], tmpPt[1], r * 0.62, 0, 6.2832); c.fill();
      }
    }
  }

  function drawFluid(c, t) {
    if (!sprites) { return; }
    var w = frame.w, h = frame.h, big = Math.max(w, h);
    // Kolam cahaya yang berkelana pelan di atas papan.
    for (var i = 0; i < 2; i++) {
      var u = 0.5 + 0.42 * Math.sin(t * (0.07 + i * 0.03) + i * 2.1);
      var v = 0.45 + 0.30 * Math.cos(t * (0.05 + i * 0.04) + i);
      if (!projectLayer(1, u, v, tmpPt)) { continue; }
      var r = big * (0.34 + i * 0.12);
      drawSprite(c, sprites.pool, tmpPt[0], tmpPt[1], r, r * 0.62, 0,
        0.18 + i * 0.05, true);
    }
    // Kilau memanjang: tanda permukaan basah.
    for (var g = 0; g < GLINTS; g++) {
      var gu = (g + 0.5) / GLINTS + 0.06 * Math.sin(t * 0.31 + g * 1.7);
      var gv = 0.35 + 0.5 * ((t * 0.035 + g * 0.23) % 1);
      if (gu < 0) { gu += 1; }
      if (gu > 1) { gu -= 1; }
      if (!projectLayer(1, gu, gv, tmpPt)) { continue; }
      var gr = w * (0.10 + 0.05 * Math.sin(t * 0.7 + g * 2.2));
      drawSprite(c, sprites.pool, tmpPt[0], tmpPt[1], gr, gr * 0.16,
        0.5 * Math.sin(t * 0.5 + g), 0.27, true);
    }
    // Gelembung cairan yang naik perlahan sambil berayun.
    for (var b = 0; b < BUBBLES; b++) {
      var pb = (t * bubbleSpeed[b] + bubbleOffset[b]) % 1;
      var bv = 1.08 - pb * 1.20;
      var bu = Math.max(0.02, Math.min(0.98,
        bubbleU[b] + bubbleDrift[b] * Math.sin(t * 0.9 + b * 1.3)));
      if (!projectLayer(1, bu, bv, tmpPt)) { continue; }
      var fade = Math.sin(Math.PI * Math.max(0, Math.min(1, pb)));
      var br = w * bubbleR[b] * (0.7 + 0.5 * fade);
      drawSprite(c, sprites.bubble, tmpPt[0], tmpPt[1], br, br, 0,
        0.75 * fade, true);
    }
  }

  function drawCircuit(canvas, t) {
    if (!canvas) { return; }
    var w = canvas.width, h = canvas.height;
    var c = canvas.getContext("2d");
    if (!circuit || circuit.w !== w || circuit.h !== h) {
      pulses = [];
      var layers = [];
      for (var i = 0; i < 3; i++) {
        layers.push({
          art: (function (idx) {
            var cv = document.createElement("canvas");
            cv.width = w; cv.height = h;
            var cc = cv.getContext("2d");
            var rnd = makeRandom(SEED + idx * 7919);
            if (idx === 0) { farBoard(cc, w, h, rnd); }
            else if (idx === 1) { midBoard(cc, w, h, rnd); }
            else { nearBoard(cc, w, h, rnd); }
            return cv;
          })(i),
          geom: buildGeom(w, h, LAYER_DEPTH[i], LAYER_PERSP[i])
        });
      }
      circuit = { w: w, h: h, layers: layers };
      buildSprites();
      var brnd = makeRandom(SEED + 31);
      for (var b = 0; b < BUBBLES; b++) {
        bubbleU[b] = 0.08 + brnd() * 0.84;
        bubbleR[b] = 0.012 + brnd() * 0.030;
        bubbleSpeed[b] = 0.035 + brnd() * 0.055;
        bubbleOffset[b] = brnd();
        bubbleDrift[b] = 0.004 + brnd() * 0.012;
      }
    }
    frame.t = t; frame.w = w; frame.h = h;
    c.clearRect(0, 0, w, h);
    drawBackdrop(c, w, h);

    for (var L = 0; L < circuit.layers.length; L++) {
      var layer = circuit.layers[L], f = layerFrame(L), g = layer.geom, W = MESH_COLS + 1;
      var pts = [];
      for (var j = 0; j <= MESH_ROWS; j++) {
        var v = j / MESH_ROWS;
        var weight = HEAVY_TOP - (HEAVY_TOP - 0.35) * v;
        for (var i2 = 0; i2 <= MESH_COLS; i2++) {
          var u = i2 / MESH_COLS;
          var d = waveAt(u, v, f.tp, f.amp, weight);
          pts.push(project3D(g.bx[j * W + i2] + d[0], g.by[j] + d[1],
            w / 2, h / 2, f.dist, f.rx, f.ry));
        }
      }
      c.save();
      c.globalAlpha = LAYER_ALPHA[L];
      drawMesh(c, layer.art, pts);
      c.restore();
      drawPulses(c, L, t);
    }
    drawFluid(c, t);
  }

  function pointAlong(pts, p, out) {
    var total = 0, i, seg = [];
    for (i = 1; i < pts.length; i++) {
      seg.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      total += seg[i - 1];
    }
    if (total <= 0 || !seg.length) { out[0] = pts[0].x; out[1] = pts[0].y; return out; }
    var target = total * p, walked = 0;
    for (i = 0; i < seg.length; i++) {
      if (walked + seg[i] >= target) {
        var r = (target - walked) / seg[i];
        out[0] = pts[i].x + (pts[i + 1].x - pts[i].x) * r;
        out[1] = pts[i].y + (pts[i + 1].y - pts[i].y) * r;
        return out;
      }
      walked += seg[i];
    }
    out[0] = pts[pts.length - 1].x; out[1] = pts[pts.length - 1].y;
    return out;
  }

  /* ------------------------------------------------------------------
     Ikon baterai lingkaran bersegmen — salinan LiquidBatteryView.java.
     20 ruas melingkar menyala mengikuti daya, ada aliran cair berjalan
     dan komet berputar saat mengisi daya.
  ------------------------------------------------------------------ */
  var canvas = document.getElementById("battMeter");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var level = 0.74;       // contoh: 74%
  var charging = false;
  var phase = 0;
  var last = 0;

  function drawBatteryRing() {
    if (!ctx) { return; }
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var size = Math.min(W, H), stroke = Math.max(2, size * 0.115);
    var r = size / 2 - stroke / 2 - 1, cx = W / 2, cy = H / 2;
    var segments = 20, sweepDeg = 360 / segments, gap = sweepDeg * 0.28;
    var filled = Math.round(segments * level);

    for (var i = 0; i < segments; i++) {
      var start = (-90 + i * sweepDeg + gap / 2) * Math.PI / 180;
      var end = start + (sweepDeg - gap) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      if (i < filled) {
        var flow = 0.72 + 0.28 * Math.sin(phase * 6.2832 - i * 0.55);
        ctx.strokeStyle = "rgba(95,216,255," + Math.max(0.45, flow).toFixed(3) + ")";
        ctx.lineWidth = stroke;
        if (flow > 0.9) { ctx.shadowColor = "#5FD8FF"; ctx.shadowBlur = stroke * 0.9; }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = "rgba(95,216,255,0.16)";
        ctx.lineWidth = stroke;
        ctx.stroke();
      }
    }

    if (charging) {
      var headA = (-90 + phase * 360) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, r, headA, headA + 26 * Math.PI / 180);
      ctx.strokeStyle = "#E6FBFF"; ctx.lineWidth = stroke;
      ctx.shadowColor = "#5FD8FF"; ctx.shadowBlur = stroke * 1.4;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#E6FBFF";
    ctx.shadowColor = "#5FD8FF"; ctx.shadowBlur = size * 0.18;
    ctx.font = "700 " + Math.round(size * 0.34) + "px 'TechMono', ui-monospace, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(level * 100)), cx, cy);
    ctx.shadowBlur = 0;
  }

  /* ------------------------------------------------------------------
     Liquid slide bar — salinan LiquidHandleView.java.
     Tepi atas beriak; melengkung ke bawah saat laci ditarik (stretch).
  ------------------------------------------------------------------ */
  function drawHandle(canvasId, t, stretch, ripple) {
    var cv = document.getElementById(canvasId);
    if (!cv) { return; }
    var c = cv.getContext("2d");
    var w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    var base = h * 0.42, amp = h * 0.16 * (0.35 + 0.65 * ripple), sag = h * 0.55 * stretch;

    function surfaceY(x) {
      var u = x / w;
      return base
        + Math.sin(t * 6.2832 + u * 9.4248) * amp
        + Math.sin(t * 4.0 - u * 6.2832) * amp * 0.45
        + Math.sin(u * Math.PI) * sag;
    }

    c.beginPath();
    c.moveTo(0, h); c.lineTo(0, surfaceY(0));
    for (var i = 1; i <= 28; i++) { var x = w * i / 28; c.lineTo(x, surfaceY(x)); }
    c.lineTo(w, h); c.closePath();
    var grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1A2632"); grad.addColorStop(1, "#070B12");
    c.fillStyle = grad; c.fill();

    c.beginPath();
    c.moveTo(0, surfaceY(0));
    for (var j = 1; j <= 28; j++) { var x2 = w * j / 28; c.lineTo(x2, surfaceY(x2)); }
    c.strokeStyle = "rgba(95,216,255,0.72)";
    c.lineWidth = Math.max(1, h * 0.06);
    c.shadowColor = "#5FD8FF"; c.shadowBlur = h * 0.25;
    c.stroke(); c.shadowBlur = 0;

    var pillW = Math.min(w * 0.24, h * 2.6), pillH = Math.max(2, h * 0.10);
    c.fillStyle = "rgba(127,216,255,0.80)";
    c.beginPath();
    if (c.roundRect) { c.roundRect((w - pillW) / 2, h * 0.62 - pillH / 2, pillW, pillH, pillH / 2); }
    else { c.rect((w - pillW) / 2, h * 0.62 - pillH / 2, pillW, pillH); }
    c.fill();
  }

  function loop(now) {
    if (!last) { last = now; }
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    phase += dt * 0.22;
    if (phase > 1) { phase -= 1; }

    var d = new Date();
    var blink = d.getSeconds() % 2 === 0;
    drawCircuit(document.getElementById("lockCircuit"), now / 1000);
    drawClock(document.getElementById("clockLock"), d.getHours(), d.getMinutes(), blink);
    drawClock(document.getElementById("clockHome"), d.getHours(), d.getMinutes(), blink);
    drawClock(document.getElementById("clockDrawer"), d.getHours(), d.getMinutes(), blink);
    drawBatteryRing();
    drawHandle("homeSlideBar", now / 1000, 0, 0.35);
    drawHandle("drawerHandle", now / 1000, 0, 0.6);
    requestAnimationFrame(loop);
  }

  tick();
  setInterval(tick, 1000);
  if (ctx) { requestAnimationFrame(loop); }
})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    build()
