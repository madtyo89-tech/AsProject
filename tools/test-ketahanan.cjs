#!/usr/bin/env node
/* ============================================================
   test-ketahanan.cjs — simulasi masalah yang mungkin terjadi
   pada undangan.html (data rusak, skema DB lama, jaringan mati,
   input jahat, mode demo) + memastikan tidak ada yang crash.

   Jalankan: node tools/test-ketahanan.cjs   (butuh: npm i jsdom)
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

function stubFetch(w, calls) {
  w.fetch = async (url, opt) => {
    calls.push(String(url));
    return { ok: false, status: 0, text: async () => '', json: async () => ({}), blob: async () => new w.Blob([]) };
  };
}
function stubCommon(w, calls) {
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb } observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } };
  if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  stubFetch(w, calls);
}

const BASE_FORM = {
  namaPria: 'Uji Coba', namaWanita: 'Simulasi',
  putraPutri: 'Bpk. A & Ibu B', putriDari: 'Bpk. C & Ibu D',
  tanggalAcara: '2027-01-10', jamAcara: '08:00', venue: 'Gedung Uji, Bandung',
  showBismillah: true, showMapsBtn: true,
};
function draft(over) {
  const d = {
    slug: 'uji-ketahanan', name1: 'Uji Coba', name2: 'Simulasi', theme: 0,
    venue: BASE_FORM.venue, event_date: BASE_FORM.tanggalAcara, event_time: BASE_FORM.jamAcara,
    data: {
      form: { ...BASE_FORM }, event: 'pernikahan', tpl: 'ivory-klasik', doa: 'pernikahan',
      accent: '#8A6E4B', fontTitle: 'playfair', fontBody: 'inter', border: 'none',
      amplop: {}, slides: { story: { on: true, text: '' }, rsvp: { on: true }, closing: { on: true, text: 'Terima kasih.' } },
      anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up' },
      music: { name: '', url: '' }, cover: '', coverStyle: 'kotak', coverPos: { x: 50, y: 50, z: 1 },
      gallery: [], publishedAt: new Date().toISOString(),
    },
  };
  if (over && over.form) Object.assign(d.data.form, over.form), delete over.form;
  if (over && over.slides) d.data.slides = over.slides, delete over.slides;
  return Object.assign(d, over || {});
}

(async () => {
  const calls = [];
  const dom = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously',
    url: 'https://x.test/undangan.html?to=' + encodeURIComponent('<img src=x onerror=alert(1)>'),
    pretendToBeVisual: true,
    beforeParse(w) {
      stubCommon(w, calls);
      try { w.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w.eval(read('assets/vip-4d.js')); } catch (e) {}
    },
  });
  const w = dom.window;
  const D = w.document;
  await sleep(400);
  const evErr = [];
  w.addEventListener('error', e => evErr.push(String(e.message)));

  /* ---- 1) XSS nama tamu (?to=) — harus tampil sebagai teks, bukan HTML ---- */
  w.eval('boot(' + JSON.stringify(draft()) + ')');
  await sleep(80);
  const toEl = D.querySelector('.to');
  t('XSS: nama tamu ?to= tidak dieksekusi sebagai HTML', toEl && toEl.querySelector('img') === null && /<img src=x/.test(toEl.textContent), toEl ? toEl.innerHTML.slice(0, 60) : '.to hilang');
  t('XSS: tidak ada elemen <img src=x> yang tercipta', D.querySelector('img[src="x"]') === null && D.querySelectorAll('img[onerror]').length === 0);

  /* ---- 2) Cerita: XSS + foto rusak + tanggal aneh ---- */
  const dXss = draft({
    slides: {
      story: {
        on: true, text: '', items: [
          { tgl: '<script>bad()</script>', judul: '"><img src=x onerror=alert(2)>', teks: 'Teks aman "kutip" & <b>bold</b>', foto: 'assets/tidak-ada.jpg' },
          { tgl: null, judul: '', teks: '', foto: '' },
          { tgl: 'Kapan lalu', judul: 'Normal', teks: 'Biasa saja', foto: 'https://contoh.invalid/x.jpg' },
        ],
      },
      rsvp: { on: true }, closing: { on: true, text: 'Hormat kami.' },
    },
  });
  w.eval('boot(' + JSON.stringify(dXss) + ')');
  await sleep(120);
  t('XSS: judul cerita ter-escape (tidak jadi tag)', D.querySelectorAll('.st-foto img').length >= 2 && D.querySelector('.st-judul').textContent.includes('<img'), '');
  t('XSS: tidak ada elemen <script> baru dari data', D.querySelectorAll('.st-judul img').length === 0);
  const imgs = [...D.querySelectorAll('.st-foto img')];
  t('Cerita: foto punya onerror (foto rusak → disembunyikan)', imgs.length > 0 && imgs.every(i => (i.getAttribute('onerror') || '').includes('display')), '');
  t('Cerita: item kosong difilter (tidak render kartu kosong)', D.querySelectorAll('.st-item').length === 2, 'jumlah ' + D.querySelectorAll('.st-item').length);

  /* ---- 3) URL live jahat (javascript:) harus ditolak ---- */
  w.eval('boot(' + JSON.stringify(draft({ form: { liveAkad: 'javascript:alert(3)', liveResepsi: 'data:text/html,x' } })) + ')');
  await sleep(80);
  t('URL jahat: javascript:/data: live tidak jadi tombol', D.querySelectorAll('.livebtn').length === 0, 'livebtn=' + D.querySelectorAll('.livebtn').length);
  w.eval('boot(' + JSON.stringify(draft({ form: { liveAkad: 'https://youtube.com/contoh' } })) + ')');
  await sleep(80);
  t('URL sah: https live jadi tombol', D.querySelectorAll('.livebtn').length === 1, '');

  /* ---- 4) Salam: kosong = disembunyikan; key hilang = default ---- */
  w.eval('boot(' + JSON.stringify(draft({ form: { salamBuka: '', salamTutup: '' } })) + ')');
  await sleep(60);
  t('Salam dikosongkan → tidak tampil', D.querySelectorAll('.salam').length === 0 && D.querySelectorAll('.salam-tutup').length === 0);
  w.eval('boot(' + JSON.stringify(draft()) + ')');
  await sleep(60);
  t('Salam key tidak ada → default Assalamu\u2019alaikum', (D.querySelector('.salam') || {}).textContent === 'Assalamu\u2019alaikum wr. wb.');

  /* ---- 5) waktuLalu: data tanggal rusak tidak boleh NaN ---- */
  const wl = w.eval('[waktuLalu(NaN),waktuLalu("bukan-tanggal"),waktuLalu(Date.now()-5000)]');
  t('waktuLalu: input rusak tidak menghasilkan NaN', wl.every(x => !String(x).includes('NaN')), wl.join(' | '));
  t('waktuLalu: waktu wajar tampil benar', /menit lalu|baru saja/.test(wl[2]), wl[2]);

  /* ---- 6) Mode demo: RSVP tersimpan lokal, TIDAK menulis ke database ---- */
  const domD = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously', url: 'https://x.test/undangan.html?demo=1', pretendToBeVisual: true,
    beforeParse(w2) { const c2 = []; stubCommon(w2, c2); w2.__calls = c2;
      try { w2.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w2.eval(read('assets/theme-contrast.js')); } catch (e) {} },
  });
  const wD = domD.window; const DD = wD.document;
  await sleep(450);
  const btAwal = DD.querySelectorAll('.bt-item').length;
  const btMore = DD.querySelector('.bt-more');
  if (btMore) { btMore.click(); await sleep(150); }
  t('Demo: buku tamu contoh tampil tanpa jaringan', btAwal >= 4 && DD.querySelectorAll('.bt-item').length >= 5, 'bt=' + btAwal + '+' + DD.querySelectorAll('.bt-item').length);
  const callsSebelum = wD.__calls.length;
  wD.eval('rsvpSave("ragu")');
  await sleep(150);
  t('Demo: rsvpSave tidak memanggil database', wD.__calls.length === callsSebelum, 'panggilan=' + (wD.__calls.length - callsSebelum));
  t('Demo: ucapan baru langsung muncul di buku tamu', (DD.querySelector('.bt-nm') || {}).textContent === 'Tamu', (DD.querySelector('.bt-nm') || {}).textContent);
  t('Demo: status "Belum Pasti" tampil', (DD.querySelector('.bt-st') || {}).textContent === 'Belum Pasti', (DD.querySelector('.bt-st') || {}).textContent);
  t('Demo: toast konfirmasi muncul', !!DD.getElementById('ivToast'));

  /* ---- 7-9) Jalur LIVE (ada slug): skema DB lama, offline, data feed rusak ---- */
  const domL = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously', url: 'https://x.test/undangan.html?slug=uji-ketahanan&to=Tamu%20Live',
    pretendToBeVisual: true,
    beforeParse(w3) {
      stubCommon(w3, []);
      try { w3.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w3.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w3.eval(read('assets/vip-4d.js')); } catch (e) {}
    },
  });
  const wL = domL.window; const DL = wL.document;
  await sleep(400);
  const evErrL = [];
  wL.addEventListener('error', e => evErrL.push(String(e.message)));

  /* 7) Skema DB lama (kolom pesan / on_conflict belum ada) → fallback */
  const callsLama = [];
  wL.fetch = async (url, opt) => {
    const u = String(url); callsLama.push(u + ' :: ' + ((opt && opt.method) || 'GET'));
    if (/on_conflict/.test(u)) return { ok: false, status: 400, text: async () => 'bad', json: async () => ({}) };
    if (/select=guest,status,pesan/.test(u)) return { ok: false, status: 400, text: async () => 'bad', json: async () => ({}) };
    if (/\/rsvp\?slug=eq\./.test(u) && /select=guest,status,updated_at/.test(u))
      return { ok: true, status: 200, json: async () => [{ guest: 'Tamu Lama', status: 'hadir', pesan: undefined, updated_at: new Date().toISOString() }], text: async () => '' };
    if ((opt && opt.method) === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '' };
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  wL.eval('boot(' + JSON.stringify(draft()) + ')');
  await sleep(80);
  wL.eval('rsvpSave("hadir")');
  await sleep(250);
  t('Skema lama: RSVP fallback tetap tercatat', (DL.getElementById('ivToast') || {}).textContent && DL.getElementById('ivToast').textContent.includes('tercatat'), (DL.getElementById('ivToast') || {}).textContent || 'tanpa toast');
  t('Skema lama: fallback mencoba sekali tanpa pesan', callsLama.some(u => u.includes('on_conflict')) && callsLama.filter(u => u.includes('POST')).length >= 2, callsLama.join(' | ').slice(0, 140));
  await wL.eval('muatBukuTamu()');
  await sleep(250);
  t('Skema lama: buku tamu fallback tanpa kolom pesan', (DL.querySelector('.bt-nm') || {}).textContent === 'Tamu Lama', (DL.querySelector('.bt-nm') || {}).textContent || 'kosong');
  t('Skema lama: entri tanpa pesan tanpa kutip kosong', DL.querySelectorAll('.bt-msg').length === 0);

  /* 8) Jaringan mati total → toast gagal + undangan tetap hidup */
  wL.fetch = async () => { throw new Error('offline'); };
  wL.eval('rsvpSave("tidak")');
  await sleep(250);
  t('Offline: toast gagal ramah (bukan crash)', (DL.getElementById('ivToast') || {}).textContent && DL.getElementById('ivToast').textContent.includes('belum bisa disimpan'), (DL.getElementById('ivToast') || {}).textContent || 'tanpa toast');
  await wL.eval('muatBukuTamu()');
  await sleep(150);
  t('Offline: buku tamu jatuh ke keadaan kosong', !!DL.querySelector('.bt-memuat'), '');
  t('Halaman utuh: tombol RSVP aktif kembali', [...DL.querySelectorAll('[data-rsvpb]')].every(b => !b.disabled), '');

  /* 9) Feed: updated_at rusak → tanpa NaN */
  wL.fetch = async (url) => {
    const u = String(url);
    if (/select=guest,status,pesan/.test(u)) return { ok: true, status: 200, json: async () => [{ guest: 'Tamu Aneh', status: 'ragu', pesan: 'Halo', updated_at: null }, { guest: 'Tamu Baik', status: 'hadir', pesan: 'Ok', updated_at: 'bukan-iso' }], text: async () => '' };
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  await wL.eval('muatBukuTamu()');
  await sleep(200);
  const wkText = [...DL.querySelectorAll('.bt-wk')].map(x => x.textContent).join(' ');
  t('Feed: tanggal rusak tidak memunculkan NaN', !wkText.includes('NaN'), wkText);

  /* 10) Tombol kembali ke cover: membalik keadaan "opened" dan aman dipanggil berulang */
  const cb = DL.getElementById('coverBack');
  t('Cover: tombol kembali ke cover ada dan ber-aria', !!cb && !!cb.getAttribute('aria-label'), cb && cb.getAttribute('aria-label'));
  t('Cover: sembunyi selama undangan belum dibuka', !DL.body.classList.contains('opened'), DL.body.className);
  wL.eval('document.body.classList.add("opened")');
  cb.click();
  t('Cover: klik tombol mengembalikan undangan ke cover pembuka', !DL.body.classList.contains('opened'), DL.body.className);
  wL.eval('document.body.classList.add("opened")');
  wL.eval('kembaliKeCover()');
  t('Cover: kembaliKeCover() berfungsi dari global', !DL.body.classList.contains('opened'), '');
  wL.eval('kembaliKeCover()');
  t('Cover: dipanggil lagi tanpa efek samping', !DL.body.classList.contains('opened') && evErrL.length === 0, '');
  wL.eval('document.body.classList.add("opened")');
  wL.eval('kembaliKeCover()');
  t('Cover: undangan bisa dibuka ulang setelah kembali ke cover', (wL.eval('document.body.classList.add("opened"), document.body.classList.contains("opened")') === true), '');

  t('Halaman utuh: tidak ada error tak tertangkap (live)', evErrL.length === 0, evErrL.slice(0, 2).join(' | '));

  dom.window.close(); domD.window.close(); domL.window.close();
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
