/* ===== KERANGKA TEMPLATE BARU — LAYER 2: REGISTRY BLOK =====
   Blok = unit konten bernama (sampul, doa, mempelai, …).
   Tiap blok punya varian; template memilih susunan blok +
   varian per blok. Kunci blok baru = nama kunci builder B{}
   di undangan.html ditambah cover & footer yang kini jadi
   blok eksplisit (sehingga bisa dipindah/ditiadakan).

   SUSUNAN = preset urutan bernama (A–E, migrasi dari URUTAN
   lama). Template juga boleh memakai susunan bebas — array
   kunci blok sendiri — itu yang membedakan kerangka ini. */

const BLOK={
 cover:   {nama:'Sampul',          def:'klasik', varian:['klasik','arch','split','segel','jendela']},
 tamu:    {nama:'Kepada Yth',      def:'kartu',  varian:['kartu','inline']},
 doa:     {nama:'Doa',             def:'bingkai',varian:['bingkai','polos']},
 profil:  {nama:'Mempelai',        def:'stack',  varian:['stack','side','kartu']},
 harapan: {nama:'Harapan',         def:'paragraf',varian:['paragraf','kutip']},
 acara:   {nama:'Waktu & Tempat',  def:'kartu',  varian:['kartu','baris']},
 timeline:{nama:'Timeline Acara',  def:'vertikal',varian:['vertikal','horizontal']},
 cerita:  {nama:'Cerita',          def:'galeri', varian:['galeri','teks']},
 kutip:   {nama:'Kutipan',         def:'besar',  varian:['besar','kecil']},
 menu:    {nama:'Menu Acara',      def:'daftar',  varian:['daftar','kartu']},
 panitia: {nama:'Panitia',         def:'grid',   varian:['grid','baris']},
 dress:   {nama:'Dress Code',      def:'strip',  varian:['strip','kartu']},
 peta:    {nama:'Peta & Lokasi',   def:'peta',   varian:['peta','alamat']},
 kado:    {nama:'Alamat Kado',     def:'kartu',  varian:['kartu','baris']},
 rsvp:    {nama:'RSVP',            def:'tombol', varian:['tombol','formulir']},
 tutup:   {nama:'Penutup',         def:'polos',  varian:['polos','hias']},
 bukutamu:{nama:'Buku Tamu',       def:'buku',   varian:['buku','garis']},
 galeri:  {nama:'Galeri',          def:'grid',   varian:['grid','strip','slider']},
 amplop:  {nama:'Amplop Digital',  def:'kartu',  varian:['kartu','baris']},
 ucapan:  {nama:'Ucapan',          def:'polos',  varian:['polos','bingkai']},
 footer:  {nama:'Catatan Kaki',    def:'hias',   varian:['hias','polos']}
};
const BLOK_IDS=Object.keys(BLOK);

/* Preset susunan — setara URUTAN A–E lama, + cover di awal
   dan footer di akhir (dulu keduanya implisit). */
const SUSUNAN={
 /* A: mempelai dulu, doa menyusul setelah alur acara */
 A:['cover','tamu','doa','profil','harapan','acara','timeline','cerita','kutip','menu','panitia','dress','peta','kado','rsvp','tutup','bukutamu','galeri','amplop','ucapan','footer'],
 /* B: mempelai dulu, doa turun setelah alur acara */
 B:['cover','tamu','profil','harapan','acara','timeline','cerita','doa','kutip','menu','panitia','dress','peta','kado','galeri','bukutamu','amplop','rsvp','tutup','ucapan','footer'],
 /* C: bercerita dulu — kisah & timeline membuka, galeri naik awal */
 C:['cover','tamu','cerita','timeline','profil','harapan','acara','kutip','doa','galeri','menu','panitia','dress','peta','kado','bukutamu','amplop','rsvp','tutup','ucapan','footer'],
 /* D: to the point — waktu & tempat segera setelah tamu disapa */
 D:['cover','tamu','acara','timeline','profil','harapan','galeri','cerita','kutip','doa','menu','panitia','dress','peta','kado','bukutamu','rsvp','tutup','amplop','ucapan','footer'],
 /* E: visual dulu — galeri jadi pembuka, teks menyusul */
 E:['cover','tamu','galeri','profil','harapan','acara','timeline','cerita','kutip','doa','menu','panitia','dress','peta','kado','bukutamu','amplop','rsvp','tutup','ucapan','footer']
};

/* Kunci builder B{} lama → kunci blok baru (untuk migrasi
   dan audit pemetaan; tidak dipakai motor render). */
const BLOK_DARI_LAMA={
 guest:'tamu', doa:'doa', profil:'profil', harapan:'harapan',
 acara:'acara', timeline:'timeline', story:'cerita', quote:'kutip',
 menu:'menu', party:'panitia', dresscode:'dress', map:'peta',
 gift:'kado', rsvp:'rsvp', closing:'tutup', bukutamu:'bukutamu',
 galeri:'galeri', amplop:'amplop', ucapan:'ucapan'
};
if(typeof module!=='undefined')module.exports={BLOK,BLOK_IDS,SUSUNAN,BLOK_DARI_LAMA};
