// npm install --no-save --package-lock=false jsdom playwright-core @sparticuz/chromium
// Start tools/serve.py, then: node tools/test-mobile-browser.cjs
const { chromium: playwright } = require('playwright-core');
const assert = require('node:assert/strict');
(async () => {
 const { default: chromium } = await import('@sparticuz/chromium');
 const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // The sandbox cannot reach production services. Test local UI only.
  await page.route('**/*', route => route.request().url().startsWith('http://localhost:8080/') ? route.continue() : route.abort());
  // Use the existing local auth marker for this test fixture; never change application auth.
  await page.addInitScript(() => {if(location.origin==='http://localhost:8080')localStorage.setItem('asproject_studio_auth','31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e')});
  for (const width of [320, 360, 390, 430, 768, 1280]) {
   await page.setViewportSize({ width, height: 844 });
   await page.goto('http://localhost:8080/studio.html');
   await page.evaluate(()=>{if(!state.started)startInvitation()});
   for (const tab of ['info','master','desain','slide','musik','tamu','amplop','domain']) {
    await page.evaluate(tab => set('tab',tab), tab);
    const overflow = await page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth }));

    assert(overflow.doc <= width + 1, `${width}px ${tab}: document overflow ${overflow.doc}`);
   }
   await page.evaluate(() => { openMasterMenu(); setFloat(true); floatGo(); });
   const box = await page.locator('#floatPrev').boundingBox();
   assert(box.x >= 0 && box.x + box.width <= width + 1, `${width}px: expanded preview fits`);
   assert(box.y >= 0 && box.y + box.height <= 845, `${width}px: expanded preview height fits`);
   console.log(`PASS: ${width}px, eight tabs and expanded preview`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { setFloat(false); openMasterMenu(); });
  await page.getByRole('button', { name: '📤 Kirim Master via WhatsApp', exact: true }).click();
  assert(await page.locator('.notice').textContent().then(t => t.includes('Publish undangan dahulu')));
  await page.evaluate(() => { state.published=true; state.publishedLink=baseUrl(); render(); });
  const links = await page.evaluate(() => ({ master: masterUrl(), share: masterShareLink(), guest: waShareLink() }));
  assert(decodeURIComponent(links.share).includes(links.master));
  assert(!decodeURIComponent(links.guest).includes('master.html'));
  assert(!decodeURIComponent(links.guest).includes('&k='));
  await page.evaluate(() => {
   window.testOpened=[]; window.open=(...args)=>window.testOpened.push(args);
   window.confirm=()=>false;masterAction('share');
  });
  assert.equal(await page.evaluate(() => window.testOpened.length), 0);
  await page.evaluate(() => { window.confirm=()=>true;masterAction('share'); });
  assert.equal(await page.evaluate(() => window.testOpened[0][0]), links.share);
  await page.goto('http://localhost:8080/undangan.html?demo=1');
  await page.locator('.as-contact-wa').waitFor({state:'attached'});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:844});
   await page.goto('http://localhost:8080/master.html?demo=1');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `Master fits ${width}px`);
   await page.goto('http://localhost:8080/undangan.html?demo=1');
  await page.locator('.as-contact-wa').waitFor({state:'attached'});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `Invitation fits ${width}px`);
   const logo=page.locator('.as-contact-logo');
   await logo.waitFor({state:'attached'});
   assert(await logo.evaluate(img=>img.complete&&img.naturalWidth>0),'Footer logo loads');
   const logoBox=await logo.boundingBox();
   assert(logoBox.width===72&&logoBox.height===72,'Footer logo keeps its proportions');
   const contact=page.locator('.as-contact-wa');
   assert.equal(await contact.count(),1,'One AsProject contact at invitation footer');
   assert((await contact.textContent()).includes('0851-9675-5675'));
   const contactUrl=new URL(await contact.getAttribute('href'));
   assert.equal(contactUrl.hostname,'wa.me');assert.equal(contactUrl.pathname,'/6285196755675');
   assert.equal(await contact.getAttribute('target'),'_blank');
   const contactBox=await contact.boundingBox();
   assert(contactBox.x>=0&&contactBox.x+contactBox.width<=width&&contactBox.height>=44,'Contact button fits mobile and is touch sized');
  }
  // Creation workflow: local Supabase fixture, no production writes.
  await page.addInitScript(() => {
   window.publishCalls=0;window.publishMode='success';
   window.supabase={createClient:()=>{
    if(localStorage.getItem('asproject_test_disable_supabase_sdk')==='1')return undefined;
    return {from:()=>({upsert:async payload=>{
     window.publishCalls++;window.lastPayload=payload;
     if(window.publishMode==='pending')await new Promise(resolve=>window.releasePublish=resolve);
     if(window.publishMode==='throw')throw new Error('offline');
     return {error:window.publishMode==='error'?{message:'test rejection'}:null};
    }})};
   }};
  });
  await page.evaluate(()=>localStorage.removeItem('asproject_studio_v3'));
  await page.goto('http://localhost:8080/studio.html');
  assert.equal(await page.locator('.hdr').count(),0,'No top studio header');
  assert.equal(await page.locator('.fp-box').count(),0,'No floating preview before starting');
  await page.getByRole('button',{name:'Membuat Undangan',exact:true}).click();
  assert(await page.evaluate(()=>Object.entries(state.form).every(([k,v])=>typeof v!=='string'||k==='zona'||v==='')));
  assert(await page.evaluate(()=>state.guestsRaw===''&&state.amplop.noRek===''&&state.slug===''&&state.gallery.length===0));
  await page.getByRole('button',{name:'Selesaikan Undangan',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.publishCalls),0,'Blank form cannot publish');
  await page.evaluate(()=>{
   updF('namaPria','Dimas');updF('namaWanita','Nadia');updF('tanggalAcara','2027-01-20');updF('jamAcara','10:00');updF('venue','Gedung Acara');
  });
  await page.reload();
  assert.equal(await page.evaluate(()=>state.form.namaPria),'Dimas','Reload preserves draft');
  await page.evaluate(async()=>{window.publishMode='error';await publish()});
  assert.equal(await page.locator('#ready-title').count(),0,'Backend error never shows ready');
  await page.evaluate(async()=>{window.publishMode='throw';await publish()});
  assert.equal(await page.locator('#ready-title').count(),0,'Network error never shows ready');
  assert.equal(await page.evaluate(()=>document.getElementById('root').inert),false,'Controls recover after failure');
  await page.evaluate(()=>{window.publishMode='pending';void publish();void publish()});
  assert.equal(await page.evaluate(()=>window.publishCalls),3,'Duplicate clicks do not publish twice');
  await page.evaluate(()=>window.releasePublish());
  await page.locator('#ready-title').waitFor();
  assert.equal(await page.locator('#ready-title').textContent(),'Undangan sudah jadi!');
  assert(await page.evaluate(()=>state.published&&state.stage==='ready'&&lastPayload.data.masterKey===state.masterKey));
  for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Completion screen fits mobile');
  }
  await page.reload();
  assert.equal(await page.locator('#ready-title').count(),1,'Ready screen survives reload');
  await page.getByRole('button',{name:'Edit Undangan',exact:true}).click();
  await page.evaluate(()=>{upd('slug','different-link');showReady()});
  assert.equal(await page.locator('#ready-title').count(),0,'Changed unpublished URL cannot be marked ready');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'+ Undangan Baru',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.form.namaPria),'Dimas','Cancel keeps the draft');
  const oldKey=await page.evaluate(()=>state.masterKey);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'+ Undangan Baru',exact:true}).click();
  assert(await page.evaluate(oldKey=>state.form.namaPria===''&&!state.published&&state.masterKey!==oldKey&&state.arsip.length===1,oldKey));
  console.log('PASS: blank start, draft recovery, validation, publish failures, busy guard, ready links, mobile completion and new invitation confirmation.');
  assert.deepEqual(errors, []);
  console.log('PASS: private master share, draft guard, guest separation and live invitation width; no JS errors.');

  // Publish still works if the Supabase JS CDN is blocked; error messages explain schema setup.
  let restResponse={status:201,body:''},restRequest=null;
  await page.route(/https:\/\/aalrhvirqwjtbbxmteeg\.supabase\.co\/rest\/v1\/invitation_drafts/,async route=>{
   restRequest=route.request();await route.fulfill({status:restResponse.status,body:restResponse.body});
  });
  await page.evaluate(()=>{
   localStorage.setItem('asproject_test_disable_supabase_sdk','1');
   state.form.namaPria='REST';state.form.namaWanita='Fallback';state.form.tanggalAcara='2027-02-20';
   state.form.jamAcara='10:30';state.form.venue='Gedung';state.slug='rest-fallback';
   state.started=true;state.published=false;state.publishedLink='';state.stage='editor';save();
  });
  await page.reload();
  assert.equal(await page.evaluate(()=>typeof db),'undefined','Test simulates blocked Supabase SDK CDN');
  await page.evaluate(async()=>{await publish()});
  await page.locator('#ready-title').waitFor();
  assert.equal(restRequest.method(),'POST','REST fallback sends an upsert request');
  assert.equal(new URL(restRequest.url()).searchParams.get('on_conflict'),'slug');
  assert.equal(JSON.parse(restRequest.postData()).slug,'rest-fallback');
  assert.match(restRequest.headers().apikey,/^eyJ/,'REST fallback sends the public Supabase key');
  assert.match(restRequest.headers().authorization,/^Bearer eyJ/,'REST fallback authorizes with the public key');
  restResponse={status:400,body:JSON.stringify({code:'PGRST204',message:"Could not find the 'data' column of 'invitation_drafts' in the schema cache"})};
  await page.evaluate(()=>{state.published=false;state.publishedLink='';state.stage='editor';save();render()});
  await page.evaluate(async()=>{await publish()});
  assert.equal(await page.locator('#ready-title').count(),0,'Schema error never reports success');
  assert((await page.locator('.notice').textContent()).includes('supabase-schema.sql'),'Schema error shows the exact repair step');
  console.log('PASS: publish falls back to Supabase REST when CDN is blocked and diagnoses missing snapshot schema.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
