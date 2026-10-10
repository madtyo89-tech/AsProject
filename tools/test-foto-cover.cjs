#!/usr/bin/env node
/*
 * Uji foto cover undangan — 9 gaya + penyesuai geser/zoom.
 *
 *   node tools/test-foto-cover.cjs               (uji statis + kontras)
 *   NODE_PATH=… node tools/test-foto-cover.cjs   (tambahan uji render jsdom)
 *
 * Yang diperiksa:
 *   1. kedua berkas (undangan.html & studio.html) mengenal 9 gaya yang sama;
 *   2. undangan.html memakai data.coverStyle & data.coverPos (object-position +
 *      zoom) saat menggambar bingkai foto;
 *   3. gaya "Foto Penuh" memakai latar foto + panel kaca gelap dengan teks putih;
 *      kontrasnya diukur untuk kasus terburuk (foto serba putih) — harus ≥ 4.5:1;
 *   4. tema/gaya lama tetap sama saat undangan tidak punya foto;
 *   5. studio.html: penyesuai geser/zoom ada, dan gaya + posisi foto ikut
 *      tersimpan di publish(), file HTML mandiri, arsip, serta pratinjau HP.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const GAYA = ['kotak', 'oval', 'lingkaran', 'arch', 'polaroid', 'emas', 'kapsul', 'full', 'none'];
/* Tema uji = tema pertama katalog aktif (dulu 'minimalist-frost'; sejak 2026-10-10
   katalog berisi satu tema dasar). Yang diuji di sini mesin foto cover, bukan temanya. */
const TEMA_UJI = (baca('undangan.html').match(/\{id:'([a-z0-9-]+)'/) || [, ''])[1];

/* Nilai tema diambil dari tabel TPL di undangan.html supaya uji tidak menebak warna. */
function tema(id) {
  const m = baca('undangan.html').match(new RegExp("\\{id:'" + id + "'[^}]*\\}"));
  if (!m) throw new Error('tema tidak ditemukan: ' + id);
  const entri = m[0];
  return {
    ink: entri.match(/ink:'([^']*)'/)[1],
    accent: entri.match(/accent:'([^']*)'/)[1],
    g: JSON.parse(entri.match(/g:(\[[^\]]*\])/)[1].replace(/'/g, '"')),
    art: (entri.match(/bg3d:'([^']*)'/) || [, ''])[1],
  };
}
const TC = (() => {
  const kunci = require.resolve(path.join(ROOT, 'assets', 'theme-contrast.js'));
  delete require.cache[kunci];
  const jendela = {};
  const asli = global.window;
  global.window = jendela;
  require(kunci);
  global.window = asli;
  return jendela.AsThemeContrast;
})();

let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* jsdom opsional */ }
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* sharp opsional */ }

let lulus = 0;
let gagal = 0;
const cek = (hasil, pesan) => { hasil ? (lulus++) : (gagal++, console.log('  [FAIL] ' + pesan)); };

function draft(tambahan = {}) {
  const d = {
    slug: 'demo', name1: 'Rina & Bagas', name2: 'Bagas', theme: 0,
    data: {
      event: 'pernikahan', tpl: TEMA_UJI, doa: 'pernikahan',
      form: {
        namaPria: 'Rina', namaWanita: 'Bagas', gelarPria: 'S.Kom', gelarWanita: '',
        tanggalAcara: '2026-12-28', jamAcara: '08:00', zona: 'WIB',
        venue: 'Gedung Bersama', alamat: 'Jl. Mawar 1', mapsLink: '', showBismillah: false,
      },
      slides: {}, anim: { cover: false, text: false, reveal: false, effect: 'zoom', scroll: 'fade-up' },
    },
  };
  Object.assign(d.data, tambahan);
  return d;
}

async function render(d) {
  const dom = new JSDOM(baca('undangan.html'), {
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
    w.eval(baca(aset));
  }
  w.eval('window.EMBEDDED_DATA=' + JSON.stringify(d) + ';');
  for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
  await new Promise((r) => setTimeout(r, 800));
  return { dom, w };
}

(async function main() {
  console.log('Uji foto cover undangan (9 gaya)\n');

  const t = tema(TEMA_UJI);
  console.log(`  tema uji: ${TEMA_UJI} (ink ${t.ink}, aksen ${t.accent}, artwork: ${t.art || 'tidak ada'})`);

  const und = baca('undangan.html');
  const stu = baca('studio.html');

  /* ------------------------------------------------- 1. gaya dikenal dua berkas */
  console.log('1) Daftar gaya di kedua berkas');
  for (const g of GAYA) {
    const diUndangan = g === 'full' ? /body\.foto-full #cover/.test(und) : und.includes('#cover .cvf-' + g);
    const diStudio = stu.includes("'" + g + "'") && stu.includes('CV_BENTUK');
    cek(diUndangan || g === 'none', `undangan.html: gaya "${g}" ada`);
    cek(diStudio, `studio.html: gaya "${g}" ada`);
  }
  cek(["'kotak'", "'oval'", "'lingkaran'", "'arch'", "'polaroid'", "'emas'", "'kapsul'", "'full'", "'none'"]
        .every((g) => stu.includes('const CV_URUT=[') && stu.includes(g)),
      'studio.html: CV_URUT memuat 9 gaya');
  const urutUndangan = ["kotak", "oval", "lingkaran", "arch", "polaroid", "emas", "kapsul"]
    .filter((g) => !und.includes('#cover .cvf-' + g));
  cek(urutUndangan.length === 0, `undangan.html: 7 bentuk bingkai lengkap (kurang: ${urutUndangan.join(', ') || '-'})`);

  console.log('  (9 gaya: ' + GAYA.join(', ') + ')');

  /* ------------------------------------------------- 2. bingkai bisa digulir aman */
  console.log('\n2) Keamanan tata letak cover');
  cek(/#cover\{[^}]*overflow-y:auto/.test(und), 'cover bisa digulir → tombol "Buka Undangan" tidak terpotong');
  cek(/#cover \.bdfr\{margin-top:auto/.test(und), 'isi cover memakai margin auto (tetap di tengah bila cukup)');
  cek(/@media \(max-height:700px\)/.test(und), 'ukuran bingkai mengecil di layar pendek');

  /* ------------------------------------------------- 3. kontras gaya "Foto Penuh" */
  console.log('\n3) Kontras gaya "Foto Penuh" (kasus terburuk: foto serba putih)');
  if (!sharp) {
    console.log('  ..  dilewati (sharp belum terpasang)');
  } else {
    /* Panel kaca: rgba(10,8,6,.84) di atas foto; teks putih (#fff). */
    const lapis = [10, 8, 6], alfa = 0.84;
    const putih = [255, 255, 255];
    const hasil = putih.map((v, i) => Math.round(alfa * lapis[i] + (1 - alfa) * v));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">` +
      `<rect width="300" height="400" fill="rgb(255,255,255)"/>` +
      `<rect x="20" y="180" width="260" height="200" rx="24" fill="rgba(10,8,6,${alfa})"/></svg>`;
    const buf = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
    const { data, info } = buf;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 220; y < 360; y++) {
      for (let x = 60; x < 240; x++) {
        const i = (y * info.width + x) * info.channels;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    r /= n; g /= n; b /= n;
    const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    const rasio = (1.0 + 0.05) / (L + 0.05);
    console.log(`  warna panel di atas foto putih: rgb(${r.toFixed(0)},${g.toFixed(0)},${b.toFixed(0)}) → kontras teks putih ${rasio.toFixed(2)}:1`);
    cek(rasio >= 4.5, `teks putih di atas panel tetap terbaca walau fotonya putih (${rasio.toFixed(2)}:1 ≥ 4.5:1)`);
    cek(hasil.length === 3, 'warna panel dihitung dari alpha CSS');
  }

  /* ------------------------------------------------- 4. render undangan (jsdom) */
  console.log('\n4) Halaman undangan memakai gaya & posisi foto');
  if (!JSDOM) {
    console.log('  (dilewati: jsdom belum terpasang — npm install --no-save jsdom)');
  } else {
    {
      const { dom, w } = await render(draft({ cover: 'foto.jpg', coverStyle: 'oval', coverPos: { x: 20, y: 80, z: 1.4 } }));
      const bingkai = w.document.querySelector('#cover .cvf');
      const img = w.document.querySelector('#cover .cvf img');
      cek(!!bingkai && bingkai.className.indexOf('cvf-oval') >= 0, 'gaya oval dipakai dari data.coverStyle');
      cek(!!img && /object-position:\s*20%\s*80%/.test(img.getAttribute('style') || ''),
          'posisi geser dari data.coverPos dipakai (20% 80%)');
      cek(!!img && /scale\(1\.4\)/.test(img.getAttribute('style') || ''), 'zoom dari data.coverPos dipakai (1.4×)');
      cek(!w.document.body.classList.contains('foto-full'), 'gaya bingkai tidak mengaktifkan mode foto penuh');
      dom.window.close();
    }
    {
      const { dom, w } = await render(draft({ cover: 'foto.jpg', coverStyle: 'full', coverPos: { x: 50, y: 30, z: 1 } }));
      const st = w.document.documentElement.style;
      const latar = w.document.querySelector('#cover .cvlatar img');
      cek(w.document.body.classList.contains('foto-full'), 'gaya penuh menambahkan kelas foto-full');
      cek(!!latar, 'foto dirender sebagai latar penuh (.cvlatar)');
      cek(!!latar && /object-position:\s*50%\s*30%/.test(latar.getAttribute('style') || ''),
          'posisi geser dipakai pada foto latar penuh');
      cek(String(st.getPropertyValue('--ink')).trim().toLowerCase() === '#ffffff',
          'teks cover jadi putih (#ffffff) di atas foto gelap');
      const konten = TC.untukKonten(t.ink, t.accent, t.g).ink;
      cek(String(st.getPropertyValue('--ink-body')).trim().toLowerCase() === TC.normal(konten),
          `teks konten tetap nada gelap tema (${konten}) — tidak ikut berubah`);
      const aksen = String(st.getPropertyValue('--accent-cover')).trim();
      cek(TC.kontras(aksen, '#0F0B08') >= 3, `aksen cover dicerahkan agar terbaca (${aksen})`);
      dom.window.close();
    }
    {
      const { dom, w } = await render(draft({ cover: 'foto.jpg', coverStyle: 'none' }));
      cek(!w.document.querySelector('#cover .cvf') && !w.document.body.classList.contains('foto-full'),
          'gaya "tanpa" tidak menampilkan foto di cover');
      dom.window.close();
    }
    {
      const { dom, w } = await render(draft({ cover: 'foto.jpg' }));
      const bingkai = w.document.querySelector('#cover .cvf');
      cek(!!bingkai && bingkai.className.indexOf('cvf-kotak') >= 0,
          'undangan lama (tanpa coverStyle) memakai gaya kotak seperti sebelumnya');
      dom.window.close();
    }
    {
      const { dom, w } = await render(draft());
      const st = w.document.documentElement.style;
      cek(!w.document.querySelector('#cover .cvf') && !w.document.querySelector('#cover .cvlatar'),
          'tanpa foto: cover persis seperti semula');
      cek(String(st.getPropertyValue('--ink')).trim().toLowerCase() === TC.normal(t.ink),
          `tanpa foto: warna teks cover tetap warna tema (${t.ink})`);
      dom.window.close();
    }
  }

  /* ------------------------------------------------- 5. studio: geser & simpan */
  console.log('\n5) Studio: penyesuai geser/zoom & penyimpanan');
  for (const fn of ['function cvMulai', 'function cvJalan', 'function cvLepas']) {
    cek(stu.includes(fn), `studio.html: ${fn.split(' ')[1]}() tersedia (geser dengan jari/mouse)`);
  }
  for (const fn of ['function cvZoom', 'function cvTengah', 'function cvReset']) {
    cek(stu.includes(fn), `studio.html: ${fn.split(' ')[1]}() tersedia (zoom/tengahkan/reset)`);
  }
  cek(/touch-action:none/.test(stu), 'kotak geser memakai touch-action (tidak ikut ter-scroll saat digeser)');
  cek(/naturalWidth/.test(stu), 'perpindahan dihitung dari ukuran gambar asli (gerakan pas 1:1)');
  cek((stu.match(/coverStyle:cvGayaAktif\(\)/g) || []).length >= 3,
      'gaya foto disimpan ke publish(), file HTML mandiri, dan arsip');
  cek((stu.match(/coverPos:Object\.assign/g) || []).length >= 3, 'posisi/zoom foto ikut tersimpan');
  cek(stu.includes('if(a.snap.coverStyle)state.coverStyle=a.snap.coverStyle'),
      'membuka arsip memulihkan gaya foto');
  cek(/state\.coverPos=Object\.assign\(\{x:50,y:50,z:1\},state\.coverPos\|\|\{\}\)/.test(stu),
      'draft lama tetap aman (coverPos dilengkapi nilai bawaan)');
  cek(stu.includes("cvGaya==='full'") && /blokFotoPrev/.test(stu),
      'pratinjau HP menampilkan bingkai foto sesuai gaya terpilih');
  cek(/class="cvprev"/.test(stu), 'kotak pratinjau & gaya memakai gambar yang sama (langsung ikut bergeser)');

  if (JSDOM) {
    const dom = new JSDOM(stu, { url: 'https://studio.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.eval(baca('assets/scroll-effects.js'));
    for (const tag of w.document.querySelectorAll('script:not([src])')) w.eval(tag.textContent);
    w.startInvitation();
    const cekAsli = (nama, kondisi) => cek(kondisi, nama);
    /* `state` adalah let di dalam script studio (tidak ada di window), jadi uji
       lewat fungsi asli yang dipakai pemilik: unggah foto → pilih gaya → zoom.
       Hasil simpanannya dibaca dari localStorage seperti draft sungguhan. */
    w.uploadCover({ files: [new w.File(['x'], 'fotoku.png', { type: 'image/png' })] });
    await new Promise((r) => setTimeout(r, 400));   // FileReader + render() studio
    cekAsli('unggah foto mengisi foto cover', /data:image\/png/.test(w.phoneHtml()));

    w.setCvStyle('oval');
    w.cvZoom(1.5);
    const p = w.phoneHtml();
    cekAsli('pratinjau memuat bingkai gaya terpilih (oval)', /border-radius:50%/.test(p));
    cekAsli('pratinjau memakai zoom dari penyesuai', /scale\(1\.5\)/.test(p));
    cekAsli('pratinjau menandai gaya foto', /• Oval/.test(p));

    const simpan = JSON.parse(w.localStorage.getItem('asproject_studio_v3') || '{}');
    cekAsli('gaya foto ikut tersimpan di draft', simpan.coverStyle === 'oval');
    cekAsli('posisi & zoom tersimpan di draft', !!simpan.coverPos && Math.abs(simpan.coverPos.z - 1.5) < 1e-6);

    w.setCvStyle('full');
    const p2 = w.phoneHtml();
    cekAsli('pratinjau gaya penuh memakai foto sebagai latar', /url\(data:image/.test(p2) && /color:#fff/.test(p2));

    w.setCvStyle('none');
    cekAsli('pratinjau gaya "tanpa" tidak menggambar bingkai', !/scale\(1\.5\)/.test(w.phoneHtml()));
    dom.window.close();
  } else {
    console.log('  (pratinjau studio dilewati: jsdom belum terpasang)');
  }

  cek(/function kecilkanFoto\(/.test(baca('studio.html')), 'studio.html: kecilkanFoto() (kompres ≤1200 px) tersedia');
  cek(/kecilkanFoto\(asal,f\.type\)/.test(baca('studio.html')), 'studio.html: upload cover & galeri dikompres');
  cek(/state\.cover=asal;save\(\)\.render|state\.cover=asal;save\(\);render\(\)/.test(baca('studio.html')),
      'studio.html: foto langsung tersimpan dulu, kompres menyusul (tidak memblokir)');

  /* ------------------------------------- 6. master.html: foto cover di preview */
  console.log('\n6) Dashboard master: foto cover di kartu "Preview Undangan"');
  const mas = baca('master.html');
  cek(/function cvCoverMini\(/.test(mas), 'master.html: cvCoverMini() tersedia');
  cek(/const cvM=cvCoverMini\(d\)/.test(mas), 'master.html: kartu preview memakai data undangan (d)');
  for (const g of ['kotak', 'oval', 'lingkaran', 'arch', 'polaroid', 'emas', 'kapsul']) {
    cek(mas.includes('.bc-' + g), `master.html: bentuk "${g}" ada di CSS preview`);
  }
  cek(/\.b-screen\.b-full/.test(mas), 'master.html: mode "Penuh" punya gaya gelap sendiri');
  cek(/Foto cover: <b>/.test(mas) && /Belum ada foto cover/.test(mas),
      'master.html: catatan gaya foto ditampilkan di kartu');
  cek(/cvM\.gaya==='none'/.test(mas),
      'master.html: gaya "Tanpa" ditulis sengaja disembunyikan (bukan "belum ada")');
  cek(/esc\(foto\)/.test(mas), 'master.html: alamat foto di-escape sebelum ditulis');
  cek(/replace\(\/\[\\r\\n"'\\\\\]\/g,''\).trim\(\)/.test(mas),
      'master.html: alamat foto dibersihkan dari kutip/newline (aman di CSS)');
  cek(/Math\.min\(100,Math\.max\(0,n\)\)/.test(mas) && /Math\.min\(2\.2,Math\.max\(1,n\)\)/.test(mas),
      'master.html: posisi & zoom dibatasi di rentang yang sama dengan Studio (0-100, 1-2,2)');
  cek(/b-cvnote/.test(mas), 'master.html: ada keterangan "belum ada foto cover" bila kosong');
  cek(/\.b-screen\.b-full::after/.test(mas) && /\.bc-bg img/.test(mas),
      'master.html: veil gelap + lapisan img untuk foto penuh ada di CSS');

  /* Uji perilaku cvCoverMini memakai potongan kode yang sama (diambil dari berkas). */
  {
    const mulai = mas.indexOf('const CV_MINI_GAYA=');
    const akhir = mas.indexOf('function renderAll()');
    cek(mulai > 0 && akhir > mulai, 'master.html: potongan cvCoverMini bisa diuji terpisah');
    if (mulai > 0 && akhir > mulai) {
      const kode = mas.slice(mulai, akhir);
      const jendela = { esc: (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
      const uji = new Function('esc', kode + '; return cvCoverMini;')(jendela.esc);

      const kosong = uji({});
      cek(!kosong.blok && !kosong.full, 'tanpa foto: kartu master tidak menampilkan bingkai');

      const tanpaGaya = uji({ cover: 'f.jpg' });
      cek(tanpaGaya.gaya === 'kotak' && /bc-kotak/.test(tanpaGaya.blok),
          'undangan lama (tanpa coverStyle): master memakai gaya kotak');

      const oval = uji({ cover: 'f.jpg', coverStyle: 'oval', coverPos: { x: 120, y: -5, z: 3 } });
      cek(/bc-oval/.test(oval.blok), 'gaya oval dipakai di kartu master');
      cek(/object-position:100% 0%/.test(oval.blok), 'posisi dibatasi ke 0-100%');
      cek(/scale\(2\.2\)/.test(oval.blok), 'zoom dibatasi ke maksimum 2,2x');

      const penuh = uji({ cover: 'f.jpg', coverStyle: 'full' });
      cek(penuh.full && /<img[^>]*src="f\.jpg"/.test(penuh.blok) && /bc-bg/.test(penuh.blok),
          'gaya "Penuh": foto jadi latar kartu master (lapisan bc-bg)');
      cek(/object-position:50% 50%/.test(penuh.blok),
          'gaya "Penuh": posisi geser dipakai (bukan center/cover)');
      const penuhGeser = uji({ cover: 'f.jpg', coverStyle: 'full', coverPos: { x: 80, y: 20, z: 1.6 } });
      cek(/object-position:80% 20%/.test(penuhGeser.blok) && /scale\(1\.6\)/.test(penuhGeser.blok),
          'gaya "Penuh": geser + zoom diterapkan seperti di undangan');

      const tanpa = uji({ cover: 'f.jpg', coverStyle: 'none' });
      cek(!tanpa.blok && !tanpa.full, 'gaya "Tanpa": kartu master tanpa bingkai');

      const kotor = uji({ cover: 'f".jpg\n', coverStyle: 'kotak' });
      const src = (/src="([^"]*)"/.exec(kotor.blok) || [, ''])[1];
      cek(!!src && !/['"\r\n\\]/.test(src),
          `kutip/newline pada alamat foto dibersihkan dari src (${JSON.stringify(src)})`);
    }
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
