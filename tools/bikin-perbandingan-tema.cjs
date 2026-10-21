#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   bikin-perbandingan-tema.cjs — membangun katalog-demo/perbandingan-tema.html

   Halaman perbandingan ini TIDAK menyimpan daftar tema sendiri. Semua data
   (TPL, CV_LAYOUTS, FONTS, patCss) dipanen langsung dari studio.html dan
   undangan.html, jadi kalau katalog berubah tinggal jalankan ulang skrip ini
   dan halamannya ikut berubah — tidak ada risiko drift.

   Pemakaian:
     node tools/bikin-perbandingan-tema.cjs
     python3 tools/serve.py            # buka /katalog-demo/perbandingan-tema.html

   Catatan: blok yang di-eval hanya berisi data (object/array literal) dan satu
   fungsi murni patCss(), jadi aman dijalankan di luar browser.
   --------------------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'katalog-demo', 'perbandingan-tema.html');

function baca(berkas) {
  const p = path.join(ROOT, berkas);
  if (!fs.existsSync(p)) throw new Error(`Berkas tidak ditemukan: ${berkas}`);
  return fs.readFileSync(p, 'utf8');
}

/* Ambil blok array literal seimbang: mulai dari '[' setelah penanda sampai
   penutup ']' yang cocok (menghitung kurung di dalam string juga). */
function potongArray(src, penanda, berkas) {
  const i = src.indexOf(penanda);
  if (i < 0) throw new Error(`Penanda "${penanda}" tidak ditemukan di ${berkas}`);
  const mulai = src.indexOf('[', i);
  let dalam = 0, kutip = null;
  for (let j = mulai; j < src.length; j++) {
    const c = src[j];
    if (kutip) {
      if (c === '\\') { j++; continue; }
      if (c === kutip) kutip = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { kutip = c; continue; }
    if (c === '[') dalam++;
    else if (c === ']') { dalam--; if (dalam === 0) return src.slice(mulai, j + 1); }
  }
  throw new Error(`Array "${penanda}" tidak seimbang di ${berkas}`);
}

/* Ambil badan fungsi sampai kurung kurawal seimbang. */
function potongFungsi(src, penanda, berkas) {
  const i = src.indexOf(penanda);
  if (i < 0) throw new Error(`Penanda "${penanda}" tidak ditemukan di ${berkas}`);
  const mulai = src.indexOf('{', i);
  let dalam = 0, kutip = null;
  for (let j = mulai; j < src.length; j++) {
    const c = src[j];
    if (kutip) {
      if (c === '\\') { j++; continue; }
      if (c === kutip) kutip = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { kutip = c; continue; }
    if (c === '{') dalam++;
    else if (c === '}') { dalam--; if (dalam === 0) return src.slice(i, j + 1); }
  }
  throw new Error(`Fungsi "${penanda}" tidak seimbang di ${berkas}`);
}

const studio = baca('studio.html');
const live = baca('undangan.html');

const TPL = eval(potongArray(studio, 'const TPL=[', 'studio.html'));
const CV_LAYOUTS = eval(potongArray(studio, 'const CV_LAYOUTS=[', 'studio.html'));
const FONTS = eval(potongArray(live, 'const FONTS=[', 'undangan.html'));
/* Pola latar kini hidup di registri POLA (tools/pola-blok.js) yang ditempel ke
   undangan.html & studio.html. polaCss() fungsi murni (data -> string CSS),
   jadi dijalankan di sini saja — halaman hasil tidak perlu JS untuk tekstur. */
const polaApi = eval('(function(){' + baca('tools/pola-blok.js') + ';return{polaCss:polaCss}})()');
const patCss = (t) => polaApi.polaCss(t && t.pat, t, 1);
/* Kerangka per tema: LAYOUTS (preset) dan URUTAN (varian susunan bagian) murni
   data, jadi bisa dipanen & dipakai langsung di sini. */
/* potongFungsi() mengembalikan teks mulai dari PENANDA (ikut "const X="), beda
   dengan potongArray() yang mulai dari '['. Jadi prefix-nya dipotong dulu. */
const LAYOUTS = eval('(' + potongFungsi(live, 'const LAYOUTS={', 'undangan.html').replace(/^const LAYOUTS=/, '') + ')');
const URUTAN = eval('(' + potongFungsi(live, 'const URUTAN={', 'undangan.html').replace(/^const URUTAN=/, '') + ')');
const LABEL_BAGIAN = {
  guest: 'Tamu', doa: 'Doa', profil: 'Nama', harapan: 'Harapan', acara: 'Acara',
  timeline: 'Alur', story: 'Kisah', quote: 'Kutipan', menu: 'Menu', party: 'Panitia',
  dresscode: 'Busana', map: 'Peta', gift: 'Kado', rsvp: 'RSVP', closing: 'Penutup',
  bukutamu: 'Buku Tamu', galeri: 'Galeri', amplop: 'Amplop', ucapan: 'Ucapan',
};
const LABEL_EKSTRA = {
  navDot: 'navigasi titik', babAngka: 'angka romawi', kutipBesar: 'pita kutipan',
  heroFoto: 'pita foto', galeriStrip: 'galeri geser', jamFlip: 'flip-clock',
};
function kerangka(t) {
  const L = LAYOUTS[t.layout] || LAYOUTS.klasik;
  const ur = URUTAN[L.urutan] || URUTAN.A;
  return { L, ur };
}

if (!Array.isArray(TPL) || !TPL.length) throw new Error('TPL kosong — panen gagal.');

const fontOf = id => (FONTS.find(f => f.id === id) || {}).fam || 'Georgia,serif';
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rupiah = n => (typeof n === 'number' ? 'Rp ' + n.toLocaleString('id-ID') : '—');

const EV_LABEL = { pernikahan: 'Pernikahan', khitanan: 'Khitanan', ultah: 'Ultah Anak', aqiqah: 'Aqiqah', all: 'Semua Acara' };
const EV_ICON = { pernikahan: '💍', khitanan: '🕌', ultah: '🎂', aqiqah: '👶', all: '✨' };
const PAT_LABEL = { '': 'polos', batik: 'batik', botanical: 'botanical', frost: 'frost (es)', arab: 'arabesque', confetti: 'confetti' };

/* urutan tampil: tema publik dulu (urut index, index = kolom theme di Supabase),
   lalu varian studioOnly. */
const publik = TPL.map((t, i) => ({ t, i })).filter(x => !x.t.studioOnly);
const internal = TPL.map((t, i) => ({ t, i })).filter(x => x.t.studioOnly);
const layoutPublik = new Set(publik.map(x => x.t.layout || 'klasik')).size;

function kartu(x) {
  const { t, i } = x;
  const g = t.g || ['#fff', '#eee', '#ddd'];
  const gradasi = `linear-gradient(160deg,${g[0]} 0%,${g[1]} 52%,${g[2]} 100%)`;
  const gelap = ['#0', '#1', '#2', '#3'].some(p => String(g[0]).toLowerCase().startsWith(p));
  const teks = t.ink || (gelap ? '#F2E8D5' : '#333');
  return `
<article class="kartu" data-ev="${esc(t.ev)}" data-studio="${t.studioOnly ? '1' : '0'}">
  <div class="panggung" style="background:${gradasi}">
    <div class="pola" style="${esc(patCss(t) || '')}"></div>
    <div class="isi" style="color:${esc(teks)}">
      <!-- Kicker, ornamen (deco) dan label template (chara) TIDAK digambar di sini:
           sejak PR #21 (commit 5e6bef0) undangan.html menyembunyikannya di cover lewat
           aturan CSS "#cover .inner>.kicker, .chara, .orn { display:none !important }".
           Mockup ini sengaja meniru cover yang benar-benar terlihat oleh tamu. -->
      <div class="judul" style="font-family:${esc(fontOf(t.ft))};color:${esc(t.accent)}">${esc(t.nama)}</div>
      <div class="garis" style="background:${esc(t.accent)}"></div>
      <div class="tanggal" style="font-family:${esc(fontOf(t.ft))}">Sabtu, 12 Desember 2026</div>
    </div>
  </div>
  <div class="meta">
    <div class="baris1">
      <span class="idx">#${i}</span>
      <h3>${esc(t.nama)}</h3>
      ${t.badge ? `<span class="badge">${esc(t.badge)}</span>` : ''}
      ${t.studioOnly ? '<span class="badge studio">STUDIO</span>' : ''}
    </div>
    <div class="baris2">
      <span class="ev">${EV_ICON[t.ev] || '✨'} ${EV_LABEL[t.ev] || t.ev}</span>
      <span class="harga">${rupiah(t.harga)}</span>
    </div>
    <p class="desc">${esc(t.desc || '')}</p>
    ${(() => {
      const { L, ur } = kerangka(t);
      const ex = (L.ekstra || []).map(k => LABEL_EKSTRA[k] || k);
      return `
    <div class="kerangka">
      <div class="kjudul"><span class="badge lay">▦ ${esc(L.nama)}</span>
        <span class="mono">shell:${esc(L.shell)} · urutan ${esc(L.urutan)}${L.vip ? ' · 4D' : ''}</span></div>
      <div class="urut">${ur.map((k, n) => `<i title="${esc(LABEL_BAGIAN[k] || k)}"><b>${n + 1}</b>${esc(LABEL_BAGIAN[k] || k)}</i>`).join('')}</div>
      ${ex.length ? `<div class="ekstra">Ekstra: ${ex.map(esc).join(' · ')}</div>` : ''}
    </div>`;
    })()}
    <div class="swatch">
      ${g.map(c => `<i title="${esc(c)}" style="background:${esc(c)}"></i>`).join('')}
      <i class="aksen" title="aksen ${esc(t.accent)}" style="background:${esc(t.accent)}"></i>
      <i class="tinta" title="tinta ${esc(teks)}" style="background:${esc(teks)}"></i>
    </div>
    <dl>
      <div><dt>Font</dt><dd style="font-family:${esc(fontOf(t.ft))}">${esc(t.ft || '—')}</dd></div>
      <div><dt>Pola</dt><dd>${esc(PAT_LABEL[t.pat || ''] || t.pat || 'polos')}</dd></div>
      <div><dt>Ornamen</dt><dd class="mono" title="Sejak PR #21 tidak tampil di cover; masih dipakai di divider & footer">${esc(t.deco || '—')}</dd></div>
      <div><dt>Kerangka</dt><dd>${esc((LAYOUTS[t.layout] || LAYOUTS.klasik).nama)}</dd></div>
      <div><dt>Cover</dt><dd>${t.arch ? 'arch (lengkung)' : 'kotak (bawaan)'}</dd></div>
      <div><dt>id</dt><dd class="mono">${esc(t.id)}</dd></div>
    </dl>
  </div>
</article>`;
}

function barisCover() {
  return CV_LAYOUTS.map(([id, nama, ic, desc], n) => `
<div class="cv"><span class="cvn">${String(n + 1).padStart(2, '0')}</span>
  <b>${ic} ${esc(nama)}</b><code>${esc(id)}</code><p>${esc(desc)}</p></div>`).join('');
}

const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Perbandingan Tema Undangan · AsProject</title>
<meta name="description" content="Perbandingan teknis tema undangan AsProject. Halaman arsip untuk pratinjau; katalog publik terbaru tersedia di asproject.my.id/katalog/.">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://asproject.my.id/katalog-demo/perbandingan-tema.html">
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<link rel="manifest" href="../manifest.webmanifest">
<meta name="theme-color" content="#faf8f4">
<script src="../assets/demo-disclaimer.js" defer></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Playfair+Display:wght@600;700&family=Poppins:wght@400;600;700&family=Inter:wght@400;500;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Montserrat:wght@400;500;600;700&family=Bebas+Neue&family=Oswald:wght@400;500;600&family=EB+Garamond:wght@500;600&family=Merriweather:wght@400;700&family=Work+Sans:wght@400;500;600&family=Pacifico&family=Dancing+Script:wght@600;700&family=Caveat:wght@600;700&family=Sacramento&family=Cinzel:wght@400;600;700&family=Marcellus&display=swap" rel="stylesheet">
<style>
:root{--ink:#22201c;--muted:#6c665c;--line:#e6e0d6;--bg:#faf8f4;--card:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Inter,system-ui,sans-serif}
header{padding:40px 22px 18px;max-width:1400px;margin:0 auto}
h1{font:600 30px/1.15 "Cormorant Garamond",serif;margin:0 0 8px}
header p{color:var(--muted);margin:0;max-width:70ch}
.bilahan{position:sticky;top:0;z-index:9;background:rgba(250,248,244,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:10px 22px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bilahan .dalam{max-width:1400px;margin:0 auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center;width:100%}
.bilahan button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;cursor:pointer}
.bilahan button[aria-pressed="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}
.hitung{margin-left:auto;color:var(--muted);font-size:12px}
main{max-width:1400px;margin:0 auto;padding:22px}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
@media(max-width:344px){.grid{grid-template-columns:minmax(0,1fr)}}
section.judul{margin:30px 0 14px;font:600 20px/1.2 "Cormorant Garamond",serif;border-bottom:1px solid var(--line);padding-bottom:8px}
.kartu{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.panggung{position:relative;aspect-ratio:3/3.4;overflow:hidden;display:flex;align-items:center;justify-content:center}
.panggung .pola{position:absolute;inset:0}
.panggung .isi{position:relative;text-align:center;padding:20px}
.deco{font-size:12px;letter-spacing:.4em;opacity:.85}
.panggung .judul{font-size:clamp(21px,5.4vw,28px);line-height:1.1;margin:12px 0 8px;font-weight:600}
.panggung .garis{width:44px;height:1px;margin:0 auto 9px;opacity:.55}
.panggung .tanggal{font-size:12.5px;letter-spacing:.09em;opacity:.8}
.monogram{position:absolute;left:14px;top:14px;width:44px;height:44px;border:1px solid;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 9px/1 Inter,sans-serif;letter-spacing:.08em;opacity:.9}
.meta{padding:14px 15px 16px;display:flex;flex-direction:column;gap:9px;flex:1}
.baris1{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.baris1 h3{margin:0;font:600 15px/1.2 Inter,sans-serif}
.idx{font-size:10.5px;color:var(--muted);background:#f2eee7;border-radius:5px;padding:2px 5px}
.badge{font-size:9.5px;letter-spacing:.1em;padding:3px 7px;border-radius:999px;background:#efe7d6;color:#7a5d12;font-weight:600}
.badge.studio{background:#e6ecf5;color:#3d5a80}
.baris2{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--muted)}
.harga{font-weight:600;color:var(--ink)}
.desc{margin:0;font-size:12.8px;color:var(--muted);line-height:1.5}
/* ---- diagram kerangka: yang membedakan tema selain warna ---- */
.badge.lay{background:#1f1a12;color:#f0d79a}
.kerangka{margin:11px 0 0;padding:11px 12px;border-radius:12px;background:#faf7f0;
  border:1px solid var(--line);border-left:3px solid #c9a44c}
.kjudul{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:9px}
.kjudul .mono{font-size:10px;color:var(--muted);letter-spacing:.02em}
.urut{display:flex;flex-wrap:wrap;gap:4px}
.urut i{display:inline-flex;align-items:center;gap:4px;font-style:normal;font-size:10.5px;
  padding:3px 7px 3px 4px;border-radius:999px;background:#fff;border:1px solid #e6ddca;color:#4a4436}
.urut i b{display:grid;place-items:center;width:14px;height:14px;border-radius:99px;
  background:#efe7d6;color:#7a5d12;font-size:8.5px;font-weight:700}
.ekstra{margin-top:9px;font-size:10.5px;color:#7a5d12;line-height:1.5}
.swatch{display:flex;gap:5px}
.swatch i{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.12)}
.swatch i.aksen,.swatch i.tinta{border-radius:50%}
dl{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;margin:auto 0 0;font-size:11.5px}
dl div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted var(--line);padding-bottom:3px}
dt{color:var(--muted)}
dd{margin:0;font-weight:500;text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
dd.mono{font-family:ui-monospace,Menlo,monospace;font-size:10.5px}
.cvgrid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-bottom:40px}
.cv{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 13px;position:relative}
.cv b{display:block;font-size:13.5px;margin-bottom:2px}
.cv code{font-size:10.5px;color:#7a6a52;background:#f5f1e9;padding:1px 5px;border-radius:4px}
.cv p{margin:7px 0 0;font-size:12.3px;color:var(--muted);line-height:1.45}
.cvn{position:absolute;right:12px;top:10px;font-size:10px;color:#bdb5a7}
footer{max-width:1400px;margin:0 auto;padding:18px 22px 50px;color:var(--muted);font-size:12.3px;border-top:1px solid var(--line)}
</style>
</head>
<body>
<header>
  <h1>Perbandingan Tema Undangan AsProject</h1>
  <p>Dipanen otomatis dari <code>const TPL</code> di <code>studio.html</code> / <code>undangan.html</code>
  oleh <code>tools/bikin-perbandingan-tema.cjs</code> — jangan disunting manual.
  Nomor <span class="idx" style="padding:1px 5px">#</span> adalah indeks array = nilai kolom
  <code>theme</code> di Supabase. Kartu di bawah memakai gradasi (<code>g[0]→g[2]</code>), aksen, tinta,
  font, dan pola SVG persis seperti renderer <code>undangan.html</code>.</p>
  <p style="margin-top:10px"><b>Sejak 2026-10-15 tema tidak lagi sekadar beda warna.</b>
  Tiap tema membawa <code>layout:</code> yang menentukan <b>kerangka</b>: bentuk bagian
  (10 shell), urutan bagian (varian A–E), dan bagian eksklusif. Blok
  <span class="badge lay">▦ Kerangka</span> di tiap kartu menggambar urutan bagian yang
  benar-benar dirender — bandingkan dua kartu untuk melihat bedanya susunan, bukan cuma palet.
  ${publik.length} tema publik memakai ${layoutPublik} kerangka berbeda.</p>
  <p style="margin-top:10px;color:var(--muted);font-size:12.5px">Mockup cover tidak lagi
  menggambar kicker, ornamen (<code>deco</code>), dan label template (<code>chara</code>):
  sejak PR #21 renderer menyembunyikannya di cover. <code>deco</code> tetap dipakai di
  divider dan footer; <code>chara</code> saat ini tidak tampil di mana pun.</p>
</header>
<div class="bilahan"><div class="dalam">
  <span style="font-size:12.5px;color:var(--muted)">Saring:</span>
  <button data-f="all" aria-pressed="true">Semua (${TPL.length})</button>
  ${['pernikahan', 'khitanan', 'ultah', 'aqiqah'].map(e => `<button data-f="${e}" aria-pressed="false">${EV_ICON[e]} ${EV_LABEL[e]} (${TPL.filter(t => t.ev === e || t.ev === 'all').length})</button>`).join('')}
  <button data-f="studio" aria-pressed="false">Studio-only (${internal.length})</button>
  <span class="hitung"></span>
</div></div>
<main>
  <section class="judul">Tema publik — masuk katalog &amp; daftar harga (${publik.length})</section>
  <div class="grid" id="gPublik">${publik.map(kartu).join('')}</div>
  <section class="judul">Varian Gerbang Arch — khusus Studio, tanpa listing harga (${internal.length})</section>
  <div class="grid" id="gInternal">${internal.map(kartu).join('')}</div>
  <section class="judul">15 model cover pembuka (<code>coverLayout</code>) — terpisah dari tema</section>
  <div class="cvgrid">${barisCover()}</div>
</main>
<footer>
  Tema menentukan <b>palet, font, pola latar, ornamen, dan gaya cover bawaan</b>.
  Model cover menentukan <b>komposisi layar pembuka</b>. Keduanya dipilih terpisah di tab
  <b>Desain &amp; Cover</b> Studio, jadi satu tema bisa tampil beda dengan 15 model cover.
</footer>
<script>
/* Satu-satunya JS di halaman ini: penyaring kategori. Tekstur pola tema sudah
   di-inline saat build oleh patCss() hasil panen dari undangan.html. */
(function(){
  const urut=[].slice.call(document.querySelectorAll('.kartu'));
  const btns=[].slice.call(document.querySelectorAll('.bilahan button'));
  const hit=document.querySelector('.hitung');
  function saring(f){
    let n=0;
    urut.forEach(k=>{
      const ev=k.getAttribute('data-ev'),st=k.getAttribute('data-studio')==='1';
      const ok=f==='all'?true:f==='studio'?st:(ev===f||ev==='all');
      k.style.display=ok?'':'none';if(ok)n++;
    });
    hit.textContent=n+' tema tampil';
  }
  btns.forEach(b=>b.addEventListener('click',()=>{
    btns.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    saring(b.getAttribute('data-f'));
  }));
  saring('all');
})();
<\/script>
</body>
</html>
`;

fs.writeFileSync(OUT, html.replace(/[ \t]+$/gm, ''), 'utf8');
console.log(`OK  ${path.relative(ROOT, OUT)}  —  ${TPL.length} tema (${publik.length} publik + ${internal.length} studio-only), ${CV_LAYOUTS.length} model cover`);
