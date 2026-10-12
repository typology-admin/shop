-- Add has_webp column to track which items have WebP versions
-- This avoids unnecessary 404 requests before the backfill completes

alter table public.items 
add column if not exists has_webp boolean not null default false;

create index if not exists items_has_webp_idx on public.items (has_webp);

comment on column public.items.has_webp is 
  'True when a .webp version exists in R2. Set by upload pipeline and backfill script.';
