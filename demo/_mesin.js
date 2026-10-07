/* ============================================================
   AsProject.My.Id — MESIN DEMO BERSAMA (_mesin.js)
   Menggerakkan halaman demo kategori (khitanan / ultah / aqiqah).
   Tiap halaman cukup menyediakan window.ASP_DEMO = {...} sebelum
   script ini dimuat. Tidak ada dependensi selain browser modern.

   Konfigurasi minimal:
     file, judulTab, jenis ('Khitanan'...), sampulLabel, namaBesar(html),
     heroNama(html), salam, orang:[{inisial,nama,ket}], tema:{id:{...}},
     temaDefault, ucapanContoh:[...], demoLain:[{href,label}]
   Opsional: ayat:{teks,sumber}, cerita:[...], acara:[...], mapsUrl,
     dresscode:{warna:[],teks}, galeri:[...], akun:[...], hadiah,
     seksi:{hitung,cerita,peta,galeri,amplop,varian,musik}, paket,
     premiumHref, penutup, ttd
   ============================================================ */
(function () {
  "use strict";
  var C = window.ASP_DEMO || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var WA = "6285196755675";
  var VARMAP = {
    bg: "--bg", bg2: "--bg2", bg3: "--bg3", soft: "--soft", line: "--line", mid: "--mid",
    acc: "--acc", deep: "--deep", onAcc: "--on-acc", ink: "--ink", ink2: "--ink2", mut: "--mut",
    card: "--card", cardSolid: "--card-solid", serif: "--serif", sans: "--sans"
  };
  var TAG = { hadir: ["Hadir", "tag-hadir"], ragu: ["Masih Ragu", "tag-ragu"], tidak: ["Berhalangan", "tag-tidak"] };
  var KUNCI_UCAPAN = "asproject_demo_" + (C.file || "demo") + "_ucapan_v1";
  var KUNCI_TEMA = "asproject_demo_" + (C.file || "demo") + "_tema";
  var SEKSI = C.seksi || {};
  function on(k, bawaan) { return SEKSI[k] !== undefined ? !!SEKSI[k] : (bawaan !== false); }

  /* ---------------- util ---------------- */
  function lolos(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var toastEl, toastTimer;
  function toast(pesan) {
    if (!toastEl) toastEl = $("#toast");
    toastEl.textContent = pesan;
    toastEl.classList.add("tampil");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("tampil"); }, 2600);
  }
  function temaAktif() { return document.documentElement.getAttribute("data-tema") || C.temaDefault; }
  function waLink(namaTema) {
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(
      "Halo AsProject.My.Id! Aku lihat demo undangan " + (C.jenis || "") + " tema *" + namaTema +
      "* — aku mau tanya-tanya dulu dong, Kak ✨");
  }
  function segarkanWa() {
    var t = C.tema[temaAktif()];
    var url = waLink(t ? t.nama : C.jenis);
    ["#waBar", "#waTengah", "#waFoot", "#waBantuan", "#waCopy", "#waTerbang"].forEach(function (s) {
      var el = $(s); if (el) el.setAttribute("href", url);
    });
    $$(".wa-tema").forEach(function (a) {
      var kartu = a.closest(".varian-kartu");
      var tt = kartu && C.tema[kartu.getAttribute("data-tema")];
      a.setAttribute("href", waLink(tt ? tt.nama : (t ? t.nama : C.jenis)));
    });
  }

  /* ---------------- tanggal & hitung mundur ---------------- */
  var hariH = new Date();
  hariH.setDate(hariH.getDate() + 47);
  hariH.setHours(8, 0, 0, 0);
  var fmtLengkap = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  var fmtPendek = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
  var tanggalPanjang = fmtLengkap.format(hariH);
  function dua(n) { return n < 10 ? "0" + n : "" + n; }
  function detik() {
    var sisa = Math.max(0, hariH.getTime() - Date.now());
    var el;
    el = $("#cd"); if (el) el.textContent = dua(Math.floor(sisa / 864e5));
    el = $("#cj"); if (el) el.textContent = dua(Math.floor(sisa / 36e5) % 24);
    el = $("#cm"); if (el) el.textContent = dua(Math.floor(sisa / 6e4) % 60);
    el = $("#cs"); if (el) el.textContent = dua(Math.floor(sisa / 1e3) % 60);
  }

  /* ---------------- render ---------------- */
  function htmlSampul() {
    return '<section id="sampul" aria-label="Sampul undangan"><div class="sampul-isi"><div class="bingkai">' +
      '<div class="keping" id="kepingSampul">✦ ✦ </div>' +
      '<p class="sampul-kepada">Kepada Yth. Bapak/Ibu/Saudara/i</p>' +
      '<h1 id="namaTamu">Tamu Undangan</h1><div class="garis"></div>' +
      '<p class="sampul-jenis">' + lolos(C.sampulLabel || C.jenis || "Undangan") + "</p>" +
      '<p class="sampul-nama">' + (C.namaBesar || "") + "</p>" +
      '<p class="sampul-tgl" id="sampulTanggal">—</p>' +
      '<button class="btn btn-utama" id="btnBuka" style="width:100%">Buka Undangan</button>' +
      '<div class="ganti-nama"><p>Coba custom nama tamu</p><div class="baris-nama">' +
      '<input id="inpNama" type="text" maxlength="40" placeholder="Tulis namamu, Kak" aria-label="Nama tamu">' +
      '<button class="btn btn-es btn-kecil" id="btnNama" type="button">Pakai</button></div></div>' +
      "</div></div></section>";
  }
  function htmlBar() {
    return '<header id="bar"><div class="bar-isi">' +
      '<a class="merk" href="../index.html">AsProject<b>.My.Id</b></a>' +
      '<span class="chip-demo">Demo ' + lolos(C.paket === "basic" ? "Basic" : "Premium") + ' · <span id="chipTema">—</span></span>' +
      '<div class="bar-kanan">' +
      (on("musik") ? '<button class="btn-bulat" id="btnMusik" type="button" title="Putar / hentikan musik" aria-label="Musik">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></button>' : "") +
      '<a class="btn btn-es btn-kecil btn-teks" href="../index.html#katalog">Katalog</a>' +
      '<a class="btn btn-wa btn-kecil" id="waBar" href="#" target="_blank" rel="noopener">Pesan Tema Ini</a>' +
      "</div></div></header>";
  }
  function htmlHero() {
    return '<section class="hero wadah" id="hero">' +
      '<span class="eyebrow rv" id="eyebrowHero">✦ ' + lolos(C.judulEyebrow || ("Undangan " + (C.jenis || ""))) + "</span>" +
      '<h2 class="hero-nama rv">' + (C.heroNama || C.namaBesar || "") + "</h2>" +
      '<p class="hero-tgl rv" id="heroTanggal">—</p>' +
      (on("hitung") ? '<div class="hitung rv" aria-label="Hitung mundur"><div><b id="cd">00</b><small>Hari</small></div>' +
        '<div><b id="cj">00</b><small>Jam</small></div><div><b id="cm">00</b><small>Menit</small></div>' +
        '<div><b id="cs">00</b><small>Detik</small></div></div>' : "") +
      '<p class="sub rv" style="margin-top:24px">' + lolos(C.salam || "") + "</p>" +
      '<div class="rv" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<a class="btn btn-es" href="#acara">Jadwal Acara</a><a class="btn btn-es" href="#rsvp">Kirim Ucapan</a></div></section>';
  }
  function htmlOrang() {
    var daftar = C.orang || [];
    if (!daftar.length) return "";
    var kartu = daftar.map(function (o) {
      return '<article class="kartu orang rv"><div class="foto">' + lolos(o.inisial || o.nama.charAt(0)) + "</div>" +
        "<h3>" + lolos(o.nama) + "</h3><p>" + lolos(o.ket).replace(/\n/g, "<br>") + "</p></article>";
    }).join("");
    var ayat = C.ayat ? '<div class="kartu ayat rv">“' + lolos(C.ayat.teks) + '”<small>' + lolos(C.ayat.sumber) + "</small></div>" : "";
    return '<section class="sek wadah" id="profil"><div class="tengah rv"><span class="eyebrow">' +
      lolos(C.profilLabel || "Profil") + '</span></div><h2 class="judul rv">' + lolos(C.profilJudul || "Yang Berbahagia") +
      '</h2><p class="sub rv">' + lolos(C.profilSub || "") + '</p><div class="grid-2' + (daftar.length === 1 ? " satu" : "") +
      '">' + kartu + "</div>" + ayat + "</section>";
  }
  function htmlCerita() {
    if (!on("cerita") || !(C.cerita || []).length) return "";
    var isi = C.cerita.map(function (c, i) {
      return "<article" + (i === C.cerita.length - 1 ? ' style="padding-bottom:0"' : "") + "><time>" + lolos(c.waktu) +
        "</time><h4>" + lolos(c.judul) + "</h4><p>" + lolos(c.teks) + "</p></article>";
    }).join("");
    return '<section class="sek wadah" id="cerita"><div class="tengah rv"><span class="eyebrow">Linimasa</span></div>' +
      '<h2 class="judul rv">' + lolos(C.ceritaJudul || "Perjalanan Kami") + '</h2><p class="sub rv">' +
      lolos(C.ceritaSub || "") + '</p><div class="kartu rv" style="max-width:620px;margin:0 auto"><div class="cerita">' +
      isi + "</div></div></section>";
  }
  function htmlAcara() {
    var daftar = C.acara || [];
    if (!daftar.length) return "";
    var kartu = daftar.map(function (a) {
      return '<article class="kartu acak-kartu rv"><span class="pill">✦ ' + lolos(a.label) + "</span>" +
        '<h3 style="margin-top:12px">' + lolos(a.judul) + '</h3><p class="jam" data-waktu="' + lolos(a.waktu) + '"></p>' +
        '<p class="tempat">' + lolos(a.tempat) + '</p><p class="alamat">' + lolos(a.alamat) + "</p>" +
        '<div class="aksi"><button class="btn btn-es btn-kecil salin" type="button" data-teks="' +
        lolos(a.tempat + ", " + a.alamat) + '">Salin Alamat</button>' +
        (C.mapsUrl ? '<a class="btn btn-es btn-kecil" target="_blank" rel="noopener" href="' + C.mapsUrl + '">Lihat Peta</a>' : "") +
        "</div></article>";
    }).join("");
    return '<section class="sek wadah" id="acara"><div class="tengah rv"><span class="eyebrow">Rangkaian Acara</span></div>' +
      '<h2 class="judul rv">Waktu &amp; Tempat</h2><p class="sub rv">Merupakan kehormatan bagi kami apabila ' +
      'Bapak/Ibu/Saudara/i berkenan hadir.</p><div class="grid-2">' + kartu + "</div>" +
      (on("peta") && C.mapsUrl ? '<div class="peta rv"><iframe title="Peta lokasi acara" loading="lazy" ' +
        'referrerpolicy="no-referrer-when-downgrade" src="' + C.mapsUrl + '"></iframe></div>' : "") +
      (C.dresscode ? '<div class="dresscode rv"><span class="pill">Dress Code</span>' +
        C.dresscode.warna.map(function (w) { return '<span class="warna" style="background:' + w + '"></span>'; }).join("") +
        '<span style="font-size:13px;color:var(--mut)">' + lolos(C.dresscode.teks) + "</span></div>" : "") +
      "</section>";
  }
  function htmlGaleri() {
    if (!on("galeri") || !(C.galeri || []).length) return "";
    var isi = C.galeri.map(function (g) {
      return '<figure class="bingkai-g rv" data-judul="' + lolos(g.judul) + '">' +
        '<img src="' + g.src + '" alt="' + lolos(g.alt) + '" loading="lazy" decoding="async" ' +
        'onerror="this.style.display=\'none\'"><span class="keping-besar">' + (g.glyph || "✦") + "</span>" +
        '<figcaption class="isi"><div><strong>' + lolos(g.judul) + "</strong><small>" + lolos(g.sub) +
        "</small></div></figcaption></figure>";
    }).join("");
    return '<section class="sek wadah" id="galeri"><div class="tengah rv"><span class="eyebrow">Galeri</span></div>' +
      '<h2 class="judul rv">' + lolos(C.galeriJudul || "Galeri") + '</h2><p class="sub rv">' + lolos(C.galeriSub || "") +
      '</p><div class="galeri' + (C.galeri.length < 3 ? " satu-kolom" : "") + '">' + isi + "</div></section>";
  }
  function htmlAmplop() {
    if (!on("amplop") || !(C.akun || []).length) return "";
    var rek = C.akun.map(function (a) {
      return '<div class="rek"><span class="logo-bank" style="background:linear-gradient(135deg,var(--mid),var(--acc))">' +
        lolos(a.kode) + '</span><div><div class="nomor salin" data-teks="' + lolos(a.nomor) + '" style="cursor:pointer">' +
        lolos(a.nomor) + '</div><div class="atas">' + lolos(a.atas) +
        ' · ketuk untuk menyalin</div></div><button class="btn btn-es btn-kecil salin" type="button" data-teks="' +
        lolos(a.nomor) + '">Salin</button></div>';
    }).join("");
    return '<section class="sek wadah" id="amplop"><div class="tengah rv"><span class="eyebrow">Amplop Digital</span></div>' +
      '<h2 class="judul rv">Kirim <em>Hadiah</em></h2><p class="sub rv">' + lolos(C.amplopSub ||
        "Doa restu adalah hadiah utama. Bila ingin memberi tanda kasih, boleh melalui kanal berikut.") +
      '</p><div class="kartu rv" style="max-width:640px;margin:0 auto">' + rek +
      (C.hadiah ? '<div class="garis"></div><p style="font-size:13px;color:var(--mut)"><b style="color:var(--ink);font-weight:600">' +
        "Kirim hadiah fisik?</b><br>" + lolos(C.hadiah) + "</p>" : "") + "</div></section>";
  }
  function htmlRsvp() {
    return '<section class="sek wadah" id="rsvp"><div class="tengah rv"><span class="eyebrow">RSVP &amp; Ucapan</span></div>' +
      '<h2 class="judul rv">Kabar &amp; Doa <em>Untuk Kami</em></h2><p class="sub rv">' +
      lolos(C.rsvpSub || "Konfirmasi kehadiran dan tinggalkan pesan — tersimpan di perangkat ini selama demo.") +
      '</p><div class="grid-2" style="align-items:start"><form class="kartu rv" id="formUcapan" novalidate><div class="form-grid">' +
      '<div><label for="uNama">Nama</label><input class="inp" id="uNama" type="text" maxlength="40" placeholder="Tulis namamu, Kak" autocomplete="name"></div>' +
      '<div><label>Konfirmasi Kehadiran</label><div class="pilih">' +
      '<label><input type="radio" name="hadir" value="hadir" checked><span>✓ Hadir</span></label>' +
      '<label><input type="radio" name="hadir" value="ragu"><span>? Masih Ragu</span></label>' +
      '<label><input type="radio" name="hadir" value="tidak"><span>✕ Berhalangan</span></label></div></div>' +
      '<div><label for="uPesan">Ucapan &amp; Doa</label><textarea class="inp" id="uPesan" maxlength="240" placeholder="Tulis doa terbaikmu…"></textarea></div>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><button class="btn btn-utama" type="submit">Kirim Ucapan</button>' +
      '<span style="font-size:12px;color:var(--mut)" id="sisa">0/240</span></div>' +
      '<p class="salah" id="pesanSalah">Nama dan ucapannya diisi dulu ya, Kak 🙂</p></div></form>' +
      '<div class="rv"><div class="statistik" id="statistik"></div><div class="ucapan-list" id="daftarUcapan"></div></div></div></section>';
  }
  function htmlPaket() {
    if (C.paket === "basic") {
      return '<section class="sek wadah" id="paket"><div class="tengah rv"><span class="eyebrow">Paket Basic</span></div>' +
        '<h2 class="judul rv">Sederhana, <em>Tapi Lengkap yang Penting</em></h2>' +
        '<div class="kartu upsell rv"><p style="font-size:14px;color:var(--ink2)">Demo ini sengaja menampilkan pengalaman ' +
        "paket <b>Basic</b>: satu tema, tanpa galeri foto, hitung mundur, dan amplop digital — sesuai tabel harga di katalog. " +
        'RSVP, ucapan, peta, dan custom nama tamu tetap jalan.</p><p style="margin-top:10px"><a href="' +
        (C.premiumHref || "#") + '">Lihat demo paket Premium →</a></p></div></section>';
    }
    if (!on("varian")) return "";
    var ids = Object.keys(C.tema);
    var kartu = ids.map(function (id) {
      var t = C.tema[id];
      return '<article class="kartu varian-kartu rv" data-tema="' + id + '" data-nama="' + lolos(t.nama) +
        '" tabindex="0" role="button" aria-pressed="false">' +
        (t.badge ? '<span class="pita">' + lolos(t.badge) + "</span>" : "") +
        "<h3>" + lolos(t.nama) + '</h3><p class="desk">' + lolos(t.desk || "") + "</p>" +
        '<div class="swatch">' + (t.swatch || []).map(function (w) { return '<i style="background:' + w + '"></i>'; }).join("") + "</div>" +
        '<div class="harga"><b>Rp ' + Math.round(t.harga / 1000) + "rb</b>" +
        (t.coret ? "<s>Rp " + Math.round(t.coret / 1000) + "rb</s><em>-50%</em>" : "") + "</div>" +
        '<p class="catatan-harga">Sekali bayar • Garansi 7 hari • Revisi unlimited</p>' +
        (t.fitur || []).length ? '<ul class="fitur">' + t.fitur.map(function (f) { return "<li>" + lolos(f) + "</li>"; }).join("") + "</ul>" : "" +
        '<a class="btn btn-wa btn-kecil wa-tema" style="width:100%" href="#" target="_blank" rel="noopener">Pesan Tema Ini</a></article>';
    }).join("");
    return '<section class="sek wadah" id="paket"><div class="tengah rv"><span class="eyebrow">Pilih Tema</span></div>' +
      '<h2 class="judul rv">' + lolos(C.paketJudul || "Beberapa Wajah, Satu Paket") + '</h2><p class="sub rv">' +
      lolos(C.paketSub || "Ketuk kartu untuk mengganti seluruh tampilan halaman ini langsung.") +
      '</p><div class="varian' + (ids.length === 3 ? " tiga" : "") + '">' + kartu + "</div></section>";
  }
  function htmlPenutup() {
    return '<section class="penutup wadah" id="penutup"><div class="keping rv" id="kepingTutup">✦ ✦ </div>' +
      '<p class="sub rv" style="margin-bottom:0">' + lolos(C.penutup || "") + "</p>" +
      '<p class="rv" style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);margin-top:20px">' +
      lolos(C.penutupKecil || "Kami yang berbahagia,") + '</p><p class="ttd rv">' + (C.ttd || C.namaBesar || "") + "</p>" +
      '<div class="rv" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px">' +
      '<a class="btn btn-utama" id="waTengah" href="#" target="_blank" rel="noopener">Pesan Tema Ini</a>' +
      '<a class="btn btn-es" href="../index.html#katalog">Lihat Katalog Lain</a></div></section>';
  }
  function htmlFooter() {
    var lain = (C.demoLain || []).map(function (d) { return '<a href="' + d.href + '">' + lolos(d.label) + "</a>"; }).join("");
    return "<footer><div class=wadah><div class=\"foot-grid\"><div class=\"foot-merek\">" +
      '<a class="merk" href="../index.html" style="font-size:20px">AsProject<b>.My.Id</b></a>' +
      "<p>Platform undangan online premium. Bikin momen sakral jadi digital, elegan, dan mudah dibagikan " +
      'dalam 5 menit. Dibuat dengan cinta di Bandung.</p><div class="sosial">' +
      '<a class="btn-bulat" href="https://instagram.com/asproject.my.id" target="_blank" rel="noopener" aria-label="Instagram">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>' +
      '<a class="btn-bulat" href="mailto:hello@asproject.my.id" aria-label="Email">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></a>' +
      '<a class="btn-bulat" id="waFoot" href="#" target="_blank" rel="noopener" aria-label="WhatsApp">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.3 11.3 0 0 0 4.3 3.8c1.6.6 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z"/></svg></a>' +
      '</div></div><div><p class="foot-judul">Bantuan</p><div class="foot-nav">' +
      '<a href="../index.html#katalog">Harga &amp; Paket</a>' +
      '<a href="mailto:hello@asproject.my.id?subject=Pertanyaan%20Kebijakan%20Privasi">Kebijakan Privasi</a>' +
      '<a href="#" id="waBantuan" target="_blank" rel="noopener">WhatsApp Support</a>' +
      '<a href="../studio.html">Coba Studio (edit sendiri)</a></div></div>' +
      '<div><p class="foot-judul">Demo Lain</p><div class="foot-nav">' + lain + "</div></div></div>" +
      '<div class="copyright"><span>© 2026 AsProject.My.Id — Undangan Online ' + lolos(C.jenis || "") +
      '. All rights reserved.</span><span>Butuh bantuan? <a href="#" id="waCopy" target="_blank" rel="noopener" ' +
      'style="color:var(--acc);font-weight:500;text-decoration:underline">Chat WhatsApp Support Premium</a> ' +
      "&lt; 5 menit</span></div></div></footer>";
  }

  /* ---------------- tema ---------------- */
  function applyTema(id, diam) {
    var t = C.tema[id];
    if (!t) return;
    var root = document.documentElement;
    Object.keys(VARMAP).forEach(function (k) {
      if (t.vars[k]) root.style.setProperty(VARMAP[k], t.vars[k]);
    });
    root.setAttribute("data-tema", id);
    if (t.motif) document.body.setAttribute("data-motif", t.motif);
    else document.body.removeAttribute("data-motif");
    var chip = $("#chipTema"); if (chip) chip.textContent = t.nama;
    $$(".varian-kartu").forEach(function (k) {
      var on_ = k.getAttribute("data-tema") === id;
      k.classList.toggle("aktif", on_);
      k.setAttribute("aria-pressed", on_ ? "true" : "false");
    });
    try { localStorage.setItem(KUNCI_TEMA, id); } catch (e) { /* mode privat */ }
    /* Override teks per tema (opsional): tokoh sampul/hero/ttd & label. */
    var g = t.namaBesar || C.namaBesar;
    if (g) {
      var sn = $("#sampul .sampul-nama"); if (sn) sn.innerHTML = g;
      var hn = $("#hero .hero-nama"); if (hn) hn.innerHTML = g;
      var td = $("#penutup .ttd"); if (td) td.innerHTML = g;
    }
    if (t.sampulLabel) { var sl = $("#sampul .sampul-jenis"); if (sl) sl.textContent = t.sampulLabel; }
    if (t.profilNama) { var oh = $("#profil .orang h3"); if (oh) oh.textContent = t.profilNama; }
    if (t.profilKet) {
      var op = $("#profil .orang p");
      if (op) op.innerHTML = lolos(t.profilKet).replace(/\n/g, "<br>");
    }
    hiasan();
    segarkanWa();
    if (!diam) toast("Tema " + t.nama + " aktif ✦");
  }
  function hiasan() {
    var wadah = $("#hias");
    if (!wadah || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var t = C.tema[temaAktif()] || {};
    var glyph = t.glyph || "✦", html = "";
    for (var i = 0; i < 14; i++) {
      html += '<i style="left:' + (Math.random() * 100).toFixed(2) + "%;font-size:" + (10 + Math.random() * 12).toFixed(1) +
        "px;animation-duration:" + (14 + Math.random() * 16).toFixed(1) + "s;animation-delay:" +
        (-Math.random() * 26).toFixed(1) + "s;--geser:" + (Math.random() * 120 - 40).toFixed(0) + 'px">' + glyph + "</i>";
    }
    wadah.innerHTML = html;
    var keping = glyph + " " + glyph + " " + glyph;
    var a = $("#kepingSampul"); if (a) a.textContent = keping;
    var b = $("#kepingTutup"); if (b) b.textContent = keping;
    var c = $("#eyebrowHero"); if (c) c.textContent = glyph + " " + (C.judulEyebrow || ("Undangan " + (C.jenis || "")));
  }

  /* ---------------- ucapan ---------------- */
  function bacaUcapan() {
    try {
      var m = localStorage.getItem(KUNCI_UCAPAN);
      if (m) { var d = JSON.parse(m); if (Array.isArray(d)) return d; }
    } catch (e) { /* rusak */ }
    return C.ucapanContoh || [];
  }
  function simpanUcapan(d) { try { localStorage.setItem(KUNCI_UCAPAN, JSON.stringify(d.slice(0, 60))); } catch (e) { /* privat */ } }
  function waktuLalu(ts) {
    var m = Math.floor((Date.now() - ts) / 6e4);
    if (m < 1) return "baru saja";
    if (m < 60) return m + " menit lalu";
    var j = Math.floor(m / 60);
    if (j < 24) return j + " jam lalu";
    var h = Math.floor(j / 24);
    if (h < 30) return h + " hari lalu";
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(ts));
  }
  var ucapan = bacaUcapan();
  function gambarUcapan() {
    var kotak = $("#daftarUcapan");
    if (!kotak) return;
    kotak.innerHTML = ucapan.length ? ucapan.map(function (u) {
      var t = TAG[u.hadir] || TAG.ragu;
      return '<article class="kartu ucapan"><div class="ucapan-atas"><b>' + lolos(u.nama) +
        '</b><span class="tag ' + t[1] + '">' + t[0] + "</span><time>" + waktuLalu(u.waktu) +
        "</time></div><p>" + lolos(u.pesan) + "</p></article>";
    }).join("") : '<p class="sub" style="margin:0">Belum ada ucapan. Jadilah yang pertama, Kak ✨</p>';
    var hadir = ucapan.filter(function (u) { return u.hadir === "hadir"; }).length;
    var tidak = ucapan.filter(function (u) { return u.hadir === "tidak"; }).length;
    $("#statistik").innerHTML = '<span class="pill">💬 ' + ucapan.length + " ucapan</span>" +
      '<span class="pill">✓ ' + hadir + " hadir</span>" + '<span class="pill">✕ ' + tidak + " berhalangan</span>";
  }

  /* ---------------- lain-lain ---------------- */
  function salin(teks) {
    function lewatTextarea() {
      var ta = document.createElement("textarea");
      ta.value = teks; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? teks + " tersalin ✨" : "Gagal menyalin — salin manual ya, Kak");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(function () { toast(teks + " tersalin ✨"); }, lewatTextarea);
    } else lewatTextarea();
  }
  function pemantau() {
    var items = $$(".rv");
    if (!("IntersectionObserver" in window)) { items.forEach(function (el) { el.classList.add("masuk"); }); return; }
    var io = new IntersectionObserver(function (entri) {
      entri.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("masuk"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el, i) { el.style.transitionDelay = Math.min(i % 4, 3) * 70 + "ms"; io.observe(el); });
  }
  function isiTanggal() {
    var a = $("#sampulTanggal");
    if (a) a.textContent = tanggalPanjang + " • " + (C.venueSingkat || "");
    var b = $("#heroTanggal");
    if (b) b.textContent = fmtPendek.format(hariH) + " • " + (C.kota || "");
    $$(".jam[data-waktu]").forEach(function (el) {
      el.textContent = tanggalPanjang + " · " + el.getAttribute("data-waktu");
    });
  }
  function setNamaTamu(nama, simpan) {
    nama = (nama || "").trim().slice(0, 60);
    var el = $("#namaTamu"); if (el) el.textContent = nama || "Tamu Undangan";
    var inp = $("#inpNama"); if (inp && !inp.value) inp.value = nama;
    var u = $("#uNama"); if (u && !u.value) u.value = nama;
    if (simpan && nama && history.replaceState) {
      var q = new URLSearchParams(location.search);
      q.set("to", nama);
      history.replaceState(null, "", location.pathname + "?" + q.toString() + location.hash);
    }
  }

  /* ---------------- boot ---------------- */
  function siap() {
    $("#aspSampul").innerHTML = htmlSampul();
    $("#aspBar").outerHTML = htmlBar();
    $("#aspMain").innerHTML = htmlHero() + htmlOrang() + htmlCerita() + htmlAcara() + htmlGaleri() +
      htmlAmplop() + htmlRsvp() + htmlPaket() + htmlPenutup();
    $("#aspFooter").outerHTML = htmlFooter();

    isiTanggal();
    if (on("hitung")) { detik(); setInterval(detik, 1000); }

    var q = new URLSearchParams(location.search);
    var dariUrl = q.get("tema") || q.get("varian");
    var tersimpan = null;
    try { tersimpan = localStorage.getItem(KUNCI_TEMA); } catch (e) { /* privat */ }
    applyTema(dariUrl && C.tema[dariUrl] ? dariUrl : (tersimpan && C.tema[tersimpan] ? tersimpan : C.temaDefault), true);

    var namaUrl = (q.get("to") || q.get("nama") || "").trim().slice(0, 60);
    setNamaTamu(namaUrl, false);
    gambarUcapan();
    pemantau();

    $("#btnBuka").addEventListener("click", function () {
      $("#sampul").classList.add("buka");
      document.body.classList.remove("terkunci");
      var lagu = $("#lagu");
      if (lagu && on("musik")) {
        var janji = lagu.play();
        if (janji && janji.catch) janji.catch(function () { /* autoplay ditolak: diam saja */ });
        var bm = $("#btnMusik"); if (bm) bm.classList.add("putar");
      }
      setTimeout(function () {
        var tujuan = null;
        if (location.hash) { try { tujuan = document.querySelector(location.hash); } catch (e) { tujuan = null; } }
        (tujuan || $("#hero")).scrollIntoView({ behavior: "smooth", block: "start" });
      }, 260);
    });
    $("#btnNama").addEventListener("click", function () {
      var v = $("#inpNama").value.trim();
      if (!v) { toast("Tulis namamu dulu, Kak 🙂"); $("#inpNama").focus(); return; }
      setNamaTamu(v, true);
      toast("Sampul diperbarui untuk " + v + " ✨");
    });
    $("#inpNama").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#btnNama").click(); } });
    var bm2 = $("#btnMusik");
    if (bm2) bm2.addEventListener("click", function () {
      var lagu = $("#lagu");
      if (!lagu) return;
      if (lagu.paused) { lagu.play().catch(function () {}); bm2.classList.add("putar"); }
      else { lagu.pause(); bm2.classList.remove("putar"); }
    });
    var laguErr = $("#lagu");
    if (laguErr) laguErr.addEventListener("error", function () { var b = $("#btnMusik"); if (b) b.style.display = "none"; });

    $$(".varian-kartu").forEach(function (k) {
      k.addEventListener("click", function (e) { if (e.target.closest("a")) return; applyTema(k.getAttribute("data-tema")); });
      k.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); applyTema(k.getAttribute("data-tema")); }
      });
    });
    $$(".salin").forEach(function (el) {
      el.addEventListener("click", function () { salin(el.getAttribute("data-teks")); });
    });
    $$(".bingkai-g").forEach(function (b) {
      b.addEventListener("click", function () { toast("📷 " + b.getAttribute("data-judul")); });
    });

    var pesan = $("#uPesan");
    pesan.addEventListener("input", function () { $("#sisa").textContent = pesan.value.length + "/240"; });
    $("#formUcapan").addEventListener("submit", function (e) {
      e.preventDefault();
      var nama = $("#uNama").value.trim(), teks = pesan.value.trim();
      var hadir = $('input[name="hadir"]:checked');
      if (!nama || !teks) { $("#pesanSalah").classList.add("tampil"); (!nama ? $("#uNama") : pesan).focus(); return; }
      $("#pesanSalah").classList.remove("tampil");
      ucapan.unshift({ nama: nama, hadir: hadir ? hadir.value : "ragu", pesan: teks, waktu: Date.now() });
      simpanUcapan(ucapan);
      gambarUcapan();
      pesan.value = ""; $("#sisa").textContent = "0/240";
      toast("Ucapanmu terkirim, terima kasih " + nama + " 🤍");
    });

    segarkanWa();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap);
  else siap();
})();
