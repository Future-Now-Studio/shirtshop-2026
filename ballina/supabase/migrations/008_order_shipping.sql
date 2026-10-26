-- Store the shipping each order is charged with. The order dialog shows
-- 6,90 € net shipping below 500 € net goods value (src/lib/utils.ts
-- shippingFor), but until now only the goods total was stored, so order,
-- confirmation and invoice did not match what the customer confirmed.
-- The rule lives in the DB so customers can't influence it. Idempotent.
alter table public.b2b_orders add column if not exists shipping numeric(10,2) not null default 0;

create or replace function public.b2b_orders_set_shipping()
  returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  -- keep in sync with FREE_SHIPPING_FROM / FLAT_SHIPPING in src/lib/utils.ts
  new.shipping := case when coalesce(new.total, 0) = 0 or new.total >= 500 then 0 else 6.90 end;
  return new;
end $$;

drop trigger if exists b2b_orders_set_shipping on public.b2b_orders;
create trigger b2b_orders_set_shipping
  before insert or update of total on public.b2b_orders
  for each row execute function public.b2b_orders_set_shipping();

-- backfill existing orders — only rows whose shipping does not match the rule
-- yet, so re-running apply.sh leaves existing orders (and updated_at) alone.
update public.b2b_orders set total = total
 where shipping is distinct from
       (case when coalesce(total, 0) = 0 or total >= 500 then 0 else 6.90 end);
