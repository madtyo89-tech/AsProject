#!/usr/bin/env python3
"""
Rapikan demo/ice-blue.html — template dari folder Drive "Katalog demo"
(undangan_online_ice_blue.html) supaya cocok dipakai sebagai demo di asproject.my.id.

Yang dikerjakan (4 poin, sesuai keputusan 2026-10-07):
  1. Rebrand KartuDigital.My.Id -> AsProject.My.Id (+ judul tab, tahun copyright)
  2. Sapaan "beb" -> "Kak" (placeholder form RSVP)
  3. Link mati dipasang: WA 085196755675, IG @asproject.my.id, mailto hello@
  4. Buang script bawaan platform pembuatnya (ecto:* postMessage, helper target=_blank)
     dan @font-face "Optimistic" yang menunjuk /fonts/... (404 di domain kita)

Setiap replacement memakai assert jumlah kemunculan, jadi kalau isi file berbeda
dari yang diharapkan script akan berhenti dan melapor — tidak ada perubahan senyap.

Pakai:
    python3 tools/rapikan-demo-ice-blue.py --check   # laporkan saja, tidak menulis
    python3 tools/rapikan-demo-ice-blue.py           # terapkan
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "demo" / "ice-blue.html"

WA = "6285196755675"
IG = "https://instagram.com/asproject.my.id"
MAIL = "mailto:hello@asproject.my.id"
WA_HREF = ("https://wa.me/" + WA +
           "?text=Halo%20AsProject.My.Id!%20Aku%20mau%20tanya%20soal%20undangan%20Ice%20Blue%20%E2%9C%A8")

_FOOTER_A = ('d("a",{href:"%s",%sclassName:"w-9 h-9 rounded-full bg-white border '
             'border-[#BAE6FD] grid place-items-center hover:bg-[#F0F9FF] transition",'
             'children:d(%s,{className:"w-4 h-4"})})')


def _footer_a(href, icon, external=False):
    extra = 'target:"_blank",rel:"noopener",' if external else ""
    return _FOOTER_A % (href, extra, icon)


REPLACEMENTS = [
    # --- 1. branding ---
    ('"KartuDigital"', '"AsProject"', 2),
    ("\u00a9 2025 KartuDigital.My.Id", "\u00a9 2026 AsProject.My.Id", 1),
    ("<title>React Artifact</title>",
     "<title>Undangan Online Ice Blue \u2014 AsProject.My.Id</title>", 1),

    # --- 2. sapaan ---
    ('placeholder:"Tulis namamu beb"', 'placeholder:"Tulis namamu, Kak"', 1),

    # --- 3. link mati ---
    (_footer_a("#", "kr"), _footer_a(IG, "kr", external=True), 1),
    (_footer_a("#", "xn"), _footer_a(MAIL, "xn"), 1),
    ('d("span",{className:"font-medium text-[#0EA5E9]",children:"Chat WhatsApp Support Premium"})',
     'd("a",{href:"%s",target:"_blank",rel:"noopener",className:"font-medium '
     'text-[#0EA5E9] underline",children:"Chat WhatsApp Support Premium"})' % WA_HREF, 1),
    ('d("div",{children:"WhatsApp Support"})',
     'd("a",{href:"%s",target:"_blank",rel:"noopener",children:"WhatsApp Support"})' % WA_HREF, 1),
]

# Blok yang dibuang utuh (4): style @font-face Optimistic + 3 script bawaan platform.
STRIP_STYLE_HEAD = ("<head><style>", "</style>")
STRIP_SCRIPTS = [
    '<script>(function(){function m(a){var h=a.getAttribute("href")',
    '<script>(function(){var loc=location.href.replace(/#.*$/,"");var ATTR_NAMES=',
    '<script>(function(){var FOCUS_TYPE="ecto:artifact-focus-request"',
]

CHECKS = [
    ("KartuDigital", 0),
    ("React Artifact", 0),
    ("Optimistic", 0),
    ("ecto:", 0),
    ("Tulis namamu beb", 0),
    ("AsProject.My.Id", None),   # cukup ada
    (WA, None),
]


def main() -> int:
    check_only = "--check" in sys.argv
    if not SRC.exists():
        print(f"❌ {SRC.relative_to(ROOT)} belum ada.")
        print("   Kirim file 'undangan_online_ice_blue.html' sebagai lampiran, atau")
        print("   upload ke folder demo/ lewat web GitHub, lalu jalankan ulang.")
        return 1

    s = SRC.read_text(encoding="utf-8")
    asal = len(s)
    gagal = []

    print(f"Membaca {SRC.relative_to(ROOT)} ({asal:,} byte)\n")
    print("— Replacement teks —")
    for old, new, expect in REPLACEMENTS:
        n = s.count(old)
        if n != expect:
            gagal.append(f"{old[:60]!r}: ketemu {n}, diharapkan {expect}")
            print(f"  !! {n}/{expect}  {old[:60]}")
            continue
        s = s.replace(old, new)
        print(f"  ok {n}/{expect}  {old[:52]} -> {new[:44]}")

    print("\n— Buang blok bawaan platform —")
    start, end = STRIP_STYLE_HEAD
    i = s.find(start)
    if i == -1:
        gagal.append("style @font-face Optimistic di <head> tidak ketemu")
        print("  !! <head><style> tidak ketemu")
    else:
        j = s.find(end, i)
        if j == -1:
            gagal.append("penutup </style> pertama tidak ketemu")
        else:
            j += len(end)
            print(f"  ok buang @font-face Optimistic ({j - i:,} karakter)")
            s = s[:i] + "<head>" + s[j:]

    for marker in STRIP_SCRIPTS:
        i = s.find(marker)
        if i == -1:
            gagal.append(f"script tidak ketemu: {marker[:48]}")
            print(f"  !! tidak ketemu: {marker[:48]}")
            continue
        j = s.find("</script>", i)
        if j == -1:
            gagal.append(f"penutup </script> tidak ketemu untuk {marker[:48]}")
            continue
        j += len("</script>")
        print(f"  ok buang script ({j - i:,} karakter): {marker[8:52]}...")
        s = s[:i] + s[j:]

    print("\n— Verifikasi akhir —")
    for token, want in CHECKS:
        n = s.count(token)
        if want is None:
            status = "ok " if n else "!!"
            if not n:
                gagal.append(f"{token} hilang")
            print(f"  {status} {token!r} ada {n}x")
        else:
            status = "ok " if n == want else "!!"
            if n != want:
                gagal.append(f"{token} masih {n}x (harus {want})")
            print(f"  {status} {token!r} {n}x (target {want})")

    sisa_beb = len(re.findall(r"(?<![A-Za-z0-9_])[Bb]eb(?![A-Za-z0-9_])", s))
    print(f"  {'ok ' if sisa_beb == 0 else '!!'} kata 'beb' berdiri sendiri: {sisa_beb}")
    if sisa_beb:
        gagal.append(f"masih ada {sisa_beb} kata 'beb'")

    if gagal:
        print("\n❌ GAGAL — file TIDAK ditulis. Yang perlu dicek:")
        for g in gagal:
            print("   -", g)
        return 1

    if check_only:
        print(f"\n--check: semua cocok. Hasil akhir {len(s):,} byte "
              f"({asal - len(s):+,} byte lebih ringan). File belum ditulis.")
        return 0

    SRC.write_text(s, encoding="utf-8")
    print(f"\n✅ Ditulis: {SRC.relative_to(ROOT)} — {len(s):,} byte "
          f"(hemat {asal - len(s):,} byte dari {asal:,})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
