#!/usr/bin/env node
/*
 * Uji tema Liquid Glass: tepat SATU tema per kategori.
 *
 *   node tools/test-liquid-glass.cjs
 *
 * Yang dijaga:
 *   1. Ada 4 template Liquid Glass dan ev-nya persis {pernikahan,
 *      khitanan, ultah, aqiqah} (tidak ada tema liquid berev 'all');
 *      semuanya studioOnly dan berada di posisi AKHIR array supaya
 *      index Supabase kolom 'theme' tema lama tidak berubah.
 *   2. Keempatnya punya token sendiri dan terkompilasi ke layout
 *      kaca lama (kaca-manis / kaca-dewasa) — bukan layout null.
 *   3. Literal TPL studio.html & undangan.html memuat keempat id
 *      dalam urutan yang sama dan sama-sama di urutan terakhir.
 *   4. Aset efek ada & terpasang: liquid-glass.css terkunci ke
 *      body.tema-liquid (dengan jalur reduced-motion + fallback
 *      tanpa backdrop-filter), liquid-glass.js punya mount/unmount
 *      + preset bawaan per kategori, dan undangan.html memasang
 *      kelas + mount hanya untuk id liquid-glass*.
 *   5. Studio menyematkan aset liquid ke file HTML mandiri HANYA
 *      untuk tema Liquid Glass (fetch bersyarat state.tpl).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let lulus = 0, gagal = 0;
const cek = (hasil, pesan) => { hasil ? lulus++ : (gagal++, console.log('  [FAIL] ' + pesan)); };

const { TEMPLATES } = require(path.join(ROOT, 'kerangka/template.js'));
const { TOKEN } = require(path.join(ROOT, 'kerangka/token-tema.js'));
const motor = require(path.join(ROOT, 'kerangka/motor.js'));

/* ---- 1 & 2: data kerangka ---- */
const lg = TEMPLATES.filter((t) => String(t.id).indexOf('liquid-glass') === 0);
cek(lg.length === 4, 'jumlah tema liquid harus 4, dapat ' + lg.length);
cek(
  JSON.stringify(lg.map((t) => t.ev).sort()) ===
    JSON.stringify(['aqiqah', 'khitanan', 'pernikahan', 'ultah']),
  'ev liquid harus tepat 1 per kategori, dapat: ' + lg.map((t) => t.id + '=' + t.ev).join(', ')
);
cek(!lg.some((t) => t.ev === 'all'), "tema liquid tidak boleh ada yang ev:'all'");
cek(lg.every((t) => t.studioOnly === true), 'tema liquid harus studioOnly dulu');
cek(
  TEMPLATES.slice(-4).every((t) => String(t.id).indexOf('liquid-glass') === 0),
  'tema liquid harus di akhir array TEMPLATES'
);
for (const t of lg) {
  cek(!!TOKEN[t.token], 'token tidak dikenal untuk ' + t.id + ': ' + t.token);
  const k = motor.kompilasiLama(t);
  cek(
    k.layout === 'kaca-manis' || k.layout === 'kaca-dewasa',
    t.id + ' harus terkompilasi ke layout kaca, dapat ' + k.layout
  );
  cek(k.cover === 'glass', t.id + " cover harus 'glass'");
  cek(k.ev === t.ev, t.id + ' ev hasil kompilasi harus sama');
}
cek(
  new Set(lg.map((t) => t.token)).size === 4,
  'tiap kategori liquid harus punya token sendiri-sendiri'
);

/* ---- 3: literal TPL di HTML ---- */
function ambilIdTpl(rel) {
  const blok = (baca(rel).match(/const TPL=\[([\s\S]*?)\];/) || [, ''])[1];
  return [...blok.matchAll(/\{id:'([^']+)'/g)].map((m) => m[1]);
}
const idStudio = ambilIdTpl('studio.html');
const idUndangan = ambilIdTpl('undangan.html');
cek(JSON.stringify(idStudio) === JSON.stringify(idUndangan), 'urutan id TPL studio != undangan');
cek(idStudio.length === TEMPLATES.length, 'jumlah TPL HTML (' + idStudio.length + ') != TEMPLATES');
cek(
  JSON.stringify(idStudio.slice(-4)) === JSON.stringify(lg.map((t) => t.id)),
  'empat id terakhir TPL harus tema liquid: ' + idStudio.slice(-4).join(',')
);

/* ---- 4: aset & pemasangan di undangan ---- */
cek(fs.existsSync(path.join(ROOT, 'assets/liquid-glass.css')), 'assets/liquid-glass.css tidak ada');
cek(fs.existsSync(path.join(ROOT, 'assets/liquid-glass.js')), 'assets/liquid-glass.js tidak ada');
const css = baca('assets/liquid-glass.css');
const js = baca('assets/liquid-glass.js');
const undangan = baca('undangan.html');
const studio = baca('studio.html');

for (const s of [
  'body.tema-liquid', '.lg-Aurora', '.lg-dock', '.lg-swatch',
  'prefers-reduced-motion:reduce', '@supports not ((backdrop-filter',
  'body.tema-liquid-glass-khitanan', 'body.tema-liquid-glass-ultah',
  'body.tema-liquid-glass-aqiqah', '--lg-rx', '--lg-mx'
]) cek(css.includes(s), 'CSS liquid kekurangan: ' + s);

/* Material harus benar-benar tembus pandang: isi panel utama tipis, panel
   di dalam kartu tidak kembali putih padat, dan fallback tanpa
   backdrop-filter pun tetap bening (bukan kartu susu ±88%). */
for (const s of [
  '--lg-fill:rgba(255,255,255,.035)',
  '--lg-fill-hi:rgba(255,255,255,.18)',
  '--lg-fill-mid:rgba(255,255,255,.025)',
  'body.tema-liquid #cover .wedding-invite-card',
  'body.tema-liquid .acara',
  'body.tema-liquid .couple .c',
  'body.tema-liquid .amp-row',
  'body.tema-liquid .qrcard',
  'body.tema-liquid .bt-item',
  'body.tema-liquid .harapan-kartu',
  'body.tema-liquid .as-contact',
  'body.tema-liquid #rvpN',
  'background-color:rgba(255,255,255,.38)'
]) cek(css.includes(s), 'CSS liquid kekurangan material bening: ' + s);
for (const s of [
  '--lg-fill:rgba(255,255,255,.38)',
  'rgba(255,255,255,.66)',
  'linear-gradient(155deg,rgba(255,255,255,.72),rgba(255,255,255,.26))',
  'background-color:rgba(255,255,255,.88)'
]) cek(!css.includes(s), 'CSS liquid masih memakai lapisan putih tebal: ' + s);

for (const s of [
  'AsLiquidGlass', 'function mount(', 'function unmount(',
  'sessionStorage', "matchMedia('(prefers-reduced-motion: reduce)')",
  'removeEventListener', 'deviceorientation',
  "'liquid-glass': 'Aurora'", "'liquid-glass-khitanan': 'zamrud'",
  "'liquid-glass-ultah': 'neon'", "'liquid-glass-aqiqah': 'mentari'"
]) cek(js.includes(s), 'JS liquid kekurangan: ' + s);

/* Galeri lingkaran 3D: cincin foto di sekeliling poros Y, dibangun dari
   tombol galeri asli agar lightbox bawaan tetap berfungsi. */
for (const s of [
  '.lg-gal3d', '.lg-gal3d-scene', '.lg-gal3d-ring',
  'rotateY(calc(var(--lg-gal-i)', 'translateZ(var(--lg-gal-radius))',
  '.lg-gal3d-btn', '.lg-gal3d-dot'
]) cek(css.includes(s), 'CSS galeri 3D kekurangan: ' + s);
for (const s of [
  'function pasangGaleri3d()', 'galeri3d: galeri3d',
  'state.galeri3d.destroy()', 'IntersectionObserver',
  'Geser untuk memutar'
]) cek(js.includes(s), 'JS galeri 3D kekurangan: ' + s);

for (const s of [
  '<link rel="stylesheet" href="assets/liquid-glass.css">',
  '<script src="assets/liquid-glass.js"></script>',
  "classList.add('tema-liquid','tema-'+tplF.id)",
  'AsLiquidGlass.mount(tplF.id)',
  '.lg-Aurora-page,.lg-dock',
  'AsLiquidGlass.unmount()'
]) cek(undangan.includes(s), 'undangan.html kekurangan hook liquid: ' + s);

/* Syarat VIP tidak boleh ikut berubah (test-vip-4d mencarinya verbatim). */
cek(
  undangan.includes("const vip4dOn=(tplF.tier==='vip'&&window.AsVip4d)"),
  'baris vip4dOn tidak boleh berubah'
);

/* ---- 5: embed bersyarat di Studio ---- */
for (const s of [
  "String(state.tpl||'').indexOf('liquid-glass')===0",
  "fetch('assets/liquid-glass.css')",
  "fetch('assets/liquid-glass.js')",
  'data-asproject-liquid-glass'
]) cek(studio.includes(s), 'studio.html kekurangan embed liquid: ' + s);

console.log('test-liquid-glass: ' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
