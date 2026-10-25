/* AsProject Liquid Glass — lapisan efek untuk tema Liquid Glass:
   Aurora (pernikahan), Khatam (khitanan), Neon (ultah), Mentari (aqiqah).

   Isinya: blob Aurora cair yang bergerak di balik panel kaca,
   tilt 3D mengikuti kursor/sentuh/gyro HP, kilau specular yang
   mengikuti cahaya, dan pemilih aksen dinamis (tamu bisa mengganti
   warna kaca; pilihan disimpan per tema di sessionStorage).

   Dipasang undangan.html lewat AsLiquidGlass.mount(idTema) SETELAH
   #cover lahir (sebelah mount VIP 4D). Guard: prefers-reduced-motion
   mematikan tilt/animasi (pemilih aksen tetap jalan); semua listener
   dilepas unmount() yang dipanggil bootBersihkan() tiap render ulang.
   Tanpa file ini tema tetap tampil sebagai shell kaca biasa. */
(function () {
  'use strict';
  if (window.AsLiquidGlass) return; /* sudah ter-embed (file mandiri) */

  var PRESETS = {
    Aurora:  { nama: 'Aurora',  accent: '#3E5EDD', c: ['#56CCF2', '#8B7CFF', '#F58AB5', '#FFD166'] },
    zamrud:  { nama: 'Zamrud',  accent: '#0F766E', c: ['#34D399', '#22D3EE', '#A3E635', '#BFDBFE'] },
    neon:    { nama: 'Neon',    accent: '#B4237A', c: ['#FF6B9D', '#FFB86B', '#A78BFA', '#67E8F9'] },
    mentari: { nama: 'Mentari', accent: '#2F7E73', c: ['#FDE68A', '#6EE7B7', '#93C5FD', '#FBCFE8'] },
    nebula:  { nama: 'Nebula',  accent: '#7C3AED', c: ['#A78BFA', '#F472B6', '#60A5FA', '#FDE68A'] },
    emas:    { nama: 'Emas',    accent: '#A16207', c: ['#F59E0B', '#FDE68A', '#FB923C', '#FBCFE8'] }
  };
  var BAWAAN = {
    'liquid-glass': 'Aurora',
    'liquid-glass-khitanan': 'zamrud',
    'liquid-glass-ultah': 'neon',
    'liquid-glass-aqiqah': 'mentari'
  };

  function reduced() {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  var state = null;

  function bikinAurora(kelasTambahan) {
    var lap = document.createElement('div');
    lap.className = 'lg-Aurora' + (kelasTambahan ? ' ' + kelasTambahan : '');
    lap.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) lap.appendChild(document.createElement('i'));
    return lap;
  }

  function simpan(kunci, nilai) {
    try { sessionStorage.setItem(kunci, nilai); } catch (e) { /* abaikan */ }
  }
  function ambil(kunci) {
    try { return sessionStorage.getItem(kunci); } catch (e) { return null; }
  }

  function pakaiPreset(kunciPreset, tulis) {
    if (!state) return;
    var p = PRESETS[kunciPreset] || PRESETS.Aurora;
    var rs = document.documentElement.style;
    rs.setProperty('--accent', p.accent);
    for (var i = 0; i < 4; i++) rs.setProperty('--lg-c' + (i + 1), p.c[i]);
    state.preset = kunciPreset;
    var btns = state.dock ? state.dock.querySelectorAll('.lg-swatch') : [];
    for (var b = 0; b < btns.length; b++) {
      btns[b].setAttribute('aria-pressed', btns[b].getAttribute('data-lg') === kunciPreset ? 'true' : 'false');
    }
    if (tulis) simpan('asp-lg-accent:' + state.idTema, kunciPreset);
  }

  function unmount() {
    if (!state) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    window.removeEventListener('pointermove', state.onPointer);
    window.removeEventListener('deviceorientation', state.onGyro);
    if (state.AuroraCover && state.AuroraCover.parentNode) state.AuroraCover.parentNode.removeChild(state.AuroraCover);
    if (state.AuroraPage && state.AuroraPage.parentNode) state.AuroraPage.parentNode.removeChild(state.AuroraPage);
    if (state.dock && state.dock.parentNode) state.dock.parentNode.removeChild(state.dock);
    state = null;
  }

  function mount(idTema) {
    unmount();
    var cover = document.getElementById('cover');
    if (!cover || !document.body) return null;

    var AuroraCover = bikinAurora('');
    cover.insertBefore(AuroraCover, cover.firstChild);
    var AuroraPage = bikinAurora('lg-Aurora-page');
    document.body.appendChild(AuroraPage);

    /* Dok aksen: rel kaca berisi titik warna. Dibangun via DOM (tanpa
       innerHTML dari data luar) dan baru muncul setelah undangan dibuka
       (CSS menyembunyikannya selama cover tertutup). */
    var dock = document.createElement('div');
    dock.className = 'lg-dock';
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Pilih warna aksen kaca');
    var label = document.createElement('span');
    label.className = 'lg-dock-label';
    label.textContent = 'Aksen';
    dock.appendChild(label);
    Object.keys(PRESETS).forEach(function (k) {
      var p = PRESETS[k];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lg-swatch';
      btn.setAttribute('data-lg', k);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Aksen ' + p.nama);
      btn.title = p.nama;
      btn.style.background =
        'linear-gradient(135deg,' + p.c[0] + ',' + p.c[1] + ' 55%,' + p.c[2] + ')';
      btn.addEventListener('click', function () { pakaiPreset(k, true); });
      dock.appendChild(btn);
    });
    document.body.appendChild(dock);

    var target = { rx: 0, ry: 0, mx: 50, my: 12 };
    var kini = { rx: 0, ry: 0, mx: 50, my: 12 };
    var gyroDasar = null;

    function onPointer(e) {
      var w = window.innerWidth || 1, h = window.innerHeight || 1;
      target.mx = clamp((e.clientX / w) * 100, 0, 100);
      target.my = clamp((e.clientY / h) * 100, 0, 100);
      target.ry = clamp(((e.clientX / w) - 0.5) * 14, -7, 7);
      target.rx = clamp(-((e.clientY / h) - 0.5) * 12, -6, 6);
    }
    function onGyro(e) {
      if (e.gamma == null && e.beta == null) return;
      if (gyroDasar === null && e.beta != null) gyroDasar = e.beta;
      if (e.gamma != null) target.ry = clamp(e.gamma / 6.5, -7, 7);
      if (e.beta != null && gyroDasar !== null) {
        target.rx = clamp(-(e.beta - gyroDasar) / 7, -6, 6);
      }
      target.mx = clamp(50 + target.ry * 5, 5, 95);
      target.my = clamp(50 - target.rx * 6, 5, 95);
    }

    state = {
      idTema: idTema || '', preset: '', raf: 0,
      AuroraCover: AuroraCover, AuroraPage: AuroraPage, dock: dock,
      onPointer: onPointer, onGyro: onGyro
    };

    var tersimpan = ambil('asp-lg-accent:' + state.idTema);
    pakaiPreset(
      (tersimpan && PRESETS[tersimpan]) ? tersimpan : (BAWAAN[state.idTema] || 'Aurora'),
      false
    );

    if (!reduced()) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('deviceorientation', onGyro);
      var rs = document.documentElement.style;
      var putar = function () {
        if (!state) return;
        kini.rx += (target.rx - kini.rx) * 0.08;
        kini.ry += (target.ry - kini.ry) * 0.08;
        kini.mx += (target.mx - kini.mx) * 0.10;
        kini.my += (target.my - kini.my) * 0.10;
        rs.setProperty('--lg-rx', kini.rx.toFixed(2) + 'deg');
        rs.setProperty('--lg-ry', kini.ry.toFixed(2) + 'deg');
        rs.setProperty('--lg-mx', kini.mx.toFixed(1) + '%');
        rs.setProperty('--lg-my', kini.my.toFixed(1) + '%');
        state.raf = requestAnimationFrame(putar);
      };
      state.raf = requestAnimationFrame(putar);
    }
    return state;
  }

  window.AsLiquidGlass = { mount: mount, unmount: unmount, presets: PRESETS, bawaan: BAWAAN };
})();
