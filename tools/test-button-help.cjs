// With tools/serve.py running on :8080:
// node tools/test-button-help.cjs (same browser dependencies as test-mobile-browser.cjs)
const {chromium:playwright}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const {default:chromium}=await import('@sparticuz/chromium');
 const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith('http://localhost:8080/')?r.continue():r.abort());
  await page.addInitScript(()=>{if(location.origin==='http://localhost:8080')localStorage.setItem('asproject_studio_auth','31282510d0c10140f7413a0573fdade727453ec37c3c386e4363e7e598090d8e')});
  await page.goto('http://localhost:8080/studio.html');
  const start=page.getByRole('button',{name:'Membuat Undangan',exact:true});
  const b=await start.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.getByRole('tooltip').waitFor();
  assert((await page.getByRole('tooltip').textContent()).includes('isian kosong'));
  assert(await start.getAttribute('aria-describedby'));
  await page.mouse.up();
  assert.equal(await page.locator('.editor-actions').count(),0,'Holding never starts the invitation');
  await start.click();
  await page.locator('.editor-actions').waitFor();
  const finish=page.getByRole('button',{name:'Selesaikan Undangan',exact:true});
  await finish.focus();await page.keyboard.press('F1');
  assert((await page.getByRole('tooltip').textContent()).includes('penyimpanan berhasil'));
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
  assert.equal(await finish.getAttribute('aria-describedby'),null,'ARIA restored on dismissal');
  // A dynamically rendered icon-only control receives contextual help too.
  await page.evaluate(()=>setFloat(false));
  const preview=page.locator('.fp-pill');await preview.focus();await page.keyboard.press('F1');
  assert((await page.getByRole('tooltip').textContent()).includes('floating preview'));
  const tip=await page.getByRole('tooltip').boundingBox();
  assert(tip.x>=0&&tip.x+tip.width<=390&&tip.y>=0&&tip.y+tip.height<=844);
  await page.keyboard.press('Escape');
  // Simulate touch pointer hold and movement; native click remains separately checked above.
  await preview.dispatchEvent('pointerdown',{pointerId:21,isPrimary:true,button:0,clientX:300,clientY:800,pointerType:'touch'});
  await page.getByRole('tooltip').waitFor();
  await preview.dispatchEvent('pointerup',{pointerId:21,isPrimary:true,button:0,pointerType:'touch'});
  await preview.dispatchEvent('click');
  assert.equal(await page.locator('.fp-box').count(),0,'Touch hold consumes the following click');
  await preview.dispatchEvent('pointerdown',{pointerId:22,isPrimary:true,button:0,clientX:300,clientY:800,pointerType:'touch'});
  await preview.dispatchEvent('pointermove',{pointerId:22,isPrimary:true,clientX:300,clientY:750,pointerType:'touch'});
  await page.waitForTimeout(1100);
  assert.equal(await page.getByRole('tooltip').count(),0,'Moving to scroll cancels help');
  await preview.dispatchEvent('pointercancel',{pointerId:22,isPrimary:true});
  // Help on the live footer link must not navigate or open WhatsApp.
  await page.goto('http://localhost:8080/undangan.html?demo=1');
  await page.locator('.as-contact-wa').waitFor({state:'attached'});
  await page.evaluate(()=>document.body.classList.add('opened'));
  const wa=page.locator('.as-contact-wa');await wa.scrollIntoViewIfNeeded();await wa.focus();await page.keyboard.press('F1');
  assert((await page.getByRole('tooltip').textContent()).includes('0851-9675-5675'));
  assert.deepEqual(errors,[]);
  console.log('PASS: mouse/touch hold, short tap, F1/Escape, dynamic controls, scroll cancellation, mobile tooltip bounds and contact help.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
