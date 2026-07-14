-- Schema for admin features: order workflow (status/tracking/shipping),
-- coupons, structured bulk inquiries, and editable shop settings. Idempotent.

-- Orders: workflow fields + wider status set + coupon fields.
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists shipped_at       timestamptz;
alter table public.orders add column if not exists coupon_code      text;
alter table public.orders add column if not exists discount_amount  numeric(10,2) not null default 0;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add  constraint orders_status_check
  check (status in ('pending','paid','in_production','shipped','completed','cancelled','refunded'));

-- Settings: editable shipping / VAT / design price.
alter table public.settings add column if not exists shipping_flat            numeric(10,2) not null default 4.90;
alter table public.settings add column if not exists free_shipping_threshold  numeric(10,2) not null default 50.00;
alter table public.settings add column if not exists vat_rate                 numeric(5,4)  not null default 0.19;

-- Coupons (validated server-side in create-payment-intent; no anon access).
create table if not exists public.coupons (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  kind         text not null check (kind in ('percent','fixed')),
  value        numeric(10,2) not null check (value >= 0),
  min_order    numeric(10,2) not null default 0,
  max_uses     integer,
  used_count   integer not null default 0,
  active       boolean not null default true,
  valid_from   timestamptz,
  valid_until  timestamptz,
  created_at   timestamptz not null default now()
);

-- Structured Großbestellung inquiries (replaces the free-text contact_messages blob).
create table if not exists public.bulk_inquiries (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  status         text not null default 'neu'
                   check (status in ('neu','in_bearbeitung','angebot_gesendet','abgeschlossen')),
  filiale        text,
  textil_art     text,
  qualitaet      text,
  druckverfahren text,
  stueckzahl     text,
  anrede         text,
  vorname        text,
  nachname       text,
  email          text not null,
  telefon        text,
  firma          text,
  bemerkungen    text,
  motiv_path     text
);

alter table public.coupons        enable row level security;
alter table public.bulk_inquiries enable row level security;

-- Anyone may submit a bulk inquiry; admin manages both tables.
drop policy if exists "anon insert bulk_inquiries" on public.bulk_inquiries;
create policy "anon insert bulk_inquiries" on public.bulk_inquiries
  for insert to anon with check (true);

drop policy if exists "admin all bulk_inquiries" on public.bulk_inquiries;
create policy "admin all bulk_inquiries" on public.bulk_inquiries
  for all to authenticated using (true) with check (true);

drop policy if exists "admin all coupons" on public.coupons;
create policy "admin all coupons" on public.coupons
  for all to authenticated using (true) with check (true);
