// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-katalog-v2.cjs
// Exercises the public catalog's client-side search, filters, sorting and local favorites.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const { TEMPLATES } = require('../kerangka/template.js');
const expectedCount = TEMPLATES.filter(t => !t.studioOnly).length;
const html = fs.readFileSync(path.join(ROOT, 'katalog/index.html'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'assets/katalog-v2.js'), 'utf8');
const dom = new JSDOM(html, { url: 'https://asproject.my.id/katalog/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window: w } = dom;
const all = () => [...w.document.querySelectorAll('[data-template-card]')];
const visible = () => all().filter(card => !card.hidden);

try {
  const controls = w.document.querySelector('[data-catalog-controls]');
  const toast = w.document.querySelector('[data-catalog-toast]');
  assert(w.document.body.classList.contains('ap-catalog-page'), 'catalog page opts into its isolated glass UI skin');
  assert(toast && toast.hidden && toast.getAttribute('aria-live') === 'polite', 'favorite toast is present and accessible before enhancement');
  assert(controls && controls.hidden, 'interactive controls are hidden before JS enhancement');
  assert.equal(all().length, expectedCount, 'all templates are server-rendered');
  w.eval(script);
  assert.equal(controls.hidden, false, 'controls appear after enhancement');
  assert.equal(visible().length, expectedCount);
  assert.equal(controls.querySelector('[data-catalog-sort]').value, 'featured', 'catalog enhancement keeps the server-rendered featured order by default');
  assert(visible().slice(0, 10).every(card => card.textContent.includes('NEW TEMPLATE')), 'the ten NEW TEMPLATE releases remain first after enhancement');

  const search = controls.querySelector('[data-catalog-search]');
  search.value = 'sorot utama';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(visible().length, 1, 'search narrows the card list');
  assert.match(visible()[0].textContent, /Sorot Utama/);

  search.value = '';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  controls.querySelector('[data-category-filter="aqiqah"]').click();
  assert(visible().length > 0, 'category filter returns matching templates');
  assert(visible().every(card => card.dataset.category === 'aqiqah'));

  controls.querySelector('[data-category-filter="all"]').click();
  controls.querySelector('[data-catalog-sort]').value = 'name-desc';
  controls.querySelector('[data-catalog-sort]').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(visible()[0].querySelector('h3').textContent.trim(), 'Wabi Sabi', 'sort order changes without losing cards');

  const favorite = all()[0].querySelector('[data-favorite]');
  const favoriteId = favorite.dataset.favorite;
  favorite.click();
  assert.equal(favorite.getAttribute('aria-pressed'), 'true', 'favorite button exposes pressed state');
  assert.equal(toast.hidden, false, 'glass toast appears after saving a favorite');
  assert.match(toast.textContent, /ditambahkan ke favorit/, 'toast confirms the favorite action');
  assert(toast.classList.contains('is-visible'), 'toast enters its visible state');
  assert(JSON.parse(w.localStorage.getItem('asproject_katalog_favorit_v1')).includes(favoriteId), 'favorite persists locally');
  controls.querySelector('[data-favorites-toggle]').click();
  assert.equal(visible().length, 1, 'favorites-only view shows saved themes');
  assert.equal(visible()[0].querySelector('[data-favorite]').dataset.favorite, favoriteId);

  search.value = 'no tema dengan kata kunci ini';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(visible().length, 0);
  assert.equal(w.document.querySelector('[data-catalog-empty]').hidden, false, 'empty state appears');
  w.document.querySelector('[data-clear-filters]').click();
  assert.equal(visible().length, expectedCount, 'reset restores the full catalog');
  assert(visible().slice(0, 10).every(card => card.textContent.includes('NEW TEMPLATE')), 'reset restores the newest templates first');
  assert.equal(w.document.querySelector('[data-catalog-empty]').hidden, true);
  console.log('Katalog V2 search, category filters, sorting, favorites and empty state passed.');
} finally {
  dom.window.close();
}
