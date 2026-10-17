-- ============================================================
-- AsProject — Tabel Check-in Panitia (fitur "Link Scan QR Panitia")
-- Dipakai oleh scan.html: panitia memindai QR tamu di pintu masuk,
-- hasilnya dicatat di sini dan tampil di dashboard Undangan Master.
--
-- Cara pakai: buka Supabase → SQL Editor → paste & Run.
-- Aman dijalankan berulang kali (setiap policy dibuat ulang).
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
drop policy if exists "checkin_anon_insert" on public.checkin;
create policy "checkin_anon_insert" on public.checkin
  for insert to anon with check (true);

drop policy if exists "checkin_anon_update" on public.checkin;
create policy "checkin_anon_update" on public.checkin
  for update to anon using (true) with check (true);

-- Dashboard master boleh membaca rekap check-in
drop policy if exists "checkin_anon_read" on public.checkin;
create policy "checkin_anon_read" on public.checkin
  for select to anon using (true);

-- Catatan keamanan (sama seperti tools/rsvp.sql): kunci API anon bersifat publik
-- di sisi klien, jadi siapa pun yang tahu nama & slug bisa mengisi tabel ini.
-- Risiko ini sudah diterima pada tabel rsvp; check-in hanya mencatat kehadiran.

-- ============================================================
-- PEMBATAS LAJU (rate limit) — check-in dibatasi per alamat IP.
-- Kunci anon bersifat publik; tanpa batas, tabel ini bisa dibanjiri. Batas:
--   * 30 check-in per menit dan 200 per jam per IP (satu panitia biasanya
--     memindai puluhan tamu per menit — angka ini longgar untuk pemakaian wajar,
--     tetapi menghentikan skrip yang mengirim ribuan baris).
-- Memakai public.batas_laju() yang dibuat oleh tools/rsvp.sql; jalankan berkas
-- itu lebih dulu (atau fungsi ini tidak akan ditemukan).
-- ============================================================

create or replace function public.checkin_batas_laju()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
begin
  begin
    v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  exception when others then
    v_ip := null;
  end;
  v_ip := split_part(coalesce(nullif(v_ip, ''), 'tanpa-ip'), ',', 1);
  perform public.batas_laju('checkin:ip:' || v_ip, 30, 60);
  perform public.batas_laju('checkin:jam:' || v_ip, 200, 3600);
  return new;
end;
$$;

drop trigger if exists checkin_batas_laju_trg on public.checkin;
create trigger checkin_batas_laju_trg
  before insert or update on public.checkin
  for each row execute function public.checkin_batas_laju();

-- Catatan operasional: penghitung boleh dibersihkan sesekali
--   delete from public.rate_limit where jendela_mulai < now() - interval '2 days';
-- Longgarkan sementara saat acara besar:
--   drop trigger if exists checkin_batas_laju_trg on public.checkin;

