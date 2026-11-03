#!/usr/bin/env node
/* pakai-proyek-supabase.cjs — memakai proyek Supabase yang SUDAH ADA.
 *
 * Tidak perlu membuat proyek baru. Alat ini:
 *   • memeriksa proyek mana yang sedang dipakai tiap halaman (--cek);
 *   • mengganti URL + anon key ke proyek lama Anda secara serentak di semua
 *     berkas, supaya studio, undangan, katalog, checkin, dan scan tidak
 *     menunjuk proyek berbeda (dry-run kecuali --tulis).
 *
 * Contoh:
 *   node tools/pakai-proyek-supabase.cjs --cek
 *   node tools/pakai-proyek-supabase.cjs --url https://abcdefghijkl.supabase.co --key eyJhbGciOi...
 *   node tools/pakai-proyek-supabase.cjs --url … --key … --tulis
 *
 * Keselamatan:
 *   • key wajib JWT dengan role "anon"; service_role DITOLAK (bisa membobol RLS);
 *   • ref di dalam key harus sama dengan ref di URL;
 *   • tanpa --tulis tidak ada berkas yang diubah.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BERKAS_RUNTIME = [
  'studio.html', 'undangan.html', 'master.html', 'checkin.html', 'scan.html',
  'assets/studio-core.js', 'assets/katalog-live.js'
];
const BERKAS_UJI = [
  'tools/test-mobile-browser.cjs', 'tools/test-publish-fallback.cjs', 'tools/test-supabase-keepalive.cjs'
];

const RE_URL = /https:\/\/([a-z0-9]{6,})\.supabase\.co/g;
const RE_KEY = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

function arg(nama, bawaan) {
  const i = process.argv.indexOf('--' + nama);
  if (i < 0) return bawaan;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

function bacaJWT(key) {
  const bagian = String(key).split('.');
  if (bagian.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(bagian[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch (e) { return null; }
}

function cekSekarang(root) {
  const baris = [];
  let ref = null, masalah = 0;
  /* Berkas uji boleh memuat contoh/fixture (mis. example.supabase.co), jadi
     hanya berkas runtime yang menentukan konsistensi proyek. */
  for (const rel of [...BERKAS_RUNTIME, ...BERKAS_UJI]) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const penting = BERKAS_RUNTIME.includes(rel);
    const isi = fs.readFileSync(p, 'utf8');
    const url = [...new Set([...isi.matchAll(RE_URL)].map(m => m[1]))];
    const keys = [...new Set(isi.match(RE_KEY) || [])];
    const roles = keys.map(k => (bacaJWT(k) || {}).role || '?');
    if (penting) {
      if (url.length !== 1) masalah++;
      else if (!ref) ref = url[0];
      else if (ref !== url[0]) masalah++;
      if (roles.some(r => r !== 'anon')) masalah++;
    }
    baris.push({
      berkas: rel, ref: url.join(',') || '—',
      role: [...new Set(roles)].join(',') || '—',
      jml: (isi.match(RE_URL) || []).length + '/' + (isi.match(RE_KEY) || []).length,
      penting: penting
    });
  }
  return { baris, ref, masalah };
}

function cetakCek(root) {
  const { baris, ref, masalah } = cekSekarang(root);
  console.log('Proyek Supabase yang dipakai: ' + (ref || 'TIDAK DITEMUKAN'));
  console.log('');
  console.log('berkas'.padEnd(36) + 'ref'.padEnd(24) + 'role'.padEnd(14) + 'url/key');
  for (const b of baris) {
    console.log((b.penting ? '  ' : '~ ') + b.berkas.padEnd(34) + b.ref.padEnd(24) + b.role.padEnd(14) + b.jml);
  }
  if (baris.some(b => !b.penting)) console.log('  (~ = berkas uji/fixture, tidak dihitung sebagai masalah)');
  console.log('');
  if (masalah) {
    console.log('MASALAH: ada halaman yang menunjuk proyek/role berbeda. Samakan dengan --tulis.');
    return 1;
  }
  console.log('KONSISTEN: semua halaman memakai satu proyek, key ber-role anon.');
  return 0;
}

function ganti(root, urlBaru, keyBaru) {
  const mUrl = /^https:\/\/([a-z0-9]{6,})\.supabase\.co$/.exec(String(urlBaru || ''));
  if (!mUrl) {
    console.error('URL tidak sah. Contoh: https://abcdefghijkl.supabase.co');
    return 1;
  }
  const refBaru = mUrl[1];
  const isiKey = bacaJWT(keyBaru);
  if (!isiKey) { console.error('Key bukan JWT yang bisa dibaca.'); return 1; }
  if (isiKey.role !== 'anon') {
    console.error('Key ber-role "' + isiKey.role + '". Hanya anon key yang boleh ditanam di halaman web.');
    console.error('service_role key bisa melewati RLS — jangan pernah ditaruh di repo.');
    return 1;
  }
  if (isiKey.ref && isiKey.ref !== refBaru) {
    console.error('Tidak cocok: key milik proyek "' + isiKey.ref + '", URL menunjuk "' + refBaru + '".');
    return 1;
  }

  const kunciTulis = arg('tulis', false) === true;
  let total = 0;
  for (const rel of [...BERKAS_RUNTIME, ...BERKAS_UJI]) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const asli = fs.readFileSync(p, 'utf8');
    const baru = asli.replace(RE_URL, urlBaru).replace(RE_KEY, keyBaru);
    if (baru === asli) { console.log('  = ' + rel + ' (tidak berubah)'); continue; }
    const n = (asli.match(RE_URL) || []).length + (asli.match(RE_KEY) || []).length;
    total += n;
    if (kunciTulis) fs.writeFileSync(p, baru);
    console.log('  ' + (kunciTulis ? '✓' : '·') + ' ' + rel + ' — ' + n + ' penggantian');
  }
  console.log('');
  console.log(kunciTulis
    ? 'Selesai: ' + total + ' penggantian ditulis. Jalankan node tools/bangun-tpl.cjs lalu cek-kesehatan.'
    : 'DRY-RUN: ' + total + ' penggantian akan dilakukan. Tambahkan --tulis untuk menerapkan.');
  if (kunciTulis) {
    const r = cekSekarang(root);
    console.log('Verifikasi ulang: ' + (r.ref || '?') + ' · masalah ' + r.masalah);
    return r.masalah ? 1 : 0;
  }
  return 0;
}

function main() {
  const root = String(arg('root', process.cwd()));
  if (process.argv.includes('--cek') || process.argv.length <= 2) return cetakCek(root);
  const url = arg('url', null), key = arg('key', null);
  if (!url || !key) {
    console.error('Butuh --url dan --key. Lihat --help.');
    return 1;
  }
  return ganti(root, url, key);
}

if (require.main === module) process.exitCode = main();
module.exports = { BERKAS_RUNTIME, BERKAS_UJI, cekSekarang, bacaJWT };
