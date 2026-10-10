#!/usr/bin/env python3
"""Isi template undangan (undangan-sage-template.html) dengan data pengantin.

Pemakaian:
  python3 isi-template.py data.json keluaran.html

data.json contoh: lihat contoh-data.json (semua kunci wajib diisi).
Kunci yang tidak ada di JSON akan membuat script berhenti dan menyebut namanya,
supaya tidak ada placeholder {{...}} yang lolos ke undangan live.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "undangan-sage-template.html")

def url_enc(s):
    from urllib.parse import quote
    return quote(s, safe="")

def main():
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    html = open(TEMPLATE, encoding="utf-8").read()

    # turunan otomatis dari data dasar
    data.setdefault("NAMA_PENGANTIN_WANITA_URL", url_enc(data.get("NAMA_PENGANTIN_WANITA", "")))
    data.setdefault("NAMA_PENGANTIN_PRIA_URL", url_enc(data.get("NAMA_PENGANTIN_PRIA", "")))
    data.setdefault("NO_REKENING_POLOS", re.sub(r"\D", "", data.get("NO_REKENING", "")))
    data.setdefault("NO_HP_REKENING_POLOS", re.sub(r"\D", "", data.get("NO_HP_REKENING", "")))
    data.setdefault("MAPS_AKAD", url_enc(data.get("NAMA_TEMPAT_AKAD", "")).replace("%20", "+"))
    data.setdefault("MAPS_RESEPSI", url_enc(data.get("NAMA_TEMPAT_RESEPSI", "")).replace("%20", "+"))
    data.setdefault("NAMA_LENGKAP_WANITA_REKENING", data.get("NAMA_LENGKAP_WANITA", ""))
    data.setdefault("NAMA_LENGKAP_PRIA_REKENING", data.get("NAMA_LENGKAP_PRIA", ""))

    keys = set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", html))
    missing = sorted(k for k in keys if k not in data)
    if missing:
        print("Data belum lengkap, kunci yang kurang:", ", ".join(missing)); sys.exit(2)

    for k in keys:
        html = html.replace("{{%s}}" % k, str(data[k]))

    open(sys.argv[2], "w", encoding="utf-8").write(html)
    print("Tersimpan:", sys.argv[2])

if __name__ == "__main__":
    main()
