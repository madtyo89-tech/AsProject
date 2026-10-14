// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-floating-preview.cjs
// DOM regression tests; geometry is mocked (not a visual browser test).
// Sejak pratinjau memakai berkas undangan.html asli di dalam iframe, test ini
// menjaga: (a) pratinjau tidak menggambar ulang undangan (satu renderer saja),
// (b) data draft dikirim ke iframe, (c) kotak melayang tetap bisa digeser,
// diperbesar, disembunyikan, dan tidak memasang ulang iframe saat mengetik.
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../studio.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.HTMLMediaElement.prototype.pause = () => {};
w.eval(fs.readFileSync(require('node:path').join(__dirname, '../assets/scroll-effects.js'), 'utf8'));
for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
w.scrollTo = () => {}; w.startInvitation();
const get = s => w.document.querySelector(s);
const semua = s => [...w.document.querySelectorAll(s)];
const floating = get('#floatPrev');

// (a) Pratinjau = undangan asli di dalam iframe, bukan salinan DOM.
assert(get('#phoneWrap iframe.pv-frame'), 'panel pratinjau memuat iframe undangan asli');
assert.equal(get('#phoneWrap iframe.pv-frame').getAttribute('src'), 'undangan.html?preview=1');
assert(get('.fp-screen iframe.pv-frame'), 'kotak melayang memakai iframe undangan yang sama');
assert.equal(html.includes('function phoneHtml('), false, 'renderer replika sudah tidak ada di studio.html');
assert.equal(semua('[id]').length, new Set(semua('[id]').map(el => el.id)).size, 'ID tidak terduplikasi di halaman Studio');
for (const iframe of semua('iframe.pv-frame')) {
  assert.equal(iframe.parentElement.className.includes('pv-phone'), true, 'iframe dibungkus bingkai .pv-phone');
  assert.equal(iframe.parentElement.children.length, 1, 'bingkai hanya berisi iframe (tidak menyalin isi undangan)');
}
assert.equal(get('.fp-screen').getAttribute('onclick'), null, 'Skrol tidak membuka panel lain');
assert.equal(get('.fp-screen').className.includes('fp-screen'), true);

// (b) Ketikan pemilik dikirim ke iframe tanpa membangun ulang (skrol pemilik tidak hilang).
const iframePanel = get('#phoneWrap iframe.pv-frame');
let terkirim = [];
Object.defineProperty(iframePanel, 'contentWindow', { configurable: true, value: { postMessage: m => terkirim.push(m), scrollTo() {} } });
w.updF('namaPria', 'Ava');   // mengetik tidak me-render ulang halaman (fokus isian aman)
w.pvPerbaruiSekarang();
assert(terkirim.some(m => m.type === 'asproject:preview' && m.row && m.row.data.form.namaPria === 'Ava'),
  'perubahan isian dikirim ke iframe pratinjau');
assert.equal(get('#phoneWrap iframe.pv-frame'), iframePanel, 'perubahan isian tidak memuat ulang iframe');
w.floatGo();
assert(floating.classList.contains('fp-expanded'), 'Expand works without the desktop panel');
w.floatGo();
assert(!floating.classList.contains('fp-expanded'));

// (c) Tombol ⤒ mengembalikan undangan di dalam iframe ke cover.
const coverBtn = get('.fp-actions button[onclick="fpCover()"]');
assert(coverBtn && coverBtn.getAttribute('aria-label'), 'Header offers a back-to-cover button');
terkirim = [];
const iframeFloat = get('#floatPrev iframe.pv-frame');
Object.defineProperty(iframeFloat, 'contentWindow', { configurable: true, value: { postMessage: m => terkirim.push(m), scrollTo() {} } });
w.fpCover();
assert.deepEqual(terkirim.map(m => m.type), ['asproject:cover'], 'Back-to-cover asks the real invitation to show its cover');
assert(get('.fp-hint').textContent.includes('cover'), 'Hint mentions the cover button');
assert(fs.readFileSync(require('node:path').join(__dirname, '../undangan.html'), 'utf8').includes('body.preview-mode #coverBack{display:none}'),
  'Preview hides the live back-to-cover button in favor of the floating one');

// (d) Tata letak & gerak kotak melayang tetap sama.
floating.getBoundingClientRect = () => ({ width: 180, height: 384, left: parseFloat(floating.style.left) || 828, top: parseFloat(floating.style.top) || 368 });
let pos = w.placeFloat(-100, 5000);
assert.equal(pos.x, 8);
assert.equal(pos.y, w.innerHeight - 384 - 8);
assert(html.includes("right:'auto',bottom:'auto'"), 'Move the fixed wrapper, not the static box (JSDOM omits inline auto values)');
const head = get('.fp-head');
head.setPointerCapture = () => {};
head.hasPointerCapture = () => false;
w.fpDragStart({ button: 0, target: head, currentTarget: head, pointerId: 1, clientX: 10, clientY: pos.y + 2, preventDefault() {} });
const pointer = (type, x, y) => { const e = new w.Event(type); Object.assign(e, { pointerId: 1, clientX: x, clientY: y }); head.dispatchEvent(e); };
pointer('pointermove', 202, 102);
pointer('pointerup', 202, 102);
assert.equal(floating.style.left, '200px');
assert.equal(floating.style.top, '100px');
w.renderPreview();
w.pvPerbaruiSekarang();
assert.equal(floating.style.left, '200px', 'Position survives render');
w.innerWidth = 390; w.innerHeight = 600;
w.dispatchEvent(new w.Event('resize'));
assert(parseFloat(floating.style.left) + 180 <= 382, 'Resize clamps to viewport');
w.setFloat(false);
assert(get('.fp-pill'));
assert.equal(floating.style.left, '', 'Collapsed button returns to its corner');
w.setFloat(true);
assert(get('.fp-screen iframe.pv-frame'), 'Preview reopens');
assert(!html.includes('#floatPrev{display:none}'), 'Mobile preview remains available');
dom.window.close();
console.log('Floating preview DOM regressions passed (iframe-based preview, drag, expand, cover button).');
