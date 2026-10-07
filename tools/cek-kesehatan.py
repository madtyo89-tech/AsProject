#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# cek-kesehatan.py — pemeriksa otomatis repo AsProject (statis, tanpa browser)
#
# Sandbox ini tidak punya browser/headless DOM, jadi yang bisa dibuktikan di
# sini adalah hal-hal yang penyebabnya statis:
#   1. setiap href/src/url() lokal benar-benar ada di disk (tidak akan 404)
#   2. tidak ada http:// (mixed content) atau localhost/127.0.0.1 di halaman
#      (pengunjung membuka situs lewat https + domain sendiri)
#   3. setiap <script> JS lolos `node --check` (blok JSON/importmap dilewati)
#   4. tidak ada id duplikat per file (penyebab bug selector yang senyap)
#   5. selector script injeksi: statis ada di HTML, atau ditandai dinamis
#   6. konten terlarang: 'beb' berdiri sendiri di halaman, KartuDigital, dsb.
#   7. blok injeksi di index.html tidak terduplikasi saat edit berulang
#   8. peta demo vs file yang benar-benar ada
#
# Yang TIDAK bisa dibuktikan di sini (butuh browser sungguhan): tampilan,
# animasi, autoplay musik, IntersectionObserver, perilaku klik.
# Pakai:  python3 tools/cek-kesehatan.py     (exit 1 kalau ada masalah)
# ---------------------------------------------------------------------------
import os
import re
import shutil
import subprocess
import sys
import posixpath

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HALAMAN = ["index.html", "studio.html", "demo/ice-blue.html"]
TIPE_JS = ("", "text/javascript", "application/javascript", "module")

hitung = {"ok": 0, "masalah": 0, "info": 0}


def lapor(status, pesan):
    hitung[status] += 1
    print({"ok": "  ok  ", "masalah": "  !!  ", "info": "  ..  "}[status] + pesan)


def baca(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def script_js(rel):
    """Kembalikan isi <script> yang benar-benar JavaScript."""
    out = []
    for tipe, isi in re.findall(r'<script([^>]*)>(.*?)</script>', baca(rel), re.S):
        m = re.search(r'type=["\']([^"\']+)["\']', tipe)
        t = (m.group(1) if m else "").strip().lower()
        if t in TIPE_JS and isi.strip():
            out.append(isi)
    return out


# ---------------------------------------------------------------- 1. link/aset
def cek_link():
    print("\n[1] Tautan & aset lokal (harus ada di disk)")
    for rel in HALAMAN:
        s = baca(rel)
        dasar = posixpath.dirname(rel)
        refs = [r for r in re.findall(r'(?:href|src)="([^"]+)"', s)]
        refs += [m[1] for m in re.findall(r'url\((["\']?)([^)"\']+)\1\)', s)]
        lokal, luar, template = set(), 0, 0
        for r in refs:
            r = r.strip()
            if not r or r.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            if "${" in r or r.startswith("{"):      # template literal JS, bukan link
                template += 1
                continue
            if r.startswith(("http://", "https://", "//", "data:", "blob:")):
                luar += 1
                continue
            lokal.add(r.split("#")[0].split("?")[0])
        hilang = []
        for r in sorted(lokal):
            if not r:
                continue
            target = posixpath.normpath(posixpath.join(dasar, r)) if not r.startswith("/") else r.lstrip("/")
            if not os.path.exists(os.path.join(ROOT, target)):
                hilang.append(r)
        if hilang:
            for h in hilang:
                lapor("masalah", f"{rel}: tujuan tidak ada -> {h}")
        else:
            lapor("ok", f"{rel}: {len(lokal)} tautan lokal ada semua "
                        f"({luar} eksternal, {template} template-literal dilewati)")


# ------------------------------------------------- 2. mixed content & localhost
def cek_url_berbahaya():
    print("\n[2] URL berbahaya untuk pengunjung (http:// atau localhost)")
    for rel in HALAMAN:
        s = baca(rel)
        http = [u for u in re.findall(r'["\'(]http://(?!localhost)[^"\' )]+', s)
                if not u.startswith('"http://www.w3.org/')]   # namespace XML/SVG, bukan request
        lokal_host = re.findall(r'(?:localhost|127\.0\.0\.1)', s)
        if http:
            lapor("masalah", f"{rel}: {len(http)} tautan http:// (mixed content di situs https): {http[:3]}")
        else:
            lapor("ok", f"{rel}: tidak ada http:// polos")
        if lokal_host:
            lapor("masalah", f"{rel}: menyebut localhost/127.0.0.1 ({len(lokal_host)}x) — pengunjung tidak bisa memakainya")
        else:
            lapor("ok", f"{rel}: tidak ada localhost/127.0.0.1")


# ------------------------------------------------------------ 3. sintaks JS
def cek_sintaks():
    print("\n[3] Sintaks JavaScript (node --check)")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — dilewati")
        return
    for rel in HALAMAN:
        for i, js in enumerate(script_js(rel)):
            tmp = f"/tmp/qa_{rel.replace('/', '_')}_{i}.js"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(js)
            r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
            if r.returncode == 0:
                lapor("ok", f"{rel} script#{i + 1}: sintaks OK ({len(js)} karakter)")
            else:
                lapor("masalah", f"{rel} script#{i + 1}: {r.stderr.strip()[:300]}")


# ------------------------------------------------------------ 4. id duplikat
def cek_id():
    print("\n[4] Id duplikat per file")
    for rel in HALAMAN:
        ids = re.findall(r'\sid="([^"]+)"', baca(rel))
        dup = sorted({i for i in ids if ids.count(i) > 1})
        if dup:
            lapor("masalah", f"{rel}: id duplikat -> {dup}")
        else:
            lapor("ok", f"{rel}: {len(ids)} id, tidak ada duplikat")


# ------------------------------------------- 5. selector script injeksi index
def cek_selector_injeksi():
    print("\n[5] Selector pada blok injeksi index.html")
    s = baca("index.html")
    m = re.search(r"<!-- ===== AsProject · Katalog enhancement(.*?)</body>", s, re.S)
    if not m:
        lapor("masalah", "blok injeksi tidak ditemukan di index.html!")
        return
    lapor("ok", f"blok injeksi ditemukan ({len(m.group(1))} karakter)")
    html_asli = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s[: m.start()], flags=re.S)
    # markup katalog di luar script/style: selector yang tidak ketemu di sini
    # berarti baru ada saat React merender (modal dibuka) atau dibuat script
    for sel in sorted(set(re.findall(r"querySelector(?:All)?\(\s*'([^']+)'", m.group(1)))):
        inti = [t for t in re.split(r"[\s>+.]+", sel) if t and not t.startswith(":")]
        statis = all(t in html_asli for t in inti) if inti else False
        if statis:
            lapor("ok", f"selector '{sel}' ada di HTML katalog")
        else:
            lapor("info", f"selector '{sel}' dinamis — baru ada saat React merender modal/ elemen dibuat script")



# ------------------------------------- 9. simulasi tombol Demo Live per tema
def cek_resolusi_demo():
    print("\n[9] Simulasi tombol \"Demo Live\" per tema katalog")
    s = baca("index.html")
    pn = re.search(r"(?:var|const|let)\s+Pn\s*=\s*\[(.*?)\];", s, re.S)
    if not pn:
        lapor("masalah", "array tema katalog (Pn) tidak ditemukan")
        return
    tema = re.findall(r'\{id:"([^"]+)",name:"([^"]+)",category:"([^"]+)"', pn.group(1))
    nama = dict(re.findall(r"'([^']+)':\s*'(demo/[^']+)'", s[:s.index("DEMO_BY_CATEGORY")]))
    kat_blok = s[s.index("DEMO_BY_CATEGORY"): s.index("DEMO_BY_CATEGORY") + 900]
    kat = {}
    for k, v in re.findall(r"'([^']+)':\s*(\[[^\]]*\]|'demo/[^']+')", kat_blok):
        kat[k] = re.findall(r"'(demo/[^']+)'", v) if v.startswith("[") else [v]
    dapat = 0
    for tid, tnama, tkat in tema:
        kandidat = nama.get(tnama) or None
        daftar = [kandidat] if kandidat else kat.get(tkat, [])
        pilih = next((d for d in daftar if os.path.exists(os.path.join(ROOT, d))), None)
        if pilih:
            dapat += 1
        lapor("ok" if pilih else "info",
              f"{tnama:18s} ({tkat:11s}) -> {pilih or 'belum ada demo (tombol disembunyikan)'}")
    lapor("info", f"{dapat}/{len(tema)} tema katalog punya tombol Demo Live saat ini")


# -------------------------------------- 10. audit anchor lintas & dalam halaman
# Anchor yang dipasang runtime oleh blok injeksi (tidak ada di markup statis)
RUNTIME_ANCHOR = {"index.html": {"katalog"}}


def cek_anchor():
    print("\n[10] Audit anchor (#frag) dalam & lintas halaman")
    for rel in HALAMAN:
        s = baca(rel)
        dasar = posixpath.dirname(rel)
        for href in re.findall(r'href="([^"#]*#[^"]+)"', s):
            jalur, frag = href.split("#", 1)
            if "${" in href:
                continue
            if not jalur:                      # anchor dalam halaman sendiri
                target_file, ids = rel, set(re.findall(r'\sid="([^"]+)"', s))
            else:
                if jalur.startswith(("http", "//", "mailto:")):
                    continue
                target_file = posixpath.normpath(posixpath.join(dasar, jalur.split("?")[0]))
                if not os.path.exists(os.path.join(ROOT, target_file)):
                    continue                   # sudah dilaporkan cek [1]
                ids = set(re.findall(r'\sid="([^"]+)"', baca(target_file)))
            punya = frag in ids or frag in RUNTIME_ANCHOR.get(os.path.basename(target_file), set())
            lapor("ok" if punya else "masalah",
                  f"{rel}: #{frag} -> {target_file} " +
                  ("ada" if punya else "TIDAK ADA (tautan mati)"))

# ---------------------------------------------------------------- 6. konten
def cek_konten():
    print("\n[6] Konten terlarang / wajib")
    for rel in HALAMAN:
        s = baca(rel)
        beb = len(re.findall(r"(?<![A-Za-z0-9_])[Bb]eb(?![A-Za-z0-9_])", s))
        lapor("ok" if beb == 0 else "masalah", f"{rel}: kata 'beb' berdiri sendiri = {beb}")
    doc = baca("demo/README.md")
    n = len(re.findall(r"(?<![A-Za-z0-9_])[Bb]eb(?![A-Za-z0-9_])", doc))
    lapor("info", f"demo/README.md menyebut sapaan lama {n}x (dokumentasi, bukan copy situs — sengaja)")
    s = baca("demo/ice-blue.html")
    for tok in ("KartuDigital", "React Artifact", "ecto:", "Optimistic"):
        lapor("ok" if tok not in s else "masalah", f"demo/ice-blue.html: '{tok}' = {s.count(tok)}x")
    for rel, wajib in (("index.html", ["6285196755675"]), ("demo/ice-blue.html", ["6285196755675", "asproject.my.id"])):
        isi = baca(rel)
        for tok in wajib:
            lapor("ok" if tok in isi else "masalah", f"{rel}: '{tok}' ada")
    img = re.findall(r"<img\b[^>]*>", s)
    tanpa_alt = [t for t in img if "alt=" not in t]
    lapor("ok" if img and not tanpa_alt else "masalah",
          f"demo/ice-blue.html: {len(img)} gambar, {len(tanpa_alt)} tanpa alt")


# ------------------------------------------------- 7. injeksi tidak duplikat
def cek_duplikat_injeksi():
    print("\n[7] Blok injeksi tidak terduplikasi")
    s = baca("index.html")
    n = s.count("AsProject · Katalog enhancement")
    lapor("ok" if n == 1 else "masalah", f"penanda injeksi muncul {n}x (harus 1)")


# ------------------------------------------------------- 8. peta demo & file
def cek_peta_demo():
    print("\n[8] Peta demo vs file yang ada")
    s = baca("index.html")
    for jalur in sorted(set(re.findall(r"'(demo/[^']+)'", s))):
        ada = os.path.exists(os.path.join(ROOT, jalur))
        lapor("ok" if ada else "info",
              f"{jalur}: {'ada' if ada else 'BELUM ADA (tombol Demo Live otomatis disembunyikan)'}")
    for wajib in ("CNAME", ".nojekyll"):
        lapor("ok" if os.path.exists(os.path.join(ROOT, wajib)) else "masalah", f"{wajib} ada (butuh GitHub Pages)")


def main():
    print("=" * 74)
    print("Pemeriksa kesehatan repo AsProject —", os.path.basename(ROOT))
    print("=" * 74)
    for fn in (cek_link, cek_url_berbahaya, cek_sintaks, cek_id,
               cek_selector_injeksi, cek_konten, cek_duplikat_injeksi, cek_peta_demo,
               cek_resolusi_demo, cek_anchor):
        fn()
    print("\n" + "=" * 74)
    print(f"Ringkasan: {hitung['ok']} ok, {hitung['masalah']} masalah, {hitung['info']} catatan")
    print("Yang tetap butuh mata manusia di preview: tampilan, animasi, autoplay")
    print("musik, dan rasa keseluruhan — sandbox ini tidak punya browser.")
    print("=" * 74)
    return 1 if hitung["masalah"] else 0


if __name__ == "__main__":
    sys.exit(main())
