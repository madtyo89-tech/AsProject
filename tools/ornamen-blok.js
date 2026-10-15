/* ===== Ornamen SVG per tema =====
   Deretan simbol Unicode di field deco (mis. "X . X") diganti motif yang
   benar-benar digambar untuk divider dan footer. Field deco TETAP diisi dan
   tetap dipakai sebagai fallback, jadi undangan lama yang belum menyimpan
   orn tampil persis seperti sebelumnya -- tidak ada yang rusak.
   Semua motif memakai currentColor supaya otomatis ikut warna divider tema. */

/* Kelopak/daun tunggal: ellipse yang diputar mengelilingi titik jangkar. */
function ornDaun(cx,cy,rx,ry,rot,op){
 return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="currentColor"'+
  ' transform="rotate('+rot+' '+cx+' '+cy+')" opacity="'+(op==null?.8:op)+'"/>';
}
/* Roset: n kelopak tersebar merata mengelilingi pusat -- dijamin simetris. */
function ornRoset(cx,cy,n,rx,ry,jarak,op){
 let s='';
 for(let i=0;i<n;i++){
  const a=i*360/n, rad=a*Math.PI/180;
  const px=cx+Math.cos(rad)*jarak, py=cy+Math.sin(rad)*jarak;
  s+=ornDaun(px.toFixed(1),py.toFixed(1),rx,ry,a.toFixed(1),op);
 }
 return s;
}
/* Sinar memancar dari pusat, untuk motif art-deco dan bintang. */
function ornSinar(cx,cy,n,r1,r2,w,op){
 let s='';
 for(let i=0;i<n;i++){
  const a=i*360/n, rad=a*Math.PI/180;
  s+='<line x1="'+(cx+Math.cos(rad)*r1).toFixed(1)+'" y1="'+(cy+Math.sin(rad)*r1).toFixed(1)+
     '" x2="'+(cx+Math.cos(rad)*r2).toFixed(1)+'" y2="'+(cy+Math.sin(rad)*r2).toFixed(1)+
     '" stroke="currentColor" stroke-width="'+w+'" stroke-linecap="round" opacity="'+op+'"/>';
 }
 return s;
}
const ORN_GARIS=(d,w,op)=>'<path d="'+d+'" fill="none" stroke="currentColor" stroke-width="'+
 (w==null?1.3:w)+'" stroke-linecap="round" opacity="'+(op==null?.9:op)+'"/>';
function ornBungkus(isi){
 return '<svg viewBox="0 0 168 28" fill="none" aria-hidden="true" '+
  'style="width:132px;height:22px;display:block">'+isi+'</svg>';
}

const ORNAMEN={
 /* Gulungan simetris bertemu intan di tengah -- ornamen undangan klasik. */
 klasik:()=>ornBungkus(
   ORN_GARIS('M84 14c-7-8-16-9-25-4-5.5 3-8.5 8-6 11 2 2.4 6.4 1.4 7-1.6.4-2.2-2.2-3.6-4-1.8',1.3,.85)+
   ORN_GARIS('M84 14c7-8 16-9 25-4 5.5 3 8.5 8 6 11-2 2.4-6.4 1.4-7-1.6-.4-2.2 2.2-3.6 4-1.8',1.3,.85)+
   '<path d="M84 7l4.2 7-4.2 7-4.2-7Z" fill="currentColor"/>'+
   '<circle cx="60" cy="14" r="1.5" fill="currentColor" opacity=".6"/>'+
   '<circle cx="108" cy="14" r="1.5" fill="currentColor" opacity=".6"/>'),

 /* Dua tangkai berdaun melengkung keluar dari kuncup tengah. */
 botanical:()=>ornBungkus(
   ORN_GARIS('M84 14c-10 0-20 2-30 8',1.2,.7)+ORN_GARIS('M84 14c10 0 20 2 30 8',1.2,.7)+
   ornDaun(66,17,7,3,-24,.75)+ornDaun(56,20,6,2.6,-30,.6)+
   ornDaun(102,17,7,3,24,.75)+ornDaun(112,20,6,2.6,30,.6)+
   '<path d="M84 6c4 3 4 8 0 11-4-3-4-8 0-11Z" fill="currentColor"/>'+
   '<circle cx="84" cy="20" r="1.8" fill="currentColor" opacity=".7"/>'),

 /* Bintang delapan khas arabesque dengan lengkungan saling silang. */
 arabesque:()=>ornBungkus(
   '<rect x="76" y="6" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".9"/>'+
   '<rect x="76" y="6" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".9" transform="rotate(45 84 14)"/>'+
   '<circle cx="84" cy="14" r="2.6" fill="currentColor"/>'+
   ORN_GARIS('M70 14c-6-6-14-7-22-3',1.2,.75)+ORN_GARIS('M70 14c-6 6-14 7-22 3',1.2,.55)+
   ORN_GARIS('M98 14c6-6 14-7 22-3',1.2,.75)+ORN_GARIS('M98 14c6 6 14 7 22 3',1.2,.55)+
   '<circle cx="46" cy="14" r="1.6" fill="currentColor" opacity=".6"/>'+
   '<circle cx="122" cy="14" r="1.6" fill="currentColor" opacity=".6"/>'),

 /* Kipas art-deco: sinar memancar diapit batang bertingkat. */
 deco:()=>ornBungkus(
   ornSinar(84,20,9,3,15,1.2,.8)+
   ORN_GARIS('M62 20h10M96 20h10',1.6,.9)+
   ORN_GARIS('M50 20h8M110 20h8',1.6,.65)+
   ORN_GARIS('M40 20h6M122 20h6',1.6,.45)+
   '<circle cx="84" cy="20" r="2.4" fill="currentColor"/>'),

 /* Confetti: titik dan bintang tersebar, nada ceria. */
 confetti:()=>{
  let s='';
  const titik=[[30,10,2],[46,19,1.5],[62,8,1.8],[100,9,1.6],[118,18,2],[136,11,1.5],[74,21,1.3],[94,21,1.3]];
  titik.forEach(([x,y,r],i)=>{s+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="currentColor" opacity="'+(.45+i%3*.2).toFixed(2)+'"/>'});
  s+='<path d="M84 5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9-4.3-4.1 5.9-.8Z" fill="currentColor"/>';
  return ornBungkus(s);
 },

 /* Untaian mutiara: lingkaran bergradasi dengan tetesan di tengah. */
 mutiara:()=>{
  let s='';
  const r=[1.2,1.7,2.3,3,3.6];
  r.forEach((rad,i)=>{
   s+='<circle cx="'+(84-14*(i+1))+'" cy="14" r="'+rad+'" fill="currentColor" opacity="'+(.9-i*.1).toFixed(2)+'"/>';
   s+='<circle cx="'+(84+14*(i+1))+'" cy="14" r="'+rad+'" fill="currentColor" opacity="'+(.9-i*.1).toFixed(2)+'"/>';
  });
  s+='<path d="M84 5c4.6 5 6.4 8.2 6.4 10.6A6.4 6.4 0 0 1 84 22a6.4 6.4 0 0 1-6.4-6.4C77.6 13.2 79.4 10 84 5Z" fill="currentColor"/>';
  return ornBungkus(s);
 },

 /* Awan lembut dengan bintang kecil -- nuansa bayi. */
 awan:()=>ornBungkus(
   '<path d="M40 20a6 6 0 0 1 1.4-11.7A8.4 8.4 0 0 1 57.6 9 5.6 5.6 0 0 1 58 20Z" fill="currentColor" opacity=".55"/>'+
   '<path d="M110 20a6 6 0 0 1 1.4-11.7A8.4 8.4 0 0 1 127.6 9 5.6 5.6 0 0 1 128 20Z" fill="currentColor" opacity=".55"/>'+
   '<path d="M84 6l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2Z" fill="currentColor"/>'+
   '<circle cx="70" cy="20" r="1.4" fill="currentColor" opacity=".5"/><circle cx="98" cy="20" r="1.4" fill="currentColor" opacity=".5"/>'),

 /* Tiga kuntum bunga berkelopak lima dengan tangkai. */
 bunga:()=>{
  const kuntum=(cx,cy,sk,op)=>ornRoset(cx,cy,5,4.4*sk,2*sk,3.4*sk,op)+
   '<circle cx="'+cx+'" cy="'+cy+'" r="'+(1.7*sk)+'" fill="currentColor"/>';
  return ornBungkus(
   ORN_GARIS('M84 24v-6M60 24c2-5 6-8 12-9M108 24c-2-5-6-8-12-9',1.1,.6)+
   kuntum(84,11,1.15,.9)+kuntum(60,15,.8,.7)+kuntum(108,15,.8,.7));
 },

 /* Bintang heraldik bersinar diapit dua lengkung laurel. */
 bintang:()=>ornBungkus(
   ornSinar(84,14,12,7,13,.9,.5)+
   '<path d="M84 3l3.4 7.2 7.8 1-5.7 5.4 1.5 7.8-7-3.8-7 3.8 1.5-7.8-5.7-5.4 7.8-1Z" fill="currentColor"/>'+
   ORN_GARIS('M66 20c-8-2-14 0-20 5',1.4,.8)+ORN_GARIS('M102 20c8-2 14 0 20 5',1.4,.8)+
   ornDaun(56,21,4.4,1.9,-20,.6)+ornDaun(112,21,4.4,1.9,20,.6)),

 /* Onyx: chevron dan intan bersudut tajam, kesan mewah gelap. */
 onyx:()=>{
  let s='<path d="M84 4l7 10-7 10-7-10Z" fill="currentColor"/>';
  for(let i=1;i<=3;i++){
   const o=(1-i*.24).toFixed(2), k=i*11;
   s+=ORN_GARIS('M'+(77-k)+' 8l-6 6 6 6',1.8,o)+ORN_GARIS('M'+(91+k)+' 8l6 6-6 6',1.8,o);
  }
  return ornBungkus(s);
 },

 /* Kawung: empat ellips saling tumpang mengelilingi pusat, motif batik. */
 batik:()=>ornBungkus(
   ornRoset(84,14,4,7.5,4,7,.55)+
   '<circle cx="84" cy="14" r="2.6" fill="currentColor"/>'+
   ORN_GARIS('M62 14h-16M106 14h16',1.1,.5)+
   '<circle cx="42" cy="14" r="1.7" fill="currentColor" opacity=".5"/>'+
   '<circle cx="126" cy="14" r="1.7" fill="currentColor" opacity=".5"/>'),

 /* Mawar: spiral kelopak dengan dua daun. */
 mawar:()=>ornBungkus(
   '<path d="M84 14a3.2 3.2 0 1 1 3.2-3.2 6 6 0 1 1-6 6 8.6 8.6 0 1 0 8.6-8.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'+
   ORN_GARIS('M74 16c-8 1-14 4-18 8M94 16c8 1 14 4 18 8',1.1,.6)+
   ornDaun(60,19,6.4,2.8,-18,.7)+ornDaun(108,19,6.4,2.8,18,.7)),

 /* Geometrik: garis dan bujur sangkar modern, minimal tanpa lengkungan. */
 geometrik:()=>{
  let s='<rect x="79" y="9" width="10" height="10" fill="currentColor"/>';
  for(let i=1;i<=4;i++){
   const o=(1-i*.2).toFixed(2), x=i*11;
   s+='<rect x="'+(79-x)+'" y="'+(9+i)+'" width="'+(10-i*2)+'" height="'+(10-i*2)+
      '" fill="none" stroke="currentColor" stroke-width="1" opacity="'+o+'"/>';
   s+='<rect x="'+(89+x-10+i*2)+'" y="'+(9+i)+'" width="'+(10-i*2)+'" height="'+(10-i*2)+
      '" fill="none" stroke="currentColor" stroke-width="1" opacity="'+o+'"/>';
  }
  return ornBungkus(s);
 },

 /* Kembang api: tiga letupan sinar berbeda ukuran. */
 'kembang-api':()=>ornBungkus(
   ornSinar(84,13,10,2.5,12,1.1,.85)+
   ornSinar(48,17,8,1.5,7,.9,.55)+
   ornSinar(120,17,8,1.5,7,.9,.55)+
   '<circle cx="84" cy="13" r="2.2" fill="currentColor"/>'+
   '<circle cx="48" cy="17" r="1.5" fill="currentColor" opacity=".7"/>'+
   '<circle cx="120" cy="17" r="1.5" fill="currentColor" opacity=".7"/>'),

 /* Bulan sabit dan bintang -- ornamen islami. */
 bulan:()=>ornBungkus(
   '<path d="M90 4a11 11 0 1 0 0 20 13 13 0 0 1 0-20Z" fill="currentColor"/>'+
   '<path d="M70 8l1.8 4 4.2.6-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4.2-.6Z" fill="currentColor" opacity=".8"/>'+
   ORN_GARIS('M58 18c-6 0-12 1-16 4M112 18c6 0 12 1 16 4',1.1,.55)+
   '<circle cx="40" cy="22" r="1.4" fill="currentColor" opacity=".5"/>'+
   '<circle cx="130" cy="22" r="1.4" fill="currentColor" opacity=".5"/>'),

 /* Pita: simpul dengan dua ekor menjuntai. */
 pita:()=>ornBungkus(
   '<path d="M84 14c-5-6-13-8-18-5-4 2.4-3 8 2 9 5 1 11-1 16-4Z" fill="currentColor" opacity=".8"/>'+
   '<path d="M84 14c5-6 13-8 18-5 4 2.4 3 8-2 9-5 1-11-1-16-4Z" fill="currentColor" opacity=".8"/>'+
   '<ellipse cx="84" cy="14" rx="3.6" ry="3" fill="currentColor"/>'+
   ORN_GARIS('M81 17c-2 5-5 7-9 8M87 17c2 5 5 7 9 8',1.2,.7)),

 /* Zaitun: dua tangkai laurel melengkung bertemu di tengah. */
 zaitun:()=>{
  let s='';
  for(let i=0;i<4;i++){
   const t=i/3;
   s+=ornDaun((66-14*t).toFixed(1),(20-8*t).toFixed(1),5,2.1,(-30+i*8),.75-i*.1);
   s+=ornDaun((102+14*t).toFixed(1),(20-8*t).toFixed(1),5,2.1,(30-i*8),.75-i*.1);
  }
  return ornBungkus(
   ORN_GARIS('M80 22c-10 0-20-4-28-12',1.2,.7)+ORN_GARIS('M88 22c10 0 20-4 28-12',1.2,.7)+s+
   '<circle cx="84" cy="12" r="2.4" fill="currentColor"/>');
 },

 /* Mahkota: tiga puncak dengan permata. */
 mahkota:()=>ornBungkus(
   '<path d="M68 21l-4-13 9 6 11-11 11 11 9-6-4 13Z" fill="currentColor" opacity=".85"/>'+
   '<rect x="68" y="21" width="32" height="3.4" rx="1.4" fill="currentColor"/>'+
   '<circle cx="64" cy="7" r="1.8" fill="currentColor"/><circle cx="84" cy="3" r="2" fill="currentColor"/>'+
   '<circle cx="104" cy="7" r="1.8" fill="currentColor"/>'+
   ORN_GARIS('M56 22h-14M112 22h14',1.1,.5))
};

/* Motif ornamen untuk sebuah tema. Jatuh ke deretan simbol deco lama bila
   tema tidak punya orn atau id-nya tak dikenal -- aman untuk snapshot lama. */
function ornMotif(tplF){
 const id=tplF&&tplF.orn;
 if(id&&ORNAMEN[id]){try{return ORNAMEN[id]()}catch(e){/* motif gagal digambar */}}
 return null;
}
function ornIdValid(v){return typeof v==='string'&&Object.prototype.hasOwnProperty.call(ORNAMEN,v)}
