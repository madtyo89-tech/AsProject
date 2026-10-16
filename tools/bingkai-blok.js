/* ===== Bingkai ornamen per pilihan border =====

   Keluhan: 32 pilihan border semuanya persegi, dan yang namanya mewah
   (Laurel Emas, Filigree, Mahkota Mutiara, Crown VIP) isinya cuma variasi
   border + box-shadow -- tidak ada ornamennya sama sekali.

   Di sini tiap border berhias mendapat motif yang benar-benar digambar:
   empat sudut + empat tepi, dipasang sebagai LAPISAN BACKGROUND.

   Kenapa background, bukan border-image atau pseudo-element:
   - border-image mengabaikan border-radius, padahal hampir semua model cover
     (cvl-glass, cvl-sakura, cvl-batik, ...) menetapkan radius. Sudut ornamen
     akan mencuat keluar melewati lengkungan.
   - .bdfr::before dan ::after sudah dipakai 9 aturan cvl-*, jadi tidak tersedia.
   Background ikut ter-clip oleh border-radius dan tidak merebut apa pun.

   Warna memakai aksen tema (A) yang sudah diterima fungsi s(A) di BORDERS. */

const BK_K = 46;   // ukuran kotak sudut, px
const BK_E = 40;   // panjang satu unit tepi yang diulang, px
const BK_T = 14;   // tebal pita border, px

/* Enkoding SVG ke data URI. encodeURIComponent menangani '#' pada warna heks
   dan tanda kutip, jadi aman diselipkan ke dalam fungsi url() milik CSS. */
function bkUri(isi, w, h) {
  const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width='" + w + "' height='" + h +
    "' viewBox='0 0 " + w + ' ' + h + "'>" + isi + '</svg>';
  /* Pembatas url() harus KUTIP TUNGGAL. Keluaran ini diselipkan ke atribut HTML
     berkutip ganda (style="${bdStyle}"), jadi kutip ganda di sini akan menutup
     atributnya lebih awal dan memotong seluruh ornamen -- gejalanya bingkai
     tetap polos walaupun fungsinya mengembalikan ribuan karakter.
     encodeURIComponent tidak mengemas apostrof, jadi diganti manual ke %27
     agar tidak ada kutip tunggal liar di dalam URI. */
  return "url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, '%27') + "')";
}
/* Cermin/putar markup supaya satu desain sudut bisa dipakai di empat pojok
   dan satu desain tepi bisa dipakai di empat sisi. */
const bkCerminX = (isi, w, h) => "<g transform='translate(" + w + ",0) scale(-1,1)'>" + isi + "</g>";
const bkCerminY = (isi, w, h) => "<g transform='translate(0," + h + ") scale(1,-1)'>" + isi + "</g>";
const bkCerminXY = (isi, w, h) => "<g transform='translate(" + w + "," + h + ") scale(-1,-1)'>" + isi + "</g>";

/* --- 12 desain sudut, digambar dalam kotak 0..BK_K --- */
const BK_SUDUT = {
 /* Tangkai laurel melengkung dengan lima daun. */
 laurel: A => {
   let s = "<path d='M6 40C6 22 18 8 38 6' fill='none' stroke='" + A + "' stroke-width='1.6' stroke-linecap='round'/>";
   for (let i = 0; i < 5; i++) {
     const t = i / 4, x = 8 + 26 * t, y = 38 - 30 * t * t - 2 * t;
     s += "<ellipse cx='" + x.toFixed(1) + "' cy='" + y.toFixed(1) + "' rx='6' ry='2.6' fill='" + A +
       "' transform='rotate(" + (-52 + i * 7) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ")' opacity='" + (0.9 - i * 0.09).toFixed(2) + "'/>";
   }
   return s;
 },
 /* Sulur filigree: dua spiral bertemu. */
 filigree: A => "<path d='M4 42C4 24 16 10 34 6' fill='none' stroke='" + A + "' stroke-width='1.5'/>" +
   "<path d='M34 6c7-2 12 3 9 8-2 4-8 3-8-2 0-3 3-5 5-3' fill='none' stroke='" + A + "' stroke-width='1.4' stroke-linecap='round'/>" +
   "<path d='M12 34c-6 1-9 6-6 10 2 3 7 2 7-2' fill='none' stroke='" + A + "' stroke-width='1.3' stroke-linecap='round' opacity='.8'/>" +
   "<circle cx='22' cy='24' r='2' fill='" + A + "'/>",
 /* Tiga mutiara bergradasi. */
 pearl: A => "<circle cx='10' cy='38' r='3' fill='" + A + "' opacity='.55'/>" +
   "<circle cx='21' cy='28' r='4' fill='" + A + "' opacity='.75'/>" +
   "<circle cx='34' cy='15' r='5' fill='" + A + "'/>" +
   "<path d='M6 42C14 30 26 18 42 6' fill='none' stroke='" + A + "' stroke-width='.9' opacity='.5'/>",
 /* Renda: kipas scallop bertingkat. */
 lace: A => "<path d='M4 42a10 10 0 0 1 10-10 10 10 0 0 1 10-10 10 10 0 0 1 10-10' fill='none' stroke='" + A + "' stroke-width='1.3'/>" +
   "<circle cx='14' cy='32' r='1.6' fill='" + A + "'/><circle cx='24' cy='22' r='1.6' fill='" + A + "'/>" +
   "<circle cx='34' cy='12' r='1.6' fill='" + A + "'/>" +
   "<path d='M4 42h38' stroke='" + A + "' stroke-width='.8' opacity='.4'/>",
 /* Art-deco: kipas bertingkat dengan sinar. */
 artdeco: A => "<path d='M6 40A34 34 0 0 1 40 6' fill='none' stroke='" + A + "' stroke-width='1.6'/>" +
   "<path d='M13 40A27 27 0 0 1 40 13' fill='none' stroke='" + A + "' stroke-width='1.2' opacity='.8'/>" +
   "<path d='M20 40A20 20 0 0 1 40 20' fill='none' stroke='" + A + "' stroke-width='1' opacity='.6'/>" +
   "<path d='M8 40L40 8M16 40L40 16M24 40L40 24' stroke='" + A + "' stroke-width='.7' opacity='.45'/>",
 /* Daun emas: sepasang daun bersisik. */
 'gold-leaf': A => "<path d='M6 40C10 22 24 10 42 6' fill='none' stroke='" + A + "' stroke-width='1.4'/>" +
   "<path d='M14 34c0-8 6-14 14-14-1 8-6 14-14 14Z' fill='" + A + "' opacity='.85'/>" +
   "<path d='M24 24c0-7 5-12 12-12-1 7-5 12-12 12Z' fill='" + A + "' opacity='.6'/>" +
   "<circle cx='10' cy='38' r='1.8' fill='" + A + "'/>",
 /* Pita satin: tiga pita diagonal mengilap. */
 ribbon: A => "<path d='M2 44L44 2M12 44L44 12M22 44L44 22' stroke='" + A + "' stroke-width='3' opacity='.55' stroke-linecap='round'/>" +
   "<path d='M7 44L44 7M17 44L44 17' stroke='" + A + "' stroke-width='1' opacity='.9'/>",
 /* Mahkota mutiara: untaian plus tiga titik puncak. */
 'pearl-crown': A => "<path d='M4 40l8-16 8 10 8-18 8 22' fill='none' stroke='" + A + "' stroke-width='1.5' stroke-linejoin='round'/>" +
   "<circle cx='12' cy='22' r='2.4' fill='" + A + "'/><circle cx='28' cy='14' r='2.4' fill='" + A + "'/>" +
   "<circle cx='38' cy='18' r='1.8' fill='" + A + "' opacity='.7'/>",
 /* Inlay onyx: balok angular berlapis. */
 'onyx-inlay': A => "<path d='M4 42V14L32 4h10' fill='none' stroke='" + A + "' stroke-width='2'/>" +
   "<path d='M10 42V20L30 10h12' fill='none' stroke='" + A + "' stroke-width='1' opacity='.6'/>" +
   "<rect x='34' y='6' width='6' height='6' fill='" + A + "'/>",
 /* Mahkota VIP: zigzag dengan permata. */
 'vip-crown': A => "<path d='M2 40l9-20 9 13 9-22 9 29' fill='" + A + "' opacity='.8'/>" +
   "<rect x='2' y='40' width='40' height='4' fill='" + A + "'/>" +
   "<circle cx='11' cy='18' r='2.2' fill='" + A + "'/><circle cx='29' cy='10' r='2.2' fill='" + A + "'/>",
 /* Aurora VIP: gelombang berlapis. */
 'vip-aurora': A => "<path d='M2 34c8-12 16 8 24-4s12 4 16-6' fill='none' stroke='" + A + "' stroke-width='2' opacity='.85'/>" +
   "<path d='M2 26c8-12 16 8 24-4s12 4 16-6' fill='none' stroke='" + A + "' stroke-width='1.4' opacity='.6'/>" +
   "<path d='M2 18c8-12 16 8 24-4s12 4 16-6' fill='none' stroke='" + A + "' stroke-width='1' opacity='.4'/>",
 /* Intan VIP: facet bersudut. */
 'vip-diamond': A => "<path d='M22 6l14 14-14 22L8 20Z' fill='none' stroke='" + A + "' stroke-width='1.6'/>" +
   "<path d='M8 20h28M22 6v36M14 12l16 20M30 12L14 32' stroke='" + A + "' stroke-width='.8' opacity='.6'/>"
};

/* --- 12 desain tepi, satu unit 0..BK_E yang diulang --- */
const BK_TEPI = {
 laurel: A => "<path d='M0 7h40' stroke='" + A + "' stroke-width='1.1' opacity='.75'/>" +
   "<ellipse cx='10' cy='7' rx='5' ry='2' fill='" + A + "' opacity='.7' transform='rotate(-18 10 7)'/>" +
   "<ellipse cx='30' cy='7' rx='5' ry='2' fill='" + A + "' opacity='.7' transform='rotate(18 30 7)'/>",
 filigree: A => "<path d='M0 8c6-8 14 8 20 0s14 8 20 0' fill='none' stroke='" + A + "' stroke-width='1.3'/>" +
   "<circle cx='10' cy='4' r='1.5' fill='" + A + "'/><circle cx='30' cy='4' r='1.5' fill='" + A + "'/>",
 pearl: A => "<circle cx='5' cy='7' r='2' fill='" + A + "' opacity='.6'/><circle cx='15' cy='7' r='2.6' fill='" + A + "' opacity='.8'/>" +
   "<circle cx='25' cy='7' r='2.6' fill='" + A + "' opacity='.8'/><circle cx='35' cy='7' r='2' fill='" + A + "' opacity='.6'/>",
 lace: A => "<path d='M0 2a10 10 0 0 0 20 0 10 10 0 0 0 20 0' fill='none' stroke='" + A + "' stroke-width='1.3'/>" +
   "<circle cx='10' cy='11' r='1.4' fill='" + A + "'/><circle cx='30' cy='11' r='1.4' fill='" + A + "'/>",
 artdeco: A => "<path d='M0 12h40' stroke='" + A + "' stroke-width='1.4'/>" +
   "<path d='M5 12V4M15 12V7M25 12V7M35 12V4' stroke='" + A + "' stroke-width='1.6'/>" +
   "<path d='M0 2h40' stroke='" + A + "' stroke-width='.8' opacity='.5'/>",
 'gold-leaf': A => "<path d='M0 10c7-9 13-9 20 0s13 9 20 0' fill='none' stroke='" + A + "' stroke-width='1.2'/>" +
   "<path d='M10 6c0-4 3-6 6-6 0 4-2 6-6 6ZM30 6c0-4 3-6 6-6 0 4-2 6-6 6Z' fill='" + A + "' opacity='.7'/>",
 ribbon: A => "<path d='M0 12L12 0M8 12L20 0M16 12L28 0M24 12L36 0M32 12L44 0' stroke='" + A + "' stroke-width='2.4' opacity='.5'/>",
 'pearl-crown': A => "<path d='M0 12l5-8 5 6 5-9 5 11 5-11 5 9 5-6 5 8' fill='none' stroke='" + A + "' stroke-width='1.3' stroke-linejoin='round'/>",
 'onyx-inlay': A => "<path d='M0 4h40M0 10h40' stroke='" + A + "' stroke-width='1.4'/>" +
   "<path d='M4 4v6M14 4v6M24 4v6M34 4v6' stroke='" + A + "' stroke-width='.9' opacity='.6'/>",
 'vip-crown': A => "<path d='M0 12l6-9 7 6 7-9 7 9 7-6 6 9Z' fill='" + A + "' opacity='.75'/>",
 'vip-aurora': A => "<path d='M0 9c7-9 13 7 20-1s13 7 20-1' fill='none' stroke='" + A + "' stroke-width='2' opacity='.8'/>" +
   "<path d='M0 4c7-9 13 7 20-1s13 7 20-1' fill='none' stroke='" + A + "' stroke-width='1' opacity='.45'/>",
 'vip-diamond': A => "<path d='M0 7l7-6 7 6-7 6ZM14 7l7-6 7 6-7 6ZM28 7l7-6 7 6-7 6Z' fill='none' stroke='" + A + "' stroke-width='1.3'/>"
};

/* Rakit CSS bingkai: 4 sudut (no-repeat) + 4 tepi (repeat) sebagai background. */
function ornBingkaiCss(A, gaya) {
  const sd = BK_SUDUT[gaya], tp = BK_TEPI[gaya];
  if (!sd || !tp) return '';
  const K = BK_K, E = BK_E, T = BK_T;
  const sTL = bkUri(sd(A), K, K);
  const sTR = bkUri(bkCerminX(sd(A), K, K), K, K);
  const sBR = bkUri(bkCerminXY(sd(A), K, K), K, K);
  const sBL = bkUri(bkCerminY(sd(A), K, K), K, K);
  const tT = bkUri(tp(A), E, T);
  const tB = bkUri(bkCerminY(tp(A), E, T), E, T);
  /* Tepi kiri/kanan = desain tepi atas yang diputar 90 derajat.
     rotate(-90) memetakan (x,y) ke (y,-x), lalu translate(0,E) mengangkatnya
     kembali ke kuadran positif sehingga pas di kotak T x E.
     rotate(90) memetakan (x,y) ke (-y,x), lalu translate(T,0) melakukan hal sama. */
  const tL = bkUri("<g transform='translate(0," + E + ") rotate(-90)'>" + tp(A) + '</g>', T, E);
  const tR = bkUri("<g transform='translate(" + T + ",0) rotate(90)'>" + tp(A) + "</g>", T, E);
  return [
    'background-image:' + [sTL, sTR, sBR, sBL, tT, tB, tL, tR].join(','),
    'background-size:' + [K + 'px ' + K + 'px', K + 'px ' + K + 'px', K + 'px ' + K + 'px', K + 'px ' + K + 'px',
      E + 'px ' + T + 'px', E + 'px ' + T + 'px', T + 'px ' + E + 'px', T + 'px ' + E + 'px'].join(','),
    'background-position:' + ['top left', 'top right', 'bottom right', 'bottom left',
      'top ' + (K - T / 2) + 'px left ' + K + 'px', 'bottom ' + (K - T / 2) + 'px left ' + K + 'px',
      'left ' + (K - T / 2) + 'px top ' + K + 'px', 'right ' + (K - T / 2) + 'px top ' + K + 'px'].join(','),
    'background-repeat:' + ['no-repeat', 'no-repeat', 'no-repeat', 'no-repeat',
      'repeat-x', 'repeat-x', 'repeat-y', 'repeat-y'].join(','),
    'background-origin:border-box'
  ].join(';');
}

/* Gaya bingkai untuk tiap id border. Border sederhana (thin, solid, dashed, ...)
   sengaja tidak dipetakan -- namanya memang jujur, tidak perlu dihias. */
const BINGKAI_GAYA = {
  /* KUNCI = id border yang ada di BORDERS. NILAI = nama gaya di BK_SUDUT/BK_TEPI.
     Keduanya bukan ruang nama yang sama: 'lace' dan 'ribbon' adalah nama gaya,
     sedangkan id border-nya 'lace-ivory' dan 'ribbon-satin'. Memakai nama gaya
     sebagai kunci membuat entri yang tak pernah cocok dengan border mana pun. */
  laurel: 'laurel', filigree: 'filigree', pearl: 'pearl',
  'lace-ivory': 'lace', artdeco: 'artdeco', 'gold-leaf': 'gold-leaf',
  'ribbon-satin': 'ribbon', 'pearl-crown': 'pearl-crown',
  'onyx-inlay': 'onyx-inlay', 'vip-crown': 'vip-crown',
  'vip-aurora': 'vip-aurora', 'vip-diamond': 'vip-diamond'
};
function ornBingkaiUntuk(id, A) {
  const g = BINGKAI_GAYA[id];
  if (!g) return '';
  try { return ornBingkaiCss(A, g); } catch (e) { return ''; }
}
