/* studio-katalog.js — Setting Katalog AsProject.

   Mengatur apa yang tampil di katalog publik: visibilitas per tema, urutan,
   harga normal/promo, promo aktif, badge, dan deskripsi.

   Dua jalur penyimpanan (lihat catatan di halaman):
   1. CLOUD  → tabel Supabase `catalog_settings` (id='default', kolom data jsonb).
               Dibaca assets/katalog-live.js saat pengunjung membuka katalog.
   2. BUILD  → tombol Ekspor menghasilkan katalog-setting.json yang dibaca
               tools/bangun-halaman-publik.cjs.

   Kalau tabel belum ada, halaman tetap bisa dipakai: pengaturan disimpan lokal
   dan status jujur ditampilkan ("lokal"), tidak pura-pura tersimpan. */
(function () {
  'use strict';

  var ASP = window.ASP;
  var TPL = Array.isArray(window.ASP_TPL) ? window.ASP_TPL : [];
  var TABLE = 'catalog_settings';
  var ROW_ID = 'default';
  var LOCAL_KEY = 'asproject_katalog_setting_v1';

  var EV = {
    pernikahan: { label: 'Pernikahan', icon: '💍' },
    khitanan: { label: 'Khitanan', icon: '🕌' },
    ultah: { label: 'Ulang Tahun', icon: '🎂' },
    aqiqah: { label: 'Aqiqah', icon: '👶' },
    all: { label: 'Semua Acara', icon: '✨' }
  };

  var $ = function (id) { return document.getElementById(id); };
  var esc = ASP.esc;

  var GLOBAL_DEFAULT = {
    promoAktif: true,
    hargaCoret: 99000,
    ribbon: 'Harga khusus pelanggan baru',
    ribbonSub: 'Rp49.000 per tema · tanpa tanggal akhir yang ditetapkan',
    catatan: ''
  };

  var settings = null;
  var source = 'lokal';     /* 'cloud' | 'lokal' */
  var dirty = false;
  var cloudNote = '';

  function defaults() {
    var themes = {};
    TPL.forEach(function (t, i) {
      themes[t.id] = {
        visible: true,
        featured: !!(t.badge && /NEW|PREMIUM|LARIS|FAVORIT/i.test(t.badge)),
        order: i,
        hargaNormal: Number(t.harga) || 49000,
        hargaPromo: Number(t.harga) || 49000,
        promoAktif: null,          /* null = ikut promo global */
        badge: t.badge || '',
        desc: t.desc || ''
      };
    });
    return { version: 1, updatedAt: null, global: Object.assign({}, GLOBAL_DEFAULT), themes: themes };
  }

  function normalize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    var out = {
      version: 1,
      updatedAt: raw.updatedAt || null,
      global: Object.assign({}, GLOBAL_DEFAULT, raw.global && typeof raw.global === 'object' ? raw.global : {}),
      themes: {}
    };
    Object.keys(base.themes).forEach(function (id) {
      var src = (raw.themes && raw.themes[id]) || {};
      out.themes[id] = Object.assign({}, base.themes[id], {
        visible: src.visible !== false,
        featured: !!src.featured,
        order: Number.isFinite(+src.order) ? +src.order : base.themes[id].order,
        hargaNormal: Number.isFinite(+src.hargaNormal) ? +src.hargaNormal : base.themes[id].hargaNormal,
        hargaPromo: Number.isFinite(+src.hargaPromo) ? +src.hargaPromo : base.themes[id].hargaPromo,
        promoAktif: typeof src.promoAktif === 'boolean' ? src.promoAktif : null,
        badge: typeof src.badge === 'string' ? src.badge.slice(0, 24) : base.themes[id].badge,
        desc: typeof src.desc === 'string' ? src.desc.slice(0, 180) : base.themes[id].desc
      });
    });
    return out;
  }

  /* ---------- status ---------- */
  function setStatus(kind, text) {
    var pill = $('pillSync');
    var t = $('statusTeks');
    pill.className = 'asp-pill ' + (kind === 'cloud' ? 'cloud' : kind === 'err' ? 'err' : 'local');
    pill.textContent = kind === 'cloud' ? '☁️ Tersimpan di cloud' : kind === 'err' ? '⚠️ Gagal simpan' : '💾 Lokal (belum ke cloud)';
    if (text) t.textContent = text;
  }

  /* ---------- render ---------- */
  function renderGlobal() {
    var g = settings.global;
    document.querySelectorAll('[data-g]').forEach(function (el) {
      var k = el.dataset.g;
      if (el.type === 'checkbox') el.checked = !!g[k];
      else el.value = g[k] == null ? '' : g[k];
    });
  }

  function renderStats() {
    var nilai = Object.keys(settings.themes).map(function (k) { return settings.themes[k]; });
    var tampil = nilai.filter(function (v) { return v.visible; }).length;
    var promo = nilai.filter(function (v) { return v.visible && (v.promoAktif === true || (v.promoAktif === null && settings.global.promoAktif)) && v.hargaPromo < v.hargaNormal; }).length;
    $('statTampil').textContent = String(tampil);
    $('statSembunyi').textContent = String(nilai.length - tampil);
    $('statPromo').textContent = String(promo);
    $('statUnggulan').textContent = String(nilai.filter(function (v) { return v.visible && v.featured; }).length);
  }

  function rowHtml(t) {
    var s = settings.themes[t.id];
    var promoAktif = s.promoAktif === null ? !!settings.global.promoAktif : s.promoAktif;
    var hidden = !s.visible;
    return '<div class="asp-row ' + (hidden ? 'is-hidden' : '') + '" data-row="' + esc(t.id) + '">' +
      '<div class="asp-row-id"><b>' + esc(t.nama) + '</b><small>' + esc(t.id) + ' · ' + (EV[t.ev] ? EV[t.ev].label : t.ev) + '</small></div>' +
      '<label class="asp-field" style="gap:3px">Tampil' +
        '<span class="asp-check" style="align-items:center"><input type="checkbox" data-t="' + esc(t.id) + '" data-f="visible" ' + (s.visible ? 'checked' : '') + '><span style="font-size:11px">' + (s.visible ? 'Ya' : 'Tidak') + '</span></span></label>' +
      '<label class="asp-field" style="gap:3px">Unggulan' +
        '<span class="asp-check" style="align-items:center"><input type="checkbox" data-t="' + esc(t.id) + '" data-f="featured" ' + (s.featured ? 'checked' : '') + '><span style="font-size:11px">' + (s.featured ? 'Ya' : 'Tidak') + '</span></span></label>' +
      '<label class="asp-field">Urutan<input type="number" data-t="' + esc(t.id) + '" data-f="order" value="' + s.order + '" min="0" step="1"></label>' +
      '<label class="asp-field">Harga normal<input type="number" data-t="' + esc(t.id) + '" data-f="hargaNormal" value="' + s.hargaNormal + '" min="0" step="1000"></label>' +
      '<label class="asp-field">Harga promo<input type="number" data-t="' + esc(t.id) + '" data-f="hargaPromo" value="' + s.hargaPromo + '" min="0" step="1000"></label>' +
      '<div class="asp-row-actions">' +
        '<button class="asp-btn asp-btn-sm" data-more="' + esc(t.id) + '" aria-expanded="false" title="Badge & deskripsi">⋯</button>' +
        '<a class="asp-btn asp-btn-sm" href="undangan.html?demo=1&tpl=' + encodeURIComponent(t.id) + '&buka=1" target="_blank" rel="noopener" title="Buka demo tema">↗</a>' +
      '</div>' +
      '<div class="asp-row-more" data-morebox="' + esc(t.id) + '" hidden style="grid-column:1/-1;display:grid;gap:10px;padding-top:4px">' +
        '<div class="asp-grid asp-grid-3">' +
          '<label class="asp-field">Badge<input data-t="' + esc(t.id) + '" data-f="badge" value="' + esc(s.badge) + '" maxlength="24" placeholder="BARU / PREMIUM"></label>' +
          '<label class="asp-field">Promo tema ini' +
            '<select data-t="' + esc(t.id) + '" data-f="promoAktif">' +
              '<option value="" ' + (s.promoAktif === null ? 'selected' : '') + '>Ikut promo global (' + (settings.global.promoAktif ? 'aktif' : 'nonaktif') + ')</option>' +
              '<option value="1" ' + (s.promoAktif === true ? 'selected' : '') + '>Selalu tampilkan promo</option>' +
              '<option value="0" ' + (s.promoAktif === false ? 'selected' : '') + '>Sembunyikan promo tema ini</option>' +
            '</select>' +
            '<small>' + (promoAktif ? 'Harga promo yang dipakai: Rp' + Number(s.hargaPromo).toLocaleString('id-ID') : 'Promo tidak tampil.') + '</small>' +
          '</label>' +
          '<label class="asp-field">Deskripsi katalog<textarea data-t="' + esc(t.id) + '" data-f="desc" maxlength="180" style="min-height:44px">' + esc(s.desc) + '</textarea></label>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderRows() {
    var q = ($('cari').value || '').trim().toLowerCase();
    var showHidden = $('filterSembunyi').checked;
    var urut = (window.__sortAZ ? 'az' : 'order');
    var grup = ['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'];
    var html = '';
    grup.forEach(function (ev) {
      var items = TPL.filter(function (t) { return t.ev === ev; });
      if (!items.length) return;
      var rows = items.map(function (t) { return { t: t, s: settings.themes[t.id] }; })
        .filter(function (x) {
          if (!showHidden && !x.s.visible) return false;
          if (!q) return true;
          return (x.t.nama + ' ' + x.t.id + ' ' + (EV[x.t.ev] || {}).label + ' ' + x.s.badge).toLowerCase().indexOf(q) >= 0;
        })
        .sort(function (a, b) {
          if (urut === 'az') return a.t.nama.localeCompare(b.t.nama, 'id');
          if (!!b.s.featured !== !!a.s.featured) return (b.s.featured ? 1 : 0) - (a.s.featured ? 1 : 0);
          return a.s.order - b.s.order;
        });
      if (!rows.length) return;
      html += '<div class="asp-cat-head"><span>' + EV[ev].icon + ' ' + EV[ev].label + '</span><span>' + rows.length + ' tema</span></div>';
      html += rows.map(function (x) { return rowHtml(x.t); }).join('');
    });
    $('daftarTema').innerHTML = html || '<div class="asp-empty"><strong>Tidak ada tema yang cocok</strong>Ubah kata kunci atau centang “Tampilkan yang disembunyikan”.</div>';
  }

  function renderPending() {
    var store = ASP.load(LOCAL_KEY, {});
    var list = Array.isArray(store.pending) ? store.pending : [];
    $('daftarPending').innerHTML = list.length ? list.map(function (p) {
      return '<div class="asp-tpl" style="cursor:default"><span class="asp-tpl-thumb" style="background:linear-gradient(135deg,#1c1a16,#3a352c);color:#f3e6c4">✦</span>' +
        '<span class="asp-tpl-main"><span class="asp-tpl-name">' + esc(p.nama) + '<span class="asp-tpl-flag draft">MENUNGGU</span></span>' +
        '<span class="asp-tpl-sub">' + esc(p.id) + ' · basis ' + esc(p.baseTpl || '—') + '</span></span></div>';
    }).join('') : '<p class="asp-empty" style="padding:14px">Belum ada tema baru yang dikirim dari Studio Template.</p>';
  }

  function renderAll() {
    renderGlobal();
    renderRows();
    renderStats();
    renderPending();
  }

  /* ---------- simpan / muat ---------- */
  function saveCloud(manual) {
    setStatus('lokal', 'Menyimpan ke Supabase…');
    return ASP.writeRow(TABLE, settings, ROW_ID).then(function () {
      source = 'cloud';
      dirty = false;
      settings.updatedAt = new Date().toISOString();
      setStatus('cloud', 'Tersimpan ' + new Date(settings.updatedAt).toLocaleString('id-ID') + '. Katalog publik membaca pengaturan ini saat dibuka.');
      ASP.save(LOCAL_KEY, Object.assign({}, ASP.load(LOCAL_KEY, {}), { cache: settings }));
      if (manual) ASP.toast('Setting katalog tersimpan di cloud.');
    }).catch(function (err) {
      var msg = String(err && err.message || err);
      cloudNote = msg;
      setStatus('err', 'Cloud menolak: ' + msg.slice(0, 160) + '. Pengaturan tetap disimpan di perangkat ini.');
      ASP.save(LOCAL_KEY, Object.assign({}, ASP.load(LOCAL_KEY, {}), { cache: settings }));
      if (manual) ASP.toast('Gagal menyimpan ke cloud — lihat status di sidebar.', 'error');
    });
  }

  function loadCloud() {
    setStatus('lokal', 'Menghubungi Supabase…');
    return ASP.readRow(TABLE, ROW_ID).then(function (row) {
      if (row && row.data && typeof row.data === 'object') {
        settings = normalize(row.data);
        source = 'cloud';
        settings.updatedAt = row.updated_at || settings.updatedAt;
        setStatus('cloud', 'Dimuat dari cloud' + (row.updated_at ? ' · ' + new Date(row.updated_at).toLocaleString('id-ID') : '') + '.');
        dirty = false;
      } else {
        source = 'lokal';
        setStatus('lokal', 'Cloud masih kosong — memakai nilai bawaan. Tekan “Simpan ke cloud” untuk mengaktifkan.');
      }
      renderAll();
      return true;
    }).catch(function (err) {
      var msg = String(err && err.message || err);
      var localCache = ASP.load(LOCAL_KEY, {}).cache;
      source = 'lokal';
      settings = normalize(localCache);
      setStatus('err', /404|PGRST|42P01|does not exist/i.test(msg)
        ? 'Tabel catalog_settings belum ada. Jalankan Bagian 4 di supabase-schema.sql; sementara ini pengaturan disimpan lokal.'
        : 'Cloud tidak dapat dibaca: ' + msg.slice(0, 140) + '. Pengaturan disimpan lokal.');
      renderAll();
      return false;
    });
  }

  /* ---------- ekspor / impor ---------- */
  function exportJson() {
    var payload = {
      _catatan: 'Dibaca tools/bangun-halaman-publik.cjs bila diletakkan di akar repo. Jangan isi angka rating/ulasan tanpa data.',
      version: 1,
      updatedAt: new Date().toISOString(),
      global: settings.global,
      themes: settings.themes
    };
    var text = JSON.stringify(payload, null, 2);
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'katalog-setting.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    ASP.save(LOCAL_KEY, Object.assign({}, ASP.load(LOCAL_KEY, {}), { lastExport: payload }));
    ASP.toast('katalog-setting.json diunduh. Letakkan di akar repo lalu jalankan generator halaman publik.');
  }

  function importJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || '{}'));
        settings = normalize(data);
        dirty = true;
        renderAll();
        ASP.toast('JSON dibaca. Tekan <b>Simpan ke cloud</b> untuk menerapkan ke katalog.');
      } catch (e) {
        ASP.toast('File JSON tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- event ---------- */
  function markDirty() {
    dirty = true;
    if (source === 'cloud') setStatus('lokal', 'Ada perubahan belum disimpan ke cloud.');
    renderStats();
  }

  function bind() {
    document.addEventListener('input', function (e) {
      var g = e.target.closest('[data-g]');
      if (g) {
        var k = g.dataset.g;
        settings.global[k] = g.type === 'checkbox' ? g.checked : (g.type === 'number' ? Number(g.value) || 0 : g.value);
        markDirty();
        if (k === 'promoAktif') renderRows();
        return;
      }
      var f = e.target.closest('[data-t][data-f]');
      if (!f) return;
      var id = f.dataset.t, field = f.dataset.f;
      var s = settings.themes[id];
      if (!s) return;
      if (f.type === 'checkbox') s[field] = f.checked;
      else if (f.type === 'number') s[field] = Number(f.value) || 0;
      else if (field === 'promoAktif') s[field] = f.value === '' ? null : f.value === '1';
      else s[field] = f.value;
      markDirty();
      if (field === 'visible' || field === 'featured' || field === 'order' || field === 'badge') {
        var row = document.querySelector('[data-row="' + id + '"]');
        if (row) row.classList.toggle('is-hidden', !s.visible);
        renderStats();
        if (field === 'visible' && !$('filterSembunyi').checked) renderRows();
      }
    });

    document.addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-f="promoAktif"]');
      if (sel) renderRows();
    });

    document.addEventListener('click', function (e) {
      var more = e.target.closest('[data-more]');
      if (more) {
        var id = more.dataset.more;
        var box = document.querySelector('[data-morebox="' + id + '"]');
        if (!box) return;
        box.hidden = !box.hidden;
        more.setAttribute('aria-expanded', String(!box.hidden));
      }
    });

    ['cari', 'filterSembunyi'].forEach(function (id) {
      $(id).addEventListener('input', renderRows);
      $(id).addEventListener('change', renderRows);
    });
    $('btnUrut').addEventListener('click', function () {
      window.__sortAZ = !window.__sortAZ;
      this.textContent = window.__sortAZ ? 'Urutkan: A–Z' : 'Urutkan A–Z';
      renderRows();
    });
    $('btnSimpan').addEventListener('click', function () { saveCloud(true); });
    $('btnMuat').addEventListener('click', function () { loadCloud(); });
    $('btnEkspor').addEventListener('click', exportJson);
    $('btnImpor').addEventListener('click', function () { $('fileImpor').click(); });
    $('fileImpor').addEventListener('change', function () { importJson(this.files && this.files[0]); });
    $('btnReset').addEventListener('click', function () {
      if (!confirm('Kembalikan semua pengaturan katalog ke bawaan? Perubahan yang belum disimpan akan hilang.')) return;
      settings = defaults();
      dirty = true;
      renderAll();
      setStatus('lokal', 'Nilai bawaan dipulihkan — belum disimpan.');
      ASP.toast('Pengaturan dikembalikan ke bawaan.');
    });
    window.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  /* ---------- start ---------- */
  ASP.gate();
  settings = normalize(ASP.load(LOCAL_KEY, {}).cache);
  renderAll();
  bind();
  loadCloud();
})();
