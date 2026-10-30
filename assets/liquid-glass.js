/* AsProject Liquid Glass — lapisan efek untuk tema Liquid Glass:
   Aurora (pernikahan), Khatam (khitanan), Neon (ultah), Mentari (aqiqah).

   Isinya: blob Aurora cair yang bergerak di balik panel kaca,
   tilt 3D mengikuti kursor/sentuh/gyro HP, kilau specular yang
   mengikuti cahaya, galeri foto lingkaran 3D yang bisa diputar,
   dan pemilih aksen dinamis (tamu bisa mengganti warna kaca;
   pilihan disimpan per tema di sessionStorage).

   Dipasang undangan.html lewat AsLiquidGlass.mount(idTema) SETELAH
   #cover lahir (sebelah mount VIP 4D). Guard: prefers-reduced-motion
   mematikan tilt/animasi (pemilih aksen tetap jalan); semua listener
   dilepas unmount() yang dipanggil bootBersihkan() tiap render ulang.
   Tanpa file ini tema tetap tampil sebagai shell kaca biasa. */
(function () {
  'use strict';
  if (window.AsLiquidGlass) return; /* sudah ter-embed (file mandiri) */

  var PRESETS = {
    Aurora:  { nama: 'Aurora',  accent: '#3E5EDD', c: ['#38BDF8', '#818CF8', '#F472B6', '#FACC15'] },
    zamrud:  { nama: 'Zamrud',  accent: '#0F766E', c: ['#34D399', '#22D3EE', '#84CC16', '#60A5FA'] },
    neon:    { nama: 'Neon',    accent: '#B4237A', c: ['#FF6B9D', '#FFB86B', '#8B5CF6', '#67E8F9'] },
    mentari: { nama: 'Mentari', accent: '#2F7E73', c: ['#FBBF24', '#34D399', '#60A5FA', '#F472B6'] },
    nebula:  { nama: 'Nebula',  accent: '#7C3AED', c: ['#8B5CF6', '#F472B6', '#38BDF8', '#FACC15'] },
    emas:    { nama: 'Emas',    accent: '#A16207', c: ['#F59E0B', '#FACC15', '#FB923C', '#F9A8D4'] }
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

  /* Galeri lingkaran 3D: grid foto bawaan diubah menjadi cincin foto yang
     mengelilingi poros Y. Elemen tombol aslinya dipertahankan (tidak
     dikloning), jadi data-gal dan lightbox bawaan tetap bekerja. Foto di
     sisi yang diklik diputar ke depan dulu; klik foto yang sudah di depan
     baru membuka lightbox. */
  function pasangGaleri3d() {
    var grid = document.querySelector('.gal-grid');
    if (!grid || grid.getAttribute('data-lg-gal3d') === '1' || !grid.parentNode) return null;
    var cells = Array.prototype.slice.call(grid.querySelectorAll('.gal-cell[data-gal]'));
    if (cells.length < 3) return null;

    var n = cells.length;
    var step = 360 / n;
    var gerakKurangi = reduced();
    var card = grid.closest ? grid.closest('.card') : null;
    var hint = card ? card.querySelector('.gal-hint') : null;
    var hintAwal = hint ? hint.textContent : '';
    var labelAwal = cells.map(function (cell) { return cell.getAttribute('aria-label') || ''; });

    var wrap = document.createElement('div');
    wrap.className = 'lg-gal3d';
    wrap.setAttribute('data-lg-gal3d', '1');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-roledescription', 'carousel');
    wrap.setAttribute('aria-label', 'Galeri foto lingkaran 3D');
    wrap.style.setProperty('--lg-gal-step', step.toFixed(3) + 'deg');

    var scene = document.createElement('div');
    scene.className = 'lg-gal3d-scene';
    scene.tabIndex = 0;
    scene.setAttribute('aria-label', 'Area galeri 3D. Geser atau gunakan panah kiri dan kanan untuk memutar.');

    var floor = document.createElement('i');
    floor.className = 'lg-gal3d-floor';
    floor.setAttribute('aria-hidden', 'true');

    grid.parentNode.insertBefore(wrap, grid);
    scene.appendChild(floor);
    scene.appendChild(grid);
    wrap.appendChild(scene);
    grid.classList.add('lg-gal3d-ring');
    grid.setAttribute('data-lg-gal3d', '1');

    cells.forEach(function (cell, i) {
      cell.classList.add('lg-gal3d-cell');
      cell.classList.remove('besar');
      cell.style.setProperty('--lg-gal-i', String(i));
      cell.setAttribute('aria-roledescription', 'slide');
      cell.setAttribute('aria-label', 'Foto ' + (i + 1) + ' dari ' + n + '. Ketuk saat berada di depan untuk memperbesar.');
    });
    if (hint) hint.textContent = 'Geser untuk memutar · ketuk foto depan untuk memperbesar';

    function bikinTombol(className, label, teks) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = className;
      b.setAttribute('aria-label', label);
      b.textContent = teks;
      return b;
    }
    var controls = document.createElement('div');
    controls.className = 'lg-gal3d-controls';
    var btnPrev = bikinTombol('lg-gal3d-btn', 'Foto sebelumnya', '‹');
    var btnNext = bikinTombol('lg-gal3d-btn', 'Foto berikutnya', '›');
    var hitung = document.createElement('span');
    hitung.className = 'lg-gal3d-count';
    hitung.setAttribute('aria-live', 'polite');
    controls.appendChild(btnPrev);
    controls.appendChild(hitung);
    controls.appendChild(btnNext);
    wrap.appendChild(controls);

    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'lg-gal3d-dots';
    var dots = [];
    var dotHandlers = [];
    cells.forEach(function (_, i) {
      var dot = bikinTombol('lg-gal3d-dot', 'Putar ke foto ' + (i + 1), '');
      var handler = function () { ke(i); };
      dot.addEventListener('click', handler);
      dots.push(dot);
      dotHandlers.push(handler);
      dotsWrap.appendChild(dot);
    });
    wrap.appendChild(dotsWrap);

    var index = 0;
    var rotation = 0;
    var targetRotation = 0;
    var auto = !gerakKurangi;
    var terlihat = true;
    var tahan = false;
    var menyeret = false;
    var seretBergerak = false;
    var tekanKlik = false;
    var pointerId = null;
    var startX = 0;
    var startRotation = 0;
    var rafGal = 0;
    var rafUkuran = 0;
    var waktuAkhir = 0;
    var timerJeda = 0;
    var timerKlik = 0;
    var pengamatLihat = null;
    var rusak = false;

    function aturUkuran() {
      if (rusak) return;
      var lebarScene = scene.clientWidth || wrap.clientWidth || 320;
      var faktor = n <= 3 ? 0.5 : (n === 4 ? 0.47 : (n === 5 ? 0.43 : 0.4));
      var lebarFoto = Math.round(clamp(lebarScene * faktor, 104, 168));
      var radius = n === 3 ? lebarFoto * 0.66 : ((lebarFoto / 2) / Math.tan(Math.PI / n)) * 1.08;
      wrap.style.setProperty('--lg-gal-w', lebarFoto + 'px');
      wrap.style.setProperty('--lg-gal-radius', Math.round(clamp(radius, 88, 230)) + 'px');
    }
    function indeksDariRotasi() {
      return ((Math.round(-rotation / step) % n) + n) % n;
    }
    function perbarui() {
      if (rusak) return;
      wrap.style.setProperty('--lg-gal-rot', rotation.toFixed(2) + 'deg');
      index = indeksDariRotasi();
      cells.forEach(function (cell, i) {
        var facing = Math.cos((rotation + i * step) * Math.PI / 180);
        var jarak = Math.min(Math.abs(i - index), n - Math.abs(i - index));
        var aktif = i === index;
        cell.classList.toggle('is-active', aktif);
        cell.style.setProperty('--lg-gal-facing', facing.toFixed(3));
        cell.style.zIndex = String(aktif ? 30 : 20 - jarak);
        cell.tabIndex = aktif ? 0 : -1;
        if (facing <= -0.2) cell.setAttribute('aria-hidden', 'true');
        else cell.removeAttribute('aria-hidden');
      });
      dots.forEach(function (dot, i) {
        if (i === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      hitung.textContent = (index + 1) + ' / ' + n;
    }
    function jedaAuto() {
      auto = false;
      if (timerJeda) clearTimeout(timerJeda);
      if (!gerakKurangi) {
        timerJeda = setTimeout(function () {
          auto = true;
          targetRotation = rotation;
        }, 3200);
      }
    }
    function ke(i) {
      var dasar = Math.round(rotation / step) * step;
      var kiniIndex = ((Math.round(-dasar / step) % n) + n) % n;
      var delta = ((i - kiniIndex) % n + n) % n;
      if (delta > n / 2) delta -= n;
      targetRotation = dasar - delta * step;
      jedaAuto();
      pastikanJalan();
    }
    function geser(arah) {
      ke(((index + arah) % n + n) % n);
    }
    function jalan(ts) {
      if (rusak) return;
      if (!terlihat) { rafGal = 0; waktuAkhir = 0; return; }
      if (!waktuAkhir) waktuAkhir = ts;
      var dt = Math.min(50, ts - waktuAkhir);
      waktuAkhir = ts;
      if (!gerakKurangi && auto && !tahan && !menyeret && !document.hidden) {
        rotation -= dt * 0.0075;
        targetRotation = rotation;
      } else if (!menyeret) {
        if (gerakKurangi) rotation = targetRotation;
        else {
          rotation += (targetRotation - rotation) * 0.14;
          if (Math.abs(targetRotation - rotation) < 0.02) rotation = targetRotation;
        }
      }
      perbarui();
      rafGal = requestAnimationFrame(jalan);
    }
    function pastikanJalan() {
      if (!rusak && terlihat && !rafGal) rafGal = requestAnimationFrame(jalan);
    }
    function onPrev() { geser(-1); }
    function onNext() { geser(1); }
    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      menyeret = true;
      seretBergerak = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startRotation = rotation;
      targetRotation = rotation;
      auto = false;
      scene.classList.add('is-dragging');
    }
    function onPointerMove(e) {
      if (!menyeret || (pointerId != null && e.pointerId !== pointerId)) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 7) seretBergerak = true;
      rotation = startRotation + dx * 0.38;
      targetRotation = rotation;
      perbarui();
    }
    function onPointerUp(e) {
      if (!menyeret || (pointerId != null && e.pointerId !== pointerId)) return;
      menyeret = false;
      pointerId = null;
      scene.classList.remove('is-dragging');
      targetRotation = Math.round(rotation / step) * step;
      tekanKlik = seretBergerak;
      if (timerKlik) clearTimeout(timerKlik);
      if (tekanKlik) timerKlik = setTimeout(function () { tekanKlik = false; }, 140);
      jedaAuto();
      pastikanJalan();
    }
    function onClick(e) {
      if (tekanKlik) {
        e.preventDefault();
        e.stopPropagation();
        tekanKlik = false;
        return;
      }
      var target = e.target;
      var cell = target && target.closest ? target.closest('.gal-cell[data-gal]') : null;
      if (!cell) return;
      var i = cells.indexOf(cell);
      if (i >= 0 && i !== index) {
        e.preventDefault();
        e.stopPropagation();
        ke(i);
      }
    }
    function onKeyDown(e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); geser(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); geser(1); }
      else if (e.key === 'Home') { e.preventDefault(); ke(0); }
      else if (e.key === 'End') { e.preventDefault(); ke(n - 1); }
    }
    function onPointerEnter(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      tahan = true;
    }
    function onPointerLeave(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      tahan = false;
      jedaAuto();
    }
    function onFocusIn() { tahan = true; auto = false; }
    function onFocusOut(e) {
      if (e.relatedTarget && wrap.contains(e.relatedTarget)) return;
      tahan = false;
      jedaAuto();
    }
    function onResize() { aturUkuran(); }

    btnPrev.addEventListener('click', onPrev);
    btnNext.addEventListener('click', onNext);
    scene.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    scene.addEventListener('click', onClick, true);
    scene.addEventListener('keydown', onKeyDown);
    wrap.addEventListener('pointerenter', onPointerEnter);
    wrap.addEventListener('pointerleave', onPointerLeave);
    wrap.addEventListener('focusin', onFocusIn);
    wrap.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onResize);

    if (window.IntersectionObserver) {
      pengamatLihat = new IntersectionObserver(function (entries) {
        terlihat = !!(entries[0] && entries[0].isIntersecting);
        if (terlihat) { aturUkuran(); pastikanJalan(); }
      }, { threshold: 0.22 });
      pengamatLihat.observe(wrap);
    }

    aturUkuran();
    perbarui();
    rafUkuran = requestAnimationFrame(function () { aturUkuran(); perbarui(); });
    pastikanJalan();

    function hancurkan() {
      if (rusak) return;
      rusak = true;
      if (rafGal) cancelAnimationFrame(rafGal);
      if (rafUkuran) cancelAnimationFrame(rafUkuran);
      if (timerJeda) clearTimeout(timerJeda);
      if (timerKlik) clearTimeout(timerKlik);
      if (pengamatLihat) pengamatLihat.disconnect();
      btnPrev.removeEventListener('click', onPrev);
      btnNext.removeEventListener('click', onNext);
      dots.forEach(function (dot, i) { dot.removeEventListener('click', dotHandlers[i]); });
      scene.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      scene.removeEventListener('click', onClick, true);
      scene.removeEventListener('keydown', onKeyDown);
      wrap.removeEventListener('pointerenter', onPointerEnter);
      wrap.removeEventListener('pointerleave', onPointerLeave);
      wrap.removeEventListener('focusin', onFocusIn);
      wrap.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onResize);
      cells.forEach(function (cell, i) {
        cell.classList.remove('lg-gal3d-cell', 'is-active');
        if (i === 0) cell.classList.add('besar');
        cell.style.removeProperty('--lg-gal-i');
        cell.style.removeProperty('--lg-gal-facing');
        cell.style.removeProperty('z-index');
        cell.removeAttribute('tabindex');
        cell.removeAttribute('aria-hidden');
        cell.removeAttribute('aria-roledescription');
        if (labelAwal[i]) cell.setAttribute('aria-label', labelAwal[i]);
      });
      grid.classList.remove('lg-gal3d-ring');
      grid.removeAttribute('data-lg-gal3d');
      if (hint) hint.textContent = hintAwal;
      if (wrap.parentNode) {
        wrap.parentNode.insertBefore(grid, wrap);
        wrap.parentNode.removeChild(wrap);
      }
    }
    return { destroy: hancurkan, wrap: wrap };
  }

  function unmount() {
    if (!state) return;
    if (state.galeri3d) state.galeri3d.destroy();
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
    var galeri3d = pasangGaleri3d();

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
      AuroraCover: AuroraCover, AuroraPage: AuroraPage, dock: dock, galeri3d: galeri3d,
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
