create table public.print_zones (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  view        text not null check (view in ('front', 'back', 'left', 'right')),
  x           numeric not null check (x >= 0 and x <= 1),
  y           numeric not null check (y >= 0 and y <= 1),
  width       numeric not null check (width  > 0 and width  <= 1),
  height      numeric not null check (height > 0 and height <= 1),
  label       text,
  sort_order  integer not null default 0
);
create index print_zones_product_id_idx on public.print_zones (product_id);
