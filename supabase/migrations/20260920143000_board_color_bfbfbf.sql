-- Align board defaults to #bfbfbf family.

alter table public.user_boards alter column background_color set default '#bfbfbf';
alter table public.site_settings alter column board_color set default '#bfbfbf';

update public.user_boards
set background_color = '#bfbfbf'
where background_color in ('#d0d0d0', '#c5c1b6', '#D0D0D0');

update public.site_settings
set board_color = '#bfbfbf'
where board_color in ('#d0d0d0', '#c5c1b6', '#D0D0D0') or id = 'shop';
