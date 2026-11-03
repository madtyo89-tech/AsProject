#!/usr/bin/env node
/* bangun-tema-kosakata.cjs — membangkitkan assets/tema-kosakata.js.
 *
 * AI tema (assets/tema-ai.js) hanya boleh memakai id yang benar-benar
 * terdaftar di renderer: FONTS, ORNAMEN, POLA, BORDERS (undangan.html),
 * CV_LAYOUTS & CARA_BUKA_STYLES (studio.html). Berkas ini mengekstrak daftar
 * itu dari sumbernya supaya tidak ada salinan manual yang melenceng saat
 * tema/pola/border baru ditambah.
 *
 * Dipanggil otomatis di akhir `node tools/bangun-tpl.cjs`, atau manual:
 *   node tools/bangun-tema-kosakata.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const baca = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tulis = (f, isi) => fs.writeFileSync(path.join(ROOT, f), isi);

function blok(src, nama) {
  /* sumber menulis `const POLA = {` dan `const FONTS=[` — spasi tidak konsisten */
  const m = new RegExp('const ' + nama + '\\s*=').exec(src);
  if (!m) throw new Error('tidak menemukan const ' + nama);
  const mulai = m.index + m[0].length;
  let d = 0;
  for (let k = mulai; k < src.length; k++) {
    const c = src[k];
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') {
      d--;
      if (d === 0) return src.slice(mulai, k + 1);
    }
  }
  throw new Error('blok ' + nama + ' tidak tertutup');
}

const judul = id => String(id).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function kosakata() {
  const u = baca('undangan.html');
  const s = baca('studio.html');

  /* FONTS: [{id:'cormorant',fam:'"Cormorant Garamond",serif'} …] */
  const fonts = [...blok(u, 'FONTS').matchAll(/\{id:'([^']+)',fam:'([^']*)'/g)].map(m => {
    const nama = (m[2].match(/"([^"]+)"/) || [, m[1]])[1];
    return { id: m[1], nama };
  });

  /* ORNAMEN: { klasik:()=>…, 'kembang-api':()=>… } */
  const ornBlok = blok(u, 'ORNAMEN');
  const ornamen = [...ornBlok.matchAll(/\n\s*'?([a-z][a-z0-9-]*)'?\s*:\s*\(\)/g)]
    .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i)
    .map(id => ({ id, nama: judul(id) }));

  /* POLA: { batik: { n: 'Batik Kawung', … } } */
  const polaBlok = blok(u, 'POLA');
  const pola = [...polaBlok.matchAll(/\n\s*'?([a-z][a-z0-9-]*)'?\s*:\s*\{\s*\n\s*n:\s*'([^']+)'/g)]
    .map(m => ({ id: m[1], nama: m[2] }));

  /* BORDERS: [{id:'thin',n:'Garis Halus',s:…}] */
  const borders = [...blok(u, 'BORDERS').matchAll(/\{id:'([^']+)',n:'([^']+)'/g)]
    .map(m => ({ id: m[1], nama: m[2] }));

  /* CV_LAYOUTS: [['amplop','Amplop Klasik','✉️','…'], …] */
  const covers = [...blok(s, 'CV_LAYOUTS').matchAll(/\['([a-z0-9-]+)','([^']+)'/g)]
    .map(m => ({ id: m[1], nama: m[2] }));

  /* CARA_BUKA_STYLES: [['pita','Pita Saten','🎀','…'], …] */
  const buka = [...blok(s, 'CARA_BUKA_STYLES').matchAll(/\['([a-z0-9-]+)','([^']+)'/g)]
    .map(m => ({ id: m[1], nama: m[2] }));

  const wajib = { fonts, ornamen, pola, borders, covers, buka };
  for (const [k, v] of Object.entries(wajib)) {
    if (!v.length) throw new Error('daftar ' + k + ' kosong — periksa pola ekstraksi');
  }
  return {
    versi: new Date().toISOString().slice(0, 10),
    sumber: { fonts: 'undangan.html FONTS', ornamen: 'undangan.html ORNAMEN', pola: 'undangan.html POLA', borders: 'undangan.html BORDERS', covers: 'studio.html CV_LAYOUTS', buka: 'studio.html CARA_BUKA_STYLES' },
    ev: ['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'],
    fonts, ornamen, pola, borders, covers, buka
  };
}

function bangun() {
  const data = kosakata();
  const isi = '/* DIBANGKITKAN tools/bangun-tema-kosakata.cjs — JANGAN EDIT MANUAL.\n' +
    '   Sumber: ' + Object.values(data.sumber).join(', ') + '.\n' +
    '   Dipakai assets/tema-ai.js untuk memastikan id font/ornamen/pola/border/\n' +
    '   cover/cara-buka selalu ada di renderer. Dibangkitkan ' + data.versi + '. */\n' +
    'window.TEMA_KOSAKATA = ' + JSON.stringify(data, null, 1) + ';\n';
  tulis('assets/tema-kosakata.js', isi);
  return data;
}

if (require.main === module) {
  const d = bangun();
  console.log('assets/tema-kosakata.js → ' + d.fonts.length + ' font, ' + d.ornamen.length + ' ornamen, ' +
    d.pola.length + ' pola, ' + d.borders.length + ' border, ' + d.covers.length + ' cover, ' + d.buka.length + ' cara buka');
}

module.exports = { kosakata, bangun };
