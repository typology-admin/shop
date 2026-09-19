-- Replace the security-definer view with a public projection table.
-- profiles stays private (email/address). profile_handles is username + display only.

drop view if exists public.public_profiles;

create table if not exists public.profile_handles (
  id uuid primary key references public.profiles (id) on delete cascade,
  username text not null,
  display_name text not null default '',
  constraint profile_handles_username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create unique index if not exists profile_handles_username_lower_idx
  on public.profile_handles (lower(username));

alter table public.profile_handles enable row level security;

drop policy if exists profile_handles_select_public on public.profile_handles;
create policy profile_handles_select_public
  on public.profile_handles
  for select
  to anon, authenticated
  using (true);

revoke all on table public.profile_handles from public;
grant select on table public.profile_handles to anon, authenticated;

create or replace function app_private.sync_profile_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.profile_handles where id = old.id;
    return old;
  end if;

  if new.username is null then
    delete from public.profile_handles where id = new.id;
    return new;
  end if;

  insert into public.profile_handles (id, username, display_name)
  values (
    new.id,
    new.username,
    coalesce(nullif(btrim(coalesce(new.full_name, '')), ''), new.username)
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name;

  return new;
end;
$$;

drop trigger if exists profiles_sync_handle on public.profiles;
create trigger profiles_sync_handle
  after insert or update of username, full_name or delete
  on public.profiles
  for each row
  execute function app_private.sync_profile_handle();

insert into public.profile_handles (id, username, display_name)
select
  id,
  username,
  coalesce(nullif(btrim(coalesce(full_name, '')), ''), username)
from public.profiles
where username is not null
on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name;

notify pgrst, 'reload schema';
