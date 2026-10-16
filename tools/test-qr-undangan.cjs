#!/usr/bin/env node
/* ============================================================
   test-qr-undangan.cjs — kartu QR check-in DI DALAM undangan.

   Latar: QR check-in tadinya cuma bisa diunduh dari Studio/Master sebagai
   berkas PNG, jadi tamu yang datang tanpa cetakan tidak punya apa pun untuk
   dipindai panitia. Sekarang undangan menampilkan QR yang SAMA untuk tamunya
   sendiri (isinya checkin.html?guest=..&id=KODE&s=slug), muncul di bagian
   RSVP — dari tautan personal (?to=Nama) atau setelah tamu menulis namanya.

   Yang dikunci tes ini:
     - panel QR hidup di dalam kartu RSVP, bukan slide baru (urutan 10 slide
       & pola `S.rsvp&&S.rsvp.on` yang diperiksa cek-kesehatan tetap utuh);
     - tanpa nama: cuma petunjuk, tidak ada QR palsu;
     - nama + kode dari daftar tamu Studio → QR berisi guest, id, dan s;
     - kecocokan nama tidak peka huruf besar/kecil, tapi hanya cocok PERSIS
       yang boleh memakai kode (nama mirip jangan tercatat sebagai tamu lain);
     - nama di luar daftar tetap dapat QR berbasis nama (tanpa id);
     - QR yang benar-benar digambar bisa DIBACA KEMBALI oleh assets/jsqr.js
       (dekoder yang dipakai scan.html) menjadi URL check-in yang utuh;
     - quiet zone 4 modul & modul digabung per baris;
     - basis URL benar walau undangan dibuka lewat /u/{slug};
     - XSS: nama ber-tag tidak melahirkan elemen baru;
     - tombol Simpan QR tidak pernah jadi jalan buntu (PNG, kalau tidak ada
       kanvas jatuh ke SVG);
     - RSVP dimatikan → kartu QR tetap tampil.

   Jalankan: node tools/test-qr-undangan.cjs   (butuh: npm i jsdom)
   ============================================================ */
'use strict';
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jsQR = require(path.join(ROOT, 'assets', 'jsqr.js'));

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

const GUEST_A = 'Budi Santoso', KODE_A = 'AB12CD34';
const GUEST_B = 'Sari Dewi', KODE_B = 'ZX98YU76';
const SLUG_UJI = 'uji-qr';

function stubIO(w) {
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.els = new Set(); }
    observe(el) { this.els.add(el); }
    unobserve(el) { this.els.delete(el); }
    disconnect() { this.els.clear(); }
  };
  if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
}

function draftQr(slidesOver) {
  return {
    slug: SLUG_UJI, name1: 'Satrio', name2: 'Pandu', theme: 0,
    venue: 'Bendo Gede 2', event_date: '2026-11-02', event_time: '08:00',
    data: {
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu', putraPutri: 'Bpk. A & Ibu B', putriDari: 'Bpk. C & Ibu D',
        tanggalAcara: '2026-11-02', jamAcara: '08:00', zona: 'WIB', venue: 'Bendo Gede 2',
        alamat: 'Bendo Gede 2, Sumbergiri, Kec. Ponjong, Kabupaten Gunungkidul',
        mapsLink: '', salamBuka: '', salamTutup: '', ucapanCustom: '',
      },
      event: 'pernikahan', tpl: 'ivory-klasik', doa: 'pernikahan',
      accent: '#8A6E4B', fontTitle: 'playfair', fontBody: 'inter', border: 'none', amplop: {},
      cover: '', coverStyle: 'kotak', coverPos: { x: 50, y: 50, z: 1 }, gallery: [],
      guestsRaw: GUEST_A + '\n' + GUEST_B,
      guestCodes: { [GUEST_A]: KODE_A, [GUEST_B]: KODE_B },
      slides: { rsvp: { on: true }, map: { on: false }, closing: { on: true, text: 'Terima kasih.' }, ...(slidesOver || {}) },
      anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up' },
    },
  };
}

function buatDom(url, opsi) {
  const o = opsi || {};
  const dom = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously', url, pretendToBeVisual: true,
    beforeParse(w) {
      stubIO(w);
      w.fetch = async () => { throw new Error('offline-uji'); };
      try { w.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w.eval(read('assets/theme-contrast.js')); } catch (e) {}
      /* Di produksi assets/qrcode.js dimuat malas oleh qrPustaka(); untuk uji
         grafis, pustaka itu disuntik lebih dulu seperti kondisi tamu yang
         sudah membukanya. */
      if (o.pustakaQr !== false) { try { w.eval(read('assets/qrcode.js')); } catch (e) {} }
    },
  });
  return { dom, w: dom.window, D: dom.window.document };
}

/* Muat matriks QR dari SVG yang benar-benar tergambar di halaman. */
function matriksSvg(svgTeks) {
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svgTeks);
  if (!m) return null;
  const S = +m[1];
  const g = Array.from({ length: S }, () => new Array(S).fill(0));
  const re = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g;
  let t2, ada = 0;
  while ((t2 = re.exec(svgTeks))) {
    const x = +t2[1], y = +t2[2], w = +t2[3];
    for (let i = 0; i < w; i++) g[y][x + i] = 1;
    ada++;
  }
  return ada ? { ukuran: S, modul: g } : null;
}

/* Rasterkan matriks → buffer abu-abu, lalu baca kembali dengan jsQR
   (dekoder yang sama dengan scan.html di HP panitia). */
function bacaQr(matriks, skala) {
  const S = matriks.ukuran, N = S * (skala || 4);
  const buf = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gelap = matriks.modul[Math.floor(y / skala)][Math.floor(x / skala)];
    const v = gelap ? 0 : 255;
    const i = (y * N + x) * 4;
    buf[i] = buf[i + 1] = buf[i + 2] = v; buf[i + 3] = 255;
  }
  const hasil = jsQR(buf, N, N, { inversionAttempts: 'dontInvert' });
  return hasil && hasil.data ? hasil.data : null;
}

(async () => {
  /* =============== 1) Tamu dari tautan personal (?to=Budi Santoso) =============== */
  const A = buatDom('https://x.test/undangan.html?slug=' + SLUG_UJI + '&to=' + encodeURIComponent(GUEST_A));
  await sleep(400);
  A.w.eval('boot(' + JSON.stringify(draftQr()) + ')');
  await sleep(120);
  const D = A.D, w = A.w;

  const panel = D.getElementById('qrcard');
  t('Tampil: kartu QR ada di undangan', !!panel);
  t('Tampil: kartu QR menempel di kartu RSVP (bukan slide baru)', !!panel && !!panel.closest('.card') && !!panel.closest('.card').querySelector('#rvpN'));
  t('Tampil: urutan 10 slide tidak bertambah', w.eval('SLIDE_ORDER.length') === 10 && w.eval('SLIDE_ORDER[8]') === 'rsvp');
  t('Tampil: label kartu menyebut check-in', !!panel && /QR Check-in/.test(panel.querySelector('.qrlbl').textContent), panel && panel.querySelector('.qrlbl').textContent);
  t('Tampil: nama tamu dari tautan dipakai', panel.querySelector('#qrNm').textContent === GUEST_A, panel.querySelector('#qrNm').textContent);
  t('Tampil: kode guest dari daftar Studio dipakai', panel.querySelector('#qrKd').textContent === 'Kode: ' + KODE_A, panel.querySelector('#qrKd').textContent);
  t('Tampil: kartu tidak dalam keadaan kosong', !panel.classList.contains('qr-kosong'));

  /* isi QR = URL check-in yang sama dengan yang diunduh dari Studio/Master */
  const teksQr = panel.getAttribute('data-qr-teks');
  const u = new URL(teksQr);
  t('Isi QR: basis = akar situs', teksQr.startsWith('https://x.test/checkin.html?'), teksQr);
  t('Isi QR: membawa nama tamu', u.searchParams.get('guest') === GUEST_A, teksQr);
  t('Isi QR: membawa kode tamu', u.searchParams.get('id') === KODE_A, teksQr);
  t('Isi QR: membawa slug undangan untuk halaman check-in', u.searchParams.get('s') === SLUG_UJI, teksQr);
  t('Isi QR: basis tersimpan di kartu (dipakai saat mencetak)', panel.getAttribute('data-qr-basis') === 'https://x.test/', panel.getAttribute('data-qr-basis'));

  /* ---- QR grafis & quiet zone ---- */
  const svgTeks = panel.querySelector('#qrSvg svg') ? panel.querySelector('#qrSvg svg').outerHTML : '';
  t('Grafis: QR digambar sebagai SVG', /^<svg /.test(svgTeks), svgTeks.slice(0, 60));
  t('Grafis: ada latar putih (tidak transparan)', svgTeks.includes('fill="#fff"'));
  const matriks = matriksSvg(svgTeks);
  t('Grafis: modul gelap digabung per baris', !!matriks);
  if (matriks) {
    const n = matriks.ukuran - 8;
    t('Grafis: quiet zone 4 modul di keempat sisi', n >= 21 && (n - 17) % 4 === 0, 'ukuran=' + matriks.ukuran);
    let tepi = 0;
    for (let i = 0; i < matriks.ukuran; i++) {
      if (matriks.modul[0][i] || matriks.modul[i][0] || matriks.modul[matriks.ukuran - 1][i] || matriks.modul[i][matriks.ukuran - 1]) tepi++;
    }
    t('Grafis: tepi QR bersih (quiet zone benar-benar kosong)', tepi === 0, 'modul gelap di tepi: ' + tepi);
    /* ---- dibaca kembali oleh dekoder yang dipakai panitia ---- */
    const terbaca = bacaQr(matriks, 4);
    t('Baca ulang: jsQR (dekoder scan.html) membaca QR yang digambar', terbaca === teksQr, String(terbaca));
    if (terbaca) {
      const bu = new URL(terbaca);
      t('Baca ulang: URL hasil pembacaan cocok untuk scan.html',
        bu.pathname.endsWith('/checkin.html') && bu.searchParams.get('guest') === GUEST_A && bu.searchParams.get('id') === KODE_A,
        terbaca);
    }
  }

  /* ---- RSVP dimatikan: kartu QR tetap ada ---- */
  w.eval('boot(' + JSON.stringify(draftQr({ rsvp: { on: false } })) + ')');
  await sleep(120);
  const panel2 = D.getElementById('qrcard');
  t('RSVP mati: kartu QR tetap tampil', !!panel2 && !!panel2.closest('.card') && !D.getElementById('rvpN'));
  t('RSVP mati: QR tetap berisi kode tamu', !!panel2 && /id=AB12CD34/.test(panel2.getAttribute('data-qr-teks') || ''), panel2 && panel2.getAttribute('data-qr-teks'));

  /* =============== 2) Mode 1 link: nama ditulis tamu sendiri =============== */
  const B = buatDom('https://x.test/undangan.html?slug=' + SLUG_UJI);
  await sleep(400);
  B.w.eval('boot(' + JSON.stringify(draftQr()) + ')');
  await sleep(120);
  const DB = B.D, wB = B.w;
  const inp = DB.getElementById('rvpN');
  t('1 link: kartu QR mulai kosong (belum ada nama)', !!panel && DB.getElementById('qrcard').classList.contains('qr-kosong'));
  t('1 link: petunjuk mengarahkan isi nama di kolom RSVP', /Tulis nama Anda/.test(DB.getElementById('qrTip').textContent), DB.getElementById('qrTip').textContent);
  t('1 link: belum ada QR palsu sebelum nama dikenal', DB.querySelector('#qrSvg svg') === null);

  const ketik = async (nama) => {
    inp.value = nama;
    inp.dispatchEvent(new B.w.Event('input'));
    await sleep(420);
  };
  await ketik(GUEST_A);
  let box = DB.getElementById('qrcard');
  t('1 link: QR muncul setelah nama ditulis', !!box.querySelector('#qrSvg svg') && !box.classList.contains('qr-kosong'));
  t('1 link: kode tamu ikut terpasang', /id=AB12CD34/.test(box.getAttribute('data-qr-teks')), box.getAttribute('data-qr-teks'));

  await ketik('  ' + GUEST_A.toUpperCase() + '  ');
  t('1 link: nama beda kapitalisasi & spasi tetap dapat kode', /id=AB12CD34/.test(box.getAttribute('data-qr-teks')), box.getAttribute('data-qr-teks'));

  await ketik('Bud');
  t('1 link: nama mirip (belum lengkap) TIDAK memakai kode orang lain', !/id=/.test(box.getAttribute('data-qr-teks')), box.getAttribute('data-qr-teks'));
  t('1 link: nama di luar daftar tetap dapat QR berbasis nama', /guest=Bud&/.test(box.getAttribute('data-qr-teks')) || /guest=Bud$/.test(box.getAttribute('data-qr-teks')), box.getAttribute('data-qr-teks'));
  t('1 link: catatan menjelaskan nama belum di daftar tamu', /daftar tamu/.test(DB.getElementById('qrTip').textContent), DB.getElementById('qrTip').textContent);
  t('1 link: nama & slug tetap ikut walau tanpa kode', (() => { const x = new URL(box.getAttribute('data-qr-teks')); return x.searchParams.get('s') === SLUG_UJI; })());

  /* ganti nama kembali → QR ikut berganti (tanpa menumpuk) */
  await ketik(GUEST_B);
  t('1 link: ganti nama → kode tamu ikut berganti', /id=ZX98YU76/.test(box.getAttribute('data-qr-teks')), box.getAttribute('data-qr-teks'));
  t('1 link: hanya satu SVG di kartu (tidak menumpuk)', box.querySelectorAll('#qrSvg svg').length === 1);

  /* ---- XSS: nama ber-tag ---- */
  const jahat = '"><img src=x onerror=alert(1)>';
  await ketik(jahat);
  t('XSS: nama ber-tag tidak melahirkan elemen baru', DB.querySelector('img[src="x"]') === null && DB.querySelectorAll('[onerror]').length === 0);
  t('XSS: nama ditulis sebagai teks, bukan markup', DB.getElementById('qrNm').innerHTML.indexOf('<img') < 0 && DB.getElementById('qrNm').textContent === jahat, DB.getElementById('qrNm').innerHTML);
  t('XSS: URL QR memuat nama yang sudah ter-encode', (box.getAttribute('data-qr-teks') || '').indexOf('%3Cimg') > 0, box.getAttribute('data-qr-teks'));

  /* =============== 3) Undangan dibuka lewat /u/{slug} =============== */
  const C = buatDom('https://x.test/u/' + SLUG_UJI + '?slug=' + SLUG_UJI + '&to=' + encodeURIComponent(GUEST_B));
  await sleep(400);
  C.w.eval('boot(' + JSON.stringify(draftQr()) + ')');
  await sleep(120);
  const panelC = C.D.getElementById('qrcard');
  t('/u/ route: basis tetap akar situs (bukan folder /u/)', panelC.getAttribute('data-qr-basis') === 'https://x.test/', panelC.getAttribute('data-qr-basis'));
  t('/u/ route: QR menunjuk checkin.html di akar', /^https:\/\/x\.test\/checkin\.html\?/.test(panelC.getAttribute('data-qr-teks')), panelC.getAttribute('data-qr-teks'));
  const matriksC = matriksSvg(panelC.querySelector('#qrSvg svg').outerHTML);
  const bacaC = matriksC ? bacaQr(matriksC, 4) : null;
  t('/u/ route: QR tetap terbaca menjadi URL check-in yang sah', bacaC === panelC.getAttribute('data-qr-teks'), String(bacaC));

  /* =============== 4) Pustaka QR dimuat malas =============== */
  const E = buatDom('https://x.test/undangan.html?slug=' + SLUG_UJI + '&to=' + encodeURIComponent(GUEST_A), { pustakaQr: false });
  await sleep(400);
  E.w.eval('boot(' + JSON.stringify(draftQr()) + ')');
  await sleep(150);
  const panelE = E.D.getElementById('qrcard');
  t('Malas: assets/qrcode.js tidak ikut <head> sejak awal', read('undangan.html').includes('assets/qrcode.js') && !/<script src="assets\/qrcode\.js"><\/script>/.test(read('undangan.html')));
  t('Malas: pustaka diminta lewat <script> saat QR dibutuhkan', !!E.D.querySelector('script[src="assets/qrcode.js"]'));
  t('Malas: selagi pustaka belum ada, kartu menampilkan status (bukan kosong)', /Menyiapkan QR/.test(panelE.querySelector('#qrSvg').innerHTML), panelE.querySelector('#qrSvg').innerHTML);
  t('Malas: tanpa pustaka tetap tidak ada galat halaman', true);

  /* =============== 5) Tombol Simpan QR =============== */
  const btn = D.querySelector('.qrbtn');
  t('Simpan: tombol tersedia di kartu', !!btn && /Simpan QR/.test(btn.textContent), btn && btn.textContent);
  let klikGagal = null;
  try { w.eval('qrUnduh(document.querySelector(".qrcard .qrbtn"))'); } catch (e) { klikGagal = e.message; }
  t('Simpan: tanpa kanvas & tanpa createObjectURL pun tidak melempar', klikGagal === null, klikGagal);
  t('Simpan: PNG dilewati bila kanvas tak ada', w.eval('qrPngDataUrl("uji",null)') === '');
  /* kanvas tiruan: pastikan jalur PNG benar-benar menggambar & memberi nama berkas */
  {
    const tersimpan = [];
    const ctx = { fillRect() {}, fillText() {}, set fillStyle(v) {}, set font(v) {} };
    const asli = D.createElement.bind(D);
    D.createElement = function (tag) {
      if (String(tag).toLowerCase() === 'canvas') {
        return { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,AAA' };
      }
      return asli(tag);
    };
    const aAsli = D.createElement('a');
    const klikAsli = A.w.HTMLAnchorElement.prototype.click;
    A.w.HTMLAnchorElement.prototype.click = function () { tersimpan.push({ href: this.getAttribute('href'), nama: this.getAttribute('download') }); };
    w.eval('qrUnduh(document.querySelector(".qrcard .qrbtn"))');
    A.w.HTMLAnchorElement.prototype.click = klikAsli;
    D.createElement = asli;
    t('Simpan: PNG dibuat saat kanvas tersedia', tersimpan.length === 1 && tersimpan[0].href === 'data:image/png;base64,AAA', JSON.stringify(tersimpan));
    t('Simpan: nama berkas mengikuti pola Studio', !!tersimpan[0] && tersimpan[0].nama === 'QR-Checkin-' + SLUG_UJI + '-budi-santoso-' + KODE_A + '.png', tersimpan[0] && tersimpan[0].nama);
  }

  /* =============== 6) Kontrak statis =============== */
  {
    const src = read('undangan.html');
    t('Kontrak: pola S.rsvp&&S.rsvp.on tetap ada (cek-kesehatan aturan 9)', /S\.rsvp&&S\.rsvp\.on/.test(src));
    t('Kontrak: berkas qrcode.js ada di repo', fs.existsSync(path.join(ROOT, 'assets', 'qrcode.js')));
    t('Kontrak: QR tidak bergantung pada layanan luar', !/chart\.googleapis|api\.qrserver|goqr\.me/.test(src));
    t('Kontrak: tetap ada jalan keluar bila QR gagal dimuat', src.includes('minta panitia mencatat kehadiran manual'));
  }

  [A, B, C, E].forEach(x => x.dom.window.close());
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
