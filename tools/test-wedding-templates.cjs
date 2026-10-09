// Wedding theme regression tests: template identity, artwork pairing and live/Studio parity.
// Run: NODE_PATH=... node tools/test-wedding-templates.cjs (jsdom required)
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
let JSDOM=null;
try{({JSDOM}=require('jsdom'))}catch(e){/* jsdom is optional for static checks */}

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const studioHtml=read('studio.html'),liveHtml=read('undangan.html');
const WEDDING_IDS=[
 'jawa-elegan','minimalist-sage','luxury-gold','floral-rustic','ice-blue','minimalist-frost',
 'ocean-breeze','navy-royal','forest-classic','charcoal-gold','slate-sage','burgundy-regal',
 'champagne-royale','violet-imperial'
];
function templates(source){
 const block=(source.match(/const TPL=\[(.*?)\];/s)||[])[1];
 assert(block,'TPL definition exists');
 return block.split(/(?=\{id:'[a-z0-9-]+')/).map(row=>{
  const id=(row.match(/\{id:'([^']+)'/)||[])[1];
  if(!id)return null;
  const get=(key)=>((row.match(new RegExp(key+":'([^']*)'"))||[])[1]||'');
  return {id,nama:get('nama'),ev:get('ev'),accent:get('accent'),pat:get('pat'),bg3d:get('bg3d'),bgPaper:get('bgPaper')};
 }).filter(Boolean);
}
const studioTpl=templates(studioHtml),liveTpl=templates(liveHtml);
const expected=studioTpl.filter(t=>t.ev==='pernikahan');
assert.deepEqual(expected.map(t=>t.id),WEDDING_IDS,'all wedding designs have a deliberate stable order');
assert.deepEqual(liveTpl.map(t=>t.id),studioTpl.map(t=>t.id),'Studio and guest renderer template indexes stay aligned');
assert.deepEqual(liveTpl.filter(t=>t.ev==='pernikahan').map(t=>t.id),WEDDING_IDS);

for(const t of expected){
 assert(t.nama,`${t.id} has a visible template name`);
 assert(/^#[0-9a-f]{6}$/i.test(t.accent),`${t.id} has its own accent color`);
 for(const asset of [t.bg3d,t.bgPaper].filter(Boolean)){
  const full=path.join(ROOT,asset);
  assert(fs.existsSync(full),`${t.id} artwork exists: ${asset}`);
  assert(fs.statSync(full).size<300000,`${t.id} artwork stays small enough for the offline export`);
 }
}
assert.equal(expected.find(t=>t.id==='jawa-elegan').bgPaper,'assets/wedding/jawa-batik-watercolor.webp');
assert.equal(expected.find(t=>t.id==='minimalist-sage').bgPaper,'assets/wedding/minimalist-sage-watercolor.webp');
assert.equal(expected.find(t=>t.id==='ice-blue').bg3d,'assets/tema-3d/ice-blue.webp');
assert.equal(expected.find(t=>t.id==='minimalist-frost').pat,'frost');
assert.equal(expected.find(t=>t.id==='slate-sage').pat,'botanical');
for(const token of ['wedding-cover','wedding-invite-card','wedding-meta','wedding-note','wedding-paper-art']){
 assert(liveHtml.includes(token),`live renderer includes ${token}`);
}
assert(studioHtml.includes('wedding-preview-inner')&&studioHtml.includes('weddingDateLabel'),
 'Studio preview uses the same editorial wedding cover content');

function invitation(tpl){
 return {slug:'theme-test',name1:'Emma',name2:'Noah',venue:'Sunset Gardens',event_date:'2027-10-26',event_time:'16:00',theme:0,
  data:{event:'pernikahan',tpl,doa:'pernikahan',fontTitle:'merriweather',fontBody:'work-sans',form:{
   namaPria:'Emma',namaWanita:'Noah',gelarPria:'',gelarWanita:'',putraPutri:'Keluarga Emma',putriDari:'Keluarga Noah',
   tanggalAcara:'2027-10-26',jamAcara:'16:00',zona:'WIB',venue:'Sunset Gardens',alamat:'Carmel',mapsLink:'',showBismillah:false,
   sesiKedua:false,jamAkad:'',jamResepsi:'',showMapsBtn:true,ucapanCustom:''},
   slides:{},anim:{cover:false,text:false,reveal:false,effect:'fade',scroll:'fade-up'},border:'none',music:{url:'',name:''}}
 };
}
async function renderLive(id){
 const dom=new JSDOM(liveHtml,{url:'https://asproject.my.id/undangan.html?slug=theme-test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 w.fetch=()=>Promise.reject(new Error('fixture: no network'));
 for(const asset of ['assets/scroll-effects.js','assets/theme-contrast.js','assets/button-help.js'])w.eval(read(asset));
 w.eval('window.EMBEDDED_DATA='+JSON.stringify(invitation(id))+';');
 for(const tag of w.document.querySelectorAll('script:not([src])'))w.eval(tag.textContent);
 await new Promise(resolve=>setTimeout(resolve,430));
 return dom;
}
async function testLiveExamples(){
 for(const id of WEDDING_IDS){
  const dom=await renderLive(id),w=dom.window,t=liveTpl.find(row=>row.id===id);
  assert(w.document.body.classList.contains('wedding-cover'),`${id}: wedding skin applied`);
  assert(w.document.body.classList.contains('theme-'+id),`${id}: theme-specific class applied`);
  assert(w.document.querySelector('#cover .wedding-invite-card'),`${id}: stationery card rendered`);
  assert.equal(w.document.querySelector('#cover .wedding-kicker').textContent,"You're Invited");
  assert(w.document.querySelector('#cover h1').textContent.includes('Emma'),`${id}: couple name renders`);
  assert(w.document.querySelector('#cover .wedding-subtitle').textContent.includes('pernikahan'));
  assert(w.document.querySelector('#cover .date').textContent.includes('26 Oktober 2027'));
  assert(w.document.querySelector('#cover .wedding-meta').textContent.includes('16:00 WIB'));
  assert(w.document.querySelector('#cover .host').textContent.includes('Sunset Gardens'));
  assert(w.document.querySelector('#cover .wedding-note'));
  assert.equal(w.document.documentElement.style.getPropertyValue('--accent'),t.accent,`${id}: live accents match its palette`);
  assert(w.document.documentElement.style.getPropertyValue('--ft').includes('Merriweather'),`${id}: live title font is applied`);
  assert(w.document.documentElement.style.getPropertyValue('--fb').includes('Work Sans'),`${id}: live body font is applied`);
  if(t.bgPaper)assert(w.document.body.classList.contains('wedding-paper-art'),`${id}: paper art is enabled`);
  if(t.bg3d)assert(w.document.body.classList.contains('art3d'),`${id}: matching artwork background remains enabled`);
  if(id==='luxury-gold')assert(liveHtml.includes('body.theme-luxury-gold #cover .wedding-invite-card{'),`${id}: live invitation uses its premium black-and-gold card skin`);
  dom.window.close();
 }
}
async function testStudioPreview(){
 const dom=new JSDOM(studioHtml,{url:'https://asproject.my.id/studio.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.localStorage.setItem('asproject_studio_auth','31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e');
  w.clearScrollReveal=()=>{};w.setupScrollReveal=()=>{};w.scrollTo=()=>{};
  w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
  w.HTMLCanvasElement.prototype.getContext=()=>({});
 }});
 const w=dom.window;
 w.eval(`state.started=true;state.event='pernikahan';state.stage='editor';state.tab='desain';render()`);
 w.set('fontTitle','merriweather');w.set('fontBody','work-sans');
 const fontCover=w.document.querySelector('.phone .screen .wedding-cover');
 const titleFont=fontCover.querySelector('.wedding-preview-inner').style.fontFamily;
 const bodyFont=fontCover.querySelector('.wedding-kicker').getAttribute('style');
 assert(titleFont.includes('Merriweather'),'Studio preview applies the selected title font');
 assert(bodyFont.includes('font-family:"Work Sans",sans-serif'),'Studio preview safely applies the selected body font');
 assert(w.document.querySelector('.font-preview-title').style.fontFamily.includes('Merriweather'),'selection panel previews the title font');
 assert(w.document.querySelector('.font-preview-body').style.fontFamily.includes('Work Sans'),'selection panel previews the body font');
 for(const t of expected){
  w.eval(`state.event='pernikahan';state.tpl='${t.id}';state.accent=tplOf().accent;state.fontTitle=tplOf().ft||state.fontTitle;renderPreview()`);
  const cover=w.document.querySelector('.phone .screen .wedding-cover');
  assert(cover,`${t.id}: Studio preview applies wedding skin`);
  assert(cover.classList.contains('theme-'+t.id),`${t.id}: Studio preview identifies active template`);
  assert(cover.querySelector('.wedding-invite-card'),`${t.id}: Studio preview displays card`);
  assert(cover.querySelector('.wedding-kicker').textContent.includes('Invited'));
  if(t.id==='jawa-elegan')assert(cover.querySelector('.wedding-invite-card').getAttribute('style').includes('jawa-batik-watercolor.webp'));
  if(t.id==='luxury-gold'){
   assert(cover.querySelector('.wedding-invite-card').getAttribute('style').includes('linear-gradient(145deg,rgba(17,14,10,.96)'), 'Studio shows the premium dark-gold card');
   assert(cover.querySelector('h1').getAttribute('style').includes('#F7ECD4'),'premium names use warm ivory type');
  }
  if(t.id==='minimalist-sage')assert(cover.getAttribute('style').includes('minimalist-sage-watercolor.webp'));
  if(t.id==='ice-blue')assert(cover.getAttribute('style').includes('ice-blue.webp'));
 }
 // Export each stationery-art theme and verify the actual WebP bytes survive in the HTML.
 let exported=null;
 w.URL.createObjectURL=blob=>{exported=blob;return 'blob:wedding-test'};w.URL.revokeObjectURL=()=>{};
 const makeElement=w.document.createElement.bind(w.document);
 w.document.createElement=tag=>{const el=makeElement(tag);if(String(tag).toLowerCase()==='a')el.click=()=>{};return el};
 w.fetch=async url=>{
  const rel=String(url);
  if(rel==='undangan.html')return{ok:true,text:async()=>liveHtml};
  if(rel==='assets/theme-contrast.js')return{ok:true,text:async()=>read('assets/theme-contrast.js')};
  if(rel.startsWith('assets/')){
   const bytes=fs.readFileSync(path.join(ROOT,rel));
   return{ok:true,blob:async()=>new w.Blob([bytes],{type:'image/webp'})};
  }
  throw new Error('fixture: unexpected fetch '+rel);
 };
 for(const [id,asset] of [['jawa-elegan','assets/wedding/jawa-batik-watercolor.webp'],['minimalist-sage','assets/wedding/minimalist-sage-watercolor.webp']]){
  w.eval(`state.event='pernikahan';state.tpl='${id}';state.accent=tplOf().accent;state.slug='wedding-test';state.form.namaPria='Emma';state.form.namaWanita='Noah';state.music={local:true}`);
  exported=null;await w.dlUndangan();
  assert(exported,`${id}: offline HTML download is generated`);
  const html=await exported.text(),bytes=fs.readFileSync(path.join(ROOT,asset)).toString('base64');
  assert(html.includes('--wedding-paper-art:url(data:image/webp;base64,'+bytes+')'),`${id}: full paper artwork is embedded for offline use`);
  if(id==='jawa-elegan')assert(html.includes('--cover-art:url(data:image/webp;base64,'),`${id}: background artwork is embedded too`);
 }
 dom.window.close();
}
(async()=>{
 try{
  if(JSDOM){await testLiveExamples();await testStudioPreview()}
  else console.log('INFO: jsdom unavailable; runtime rendering checks skipped.');
  console.log(`PASS: ${expected.length} wedding themes keep name-specific styling; Batik, Sage watercolor and Ice Blue are paired with the correct assets.`);
 }catch(error){console.error(error);process.exitCode=1}
})();
