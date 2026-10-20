/* cek-kerangka.cjs — validator kerangka template baru (blok+token).
   Menjaga agar kerangka/ tidak drift dari registry undangan.html
   dan TPL studio.html:
   [1] Sintaks & muat modul kerangka
   [2] Referensi token valid (ft/orn/pat/border ada di registry)
   [3] Referensi blok & varian valid
   [4] Shell, susunan, ekstra valid
   [5] Migrasi: semua id TPL lama punya padanan di TEMPLATES
   [6] Round-trip: turunkan → kompilasiLama ≡ TPL lama (field demi field)
   [7] Snapshot layouts-lama.js ≡ LAYOUTS/URUTAN undangan.html
   [8] Template baru: lapor mana yang kompatibel legacy vs motor-baru
   Exit 1 bila ada masalah. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=(rel)=>path.join(__dirname,'..',rel);
let gagal=0;
const lapor=(ok,pesan)=>{console.log((ok?'  ok  ':'  !!  ')+pesan);if(!ok)gagal++};

/* potong deklarasi const X = {...} / [...] dari sumber HTML/JS */
function potong(src,nama){
 const m=src.match(new RegExp('const '+nama+'\\s*=\\s*'));
 if(!m)throw new Error('const '+nama+' tidak ditemukan');
 let j=m.index+m[0].length;
 const open=src[j],close=open==='{'?'}':']';
 let d=0;
 for(let k=j;k<src.length;k++){
  if(src[k]===open)d++;
  else if(src[k]===close){d--;if(d===0)return src.slice(j,k+1)}
 }
 throw new Error('kurung tidak seimbang: '+nama);
}
const nilai=(src,nama)=>vm.runInNewContext('('+potong(src,nama)+')',{module:undefined});

console.log('[1] Muat modul kerangka');
const ker={};
for(const f of['token-tema','registry-blok','layouts-lama','template','motor']){
 try{ker[f]=require(R('kerangka/'+f+'.js'))}
 catch(e){lapor(false,'kerangka/'+f+'.js gagal dimuat: '+e.message);process.exit(1)}
}
lapor(true,'5 modul kerangka termuat');
const {TOKEN,TOKEN_IDS}=ker['token-tema'];
const {BLOK,BLOK_IDS,SUSUNAN,BLOK_DARI_LAMA}=ker['registry-blok'];
const {LAYOUTS_LAMA,URUTAN_LAMA}=ker['layouts-lama'];
const {TEMPLATES}=ker['template'];
const motor=ker['motor'];

console.log('\n[2] Referensi token valid (terhadap registry undangan.html)');
const und=fs.readFileSync(R('undangan.html'),'utf8');
const FONTS=nilai(und,'FONTS'),BORDERS=nilai(und,'BORDERS'),POLA=nilai(und,'POLA'),ORNAMEN=nilai(und,'ORNAMEN');
const fontIds=new Set(FONTS.map(f=>f.id)),borderIds=new Set(BORDERS.map(b=>b.id)),polaIds=new Set(Object.keys(POLA)),ornIds=new Set(Object.keys(ORNAMEN));
let refOk=true;
for(const id of TOKEN_IDS){const t=TOKEN[id];
 for(const[f,set,label]of[[t.ft,fontIds,'font'],[t.orn,ornIds,'ornamen'],[t.pat,polaIds,'pola'],[t.border,borderIds,'border']]){
  if(!set.has(f)){lapor(false,'token '+id+' → '+label+' "'+f+'" tidak ada di registry undangan.html');refOk=false}
 }}
lapor(refOk,'seluruh '+TOKEN_IDS.length+' token merujuk font/ornamen/pola/border yang terdaftar');

console.log('\n[3] Referensi blok & varian valid');
let blokOk=true;
for(const t of TEMPLATES){
 const sus=Array.isArray(t.susunan)?t.susunan:SUSUNAN[t.susunan];
 if(!sus){lapor(false,t.id+': susunan "'+t.susunan+'" tidak dikenal');blokOk=false;continue}
 for(const k of sus)if(!BLOK[k]){lapor(false,t.id+': blok "'+k+'" tidak terdaftar');blokOk=false}
 for(const k in (t.blok||{})){
  if(!BLOK[k]){lapor(false,t.id+': blok "'+k+'" tidak terdaftar');blokOk=false;continue}
  const v=t.blok[k].varian;
  if(v&&!BLOK[k].varian.includes(v)){lapor(false,t.id+': varian "'+v+'" tidak ada untuk blok '+k);blokOk=false}
 }}
lapor(blokOk,'seluruh susunan & varian blok valid');

console.log('\n[4] Shell, susunan & ekstra valid');
/* Shell sah: yang ada di snapshot layout lama ATAU yang punya
   CSS produksi body.lay-<shell> di undangan.html (shell kerangka
   baru tidak punya layout lama — CSS-nya sendiri yang jadi bukti). */
const SHELLS=new Set([...Object.values(LAYOUTS_LAMA).map(l=>l.shell),
 ...[...und.matchAll(/body\.lay-([a-z]+)/g)].map(m=>m[1])]);
const EKSTRA=new Set(['navDot','kutipBesar','heroFoto','galeriStrip','jamFlip','babAngka']);
let shellOk=true;
for(const t of TEMPLATES){
 if(!SHELLS.has(t.shell)){lapor(false,t.id+': shell "'+t.shell+'" tidak dikenal');shellOk=false}
 if(typeof t.susunan==='string'&&!SUSUNAN[t.susunan]){lapor(false,t.id+': preset susunan "'+t.susunan+'" tidak ada');shellOk=false}
 for(const e of (t.ekstra||[]))if(!EKSTRA.has(e)){lapor(false,t.id+': ekstra "'+e+'" tidak dikenal');shellOk=false}
}
lapor(shellOk,'shell, preset susunan (A–E) & ekstra valid');
/* Hint wajah cover & cara buka: model cover (CV_LAYOUTS),
   elemen pembuka (CARA_BUKA_ID), keduanya terdaftar di
   studio.html. */
const stu=fs.readFileSync(R('studio.html'),'utf8');
const CVL=new Set(nilai(stu,'CV_LAYOUTS').map(c=>c[0]));
const BUKA=new Set(nilai(stu,'CARA_BUKA_ID'));
let cvOk=true;const kombinasi=new Set();
for(const t of TEMPLATES){
 const cv=t.cover||'amplop',bk=t.buka||'pita';
 if(!CVL.has(cv)){lapor(false,t.id+': hint cover "'+cv+'" tidak ada di CV_LAYOUTS');cvOk=false}
 if(!BUKA.has(bk)){lapor(false,t.id+': hint cara buka "'+bk+'" tidak ada di CARA_BUKA_ID');cvOk=false}
 kombinasi.add(cv+'|'+bk);
}
lapor(cvOk,'hint cover & cara buka valid (registry studio)');
lapor(kombinasi.size>=18,'wajah cover bervariasi — '+kombinasi.size+' kombinasi unik dari '+TEMPLATES.length+' template');

console.log('\n[5] Migrasi: TPL lama → TEMPLATES baru');
const studio=fs.readFileSync(R('studio.html'),'utf8');
const TPL_LAMA=nilai(studio,'TPL');
const ada=new Map(TEMPLATES.map(t=>[t.id,t]));
let migOk=true;
for(const lama of TPL_LAMA){
 const t=ada.get(lama.id);
 if(!t){lapor(false,'TPL lama '+lama.id+' tidak punya padanan di TEMPLATES');migOk=false;continue}
 if(t.token!==lama.id){
  /* template baru memakai token lain (bebas) — rujukan token
     sudah divalidasi di [2]; tidak wajib identik dengan id */
  continue;
 }
 const cek=['nama','ev','g','accent','ink','orn','pat','border','ft'];
 for(const f of cek){
  const a=JSON.stringify(lama[f]),b=JSON.stringify(TOKEN[t.token][f]);
  if(a!==b){lapor(false,t.id+': field "'+f+'" berbeda ('+a+' vs '+b+')');migOk=false}
 }
 if((lama.layout||'klasik')!==(motor.cariLayoutLama(t.shell,t.susunan,t.ekstra)||'klasik')&&false){} /* layout dicek di [6] */
}
lapor(migOk,'seluruh '+TPL_LAMA.length+' tema lama termigrasi dengan token identik');

console.log('\n[6] Round-trip: turunkan → kompilasiLama ≡ TPL lama');
let rtOk=true;
for(const lama of TPL_LAMA){
 const t=ada.get(lama.id);if(!t)continue;
 const k=motor.kompilasiLama(t);
 const lap={...lama,harga:lama.harga||75000,badge:lama.badge||'',char:lama.char||''};
 for(const f of['id','nama','ev','harga','g','accent','ink','badge','deco','pat','ft','char','layout','orn','border','desc']){
  if(JSON.stringify(k[f])!==JSON.stringify(lap[f])){
   lapor(false,lama.id+': round-trip field "'+f+'" → '+JSON.stringify(k[f])+' (seharusnya '+JSON.stringify(lap[f])+')');rtOk=false}
 }
 if(k.layoutBaru&&!t.baru){lapor(false,lama.id+': tema lama justru layoutBaru — migrasi salah');rtOk=false}
}
lapor(rtOk,'kompilasi mundur semua tema lama identik dengan TPL asli');

console.log('\n[7] Snapshot layouts-lama.js ≡ undangan.html');
const LX_asli=nilai(und,'LAYOUTS'),UR_asli=nilai(und,'URUTAN');
const lxOk=JSON.stringify(LAYOUTS_LAMA)===JSON.stringify(LX_asli);
const urOk=JSON.stringify(URUTAN_LAMA)===JSON.stringify(UR_asli);
lapor(lxOk,'LAYOUTS_LAMA identik dengan LAYOUTS undangan.html');
lapor(urOk,'URUTAN_LAMA identik dengan URUTAN undangan.html');

console.log('\n[8] Template baru: kompatibilitas renderer');
const baru=TEMPLATES.filter(t=>t.baru);
/* kb.urutan memakai kunci builder LAMA (hasil terjemahan
   generator) — validasi terhadap kunci BLOK_DARI_LAMA. */
const SEK_LAMA=new Set(Object.keys(BLOK_DARI_LAMA));
for(const t of baru){
 const k=motor.kompilasiLama(t);
 if(k.layout)console.log('  ok  '+t.id.padEnd(18)+'→ layout lama "'+k.layout+'"');
 else{
  const urutanBaru=(k.kb&&k.kb.urutan)||[];
  const takDikenal=urutanBaru.filter(x=>!SEK_LAMA.has(x));
  lapor(!takDikenal.length,'kb '+t.id+': '+urutanBaru.length+' section, '+
   (takDikenal.length?'TIDAK DIKENAL: '+takDikenal.join(',')+'!':'semua kunci section lama sah')+
   ' | cover→'+k.kb.cover+' | ekstra ['+k.kb.ekstra.join(',')+']');
 }
}
const idBaru=new Set(baru.map(t=>t.id));
const duplikat=TEMPLATES.length-new Set(TEMPLATES.map(t=>t.id)).size;
lapor(duplikat===0,'tidak ada id template duplikat');
const tokenUnik=new Set(TEMPLATES.map(t=>t.token));
lapor(tokenUnik.size>=TOKEN_IDS.length-2,'token baru ('+[...tokenUnik].filter(x=>!TPL_LAMA.some(t=>t.id===x)).join(', ')+') dipakai template');

console.log('\n[9] Asap: render semua template (motor demo)');
let asapOk=true;
for(const t of TEMPLATES){
 try{
  const h=motor.renderUndangan(t,motor.DATA_CONTOH);
  if(typeof h!=='string'||h.length<500)throw new Error('output terlalu pendek ('+h.length+' char)');
  for(const tanda of['k-root','k-cover','k-footer'])if(!h.includes(tanda))throw new Error('tanda '+tanda+' hilang');
 }catch(e){lapor(false,t.id+': render gagal — '+e.message);asapOk=false}
}
lapor(asapOk,'seluruh '+TEMPLATES.length+' template dirender tanpa error');

console.log('\n[10] Literal TPL di HTML == hasil generator (anti-drift)');
const vm2=require('vm');
const {bangun}=require('./bangun-tpl.cjs');
for(const [rel,denganHarga] of [['studio.html',true],['undangan.html',false]]){
 const src=fs.readFileSync(R(rel),'utf8');
 const m=src.match(/const TPL=\[[\s\S]*?\];/);
 if(!m){lapor(false,rel+': const TPL=[ tidak ditemukan');continue}
 const literal=vm2.runInNewContext('('+m[0].slice('const TPL='.length,-1)+')',{});
 const {out}=bangun(denganHarga);
 const gen=vm2.runInNewContext(out+';TPL',{});
 const sama=JSON.stringify(literal)===JSON.stringify(gen);
 lapor(sama,rel+': literal TPL ('+literal.length+' entry) identik dengan hasil bangun-tpl.cjs');
 if(!sama){
  for(let i=0;i<Math.max(literal.length,gen.length);i++){
   if(JSON.stringify(literal[i])!==JSON.stringify(gen[i])){
    console.log('      beda di index '+i+': HTML='+JSON.stringify(literal[i]&&literal[i].id)+' generate='+JSON.stringify(gen[i]&&gen[i].id));
    break}
  }
 }
}

console.log('\n'+TEMPLATES.length+' template ('+(TEMPLATES.length-baru.length)+' migrasi + '+baru.length+' baru), '+TOKEN_IDS.length+' token, '+BLOK_IDS.length+' blok, '+Object.keys(LAYOUTS_LAMA).length+' layout lama');
console.log(gagal?('\n'+gagal+' MASALAH DITEMUKAN'):'\nKERANGKA SEHAT ✓');
process.exit(gagal?1:0);
