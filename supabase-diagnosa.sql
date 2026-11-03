-- ============================================================================
-- supabase-diagnosa.sql — HANYA MEMBACA. Tidak mengubah apa pun.
--
-- Jalankan di Supabase SQL Editor untuk melihat apa yang sudah ada dan apa
-- yang belum, sebelum/sesudah menjalankan supabase-migrasi-aman.sql.
-- ============================================================================

-- 1) Tabel yang dipakai AsProject: ada / belum
select objek,
       case when to_regclass(nama) is null then 'BELUM ADA' else 'ada' end as status
from (values
  ('invitation_drafts',   'public.invitation_drafts'),
  ('catalog_settings',    'public.catalog_settings'),
  ('studio_cloud_drafts', 'public.studio_cloud_drafts')
) as v(objek, nama);

-- 2) Kolom penting (snapshot jsonb) di invitation_drafts
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'invitation_drafts'
order by ordinal_position;

-- 3) Policy RLS per tabel (nama policy harus muncul di sini)
select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
  and tablename in ('invitation_drafts', 'catalog_settings', 'studio_cloud_drafts')
order by tablename, policyname;

-- 4) RLS menyala atau tidak
select relname as tabel, relrowsecurity as rls_aktif
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('invitation_drafts', 'catalog_settings', 'studio_cloud_drafts')
order by relname;

-- 5) Bucket musik + policy storage (kalau error hak akses, abaikan saja)
select id, name, public from storage.buckets where id = 'music';

select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('public read music', 'public upload music');

-- 6) Ringkasan kesiapan Setting Katalog
select case
  when to_regclass('public.catalog_settings') is null then
    'catalog_settings BELUM ADA → jalankan supabase-migrasi-aman.sql Bagian 1'
  when not exists (select 1 from public.catalog_settings where id = 'default') then
    'tabel ada tetapi baris id=default belum ada → jalankan ulang Bagian 1 (INSERT ... DO NOTHING)'
  else
    'Setting Katalog siap dipakai'
end as kesiapan_katalog;
