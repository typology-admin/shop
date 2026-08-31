-- Knoll shop board — items table and RLS.
-- Admin writes are allowed if app_private.is_admin() (membership in public.admin_users)
-- or if JWT app_metadata.role / roles includes "admin".

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
    app_private.is_admin()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  );

drop policy if exists "Admins can update items" on public.items;
create policy "Admins can update items"
  on public.items
  for update
  to authenticated
  using (
    app_private.is_admin()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  )
  with check (
    app_private.is_admin()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  );

drop policy if exists "Admins can delete items" on public.items;
create policy "Admins can delete items"
  on public.items
  for delete
  to authenticated
  using (
    app_private.is_admin()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  );

grant select on table public.items to anon, authenticated;
grant insert, update, delete on table public.items to authenticated;
