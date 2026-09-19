-- Unlisted boards are not SELECT-readable, so wishlist claims use the share token.
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
