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

  /* Baca angka dari teks harga bawaan ("Rp 99.000" -> 99000). */
  function angkaRp(txt) {
    var m = String(txt || '').replace(/\s/g, '').match(/rp([\d.]+)/i);
    return m ? Number(m[1].replace(/\./g, '')) || 0 : 0;
  }
  function normalDariCoret(box) {
    var del = box && box.querySelector('del');
    return del ? angkaRp(del.textContent) : 0;
  }

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
      var d = rows[0].data;
      /* Sebagian klien menyimpan JSON sebagai teks (dobel-encode). */
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch (e) { throw new Error('data bukan JSON'); }
      }
      return d;
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
    s.textContent = '.asp-live-hide{display:none!important}'
      + '.ap-favorite{position:relative;z-index:4}'
      + '.ap-new-badge.asp-live-badge-baru{box-shadow:0 4px 12px rgba(0,0,0,.22)}';
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

  /* Promo global dimatikan: kartu tanpa setting tetap harus berhenti
     menampilkan harga promo. Harga normal diambil dari angka coret bawaan. */
  function matikanPromoBawaan(card) {
    var box = card.querySelector('.ap-card-price');
    if (!box) return;
    var normal = normalDariCoret(box);
    if (!(normal > 0)) return;
    var strong = box.querySelector('strong');
    if (strong) strong.textContent = rp(normal);
    var del = box.querySelector('del');
    if (del) del.remove();
    var note = box.querySelector('.ap-new-customer-price');
    if (note) note.hidden = true;
    card.dataset.price = String(normal);
  }

  function applyCard(card, s, g, baseIndex) {
    var id = cardId(card);
    if (!id) return null;
    var theme = (s.themes && s.themes[id]) || null;
    /* Tanpa setting, kartu tetap memakai urutan build-nya (bukan 0) supaya
       tema yang diatur tidak terlempar ke belakang oleh tema lain. */
    if (!theme) {
      card.dataset.liveOrder = String(10000 + baseIndex);
      if (g.promoAktif === false) matikanPromoBawaan(card);
      return null;
    }
    var promoOn = theme.promoAktif === null || typeof theme.promoAktif === 'undefined' ? !!g.promoAktif : !!theme.promoAktif;
    var promoPrice = Number(theme.hargaPromo);
    var normal = Number(theme.hargaNormal);
    var adaPromo = isFinite(promoPrice) && promoPrice > 0;
    var adaNormal = isFinite(normal) && normal > 0;
    var coretGlobal = Number(g.hargaCoret) > 0 ? Number(g.hargaCoret) : null;
    var hargaTampil = 0;

    if (theme.visible === false) {
      card.classList.add('asp-live-hide');
      card.setAttribute('aria-hidden', 'true');
    }

    var priceBox = card.querySelector('.ap-card-price');
    var promoMati = theme.promoAktif === false
      || ((theme.promoAktif === null || typeof theme.promoAktif === 'undefined') && g.promoAktif === false);
    if (priceBox && (adaPromo || adaNormal || promoMati)) {
      var del = priceBox.querySelector('del');
      var strong = priceBox.querySelector('strong');
      var note = priceBox.querySelector('.ap-new-customer-price');
      /* Harga normal cadangan: angka coret bawaan kartu. Dipakai saat promo
         dimatikan tetapi tema tidak mengirim harga normal sendiri. */
      if (!adaNormal) { var nb = normalDariCoret(priceBox); if (nb > 0) { normal = nb; adaNormal = true; } }
      var promoHidup = promoOn && adaPromo && adaNormal && promoPrice < normal;
      /* Promo yang dimatikan TIDAK boleh menampilkan harga promo maupun coretan
         promo: harga kembali ke harga normal. Kalau angka tidak dikirim sama
         sekali, harga bawaan dibiarkan (jangan jadi "Rp 0"). */
      hargaTampil = promoHidup ? promoPrice : (adaNormal ? normal : (adaPromo ? promoPrice : 0));
      if (hargaTampil > 0) {
        if (strong) strong.textContent = rp(hargaTampil);
        if (promoHidup) {
          var coret = coretGlobal || (adaNormal ? normal : 0);
          if (del && coret > hargaTampil) del.textContent = rp(coret);
        } else if (del) {
          del.remove();
        }
        if (note) { note.hidden = !promoHidup; if (promoHidup) note.textContent = 'Pelanggan baru'; }
        /* data-price dipakai kontrol urut katalog (katalog-v2.js). */
        card.dataset.price = String(hargaTampil);
      }
    }

    /* Badge: perbarui badge bawaan kartu (.ap-new-badge di dalam .ap-swatch),
       jangan menambah badge kedua yang menumpuk. String kosong = hapus badge;
       tidak diisi (undefined) = biarkan seperti dari build. */
    if (typeof theme.badge === 'string') {
      var host = card.querySelector('.ap-swatch') || card.querySelector('.ap-template-card-body');
      var badge = card.querySelector('.ap-new-badge');
      var teksBadge = theme.badge.trim();
      if (!teksBadge) {
        if (badge) badge.remove();
      } else {
        if (!badge && host) {
          badge = document.createElement('span');
          badge.className = 'ap-new-badge';
          host.appendChild(badge);
        }
        if (badge) badge.textContent = teksBadge;
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
        while (span.firstChild) span.removeChild(span.firstChild);
        if (Number(g.hargaCoret) > 0) {
          var d2 = document.createElement('del');
          d2.textContent = 'Rp' + Number(g.hargaCoret).toLocaleString('id-ID');
          span.appendChild(d2);
          span.appendChild(document.createTextNode(' '));
        }
        span.appendChild(document.createTextNode(String(g.ribbonSub)));
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
    if (!theme) {
      if (g.promoAktif === false) matikanPromoDetail();
      return;
    }
    var promoOn = theme.promoAktif === null || typeof theme.promoAktif === 'undefined' ? !!g.promoAktif : !!theme.promoAktif;
    var promoPrice = Number(theme.hargaPromo), normal = Number(theme.hargaNormal);
    var adaPromo = isFinite(promoPrice) && promoPrice > 0, adaNormal = isFinite(normal) && normal > 0;
    var price = document.querySelector('.ap-price');
    if (price && !adaNormal) { var nb2 = normalDariCoret(price); if (nb2 > 0) { normal = nb2; adaNormal = true; } }
    if (price && (adaPromo || adaNormal || promoOn === false)) {
      var del = price.querySelector('del');
      var coret = Number(g.hargaCoret) > 0 ? Number(g.hargaCoret) : (adaNormal ? normal : 0);
      var tampil = promoOn && adaPromo && adaNormal && promoPrice < normal ? promoPrice : (adaNormal ? normal : promoPrice);
      var promoHidupDetail = promoOn && adaPromo && adaNormal && promoPrice < normal;
      if (del) {
        if (promoHidupDetail && coret > tampil) del.textContent = 'Rp' + coret.toLocaleString('id-ID');
        else del.remove();
      }
      /* Ganti angka harga tanpa menghapus keterangan di dalamnya. */
      Array.prototype.forEach.call(price.childNodes, function (node) {
        if (node.nodeType === 3 && /^\s*Rp\s?[\d.]+/.test(node.nodeValue)) {
          node.nodeValue = ' Rp ' + tampil.toLocaleString('id-ID') + ' ';
        }
      });
      price.dataset.price = String(tampil);
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

  function matikanPromoDetail() {
    var price = document.querySelector('.ap-price');
    if (!price) return;
    var normal = normalDariCoret(price);
    if (!(normal > 0)) return;
    var del = price.querySelector('del');
    if (del) del.remove();
    Array.prototype.forEach.call(price.childNodes, function (node) {
      if (node.nodeType === 3 && /^\s*Rp\s?[\d.]+/.test(node.nodeValue)) {
        node.nodeValue = ' Rp ' + normal.toLocaleString('id-ID') + ' ';
      }
    });
    price.dataset.price = String(normal);
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
    var rank = 0;
    cards.forEach(function (c) {
      grid.appendChild(c);
      /* liveRank dipakai katalog-v2.js supaya "Unggulan" tetap urutan ini
         setelah pengunjung memakai pencarian/urut. */
      c.dataset.liveRank = String(rank++);
    });
  }

  function apply(s) {
    if (!s || !s.themes) return;
    var g = s.global || {};
    style();
    /* Halaman kategori (undangan/<acara>/) memakai grid biasa tanpa
       data-catalog-grid; urutan & unggulan tetap harus berlaku di sana. */
    var grid = document.querySelector('[data-catalog-grid]') || document.querySelector('.ap-template-grid');
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
    var tampil = visibleCount();
    if (count) {
      /* Pertahankan kalimat bawaan ("N tema ditampilkan"), jangan tinggalkan
         angka telanjang yang terlihat seperti salah render. */
      var kalimat = /tema/i.test(count.textContent || '');
      count.textContent = kalimat ? tampil + ' tema ditampilkan' : String(tampil);
    }
    else {
      /* Judul kategori berbunyi "22 pilihan untuk dijelajahi" — angkanya ikut
         berubah kalau ada tema yang disembunyikan. */
      Array.prototype.forEach.call(document.querySelectorAll('h2'), function (h) {
        var m = /^(\d+)(\s+pilihan\b)/.exec((h.textContent || '').trim());
        if (m) h.textContent = h.textContent.replace(/^\s*\d+(?=\s+pilihan\b)/, String(tampil));
      });
    }
    var empty = document.querySelector('[data-catalog-empty]');
    if (empty && !tampil) empty.hidden = false;
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
