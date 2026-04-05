-- qr_scans + storage_locations (see also supabase/schema.sql)

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null default auth.uid()
);

create index if not exists qr_scans_created_at_idx on public.qr_scans (created_at desc);

alter table public.qr_scans enable row level security;

drop policy if exists "qr_scans_select_authenticated" on public.qr_scans;
create policy "qr_scans_select_authenticated"
  on public.qr_scans
  for select
  to authenticated
  using (true);

drop policy if exists "qr_scans_insert_authenticated" on public.qr_scans;
create policy "qr_scans_insert_authenticated"
  on public.qr_scans
  for insert
  to authenticated
  with check (true);

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.storage_locations is 'Storage Location';

create index if not exists storage_locations_created_at_idx on public.storage_locations (created_at desc);

alter table public.storage_locations enable row level security;

drop policy if exists "storage_locations_select_authenticated" on public.storage_locations;
create policy "storage_locations_select_authenticated"
  on public.storage_locations
  for select
  to authenticated
  using (true);

drop policy if exists "storage_locations_insert_authenticated" on public.storage_locations;
create policy "storage_locations_insert_authenticated"
  on public.storage_locations
  for insert
  to authenticated
  with check (true);
