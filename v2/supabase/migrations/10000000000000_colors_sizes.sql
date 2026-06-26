create table public.colors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  hex         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.sizes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
