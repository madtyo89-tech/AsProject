/* tema-ai.js — mesin "AI" tema lokal untuk Studio Template.
 *
 * Tanpa jaringan, tanpa kunci API, tanpa ketergantungan pustaka. Masukannya
 * deskripsi bebas berbahasa Indonesia/Inggris; keluarannya 1–5 kandidat token
 * tema yang SEMUA id-nya sudah terdaftar di renderer (dijaga oleh
 * assets/tema-kosakata.js hasil tools/bangun-tema-kosakata.cjs).
 *
 * Prinsip:
 * - deterministik: seed = hash(prompt + acara + variasi) → hasil bisa diulang;
 * - aman: hanya field yang dikenal `validasi()` yang boleh lolos;
 * - sadar kontras: ink & accent dipaksa ≥ 4.5:1 terhadap warna dasar;
 * - hasil selalu DRAF: tidak ada yang menyentuh 44 template produksi.
 *
 * Dipakai: window.TEMA_AI.buat(prompt, opsi) → [kandidat, …]
 *          window.TEMA_AI.validasi(kandidat) → {ok, galat, nilai}
 *          window.TEMA_AI.dariJSON(teks)    → {ok, kandidat, galat}
 */
(function (root) {
  'use strict';
  var K = root.TEMA_KOSAKATA || {};
  var adaDaftar = function (nama) { return Array.isArray(K[nama]) && K[nama].length > 0; };
  var idDari = function (nama) {
    return (K[nama] || []).map(function (x) { return typeof x === 'string' ? x : x.id; });
  };
  var namaDari = function (nama, id) {
    var f = (K[nama] || []).filter(function (x) { return (typeof x === 'string' ? x : x.id) === id; })[0];
    return f && f.nama ? f.nama : id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  };

  /* ================= arketipe / "mood" ================= */
  var MOOD = {
    'hangat-organik': {
      label: 'Hangat organik', kunci: ['rustic', 'organik', 'alam', 'natural', 'earthy', 'tanah', 'kayu', 'zaitun', 'olive', 'sage', 'hijau', 'daun', 'boho', 'garden', 'taman'],
      palet: [
        { g: ['#F7F1E6', '#EBDCC6', '#D3BE9E'], accent: '#7C5A3A', ink: '#4B3B2B' },
        { g: ['#F3F1E7', '#DFE0CE', '#B9BE9E'], accent: '#5E6B45', ink: '#3C412F' },
        { g: ['#F6EEE3', '#E7D5C1', '#CDB49B'], accent: '#8A5A3C', ink: '#4F3A2A' }
      ],
      font: [['ebgaramond', 'lora'], ['marcellus', 'ebgaramond'], ['cormorant', 'lora'], ['merriweather', 'work-sans']],
      orn: ['zaitun', 'botanical', 'mawar', 'bunga'],
      pat: ['kawung', 'botanical', 'washi', 'kraft'],
      border: ['frame2', 'laurel', 'halo', 'double'],
      cover: ['kartu', 'minimal', 'archive'],
      buka: ['pita', 'buku', 'selendang'],
      deco: ['❀ ✦ ❀', '✿ ❋ ✿', '❖ ─ ❖'],
      namaA: ['Zaitun', 'Gandum', 'Ranting', 'Sekar', 'Tanah', 'Krem'],
      namaB: ['Senja', 'Pagi', 'Teduh', 'Hangat', 'Lembut'],
      desc: ['natural dan tenang', 'hangat seperti kertas daur ulang', 'organik, tidak berkilau']
    },
    'mewah-gelap': {
      label: 'Mewah gelap', kunci: ['mewah', 'luxury', 'elegan', 'gold', 'emas', 'gelap', 'dark', 'onyx', 'malam', 'night', 'black tie', 'royal', 'premium', 'drama', 'navy', 'gagah', 'berwibawa', 'maskulin'],
      palet: [
        { g: ['#1E1A15', '#2E2419', '#4A3A22'], accent: '#D4AF37', ink: '#F2E8D5' },
        { g: ['#171120', '#251A35', '#3D2652'], accent: '#D9B36A', ink: '#F5ECDE' },
        { g: ['#14342B', '#1F4D3E', '#356B55'], accent: '#D9B86C', ink: '#F0EAD6' }
      ],
      font: [['cinzel', 'ebgaramond'], ['playfair', 'cormorant'], ['marcellus', 'cormorant']],
      orn: ['onyx', 'deco', 'mahkota', 'mutiara'],
      pat: ['deco', 'sulur', 'marmer', 'damask'],
      border: ['onyx-inlay', 'vip-diamond', 'gold-leaf', 'royal', 'artdeco'],
      cover: ['night', 'royal', 'editorial'],
      buka: ['gembok', 'pintu', 'gerbang'],
      deco: ['✦ ❖ ✦', '❖ ✦ ❖', '✦ ✸ ✦'],
      namaA: ['Onyx', 'Emas', 'Zamrud', 'Malam', 'Kencana'],
      namaB: ['Agung', 'Sakral', 'Khidmat', 'Berwibawa', 'Gemilang'],
      desc: ['drama gelap dengan aksen foil', 'mewah tanpa ramai', 'gelap berkelas untuk acara malam']
    },
    'bersih-minimal': {
      label: 'Bersih minimal', kunci: ['minimal', 'minimalis', 'bersih', 'clean', 'putih', 'white', 'simpel', 'simple', 'editorial', 'modern', 'monokrom', 'abu', 'netral', 'neutral'],
      palet: [
        { g: ['#FBFAF6', '#F2EFE7', '#E4DFD2'], accent: '#1B1B1B', ink: '#26231D' },
        { g: ['#F7F7F5', '#EDEDE8', '#DBDBD4'], accent: '#3F3F3A', ink: '#2A2A26' },
        { g: ['#FAFAF8', '#EFEFEA', '#DCDCD3'], accent: '#5A5753', ink: '#3A3833' }
      ],
      font: [['playfair', 'inter'], ['work-sans', 'inter'], ['montserrat', 'inter'], ['cormorant', 'work-sans']],
      orn: ['geometrik', 'klasik', 'coretan'],
      pat: ['marmer', 'damask', 'washi'],
      border: ['thin', 'topbot', 'corners', 'none'],
      cover: ['minimal', 'editorial', 'kartu'],
      buka: ['tirai', 'buku', 'pita'],
      deco: ['· ─ ·', '✦ · ✦', '— —'],
      namaA: ['Putih', 'Kosong', 'Garis', 'Kertas', 'Netral'],
      namaB: ['Minimal', 'Tenang', 'Bersih', 'Sunyi', 'Polos'],
      desc: ['lapang, tipografi tegas, tanpa ornamen ramai', 'netral dan mudah dibaca', 'minimal dengan ruang kosong lega']
    },
    'ceria-anak': {
      label: 'Ceria anak', kunci: ['ceria', 'anak', 'kids', 'ultah', 'ulang tahun', 'birthday', 'party', 'pesta', 'balon', 'confetti', 'warna', 'colorful', 'fun', 'lucu', 'gemas', 'bayi', 'baby'],
      palet: [
        { g: ['#FFF1C1', '#FFE082', '#FFB74D'], accent: '#B87A1A', ink: '#82602B' },
        { g: ['#E0F2FF', '#B8DAFF', '#7FB8F0'], accent: '#3A6EA5', ink: '#2D5680' },
        { g: ['#F9D5E5', '#F4A9C4', '#E57AA0'], accent: '#9E4A66', ink: '#76374C' }
      ],
      font: [['pacifico', 'poppins'], ['dancing', 'poppins'], ['bebas', 'montserrat'], ['caveat', 'poppins']],
      orn: ['confetti', 'awan', 'bintang', 'pita', 'kembang-api'],
      pat: ['confetti', 'tabur', 'zigzag', 'surya'],
      border: ['dashed', 'dotted', 'ribbon-satin', 'vip-aurora'],
      cover: ['polaroid', 'foto', 'neon', 'glass'],
      buka: ['pita', 'kotak', 'tirai'],
      deco: ['✸ ★ ✸', '☀ ✦ ☀', '★ ✦ ★'],
      namaA: ['Pelangi', 'Balon', 'Ceria', 'Bintang', 'Permen'],
      namaB: ['Riang', 'Gembira', 'Manis', 'Lucu', 'Sorai'],
      desc: ['cerah dan playful, aman untuk anak', 'warna ceria dengan tepi lembut', 'pesta kecil yang meriah']
    },
    'islami-tenang': {
      label: 'Islami tenang', kunci: ['islami', 'islam', 'muslim', 'khitanan', 'aqiqah', 'doa', 'kaligrafi', 'arab', 'girih', 'masjid', 'syar', 'adab', 'bismillah'],
      palet: [
        { g: ['#E6F0E6', '#C9DCC9', '#A3C4A3'], accent: '#4A6741', ink: '#3C5236' },
        { g: ['#F5F2E4', '#E7E3CB', '#D2CBA8'], accent: '#6E7A52', ink: '#4E4A36' },
        { g: ['#EAF2EC', '#CFE0D4', '#AAC7B3'], accent: '#3A765F', ink: '#32503F' }
      ],
      font: [['cinzel', 'ebgaramond'], ['marcellus', 'lora'], ['ebgaramond', 'cormorant'], ['cormorant', 'marcellus']],
      orn: ['arabesque', 'bulan', 'bintang', 'mutiara'],
      pat: ['girih', 'arab', 'damask', 'kawung'],
      border: ['filigree', 'corners', 'laurel', 'pearl'],
      cover: ['gerbang', 'kartu', 'minimal'],
      buka: ['gerbang', 'pintu', 'selendang'],
      deco: ['۞ ✦ ۞', '❖ ✦ ❖', '۞ ❖ ۞'],
      namaA: ['Adab', 'Nur', 'Sakinah', 'Zamrud', 'Damai'],
      namaB: ['Tenang', 'Khidmat', 'Bercahaya', 'Teduh', 'Suci'],
      desc: ['tenang dengan kaligrafi dan geometri halus', 'islami yang menenangkan', 'hijau damai dan doa yang lapang']
    },
    'tropis-segar': {
      label: 'Tropis segar', kunci: ['tropis', 'tropical', 'monstera', 'pantai', 'beach', 'laut', 'palm', 'rimba', 'segar', 'fresh', 'bali', 'hijau tua', 'daun lebar'],
      palet: [
        { g: ['#F0F7EE', '#D6EAD9', '#A9CDB0'], accent: '#1F6B44', ink: '#274A33' },
        { g: ['#E9F6F2', '#CBE7DD', '#9FCBBE'], accent: '#1D6B63', ink: '#24544E' },
        { g: ['#F3F8E9', '#DFEDC8', '#C2DCA3'], accent: '#4A7A2A', ink: '#3A5A26' }
      ],
      font: [['merriweather', 'lora'], ['lora', 'work-sans'], ['cormorant', 'montserrat']],
      orn: ['botanical', 'bunga', 'zaitun', 'mawar'],
      pat: ['monstera', 'botanical', 'ombak', 'rimbun'],
      border: ['laurel', 'frame', 'halo', 'pearl'],
      cover: ['foto', 'sakura', 'glass', 'minimal'],
      buka: ['tirai', 'pita', 'selendang'],
      deco: ['❀ ✦ ❀', '✿ ❋ ✿', '❁ ✦ ❁'],
      namaA: ['Rimba', 'Daun', 'Palem', 'Tropis', 'Embun'],
      namaB: ['Segar', 'Basah', 'Hijau', 'Pagi', 'Sejuk'],
      desc: ['hijau segar berdaun lebar', 'tropis yang lapang dan sejuk', 'botani rimbun tanpa berat']
    },
    'nostalgia-kertas': {
      label: 'Nostalgia kertas', kunci: ['kraft', 'kertas', 'paper', 'nostalgia', 'vintage', 'retro', 'wabi', 'sabi', 'tulisan tangan', 'handletter', 'kuno', 'klasik', 'photo', 'polaroid'],
      palet: [
        { g: ['#EFE4D0', '#E0CDA6', '#C9AE83'], accent: '#7C5230', ink: '#4E3B26' },
        { g: ['#F4E7D7', '#E4C9AE', '#CBA37C'], accent: '#9C6B4F', ink: '#5E4634' },
        { g: ['#F1ECE3', '#E4DBCB', '#CFC0AA'], accent: '#8C7A64', ink: '#57503F' }
      ],
      font: [['caveat', 'ebgaramond'], ['sacramento', 'cormorant'], ['lora', 'work-sans'], ['cormorant', 'ebgaramond']],
      orn: ['coretan', 'mutiara', 'zaitun', 'klasik'],
      pat: ['kraft', 'washi', 'frost', 'marmer'],
      border: ['gapdash', 'halo', 'pearl', 'thin'],
      cover: ['archive', 'ticket', 'polaroid', 'kartu'],
      buka: ['buku', 'amplop', 'pita'],
      deco: ['✁ ✦ ✁', '・ ✦ ・', '❖ ─ ❖'],
      namaA: ['Kertas', 'Arsip', 'Tinta', 'Surat', 'Album'],
      namaB: ['Lama', 'Kenangan', 'Usang', 'Manis', 'Hangat'],
      desc: ['tekstur kertas dan tulisan tangan', 'nostalgia album lama', 'usang yang manis, tidak berkilau']
    },
    'editorial-berani': {
      label: 'Editorial berani', kunci: ['berani', 'bold', 'editorial', 'kontras', 'kontras tinggi', 'art deco', 'artdeco', 'retro', 'surya', 'neon', 'grafis', 'poster', 'tipografi'],
      palet: [
        { g: ['#FFF4E6', '#FFD9A8', '#F2994A'], accent: '#B4530A', ink: '#5C3A1E' },
        { g: ['#FFEAC2', '#F9CE5E', '#F09A3E'], accent: '#0E5E50', ink: '#3B2C16' },
        { g: ['#F3EDE6', '#DED2C4', '#C0AC97'], accent: '#8C2F39', ink: '#4A2B2B' }
      ],
      font: [['playfair', 'montserrat'], ['bebas', 'inter'], ['oswald', 'work-sans'], ['cinzel', 'montserrat']],
      orn: ['deco', 'geometrik', 'bintang', 'mahkota'],
      pat: ['surya', 'zigzag', 'deco', 'ombak'],
      border: ['artdeco', 'topline', 'solid', 'vip-aurora'],
      cover: ['editorial', 'neon', 'ticket', 'foto'],
      buka: ['tirai', 'gerbang', 'pintu'],
      deco: ['☀ ✦ ☀', '✦ — ✦', '✸ ✦ ✸'],
      namaA: ['Sorot', 'Poster', 'Garis', 'Surya', 'Kontras'],
      namaB: ['Utama', 'Berani', 'Tegas', 'Raksasa', 'Nyaring'],
      desc: ['tipografi besar dan kontras tegas', 'poster editorial yang berani', 'warna kuat, komposisi asimetris']
    }
  };

  /* warna dasar yang dikenal dari prompt */
  var WARNA = [
    { kata: ['merah', 'maroon', 'burgundy', 'red'], h: 355, s: .55 },
    { kata: ['pink', 'rose', 'blush', 'magenta'], h: 335, s: .55 },
    { kata: ['ungu', 'purple', 'lavender', 'plum', 'violet'], h: 275, s: .35 },
    { kata: ['biru', 'blue', 'dongker', 'biru tua'], h: 218, s: .45 },
    { kata: ['navy', 'midnight', 'biru malam'], h: 220, s: .5, gelap: true },
    { kata: ['teal', 'tosca', 'turquoise', 'cyan'], h: 175, s: .4 },
    { kata: ['zaitun', 'olive'], h: 86, s: .24 },
    { kata: ['sage'], h: 122, s: .20 },
    { kata: ['mint', 'minty'], h: 155, s: .26 },
    { kata: ['emerald', 'zamrud'], h: 155, s: .38 },
    { kata: ['hijau', 'green'], h: 108, s: .30 },
    { kata: ['kuning', 'yellow', 'mustard', 'gold', 'emas', 'champagne'], h: 45, s: .5 },
    { kata: ['oranye', 'orange', 'terracotta', 'terakota', 'apricot', 'senja'], h: 24, s: .6 },
    { kata: ['coklat', 'brown', 'kayu', 'tanah', 'kraft', 'kopi'], h: 30, s: .32 },
    { kata: ['krem', 'cream', 'ivory', 'gading', 'beige', 'kertas'], h: 40, s: .25 },
    { kata: ['abu', 'gray', 'grey', 'netral', 'monokrom'], h: 40, s: .06 },
    { kata: ['hitam', 'black', 'gelap', 'dark', 'onyx', 'malam'], h: 30, s: .2, gelap: true }
  ];

  /* ================= util ================= */
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var pilih = function (r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; };

  function hex2rgb(h) {
    var s = String(h).replace('#', '');
    if (s.length === 3) s = s.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function rgb2hex(c) {
    return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  }
  function lum(h) {
    var c = hex2rgb(h).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function kontras(a, b) {
    var l1 = lum(a), l2 = lum(b);
    var terang = Math.max(l1, l2), gelap = Math.min(l1, l2);
    return (terang + 0.05) / (gelap + 0.05);
  }
  function rgb2hsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
    }
    h = (h * 60 + 360) % 360;
    var l = (max + min) / 2;
    var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h: h, s: s, l: l };
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [t[0] + m, t[1] + m, t[2] + m].map(function (v) { return v * 255; });
  }
  function geserHue(hex, hue, bobot) {
    var c = rgb2hsl(hex2rgb(hex));
    var baru = { h: c.h + ((hue - c.h + 540) % 360 - 180) * bobot, s: c.s, l: c.l };
    return rgb2hex(hsl2rgb(baru.h, baru.s, baru.l));
  }

  /* paksa kontras ≥ 4.5 dengan menggeser lightness */
  function paksaKontras(warna, latar, target) {
    var c = rgb2hsl(hex2rgb(warna));
    var l = c.l;
    var gelap = lum(latar) < 0.35;
    for (var i = 0; i < 24 && kontras(rgb2hex(hsl2rgb(c.h, c.s, l)), latar) < (target || 4.5); i++) {
      l += gelap ? 0.035 : -0.035;
      l = Math.max(0.03, Math.min(0.97, l));
    }
    return rgb2hex(hsl2rgb(c.h, c.s, l));
  }

  function normalisasiTeks(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function analisa(prompt, ev) {
    var t = normalisasiTeks(prompt);
    var skor = {}, kata = [];
    Object.keys(MOOD).forEach(function (m) {
      skor[m] = 0;
      MOOD[m].kunci.forEach(function (k) {
        if (t.indexOf(k) >= 0) { skor[m] += k.length > 5 ? 2 : 1; kata.push(k); }
      });
    });
    var mood = Object.keys(skor).sort(function (a, b) { return skor[b] - skor[a]; })[0];
    if (!skor[mood]) {
      /* tanpa kata kunci mood: turunkan dari jenis acara */
      mood = ev === 'ultah' ? 'ceria-anak' : ev === 'aqiqah' || ev === 'khitanan' ? 'islami-tenang' : 'hangat-organik';
    }
    var warna = null, warnaKata = '';
    WARNA.forEach(function (w) {
      w.kata.forEach(function (k) {
        if (!warna && t.indexOf(k) >= 0) { warna = w; warnaKata = k; }
      });
    });
    var emas = /(^|[^a-z])(emas|gold|champagne|mustard)([^a-z]|$)/.test(t);
    return { mood: mood, warna: warna, warnaKata: warnaKata, emas: emas, kata: kata, skor: skor };
  }

  /* ================= validasi ================= */
  var IZIN = ['nama', 'ev', 'g', 'accent', 'ink', 'ft', 'char', 'orn', 'pat', 'border', 'deco', 'desc', 'cover', 'buka', 'arch'];
  function hexSah(v) { return /^#[0-9a-f]{6}$/i.test(String(v || '')); }

  function validasi(t) {
    var galat = [];
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { ok: false, galat: ['bukan objek'], nilai: null };
    Object.keys(t).forEach(function (k) { if (IZIN.indexOf(k) < 0) galat.push('field tidak dikenal: ' + k); });
    var nama = String(t.nama || '').trim();
    if (nama.length < 3 || nama.length > 40) galat.push('nama harus 3–40 karakter');
    if (idDari('ev').indexOf(t.ev) < 0) galat.push('ev tidak dikenal: ' + t.ev);
    if (!Array.isArray(t.g) || t.g.length !== 3) galat.push('g harus 3 warna');
    else t.g.forEach(function (c, i) { if (!hexSah(c)) galat.push('g[' + i + '] bukan hex #RRGGBB'); });
    if (!hexSah(t.accent)) galat.push('accent bukan hex');
    if (!hexSah(t.ink)) galat.push('ink bukan hex');
    if (idDari('fonts').indexOf(t.ft) < 0) galat.push('font tidak terdaftar: ' + t.ft);
    if (t.orn && idDari('ornamen').indexOf(t.orn) < 0) galat.push('ornamen tidak terdaftar: ' + t.orn);
    if (t.pat && idDari('pola').indexOf(t.pat) < 0) galat.push('pola tidak terdaftar: ' + t.pat);
    if (idDari('borders').indexOf(t.border) < 0) galat.push('border tidak terdaftar: ' + t.border);
    if (t.cover && idDari('covers').indexOf(t.cover) < 0) galat.push('cover tidak terdaftar: ' + t.cover);
    if (t.buka && idDari('buka').indexOf(t.buka) < 0) galat.push('cara buka tidak terdaftar: ' + t.buka);
    if (t.char != null) {
      var ch = String(t.char);
      if (ch.length > 12 || (ch && !/^[A-Z0-9 .&'-]+$/.test(ch))) galat.push('char maks 12 huruf kapital/angka');
    }
    if (t.deco != null && (String(t.deco).length < 1 || String(t.deco).length > 8)) galat.push('deco 1–8 karakter');
    if (t.desc != null && String(t.desc).length > 180) galat.push('desc maks 180 karakter');
    if (t.arch != null && typeof t.arch !== 'boolean') galat.push('arch harus boolean');
    if (!galat.length) {
      if (kontras(t.ink, t.g[0]) < 4.5) galat.push('kontras ink/latar ' + kontras(t.ink, t.g[0]).toFixed(2) + ':1 (< 4.5)');
      if (kontras(t.accent, t.g[0]) < 4.5) galat.push('kontras accent/latar ' + kontras(t.accent, t.g[0]).toFixed(2) + ':1 (< 4.5)');
    }
    var nilai = null;
    if (!galat.length) {
      nilai = {
        nama: nama, ev: t.ev, g: t.g.map(function (c) { return c.toUpperCase(); }),
        accent: t.accent.toUpperCase(), ink: t.ink.toUpperCase(), ft: t.ft,
        char: t.char ? String(t.char).toUpperCase() : '', orn: t.orn || '', pat: t.pat || '',
        border: t.border, deco: t.deco || '✦ ❖ ✦', desc: String(t.desc || '').slice(0, 180),
        cover: t.cover || 'kartu', buka: t.buka || 'pita', arch: !!t.arch
      };
    }
    return { ok: !galat.length, galat: galat, nilai: nilai };
  }

  /* Menyusun palet dari warna yang disebut prompt.
     Hue dipakai apa adanya, tetapi lightness & saturation mengikuti nada
     arketipe (terang vs gelap) supaya hasilnya tidak pernah "neon":
     latar selalu bertingkat terang→dalam, aksen cukup gelap untuk teks,
     tinta dipilih agar kontras ≥ 4.5:1. */
  function paletDariWarna(w, mood, berani, r, adaEmas, variasi) {
    var gelap = !!w.gelap || mood === 'mewah-gelap';
    var hangat = mood === 'hangat-organik' || mood === 'nostalgia-kertas';
    var h = (w.h + (hangat ? 8 : 0) + 360) % 360;
    var emas = !!adaEmas || ['gold', 'emas', 'champagne', 'mustard'].indexOf(w.kataAsli) >= 0;
    var s = w.s;
    var jitter = function (d) { return (r() - 0.5) * d; };
    /* tiga kandidat dari satu prompt tidak boleh berwarna sama:
       kandidat 2 digeser lebih dalam, kandidat 3 digeser hue-nya. */
    if (variasi === 1) h = (h + 16) % 360;
    if (variasi === 2) h = (h - 14 + 360) % 360;
    var turun = variasi === 1 ? -0.022 : 0;
    var c = function (hh, ss, ll) { return rgb2hex(hsl2rgb(hh, Math.max(0, Math.min(1, ss)), ll)); };
    if (!gelap) {
      return {
        /* HSL di lightness tinggi butuh saturasi lebih besar agar tint terlihat */
        g: [c(h, Math.min(.55, s * .55), .958 + jitter(.006) + turun),
            c(h, Math.min(.75, s * .90), .884 + jitter(.010) + turun),
            c(h, Math.min(.85, s * 1.10), .762 + jitter(.012) + turun)],
        accent: emas ? c(variasi === 1 ? 40 : 45, .50, .36) : c(h, Math.min(.62, s * 1.15), .33),
        ink: c(h, Math.min(.24, s * .55), .205)
      };
    }
    return {
      g: [c(h, Math.min(.30, s * .55), .105 + jitter(.008)), c(h, Math.min(.34, s * .62), .165 + jitter(.01)), c(h, Math.min(.40, s * .72), .265 + jitter(.012))],
      accent: emas ? c(45, .62, .62) : c(h, Math.min(.55, s * .95), .74),
      ink: c(h, .10, .955)
    };
  }

  /* ================= generator ================= */
  function buat(prompt, opsi) {
    opsi = opsi || {};
    var ev = idDari('ev').indexOf(opsi.ev) >= 0 ? opsi.ev : 'pernikahan';
    var jumlah = Math.max(1, Math.min(5, Number(opsi.jumlah) || 3));
    var berani = Math.max(1, Math.min(3, Number(opsi.keberanian) || 1));
    var kunci = opsi.kunci || {};
    var info = analisa(prompt, ev);
    var mood = MOOD[info.mood];
    var dasar = hash(normalisasiTeks(prompt) + '|' + ev + '|' + (opsi.seed || 0) + '|' + berani);

    var hasil = [], dipakai = {};
    for (var i = 0; i < jumlah; i++) {
      var terpasang = false;
      for (var coba = 0; coba < 40 && !terpasang; coba++) {
      var r = rng(dasar + i * 7919 + coba * 104729);
      var palet = Object.assign({}, mood.palet[i % mood.palet.length]);
      if (info.warna) palet = paletDariWarna(info.warna, info.mood, berani, r, info.emas, i);
      if (kunci.g) palet.g = kunci.g.slice(0, 3);
      if (kunci.accent) palet.accent = kunci.accent;
      if (kunci.ink) palet.ink = kunci.ink;

      /* kontras: ink & accent terhadap warna dasar */
      var ink = paksaKontras(palet.ink, palet.g[0], 4.8);
      var accent = paksaKontras(palet.accent, palet.g[0], 4.5);

      var pasangan = pilih(r, mood.font);
      var ft = kunci.ft || pasangan[0];
      var orn = pilih(r, mood.orn);
      var pat = pilih(r, mood.pat);
      var border = pilih(r, mood.border);
      var cover = pilih(r, mood.cover);
      var buka = pilih(r, mood.buka);
      if (berani === 3) {
        /* silang mood: ambil satu sifat visual dari arketipe lain */
        var lain = Object.keys(MOOD).filter(function (m) { return m !== info.mood; });
        var m2 = MOOD[pilih(r, lain)];
        if (r() < 0.5) border = pilih(r, m2.border); else pat = pilih(r, m2.pat);
      }

      var namaA = pilih(r, mood.namaA), namaB = pilih(r, mood.namaB);
      var nama = namaA + ' ' + namaB;
      var n = 2;
      while (dipakai[nama.toLowerCase()] && n < 12) { nama = pilih(r, mood.namaA) + ' ' + pilih(r, mood.namaB); n++; }
      dipakai[nama.toLowerCase()] = 1;

      var kandidat = {
        nama: nama,
        ev: ev,
        g: palet.g.map(function (c) { return c.toUpperCase(); }),
        accent: accent, ink: ink,
        ft: ft,
        char: (info.kata.indexOf('adat') >= 0 || info.kata.indexOf('jawa') >= 0 || info.kata.indexOf('sunda') >= 0 ? 'ADAT' : namaA.toUpperCase()).slice(0, 12),
        orn: orn, pat: pat, border: border,
        deco: pilih(r, mood.deco),
        desc: (namaA + ' ' + namaB + ' — ' + pilih(r, mood.desc) +
          (info.warnaKata ? ', sentuhan ' + info.warnaKata : '')).slice(0, 180),
        cover: cover, buka: buka,
        arch: cover === 'gerbang' || r() < 0.18
      };
      var cek = validasi(kandidat);
      if (cek.ok) { hasil.push(cek.nilai); terpasang = true; }
      }
    }
    return hasil;
  }

  function dariJSON(teks) {
    var s = String(teks || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (!s) return { ok: false, kandidat: [], galat: ['masukan kosong'] };
    var data;
    try { data = JSON.parse(s); } catch (e) { return { ok: false, kandidat: [], galat: ['JSON tidak valid: ' + e.message] }; }
    var arr = Array.isArray(data) ? data : [data];
    if (!arr.length) return { ok: false, kandidat: [], galat: ['tidak ada kandidat'] };
    var kandidat = [], galat = [];
    arr.slice(0, 5).forEach(function (t, i) {
      var cek = validasi(t);
      if (cek.ok) kandidat.push(cek.nilai);
      else galat.push('kandidat ' + (i + 1) + ': ' + cek.galat.join('; '));
    });
    return { ok: kandidat.length > 0, kandidat: kandidat, galat: galat };
  }

  root.TEMA_AI = {
    versi: '1.0.0',
    buat: buat,
    validasi: validasi,
    dariJSON: dariJSON,
    analisa: analisa,
    kontras: kontras,
    paksaKontras: paksaKontras,
    MOOD: Object.keys(MOOD),
    labelMood: function (m) { return (MOOD[m] || {}).label || m; },
    /** dipakai UI untuk menampilkan nama id yang ramah */
    namaFont: function (id) { return namaDari('fonts', id); },
    namaPola: function (id) { return namaDari('pola', id); },
    namaBorder: function (id) { return namaDari('borders', id); },
    namaOrnamen: function (id) { return namaDari('ornamen', id); },
    namaCover: function (id) { return namaDari('covers', id); },
    namaBuka: function (id) { return namaDari('buka', id); },
    _adaDaftar: adaDaftar
  };
})(typeof window !== 'undefined' ? window : globalThis);
