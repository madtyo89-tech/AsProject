/* studio-core.js — fondasi bersama halaman admin AsProject:
   studio-template.html (racik tema) & studio-katalog.html (setting toko).

   Isi:
   - gerbang sandi (hash sama dengan studio.html, jadi satu sandi untuk semua)
   - helper penyimpanan lokal yang tahan kuota penuh
   - notifikasi ringkas (toast)
   - jembatan pratinjau ke undangan.html?preview=1 (postMessage, sama seperti Studio)
   - akses Supabase (baca/tulis baris tunggal tabel JSON)

   Tidak ada data tema di sini: daftar tema dibaca dari assets/tpl-data.js yang
   dibangkitkan tools/bangun-tpl-data.cjs. */
(function () {
  'use strict';

  var AUTH_HASH = '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';
  var AUTH_KEY = 'asproject_studio_auth';
  var SUPABASE_URL = 'https://aalrhvirqwjtbbxmteeg.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbHJodmlycXdqdGJieG10ZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjg4NTUsImV4cCI6MjEwNjgwNDg1NX0.fQA5_bIQbuvHTS3f9AJy4k2SO4kycgG_SQIdbmo-EBw';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- toast ---------- */
  var toastBox = null;
  function toast(msg, kind) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'asp-toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    var el = document.createElement('div');
    el.className = 'asp-toast' + (kind ? ' is-' + kind : '');
    el.innerHTML = msg;
    toastBox.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, kind === 'error' ? 6000 : 3600);
    setTimeout(function () { el.remove(); }, kind === 'error' ? 6600 : 4200);
  }

  /* ---------- gerbang sandi ---------- */
  function sha256(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function unlocked() {
    try {
      return localStorage.getItem(AUTH_KEY) === AUTH_HASH || sessionStorage.getItem(AUTH_KEY) === AUTH_HASH;
    } catch (e) { return false; }
  }
  function gate() {
    var root = document.documentElement;
    if (unlocked()) { root.classList.remove('asp-locked'); return; }
    var box = document.createElement('div');
    box.className = 'asp-gate';
    box.innerHTML =
      '<form class="asp-gate-card" autocomplete="off">' +
        '<div class="asp-gate-logo"><img src="assets/logo-asproject.svg" alt=""></div>' +
        '<h1>AsProject Studio</h1>' +
        '<p>Area khusus admin — masukkan sandi untuk melanjutkan.</p>' +
        '<input type="password" class="asp-gate-pass" placeholder="Sandi studio" autocomplete="current-password" aria-label="Sandi studio">' +
        '<label class="asp-gate-remember"><input type="checkbox" checked> Ingat perangkat ini</label>' +
        '<button type="submit" class="asp-btn asp-btn-dark">Masuk →</button>' +
        '<div class="asp-gate-err" role="alert"></div>' +
        '<a class="asp-gate-back" href="./">← Kembali ke situs</a>' +
      '</form>';
    document.body.appendChild(box);
    var form = box.querySelector('form');
    var pass = box.querySelector('.asp-gate-pass');
    var err = box.querySelector('.asp-gate-err');
    var remember = box.querySelector('input[type=checkbox]');
    setTimeout(function () { pass.focus(); }, 60);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!(window.crypto && crypto.subtle)) {
        err.textContent = 'Browser butuh HTTPS untuk memeriksa sandi. Buka lewat https://asproject.my.id/.';
        return;
      }
      sha256(pass.value || '').then(function (h) {
        if (h !== AUTH_HASH) {
          err.textContent = 'Sandi salah — coba lagi.';
          pass.value = '';
          pass.focus();
          return;
        }
        try { (remember.checked ? localStorage : sessionStorage).setItem(AUTH_KEY, AUTH_HASH); } catch (e) {}
        box.remove();
        root.classList.remove('asp-locked');
        document.dispatchEvent(new CustomEvent('asp:unlocked'));
      });
    });
  }

  /* ---------- penyimpanan lokal ---------- */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Penyimpanan browser penuh — draf ini belum tersimpan.', 'error'); return false; }
  }

  /* ---------- pratinjau undangan ---------- */
  var PV_LEBAR = 390, PV_TINGGI = 780;
  function scalePreview(ifr) {
    var box = ifr.parentElement;
    if (!box) return;
    var layar = box.closest('.asp-preview-stage') || box;
    var lebar = Math.max(160, layar.clientWidth || 360);
    var tinggi = Math.max(260, layar.clientHeight || 680);
    var k = Math.min(lebar / PV_LEBAR, tinggi / PV_TINGGI);
    ifr.style.transform = 'scale(' + k + ')';
    box.style.width = Math.round(PV_LEBAR * k) + 'px';
    box.style.height = Math.round(PV_TINGGI * k) + 'px';
    box.style.margin = '0 auto';
  }
  function bindPreview(ifr, getRow) {
    if (!ifr) return;
    function kirim() {
      var row = typeof getRow === 'function' ? getRow() : getRow;
      if (!row) return;
      ifr.__aspRow = row;
      try { ifr.contentWindow.postMessage({ type: 'asproject:preview', row: row }, '*'); } catch (e) {}
    }
    if (!ifr.__aspBound) {
      ifr.__aspBound = true;
      ifr.addEventListener('load', function () {
        scalePreview(ifr);
        var row = ifr.__aspRow || (typeof getRow === 'function' ? getRow() : getRow);
        if (row) { try { ifr.contentWindow.postMessage({ type: 'asproject:preview', row: row }, '*'); } catch (e) {} }
        try { ifr.contentWindow.postMessage({ type: 'asproject:cover' }, '*'); } catch (e) {}
      });
    }
    scalePreview(ifr);
    kirim();
  }
  function backToCover(ifr) {
    try { ifr.contentWindow.postMessage({ type: 'asproject:cover' }, '*'); } catch (e) {}
  }

  /* ---------- Supabase: satu baris JSON ---------- */
  function headers() {
    return { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  }
  function api(path, options) {
    var opts = options || {};
    opts.headers = Object.assign(headers(), opts.headers || {});
    return fetch(SUPABASE_URL + '/rest/v1/' + path, opts).then(function (r) {
      return r.text().then(function (text) {
        if (!r.ok) {
          var err = new Error('HTTP ' + r.status + ': ' + text.slice(0, 200));
          err.status = r.status;
          throw err;
        }
        try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
      });
    });
  }
  function readRow(table, id) {
    return api(table + '?id=eq.' + encodeURIComponent(id || 'default') + '&select=data,updated_at')
      .then(function (rows) { return Array.isArray(rows) && rows[0] ? rows[0] : null; });
  }
  function writeRow(table, data, id) {
    return api(table + '?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: id || 'default', data: data, updated_at: new Date().toISOString() }])
    });
  }

  window.ASP = {
    esc: esc, toast: toast, gate: gate, load: load, save: save,
    bindPreview: bindPreview, scalePreview: scalePreview, backToCover: backToCover,
    readRow: readRow, writeRow: writeRow,
    SUPABASE_URL: SUPABASE_URL, SUPABASE_KEY: SUPABASE_KEY
  };
})();
