#!/usr/bin/env node
/* ============================================================
   test-bantuan-tombol.cjs — bantuan tombol (assets/button-help.js)
   harus BERTAHAN saat halaman bergulir.

   Bug yang dikunci di sini (ditemukan 2026-10-16):
     Handler gulir dulu selalu memanggil hide(). Di Studio, `focus()` dan
     tombol F1 MEMICU GULIR (browser menggulir tombol yang difokuskan ke
     dalam layar). Akibatnya tooltip yang baru saja muncul langsung dihapus
     — kadang terlihat, kadang tidak (uji browser jadi flaky, pengguna
     kehilangan bantuan tepat setelah menekan F1).

   Aturan sekarang:
     - gulir TIDAK menghapus tooltip; posisinya dihitung ulang (fungsi place());
     - tooltip baru ditutup kalau tombolnya keluar dari layar;
     - gulir yang terjadi SEBELUM tooltip muncul tetap membatalkannya
       (menahan sambil menggulir bukan permintaan bantuan);
     - gerakan pointer > 10px, Escape, focusout, resize, dan blur tetap menutup.

   Jalankan: node tools/test-bantuan-tombol.cjs   (butuh: npm i jsdom)
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

const HALAMAN = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>uji bantuan</title></head>
<body>
 <button id="simpan" onclick="saveCustomTemplate()">💾 Simpan</button>
 <button id="lain" onclick="set('tab','desain')">Lain</button>
 <input id="teks" value="">
</body></html>`;

function buka() {
  const errors = [];
  const dom = new JSDOM(HALAMAN, { url: 'https://x.test/uji.html', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  w.addEventListener('error', e => errors.push(String(e.message)));
  try { w.eval(read('assets/button-help.js')); } catch (e) { errors.push('eval: ' + e.message); }
  return { dom, w, errors };
}

/* jsdom tidak punya PointerEvent lengkap: lampirkan properti yang dibaca
   button-help.js ke Event biasa, lalu kirim ke target (bubbles + cancelable). */
function pointer(w, target, jenis, opsi) {
  const ev = new w.Event(jenis, { bubbles: true, cancelable: true });
  ev.button = opsi.button ?? 0;
  ev.isPrimary = opsi.isPrimary ?? true;
  ev.pointerId = opsi.pointerId ?? 1;
  ev.clientX = opsi.clientX ?? 10;
  ev.clientY = opsi.clientY ?? 10;
  target.dispatchEvent(ev);
  return ev;
}
const gulir = w => w.document.dispatchEvent(new w.Event('scroll', { bubbles: true }));
const tip = w => w.document.getElementById('as-button-help');

(async () => {
  /* ---------- 0) statis: skrip dimuat oleh halaman yang memakainya ---------- */
  console.log('— Sumber —');
  for (const rel of ['studio.html', 'master.html', 'undangan.html', 'index.html']) {
    t(`${rel}: memuat assets/button-help.js`, read(rel).includes('assets/button-help.js'));
  }
  const sumber = read('assets/button-help.js');
  t('button-help.js: punya place() (hitung ulang posisi) — bukan hide() saat menggulir',
    /function place\(\)/.test(sumber) && /addEventListener\('scroll',\(\)=>\{cancel\(\);place\(\)\}/.test(sumber));
  t('button-help.js: tidak ada lagi hide() di handler gulir', !/addEventListener\('scroll',\(\)=>\{cancel\(\);hide\(\)\}/.test(sumber));

  /* ---------- 1) teks bantuan dasar ---------- */
  console.log('— Bantuan dasar —');
  const A = buka();
  const w = A.w, D = w.document;
  const simpan = D.getElementById('simpan');
  simpan.focus();
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'F1', bubbles: true, cancelable: true }));
  const t1 = tip(w);
  t('F1 pada tombol → tooltip muncul', !!t1);
  t('isi tooltip = penjelasan tombolnya', !!t1 && /tema kustom/i.test(t1.textContent), t1 && t1.textContent);
  t('aria-describedby dipasang', simpan.getAttribute('aria-describedby') === 'as-button-help');

  /* ---------- 2) INTI: gulir tidak boleh menghapus tooltip ---------- */
  console.log('— Gulir (inti perbaikan) —');
  gulir(w);
  t('gulir setelah tooltip tampil → tooltip TETAP ada', !!tip(w));
  t('gulir → aria-describedby tetap terpasang', simpan.getAttribute('aria-describedby') === 'as-button-help');
  gulir(w); gulir(w);
  t('beberapa kali gulir → masih ada', !!tip(w));
  t('teks tooltip tidak berubah', !!tip(w) && /tema kustom/i.test(tip(w).textContent));

  /* ---------- 3) penutup yang tetap berlaku ---------- */
  console.log('— Penutup lain —');
  t('tooltip masih ada sebelum Escape', !!tip(w));
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  t('Escape menutup tooltip', !tip(w));
  t('aria-describedby dibersihkan setelah ditutup', simpan.getAttribute('aria-describedby') === null);

  simpan.focus();
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'F1', bubbles: true, cancelable: true }));
  t('F1 lagi → tooltip muncul lagi', !!tip(w));
  w.dispatchEvent(new w.Event('resize'));
  t('resize menutup tooltip', !tip(w));

  simpan.focus();
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'F1', bubbles: true, cancelable: true }));
  /* Setelah F1 (tanpa tahan), tooltip ditutup oleh sentuhan/klik berikutnya,
     Escape, focusout, resize, atau timeout 6 detik — bukan oleh gerakan mouse. */
  pointer(w, simpan, 'pointerdown', { clientX: 12, clientY: 12 });
  t('sentuhan/klik berikutnya menutup tooltip', !tip(w));
  t('F1 menyiapkan penutupan otomatis (hideTimer 6 detik)', /hideTimer=setTimeout\(hide,6000\)/.test(read('assets/button-help.js')));
  const C = buka();
  pointer(C.w, C.w.document.getElementById('simpan'), 'pointerdown', { clientX: 3, clientY: 3 });
  pointer(C.w, C.w.document.getElementById('simpan'), 'pointermove', { clientX: 90, clientY: 90 });
  await sleep(1100);
  t('gerakan pointer membatalkan tahan (tidak ada tooltip)', !tip(C.w));
  C.dom.window.close();

  /* ---------- 4) menahan tombol (hold) ---------- */
  console.log('— Tahan-tombol & gulir —');
  const B = buka();
  const w2 = B.w, D2 = w2.document;
  const btn2 = D2.getElementById('simpan');
  pointer(w2, btn2, 'pointerdown', { clientX: 5, clientY: 5 });
  gulir(w2);                                   /* menggulir = batal */
  await sleep(1100);
  t('menahan sambil menggulir → bantuan tidak muncul', !tip(w2));

  pointer(w2, btn2, 'pointerdown', { clientX: 5, clientY: 5 });
  await sleep(1100);
  t('menahan tanpa menggulir → bantuan muncul', !!tip(w2));
  gulir(w2);
  t('setelah bantuan muncul, menggulir tidak menghapusnya', !!tip(w2));
  pointer(w2, btn2, 'pointerup', { clientX: 5, clientY: 5 });
  await sleep(50);
  t('bantuan tetap terbaca sesaat setelah jari dilepas', !!tip(w2));

  /* ---------- 5) klik tidak dijalankan setelah menahan ---------- */
  let diklik = 0;
  D2.getElementById('lain').addEventListener('click', () => diklik++);
  pointer(w2, D2.getElementById('lain'), 'pointerdown', { clientX: 6, clientY: 6 });
  await sleep(1100);
  D2.getElementById('lain').click();
  t('klik setelah menahan tidak menjalankan aksi tombol', diklik === 0, diklik);

  t('tidak ada error JavaScript', A.errors.length === 0 && B.errors.length === 0, A.errors.concat(B.errors));
  A.dom.window.close(); B.dom.window.close();

  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  if (fail) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
