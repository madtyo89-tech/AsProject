#!/usr/bin/env node
/*
 * Uji Studio Template — memastikan perancang template tetap SEJALAN dengan mesin
 * undangan (studio.html & undangan.html) dan tetap aman dipasang ke repo.
 *
 *   node tools/test-template-studio.cjs
 *
 * Yang diperiksa:
 *   1. (statis) template-studio.html memuat salinan mesin yang identik:
 *      FONTS 17, BORDERS 32, FX_COVER 14, FX_SCROLL 34, SLIDES 10, pola patCss
 *   2. (statis) 13 tema bawaan identik & berurutan sama dengan studio.html,
 *      undangan.html, dan katalog index.html
 *   3. (statis) halaman bersih: tidak ada id ganda, tidak ada "</script" di dalam
 *      skrip, semua berkas yang dirujuk ada
 *   4. (jsdom) halaman hidup: duplikat tema, pratinjau cover/isi, pemeriksaan mutu,
 *      hitung teks aman, ekspor 4 bagian, JSON, demo HTML, localStorage, ?dup=
 *   5. tools/pasang-template.cjs: memasang ke SALINAN repo, idempoten,
 *      memperbarui katalog + rule CSS + angka hero, dan bisa dibatalkan
 *   6. penolakan JSON cacat (id lama, font tak dikenal, kontras buruk)
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let lulus = 0, gagal = 0;
const cek = (syarat, pesan, info) => {
  if (syarat) { lulus++; console.log('  ok  ' + pesan); }
  else { gagal++; console.log('  [FAIL] ' + pesan + (info ? ' → ' + info : '')); }
};

/* ---------- pembaca array sumber (tahan string & tanda kurung) ---------- */
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
function blokArray(teks, pembuka) {
  const i = teks.indexOf(pembuka);
  if (i < 0) return '';
  const b = teks.indexOf('[', i);
  return teks.slice(b + 1, akhirArray(teks, b));
}
const idObjek = (b) => (b.match(/\{\s*id\s*:\s*'([^']+)'/g) || []).map((x) => x.replace(/^\{\s*id\s*:\s*'/, '').replace(/'$/, ''));
const idFx = (b) => (b.match(/\[\s*'([^']+)'/g) || []).map((x) => x.replace(/^\[\s*'/, '').replace(/'$/, ''));
const ambil = (b, kunci) => { const m = b.match(new RegExp(kunci + ":\\s*'([^']*)'")); return m ? m[1] : ''; };
const barisTpl = (teks) => (blokArray(teks, 'const TPL=[').split("{id:'").slice(1));

/* ============================================================ 1. statis */
console.log('\n1) Mesin di template-studio.html sejalan dengan studio.html');
const hal = baca('template-studio.html');
const studio = baca('studio.html');
const undangan = baca('undangan.html');
const index = baca('index.html');
const mesinHal = (pembuka) => blokArray(hal, pembuka);
cek(idObjek(mesinHal('const FONTS=')).length === 17, 'FONTS 17 font disalin', String(idObjek(mesinHal('const FONTS=')).length));
cek(JSON.stringify(idObjek(mesinHal('const FONTS='))) === JSON.stringify(idObjek(blokArray(studio, 'const FONTS='))), 'urutan id font sama dengan studio.html');
cek(idObjek(mesinHal('const BORDERS=')).length === 32, 'BORDERS 32 border disalin');
cek(JSON.stringify(idObjek(mesinHal('const BORDERS='))) === JSON.stringify(idObjek(blokArray(studio, 'const BORDERS='))), 'urutan id border sama dengan studio.html');
cek(JSON.stringify(idFx(mesinHal('const FX_COVER='))) === JSON.stringify(idFx(blokArray(studio, 'const FX_COVER='))), 'FX_COVER sama dengan studio.html');
cek(JSON.stringify(idFx(mesinHal('const FX_SCROLL='))) === JSON.stringify(idFx(blokArray(studio, 'const FX_SCROLL='))), 'FX_SCROLL sama dengan studio.html');
cek(JSON.stringify(idFx(mesinHal('const FX_SCROLL_MIX='))) === JSON.stringify(idFx(blokArray(studio, 'const FX_SCROLL_MIX='))), 'FX_SCROLL_MIX sama dengan studio.html');
cek(JSON.stringify(idObjek(mesinHal('const SLIDES='))) === JSON.stringify(idObjek(blokArray(studio, 'const SLIDES='))), 'SLIDES 10 bagian sama dengan studio.html');
cek(hal.includes('function patCss(t)') && /t\.pat==='batik'/.test(hal), 'patCss() ikut disalin (motif digambar sama)');
cek(hal.includes('function fxScrollForSection(base,index,mix') && hal.includes('function fxScrollAxis(id)'), 'pemilih efek gulir per bagian ikut disalin');
cek(hal.includes('const TEMA_LAMA=['), 'daftar id tema lama dicek di halaman');

console.log('\n2) 13 tema bawaan identik & berurutan');
const bawaan = barisTpl(hal.replace('const TPL_BAWAAN=[', 'const TPL=['));
const tplStudio = barisTpl(studio), tplUndangan = barisTpl(undangan);
cek(bawaan.length === 13, '13 tema bawaan ada di Studio Template', String(bawaan.length));
cek(idObjek(blokArray(hal, 'const TPL_BAWAAN=')).join() === idObjek(blokArray(studio, 'const TPL=')).join(), 'urutan id sama dengan studio.html');
cek(idObjek(blokArray(hal, 'const TPL_BAWAAN=')).join() === idObjek(blokArray(undangan, 'const TPL=')).join(), 'urutan id sama dengan undangan.html');
cek(idObjek(blokArray(hal, 'const TPL_BAWAAN=')).join() === (index.match(/\{id:"([^"]+)"/g) || []).slice(0, 13).map((x) => x.replace(/\{id:"/, '').replace(/"$/, '')).join(), 'urutan id sama dengan katalog index.html');
const sama = (a, b, kunci) => kunci.every((k) => (k === 'g' ? JSON.stringify(a.match(/g:\[[^\]]+\]/)) === JSON.stringify(b.match(/g:\[[^\]]+\]/)) : ambil(a, k) === ambil(b, k)));
const bidangStudio = ['id', 'nama', 'ev', 'accent', 'ink', 'badge', 'deco', 'pat', 'ft', 'char'];
const bidangUndangan = ['id', 'nama', 'ev', 'accent', 'ink', 'deco', 'pat', 'ft', 'char'];
const bedaStudio = bawaan.filter((b, i) => !tplStudio[i] || !sama(b, tplStudio[i], bidangStudio));
const bedaUndangan = bawaan.filter((b, i) => !tplUndangan[i] || !sama(b, tplUndangan[i], bidangUndangan));
cek(bedaStudio.length === 0, 'isi tema sama dengan studio.html', bedaStudio.map((b) => ambil(b, 'id')).join(','));
cek(bedaUndangan.length === 0, 'isi tema sama dengan undangan.html', bedaUndangan.map((b) => ambil(b, 'id')).join(','));

console.log('\n3) Halaman bersih & mandiri');
const idHtml = (hal.match(/\sid="([^"]+)"/g) || []).map((x) => x.slice(4, -1));
const idGanda = [...new Set(idHtml.filter((x) => idHtml.filter((y) => y === x).length > 1))];
cek(idGanda.length === 0, 'tidak ada id ganda', idGanda.join(','));
const blokSkrip = hal.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
cek(blokSkrip.length === 1, 'satu blok skrip aplikasi', String(blokSkrip.length));
cek(blokSkrip.every((b) => !/<\/script/i.test(b.slice(0, -9))), 'tidak ada "</script" di tengah skrip (string pun ditulis <\\/script)');
const aset = [...new Set((hal.match(/(?:src|href)="(assets\/[^"]+)"/g) || []).map((x) => x.replace(/^[^"]*"/, '').replace(/"$/, '')))];
const asetHilang = aset.filter((a) => !fs.existsSync(path.join(ROOT, a)));
cek(asetHilang.length === 0, 'semua berkas assets/ yang dirujuk ada (' + aset.length + ')', asetHilang.join(','));
cek(hal.includes('assets/theme-contrast.js') && hal.includes('assets/scroll-effects.js'), 'memakai kontras tema & efek gulir milik repo');
cek(hal.includes('tools/pasang-template.cjs'), 'menyebut skrip pemasang di panduan/ekspor');

/* ============================================================ 4. jsdom */
console.log('\n4) Halaman hidup (jsdom)');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* opsional */ }
if (!JSDOM) {
  console.log('  (dilewati: jsdom belum terpasang — npm install --no-save jsdom)');
} else {
  const buka = (url) => new JSDOM(hal, { runScripts: 'dangerously', pretendToBeVisual: true, url: url || 'https://asproject.my.id/template-studio.html' });
  const dom = buka(), w = dom.window, d = w.document;
  cek(!!w.TS && d.querySelectorAll('.tabbtn').length === 8, 'halaman memuat & 8 tab editor dirender');
  cek(d.querySelector('#libList').textContent.includes('Ivory Klasik'), 'koleksi 13 tema bawaan tampil');
  w.duplikat('minimalist-sage');
  const t = w.tpl();
  cek(w.TS.user.length === 1 && t.id === 'minimalist-sage-2', 'duplikat tema bawaan masuk koleksi dengan id unik', t.id);
  cek(t.rec.slides.length > 0 && t.ft === 'cormorant', 'resep tema (font, bagian) ikut tersalin');
  const pv = d.querySelector('#gelut').innerHTML;
  cek(pv.includes('id="cover"') && pv.includes('class="bdfr"') && pv.includes('class="pat"'), 'pratinjau cover memakai struktur & kelas mesin undangan');
  cek(!w.periksa().some((r) => r.st === 'bad'), 'salinan tema bawaan lolos pemeriksaan', w.periksa().filter((r) => r.st === 'bad').map((r) => r.b).join(' | '));
  w.ubah('id', 'ivory-klasik');
  cek(w.periksa().some((r) => r.st === 'bad' && /bentrok/.test(r.b)), 'id bentrok dengan tema bawaan ditandai masalah');
  w.ubah('id', 'uji-studio'); w.ubah('g.2', '#F2F2F2'); w.ubah('ink', '#F4F4F4');
  cek(w.periksa().some((r) => r.st === 'bad' && /Kontras/.test(r.b)), 'kontras buruk ditandai masalah');
  w.aksi('inkAman');
  const tk = w.tpl();
  cek(w.kontras(tk.ink, tk.g[0]) >= 3 && w.kontras(tk.ink, tk.g[2]) >= 3 && w.kontras(tk.ink, '#fffdf9') >= 4.5,
    'Hitung teks aman: cover ≥3:1 dan kartu isi ≥4.5:1', [w.kontras(tk.ink, tk.g[0]), w.kontras(tk.ink, tk.g[2]), w.kontras(tk.ink, '#fffdf9')].map((x) => x.toFixed(2)).join('/'));
  const st = w.rowStudio(tk), un = w.rowUndangan(tk), ix = w.rowIndex(tk), css = w.ruleCss(tk);
  cek(/^ \{id:'uji-studio',nama:'.+',ev:'(pernikahan|all)',harga:\d+,g:\['#/.test(st), 'baris studio.html sesuai bentuk mesin');
  cek(st.includes("rec:{body:'") && st.includes("border:'") && st.includes("slides:["), 'baris studio memuat resep (rec)');
  cek(!/harga|desc:|badge/.test(un), 'baris undangan ringkas (tanpa harga/desc/badge)');
  cek(/^ \{id:"uji-studio",name:".+",category:"/.test(ix) && ix.includes('gradient:"from-['), 'baris katalog index.html sesuai');
  cek(css.includes('.from-\\[\\#' + tk.g[0].slice(1) + '\\]{') && css.includes('.via-\\[\\#') && css.includes('.to-\\[\\#'), 'rule CSS gradasi memakai backslash tunggal (pola yang dicari checker)');
  cek(w.semuaSnippet(tk).split('/* =====').length === 5, '"Semua kode" memuat 4 bagian siap tempel');
  const js = JSON.parse(w.teksJson(tk));
  cek(js.id === 'uji-studio' && js.rec && Array.isArray(js.rec.slides) && js.g.length === 3, 'JSON tema sah & lengkap');
  const demo = w.htmlDemo(tk);
  cek(demo.includes('id="cover"') && demo.includes('</html>') && demo.includes('.from-') === false, 'demo HTML mandiri terbentuk');
  w.setMode('isi');
  cek(/scroll-reveal/.test(d.querySelector('#gelut').innerHTML), 'mode isi memakai scroll-reveal milik repo');
  w.setMode('cover'); w.putarAnim();
  cek(d.querySelector('#gelut').innerHTML.includes('class="cov"'), 'animasi cover bisa diputar ulang');
  w.bukaEkspor();
  cek(d.querySelector('#modal').classList.contains('on') && d.querySelector('#kodeEkspor-json') !== null, 'modal Ekspor & pasang bekerja');
  w.tabEkspor('studio');
  cek((d.querySelector('#kodeEkspor-studio').value || '').trim().startsWith("{id:'uji-studio'"), 'tab studio.html menampilkan baris tema');
  w.tutupModal();
  w.terapkanImpor(JSON.stringify({ id: 'uji-studio', nama: 'Impor Uji', g: ['#FFFFFF', '#EEEEEE', '#DDDDDD'] }));
  cek(w.TS.user.length === 2 && w.TS.user[1].id === 'uji-studio-2', 'impor tidak menimpa id yang sudah ada');
  cek(!!w.localStorage.getItem('asproject.templateStudio.v1'), 'koleksi tersimpan di localStorage');
  const dom2 = buka('https://asproject.my.id/template-studio.html?dup=jawa-elegan');
  cek(dom2.window.TS.user.length === 1 && dom2.window.tpl().id === 'jawa-elegan-2', '?dup=<id> membuka tema bawaan sebagai salinan siap ubah');
  dom.window.close(); dom2.window.close();
}

/* ================================== 5. pasang-template.cjs di salinan repo */
console.log('\n5) tools/pasang-template.cjs pada salinan repo');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asproject-ts-'));
['studio.html', 'undangan.html', 'index.html'].forEach((f) => fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f)));
fs.mkdirSync(path.join(tmp, 'tools'));
fs.copyFileSync(path.join(ROOT, 'tools', 'pasang-template.cjs'), path.join(tmp, 'tools', 'pasang-template.cjs'));
const md5 = (f) => require('node:crypto').createHash('md5').update(fs.readFileSync(path.join(tmp, f))).digest('hex');
const sidikAwal = { studio: md5('studio.html'), undangan: md5('undangan.html'), index: md5('index.html') };
const tema = {
  v: 1, id: 'uji-pasang', nama: 'Uji Pasang', ev: 'pernikahan', harga: 75000,
  g: ['#EAF0EC', '#D6E2DA', '#BFD0C6'], accent: '#3F6B57', ink: '#2E4A3D',
  badge: 'LARIS', deco: '✦ ❖ ✦', pat: 'botanical', ft: 'cormorant', body: 'inter', char: 'UJI',
  desc: 'Tema uji pemasang — hijau tenang untuk akad di taman.',
  rec: { border: 'thin', cover: 'fade', scroll: 'fade-up', mix: true, slides: ['quote', 'timeline', 'map', 'rsvp'] },
};
fs.writeFileSync(path.join(tmp, 'uji-pasang.json'), JSON.stringify(tema));
const jalan = (arg) => { try { return { kode: 0, keluaran: execFileSync('node', ['tools/pasang-template.cjs', ...arg], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { kode: e.status || 1, keluaran: String((e.stdout || '') + (e.stderr || '')) }; } };
/* Sama seperti cek-kesehatan.py [3]: periksa sintaks tiap <script> yang benar-benar JS
   dengan node --check (menangkap kesalahan seperti koma yang hilang di array). */
const sintaksBersih = (f) => (fs.readFileSync(path.join(tmp, f), 'utf8').match(/<script([^>]*)>([\s\S]*?)<\/script>/g) || [])
  .filter((b) => {
    const tipe = (b.match(/<script[^>]*type=["']([^"']+)["']/) || ['', ''])[1].toLowerCase();
    return ['', 'text/javascript', 'module', 'application/javascript'].includes(tipe) && b.replace(/<[^>]*>/g, '').trim();
  })
  .every((b) => {
    const js = b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    const tmpJs = path.join(os.tmpdir(), 'asproject-sintaks-' + Math.random().toString(36).slice(2) + '.js');
    fs.writeFileSync(tmpJs, js);
    let sah = true;
    try { execFileSync('node', ['--check', tmpJs], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { sah = false; }
    fs.unlinkSync(tmpJs);
    return sah;
  });

const kering = jalan(['uji-pasang.json', '--kering']);
cek(kering.kode === 0 && /--kering/.test(kering.keluaran), 'mode --kering lulus tanpa menulis', kering.keluaran.slice(-120));
cek(md5('studio.html') === sidikAwal.studio && md5('index.html') === sidikAwal.index, '--kering benar-benar tidak mengubah berkas');
const pasang = jalan(['uji-pasang.json']);
cek(pasang.kode === 0, 'pemasangan berhasil', pasang.keluaran.slice(-160));
const stu = fs.readFileSync(path.join(tmp, 'studio.html'), 'utf8');
const und = fs.readFileSync(path.join(tmp, 'undangan.html'), 'utf8');
const idx = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
cek(blokArray(stu, 'const TPL=[').includes("id:'uji-pasang'"), 'baris masuk ke array TPL studio.html');
cek(blokArray(und, 'const TPL=[').includes("id:'uji-pasang'"), 'baris masuk ke array TPL undangan.html');
cek(idObjek(blokArray(stu, 'const TPL=')).length === 14 && idObjek(blokArray(und, 'const TPL=')).length === 14, 'jumlah tema jadi 14 di studio & undangan');
cek(blokArray(idx, 'var Pn=[').includes('"uji-pasang"'), 'kartu katalog masuk ke var Pn');
cek(idx.includes('.from-\\[\\#' + tema.g[0].slice(1) + '\\]{') && idx.includes('gradasi template kustom (uji-pasang)'), 'rule CSS gradasi katalog ditambahkan');
cek(/14 template siap pakai/.test(idx), 'angka hero katalog diperbarui (14 template)');
cek((blokArray(idx, 'var Pn=[').match(/\{id:"/g) || []).length === 14, 'katalog berisi 14 kartu tema');
cek(sintaksBersih('studio.html') && sintaksBersih('undangan.html') && sintaksBersih('index.html'), 'JS studio.html, undangan.html & index.html tetap sah setelah dipatch');
cek(fs.existsSync(path.join(tmp, 'studio.html.bak-template')), 'cadangan .bak-template dibuat');
const lagi = jalan(['uji-pasang.json']);
cek(lagi.kode === 0 && /sudah terpasang|sudah ada/.test(lagi.keluaran), 'dijalankan dua kali tidak menggandakan baris');
const batal = jalan(['--batalkan']);
cek(batal.kode === 0, '--batalkan berjalan');
cek(md5('studio.html') === sidikAwal.studio && md5('undangan.html') === sidikAwal.undangan && md5('index.html') === sidikAwal.index, '--batalkan mengembalikan ketiga berkas persis seperti semula');
cek(!fs.existsSync(path.join(tmp, 'studio.html.bak-template')), 'cadangan dibersihkan setelah --batalkan');

console.log('\n6) JSON cacat ditolak');
const cacat = (ubah) => { const d = JSON.parse(JSON.stringify(tema)); d.id = 'uji-cacat'; fs.writeFileSync(path.join(tmp, 'uji-cacat.json'), JSON.stringify(ubah(d))); return jalan(['uji-cacat.json', '--kering']); };
cek(cacat((d) => { d.id = 'ice-blue'; return d; }).kode === 1, 'id TEMA_LAMA ditolak');
cek(cacat((d) => { d.ft = 'comic-sans'; return d; }).kode === 1, 'font tak dikenal ditolak');
cek(cacat((d) => { d.ink = '#EFEFEF'; return d; }).kode === 1, 'teks cover tanpa kontras ditolak');
cek(cacat((d) => { d.rec.slides = ['pesta']; return d; }).kode === 1, 'bagian (slide) tak dikenal ditolak');
cek(cacat((d) => { d.bg3d = 'assets/tema-3d/belum-ada.webp'; return d; }).kode === 1, 'artwork yang belum ada ditolak');
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
console.log('Yang tetap butuh mata manusia: rasa tampilan, animasi, dan keseluruhan nuansa tema.');
process.exit(gagal ? 1 : 0);
