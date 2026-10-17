-- Invoices with sequential numbers (§ 14 UStG / GoBD) and the price
-- components each order was charged with, so invoices always add up.

-- 1. Price components on the order (coupon discount already exists).
alter table public.orders add column if not exists shipping_amount        numeric(10,2);
alter table public.orders add column if not exists volume_discount_amount numeric(10,2) not null default 0;

-- 2. Invoices: one per order, number assigned once and never reused.
create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoices (
  order_id        uuid primary key references public.orders (id) on delete restrict,
  invoice_number  text not null unique,
  issued_at       timestamptz not null default now()
);
alter table public.invoices enable row level security;
drop policy if exists "admin read invoices" on public.invoices;
create policy "admin read invoices" on public.invoices
  for select to authenticated using (public.is_admin());

-- Returns the order's invoice (creates it with the next number on first call).
create or replace function public.issue_invoice(p_order_id uuid)
  returns public.invoices
  language plpgsql security definer set search_path = public as $$
declare
  v public.invoices;
begin
  select * into v from public.invoices where order_id = p_order_id;
  if found then
    return v;
  end if;
  insert into public.invoices (order_id, invoice_number)
  values (p_order_id, 'RE-' || to_char(now() at time zone 'Europe/Berlin', 'YYYY') || '-' ||
                      lpad(nextval('public.invoice_number_seq')::text, 5, '0'))
  on conflict (order_id) do nothing
  returning * into v;
  if v.order_id is null then           -- lost a race: return the winner's row
    select * into v from public.invoices where order_id = p_order_id;
  end if;
  return v;
end $$;
revoke all on function public.issue_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid) to service_role;

-- 3. place_order now also stores shipping + volume discount.
create or replace function public.place_order(p_order jsonb, p_items jsonb, p_coupon_id uuid)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_item jsonb;
  v_qty integer;
begin
  insert into public.orders (
    status, customer_name, customer_email, customer_address, total,
    discount_amount, volume_discount_amount, shipping_amount, coupon_code, stripe_payment_intent_id
  ) values (
    'paid',
    p_order->>'customer_name',
    p_order->>'customer_email',
    p_order->'customer_address',
    (p_order->>'total')::numeric,
    coalesce((p_order->>'discount_amount')::numeric, 0),
    coalesce((p_order->>'volume_discount_amount')::numeric, 0),
    (p_order->>'shipping_amount')::numeric,
    p_order->>'coupon_code',
    p_order->>'stripe_payment_intent_id'
  )
  on conflict (stripe_payment_intent_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.orders
      where stripe_payment_intent_id = p_order->>'stripe_payment_intent_id';
    return jsonb_build_object('order_id', v_id, 'created', false);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    insert into public.order_items (
      order_id, product_id, variant_id, size_id, qty, unit_price,
      design_data, design_render_paths
    ) values (
      v_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      (v_item->>'size_id')::uuid,
      v_qty,
      (v_item->>'unit_price')::numeric,
      v_item->'design_data',
      '{}'
    );

    if v_item->>'size_id' is not null then
      update public.variant_size_availability
         set stock = greatest(0, stock - v_qty),
             available = stock - v_qty > 0
       where variant_id = (v_item->>'variant_id')::uuid
         and size_id = (v_item->>'size_id')::uuid;
    end if;
  end loop;

  if p_coupon_id is not null then
    update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
  end if;

  return jsonb_build_object('order_id', v_id, 'created', true);
end $$;
revoke all on function public.place_order(jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, uuid) to service_role;
