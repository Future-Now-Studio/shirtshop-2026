-- Delivery time (Lieferzeit) shown on product page, designer, cart and
-- checkout (§ 312d BGB / Art. 246a EGBGB). Editable in Admin → Einstellungen;
-- the default mirrors the FAQ. Exposed through the public shop_config() RPC.
alter table public.settings
  add column if not exists delivery_time text not null
  default '3–5 Werktage, mit individuellem Druck 5–10 Werktage';

create or replace function public.shop_config()
  returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shipping_flat', coalesce(shipping_flat, 4.90),
    'free_shipping_threshold', coalesce(free_shipping_threshold, 50),
    'vat_rate', coalesce(vat_rate, 0.19),
    'delivery_time', coalesce(nullif(trim(delivery_time), ''), '3–5 Werktage, mit individuellem Druck 5–10 Werktage')
  )
  from public.settings where id = 1;
$$;
revoke all on function public.shop_config() from public;
grant execute on function public.shop_config() to anon, authenticated, service_role;
