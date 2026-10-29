#!/usr/bin/env node
/* Uji gaya membuka undangan + reveal elegan bingkai layar.

   Memastikan: sistem FX_BUKA kini punya 16 gaya (13 lama + sampul buku, daun
   pintu, kotak kado), kelas tubuh ikut gaya terpilih, panel pintu/kotak dan
   letupan kelip lahir di cover, gaya asing jatuh ke default, dan bingkai
   layar punya reveal clip-path berjenjang + napas pelan yang semuanya mati
   pada prefers-reduced-motion.

   Jalankan: node tools/test-buka.cjs      (butuh: npm i --no-save jsdom) */
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
const studioSrc = read('studio.html');

function draft(buka, coverStyle, physicalBuka = 'pita') {
  return {
    slug: 'uji-buka', name1: 'Satrio', name2: '', theme: 0,
    venue: 'Bendo Gede', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan',
      anim: { buka: buka },
      /* Pemicu fisik dipilih terpisah dari efek perpindahan cover. */
      buka: physicalBuka,
      cover: coverStyle ? 'https://x.test/foto-cover.jpg' : undefined,
      coverStyle: coverStyle,
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-11-02',
        jamAcara: '08:00', venue: 'Bendo Gede', zona: 'WIB',
      },
    },
  };
}

async function render(buka, coverStyle, physicalBuka = 'pita') {
  const dom = new JSDOM(undSrc, {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-buka',
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
  try { w.eval('boot(' + JSON.stringify(draft(buka, coverStyle, physicalBuka)) + ')'); } catch (e) { err = e.message; }
  await sleep(120);
  const hasil = {
    err,
    kelasBuka: [...D.body.classList].filter((c) => c.startsWith('buka-')),
    kelasModel: [...D.body.classList].filter((c) => c.startsWith('elbuka-')),
    panel: D.querySelectorAll('#cover .bkl, #cover .bkt').length,
    burst: D.querySelectorAll('.kt-burst i').length,
    lajur: D.querySelectorAll('#cover .bld').length,
    coverStyle: (D.getElementById('cover') || {}).getAttribute ? D.getElementById('cover').getAttribute('style') : null,
  };
  w.close();
  return hasil;
}

(async () => {
  /* ---------- 1. registri & picker ---------- */
  t('studio: FX_BUKA kini 20 gaya', (studioSrc.match(/^ \['/gm) || []).length >= 20 &&
    studioSrc.includes("['buku','Sampul Buku','cover membalik dari tepi kiri seperti sampul buku dibuka'],") &&
    studioSrc.includes("['pintu','Daun Pintu','dua daun pintu berayun membuka dari tengah'],") &&
    studioSrc.includes("['kotak','Kotak Kado','tutup kotak terangkat disertai letupan kelip'],") &&
    studioSrc.includes("['jungkit','Jungkit Drawbridge','cover terjungkit ke belakang dari tepi bawah']];"));
  t('undangan: fxBukaId menerima 20 gaya (termasuk iris/lubang/blinds/jungkit)',
    undSrc.includes("'menyusut','miring','tirai','buku','pintu','kotak','iris','lubang','blinds','jungkit']"));
  t('undangan: fxBukaId membaca pilihan langsung dari AN.buka',
    undSrc.includes('function fxBukaId(AN){const v=AN&&AN.buka;'));
  t('Studio menjelaskan model fisik yang memakai fade agar gerak tidak bertumpuk',
    studioSrc.includes('cover memakai fade agar animasi fisik tidak bertumpuk'));
  t('pita cover biasa ditempatkan di area atas, tidak melintang di jam/venue',
    undSrc.includes('body.elbuka-pita:not(.foto-full) #cover .pemicu{top:12%;height:96px}') &&
    undSrc.includes('body.elbuka-pita:not(.foto-full) #cover .pemicu .el2{top:42px;height:18px'));
  t('amplop normal menutup celah dan mencetak nama + tanggal',
    undSrc.includes('body.elbuka-amplop:not(.foto-full) #cover .pemicu{isolation:isolate;') &&
    undSrc.includes('body.elbuka-amplop:not(.foto-full) #cover .pemicu .p-kulit{display:flex;'));
  t('hint tirai/pintu/selendang/amplop berada di dalam viewport',
    undSrc.includes('body.elbuka-tirai #cover .pemicu .p-hint,') &&
    undSrc.includes('body.elbuka-selendang #cover .pemicu .p-hint,') &&
    undSrc.includes('body.elbuka-amplop:not(.foto-full) #cover .pemicu .p-hint{top:auto;'));
  t('selendang tidak menampilkan hint generik kedua di atas RSVP',
    undSrc.includes('body.elbuka-selendang #cover .geser-hint{display:none}'));
  t('gembok biasa diperkecil dan dipindah ke area foto atas, bukan teks tengah',
    undSrc.includes('body.elbuka-gembok:not(.foto-full) #cover .pemicu{width:150px;height:206px;top:22%;') &&
    undSrc.includes('transform:translate(-50%,-50%) scale(.5)}'));
  t('studio: FX_BUKA menambah 4 skin berstruktur beda',
    studioSrc.includes("['iris','Iris Diagonal','cover tersibak menyamping lewat potongan diagonal'],") &&
    studioSrc.includes("['lubang','Iris Lingkaran','cover tersedot mengecil ke tengah membentuk bulat'],") &&
    studioSrc.includes("['blinds','Blind Empat Lajur','empat lajur meluncur berselang-seling seperti blind jendela'],") &&
    studioSrc.includes("['jungkit','Jungkit Drawbridge','cover terjungkit ke belakang dari tepi bawah']];"));

  /* ---------- 2. CSS gaya baru & reveal sudut ---------- */
  for (const kf of ['pintuL', 'pintuR', 'kotakT', 'kotakB', 'ktTerbang']) {
    t('keyframes ' + kf + ' ada', undSrc.includes('@keyframes ' + kf + '{'));
  }
  t('panel pintu & kotak memakai gradasi cover',
    (undSrc.match(/#cover \.bkl\{[^}]*linear-gradient\(165deg,var\(--g0\)/) || []).length === 1 &&
    (undSrc.match(/#cover \.bkt\{[^}]*linear-gradient\(165deg,var\(--g0\)/) || []).length === 1);
  t('pintu: perspective + dua daun berayun',
    undSrc.includes('body.buka-pintu #cover{perspective:1200px;transform-style:preserve-3d}') &&
    undSrc.includes('body.buka-pintu.opened #cover .bkl.l{animation:pintuL') &&
    undSrc.includes('body.buka-pintu.opened #cover .bkl.r{animation:pintuR'));
  t('buku: membalik dari tepi kiri sampai punggung hilang',
    undSrc.includes('body.buka-buku.opened #cover{opacity:0;visibility:hidden;pointer-events:none;transform-origin:0% 50%;transform:perspective(1500px) rotateY(-112deg) translateX(-7%);backface-visibility:hidden'));
  t('kotak: tutup terangkat + letupan kelip',
    undSrc.includes('body.buka-kotak.opened #cover .bkt.t{animation:kotakT') &&
    undSrc.includes('body.buka-kotak.opened .kt-burst i{animation:ktTerbang'));
  t('semua efek panel berakhir dengan cover hidden, bukan latar pekat tertinggal',
    undSrc.includes('body.buka-pintu.opened #cover{opacity:0;visibility:hidden;') &&
    undSrc.includes('body.buka-kotak.opened #cover{opacity:0;visibility:hidden;') &&
    undSrc.includes('body.buka-blinds.opened #cover{opacity:0;transition:opacity .3s ease .98s,visibility 0s linear 1.28s}') &&
    !/body\.buka-[a-z]+\.opened #cover\{[^}]*visibility:visible/.test(undSrc));
  t('reveal isi mengikuti durasi cover aktif dan mengunci isi selama animasi',
    undSrc.includes('function coverSelesaiDalam()') &&
    undSrc.includes('cs.transitionDuration') && undSrc.includes('cs.transitionDelay') &&
    undSrc.includes('},coverSelesaiDalam());') && !undSrc.includes("body.classList.remove('cover-opening')},1200);") &&
    undSrc.includes('body.opened.cover-opening #content{opacity:0;visibility:hidden;transition:none;pointer-events:none}') &&
    undSrc.includes('body.opened.cover-opening{overflow:hidden}') &&
    undSrc.includes('body.opened.cover-opening .scr-frame{opacity:0;visibility:hidden}'));
  t('semua animasi buka memakai kurva halus bersama & lapisan GPU saat bergerak',
    undSrc.includes('--ease-cover:cubic-bezier(.22,.78,.24,1)') &&
    undSrc.includes('--ease-cover-soft:cubic-bezier(.33,.72,.24,1)') &&
    undSrc.includes('--ease-cover-io:cubic-bezier(.45,0,.22,1)') &&
    undSrc.includes('body.opened #cover{will-change:transform,opacity,clip-path') &&
    undSrc.includes('body.opened #cover .pemicu .el') &&
    undSrc.includes('transition:transform 1.02s var(--ease-cover) .48s,opacity .7s ease .8s,visibility 0s linear 1.5s'));
  t('crossfade isi overlap halus di ujung animasi cover',
    undSrc.includes('#content{opacity:0;transition:opacity .85s var(--ease-cover-soft) .1s}') &&
    undSrc.includes('Math.round(selesai-300)') &&
    undSrc.includes('body.opened:not(.cover-opening) #coverBack{animation:coverBackIn'));
  t('reveal sudut lewat clip-path berjenjang (mirror tetap utuh)',
    undSrc.includes('.scr-frame .orn-c{clip-path:inset(0 100% 100% 0);transition:clip-path') &&
    undSrc.includes('body.opened .scr-frame .orn-c{clip-path:inset(0 0 0 0)}') &&
    undSrc.includes('.scr-frame .orn-c.tr{transition-delay:.25s,.25s}') &&
    undSrc.includes('.scr-frame .orn-c.br{transition-delay:.65s,.65s}'));
  t('napas pelan ornamen sudut ada',
    undSrc.includes('@keyframes scrNapas{') &&
    undSrc.includes('body.opened .scr-frame .orn-c svg{animation:scrNapas 7.5s ease-in-out 1.7s infinite}'));
  t('prefers-reduced-motion mematikan reveal, napas, dan gaya buka baru',
    undSrc.includes('.scr-frame .orn-c{transition:none!important}') &&
    undSrc.includes('body.opened .scr-frame .orn-c svg{animation:none!important}') &&
    undSrc.includes('#cover .bkl,#cover .bkt,.kt-burst i{animation:none!important;opacity:0!important}') &&
    undSrc.includes('body.buka-buku.opened #cover,body.buka-pintu.opened #cover,body.buka-kotak.opened #cover{opacity:0;visibility:hidden;transform:none') &&
    undSrc.includes('.cvcue,.cvcue i,.cdw .n.tick{animation:none}') &&
    undSrc.includes('body.opened #cover *,body.opened #cover *::before,body.opened #cover *::after{animation:none!important;transition:none!important}'));

  t('skin clip-path: iris diagonal & iris lingkaran',
    undSrc.includes('body.buka-iris #cover{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}') &&
    undSrc.includes('body.buka-iris.opened #cover{opacity:0;clip-path:polygon(0 0,0 0,0 0,0 0);transition:clip-path 1.12s') &&
    undSrc.includes('body.buka-lubang #cover{clip-path:circle(150% at 50% 50%)}') &&
    undSrc.includes('body.buka-lubang.opened #cover{opacity:0;clip-path:circle(0% at 50% 50%);transition:clip-path 1.06s'));
  t('skin jungkit drawbridge dari tepi bawah',
    undSrc.includes('body.buka-jungkit.opened #cover{opacity:0;transform-origin:50% 100%;transform:perspective(1200px) rotateX(94deg)'));
  t('panel & lajur membawa foto lewat --bukaImg (full foto tetap menyatu)',
    undSrc.includes('#cover .bkl{position:absolute;top:0;bottom:0;width:50.6%;display:none;opacity:0;pointer-events:none;background-image:var(--bukaImg,none),linear-gradient(165deg,var(--g0),var(--g1) 55%,var(--g2));background-size:200% 100%,200% 100%') &&
    undSrc.includes('#cover .bkt{position:absolute;left:0;right:0;height:50.6%;display:none;opacity:0;pointer-events:none;background-image:var(--bukaImg,none),linear-gradient(165deg,var(--g0),var(--g1) 55%,var(--g2));background-size:100% 200%,100% 200%') &&
    undSrc.includes('#cover .bld{position:absolute;left:0;right:0;height:25.6%;display:none;opacity:0;pointer-events:none;background-image:var(--bukaImg,none),linear-gradient(165deg,var(--g0),var(--g1) 55%,var(--g2));background-size:100% 400%,100% 400%') &&
    undSrc.includes("const bukaImg=(cvStyle==='full'&&fotoUtama)?`--bukaImg:url('") &&
    undSrc.includes('body.buka-pintu.opened #cover .cvlatar,body.buka-kotak.opened #cover .cvlatar,body.buka-blinds.opened #cover .cvlatar{opacity:0'));
  t('reduced-motion v3 mematikan skin baru',
    undSrc.includes('#cover .bld{animation:none!important;opacity:0!important}') &&
    undSrc.includes('body.buka-iris #cover,body.buka-lubang #cover{clip-path:none}'));

  /* ---------- 3. markup cover ---------- */
  t('cover memuat 4 panel buka', (undSrc.match(/<i class="bkl l"><\/i><i class="bkl r"><\/i><i class="bkt t"><\/i><i class="bkt b"><\/i>/) || []).length === 1);
  t('cover memuat 6 kelip letupan kotak', !!undSrc.match(/<span class="kt-burst" aria-hidden="true">(<i style="--dx:-?\d+px;--dy:-?\d+px"><\/i>){6}<\/span>/));
  t('cover memuat 4 lajur blinds', (undSrc.match(/<i class="bld b1"><\/i><i class="bld b2"><\/i><i class="bld b3"><\/i><i class="bld b4"><\/i>/) || []).length === 1);

  /* ---------- 4. render nyata per gaya ---------- */
  for (const gaya of ['buku', 'pintu', 'kotak']) {
    const r = await render(gaya);
    t('gaya ' + gaya + ': kelas tubuh buka-' + gaya, !r.err && r.kelasBuka.join(',') === 'buka-' + gaya, r.kelasBuka.join(',') + ' err=' + r.err);
    t('gaya ' + gaya + ': panel & kelip lahir di DOM cover', r.panel === 4 && r.burst === 6, r.panel + ' panel/' + r.burst + ' kelip');
  }
  for (const gaya of ['iris', 'lubang', 'blinds', 'jungkit']) {
    const r = await render(gaya);
    t('gaya ' + gaya + ': kelas tubuh buka-' + gaya, !r.err && r.kelasBuka.join(',') === 'buka-' + gaya, r.kelasBuka.join(',') + ' err=' + r.err);
    t('gaya ' + gaya + ': lajur blinds lahir di DOM', r.lajur === 4, r.lajur + ' lajur');
  }
  const rFoto = await render('pintu', 'full');
  const rPolos = await render('pintu');
  t('full foto: panel membawa potongan foto (--bukaImg terisi)',
    !!rFoto.coverStyle && rFoto.coverStyle.includes('--bukaImg:url('), String(rFoto.coverStyle));
  t('tanpa foto: --bukaImg kosong (gradasi tema dipakai)',
    !String(rPolos.coverStyle || '').includes('--bukaImg'), String(rPolos.coverStyle));
  const rTirai = await render('tirai');
  const rAsing = await render('palsu');
  t('gaya lama tirai tetap jalan', rTirai.kelasBuka.join(',') === 'buka-tirai', rTirai.kelasBuka.join(','));
  t('gaya asing jatuh ke default gilir', rAsing.kelasBuka.join(',') === 'buka-gilir', rAsing.kelasBuka.join(','));
  const rPhysical = await render('zoom', undefined, 'amplop');
  t('model Amplop mempertahankan animasi fisik dan meredam transisi ganda',
    rPhysical.kelasModel.includes('elbuka-amplop') && rPhysical.kelasBuka.join(',') === 'buka-fade',
    rPhysical.kelasModel.join(',') + ' / ' + rPhysical.kelasBuka.join(','));
  const rBook = await render('zoom', undefined, 'buku');
  t('model Buku tetap memakai efek perpindahan yang dipilih',
    rBook.kelasModel.includes('elbuka-buku') && rBook.kelasBuka.join(',') === 'buka-zoom',
    rBook.kelasModel.join(',') + ' / ' + rBook.kelasBuka.join(','));

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
