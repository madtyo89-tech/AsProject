/* ===== SNAPSHOT LAYOUT LAMA (undangan.html) =====
   Salinan URUTAN + LAYOUTS apa adanya, dipakai motor untuk
   mengompilasi template kerangka baru ke format TPL lama.
   SNAPSHOT — bukan sumber kebenaran. tools/cek-kerangka.cjs
   membandingkan file ini dengan undangan.html setiap jalan
   supaya tidak ada drift diam-diam. */

const URUTAN_LAMA={
 A:['guest','doa','profil','harapan','acara','timeline','story','quote','menu','party','dresscode','map','gift','rsvp','closing','bukutamu','galeri','amplop','ucapan'],
 B:['guest','profil','harapan','acara','timeline','story','doa','quote','menu','party','dresscode','map','gift','galeri','bukutamu','amplop','rsvp','closing','ucapan'],
 C:['guest','story','timeline','profil','harapan','acara','quote','doa','galeri','menu','party','dresscode','map','gift','bukutamu','amplop','rsvp','closing','ucapan'],
 D:['guest','acara','timeline','profil','harapan','galeri','story','quote','doa','menu','party','dresscode','map','gift','bukutamu','rsvp','closing','amplop','ucapan'],
 E:['guest','galeri','profil','harapan','acara','timeline','story','quote','doa','menu','party','dresscode','map','gift','bukutamu','amplop','rsvp','closing','ucapan']
};
const LAYOUTS_LAMA={
 'klasik':           {nama:'Klasik',            shell:'klasik',   urutan:'A',ekstra:[]},
 'arsip':            {nama:'Arsip Jawa',        shell:'arsip',    urutan:'A',ekstra:['navDot']},
 'editorial-sage':   {nama:'Editorial Sage',    shell:'editorial',urutan:'B',ekstra:['kutipBesar']},
 'editorial-mutiara':{nama:'Editorial Mutiara', shell:'editorial',urutan:'E',ekstra:['kutipBesar']},
 'panggung-emas':    {nama:'Panggung Emas',     shell:'panggung', urutan:'C',ekstra:['heroFoto','galeriStrip'],vip:true},
 'panggung-gerbang': {nama:'Panggung Gerbang',  shell:'panggung', urutan:'C',ekstra:['heroFoto'],vip:true},
 'zigzag-rustic':    {nama:'Zigzag Rustic',     shell:'zigzag',   urutan:'A',ekstra:[]},
 'zigzag-jubile':    {nama:'Zigzag Jubilee',    shell:'zigzag',   urutan:'C',ekstra:['galeriStrip']},
 'poster-ceria':     {nama:'Poster Ceria',      shell:'poster',   urutan:'D',ekstra:['jamFlip']},
 'poster-anak':      {nama:'Poster Anak',       shell:'poster',   urutan:'D',ekstra:['jamFlip','galeriStrip']},
 'bab-islami':       {nama:'Bab Islami',        shell:'bab',      urutan:'A',ekstra:['babAngka']},
 'bab-netral':       {nama:'Bab Netral',        shell:'bab',      urutan:'B',ekstra:['babAngka']},
 'bab-royal':        {nama:'Bab Royal',         shell:'bab',      urutan:'C',ekstra:['babAngka','kutipBesar']},
 'kaca-manis':       {nama:'Kaca Manis',        shell:'kaca',     urutan:'E',ekstra:['navDot']},
 'kaca-dewasa':      {nama:'Kaca Dewasa',       shell:'kaca',     urutan:'B',ekstra:['navDot']},
 'lembut-biru':      {nama:'Lembut Biru',       shell:'lembut',   urutan:'A',ekstra:[]},
 'lembut-merah':     {nama:'Lembut Merah',      shell:'lembut',   urutan:'E',ekstra:[]},
 'split-midnight':   {nama:'Split Midnight',    shell:'split',    urutan:'B',ekstra:['navDot','heroFoto'],vip:true},
 'split-navy':       {nama:'Split Navy',        shell:'split',    urutan:'A',ekstra:['navDot']}
};
if(typeof module!=='undefined')module.exports={URUTAN_LAMA,LAYOUTS_LAMA};
