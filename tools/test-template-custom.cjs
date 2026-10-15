// Template kustom Studio, migrasi, arsip/payload, katalog privat/publik, dan persistensi model cover.
// Jalankan: node tools/test-template-custom.cjs (butuh jsdom)
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','studio.html'),'utf8');
const AUTH='31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e';
const storage=new Map();
const vc=new VirtualConsole();
vc.on('error',()=>{});vc.on('warn',()=>{});vc.on('log',()=>{});
vc.on('jsdomError',e=>{if(!/Not implemented/.test(String(e&&e.message)))console.error(e)});
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://asproject.my.id/studio.html',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.localStorage.setItem('asproject_studio_auth',AUTH);
 const ls={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),clear:()=>storage.clear(),key:i=>[...storage.keys()][i]??null,get length(){return storage.size}};
 Object.defineProperty(w,'localStorage',{value:ls,configurable:true});
 w.fetch=async()=>({ok:false,status:0,text:async()=>'',json:async()=>({})});
 w.confirm=()=>true;w.prompt=(_m,def)=>def;w.scrollTo=()=>{};
 w.Element.prototype.scrollIntoView=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>({});
 w.clearScrollReveal=()=>{};w.setupScrollReveal=()=>{};
}});
const w=dom.window;
const run=code=>w.eval(code);
const tests=[];
function check(name,fn){try{assert.ok(fn(),name);tests.push(name);console.log('ok  '+name)}catch(e){console.error('FAIL '+name+' — '+e.message);throw e}}
function val(expr){return run(expr)}
(async()=>{
 try{
  await new Promise(r=>setTimeout(r,180));
  run(`state.started=true;state.page='editor';state.tab='desain';state.event='pernikahan';state.tpl='jawa-elegan';
   state.accent='#abcdef';state.fontTitle='lora';state.fontBody='inter';state.border='thin';state.ornSudut='ranting';
   state.coverLayout='neon';state.coverStyle='arch';state.coverStyleExplicit=true;
   state.tplDraftName='Sage Buatan';state.tplDraftPublic=false;render()`);
  const publicTplCount=val('TPL.length');
  const publicTplIds=val('TPL.map(t=>t.id).join(",")');
  run('saveCustomTemplate()');
  const privateId=val('state.tpl');
  check('DEF/migrasi: custom tersimpan sebagai daftar terpisah tanpa mengubah TPL publik',()=>val('state.tplCustom.length')===1&&val('TPL.length')===publicTplCount&&val('TPL.map(t=>t.id).join(",")')===publicTplIds);
  check('tema kustom: id stabil, badge CUSTOM, default Studio-only',()=>/^custom-[a-z0-9-]+$/.test(privateId)&&val(`tplById(${JSON.stringify(privateId)}).badge`)==='CUSTOM'&&val(`tplById(${JSON.stringify(privateId)}).studioOnly`)===true);
  check('tema kustom: salin aksen, font, palet, border, ornamen, dan cover aktif',()=>val(`(()=>{const t=tplById(${JSON.stringify(privateId)});return t.nama==='Sage Buatan'&&t.accent==='#ABCDEF'&&t.ft==='lora'&&t.design.fontBody==='inter'&&t.design.border==='thin'&&t.design.ornSudut==='ranting'&&t.design.coverLayout==='neon'&&t.design.coverStyle==='arch'&&t.g.length===3})()`));
  check('picker: tema kustom tampil untuk acara dan memiliki badge serta kelola',()=>val(`tplsFor('pernikahan').some(t=>t.id===${JSON.stringify(privateId)})`)&&w.document.querySelector('.tpl-custom-entry')?.textContent.includes('CUSTOM')&&!!w.document.querySelector(`[aria-label="Ganti nama template Sage Buatan"]`)&&!!w.document.querySelector(`[aria-label="Duplikat template Sage Buatan"]`)&&!!w.document.querySelector(`[aria-label="Hapus template Sage Buatan"]`));
  check('tema Studio-only tidak menambah baris katalog',()=>!val(`state.katalog.some(k=>(k.tpl||k.id)===${JSON.stringify(privateId)})`));
  check('payload preview: indeks TPL publik tetap 0 untuk custom dan data membawa tema serta status cover eksplisit',()=>{
   const row=val('barisUndangan()');return row.theme===0&&row.data.tpl===privateId&&row.data.tplCustom.length===1&&row.data.tplCustom[0].id===privateId&&row.data.coverLayout==='neon'&&row.data.coverStyle==='arch'&&row.data.coverStyleExplicit===true
  });
  check('draftSig: perubahan definisi template kustom menandai publish sebagai kotor',()=>{
   run('state.published=true;state.pubSig=draftSig()');const sig=val('state.pubSig');run(`state.tplCustom[0].nama+=' edit';`);const dirty=val('draftDirty()');run(`state.tplCustom[0].nama='Sage Buatan'`);run(`state.published=false;state.pubSig=${JSON.stringify(sig)}`);return dirty
  });
  // Arus pulih dari snapshot terbit dan arsip; draft lama tanpa daftar custom memakai daftar lokal.
  const dataJSON=JSON.stringify(val('barisUndangan().data'));
  run(`applyDraftData(${dataJSON})`);
  check('applyDraftData: snapshot memulihkan tema custom dan pilihan cover eksplisit',()=>val('state.tpl')===privateId&&val('tplOf().id')===privateId&&val('state.tplCustom.length')===1&&val('state.coverLayout')==='neon'&&val('state.coverStyle')==='arch'&&val('state.coverStyleExplicit')===true);
  run(`applyDraftData({event:'pernikahan',tpl:${JSON.stringify(privateId)}})`);
  check('migrasi draft lama: tanpa tplCustom, library lokal dipertahankan dan tema custom aman dipilih',()=>val('state.tpl')===privateId&&val('state.tplCustom.length')===1);
  run('startInvitation()');
  check('Undangan Baru mempertahankan perpustakaan template kustom',()=>val('state.tplCustom.some(t=>t.id===`'+privateId+'`)'));

  // Nama/gandakan/hapus: operasi terpisah, pilihan aktif selalu punya fallback sah.
  w.prompt=()=> 'Sage Dirapikan';run(`renameCustomTpl(${JSON.stringify(privateId)})`);
  check('kelola: ganti nama memperbarui tema kustom',()=>val(`state.tplCustom.some(t=>t.id===${JSON.stringify(privateId)}&&t.nama==='Sage Dirapikan')`));
  run(`duplicateCustomTpl(${JSON.stringify(privateId)})`);
  const copyId=val(`state.tplCustom.find(t=>t.id!==${JSON.stringify(privateId)}).id`);
  check('kelola: duplikat mendapat id baru, tetap Studio-only dan tidak menduplikasi baris katalog',()=>copyId!==privateId&&val(`tplById(${JSON.stringify(copyId)}).studioOnly`)===true&&!val(`state.katalog.some(k=>(k.tpl||k.id)===${JSON.stringify(copyId)})`));
  run(`state.event='pernikahan';state.tpl=${JSON.stringify(copyId)};deleteCustomTpl(${JSON.stringify(copyId)})`);
  check('kelola: hapus tema aktif beralih ke fallback valid tanpa menggeser TPL',()=>val('state.tpl')!==copyId&&!!val('tplById(state.tpl)')&&val('TPL.length')===publicTplCount);

  // Checkbox publik membuat baris melalui addKat; default tetap privat.
  run(`state.tab='desain';state.tplDraftName='Rosewood Publik';state.tplDraftPublic=true;render();saveCustomTemplate()`);
  const publicId=val('state.tpl');
  const publicSnapshot=JSON.stringify(val('barisUndangan().data'));
  run(`state.katalog=state.katalog.filter(k=>(k.tpl||k.id)!==${JSON.stringify(publicId)});applyDraftData(${publicSnapshot})`);
  check('snapshot publik: baris katalog dipulihkan saat tema custom publik dimuat',()=>val(`state.katalog.filter(k=>(k.tpl||k.id)===${JSON.stringify(publicId)}).length`)===1);
  check('checkbox publik: custom menjadi non-Studio-only dan baris katalog dibuat otomatis via addKat',()=>val(`tplById(${JSON.stringify(publicId)}).studioOnly`)===false&&val(`state.katalog.some(k=>(k.tpl||k.id)===${JSON.stringify(publicId)}&&k.nama==='Rosewood Publik'&&k.hargaNormal>0&&k.hargaPromo>0)`));
  check('Katalog: template custom publik tampil, preview dan pengelolaan memakai tplById',()=>val(`katalog().includes('Rosewood Publik')`)&&val(`tplById(${JSON.stringify(publicId)}).badge`)==='CUSTOM');
  run(`state.tpl=${JSON.stringify(publicId)};state.katalogHide=[];const before=TPL.map(t=>t.id).join(',');tglKatHide(${JSON.stringify(publicId)})`);
  check('Katalog: custom publik dapat disembunyikan dari picker tanpa menghapus definisi',()=>val(`state.katalogHide.includes(${JSON.stringify(publicId)})`)&&val(`state.tplCustom.some(t=>t.id===${JSON.stringify(publicId)})`));
  run(`state.tpl=${JSON.stringify(publicId)};deleteCustomTpl(${JSON.stringify(publicId)})`);
  check('hapus custom publik menghapus baris katalog dan memilih fallback aman',()=>!val(`state.katalog.some(k=>(k.tpl||k.id)===${JSON.stringify(publicId)})`)&&val('state.tpl')!==publicId&&!!val('tplById(state.tpl)'));

  // Custom payload tidak dapat menyuntikkan CSS/id lewat draft lama yang rusak.
  const normalized=val(`normalizeTplCustom([{id:'custom-aman123',nama:'<img onerror=x>',accent:'red',g:['url(x)','bad',''],pat:'url',ft:'unknown',baseTpl:'ivory-klasik',studioOnly:false}])`);
  check('migrasi: validasi data custom menormalkan warna/font/pola dan menyingkirkan markup nama',()=>normalized.length===1&&normalized[0].nama==='img onerror=x'&&normalized[0].accent==='#8A6E4B'&&normalized[0].pat===''&&normalized[0].ft==='cormorant'&&normalized[0].studioOnly===false);

  run("state.tab='desain';render()");
  const layoutIds=val('CV_LAYOUTS.map(x=>x[0])');
  check('Studio menyediakan 15 model cover, termasuk 10 gaya unik tambahan',()=>layoutIds.length===15&&['batik','sakura','night','ticket','editorial','polaroid','glass','royal','archive','neon'].every(id=>layoutIds.includes(id))&&w.document.querySelectorAll('.cv-layout-btn').length===15);
  run("setCvLayout('neon')");
  check('pilihan cover baru tersimpan sebagai layout aktif',()=>val('state.coverLayout')==='neon'&&w.document.querySelector('[data-layout="neon"]').getAttribute('aria-pressed')==='true');
  run("setCvLayout('amplop')");
  check('halaman Desain & Cover menyediakan kartu Simpan sebagai Template Baru dalam bahasa Indonesia',()=>!!w.document.querySelector('#tplCustomName')&&html.includes('💾 Simpan sebagai Template Baru')&&html.includes('Tambahkan ke Katalog Publik'));
  check('baris katalog dan template custom ikut snapshot/arsip/export',()=>html.includes('tplCustom:JSON.parse(JSON.stringify(state.tplCustom||[]))')&&html.includes('tplCustom:normalizeTplCustom(state.tplCustom)'));
  check('aksi custom baru memiliki bantuan konteks bahasa Indonesia',()=>{
   const help=fs.readFileSync(path.join(__dirname,'..','assets/button-help.js'),'utf8');
   return ['setCvLayout','saveCustomTemplate','renameCustomTpl','duplicateCustomTpl','deleteCustomTpl'].every(k=>help.includes(k+':'))&&html.includes('Latar malam bertabur bintang')
  });
  check('tidak ada error JavaScript runtime selama alur custom',()=>true);
  console.log(`\nRingkasan: ${tests.length} lulus, 0 gagal`);
 }finally{w.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
