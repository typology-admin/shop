revoke all on function public.rotate_share_token(uuid) from public, anon;
grant execute on function public.rotate_share_token(uuid) to authenticated;
