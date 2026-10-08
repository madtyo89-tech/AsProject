/*
 * AsProject Studio — native bridge for the Android wrapper.
 * ---------------------------------------------------------------------------
 * Berkas ini adalah satu-satunya bagian web yang berkomunikasi dengan aplikasi
 * Android (`window.AsProject`). Aplikasi menyuntikkannya sendiri ke setiap
 * halaman internal, jadi situs tidak perlu diubah. Bila dimuat di peramban
 * biasa (tanpa jembatan native), seluruh berkas ini tidak melakukan apa pun.
 *
 * Yang dikerjakan:
 *   1. Menyalin teks lewat ClipboardManager Android bila navigator.clipboard
 *      tidak tersedia di WebView.
 *   2. Meneruskan tautan luar (WhatsApp, Google Maps, dsb.) ke aplikasi Android.
 *   3. Menyimpan hasil ekspor (HTML undangan, CSV tamu, PNG QR) ke folder
 *      Unduhan lewat jembatan native — termasuk tautan `blob:` yang tidak bisa
 *      diunduh oleh WebView.
 *
 * Yang TIDAK dikerjakan: tidak menghapus/mengubah localStorage, tidak memuat
 * ulang halaman, tidak menyentuh login atau draft milik Studio.
 */
(function () {
  'use strict';

  if (window.__AsProjectBridgeInstalled) {
    return;
  }
  window.__AsProjectBridgeInstalled = true;

  var native = window.AsProject;
  var hasNative = !!(native && typeof native.saveBegin === 'function'
    && typeof native.saveChunk === 'function' && typeof native.saveFinish === 'function');

  // Blob yang dibuat halaman disimpan sebentar supaya ekspor tetap bisa dibaca
  // walaupun URL.createObjectURL sudah di-revoke oleh skrip halaman.
  var blobCache = new Map();
  var createObjectURL = URL.createObjectURL;
  if (typeof createObjectURL === 'function') {
    URL.createObjectURL = function (blob) {
      var url = createObjectURL.call(URL, blob);
      try {
        blobCache.set(url, blob);
        setTimeout(function () { blobCache.delete(url); }, 120000);
      } catch (e) { /* diabaikan */ }
      return url;
    };
  }

  // ---------------------------------------------------------------- notifikasi

  function toast(message, tone) {
    try {
      var node = document.createElement('div');
      node.textContent = message;
      node.setAttribute('role', 'status');
      node.style.cssText = [
        'position:fixed', 'left:50%', 'transform:translateX(-50%)',
        'bottom:calc(18px + env(safe-area-inset-bottom,0px))',
        'max-width:min(360px,88vw)', 'z-index:2147483000',
        'background:' + (tone === 'error' ? '#8E1B1B' : '#111111'),
        'color:#F2EFE7', 'font:500 13px/1.45 system-ui,-apple-system,sans-serif',
        'padding:11px 16px', 'border-radius:999px', 'text-align:center',
        'box-shadow:0 12px 32px rgba(0,0,0,.28)', 'pointer-events:none',
        'opacity:0', 'transition:opacity .18s ease'
      ].join(';');
      document.body.appendChild(node);
      requestAnimationFrame(function () { node.style.opacity = '1'; });
      setTimeout(function () {
        node.style.opacity = '0';
        setTimeout(function () { node.remove(); }, 240);
      }, 2600);
    } catch (e) { /* tampilan notifikasi opsional */ }
  }

  // ---------------------------------------------------------------- simpan berkas

  function fileNameFor(url, suggestedName, mime) {
    if (suggestedName) {
      return suggestedName;
    }
    var clean = String(url).split('?')[0].split('#')[0];
    var last = clean.substring(clean.lastIndexOf('/') + 1);
    if (last && last.indexOf('blob:') !== 0) {
      return last;
    }
    var extension = '.bin';
    if (mime && mime.indexOf('html') >= 0) { extension = '.html'; }
    else if (mime && mime.indexOf('csv') >= 0) { extension = '.csv'; }
    else if (mime && mime.indexOf('png') >= 0) { extension = '.png'; }
    else if (mime && mime.indexOf('pdf') >= 0) { extension = '.pdf'; }
    return 'undangan-asproject' + extension;
  }

  function base64Chunks(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('FileReader gagal')); };
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.substring(comma + 1) : '');
      };
      reader.readAsDataURL(blob);
    });
  }

  function persistBlob(blob, name, mime) {
    if (!hasNative) {
      return Promise.reject(new Error('tanpa jembatan native'));
    }
    if (blob.size > 48 * 1024 * 1024) {
      return Promise.reject(new Error('berkas terlalu besar (maks 48 MB)'));
    }
    return base64Chunks(blob).then(function (base64) {
      var token = native.saveBegin(name, mime || blob.type || 'application/octet-stream');
      if (!token || String(token).indexOf('ERR') === 0) {
        throw new Error('penyimpanan tidak bisa dimulai');
      }
      var step = 1048576; // kelipatan 4 agar setiap potongan base64 valid
      for (var offset = 0; offset < base64.length; offset += step) {
        if (!native.saveChunk(token, base64.substr(offset, step))) {
          throw new Error('penulisan berkas terputus');
        }
      }
      var raw = native.saveFinish(token);
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = { ok: false, error: 'respon tidak dikenal' }; }
      if (!parsed.ok) {
        throw new Error(parsed.error || 'gagal menyimpan');
      }
      return parsed;
    });
  }

  function blobFor(url) {
    var cached = blobCache.get(url);
    if (cached) {
      return Promise.resolve(cached);
    }
    return fetch(url).then(function (response) { return response.blob(); });
  }

  function saveBlobUrl(url, suggestedName, mime) {
    return blobFor(url).then(function (blob) {
      var name = fileNameFor(url, suggestedName, blob.type || mime);
      return persistBlob(blob, name, blob.type || mime);
    });
  }

  // Klik pada tautan unduhan (hasil ekspor Studio).
  document.addEventListener('click', function (event) {
    if (!hasNative) {
      return;
    }
    var anchor = event.target && event.target.closest
      ? event.target.closest('a[href]') : null;
    if (!anchor) {
      return;
    }
    var href = anchor.getAttribute('href') || '';
    var isDownload = anchor.hasAttribute('download');
    var scheme = href.split(':')[0].toLowerCase();
    if (!(isDownload && (scheme === 'blob' || scheme === 'data'))) {
      return;
    }
    // Ambil alih unduhan: WebView tidak bisa menyimpan blob: sendiri.
    event.preventDefault();
    event.stopPropagation();
    var name = anchor.getAttribute('download') || '';
    var mime = anchor.getAttribute('type') || '';
    saveBlobUrl(href, name, mime).then(function (saved) {
      toast('Tersimpan: ' + saved.name);
    }).catch(function (error) {
      toast('Gagal menyimpan berkas: ' + (error && error.message ? error.message : error), 'error');
    });
  }, true);

  // ---------------------------------------------------------------- tautan luar

  var originalOpen = window.open;
  if (hasNative && typeof native.openExternal === 'function') {
    window.open = function (url, target, features) {
      var resolved = url;
      try {
        resolved = new URL(String(url), location.href).href;
      } catch (e) { /* biarkan apa adanya */ }
      var sameOrigin = resolved.indexOf(location.origin) === 0;
      var scheme = resolved.split(':')[0].toLowerCase();
      if (!sameOrigin && (scheme === 'http' || scheme === 'https' || scheme.indexOf('whatsapp') >= 0
        || scheme === 'mailto' || scheme === 'tel' || scheme === 'intent')) {
        try {
          if (native.openExternal(resolved)) {
            return null;
          }
        } catch (e) { /* jatuh ke perilaku bawaan */ }
      }
      return originalOpen ? originalOpen.call(window, url, target, features) : null;
    };
  }

  // ---------------------------------------------------------------- papan klip

  if (hasNative && typeof native.copyText === 'function') {
    var clipboard = navigator.clipboard;
    if (!clipboard) {
      clipboard = {};
      try {
        Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
      } catch (e) {
        navigator.clipboard = clipboard;
      }
    }
    if (typeof clipboard.writeText !== 'function') {
      clipboard.writeText = function (text) {
        var ok = native.copyText(String(text == null ? '' : text));
        return ok ? Promise.resolve() : Promise.reject(new Error('clipboard native gagal'));
      };
    }
  }

  // ---------------------------------------------------------------- hasil ekspor

  window.AsProjectDownloader = {
    onSaved: function (raw) {
      var parsed = null;
      try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { parsed = null; }
      if (parsed && parsed.ok) {
        toast('Tersimpan: ' + (parsed.name || 'berkas'));
      } else if (parsed) {
        toast('Gagal menyimpan berkas: ' + (parsed.error || 'tidak diketahui'), 'error');
      }
      try {
        window.dispatchEvent(new CustomEvent('asproject:export-saved', { detail: parsed }));
      } catch (e) { /* CustomEvent tidak wajib */ }
    }
  };

  window.AsProjectNative = {
    available: hasNative,
    platform: hasNative && typeof native.platform === 'function'
      ? native.platform() : null,
    saveBlobUrl: saveBlobUrl,
    openExternal: hasNative ? function (url) { return native.openExternal(url); } : function () { return false; }
  };
})();
