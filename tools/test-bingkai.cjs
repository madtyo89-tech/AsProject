#!/usr/bin/env node
/* Uji bingkai ornamen border.

   Yang dijaga:
   1. 96 SVG (12 gaya x 4 sudut + 4 tepi) terbentuk dan XML-nya sah
   2. lapisan ornamen benar-benar sampai ke atribut style .bdfr saat dirender
   3. REGRESI KUTIP: keluaran bkUri dulu memakai kutip ganda, padahal diselipkan
      ke atribut HTML berkutip ganda (style="${bdStyle}"). Kutip ganda pertama
      menutup atributnya lebih awal sehingga ornamen terpotong total -- fungsi
      tetap mengembalikan ribuan karakter, jadi gejalanya tak terlihat dari sisi
      JS. Diperiksa di sini agar tidak bisa terulang diam-diam.
   4. border polos tidak ikut diberi lapisan
   5. tidak ada border yang terkunci tier (ambang eksklusif/VIP tak terjangkau
      harga katalog, jadi 9 border dulu mustahil dipakai siapa pun)
   6. BORDERS sinkron antara studio.html dan undangan.html

   Jalankan: node tools/test-bingkai.cjs   (butuh: npm i --no-save jsdom) */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

function potong(src, penanda, buka, tutup) {
  const i = src.indexOf(penanda);
  if (i < 0) throw new Error('penanda tak ditemukan: ' + penanda);
  const mulai = src.indexOf(buka, i);
  let d = 0, q = null;
  for (let j = mulai; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === buka) d++;
    else if (c === tutup) { d--; if (d === 0) return src.slice(mulai, j + 1); }
  }
  throw new Error('kurung tak seimbang: ' + penanda);
}

const undSrc = read('undangan.html');
const studioSrc = read('studio.html');

function draft(theme, border) {
  return {
    slug: 'uji-bingkai', name1: 'Satrio', name2: 'Pandu', theme: theme,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan', border: border,
      form: { namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-11-02', jamAcara: '08:00', venue: 'Bendo Gede', zona: 'WIB' },
      gallery: ['a.jpg'], amplop: { showAmplop: true, bank: 'BCA', noRek: '1234567890', pemilik: 'Satrio', showCopy: true },
      slides: { closing: { on: true, text: 'Sampai jumpa' } },
    },
  };
}

async function render(theme, border) {
  const dom = new JSDOM(undSrc, {
    runScripts: 'dangerously', url: 'https://x.test/undangan.html?slug=uji-bingkai',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = async () => { throw new Error('offline-uji'); };
      for (const a of ['scroll-effects', 'theme-contrast', 'vip-4d']) {
        try { w.eval(read('assets/' + a + '.js')); } catch (e) {}
      }
    },
  });
  const w = dom.window;
  await sleep(300);
  let err = null;
  try { w.eval('boot(' + JSON.stringify(draft(theme, border)) + ')'); } catch (e) { err = e.message; }
  await sleep(130);
  const el = w.document.querySelector('#cover .bdfr');
  const st = el ? (el.getAttribute('style') || '') : '';
  const hasil = {
    err, style: st, panjang: st.length,
    lapis: (st.match(/data:image\/svg\+xml/g) || []).length,
    kutipGanda: st.includes('"'),
    /* bangun semua SVG di dalam window supaya diperiksa dengan kode produksi */
    semuaSvg: w.eval(`(function(){var out=[];Object.keys(BK_SUDUT).forEach(function(g){
      var css=ornBingkaiCss('#8C6D1F',g);
      var m=css.match(/url\\('data:image\\/svg\\+xml,([^']*)'\\)/g)||[];
      m.forEach(function(x){out.push([g,decodeURIComponent(x.slice(24,-2))])});
    });return out})()`),
  };
  w.close();
  return hasil;
}

(async () => {
  const r = await render(3, 'laurel');          // luxury-gold + Laurel Emas
  t('render tidak error', !r.err, r.err);

  /* ---------- 1. semua SVG sah ---------- */
  t('96 lapisan SVG terbangun (12 gaya x 8)', r.semuaSvg.length === 96, 'dapat ' + r.semuaSvg.length);
  let sah = 0, cacat = [];
  for (const [gaya, svg] of r.semuaSvg) {
    const dom2 = new JSDOM('<!doctype html><body>' + svg, { contentType: 'text/html' });
    const node = dom2.window.document.querySelector('svg');
    if (node && node.getAttribute('viewBox') && node.getAttribute('width') && node.getAttribute('height')) {
      const vb = node.getAttribute('viewBox').split(/\s+/);
      if (vb[2] === node.getAttribute('width') && vb[3] === node.getAttribute('height')) sah++;
      else cacat.push(gaya + ': viewBox ' + vb.join(' ') + ' != ' + node.getAttribute('width') + 'x' + node.getAttribute('height'));
    } else cacat.push(gaya + ': svg tak terurai');
    dom2.window.close();
  }
  t('setiap SVG terurai dan viewBox cocok width/height', cacat.length === 0, cacat.slice(0, 4).join(' | '));

  /* ---------- 2 & 3. lapisan sampai ke DOM, dan tidak terpotong kutip ---------- */
  t('bingkai berhias menghasilkan 8 lapisan di .bdfr', r.lapis === 8, 'dapat ' + r.lapis);
  t('REGRESI KUTIP: style .bdfr tidak mengandung kutip ganda',
    !r.kutipGanda, 'kutip ganda menutup atribut lebih awal dan memotong ornamen');
  t('style .bdfr cukup panjang (ornamen utuh, bukan terpotong)',
    r.panjang > 3000, 'panjang ' + r.panjang + ' — di bawah 3000 berarti terpotong');
  t('style memuat background-image dan background-position',
    r.style.includes('background-image:') && r.style.includes('background-position:'));
  t('border dasar dari BD.s() tetap ada (tidak tertimpa)', r.style.includes('border:'));

  /* ---------- 4. border polos tidak diberi lapisan ---------- */
  for (const b of ['none', 'thin', 'solid', 'dashed']) {
    const rp = await render(0, b);
    t(`border polos '${b}' tidak diberi lapisan SVG`, rp.lapis === 0, 'dapat ' + rp.lapis);
  }

  /* ---------- 5. tidak ada border terkunci tier ---------- */
  const B = eval(potong(studioSrc, 'const BORDERS=[', '[', ']'));
  const Bu = eval(potong(undSrc, 'const BORDERS=[', '[', ']'));
  const terkunci = B.filter((b) => b.tk || b.ex);
  t('tidak ada border yang dikunci tier (tk/ex)', terkunci.length === 0,
    terkunci.map((b) => b.id + ':' + (b.tk || 'ex')).join(', '));

  /* tiap border berhias harus benar-benar menghasilkan lapisan saat dirender */
  /* Deklarasinya ditulis 'const BINGKAI_GAYA = {' dengan spasi, jadi penanda
     dicari tanpa '=' lalu potong() melompat ke kurung kurawal berikutnya. */
  const GAYA = Object.keys(eval('(' + potong(undSrc, 'const BINGKAI_GAYA', '{', '}') + ')'));
  t('semua id di BINGKAI_GAYA ada di BORDERS',
    GAYA.every((id) => B.some((b) => b.id === id)),
    GAYA.filter((id) => !B.some((b) => b.id === id)).join(', '));
  for (const id of ['filigree', 'vip-diamond', 'lace-ivory', 'onyx-inlay', 'vip-aurora']) {
    const rh = await render(0, id);
    t(`border '${id}' menghasilkan 8 lapisan`, rh.lapis === 8, 'dapat ' + rh.lapis);
  }

  /* ---------- 6. sinkron studio <-> undangan ---------- */
  t('jumlah BORDERS sama di kedua berkas', B.length === Bu.length, B.length + ' vs ' + Bu.length);
  const beda = B.filter((b, i) => !Bu[i] || Bu[i].id !== b.id);
  t('urutan dan id BORDERS identik', beda.length === 0, beda.map((b) => b.id).join(', '));
  t('tidak ada tk/ex tersisa di BORDERS undangan.html',
    Bu.filter((b) => b.tk || b.ex).length === 0);

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
