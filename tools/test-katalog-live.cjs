/* Uji assets/katalog-live.js — menerapkan Setting Katalog ke katalog publik.
 *
 * Yang dijaga:
 * - badge bawaan kartu DIPERBARUI (bukan ditumpuk badge kedua), dan bisa
 *   dihapus dengan string kosong;
 * - tema nonaktif disembunyikan + jumlah tema ikut;
 * - harga promo & harga coret, deskripsi, dan pita promo ikut berubah;
 * - urutan: tema unggulan naik ke depan;
 * - data kosong / fetch gagal → halaman dibiarkan apa adanya (tanpa error).
 *
 * Jalankan: npm i --no-save jsdom && node tools/test-katalog-live.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const baca = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let ok = 0, fail = 0;
const t = (nama, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + nama + (!cond && extra ? ' — ' + extra : ''));
};

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }

const tidur = ms => new Promise(r => setTimeout(r, ms));

async function muat(data, { gagal = false, kosong = false } = {}) {
  const dom = new JSDOM(baca('katalog/index.html'), {
    url: 'https://uji.test/katalog/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async () => {
        if (gagal) throw new Error('jaringan mati');
        const isi = kosong ? [] : [{ data: data, updated_at: '2026-11-08T00:00:00Z' }];
        return { ok: true, status: 200, json: async () => isi };
      };
    }
  });
  const w = dom.window;
  w.eval(baca('assets/katalog-live.js'));
  await tidur(250);
  return dom;
}

const kartuId = (d, id) => {
  const fav = d.querySelector('[data-favorite="' + id + '"]');
  return fav ? fav.closest('[data-template-card]') : null;
};
const teks = el => (el ? el.textContent.trim() : null);

(async () => {
  if (!JSDOM) {
    console.log('info  jsdom belum terpasang — uji katalog-live dilewati (npm i jsdom)');
    return;
  }

  /* ---------- 1. badge, harga, deskripsi, urutan ---------- */
  {
    const data = {
      version: 1,
      global: {},
      themes: {
        'luxury-gold': {
          visible: true, featured: true, order: 0, hargaNormal: 49000, hargaPromo: 39000,
          promoAktif: true, badge: 'BEST SELLER', desc: 'Deskripsi dari Setting Katalog'
        }
      }
    };
    const dom = await muat(data);
    const d = dom.window.document;
    const kartu = kartuId(d, 'luxury-gold');

    t('badge diperbarui (bukan ditumpuk)', teks(kartu.querySelector('.ap-new-badge')) === 'BEST SELLER', teks(kartu.querySelector('.ap-new-badge')));
    t('hanya ada satu badge di kartu', kartu.querySelectorAll('.ap-new-badge').length === 1);
    t('tidak ada badge melayang .asp-live-badge', d.querySelectorAll('.asp-live-badge').length === 0);
    t('harga promo tampil', teks(kartu.querySelector('.ap-card-price strong')) === 'Rp 39.000', teks(kartu.querySelector('.ap-card-price strong')));
    t('harga coret = harga normal', teks(kartu.querySelector('.ap-card-price del')) === 'Rp 49.000', teks(kartu.querySelector('.ap-card-price del')));
    t('deskripsi diganti', teks(kartu.querySelector('h3 + p')) === 'Deskripsi dari Setting Katalog');
    t('tema unggulan naik ke kartu pertama',
      d.querySelector('[data-template-card] h3').textContent.trim() === 'Luxury Gold',
      d.querySelector('[data-template-card] h3').textContent.trim());
    t('jumlah tema tetap 44', teks(d.querySelector('[data-catalog-count]')) === '44');
    dom.window.close();
  }

  /* ---------- 2. badge dikosongkan & tema disembunyikan ---------- */
  {
    const data = {
      version: 1, global: {},
      themes: {
        'luxury-gold': { visible: false, badge: '' },
        'ivory-klasik': { visible: true, badge: 'BARU', hargaNormal: 49000, hargaPromo: 29000 }
      }
    };
    const dom = await muat(data);
    const d = dom.window.document;
    const hilang = kartuId(d, 'luxury-gold');
    t('tema nonaktif disembunyikan', !!hilang && hilang.classList.contains('asp-live-hide'));
    t('aria-hidden diset untuk tema nonaktif', !!hilang && hilang.getAttribute('aria-hidden') === 'true');
    t('jumlah tema berkurang jadi 43', teks(d.querySelector('[data-catalog-count]')) === '43', teks(d.querySelector('[data-catalog-count]')));
    const badgeIvory = kartuId(d, 'ivory-klasik').querySelector('.ap-new-badge');
    t('badge "BARU" dipasang pada tema tanpa badge bawaan', teks(badgeIvory) === 'BARU', teks(badgeIvory));
    dom.window.close();
  }

  /* ---------- 3. badge string kosong menghapus badge ---------- */
  {
    const dom = await muat({ version: 1, global: {}, themes: { 'luxury-gold': { visible: true, badge: '' } } });
    const d = dom.window.document;
    t('badge kosong menghapus badge bawaan', kartuId(d, 'luxury-gold').querySelector('.ap-new-badge') === null);
    dom.window.close();
  }

  /* ---------- 4. pita promo ---------- */
  {
    const dom = await muat({
      version: 1,
      global: { promoAktif: true, hargaCoret: 99000, ribbon: 'Promo Uji', ribbonSub: 'Rp39.000 per tema' },
      themes: {}
    });
    const d = dom.window.document;
    const pita = d.querySelector('.ap-promo-ribbon');
    t('pita promo: judul diganti', teks(pita.querySelector('strong')) === 'Promo Uji', teks(pita.querySelector('strong')));
    t('pita promo: harga coret ikut', /Rp\s?99\.000/.test(pita.querySelector('span').textContent), pita.querySelector('span').textContent);
    dom.window.close();
  }
  {
    const dom = await muat({ version: 1, global: { promoAktif: false }, themes: {} });
    const d = dom.window.document;
    t('pita promo disembunyikan saat promo nonaktif', d.querySelector('.ap-promo-ribbon').classList.contains('asp-live-hide'));
    dom.window.close();
  }

  /* ---------- 5. aman saat kosong / gagal ---------- */
  {
    const dom = await muat({}, { kosong: true });
    const d = dom.window.document;
    t('cloud kosong: 44 kartu tetap tampil', d.querySelectorAll('[data-template-card]').length === 44);
    t('cloud kosong: badge bawaan tidak diubah', teks(kartuId(d, 'luxury-gold').querySelector('.ap-new-badge')) === 'PREMIUM');
    t('cloud kosong: tidak ada yang disembunyikan', d.querySelectorAll('.asp-live-hide').length === 0);
    dom.window.close();
  }
  {
    const dom = await muat({}, { gagal: true });
    const d = dom.window.document;
    t('fetch gagal: halaman dibiarkan apa adanya', d.querySelectorAll('[data-template-card]').length === 44 && d.querySelectorAll('.asp-live-hide').length === 0);
    t('fetch gagal: badge bawaan utuh', teks(kartuId(d, 'luxury-gold').querySelector('.ap-new-badge')) === 'PREMIUM');
    dom.window.close();
  }

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exitCode = fail ? 1 : 0;
})();
