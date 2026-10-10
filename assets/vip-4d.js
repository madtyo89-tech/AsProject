/* AsProject VIP 4D — lapisan parallax, partikel, dan entrance sinematik.
   Dipakai undangan.html (dimount saat template bertier 'vip') dan ikut ter-embed
   ke file HTML mandiri hasil "Simpan File HTML" di Studio.

   Lapisan (belakang → depan):
     .vip-bg   artwork tema, parallax lambat + geser latar saat scroll
     .vip-mid  ornamen deco tema, parallax sedang
     .vip-fg   canvas partikel (gold/petal/snow/bubble), parallax tercepat
   Gerak: scroll (background-position), mouse (desktop), gyroscope (HP;
   untuk iOS memakai tombol izin "Aktifkan Gerak 4D" karena
   DeviceOrientationEvent.requestPermission butuh gestur pengguna).

   Guard performa: prefers-reduced-motion → tidak mount sama sekali;
   partikel dibatasi 40 & memakai delta-time; canvas pause saat cover
   tidak terlihat (IntersectionObserver). */
(function () {
  'use strict';
  function reduced() {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  var TYPES = {
    gold:   { c: '212,175,55',  r: [1, 2.6], v: [0.15, 0.5] },
    petal:  { c: '244,193,201', r: [2, 4],   v: [0.3, 0.8] },
    snow:   { c: '255,255,255', r: [1.2, 3], v: [0.2, 0.7] },
    bubble: { c: '190,235,244', r: [2, 5],   v: [0.25, 0.6] }
  };
  function mount(cfg) {
    if (reduced() || !cfg) return null;
    var cover = document.getElementById('cover');
    if (!cover || !window.AsVip4d) return null;
    cover.classList.add('vip4d-on', 'vip-scene-' + (cfg.scene || 'zoom'));
    var bg = document.createElement('div'); bg.className = 'vip-bg';
    if (cfg.art) bg.style.backgroundImage = "url('" + cfg.art + "')";
    var mid = document.createElement('div'); mid.className = 'vip-mid';
    mid.textContent = cfg.deco || '';
    var cv = document.createElement('canvas'); cv.className = 'vip-fg';
    cover.insertBefore(bg, cover.firstChild);
    cover.insertBefore(mid, bg.nextSibling);
    cover.insertBefore(cv, mid.nextSibling);

    /* ---------- partikel ---------- */
    var x = cv.getContext('2d'), P = [], W = 0, H = 0;
    if (!x) return null; /* canvas 2d tak tersedia — degrade anggun tanpa partikel */
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    function size() { W = cv.width = Math.max(1, cv.offsetWidth * DPR); H = cv.height = Math.max(1, cv.offsetHeight * DPR); }
    size(); window.addEventListener('resize', size);
    var T = TYPES[cfg.part] || TYPES.gold;
    for (var i = 0; i < 40; i++) P.push({
      x: Math.random(), y: Math.random(),
      r: T.r[0] + Math.random() * (T.r[1] - T.r[0]),
      s: T.v[0] + Math.random() * (T.v[1] - T.v[0]),
      o: 0.25 + Math.random() * 0.5, d: Math.random() * 6.28
    });
    var run = true, last = 0;
    function tick(t) {
      if (!run) return;
      var dt = Math.min(50, (t - last) || 16); last = t;
      x.clearRect(0, 0, W, H);
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        p.y -= p.s * dt / 1000 * 0.12; p.d += dt / 1000;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        x.beginPath();
        x.arc((p.x + Math.sin(p.d) * 0.01) * W, p.y * H, p.r * DPR, 0, 6.283);
        x.fillStyle = 'rgba(' + T.c + ',' + p.o.toFixed(2) + ')';
        x.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var v = !!en[0].isIntersecting;
        if (v !== run) { run = v; if (run) { last = 0; requestAnimationFrame(tick); } }
      }, { threshold: 0 }).observe(cover);
    }

    /* ---------- parallax: scroll + mouse + gyroscope ---------- */
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function apply() {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      bg.style.transform = 'translate3d(' + (cx * -8).toFixed(1) + 'px,' + (cy * -6).toFixed(1) + 'px,0) scale(1.06)';
      mid.style.transform = 'translate3d(' + (cx * 14).toFixed(1) + 'px,' + (cy * 10).toFixed(1) + 'px,0)';
      cv.style.transform = 'translate3d(' + (cx * 22).toFixed(1) + 'px,' + (cy * 16).toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(apply); else raf = 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(apply); }
    function scrollFx() {
      var r = cover.getBoundingClientRect();
      var k = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
      bg.style.backgroundPosition = '50% ' + (50 + k * 6).toFixed(1) + '%';
    }
    window.addEventListener('scroll', scrollFx, { passive: true }); scrollFx();
    if (matchMedia('(pointer:fine)').matches) {
      cover.addEventListener('mousemove', function (e) {
        var r = cover.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width * 2 - 1;
        ty = (e.clientY - r.top) / r.height * 2 - 1;
        kick();
      });
    }
    function gyro(e) {
      if (e.gamma == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 24));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 24));
      kick();
    }
    var btn = null, D = window.DeviceOrientationEvent;
    if (D) {
      if (typeof D.requestPermission === 'function') {
        btn = document.createElement('button');
        btn.className = 'vip-btn'; btn.type = 'button';
        btn.textContent = '✦ Aktifkan Gerak 4D';
        btn.onclick = function () {
          D.requestPermission().then(function (s) {
            if (s === 'granted') window.addEventListener('deviceorientation', gyro);
            if (btn) btn.remove();
          }).catch(function () { if (btn) btn.remove(); });
        };
        cover.appendChild(btn);
      } else {
        window.addEventListener('deviceorientation', gyro);
      }
    }
    return { destroy: function () { run = false; if (raf) cancelAnimationFrame(raf); } };
  }
  window.AsVip4d = { mount: mount, TYPES: TYPES };
})();
