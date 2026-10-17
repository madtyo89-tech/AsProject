#!/usr/bin/env node
/* ============================================================
   test-pesan-wa.cjs — SEMUA tombol kirim/bagikan link undangan
   memakai pesan WhatsApp yang SAMA dan LENGKAP:
     Studio  : WA per tamu, 📤 Kirim Link via WhatsApp,
               Bagikan via WhatsApp (layar "Undangan sudah jadi!")
     Master  : 💬 Share via WhatsApp (link untuk semua & per tamu)
     Undangan: tombol 🔗 Bagikan (navigator.share / salin)
   Acuan format = contoh dari pemilik (2026-10-15).

   Offline: fetch Supabase di-stub, tidak ada tulis ke database.
   Jalankan: node tools/test-pesan-wa.cjs   (butuh: npm i jsdom)
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
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
};
/* Ambil isi pesan dari URL wa.me/?text=… */
const teksWa = url => {
  try { const u = new URL(String(url)); return u.hostname === 'wa.me' ? u.searchParams.get('text') : null; }
  catch (e) { return null; }
};

const AUTH = '31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';
const LINK = 'https://asproject.my.id/u/satrio-pandu-mahardika';
/* Contoh dari pemilik — persis begini yang harus keluar di semua tombol (link tanpa nama). */
const CONTOH = 'Assalamualaikum Bapak/Ibu/Saudara/i 🙏\n\n' +
  'Dengan memohon rahmat Allah SWT, kami mengundang untuk hadir di acara Tasyakuran Khitanan kami:\n\n' +
  LINK + '\n\n' +
  'Merupakan kebahagiaan bagi kami atas kehadiran & doanya.\n\n' +
  'Terima kasih 🤍\nSatrio Pandu Mahardika';
const TAMU = 'Pak Andi Wijaya & Keluarga';
const LINK_TAMU = LINK + '?to=' + encodeURIComponent(TAMU);
const PERSONAL = CONTOH.replace('Bapak/Ibu/Saudara/i', TAMU).replace(LINK, LINK_TAMU);

/* Kanvas palsu: QR tamu di tab Tamu & QR digambar ke canvas (jsdom tidak punya 2D). */
const ctx2d = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });

function bukaStudio() {
  const opened = [], requests = [];
  const dom = new JSDOM(read('studio.html'), {
    url: 'https://asproject.my.id/studio.html', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('asproject_studio_auth', AUTH);
      w.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        return { ok: true, status: 201, text: async () => '', json: async () => ({}) };
      };
      w.scrollTo = () => {};
      w.clearScrollReveal = () => {}; w.setupScrollReveal = () => {};
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
      w.open = (...args) => { opened.push(args); return null; };
      w.console.error = () => {};
      try { w.eval(read('assets/qrcode.js')); } catch (e) { /* QR jatuh ke teks "QR gagal dibuat" */ }
    },
  });
  return { dom, w: dom.window, opened, requests };
}

function bukaMaster(row) {
  const opened = [];
  const dom = new JSDOM(read('master.html'), {
    url: 'https://asproject.my.id/master.html?slug=' + row.slug + '&k=' + row.data.masterKey,
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async url => {
        const u = String(url);
        if (u.includes('/rest/v1/invitation_drafts')) return { ok: true, status: 200, json: async () => [JSON.parse(JSON.stringify(row))] };
        return { ok: true, status: 200, json: async () => [] };
      };
      w.open = (...args) => { opened.push(args); return null; };
    },
  });
  return { dom, w: dom.window, opened };
}

function bukaUndangan(row, query) {
  const dom = new JSDOM(read('undangan.html'), {
    url: 'https://asproject.my.id/undangan.html?slug=' + row.slug + (query || ''),
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
      if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.fetch = async url => {
        const u = String(url);
        if (u.includes('/rest/v1/invitation_drafts')) return { ok: true, status: 200, json: async () => [JSON.parse(JSON.stringify(row))] };
        return { ok: false, status: 0, text: async () => '', json: async () => [] };
      };
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.scrollTo = () => {};
      try { w.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w.eval(read('assets/vip-4d.js')); } catch (e) {}
    },
  });
  return { dom, w: dom.window };
}

/* Klik tombol 🔗 Bagikan di undangan live dan kembalikan teks yang dibagikan. */
async function bagikanDariUndangan(row, query, mode) {
  const { dom, w } = bukaUndangan(row, query);
  try {
    await sleep(600);
    const btn = w.document.getElementById('btnShare');
    if (!btn) return { err: 'tombol Bagikan tidak ada' };
    let data = null, disalin = null;
    if (mode === 'share') {
      Object.defineProperty(w.navigator, 'share', { configurable: true, value: async d => { data = d; } });
    } else {
      Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async s => { disalin = s; } } });
    }
    btn.click();
    await sleep(60);
    const toast = (w.document.body.textContent.match(/Pesan undangan tersalin[^\n]*/) || [''])[0];
    return { data, disalin, toast };
  } finally { dom.window.close(); }
}

(async () => {
  /* ================= 1) STUDIO ================= */
  console.log('— Studio —');
  const S = bukaStudio();
  const w = S.w, D = w.document;
  await sleep(150);
  w.eval(`startInvitation();evPick('khitanan');
    updF('namaAnak','Satrio Pandu Mahardika');updF('tanggalAcara','2026-12-20');updF('jamAcara','09:00');
    updF('venue','Rumah Keluarga, Bandung');upd('guestsRaw',${JSON.stringify(TAMU)});`);
  t('studio: slug otomatis dari nama anak', w.eval('state.slug') === 'satrio-pandu-mahardika', w.eval('state.slug'));
  t('studio: teks bawaan = WA_TEMPLATE_DEFAULT', w.eval('state.waTemplate===WA_TEMPLATE_DEFAULT'));
  t('studio: pesan untuk semua tamu PERSIS contoh pemilik', w.eval('waShareText()') === CONTOH, w.eval('waShareText()'));

  w.eval(`set('tab','tamu')`);
  const waTamu = [...D.querySelectorAll('a.sm-btn.wa')].map(a => teksWa(a.getAttribute('href')));
  t('studio: tombol WA per tamu = format sama, sapaan nama + link personal', waTamu.length === 1 && waTamu[0] === PERSONAL, waTamu[0]);
  const kirim = [...D.querySelectorAll('button')].find(b => /Kirim Link via WhatsApp/.test(b.textContent));
  S.opened.length = 0; kirim && kirim.click();
  t('studio: 📤 Kirim Link via WhatsApp (tanpa tamu dipilih) = contoh', S.opened.length === 1 && teksWa(S.opened[0][0]) === CONTOH, S.opened[0] && teksWa(S.opened[0][0]));
  t('studio: pratinjau pesan WA di tab Tamu = pesan yang terkirim', D.getElementById('waPesanPrev') && D.getElementById('waPesanPrev').textContent === CONTOH);
  w.eval(`set('selGuest',${JSON.stringify(TAMU)})`);
  S.opened.length = 0;
  [...D.querySelectorAll('button')].find(b => /Kirim Link via WhatsApp/.test(b.textContent)).click();
  t('studio: 📤 Kirim Link via WhatsApp (tamu dipilih) = pesan personal', teksWa(S.opened[0] && S.opened[0][0]) === PERSONAL);
  t('studio: pratinjau mengikuti tamu terpilih', D.getElementById('waPesanPrev').textContent === PERSONAL);
  w.eval(`set('selGuest',null)`);

  /* Publish (REST fallback di-stub) → layar "Undangan sudah jadi!" */
  await w.eval('(async()=>{await publish()})()');
  t('studio: publish selesai → layar Undangan sudah jadi', w.eval('state.stage') === 'ready' && !!D.getElementById('ready-title'));
  const req = S.requests.find(r => r.url.includes('/rest/v1/invitation_drafts'));
  const row = req ? JSON.parse(req.options.body) : null;
  t('studio: snapshot publish membawa data.waTemplate', !!row && row.data.waTemplate === w.eval('WA_TEMPLATE_DEFAULT'));
  const bagikan = [...D.querySelectorAll('button')].find(b => b.textContent.trim() === 'Bagikan via WhatsApp');
  S.opened.length = 0; bagikan && bagikan.click();
  t('studio: layar selesai → Bagikan via WhatsApp = contoh (dulu: "Dengan hormat…")',
    S.opened.length === 1 && teksWa(S.opened[0][0]) === CONTOH, S.opened[0] && teksWa(S.opened[0][0]));

  /* ================= 2) MASTER ================= */
  console.log('— Undangan Master —');
  if (row) {
    const M = bukaMaster(row);
    await sleep(250);
    const MD = M.w.document;
    const btnAll = MD.querySelector('button[onclick="shareAllWa()"]');
    M.opened.length = 0; btnAll && btnAll.click();
    t('master: Share via WhatsApp (link untuk semua) = contoh (dulu: "Halo! Berikut…")',
      M.opened.length === 1 && teksWa(M.opened[0][0]) === CONTOH, M.opened[0] && teksWa(M.opened[0][0]));
    const btnTamu = [...MD.querySelectorAll('button.btn-wa')].find(b => /shareWaIdx\(0\)/.test(b.getAttribute('onclick') || ''));
    M.opened.length = 0; btnTamu && btnTamu.click();
    t('master: Share via WhatsApp per tamu = pesan personal Studio (dulu: "Halo … 👋")',
      M.opened.length === 1 && teksWa(M.opened[0][0]) === PERSONAL, M.opened[0] && teksWa(M.opened[0][0]));
    const prev = MD.querySelector('.wa-prev-txt');
    t('master: pratinjau "Lihat isi pesan WhatsApp" = pesan yang terkirim', !!prev && prev.textContent === CONTOH);
    M.dom.window.close();
  } else t('master: butuh baris publish dari Studio', false);

  /* ================= 3) UNDANGAN LIVE ================= */
  console.log('— Undangan live (tombol 🔗 Bagikan) —');
  if (row) {
    const r1 = await bagikanDariUndangan(row, '&to=' + encodeURIComponent(TAMU), 'share');
    t('undangan: Bagikan (navigator.share) = contoh, link umum tanpa ?to= tamu', !!r1.data && r1.data.text === CONTOH, r1.err || (r1.data && r1.data.text));
    t('undangan: link tidak dikirim dua kali (tanpa field url)', !!r1.data && !('url' in r1.data));
    const r2 = await bagikanDariUndangan(row, '', 'salin');
    t('undangan: tanpa navigator.share → pesan lengkap tersalin', r2.disalin === CONTOH, r2.err || r2.disalin);
    t('undangan: toast menjelaskan pesan tersalin', /Pesan undangan tersalin/.test(r2.toast || ''));
  } else t('undangan: butuh baris publish dari Studio', false);

  /* ================= 4) TEKS KUSTOM PEMILIK ================= */
  console.log('— Teks kustom pemilik —');
  const KUSTOM = 'Halo {nama_tamu}!\nKami mengundang ke {acara} {nama_pengantin}.\nSalam hangat untuk {nama_tamu} 🤍';
  w.eval(`editInvitation();set('tab','tamu')`);
  const ta = D.querySelector('textarea[oninput^="updWaTemplate"]');
  ta.value = KUSTOM; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  const harap = 'Halo Bapak/Ibu/Saudara/i!\nKami mengundang ke Tasyakuran Khitanan Satrio Pandu Mahardika.\nSalam hangat untuk Bapak/Ibu/Saudara/i 🤍\n\n' + LINK;
  t('kustom: semua {nama_tamu} terganti & link ditambahkan bila {link_undangan} tidak ada', w.eval('waShareText()') === harap, w.eval('waShareText()'));
  t('kustom: pratinjau tab Tamu ikut berubah saat mengetik', D.getElementById('waPesanPrev').textContent === harap);
  t('kustom: tombol ↺ Kembalikan teks bawaan muncul', D.getElementById('waResetBtn').style.display !== 'none');
  t('kustom: mengubah teks setelah publish → status perlu Publish Ulang', w.eval('draftDirty()') === true);
  S.requests.length = 0;
  await w.eval('(async()=>{await publish()})()');
  const req2 = S.requests.find(r => r.url.includes('/rest/v1/invitation_drafts'));
  const row2 = req2 ? JSON.parse(req2.options.body) : null;
  t('kustom: Publish Ulang menyimpan teks kustom & status sinkron lagi', !!row2 && row2.data.waTemplate === KUSTOM && w.eval('draftDirty()') === false);
  S.opened.length = 0;
  [...D.querySelectorAll('button')].find(b => b.textContent.trim() === 'Bagikan via WhatsApp').click();
  t('kustom: layar selesai memakai teks kustom', teksWa(S.opened[0] && S.opened[0][0]) === harap);
  if (row2) {
    const M2 = bukaMaster(row2);
    await sleep(250);
    M2.opened.length = 0; M2.w.eval('shareAllWa()');
    t('kustom: Master memakai teks kustom yang sama', teksWa(M2.opened[0] && M2.opened[0][0]) === harap, M2.opened[0] && teksWa(M2.opened[0][0]));
    M2.opened.length = 0; M2.w.eval(`shareWa(${JSON.stringify(TAMU)})`);
    t('kustom: Master per tamu = WA per tamu di Studio', teksWa(M2.opened[0] && M2.opened[0][0]) === w.eval(`pesanWa(guests()[0])`));
    M2.dom.window.close();
    const r3 = await bagikanDariUndangan(row2, '', 'share');
    t('kustom: tombol Bagikan undangan memakai teks kustom yang sama', !!r3.data && r3.data.text === harap, r3.data && r3.data.text);
  }
  w.eval(`applyDraftData(${JSON.stringify(row2 ? row2.data : {})},{slug:'satrio-pandu-mahardika'})`);
  t('kustom: buka lagi dari arsip/server memulihkan teks kustom', w.eval('state.waTemplate') === KUSTOM);
  w.eval(`set('tab','tamu')`);
  D.getElementById('waResetBtn').click();
  t('kustom: ↺ Kembalikan teks bawaan', w.eval('state.waTemplate===WA_TEMPLATE_DEFAULT') && w.eval('waShareText()') === CONTOH);

  /* ================= 5) ACARA LAIN ================= */
  console.log('— Jenis acara lain —');
  w.eval(`evPick('pernikahan');updF('namaPria','Rangga');updF('namaWanita','Aisyah');state.selGuest=null`);
  const nikah = w.eval('waShareText()');
  t('pernikahan: {acara} terbaca "Pernikahan" (bukan "The Wedding Of")', nikah.includes('hadir di acara Pernikahan kami:') && !nikah.includes('The Wedding Of'), nikah);
  t('pernikahan: tanda tangan nama mempelai memakai "&" biasa (tanpa &amp;)', nikah.endsWith('Terima kasih 🤍\nRangga & Aisyah') && !nikah.includes('&amp;'));
  w.eval(`if(!state.form.tanggalAcara)updF('tanggalAcara','2026-12-20');if(!state.form.jamAcara)updF('jamAcara','09:00');
    if(!String(state.form.venue||'').trim())updF('venue','Gedung Serbaguna, Bandung')`);
  S.requests.length = 0;
  await w.eval('(async()=>{await publish()})()');
  const req3 = S.requests.find(r => r.url.includes('/rest/v1/invitation_drafts'));
  const row3 = req3 ? JSON.parse(req3.options.body) : null;
  if (row3) {
    const nikahUmum = w.eval('pesanWa(null)');
    const M3 = bukaMaster(row3);
    await sleep(250);
    M3.opened.length = 0; M3.w.eval('shareAllWa()');
    t('pernikahan: Master = Studio (sapaan, acara, link, tanda tangan)', teksWa(M3.opened[0] && M3.opened[0][0]) === nikahUmum, M3.opened[0] && teksWa(M3.opened[0][0]));
    M3.dom.window.close();
    const r4 = await bagikanDariUndangan(row3, '', 'share');
    t('pernikahan: tombol Bagikan undangan = Studio', !!r4.data && r4.data.text === nikahUmum, r4.err || (r4.data && r4.data.text));
  } else t('pernikahan: publish undangan pernikahan', false, w.eval('state.form'));
  const acara = w.eval(`['khitanan','ultah','aqiqah'].map(e=>acaraWa(e))`);
  t('acara: khitanan/ultah/aqiqah memakai nama acara lengkap', JSON.stringify(acara) === JSON.stringify(['Tasyakuran Khitanan', 'Sweet Birthday Party', 'Tasyakuran Aqiqah']), acara);

  /* ================= 6) NAMA TAMU BER-APOSTROF / BER-TANDA KUTIP =================
     Bug 2026-10-16: nama tamu disisipkan ke onclick="fn('NAMA')" hanya dengan
     esc(). Karena parser HTML mengubah &#39; kembali menjadi apostrof, nama
     seperti O'Brien menghasilkan JavaScript rusak ("missing ) after argument
     list") — tombol QR/Copy di Studio tidak melakukan apa pun, tanpa pesan. */
  console.log('— Nama tamu ber-apostrof —');
  const TAMU_APOS = "O'Brien";
  const TAMU_KUTIP = 'Nur "Aisyah" <b>';
  w.eval('editInvitation()');                    /* dari layar selesai kembali ke editor */
  w.eval(`state.selGuest=null;set('tab','tamu')`);
  await sleep(80);
  /* Diketik seperti pemilik: event input asli pada textarea daftar tamu. */
  const taTamu = D.querySelector('textarea[placeholder="1 baris 1 nama tamu"]');
  t('textarea daftar tamu ada', !!taTamu);
  taTamu.value = TAMU_APOS + '\n' + TAMU_KUTIP;
  taTamu.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(600);
  const barisTamu = [...D.querySelectorAll('.guestrow')];
  t('nama ber-apostrof tetap tampil sebagai teks (bukan tag)', barisTamu.length === 2 &&
    barisTamu[0].textContent.includes(TAMU_APOS) && D.querySelectorAll('.guestrow b').length === 0);
  const tombolTamu = barisTamu.flatMap(r => [...r.querySelectorAll('button')]);
  const onClick = tombolTamu.map(b => b.getAttribute('onclick'));
  const rusak = [];
  for (const kode of onClick) { try { new w.Function(kode); } catch (e) { rusak.push(kode + ' → ' + e.message); } }
  t('semua onclick di daftar tamu = JavaScript yang sah (dulu "missing ) after argument list")', rusak.length === 0, rusak);
  const qrApos = barisTamu[0] && barisTamu[0].querySelector('button.sm-btn.dark');
  t('baris tamu punya tombol QR', !!qrApos);
  qrApos && qrApos.click();
  t('klik QR tamu ber-apostrof → tamu terpilih (dulu tombol mati)', w.eval('state.selGuest') === TAMU_APOS, w.eval('state.selGuest'));
  t('QR check-in digambar untuk tamu ber-apostrof', !!D.querySelector('.card img[src^="data:image"]'));
  const waApos = [...D.querySelectorAll('a.sm-btn.wa')].map(a => teksWa(a.getAttribute('href')));
  t('pesan WA tamu ber-apostrof = pesan personal yang sama dengan Studio', waApos[0] === w.eval('pesanWa(guests()[0])'), waApos[0]);
  t('link personal tamu ber-apostrof tetap utuh di dalam pesan', !!waApos[0] && waApos[0].includes(w.eval('guests()[0].link')));
  t('sapaan pesan memakai nama tamu ber-apostrof', !!waApos[0] && waApos[0].includes("Assalamualaikum O'Brien 🙏"));
  /* Dulu daftar & kartu QR tetap basi sampai pemilik berpindah tab. */
  const jumlahTamu = D.getElementById('tamuJumlah');
  t('jumlah tamu ikut berubah saat mengetik (dulu tetap "0 tamu" sampai pindah tab)',
    !!jumlahTamu && jumlahTamu.textContent === '2 tamu', jumlahTamu && jumlahTamu.textContent);
  taTamu.value = 'Budi Santoso';
  taTamu.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(600);
  const kartuQr = D.getElementById('kartuQrTamu');
  t('tamu terpilih yang dihapus dari daftar → pilihan direset (QR tidak menunjuk tamu lama)',
    w.eval('state.selGuest') === null && !!kartuQr && /Pilih tamu/.test(kartuQr.textContent), w.eval('state.selGuest'));

  /* ================= 7) SUMBER: blok bersama & teks lama ================= */
  console.log('— Sumber —');
  const blok = s => { const a = s.indexOf('/* ==== PESAN WA UNDANGAN'), b = s.indexOf('/* ==== /PESAN WA UNDANGAN ==== */'); return a >= 0 && b > a ? s.slice(a, b) : null; };
  const st = read('studio.html'), ms = read('master.html'), ud = read('undangan.html');
  t('sumber: blok PESAN WA identik di studio, master, undangan', !!blok(st) && blok(st) === blok(ms) && blok(st) === blok(ud));
  t('sumber: teks lama yang tidak lengkap sudah tidak ada',
    !st.includes('Dengan hormat, kami mengundang Anda') && !ms.includes('Halo! Berikut undangan digital') &&
    !ms.includes('Kamu kami undang') && !ud.includes("const txt='Undangan '+fullNm"));

  S.dom.window.close();
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); console.log(`\nRingkasan: ${ok} lulus, ${fail + 1} gagal`); process.exitCode = 1; });
