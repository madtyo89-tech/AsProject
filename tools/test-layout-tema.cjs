#!/usr/bin/env node
/* ============================================================
   test-layout-tema.cjs — kerangka (layout) per tema undangan.

   Latar: sampai 2026-10-15 semua tema berbagi SATU kerangka DOM.
   Tiap bagian dibungkus `<div class="card rv">` + `<div class="kicker">`
   dengan urutan terkunci 1→7; tema hanya menyuntik warna, font, pola,
   bingkai, dan ornamen. Akibatnya tema Rp49.000 dan tema Rp99.000
   berbeda cat saja, bukan bentuk.

   Rombakan menambahkan field `layout:` pada tiap entri TPL yang menunjuk
   preset di `const LAYOUTS`. Satu preset menentukan empat hal:
     shell  → kelas body `lay-<shell>`: bentuk & tata letak bagian
     urutan → susunan bagian (varian A–E), jadi alur baca ikut berbeda
     ekstra → bagian eksklusif yang hanya lahir di preset itu
     vip    → mount mesin 4D (parallax 3 lapis + partikel + entrance)

   Tes ini menjaga tiga hal:
     1. REGRESI  — preset `klasik` menghasilkan kerangka yang PERSIS sama
                   dengan sebelum rombakan (daftar bagian di bawah direkam
                   dari origin/main, bukan dikarang).
     2. BEDA     — tema yang layout-nya berbeda menghasilkan DOM berbeda:
                   bukan cuma warna. Diukur dari urutan bagian, kelas body,
                   dan kehadiran bagian eksklusif.
     3. KONTRAK  — liveSlides() tetap mengembalikan string dengan 10 slide
                   pada urutan lama (dipakai tools/test-peta.cjs dan
                   diperiksa tools/cek-kesehatan.py aturan 9).

   Jalankan: node tools/test-layout-tema.cjs        (butuh: npm i --no-save jsdom)
   Rekam ulang tanda tangan: --tanda <path-undangan.html> <tema,tema,...>
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

/* ---------- draft uji: pernikahan, semua slide nyala, galeri + amplop ---------- */
function draft(theme) {
  return {
    slug: 'uji-layout', name1: 'Satrio', name2: 'Pandu', theme: theme,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
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

/* Label singkat satu bagian: teks kicker-nya, atau kelas utamanya. */
function label(el) {
  const k = el.querySelector(':scope > .kicker');
  if (k && k.textContent.trim()) return k.textContent.trim();
  const c = (el.className || '').toString().split(/\s+/)
    .filter((x) => x && x !== 'rv' && !/^fx-/.test(x) && !/^sr-/.test(x));
  return '<' + el.tagName.toLowerCase() + '.' + (c.join('.') || '?') + '>';
}

async function render(undPath, theme) {
  const dom = new JSDOM(fs.readFileSync(undPath, 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-layout',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class {
        constructor(cb) { this.cb = cb; }
        observe() {} unobserve() {} disconnect() {}
      };
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
  try { w.eval('boot(' + JSON.stringify(draft(theme)) + ')'); } catch (e) { err = e.message; }
  await sleep(220);
  const wrap = D.querySelector('#content > .wrap');
  const res = {
    err: err,
    body: (D.body.className || '').split(/\s+/).filter(Boolean).sort().join(' '),
    sections: wrap ? [...wrap.children].map(label) : [],
    vip4d: !!D.querySelector('#cover .vip-bg') && !!D.querySelector('#cover .vip-fg'),
    navDot: !!D.querySelector('.lay-navdot'),
    babAngka: !!D.querySelector('.lay-bab'),
    kutipBesar: !!D.querySelector('.lay-kutip'),
    heroFoto: !!D.querySelector('.lay-hero'),
    galeriStrip: !!D.querySelector('.lay-strip'),
    jamFlip: !!D.querySelector('.lay-flip'),
  };
  try { dom.window.close(); } catch (e) {}
  return res;
}

/* Baca registry LAYOUTS langsung dari halaman (murni data, tanpa fungsi). */
async function bacaLAYOUTS(undPath) {
  const dom = new JSDOM(fs.readFileSync(undPath, 'utf8'), {
    runScripts: 'dangerously', url: 'https://x.test/undangan.html?slug=uji',
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = async () => { throw new Error('offline-uji'); };
    },
  });
  await sleep(300);
  let out = null;
  try { out = JSON.parse(dom.window.eval('typeof LAYOUTS==="undefined"?"null":JSON.stringify(LAYOUTS)')); } catch (e) { out = null; }
  try { dom.window.close(); } catch (e) {}
  return out;
}

/* ---------- mode rekam: cetak tanda tangan untuk dijadikan golden ---------- */if (process.argv[2] === '--tanda') {
  (async () => {
    const target = process.argv[3] || path.join(ROOT, 'undangan.html');
    const themes = (process.argv[4] || '0').split(',').map(Number);
    const out = {};
    for (const th of themes) out[th] = await render(target, th);
    console.log(JSON.stringify(out, null, 1));
    process.exit(0);
  })();
  return;
}

/* ---------- golden: kerangka `klasik` SEBELUM rombakan (direkam dari origin/main) ---------- */
const GOLDEN_KLASIK = require('./layout-klasik-golden.json');

/* Semua tema publik (indeks = nilai kolom `theme` di Supabase) + layout yang diharapkan. */
const DRAF_TEMA = [
  [0, 'ivory-klasik', 'klasik'], [1, 'jawa-elegan', 'arsip'],
  [2, 'minimalist-sage', 'editorial-sage'], [3, 'luxury-gold', 'panggung-emas'],
  [4, 'floral-rustic', 'zigzag-rustic'], [5, 'biru-ceria', 'poster-ceria'],
  [6, 'islamic-elegant', 'bab-islami'], [7, 'kids-party', 'poster-anak'],
  [8, 'sweet-17', 'kaca-manis'], [9, 'adult-elegant', 'kaca-dewasa'],
  [10, 'baby-boy', 'lembut-biru'], [11, 'baby-girl', 'lembut-merah'],
  [12, 'islamic-neutral', 'bab-netral'], [13, 'midnight-gold', 'split-midnight'],
  [14, 'emerald-royal', 'bab-royal'], [15, 'navy-crest', 'split-navy'],
  [16, 'golden-jubilee', 'zigzag-jubile'], [17, 'pearl-ivory', 'editorial-mutiara'],
];

(async () => {
  const UND = path.join(ROOT, 'undangan.html');
  const src = read('undangan.html');

  /* ---- 0) kontrak statis: registry & field ada, urutan TPL tidak bergeser ---- */
  t('undangan.html punya const LAYOUTS', /const LAYOUTS=\{/.test(src));
  t('undangan.html punya pemetaan urutan bagian', /const URUTAN=\{/.test(src));
  const ids = [...src.matchAll(/\{id:'([a-z0-9-]+)'/g)].map((m) => m[1]).slice(0, 24);
  t('24 tema tetap berurutan (indeks = theme Supabase)',
    ids.length === 24 && ids[0] === 'ivory-klasik' && ids[17] === 'pearl-ivory', ids.join(','));
  const stu = read('studio.html');
  for (const [, id, lay] of DRAF_TEMA) {
    const ada = (s) => {
      const i = s.indexOf("{id:'" + id + "'");
      if (i < 0) return false;
      const j = s.indexOf('\n', i);
      return /layout:'[a-z0-9-]+'/.test(s.slice(i, j < 0 ? undefined : j + 200));
    };
    t(`${id}: layout terdaftar di studio & undangan`, ada(stu) && ada(src));
  }

  /* ---- 0b) nama kerangka sinkron studio <-> undangan ---- */
  const LREG = await bacaLAYOUTS(path.join(ROOT, 'undangan.html'));
  const namaStudio = {};
  const mn = stu.match(/const LAYOUT_NAMA=\{([\s\S]*?)\};/);
  t('studio.html punya LAYOUT_NAMA', !!mn);
  if (mn) for (const m of mn[1].matchAll(/'([a-z0-9-]+)':'([^']+)'/g)) namaStudio[m[1]] = m[2];
  const presetDipakai = [...new Set(DRAF_TEMA.map(([, , l]) => l))];
  for (const lay of presetDipakai) {
    t(`preset '${lay}' terdaftar di LAYOUTS undangan.html`, !!(LREG && LREG[lay]));
    t(`preset '${lay}' namanya sama di studio & undangan`,
      !!(LREG && LREG[lay]) && namaStudio[lay] === LREG[lay].nama,
      `studio='${namaStudio[lay]}' undangan='${LREG && LREG[lay] && LREG[lay].nama}'`);
  }
  t('studio.html melabeli kerangka di pemilih tema',
    /function layNama\(t\)/.test(stu) && /▦ \$\{esc\(layNama\(t\)\)\}/.test(stu));

  /* ---- 1) REGRESI: tema klasik identik dengan sebelum rombakan ---- */
  const k = await render(UND, 0);
  t('ivory-klasik: render tanpa error', !k.err, k.err);
  t('ivory-klasik: urutan bagian PERSIS sama dengan origin/main',
    JSON.stringify(k.sections) === JSON.stringify(GOLDEN_KLASIK.sections),
    '\n     dapat: ' + JSON.stringify(k.sections) + '\n     harap: ' + JSON.stringify(GOLDEN_KLASIK.sections));
  t('ivory-klasik: kelas body memakai kerangka & model buka aktif',
    GOLDEN_KLASIK.body.split(' ').every((c) => k.body.includes(c)),
    'dapat [' + k.body + '] harap memuat [' + GOLDEN_KLASIK.body + ']');
  t('ivory-klasik: TIDAK memasang mesin 4D', k.vip4d === false);

  /* ---- 2) BEDA: tiap tema dirender, kerangkanya dibandingkan ---- */
  const hasil = { 0: k };
  for (const [idx] of DRAF_TEMA) if (idx !== 0) hasil[idx] = await render(UND, idx);
  for (const [idx, id, lay] of DRAF_TEMA) {
    const r = hasil[idx];
    t(`${id}: render tanpa error`, !r.err, r.err);
    t(`${id}: bagian tetap lengkap (≥15)`, r.sections.length >= 15, r.sections.length + ' bagian');
    t(`${id}: shell layout terpasang di body`, r.body.includes('lay-'), r.body);
  }

  /* Tanda tangan kerangka = urutan bagian + shell + bagian eksklusif (warna diabaikan). */
  const tanda = (r) => JSON.stringify([
    r.sections,
    (r.body.match(/lay-[a-z0-9-]+/) || [''])[0],
    r.vip4d, r.navDot, r.babAngka, r.kutipBesar, r.heroFoto, r.galeriStrip, r.jamFlip,
  ]);
  const unu = {};
  for (const [idx, id] of DRAF_TEMA) (unu[tanda(hasil[idx])] = unu[tanda(hasil[idx])] || []).push(id);
  const jumlahBeda = Object.keys(unu).length;
  t(`${DRAF_TEMA.length} contoh tema publik menghasilkan ${jumlahBeda} kerangka berbeda (bukan sekadar warna)`,
    jumlahBeda >= 12, Object.entries(unu).map(([s, v]) => v.join('+')).join(' | '));

  /* Tema yang layout-nya beda kelas shell-nya harus beda pula. */
  const shellOf = {};
  for (const [idx, id, lay] of DRAF_TEMA) {
    const sh = (hasil[idx].body.match(/lay-[a-z0-9-]+/) || [''])[0];
    shellOf[lay] = shellOf[lay] || new Set();
    shellOf[lay].add(sh);
  }
  t('tiap preset layout konsisten memakai satu shell',
    Object.values(shellOf).every((s) => s.size === 1 && [...s][0] !== ''),
    JSON.stringify(Object.fromEntries(Object.entries(shellOf).map(([a, b]) => [a, [...b]]))));
  const shells = new Set(Object.values(shellOf).map((s) => [...s][0]));
  t(`minimal 8 shell berbeda dipakai ${DRAF_TEMA.length} contoh tema publik`, shells.size >= 8, [...shells].join(','));

/* ---- 3) bagian eksklusif hanya lahir di preset yang memintanya ---- */
/* LAYOUTS dibaca dari halaman itu sendiri (bukan di-parse sebagai teks) supaya
   tes selalu mengikuti registry yang benar-benar dipakai renderer. */
const L = LREG;   /* sudah dibaca di bagian 0b — jangan boot jsdom dua kali */
t('registry LAYOUTS bisa dibaca dari undangan.html', !!L && typeof L === 'object', JSON.stringify(L).slice(0, 80));
  for (const [idx, id, lay] of DRAF_TEMA) {
    const pre = L[lay], r = hasil[idx];
    if (!pre) { t(`${id}: preset '${lay}' terdaftar di LAYOUTS`, false); continue; }
    const x = pre.ekstra || [];
    /* Keenam bagian eksklusif diperiksa semua — sebelumnya hanya navDot, babAngka,
       dan vip4d yang ditegaskan, jadi kutipBesar/heroFoto/galeriStrip/jamFlip bisa
       saja mati tanpa ketahuan. */
    const EKSTRA = ['navDot', 'babAngka', 'kutipBesar', 'heroFoto', 'galeriStrip', 'jamFlip'];
    for (const e of EKSTRA)
      t(`${id}: ${e} ${x.includes(e) ? 'ada' : 'tidak ada'} sesuai preset`, r[e] === x.includes(e));
    t(`${id}: mesin 4D ${pre.vip ? 'nyala' : 'mati'} sesuai preset`, r.vip4d === !!pre.vip);
  }

  /* ---- 4) KONTRAK liveSlides(): tetap string, 10 slide, urutan lama ---- */
  const dom2 = new JSDOM(fs.readFileSync(UND, 'utf8'), {
    runScripts: 'dangerously', url: 'https://x.test/undangan.html?slug=uji',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = async () => { throw new Error('offline-uji'); };
    },
  });
  await sleep(320);
  const hs = dom2.window.eval('liveSlides(' + JSON.stringify(draft(0).data) + ",'pernikahan',null,'S & P',{},'V')");
  t('liveSlides() tetap mengembalikan string', typeof hs === 'string', typeof hs);
  const urutanSlide = ['Timeline Acara', 'Cerita Kami', 'Menu Acara', 'Panitia', 'Dress Code', 'Alamat Kado', 'RSVP'];
  let pos = -1, naik = true;
  for (const s of urutanSlide) { const p = hs.indexOf(s); if (p < pos) naik = false; pos = p; }
  t('liveSlides() menjaga urutan slide lama', naik);
  t('liveSlides() memuat semua 10 slide',
    ['Timeline Acara', 'Cerita Kami', 'Menu Acara', 'Panitia', 'Dress Code', 'Alamat Kado', 'RSVP', 'Sampai jumpa']
      .every((s) => hs.includes(s)));
  try { dom2.window.close(); } catch (e) {}

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
