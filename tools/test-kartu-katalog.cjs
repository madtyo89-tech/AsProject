#!/usr/bin/env node
/* Uji pratinjau katalog di kartu tema (index.html) — regresi tampilan "kacau".

   Latar masalah: kartu katalog menaruh undangan.html di dalam iframe selebar
   kartu (±200 px). undangan.html dirancang untuk lebar HP 390 px, sehingga
   font clamp() mentok di ukuran minimum, judul meluber, dan lapisan pemicu
   buka (tirai/gerbang/amplop/pita) menyusut ke ukuran kartu teks lalu
   menutupi nama mempelai.

   Yang dijaga uji ini:
   1. iframe kartu SELALU digambar 390 px lalu diperkecil transform:scale()
      (bukan dikecilkan lebar viewport-nya).
   2. Kartu memakai &kartu=1 (cuplikan cover utuh), lightbox memakai demo penuh.
   3. undangan.html: mode kartu menyembunyikan pemicu buka, kelas sesi tidak
      dibersihkan bootBersihkan(), dan pemicu buka adalah ANAK LANGSUNG #cover.
   4. Perangko tanggal (skeleton "segel") menempel di sudut cover, bukan di
      atas nama mempelai.
   5. Model cover minimal + foto penuh tidak menyembunyikan foto.

   Jalankan: node tools/test-kartu-katalog.cjs      (butuh: npm i --no-save jsdom) */
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

const idxSrc = read('index.html');
const undSrc = read('undangan.html');

/* ------------------------------------------------------------------ *
 * 1. index.html — iframe kartu digambar 390 px lalu diperkecil
 * ------------------------------------------------------------------ */
t('iframe kartu dipatok selebar HP (390px), bukan selebar kartu',
  idxSrc.includes('.asp-live iframe{position:absolute;top:0;left:0;width:390px;height:520px;'));
t('iframe kartu diperkecil dengan transform:scale(var(--asp-k))',
  idxSrc.includes('transform-origin:top left;transform:scale(var(--asp-k,.48))'));
t('bingkai .asp-live tidak memaksa lebar 68% lagi (tinggi pas di kartu)',
  idxSrc.includes('.asp-live{height:100%;width:auto;max-width:100%;aspect-ratio:3/4;') &&
  !idxSrc.includes('.asp-live{width:68%;aspect-ratio:3/4;'));
t('ukurLive menghitung skala + tinggi iframe dari bingkai',
  idxSrc.includes('function ukurLive(wrap)') &&
  idxSrc.includes("wrap.style.setProperty('--asp-k', k.toFixed(4))") &&
  idxSrc.includes("f.style.height = Math.round(h / k) + 'px'"));
t('ukurLive dipanggil saat kartu dibuat & saat jendela berubah',
  idxSrc.includes('ukurLive(wrap);\n      if (liveRO) liveRO.observe(wrap);') &&
  idxSrc.includes("document.querySelectorAll('.asp-live').forEach(ukurLive);"));
t('hero memakai perlakuan yang sama (390px + scale)',
  idxSrc.includes('function ukurHero(wrap)') &&
  idxSrc.includes('.asp-hero-live iframe{width:390px;height:520px;') &&
  idxSrc.includes('ukurHero(wrap);'));

/* ------------------------------------------------------------------ *
 * 2. Cuplikan kartu (&kartu=1) vs demo penuh
 * ------------------------------------------------------------------ */
t('cuplikan kartu memakai &kartu=1',
  idxSrc.includes("return 'undangan.html?demo=1&kartu=1&tema=' + encodeURIComponent(nama);"));
t('lightbox & tab baru memakai demo penuh (tanpa kartu=1)',
  idxSrc.includes('function srcDemo(nama)') &&
  idxSrc.includes("return 'undangan.html?demo=1&tema=' + encodeURIComponent(nama);") &&
  idxSrc.includes('f.src = srcDemo(nama);') &&
  idxSrc.includes("box.querySelector('.asp-lb-full').href = srcDemo(nama);"));
t('hero kiri memakai cuplikan kartu, hero kanan (sudah dibuka) tetap penuh',
  idxSrc.includes("(cfg.buka ? '&buka=1' : '&kartu=1')"));

/* ------------------------------------------------------------------ *
 * 3. undangan.html — mode kartu
 * ------------------------------------------------------------------ */
t('mode kartu dibaca dari parameter', 
  undSrc.includes("const KARTU=DEMO&&Q.get('kartu')==='1';") &&
  undSrc.includes("if(KARTU)document.body.classList.add('kartu-demo');"));
t('mode kartu menyembunyikan pemicu buka + ornamen kontrol',
  undSrc.includes('body.kartu-demo #cover .pemicu{display:none}') &&
  undSrc.includes('body.kartu-demo #cover .brand{display:none}') &&
  undSrc.includes('body.kartu-demo #cover .vip-btn{display:none}'));
t('kelas kartu-demo bertahan saat bootBersihkan() (kelas sesi)',
  undSrc.includes("BOOT_KELAS_SESI=['preview-mode','opened','pv-soft','embed-buka','kartu-demo']"));

/* ------------------------------------------------------------------ *
 * 4. pemicu buka = anak langsung #cover (bukan di dalam .inner)
 *    Diuji sungguhan lewat jsdom untuk semua gaya membuka.
 * ------------------------------------------------------------------ */
function draft(buka) {
  return {
    slug: 'uji-kartu', name1: 'Satrio', name2: 'Pandu', theme: 0,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan', buka: buka, coverLayout: 'kartu',
      cover: 'assets/demo/wedding/02-minimalist-sage.jpg', coverStyle: 'kotak',
      /* buka & coverLayout dibaca boot() dari snapshot `data` (bukan root) */
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-11-02',
        jamAcara: '08:00', venue: 'Bendo Gede', zona: 'WIB',
      },
    },
  };
}

async function render(d) {
  const html = undSrc
    .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')
    .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');
  const dom = new JSDOM(html, {
    url: 'https://asproject.my.id/undangan.html?demo=1&kartu=1',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
      w.HTMLMediaElement.prototype.pause = () => {};
      w.scrollTo = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
      w.fetch = async () => { throw new Error('offline-uji'); };
      for (const a of ['scroll-effects', 'theme-contrast', 'vip-4d']) {
        try { w.eval(read('assets/' + a + '.js')); } catch (e) {}
      }
    },
  });
  const w = dom.window, D = w.document;
  /* URL memakai ?demo=1 (syarat mode kartu), jadi halaman menjadwalkan
     boot(DEMO_DRAFT) pada ±350 ms. Tunggu dulu supaya draft uji kita tidak
     tertimpa sesudahnya. */
  await sleep(600);
  let err = null;
  try { w.eval('boot(' + JSON.stringify(d) + ')'); } catch (e) { err = e.message; }
  await sleep(900);
  return { w, D, err };
}

(async () => {
  const GAYA = ['pita', 'tirai', 'gerbang', 'pintu', 'buku', 'amplop', 'gembok', 'kotak', 'selendang'];
  let anakLangsung = 0, kelasKartu = 0, kelasGaya = 0;
  for (const g of GAYA) {
    const { D, err, w } = await render(draft(g));
    const btn = D.getElementById('btnOpen');
    const cover = D.getElementById('cover');
    const okParent = !!(btn && cover && btn.parentElement === cover);
    const okKelas = D.body.classList.contains('kartu-demo');
    /* kelas elbuka-<gaya> membuktikan gaya benar-benar terpasang (bukan cuma
       jatuh ke default) — kalau salah, uji ini lulus secara semu. */
    const okGaya = D.body.classList.contains('elbuka-' + g);
    if (okParent) anakLangsung++;
    if (okKelas) kelasKartu++;
    if (okGaya) kelasGaya++;
    if (err || !okParent || !okGaya) {
      console.log('  .. gaya ' + g + (err ? ' err=' + err : '') +
        (okParent ? '' : ' — pemicu bukan anak langsung #cover') +
        (okGaya ? '' : ' — kelas elbuka-' + g + ' tidak terpasang (' + D.body.className + ')'));
    }
    w.close();
  }
  t('9 gaya buka: pemicu selalu anak langsung #cover', anakLangsung === GAYA.length, anakLangsung + '/' + GAYA.length);
  t('9 gaya buka: kelas kartu-demo bertahan setelah boot()', kelasKartu === GAYA.length, kelasKartu + '/' + GAYA.length);
  t('9 gaya buka benar-benar terpasang (bukan jatuh ke default)', kelasGaya === GAYA.length, kelasGaya + '/' + GAYA.length);

  /* perangko tanggal (skeleton segel) */
  {
    const d = draft('pita');
    d.data.coverLayout = 'minimal';
    const { D, w } = await render(d);
    const stamp = D.querySelector('#cover > .cvstamp');
    t('perangko tanggal menempel di sudut cover (anak langsung #cover)',
      !!stamp && stamp.querySelector('.std-label') && stamp.querySelector('.date'),
      stamp ? 'ditemukan tapi bukan anak langsung #cover' : 'tidak ada');
    t('perangko tanggal tidak lagi berada di dalam kartu teks',
      !D.querySelector('#cover .bdfr .cvstamp'));
    w.close();
  }

  /* animasi masuk pemicu tidak boleh menimpa transform penempatannya */
  t('animasi masuk pemicu memakai `scale`, bukan `transform`',
    undSrc.includes('@keyframes uPopSkala{0%{opacity:0;scale:.5}') &&
    undSrc.includes('#cover .pemicu.anim-pop{animation:uPopSkala .7s') &&
    undSrc.includes(' #cover .pemicu.anim-pop{animation:none}'));
  t('petunjuk di gaya buku tampil di dalam sampul (bukan di luar layar)',
    undSrc.includes('body.elbuka-buku #cover .pemicu .p-hint{top:auto;bottom:22px;') &&
    undSrc.includes('color:#fff;font-size:10.5px;letter-spacing:.2em;opacity:.95;'));

  /* ------------------------------------------------------------------ *
   * 5. Sampul BUKU memakai foto mempelai
   * ------------------------------------------------------------------ */
  t('buku & gerbang punya variabel foto sampul sendiri (--fotoSampul)',
    undSrc.includes("const fotoSampul=fotoUtama?`--fotoSampul:url(") &&
    undSrc.includes("bukaImg,fotoSampul].filter(Boolean).join(';')"));
  t('kulit buku memakai foto + scrim gelap agar judul terbaca',
    undSrc.includes("var(--fotoSampul,none),") &&
    undSrc.includes('background-size:100% 100%,cover,100% 100%;'));
  t('buku punya punggung, blok halaman, dan pita pembatas',
    undSrc.includes('body.elbuka-buku #cover .pemicu::before{content:\'\';position:absolute;left:0;') &&
    undSrc.includes('body.elbuka-buku #cover .pemicu::after{content:\'\';position:absolute;top:7px;bottom:7px;right:0;width:7px;') &&
    undSrc.includes('clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%)'));
  t('judul (nama mempelai + tanggal) tercetak di kulit buku & gerbang',
    undSrc.includes("const bukuKulit=(BUKA==='buku'||BUKA==='gerbang')") &&
    undSrc.includes('<i class="p-kulit-orn">') &&
    undSrc.includes('${bukuKulit}<span class="p-hint"'));
  t('teks cover di belakang buku/gerbang disembunyikan selama tertutup',
    undSrc.includes('body.elbuka-buku:not(.opened) #cover .bdfr,body.elbuka-gerbang:not(.opened) #cover .bdfr{opacity:0;pointer-events:none}') &&
    undSrc.includes('body.elbuka-buku:not(.opened) #cover .geser-hint,body.elbuka-gerbang:not(.opened) #cover .geser-hint{display:none}'));
  t('buku terbuka dari punggungnya (transform-origin kiri)',
    undSrc.includes('body.elbuka-buku.opened #cover .pemicu{transform-origin:left center;'));

  /* ------------------------------------------------------------------ *
   * 6. Gerbang: dua panel SIMETRIS + foto mempelai
   * ------------------------------------------------------------------ */
  t('gerbang: dua panel sama lebar dengan radius & poros yang mirror',
    undSrc.includes('body.elbuka-gerbang #cover .pemicu .el,body.elbuka-gerbang #cover .pemicu .el2{top:0;bottom:0;width:50%;') &&
    undSrc.includes('background-position:center,left center,center;transform-origin:left center;') &&
    undSrc.includes('background-position:center,right center,center;transform-origin:right center;') &&
    undSrc.includes('border-radius:clamp(56px,15vh,140px) 0 0 0}') &&
    undSrc.includes('border-radius:0 clamp(56px,15vh,140px) 0 0}'));
  t('gerbang: tiap panel menampilkan separuh foto (menyatu saat tertutup)',
    undSrc.includes("var(--fotoSampul,none),") &&
    undSrc.includes('background-size:100% 100%,200% 100%,100% 100%;'));
  t('gerbang: nama + tanggal tercetak di panel, hint tetap di dalam layar',
    undSrc.includes('body.elbuka-gerbang #cover .pemicu .p-kulit{left:26px;right:26px;bottom:clamp(120px,17vh,168px)}') &&
    undSrc.includes('body.elbuka-gerbang #cover .pemicu .p-hint{top:auto;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));'));
  t('gerbang: teks cetak memudar saat membuka (tidak jadi teks hantu)',
    undSrc.includes('body.elbuka-gerbang.opened #cover .pemicu .p-kulit,') &&
    undSrc.includes('body.elbuka-gerbang.opened #cover .pemicu .p-hint{opacity:0;transition:opacity .28s ease}'));

  /* model minimal + foto penuh tidak boleh menyembunyikan foto */
  t('cvl-minimal hanya menyembunyikan foto bila bukan foto-penuh',
    undSrc.includes('body.cvl-minimal:not(.foto-full) #cover .cvf,body.cvl-minimal:not(.foto-full) #cover .cvlatar{display:none}') &&
    undSrc.includes('body.cvl-minimal:not(.foto-full) #cover .orn,body.cvl-minimal:not(.foto-full) #cover .cvf,body.cvl-minimal:not(.foto-full) #cover .cvlatar{display:none}') &&
    !undSrc.includes('body.cvl-minimal #cover .cvf,body.cvl-minimal #cover .cvlatar{display:none}'));

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
