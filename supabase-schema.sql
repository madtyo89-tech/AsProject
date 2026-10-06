-- Jalankan sekali di Supabase SQL Editor.
create table if not exists public.invitation_drafts (
  slug text primary key,
  name1 text not null default '', name2 text not null default '',
  venue text not null default '', event_date date, event_time time,
  music_url text, music_name text, theme integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.invitation_drafts enable row level security;

drop policy if exists "public can read drafts" on public.invitation_drafts;
drop policy if exists "public can insert drafts" on public.invitation_drafts;
drop policy if exists "public can update drafts" on public.invitation_drafts;
create policy "public can read drafts" on public.invitation_drafts for select using (true);
create policy "public can insert drafts" on public.invitation_drafts for insert with check (true);
create policy "public can update drafts" on public.invitation_drafts for update using (true) with check (true);

insert into storage.buckets (id,name,public) values ('music','music',true)
on conflict (id) do update set public=true;
drop policy if exists "public upload music" on storage.objects;
drop policy if exists "public read music" on storage.objects;
create policy "public upload music" on storage.objects for insert with check (bucket_id='music');
create policy "public read music" on storage.objects for select using (bucket_id='music');
