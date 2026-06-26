create table public.volume_discounts (
  id                uuid primary key default gen_random_uuid(),
  min_qty           integer not null check (min_qty > 0),
  discount_percent  numeric(5,2) not null check (discount_percent >= 0 and discount_percent <= 100)
);

create table public.settings (
  id                    integer primary key default 1 check (id = 1),
  design_element_price  numeric(10,2) not null default 10.00,
  order_email           text,
  updated_at            timestamptz not null default now()
);

insert into public.settings (id) values (1);
