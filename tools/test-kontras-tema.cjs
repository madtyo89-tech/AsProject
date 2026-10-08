#!/usr/bin/env node
/*
 * Uji kontras tema — memastikan teks undangan selalu terbaca.
 *
 * Latar belakang: sebagian palet tema memakai "ink" terang karena covernya gelap
 * (mis. Balap Mobil #F0F0F0), sedangkan kartu konten di halaman tamu selalu
 * berlatar terang. Uji ini menjalankan rumus yang benar-benar dipakai halaman
 * (assets/theme-contrast.js) untuk SEMUA tema di studio.html & undangan.html,
 * lalu memeriksa rasio kontras hasilnya.
 *
 *   node tools/test-kontras-tema.cjs
 *
 * Yang diperiksa per tema:
 *   1. teks ink konten vs latar kartu       ≥ 4.5  (WCAG AA teks normal)
 *      dan tetap sewarna tema (dipakai nada gelap dari gradasi tema itu sendiri)
 *   2. label accent konten vs latar kartu  ≥ 3.0  (label hiasan/teks besar)
 *   3. teks di atas tombol berisi ink       ≥ 4.5
 *   4. teks di atas tombol berisi ink tema  ≥ 3.0
 *   5. ornamen accent di cover (g0 & g1)    ≥ 3.0
 *   6. teks cover tetap terbaca (ink vs g0 & g2) ≥ 3.0  ← tidak boleh rusak
 *   7. palet tema identik di studio.html & undangan.html
 *   8. (jsdom) undangan.html sungguhan benar-benar memasang warna hasil perhitungan
 *   9. (jsdom) "Simpan File HTML" di studio.html ikut menyematkan aturan ini
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const KARTU = '#fffdf9';           // latar kartu konten (lihat assets/theme-contrast.js)
const TOLERANSI = 0.01;

let gagal = 0;
let lulus = 0;

function ok(pesan) { lulus++; }
function tidak(pesan) { gagal++; console.log('  [FAIL] ' + pesan); }
function cek(hasil, pesan) { hasil ? ok(pesan) : tidak(pesan); }

/* ---------------------------------------------------------------- muat rumus */
const berkasAset = path.join(ROOT, 'assets', 'theme-contrast.js');
if (!fs.existsSync(berkasAset)) {
  console.log('  [FAIL] assets/theme-contrast.js tidak ada');
  process.exit(1);
}
const konteks = { window: {} };
vm.runInNewContext(fs.readFileSync(berkasAset, 'utf8'), konteks, { filename: 'theme-contrast.js' });
const TC = konteks.window.AsThemeContrast;
if (!TC || typeof TC.untukKonten !== 'function') {
  console.log('  [FAIL] assets/theme-contrast.js tidak mengekspos window.AsThemeContrast');
  process.exit(1);
}
console.log('Uji kontras tema — ' + path.relative(ROOT, berkasAset) + '\n');

/* ------------------------------------------------------------- baca palet TPL */
function palet(rel) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const blok = html.split("{id:'").slice(1);
  const daftar = [];
  for (const b of blok) {
    const id = b.slice(0, b.indexOf("'"));
    const g = b.match(/g:\['([^']+)','([^']+)','([^']+)'\]/);
    const accent = b.match(/accent:'([^']*)'/);
    const ink = b.match(/ink:'([^']*)'/);
    const ev = b.match(/ev:'([^']*)'/);
    if (!g || !accent || !ink || !ev) continue;   // bukan objek tema (mis. FONTS/SLIDES)
    if (!/^#[0-9a-fA-F]{3,6}$/.test(ink[1])) continue;
    daftar.push({ id, ev: ev[1], g: [g[1], g[2], g[3]], accent: accent[1], ink: ink[1] });
  }
  return daftar;
}

const temaUndangan = palet('undangan.html');
const temaStudio = palet('studio.html');

console.log('1) Palet tema');
cek(temaUndangan.length >= 40, `undangan.html: ${temaUndangan.length} tema berpalet terbaca`);
cek(temaStudio.length >= 40, `studio.html: ${temaStudio.length} tema berpalet terbaca`);
{
  const petaU = new Map(temaUndangan.map(t => [t.id, t]));
  const petaS = new Map(temaStudio.map(t => [t.id, t]));
  let beda = 0;
  for (const [id, u] of petaU) {
    const s = petaS.get(id);
    if (!s) { beda++; console.log(`  [FAIL] tema ${id} ada di undangan tapi tidak di studio`); continue; }
    if (s.ink !== u.ink || s.accent !== u.accent || s.g.join(',') !== u.g.join(',')) {
      beda++;
      console.log(`  [FAIL] palet ${id} berbeda — studio ${s.ink}/${s.accent} vs undangan ${u.ink}/${u.accent}`);
    }
  }
  cek(beda === 0, `palet identik di studio & undangan (${petaU.size} tema dibandingkan)`);
}

/* --------------------------------------------------------- hitung & periksa */
console.log('\n2) Tema yang tadinya paling parah (contoh laporan pengguna)');
function baris(t) {
  const asli = TC.kontras(t.ink, KARTU);
  const k = TC.untukKonten(t.ink, t.accent, t.g);
  // palet ditulis HURUF BESAR di HTML, hasil rumus selalu huruf kecil → samakan dulu
  const dariTema = t.g.some(w => TC.normal(w) === k.ink);
  return { asli, baru: TC.kontras(k.ink, KARTU), ink: k.ink, dariTema };
}
const urut = temaUndangan.slice().sort((a, b) => baris(a).asli - baris(b).asli);
for (const t of urut.slice(0, 6)) {
  const b = baris(t);
  console.log(`  ${t.id.padEnd(18)} ink ${t.ink.padEnd(8)} kontras ${b.asli.toFixed(2)} → ` +
              `${b.ink} (${b.baru.toFixed(2)})${b.dariTema ? ' — nada gelap tema sendiri' : ''}`);
}

console.log('\n3) Kontras per tema (setelah penyesuaian)');
let terburukTeks = { rasio: 99, id: '' };
let terburukAccent = { rasio: 99, id: '' };
let terburukCover = { rasio: 99, id: '' };
let pakaiNadaTema = 0;
let perluDisesuaikan = 0;
for (const t of temaUndangan) {
  const k = TC.untukKonten(t.ink, t.accent, t.g);
  const accentCover = TC.untukCover(t.accent, t.g[0], t.g[1]);
  const rasioTeks = TC.kontras(k.ink, KARTU);
  const rasioAccent = TC.kontras(k.accent, KARTU);
  const rasioTeksDiInk = TC.kontras(k.teksDiInk, k.ink);
  const rasioTeksDiInkTema = TC.kontras(k.teksDiInkTema, t.ink);
  const rasioAccentCover0 = TC.kontras(accentCover, t.g[0]);
  const rasioAccentCover1 = TC.kontras(accentCover, t.g[1]);
  const rasioCover0 = TC.kontras(t.ink, t.g[0]);
  const rasioCover2 = TC.kontras(t.ink, t.g[2]);

  if (rasioTeks + TOLERANSI < 4.5) tidak(`${t.id}: ink konten hanya ${rasioTeks.toFixed(2)}:1 (butuh 4.5)`);
  if (rasioAccent + TOLERANSI < 3) tidak(`${t.id}: accent konten hanya ${rasioAccent.toFixed(2)}:1 (butuh 3)`);
  if (rasioTeksDiInk + TOLERANSI < 4.5) tidak(`${t.id}: teks tombol ink hanya ${rasioTeksDiInk.toFixed(2)}:1`);
  if (rasioTeksDiInkTema + TOLERANSI < 3) tidak(`${t.id}: teks tombol cover hanya ${rasioTeksDiInkTema.toFixed(2)}:1`);
  if (rasioAccentCover0 + TOLERANSI < 3 || rasioAccentCover1 + TOLERANSI < 3) {
    tidak(`${t.id}: ornamen accent cover ${rasioAccentCover0.toFixed(2)}/${rasioAccentCover1.toFixed(2)}:1`);
  }
  if (rasioCover0 + TOLERANSI < 3 || rasioCover2 + TOLERANSI < 3) {
    tidak(`${t.id}: teks cover ikut pudar ${rasioCover0.toFixed(2)}/${rasioCover2.toFixed(2)}:1`);
  }
  const asli = TC.kontras(t.ink, KARTU);
  if (asli + TOLERANSI < 4.5) {
    perluDisesuaikan++;
    // Tema dengan ink terlalu terang harus memakai nada gelap miliknya sendiri
    // (bukan abu-abu generik) selama gradasinya memang cukup gelap.
    if (t.g.some(w => TC.kontras(w, KARTU) >= 4.5)) {
      if (t.g.some(w => TC.normal(w) === k.ink)) pakaiNadaTema++;
      else tidak(`${t.id}: ink terang tapi hasil bukan nada gelap tema (${k.ink})`);
    }
  }
  if (rasioTeks < terburukTeks.rasio) terburukTeks = { rasio: rasioTeks, id: t.id };
  if (rasioAccent < terburukAccent.rasio) terburukAccent = { rasio: rasioAccent, id: t.id };
  if (Math.min(rasioCover0, rasioCover2) < terburukCover.rasio) {
    terburukCover = { rasio: Math.min(rasioCover0, rasioCover2), id: t.id };
  }
}
cek(perluDisesuaikan >= 10,
    `${perluDisesuaikan} tema ber-ink terlalu terang ikut disesuaikan (mis. Balap Mobil, Naga Api)`);
cek(pakaiNadaTema >= 10,
    `${pakaiNadaTema} tema memakai nada gelap dari gradasinya sendiri — tetap sewarna tema`);
console.log(`  ${temaUndangan.length} tema diperiksa`);
console.log(`  kontras terburuk: ink ${terburukTeks.rasio.toFixed(2)}:1 (${terburukTeks.id}), ` +
            `accent ${terburukAccent.rasio.toFixed(2)}:1 (${terburukAccent.id})`);
console.log(`  cover (tidak boleh berubah): terburuk ${terburukCover.rasio.toFixed(2)}:1 (${terburukCover.id})`);

console.log('\n4) Halaman benar-benar memakai penyesuaian ini');
{
  const und = fs.readFileSync(path.join(ROOT, 'undangan.html'), 'utf8');
  cek(/<script src="assets\/theme-contrast\.js"><\/script>/.test(und),
      'undangan.html memuat assets/theme-contrast.js');
  cek(und.includes('TC.untukKonten(') && und.includes('TC.untukCover('),
      'boot() memakai untukKonten() & untukCover()');
  cek(und.includes("setProperty('--ink-body'") && und.includes("setProperty('--accent-body'"),
      'boot() memasang --ink-body & --accent-body');
  cek(/KT\?KT\.ink:tplF\.ink/.test(und),
      'ada cadangan: bila aset tidak termuat, warna tema dipakai (tidak error)');
  const kartuKonten = (und.match(/var\(--ink-body\)/g) || []).length;
  const coverKonten = (und.match(/var\(--ink\)/g) || []).length;
  cek(kartuKonten >= 15, `aturan konten memakai --ink-body (${kartuKonten} tempat)`);
  cek(coverKonten <= 7, `cover tetap memakai --ink tema (${coverKonten} tempat)`);
  const stu = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
  cek(stu.includes("fetch('assets/theme-contrast.js')"),
      'studio.html: file HTML mandiri ikut menyematkan aset kontras');
}

/* --------------------------------------------------- 5. render halaman asli */
/* Bagian ini menjalankan undangan.html sungguhan di jsdom (aset dimuat manual seperti
   <script src>), memakai tema "Balap Mobil" yang dilaporkan pengguna, lalu membaca
   variabel CSS yang benar-benar dipasang boot(). Dilewati bila jsdom tidak ada. */
(async function renderHalamanAsli() {
  console.log('\n5) Halaman tamu sungguhan (jsdom) — tema Balap Mobil');
  let JSDOM = null;
  try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional */ }
  if (!JSDOM) {
    console.log('  (dilewati: jsdom belum terpasang — npm install --no-save jsdom)');
  } else {
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'undangan.html'), 'utf8'), {
      url: 'https://asproject.my.id/undangan.html?slug=demo',
      runScripts: 'outside-only', pretendToBeVisual: true,
    });
    const w = dom.window;
    w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    w.fetch = () => Promise.reject(new Error('offline'));
    for (const aset of ['assets/scroll-effects.js', 'assets/theme-contrast.js', 'assets/button-help.js']) {
      w.eval(fs.readFileSync(path.join(ROOT, aset), 'utf8'));   // meniru <script src>
    }
    w.eval('window.EMBEDDED_DATA=' + JSON.stringify({
      slug: 'demo', name1: 'Ahsan Bakti Setiawan', name2: '', theme: 0,
      data: {
        event: 'ultah', tpl: 'race-car', doa: 'ultah',
        form: { namaAnak: 'Ahsan Bakti Setiawan', temaUltah: '', usia: '',
                tanggalAcara: '2026-12-28', jamAcara: '08:00',
                venue: 'The Ballroom at Ritz Carlton', alamat: '', mapsLink: '', zona: 'WIB' },
        slides: {}, anim: { cover: true, text: true, reveal: true, effect: 'zoom', scroll: 'fade-up' },
      },
    }) + ';');
    for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);

    await new Promise(r => setTimeout(r, 900));   // boot() dijadwalkan 350 ms setelah muat

    const st = w.document.documentElement.style;
    const ambil = (v) => (st.getPropertyValue(v) || '').trim();
    console.log('  --ink         : ' + ambil('--ink') + '   (cover — sengaja tetap seperti tema)');
    console.log('  --ink-body    : ' + ambil('--ink-body') + '   (teks kartu konten)');
    console.log('  --accent-body : ' + ambil('--accent-body'));
    console.log('  --ink-fg      : ' + ambil('--ink-fg') + '   (teks di atas tombol cover)');

    cek(TC.normal(ambil('--ink')) === '#f0f0f0', 'cover tetap memakai ink tema (#F0F0F0)');
    cek(ambil('--ink-body') === '#26292e', 'teks konten memakai nada gelap tema Balap Mobil (#26292e)');
    cek(TC.kontras(ambil('--ink-body'), TC.KARTU) >= 4.5, 'teks konten hasil render terbaca (≥4.5:1)');
    cek(TC.kontras(ambil('--ink-fg'), ambil('--ink')) >= 3, 'teks tombol cover terbaca di atas ink tema');
    cek(/Ahsan Bakti Setiawan/.test(w.document.body.textContent), 'nama anak benar-benar dirender');
    cek(w.document.querySelectorAll('.name-big').length >= 1, 'kartu nama memakai .name-big');
    cek(TC.kontras(ambil('--accent-body'), TC.KARTU) >= 3, 'label accent konten terbaca (≥3:1)');

    const und = fs.readFileSync(path.join(ROOT, 'undangan.html'), 'utf8');
    cek(!/0\.03928/.test(und), 'rumus kontras tidak diduplikasi di undangan.html (satu sumber: aset)');
    dom.window.close();
  }

  /* ------------------------------- 6. file HTML mandiri dari tombol di Studio */
  console.log('\n6) Simpan File HTML di Studio (jsdom) — teks tetap terbaca offline');
  if (!JSDOM) {
    console.log('  (dilewati: jsdom belum terpasang)');
  } else {
    const dom2 = new JSDOM(fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8'), {
      url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true,
    });
    const w2 = dom2.window;
    w2.HTMLMediaElement.prototype.pause = () => {};
    w2.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w2.scrollTo = () => {};
    w2.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w2.eval(fs.readFileSync(path.join(ROOT, 'assets/scroll-effects.js'), 'utf8'));
    for (const tag of w2.document.querySelectorAll('script:not([src])')) w2.eval(tag.textContent);
    w2.startInvitation();

    let blob = null;
    let namaBerkas = null;
    w2.URL.createObjectURL = (b) => { blob = b; return 'blob:uji'; };
    w2.URL.revokeObjectURL = () => {};
    w2.fetch = (u) => {
      const url = String(u);
      if (url.indexOf('undangan.html') >= 0) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('<html><head></head><body>tamu</body></html>') });
      }
      if (url.indexOf('theme-contrast.js') >= 0) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(fs.readFileSync(path.join(ROOT, 'assets', 'theme-contrast.js'), 'utf8')) });
      }
      return Promise.reject(new Error('offline: ' + url));
    };
    const buatAsli = w2.document.createElement.bind(w2.document);
    w2.document.createElement = (tag) => {
      const el = buatAsli(tag);
      if (String(tag).toLowerCase() === 'a') el.click = () => { namaBerkas = el.download; };
      return el;
    };

    await w2.dlUndangan();
    await new Promise(r => setTimeout(r, 60));
    cek(!!blob, 'tombol Simpan File HTML tetap menghasilkan berkas (tidak putus)');
    cek(/^undangan-.*\.html$/.test(String(namaBerkas)), 'nama berkas unduhan wajar (' + namaBerkas + ')');
    if (blob && typeof blob.text === 'function') {
      const isi = await blob.text();
      cek(isi.includes('EMBEDDED_DATA'), 'data undangan tertanam di file ekspor');
      cek(isi.includes('window.AsThemeContrast'), 'aturan kontras tema ikut tersemat di file ekspor');
    }
    dom2.window.close();
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
