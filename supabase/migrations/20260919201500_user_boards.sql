-- Per-user boards. Parallel to the shop catalog (public.items).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_board_visibility') then
    create type public.user_board_visibility as enum ('private', 'unlisted', 'public');
  end if;
end
$$;

create table if not exists public.user_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Untitled',
  slug text not null,
  visibility public.user_board_visibility not null default 'private',
  share_token text unique,
  wishlist_enabled boolean not null default false,
  suggestions_enabled boolean not null default false,
  og_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_boards_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 1 and 48),
  constraint user_boards_owner_slug unique (owner_id, slug)
);

create index if not exists user_boards_owner_id_idx on public.user_boards (owner_id);
create index if not exists user_boards_visibility_idx on public.user_boards (visibility);
create index if not exists user_boards_share_token_idx on public.user_boards (share_token);

create table if not exists public.user_board_sections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.user_boards (id) on delete cascade,
  title text not null default '',
  x double precision not null default 1200,
  y double precision not null default 900,
  strength double precision not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists user_board_sections_board_id_idx on public.user_board_sections (board_id);

create table if not exists public.user_board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.user_boards (id) on delete cascade,
  section_id uuid references public.user_board_sections (id) on delete set null,
  url text not null default '',
  title text not null default '',
  price numeric(12, 2),
  currency text not null default 'EUR',
  image_path text,
  source_image_url text,
  image_width integer not null default 0,
  image_height integer not null default 0,
  x double precision not null default 0,
  y double precision not null default 0,
  rotation double precision not null default 0,
  scale double precision not null default 1,
  locked boolean not null default false,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_board_items_board_id_idx on public.user_board_items (board_id);
create index if not exists user_board_items_section_id_idx on public.user_board_items (section_id);

create table if not exists public.user_board_item_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.user_board_items (id) on delete cascade,
  board_id uuid not null references public.user_boards (id) on delete cascade,
  claimed_by text not null default '',
  claimer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_board_item_claims_board_id_idx on public.user_board_item_claims (board_id);

create table if not exists public.user_board_suggestions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.user_boards (id) on delete cascade,
  url text not null default '',
  title text not null default '',
  price numeric(12, 2),
  currency text not null default 'EUR',
  image_url text,
  note text not null default '',
  suggested_by text not null default '',
  suggester_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists user_board_suggestions_board_id_idx on public.user_board_suggestions (board_id);

create table if not exists public.user_api_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_api_hits_user_kind_created_idx
  on public.user_api_hits (user_id, kind, created_at desc);

create or replace function app_private.is_user_board_owner(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_boards
    where id = p_board_id
      and owner_id = (select auth.uid())
  );
$$;

create or replace function app_private.user_board_is_public(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_boards
    where id = p_board_id
      and visibility = 'public'
  );
$$;

create or replace function app_private.user_board_is_readable(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_boards
    where id = p_board_id
      and (
        owner_id = (select auth.uid())
        or visibility = 'public'
      )
  );
$$;

create or replace function app_private.touch_user_board()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_boards_touch on public.user_boards;
create trigger user_boards_touch
  before update on public.user_boards
  for each row
  execute function app_private.touch_user_board();

drop trigger if exists user_board_items_touch on public.user_board_items;
create trigger user_board_items_touch
  before update on public.user_board_items
  for each row
  execute function app_private.touch_user_board();

create or replace function app_private.ensure_unlisted_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.visibility = 'unlisted' and new.share_token is null then
    new.share_token := encode(gen_random_bytes(16), 'hex');
  end if;
  if new.visibility <> 'unlisted' then
    new.share_token := null;
  end if;
  return new;
end;
$$;

drop trigger if exists user_boards_share_token on public.user_boards;
create trigger user_boards_share_token
  before insert or update of visibility, share_token on public.user_boards
  for each row
  execute function app_private.ensure_unlisted_token();

alter table public.user_boards enable row level security;
alter table public.user_board_sections enable row level security;
alter table public.user_board_items enable row level security;
alter table public.user_board_item_claims enable row level security;
alter table public.user_board_suggestions enable row level security;
alter table public.user_api_hits enable row level security;

drop policy if exists user_boards_select_readable on public.user_boards;
create policy user_boards_select_readable
  on public.user_boards
  for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or visibility = 'public'
  );

drop policy if exists user_boards_insert_own on public.user_boards;
create policy user_boards_insert_own
  on public.user_boards
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists user_boards_update_own on public.user_boards;
create policy user_boards_update_own
  on public.user_boards
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists user_boards_delete_own on public.user_boards;
create policy user_boards_delete_own
  on public.user_boards
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists user_board_sections_select_readable on public.user_board_sections;
create policy user_board_sections_select_readable
  on public.user_board_sections
  for select
  to anon, authenticated
  using ((select app_private.user_board_is_readable(board_id)));

drop policy if exists user_board_sections_write_owner on public.user_board_sections;
create policy user_board_sections_write_owner
  on public.user_board_sections
  for all
  to authenticated
  using ((select app_private.is_user_board_owner(board_id)))
  with check ((select app_private.is_user_board_owner(board_id)));

drop policy if exists user_board_items_select_readable on public.user_board_items;
create policy user_board_items_select_readable
  on public.user_board_items
  for select
  to anon, authenticated
  using ((select app_private.user_board_is_readable(board_id)));

drop policy if exists user_board_items_write_owner on public.user_board_items;
create policy user_board_items_write_owner
  on public.user_board_items
  for all
  to authenticated
  using ((select app_private.is_user_board_owner(board_id)))
  with check ((select app_private.is_user_board_owner(board_id)));

-- Owner must never read claims (gift surprise). Visitors of readable boards can.
drop policy if exists user_board_item_claims_select_visitors on public.user_board_item_claims;
create policy user_board_item_claims_select_visitors
  on public.user_board_item_claims
  for select
  to anon, authenticated
  using (
    (select app_private.user_board_is_readable(board_id))
    and not (select app_private.is_user_board_owner(board_id))
  );

drop policy if exists user_board_item_claims_insert_visitors on public.user_board_item_claims;
create policy user_board_item_claims_insert_visitors
  on public.user_board_item_claims
  for insert
  to anon, authenticated
  with check (
    (select app_private.user_board_is_readable(board_id))
    and not (select app_private.is_user_board_owner(board_id))
    and exists (
      select 1 from public.user_boards b
      where b.id = board_id and b.wishlist_enabled
    )
  );

drop policy if exists user_board_item_claims_delete_claimer on public.user_board_item_claims;
create policy user_board_item_claims_delete_claimer
  on public.user_board_item_claims
  for delete
  to authenticated
  using (
    claimer_id = (select auth.uid())
    and not (select app_private.is_user_board_owner(board_id))
  );

drop policy if exists user_board_suggestions_select_owner on public.user_board_suggestions;
create policy user_board_suggestions_select_owner
  on public.user_board_suggestions
  for select
  to authenticated
  using ((select app_private.is_user_board_owner(board_id)));

drop policy if exists user_board_suggestions_insert_visitors on public.user_board_suggestions;
create policy user_board_suggestions_insert_visitors
  on public.user_board_suggestions
  for insert
  to anon, authenticated
  with check (
    not (select app_private.is_user_board_owner(board_id))
    and exists (
      select 1 from public.user_boards b
      where b.id = board_id and b.suggestions_enabled and b.visibility = 'public'
    )
  );

drop policy if exists user_board_suggestions_update_owner on public.user_board_suggestions;
create policy user_board_suggestions_update_owner
  on public.user_board_suggestions
  for update
  to authenticated
  using ((select app_private.is_user_board_owner(board_id)))
  with check ((select app_private.is_user_board_owner(board_id)));

drop policy if exists user_board_suggestions_delete_owner on public.user_board_suggestions;
create policy user_board_suggestions_delete_owner
  on public.user_board_suggestions
  for delete
  to authenticated
  using ((select app_private.is_user_board_owner(board_id)));

drop policy if exists user_api_hits_insert_own on public.user_api_hits;
create policy user_api_hits_insert_own
  on public.user_api_hits
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_api_hits_select_own on public.user_api_hits;
create policy user_api_hits_select_own
  on public.user_api_hits
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.user_boards from public;
revoke all on table public.user_board_sections from public;
revoke all on table public.user_board_items from public;
revoke all on table public.user_board_item_claims from public;
revoke all on table public.user_board_suggestions from public;
revoke all on table public.user_api_hits from public;

grant select on table public.user_boards to anon, authenticated;
grant insert, update, delete on table public.user_boards to authenticated;

grant select on table public.user_board_sections to anon, authenticated;
grant insert, update, delete on table public.user_board_sections to authenticated;

grant select on table public.user_board_items to anon, authenticated;
grant insert, update, delete on table public.user_board_items to authenticated;

grant select, insert on table public.user_board_item_claims to anon, authenticated;
grant delete on table public.user_board_item_claims to authenticated;

grant insert on table public.user_board_suggestions to anon, authenticated;
grant select, update, delete on table public.user_board_suggestions to authenticated;

grant select, insert on table public.user_api_hits to authenticated;

create or replace function public.open_shared_board(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  board public.user_boards;
  is_owner boolean;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Not found' using errcode = 'P0002';
  end if;

  select * into board
  from public.user_boards
  where share_token = p_token
    and visibility = 'unlisted';

  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;

  is_owner := board.owner_id = (select auth.uid());

  return jsonb_build_object(
    'board', to_jsonb(board),
    'sections', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.sort_order, s.y)
      from public.user_board_sections s
      where s.board_id = board.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.z_index, i.created_at)
      from public.user_board_items i
      where i.board_id = board.id
    ), '[]'::jsonb),
    'claims', case
      when is_owner then '[]'::jsonb
      else coalesce((
        select jsonb_agg(to_jsonb(c))
        from public.user_board_item_claims c
        where c.board_id = board.id
      ), '[]'::jsonb)
    end
  );
end;
$$;

revoke all on function public.open_shared_board(text) from public;
grant execute on function public.open_shared_board(text) to anon, authenticated;

create or replace function public.rotate_share_token(p_board_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
begin
  if not (select app_private.is_user_board_owner(p_board_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  token := encode(gen_random_bytes(16), 'hex');
  update public.user_boards
  set visibility = 'unlisted',
      share_token = token
  where id = p_board_id;

  return token;
end;
$$;

revoke all on function public.rotate_share_token(uuid) from public, anon;
grant execute on function public.rotate_share_token(uuid) to authenticated;

-- Unlisted boards are not SELECT-readable, so claims go through the share token.
create or replace function public.claim_shared_item(p_token text, p_item_id uuid, p_claimed_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  board public.user_boards;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Not found' using errcode = 'P0002';
  end if;

  select * into board
  from public.user_boards
  where share_token = p_token
    and visibility = 'unlisted'
    and wishlist_enabled;

  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;

  if board.owner_id = (select auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_board_items
    where id = p_item_id and board_id = board.id
  ) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;

  insert into public.user_board_item_claims (item_id, board_id, claimed_by, claimer_id)
  values (p_item_id, board.id, coalesce(trim(p_claimed_by), ''), (select auth.uid()));
end;
$$;

revoke all on function public.claim_shared_item(text, uuid, text) from public;
grant execute on function public.claim_shared_item(text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
