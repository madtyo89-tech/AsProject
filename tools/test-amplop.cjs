#!/usr/bin/env node
/* ============================================================
   test-amplop.cjs — bagian Amplop Digital tidak boleh hilang dari undangan.

   Laporan pemilik (2026-10-17): "bagian amplop nya ga muncul di undangan".
   Penyebab yang ditemukan: Undangan Master menyimpan amplop dengan bentuk lama
   {on, name, acc, holder}, sedangkan undangan.html hanya mengenal bentuk Studio
   {showAmplop, bank, noRek, pemilik, ewallet, noEwallet}. Begitu pemilik menekan
   "Simpan Perubahan Bank" di Master, objek amplop diganti seluruhnya → syarat
   `showAmplop && (noRek || noEwallet)` tidak pernah benar dan kartu Amplop
   Digital lenyap dari undangan tamu.

   Tes ini mengunci:
     - Master membaca isian amplop dari Studio (tidak tampak kosong);
     - menyimpan dari Master mempertahankan e-wallet/showCopy & menulis bentuk
       yang dibaca undangan;
     - undangan menampilkan amplop dari bentuk Studio maupun bentuk lama
       (undangan yang sudah terbit pulih tanpa publish ulang);
     - sakelar "Tampilkan" tetap dihormati; data tanpa penanda dianggap tampil;
     - tombol Salin mengikuti showCopy dan isi rekening di-escape (XSS);
     - Studio menormalkan snapshot lama + memperingatkan saat amplop diisi
       tetapi belum ditampilkan.

   Jalankan: node tools/test-amplop.cjs   (butuh: npm i jsdom)
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

const SLUG_UJI = 'satrio-pandu-mahardika', KEY_UJI = 'kunci-uji-123';

function draftUji(amplop) {
  return {
    slug: SLUG_UJI, name1: 'Satrio', name2: 'Pandu Mahardika', theme: 0,
    venue: 'Bendo Gede 2', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan', tpl: 'ivory-klasik', doa: 'pernikahan',
      accent: '#8A6E4B', fontTitle: 'playfair', fontBody: 'inter', border: 'none',
      linkMode: 'personal', masterKey: KEY_UJI,
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu Mahardika',
        tanggalAcara: '2026-11-02', jamAcara: '08:00', zona: 'WIB',
        venue: 'Bendo Gede 2', alamat: 'Sumbergiri, Ponjong, Gunungkidul'
      },
      amplop,
      slides: { map: { on: true }, rsvp: { on: true } },
      guestsRaw: 'Pak Andi Wijaya & Keluarga\nBu Rina Marlina',
      guestCodes: { 'Pak Andi Wijaya & Keluarga': 'AAA11111', 'Bu Rina Marlina': 'BBB22222' },
      waTemplate: '', gallery: []
    }
  };
}

function buatMaster(amplop, opsi) {
  const o = opsi || {};
  const catat = { patch: [] };
  const row = o.row || draftUji(amplop);
  const dom = new JSDOM(read('master.html'), {
    runScripts: 'dangerously',
    url: 'https://asproject.my.id/master.html?slug=' + SLUG_UJI + '&k=' + encodeURIComponent(KEY_UJI),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = function (u, o2) {
        const met = String((o2 && o2.method) || 'GET').toUpperCase();
        if (met !== 'GET') {
          catat.patch.push({ url: String(u), body: o2 && o2.body ? JSON.parse(String(o2.body)) : null });
          return Promise.resolve({ ok: true, status: 200, json: async () => ([row]) });
        }
        if (String(u).includes('invitation_drafts')) return Promise.resolve({ ok: true, json: async () => ([row]) });
        if (String(u).includes('rest/v1/')) return Promise.resolve({ ok: true, json: async () => ([]) });
        return Promise.reject(new Error('offline-uji'));
      };
      try { w.eval(read('assets/button-help.js')); } catch (e) {}
    }
  });
  return { dom, w: dom.window, D: dom.window.document, catat };
}

function buatUndangan() {
  const dom = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously',
    url: 'https://asproject.my.id/undangan.html?preview=1',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.HTMLCanvasElement.prototype.getContext = function () { return null; };
    }
  });
  return { dom, w: dom.window, D: dom.window.document };
}

const AMP_STUDIO = { bank: 'BCA', noRek: '1234567890', pemilik: 'Satrio', ewallet: 'DANA', noEwallet: '081234567890', showAmplop: true, showCopy: true };
const AMP_MASTER_LAMA = { on: true, name: 'BCA', bank: 'BCA', acc: '1234567890', holder: 'Satrio' };
const AMP_MASTER_MATI = { on: false, name: 'BCA', bank: 'BCA', acc: '1234567890', holder: 'Satrio' };

(async () => {
  /* ================= 1) Master membaca isian dari Studio ================= */
  {
    const A = buatMaster(AMP_STUDIO);
    await sleep(700);
    const w = A.w, D = A.D;
    t('Master: membaca amplop bentuk Studio (tidak tampak kosong)', w.eval('bankOn') === true && w.eval('bankName') === 'BCA' && w.eval('bankAcc') === '1234567890' && w.eval('bankHolder') === 'Satrio',
      [w.eval('bankOn'), w.eval('bankName'), w.eval('bankAcc'), w.eval('bankHolder')].join(' | '));
    t('Master: kolom Edit Info Bank terisi dari data Studio', D.getElementById('bankName').value === 'BCA' && D.getElementById('bankAcc').value === '1234567890' && D.getElementById('bankHolder').value === 'Satrio',
      [D.getElementById('bankName').value, D.getElementById('bankAcc').value, D.getElementById('bankHolder').value].join(' | '));

    /* Menyimpan dari Master TIDAK boleh menghapus e-wallet / showCopy Studio */
    D.getElementById('bankName').value = 'BNI';
    D.getElementById('bankAcc').value = '999000111';
    D.getElementById('bankHolder').value = 'Pandu';
    w.eval('saveBank()');
    await sleep(150);
    const p = A.catat.patch[A.catat.patch.length - 1];
    const amp = p && p.body && p.body.data && p.body.data.amplop;
    t('Master: simpan mengirim PATCH kolom data saja', !!p && p.url.includes('slug=eq.' + SLUG_UJI));
    t('Master: menulis bentuk yang dibaca undangan (showAmplop/noRek/pemilik)',
      !!amp && amp.showAmplop === true && amp.on === true && amp.bank === 'BNI' && amp.noRek === '999000111' && amp.pemilik === 'Pandu',
      JSON.stringify(amp));
    t('Master: e-wallet & showCopy dari Studio tidak ikut hilang',
      !!amp && amp.ewallet === 'DANA' && amp.noEwallet === '081234567890' && amp.showCopy === true, JSON.stringify(amp));
    t('Master: kunci bentuk lama tetap ditulis (name/acc/holder)',
      !!amp && amp.name === 'BNI' && amp.acc === '999000111' && amp.holder === 'Pandu', JSON.stringify(amp));
    A.dom.window.close();
  }

  /* ================= 2) Master membaca snapshot bentuk lama ================= */
  {
    const B = buatMaster(AMP_MASTER_LAMA);
    await sleep(700);
    t('Master: snapshot bentuk lama tetap terbaca', B.w.eval('bankOn') === true && B.w.eval('bankName') === 'BCA' && B.w.eval('bankAcc') === '1234567890' && B.w.eval('bankHolder') === 'Satrio',
      [B.w.eval('bankOn'), B.w.eval('bankName'), B.w.eval('bankAcc'), B.w.eval('bankHolder')].join(' | '));
    B.dom.window.close();
  }

  /* ================= 3) Undangan: kedua bentuk tampil ================= */
  {
    const U = buatUndangan();
    await sleep(700);
    const w = U.w, D = U.D;
    const render = amp => {
      w.eval('boot(' + JSON.stringify({ slug: 'uji', data: draftUji(amp).data }) + ')');
      return D.querySelector('.amp-card');
    };
    const kartuStudio = render(AMP_STUDIO);
    t('Undangan: amplop bentuk Studio tampil', !!kartuStudio && /1234567890/.test(kartuStudio.textContent) && /BCA/.test(kartuStudio.textContent));
    const kartuLama = render(AMP_MASTER_LAMA);
    t('Undangan: amplop yang tersimpan dari Master lama TETAP tampil (regresi laporan)', !!kartuLama && /1234567890/.test(kartuLama.textContent) && /BCA/.test(kartuLama.textContent),
      kartuLama ? kartuLama.textContent.slice(0, 120) : 'kartu .amp-card tidak ada');
    t('Undangan: sakelar "Tampilkan" tetap dihormati', !render(AMP_MASTER_MATI));
    t('Undangan: data tanpa penanda tampil/sembunyi dianggap tampil', !!render({ bank: 'BCA', noRek: '1234567890', pemilik: 'Satrio' }));
    t('Undangan: e-wallet saja tetap tampil', !!render({ ewallet: 'DANA', noEwallet: '081234567890' }));
    t('Undangan: amplop kosong tidak membuat kartu kosong', !render({}));

    const kartuCopy = render(AMP_STUDIO);
    t('Undangan: tombol Salin ada saat showCopy aktif', !!kartuCopy && !!kartuCopy.querySelector('[data-copy="1234567890"]'));
    const kartuTanpaCopy = render(Object.assign({}, AMP_STUDIO, { showCopy: false }));
    t('Undangan: showCopy=false menyembunyikan tombol Salin', !!kartuTanpaCopy && !kartuTanpaCopy.querySelector('.copy'));

    const kartuXss = render({ bank: 'BCA <img src=x onerror=alert(1)>', noRek: '123"><img src=x>', pemilik: '<script>alert(1)</script>', showAmplop: true });
    t('Undangan: isi rekening & nama bank di-escape (tidak melahirkan elemen)', !!kartuXss && !D.querySelector('.amp-card img') && !D.querySelector('.amp-card script')
      && /<img src=x onerror=alert\(1\)>/.test(kartuXss.textContent), kartuXss ? kartuXss.innerHTML.slice(0, 200) : 'tidak ada kartu');
    U.dom.window.close();
  }

  /* ================= 4) Studio: normalisasi snapshot lama ================= */
  {
    const dom = new JSDOM(read('studio.html'), {
      runScripts: 'dangerously',
      url: 'https://asproject.my.id/studio.html',
      pretendToBeVisual: true,
      beforeParse(w) {
        w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
        if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
        w.fetch = () => Promise.reject(new Error('offline-uji'));
        w.localStorage.setItem('asproject_studio_v3', JSON.stringify({
          started: true, tab: 'amplop',
          form: { namaPria: 'Satrio', namaWanita: 'Pandu', tanggalAcara: '2026-11-02', jamAcara: '08:00', venue: 'Bendo' },
          amplop: { on: true, name: 'Maya Collection', acc: '1234567890', holder: 'Satrio' }
        }));
        try { w.eval(read('assets/button-help.js')); } catch (e) {}
      }
    });
    await sleep(600);
    const w = dom.window, D = w.document;
    t('Studio: snapshot amplop bentuk lama dinormalkan saat dibuka',
      w.eval('state.amplop.showAmplop') === true && w.eval('state.amplop.noRek') === '1234567890' && w.eval('state.amplop.pemilik') === 'Satrio',
      JSON.stringify(w.eval('state.amplop')));
    t('Studio: nama bank bebas dari Master tetap jadi pilihan (tidak berubah jadi BCA)',
      !!D.querySelector('select') && [...D.querySelector('select').options].some(o => o.textContent === 'Maya Collection'));

    /* Data diisi tetapi Tampilkan belum dicentang → peringatan + tombol cepat */
    w.eval("state.amplop.showAmplop=false;save();render()");
    await sleep(120);
    t('Studio: memperingatkan saat amplop diisi tapi belum ditampilkan', /Amplop sudah diisi, tapi belum ditampilkan/.test(D.body.textContent));
    const tombol = [...D.querySelectorAll('button')].find(b => /Tampilkan sekarang/.test(b.textContent));
    t('Studio: tombol "Tampilkan sekarang" tersedia', !!tombol);
    if (tombol) {
      tombol.click();
      await sleep(120);
      t('Studio: tombol langsung menyalakan bagian amplop', w.eval('state.amplop.showAmplop') === true);
    }
    dom.window.close();
  }

  /* ================= 5) Kontrak statis ================= */
  {
    const und = read('undangan.html'), mas = read('master.html'), stu = read('studio.html');
    t('Kontrak: undangan memakai amplopNormal() untuk membaca snapshot', /const a=amplopNormal\(d&&d\.amplop\)/.test(und));
    t('Kontrak: Master menyimpan dengan Object.assign (bidang lain dipertahankan)', /d\.amplop=Object\.assign\(\{\},lama,\{/.test(mas));
    t('Kontrak: Master membaca lewat amplopNormal()', /const amp=amplopNormal\(d\.amplop\)/.test(mas));
    t('Kontrak: Studio menormalkan state amplop saat load', /state\.amplop=Object\.assign\(\{\},DEF\.amplop,amplopNormal\(state\.amplop\)\)/.test(stu));
    t('Kontrak: publish & pratinjau Studio tetap membawa amplop', /amplop:JSON\.parse\(JSON\.stringify\(state\.amplop\)\)/.test(stu));
    t('Kontrak: peringatan publish saat amplop diisi tapi disembunyikan', /Amplop digital belum ditampilkan/.test(stu));
  }

  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
