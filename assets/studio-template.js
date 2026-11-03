/* studio-template.js — Studio Template AsProject.
   Meracik tema BARU dari template yang sudah ada, tanpa mengubah satu pun
   template produksi. Hasil racikan = draf lokal + kode ekspor yang bisa
   dimasukkan ke kerangka/template.js (satu-satunya jalur resmi tema baru).

   Aturan penting yang dijaga halaman ini:
   - Daftar tema dibaca dari assets/tpl-data.js (dibangkitkan dari kerangka/).
   - Tidak ada tulisan ke Supabase, tidak ada publish undangan dari sini.
   - Tema asli tidak pernah diubah: memilih template = membuat salinan draf. */
(function () {
  'use strict';

  var ASP = window.ASP;
  var TPL = Array.isArray(window.ASP_TPL) ? window.ASP_TPL : [];
  var KEY = 'asproject_studio_template_v1';
  var KATALOG_KEY = 'asproject_katalog_setting_v1';

  var EV = {
    pernikahan: { label: 'Pernikahan', icon: '💍' },
    khitanan: { label: 'Khitanan', icon: '🕌' },
    ultah: { label: 'Ulang Tahun', icon: '🎂' },
    aqiqah: { label: 'Aqiqah', icon: '👶' },
    all: { label: 'Semua Acara', icon: '✨' }
  };

  /* Daftar pilihan = id yang benar-benar dikenal renderer undangan.html.
     Disalin dari registry studio.html/undangan.html; kalau registry berubah,
     ubah di sini juga. Diuji oleh tools/test-studio-template.cjs. */
  var FONTS = [['cormorant', 'Cormorant Garamond'], ['playfair', 'Playfair Display'], ['poppins', 'Poppins Bold'], ['inter', 'Inter'], ['lora', 'Lora'], ['montserrat', 'Montserrat'], ['bebas', 'Bebas Neue'], ['oswald', 'Oswald'], ['ebgaramond', 'EB Garamond'], ['merriweather', 'Merriweather'], ['work-sans', 'Work Sans'], ['pacifico', 'Pacifico'], ['dancing', 'Dancing Script'], ['caveat', 'Caveat'], ['sacramento', 'Sacramento'], ['cinzel', 'Cinzel Imperial'], ['marcellus', 'Marcellus Royal']];
  var ORN = [['klasik', 'Klasik Gulung'], ['botanical', 'Botanical'], ['arabesque', 'Arabesque'], ['deco', 'Art Deco'], ['confetti', 'Confetti'], ['mutiara', 'Mutiara'], ['awan', 'Awan'], ['bunga', 'Bunga'], ['bintang', 'Bintang'], ['onyx', 'Onyx'], ['batik', 'Batik Kawung'], ['mawar', 'Mawar'], ['geometrik', 'Geometrik'], ['kembang-api', 'Kembang Api'], ['bulan', 'Bulan Sabit'], ['pita', 'Pita'], ['zaitun', 'Zaitun'], ['mahkota', 'Mahkota'], ['coretan', 'Coretan Tangan']];
  var BORDERS = [['none', 'Tanpa Border'], ['thin', 'Garis Halus'], ['solid', 'Garis Teguh'], ['double', 'Ganda Klasik'], ['dashed', 'Putih Putus'], ['dotted', 'Titik-titik'], ['ridge', 'Ridged'], ['groove', 'Gravir'], ['inset', 'Cekung'], ['outset', 'Cembung'], ['topbot', 'Atas & Bawah'], ['topline', 'Serat Atas'], ['frame', 'Bingkai Dalam'], ['frame2', 'Bingkai Rangkap'], ['gap', 'Bingkai Jarak'], ['gapdash', 'Bingkai Putus'], ['halo', 'Halo Lembut'], ['corners', 'Sudut Elegan'], ['filigree', 'Filigree'], ['laurel', 'Laurel'], ['pearl', 'Mutiara'], ['pearl-crown', 'Mahkota Mutiara'], ['lace-ivory', 'Renda Ivory'], ['ribbon-satin', 'Pita Saten'], ['artdeco', 'Art Deco'], ['gold-leaf', 'Daun Emas'], ['onyx-inlay', 'Onyx Inlay'], ['vip-diamond', 'VIP Diamond'], ['vip-crown', 'VIP Crown'], ['vip-aurora', 'VIP Aurora'], ['particle', 'Partikel'], ['blinds', 'Tirai']];
  var COVERS = [['amplop', 'Amplop Klasik', '✉️'], ['kartu', 'Kartu Stationery', '💌'], ['foto', 'Foto Penuh', '🖼️'], ['gerbang', 'Gerbang Lengkung', '🏛️'], ['minimal', 'Minimalis', '✦'], ['batik', 'Batik Nusantara', '🧵'], ['sakura', 'Taman Sakura', '🌸'], ['night', 'Langit Malam', '🌙'], ['ticket', 'Tiket Kenangan', '🎟️'], ['editorial', 'Editorial Majalah', '📰'], ['polaroid', 'Tumpukan Polaroid', '📸'], ['glass', 'Kaca Embun', '🫧'], ['royal', 'Royal Nusantara', '👑'], ['archive', 'Surat Arsip', '📜'], ['neon', 'Neon Kota', '🌃']];
  var CARA = [['pita', 'Pita Saten', '🎀'], ['tirai', 'Tirai Teater', '🪟'], ['gerbang', 'Gerbang Melengkung', '🏛️'], ['pintu', 'Pintu Berpanel', '🚪'], ['buku', 'Sampul Buku', '📖'], ['amplop', 'Amplop Segel', '✉️'], ['gembok', 'Gembok Antik', '🔐'], ['kotak', 'Kotak Cincin', '💍'], ['selendang', 'Selendang Songket', '🧵']];
  var POLA = [['', 'Ikut tema'], ['batik', 'Batik'], ['botanical', 'Botanical'], ['frost', 'Frost'], ['arab', 'Arab'], ['confetti', 'Confetti'], ['mendung', 'Mendung'], ['parang', 'Parang'], ['kawung', 'Kawung'], ['damask', 'Damask'], ['girih', 'Girih'], ['deco', 'Art Deco'], ['sulur', 'Sulur'], ['renda', 'Renda'], ['marmer', 'Marmer'], ['ombak', 'Ombak'], ['zigzag', 'Zigzag'], ['tabur', 'Tabur'], ['surya', 'Surya'], ['rimbun', 'Rimbun'], ['monstera', 'Monstera'], ['kraft', 'Kraft'], ['washi', 'Washi']];
  var DECO = ['✦ ❖ ✦', '❖ ✦ ❖', '✿ ❋ ✿', '❀ ❁ ❀', '★ ✦ ★', '۞ ✦ ۞', '❖ ─ ❖', '✦ ☁ ✦', '✸ ★ ✸', '✦ ✸ ✦', '✦ ❀ ✦'];
  var LAYOUT_NAMA = {
    'klasik': 'Klasik', 'arsip': 'Arsip Jawa', 'editorial-sage': 'Editorial Sage', 'editorial-mutiara': 'Editorial Mutiara',
    'panggung-emas': 'Panggung Emas', 'panggung-gerbang': 'Panggung Gerbang', 'zigzag-rustic': 'Zigzag Rustic',
    'zigzag-jubile': 'Zigzag Jubilee', 'poster-ceria': 'Poster Ceria', 'poster-anak': 'Poster Anak',
    'bab-islami': 'Bab Islami', 'bab-netral': 'Bab Netral', 'bab-royal': 'Bab Royal', 'kaca-manis': 'Kaca Manis',
    'kaca-dewasa': 'Kaca Dewasa', 'lembut-biru': 'Lembut Biru', 'lembut-merah': 'Lembut Merah',
    'split-midnight': 'Split Midnight', 'split-navy': 'Split Navy'
  };
  var PALET = [
    ['Ivory Emas', ['#FBFAF7', '#F0ECE3', '#DCD3C3'], '#8A6E4B', '#4B4237'],
    ['Zamrud', ['#14342B', '#1F4D3E', '#356B55'], '#D9B86C', '#F0EAD6'],
    ['Midnight', ['#1E1A15', '#2E2419', '#4A3A22'], '#D4AF37', '#F2E8D5'],
    ['Sage', ['#D9E4D7', '#C2D4BE', '#A8BEA3'], '#5F7A5C', '#4A6647'],
    ['Rose', ['#FBE9E7', '#F8CFC8', '#E8AFA4'], '#A66A5E', '#70463E'],
    ['Navy', ['#16233F', '#223457', '#334B76'], '#E7C27D', '#F2ECDC'],
    ['Kraft', ['#F7F0E6', '#EBDFC9', '#D9C7A7'], '#7C5A3A', '#4E3F30'],
    ['Pastel Biru', ['#E3F2FD', '#BBDEFB', '#90CAF9'], '#4A7FB5', '#32567B']
  ];

  var db = ASP.load(KEY, { drafts: [], activeId: null });
  if (!Array.isArray(db.drafts)) db.drafts = [];
  var filter = 'semua';
  var q = '';
  var active = null;
  var compareOn = false;
  var saveTimer = 0;

  var $ = function (id) { return document.getElementById(id); };
  var esc = ASP.esc;

  /* ---------- util ---------- */
  function slugify(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  }
  function tplById(id) { return TPL.find(function (t) { return t.id === id; }) || null; }
  /* Slug dipakai sebagai id tema di kerangka; renderer live hanya mengenali
     id `custom-…` untuk tema draf. Kalau pengguna mengosongkan slug, pakai
     cadangan supaya pratinjau tetap jalan (bukan jatuh ke tema basis). */
  function safeSlug(t) {
    var s = String(t && t.slug || '').toLowerCase();
    return /^[a-z0-9][a-z0-9-]{2,}$/.test(s) ? s : 'tema-baru';
  }
  function hex(v, fallback) { return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toUpperCase() : fallback; }
  function indexOfTpl(id) { return TPL.findIndex(function (t) { return t.id === id; }); }

  function draftFrom(t, keepId) {
    var base = tplById(t.id) || TPL[0] || {};
    var slug = (t.id || 'tema-baru').replace(/[^a-z0-9-]/g, '-');
    return {
      id: keepId || ('custom-' + slug + '-' + Math.random().toString(36).slice(2, 6)),
      slug: slug,
      nama: (t.nama || 'Tema Baru') + '',
      ev: t.ev || 'pernikahan',
      harga: Number(t.harga) || 49000,
      badge: t.badge || '',
      deskripsi: t.desc || '',
      baseTpl: t.id || (TPL[0] && TPL[0].id) || '',
      g: (t.g || base.g || ['#FBFAF7', '#F0ECE3', '#DCD3C3']).slice(0, 3),
      accent: t.accent || base.accent || '#8A6E4B',
      ink: t.ink || base.ink || '#4B4237',
      deco: t.deco || '✦ ❖ ✦',
      char: t.char || '',
      ft: t.ft || base.ft || 'cormorant',
      fontBody: 'inter',
      pat: t.pat || base.pat || '',
      border: t.border || base.border || 'double',
      orn: t.orn || base.orn || '',
      cover: t.cover || base.cover || 'amplop',
      buka: t.buka || base.buka || 'pita',
      savedAt: null,
      origin: t.id || null
    };
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (active && active.id) {
        var i = db.drafts.findIndex(function (d) { return d.id === active.id; });
        active.savedAt = new Date().toISOString();
        if (i >= 0) db.drafts[i] = JSON.parse(JSON.stringify(active));
        else db.drafts.push(JSON.parse(JSON.stringify(active)));
        db.activeId = active.id;
      }
      ASP.save(KEY, db);
      renderStatus();
      renderList();
    }, 260);
  }

  /* ---------- pratinjau ---------- */
  function sampleForm(ev) {
    var base = {
      salamBuka: 'Assalamu’alaikum warahmatullahi wabarakatuh',
      salamTutup: 'Merupakan kebahagiaan bagi kami apabila Anda berkenan hadir.',
      tanggalAcara: '2027-08-21', jamAcara: '10:00', zona: 'WIB',
      venue: 'Gedung Serbaguna', alamat: 'Jl. Contoh No. 12, Bandung',
      mapsLink: '', showMapsBtn: true, sesiKedua: false, showBismillah: true,
      namaPria: 'Rafi Pratama', namaWanita: 'Alya Putri',
      gelarPria: '', gelarWanita: '', putraPutri: 'Putra dari Bapak & Ibu Pratama', putriDari: 'Putri dari Bapak & Ibu Sutanto',
      namaAnak: 'Alya Putri', putraDari: 'Bapak & Ibu Pratama', umurAnak: '9 tahun',
      usia: '17', temaUltah: 'Garden Party', tglLahir: '2026-01-12', temaAqiqah: 'Tema Islami Modern',
      harapanPria: '', harapanWanita: '', ucapanCustom: '', liveAkad: '', liveResepsi: '', jamAkad: '', jamResepsi: ''
    };
    return base;
  }
  function customTheme(t) {
    return {
      id: 'custom-' + safeSlug(t), nama: t.nama || 'Tema Draf', ev: t.ev,
      g: t.g.slice(0, 3), accent: t.accent, ink: t.ink, deco: t.deco, pat: t.pat,
      ft: t.ft, char: t.char, baseTpl: t.baseTpl, custom: true, studioOnly: true
    };
  }
  function previewRow(t) {
    var ev = t.ev === 'all' ? $('pvEvent').value : t.ev;
    var base = tplById(t.baseTpl) || TPL[0] || {};
    return {
      slug: 'pratinjau-tema',
      theme: Math.max(0, indexOfTpl(t.baseTpl)),
      name1: ev === 'pernikahan' ? 'Rafi Pratama' : 'Alya Putri', name2: ev === 'pernikahan' ? 'Alya Putri' : '',
      venue: 'Gedung Serbaguna', event_date: '2027-08-21', event_time: '10:00',
      data: {
        form: sampleForm(ev), event: ev, tpl: 'custom-' + safeSlug(t), tplCustom: [customTheme(t)],
        doa: ev, accent: t.accent, fontTitle: t.ft, fontBody: t.fontBody, border: t.border,
        orn: t.orn, pat: t.pat, ornSudut: 'bunga4d', darkMode: false, goldOrn: true,
        coverLayout: t.cover, coverStyle: 'kotak', coverSize: 'sedang', buka: t.buka,
        coverStyleExplicit: true, coverLayoutExplicit: true, bukaExplicit: true,
        cover: '', coverPos: { x: 50, y: 50, z: 1 }, fotoPria: '', fotoWanita: '', gallery: [],
        amplop: { bank: '', noRek: '', pemilik: '', ewallet: '', noEwallet: '', showAmplop: false, showCopy: true },
        slides: {}, anim: { cover: true, text: true, reveal: true, effect: 'zoom', scroll: 'fade-up', scrollMix: true, navMode: 'scroll', buka: 'gilir' },
        music: { name: '', url: '' }, guestsRaw: '', guestCodes: {}, masterKey: '', linkMode: 'personal', waTemplate: '',
        _baseLayout: base.layout || null
      }
    };
  }
  function previewBaseRow(t) {
    var row = previewRow(t);
    var base = tplById(t.baseTpl) || TPL[0] || {};
    row.data.tpl = base.id;
    row.data.tplCustom = [];
    row.data.event = t.ev === 'all' ? row.data.event : row.data.event;
    row.data.accent = base.accent; row.data.fontTitle = base.ft; row.data.fontBody = 'inter';
    row.data.border = base.border; row.data.orn = base.orn; row.data.pat = base.pat;
    row.data.coverLayout = base.cover; row.data.buka = base.buka;
    return row;
  }
  function syncPreview(cover) {
    if (!active) return;
    var ifr = $('pvFrame');
    ASP.bindPreview(ifr, function () { return previewRow(active); });
    if (cover) ASP.backToCover(ifr);
    $('pvLabel').textContent = (active.nama || 'Draf') + ' · ' + (EV[active.ev] || {}).label;
  }

  /* ---------- daftar ---------- */
  function rows() {
    var out = TPL.map(function (t) {
      return { kind: 'tpl', id: t.id, nama: t.nama, ev: t.ev, t: t, badge: t.badge || '' };
    });
    db.drafts.forEach(function (d) {
      out.push({ kind: 'draft', id: d.id, nama: d.nama, ev: d.ev, t: d, badge: 'DRAF' });
    });
    return out;
  }
  function renderFilter() {
    var evs = [['semua', 'Semua'], ['pernikahan', 'Pernikahan'], ['khitanan', 'Khitanan'], ['ultah', 'Ultah'], ['aqiqah', 'Aqiqah'], ['all', 'Umum']];
    $('filterTema').innerHTML = evs.map(function (e) {
      return '<button type="button" data-filter="' + e[0] + '" class="' + (filter === e[0] ? 'on' : '') + '" aria-pressed="' + (filter === e[0]) + '">' + e[1] + '</button>';
    }).join('');
  }
  function renderList() {
    var list = rows().filter(function (r) {
      if (filter !== 'semua' && r.ev !== filter) return false;
      if (!q) return true;
      return (r.nama + ' ' + r.id).toLowerCase().indexOf(q) >= 0;
    });
    var html = list.map(function (r) {
      var on = active && (r.kind === 'draft' ? active.id === r.id : (active.baseTpl === r.id && !db.drafts.some(function (d) { return d.id === active.id; })));
      var t = r.t;
      var g = (t.g || ['#eee', '#ddd', '#ccc']);
      var thumbStyle = 'background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ' 55%,' + g[2] + ');color:' + (t.ink || '#333');
      var flag = r.kind === 'draft' ? '<span class="asp-tpl-flag draft">DRAF</span>' : (r.badge ? '<span class="asp-tpl-flag">' + esc(r.badge) + '</span>' : '');
      return '<button type="button" class="asp-tpl ' + (on ? 'on' : '') + '" data-open="' + (r.kind === 'draft' ? 'draft:' : 'tpl:') + esc(r.id) + '">' +
        '<span class="asp-tpl-thumb" style="' + thumbStyle + '">' + esc((t.char || '').slice(0, 8) || '✦') + '</span>' +
        '<span class="asp-tpl-main"><span class="asp-tpl-name">' + esc(r.nama) + flag + '</span>' +
        '<span class="asp-tpl-sub">' + (EV[r.ev] ? EV[r.ev].icon + ' ' + EV[r.ev].label : r.ev) + ' · ' + esc(r.id) + '</span></span></button>';
    }).join('');
    $('daftarTema').innerHTML = html || '<div class="asp-empty"><strong>Tidak ada tema</strong>Ubah kata kunci atau saringan.</div>';
    $('infoJumlah').textContent = list.length + ' dari ' + rows().length + ' tema · ' + db.drafts.length + ' draf';
  }

  /* ---------- editor ---------- */
  function chips(list, key, current, iconIndex) {
    return '<div class="asp-chips">' + list.map(function (o) {
      var val = o[0], label = o[1], ic = iconIndex != null ? o[iconIndex] : '';
      return '<button type="button" class="asp-chip ' + (String(current) === String(val) ? 'on' : '') + '" data-set="' + key + '" data-val="' + esc(val) + '">' +
        (ic ? '<span class="ic" aria-hidden="true">' + esc(ic) + '</span>' : '') + '<span>' + esc(label) + '</span></button>';
    }).join('') + '</div>';
  }
  function selectOpts(list, current) {
    return list.map(function (o) {
      return '<option value="' + esc(o[0]) + '" ' + (String(current) === String(o[0]) ? 'selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  function baseOptions() {
    return ['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'].map(function (ev) {
      var items = TPL.filter(function (t) { return t.ev === ev; });
      if (!items.length) return '';
      return '<optgroup label="' + EV[ev].label + '">' + items.map(function (t) {
        return '<option value="' + esc(t.id) + '" ' + (active && active.baseTpl === t.id ? 'selected' : '') + '>' + esc(t.nama) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function renderEditor() {
    var box = $('editor');
    if (!active) {
      box.innerHTML = '<div class="asp-empty" style="padding:60px 24px"><strong>Belum ada tema yang dibuka</strong>' +
        'Pilih satu template di kiri untuk dijadikan <b>salinan draf</b>, tekan <b>+ Baru</b>, atau tekan <b>✨ AI</b> untuk membuat tema dari deskripsi.<br>' +
        'Template asli tidak akan berubah — semua perubahan di sini hanya tersimpan sebagai draf.</div>';
      return;
    }
    var t = active;
    var base = tplById(t.baseTpl) || {};
    var lay = base.layout ? (LAYOUT_NAMA[base.layout] || base.layout) : 'Kerangka bebas (kb)';
    var shell = base.kerangka && base.kerangka.shell ? base.kerangka.shell : '—';
    var susunan = base.kerangka && base.kerangka.susunan ? base.kerangka.susunan : '—';
    var evSel = ['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'].map(function (k) {
      return '<option value="' + k + '" ' + (t.ev === k ? 'selected' : '') + '>' + EV[k].label + '</option>';
    }).join('');

    box.innerHTML =
      '<div class="asp-panel-head"><div><h2>' + esc(t.nama || 'Tema tanpa nama') + '</h2>' +
        '<p>Draf lokal · basis <b>' + esc(base.nama || '—') + '</b></p></div>' +
        '<div class="asp-actions" style="margin-left:auto">' +
          '<button class="asp-btn asp-btn-sm" data-act="duplikat">⧉ Duplikat</button>' +
          '<button class="asp-btn asp-btn-sm" data-act="reset">↺ Ulang dari basis</button>' +
          '<button class="asp-btn asp-btn-sm" data-act="hapus" style="color:var(--err)">🗑 Hapus draf</button>' +
        '</div></div>' +
      '<div class="asp-panel-body">' +

      /* 1. identitas */
      '<div class="asp-card"><h3><span class="num">1</span> Identitas tema</h3>' +
        '<div class="asp-grid asp-grid-2">' +
          '<label class="asp-field">Nama tema<input data-k="nama" maxlength="60" value="' + esc(t.nama) + '"></label>' +
          '<label class="asp-field">Slug / id tema<input data-k="slug" maxlength="48" value="' + esc(t.slug) + '"><small>Dipakai sebagai id di kerangka. Huruf kecil, angka, tanda hubung.</small></label>' +
          '<label class="asp-field">Kategori acara<select data-k="ev">' + evSel + '</select></label>' +
          '<label class="asp-field">Harga (Rp)<input data-k="harga" type="number" min="0" step="1000" value="' + Number(t.harga || 0) + '"></label>' +
          '<label class="asp-field">Badge<input data-k="badge" maxlength="24" value="' + esc(t.badge) + '" placeholder="BARU / PREMIUM / LARIS"></label>' +
          '<label class="asp-field">Huruf besar di thumbnail<input data-k="char" maxlength="10" value="' + esc(t.char) + '" placeholder="SAGE"></label>' +
        '</div>' +
        '<label class="asp-field">Deskripsi singkat (dipakai katalog & SEO)<textarea data-k="deskripsi" maxlength="180">' + esc(t.deskripsi) + '</textarea></label>' +
        (!/^[a-z0-9][a-z0-9-]{2,}$/.test(String(t.slug || ''))
          ? '<div class="asp-warn">Slug belum sah. Pakai huruf kecil, angka, dan tanda hubung (minimal 3 karakter). Pratinjau memakai slug cadangan <code>tema-baru</code>.</div>'
          : TPL.some(function (x) { return x.id === t.slug; })
            ? '<div class="asp-warn">Slug <b>' + esc(t.slug) + '</b> sudah dipakai template yang ada. Ganti slug sebelum mengekspor ke <code>kerangka/</code>, kalau tidak tema baru akan menimpa yang lama.</div>'
            : '') +
      '</div>' +

      /* 2. basis */
      '<div class="asp-card"><h3><span class="num">2</span> Basis tampilan</h3>' +
        '<label class="asp-field">Salin kerangka dari<select data-k="baseTpl">' + baseOptions() + '</select>' +
          '<small>Kerangka (susunan bagian) mengikuti template ini. Untuk susunan baru, ekspor ke <code>kerangka/</code>.</small></label>' +
        '<div class="asp-grid asp-grid-3">' +
          '<div class="asp-stat"><b style="font-size:13px">' + esc(lay) + '</b><small>Layout</small></div>' +
          '<div class="asp-stat"><b style="font-size:13px">' + esc(shell) + '</b><small>Shell kerangka</small></div>' +
          '<div class="asp-stat"><b style="font-size:13px">' + esc(susunan) + '</b><small>Susunan</small></div>' +
        '</div>' +
      '</div>' +

      /* 3. palet */
      '<div class="asp-card"><h3><span class="num">3</span> Palet & warna</h3>' +
        '<div class="asp-grid asp-grid-3">' +
          [0, 1, 2].map(function (i) {
            return '<label class="asp-field">Warna latar ' + (i + 1) +
              '<span class="asp-color-row"><input type="color" data-k="g' + i + '" value="' + esc(t.g[i] || '#ffffff') + '"><input data-k="g' + i + 'hex" maxlength="7" value="' + esc(t.g[i] || '') + '"></span></label>';
          }).join('') +
        '</div>' +
        '<div class="asp-grid asp-grid-2">' +
          '<label class="asp-field">Warna aksen<span class="asp-color-row"><input type="color" data-k="accent" value="' + esc(t.accent) + '"><input data-k="accentHex" maxlength="7" value="' + esc(t.accent) + '"></span></label>' +
          '<label class="asp-field">Warna teks<span class="asp-color-row"><input type="color" data-k="ink" value="' + esc(t.ink) + '"><input data-k="inkHex" maxlength="7" value="' + esc(t.ink) + '"></span></label>' +
        '</div>' +
        '<div><div class="asp-field" style="margin-bottom:8px">Palet siap pakai</div>' + chips(PALET.map(function (p) { return [p[0], p[0]]; }), 'palet', '') + '</div>' +
      '</div>' +

      /* 4. tipografi & motif */
      '<div class="asp-card"><h3><span class="num">4</span> Tipografi & motif</h3>' +
        '<div class="asp-grid asp-grid-2">' +
          '<label class="asp-field">Font judul<select data-k="ft">' + selectOpts(FONTS, t.ft) + '</select></label>' +
          '<label class="asp-field">Font isi<select data-k="fontBody">' + selectOpts(FONTS, t.fontBody) + '</select></label>' +
        '</div>' +
        '<label class="asp-field">Dekorasi pembatas<input data-k="deco" maxlength="24" value="' + esc(t.deco) + '"></label>' +
        '<div class="asp-actions" style="margin-top:-6px">' + DECO.map(function (d) {
          return '<button class="asp-btn asp-btn-sm" data-set="deco" data-val="' + esc(d) + '">' + esc(d) + '</button>';
        }).join('') + '</div>' +
        '<div><div class="asp-field" style="margin-bottom:8px">Pola latar</div>' + chips(POLA, 'pat', t.pat) + '</div>' +
        '<div><div class="asp-field" style="margin-bottom:8px">Border undangan</div>' + chips(BORDERS, 'border', t.border) + '</div>' +
        '<div><div class="asp-field" style="margin-bottom:8px">Ornamen pembatas</div>' + chips(ORN, 'orn', t.orn) + '</div>' +
      '</div>' +

      /* 5. cover */
      '<div class="asp-card"><h3><span class="num">5</span> Cover & cara buka</h3>' +
        '<div><div class="asp-field" style="margin-bottom:8px">Model cover</div>' + chips(COVERS, 'cover', t.cover, 2) + '</div>' +
        '<div><div class="asp-field" style="margin-bottom:8px">Cara buka cover</div>' + chips(CARA, 'buka', t.buka, 2) + '</div>' +
      '</div>' +

      /* 6. ekspor */
      '<div class="asp-card" id="kartuEkspor"><h3><span class="num">6</span> Ekspor & langkah rilis</h3>' +
        '<p class="hint">Tema ini belum masuk situs. Supaya jadi template resmi, salin kode di bawah ke <code>kerangka/</code>, lalu jalankan generator. Urutannya ada di dalam tiap tab.</p>' +
        '<div class="asp-actions" role="tablist" aria-label="Jenis ekspor">' +
          '<button class="asp-btn asp-btn-sm" data-export="token" role="tab">Token kerangka</button>' +
          '<button class="asp-btn asp-btn-sm" data-export="template" role="tab">Entri template.js</button>' +
          '<button class="asp-btn asp-btn-sm" data-export="tpl" role="tab">Entri TPL</button>' +
          '<button class="asp-btn asp-btn-sm" data-export="json" role="tab">JSON tema</button>' +
        '</div>' +
        '<div id="eksporHasil" class="asp-empty" style="padding:18px">Pilih salah satu jenis ekspor di atas.</div>' +
        '<hr class="asp-hr">' +
        '<div class="asp-actions">' +
          '<button class="asp-btn asp-btn-gold" data-act="katalog">🏷️ Kirim ke Setting Katalog</button>' +
          '<button class="asp-btn" data-act="salindraf">💾 Simpan draf sekarang</button>' +
        '</div>' +
        '<div class="asp-note"><b>Alur rilis tema baru:</b> 1) tempel token ke <code>kerangka/token-tema.js</code>; 2) tempel entri ke <code>kerangka/template.js</code>; 3) <code>node tools/bangun-tpl.cjs</code>; 4) <code>node tools/bangun-halaman-publik.cjs</code>; 5) <code>python3 tools/bangun-sitemap.py</code>; 6) <code>python3 tools/cek-kesehatan.py</code>.</div>' +
      '</div>' +

      '</div>';
  }

  /* ---------- AI tema (lokal, tanpa jaringan) ---------- */
  var AI = window.TEMA_AI;
  var AI_PROXY = window.TEMA_AI_PROXY;
  var AI_KEY = 'asproject_studio_ai_v1';
  var aiState = {
    prompt: '', ev: 'pernikahan', jumlah: 3, berani: 1, seed: 0,
    hasil: [], kunci: { palet: false, font: false }, terakhir: null, pesan: ''
  };

  function aiRiwayat() {
    var s = ASP.load(AI_KEY, { riwayat: [] });
    if (!Array.isArray(s.riwayat)) s.riwayat = [];
    return s;
  }
  function aiCatatRiwayat(prompt, ev) {
    var s = aiRiwayat();
    s.riwayat = s.riwayat.filter(function (r) { return !(r.prompt === prompt && r.ev === ev); });
    s.riwayat.unshift({ prompt: prompt.slice(0, 220), ev: ev, waktu: new Date().toISOString() });
    s.riwayat = s.riwayat.slice(0, 5);
    ASP.save(AI_KEY, s);
  }

  function aiSwatch(k) {
    return '<span class="asp-ai-swatch" aria-hidden="true">' +
      k.g.map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join('') +
      '<i style="background:' + esc(k.accent) + '"></i></span>';
  }

  function aiKartu(k, i) {
    var skor = AI.kontras(k.ink, k.g[0]);
    var skorAksen = AI.kontras(k.accent, k.g[0]);
    var aman = skor >= 4.5 && skorAksen >= 4.5;
    return '<article class="asp-ai-kartu" data-kandidat="' + i + '">' +
      aiSwatch(k) +
      '<div class="asp-ai-main">' +
        '<div class="asp-ai-judul"><strong>' + esc(k.nama) + '</strong>' +
          '<span class="asp-ai-badge ' + (aman ? 'ok' : 'warn') + '" title="Rasio kontras WCAG teks terhadap latar">' +
            (aman ? '✓' : '!') + ' ' + skor.toFixed(1) + ':1</span>' +
          (k.arch ? '<span class="asp-ai-badge">arch</span>' : '') +
        '</div>' +
        '<p class="asp-small asp-muted">' + esc(AI.namaFont(k.ft)) + ' · ' + esc(AI.namaPola(k.pat) || 'tanpa pola') +
          ' · ' + esc(AI.namaBorder(k.border)) + ' · ' + esc(AI.namaCover(k.cover)) + '/' + esc(AI.namaBuka(k.buka)) + '</p>' +
        '<p class="asp-small">' + esc(k.desc) + '</p>' +
      '</div>' +
      '<div class="asp-ai-aksi">' +
        '<button class="asp-btn asp-btn-gold asp-btn-sm" data-ai-pakai="' + i + '">Pakai jadi draf</button>' +
        '<button class="asp-btn asp-btn-sm" data-ai-salin="' + i + '">Salin JSON</button>' +
      '</div>' +
    '</article>';
  }

  function renderAIHasil() {
    var box = $('aiHasil');
    if (!box) return;
    if (!aiState.hasil.length) {
      box.innerHTML = '<div class="asp-empty" style="padding:18px"><strong>Belum ada kandidat</strong>' +
        'Tulis deskripsi lalu tekan <b>Buat kandidat</b>. Semua hasil hanya draf — 44 template produksi tidak tersentuh.</div>';
      return;
    }
    box.innerHTML = aiState.hasil.map(aiKartu).join('');
  }

  function renderAIRiwayat() {
    var box = $('aiRiwayat');
    if (!box) return;
    var r = aiRiwayat().riwayat;
    box.innerHTML = r.length
      ? '<div class="asp-field" style="margin-bottom:6px">Terakhir dipakai</div>' + r.map(function (x) {
          return '<button class="asp-ai-riwayat" data-ai-ulang="' + esc(x.prompt) + '">' +
            '<span>' + esc(x.prompt) + '</span><small>' + esc((EV[x.ev] || {}).label || x.ev) + '</small></button>';
        }).join('')
      : '';
  }

  function renderAIModal() {
    var wrap = $('aiWrap');
    if (!wrap) return;
    wrap.hidden = false;
    var proxyAktif = !!(AI_PROXY && AI_PROXY.aktif && AI_PROXY.aktif());
    wrap.innerHTML =
      '<div class="asp-gate asp-ai-gate" data-closeai>' +
      '<section role="dialog" aria-modal="true" aria-labelledby="aiJudul" class="asp-ai-dialog">' +
        '<div class="asp-ai-head">' +
          '<div><h2 id="aiJudul">✨ Buat tema dengan AI</h2>' +
          '<p class="asp-small asp-muted">Deskripsikan suasana; mesin menyusun palet, font, pola, border, cover, dan cara buka dari daftar yang sah.</p></div>' +
          '<span class="asp-pill">' + (proxyAktif ? 'LLM + validasi' : 'Lokal · tanpa internet') + '</span>' +
          '<button class="asp-btn asp-btn-sm" data-act="tutupai" style="margin-left:auto">✕ Tutup</button>' +
        '</div>' +
        '<div class="asp-ai-body">' +
          '<label class="asp-field">Deskripsi tema' +
            '<textarea id="aiPrompt" rows="3" maxlength="400" placeholder="contoh: pernikahan adat Sunda, hijau zaitun, elegan, motif kawung">' + esc(aiState.prompt) + '</textarea>' +
            '<small>Boleh bahasa Indonesia atau Inggris. Sebut warna, suasana, budaya, atau jenis acara.</small>' +
          '</label>' +
          '<div class="asp-grid asp-grid-3">' +
            '<label class="asp-field">Acara<select id="aiEvent">' +
              ['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'].map(function (k) {
                return '<option value="' + k + '" ' + (aiState.ev === k ? 'selected' : '') + '>' + EV[k].label + '</option>';
              }).join('') + '</select></label>' +
            '<label class="asp-field">Jumlah kandidat<select id="aiJumlah">' +
              [1, 3, 5].map(function (n) { return '<option value="' + n + '" ' + (aiState.jumlah === n ? 'selected' : '') + '>' + n + '</option>'; }).join('') +
            '</select></label>' +
            '<label class="asp-field">Keberanian<select id="aiBerani">' +
              [[1, 'Aman — tetap dekat arketipe'], [2, 'Berani — variasi warna'], [3, 'Eksperimen — silang gaya']].map(function (o) {
                return '<option value="' + o[0] + '" ' + (aiState.berani === o[0] ? 'selected' : '') + '>' + o[1] + '</option>';
              }).join('') + '</select></label>' +
          '</div>' +
          '<div class="asp-ai-kunci">' +
            '<label><input type="checkbox" id="aiKunciPalet" ' + (aiState.kunci.palet ? 'checked' : '') + '> Kunci palet kandidat terakhir</label>' +
            '<label><input type="checkbox" id="aiKunciFont" ' + (aiState.kunci.font ? 'checked' : '') + '> Kunci font judul</label>' +
            (aiState.terakhir ? '<span class="asp-small asp-muted">Acuan: ' + esc(aiState.terakhir.nama) + '</span>' : '') +
          '</div>' +
          '<div class="asp-actions">' +
            '<button class="asp-btn asp-btn-gold" data-act="aibuat">Buat kandidat</button>' +
            '<button class="asp-btn" data-act="aiacak">🎲 Acak lagi</button>' +
            (proxyAktif ? '<button class="asp-btn" data-act="aiproxy">Pakai LLM</button>' : '') +
          '</div>' +
          '<div id="aiPesan" class="asp-small" role="status" aria-live="polite">' + (aiState.pesan ? esc(aiState.pesan) : '') + '</div>' +
          '<div id="aiHasil" class="asp-ai-hasil"></div>' +
          '<details class="asp-ai-tempel">' +
            '<summary>Tempel JSON dari LLM (ChatGPT/Gemini/mana pun)</summary>' +
            '<p class="asp-small asp-muted">Minta LLM menghasilkan JSON dengan field: nama, ev, g (3 warna hex), accent, ink, ft, orn, pat, border, deco, desc, cover, buka. Hanya id terdaftar yang diterima.</p>' +
            '<textarea id="aiJson" rows="6" placeholder=\'{ "nama": "…", "ev": "pernikahan", "g": ["#F6F1E7","#E7D8C0","#CDB79D"], "accent": "#7A5C3E", "ink": "#463829", "ft": "lora", "orn": "zaitun", "pat": "kawung", "border": "frame2", "deco": "❀ ✦ ❀", "desc": "…", "cover": "kartu", "buka": "pita" }\'></textarea>' +
            '<div class="asp-actions"><button class="asp-btn" data-act="aipakaijson">Validasi JSON</button></div>' +
          '</details>' +
          '<div id="aiRiwayat"></div>' +
        '</div>' +
      '</section></div>';
    renderAIHasil();
    renderAIRiwayat();
  }

  function buatKandidat(sumber) {
    var prompt = ($('aiPrompt') || {}).value || aiState.prompt;
    var ev = ($('aiEvent') || {}).value || aiState.ev;
    var jumlah = Number(($('aiJumlah') || {}).value || aiState.jumlah);
    var berani = Number(($('aiBerani') || {}).value || aiState.berani);
    var kunci = {};
    if ($('aiKunciPalet') && $('aiKunciPalet').checked && aiState.terakhir) {
      kunci.g = aiState.terakhir.g; kunci.accent = aiState.terakhir.accent; kunci.ink = aiState.terakhir.ink;
    }
    if ($('aiKunciFont') && $('aiKunciFont').checked && aiState.terakhir) kunci.ft = aiState.terakhir.ft;
    aiState.prompt = prompt; aiState.ev = ev; aiState.jumlah = jumlah; aiState.berani = berani;
    aiState.kunci.palet = !!($('aiKunciPalet') && $('aiKunciPalet').checked);
    aiState.kunci.font = !!($('aiKunciFont') && $('aiKunciFont').checked);
    var hasil = AI.buat(prompt, { ev: ev, jumlah: jumlah, keberanian: berani, seed: aiState.seed, kunci: kunci });
    if (!hasil.length) {
      aiState.pesan = 'Mesin tidak menemukan kombinasi yang lolos validasi. Coba ubah deskripsi.';
      return;
    }
    aiState.hasil = hasil;
    aiState.terakhir = hasil[0];
    aiState.pesan = hasil.length + ' kandidat siap. Semua id sah dan kontras ≥ 4.5:1.';
    if (prompt.trim()) aiCatatRiwayat(prompt.trim(), ev);
    if (sumber !== 'modal') {
      renderAIHasil();
      var p = $('aiPesan'); if (p) p.textContent = aiState.pesan;
      renderAIRiwayat();
    }
  }

  /* AI hanya membuat DRAF: tidak menyentuh 44 template, tidak publish. */
  function pakaiKandidat(i) {
    var k = aiState.hasil[i];
    if (!k) return;
    var seed = TPL.filter(function (t) { return t.ev === k.ev; })[0] || TPL[0];
    if (!seed) return;
    var d = draftFrom(seed);
    d.origin = null;
    d.nama = k.nama;
    d.slug = slugify(k.nama) || 'tema-ai';
    d.ev = k.ev;
    d.g = k.g.slice();
    d.accent = k.accent;
    d.ink = k.ink;
    d.ft = k.ft;
    d.char = k.char || '';
    d.pat = k.pat || '';
    d.border = k.border;
    d.orn = k.orn || '';
    d.deco = k.deco;
    d.deskripsi = k.desc;
    d.cover = k.cover;
    d.buka = k.buka;
    d.ai = {
      prompt: aiState.prompt, mood: (AI.analisa(aiState.prompt, k.ev) || {}).mood,
      dibuat: new Date().toISOString(), versi: AI.versi
    };
    d.savedAt = null;
    db.drafts.push(d);
    db.activeId = d.id;
    active = JSON.parse(JSON.stringify(d));
    persist();
    tutupAI();
    renderEditor(); renderList(); renderStatus(); syncPreview(true);
    ASP.toast('Tema <b>' + esc(k.nama) + '</b> dibuat sebagai draf. Template asli tetap utuh.');
  }

  function tutupAI() {
    var wrap = $('aiWrap');
    if (!wrap) return;
    wrap.hidden = true;
    wrap.innerHTML = '';
  }

  function prosesJSON() {
    var ta = $('aiJson');
    if (!ta) return;
    var r = AI.dariJSON(ta.value);
    if (!r.ok) {
      aiState.pesan = 'JSON ditolak — ' + (r.galat[0] || 'tidak ada kandidat sah');
      var p = $('aiPesan'); if (p) p.textContent = aiState.pesan;
      return;
    }
    aiState.hasil = r.kandidat;
    aiState.terakhir = r.kandidat[0];
    aiState.pesan = r.kandidat.length + ' kandidat dari JSON lolos validasi' +
      (r.galat.length ? ' · ' + r.galat.length + ' ditolak' : '') + '.';
    renderAIHasil();
    var el = $('aiPesan'); if (el) el.textContent = aiState.pesan;
  }

  function mintaProxy() {
    if (!AI_PROXY || !AI_PROXY.aktif()) return;
    var p = $('aiPesan');
    if (p) p.textContent = 'Menghubungi AI…';
    AI_PROXY.minta(aiState.prompt, { ev: aiState.ev, jumlah: aiState.jumlah, keberanian: aiState.berani })
      .then(function (kandidat) {
        aiState.hasil = kandidat;
        aiState.terakhir = kandidat[0];
        aiState.pesan = kandidat.length + ' kandidat dari LLM lolos validasi lokal.';
        renderAIHasil();
        var el = $('aiPesan'); if (el) el.textContent = aiState.pesan;
      })
      .catch(function (e) {
        var el = $('aiPesan'); if (el) el.textContent = 'LLM gagal: ' + e.message + ' — pakai generator lokal saja.';
      });
  }

  /* ---------- status ---------- */
  function renderStatus() {
    var s = $('statusDraf');
    if (!active) { s.textContent = 'Belum ada tema aktif. Pilih template di kiri.'; }
    else {
      s.innerHTML = 'Tema <b>' + esc(active.nama) + '</b> · basis <b>' + esc(active.baseTpl) + '</b>' +
        (active.savedAt ? '<br><span class="asp-small asp-muted">Draf tersimpan ' + new Date(active.savedAt).toLocaleString('id-ID') + '</span>'
          : '<br><span class="asp-small asp-muted">Belum tersimpan.</span>');
    }
    $('statTema').textContent = String(TPL.length);
    $('statDraf').textContent = String(db.drafts.length);
    $('pvEvent').disabled = false;
  }

  /* ---------- buka draf ---------- */
  function openTpl(id) {
    var t = tplById(id);
    if (!t) return;
    /* Kalau sudah ada draf dari tema ini, buka draf itu supaya pekerjaan
       sebelumnya tidak tertimpa. */
    var existing = db.drafts.find(function (d) { return d.origin === id; });
    if (existing) { openDraft(existing.id); ASP.toast('Membuka draf yang sudah ada untuk tema ini.'); return; }
    active = draftFrom(t);
    persist(); renderEditor(); renderList(); renderStatus(); syncPreview(true);
    ASP.toast('Salinan draf dibuat dari <b>' + esc(t.nama) + '</b>. Template asli tidak berubah.');
  }
  function openDraft(id) {
    var d = db.drafts.find(function (x) { return x.id === id; });
    if (!d) return;
    active = JSON.parse(JSON.stringify(d));
    db.activeId = id;
    renderEditor(); renderList(); renderStatus(); syncPreview(true);
  }
  function newDraft() {
    var seed = active && tplById(active.baseTpl) ? tplById(active.baseTpl) : TPL[0];
    if (!seed) return;
    var d = draftFrom(seed);
    d.nama = (seed.nama || 'Tema') + ' — Varian';
    d.slug = slugify(d.nama) || 'tema-baru';
    active = d;
    persist(); renderEditor(); renderList(); renderStatus(); syncPreview(true);
  }

  /* ---------- ekspor ---------- */
  function exportText(kind) {
    var t = active;
    if (!t) return '';
    var token = {
      nama: t.nama, ev: t.ev, g: t.g, accent: t.accent, ink: t.ink,
      ft: t.ft, orn: t.orn, pat: t.pat, border: t.border, deco: t.deco, desc: t.deskripsi
    };
    if (t.char) token.char = t.char;
    var karTemplate = {
      id: safeSlug(t), nama: t.nama, ev: t.ev, harga: Number(t.harga) || 49000,
      badge: t.badge || '', token: safeSlug(t),
      shell: (tplById(t.baseTpl) || {}).kerangka && (tplById(t.baseTpl) || {}).kerangka.shell || 'klasik',
      susunan: (tplById(t.baseTpl) || {}).kerangka && (tplById(t.baseTpl) || {}).kerangka.susunan || 'A',
      ekstra: [], blok: {}, desc: t.deskripsi, cover: t.cover, buka: t.buka
    };
    if (kind === 'token') {
      return "/* kerangka/token-tema.js — tempel di dalam objek TOKEN */\n '" + safeSlug(t) + "':" + JSON.stringify(token).replace(/,"/g, ', "').replace(/^\{/, '{ ') + ',\n';
    }
    if (kind === 'template') {
      return "/* kerangka/template.js — tempel di AKHIR array TEMPLATES */\n " + JSON.stringify(karTemplate).replace(/,"/g, ', "') + ',\n';
    }
    if (kind === 'tpl') {
      var entry = {
        id: safeSlug(t), nama: t.nama, ev: t.ev, harga: Number(t.harga) || 49000,
        g: t.g, accent: t.accent, ink: t.ink
      };
      if (t.badge) entry.badge = t.badge;
      entry.deco = t.deco; entry.pat = t.pat; entry.ft = t.ft;
      if (t.char) entry.char = t.char;
      if (t.deskripsi) entry.desc = t.deskripsi;
      entry.layout = (tplById(t.baseTpl) || {}).layout || null;
      entry.orn = t.orn; entry.border = t.border; entry.cover = t.cover; entry.buka = t.buka;
      return "/* Referensi tampilan baris const TPL — JANGAN diedit manual;\n   file itu dibangkitkan tools/bangun-tpl.cjs dari kerangka/. */\n " + JSON.stringify(entry).replace(/,"/g, ', "') + '\n';
    }
    return JSON.stringify({
      theme: customTheme(t),
      token: token,
      template: karTemplate,
      catatan: 'Ekspor Studio Template AsProject. Tema belum aktif di situs sampai kerangka/ diperbarui dan generator dijalankan.'
    }, null, 2);
  }
  function showExport(kind) {
    var text = exportText(kind);
    var box = $('eksporHasil');
    box.className = 'asp-panel-body';
    box.innerHTML = '<pre class="asp-code" id="kodeEkspor">' + esc(text) + '</pre>' +
      '<div class="asp-code-actions"><button class="asp-btn asp-btn-dark asp-btn-sm" data-act="salin">📋 Salin kode</button>' +
      '<button class="asp-btn asp-btn-sm" data-act="unduh">⬇ Unduh .txt</button>' +
      '<span>Jangan tempel ke berkas hasil generator selain kerangka/.</span></div>';
    box.dataset.kind = kind;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function sendToKatalog() {
    if (!active) return;
    var store = ASP.load(KATALOG_KEY, {});
    if (!Array.isArray(store.pending)) store.pending = [];
    var entry = {
      id: active.slug, nama: active.nama, ev: active.ev, harga: active.harga,
      badge: active.badge, desc: active.deskripsi, baseTpl: active.baseTpl,
      sentAt: new Date().toISOString()
    };
    store.pending = store.pending.filter(function (p) { return p.id !== entry.id; }).concat([entry]);
    ASP.save(KATALOG_KEY, store);
    ASP.toast('Draf tema dikirim ke Setting Katalog sebagai <b>menunggu rilis</b>.', '');
  }

  /* ---------- bandingkan ---------- */
  function openCompare() {
    if (!active) return;
    compareOn = true;
    var wrap = $('compareWrap');
    wrap.hidden = false;
    wrap.innerHTML = '<div class="asp-gate" style="background:rgba(20,18,14,.55);z-index:9000" data-closecmp>' +
      '<section role="dialog" aria-modal="true" aria-label="Bandingkan tema" style="width:min(720px,96vw);max-height:92dvh;overflow:auto;background:var(--card);border-radius:20px;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.35)">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div><h2 style="font-size:15px">Bandingkan: asal vs draf</h2><p class="asp-small asp-muted">Data contoh yang sama di dua tema.</p></div>' +
        '<button class="asp-btn asp-btn-sm" style="margin-left:auto" data-act="tutupcmp">✕ Tutup</button></div>' +
        '<div class="asp-compare">' +
          '<div><div class="asp-small" style="font-weight:700;margin-bottom:6px">A · ' + esc((tplById(active.baseTpl) || {}).nama || 'asal') + '</div><div class="asp-phone"><iframe id="cmpA" src="undangan.html?preview=1" title="Tema asal" referrerpolicy="no-referrer"></iframe></div></div>' +
          '<div><div class="asp-small" style="font-weight:700;margin-bottom:6px">B · ' + esc(active.nama) + ' (draf)</div><div class="asp-phone"><iframe id="cmpB" src="undangan.html?preview=1" title="Tema draf" referrerpolicy="no-referrer"></iframe></div></div>' +
        '</div></section></div>';
    ASP.bindPreview($('cmpA'), function () { return previewBaseRow(active); });
    ASP.bindPreview($('cmpB'), function () { return previewRow(active); });
    $('btnBandingkan').setAttribute('aria-pressed', 'true');
  }
  function closeCompare() {
    compareOn = false;
    $('compareWrap').hidden = true;
    $('compareWrap').innerHTML = '';
    $('btnBandingkan').setAttribute('aria-pressed', 'false');
  }

  /* ---------- event ---------- */
  function bind() {
    $('cariTema').addEventListener('input', function () {
      q = this.value.trim().toLowerCase();
      renderList();
    });
    $('filterTema').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      filter = b.dataset.filter;
      renderFilter(); renderList();
    });
    $('daftarTema').addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (!b) return;
      var v = b.dataset.open;
      if (v.indexOf('draft:') === 0) openDraft(v.slice(6));
      else openTpl(v.slice(4));
    });
    $('btnBaru').addEventListener('click', newDraft);
    $('btnAI').addEventListener('click', function () { if (!AI) { ASP.toast('Mesin AI belum dimuat.', 'warn'); return; } renderAIModal(); });

    $('editor').addEventListener('input', function (e) {
      var el = e.target.closest('[data-k]');
      if (!el || !active) return;
      var k = el.dataset.k, v = el.value;
      if (k === 'g0') { active.g[0] = hex(v, active.g[0]); }
      else if (k === 'g1') { active.g[1] = hex(v, active.g[1]); }
      else if (k === 'g2') { active.g[2] = hex(v, active.g[2]); }
      else if (k === 'g0hex') { active.g[0] = hex(v, active.g[0]); }
      else if (k === 'g1hex') { active.g[1] = hex(v, active.g[1]); }
      else if (k === 'g2hex') { active.g[2] = hex(v, active.g[2]); }
      else if (k === 'accentHex') { active.accent = hex(v, active.accent); }
      else if (k === 'inkHex') { active.ink = hex(v, active.ink); }
      else if (k === 'harga') { active.harga = Number(v) || 0; }
      else if (k === 'slug') { active.slug = slugify(v); }
      else if (k === 'baseTpl') {
        active.baseTpl = v;
        var b = tplById(v);
        if (b) {
          /* Kerangka baru = palet/cover asal ikut menyesuaikan supaya tidak
             ada kombinasi aneh (mis. susunan arsip dengan cover neon). */
          active.cover = b.cover; active.buka = b.buka;
        }
        renderEditor(); persist(); syncPreview(true); return;
      }
      else { active[k] = v; }
      persist(); renderStatus(); syncPreview(false);
      var lab = $('pvLabel');
      if (lab) lab.textContent = (active.nama || 'Draf') + ' · ' + (EV[active.ev] || {}).label;
    });

    $('editor').addEventListener('click', function (e) {
      var set = e.target.closest('[data-set]');
      if (set && active) {
        var k = set.dataset.set, v = set.dataset.val;
        if (k === 'palet') {
          var p = PALET.find(function (x) { return x[0] === v; });
          if (p) { active.g = p[1].slice(); active.accent = p[2]; active.ink = p[3]; }
        } else { active[k] = v; }
        renderEditor(); persist(); syncPreview(false);
        ASP.backToCover($('pvFrame'));
        return;
      }
      var exp = e.target.closest('[data-export]');
      if (exp) { showExport(exp.dataset.export); return; }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.dataset.act;
      if (a === 'duplikat') {
        if (!active) return;
        var copy = JSON.parse(JSON.stringify(active));
        copy.id = 'custom-' + slugify(copy.nama || 'tema') + '-' + Math.random().toString(36).slice(2, 6);
        copy.slug = slugify((copy.nama || 'tema') + '-salinan');
        copy.nama = (copy.nama || 'Tema') + ' — Salinan';
        copy.savedAt = null;
        active = copy;
        persist(); renderEditor(); renderList(); renderStatus(); syncPreview(true);
        ASP.toast('Salinan draf dibuat.');
      } else if (a === 'reset') {
        if (!active) return;
        var asal = tplById(active.baseTpl);
        if (!asal) return;
        var fresh = draftFrom(asal, active.id);
        fresh.origin = active.origin;
        active = fresh;
        persist(); renderEditor(); renderList(); renderStatus(); syncPreview(true);
        ASP.toast('Draf dikembalikan ke tampilan asal <b>' + esc(asal.nama) + '</b>.');
      } else if (a === 'hapus') {
        if (!active) return;
        if (!confirm('Hapus draf “' + active.nama + '”? Template aslinya tidak terhapus.')) return;
        db.drafts = db.drafts.filter(function (d) { return d.id !== active.id; });
        if (db.activeId === active.id) db.activeId = null;
        ASP.save(KEY, db);
        active = null;
        renderEditor(); renderList(); renderStatus();
        ASP.toast('Draf dihapus.');
      } else if (a === 'salin') {
        var pre = $('kodeEkspor');
        if (!pre) return;
        var text = pre.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { ASP.toast('Kode disalin.'); },
            function () { ASP.toast('Browser menolak clipboard — pilih teksnya lalu salin manual.', 'warn'); });
        } else { ASP.toast('Browser ini belum mendukung salin otomatis.', 'warn'); }
      } else if (a === 'unduh') {
        var kind = ($('eksporHasil') || {}).dataset ? $('eksporHasil').dataset.kind : 'json';
        var blob = new Blob([exportText(kind)], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = (active ? active.slug : 'tema') + '-' + (kind || 'ekspor') + '.txt';
        link.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
      } else if (a === 'katalog') {
        sendToKatalog();
      } else if (a === 'salindraf') {
        persist();
        ASP.toast('Draf disimpan di perangkat ini.');
      }
    });

    $('pvEvent').addEventListener('change', function () { syncPreview(true); });
    $('btnCover').addEventListener('click', function () { ASP.backToCover($('pvFrame')); });
    $('btnBandingkan').addEventListener('click', function () {
      if (compareOn) closeCompare(); else openCompare();
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-closecmp]') && !e.target.closest('section')) closeCompare();
      if (e.target.closest('[data-act="tutupcmp"]')) closeCompare();
      if (e.target.closest('[data-closeai]') && !e.target.closest('section')) { tutupAI(); return; }
      var aiAct = e.target.closest('[data-act]');
      if (aiAct && aiAct.dataset.act && aiAct.dataset.act.indexOf('ai') === 0) {
        var a = aiAct.dataset.act;
        if (a === 'tutupai') tutupAI();
        else if (a === 'aibuat') buatKandidat();
        else if (a === 'aiacak') { aiState.seed = (aiState.seed + 1) % 99991; buatKandidat(); }
        else if (a === 'aipakaijson') prosesJSON();
        else if (a === 'aiproxy') mintaProxy();
        return;
      }
      var pakai = e.target.closest('[data-ai-pakai]');
      if (pakai) { pakaiKandidat(Number(pakai.dataset.aiPakai)); return; }
      var salin = e.target.closest('[data-ai-salin]');
      if (salin) {
        var k = aiState.hasil[Number(salin.dataset.aiSalin)];
        if (!k) return;
        var teks = JSON.stringify(k, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(teks).then(function () { ASP.toast('JSON kandidat disalin.'); },
            function () { ASP.toast('Clipboard ditolak browser — salin manual dari kotak JSON.', 'warn'); });
        } else { ASP.toast('Clipboard tidak tersedia di browser ini.', 'warn'); }
        return;
      }
      var ulang = e.target.closest('[data-ai-ulang]');
      if (ulang) {
        aiState.prompt = ulang.dataset.aiUlang || '';
        aiState.seed = (aiState.seed + 1) % 99991;
        buatKandidat('modal');
        renderAIModal();
        return;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && compareOn) closeCompare();
      if (e.key === 'Escape' && $('aiWrap') && !$('aiWrap').hidden) tutupAI();
    });
    window.addEventListener('resize', function () {
      ASP.scalePreview($('pvFrame'));
      if (compareOn) { ASP.scalePreview($('cmpA')); ASP.scalePreview($('cmpB')); }
    });
  }

  /* ---------- start ---------- */
  ASP.gate();
  renderFilter();
  renderList();
  renderEditor();
  renderStatus();
  bind();

  /* Buka draf terakhir supaya pekerjaan tidak hilang saat halaman ditutup. */
  if (db.activeId) {
    var last = db.drafts.find(function (d) { return d.id === db.activeId; });
    if (last) { active = JSON.parse(JSON.stringify(last)); renderEditor(); renderList(); renderStatus(); syncPreview(true); }
  }
  window.addEventListener('load', function () { if (active) syncPreview(true); });
})();
