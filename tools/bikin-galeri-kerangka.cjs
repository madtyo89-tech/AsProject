#!/usr/bin/env node
/* Bangun katalog-demo/galeri-kerangka.html — pratinjau VISUAL semua tema.

   Beda dengan bikin-perbandingan-tema.cjs yang menggambar mockup kartu buatan
   tangan, halaman ini memasang iframe ke renderer PRODUKSI sungguhan:
       ../undangan.html?demo=1&tpl=<id>&buka=1
   Jadi yang terlihat adalah hasil nyata dari kerangka, urutan, bagian eksklusif,
   dan mesin 4D yang benar-benar dipakai tamu — bukan perkiraan.

   Parameter itu sudah ada dan dipakai kartu katalog di index.html; di sini hanya
   dipakai ulang. Mode demo tidak memutar musik, jadi banyak iframe sekaligus aman.

   Pemakaian: node tools/bikin-galeri-kerangka.cjs
   Jangan sunting berkas hasilnya — jalankan ulang generator ini. */
'use strict';
const fs = require('fs');
const path = require('path');

const AKAR = path.join(__dirname, '..');
const KELUARAN = path.join(AKAR, 'katalog-demo', 'galeri-kerangka.html');

/* Potong literal JS dari sumber dengan pelacak kedalaman yang sadar-string,
   supaya tidak terkecoh kurung kurawal di dalam teks. */
function potong(src, penanda, buka, tutup) {
  const i = src.indexOf(penanda);
  if (i < 0) throw new Error('penanda tak ditemukan: ' + penanda);
  const mulai = src.indexOf(buka, i);
  let d = 0, q = null;
  for (let j = mulai; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === buka) d++;
    else if (c === tutup) { d--; if (d === 0) return src.slice(mulai, j + 1); }
  }
  throw new Error('kurung tak seimbang pada: ' + penanda);
}

const und = fs.readFileSync(path.join(AKAR, 'undangan.html'), 'utf8');
const TPL = eval(potong(und, 'const TPL=[', '[', ']'));
const LAYOUTS = eval('(' + potong(und, 'const LAYOUTS={', '{', '}') + ')');
const URUTAN = eval('(' + potong(und, 'const URUTAN={', '{', '}') + ')');

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Nama shell yang mudah dibaca, dipakai sebagai judul kelompok. */
const SHELL_JUDUL = {
  klasik: 'Klasik', arsip: 'Arsip / Berkas', editorial: 'Editorial', panggung: 'Panggung Sinematik',
  zigzag: 'Zigzag Miring', poster: 'Poster Setinggi Layar', bab: 'Bab Bernomor',
  kaca: 'Kaca Melayang', lembut: 'Lembut Berserak', split: 'Split Dua Kolom'
};
const SHELL_CIRI = {
  klasik: 'kerangka lama, tanpa aturan CSS tambahan — pembanding dasar',
  arsip: 'kertas bergaris, cap miring, metadata monospace',
  editorial: 'kotak kartu dihapus, rata kiri, garis rambut, nomor pasal',
  panggung: 'latar gelap, pita foto full-bleed, sorot cahaya',
  zigzag: 'panel selang-seling miring dan saling tumpang',
  poster: 'tiap bagian setinggi layar dengan scroll-snap',
  bab: 'pembatas antar bagian plus angka romawi',
  kaca: 'panel blur melayang dengan lebar beragam',
  lembut: 'kartu miring berserak, garis putus-putus',
  split: 'rail lengket dua kolom di layar lebar'
};
const EKSTRA_JUDUL = {
  navDot: 'navigasi titik', babAngka: 'angka bab romawi', kutipBesar: 'kutipan besar',
  heroFoto: 'pita foto', galeriStrip: 'strip galeri', jamFlip: 'jam flip'
};

/* Kelompokkan tema per shell, urut mengikuti urutan TPL supaya stabil. */
const kelompok = new Map();
TPL.forEach((t, i) => {
  const pre = LAYOUTS[t.layout] || LAYOUTS.klasik;
  const shell = pre.shell;
  if (!kelompok.has(shell)) kelompok.set(shell, []);
  kelompok.get(shell).push({ t, i, pre, lay: t.layout || 'klasik' });
});
/* Urutkan kelompok mengikuti urutan kemunculan shell di LAYOUTS. */
const urutanShell = [...new Set(Object.values(LAYOUTS).map(L => L.shell))]
  .filter(s => kelompok.has(s));

function kartu({ t, i, pre, lay }) {
  const x = pre.ekstra || [];
  const chip = x.length
    ? x.map(e => '<span class="chip">' + esc(EKSTRA_JUDUL[e] || e) + '</span>').join('')
    : '<span class="chip kosong">tanpa bagian eksklusif</span>';
  const src = '../undangan.html?demo=1&tpl=' + encodeURIComponent(t.id) + '&buka=1';
  return '  <figure class="kartu" data-shell="' + esc(pre.shell) + '">' +
    '<div class="bingkai"><iframe src="' + esc(src) + '" loading="lazy" ' +
    'title="Pratinjau nyata tema ' + esc(t.nama) + '" referrerpolicy="no-referrer"></iframe></div>' +
    '<figcaption>' +
    '<div class="baris1"><b>' + esc(t.nama) + '</b>' +
    (pre.vip ? '<span class="vip">4D</span>' : '') +
    (t.studioOnly ? '<span class="studio">Studio</span>' : '') + '</div>' +
    '<div class="baris2">' + esc(lay) + ' · urutan ' + esc(pre.urutan) +
    ' · ' + URUTAN[pre.urutan].length + ' bagian</div>' +
    '<div class="chips">' + chip + '</div>' +
    '</figcaption></figure>';
}

const isiKelompok = urutanShell.map(shell => {
  const daftar = kelompok.get(shell);
  const publik = daftar.filter(d => !d.t.studioOnly).length;
  return '<section class="kelompok" id="shell-' + esc(shell) + '">' +
    '<h2>' + esc(SHELL_JUDUL[shell] || shell) + ' <code>lay-' + esc(shell) + '</code></h2>' +
    '<p class="ciri">' + esc(SHELL_CIRI[shell] || '') + ' — <b>' + daftar.length +
    ' tema</b> (' + publik + ' publik' + (daftar.length - publik ? ', ' + (daftar.length - publik) + ' Studio-only' : '') + ')</p>' +
    '<div class="gal">\n' + daftar.map(kartu).join('\n') + '\n</div></section>';
}).join('\n');

const navShell = urutanShell.map(s =>
  '<a href="#shell-' + esc(s) + '">' + esc(SHELL_JUDUL[s] || s) + ' <i>' + kelompok.get(s).length + '</i></a>').join('');

const html = '<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'<title>Pratinjau Nyata Semua Tema — AsProject</title>\n' +
'<style>\n' +
':root{--fw:390px;--fh:640px;--ink:#2b2620;--mut:#7d7365;--garis:#e6ddd0;--bg:#f6f2ea}\n' +
'*{box-sizing:border-box}\n' +
'body{margin:0;background:var(--bg);color:var(--ink);' +
'font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}\n' +
'header{position:sticky;top:0;z-index:20;background:rgba(246,242,234,.94);' +
'backdrop-filter:blur(8px);border-bottom:1px solid var(--garis);padding:14px 20px}\n' +
'header h1{margin:0 0 4px;font-size:19px}\n' +
'header p{margin:0;color:var(--mut);font-size:13.5px;max-width:78ch}\n' +
'.alat{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}\n' +
'.alat b{font-size:12.5px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.06em}\n' +
'.alat button{border:1px solid var(--garis);background:#fff;color:var(--ink);' +
'border-radius:999px;padding:5px 13px;font:inherit;font-size:13px;cursor:pointer}\n' +
'.alat button[aria-pressed="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}\n' +
'nav.shell{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}\n' +
'nav.shell a{font-size:12.5px;text-decoration:none;color:var(--ink);background:#fff;' +
'border:1px solid var(--garis);border-radius:999px;padding:4px 11px}\n' +
'nav.shell a i{font-style:normal;color:var(--mut)}\n' +
'nav.shell a:hover{border-color:var(--ink)}\n' +
'main{padding:8px 20px 60px;max-width:1680px;margin:0 auto}\n' +
'.kelompok{margin-top:34px;scroll-margin-top:130px}\n' +
'.kelompok h2{margin:0;font-size:17px;display:flex;align-items:center;gap:9px}\n' +
'.kelompok h2 code{font-size:12px;background:#fff;border:1px solid var(--garis);' +
'border-radius:6px;padding:2px 7px;color:var(--mut);font-weight:500}\n' +
'.ciri{margin:5px 0 14px;color:var(--mut);font-size:13.5px;max-width:90ch}\n' +
'.gal{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(var(--fw),1fr))}\n' +
'.kartu{margin:0;min-width:0}\n' +
'.bingkai{width:var(--fw);max-width:100%;height:var(--fh);background:#fff;' +
'border:1px solid var(--garis);border-radius:14px;overflow:hidden;' +
'box-shadow:0 8px 26px rgba(70,58,40,.10)}\n' +
'.bingkai iframe{width:100%;height:100%;border:0;display:block;background:#fff}\n' +
'figcaption{padding:10px 2px 0;max-width:var(--fw)}\n' +
'.baris1{display:flex;align-items:center;gap:7px;flex-wrap:wrap}\n' +
'.baris1 b{font-size:14.5px}\n' +
'.vip,.studio{font-size:10.5px;font-weight:700;letter-spacing:.05em;border-radius:5px;padding:2px 6px}\n' +
'.vip{background:#2b2620;color:#f0d68a}\n' +
'.studio{background:#e8e0d2;color:#6b6053}\n' +
'.baris2{color:var(--mut);font-size:12.5px;margin-top:2px}\n' +
'.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}\n' +
'.chip{font-size:11.5px;background:#fff;border:1px solid var(--garis);' +
'border-radius:999px;padding:2px 8px;color:var(--ink)}\n' +
'.chip.kosong{color:#a99e8d;border-style:dashed}\n' +
'footer{border-top:1px solid var(--garis);padding:22px 20px 50px;color:var(--mut);font-size:13px}\n' +
'footer code{background:#fff;border:1px solid var(--garis);border-radius:5px;padding:1px 5px}\n' +
'@media(max-width:600px){:root{--fw:100%;--fh:560px}.gal{grid-template-columns:1fr}}\n' +
'</style>\n</head>\n<body>\n<header>\n' +
'<h1>Pratinjau nyata ' + TPL.length + ' tema</h1>\n' +
'<p>Setiap bingkai di bawah adalah <b>iframe ke renderer produksi sungguhan</b> ' +
'(<code>undangan.html?demo=1&amp;tpl=…&amp;buka=1</code>), bukan gambar tiruan. ' +
'Yang kamu lihat adalah hasil nyata kerangka, urutan bagian, bagian eksklusif, dan mesin 4D ' +
'yang diterima tamu. <b>Gulir di dalam bingkai</b> untuk melihat susunan bagiannya.</p>\n' +
'<div class="alat"><b>Lebar layar</b>' +
'<button data-w="390" aria-pressed="true">Ponsel 390</button>' +
'<button data-w="768" aria-pressed="false">Tablet 768</button>' +
'<button data-w="1100" aria-pressed="false">Desktop 1100</button>' +
'<span class="baris2" id="ket">Shell <code>split</code> baru jadi dua kolom di 900px ke atas — coba Desktop.</span></div>\n' +
'<nav class="shell">' + navShell + '</nav>\n</header>\n<main>\n' +
isiKelompok + '\n</main>\n<footer>\n' +
'Dibangun oleh <code>tools/bikin-galeri-kerangka.cjs</code> dari <code>TPL</code>, ' +
'<code>LAYOUTS</code>, dan <code>URUTAN</code> di <code>undangan.html</code>. ' +
'Isi demo (nama, tanggal, foto) sama untuk semua tema supaya perbedaan yang terlihat ' +
'murni berasal dari kerangka, bukan dari datanya. Tema bertanda <b>Studio</b> hanya ' +
'bisa dibuat lewat Studio, tidak tampil di katalog publik.\n' +
'</footer>\n<script>\n' +
'document.querySelectorAll(".alat button").forEach(function(b){\n' +
'  b.addEventListener("click",function(){\n' +
'    document.querySelectorAll(".alat button").forEach(function(x){x.setAttribute("aria-pressed","false")});\n' +
'    b.setAttribute("aria-pressed","true");\n' +
'    document.documentElement.style.setProperty("--fw",b.dataset.w+"px");\n' +
'  });\n' +
'});\n' +
'</script>\n</body>\n</html>\n';

fs.writeFileSync(KELUARAN, html);
console.log('✅ ' + path.relative(AKAR, KELUARAN) + ' (' + html.length + ' b)');
console.log('   ' + TPL.length + ' tema dalam ' + urutanShell.length + ' kelompok shell:');
urutanShell.forEach(s => console.log('     ' + s.padEnd(10) + kelompok.get(s).length + ' tema'));
