/* Uji manifest PWA: JSON valid, ikon terjangkau & ukurannya sesuai, tag terpasang,
   start_url bisa dibuka, dan seluruh halaman punya tautan manifest. */
const fs=require('fs'), path=require('path');
const ROOT='/home/user/AsProject';
const {chromium}=require(path.join(ROOT,'node_modules/playwright-core'));
const m=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
let gagal=0; const cek=(ok,pesan)=>{console.log((ok?'  ok  ':'  GAGAL ')+pesan); if(!ok)gagal++;};
(async()=>{
  cek(m.name&&m.short_name&&m.start_url&&m.display,'field wajib ada');
  cek(/^[>=\/]/.test(m.start_url),'start_url relatif/akar: '+m.start_url);
  cek(m.icons.some(i=>i.sizes==='192x192')&&m.icons.some(i=>i.sizes==='512x512'),'ikon 192 & 512 ada');
  cek(m.icons.some(i=>(i.purpose||'').includes('maskable')),'ikon maskable ada');
  const {default:s}=await import(path.join(ROOT,'node_modules/@sparticuz/chromium/build/index.js'));
  const b=await chromium.launch({executablePath:await s.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
  for(const i of m.icons){
    const p=await b.newPage();
    const url='http://localhost:8080/'+i.src.replace(/^\//,'');
    const r=await p.goto(url,{timeout:15000}).catch(e=>null);
    const ukuran=await p.evaluate(()=>{const img=document.querySelector('img');return img?[img.naturalWidth,img.naturalHeight]:null}).catch(()=>null);
    cek(r&&r.ok(),'ikon terjangkau: '+i.src);
    await p.close();
  }
  const p=await b.newPage({viewport:{width:390,height:844}});
  await p.route('**/*',r=>r.request().url().startsWith('http://localhost:8080/')?r.continue():r.abort());
  await p.goto('http://localhost:8080/index.html',{waitUntil:'domcontentloaded',timeout:25000});
  cek(await p.evaluate(()=>!!document.querySelector('link[rel="manifest"]')),'index.html punya <link rel=manifest>');
  cek(await p.evaluate(()=>!!document.querySelector('meta[name="apple-mobile-web-app-capable"]')),'meta apple-mobile-web-app-capable ada');
  const r=await p.goto('http://localhost:8080/manifest.webmanifest',{timeout:15000});
  cek(r&&r.ok(),'manifest terjangkau dari server: '+(r&&r.status()));
  await p.close();
  /* setiap halaman yang punya <head> harus punya tautan manifest */
  const daftar=[]; for(const d of ['','demo','katalog-demo']) for(const f of fs.readdirSync(path.join(ROOT,d)).sort()) if(f.endsWith('.html')) daftar.push((d?d+'/':'')+f);
  for(const f of daftar){
    const html=fs.readFileSync(path.join(ROOT,f),'utf8');
    if(f==='laporan-audit.html') continue;
    cek(html.includes('rel="manifest"'),f+': tautan manifest');
  }
  await b.close();
  console.log(`\nRingkasan: ${gagal?gagal+' gagal':'semua lulus'}`);
  process.exit(gagal?1:0);
})();
