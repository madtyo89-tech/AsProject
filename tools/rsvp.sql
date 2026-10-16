-- ============================================================
-- AsProject — Tabel RSVP (dipakai fitur "Hadir / Tidak Hadir"
-- di undangan tamu + dashboard "Undangan Master")
-- Cara pakai: buka Supabase → SQL Editor → paste & Run.
-- Aman dijalankan berulang kali (setiap policy dibuat ulang).
-- ============================================================

create table if not exists public.rsvp (
  id bigint generated always as identity primary key,
  slug text not null,
  guest text not null,
  status text not null check (status in ('hadir','ragu','tidak')),
  pesan text not null default '',
  updated_at timestamptz not null default now(),
  unique (slug, guest)
);

alter table public.rsvp enable row level security;

-- Undangan tamu boleh mengirim RSVP (anon)
drop policy if exists "rsvp_anon_write" on public.rsvp;
create policy "rsvp_anon_write" on public.rsvp
  for insert to anon with check (true);

-- Buku tamu publik: semua tamu boleh membaca ucapan & status (anon).
-- Satu policy ini juga yang dipakai dashboard Undangan Master.
drop policy if exists "rsvp_anon_read" on public.rsvp;
create policy "rsvp_anon_read" on public.rsvp
  for select to anon using (true);

-- Tamu yang mengisi ulang RSVP meng-update barisnya sendiri (unique slug+guest)
drop policy if exists "rsvp_anon_update" on public.rsvp;
create policy "rsvp_anon_update" on public.rsvp
  for update to anon using (true) with check (true);

-- Optional (keamanan lebih longgar): kalau dashboard master ingin bisa
-- menyimpan perubahan info bank ke undangan, aktifkan baris ini.
-- Dampak: pemegang link tamu bisa memodifikasi draft undangan miliknya.
--
-- create policy "draft_anon_update" on public.invitation_drafts
--   for update to anon using (true) with check (true);

-- ============================================================
-- MIGRASI (jika tabel rsvp sudah ada dari versi sebelumnya):
-- jalankan blok berikut sekali di SQL Editor.
-- ============================================================
alter table public.rsvp add column if not exists pesan text not null default '';
alter table public.rsvp drop constraint if exists rsvp_status_check;
alter table public.rsvp add constraint rsvp_status_check check (status in ('hadir','ragu','tidak'));
