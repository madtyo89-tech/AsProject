// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-studio-theme-compare.cjs
// Checks side-by-side theme comparison previews use the same event data without mutating the draft.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.scrollTo = () => {};
w.HTMLMediaElement.prototype.pause = () => {};
w.eval(fs.readFileSync(path.join(__dirname, '../assets/scroll-effects.js'), 'utf8'));
for (const script of w.document.querySelectorAll('script:not([src])')) {
  const source = script.textContent;
  if (source.includes('let state;')) {
    w.eval(source + `\nwindow.__themeCompareTest={
      setup(){state.event='pernikahan';state.doa='pernikahan';state.page='editor';state.tab='desain';state.started=true;render()},
      snapshot(){return JSON.stringify(state)},
      alternate(){return tplsFor(state.event).find(t=>t.id!==state.tpl).id},
      row(id){return themeCompareRow(id)},
      active(){return state.tpl},
      open(){toggleThemeComparison()},
      change(side,id){setThemeComparison(side,id)},
      apply(side){useThemeComparison(side)},
      close(){if(compareThemesOpen)toggleThemeComparison()}
    };`);
  } else w.eval(source);
}

try {
  w.startInvitation();
  w.__themeCompareTest.setup();
  const starting = w.__themeCompareTest.snapshot();
  const alternateId = w.__themeCompareTest.alternate();
  const row = w.__themeCompareTest.row(alternateId);
  assert.equal(row.data.tpl, alternateId, 'comparison payload uses the candidate theme');
  assert.equal(row.data.event, 'pernikahan', 'comparison preserves the selected event');
  assert.equal(row.data.form.namaPria, JSON.parse(starting).form.namaPria, 'comparison carries the current invitation details');
  assert.equal(w.__themeCompareTest.snapshot(), starting,
    'building a comparison preview leaves the active draft untouched');

  w.__themeCompareTest.open();
  assert.equal(w.__themeCompareTest.snapshot(), starting, 'opening the comparison leaves the entire active draft unchanged');
  assert.equal(w.document.querySelectorAll('.theme-compare-select select').length, 2, 'dialog offers two independent theme selectors');
  assert.equal(w.document.querySelectorAll('.theme-compare-screen iframe').length, 2, 'dialog renders two live invitation previews');
  const selects = [...w.document.querySelectorAll('.theme-compare-select select')];
  const candidate = [...selects[1].options].find(option => option.value !== selects[0].value).value;
  selects[1].value = candidate;
  selects[1].dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.__themeCompareTest.snapshot(), starting, 'switching a comparison candidate does not mutate any draft field');
  assert.equal(w.__themeCompareTest.active(), JSON.parse(starting).tpl, 'switching a comparison candidate does not apply it to the draft');
  assert.equal(w.document.querySelectorAll('.theme-compare-screen iframe').length, 2, 'both previews remain available after changing a candidate');
  assert.equal(w.document.querySelectorAll('.theme-compare-select select')[1].value, candidate, 'selected candidate remains in the comparison');

  w.__themeCompareTest.close();
  assert.equal(w.document.querySelector('.theme-compare-overlay'), null, 'comparison can be closed without changing the draft');
  assert.equal(w.__themeCompareTest.active(), JSON.parse(starting).tpl);
  w.__themeCompareTest.open();
  w.__themeCompareTest.apply('b');
  assert.equal(w.__themeCompareTest.active(), candidate, 'only the explicit “Gunakan tema ini” action applies a candidate');
  assert.equal(w.document.querySelector('.theme-compare-overlay'), null, 'applying a chosen theme exits comparison mode');
  console.log('Studio side-by-side theme previews preserve draft data and apply only on explicit selection.');
} finally {
  dom.window.close();
}
