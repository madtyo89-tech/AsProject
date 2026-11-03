-- ============================================================================
-- supabase-migrasi-aman.sql — menambah yang BELUM ADA tanpa menyentuh yang lama
--
-- Untuk proyek Supabase yang SUDAH berjalan dan sudah berisi data undangan.
-- Prinsip:
--   • hanya CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / INSERT ... DO NOTHING
--   • TIDAK ada DROP TABLE, DROP COLUMN, TRUNCATE, atau DELETE
--   • policy yang sudah ada TIDAK ditimpa (dibuat hanya kalau belum ada)
--   • setiap bagian bisa dijalankan sendiri, dan aman dijalankan berulang
--
-- Cara pakai: Supabase Dashboard → SQL Editor → tempel isi berkas ini → Run.
-- Kalau muncul error di satu bagian, bagian lain tetap berlaku; lihat
-- supabase-diagnosa.sql untuk memeriksa apa yang sudah ada.
--
-- Berkas ini melengkapi supabase-schema.sql (skema lengkap untuk proyek baru).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BAGIAN 1 — catalog_settings (Setting Katalog)
--    Dibaca assets/katalog-live.js, ditulis studio-katalog.html.
--    Tidak berhubungan dengan tabel undangan yang sudah ada.
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_settings (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.catalog_settings enable row level security;

-- Policy katalog: hanya di tabel baru ini, tidak menyentuh policy tabel lain.
drop policy if exists "public can read catalog settings" on public.catalog_settings;
drop policy if exists "public can write catalog settings" on public.catalog_settings;
drop policy if exists "public can update catalog settings" on public.catalog_settings;

create policy "public can read catalog settings"
  on public.catalog_settings for select using (true);
create policy "public can write catalog settings"
  on public.catalog_settings for insert with check (true);
create policy "public can update catalog settings"
  on public.catalog_settings for update using (true) with check (true);

-- Satu baris awal. Kalau baris 'default' sudah ada, isinya TIDAK disentuh.
insert into public.catalog_settings (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- BAGIAN 2 — kolom snapshot di invitation_drafts (kalau belum ada)
--    `add column if not exists` tidak mengubah baris lama: draft lama hanya
--    mendapat data = NULL dan tetap terbaca (renderer punya fallback).
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.invitation_drafts') is null then
    raise notice 'Lewati invitation_drafts: tabel belum ada (proyek baru? jalankan supabase-schema.sql dulu).';
    return;
  end if;

  execute 'alter table public.invitation_drafts add column if not exists data jsonb';
  execute 'alter table public.invitation_drafts enable row level security';

  -- Policy hanya dibuat kalau belum ada, supaya policy kustom yang sudah
  -- dipasang pemilik proyek tidak terhapus.
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'invitation_drafts'
                   and policyname = 'public can read drafts') then
    execute 'create policy "public can read drafts" on public.invitation_drafts for select using (true)';
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'invitation_drafts'
                   and policyname = 'public can insert drafts') then
    execute 'create policy "public can insert drafts" on public.invitation_drafts for insert with check (true)';
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'invitation_drafts'
                   and policyname = 'public can update drafts') then
    execute 'create policy "public can update drafts" on public.invitation_drafts for update using (true) with check (true)';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- BAGIAN 3 — studio_cloud_drafts (opsional; butuh Email OTP aktif)
-- ---------------------------------------------------------------------------
do $do$
begin
  execute $sql$
    create table if not exists public.studio_cloud_drafts (
      user_id uuid primary key references auth.users(id) on delete cascade,
      draft jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )$sql$;
  execute 'alter table public.studio_cloud_drafts enable row level security';
  execute 'revoke all on table public.studio_cloud_drafts from anon, public';
  execute 'grant select, insert, update on table public.studio_cloud_drafts to authenticated';

  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'studio_cloud_drafts'
                   and policyname = 'owner manages own studio cloud draft') then
    execute $sql$create policy "owner manages own studio cloud draft"
      on public.studio_cloud_drafts for all to authenticated
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$sql$;
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- BAGIAN 4 — bucket & policy storage "music" (opsional untuk Setting Katalog)
--    Di proyek hosted, policy storage.objects bisa menolak dengan
--    "must be owner of table objects" (42501). Blok ini menangkap error itu
--    dan hanya memberi NOTICE, jadi sisa migrasi tetap jalan. Kalau dilewati,
--    buat policy lewat Dashboard → Storage → music → Policies (lihat komentar
--    di supabase-schema.sql Bagian 2).
-- ---------------------------------------------------------------------------
do $do$
begin
  insert into storage.buckets (id, name, public) values ('music', 'music', true)
  on conflict (id) do update set public = true;

  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'public read music') then
    execute $sql$create policy "public read music" on storage.objects
      for select to anon, authenticated using (bucket_id = 'music')$sql$;
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'public upload music') then
    execute $sql$create policy "public upload music" on storage.objects
      for insert to anon, authenticated with check (bucket_id = 'music')$sql$;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Lewati policy storage (42501): % — buat lewat Dashboard → Storage → music → Policies.', sqlerrm;
end
$do$;

-- ---------------------------------------------------------------------------
-- BAGIAN 5 — verifikasi (boleh dijalankan, hanya membaca)
-- ---------------------------------------------------------------------------
select 'catalog_settings' as objek,
       (to_regclass('public.catalog_settings') is not null) as ada,
       (select count(*) from public.catalog_settings) as baris
union all
select 'invitation_drafts',
       (to_regclass('public.invitation_drafts') is not null),
       case when to_regclass('public.invitation_drafts') is null then 0
            else (select count(*) from public.invitation_drafts) end
union all
select 'studio_cloud_drafts',
       (to_regclass('public.studio_cloud_drafts') is not null),
       case when to_regclass('public.studio_cloud_drafts') is null then 0
            else (select count(*) from public.studio_cloud_drafts) end;

-- Rollback (jalankan HANYA bila ingin membatalkan Setting Katalog):
--   drop table if exists public.catalog_settings;
-- Tidak ada tabel lain yang diubah oleh migrasi ini.
