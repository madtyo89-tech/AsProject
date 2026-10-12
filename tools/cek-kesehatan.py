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
HALAMAN = ["index.html", "studio.html", "undangan.html", "404.html",
           "checkin.html", "demo/ice-blue.html", "master.html", "scan.html",
           "template-studio.html", "kanvas.html"]
TIPE_JS = ("", "text/javascript", "application/javascript", "module")

hitung = {"ok": 0, "masalah": 0, "info": 0}


# Id tema dari katalog lama (72 tema). Setelah katalog direset, id-id ini tidak
# boleh muncul lagi di berkas yang disajikan ke publik (tautan mati = memalukan).
# Id tema lama yang tidak boleh muncul lagi. jawa-elegan / minimalist-sage /
# luxury-gold / floral-rustic sengaja TIDAK dipasang: sejak 2026-10-10 id itu
# dipakai ulang oleh katalog AsProject (sumber: Google Drive) dengan desain baru.
TEMA_LAMA = {"ice-blue", "royal-garden", "galaxy-prestige", "abyss-pearl",
             "winter-prestige"}


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
            # Lewati tujuan yang dirakit di JS (template literal, ' + esc(x) + ', dsb.)
            # — bukan tautan statis, jadi tidak bisa diperiksa dari berkas.
            if ("${" in r or r.startswith("{") or "esc(" in r or "'" in r or '"' in r or " + " in r
                    or r.endswith("+")):
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
    i_nama = s.index("var DEMO_BY_NAME")
    i_kat = s.index("var DEMO_BY_CATEGORY", i_nama)
    # nilai boleh '...' atau "..."; berkas demo boleh di demo/ atau katalog-demo/
    pol = r"['\"]([^'\"]+)['\"]:\s*['\"]((?:demo|katalog-demo)/[^'\"]+)['\"]"
    nama = dict(re.findall(pol, s[i_nama:i_kat]))
    kat_blok = s[i_kat:s.find('var WA_ICON', i_kat) if 'var WA_ICON' in s[i_kat:] else i_kat + 1200]
    kat = {}
    for k, v in re.findall(r"['\"]([^'\"]+)['\"]:\s*(\[[^\]]*\]|['\"](?:demo|katalog-demo)/[^'\"]+['\"])", kat_blok):
        kat[k] = re.findall(r"['\"]((?:demo|katalog-demo)/[^'\"]+)['\"]", v) if v.strip().startswith("[") else [v.strip("'\"")]
    dapat = 0
    for tid, tnama, tkat in tema:
        kandidat = nama.get(tnama) or None
        daftar = [kandidat] if kandidat else kat.get(tkat, [])
        pilih = next((d for d in daftar if os.path.exists(os.path.join(ROOT, d.split('?')[0]))), None)
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
        ada = os.path.exists(os.path.join(ROOT, jalur.split('?')[0]))
        lapor("ok" if ada else "info",
              f"{jalur}: {'ada' if ada else 'BELUM ADA (tombol Demo Live otomatis disembunyikan)'}")
    for wajib in ("CNAME", ".nojekyll"):
        lapor("ok" if os.path.exists(os.path.join(ROOT, wajib)) else "masalah", f"{wajib} ada (butuh GitHub Pages)")


def _tpl_ids(rel):
    """Urutan id template di array TPL sebuah file (index kolom 'theme')."""
    s = baca(rel)
    m = re.search(r"const TPL=\[(.*?)\];", s, re.S)
    if not m:
        return None
    return re.findall(r"id:'([a-z0-9-]+)'", m.group(1))


def _tpl_rows(rel):
    """Baris array TPL sebagai dict (id, nama, ev, tier, char, bg3d, bgPaper, harga)."""
    s = baca(rel)
    m = re.search(r"const TPL=\[(.*?)\];", s, re.S)
    if not m:
        return []
    rows = []
    for chunk in m.group(1).split("{id:'")[1:]:
        row = {"id": chunk.split("'")[0]}
        for key in ("ev", "tier", "char", "bg3d", "bgPaper", "nama", "accent"):
            g = re.search(r"%s:'([^']*)'" % key, chunk)
            row[key] = g.group(1) if g else ''
        g = re.search(r"harga:(\d+)", chunk)
        row["harga"] = int(g.group(1)) if g else 0
        rows.append(row)
    return rows


def _fx_ids(s, nama_arr):
    """Urutan id efek di array FX_COVER / FX_SCROLL sebuah file."""
    m = re.search(r"(?:^|\n)const %s=\[" % nama_arr, s)
    if not m:
        return None
    blok = _blok_array(s, "const %s=" % nama_arr)
    ids = re.findall(r"\[\s*'([a-z0-9-]+)'", blok)
    return ids or re.findall(r"'([a-z0-9-]+)'", blok)


def _font_ids(s):
    """Id font di array FONTS sebuah file."""
    m = re.search(r"const FONTS=\[(.*?)\];", s, re.S)
    if not m:
        return None
    return re.findall(r"id:'([a-z-]+)'", m.group(1))


def cek_pipeline_undangan():
    print("\n[11] Pipeline tautan undangan (studio → link → 404 → undangan.html)")
    for wajib in ("undangan.html", "404.html", "checkin.html"):
        lapor("ok" if os.path.exists(os.path.join(ROOT, wajib)) else "masalah",
              f"{wajib} ada (bagian pipeline tautan undangan)")
    studio = baca("studio.html")
    undangan = baca("undangan.html")
    f404 = baca("404.html")
    index = baca("index.html")
    # 1) studio memakai link berbasis path /u/{slug} (selalu resolvable)
    ok = "function baseUrl()" in studio and "'/u/'" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: baseUrl memakai format /u/{slug} (bukan subdomain polos)")
    # 2) QR check-in menunjuk checkin.html di root
    ok = "/checkin.html?id='+code" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: link QR checkin memakai /checkin.html di root")
    # 3) undangan.html membaca slug dari query ATAU subdomain
    lapor("ok" if ("Q.get('slug')" in undangan and "asproject.my.id'" in undangan) else "masalah",
          "undangan.html: slug dari ?slug= dan subdomain wildcard")
    # 4) undangan.html fetch ke Supabase invitation_drafts
    lapor("ok" if "invitation_drafts" in undangan else "masalah",
          "undangan.html: fetch tabel Supabase invitation_drafts")
    # 5) 404.html merutekan /u/{slug} ke undangan.html
    lapor("ok" if "([A-Za-z0-9-]+)" in f404 and "undangan.html?slug=" in f404 else "masalah",
          "404.html: rute /u/{slug} → undangan.html?slug=…")
    # 6) index.html mengarahkan subdomain wildcard ke undangan.html
    lapor("ok" if "undangan.html'+q" in index and ".asproject.my.id'" in index else "masalah",
          "index.html: router subdomain wildcard → undangan.html")
    # 7) schema Supabase punya kolom snapshot jsonb
    lapor("ok" if "add column if not exists data jsonb" in baca("supabase-schema.sql") else "masalah",
          "supabase-schema.sql: kolom data jsonb tersedia")
    # 8) urutan TPL studio == urutan TPL undangan (index kolom 'theme' harus sama)
    a, b = _tpl_ids("studio.html"), _tpl_ids("undangan.html")
    if a is None or b is None:
        lapor("masalah", "array TPL tidak ditemukan di studio/undangan")
    elif a == b:
        lapor("ok", f"urutan TPL identik di studio & undangan ({len(a)} template)")
    else:
        lapor("masalah",
              f"urutan TPL BERBEDA (studio {len(a)} vs undangan {len(b)}) — "
              f"kolom 'theme' akan salah tema!")
    # 9) 10 slide konten: id-nya harus lengkap di studio (SLIDES) dan undangan (liveSlides)
    SLIDE_IDS = ["timeline", "story", "quote", "menu", "party",
                 "dresscode", "gift", "map", "rsvp", "closing"]
    s_studio = [i for i in SLIDE_IDS if re.search(r"id:'%s'" % i, studio)]
    s_undang = [i for i in SLIDE_IDS if re.search(r"S\.%s&&S\.%s\.on" % (i, i), undangan)]
    lapor("ok" if s_studio == SLIDE_IDS else "masalah",
          f"studio.html: 10 id slide terdaftar di editor SLIDES ({len(s_studio)}/10)")
    lapor("ok" if s_undang == SLIDE_IDS else "masalah",
          f"undangan.html: 10 slide dirender oleh liveSlides ({len(s_undang)}/10)")
    # 10) snapshot publish membawa slides + anim
    lapor("ok" if "slides:JSON.parse(JSON.stringify(state.slides)),anim" in studio else "masalah",
          "studio.html: publish() menyimpan slides & anim ke snapshot data")
    # 10b) Publish tidak gagal total bila kolom snapshot belum ada (PGRST204):
    #      fallback simpan kolom dasar + peringatan berisi SQL perbaikan sekali klik
    ok = ("isMissingDataCol" in studio and "delete payload.data" in studio
          and "snapshotSkipped" in studio and "copyFixSql" in studio
          and "add column if not exists data jsonb" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: Publish fallback tanpa snapshot + SQL perbaikan bila kolom 'data' belum ada")
    # 11) 20 efek animasi cover & 44 efek scroll: daftar id identik di kedua file
    for nama_arr in ("FX_COVER", "FX_SCROLL"):
        a, b = _fx_ids(studio, nama_arr), _fx_ids(undangan, nama_arr)
        if a is None or b is None:
            lapor("masalah", f"array {nama_arr} tidak ditemukan di studio/undangan")
        elif a == b and len(a) == (44 if nama_arr == "FX_SCROLL" else 20):
            lapor("ok", f"{nama_arr} identik di studio & undangan ({len(a)} efek)")
        else:
            lapor("masalah", f"{nama_arr} studio != undangan! studio={a} undangan={b}")
    ma, mb = _fx_ids(studio, "FX_SCROLL_MIX"), _fx_ids(undangan, "FX_SCROLL_MIX")
    lapor("ok" if ma == mb and ma and len(ma) == 16 else "masalah",
          f"urutan efek campuran per bagian konsisten ({len(ma or [])} efek)")
    # 12) daftar font (15) identik di kedua file
    fa, fb = _font_ids(studio), _font_ids(undangan)
    if fa is None or fb is None:
        lapor("masalah", "array FONTS tidak ditemukan di studio/undangan")
    elif fa == fb and len(fa) == 17:
        lapor("ok", f"FONTS identik di studio & undangan ({len(fa)} font)")
    else:
        lapor("masalah", f"FONTS studio != undangan! studio={fa} undangan={fb}")
    # 13) karakter maskot (char) harus sama persis di kedua array TPL
    ch_st = [(r["id"], r["char"]) for r in _tpl_rows("studio.html") if r["char"]]
    ch_ud = [(r["id"], r["char"]) for r in _tpl_rows("undangan.html") if r["char"]]
    lapor("ok" if ch_st == ch_ud else "masalah",
          f"karakter maskot sinkron studio & undangan ({len(ch_st)} tema ber-char)")
    # 14) floating preview undangan di studio
    ok = ('id="floatPrev"' in studio and "function syncFloat" in studio
          and "function setFloat" in studio and "syncAudio();syncFloat()}" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: floating preview (widget melayang + toggle + sync di render)")


def cek_katalog_publik():
    print("\n[12] Katalog publik (index.html) vs studio")
    studio_ids = _tpl_ids("studio.html")
    if studio_ids is None:
        lapor("masalah", "studio.html: array TPL tidak ditemukan")
        return
    index = baca("index.html")
    i = index.find("var Pn=")
    jp = index.find("],Xm=")
    ok = i > 0 and jp > i
    lapor("ok" if ok else "masalah", "index.html: array data katalog (Pn) ditemukan")
    if not ok:
        return
    pn = index[i:jp]
    pub_ids = re.findall(r'id:"([a-z0-9-]+)"', pn)
    hilang = [t for t in studio_ids if t not in pub_ids]
    lapor("ok" if not hilang else "masalah",
          "index.html: katalog memuat %d template; %d id studio %s" % (
              len(pub_ids), len(studio_ids),
              "semua ada" if not hilang else "TIDAK ADA: " + ", ".join(hilang)))
    # setiap kelas gradient katalog punya rule CSS Tailwind
    kurang = []
    for g in re.findall(r'gradient:"([^"]+)"', pn):
        m = re.match(r'from-\[#([0-9A-Fa-f]{6})\] via-\[#([0-9A-Fa-f]{6})\] to-\[#([0-9A-Fa-f]{6})\]', g)
        if not m:
            kurang.append(g)
            continue
        for kind, col in (("from", m.group(1)), ("via", m.group(2)), ("to", m.group(3))):
            if ".%s-\\[\\#%s\\]{" % (kind, col) not in index:
                kurang.append(kind + "#" + col)
    lapor("ok" if not kurang else "masalah",
          "index.html: rule CSS gradient katalog " + ("lengkap" if not kurang
               else "KURANG: " + ", ".join(kurang[:6])))
    # router: root github.io tidak boleh diarahkan ke undangan.html
    ok = "location.replace('/AsProject/undangan.html'+q)" not in index
    lapor("ok" if ok else "masalah",
          "index.html: root github.io tetap menampilkan katalog (tombol Katalog \u2197 tidak mati)")
    ok = "%d template" % len(studio_ids) in index
    lapor("ok" if ok else "masalah",
          "index.html: teks jumlah template sinkron (%d template)" % len(studio_ids))


def cek_fitur_terbaru():
    print("\n[13] Katalog tema pasca-reset, hide katalog, border, teks WA")
    studio = baca("studio.html")
    undangan = baca("undangan.html")
    # 1) katalog tema pasca-reset: >=1 tema, id unik, urutan sama dengan undangan,
    #    kategori acara sah, dan tiap rujukan artwork menunjuk berkas yang ada
    ids_st = _tpl_ids("studio.html") or []
    ids_ud = _tpl_ids("undangan.html") or []
    ok = bool(ids_st) and len(set(ids_st)) == len(ids_st) and ids_st == ids_ud
    lapor("ok" if ok else "masalah",
          f"urutan TPL identik & id unik di studio & undangan ({len(ids_st)} template)")
    rows = _tpl_rows("studio.html")
    ev_ok = bool(rows) and all(r["ev"] in ("pernikahan", "khitanan", "ultah", "aqiqah", "all") for r in rows)
    lapor("ok" if ev_ok else "masalah", "setiap tema punya kategori acara (ev) yang sah")
    kategori = ("pernikahan", "khitanan", "ultah", "aqiqah")
    kurang = [ev for ev in kategori if not any(r["ev"] in (ev, "all") for r in rows)]
    lapor("ok" if not kurang else "masalah",
          "setiap kategori acara punya tema terpakai"
          + ("" if not kurang else " — belum ada: " + ", ".join(kurang)))
    yatim = []
    for rel in ("studio.html", "undangan.html"):
        for r in _tpl_rows(rel):
            for aset in (r["bg3d"], r["bgPaper"]):
                if aset and not os.path.isfile(os.path.join(ROOT, aset)):
                    yatim.append(f"{rel}:{r['id']}->{aset}")
    lapor("ok" if not yatim else "masalah",
          "rujukan artwork tema utuh" if not yatim else "artwork tema hilang: " + ", ".join(yatim[:4]))

    # 2) 49 border (32 lama + 8 bunga/batik + 9 sudut 2D/3D/4D): array identik di
    #    studio & undangan, tersimpan saat publish, dan dipakai live.
    def _border_ids(s):
        m = re.search(r"const BORDERS=\[(.*?)\];", s, re.S)
        return re.findall(r"\{id:'([a-z0-9-]+)'", m.group(1)) if m else None
    bs, bu = _border_ids(studio), _border_ids(undangan)
    ekor = ("id:'diamond-stud'", "id:'triple-frame'", "id:'floral-corner'", "id:'batik-frame'")
    lapor("ok" if (bs and bu and len(bs) == 49 and len(set(bs)) == 49 and bs == bu
                   and all(i in studio and i in undangan for i in ekor)) else "masalah",
          "BORDERS 49 id unik, identik di studio & undangan")
    # 2b) gating konten EKSKLUSIF: kunci tier di studio + konten baru sinkron di undangan
    eks_dipakai = any(r["tier"] == "eksklusif" for r in _tpl_rows("studio.html"))
    ok = ("bolehEks" in studio and "paksaTier" in studio and "kunciEks" in studio
          and all(i in studio and i in undangan for i in
                  ("id:'laurel'", "id:'artdeco'", "id:'pearl'", "id:'cinzel'", "id:'marcellus'"))
          and "fx-c-shimmer" in studio and "fx-c-shimmer" in undangan
          and (not eks_dipakai or "tier:'eksklusif'" in studio))
    lapor("ok" if ok else "masalah",
          "studio: gating konten EKSKLUSIF per tier; border/font/fx baru sinkron di undangan"
          + ("" if not ok or eks_dipakai else " (tidak ada tema tier eksklusif di katalog — syarat dilonggarkan)"))
    ok = "border:state.border" in studio
    lapor("ok" if ok else "masalah", "studio.html: publish() menyimpan border ke snapshot data")
    ok = "const BD=BORDERS.find(b=>b.id===(d&&d.border))" in undangan and "#cover .bdfr" in undangan
    lapor("ok" if ok else "masalah", "undangan.html: live cover memakai data.border (frame .bdfr)")
    ok = ("border:'double'" in studio and "function setBorder(id){" in studio
          and "lockOfB" in studio and "LOCK_RANK" in studio and "tk:'vip'" in studio
          and all(i in studio and i in undangan for i in ("id:'gold-leaf'", "id:'filigree'", "id:'vip-diamond'")))
    lapor("ok" if ok else "masalah", "studio.html: picker border (state.border + setBorder) tersedia")
    # 3) hide template di katalog + urut per kategori
    ok = "function tglKatHide(id)" in studio and "katalogHide" in studio
    lapor("ok" if ok else "masalah", "studio.html: tombol hide/tampilkan template (katalogHide + tglKatHide)")
    ok = "state.katalogHide.includes(t.id)" in studio
    lapor("ok" if ok else "masalah", "studio.html: pilihan tema (tplsFor) menghormati template tersembunyi")
    ok = "${['pernikahan','khitanan','ultah','aqiqah'].map(ev=>" in studio
    lapor("ok" if ok else "masalah", "studio.html: daftar katalog diurutkan per kategori")
    # 4) teks WA personal: nama tamu terpilih + link bersih
    ok = "g?g.nama:'Bapak/Ibu/Saudara/i'" in studio and "g?baseUrl()+'?to='+" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: teks WA berisi nama tamu terpilih & link tanpa placeholder ?to=NamaTamu")
    # 5) Regresi: border preview hanya di zona cover (persis live) & migrasi dblBorder lama
    ok = "borderOf().id!=='none'?'padding:18px 12px" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: border preview terpasang di zona cover (konsisten dgn live, bukan layar penuh)")
    ok = "if(state.dblBorder===false)state.border='none'" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: migrasi dblBorder lama — proyek yang menonaktifkan border tetap tanpa border")
    # 6) Simpan File HTML (undangan mandiri offline)
    ok = "async function dlUndangan()" in studio and "onclick=\"dlUndangan()\"" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: tombol Simpan File HTML (dlUndangan) tersedia di Domain & Link")
    i_emb = undangan.find("typeof EMBEDDED_DATA!=='undefined'")
    i_demo = undangan.find("else if(DEMO){")
    ok = i_emb > 0 and i_demo > i_emb
    lapor("ok" if ok else "masalah",
          "undangan.html: mode EMBEDDED_DATA terbaca sebelum mode demo/slug (file mandiri bisa boot)")


def cek_alur_master():
    print("\n14. Alur Studio > Undangan Master > Undangan Tamu")
    # 1) halaman master ada + akses privat (kunci) + baca RSVP + edit bank
    ok = os.path.exists(os.path.join(ROOT, "master.html"))
    lapor("ok" if ok else "masalah", "master.html: halaman dashboard master ada di repo")
    if not ok:
        return
    m = baca("master.html")
    ok = "MK!==(d.masterKey||'')" in m and "master.html?slug=" in m
    lapor("ok" if ok else "masalah",
          "master.html: akses privat — link ditolak bila kunci ?k tidak cocok")
    ok = "/rest/v1/rsvp?slug=eq." in m and "invitation_drafts?slug=eq." in m
    lapor("ok" if ok else "masalah",
          "master.html: membaca RSVP tamu + menyimpan edit info bank (PATCH draft)")
    ok = "?to='+encodeURIComponent(g)" in m and "shareWa" in m and "guestLink" in m
    lapor("ok" if ok else "masalah",
          "master.html: link personal per tamu (?to=Nama) + share WhatsApp + salin link")
    # 2) studio: kunci master dibuat, ikut snapshot publish, kartu link di Domain
    s = baca("studio.html")
    ok = "if(!state.masterKey){state.masterKey=mkRand();save()}" in s
    lapor("ok" if ok else "masalah",
          "studio.html: kunci master dibuat sekali & dipersist (link master stabil)")
    ok = "masterKey:state.masterKey||''" in s and "guestsRaw:state.guestsRaw||''" in s
    lapor("ok" if ok else "masalah",
          "studio.html: daftar tamu + kunci master ikut snapshot publish (dibaca master)")
    ok = "function masterUrl()" in s and "Undangan Master (khusus pemilik)" in s
    lapor("ok" if ok else "masalah",
          "studio.html: kartu Link Master di tab Domain (Salin + Buka Dashboard)")
    # 3) undangan tamu: tombol RSVP cepat menulis ke tabel rsvp
    u = baca("undangan.html")
    ok = "async function rsvpSave(st)" in u and "resolution=merge-duplicates" in u
    lapor("ok" if ok else "masalah",
          "undangan.html: tombol RSVP cepat (Hadir/Tidak) menyimpan ke tabel rsvp")
    ok = "data-rsvpb" in u and "ivToast" in u
    lapor("ok" if ok else "masalah",
          "undangan.html: UI RSVP cepat + toast hasil (fallback WA bila gagal)")
    # 4) SQL pembuat tabel tersedia untuk pemilik
    ok = os.path.exists(os.path.join(ROOT, "tools", "rsvp.sql"))
    lapor("ok" if ok else "masalah", "tools/rsvp.sql: SQL tabel RSVP tersedia")
    if ok:
        ok = "create table if not exists public.rsvp" in baca("tools/rsvp.sql")
        lapor("ok" if ok else "masalah",
              "tools/rsvp.sql: tabel rsvp unique (slug,guest) + policy anon")


# --------------------------------------------- 15. kontras teks tema undangan
def cek_kontras_tema():
    print("\n[15] Kontras teks tema (assets/theme-contrast.js)")
    aset = os.path.join(ROOT, "assets", "theme-contrast.js")
    lapor("ok" if os.path.exists(aset) else "masalah",
          "assets/theme-contrast.js tersedia (penyesuaian kontras tema)")
    und = baca("undangan.html")
    lapor("ok" if 'assets/theme-contrast.js' in und else "masalah",
          "undangan.html memuat aset penyesuaian kontras")
    lapor("ok" if '--ink-body' in und else "masalah",
          "aturan konten memakai --ink-body (bukan ink tema mentah)")
    stu = baca("studio.html")
    lapor("ok" if "fetch('assets/theme-contrast.js')" in stu else "masalah",
          "studio.html: file HTML mandiri ikut menyematkan aset kontras")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji kontras tema dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-kontras-tema.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    ringkas = [b.strip() for b in r.stdout.splitlines()
               if b.strip().startswith("kontras terburuk") or b.strip().startswith("cover (tidak")]
    pesan = "; ".join(ringkas) if ringkas else (r.stdout.strip() or r.stderr.strip())[:220]
    lapor("ok" if r.returncode == 0 else "masalah", f"uji kontras tema: {pesan}")


# ------------------------------------------------- 16. tema 3D (artwork realistis)
def cek_tema_3d():
    print("\n[16] Mesin artwork tema (assets/tema-3d/)")
    folder = os.path.join(ROOT, "assets", "tema-3d")
    berkas = sorted(f for f in os.listdir(folder) if f.endswith(".webp")) if os.path.isdir(folder) else []
    for rel in ("undangan.html", "studio.html"):
        jumlah = len([r for r in _tpl_rows(rel) if r["bg3d"]])
        lapor("ok" if jumlah == len(berkas) else "masalah",
              f"{rel}: {jumlah} tema memakai artwork 3D (berkas di disk: {len(berkas)})")
    und = baca("undangan.html")
    lapor("ok" if "body.art3d #cover" in und else "masalah",
          "undangan.html: aturan latar artwork + lapisan gelap ada")
    lapor("ok" if "classList.add('art3d')" in und else "masalah",
          "undangan.html: kelas art3d dipasang saat tema ber-artwork")
    lapor("ok" if 'class="cvf cvf-' in und else "masalah",
          "undangan.html: bingkai foto cover (9 gaya) tersedia")
    lapor("ok" if "body.foto-full #cover" in und else "masalah",
          "undangan.html: gaya foto penuh + panel gelap tersedia")
    stu = baca("studio.html")
    lapor("ok" if "const art3d=" in stu else "masalah",
          "studio.html: pratinjau HP mengikuti latar 3D")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji tema 3D dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-tema-3d.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines()
             if b.strip().startswith("Ringkasan") or b.strip().startswith("terburuk")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji tema 3D: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))


# --------------------------------------------- 17. foto cover (9 gaya + geser)
def cek_foto_cover():
    print("\n[17] Foto cover undangan (9 gaya + geser/zoom)")
    und = baca("undangan.html")
    stu = baca("studio.html")
    gaya = ["kotak", "oval", "lingkaran", "arch", "polaroid", "emas", "kapsul"]
    hilang = [g for g in gaya if f".cvf-{g}" not in und]
    lapor("ok" if not hilang else "masalah",
          f"undangan.html: CSS 7 bingkai lengkap (kurang: {', '.join(hilang) or '-'})")
    lapor("ok" if und.count('class="cvf cvf-') >= 1 else "masalah",
          "undangan.html: markup bingkai memakai gaya dari data.coverStyle")
    lapor("ok" if "object-position:${cvP.x}%" in und else "masalah",
          "undangan.html: posisi foto dari data.coverPos dipakai")
    lapor("ok" if "untukLatarGelap" in und and "untukLatarGelap" in baca("assets/theme-contrast.js") else "masalah",
          "aksen di atas foto gelap dicerahkan (untukLatarGelap)")
    lapor("ok" if "#cover{overflow-y:auto" in und else "masalah",
          "undangan.html: cover bisa digulir (tombol Buka Undangan tidak terpotong)")
    lapor("ok" if "const CV_URUT=" in stu and stu.count("'kapsul'") >= 1 else "masalah",
          "studio.html: daftar 9 gaya tersedia")
    for fn in ("function cvMulai", "function cvJalan", "function cvLepas", "function cvZoom", "function cvReset"):
        lapor("ok" if fn in stu else "masalah", f"studio.html: {fn.split()[1]} tersedia (geser/zoom)")
    lapor("ok" if stu.count("coverStyle:cvGayaAktif()") >= 3 else "masalah",
          f"studio.html: gaya & posisi foto tersimpan (3 titik simpan: {stu.count('coverStyle:cvGayaAktif()')})")
    lapor("ok" if "if(a.snap.coverStyle)state.coverStyle" in stu else "masalah",
          "studio.html: membuka arsip memulihkan gaya foto")
    mas = baca("master.html")
    lapor("ok" if "function cvCoverMini(" in mas else "masalah",
          "master.html: kartu Preview Undangan memakai foto cover")
    bentuk = [g for g in ("kotak", "oval", "lingkaran", "arch", "polaroid", "emas", "kapsul")
              if f".bc-{g}" not in mas]
    lapor("ok" if not bentuk else "masalah",
          f"master.html: bentuk foto di preview lengkap (kurang: {', '.join(bentuk) or '-'})")
    lapor("ok" if ".b-screen.b-full" in mas else "masalah",
          "master.html: mode foto penuh di preview memakai latar gelap")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji foto cover dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-foto-cover.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines()
             if b.strip().startswith("Ringkasan") or b.strip().startswith("kontras")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji foto cover: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))


# ------------------------------- 18. skrip build tidak boleh di folder terlarang
def cek_skrip_build():
    """Folder bernama build/out/dist/target bisa hilang dari snapshot workspace, sehingga
    penghapusannya ikut ter-stage oleh `git add -A` dan berkasnya terhapus dari repo.
    Karena itu berkas sumber tidak boleh ditaruh di sana."""
    print("\n[18] Skrip build APK (android/buildkit/)")
    rel = os.path.join("android", "buildkit", "build-apk.sh")
    ada = os.path.isfile(os.path.join(ROOT, rel))
    lapor("ok" if ada else "masalah", f"{rel} ada di disk")
    if ada:
        bisa = bool(os.stat(os.path.join(ROOT, rel)).st_mode & 0o111)
        lapor("ok" if bisa else "info", f"{rel} dapat dieksekusi langsung (./)")
    if shutil.which("git") and os.path.isdir(os.path.join(ROOT, ".git")):
        r = subprocess.run(["git", "ls-files", "--error-unmatch", rel],
                           capture_output=True, text=True, cwd=ROOT)
        lapor("ok" if r.returncode == 0 else "masalah",
              f"{rel} terlacak git (aman saat push)")
        r2 = subprocess.run(["git", "ls-files"], capture_output=True, text=True, cwd=ROOT)
        terlarang = [f for f in r2.stdout.splitlines()
                     if any(seg in ("build", "dist", "target", "coverage", "out")
                            for seg in f.split("/")[:-1])]
        lapor("ok" if not terlarang else "masalah",
              "tidak ada berkas terlacak di folder bernama build/out/dist/target"
              + (f" — ditemukan: {', '.join(terlarang[:3])}" if terlarang else ""))
    else:
        lapor("info", "git tidak tersedia — pemeriksaan pelacakan berkas dilewati")


# ------------------------------------ 19. fitur scan QR panitia (check-in)
def cek_scan_panitia():
    print("\n[19] Scan QR panitia (check-in)")
    qr = baca("assets/qrcode.js") if os.path.isfile(os.path.join(ROOT, "assets/qrcode.js")) else ""
    lapor("ok" if "QR Code Generator" in qr and "MIT" in qr else "masalah",
          "assets/qrcode.js (pustaka QR, MIT) tersedia")
    stu = baca("studio.html")
    lapor("ok" if "function checkinUrl(" in stu and "window.qrcode(0,'M')" in stu else "masalah",
          "studio.html: QR tamu dibuat dari pustaka QR (checkinUrl)")
    scan = baca("scan.html") if os.path.isfile(os.path.join(ROOT, "scan.html")) else ""
    lapor("ok" if scan and "BarcodeDetector" in scan and "rest/v1/checkin" in scan else "masalah",
          "scan.html: pemindai panitia + catat check-in")
    mas = baca("master.html")
    lapor("ok" if "Link Scan QR Panitia" in mas and "scan.html?s=" in mas else "masalah",
          "master.html: kartu Link Scan QR Panitia (bisa dibagikan)")
    sql = baca("tools/checkin.sql") if os.path.isfile(os.path.join(ROOT, "tools/checkin.sql")) else ""
    lapor("ok" if "unique (slug, guest)" in sql else "masalah",
          "tools/checkin.sql: skema tabel check-in")
    lapor("ok" if "function unduhDaftarHadir(" in mas and "Unduh Daftar Hadir" in mas else "masalah",
          "master.html: tombol Unduh Daftar Hadir (CSV)")
    lapor("ok" if "function qrDataUndangan(" in stu and "function dlQrUndangan(" in stu else "masalah",
          "studio.html: QR Undangan opsional + tombol download")
    lapor("ok" if os.path.isfile(os.path.join(ROOT, "assets/jsqr.js")) else "masalah",
          "assets/jsqr.js: decoder QR cadangan (perangkat tanpa BarcodeDetector)")
    java = (baca("android/app/src/main/java/my/id/asproject/studio/StudioActivity.java")
            if os.path.isfile(os.path.join(ROOT, "android/app/src/main/java/my/id/asproject/studio/StudioActivity.java")) else "")
    lapor("ok" if "RESOURCE_VIDEO_CAPTURE" in java and "pendingWebPermission" in java else "masalah",
          "aplikasi Android: kamera web untuk scan QR diizinkan")


# ------------------------------------ 20. tema pernikahan sesuai nama template
def cek_template_pernikahan():
    """Dulu memeriksa 21 skin tema pernikahan satu per satu; sejak katalog direset
    yang dicek tema dasar + kebersihan berkas. Mesin skin (kelas wedding-cover,
    kartu, aksen) sengaja dipertahankan supaya tema baru tinggal memakai."""
    print("\n[20] Tema dasar katalog & skin undangan pernikahan")
    st, und, index = baca("studio.html"), baca("undangan.html"), baca("index.html")
    rows = _tpl_rows("studio.html")
    lapor("ok" if rows else "masalah",
          f"studio.html: {len(rows)} tema terdaftar di katalog")
    if not rows:
        return
    dasar = rows[0]
    for rel, text in (("studio.html", st), ("undangan.html", und)):
        ok = (f"id:'{dasar['id']}'" in text and f"nama:'{dasar['nama']}'" in text
              and f"accent:'{dasar['accent']}'" in text)
        lapor("ok" if ok else "masalah",
              f"{rel}: tema dasar {dasar['id']} lengkap (id/nama/aksen)")
    ok = f'id:"{dasar["id"]}",name:"{dasar["nama"]}"' in index
    lapor("ok" if ok else "masalah", "index.html: katalog publik memakai tema dasar yang sama")
    for token in ("body.wedding-cover #cover", "body.wedding-cover .wrap", "wedding-invite-card"):
        lapor("ok" if token in und else "masalah", f"undangan.html: skin wedding {token} tersedia")
    for rel in ("studio.html", "undangan.html", "index.html"):
        sisa = sorted(t for t in TEMA_LAMA if t in baca(rel))
        lapor("ok" if not sisa else "masalah",
              f"{rel}: bersih dari id tema lama" if not sisa
              else f"{rel}: masih menyebut id tema lama: {', '.join(sisa)}")
    if shutil.which("node"):
        skrip = os.path.join(ROOT, "tools", "test-wedding-templates.cjs")
        r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
        baris = [b.strip() for b in r.stdout.splitlines()
                 if b.strip().startswith(("PASS:", "INFO:", "FAIL:"))]
        lapor("ok" if r.returncode == 0 else "masalah",
              "uji skin template: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))
    else:
        lapor("info", "node tidak tersedia — uji skin template dilewati")


def cek_vip_4d():
    print("\n[21] Mesin & tema VIP 4D (assets/vip-4d.js)")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji VIP 4D dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-vip-4d.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji VIP 4D: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))


def cek_simulasi():
    print("\n[22] Simulasi pemakaian (studio → export → undangan live)")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — simulasi pemakaian dilewati")
        return
    probe = subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT)
    if probe.returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — simulasi pemakaian dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-simulasi.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji simulasi pemakaian: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))


# ------------------------------------- 23. Studio Template (perancang tema baru)
def _blok_objek(teks, pembuka):
    """Isi objek sumber mulai dari '{' pertama setelah `pembuka`."""
    return _blok_array(teks, pembuka)


def _blok_array(teks, pembuka):
    """Isi array/objek sumber mulai dari '[' pertama setelah `pembuka`."""
    i = teks.find(pembuka)
    if i < 0:
        return ""
    b = teks.find("[", i)
    kb = teks.find("{", i)
    if kb >= 0 and (b < 0 or kb < b):
        b = kb
    d, k = 0, b
    while k < len(teks) and b >= 0:
        c = teks[k]
        if c in "'\"`":
            k += 1
            while k < len(teks):
                if teks[k] == "\\":
                    k += 2
                    continue
                if teks[k] == c:
                    break
                k += 1
        elif c in "[{":
            d += 1
        elif c in "]}":
            d -= 1
            if d == 0:
                break
        k += 1
    return teks[b + 1:k]


def _id_objek(b):
    return re.findall(r"\{\s*id\s*:\s*'([^']+)'", b)


def _id_fx(b):
    return re.findall(r"\[\s*'([^']+)'", b)


def cek_studio_template():
    print("\n[23] Studio Template (perancang tema undangan)")
    rel = "template-studio.html"
    if not os.path.isfile(os.path.join(ROOT, rel)):
        lapor("info", "template-studio.html belum ada — Studio Template opsional")
        return
    hal, stu, und = baca(rel), baca("studio.html"), baca("undangan.html")
    # 1) mesin tema harus sama persis (kalau tidak, tema rancangan ≠ tampilan undangan)
    for nama, pola, label, jumlah in (("FONTS", _id_objek, "font", 17),
                                      ("BORDERS", _id_objek, "border", 49),
                                      ("SLIDES", _id_objek, "bagian undangan", 10),
                                      ("FX_COVER", _id_fx, "efek pembuka", 20),
                                      ("FX_SCROLL", _id_fx, "efek gulir", 44)):
        a = pola(_blok_array(hal, "const %s=" % nama))
        b = pola(_blok_array(stu, "const %s=" % nama))
        sama = bool(a) and a == b and len(a) == jumlah
        lapor("ok" if sama else "masalah",
              "%s: %d %s sama & berurutan dengan studio.html" % (rel, len(a), label))
    # 2) 13 tema bawaan harus urutan yang sama dengan mesin undangan & katalog
    bawaan = _id_objek(_blok_array(hal, "const TPL_BAWAAN="))
    mesin = _id_objek(_blok_array(stu, "const TPL="))
    tamu = _id_objek(_blok_array(und, "const TPL="))
    katalog = re.findall(r'\{id:"([^"]+)"', _blok_array(baca("index.html"), "var Pn=["))
    lapor("ok" if bawaan and bawaan == mesin[:len(bawaan)] else "masalah",
          "%s: %d tema bawaan sejalan dengan studio.html" % (rel, len(bawaan)))
    lapor("ok" if bawaan == tamu[:len(bawaan)] else "masalah",
          "%s: tema bawaan sejalan dengan undangan.html" % rel)
    lapor("ok" if bawaan == katalog[:len(bawaan)] else "masalah",
          "%s: tema bawaan sejalan dengan katalog index.html" % rel)
    # 3) halaman memakai aset repo, bukan salinan liar
    for berkas in ("assets/theme-contrast.js", "assets/scroll-effects.js", "assets/scroll-effects.css"):
        lapor("ok" if berkas in hal else "masalah", "%s: memakai %s" % (rel, berkas))
    lapor("ok" if "data-cover-undangan" in hal else "masalah",
          "%s: CSS cover disalin dari undangan.html (pratinjau = halaman tamu)" % rel)
    lapor("ok" if "function patCss(t)" in hal else "masalah",
          "%s: patCss() ikut disalin supaya motif identik" % rel)
    # 4) daftar id tema lama harus sama dengan daftar di berkas ini
    app_lama = set(re.findall(r"'([a-z][a-z-]+)'", _blok_array(hal, "const TEMA_LAMA=[")))
    lapor("ok" if app_lama == TEMA_LAMA else "masalah",
          "%s: daftar TEMA_LAMA sama dengan pemeriksa ini (%d id)" % (rel, len(app_lama)))
    # 5) skrip pemasang ada & mendukung uji kering + pembatalan
    psg = os.path.join(ROOT, "tools", "pasang-template.cjs")
    if not os.path.isfile(psg):
        lapor("masalah", "tools/pasang-template.cjs tidak ada — alur ekspor tidak bisa otomatis")
    else:
        isi = baca("tools/pasang-template.cjs")
        kurang = [t for t in ("--kering", "--batalkan", ".bak-template", "const TPL=[", "var Pn=[") if t not in isi]
        lapor("ok" if not kurang else "masalah",
              "tools/pasang-template.cjs siap dipakai (kering/batalkan/cadangan)" +
              ("" if not kurang else " — kurang: " + ", ".join(kurang)))
    # 6) uji halaman itu sendiri
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji Studio Template dilewati")
    else:
        uji = os.path.join(ROOT, "tools", "test-template-studio.cjs")
        if not os.path.isfile(uji):
            lapor("masalah", "tools/test-template-studio.cjs tidak ada")
        else:
            r = subprocess.run(["node", uji], capture_output=True, text=True, cwd=ROOT)
            ringkas = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan:")]
            pesan = ringkas[0] if ringkas else (r.stdout.strip() or r.stderr.strip())[-220:]
            lapor("ok" if r.returncode == 0 else "masalah", "uji Studio Template: " + pesan)


# --------------------------------- 24. Dekorasi tema (hiasan sudut/kelopak/pembatas)
def cek_dekorasi_tema():
    print("\n[24] Dekorasi tema (bunga/batik, hiasan sudut & kelopak)")
    stu, und = baca("studio.html"), baca("undangan.html")
    # 1) motif bunga & batik baru harus tersedia di mesin kedua halaman
    pat = lambda s: re.findall(r"t\.pat==='([a-z]+)'", s[s.index("function patCss(t){"):s.index("function patCss(t){") + 9000])
    motif = pat(stu)
    baru = [m for m in ("rose", "sakura", "daisy", "vine", "parang", "mendung") if m not in motif]
    lapor("ok" if not baru else "masalah",
          "motif bunga & batik baru tersedia (%d motif: %s)" % (len(motif), ", ".join(motif[:6])) +
          ("" if not baru else " — kurang: " + ", ".join(baru)))
    lapor("ok" if motif == pat(und) else "masalah", "daftar motif studio.html & undangan.html sama")
    # 2) border ber-art harus merujuk hiasan sudut yang ada
    dko = re.findall(r"'([a-z]+)'", _blok_array(stu, "const DKO_IDS=["))
    art = re.findall(r"art:'([a-z]+)'", stu)
    asing = sorted({a for a in art if a not in dko})
    lapor("ok" if art and not asing else "masalah",
          "%d border memakai hiasan sudut yang terdaftar" % len(art) +
          ("" if not asing else " — tidak dikenal: " + ", ".join(asing)))
    # 3) mesin dekorasi sama di studio, undangan, dan Studio Template
    wajib = ("function artDekoSudut(", "function dekoSudutHtml(", "function dekoFltHtml(",
             "function dekoDivHtml(", "function dekoPilih(", "const DKO_IDS=", "const FLT_IDS=", "const DVD_IDS=")
    for rel, isi in (("studio.html", stu), ("undangan.html", und), ("template-studio.html", baca("template-studio.html"))):
        kurang = [w for w in wajib if w not in isi]
        lapor("ok" if not kurang else "masalah",
              "%s: mesin dekorasi lengkap" % rel + ("" if not kurang else " — kurang: " + ", ".join(kurang)))
    # 4) CSS + aksesibilitas
    for kelas in (".deko-sudut{", ".deko-flt{", ".deko-dvd{", "@keyframes dekoTurun", "@keyframes dekoBinar"):
        lapor("ok" if kelas in und and kelas in stu else "masalah", "CSS %s ada di kedua halaman" % kelas)
    lapor("ok" if ".deko-flt{display:none}" in und else "masalah",
          "undangan.html: kelopak mati otomatis saat tamu memilih kurangi gerakan")
    lapor("ok" if "pointer-events:none" in und[und.index(".deko-sudut{"):und.index(".deko-sudut{") + 400] else "masalah",
          "undangan.html: dekorasi tidak menangkap klik (pointer-events:none)")
    # 5) dekorasi tersimpan saat publish + ikut ekspor HTML mandiri
    simpan = len(re.findall(r"dko:state\.dko,flt:state\.flt,dvd:state\.dvd", stu))
    lapor("ok" if simpan >= 3 else "masalah",
          "studio.html: pilihan dekorasi ikut snapshot publish/arsip/ekspor (%d tempat)" % simpan)
    # 6) uji halaman dekorasi
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji dekorasi dilewati")
    else:
        uji = os.path.join(ROOT, "tools", "test-dekorasi-tema.cjs")
        if not os.path.isfile(uji):
            lapor("masalah", "tools/test-dekorasi-tema.cjs tidak ada")
        else:
            r = subprocess.run(["node", uji], capture_output=True, text=True, cwd=ROOT)
            ringkas = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan:")]
            lapor("ok" if r.returncode == 0 else "masalah",
                  "uji dekorasi tema: " + (ringkas[0] if ringkas else (r.stdout or r.stderr).strip()[-200:]))
    # 7) skrip sinkronisasi mesin harus bisa dipakai
    sink = os.path.join(ROOT, "tools", "sinkron-studio-template.py")
    if not os.path.isfile(sink):
        lapor("masalah", "tools/sinkron-studio-template.py tidak ada — mesin Studio Template tidak bisa disinkronkan")
    else:
        r = subprocess.run([sys.executable, sink, "--kering"], capture_output=True, text=True, cwd=ROOT)
        lapor("ok" if r.returncode == 0 else "masalah",
              "mesin Studio Template sinkron dengan studio.html/undangan.html"
              if r.returncode == 0 else "mesin Studio Template BEDA — jalankan python3 tools/sinkron-studio-template.py")


# -------------------------------- 25. Kanvas Template (kanvas kosong gaya Canva)
def cek_kanvas():
    print("\n[25] Kanvas Template (kanvas kosong gaya Canva)")
    rel = "kanvas.html"
    if not os.path.isfile(os.path.join(ROOT, rel)):
        lapor("info", "kanvas.html belum ada — Kanvas Template opsional")
        return
    hal, stu, ts = baca(rel), baca("studio.html"), baca("template-studio.html")
    # 1) mesin (font & bagian undangan) harus sama dengan studio.html
    for nama, pola, label, jumlah in (("FONTS", _id_objek, "font", 17),
                                      ("SLIDES", _id_objek, "bagian undangan", 10)):
        a = pola(_blok_array(hal, "const %s=" % nama))
        b = pola(_blok_array(stu, "const %s=" % nama))
        lapor("ok" if a and a == b and len(a) == jumlah else "masalah",
              "%s: %d %s sama & berurutan dengan studio.html" % (rel, len(a), label))
    # 2) blok mesin bertanda + motif/hiasan DITURUNKAN dari mesin (tidak ada daftar kedua)
    lapor("ok" if "MESIN (SALINAN PERSIS dari studio.html" in hal and "KANVAS AsProject" in hal else "masalah",
          "%s: blok mesin bertanda (bisa disinkronkan ulang)" % rel)
    turunan = ("patCss.toString()" in hal and "function artHias(" in hal
               and "artDekoSudut" in hal and "artDekoDiv" in hal and "Object.keys(DEKO_BENTUK)" in hal)
    lapor("ok" if turunan else "masalah",
          "%s: daftar motif & hiasan diturunkan dari mesin (tidak bisa basi)" % rel)
    # 3) fungsi inti & kunci penyimpanan
    wajib = ("asproject.kanvas.v1", "asproject.kanvas.handoff", "function htmlDok(",
             "function svgDok(", "function jadikanTema(", "function kirimKeStudioTemplate(",
             "function esc(", "function warnaAman(", "function srcAman(", "function bakuEl(")
    kurang = [w for w in wajib if w not in hal]
    lapor("ok" if not kurang else "masalah",
          "%s: simpan/muat, ekspor, dan pengaman input lengkap" % rel
          + ("" if not kurang else " — kurang: " + ", ".join(kurang)))
    # 4) ekspor aman: semua tulisan pengguna lewat esc() sebelum masuk HTML/SVG
    lolos = ("esc(e.isi)" in hal and "esc(t)" in hal and hal.count("esc(") >= 15)
    lapor("ok" if lolos else "masalah", "%s: tulisan pengguna di-escape saat digambar & diekspor" % rel)
    # 5) sambungan dua arah dengan Studio Template
    lapor("ok" if "kanvas.html" in ts and "function dariKanvas" in ts and "dari=kanvas" in ts else "masalah",
          "template-studio.html: tautan ke kanvas + impor rancangan (dariKanvas)")
    lapor("ok" if "template-studio.html" in hal and "studio.html" in hal else "masalah",
          "%s: menaut balik ke Studio Template & Studio undangan" % rel)
    # 6) uji halaman kanvas
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji kanvas dilewati")
        return
    uji = os.path.join(ROOT, "tools", "test-kanvas.cjs")
    if not os.path.isfile(uji):
        lapor("masalah", "tools/test-kanvas.cjs tidak ada")
        return
    r = subprocess.run(["node", uji], capture_output=True, text=True, cwd=ROOT)
    ringkas = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan:")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji kanvas: " + (ringkas[0] if ringkas else (r.stdout or r.stderr).strip()[-200:]))


# -------------------- 26. Kelengkapan: animasi, border 2D/3D/4D, preferensi, slider
def cek_kelengkapan():
    print("\n[26] Kelengkapan tema (animasi baru, preferensi, galeri slider)")
    stu, und = baca("studio.html"), baca("undangan.html")
    # 1) jumlah pilihan animasi
    def id_fx(teks, nama):
        return _fx_ids(teks, nama) or []
    for nama, jumlah, label in (("FX_SCROLL", 44, "efek gulir"), ("FX_COVER", 20, "efek pembuka")):
        a, b = id_fx(stu, nama), id_fx(und, nama)
        lapor("ok" if a and a == b and len(a) == jumlah else "masalah",
              "%d %s (daftar sama di studio & undangan)" % (len(a), label))
    # 2) border sudut 2D/3D/4D
    bs = _id_objek(_blok_array(stu, "const BORDERS="))
    baru = [b for b in ("sudut-2d-garis", "sudut-3d-timbul", "sudut-4d-kilau") if b in bs]
    kf = all(("@keyframes " + k) in stu and ("@keyframes " + k) in und for k in ("bdKilau", "bdAlir", "bdDenjut"))
    lapor("ok" if len(baru) == 3 and kf else "masalah",
          "border sudut 2D/3D/4D tersedia (%d border, animasi 4D punya keyframes)" % len(bs))
    lapor("ok" if "prefers-reduced-motion:reduce){.bdfr{animation:none" in und else "masalah",
          "animasi border 4D berhenti saat tamu memilih kurangi gerakan")
    # 3) preferensi: daftar lengkap + tiga jalur snapshot
    kunci = re.findall(r"([a-zA-Z]+):", _blok_objek(stu, "const PREF_BAWAAN="))
    simpan = len(re.findall(r"pref:Object\.assign\(\{\},state\.pref\)", stu))
    lapor("ok" if len(kunci) >= 8 and simpan >= 3 else "masalah",
          "preferensi: %d pilihan, ikut tersimpan di %d jalur (publish/arsip/ekspor)" % (len(kunci), simpan))
    for cid in ("gerak", "musik", "sapaan", "tanda", "tombolAtas", "hitung", "slider", "sliderDetik"):
        if ("setPref('" + cid + "'") not in stu:
            lapor("masalah", "preferensi '%s' tidak punya pengatur di Studio" % cid)
            break
    else:
        lapor("ok", "semua pilihan preferensi punya pengatur di tab Desain")
    # 4) galeri slider
    fx = re.findall(r"fx-gal-([a-z]+)[\s{,]", und)
    lapor("ok" if sorted(set(fx)) == ["coverflow", "cube", "fade", "flip", "slide", "zoom"] else "masalah",
          "galeri: 6 efek slider (+ susunan grid lama) tersedia")
    lapor("ok" if "function galHtml(" in stu and "function galHtml(" in und and "prefOf(" in und else "masalah",
          "galeri & preferensi dipakai di undangan tamu dan pratinjau Studio")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji kelengkapan dilewati")
        return
    uji = os.path.join(ROOT, "tools", "test-lengkap.cjs")
    if not os.path.isfile(uji):
        lapor("masalah", "tools/test-lengkap.cjs tidak ada")
        return
    r = subprocess.run(["node", uji], capture_output=True, text=True, cwd=ROOT)
    ringkas = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan:")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji kelengkapan: " + (ringkas[0] if ringkas else (r.stdout or r.stderr).strip()[-200:]))


def main():
    print("=" * 74)
    print("Pemeriksa kesehatan repo AsProject —", os.path.basename(ROOT))
    print("=" * 74)
    for fn in (cek_link, cek_url_berbahaya, cek_sintaks, cek_id,
               cek_selector_injeksi, cek_konten, cek_duplikat_injeksi, cek_peta_demo,
               cek_resolusi_demo, cek_anchor, cek_pipeline_undangan, cek_katalog_publik,
               cek_fitur_terbaru, cek_alur_master, cek_kontras_tema,
               cek_tema_3d, cek_foto_cover, cek_skrip_build, cek_scan_panitia,
               cek_template_pernikahan, cek_vip_4d, cek_simulasi,
               cek_studio_template, cek_dekorasi_tema, cek_kanvas, cek_kelengkapan):
        fn()
    print("\n" + "=" * 74)
    print(f"Ringkasan: {hitung['ok']} ok, {hitung['masalah']} masalah, {hitung['info']} catatan")
    print("Yang tetap butuh mata manusia di preview: tampilan, animasi, autoplay")
    print("musik, dan rasa keseluruhan — sandbox ini tidak punya browser.")
    print("=" * 74)
    return 1 if hitung["masalah"] else 0


if __name__ == "__main__":
    sys.exit(main())
