/* Uji "Bandingkan tema" — sekarang bagian dari Studio Template
   (studio-template.html), bukan lagi tab Desain di studio.html.

   Yang diuji (jsdom, offline):
   - tombol bandingkan membuka dialog dengan dua pratinjau: tema ASAL vs DRAF
   - kedua iframe memakai berkas renderer yang sama (undangan.html?preview=1)
   - menutup dialog membersihkan iframe & status tombol
   - studio isi data tidak lagi menyimpan kode bandingkan tema

   Jalankan: npm install --no-save jsdom && node tools/test-studio-theme-compare.cjs */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const HASH = '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';

const store = new Map();
const posted = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(String(e && e.message))) console.error(String(e.message)); });

const dom = new JSDOM(read('studio-template.html'), {
  url: 'https://studio.test/studio-template.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    w.Element.prototype.scrollIntoView = function () {};
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.fetch = async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) });
    /* iframe di jsdom tidak memuat dokumen; tangkap pesan yang akan dikirim. */
    const asli = w.HTMLIFrameElement.prototype;
    Object.defineProperty(w.HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() { return { postMessage: msg => posted.push({ el: this.__id || '', msg }) }; }
    });
    void asli;
    const ls = {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
      key: i => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; }
    };
    Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
    Object.defineProperty(w, 'sessionStorage', { value: ls, configurable: true });
  }
});
const w = dom.window;

try {
  store.set('asproject_studio_auth', HASH);
  for (const src of ['assets/tpl-data.js', 'assets/studio-core.js', 'assets/studio-template.js']) w.eval(read(src));

  /* buka satu template → draf aktif */
  w.document.querySelector('[data-open="tpl:luxury-gold"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert(w.document.querySelector('#editor [data-k="nama"]'), 'editor draf terbuka');

  /* bandingkan */
  w.document.querySelector('#btnBandingkan').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const dialog = w.document.querySelector('#compareWrap [role="dialog"]');
  assert(dialog, 'dialog bandingkan terbuka');
  assert.equal(w.document.querySelector('#compareWrap').hidden, false, 'overlay bandingkan tampil');

  const a = w.document.getElementById('cmpA');
  const b = w.document.getElementById('cmpB');
  assert(a && b, 'dua pratinjau tersedia');
  assert.equal(a.getAttribute('src'), 'undangan.html?preview=1', 'pratinjau A memakai renderer asli');
  assert.equal(b.getAttribute('src'), 'undangan.html?preview=1', 'pratinjau B memakai renderer asli');
  assert(/A · Luxury Gold/.test(dialog.textContent), 'sisi A diberi label tema asal');
  assert(/B · Luxury Gold/.test(dialog.textContent), 'sisi B diberi label draf');
  assert.equal(w.document.querySelector('#btnBandingkan').getAttribute('aria-pressed'), 'true', 'status tombol bandingkan aktif');

  /* pesan terkirim ke dua iframe: A = tema asal, B = tema draf */
  const baris = posted.filter(x => x.msg && x.msg.type === 'asproject:preview');
  assert(baris.length >= 2, 'payload pratinjau dikirim ke kedua sisi (' + baris.length + ')');
  const payload = baris.map(x => x.msg.row);
  assert(payload.some(r => r.data.tpl === 'luxury-gold'), 'sisi A memakai tema asal');
  assert(payload.some(r => /^custom-/.test(r.data.tpl)), 'sisi B memakai tema draf (custom-)');
  assert(payload.every(r => r.data.form && r.data.event), 'kedua sisi memakai data acara yang sama');

  /* tutup */
  w.document.querySelector('[data-act="tutupcmp"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(w.document.querySelector('#compareWrap').hidden, true, 'overlay tertutup');
  assert.equal(w.document.querySelector('#compareWrap').innerHTML, '', 'iframe dibersihkan saat ditutup');
  assert.equal(w.document.querySelector('#btnBandingkan').getAttribute('aria-pressed'), 'false', 'status tombol kembali');

  /* kode lama benar-benar pindah */
  const studio = read('studio.html');
  assert(!studio.includes('function toggleThemeComparison'), 'studio isi data tidak lagi punya bandingkan tema');
  assert(!studio.includes('function themeComparePanel'), 'panel bandingkan tema sudah dipindah');

  console.log('ok   bandingkan tema: 2 pratinjau (asal vs draf), payload benar, tutup bersih');
  console.log('ok   studio.html: fitur bandingkan tema sudah dipindahkan');
  console.log('\nRingkasan: 2 lulus, 0 gagal');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
dom.window.close();
