#!/usr/bin/env node
/* Playwright layout audit for public marketing, active-demo, and archived demo
   routes at phone, tablet, and desktop widths. Run tools/serve.py on :8080. */
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { chromium: playwright } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKETING_ROUTES = require(path.join(ROOT, 'tools/public-page-urls.json'));
const ACTIVE_DEMOS = [
  '/demo/aqiqah.html', '/demo/khitanan-basic.html', '/demo/khitanan-premium.html',
  '/demo/ultah-anak.html', '/demo/wedding-premium.html',
];
const ARCHIVE_DEMOS = [
  '/demo/ice-blue.html',
  ...fs.readdirSync(path.join(ROOT, 'katalog-demo')).filter(name => name.endsWith('.html'))
    .map(name => `/katalog-demo/${name}`),
];
const ROUTES = [...MARKETING_ROUTES, ...ACTIVE_DEMOS, ...ARCHIVE_DEMOS];
const WIDTHS = [320, 360, 390, 430, 768, 1280];
const ORIGIN = 'http://localhost:8080';

(async () => {
  const { default: chromium } = await import('@sparticuz/chromium');
  const browser = await playwright.launch({
    executablePath: await chromium.executablePath(), args: chromium.args, headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: WIDTHS[0], height: 844 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => route.request().url().startsWith(ORIGIN + '/')
      ? route.continue() : route.abort());

    let checks = 0;
    for (const route of ROUTES) {
      const pathName = route === '/' ? '/index.html' : route;
      const response = await page.goto(ORIGIN + pathName, { waitUntil: 'domcontentloaded', timeout: 25000 });
      assert(response && response.ok(), `${pathName}: page responds successfully`);
      if (pathName === '/index.html') {
        await page.waitForFunction(() => document.querySelector('.catalog-grid')
          && document.querySelector('#asp-home-showcase') && document.querySelector('#asp-public-info'),
        null, { timeout: 20000 });
      }
      if (ACTIVE_DEMOS.includes(pathName)) {
        await page.waitForFunction(() => document.querySelector('.ap-demo-disclaimer')
          && document.querySelector('.ap-demo-disclaimer').innerText.includes('Bukan testimoni atau bukti acara pelanggan'),
        null, { timeout: 10000 });
        await page.waitForTimeout(120);
        const claims = await page.evaluate(() => /2\.847\+|500\+ klien bahagia|4\.9\/5|revisi unlimited|best seller|pasangan terbantu|paling banyak dipilih pasangan|no\. 1|aktif selamanya|no watermark|custom domain|dalam 5 menit|balasan\s*<\s*5 menit|chat whatsapp support premium/i.test(document.body.innerText));
        assert.equal(claims, false, `${pathName}: demo discloses sample data without unverified marketing claims`);
      }

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const layout = await page.evaluate(() => {
          const viewport = innerWidth;
          const overflows = [...document.querySelectorAll('body *')].filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && (rect.right > viewport + 2 || rect.left < -2)
              && getComputedStyle(el).position !== 'fixed';
          }).slice(0, 4).map(el => {
            const name = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = typeof el.className === 'string' && el.className.trim()
              ? `.${el.className.trim().replace(/\s+/g, '.')}` : '';
            return `${name}${id}${classes}`;
          });
          return {
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            overflows,
          };
        });
        assert(layout.documentWidth <= width + 1 && layout.bodyWidth <= width + 1,
          `${pathName} overflows at ${width}px: document=${layout.documentWidth}, body=${layout.bodyWidth}; ${layout.overflows.join(', ')}`);
        checks++;
      }
    }
    console.log(`PASS: ${ROUTES.length} marketing/demo/archive routes have no page-level horizontal overflow at ${WIDTHS.join(', ')}px (${checks} viewport checks).`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
