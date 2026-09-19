-- pgTAP checks for user-board RLS. Run with: supabase test db
--
-- Remote verification (2026-09-19, project xkkwpjiabvlokrtisdmc):
-- - All user_board* tables + user_api_hits have relrowsecurity = true
-- - SELECT on user_boards is owner OR visibility=public (unlisted is token-only)
-- - Claims SELECT/INSERT exclude the owner (gift surprise)
-- - Suggestions SELECT is owner-only; INSERT is visitors on public+enabled boards
-- - open_shared_board / rotate_share_token / claim_shared_item are SECURITY DEFINER
-- - Owners never receive claims from open_shared_board

begin;
select plan(13);

select has_table('public', 'user_boards', 'user_boards exists');
select has_table('public', 'user_board_sections', 'user_board_sections exists');
select has_table('public', 'user_board_items', 'user_board_items exists');
select has_table('public', 'user_board_item_claims', 'user_board_item_claims exists');
select has_table('public', 'user_board_suggestions', 'user_board_suggestions exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_boards'::regclass),
  'user_boards has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_board_items'::regclass),
  'user_board_items has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_board_item_claims'::regclass),
  'claims has RLS'
);

select has_function('app_private', 'is_user_board_owner', array['uuid']);
select has_function('public', 'open_shared_board', array['text']);
select has_function('public', 'claim_shared_item', array['text', 'uuid', 'text']);

select policy_cmd_is('public', 'user_boards', 'user_boards_select_readable', 'SELECT');
select policy_cmd_is('public', 'user_board_item_claims', 'user_board_item_claims_select_visitors', 'SELECT');

select * from finish();
rollback;
