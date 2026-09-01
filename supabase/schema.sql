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

-- Named page hooks on the shop board. Public can read; admins write.
create table if not exists public.board_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  y double precision not null default 0,
  sort_order integer not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.board_sections enable row level security;

drop policy if exists board_sections_select_public on public.board_sections;
create policy board_sections_select_public
  on public.board_sections
  for select
  using (true);

drop policy if exists board_sections_insert_admin on public.board_sections;
create policy board_sections_insert_admin
  on public.board_sections
  for insert
  to authenticated
  with check (is_network_admin() or app_private.is_admin());

drop policy if exists board_sections_update_admin on public.board_sections;
create policy board_sections_update_admin
  on public.board_sections
  for update
  to authenticated
  using (is_network_admin() or app_private.is_admin())
  with check (is_network_admin() or app_private.is_admin());

drop policy if exists board_sections_delete_admin on public.board_sections;
create policy board_sections_delete_admin
  on public.board_sections
  for delete
  to authenticated
  using (is_network_admin() or app_private.is_admin());

grant select on table public.board_sections to anon, authenticated;
grant insert, update, delete on table public.board_sections to authenticated;

-- Affiliate intelligence: AWIN/merchant programs and product catalog (admin only).
create table if not exists public.affiliate_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  network text not null default 'awin',
  commission_label text not null default '',
  rating integer not null default 4 check (rating between 1 and 5),
  status text not null default 'pending',
  awin_advertiser_id text,
  clicks integer not null default 0,
  conversions integer not null default 0,
  commission_eur numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.affiliate_programs(id) on delete set null,
  title text not null default '',
  object text not null default '',
  function text not null default '',
  material text not null default '',
  brand text not null default '',
  price numeric(12,2),
  currency text not null default 'EUR',
  retailer text not null default '',
  country text not null default '',
  style text not null default '',
  era text not null default '',
  color text not null default '',
  form text not null default '',
  context text not null default '',
  sustainability text not null default '',
  design_score numeric(4,1),
  typology_score numeric(4,1),
  affiliate_value numeric(4,1),
  affiliate_url text not null default '',
  image_url text,
  board_item_id uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Network landing list (public.network_items) is shared with typology.network.
-- Writes are allowed if is_network_admin() or app_private.is_admin().
-- Footer social links live in public.contact_links (same admin check).
-- Shop about copy and view zoom live in public.site_settings.

create table if not exists public.site_settings (
  id text primary key default 'shop',
  desktop_zoom numeric(4,2) not null default 1.00,
  mobile_zoom numeric(4,2) not null default 1.20,
  about_text text not null default '',
  contact_email text not null default 'info@typology.network',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_select_public on public.site_settings;
create policy site_settings_select_public
  on public.site_settings
  for select
  using (true);

drop policy if exists site_settings_insert_admin on public.site_settings;
create policy site_settings_insert_admin
  on public.site_settings
  for insert
  to authenticated
  with check (is_network_admin() or app_private.is_admin());

drop policy if exists site_settings_update_admin on public.site_settings;
create policy site_settings_update_admin
  on public.site_settings
  for update
  to authenticated
  using (is_network_admin() or app_private.is_admin())
  with check (is_network_admin() or app_private.is_admin());

grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

insert into public.site_settings (id)
values ('shop')
on conflict (id) do nothing;

