create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  status                    text not null default 'pending'
                              check (status in ('pending', 'paid', 'fulfilled', 'cancelled')),
  customer_name             text,
  customer_email            text,
  customer_address          jsonb,
  total                     numeric(10,2),
  stripe_payment_intent_id  text,
  email_sent                boolean not null default false
);

create table public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  product_id           uuid references public.products (id) on delete set null,
  variant_id           uuid references public.variants (id) on delete set null,
  size_id              uuid references public.sizes (id) on delete set null,
  qty                  integer not null check (qty > 0),
  unit_price           numeric(10,2) not null,
  design_data          jsonb,
  design_render_paths  text[]
);
create index order_items_order_id_idx on public.order_items (order_id);
