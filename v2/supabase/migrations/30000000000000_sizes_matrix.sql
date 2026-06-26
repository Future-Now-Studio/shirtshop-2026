create table public.product_sizes (
  product_id  uuid not null references public.products (id) on delete cascade,
  size_id     uuid not null references public.sizes (id) on delete restrict,
  primary key (product_id, size_id)
);

create table public.variant_size_availability (
  variant_id  uuid not null references public.variants (id) on delete cascade,
  size_id     uuid not null references public.sizes (id) on delete restrict,
  available   boolean not null default true,
  stock       integer not null default 0,
  primary key (variant_id, size_id)
);
