/* Uji AI tema (assets/tema-ai.js + panel ✨ AI di studio-template.html).
 *
 * Fokus:
 * - 200 prompt acak → semua id sah, hex sah, kontras ≥ 4.5:1, desc ≤ 180;
 * - deterministik (seed sama → hasil sama) dan 3 kandidat tidak kembar;
 * - kunci palet/font dihormati;
 * - JSON tempelan divalidasi ketat (id asing, field asing, hex salah ditolak);
 * - UI: tombol ✨ AI → buat kandidat → "Pakai jadi draf" hanya menambah draf,
 *   tidak mengubah 44 template;
 * - tema-ai.js tidak melakukan jaringan (proxy terpisah).
 *
 * Jalankan: NODE_PATH=$PWD/node_modules node tools/test-tema-ai.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const ROOT = path.join(__dirname, '..');
const baca = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HASH = '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';

let ok = 0, fail = 0;
const t = (nama, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + nama + (!cond && extra ? ' — ' + extra : ''));
};

/* ---------- 1. mesin (tanpa DOM) ---------- */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(baca('assets/tema-kosakata.js'), ctx);
vm.runInContext(baca('assets/tema-ai.js'), ctx);
const AI = ctx.window.TEMA_AI;
const K = ctx.window.TEMA_KOSAKATA;

t('kosakata: 6 daftar terisi', ['fonts', 'ornamen', 'pola', 'borders', 'covers', 'buka'].every(k => K[k] && K[k].length > 0));
t('mesin: versi & 8 mood tersedia', !!AI.versi && AI.MOOD.length === 8, AI.MOOD.join(','));
t('mesin: tema-ai.js tidak memanggil jaringan',
  !/fetch\s*\(|XMLHttpRequest|WebSocket/.test(baca('assets/tema-ai.js')));

const idFont = new Set(K.fonts.map(x => x.id));
const idOrn = new Set(K.ornamen.map(x => x.id));
const idPola = new Set(K.pola.map(x => x.id));
const idBorder = new Set(K.borders.map(x => x.id));
const idCover = new Set(K.covers.map(x => x.id));
const idBuka = new Set(K.buka.map(x => x.id));
const evSah = new Set(K.ev);

const bahan = ['pernikahan', 'khitanan', 'ultah', 'aqiqah',
  'rustic', 'mewah', 'minimal', 'ceria', 'islami', 'tropis', 'vintage', 'editorial',
  'hijau', 'emas', 'navy', 'biru', 'pink', 'krem', 'maroon', 'zaitun', 'sage', 'teal',
  'adat Jawa', 'adat Sunda', 'pantai', 'gelap', 'terang', 'anak', 'balon'];

let semuaSah = true, kontrasMin = 99, contohGalat = '';
const promptAcak = [];
for (let i = 0; i < 200; i++) {
  const n = 2 + (i % 4);
  const p = Array.from({ length: n }, (_, j) => bahan[(i * 7 + j * 13) % bahan.length]).join(' ');
  promptAcak.push(p);
  const ev = ['pernikahan', 'khitanan', 'ultah', 'aqiqah'][i % 4];
  const hasil = AI.buat(p, { ev, jumlah: 3, keberanian: (i % 3) + 1, seed: i });
  if (hasil.length !== 3) { semuaSah = false; contohGalat = 'kandidat < 3 untuk: ' + p; break; }
  for (const k of hasil) {
    const sah = evSah.has(k.ev) && k.g.length === 3 && k.g.every(c => /^#[0-9A-F]{6}$/.test(c))
      && /^#[0-9A-F]{6}$/.test(k.accent) && /^#[0-9A-F]{6}$/.test(k.ink)
      && idFont.has(k.ft) && (!k.orn || idOrn.has(k.orn)) && (!k.pat || idPola.has(k.pat))
      && idBorder.has(k.border) && idCover.has(k.cover) && idBuka.has(k.buka)
      && k.desc.length <= 180 && k.nama.length >= 3 && k.nama.length <= 40;
    const cInk = AI.kontras(k.ink, k.g[0]);
    const cAcc = AI.kontras(k.accent, k.g[0]);
    kontrasMin = Math.min(kontrasMin, cInk, cAcc);
    if (!sah) { semuaSah = false; contohGalat = JSON.stringify(k); }
    if (cInk < 4.5 || cAcc < 4.5) { semuaSah = false; contohGalat = 'kontras ' + cInk.toFixed(2) + '/' + cAcc.toFixed(2) + ' pada ' + p; }
    if (!sah || contohGalat) break;
  }
  if (!semuaSah) break;
}
t('200 prompt: semua kandidat sah (id registry, hex, panjang teks)', semuaSah, contohGalat);
t('200 prompt: kontras minimum ≥ 4.5:1 (' + kontrasMin.toFixed(2) + ':1)', kontrasMin >= 4.5);

const a = JSON.stringify(AI.buat('rustic hijau zaitun', { ev: 'pernikahan', jumlah: 3, seed: 9 }));
const b = JSON.stringify(AI.buat('rustic hijau zaitun', { ev: 'pernikahan', jumlah: 3, seed: 9 }));
t('deterministik: seed sama → hasil sama', a === b);
const c = JSON.stringify(AI.buat('rustic hijau zaitun', { ev: 'pernikahan', jumlah: 3, seed: 10 }));
t('acak: seed berbeda → hasil berbeda', a !== c);

const tiga = AI.buat('emas gelap mewah', { ev: 'pernikahan', jumlah: 3 });
const kunciUnik = new Set(tiga.map(x => x.g.join() + '|' + x.ft + '|' + x.pat + '|' + x.border));
t('3 kandidat tidak kembar', kunciUnik.size === 3, kunciUnik.size + ' unik');

const dasar = AI.buat('tropis hijau segar', { ev: 'pernikahan', jumlah: 3, seed: 3 })[0];
const terkunci = AI.buat('emas mewah gelap', { ev: 'pernikahan', jumlah: 2, seed: 4, kunci: { g: dasar.g, accent: dasar.accent, ink: dasar.ink, ft: dasar.ft } });
t('kunci palet & font dihormati', terkunci.every(x => x.g.join() === dasar.g.join() && x.accent === dasar.accent && x.ft === dasar.ft));

const ultah = AI.buat('ultah anak ceria balon', { ev: 'ultah', jumlah: 1 })[0];
const islami = AI.buat('aqiqah islami kaligrafi', { ev: 'aqiqah', jumlah: 1 })[0];
t('mood mengikuti konteks (ultah ≠ aqiqah)', ultah.g.join() !== islami.g.join());

t('prompt kosong tetap menghasilkan tema', AI.buat('', { ev: 'pernikahan', jumlah: 1 }).length === 1);

/* ---------- 2. validasi & JSON tempelan ---------- */
const baik = {
  nama: 'Uji Lulus', ev: 'pernikahan', g: ['#FBFAF6', '#F2EFE7', '#E4DFD2'],
  accent: '#1B1B1B', ink: '#26231D', ft: 'lora', orn: 'zaitun', pat: 'kawung',
  border: 'thin', deco: '✦ ❖ ✦', desc: 'contoh', cover: 'kartu', buka: 'pita'
};
t('validasi: token benar diterima', AI.validasi(baik).ok);
t('validasi: field asing ditolak', !AI.validasi(Object.assign({}, baik, { css: 'body{display:none}' })).ok);
t('validasi: font asing ditolak', !AI.validasi(Object.assign({}, baik, { ft: 'comic-sans' })).ok);
t('validasi: hex salah ditolak', !AI.validasi(Object.assign({}, baik, { accent: 'red' })).ok);
t('validasi: kontras rendah ditolak', !AI.validasi(Object.assign({}, baik, { ink: '#F5F5F5' })).ok);
t('validasi: cover asing ditolak', !AI.validasi(Object.assign({}, baik, { cover: 'hologram' })).ok);

const teksJSON = '```json\n' + JSON.stringify([baik, Object.assign({}, baik, { nama: 'Ditolak', ft: 'x' })]) + '\n```';
const rJSON = AI.dariJSON(teksJSON);
t('dariJSON: pagar kode dilepas, 1 sah & 1 ditolak', rJSON.ok && rJSON.kandidat.length === 1 && rJSON.galat.length === 1);
t('dariJSON: JSON rusak ditolak dengan pesan', AI.dariJSON('{bukan json').galat[0].indexOf('JSON tidak valid') === 0);

/* ---------- 3. UI (jsdom) ---------- */
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { JSDOM = null; }
(async function bagianUI() {
if (!JSDOM) {
  console.log('info  jsdom belum terpasang — bagian UI dilewati (npm i jsdom)');
} else {
  const store = new Map();
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(String(e && e.message))) console.error(String(e.message)); });
  const dom = new JSDOM(baca('studio-template.html'), {
    url: 'https://studio.test/studio-template.html',
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.Element.prototype.scrollIntoView = function () {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      Object.defineProperty(w, 'localStorage', {
        configurable: true,
        value: {
          getItem: k => (store.has(k) ? store.get(k) : null),
          setItem: (k, v) => store.set(k, String(v)),
          removeItem: k => store.delete(k), clear: () => store.clear(),
          key: i => Array.from(store.keys())[i] ?? null,
          get length() { return store.size; }
        }
      });
      Object.defineProperty(w, 'sessionStorage', { configurable: true, value: w.localStorage });
    }
  });
  const w = dom.window, d = w.document;
  store.set('asproject_studio_auth', HASH);
  w.eval(baca('assets/tpl-data.js'));
  w.eval(baca('assets/tema-kosakata.js'));
  w.eval(baca('assets/tema-ai.js'));
  w.eval(baca('assets/tema-ai-proxy.js'));
  w.eval(baca('assets/studio-core.js'));
  w.eval(baca('assets/studio-template.js'));

  const tplAwal = w.eval('window.ASP_TPL.length');
  const tplSnapshot = w.eval('JSON.stringify(window.ASP_TPL)');

  d.getElementById('btnAI').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t('UI: tombol ✨ AI membuka dialog', !!d.querySelector('#aiWrap [role="dialog"]') && d.getElementById('aiWrap').hidden === false);

  const prompt = d.getElementById('aiPrompt');
  prompt.value = 'pernikahan adat Sunda, hijau zaitun, elegan, motif kawung';
  d.getElementById('aiEvent').value = 'pernikahan';
  d.getElementById('aiJumlah').value = '3';
  d.querySelector('[data-act="aibuat"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const kartu = d.querySelectorAll('[data-kandidat]');
  t('UI: 3 kandidat tampil dengan swatch & skor kontras', kartu.length === 3 && kartu[0].querySelectorAll('.asp-ai-swatch i').length === 4);
  t('UI: kandidat menyebut font/pola/cover yang dipakai', /·/.test(kartu[0].querySelector('.asp-small').textContent));

  const namaPertama = kartu[0].querySelector('strong').textContent;
  kartu[0].querySelector('[data-ai-pakai]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400)); /* persist() memakai debounce 260 ms */
  const db = JSON.parse(store.get('asproject_studio_template_v1') || {});
  if (!Array.isArray(db.drafts)) db.drafts = [];
  t('UI: "Pakai jadi draf" menambah 1 draf', Array.isArray(db.drafts) && db.drafts.length === 1, JSON.stringify(db.drafts && db.drafts.length));
  t('UI: draf memakai nama kandidat', db.drafts[0] && db.drafts[0].nama === namaPertama, db.drafts[0] && db.drafts[0].nama);
  t('UI: draf menyimpan asal-usul AI', !!(db.drafts[0] && db.drafts[0].ai && db.drafts[0].ai.prompt));
  t('UI: draf ber-id custom- & bukan template produksi', /-/.test((db.drafts[0] || {}).id || '') && !w.eval('window.ASP_TPL.some(function(x){return x.id===' + JSON.stringify(db.drafts[0].id) + '})'));
  t('UI: editor terbuka pada draf baru', !!d.querySelector('#editor [data-k="nama"]'));
  t('UI: 44 template tidak berubah', w.eval('window.ASP_TPL.length') === tplAwal && w.eval('JSON.stringify(window.ASP_TPL)') === tplSnapshot);

  d.getElementById('btnAI').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d.querySelector('.asp-ai-tempel').open = true;
  d.getElementById('aiJson').value = JSON.stringify(baik);
  d.querySelector('[data-act="aipakaijson"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t('UI: tempel JSON sah langsung jadi kandidat', d.querySelectorAll('[data-kandidat]').length === 1);
  d.getElementById('aiJson').value = JSON.stringify(Object.assign({}, baik, { border: 'tidak-ada' }));
  d.querySelector('[data-act="aipakaijson"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t('UI: tempel JSON dengan id asing ditolak & dijelaskan', /border tidak terdaftar|ditolak/i.test(d.getElementById('aiPesan').textContent));
  dom.window.close();
}

console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
process.exitCode = fail ? 1 : 0;
})();
