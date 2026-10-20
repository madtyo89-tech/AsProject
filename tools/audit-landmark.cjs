#!/usr/bin/env node
/* audit-landmark.cjs — ringkasan pelanggaran landmark (region / satu <main> / h1).
 *
 * Untuk setiap halaman, laporkan elemen tingkat-atas (anak langsung <body> atau
 * kerangka luar) yang isinya berada di luar landmark, supaya perbaikan bisa
 * diarahkan ke pembungkus yang tepat, bukan ke ratusan elemen daun.
 *
 *   node tools/audit-landmark.cjs [halaman...]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'));
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PORT = process.env.PORT || 8080;

function daftarHalaman() {
  const hasil = [];
  for (const d of ['', 'demo', 'katalog-demo']) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.html') && !/^google.+\.html$/.test(f)) hasil.push(d ? `${d}/${f}` : f);
  }
  return hasil;
}
const tanda = el => {
  const bagian = [];
  if (el.id) bagian.push('#' + el.id);
  if (el.className && typeof el.className === 'string') bagian.push('.' + el.className.trim().split(/\s+/).slice(0, 3).join('.'));
  return `${el.tagName.toLowerCase()}${bagian.join('')}`;
};

(async () => {
  const argv = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const daftar = argv.length ? argv : daftarHalaman();
  const { default: sparticuz } = await import(path.join(ROOT, 'node_modules/@sparticuz/chromium/build/index.js'));
  const browser = await chromium.launch({ executablePath: await sparticuz.executablePath(), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], headless: true });
  for (const p of daftar) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let hasil;
    try {
      await page.route('**/*', r => r.request().url().startsWith(`http://localhost:${PORT}/`) ? r.continue() : r.abort());
      await page.goto(`http://localhost:${PORT}/` + p, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(700);
      await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 2500))]));
      await page.addScriptTag({ content: AXE });
      hasil = await page.evaluate(async () => {
        const r = await axe.run(document);
        const ambil = id => (r.violations.find(v => v.id === id) || { nodes: [] }).nodes;
        const ringkas = (n, kunci) => {
          const m = new Map();
          for (const node of n) {
            const el = document.querySelector(node.target[node.target.length - 1]);
            if (!el) continue;
            /* naik ke anak langsung <body> (atau ke <html> kalau tidak ada) */
            let atas = el;
            while (atas.parentElement && atas.parentElement !== document.body) atas = atas.parentElement;
            const info = `${atas.tagName.toLowerCase()}${atas.id ? '#' + atas.id : ''} [${atas.getAttribute('role') || 'tanpa role'}]`;
            m.set(info, (m.get(info) || 0) + 1);
            if (!m.get('~contoh ' + info)) m.set('~contoh ' + info, node.target.join(' ').slice(0, 70));
          }
          return Array.from(m.entries()).map(([k, v]) => `${v}× ${k}`);
        };
        return {
          region: ringkas(ambil('region')),
          main: ambil('landmark-one-main').map(n => n.target.join(' ')),
          h1: ambil('page-has-heading-one').map(n => n.target.join(' ')),
          kembar: [...ambil('landmark-no-duplicate-main'), ...ambil('landmark-unique')].map(n => n.target.join(' ')).slice(0, 4),
          total: { region: ambil('region').length, main: ambil('landmark-one-main').length, h1: ambil('page-has-heading-one').length },
        };
      });
    } catch (e) { console.log(`${p}: GAGAL — ${String(e).split('\n')[0]}`); await page.close(); continue; }
    await page.close();
    console.log(`\n=== ${p} — region ${hasil.total.region} · main ${hasil.total.main} · h1 ${hasil.total.h1}`);
    for (const r of hasil.region) if (!r.startsWith('~contoh') === false) continue; else console.log('   ' + r);
    for (const m of hasil.main) console.log('   [tanpa <main>] ' + m.slice(0, 90));
    for (const m of hasil.h1) console.log('   [tanpa h1] ' + m.slice(0, 90));
    for (const m of hasil.kembar) console.log('   [landmark kembar] ' + m.slice(0, 90));
  }
  await browser.close();
})().catch(e => { console.error(String(e).split('\n')[0]); process.exit(1); });
