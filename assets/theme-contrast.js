/* Penyesuaian kontras tema — dipakai undangan.html dan file HTML mandiri hasil
   "Simpan undangan" di Studio. Dipakai juga oleh tools/test-kontras-tema.cjs.

   Masalah yang diselesaikan: sebagian palet tema memakai warna "ink" yang terang
   karena covernya gelap (contoh: Balap Mobil #F0F0F0, Naga Api #FBE9E4, Ninja Cilik
   #ECEFF3). Kartu konten di halaman tamu selalu berlatar terang, jadi teks ink di
   sana nyaris tidak terlihat. Fungsi di sini menyetel kecerahan warna sampai
   kontrasnya cukup, dengan rona (hue) tema dipertahankan dan cover tidak diubah.

   Aturan yang dipakai:
     • teks konten (ink) minimal 4.5:1 terhadap latar kartu terang;
     • label/ornamen aksen minimal 3:1 (tingkat teks besar — aksen tetap berperan
       sebagai hiasan, jadi hanya yang benar-benar pudar yang diubah);
       bila ink tema terlalu terang, teks memakai nada paling gelap dari gradasi
       tema itu sendiri agar tetap sewarna (bukan abu-abu generik);
     • warna teks di atas tombol berisi ink minimal 3:1 terhadap isi tombolnya;
     • ornamen aksen di cover minimal 3:1 terhadap gradasi cover (g0 & g1).

   Catatan: nilai di sini HARUS sama dengan yang diuji di tools/test-kontras-tema.cjs. */
(function () {
  var KARTU = '#fffdf9';   // latar kartu konten: .acara .cdw .amp-row .couple .c
  var GELAP = '#141210';   // arah penggelapan
  var PUTIH = '#ffffff';   // arah pencerahan
  var MIN_TEKS = 4.5;      // teks normal (WCAG AA)
  var MIN_AKSEN = 3;       // label & ornamen aksen (tingkat teks besar)
  var MIN_BESAR = 3;       // teks di atas tombol / ornamen cover

  function normal(warna) {
    var h = String(warna == null ? '' : warna).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return '#' + h.toLowerCase();
  }

  function kanal(warna) {
    var h = normal(warna);
    if (!h) return null;
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function srgb(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

  function lampu(warna) {
    var c = kanal(warna);
    if (!c) return 0;
    return 0.2126 * srgb(c[0]) + 0.7152 * srgb(c[1]) + 0.0722 * srgb(c[2]);
  }

  function kontras(a, b) {
    if (!kanal(a) || !kanal(b)) return 21;
    var la = lampu(a), lb = lampu(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function campur(a, b, t) {
    var ca = kanal(a), cb = kanal(b);
    if (!ca || !cb) return normal(a) || a;
    var keluar = [0, 1, 2].map(function (i) {
      var v = Math.round(ca[i] + (cb[i] - ca[i]) * t);
      v = Math.max(0, Math.min(255, v));
      return (v < 16 ? '0' : '') + v.toString(16);
    });
    return '#' + keluar.join('');
  }

  /* Geser warna ke arah gelap/terang (mana yang lebih cepat menaikkan kontras)
     sampai mencapai rasio minimal. Rona tema ikut terjaga karena hanya campuran
     dan pencahayaan yang berubah. */
  function perbaiki(warna, latar, minimal) {
    var w = normal(warna);
    if (!w || !kanal(latar)) return warna;
    minimal = minimal || MIN_TEKS;
    if (kontras(w, latar) >= minimal) return w;
    var arah = kontras(campur(w, GELAP, 0.2), latar) >= kontras(campur(w, PUTIH, 0.2), latar) ? GELAP : PUTIH;
    for (var t = 0.08; t < 0.99; t += 0.08) {
      var c = campur(w, arah, t);
      if (kontras(c, latar) >= minimal) return c;
    }
    return arah;
  }

  /* Pilih nada gelap milik tema sendiri (warna gradasi covernya) supaya teks konten
     tetap sewarna tema — mis. Balap Mobil memakai #26292E, Naga Api #3A1418.
     Dipakai hanya saat ink tema terlalu terang untuk latar kartu. */
  function nadaGelapTema(ink, g) {
    var kandidat = (Array.isArray(g) ? g : []).filter(function (w) { return normal(w); });
    kandidat.sort(function (a, b) { return lampu(a) - lampu(b); }); // paling gelap dulu
    for (var i = 0; i < kandidat.length; i++) {
      if (kontras(kandidat[i], KARTU) >= MIN_TEKS) return normal(kandidat[i]);
    }
    return perbaiki(ink, KARTU, MIN_TEKS);
  }

  /* Nilai untuk area konten (selalu berlatar terang). */
  function untukKonten(ink, accent, g) {
    var inkKonten = kontras(ink, KARTU) >= MIN_TEKS
      ? normal(ink)
      : nadaGelapTema(ink, g);
    return {
      latar: KARTU,
      ink: inkKonten,
      accent: perbaiki(accent, KARTU, MIN_AKSEN),
      teksDiInk: kontras(inkKonten, PUTIH) >= MIN_TEKS ? PUTIH : GELAP,
      // teks di atas tombol yang memakai ink tema (mis. tombol "Buka Undangan")
      teksDiInkTema: kontras(normal(ink) || ink, PUTIH) >= MIN_BESAR ? PUTIH : GELAP
    };
  }

  /* Aksen di atas latar GELAP (foto cover penuh / artwork 3D): rona tema dicampur
     ke arah putih sampai kontrasnya cukup. Dipakai oleh gaya cover "foto penuh". */
  function untukLatarGelap(warna, latarGelap, minimal) {
    var w = normal(warna);
    if (!w || !kanal(latarGelap)) return warna;
    minimal = minimal || MIN_BESAR;
    if (kontras(w, latarGelap) >= minimal) return w;
    for (var t = 0.1; t < 1; t += 0.1) {
      var c = campur(w, PUTIH, t);
      if (kontras(c, latarGelap) >= minimal) return c;
    }
    return PUTIH;
  }

  /* Aksen di atas gradasi cover (ornamen ❖ / nama kecil pada #cover). */
  function untukCover(accent, g0, g1) {
    var a = perbaiki(accent, g0 || KARTU, MIN_BESAR);
    return perbaiki(a, g1 || KARTU, MIN_BESAR);
  }

  window.AsThemeContrast = {
    KARTU: KARTU, GELAP: GELAP, PUTIH: PUTIH,
    MIN_TEKS: MIN_TEKS, MIN_AKSEN: MIN_AKSEN, MIN_BESAR: MIN_BESAR,
    normal: normal, lampu: lampu, kontras: kontras, campur: campur,
    perbaiki: perbaiki, nadaGelapTema: nadaGelapTema,
    untukKonten: untukKonten, untukCover: untukCover, untukLatarGelap: untukLatarGelap
  };
})();
