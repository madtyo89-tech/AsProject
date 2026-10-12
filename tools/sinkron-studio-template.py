#!/usr/bin/env python3
"""sinkron-studio-template.py — salin ulang "mesin tema" ke template-studio.html.

Studio Template memakai daftar & fungsi yang sama dengan studio.html/undangan.html
(font, border, motif, efek, bagian, tema bawaan, mesin dekorasi) supaya tema yang
dirancang di sana tampil persis di undangan tamu. Kalau mesin berubah, jalankan:

    python3 tools/sinkron-studio-template.py          # tulis ulang blok mesin
    python3 tools/sinkron-studio-template.py --kering  # hanya periksa, tanpa menulis

Yang disalin:
  * dari studio.html : FONTS, BORDERS, FX_SCROLL, FX_COVER, FX_SCROLL_MIX, SLIDES,
    EV_LABEL, EV_ICON, TPL (→ TPL_BAWAAN), patCss, fxScrollAxis, fxScrollForSection,
    fontFam, mesin dekorasi (DKO/FLT/DVD), plus SUPABASE_URL/KEY
  * dari undangan.html: blok CSS cover + animasi + dekorasi (agar pratinjau HP sama
    dengan halaman tamu)

Setelah menjalankan ini, pastikan: node tools/test-dekorasi-tema.cjs dan
python3 tools/cek-kesehatan.py tetap hijau.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KERING = '--kering' in sys.argv
HAL = os.path.join(ROOT, 'template-studio.html')


def baca(nama):
    with open(os.path.join(ROOT, nama), encoding='utf-8') as f:
        return f.read()


def akhir_blok(teks, buka):
    """Indeks penutup untuk '[' / '{' (aman terhadap string & template literal)."""
    d, i = 0, buka
    while i < len(teks):
        c = teks[i]
        if c in "'\"`":
            i += 1
            while i < len(teks):
                if teks[i] == '\\':
                    i += 2
                    continue
                if teks[i] == c:
                    break
                i += 1
        elif c in '[{':
            d += 1
        elif c in ']}':
            d -= 1
            if d == 0:
                return i
        i += 1
    raise SystemExit('penutup blok tidak ketemu')


def ambil(txt, nama, tipe='const'):
    """Potongan sumber `const NAMA=[...]` / `function NAMA(...) {...}`."""
    m = re.search(r'\b(?:const|var|let)\s+' + re.escape(nama) + r'\s*=', txt)
    if tipe == 'function':
        m = re.search(r'^function\s+' + re.escape(nama) + r'\s*\(', txt, re.M)
        if not m:
            raise SystemExit('fungsi tidak ketemu: ' + nama)
        return txt[m.start():akhir_blok(txt, txt.index('{', m.end())) + 1]
    if not m:
        raise SystemExit('konstanta tidak ketemu: ' + nama)
    # tipe eksplisit: pastikan karakter pertama memang '[' atau '{' yang dimaksud
    sisa = txt[m.end():m.end() + 4]
    if tipe == 'array':
        assert '[' in sisa, nama + ' bukan array literal'
        return txt[m.start():akhir_blok(txt, txt.index('[', m.end() - 1)) + 1]
    if tipe == 'objek':
        assert sisa.lstrip().startswith('{'), nama + ' bukan objek literal'
        return txt[m.start():akhir_blok(txt, txt.index('{', m.end() - 1)) + 1]
    # objek / nilai biasa: ambil sampai akhir baris logis
    if txt[m.end() - 1:m.end()].strip() == '{':
        return txt[m.start():akhir_blok(txt, txt.index('{', m.end() - 1)) + 1]
    akhir = txt.index(';', m.end())
    return txt[m.start():akhir + 1]


def blok_array_teks(teks, pembuka):
    i = teks.find(pembuka)
    if i < 0:
        return ''
    b = teks.find('[', i)
    return teks[b + 1:akhir_blok(teks, b)]


def potong_entri(sumber, jumlah):
    """Ambil hanya `jumlah` entri pertama dari literal array (mis. const TPL=[…])."""
    if jumlah <= 0:
        return sumber
    potongan, i, ke = [], sumber.find('['), 0
    while ke < jumlah:
        mulai = sumber.find('{', i)
        if mulai < 0:
            break
        akhir = akhir_blok(sumber, mulai)
        potongan.append(sumber[mulai:akhir + 1])
        i = akhir + 1
        ke += 1
    if not potongan:
        return sumber
    return sumber[:sumber.find('[') + 1] + '\n ' + ',\n '.join(potongan) + ']'


def bangun_mesin():
    s = baca('studio.html')
    potong = []
    potong.append('/* ====================== MESIN (SALINAN PERSIS dari studio.html) ======================\n'
                  '   Daftar font, border, motif, efek, bagian, tema bawaan, dan mesin dekorasi\n'
                  '   disalin apa adanya supaya tema yang dirancang di sini tampil sama di undangan\n'
                  '   tamu. Jalankan ulang: python3 tools/sinkron-studio-template.py\n'
                  '   ============================================================================ */')
    for nama in ('SUPABASE_URL', 'SUPABASE_KEY'):
        potong.append(ambil(s, nama, 'nilai'))
    for nama, tipe in (('FONTS', 'array'), ('BORDERS', 'array'), ('FX_SCROLL', 'array'), ('FX_COVER', 'array'),
                       ('FX_SCROLL_MIX', 'array'), ('SLIDES', 'array'), ('EV_LABEL', 'objek'), ('EV_ICON', 'objek')):
        potong.append(ambil(s, nama, tipe))
    # TPL_BAWAAN = HANYA tema bawaan. Tema yang sudah dipasang pengguna ada di
    # akhir array studio.html; ia tidak boleh ikut tersalin ke sini.
    bawaan_kini = len(re.findall(r"\{\s*id\s*:\s*'", blok_array_teks(baca('template-studio.html'), 'const TPL_BAWAAN=[')))
    tpl = ambil(s, 'TPL', 'array')
    if bawaan_kini:
        tpl = potong_entri(tpl, bawaan_kini)
    potong.append(tpl.replace('const TPL=', 'const TPL_BAWAAN=', 1))
    for nama in ('patCss', 'fxScrollAxis', 'fxScrollForSection', 'fontFam'):
        potong.append(ambil(s, nama, 'function'))
    for nama in ('DKO_IDS', 'FLT_IDS', 'DVD_IDS', 'DKO_NAMA', 'FLT_NAMA', 'DVD_NAMA', 'DEKO_SEMUA'):
        potong.append(ambil(s, nama, 'array' if nama.endswith('_IDS') else 'objek'))
    for nama in ('dekoNilai', 'dekoPilih', 'artDekoSudut', 'artDekoDiv', 'dekoSudutHtml', 'DEKO_BENTUK', 'dekoFltHtml', 'dekoDivHtml'):
        potong.append(ambil(s, nama, 'function' if nama[0].islower() and nama not in ('DEKO_BENTUK',) else 'nilai'))
    return '\n'.join(potong)


def bangun_css():
    u = baca('undangan.html')
    a = u.index('/* ---------- COVER ---------- */')
    b = u.index('/* ---------- TEMA 3D')
    return ('/* ===== CSS mesin undangan (disalin dari undangan.html: cover + animasi + dekorasi) =====\n'
            '   Dipakai apa adanya supaya pratinjau HP di halaman ini identik dengan halaman tamu.\n'
            '   Jalankan ulang: python3 tools/sinkron-studio-template.py ===== */\n' + u[a:b])


def main():
    hal = baca('template-studio.html')
    mark_a = '/* ====================== MESIN (SALINAN PERSIS dari studio.html'
    mark_b = '/* ============================================================================\n   STUDIO TEMPLATE AsProject'
    i = hal.index(mark_a)
    j = hal.index(mark_b)
    mesin_baru = bangun_mesin()
    hal_baru = hal[:i] + mesin_baru + '\n\n' + hal[j:]

    # CSS pratinjau
    c1 = hal_baru.index('<style data-cover-undangan>') + len('<style data-cover-undangan>')
    c2 = hal_baru.index('</style>', c1)
    css_baru = bangun_css()
    hal_baru = hal_baru[:c1] + css_baru + hal_baru[c2:]

    if hal_baru == hal:
        print('Mesin sudah sinkron — tidak ada yang berubah.')
        return 0
    if KERING:
        print('--kering: mesin BERBEDA dengan studio.html/undangan.html (jalankan tanpa --kering untuk menyinkronkan).')
        return 1
    with open(HAL, 'w', encoding='utf-8') as f:
        f.write(hal_baru)

    # verifikasi cepat: sintaks blok skrip + jumlah daftar
    blok = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', hal_baru)
    tmp = os.path.join(ROOT, 'tools', '_sinkron_cek.js')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(blok[-1])
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    print('template-studio.html disinkronkan: %d byte, %d baris' % (len(hal_baru.encode('utf-8')), hal_baru.count('\n') + 1))
    print('sintaks JS:', 'OK' if r.returncode == 0 else 'GAGAL\n' + r.stderr)
    return 0 if r.returncode == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
