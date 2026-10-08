-- ============================================================
-- AsProject — Tabel RSVP (dipakai fitur "Hadir / Tidak Hadir"
-- di undangan tamu + dashboard "Undangan Master")
-- Cara pakai: buka Supabase → SQL Editor → paste & Run sekali.
-- ============================================================

create table if not exists public.rsvp (
  id bigint generated always as identity primary key,
  slug text not null,
  guest text not null,
  status text not null check (status in ('hadir','tidak')),
  updated_at timestamptz not null default now(),
  unique (slug, guest)
);

alter table public.rsvp enable row level security;

-- Undangan tamu boleh mengirim/memperbarui RSVP (anon)
create policy "rsvp_anon_write" on public.rsvp
  for insert to anon with check (true);
create policy "rsvp_anon_update" on public.rsvp
  for update to anon using (true);
-- Dashboard master (halaman publik) boleh membaca
create policy "rsvp_anon_read" on public.rsvp
  for select to anon using (true);

-- Optional (keamanan lebih longgar): kalau dashboard master ingin bisa
-- menyimpan perubahan info bank ke undangan, aktifkan baris ini.
-- Dampak: pemegang link tamu bisa memodifikasi draft undangan miliknya.
--
-- create policy "draft_anon_update" on public.invitation_drafts
--   for update to anon using (true) with check (true);
