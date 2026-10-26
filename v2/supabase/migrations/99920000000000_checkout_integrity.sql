-- Checkout integrity (v2-checkout). Idempotent.
--  1. checkout_carts: unit prices frozen when the PaymentIntent is created,
--     coupon reservation, release of replaced attempts, owner-alert flag.
--  2. order_items: stock actually taken + product name snapshot.
--  3. place_order: re-checks stock and the coupon limit atomically (row
--     locks). A paid order is never dropped: problems go to
--     orders.review_reason. Deletes the checkout snapshot (personal data).
--  4. mark_order_refunded: restores exactly the stock taken and gives the
--     coupon use back.
--  5. Rate limit for create-payment-intent (card testing, PII flooding).
--  6. purge_checkout_carts() + daily pg_cron job (Datenschutz: abandoned
--     checkouts are deleted after 30 days). Without pg_cron run it manually:
--       select public.purge_checkout_carts();            -- default 30 days
--       select public.purge_checkout_carts('7 days');
--  7. order_confirmation(): order number etc. for the order success page.

-- 1. checkout_carts --------------------------------------------------------------
alter table public.checkout_carts add column if not exists prices jsonb;      -- [{unit, name}] per item, frozen
alter table public.checkout_carts add column if not exists coupon_id uuid;    -- coupon use reserved by this attempt
alter table public.checkout_carts add column if not exists secret_hash text;  -- sha256(client_secret), proves ownership
alter table public.checkout_carts add column if not exists released_at timestamptz;
alter table public.checkout_carts add column if not exists failure_alerted_at timestamptz;

create index if not exists checkout_carts_created_at_idx on public.checkout_carts (created_at);
create index if not exists checkout_carts_coupon_idx on public.checkout_carts (coupon_id, created_at)
  where coupon_id is not null and released_at is null;

-- 2. order_items -----------------------------------------------------------------
-- stock_taken: pieces place_order really took from stock (null = order placed
-- before this column existed). product_name: survives catalogue deletions.
alter table public.order_items add column if not exists stock_taken integer;
alter table public.order_items add column if not exists product_name text;

-- Coupon uses held by open checkout attempts: not released, younger than one
-- hour and not yet turned into an order.
create or replace function public.coupon_open_reservations(p_coupon_id uuid)
  returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.checkout_carts c
   where c.coupon_id = p_coupon_id
     and c.released_at is null
     and c.created_at > now() - interval '60 minutes'
     and not exists (select 1 from public.orders o where o.stripe_payment_intent_id = c.payment_intent_id);
$$;

-- Stores the priced cart of a new PaymentIntent and reserves one coupon use
-- (coupon row locked, so parallel checkouts cannot both take the last use).
-- Returns false when the coupon is exhausted; nothing is stored then.
create or replace function public.save_checkout_cart(
  p_payment_intent_id text,
  p_items jsonb,
  p_prices jsonb,
  p_customer jsonb,
  p_coupon_id uuid,
  p_secret_hash text
) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_max integer;
  v_used integer;
begin
  if p_coupon_id is not null then
    select max_uses, used_count into v_max, v_used
      from public.coupons where id = p_coupon_id for update;
    if v_max is not null and v_used + public.coupon_open_reservations(p_coupon_id) >= v_max then
      return false;
    end if;
  end if;

  insert into public.checkout_carts (payment_intent_id, items, prices, customer, coupon_id, secret_hash)
  values (p_payment_intent_id, p_items, p_prices, p_customer, p_coupon_id, p_secret_hash);
  return true;
end $$;

-- 3. place_order -------------------------------------------------------------------
create or replace function public.place_order(p_order jsonb, p_items jsonb, p_coupon_id uuid)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_number text;
  v_item jsonb;
  v_qty integer;
  v_name text;
  v_product uuid;
  v_variant uuid;
  v_size uuid;
  v_size_name text;
  v_has_row boolean;
  v_stock integer;
  v_available boolean;
  v_taken integer;
  v_code text;
  v_max integer;
  v_used integer;
  v_reasons text[] := '{}';
  v_reason text;
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
  returning id, order_number into v_id, v_number;

  if v_id is null then
    select id, order_number into v_id, v_number from public.orders
      where stripe_payment_intent_id = p_order->>'stripe_payment_intent_id';
    return jsonb_build_object('order_id', v_id, 'order_number', v_number, 'created', false);
  end if;

  -- Lock all stock rows of this order in a fixed order first, so two orders
  -- sharing sizes cannot deadlock.
  perform 1
     from public.variant_size_availability a
    where (a.variant_id, a.size_id) in (
            select (e->>'variant_id')::uuid, (e->>'size_id')::uuid
              from jsonb_array_elements(p_items) e
             where e->>'variant_id' is not null and e->>'size_id' is not null)
    order by a.variant_id, a.size_id
      for update;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;

    -- Catalogue rows deleted since payment must not block a paid order: keep
    -- the line (with its name snapshot) and drop the dangling reference.
    select id, name into v_product, v_name from public.products where id = (v_item->>'product_id')::uuid;
    v_name := coalesce(nullif(v_item->>'product_name', ''), v_name, 'Artikel');
    select id into v_variant from public.variants where id = (v_item->>'variant_id')::uuid;
    select id, name into v_size, v_size_name from public.sizes where id = (v_item->>'size_id')::uuid;
    if v_product is null or v_variant is null or (v_item->>'size_id' is not null and v_size is null) then
      v_reasons := v_reasons || format('%s × %s: Artikel nicht mehr im Katalog', v_qty, v_name);
    end if;

    -- Stock: take what is there under a row lock, never more. A shortfall is
    -- flagged for the admin instead of failing the already paid order.
    v_taken := 0;
    if v_variant is not null and v_size is not null then
      select stock, available into v_stock, v_available
        from public.variant_size_availability
       where variant_id = v_variant and size_id = v_size
         for update;
      v_has_row := found;
      if v_has_row then
        v_taken := least(v_qty, greatest(v_stock, 0));
        update public.variant_size_availability
           set stock = stock - v_taken,
               available = available and stock - v_taken > 0
         where variant_id = v_variant and size_id = v_size;
      end if;
      if not v_has_row or v_taken < v_qty then
        v_reasons := v_reasons || format('%s × %s (Größe %s): nur %s auf Lager', v_qty, v_name, v_size_name, v_taken);
      elsif not v_available then
        v_reasons := v_reasons || format('%s × %s (Größe %s): Größe ist als nicht lieferbar markiert', v_qty, v_name, v_size_name);
      end if;
    elsif v_item->>'size_id' is null and v_variant is not null
          and exists (select 1 from public.variant_size_availability where variant_id = v_variant) then
      v_reasons := v_reasons || format('%s × %s: ohne Größe bestellt', v_qty, v_name);
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, size_id, qty, unit_price,
      design_data, design_render_paths, stock_taken, product_name
    ) values (
      v_id, v_product, v_variant, v_size, v_qty,
      (v_item->>'unit_price')::numeric,
      v_item->'design_data',
      '{}',
      v_taken,
      v_name
    );
  end loop;

  -- Coupon limit, re-checked under a row lock. The use is always counted (it
  -- happened); an over-limit use is flagged for the admin.
  if p_coupon_id is not null then
    select code, max_uses, used_count into v_code, v_max, v_used
      from public.coupons where id = p_coupon_id for update;
    if found then
      if v_max is not null and v_used >= v_max then
        v_reasons := v_reasons || format('Gutschein %s war bereits ausgeschöpft (%s von %s Einlösungen)', v_code, v_used, v_max);
      end if;
      update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
    end if;
  end if;

  if cardinality(v_reasons) > 0 then
    v_reason := array_to_string(v_reasons, '; ');
    update public.orders set review_reason = v_reason where id = v_id;
  end if;

  -- The order now holds the customer data; drop the checkout snapshot.
  delete from public.checkout_carts where payment_intent_id = p_order->>'stripe_payment_intent_id';

  return jsonb_build_object('order_id', v_id, 'order_number', v_number, 'created', true, 'review_reason', v_reason);
end $$;

-- 4. mark_order_refunded ---------------------------------------------------------
create or replace function public.mark_order_refunded(p_order_id uuid)
  returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_coupon text;
begin
  update public.orders set status = 'refunded'
   where id = p_order_id
     and status in ('paid', 'in_production', 'shipped', 'completed')
  returning coupon_code into v_coupon;
  if not found then
    return false;
  end if;

  -- Give back exactly what place_order took; orders placed before
  -- stock_taken existed fall back to the ordered quantity. A size that was
  -- sold out becomes available again; one the admin switched off stays off.
  update public.variant_size_availability a
     set stock = a.stock + s.qty,
         available = a.available or a.stock <= 0
    from (
      select variant_id, size_id, sum(coalesce(stock_taken, qty))::integer as qty
        from public.order_items
       where order_id = p_order_id and variant_id is not null and size_id is not null
       group by variant_id, size_id
    ) s
   where a.variant_id = s.variant_id and a.size_id = s.size_id and s.qty > 0;

  -- A refunded order has not really used its coupon.
  if v_coupon is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where code = v_coupon;
  end if;

  return true;
end $$;

-- 5. Rate limit ---------------------------------------------------------------------
-- One row per accepted create-payment-intent call; e-mail and IP are stored
-- only as md5 keys and purged after a day.
create table if not exists public.checkout_rate_events (
  id         bigint generated always as identity primary key,
  email_key  text,
  ip_key     text,
  created_at timestamptz not null default now()
);
alter table public.checkout_rate_events enable row level security;
revoke all on public.checkout_rate_events from anon, authenticated;
create index if not exists checkout_rate_events_created_idx on public.checkout_rate_events (created_at);
create index if not exists checkout_rate_events_email_idx on public.checkout_rate_events (email_key, created_at);
create index if not exists checkout_rate_events_ip_idx on public.checkout_rate_events (ip_key, created_at);

-- Returns null when the attempt is allowed (and counts it), otherwise the
-- German message for the customer. Serialised by an advisory lock so
-- parallel calls cannot slip past the limits.
create or replace function public.checkout_rate_limit(p_email text, p_ip text)
  returns text
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := md5(lower(trim(coalesce(p_email, ''))));
  v_ip text := case when coalesce(trim(p_ip), '') = '' then null else md5(trim(p_ip)) end;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('checkout_rate_limit'));

  select count(*) into v_count from public.checkout_rate_events
   where created_at > now() - interval '1 minute';
  if v_count >= 60 then
    return 'Gerade gehen sehr viele Bestellungen ein. Bitte versuche es in einer Minute erneut.';
  end if;

  select count(*) into v_count from public.checkout_rate_events
   where email_key = v_email and created_at > now() - interval '10 minutes';
  if v_count >= 10 then
    return 'Zu viele Zahlungsversuche mit dieser E-Mail-Adresse. Bitte warte ein paar Minuten.';
  end if;

  if v_ip is not null then
    select count(*) into v_count from public.checkout_rate_events
     where ip_key = v_ip and created_at > now() - interval '10 minutes';
    if v_count >= 20 then
      return 'Zu viele Zahlungsversuche. Bitte warte ein paar Minuten.';
    end if;
  end if;

  insert into public.checkout_rate_events (email_key, ip_key) values (v_email, v_ip);
  return null;
end $$;

-- 6. Purge ----------------------------------------------------------------------------
create or replace function public.purge_checkout_carts(p_retention interval default interval '30 days')
  returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  delete from public.checkout_carts where created_at < now() - p_retention;
  get diagnostics v_count = row_count;
  delete from public.checkout_rate_events where created_at < now() - interval '1 day';
  return v_count;
end $$;

-- Daily purge at 03:17 when pg_cron is available (hosted Supabase: yes).
do $do$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron could not be enabled (%). Run select public.purge_checkout_carts(); regularly.', sqlerrm;
    end;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('purge-checkout-carts', '17 3 * * *', 'select public.purge_checkout_carts()');
    exception when others then
      raise notice 'purge job could not be scheduled (%). Run select public.purge_checkout_carts(); regularly.', sqlerrm;
    end;
  else
    raise notice 'pg_cron not installed. Run select public.purge_checkout_carts(); regularly.';
  end if;
end $do$;

-- 7. Order success page ------------------------------------------------------------------
-- The random order id in the success URL is the key; returns no personal data.
create or replace function public.order_confirmation(p_order_id uuid)
  returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'total', o.total,
    'item_count', (select coalesce(sum(i.qty), 0) from public.order_items i where i.order_id = o.id),
    'email_sent', o.email_sent
  )
  from public.orders o
  where o.id = p_order_id and o.created_at > now() - interval '30 days';
$$;

-- Grants ---------------------------------------------------------------------------------
revoke all on function public.coupon_open_reservations(uuid) from public, anon, authenticated;
revoke all on function public.save_checkout_cart(text, jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.place_order(jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.mark_order_refunded(uuid) from public, anon, authenticated;
revoke all on function public.checkout_rate_limit(text, text) from public, anon, authenticated;
revoke all on function public.purge_checkout_carts(interval) from public, anon, authenticated;
revoke all on function public.order_confirmation(uuid) from public;
grant execute on function public.coupon_open_reservations(uuid) to service_role;
grant execute on function public.save_checkout_cart(text, jsonb, jsonb, jsonb, uuid, text) to service_role;
grant execute on function public.place_order(jsonb, jsonb, uuid) to service_role;
grant execute on function public.mark_order_refunded(uuid) to service_role;
grant execute on function public.checkout_rate_limit(text, text) to service_role;
grant execute on function public.purge_checkout_carts(interval) to service_role;
grant execute on function public.order_confirmation(uuid) to anon, authenticated, service_role;
