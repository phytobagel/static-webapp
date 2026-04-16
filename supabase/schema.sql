-- Run this in Supabase: SQL Editor → New query → Run.
--
-- After creating the project:
-- 1) Authentication → URL Configuration → Site URL = your live site
--    (e.g. https://your-app.azurestaticapps.net) and add the same under
--    Redirect URLs.
-- 2) Optional hardening: Authentication → Providers → Email → disable
--    "Allow new users" after you and your partner have accounts.

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null default auth.uid()
);

create index if not exists qr_scans_created_at_idx on public.qr_scans (created_at desc);

alter table public.qr_scans enable row level security;

create policy "qr_scans_select_authenticated"
  on public.qr_scans
  for select
  to authenticated
  using (true);

create policy "qr_scans_insert_authenticated"
  on public.qr_scans
  for insert
  to authenticated
  with check (true);

-- Storage Location (Supabase Table Editor: public.storage_locations)
create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.storage_locations is 'Storage Location';

create index if not exists storage_locations_created_at_idx on public.storage_locations (created_at desc);

alter table public.storage_locations enable row level security;

create policy "storage_locations_select_authenticated"
  on public.storage_locations
  for select
  to authenticated
  using (true);

create policy "storage_locations_insert_authenticated"
  on public.storage_locations
  for insert
  to authenticated
  with check (true);

-- Item (one storage location per item; many items per location)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  storage_location_id uuid not null references public.storage_locations (id) on delete cascade,
  name text not null,
  image_url text,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.items is 'Item';

comment on column public.items.image_url is 'Public URL of the item image (e.g. from Supabase Storage getPublicUrl).';

create index if not exists items_storage_location_id_idx on public.items (storage_location_id);
create index if not exists items_created_at_idx on public.items (created_at desc);

alter table public.items enable row level security;

create policy "items_select_authenticated"
  on public.items
  for select
  to authenticated
  using (true);

create policy "items_insert_authenticated"
  on public.items
  for insert
  to authenticated
  with check (true);

create policy "items_update_authenticated"
  on public.items
  for update
  to authenticated
  using (true)
  with check (true);

create policy "items_delete_authenticated"
  on public.items
  for delete
  to authenticated
  using (true);

-- Item images (Supabase Storage: bucket item-images; set items.image_url to getPublicUrl after upload)
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

create policy "item_images_select"
  on storage.objects
  for select
  using (bucket_id = 'item-images');

create policy "item_images_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'item-images');

create policy "item_images_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'item-images')
  with check (bucket_id = 'item-images');

create policy "item_images_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'item-images');
