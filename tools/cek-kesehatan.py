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
#   9. peta undangan: pratinjau ubin sendiri wajib ada, embed Google hanya
#      lapisan opsional (tamu tidak boleh disajikan bidang biru kosong)
#  10. kartu QR check-in di dalam undangan: isi QR harus sama dengan yang
#      diunduh dari Studio/Master, pustaka dimuat malas, ada jalan keluar
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
           "checkin.html", "demo/ice-blue.html", "katalog-demo/undangan-luxury-gold.html",
           "katalog-demo/undangan-wedding-rosewood.html", "katalog-demo/undangan-wedding-sage-pearl.html",
           "katalog-demo/undangan-wedding-midnight-navy.html", "katalog-demo/undangan-khitanan-emerald.html",
           "katalog-demo/undangan-aqiqah-natural.html", "katalog-demo/undangan-ulang-tahun-ceria.html",
           "master.html", "scan.html"]
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
    """Baris TPL termasuk kategori, harga, dan penanda Studio-only/Arch."""
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
        row["studioOnly"] = bool(re.search(r"studioOnly:true", chunk))
        row["arch"] = bool(re.search(r"arch:true", chunk))
        g = re.search(r"harga:(\d+)", chunk)
        row["harga"] = int(g.group(1)) if g else 0
        rows.append(row)
    return rows


def _fx_ids(s, nama_arr):
    """Urutan id efek di array FX_COVER / FX_SCROLL sebuah file."""
    m = re.search(r"const %s=\[(.*?)\];" % nama_arr, s, re.S)
    if not m:
        return None
    ids = re.findall(r"\['([a-z-]+)'", m.group(1))
    return ids or re.findall(r"'([a-z-]+)'", m.group(1))


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
    # 11) 10 efek animasi cover & 34 efek scroll: daftar id identik di kedua file
    for nama_arr in ("FX_COVER", "FX_SCROLL"):
        a, b = _fx_ids(studio, nama_arr), _fx_ids(undangan, nama_arr)
        if a is None or b is None:
            lapor("masalah", f"array {nama_arr} tidak ditemukan di studio/undangan")
        elif a == b and len(a) == (34 if nama_arr == "FX_SCROLL" else 14):
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
          and "function setFloat" in studio and "function fpCover" in studio
          and "syncAudio();syncFloat()" in studio
          and "undangan.html?preview=1" in studio and "function barisUndangan" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: floating preview (widget melayang + toggle + kembali ke cover + sync di render)")
    # 15) tombol publish ulang + penanda perubahan sejak publish
    ok = ("function draftDirty" in studio and "🔁 Publish Ulang" in studio
          and "state.pubSig=draftSig()" in studio and "function refreshEditorStatus" in studio
          and "● Ada perubahan belum dipublikasikan" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: publish ulang tersedia & perubahan sejak publish ditandai jelas")
    # 16) riwayat undangan dari server + pemulihan isi lengkap
    ok = ("function muatRiwayat" in studio and "function bukaRiwayatServer" in studio
          and "function applyDraftData" in studio and "function fetchDraftRow" in studio
          and "Riwayat dari server" in studio and "guestsRaw" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: riwayat dari server (muat/buka) + snapshot arsip lengkap (amplop, galeri, tamu)")
    # 17) tombol kembali di studio (layar awal, halaman utama, antar-halaman)
    ok = ("function showWelcome" in studio and "function balikKeEditor" in studio
          and studio.count('href="./"') >= 2 and "← Kembali ke Editor" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: tombol kembali (layar awal tanpa hapus draft, halaman utama, antar-halaman)")
    # 18) pratinjau studio = berkas undangan asli (iframe) dengan payload yang sama dgn publish
    ok = ("undangan.html?preview=1" in studio and "function barisUndangan" in studio
          and "payload=barisUndangan()" in studio and "asproject:preview" in studio
          and "const PREVIEW=Q.get('preview')==='1'" in undangan and "function pvTerapkan" in undangan
          and "body.preview-mode #coverBack{display:none}" in undangan)
    lapor("ok" if ok else "masalah",
          "pratinjau studio memakai renderer live (iframe) & payload identik dengan publish")
    # 19) link undangan untuk semua tamu (tanpa nama) di master & studio
    mas = baca("master.html")
    ok = ("function allLink" in mas and "function copyAllLink" in mas and "function shareAllWa" in mas
          and "Link Undangan untuk Semua" in mas and "Salin Link Semua" in studio
          and "Link untuk semua tamu (tanpa nama)" in studio)
    lapor("ok" if ok else "masalah",
          "master.html & studio: link undangan untuk semua tamu (tanpa ?to=) tersedia beserta salin/WA/buka")
    # 20) galeri grid (bukan geser) + slide rapat tanpa ruang kosong + 15 model cover
    ok = ("gal-grid" in undangan and "gal-cell" in undangan and "galx-slide" not in undangan
          and "Ketuk foto untuk memperbesar" in undangan)
    lapor("ok" if ok else "masalah",
          "undangan.html: galeri tampil sebagai grid rapi (maks 6 foto + penanda sisa), bukan carousel geser")
    ok = ("pslide-multi" in undangan and "groups.push(gr)" in undangan
          and "target=Math.max(430,(window.innerHeight||700)-150)" in undangan)
    lapor("ok" if ok else "masalah",
          "undangan.html: mode slide menggabung bagian pendek per layar supaya tidak kosong memanjang")
    cover_ids = ["amplop", "kartu", "foto", "gerbang", "minimal", "batik", "sakura", "night", "ticket", "editorial", "polaroid", "glass", "royal", "archive", "neon"]
    start = studio.find("const CV_LAYOUTS=[")
    end = studio.find("];", start)
    layout_block = studio[start:end] if start >= 0 and end > start else ""
    ids_ui = re.findall(r"\['([a-z]+)'", layout_block)
    ok = (ids_ui == cover_ids and all(("'" + x + "'") in undangan for x in cover_ids)
          and all(("body.cvl-" + x + " #cover") in undangan for x in cover_ids[5:])
          and "monogramOf" in undangan and "d.coverLayout" in undangan
          and "CV_LAYOUTS" in studio and studio.count("setCvLayout") >= 2
          and "coverLayout:state.coverLayout||'amplop'" in studio)
    lapor("ok" if ok else "masalah",
          "15 model cover pembuka (5 dasar + 10 unik) tersedia di Studio & renderer live")
    # 21) musik upload tersimpan di IndexedDB agar dipakai lagi tetap bersuara
    ok = ("idbPut" in studio and "idbGetUrl" in studio and "indexedDB.open('asproject-musik'" in studio
          and "local:true,idb:1,url:''" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: musik upload disimpan di IndexedDB (blob) sehingga dipakai lagi tetap bersuara")
    # 22) susunan tab studio: master+domain dilebur jadi Terbit & ada lanjut/mundur
    ok = ("['terbit','Terbit & Bagikan']" in studio and 'class="tabnav"' in studio
          and "state.tab='terbit'" in studio and "if(stored.tab==='master'||stored.tab==='domain')stored.tab='terbit'" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: urutan pengisian dirapikan (7 tab + tombol Lanjut/Mundur, master+domain dilebur)")
    # 23) tombol kembali ke cover di undangan live
    ok = ('id="coverBack"' in undangan and "function kembaliKeCover" in undangan
          and "body.opened #coverBack{display:inline-flex}" in undangan
          and "body.embed-buka #coverBack" in undangan)
    lapor("ok" if ok else "masalah",
          "undangan.html: tombol kembali ke cover (tampil setelah dibuka, disembunyikan di hero embed)")


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
    rows = _tpl_rows("studio.html")
    studio_public_ids = [r["id"] for r in rows if not r["studioOnly"]]
    studio_only_ids = [r["id"] for r in rows if r["studioOnly"]]
    mismatch = pub_ids != studio_public_ids
    lapor("ok" if not mismatch else "masalah",
          "index.html: %d tema publik sinkron; %d tema Studio-only tidak dipublikasikan%s" % (
              len(pub_ids), len(studio_only_ids),
              "" if not mismatch else " — daftar publik harus sama dengan subset TPL non-Studio-only"))
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
    ok = "%d template" % len(pub_ids) in index
    lapor("ok" if ok else "masalah",
          "index.html: teks jumlah template sinkron (%d tema publik)" % len(pub_ids))


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
    arch_rows = [r for r in rows if r["arch"]]
    arch_categories = {r["ev"] for r in arch_rows}
    arch_ok = (len(arch_rows) == 6 and all(r["studioOnly"] for r in arch_rows)
               and arch_categories == {"pernikahan", "khitanan", "aqiqah", "ultah"}
               and "body.gerbang-arch" in undangan
               and "state.coverStyle=t&&t.arch?'arch':'kotak'" in studio)
    lapor("ok" if arch_ok else "masalah",
          f"Gerbang Arch: {len(arch_rows)} varian Studio tersambung ke skin live lintas 4 kategori")
    katalog_arch_ok = (all(r["harga"] == 0 for r in arch_rows)
                       and "katalog:TPL.filter(t=>!t.studioOnly).map" in studio
                       and "if(!t.studioOnly&&!state.katalogDel.includes(t.id)&&!state.katalog.some" in studio
                       and "state.katalogHide=state.katalogHide.filter(id=>{const t=tplById(id);return !!t&&!t.studioOnly});" in studio)
    lapor("ok" if katalog_arch_ok else "masalah",
          "Studio-only Arch: tetap bisa dipilih tanpa harga, promo, atau baris katalog pemasaran")
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

    # 2) 23 border: array identik di studio & undangan, tersimpan saat publish, dipakai live
    def _border_ids(s):
        m = re.search(r"const BORDERS=\[(.*?)\];", s, re.S)
        return re.findall(r"\{id:'([a-z0-9-]+)'", m.group(1)) if m else None
    bs, bu = _border_ids(studio), _border_ids(undangan)
    lapor("ok" if bs and bu and len(bs) == 32 and len(set(bs)) == 32 and bs == bu else "masalah",
          "BORDERS 32 id unik, identik di studio & undangan")
    # 2b) gating konten EKSKLUSIF: kunci tier di studio + konten baru sinkron di undangan
    eks_dipakai = any(r["tier"] == "eksklusif" for r in _tpl_rows("studio.html"))
    ok = ("bolehEks" in studio and "paksaTier" in studio and "kunciEks" in studio
          and all(i in studio and i in undangan for i in
                  ("id:'laurel'", "id:'artdeco'", "id:'pearl'", "id:'cinzel'", "id:'marcellus'"))
          and "fx-c-shimmer" in undangan
          and (not eks_dipakai or "tier:'eksklusif'" in studio))
    lapor("ok" if ok else "masalah",
          "studio: gating konten EKSKLUSIF per tier; border/font/fx baru sinkron di undangan"
          + ("" if not ok or eks_dipakai else " (tidak ada tema tier eksklusif di katalog — syarat dilonggarkan)"))
    ok = "border:state.border" in studio
    lapor("ok" if ok else "masalah", "studio.html: publish() menyimpan border ke snapshot data")
    ok = "const BD=BORDERS.find(b=>b.id===(d&&d.border))" in undangan and "#cover .bdfr" in undangan
    lapor("ok" if ok else "masalah", "undangan.html: live cover memakai data.border (frame .bdfr)")
    # Kunci tier border DILEPAS atas keputusan pemilik: ambang eksklusif (>=119rb)
    # dan VIP (>=149rb) tidak terjangkau harga katalog (termahal 99rb), jadi 9
    # border mustahil dipakai siapa pun. Aturan ini kini menuntut kebalikannya.
    ok = ("border:'double'" in studio and "function setBorder(id){" in studio
          and "lockOfB" in studio and "LOCK_RANK" in studio
          and not re.search(r"tk:'(?:vip|eks|premium)'", studio)
          and all(i in studio and i in undangan for i in ("id:'gold-leaf'", "id:'filigree'", "id:'vip-diamond'")))
    lapor("ok" if ok else "masalah",
          "studio.html: picker border tersedia dan tidak ada border terkunci tier")
    # 3) hide template di katalog + urut per kategori
    ok = "function tglKatHide(id)" in studio and "katalogHide" in studio
    lapor("ok" if ok else "masalah", "studio.html: tombol hide/tampilkan template (katalogHide + tglKatHide)")
    ok = "state.katalogHide.includes(t.id)" in studio
    lapor("ok" if ok else "masalah", "studio.html: pilihan tema (tplsFor) menghormati template tersembunyi")
    ok = "${['pernikahan','khitanan','ultah','aqiqah'].map(ev=>" in studio
    lapor("ok" if ok else "masalah", "studio.html: daftar katalog diurutkan per kategori")
    # 4) teks WA personal: nama tamu terpilih + link bersih (pesanWa memakai link dari guests())
    ok = ("nama_tamu:g?g.nama:WA_SAPA_UMUM" in studio and "link_undangan:g?g.link:baseUrl()" in studio
          and "link:state.linkMode==='single'?baseUrl():baseUrl()+'?to='+encodeURIComponent(nama)" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: teks WA berisi nama tamu terpilih & link tanpa placeholder ?to=NamaTamu")
    # 5) Regresi: border preview hanya di zona cover (persis live) & migrasi dblBorder lama
    ok = "border:state.border" in studio and ".bdfr" in undangan
    lapor("ok" if ok else "masalah",
          "studio.html: gaya border dikirim ke renderer live yang memasangnya di zona cover")
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
    lapor("ok" if "--cover-art:url(" in stu and "undangan.html?preview=1" in stu else "masalah",
          "studio.html: pratinjau memakai renderer live (latar 3D ikut); export menyemat artwork")
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
    lapor("ok" if "object-position:${cvP.x}%" in und and "function fitCoverPhoto(" in und else "masalah",
          "undangan.html: posisi foto dari data.coverPos + crop setelah zoom dipakai")
    lapor("ok" if "height:100vh;height:100dvh" in und and "@media(max-width:480px)" in und and "safe-area-inset-bottom" in und else "masalah",
          "undangan.html: tinggi viewport dinamis + safe area + tata letak cover mobile")
    lapor("ok" if "untukLatarGelap" in und and "untukLatarGelap" in baca("assets/theme-contrast.js") else "masalah",
          "aksen di atas foto gelap dicerahkan (untukLatarGelap)")
    lapor("ok" if "#cover{overflow-y:auto" in und else "masalah",
          "undangan.html: cover bisa digulir (tombol Buka Undangan tidak terpotong)")
    lapor("ok" if "const CV_URUT=" in stu and stu.count("'kapsul'") >= 1 else "masalah",
          "studio.html: daftar 9 gaya tersedia")
    for fn in ("function cvMulai", "function cvJalan", "function cvLepas", "function cvZoom", "function cvReset"):
        lapor("ok" if fn in stu else "masalah", f"studio.html: {fn.split()[1]} tersedia (geser/zoom)")
    cover_live = "coverStyle:CV_URUT.includes(state.coverStyle)?state.coverStyle:'kotak'" in stu and "payload=barisUndangan()" in stu
    cover_arsip = stu.count("coverStyle:CV_URUT.includes(state.coverStyle)?state.coverStyle:'kotak'") >= 2 and "coverStyleExplicit:!!state.coverStyleExplicit" in stu
    lapor("ok" if cover_live and cover_arsip else "masalah",
          "studio.html: gaya foto tersimpan di publish/export + arsip (manual/default)")
    lapor("ok" if "if(d.coverStyle)state.coverStyle=d.coverStyle" in stu else "masalah",
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


def cek_katalog_admin():
    """Halaman Katalog Template & Arsip di Studio: tombol kembali, hapus baris, pulihkan bawaan,
    dan baris yang tidak remuk di layar HP (regresi laporan 2026-10-12)."""
    print("\n[23] Katalog Template & Arsip di Studio (kembali / hapus / pulihkan / baris HP)")
    studio = baca("studio.html")
    ok = "function pageActions(" in studio and "function goPage(" in studio \
        and studio.count("${pageActions(") >= 2 and "Kembali ke Editor" in studio
    lapor("ok" if ok else "masalah",
          "studio.html: Katalog & Arsip punya toolbar ← Kembali ke Editor + ☰ Template & Menu (goPage/pageActions)")
    ok = "goPage('${id}')" in studio and "set('page','${id}')" not in studio
    lapor("ok" if ok else "masalah", "studio.html: menu sidebar memakai goPage() (menu HP tertutup saat pindah halaman)")
    ok = "function delKat(id)" in studio and "delKat('${k.id}')" in studio and "sm-btn del" in studio
    lapor("ok" if ok else "masalah", "studio.html: tiap baris katalog punya tombol 🗑 Hapus (delKat + konfirmasi)")
    ok = ("katalogDel:[]" in studio and "function pulihkanKat()" in studio
          and "!state.katalogDel.includes(t.id)&&!state.katalog.some(k=>(k.tpl||k.id)===t.id)" in studio
          and "katalogDel:state.katalogDel" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: tema bawaan yang dihapus tidak kembali saat dibuka ulang (tombstone katalogDel) + Pulihkan Bawaan")
    ok = ('class="kat-row' in studio and ".kat-list{container-type:inline-size" in studio
          and "@container kat (min-width:" in studio and ".kat-row{padding:12px 16px;display:flex;flex-wrap:wrap" in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: baris katalog bertumpuk di layar sempit (container query .kat-list), tidak remuk per huruf")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji jsdom katalog dilewati")
        return
    probe = subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT)
    if probe.returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji jsdom katalog dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-katalog-admin.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji katalog admin: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200]))


def cek_template_custom():
    """RONDE 5: tema kustom tersimpan terpisah dari TPL publik, ikut payload, dan bisa dikelola."""
    print("\n[24] Template kustom Studio (simpan / kelola / publish / migrasi)")
    studio = baca("studio.html")
    live = baca("undangan.html")
    ids_st, ids_live = _tpl_ids("studio.html"), _tpl_ids("undangan.html")
    ok = ("tplCustom:[]" in studio and "function normalizeTplCustom(items)" in studio
          and "state.tplCustom=normalizeTplCustom(state.tplCustom)" in studio
          and "function tplById(id)" in studio and "[...TPL,...(Array.isArray(state.tplCustom)?state.tplCustom:[])]" in studio)
    lapor("ok" if ok else "masalah", "Studio: tplCustom punya migrasi aman dan tplOf/tplsFor memakai daftar terpisah")
    ok = ids_st == ids_live and "Math.max(0,TPL.findIndex(t=>t.id===state.tpl))" in studio
    lapor("ok" if ok else "masalah", "TPL publik tetap identik/berurutan; tema custom memakai indeks fallback tanpa menggeser TPL")
    ok = all(x in studio for x in ("function saveCustomTemplate()", "function renameCustomTpl(id)",
                                    "function duplicateCustomTpl(id)", "function deleteCustomTpl(id)",
                                    'class="tpl-custom-entry"', "Tambahkan ke Katalog Publik",
                                    "addKat(saved.id,{silent:true,nama:saved.nama})"))
    lapor("ok" if ok else "masalah", "Studio: kartu simpan, badge CUSTOM, kelola tema, fallback hapus, dan opsi katalog publik tersedia")
    baris_at = studio.find("function barisUndangan()")
    pv_at = studio.find("function pvHtml()", baris_at)
    baris = studio[baris_at:pv_at] if baris_at >= 0 and pv_at > baris_at else ""
    ok = ("state.tplCustom||[]" in studio and studio.count("tplCustom:JSON.parse(JSON.stringify(state.tplCustom||[]))") >= 2
          and "tplCustom:normalizeTplCustom(state.tplCustom)" in studio and "state.tplCustom||[]" in studio[studio.find("function draftSig") : studio.find("function draftDirty")]
          and "coverStyleExplicit:!!state.coverStyleExplicit" in baris
          and studio.count("state.tplCustom.forEach((t,i)=>{if(!t.studioOnly&&!state.katalog.some") >= 2)
    lapor("ok" if ok else "masalah", "draftSig, preview/publish/export, arsip, cover eksplisit, dan katalog pulih bersama tplCustom")
    custom_at = live.find("const customTpl=d&&tplId?customThemeFromDraft(tplId,d.tplCustom):null;")
    index_at = live.find("const tplF=tpl||TPL[Math.max(0,Math.min(TPL.length-1")
    ok = custom_at >= 0 and index_at > custom_at and "TPL publik tidak pernah ditambah/diurut ulang" in live
    lapor("ok" if ok else "masalah", "undangan.html: d.tplCustom diselesaikan sebelum fallback indeks tema publik")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji interaksi template kustom dilewati")
        return
    probe = subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT)
    if probe.returncode != 0:
        lapor("info", "jsdom belum terpasang — uji interaksi template kustom dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-template-custom.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji template kustom: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:300]))


def cek_peta_undangan():
    """2026-10-16: tamu melaporkan embed Google Maps berhenti di bidang biru
    walau iframe-nya sudah dimuat lambat & query-nya sudah bersih — kotak galat
    datang dari Google sendiri, dan isi iframe lintas-asal tidak bisa diperiksa
    dari halaman kita. Peta undangan sekarang digambar dari ubin biasa
    (OpenStreetMap/CARTO/Esri) dan embed Google turun jadi lapisan opsional."""
    print("\n[26] Peta undangan: pratinjau ubin sendiri + embed Google opsional")
    live = baca("undangan.html")
    ubin = ("basemaps.cartocdn.com/rastertiles" in live
            and "tile.openstreetmap.org/" in live
            and "server.arcgisonline.com/ArcGIS" in live)
    lapor("ok" if ubin else "masalah",
          "undangan.html: tiga penyedia ubin tanpa kunci API (CARTO → OpenStreetMap → Esri)")
    opsional = (".mapwrap:not(.live) iframe{display:none}" in live
                and "onclick=\"petaToggle(this)\"" in live
                and "petaMuatSatu" in live)
    lapor("ok" if opsional else "masalah",
          "undangan.html: iframe Google hanya tampil setelah tamu menekan \"Peta interaktif\"")
    jalan = ("https://www.google.com/maps/dir/?api=1&destination=" in live
             and "class=\"mapfallback\"" in live
             and ".mapwrap.peta-gagal .mapfallback{display:block}" in live
             and "https://www.openstreetmap.org/copyright" in live)
    lapor("ok" if jalan else "masalah",
          "undangan.html: selalu ada jalan keluar — tombol rute, tautan cadangan, atribusi OSM")
    koord = ("function petaLatLngDariLink" in live and "nominatim.openstreetmap.org" in live
             and "photon.komoot.io" in live and "asp-peta:" in live)
    lapor("ok" if koord else "masalah",
          "undangan.html: koordinat dari tautan pemilik dipakai lebih dulu, geokode daring + cache localStorage jadi cadangan")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji peta dilewati")
        return
    probe = subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT)
    if probe.returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji peta dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-peta.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    gagal = [b.strip() for b in r.stdout.splitlines() if b.startswith("FAIL")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji peta (ubin, cadangan CDN, geokode, jalan keluar): "
          + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:300])
          + ("" if not gagal else " — " + " | ".join(gagal)[:300]))


def cek_qr_undangan():
    """2026-10-16: QR check-in tadinya hanya bisa diunduh dari Studio/Master
    sebagai PNG, jadi tamu tanpa cetakan tidak punya apa pun untuk dipindai
    panitia di pintu masuk. Sekarang undangan menampilkan QR yang SAMA untuk
    tamunya sendiri (checkin.html?guest=..&id=..&s=..) di bagian RSVP."""
    print("\n[27] Kartu QR check-in di dalam undangan")
    live = baca("undangan.html")
    dasar = ("function qrPanelHtml" in live and "function qrKodeUntuk" in live
             and "checkin.html?" in live and 'class="qrcard"' in live
             and ".qrcard{" in live and ".qrcard.qr-kosong" in live)
    lapor("ok" if dasar else "masalah",
          "undangan.html: kartu QR + gaya tampilannya ada (qrPanelHtml/qrKodeUntuk/qrcard)")
    ident = ("const GUEST=(Q.get('to')" in live and "window.__aspKode=Object.assign({},(d&&d.guestCodes)||{})" in live
             and "qrNamaNormal(k)===cari" in live and 'id="rvpN"' in live)
    lapor("ok" if ident else "masalah",
          "undangan.html: nama dari tautan personal (?to=) & kolom RSVP; kode hanya dari kecocokan persis")
    ringan = ('s.src=\'assets/qrcode.js\'' in live or 's.src="assets/qrcode.js"' in live)
    berat = '<script src="assets/qrcode.js"></script>' in live
    lapor("ok" if (ringan and not berat) else "masalah",
          "undangan.html: assets/qrcode.js dimuat malas (tamu tanpa RSVP tidak mengunduh 56 KB)")
    jalan = ("function qrUnduh" in live and "minta panitia mencatat kehadiran manual" in live
             and "QR-Checkin-" in live and "/^https?:$/.test(location.protocol)" in live)
    lapor("ok" if jalan else "masalah",
          "undangan.html: tombol Simpan QR, PNG→SVG, dan mode berkas mandiri (file://) aman")
    pindai = ("function qrPindaiBuka" in live and "function qrPindaiTutup" in live
              and ".qrscan{" in live and "wakeLock" in live and "requestFullscreen" in live
              and "if(!box.hidden)return;" in live)
    lapor("ok" if pindai else "masalah",
          "undangan.html: mode pindai layar putih + QR besar (wake lock & layar penuh opsional, tidak diminta ulang)")
    hadir = ("function qrCekHadir" in live and "qrHadirJalan" in live and "rest/v1/checkin?slug=eq." in live
             and "qrBadgeTulis" in live and ".qrbadge{" in live and "guest=eq." in live)
    lapor("ok" if hadir else "masalah",
          "undangan.html: centang “sudah check-in” dari tabel checkin (satu baris tamu, sekali jalan, tanpa spam)")
    if not os.path.exists(os.path.join(ROOT, "assets", "qrcode.js")):
        lapor("masalah", "assets/qrcode.js hilang — kartu QR tidak akan tergambar")
        return
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji QR dilewati")
        return
    probe = subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT)
    if probe.returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji QR dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-qr-undangan.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    gagal = [b.strip() for b in r.stdout.splitlines() if b.startswith("FAIL")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji kartu QR (isi sama dengan QR Studio, dibaca ulang jsQR): "
          + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:300])
          + ("" if not gagal else " — " + " | ".join(gagal)[:300]))


def cek_mode_link_master():
    """2026-10-16: pemilik melaporkan "Link personal sama yang semua tamu sama"
    dan "di undangan master mau isi yang personal juga ga ada opsinya".
    Penyebabnya: undangan yang sudah publish memakai mode 1 LINK dan Master
    tidak punya tombol untuk menggantinya. Sekarang dashboard Master punya
    kartu Mode Link Tamu (personal <-> 1 LINK, tersimpan lewat PATCH kolom
    `data` saja) + editor daftar tamu, jadi tidak perlu bolak-balik ke Studio.
    """
    print("\n[28] Mode link tamu & daftar tamu di Undangan Master")
    m = baca("master.html")
    pilih = ("function setLinkMode" in m and 'class="modebtn' in m and "Mode aktif:" in m
             and ".mode-list{" in m and ".modebtn{" in m)
    lapor("ok" if pilih else "masalah",
          "master.html: kartu Mode Link Tamu (personal / 1 LINK) bisa ditekan langsung dari dashboard")
    sah = ("function isSingle()" in m and "d.linkMode==='single'?'single':'personal'" in m
           and "return baseLink()+'/u/'+SLUG+'?to='+encodeURIComponent(g)" in m)
    lapor("ok" if sah else "masalah",
          "master.html: linkMode()/isSingle() jadi satu sumber; guestLinkPersonal() selalu ber-?to=")
    ikut = ("?to=NamaTamu" in m and "function copyPersonalSemua" in m and "function copyGuestPersonalIdx" in m
            and "if(isSingle()){" in m)
    lapor("ok" if ikut else "masalah",
          "master.html: tombol salin, tag baris tamu & pesan WA ikut mode; link personal tetap tersedia di mode 1 LINK")
    aman = ("await fetch(SUPABASE_URL+'/rest/v1/invitation_drafts?slug=eq.'+SLUG" in m
            and "body:JSON.stringify({data:d})" in m
            and "Database menolak (RLS)" in m and "const d=JSON.parse(JSON.stringify(DRAFT.data||{}));" in m)
    lapor("ok" if aman else "masalah",
          "master.html: PATCH hanya kolom data (diklon dulu) & kegagalan RLS/jaringan tidak pernah tampak tersimpan")
    editor = ('id="gRaw"' in m and "function simpanTamu" in m and "function namaTamuUnik" in m
              and "function resetTamu" in m and "kodeRapi[norm(n)]" in m
              and "Math.random().toString(36).substring(2,10).toUpperCase()" in m)
    lapor("ok" if editor else "masalah",
          "master.html: editor daftar tamu (tambah/ubah/hapus, duplikat dibuang, kode QR lama tidak berubah)")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji mode link Master dilewati")
        return
    if subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT).returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji mode link Master dilewati")
        return
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "test-master-link.cjs")],
                       capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    gagal = [b.strip() for b in r.stdout.splitlines() if b.startswith("FAIL")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji mode link & daftar tamu Master (ganti mode, PATCH, RLS, editor, XSS): "
          + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:300])
          + ("" if not gagal else " — " + " | ".join(gagal)[:300]))


def cek_pesan_wa():
    """2026-10-15: tulisan WA undangan berbeda di tiap tombol (ada yang lengkap, ada yang tidak).
    Sekarang semua tombol kirim/bagikan link undangan memakai SATU template yang sama."""
    print("\n[25] Pesan WhatsApp undangan seragam di semua tombol kirim/bagikan")
    studio, master, live = baca("studio.html"), baca("master.html"), baca("undangan.html")

    def blok(s):
        a = s.find("/* ==== PESAN WA UNDANGAN")
        b = s.find("/* ==== /PESAN WA UNDANGAN ==== */")
        return s[a:b] if a >= 0 and b > a else None
    bs, bm, bl = blok(studio), blok(master), blok(live)
    ok = bool(bs) and bs == bm == bl
    lapor("ok" if ok else "masalah",
          "blok PESAN WA (teks bawaan, sapaan umum, nama acara, pengisi variabel) identik di studio, master & undangan")
    m = re.search(r"const WA_TEMPLATE_DEFAULT='([^']*)';", bs or "")
    contoh = ("Assalamualaikum {nama_tamu} 🙏\\n\\nDengan memohon rahmat Allah SWT, kami mengundang untuk hadir"
              " di acara {acara} kami:\\n\\n{link_undangan}\\n\\nMerupakan kebahagiaan bagi kami atas kehadiran"
              " & doanya.\\n\\nTerima kasih 🤍\\n{nama_pengantin}")
    ok = bool(m) and m.group(1) == contoh and "const WA_SAPA_UMUM='Bapak/Ibu/Saudara/i';" in (bs or "")
    lapor("ok" if ok else "masalah",
          "teks bawaan WA = format contoh pemilik (salam, acara, link, doa, terima kasih, nama)")
    ok = ("function waLink(g){return waUrl(pesanWa(g))}" in studio
          and "function waShareText(){return pesanWa(selGuest())}" in studio
          and "if(action==='wa')window.open(waUrl(pesanWa(null))" in studio
          and "waTemplate:WA_TEMPLATE_DEFAULT" in studio
          and "Dengan hormat, kami mengundang Anda" not in studio)
    lapor("ok" if ok else "masalah",
          "studio.html: WA per tamu, Kirim Link via WhatsApp & Bagikan via WhatsApp (layar selesai) memakai pesanWa()")
    baris_at = studio.find("function barisUndangan()")
    pv_at = studio.find("function pvHtml()", baris_at)
    sig = studio[studio.find("function draftSig"):studio.find("function draftDirty")]
    ok = (baris_at >= 0 and "waTemplate:String(state.waTemplate||'')" in studio[baris_at:pv_at]
          and studio.count("waTemplate:String(state.waTemplate||'')") >= 3
          and "if(typeof d.waTemplate==='string'&&d.waTemplate.trim())state.waTemplate=d.waTemplate" in studio
          and "state.waTemplate===WA_TEMPLATE_DEFAULT?[]:" in sig)
    lapor("ok" if ok else "masalah",
          "studio.html: teks WA ikut snapshot publish/arsip/ekspor, dipulihkan saat dibuka lagi, dan memicu Publish Ulang bila diubah")
    ok = ("function shareAllWa(){window.open(waUrl(pesanWa(null))" in master
          and "function shareWa(g){window.open(waUrl(pesanWa(g))" in master
          and "isiPesanWa(d.waTemplate," in master
          and "Halo! Berikut undangan digital" not in master and "Kamu kami undang" not in master)
    lapor("ok" if ok else "masalah",
          "master.html: Share via WhatsApp (semua & per tamu) memakai template pemilik (data.waTemplate), format sama")
    ok = ("isiPesanWa(d&&d.waTemplate,{nama_tamu:WA_SAPA_UMUM,link_undangan:linkUndanganUmum(" in live
          and "function linkUndanganUmum(slug)" in live
          and "navigator.share({title:document.title,text:txt})" in live
          and "const txt='Undangan '+fullNm" not in live)
    lapor("ok" if ok else "masalah",
          "undangan.html: tombol Bagikan mengirim pesan lengkap yang sama + link untuk semua (/u/slug tanpa ?to=)")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji pesan WA dilewati")
        return
    probe = subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT)
    if probe.returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji pesan WA dilewati")
        return
    skrip = os.path.join(ROOT, "tools", "test-pesan-wa.cjs")
    r = subprocess.run(["node", skrip], capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    gagal = [b.strip() for b in r.stdout.splitlines() if b.startswith("FAIL")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji pesan WA semua tombol: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:300])
          + ("" if not gagal else " — " + " | ".join(gagal)[:300]))



# ------------------------------------ 29. kerapian halaman (ikon, bahasa, tanpa CDN)
def cek_kerapian_halaman():
    """Hal-hal kecil yang membuat situs terasa "setengah jadi" di mata tamu:
    ikon tab yang hilang, bahasa halaman salah, dan berkas yang diambil dari
    CDN pihak ketiga (mati satu CDN → halaman kosong)."""
    print("\n[29] Kerapian halaman: ikon tab, bahasa, dan berkas lokal")
    semua = []
    for rel in sorted(os.listdir(ROOT)):
        if rel.endswith(".html"):
            semua.append(rel)
    for folder in ("demo", "katalog-demo"):
        for rel in sorted(os.listdir(os.path.join(ROOT, folder))):
            if rel.endswith(".html"):
                semua.append(f"{folder}/{rel}")
    tanpa_ikon, salah_bahasa, cdn, rujukan_hilang = [], [], [], []
    for rel in semua:
        html = baca(rel)
        # Komentar HTML (petunjuk untuk pemilik) tidak pernah dirender browser,
        # jadi contoh di dalamnya bukan rujukan berkas yang harus ada.
        html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
        if "rel=\"icon\"" not in html and "rel='icon'" not in html:
            tanpa_ikon.append(rel)
        if not re.search(r'<html[^>]*\blang="id"', html, re.I):
            salah_bahasa.append(rel)
        for m in re.finditer(r'<script[^>]*\bsrc="(https?://[^"]+)"', html, re.I):
            # Supabase JS dari CDN memang disengaja: Publish tetap jalan lewat
            # fallback REST bila CDN itu diblokir (lihat README alur publish).
            if "supabase-js" in m.group(1):
                continue
            cdn.append(f"{rel} → {m.group(1)}")
        for m in re.finditer(r'(?:src|href)="((?!#|https?:|mailto:|tel:|data:|//)[^"]+)"', html, re.I):
            tujuan = m.group(1).split("#")[0].split("?")[0]
            if not tujuan or "${" in m.group(1):
                continue        # nilai dinamis dari template JS, bukan berkas tetap
            dasar = ROOT if tujuan.startswith("/") else os.path.dirname(os.path.join(ROOT, rel))
            if not os.path.exists(os.path.normpath(os.path.join(dasar, tujuan.lstrip("/")))):
                rujukan_hilang.append(f"{rel} → {tujuan}")
    lapor("ok" if not tanpa_ikon else "masalah",
          f"semua {len(semua)} halaman punya ikon tab (favicon)" if not tanpa_ikon
          else "halaman tanpa ikon tab: " + ", ".join(tanpa_ikon[:6]))
    lapor("ok" if not salah_bahasa else "masalah",
          "semua halaman ber-<html lang=\"id\"> (bahasa Indonesia)" if not salah_bahasa
          else "bahasa halaman salah: " + ", ".join(salah_bahasa[:6]))
    lapor("ok" if not cdn else "masalah",
          "tidak ada skrip pihak ketiga yang bisa mematikan halaman (kecuali Supabase JS yang punya fallback REST)"
          if not cdn else "skrip CDN yang bisa mematikan halaman: " + " | ".join(cdn[:4]))
    lapor("ok" if not rujukan_hilang else "masalah",
          "semua rujukan berkas lokal di seluruh halaman ada di disk"
          if not rujukan_hilang else "rujukan hilang: " + " | ".join(rujukan_hilang[:4]))
    for rel in ("assets/favicon.svg", "assets/apple-touch-icon.png",
                "assets/react.production.min.js", "assets/react-dom.production.min.js"):
        lapor("ok" if os.path.isfile(os.path.join(ROOT, rel)) else "masalah", f"{rel} tersedia")
    # Pratinjau tautan (WhatsApp/Facebook) & judul di hasil pencarian.
    und = baca("undangan.html")
    idx = baca("index.html")
    lapor("ok" if ('meta name="description"' in idx and 'property="og:title"' in idx
                  and 'property="og:image"' in idx) else "masalah",
          "index.html: judul, keterangan, dan pratinjau tautan (og:image) ada")
    lapor("ok" if ("ogD.content=EV_KICKER[ev]+' '+fullNm" in und and 'meta name="theme-color"' in und
                  and "const ogI=document.querySelector('meta[property=\"og:image\"]')" in und) else "masalah",
          "undangan.html: og:judul/keterangan/foto ikut data undangan (bukan teks bawaan)")
    seal = baca("katalog-demo/undangan-luxury-seal.html")
    lapor("ok" if ("../assets/react.production.min.js" in seal
                  and "../assets/react-dom.production.min.js" in seal
                  and "typeof React==='undefined'" in seal)
          else "masalah",
          "katalog-demo/undangan-luxury-seal.html: React lokal + pesan gagal yang jelas (dulu layar kosong)")


# ------------------------------------ 30. nama tamu aman di onclick & daftar hidup
def cek_nama_tamu_aman():
    """Nama tamu milik pemilik masuk ke atribut onclick="fn('NAMA')" dan ke daftar
    tamu. Dua bug nyata (2026-10-16):
      - esc() saja tidak cukup: parser HTML mengubah &#39; kembali jadi apostrof,
        sehingga nama seperti O'Brien merusak JavaScript tombol (tombol mati);
      - daftar tamu tidak ikut berubah saat pemilik mengetik (basi sampai pindah tab)."""
    print("\n[30] Nama tamu: aman di onclick & daftar ikut berubah saat mengetik")
    stu = baca("studio.html")
    lapor("ok" if "function jsEsc(" in stu else "masalah",
          "studio.html: ada jsEsc() (escape untuk atribut HTML + literal JS)")
    sisa = re.findall(r"""on(?:click|input|change)="[^"]*\$\{(?:esc|)(?:\(|)([a-z]+\.(?:nama|link|slug|noRek|code))""", stu)
    lapor("ok" if not sisa else "masalah",
          "tidak ada lagi nama/link pemilik yang disisipkan ke onclick tanpa jsEsc()"
          if not sisa else "masih pakai esc() di onclick: " + ", ".join(sorted(set(sisa))[:5]))
    lapor("ok" if "function refreshTamu()" in stu and "jadwalRefreshTamu()" in stu else "masalah",
          "studio.html: refreshTamu() + jadwalRefreshTamu() (daftar tamu diperbarui saat mengetik)")
    bh = baca("assets/button-help.js")
    lapor("ok" if "function place()" in bh and "addEventListener('scroll',()=>{cancel();place()}" in bh
          else "masalah",
          "assets/button-help.js: bantuan tidak lagi terhapus oleh gulir (place(), bukan hide())")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji nama tamu & daftar tamu dilewati")
        return
    if subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT).returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji nama tamu & daftar tamu dilewati")
        return
    for skrip, label in (("tools/test-pesan-wa.cjs", "nama tamu ber-apostrof & daftar tamu hidup"),
                         ("tools/test-bantuan-tombol.cjs", "bantuan tombol bertahan saat halaman bergulir")):
        r = subprocess.run(["node", os.path.join(ROOT, skrip)], capture_output=True, text=True, cwd=ROOT)
        baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
        gagal = [b.strip() for b in r.stdout.splitlines() if b.startswith("FAIL")]
        lapor("ok" if r.returncode == 0 else "masalah",
              f"{skrip}: " + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:200])
              + ("" if not gagal else " — " + " | ".join(gagal)[:240]))


# ------------------------------------------- 31. robots.txt & sitemap.xml
def cek_robots_sitemap():
    import xml.etree.ElementTree as ET
    print("\n[31] robots.txt & sitemap.xml (halaman publik)")
    if not os.path.exists("robots.txt"):
        lapor("masalah", "robots.txt tidak ada")
        return
    r = baca("robots.txt")
    lapor("ok" if "Sitemap: https://asproject.my.id/sitemap.xml" in r else "masalah",
          "robots.txt menunjuk sitemap")
    for privat in ("master.html", "scan.html", "checkin.html"):
        lapor("ok" if f"Disallow: /{privat}" in r else "masalah",
              f"robots.txt: {privat} tidak dirayapi")
    if not os.path.exists("sitemap.xml"):
        lapor("masalah", "sitemap.xml tidak ada")
        return
    try:
        akar = ET.parse("sitemap.xml").getroot()
    except ET.ParseError as e:
        lapor("masalah", f"sitemap.xml bukan XML valid: {e}")
        return
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    loc = [e.text.strip() for e in akar.findall("s:url/s:loc", ns)]
    lapor("ok" if loc else "masalah", f"sitemap.xml: {len(loc)} URL")
    peta = {}
    for u in loc:
        if not u.startswith("https://asproject.my.id/"):
            lapor("masalah", f"sitemap: domain tak dikenal -> {u}")
            continue
        rel = u[len("https://asproject.my.id/"):] or "index.html"
        peta[rel] = u
        lapor("ok" if os.path.exists(rel) else "masalah",
              f"sitemap: {rel} " + ("ada" if os.path.exists(rel) else "TIDAK ADA di repo"))
    peta.setdefault("index.html", "https://asproject.my.id/")
    for wajib in ("index.html", "undangan.html", "katalog-demo/index.html"):
        lapor("ok" if wajib in peta else "masalah", f"sitemap: memuat {wajib}")
    for privat in ("master.html", "scan.html", "checkin.html", "404.html", "laporan-audit.html"):
        lapor("ok" if privat not in peta else "masalah",
              f"sitemap: {privat} tidak didaftarkan (halaman privat/utility)")


# ------------------------------------------- 32. manifest PWA
def cek_manifest_pwa():
    import json
    print("\n[32] Manifest PWA (nama, ikon, tautan)")
    if not os.path.exists("manifest.webmanifest"):
        lapor("masalah", "manifest.webmanifest tidak ada")
        return
    try:
        m = json.loads(baca("manifest.webmanifest"))
    except json.JSONDecodeError as e:
        lapor("masalah", f"manifest.webmanifest bukan JSON valid: {e}")
        return
    for k in ("name", "short_name", "start_url", "display", "background_color", "theme_color"):
        lapor("ok" if m.get(k) else "masalah", f"manifest: field {k}")
    ukuran = {i.get("sizes") for i in m.get("icons", [])}
    lapor("ok" if {"192x192", "512x512"} <= ukuran else "masalah",
          f"manifest: ikon 192 & 512 ({len(m.get('icons', []))} ikon)")
    lapor("ok" if any("maskable" in (i.get("purpose") or "") for i in m.get("icons", [])) else "masalah",
          "manifest: ikon maskable")
    for i in m.get("icons", []):
        src = i.get("src", "")
        lapor("ok" if os.path.exists(src.lstrip("/")) else "masalah", f"manifest: ikon {src} ada di repo")
    kurang = []
    for d in ("", "demo", "katalog-demo"):
        for f in sorted(os.listdir(d or ".")):
            if not f.endswith(".html") or f == "laporan-audit.html":
                continue
            rel = f"{d}/{f}" if d else f
            if 'rel="manifest"' not in baca(rel):
                kurang.append(rel)
    lapor("ok" if not kurang else "masalah",
          "semua halaman menautkan manifest" + ("" if not kurang else f" — kurang: {', '.join(kurang[:5])}"))
    lapor("ok" if 'rel="manifest" href="/manifest.webmanifest"' in baca("index.html") else "masalah",
          "index.html: tautan manifest di akar situs")


# ------------------------------------------- 33. pembatas laju rsvp & checkin
def cek_pembatas_laju():
    print("\n[33] Pembatas laju tabel rsvp & checkin (tools/*.sql)")
    for berkas, fungsi in (("tools/rsvp.sql", "rsvp_batas_laju"), ("tools/checkin.sql", "checkin_batas_laju")):
        if not os.path.exists(berkas):
            lapor("masalah", f"{berkas} tidak ada")
            continue
        sql = baca(berkas)
        aktif = re.sub(r"--[^\n]*", "", sql)
        lapor("ok" if f"create or replace function public.{fungsi}" in aktif else "masalah",
              f"{berkas}: fungsi {fungsi}() ada (dibuat ulang, tidak dobel)")
        lapor("ok" if "drop trigger if exists" in aktif and "create trigger" in aktif else "masalah",
              f"{berkas}: pemicu idempoten (drop lalu create)")
        lapor("ok" if "batas_laju" in aktif and "x-forwarded-for" in aktif else "masalah",
              f"{berkas}: pembatas memakai IP dari header")
        lapor("ok" if "security definer" in aktif and "set search_path = public" in aktif else "masalah",
              f"{berkas}: fungsi security definer dengan search_path tetap")
        make_pol = len(re.findall(r"create policy", aktif))
        drop_pol = len(re.findall(r"drop policy if exists", aktif))
        lapor("ok" if drop_pol >= make_pol else "masalah",
              f"{berkas}: kebijakan idempoten ({drop_pol} drop / {make_pol} create)")
    if os.path.exists("tools/rate_limit_note.sql"):
        lapor("info", "tools/rate_limit_note.sql ada")
    if shutil.which("node") and os.path.isdir(os.path.join(ROOT, "node_modules/pgsql-ast-parser")):
        r = subprocess.run(["node", "tools/test-sql-rsvp.cjs"], capture_output=True, text=True, cwd=ROOT)
        ringkas = [b.strip() for b in r.stdout.splitlines() if b.startswith("Ringkasan")]
        lapor("ok" if r.returncode == 0 else "masalah",
              "uji SQL rsvp/checkin: " + (ringkas[0] if ringkas else r.stdout.strip()[-200:]))
    else:
        lapor("info", "pgsql-ast-parser belum terpasang — uji parser SQL dilewati")


def main():
    print("=" * 74)
    print("Pemeriksa kesehatan repo AsProject —", os.path.basename(ROOT))
    print("=" * 74)
    for fn in (cek_link, cek_url_berbahaya, cek_sintaks, cek_id,
               cek_selector_injeksi, cek_konten, cek_duplikat_injeksi, cek_peta_demo,
               cek_resolusi_demo, cek_anchor, cek_pipeline_undangan, cek_katalog_publik,
               cek_fitur_terbaru, cek_alur_master, cek_kontras_tema,
               cek_tema_3d, cek_foto_cover, cek_skrip_build, cek_scan_panitia,
               cek_template_pernikahan, cek_vip_4d, cek_simulasi, cek_katalog_admin,
               cek_template_custom, cek_pesan_wa, cek_peta_undangan, cek_qr_undangan,
               cek_mode_link_master, cek_kerapian_halaman, cek_nama_tamu_aman,
               cek_robots_sitemap, cek_manifest_pwa, cek_pembatas_laju,
               cek_amplop_digital):
        fn()
    print("\n" + "=" * 74)
    print(f"Ringkasan: {hitung['ok']} ok, {hitung['masalah']} masalah, {hitung['info']} catatan")
    print("Penilaian visual, animasi, autoplay musik, dan kesesuaian terhadap spek lengkap tetap perlu ditinjau.")
    print("=" * 74)
    return 1 if hitung["masalah"] else 0



# ------------------------------------------- 34. amplop digital di undangan
def cek_amplop_digital():
    """2026-10-17: pemilik melaporkan "bagian amplop nya ga muncul di undangan".
    Penyebabnya: Master menyimpan {on,name,acc,holder}, sedangkan undangan hanya
    membaca {showAmplop,bank,noRek,pemilik} milik Studio — menyimpan dari Master
    menghapus seluruh objek amplop dari snapshot. Sekarang ketiga halaman memakai
    satu normalisasi dan Master mempertahankan bidang lain saat menyimpan.
    """
    print("\n[34] Amplop digital tampil di undangan (bentuk Studio & Master lama)")
    studio, master, live = baca("studio.html"), baca("master.html"), baca("undangan.html")
    m = ("function amplopNormal" in master and "const amp=amplopNormal(d.amplop)" in master
         and "const lama=(d.amplop&&typeof d.amplop==='object')?d.amplop:{};" in master
         and "d.amplop=Object.assign({},lama,{" in master
         and "showAmplop:!!bankOn" in master and "noRek:bankAcc" in master
         and "pemilik:bankHolder" in master)
    lapor("ok" if m else "masalah",
          "master.html: membaca & menyimpan amplop dua bentuk (showAmplop/noRek/pemilik + on/acc/holder) tanpa membuang e-wallet")
    u = ("function amplopNormal" in live and "const a=amplopNormal(d&&d.amplop)" in live
         and "a.noRek||a.acc" in live and "a.pemilik||a.holder" in live
         and "a.tampil&&(a.noRek||a.noEwallet)" in live and "a.copy?" in live)
    lapor("ok" if u else "masalah",
          "undangan.html: membaca snapshot Studio maupun Master lama; sakelar Tampilkan & showCopy tetap dihormati")
    s = ("function amplopNormal" in studio
         and "state.amplop=Object.assign({},DEF.amplop,amplopNormal(state.amplop))" in studio
         and "belum ditampilkan" in studio and "Tampilkan sekarang" in studio
         and "Amplop digital belum ditampilkan" in studio)
    lapor("ok" if s else "masalah",
          "studio.html: snapshot lama dinormalkan + peringatan saat amplop diisi tetapi belum ditampilkan")
    if not shutil.which("node"):
        lapor("info", "node tidak tersedia — uji amplop digital dilewati")
        return
    if subprocess.run(["node", "-e", "require('jsdom')"], capture_output=True, text=True, cwd=ROOT).returncode != 0:
        lapor("info", "jsdom belum terpasang (npm i jsdom) — uji amplop digital dilewati")
        return
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "test-amplop.cjs")],
                       capture_output=True, text=True, cwd=ROOT)
    baris = [b.strip() for b in r.stdout.splitlines() if b.strip().startswith("Ringkasan")]
    gagal = [b.strip() for b in r.stdout.splitlines() if b.startswith("FAIL")]
    lapor("ok" if r.returncode == 0 else "masalah",
          "uji amplop digital (Master ↔ Studio ↔ undangan, sakelar tampil, XSS): "
          + ("; ".join(baris) if baris else (r.stderr.strip() or r.stdout.strip())[:300])
          + ("" if not gagal else " — " + " | ".join(gagal)[:300]))


if __name__ == "__main__":
    sys.exit(main())
