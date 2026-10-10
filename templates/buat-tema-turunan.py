#!/usr/bin/env python3
"""Buat template tema turunan dari undangan-sage-template.html.

Menghasilkan:
  undangan-ice-blue-template.html         (pernikahan, palet biru es, Playfair)
  undangan-khitanan-basic-template.html   (khitanan, hijau terang, Amiri & Poppins)
  undangan-khitanan-premium-template.html (khitanan, hijau gelap + emas, Cormorant & Poppins)

Struktur & fitur (RSVP, galeri, musik, hitung mundur, ICS, dsb.) ikut dari sumber.
Sumber gaya: references/drive-katalog/ (ice blue, khitanan basic & premium).

  python3 buat-tema-turunan.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "undangan-sage-template.html")


def palet_sekali_jalan(s, peta):
    """Ganti warna secara bersamaan (satu lintasan) agar tidak saling menimpa."""
    pola = re.compile("|".join(re.escape(k) for k in sorted(peta, key=len, reverse=True)), re.I)
    return pola.sub(lambda m: peta[m.group(0).lower()], s)


def ganti_font_link(s, link):
    s = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+" rel="stylesheet">',
               link, s, count=1)
    return s


def ganti_teks(s, daftar):
    for lama, baru in daftar:
        if lama not in s:
            print("   peringatan: tidak ditemukan:", lama[:70])
        s = s.replace(lama, baru)
    return s


def hapus_blok(s, penanda_awal, penanda_akhir):
    i = s.find(penanda_awal)
    if i < 0:
        print("   peringatan: blok tidak ada:", penanda_awal)
        return s
    j = s.find(penanda_akhir, i + len(penanda_awal))
    return s[:i] + s[j:]


def link(*fam):
    return ('<link href="https://fonts.googleapis.com/css2?family=' + "&family=".join(fam) +
            '&display=swap" rel="stylesheet">')


# ---------- 1. ICE BLUE ----------
ICE_PALET = {
    "#c9a86a": "#0EA5E9", "#b8924f": "#0284C7", "#c0a062": "#0284C7", "#a67c2e": "#0369A1",
    "#caa14e": "#38BDF8", "#d8c7a0": "#BAE6FD", "#eadfc6": "#E0F2FE", "#ecd9ab": "#BAE6FD",
    "#f6ead0": "#F0F9FF", "#fdf6e3": "#F0F9FF", "#fbf6ec": "#F0F9FF", "#f5f2eb": "#F0F9FF",
    "#fffdf6": "#F8FDFF", "#eadfc6": "#E0F2FE", "#e4ddc9": "#BAE6FD", "#eee8d8": "#E0F2FE",
    "#efe9da": "#E0F2FE", "#ded9ca": "#DDEFFA", "#1a1a1a": "#0c4a6e", "#3a3f31": "#0c4a6e",
    "#4a4a44": "#075985", "#7a7a72": "#5B7A8C", "#83876f": "#5B7A8C", "#5a5f4c": "#075985",
    "#8a6a1f": "#0369A1", "#d8b4ad": "#BAE6FD", "#e8cabb": "#BAE6FD", "#f0ddc4": "#E0F2FE",
    "#e4c0ae": "#BAE6FD", "#ead3b2": "#E0F2FE", "#cfc7ad": "#BAE6FD", "#dcd3b8": "#BAE6FD",
    "#d8d2bd": "#BAE6FD", "#ddd5c0": "#BAE6FD", "#e8e2cc": "#E0F2FE", "#e6f2fd": "#E0F2FE",
    "#93a583": "#7DD3FC", "#6d7259": "#0369A1", "#62674f": "#075985", "#cdd6bc": "#BAE6FD",
    "#b98d3e": "#0EA5E9", "#eef1e6": "#F0F9FF", "#fbf6ec ": "#F0F9FF",
}


def buat_ice(s):
    s = palet_sekali_jalan(s, ICE_PALET)
    s = s.replace("'Cormorant Garamond'", "'Playfair Display'")
    s = ganti_font_link(s, link("Playfair+Display:ital,wght@0,400;0,600;0,700;1,400", "Poppins:wght@300;400;500;600;700"))
    s = s.replace("-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif",
                  "Poppins,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif", 1)
    s = ganti_teks(s, [
        ("<title>The Wedding of {{NAMA_PENGANTIN_WANITA}} &amp; {{NAMA_PENGANTIN_PRIA}} — {{TANGGAL_TITLE}}</title>",
         "<title>The Wedding of {{NAMA_PENGANTIN_WANITA}} &amp; {{NAMA_PENGANTIN_PRIA}} — {{TANGGAL_TITLE}}</title>"),
    ])
    return s


# ---------- 2. KHITANAN (dasar & premium) ----------
def khitanan_teks(s):
    s = ganti_teks(s, [
        ("<title>The Wedding of {{NAMA_PENGANTIN_WANITA}} &amp; {{NAMA_PENGANTIN_PRIA}} — {{TANGGAL_TITLE}}</title>",
         "<title>Khitanan {{NAMA_ANAK}} — {{TANGGAL_TITLE}}</title>"),
        ('<div class="mini">The Wedding Of</div>', '<div class="mini">Syukuran Khitanan</div>'),
        ('<h1 class="script">{{NAMA_PENGANTIN_WANITA}} &amp; {{NAMA_PENGANTIN_PRIA}}</h1>',
         '<h1 class="script">{{NAMA_ANAK}}</h1>'),
        ('<h2 class="sec-title">The Wedding Of</h2>', '<h2 class="sec-title">Syukuran Khitanan</h2>'),
        ('<div class="script" style="font-size:34px;color:var(--sage-dark)">{{NAMA_PENGANTIN_WANITA}} &amp; {{NAMA_PENGANTIN_PRIA}}</div>',
         '<div class="script" style="font-size:34px;color:var(--sage-dark)">{{NAMA_ANAK}}</div>'),
        ('<span class="mono">R &amp; D</span>', '<span class="mono">{{INISIAL_ANAK}}</span>'),
        ('"Bersama dalam cinta, menuju ridha-Nya."', '"Tumbuh sehat dan berbakti, menuju ridha-Nya."'),
        ("kami bermaksud menyelenggarakan pernikahan putra-putri kami:",
         "kami bermaksud menyelenggarakan khitanan putra kami:"),
        ("<b>Akad Nikah</b>", "<b>Khitanan</b>"),
        ("<b>Resepsi</b>", "<b>Syukuran</b>"),
        ('<div class="sec-sub">Kado untuk Kami</div>', '<div class="sec-sub">Tanda Kasih</div>'),
        ("Bagi yang ingin memberikan kado pernikahan, bisa melalui rekening atau e-wallet berikut:",
         "Bagi yang ingin memberikan doa atau tanda kasih, bisa melalui rekening atau e-wallet berikut:"),
        ("Halo%2C%20saya%20sudah%20transfer%20kado%20untuk%20{{NAMA_PENGANTIN_WANITA_URL}}%20%26%20{{NAMA_PENGANTIN_PRIA_URL}}",
         "Halo%2C%20saya%20sudah%20transfer%20tanda%20kasih%20untuk%20{{NAMA_ANAK_URL}}"),
        ('1) Nama mempelai: cari "{{NAMA_PENGANTIN_WANITA}}" dan "{{NAMA_PENGANTIN_PRIA}}"',
         '1) Nama anak: cari "{{NAMA_ANAK}}"'),
        ("a.n. {{NAMA_LENGKAP_WANITA_REKENING}}", "a.n. {{NAMA_REKENING_1}}"),
        ("a.n. {{NAMA_LENGKAP_PRIA_REKENING}}", "a.n. {{NAMA_REKENING_2}}"),
        ('<div class="cl-date">{{TANGGAL_DOT}}</div>', '<div class="cl-date">{{TANGGAL_DOT}}</div>'),
    ])
    # sisa penanda pasangan di footer/penutup
    s = s.replace("{{NAMA_PENGANTIN_WANITA}} &amp; {{NAMA_PENGANTIN_PRIA}}", "{{NAMA_ANAK}}")
    # blok pasangan -> blok anak & orang tua
    awal = s.find('<div class="couple">')
    akhir = s.find("</div>", s.find("</p>", s.find("{{AYAH_PRIA}}", awal)) ) + len("</div>")
    if awal >= 0 and akhir > awal:
        s = s[:awal] + (
            '<div class="couple">\n'
            '        <h3>{{NAMA_LENGKAP_ANAK}}</h3>\n'
            '        <p>Putra dari Bapak {{AYAH_ORTU}}<br>&amp; Ibu {{IBU_ORTU}}</p>\n'
            '      </div>'
        ) + s[akhir:]
    else:
        print("   peringatan: blok couple tidak ditemukan")
    # bagian love story dihapus (tidak relevan untuk khitanan)
    s = hapus_blok(s, "<!-- ============ LOVE STORY ============ -->", "<!-- ============")
    return s


def buat_khitanan_basic(s):
    peta = {
        "#c9a86a": "#4a7c59", "#b8924f": "#3d6a4b", "#c0a062": "#3d6a4b", "#a67c2e": "#2e5a3c",
        "#caa14e": "#6b9d7a", "#d8c7a0": "#c8e6c9", "#eadfc6": "#e8f5e9", "#ecd9ab": "#c8e6c9",
        "#f6ead0": "#f1f8e9", "#fdf6e3": "#f6fbf6", "#fbf6ec": "#f1f8e9", "#f5f2eb": "#fcfdf8",
        "#fffdf6": "#fcfdf8", "#e4ddc9": "#c8e6c9", "#eee8d8": "#e8f5e9", "#efe9da": "#e8f5e9",
        "#ded9ca": "#e4efe5", "#1a1a1a": "#1f3d2a", "#3a3f31": "#1f3d2a", "#4a4a44": "#2e4a37",
        "#7a7a72": "#5f7a68", "#83876f": "#5f7a68", "#5a5f4c": "#2e4a37", "#8a6a1f": "#2e5a3c",
        "#d8b4ad": "#c8e6c9", "#e8cabb": "#c8e6c9", "#f0ddc4": "#e8f5e9", "#e4c0ae": "#c8e6c9",
        "#ead3b2": "#e8f5e9", "#cfc7ad": "#c8e6c9", "#dcd3b8": "#c8e6c9", "#d8d2bd": "#c8e6c9",
        "#ddd5c0": "#c8e6c9", "#e8e2cc": "#e8f5e9", "#e6f2fd": "#e8f5e9", "#93a583": "#a5d6a7",
        "#6d7259": "#3d6a4b", "#62674f": "#2e4a37", "#cdd6bc": "#c8e6c9", "#b98d3e": "#4a7c59",
        "#eef1e6": "#e8f5e9",
    }
    s = palet_sekali_jalan(s, peta)
    s = s.replace("'Cormorant Garamond'", "'Amiri'")
    s = s.replace("'Playfair Display'", "'Amiri'")
    s = ganti_font_link(s, link("Amiri:ital,wght@0,400;0,700;1,400", "Poppins:wght@300;400;500;600;700"))
    s = s.replace("-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif",
                  "Poppins,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif", 1)
    return khitanan_teks(s)


def buat_khitanan_premium(s):
    # palet gelap: latar hijau sangat gelap, teks krem, aksen emas
    peta = {
        "#c9a86a": "#d4af37", "#b8924f": "#c9a54a", "#c0a062": "#c9a54a", "#a67c2e": "#b8923a",
        "#caa14e": "#e8c95a", "#d8c7a0": "#8c6d1f", "#eadfc6": "#17382b", "#ecd9ab": "#2a4a3c",
        "#f6ead0": "#0e271d", "#fdf6e3": "#0e271d", "#fbf6ec": "#122e25", "#f5f2eb": "#0a1f18",
        "#fffdf6": "#0e271d", "#fff": "#0e271d", "#ffffff": "#0e271d", "#e4ddc9": "#2a4a3c",
        "#eee8d8": "#1d3d30", "#efe9da": "#17382b", "#ded9ca": "#050d09", "#1a1a1a": "#f5ecd2",
        "#3a3f31": "#f5ecd2", "#4a4a44": "#e8dcc0", "#7a7a72": "#b9c4a8", "#83876f": "#b9c4a8",
        "#5a5f4c": "#e8dcc0", "#8a6a1f": "#e8c95a", "#d8b4ad": "#2a4a3c", "#e8cabb": "#2a4a3c",
        "#f0ddc4": "#17382b", "#e4c0ae": "#2a4a3c", "#ead3b2": "#17382b", "#cfc7ad": "#2a4a3c",
        "#dcd3b8": "#2a4a3c", "#d8d2bd": "#2a4a3c", "#ddd5c0": "#2a4a3c", "#e8e2cc": "#17382b",
        "#e6f2fd": "#17382b", "#93a583": "#8fae94", "#6d7259": "#b9c4a8", "#62674f": "#b9c4a8",
        "#cdd6bc": "#2a4a3c", "#b98d3e": "#d4af37", "#eef1e6": "#122e25",
    }
    s = palet_sekali_jalan(s, peta)
    s = s.replace("'Playfair Display'", "'Cormorant Garamond'")
    s = ganti_font_link(s, link("Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400",
                                "Poppins:wght@300;400;500;600;700"))
    s = s.replace("-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif",
                  "Poppins,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif", 1)
    return khitanan_teks(s)


def main():
    base = open(SRC, encoding="utf-8").read()
    hasil = {
        "undangan-ice-blue-template.html": buat_ice(base),
        "undangan-khitanan-basic-template.html": buat_khitanan_basic(base),
        "undangan-khitanan-premium-template.html": buat_khitanan_premium(base),
    }
    for nama, isi in hasil.items():
        open(os.path.join(HERE, nama), "w", encoding="utf-8").write(isi)
        print("dibuat:", nama)


if __name__ == "__main__":
    main()
