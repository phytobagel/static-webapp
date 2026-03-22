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
