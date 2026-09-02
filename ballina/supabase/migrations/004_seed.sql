-- ===========================================================================
-- Ballina B2B · demo seed — run AFTER 003_platform.sql.
-- Creates the demo company "Brauhaus Lindental GmbH" with ONE account and one
-- open quote. Idempotent: safe to re-run (upserts by email).
--
-- Demo login:  einkauf@brauhaus-lindental.de  /  Ballina2026!
-- ===========================================================================

create extension if not exists pgcrypto;

create or replace function seed_auth_user(p_email text, p_password text)
  returns uuid language plpgsql security definer set search_path = auth, public, extensions as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      -- GoTrue expects '' (not NULL) in these, otherwise login errors with
      -- "Database error querying schema".
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      p_email, crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), p_email, uid,
      jsonb_build_object('sub', uid::text, 'email', p_email), 'email',
      now(), now(), now()
    );
  else
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')) where id = uid;
  end if;
  return uid;
end $$;

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

  uid := seed_auth_user('einkauf@brauhaus-lindental.de', 'Ballina2026!');

  insert into b2b_profiles (user_id, company_id, name, email)
  values (uid, cid, 'Markus Lindenthal', 'einkauf@brauhaus-lindental.de')
  on conflict (user_id) do update set company_id = excluded.company_id, name = excluded.name;

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
