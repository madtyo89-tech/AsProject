/* Uji tools/pakai-proyek-supabase.cjs — memakai proyek Supabase yang SUDAH ADA.
 *
 * Yang dijaga:
 * - --cek melaporkan satu proyek dan konsisten pada repo ini;
 * - penggantian URL+key dilakukan serentak di semua berkas runtime;
 * - service_role key DITOLAK (bisa melewati RLS, tidak boleh di repo);
 * - key yang ref-nya tidak cocok dengan URL DITOLAK;
 * - tanpa --tulis tidak ada berkas yang berubah (dry-run).
 *
 * Jalankan: node tools/test-pakai-supabase.cjs
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'pakai-proyek-supabase.cjs');
const { BERKAS_RUNTIME, cekSekarang, bacaJWT } = require(TOOL);

let ok = 0, fail = 0;
const t = (nama, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + nama + (!cond && extra ? ' — ' + extra : ''));
};

const jwt = (ref, role) => {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ iss: 'supabase', ref, role, iat: 1, exp: 9999999999 }) + '.tanda';
};

/* ---------- 1. kondisi repo sekarang ---------- */
const sekarang = cekSekarang(ROOT);
t('repo: semua berkas runtime menunjuk satu proyek', sekarang.masalah === 0, JSON.stringify({ ref: sekarang.ref, masalah: sekarang.masalah }));
t('repo: key ber-role anon', sekarang.baris.filter(b => b.penting).every(b => b.role === 'anon'));

/* ---------- 2. salinan sementara untuk uji tulis ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asp-sb-'));
for (const rel of [...BERKAS_RUNTIME, 'tools/test-publish-fallback.cjs']) {
  const asal = path.join(ROOT, rel);
  if (!fs.existsSync(asal)) continue;
  const tujuan = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(tujuan), { recursive: true });
  fs.copyFileSync(asal, tujuan);
}
const asli = Object.fromEntries(BERKAS_RUNTIME.filter(r => fs.existsSync(path.join(tmp, r))).map(r => [r, fs.readFileSync(path.join(tmp, r), 'utf8')]));

const baruRef = 'proyekbaru123';
const anonBaru = jwt(baruRef, 'anon');
const service = jwt(baruRef, 'service_role');
const jalankan = (...a) => {
  try { return { kode: 0, out: execFileSync('node', [TOOL, ...a], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { return { kode: e.status || 1, out: (e.stdout || '') + (e.stderr || '') }; }
};

const dry = jalankan('--root', tmp, '--url', `https://${baruRef}.supabase.co`, '--key', anonBaru);
t('dry-run berhasil tanpa mengubah berkas',
  dry.kode === 0 && /DRY-RUN/.test(dry.out) &&
  BERKAS_RUNTIME.filter(r => asli[r]).every(r => fs.readFileSync(path.join(tmp, r), 'utf8') === asli[r]));

const tolakService = jalankan('--root', tmp, '--url', `https://${baruRef}.supabase.co`, '--key', service, '--tulis');
t('service_role DITOLAK', tolakService.kode !== 0 && /service_role/.test(tolakService.out));

const tolakRef = jalankan('--root', tmp, '--url', 'https://lainlagi9999.supabase.co', '--key', anonBaru, '--tulis');
t('key dengan ref berbeda DITOLAK', tolakRef.kode !== 0 && /Tidak cocok/.test(tolakRef.out));
t('penolakan tidak mengubah berkas', BERKAS_RUNTIME.filter(r => asli[r]).every(r => fs.readFileSync(path.join(tmp, r), 'utf8') === asli[r]));

const tulis = jalankan('--root', tmp, '--url', `https://${baruRef}.supabase.co`, '--key', anonBaru, '--tulis');
t('--tulis berhasil & verifikasi ulang 0 masalah', tulis.kode === 0 && /Verifikasi ulang: proyekbaru123 · masalah 0/.test(tulis.out), tulis.out.slice(-200));
t('semua berkas runtime benar-benar berganti proyek',
  BERKAS_RUNTIME.filter(r => asli[r]).every(r => {
    const isi = fs.readFileSync(path.join(tmp, r), 'utf8');
    return isi.includes(`https://${baruRef}.supabase.co`) && !isi.includes('aalrhvirqwjtbbxmteeg');
  }));
t('key baru tertanam di semua berkas runtime', BERKAS_RUNTIME.filter(r => asli[r]).every(r => fs.readFileSync(path.join(tmp, r), 'utf8').includes(anonBaru)));
t('cek pada salinan menyatakan konsisten', cekSekarang(tmp).masalah === 0 && cekSekarang(tmp).ref === baruRef);
t('JWT baru terbaca sebagai anon', bacaJWT(anonBaru).role === 'anon');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
process.exitCode = fail ? 1 : 0;
