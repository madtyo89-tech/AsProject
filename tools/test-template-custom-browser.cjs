// Uji Playwright untuk alur template kustom dan 15 model cover pembuka.
// Jalankan server lokal tools/serve.py 8080, lalu: node tools/test-template-custom-browser.cjs
// @sparticuz/chromium membutuhkan direktori pustaka Amazon Linux yang dibundel.
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { chromium: playwright } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { default: chromium } = await import('@sparticuz/chromium');
  const browser = await playwright.launch({
    executablePath: await chromium.executablePath(), args: chromium.args, headless: true,
  });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith('http://localhost:8080/')
      ? route.continue() : route.abort());
    await page.addInitScript(() => {
      if (location.origin === 'http://localhost:8080')
        localStorage.setItem('asproject_studio_auth', '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e');
    });
    await page.goto('http://localhost:8080/studio.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof state === 'object' && !!document.querySelector('#root'));
    await page.evaluate(() => {
      if (!state.started) startInvitation();
      set('tab', 'desain');
    });
    await page.locator('#tplCustomName').waitFor();
    const coverLayouts = ['amplop', 'kartu', 'foto', 'gerbang', 'minimal', 'batik', 'sakura', 'night', 'ticket', 'editorial', 'polaroid', 'glass', 'royal', 'archive', 'neon'];
    assert.equal(await page.locator('.cv-layout-btn').count(), 15, 'Studio menampilkan 15 pilihan cover');
    const shots = path.join(process.cwd(), '.preview-shots');
    fs.mkdirSync(shots, { recursive: true });
    await page.locator('#floatPrev').evaluate(el => { if (el) el.style.display = 'none'; });
    await page.locator('.cv-layout-grid').screenshot({ path: path.join(shots, '32-mobile-15-model-cover.png'), animations: 'disabled' });
    for (const id of coverLayouts) {
      await page.locator(`[data-layout="${id}"]`).click();
      await page.waitForFunction(layout => {
        const frame = document.querySelector('#phoneWrap iframe.pv-frame');
        const doc = frame && frame.contentDocument;
        return !!(doc && doc.querySelector('#cover') && (layout === 'amplop'
          ? ![...doc.body.classList].some(cls => cls.startsWith('cvl-'))
          : doc.body.classList.contains('cvl-' + layout)));
      }, id, { timeout: 10000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        `${id}: layout Studio tidak menyebabkan overflow horizontal`);
    }
    assert.equal(await page.evaluate(() => state.coverLayout), 'neon', 'layout terakhir tersimpan aktif');
    for (const width of [320, 360, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        `pemilih 15 cover tetap responsif pada ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    async function captureCover(layout, filename) {
      const coverPage = await context.newPage();
      coverPage.on('pageerror', e => errors.push(e.message));
      await coverPage.route('**/*', route => route.request().url().startsWith('http://localhost:8080/')
        ? route.continue() : route.abort());
      await coverPage.setViewportSize({ width: 390, height: 844 });
      await coverPage.goto('http://localhost:8080/undangan.html?demo=1', { waitUntil: 'domcontentloaded' });
      await coverPage.evaluate(id => {
        Object.assign(DEMO_DRAFT.data.form, {
          namaPria: 'Rangga Pratama', namaWanita: 'Alya Zahra', tanggalAcara: '2026-12-28', venue: 'Bandung',
        });
        DEMO_DRAFT.data.cover = 'assets/demo/wedding/02-minimalist-sage.jpg';
        DEMO_DRAFT.data.coverStyle = 'kotak';
        DEMO_DRAFT.data.coverStyleExplicit = true;
        DEMO_DRAFT.data.coverLayout = id;
      }, layout);
      await coverPage.waitForFunction(id => document.body.classList.contains('cvl-' + id)
        && !!document.querySelector('#cover'), layout, { timeout: 10000 });
      await coverPage.waitForFunction(() => {
        const image = document.querySelector('#cover .cvf img');
        return !image || (image.complete && image.naturalWidth > 0);
      });
      await coverPage.screenshot({ path: path.join(shots, filename), animations: 'disabled' });
      await coverPage.close();
    }
    await captureCover('batik', '33-cover-batik-nusantara.png');
    await captureCover('neon', '34-cover-neon-kota.png');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      'pemilih cover bebas overflow setelah seluruh uji layout');
    assert.match(await page.locator('.tpl-save-card').innerText(), /Simpan sebagai Template Baru/);
    assert.match(await page.locator('.tpl-save-card').innerText(), /Tambahkan ke Katalog Publik/);
    assert.equal(await page.locator('#tplCustomPublic').isChecked(), false, 'pilihan awal harus khusus Studio');

    await page.locator('#tplCustomName').fill('Tema Kebun Bandung');
    await page.locator('.tpl-save-card').screenshot({ path: path.join(shots, '29-mobile-simpan-template.png') });
    await page.getByRole('button', { name: /Simpan sebagai Template Baru/ }).click();
    await page.waitForFunction(() => state.tplCustom.some(t => t.nama === 'Tema Kebun Bandung'));
    const privateId = await page.evaluate(() => state.tplCustom.find(t => t.nama === 'Tema Kebun Bandung').id);
    assert.equal(await page.evaluate(id => state.tplCustom.find(t => t.id === id).design.coverLayout, privateId), 'neon',
      'template kustom menyimpan model cover baru yang dipilih');
    assert.equal(await page.evaluate(id => state.tpl === id, privateId), true, 'tema baru langsung dipilih');
    assert.equal(await page.evaluate(id => state.katalog.every(k => (k.tpl || k.id) !== id), privateId), true,
      'tema tanpa centang tidak masuk katalog publik');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      'kartu simpan tidak menimbulkan overflow horizontal pada layar ponsel');
    await page.locator('.editor-actions .mobile-menu').click();
    const pickerRow = page.locator('.tpl-custom-entry').filter({ hasText: 'Tema Kebun Bandung' });
    await pickerRow.waitFor();
    assert.equal(await pickerRow.isVisible(), true, 'picker custom dapat dibuka dari menu ponsel');
    assert.equal(await pickerRow.locator('.tpl-custom-actions button').count(), 3, 'aksi pengelolaan tampil di ponsel');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      'picker custom tidak menimbulkan overflow horizontal pada layar ponsel');
    await page.evaluate(() => document.body.classList.remove('studio-nav-open'));

    await page.setViewportSize({ width: 1280, height: 900 });
    await pickerRow.scrollIntoViewIfNeeded();
    await pickerRow.screenshot({ path: path.join(shots, '30-desktop-template-kustom.png'), animations: 'disabled' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(id => state.tplCustom.some(t => t.id === id), privateId);
    assert.equal(await page.evaluate(id => {
      const d = JSON.parse(localStorage.getItem('asproject_studio_v3') || '{}');
      return Array.isArray(d.tplCustom) && d.tplCustom.some(t => t.id === id);
    }, privateId), true, 'tema kustom bertahan setelah halaman dimuat ulang');

    page.once('dialog', dialog => dialog.accept('Tema Kebun Bandung Dirapikan'));
    await page.getByRole('button', { name: 'Ganti nama template Tema Kebun Bandung' }).click();
    await page.waitForFunction(() => state.tplCustom.some(t => t.nama === 'Tema Kebun Bandung Dirapikan'));
    assert.equal(await page.locator('.tpl-custom-entry').filter({ hasText: 'Tema Kebun Bandung Dirapikan' }).count(), 1,
      'nama baru tampil pada pilihan tema');

    await page.getByRole('button', { name: 'Duplikat template Tema Kebun Bandung Dirapikan' }).click();
    await page.waitForFunction(() => state.tplCustom.some(t => t.nama === 'Tema Kebun Bandung Dirapikan — Salinan'));
    const duplicateId = await page.evaluate(() => state.tplCustom.find(t => t.nama === 'Tema Kebun Bandung Dirapikan — Salinan').id);
    assert.notEqual(duplicateId, privateId, 'salinan memakai id berbeda');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Hapus template Tema Kebun Bandung Dirapikan — Salinan' }).click();
    await page.waitForFunction(id => !state.tplCustom.some(t => t.id === id), duplicateId);
    assert.equal(await page.evaluate(() => state.tplCustom.length), 1, 'hapus hanya menghilangkan salinan');

    await page.locator('#tplCustomName').fill('Tema Publik Bandung');
    await page.locator('#tplCustomPublic').check();
    await page.getByRole('button', { name: /Simpan sebagai Template Baru/ }).click();
    await page.waitForFunction(() => state.tplCustom.some(t => t.nama === 'Tema Publik Bandung' && !t.studioOnly));
    const publicId = await page.evaluate(() => state.tplCustom.find(t => t.nama === 'Tema Publik Bandung').id);
    assert.equal(await page.evaluate(id => state.katalog.some(k => (k.tpl || k.id) === id), publicId), true,
      'pilihan publik membuat baris katalog otomatis');
    await page.evaluate(() => goPage('katalog'));
    await page.waitForFunction(() => state.page === 'katalog');
    assert.equal(await page.locator('.kat-row input[aria-label="Nama template"]').evaluateAll(inputs =>
      inputs.some(input => input.value === 'Tema Publik Bandung')), true,
      'tema publik tampil pada Katalog Harga & Promo');

    const theme = await page.evaluate(id => state.tplCustom.find(t => t.id === id), publicId);
    assert.equal(theme.design.coverLayout, 'neon', 'model cover tetap ada dalam snapshot custom publik');
    const livePage = await context.newPage();
    livePage.on('pageerror', e => errors.push(e.message));
    await livePage.route('**/*', route => route.request().url().startsWith('http://localhost:8080/')
      ? route.continue() : route.abort());
    await livePage.goto('http://localhost:8080/undangan.html?demo=1', { waitUntil: 'domcontentloaded' });
    await livePage.evaluate(({ id, row }) => {
      DEMO_DRAFT.theme = 0;
      DEMO_DRAFT.data.tpl = id;
      DEMO_DRAFT.data.tplCustom = [row];
      DEMO_DRAFT.data.cover = '';
      DEMO_DRAFT.data.coverLayout = row.design && row.design.coverLayout || 'amplop';
    }, { id: publicId, row: theme });
    await livePage.waitForFunction(id => document.body.classList.contains('theme-' + id), publicId);
    if (theme.design && theme.design.coverLayout === 'neon')
      await livePage.waitForFunction(() => document.body.classList.contains('cvl-neon'));
    const liveAccent = await livePage.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
    assert.equal(liveAccent, theme.accent, 'renderer undangan live menggunakan aksen template kustom');
    const openTrigger = livePage.locator('#cover #btnOpen');
    assert.equal(await openTrigger.count(), 1, 'pemicu buka undangan live tampil di cover');
    assert.equal(await openTrigger.getAttribute('role'), 'button', 'pemicu buka diumumkan sebagai tombol');
    assert.equal(await openTrigger.getAttribute('aria-label'), 'Buka undangan', 'pemicu buka punya nama aksesibel');
    await livePage.screenshot({ path: path.join(shots, '31-undangan-live-template-kustom.png'), animations: 'disabled' });

    const homePage = await context.newPage();
    homePage.on('pageerror', e => errors.push(e.message));
    await homePage.route('**/*', route => route.request().url().startsWith('http://localhost:8080/')
      ? route.continue() : route.abort());
    await homePage.setViewportSize({ width: 320, height: 844 });
    await homePage.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' });
    await homePage.waitForFunction(() => document.querySelector('.catalog-grid')
      && document.querySelector('#asp-home-showcase') && document.querySelector('#asp-public-info'), null, { timeout: 20000 });
    for (const width of [320, 360, 390, 430, 768, 1280]) {
      await homePage.setViewportSize({ width, height: 844 });
      const audit = await homePage.evaluate(() => {
        const oldTestimonials = document.querySelector('#testimoni');
        const unsupported = /500\+ klien bahagia|revisi sepuasnya|jadi 1 hari|Jadi dalam 1 hari/i.test(document.body.innerText);
        const unverifiedBadges = [...document.querySelectorAll('.catalog-art span')]
          .some(badge => /^(bestseller|terlaris|favorit|\d+(?:\.\d+)?\s*(?:\/\s*5|bintang))$/i.test(badge.textContent.trim()));
        return {
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          transparentDemoNote: document.querySelector('#asp-demo')?.innerText.includes('bukan testimoni pelanggan'),
          testimonialsHidden: !oldTestimonials || getComputedStyle(oldTestimonials).display === 'none',
          unsupported,
          unverifiedBadges,
        };
      });
      assert(audit.documentWidth <= width + 1, `homepage has no horizontal overflow at ${width}px (${audit.documentWidth}px)`);
      assert(audit.transparentDemoNote && audit.testimonialsHidden && !audit.unsupported && !audit.unverifiedBadges,
        `homepage hides unsupported social proof and discloses demo data at ${width}px`);
    }
    await homePage.close();
    console.log('PASS: homepage fits 320–1280px and labels demo material without unsupported social proof.');

    assert.deepEqual(errors, [], 'tidak ada error JavaScript di browser');
    console.log('PASS: kartu simpan Bahasa Indonesia, default Studio-only, tampilan ponsel, simpan dan persistensi lokal.');
    console.log('PASS: ganti nama, duplikat, hapus, serta tambah ke Katalog Publik.');
    console.log('PASS: 15 model cover tampil di Studio, dirender live, dan layout neon tersimpan pada tema kustom.');
    console.log('PASS: 6 screenshot #29–34 disimpan di .preview-shots/; tidak ada error JavaScript.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
