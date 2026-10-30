#!/usr/bin/env node
/* Static SEO/trust/conversion contract for generated public pages. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://asproject.my.id';
const { TEMPLATES } = require('../kerangka/template.js');
const PUBLIC = TEMPLATES.filter(t => !t.studioOnly);
const EVENTS = ['pernikahan', 'khitanan', 'ulang-tahun', 'aqiqah'];
const TRUST = ['kebijakan-privasi', 'syarat-ketentuan', 'kebijakan-pengembalian', 'kontak'];
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const check = (cond, message) => { if (!cond) throw new Error(message); };
const htmlFor = rel => read(rel);

function hasMeta(html, name) { return new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]+"`, 'i').test(html); }
function assertPage(rel, canonical) {
  const html = htmlFor(rel);
  check(/<html lang="id"/i.test(html), `${rel}: Indonesian document language`);
  check(/<title>[^<]{5,}<\/title>/i.test(html), `${rel}: page title`);
  check(hasMeta(html, 'description'), `${rel}: meta description`);
  check(html.includes(`<link rel="canonical" href="${canonical}">`), `${rel}: canonical ${canonical}`);
  check(html.includes('rel="manifest"'), `${rel}: PWA manifest link`);
  check(html.includes('marketing.css'), `${rel}: shared page styles`);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  check(!!ld, `${rel}: JSON-LD graph exists`);
  if (ld) {
    try {
      const schema = JSON.parse(ld[1]);
      check(schema['@context'] === 'https://schema.org' && Array.isArray(schema['@graph']), `${rel}: JSON-LD parses as Schema.org graph`);
    } catch (error) {
      check(false, `${rel}: JSON-LD parses as Schema.org graph (${error.message})`);
    }
  }
  return html;
}

(async () => {
  check(PUBLIC.length === 44, `expected 44 public templates, got ${PUBLIC.length}`);
  check(TEMPLATES.every(t => !t.studioOnly), 'all built-in templates are public (no Studio-only built-ins remain)');
  check(fs.existsSync(path.join(ROOT, 'katalog/index.html')), 'catalog landing page exists');
  check(fs.existsSync(path.join(ROOT, 'harga/index.html')), 'pricing page exists');
  const catalog = assertPage('katalog/index.html', `${ORIGIN}/katalog/`);
  const pricing = assertPage('harga/index.html', `${ORIGIN}/harga/`);
  const studioDemo = assertPage('katalog/studio-demo.html', `${ORIGIN}/katalog/studio-demo.html`);
  check(/<meta\s+name="robots"\s+content="noindex,nofollow"/i.test(studioDemo), 'Studio demo is excluded from search indexing');
  check(catalog.includes('href="../katalog/studio-demo.html"') && studioDemo.includes('assets/studio-demo.css') && studioDemo.includes('assets/studio-demo.js'), 'catalog links to a styled, interactive Studio demo');
  check(catalog.includes('ap-catalog-studio-bottom') && catalog.includes('class="ap-studio-logo-button"') && catalog.includes('aria-label="Buka Studio demo untuk mulai menyusun undangan"'), 'catalog has a clear bottom CTA whose button contains only the AsProject logo and remains accessible');
  check(catalog.includes('ap-studio-cta'), 'top Studio demo CTA is visually emphasized');
  check(catalog.includes('Harga khusus pelanggan baru') && catalog.includes('<del>Rp99.000</del>') && catalog.includes('Rp49.000 per tema') && catalog.includes('tanpa tanggal akhir'), 'catalog shows the approved Rp99.000 normal price crossed out and the Rp49.000 new-customer offer');
  check(studioDemo.includes('sandbox="allow-scripts allow-same-origin"') && studioDemo.includes('preview=1&amp;sandbox=1'), 'invitation preview runs in a restricted iframe sandbox');
  check(studioDemo.includes('tidak bisa disimpan, diterbitkan, atau dibagikan') && studioDemo.includes('Refresh atau buka ulang'), 'Studio demo explains the ephemeral, non-publishing session');
  check(studioDemo.includes('type="reset"') && studioDemo.includes('data-demo-field='), 'Studio demo has editable event details and a reset action');
  check(catalog.includes(`>${PUBLIC.length} tema yang bisa dicoba<`), 'catalog reports the template count');
  check((catalog.match(/>NEW TEMPLATE<\/span>/g) || []).length === 10, 'catalog visibly marks the ten newly published templates as NEW TEMPLATE');
  const newTemplateIds = [
    ...PUBLIC.filter(t => t.arch),
    ...PUBLIC.filter(t => t.id.startsWith('liquid-glass'))
  ].map(t => t.id);
  const catalogIds = [...new Set([...catalog.matchAll(/href="\.\.\/template\/([a-z0-9-]+)\/"/g)].map(m => m[1]))];
  check(JSON.stringify(catalogIds.slice(0, newTemplateIds.length)) === JSON.stringify(newTemplateIds),
    'catalog lists the ten NEW TEMPLATE releases first so they are immediately visible');
  check(catalog.includes('Lihat 10 template terbaru') && catalog.includes('Sepuluh kartu pertama di bawah ini berlabel NEW TEMPLATE'),
    'catalog signposts the newest templates before the full grid');
  check(catalog.includes('portofolio klien') && catalog.includes('data contoh'), 'catalog labels demo material, not customer proof');
  check(catalog.includes('assets/katalog-v2.js') && catalog.includes('data-catalog-controls'), 'catalog V2 enhancement is linked while controls are server-rendered');
  check(catalog.includes('data-category-filter="aqiqah"') && catalog.includes('data-favorites-toggle') && catalog.includes('data-catalog-search'), 'catalog V2 has category, favorite and search controls');
  check(pricing.includes('Batas tamu / RSVP') && pricing.includes('Masa aktif link') && pricing.includes('Watermark'), 'pricing table contains requested columns');
  check(pricing.includes('<del>Rp99.000</del>') && pricing.includes('Rp49.000') && pricing.includes('Belum dicantumkan') && pricing.includes('pelanggan baru') && pricing.includes('tanggal akhir'), 'pricing shows the approved crossed-out price, customer offer, no deadline, and unknown service terms');
  check(pricing.includes('Satuan harga tercatat') && pricing.includes('Per tema katalog') &&
    !pricing.includes('1 tema katalog / 1 undangan'), 'pricing states the source unit without inventing a purchase package');
  check(pricing.includes('apa arti revisi unlimited') || pricing.includes('revisi unlimited'), 'pricing explains revision scope without claiming unlimited');

  for (const slug of EVENTS) {
    const rel = `undangan/${slug}/index.html`;
    const html = assertPage(rel, `${ORIGIN}/undangan/${slug}/`);
    check(html.includes('Coba demo') && html.includes('FAQPage') && html.includes('Penawaran pelanggan baru') && html.includes('<del>Rp 99.000</del>') && html.includes('tanpa tanggal akhir'), `${rel}: demo CTA, FAQ and consistent crossed-out promotional pricing`);
    const eventKey = slug === 'ulang-tahun' ? 'ultah' : slug;
    const expectedNew = newTemplateIds.filter(id => {
      const t = PUBLIC.find(x => x.id === id);
      return t && (t.ev === eventKey || t.ev === 'all');
    });
    const listedIds = [...new Set([...html.matchAll(/href="\.\.\/\.\.\/template\/([a-z0-9-]+)\/"/g)].map(m => m[1]))];
    check(JSON.stringify(listedIds.slice(0, expectedNew.length)) === JSON.stringify(expectedNew),
      `${rel}: newest templates for this category are listed first`);
  }
  for (const t of PUBLIC) {
    const rel = `template/${t.id}/index.html`;
    const canonical = `${ORIGIN}/template/${t.id}/`;
    const html = assertPage(rel, canonical);
    check(html.includes(`Undangan ${t.ev === 'ultah' ? 'Ulang Tahun' : t.ev === 'all' ? 'Pernikahan' : t.ev} ${t.nama}`) || html.includes(t.nama), `${rel}: template-specific title`);
    check(html.includes(`Product`) && html.includes('priceCurrency') && html.includes(String(t.harga || 49000)), `${rel}: Product schema and template price`);
    check(html.includes(`tpl=${t.id}`), `${rel}: preview points at the matching renderer template`);
    check(t.badge !== 'NEW TEMPLATE' || html.includes('>NEW TEMPLATE</span>'), `${rel}: newly published template carries the visible NEW TEMPLATE badge`);
    check(html.includes('Demo memakai data contoh') && html.includes('bukan hasil pelanggan'), `${rel}: preview is clearly labelled`);
    check(html.includes('<del>Rp99.000</del>') && html.includes('harga khusus pelanggan baru per tema') && !html.includes('harga katalog per undangan') && html.includes('tanggal akhir'), `${rel}: approved normal and customer prices are shown per theme without a fake expiry`);
    check(html.includes('wa.me/6285196755675'), `${rel}: order CTA`);
  }
  const trustPages = {};
  for (const slug of TRUST) {
    const rel = `${slug}/index.html`;
    const html = assertPage(rel, `${ORIGIN}/${slug}/`);
    check(html.includes('<h1>') || html.includes('class="ap-hero'), `${rel}: visible page heading`);
    trustPages[slug] = html;
  }
  check(trustPages['kebijakan-privasi'].includes('membaca, membuat, dan memperbarui draft'), 'privacy page discloses current public draft access');
  check(trustPages['kebijakan-privasi'].includes('Proses verifikasi dan waktu penanganan belum dicantumkan'), 'privacy page does not invent an unconfirmed request workflow');
  check(trustPages['syarat-ketentuan'].includes('tidak menetapkan nilai atau prosedur yang belum diberikan') &&
    !trustPages['syarat-ketentuan'].includes('Pesanan baru dianggap disepakati'), 'terms page separates known facts from owner-approved transaction rules');
  check(trustPages['kebijakan-pengembalian'].includes('Belum ada aturan nominal/waktu pengembalian'), 'refund page avoids inventing an unapproved refund promise');

  const home = read('index.html');
  const marketing = read('assets/marketing.js');
  const marketingCss = read('assets/marketing.css');
  check(home.includes('assets/marketing.css') && home.includes('assets/marketing.js'), 'home conversion layer linked');
  check(home.includes('"Ivory Klasik":"undangan.html?demo=1&tpl=ivory-klasik&buka=1"') && home.includes('"Biru Ceria":"undangan.html?demo=1&tpl=biru-ceria&buka=1"'), 'root Demo Live links use the current production renderer for catalog templates');
  check(home.includes('Rp99.000') && home.includes('Rp49.000 per tema') && home.includes('pelanggan baru'), 'home fallback shows the regular and new-customer prices');
  check(marketing.includes('<del>Rp99.000</del>') && marketing.includes('Rp49.000') && marketing.includes('pelanggan baru'), 'homepage pricing card shows the crossed-out regular price and promotional price');
  check(!home.includes('500+') && !/revisi unlimited/i.test(home), 'home has no unverified counter or unlimited-revision claim');
  check(home.includes('kebijakan-privasi/') && home.includes('syarat-ketentuan/') && home.includes('kebijakan-pengembalian/') && home.includes('kontak/'), 'home links to trust pages');
  const featured = marketing.match(/var FEATURED = \[([\s\S]*?)\n  \];/);
  check(featured, 'homepage has a static featured-template selection');
  const featuredItems = featured ? [...featured[1].matchAll(/\{ id:/g)] : [];
  check(featuredItems.length === 8, `homepage renders eight editorial template previews, got ${featuredItems.length}`);
  for (const [, image] of (featured ? [...featured[1].matchAll(/image: '([^']+)'/g)] : [])) {
    check(fs.existsSync(path.join(ROOT, image)), `homepage preview image exists: ${image}`);
  }
  const renderer = read('undangan.html');
  check(renderer.includes("const SANDBOX=Q.get('sandbox')==='1'") && renderer.includes("m.type==='ASPROJECT_DEMO_PREVIEW'") && renderer.includes("window.open=()=>null"), 'invitation renderer accepts sandbox preview updates and blocks outgoing windows');
  const templateCovers = renderer.match(/const _coverByTemplate=\{([\s\S]*?)\};/);
  const coverSource = templateCovers ? templateCovers[1] : '';
  check(templateCovers, 'live demo renderer maps template-specific sample covers');
  for (const [, id] of (featured ? [...featured[1].matchAll(/id: '([^']+)'/g)] : [])) {
    check(coverSource.includes(`'${id}':`), `live demo uses a matching sample cover: ${id}`);
  }
  check(renderer.includes('body.opened.cover-opening #content{opacity:0;visibility:hidden;transition:none;pointer-events:none}') &&
    renderer.includes("body.classList.add('opened','cover-opening')") && renderer.includes('function coverSelesaiDalam()') &&
    renderer.includes('},coverSelesaiDalam());') &&
    renderer.includes("prefers-reduced-motion: reduce") && renderer.includes("body.classList.remove('opened','cover-opening')"),
    'interactive cover reveal follows each opening animation duration; reduced-motion remains immediate');
  check(renderer.includes("document.body.classList.add('opened','embed-buka')") && !renderer.includes("document.body.classList.add('opened','cover-opening')"),
    'auto-open demo stays immediate without the interactive cover delay');
  const homeCategories = marketing.match(/var CATEGORIES = \[([\s\S]*?)\n  \];/);
  const categorySource = homeCategories ? homeCategories[1] : '';
  check(homeCategories && [...categorySource.matchAll(/\{ id:/g)].length === 4, 'homepage has four image-led event categories');
  for (const slug of EVENTS) check(categorySource.includes(`id: '${slug}'`), `homepage category card exists: ${slug}`);
  for (const [, image] of (homeCategories ? [...categorySource.matchAll(/image: '([^']+)'/g)] : [])) {
    check(fs.existsSync(path.join(ROOT, image)), `homepage category image exists: ${image}`);
  }
  check(marketing.includes('Buka demo') && marketing.includes('Lihat Demo') && marketing.includes('Mulai '), 'homepage preview cards include image, demo CTA and price');
  check(marketing.includes('Undangan Digital <span') && marketing.includes('Lihat Template'), 'homepage hero has concise headline and primary template CTA');
  check(marketing.includes('10 template terbaru—6 Gerbang Arch dan 4 Liquid Glass') && marketing.includes('href="#katalog">Lihat 10 template terbaru'),
    'homepage showcase signposts the newest templates at the start of the full catalog');
  check(marketing.includes('Masa aktif link setelah acara belum dicantumkan') && marketing.includes('Apakah ada biaya tambahan?'), 'homepage FAQ discloses unknown service terms');
  check(marketing.includes('Portofolio dan counter pelanggan tidak ditampilkan tanpa bukti'), 'homepage does not fabricate testimonials, portfolio, or customer counters');
  check(marketingCss.includes('html body #aspWaFab{opacity:1!important') && marketingCss.includes('.ap-home-category-grid'), 'homepage keeps the WhatsApp control visible and uses image-led category cards');

  const sitemap = read('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  check(urls.length === 60, `expected 60 sitemap routes (55 marketing + 5 active demos), got ${urls.length}`);
  check(new Set(urls).size === urls.length, 'sitemap URLs are unique');
  for (const p of fs.readdirSync(path.join(ROOT, 'katalog-demo')).filter(f => f.endsWith('.html'))) {
    const legacy = read(`katalog-demo/${p}`);
    check(/<meta\s+name="robots"\s+content="noindex/i.test(legacy), `legacy katalog-demo/${p} is noindex`);
    check(!urls.includes(`${ORIGIN}/katalog-demo/${p}`), `legacy katalog-demo/${p} excluded from sitemap`);
    if (p !== 'index.html') check(legacy.includes('assets/demo-disclaimer.js'), `legacy katalog-demo/${p} labels sample content`);
  }
  const retiredIceBlue = read('demo/ice-blue.html');
  check(/<meta\s+name="robots"\s+content="noindex/i.test(retiredIceBlue) && !urls.includes(`${ORIGIN}/demo/ice-blue.html`), 'retired Ice Blue page is noindex and excluded');
  check(retiredIceBlue.includes('assets/demo-disclaimer.js'), 'retired Ice Blue page labels sample content');
  for (const slug of ['aqiqah', 'khitanan-basic', 'khitanan-premium', 'ultah-anak', 'wedding-premium']) {
    check(read(`demo/${slug}.html`).includes('assets/demo-disclaimer.js'), `demo/${slug}.html labels sample content`);
  }
  check(read('katalog-demo/undangan-sky-blue.html').includes('noindex, follow'), 'legacy Sky Blue mockup is noindex');
  for (const route of ['/katalog/', '/harga/', ...EVENTS.map(e => `/undangan/${e}/`), ...TRUST.map(x => `/${x}/`), ...PUBLIC.map(t => `/template/${t.id}/`)]) {
    check(urls.includes(`${ORIGIN}${route}`), `sitemap includes ${route}`);
  }
  console.log(`PASS: ${PUBLIC.length} product pages, ${EVENTS.length} category pages, ${TRUST.length} trust pages, pricing/catalog pages and sitemap verified.`);
})().catch(err => { console.error('FAIL:', err.message); process.exitCode = 1; });
