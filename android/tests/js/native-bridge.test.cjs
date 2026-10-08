/*
 * Uji jembatan web AsProject Studio (android/web/native-bridge.js) di dalam jsdom.
 *
 *   cd /tmp && npm install --no-save --package-lock=false jsdom
 *   NODE_PATH=/tmp/node_modules node android/tests/js/native-bridge.test.cjs
 *
 * Yang diperiksa: penyalinan teks lewat ClipboardManager Android, pengalihan tautan luar
 * (WhatsApp/Maps) ke aplikasi Android, penyimpanan hasil ekspor blob: dalam potongan 1 MiB,
 * penanganan kegagalan, dan sifat idempoten saat skrip dimuat dua kali.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (error) {
  console.log('SKIP: jsdom belum terpasang (npm install --no-save jsdom)');
  console.log('      detail: ' + error.message.split('\n')[0]);
  process.exit(0);
}

const BRIDGE_PATH = path.resolve(__dirname, '..', '..', 'web', 'native-bridge.js');
const bridgeSource = fs.readFileSync(BRIDGE_PATH, 'utf8');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed++;
    console.log('  [PASS] ' + label);
  } catch (error) {
    failed++;
    console.log('  [FAIL] ' + label + ' — ' + error.message);
  }
}

async function checkAsync(label, fn) {
  try {
    await fn();
    passed++;
    console.log('  [PASS] ' + label);
  } catch (error) {
    failed++;
    console.log('  [FAIL] ' + label + ' — ' + error.message);
  }
}

function createHarness(options = {}) {
  const dom = new JSDOM('<!doctype html><html><head><title>Studio</title></head><body></body></html>', {
    url: 'https://asproject.my.id/studio.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  const calls = [];
  const openTransfers = new Map();
  let tokenCounter = 0;
  const finishResults = [];

  const native = {
    platform: () => JSON.stringify({ native: true, platform: 'android' }),
    copyText(text) { calls.push(['copyText', text]); return true; },
    openExternal(url) { calls.push(['openExternal', url]); return options.openExternalResult !== false; },
    saveBegin(name, mime) {
      calls.push(['saveBegin', name, mime]);
      if (options.beginFails) { return 'ERR:too-many-open-transfers'; }
      tokenCounter += 1;
      const token = 'token-' + tokenCounter;
      openTransfers.set(token, { name, mime, chunks: [] });
      return token;
    },
    saveChunk(token, chunk) {
      const transfer = openTransfers.get(token);
      if (!transfer) { calls.push(['saveChunk-unknown', token]); return false; }
      transfer.chunks.push(chunk);
      calls.push(['saveChunk', token, chunk.length]);
      return options.chunkFails ? false : true;
    },
    saveFinish(token) {
      const transfer = openTransfers.get(token);
      const result = options.finishFails
        ? { ok: false, error: 'media-store-menolak' }
        : { ok: true, name: transfer ? transfer.name : 'unknown', uri: 'content://downloads/1' };
      calls.push(['saveFinish', token]);
      finishResults.push({ transfer, result });
      return JSON.stringify(result);
    },
    toast(message) { calls.push(['toast', message]); },
    log() {},
  };

  window.AsProject = native;

  // jsdom tidak menyediakan createObjectURL maupun fetch untuk blob: — sediakan tiruan.
  const blobRegistry = new Map();
  let blobCounter = 0;
  window.URL.createObjectURL = (blob) => {
    blobCounter += 1;
    const url = 'blob:https://asproject.my.id/' + blobCounter;
    blobRegistry.set(url, blob);
    return url;
  };
  window.URL.revokeObjectURL = () => {};

  const originalOpen = function (url) {
    calls.push(['window.open-asli', url]);
    return { openedWith: url };
  };
  window.open = originalOpen;

  // fetch tiruan: hanya mengenal blob: dan data: (cukup untuk menguji jalur cadangan).
  window.fetch = (url) => {
    const target = String(url);
    if (blobRegistry.has(target)) {
      const blob = blobRegistry.get(target);
      return Promise.resolve({ blob: () => Promise.resolve(blob) });
    }
    if (target.startsWith('data:')) {
      const comma = target.indexOf(',');
      const meta = target.slice(5, comma);
      const payload = target.slice(comma + 1);
      const bytes = meta.includes('base64')
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
      return Promise.resolve({ blob: () => Promise.resolve(new window.Blob([bytes])) });
    }
    return Promise.reject(new Error('fetch tiruan tidak mengenal ' + target));
  };

  window.eval(bridgeSource);

  return { dom, window, native, calls, finishResults, blobRegistry };
}

function clickDownload(window, href, downloadName, mime) {
  const anchor = window.document.createElement('a');
  anchor.setAttribute('href', href);
  if (downloadName !== null) { anchor.setAttribute('download', downloadName); }
  if (mime) { anchor.setAttribute('type', mime); }
  window.document.body.appendChild(anchor);
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  const notCancelled = anchor.dispatchEvent(event);
  return { anchor, defaultPrevented: !notCancelled };
}

function toasts(window) {
  return Array.from(window.document.querySelectorAll('[role="status"]')).map((n) => n.textContent);
}

(async function main() {
  console.log('native-bridge.test.cjs — jembatan web ↔ aplikasi Android\n');

  console.log('1) Deteksi jembatan & API yang diekspos');
  {
    const h = createHarness();
    check('AsProjectNative tersedia', () => assert.strictEqual(h.window.AsProjectNative.available, true));
    check('platform() diteruskan', () => assert.match(h.window.AsProjectNative.platform, /android/));
    check('AsProjectDownloader tersedia', () => assert.strictEqual(typeof h.window.AsProjectDownloader.onSaved, 'function'));
  }

  console.log('\n2) Papan klip (navigator.clipboard tidak ada di WebView lama)');
  await checkAsync('navigator.clipboard.writeText dipasang', async () => {
    const h = createHarness();
    assert.strictEqual(typeof h.window.navigator.clipboard.writeText, 'function');
    await h.window.navigator.clipboard.writeText('https://asproject.my.id/u/tamu');
    const copy = h.calls.find((c) => c[0] === 'copyText');
    assert.ok(copy, 'copyText tidak dipanggil');
    assert.strictEqual(copy[1], 'https://asproject.my.id/u/tamu');
  });

  console.log('\n3) Tautan luar dibuka di aplikasi lain');
  {
    const h = createHarness();
    const result = h.window.open('https://wa.me/?text=Halo%20tamu', '_blank');
    check('wa.me diteruskan ke openExternal', () => {
      const call = h.calls.find((c) => c[0] === 'openExternal');
      assert.ok(call, 'openExternal tidak dipanggil');
      assert.strictEqual(call[1], 'https://wa.me/?text=Halo%20tamu');
    });
    check('window.open mengembalikan null setelah dialihkan', () => assert.strictEqual(result, null));
    check('window.open bawaan tidak ikut jalan', () =>
      assert.strictEqual(h.calls.filter((c) => c[0] === 'window.open-asli').length, 0));
  }
  {
    const h = createHarness();
    h.window.open('https://maps.google.com/?q=Gedung+Kencana', '_blank');
    check('Google Maps diteruskan ke openExternal', () => {
      const call = h.calls.find((c) => c[0] === 'openExternal');
      assert.ok(call && call[1].includes('maps.google.com'));
    });
  }
  {
    const h = createHarness();
    const result = h.window.open('/master.html?k=rahasia', '_blank');
    check('tautan internal tetap di WebView (bukan aplikasi lain)', () => {
      assert.strictEqual(h.calls.filter((c) => c[0] === 'openExternal').length, 0);
      assert.ok(result && result.openedWith === '/master.html?k=rahasia');
    });
  }
  {
    const h = createHarness({ openExternalResult: false });
    h.window.open('https://example.com/artikel', '_blank');
    check('bila aplikasi luar menolak, window.open bawaan dipakai', () => {
      assert.ok(h.calls.some((c) => c[0] === 'window.open-asli'));
    });
  }

  console.log('\n4) Ekspor berkas (blob:) disimpan lewat jembatan native');
  await checkAsync('klik unduhan blob: dicegat dan tersimpan', async () => {
    const h = createHarness();
    const html = '<!doctype html><html><body>Undangan Dina & Bagas</body></html>';
    const blob = new h.window.Blob([html], { type: 'text/html;charset=utf-8' });
    const url = h.window.URL.createObjectURL(blob);
    const click = clickDownload(h.window, url, 'undangan-dina-bagas.html', 'text/html');
    assert.strictEqual(click.defaultPrevented, true, 'klik tidak dicegah (unduhan akan gagal di WebView)');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const begin = h.calls.find((c) => c[0] === 'saveBegin');
    assert.ok(begin, 'saveBegin tidak dipanggil');
    assert.strictEqual(begin[1], 'undangan-dina-bagas.html');
    assert.match(begin[2], /text\/html/);
    const transfer = h.finishResults[0].transfer;
    const reassembled = Buffer.from(transfer.chunks.join(''), 'base64').toString('utf8');
    assert.strictEqual(reassembled, html, 'isi berkas tidak sama dengan blob asli');
    assert.ok(h.finishResults[0].result.ok);
  });

  await checkAsync('CSV tamu tersimpan dengan tipe text/csv', async () => {
    const h = createHarness();
    const csv = 'Bapak Agus,https://asproject.my.id/u/agus\nKak Rina,https://asproject.my.id/u/rina\n';
    const blob = new h.window.Blob([csv], { type: 'text/csv' });
    const url = h.window.URL.createObjectURL(blob);
    clickDownload(h.window, url, 'tamu-dina-bagas.csv', 'text/csv');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const begin = h.calls.find((c) => c[0] === 'saveBegin');
    assert.strictEqual(begin[1], 'tamu-dina-bagas.csv');
    assert.strictEqual(begin[2], 'text/csv');
    const transfer = h.finishResults[0].transfer;
    assert.strictEqual(Buffer.from(transfer.chunks.join(''), 'base64').toString('utf8'), csv);
  });

  await checkAsync('QR PNG tersimpan apa adanya (byte identik)', async () => {
    const h = createHarness();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const blob = new h.window.Blob([png], { type: 'image/png' });
    const url = h.window.URL.createObjectURL(blob);
    clickDownload(h.window, url, 'QR-Checkin-abc.png', 'image/png');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const transfer = h.finishResults[0].transfer;
    assert.ok(Buffer.from(transfer.chunks.join(''), 'base64').equals(png), 'byte PNG berubah');
  });

  await checkAsync('berkas 2,5 MB dikirim dalam potongan 1 MiB yang valid', async () => {
    const h = createHarness();
    const bytes = Buffer.alloc(2.5 * 1024 * 1024, 0x41);
    const url = h.window.URL.createObjectURL(new h.window.Blob([bytes]));
    clickDownload(h.window, url, 'besar.html', 'text/html');
    await new Promise((resolve) => setTimeout(resolve, 900));
    const chunks = h.calls.filter((c) => c[0] === 'saveChunk');
    assert.ok(chunks.length >= 3, 'potongan terlalu sedikit: ' + chunks.length);
    const transfer = h.finishResults[0].transfer;
    const joined = transfer.chunks.join('');
    assert.strictEqual(joined.length % 4, 0, 'panjang base64 gabungan tidak kelipatan 4');
    assert.ok(Buffer.from(joined, 'base64').equals(bytes), 'isi berkas besar berbeda');
    for (const chunk of transfer.chunks.slice(0, -1)) {
      assert.strictEqual(chunk.length, 1048576, 'ukuran potongan tidak 1 MiB');
    }
  });

  await checkAsync('blob tanpa createObjectURL (cadangan fetch) tetap tersimpan', async () => {
    const h = createHarness();
    const text = 'undangan dari fetch';
    const blob = new h.window.Blob([text], { type: 'text/html' });
    const url = 'blob:https://asproject.my.id/manual-1';
    h.blobRegistry.set(url, blob);
    clickDownload(h.window, url, 'manual.html', 'text/html');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const transfer = h.finishResults[0].transfer;
    assert.strictEqual(Buffer.from(transfer.chunks.join(''), 'base64').toString('utf8'), text);
  });

  console.log('\n5) Penanganan kegagalan');
  await checkAsync('penyimpanan ditolak → pesan kesalahan, bukan unduhan buta', async () => {
    const h = createHarness({ finishFails: true });
    const url = h.window.URL.createObjectURL(new h.window.Blob(['x'], { type: 'text/plain' }));
    clickDownload(h.window, url, 'gagal.txt', 'text/plain');
    await new Promise((resolve) => setTimeout(resolve, 60));
    const list = toasts(h.window);
    assert.ok(list.some((t) => /Gagal menyimpan/i.test(t)), 'tidak ada pesan gagal: ' + JSON.stringify(list));
  });

  await checkAsync('penulisan potongan gagal → berhenti dengan pesan', async () => {
    const h = createHarness({ chunkFails: true });
    const url = h.window.URL.createObjectURL(new h.window.Blob(['y'], { type: 'text/plain' }));
    clickDownload(h.window, url, 'potong.txt', 'text/plain');
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.ok(h.calls.some((c) => c[0] === 'saveChunk'));
    assert.strictEqual(h.calls.filter((c) => c[0] === 'saveFinish').length, 0);
    assert.ok(toasts(h.window).some((t) => /Gagal/i.test(t)));
  });

  console.log('\n6) Tidak mengganggu halaman biasa');
  {
    const h = createHarness();
    const anchor = h.window.document.createElement('a');
    anchor.setAttribute('href', 'https://asproject.my.id/u/budi');
    anchor.textContent = 'Buka undangan';
    h.window.document.body.appendChild(anchor);
    const event = new h.window.MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    check('tautan tanpa atribut download tidak dicegat', () =>
      assert.strictEqual(h.calls.filter((c) => c[0] === 'saveBegin').length, 0));
  }
  await checkAsync('memuat skrip dua kali tidak menggandakan penanganan', async () => {
    const h = createHarness();
    h.window.eval(bridgeSource);
    const url = h.window.URL.createObjectURL(new h.window.Blob(['z'], { type: 'text/plain' }));
    clickDownload(h.window, url, 'sekali.txt', 'text/plain');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const begins = h.calls.filter((c) => c[0] === 'saveBegin');
    assert.strictEqual(begins.length, 1, 'saveBegin dipanggil ' + begins.length + ' kali');
  });
  {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://asproject.my.id/studio.html',
      runScripts: 'outside-only',
    });
    check('tanpa window.AsProject, skrip tidak melakukan apa pun', () => {
      dom.window.eval(bridgeSource);
      assert.strictEqual(dom.window.AsProjectNative.available, false);
      assert.strictEqual(typeof dom.window.AsProjectDownloader.onSaved, 'function');
    });
  }

  console.log('\n7) Kesamaan berkas jembatan (sumber vs aset build)');
  {
    const assetPath = path.resolve(__dirname, '..', '..', 'app', 'src', 'main', 'assets',
      'native-bridge.js');
    check('salinan aset Gradle identik dengan android/web/native-bridge.js', () => {
      assert.ok(fs.existsSync(assetPath), 'berkas aset tidak ada: ' + assetPath);
      const asset = fs.readFileSync(assetPath, 'utf8');
      assert.strictEqual(asset, bridgeSource,
        'kedua salinan berbeda — jalankan android/build/build-apk.sh untuk menyegarkan aset');
    });
  }

  console.log('\nRingkasan: ' + passed + ' lulus, ' + failed + ' gagal');
  process.exit(failed > 0 ? 1 : 0);
})();
