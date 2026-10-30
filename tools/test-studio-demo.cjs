// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-studio-demo.cjs
// Verifies the public Studio demo resets on a fresh page lifecycle and never persists form data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'katalog/studio-demo.html'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'assets/studio-demo.js'), 'utf8');
const dom = new JSDOM(html, { url: 'https://asproject.my.id/katalog/studio-demo.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window: w } = dom;
const form = w.document.getElementById('studio-demo-form');
const eventSelect = w.document.getElementById('demo-event');
const themeSelect = w.document.getElementById('demo-theme');
const values = () => Object.fromEntries([...form.querySelectorAll('[data-demo-field]')].map(el => [el.dataset.demoField, el.value]));
const original = { ...values() };
const weddingThemeCount = [...themeSelect.options].filter(option => option.dataset.event === 'all' || option.dataset.event === 'pernikahan').length;
const frame = w.document.getElementById('demo-preview');
const messages = [];
Object.defineProperty(frame.contentWindow, 'postMessage', { configurable: true, value: message => messages.push(message) });

(async () => {
  try {
    w.eval(script);
    assert.equal(eventSelect.value, 'pernikahan');
    assert.equal(themeSelect.value, 'ivory-klasik');
    assert.equal(themeSelect.options.length, weddingThemeCount, 'initial theme list matches the selected event');

    eventSelect.value = 'khitanan';
    eventSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert([...themeSelect.options].every(option => option.dataset.event === 'all' || option.dataset.event === 'khitanan'), 'themes are narrowed to the selected event');
    assert.equal(form.querySelector('[data-demo-visibility="pernikahan"]').hidden, true);
    assert.equal(form.querySelector('[data-demo-visibility="nonwedding"]').hidden, false);

    form.querySelector('[data-demo-field="namaAnak"]').value = 'Nama Sementara';
    form.querySelector('[data-demo-field="venue"]').value = 'Lokasi Sementara';
    form.querySelector('[data-demo-field="venue"]').dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(w.localStorage.length, 0, 'demo does not persist values in browser storage');

    form.querySelector('[type="reset"]').click();
    await new Promise(resolve => w.setTimeout(resolve, 10));
    assert.equal(eventSelect.value, 'pernikahan', 'reset control restores the starting event');
    assert.deepEqual(values(), original, 'reset control restores the example values');

    eventSelect.value = 'aqiqah';
    eventSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
    form.querySelector('[data-demo-field="venue"]').value = 'Lokasi Setelah Reset';
    w.dispatchEvent(new w.Event('pageshow'));
    assert.equal(eventSelect.value, 'pernikahan', 'reopening/pageshow restores the starting event');
    assert.equal(themeSelect.value, 'ivory-klasik', 'reopening/pageshow restores the starting theme');
    assert.deepEqual(values(), original, 'reopening/pageshow restores all original example values');
    assert.equal(w.localStorage.length, 0, 'reset remains ephemeral');

    await new Promise(resolve => w.setTimeout(resolve, 150));
    assert(messages.some(message => message.type === 'ASPROJECT_DEMO_PREVIEW' && message.row.data.previewSandbox && message.row.data.allowShare === false && message.row.data.allowPublish === false), 'preview receives explicitly sandboxed data with sharing and publishing disabled');
    console.log('Studio demo theme filtering, preview messaging, automatic reset and no-storage behavior passed.');
  } finally {
    dom.window.close();
  }
})().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; });
