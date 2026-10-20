/* Uji halaman Katalog Template & Arsip di studio.html (jsdom, offline):
   - tombol "← Kembali ke Editor" + "☰ Template & Menu" ada di Katalog & Arsip (dulu tidak ada → terjebak di HP)
   - goPage() menutup menu HP, kembali ke editor
   - tombol 🗑 Hapus per baris: baris buatan sendiri hilang; tema bawaan hilang DAN tidak kembali setelah
     halaman dibuka ulang (tombstone katalogDel); "Pulihkan Bawaan" mengembalikannya
   - baris katalog memakai kelas responsif (.kat-row dkk) — bukan flex satu baris yang remuk di layar HP
   Jalankan: node tools/test-katalog-admin.cjs   (butuh: npm i jsdom) */
'use strict';
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AUTH = ['asproject_studio_auth', '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e'];

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

/* satu "sesi browser": localStorage dibawa antar boot supaya bisa meniru buka-ulang halaman */
const store = new Map();
function boot() {
  const vc = new VirtualConsole();                      // buang "Not implemented: pause()/scrollTo()" milik jsdom
  vc.on('error', m => console.error(m)); vc.on('warn', () => {}); vc.on('log', m => console.log(m));
  vc.on('jsdomError', e => { if (!/Not implemented/.test(String(e && e.message))) console.error(e); });
  const dom = new JSDOM(read('studio.html'), {
    runScripts: 'dangerously', url: 'https://x.test/studio.html', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } };
      if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) });
      w.Element.prototype.scrollIntoView = function () {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.confirm = () => true;
      // localStorage bersama antar boot
      const ls = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k),
        clear: () => store.clear(),
        key: i => Array.from(store.keys())[i] ?? null,
        get length() { return store.size },
      };
      Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
      try { w.eval(read('assets/scroll-effects.js')); } catch (e) {}
      if (typeof w.clearScrollReveal !== 'function') w.clearScrollReveal = () => {};
      try { w.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w.eval(read('assets/vip-4d.js')); } catch (e) {}
    },
  });
  return dom.window;
}

(async () => {
  store.set(AUTH[0], AUTH[1]);
  const errs = [];
  let w = boot();
  w.addEventListener('error', e => errs.push(String(e.message)));
  await sleep(250);
  w.eval('if(!state.started)startInvitation()');
  const $ = sel => w.document.querySelector(sel);
  const $$ = sel => Array.from(w.document.querySelectorAll(sel));

  /* ---------- 1) Kembali dari Katalog & Arsip ---------- */
  console.log('— Navigasi Katalog / Arsip —');
  w.document.body.classList.add('studio-nav-open');              // menu HP terbuka
  w.eval("goPage('katalog')");
  t('katalog: state.page = katalog', w.eval("state.page") === 'katalog');
  t('katalog: menu HP tertutup setelah pindah halaman', !w.document.body.classList.contains('studio-nav-open'));
  t('katalog: ada tombol ← Kembali ke Editor', $$('.page-actions button').some(b => /Kembali ke Editor/.test(b.textContent)));
  t('katalog: ada tombol ☰ Template & Menu', !!$('.page-actions .mobile-menu'));
  t('katalog: menu sidebar memakai goPage (bukan set)', $$('.menubtn').every(b => /goPage\(/.test(b.getAttribute('onclick') || '')));
  const back = $$('.page-actions button').find(b => /Kembali ke Editor/.test(b.textContent));
  back.click();
  t('katalog → Kembali: state.page = editor & editor tampil', w.eval("state.page") === 'editor' && !!$('.tabbar'));

  w.eval("goPage('arsip')");
  t('arsip: ada tombol ← Kembali ke Editor', $$('.page-actions button').some(b => /Kembali ke Editor/.test(b.textContent)));
  t('arsip: ada tombol ☰ Template & Menu', !!$('.page-actions .mobile-menu'));
  w.eval("goPage('editor')");
  t('editor: tidak ada toolbar halaman ganda', $$('.page-actions').length === 0 && $$('.editor-actions').length === 1);

  /* ---------- 2) Baris katalog responsif ---------- */
  console.log('— Baris katalog —');
  w.eval("goPage('katalog')");
  const n0 = w.eval('state.katalog.length');
  const nTPL = w.eval('TPL.filter(t=>!t.studioOnly).length');
  t('katalog: semua tema publik punya baris bawaan; Arch Studio-only dikecualikan', n0 === nTPL, n0 + ' vs ' + nTPL);
  t('katalog: enam Arch tanpa harga tidak masuk daftar pemasaran', w.eval('TPL.filter(t=>t.studioOnly&&t.arch).length') === 6 && w.eval('TPL.filter(t=>t.studioOnly&&t.arch).every(t=>!Object.prototype.hasOwnProperty.call(t,"harga"))') && w.eval('state.katalog.every(k=>!TPL.find(t=>t.id===k.tpl)?.studioOnly)'));
  t('katalog: tema baru sudah publik, hanya 6 Arch yang tetap Studio-only', w.eval('TPL.filter(t=>t.studioOnly&&!t.arch).length') === 0 && w.eval('TPL.filter(t=>t.studioOnly).length') === 6);
  const activeTpl = w.eval('state.tpl');
  w.eval("state.tpl='gerbang-rosewood';save()");
  const countBeforeStudioOnlyAdd = w.eval('state.katalog.length');
  w.eval('addKat()');
  t('addKat: menolak varian Studio-only dari Katalog Harga & Promo', w.eval('state.katalog.length') === countBeforeStudioOnlyAdd);
  w.eval('state.tpl=' + JSON.stringify(activeTpl) + ';save()');
  const rows = $$('.kat-row');
  t('katalog: baris memakai kelas .kat-row', rows.length > 0);
  t('katalog: tiap baris punya thumb, nama, harga, promo, badge, aksi',
    rows.every(r => r.querySelector('.kat-thumb') && r.querySelector('.kat-main input') && r.querySelectorAll('.kat-price input').length === 2
      && r.querySelector('.kat-promo input[type=checkbox]') && r.querySelector('.kat-badge') && r.querySelector('.kat-acts')));
  t('katalog: tiap baris punya tombol 🗑 Hapus', rows.every(r => r.querySelector('.kat-acts .sm-btn.del')));
  t('katalog: tombol 👁️ dan Preview masih ada', rows.every(r => r.querySelectorAll('.kat-acts .sm-btn').length === 3));
  const css = read('studio.html');
  t('css: baris katalog bertumpuk sebagai bawaan (flex-wrap) — aman di HP & kolom desktop 480px', /\.kat-row\{[^}]*flex-wrap:wrap/.test(css));
  t('css: satu baris penuh hanya lewat container query lebar daftar (bukan lebar layar)', /@container kat \(min-width:\d+px\)\{\s*\.kat-row\{flex-wrap:nowrap/.test(css) && /\.kat-list\{container-type:inline-size/.test(css));
  t('katalog: kartu daftar memakai .kat-list (container query)', !!$('.card.kat-list .kat-row'));
  t('css: toolbar halaman .page-actions sticky', /\.page-actions\{position:sticky/.test(css));
  t('katalog: tidak ada baris dengan style flex inline lama', !css.includes('<div style="padding:12px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #f0f0f0;${hid'));

  /* ---------- 3) Tambah & hapus baris buatan sendiri ---------- */
  console.log('— Tambah / hapus baris —');
  w.eval('addKat()');
  const n1 = w.eval('state.katalog.length');
  t('addKat: baris bertambah 1', n1 === n0 + 1, n1 + ' vs ' + (n0 + 1));
  const baruId = w.eval('state.katalog[0].id');
  t('addKat: baris baru di paling atas, id custom (k…)', /^k\d+$/.test(baruId), baruId);
  t('addKat: baris baru tampil & punya tombol hapus', !!$(`.kat-row[data-kid="${baruId}"] .sm-btn.del`));
  $(`.kat-row[data-kid="${baruId}"] .sm-btn.del`).click();
  t('delKat (custom): baris hilang', w.eval('state.katalog.length') === n0 && !w.eval(`state.katalog.some(k=>k.id==='${baruId}')`));
  t('delKat (custom): tidak dicatat sebagai tombstone', w.eval('state.katalogDel.length') === 0);

  /* confirm ditolak → tidak dihapus */
  w.confirm = () => false;
  w.eval('addKat()');
  const batalId = w.eval('state.katalog[0].id');
  w.eval(`delKat('${batalId}')`);
  t('delKat: batal di konfirmasi → baris tetap ada', w.eval(`state.katalog.some(k=>k.id==='${batalId}')`));
  w.confirm = () => true;
  w.eval(`delKat('${batalId}')`);

  /* ---------- 4) Hapus tema bawaan + buka ulang halaman ---------- */
  console.log('— Hapus tema bawaan & buka ulang —');
  const bawaan = w.eval('TPL.filter(t=>!t.studioOnly).slice(-1)[0].id'); // tema publik bawaan terakhir
  w.eval(`delKat('${bawaan}')`);
  t('delKat (bawaan): baris hilang', !w.eval(`state.katalog.some(k=>k.id==='${bawaan}')`));
  t('delKat (bawaan): dicatat di katalogDel', w.eval(`state.katalogDel.includes('${bawaan}')`));
  t('delKat (bawaan): tema masih bisa dipilih di Studio (katalogHide tidak disentuh)', w.eval(`tplsFor(TPL.find(t=>t.id==='${bawaan}').ev==='all'?'pernikahan':TPL.find(t=>t.id==='${bawaan}').ev).some(x=>x.id==='${bawaan}')`));
  t('katalog: tombol Pulihkan Bawaan muncul dengan hitungan', $$('.kat-head-acts button').some(b => /Pulihkan Bawaan \(1\)/.test(b.textContent)));
  const sidebarCount = $$('.menubtn').find(b => /Katalog Template/.test(b.textContent)).querySelector('.chip').textContent.trim();
  t('sidebar: hitungan katalog ikut berkurang', Number(sidebarCount) === n0 - 1, sidebarCount);

  // buka ulang halaman: localStorage sama, DOM baru
  w.close();
  w = boot();
  w.addEventListener('error', e => errs.push(String(e.message)));
  await sleep(250);
  t('buka ulang: tema bawaan yang dihapus TIDAK kembali', !w.eval(`state.katalog.some(k=>k.id==='${bawaan}')`));
  t('buka ulang: baris lain tetap lengkap', w.eval('state.katalog.length') === n0 - 1, w.eval('state.katalog.length') + ' vs ' + (n0 - 1));
  t('buka ulang: halaman tetap Katalog (page tersimpan) & tombol kembali tersedia',
    w.eval('state.page') === 'katalog' && Array.from(w.document.querySelectorAll('.page-actions button')).some(b => /Kembali ke Editor/.test(b.textContent)));

  // pulihkan
  w.eval('pulihkanKat()');
  t('pulihkanKat: tema bawaan kembali', w.eval(`state.katalog.some(k=>k.id==='${bawaan}')`));
  t('pulihkanKat: katalogDel kosong & tombol Pulihkan hilang', w.eval('state.katalogDel.length') === 0
    && !Array.from(w.document.querySelectorAll('.kat-head-acts button')).some(b => /Pulihkan/.test(b.textContent)));
  t('pulihkanKat: jumlah baris kembali penuh', w.eval('state.katalog.length') === n0);

  /* ---------- 5) Hapus semua → katalog kosong + tombol pulihkan; Undangan Baru mempertahankan katalogDel ---------- */
  console.log('— Katalog kosong & Undangan Baru —');
  w.eval('state.katalog.slice().forEach(k=>delKat(k.id))');
  t('hapus semua: katalog kosong', w.eval('state.katalog.length') === 0);
  t('hapus semua: tampil pesan kosong + tombol pulihkan', !!w.document.querySelector('.kat-empty button'));
  w.eval('startInvitation()');
  t('Undangan Baru: katalogDel ikut dipertahankan', w.eval('state.katalogDel.length') === nTPL);
  w.close();
  w = boot();
  await sleep(250);
  t('buka ulang setelah hapus semua: katalog tetap kosong (tidak diisi ulang paksa)', w.eval('state.katalog.length') === 0);
  w.eval('pulihkanKat()');
  t('pulihkanKat setelah kosong: semua tema bawaan kembali', w.eval('state.katalog.length') === nTPL);

  t('tidak ada error JS selama uji', errs.length === 0, errs.join(' | '));
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
