-- ============================================================
-- BAGIAN 1 — Tabel draft (jalankan di Supabase SQL Editor)
-- ============================================================
create table if not exists public.invitation_drafts (
  slug text primary key,
  name1 text not null default '', name2 text not null default '',
  venue text not null default '', event_date date, event_time time,
  music_url text, music_name text, theme integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Snapshot lengkap per publish (form, doa, amplop, galeri, dsb) —
-- dibaca oleh undangan.html saat tamu membuka tautan.
-- Aman dijalankan ulang; diperlukan agar undangan live tampil
-- persis seperti di studio.
alter table public.invitation_drafts add column if not exists data jsonb;
alter table public.invitation_drafts enable row level security;

drop policy if exists "public can read drafts" on public.invitation_drafts;
drop policy if exists "public can insert drafts" on public.invitation_drafts;
drop policy if exists "public can update drafts" on public.invitation_drafts;
create policy "public can read drafts" on public.invitation_drafts for select using (true);
create policy "public can insert drafts" on public.invitation_drafts for insert with check (true);
create policy "public can update drafts" on public.invitation_drafts for update using (true) with check (true);

-- Bucket music (aman dijalankan ulang)
insert into storage.buckets (id,name,public) values ('music','music',true)
on conflict (id) do update set public=true;

-- ============================================================
-- BAGIAN 2 — Policy upload storage
-- ============================================================
-- Coba jalankan blok di bawah. JIKA MUNCUL ERROR
-- "must be owner of table objects", JANGAN PANIK — itu normal
-- di project Supabase baru. Buat policy lewat Dashboard:
--
--   Storage -> Buckets -> music -> Policies -> New policy
--   1) Policy name : public upload music
--      Operation   : INSERT
--      Target roles: anon  (atau biarkan default/public)
--      WITH CHECK  : bucket_id = 'music'
--   2) Policy name : public read music
--      Operation   : SELECT
--      Target roles: anon
--      USING       : bucket_id = 'music'
-- ============================================================
drop policy if exists "public upload music" on storage.objects;
drop policy if exists "public read music" on storage.objects;
create policy "public upload music" on storage.objects for insert to anon, authenticated with check (bucket_id='music');
create policy "public read music" on storage.objects for select to anon, authenticated using (bucket_id='music');
