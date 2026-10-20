/* ===== KERANGKA TEMPLATE BARU — MOTOR =====
   Dua fungsi inti:
   1. kompilasiLama()  — template kerangka baru → entri TPL
      lama (supaya renderer undangan.html yang ada bisa
      tetap memakainya). Bila kombinasi shell+susunan+ekstra
      tidak ada di LAYOUTS_LAMA, layout diisi null: template
      itu hanya bisa dirender motor baru (memang itu tujuan
      kerangka blok — kombinasi bebas).
   2. renderUndangan() — renderer demo mandiri yang memakai
      token + blok langsung, untuk pratinjau di
      kerangka-demo.html.
   turunkan() membalik prosesnya: entri TPL lama → template
      baru (migrasi + bukti round-trip di cek-kerangka.cjs). */

/* Muat universal: di browser pakai global (script tag),
   di Node pakai require (validator cek-kerangka.cjs).
   Nama lokal TK/BK/SS/LX supaya tidak mendeklarasikan
   ulang const global di browser. */
const TK=(typeof TOKEN!=='undefined')?TOKEN:require('./token-tema.js').TOKEN;
const BK=(typeof BLOK!=='undefined')?BLOK:require('./registry-blok.js').BLOK;
const MDL=(typeof BLOK_DARI_LAMA!=='undefined')?BLOK_DARI_LAMA:require('./registry-blok.js').BLOK_DARI_LAMA;
const SS=(typeof SUSUNAN!=='undefined')?SUSUNAN:require('./registry-blok.js').SUSUNAN;
const LX=(typeof LAYOUTS_LAMA!=='undefined')?LAYOUTS_LAMA:require('./layouts-lama.js').LAYOUTS_LAMA;

const ROMAWI=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
const SHELL_KELUARGA={klasik:'lembar',zigzag:'lembar',kaca:'lembar',lembut:'lembar',arsip:'bab',bab:'bab',editorial:'editorial',panggung:'panggung',split:'split',poster:'poster',gedung:'gedung',retro:'retro',rimbun:'rimbun'};
const FONT_FAM={cormorant:'"Cormorant Garamond",serif',playfair:'"Playfair Display",serif',poppins:'"Poppins",sans-serif',inter:'"Inter",sans-serif',lora:'"Lora",serif',montserrat:'"Montserrat",sans-serif',bebas:'"Bebas Neue",sans-serif',oswald:'"Oswald",sans-serif',ebgaramond:'"EB Garamond",serif',merriweather:'"Merriweather",serif','work-sans':'"Work Sans",sans-serif',pacifico:'"Pacifico",cursive',dancing:'"Dancing Script",cursive',caveat:'"Caveat",cursive',sacramento:'"Sacramento",cursive',cinzel:'"Cinzel",serif',marcellus:'"Marcellus",serif'};

function susunanArray(tpl){return Array.isArray(tpl.susunan)?tpl.susunan:(SS[tpl.susunan]||SS.A)}
function presetDariSusunan(arr){
 for(const k in SS){const p=SS[k];
  if(p.length===arr.length&&p.every((b,i)=>b===arr[i]))return k}
 return null
}
function samaHimpunan(a,b){return a.length===b.length&&a.every(x=>b.includes(x))}

/* Cari id layout lama yang persis setara (shell+urutan+ekstra). */
function cariLayoutLama(shell,urutan,ekstra){
 for(const id in LX){const L=LX[id];
  if(L.shell===shell&&L.urutan===urutan&&samaHimpunan(L.ekstra||[],ekstra||[]))return id}
 return null
}

/* Template baru → entri TPL lama (format studio/undangan/index).
   Bila shell+susunan+ekstra setara preset LAYOUTS lama, layout
   diisi dan renderer lama memakainya apa adanya. Bila tidak
   (kombinasi bebas), layout null + field kb membawa metadata
   kerangka — urutan section SUDAH diterjemahkan ke kunci
   builder lama, shell/ekstra/cover-hint siap pakai renderer. */
const EKSTRA_LAMA=['navDot','kutipBesar','heroFoto','galeriStrip','jamFlip','babAngka'];
const COVER_DARI_VARIAN={klasik:'amplop',arch:'gerbang',segel:'minimal',jendela:'batik',split:'night'};
/* BLOK_DARI_LAMA memetakan lama→baru; generator butuh
   sebaliknya (baru→lama) supaya susunan bebas bisa
   dibaca renderer produksi. */
const MDL_BALIK=Object.fromEntries(Object.entries(MDL).map(([a,b])=>[b,a]));
function kompilasiLama(tpl){
 const tk=TK[tpl.token];
 if(!tk)throw new Error('token tidak dikenal: '+tpl.token);
 const sus=susunanArray(tpl);
 const ur=presetDariSusunan(sus);
 const layout=(ur&&cariLayoutLama(tpl.shell,ur,tpl.ekstra))||null;
 const kb=layout?null:{
  shell:tpl.shell,
  urutan:sus.filter(k=>k!=='cover'&&k!=='footer').map(k=>MDL_BALIK[k]||k),
  ekstra:(tpl.ekstra||[]).filter(e=>EKSTRA_LAMA.includes(e)),
  cover:COVER_DARI_VARIAN[(tpl.blok.cover&&tpl.blok.cover.varian)||'klasik']||'amplop'
 };
 return {id:tpl.id,nama:tpl.nama,ev:tpl.ev,harga:tpl.harga||75000,
  g:tk.g,accent:tk.accent,ink:tk.ink,badge:tpl.badge||'',
  deco:tk.deco||'✦ ❖ ✦',pat:tk.pat,ft:tk.ft,char:tk.char||'',
  arch:!!tpl.arch,studioOnly:!!tpl.studioOnly,vip:!!tpl.vip,
  layout:layout,orn:tk.orn,border:tk.border,desc:tpl.desc||'',
  cover:tpl.cover||'amplop',buka:tpl.buka||'pita',
  kerangkaBaru:true,layoutBaru:!layout,
  ...(kb?{kb}:{})};
}

/* Entri TPL lama → template baru (migrasi 1:1). */
function turunkan(tplLama){
 const L=LX[tplLama.layout]||LX.klasik;
 return {id:tplLama.id,nama:tplLama.nama,ev:tplLama.ev,harga:tplLama.harga||75000,
  badge:tplLama.badge||'',token:tplLama.id,shell:L.shell,susunan:L.urutan,
  ekstra:L.ekstra||[],blok:{},vip:!!L.vip,studioOnly:!!tplLama.studioOnly,
  arch:!!tplLama.arch,desc:tplLama.desc||'',
  cover:tplLama.cover||'amplop',buka:tplLama.buka||'pita'};
}

/* ================= RENDERER DEMO ================= */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ornaman=()=>'<svg viewBox="0 0 168 28" class="k-orn" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M84 14c-8-9-18-10-27-5-5 4.6-7.6 9.2-5 12.4 2.4 3 7 1.8 7.6-1.8.5-2.5-2.4-4-4.2-2"/><path d="M84 14c8-9 18-10 27-5 5 4.6 7.6 9.2 5 12.4-2.4 3-7 1.8-7.6-1.8-.5-2.5 2.4-4 4.2-2"/></g><path d="M84 6l4.5 8-4.5 8-4.5-8Z" fill="currentColor"/><circle cx="58" cy="14" r="1.6" fill="currentColor" opacity=".6"/><circle cx="110" cy="14" r="1.6" fill="currentColor" opacity=".6"/></svg>';
const cssToken=tk=>'--k-g1:'+tk.g[0]+';--k-g2:'+tk.g[1]+';--k-g3:'+tk.g[2]+';--k-accent:'+tk.accent+';--k-ink:'+tk.ink+';--k-ft:'+(FONT_FAM[tk.ft]||'serif')+';';
const pasangan=d=>d.pasangan||[{nama:'Alya Putri',orangTua:'Putri ketiga Bpk. Ratna & Ibu Sari'},{nama:'Bagas Saputra',orangTua:'Putra Bpk. Dedi & Ibu Lestari'}];

function blokCover(v,ctx){
 const d=ctx.data,p=pasangan(d),tk=ctx.tk;
 const mono=tk.char?'<div class="k-mono">'+esc(tk.char)+'</div>':'';
 const nama='<div class="k-nama"><span>'+esc(p[0].nama)+'</span><i>&</i><span>'+esc(p[1].nama)+'</span></div>';
 const meta='<div class="k-tanggal">'+esc(d.tanggal||'Sabtu, 14 Februari 2027')+'<em>'+esc(d.jam||'10.00 WIB')+'</em></div>';
 if(v==='split')return '<div class="k-cvsplit">'+mono+nama+meta+'</div>';
 if(v==='arch')return '<div class="k-cvarch">'+mono+'<div class="k-archframe">'+nama+meta+'</div></div>';
 if(v==='segel')return '<div class="k-cvsegel">'+mono+'<div class="k-segel">✦</div>'+nama+meta+'</div>';
 if(v==='jendela')return '<div class="k-cvjendela"><div class="k-pita">'+nama+'</div>'+meta+'</div>';
 return mono+nama+meta;
}
function blokTamu(v,ctx){
 const d=ctx.data;
 if(v==='inline')return '<p class="k-to">Kepada <b>'+esc(d.tamu||'Bapak/Ibu/Saudara/i')+'</b></p><p class="k-muted">Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir.</p>';
 return '<div class="k-card"><div class="k-kicker">Kepada Yth</div><div class="k-to">'+esc(d.tamu||'Bapak/Ibu/Saudara/i')+'</div>'+ornaman()+'<p class="k-muted">Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir memberikan doa restu.</p></div>';
}
function blokDoa(v,ctx){
 const d=ctx.data,q=d.doa||{ar:'بَارَكَ اللهُ لَكَ وَبَارَكَ عَلَيْكَ',latin:'Barakallahu laka wa baraka ‘alaika',arti:'Semoga Allah memberkahimu dan mempertemukan kalian dalam kebaikan.'};
 const dalam='<p class="k-ar">'+esc(q.ar)+'</p><p class="k-latin">'+esc(q.latin)+'</p><p class="k-muted">'+esc(q.arti)+'</p>';
 return v==='polos'?dalam:'<div class="k-card k-doacard">'+ornaman()+dalam+'</div>';
}
function blokProfil(v,ctx){
 const p=pasangan(ctx.data);
 const kartu=p.map(x=>'<div class="k-orang"><div class="k-orang-nama">'+esc(x.nama)+'</div><div class="k-orang-ot">'+esc(x.orangTua||'')+'</div>'+(x.insta?'<div class="k-orang-ig">'+esc(x.insta)+'</div>':'')+'</div>').join('');
 if(v==='side')return '<div class="k-side">'+kartu+'</div>';
 if(v==='kartu')return '<div class="k-card">'+kartu+'</div>';
 return '<div class="k-stack">'+kartu+'</div>';
}
function blokHarapan(v,ctx){
 const t=ctx.data.harapan||'Dengan segala kerendahan hati, kami mohon doa restu Bapak/Ibu/Saudara/i agar acara ini berjalan lancar dan kehidupan kami dipenuhi keberkahan.';
 return v==='kutip'?'<blockquote class="k-kutipsi">'+esc(t)+'</blockquote>':'<p class="k-paragraf">'+esc(t)+'</p>';
}
function blokAcara(v,ctx){
 const d=ctx.data,akad=d.akad||{label:'Akad Nikah',waktu:'10.00 WIB',tempat:'Gedung Serbaguna, Jl. Asia Afrika No. 8'},resepsi=d.resepsi||{label:'Resepsi',waktu:'13.00 WIB',tempat:'Gedung Serbaguna, Jl. Asia Africa No. 8'};
 const flip=ctx.ekstra.includes('jamFlip')?'<div class="k-flip"><span>10</span><b>:</b><span>00</span><i>WIB</i></div>':'';
 const isi=[akad,resepsi].map(x=>'<div class="k-acara"><div class="k-acara-label">'+esc(x.label)+'</div><div class="k-acara-waktu">'+esc(x.waktu)+'</div><div class="k-acara-tempat">'+esc(x.tempat)+'</div></div>').join('');
 if(v==='baris')return '<div class="k-baris">'+isi+flip+'</div>';
 return '<div class="k-card">'+isi+flip+'</div>';
}
function blokTimeline(v,ctx){
 const items=(ctx.data.timeline||[{waktu:'09.30',judul:'Tamu datang'},{waktu:'10.00',judul:'Akad nikah'},{waktu:'13.00',judul:'Resepsi'},{waktu:'21.00',judul:'Closing'}]);
 if(v==='horizontal')return '<div class="k-tl-h">'+items.map(x=>'<div class="k-tlh"><b>'+esc(x.waktu)+'</b><span>'+esc(x.judul)+'</span></div>').join('')+'</div>';
 return '<div class="k-tl">'+items.map(x=>'<div class="k-tlv"><i></i><div><b>'+esc(x.waktu)+'</b><span>'+esc(x.judul)+'</span></div></div>').join('')+'</div>';
}
function blokCerita(v,ctx){
 const t=ctx.data.cerita||'Berawal dari satu kursi kosong di kafe sudut, berlanjut ke buku-buku yang sama-sama dipinjam, dan berujung pada dua cincin yang kini melambangkan janji.';
 if(v==='teks')return '<p class="k-paragraf k-cerita">'+esc(t)+'</p>';
 return '<div class="k-card"><div class="k-foto" style="--f1:var(--k-g2);--f2:var(--k-g3)"></div><p class="k-paragraf">'+esc(t)+'</p></div>';
}
function blokKutip(besar,ctx){
 const q=(ctx.data.quote)||{text:'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan untukmu.',author:'QS. Ar-Rum: 21'};
 return '<blockquote class="k-kutip'+(besar?' k-kutip-besar':'')+'"><span aria-hidden="true">❝</span><p>'+esc(q.text)+'</p>'+(q.author?'<cite>— '+esc(q.author)+'</cite>':'')+'</blockquote>';
}
function blokMenu(v,ctx){
 const m=ctx.data.menu||['Nasi goreng kampung','Sate lilit','Gado-gado','Es teh manis','Kue lapis'];
 if(v==='kartu')return '<div class="k-card"><div class="k-kicker">Menu</div>'+m.map(x=>'<div class="k-menuitem">'+esc(x)+'</div>').join('')+'</div>';
 return '<div class="k-card"><div class="k-kicker">Menu</div><ul>'+m.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';
}
function blokPanitia(v,ctx){
 const p=ctx.data.panitia||[{nama:'Ratna',jabatan:'Ketua'},{nama:'Dedi',jabatan:'Sekretaris'},{nama:'Sari',jabatan:'Bendahara'}];
 if(v==='baris')return '<div class="k-panitia-b">'+p.map(x=>'<div><b>'+esc(x.nama)+'</b><span>'+esc(x.jabatan)+'</span></div>').join('')+'</div>';
 return '<div class="k-panitia">'+p.map(x=>'<div class="k-card"><b>'+esc(x.nama)+'</b><span>'+esc(x.jabatan)+'</span></div>').join('')+'</div>';
}
function blokDress(v,ctx){
 const t=ctx.data.dress||'Batik modern, warna bebas';
 return v==='kartu'?'<div class="k-card"><div class="k-kicker">Dress Code</div><p>'+esc(t)+'</p></div>':'<div class="k-strip">'+esc(t)+'</div>';
}
function blokPeta(v,ctx){
 const a=ctx.data.alamat||'Gedung Serbaguna, Jl. Asia Afrika No. 8, Bandung';
 if(v==='alamat')return '<div class="k-card"><div class="k-kicker">Lokasi</div><p>'+esc(a)+'</p></div>';
 return '<div class="k-peta" role="img" aria-label="Peta lokasi: '+esc(a)+'"><span>📍 '+esc(a)+'</span></div>';
}
function blokKado(v,ctx){
 const k=ctx.data.kado||[{bank:'BCA',nama:'Alya Putri',no:'1234 5678 90'},{bank:'Mandiri',nama:'Bagas Saputra',no:'0987 6543 21'}];
 const isi='<div class="k-card"><div class="k-kicker">Alamat Kado</div>'+k.map(x=>'<div class="k-kado"><b>'+esc(x.bank)+'</b> — a.n. '+esc(x.nama)+'<br><code>'+esc(x.no)+'</code></div>').join('')+'</div>';
 return v==='baris'?'<div class="k-baris">'+isi+'</div>':isi;
}
function blokRsvp(v,ctx){
 const wa=ctx.data.rsvpWa||'6285196755675';
 if(v==='formulir')return '<div class="k-card"><div class="k-kicker">RSVP</div><div class="k-form"><div class="k-field">Nama</div><div class="k-field">Jumlah tamu</div><div class="k-field">Kehadiran</div></div></div>';
 return '<a class="k-rsvp" href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener">Konfirmasi Kehadiran</a>';
}
function blokTutup(v,ctx){
 return v==='hias'?ornaman()+'<p class="k-muted">Sampai berjumpa di hari bahagia kami 🤍</p>':'<p class="k-muted">Sampai berjumpa di hari bahagia kami 🤍</p>';
}
function blokBukutamu(v,ctx){
 return v==='garis'?'<div class="k-garis"></div><p class="k-muted">Tulis pesan untuk mempelai di buku tamu.</p>':'<div class="k-card"><div class="k-kicker">Buku Tamu</div><p class="k-muted">Tulis pesan untuk mempelai di sini.</p></div>';
}
function blokGaleri(v,ctx){
 const n=ctx.data.galeriCount||6;
 const sel='<div class="k-gal-'+v+'">'+Array.from({length:n},(_,i)=>'<div class="k-foto" style="--f1:hsl('+(i*47%360)+' 40% 72%);--f2:hsl('+((i*47+40)%360)+' 45% 62%)"><span>Momen '+(i+1)+'</span></div>').join('')+'</div>';
 return '<div class="k-galeri">'+sel+'</div>';
}
function blokAmplop(v,ctx){
 return '<div class="k-card"><div class="k-kicker">Amplop Digital</div><p class="k-muted">Doa restu adalah hadiah terbaik. Bila berkenan memberi amplop, tersedia di meja penerima tamu.</p></div>';
}
function blokUcapan(v,ctx){
 const t='Merupakan kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir.';
 return v==='bingkai'?'<div class="k-card k-bingkai"><p>'+esc(t)+'</p></div>':'<p class="k-paragraf">'+esc(t)+'</p>';
}
function blokFooter(v,ctx){
 return '<footer class="k-footer">'+(v==='hias'?ornaman():'')+'<p>AsProject · Undangan Digital</p></footer>';
}
function blokHero(ctx){
 return '<figure class="k-hero"><div class="k-foto" style="--f1:var(--k-g2);--f2:var(--k-g3)"></div><figcaption>Momen berkesan</figcaption></figure>';
}
const BLOK_RENDER={tamu:blokTamu,doa:blokDoa,profil:blokProfil,harapan:blokHarapan,acara:blokAcara,timeline:blokTimeline,cerita:blokCerita,kutip:(v,ctx)=>blokKutip(false,ctx),menu:blokMenu,panitia:blokPanitia,dress:blokDress,peta:blokPeta,kado:blokKado,rsvp:blokRsvp,tutup:blokTutup,bukutamu:blokBukutamu,galeri:blokGaleri,amplop:blokAmplop,ucapan:blokUcapan};

function renderUndangan(tpl,data){
 const tk=TK[tpl.token]||TK['ivory-klasik'];
 const sus=susunanArray(tpl);
 const blok=tpl.blok||{};
 const keluarga=SHELL_KELUARGA[tpl.shell]||'lembar';
 const ekstra=tpl.ekstra||[];
 const ctx={tk,data:data||{},ekstra,blok,bab:0,ev:(data&&data.ev)||'pernikahan'};
 let h='<div class="k-root k-shell-'+keluarga+'" style="'+cssToken(tk)+'">';
 if(ekstra.includes('navDot'))h+='<nav class="k-navdot" aria-label="Navigasi bagian">'+sus.map((k,i)=>'<a href="#kb-'+i+'"><i></i></a>').join('')+'</nav>';
 sus.forEach((k,i)=>{
  if(k==='cover'){h+='<header class="k-blok k-cover k-blok--'+(blok.cover&&blok.cover.varian||'klasik')+'" id="kb-'+i+'">'+blokCover(blok.cover&&blok.cover.varian||'klasik',ctx)+'</header>';return}
  if(k==='footer'){h+=blokFooter((blok.footer&&blok.footer.varian)||'hias',ctx);return}
  let v=(blok[k]&&blok[k].varian)||BK[k].def;
  /* ekstra bisa menimpa varian blok (setara renderer lama:
     galeriStrip menambah kelas lay-strip pada bagian galeri) */
  if(ekstra.includes('galeriStrip')&&k==='galeri')v='strip';
  const fn=BLOK_RENDER[k];
  let cls='k-blok k-blok-'+k+' k-blok--'+v,sisip='';
  if(ekstra.includes('babAngka')){ctx.bab++;sisip+='<i class="k-bab" aria-hidden="true">'+ROMAWI[ctx.bab]+'</i>'}
  if(ekstra.includes('kutipBesar')&&k==='profil')sisip+=blokKutip(true,ctx);
  if(ekstra.includes('heroFoto')&&k==='acara')sisip+=blokHero(ctx);
  h+='<section class="'+cls+'" id="kb-'+i+'">'+sisip+(fn?fn(v,ctx):'')+'</section>';
 });
 h+='</div>';
 return h;
}

/* Data contoh untuk pratinjau demo. */
const DATA_CONTOH={
 ev:'pernikahan',
 tamu:'Bapak & Ibu Hendra Gunawan',
 tanggal:'Sabtu, 14 Februari 2027',jam:'10.00 WIB',
 pasangan:[{nama:'Alya Putri Ramadhani',orangTua:'Putri ketiga Bpk. Ratna & Ibu Sari',insta:'@alyaputri'},{nama:'Bagas Saputra Nugraha',orangTua:'Putra Bpk. Dedi & Ibu Lestari',insta:'@bagassaputra'}],
 doa:{ar:'بَارَكَ اللهُ لَكَ وَبَارَكَ عَلَيْكَ وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ',latin:'Barakallahu laka wa baraka ‘alaika wa jama’a bainakuma fi khair',arti:'Semoga Allah memberkahimu, memberi keberkahan atasmu, dan mempertemukan kalian berdua dalam kebaikan.'},
 akad:{label:'Akad Nikah',waktu:'10.00 WIB',tempat:'Gedung Serbaguna, Jl. Asia Afrika No. 8, Bandung'},
 resepsi:{label:'Resepsi',waktu:'13.00 WIB',tempat:'Gedung Serbaguna, Jl. Asia Afrika No. 8, Bandung'},
 alamat:'Gedung Serbaguna, Jl. Asia Afrika No. 8, Bandung',
 timeline:[{waktu:'09.30',judul:'Tamu datang & registrasi'},{waktu:'10.00',judul:'Akad nikah'},{waktu:'12.30',judul:'Sungkeman & foto bersama'},{waktu:'13.00',judul:'Resepsi & santap bersama'},{waktu:'21.00',judul:'Penutup'}],
 cerita:'Berawal dari satu kursi kosong di kafe sudut, berlanjut ke buku-buku yang sama-sama dipinjam, dan berujung pada dua cincin yang kini melambangkan janji.',
 quote:{text:'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu.',author:'QS. Ar-Rum: 21'},
 menu:['Nasi goreng kampung','Sate lilit','Gado-gado','Sop buntut','Es teh manis','Kue lapis'],
 panitia:[{nama:'Ratna',jabatan:'Ketua'},{nama:'Dedi',jabatan:'Sekretaris'},{nama:'Sari',jabatan:'Bendahara'}],
 dress:'Batik modern, warna bebas',
 kado:[{bank:'BCA',nama:'Alya Putri',no:'1234 5678 90'},{bank:'Mandiri',nama:'Bagas Saputra',no:'0987 6543 21'}],
 rsvpWa:'6285196755675',galeriCount:6
};

if(typeof module!=='undefined')module.exports={susunanArray,presetDariSusunan,cariLayoutLama,kompilasiLama,turunkan,renderUndangan,DATA_CONTOH,SHELL_KELUARGA,FONT_FAM,esc};
