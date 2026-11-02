/* Uji Setting Katalog (menggantikan uji halaman katalog di dalam studio.html).
   Halaman katalog admin sekarang berdiri sendiri: studio-katalog.html.

   Yang diuji (jsdom, offline):
   - 44 tema tampil sebagai baris pengaturan
   - tombol "Tampil" menyembunyikan baris (dan menyembunyikannya dari daftar)
   - ubah harga promo → "Simpan ke cloud" mengirim POST ke catalog_settings
   - kalau tabel cloud belum ada, status jujur "lokal" (bukan diam-diam gagal)
   - Ekspor JSON menghasilkan katalog-setting.json berisi pengaturan
   - daftar "Menunggu rilis" membaca kiriman dari Studio Template

   Jalankan: node tools/test-katalog-admin.cjs   (butuh: npm i jsdom) */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HASH = '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

async function boot({ cloudRows = null, cloudError = null } = {}) {
  const store = new Map();
  const calls = [];
  const downloads = [];
  const blobs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(String(e && e.message))) console.error(String(e.message)); });
  const dom = new JSDOM(read('studio-katalog.html'), {
    runScripts: 'dangerously', url: 'https://x.test/studio-katalog.html', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true;
      w.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:uji'; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, download: this.download }); };
      w.fetch = async (url, opts = {}) => {
        calls.push({ url: String(url), opts });
        if (cloudError) throw new Error(cloudError);
        if (opts.method === 'POST') return { ok: true, status: 201, text: async () => '', json: async () => null };
        return { ok: true, status: 200, text: async () => JSON.stringify(cloudRows || []), json: async () => (cloudRows || []) };
      };
      const ls = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k),
        clear: () => store.clear(),
        key: i => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; }
      };
      Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
      Object.defineProperty(w, 'sessionStorage', { value: ls, configurable: true });
    }
  });
  const w = dom.window;
  store.set('asproject_studio_auth', HASH);
  for (const src of ['assets/tpl-data.js', 'assets/studio-core.js', 'assets/studio-katalog.js']) w.eval(read(src));
  await sleep(40);
  return { dom, w, d: w.document, store, calls, downloads, blobs };
}

(async () => {
  /* ---- 1. cloud kosong: status lokal + 44 baris ---- */
  {
    const { dom, w, d, calls, downloads, blobs } = await boot({ cloudRows: [] });
    t('katalog: gerbang sandi terbuka', !d.querySelector('.asp-gate'));
    t('katalog: 44 tema tampil sebagai baris', d.querySelectorAll('[data-row]').length === 44, d.querySelectorAll('[data-row]').length + ' baris');
    t('katalog: cloud dibaca saat halaman dibuka', calls.some(c => c.url.includes('catalog_settings')));
    t('katalog: status jujur saat cloud kosong', /Lokal/i.test(d.querySelector('#pillSync').textContent), d.querySelector('#pillSync').textContent.trim());
    t('katalog: ringkasan menghitung tema tampil', d.querySelector('#statTampil').textContent === '44', d.querySelector('#statTampil').textContent);

    /* sembunyikan satu tema */
    const cek = d.querySelector('[data-t="luxury-gold"][data-f="visible"]');
    cek.checked = false;
    cek.dispatchEvent(new w.Event('input', { bubbles: true }));
    const barisSembunyi = d.querySelector('[data-row="luxury-gold"]');
    t('katalog: centang "Tampil" mematikan tema',
      !barisSembunyi || barisSembunyi.classList.contains('is-hidden'));
    t('katalog: tema tersembunyi hilang dari daftar default', !barisSembunyi);
    t('katalog: statistik langsung ikut', d.querySelector('#statSembunyi').textContent === '1', d.querySelector('#statSembunyi').textContent);

    /* ubah harga + simpan */
    const harga = d.querySelector('[data-t="ivory-klasik"][data-f="hargaPromo"]');
    harga.value = '39000';
    harga.dispatchEvent(new w.Event('input', { bubbles: true }));
    d.querySelector('#btnSimpan').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(60);
    const post = calls.find(c => c.opts && c.opts.method === 'POST');
    t('katalog: simpan mengirim POST ke catalog_settings', !!post && post.url.includes('catalog_settings'), post ? post.url : 'tidak ada POST');
    if (post) {
      const body = JSON.parse(post.opts.body);
      t('katalog: harga promo baru ikut terkirim', body[0].data.themes['ivory-klasik'].hargaPromo === 39000, JSON.stringify(body[0].data.themes['ivory-klasik'].hargaPromo));
      t('katalog: visibilitas ikut terkirim', body[0].data.themes['luxury-gold'].visible === false);
      t('katalog: kolom id = default', body[0].id === 'default');
    }

    /* ekspor */
    d.querySelector('#btnEkspor').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(30);
    t('katalog: tombol ekspor membuat berkas katalog-setting.json',
      downloads.some(x => x.download === 'katalog-setting.json'), JSON.stringify(downloads));
    t('katalog: isi ekspor berupa JSON pengaturan',
      blobs.length === 1 && blobs[0].type.includes('application/json'), blobs.length ? blobs[0].type : 'tidak ada blob');
    dom.window.close();
  }

  /* ---- 2. cloud sudah berisi pengaturan ---- */
  {
    const cloudRows = [{
      data: {
        version: 1, updatedAt: '2026-11-01T00:00:00Z',
        global: { promoAktif: false, hargaCoret: 129000, ribbon: 'Promo Uji', ribbonSub: 'Uji', catatan: '' },
        themes: { 'luxury-gold': { visible: false, featured: true, order: 1, hargaNormal: 99000, hargaPromo: 59000, promoAktif: true, badge: 'UJI', desc: 'Deskripsi uji' } }
      },
      updated_at: '2026-11-01T00:00:00Z'
    }];
    const { dom, w, d } = await boot({ cloudRows });
    t('katalog: pengaturan cloud dipakai (pill cloud)', /Tersimpan di cloud|Dimuat dari cloud/i.test(d.querySelector('#pillSync').textContent), d.querySelector('#pillSync').textContent.trim());
    t('katalog: tema nonaktif dari cloud disembunyikan default', !d.querySelector('[data-row="luxury-gold"]'));
    const filt = d.querySelector('#filterSembunyi');
    filt.checked = true;
    filt.dispatchEvent(new w.Event('change', { bubbles: true }));
    t('katalog: centang "tampilkan tersembunyi" memunculkan kembali', !!d.querySelector('[data-row="luxury-gold"]'));
    t('katalog: badge cloud tampil di kolom badge',
      (d.querySelector('[data-t="luxury-gold"][data-f="badge"]') || {}).value === 'UJI',
      (d.querySelector('[data-t="luxury-gold"][data-f="badge"]') || {}).value);
    t('katalog: promo global nonaktif terbaca', d.querySelector('[data-g="promoAktif"]').checked === false);
    dom.window.close();
  }

  /* ---- 3. tabel belum ada: pesan jelas ---- */
  {
    const { dom, d } = await boot({ cloudError: 'HTTP 404: relation "catalog_settings" does not exist' });
    const teks = (d.querySelector('#statusTeks') || {}).textContent || '';
    t('katalog: tabel belum ada dijelaskan, bukan gagal senyap', /catalog_settings|Bagian 4/i.test(teks), teks.slice(0, 90));
    t('katalog: halaman tetap bisa dipakai (44 baris)', d.querySelectorAll('[data-row]').length === 44);
    dom.window.close();
  }

  /* ---- 4. daftar tunggu dari Studio Template ---- */
  {
    const { dom, w, d, store } = await boot({ cloudRows: [] });
    store.set('asproject_katalog_setting_v1', JSON.stringify({ pending: [{ id: 'tema-uji', nama: 'Tema Uji', baseTpl: 'luxury-gold' }] }));
    /* Reset memicu renderAll() yang ikut merender daftar tunggu (confirm = true). */
    d.querySelector('#btnReset').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(30);
    t('katalog: kiriman Studio Template tampil sebagai "menunggu rilis"',
      (d.querySelector('#daftarPending') || {}).textContent.includes('Tema Uji'),
      (d.querySelector('#daftarPending') || {}).textContent.slice(0, 80));
    t('katalog: tema kiriman tidak otomatis masuk daftar 44',
      d.querySelectorAll('[data-row]').length === 44 && !d.querySelector('[data-row="tema-uji"]'));
    dom.window.close();
  }

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
