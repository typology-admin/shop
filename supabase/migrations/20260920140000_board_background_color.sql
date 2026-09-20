-- Board background color (monochrome light grey default).

alter table public.user_boards
  add column if not exists background_color text not null default '#bfbfbf';

alter table public.site_settings
  add column if not exists board_color text not null default '#bfbfbf';

update public.user_boards
set background_color = '#bfbfbf'
where background_color is null or background_color = '' or background_color = '#bfbfbf';

update public.site_settings
set board_color = '#bfbfbf'
where board_color is null or board_color = '' or board_color = '#bfbfbf';
