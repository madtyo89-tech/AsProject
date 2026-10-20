/* ===== KERANGKA TEMPLATE BARU — LAYER 1: TOKEN TEMA =====
   Design tokens: palet, tipografi, ornamen, border, pola,
   deretan dekorasi. Token LEPAS dari layout — satu token
   bisa dipakai shell/susunan mana pun (berbeda dengan
   TPL lama yang mengunci warna + layout dalam satu objek).

   27 token: 18 tema publik + 6 tema Gerbang migrasi (studioOnly
   dan arch dipertahankan), lalu 2 token baru [BARU]. Id token
   sama dengan id TPL lama supaya migrasi di template.js
   1:1 tanpa tabel terjemahan.

   Referensi ft/orn/pat/border HARUS terdaftar di registry
   masing-masing di undangan.html (FONTS, ORNAMEN, POLA,
   BORDERS) — dicek otomatis oleh tools/cek-kerangka.cjs. */

const TOKEN={
 /* ---- 18 tema publik (migrasi dari TPL studio.html) ---- */
 'ivory-klasik':{nama:'Ivory Klasik',ev:'all',g:['#FBFAF7','#F0ECE3','#DCD3C3'],accent:'#8A6E4B',ink:'#4B4237',ft:'cormorant',orn:'klasik',pat:'damask',border:'double',deco:'✦ ❖ ✦',desc:'Kanvas bersih untuk semua acara — kertas ivory hangat, Cormorant, aksen perunggu'},
 'jawa-elegan':{nama:'Adat Jawa Elegan',ev:'pernikahan',g:['#E8DCCA','#D8C7B0','#C2A88B'],accent:'#7A5C3E',ink:'#6C5237',ft:'marcellus',char:'JAWA',orn:'batik',pat:'parang',border:'frame2',deco:'❖ ✦ ❖',desc:'Nuansa pranakan jawa yang anggun, motif batik halus & gold foil'},
 'minimalist-sage':{nama:'Minimalist Sage',ev:'pernikahan',g:['#D9E4D7','#C2D4BE','#A8BEA3'],accent:'#5F7A5C',ink:'#4A6647',ft:'cormorant',char:'SAGE',orn:'geometrik',pat:'botanical',border:'thin',deco:'✿ ❋ ✿',desc:'Bersih, modern, sage green aesthetic buat couple anti ribet'},
 'luxury-gold':{nama:'Luxury Gold',ev:'pernikahan',g:['#FFF8E1','#F7E8B0','#D4AF37'],accent:'#8C6D1F',ink:'#6B5724',ft:'playfair',char:'GOLD',orn:'deco',pat:'deco',border:'vip-diamond',deco:'✦ ❖ ✦',desc:'Glam soft luxury, emboss gold & black tie vibe'},
 'floral-rustic':{nama:'Floral Rustic',ev:'pernikahan',g:['#FBE9E7','#F8CFC8','#E8AFA4'],accent:'#A66A5E',ink:'#70463E',ft:'lora',char:'RUSTIC',orn:'mawar',pat:'botanical',border:'gapdash',deco:'❀ ❁ ❀',desc:'Bunga-bunga rustic yang manis, cocok outdoor garden party'},
 'biru-ceria':{nama:'Biru Ceria',ev:'khitanan',g:['#E0F2FF','#B8DAFF','#7FB8F0'],accent:'#3A6EA5',ink:'#2D5680',ft:'poppins',char:'CERIA',orn:'confetti',pat:'confetti',border:'dotted',deco:'★ ✦ ★',desc:'Ceria & playful buat jagoan yang lagi disunat, tetap sopan'},
 'islamic-elegant':{nama:'Islamic Elegant',ev:'khitanan',g:['#E6F0E6','#C9DCC9','#A3C4A3'],accent:'#4A6741',ink:'#4C6A43',ft:'cinzel',char:'ISLAMI',orn:'bulan',pat:'girih',border:'filigree',deco:'۞ ✦ ۞',desc:'Islami elegan dengan ornamen arabesque gold yang halus'},
 'kids-party':{nama:'Kids Party',ev:'ultah',g:['#FFF1C1','#FFE082','#FFB74D'],accent:'#B87A1A',ink:'#82602B',ft:'pacifico',char:'PARTY',orn:'kembang-api',pat:'confetti',border:'dashed',deco:'✸ ★ ✸',desc:'Warna-warni happy, balon & confetti buat si kecil'},
 'sweet-17':{nama:'Sweet 17',ev:'ultah',g:['#F9D5E5','#F4A9C4','#E57AA0'],accent:'#9E4A66',ink:'#76374C',ft:'dancing',char:'SWEET',orn:'pita',pat:'tabur',border:'ribbon-satin',deco:'✦ ❀ ✦',desc:'Pink soft dan aesthetic, pas buat sweet seventeen yang lagi seneng-senengnya'},
 'adult-elegant':{nama:'Adult Elegant',ev:'ultah',g:['#E8E6E1','#D5D0C9','#B8B2A8'],accent:'#5A5753',ink:'#665947',ft:'ebgaramond',char:'ELEGAN',orn:'zaitun',pat:'marmer',border:'topbot',deco:'❖ ─ ❖',desc:'Mature, minimal, buat ultah ke-30, 40, 50 yang classy'},
 'baby-boy':{nama:'Baby Boy',ev:'aqiqah',g:['#E3F2FD','#BBDEFB','#90CAF9'],accent:'#4A7FB5',ink:'#32567B',ft:'caveat',char:'BABY',orn:'awan',pat:'frost',border:'halo',deco:'✦ ☁ ✦',desc:'Lembut biru langit, ilustrasi baby boy yang gemes'},
 'baby-girl':{nama:'Baby Girl',ev:'aqiqah',g:['#FCE4EC','#F8BBD0','#F48FB1'],accent:'#B55A7A',ink:'#78364D',ft:'caveat',char:'PUTRI',orn:'bunga',pat:'renda',border:'pearl-crown',deco:'✿ ✦ ✿',desc:'Pink blush super lembut buat si putri kecil kesayangan'},
 'islamic-neutral':{nama:'Islamic Neutral',ev:'aqiqah',g:['#F5F2E4','#E7E3CB','#D2CBA8'],accent:'#6E7A52',ink:'#5A5540',ft:'marcellus',char:'ADAB',orn:'arabesque',pat:'damask',border:'corners',deco:'۞ ❖ ۞',desc:'Gender neutral, kaligrafi doa & nuansa sage-cream hangat'},
 'midnight-gold':{nama:'Midnight Gold',ev:'pernikahan',g:['#1E1A15','#2E2419','#4A3A22'],accent:'#D4AF37',ink:'#F2E8D5',ft:'cinzel',char:'ONYX',orn:'onyx',pat:'sulur',border:'onyx-inlay',deco:'✦ ❖ ✦',desc:'Kemewahan onyx & gold foil — drama elegan untuk malam sakral'},
 'emerald-royal':{nama:'Emerald Royal',ev:'pernikahan',g:['#14342B','#1F4D3E','#356B55'],accent:'#D9B86C',ink:'#F0EAD6',ft:'marcellus',char:'ZAMRUD',orn:'botanical',pat:'botanical',border:'laurel',deco:'❖ ✦ ❖',desc:'Zamrud pekat beraksen emas kerajaan, anggun & berwibawa'},
 'navy-crest':{nama:'Navy Crest',ev:'khitanan',g:['#16233F','#223457','#334B76'],accent:'#E7C27D',ink:'#F2ECDC',ft:'ebgaramond',char:'BINTANG',orn:'mahkota',pat:'ombak',border:'vip-crown',deco:'★ ✦ ★',desc:'Navy klasik bercrest emas — gagah, sopan, tetap mewah'},
 'golden-jubilee':{nama:'Golden Jubilee',ev:'ultah',g:['#F5E7C8','#E8CF96','#D4AF37'],accent:'#8C6D1F',ink:'#5C4714',ft:'playfair',char:'JUBILE',orn:'bintang',pat:'deco',border:'artdeco',deco:'✦ ✸ ✦',desc:'Pesta emas champagne buat milestone istimewa — 30, 40, 50 tahun'},
 'pearl-ivory':{nama:'Pearl Ivory',ev:'aqiqah',g:['#FDF9F3','#F6E7E2','#E9D2CE'],accent:'#A87E74',ink:'#5E4E36',ft:'cormorant',char:'MUTIARA',orn:'mutiara',pat:'renda',border:'lace-ivory',deco:'✦ ❖ ✦',desc:'Mutiara rosé-champagne, lembut tapi tak lagi serupa ivory'},

 /* ---- 6 tema Gerbang Arch (studioOnly) ---- */
 'gerbang-rosewood':{nama:'Gerbang Arch · Rosewood',ev:'pernikahan',g:['#FFF8F3','#F3E5DC','#E8CFC4'],accent:'#8A4B56',ink:'#5B3540',ft:'lora',char:'ROSEWOOD',orn:'mawar',pat:'botanical',border:'gold-leaf',deco:'✦ ❖ ✦',studioOnly:true,arch:true,desc:'Bingkai arch berlapis dengan ivory hangat dan aksen rosewood'},
 'gerbang-sage-pearl':{nama:'Gerbang Arch · Sage Pearl',ev:'pernikahan',g:['#FBFAF5','#EEEFE4','#D8DDCB'],accent:'#526A55',ink:'#435348',ft:'ebgaramond',char:'SAGE',orn:'mutiara',pat:'botanical',border:'pearl',deco:'✿ ❋ ✿',studioOnly:true,arch:true,desc:'Sage netral, kartu editorial ivory, dan foto berbingkai arch'},
 'gerbang-midnight-navy':{nama:'Gerbang Arch · Midnight Navy',ev:'pernikahan',g:['#FBF8F0','#F1E3C2','#D8C7A3'],accent:'#80653D',ink:'#26364D',ft:'playfair',char:'NAVY',orn:'onyx',pat:'mendung',border:'vip-aurora',deco:'✦ ❖ ✦',studioOnly:true,arch:true,desc:'Kontras midnight navy dengan champagne dan bingkai arch berlapis'},
 'gerbang-khitanan-emerald':{nama:'Gerbang Arch · Khitanan Emerald',ev:'khitanan',g:['#FFFCF3','#E5F1E8','#C6D8CB'],accent:'#3A765F',ink:'#3D5F4F',ft:'cinzel',char:'EMERALD',orn:'arabesque',pat:'girih',border:'laurel',deco:'۞ ✦ ۞',studioOnly:true,arch:true,desc:'Khitanan bernuansa emerald, doa islami, dan aksen emas lembut'},
 'gerbang-aqiqah-natural':{nama:'Gerbang Arch · Aqiqah Natural',ev:'aqiqah',g:['#FCF8F0','#F3E9D4','#E1D1B5'],accent:'#8C7052',ink:'#5E5142',ft:'marcellus',char:'NATURAL',orn:'botanical',pat:'kawung',border:'halo',deco:'۞ ❖ ۞',studioOnly:true,arch:true,desc:'Aqiqah bernuansa sand dan ivory dengan bingkai foto lengkung'},
 'gerbang-pesta-ceria':{nama:'Gerbang Arch · Ulang Tahun Ceria',ev:'ultah',g:['#FFF8F4','#FFE6DC','#F2C9CB'],accent:'#A65066',ink:'#644355',ft:'dancing',char:'CERIA',orn:'confetti',pat:'confetti',border:'dotted',deco:'✸ ✦ ✸',studioOnly:true,arch:true,desc:'Ulang tahun ceria dengan sentuhan editorial, coral, dan arch'},

 /* ---- [BARU] token baru murni untuk kerangka blok+token ---- */
 'kopi-sunda':{nama:'Kopi Sunda',ev:'all',g:['#F7F0E6','#EBDFC9','#D9C7A7'],accent:'#7C5A3A',ink:'#4E3F30',ft:'ebgaramond',orn:'botanical',pat:'kawung',border:'frame2',deco:'❀ ✦ ❀',desc:'Kopi Sunda hangat — tanah, kayu, dan kertas daur ulang [BARU]'},
 'langit-pagi':{nama:'Langit Pagi',ev:'aqiqah',g:['#FFF6E9','#FFE3B3','#FBCF87'],accent:'#C07F2A',ink:'#6B5222',ft:'marcellus',orn:'bintang',pat:'mendung',border:'halo',deco:'☀ ✦ ☀',desc:'Langit pagi yang hangat — lembut menyambut si kecil [BARU]'},
 'senja-kencana':{nama:'Senja Kencana',ev:'pernikahan',g:['#FFF6EC','#FFD9A8','#F2994A'],accent:'#B4530A',ink:'#5C3A1E',ft:'marcellus',char:'SENJA',orn:'mawar',pat:'ombak',border:'laurel',deco:'❀ ✦ ❀',desc:'Senja kencana — apricot & terracotta hangat, mawar berombak [BARU]'},

 /* ---- [BARU] gaya visual beda jauh: editorial raksasa, retro, gelap rimbun ---- */
 'sorot-utama':{nama:'Sorot Utama',ev:'pernikahan',g:['#FBFAF6','#F2EFE7','#E4DFD2'],accent:'#1B1B1B',ink:'#26231D',ft:'playfair',char:'UTAMA',orn:'geometrik',pat:'damask',border:'thin',deco:'✦ — ✦',desc:'Editorial raksasa — nama jadi tipografi besar, asimetris, white space ekstrem [BARU]'},
 'retro-surya':{nama:'Retro Surya',ev:'ultah',g:['#FFEAC2','#F9CE5E','#F09A3E'],accent:'#0E5E50',ink:'#3B2C16',ft:'bebas',char:'SURY',orn:'deco',pat:'surya',border:'artdeco',deco:'☀ ✦ ☀',desc:'Retro surya — mustard & teal, font chunky, tanggal raksasa bergaya mid-century [BARU]'},
 'gelap-rimbun':{nama:'Gelap Rimbun',ev:'pernikahan',g:['#171120','#251A35','#3D2652'],accent:'#D9B36A',ink:'#F5ECDE',ft:'cinzel',char:'RIMB',orn:'mawar',pat:'rimbun',border:'gold-leaf',deco:'❀ ✦ ❀',desc:'Gelap rimbun — plum malam berlapis flora, aksen emas, drama botanikal [BARU]'},

 /* ---- [BARU] dari riset 2026: tropis, kraft, wabi-sabi, bunga kering ---- */
 'rimba-tropis':{nama:'Rimba Tropis',ev:'pernikahan',g:['#F0F7EE','#D6EAD9','#A9CDB0'],accent:'#1F6B44',ink:'#274A33',ft:'merriweather',char:'RIMBA',orn:'botanical',pat:'monstera',border:'laurel',deco:'❀ ✦ ❀',desc:'Rimba tropis — monstera & palem rimbun, hijau segar [BARU]'},
 'kertas-kraft':{nama:'Kertas Kraft',ev:'pernikahan',g:['#EFE4D0','#E0CDA6','#C9AE83'],accent:'#7C5230',ink:'#4E3B26',ft:'caveat',char:'KRAFT',orn:'coretan',pat:'kraft',border:'gapdash',deco:'✁ ✦ ✁',desc:'Kertas kraft bertekstur, tulisan tangan, kesan kraftangan [BARU]'},
 'wabi-sabi':{nama:'Wabi Sabi',ev:'pernikahan',g:['#F1ECE3','#E4DBCB','#CFC0AA'],accent:'#8C7A64',ink:'#57503F',ft:'cormorant',char:'WABI',orn:'mutiara',pat:'washi',border:'halo',deco:'・ ✦ ・',desc:'Wabi sabi — ketidaksempurnaan yang tenang, washi & tanah [BARU]'},
 'bunga-kering':{nama:'Bunga Kering',ev:'pernikahan',g:['#F4E7D7','#E4C9AE','#CBA37C'],accent:'#9C6B4F',ink:'#5E4634',ft:'lora',char:'KEMBANG',orn:'mawar',pat:'botanical',border:'pearl',deco:'❀ ✦ ❀',desc:'Bunga kering — dusty rose & gandum, nostalgi lembut [BARU]'}
};
const TOKEN_IDS=Object.keys(TOKEN);
if(typeof module!=='undefined')module.exports={TOKEN,TOKEN_IDS};
