-- ============================================================
-- AsProject — Tabel Check-in Panitia (fitur "Link Scan QR Panitia")
-- Dipakai oleh scan.html: panitia memindai QR tamu di pintu masuk,
-- hasilnya dicatat di sini dan tampil di dashboard Undangan Master.
--
-- Cara pakai: buka Supabase → SQL Editor → paste & Run sekali.
-- (Terpisah dari tabel rsvp: RSVP = "akan hadir", check-in = "sudah tiba".)
-- ============================================================

create table if not exists public.checkin (
  id bigint generated always as identity primary key,
  slug text not null,
  guest text not null,
  code text not null default '',
  checked_in_at timestamptz not null default now(),
  unique (slug, guest)
);

alter table public.checkin enable row level security;

-- Scanner panitia (halaman publik dengan kunci di link) boleh menulis/memperbarui
create policy "checkin_anon_insert" on public.checkin
  for insert to anon with check (true);
create policy "checkin_anon_update" on public.checkin
  for update to anon using (true);
-- Dashboard master boleh membaca rekap check-in
create policy "checkin_anon_read" on public.checkin
  for select to anon using (true);

-- Catatan keamanan (sama seperti tools/rsvp.sql): kunci API anon bersifat publik
-- di sisi klien, jadi siapa pun yang tahu nama & slug bisa mengisi tabel ini.
-- Risiko ini sudah diterima pada tabel rsvp; check-in hanya mencatat kehadiran.
