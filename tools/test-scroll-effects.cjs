// npm install --no-save --package-lock=false jsdom
// node tools/test-scroll-effects.cjs
const { JSDOM } = require('jsdom');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Script } = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const studio = read('studio.html'), live = read('undangan.html');
const css = read('assets/scroll-effects.css');
const ids = html => [...html.match(/const FX_SCROLL=\[([\s\S]*?)\];/)[1].matchAll(/\[\s*'([^']+)'/g)].map(m => m[1]);
const all = ids(studio);
assert.equal(all.length, 24);
assert.equal(new Set(all).size, 24);
assert.deepEqual(all, ids(live));
for (const id of all) {
 assert(css.includes(`.scroll-reveal.fx-s-${id}{`), `CSS selector for ${id}`);
 assert(css.includes(`@keyframes sr-${id}{`), `Keyframes for ${id}`);
}
for (const html of [studio, live]) {
 const doc = new JSDOM(html);
 for (const script of doc.window.document.querySelectorAll('script:not([src])')) new Script(script.textContent);
 doc.window.close();
}
const dom = new JSDOM(studio, { url: 'https://studio.test/', runScripts: 'outside-only' });
const w = dom.window;
w.HTMLMediaElement.prototype.pause = () => {};
let reduced = false;
w.matchMedia = () => ({ matches: reduced });
const observers = [];
w.IntersectionObserver = class {
 constructor(callback, options) { this.callback = callback; this.options = options; this.elements = new Set(); observers.push(this); }
 observe(el) { this.elements.add(el); }
 unobserve(el) { this.elements.delete(el); }
 disconnect() { this.elements.clear(); }
};
w.eval(read('assets/scroll-effects.js'));
for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
w.scrollTo=()=>{};w.startInvitation();
for (const id of all) {
 w.setAnim('scroll', id);
 const panel = w.document.querySelector('#phoneWrap .scroll-reveal');
 const floating = w.document.querySelector('#floatPrev .scroll-reveal');
 assert(panel.classList.contains(`fx-s-${id}`));
 assert(floating.classList.contains(`fx-s-${id}`));
 const observer = observers.at(-1);
 assert.equal(observer.options.root, w.document.querySelector('.fp-screen'));
 assert(floating.classList.contains('sr-ready'));
 assert(!floating.classList.contains('sr-in'), 'Off-screen content waits for scrolling');
 observer.callback([{ target: floating, isIntersecting: false }]);
 assert(!floating.classList.contains('sr-in'));
 observer.callback([{ target: floating, isIntersecting: true }]);
 assert(floating.classList.contains('sr-in'), 'Visible content animates');
 assert(!observer.elements.has(floating), 'Reveal runs once');
}
reduced = true;
w.renderPreview();
assert.equal(w.document.querySelector('.sr-ready'), null, 'Reduced motion never hides content');
reduced = false;
delete w.IntersectionObserver;
w.renderPreview();
assert.equal(w.document.querySelector('.sr-ready'), null, 'No observer: all content remains visible');
w.setAnim('reveal', false);
assert.equal(w.document.querySelector('.scroll-reveal'), null, 'Reveal toggle disables effects');
dom.window.close();
console.log('24 scroll effects: parity, syntax, selection, viewport reveal, fallback and reduced-motion checks passed.');
