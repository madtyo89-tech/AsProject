#!/usr/bin/env node
/*
 * Uji kelengkapan: animasi baru, border sudut 2D/3D/4D, preferensi tambahan,
 * dan galeri foto sebagai slider dengan 6 efek.
 *
 *   node tools/test-lengkap.cjs
 *
 * Yang diperiksa:
 *   1. mesin: 44 efek gulir (+10 baru) & 20 efek pembuka (+6 baru), semua punya
 *      selektor & keyframes di aset bersama / blok cover kedua berkas
 *   2. border: 49 border, 9 di antaranya sudut 2D/3D/4D, keyframes 4D ada di kedua
 *      berkas dan dimatikan saat tamu memilih kurangi gerakan
 *   3. preferensi: 8 pilihan di Studio, ikut tersimpan di 3 jalur snapshot,
 *      dan dinormalkan saat koleksi lama dimuat
 *   4. galeri: galHtml identik di studio.html & undangan.html, meng-escape URL,
 *      dan 6 efek slider punya keyframes sendiri
 *   5. jsdom undangan.html: preferensi benar-benar berlaku (gerak, musik, sapaan,
 *      tanda, tombol ke atas, hitungan ringkas) dan galeri jadi slider
 *   6. jsdom undangan.html tanpa pref: tampilan lama persis (grid, 4 kotak, sapaan ada)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let lulus = 0, gagal = 0;
const cek = (syarat, pesan, info) => {
  if (syarat) { lulus++; console.log('  ok  ' + pesan); }
  else { gagal++; console.log('  [FAIL] ' + pesan + (info ? ' → ' + info : '')); }
};

const STUDIO = baca('studio.html'), UNDANGAN = baca('undangan.html'), KANVAS = baca('kanvas.html');
const ASET = baca('assets/scroll-effects.css');

const FX_SCROLL_BARU = ['zoom-rotate', 'stretch-up', 'slide-diagonal', 'flip-x-3d', 'mask-left',
  'blur-scale', 'bounce-down', 'swirl', 'ketik', 'fokus'];
const FX_COVER_BARU = ['unveil', 'slide-diagonal', 'zoom-rotasi', 'sparkle', 'wave-in', 'tilt-in'];
const BORDER_404 = {
  '2D': ['sudut-2d-garis', 'sudut-2d-blok', 'sudut-2d-lengkung'],
  '3D': ['sudut-3d-timbul', 'sudut-3d-berlapis', 'sudut-3d-kaca'],
  '4D': ['sudut-4d-kilau', 'sudut-4d-mengalir', 'sudut-4d-denjut']
};
const GAL_FX = ['grid', 'slide', 'fade', 'zoom', 'cube', 'coverflow', 'flip'];
const PREF_KEYS = ['gerak', 'musik', 'sapaan', 'tanda', 'tombolAtas', 'hitung', 'slider', 'sliderDetik'];

const blokArr = (teks, nama) => {
  /* mulai dari deklarasi di awal baris: nama serupa bisa muncul di dalam teks/ekspor */
  const i = teks.search(new RegExp('(?:^|\\n)const ' + nama.replace(/[$]/g, '\\$') + '='));
  const b = teks.indexOf('[', i);
  let d = 0, k = b;
  while (k < teks.length) {
    const c = teks[k];
    if (c === "'" || c === '"' || c === '`') {
      k++;
      while (k < teks.length) { if (teks[k] === '\\') { k += 2; continue } if (teks[k] === c) break; k++ }
    } else if (c === '[' || c === '{') d++;
    else if (c === ']' || c === '}') { d--; if (d === 0) break }
    k++;
  }
  return teks.slice(b + 1, k);
};
const idArr = (b) => (b.match(/'([a-z0-9-]+)'/g) || []).map((x) => x.replace(/'/g, ''));
const idObjek = (b) => (b.match(/\{id:'([^']+)'/g) || []).map((x) => x.replace(/^.*:\s*'/, '').replace(/'$/, ''));
const barisFx = (teks, nama) => (blokArr(teks, nama).match(/\[\s*'([a-z0-9-]+)'\s*,/g) || []).map((x) => x.replace(/[\[\]'\s,]/g, ''));
const prefMesin = (teks) => {
  const i = teks.indexOf('const PREF_BAWAAN={');
  const b = teks.indexOf('{', i);
  return (teks.slice(b, teks.indexOf('}', b)).match(/([a-zA-Z]+):/g) || []).map((x) => x.replace(':', ''));
};

console.log('\n1) Animasi baru (efek gulir & efek pembuka)');
{
  const sc = barisFx(STUDIO, 'FX_SCROLL'), co = barisFx(STUDIO, 'FX_COVER');
  cek(sc.length === 44, 'studio.html: 44 efek gulir', String(sc.length));
  cek(JSON.stringify(sc) === JSON.stringify(barisFx(UNDANGAN, 'FX_SCROLL')), 'daftar efek gulir sama & berurutan di dua berkas');
  cek(JSON.stringify(co) === JSON.stringify(barisFx(UNDANGAN, 'FX_COVER')), 'daftar efek pembuka sama & berurutan di dua berkas');
  cek(FX_SCROLL_BARU.every((f) => sc.includes(f)), '10 efek gulir baru terdaftar', FX_SCROLL_BARU.filter((f) => !sc.includes(f)).join(','));
  cek(FX_COVER_BARU.every((f) => co.includes(f)), '6 efek pembuka baru terdaftar', FX_COVER_BARU.filter((f) => !co.includes(f)).join(','));
  const kurangAset = FX_SCROLL_BARU.filter((f) => !ASET.includes('.scroll-reveal.fx-s-' + f + '{') || !ASET.includes('@keyframes sr-' + f + '{'));
  cek(kurangAset.length === 0, 'aset bersama punya selektor + keyframes untuk setiap efek gulir baru', kurangAset.join(','));
  const kurangCss = FX_COVER_BARU.filter((f) => !STUDIO.includes('.cov .fx-c-' + f + '{') || !UNDANGAN.includes('.cov .fx-c-' + f + '{'));
  cek(kurangCss.length === 0, 'efek pembuka baru punya aturan animasi di studio.html & undangan.html', kurangCss.join(','));
}

console.log('\n2) Border sudut 2D / 3D / 4D');
{
  const bs = idObjek(blokArr(STUDIO, 'BORDERS')), bu = idObjek(blokArr(UNDANGAN, 'BORDERS'));
  cek(bs.length === 49, 'studio.html: 49 border', String(bs.length));
  cek(JSON.stringify(bs) === JSON.stringify(bu), 'urutan id border identik di dua berkas');
  const semua = [].concat(BORDER_404['2D'], BORDER_404['3D'], BORDER_404['4D']);
  cek(semua.every((b) => bs.includes(b)), '9 border sudut 2D/3D/4D terdaftar', semua.filter((b) => !bs.includes(b)).join(','));
  cek(bs.indexOf('sudut-2d-garis') > bs.indexOf('triple-frame'), 'border baru ditambahkan di akhir (urutan lama tidak bergeser)');
  const kf = ['bdKilau', 'bdAlir', 'bdDenjut'];
  cek(kf.every((k) => STUDIO.includes('@keyframes ' + k) && UNDANGAN.includes('@keyframes ' + k)), 'keyframes animasi 4D ada di kedua berkas', kf.join(','));
  cek(STUDIO.includes('prefers-reduced-motion:reduce){.bdfr{animation:none') && UNDANGAN.includes('prefers-reduced-motion:reduce){.bdfr{animation:none'),
    'animasi border 4D dimatikan saat tamu memilih kurangi gerakan');
  cek(/--bdA:/.test(STUDIO) && /--bdA:/.test(UNDANGAN), 'border 4D memakai variabel warna tema (--bdA/--bdB)');
  const artDipakai = (STUDIO.match(/art:'([a-z]+)'/g) || []).map((x) => x.replace(/art:'|'/g, ''));
  const dko = idArr(blokArr(STUDIO, 'DKO_IDS'));
  cek(artDipakai.every((a) => dko.includes(a)), 'hiasan sudut pada border baru memakai id yang sah');
}

console.log('\n3) Preferensi tambahan (Studio)');
{
  const kunci = prefMesin(STUDIO);
  cek(PREF_KEYS.every((k) => kunci.includes(k)), 'PREF_BAWAAN memuat 8 pilihan', kunci.join(','));
  const uiKurang = PREF_KEYS.filter((k) => !new RegExp("setPref\\('" + k + "'").test(STUDIO));
  cek(uiKurang.length === 0, 'kartu Preferensi Tambahan punya pengatur untuk setiap pilihan', uiKurang.join(','));
  cek(STUDIO.includes('⚙️ Preferensi Tambahan'), 'kartu preferensi tampil di tab Desain');
  cek((STUDIO.match(/pref:Object\.assign\(\{\},state\.pref\)/g) || []).length >= 3,
    'pref ikut tersimpan di publish, arsip, dan ekspor mandiri',
    String((STUDIO.match(/pref:Object\.assign\(\{\},state\.pref\)/g) || []).length));
  cek(STUDIO.includes('state.pref=prefOf(state)'), 'koleksi lama tanpa pref otomatis dinormalkan saat dimuat');
  cek(STUDIO.includes('state.pref.slider') && STUDIO.includes('galHtml(state.gallery'), 'pratinjau HP memakai galeri slider & pengaturannya');
  cek(!/state\.pref\.\w+===undefined/.test(STUDIO), 'tidak ada pembacaan pref yang bisa meleset ke undefined');
}

console.log('\n4) Galeri sebagai slider (6 efek)');
{
  const iS = STUDIO.indexOf('function galHtml('), iU = UNDANGAN.indexOf('function galHtml(');
  cek(iS > 0 && iU > 0, 'galHtml ada di kedua berkas');
  const ambil = (s, i) => s.slice(i, s.indexOf('\n}', i) + 2);
  cek(ambil(STUDIO, iS) === ambil(UNDANGAN, iU), 'isi galHtml identik (pratinjau = halaman tamu)');
  const gal = ambil(STUDIO, iS);
  cek(/esc\(u\)/.test(gal), 'tautan foto di-escape sebelum masuk HTML');
  cek(/const GAL_FX=\[\s*'grid',/.test(STUDIO) && GAL_FX.slice(1).every((g) => STUDIO.includes('fx-gal-' + g)), 'tujuh gaya galeri (grid + 6 slider) tersedia',
    GAL_FX.slice(1).filter((g) => !STUDIO.includes('fx-gal-' + g)).join(','));
  const kf = ['galTampil', 'galSlide', 'galFade', 'galZoom', 'galCube', 'galCover', 'galFlip'];
  cek(kf.every((k) => UNDANGAN.includes('@keyframes ' + k) && STUDIO.includes('@keyframes ' + k)), 'keyframes tiap efek slider ada di kedua berkas', kf.filter((k) => !UNDANGAN.includes('@keyframes ' + k)).join(','));
  cek(/prefers-reduced-motion:reduce\)\{\.gal\.gal-slider img\{animation:none/.test(UNDANGAN), 'slider berhenti otomatis saat tamu memilih kurangi gerakan');
  cek(/\.gal\.gal-slider img:first-child\{opacity:1\}/.test(UNDANGAN), 'bila animasi dimatikan, foto pertama tetap terlihat');
  cek(!/galeri[^\n]*<script/.test(UNDANGAN), 'slider berjalan tanpa skrip tambahan (aman di ekspor mandiri)');
}

/* ---------------- pemuat jsdom undangan ---------------- */
function bukaUndangan(ubah) {
  const galat = [];
  let html = UNDANGAN;
  for (const f of ['assets/theme-contrast.js', 'assets/scroll-effects.js', 'assets/button-help.js']) {
    html = html.replace('<script src="' + f + '"></script>', '<script>' + baca(f) + '</scr' + 'ipt>');
  }
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/navigation|Not implemented|Could not parse CSS/i.test(e.message)) galat.push(e.message) });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    url: 'https://asproject.my.id/undangan.html?demo=1&to=Bapak%20Budi'
  });
  const w = dom.window;
  return new Promise((selesai) => {
    setTimeout(() => {
      const draft = JSON.parse(w.eval('JSON.stringify(DEMO_DRAFT)'));
      draft.data.gallery = ['assets/demo/wedding/01-jawa-elegan.jpg', 'assets/demo/ice-blue/01-prewedding-pantai.jpg', 'assets/demo/wedding/04-floral-rustic.jpg'];
      if (ubah) ubah(draft);
      w.boot(draft);
      setTimeout(() => selesai({
        w, d: w.document, galat,
        html: w.document.querySelector('#app').innerHTML,
        tutup: () => w.close()
      }), 420);
    }, 520);
  });
}

(async () => {
  console.log('\n5) undangan.html: preferensi berlaku (jsdom)');
  {
    const { w, d, html, galat, tutup } = await bukaUndangan((draft) => {
      draft.data.pref = { gerak: 'kurangi', musik: 'mati', sapaan: false, tombolAtas: true, tanda: false, hitung: 'ringkas', slider: 'cube', sliderDetik: 4 };
    });
    cek(galat.length === 0, 'halaman tidak melaporkan galat skrip', galat.join(' | ').slice(0, 160));
    cek(/kurangi-gerak/.test(d.documentElement.className), 'gerak "kurangi" menandai halaman (aman untuk aksesibilitas)');
    cek(!/Kepada YTH/.test(html), 'sapaan tamu disembunyikan bila diminta');
    cek(!!d.querySelector('.brand') && d.querySelector('.brand').style.display === 'none', 'tanda AsProject disembunyikan bila diminta');
    cek(!!d.querySelector('.ke-atas'), 'tombol kembali ke atas muncul bila diminta');
    cek(/cdw cdw-ringkas/.test(html), 'hitungan hari mode ringkas dipakai');
    cek(/body\.hitung-ringkas #cd \.u:nth-child\(3\)/.test(UNDANGAN), 'CSS menyembunyikan kotak menit & detik pada mode ringkas');
    const gal = html.match(/<div class="gal gal-slider fx-gal-([a-z]+)" style="--gal-J:(\d+)s;--gal-T:([\d.]+)s">/);
    cek(!!gal && gal[1] === 'cube', 'galeri memakai efek slider pilihan pemilik', gal ? gal[1] : 'tanpa galeri');
    cek(!!gal && gal[2] === '4' && gal[3] === '12.0', 'jeda 4 detik × 3 foto = siklus 12 detik', gal ? gal[2] + 's / ' + gal[3] + 's' : '-');
    cek((html.match(/alt="Foto \d+"/g) || []).length === 3, 'ketiga foto masuk slider', String((html.match(/alt="Foto \d+"/g) || []).length));
    cek((html.match(/<i><\/i>/g) || []).length === 3, 'titik penanda jumlah foto ikut dirender');
    tutup();
  }

  console.log('\n5b) nilai preferensi aneh diabaikan (jsdom)');
  {
    const { d, html, tutup } = await bukaUndangan((draft) => {
      draft.data.pref = { slider: 'ngawur', sliderDetik: 99, gerak: 'x', musik: 'y', hitung: 'z', sapaan: 'entah' };
    });
    cek(!/gal-slider/.test(html) && /class="gal"/.test(html), 'efek galeri tak dikenal jatuh ke susunan grid');
    cek(!/kurangi-gerak/.test(d.documentElement.className), 'nilai gerak tak dikenal jatuh ke animasi penuh');
    cek(!/cdw-ringkas/.test(html), 'mode hitungan tak dikenal jatuh ke 4 kotak');
    cek(/Kepada YTH/.test(html), 'sapaan tidak ikut hilang karena nilai aneh');
    tutup();
  }

  console.log('\n6) undangan.html tanpa preferensi: tampilan lama utuh (jsdom)');
  {
    const { d, html, tutup } = await bukaUndangan();
    cek(!d.documentElement.className, 'tidak ada kelas pengurang gerak', JSON.stringify(d.documentElement.className));
    cek(/Kepada YTH/.test(html), 'sapaan tamu tetap tampil');
    cek(!d.querySelector('.ke-atas'), 'tidak ada tombol tambahan yang tak diminta');
    cek(/class="gal"/.test(html) && !/gal-slider/.test(html), 'galeri tetap berupa susunan grid seperti semula');
    cek(/class="cdw" id="cd"/.test(html) && !/cdw-ringkas/.test(html), 'hitungan hari tetap 4 kotak');
    cek((html.match(/alt="Galeri"/g) || []).length === 3, 'foto galeri tetap tampil', String((html.match(/alt="Galeri"/g) || []).length));
    tutup();
  }

  console.log('\n7) Berkas turunan (Studio Template & Kanvas) tetap sinkron');
  {
    const ts = baca('template-studio.html');
    cek(ts.includes('MESIN (SALINAN PERSIS dari studio.html'), 'template-studio.html: blok mesin bertanda');
    cek(idObjek(blokArr(ts, 'BORDERS')).length === 49, 'template-studio.html: 49 border ikut tersalin', String(idObjek(blokArr(ts, 'BORDERS')).length));
    for (const namaFx of ['FX_SCROLL', 'FX_COVER']) {
      cek(barisFx(ts, namaFx).length === barisFx(STUDIO, namaFx).length, 'template-studio.html: ' + namaFx + ' ikut tersalin (' + barisFx(ts, namaFx).length + ')');
    }
    /* kanvas tidak memakai border katalog, tapi ia memakai ornamen & hiasan mesin */
    cek(KANVAS.includes('MESIN (SALINAN PERSIS dari studio.html'), 'kanvas.html: blok mesin bertanda');
    cek(idObjek(blokArr(KANVAS, 'FONTS')).length === 17 && idArr(blokArr(KANVAS, 'DKO_IDS')).length === 6 && idArr(blokArr(KANVAS, 'FLT_IDS')).length === 6,
      'kanvas.html: font & hiasan ikut mesin');
    const literal = (teks, nama) => {
      const i = teks.search(new RegExp('(?:^|\\n)const ' + nama + '='));
      const b = teks.indexOf('{', i);
      let d = 0, k = b;
      while (k < teks.length) {
        const c = teks[k];
        if (c === "'" || c === '"' || c === '`') { const q = c; k++; while (k < teks.length) { if (teks[k] === '\\') { k += 2; continue } if (teks[k] === q) break; k++ } }
        else if (c === '{' || c === '[') d++;
        else if (c === '}' || c === ']') { d--; if (!d) break }
        k++;
      }
      return teks.slice(b, k + 1);
    };
    const orn = literal(KANVAS, 'DEKO_BENTUK');
    cek(orn === literal(STUDIO, 'DEKO_BENTUK'), 'kanvas.html: bentuk ornamen identik dengan mesin',
      (orn.match(/[a-z]+:'<svg/g) || []).length + ' vs ' + (literal(STUDIO, 'DEKO_BENTUK').match(/[a-z]+:'<svg/g) || []).length);
    cek(KANVAS.includes("function artHias(") && KANVAS.includes('artDekoDiv'), 'kanvas.html: hiasan sudut & pembatas tersedia');
    const skrip = baca('tools/sinkron-studio-template.py');
    cek(skrip.includes('def sinkron_kanvas') && skrip.includes('def sinkron_template_studio'), 'skrip sinkronisasi menjaga kedua halaman turunan');
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
