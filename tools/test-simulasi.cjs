const blobText=(win,b)=>typeof b.text==='function'?b.text():new Promise((ok,no)=>{const r=new win.FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsText(b)});
/* Simulasi pemakaian nyata AsProject (jsdom, offline):
   1) studio.html  : boot, evPick 4 event, render 71 tema, 32 border ber-tier,
                     17 font, semua fx cover/scroll, render 8 tab, publish offline,
                     dlUndangan (export HTML mandiri)
   2) undangan.html: boot() live untuk 71 tema (per event), demo draft, RSVP offline
   3) hasil export : dibuka sebagai HTML mandiri (EMBEDDED_DATA) dan harus render
   Jalankan: node tools/test-simulasi.cjs   (butuh: npm i jsdom) */
'use strict';
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ok = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (!cond && extra ? ' — ' + extra : ''));
};

/* fetch stub: file lokal dilayani dari disk; URL luar (Supabase/CDN) gagal */
function stubFetch(w) {
  w.fetch = async url => {
    const u = String(url);
    if (/^https?:/.test(u) && !u.includes('x.test')) {
      return { ok: false, status: 0, text: async () => '', json: async () => ({}), blob: async () => new w.Blob([]) };
    }
    let p = decodeURIComponent(u.replace(/^https?:\/\/x\.test\//, '').split('?')[0]) || 'index.html';
    try {
      const buf = fs.readFileSync(path.join(ROOT, p));
      return {
        ok: true, status: 200,
        text: async () => buf.toString('utf8'),
        json: async () => JSON.parse(buf.toString('utf8')),
        blob: async () => new w.Blob([new Uint8Array(buf)], { type: 'application/octet-stream' }),
      };
    } catch (e) {
      return { ok: false, status: 404, text: async () => '', json: async () => ({}), blob: async () => new w.Blob([]) };
    }
  };
}
function stubCommon(w) {
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb } observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } };
  if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  stubFetch(w);
}

const FORM_MENIKAH = {
  namaPria: 'Rangga Pratama', namaWanita: 'Aisyah Kirana',
  putraPutri: 'Bpk. H. Ahmad Sujadi & Ibu Hj. Sri Rahayu',
  putriDari: 'Bpk. H. Muhammad Yusuf & Ibu Hj. Aminah',
  tanggalAcara: '2026-12-20', jamAcara: '08:00', venue: 'Ballroom Hotel Santika, Bandung',
  showBismillah: true, showMapsBtn: true,
};
const FORM_ANAK = ev => ({
  namaAnak: 'Arkana Zein', putraDari: 'Bpk. Dimas & Ibu Salsabila',
  umurAnak: '7', usia: '7', temaUltah: 'Dino Adventure', temaAqiqah: 'Baby Rose',
  tanggalAcara: '2026-11-15', jamAcara: '10:00', venue: 'Rumah Keluarga, Bandung',
});
function draftFor(tpl, idx) {
  const ev = tpl.ev === 'all' ? 'ultah' : tpl.ev;
  const isW = ev === 'pernikahan';
  return {
    slug: 'sim-' + tpl.id, name1: isW ? FORM_MENIKAH.namaPria : FORM_ANAK(ev).namaAnak,
    name2: isW ? FORM_MENIKAH.namaWanita : '', theme: idx,
    venue: FORM_MENIKAH.venue, event_date: FORM_MENIKAH.tanggalAcara, event_time: FORM_MENIKAH.jamAcara,
    data: {
      form: isW ? { ...FORM_MENIKAH } : { ...FORM_ANAK(ev) },
      event: ev, tpl: tpl.id, doa: ev,
      accent: tpl.accent, fontTitle: tpl.ft || 'playfair', fontBody: 'inter',
      border: tpl.tier === 'vip' ? 'vip-diamond' : tpl.tier === 'eksklusif' ? 'filigree' : (tpl.harga >= 89000 ? 'gold-leaf' : 'lace'),
      amplop: {}, slides: null, videoLink: '',
      anim: tpl.tier === 'vip'
        ? { effect: tpl.scene === 'curtain' ? 'vip-curtain' : 'vip-zoom', scroll: 'fade-up' }
        : { effect: 'zoom', scroll: 'fade-up' },
      music: { name: '', url: '' }, cover: '', coverStyle: 'kotak',
      coverPos: { x: 50, y: 50, z: 1 }, gallery: [], publishedAt: new Date().toISOString(),
    },
  };
}

(async () => {
  /* ============ 1) STUDIO ============ */
  console.log('— Simulasi studio.html —');
  let captured = null, capturedName = '';
  const domS = new JSDOM(read('studio.html'), {
    runScripts: 'dangerously', url: 'https://x.test/studio.html', pretendToBeVisual: true,
    beforeParse(w) {
      stubCommon(w);
      try { w.eval(read('assets/scroll-effects.js')); } catch (e) { /* stub clearScrollReveal di bawah */ }
      if (typeof w.clearScrollReveal !== 'function') w.clearScrollReveal = () => {};
      try { w.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w.eval(read('assets/vip-4d.js')); } catch (e) {}
      w.URL.createObjectURL = b => { captured = b; return 'blob:stub'; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { capturedName = this.download || ''; };
    },
  });
  const w = domS.window;
  await sleep(300);
  const evS = [];
  w.addEventListener('error', e => evS.push(String(e.message)));

  const tpls = w.eval('TPL.map(x=>[x.id,x.ev,x.tier||"",x.harga||0,x.char||"",x.deco||"",x.ft||""])');
  t('studio: boot & katalog tema terisi', tpls.length >= 1, 'dapat ' + tpls.length);
  /* Katalog direset 2026-10-10 ke satu tema dasar. Tema tier VIP untuk uji gating
     disuntik sebagai fixture runtime, bukan tema produksi. */
  const DASAR = tpls[0][0];
  const UJI_VIP_OBJ = { id: 'uji-vip', nama: 'VIP Uji Coba', ev: 'pernikahan', harga: 149000, tier: 'vip',
    g: ['#101014', '#1E2228', '#2A2E36'], accent: '#C9A86A', ink: '#F2F2F4', char: 'UJI',
    deco: '✦ ❖ ✦', pat: '', ft: 'cormorant', part: 'gold', scene: 'zoom' };
  const UJI_VIP = UJI_VIP_OBJ.id;
  w.eval(`TPL.push(${JSON.stringify(UJI_VIP_OBJ)})`);


  /* evPick 4 event */
  let evOk = 0;
  for (const ev of ['pernikahan', 'khitanan', 'ultah', 'aqiqah']) {
    try { w.eval(`evPick('${ev}')`); if (w.eval(`state.event==='${ev}'`)) evOk++; } catch (e) { evS.push('evPick ' + ev + ': ' + e.message); }
  }
  t('studio: evPick 4 event', evOk === 4, evOk + '/4');

  /* render semua tema katalog */
  let renderErr = null, nRender = 0;
  for (const [id] of tpls) {
    try {
      w.eval(`state.tpl='${id}';paksaTier();state.page='editor';state.tab='desain';render()`);
      nRender++;
    } catch (e) { if (!renderErr) renderErr = id + ': ' + e.message; }
  }
  t(`studio: render ${tpls.length}/${tpls.length} tema tanpa error`, nRender === tpls.length, renderErr || (nRender + "/" + tpls.length));

  /* border ber-tier: VIP boleh semua, basic terkunci */
  w.eval(`state.tpl='${UJI_VIP}'`);
  const borders = w.eval('BORDERS.map(b=>b.id)');
  let bAll = 0;
  for (const b of borders) { w.eval(`setBorder('${b}')`); if (w.eval(`state.border==='${b}'`)) bAll++; }
  t('studio: tier VIP bisa pakai 32/32 border', bAll === borders.length, bAll + '/' + borders.length);
  w.eval(`state.tpl='${DASAR}';state.border='double'`);
  w.eval(`setBorder('vip-diamond')`);
  const blocked1 = w.eval(`state.border==='double'`);
  w.eval(`setBorder('lace')`);
  const free1 = w.eval(`state.border==='lace'`);
  t('studio: tier basic — border VIP terkunci, border gratis lolos', blocked1 && free1);

  /* font: semua 17 di VIP; font eks terkunci di basic */
  const fonts = w.eval('FONTS.map(f=>f.id)');
  w.eval(`state.tpl='${UJI_VIP}'`);
  let fAll = 0;
  for (const f of fonts) { w.eval(`setFontK('fontTitle','${f}');setFontK('fontBody','${f}')`); if (w.eval(`state.fontTitle==='${f}'&&state.fontBody==='${f}'`)) fAll++; }
  t('studio: tier VIP bisa pakai 17/17 font', fAll === fonts.length, fAll + '/' + fonts.length);
  w.eval(`state.tpl='${DASAR}';setFontK('fontTitle','cinzel')`);
  t('studio: tier basic — font EKSKLUSIF terkunci', w.eval(`state.fontTitle!=='cinzel'`));

  /* fx cover & scroll: VIP semua; vip-fx terkunci di basic */
  const fxC = w.eval('FX_COVER.map(f=>f[0])'), fxS = w.eval('FX_SCROLL.map(f=>f[0])');
  w.eval(`state.tpl='${UJI_VIP}'`);
  let fxOk = 0;
  for (const f of fxC) { w.eval(`setAnim('effect','${f}')`); if (w.eval(`state.anim.effect==='${f}'`)) fxOk++; }
  for (const f of fxS) { w.eval(`setAnim('scroll','${f}')`); if (w.eval(`state.anim.scroll==='${f}'`)) fxOk++; }
  t('studio: tier VIP bisa pakai semua fx (' + (fxC.length + fxS.length) + ')', fxOk === fxC.length + fxS.length, fxOk + '/' + (fxC.length + fxS.length));
  w.eval(`state.tpl='${DASAR}';state.anim.effect='zoom';setAnim('effect','vip-zoom')`);
  t('studio: tier basic — fx VIP terkunci', w.eval(`state.anim.effect==='zoom'`));

  /* semua tab dirender, bebas 'undefined'/'NaN' bocor */
  const tabs = ['tabInfo', 'tabMaster', 'tabDesain', 'tabSlide', 'tabMusik', 'tabTamu', 'tabAmplop', 'tabDomain'];
  let tabBad = [];
  w.eval(`state.page='editor'`);
  for (const tb of tabs) {
    try {
      const html = w.eval(`${tb}()`);
      if (!html || html.length < 50) tabBad.push(tb + ':kosong');
      else if (/>NaN|>undefined|"undefined"|'undefined'/.test(html)) tabBad.push(tb + ':bocor undefined/NaN');
    } catch (e) { tabBad.push(tb + ':' + e.message); }
  }
  t('studio: 8 tab render bersih (tanpa undefined/NaN)', tabBad.length === 0, tabBad.join(' | '));

  /* publish offline: tidak boleh crash, _publishing harus lepas lagi */
  w.eval(`state.tpl='${UJI_VIP}';state.slug='simulasi-vip';state.event='pernikahan';state.doa='pernikahan'`);
  for (const k of Object.keys(FORM_MENIKAH)) w.eval(`setF('${k}',${JSON.stringify(String(FORM_MENIKAH[k]))})`);
  w.eval(`state.page='editor';state.tab='info';render()`);
  let pubErr = null;
  try { w.eval(`publish()`); await sleep(600); } catch (e) { pubErr = e.message; }
  t('studio: publish offline tidak crash & _publishing lepas', !pubErr && w.eval(`_publishing===false`), pubErr || ('_publishing=' + w.eval('_publishing')));
  t('studio: publish offline tidak meninggalkan root inert', w.eval(`document.getElementById('root').inert===false`));

  /* dlUndangan: export HTML mandiri (tema VIP) */
  captured = null; capturedName = '';
  w.eval(`state.event='ultah';state.doa='ultah';state.tpl='${UJI_VIP}';state.anim.effect='vip-zoom';state.border='vip-diamond';state.music={name:'',url:'',local:false}`);
  w.eval(`setF('namaAnak','Arkana Zein');setF('usia','7');setF('temaUltah','Royal Garden')`);
  let dlErr = null;
  try { await w.eval(`dlUndangan()`); } catch (e) { dlErr = e.message; }
  await sleep(200);
  t('studio: dlUndangan tanpa error & file dinamai', !dlErr && captured && capturedName.startsWith('undangan-'), dlErr || capturedName || 'tidak ada blob');
  let exp = '';
  if (captured) { try { exp = await blobText(w, captured); } catch (e) { exp = ''; } }
  t('export: memuat EMBEDDED_DATA + vip-4d + theme-contrast',
    exp.includes('window.EMBEDDED_DATA') && exp.includes('AsVip4d') && /contrast|kontras/i.test(exp),
    'EMBEDDED=' + exp.includes('window.EMBEDDED_DATA') + ' vip=' + exp.includes('AsVip4d'));
  t('export: TIDAK ada artefak NaN dari bug unary-plus', !/>\s*NaN\s*</.test(exp) && !exp.includes('</script>NaN') && !exp.includes('</script>0\n'));

  /* ============ 2) EXPORT DIBUKA MANDIRI ============ */
  console.log('— Simulasi HTML export mandiri —');
  if (exp) {
    const domE = new JSDOM(exp, {
      runScripts: 'dangerously', url: 'https://x.test/undangan.html', pretendToBeVisual: true,
      beforeParse(w2) { stubCommon(w2); },
    });
    await sleep(900);
    const wE = domE.window;
    const coverE = wE.document.getElementById('cover');
    t('export: boot mandiri → #cover terender', !!coverE);
    /* File export membawa TPL dari berkas (tanpa tema fixture) → suntik tema VIP yang
       sama lalu boot ulang, supaya jalur 'char' & mount 4D di file mandiri teruji. */
    try {
      wE.eval(`TPL.push(${JSON.stringify(UJI_VIP_OBJ)})`);
      wE.eval('boot(window.EMBEDDED_DATA)');
      await sleep(300);
    } catch (e) { t('export: boot ulang dengan tema fixture', false, e.message); }
    t('export: char kata tema tampil besar di cover', (() => {
      const c = wE.document.querySelector('.chara');
      return !!c && /font-size:(32|38|46)px/.test(c.getAttribute('style') || '');
    })(), (wE.document.querySelector('.chara') || {}).textContent);
    t('export: body dapat kelas vip4d (tema VIP)', wE.document.body.className.includes('vip4d'));
    domE.window.close();
  } else t('export: boot mandiri → #cover terender', false, 'export kosong');

  /* ============ 3) UNDANGAN LIVE, SEMUA TEMA KATALOG ============ */
  console.log('— Simulasi undangan.html (live, semua tema katalog) —');
  const domU = new JSDOM(read('undangan.html'), {
    runScripts: 'dangerously', url: 'https://x.test/undangan.html?slug=simulasi', pretendToBeVisual: true,
    beforeParse(w3) {
      stubCommon(w3);
      try { w3.eval(read('assets/scroll-effects.js')); } catch (e) {}
      try { w3.eval(read('assets/theme-contrast.js')); } catch (e) {}
      try { w3.eval(read('assets/vip-4d.js')); } catch (e) {}
    },
  });
  const wU = domU.window;
  await sleep(400);
  const tplsU = wU.eval('TPL.map(x=>x.id)');
  t('undangan: boot & katalog tema terisi', tplsU.length >= 1, 'dapat ' + tplsU.length);

  let bootErr = null, nBoot = 0, charBad = null, wedBad = null;
  for (let i = 0; i < tplsU.length; i++) {
    const id = tplsU[i];
    const row = wU.eval(`(function(){const x=TPL.find(y=>y.id==='${id}');return [x.ev,x.tier||'',x.char||'',x.deco||'']})()`);
    try {
      const draft = draftFor({ id, ev: row[0], tier: row[1] || '', accent: '#D4AF37', ft: 'playfair', harga: 0 }, i);
      wU.eval('boot(' + JSON.stringify(draft) + ')');
      nBoot++;
      const isW = (row[0] === 'pernikahan');
      const charEl = wU.document.querySelector('.chara');
      if (!isW && row[2] && !charEl) charBad = id + ': .chara hilang';
      if (!isW && row[2] && charEl && row[2].length > 2) {
        const fs2 = charEl.getAttribute('style') || '';
        if (!/font-size:(32|38|46)px/.test(fs2)) charBad = id + ': ukuran kata bukan 32/38/46px (' + fs2.slice(0, 60) + ')';
      }
      if (isW && !wU.document.body.className.includes('wedding-cover')) wedBad = id;
    } catch (e) { if (!bootErr) bootErr = id + ': ' + e.message; }
  }
  t(`undangan: boot ${tplsU.length}/${tplsU.length} tema tanpa error`, nBoot === tplsU.length, bootErr || (nBoot + "/" + tplsU.length));
  t('undangan: char kata selalu besar di cover non-wedding', !charBad, charBad || '');
  t('undangan: tema pernikahan selalu dapat kelas wedding-cover', !wedBad, wedBad || '');

  /* boot demo + VIP mount tidak melempar */
  let demoErr = null;
  try { wU.eval('boot(DEMO_DRAFT)'); } catch (e) { demoErr = e.message; }
  t('undangan: boot(DEMO_DRAFT) aman', !demoErr, demoErr || '');
  wU.eval(`TPL.push(${JSON.stringify(UJI_VIP_OBJ)})`);
  const vipTplIdx = wU.eval(`TPL.findIndex(x=>x.id==='${UJI_VIP}')`);
  let vipErr = null;
  try {
    wU.eval('boot(' + JSON.stringify(draftFor({ id: UJI_VIP, ev: 'ultah', tier: 'vip', accent: '#E5B7C4', ft: 'cormorant' }, vipTplIdx)) + ')');
  } catch (e) { vipErr = e.message; }
  t('undangan: tema VIP mount 4D tanpa melempar (canvas null → degrade)', !vipErr && wU.document.body.className.includes('vip4d'), vipErr || '');

  /* RSVP offline → toast, bukan crash */
  let rsvpErr = null;
  try { wU.eval('rsvpSave("hadir")'); await sleep(300); } catch (e) { rsvpErr = e.message; }
  t('undangan: rsvpSave offline → toast selamat', !rsvpErr && !!wU.document.getElementById('ivToast'), rsvpErr || '');

  /* error global yang tak tertangkap selama simulasi studio */
  t('studio: tidak ada error global tak tertangkap', evS.length === 0, evS.slice(0, 3).join(' | '));

  w.close(); wU.close(); domS.window.close();
  console.log(`\nRingkasan: ${ok} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Harness crash:', e); process.exit(2); });
