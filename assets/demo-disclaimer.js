/* Add a clear data-example notice to standalone invitation demo pages and
   suppress legacy package/score UI that is not the current offer. */
(function () {
  'use strict';
  var current = document.currentScript;
  var scriptUrl = current && current.src ? current.src : new URL('../assets/demo-disclaimer.js', location.href).href;
  var cssUrl = new URL('demo-disclaimer.css', scriptUrl).href;
  if (!document.querySelector('link[data-ap-demo-css]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = cssUrl; link.setAttribute('data-ap-demo-css', '1');
    document.head.appendChild(link);
  }
  function sanitize() {
    if (!document.body) return;
    document.body.classList.add('ap-demo-page');
    if (!document.querySelector('.ap-demo-disclaimer')) {
      var bar = document.createElement('aside');
      bar.className = 'ap-demo-disclaimer';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Informasi tentang demo');
      bar.innerHTML = '<strong>Demo interaktif · data contoh</strong><span>Nama, foto, tanggal, RSVP, dan isi di halaman ini adalah contoh. Bukan testimoni atau bukti acara pelanggan; harga/ketentuan ada di katalog resmi.</span><a href="' + new URL('../harga/', scriptUrl).href + '">Harga &amp; ketentuan</a>';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    var map = [
      ['2.847+', 'Demo'], ['500+', 'Demo'], ['Pasangan terbantu', 'pratinjau tema'], ['pasangan terbantu', 'pratinjau tema'], ['pasangan sudah pakai', 'pratinjau tema'], ['4.9/5 di Google', 'data contoh'], ['No. 1', 'Demo'],

      ['Best Seller', 'Tema demo'], ['BEST SELLER', 'Tema demo'], ['Paling banyak dipilih pasangan', 'Contoh desain'],
      ['Sekali bayar, aktif selamanya • Garansi 7 hari', 'Harga, masa aktif, dan garansi dikonfirmasi admin'],
      ['Sekali bayar • Garansi 7 hari • Revisi unlimited', 'Harga dan ruang lingkup revisi dikonfirmasi admin'],
      ['Aktif Selamanya', 'Masa aktif dikonfirmasi'], ['No Watermark', 'Watermark dikonfirmasi'],
      ['Custom Domain', 'Domain dikonfirmasi'], ['dalam 5 menit', 'dengan demo interaktif'],
      ['Balasan < 5 menit', 'Waktu respons dikonfirmasi admin'], ['Chat WhatsApp Support Premium', 'Chat WhatsApp AsProject'],
      ['Paling banyak dipilih pasangan', 'Contoh desain floral'], ['Buat Undangan Premium', 'Lihat demo'],
      ['pasangan sudah pakai Premium Ice Blue', 'demo tema Ice Blue · data contoh']
    ];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var value = node.nodeValue || '';
      var next = value;
      map.forEach(function (pair) { next = next.split(pair[0]).join(pair[1]); });
      if (next !== value) node.nodeValue = next;
    }
  }
  sanitize();
  if ('MutationObserver' in window) {
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; sanitize(); }, 40);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
})();
