#!/usr/bin/env node
/*
 * Uji tema & mesin VIP 4D (assets/vip-4d.js).
 *
 *   node tools/test-vip-4d.cjs
 *
 * Yang diperiksa:
 *   1. module vip-4d.js ada, mengekspor AsVip4d.mount, punya 4 jenis partikel,
 *      batas 40 partikel, guard prefers-reduced-motion & IntersectionObserver;
 *   2. undangan.html memuat module dan mount hanya bila template tier 'vip';
 *   3. studio.html menyematkan module ke file HTML mandiri (dlUndangan);
 *   4. 4 tema VIP identik paletnya di studio & undangan, membawa part/scene,
 *      harga 149000 + badge/tier VIP di studio;
 *   5. gating: efek fx ber-flag 'vip' terkunci selain tier VIP dan dilepas
 *      otomatis oleh paksaTier();
 *   6. artwork 4 tema VIP ada dan < 250 KB.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let lulus = 0, gagal = 0;
const cek = (k, p) => { k ? (lulus++) : (gagal++, console.log('  [FAIL] ' + p)); };

const MOD = 'assets/vip-4d.js';
cek(fs.existsSync(path.join(ROOT, MOD)), 'assets/vip-4d.js ada');
const src = baca(MOD);
cek(/window\.AsVip4d\s*=\s*\{\s*mount/.test(src), 'module mengekspor AsVip4d.mount');
for (const t of ['gold', 'petal', 'snow', 'bubble'])
  cek(new RegExp(t + ':').test(src), 'jenis partikel ' + t + ' tersedia');
cek(/i < 40/.test(src), 'partikel dibatasi 40');
cek(/prefers-reduced-motion/.test(src), 'guard prefers-reduced-motion');
cek(/IntersectionObserver/.test(src), 'pause partikel saat cover tak terlihat');
cek(/requestPermission/.test(src), 'izin gyroscope iOS lewat gestur pengguna');
/* module harus bisa dieval tanpa syntax error & mengekspor */
const ctx = { window: {}, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, document: { getElementById: () => null } };
ctx.window.matchMedia = ctx.matchMedia;
vm.runInNewContext(src, ctx, { filename: MOD });
cek(typeof ctx.window.AsVip4d.mount === 'function', 'module jalan & mount function');

const und = baca('undangan.html'), stu = baca('studio.html');
cek(und.includes('<script src="assets/vip-4d.js"></script>'), 'undangan.html memuat module');
cek(/tplF\.tier==='vip'&&window\.AsVip4d/.test(und), 'mount hanya saat template tier vip');
cek(/fetch\('assets\/vip-4d\.js'\)/.test(stu) && /vipJs\?/.test(stu), 'studio menyematkan module ke export mandiri');

/* Tema VIP diambil dari katalog, bukan daftar tetap: sejak 2026-10-10 katalog direset
   ke satu tema dasar sehingga tidak ada tema tier 'vip'. Mesin 4D & gating tetap diuji. */
const idVip = (s) => [...s.matchAll(/\{id:'([a-z0-9-]+)'[^\n]*?tier:'vip'/g)].map((m) => m[1]);
const VIP = idVip(stu).filter((id) => idVip(und).includes(id));
if (!VIP.length) console.log('  ..  katalog tanpa tema tier VIP — pemeriksaan pasangan tema dilewati');
function entri(s, id) {
  const m = s.match(new RegExp("\\{id:'" + id + "'[^\\n]*\\}"));
  return m ? m[0] : '';
}
for (const id of VIP) {
  const a = entri(stu, id), b = entri(und, id);
  cek(!!a && !!b, 'tema VIP ' + id + ' ada di studio & undangan');
  const pa = (a.match(/g:\[([^\]]*)\]/) || [])[1], pb = (b.match(/g:\[([^\]]*)\]/) || [])[1];
  cek(pa === pb && !!pa, id + ': palet identik');
  cek(/part:'(gold|petal|snow|bubble)'/.test(a) && /scene:'(zoom|curtain|rise)'/.test(a), id + ': part & scene di studio');
  cek(/part:'(gold|petal|snow|bubble)'/.test(b) && /scene:'(zoom|curtain|rise)'/.test(b), id + ': part & scene di undangan');
  cek(/tier:'vip'/.test(b), id + ": tier:'vip' di baris undangan (syarat mount 4D live)");
  cek(/harga:149000/.test(a) && /badge:'VIP'/.test(a) && /tier:'vip'/.test(a), id + ': harga 149k + badge/tier VIP');
  const art = (b.match(/bg3d:'([^']+)'/) || [])[1];
  if (art) {
    const f = path.join(ROOT, art);
    cek(fs.existsSync(f), id + ': artwork ' + art + ' ada');
    cek(fs.statSync(f).size < 250000, id + ': artwork < 250 KB');
  } else cek(false, id + ': rujukan artwork ada');
}
cek(/function bolehVip\(\)/.test(stu) && /function isVipFx\(/.test(stu), 'gating VIP: bolehVip & isVipFx');
cek(/isVipFx\(k,v\)&&!bolehVip\(\)/.test(stu), 'setAnim menolak fx VIP di tier bawah');
cek(/!bolehVip\(\)&&\(isVipFx\('effect'/.test(stu), 'paksaTier melepas fx VIP bila tier turun');
cek(stu.includes("tier==='vip'||t.harga>=149000"), 'tierAktif mengenal tier vip');

console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
