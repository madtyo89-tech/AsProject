// Test Supabase publishing through the REST fallback when the SDK CDN is unavailable.
// Run with jsdom installed: node tools/test-publish-fallback.cjs
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');

const html=fs.readFileSync(require('node:path').join(__dirname,'..','studio.html'),'utf8');
const requests=[];
let response={ok:true,status:201,body:''};
const dom=new JSDOM(html,{
 url:'https://asproject.my.id/studio.html',
 runScripts:'dangerously',
 pretendToBeVisual:true,
 beforeParse(window){
  // The test opens the protected Studio with its existing local test marker.
  window.localStorage.setItem('asproject_studio_auth','31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e');
  // No external resources are loaded: this deliberately leaves window.supabase unset.
  window.fetch=async(url,options)=>{
   requests.push({url:String(url),options});
   return {ok:response.ok,status:response.status,text:async()=>response.body};
  };
  window.scrollTo=()=>{};
  window.console.error=()=>{}; // The simulated schema rejection is expected in this test.
  window.clearScrollReveal=()=>{};
  window.setupScrollReveal=()=>{};
  window.HTMLMediaElement.prototype.play=()=>Promise.resolve();
  window.HTMLMediaElement.prototype.pause=()=>{};
  window.HTMLCanvasElement.prototype.getContext=()=>({});
 }
});

(async()=>{
 try{
  const w=dom.window;
  assert.equal(w.eval('typeof db'),'undefined','SDK/CDN is unavailable in this fixture');
  w.eval(`state.started=true;state.form.namaPria='REST';state.form.namaWanita='Fallback';
   state.form.tanggalAcara='2027-02-20';state.form.jamAcara='10:30';state.form.venue='Gedung';
   state.slug='rest-fallback';save()`);
  await w.eval('(async()=>{await publish()})()');

  assert.equal(w.eval('state.published'),true,'REST success marks the invitation published');
  assert.equal(w.eval('state.stage'),'ready');
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,'https://aalrhvirqwjtbbxmteeg.supabase.co/rest/v1/invitation_drafts?on_conflict=slug');
  assert.equal(requests[0].options.method,'POST');
  assert.match(requests[0].options.headers.apikey,/^eyJ/);
  assert.match(requests[0].options.headers.Authorization,/^Bearer eyJ/);
  const payload=JSON.parse(requests[0].options.body);
  assert.equal(payload.slug,'rest-fallback');
  assert.equal(payload.data.form.namaPria,'REST');

  response={ok:false,status:400,body:JSON.stringify({
   code:'PGRST204',message:"Could not find the 'data' column of 'invitation_drafts' in the schema cache"
  })};
  w.eval(`state.published=false;state.publishedLink='';state.stage='editor';save();render()`);
  await w.eval('(async()=>{await publish()})()');
  assert.equal(w.eval('state.published'),false,'database error never marks the draft published');
  assert.equal(w.document.querySelector('#ready-title'),null,'database error never shows the ready screen');
  assert.match(w.document.querySelector('.notice').textContent,/supabase-schema\.sql/,
   'missing snapshot column explains how to repair the schema');
  assert.equal(w.document.getElementById('root').inert,false,'editor unlocks after a failed request');
  console.log('PASS: REST fallback publishes without Supabase JS and reports missing snapshot schema clearly.');
 }finally{dom.window.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
