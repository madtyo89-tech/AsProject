#!/usr/bin/env python3
"""Samakan STRUKTUR (urutan & bagian) template tema turunan dengan referensi Drive.

Dijalankan SETELAH buat-tema-turunan.py, karena mengubah file hasilnya:
  - undangan-ice-blue-template.html         -> struktur "Premium Wedding" (Akad & Resepsi, buku tamu, penutup)
  - undangan-khitanan-basic-template.html   -> struktur "Khitanan Basic" (Save the Date, Doa, Buku Tamu)
  - undangan-khitanan-premium-template.html -> struktur "Khitanan Premium" (Detail, Doa Khitan, Konfirmasi & Doa)

Bagian yang tidak ada di referensi (Love Story, Galeri, Dress Code, Lokasi terpisah)
dihapus. Lokasi sudah ada di bagian Detail Acara. Isi tiap bagian diambil dari file
hasil sebelumnya, jadi token, tautan, dan skrip tetap utuh.

  python3 susun-struktur.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

PENANDA = re.compile(r"  <!-- ============ (.+?) ============ -->\n")
AWAL = "  <!-- ============ QUOTE & MEMPELAI ============ -->"
AKHIR = "  <!-- ============ FOOTER ============ -->"

DOA_BLOK = """  <!-- ============ DOA ============ -->
  <section style="background:var(--sage-soft)">
    <svg class="fl tl" viewBox="0 0 120 120"><use href="#corner-sage"/></svg>
    <div class="reveal">
      <div class="sec-sub">{SUB}</div>
      <h2 class="sec-title">{JUDUL}</h2>
      <div class="divider"><svg width="18" height="18" viewBox="-9 -9 18 18"><use href="#div-flower"/></svg></div>
      <p class="quote-txt">"{KUTIPAN}"</p>
      <p class="quote-txt" style="font-style:normal;font-size:13px;margin-top:6px">{SUMBER}</p>
    </div>
    <svg class="fl br" viewBox="0 0 120 120"><use href="#corner-sage"/></svg>
  </section>

"""

KONFIG = {
    "undangan-ice-blue-template.html": {
        "urutan": ["QUOTE & MEMPELAI", "DETAIL ACARA", "COUNTDOWN", "RSVP", "AMPLOP DIGITAL", "PENUTUP"],
        "ganti": [],
    },
    "undangan-khitanan-basic-template.html": {
        "urutan": ["QUOTE & MEMPELAI", "DETAIL ACARA", "COUNTDOWN", "DOA", "RSVP", "PENUTUP"],
        "doa": {"SUB": "Doa &amp; Harapan", "JUDUL": "Doa Khitan",
                "KUTIPAN": "Semoga Allah memberkahi usia, rezeki &amp; ilmunya.",
                "SUMBER": "Keluarga Besar {{AYAH_ORTU}} &amp; {{IBU_ORTU}}"},
        "ganti": [
            ('<div class="mini">Syukuran Khitanan</div>', '<div class="mini">Tasyakuran Khitanan</div>'),
            ('<h2 class="sec-title">Syukuran Khitanan</h2>', '<h2 class="sec-title">Tasyakuran Khitanan</h2>'),
            ("<p>Putra dari Bapak {{AYAH_ORTU}}<br>&amp; Ibu {{IBU_ORTU}}</p>",
             "<p>Putra dari pasangan<br>Ayahanda {{AYAH_ORTU}}<br>Ibunda {{IBU_ORTU}}</p>"),
            ('<div class="sec-sub">Konfirmasi Kehadiran</div>\n      <h2 class="sec-title">RSVP</h2>',
             '<div class="sec-sub">Buku Tamu</div>\n      <h2 class="sec-title">Ucapan &amp; Doa</h2>'),
            ("<p>Atas doa dan kehadiran Bapak/Ibu/Saudara/i</p>",
             "<p>Wassalamualaikum Wr. Wb.<br>Keluarga Besar</p>"),
        ],
    },
    "undangan-khitanan-premium-template.html": {
        "urutan": ["QUOTE & MEMPELAI", "DETAIL ACARA", "COUNTDOWN", "DOA", "RSVP", "PENUTUP"],
        "doa": {"SUB": "Doa Khitan", "JUDUL": "Doa untuk Ananda",
                "KUTIPAN": "Semoga Allah menjadikannya anak yang sholeh dan berbakti.",
                "SUMBER": "Dengan penuh rasa syukur"},
        "ganti": [
            ('<div class="mini">Syukuran Khitanan</div>', '<div class="mini">Walimatul Khitan</div>'),
            ('<h2 class="sec-title">Syukuran Khitanan</h2>', '<h2 class="sec-title">Walimatul Khitan</h2>'),
            ('"Tumbuh sehat dan berbakti, menuju ridha-Nya."',
             '"Setiap anak dilahirkan di atas fitrah."<br>— HR. Bukhari &amp; Muslim'),
            ("<p>Putra dari Bapak {{AYAH_ORTU}}<br>&amp; Ibu {{IBU_ORTU}}</p>",
             "<p>Putra tercinta dari<br>Ayahanda {{AYAH_ORTU}}<br>&amp; Ibunda {{IBU_ORTU}}</p>"),
            ('<div class="sec-sub">Konfirmasi Kehadiran</div>\n      <h2 class="sec-title">RSVP</h2>',
             '<div class="sec-sub">Konfirmasi &amp; Doa</div>\n      <h2 class="sec-title">Kehadiran dan doa restu</h2>'),
            ("<p>Atas doa dan kehadiran Bapak/Ibu/Saudara/i</p>",
             "<p>Dengan penuh rasa syukur</p>"),
        ],
    },
}


def bagi_bagian(s):
    """Pisahkan area frame menjadi bagian bernama. Kembalikan (kepala, {nama: isi}, ekor)."""
    awal = s.index(AWAL)
    akhir = s.index(AKHIR)
    kepala, area, ekor = s[:awal], s[awal:akhir], s[akhir:]
    potongan = PENANDA.split(area)  # [pra, nama1, isi1, nama2, isi2, ...]
    bagian = {}
    for i in range(1, len(potongan), 2):
        nama = potongan[i].strip()
        bagian[nama] = "  <!-- ============ %s ============ -->\n%s" % (nama, potongan[i + 1])
    return kepala, bagian, ekor


def susun(path, konfig):
    s = open(path, encoding="utf-8").read()
    if "doa" in konfig and "<!-- ============ DOA ============ -->" in s:
        print("sudah disusun, dilewati:", os.path.basename(path))
        return
    kepala, bagian, ekor = bagi_bagian(s)
    teks = ""
    for nama in konfig["urutan"]:
        if nama == "DOA":
            blok = DOA_BLOK
            for k, v in konfig["doa"].items():
                blok = blok.replace("{%s}" % k, v)
            teks += blok
        elif nama in bagian:
            teks += bagian[nama]
        else:
            raise SystemExit("bagian tidak ditemukan: %s di %s" % (nama, os.path.basename(path)))
    s2 = kepala + teks + ekor
    for lama, baru in konfig["ganti"]:
        if lama not in s2:
            print("   peringatan: tidak ditemukan di %s: %s" % (os.path.basename(path), lama[:60].replace("\n", " ")))
        s2 = s2.replace(lama, baru)
    open(path, "w", encoding="utf-8").write(s2)
    print("disusun:", os.path.basename(path), "->", " > ".join(konfig["urutan"]))


def main():
    for nama, konfig in KONFIG.items():
        susun(os.path.join(HERE, nama), konfig)


if __name__ == "__main__":
    main()
