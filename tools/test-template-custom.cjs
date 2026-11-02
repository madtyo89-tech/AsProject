/* Uji Studio Template (menggantikan uji "template kustom di studio.html").
   Sejak 2026-11-01 pembuatan/penyuntingan tema pindah ke studio-template.html
   supaya studio isi data tidak bisa mengubah template produksi.

   Yang diuji (jsdom, offline):
   - 44 tema dari assets/tpl-data.js tampil di daftar
   - memilih template = membuat SALINAN draf; daftar tema asli tetap 44
   - draf tersimpan di perangkat, bisa diganti nama, diduplikasi, dihapus
   - ekspor token / entri template.js memakai slug draf
   - "Kirim ke Setting Katalog" menulis daftar tunggu, bukan mengubah produksi

   Jalankan: node tools/test-template-custom.cjs   (butuh: npm i jsdom) */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HASH = '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

const store = new Map();
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(String(e && e.message))) console.error(String(e.message)); });

const dom = new JSDOM(read('studio-template.html'), {
  runScripts: 'dangerously', url: 'https://x.test/studio-template.html', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.Element.prototype.scrollIntoView = function () {};
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.confirm = () => true;
    w.fetch = async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) });
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
const d = w.document;
store.set('asproject_studio_auth', HASH);

for (const src of ['assets/tpl-data.js', 'assets/studio-core.js', 'assets/studio-template.js']) w.eval(read(src));

(async () => {
  const tplAsli = w.eval('window.ASP_TPL.length');
  t('studio-template: daftar tema dibaca dari tpl-data.js', tplAsli === 44, tplAsli + ' tema');
  t('studio-template: gerbang sandi terbuka dengan sesi tersimpan', !d.querySelector('.asp-gate') && !d.documentElement.classList.contains('asp-locked'));

  const items = d.querySelectorAll('#daftarTema [data-open]');
  t('studio-template: 44 tema tampil di sidebar', items.length === 44, items.length + ' baris');

  /* pilih template → salinan draf */
  const baris = d.querySelector('[data-open="tpl:luxury-gold"]');
  baris.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t('memilih template membuka editor draf', !!d.querySelector('#editor [data-k="nama"]'), 'editor tidak tampil');
  t('judul editor memakai nama template asal', (d.querySelector('#editor h2') || {}).textContent === 'Luxury Gold');
  await sleep(400);
  const db1 = JSON.parse(store.get('asproject_studio_template_v1') || '{}');
  t('draf pertama tersimpan di perangkat', (db1.drafts || []).length === 1, JSON.stringify((db1.drafts || []).length));
  t('template asli tidak bertambah/berubah', w.eval('window.ASP_TPL.length') === 44);
  t('draf memakai id custom- (dikenal renderer live)', /^custom-/.test((db1.drafts || [{}])[0].id || ''), (db1.drafts || [{}])[0].id);

  /* ganti nama + simpan */
  const nama = d.querySelector('#editor [data-k="nama"]');
  nama.value = 'Gold Uji';
  nama.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(400);
  const db2 = JSON.parse(store.get('asproject_studio_template_v1') || '{}');
  t('perubahan nama ikut tersimpan', (db2.drafts || [])[0].nama === 'Gold Uji', JSON.stringify((db2.drafts || [])[0].nama));
  t('label pratinjau mengikuti nama draf', (d.querySelector('#pvLabel') || {}).textContent.includes('Gold Uji'));

  /* ekspor */
  d.querySelector('[data-export="token"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const kodeToken = (d.querySelector('#kodeEkspor') || {}).textContent || '';
  t('ekspor token memakai slug draf', kodeToken.includes("'luxury-gold'") && kodeToken.includes('kerangka/token-tema.js'), kodeToken.slice(0, 60));
  d.querySelector('[data-export="template"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const kodeTpl = (d.querySelector('#kodeEkspor') || {}).textContent || '';
  t('ekspor entri template.js menyertakan shell & susunan', kodeTpl.includes('"shell"') && kodeTpl.includes('"susunan"'), kodeTpl.slice(0, 70));
  t('ekspor tidak menyuruh menyunting berkas hasil generator',
    ((d.querySelector('#kartuEkspor') || {}).textContent || '').includes('kerangka/'));

  /* duplikat */
  d.querySelector('[data-act="duplikat"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const db3 = JSON.parse(store.get('asproject_studio_template_v1') || '{}');
  t('duplikat menambah draf (bukan mengubah template asli)', (db3.drafts || []).length === 2, (db3.drafts || []).length + ' draf');
  t('nama salinan ditandai', (db3.drafts || []).some(x => /Salinan/.test(x.nama)));

  /* kirim ke setting katalog */
  store.set('asproject_katalog_setting_v1', JSON.stringify({}));
  d.querySelector('[data-act="katalog"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const kat = JSON.parse(store.get('asproject_katalog_setting_v1') || '{}');
  t('kirim ke Setting Katalog menulis daftar tunggu', Array.isArray(kat.pending) && kat.pending.length === 1, JSON.stringify(kat.pending || null));
  t('tema kiriman belum dianggap template produksi', w.eval("window.ASP_TPL.some(t=>t.id==='" + ((kat.pending || [{}])[0].id || '') + "')") === false);

  /* hapus draf */
  d.querySelector('[data-act="hapus"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const db4 = JSON.parse(store.get('asproject_studio_template_v1') || '{}');
  t('hapus draf tidak menyentuh daftar 44 tema', (db4.drafts || []).length === 1 && w.eval('window.ASP_TPL.length') === 44);

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exitCode = fail ? 1 : 0;
  dom.window.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
