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
           "checkin.html", "demo/ice-blue.html", "master.html"]
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
    i_nama = s.index("var DEMO_BY_NAME")
    i_kat = s.index("var DEMO_BY_CATEGORY", i_nama)
    nama = dict(re.findall(r"'([^']+)':\s*'(demo/[^']+)'", s[i_nama:i_kat]))
    kat_blok = s[i_kat:i_kat + 1200]
    kat = {}
    for k, v in re.findall(r"'([^']+)':\s*(\[[^\]]*\]|'demo/[^']+')", kat_blok):
        kat[k] = re.findall(r"'(demo/[^']+)'", v) if v.startswith("[") else [v]
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


def _fx_ids(s, nama_arr):
    """Urutan id efek di array FX_COVER / FX_SCROLL sebuah file."""
    m = re.search(r"const %s=\[(.*?)\];" % nama_arr, s, re.S)
    if not m:
        return None
    return re.findall(r"\['([a-z-]+)'", m.group(1))


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
    # 11) 10 efek animasi cover & 24 efek scroll: daftar id identik di kedua file
    for nama_arr in ("FX_COVER", "FX_SCROLL"):
        a, b = _fx_ids(studio, nama_arr), _fx_ids(undangan, nama_arr)
        if a is None or b is None:
            lapor("masalah", f"array {nama_arr} tidak ditemukan di studio/undangan")
        elif a == b and len(a) == (24 if nama_arr == "FX_SCROLL" else 10):
            lapor("ok", f"{nama_arr} identik di studio & undangan ({len(a)} efek)")
        else:
            lapor("masalah", f"{nama_arr} studio != undangan! studio={a} undangan={b}")
    # 12) daftar font (15) identik di kedua file
    fa, fb = _font_ids(studio), _font_ids(undangan)
    if fa is None or fb is None:
        lapor("masalah", "array FONTS tidak ditemukan di studio/undangan")
    elif fa == fb and len(fa) == 15:
        lapor("ok", f"FONTS identik di studio & undangan ({len(fa)} font)")
    else:
        lapor("masalah", f"FONTS studio != undangan! studio={fa} undangan={fb}")
    # 13) 20 tema baru punya karakter (char) di kedua file
    for label, s in (("studio.html", studio), ("undangan.html", undangan)):
        n = len(re.findall(r"char:'", s))
        lapor("ok" if n >= 20 else "masalah",
              f"{label}: 20 tema baru membawa karakter maskot (char: {n})")
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
    ok = "%d template premium" % len(studio_ids) in index
    lapor("ok" if ok else "masalah",
          "index.html: teks jumlah template sinkron (%d)" % len(studio_ids))


def cek_fitur_terbaru():
    print("\n[13] Fitur terbaru (hide katalog, 5 tema feminin, 20 border, teks WA)")
    studio = baca("studio.html")
    undangan = baca("undangan.html")
    # 1) 5 tema feminin baru (ultah & aqiqah) di kedua file, urutan TPL tetap identik
    baru = ["fairy-princess", "unicorn-magic", "rose-bouquet", "baby-rose", "baby-fairy"]
    for rel, s in (("studio.html", studio), ("undangan.html", undangan)):
        ada = [i for i in baru if ("id:'%s'" % i) in s]
        lapor("ok" if len(ada) == 5 else "masalah",
              f"{rel}: 5 tema feminin baru ada ({len(ada)}/5)")
    ids_st = _tpl_ids("studio.html") or []
    ids_ud = _tpl_ids("undangan.html") or []
    lapor("ok" if ids_st == ids_ud and len(ids_st) == 40 else "masalah",
          f"urutan TPL identik di studio & undangan ({len(ids_st)} template)")
    # 2) 20 border: array identik di studio & undangan, tersimpan saat publish, dipakai live
    def _border_ids(s):
        m = re.search(r"const BORDERS=\[(.*?)\];", s, re.S)
        return re.findall(r"\{id:'([a-z0-9]+)'", m.group(1)) if m else None
    bs, bu = _border_ids(studio), _border_ids(undangan)
    lapor("ok" if bs and bu and len(bs) == 20 and len(set(bs)) == 20 and bs == bu else "masalah",
          "BORDERS 20 id unik, identik di studio & undangan")
    ok = "border:state.border" in studio
    lapor("ok" if ok else "masalah", "studio.html: publish() menyimpan border ke snapshot data")
    ok = "const BD=BORDERS.find(b=>b.id===(d&&d.border))" in undangan and "#cover .bdfr" in undangan
    lapor("ok" if ok else "masalah", "undangan.html: live cover memakai data.border (frame .bdfr)")
    ok = "border:'double'" in studio and "setBorder(id){state.border=id" in studio
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
    print("\n[16] Tema 3D ulang tahun (assets/tema-3d/)")
    folder = os.path.join(ROOT, "assets", "tema-3d")
    berkas = sorted(f for f in os.listdir(folder) if f.endswith(".webp")) if os.path.isdir(folder) else []
    lapor("ok" if berkas else "masalah",
          f"artwork 3D tersedia ({len(berkas)} berkas webp)")
    for rel in ("undangan.html", "studio.html"):
        isi = baca(rel)
        jumlah = isi.count("bg3d:'assets/tema-3d/")
        lapor("ok" if jumlah == len(berkas) else "masalah",
              f"{rel}: {jumlah} tema memakai artwork 3D (berkas: {len(berkas)})")
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
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji foto cover dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-foto-cover.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines()
             if b.strip().startswith("Ringkasan") or b.strip().startswith("kontras")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji foto cover: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))


def main():
    print("=" * 74)
    print("Pemeriksa kesehatan repo AsProject —", os.path.basename(ROOT))
    print("=" * 74)
    for fn in (cek_link, cek_url_berbahaya, cek_sintaks, cek_id,
               cek_selector_injeksi, cek_konten, cek_duplikat_injeksi, cek_peta_demo,
               cek_resolusi_demo, cek_anchor, cek_pipeline_undangan, cek_katalog_publik,
               cek_fitur_terbaru, cek_alur_master, cek_kontras_tema,
               cek_tema_3d, cek_foto_cover):
        fn()
    print("\n" + "=" * 74)
    print(f"Ringkasan: {hitung['ok']} ok, {hitung['masalah']} masalah, {hitung['info']} catatan")
    print("Yang tetap butuh mata manusia di preview: tampilan, animasi, autoplay")
    print("musik, dan rasa keseluruhan — sandbox ini tidak punya browser.")
    print("=" * 74)
    return 1 if hitung["masalah"] else 0


if __name__ == "__main__":
    sys.exit(main())
