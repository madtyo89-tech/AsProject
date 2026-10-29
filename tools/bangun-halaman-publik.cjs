#!/usr/bin/env node
/* Bangun halaman harga, katalog, kategori acara, detail template, dan kepercayaan.
   Sumber daftar template/harga: kerangka/template.js (single source of truth).
   Jalankan dari akar repo: node tools/bangun-halaman-publik.cjs
*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { TEMPLATES } = require('../kerangka/template.js');
const motor = require('../kerangka/motor.js');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://asproject.my.id';
const WA = '6285196755675';
const PUBLIC = TEMPLATES.filter(t => !t.studioOnly).map(t => ({ ...t, ...motor.kompilasiLama(t) }));
// Display order only: keep registry/TPL indexes untouched, but surface the
// ten newest public releases first in catalog and category listings.
const NEW_TEMPLATE_IDS = [
  'gerbang-rosewood', 'gerbang-sage-pearl', 'gerbang-midnight-navy',
  'gerbang-khitanan-emerald', 'gerbang-aqiqah-natural', 'gerbang-pesta-ceria',
  'liquid-glass', 'liquid-glass-khitanan', 'liquid-glass-ultah', 'liquid-glass-aqiqah'
];
const PUBLIC_BY_ID = new Map(PUBLIC.map(t => [t.id, t]));
const PUBLIC_DISPLAY = [
  ...NEW_TEMPLATE_IDS.map(id => PUBLIC_BY_ID.get(id)).filter(Boolean),
  ...PUBLIC.filter(t => !NEW_TEMPLATE_IDS.includes(t.id))
];
const TODAY = '2026-10-21';
const EVENTS = {
  pernikahan: {
    label: 'Pernikahan', slug: 'pernikahan', title: 'Undangan Pernikahan Digital',
    description: 'Pilih tema undangan pernikahan digital AsProject, lihat demo interaktif gratis, dan periksa rincian harga serta ketentuan sebelum memesan.',
    intro: 'Jelajahi tema untuk akad dan resepsi. Setiap tombol demo membuka renderer undangan langsung dengan data contoh—bukan tangkapan layar atau testimoni pelanggan.'
  },
  khitanan: {
    label: 'Khitanan', slug: 'khitanan', title: 'Undangan Khitanan Digital',
    description: 'Tema undangan khitanan digital AsProject dengan demo interaktif, RSVP, lokasi, dan informasi harga yang transparan.',
    intro: 'Lihat pilihan tema khitanan bernuansa ceria maupun islami. Coba demonya sendiri sebelum menghubungi admin.'
  },
  ultah: {
    label: 'Ulang Tahun', slug: 'ulang-tahun', title: 'Undangan Ulang Tahun Digital',
    description: 'Tema undangan ulang tahun digital untuk anak dan dewasa. Coba demo AsProject gratis tanpa menghubungi admin.',
    intro: 'Pilih desain untuk pesta anak, sweet seventeen, atau perayaan usia dewasa. Demo memakai nama dan foto contoh.'
  },
  aqiqah: {
    label: 'Aqiqah', slug: 'aqiqah', title: 'Undangan Aqiqah Digital',
    description: 'Tema undangan aqiqah digital AsProject. Lihat demo live, fitur yang tersedia, harga katalog, dan ketentuan sebelum memesan.',
    intro: 'Temukan tema aqiqah bernuansa lembut dan islami. Pratinjau ini merupakan demo produk, bukan hasil acara pelanggan.'
  }
};
const TRUST = [
  { slug: 'kebijakan-privasi', title: 'Kebijakan Privasi', description: 'Cara AsProject menggunakan dan menyimpan data undangan, tamu, RSVP, serta informasi acara.' },
  { slug: 'syarat-ketentuan', title: 'Syarat & Ketentuan', description: 'Ketentuan pemesanan, pembayaran, materi pelanggan, revisi, masa aktif, dan penggunaan undangan digital AsProject.' },
  { slug: 'kebijakan-pengembalian', title: 'Kebijakan Pengembalian', description: 'Informasi pembatalan, keluhan layanan, perbaikan, dan pengembalian dana AsProject sebelum transaksi.' },
  { slug: 'kontak', title: 'Kontak AsProject', description: 'Hubungi AsProject melalui WhatsApp, email, atau Instagram untuk bertanya tentang undangan digital.' },
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function js(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
function eventOf(t) { return t.ev === 'all' ? EVENTS.pernikahan : EVENTS[t.ev] || EVENTS.pernikahan; }
function baseFor(rel) {
  const depth = rel.split('/').length - 1;
  return '../'.repeat(depth);
}
function waLink(message) {
  return `https://wa.me/${WA}?text=${encodeURIComponent(message)}`;
}
function canonical(rel) {
  const clean = rel.endsWith('index.html') ? rel.slice(0, -'index.html'.length) : rel;
  return `${ORIGIN}/${clean}`;
}
function orgSchema() {
  return {
    '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'AsProject', url: `${ORIGIN}/`,
    email: 'hello@asproject.my.id', telephone: '+62-851-9675-5675',
    sameAs: ['https://instagram.com/asproject.my.id']
  };
}
function pageTemplate({ rel, title, description, body, schema = [], breadcrumbs = [], robots = 'index,follow' }) {
  const base = baseFor(rel);
  const url = canonical(rel);
  const crumbItems = [
    { name: 'Beranda', item: `${ORIGIN}/` },
    ...breadcrumbs.map(b => ({ name: b.name, item: b.item.startsWith('http') ? b.item : `${ORIGIN}${b.item}` })),
    { name: title, item: url }
  ];
  const graph = [
    { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: 'AsProject', inLanguage: 'id', publisher: { '@id': `${ORIGIN}/#org` } },
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'id', isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#org` } },
    { '@type': 'BreadcrumbList', itemListElement: crumbItems.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.item })) },
    ...schema
  ];
  const nav = [
    ['Beranda', base], ['Katalog', `${base}katalog/`], ['Harga', `${base}harga/`],
    ['Pernikahan', `${base}undangan/pernikahan/`], ['Khitanan', `${base}undangan/khitanan/`],
    ['Ulang tahun', `${base}undangan/ulang-tahun/`], ['Aqiqah', `${base}undangan/aqiqah/`]
  ];
  const trustLinks = TRUST.map(item => `<a href="${base}${item.slug}/">${esc(item.title)}</a>`).join('\n        ');
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | AsProject</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#19150f">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AsProject">
  <meta property="og:title" content="${esc(title)} | AsProject">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ORIGIN}/assets/og-asproject.png">
  <meta property="og:locale" content="id_ID">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="${base}assets/favicon.svg">
  <link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">
  <link rel="manifest" href="${base}manifest.webmanifest">
  <link rel="stylesheet" href="${base}assets/marketing.css">
  <script type="application/ld+json">${js({ '@context': 'https://schema.org', '@graph': [orgSchema(), ...graph] })}</script>
</head>
<body class="ap-page">
  <header class="ap-header">
    <div class="ap-wrap ap-nav">
      <a class="ap-brand" href="${base}" aria-label="AsProject — beranda"><img src="${base}assets/logo-asproject.svg" alt="" width="34" height="34"><span>AsProject</span></a>
      <nav aria-label="Navigasi utama">${nav.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join(' ')}</nav>
      <a class="ap-btn ap-btn-wa ap-nav-cta" href="${waLink('Halo AsProject, saya ingin bertanya tentang undangan digital. Mohon informasikan harga dan ketentuan yang berlaku.') }" target="_blank" rel="noopener noreferrer">Tanya via WhatsApp</a>
    </div>
  </header>
  <main class="ap-wrap ap-main">
    ${body}
  </main>
  <footer class="ap-footer">
    <div class="ap-wrap ap-footer-grid">
      <div><a class="ap-brand" href="${base}"><img src="${base}assets/logo-asproject.svg" alt="" width="30" height="30"><span>AsProject</span></a><p>Undangan digital untuk momen spesial. Demo dapat dicoba tanpa menghubungi admin.</p></div>
      <div><strong>Jelajahi</strong><a href="${base}katalog/">Katalog template</a><a href="${base}harga/">Harga & ketentuan</a><a href="${base}undangan/pernikahan/">Undangan pernikahan</a><a href="${base}undangan/khitanan/">Undangan khitanan</a><a href="${base}undangan/ulang-tahun/">Undangan ulang tahun</a><a href="${base}undangan/aqiqah/">Undangan aqiqah</a></div>
      <div><strong>Kepercayaan & kontak</strong>${trustLinks}<a href="https://wa.me/${WA}" target="_blank" rel="noopener noreferrer">WhatsApp 0851-9675-5675</a><a href="mailto:hello@asproject.my.id">hello@asproject.my.id</a></div>
    </div>
    <div class="ap-wrap ap-copyright">© ${TODAY.slice(0, 4)} AsProject · Bandung, Indonesia</div>
  </footer>
</body>
</html>
`;
}
function write(rel, content) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}
function faqSchema(items) {
  return { '@type': 'FAQPage', mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
}
function knownTermsNote(base = '') {
  return `<aside class="ap-notice" role="note"><strong>Catatan ketentuan:</strong> harga Rp49.000 berasal dari harga yang tercatat pada katalog template. Batas tamu/RSVP, masa aktif link, status watermark, ruang lingkup revisi, metode pembayaran, dan lama aktif setelah acara belum dijelaskan pada informasi produk yang tersedia. Minta jawaban tertulis dari admin sebelum membayar.</aside>`;
}
function faqSection(items) {
  return `<section class="ap-section"><div class="ap-section-heading"><p class="ap-eyebrow">FAQ</p><h2>Pertanyaan sebelum memesan</h2></div><div class="ap-faq">${items.map(({ q, a }) => `<details><summary>${esc(q)}</summary><div class="ap-answer">${a}</div></details>`).join('')}</div></section>`;
}
function templateCard(t, base) {
  const ev = eventOf(t);
  const detail = `${base}template/${t.id}/`;
  const demo = `${base}undangan.html?demo=1&amp;tpl=${encodeURIComponent(t.id)}&amp;buka=1`;
  const newBadge = t.badge === 'NEW TEMPLATE' ? '<span class="ap-new-badge">NEW TEMPLATE</span>' : '';
  return `<article class="ap-template-card">
    <div class="ap-swatch" style="--swatch-a:${esc(t.g?.[0] || '#f8f3e9')};--swatch-b:${esc(t.g?.[2] || '#c7a873')}"><span>${esc(ev.label)}</span>${newBadge}<strong>${esc(t.char || t.nama)}</strong></div>
    <div class="ap-template-card-body"><p class="ap-eyebrow">${esc(ev.label)}</p><h3><a href="${detail}">${esc(t.nama)}</a></h3><p>${esc(t.desc || `Tema undangan digital ${ev.label.toLowerCase()} ${t.nama}.`)}</p><p class="ap-card-price">Rp ${Number(t.harga || 49000).toLocaleString('id-ID')}</p><div class="ap-card-actions"><a class="ap-btn ap-btn-dark" href="${demo}">Coba demo</a><a class="ap-btn ap-btn-light" href="${detail}">Detail tema</a></div></div>
  </article>`;
}
function templateSchema(t, rel) {
  const ev = eventOf(t);
  const url = canonical(rel);
  return {
    '@type': 'Product', '@id': `${url}#product`, name: `Undangan Digital ${ev.label} — ${t.nama}`,
    description: t.desc || `Tema undangan digital ${ev.label.toLowerCase()} ${t.nama} dari AsProject.`,
    category: `Undangan digital/${ev.label}`,
    brand: { '@id': `${ORIGIN}/#org` },
    offers: { '@type': 'Offer', url, priceCurrency: 'IDR', price: String(t.harga || 49000), seller: { '@id': `${ORIGIN}/#org` } }
  };
}

const generated = [];
const faqBasic = [
  { q: 'Bagaimana cara pesan?', a: 'Pilih tema, buka demo tanpa menghubungi admin, lalu hubungi AsProject untuk meminta rincian tertulis. Pastikan harga, isi layanan, dan ketentuan sudah jelas sebelum membayar.' },
  { q: 'Berapa lama undangan dibuat?', a: 'Lama pengerjaan belum dicantumkan sebagai SLA publik. Admin perlu mengonfirmasi estimasi dan tanggal selesai sebelum pembayaran.' },
  { q: 'Apakah undangan bisa saya ubah sendiri?', a: 'Studio menyediakan editor untuk mengubah data draft. Perubahan pada link yang sudah terbit perlu dipublikasikan ulang agar tampil di undangan live.' },
  { q: 'Metode pembayaran apa yang tersedia?', a: 'Situs ini tidak memproses pembayaran dan metode pembayaran belum dicantumkan. Hubungi AsProject melalui halaman kontak untuk meminta rincian dan memverifikasi instruksi sebelum membayar.' }
];

// Beranda katalog mandiri.
{
  const rel = 'katalog/index.html';
  const base = baseFor(rel);
  const cards = PUBLIC_DISPLAY.map(t => templateCard(t, base)).join('\n');
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><span>Katalog template</span></nav>
  <section class="ap-hero ap-hero-compact"><div><p class="ap-eyebrow">Katalog AsProject</p><h1>Template undangan digital</h1><p class="ap-lead">Sepuluh template terbaru—6 Gerbang Arch dan 4 Liquid Glass—tampil pertama, diikuti ${PUBLIC.length - NEW_TEMPLATE_IDS.length} tema lain untuk pernikahan, khitanan, ulang tahun, dan aqiqah. Setiap halaman tema memiliki demo live yang dapat dibuka tanpa chat admin.</p><div class="ap-actions"><a class="ap-btn ap-btn-dark" href="#semua-template">Lihat 10 template terbaru</a><a class="ap-btn ap-btn-light" href="${base}harga/">Lihat harga & ketentuan</a></div></div><div class="ap-hero-note"><strong>Demo ≠ portofolio klien</strong><p>Pratinjau memakai data contoh dari renderer undangan. Kami tidak menganggapnya sebagai hasil acara pelanggan atau testimoni.</p></div></section>
  <section class="ap-section"><div class="ap-section-heading"><p class="ap-eyebrow">Pilih kategori</p><h2>Temukan tema sesuai acara</h2></div><div class="ap-category-links">${Object.values(EVENTS).map(e => `<a class="ap-category-pill" href="${base}undangan/${e.slug}/">Undangan ${esc(e.label)} <span>→</span></a>`).join('')}</div></section>
  <section class="ap-section" id="semua-template"><div class="ap-section-heading"><p class="ap-eyebrow">Template terbaru tampil pertama</p><h2>${PUBLIC.length} tema yang bisa dicoba</h2><p>Sepuluh kartu pertama di bawah ini berlabel NEW TEMPLATE. Harga katalog saat ini Rp49.000 per tema. Ketentuan layanan lain perlu dikonfirmasi sebelum transaksi.</p></div><div class="ap-template-grid">${cards}</div></section>
  ${knownTermsNote(base)}
  ${faqSection(faqBasic)}`;
  const schema = [
    { '@type': 'CollectionPage', name: 'Katalog Template Undangan Digital AsProject', url: canonical(rel), description: `Katalog ${PUBLIC.length} template undangan digital AsProject.` },
    { '@type': 'ItemList', name: 'Template undangan digital AsProject', numberOfItems: PUBLIC_DISPLAY.length, itemListElement: PUBLIC_DISPLAY.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/template/${t.id}/`, name: t.nama })) },
    faqSchema(faqBasic)
  ];
  write(rel, pageTemplate({ rel, title: 'Katalog Template Undangan Digital', description: `Jelajahi ${PUBLIC.length} tema undangan digital pernikahan, khitanan, ulang tahun, dan aqiqah. Coba demo live gratis sebelum bertanya ke admin.`, body, schema, breadcrumbs: [{ name: 'Katalog', item: '/katalog/' }] }));
  generated.push(rel);
}

// Harga, revisi, domain, payment dan ketentuan operasional.
{
  const rel = 'harga/index.html';
  const base = baseFor(rel);
  const items = [
    { q: 'Bagaimana cara pesan?', a: faqBasic[0].a },
    { q: 'Berapa lama undangan jadi?', a: faqBasic[1].a },
    { q: 'Bisa edit sendiri?', a: faqBasic[2].a },
    { q: 'Metode pembayaran apa yang tersedia?', a: faqBasic[3].a },
    { q: 'Apa arti revisi unlimited?', a: 'Tidak ada komitmen “revisi unlimited” yang dirinci pada informasi produk yang tersedia. Sebelum membayar, minta admin menuliskan jumlah revisi serta apakah revisi hanya mencakup teks/foto atau juga tema, layout, dan perubahan fitur.' },
    { q: 'Berapa batas tamu atau RSVP?', a: 'Batas tamu dan RSVP belum disebutkan dalam katalog. Minta admin mengonfirmasi angka maksimum, apakah RSVP aktif pada pilihan Anda, dan biaya jika ada sebelum membayar.' },
    { q: 'Berapa lama link asproject.my.id aktif setelah acara?', a: 'Durasi aktif link dan kebijakan setelah acara belum dipublikasikan. Pastikan tanggal kedaluwarsa atau masa aktif tertulis di konfirmasi pesanan.' },
    { q: 'Apakah undangan memiliki watermark?', a: 'Status watermark belum disebutkan di katalog. Tanyakan dan minta konfirmasi tertulis sebelum pembayaran.' }
  ];
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><span>Harga</span></nav>
  <section class="ap-hero ap-hero-compact"><div><p class="ap-eyebrow">Harga & ketentuan</p><h1>Harga jelas, ketentuan juga harus jelas</h1><p class="ap-lead">Katalog sumber mencatat harga Rp49.000 untuk setiap template publik. Rincian batas pemakaian yang belum tersedia kami tandai terbuka di bawah—jangan menebak atau membayar sebelum mendapat konfirmasi.</p><div class="ap-actions"><a class="ap-btn ap-btn-wa" href="${waLink('Halo AsProject, saya ingin konfirmasi harga Rp49.000 dan ketentuan masa aktif, kuota tamu/RSVP, watermark, revisi, serta pembayaran sebelum memesan.') }" target="_blank" rel="noopener noreferrer">Konfirmasi via WhatsApp</a><a class="ap-btn ap-btn-light" href="${base}katalog/">Lihat demo tema</a></div></div></section>
  <section class="ap-section"><div class="ap-section-heading"><p class="ap-eyebrow">Daftar harga</p><h2>Harga katalog yang tercatat per tema</h2><p>Data template publik mencatat Rp49.000 untuk setiap tema (${PUBLIC.length} template publik). Minta admin memastikan harga akhir serta rincian pesanan sebelum pembayaran.</p></div><div class="ap-table-wrap"><table class="ap-table"><thead><tr><th scope="col">Satuan harga tercatat</th><th scope="col">Harga katalog</th><th scope="col">Fitur</th><th scope="col">Batas tamu / RSVP</th><th scope="col">Masa aktif link</th><th scope="col">Watermark</th></tr></thead><tbody><tr><th scope="row">Per tema katalog</th><td><strong>Rp49.000</strong></td><td>Ini adalah harga yang tersimpan pada data tema, bukan rincian kontrak pesanan. Renderer menyediakan pengaturan acara, lokasi, galeri, RSVP/ucapan, amplop digital, musik, dan link tamu; fitur yang termasuk dalam pesanan harus dikonfirmasi tertulis.</td><td><span class="ap-status-unknown">Belum dicantumkan</span></td><td><span class="ap-status-unknown">Belum dicantumkan</span></td><td><span class="ap-status-unknown">Belum dicantumkan</span></td></tr></tbody></table></div>${knownTermsNote(base)}</section>
  <section class="ap-section ap-section-tint"><div class="ap-section-heading"><p class="ap-eyebrow">Revisi & masa layanan</p><h2>Jangan mengandalkan asumsi</h2></div><div class="ap-grid ap-grid-2"><article class="ap-card"><h3>Revisi</h3><p>Website belum menetapkan batas atau arti “revisi unlimited”. Minta jawaban tertulis untuk jumlah revisi, perubahan teks/foto, ganti tema/layout, perubahan fitur, serta batas waktu revisi.</p></article><article class="ap-card"><h3>Domain & masa aktif</h3><p>Link undangan menggunakan domain AsProject (format <code>asproject.my.id/u/slug</code>). Masa aktif setelah hari acara belum dipublikasikan. Minta tanggal berakhir/masa aktif di konfirmasi pesanan.</p></article><article class="ap-card"><h3>Watermark & kuota</h3><p>Status watermark dan batas nama tamu/RSVP belum tersedia secara publik. Tanyakan sebelum membayar; jangan menganggap kuota tidak terbatas atau undangan bebas watermark.</p></article><article class="ap-card"><h3>Pembayaran</h3><p>Situs tidak memproses pembayaran dan metode pembayaran belum dicantumkan. Minta rincian metode dan rekening tujuan melalui kontak AsProject, lalu pastikan detailnya jelas sebelum membayar.</p></article></div></section>
  ${faqSection(items)}`;
  const schema = [
    { '@type': 'Service', name: 'Undangan digital AsProject', serviceType: 'Pembuatan undangan digital', provider: { '@id': `${ORIGIN}/#org` }, areaServed: { '@type': 'Country', name: 'Indonesia' }, offers: { '@type': 'AggregateOffer', priceCurrency: 'IDR', lowPrice: 49000, highPrice: 49000, offerCount: PUBLIC.length, url: canonical(rel) } },
    faqSchema(items)
  ];
  write(rel, pageTemplate({ rel, title: 'Harga Undangan Digital AsProject', description: 'Harga katalog Rp49.000 per tema. Cek tabel batas tamu, RSVP, masa aktif domain, watermark, revisi, pembayaran, dan FAQ sebelum memesan.', body, schema, breadcrumbs: [{ name: 'Harga', item: '/harga/' }] }));
  generated.push(rel);
}

// Halaman kategori dengan listing yang cocok dan FAQ ringkas.
for (const event of Object.values(EVENTS)) {
  const rel = `undangan/${event.slug}/index.html`;
  const base = baseFor(rel);
  const templates = PUBLIC_DISPLAY.filter(t => t.ev === event.slug || t.ev === event.slug.replace('ulang-tahun', 'ultah') || t.ev === 'all');
  const unique = [...new Map(templates.map(t => [t.id, t])).values()];
  const items = [
    { q: `Apakah demo undangan ${event.label.toLowerCase()} bisa dicoba gratis?`, a: 'Ya. Tombol “Coba demo” membuka renderer undangan dengan data contoh, tanpa perlu chat admin.' },
    { q: 'Berapa harga template?', a: 'Harga yang tercatat di katalog adalah Rp49.000 per tema. Batas tamu, masa aktif, watermark, dan lingkup revisi harus dikonfirmasi sebelum pembayaran.' },
    { q: 'Bagaimana memesan?', a: 'Pilih tema, coba demonya, lalu hubungi admin di WhatsApp untuk meminta rincian dan konfirmasi tertulis.' }
  ];
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><a href="${base}katalog/">Katalog</a><span>›</span><span>${esc(event.label)}</span></nav>
  <section class="ap-hero ap-hero-compact"><div><p class="ap-eyebrow">Kategori undangan</p><h1>${esc(event.title)}</h1><p class="ap-lead">${esc(event.intro)}</p><div class="ap-actions"><a class="ap-btn ap-btn-dark" href="#tema">Pilih tema ${esc(event.label.toLowerCase())}</a><a class="ap-btn ap-btn-light" href="${base}harga/">Cek harga & ketentuan</a></div></div><div class="ap-hero-note"><strong>Demo langsung</strong><p>Nama, tanggal, dan gambar dalam demo adalah data contoh, bukan dokumentasi acara pelanggan.</p></div></section>
  <section class="ap-section" id="tema"><div class="ap-section-heading"><p class="ap-eyebrow">Tema ${esc(event.label)}</p><h2>${unique.length} pilihan untuk dijelajahi</h2><p>Setiap tema memiliki halaman detail, harga katalog, fitur, dan tombol demo tersendiri.</p></div><div class="ap-template-grid">${unique.map(t => templateCard(t, base)).join('')}</div></section>
  <section class="ap-section ap-section-tint"><div class="ap-section-heading"><p class="ap-eyebrow">Sebelum memesan</p><h2>Pastikan kebutuhan acara cocok</h2><p>Periksa masa aktif link, batas tamu/RSVP, watermark, revisi, dan metode pembayaran langsung dengan admin sebelum transfer.</p><a class="ap-btn ap-btn-wa" href="${waLink(`Halo AsProject, saya mencari undangan digital untuk acara ${event.label.toLowerCase()}. Mohon konfirmasi tema, harga, fitur, masa aktif, batas tamu/RSVP, watermark, revisi, dan metode pembayaran.`)}" target="_blank" rel="noopener noreferrer">Tanya admin via WhatsApp</a></div></section>
  ${faqSection(items)}`;
  const schema = [
    { '@type': 'CollectionPage', name: event.title, url: canonical(rel), description: event.description, mainEntity: { '@type': 'ItemList', numberOfItems: unique.length, itemListElement: unique.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/template/${t.id}/`, name: t.nama })) } },
    { '@type': 'Service', name: event.title, serviceType: event.title, provider: { '@id': `${ORIGIN}/#org` }, areaServed: { '@type': 'Country', name: 'Indonesia' }, offers: { '@type': 'Offer', priceCurrency: 'IDR', price: 49000, url: canonical(rel) } },
    faqSchema(items)
  ];
  write(rel, pageTemplate({ rel, title: event.title, description: event.description, body, schema, breadcrumbs: [{ name: 'Katalog', item: '/katalog/' }, { name: event.label, item: `/undangan/${event.slug}/` }] }));
  generated.push(rel);
}

// Halaman detail unik untuk setiap template publik.
for (const t of PUBLIC) {
  const rel = `template/${t.id}/index.html`;
  const base = baseFor(rel);
  const event = eventOf(t);
  const title = `Undangan ${event.label} ${t.nama}`;
  const description = `${t.desc || `Tema undangan digital ${event.label.toLowerCase()} ${t.nama}.`} Lihat preview interaktif, harga katalog, fitur, dan ketentuan AsProject.`;
  const demo = `${base}undangan.html?demo=1&amp;tpl=${encodeURIComponent(t.id)}&amp;buka=1`;
  const items = [
    { q: `Bisakah saya melihat demo ${t.nama}?`, a: `Ya. <a href="${demo}">Buka demo interaktif</a> tanpa menghubungi admin. Demo memakai data contoh, bukan hasil pelanggan.` },
    { q: 'Berapa harganya?', a: 'Harga katalog yang tercatat untuk tema ini adalah Rp49.000. Minta admin memastikan harga akhir dan ketentuan sebelum pembayaran.' },
    { q: 'Apakah revisi dan masa aktif sudah termasuk?', a: 'Batas revisi, jenis perubahan yang diizinkan, masa aktif link, batas tamu/RSVP, serta watermark belum dirinci secara publik. Minta konfirmasi tertulis sebelum membayar.' }
  ];
  const featureList = [
    `Kategori acara: ${event.label}`,
    `Palet visual: ${t.g.join(' · ')}`,
    `Deskripsi tema: ${t.desc || t.nama}`,
    'Demo live memakai renderer undangan AsProject dengan data contoh',
    'Pengaturan acara di Studio; fitur yang digunakan mengikuti konfigurasi serta kesepakatan pesanan'
  ];
  const product = templateSchema(t, rel);
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><a href="${base}katalog/">Katalog</a><span>›</span><a href="${base}undangan/${event.slug}/">${esc(event.label)}</a><span>›</span><span>${esc(t.nama)}</span></nav>
  <section class="ap-hero ap-product-hero"><div class="ap-product-grid"><div class="ap-preview-column"><div class="ap-preview-frame"><iframe src="${base}undangan.html?demo=1&amp;kartu=1&amp;tpl=${encodeURIComponent(t.id)}" title="Preview demo tema ${esc(t.nama)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="ap-caption">Demo produk dengan nama, tanggal, dan gambar contoh. Ini bukan undangan pelanggan atau testimoni.</p><a class="ap-btn ap-btn-light" href="${demo}">Buka demo interaktif ukuran penuh ↗</a></div><div class="ap-product-copy"><p class="ap-eyebrow">${esc(event.label)} · Detail tema</p>${t.badge === 'NEW TEMPLATE' ? '<span class="ap-new-badge">NEW TEMPLATE</span>' : ''}<h1>${esc(title)}</h1><p class="ap-lead">${esc(t.desc || `Tema undangan digital ${event.label.toLowerCase()} ${t.nama}.`)}</p><p class="ap-price">Rp ${Number(t.harga || 49000).toLocaleString('id-ID')} <span>harga katalog per tema</span></p><p>Harga ini adalah data katalog template; admin perlu mengonfirmasi harga akhir dan lingkup layanan sebelum pembayaran.</p><ul class="ap-feature-list">${featureList.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="ap-actions ap-actions-stack"><a class="ap-btn ap-btn-wa" href="${waLink(`Halo AsProject, saya tertarik dengan tema ${t.nama} untuk ${event.label.toLowerCase()}. Mohon konfirmasi fitur yang termasuk, kuota tamu/RSVP, masa aktif, watermark, revisi, estimasi, dan metode pembayaran.`)}" target="_blank" rel="noopener noreferrer">Tanya fitur & harga via WhatsApp</a><a class="ap-btn ap-btn-dark" href="${demo}">Coba demo tanpa chat</a></div><p class="ap-caption">Tidak ada formulir pembayaran di situs. Jangan transfer sebelum menerima rincian pesanan tertulis.</p></div></div></section>
  ${knownTermsNote(base)}
  <section class="ap-section"><div class="ap-section-heading"><p class="ap-eyebrow">Fitur & ketentuan</p><h2>Yang perlu dipastikan</h2></div><div class="ap-grid ap-grid-2"><article class="ap-card"><h3>Pengaturan undangan</h3><p>Studio AsProject menyediakan pengaturan data acara dan opsi konten seperti lokasi, galeri, RSVP/ucapan, amplop digital, musik, serta link tamu. Minta admin menegaskan fitur yang termasuk pada pesanan ${esc(t.nama)}.</p></article><article class="ap-card"><h3>Kuota dan masa aktif</h3><p>Batas tamu/RSVP dan berapa lama link tetap aktif setelah acara belum dipublikasikan. Minta jawaban tertulis sebelum pembayaran.</p></article><article class="ap-card"><h3>Revisi</h3><p>Jangan menganggap revisi unlimited. Minta admin menjelaskan revisi teks/foto, perubahan tema atau layout, jumlah, dan batas waktu.</p></article><article class="ap-card"><h3>Watermark & harga akhir</h3><p>Watermark dan kemungkinan biaya tambahan belum dijelaskan di katalog. Konfirmasi keduanya di pesan WhatsApp sebelum transfer.</p></article></div></section>
  ${faqSection(items)}`;
  const schema = [product, faqSchema(items)];
  write(rel, pageTemplate({ rel, title, description, body, schema, breadcrumbs: [{ name: 'Katalog', item: '/katalog/' }, { name: event.label, item: `/undangan/${event.slug}/` }, { name: t.nama, item: `/template/${t.id}/` }] }));
  generated.push(rel);
}

// Privacy, terms, refund and contact pages. Unknown business-specific values are stated as unknown.
const privacyRel = 'kebijakan-privasi/index.html';
{
  const rel = privacyRel, base = baseFor(rel);
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><span>Kebijakan Privasi</span></nav><header class="ap-page-heading"><p class="ap-eyebrow">Privasi & data</p><h1>Kebijakan Privasi</h1><p class="ap-caption">Terakhir ditinjau ${TODAY}. Kebijakan ini menjelaskan data yang dapat diproses saat membuat dan memakai undangan AsProject.</p></header>
  <div class="ap-prose"><div class="ap-notice ap-notice-warn"><strong>Penting untuk diketahui:</strong> halaman undangan memang dirancang untuk dibagikan secara publik. Skema database yang dipakai aplikasi saat ini mengizinkan pembacaan draft melalui akses publik aplikasi. Jangan memasukkan data rahasia (mis. nomor identitas, kata sandi, data finansial pribadi, atau alamat rumah yang tidak ingin disebarkan). Gunakan hanya informasi yang memang ingin ditampilkan kepada penerima undangan.</div>
  <h2>Data yang dapat diproses</h2><ul><li>Data pemesan dan acara: nama, gelar, tanggal/jam, lokasi, peta, teks undangan, foto/video, pilihan desain, serta tautan musik yang Anda masukkan.</li><li>Data tamu: nama tamu, tautan personal, RSVP/ucapan, dan catatan check-in bila fitur tersebut diaktifkan.</li><li>Data amplop digital: nomor rekening/e-wallet dan nama pemilik yang secara sukarela Anda masukkan agar ditampilkan pada undangan.</li><li>Data komunikasi yang Anda kirim melalui WhatsApp atau email saat meminta bantuan.</li></ul>
  <h2>Tujuan pemrosesan</h2><p>Data digunakan untuk menyusun, memublikasikan, memperbarui, dan menampilkan undangan; menerima RSVP/ucapan; membantu panitia mencatat kehadiran; serta menjawab pertanyaan pemesan.</p>
  <h2>Siapa yang dapat melihat atau mengubah data</h2><p>Isi undangan live dapat dilihat siapa pun yang menerima atau menemukan URL-nya. RSVP dan fitur check-in juga dirancang agar dapat dipakai dari halaman publik. Skema database aplikasi yang tersedia di repo saat ini memberi akses publik tanpa login untuk membaca, membuat, dan memperbarui draft. Artinya, URL bukan lapisan otorisasi yang kuat dan penyimpanan ini tidak boleh diperlakukan sebagai tempat rahasia. Jangan masukkan data sensitif. Perlindungan lebih ketat memerlukan penyesuaian backend/RLS sebelum layanan dipakai untuk data yang harus privat.</p>
  <h2>Penyedia layanan pihak ketiga</h2><p>Halaman statis di-host melalui GitHub Pages; data undangan/RSVP/check-in menggunakan Supabase; tombol chat membuka WhatsApp; peta dapat memuat layanan pemetaan atau ubin peta pihak ketiga. Saat Anda membuka layanan tersebut, penyedia masing-masing dapat menerima data teknis seperti alamat IP, URL, dan permintaan yang diperlukan untuk melayani fitur.</p>
  <h2>Penyimpanan, penghapusan, dan permintaan</h2><p>Jangka retensi data dan masa aktif undangan belum ditetapkan secara publik. Untuk bertanya atau meminta akses, koreksi, maupun penghapusan data, hubungi <a href="${base}kontak/">kontak AsProject</a> dan jelaskan permintaan secara umum. Proses verifikasi dan waktu penanganan belum dicantumkan. Jangan mengirim kata sandi atau kunci admin melalui kanal publik.</p>
  <h2>Materi dan privasi tamu</h2><p>Sebelum membagikan undangan, periksa kembali nama, alamat, foto, rekening, dan informasi lain yang akan terlihat oleh penerima link. Pertimbangkan memberi tahu tamu bahwa RSVP, ucapan, atau check-in dapat ditampilkan atau diproses sesuai fitur yang digunakan.</p>
  <h2>Peninjauan informasi</h2><p>Tanggal di bagian atas menunjukkan kapan halaman ini terakhir ditinjau. Jika konfigurasi penyimpanan, fitur, atau penyedia layanan berubah, informasi pada halaman ini perlu diperiksa kembali.</p></div>`;
  write(rel, pageTemplate({ rel, title: 'Kebijakan Privasi AsProject', description: 'Kebijakan privasi AsProject tentang data undangan, tamu, RSVP, check-in, amplop digital, penyedia layanan, dan permintaan penghapusan.', body, breadcrumbs: [{ name: 'Kebijakan Privasi', item: '/kebijakan-privasi/' }] }));
  generated.push(rel);
}
const termsRel = 'syarat-ketentuan/index.html';
{
  const rel = termsRel, base = baseFor(rel);
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><span>Syarat & Ketentuan</span></nav><header class="ap-page-heading"><p class="ap-eyebrow">Ketentuan layanan</p><h1>Syarat & Ketentuan</h1><p class="ap-caption">Terakhir ditinjau ${TODAY}. Rincian pesanan final harus dikonfirmasi tertulis oleh admin sebelum pembayaran.</p></header>
  <div class="ap-prose"><div class="ap-notice"><strong>Informasi yang tersedia:</strong> harga katalog yang tercatat adalah Rp49.000 per tema. Situs ini tidak memiliki checkout. Batas tamu, masa aktif link, status watermark, jumlah/jenis revisi, waktu pengerjaan, dan metode pembayaran belum dinyatakan sebagai ketentuan final oleh pemilik; minta rincian tertulis sebelum membayar. Halaman ini merangkum informasi situs dan tidak menetapkan nilai atau prosedur yang belum diberikan.</div>
  <h2>Demo dan pemesanan</h2><p>Demo tema dapat dibuka tanpa menghubungi admin. Demo memakai data dan gambar contoh untuk memperlihatkan renderer; demo bukan hasil acara pelanggan dan bukan jaminan bahwa semua fitur akan diaktifkan pada pesanan.</p><p>Alur pemesanan dan syarat final belum dirinci di situs. Sebelum membayar, minta rincian tertulis mengenai tema, harga akhir, fitur, kuota tamu/RSVP, masa aktif, watermark, ruang lingkup revisi, estimasi selesai, dan metode pembayaran.</p>
  <h2>Materi undangan</h2><p>Sebelum membagikan link, periksa ketepatan nama, tanggal, lokasi, tautan, rekening, foto, dan musik yang ditampilkan. Gunakan hanya materi yang memang boleh dipakai dan informasi yang Anda ingin bagikan kepada penerima.</p>
  <h2>Revisi dan perubahan</h2><p>Website belum menetapkan arti atau jumlah “revisi unlimited”. Jenis revisi (teks/foto, tema, layout, atau fitur) dan tenggat harus dijelaskan di konfirmasi pesanan. Jangan berasumsi perubahan tema atau desain besar termasuk tanpa biaya tambahan.</p>
  <h2>Publikasi dan masa aktif</h2><p>Undangan dipublikasikan di link AsProject agar dapat dibuka tamu. Siapa pun yang memiliki URL dapat melihat isi yang ditampilkan. Lama aktif setelah acara dan tanggal penghapusan data belum dipublikasikan; minta tanggal berakhir atau ketentuan masa aktif tertulis.</p>
  <h2>Pembayaran</h2><p>Pembayaran tidak diproses di halaman web ini dan metode maupun rekening tujuan belum dicantumkan. Hubungi AsProject melalui kontak pada situs untuk meminta informasi yang berlaku, lalu verifikasi rincian sebelum melakukan transfer.</p>
  <h2>Kontak</h2><p>Untuk klarifikasi atau koreksi, hubungi <a href="${base}kontak/">AsProject</a> sebelum melakukan pembayaran.</p></div>`;
  write(rel, pageTemplate({ rel, title: 'Syarat & Ketentuan AsProject', description: 'Syarat layanan undangan digital AsProject: demo, pemesanan, materi pelanggan, revisi, pembayaran, publikasi, dan masa aktif.', body, breadcrumbs: [{ name: 'Syarat & Ketentuan', item: '/syarat-ketentuan/' }] }));
  generated.push(rel);
}
const refundRel = 'kebijakan-pengembalian/index.html';
{
  const rel = refundRel, base = baseFor(rel);
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><span>Kebijakan Pengembalian</span></nav><header class="ap-page-heading"><p class="ap-eyebrow">Pembatalan & keluhan</p><h1>Kebijakan Pengembalian</h1><p class="ap-caption">Terakhir ditinjau ${TODAY}.</p></header>
  <div class="ap-prose"><div class="ap-notice ap-notice-warn"><strong>Belum ada aturan nominal/waktu pengembalian yang dipublikasikan.</strong> Karena itu, minta admin mengirim ketentuan pembatalan dan pengembalian secara tertulis sebelum transfer. Jangan membayar bila syaratnya belum jelas.</div>
  <h2>Jika hasil bermasalah</h2><p>Hubungi admin melalui WhatsApp atau email yang tercantum di <a href="${base}kontak/">halaman kontak</a>. Sertakan ringkasan pesanan, bukti pembayaran, URL undangan, dan tangkapan layar masalah. Jangan mengirim data sensitif yang tidak diperlukan.</p>
  <h2>Perbaikan layanan</h2><p>Prosedur perbaikan, kategori kesalahan, tenggat pelaporan, dan biaya belum dipublikasikan. Jika ini memengaruhi keputusan Anda, minta admin menjelaskan opsi yang berlaku untuk pesanan sebelum membayar.</p>
  <h2>Pembatalan dan pengembalian dana</h2><p>Website saat ini tidak menjanjikan persentase atau batas waktu pengembalian tertentu. Sebelum pembayaran, minta admin menjelaskan secara tertulis apa yang berlaku jika pesanan dibatalkan sebelum pengerjaan, saat pengerjaan berlangsung, setelah preview, atau setelah hasil diterima. Simpan konfirmasi tersebut.</p>
  <h2>Pembayaran</h2><p>AsProject tidak memproses pembayaran di situs dan metode pembayaran belum dicantumkan. Verifikasi metode serta rekening tujuan melalui kontak AsProject yang tertera di situs sebelum melakukan transfer.</p></div>`;
  write(rel, pageTemplate({ rel, title: 'Kebijakan Pengembalian AsProject', description: 'Informasi pembatalan pesanan, keluhan hasil, perbaikan, dan pengembalian dana. Konfirmasi ketentuan tertulis sebelum pembayaran.', body, breadcrumbs: [{ name: 'Kebijakan Pengembalian', item: '/kebijakan-pengembalian/' }] }));
  generated.push(rel);
}
const contactRel = 'kontak/index.html';
{
  const rel = contactRel, base = baseFor(rel);
  const body = `<nav class="ap-breadcrumb" aria-label="Breadcrumb"><a href="${base}">Beranda</a><span>›</span><span>Kontak</span></nav><section class="ap-hero ap-hero-compact"><div><p class="ap-eyebrow">Hubungi kami</p><h1>Kontak AsProject</h1><p class="ap-lead">Tanyakan harga akhir, fitur, kuota tamu/RSVP, revisi, masa aktif link, watermark, estimasi pengerjaan, pembayaran, atau penghapusan data sebelum memesan.</p><div class="ap-actions"><a class="ap-btn ap-btn-wa" href="${waLink('Halo AsProject, saya ingin bertanya tentang undangan digital dan informasi yang tersedia sebelum memutuskan.') }" target="_blank" rel="noopener noreferrer">Tanya via WhatsApp</a><a class="ap-btn ap-btn-light" href="mailto:hello@asproject.my.id">Kirim email</a></div></div></section><section class="ap-section"><div class="ap-grid ap-grid-3"><article class="ap-card"><p class="ap-eyebrow">WhatsApp</p><h2>0851-9675-5675</h2><a href="https://wa.me/${WA}" target="_blank" rel="noopener noreferrer">Buka chat resmi ↗</a></article><article class="ap-card"><p class="ap-eyebrow">Email</p><h2>hello@asproject.my.id</h2><a href="mailto:hello@asproject.my.id">Tulis email ↗</a></article><article class="ap-card"><p class="ap-eyebrow">Instagram</p><h2>@asproject.my.id</h2><a href="https://instagram.com/asproject.my.id" target="_blank" rel="noopener noreferrer">Buka Instagram ↗</a></article></div><p class="ap-caption ap-contact-note">Jam operasional dan waktu respons belum dicantumkan di situs. Mohon konfirmasi estimasi balasan saat menghubungi admin.</p></section><section class="ap-section ap-section-tint"><h2>Sebelum mengirim pesan</h2><p>Sebutkan tema dan kategori acara. Jangan mengirim nomor identitas, kata sandi, atau data rahasia melalui chat. Sebelum membagikan data acara, tanyakan informasi apa yang diperlukan dan pastikan Anda memahami rincian layanan yang ditawarkan.</p></section>`;
  const schema = [{ '@type': 'ContactPage', '@id': `${canonical(rel)}#webpage`, name: 'Kontak AsProject', url: canonical(rel), mainEntity: orgSchema() }];
  write(rel, pageTemplate({ rel, title: 'Kontak AsProject', description: 'Kontak resmi AsProject: WhatsApp 0851-9675-5675, email hello@asproject.my.id, dan Instagram @asproject.my.id.', body, schema, breadcrumbs: [{ name: 'Kontak', item: '/kontak/' }] }));
  generated.push(rel);
}

// Keep the legacy modal's "Demo Live" link on the same production renderer as
// the new product pages, rather than routing customers to old static mockups.
{
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const byName = Object.fromEntries(PUBLIC.map(t => [t.nama, `undangan.html?demo=1&tpl=${encodeURIComponent(t.id)}&buka=1`]));
  const byCategory = {};
  for (const [key, event] of [['Pernikahan', 'pernikahan'], ['Khitanan', 'khitanan'], ['Ulang Tahun', 'ultah'], ['Aqiqah', 'aqiqah']]) {
    const t = PUBLIC.find(x => x.ev === event) || PUBLIC.find(x => x.ev === 'all');
    if (t) byCategory[key] = [`undangan.html?demo=1&tpl=${encodeURIComponent(t.id)}&buka=1`];
  }
  const block = `var DEMO_BY_NAME = ${JSON.stringify(byName)}; var DEMO_BY_CATEGORY = ${JSON.stringify(byCategory)};`;
  const pattern = /var DEMO_BY_NAME\s*=\s*\{[\s\S]*?\};\s*var DEMO_BY_CATEGORY\s*=\s*\{[\s\S]*?\};/;
  if (!pattern.test(html)) throw new Error('DEMO_BY_NAME/DEMO_BY_CATEGORY block not found in index.html');
  html = html.replace(pattern, block);
  html = html.replace('Katalog tema AsProject — demo per tema menunjuk ke salinan templat di katalog-demo/.', 'Demo Live memakai renderer undangan produksi dengan data contoh; arsip katalog-demo tidak dipakai sebagai listing produk.');
  fs.writeFileSync(indexPath, html, 'utf8');
}

// Public URL inventory used to regenerate sitemap.xml and tests.
const publicPaths = [
  '/', '/katalog/', '/harga/',
  ...Object.values(EVENTS).map(e => `/undangan/${e.slug}/`),
  ...PUBLIC.map(t => `/template/${t.id}/`),
  ...TRUST.map(t => `/${t.slug}/`)
];
fs.writeFileSync(path.join(ROOT, 'tools/public-page-urls.json'), JSON.stringify(publicPaths, null, 2) + '\n');
console.log(`Generated ${generated.length} HTML pages (${PUBLIC.length} template details, ${Object.keys(EVENTS).length} categories, ${TRUST.length} trust pages, catalog and pricing).`);
console.log(`Public sitemap routes: ${publicPaths.length} (plus existing demos listed separately).`);
