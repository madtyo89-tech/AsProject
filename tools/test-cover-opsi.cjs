#!/usr/bin/env node
/*
 * Regresi opsi cover yang tersedia sekarang:
 *   1. 15 layout cover, 4 ukuran foto, 9 model pembuka, dan 20 efek transisi
 *      memiliki daftar Studio/renderer yang sinkron;
 *   2. pilihan masuk ke payload preview dan tidak menumpuk kelas lama;
 *   3. pemicu buka live punya semantik aksesibel;
 *   4. floating preview dapat disegarkan, diperbesar, dan kembali ke cover.
 *
 * Jalankan: node tools/test-cover-opsi.cjs (butuh jsdom).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const und = baca('undangan.html');
const stu = baca('studio.html');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional */ }

let lulus = 0, gagal = 0;
const cek = (hasil, pesan) => {
  if (hasil) lulus++;
  else { gagal++; console.log('  [FAIL] ' + pesan); }
};
const ids = (teks, pola) => {
  const m = teks.match(pola);
  return m ? [...m[1].matchAll(/['"]([a-z0-9-]+)['"]/g)].map(x => x[1]) : [];
};

const arrayHeadIds = (teks, pola) => {
  const m = teks.match(pola);
  return m ? m[1].split(String.fromCharCode(10)).map(line => {
    const row = line.trim();
    return row.startsWith("['") ? row.slice(2).split("'")[0] : null;
  }).filter(Boolean) : [];
};

console.log('1) Registry Studio dan renderer');
const layoutStudio = arrayHeadIds(stu, /const CV_LAYOUTS=\[([\s\S]*?)\n\];/);
const layoutUnd = ids(und, /const CV_IDS=\[([^\]]*)\]/);
cek(layoutStudio.length === 15, `Studio mengenal 15 layout cover (dapat ${layoutStudio.length})`);
cek(JSON.stringify(layoutUnd) === JSON.stringify(layoutStudio), '15 layout cover identik di Studio dan renderer');

const sizeStudio = ids(stu, /const CV_UKURAN_ID=\[([^\]]*)\]/);
const sizeUnd = ids(und, /const CV_UKURAN=\[([^\]]*)\]/);
cek(JSON.stringify(sizeStudio) === JSON.stringify(['kecil', 'sedang', 'besar', 'jumbo']), 'Studio mengenal 4 ukuran foto cover');
cek(JSON.stringify(sizeUnd) === JSON.stringify(sizeStudio), 'renderer mengenal 4 ukuran yang sama persis');
for (const id of sizeStudio) {
  cek(und.includes(`body.cvsz-${id} #cover .cvf{`), `renderer punya aturan ukuran foto ${id}`);
}

const bukaStudio = ids(stu, /const CARA_BUKA_ID=\[([^\]]*)\]/);
const bukaUnd = ids(und, /const BUKA_IDS=\[([^\]]*)\]/);
const modelStyles = arrayHeadIds(stu, /const CARA_BUKA_STYLES=\[([\s\S]*?)\n\];/);
cek(bukaStudio.length === 9, `Studio mengenal 9 model cara buka (dapat ${bukaStudio.length})`);
cek(JSON.stringify(bukaUnd) === JSON.stringify(bukaStudio), 'model cara buka identik di Studio dan renderer');
cek(JSON.stringify(modelStyles) === JSON.stringify(bukaStudio), 'setiap model cara buka punya pilihan tampilan di Studio');
for (const id of bukaStudio) {
  cek(und.includes(`body.elbuka-${id}`), `renderer punya kulit pembuka ${id}`);
}

const fxStudio = arrayHeadIds(stu, /const FX_BUKA=\[([\s\S]*?)\];/);
const fxUnd = ids(und, /function fxBukaId\(AN\)\{const v=AN&&AN\.buka;return \[([^\]]*)\]/);
cek(fxStudio.length === 20, `Studio mengenal 20 efek perpindahan (dapat ${fxStudio.length})`);
cek(JSON.stringify(fxUnd) === JSON.stringify(fxStudio), '20 efek perpindahan identik di Studio dan renderer');
cek(stu.includes("onclick=\"setAnim('buka','") && und.includes('function fxBukaId(AN){const v=AN&&AN.buka;'),
  'pilihan transisi Studio dibaca renderer dari anim.buka');
cek(und.includes('animasi fisik') && stu.includes('fade agar animasi fisik tidak bertumpuk'),
  'kombinasi model fisik yang bertransisi fade dijelaskan di UI');
cek(!und.includes('const BTN_OPEN=') && !stu.includes('BTN_OPEN_ID') && !stu.includes('setCoverBtn('),
  'daftar gaya tombol lawas yang sudah diganti model pembuka tidak tertinggal');

console.log('\n2) Payload, layout live, dan pratinjau');
cek(stu.includes('function setCvLayout') && stu.includes("onclick=\"setCvLayout('") &&
  stu.includes('function setCvSize') && stu.includes("onclick=\"setCvSize('") &&
  stu.includes('function setBuka') && stu.includes("onclick=\"setBuka('") ,
  'Studio menyediakan pemilih layout, ukuran, dan model pembuka');
const boSampleCss = (stu.match(/\.bo-sample\{([^}]*)\}/) || [])[1] || '';
cek(boSampleCss.includes('max-width:100%') && boSampleCss.includes('white-space:normal') &&
  boSampleCss.includes('overflow-wrap:anywhere'),
  'label model pembuka membungkus di grid 3 kolom (mencegah overflow layar 430px)');
cek((stu.match(/coverSize:cvSizeId\(\)/g) || []).length >= 3,
  'ukuran foto ikut payload pratinjau, publish, dan file mandiri');
cek((stu.match(/buka:bukaId\(\)/g) || []).length >= 3,
  'model pembuka ikut payload pratinjau, publish, dan file mandiri');
cek((stu.match(/function pvKeCover\(\)/g) || []).length === 1 && stu.includes("postMessage({type:'asproject:cover'}"),
  'pilihan desain mengembalikan pratinjau ke cover');
cek(stu.includes('onclick="fpRefresh()"') && /function fpRefresh\(\)/.test(stu) &&
  stu.includes('layar.innerHTML=pvHtml()'), 'floating preview dapat dimuat ulang dengan iframe baru');
cek(stu.includes('fp-expand-btn') && stu.includes("eb.textContent=_fpExpanded?'⤡':'⤢'"),
  'ikon floating preview mengikuti status perbesar/perkecil');

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
    slug: 'demo', name1: 'Satrio', name2: 'Pandu', theme: 4,
    data: Object.assign({
      event: 'pernikahan', tpl: 'floral-rustic', buka: 'pita',
      form: { namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-12-28', jamAcara: '08:00', zona: 'WIB', venue: 'Bandung' },
      slides: {},
      anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up', navMode: 'slide', buka: 'gilir' },
      cover: 'foto.jpg', coverStyle: 'arch', coverPos: { x: 50, y: 50, z: 1 }, coverSize: 'sedang', coverLayout: 'amplop',
    }, tambahan),
  });
  w.eval('window.EMBEDDED_DATA=' + JSON.stringify(draft()) + ';');
  for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
  await new Promise(r => setTimeout(r, 300));
  return { dom, w, draft };
}

(async function main() {
  if (!JSDOM) {
    console.log('\nRenderer dan Studio DOM dilewati: jsdom belum terpasang.');
  } else {
    console.log('\n3) Renderer: pilihan cover dapat diganti tanpa sisa kelas');
    const { dom, w, draft } = await renderUndangan();
    w.boot(draft({ coverLayout: 'night', coverStyle: 'full', coverSize: 'jumbo', buka: 'gerbang' }));
    let cls = [...w.document.body.classList];
    cek(cls.includes('cvl-night') && cls.includes('cvsz-jumbo') && cls.includes('elbuka-gerbang') && cls.includes('foto-full'),
      'layout Langit Malam, foto jumbo, gerbang, dan Foto Penuh aktif');
    const trigger = w.document.querySelector('#cover #btnOpen');
    cek(!!trigger && trigger.getAttribute('role') === 'button' && trigger.getAttribute('tabindex') === '0' &&
      trigger.getAttribute('aria-label') === 'Buka undangan', 'pemicu buka live bisa keyboard dan punya nama aksesibel');

    w.boot(draft({ coverLayout: 'amplop', coverStyle: 'kotak', coverSize: 'kecil', buka: 'kotak' }));
    cls = [...w.document.body.classList];
    cek(!cls.some(c => c.startsWith('cvl-')), 'kembali ke Amplop Klasik tanpa sisa kelas layout lama');
    cek(!cls.includes('foto-full') && cls.includes('cvsz-kecil') && !cls.includes('cvsz-jumbo'),
      'gaya foto & ukuran berganti tanpa menumpuk kelas lama');
    cek(cls.includes('elbuka-kotak') && !cls.includes('elbuka-gerbang'), 'model pembuka berganti tanpa menumpuk kelas lama');
    cek(w.document.querySelectorAll('.nv-bar').length <= 1, 'bar navigasi slide tidak menumpuk saat render ulang');
    cek(String(w.document.documentElement.style.getPropertyValue('--btn-ink')).trim() !== '', '--btn-ink tema terpasang');
    dom.window.close();

    console.log('\n4) Studio: pemilih, payload, dan floating preview');
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
    cek(ws.document.querySelectorAll('.bo-btn').length === bukaStudio.length,
      `tab Desain menampilkan ${bukaStudio.length} model cara buka`);
    ws.setBuka('gerbang');
    cek(ws.eval('barisUndangan().data.buka') === 'gerbang', 'payload pratinjau membawa model Gerbang');
    cek(JSON.parse(ws.localStorage.getItem('asproject_studio_v3') || '{}').buka === 'gerbang', 'model Gerbang tersimpan pada draft lokal');
    ws.setAnim('buka', 'zoom');
    cek(ws.eval('barisUndangan().data.anim.buka') === 'zoom', 'payload pratinjau membawa efek perpindahan Zoom');

    ws.uploadCover({ files: [new ws.File(['x'], 'fotoku.png', { type: 'image/png' })] });
    await new Promise(r => setTimeout(r, 400));
    ws.set('tab', 'musik');
    cek(!!ws.document.querySelector('button[onclick="setCvSize(\'jumbo\')"]'), 'pemilih ukuran muncul setelah cover diunggah');
    ws.setCvSize('jumbo');
    cek(ws.eval('barisUndangan().data.coverSize') === 'jumbo', 'payload pratinjau membawa ukuran foto Jumbo');

    const tombolRefresh = ws.document.querySelector('.fp-actions button[onclick="fpRefresh()"]');
    cek(!!tombolRefresh && !!tombolRefresh.getAttribute('aria-label'), 'tombol refresh floating ada dan berlabel');
    const iframeLama = ws.document.querySelector('#floatPrev iframe.pv-frame');
    ws.fpRefresh();
    const iframeBaru = ws.document.querySelector('#floatPrev iframe.pv-frame');
    cek(!!iframeBaru && iframeBaru !== iframeLama && iframeBaru.getAttribute('src') === 'undangan.html?preview=1',
      'fpRefresh mengganti iframe floating dengan yang baru');
    ws.floatGo();
    cek(ws.document.querySelector('#floatPrev').classList.contains('fp-expanded') &&
      ws.document.querySelector('.fp-expand-btn').textContent === '⤡', 'perbesar: ikon berubah menjadi perkecil');
    ws.floatGo();
    cek(ws.document.querySelector('.fp-expand-btn').textContent === '⤢', 'perkecil: ikon kembali menjadi perbesar');

    const iframeFloat = ws.document.querySelector('#floatPrev iframe.pv-frame');
    const terkirim = [];
    Object.defineProperty(iframeFloat, 'contentWindow', {
      configurable: true, value: { postMessage: m => terkirim.push(m), scrollTo() {} },
    });
    ws.setCvLayout('sakura');
    cek(terkirim.some(m => m.type === 'asproject:cover'), 'ganti layout memerintahkan pratinjau kembali ke cover');
    cek(ws.eval('barisUndangan().data.coverLayout') === 'sakura', 'payload membawa layout Sakura');
    domS.window.close();
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
