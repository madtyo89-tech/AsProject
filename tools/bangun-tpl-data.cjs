#!/usr/bin/env node
/* bangun-tpl-data.cjs — tulis daftar tema untuk halaman admin terpisah
   (Studio Template & Setting Katalog) ke assets/tpl-data.js.

   Kenapa berkas terpisah: studio-template.html dan studio-katalog.html tidak
   boleh menyalin literal `const TPL` dari studio.html — itu akan jadi sumber
   kebenaran kedua yang cepat basi. Generator ini membaca sumber yang sama
   dengan tools/bangun-tpl.cjs (kerangka/template.js + motor.kompilasiLama),
   jadi urutan & isi tema selalu identik dengan studio.html/undangan.html.

   Jalankan: node tools/bangun-tpl-data.cjs
   (tools/bangun-tpl.cjs memanggilnya otomatis di akhir.) */
'use strict';
const fs = require('fs');
const path = require('path');

const AKAR = path.join(__dirname, '..');
const KELUARAN = path.join(AKAR, 'assets', 'tpl-data.js');
const { TEMPLATES } = require(path.join(AKAR, 'kerangka', 'template.js'));
const motor = require(path.join(AKAR, 'kerangka', 'motor.js'));

/* Bentuk baris = bentuk di studio.html & undangan.html, supaya halaman admin
   membaca field yang sama (id, nama, ev, g, accent, ink, pat, ft, layout, …). */
function baris(t) {
  const k = motor.kompilasiLama(t);
  const out = {
    id: k.id, nama: k.nama, ev: k.ev, harga: k.harga,
    g: k.g, accent: k.accent, ink: k.ink,
    deco: k.deco, pat: k.pat, ft: k.ft,
    layout: k.layout || null, orn: k.orn, border: k.border,
    cover: k.cover || 'amplop', buka: k.buka || 'pita'
  };
  if (k.badge) out.badge = k.badge;
  if (k.char) out.char = k.char;
  if (k.desc) out.desc = k.desc;
  if (k.kb) out.kb = k.kb;
  if (k.arch) out.arch = true;
  if (k.studioOnly) out.studioOnly = true;
  /* Metadata kerangka — hanya dipakai halaman admin untuk info & ekspor,
     tidak pernah dipakai renderer undangan. */
  out.kerangka = {
    token: t.token || null,
    shell: t.shell || null,
    susunan: t.susunan || null,
    ekstra: Array.isArray(t.ekstra) ? t.ekstra : [],
    vip: !!t.vip,
    baru: !!t.baru
  };
  return out;
}

function bangun() {
  const daftar = TEMPLATES.map(baris);
  const pub = daftar.filter(t => !t.studioOnly).length;
  const isi = '/* DIBANGKITKAN tools/bangun-tpl-data.cjs — JANGAN EDIT MANUAL.\n'
    + '   Sumber kebenaran: kerangka/{token-tema,registry-blok,template,motor}.js.\n'
    + '   Dipakai studio-template.html & studio-katalog.html. Urutan & id identik\n'
    + '   dengan const TPL di studio.html/undangan.html — ' + daftar.length + ' tema ('
    + pub + ' publik + ' + (daftar.length - pub) + ' Studio-only). */\n'
    + 'window.ASP_TPL=' + JSON.stringify(daftar, null, 0) + ';\n';
  fs.writeFileSync(KELUARAN, isi);
  return { jumlah: daftar.length, pub };
}

if (require.main === module) {
  const { jumlah, pub } = bangun();
  console.log('assets/tpl-data.js → ' + jumlah + ' tema (' + pub + ' publik + ' + (jumlah - pub) + ' Studio-only)');
}
module.exports = { bangun };
