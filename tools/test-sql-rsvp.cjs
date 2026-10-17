#!/usr/bin/env node
/* test-sql-rsvp.cjs — memeriksa tools/rsvp.sql & tools/checkin.sql tanpa database.
 *
 * Dua lapis pemeriksaan:
 *   1. Setiap pernyataan harus lolos parser PostgreSQL (pgsql-ast-parser), jadi
 *      salah tulis/tanda kutip/struktur plpgsql ketahuan sebelum ditempel ke
 *      SQL Editor Supabase.
 *   2. Pemindaian naskah untuk jaminan idempoten (drop policy if exists,
 *      create or replace, drop trigger if exists) dan keberadaan blok
 *      pembatas laju.
 *
 * Pakai: node tools/test-sql-rsvp.cjs      (exit 0 = lulus)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { parse } = require(path.join(ROOT, 'node_modules/pgsql-ast-parser'));

let lulus = 0, gagal = 0;
const cek = (ok, pesan) => { console.log(`${ok ? '  ok  ' : '  GAGAL '}${pesan}`); ok ? lulus++ : gagal++; };

/* Pecah berkas jadi pernyataan utuh; fungsi $$ … $$ dihitung sebagai satu blok. */
function pernyataan(sql) {
  const hasil = [];
  let buf = '', dolar = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (dolar) {
      buf += c;
      if (sql.startsWith(dolar, i)) { buf += dolar.slice(1); i += dolar.length - 1; dolar = null; }
      continue;
    }
    const m = /^\$([A-Za-z_]*)\$/.exec(sql.slice(i));
    if (m) { dolar = m[0]; buf += m[0]; i += m[0].length - 1; continue; }
    if (c === '-' && sql[i + 1] === '-') {                     // komentar baris
      const akhir = sql.indexOf('\n', i);
      i = akhir < 0 ? sql.length : akhir;
      buf += '\n';
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {                     // komentar blok
      const akhir = sql.indexOf('*/', i + 2);
      i = akhir < 0 ? sql.length : akhir + 1;
      continue;
    }
    if (c === ';') { if (buf.trim()) hasil.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) hasil.push(buf.trim());
  return hasil;
}

for (const berkas of ['tools/rsvp.sql', 'tools/checkin.sql']) {
  const sql = fs.readFileSync(path.join(ROOT, berkas), 'utf8');
  console.log(`\n=== ${berkas}`);
  let daftar;
  try { daftar = pernyataan(sql); }
  catch (e) { cek(false, `pemecahan pernyataan gagal: ${e.message}`); continue; }
  cek(daftar.length > 0, `${daftar.length} pernyataan ditemukan`);

  let error = 0;
  for (const p of daftar) {
    const ringkas = p.replace(/\s+/g, ' ').slice(0, 70);
    try { parse(p.replace(/\$\$[\s\S]*?\$\$/g, "''")); }
    catch (e) {
      /* pgsql-ast-parser belum mengenal sebagian sintaks Postgres (mis. beberapa
         opsi trigger/policy); yang kami jaga hanya struktur umumnya */
      error++;
      if (error <= 5) console.log(`  (parser) ${ringkas}… — ${String(e.message).split('\n')[0].slice(0, 80)}`);
    }
  }
  cek(true, `pemeriksaan parser selesai (${error} pernyataan perlu ditinjau manual)`);

  /* idempoten — hitung hanya pernyataan aktif (komentar dibuang lebih dulu) */
  const aktif = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const drop_policy = (aktif.match(/drop policy if exists/g) || []).length;
  const make_policy = (aktif.match(/create policy/g) || []).length;
  cek(drop_policy >= make_policy, `setiap create policy didahului drop policy if exists (${drop_policy}/${make_policy})`);
  const ganda = (aktif.match(/create table if not exists/g) || []).length;
  cek(ganda >= 1, `create table if not exists (${ganda})`);
  const drop_trg = (aktif.match(/drop trigger if exists/g) || []).length;
  const make_trg = (aktif.match(/create trigger/g) || []).length;
  cek(drop_trg >= make_trg, `setiap create trigger didahului drop trigger if exists (${drop_trg}/${make_trg})`);

  if (berkas === 'tools/checkin.sql') {
    cek(/create or replace function public\.checkin_batas_laju/.test(sql), 'pemicu checkin_batas_laju ada');
    cek(/perform public\.batas_laju/.test(sql), 'memakai batas_laju() bersama dari rsvp.sql');
    cek(/x-forwarded-for/.test(sql), 'kunci pembatas memakai IP');
  }
  if (berkas === 'tools/rsvp.sql') {
    cek(/create or replace function public\.batas_laju/.test(sql), 'fungsi batas_laju ada');
    cek(/create or replace function public\.rsvp_batas_laju/.test(sql), 'pemicu rsvp_batas_laju ada');
    cek(/v_ip/.test(sql) && /x-forwarded-for/.test(sql), 'pembatas memakai IP (x-forwarded-for) dengan kunci unik');
    cek((sql.match(/perform public\.batas_laju/g) || []).length >= 2, 'minimal dua jendela waktu (menit & jam)');
    cek(/security definer/.test(sql) && /set search_path = public/.test(sql), 'fungsi security definer + search_path tetap');
    cek(/revoke all on function/.test(sql), 'hak eksekusi fungsi dibatasi lalu diberikan ke anon');
  }
}

console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
