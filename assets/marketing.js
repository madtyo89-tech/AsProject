/* Home-page conversion and transparency layer.
   Kept separate from the minified React catalog so marketing claims stay auditable. */
(function () {
  'use strict';

  var root = document.getElementById('root');
  if (!root) return;

  var base = new URL('./', location.href).pathname;
  var WA = '6285196755675';
  var WA_TEXT = encodeURIComponent('Halo AsProject, saya ingin konfirmasi harga dan ketentuan undangan sebelum memesan.');

  // Editorial picks, not sales rankings. Thumbnails are captures of the live renderer using demo data.
  var FEATURED = [
    { id: 'jawa-elegan', name: 'Adat Jawa Elegan', event: 'Pernikahan', image: 'assets/template-preview/jawa-elegan.jpg' },
    { id: 'floral-rustic', name: 'Floral Rustic', event: 'Pernikahan', image: 'assets/template-preview/floral-rustic.jpg' },
    { id: 'biru-ceria', name: 'Biru Ceria', event: 'Khitanan', image: 'assets/template-preview/biru-ceria.jpg' },
    { id: 'islamic-elegant', name: 'Islamic Elegant', event: 'Khitanan', image: 'assets/template-preview/islamic-elegant.jpg' },
    { id: 'kids-party', name: 'Kids Party', event: 'Ulang Tahun', image: 'assets/template-preview/kids-party.jpg' },
    { id: 'sweet-17', name: 'Sweet 17', event: 'Ulang Tahun', image: 'assets/template-preview/sweet-17.jpg' },
    { id: 'baby-boy', name: 'Baby Boy', event: 'Aqiqah', image: 'assets/template-preview/baby-boy.jpg' },
    { id: 'islamic-neutral', name: 'Islamic Neutral', event: 'Aqiqah', image: 'assets/template-preview/islamic-neutral.jpg' }
  ];

  var CATEGORIES = [
    { id: 'pernikahan', name: 'Pernikahan', image: 'assets/demo/wedding/01-jawa-elegan.jpg', note: 'Tema untuk akad dan resepsi.' },
    { id: 'khitanan', name: 'Khitanan', image: 'assets/demo/khitanan/02-biru-ceria.jpg', note: 'Pilihan ceria dan islami.' },
    { id: 'ulang-tahun', name: 'Ulang Tahun', image: 'assets/demo/ultah/01-kids-party.jpg', note: 'Untuk pesta anak hingga dewasa.' },
    { id: 'aqiqah', name: 'Aqiqah', image: 'assets/demo/aqiqah/01-baby-boy.jpg', note: 'Tema lembut untuk menyambut si kecil.' }
  ];

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function findCatalogCard(name) {
    return Array.from(root.querySelectorAll('.catalog-card')).find(function (card) {
      var title = card.querySelector('h3');
      return title && title.textContent.trim() === name;
    }) || null;
  }

  function catalogPrice(name) {
    var card = findCatalogCard(name);
    var match = card && (card.textContent || '').match(/Rp\s*([\d.,]+)/i);
    return match ? 'Rp ' + match[1] : 'Rp49.000';
  }

  function templateCard(item) {
    var demo = base + 'undangan.html?demo=1&amp;tpl=' + encodeURIComponent(item.id) + '&amp;buka=1';
    var detail = base + 'template/' + encodeURIComponent(item.id) + '/';
    return '<article class="ap-home-template-card">' +
      '<a class="ap-home-template-art" href="' + demo + '" target="_blank" rel="noopener" aria-label="Buka demo ' + escapeHtml(item.name) + '">' +
        '<img src="' + base + escapeHtml(item.image) + '" alt="Cuplikan desain demo tema ' + escapeHtml(item.name) + ' dengan data acara contoh" loading="lazy" decoding="async">' +
        '<span class="ap-home-image-badge">' + escapeHtml(item.event) + '</span>' +
        '<span class="ap-home-image-disclaimer">Data contoh</span>' +
      '</a>' +
      '<div class="ap-home-template-copy">' +
        '<div class="ap-home-template-meta"><span>' + escapeHtml(item.event) + '</span><strong>Mulai ' + escapeHtml(catalogPrice(item.name)) + '</strong></div>' +
        '<h3><a href="' + detail + '">' + escapeHtml(item.name) + '</a></h3>' +
        '<div class="ap-home-template-actions"><a class="ap-home-demo-btn" href="' + demo + '" target="_blank" rel="noopener">Lihat Demo</a><a class="ap-home-detail-link" href="' + detail + '">Detail tema <span aria-hidden="true">↗</span></a></div>' +
      '</div>' +
    '</article>';
  }

  function categoryCard(item) {
    var href = base + 'undangan/' + encodeURIComponent(item.id) + '/';
    return '<a class="ap-home-category-card" href="' + href + '">' +
      '<img src="' + base + escapeHtml(item.image) + '" alt="Ilustrasi demo kategori ' + escapeHtml(item.name) + '" loading="lazy" decoding="async">' +
      '<span class="ap-home-category-shade"></span>' +
      '<span class="ap-home-category-badge">Demo · data contoh</span>' +
      '<span class="ap-home-category-copy"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.note) + '</span><em>Jelajahi tema <span aria-hidden="true">→</span></em></span>' +
    '</a>';
  }

  function addHomeShowcase() {
    var catalog = root.querySelector('#katalog');
    if (!catalog || !catalog.parentNode) return null;

    var section = document.getElementById('asp-home-showcase');
    if (section && section.isConnected) return section;

    section = el('div', { id: 'asp-home-showcase', class: 'ap-home-showcase' });
    section.innerHTML =
      '<section id="asp-template-showcase" class="ap-home-block" aria-labelledby="asp-template-title">' +
        '<div class="ap-home-heading"><p class="ap-eyebrow">Baru rilis · pilihan tema</p><h2 id="asp-template-title">Lihat desain sebelum memilih</h2><p><strong>10 template terbaru—6 Gerbang Arch dan 4 Liquid Glass—tampil sebagai kartu pertama di katalog lengkap di bawah.</strong> Delapan cuplikan berikut adalah pilihan editor dari katalog. Foto dan isi preview adalah materi demo dengan data contoh, bukan dokumentasi acara pelanggan.</p></div>' +
        '<div class="ap-home-template-grid">' + FEATURED.map(templateCard).join('') + '</div>' +
        '<div class="ap-home-showcase-foot"><span>Semua tema pada kartu dapat dicoba langsung tanpa menghubungi admin.</span><a href="#katalog">Lihat 10 template terbaru <span aria-hidden="true">↓</span></a><a href="' + base + 'katalog/">Jelajahi 44 tema <span aria-hidden="true">→</span></a></div>' +
      '</section>' +
      '<section id="asp-category-cards" class="ap-home-block ap-home-categories" aria-labelledby="asp-category-title">' +
        '<div class="ap-home-heading"><p class="ap-eyebrow">Pilih jenis acara</p><h2 id="asp-category-title">Temukan kategori undangan</h2><p>Setiap kategori memiliki katalog dan demo mandiri. Gambar di bawah berasal dari materi contoh, bukan foto pelanggan.</p></div>' +
        '<div class="ap-home-category-grid">' + CATEGORIES.map(categoryCard).join('') + '</div>' +
      '</section>';

    catalog.parentNode.insertBefore(section, catalog);
    return section;
  }

  function updateHero() {
    var hero = root.querySelector('section.relative.overflow-hidden');
    if (!hero) return;
    hero.classList.add('ap-home-hero');

    var heading = hero.querySelector('h1');
    var headline = 'Undangan Digital <span class="block font-normal italic text-[var(--sage)]">Elegan untuk Momen Spesial</span>';
    if (heading && heading.innerHTML !== headline) heading.innerHTML = headline;

    var lead = Array.from(hero.querySelectorAll('p')).find(function (paragraph) {
      return /pernikahan, khitanan, ulang tahun/i.test(paragraph.textContent || '');
    });
    var conciseLead = 'Pilih tema untuk pernikahan, khitanan, ulang tahun, atau aqiqah. Coba demo interaktif sebelum memesan.';
    if (lead && lead.textContent.trim() !== conciseLead) lead.textContent = conciseLead;

    var primary = hero.querySelector('.ap-home-primary') || hero.querySelector('a[href="#katalog"]');
    if (primary) {
      primary.classList.add('ap-home-primary');
      primary.href = '#asp-template-showcase';
      primary.textContent = 'Lihat Template';
      primary.setAttribute('aria-label', 'Lihat pilihan template undangan');
    }

    var secondary = hero.querySelector('.ap-home-secondary') || hero.querySelector('a[href*="wa.me/6285196755675"]');
    if (secondary) {
      secondary.classList.add('ap-home-secondary');
      secondary.textContent = 'Tanya via WhatsApp';
      secondary.setAttribute('aria-label', 'Tanya AsProject melalui WhatsApp');
    }
  }

  function replacementSections() {
    var box = document.getElementById('asp-public-info');
    if (box && box.isConnected) return box;

    var catalog = root.querySelector('#katalog');
    if (!catalog) return null;

    box = el('div', { id: 'asp-public-info', class: 'ap-injected' });
    box.innerHTML =
      '<section id="asp-demo" class="ap-wrap ap-section ap-social-proof-note">' +
        '<div class="ap-section-heading"><p class="ap-eyebrow">Transparansi</p><h2>Preview tema bukan testimoni pelanggan</h2><p>Foto dan tampilan pada bagian demo menggunakan materi contoh. Belum ada ulasan pelanggan bernama/tanggal, tautan undangan terpakai, atau screenshot dengan izin publikasi yang bisa diverifikasi di situs ini.</p></div>' +
        '<div class="ap-social-proof-card"><span class="ap-social-proof-icon" aria-hidden="true">i</span><div><strong>Portofolio dan counter pelanggan tidak ditampilkan tanpa bukti.</strong><p>Demo live setiap tema dapat dicoba langsung. Nama, tanggal acara, tautan, dan screenshot pelanggan hanya akan ditambahkan setelah ada bukti asli serta izin publikasi.</p></div></div>' +
        '<div class="ap-home-demo-links"><a href="' + base + 'undangan.html?demo=1&amp;tpl=jawa-elegan&amp;buka=1">Demo pernikahan</a><a href="' + base + 'undangan.html?demo=1&amp;tpl=biru-ceria&amp;buka=1">Demo khitanan</a><a href="' + base + 'undangan.html?demo=1&amp;tpl=kids-party&amp;buka=1">Demo ulang tahun</a><a href="' + base + 'undangan.html?demo=1&amp;tpl=baby-boy&amp;buka=1">Demo aqiqah</a></div>' +
      '</section>' +
      '<section id="asp-harga" class="ap-wrap ap-section">' +
        '<div class="ap-section-heading"><p class="ap-eyebrow">Harga khusus pelanggan baru</p><h2><del>Rp99.000</del> menjadi Rp49.000 per tema</h2><p>Harga khusus untuk pelanggan baru, tanpa tanggal akhir yang ditetapkan. Konfirmasi rincian layanan dan pesanan secara tertulis sebelum membayar.</p></div>' +
        '<div class="ap-home-price-layout">' +
          '<article class="ap-home-price-card"><p class="ap-eyebrow">Penawaran pelanggan baru</p><div class="ap-home-price"><del>Rp99.000</del> Rp49.000 <span>/ tema · pelanggan baru · tanpa tanggal akhir</span></div><p>Harga khusus ini berlaku untuk pelanggan baru. Konfirmasi rincian layanan dan pesanan secara tertulis sebelum membayar.</p><ul><li>44 tema tersedia untuk dijelajahi</li><li>Demo interaktif dapat dicoba langsung</li><li>Fitur yang termasuk mengikuti konfigurasi pesanan</li></ul><div class="ap-home-price-actions"><a class="ap-btn ap-btn-wa" href="https://wa.me/' + WA + '?text=' + WA_TEXT + '" target="_blank" rel="noopener noreferrer">Konfirmasi harga & ketentuan</a><a class="ap-home-detail-link" href="' + base + 'harga/">Lihat rincian harga <span aria-hidden="true">→</span></a></div></article>' +
          '<div class="ap-home-terms-grid"><article><span>Kuota tamu & RSVP</span><strong>Belum dicantumkan</strong></article><article><span>Masa aktif & watermark</span><strong>Belum dicantumkan</strong></article><article><span>Revisi, estimasi & biaya tambahan</span><strong>Perlu konfirmasi tertulis</strong></article></div>' +
        '</div>' +
        '<p class="ap-caption ap-home-price-note">Penawaran pelanggan baru tidak memiliki tanggal akhir yang ditetapkan saat ini. Paket bertingkat (mis. Basic/Premium/Plus) belum dipublikasikan; minta admin menuliskan fitur, kuota, masa aktif, revisi, biaya tambahan, dan tanggal selesai sebelum transaksi.</p>' +
      '</section>' +
      '<section id="asp-faq" class="ap-wrap ap-section">' +
        '<div class="ap-section-heading"><p class="ap-eyebrow">FAQ singkat</p><h2>Sebelum memesan</h2></div>' +
        '<div class="ap-faq">' +
          '<details><summary>Bagaimana cara memesan?</summary><div class="ap-answer">Pilih tema, coba demo, lalu hubungi admin untuk menerima rincian tertulis mengenai harga akhir, fitur, kuota, revisi, estimasi pengerjaan, dan metode pembayaran.</div></details>' +
          '<details><summary>Berapa lama undangan selesai?</summary><div class="ap-answer">Estimasi/SLA pengerjaan belum dipublikasikan. Minta admin menyebutkan estimasi dan tanggal selesai sebelum pembayaran.</div></details>' +
          '<details><summary>Apakah undangan bisa diedit sendiri?</summary><div class="ap-answer">Studio menyediakan editor untuk draft. Perubahan pada undangan yang telah terbit perlu dipublikasikan ulang agar tampil di link live.</div></details>' +
          '<details><summary>Apakah ada biaya tambahan?</summary><div class="ap-answer">Biaya layanan tambahan, perubahan fitur, dan biaya lain belum dirinci secara publik. Minta total biaya tertulis sebelum setuju atau membayar.</div></details>' +
          '<details><summary>Berapa lama link aktif setelah acara?</summary><div class="ap-answer">Masa aktif link setelah acara belum dicantumkan. Minta tanggal kedaluwarsa atau durasi layanan tertulis sebelum transaksi.</div></details>' +
          '<details><summary>Bagaimana metode pembayarannya?</summary><div class="ap-answer">Situs tidak memproses pembayaran. Minta metode serta instruksi resmi dari admin melalui WhatsApp dan jangan transfer sebelum mendapat konfirmasi tertulis.</div></details>' +
        '</div>' +
      '</section>' +
      '<section class="ap-wrap ap-section ap-section-tint" id="asp-tautan">' +
        '<div class="ap-section-heading"><p class="ap-eyebrow">Informasi layanan</p><h2>Ketentuan, privasi, dan kontak</h2><p>Undangan berisi data acara dan dapat dilihat penerima link. Baca cara data diproses sebelum mengunggah daftar tamu.</p></div>' +
        '<div class="ap-category-links"><a class="ap-category-pill" href="' + base + 'katalog/">Katalog semua template →</a><a class="ap-category-pill" href="' + base + 'harga/">Harga & ketentuan →</a><a class="ap-category-pill" href="' + base + 'kebijakan-privasi/">Kebijakan privasi →</a><a class="ap-category-pill" href="' + base + 'syarat-ketentuan/">Syarat & ketentuan →</a><a class="ap-category-pill" href="' + base + 'kebijakan-pengembalian/">Pengembalian →</a><a class="ap-category-pill" href="' + base + 'kontak/">Kontak →</a></div>' +
      '</section>';

    catalog.parentNode.insertBefore(box, catalog.nextSibling);
    return box;
  }

  function updateInternalLinks() {
    root.querySelectorAll('header a[href="#harga"]').forEach(function (anchor) {
      anchor.href = base + 'harga/';
    });
    root.querySelectorAll('header a[href="#testimoni"]').forEach(function (anchor) {
      anchor.href = '#asp-demo';
      anchor.textContent = 'Demo & transparansi';
    });
    root.querySelectorAll('header a[href="#katalog"]').forEach(function (anchor) {
      anchor.href = '#asp-template-showcase';
      anchor.textContent = 'Template';
    });
    root.querySelectorAll('a[href="#harga"]').forEach(function (anchor) {
      anchor.href = base + 'harga/';
    });
  }

  function removeUnverifiedNumbers() {
    // Do not show sales/rating badges until they can be supported by real data.
    Array.from(root.querySelectorAll('.catalog-art span')).forEach(function (badge) {
      if (/^(bestseller|terlaris|favorit|\d+(?:\.\d+)?\s*(?:\/\s*5|bintang))$/i.test((badge.textContent || '').trim())) {
        badge.remove();
      }
    });

    // These selectors remove only the old, unsupported social-proof UI.
    var proofText = Array.from(root.querySelectorAll('span')).find(function (node) {
      return /500\+ klien bahagia/i.test(node.textContent || '');
    });
    if (proofText) {
      var row = proofText.closest('.mt-8.flex.items-center.gap-4');
      if (row) row.classList.add('ap-legacy-hidden');
    }

    // Hide the old carousel even if React remounts it; it contains unverified names/reviews.
    var oldTestimonials = root.querySelector('#testimoni');
    if (oldTestimonials) oldTestimonials.classList.add('ap-legacy-hidden');
  }

  function apply() {
    if (!root.querySelector('.catalog-grid')) return;
    updateInternalLinks();
    updateHero();
    removeUnverifiedNumbers();
    addHomeShowcase();
    replacementSections();
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(function () {
      queued = false;
      apply();
    }, 80);
  }

  if ('MutationObserver' in window) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  var attempts = 0;
  (function retry() {
    apply();
    if (!root.querySelector('.catalog-grid') && ++attempts < 80) setTimeout(retry, 100);
  })();
})();
