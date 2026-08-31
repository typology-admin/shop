-- Knoll / Flatlay — items table, RLS, and admin role notes
-- Run this in the Supabase SQL editor (or as a migration).

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  affiliate_url text not null,
  store text not null default '',
  image_path text not null,
  image_width integer not null,
  image_height integer not null,
  x double precision not null default 0,
  y double precision not null default 0,
  scale double precision not null default 1,
  rotation double precision not null default 0,
  z_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists items_z_index_idx on public.items (z_index);

alter table public.items enable row level security;

-- Role is read from JWT app_metadata (NOT user_metadata, which users can edit).
-- Grant admin with:
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--   where email = 'you@example.com';
-- Then the user must sign in again so the new claim is in the JWT.
-- Add more admins later the same way, or with an array:
--   {"roles": ["admin"]}

drop policy if exists "Public can read items" on public.items;
create policy "Public can read items"
  on public.items
  for select
  using (true);

drop policy if exists "Admins can insert items" on public.items;
create policy "Admins can insert items"
  on public.items
  for insert
  to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  );

drop policy if exists "Admins can update items" on public.items;
create policy "Admins can update items"
  on public.items
  for update
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  );

drop policy if exists "Admins can delete items" on public.items;
create policy "Admins can delete items"
  on public.items
  for delete
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  );

grant select on table public.items to anon, authenticated;
grant insert, update, delete on table public.items to authenticated;
