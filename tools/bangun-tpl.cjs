/* bangun-tpl.cjs — generator literal TPL dari kerangka/ (single source
   of truth) ke studio.html & undangan.html.

   Aturan:
   - Hanya template yang kompilasinya punya layout lama (renderer
     undangan.html yang ada bisa merendernya) yang masuk produksi.
     Template khusus motor baru (layoutBaru) TIDAK ditulis —
     menunggu integrasi renderer motor baru.
   - Entry baru SELALU di akhir array (konvensi repo): index Supabase
     kolom 'theme' untuk tema lama tidak berubah.
   - studio.html: entry lengkap dengan harga.
     undangan.html: tanpa harga (renderer live tidak memakainya).
   - Field opsional (char,badge,arch,studioOnly) hanya ditulis bila
     ada/nilai true — meniru gaya TPL lama.

   Jalankan: node tools/bangun-tpl.cjs  ( lalu cek dengan
   node tools/cek-kerangka.cjs & python3 tools/cek-kesehatan.py ) */
const fs=require('fs'),path=require('path');
const R=(rel)=>path.join(__dirname,'..',rel);
const {TEMPLATES}=require(R('kerangka/template.js'));
const motor=require(R('kerangka/motor.js'));

/* Serialisasi gaya manual (quote tunggal) supaya output
   mirip gaya file lama & mudah dibaca di git diff. */
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const arr=a=>'['+a.map(q).join(',')+']';
function entry(t,denganHarga){
 const k=motor.kompilasiLama(t);
 const f=[];
 f.push('id:'+q(k.id),'nama:'+q(k.nama),'ev:'+q(k.ev));
 if(denganHarga&&t.harga!=null)f.push('harga:'+k.harga);
 f.push('g:'+arr(k.g),'accent:'+q(k.accent),'ink:'+q(k.ink));
 if(k.badge)f.push('badge:'+q(k.badge));
 f.push('deco:'+q(k.deco),'pat:'+q(k.pat),'ft:'+q(k.ft));
 if(k.char)f.push('char:'+q(k.char));
 if(k.desc)f.push('desc:'+q(k.desc));
 f.push('layout:'+(k.layout?q(k.layout):'null'),'orn:'+q(k.orn),'border:'+q(k.border));
 f.push('cover:'+q(k.cover||'amplop'),'buka:'+q(k.buka||'pita'));
 if(k.kb)f.push('kb:'+JSON.stringify(k.kb));
 if(k.arch)f.push('arch:true');
 if(k.studioOnly)f.push('studioOnly:true');
 return ' {'+f.join(',');
}
function bangun(denganHarga){
 /* SEMUA template masuk produksi. Template yang kombinasinya
    setara preset layout lama mendapat `layout` (renderer
    lama memakainya langsung); kombinasi bebas mendapat
    `layout:null` + metadata `kb` (shell, urutan section
    lama, ekstra, hint cover) untuk jalur kerangka di
    renderer. */
 const masuk=TEMPLATES.map(t=>({t,k:motor.kompilasiLama(t)}));
 const pub=masuk.filter(x=>!x.t.studioOnly).length;
 /* 18 tema awal disatukan dalam satu baris (meniru gaya lama),
    sisanya (Gerbang & tema baru) satu entry per baris. */
 const batas=masuk.findIndex(x=>x.t.arch||x.t.baru||x.t.studioOnly);
 const satuBaris=masuk.slice(0,batas>0?batas:masuk.length);
 let out='/* DIBANGKITKAN tools/bangun-tpl.cjs — JANGAN EDIT MANUAL.\n'
  +'   Sumber kebenaran: kerangka/{token-tema,registry-blok,template,motor}.js.\n'
  +'   Urutan & id WAJIB identik di studio.html & undangan.html (kolom\n'
  +'   \'theme\' di Supabase adalah index ke array ini). Entry baru selalu\n'
  +'   di AKHIR array. Template kombinasi bebas membawa kb:{shell,urutan,\n'
  +'   ekstra,cover} — dirender jalur kerangka di undangan.html.\n'
  +'   '+pub+' tema publik + '+(masuk.length-pub)+' Studio-only. */\n'
  +'const TPL=[';
 const baris=[];
 if(satuBaris.length)baris.push(satuBaris.map(x=>entry(x.t,denganHarga)+'}').join(','));
 for(const x of masuk.slice(satuBaris.length))baris.push(entry(x.t,denganHarga)+'}');
 out+=baris.join(',\n')+'];\n';
 return {out,jumlah:masuk.length,pub};
}

function tulis(rel,denganHarga){
 const src=fs.readFileSync(R(rel),'utf8');
 /* Sertakan semua header generator lama yang menempel tepat sebelum
    TPL dan baris kosong sesudahnya supaya hitungan usang/baris kosong
    tidak menumpuk setiap generator dijalankan (idempoten). */
 const m=src.match(/(?:\/\* DIBANGKITKAN tools\/bangun-tpl\.cjs — JANGAN EDIT MANUAL\.[\s\S]*?\*\/\n)*const TPL=\[[\s\S]*?\];\n*/);
 if(!m){console.error('!! const TPL=[ tidak ditemukan di '+rel);process.exit(1)}
 const {out,jumlah,pub}=bangun(denganHarga);
 fs.writeFileSync(R(rel),src.replace(m[0],()=>out+'\n'));
 return {jumlah,pub};
}

if(require.main===module){
 const s=tulis('studio.html',true);
 const u=tulis('undangan.html',false);
 console.log('studio.html   → '+s.jumlah+' template ('+s.pub+' publik + '+(s.jumlah-s.pub)+' Studio-only)');
 console.log('undangan.html → '+u.jumlah+' template (tanpa harga, seperti semula)');
 console.log('Urutan id 0–23 tidak berubah; entry baru di akhir (index Supabase aman).');
}
module.exports={bangun,tulis,q,entry};
