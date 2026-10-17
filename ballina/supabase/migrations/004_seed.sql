-- ===========================================================================
-- Ballina B2B · demo seed — run AFTER 003_platform.sql.
-- Creates the demo company "Brauhaus Lindental GmbH" with ONE account and one
-- open quote. Idempotent: safe to re-run (upserts by email).
--
-- Demo login:  einkauf@brauhaus-lindental.de — invite this user first
--              (Dashboard → Authentication → Users → Invite). No passwords here.
-- ===========================================================================

create extension if not exists pgcrypto;

-- SECURITY: this file used to define a SECURITY DEFINER helper
-- seed_auth_user(email, password) and contained a plaintext demo password.
-- That helper was callable by `anon` via PostgREST (account takeover) and has
-- been removed (007_security_hardening.sql drops it on existing databases).
--
-- Create the demo login yourself instead — never put passwords in SQL:
--   Dashboard → Authentication → Users → "Invite user"
--   (or the back-office "Neuer Kunde" form, which calls admin-create-user).
-- This seed only links an EXISTING auth user to the demo company.

do $$
declare
  cid uuid;
  uid uuid;
  qid uuid;
begin
  insert into b2b_companies (
    name, customer_number, vat_id, payment_terms,
    billing_line1, billing_zip, billing_city, billing_country,
    delivery_line1, delivery_zip, delivery_city, delivery_country,
    discount_percent, annual_budget
  )
  values (
    'Brauhaus Lindental GmbH', 'B2B-10428', 'DE 812 345 678', '14 Tage netto, auf Rechnung',
    'Lindentalstraße 12', '01277', 'Dresden', 'Deutschland',
    'Brauhaus Lindental – Lager, Zeithainer Str. 4', '01279', 'Dresden', 'Deutschland',
    12, 12000
  )
  on conflict (customer_number) do update set name = excluded.name
  returning id into cid;

  select id into uid from auth.users where email = 'einkauf@brauhaus-lindental.de';
  if uid is null then
    raise notice 'auth user einkauf@brauhaus-lindental.de not found — invite it first, then re-run to link the profile';
  else
    insert into b2b_profiles (user_id, company_id, name, email)
    values (uid, cid, 'Markus Lindenthal', 'einkauf@brauhaus-lindental.de')
    on conflict (user_id) do update set company_id = excluded.company_id, name = excluded.name;
  end if;

  select id into qid from b2b_quotes where company_id = cid and quote_number = 'AN-2026-0088';
  if qid is null then
    insert into b2b_quotes (company_id, quote_number, title, status, total, note, valid_until)
    values (cid, 'AN-2026-0088', 'Winterjacken Außendienst 2026', 'offen', 2245.00,
            'Preis inkl. Rückenstick Logo, gestaffelt ab 50 Stück.', '2026-09-30 23:59+00')
    returning id into qid;
    insert into b2b_quote_items (quote_id, product_id, product_name, image_url, color, size, quantity, unit_price)
    values
      (qid, 'p6', 'Softshell-Jacke', '', 'Schwarz', 'L', 30, 44.90),
      (qid, 'p6', 'Softshell-Jacke', '', 'Schwarz', 'XL', 20, 44.90);
  end if;
end $$;

-- ===========================================================================
-- Verify:  select email from b2b_profiles;
-- ===========================================================================
