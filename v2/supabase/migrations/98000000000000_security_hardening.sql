-- Security hardening:
--  1. Real admin check. Until now every policy granted `authenticated` full
--     access, so anyone who signed up with the public anon key was admin.
--     Admins are now listed in public.admins and every admin policy checks
--     public.is_admin().
--  2. One order per Stripe PaymentIntent (unique index).
--  3. Order placement and refunds run as single transactions with atomic
--     stock / coupon updates (no read-then-write races).
--
-- AFTER APPLYING: grant yourself admin, otherwise the admin area is locked:
--   insert into public.admins (user_id)
--     select id from auth.users where email = '<deine-admin-email>';
-- If the unique index fails, duplicate orders for one PaymentIntent exist —
-- clean those up first:
--   select stripe_payment_intent_id, count(*) from public.orders
--     where stripe_payment_intent_id is not null group by 1 having count(*) > 1;

-- 1. Admins -------------------------------------------------------------------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
-- No policies: only service_role (and is_admin(), security definer) reads it.
alter table public.admins enable row level security;

create or replace function public.is_admin()
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Replace every "authenticated = admin" policy with an is_admin() check.
do $$
declare t text;
begin
  foreach t in array array[
    'colors','sizes','products','variants','variant_images','product_sizes',
    'variant_size_availability','print_zones','orders','order_items',
    'volume_discounts','settings'
  ]
  loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format(
      'create policy "admin all %1$s" on public.%1$s for all to authenticated
         using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;

drop policy if exists "admin all contact" on public.contact_messages;
create policy "admin all contact" on public.contact_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all newsletter" on public.newsletter_subscribers;
create policy "admin all newsletter" on public.newsletter_subscribers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all bulk_inquiries" on public.bulk_inquiries;
create policy "admin all bulk_inquiries" on public.bulk_inquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all coupons" on public.coupons;
create policy "admin all coupons" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all reviews" on public.reviews;
create policy "admin all reviews" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage
drop policy if exists "admin write product-images" on storage.objects;
create policy "admin write product-images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin update product-images" on storage.objects;
create policy "admin update product-images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin delete product-images" on storage.objects;
create policy "admin delete product-images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin read design-renders" on storage.objects;
create policy "admin read design-renders" on storage.objects
  for select to authenticated
  using (bucket_id = 'design-renders' and public.is_admin());

drop policy if exists "admin read order-designs" on storage.objects;
create policy "admin read order-designs" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-designs' and public.is_admin());

-- 2. One order per PaymentIntent (NULLs stay allowed for manual orders) -------
create unique index if not exists orders_stripe_payment_intent_id_key
  on public.orders (stripe_payment_intent_id);

-- 3. Transactional order placement -------------------------------------------
-- Inserts order + items, decrements stock and counts the coupon in one
-- transaction. A second call for the same PaymentIntent returns the existing
-- order instead of creating a duplicate. Called only by the create-order
-- Edge Function (service_role).
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
    discount_amount, coupon_code, stripe_payment_intent_id
  ) values (
    'paid',
    p_order->>'customer_name',
    p_order->>'customer_email',
    p_order->'customer_address',
    (p_order->>'total')::numeric,
    coalesce((p_order->>'discount_amount')::numeric, 0),
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

    -- Atomic decrement: both expressions see the pre-update stock.
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

-- Marks an order refunded and restores its stock — exactly once. Returns false
-- if the order is not in a refundable status (already refunded, pending, ...).
create or replace function public.mark_order_refunded(p_order_id uuid)
  returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'refunded'
   where id = p_order_id
     and status in ('paid', 'in_production', 'shipped', 'completed');
  if not found then
    return false;
  end if;

  update public.variant_size_availability a
     set stock = a.stock + s.qty,
         available = true
    from (
      select variant_id, size_id, sum(qty)::integer as qty
        from public.order_items
       where order_id = p_order_id and variant_id is not null and size_id is not null
       group by variant_id, size_id
    ) s
   where a.variant_id = s.variant_id and a.size_id = s.size_id;

  return true;
end $$;

revoke all on function public.place_order(jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.mark_order_refunded(uuid) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, uuid) to service_role;
grant execute on function public.mark_order_refunded(uuid) to service_role;
