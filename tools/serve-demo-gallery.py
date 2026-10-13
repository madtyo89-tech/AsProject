#!/usr/bin/env python3
"""Serve the six standalone invitation demos as a local gallery on port 8081.

Run from any directory with: python3 tools/serve-demo-gallery.py
Set PORT to override the port. Binds to 0.0.0.0 for the Arena live preview.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import os

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "8081"))
PAGES = [
    ("Rosewood", "Pernikahan", "Blush · Champagne", "#C78676", "undangan-wedding-rosewood.html"),
    ("Sage Pearl", "Pernikahan", "Sage · Ivory", "#9AAB87", "undangan-wedding-sage-pearl.html"),
    ("Midnight Navy", "Pernikahan", "Navy · Champagne", "#B89454", "undangan-wedding-midnight-navy.html"),
    ("Khitanan Emerald", "Khitanan", "Emerald · Gold", "#D4AF37", "undangan-khitanan-emerald.html"),
    ("Aqiqah Natural", "Aqiqah", "Ivory · Sand", "#B89A63", "undangan-aqiqah-natural.html"),
    ("Ulang Tahun Ceria", "Ulang Tahun", "Plum · Coral", "#EE9B77", "undangan-ulang-tahun-ceria.html"),
]


def card(name, category, palette, accent, filename):
    return (
        f'<a class="card" style="--accent:{accent}" '
        f'href="/katalog-demo/{filename}">'
        f'<span class="pill">{category}</span><span class="swatch"></span>'
        f'<h2>{name}</h2><p>{palette}</p><span class="cta">BUKA DEMO ↗</span></a>'
    )


HUB = """<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#171a17">
<title>Demo Undangan — AsProject.My.Id</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:48px 20px;color:#f8f5ef;
background:radial-gradient(ellipse at 50% 0,#25332d,#101311 65%);font:16px/1.5 Inter,system-ui,sans-serif}
.wrap{max-width:980px;margin:auto}.eyebrow{color:#c6ab70;letter-spacing:.22em;font-size:11px;font-weight:700}
.head{padding:20px 0 32px}.head h1{font:500 clamp(36px,7vw,62px)/1.02 Georgia,serif;margin:14px 0}
.head h1 em{color:#d6c8a4}.head p{color:#c6c8c0;max-width:650px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.card{display:flex;flex-direction:column;min-height:180px;padding:22px;border-radius:20px;border:1px solid #ffffff26;
background:linear-gradient(145deg,#ffffff13,#ffffff06);text-decoration:none;color:inherit;transition:transform .2s,border-color .2s}
.card:hover{transform:translateY(-4px);border-color:var(--accent)}.pill{font-size:11px;color:#d5d7ce;letter-spacing:.12em;text-transform:uppercase}
.swatch{width:34px;height:4px;border-radius:5px;background:var(--accent);margin:16px 0 12px}
.card h2{font:500 25px/1.2 Georgia,serif;margin:0 0 5px}.card p{color:#bec1b8;margin:0}
.cta{margin-top:auto;padding-top:19px;color:#ead6a2;font-size:13px;font-weight:700}
.foot{color:#8f9589;font-size:12px;margin:30px 2px 0}
.lux{display:inline-block;color:#e7d5a3;text-decoration:none;border-bottom:1px solid #e7d5a355;margin-top:22px;font-size:13px}
.lux:focus-visible,.card:focus-visible{outline:2px solid #e7d5a3;outline-offset:4px}
@media(max-width:600px){body{padding:28px 16px}.grid{grid-template-columns:1fr}}
</style></head><body><main class="wrap"><header class="head">
<div class="eyebrow">ASPROJECT.MY.ID · KOLEKSI DEMO</div>
<h1>Undangan, dengan<br><em>cerita yang berbeda.</em></h1>
<p>Enam demo mandiri dengan amplop interaktif, personalisasi, RSVP lokal, galeri, peta, dan QR. Pilih desain untuk melihat pratinjau.</p>
</header><section class="grid">__CARDS__</section>
<a class="lux" href="/katalog-demo/undangan-luxury-gold.html">← Lihat juga demo Luxury Gold</a>
<p class="foot">RSVP pada halaman demo hanya tersimpan di browser. Setiap desain adalah halaman preview terpisah.</p>
</main></body></html>""".replace("__CARDS__", "\n".join(card(*page) for page in PAGES))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path in ("/", "/index.html"):
            payload = HUB.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()


class PreviewServer(ThreadingHTTPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    server = PreviewServer(("0.0.0.0", PORT), Handler)
    print(f"AsProject demo gallery ready on 0.0.0.0:{PORT}", flush=True)
    server.serve_forever()
