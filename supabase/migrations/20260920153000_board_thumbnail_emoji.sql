-- Board overview thumbnail: a single emoji shown on /me and public profile tiles.

alter table public.user_boards
  add column if not exists thumbnail_emoji text;

alter table public.user_boards
  drop constraint if exists user_boards_thumbnail_emoji_len;

alter table public.user_boards
  add constraint user_boards_thumbnail_emoji_len
  check (thumbnail_emoji is null or char_length(thumbnail_emoji) between 1 and 16);
