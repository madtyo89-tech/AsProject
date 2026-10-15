#!/usr/bin/env node
/* ============================================================
   test-peta.cjs — peta lokasi (slide "map") di undangan.html.

   Latar bug: tamu melaporkan embed Google Maps cuma bidang biru
   kosong. Penyebabnya berlapis:
     1) Di mode navigasi slide, slide yang belum aktif ber-
        display:none. Google Maps yang dirender di viewport 0x0
        tidak menggambar ubinnya saat slide akhirnya tampil.
     2) Query embed mengulang nama tempat yang sudah ada di
        alamat ("Bendo Gede 2, Bendo Gede 2, Sumbergiri, ...")
        sehingga Google gagal menentukan titik.
     3) Host lama maps.google.com menambah redirect yang macet
        di koneksi seluler lambat.

   Tes ini memastikan obatnya tidak hilang:
     - iframe peta lahir TANPA src; src baru terpasang saat
       kartu terlihat (IntersectionObserver) / slide dibuka.
     - query bersih: tanpa duplikasi, koordinat dari tautan
       Maps pemilik menang atas teks bebas.
     - URL embed kanonik www.google.com/maps?...&output=embed.
     - tombol muat ulang memasang ulang src dari nol.
     - alamat kosong tidak melahirkan iframe dunia-biru.

   Jalankan: node tools/test-peta.cjs   (butuh: npm i jsdom)
   ============================================================ */
'use strict';
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

/* IntersectionObserver yang bisa dipicu manual dari tes. */
function stubIO(w, observers) {
  w.IntersectionObserver = class {
    constructor(cb, opt) { this.cb = cb; this.opt = opt; this.els = new Set(); observers.push(this); }
    observe(el) { this.els.add(el); }
    unobserve(el) { this.els.delete(el); }
    disconnect() { this.els.clear(); }
    picu(el) { this.cb([{ target: el, isIntersecting: true }], this); }
  };
  if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  w.fetch = async () => { throw new Error('offline-uji'); };
}

function draftPeta(formOver) {
  return {
    slug: 'uji-peta', name1: 'Satrio', name2: 'Pandu', theme: 0,
    venue: 'Bendo Gede 2', event_date: '2026-11-02', event_time: '08:00',
    data: {
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu',
        putraPutri: 'Bpk. A & Ibu B', putriDari: 'Bpk. C & Ibu D',
        tanggalAcara: '2026-11-02', jamAcara: '08:00',
        venue: 'Bendo Gede 2',
        alamat: 'Bendo Gede 2, Sumbergiri, Kec. Ponjong, Kabupaten Gunungkidul, Daerah Istimewa Yogyakarta',
        ...(formOver || {}),
      },
      event: 'pernikahan', tpl: 'ivory-klasik', doa: 'pernikahan',
      accent: '#8A6E4B', fontTitle: 'playfair', fontBody: 'inter', border: 'none',
      amplop: {},
      slides: { map: { on: true }, rsvp: { on: true }, closing: { on: true, text: 'Terima kasih.' } },
      anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up' },
      music: { name: '', url: '' }, cover: '', coverStyle: 'kotak', coverPos: { x: 50, y: 50, z: 1 },
      gallery: [],
    },
  };
}

(async () => {
  const observers = [];
  const dom = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-peta',
    pretendToBeVisual: true,
    beforeParse(w) {
      stubIO(w, observers);
      try { w.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w.eval(read('assets/vip-4d.js')); } catch (e) {}
    },
  });
  const w = dom.window;
  const D = w.document;
  await sleep(400);

  /* ---- 1) Satuan query: duplikasi venue di alamat dibuang ---- */
  const q1 = w.eval(`petaQuery({alamat:'Bendo Gede 2, Sumbergiri, Kec. Ponjong, Kabupaten Gunungkidul'},'Bendo Gede 2')`);
  t('Query: nama tempat tidak diulang dua kali', q1 === 'Bendo Gede 2, Sumbergiri, Kec. Ponjong, Kabupaten Gunungkidul', q1);
  const q2 = w.eval(`petaQuery({alamat:'Sumbergiri, Ponjong'},'Gedung Serbaguna')`);
  t('Query: venue + alamat berbeda digabung', q2 === 'Gedung Serbaguna, Sumbergiri, Ponjong', q2);

  /* ---- 2) Koordinat / q= dari tautan Maps pemilik menang ---- */
  const q3 = w.eval(`petaQuery({mapsLink:'https://www.google.com/maps/place/Bendo/@-8.012345,110.712345,17z/data=!3d-8.09999!4d110.79999',alamat:'Alamat bebas'},'Venue')`);
  t('Query: koordinat !3d/!4d dari tautan dipakai', q3 === '-8.09999,110.79999', q3);
  const q4 = w.eval(`petaQuery({mapsLink:'https://www.google.com/maps/@-8.012345,110.712345,17z',alamat:'Alamat bebas'},'Venue')`);
  t('Query: koordinat @lat,lng dari tautan dipakai', q4 === '-8.012345,110.712345', q4);
  const q5 = w.eval(`petaQuery({mapsLink:'https://www.google.com/maps/search/?api=1&query=Masjid+Bendo+Gede',alamat:'Alamat bebas'},'Venue')`);
  t('Query: query= dari tautan dipakai', q5 === 'Masjid Bendo Gede', q5);
  const q6 = w.eval(`petaQuery({mapsLink:'https://maps.app.goo.gl/abc123XYZ',alamat:'Sumbergiri, Ponjong'},'Bendo Gede 2')`);
  t('Query: tautan pendek tanpa koordinat jatuh ke venue+alamat', q6 === 'Bendo Gede 2, Sumbergiri, Ponjong', q6);

  /* ---- 3) Render: iframe lahir tanpa src, placeholder tampil ---- */
  w.eval('boot(' + JSON.stringify(draftPeta()) + ')');
  await sleep(80);
  const fr = D.querySelector('iframe[data-map-src]');
  t('Render: iframe peta ada', !!fr);
  t('Render: iframe lahir TANPA src (tidak render di slide tersembunyi)', !!fr && !fr.getAttribute('src'), fr && fr.getAttribute('src'));
  t('Render: placeholder "Memuat peta" tampil di belakang iframe', !!D.querySelector('.mapwrap .mapph'));
  const embed = fr ? fr.getAttribute('data-map-src') : '';
  t('Render: embed memakai host kanonik www.google.com/maps', embed.startsWith('https://www.google.com/maps?q='), embed);
  t('Render: embed tanpa query ganda', !decodeURIComponent(embed).includes('Bendo Gede 2, Bendo Gede 2'), decodeURIComponent(embed));
  t('Render: embed diakhiri output=embed', embed.includes('&output=embed'), embed);
  t('Render: tombol Buka di Peta tetap ada', !![...D.querySelectorAll('a.mapbtn')].find(a => a.href.includes('google.com/maps')));
  t('Render: tombol Muat Ulang Peta ada', !!D.querySelector('.mapreload'));

  /* ---- 4) Terlihat -> src terpasang; belum terlihat -> belum ---- */
  const io = observers[observers.length - 1];
  t('Lazy: observer memantau iframe peta', !!io && io.els.has(fr));
  io.picu(fr);
  t('Lazy: src terpasang saat kartu terlihat', fr.getAttribute('src') === embed, fr.getAttribute('src'));
  t('Lazy: iframe berhenti dipantau setelah dimuat', !io.els.has(fr));

  /* ---- 5) Mode slide: membuka slide memuat petanya ---- */
  w.eval('boot(' + JSON.stringify(draftPeta()) + ')');
  await sleep(80);
  const fr2 = D.querySelector('iframe[data-map-src]');
  t('Slide: setelah render ulang, peta kembali belum dimuat', !!fr2 && !fr2.getAttribute('src'));
  w.eval('__aspMuatPeta(document)');
  t('Slide: __aspMuatPeta (dipanggil navpager saat slide dibuka) memasang src', !!fr2 && fr2.getAttribute('src') === fr2.getAttribute('data-map-src'), fr2 && fr2.getAttribute('src'));
  w.eval('__aspMuatPeta(document)');
  t('Slide: pemuatan kedua tidak mengutak-atik src lagi', fr2.getAttribute('src') === fr2.getAttribute('data-map-src'));

  /* ---- 6) Muat ulang: src dicabut lalu dipasang lagi dari nol ---- */
  const btn = D.querySelector('.mapreload');
  w.eval(`muatUlangPeta(document.querySelector('.mapreload'))`);
  t('Muat ulang: src langsung dicabut (ubin macet dibuang)', !fr2.getAttribute('src'), fr2.getAttribute('src'));
  await sleep(160);
  t('Muat ulang: src dipasang lagi otomatis', fr2.getAttribute('src') === fr2.getAttribute('data-map-src'), fr2.getAttribute('src'));
  t('Muat ulang: tombol aktif lagi setelahnya', !!btn && !btn.disabled);

  /* ---- 7) Alamat kosong: tidak ada iframe dunia-biru ---- */
  const htmlKosong = w.eval(`liveSlides({slides:{map:{on:true}}},'pernikahan',null,'A & B',{alamat:'',mapsLink:''},'')`);
  t('Kosong: tanpa alamat tidak ada iframe peta', !htmlKosong.includes('data-map-src') && !htmlKosong.includes('output=embed'), htmlKosong.slice(0, 120));
  t('Kosong: ada penjelasan lokasi belum diisi', htmlKosong.includes('belum diisi'));

  /* ---- 8) XSS: alamat ber-tag tidak bocor lewat URL/atribut ---- */
  w.eval('boot(' + JSON.stringify(draftPeta({ alamat: '"><img src=x onerror=alert(1)>, Ponjong' })) + ')');
  await sleep(80);
  t('XSS: alamat jahat tidak menciptakan elemen baru', D.querySelector('img[src="x"]') === null && D.querySelectorAll('img[onerror]').length === 0);
  const frX = D.querySelector('iframe[data-map-src]');
  t('XSS: URL embed tetap ter-encode', !!frX && !frX.getAttribute('data-map-src').includes('<img'), frX && frX.getAttribute('data-map-src'));

  dom.window.close();
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
