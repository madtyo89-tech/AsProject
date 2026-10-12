#!/usr/bin/env python3
"""
Sinkronkan MESIN tema dari studio.html / undangan.html ke dua halaman turunan:

  1. template-studio.html — Studio Template (perancang tema katalog)
     · blok "MESIN (SALINAN PERSIS dari studio.html)"  (font, border, motif, efek,
       bagian, tema bawaan, mesin dekorasi)
     · blok <style data-cover-undangan> (CSS cover + animasi + dekorasi)
  2. kanvas.html — Kanvas Template (kanvas kosong gaya Canva)
     · blok "MESIN (SALINAN PERSIS dari studio.html)" (font, bagian undangan, motif,
       bentuk ornamen, hiasan sudut & pembatas)

Dipakai:

    python3 tools/sinkron-studio-template.py            # tulis ulang bila berbeda
    python3 tools/sinkron-studio-template.py --kering    # hanya periksa (kode keluar 1 bila beda)

Kalau daftar di studio.html berubah (font/border/motif/efek/bagian/dekorasi baru),
jalankan tanpa --kering. Kedua halaman selalu menyimpan temanya sendiri
(tema terpasang di studio.html TIDAK ikut tersalin ke sini).
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAL = os.path.join(ROOT, 'template-studio.html')
KANVAS = os.path.join(ROOT, 'kanvas.html')
KERING = '--kering' in sys.argv


def baca(nama):
    with open(os.path.join(ROOT, nama), encoding='utf-8') as f:
        return f.read()


def akhir_blok(teks, buka):
    """Indeks penutup literal yang dibuka di `buka` (sadar string & komentar)."""
    d = 0
    i = buka
    while i < len(teks):
        c = teks[i]
        if c in '\'"`':
            i += 1
            while i < len(teks):
                if teks[i] == '\\':
                    i += 2
                    continue
                if teks[i] == c:
                    break
                i += 1
        elif c == '/' and i + 1 < len(teks) and teks[i + 1] == '/':
            while i < len(teks) and teks[i] != '\n':
                i += 1
        elif c == '/' and i + 1 < len(teks) and teks[i + 1] == '*':
            i = teks.index('*/', i) + 1
        elif c == '[' or c == '{':
            d += 1
        elif c == ']' or c == '}':
            d -= 1
            if d == 0:
                return i
        i += 1
    raise ValueError('literal tidak ditutup')


def ambil(txt, nama, tipe='const'):
    """Ambil satu baris pernyataan `const NAMA=…;` / `function NAMA(){…}`."""
    pola = ('function ' + nama + '(') if tipe == 'function' else ('const ' + nama + '=')
    i = txt.index(pola)
    if tipe == 'function':
        return txt[i:akhir_blok(txt, txt.index('{', i)) + 1]
    akhir = txt.index(';', i)
    seg = txt[i:akhir]
    if tipe in ('array', 'objek'):
        b = seg.index('[' if tipe == 'array' else '{')
        akhir = akhir_blok(txt, i + b)
        return txt[i:akhir + 1]
    return seg


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


# ---------------------------------------------------------------- Studio Template

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


def sinkron_template_studio():
    hal = baca('template-studio.html')
    mark_a = '/* ====================== MESIN (SALINAN PERSIS dari studio.html'
    mark_b = '/* ============================================================================\n   STUDIO TEMPLATE AsProject'
    i = hal.index(mark_a)
    j = hal.index(mark_b)
    mesin_baru = bangun_mesin()
    hal_baru = hal[:i] + mesin_baru + '\n\n' + hal[j:]

    c1 = hal_baru.index('<style data-cover-undangan>') + len('<style data-cover-undangan>')
    c2 = hal_baru.index('</style>', c1)
    hal_baru = hal_baru[:c1] + bangun_css() + hal_baru[c2:]

    if hal_baru == hal:
        print('template-studio.html: mesin sudah sinkron — tidak ada yang berubah.')
        return False
    if KERING:
        print('template-studio.html: mesin BERBEDA dengan studio.html/undangan.html.')
        return True
    with open(HAL, 'w', encoding='utf-8') as f:
        f.write(hal_baru)
    print('template-studio.html disinkronkan: %d byte, %d baris' % (len(hal_baru.encode('utf-8')), hal_baru.count('\n') + 1))
    return True


# ----------------------------------------------------------------------- Kanvas

def bangun_mesin_kanvas():
    s = baca('studio.html')
    potong = ['/* ====================== MESIN (SALINAN PERSIS dari studio.html) ======================\n'
              '   Daftar font, bagian undangan, motif latar, bentuk ornamen, hiasan sudut, dan\n'
              '   pembatas disalin apa adanya supaya rancangan di kanvas ini bisa langsung\n'
              '   dijadikan tema katalog. Jangan ubah manual — sinkronkan dengan:\n'
              '   python3 tools/sinkron-studio-template.py\n'
              '   ============================================================================ */']
    for nama, tipe in (('FONTS', 'array'), ('SLIDES', 'array')):
        potong.append(ambil(s, nama, tipe))
    for nama in ('patCss', 'fontFam', 'artDekoSudut', 'artDekoDiv'):
        potong.append(ambil(s, nama, 'function'))
    potong.append(ambil(s, 'DEKO_BENTUK', 'nilai'))
    for nama in ('DKO_IDS', 'FLT_IDS', 'DVD_IDS'):
        potong.append(ambil(s, nama, 'array'))
    return '\n'.join(potong)


def sinkron_kanvas():
    hal = baca('kanvas.html')
    mark_a = '/* ====================== MESIN (SALINAN PERSIS dari studio.html'
    mark_b = '/* ============================================================================\n   KANVAS AsProject'
    i = hal.index(mark_a)
    j = hal.index(mark_b)
    hal_baru = hal[:i] + bangun_mesin_kanvas() + '\n\n' + hal[j:]
    if hal_baru == hal:
        print('kanvas.html: mesin sudah sinkron — tidak ada yang berubah.')
        return False
    if KERING:
        print('kanvas.html: mesin BERBEDA dengan studio.html.')
        return True
    with open(KANVAS, 'w', encoding='utf-8') as f:
        f.write(hal_baru)
    print('kanvas.html disinkronkan: %d byte, %d baris' % (len(hal_baru.encode('utf-8')), hal_baru.count('\n') + 1))
    return True


def cek_sintaks(berkas):
    blok = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', baca(berkas))
    tmp = os.path.join(ROOT, 'tools', '_sinkron_cek.js')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(blok[-1])
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    print('%s: sintaks JS %s' % (berkas, 'OK' if r.returncode == 0 else 'GAGAL\n' + r.stderr))
    return r.returncode == 0


def main():
    beda_template = sinkron_template_studio()
    beda_kanvas = sinkron_kanvas()
    if KERING:
        if beda_template or beda_kanvas:
            print('--kering: ada mesin yang berbeda — jalankan tanpa --kering untuk menyinkronkan.')
            return 1
        return 0
    ok = True
    if beda_template:
        ok = cek_sintaks('template-studio.html') and ok
    if beda_kanvas:
        ok = cek_sintaks('kanvas.html') and ok
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
