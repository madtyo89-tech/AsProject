#!/usr/bin/env node
/* test-aksesibilitas.cjs — uji browser untuk bab C (kontras + landmark + manifest).
 *
 * Menjalankan axe-core di Chromium headless pada halaman perwakilan, lalu
 * memastikan:
 *   - tidak ada pelanggaran kontras warna (WCAG AA),
 *   - tidak ada pelanggaran region / landmark (isi di luar landmark),
 *   - setiap halaman punya tepat satu <main> dan satu <h1>,
 *   - setiap halaman menautkan manifest PWA dan berkasnya terjangkau.
 *
 * Prasyarat: server lokal `python3 tools/serve.py 8080` dan paket dev
 * playwright-core, @sparticuz/chromium, axe-core.
 * Di lingkungan tanpa pustaka sistem Chromium, setel LD_LIBRARY_PATH ke
 * folder lib hasil ekstraksi @sparticuz/chromium (biasanya /tmp/al2023/lib).
 *
 * Pakai: node tools/test-aksesibilitas.cjs      (exit 0 = lulus)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'));
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PORT = process.env.PORT || 8080;

const HALAMAN = [
  'index.html',
  'undangan.html?demo=1',
  'studio.html',
  'master.html?demo=1',
  'scan.html',
  'katalog-demo/index.html',
  'katalog-demo/undangan-sky-blue.html',
  'katalog-demo/undangan-sage.html',
  'katalog-demo/undangan-wedding-gold.html',
  'katalog-demo/galeri-kerangka.html',
  'demo/aqiqah.html',
];

let lulus = 0, gagal = 0;
const cek = (ok, pesan) => { console.log(`${ok ? '  ok  ' : '  GAGAL '}${pesan}`); ok ? lulus++ : gagal++; };

(async () => {
  const { default: sparticuz } = await import(path.join(ROOT, 'node_modules/@sparticuz/chromium/build/index.js'));
  const browser = await chromium.launch({
    executablePath: await sparticuz.executablePath(),
    /* sengaja tanpa sparticuz.args: daftar itu memuat --single-process yang
       membuat peramban mati saat halaman ditutup berulang kali */
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-color-profile=srgb'],
    headless: true,
  });

  for (const halaman of HALAMAN) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => console.log(`  (galat JS ${halaman}: ${String(e).split('\n')[0].slice(0, 90)})`));
    try {
      await page.route('**/*', r => r.request().url().startsWith(`http://localhost:${PORT}/`) ? r.continue() : r.abort());
      await page.goto(`http://localhost:${PORT}/${halaman}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(700);
      /* tunggu animasi selesai agar warna yang diukur keadaan akhir */
      await page.evaluate(() => Promise.race([
        Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, 3000)),
      ]));
      await page.addScriptTag({ content: AXE });
      const hasil = await page.evaluate(async () => {
        const r = await axe.run(document);
        const ambil = id => (r.violations.find(v => v.id === id) || { nodes: [] }).nodes.length;
        return {
          kontras: ambil('color-contrast'),
          region: ambil('region'),
          main: ambil('landmark-one-main'),
          h1: ambil('page-has-heading-one'),
          mainGanda: ambil('landmark-no-duplicate-main'),
          jumlahMain: document.querySelectorAll('main, [role="main"]').length,
          jumlahH1: document.querySelectorAll('h1').length,
          manifest: !!document.querySelector('link[rel="manifest"]'),
        };
      });
      cek(hasil.kontras === 0, `${halaman}: kontras warna (${hasil.kontras} temuan)`);
      cek(hasil.region === 0, `${halaman}: semua isi di dalam landmark (${hasil.region} region)`);
      cek(hasil.main === 0 && hasil.mainGanda === 0 && hasil.jumlahMain === 1,
        `${halaman}: tepat satu <main> (${hasil.jumlahMain})`);
      cek(hasil.h1 === 0 && hasil.jumlahH1 >= 1, `${halaman}: punya <h1> (${hasil.jumlahH1})`);
      cek(hasil.manifest, `${halaman}: menautkan manifest PWA`);
    } catch (e) {
      cek(false, `${halaman}: ${String(e).split('\n')[0].slice(0, 140)}`);
    }
    await page.close();
  }

  /* manifest & ikon terjangkau dari server */
  const page = await browser.newPage();
  const r = await page.goto(`http://localhost:${PORT}/manifest.webmanifest`, { timeout: 15000 }).catch(() => null);
  cek(!!r && r.ok(), 'manifest.webmanifest terjangkau (HTTP ' + (r ? r.status() : '-') + ')');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const i of man.icons) {
    const rr = await page.goto(`http://localhost:${PORT}/${i.src.replace(/^\//, '')}`, { timeout: 15000 }).catch(() => null);
    cek(!!rr && rr.ok(), `ikon ${i.src} terjangkau`);
  }
  await page.close();
  await browser.close();

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error(String(e).split('\n')[0]); process.exit(1); });
