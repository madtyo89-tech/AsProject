// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-studio-undo.cjs
// Verifies that the Studio exposes a local-save indicator and can undo a saved edit.
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.scrollTo = () => {};
w.HTMLMediaElement.prototype.pause = () => {};
w.eval(fs.readFileSync(path.join(__dirname, '../assets/scroll-effects.js'), 'utf8'));
for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);

(async () => {
  try {
    w.startInvitation();
    w.updF('namaPria', 'Sebelum');
    await new Promise(resolve => setTimeout(resolve, 900));
    w.updF('namaPria', 'Sesudah');
    w.render();
    assert.equal(w.document.querySelector('.save-state').textContent.includes('Tersimpan di perangkat ini'), true,
      'editor reports the draft is saved locally');
    const undo = w.document.querySelector('.undo-btn');
    assert(undo && !undo.disabled, 'undo becomes available after a saved edit');
    w.undoStudio();
    assert.equal(JSON.parse(w.localStorage.getItem('asproject_studio_v3')).form.namaPria, 'Sebelum',
      'undo restores the previous saved draft and persists it immediately');
    assert.equal(w.document.querySelector('.save-state').textContent.includes('Tersimpan di perangkat ini'), true,
      'save status remains visible after undo');
    console.log('Studio local-save status and undo regression passed.');
  } finally {
    dom.window.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
