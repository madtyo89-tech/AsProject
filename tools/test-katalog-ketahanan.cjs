/* Uji KETAHANAN Setting Katalog — data aneh dari cloud + tabrakan dengan
 * kontrol katalog (pencarian/urut) yang sudah ada.
 *
 * Uji ini sengaja memberi data yang TIDAK rapi: field hilang, angka berupa
 * string, badge berisi HTML, `themes` bukan objek, semua tema disembunyikan.
 * Yang dijaga: katalog tetap waras (tidak ada "Rp 0", "NaN", skrip tersuntik,
 * atau tema hilang dari hitungan).
 *
 * Jalankan: npm i --no-save jsdom && node tools/test-katalog-ketahanan.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const baca = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let ok = 0, fail = 0;
const t = (nama, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + nama + (!cond && extra !== undefined ? ' — ' + extra : ''));
};

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }

const tidur = ms => new Promise(r => setTimeout(r, ms));

async function muat(data, { mentah = null, halaman = 'katalog/index.html' } = {}) {
  const dom = new JSDOM(baca(halaman), {
    url: 'https://uji.test/katalog/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async () => ({
        ok: true, status: 200,
        json: async () => (mentah !== null ? mentah : [{ data: data, updated_at: '2026-11-08T00:00:00Z' }])
      });
    }
  });
  const w = dom.window;
  w.eval(baca('assets/katalog-v2.js'));
  w.eval(baca('assets/katalog-live.js'));
  await tidur(250);
  return dom;
}

const kartu = (d, id) => {
  const fav = d.querySelector('[data-favorite="' + id + '"]');
  return fav ? fav.closest('[data-template-card]') : null;
};
const teks = el => (el ? el.textContent.trim() : null);
const harga = (d, id) => {
  const c = kartu(d, id);
  return c ? { utama: teks(c.querySelector('.ap-card-price strong')), coret: teks(c.querySelector('.ap-card-price del')) } : null;
};
const urutan = d => Array.from(d.querySelectorAll('[data-template-card]')).map(c => {
  const f = c.querySelector('[data-favorite]');
  return f ? f.dataset.favorite : '?';
});
const cari = (d, kata) => {
  const el = d.querySelector('[data-catalog-search]');
  el.value = kata;
  el.dispatchEvent(new d.defaultView.Event('input', { bubbles: true }));
};

(async () => {
  if (!JSDOM) {
    console.log('info  jsdom belum terpasang — uji ketahanan katalog dilewati (npm i jsdom)');
    return;
  }

  const build = urutan(new JSDOM(baca('katalog/index.html')).window.document);
  const kartuBuild = build.length;

  /* ---------- 1. promo dimatikan per tema ---------- */
  {
    const d = (await muat({ version: 1, global: {}, themes: { 'luxury-gold': {
      visible: true, hargaNormal: 49000, hargaPromo: 39000, promoAktif: false
    } } })).window.document;
    const h = harga(d, 'luxury-gold');
    t('promo nonaktif: harga utama = harga normal', h && h.utama === 'Rp 49.000', h && h.utama);
    t('promo nonaktif: tidak ada harga "Rp 0"', d.body.textContent.indexOf('Rp 0') < 0);
  }

  /* ---------- 2. tema hanya diatur badge/deskripsi (harga tidak dikirim) ---------- */
  {
    const d = (await muat({ version: 1, global: {}, themes: { 'luxury-gold': { badge: 'BARU', desc: 'Hanya deskripsi' } } })).window.document;
    const h = harga(d, 'luxury-gold');
    t('tanpa hargaNormal/hargaPromo: harga bawaan tidak diubah', h && h.utama === 'Rp 49.000' && h.coret === 'Rp 99.000', JSON.stringify(h));
  }

  /* ---------- 3. angka dikirim sebagai string / ngawur ---------- */
  {
    const d = (await muat({ version: 1, global: {}, themes: { 'luxury-gold': {
      visible: true, hargaNormal: '49000', hargaPromo: '39000', promoAktif: true, order: 'abc'
    } } })).window.document;
    const h = harga(d, 'luxury-gold');
    t('harga string "49000": diformat benar', h && h.utama === 'Rp 39.000' && h.coret === 'Rp 49.000', JSON.stringify(h));
    t('order "abc": tidak menjadi NaN', d.querySelector('[data-live-order="NaN"], [data-live-order*="NaN"]') === null);
  }

  /* ---------- 4. suntikan HTML lewat badge / deskripsi / pita promo ---------- */
  {
    const jahat = '<img src=x onerror="window.__tersuntik=1">Nama';
    const d = (await muat({
      version: 1, global: { ribbonSub: jahat, ribbon: jahat },
      themes: { 'luxury-gold': { badge: jahat, desc: '<script>window.__tersuntik=1</script>Teks' } }
    })).window;
    const doc = d.document;
    const badge = kartu(doc, 'luxury-gold').querySelector('.ap-new-badge');
    t('badge ber-HTML: jadi teks, tidak membuat <img>', badge && badge.querySelector('img') === null, badge && badge.innerHTML.slice(0, 60));
    t('deskripsi ber-<script>: tidak membuat elemen script', kartu(doc, 'luxury-gold').querySelector('h3 + p script') === null);
    t('pita promo: tidak membuat elemen img', doc.querySelector('.ap-promo-ribbon img') === null);
    t('tidak ada yang tersuntik & jalan', d.__tersuntik === undefined);
  }

  /* ---------- 5. themes bukan objek ---------- */
  {
    for (const aneh of [[], 'teks', 42, null]) {
      const d = (await muat({ version: 1, global: {}, themes: aneh })).window.document;
      t('themes=' + JSON.stringify(aneh) + ': 44 kartu tetap tampil',
        d.querySelectorAll('[data-template-card]').length === kartuBuild,
        d.querySelectorAll('[data-template-card]').length);
    }
  }

  /* ---------- 6. hanya satu tema diberi urutan: kartu lain tidak terlempar ---------- */
  {
    const target = build[5];
    const d = (await muat({ version: 1, global: {}, themes: { [target]: { visible: true, order: 0 } } })).window.document;
    const u = urutan(d);
    t('order 0 pada satu tema: kartu itu jadi pertama', u[0] === target, u.slice(0, 3).join(','));
    const sisanya = u.slice(1).filter(id => id !== target);
    const buildSisa = build.filter(id => id !== target);
    t('order satu tema: 43 kartu lain tetap urutan build', JSON.stringify(sisanya) === JSON.stringify(buildSisa),
      sisanya.slice(0, 5).join(','));
  }

  /* ---------- 7. tema disembunyikan lalu dicari ---------- */
  {
    const sembunyi = build[3];
    const dom = await muat({ version: 1, global: {}, themes: { 'luxury-gold': { visible: false }, [sembunyi]: { visible: false } } });
    const d = dom.window.document;
    cari(d, '');
    const jumlah = teks(d.querySelector('[data-catalog-count]'));
    t('pencarian tidak menghitung tema tersembunyi', !/(^|\D)' + kartuBuild + '(\D|$)/.test(jumlah || ''), jumlah);
    t('tema tersembunyi tetap tersembunyi setelah pencarian',
      kartu(d, sembunyi).classList.contains('asp-live-hide'));
    cari(d, 'rosewood');
    t('mencari tema tersembunyi: tidak muncul', kartu(d, sembunyi).hidden !== false || kartu(d, sembunyi).classList.contains('asp-live-hide'),
      'hidden=' + kartu(d, sembunyi).hidden);
  }

  /* ---------- 8. urutan live bertahan setelah sort & reset ---------- */
  {
    const target = build[8];
    const dom = await muat({ version: 1, global: {}, themes: { [target]: { visible: true, featured: true, order: 0 } } });
    const d = dom.window.document;
    t('unggulan di depan sebelum kontrol disentuh', urutan(d)[0] === target);
    const sortEl = d.querySelector('[data-catalog-sort]');
    sortEl.value = 'name-asc'; sortEl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    sortEl.value = 'featured'; sortEl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    t('unggulan kembali di depan setelah sort direset', urutan(d)[0] === target, urutan(d).slice(0, 3).join(','));
    t('kalimat hitungan tetap utuh ("44 tema ditampilkan")', teks(d.querySelector('[data-catalog-count]')) === '44 tema ditampilkan',
      teks(d.querySelector('[data-catalog-count]')));
  }

  /* ---------- 9. sort harga memakai harga hasil setting ---------- */
  {
    const dom = await muat({ version: 1, global: {}, themes: { 'luxury-gold': {
      visible: true, hargaNormal: 49000, hargaPromo: 5000, promoAktif: true
    } } });
    const d = dom.window.document;
    const sortEl = d.querySelector('[data-catalog-sort]');
    sortEl.value = 'price-asc'; sortEl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    t('sort harga termurah memakai harga setting', urutan(d)[0] === 'luxury-gold', urutan(d).slice(0, 3).join(','));
  }

  /* ---------- 10. semua tema disembunyikan ---------- */
  {
    const themes = {};
    build.forEach(id => { themes[id] = { visible: false }; });
    const d = (await muat({ version: 1, global: {}, themes })).window.document;
    t('semua disembunyikan: hitungan 0', /^0\s+tema/.test(teks(d.querySelector('[data-catalog-count]')) || ''), teks(d.querySelector('[data-catalog-count]')));
    t('semua disembunyikan: pesan "belum ditemukan" tampil', d.querySelector('[data-catalog-empty]').hidden === false);
  }

  /* ---------- 11. baris ganda / data null dari PostgREST ---------- */
  {
    const d = (await muat(null, { mentah: [{ data: null }] })).window.document;
    t('data null: halaman apa adanya', d.querySelectorAll('[data-template-card]').length === kartuBuild);
  }

  /* ---------- 12. halaman detail tema (template/<id>/) ---------- */
  {
    const HAL = 'template/luxury-gold/index.html';
    const d = (await muat({ version: 1, global: {}, themes: { 'luxury-gold': { badge: 'BARU', desc: 'Deskripsi detail' } } }, { halaman: HAL })).window.document;
    const price = d.querySelector('.ap-price');
    t('detail: harga tidak jadi NaN saat harga tidak dikirim', !/NaN|Rp 0/.test(price.textContent), price.textContent.slice(0, 60));
    t('detail: deskripsi katalog mengganti lead', teks(d.querySelector('.ap-lead')) === 'Deskripsi detail', teks(d.querySelector('.ap-lead')));
    t('detail: badge tampil sekali', d.querySelectorAll('.asp-live-badge').length === 1, d.querySelectorAll('.asp-live-badge').length);

    const d2 = (await muat({ version: 1, global: {}, themes: { 'luxury-gold': { hargaNormal: 49000, hargaPromo: 39000, promoAktif: false } } }, { halaman: HAL })).window.document;
    const p2 = d2.querySelector('.ap-price');
    t('detail: promo nonaktif -> harga normal', /49\.000/.test(p2.textContent) && !/39\.000/.test(p2.textContent), p2.textContent.slice(0, 60));

    const d3 = (await muat({ version: 1, global: {}, themes: { 'luxury-gold': { badge: '<img src=x onerror="window.__x=1">' } } }, { halaman: HAL })).window;
    t('detail: badge ber-HTML jadi teks', d3.document.querySelector('.asp-live-badge img') === null && d3.__x === undefined);
  }

  /* ---------- 13. pita promo global: promo off + catatan ---------- */
  {
    const d = (await muat({ version: 1, global: { promoAktif: false, catatan: 'Catatan baru' }, themes: {} })).window.document;
    t('promo global off: pita disembunyikan', d.querySelector('.ap-promo-ribbon').classList.contains('asp-live-hide'));
  }

  /* ---------- 14. halaman kategori undangan/<acara>/ ---------- */
  {
    const HAL = 'undangan/pernikahan/index.html';
    const awal = new JSDOM(baca(HAL)).window.document;
    const judul0 = awal.querySelector('h2').textContent.trim();
    const n0 = parseInt(judul0, 10);
    const idPertama = awal.querySelector('[data-template-card] [data-favorite]').dataset.favorite;

    const dom = await muat({ version: 1, global: {}, themes: {
      'gerbang-rosewood': { visible: false },
      'luxury-gold': { visible: true, featured: true, order: 0 }
    } }, { halaman: HAL });
    const d = dom.window.document;
    t('kategori: judul "N pilihan" ikut berkurang', teks(d.querySelector('h2')) === (n0 - 1) + ' pilihan untuk dijelajahi', teks(d.querySelector('h2')));
    t('kategori: tema nonaktif disembunyikan', d.querySelectorAll('.asp-live-hide').length === 1);
    t('kategori: unggulan naik ke depan', d.querySelector('[data-template-card]:not(.asp-live-hide) [data-favorite]').dataset.favorite === 'luxury-gold',
      d.querySelector('[data-template-card]:not(.asp-live-hide) [data-favorite]').dataset.favorite + ' (awal: ' + idPertama + ')');
  }

  /* ---------- 15. promo global dimatikan (janji label di studio) ---------- */
  {
    const d = (await muat({ version: 1, global: { promoAktif: false }, themes: {} })).window.document;
    const h = harga(d, 'luxury-gold');
    t('promo global mati: kartu tanpa setting naik ke harga normal', h && h.utama === 'Rp 99.000', JSON.stringify(h));
    t('promo global mati: coretan promo dilepas', h && h.coret === null, JSON.stringify(h));

    const d2 = (await muat({ version: 1, global: {}, themes: {} })).window.document;
    const h2 = harga(d2, 'luxury-gold');
    t('promo global hidup: kartu tanpa setting tidak diubah', h2 && h2.utama === 'Rp 49.000' && h2.coret === 'Rp 99.000', JSON.stringify(h2));

    const d3 = (await muat({ version: 1, global: { promoAktif: false }, themes: {} }, { halaman: 'template/luxury-gold/index.html' })).window.document;
    const p3 = d3.querySelector('.ap-price');
    t('promo global mati: halaman detail naik ke harga normal', /99\.000/.test(p3.textContent) && !p3.querySelector('del'), p3.textContent.slice(0, 60));
  }

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exitCode = fail ? 1 : 0;
})();
