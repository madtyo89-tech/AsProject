#!/usr/bin/env node
/*
 * Uji Dekorasi Tema — motif bunga/batik, border baru, dan hiasan dinamis.
 *
 *   node tools/test-dekorasi-tema.cjs
 *
 * Yang diperiksa:
 *   1. motif baru ada di patCss() dan daftar motif identik di studio.html & undangan.html
 *   2. BORDERS berisi 40 id yang sama & berurutan di kedua berkas
 *   3. border ber-`art` hanya merujuk hiasan sudut yang ada di DKO_IDS
 *   4. daftar DKO/FLT/DVD + label identik di kedua berkas, dan CSS dekorasi lengkap
 *      (termasuk aturan prefers-reduced-motion)
 *   5. (jsdom) undangan.html sungguhan: draft dengan dko/flt/dvd merender 4 hiasan sudut,
 *      12 kelopak melayang, dan pembatas nama tepat sebelum tanggal
 *   6. (jsdom) tema lama tanpa dekorasi tidak berubah, `dko:'none'` mematikan hiasan
 *      bawaan border, dan hiasan sudut ikut muncul otomatis dari border ber-art
 *   7. (jsdom) dekorasi tidak menangkap klik (pointer-events: none)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let lulus = 0, gagal = 0;
const cek = (syarat, pesan, info) => {
  if (syarat) { lulus++; console.log('  ok  ' + pesan); }
  else { gagal++; console.log('  [FAIL] ' + pesan + (info ? ' → ' + info : '')); }
};

function akhirBlok(teks, buka) {
  let d = 0, i = buka;
  while (i < teks.length) {
    const c = teks[i];
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < teks.length) {
        if (teks[i] === '\\') { i += 2; continue; }
        if (teks[i] === c) break;
        i++;
      }
    } else if (c === '[' || c === '{') d++;
    else if (c === ']' || c === '}') { d--; if (d === 0) return i; }
    i++;
  }
  return -1;
}
const blok = (teks, pembuka) => {
  const i = teks.indexOf(pembuka);
  if (i < 0) return '';
  const b = teks.indexOf('[', i);
  return teks.slice(b + 1, akhirBlok(teks, b));
};
const blokPeta = (teks, pembuka) => {          // untuk literal objek { … }
  const i = teks.indexOf(pembuka);
  if (i < 0) return '';
  const b = teks.indexOf('{', i);
  return teks.slice(b + 1, akhirBlok(teks, b));
};
const isiObjek = (teks, nama) => (blokPeta(teks, 'const ' + nama + '=').match(/([a-z][a-z-]*)\s*:/g) || []).map((x) => x.replace(/[\s:]/g, ''));
const idObjek = (b) => (b.match(/\{\s*(?:id|n)\s*:\s*'([^']+)'/g) || []).map((x) => x.replace(/^.*:\s*'/, '').replace(/'$/, ''));
const idArr = (b) => (b.match(/'([a-z][a-z-]+)'/g) || []).map((x) => x.replace(/'/g, ''));
const daftar = (teks, nama) => idArr(blok(teks, 'const ' + nama + '=['));

const studio = baca('studio.html');
const undangan = baca('undangan.html');
const MOTIF_BARU = ['rose', 'sakura', 'daisy', 'vine', 'parang', 'mendung'];

console.log('\n1) Motif bunga & batik baru');
const motifDi = (s) => (s.match(/t\.pat==='([a-z]+)'/g) || []).map((x) => x.replace(/t\.pat==='|'/g, ''));
const mStudio = motifDi(studio), mUndangan = motifDi(undangan);
cek(MOTIF_BARU.every((m) => mStudio.includes(m)), 'motif baru ada di patCss studio.html', MOTIF_BARU.filter((m) => !mStudio.includes(m)).join(','));
cek(JSON.stringify(mStudio) === JSON.stringify(mUndangan), 'daftar & urutan motif sama di studio.html vs undangan.html', mUndangan.join(','));
cek(mStudio.length >= 11, 'minimal 11 motif tersedia', String(mStudio.length));
const bodyPat = (s) => s.slice(s.indexOf('function patCss(t){'), akhirBlok(s, s.indexOf('{', s.indexOf('function patCss(t){'))));
cek(bodyPat(studio) === bodyPat(undangan), 'isi patCss() identik di kedua berkas (pratinjau = halaman tamu)');

console.log('\n2) Border baru (bunga/batik/renda)');
const bStudio = idObjek(blok(studio, 'const BORDERS=['));
const bUndangan = idObjek(blok(undangan, 'const BORDERS=['));
cek(bStudio.length === 40, 'BORDERS berisi 40 id', String(bStudio.length));
cek(JSON.stringify(bStudio) === JSON.stringify(bUndangan), 'urutan id border sama di kedua berkas');
const BORDER_BARU = ['floral-corner', 'batik-frame', 'vine-frame', 'gold-corner', 'ribbon-corner', 'lace-edge', 'diamond-stud', 'triple-frame'];
cek(BORDER_BARU.every((b) => bStudio.includes(b)), '8 border baru terdaftar', BORDER_BARU.filter((b) => !bStudio.includes(b)).join(','));
cek(new Set(bStudio).size === bStudio.length, 'tidak ada id border ganda');

console.log('\n3) Daftar hiasan (DKO/FLT/DVD)');
const dko = daftar(studio, 'DKO_IDS'), flt = daftar(studio, 'FLT_IDS'), dvd = daftar(studio, 'DVD_IDS');
cek(dko.length === 6 && flt.length === 6 && dvd.length === 5, 'jumlah hiasan: 6 sudut / 6 kelopak / 5 pembatas',
  [dko.length, flt.length, dvd.length].join('/'));
for (const [nama, arr] of [['DKO_IDS', dko], ['FLT_IDS', flt], ['DVD_IDS', dvd]]) {
  cek(JSON.stringify(arr) === JSON.stringify(daftar(undangan, nama)), nama + ' sama di studio.html & undangan.html', arr.join(','));
}
const namaMap = (s, n) => isiObjek(s, n);
cek(JSON.stringify(namaMap(studio, 'DKO_NAMA')) === JSON.stringify(dko), 'label hiasan sudut lengkap untuk semua id', namaMap(studio, 'DKO_NAMA').join(','));
cek(JSON.stringify(namaMap(studio, 'FLT_NAMA')) === JSON.stringify(flt), 'label kelopak lengkap untuk semua id', namaMap(studio, 'FLT_NAMA').join(','));
cek(JSON.stringify(namaMap(studio, 'DVD_NAMA')) === JSON.stringify(dvd), 'label pembatas lengkap untuk semua id', namaMap(studio, 'DVD_NAMA').join(','));
cek(JSON.stringify(namaMap(studio, 'DKO_NAMA')) === JSON.stringify(namaMap(undangan, 'DKO_NAMA'))
  && JSON.stringify(namaMap(studio, 'FLT_NAMA')) === JSON.stringify(namaMap(undangan, 'FLT_NAMA'))
  && JSON.stringify(namaMap(studio, 'DVD_NAMA')) === JSON.stringify(namaMap(undangan, 'DVD_NAMA')), 'label hiasan sama di kedua berkas');
const artDipakai = (studio.match(/art:'([a-z]+)'/g) || []).map((x) => x.replace(/art:'|'/g, ''));
cek(artDipakai.length > 0 && artDipakai.every((a) => dko.includes(a)), 'border ber-art hanya memakai hiasan sudut yang ada', artDipakai.join(','));

console.log('\n4) Mesin & CSS dekorasi');
for (const f of ['function artDekoSudut(', 'function artDekoDiv(', 'function dekoSudutHtml(', 'function dekoFltHtml(', 'function dekoDivHtml(', 'function dekoPilih(']) {
  cek(studio.includes(f) && undangan.includes(f), f.replace('function ', '').replace('(', '() ada di kedua berkas'));
}
for (const kelas of ['.deko-sudut{', '.deko-flt{', '.deko-dvd{', '@keyframes dekoTurun', '@keyframes dekoBinar']) {
  cek(studio.includes(kelas) && undangan.includes(kelas), 'CSS ' + kelas + ' ada di kedua berkas');
}
cek(undangan.includes('.deko-flt{display:none}'), 'kelopak dimatikan saat tamu memilih kurangi gerakan');
cek(/pointer-events:none/.test(undangan.slice(undangan.indexOf('.deko-sudut{'), undangan.indexOf('.deko-sudut{') + 400)), 'hiasan sudut tidak menangkap klik');
const tpl = baca('template-studio.html');
cek(tpl.includes('.deko-flt{') && tpl.includes('function dekoFltHtml('), 'Studio Template memakai mesin dekorasi yang sama');
cek(JSON.stringify(daftar(tpl, 'DKO_IDS')) === JSON.stringify(dko) && JSON.stringify(daftar(tpl, 'FLT_IDS')) === JSON.stringify(flt)
  && JSON.stringify(daftar(tpl, 'DVD_IDS')) === JSON.stringify(dvd), 'daftar hiasan Studio Template sinkron');
cek(JSON.stringify(isiObjek(tpl, 'DKO_NAMA')) === JSON.stringify(dko) && JSON.stringify(isiObjek(tpl, 'FLT_NAMA')) === JSON.stringify(flt)
  && JSON.stringify(isiObjek(tpl, 'DVD_NAMA')) === JSON.stringify(dvd), 'label hiasan Studio Template sinkron');
cek(tpl.includes("['dekorasi',") && tpl.includes('data-deko=') && tpl.includes('dekoRekomendasi'), 'Studio Template punya tab Dekorasi + tombol rekomendasi');
const psg = baca('tools/pasang-template.cjs');
cek(/'DKO_IDS'|DKO_IDS/.test(psg) && /'FLT_IDS'|FLT_IDS/.test(psg) && /'DVD_IDS'|DVD_IDS/.test(psg) && /hiasan sudut/.test(psg),
  'skrip pemasang membawa & memvalidasi hiasan');
const patPilih = idArr(blok(tpl, 'const PAT_IDS=['));
cek(MOTIF_BARU.every((m) => patPilih.includes(m)), 'pemilih motif Studio Template memuat motif baru', patPilih.join(','));

/* ---------------------------------------------------------------- jsdom */
console.log('\n5) Undangan sungguhan (jsdom)');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* opsional */ }
if (!JSDOM) {
  console.log('  (dilewati: jsdom belum terpasang — npm install --no-save jsdom)');
} else {
  const aset = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  let html = baca('undangan.html');
  for (const tag of ['assets/scroll-effects.js', 'assets/theme-contrast.js']) {
    html = html.replace('<script src="' + tag + '"></script>', '<script>' + aset(tag) + '</script>');
  }
  const buka = () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://asproject.my.id/undangan.html?demo=1' });
    const w = dom.window;
    w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    return w;
  };
  const dasar = () => {
    const w = buka();
    const draft = JSON.parse(w.eval('JSON.stringify(DEMO_DRAFT)'));
    return { w, draft };
  };

  { /* tema dengan dekorasi lengkap */
    const { w, draft } = dasar();
    draft.data.dko = 'floral'; draft.data.flt = 'petal'; draft.data.dvd = 'flower';
    w.boot(draft);
    const d = w.document;
    cek(!!d.querySelector('#cover'), 'cover terender');
    cek(d.querySelectorAll('#cover .deko-sudut').length === 4, 'empat hiasan sudut muncul', String(d.querySelectorAll('#cover .deko-sudut').length));
    cek(d.querySelectorAll('#cover .deko-sudut.tl svg, #cover .deko-sudut br svg, #cover .deko-sudut svg').length >= 4, 'hiasan sudut berisi gambar SVG');
    cek(d.querySelectorAll('#cover .deko-flt i').length === 12, 'dua belas kelopak melayang', String(d.querySelectorAll('#cover .deko-flt i').length));
    cek(!!d.querySelector('#cover .deko-flt.g-petal'), 'lapisan kelopak memakai kelas jenis (g-petal)');
    const dvd = d.querySelector('#cover .deko-dvd');
    cek(!!dvd && !!dvd.querySelector('svg'), 'pembatas nama terrender dengan SVG');
    cek(dvd && dvd.nextElementSibling && /date/.test(dvd.nextElementSibling.className), 'pembatas tepat sebelum baris tanggal',
      dvd && dvd.nextElementSibling ? dvd.nextElementSibling.className : '—');
    const flt = d.querySelector('#cover .deko-flt');
    cek(flt && w.getComputedStyle(flt).pointerEvents === 'none', 'lapisan kelopak tidak menangkap klik',
      flt ? w.getComputedStyle(flt).pointerEvents : '—');
    const sudut = d.querySelector('#cover .deko-sudut');
    cek(sudut && w.getComputedStyle(sudut).position === 'absolute', 'hiasan sudut diposisikan absolut');
    w.close();
  }

  { /* tema lama tanpa dekorasi: tampilan tidak berubah */
    const { w, draft } = dasar();
    w.boot(draft);
    const d = w.document;
    cek(d.querySelectorAll('#cover .deko-sudut, #cover .deko-flt, #cover .deko-dvd').length === 0,
      'tema lama tanpa dekorasi tidak menambah elemen apa pun');
    cek(!!d.querySelector('#cover .bdfr'), 'cover tetap seperti semula (bingkai ada)');
    w.close();
  }

  { /* hiasan sudut ikut border, dan bisa dimatikan dengan 'none' */
    const { w, draft } = dasar();
    draft.data.border = 'floral-corner';
    w.boot(draft);
    const d = w.document;
    cek(d.querySelectorAll('#cover .deko-sudut').length === 4, 'border ber-art otomatis memunculkan hiasan sudut');
    w.close();

    const { w: w2, draft: d2 } = dasar();
    d2.data.border = 'floral-corner'; d2.data.dko = 'none';
    w2.boot(d2);
    cek(w2.document.querySelectorAll('#cover .deko-sudut').length === 0, 'pilihan "Tanpa" mematikan hiasan bawaan border');
    w2.close();
  }

  { /* kelopak & pembatas juga bisa dimatikan */
    const { w, draft } = dasar();
    draft.data.flt = 'none'; draft.data.dvd = 'none'; draft.data.dko = 'none';
    w.boot(draft);
    cek(w.document.querySelectorAll('#cover .deko-flt, #cover .deko-dvd, #cover .deko-sudut').length === 0,
      '"Tanpa" pada ketiga hiasan benar-benar bersih');
    w.close();
  }
}

console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
