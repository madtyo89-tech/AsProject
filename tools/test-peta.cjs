#!/usr/bin/env node
/* ============================================================
   test-peta.cjs — peta lokasi (slide "map") di undangan.html.

   Latar bug (lama): embed Google Maps cuma tampil bidang biru kosong —
   penyebabnya berlapis:
     1) Di mode navigasi slide, slide yang belum aktif ber-display:none.
        Google Maps yang dirender di viewport 0x0 tidak menggambar ubinnya.
     2) Query embed mengulang nama tempat yang sudah ada di alamat
        ("Bendo Gede 2, Bendo Gede 2, Sumbergiri, ...").
     3) Host lama maps.google.com menambah redirect yang macet.

   Latar bug (baru, dari laporan tamu): setelah (1)-(3) dibereskan, sebagian
   ponsel tetap melihat bidang biru dengan kotak galat milik Google sendiri.
   Isi iframe lintas-asal tidak bisa diperiksa atau dipulihkan dari halaman
   kita, jadi tampilan peta yang WAJIB muncul tidak lagi bergantung pada
   embed: digambar dari ubin biasa (3x3, OpenStreetMap/CARTO/Esri) yang bisa
   dicoba ulang ke CDN lain, dan iframe Google turun pangkat jadi lapisan
   opsional lewat tombol "Peta interaktif".

   Tes ini mengunci kontrak itu:
     - query bersih: tanpa duplikasi, koordinat dari tautan pemilik menang;
     - iframe Google lahir TANPA src dan tidak pernah dipasang sendiri;
     - ubin statis 3x3 menutupi seluruh kartu (skala penutup, tanpa celah);
     - satu CDN ubin mati -> ubin yang sama dicoba ke CDN berikutnya;
     - koordinat dari tautan dipakai tanpa jaringan; kalau tidak ada ->
       geokode Nominatim/Photon + cache localStorage (sekali saja per lokasi);
     - geokode gagal -> mode peta-gagal dengan tautan Google Maps, bukan biru;
     - alamat kosong tidak melahirkan kartu peta kosong;
     - XSS: alamat ber-tag tidak bocor lewat atribut/URL.

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
}

const ALAMAT_PANJANG = 'Bendo Gede 2, Sumbergiri, Kec. Ponjong, Kabupaten Gunungkidul, Daerah Istimewa Yogyakarta';

function draftPeta(formOver, rootOver) {
  return {
    slug: 'uji-peta', name1: 'Satrio', name2: 'Pandu', theme: 0,
    venue: 'Bendo Gede 2', event_date: '2026-11-02', event_time: '08:00',
    data: {
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu',
        putraPutri: 'Bpk. A & Ibu B', putriDari: 'Bpk. C & Ibu D',
        tanggalAcara: '2026-11-02', jamAcara: '08:00',
        venue: 'Bendo Gede 2',
        alamat: ALAMAT_PANJANG,
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
    ...(rootOver || {}),
  };
}

const NOMINATIM = [{ lat: '-8.012345', lon: '110.712345', display_name: 'Bendo Gede 2, Gunungkidul' }];

(async () => {
  const observers = [];
  const fetches = [];
  const dom = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?slug=uji-peta',
    pretendToBeVisual: true,
    beforeParse(w) {
      stubIO(w, observers);
      /* Jaringan uji: bisa diganti per-tes lewat w.__fetch. Bawaannya offline. */
      w.fetch = function (u, o) {
        fetches.push(String(u));
        return w.__fetch ? w.__fetch(String(u), o) : Promise.reject(new Error('offline-uji'));
      };
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

  /* ---- 3) Angka koordinat: dibaca sebagai {lat,lng}, bukan string ---- */
  const l1 = w.eval(`JSON.stringify(petaLatLngDariLink('https://www.google.com/maps/@-8.012345,110.712345,17z'))`);
  t('Koordinat: @lat,lng jadi angka', l1 === JSON.stringify({ lat: -8.012345, lng: 110.712345 }), l1);
  const l2 = w.eval(`JSON.stringify(petaLatLngDariLink('https://maps.app.goo.gl/abc123XYZ'))`);
  t('Koordinat: tautan pendek tidak berpura-pura punya koordinat', l2 === 'null', l2);
  const l3 = w.eval(`JSON.stringify(petaLatLngDariTeks('-8.0123, 110.7123'))`);
  t('Koordinat: teks "lat, lng" diterima', l3 === JSON.stringify({ lat: -8.0123, lng: 110.7123 }), l3);
  t('Koordinat: teks ngawur ditolak', w.eval(`petaLatLngDariTeks('Sumbergiri, Ponjong')`) === null);
  t('Koordinat: lintang di luar jangkauan ditolak', w.eval(`petaLatLngDariTeks('99,110')`) === null);

  /* ---- 4) Tautan rute: ke koordinat kalau ada, ke query kalau tidak ---- */
  const r1 = w.eval(`petaRuteUrl('Bendo Gede 2, Sumbergiri',{lat:-8.0123,lng:110.7123})`);
  t('Rute: koordinat dipakai di destination', r1 === 'https://www.google.com/maps/dir/?api=1&destination=-8.0123%2C110.7123', r1);
  const r2 = w.eval(`petaRuteUrl('Bendo Gede 2',null)`);
  t('Rute: tanpa koordinat query jadi destination', r2 === 'https://www.google.com/maps/dir/?api=1&destination=Bendo%20Gede%202', r2);
  t('Rute: tanpa lokasi tidak ada tautan', w.eval(`petaRuteUrl('',null)`) === '');

  /* ---- 5) Hitungan ubin: pecahan Web Mercator & atribusi penyedia ---- */
  const f1 = w.eval(`JSON.stringify(petaFrac(0,0,17))`);
  t('Ubin: titik (0,0) di z17 = tengah kanvas', f1 === JSON.stringify({ x: 65536, y: 65536 }), f1);
  const f2 = w.eval(`JSON.stringify(petaFrac(-8.012345,110.712345,17))`);
  {
    const n = Math.pow(2, 17), s = Math.sin(-8.012345 * Math.PI / 180);
    const harap = JSON.stringify({ x: (110.712345 + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n });
    t('Ubin: pecahan Yogyakarta cocok rumus mercator', f2 === harap, f2 + ' vs ' + harap);
  }
  t('Atribusi: CARTO menyebut OpenStreetMap', w.eval(`petaAtribusi(['carto'])`) === '© OpenStreetMap · CARTO');
  t('Atribusi: Esri saja tidak mengklaim OpenStreetMap', w.eval(`petaAtribusi(['esri'])`) === '© Esri');
  t('Atribusi: campuran OSM + Esri', w.eval(`petaAtribusi(['osm','esri'])`) === '© OpenStreetMap · Esri');

  /* ---- 6) Render: kartu peta punya pratinjau ubin, iframe belum dipasang ----
     Tautan panjang pemilik sudah membawa koordinat: ubin digambar tanpa
     menyentuh jaringan sama sekali. */
  fetches.length = 0;
  w.eval('boot(' + JSON.stringify(draftPeta({ mapsLink: 'https://www.google.com/maps/@-8.012345,110.712345,17z' })) + ')');
  await sleep(80);
  const card = D.querySelector('[data-mapcard]');
  const fr = D.querySelector('iframe[data-map-src]');
  const wrap = card && card.querySelector('.mapwrap');
  t('Render: kartu peta ada', !!card);
  t('Render: kanvas ubin + pin + atribusi ada', !!(wrap && wrap.querySelector('.mapstat .ubin') && wrap.querySelector('.pin2 svg') && wrap.querySelector('.mapattr')));
  t('Render: iframe Google ada tapi lahir TANPA src (tidak dipasang sendiri)', !!fr && !fr.getAttribute('src'), fr && fr.getAttribute('src'));
  t('Render: placeholder pratinjau tampil', !!(wrap && wrap.querySelector('.mapph .mptxt')));
  const embed = fr ? fr.getAttribute('data-map-src') : '';
  t('Render: embed memakai host kanonik www.google.com/maps', embed.startsWith('https://www.google.com/maps?q='), embed);
  t('Render: embed tanpa query ganda', !decodeURIComponent(embed).includes('Bendo Gede 2, Bendo Gede 2'), decodeURIComponent(embed));
  t('Render: embed diakhiri output=embed', embed.includes('&output=embed'), embed);
  const btnRute = card.querySelector('a.mapbtn');
  t('Render: tombol rute ke Google Maps ada', !!btnRute && btnRute.getAttribute('href').startsWith('https://www.google.com/maps/dir/?api=1&destination='), btnRute && btnRute.getAttribute('href'));
  t('Render: tombol "Peta interaktif" ada', !!D.querySelector('.maptoggle'));
  t('Render: tombol muat ulang disembunyikan sebelum mode interaktif', !!D.querySelector('.mapulang') && D.querySelector('.mapulang').style.display === 'none');

  /* ---- 7) Kartu terlihat -> ubin 3x3 digambar & menutupi seluruh kartu ---- */
  const io = observers[observers.length - 1];
  t('Lazy: observer memantau kartu peta', !!io && io.els.has(card));
  const geo = () => fetches.filter(u => u.includes('nominatim') || u.includes('photon')).length;
  t('Lazy: koordinat dari tautan tidak memakai jaringan geokode', geo() === 0, JSON.stringify(fetches));
  io.picu(card);
  await sleep(30);
  t('Lazy: tetap tanpa geokode setelah ubin digambar', geo() === 0, JSON.stringify(fetches));
  const ubin = wrap.querySelectorAll('.ubin img');
  t('Ubin: 9 ubin (3x3) dibuat', ubin.length === 9, String(ubin.length));
  t('Ubin: penyedia pertama = CARTO @2x', [...ubin].every(i => i.getAttribute('src').startsWith('https://basemaps.cartocdn.com/rastertiles/voyager/17/') && i.getAttribute('src').endsWith('@2x.png')));
  t('Ubin: iframe Google TETAP tanpa src setelah pratinjau siap', !fr.getAttribute('src'), fr.getAttribute('src'));
  t('Ubin: kartu belum mengaku siap sebelum ada ubin tergambar', !wrap.classList.contains('map-tampil'));
  ubin[0].dispatchEvent(new w.Event('load'));
  t('Ubin: ubin pertama tergambar -> placeholder dilepas', wrap.classList.contains('map-tampil') && !wrap.classList.contains('peta-gagal'));
  t('Ubin: atribusi penyedia ditulis di kartu', /OpenStreetMap/.test(wrap.querySelector('.mapattr').textContent) && /CARTO/.test(wrap.querySelector('.mapattr').textContent), wrap.querySelector('.mapattr').textContent);
  {
    const pos = [...ubin].map(i => i.style.left + '/' + i.style.top);
    t('Ubin: tersusun rapi 0/256/512', JSON.stringify([...new Set(pos)].sort()) === JSON.stringify(['0px/0px', '0px/256px', '0px/512px', '256px/0px', '256px/256px', '256px/512px', '512px/0px', '512px/256px', '512px/512px']), JSON.stringify([...new Set(pos)].sort()));
    const m = /translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([\d.]+)\)/.exec(wrap.querySelector('.ubin').style.transform || '');
    t('Ubin: skala penutup memakai transform', !!m, wrap.querySelector('.ubin').style.transform);
    if (m) {
      const X = +m[1], Y = +m[2], S = +m[3], W = 360, H = 210, L = 768;
      t('Ubin: tanpa celah di tepi (kanvas menutupi kartu)',
        X <= 0.01 && Y <= 0.01 && X + L * S >= W - 0.01 && Y + L * S >= H - 0.01,
        `X=${X} Y=${Y} S=${S} -> ${X + L * S} x ${Y + L * S} vs ${W}x${H}`);
    }
  }

  /* ---- 7b) Geometri: puluhan kombinasi titik & lebar kartu harus tertutup penuh ---- */
  {
    const titik = [[-8.012345, 110.712345], [-6.2, 106.816666], [0, 0], [-8.5, 115.2], [4.5, 96.2],
      [-10.17, 123.6], [1.5, 124.8], [-45, 170], [51.5, -0.12], [-8.9, 110.3], [-6.9, 107.6], [-2.9, 104.7]];
    const ukuran = [[320, 210], [360, 210], [390, 210], [430, 210], [470, 210], [600, 210], [980, 210], [768, 260]];
    const L = 768;
    let kasus = 0, gagal = [];
    titik.forEach(function (pt) {
      ukuran.forEach(function (uk) {
        const host = D.createElement('div');
        host.innerHTML = '<div class="mapwrap"><div class="mapstat"><div class="ubin"></div><div class="mapattr">x</div></div><div class="mapph"><div class="mptxt">t</div></div></div>';
        const wr = host.querySelector('.mapwrap');
        const W = uk[0], H = uk[1];
        wr.getBoundingClientRect = function () { return { width: W, height: H, left: 0, top: 0, right: W, bottom: H }; };
        D.body.appendChild(host);
        w.petaGambarUbin(wr, pt[0], pt[1]);
        const m = /translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([\d.]+)\)/.exec(wr.querySelector('.ubin').style.transform || '');
        kasus++;
        if (!m) { gagal.push(W + 'x' + H + ' @' + pt.join(',') + ': tanpa transform'); return; }
        const X = +m[1], Y = +m[2], S = +m[3];
        const fr2 = w.petaFrac(pt[0], pt[1], 17);
        const cx = (fr2.x - Math.floor(fr2.x) + 1) * 256, cy = (fr2.y - Math.floor(fr2.y) + 1) * 256;
        const tutup = X <= 0.01 && Y <= 0.01 && X + L * S >= W - 0.01 && Y + L * S >= H - 0.01;
        const tengah = Math.abs(X + cx * S - W / 2) < 0.05 && Math.abs(Y + cy * S - H / 2) < 0.05;
        if (!tutup || !tengah) gagal.push(W + 'x' + H + ' @' + pt.join(',') + ': ' + JSON.stringify({ X: X, Y: Y, S: S, tutup: tutup, tengah: tengah }));
        host.remove();
      });
    });
    t('Geometri: ' + kasus + ' kombinasi titik & ukuran kartu tertutup penuh dengan pin di tengah', gagal.length === 0, gagal.slice(0, 3).join(' | '));
  }

  /* ---- 7c) Kontrak statis: pratinjau wajib, embed Google opsional ---- */
  {
    const src = read('undangan.html');
    t('Kontrak: iframe Google disembunyikan kecuali mode interaktif', src.includes('.mapwrap:not(.live) iframe{display:none}'));
    t('Kontrak: mode gagal memunculkan tautan keluar (bukan bidang kosong)', src.includes('.mapwrap.peta-gagal .mapfallback{display:block}'));
    t('Kontrak: tiga penyedia ubin tanpa kunci API', src.includes('tile.openstreetmap.org') && src.includes('basemaps.cartocdn.com') && src.includes('server.arcgisonline.com'));
    t('Kontrak: atribusi OpenStreetMap ditautkan (syarat lisensi ubin)', src.includes('https://www.openstreetmap.org/copyright'));
  }

  /* ---- 8) Satu CDN ubin mati -> ubin yang sama pindah ke CDN berikutnya ---- */
  {
    const satu = wrap.querySelector('.ubin img');
    satu.dispatchEvent(new w.Event('error'));
    t('Cadangan: ubin gagal pindah ke OpenStreetMap', satu.getAttribute('src').startsWith('https://tile.openstreetmap.org/17/'), satu.getAttribute('src'));
    satu.dispatchEvent(new w.Event('error'));
    t('Cadangan: gagal lagi pindah ke Esri', satu.getAttribute('src').includes('server.arcgisonline.com'), satu.getAttribute('src'));
    satu.dispatchEvent(new w.Event('error'));
    t('Cadangan: gagal tiga kali ubin itu dibuang, kartu tetap tampil', !satu.parentNode && !wrap.classList.contains('peta-gagal'));
  }

  /* ---- 9) Tanpa koordinat di tautan -> geokode + cache localStorage ---- */
  w.__fetch = () => Promise.resolve({ ok: true, json: async () => NOMINATIM });
  fetches.length = 0;
  w.eval('boot(' + JSON.stringify(draftPeta({ mapsLink: 'https://maps.app.goo.gl/abc123XYZ' })) + ')');
  await sleep(80);
  const card2 = D.querySelector('[data-mapcard]');
  const wrap2 = card2.querySelector('.mapwrap');
  t('Geokode: kartu tanpa data-peta-lat (tautan pendek)', card2.getAttribute('data-peta-lat') === null && (card2.getAttribute('data-peta-q') || '').length > 0);
  w.eval('__aspMuatPeta(document)');
  await sleep(60);
  t('Geokode: Nominatim dihubungi sekali', fetches.filter(u => u.includes('nominatim.openstreetmap.org')).length === 1, JSON.stringify(fetches));
  t('Geokode: ubin digambar dari hasil geokode', wrap2.querySelectorAll('.ubin img').length === 9, String(wrap2.querySelectorAll('.ubin img').length));
  t('Geokode: hasil disimpan di localStorage', !!w.localStorage.getItem('asp-peta:' + ALAMAT_PANJANG.toLowerCase().slice(0, 140)));
  fetches.length = 0;
  w.eval('boot(' + JSON.stringify(draftPeta({ mapsLink: 'https://maps.app.goo.gl/abc123XYZ' })) + ')');
  await sleep(60);
  w.eval('__aspMuatPeta(document)');
  await sleep(40);
  t('Geokode: buka lagi tidak menghubungi server lagi (cache)', fetches.filter(u => u.includes('nominatim')).length === 0 && D.querySelectorAll('[data-mapcard] .ubin img').length === 9, JSON.stringify(fetches));

  /* ---- 10) Geokode gagal: mode peta-gagal dengan jalan keluar, bukan biru ---- */
  w.__fetch = () => Promise.reject(new Error('putus'));
  w.localStorage.clear();
  w.eval('boot(' + JSON.stringify(draftPeta({ mapsLink: 'https://maps.app.goo.gl/abc123XYZ' })) + ')');
  await sleep(80);
  w.eval('__aspMuatPeta(document)');
  await sleep(80);
  const card3 = D.querySelector('[data-mapcard]');
  const wrap3 = card3.querySelector('.mapwrap');
  t('Gagal: kartu masuk mode peta-gagal', wrap3.classList.contains('peta-gagal'));
  t('Gagal: pesan mengarahkan ke Google Maps', /Google Maps/.test(wrap3.querySelector('.mptxt').textContent), wrap3.querySelector('.mptxt').textContent);
  const fb3 = wrap3.querySelector('a.mapfallback');
  t('Gagal: area peta bisa ditekan (tautan Google Maps)', !!fb3 && /^https:\/\//.test(fb3.getAttribute('href')), fb3 && fb3.getAttribute('href'));
  t('Gagal: tidak ada iframe yang dipasang diam-diam', !D.querySelector('iframe[data-map-src]').getAttribute('src'));
  t('Gagal: tidak ada ubin setengah jadi yang diklaim siap', !wrap3.classList.contains('map-tampil') || wrap3.querySelector('.ubin img') === null);

  /* ---- 11) Tombol "Peta interaktif": iframe Google atas permintaan tamu ---- */
  w.__fetch = () => Promise.reject(new Error('putus'));
  w.eval('boot(' + JSON.stringify(draftPeta({ mapsLink: 'https://www.google.com/maps/@-8.012345,110.712345,17z' })) + ')');
  await sleep(60);
  const card4 = D.querySelector('[data-mapcard]');
  const fr4 = D.querySelector('iframe[data-map-src]');
  const tombol4 = D.querySelector('.maptoggle');
  w.eval(`petaToggle(document.querySelector('.maptoggle'))`);
  t('Interaktif: iframe dipasang setelah ditekan', fr4.getAttribute('src') === fr4.getAttribute('data-map-src'), fr4.getAttribute('src'));
  t('Interaktif: tombol berubah jadi jalan kembali', /Pratinjau/.test(tombol4.textContent), tombol4.textContent);
  t('Interaktif: tombol muat ulang muncul', D.querySelector('.mapulang').style.display !== 'none');
  w.eval(`petaToggle(document.querySelector('.maptoggle'))`);
  t('Interaktif: kembali ke pratinjau mencabut iframe (hemat kuota)', !fr4.getAttribute('src'));
  w.eval(`petaToggle(document.querySelector('.maptoggle'))`);
  const ulang = D.querySelector('.mapulang');
  w.eval(`muatUlangPeta(document.querySelector('.mapulang'))`);
  t('Muat ulang: src dicabut dulu (ubin macet dibuang)', !fr4.getAttribute('src'), fr4.getAttribute('src'));
  await sleep(160);
  t('Muat ulang: src dipasang lagi otomatis', fr4.getAttribute('src') === fr4.getAttribute('data-map-src'), fr4.getAttribute('src'));
  t('Muat ulang: tombol aktif lagi setelahnya', !!ulang && !ulang.disabled);
  t('Interaktif: kartu menandai mode live', card4.querySelector('.mapwrap').classList.contains('live'));

  /* ---- 11b) Tanpa tautan pemilik: jatuh ke tautan rute Google Maps ---- */
  w.eval('boot(' + JSON.stringify(draftPeta({ mapsLink: '' })) + ')');
  await sleep(60);
  w.eval('__aspMuatPeta(document)');
  await sleep(60);
  {
    const c5 = D.querySelector('[data-mapcard]');
    const r5 = c5.querySelector('a.mapbtn');
    t('Tanpa tautan pemilik: tombol rute tetap ke Google Maps', !!r5 && r5.getAttribute('href').startsWith('https://www.google.com/maps/dir/'), r5 && r5.getAttribute('href'));
    const f5 = c5.querySelector('a.mapfallback');
    t('Tanpa tautan pemilik: fallback tetap menuju Google Maps', !!f5 && f5.getAttribute('href').startsWith('https://www.google.com/maps/'), f5 && f5.getAttribute('href'));
  }

  /* ---- 12) Alamat kosong: tidak lahir kartu peta kosong ---- */
  const htmlKosong = w.eval(`liveSlides({slides:{map:{on:true}}},'pernikahan',null,'A & B',{alamat:'',mapsLink:''},'')`);
  t('Kosong: tanpa alamat tidak ada iframe peta', !htmlKosong.includes('data-map-src') && !htmlKosong.includes('output=embed'), htmlKosong.slice(0, 120));
  t('Kosong: ada penjelasan lokasi belum diisi', htmlKosong.includes('belum diisi'));
  t('Kosong: tidak ada kanvas ubin yang menipu', !htmlKosong.includes('class="mapwrap"'));

  /* ---- 13) XSS: alamat ber-tag tidak bocor lewat URL/atribut ---- */
  w.eval('boot(' + JSON.stringify(draftPeta({ alamat: '"><img src=x onerror=alert(1)>, Ponjong' })) + ')');
  await sleep(80);
  t('XSS: alamat jahat tidak menciptakan elemen baru', D.querySelector('img[src="x"]') === null && D.querySelectorAll('img[onerror]').length === 0);
  const frX = D.querySelector('iframe[data-map-src]');
  t('XSS: URL embed tetap ter-encode', !!frX && !frX.getAttribute('data-map-src').includes('<img'), frX && frX.getAttribute('data-map-src'));
  const cardX = D.querySelector('[data-mapcard]');
  t('XSS: data-peta-q tidak keluar dari tanda kutip', !!cardX && (cardX.getAttribute('data-peta-q') || '').indexOf('onerror') > 0);
  const htmlX = w.eval("liveSlides({slides:{map:{on:true},rsvp:{on:false},closing:{on:false}}},'pernikahan',null,'A & B',{alamat:'\"><img src=x onerror=alert(1)>, Ponjong',mapsLink:''},'Venue')");
  t('XSS: HTML mentah peta menulis tag sebagai entitas', htmlX.includes('&lt;img src=x') && !/<img src=x/.test(htmlX), htmlX.slice(0, 160));

  dom.window.close();
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
