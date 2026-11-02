/* katalog-live.js — menerapkan Setting Katalog (Supabase: catalog_settings)
   ke halaman publik yang statis.

   Sifatnya "penyempurnaan", bukan pengganti build:
   - HTML asli tetap dirender server-side (SEO aman).
   - Setelah halaman tampil, skrip ini menyembunyikan tema yang dinonaktifkan,
     mengganti harga/badge/deskripsi, menyusun ulang kartu, dan mengganti teks
     pita promo.
   - Kalau tabel belum ada / offline / fetch gagal, halaman dibiarkan apa adanya
     tanpa error di konsol pengunjung.

   Untuk perubahan permanen (termasuk JSON-LD yang dibaca Google), ekspor
   katalog-setting.json dari Studio → Setting Katalog dan jalankan
   tools/bangun-halaman-publik.cjs. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://aalrhvirqwjtbbxmteeg.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbHJodmlycXdqdGJieG10ZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjg4NTUsImV4cCI6MjEwNjgwNDg1NX0.fQA5_bIQbuvHTS3f9AJy4k2SO4kycgG_SQIdbmo-EBw';
  var LOCAL_KEY = 'asproject_katalog_setting_v1';

  function rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

  function endpoint() {
    return SUPABASE_URL + '/rest/v1/catalog_settings?id=eq.default&select=data,updated_at';
  }

  function fetchSettings() {
    return fetch(endpoint(), {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (rows) {
      if (!Array.isArray(rows) || !rows[0] || !rows[0].data) throw new Error('kosong');
      return rows[0].data;
    }).catch(function () {
      /* Cadangan lokal: hanya ada di browser admin, berguna saat menguji
         halaman sebelum tabel cloud dibuat. Pengunjung biasa tidak punya. */
      try {
        var raw = localStorage.getItem(LOCAL_KEY);
        var cache = raw ? JSON.parse(raw) : null;
        return cache && cache.cache ? cache.cache : null;
      } catch (e) { return null; }
    });
  }

  function style() {
    if (document.getElementById('asp-live-style')) return;
    var s = document.createElement('style');
    s.id = 'asp-live-style';
    s.textContent = '.asp-live-badge{position:absolute;top:10px;right:10px;z-index:3;background:#111;color:#fff;font:800 9px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;padding:5px 8px;border-radius:99px;text-transform:uppercase;box-shadow:0 4px 12px rgba(0,0,0,.22)}'
      + '.asp-live-hide{display:none!important}'
      + '.ap-favorite{position:relative;z-index:4}';
    document.head.appendChild(s);
  }

  function cardId(card) {
    var fav = card.querySelector('[data-favorite]');
    if (fav && fav.dataset.favorite) return fav.dataset.favorite;
    if (card.dataset.templateId) return card.dataset.templateId;
    var link = card.querySelector('h3 a');
    var m = link && link.getAttribute('href') ? link.getAttribute('href').match(/template\/([a-z0-9-]+)\//i) : null;
    return m ? m[1] : '';
  }

  function applyCard(card, s, g, baseIndex) {
    var id = cardId(card);
    if (!id) return null;
    var theme = (s.themes && s.themes[id]) || null;
    if (!theme) return null;
    var promoOn = theme.promoAktif === null || typeof theme.promoAktif === 'undefined' ? !!g.promoAktif : !!theme.promoAktif;
    var promoPrice = Number(theme.hargaPromo);
    var normal = Number(theme.hargaNormal);

    if (theme.visible === false) {
      card.classList.add('asp-live-hide');
      card.setAttribute('aria-hidden', 'true');
    }

    var priceBox = card.querySelector('.ap-card-price');
    if (priceBox) {
      var del = priceBox.querySelector('del');
      var strong = priceBox.querySelector('strong');
      var note = priceBox.querySelector('.ap-new-customer-price');
      if (promoOn && promoPrice > 0 && promoPrice < normal) {
        if (del) del.textContent = rp(g.hargaCoret || normal);
        if (strong) strong.textContent = rp(promoPrice);
        if (note) { note.textContent = 'Pelanggan baru'; note.hidden = false; }
      } else {
        if (del) del.textContent = rp(g.hargaCoret || normal);
        if (strong) strong.textContent = rp(promoPrice || normal);
        if (note) note.hidden = true;
      }
    }

    if (theme.badge) {
      var host = card.querySelector('.ap-swatch') || card.querySelector('.ap-template-card-body');
      if (host) {
        var badge = host.querySelector('.asp-live-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'asp-live-badge';
          host.appendChild(badge);
        }
        badge.textContent = theme.badge;
      }
    }

    if (theme.desc) {
      var desc = card.querySelector('h3 + p');
      if (desc) desc.textContent = theme.desc;
    }
    card.dataset.liveOrder = String(Number.isFinite(+theme.order) ? +theme.order : (10000 + (baseIndex || 0)));
    card.dataset.liveFeatured = theme.featured ? '1' : '0';
    return { id: id, visible: theme.visible !== false, order: Number(theme.order) || 0, featured: !!theme.featured };
  }

  function applyRibbon(g) {
    document.querySelectorAll('.ap-promo-ribbon').forEach(function (el) {
      var strong = el.querySelector('strong');
      var span = el.querySelector('span');
      if (strong && g.ribbon) strong.textContent = g.ribbon;
      if (span && g.ribbonSub) {
        var coret = g.hargaCoret ? '<del>Rp' + Number(g.hargaCoret).toLocaleString('id-ID') + '</del> ' : '';
        span.innerHTML = coret + String(g.ribbonSub).replace(/[<>]/g, '');
      }
      if (g.promoAktif === false) el.classList.add('asp-live-hide');
    });
    var notice = document.querySelector('.ap-price del, .ap-price');
    if (!notice) return;
    document.querySelectorAll('.ap-price').forEach(function (el) {
      var del = el.querySelector('del');
      var g2 = g;
      if (del && g2.hargaCoret) del.textContent = 'Rp' + Number(g2.hargaCoret).toLocaleString('id-ID');
    });
  }

  function detailPage(s, g) {
    var el = document.querySelector('[data-template-id]');
    if (!el) return;
    var id = el.dataset.templateId;
    var theme = s.themes && s.themes[id];
    if (!theme) return;
    var promoOn = theme.promoAktif === null || typeof theme.promoAktif === 'undefined' ? !!g.promoAktif : !!theme.promoAktif;
    var promoPrice = Number(theme.hargaPromo), normal = Number(theme.hargaNormal);
    var price = document.querySelector('.ap-price');
    if (price) {
      var del = price.querySelector('del');
      if (del) del.textContent = 'Rp' + Number(normal).toLocaleString('id-ID');
      /* Ganti angka harga tanpa menghapus keterangan di dalamnya. */
      Array.prototype.forEach.call(price.childNodes, function (node) {
        if (node.nodeType === 3 && /^\s*Rp\s?[\d.]+/.test(node.nodeValue)) {
          node.nodeValue = ' Rp ' + Number(promoOn && promoPrice < normal ? promoPrice : (promoPrice || normal)).toLocaleString('id-ID') + ' ';
        }
      });
    }
    var badgeHost = document.querySelector('.ap-product-copy');
    if (badgeHost && theme.badge) {
      var badge = badgeHost.querySelector('.asp-live-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'asp-live-badge';
        badge.style.position = 'static';
        badge.style.marginLeft = '6px';
        badgeHost.insertBefore(badge, badgeHost.querySelector('h1'));
      }
      badge.textContent = theme.badge;
    }
    var lead = document.querySelector('.ap-lead');
    if (lead && theme.desc) lead.textContent = theme.desc;
    var notice = document.querySelector('.ap-notice');
    if (notice && g.catatan) {
      var strong = notice.querySelector('strong');
      if (strong) strong.textContent = g.catatan;
    }
  }

  function reorder(grid) {
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-template-card]'));
    cards.sort(function (a, b) {
      var ha = a.classList.contains('asp-live-hide') ? 1 : 0;
      var hb = b.classList.contains('asp-live-hide') ? 1 : 0;
      if (ha !== hb) return ha - hb;
      var fa = a.dataset.liveFeatured === '1' ? 0 : 1;
      var fb = b.dataset.liveFeatured === '1' ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return Number(a.dataset.liveOrder || 0) - Number(b.dataset.liveOrder || 0);
    });
    cards.forEach(function (c) { grid.appendChild(c); });
  }

  function apply(s) {
    if (!s || !s.themes) return;
    var g = s.global || {};
    style();
    var grid = document.querySelector('[data-catalog-grid]');
    var cards = document.querySelectorAll('[data-template-card]');
    var results = [];
    cards.forEach(function (card, i) {
      var r = applyCard(card, s, g, i);
      if (r) results.push(r);
    });
    if (grid) reorder(grid);
    applyRibbon(g);
    detailPage(s, g);

    var count = document.querySelector('[data-catalog-count]');
    if (count) count.textContent = String(visibleCount());
    var empty = document.querySelector('[data-catalog-empty]');
    if (empty) {
      var anyVisible = visibleCount();
      if (!anyVisible) empty.hidden = false;
    }
    document.documentElement.setAttribute('data-katalog-live', s.updatedAt || 'on');
  }
  function visibleCount() {
    var n = 0;
    document.querySelectorAll('[data-template-card]:not(.asp-live-hide)').forEach(function () { n++; });
    return n;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { fetchSettings().then(apply); });
  } else {
    fetchSettings().then(apply);
  }
})();
