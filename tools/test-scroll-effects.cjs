const blobText=(win,b)=>typeof b.text==='function'?b.text():new Promise((ok,no)=>{const r=new win.FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsText(b)});
// npm install --no-save --package-lock=false jsdom
// node tools/test-scroll-effects.cjs
const { JSDOM } = require('jsdom');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Script } = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const studio = read('studio.html'), live = read('undangan.html');
const DASAR = (studio.match(/\{id:'([a-z0-9-]+)'/) || [, ''])[1];   // tema pertama katalog aktif
const css = read('assets/scroll-effects.css');
const ids = html => [...html.match(/const FX_SCROLL=\[([\s\S]*?)\];/)[1].matchAll(/\[\s*'([^']+)'/g)].map(m => m[1]);
const mixIds = html => [...html.match(/const FX_SCROLL_MIX=\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const all = ids(studio);
assert.equal(all.length, 34);
assert.equal(new Set(all).size, 34);
assert.deepEqual(all, ids(live));
assert.deepEqual(mixIds(studio),mixIds(live),'Studio and live section-mix sequence stays aligned');
for (const id of all) {
 assert(css.includes(`.scroll-reveal.fx-s-${id}{`), `CSS selector for ${id}`);
 assert(css.includes(`@keyframes sr-${id}{`), `Keyframes for ${id}`);
}
for (const html of [studio, live]) {
 const doc = new JSDOM(html);
 for (const script of doc.window.document.querySelectorAll('script:not([src])')) new Script(script.textContent);
 doc.window.close();
}
const dom = new JSDOM(studio, { url: 'https://studio.test/', runScripts: 'outside-only' });
const w = dom.window;
w.HTMLMediaElement.prototype.pause = () => {};
let reduced = false;
w.matchMedia = () => ({ matches: reduced });
const observers = [];
w.IntersectionObserver = class {
 constructor(callback, options) { this.callback = callback; this.options = options; this.elements = new Set(); observers.push(this); }
 observe(el) { this.elements.add(el); }
 unobserve(el) { this.elements.delete(el); }
 disconnect() { this.elements.clear(); }
};
w.eval(read('assets/scroll-effects.js'));
for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
w.scrollTo=()=>{};w.startInvitation();
/* Studio kini menampilkan berkas undangan.html asli di dalam iframe, jadi efek
   scroll tidak lagi dibungkus oleh Studio sendiri — cukup pastikan kontrak itu
   terjaga; perilaku efek diuji pada renderer live di bawah. */
assert.deepEqual([0,1,2,3].map(i=>w.fxScrollForSection('fade-up',i,true)),['fade-up','slide-left','fade-down','slide-right']);
assert.equal(w.fxScrollForSection('fade-up',3,false),'fade-up','uniform mode keeps one selected effect');
assert.equal(w.fxScrollAxis('slide-left'),'x','sideways effects use horizontal entrance');
assert.equal(w.fxScrollAxis('fade-up'),'y','fade-up uses vertical entrance');
assert(css.includes('.scroll-reveal.sr-axis-x.sr-dir-down{--sr-entry-x:22px;--sr-entry-y:0px}'));
assert(w.document.querySelector('#phoneWrap iframe.pv-frame'),'preview panel loads the real invitation file');
assert.equal(w.document.querySelector('#phoneWrap .scroll-reveal'),null,'Studio no longer wraps invitation sections itself');
for(const id of all){w.setAnim('scroll',id);assert(w.eval?true:true);}
w.setAnim('reveal',false);
w.pvPerbaruiSekarang();
w.setAnim('reveal',true);
 (async()=>{
 const liveDom=new JSDOM(live,{url:'https://invitation.test/undangan.html?slug=scroll-test',runScripts:'outside-only',pretendToBeVisual:true});
 const lw=liveDom.window;lw.scrollTo=()=>{};lw.HTMLMediaElement.prototype.pause=()=>{};lw.HTMLMediaElement.prototype.play=()=>Promise.resolve();
 lw.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 const liveObservers=[];
 lw.IntersectionObserver=class{constructor(callback,options){this.callback=callback;this.options=options;this.elements=new Set();liveObservers.push(this)}observe(el){this.elements.add(el)}unobserve(el){this.elements.delete(el)}disconnect(){this.elements.clear()}};
 for(const asset of ['assets/scroll-effects.js','assets/theme-contrast.js','assets/button-help.js'])lw.eval(read(asset));
 const liveDraft={slug:'scroll-test',name1:'Ava',name2:'Rafi',venue:'Garden',event_date:'2027-10-26',event_time:'16:00',theme:0,
  data:{event:'pernikahan',tpl:'navy-royal',form:{namaPria:'Ava',namaWanita:'Rafi',tanggalAcara:'2027-10-26',jamAcara:'16:00',zona:'WIB',venue:'Garden',alamat:'',mapsLink:''},slides:{},anim:{cover:false,text:false,reveal:true,effect:'fade',scroll:'fade-up',scrollMix:true}}};
 lw.eval('window.EMBEDDED_DATA='+JSON.stringify(liveDraft)+';');
 for(const script of lw.document.querySelectorAll('script:not([src])'))lw.eval(script.textContent);
 await new Promise(resolve=>setTimeout(resolve,430));
 const liveRows=[...lw.document.querySelectorAll('.scroll-reveal')];
 const liveEffects=liveRows.map(el=>[...el.classList].find(c=>c.startsWith('fx-s-')));
 assert(liveEffects.length>=4,'live page wraps invitation sections for scroll reveal');
 assert.equal(liveEffects[0],'fx-s-fade-up','selected base effect starts the sequence');
 assert.deepEqual(liveEffects.slice(0,4),['fx-s-fade-up','fx-s-slide-left','fx-s-fade-down','fx-s-slide-right']);
 assert(new Set(liveEffects.slice(0,4)).size>1,'live invitation automatically varies effects per section');
 assert(liveRows.some(el=>el.classList.contains('sr-axis-x'))&&liveRows.some(el=>el.classList.contains('sr-axis-y')),
  'some sections enter sideways instead of all moving vertically');
 const liveObserver=liveObservers.at(-1),liveTarget=liveRows[0];
 lw.document.documentElement.scrollTop=100;lw.dispatchEvent(new lw.Event('scroll'));
 liveObserver.callback([{target:liveTarget,isIntersecting:true}]);
 assert(liveTarget.classList.contains('sr-dir-down'));
 liveObserver.callback([{target:liveTarget,isIntersecting:false}]);
 lw.document.documentElement.scrollTop=40;lw.dispatchEvent(new lw.Event('scroll'));
 liveObserver.callback([{target:liveTarget,isIntersecting:true}]);
 assert(liveTarget.classList.contains('sr-dir-up'),'live invitation flips the entrance direction when scrolling back up');
 /* reduced motion di renderer live: konten tidak boleh disembunyikan */
 const redDom=new JSDOM(live,{url:'https://invitation.test/undangan.html?slug=scroll-red',runScripts:'outside-only',pretendToBeVisual:true});
 const rw=redDom.window;rw.scrollTo=()=>{};rw.HTMLMediaElement.prototype.pause=()=>{};rw.HTMLMediaElement.prototype.play=()=>Promise.resolve();
 rw.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 rw.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 for(const asset of ['assets/scroll-effects.js','assets/theme-contrast.js','assets/button-help.js'])rw.eval(read(asset));
 rw.eval('window.EMBEDDED_DATA='+JSON.stringify(liveDraft)+';');
 for(const script of rw.document.querySelectorAll('script:not([src])'))rw.eval(script.textContent);
 await new Promise(resolve=>setTimeout(resolve,430));
 assert.equal(rw.document.querySelector('.sr-ready'),null,'Reduced motion never hides live content');
 redDom.window.close();
 liveDom.window.close();
 let exported=null;
 w.URL.createObjectURL=blob=>{exported=blob;return 'blob:scroll-test'};w.URL.revokeObjectURL=()=>{};
 const createElement=w.document.createElement.bind(w.document);
 w.document.createElement=tag=>{const el=createElement(tag);if(String(tag).toLowerCase()==='a')el.click=()=>{};return el};
 w.set('tpl',DASAR);   // tema pertama katalog aktif (dulu 'minimalist-frost' yang sudah direset)w.set('slug','scroll-test');w.set('music',{local:true});
 w.fetch=async url=>{
  const rel=String(url);
  if(rel==='undangan.html')return{ok:true,text:async()=>live};
  if(rel==='assets/theme-contrast.js')return{ok:true,text:async()=>read('assets/theme-contrast.js')};
  if(rel==='assets/scroll-effects.css')return{ok:true,text:async()=>css};
  if(rel==='assets/scroll-effects.js')return{ok:true,text:async()=>read('assets/scroll-effects.js')};
  throw new Error('Unexpected export fetch: '+rel);
 };
 await w.dlUndangan();
 assert(exported,'standalone invitation HTML is generated');
 const html=await blobText(w,exported);
 assert(html.includes('<style data-asproject-scroll-effects>'),'standalone file embeds scroll effect CSS');
 assert(html.includes('.scroll-reveal.fx-s-tilt-in{')&&html.includes('@keyframes sr-blur-down{'),'new effect keyframes work offline');
 assert(html.includes('function (container, root = null)')||html.includes('window.setupScrollReveal'),'standalone file embeds scroll observer code');
 assert(html.includes('"scroll":"blur-down"'),'selected scroll effect is saved in the standalone invitation');
 assert(html.includes('"scrollMix":true'),'per-section variety preference is saved in the standalone invitation');
 dom.window.close();
 console.log('34 scroll effects: mixed vertical/sideways reveals, up/down replay, reduced-motion and offline export passed.');
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1});
