create table public.products (
  id                            uuid primary key default gen_random_uuid(),
  slug                          text not null unique,
  name                          text not null,
  description                   text,
  category                      text,
  base_price                    numeric(10,2) not null default 0,
  design_element_price          numeric(10,2) not null default 0,
  status                        text not null default 'draft'
                                  check (status in ('draft', 'published')),
  excluded_from_volume_discount boolean not null default false,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create table public.variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  color_id    uuid not null references public.colors (id) on delete restrict,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (product_id, color_id)
);
create index variants_product_id_idx on public.variants (product_id);

create table public.variant_images (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references public.variants (id) on delete cascade,
  view          text not null check (view in ('front', 'back', 'left', 'right')),
  storage_path  text not null,
  sort_order    integer not null default 0,
  unique (variant_id, view)
);
create index variant_images_variant_id_idx on public.variant_images (variant_id);
