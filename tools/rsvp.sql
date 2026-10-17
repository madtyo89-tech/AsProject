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
-- PEMBATAS LAJU (rate limit) — melindungi rsvp dari skrip/brute force.
-- Kunci API anon bersifat publik (tertanam di halaman), jadi tanpa batas ini
-- siapa pun bisa membanjiri tabel. Batas dihitung per alamat IP + per slug:
--   * rsvp  : maksimal 12 kiriman per menit dan 60 per jam.
-- Penghitung disimpan di tabel terpisah (bukan di rsvp) supaya buku tamu tetap
-- bersih, dan fungsi ini "security definer" sehingga tamu tidak perlu (dan
-- tidak boleh) menyentuh tabel penghitung.
-- ============================================================

create table if not exists public.rate_limit (
  kunci text primary key,
  jendela_mulai timestamptz not null default now(),
  jumlah integer not null default 0
);
alter table public.rate_limit enable row level security;
-- sengaja tanpa policy: hanya fungsi security definer di bawah yang boleh akses

create or replace function public.batas_laju(p_kunci text, p_maks integer, p_detik integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sekarang timestamptz := now();
begin
  insert into public.rate_limit as r (kunci, jendela_mulai, jumlah)
  values (p_kunci, v_sekarang, 1)
  on conflict (kunci) do update set
    jumlah = case when r.jendela_mulai < v_sekarang - make_interval(secs => p_detik)
                  then 1 else r.jumlah + 1 end,
    jendela_mulai = case when r.jendela_mulai < v_sekarang - make_interval(secs => p_detik)
                         then v_sekarang else r.jendela_mulai end;

  if (select jumlah from public.rate_limit where kunci = p_kunci) > p_maks then
    raise exception 'Terlalu banyak kiriman. Coba lagi sebentar lagi.'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.batas_laju(text, integer, integer) from public;
grant execute on function public.batas_laju(text, integer, integer) to anon, authenticated;

-- Pemicu pada rsvp: batasi per IP (header x-forwarded-for diisi PostgREST)
-- dan per (slug, guest) supaya satu tamu tidak menulis berulang-ulang.
create or replace function public.rsvp_batas_laju()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
begin
  /* PostgREST menaruh header permintaan di GUC request.headers (JSON) */
  begin
    v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  exception when others then
    v_ip := null;
  end;
  v_ip := split_part(coalesce(nullif(v_ip, ''), 'tanpa-ip'), ',', 1);
  perform public.batas_laju('rsvp:ip:' || v_ip, 12, 60);
  perform public.batas_laju('rsvp:jam:' || v_ip, 60, 3600);
  if tg_op = 'INSERT' then
    perform public.batas_laju('rsvp:tamu:' || new.slug || ':' || new.guest, 30, 3600);
  end if;
  return new;
end;
$$;

drop trigger if exists rsvp_batas_laju_trg on public.rsvp;
create trigger rsvp_batas_laju_trg
  before insert or update on public.rsvp
  for each row execute function public.rsvp_batas_laju();

-- ============================================================
-- MIGRASI (jika tabel rsvp sudah ada dari versi sebelumnya):
-- jalankan blok berikut sekali di SQL Editor.
-- ============================================================
alter table public.rsvp add column if not exists pesan text not null default '';
alter table public.rsvp drop constraint if exists rsvp_status_check;
alter table public.rsvp add constraint rsvp_status_check check (status in ('hadir','ragu','tidak'));

-- ============================================================
-- Catatan operasional pembatas laju:
--   * Penghitung lama boleh dibersihkan sesekali:
--       delete from public.rate_limit where jendela_mulai < now() - interval '2 days';
--   * Kalau muncul galat "Terlalu banyak kiriman", tamu tinggal menunggu
--     ±1 menit; status yang sudah tercatat tidak berubah.
--   * Kalau ingin melonggarkan sementara (mis. acara besar dengan banyak tamu
--     di satu jaringan WiFi), ubah angka 12/60 pada rsvp_batas_laju, atau
--     lepaskan pemicunya: drop trigger if exists rsvp_batas_laju_trg on public.rsvp;
-- ============================================================
