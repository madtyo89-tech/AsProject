#!/usr/bin/env node
/* Uji ornamen SVG per tema.

   Memastikan: registry motif lengkap, tiap tema menunjuk motif yang ada,
   18 tema publik punya 18 motif berbeda, motif benar-benar lahir di DOM
   divider dan footer, fallback ke teks deco tetap jalan, sampul tidak
   ikut berubah (PR #21 sengaja menyembunyikan ornamen di sana), dan
   TPL studio.html sinkron dengan undangan.html.

   Jalankan: node tools/test-ornamen.cjs      (butuh: npm i --no-save jsdom) */
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

/* Potong literal JS dengan pelacak kedalaman yang sadar-string. */
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
const TPL = eval(potong(undSrc, 'const TPL=[', '[', ']'));
const TPL_STUDIO = eval(potong(studioSrc, 'const TPL=[', '[', ']'));

function draft(theme, ev) {
  const acara = ev || 'pernikahan';
  return {
    slug: 'uji-ornamen', name1: 'Satrio', name2: '', theme: theme,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: acara,
      form: {
        namaPria: 'Satrio', namaWanita: acara === 'pernikahan' ? 'Pandu' : '', tanggalAcara: '2026-11-02',
        jamAcara: '08:00', venue: 'Bendo Gede', zona: 'WIB',
      },
      gallery: ['a.jpg', 'b.jpg', 'c.jpg'],
      amplop: { showAmplop: true, bank: 'BCA', noRek: '1234567890', pemilik: 'Satrio', showCopy: true },
      slides: { closing: { on: true, text: 'Sampai jumpa' } },
    },
  };
}

async function render(theme, ev) {
  const dom = new JSDOM(undSrc, {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-ornamen',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = (q) => ({
        matches: false, media: q, onchange: null,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
      });
      w.fetch = async () => { throw new Error('offline-uji'); };
      for (const a of ['scroll-effects', 'theme-contrast', 'vip-4d']) {
        try { w.eval(read('assets/' + a + '.js')); } catch (e) {}
      }
    },
  });
  const w = dom.window, D = w.document;
  await sleep(300);
  let err = null;
  try { w.eval('boot(' + JSON.stringify(draft(theme, ev)) + ')'); } catch (e) { err = e.message; }
  await sleep(120);
  const divider = [...D.querySelectorAll('.divider')];
  const footer = D.querySelector('.footer .orn');
  const coverOrn = D.querySelector('#cover .inner > .orn');
  const hasil = {
    err,
    motifAda: w.eval('Object.keys(ORNAMEN)'),
    jumlahDivider: divider.length,
    dividerSvg: divider.map((d) => d.querySelector('svg') ? d.querySelector('svg').outerHTML : null),
    dividerTeks: divider.map((d) => d.textContent.trim()),
    footerSvg: footer && footer.querySelector('svg') ? footer.querySelector('svg').outerHTML : null,
    footerKelas: footer ? footer.className : null,
    coverOrnTeks: coverOrn ? coverOrn.textContent.trim() : null,
    coverOrnSvg: coverOrn ? !!coverOrn.querySelector('svg') : null,
  };
  /* PENTING: hitung SEBELUM w.close(). outerHTML hasil parse sudah dinormalkan
     jsdom (tag mandiri jadi <path></path>), jadi pembandingnya harus lewat
     serializer yang sama -- bukan string mentah dari ORNAMEN[x](). */
  hasil.motifSvg = {};
  for (const m of hasil.motifAda) {
    try {
      hasil.motifSvg[m] = w.eval(
        '(function(){var d=document.createElement("div");d.innerHTML=ORNAMEN[' +
        JSON.stringify(m) + ']();return d.querySelector("svg").outerHTML})()');
    } catch (e) { hasil.motifSvg[m] = null; }
  }
  w.close();
  return hasil;
}

(async () => {
  /* ---------- 1. registry ---------- */
  const semuaMotif = new Set();
  const pakai = {};
  TPL.forEach((x) => { if (x.orn) { semuaMotif.add(x.orn); pakai[x.orn] = (pakai[x.orn] || 0) + 1; } });
  t('TPL punya field orn untuk semua tema', TPL.every((x) => typeof x.orn === 'string' && x.orn),
    TPL.filter((x) => !x.orn).map((x) => x.id).join(', '));

  const r0 = await render(0);
  t('render tema 0 tidak error', !r0.err, r0.err);
  const REG = r0.motifAda;
  t('registry ORNAMEN punya >= 18 motif', REG.length >= 18, 'dapat ' + REG.length);
  t('semua id orn yang dipakai TPL terdaftar di registry',
    [...semuaMotif].every((m) => REG.includes(m)),
    [...semuaMotif].filter((m) => !REG.includes(m)).join(', '));
  t('tidak ada motif di registry yang menganggur',
    REG.every((m) => semuaMotif.has(m)), REG.filter((m) => !semuaMotif.has(m)).join(', '));

  const publik = TPL.map((x, i) => ({ x, i })).filter((o) => !o.x.studioOnly);
  const unikPublik = new Set(publik.map((o) => o.x.orn));
  t('18 tema publik memakai 18 motif berbeda (tidak ada kembar)',
    unikPublik.size === publik.length,
    'dapat ' + unikPublik.size + ' unik dari ' + publik.length + ' tema');

  /* ---------- 2. sinkron studio <-> undangan ---------- */
  t('jumlah TPL studio == undangan', TPL_STUDIO.length === TPL.length);
  const bedaOrn = TPL.filter((x, i) => TPL_STUDIO[i] && TPL_STUDIO[i].orn !== x.orn);
  t('nilai orn identik di studio.html dan undangan.html', bedaOrn.length === 0,
    bedaOrn.map((x, i) => x.id).join(', '));
  const bedaUrut = TPL.filter((x, i) => TPL_STUDIO[i] && TPL_STUDIO[i].id !== x.id);
  t('urutan id TPL tetap sama (indeks = kolom theme di Supabase)', bedaUrut.length === 0,
    bedaUrut.map((x) => x.id).join(', '));

  /* ---------- 3. motif benar-benar lahir di DOM ---------- */
  /* kids-party (ultah) menguji cabang else bagian profil yang divider-nya
     hanya muncul untuk acara satu nama. */
  const contoh = [[0, null], [3, null], [6, null], [13, null], [17, null], [7, 'ultah']];
  for (const [idx, ev] of contoh) {
    const r = (idx === 0 && !ev) ? r0 : await render(idx, ev);
    const id = TPL[idx].id + (ev ? ' [' + ev + ']' : ''), motif = TPL[idx].orn;
    t(`${id}: tidak error saat render`, !r.err, r.err);
    t(`${id}: semua divider (${r.jumlahDivider}) memuat SVG`,
      r.jumlahDivider >= 2 && r.dividerSvg.every(Boolean),
      r.dividerSvg.filter(Boolean).length + ' dari ' + r.jumlahDivider);
    t(`${id}: SVG divider identik dengan ORNAMEN['${motif}']()`,
      !!r.dividerSvg[0] && r.dividerSvg[0] === r.motifSvg[motif],
      'panjang ' + (r.dividerSvg[0] || '').length + ' vs ' + (r.motifSvg[motif] || 'null').length);
    t(`${id}: footer memuat SVG motif`, !!r.footerSvg);
    t(`${id}: footer diberi kelas orn-motif`, (r.footerKelas || '').includes('orn-motif'), r.footerKelas);
    t(`${id}: divider tidak lagi berisi teks deco mentah`,
      !r.dividerTeks.some((x) => x.includes('✦') || x.includes('❖')),
      JSON.stringify(r.dividerTeks));
    /* PR #21 sengaja menyembunyikan ornamen sampul; jangan ikut diubah. */
    t(`${id}: ornamen sampul tetap teks deco (tidak disentuh)`,
      r.coverOrnSvg === false && !!r.coverOrnTeks, r.coverOrnTeks);
  }

  /* ---------- 4. fallback ke teks deco ---------- */
  {
    const dom = new JSDOM(undSrc, {
      runScripts: 'dangerously', url: 'https://x.test/undangan.html?slug=uji',
      pretendToBeVisual: true,
      beforeParse(w) {
        w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
        if (!w.matchMedia) w.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
        w.fetch = async () => { throw new Error('offline-uji'); };
      },
    });
    const w = dom.window;
    await sleep(300);
    /* Snapshot lama tidak punya orn, dan id tak dikenal harus ditolak. */
    w.eval('TPL[0].orn=""');
    w.eval('boot(' + JSON.stringify(draft(0)) + ')');
    await sleep(120);
    const d = w.document.querySelector('.divider');
    t('fallback: tema tanpa orn menampilkan teks deco, bukan SVG',
      d && !d.querySelector('svg') && d.textContent.trim() === TPL[0].deco,
      d ? JSON.stringify(d.textContent.trim()) : 'divider tidak ada');

    w.eval('TPL[0].orn="tidak-ada-di-registry"');
    w.eval('boot(' + JSON.stringify(draft(0)) + ')');
    await sleep(120);
    const d2 = w.document.querySelector('.divider');
    t('fallback: id orn tak dikenal ditolak, tetap teks deco',
      d2 && !d2.querySelector('svg') && d2.textContent.trim() === TPL[0].deco);
    w.close();
  }

  /* ---------- 5. ringkasan pemakaian ---------- */
  console.log('\nPemakaian motif:');
  Object.entries(pakai).sort((a, b) => b[1] - a[1])
    .forEach(([m, n]) => console.log('  ' + m.padEnd(13) + n + ' tema'));

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
