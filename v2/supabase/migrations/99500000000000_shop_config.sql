-- Public shop configuration (shipping + VAT) for the storefront. `settings`
-- itself stays closed to anon (it also holds order_email); this function
-- exposes only the values the cart must show, so the displayed shipping always
-- matches what create-payment-intent charges after an admin edit.
create or replace function public.shop_config()
  returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shipping_flat', coalesce(shipping_flat, 4.90),
    'free_shipping_threshold', coalesce(free_shipping_threshold, 50),
    'vat_rate', coalesce(vat_rate, 0.19)
  )
  from public.settings where id = 1;
$$;
revoke all on function public.shop_config() from public;
grant execute on function public.shop_config() to anon, authenticated, service_role;
