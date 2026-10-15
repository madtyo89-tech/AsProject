-- ============================================================
-- AsProject — Tabel untuk Bot WhatsApp (Supabase Edge Function "wa-bot")
-- Jalankan sekali di Supabase → SQL Editor. Aman dijalankan ulang.
-- Panduan lengkap: supabase/functions/wa-bot/README.md
-- ============================================================

-- Pesan WhatsApp yang sudah diproses (mencegah pengulangan saat Meta mengirim ulang webhook).
create table if not exists public.wa_processed (
  msg_id text primary key,
  created_at timestamptz not null default now()
);

-- Calon klien yang mengirim data acara lewat WhatsApp.
-- Berisi nomor telepon (data pribadi) → hanya bisa diakses service role (bot & dashboard server).
create table if not exists public.wa_leads (
  id bigint generated always as identity primary key,
  phone text not null,
  nama_kontak text not null default '',
  fields jsonb not null default '{}'::jsonb,
  status text not null default 'baru' check (status in ('baru', 'diambil', 'ditolak')),
  slug text,
  created_at timestamptz not null default now()
);
create index if not exists wa_leads_status_idx on public.wa_leads (status, created_at desc);

-- RLS aktif tanpa policy → anon/authenticated tidak bisa membaca/menulis.
-- Service role (dipakai Edge Function) melewati RLS.
alter table public.wa_processed enable row level security;
alter table public.wa_leads enable row level security;
