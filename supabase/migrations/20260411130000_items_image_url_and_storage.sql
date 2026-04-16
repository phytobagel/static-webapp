-- Item images: URL on the row + public bucket for uploads (store path in image_url via getPublicUrl).

alter table public.items
  add column if not exists image_url text;

comment on column public.items.image_url is 'Public URL of the item image (e.g. from Supabase Storage getPublicUrl).';

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "item_images_select" on storage.objects;
create policy "item_images_select"
  on storage.objects
  for select
  using (bucket_id = 'item-images');

drop policy if exists "item_images_insert_authenticated" on storage.objects;
create policy "item_images_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'item-images');

drop policy if exists "item_images_update_authenticated" on storage.objects;
create policy "item_images_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'item-images')
  with check (bucket_id = 'item-images');

drop policy if exists "item_images_delete_authenticated" on storage.objects;
create policy "item_images_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'item-images');
