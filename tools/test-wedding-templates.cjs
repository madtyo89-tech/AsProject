// Skin undangan pernikahan + paritas katalog Studio/live/export.
//
// Uji ini tidak mengunci semua nama tema historis: katalog publik punya 13 entri,
// dan enam varian Gerbang Arch tambahan bersifat Studio-only. Yang diuji sekarang
// adalah INVARIAN-nya: tema publik cocok dengan katalog publik, enam tema Studio-only
// tersambung ke renderer live, palet Studio/live selaras, skin wedding/arch terpasang,
// dan mesin sematan artwork saat export.
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
      studioOnly: /studioOnly:true/.test(row), arch: /arch:true/.test(row),
      harga: Number((row.match(/harga:(\d+)/) || [])[1] || 0),
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
/* Katalog publik memuat tema normal; varian Gerbang tetap dapat dipilih di Studio. */
const pn = (indexHtml.match(/var Pn=\[([\s\S]*?)\],Xm=/) || [, ''])[1];
const pubIds = [...pn.matchAll(/\{id:\"([a-z0-9-]+)\"/g)].map(m => m[1]);
const expectedPublic = studioTpl.filter(t => !t.studioOnly).map(t => t.id);
const archOnly = studioTpl.filter(t => t.studioOnly);
assert.deepEqual(pubIds, expectedPublic, 'index.html: katalog publik = subset TPL non-Studio-only');
assert.deepEqual(archOnly.map(t => t.id), ['gerbang-rosewood','gerbang-sage-pearl','gerbang-midnight-navy','gerbang-khitanan-emerald','gerbang-aqiqah-natural','gerbang-pesta-ceria'], 'enam tema Gerbang tersedia khusus di Studio');
assert(archOnly.every(t => t.arch), 'semua tema Studio-only menggunakan penanda arch');
assert(archOnly.every(t => !t.harga) && liveTpl.filter(t => t.studioOnly).every(t => !t.harga), 'varian Arch tidak membawa harga asumsi di Studio maupun live');
const demoByArch = {
  'gerbang-rosewood':'undangan-wedding-rosewood.html', 'gerbang-sage-pearl':'undangan-wedding-sage-pearl.html',
  'gerbang-midnight-navy':'undangan-wedding-midnight-navy.html', 'gerbang-khitanan-emerald':'undangan-khitanan-emerald.html',
  'gerbang-aqiqah-natural':'undangan-aqiqah-natural.html', 'gerbang-pesta-ceria':'undangan-ulang-tahun-ceria.html'
};
for (const t of archOnly) {
  const demo = read('katalog-demo/' + demoByArch[t.id]);
  const css = demo.match(/--cream:(#[0-9a-f]{6})[;\s]/i), deep = demo.match(/--gold-deep:(#[0-9a-f]{6})[;\s]/i);
  assert(css && deep, `${t.id}: demo mandiri menyimpan token palet kategori`);
  assert.equal(t.g[0].toLowerCase(), css[1].toLowerCase(), `${t.id}: warna ivory sama dengan demo mandiri`);
  assert.equal(t.accent.toLowerCase(), deep[1].toLowerCase(), `${t.id}: aksen sama dengan demo mandiri`);
  assert(demo.includes('.invite-photo{width:min(100%,270px);height:auto;aspect-ratio:4/5;margin:0 auto 20px}'), `${t.id}: foto undangan memakai frame portrait lebih besar`);
}
assert(liveHtml.includes('body.gerbang-arch #cover .cvf-arch{width:min(52vw,180px)') && studioHtml.includes('gerbang-arch'), 'foto cover Arch dibesarkan dan skin tersedia di Studio/live');
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

function undangan(tpl, event = 'pernikahan', coverStyle) {
  const eventName = event === 'pernikahan' ? 'Emma' : 'Ananda';
  return { slug: 'theme-test', name1: eventName, name2: 'Noah', venue: 'Sunset Gardens',
    event_date: '2027-10-26', event_time: '16:00', theme: studioTpl.findIndex(t => t.id === tpl),
    data: { event, tpl, doa: event, fontTitle: 'merriweather', fontBody: 'work-sans',
      cover: 'assets/demo/wedding/01-jawa-elegan.jpg', ...(coverStyle ? { coverStyle } : {}), form: {
      namaPria: 'Emma', namaWanita: 'Noah', namaAnak: eventName, gelarPria: '', gelarWanita: '', putraPutri: 'Keluarga Emma', putriDari: 'Keluarga Noah',
      tanggalAcara: '2027-10-26', jamAcara: '16:00', zona: 'WIB', venue: 'Sunset Gardens', alamat: 'Carmel', mapsLink: '', showBismillah: false,
      sesiKedua: false, jamAkad: '', jamResepsi: '', showMapsBtn: true, ucapanCustom: '' },
      slides: {}, anim: { cover: false, text: false, reveal: false, effect: 'fade', scroll: 'fade-up' }, border: 'none', music: { url: '', name: '' } }
  };
}
async function renderLive(id, event = 'pernikahan', coverStyle) {
  const dom = new JSDOM(liveHtml, { url: 'https://asproject.my.id/undangan.html?slug=theme-test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLMediaElement.prototype.pause = () => {}; w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.fetch = () => Promise.reject(new Error('fixture: no network'));
  for (const asset of ['assets/scroll-effects.js', 'assets/theme-contrast.js', 'assets/button-help.js']) w.eval(read(asset));
  w.eval('window.EMBEDDED_DATA=' + JSON.stringify(undangan(id, event, coverStyle)) + ';');
  for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
  await new Promise(resolve => setTimeout(resolve, 430));
  return dom;
}
async function testLiveExamples() {
  for (const t of wedding) {
    const dom = await renderLive(t.id), w = dom.window;
    assert(w.document.body.classList.contains('wedding-cover'), `${t.id}: skin wedding terpasang`);
    assert(w.document.body.classList.contains('theme-' + t.id), `${t.id}: kelas tema terpasang`);
    if (t.arch) assert(w.document.body.classList.contains('gerbang-arch'), `${t.id}: skin Gerbang Arch live terpasang`);
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
async function testArchLive() {
  for (const t of archOnly) {
    const dom = await renderLive(t.id, t.ev), w = dom.window;
    assert(w.document.body.classList.contains('gerbang-arch'), `${t.id}: skin Gerbang Arch aktif pada ${t.ev}`);
    assert(w.document.querySelector('#cover .cvf-arch'), `${t.id}: cover photo default memakai frame arch`);
    assert.equal(w.document.documentElement.style.getPropertyValue('--accent'), t.accent, `${t.id}: palet kategori diterapkan`);
    if (t.ev === 'pernikahan') assert(w.document.body.classList.contains('wedding-cover'), `${t.id}: skin wedding tetap aktif`);
    dom.window.close();
  }
  const explicit = await renderLive(archOnly[0].id, archOnly[0].ev, 'polaroid');
  assert(explicit.window.document.querySelector('#cover .cvf-polaroid'), 'gaya cover tersimpan mengalahkan default arch di live');
  explicit.window.close();
}

async function testStudioPreview() {
  const dom = new JSDOM(studioHtml, { url: 'https://asproject.my.id/studio.html', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('asproject_studio_auth', '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e');
      /* Simulate an older saved Studio catalog containing an Arch row with a guessed price. */
      w.localStorage.setItem('asproject_studio_v3', JSON.stringify({
        katalog: [{ id: 'gerbang-rosewood', nama: 'Gerbang Arch · Rosewood', tpl: 'gerbang-rosewood', ev: 'pernikahan', hargaNormal: 150000, hargaPromo: 75000, promoActive: true }],
        katalogHide: ['gerbang-rosewood']
      }));
      w.clearScrollReveal = () => {}; w.setupScrollReveal = () => {}; w.scrollTo = () => {};
      w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => ({});
    } });
  const w = dom.window;
  w.eval(`state.started=true;state.event='pernikahan';state.stage='editor';state.tab='desain';render()`);
  assert.deepEqual([...w.eval('state.katalog.map(k=>k.tpl)')], expectedPublic, 'Studio price catalog migrates back to the public themes only');
  assert.deepEqual([...w.eval('state.katalogHide')], [], 'Studio-only themes are not left hidden by old catalog settings');
  assert(archOnly.every(t => w.eval(`tplsFor('${t.ev}').some(x=>x.id==='${t.id}')`)), 'all six unpriced Studio-only themes remain selectable by event');
  assert(archOnly.every(t => w.eval(`!Object.prototype.hasOwnProperty.call(TPL.find(x=>x.id==='${t.id}'),'harga')`)), 'Studio-only themes carry no assumed price');
  const catalogMarkup = w.eval('katalog()');
  assert(archOnly.every(t => !catalogMarkup.includes(t.nama)), 'Studio-only themes do not appear in the price/promo management catalog');
  for (const t of wedding) {
    w.eval(`state.event='pernikahan';state.tpl='${t.id}';state.accent=tplOf().accent;state.fontTitle=tplOf().ft||state.fontTitle;renderPreview()`);
    const cover = w.document.querySelector('.phone .screen .wedding-cover');
    assert(cover, `${t.id}: pratinjau Studio memasang skin wedding`);
    assert(cover.classList.contains('theme-' + t.id), `${t.id}: pratinjau menandai tema aktif`);
    if (t.arch) assert(cover.classList.contains('gerbang-arch'), `${t.id}: pratinjau Studio memakai skin arch`);
    assert(cover.querySelector('.wedding-invite-card'), `${t.id}: pratinjau menampilkan kartu`);
    assert(cover.querySelector('.wedding-kicker').textContent.includes('Invited'), `${t.id}: pratinjau punya kicker undangan`);
  }

  for (const t of archOnly) {
    w.eval(`state.event='${t.ev}';state.cover='assets/demo/wedding/01-jawa-elegan.jpg';state.coverStyle='kotak';state.coverStyleExplicit=false;pickTpl('${t.id}')`);
    assert.equal(w.eval('state.coverStyle'), 'arch', `${t.id}: Studio memberi frame arch sebagai default`);
    const cover = w.document.querySelector('.phone .screen .gerbang-arch');
    assert(cover, `${t.id}: Studio preview memakai skin arch`);
    const photo = cover.querySelector('img[alt="Foto cover"]');
    assert(photo, `${t.id}: Studio preview menampilkan foto cover`);
    assert(photo.parentElement.style.borderRadius.includes('999px'), `${t.id}: Studio preview memberi bingkai lengkung arch`);
  }
  w.eval(`state.event='pernikahan';state.cover='assets/demo/wedding/01-jawa-elegan.jpg';setCvStyle('polaroid');pickTpl('gerbang-rosewood')`);
  assert.equal(w.eval('state.coverStyle'), 'polaroid', 'pilihan cover manual tidak ditimpa saat memilih Arch');
  const manualPhoto = w.document.querySelector('.phone .screen .gerbang-arch img[alt="Foto cover"]');
  assert(manualPhoto && manualPhoto.parentElement.style.borderRadius === '6px', 'Studio mempertahankan frame manual pada tema Arch');
  w.eval(`state.coverStyle='arch';state.coverStyleExplicit=false;pickTpl('luxury-gold')`);
  assert.equal(w.eval('state.coverStyle'), 'kotak', 'default arch tidak terbawa saat berpindah ke tema non-Arch');
  w.eval(`state.event='khitanan';pickTpl('gerbang-khitanan-emerald')`);
  assert.equal(w.eval('state.fontTitle'), 'cinzel', 'font bawaan tema Arch tetap dipakai');
  assert.equal(w.eval('paksaTier()'), false, 'font bawaan eksklusif tidak memicu peringatan tier saat memilih tema');

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
    if (JSDOM) { await testLiveExamples(); await testArchLive(); await testStudioPreview(); }
    else console.log('INFO: jsdom unavailable; runtime rendering checks skipped.');
    console.log(`PASS: ${studioTpl.length} tema selaras Studio/live (${expectedPublic.length} publik, ${archOnly.length} Studio-only); ${wedding.length} tema memakai skin wedding; semua enam Arch diuji di renderer & preview.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
})();
