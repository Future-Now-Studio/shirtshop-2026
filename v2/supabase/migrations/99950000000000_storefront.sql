-- Storefront fixes. Idempotent.
--  1. Public form inserts (contact, bulk inquiry, review) also for signed-in
--     users: an admin testing the forms or a visitor with a stale session got
--     an RLS error ("Senden fehlgeschlagen"). Same idea as 99900 for reads.
--  2. Sanity checks for Admin → Einstellungen (the form validates too).

-- 1. Insert policies: anon → anon + authenticated (check expressions unchanged)
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_messages'
             and policyname = 'anon insert contact') then
    alter policy "anon insert contact" on public.contact_messages to anon, authenticated;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bulk_inquiries'
             and policyname = 'anon insert bulk_inquiries') then
    alter policy "anon insert bulk_inquiries" on public.bulk_inquiries to anon, authenticated;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews'
             and policyname = 'anon insert review') then
    alter policy "anon insert review" on public.reviews to anon, authenticated;
  end if;
end $$;

-- 2. Settings value checks. NOT VALID: enforced for every new write without
--    failing on an existing hosted row.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_values_check'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_values_check check (
      shipping_flat >= 0
      and free_shipping_threshold >= 0
      and design_element_price >= 0
      and vat_rate >= 0 and vat_rate < 1
      and char_length(btrim(delivery_time)) between 1 and 200
      and (order_email is null or order_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    ) not valid;
  end if;
end $$;
