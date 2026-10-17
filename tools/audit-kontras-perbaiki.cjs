#!/usr/bin/env node
/* audit-kontras-perbaiki.cjs — pengusul/penerap perbaikan kontras otomatis.
 *
 * Alur: jalankan axe-core lewat Chromium headless pada setiap halaman yang
 * diminta, lalu untuk tiap temuan `color-contrast`:
 *   1. hitung warna dasar teks sebelum dicampur — baik karena alfa di aturan
 *      CSS maupun karena kelas/gaya `opacity` pada elemen atau leluhurnya;
 *   2. cari aturan CSS yang benar-benar menang untuk elemen itu (dicocokkan
 *      dengan el.matches() di peramban, bukan menebak dari kelas);
 *   3. usulkan warna lebih gelap (hue dipertahankan) sampai rasio ≥ 4.5:1
 *      menurut latar sebenarnya, termasuk latar berwarna dan gradien padat.
 *
 * Pemakaian:
 *   node tools/audit-kontras-perbaiki.cjs <halaman...>          # kering (usul saja)
 *   node tools/audit-kontras-perbaiki.cjs --terap <halaman...>  # tulis perbaikan
 *
 * Yang ditulis hanya satu blok <style> berisi penimpaan color/background-color
 * (plus opacity bila perlu). Blok selalu diletakkan setelah gaya halaman —
 * di akhir <body> + `!important` bila halaman menaruh <style> setelah </head> —
 * dan diberi penanda "aksesibilitas-c" sehingga bisa dijalankan ulang
 * (idempoten: kondisi dasar dianalisis ulang setiap kali).
 *
 * Prasyarat: `python3 tools/serve.py 8080` jalan, paket dev playwright-core,
 * @sparticuz/chromium, dan axe-core terpasang.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'));
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PORT = process.env.PORT || 8080;
const args = process.argv.slice(2);
const TERAP = args.includes('--terap');
const PAGES = args.filter(a => !a.startsWith('--'));
const TARGET = 4.6;   // sedikit di atas 4.5 agar aman dari pembulatan

/* ---------- utilitas warna ---------- */
const hexToRgb = h => { const c = h.replace('#', ''); const v = c.length === 3 ? c.split('').map(x => x + x) : [c.slice(0, 2), c.slice(2, 4), c.slice(4, 6)]; return v.map(x => parseInt(x, 16)); };
const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const lum = ([r, g, b]) => { const f = x => { const y = x / 255; return y <= 0.03928 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const rasio = (a, b) => { const l1 = lum(hexToRgb(a)), l2 = lum(hexToRgb(b)); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + .05) / (lo + .05); };
const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
const toRgbHsl = ([h, s, l]) => { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; if (s === 0) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]; };
const campur = (w, bg, a) => w.map((c, i) => c * a + bg[i] * (1 - a));
const jarak = (a, b) => Math.max(...a.map((c, i) => Math.abs(c - b[i])));

/* Warna dasar yang, setelah dicampur latar dengan opasitas `op`, mencapai rasio target. */
function gelapkan(hex, bg, op = 1, target = TARGET) {
  const hsl = toHsl(hexToRgb(hex));
  const cek = c => rasio(rgbToHex(campur(hexToRgb(c), hexToRgb(bg), op)), bg) >= target;
  if (cek(hex)) return hex;
  for (let i = 1; i <= 100; i++) { const c = rgbToHex(toRgbHsl([hsl[0], hsl[1], hsl[2] * (1 - i / 100)])); if (cek(c)) return c; }
  return null;   // mustahil pada opasitas ini (mis. teks 50% di latar terang)
}
function terangkan(hex, bg, op = 1, target = TARGET) {
  const hsl = toHsl(hexToRgb(hex));
  const cek = c => rasio(rgbToHex(campur(hexToRgb(c), hexToRgb(bg), op)), bg) >= target;
  if (cek(hex)) return hex;
  for (let i = 1; i <= 100; i++) { const c = rgbToHex(toRgbHsl([hsl[0], hsl[1], Math.min(1, hsl[2] + (1 - hsl[2]) * i / 100)])); if (cek(c)) return c; }
  return null;
}
function parseWarna(v) {
  v = String(v || '').trim().replace(/var\([^)]*\)/gi, '1');
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(v))) {
    let c = m[1]; if (c.length === 3 || c.length === 4) c = c.split('').map(x => x + x).join('');
    const a = c.length === 8 ? parseInt(c.slice(6, 8), 16) / 255 : 1;
    return { rgb: hexToRgb('#' + c.slice(0, 6)), a };
  }
  if ((m = /^(?:rgb|rgba)\(([^)]+)\)$/i.exec(v))) {
    const t = m[1].replace(/\//g, ' ').replace(/,/g, ' ').trim().split(/\s+/);
    const a = t[3] !== undefined && !/^var\(/i.test(t[3]) ? parseFloat(t[3]) : 1;
    return { rgb: t.slice(0, 3).map(Number), a };
  }
  if ((m = /^(?:hsl|hsla)\(([^)]+)\)$/i.exec(v))) {
    const t = m[1].replace(/\//g, ' ').replace(/,/g, ' ').trim().split(/\s+/);
    const a = t[3] !== undefined ? parseFloat(t[3]) : 1;
    return { rgb: toRgbHsl([parseFloat(t[0]) / 360, parseFloat(t[1]) / 100, parseFloat(t[2]) / 100]), a };
  }
  return null;
}

/* ---------- pembacaan berkas ---------- */
const BLOK = /[ \t]*<!-- \[aksesibilitas-c\][\s\S]*?<\/style>\n/;
const cssDari = html => Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1]).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '\n');
const aturanCSS = css => Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), isi: m[2] }));
const norm = s => String(s || '').trim().replace(/\s+/g, '');
/* peta variabel warna: --nama → #hex (definisi pertama dianggap dasar) */
function petaVar(css) {
  const map = {};
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) if (!(m[1] in map)) map[m[1]] = { hex: m[2], sel: null };
  /* cari selector tempat variabel itu didefinisikan */
  for (const a of Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))) {
    for (const m of a[2].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) {
      const k = map[m[1]];
      if (k && k.hex.toLowerCase() === m[2].toLowerCase() && !k.sel) k.sel = a[1].trim().replace(/\s+/g, ' ');
    }
  }
  return map;
}
const varDari = teks => { const m = /var\(\s*--([\w-]+)/.exec(teks || ''); return m ? m[1] : null; };
const deklWarna = (isi, jenis) => new RegExp('(?:^|;)\\s*' + jenis + '\\s*:([^;]+)').exec(isi);

/* ---------- penelusuran di peramban ---------- */
const KUMPUL = () => {
  const rulesUntuk = el => {
    const hasil = [];
    const lihat = (el2, dariLeluhur) => {
    const telusuri = rs => {
      for (const ru of rs) {
        if (ru.selectorText) {
          let ya = false;
          try { ya = el2.matches(ru.selectorText); } catch (e) { ya = false; }
          if (ya) {
            const color = ru.style.getPropertyValue('color');
            const bg = ru.style.getPropertyValue('background-color') || ru.style.getPropertyValue('background');
            if (color || bg) hasil.push({ sel: ru.selectorText, color, bg, dariLeluhur, penting: ru.style.getPropertyPriority('color') === 'important' });
          }
        }
        /* aturan pengelompokan (@media/@supports) maupun CSS bersarang;
           catatan: CSSStyleRule juga punya .cssRules di peramban modern */
        if (ru.cssRules && ru.cssRules.length) telusuri(ru.cssRules);
      }
    };
    for (const sh of Array.from(document.styleSheets)) {
      let rs; try { rs = Array.from(sh.cssRules); } catch (e) { continue; }
      telusuri(rs);
    }
    };
    /* aturan yang menang di elemen itu sendiri, lalu — karena `color` diwarisi —
       aturan pada leluhur (maksimal 8 tingkat) */
    let node = el;
    for (let i = 0; node && node !== document.documentElement && i <= 8; i++, node = node.parentElement) lihat(node, i > 0);
    return hasil;
  };
  return { rulesUntuk };
};

(async () => {
  const { default: sparticuz } = await import(path.join(ROOT, 'node_modules/@sparticuz/chromium/build/index.js'));
  const browser = await chromium.launch({
    executablePath: await sparticuz.executablePath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-color-profile=srgb'],
    headless: true,
  });

  for (const p of PAGES) {
    /* nama untuk berkas: buang ?query (mis. master.html?demo=1) */
    const berkas = path.join(ROOT, p.split('?')[0]);
    const html0 = fs.readFileSync(berkas, 'utf8');
    /* analisis selalu dari kondisi dasar: blok hasil jalan sebelumnya dibuang,
       baik dari basis aturan CSS maupun dari berkas yang diuji peramban */
    const dasar = html0.replace(BLOK, '');
    if (dasar !== html0) fs.writeFileSync(berkas, dasar);
    const at = aturanCSS(cssDari(dasar));
    const vars = petaVar(cssDari(dasar));
    const gayaSetelahHead = /<\/head>[\s\S]*<style/i.test(dasar);

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let temuan = [];
    try {
      await page.route('**/*', r => r.request().url().startsWith(`http://localhost:${PORT}/`) ? r.continue() : r.abort());
      await page.goto(`http://localhost:${PORT}/` + p, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(800);
      /* tunggu animasi/transisi selesai supaya yang diukur keadaan akhir, bukan
         kerangka animasi (opasitas di tengah transisi bukan warna sebenarnya) */
      await page.evaluate(() => Promise.race([
        Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, 3000)),
      ]));
      await page.addScriptTag({ content: AXE });
      await page.addScriptTag({ content: `window.__kumpul = (${KUMPUL.toString()})();` });
      temuan = await page.evaluate(async () => {
        const r = await axe.run(document, { runOnly: ['color-contrast'] });
        const out = [];
        for (const v of r.violations) for (const n of v.nodes) {
          const d = (n.any && n.any[0] && n.any[0].data) || {};
          const el = document.querySelector(n.target[n.target.length - 1]);
          if (!el) continue;
          const kelas = [];
          let op = null, opElemen = 1, node = el;
          while (node && node !== document.documentElement && kelas.length < 80) {
            if (node.classList) for (const k of node.classList) if (!kelas.includes(k)) kelas.push(k);
            const st = getComputedStyle(node);
            if (st.opacity !== '1') {
              opElemen *= parseFloat(st.opacity);
              if (!op) op = { kelas: Array.from(node.classList).filter(x => /^opacity-\d+$/.test(x))[0] || null, nilai: st.opacity };
            }
            node = node.parentElement;
          }
          out.push({
            fg: d.fgColor, bg: d.bgColor, fgA: d.fgAlpha, bgA: d.bgAlpha,
            kelas, op, opElemen, sel: n.target.join(' '),
            aturan: window.__kumpul.rulesUntuk(el),
            inline: el.getAttribute('style') || '',
          });
        }
        return out;
      });
    } catch (e) { console.log(`${p}: GAGAL — ${String(e).split('\n')[0]}`); await page.close(); continue; }
    await page.close();
    if (!temuan.length) { console.log(`${p}: tidak ada temuan kontras`); continue; }

    const override = new Map();
    const alasan = [];
    const penting = gayaSetelahHead;
    const tambah = (sel, decl, ket) => {
      if (!override.has(sel)) override.set(sel, { dec: {}, ket });
      const dec = override.get(sel).dec;
      for (const [k, v] of Object.entries(decl)) {
        /* satu kelas bisa muncul di beberapa latar: pakai warna terkelap */
        if (/^(color|background-color|--[\w-]+)$/.test(k) && /^#[0-9a-f]{6}$/i.test(v) && /^#[0-9a-f]{6}$/i.test(dec[k] || '')) {
          if (lum(hexToRgb(v)) >= lum(hexToRgb(dec[k]))) continue;
        }
        dec[k] = v;
      }
      alasan.push(`  ${sel} { ${Object.entries(decl).map(([a, v]) => `${a}:${v}`).join('; ')} }  ← ${ket}`);
    };

    /* urutkan: temuan "teks putih di latar berwarna" lebih dulu, karena
       perbaikan latar itu mengubah latar efektif untuk temuan lain di bawahnya */
    const urut = t => (/^#[0-9a-f]{3,6}$/i.exec(t.fg) && hexToRgb(t.fg).every(x => x > 235) ? 0 : 1);
    temuan.sort((a2, b2) => urut(a2) - urut(b2));
    const bgBaru = new Map();   // latar lama → latar hasil perbaikan
    for (const d of temuan) {
      if (!/^#[0-9a-f]{3,6}$/i.test(d.fg) || !/^#[0-9a-f]{3,6}$/i.test(d.bg)) continue;
      const fgRgb = hexToRgb(d.fg), bgRgb = hexToRgb(d.bg);
      const alfa = (d.fgA !== undefined && d.fgA < 1) ? d.fgA : (d.opElemen && d.opElemen < 1 ? d.opElemen : 1);
      /* latar efektif: kalau latar ini sudah diperbaiki di temuan sebelumnya */
      const bgEfektif = bgBaru.get(String(d.bg).toLowerCase()) || d.bg;
      const sumber = alfa < 1 ? fgRgb.map((c, i) => Math.max(0, Math.min(255, (c - bgRgb[i] * (1 - alfa)) / alfa))) : fgRgb;
      const fgCari = rgbToHex(sumber);
      const putih = fgRgb.every(x => x > 235);
      /* opasitas akhir yang akan dipakai: bila elemen memang tertutup opasitas,
         blok ini menaikkannya ke 0.92 supaya teks tetap terbaca */
      const opRencana = alfa < 1 ? 0.92 : 1;
      const cocokKelas = at.filter(a => d.kelas.some(k => k && a.sel.includes(k.replace(/([^\w-])/g, '\\$1'))));

      /* opasitas leluhur: dinaikkan lebih dulu (mis. 0.6 → 0.92) supaya warna yang
         dipilih di bawah ini sudah memperhitungkan opasitas akhirnya */
      if (d.op && d.op.kelas) {
        tambah('.' + d.op.kelas, { opacity: '0.92' }, `opasitas ${d.op.nilai} → 0.92 (${d.sel.slice(0, 40)})`);
        d.opElemen = Math.max(0.92, d.opElemen || 1);
        d.alfaTertinggi = 0.92;
      }
      /* warna mentah dari aturan, dengan var(--…) diresolusi lewat peta variabel */
      const warnaAturan = (r, jenis) => {
        const teks = jenis === 'color' ? r.color : r.bg;
        if (!teks) return null;
        const v = varDari(teks);
        if (v && vars[v]) return parseWarna(vars[v].hex);
        return parseWarna(teks);
      };
      if (putih) {
        const jenis = alfa < 1 ? 'teks putih transparan di latar berwarna' : 'teks putih di latar berwarna';
        const cocok = (d.aturan || []).filter(r => r.bg).map(r => ({ sel: r.sel, w: warnaAturan(r, 'bg'), varNama: varDari(r.bg) })).filter(x => x.w)
          .find(x => jarak(campur(x.w.rgb, [255, 255, 255], x.w.a), bgRgb) <= 12);
        if (cocok) {
          const baru = gelapkan(d.bg, '#ffffff');
          const dec = { 'background-color': baru };
          if (cocok.w.a < 1) dec['--tw-bg-opacity'] = '1';
          /* kalau warna datang dari variabel, timpa definisi variabelnya sekalian
             supaya seluruh pemakaiannya konsisten */
          bgBaru.set(d.bg.toLowerCase(), baru);
          const tuju = cocok.varNama && vars[cocok.varNama] && vars[cocok.varNama].sel ? vars[cocok.varNama].sel : cocok.sel;
          if (tuju === cocok.sel) tambah(tuju, dec, `${jenis} (${rgbToHex(cocok.w.rgb)} → ${baru}, putih ${rasio(baru, '#ffffff').toFixed(2)}:1)`);
          else tambah(tuju, { ['--' + cocok.varNama]: baru }, `${jenis} lewat variabel --${cocok.varNama} (${rgbToHex(cocok.w.rgb)} → ${baru}, putih ${rasio(baru, '#ffffff').toFixed(2)}:1)`);
        } else alasan.push(`  (lewati) ${jenis}: tak ada aturan latar cocok untuk ${d.bg} — ${d.sel.slice(0, 70)}`);
      } else {
        const kandidat = (d.aturan || []).filter(r => r.color).map(r => ({ sel: r.sel, penting: r.penting, dariLeluhur: r.dariLeluhur, varNama: varDari(r.color), w: warnaAturan(r, 'color') })).filter(x => x.w)
          .filter(x => jarak(x.w.rgb, sumber) <= 12 || jarak(campur(x.w.rgb, bgRgb, x.w.a), fgRgb) <= 12)
          /* utamakan aturan pada elemen itu sendiri (warisan dipakai sebagai cadangan) */
          .sort((x, y) => (x.dariLeluhur ? 1 : 0) - (y.dariLeluhur ? 1 : 0));
        const mInline = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(d.inline);
        const inline = mInline ? parseWarna(mInline[1]) : null;
        if (!kandidat.length && inline) {
          /* warna datang dari atribut style="" — perbaikan harus menyentuh markup */
          const baru = gelapkan(rgbToHex(inline.rgb), d.bg, opRencana);
          alasan.push(`  (manual) warna dari style="${d.inline.slice(0, 60)}" → ${baru || 'perlu ubah opasitas'} — ${d.sel.slice(0, 60)}`);
          continue;
        }
        if (kandidat.length) {
          let terpilih = null, terburuk = 99;
          for (const k of kandidat) {
            const opEfektif = k.w.a < 1 ? 1 : opRencana;
            const solid = rgbToHex(k.w.rgb);
            /* kalau aturan aslinya setengah transparan, cukup dibuat pekat —
               asal warna pekatnya lolos; kalau tidak, baru dicari warna lain */
            const pasang = rasio(solid, bgEfektif) >= 4.5 ? solid
              : (gelapkan(solid, bgEfektif, opEfektif) || terangkan(solid, bgEfektif, opEfektif) || solid);
            if (lum(hexToRgb(pasang)) < terburuk) { terburuk = lum(hexToRgb(pasang)); terpilih = { aturan: k, warna: pasang, alfa: k.w.a < 1 }; }
          }
          const vn = terpilih.aturan.varNama;
          if (vn && vars[vn] && vars[vn].sel) {
            tambah(vars[vn].sel, { ['--' + vn]: terpilih.warna }, `teks ${d.fg} di latar ${d.bg} → variabel --${vn}: ${terpilih.warna} (${rasio(terpilih.warna, d.bg).toFixed(2)}:1)`);
          } else {
            const decl = { color: terpilih.warna };
            if (terpilih.alfa) decl['--tw-text-opacity'] = '1';
            const latarCatat = bgEfektif.toLowerCase() === String(d.bg).toLowerCase() ? d.bg : `${d.bg} (kini ${bgEfektif})`;
            const nilaiCatat = terpilih.warna.replace(/^rgb\((.*)\)$/, (m, isi) => '#' + isi.trim().split(/\s+/).map(x => (+x).toString(16).padStart(2, '0')).join(''));
            tambah(terpilih.aturan.sel, decl, `teks ${d.fg} di latar ${latarCatat}${alfa < 1 ? ` (opasitas ${alfa} → ${nilaiCatat})` : ` → ${nilaiCatat} (${rasio(nilaiCatat, bgEfektif).toFixed(2)}:1)`}`);
          }
        } else alasan.push(`  (lewati) teks ${d.fg} (sumber ${fgCari}, opasitas ${alfa}) di ${d.bg}: tak ada aturan warna cocok — ${d.sel.slice(0, 70)}`);
      }
    }

    console.log(`\n=== ${p} (${temuan.length} temuan → ${override.size} aturan timpa)${gayaSetelahHead ? ' [gaya setelah </head> → blok di akhir body + !important]' : ''} ===`);
    for (const a of alasan) console.log(a);
    if (!override.size) continue;

    const baris = [];
    for (const [sel, o] of override) {
      const ket = o.ket.replace(/\*\//g, '');
      const nilaiHex = (/→ (#[0-9a-f]{6})/i.exec(ket) || [])[1];
      const latarHex = (/latar (#[0-9a-f]{6})/i.exec(ket) || [])[1];
      const putihDiLatar = /putih ([0-9.]+):1/.exec(ket);
      const rasioKet = nilaiHex && latarHex ? ` (rasio ${rasio(nilaiHex, latarHex).toFixed(2)}:1)`
        : (putihDiLatar ? ` (putih ${putihDiLatar[1]}:1)` : '');
      baris.push(`  /* ${sel} — ${ket.slice(0, 120)}${rasioKet} */`);
      const pakaiPenting = penting && !sel.startsWith(':root') && !sel.startsWith('html');
      baris.push(`  ${sel}{${Object.entries(o.dec).map(([k, v]) => `${k}:${v}${pakaiPenting ? '!important' : ''}`).join(';')}}`);
    }
    const blok = [
      '<!-- [aksesibilitas-c] Warna teks/latar yang gagal rasio kontras WCAG AA (4.5:1) menurut',
      '     axe-core digantikan versi lebih gelap. Hanya properti color/background-color/opacity',
      '     yang diubah; tata letak, font, dan gaya lain tidak tersentuh.',
      '     Rincian lengkap ada di LAPORAN-AUDIT-2026-10-16.md. -->',
      '<style>',
      ...baris,
      '</style>',
    ].join('\n');
    if (TERAP) {
      const jangkar = gayaSetelahHead ? '</body>' : '</head>';
      if (!dasar.includes(jangkar)) { console.log(`  (gagal) tidak menemukan ${jangkar}`); continue; }
      fs.writeFileSync(berkas, dasar.replace(jangkar, blok + '\n' + jangkar));
      console.log(`  → ditulis: ${p}`);
    }
  }
  await browser.close();
})().catch(e => { console.error(String(e).split('\n')[0]); process.exit(1); });
