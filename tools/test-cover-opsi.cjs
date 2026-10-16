#!/usr/bin/env node
/*
 * Uji opsi cover baru (keluhan pemilik 2026-10-15):
 *   1. ukuran foto cover bisa dipilih (kecil/sedang/besar/jumbo), bawaan
 *      "sedang" lebih besar dari ukuran lama;
 *   2. tombol "Buka Undangan" selalu di tengah di semua model cover;
 *   3. floating preview bisa dimuat ulang manual (tombol ⟳ / fpRefresh);
 *   4. pilihan cover (model/gaya/ukuran/tombol) benar-benar tampil di
 *      floating preview — render ulang tidak meninggalkan kelas lama;
 *   5. gaya tombol buka amplop: 13 pilihan yang sama di Studio & renderer.
 *
 *   node tools/test-cover-opsi.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional */ }

let lulus = 0, gagal = 0;
const cek = (hasil, pesan) => { hasil ? (lulus++) : (gagal++, console.log('  [FAIL] ' + pesan)); };

const und = baca('undangan.html');
const stu = baca('studio.html');

/* ------------------------------------------------ 1. daftar pilihan sama */
console.log('1) Daftar ukuran foto & gaya tombol identik di Studio dan renderer');
const ambilId = (teks, pola) => { const m = teks.match(pola); return m ? [...m[1].matchAll(/'([a-z-]+)'/g)].map(x => x[1]) : []; };
const ukuranStudio = ambilId(stu, /const CV_UKURAN_ID=\[([^\]]*)\]/);
const ukuranUnd = ambilId(und, /const CV_UKURAN=\[([^\]]*)\]/);
cek(JSON.stringify(ukuranStudio) === JSON.stringify(['kecil', 'sedang', 'besar', 'jumbo']), 'Studio mengenal 4 ukuran foto cover');
cek(JSON.stringify(ukuranUnd) === JSON.stringify(ukuranStudio), 'renderer mengenal 4 ukuran yang sama persis');

const btnStudio = ambilId(stu, /const BTN_OPEN_ID=\[([^\]]*)\]/);
const btnUnd = ambilId(und, /const BTN_OPEN=\[([^\]]*)\]/);
cek(btnStudio.length >= 10 && btnStudio.length <= 15, `pilihan tombol buka ada ${btnStudio.length} (rentang 10-15)`);
cek(JSON.stringify(btnUnd) === JSON.stringify(btnStudio), 'renderer mengenal gaya tombol yang sama persis');
for (const id of btnStudio) {
  if (id === 'amplop') continue;
  cek(und.includes(`body.btnopen-${id} #cover .open`), `undangan.html: CSS gaya tombol "${id}" ada`);
  cek(stu.includes(`.bo-${id}{`) || stu.includes(`.bo-${id} `), `studio.html: contoh gaya tombol "${id}" ada di pemilih`);
}
cek(/body:not\(\.btnopen-amplop\) #cover \.open/.test(und), 'gaya non-amplop mereset flap + segel amplop');

/* Efek membuka cover ikut ditambah: 13 transisi yang sama di kedua berkas. */
const fxStudio = ambilId(stu, /const FX_BUKA=\[([\s\S]*?)\];/);
const fxUnd = ambilId(und, /const v=AN&&AN\.buka;return \[([^\]]*)\]/);
cek(fxStudio.length === 20, `efek membuka cover ada ${fxStudio.length} pilihan (kini 20)`);
cek(JSON.stringify(fxUnd) === JSON.stringify(fxStudio), 'daftar efek membuka cover identik di Studio & renderer');
for (const id of fxStudio) {
  /* Selector boleh berkelompok (mis. beberapa gaya berbagi satu aturan),
     jadi cukup cocokkan sampai koma atau kurung buka. */
  cek(new RegExp('body\\.buka-' + id + '\\.opened #cover[,{]').test(und),
    `undangan.html: transisi membuka "${id}" ada`);
}

/* ------------------------------------------------ 2. ukuran & tengah */
console.log('\n2) Ukuran foto membesar + tombol selalu di tengah');
for (const id of ukuranStudio) {
  cek(und.includes(`body.cvsz-${id} #cover .cvf{`), `undangan.html: aturan lebar foto "${id}" ada`);
}
cek(/body\.cvsz-sedang #cover \.cvf\{width:min\(56vw,210px\)\}/.test(und),
  'ukuran bawaan "sedang" (210px) lebih besar dari ukuran lama (170px)');
cek(/body\.cvsz-sedang #content \.couple-foto\.tunggal \.cf\{width:min\(164px,44vw\)\}/.test(und)
  && /body\.cvsz-jumbo #content \.couple-foto\.tunggal \.cf\{width:min\(228px,60vw\)\}/.test(und),
  'pilihan ukuran juga membesarkan foto profil di dalam undangan (dulu dikunci 112px)');
cek(/body #cover \.inner \.open\{display:flex;margin-left:auto;margin-right:auto/.test(und),
  'tombol buka adalah flex block-level dengan margin-inline:auto (selalu di tengah, termasuk model Editorial rata kiri)');
cek(stu.includes('function setCvSize') && stu.includes("onclick=\"setCvSize('"), 'Studio: pemilih ukuran foto terpasang');
cek(stu.includes('function setCoverBtn') && stu.includes('onclick="setCoverBtn(\''), 'Studio: pemilih gaya tombol terpasang');
cek((stu.match(/coverSize:cvSizeId\(\)/g) || []).length >= 3, 'ukuran foto ikut payload pratinjau, publish, dan file mandiri');
cek((stu.match(/coverBtn:coverBtnId\(\)/g) || []).length >= 3, 'gaya tombol ikut payload pratinjau, publish, dan file mandiri');

/* ------------------------------------------------ 3. floating refresh */
console.log('\n3) Floating preview: refresh manual + ikon perbesar tidak basi');
cek(stu.includes('onclick="fpRefresh()"'), 'header floating punya tombol muat ulang manual (⟳)');
cek(/function fpRefresh\(\)/.test(stu), 'fpRefresh() tersedia');
cek(stu.includes("layar.innerHTML=pvHtml()"), 'fpRefresh memasang iframe baru (keadaan macet dibuang)');
cek(stu.includes('fp-expand-btn') && stu.includes("eb.textContent=_fpExpanded?'⤡':'⤢'"),
  'ikon tombol perbesar diperbarui mengikuti keadaan terakhir');
cek(stu.includes('function pvKeCover()'), 'pilihan cover mengembalikan pratinjau ke cover agar terlihat');
cek(/bootBersihkan\(\)/.test(und) && und.includes("'.nv-bar,.gal-lb,#aspAmbient'"),
  'render ulang membersihkan kelas & elemen body lama (biang pilihan cover tidak tampil)');

/* ------------------------------------------------ 4. render renderer */
async function renderUndangan(data) {
  const dom = new JSDOM(und, {
    url: 'https://asproject.my.id/undangan.html?preview=1',
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.fetch = () => Promise.reject(new Error('offline'));
  for (const aset of ['assets/scroll-effects.js', 'assets/theme-contrast.js', 'assets/button-help.js']) w.eval(baca(aset));
  const draft = (tambahan = {}) => ({
    slug: 'demo', name1: 'Satrio', name2: '', theme: 5,
    data: Object.assign({
      event: 'khitanan', tpl: 'islamic-elegant', doa: 'khitanan',
      form: { namaAnak: 'Satrio', tanggalAcara: '2026-12-28', jamAcara: '08:00', zona: 'WIB', venue: 'Bandung', showBismillah: false },
      slides: {}, anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up', navMode: 'slide' },
      cover: 'foto.jpg', coverStyle: 'arch', coverPos: { x: 50, y: 50, z: 1 },
    }, tambahan),
  });
  w.eval('window.EMBEDDED_DATA=' + JSON.stringify(draft()) + ';');
  for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
  await new Promise(r => setTimeout(r, 300));
  return { dom, w, draft };
}

(async function main() {
  if (JSDOM) {
    console.log('\n4) Renderer: ganti pilihan cover berulang kali tanpa sisa kelas lama');
    const { dom, w, draft } = await renderUndangan();
    w.boot(draft({ coverLayout: 'night', coverStyle: 'full', coverSize: 'jumbo', coverBtn: 'neon' }));
    let cls = [...w.document.body.classList];
    cek(cls.includes('cvl-night') && cls.includes('cvsz-jumbo') && cls.includes('btnopen-neon') && cls.includes('foto-full'),
      'pilihan pertama terpasang (night + jumbo + neon + foto penuh)');
    cek(!!w.document.querySelector('#btnOpen'), 'tombol Buka Undangan ter-render');

    w.boot(draft({ coverLayout: 'amplop', coverStyle: 'kotak', coverSize: 'kecil', coverBtn: 'pil' }));
    cls = [...w.document.body.classList];
    cek(!cls.some(c => c.startsWith('cvl-')), 'kembali ke Amplop Klasik: tidak ada sisa kelas model cover lama');
    cek(!cls.includes('foto-full'), 'ganti dari Foto Penuh: kelas foto-full hilang');
    cek(cls.includes('cvsz-kecil') && !cls.includes('cvsz-jumbo'), 'ukuran foto berganti kecil (bukan menumpuk)');
    cek(cls.includes('btnopen-pil') && !cls.includes('btnopen-neon'), 'gaya tombol berganti pil (bukan menumpuk)');
    cek(w.document.querySelectorAll('.nv-bar').length <= 1, 'bar navigasi slide tidak menumpuk tiap render ulang');
    cek(String(w.document.documentElement.style.getPropertyValue('--btn-ink')).trim() !== '', '--btn-ink terpasang untuk gaya tombol berwarna tema');
    dom.window.close();

    /* ------------------------------------------------ 5. studio jsdom */
    console.log('\n5) Studio: pemilih bekerja dan payload + floating refresh berfungsi');
    const domS = new JSDOM(stu, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const ws = domS.window;
    ws.HTMLMediaElement.prototype.pause = () => {};
    ws.HTMLMediaElement.prototype.play = () => Promise.resolve();
    ws.scrollTo = () => {};
    ws.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    ws.eval(baca('assets/scroll-effects.js'));
    for (const tag of ws.document.querySelectorAll('script:not([src])')) ws.eval(tag.textContent);
    ws.startInvitation();

    ws.set('tab', 'desain');
    cek(ws.document.querySelectorAll('.bo-btn').length === btnStudio.length, `tab Desain menampilkan ${btnStudio.length} pilihan tombol`);
    ws.setCoverBtn('neon');
    cek(ws.eval('barisUndangan().data.coverBtn') === 'neon', 'payload pratinjau membawa gaya tombol neon');
    cek(JSON.parse(ws.localStorage.getItem('asproject_studio_v3') || '{}').coverBtn === 'neon', 'gaya tombol tersimpan di draft');

    ws.uploadCover({ files: [new ws.File(['x'], 'fotoku.png', { type: 'image/png' })] });
    await new Promise(r => setTimeout(r, 400));
    ws.set('tab', 'musik');
    cek(!!ws.document.querySelector('button[onclick="setCvSize(\'jumbo\')"]'), 'tab Musik & Galeri menampilkan pemilih ukuran foto');
    ws.setCvSize('jumbo');
    cek(ws.eval('barisUndangan().data.coverSize') === 'jumbo', 'payload pratinjau membawa ukuran foto jumbo');

    const tombolRefresh = ws.document.querySelector('.fp-actions button[onclick="fpRefresh()"]');
    cek(!!tombolRefresh && !!tombolRefresh.getAttribute('aria-label'), 'tombol ⟳ floating ada dan berlabel');
    const iframeLama = ws.document.querySelector('#floatPrev iframe.pv-frame');
    ws.fpRefresh();
    const iframeBaru = ws.document.querySelector('#floatPrev iframe.pv-frame');
    cek(!!iframeBaru && iframeBaru !== iframeLama && iframeBaru.getAttribute('src') === 'undangan.html?preview=1',
      'fpRefresh mengganti iframe floating dengan yang baru (sumber sama)');
    ws.floatGo();
    cek(ws.document.querySelector('#floatPrev').classList.contains('fp-expanded')
      && ws.document.querySelector('.fp-expand-btn').textContent === '⤡', 'perbesar: ikon berubah menjadi perkecil');
    ws.floatGo();
    cek(ws.document.querySelector('.fp-expand-btn').textContent === '⤢', 'perkecil: ikon kembali menjadi perbesar');

    /* Pilihan cover mengirim perintah kembali-ke-cover ke iframe melayang. */
    const iframeFloat = ws.document.querySelector('#floatPrev iframe.pv-frame');
    const terkirim = [];
    Object.defineProperty(iframeFloat, 'contentWindow', { configurable: true, value: { postMessage: m => terkirim.push(m), scrollTo() {} } });
    ws.setCvLayout('sakura');
    cek(terkirim.some(m => m.type === 'asproject:cover'), 'ganti model cover: pratinjau diperintah kembali ke cover');
    cek(ws.eval('barisUndangan().data.coverLayout') === 'sakura', 'payload membawa model cover sakura');
    domS.window.close();
  } else {
    console.log('\n4-5) dilewati: jsdom belum terpasang');
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
