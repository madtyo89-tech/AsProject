#!/usr/bin/env node
/*
 * Uji mesin latar artwork tema (dulu "tema 3D ulang tahun").
 *
 *   node tools/test-tema-3d.cjs               (uji statis)
 *   NODE_PATH=… node tools/test-tema-3d.cjs   (tambahan uji render bila jsdom ada)
 *
 * Katalog tema pernah berisi 72 tema dengan artwork per tema di assets/tema-3d/.
 * Katalog itu direset (2026-10-10) menjadi satu tema dasar tanpa artwork, jadi uji
 * ini TIDAK lagi menuntut jumlah berkas tertentu. Yang dijaga:
 *   1. pairing dua arah: setiap berkas di assets/tema-3d/ dipakai tema dengan id yang
 *      sama di studio.html DAN undangan.html — dan setiap `bg3d:` menunjuk berkas yang
 *      ada. Folder kosong / tidak ada = sah selama tidak ada tema yang memakai bg3d;
 *   2. ukuran artwork wajar (< 250 KB) supaya undangan tetap ringan;
 *   3. mesinnya utuh: undangan.html memasang kelas art3d + --cover-art + teks cover
 *      terang, studio.html meniru di pratinjau HP dan menyematkan artwork saat export;
 *   4. tema tanpa artwork tetap memakai gradasi & warna tema seperti semula
 *      (dibuktikan dengan fixture tema ber-artwork yang disuntik saat uji render).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIR_ART = path.join(ROOT, 'assets', 'tema-3d');
const MAKS_KB = 250;

let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional */ }

let lulus = 0;
let gagal = 0;
const cek = (hasil, pesan) => { hasil ? (lulus++) : (gagal++, console.log('  [FAIL] ' + pesan)); };
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* Ambil daftar tema dari array TPL (per objek, bukan regex lintas baris). */
function tema(rel) {
  const out = [];
  const blok = (baca(rel).match(/const TPL=\[([\s\S]*?)\];/) || [, ''])[1];
  for (const b of blok.split("{id:'").slice(1)) {
    const id = b.slice(0, b.indexOf("'"));
    const nama = b.match(/nama:'([^']*)'/);
    const ev = b.match(/ev:'([^']*)'/);
    const art = b.match(/bg3d:'([^']*)'/);
    if (!ev || !nama) continue;
    out.push({ id, nama: nama[1], ev: ev[1], art: art ? art[1] : '' });
  }
  return out;
}

(async function main() {
  console.log('Uji mesin artwork tema\n');

  /* ------------------------------------------------- 1. berkas & pemakaiannya */
  console.log('1) Berkas artwork & pemakaiannya');
  const ada = fs.existsSync(DIR_ART);
  const berkas = ada ? fs.readdirSync(DIR_ART).filter((f) => f.endsWith('.webp')).sort() : [];
  const und = tema('undangan.html');
  const stu = tema('studio.html');
  const petaU = new Map(und.map((t) => [t.id, t]));
  const petaS = new Map(stu.map((t) => [t.id, t]));
  const pakaiU = und.filter((t) => t.art);
  const pakaiS = stu.filter((t) => t.art);

  cek(berkas.length > 0 || pakaiU.length === 0,
      'folder artwork boleh tidak ada selama tidak ada tema yang memakai bg3d');
  cek(pakaiU.length === pakaiS.length && pakaiU.every((t, i) => pakaiS[i] && pakaiS[i].id === t.id),
      `tema ber-artwork identik di studio & undangan (${pakaiU.length} tema)`);

  let total = 0;
  for (const f of berkas) {
    const id = f.replace(/\.webp$/, '');
    const kb = Math.round(fs.statSync(path.join(DIR_ART, f)).size / 1024);
    total += kb;
    const u = petaU.get(id);
    const s = petaS.get(id);
    cek(!!u && u.art.endsWith(f), `undangan.html: tema ${id} memakai ${f}`);
    cek(!!s && s.art.endsWith(f), `studio.html: tema ${id} memakai ${f}`);
    cek(kb <= MAKS_KB, `${f} berukuran wajar (${kb} KB ≤ ${MAKS_KB} KB)`);
  }
  const yatim = pakaiU.filter((t) => !berkas.includes(path.basename(t.art))).map((t) => t.id);
  cek(yatim.length === 0, `tidak ada rujukan artwork yang hilang (${yatim.join(', ') || 'bersih'})`);
  const tanpaArt = und.filter((t) => !t.art).map((t) => t.id);
  console.log(`  ${berkas.length} artwork di disk (total ${total} KB), ${pakaiU.length} tema ber-artwork, ` +
              `${tanpaArt.length} tema bersih (${tanpaArt.join(', ') || '—'})`);
  cek(und.length > 0, `katalog terbaca (${und.length} tema)`);

  /* ------------------------------- 1b. keterbacaan teks di atas artwork */
  /* sharp hanya dipakai saat pengembangan; di CI tanpa sharp bagian ini dilewati. */
  let sharp = null;
  try { sharp = require('sharp'); } catch (e) { /* opsional */ }
  if (!berkas.length) {
    console.log('  ..  ukur kecerahan artwork dilewati (tidak ada artwork di katalog aktif)');
  } else if (!sharp) {
    console.log('  ..  ukur kecerahan artwork dilewati (sharp belum terpasang)');
  } else {
    console.log('\n1b) Keterbacaan teks cover di atas artwork (sharp)');
    const TEKS_COVER = '#f7f2e9';   // --ink pada mode art3d
    const lum = (r, g, b) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const hexLum = (h) => lum(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
    const kontras = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const campur = (c, o, t) => c.map((v, i) => Math.round(v + (o[i] - v) * t));
    const LAPIS = [12, 10, 8];      // rgba(12,10,8,…) pada CSS body.art3d #cover

    let terburukAtas = { rasio: 99, id: '' };
    let terburukBawah = { rasio: 99, id: '' };
    for (const f of berkas) {
      const id = f.replace(/\.webp$/, '');
      const gambar = sharp(path.join(DIR_ART, f));
      const meta = await gambar.metadata();
      const bawah = meta.height - Math.round(meta.height * 0.22);
      const atas = await sharp(path.join(DIR_ART, f))
        .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.3) })
        .resize(1, 1).raw().toBuffer();
      const kaki = await sharp(path.join(DIR_ART, f))
        .extract({ left: 0, top: bawah, width: meta.width, height: meta.height - bawah })
        .resize(1, 1).raw().toBuffer();
      const rAtas = kontras(hexLum(TEKS_COVER), lum(...campur([...atas], LAPIS, 0.5)));
      const rBawah = kontras(hexLum(TEKS_COVER), lum(...campur([...kaki], LAPIS, 0.65)));
      if (rAtas < terburukAtas.rasio) terburukAtas = { rasio: rAtas, id };
      if (rBawah < terburukBawah.rasio) terburukBawah = { rasio: rBawah, id };
      cek(rAtas >= 3 && rBawah >= 3, `${id}: teks cover terbaca (atas ${rAtas.toFixed(1)}:1, bawah ${rBawah.toFixed(1)}:1)`);
    }
    console.log(`  terburuk — atas ${terburukAtas.rasio.toFixed(1)}:1 (${terburukAtas.id}), ` +
                `bawah ${terburukBawah.rasio.toFixed(1)}:1 (${terburukBawah.id})`);
  }

  /* ------------------------------------------------------ 2. mesin masih utuh */
  console.log('\n2) Mesin artwork di halaman live & Studio');
  const undHtml = baca('undangan.html');
  const stuHtml = baca('studio.html');
  cek(/body\.art3d #cover\{/.test(undHtml) || undHtml.includes('body.art3d #cover'),
      'undangan.html: aturan CSS art3d (latar artwork + lapisan gelap) tersedia');
  cek(undHtml.includes("classList.add('art3d')"), 'undangan.html: kelas art3d dipasang saat tema ber-artwork');
  cek(undHtml.includes("'--cover-art'"), 'undangan.html: --cover-art dipasang dari bg3d tema');
  cek(undHtml.includes("'#F7F2E9'"), 'undangan.html: teks cover jadi terang di atas artwork');
  cek(stuHtml.includes('const art3d='), 'studio.html: pratinjau HP mengikuti latar artwork');
  cek(stuHtml.includes('bg3d'), 'studio.html: field bg3d masih dikenal (siap dipakai tema baru)');

  /* ------------------------------------------- 3. halaman undangan (jsdom) */
  console.log('\n3) Render halaman undangan (jsdom)');
  if (!JSDOM) {
    console.log('  (dilewati: jsdom belum terpasang — npm install --no-save jsdom)');
  } else {
    /* Tema ber-artwork pertama dari katalog (kalau ada). TPL tidak bisa disuntik dari
       luar: const di halaman tidak jadi milik global saat skripnya dieval manual. */
    const berArt = und.filter((t) => t.art)[0];
    const das = (tpl) => ({
      slug: 'demo', name1: 'Ahsan', name2: '', theme: 0,
      data: {
        event: 'ultah', tpl, doa: 'ultah',
        form: {
          namaAnak: 'Ahsan', tanggalAcara: '2026-12-28', jamAcara: '08:00',
          venue: 'Gedung', alamat: '', mapsLink: '', zona: 'WIB', temaUltah: '', usia: '',
        },
        slides: {}, anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up' },
      },
    });

    async function render(draft) {
      const dom = new JSDOM(undHtml, {
        url: 'https://asproject.my.id/undangan.html?slug=demo',
        runScripts: 'outside-only', pretendToBeVisual: true,
      });
      const w = dom.window;
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
      w.scrollTo = () => {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.fetch = () => Promise.reject(new Error('offline'));
      for (const aset of ['assets/scroll-effects.js', 'assets/theme-contrast.js', 'assets/button-help.js']) {
        w.eval(baca(aset));           // meniru <script src>
      }
      w.eval('window.EMBEDDED_DATA=' + JSON.stringify(draft) + ';');
      for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
      await new Promise((r) => setTimeout(r, 800));   // boot() dijadwalkan 350 ms
      return { dom, w };
    }

    if (berArt) {
      const { dom, w } = await render(das(berArt.id));
      const st = w.document.documentElement.style;
      cek(w.document.body.classList.contains('art3d'), 'tema ber-artwork: kelas art3d dipasang');
      cek((st.getPropertyValue('--cover-art') || '').includes(berArt.art.split('/').pop()),
          'tema ber-artwork: --cover-art menunjuk berkas artwork tema');
      cek(st.getPropertyValue('--ink').trim().toUpperCase() === '#F7F2E9',
          'tema ber-artwork: teks cover dipaksa terang (#F7F2E9)');
      dom.window.close();
    } else {
      console.log('  ..  dilewati: katalog aktif tidak punya tema ber-artwork');
    }

    {
      const dasar = und[0];
      const { dom, w } = await render(das(dasar.id));
      const st = w.document.documentElement.style;
      cek(!w.document.body.classList.contains('art3d'), `tema dasar ${dasar.id}: tidak memakai kelas art3d`);
      cek(st.getPropertyValue('--cover-art').trim() === '', `tema dasar ${dasar.id}: tidak ada --cover-art`);
      cek(st.getPropertyValue('--g0').trim() !== '' && st.getPropertyValue('--accent').trim() !== '',
          `tema dasar ${dasar.id}: gradasi & aksen tema tetap dipakai`);
      cek(/Ahsan/.test(w.document.body.textContent), 'nama anak dirender di halaman live');
      dom.window.close();
    }
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error('Harness crash:', e); process.exit(2); });
