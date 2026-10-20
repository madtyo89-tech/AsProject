#!/usr/bin/env node
/* ============================================================
   test-kerangka-bebas.cjs — enam template kombinasi bebas
   (field kb di TPL) merender dengan benar di undangan.html:
   shell dari kb terpasang, urutan section mengikuti
   susunan bebas, ekstra tetap hidup, hint cover dipakai.

   Jalankan: node tools/test-kerangka-bebas.cjs (butuh jsdom)
   ============================================================ */
'use strict';
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

function draft(theme, coverLayout) {
  return {
    slug: 'uji-kb', name1: 'Satrio', name2: 'Pandu', theme: theme,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      coverLayout: coverLayout || 'amplop',
      event: 'pernikahan',
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu',
        tanggalAcara: '2026-11-02', jamAcara: '08:00', jamResepsi: '11:00',
        venue: 'Bendo Gede', alamat: 'Sumbergiri, Ponjong', zona: 'WIB',
        harapanPria: 'Semoga bahagia selalu', harapanWanita: 'Semoga penuh berkah',
        ucapanCustom: '',
      },
      gallery: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg', 'g.jpg'],
      amplop: { showAmplop: true, bank: 'BCA', noRek: '1234567890', pemilik: 'Satrio', showCopy: true },
      slides: {
        timeline: { on: true, items: '08:00 — Akad Nikah\n11:00 — Resepsi' },
        story: { on: true, items: [{ tgl: '2020', judul: 'Bertemu', teks: 'Di kampus', foto: '' }] },
        quote: { on: true, custom: false, text: '', author: '' },
        menu: { on: true, items: 'Nasi — Rendang' },
        party: { on: true, items: 'Budi — Best man' },
        dresscode: { on: true, text: 'Batik', colors: '#8A6E4B,#4B4237' },
        map: { on: true },
        gift: { on: true, text: 'Jl. Melati 1' },
        rsvp: { on: true },
        closing: { on: true, text: 'Sampai jumpa' },
      },
    },
  };
}

async function render(theme, coverLayout) {
  const dom = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-kb',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
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
  await sleep(320);
  let err = null;
  try { w.eval('boot(' + JSON.stringify(draft(theme, coverLayout)) + ')'); } catch (e) { err = e.message; }
  await sleep(320);
  return { w, D, err };
}

/* urutan bagian menurut teks kicker di #content */
const urutanKicker = (D) => [...D.querySelectorAll('#content .kicker, #content .ya, #content .lay-kutip')]
  .map((el) => el.textContent.trim()).filter(Boolean);

(async () => {
 /* index TPL: 0–23 migrasi, 24 noir-kutip, 25 sultan-arsip,
    26 pop-zigzag, 27 mentari-poster, 28 damai-kaca,
    29 telur-emas, 30 kopi-jurnal, 31 mentari-bayi,
    32 senja-kencana, 33 sorot-utama, 34 retro-surya,
    35 gelap-rimbun, 36 rimba-tropis, 37 kertas-kraft,
    38 wabi-sabi, 39 bunga-kering */

 /* ---- noir-kutip (24): editorial + susunan bebas + kutipBesar + heroFoto ---- */
 {
  const { D, err } = await render(24);
  t('noir-kutip: boot tanpa error', !err, err);
  t('noir-kutip: shell editorial terpasang', D.body.classList.contains('lay-editorial'));
  const ids = [...D.querySelectorAll('[id^="bagian-"]')].map((el) => el.id);
  /* kutipan mandiri (slide quote) ditandai ❝; kutipBesar pakai .lay-kutip */
  const kutip = ids.findIndex((x) => (D.querySelector('#' + x) || {}).textContent?.includes('❝'));
  const guest = ids.findIndex((x) => D.querySelector('#' + x + ' .ya'));
  t('noir-kutip: kutipan besar tampil di awal', kutip === 0, 'kutip@' + kutip);
  t('noir-kutip: kutipan mendahului Kepada Yth (susunan bebas)', kutip >= 0 && guest >= 0 && kutip < guest,
    'kutip@' + kutip + ' guest@' + guest);
  const profil = [...D.querySelectorAll('.lay-slot')].find((el) => el.querySelector('.lay-kutip'));
  t('noir-kutip: kutipBesar tersisip di bagian mempelai', !!profil);
  const acara = [...D.querySelectorAll('.lay-slot')].find((el) => el.querySelector('.lay-hero'));
  t('noir-kutip: heroFoto tersisip di bagian acara', !!acara);
  t('noir-kutip: tanpa nomor bab', !D.querySelector('i.lay-bab'));
  t('noir-kutip: tanpa nav dot', !D.querySelector('.lay-navdot'));
 }
 /* ---- sultan-arsip (25): bab + babAngka + galeriStrip + cover minimal ---- */
 {
  const { D, err } = await render(25, 'minimal');
  t('sultan-arsip: boot tanpa error', !err, err);
  t('sultan-arsip: shell bab terpasang', D.body.classList.contains('lay-bab'));
  const bab = [...D.querySelectorAll('i.lay-bab')].map((el) => el.textContent.trim());
  t('sultan-arsip: penomoran romawi bab berjalan', bab.length >= 5 && bab[0] === 'I' && bab[1] === 'II', bab.slice(0, 4).join(','));
  t('sultan-arsip: galeri jadi strip horizontal', !!D.querySelector('.lay-slot-galeri.lay-strip'));
  t('sultan-arsip: hint cover minimal (cvl-minimal)', D.body.classList.contains('cvl-minimal'));
 }
 /* ---- pop-zigzag (26): zigzag + jamFlip + cover batik (jendela) ---- */
 {
  const { D, err } = await render(26, 'batik');
  t('pop-zigzag: boot tanpa error', !err, err);
  t('pop-zigzag: shell zigzag terpasang', D.body.classList.contains('lay-zigzag'));
  t('pop-zigzag: jam flip di bagian acara', !!D.querySelector('.lay-slot-acara.lay-flip'));
  t('pop-zigzag: hint cover batik (jendela)', D.body.classList.contains('cvl-batik'));
 }
 /* ---- mentari-poster (27): poster + galeriStrip + cover night (split) ---- */
 {
  const { D, err } = await render(27, 'night');
  t('mentari-poster: boot tanpa error', !err, err);
  t('mentari-poster: shell poster terpasang', D.body.classList.contains('lay-poster'));
  t('mentari-poster: galeri strip', !!D.querySelector('.lay-slot-galeri.lay-strip'));
  t('mentari-poster: hint cover night (split)', D.body.classList.contains('cvl-night'));
 }
 /* ---- telur-emas (29): split + heroFoto + kutipBesar ---- */
 {
  const { D, err } = await render(29);
  t('telur-emas: boot tanpa error', !err, err);
  t('telur-emas: shell split terpasang', D.body.classList.contains('lay-split'));
  t('telur-emas: heroFoto di acara', !!D.querySelector('.lay-slot-acara .lay-hero'));
  t('telur-emas: kutip besar di mempelai', !!D.querySelector('.lay-slot-profil .lay-kutip'));
 }
 /* ---- kopi-jurnal (30): klasik polos + susunan B (mempelai dulu) ---- */
 {
  const { D, err } = await render(30);
  t('kopi-jurnal: boot tanpa error', !err, err);
  t('kopi-jurnal: shell klasik terpasang', D.body.classList.contains('lay-klasik'));
  const ur = urutanKicker(D);
  const iM = ur.findIndex((x) => /Mempelai/i.test(x));
  const iD = ur.findIndex((x) => /^Doa/i.test(x));
  t('kopi-jurnal: mempelai mendahului doa (susunan B)', iM >= 0 && iD >= 0 && iM < iD,
    'mempelai@' + iM + ' doa@' + iD);
  t('kopi-jurnal: polos — tanpa pembungkus lay-slot', D.querySelectorAll('.lay-slot').length === 0);
 }
 /* ---- damai-kaca (28) & mentari-bayi (31): kompilasi legacy ---- */
 {
  const a = await render(28, 'gerbang');
  const b = await render(31);
  t('damai-kaca: shell kaca + cover arch', a.D.body.classList.contains('lay-kaca') && a.D.body.classList.contains('cvl-gerbang') && !a.err, a.err);
  t('mentari-bayi: shell lembut', b.D.body.classList.contains('lay-lembut') && !b.err, b.err);
 }
 /* ---- senja-kencana (32): token baru + susunan bebas penuh ---- */
 {
  const { D, err } = await render(32, 'gerbang');
  t('senja-kencana: boot tanpa error', !err, err);
  t('senja-kencana: shell editorial terpasang', D.body.classList.contains('lay-editorial'));
  t('senja-kencana: hint cover arch (cvl-gerbang)', D.body.classList.contains('cvl-gerbang'));
  const ids = [...D.querySelectorAll('[id^="bagian-"]')].map((el) => el.id);
  const kutip = ids.findIndex((x) => (D.querySelector('#' + x) || {}).textContent?.includes('❝'));
  const guest = ids.findIndex((x) => D.querySelector('#' + x + ' .ya'));
  const profil = ids.findIndex((x) => /Mempelai/.test(((D.querySelector('#' + x + ' .kicker') || {}).textContent) || ''));
  const doa = ids.findIndex((x) => /بَارَك/.test((D.querySelector('#' + x) || {}).textContent || ''));
  t('senja-kencana: kutipan pembuka di awal susunan', kutip === 0, 'kutip@' + kutip);
  t('senja-kencana: urutan bebas kutip→tamu→mempelai', kutip < guest && guest < profil && profil >= 0, 'kutip@' + kutip + ' tamu@' + guest + ' mempelai@' + profil);
  t('senja-kencana: doa menyusul setelah harapan (bukan di awal)', doa > profil, 'profil@' + profil + ' doa@' + doa);
  const acara = [...D.querySelectorAll('.lay-slot')].find((el) => el.querySelector('.lay-hero'));
  t('senja-kencana: heroFoto di bagian acara', !!acara);
  t('senja-kencana: kelas tema terpasang di body', D.body.classList.contains('theme-senja-kencana'));
 }
 /* ---- sorot-utama (33): shell gedung + cover split + heroFoto ---- */
 {
  const { w, D, err } = await render(33, 'night');
  t('sorot-utama: boot tanpa error', !err, err);
  t('sorot-utama: shell gedung terpasang', D.body.classList.contains('lay-gedung'));
  t('sorot-utama: hint cover split (cvl-night)', D.body.classList.contains('cvl-night'));
  const ids = [...D.querySelectorAll('[id^="bagian-"]')].map((el) => el.id);
  const kutip = ids.findIndex((x) => (D.querySelector('#' + x) || {}).textContent?.includes('❝'));
  const profil = ids.findIndex((x) => /Mempelai/.test(((D.querySelector('#' + x + ' .kicker') || {}).textContent) || ''));
  t('sorot-utama: mempelai mendahului kutipan (susunan bebas)', profil >= 0 && kutip > profil, 'profil@' + profil + ' kutip@' + kutip);
  const acara = [...D.querySelectorAll('.lay-slot')].find((el) => el.querySelector('.lay-hero'));
  t('sorot-utama: heroFoto di bagian acara', !!acara);
  const nm = D.querySelector('.lay-slot-profil .nm');
  t('sorot-utama: nama mempelai berukuran raksasa', !!nm && parseInt(w.getComputedStyle(nm).fontSize, 10) >= 38,
    nm ? w.getComputedStyle(nm).fontSize : 'tidak ada .nm');
 }
 /* ---- retro-surya (34): shell retro + jamFlip + galeriStrip ---- */
 {
  const { w, D, err } = await render(34, 'batik');
  t('retro-surya: boot tanpa error', !err, err);
  t('retro-surya: shell retro terpasang', D.body.classList.contains('lay-retro'));
  t('retro-surya: hint cover jendela (cvl-batik)', D.body.classList.contains('cvl-batik'));
  t('retro-surya: jam flip di bagian acara', !!D.querySelector('.lay-slot-acara.lay-flip'));
  t('retro-surya: galeri jadi strip horizontal', !!D.querySelector('.lay-slot-galeri.lay-strip'));
  const ids = [...D.querySelectorAll('[id^="bagian-"]')].map((el) => el.id);
  const tamu = ids.findIndex((x) => D.querySelector('#' + x + ' .ya'));
  const acara = ids.findIndex((x) => /Akad|Resepsi|Acara/.test((D.querySelector('#' + x) || {}).textContent || ''));
  t('retro-surya: tamu & acara di awal (susunan bebas)', tamu >= 0 && acara > tamu, 'tamu@' + tamu + ' acara@' + acara);
  const flipN = D.querySelector('.lay-flip .cdw .n');
  /* jsdom tidak me-resolve var(), jadi periksa aturan CSS-nya
     langsung + nilai --ft yang dipasang render (font tema). */
  const adaAturan = [...D.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => String(r.cssText).includes('lay-retro .lay-flip .cdw .n')); } catch (e) { return false; } });
  const ftTema = D.documentElement.style.getPropertyValue('--ft') || D.body.style.getPropertyValue('--ft') || '';
  t('retro-surya: angka flip pakai font tema (chunky)', !!flipN && adaAturan && /Bebas/.test(ftTema),
    'aturan=' + adaAturan + ' ft=' + ftTema.trim());
 }
 /* ---- gelap-rimbun (35): shell rimbun + kutipBesar + navDot ---- */
 {
  const { D, err } = await render(35, 'minimal');
  t('gelap-rimbun: boot tanpa error', !err, err);
  t('gelap-rimbun: shell rimbun terpasang', D.body.classList.contains('lay-rimbun'));
  t('gelap-rimbun: hint cover segel (cvl-minimal)', D.body.classList.contains('cvl-minimal'));
  t('gelap-rimbun: nav dot terpasang', !!D.querySelector('.lay-navdot'));
  const profil = [...D.querySelectorAll('.lay-slot')].find((el) => el.querySelector('.lay-kutip'));
  t('gelap-rimbun: kutip besar di bagian mempelai', !!profil);
  const ids = [...D.querySelectorAll('[id^="bagian-"]')].map((el) => el.id);
  const doa = ids.findIndex((x) => /بَارَك/.test((D.querySelector('#' + x) || {}).textContent || ''));
  const tamu = ids.findIndex((x) => D.querySelector('#' + x + ' .ya'));
  t('gelap-rimbun: doa di awal susunan (sebelum tamu)', doa >= 0 && doa < tamu, 'doa@' + doa + ' tamu@' + tamu);
  t('gelap-rimbun: kelas tema terpasang di body', D.body.classList.contains('theme-gelap-rimbun'));
 }
 /* ---- rimba-tropis (36): panggung + heroFoto + hint foto/daun ---- */
 {
  const { w, D, err } = await render(36);
  t('rimba-tropis: boot tanpa error', !err, err);
  t('rimba-tropis: shell panggung terpasang', D.body.classList.contains('lay-panggung'));
  const tp=w.eval('TPL[36]');
  t('rimba-tropis: hint cover foto & cara buka gerbang', tp.cover==='foto'&&tp.buka==='gerbang', tp.cover+'/'+tp.buka);
  const acara = [...D.querySelectorAll('.lay-slot')].find((el) => el.querySelector('.lay-hero'));
  t('rimba-tropis: heroFoto di bagian acara', !!acara);
 }
 /* ---- kertas-kraft (37): arsip + navDot ---- */
 {
  const { D, err } = await render(37);
  t('kertas-kraft: boot tanpa error', !err, err);
  t('kertas-kraft: shell arsip terpasang', D.body.classList.contains('lay-arsip'));
  t('kertas-kraft: nav dot terpasang', !!D.querySelector('.lay-navdot'));
  t('kertas-kraft: kelas tema terpasang di body', D.body.classList.contains('theme-kertas-kraft'));
 }
 console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
 process.exit(fail ? 1 : 0);
})();
