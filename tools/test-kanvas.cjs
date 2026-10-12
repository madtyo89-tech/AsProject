#!/usr/bin/env node
/*
 * Uji Kanvas Template (kanvas.html) — kanvas kosong gaya Canva.
 *
 *   node tools/test-kanvas.cjs
 *
 * Yang diperiksa:
 *   1. halaman memuat tanpa galat & mesin (font/motif/ornamen/hiasan/bagian undangan)
 *      sama dengan studio.html
 *   2. kanvas benar-benar KOSONG saat pertama dibuka (elemen 0, ukuran 900×1200)
 *   3. menambah teks/bentuk/garis/ornamen/hiasan/gambar masuk ke kanvas
 *   4. geser, snap ke tengah kanvas, ubah ukuran, putar, panel properti, duplikat,
 *      urutan lapisan, kunci, sembunyikan, hapus, undo/redo, pintasan papan tik
 *   5. simpan ke localStorage & muat ulang (round-trip lewat beforeParse)
 *   6. ekspor HTML mandiri & SVG: isi ikut, teks di-escape, warna/URL tidak aman dibuang
 *   7. Jadikan tema: id font/motif/border/hiasan/bagian semua dikenal mesin katalog
 *      dan teks tema tetap aman dibaca (kontras ≥ 4.5:1)
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

/* ---- pembaca daftar dari berkas mesin (sama seperti uji dekorasi) ---- */
function akhirBlok(teks, buka) {
  let d = 0, i = buka;
  while (i < teks.length) {
    const c = teks[i];
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < teks.length) {
        if (teks[i] === '\\') { i += 2; continue; }
        if (teks[i] === c) break;
        i++;
      }
    } else if (c === '[' || c === '{') d++;
    else if (c === ']' || c === '}') { d--; if (d === 0) return i; }
    i++;
  }
  return -1;
}
const blok = (teks, pembuka) => {
  const i = teks.indexOf(pembuka);
  if (i < 0) return '';
  const b = teks.indexOf('[', i);
  return teks.slice(b + 1, akhirBlok(teks, b));
};
const blokPeta = (teks, pembuka) => {
  const i = teks.indexOf(pembuka);
  if (i < 0) return '';
  const b = teks.indexOf('{', i);
  return teks.slice(b + 1, akhirBlok(teks, b));
};
const idArr = (b) => (b.match(/'([a-z0-9-]+)'/g) || []).map((x) => x.replace(/'/g, ''));
const idObjek = (b) => (b.match(/\{\s*(?:id|n)\s*:\s*'([^']+)'/g) || []).map((x) => x.replace(/^.*:\s*'/, '').replace(/'$/, ''));
const daftar = (teks, nama) => idArr(blok(teks, 'const ' + nama + '=['));
const isiObjek = (teks, nama) => (blokPeta(teks, 'const ' + nama + '=').match(/([a-z][a-z-]*)\s*:/g) || []).map((x) => x.replace(/[\s:]/g, ''));

const studio = baca('studio.html');
const kanvas = baca('kanvas.html');
const FONT_MESIN = idObjek(blok(studio, 'const FONTS=['));
const BORDER_MESIN = idObjek(blok(studio, 'const BORDERS=['));
const SLIDE_MESIN = idObjek(blok(studio, 'const SLIDES=['));
const DKO_MESIN = daftar(studio, 'DKO_IDS'), FLT_MESIN = daftar(studio, 'FLT_IDS'), DVD_MESIN = daftar(studio, 'DVD_IDS');
const MOTIF_MESIN = (studio.match(/t\.pat==='([a-z]+)'/g) || []).map((x) => x.replace(/t\.pat==='|'/g, ''));

/* ---- pemuat jsdom (aset di-inline; jsdom tidak mengambil berkas apa pun) ---- */
function bukaKanvas(seed) {
  const galat = [];
  let html = kanvas;
  for (const f of ['assets/theme-contrast.js', 'assets/button-help.js']) {
    html = html.replace('<script src="' + f + '"></script>', '<script>' + baca(f) + '</scr' + 'ipt>');
  }
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/navigation|Not implemented/i.test(e.message)) galat.push(e.message); });
  vc.on('error', (m) => galat.push('console.error: ' + m));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://asproject.my.id/kanvas.html', virtualConsole: vc,
    beforeParse(w) { if (seed) w.localStorage.setItem(seed.k, seed.v); }
  });
  return { w: dom.window, d: dom.window.document, galat, dom };
}
const mouse = (w, jenis, x, y, lebih) => new w.MouseEvent(jenis, Object.assign({ clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: 1 }, lebih || {}));
const key = (w, k, lebih) => w.document.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, lebih || {})));

console.log('\n1) Halaman & mesin');
{
  const { w, d, galat } = bukaKanvas();
  cek(galat.length === 0, 'kanvas.html dimuat tanpa galat skrip', galat.join(' | ').slice(0, 200));
  cek(d.querySelectorAll('#rail .railb').length === 5, 'rel kiri punya 5 tab (elemen/teks/latar/ornamen/gambar)', String(d.querySelectorAll('#rail .railb').length));
  cek(!!d.querySelector('#kanvas') && !!d.querySelector('#lapis') && !!d.querySelector('#panel'), 'panggung, lapis bantu, dan panel ada');
  cek(w.eval('FONTS.length') === FONT_MESIN.length, 'daftar font sama dengan studio.html (' + FONT_MESIN.length + ')', String(w.eval('FONTS.length')));
  cek(w.eval('FONTS.map(f=>f.id).join(",")') === FONT_MESIN.join(','), 'urutan id font sama dengan studio.html');
  cek(w.eval('PAT_IDS.join(",")') === ['', ...MOTIF_MESIN].join(','), 'daftar motif sama dengan patCss studio.html', w.eval('PAT_IDS.join(",")'));
  cek(w.eval('Object.keys(DEKO_BENTUK).join(",")') === isiObjek(studio, 'DEKO_BENTUK').join(','), 'bentuk ornamen sama dengan studio.html');
  cek(w.eval('JENIS_HIAS.join(",")') === ['floral', 'batik', 'vine', 'gold', 'lace', 'ribbon', 'line', 'diamond'].filter((k) => studio.includes("kind==='" + k + "'")).join(','), 'hiasan sudut sama dengan artDekoSudut()', w.eval('JENIS_HIAS.join(",")'));
  cek(w.eval('SLIDES.map(s=>s.id).join(",")') === SLIDE_MESIN.join(','), 'daftar bagian undangan sama dengan studio.html');
  cek(kanvas.indexOf('MESIN (SALINAN PERSIS dari studio.html') > 0, 'blok mesin ditandai jelas di berkas (bisa disinkronkan ulang)');
  const asetRujuk = Array.from(new Set((kanvas.match(/assets\/[A-Za-z0-9._\/-]+/g) || [])));
  const asetHilang = asetRujuk.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  cek(asetHilang.length === 0, 'semua berkas assets/ yang dirujuk halaman benar-benar ada (' + asetRujuk.length + ' rujukan)', asetHilang.join(','));
  w.close();
}

console.log('\n2) Kanvas kosong');
{
  const { w, d } = bukaKanvas();
  cek(w.eval('cur.els.length') === 0, 'kanvas pertama dibuka benar-benar kosong', String(w.eval('cur.els.length')));
  cek(d.querySelectorAll('#kanvas .el').length === 0, 'panggung tidak berisi elemen apa pun');
  cek(w.eval('cur.w') === 900 && w.eval('cur.h') === 1200, 'ukuran awal 900×1200', w.eval('cur.w + "×" + cur.h'));
  cek(/masih kosong/i.test(d.querySelector('#petunjuk').textContent), 'petunjuk menyebut kanvas masih kosong');
  cek(/Kanvas tanpa judul/.test(w.eval('cur.nama')), 'nama bawaan kanvas jelas', w.eval('cur.nama'));
  w.close();
}

console.log('\n3) Menambah elemen');
{
  const { w, d } = bukaKanvas();
  w.tambahTeks('judul');
  cek(w.eval('cur.els.length') === 1 && w.eval("cur.els[0].tipe") === 'teks', 'teks preset masuk ke kanvas');
  cek(d.querySelectorAll('#kanvas .el').length === 1, 'teks tampil di panggung');
  w.tambah('kotak'); w.tambah('bulat'); w.tambah('garis'); w.tambah('ornamen', { bentuk: 'batik' }); w.tambah('hias', { jenis: 'floral' }); w.tambah('gambar');
  cek(w.eval('cur.els.length') === 7, 'enam jenis elemen lain bisa ditambah', String(w.eval('cur.els.length')));
  cek(d.querySelectorAll('#kanvas .el.t-hias svg, #kanvas .el.t-ornamen svg').length === 2, 'ornamen & hiasan dirender sebagai vektor SVG');
  cek(d.querySelectorAll('[data-lapisan] .baris-l').length === 7, 'daftar lapisan mengikuti jumlah elemen', String(d.querySelectorAll('[data-lapisan] .baris-l').length));
  w.pilihLib('ornamen');
  const jmlOrn = w.eval('Object.keys(DEKO_BENTUK).length'), jmlHias = w.eval('JENIS_HIAS.length');
  cek(d.querySelectorAll('#lib .grid3 .u').length === jmlOrn + jmlHias,
    'pustaka ornamen = ' + jmlOrn + ' bentuk + ' + jmlHias + ' hiasan', String(d.querySelectorAll('#lib .grid3 .u').length));
  w.pilihLib('latar');
  cek(d.querySelectorAll('#lib .u.pola').length === 12, 'pustaka latar menampilkan 12 pilihan motif (termasuk polos)', String(d.querySelectorAll('#lib .u.pola').length));
  w.close();
}

console.log('\n4) Geser, snap, ukuran, putar');
{
  const { w, d } = bukaKanvas();
  w.tambahTeks('judul');                                  // x 60, w 600 di kanvas 900
  const el = () => d.querySelector('#kanvas .el');
  const x0 = w.eval('cur.els[0].x');
  el().dispatchEvent(mouse(w, 'mousedown', 200, 200));
  w.document.dispatchEvent(mouse(w, 'mousemove', 240, 200));
  w.document.dispatchEvent(mouse(w, 'mouseup', 240, 200));
  cek(w.eval('cur.els[0].x') === x0 + 40, 'geser 40 px menggeser elemen 40 px', String(w.eval('cur.els[0].x')));
  // geometri dibuat pasti: x 100, lebar 400 → tepi kiri 100
  w.terapkan('x', 100); w.terapkan('y', 200); w.terapkan('w', 400); w.terapkan('h', 200);
  el().dispatchEvent(mouse(w, 'mousedown', 200, 200));
  w.document.dispatchEvent(mouse(w, 'mousemove', 200 + 347, 200));   // tepi kiri 447 → 3 px dari tengah kanvas (450)
  cek(d.querySelectorAll('#pandu i').length >= 1, 'garis bantu muncul saat menempel');
  w.document.dispatchEvent(mouse(w, 'mouseup', 200 + 347, 200));
  cek(w.eval('cur.els[0].x') === 450, 'snap menempelkan tepi elemen ke tengah kanvas', String(w.eval('cur.els[0].x')));
  cek(d.querySelectorAll('#pandu i').length === 0, 'garis bantu hilang setelah selesai menggeser');
  cek(w.eval('cur.els[0].kunci') === false, 'elemen biasa tidak terkunci');
  // ubah ukuran lewat pegangan tenggara
  const w0 = w.eval('cur.els[0].w'), h0 = w.eval('cur.els[0].h');
  const peg = d.querySelector('#lapis .peg.se');
  cek(!!peg, 'pegangan ubah ukuran muncul saat elemen terpilih');
  peg.dispatchEvent(mouse(w, 'mousedown', 400, 400));
  w.document.dispatchEvent(mouse(w, 'mousemove', 500, 450));
  w.document.dispatchEvent(mouse(w, 'mouseup', 500, 450));
  cek(w.eval('cur.els[0].w') === w0 + 100 && w.eval('cur.els[0].h') === h0 + 50, 'pegangan tenggara menambah lebar & tinggi',
    w.eval('cur.els[0].w') + 'x' + w.eval('cur.els[0].h'));
  // putar
  const putar = d.querySelector('#lapis .peg.putar');
  putar.dispatchEvent(mouse(w, 'mousedown', 300, 100));
  w.document.dispatchEvent(mouse(w, 'mousemove', 400, 100));   // arah awal: ke kanan (0°)
  w.document.dispatchEvent(mouse(w, 'mousemove', 300, 200));   // lalu ke bawah (90°)
  w.document.dispatchEvent(mouse(w, 'mouseup', 300, 200));
  cek(w.eval('cur.els[0].rot') === 90, 'pegangan putar menambah rotasi 90°', String(w.eval('cur.els[0].rot')));
  cek(/rotate\(90deg\)/.test(el().getAttribute('style') || ''), 'rotasi tampil di elemen');
  w.close();
}

console.log('\n5) Panel properti, lapisan, kunci, hapus, riwayat');
{
  const { w, d } = bukaKanvas();
  w.tambahTeks('judul');
  const t = d.querySelector('#panel textarea[data-at="isi"]');
  cek(!!t, 'panel teks menyediakan kotak tulisan');
  t.value = 'RANGGA & ALYA';
  t.dispatchEvent(new w.Event('input', { bubbles: true }));
  cek(w.eval('cur.els[0].isi') === 'RANGGA & ALYA', 'menulis di panel langsung mengubah isi', w.eval('cur.els[0].isi'));
  w.terapkan('ukuran', 96);
  cek(/font-size:96px/.test(d.querySelector('#kanvas .el').getAttribute('style')), 'ukuran font ikut berubah di panggung');
  w.terapkan('ukuran', 9999);
  cek(w.eval('cur.els[0].ukuran') === 400, 'ukuran font dibatasi 400 px (tidak bisa merusak kanvas)', String(w.eval('cur.els[0].ukuran')));
  w.tambah('kotak');
  const nama2 = () => d.querySelectorAll('[data-lapisan] .baris-l').length;
  cek(nama2() === 2, 'daftar lapisan berisi dua elemen');
  w.pilihElOne(w.eval('cur.els[1].id')); w.geserLapisan(-1);
  cek(w.eval('cur.els[0].tipe') === 'kotak', 'tombol turun memindahkan urutan lapisan');
  w.pilihElOne(w.eval('cur.els[0].id'));
  w.toggleKunci();
  cek(w.eval('cur.els[0].kunci') === true, 'kunci elemen aktif');
  const xk = w.eval('cur.els[0].x');
  d.querySelector('#kanvas .el').dispatchEvent(mouse(w, 'mousedown', 100, 100));
  w.document.dispatchEvent(mouse(w, 'mousemove', 260, 260));
  w.document.dispatchEvent(mouse(w, 'mouseup', 260, 260));
  cek(w.eval('cur.els[0].x') === xk, 'elemen terkunci tidak bisa digeser');
  w.toggleKunci(); w.toggleSembunyi();
  cek(d.querySelectorAll('#kanvas .el').length === 1, 'elemen yang disembunyikan hilang dari panggung');
  w.toggleSembunyi();
  const jml = w.eval('cur.els.length');
  w.duplikatEl();
  cek(w.eval('cur.els.length') === jml + 1, 'duplikat menambah satu elemen');
  w.eval('hapusEl()');
  cek(w.eval('cur.els.length') === jml, 'hapus mengurangi satu elemen');
  w.undo();
  cek(w.eval('cur.els.length') === jml + 1, 'undo mengembalikan elemen yang dihapus');
  w.redo();
  cek(w.eval('cur.els.length') === jml, 'redo menghapusnya lagi');
  w.pilihElOne(w.eval('cur.els[0].id'));
  const xa = w.eval('cur.els[0].x'), ya = w.eval('cur.els[0].y');
  key(w, 'ArrowRight'); key(w, 'ArrowDown', { shiftKey: true });
  cek(w.eval('cur.els[0].x') === xa + 1 && w.eval('cur.els[0].y') === ya + 10, 'tanda panah menggeser 1 px, Shift 10 px',
    w.eval('cur.els[0].x') + ',' + w.eval('cur.els[0].y'));
  w.eval('hapusSemua()');
  cek(w.eval('cur.els.length') === 0, 'tombol kosongkan mengembalikan kanvas kosong');
  w.close();
}

console.log('\n6) Simpan & muat ulang');
{
  const { w } = bukaKanvas();
  w.tambahTeks('nama');
  w.eval('cur.nama = "Undangan Rangga"');
  w.eval('simpan()');
  const raw = w.localStorage.getItem('asproject.kanvas.v1');
  cek(!!raw && /Undangan Rangga/.test(raw), 'rancangan tersimpan di localStorage');
  const isi = JSON.parse(raw);
  cek(Array.isArray(isi.dok) && isi.dok.length >= 1 && isi.dok[0].els.length === 1, 'berkas simpanan memuat elemen', JSON.stringify(isi).slice(0, 90));
  cek(isi.aktif === w.eval('cur.id'), 'kanvas aktif dicatat');
  w.close();
  const { w: w2 } = bukaKanvas({ k: 'asproject.kanvas.v1', v: raw });
  cek(w2.eval('cur.nama') === 'Undangan Rangga' && w2.eval('cur.els.length') === 1, 'halaman baru memuat kembali rancangan yang sama',
    w2.eval('cur.nama') + '/' + w2.eval('cur.els.length'));
  w2.close();
}

console.log('\n7) Ekspor & keamanan');
{
  const { w, d } = bukaKanvas();
  w.tambah('teks', { isi: '<b>jahat</b> & "kutip"', x: 40, y: 40, w: 400, h: 90 });
  const html = w.eval('htmlDok(cur)');
  cek(/^<!doctype html>/i.test(html.trim()), 'ekspor HTML berupa berkas HTML mandiri');
  cek(html.indexOf('<b>jahat</b>') < 0 && html.indexOf('&lt;b&gt;jahat&lt;/b&gt;') > 0, 'tulisan pengguna di-escape di ekspor HTML (tidak bisa menyuntik tag)');
  cek(html.indexOf('&amp; &quot;kutip&quot;') > 0, 'karakter & dan kutip ikut di-escape');
  cek(/class="kv"/.test(html) && /position:absolute/.test(html), 'ekspor HTML memuat kanvas & aturan posisi');
  const svg = w.eval('svgDok(cur)');
  cek(/^<svg xmlns/.test(svg) && /viewBox="0 0 900 1200"/.test(svg), 'ekspor SVG berukuran kanvas', svg.slice(0, 60));
  cek(svg.indexOf('<text') > 0 && svg.indexOf('&lt;b&gt;') > 0, 'teks jadi <text> dan tetap ter-escape di SVG');
  w.eval('terapkan("warna","red;background:url(javascript:alert(1))")');
  cek(w.eval('cur.els[0].warna') === '#2B2118', 'warna aneh dibuang, kembali ke warna aman', w.eval('cur.els[0].warna'));
  cek(w.srcAman('javascript:alert(1)') === '' && w.srcAman('data:image/svg+xml,<svg onload=alert(1)>') === '', 'sumber gambar berbahaya ditolak');
  cek(w.srcAman('assets/demo/foto-1.jpg') !== '' && w.srcAman('data:image/png;base64,AAAA') !== '', 'gambar lokal & data URL diterima');
  w.eval('pakaiMotif("parang")');
  /* jsdom tidak bisa mengurai url(data:image/svg+xml,…) di cssText, jadi motif diperiksa
     dari CSS yang dihasilkan (persis yang dipasang peramban pada atribut style). */
  cek(/background-image:url\(data:image\/svg\+xml/.test(w.eval('bgStyle(cur)')) && w.eval('cur.bg.mode') === 'motif', 'motif latar dipakai di kanvas',
    w.eval('bgStyle(cur)').slice(0, 50));
  cek(/motif latar "parang" tampil penuh di berkas HTML mandiri/.test(w.eval('svgDok(cur)')), 'ekspor SVG memberi catatan saat latar bermotif');
  cek(/background-image:url\(data:image\/svg\+xml/.test(w.eval('htmlDok(cur)')), 'ekspor HTML ikut membawa motif latar');
  w.eval('pakaiPalet("gold")');
  cek(/linearGradient/.test(w.eval('svgDok(cur)')), 'latar gradasi jadi linearGradient di SVG');
  cek(w.eval('JSON.parse(JSON.stringify({v:1,dok:[cur]})).dok[0].els.length') === 1, 'JSON rancangan bisa dibulatkan (round-trip aman)');
  /* berkas ekspor dibuka ulang: pastikan berdiri sendiri (tanpa skrip) & elemennya utuh */
  const unduhDom = new JSDOM(html);
  const kanvasTiruan = unduhDom.window.document.querySelector('.kv');
  cek(!!kanvasTiruan && kanvasTiruan.querySelectorAll('.el').length === w.eval('cur.els.filter(e=>!e.sembunyi).length'),
    'berkas HTML mandiri bisa dibuka ulang & elemennya lengkap',
    kanvasTiruan ? String(kanvasTiruan.querySelectorAll('.el').length) : 'tanpa .kv');
  cek(!/\bonclick=/i.test(html) && !/<script/i.test(html), 'berkas ekspor bersih dari skrip/handler');
  w.close();
}

console.log('\n8) Jadikan tema (nyambung ke mesin katalog)');
{
  const { w, d } = bukaKanvas();
  w.tambahTeks('judul');
  w.eval('cur.nama = "Rose Garden"');
  w.eval('pakaiMotif("rose")');
  w.tambah('hias', { jenis: 'floral' });
  w.tambahTeks('kredit');
  const tema = JSON.parse(w.eval('JSON.stringify(jadikanTema())'));
  cek(FONT_MESIN.indexOf(tema.ft) >= 0 && FONT_MESIN.indexOf(tema.body) >= 0, 'font tema dipilih dari daftar mesin', [tema.ft, tema.body].join('/'));
  cek(MOTIF_MESIN.indexOf(tema.pat) >= 0, 'motif tema berasal dari patCss()', tema.pat);
  cek(BORDER_MESIN.indexOf(tema.rec.border) >= 0, 'border tema dipetakan ke border katalog', tema.rec.border);
  cek(DKO_MESIN.indexOf(tema.dko) >= 0 && FLT_MESIN.indexOf(tema.flt) >= 0 && DVD_MESIN.indexOf(tema.dvd) >= 0,
    'hiasan tema memakai id yang sah', [tema.dko, tema.flt, tema.dvd].join('/'));
  cek(tema.rec.slides.every((s) => SLIDE_MESIN.indexOf(s) >= 0) && tema.rec.slides.length > 0, 'bagian undangan tema sah', tema.rec.slides.join(','));
  cek(w.eval('kontras(jadikanTema().ink, jadikanTema().g[1])') >= 4.5, 'warna teks tema kontras ≥ 4.5:1 dengan gradasi',
    w.eval('kontras(jadikanTema().ink, jadikanTema().g[1]).toFixed(2)'));
  cek(/^#[0-9a-f]{6}$/i.test(tema.accent) && Array.isArray(tema.g) && tema.g.length === 3, 'palet tema 3 warna + aksen', JSON.stringify(tema.g));
  cek(tema.sumber === 'kanvas', 'tema ditandai berasal dari kanvas');
  w.eval('kirimKeStudioTemplate()');
  const handoff = w.localStorage.getItem('asproject.kanvas.handoff');
  cek(!!handoff && JSON.parse(handoff).tema.id === 'rose-garden', 'tema dikirim ke Studio Template lewat localStorage', String(handoff).slice(0, 70));
  cek(!!d.querySelector('#toast') && /Studio Template/.test(d.querySelector('#toast').textContent), 'pengguna diberi tahu perpindahan halaman');
  w.close();
}

console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
