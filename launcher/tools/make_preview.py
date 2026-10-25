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


def neonize(icon: Image.Image, size: int = S) -> Image.Image:
    """Salinan algoritma NeonIconFactory.java (peta cahaya + 3 lapis glow)."""
    pixels = np.asarray(icon.convert("RGBA")).astype(np.float32)
    alpha = pixels[..., 3] / 255.0
    luminance = (0.299 * pixels[..., 0] + 0.587 * pixels[..., 1] + 0.114 * pixels[..., 2]) * alpha

    band = max(2, round(size * 0.12))
    mask = np.zeros((size, size), bool)
    mask[:band, :] = True
    mask[-band:, :] = True
    mask[:, :band] = True
    mask[:, -band:] = True
    border = float(luminance[mask].mean())

    lo, hi = round(size * 0.3), round(size * 0.7)
    center = float(luminance[lo:hi, lo:hi].mean())
    polarity = -1.0 if center + 6 < border else 1.0
    delta = (luminance - border) * polarity
    peak = max(float(delta.max()), 1.0)
    low, high = peak * 0.20, peak * 0.92
    if float((delta > low).mean()) > 0.5:
        low, high = peak * 0.45, peak * 0.97
    t = np.clip((delta - low) / max(1e-6, high - low), 0, 1)
    strength = t * t * (3 - 2 * t)

    glass = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(glass)
    for y in range(size):
        f = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=(int(0x12 + (0x07 - 0x12) * f),
                                              int(0x18 + (0x0a - 0x18) * f),
                                              int(0x21 + (0x0f - 0x21) * f), 255))
    tile_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                                radius=int(size * 0.23), fill=255)
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(glass, (0, 0), tile_mask)

    glow_source = Image.fromarray((np.clip(strength, 0, 1) * 255).astype(np.uint8), "L")
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for blur, color, amount in ((size * 0.10, (127, 216, 255), 0.65),
                                (size * 0.045, (127, 216, 255), 0.9),
                                (size * 0.010, (230, 249, 255), 1.0)):
        blurred = glow_source.filter(ImageFilter.GaussianBlur(blur))
        layer = Image.new("RGBA", (size, size), color + (0,))
        layer.putalpha(blurred.point(lambda v: int(v * amount)))
        glow = Image.alpha_composite(glow, layer)

    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(glow, (0, 0), tile_mask)
    out = Image.alpha_composite(tile, clipped)
    ImageDraw.Draw(out).rounded_rectangle([1, 1, size - 2, size - 2],
                                          radius=int(size * 0.23),
                                          outline=(127, 216, 255, 120), width=2)
    return out


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
    color:var(--neon-soft);padding:calc(var(--dp)*4) calc(var(--dp)*8);border-radius:calc(var(--dp)*3);
    border:1px solid rgba(127,216,255,.4);background:rgba(6,12,20,.35);
    text-shadow:0 0 calc(var(--dp)*6) rgba(127,216,255,.45)}
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
    background:rgba(7,11,18,.94);border:1px solid rgba(127,216,255,.34);overflow:hidden;
    font-family:ui-monospace,Menlo,monospace}
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
            <div class="chips"><span class="chip">BATERAI 74%</span><span class="chip">SISTEM AKTIF</span></div>
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
      <div class="hint">HUD menampilkan jam (detik berjalan), baterai, dan suhu baterai asli perangkat.</div>
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

  tick();
  setInterval(tick, 1000);
})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    build()
