#!/usr/bin/env node
/* audit-kontras.cjs — pengukur aksesibilitas statis untuk situs AsProject.
 *
 * Menjalankan axe-core di dalam Chromium headless (playwright-core +
 * @sparticuz/chromium) terhadap setiap halaman HTML di repo, lalu melaporkan
 * aturan yang gagal: kontras warna, keberadaan <main>, dan region landmark.
 *
 * Pakai:
 *   node tools/audit-kontras.cjs                 # ringkasan semua halaman
 *   node tools/audit-kontras.cjs index.html ...  # halaman tertentu
 *   node tools/audit-kontras.cjs --detail index.html   # rincian tiap temuan
 *
 * Prasyarat: `python3 tools/serve.py 8080` sudah jalan di terminal lain, dan
 * paket dev `playwright-core`, `@sparticuz/chromium`, serta `axe-core` ada di
 * node_modules (lihat README bagian pengujian).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'));
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}/`;

function daftarHalaman() {
  const hasil = [];
  for (const d of ['', 'demo', 'katalog-demo']) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (f.endsWith('.html')) hasil.push(d ? `${d}/${f}` : f);
    }
  }
  return hasil;
}

(async () => {
  const argv = process.argv.slice(2);
  const detail = argv.includes('--detail');
  const halaman = argv.filter(a => !a.startsWith('--'));
  const daftar = halaman.length ? halaman : daftarHalaman();

  const { default: sparticuz } = await import(path.join(ROOT, 'node_modules/@sparticuz/chromium/build/index.js'));
  const browser = await chromium.launch({
    executablePath: await sparticuz.executablePath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-color-profile=srgb'],
    headless: true,
  });

  const total = { kontras: 0, main: 0, region: 0, h1: 0 };
  const baris = [];
  for (const p of daftar) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let hasil;
    try {
      await page.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(700);
      /* tunggu animasi/transisi selesai — kalau tidak, yang terukur adalah
         kerangka animasi (opasitas di tengah transisi bukan warna sebenarnya) */
      await page.evaluate(() => Promise.race([
        Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, 3000)),
      ]));
      await page.addScriptTag({ content: AXE });
      hasil = await page.evaluate(async () => {
        const r = await axe.run(document);
        const ringkas = { kontras: 0, main: 0, region: 0, h1: 0, rincian: [] };
        for (const v of r.violations) {
          if (v.id === 'color-contrast') ringkas.kontras += v.nodes.length;
          if (v.id === 'landmark-one-main') ringkas.main += v.nodes.length;
          if (v.id === 'region') ringkas.region += v.nodes.length;
          if (v.id === 'page-has-heading-one') ringkas.h1 += v.nodes.length;
          for (const n of v.nodes) {
            const d = (n.any && n.any[0] && n.any[0].data) || {};
            ringkas.rincian.push({
              aturan: v.id, sel: n.target.join(' '),
              fg: d.fgColor, bg: d.bgColor, fgA: d.fgAlpha, bgA: d.bgAlpha,
              rasio: d.contrastRatio, ukuran: d.fontSize, tebal: d.fontWeight,
            });
          }
        }
        return ringkas;
      });
    } catch (e) {
      console.log(`${p}: GAGAL — ${String(e).split('\n')[0]}`);
      await page.close();
      continue;
    }
    await page.close();
    total.kontras += hasil.kontras; total.main += hasil.main; total.region += hasil.region; total.h1 += hasil.h1;
    baris.push([p, hasil.kontras, hasil.main, hasil.region, hasil.h1]);
    if (detail) {
      console.log(`\n=== ${p} ===`);
      for (const r of hasil.rincian) {
        const w = r.fg && r.bg ? ` ${r.fg} @ ${r.bg}${r.rasio ? ` → ${r.rasio}` : ''}${r.fgA < 1 ? ` (alfa ${r.fgA})` : ''}` : '';
        console.log(`  [${r.aturan}]${w}\n     ${r.sel.slice(0, 110)}`);
      }
      if (!hasil.rincian.length) console.log('  (bersih)');
    }
  }
  await browser.close();

  if (detail) return;
  const lbr = Math.max(...baris.map(b => b[0].length), 6);
  console.log('halaman'.padEnd(lbr) + ' kontras  main  region  h1');
  for (const b of baris) console.log(b[0].padEnd(lbr) + String(b[1]).padStart(6) + String(b[2]).padStart(7) + String(b[3]).padStart(7) + String(b[4]).padStart(5));
  console.log(`\nTOTAL halaman=${baris.length} kontras=${total.kontras} landmark-main=${total.main} region=${total.region} h1=${total.h1}`);
})().catch(e => { console.error(String(e).split('\n')[0]); process.exit(1); });
