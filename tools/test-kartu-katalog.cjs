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
  /* ------------------------------------------------------------------ *
   * 7d. Kotak cincin: realistis (tutup miring + 2 cincin + bantal)
   * ------------------------------------------------------------------ */
  t('kotak cincin realistis: tutup beludru berkilau + bantal dalam + 2 cincin emas',
    undSrc.includes('transform:perspective(760px) rotateX(0deg);') &&
    undSrc.includes('radial-gradient(78% 140% at 32% -26%,rgba(255,255,255,.5)') &&
    undSrc.includes("body.elbuka-kotak #cover .pemicu .simpul::before{content:'';position:absolute;left:50%;top:-13px;") &&
    undSrc.includes('clip-path:polygon(50% 0,90% 36%,70% 100%,30% 100%,10% 36%);') &&
    undSrc.includes("body.elbuka-kotak #cover .pemicu .simpul::after{content:'';position:absolute;left:52px;top:-2px;"));
  t('kotak cincin: duduk di bawah cover & menyesuaikan frame pendek',
    undSrc.includes('top:auto;bottom:6%;') &&
    undSrc.includes('@media (max-height:760px){ body.elbuka-kotak #cover .pemicu{--k:.88} }') &&
    undSrc.includes('@media (max-height:680px){ body.elbuka-kotak #cover .pemicu{--k:.74} }') &&
    undSrc.includes('body.elbuka-kotak:not(.foto-full) #cover .pemicu{--k:.7;top:auto;bottom:9%;'));
  t('kotak cincin: teks cover SELALU tampil (tidak disembunyikan saat tertutup)',
    undSrc.includes('body.elbuka-kotak.foto-full #cover .bdfr{margin-bottom:clamp(190px,27vh,238px)}') &&
    !undSrc.includes('body.elbuka-kotak.foto-full:not(.opened) #cover .bdfr{opacity:0') &&
    undSrc.includes('body.elbuka-kotak.foto-full #cover .std-label{color:#fff;'));
  t('kotak cincin: tutup terangkat + cahaya emas, cover ditahan sampai adegan selesai',
    undSrc.includes('body.elbuka-kotak.opened #cover .pemicu{animation:kotakBoxOut .74s var(--ease-cover-soft) 1.02s both}') &&
    undSrc.includes('transform:perspective(760px) rotateX(-122deg);') &&
    undSrc.includes('@keyframes kotakCahaya{') &&
    undSrc.includes('opacity .55s ease 1.32s,visibility 0s linear 1.88s'));
  t('gembok transparan: badan & kunci memakai kaca ber-alpha, bukan emas pekat',
    undSrc.includes('body.elbuka-gembok #cover .pemicu .el{--ga:54%;--gb:34%;--gc:46%;') &&
    undSrc.includes('color-mix(in srgb,var(--accent-cover,var(--accent,#C9A86A)) var(--ga),transparent),') &&
    undSrc.includes('body.elbuka-gembok #cover .pemicu .simpul{--ka:78%;') &&
    undSrc.includes('body.elbuka-gembok.foto-full #cover .pemicu .simpul{\n  --ka:58%;top:44%;width:34%;margin-left:-17%;height:13px;'));
  t('animasi kunci dipecah per-segmen easing + cover ditahan sampai selesai',
    undSrc.includes('body.elbuka-gembok.opened #cover .pemicu .simpul{animation:kunciMasuk 1.88s linear forwards}') &&
    undSrc.includes('animation-timing-function:cubic-bezier(.42,0,.5,1)}') &&
    undSrc.includes('0%  {transform:translateY(0)     rotate(-30deg) scale(1);') &&
    undSrc.includes('opacity .5s ease 1.55s,visibility 0s linear 2.05s}') &&
    undSrc.includes('body.elbuka-gembok.foto-full.opened #cover .bdfr{animation:bdfrAmplop .4s ease 2.15s both}'));
  t('gembok foto penuh: kartu foto besar + nama tercetak (muat di 330x590)',
    undSrc.includes("const bukuKulit=(BUKA==='buku'||BUKA==='gerbang'||BUKA==='amplop'||BUKA==='gembok')") &&
    undSrc.includes('body.elbuka-gembok.foto-full #cover .pemicu{\n  width:min(340px,86%);height:min(440px,64%);') &&
    undSrc.includes('body.elbuka-gembok.foto-full #cover .pemicu .simpul{\n  top:46%;width:37%;height:14px;margin-left:-18.5%;z-index:3}') &&
    undSrc.includes('body.elbuka-gembok.foto-full #cover .pemicu .p-kulit{left:24px;right:24px;') &&
    undSrc.includes('body.elbuka-gembok.foto-full:not(.opened) #cover .bdfr{opacity:0!important;pointer-events:none}'));
  t('judul (nama mempelai + tanggal) tercetak di kulit buku, gerbang & amplop',
    undSrc.includes("const bukuKulit=(BUKA==='buku'||BUKA==='gerbang'||BUKA==='amplop'||BUKA==='gembok')") &&
    undSrc.includes('<i class="p-kulit-orn">') &&
    undSrc.includes('${bukuKulit}<span class="p-hint"'));
  t('teks cover di belakang buku/gerbang disembunyikan selama tertutup',
    undSrc.includes('body.elbuka-buku:not(.opened) #cover .bdfr,body.elbuka-gerbang:not(.opened) #cover .bdfr{opacity:0!important;pointer-events:none}') &&
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

  /* ------------------------------------------------------------------ *
   * 7. Pita: satin transparan (nama mempelai tidak tertutup)
   * ------------------------------------------------------------------ */
  t('pita memakai tint aksen semi-transparan + efek satin',
    undSrc.includes('color-mix(in srgb,var(--accent-cover,var(--accent,#A65066)) var(--pb),transparent) 42%') &&
    undSrc.includes('--pa:46%;--pb:28%;--pc:40%') &&
    undSrc.includes('-webkit-backdrop-filter:blur(1px) saturate(1.12);backdrop-filter:blur(1px) saturate(1.12);') &&
    undSrc.includes('body.elbuka-pita:not(.foto-full) #cover .pemicu .el{top:12px;height:22px;border-radius:11px;--pa:55%;--pb:34%;--pc:46%}') &&
    undSrc.includes('body.elbuka-pita:not(.foto-full) #cover .pemicu{top:12%;height:96px}'));
  t('foto penuh: pita dipindah ke atas cover (tidak menutupi wajah/nama)',
    undSrc.includes('body.elbuka-pita.foto-full #cover .pemicu{top:12%}') &&
    undSrc.includes('body.elbuka-pita.foto-full #cover .pemicu .el{top:46px;height:20px;border-radius:10px;') &&
    undSrc.includes('--pa:24%;--pb:12%;--pc:20%;') &&
    undSrc.includes('body.elbuka-pita.foto-full #cover .pemicu .simpul{top:41px;width:40px;height:40px;'));
  /* ------------------------------------------------------------------ *
   * 7b. Selendang: kain hanya di bagian atas + tembus pandang
   * ------------------------------------------------------------------ */
  t('selendang hanya menutup bagian atas (foto & teks cover tetap terlihat)',
    undSrc.includes('body.elbuka-selendang #cover .pemicu .el{position:absolute;inset:0 0 auto 0;') &&
    undSrc.includes('height:clamp(110px,18dvh,220px);') &&
    undSrc.includes('clip-path:polygon(0 0,100% 0,100% 86%,78% 100%,52% 88%,26% 99%,0 87%);') &&
    undSrc.includes('body.elbuka-selendang #cover .pemicu .el2,body.elbuka-selendang #cover .pemicu .simpul{position:absolute;top:0;bottom:auto;'));
  t('selendang memakai tint tembus pandang + aksen lebih bening saat foto penuh',
    undSrc.includes('linear-gradient(45deg,transparent 0 20px,color-mix(in srgb,var(--accent-cover,var(--accent,#7a3040)) 38%,rgba(212,175,55,.8)) 20px 21px)') &&
    undSrc.includes('body.elbuka-selendang.foto-full #cover .pemicu .el{--sa:30%;--sb:26%;--sc:12%;--sd:20%;') &&
    !undSrc.includes('body.elbuka-selendang #cover .pemicu .el{position:absolute;inset:0;background-image:radial-gradient(circle at 30% 18%,color-mix(in srgb,var(--accent-cover,var(--accent,#7a3040)) 70%,#fff)'));
  t('selendang dibuka dengan menarik kain KE ATAS + teks cover memudar',
    undSrc.includes('body.elbuka-selendang.opened #cover .pemicu .el{transform:translateY(-122%) rotateX(14deg) scaleY(1.03);opacity:0}') &&
    undSrc.includes('body.elbuka-selendang.opened #cover .bdfr{opacity:0;transition:opacity .38s var(--ease-cover-soft)}') &&
    undSrc.includes('body.elbuka-selendang.opened #cover{transition:transform 1.02s var(--ease-cover) .48s,opacity .62s ease 1.08s,visibility 0s linear 1.7s}'));

  /* ------------------------------------------------------------------ *
   * 8. Amplop: kartu kaca di tengah foto (bukan menutup seluruh layar)
   * ------------------------------------------------------------------ */
  t('amplop foto penuh tampil sebagai kartu kaca di tengah, bukan full layar',
    undSrc.includes('body.elbuka-amplop.foto-full #cover .pemicu{\n  left:50%;top:50%;transform:translate(-50%,-50%);') &&
    undSrc.includes('width:min(330px,82%);height:min(430px,62%);') &&
    undSrc.includes('body.elbuka-amplop.foto-full #cover .pemicu .el{--fa:26%;--fb:10%;--fc:18%;'));
  t('foto mempelai dicetak DI DALAM amplop (bukan kartu kaca kosong)',
    undSrc.includes('background-image:var(--fotoSampul,none);') &&
    undSrc.includes('background-size:cover;background-position:center 28%;background-repeat:no-repeat;') &&
    undSrc.includes('body.elbuka-amplop.foto-full #cover .pemicu::before{content:\'\';position:absolute;inset:6px;'));
  t('lipatan & badan amplop memakai tint kaca (alpha rendah), bukan gradasi pekat',
    undSrc.includes('color-mix(in srgb,var(--accent-cover,var(--accent,#A65066)) var(--fa),transparent),') &&
    undSrc.includes('color-mix(in srgb,var(--accent-cover,var(--accent,#A65066)) var(--fb),transparent) 60%,') &&
    undSrc.includes('body.elbuka-amplop.foto-full #cover .pemicu .el2{--fa:20%;--fb:8%;--fc:14%;') &&
    !undSrc.includes('color-mix(in srgb,var(--accent-cover,var(--accent,#A65066)) 62%,rgba(255,255,255,.42))'));
  t('nama mempelai + tanggal + petunjuk tercetak di badan amplop',
    undSrc.includes("const bukuKulit=(BUKA==='buku'||BUKA==='gerbang'||BUKA==='amplop'||BUKA==='gembok')") &&
    undSrc.includes('body.elbuka-amplop.foto-full #cover .pemicu .p-kulit{left:26px;right:26px;') &&
    undSrc.includes('body.elbuka-amplop.foto-full #cover .pemicu .p-hint{top:auto;left:50%;bottom:22px;'));
  t('teks cover di belakang amplop disembunyikan (menang atas animasi VIP)',
    undSrc.includes('body.elbuka-amplop.foto-full:not(.opened) #cover .bdfr{opacity:0!important;pointer-events:none}') &&
    undSrc.includes('body.elbuka-amplop.foto-full.opened #cover .bdfr{animation:bdfrAmplop .4s ease 1.4s both}'));
  t('foto penuh + panel jendela: panel putih hilang, foto mempelai kelihatan',
    undSrc.includes('body.foto-full #cover .cvband{\n  background:none;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}') &&
    undSrc.includes('body.foto-full #cover .cvband h1,body.foto-full #cover .cvband .amp,') &&
    undSrc.includes('body.foto-full #cover .cvband .date{background:rgba(18,14,10,.5);border-color:rgba(255,255,255,.3)}'));
  t('label "Ketuk pita" disembunyikan agar tidak menimpa nama/countdown',
    undSrc.includes('body.elbuka-pita #cover .pemicu .p-hint{display:none}') &&
    undSrc.includes('@keyframes simpulDenyut{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}') &&
    undSrc.includes('body.elbuka-pita:not(.opened) #cover .pemicu .simpul{animation:simpulDenyut 2.8s ease-in-out infinite}') &&
    undSrc.includes('body.elbuka-pita #cover .pemicu .simpul{animation:none!important}'));

  /* model minimal + foto penuh tidak boleh menyembunyikan foto */
  t('cvl-minimal hanya menyembunyikan foto bila bukan foto-penuh',
    undSrc.includes('body.cvl-minimal:not(.foto-full) #cover .cvf,body.cvl-minimal:not(.foto-full) #cover .cvlatar{display:none}') &&
    undSrc.includes('body.cvl-minimal:not(.foto-full) #cover .orn,body.cvl-minimal:not(.foto-full) #cover .cvf,body.cvl-minimal:not(.foto-full) #cover .cvlatar{display:none}') &&
    !undSrc.includes('body.cvl-minimal #cover .cvf,body.cvl-minimal #cover .cvlatar{display:none}'));

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exit(fail ? 1 : 0);
})();
