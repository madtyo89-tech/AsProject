#!/usr/bin/env python3
"""Terapkan gaya Premium (emas & serif) ke template undangan.

Mengganti palet warna dan font dasar di dua template dengan palet dari
"Premium Wedding" (referensi di references/drive-katalog/). Jalankan sekali
pada file template; file sumber di katalog-demo/ tidak diubah.

  python3 premiumkan.py          # memproses kedua template
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

FONT_LINK = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400'
    '&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">\n'
)

# palet sumber -> palet premium
PAL_SAGE = {
    "#7c8b6a": "#C9A86A",  # sage utama -> emas
    "#4e5a3d": "#1A1A1A",  # sage gelap -> hitam hangat
    "#c0a062": "#B8924F",  # emas -> emas tua
    "#3a3f31": "#1A1A1A",  # ink
    "#83876f": "#7A7A72",  # muted
    "#5a5f4c": "#4A4A44",
    "#f7f4ec": "#F5F2EB",  # cream
    "#eef1e6": "#FBF6EC",  # sage-soft -> krem terang
    "#a8b598": "#D8C7A0",
    "#c9dcb4": "#EADFC6",
}

PAL_DEMO = {
    "#1e4d3b": "#1A1A1A",  # hijau utama -> hitam hangat
    "#102b21": "#0F0F0F",  # hijau gelap
    "#8fae94": "#A9A294",
    "#eef3ec": "#FBF6EC",
    "#b98d3e": "#C9A86A",  # emas
    "#caa14e": "#D4B57A",
    "#a67c2e": "#A8884A",
    "#e5cf9a": "#E8D9B5",
    "#f7f2e7": "#F5F2EB",
    "#fdfaf3": "#FFFBF2",
}

TEMPLATES = {
    "undangan-sage-template.html": PAL_SAGE,
    "undangan-demo-template.html": PAL_DEMO,
}


def terapkan(path, palet):
    s = open(path, encoding="utf-8").read()
    if "fonts.googleapis.com" in s:
        print("sudah diproses, dilewati:", os.path.basename(path))
        return
    # warna (huruf kecil & besar)
    for lama, baru in palet.items():
        s = re.sub(re.escape(lama), baru, s, flags=re.I)
    # font serif dasar -> Cormorant Garamond (judul & teks serif)
    s = s.replace("Georgia,serif", "'Cormorant Garamond',Georgia,serif")
    s = s.replace('Georgia,"Times New Roman",serif', "'Cormorant Garamond',Georgia,serif")
    # tambahkan Google Fonts setelah meta viewport
    s = re.sub(r'(<meta name="viewport"[^>]*>\n)', r"\1" + FONT_LINK.replace("\\", "\\\\"), s, count=1)
    open(path, "w", encoding="utf-8").write(s)
    print("diproses:", os.path.basename(path))


def main():
    for nama, palet in TEMPLATES.items():
        terapkan(os.path.join(HERE, nama), palet)


if __name__ == "__main__":
    main()
