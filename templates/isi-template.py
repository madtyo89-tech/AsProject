#!/usr/bin/env python3
"""Isi template undangan dengan data pengantin.

Pemakaian:
  python3 isi-template.py sage data.json keluaran.html   # Sage Blossom
  python3 isi-template.py demo data.json keluaran.html   # Emerald Gold (Raka & Laras)
  python3 isi-template.py ice data.json keluaran.html    # Ice Blue (pernikahan)
  python3 isi-template.py khitanan-basic data.json keluaran.html
  python3 isi-template.py khitanan-premium data.json keluaran.html
  python3 isi-template.py data.json keluaran.html        # tanpa nama template = sage

Mulai dari contoh-data.json (sage, ice), contoh-data-khitanan.json (khitanan-*),
atau contoh-data-demo.json (demo).
Kunci yang kurang akan membuat script berhenti dan menyebut namanya,
supaya tidak ada placeholder {{...}} yang lolos ke undangan live.
"""
import json, os, re, sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = {
    "sage": os.path.join(HERE, "undangan-sage-template.html"),
    "ice": os.path.join(HERE, "undangan-ice-blue-template.html"),
    "khitanan-basic": os.path.join(HERE, "undangan-khitanan-basic-template.html"),
    "khitanan-premium": os.path.join(HERE, "undangan-khitanan-premium-template.html"),
    "demo": os.path.join(HERE, "undangan-demo-template.html"),
}
# template yang berbasis struktur sage (memakai pola nama & tanggal yang sama)
BERBASIS_SAGE = ("sage", "ice", "khitanan-basic", "khitanan-premium")


def url_enc(s):
    return quote(s, safe="")


def turunan(tpl, d):
    """Isi otomatis nilai yang bisa dihitung dari data dasar (hanya jika belum ada)."""
    def default(k, v):
        d.setdefault(k, v)

    if tpl in BERBASIS_SAGE:
        default("NAMA_ANAK_URL", url_enc(d.get("NAMA_ANAK", "")))
        default("NAMA_PENGANTIN_WANITA_URL", url_enc(d.get("NAMA_PENGANTIN_WANITA", "")))
        default("NAMA_PENGANTIN_PRIA_URL", url_enc(d.get("NAMA_PENGANTIN_PRIA", "")))
        default("MAPS_AKAD", url_enc(d.get("NAMA_TEMPAT_AKAD", "")).replace("%20", "+"))
        default("MAPS_RESEPSI", url_enc(d.get("NAMA_TEMPAT_RESEPSI", "")).replace("%20", "+"))
        default("NAMA_LENGKAP_WANITA_REKENING", d.get("NAMA_LENGKAP_WANITA", ""))
        default("NAMA_LENGKAP_PRIA_REKENING", d.get("NAMA_LENGKAP_PRIA", ""))
    if tpl == "demo":
        # teks LOCATION di ICS: koma di-escape dua backslash (seperti di file asli)
        lokasi = d.get("NAMA_TEMPAT", "") + ", " + d.get("ALAMAT_TEMPAT", "")
        default("LOKASI_ICS", lokasi.replace(",", "\\\\,"))
        default("NAMA_REKENING_PRIA", d.get("NAMA_LENGKAP_PRIA", ""))
        default("NAMA_REKENING_WANITA", d.get("NAMA_LENGKAP_WANITA", ""))

    # nomor polos (angka saja) dari format tampilan
    if "NO_REKENING" in d:
        default("NO_REKENING_POLOS", re.sub(r"\D", "", d["NO_REKENING"]))
    if "NO_HP_REKENING" in d:
        default("NO_HP_REKENING_POLOS", re.sub(r"\D", "", d["NO_HP_REKENING"]))
    if "NO_EWALLET" in d:
        default("NO_EWALLET_POLOS", re.sub(r"\D", "", d["NO_EWALLET"]))


def main():
    args = sys.argv[1:]
    if len(args) == 2:
        tpl, data_path, out_path = "sage", args[0], args[1]
    elif len(args) == 3 and args[0] in FILES:
        tpl, data_path, out_path = args
    else:
        print(__doc__)
        sys.exit(1)

    d = json.load(open(data_path, encoding="utf-8"))
    html = open(FILES[tpl], encoding="utf-8").read()
    turunan(tpl, d)

    keys = set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", html))
    missing = sorted(k for k in keys if k not in d)
    if missing:
        print("Data belum lengkap, kunci yang kurang:", ", ".join(missing))
        sys.exit(2)

    for k in keys:
        html = html.replace("{{%s}}" % k, str(d[k]))
    open(out_path, "w", encoding="utf-8").write(html)
    print("Tersimpan:", out_path)


if __name__ == "__main__":
    main()
