-- Fixes from the pre-go-live review. Idempotent.
--   1. Coupon reservations of open checkouts last 20 instead of 60 minutes, so
--      unpaid checkout attempts cannot block a limited coupon for long
--      (place_order still flags an order that ends up over the limit).
--   2. A refund only puts stock back while the order is still 'paid': printed
--      or shipped garments are physically gone.
--   3. Order lines of placed orders are frozen (amounts, quantities, stock);
--      invoices add up the lines, so they must match orders.total.
--   4. The daily purge keeps checkout carts of paid-but-failed orders (owner
--      still has to reconcile them) and drops newsletter signups that were
--      never confirmed within 7 days.
--   5. The global checkout cap is raised: at 60/min one attacker rotating
--      e-mails and IPs could block checkout for every customer.
--   6. flag_order_review: the stripe-webhook marks charged-back orders for
--      review. orders.review_reason is free German text (no CHECK constraint);
--      a new reason is appended to an existing one, never replaces it.

-- 1 ---------------------------------------------------------------------------
create or replace function public.coupon_open_reservations(p_coupon_id uuid)
  returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.checkout_carts c
   where c.coupon_id = p_coupon_id
     and c.released_at is null
     and c.created_at > now() - interval '20 minutes'
     and not exists (select 1 from public.orders o where o.stripe_payment_intent_id = c.payment_intent_id);
$$;

-- 2 ---------------------------------------------------------------------------
create or replace function public.mark_order_refunded(p_order_id uuid)
  returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_coupon text;
  v_old    text;
begin
  select status into v_old from public.orders where id = p_order_id for update;
  update public.orders set status = 'refunded'
   where id = p_order_id
     and status in ('paid', 'in_production', 'shipped', 'completed')
  returning coupon_code into v_coupon;
  if not found then
    return false;
  end if;

  -- Give back exactly what place_order took — but only if production has not
  -- started; afterwards the blanks are printed/shipped and gone. Orders placed
  -- before stock_taken existed fall back to the ordered quantity. A size that
  -- was sold out becomes available again; one the admin switched off stays off.
  if v_old = 'paid' then
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
  end if;

  -- A refunded order has not really used its coupon.
  if v_coupon is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where code = v_coupon;
  end if;

  return true;
end $$;

revoke all on function public.mark_order_refunded(uuid) from public, anon, authenticated;

-- 3 ---------------------------------------------------------------------------
create or replace function public.guard_order_items()
  returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status text;
begin
  if public.is_trusted_writer() then
    return coalesce(new, old);
  end if;
  select status into v_status from public.orders where id = old.order_id;
  -- Parent already gone (cascade delete) or never charged: nothing to protect.
  if v_status is null or v_status in ('pending', 'cancelled') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Positionen einer bezahlten Bestellung können nicht gelöscht werden.' using errcode = '42501';
  end if;
  -- Catalogue references may only go to null (ON DELETE SET NULL when a
  -- product/colour/size is deleted; product_name keeps the line readable).
  if new.order_id is distinct from old.order_id
     or new.qty is distinct from old.qty
     or new.unit_price is distinct from old.unit_price
     or (new.product_id is distinct from old.product_id and new.product_id is not null)
     or (new.variant_id is distinct from old.variant_id and new.variant_id is not null)
     or (new.size_id is distinct from old.size_id and new.size_id is not null)
     or new.stock_taken is distinct from old.stock_taken then
    raise exception 'Menge, Preis und Artikel einer bezahlten Bestellung sind unveränderlich.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function public.guard_order_items() from public, anon, authenticated;

drop trigger if exists guard_order_items on public.order_items;
create trigger guard_order_items before update or delete on public.order_items
  for each row execute function public.guard_order_items();

-- 4 ---------------------------------------------------------------------------
create or replace function public.purge_checkout_carts(p_retention interval default interval '30 days')
  returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  -- Carts of paid checkouts whose order could not be created stay until the
  -- owner has dealt with them (their design files stay with them).
  delete from public.checkout_carts
   where created_at < now() - p_retention and failure_alerted_at is null;
  get diagnostics v_count = row_count;
  delete from public.checkout_rate_events where created_at < now() - interval '1 day';
  -- Unconfirmed newsletter signups: the confirmation mail goes out once, so
  -- after a week the address may sign up (and get one mail) again.
  delete from public.newsletter_subscribers
   where confirmed_at is null and created_at < now() - interval '7 days';
  return v_count;
end $$;

revoke all on function public.purge_checkout_carts(interval) from public, anon, authenticated;

-- 5 ---------------------------------------------------------------------------
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
  if v_count >= 600 then
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

revoke all on function public.checkout_rate_limit(text, text) from public, anon, authenticated;

-- 6 ---------------------------------------------------------------------------
-- Appends p_reason to the order's review flag ("; " like place_order). Returns
-- false if the order is unknown or already carries exactly this reason (a
-- redelivered webhook event), so repeated calls do not stack the text.
create or replace function public.flag_order_review(p_order_id uuid, p_reason text)
  returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_reason), '') = '' then
    return false;
  end if;
  update public.orders
     set review_reason = case when coalesce(btrim(review_reason), '') = '' then p_reason
                              else review_reason || '; ' || p_reason end
   where id = p_order_id
     and (review_reason is null or strpos(review_reason, p_reason) = 0);
  return found;
end $$;

revoke all on function public.flag_order_review(uuid, text) from public, anon, authenticated;
grant execute on function public.flag_order_review(uuid, text) to service_role;
