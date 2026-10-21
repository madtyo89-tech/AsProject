#!/usr/bin/env node
/* Uji pola latar (background pattern) per tema.

   Memastikan: registri POLA lengkap & identik di undangan.html dan
   studio.html, tiap tema menunjuk pola yang ada (tidak ada yang kosong),
   pola benar-benar lahir di sampul (#cover .pat) DAN di lapisan latar
   seluruh halaman (#patLatarLive), override pemilik (data.pat) menang,
   lapisan halaman lebih lunak daripada sampul, dan Studio punya setter +
   payload + whitelist untuk pola.

   Jalankan: node tools/test-pola.cjs      (butuh: npm i --no-save jsdom) */
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
const blokSrc = read('tools/pola-blok.js');
const TPL = eval(potong(undSrc, 'const TPL=[', '[', ']'));
const TPL_STUDIO = eval(potong(studioSrc, 'const TPL=[', '[', ']'));
const POLA_IDS = Object.keys(eval('(' + potong(blokSrc, 'const POLA = {', '{', '}') + ')'));

function draft(theme, patPemilik) {
  return {
    slug: 'uji-pola', name1: 'Satrio', name2: '', theme: theme,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan',
      pat: patPemilik,
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-11-02',
        jamAcara: '08:00', venue: 'Bendo Gede', zona: 'WIB',
      },
    },
  };
}

async function render(theme, patPemilik) {
  const dom = new JSDOM(undSrc, {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-pola',
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
  try { w.eval('boot(' + JSON.stringify(draft(theme, patPemilik)) + ')'); } catch (e) { err = e.message; }
  await sleep(120);
  const pat = D.querySelector('#cover .pat');
  const latar = D.getElementById('patLatarLive');
  const hasil = {
    err,
    coverPat: pat ? (pat.getAttribute('style') || '') : null,
    latarCss: latar ? latar.textContent : null,
    semuaCss: w.eval('POLA_IDS.map(id=>polaCss(id,{accent:"#8b7358"},1))'),
    semuaId: w.eval('POLA_IDS'),
    /* pola yang benar-benar dipilih renderer untuk draft ini */
    patAktifIni: w.eval('patAktif(' + JSON.stringify(draft(theme, patPemilik).data) + ',TPL[' + theme + '])'),
  };
  w.close();
  return hasil;
}

(async () => {
  /* ---------- 1. registri identik di kedua file ---------- */
  t('blok POLA tertempel utuh di undangan.html', undSrc.includes(blokSrc));
  t('blok POLA tertempel utuh di studio.html', studioSrc.includes(blokSrc));
  t('patCss jadi delegasi registri (undangan)', undSrc.includes('function patCss(t,skala){return polaCss(t&&t.pat,t,skala)}'));
  t('patCss jadi delegasi registri (studio)', studioSrc.includes('function patCss(t,skala){return polaCss(t&&t.pat,t,skala)}'));
  t('registri punya 22 pola', POLA_IDS.length === 22, 'dapat ' + POLA_IDS.length);

  /* ---------- 2. default per tema ---------- */
  t('jumlah tema sinkron', TPL.length === TPL_STUDIO.length);
  let kosong = 0, takValid = 0;
  const pakai = new Set();
  TPL.forEach((tp, i) => {
    if (!tp.pat) kosong++;
    if (!POLA_IDS.includes(tp.pat)) takValid++;
    pakai.add(tp.pat);
    const s2 = TPL_STUDIO[i];
    if (!s2 || s2.id !== tp.id || s2.pat !== tp.pat) takValid++;
  });
  t('tidak ada tema ber-pola kosong', kosong === 0, kosong + ' kosong');
  t('semua pat valid & sinkron studio/undangan', takValid === 0);
  t('minimal 12 pola berbeda terpakai sebagai bawaan', pakai.size >= 12, 'dapat ' + pakai.size);
  const cari = (id) => TPL.find((x) => x.id === id);
  t('jawa-elegan memakai parang', cari('jawa-elegan').pat === 'parang');
  t('gerbang-midnight-navy memakai mega mendung', cari('gerbang-midnight-navy').pat === 'mendung');
  t('islamic-elegant memakai girih', cari('islamic-elegant').pat === 'girih');
  t('ivory-klasik memakai damask', cari('ivory-klasik').pat === 'damask');

  /* ---------- 3. wiring undangan ---------- */
  t('sampul memakai pola aktif (override pemilik)', undSrc.includes('polaCss(patAktif(d,tplF),tplF,1)'));
  t('lapisan latar halaman disuntik saat boot', undSrc.includes("st.id='patLatarLive'") && undSrc.includes('polaCss(patAktif(d,tplF),tplF,0.6)'));

  /* ---------- 4. wiring studio ---------- */
  t('studio punya setPat', studioSrc.includes('function setPat(id){'));
  t('studio memvalidasi state.pat', studioSrc.includes("if(typeof state.pat!=='string'||(state.pat&&!POLA[state.pat]))state.pat='';"));
  t('payload membawa pat (4 tempat)', (studioSrc.match(/pat:state\.pat\|\|''/g) || []).length === 4);
  t('whitelist template kustom mengenal pat', studioSrc.includes('if(POLA[source.pat])design.pat=source.pat;'));
  t('draftSig memperhitungkan pat', studioSrc.includes("state.orn||'',state.pat||'',state.ornSudut"));
  t('picker pola ada di tab Desain', studioSrc.includes('POLA_IDS.map(pid=>`<button') && studioSrc.includes("setPat('')"));
  t('bawaan tema & design mengalir ke state.pat', studioSrc.includes('if(POLA[t.pat])state.pat=t.pat;') && studioSrc.includes('if(POLA[d.pat])state.pat=d.pat;'));

  /* ---------- 5. render nyata ---------- */
  const idxJawa = TPL.findIndex((x) => x.id === 'jawa-elegan');
  const idxIvory = TPL.findIndex((x) => x.id === 'ivory-klasik');
  const rJawa = await render(idxJawa);
  const rIvory = await render(idxIvory);
  const rOverride = await render(idxJawa, 'damask');
  t('render jawa-elegan tanpa error', !rJawa.err, rJawa.err);
  t('render ivory-klasik tanpa error', !rIvory.err, rIvory.err);
  t('sampul jawa punya background svg', !!rJawa.coverPat && rJawa.coverPat.includes('data:image/svg+xml'));
  t('sampul ivory punya background svg', !!rIvory.coverPat && rIvory.coverPat.includes('data:image/svg+xml'));
  t('pola sampul jawa != ivory', rJawa.coverPat !== rIvory.coverPat);
  t('lapisan latar halaman terisi (jawa)', !!rJawa.latarCss && rJawa.latarCss.startsWith('body{'));
  t('lapisan latar lebih lunak daripada sampul', rJawa.latarCss !== 'body{' + rJawa.coverPat);
  t('bawaan tema dipakai saat tanpa override', rJawa.patAktifIni === 'parang', rJawa.patAktifIni);
  t('override pemilik mengganti pola', rOverride.patAktifIni === 'damask', rOverride.patAktifIni);
  t('override benar-benar mengubah css sampul', rOverride.coverPat !== rJawa.coverPat);
  t('semua pola menghasilkan CSS berbeda', new Set(rJawa.semuaCss).size === POLA_IDS.length,
    new Set(rJawa.semuaCss).size + ' CSS unik dari ' + POLA_IDS.length + ' pola');

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
