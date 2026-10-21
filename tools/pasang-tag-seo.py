#!/usr/bin/env python3
"""Pasang tag SEO dasar (canonical, description, Open Graph, twitter card) pada
halaman publik yang didaftarkan di sitemap.xml.

Latar belakang (2026-10-20): `site:asproject.my.id` masih 0 hasil. Penyebab yang
bisa diperbaiki dari repo: puluhan halaman publik tidak punya <link rel="canonical">
dan sebagian tanpa <meta name="description">, sehingga Google melihat banyak
salinan mirip tanpa penanda halaman utama.

Skrip ini idempoten: halaman yang sudah punya canonical tidak diubah lagi.
Jalankan dari akar repo:

    python3 tools/pasang-tag-seo.py            # pasang
    python3 tools/pasang-tag-seo.py --cek      # hanya laporkan yang belum lengkap
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASAL = "https://asproject.my.id"
OG_IMAGE = f"{ASAL}/assets/og-asproject.png"

# path relatif → deskripsi (None = pertahankan deskripsi yang sudah ada)
DESKRIPSI = {
    "demo/aqiqah.html": "Demo undangan aqiqah online AsProject: tema Baby Boy, Baby Girl, dan Islamic Neutral dengan amplop digital, RSVP, peta lokasi, dan galeri foto.",
    "demo/ice-blue.html": "Demo undangan pernikahan Ice Blue: palet biru es, kartu glass, countdown, RSVP, peta lokasi, dan amplop digital. Contoh undangan online AsProject.",
    "demo/khitanan-basic.html": "Demo undangan khitanan tema Green Basic: nuansa islami hijau, ayat dan doa, peta lokasi, RSVP, serta amplop digital dari AsProject.",
    "demo/khitanan-premium.html": "Demo undangan khitanan tema Emerald Gold Premium: hijau zamrud dan emas, slide acara, galeri, RSVP, peta lokasi, dan amplop digital.",
    "demo/ultah-anak.html": "Demo undangan ulang tahun anak: warna ceria, countdown hari-H, peta lokasi, RSVP, galeri foto, dan amplop digital dari AsProject.",
    "demo/wedding-premium.html": "Demo undangan pernikahan premium: cover elegan, hitung mundur, RSVP, peta lokasi, galeri, dan amplop digital. Contoh undangan online AsProject.",
    "katalog-demo/index.html": "Katalog tema undangan digital AsProject: pernikahan, khitanan, ulang tahun, dan aqiqah. Setiap tema bisa dibuka langsung sebagai demo di browser.",
    "katalog-demo/galeri-kerangka.html": "Galeri pratinjau 24 tema undangan AsProject yang dirender langsung oleh mesin undangan asli, lengkap dengan label kerangka tiap tema.",
    "katalog-demo/perbandingan-tema.html": "Bandingkan 24 tema undangan AsProject berdampingan: palet warna, font, pola latar, dan diagram kerangka tiap tema dalam satu layar.",
    "katalog-demo/undangan-aqiqah-natural.html": None,
    "katalog-demo/undangan-demo.html": "Demo undangan pernikahan adat Jawa bernuansa emerald gold: rangkaian acara, galeri, RSVP, peta lokasi, dan amplop digital dari AsProject.",
    "katalog-demo/undangan-khitanan-basic.html": "Demo undangan khitanan tema Green Basic: halaman mandiri dengan ayat, susunan acara, peta lokasi, RSVP, dan amplop digital dari AsProject.",
    "katalog-demo/undangan-khitanan-emerald.html": None,
    "katalog-demo/undangan-khitanan-premium.html": "Demo undangan khitanan tema Emerald Gold Premium: kartu lipat arch, ornamen emas, susunan acara, galeri, RSVP, dan amplop digital AsProject.",
    "katalog-demo/undangan-luxury-gold.html": None,
    "katalog-demo/undangan-luxury-seal.html": "Demo undangan pernikahan Luxury Invitation No. 001: segel lilin interaktif, kartu yang bisa dibalik, timeline, galeri, dan RSVP. Karya mandiri AsProject.",
    "katalog-demo/undangan-sage.html": "Demo undangan pernikahan Sage Blossom bernuansa sage dan ivory: cover elegan, rangkaian acara, galeri, RSVP, dan amplop digital dari AsProject.",
    "katalog-demo/undangan-sky-blue.html": "Demo undangan pernikahan tema Sky Blue: palet biru langit, kartu kaca, countdown, peta lokasi, RSVP, dan amplop digital dari AsProject.",
    "katalog-demo/undangan-ulang-tahun-ceria.html": None,
    "katalog-demo/undangan-wedding-gold.html": "Demo undangan pernikahan tema Luxury Gold: hitam emas, ornamen klasik, susunan acara, galeri, RSVP, dan amplop digital dari AsProject.",
    "katalog-demo/undangan-wedding-midnight-navy.html": None,
    "katalog-demo/undangan-wedding-rosewood.html": None,
    "katalog-demo/undangan-wedding-sage-pearl.html": None,
}


def esc(s):
    """Escape untuk atribut HTML tanpa merusak entitas yang sudah ada
    (`&amp;` pada <title> tidak boleh jadi `&amp;amp;`)."""
    s = re.sub(r"&(?![#A-Za-z0-9]+;)", "&amp;", s)
    return s.replace('"', "&quot;")


def judul_dari(html):
    m = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else "AsProject"


def bangun_tag(rel, html, deskripsi):
    url = f"{ASAL}/{rel}"
    judul = judul_dari(html)
    baris = [
        f'<link rel="canonical" href="{url}">',
        '<meta name="robots" content="index, follow">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="AsProject">',
        f'<meta property="og:title" content="{esc(judul)}">',
        f'<meta property="og:description" content="{esc(deskripsi)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{OG_IMAGE}">',
        '<meta property="og:locale" content="id_ID">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    return "\n".join("  " + b for b in baris)


def pasang(rel, uji_saja):
    path = os.path.join(ROOT, rel)
    html = open(path, encoding="utf-8").read()
    if 'rel="canonical"' in html:
        return "sudah"
    deskripsi = DESKRIPSI.get(rel)
    m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I)
    if m:
        deskripsi = deskripsi or m.group(1)
    if not deskripsi:
        return "lewat (tanpa deskripsi)"
    if uji_saja:
        return "belum"

    tag = bangun_tag(rel, html, deskripsi)

    if m:  # sisipkan tepat setelah meta description
        akhir = m.end()
        # lompati sisa tag <meta ...> yang sama
        akhir = html.index(">", akhir) + 1
        baru = html[:akhir] + "\n" + tag + html[akhir:]
    else:
        judul = re.search(r"</title>", html, re.I)
        if not judul:
            return "GAGAL: tidak ada <title>"
        # tambahkan juga meta description bila halaman belum punya
        sisip = f'\n  <meta name="description" content="{esc(deskripsi)}">\n' + tag
        baru = html[: judul.end()] + sisip + html[judul.end():]

    open(path, "w", encoding="utf-8").write(baru)
    return "dipasang"


def main():
    uji_saja = "--cek" in sys.argv
    hasil = {}
    for rel in DESKRIPSI:
        hasil.setdefault(pasang(rel, uji_saja), []).append(rel)
    for k in sorted(hasil):
        print(f"[{k}] {len(hasil[k])} halaman")
        for rel in hasil[k]:
            print("   ", rel)
    if uji_saja and "belum" in hasil:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
