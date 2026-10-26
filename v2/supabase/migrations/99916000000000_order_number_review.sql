-- Human-readable order numbers (PS-2026-00001) for customers, invoices and
-- support, plus a review flag for orders the admin must look at before
-- production (e.g. paid although stock ran out or a coupon was over its
-- limit). Idempotent.
create sequence if not exists public.order_number_seq;

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists review_reason text;

-- Backfill existing orders in creation order, then number new ones by default.
update public.orders o
   set order_number = 'PS-' || to_char(o.created_at at time zone 'Europe/Berlin', 'YYYY') || '-' ||
                      lpad(nextval('public.order_number_seq')::text, 5, '0')
  from (select id from public.orders where order_number is null order by created_at) s
 where o.id = s.id;

alter table public.orders alter column order_number
  set default 'PS-' || to_char(now() at time zone 'Europe/Berlin', 'YYYY') || '-' ||
              lpad(nextval('public.order_number_seq')::text, 5, '0');
create unique index if not exists orders_order_number_key on public.orders (order_number);
