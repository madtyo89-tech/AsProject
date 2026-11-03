/* tema-ai-proxy.js — jembatan OPSIONAL ke LLM sungguhan (Supabase Edge Function).
 *
 * Berkas ini TIDAK dipakai selama endpoint belum diisi. Generator lokal
 * (assets/tema-ai.js) tetap bekerja penuh tanpa jaringan.
 *
 * Cara mengaktifkan (lihat juga docs/ai-tema-proxy.md):
 *   <meta name="asp-ai-endpoint" content="https://<proyek>.supabase.co/functions/v1/ai-tema">
 *   atau window.ASP_AI_ENDPOINT = '…' sebelum berkas ini dimuat.
 *
 * Kontrak: POST {prompt, ev, jumlah, keberanian} → {kandidat:[token,…]}.
 * Setiap kandidat divalidasi ulang oleh TEMA_AI.validasi(); yang tidak sah
 * dibuang, jadi fungsi server tidak bisa menyuntik id/CSS sembarangan.
 */
(function (root) {
  'use strict';

  function endpoint() {
    if (typeof root.ASP_AI_ENDPOINT === 'string' && root.ASP_AI_ENDPOINT) return root.ASP_AI_ENDPOINT;
    var m = document.querySelector('meta[name="asp-ai-endpoint"]');
    var v = m && m.getAttribute('content');
    return v && /^https:\/\//i.test(v) ? v : '';
  }

  function minta(prompt, opsi) {
    var url = endpoint();
    if (!url) return Promise.reject(new Error('endpoint AI belum diatur'));
    var AI = root.TEMA_AI;
    if (!AI) return Promise.reject(new Error('mesin tema-ai.js belum dimuat'));
    var body = {
      prompt: String(prompt || '').slice(0, 500),
      ev: (opsi && opsi.ev) || 'pernikahan',
      jumlah: Math.max(1, Math.min(5, Number(opsi && opsi.jumlah) || 3)),
      keberanian: Math.max(1, Math.min(3, Number(opsi && opsi.keberanian) || 1))
    };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('server AI membalas HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      var arr = Array.isArray(data) ? data : (data && data.kandidat) || [];
      var sah = [], galat = [];
      arr.forEach(function (t) {
        var cek = AI.validasi(t);
        if (cek.ok) sah.push(cek.nilai); else galat.push(cek.galat.join('; '));
      });
      if (!sah.length) throw new Error('tidak ada kandidat sah dari server' + (galat.length ? ': ' + galat[0] : ''));
      return sah;
    });
  }

  root.TEMA_AI_PROXY = { aktif: function () { return !!endpoint(); }, endpoint: endpoint, minta: minta };
})(typeof window !== 'undefined' ? window : globalThis);
