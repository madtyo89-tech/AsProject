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
GENERIC = [("play", "P", 2), ("maps", "M", 0), ("gmail", "G", 1), ("youtube", "Y", 3)]
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


def placeholder_icon(letter: str, hue: int, size: int = S) -> Image.Image:
    """Ikon aplikasi tiruan: tile berwarna + glyph putih (untuk contoh generik)."""
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    color = {0: (66, 133, 244), 1: (234, 67, 53), 2: (52, 168, 83), 3: (251, 188, 5)}[hue % 4]
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=color + (255,))
    font = ImageFont.truetype(FONT_BOLD, int(size * 0.52))
    left, top, right, bottom = draw.textbbox((0, 0), letter, font=font)
    draw.text(((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top),
              letter, font=font, fill=(255, 255, 255, 255))
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

    active = delta[~ring]
    strong = delta[delta > peak * 0.12]
    low = float(np.percentile(strong, 100 - keep * 100)) if strong.size else peak * 0.5
    high = max(low * 1.15, float(np.percentile(active, 99.5)))
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
    if int((edge > 0.05).sum()) < max(16, size * 0.4):
        return mask * 0.9
    return np.maximum(np.sqrt(edge), mask * 0.09)


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
    for name, letter, hue in GENERIC:
        classes.append(f".ic-gen-{name}{{background-image:url(\"{png_b64(neonize(placeholder_icon(letter, hue)).resize((112, 112), Image.LANCZOS))}\")}}")

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
  .batt{position:relative;width:calc(var(--dp)*100);height:calc(var(--dp)*26);flex:0 0 auto}
  .batt canvas{width:100%;height:100%;display:block}
  .brand{margin-top:calc(var(--dp)*30);font-family:ui-monospace,Menlo,monospace;
    font-size:calc(var(--dp)*10);letter-spacing:.42em;color:var(--neon-dim);text-indent:.42em}
  .lock .clock{margin-top:calc(var(--dp)*6);font-size:calc(var(--dp)*78);font-weight:200;
    letter-spacing:-.035em;line-height:1;text-shadow:0 0 calc(var(--dp)*26) rgba(79,195,247,.55)}
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
  .home .clock{font-size:calc(var(--dp)*66);font-weight:200;letter-spacing:-.035em;line-height:1;
    text-shadow:0 calc(var(--dp)*2) calc(var(--dp)*14) rgba(0,0,0,.6),0 0 calc(var(--dp)*22) rgba(79,195,247,.25)}
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
          <div class="liquid"></div>
          <div class="veil"></div>
          <div class="lockcontent">
            <div class="chips">
              <span class="chip">SISTEM AKTIF</span>
              <span class="batt"><canvas id="battMeter" width="200" height="52"></canvas></span>
            </div>
            <div class="brand">ASPROJECT SECURE</div>
            <div class="clock" data-clock data-size="lock">00:00</div>
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
              <div class="clock" data-clock data-size="home">00:00</div>
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
            <div class="navbar"><i class="tri"></i><i class="cir"></i><i class="sq"></i></div>
          </div>
        </div>
      </div>
      <div class="caption">Beranda — semua ikon neon</div>
      <div class="hint">Ikon generik (Play Store, Maps, Gmail, YouTube) memakai versi neon otomatis dari ikon aslinya.</div>
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
     Meter baterai liquid glass — salinan LiquidBatteryView.java.
     Kapsul kaca + cairan neon beriak + kilat saat mengisi daya.
  ------------------------------------------------------------------ */
  var canvas = document.getElementById("battMeter");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var level = 0.74;       // contoh: 74%
  var charging = false;
  var phase = 0;
  var last = 0;

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function drawBattery(t) {
    if (!ctx) { return; }
    var W = canvas.width, H = canvas.height, R = H / 2;
    ctx.clearRect(0, 0, W, H);

    var glass = ctx.createLinearGradient(0, 0, 0, H);
    glass.addColorStop(0, "rgba(36,48,51,0.40)");
    glass.addColorStop(1, "rgba(4,7,11,0.70)");

    ctx.save();
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, R); ctx.clip();

    ctx.fillStyle = glass; ctx.fillRect(0, 0, W, H);

    // sorotan atas (kaca membusung)
    var top = ctx.createRadialGradient(W * 0.42, -H * 0.35, 0, W * 0.42, -H * 0.35, H * 1.15);
    top.addColorStop(0, "rgba(232,251,255,0.35)");
    top.addColorStop(1, "rgba(232,251,255,0)");
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, H);

    // kilau bawah-kanan
    var under = ctx.createRadialGradient(W * 0.95, H * 1.15, 0, W * 0.95, H * 1.15, H * 0.75);
    under.addColorStop(0, "rgba(88,180,232,0.18)");
    under.addColorStop(1, "rgba(88,180,232,0)");
    ctx.fillStyle = under; ctx.fillRect(0, 0, W, H);

    // sapuan cair
    var span = W * 2.2, shift = (phase % 1) * span - W * 0.6;
    var sweep = ctx.createLinearGradient(shift, 0, shift + W * 0.55, H);
    sweep.addColorStop(0, "rgba(191,233,255,0)");
    sweep.addColorStop(0.5, "rgba(191,233,255,0.18)");
    sweep.addColorStop(1, "rgba(191,233,255,0)");
    ctx.fillStyle = sweep; ctx.fillRect(0, 0, W, H);

    // jejak sirkuit terukir
    ctx.strokeStyle = "rgba(127,216,255,0.29)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(W * 0.02, H * 0.72); ctx.lineTo(W * 0.02, H * 0.30); ctx.lineTo(W * 0.05, H * 0.30);
    ctx.moveTo(W * 0.98, H * 0.28); ctx.lineTo(W * 0.98, H * 0.70); ctx.lineTo(W * 0.95, H * 0.70);
    ctx.stroke();
    ctx.fillStyle = "rgba(191,239,255,0.6)";
    ctx.beginPath(); ctx.arc(W * 0.05, H * 0.30, 2, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.95, H * 0.70, 2, 0, 6.2832); ctx.fill();

    // cangkang baterai
    var bx = 16, bw = 44, bh = 22, by = (H - bh) / 2, br = bh * 0.26;
    var shellGrad = ctx.createLinearGradient(0, by, 0, by + bh);
    shellGrad.addColorStop(0, "rgba(10,16,24,0.20)");
    shellGrad.addColorStop(1, "rgba(6,11,18,0.40)");
    ctx.fillStyle = shellGrad; roundRect(ctx, bx, by, bw, bh, br); ctx.fill();

    // kutub
    ctx.fillStyle = "rgba(127,216,255,0.67)";
    roundRect(ctx, bx + bw + 2.4, by + bh * 0.29, 4, bh * 0.42, 2); ctx.fill();

    // cairan neon dengan permukaan beriak
    var ix = bx + 2.4, iy = by + 2.4, iw = bw - 4.8, ih = bh - 4.8;
    var fillH = ih * level, surface = iy + ih - fillH, wave = ih * 0.10;
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, br * 0.62); ctx.clip();
    var liquid = ctx.createLinearGradient(0, surface, 0, iy + ih);
    liquid.addColorStop(0, "rgba(143,230,255,1)");
    liquid.addColorStop(1, "rgba(32,144,200,0.90)");
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih);
    for (var i = 0; i <= 24; i++) {
      var p = i / 24;
      ctx.lineTo(ix + iw * p, surface + Math.sin(t * 1.9 + p * 4.712) * wave);
    }
    ctx.lineTo(ix + iw, iy + ih);
    ctx.closePath();
    ctx.fillStyle = liquid; ctx.fill();
    ctx.beginPath();
    for (var j = 0; j <= 24; j++) {
      var q = j / 24;
      var px = ix + iw * q, py = surface + Math.sin(t * 1.9 + q * 4.712) * wave;
      if (j === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.strokeStyle = "rgba(234,251,255,0.80)"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();

    // cangkang luar
    ctx.strokeStyle = "rgba(127,216,255,0.67)"; ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, br); ctx.stroke();

    if (charging) {
      var cx = bx + bw / 2, cy = by + bh / 2, bh2 = bh * 0.62;
      ctx.beginPath();
      ctx.moveTo(cx + bh2 * 0.16, cy - bh2 * 0.5);
      ctx.lineTo(cx - bh2 * 0.20, cy + bh2 * 0.06);
      ctx.lineTo(cx + bh2 * 0.02, cy + bh2 * 0.06);
      ctx.lineTo(cx - bh2 * 0.14, cy + bh2 * 0.5);
      ctx.lineTo(cx + bh2 * 0.24, cy - bh2 * 0.04);
      ctx.lineTo(cx + bh2 * 0.02, cy - bh2 * 0.04);
      ctx.closePath();
      ctx.fillStyle = "rgba(234,251,255,0.95)"; ctx.fill();
    }

    // teks persen
    ctx.font = "700 20px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#EAFBFF";
    ctx.shadowColor = "rgba(127,216,255,0.6)"; ctx.shadowBlur = 12;
    ctx.fillText(Math.round(level * 100) + "%", bx + bw + 12, H / 2 + 7);
    ctx.shadowBlur = 0;
    ctx.restore();

    // rim light: terang di atas, redup di bawah
    var rim = ctx.createLinearGradient(0, 0, 0, H);
    rim.addColorStop(0, "rgba(191,239,255,0.80)");
    rim.addColorStop(1, "rgba(111,168,192,0.29)");
    ctx.strokeStyle = rim; ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, W - 2, H - 2, R); ctx.stroke();
  }

  function loop(now) {
    if (!last) { last = now; }
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    phase += dt * 0.28;
    if (phase > 1) { phase -= 1; }
    drawBattery(now / 1000);
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
