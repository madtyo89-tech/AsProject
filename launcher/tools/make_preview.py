#!/usr/bin/env python3
"""Buat pratinjau HTML mandiri (satu berkas) dari layout launcher + aset asli.

Aset yang dipakai sama dengan yang masuk ke APK:
  • assets/wallpaper/lock.jpg, home.jpg   (dikecilkan untuk pratinjau)
  • res/drawable-nodpi/ic_*.png           (8 ikon neon)

Keluaran: launcher/docs/pratinjau.html — tanpa berkas pendamping, bisa dibuka
langsung di peramban mana pun.

Cara pakai:
    python3 -m pip install --user pillow
    python3 launcher/tools/make_preview.py
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                                   # launcher/
APP = ROOT / "app" / "src" / "main"
WALL = APP / "assets" / "wallpaper"
ICONS = APP / "res" / "drawable-nodpi"
OUT = ROOT / "docs" / "pratinjau.html"

NEON = ["phone", "message", "camera", "settings", "music", "chrome", "whatsapp", "instagram"]


def jpeg_b64(path: Path, width: int, quality: int = 80) -> str:
    image = Image.open(path).convert("RGB")
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def png_b64(path: Path, size: int) -> str:
    image = Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def main() -> None:
    lock = jpeg_b64(WALL / "lock.jpg", 430, 82)
    home = jpeg_b64(WALL / "home.jpg", 430, 82)
    icons = {name: png_b64(ICONS / f"ic_{name}.png", 112) for name in NEON}

    icon_tags = "".join(
        f'.ic-{name}{{background-image:url("{icons[name]}")}}' for name in NEON
    )

    html = TEMPLATE.replace("__LOCK__", lock).replace("__HOME__", home).replace("__ICONS__", icon_tags)
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
    --dp:0.876px;                 /* 1dp pada ponsel 411dp yang digambar 360px */
    --ink:#0A0A0A; --gold:#D4AF37; --gold-soft:#F0DCA0;
    --neon:#7FD8FF; --neon-soft:#B3E8FF; --neon-dim:#4FA8D8;
    --text:#fff; --text2:#B3FFFFFF;
    --lock:url("__LOCK__");
    --home:url("__HOME__");
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{
    margin:0;min-height:100vh;padding:26px 16px 54px;
    background:#0c0c0e radial-gradient(70% 45% at 50% 0%,#101d29 0%,#0c0c0e 72%);
    color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
    display:flex;flex-direction:column;align-items:center;gap:20px;
  }
  header{text-align:center;max-width:660px}
  h1{margin:0 0 8px;font-size:18px;font-weight:600;letter-spacing:.01em}
  h1 span{color:var(--neon)}
  p.note{margin:0;font-size:12.5px;line-height:1.65;color:#8f9aa3}
  .stage{display:flex;gap:40px;flex-wrap:wrap;justify-content:center;align-items:flex-start;margin-top:6px}
  .col{display:flex;flex-direction:column;align-items:center}
  .caption{margin-top:12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7d8890}
  .hint{margin-top:5px;font-size:11px;color:#5f6a72;max-width:340px;text-align:center;line-height:1.5}

  /* ------------------------------------------------------------ bingkai ponsel */
  .phone{
    position:relative;width:360px;height:780px;border-radius:34px;overflow:hidden;
    box-shadow:0 28px 70px rgba(0,0,0,.75),0 0 0 7px #0a0a0b,0 0 0 8px #24262a;
    background:#05080c;
  }
  .statusbar{
    position:absolute;left:0;right:0;top:0;height:calc(var(--dp)*26);
    display:flex;align-items:center;justify-content:space-between;padding:0 calc(var(--dp)*16);
    font-size:calc(var(--dp)*11);letter-spacing:.02em;color:#e9eef2;opacity:.9;z-index:6;
  }
  .statusbar .right{display:flex;align-items:center;gap:calc(var(--dp)*4)}
  .sig{font-size:calc(var(--dp)*8.5);letter-spacing:.06em;opacity:.85}
  .bars{display:flex;align-items:flex-end;gap:1.5px;height:calc(var(--dp)*9)}
  .bars i{width:2.5px;background:#e9eef2;border-radius:1px}
  .batt{width:calc(var(--dp)*17);height:calc(var(--dp)*8.5);border:1px solid #e9eef2;border-radius:2px;position:relative}
  .batt::before{content:"";position:absolute;inset:1px;width:72%;background:#e9eef2;border-radius:1px}

  /* ------------------------------------------------------------ layar kunci */
  .lock{position:absolute;inset:0;z-index:4}
  .lock .bg{
    position:absolute;inset:0;background-image:var(--lock);
    background-size:contain;background-position:center;background-repeat:no-repeat;
    background-color:#0d1218;
  }
  .lock .veil{position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.28) 32%,rgba(0,0,0,.55) 74%,rgba(0,0,0,.82) 100%)}
  .lock .content{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
    padding:calc(var(--dp)*26) calc(var(--dp)*26) calc(var(--dp)*18);padding-top:calc(var(--dp)*44)}
  .chips{display:flex;justify-content:space-between;width:100%}
  .chip{
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:calc(var(--dp)*9);
    letter-spacing:.08em;color:var(--neon-soft);padding:calc(var(--dp)*4) calc(var(--dp)*8);
    border:1px solid rgba(127,216,255,.40);background:rgba(6,12,20,.35);border-radius:calc(var(--dp)*3);
    text-shadow:0 0 calc(var(--dp)*6) rgba(127,216,255,.5);white-space:nowrap;
  }
  .brand{margin-top:calc(var(--dp)*52);font-family:ui-monospace,Menlo,monospace;
    font-size:calc(var(--dp)*10);letter-spacing:.42em;color:var(--neon-dim);text-indent:.42em}
  .lock .clock{margin-top:calc(var(--dp)*6);font-size:calc(var(--dp)*78);font-weight:200;
    letter-spacing:-.035em;line-height:1;color:#fff;
    text-shadow:0 0 calc(var(--dp)*26) rgba(79,195,247,.55),0 0 calc(var(--dp)*4) rgba(180,230,255,.55)}
  .lock .date{margin-top:calc(var(--dp)*10);font-size:calc(var(--dp)*13);letter-spacing:.06em;
    color:var(--neon-soft);text-shadow:0 0 calc(var(--dp)*8) rgba(0,0,0,.5)}
  .grow{flex:1}
  .lockicon{width:calc(var(--dp)*20);height:calc(var(--dp)*20);opacity:.95}
  .lockicon svg{width:100%;height:100%;fill:var(--neon)}
  .unlockhint{margin-top:calc(var(--dp)*8);font-family:ui-monospace,Menlo,monospace;
    font-size:calc(var(--dp)*11);letter-spacing:.14em;color:rgba(255,255,255,.72)}
  .arrow{margin-top:calc(var(--dp)*6);width:calc(var(--dp)*18);height:calc(var(--dp)*18);opacity:.85}
  .arrow svg{width:100%;height:100%;fill:var(--neon)}
  .handle{margin-top:calc(var(--dp)*14);width:calc(var(--dp)*96);height:calc(var(--dp)*4);
    border-radius:calc(var(--dp)*3);background:rgba(127,216,255,.55)}

  /* ------------------------------------------------------------ beranda */
  .home{position:absolute;inset:0;z-index:2}
  .home .bg{position:absolute;inset:0;background-image:var(--home);background-size:cover;background-position:center}
  .home .veil{position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.20) 30%,rgba(0,0,0,.30) 62%,rgba(0,0,0,.72) 100%)}
  .home .content{position:absolute;inset:0;display:flex;flex-direction:column;
    padding:calc(var(--dp)*42) calc(var(--dp)*16) calc(var(--dp)*12)}
  .head{position:relative;text-align:center;padding-top:calc(var(--dp)*34)}
  .home .clock{font-size:calc(var(--dp)*66);font-weight:200;letter-spacing:-.035em;line-height:1;
    text-shadow:0 calc(var(--dp)*2) calc(var(--dp)*14) rgba(0,0,0,.6),0 0 calc(var(--dp)*20) rgba(79,195,247,.22)}
  .home .date{margin-top:calc(var(--dp)*6);font-size:calc(var(--dp)*14);letter-spacing:.04em;
    color:#dff2ff;text-shadow:0 0 calc(var(--dp)*10) rgba(0,0,0,.7)}
  .gear{position:absolute;right:0;top:calc(var(--dp)*-6);width:calc(var(--dp)*44);height:calc(var(--dp)*44);
    display:grid;place-items:center;opacity:.7}
  .gear svg{width:calc(var(--dp)*20);height:calc(var(--dp)*20);fill:#dfe7ec}
  .search{margin-top:calc(var(--dp)*18);height:calc(var(--dp)*52);border-radius:calc(var(--dp)*26);
    background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.14);
    display:flex;align-items:center;gap:calc(var(--dp)*12);padding:0 calc(var(--dp)*16);
    backdrop-filter:blur(2px)}
  .search svg{width:calc(var(--dp)*20);height:calc(var(--dp)*20);fill:rgba(255,255,255,.72)}
  .search span{font-size:calc(var(--dp)*16);color:rgba(255,255,255,.55)}
  .grid{margin-top:calc(var(--dp)*14);display:grid;grid-template-columns:repeat(4,1fr);
    gap:calc(var(--dp)*14) 0}
  .app{display:flex;flex-direction:column;align-items:center;gap:calc(var(--dp)*7)}
  .ico{width:calc(var(--dp)*52);height:calc(var(--dp)*52);border-radius:calc(var(--dp)*13);
    background-size:cover;background-position:center;position:relative}
  .ico.generic{background:linear-gradient(155deg,#2b3138,#1a1e23);display:grid;place-items:center;
    font-size:calc(var(--dp)*18);font-weight:600;color:#cfd6db;border:1px solid rgba(255,255,255,.08)}
  .app span{font-size:calc(var(--dp)*11);color:#f2f6f8;max-width:calc(var(--dp)*76);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 calc(var(--dp)*1) calc(var(--dp)*6) rgba(0,0,0,.9)}
  .dockwrap{flex:1;display:flex;align-items:flex-end}
  .dock{width:100%;height:calc(var(--dp)*76);border-radius:calc(var(--dp)*26);
    background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.12);
    display:flex;align-items:center;justify-content:space-around;padding:0 calc(var(--dp)*6)}
  .dock .ico{width:calc(var(--dp)*54);height:calc(var(--dp)*54);border-radius:calc(var(--dp)*14)}
  .navbar{height:calc(var(--dp)*22);display:flex;align-items:center;justify-content:center;
    gap:calc(var(--dp)*54);opacity:.55}
  .navbar i{display:block;width:calc(var(--dp)*13);height:calc(var(--dp)*13);border:1.6px solid #fff}
  .navbar i.tri{border:0;border-top:1.6px solid #fff;border-left:1.6px solid #fff;transform:rotate(-45deg)}
  .navbar i.cir{border-radius:50%}
  .navbar i.sq{border-radius:calc(var(--dp)*3)}

  /* ------------------------------------------------------------ pengaturan */
  .settings{position:absolute;inset:0;z-index:3;background:var(--ink);display:flex;flex-direction:column}
  .settings .top{display:flex;align-items:center;gap:calc(var(--dp)*8);
    padding:calc(var(--dp)*40) calc(var(--dp)*16) calc(var(--dp)*6)}
  .settings .top svg{width:calc(var(--dp)*20);height:calc(var(--dp)*20);fill:var(--gold-soft)}
  .settings .top b{font-size:calc(var(--dp)*19);font-weight:600}
  .settings .body{padding:0 calc(var(--dp)*22);overflow:hidden}
  .label{font-size:calc(var(--dp)*10.5);letter-spacing:.16em;text-transform:uppercase;
    color:var(--gold);font-weight:600;margin:calc(var(--dp)*20) 0 calc(var(--dp)*6)}
  .row{display:flex;justify-content:space-between;align-items:center;
    padding:calc(var(--dp)*12) 0;font-size:calc(var(--dp)*14.5)}
  .sw{width:calc(var(--dp)*42);height:calc(var(--dp)*24);border-radius:calc(var(--dp)*12);
    background:#3a3a3a;position:relative;flex:0 0 auto}
  .sw.on{background:rgba(127,216,255,.30);border:1px solid rgba(127,216,255,.55)}
  .sw::after{content:"";position:absolute;top:calc(var(--dp)*3);left:calc(var(--dp)*3);
    width:calc(var(--dp)*18);height:calc(var(--dp)*18);border-radius:50%;background:#c9c9c9}
  .sw.on::after{left:auto;right:calc(var(--dp)*3);background:var(--neon)}
  .thumbs{display:flex;gap:calc(var(--dp)*10);padding:calc(var(--dp)*4) 0}
  .thumbs div{flex:1;height:calc(var(--dp)*132);border-radius:calc(var(--dp)*14);
    border:1px solid rgba(212,175,55,.25);background-position:center;background-size:cover}
  .small{font-size:calc(var(--dp)*11.5);color:#9aa4ab;line-height:1.55;padding-top:calc(var(--dp)*6)}
  .btn{margin-top:calc(var(--dp)*12);height:calc(var(--dp)*46);border-radius:calc(var(--dp)*14);
    background:#1A1A1A;border:1px solid rgba(212,175,55,.25);display:grid;place-items:center;
    font-size:calc(var(--dp)*14);color:var(--gold-soft)}

  /* ikon neon (gambar asli dari res/drawable-nodpi) */
__ICONS__
  .ic-phone,.ic-message,.ic-camera,.ic-settings,.ic-music,.ic-chrome,.ic-whatsapp,.ic-instagram{
    background-size:cover;background-position:center;border-radius:calc(var(--dp)*13)}

  @media (max-width:820px){ .phone{transform:scale(.92);transform-origin:top center;margin-bottom:-60px} }
</style>
</head>
<body>
  <header>
    <h1>Pratinjau <span>AsProject Launcher</span> — wallpaper &amp; ikon neon</h1>
    <p class="note">Digambar dari layout asli (<code>activity_launcher.xml</code>, <code>view_lock_screen.xml</code>,
      <code>activity_settings.xml</code>) memakai <strong>wallpaper dan 8 ikon neon yang kamu kirim</strong>.
      Kotak abu-abu = aplikasi yang tidak punya versi ikon neon; di perangkat aslinya memakai ikon aplikasi itu sendiri.</p>
  </header>

  <div class="stage">
    <!-- ------------------------------------------------------------- layar kunci -->
    <div class="col">
      <div class="phone">
        <div class="statusbar">
          <span>22:51</span>
          <span class="right"><span class="sig">4G</span>
            <span class="bars"><i style="height:3px"></i><i style="height:5px"></i><i style="height:7px"></i><i style="height:9px"></i></span>
            <span class="batt"></span></span>
        </div>
        <div class="lock">
          <div class="bg"></div>
          <div class="veil"></div>
          <div class="content">
            <div class="chips">
              <span class="chip">BATERAI 74%</span>
              <span class="chip">SISTEM AKTIF</span>
            </div>
            <div class="brand">ASPROJECT SECURE</div>
            <div class="clock">22:51</div>
            <div class="date">Sabtu, 25 Oktober 2026</div>
            <div class="grow"></div>
            <div class="lockicon"><svg viewBox="0 0 24 24"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10zm-3-5a2 2 0 1 1-2-2 2 2 0 0 1 2 2z"/></svg></div>
            <div class="unlockhint">GESER KE ATAS UNTUK MEMBUKA</div>
            <div class="arrow"><svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></div>
            <div class="handle"></div>
          </div>
        </div>
      </div>
      <div class="caption">Layar kunci</div>
      <div class="hint">Muncul saat beranda dibuka dan setiap layar menyala. Bingkai tidak terpotong (mode <em>contain</em>).</div>
    </div>

    <!-- ------------------------------------------------------------- beranda -->
    <div class="col">
      <div class="phone">
        <div class="statusbar">
          <span>22:51</span>
          <span class="right"><span class="sig">4G</span>
            <span class="bars"><i style="height:3px"></i><i style="height:5px"></i><i style="height:7px"></i><i style="height:9px"></i></span>
            <span class="batt"></span></span>
        </div>
        <div class="home">
          <div class="bg"></div>
          <div class="veil"></div>
          <div class="content">
            <div class="head">
              <div class="clock">22:51</div>
              <div class="date">Sabtu, 25 Oktober 2026</div>
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
              <div class="app"><div class="ico generic">▶</div><span>Play Store</span></div>
              <div class="app"><div class="ico generic">M</div><span>Maps</span></div>
              <div class="app"><div class="ico generic">G</div><span>Gmail</span></div>
              <div class="app"><div class="ico generic">Y</div><span>YouTube</span></div>
              <div class="app"><div class="ico generic">D</div><span>Drive</span></div>
              <div class="app"><div class="ico generic">=</div><span>Kalkulator</span></div>
            </div>
            <div class="dockwrap">
              <div class="dock">
                <div class="ico ic-phone"></div>
                <div class="ico ic-message"></div>
                <div class="ico ic-chrome"></div>
                <div class="ico ic-camera"></div>
                <div class="ico generic">◍</div>
              </div>
            </div>
            <div class="navbar"><i class="tri"></i><i class="cir"></i><i class="sq"></i></div>
          </div>
        </div>
      </div>
      <div class="caption">Beranda</div>
      <div class="hint">Wallpaper neon mengisi layar (mode <em>cover</em>), ikon neon hanya untuk aplikasi yang terpasang.</div>
    </div>

    <!-- ------------------------------------------------------------- pengaturan -->
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
            <div class="small">Bingkai liquid-chrome dipakai di layar kunci, sirkuit neon di beranda.</div>
            <div class="row"><span>Pakai wallpaper neon AsProject</span><span class="sw on"></span></div>

            <div class="label">Layar kunci</div>
            <div class="row"><span>Aktifkan layar kunci</span><span class="sw on"></span></div>
            <div class="small">Muncul saat ponsel dibuka. Geser ke atas untuk masuk.</div>

            <div class="label">Ikon</div>
            <div class="row"><span>Ikon neon sirkuit</span><span class="sw on"></span></div>
            <div class="small">Phone, Message, Camera, Settings, Music, Chrome, WhatsApp, Instagram.</div>

            <div class="label">Tampilan</div>
            <div class="row"><span>Jam dan tanggal besar</span><span class="sw on"></span></div>
            <div class="row"><span>Kolom pencarian</span><span class="sw on"></span></div>
            <div class="row"><span>Nama aplikasi di bawah ikon</span><span class="sw on"></span></div>
          </div>
        </div>
      </div>
      <div class="caption">Pengaturan beranda</div>
      <div class="hint">Tiga sakelar baru: wallpaper neon, layar kunci, dan ikon neon.</div>
    </div>
  </div>
</body>
</html>
"""


if __name__ == "__main__":
    main()
