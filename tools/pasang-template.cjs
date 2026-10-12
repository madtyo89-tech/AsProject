#!/usr/bin/env node
/* ============================================================================
   pasang-template.cjs — memasang satu tema hasil "Studio Template" ke repo.

   Pakai:
     node tools/pasang-template.cjs sage-modern.json          (pasang)
     node tools/pasang-template.cjs sage-modern.json --kering (uji tanpa menulis)
     node tools/pasang-template.cjs --batalkan                (kembalikan cadangan)

   Yang dikerjakan:
     1. studio.html   → baris baru di AKHIR `const TPL=[…]`
     2. undangan.html → baris ringkas dengan id & urutan sama
     3. index.html    → baris kartu katalog di AKHIR `var Pn=[…]`,
                        rule CSS gradasi (from/via/to) sebelum </style>,
                        dan angka "N template siap pakai" di hero
   Berkas asli selalu disalin ke <nama>.bak-template sebelum diubah.
   Id yang sudah terpasang akan dilewati (aman dijalankan dua kali).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KARTU = '#fffdf9';
/* Sama dengan TEMA_LAMA di tools/cek-kesehatan.py — id ini tidak boleh dipakai lagi. */
const TEMA_LAMA = ['ice-blue', 'royal-garden', 'galaxy-prestige', 'abyss-pearl', 'winter-prestige'];
const KATEGORI = { all: 'Semua', pernikahan: 'Pernikahan', khitanan: 'Khitanan', ultah: 'Ulang Tahun', aqiqah: 'Aqiqah' };
const TXT = { ok: '\u2713', bad: '\u2717', warn: '!', titik: '\u2022' };

const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ada = (rel) => fs.existsSync(path.join(ROOT, rel));

/* ---------- util ---------- */
/* Daftar id dibaca dengan MENJALANKAN literal array/objeknya (aman: literal murni
   dari berkas repo ini sendiri) — supaya array satu baris maupun bertingkat
   (mis. FX_COVER = [['fade','Fade'], …]) sama-sama terbaca utuh. */
function literalSumber(teks, nama) {
  const i = teks.indexOf('const ' + nama + '=');
  if (i < 0) return null;
  const sisa = teks.slice(teks.indexOf('=', i) + 1);
  const buka = sisa.search(/[\[{]/);
  if (buka < 0) return null;
  const b = teks.indexOf('=', i) + 1 + buka;
  const akhir = akhirArray(teks, b);
  return akhir < 0 ? null : teks.slice(b, akhir + 1);
}
function isiDaftar(teks, nama) {
  const src = literalSumber(teks, nama);
  if (!src) return null;
  try {
    const nilai = new Function('return ' + src)();
    if (Array.isArray(nilai)) return nilai;
    if (nilai && typeof nilai === 'object') return Object.keys(nilai);
    return null;
  } catch (e) {
    return null;                       /* literal tidak bisa dijalankan — periksa manual */
  }
}
function idObjek(teks, nama) {
  const nilai = isiDaftar(teks, nama);
  if (!nilai) return null;
  if (!Array.isArray(nilai[0] !== undefined ? nilai : null)) return nilai.map((x) => x.id || x).filter(Boolean);
  return nilai.map((x) => (x && typeof x === 'object' ? x.id : x)).filter((x) => typeof x === 'string');
}
function idArray(teks, nama) {
  const nilai = isiDaftar(teks, nama);
  if (!nilai) return null;
  return nilai.map((x) => (Array.isArray(x) ? x[0] : (x && typeof x === 'object' ? x.id : x))).filter((x) => typeof x === 'string');
}
/* Indeks penutup array/objek, tahan terhadap string & template literal. */
function akhirArray(teks, buka) {
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
function hexKeRgb(h) {
  h = String(h || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lampu(h) {
  const c = hexKeRgb(h).map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function kontras(a, b) {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(a)) || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(b))) return 21;
  const l1 = lampu(a), l2 = lampu(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const q = (x) => String(x == null ? '' : x).replace(/'/g, '\u2019');
const tierDari = (h) => (h >= 149000 ? 'vip' : h >= 119000 ? 'eksklusif' : h >= 89000 ? 'premium' : 'basic');
const bestseller = (badge) => /LARIS|BEST|TERLARIS/i.test(badge || '');

/* ---------- validasi ---------- */
function periksaData(d, mesin) {
  const catatan = [], masalah = [];
  const keras = (b) => masalah.push(b), lunak = (b) => catatan.push(b);
  const HEX = /^#[0-9a-f]{6}$/i;
  if (!d || typeof d !== 'object') { keras('Isi JSON bukan objek tema.'); return { masalah, catatan }; }
  const id = String(d.id || '').trim();
  if (!/^[a-z0-9-]{3,}$/.test(id)) keras('id harus huruf kecil/angka/minus, minimal 3 huruf.');
  if (TEMA_LAMA.includes(id)) keras('id "' + id + '" termasuk TEMA_LAMA (tema lama yang pensiun) — pakai id lain.');
  if (!String(d.nama || '').trim()) keras('nama tema belum diisi.');
  if (!KATEGORI[d.ev]) keras('ev harus salah satu: ' + Object.keys(KATEGORI).join(', ') + '.');
  const harga = parseInt(d.harga, 10);
  if (!Number.isFinite(harga) || harga < 0 || harga > 900000) keras('harga harus angka 0–900000.');
  if (!Array.isArray(d.g) || d.g.length !== 3 || !d.g.every((x) => HEX.test(x))) keras('g harus 3 warna hex (#RRGGBB).');
  if (!HEX.test(String(d.accent || ''))) keras('accent harus hex #RRGGBB.');
  if (!HEX.test(String(d.ink || ''))) keras('ink harus hex #RRGGBB.');
  if (d.ft && !mesin.fonts.includes(d.ft)) keras('font judul "' + d.ft + '" tidak ada di FONTS (studio.html).');
  if (d.body && !mesin.fonts.includes(d.body)) keras('font isi "' + d.body + '" tidak ada di FONTS (studio.html).');
  if (d.pat && !mesin.pat.includes(d.pat)) keras('motif "' + d.pat + '" tidak ada di patCss().');
  const rec = d.rec || {};
  if (rec.border && !mesin.borders.includes(rec.border)) keras('border "' + rec.border + '" tidak ada di BORDERS.');
  if (rec.cover && !mesin.fxCover.includes(rec.cover)) keras('efek pembuka "' + rec.cover + '" tidak ada di FX_COVER.');
  if (rec.scroll && !mesin.fxScroll.includes(rec.scroll)) keras('efek gulir "' + rec.scroll + '" tidak ada di FX_SCROLL.');
  (Array.isArray(rec.slides) ? rec.slides : []).forEach((s) => { if (!mesin.slides.includes(s)) keras('bagian "' + s + '" tidak ada di SLIDES.'); });
  [['dko', 'hiasan sudut', mesin.dko], ['flt', 'kelopak melayang', mesin.flt], ['dvd', 'pembatas nama', mesin.dvd]].forEach(([k, label, ids]) => {
    const v = d[k];
    if (!v || v === 'none') return;
    if (!ids.includes(v)) keras(k + ' "' + v + '" bukan ' + label + ' yang dikenal (' + ids.join('/') + ') — pakai "none" untuk mematikan.');
  });
  [['bg3d', d.bg3d], ['bgPaper', d.bgPaper]].forEach(([k, v]) => {
    if (!v) return;
    if (!/^assets\/.+\.(webp|png|jpg|jpeg|svg)$/i.test(v)) keras(k + ' harus path seperti assets/… .webp');
    else if (!ada(v)) keras(k + ' menunjuk berkas yang belum ada: ' + v);
  });
  if (d.part && !['gold', 'petal', 'snow', 'bubble'].includes(d.part)) keras('partikel VIP "' + d.part + '" tidak dikenal (gold/petal/snow/bubble).');
  if (d.scene && !['zoom', 'rise', 'curtain'].includes(d.scene)) keras('adegan VIP "' + d.scene + '" tidak dikenal (zoom/rise/curtain).');
  if (HEX.test(String(d.ink || '')) && Array.isArray(d.g) && d.g.length === 3) {
    [['gradasi atas', d.g[0]], ['gradasi bawah', d.g[2]]].forEach(([nm, warna]) => {
      const r = kontras(d.ink, warna);
      if (r < 3) keras('teks cover (' + d.ink + ') kurang kontras di ' + nm + ' (' + r.toFixed(2) + ':1) — mesin butuh ≥ 3:1. Pakai "Hitung teks aman" di Studio Template.');
      else if (r < 4.5) lunak('teks cover di ' + nm + ' ' + r.toFixed(2) + ':1 (aman, tapi ≥ 4.5:1 lebih nyaman).');
    });
    const rk = kontras(d.ink, KARTU);
    if (rk < 4.5) lunak('teks kartu isi ' + rk.toFixed(2) + ':1 — sebaiknya ≥ 4.5:1 (theme-contrast.js akan menyesuaikan).');
    const ra = kontras(d.accent, d.g[0]);
    if (ra < 3) lunak('aksen vs gradasi atas ' + ra.toFixed(2) + ':1 (sebaiknya ≥ 3:1).');
  }
  if (!['basic', 'premium', 'eksklusif', 'vip'].includes(tierDari(harga))) keras('tier tidak dikenal.');
  if (!Array.isArray(rec.slides) || !rec.slides.length) lunak('belum ada bagian undangan disarankan (rec.slides kosong).');
  if (!d.dko && !d.flt && !d.dvd) lunak('belum ada dekorasi dipesan (dko/flt/dvd kosong) — hiasan hanya muncul bila border membawa `art`.');
  return { masalah, catatan };
}

/* ---------- baris kode ---------- */
function recKode(d) {
  const r = d.rec || {}, p = ["body:'" + q(d.body || 'inter') + "'", "border:'" + (r.border || 'double') + "'",
    "cover:'" + (r.cover || 'zoom') + "'", "scroll:'" + (r.scroll || 'fade-up') + "'"];
  if (r.mix === false) p.push('mix:!1');
  if (Array.isArray(r.slides) && r.slides.length) p.push('slides:[' + r.slides.map((s) => "'" + s + "'").join(',') + ']');
  return ',rec:{' + p.join(',') + '}';
}
function ekor(d) {
  const tier = tierDari(parseInt(d.harga, 10));
  let s = '';
  if (d.char) s += ",char:'" + q(d.char) + "'";
  if (d.bg3d) s += ",bg3d:'" + q(d.bg3d) + "'";
  if (d.bgPaper) s += ",bgPaper:'" + q(d.bgPaper) + "'";
  if (tier !== 'basic') s += ",tier:'" + tier + "'";
  if (tier === 'vip') s += ",part:'" + (d.part || 'gold') + "',scene:'" + (d.scene || 'zoom') + "'";
  /* dko/flt/dvd: '' = ikut border, 'none' = sengaja dimatikan, selain itu id hiasan. */
  ['dko', 'flt', 'dvd'].forEach((k) => { if (d[k]) s += ',' + k + ":'" + d[k] + "'"; });
  return s;
}
function barisStudio(d) {
  const harga = parseInt(d.harga, 10);
  return ' {id:\'' + d.id + '\',nama:\'' + q(d.nama) + '\',ev:\'' + d.ev + '\',harga:' + harga
    + ',g:[\'' + d.g.join("','") + '\'],accent:\'' + d.accent + '\',ink:\'' + d.ink + '\',badge:\'' + q(d.badge)
    + '\',deco:\'' + q(d.deco) + '\',pat:\'' + (d.pat || '') + '\',ft:\'' + (d.ft || 'cormorant') + '\',desc:\'' + q(d.desc) + '\'' + ekor(d) + recKode(d) + '},';
}
function barisUndangan(d) {
  return ' {id:\'' + d.id + '\',nama:\'' + q(d.nama) + '\',ev:\'' + d.ev + '\',g:[\'' + d.g.join("','") + '\']'
    + ',accent:\'' + d.accent + '\',ink:\'' + d.ink + '\',deco:\'' + q(d.deco) + '\',pat:\'' + (d.pat || '') + '\',ft:\'' + (d.ft || 'cormorant') + '\'' + ekor(d) + recKode(d) + '},';
}
function barisIndex(d) {
  const harga = parseInt(d.harga, 10);
  const rating = Number(d.rating) || 4.9;
  const reviews = parseInt(d.reviews, 10) || 0;
  return ' {id:"' + d.id + '",name:"' + q(d.nama).replace(/"/g, '\u201d') + '",category:"' + KATEGORI[d.ev] + '"'
    + ',price:' + harga + ',rating:' + rating + ',reviews:' + reviews + (bestseller(d.badge) ? ',bestseller:!0' : '')
    + ',gradient:"from-[' + d.g[0] + '] via-[' + d.g[1] + '] to-[' + d.g[2] + ']",accent:"' + d.accent + '"'
    + ',description:"' + q(d.desc).replace(/"/g, '\u201d') + '"},';
}
function ruleCss(d) {
  const rgb = (c) => { const x = hexKeRgb(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',0)'; };
  const sel = (nama, warna) => '.' + nama + '-\\[\\#' + warna.slice(1) + '\\]';
  return '/* AsProject — gradasi template kustom (' + d.id + ') */\n'
    + sel('from', d.g[0]) + '{--tw-gradient-from:' + d.g[0].toLowerCase() + ' var(--tw-gradient-from-position);--tw-gradient-to:' + rgb(d.g[0]) + ' var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}\n'
    + sel('via', d.g[1]) + '{--tw-gradient-to:' + rgb(d.g[1]) + ' var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),' + d.g[1].toLowerCase() + ' var(--tw-gradient-to-position),var(--tw-gradient-to)}\n'
    + sel('to', d.g[2]) + '{--tw-gradient-to:' + d.g[2].toLowerCase() + ' var(--tw-gradient-to-position)}';
}

/* ---------- mesin (dibaca dari berkas repo) ---------- */
function bacaMesin() {
  const studio = baca('studio.html');
  const obj = (nama) => idObjek(studio, nama) || [], arr = (nama) => idArray(studio, nama) || [];
  /* Daftar motif dibaca dari patCss() saja supaya cabang lain (mis. titik-titik pada
     efek animasi) tidak ikut terbaca sebagai motif. */
  const isiPat = studio.slice(studio.indexOf('function patCss(t){'));
  const akhirPat = isiPat.indexOf('\n}', isiPat.indexOf('t.pat===', 10));
  return {
    fonts: obj('FONTS'),
    borders: obj('BORDERS'),
    fxCover: arr('FX_COVER'),
    fxScroll: arr('FX_SCROLL'),
    slides: obj('SLIDES'),
    pat: (isiPat.slice(0, akhirPat < 0 ? undefined : akhirPat).match(/t\.pat==='([a-z]+)'/g) || [])
      .map((x) => x.replace(/^t\.pat==='/, '').replace(/'$/, '')),
    dko: arr('DKO_IDS'),
    flt: arr('FLT_IDS'),
    dvd: arr('DVD_IDS'),
  };
}
const tplSudahAda = (rel) => {
  const s = baca(rel);
  const i = s.indexOf('const TPL=[');
  return i < 0 ? [] : (s.slice(i, akhirArray(s, s.indexOf('[', i))).match(/\{id:'([^']+)'/g) || []).map((x) => x.replace(/\{id:'/, '').replace(/'$/, ''));
};
const pnSudahAda = () => {
  const s = baca('index.html');
  const i = s.indexOf('var Pn=[');
  return i < 0 ? [] : (s.slice(i, akhirArray(s, s.indexOf('[', i))).match(/\{id:"([^"]+)"/g) || []).map((x) => x.replace(/\{id:"/, '').replace(/"$/, ''));
};

/* ---------- pemasangan ---------- */
function sisipArray(teks, pembuka, baris) {
  const i = teks.indexOf(pembuka);
  if (i < 0) throw new Error('tidak menemukan ' + pembuka);
  const tutup = akhirArray(teks, teks.indexOf('[', i));
  const kepala = teks.slice(0, tutup), ekor = teks.slice(tutup);
  /* Elemen terakhir biasanya belum berkoma — tambahkan supaya tidak jadi
     dua elemen yang berdampingan tanpa pemisah. */
  const koma = /,[ \t\n\r]*$/.test(kepala) ? '' : ',';
  return kepala.replace(/[ \t\n\r]*$/, '') + koma + '\n' + baris + '\n' + ekor;
}
function sisipCss(teks, blok) {
  const jangkar = teks.lastIndexOf('--tw-gradient-from');
  const i = jangkar > 0 ? teks.indexOf('</style>', jangkar) : teks.indexOf('</style>');
  if (i < 0) throw new Error('tidak menemukan </style> untuk rule gradasi');
  return teks.slice(0, i) + blok + '\n' + teks.slice(i);
}
function perbaruiHero(teks, jumlah) {
  return teks.replace(/(\d+) template siap pakai/, jumlah + ' template siap pakai');
}

function tulisCadangan(rel, kering) {
  const cadangan = rel + '.bak-template';
  if (ada(cadangan)) return cadangan + ' (sudah ada, dibiarkan)';
  if (!kering) fs.copyFileSync(path.join(ROOT, rel), path.join(ROOT, cadangan));
  return cadangan;
}
function pasang(rel, isiBaru, kering) {
  const cadangan = tulisCadangan(rel, kering);
  if (!kering) fs.writeFileSync(path.join(ROOT, rel), isiBaru);
  return cadangan;
}

function batalkan() {
  let n = 0;
  for (const rel of ['studio.html', 'undangan.html', 'index.html']) {
    const cadangan = rel + '.bak-template';
    if (!ada(cadangan)) continue;
    fs.copyFileSync(path.join(ROOT, cadangan), path.join(ROOT, rel));
    fs.unlinkSync(path.join(ROOT, cadangan));
    console.log('  ' + TXT.ok + ' ' + rel + ' dikembalikan dari cadangan');
    n++;
  }
  if (!n) console.log('  ' + TXT.warn + ' tidak ada cadangan *.bak-template — tidak ada yang dikembalikan.');
  else console.log('\nSelesai. Jalankan python3 tools/cek-kesehatan.py untuk memastikan repo sehat.');
  process.exit(0);
}

function main() {
  const arg = process.argv.slice(2);
  const kering = arg.includes('--kering');
  if (!arg.length || arg.includes('--help') || arg.includes('-h')) {
    console.log('Pakai: node tools/pasang-template.cjs <tema.json> [--kering] | --batalkan');
    process.exit(0);
  }
  if (arg.includes('--batalkan')) return batalkan();
  const berkas = arg.filter((x) => !x.startsWith('--'))[0];
  if (!berkas) { console.log(TXT.bad + ' Nama berkas JSON belum diberikan.'); process.exit(1); }
  const jalur = path.isAbsolute(berkas) ? berkas : path.resolve(process.cwd(), berkas);
  if (!fs.existsSync(jalur)) { console.log(TXT.bad + ' Berkas tidak ditemukan: ' + berkas); process.exit(1); }

  let d;
  try { d = JSON.parse(fs.readFileSync(jalur, 'utf8')); }
  catch (e) { console.log(TXT.bad + ' JSON tidak bisa dibaca: ' + e.message); process.exit(1); }
  d = Array.isArray(d) ? d[0] : d;

  console.log('\nPasang tema dari ' + path.basename(jalur) + (kering ? '  (mode --kering: tidak menulis apa pun)' : ''));
  const mesin = bacaMesin();
  const { masalah, catatan } = periksaData(d, mesin);
  const studioIds = tplSudahAda('studio.html'), undanganIds = tplSudahAda('undangan.html'), pnIds = pnSudahAda();
  const sudahStudio = studioIds.includes(d.id), sudahUndangan = undanganIds.includes(d.id), sudahKatalog = pnIds.includes(d.id);

  masalah.forEach((b) => console.log('  ' + TXT.bad + ' ' + d.id + ': ' + b));
  catatan.forEach((b) => console.log('  ' + TXT.warn + ' ' + b));
  if (masalah.length) { console.log('\nTidak dipasang — perbaiki ' + masalah.length + ' masalah di atas (pakai "Hitung teks aman" di Studio Template bila soal kontras).\n'); process.exit(1); }
  if (studioIds.length !== undanganIds.length) console.log('  ' + TXT.warn + ' catatan: jumlah tema di studio.html (' + studioIds.length + ') dan undangan.html (' + undanganIds.length + ') berbeda — cek-kesehatan akan melaporkannya.');
  if (sudahStudio && sudahUndangan && sudahKatalog) { console.log('  ' + TXT.titik + ' id "' + d.id + '" sudah terpasang di ketiga berkas — tidak ada yang diubah.\n'); process.exit(0); }

  let studioBaru = baca('studio.html'), undanganBaru = baca('undangan.html'), indexBaru = baca('index.html');
  if (!sudahStudio) studioBaru = sisipArray(studioBaru, 'const TPL=[', barisStudio(d));
  if (!sudahUndangan) undanganBaru = sisipArray(undanganBaru, 'const TPL=[', barisUndangan(d));
  if (!sudahKatalog) {
    indexBaru = sisipArray(indexBaru, 'var Pn=[', barisIndex(d));
    if (!/AsProject — gradasi template kustom \(' ?\+?/.test(indexBaru) || indexBaru.indexOf('gradasi template kustom') < 0) indexBaru = indexBaru;
    if (!indexBaru.includes('gradasi template kustom (' + d.id + ')')) indexBaru = sisipCss(indexBaru, ruleCss(d));
    indexBaru = perbaruiHero(indexBaru, pnIds.length + 1);
  }

  const laporan = [];
  if (!sudahStudio) laporan.push(['studio.html', 'baris TPL lengkap', pasang('studio.html', studioBaru, kering)]);
  if (!sudahUndangan) laporan.push(['undangan.html', 'baris TPL ringkas (urutan id sama)', pasang('undangan.html', undanganBaru, kering)]);
  if (!sudahKatalog) laporan.push(['index.html', 'kartu katalog + rule CSS gradasi + jumlah tema', pasang('index.html', indexBaru, kering)]);
  if (sudahStudio) console.log('  ' + TXT.titik + ' studio.html: id sudah ada, dilewati');
  if (sudahUndangan) console.log('  ' + TXT.titik + ' undangan.html: id sudah ada, dilewati');
  if (sudahKatalog) console.log('  ' + TXT.titik + ' index.html: id sudah ada di katalog, dilewati');

  console.log('\nTema "' + (d.nama || d.id) + '" (' + d.id + ') siap: tier ' + tierDari(parseInt(d.harga, 10)) + ', kategori ' + KATEGORI[d.ev] + '.');
  const dekoAktif = ['dko', 'flt', 'dvd'].filter((k) => d[k]).map((k) => k + ":'" + d[k] + "'");
  console.log('  tema di katalog: ' + pnIds.length + ' → ' + (sudahKatalog ? pnIds.length : pnIds.length + 1)
    + (dekoAktif.length ? '  ·  dekorasi: ' + dekoAktif.join(', ') : '  ·  tanpa dekorasi tambahan'));
  console.log('\nBerkas diperbarui' + (kering ? ' (rencana)' : '') + ':');
  laporan.forEach(([rel, isi, cadangan]) => console.log('  ' + TXT.ok + ' ' + rel.padEnd(14) + ' — ' + isi + (kering ? '' : '  (cadangan: ' + cadangan + ')')));
  if (kering) console.log('\nMode --kering: tidak ada berkas yang diubah. Jalankan tanpa --kering untuk memasang.');
  else console.log('\nKembalikan kapan saja dengan: node tools/pasang-template.cjs --batalkan');
  console.log('\nLangkah berikutnya:');
  console.log('  1. python3 tools/cek-kesehatan.py        (harus 0 masalah)');
  console.log('  2. node tools/test-template-studio.cjs');
  console.log('  3. npm i jsdom && node tools/test-wedding-templates.cjs   (uji render, opsional)');
  console.log('  4. git add -A && git commit -m "tambah template ' + d.id + '"\n');
}
main();
