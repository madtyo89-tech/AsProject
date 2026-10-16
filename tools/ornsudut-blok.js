/* ===== Ornamen sudut: dibangun dari referensi yang benar-benar dilihat =====

   Sebelumnya hanya ada 4 pilihan (tanpa / ranting / bunga3d / bunga4d) dan
   bunga3d dengan bunga4d memakai SVG yang SAMA persis -- satu-satunya beda
   hanyalah animasi CSS, jadi pada tampilan diam keduanya identik.

   Gaya-gaya di bawah diambil dari ciri visual referensi yang diperiksa satu
   per satu (lihat katalog referensi di image-search/):

   deco     -> kipas sunburst memancar dari satu titik, kipas seperempat
               lingkaran bersarang di sudut, garis paralel rangkap membentuk
               bingkai L, kipas kecil berulang di tepi
   filigree -> sulur meruncing (tebal ke tipis) menjulur sepanjang tepi dan
               berujung tetesan, gerombol spiral C/S di sudut, aksen trefoil,
               titik "mata" di persimpangan dalam
   girih    -> bintang bersudut banyak di pusat, teselasi bintang-heksagon,
               pita strapwork saling silang membentuk L
   damask   -> palmette simetris bilateral: finial tetesan di tengah, gulungan
               di kedua sisi, kelopak berlapis, aksen titik
   mendung  -> mega mendung Cirebon: garis awan konsentris berlapis yang
               bergelombang, diulang lebih kecil di sepanjang tepi

   Emboss (permintaan terpisah) diterapkan lewat CSS: cahaya dari kiri-atas
   dan bayangan ke kanan-bawah, jadi ornamen tampak timbul dari kertas. */

/* Satu sudut digambar dalam kotak 0..100, jangkar di kiri-atas; tiga sudut
   lain dibuat dengan pencerminan (bkCermin* sudah ada di blok bingkai). */
const ORN_SUDUT = {
 /* kipas art-deco */
 deco: () => {
   let s = '';
   s += "<path d='M3 97V3h94' fill='none' stroke='currentColor' stroke-width='2.6'/>";
   s += "<path d='M9 97V9h88' fill='none' stroke='currentColor' stroke-width='1.1' opacity='.85'/>";
   s += "<path d='M15 97V15h82' fill='none' stroke='currentColor' stroke-width='.6' opacity='.6'/>";
   for (let i = 0; i < 4; i++) {
     const r = 24 + i * 9;
     s += "<path d='M3 " + r + "A" + (r - 3) + ' ' + (r - 3) + " 0 0 0 " + r + " 3' fill='none' stroke='currentColor' stroke-width='" + (i === 0 ? 2 : 1) + "' opacity='" + (0.95 - i * 0.16).toFixed(2) + "'/>";
   }
   for (let i = 0; i < 7; i++) {
     const a = (12 + i * 11) * Math.PI / 180, x1 = 6 + Math.cos(a) * 16, y1 = 6 + Math.sin(a) * 16,
       x2 = 6 + Math.cos(a) * 40, y2 = 6 + Math.sin(a) * 40;
     s += "<line x1='" + x1.toFixed(1) + "' y1='" + y1.toFixed(1) + "' x2='" + x2.toFixed(1) + "' y2='" + y2.toFixed(1) + "' stroke='currentColor' stroke-width='" + (i % 2 ? 1 : 2.2) + "' opacity='.9'/>";
   }
   s += "<path d='M3 62A24 24 0 0 0 27 86L3 86Z' fill='currentColor' opacity='.5'/>";
   s += "<path d='M62 3A24 24 0 0 0 86 27L86 3Z' fill='currentColor' opacity='.5'/>";
   return s;
 },
 /* sulur filigree meruncing */
 filigree: () => {
   let s = '';
   s += "<path d='M97 3C72 3 44 6 24 15C46 9 72 6 97 6Z' fill='currentColor' opacity='.9'/>";
   s += "<path d='M3 97C3 72 6 44 15 24C9 46 6 72 6 97Z' fill='currentColor' opacity='.9'/>";
   s += "<path d='M96 4c3-2 6 0 5 3-1 2-4 2-5-1Z' fill='currentColor'/>";
   s += "<path d='M4 96c-2 3 0 6 3 5 2-1 2-4-1-5Z' fill='currentColor'/>";
   const spiral = (cx, cy, r, o) => "<path d='M" + cx + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 1 ' + (r * .8) + ' ' + (r * .8) + 'a' + (r * .5) + ' ' + (r * .5) + " 0 1 0 -" + (r * .45) + ' ' + (r * .45) + "' fill='none' stroke='currentColor' stroke-width='1.7' opacity='" + o + "'/>";
   s += spiral(26, 26, 9, .95) + spiral(40, 18, 6, .8) + spiral(18, 40, 6, .8);
   s += spiral(34, 34, 4.5, .7);
   const trefoil = (cx, cy, o) => "<circle cx='" + (cx - 3) + "' cy='" + cy + "' r='2.6' fill='currentColor' opacity='" + o + "'/><circle cx='" + (cx + 3) + "' cy='" + cy + "' r='2.6' fill='currentColor' opacity='" + o + "'/><circle cx='" + cx + "' cy='" + (cy - 3.4) + "' r='2.6' fill='currentColor' opacity='" + o + "'/>";
   s += trefoil(52, 30, .75) + trefoil(30, 52, .75) + trefoil(46, 46, .6);
   s += "<circle cx='20' cy='20' r='2.4' fill='currentColor'/>";
   return s;
 },
 /* girih islami: bintang + strapwork */
 girih: () => {
   let s = '';
   s += "<path d='M2 98V14L14 2h84' fill='none' stroke='currentColor' stroke-width='2.4'/>";
   s += "<path d='M8 98V20L20 8h78' fill='none' stroke='currentColor' stroke-width='1.2' opacity='.8'/>";
   s += "<path d='M2 98V14L14 2' fill='none' stroke='currentColor' stroke-width='1.2' opacity='.8' transform='translate(3,3)'/>";
   const star = (cx, cy, r, o) => {
     let p = '';
     for (let k = 0; k < 2; k++) p += "<rect x='" + (cx - r) + "' y='" + (cy - r) + "' width='" + (2 * r) + "' height='" + (2 * r) + "' fill='none' stroke='currentColor' stroke-width='1.3' opacity='" + o + "' transform='rotate(" + (k * 45) + ' ' + cx + ' ' + cy + ")'/>";
     return p + "<circle cx='" + cx + "' cy='" + cy + "' r='" + (r * .34) + "' fill='currentColor' opacity='" + o + "'/>";
   };
   s += star(30, 30, 13, .95);
   s += star(66, 10, 6, .7) + star(10, 66, 6, .7) + star(52, 52, 5, .55);
   s += "<path d='M44 20l8 8M20 44l8 8M48 48l8 8' stroke='currentColor' stroke-width='1.2' opacity='.7'/>";
   return s;
 },
 /* palmette damask seperempat */
 damask: () => {
   let s = '';
   s += "<path d='M30 6C22 16 18 26 20 38C10 30 6 20 8 8C16 8 25 4 30 6Z' fill='currentColor' opacity='.85'/>";
   s += "<path d='M6 30C16 22 26 18 38 20C30 10 20 6 8 8C8 16 4 25 6 30Z' fill='currentColor' opacity='.85'/>";
   s += "<path d='M34 34c-6-2-10-6-12-12 8 2 12 6 12 12Z' fill='currentColor' opacity='.7'/>";
   const petal = (cx, cy, rx, ry, rot, o) => "<ellipse cx='" + cx + "' cy='" + cy + "' rx='" + rx + "' ry='" + ry + "' fill='currentColor' opacity='" + o + "' transform='rotate(" + rot + ' ' + cx + ' ' + cy + ")'/>";
   s += petal(46, 22, 9, 3.4, -34, .65) + petal(22, 46, 9, 3.4, 56, .65);
   s += petal(58, 12, 7, 2.6, -22, .5) + petal(12, 58, 7, 2.6, 68, .5);
   s += petal(60, 40, 6, 2.4, -50, .45) + petal(40, 60, 6, 2.4, 40, .45);
   s += "<circle cx='34' cy='34' r='3.4' fill='currentColor'/>";
   s += "<circle cx='70' cy='8' r='1.8' fill='currentColor' opacity='.6'/><circle cx='8' cy='70' r='1.8' fill='currentColor' opacity='.6'/>";
   s += "<path d='M96 4H60M4 96V60' stroke='currentColor' stroke-width='1' opacity='.5'/>";
   return s;
 },
 /* mega mendung: awan konsentris */
 mendung: () => {
   let s = '';
   const awan = (k, o) => {
     const r = 46 - k * 8;
     return "<path d='M2 " + (r + 6) + "C" + (r * .3) + ' ' + (r * .8) + ' ' + (r * .45) + ' ' + (r * .5) + ' ' + (r * .62) + ' ' + (r * .55) +
       "C" + (r * .7) + ' ' + (r * .3) + ' ' + (r * .85) + ' ' + (r * .3) + ' ' + (r * .95) + ' ' + (r * .5) +
       "C" + (r + 2) + ' ' + (r * .45) + ' ' + (r + 4) + ' ' + (r * .62) + ' ' + (r + 6) + " 2' fill='none' stroke='currentColor' stroke-width='" + (2.4 - k * .4).toFixed(1) + "' opacity='" + o + "'/>";
   };
   s += awan(0, .95) + awan(1, .8) + awan(2, .62) + awan(3, .45);
   const kecil = (cx, cy, o) => "<path d='M" + (cx - 8) + ' ' + cy + 'c2-5 6-7 9-5 2-4 7-4 9 0 3-2 7 0 8 5Z' + "' fill='none' stroke='currentColor' stroke-width='1.3' opacity='" + o + "'/>";
   s += kecil(70, 10, .6) + kecil(10, 70, .6) + kecil(56, 56, .45);
   return s;
 }
};

/* Kembalikan SVG satu sudut untuk gaya yang diminta. */
function ornSudutSvg(id) {
  const g = ORN_SUDUT[id];
  if (!g) return null;
  try {
    return "<svg viewBox='0 0 100 100' fill='none' aria-hidden='true'>" + g() + "</svg>";
  } catch (e) { return null; }
}

/* CSS agar ornamen sudut juga hadir di SEMUA lapisan kartu, bukan hanya
   sampul dan kartu tamu. Dipasang sebagai lapisan background (ikut ter-clip
   border-radius, tidak merebut pseudo-element) lewat <style> yang disuntik
   saat boot karena warnanya mengikuti aksen tema. */
function ornSudutCssDariSvg(svg, A) {
  if (!svg) return '';
  const m = String(svg).match(/viewBox=["']([^"']+)["']/);
  if (!m) return '';
  const vb = m[1].trim().split(/\s+/);
  const W = vb[2], H = vb[3];
  /* Buang pembungkus <svg> supaya pencerminan bekerja pada isinya, bukan
     menyarangkan <svg> di dalam <svg>. */
  const isi = String(svg).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const K = 54, uri = (inner) => "url('data:image/svg+xml," +
    encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width='" + W + "' height='" + H +
      "' viewBox='" + vb.join(' ') + "'>" + inner + "</svg>").replace(/'/g, '%27') + "')";
  const satu = isi;
  const tl = uri(satu), tr = uri(bkCerminX(satu, W, H)),
    br = uri(bkCerminXY(satu, W, H)), bl = uri(bkCerminY(satu, W, H));
  return '.card{background-image:' + [tl, tr, br, bl].join(',') + ';' +
    'background-position:left 7px top 7px,right 7px top 7px,right 7px bottom 7px,left 7px bottom 7px;' +
    'background-repeat:no-repeat,no-repeat,no-repeat,no-repeat;' +
    'background-size:' + K + 'px ' + K + 'px,' + K + 'px ' + K + 'px,' + K + 'px ' + K + 'px,' + K + 'px ' + K + 'px}';
}
