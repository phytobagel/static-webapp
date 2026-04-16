-- Item: belongs to exactly one storage location; locations can hold many items.

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  storage_location_id uuid not null references public.storage_locations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.items is 'Item';

create index if not exists items_storage_location_id_idx on public.items (storage_location_id);
create index if not exists items_created_at_idx on public.items (created_at desc);

alter table public.items enable row level security;

drop policy if exists "items_select_authenticated" on public.items;
create policy "items_select_authenticated"
  on public.items
  for select
  to authenticated
  using (true);

drop policy if exists "items_insert_authenticated" on public.items;
create policy "items_insert_authenticated"
  on public.items
  for insert
  to authenticated
  with check (true);

drop policy if exists "items_update_authenticated" on public.items;
create policy "items_update_authenticated"
  on public.items
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "items_delete_authenticated" on public.items;
create policy "items_delete_authenticated"
  on public.items
  for delete
  to authenticated
  using (true);
