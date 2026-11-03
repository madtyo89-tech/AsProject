/* Uji supabase-migrasi-aman.sql di Postgres sungguhan (PGlite/WASM).
 *
 * Yang dijaga:
 * - migrasi BISA dijalankan di database yang sudah berisi data (tanpa error);
 * - data undangan lama tidak berubah, policy kustom pemilik tidak terhapus;
 * - seed catalog_settings tidak menggandakan baris saat dijalankan berulang;
 * - tidak ada DROP TABLE / DROP COLUMN / TRUNCATE / DELETE di berkas migrasi;
 * - supabase-schema.sql (proyek baru) tetap aman dijalankan dua kali.
 *
 * Butuh paket opsional: npm i --no-save @electric-sql/pglite
 * Jalankan: node tools/test-supabase-migrasi.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const baca = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let ok = 0, fail = 0;
const t = (nama, cond, extra) => {
  if (cond) ok++; else fail++;
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + nama + (!cond && extra ? ' — ' + extra : ''));
};

(async () => {
  let PGlite;
  try { ({ PGlite } = require('@electric-sql/pglite')); }
  catch (e) {
    console.log('info  @electric-sql/pglite belum terpasang — uji migrasi Supabase dilewati');
    console.log('      pasang dengan: npm i --no-save @electric-sql/pglite');
    return;
  }

  const migrasi = baca('supabase-migrasi-aman.sql');
  const skema = baca('supabase-schema.sql');
  const hitung = async (db, sql) => Number((await db.query(sql)).rows[0].n);

  /* tiruan bagian Supabase yang dipakai policy */
  async function emulasi(db) {
    await db.exec(`
      create role anon; create role authenticated;
      create schema if not exists auth;
      create table if not exists auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create schema if not exists storage;
      create table if not exists storage.buckets (id text primary key, name text, public boolean);
      create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text);
    `);
  }

  /* ---------- A. proyek lama yang sudah berisi ---------- */
  {
    const db = new PGlite();
    await emulasi(db);
    await db.exec(`
      create table public.invitation_drafts (
        slug text primary key, name1 text not null default '', name2 text not null default '',
        venue text not null default '', event_date date, event_time time,
        music_url text, music_name text, theme integer not null default 0,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      );
      insert into public.invitation_drafts (slug, name1, name2, venue, theme)
        values ('rangga-alya', 'Rangga', 'Alya', 'Gedung A', 3), ('uji-lama', 'Uji', 'Lama', 'Gedung B', 5);
      create policy "policy kustom pemilik" on public.invitation_drafts for select using (true);
    `);

    await db.exec(migrasi);
    t('migrasi jalan di DB yang sudah berisi (tanpa error)', true);
    t('catalog_settings dibuat', (await hitung(db, "select count(*) n from pg_class where relname='catalog_settings'")) === 1);
    t('seed catalog_settings id=default tepat 1 baris', (await hitung(db, "select count(*) n from public.catalog_settings where id='default'")) === 1);
    t('kolom data ditambahkan ke invitation_drafts', (await hitung(db, "select count(*) n from information_schema.columns where table_name='invitation_drafts' and column_name='data'")) === 1);
    t('draft lama tetap 2 baris', (await hitung(db, 'select count(*) n from public.invitation_drafts')) === 2);
    t('isi draft lama tidak berubah', (await db.query("select theme from public.invitation_drafts where slug='rangga-alya'")).rows[0].theme === 3);
    t('policy kustom pemilik tidak terhapus', (await hitung(db, "select count(*) n from pg_policies where tablename='invitation_drafts' and policyname='policy kustom pemilik'")) === 1);
    t('policy baca draft dibuat', (await hitung(db, "select count(*) n from pg_policies where tablename='invitation_drafts' and policyname='public can read drafts'")) === 1);
    t('bucket music ada', (await hitung(db, "select count(*) n from storage.buckets where id='music'")) === 1);
    t('policy storage music dibuat', (await hitung(db, "select count(*) n from pg_policies where schemaname='storage' and policyname in ('public read music','public upload music')")) === 2);

    const policyAwal = await hitung(db, 'select count(*) n from pg_policies');
    await db.exec(migrasi);
    t('migrasi aman dijalankan ulang', true);
    t('seed tidak menggandakan baris', (await hitung(db, 'select count(*) n from public.catalog_settings')) === 1);
    t('jumlah policy tidak bertambah', (await hitung(db, 'select count(*) n from pg_policies')) === policyAwal);
    t('data draft tetap 2 baris setelah diulang', (await hitung(db, 'select count(*) n from public.invitation_drafts')) === 2);

    await db.exec('drop table public.catalog_settings;');
    await db.exec(migrasi);
    t('rollback + migrasi ulang memulihkan catalog_settings', (await hitung(db, "select count(*) n from public.catalog_settings where id='default'")) === 1);
    await db.close();
  }

  /* ---------- B. proyek baru ---------- */
  {
    const db = new PGlite();
    await emulasi(db);
    await db.exec(skema);
    t('supabase-schema.sql jalan di proyek kosong', true);
    t('tiga tabel inti ada', (await hitung(db, "select count(*) n from pg_class where relname in ('invitation_drafts','catalog_settings','studio_cloud_drafts')")) === 3);
    t('seed katalog 1 baris', (await hitung(db, 'select count(*) n from public.catalog_settings')) === 1);
    await db.exec(skema);
    t('skema penuh aman dijalankan dua kali', (await hitung(db, 'select count(*) n from public.catalog_settings')) === 1);
    await db.exec(migrasi);
    t('migrasi aman di DB yang sudah memakai skema penuh', (await hitung(db, "select count(*) n from pg_policies where tablename='catalog_settings'")) === 3);
    await db.close();
  }

  /* ---------- C. statis: tidak ada perintah merusak ---------- */
  const bersih = migrasi.replace(/--.*$/gm, '');
  t('migrasi tanpa DROP TABLE / DROP COLUMN / TRUNCATE / DELETE',
    !/drop\s+table/i.test(bersih) && !/drop\s+column/i.test(bersih) &&
    !/truncate/i.test(bersih) && !/\bdelete\s+from\b/i.test(bersih));
  t('semua create table memakai IF NOT EXISTS',
    (migrasi.match(/create table/gi) || []).length === (migrasi.match(/create table if not exists/gi) || []).length);
  /* buang komentar DAN isi string literal ('…') supaya teks penjelasan
     seperti 'jalankan INSERT ... DO NOTHING' tidak dihitung sebagai perintah */
  const kode = src => src.replace(/--.*$/gm, '').replace(/'(?:[^']|'')*'/g, "''");
  t('berkas diagnosa hanya membaca',
    !/drop\s|create\s|alter\s|insert\s|update\s|delete\s|truncate/i.test(kode(baca('supabase-diagnosa.sql'))));

  console.log('\nRingkasan: ' + ok + ' lulus, ' + fail + ' gagal');
  process.exitCode = fail ? 1 : 0;
})();
