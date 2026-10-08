#!/usr/bin/env node
/*
 * Uji latar tema 3D — artwork realistis untuk tema ulang tahun.
 *
 *   node tools/test-tema-3d.cjs               (uji statis)
 *   NODE_PATH=… node tools/test-tema-3d.cjs   (tambahan uji render bila jsdom ada)
 *
 * Yang diperiksa:
 *   1. setiap berkas di assets/tema-3d/*.webp dipakai oleh tema dengan id yang sama di
 *      studio.html DAN undangan.html (tidak ada artwork yatim maupun rujukan hilang);
 *   2. ukuran tiap artwork wajar (< 250 KB) supaya undangan tetap ringan;
 *   3. undangan.html: tema ber-artwork memasang latar gambar + teks cover terang,
 *      sementara teks konten tetap memakai nada gelap tema; bingkai foto muncul hanya
 *      bila undangan memang punya foto utama;
 *   4. tema tanpa artwork tetap memakai gradasi & warna tema seperti semula;
 *   5. studio.html: pratinjau HP memakai artwork + menandai "3D", publish() menyimpan
 *      foto utama, dan membuka arsip memulihkannya.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIR_ART = path.join(ROOT, 'assets', 'tema-3d');
const MAKS_KB = 250;

/* Tema ulang tahun yang artworknya belum dibuat (dilaporkan, tidak menggagalkan uji). */
const MENUNGGU_ARTWORK = ['adult-elegant'];

let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional */ }

let lulus = 0;
let gagal = 0;
const cek = (hasil, pesan) => { hasil ? (lulus++) : (gagal++, console.log('  [FAIL] ' + pesan)); };
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function tema(rel) {
  const out = [];
  for (const b of baca(rel).split("{id:'").slice(1)) {
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
  console.log('Uji latar tema 3D\n');

  /* ------------------------------------------------- 1. berkas & pemakaiannya */
  console.log('1) Berkas artwork & pemakaiannya');
  const berkas = fs.existsSync(DIR_ART)
    ? fs.readdirSync(DIR_ART).filter((f) => f.endsWith('.webp')).sort()
    : [];
  cek(berkas.length > 0, 'ada artwork di assets/tema-3d/');

  const und = tema('undangan.html');
  const stu = tema('studio.html');
  const petaU = new Map(und.map((t) => [t.id, t]));
  const petaS = new Map(stu.map((t) => [t.id, t]));

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
  console.log(`  ${berkas.length} artwork, total ${total} KB`);

  const tanpaArt = und.filter((t) => t.ev === 'ultah' && !t.art).map((t) => t.id);
  const yatim = und.filter((t) => t.art).map((t) => t.id).filter((id) => !berkas.includes(id + '.webp'));
  cek(yatim.length === 0, `tidak ada rujukan artwork yang hilang (${yatim.join(', ') || 'bersih'})`);
  const belum = tanpaArt.filter((id) => !MENUNGGU_ARTWORK.includes(id));
  cek(belum.length === 0, `semua tema ulang tahun punya artwork 3D (belum: ${belum.join(', ') || '—'})`);
  if (tanpaArt.length) {
    console.log(`  ..  menunggu artwork berikutnya: ${tanpaArt.join(', ')}`);
  }
  /* Pernikahan: tema "minimalist-*"/"slate-sage" sengaja dibiarkan bersih (arti namanya). */
  const SENGAJA_BERSIH = ['minimalist-sage', 'minimalist-frost', 'slate-sage'];
  const wedArt = und.filter((t) => t.ev === 'pernikahan' && t.art);
  const wedTanpa = und.filter((t) => t.ev === 'pernikahan' && !t.art).map((t) => t.id);
  const wedBelum = wedTanpa.filter((id) => !SENGAJA_BERSIH.includes(id));
  cek(wedBelum.length === 0, `semua tema pernikahan punya artwork (belum: ${wedBelum.join(', ') || '—'})`);
  console.log(`  pernikahan: ${wedArt.length} ber-artwork, ${wedTanpa.length} sengaja bersih (${wedTanpa.join(', ')})`);

  /* ------------------------------- 1b. keterbacaan teks di atas artwork */
  /* sharp hanya dipakai saat pengembangan; di CI tanpa sharp bagian ini dilewati. */
  let sharp = null;
  try { sharp = require('sharp'); } catch (e) { /* opsional */ }
  if (!sharp) {
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
      // lapisan gelap CSS: 0,55 di atas → 0,24 pada 30%, ~0,72 di kaki halaman
      const rAtas = kontras(hexLum(TEKS_COVER), lum(...campur([...atas], LAPIS, 0.5)));
      const rBawah = kontras(hexLum(TEKS_COVER), lum(...campur([...kaki], LAPIS, 0.65)));
      if (rAtas < terburukAtas.rasio) terburukAtas = { rasio: rAtas, id };
      if (rBawah < terburukBawah.rasio) terburukBawah = { rasio: rBawah, id };
      cek(rAtas >= 3 && rBawah >= 3, `${id}: teks cover terbaca (atas ${rAtas.toFixed(1)}:1, bawah ${rBawah.toFixed(1)}:1)`);
    }
    console.log(`  terburuk — atas ${terburukAtas.rasio.toFixed(1)}:1 (${terburukAtas.id}), ` +
                `bawah ${terburukBawah.rasio.toFixed(1)}:1 (${terburukBawah.id})`);
  }

  /* ------------------------------------------- 2. halaman undangan (jsdom) */
  console.log('\n2) Halaman undangan (jsdom)');
  if (!JSDOM) {
    console.log('  (dilewati: jsdom belum terpasang — npm install --no-save jsdom)');
  } else {
    const das = (tpl, tambahan = {}) => {
      const draft = {
        slug: 'demo', name1: 'Ahsan', name2: '', theme: 0,
        data: {
          event: 'ultah', tpl, doa: 'ultah',
          form: {
            namaAnak: 'Ahsan', tanggalAcara: '2026-12-28', jamAcara: '08:00',
            venue: 'Gedung', alamat: '', mapsLink: '', zona: 'WIB', temaUltah: '', usia: '',
          },
          slides: {}, anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up' },
        },
      };
      Object.assign(draft.data, tambahan);
      return draft;
    };

    async function render(draft) {
      const dom = new JSDOM(baca('undangan.html'), {
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

    {
      const { dom, w } = await render(das('race-car', { cover: 'assets/demo/foto.webp' }));
      const st = w.document.documentElement.style;
      cek(w.document.body.classList.contains('art3d'), 'tema 3D: <body> memakai kelas art3d');
      cek(/assets\/tema-3d\/race-car\.webp/.test(st.getPropertyValue('--cover-art')),
          'artwork dipasang sebagai --cover-art');
      cek(String(st.getPropertyValue('--ink')).trim().toLowerCase() === '#f7f2e9',
          'teks cover jadi terang (#F7F2E9) agar terbaca di atas artwork');
      cek(String(st.getPropertyValue('--ink-body')).trim().toLowerCase() === '#26292e',
          'teks konten tetap nada gelap tema (#26292e)');
      const bingkai = w.document.querySelector('#cover .cvf img');
      cek(!!bingkai, 'foto utama muncul dalam bingkai di cover (gaya kotak = bawaan)');
      cek(!!bingkai && /foto\.webp/.test(bingkai.getAttribute('src')),
          'bingkai memakai foto dari data undangan');
      dom.window.close();
    }
    {
      const { dom, w } = await render(das('race-car'));
      cek(!w.document.querySelector('#cover .cvf'), 'tanpa foto utama: tidak ada bingkai kosong');
      dom.window.close();
    }
    {
      /* minimalist-frost = tema yang memang sengaja tanpa artwork (bersih/minimalis) */
      const { dom, w } = await render(das('minimalist-frost'));
      const st = w.document.documentElement.style;
      cek(!w.document.body.classList.contains('art3d'), 'tema tanpa artwork: kelas art3d tidak dipasang');
      cek(String(st.getPropertyValue('--ink')).trim().toLowerCase() === '#075985',
          'tema biasa: teks cover tetap warna tema (#075985)');
      cek(!w.document.querySelector('#cover .cvf'), 'tema biasa tanpa foto: tidak ada bingkai');
      dom.window.close();
    }
    {
      /* undangan pernikahan ber-artwork: cover memakai gambar tema + foto di bingkai */
      const { dom, w } = await render(das('burgundy-regal', {
        event: 'pernikahan', cover: 'assets/demo/foto.webp', coverStyle: 'oval',
        form: {
          namaPria: 'Rina', namaWanita: 'Bagas', gelarPria: '', gelarWanita: '',
          tanggalAcara: '2026-12-28', jamAcara: '08:00', zona: 'WIB',
          venue: 'Gedung Bersama', alamat: '', mapsLink: '', showBismillah: false,
        },
      }));
      const st = w.document.documentElement.style;
      cek(w.document.body.classList.contains('art3d'), 'pernikahan: tema ber-artwork memakai latar gambar (art3d)');
      cek(/burgundy-regal\.webp/.test(st.getPropertyValue('--cover-art')), 'pernikahan: artwork tema burgundy dipasang');
      cek(String(st.getPropertyValue('--ink')).trim().toLowerCase() === '#f7f2e9', 'pernikahan: teks cover terang agar terbaca');
      cek(!!w.document.querySelector('#cover .cvf-oval img'), 'pernikahan: foto pengantin tampil di bingkai oval');
      dom.window.close();
    }
  }

  /* -------------------------------------------- 3. studio (pratinjau & publish) */
  console.log('\n3) Studio (pratinjau & publish)');
  const stu2 = baca('studio.html');
  cek(/const art3d=\(!dark&&tp\.bg3d&&state\.bgType==='gradient'/.test(stu2),
      'pratinjau HP memakai artwork tema 3D');
  cek(/art3d\?'#F7F2E9'/.test(stu2), 'nama pada pratinjau tetap terbaca di atas artwork');
  cek(stu2.includes("${art3d?' • 3D':''}"), 'label pratinjau menandai tema 3D');
  cek(/snap:\{[\s\S]*?cover:state\.cover\|\|''/.test(stu2),
      'publish() menyimpan foto utama (cover) ke snapshot');
  cek(stu2.includes("if(a.snap.cover!==undefined)state.cover=a.snap.cover;"),
      'membuka arsip memulihkan foto utama');

  if (JSDOM) {
    const dom = new JSDOM(stu2, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.eval(baca('assets/scroll-effects.js'));
    for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
    w.startInvitation();
    w.pickTpl('race-car');
    const html = w.phoneHtml();
    cek(html.includes('assets/tema-3d/race-car.webp'), 'html pratinjau memuat berkas artwork');
    cek(html.includes('• 3D'), 'html pratinjau menampilkan penanda 3D');
    w.pickTpl('minimalist-frost');
    cek(!w.phoneHtml().includes('assets/tema-3d/'), 'tema non-artwork tidak memuat artwork');
    w.pickTpl('burgundy-regal');
    cek(w.phoneHtml().includes('assets/tema-3d/burgundy-regal.webp'),
        'tema pernikahan ber-artwork memuat gambarnya di pratinjau');
    dom.window.close();
  } else {
    console.log('  (pratinjau studio dilewati: jsdom belum terpasang)');
  }

  /* ------------------------------- 4. file HTML mandiri memuat artwork 3D */
  console.log('\n4) Simpan File HTML dengan tema 3D (jsdom)');
  if (!JSDOM) {
    console.log('  (dilewati: jsdom belum terpasang)');
  } else {
    const dom = new JSDOM(stu2, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.eval(baca('assets/scroll-effects.js'));
    for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
    w.startInvitation();
    w.pickTpl('race-car');

    let blob = null;
    w.URL.createObjectURL = (b) => { blob = b; return 'blob:uji-3d'; };
    w.URL.revokeObjectURL = () => {};
    const gambar = fs.readFileSync(path.join(DIR_ART, 'race-car.webp'));
    w.fetch = (u) => {
      const url = String(u);
      if (url.indexOf('undangan.html') >= 0) return Promise.resolve({ ok: true, text: () => Promise.resolve('<html><head></head><body>tamu</body></html>') });
      if (url.indexOf('theme-contrast.js') >= 0) return Promise.resolve({ ok: true, text: () => Promise.resolve(baca('assets/theme-contrast.js')) });
      if (url.indexOf('tema-3d/race-car.webp') >= 0) {
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(new w.Blob([gambar], { type: 'image/webp' })) });
      }
      return Promise.reject(new Error('offline: ' + url));
    };
    const buatAsli = w.document.createElement.bind(w.document);
    w.document.createElement = (tag) => {
      const el = buatAsli(tag);
      if (String(tag).toLowerCase() === 'a') el.click = () => {};
      return el;
    };

    await w.dlUndangan();
    await new Promise((r) => setTimeout(r, 80));
    cek(!!blob, 'file HTML mandiri tetap dihasilkan untuk tema 3D');
    if (blob && typeof blob.text === 'function') {
      const isi = await blob.text();
      cek(isi.includes('data:image/webp'), 'artwork 3D disematkan ke file (base64) — tetap tampil offline');
      cek(/--cover-art:url\(/.test(isi), 'artwork menggantikan latar cover di file ekspor');
      cek(isi.includes('EMBEDDED_DATA'), 'data undangan tetap tertanam');
    }
    dom.window.close();
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
