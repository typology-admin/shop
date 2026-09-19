-- Extend the existing typology.network profiles table (private shipping/account
-- fields) with a public username. Do not add a public SELECT on profiles —
-- that would leak email and address. Public pages read public_profiles only.

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,24}$');

alter table public.profiles
  drop constraint if exists profiles_username_reserved;

alter table public.profiles
  add constraint profiles_username_reserved
  check (
    username is null
    or username not in (
      'admin',
      'me',
      'login',
      'network',
      'api',
      'u',
      's',
      'auth',
      'shop',
      'about',
      'privacy',
      'terms',
      'affiliates',
      'contact'
    )
  );

create or replace function app_private.normalize_profile_username()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is not null then
    new.username := lower(btrim(new.username));
    if new.username = '' then
      new.username := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username
  before insert or update of username on public.profiles
  for each row
  execute function app_private.normalize_profile_username();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function app_private.handle_new_user();

insert into public.profiles (id, email, full_name)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name', '')
from auth.users as users
on conflict (id) do nothing;

create or replace view public.public_profiles
with (security_barrier = true) as
select
  id,
  username,
  coalesce(nullif(btrim(full_name), ''), username) as display_name
from public.profiles
where username is not null;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

notify pgrst, 'reload schema';
