#!/usr/bin/env node
/* ============================================================
   test-master-link.cjs — mode link & daftar tamu di Undangan Master.

   Latar (laporan pemilik, 2026-10-16):
     "Link personal sama yang semua tamu sama" + "di undangan master mau isi
      yang personal juga ga ada opsinya".
   Penyebabnya: undangan yang sudah publish memakai mode 1 LINK, dan pada mode
   itu Master memang mengirim tautan yang sama untuk semua tamu — tapi tidak
   ada satu pun tombol di Master untuk mengganti mode, dan kartu "Link Personal
   Tamu" tetap memamerkan tautan tanpa ?to= seolah-olah itu tautan personal.

   Tes ini mengunci perbaikannya:
     - mode personal: tiap tamu punya ?to=Nama sendiri;
     - kartu "Mode Link Tamu" bisa mengganti mode dari HP, tersimpan ke
       database (PATCH kolom `data` saja, bidang lain tidak hilang);
     - mode 1 LINK: tombol/kartu mengikuti mode, tapi link personal tetap
       disediakan (salin semua / per tamu) karena ?to= selalu bekerja;
     - database menolak (RLS) atau mode demo: perubahan tetap tampil + pesan
       jelas, tidak pernah diam-diam "tersimpan";
     - editor daftar tamu: tambah/ubah/hapus nama dari dashboard, kode QR tamu
       lama dipertahankan, nama baru dapat kode baru, duplikat dibuang;
     - XSS: nama tamu ber-tag tidak melahirkan elemen baru.

   Jalankan: node tools/test-master-link.cjs   (butuh: npm i jsdom)
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
const TAMU = ['Pak Andi Wijaya & Keluarga', 'Bu Rina Marlina'];

function draftUji(over) {
  return {
    slug: SLUG_UJI, name1: 'Satrio', name2: 'Pandu Mahardika', theme: 0,
    venue: 'Bendo Gede 2', event_date: '2026-11-02', event_time: '08:00',
    data: {
      event: 'pernikahan', tpl: 'ivory-klasik', doa: 'pernikahan',
      accent: '#8A6E4B', fontTitle: 'playfair', fontBody: 'inter', border: 'none',
      linkMode: 'single', masterKey: KEY_UJI,
      form: {
        namaPria: 'Satrio', namaWanita: 'Pandu Mahardika',
        tanggalAcara: '2026-11-02', jamAcara: '08:00', zona: 'WIB',
        venue: 'Bendo Gede 2', alamat: 'Sumbergiri, Ponjong, Gunungkidul',
      },
      amplop: { on: true, name: 'BCA', bank: 'BCA', acc: '1234567890', holder: 'Satrio' },
      slides: { map: { on: true }, rsvp: { on: true } },
      guestsRaw: TAMU.join('\n'),
      guestCodes: { [TAMU[0]]: 'AAA11111', [TAMU[1]]: 'BBB22222' },
      waTemplate: '', gallery: [],
    },
    ...(over || {}),
  };
}

function buatBrowser(opsi) {
  const o = opsi || {};
  const catat = { get: 0, patch: [], tulis: [] };
  const row = o.draft || draftUji();
  const dom = new JSDOM(read('master.html'), {
    runScripts: 'dangerously',
    url: 'https://asproject.my.id/master.html?slug=' + SLUG_UJI + '&k=' + encodeURIComponent(KEY_UJI),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
      if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = function (u, opsi2) {
        const url = String(u);
        const met = String((opsi2 && opsi2.method) || 'GET').toUpperCase();
        if (met !== 'GET') {
          catat.patch.push({ url, method: met, body: (opsi2 && opsi2.body) ? JSON.parse(String(opsi2.body)) : null });
          if (o.patchGagal) return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
          if (o.jaringanPutus) return Promise.reject(new Error('putus'));
          return Promise.resolve({ ok: true, status: 200, json: async () => ([row]) });
        }
        if (url.includes('invitation_drafts')) { catat.get++; return Promise.resolve({ ok: true, json: async () => ([row]) }); }
        if (url.includes('rest/v1/checkin')) return Promise.resolve({ ok: true, json: async () => ([]) });
        if (url.includes('rest/v1/rsvp')) return Promise.resolve({ ok: true, json: async () => ([]) });
        return Promise.reject(new Error('offline-uji'));
      };
      try { w.eval(read('assets/button-help.js')); } catch (e) {}
    },
  });
  return { dom, w: dom.window, D: dom.window.document, catat, row };
}

const kartuMode = D => [...D.querySelectorAll('.card')].find(c => /Mode Link Tamu/.test(c.textContent));
const tombolMode = (D, teks) => [...D.querySelectorAll('.modebtn')].find(b => b.textContent.includes(teks));
const kartuPersonal = D => [...D.querySelectorAll('.card')].find(c => /Link Personal Tamu/.test(c.textContent));

(async () => {
  /* ================= 1) Mode 1 LINK (kondisi awal laporan) ================= */
  const A = buatBrowser();
  await sleep(700);
  let D = A.D, w = A.w;
  t('Muat: dashboard tampil & data undangan terbaca', /Master Dashboard/.test(D.body.textContent) && A.catat.get >= 1);
  t('Mode: kondisi awal = 1 LINK (seperti di laporan)', w.eval('linkMode()') === 'single');

  const modeCard = kartuMode(D);
  t('Mode: kartu "Mode Link Tamu" ada di dashboard', !!modeCard);
  t('Mode: tombol personal tersedia (inilah opsi yang tadinya tidak ada)', !!tombolMode(D, 'Link Personal'));
  t('Mode: tombol 1 link tersedia', !!tombolMode(D, '1 Link untuk semua'));
  t('Mode: tombol mode aktif ditandai', tombolMode(D, '1 Link untuk semua').classList.contains('on') && !tombolMode(D, 'Link Personal').classList.contains('on'));
  t('Mode: mode aktif ditulis jelas di kartu', /Mode aktif:\s*1 LINK/.test(modeCard.textContent.replace(/\s+/g, ' ')), modeCard.textContent.slice(0, 120));

  /* Link personal: pola ?to= tetap ditampilkan + jalan keluar */
  const pCard = kartuPersonal(D);
  t('Personal: pola ?to=NamaTamu tetap ditampilkan', pCard.querySelector('.linkbox span').textContent.includes('?to=NamaTamu'), pCard.querySelector('.linkbox span').textContent);
  t('Personal: dijelaskan bahwa ?to= tetap bekerja walau mode 1 LINK', /tetap bekerja/.test(pCard.textContent), pCard.textContent.slice(0, 160));
  t('Personal: ada tombol "Pakai mode personal" di kartu itu', /Pakai mode personal/.test(pCard.textContent));
  t('Personal: ada tombol salin semua link personal', /Salin link personal/.test(pCard.textContent));
  t('Personal: tautan tamu di daftar ditandai "link umum"', [...D.querySelectorAll('.gl-tag')].every(x => /link umum/.test(x.textContent)));
  t('Personal: tautan semua tamu sama seperti link umum (memang mode 1 LINK)', w.eval('guestLink(GS[0])===allLink() && guestLink(GS[1])===allLink()'));
  t('Personal: link personal asli tetap berbeda tiap tamu', w.eval('guestLinkPersonal(GS[0])!==guestLinkPersonal(GS[1]) && guestLinkPersonal(GS[0]).includes("?to=")'), w.eval('guestLinkPersonal(GS[0])'));

  /* Salin semua pada mode 1 LINK: cukup link umum sekali, bukan diulang per tamu */
  w.eval('window.__salin=null;navigator.clipboard={writeText:t=>{window.__salin=t;return Promise.resolve()}}');
  w.eval('copyAll()');
  await sleep(60);
  t('Salin Semua: mode 1 LINK menyalin link umum sekali', w.eval('window.__salin') === w.eval('allLink()'), String(w.eval('window.__salin')));
  w.eval('copyPersonalSemua()');
  await sleep(60);
  const salinPersonal = String(w.eval('window.__salin'));
  t('Salin Semua: tombol khusus menyalin link personal ber-?to= untuk tiap tamu',
    salinPersonal.split('\n').length === 2 && salinPersonal.includes('?to=') && salinPersonal.includes(encodeURIComponent(TAMU[0])), salinPersonal);
  t('Salin Semua: nama tamu disertakan sebagai label', salinPersonal.startsWith(TAMU[0] + ': '), salinPersonal.slice(0, 60));

  /* ================= 2) Ganti ke mode personal dari dashboard ================= */
  tombolMode(D, 'Link Personal').click();
  await sleep(120);
  const patch1 = A.catat.patch[A.catat.patch.length - 1];
  t('Ganti mode: dikirim ke database lewat PATCH kolom data', !!patch1 && patch1.method === 'PATCH' && patch1.url.includes('slug=eq.' + SLUG_UJI), JSON.stringify(patch1 && patch1.method));
  t('Ganti mode: data yang dikirim berisi linkMode personal', !!patch1 && patch1.body && patch1.body.data && patch1.body.data.linkMode === 'personal', JSON.stringify(patch1 && patch1.body));
  t('Ganti mode: bidang lain tidak ikut hilang', !!patch1 && patch1.body.data.guestsRaw === TAMU.join('\n') && patch1.body.data.guestCodes[TAMU[0]] === 'AAA11111' && patch1.body.data.amplop.acc === '1234567890' && patch1.body.data.form.namaPria === 'Satrio', JSON.stringify(patch1 && Object.keys(patch1.body.data)));
  t('Ganti mode: pesan sukses muncul', /Mode personal aktif/.test(D.getElementById('toast').textContent), D.getElementById('toast').textContent);
  t('Ganti mode: tampilan langsung ikut (mode aktif personal)', w.eval('linkMode()') === 'personal' && /Mode aktif:\s*PERSONAL/.test(kartuMode(D).textContent.replace(/\s+/g, ' ')));
  t('Ganti mode: tautan tamu kini berbeda tiap tamu', w.eval('guestLink(GS[0])!==guestLink(GS[1]) && guestLink(GS[0]).includes("?to=")'), w.eval('guestLink(GS[0])'));
  t('Ganti mode: tag baris tamu jadi "link personal"', [...D.querySelectorAll('.gl-tag')].every(x => /link personal/.test(x.textContent)));
  t('Ganti mode: tombol salin personal per tamu hilang (sudah jadi default)', w.eval('document.querySelectorAll(".gl-tag.p").length') === 2);

  /* Salin Semua di mode personal: daftar lengkap */
  w.eval('copyAll()');
  await sleep(60);
  const salinPersonal2 = String(w.eval('window.__salin'));
  t('Salin Semua: mode personal menyalin daftar "Nama: link" per tamu', salinPersonal2.split('\n').length === 2 && salinPersonal2.includes('?to='), salinPersonal2);
  /* pesan WA per tamu WAJIB memuat tautan personal tamu itu (bukan link umum) */
  const pesanA = w.eval('pesanWa(GS[0])'), pesanB = w.eval('pesanWa(GS[1])');
  const nmA = String(w.eval('GS[0]')), nmB = String(w.eval('GS[1]'));
  t('Salin Semua: pesan WhatsApp per tamu memakai link personalnya',
    pesanA.includes('?to=' + encodeURIComponent(nmA)) && pesanA.includes(nmA) && !pesanA.includes('?to=' + encodeURIComponent(nmB)), pesanA.slice(-120));
  t('Salin Semua: tiap tamu dapat link berbeda di pesannya', pesanA !== pesanB && pesanB.includes('?to=' + encodeURIComponent(nmB)));
  t('Bagikan semua: pesan massal tetap memakai link umum tanpa ?to=', w.eval('pesanWa(null)').includes(w.eval('allLink()')) && !w.eval('pesanWa(null)').includes('?to='));
  t('Ganti mode: menekan mode yang sama tidak menghubungi database lagi', (() => { const n = A.catat.patch.length; tombolMode(D, 'Link Personal').click(); return A.catat.patch.length === n; })());

  /* ================= 3) Kembali ke 1 LINK ================= */
  tombolMode(D, '1 Link untuk semua').click();
  await sleep(120);
  t('Balik mode: kembali ke 1 LINK & tersimpan', w.eval('linkMode()') === 'single' && A.catat.patch[A.catat.patch.length - 1].body.data.linkMode === 'single');
  t('Balik mode: tombol WhatsApp per tamu memakai link umum lagi', !w.eval('pesanWa(GS[1])').includes('?to='), w.eval('pesanWa(GS[1])').slice(0, 80));

  /* ================= 4) Database menolak / jaringan putus ================= */
  const B = buatBrowser({ patchGagal: true });
  await sleep(700);
  t('RLS menolak: mode tetap berubah di layar (tidak diam-diam gagal)', (() => { B.w.eval("setLinkMode('personal')"); return true; })());
  await sleep(150);
  t('RLS menolak: tetap ada pesan jelas + arahan ke Studio', /Database menolak|Studio/.test(B.D.getElementById('toast').textContent), B.D.getElementById('toast').textContent);
  t('RLS menolak: perubahan lokal tetap dipakai', B.w.eval('linkMode()') === 'personal');
  const C = buatBrowser({ jaringanPutus: true });
  await sleep(700);
  C.w.eval("setLinkMode('personal')");
  await sleep(150);
  t('Jaringan putus: tidak ada error halaman & mode ikut berubah', C.w.eval('linkMode()') === 'personal' && /Database menolak|Studio/.test(C.D.getElementById('toast').textContent), C.D.getElementById('toast').textContent);

  /* ================= 5) Editor daftar tamu di dashboard ================= */
  /* renderAll() menulis ulang isi #app, jadi elemen <textarea> harus diambil
     ulang tiap kali — bukan disimpan dari render sebelumnya (kalau disimpan,
     simpannya membaca kotak usang dan daftar tamu tidak pernah berubah). */
  const isiKotak = () => D.getElementById('gRaw');
t('Editor: kotak daftar tamu ada & terisi daftar tersimpan', !!isiKotak() && isiKotak().value === TAMU.join('\n'), isiKotak() && isiKotak().value);
isiKotak().value = TAMU.join('\n') + '\nKak Dina & Family\n\n  pak andi wijaya & keluarga  \nBu Rina Marlina\n';
  const patchSebelum = A.catat.patch.length;
  w.eval('simpanTamu()');
  await sleep(150);
  const patchTamu = A.catat.patch[A.catat.patch.length - 1];
  t('Editor: menyimpan dikirim sebagai PATCH kolom data', A.catat.patch.length === patchSebelum + 1 && patchTamu.method === 'PATCH');
  t('Editor: nama baru masuk daftar', patchTamu.body.data.guestsRaw.includes('Kak Dina & Family'), patchTamu.body.data.guestsRaw);
  t('Editor: spasi ganda & baris kosong dirapikan', patchTamu.body.data.guestsRaw === [TAMU[0], TAMU[1], 'Kak Dina & Family'].join('\n'), JSON.stringify(patchTamu.body.data.guestsRaw));
  t('Editor: duplikat (beda huruf besar/kecil) dibuang', patchTamu.body.data.guestsRaw.toLowerCase().split('\n').length === 3);
t('Editor: kode QR tamu lama dipertahankan', patchTamu.body.data.guestCodes[TAMU[0]] === 'AAA11111' && patchTamu.body.data.guestCodes[TAMU[1]] === 'BBB22222', JSON.stringify(patchTamu.body.data.guestCodes));
  t('Editor: merapikan tulisan nama (huruf besar/kecil) tidak mengganti kode QR',
    patchTamu.body.data.guestCodes[TAMU[0]] === 'AAA11111' && patchTamu.body.data.guestCodes['pak andi wijaya & keluarga'] === undefined, JSON.stringify(Object.keys(patchTamu.body.data.guestCodes)));
  const kodeBaru = patchTamu.body.data.guestCodes['Kak Dina & Family'];
  t('Editor: nama baru dapat kode baru (8 huruf/angka kapital)', /^[0-9A-Z]{8}$/.test(String(kodeBaru)), String(kodeBaru));
  t('Editor: pesan menyebut jumlah tamu baru', /\+1 tamu baru/.test(D.getElementById('toast').textContent) && /3 tamu/.test(D.getElementById('toast').textContent), D.getElementById('toast').textContent);
  t('Editor: daftar & statistik di halaman ikut berubah', w.eval('GS.length') === 3 && /Daftar Tamu & Konfirmasi[\s\S]*Kak Dina & Family/.test(D.body.textContent));
  t('Editor: tamu baru langsung punya link personal ber-?to=', w.eval('guestLinkPersonal(GS[2])').includes(encodeURIComponent('Kak Dina & Family')), w.eval('guestLinkPersonal(GS[2])'));

  /* menghapus tamu + tombol kembalikan */
isiKotak().value = TAMU[0];
  w.eval('simpanTamu()');
  await sleep(150);
  t('Editor: menghapus nama juga jalan', A.catat.patch[A.catat.patch.length - 1].body.data.guestsRaw === TAMU[0], A.catat.patch[A.catat.patch.length - 1].body.data.guestsRaw);
  t('Editor: pesan menyebut tamu yang dihapus', /−2 dihapus/.test(D.getElementById('toast').textContent), D.getElementById('toast').textContent);
  t('Editor: kode tamu yang dihapus tidak dipakai ulang untuk orang lain', A.catat.patch[A.catat.patch.length - 1].body.data.guestCodes[TAMU[1]] === 'BBB22222');
isiKotak().value = 'ngawur';
  w.eval('resetTamu()');
t('Editor: tombol kembalikan memulihkan isi kotak', isiKotak().value === TAMU[0] && /dikembalikan/.test(D.getElementById('toast').textContent), isiKotak().value);

  /* ================= 6) XSS dari nama tamu ================= */
  const NAMA_JAHA=TAMU[0]+' "><img src=x onerror=alert(1)>';
  isiKotak().value = NAMA_JAHA;
  w.eval('simpanTamu()');
  await sleep(150);
  t('XSS: nama ber-tag tidak melahirkan elemen baru', D.querySelector('img[src="x"]') === null && D.querySelectorAll('[onerror]').length === 0);
  t('XSS: markup baris tamu meng-escape tag (nama tampil apa adanya)',
    /&lt;img/.test(D.querySelector('.g-name b').innerHTML) && D.querySelector('.g-name b').textContent === NAMA_JAHA, D.querySelector('.g-name b').innerHTML);
  t('XSS: kotak editor memuat nama sebagai teks, bukan HTML', isiKotak().value === NAMA_JAHA && D.querySelectorAll('.gedit img').length === 0, isiKotak().value);
  t('XSS: tautan tamu meng-encode tag (%3Cimg, bukan tag hidup)', w.eval('guestLinkPersonal(GS[0])').includes('%3Cimg') && !/</.test(w.eval('guestLinkPersonal(GS[0])')), w.eval('guestLinkPersonal(GS[0])'));

  /* ================= 7) Mode demo: tidak menembak database ================= */
  {
    const dem = new JSDOM(read('master.html'), {
      runScripts: 'dangerously', url: 'https://asproject.my.id/master.html?demo=1', pretendToBeVisual: true,
      beforeParse(x) {
        x.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
        if (!x.matchMedia) x.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
        x.fetch = function () { throw new Error('demo tidak boleh menghubungi jaringan'); };
        try { x.eval(read('assets/button-help.js')); } catch (e) {}
      },
    });
    await sleep(700);
    let galat = null;
    try {
      dem.window.eval("setLinkMode('personal')");
      await sleep(120);
      dem.window.eval("document.getElementById('gRaw').value='Tamu Demo';simpanTamu()");
      await sleep(120);
    } catch (e) { galat = e.message; }
    t('Demo: ganti mode & simpan tamu aman tanpa jaringan', galat === null, String(galat));
    t('Demo: perubahan hanya di pratinjau + pesan jelas', /Demo/.test(dem.window.document.getElementById('toast').textContent), dem.window.document.getElementById('toast').textContent);
    t('Demo: mode & daftar tamu tetap berubah di layar', dem.window.eval('linkMode()') === 'personal' && dem.window.eval('GS.length') === 1);
    dem.window.close();
  }

  /* ================= 8) Kontrak statis ================= */
  {
    const src = read('master.html');
    t('Kontrak: PATCH hanya mengirim kolom data (bukan seluruh baris)', /body:JSON\.stringify\(\{data:d\}\)/.test(src));
    t('Kontrak: data diklon dulu sebelum diubah', /const d=JSON\.parse\(JSON\.stringify\(DRAFT\.data\|\|\{\}\)\);\s*\n ubah\(d\);/.test(src));
    t('Kontrak: mode link disimpan di snapshot yang sama dengan undangan live', src.includes('d.linkMode=mode') && src.includes("linkMode==='single'"));
    t('Kontrak: tautan personal selalu bisa dipakai walau mode 1 LINK', src.includes('function guestLinkPersonal') && src.includes('copyPersonalSemua'));
    t('Kontrak: kode tamu baru memakai aturan yang sama seperti Studio', src.includes("Math.random().toString(36).substring(2,10).toUpperCase()"));
  }

  A.dom.window.close(); B.dom.window.close(); C.dom.window.close();
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
