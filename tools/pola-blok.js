/* ===========================================================================
   pola-blok.js — registri POLA latar (background pattern) untuk AsProject.

   Blok ini adalah salinan kanonis untuk semua pola latar. Saat registry
   berubah, salin blok ini utuh ke undangan.html DAN studio.html. Tes
   tools/test-pola.cjs memastikan ketiga salinan tetap identik; jangan mengubah
   hanya satu berkas.

   Setiap entri: { n: nama tampil, d: keterangan picker, op: opasitas dasar,
                   size: nilai background-size, svg(c,op) ATAU css(t) }.
   polaCss(id, t, skala) menghasilkan potongan CSS background (image+size+
   repeat). skala dipakai untuk melunakkan pola saat dipasang sebagai latar
   halaman (bukan sampul).

   Motif baru digambar dari referensi visual: mega mendung (awan berlapis +
   spiral), parang (larik diagonal berisi bilah), kawung (lingkaran berpotong
   membentuk rosset empat kelopak), damask (medalion palmette half-drop),
   girih (bintang delapan + intan sudut), deco (kipas/busur bertingkat),
   sulur (sulur daun melingkar), renda (tepi berskalop + titik), marmer
   (urat batu panjang), ombak (kipas seigaiha), zigzag (chevron), tabur
   (kelip bintang tersebar).
   =========================================================================== */
const POLA = {
 /* --- lima pola lama, dipindah apa adanya supaya tampilan lama tidak berubah --- */
 batik: {
  n: 'Batik Kawung', d: 'Rosset batik empat kelopak', op: .24, size: '48px 48px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.5"><path d="M48 4C65 17 65 27 48 41 31 27 31 17 48 4ZM92 48C79 65 69 65 55 48 69 31 79 31 92 48ZM48 92C31 79 31 69 48 55 65 69 65 79 48 92ZM4 48C17 31 27 31 41 48 27 65 17 65 4 48Z"/><path d="M48 31 65 48 48 65 31 48Z"/><circle cx="48" cy="48" r="4"/></g></svg>`
 },
 botanical: {
  n: 'Ranting Daun', d: 'Tangkai daun melintang', op: .17, size: '120px 120px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.5" stroke-linecap="round"><path d="M14 108C42 87 65 56 106 13"/><path d="M34 92C17 89 15 73 16 67 31 65 42 75 34 92ZM52 73C36 71 34 57 35 51 51 49 60 59 52 73ZM72 51C57 48 56 34 58 28 73 28 81 39 72 51ZM39 89C42 73 56 69 63 70 64 85 53 95 39 89ZM59 66C62 51 76 47 83 49 83 64 73 73 59 66ZM81 42C84 29 96 24 102 26 103 39 94 48 81 42Z"/></g></svg>`
 },
 frost: {
  n: 'Kristal Es', d: 'Keping salju halus', op: .2, size: '96px 96px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.35" stroke-linecap="round"><path d="M24 12v28M12 19l24 14M36 19 12 33M70 52v32M56 61l28 15M84 61 56 76M48 48l7 7-7 7-7-7Z"/><path d="m20 17 4 4 4-4m-16 12 5-1 1 5m16-5-5-1-1 5m28 30 4 5 4-5m-16 13 5-1 1 5m16-5-5-1-1 5"/></g></svg>`
 },
 arab: {
  n: 'Anyaman Diagonal', d: 'Garis silang anyaman', op: 0, size: '',
  css: t => `background-image:repeating-linear-gradient(45deg,${t.accent}14 0 2px,transparent 2px 16px),repeating-linear-gradient(-45deg,${t.accent}0f 0 2px,transparent 2px 16px);`
 },
 confetti: {
  n: 'Konfeti', d: 'Titik warna pesta', op: 0, size: '',
  css: t => `background-image:radial-gradient(#E5737355 2px,transparent 2.6px),radial-gradient(#64B5F655 2px,transparent 2.6px),radial-gradient(#8BC34A55 2px,transparent 2.6px);background-size:42px 42px,36px 36px,30px 30px;background-position:0 0,12px 20px,22px 8px;`
 },

 /* --- dua belas pola baru --- */
 mendung: {
  n: 'Mega Mendung', d: 'Awan batik Cirebon berlapis', op: .2, size: '120px 120px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.6" stroke-linecap="round"><path d="M14 40C26 28 44 26 60 30C76 26 94 30 106 40C94 50 76 54 60 50C44 54 26 50 14 40Z"/><path d="M26 40C36 33 48 32 60 35C72 32 84 33 94 40C84 46 72 47 60 45C48 47 36 46 26 40Z"/><path d="M60 38c5-1 7 3 3 5c-3 1-5-2-3-4"/><path d="M18 88C28 79 42 77 54 80C66 77 80 79 90 88C80 95 66 97 54 94C42 97 28 95 18 88Z"/><path d="M28 88C36 83 46 82 54 84C62 82 72 83 80 88C72 92 62 93 54 91C46 93 36 92 28 88Z"/><path d="M54 86c4-1 6 2 3 4c-3 1-4-2-3-3"/></g></svg>`
 },
 parang: {
  n: 'Parang', d: 'Larik diagonal bilah batik', op: .2, size: '72px 72px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.4" stroke-linecap="round"><path d="M0 36 36 0M0 72 72 0M36 72 72 36"/><path d="M10 26c4 0 6 2 6 6M28 8c4 0 6 2 6 6M20 44c4 0 6 2 6 6M46 26c4 0 6 2 6 6M38 62c4 0 6 2 6 6M56 44c4 0 6 2 6 6"/><path d="M16 20l3 3M40 44l3 3M52 20l3 3M28 56l3 3"/></g></svg>`
 },
 kawung: {
  n: 'Kawung', d: 'Lingkaran berpotong empat kelopak', op: .2, size: '64px 64px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.4"><circle cx="0" cy="0" r="18"/><circle cx="64" cy="0" r="18"/><circle cx="0" cy="64" r="18"/><circle cx="64" cy="64" r="18"/><circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="3"/><path d="M32 14v-5M32 55v5M14 32h-5M55 32h5"/></g></svg>`
 },
 damask: {
  n: 'Damask', d: 'Medalion palmette klasik', op: .2, size: '96px 96px',
  svg: (c, op) => {
   const m = `<path d="M0 -16C6 -10 8 -4 8 0C8 6 4 10 0 14C-4 10 -8 6 -8 0C-8 -4 -6 -10 0 -16Z"/><path d="M8 2C14 0 18 4 16 8C14 11 10 10 10 7"/><path d="M-8 2C-14 0 -18 4 -16 8C-14 11 -10 10 -10 7"/><path d="M0 -20v-4M5 -18l3-3M-5 -18l-3-3"/><circle cx="0" cy="20" r="1.6"/>`;
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.3" stroke-linecap="round"><g transform="translate(48 28)">${m}</g><g transform="translate(0 76)">${m}</g><g transform="translate(96 76)">${m}</g></g></svg>`;
  }
 },
 girih: {
  n: 'Girih', d: 'Bintang delapan geometris', op: .2, size: '80px 80px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.3"><g transform="translate(40 40)"><rect x="-15" y="-15" width="30" height="30"/><rect x="-15" y="-15" width="30" height="30" transform="rotate(45)"/><circle r="4"/></g><path d="M0 0 22 22M80 0 58 22M0 80 22 58M80 80 58 58"/><g transform="translate(0 0) rotate(45)"><rect x="-7" y="-7" width="14" height="14"/></g><g transform="translate(80 0) rotate(45)"><rect x="-7" y="-7" width="14" height="14"/></g><g transform="translate(0 80) rotate(45)"><rect x="-7" y="-7" width="14" height="14"/></g><g transform="translate(80 80) rotate(45)"><rect x="-7" y="-7" width="14" height="14"/></g></g></svg>`
 },
 deco: {
  n: 'Kipas Deco', d: 'Busur kipas art deco', op: .2, size: '80px 40px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.3"><path d="M8 40a32 32 0 0 1 64 0"/><path d="M16 40a24 24 0 0 1 48 0"/><path d="M24 40a16 16 0 0 1 32 0"/><path d="M32 40a8 8 0 0 1 16 0"/><path d="M-32 0a32 32 0 0 1 64 0"/><path d="M-24 0a24 24 0 0 1 48 0"/><path d="M-16 0a16 16 0 0 1 32 0"/><path d="M48 0a32 32 0 0 1 64 0"/><path d="M56 0a24 24 0 0 1 48 0"/><path d="M64 0a16 16 0 0 1 32 0"/></g></svg>`
 },
 sulur: {
  n: 'Sulur', d: 'Sulur daun melingkar', op: .18, size: '100px 100px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.4" stroke-linecap="round"><path d="M10 90C30 70 30 50 50 50C70 50 70 30 90 10"/><path d="M50 50c-8-2-12-8-10-14c6-2 12 2 10 14Z"/><path d="M50 50c2 8 8 12 14 10c2-6-2-12-14-10Z"/><path d="M28 72c-6 0-10-4-9-9c5-1 9 3 9 9Z"/><path d="M72 28c0-6 4-10 9-9c1 5-3 9-9 9Z"/><path d="M90 10c4-2 8 0 8 4M10 90c-4 2-8 0-8-4"/><circle cx="50" cy="50" r="1.8"/></g></svg>`
 },
 renda: {
  n: 'Renda', d: 'Tepi berskalop seperti renda', op: .22, size: '56px 28px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 28"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.2"><path d="M0 8a14 14 0 0 0 28 0a14 14 0 0 0 28 0"/><path d="M6 8a8 8 0 0 0 16 0M34 8a8 8 0 0 0 16 0"/><circle cx="14" cy="15" r="1.5"/><circle cx="42" cy="15" r="1.5"/><path d="M14 26v-7M42 26v-7M0 26h56" stroke-dasharray="2 3"/></g></svg>`
 },
 marmer: {
  n: 'Marmer', d: 'Urat batu alami', op: .14, size: '140px 140px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.1" stroke-linecap="round"><path d="M-10 30C20 24 34 44 60 40C86 36 96 16 122 20C138 22 146 30 150 30"/><path d="M-10 78C16 70 30 92 58 86C84 80 98 60 124 66C140 70 148 78 150 78"/><path d="M-10 122C22 116 36 134 64 128C90 122 102 104 128 110C142 113 148 122 150 122"/><path d="M60 40c4 8 2 14-4 18M58 86c6 6 6 12 2 18M122 20c-2 8 0 12 6 16"/></g></svg>`
 },
 ombak: {
  n: 'Ombak', d: 'Kipas gelombang seigaiha', op: .2, size: '60px 30px',
  svg: (c, op) => {
   const f = `<path d="M-15 0a15 15 0 0 1 30 0"/><path d="M-10 0a10 10 0 0 1 20 0"/><path d="M-5 0a5 5 0 0 1 10 0"/>`;
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.2"><g transform="translate(15 30)">${f}</g><g transform="translate(45 30)">${f}</g><g transform="translate(0 15)">${f}</g><g transform="translate(30 15)">${f}</g><g transform="translate(60 15)">${f}</g></g></svg>`;
  }
 },
 zigzag: {
  n: 'Zigzag', d: 'Chevron rapat', op: .2, size: '48px 24px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.4" stroke-linejoin="round"><path d="M0 16 12 4 24 16 36 4 48 16"/><path d="M0 22 12 10 24 22 36 10 48 22"/></g></svg>`
 },
 tabur: {
  n: 'Tabur Kelip', d: 'Bintang kecil tersebar', op: .22, size: '90px 90px',
  svg: (c, op) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><g fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.3" stroke-linejoin="round"><path d="M22 15C23 20 24 21 29 22C24 23 23 24 22 29C21 24 20 23 15 22C20 21 21 20 22 15Z"/><path d="M66 35C67 39 68 40 72 41C68 42 67 43 66 47C65 43 64 42 60 41C64 40 65 39 66 35Z"/><path d="M40 64C41 69 42 70 47 71C42 72 41 73 40 78C39 73 38 72 33 71C38 70 39 69 40 64Z"/><path d="M78 76C79 79 80 80 83 81C80 82 79 83 78 86C77 83 76 82 73 81C76 80 77 79 78 76Z"/><path d="M10 52C11 55 12 56 15 57C12 58 11 59 10 62C9 59 8 58 5 57C8 56 9 55 10 52Z"/><circle cx="52" cy="14" r="1.4"/><circle cx="14" cy="80" r="1.4"/><circle cx="80" cy="52" r="1.2"/></g></svg>`
 },
 /* --- pola kerangka baru: sinar retro & flora berlapis --- */
 surya: {
  n: 'Sinar Matahari', d: 'Sembar matahari mid-century', op: 0, size: '',
  css: t => `background-image:repeating-conic-gradient(from -90deg at 50% -32%,color-mix(in srgb,${t.accent} 13%,transparent) 0deg 5deg,transparent 5deg 24deg);`
 },
 rimbun: {
  n: 'Rimbun Flora', d: 'Helai bunga berlapis', op: 0, size: '',
  css: t => `background-image:radial-gradient(circle at 18% 22%,color-mix(in srgb,${t.accent} 15%,transparent) 0 3px,transparent 4px),radial-gradient(circle at 78% 14%,color-mix(in srgb,${t.accent} 11%,transparent) 0 2.5px,transparent 3.5px),radial-gradient(circle at 62% 82%,color-mix(in srgb,${t.accent} 13%,transparent) 0 3px,transparent 4px),radial-gradient(circle at 26% 88%,color-mix(in srgb,${t.accent} 9%,transparent) 0 2px,transparent 3px);background-size:150px 150px,120px 120px,170px 170px,130px 130px;`
 },
 /* --- pola baru dari riset 2026 --- */
 monstera: {
  n: 'Monstera', d: 'Daun monstera tropis', op: 0, size: '',
  css: t => `background-image:radial-gradient(ellipse 34px 62px at 16% 24%,color-mix(in srgb,${t.accent} 17%,transparent) 0 55%,transparent 72%),radial-gradient(ellipse 34px 62px at 84% 74%,color-mix(in srgb,${t.accent} 14%,transparent) 0 55%,transparent 72%),radial-gradient(ellipse 26px 48px at 72% 18%,color-mix(in srgb,${t.accent} 11%,transparent) 0 55%,transparent 72%);background-size:190px 190px,220px 220px,170px 170px;`
 },
 kraft: {
  n: 'Serat Kraft', d: 'Serat kertas kraft kasar', op: 0, size: '',
  css: t => `background-image:repeating-linear-gradient(90deg,color-mix(in srgb,${t.accent} 7%,transparent) 0 1px,transparent 1px 5px),repeating-linear-gradient(2deg,color-mix(in srgb,${t.accent} 5%,transparent) 0 1px,transparent 1px 7px),radial-gradient(circle at 30% 60%,color-mix(in srgb,${t.accent} 8%,transparent) 0 1.5px,transparent 2.5px);background-size:120px 120px,180px 90px,90px 90px;`
 },
 washi: {
  n: 'Washi', d: 'Serat kertas washi halus', op: 0, size: '',
  css: t => `background-image:repeating-linear-gradient(45deg,color-mix(in srgb,${t.accent} 6%,transparent) 0 1px,transparent 1px 11px),repeating-linear-gradient(-45deg,color-mix(in srgb,${t.accent} 5%,transparent) 0 1px,transparent 1px 13px);background-size:140px 140px,160px 160px;`
 }
};
const POLA_IDS = Object.keys(POLA);

/* Kembalikan potongan CSS background untuk pola id pada tema t.
   skala (opsional) melunakkan opasitas, dipakai lapisan latar halaman. */
function polaCss(id, t, skala) {
 const P = POLA[id];
 if (!P) return '';
 const tema = t || {};
 if (P.css) return P.css(tema);
 const c = tema.accent || '#8b7358';
 const op = Math.max(.04, Math.round(P.op * (skala == null ? 1 : skala) * 100) / 100);
 const svg = P.svg(c, op);
 return `background-image:url(data:image/svg+xml,${encodeURIComponent(svg)});background-size:${P.size};background-repeat:repeat;`;
}

/* Id pola yang dipakai pemilik (d.pat) menang atas bawaan tema. */
function patAktif(d, tplF) {
 const pilih = (d && d.pat) || '';
 if (POLA[pilih]) return pilih;
 return (tplF && tplF.pat) || '';
}
