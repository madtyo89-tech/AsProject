// Skin undangan pernikahan + paritas katalog Studio/live/export.
//
// Dulu uji ini memegang daftar 21 tema pernikahan (jawa-elegan, luxury-gold, dst).
// Katalog tema direset 2026-10-10 menjadi satu tema dasar, jadi yang diuji sekarang
// adalah INVARIAN-nya: paritas array TPL di ketiga berkas, palet yang sama di studio
// & live, skin wedding terpasang, dan mesin sematan artwork saat export — semuanya
// diturunkan dari katalog, bukan dari daftar nama tema yang dihapal.
//
// Run: node tools/test-wedding-templates.cjs
//      NODE_PATH=… node tools/test-wedding-templates.cjs   (uji render perlu jsdom)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional untuk uji statis */ }

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const blobText = (win, b) => typeof b.text === 'function'
  ? b.text() : new Promise((ok, no) => {
      const r = new win.FileReader();
      r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsText(b);
    });

const studioHtml = read('studio.html'), liveHtml = read('undangan.html'), indexHtml = read('index.html');
/* Id tema lama yang tidak boleh kembali. jawa-elegan / minimalist-sage / luxury-gold /
 * floral-rustic sengaja tidak di daftar: sejak 2026-10-10 id itu dipakai ulang oleh
 * katalog AsProject (sumber Google Drive) dengan palet & mesin tema repo, bukan
 * salinan desain lama. */
const TEMA_LAMA = ['ice-blue', 'royal-garden', 'galaxy-prestige', 'abyss-pearl', 'winter-prestige'];

function entri(source) {
  const blok = (source.match(/const TPL=\[([\s\S]*?)\];/) || [, ''])[1];
  return blok.split(/(?=\{id:'[a-z0-9-]+')/).map(row => {
    const id = (row.match(/\{id:'([^']+)'/) || [])[1];
    if (!id) return null;
    const get = key => ((row.match(new RegExp(key + ":'([^']*)'")) || [])[1] || '');
    const g = (row.match(/g:\[([^\]]*)\]/) || [])[1] || '';
    return { id, nama: get('nama'), ev: get('ev'), accent: get('accent'), ink: get('ink'),
      pat: get('pat'), bg3d: get('bg3d'), bgPaper: get('bgPaper'), tier: get('tier'),
      g: g ? JSON.parse('[' + g.replace(/'/g, '"') + ']') : [] };
  }).filter(Boolean);
}
const studioTpl = entri(studioHtml), liveTpl = entri(liveHtml);

console.log(`STATIS: ${studioTpl.length} tema di katalog`);
assert(studioTpl.length >= 1, 'katalog punya minimal satu tema (undian live butuh TPL[0])');
assert.equal(new Set(studioTpl.map(t => t.id)).size, studioTpl.length, 'id tema unik');
assert.deepEqual(liveTpl.map(t => t.id), studioTpl.map(t => t.id),
  'urutan TPL Studio & renderer tamu identik (kolom theme = index array ini)');
for (const t of studioTpl) {
  assert(t.nama, `${t.id}: punya nama yang terlihat di katalog`);
  assert(['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'].includes(t.ev), `${t.id}: kategori acara sah`);
  for (const k of ['accent', 'ink']) assert(/^#[0-9a-f]{6}$/i.test(t[k]), `${t.id}: ${k} warna hex 6 digit`);
  assert.equal(t.g.length, 3, `${t.id}: palet gradasi tiga warna`);
  for (const w of t.g) assert(/^#[0-9a-f]{6}$/i.test(w), `${t.id}: warna gradasi ${w} hex 6 digit`);
}
/* palet harus sama persis di kedua berkas, bukan hanya id-nya */
for (const s of studioTpl) {
  const l = liveTpl.find(x => x.id === s.id);
  assert.deepEqual([s.g.join(), s.accent, s.ink], [l.g.join(), l.accent, l.ink],
    `${s.id}: palet studio == palet live`);
  for (const aset of [s.bg3d, s.bgPaper].filter(Boolean)) {
    const full = path.join(ROOT, aset);
    assert(fs.existsSync(full), `${s.id}: artwork ${aset} ada di disk`);
    assert(fs.statSync(full).size < 300000, `${s.id}: artwork ${aset} ringan untuk export (<300 KB)`);
  }
}
/* katalog publik (index.html) memuat id yang sama, dengan gradient yang punya rule CSS */
const pn = (indexHtml.match(/var Pn=\[([\s\S]*?)\],Xm=/) || [, ''])[1];
const pubIds = [...pn.matchAll(/\{id:"([a-z0-9-]+)"/g)].map(m => m[1]);
assert.deepEqual(pubIds, studioTpl.map(t => t.id), 'index.html: katalog publik = katalog studio');
for (const g of [...pn.matchAll(/gradient:"from-\[#(\w+)\] via-\[#(\w+)\] to-\[#(\w+)\]"/g)]) {
  for (const [kind, col] of [['from', g[1]], ['via', g[2]], ['to', g[3]]])
    assert(indexHtml.includes(`.${kind}-\\[\\#${col}\\]{`), `index.html: rule CSS ${kind}#${col} ada`);
}
/* id tema lama tidak boleh tertinggal di berkas yang disajikan publik */
for (const rel of ['studio.html', 'undangan.html', 'index.html']) {
  const sisa = TEMA_LAMA.filter(id => read(rel).includes(id));
  assert.deepEqual(sisa, [], `${rel}: bersih dari id tema lama (${sisa.join(', ')})`);
}
for (const token of ['wedding-cover', 'wedding-invite-card', 'wedding-meta', 'wedding-note', 'wedding-paper-art'])
  assert(liveHtml.includes(token), `live renderer menyertakan ${token}`);
assert(studioHtml.includes('wedding-preview-inner') && studioHtml.includes('weddingDateLabel'),
  'pratinjau Studio memakai isi cover editorial yang sama');
assert(/--cover-art:url\(/.test(studioHtml) && /--wedding-paper-art:url\(/.test(studioHtml),
  'export HTML mandiri punya jalur sematan artwork');

const wedding = studioTpl.filter(t => t.ev === 'pernikahan' || t.ev === 'all');

function undangan(tpl) {
  return { slug: 'theme-test', name1: 'Emma', name2: 'Noah', venue: 'Sunset Gardens',
    event_date: '2027-10-26', event_time: '16:00', theme: studioTpl.findIndex(t => t.id === tpl),
    data: { event: 'pernikahan', tpl, doa: 'pernikahan', fontTitle: 'merriweather', fontBody: 'work-sans', form: {
      namaPria: 'Emma', namaWanita: 'Noah', gelarPria: '', gelarWanita: '', putraPutri: 'Keluarga Emma', putriDari: 'Keluarga Noah',
      tanggalAcara: '2027-10-26', jamAcara: '16:00', zona: 'WIB', venue: 'Sunset Gardens', alamat: 'Carmel', mapsLink: '', showBismillah: false,
      sesiKedua: false, jamAkad: '', jamResepsi: '', showMapsBtn: true, ucapanCustom: '' },
      slides: {}, anim: { cover: false, text: false, reveal: false, effect: 'fade', scroll: 'fade-up' }, border: 'none', music: { url: '', name: '' } }
  };
}
async function renderLive(id) {
  const dom = new JSDOM(liveHtml, { url: 'https://asproject.my.id/undangan.html?slug=theme-test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLMediaElement.prototype.pause = () => {}; w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.fetch = () => Promise.reject(new Error('fixture: no network'));
  for (const asset of ['assets/scroll-effects.js', 'assets/theme-contrast.js', 'assets/button-help.js']) w.eval(read(asset));
  w.eval('window.EMBEDDED_DATA=' + JSON.stringify(undangan(id)) + ';');
  for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
  await new Promise(resolve => setTimeout(resolve, 430));
  return dom;
}
async function testLiveExamples() {
  for (const t of wedding) {
    const dom = await renderLive(t.id), w = dom.window;
    assert(w.document.body.classList.contains('wedding-cover'), `${t.id}: skin wedding terpasang`);
    assert(w.document.body.classList.contains('theme-' + t.id), `${t.id}: kelas tema terpasang`);
    assert(w.document.querySelector('#cover .wedding-invite-card'), `${t.id}: kartu stationery dirender`);
    assert(w.document.querySelector('#cover h1').textContent.includes('Emma'), `${t.id}: nama pengantin dirender`);
    assert(w.document.querySelector('#cover .date').textContent.includes('26 Oktober 2027'), `${t.id}: tanggal dirender`);
    assert.equal(w.document.documentElement.style.getPropertyValue('--accent'), t.accent, `${t.id}: aksen ikut palet tema`);
    assert(w.document.documentElement.style.getPropertyValue('--ft').includes('Merriweather'), `${t.id}: font judul dipakai`);
    if (t.bgPaper) assert(w.document.body.classList.contains('wedding-paper-art'), `${t.id}: paper art aktif`);
    if (t.bg3d) assert(w.document.body.classList.contains('art3d'), `${t.id}: artwork aktif`);
    dom.window.close();
  }
}
async function testStudioPreview() {
  const dom = new JSDOM(studioHtml, { url: 'https://asproject.my.id/studio.html', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('asproject_studio_auth', '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e');
      w.clearScrollReveal = () => {}; w.setupScrollReveal = () => {}; w.scrollTo = () => {};
      w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => ({});
    } });
  const w = dom.window;
  w.eval(`state.started=true;state.event='pernikahan';state.stage='editor';state.tab='desain';render()`);
  for (const t of wedding) {
    w.eval(`state.event='pernikahan';state.tpl='${t.id}';state.accent=tplOf().accent;state.fontTitle=tplOf().ft||state.fontTitle;renderPreview()`);
    const cover = w.document.querySelector('.phone .screen .wedding-cover');
    assert(cover, `${t.id}: pratinjau Studio memasang skin wedding`);
    assert(cover.classList.contains('theme-' + t.id), `${t.id}: pratinjau menandai tema aktif`);
    assert(cover.querySelector('.wedding-invite-card'), `${t.id}: pratinjau menampilkan kartu`);
    assert(cover.querySelector('.wedding-kicker').textContent.includes('Invited'), `${t.id}: pratinjau punya kicker undangan`);
  }

  /* Sematan artwork saat export: fixture (tema dengan bg3d+bgPaper) supaya mesin ini
     tetap teruji walau katalog aktif belum punya tema ber-artwork. */
  const FIX = { id: 'uji-artwork', nama: 'Uji Artwork', ev: 'pernikahan', harga: 75000,
    g: ['#FFFFFF', '#EEEEEE', '#DDDDDD'], accent: '#8A6E4B', ink: '#3B352B',
    bg3d: 'assets/uji/cover.webp', bgPaper: 'assets/uji/paper.webp', deco: '✦', pat: '', ft: 'cormorant' };
  let exported = null;
  w.URL.createObjectURL = blob => { exported = blob; return 'blob:wedding-test'; };
  w.URL.revokeObjectURL = () => {};
  const makeElement = w.document.createElement.bind(w.document);
  w.document.createElement = tag => { const el = makeElement(tag); if (String(tag).toLowerCase() === 'a') el.click = () => {}; return el; };
  w.fetch = async url => {
    const rel = String(url);
    if (rel === 'undangan.html') return { ok: true, text: async () => liveHtml };
    if (rel === 'assets/theme-contrast.js') return { ok: true, text: async () => read('assets/theme-contrast.js') };
    if (rel === 'assets/vip-4d.js' || rel === 'assets/scroll-effects.js') return { ok: true, text: async () => '' };
    if (/^assets\/.*\.(webp|png)$/.test(rel)) {
      const bytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
      return { ok: true, blob: async () => new w.Blob([bytes], { type: 'image/webp' }) };
    }
    throw new Error('fixture: unexpected fetch ' + rel);
  };
  w.eval(`TPL.push(${JSON.stringify(FIX)});state.event='pernikahan';state.tpl='${FIX.id}';state.accent=tplOf().accent;` +
    `state.slug='wedding-test';state.form.namaPria='Emma';state.form.namaWanita='Noah';state.music={local:true};`);
  exported = null;
  await w.dlUndangan();
  assert(exported, 'export HTML mandiri dihasilkan');
  const html = await blobText(w, exported);
  assert(html.includes('window.EMBEDDED_DATA'), 'export menyematkan data undangan');
  assert(/--cover-art:url\(data:image\/webp;base64,/.test(html), 'export menanam artwork cover sebagai base64');
  assert(/--wedding-paper-art:url\(data:image\/webp;base64,/.test(html), 'export menanam paper art sebagai base64');
  assert(!/>\s*NaN\s*</.test(html), 'export bebas artefak NaN');
  dom.window.close();
}

(async () => {
  try {
    if (JSDOM) { await testLiveExamples(); await testStudioPreview(); }
    else console.log('INFO: jsdom unavailable; runtime rendering checks skipped.');
    console.log(`PASS: ${studioTpl.length} tema selaras di studio/live/katalog publik; ${wedding.length} di antaranya memakai skin wedding.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
})();
