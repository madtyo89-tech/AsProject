#!/usr/bin/env node
/* Uji #5 skeleton cover per model + #7 paket "lebih hidup".

   #5: model night/neon memakai skeleton split (dua kolom), minimal/archive
   skeleton segel (tanggal jadi perangko), batik/sakura skeleton jendela
   (pita teks), dan model klasik tetap tanpa wrapper -- plus semua 15 model
   tetap boot mulus dengan tombol buka utuh.
   #7: micro-interaction hadir (tekan tombol, divider tergambar saat reveal,
   detik countdown mem-pop, piringan musik berhenti/berdenyut, zoom galeri,
   denyut titik navigasi) dan semuanya mati pada prefers-reduced-motion.

   Jalankan: node tools/test-nyawa.cjs      (butuh: npm i --no-save jsdom) */
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

const undSrc = read('undangan.html');

function draft(coverLayout) {
  return {
    slug: 'uji-nyawa', name1: 'Satrio', name2: 'Pandu', theme: 0,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan',
      coverLayout: coverLayout,
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-11-02',
        jamAcara: '08:00', venue: 'Bendo Gede', zona: 'WIB',
      },
    },
  };
}

async function render(coverLayout) {
  const dom = new JSDOM(undSrc, {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-nyawa',
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
  try { w.eval('boot(' + JSON.stringify(draft(coverLayout)) + ')'); } catch (e) { err = e.message; }
  await sleep(1300);
  const inner = D.querySelector('#cover .bdfr .inner');
  const hasil = {
    err,
    split: !!D.querySelector('#cover .cvsplit'),
    spA: !!D.querySelector('#cover .cvsp-a'),
    spB: !!D.querySelector('#cover .cvsp-b'),
    segel: !!inner && inner.classList.contains('cv-segel'),
    stamp: !!D.querySelector('#cover .cvstamp .std-label') && !!D.querySelector('#cover .cvstamp .date'),
    jendela: !!inner && inner.classList.contains('cv-jendela'),
    /* Pemicu buka sengaja TIDAK lagi berada di dalam .inner/.cvband: gaya
       tirai/gerbang/pintu/amplop memakai width:100%;height:100% dan harus
       menjadi anak langsung #cover, kalau tidak lapisannya menyusut ke ukuran
       kartu teks dan menutupi nama mempelai. Pita teks tetap berisi kicker,
       tombol buka tetap ada di cover. */
    band: !!D.querySelector('#cover .cvband .kicker') && !!D.querySelector('#cover #btnOpen'),
    btn: !!D.getElementById('btnOpen'),
    tick: !!D.querySelector('.cd-tick'),
  };
  w.close();
  return hasil;
}

(async () => {
  /* ---------- #5 skeleton ---------- */
  t('pemetaan skeleton ada di renderer', undSrc.includes("const CV_STRUK={night:'split',neon:'split',minimal:'segel',archive:'segel',batik:'jendela',sakura:'jendela'};"));
  t('css split/segel/jendela lengkap',
    undSrc.includes('.cvsplit{display:grid;gap:14px}') &&
    undSrc.includes('.cv-segel .cvstamp{position:absolute;top:-4px;right:-2px;transform:rotate(8deg)') &&
    undSrc.includes('.cv-jendela .cvband{margin-top:12px;padding:14px 12px 10px;border-radius:16px'));

  const rSplit = await render('night');
  t('model night memakai skeleton split', !rSplit.err && rSplit.split && rSplit.spA && rSplit.spB, 'err=' + rSplit.err);
  t('split tetap menyimpan tombol buka', rSplit.btn);
  const rSegel = await render('minimal');
  t('model minimal memakai skeleton segel + perangko tanggal', !rSegel.err && rSegel.segel && rSegel.stamp, 'err=' + rSegel.err);
  const rJen = await render('batik');
  t('model batik memakai skeleton jendela + pita teks', !rJen.err && rJen.jendela && rJen.band, 'err=' + rJen.err);
  const rKlasik = await render('kartu');
  t('model klasik tetap tanpa wrapper skeleton', !rKlasik.err && !rKlasik.split && !rKlasik.segel && !rKlasik.jendela && rKlasik.btn, 'err=' + rKlasik.err);

  const IDS = ['amplop', 'kartu', 'foto', 'gerbang', 'minimal', 'batik', 'sakura', 'night', 'ticket', 'editorial', 'polaroid', 'glass', 'royal', 'archive', 'neon'];
  let bootOk = 0, btnOk = 0;
  for (const id of IDS) {
    const r = await render(id);
    if (!r.err) bootOk++;
    if (r.btn) btnOk++;
  }
  t('15 model cover boot mulus semua', bootOk === 15, bootOk + '/15');
  t('15 model cover tetap punya tombol buka', btnOk === 15, btnOk + '/15');

  /* ---------- #7 paket hidup ---------- */
  t('umpan balik tekan tombol', undSrc.includes(':where(button):active{transform:scale(.965)}'));
  t('divider tergambar saat reveal (sr-in)',
    undSrc.includes('.scroll-reveal .divider svg path,.scroll-reveal .footer .orn svg path{stroke-dasharray:520;stroke-dashoffset:520}') &&
    undSrc.includes('.scroll-reveal.sr-in .divider svg path') && undSrc.includes('@keyframes ornGambar{to{stroke-dashoffset:0}}'));
  t('detik countdown mem-pop saat berubah',
    undSrc.includes("a.classList.remove('cd-tick');void a.offsetWidth;a.classList.add('cd-tick')") &&
    undSrc.includes('@keyframes cdPop{'));
  t('piringan musik berhenti saat jeda + cincin denyut saat play',
    undSrc.includes('#musikBtn .disc{animation-play-state:paused}') &&
    undSrc.includes('body.musik-on #musikBtn .disc{animation-play-state:running}') &&
    undSrc.includes('body.musik-on #musikBtn::after{') && undSrc.includes('@keyframes ringNada{'));
  t('kelas musik-on dipasang/dilepas di handler',
    undSrc.includes("document.body.classList.add('musik-on')") && undSrc.includes("document.body.classList.remove('musik-on')"));
  t('galeri zoom saat disentuh/ditetuk', undSrc.includes('.gal-grid img:hover{transform:scale(1.05)}') && undSrc.includes('.gal-grid img:active{transform:scale(.98)}'));
  t('titik navigasi aktif berdenyut', undSrc.includes('.nv-dots i.on{animation:dotNadi 2.2s ease-in-out infinite}') && undSrc.includes('@keyframes dotNadi{'));
  t('reduced-motion mematikan paket hidup',
    undSrc.includes(':where(button):active{transform:none}') &&
    undSrc.includes('.scroll-reveal .divider svg path,.scroll-reveal .footer .orn svg path{stroke-dashoffset:0;animation:none}') &&
    undSrc.includes('body.musik-on #musikBtn::after{animation:none;opacity:0}') &&
    undSrc.includes('.nv-dots i.on{animation:none}'));
  t('countdown nyata mem-pop setelah satu detik', rKlasik.tick === true);

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
