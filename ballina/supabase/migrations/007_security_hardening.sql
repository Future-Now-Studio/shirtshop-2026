-- ===========================================================================
-- Ballina B2B · 007 security hardening
-- Run AFTER 003_platform.sql, 004_seed.sql, 005_admin.sql, 006_*.sql.
-- Idempotent: safe to re-run. Runs in a single transaction.
--
-- What it does
--   1. Drops the SECURITY DEFINER helper seed_auth_user(email,password) that
--      004 left behind. It was executable by `anon` through PostgREST
--      (/rest/v1/rpc/seed_auth_user) and let anyone overwrite ANY user's password.
--   2. Profiles: customers can no longer insert/update b2b_profiles (company_id
--      re-pointing = cross-tenant access). A trigger additionally rejects any
--      change of user_id/company_id that is not made by an admin / service_role.
--   3. Orders/quotes/items/audit: customers lose direct INSERT/UPDATE. All
--      customer mutations go through SECURITY DEFINER RPCs that validate
--      ownership + state and compute prices server-side:
--        accept_quote, decline_quote, cancel_order, reclaim_order, create_order,
--        expire_quotes; admin-only: admin_confirm_order_prices.
--   4. Numbering: order_number (year-aware), quote_number and customer_number
--      come from sequences in the DB; UNIQUE constraints on all three.
--   5. Private storage bucket `invoices` + company-scoped read policies.
--   6. Drops any leftover/unknown RLS policy on the b2b_* tables (e.g. from the
--      superseded 001/002 migrations) so only the policies below remain.
--
-- MANUAL STEPS (cannot be done in SQL / must be done by a human)
--   a) BEFORE applying: check for duplicate numbers, otherwise adding the
--      UNIQUE constraints fails (the migration aborts with a clear message):
--        select order_number, count(*) from b2b_orders group by 1 having count(*) > 1;
--        select quote_number, count(*) from b2b_quotes group by 1 having count(*) > 1;
--      Rename duplicates by hand (e.g. append '-B'), then re-run.
--   b) ROTATE the passwords of every account that was created by
--      004_seed.sql / 005_admin.sql (einkauf@brauhaus-lindental.de,
--      admin@ballina.de): the passwords were committed to git in plaintext and
--      seed_auth_user() was publicly callable, so treat both accounts — and any
--      other account — as potentially compromised. Use Dashboard →
--      Authentication → Users → "Send password recovery", and check
--      auth.users.updated_at / auth.audit_log_entries for unexpected changes.
--   c) Apply order: 003 → (004, 005, 006 already applied) → 007.
--      ./supabase/apply.sh "<connection string>"   (see DEPLOY.md)
--   d) If the `invoices` bucket was created in the dashboard with extra
--      policies, review Storage → Policies and remove anything broader than
--      the two policies created below.
--   e) Optional: schedule `select public.expire_quotes();` daily (pg_cron);
--      the app also calls it when quotes are listed/accepted.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove the public password-reset backdoor
-- ---------------------------------------------------------------------------
drop function if exists public.seed_auth_user(text, text);

-- ---------------------------------------------------------------------------
-- 0. Small helpers
-- ---------------------------------------------------------------------------
-- "Today" in the business time zone; quotes are valid through the whole
-- valid_until day (Europe/Berlin).
create or replace function public.b2b_today() returns date
  language sql stable set search_path = public, pg_temp as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;

create or replace function public.b2b_quote_valid(p_valid_until timestamptz) returns boolean
  language sql stable set search_path = public, pg_temp as $$
  select p_valid_until is null
      or (p_valid_until at time zone 'Europe/Berlin')::date >= public.b2b_today()
$$;

-- ---------------------------------------------------------------------------
-- 6. Policy cleanup: drop every policy on the b2b tables that is not part of
--    the intended set (catches leftovers from 001/002 such as
--    "Users can update own profile" or "own orders insert").
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  keep text[] := array[
    'company_read','profile_self','orders_read','items_read','events_read',
    'quotes_read','quote_items_read','audit_read','inq_own_read','inq_own_insert',
    'admin_self'
  ];
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('b2b_companies','b2b_profiles','b2b_orders','b2b_order_items',
                         'b2b_order_events','b2b_quotes','b2b_quote_items','b2b_audit_log',
                         'b2b_inquiries','b2b_admins')
       and not (policyname = any(keep))
       and policyname <> tablename || '_admin_all'
  loop
    raise notice 'dropping policy % on %', r.policyname, r.tablename;
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Profiles: no customer insert/update; guard tenant-binding columns
-- ---------------------------------------------------------------------------
-- Profiles are created by the admin-create-user Netlify function
-- (service_role, bypasses RLS) or by admins (b2b_profiles_admin_all).
-- Customers never write their profile from the app.
drop policy if exists profile_self_insert on b2b_profiles;
drop policy if exists profile_self_update on b2b_profiles;

create or replace function public.b2b_profiles_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- auth.uid() is null for service_role / SQL editor → allowed.
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      raise exception 'Profile können nur vom Backoffice angelegt werden.' using errcode = '42501';
    end if;
    if new.user_id is distinct from old.user_id
       or new.company_id is distinct from old.company_id
       or new.email is distinct from old.email then
      raise exception 'user_id/company_id/email dürfen nicht geändert werden.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_guard on b2b_profiles;
create trigger trg_profiles_guard before insert or update on b2b_profiles
  for each row execute function public.b2b_profiles_guard();

-- ---------------------------------------------------------------------------
-- 3. Orders / items / quotes / audit: read-only for customers
-- ---------------------------------------------------------------------------
drop policy if exists orders_insert   on b2b_orders;
drop policy if exists orders_update   on b2b_orders;
drop policy if exists items_insert    on b2b_order_items;
drop policy if exists quotes_update   on b2b_quotes;
drop policy if exists audit_own_insert on b2b_audit_log;

-- Inquiries: customers may still create them, but only as 'neu' for their own company.
drop policy if exists inq_own_insert on b2b_inquiries;
create policy inq_own_insert on b2b_inquiries for insert
  with check (company_id = current_company_id() and status = 'neu');

-- Orders whose prices were not derived from a confirmed server-side source
-- (see create_order) wait for the back-office to confirm them.
alter table b2b_orders add column if not exists price_confirmed boolean not null default true;

-- ---------------------------------------------------------------------------
-- 4. Numbering via sequences + UNIQUE
-- ---------------------------------------------------------------------------
-- Orders: '<YYYY>-<seq>' (year from Europe/Berlin), sequence keeps counting
-- across years so numbers stay unique.
create sequence if not exists b2b_order_seq start 500;
select setval('b2b_order_seq', greatest(
  (select last_value from b2b_order_seq),
  coalesce((select max((substring(order_number from '-(\d+)$'))::bigint) from b2b_orders), 0)
));
alter table b2b_orders alter column order_number
  set default (to_char(now() at time zone 'Europe/Berlin', 'YYYY') || '-' ||
               lpad(nextval('b2b_order_seq')::text, 4, '0'));

-- Quotes: 'AN-<YYYY>-<seq>'
create sequence if not exists b2b_quote_seq start 89;
select setval('b2b_quote_seq', greatest(
  (select last_value from b2b_quote_seq),
  coalesce((select max((substring(quote_number from '-(\d+)$'))::bigint) from b2b_quotes), 0)
));
alter table b2b_quotes alter column quote_number
  set default ('AN-' || to_char(now() at time zone 'Europe/Berlin', 'YYYY') || '-' ||
               lpad(nextval('b2b_quote_seq')::text, 4, '0'));

-- Customers: 'B2B-<seq>'
create sequence if not exists b2b_customer_seq start 10700;
select setval('b2b_customer_seq', greatest(
  (select last_value from b2b_customer_seq),
  coalesce((select max((substring(customer_number from '(\d+)$'))::bigint) from b2b_companies), 0)
));
alter table b2b_companies alter column customer_number
  set default ('B2B-' || nextval('b2b_customer_seq')::text);

-- UNIQUE constraints. If this fails, clean up duplicates first (see header a).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'b2b_orders_order_number_key') then
    if exists (select 1 from b2b_orders group by order_number having count(*) > 1) then
      raise exception 'Duplicate b2b_orders.order_number values — clean them up first (see header of 007).';
    end if;
    alter table b2b_orders add constraint b2b_orders_order_number_key unique (order_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'b2b_quotes_quote_number_key') then
    if exists (select 1 from b2b_quotes group by quote_number having count(*) > 1) then
      raise exception 'Duplicate b2b_quotes.quote_number values — clean them up first (see header of 007).';
    end if;
    alter table b2b_quotes add constraint b2b_quotes_quote_number_key unique (quote_number);
  end if;
  -- b2b_companies.customer_number is already UNIQUE since 003.
end $$;

-- ---------------------------------------------------------------------------
-- 3b. Customer RPCs (SECURITY DEFINER; ownership + state checks inside)
-- ---------------------------------------------------------------------------

-- Mark overdue open quotes as expired. Deterministic + idempotent, so it is
-- safe to let any authenticated user trigger it.
create or replace function public.expire_quotes() returns integer
  language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update b2b_quotes
     set status = 'abgelaufen'
   where status = 'offen'
     and not public.b2b_quote_valid(valid_until);
  get diagnostics n = row_count;
  return n;
end $$;

-- Accept a quote → atomically create the order from the quote's own items/prices.
create or replace function public.accept_quote(p_quote_id uuid) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_cid   uuid := public.current_company_id();
  v_q     b2b_quotes%rowtype;
  v_order uuid;
  v_onum  text;
  v_total numeric(12,2);
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;

  -- Housekeeping: flag overdue quotes (persists when this call succeeds; the
  -- app also calls expire_quotes() when listing quotes).
  perform public.expire_quotes();

  -- Row lock: a concurrent second accept waits here and then sees the new status.
  select * into v_q from b2b_quotes
   where id = p_quote_id and company_id = v_cid
   for update;
  if not found then
    raise exception 'Angebot nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_q.status <> 'offen' then
    raise exception 'Angebot kann nicht angenommen werden (Status: %).', v_q.status
      using errcode = '22023';
  end if;
  if not public.b2b_quote_valid(v_q.valid_until) then
    raise exception 'Angebot ist abgelaufen.' using errcode = '22023';
  end if;
  if not exists (select 1 from b2b_quote_items where quote_id = v_q.id) then
    raise exception 'Angebot enthält keine Positionen.' using errcode = '22023';
  end if;

  insert into b2b_orders (company_id, created_by, status, total, note, price_confirmed)
  values (v_cid, v_uid, 'offen', 0,
          left('Aus Angebot ' || v_q.quote_number || ' – ' || v_q.title, 2000), true)
  returning id, order_number into v_order, v_onum;

  insert into b2b_order_items (order_id, product_id, product_name, image_url, color, size, quantity, unit_price)
  select v_order, qi.product_id, qi.product_name, qi.image_url, qi.color, qi.size, qi.quantity, qi.unit_price
    from b2b_quote_items qi
   where qi.quote_id = v_q.id;

  select coalesce(sum(quantity * unit_price), 0) into v_total
    from b2b_order_items where order_id = v_order;
  update b2b_orders set total = v_total where id = v_order;

  update b2b_quotes set status = 'angenommen', order_id = v_order where id = v_q.id;

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'angebot.angenommen', v_q.quote_number, v_q.id::text,
          jsonb_build_object('detail', 'Angebot angenommen → #' || v_onum, 'source', 'kunde',
                             'order_id', v_order));
  return v_order;
end $$;

create or replace function public.decline_quote(p_quote_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_cid uuid := public.current_company_id();
  v_q   b2b_quotes%rowtype;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  select * into v_q from b2b_quotes where id = p_quote_id and company_id = v_cid for update;
  if not found then
    raise exception 'Angebot nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_q.status <> 'offen' then
    raise exception 'Angebot ist nicht mehr offen (Status: %).', v_q.status using errcode = '22023';
  end if;
  update b2b_quotes set status = 'abgelehnt' where id = v_q.id;
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'angebot.abgelehnt', v_q.quote_number, v_q.id::text,
          jsonb_build_object('detail', 'Vom Kunden abgelehnt', 'source', 'kunde'));
end $$;

create or replace function public.cancel_order(p_order_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_cid uuid := public.current_company_id();
  v_o   b2b_orders%rowtype;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  select * into v_o from b2b_orders where id = p_order_id and company_id = v_cid for update;
  if not found then
    raise exception 'Bestellung nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_o.status <> 'offen' then
    raise exception 'Nur offene Bestellungen können storniert werden (Status: %).', v_o.status
      using errcode = '22023';
  end if;
  update b2b_orders set status = 'storniert' where id = v_o.id;  -- trigger logs the event
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'bestellung.storniert', '#' || v_o.order_number, v_o.id::text,
          jsonb_build_object('detail', 'Vom Kunden storniert', 'source', 'kunde'));
end $$;

create or replace function public.reclaim_order(p_order_id uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid    uuid := auth.uid();
  v_cid    uuid := public.current_company_id();
  v_o      b2b_orders%rowtype;
  v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 2000);
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Bitte einen Grund angeben.' using errcode = '22023';
  end if;
  select * into v_o from b2b_orders where id = p_order_id and company_id = v_cid for update;
  if not found then
    raise exception 'Bestellung nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_o.status not in ('versendet', 'abgeschlossen') then
    raise exception 'Reklamation erst nach Versand möglich.' using errcode = '22023';
  end if;
  if v_o.reclamation is not null then
    raise exception 'Für diese Bestellung wurde bereits eine Reklamation gemeldet.' using errcode = '22023';
  end if;
  update b2b_orders set reclamation = v_reason where id = v_o.id;
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'bestellung.reklamation', '#' || v_o.order_number, v_o.id::text,
          jsonb_build_object('detail', v_reason, 'source', 'kunde'));
end $$;

-- Customer order (cart / reorder). The client sends WHAT it wants (product,
-- colour, size, quantity, print notes) — never prices or totals.
--
-- Pricing source (server-side): the most recent line for the same product in
-- one of the company's own, non-cancelled, price-confirmed orders (these come
-- from accepted quotes, admin-created orders or admin-confirmed orders).
--   * exact product+colour+size match and quantity >= that line's quantity
--     → price taken over, line counts as confirmed;
--   * otherwise (new product, different variant, smaller quantity → possibly
--     a different Staffel) the best available price is used as a PROVISIONAL
--     value (0 if none) and the whole order gets price_confirmed = false.
--     The back-office confirms/corrects the prices via
--     admin_confirm_order_prices() before production.
-- Catalogue (WooCommerce) prices are not reachable from Postgres, so they are
-- never trusted from the client.
create or replace function public.create_order(p_items jsonb, p_meta jsonb default '{}'::jsonb)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid       uuid := auth.uid();
  v_cid       uuid := public.current_company_id();
  v_order     uuid;
  v_onum      text;
  v_item      jsonb;
  v_pid       text;
  v_color     text;
  v_size      text;
  v_qty       integer;
  v_name      text;
  v_img       text;
  v_price     numeric(10,2);
  v_exact     boolean;
  v_src       record;
  v_confirmed boolean := true;
  v_total     numeric(12,2) := 0;
  v_note      text;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'Ungültige Positionen (1–200 erwartet).' using errcode = '22023';
  end if;
  v_note := left(nullif(btrim(coalesce(p_meta ->> 'note', '')), ''), 2000);

  insert into b2b_orders (company_id, created_by, status, total, note, price_confirmed)
  values (v_cid, v_uid, 'offen', 0, v_note, true)
  returning id, order_number into v_order, v_onum;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Ungültige Position.' using errcode = '22023';
    end if;
    v_pid   := left(nullif(btrim(coalesce(v_item ->> 'product_id', '')), ''), 100);
    v_color := left(nullif(btrim(coalesce(v_item ->> 'color', '')), ''), 100);
    v_size  := left(nullif(btrim(coalesce(v_item ->> 'size', '')), ''), 50);
    if v_pid is null or v_color is null or v_size is null then
      raise exception 'Position unvollständig (Produkt/Farbe/Größe).' using errcode = '22023';
    end if;
    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,6}$' then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 100000 then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;

    select oi.unit_price, oi.quantity, oi.product_name, oi.image_url,
           (oi.color = v_color and oi.size = v_size) as exact
      into v_src
      from b2b_order_items oi
      join b2b_orders o on o.id = oi.order_id
     where o.company_id = v_cid
       and o.id <> v_order
       and o.status <> 'storniert'
       and o.price_confirmed
       and oi.product_id = v_pid
     order by (oi.color = v_color and oi.size = v_size) desc, o.created_at desc
     limit 1;

    if found then
      v_price := v_src.unit_price;
      v_name  := v_src.product_name;
      v_img   := coalesce(v_src.image_url, left(v_item ->> 'image_url', 1000));
      v_exact := v_src.exact and v_qty >= v_src.quantity;
    else
      v_price := 0;
      v_name  := left(nullif(btrim(coalesce(v_item ->> 'product_name', '')), ''), 200);
      v_img   := left(v_item ->> 'image_url', 1000);
      v_exact := false;
    end if;
    if v_name is null then v_name := 'Artikel ' || v_pid; end if;
    if not v_exact then v_confirmed := false; end if;

    insert into b2b_order_items (order_id, product_id, product_name, image_url, color, size,
                                 quantity, unit_price, print_position, artwork_name)
    values (v_order, v_pid, v_name, v_img, v_color, v_size, v_qty, v_price,
            left(nullif(btrim(coalesce(v_item ->> 'print_position', '')), ''), 200),
            left(nullif(btrim(coalesce(v_item ->> 'artwork_name', '')), ''), 200));
    v_total := v_total + v_qty * v_price;
  end loop;

  update b2b_orders set total = v_total, price_confirmed = v_confirmed where id = v_order;

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'bestellung.angelegt', '#' || v_onum, v_order::text,
          jsonb_build_object('detail',
            case when v_confirmed then 'Bestellung über das Portal'
                 else 'Bestellung über das Portal – Preise zu bestätigen' end,
            'source', 'kunde'));
  return v_order;
end $$;

-- Back-office: set the unit prices of an order and mark it confirmed.
-- p_prices = {"<order_item_id>": 12.34, ...}; items not listed keep their price.
create or replace function public.admin_confirm_order_prices(p_order_id uuid, p_prices jsonb default '{}'::jsonb)
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o     b2b_orders%rowtype;
  v_key   text;
  v_val   jsonb;
  v_price numeric;
  v_total numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  select * into v_o from b2b_orders where id = p_order_id for update;
  if not found then
    raise exception 'Bestellung nicht gefunden.' using errcode = 'P0002';
  end if;
  if p_prices is not null and jsonb_typeof(p_prices) = 'object' then
    for v_key, v_val in select key, value from jsonb_each(p_prices) loop
      if jsonb_typeof(v_val) <> 'number' then
        raise exception 'Ungültiger Preis.' using errcode = '22023';
      end if;
      v_price := (v_val #>> '{}')::numeric;
      if v_price < 0 or v_price > 100000 then
        raise exception 'Ungültiger Preis.' using errcode = '22023';
      end if;
      update b2b_order_items set unit_price = round(v_price, 2)
       where id = v_key::uuid and order_id = v_o.id;
    end loop;
  end if;
  select coalesce(sum(quantity * unit_price), 0) into v_total from b2b_order_items where order_id = v_o.id;
  update b2b_orders set total = v_total, price_confirmed = true where id = v_o.id;
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_o.company_id, auth.uid(), 'bestellung.preise_bestaetigt', '#' || v_o.order_number, v_o.id::text,
          jsonb_build_object('detail', 'Preise bestätigt, Summe ' || v_total::text));
end $$;

-- Execute rights: never anon/public; customers + admins via `authenticated`.
do $$
declare f text;
begin
  foreach f in array array[
    'public.expire_quotes()',
    'public.accept_quote(uuid)',
    'public.decline_quote(uuid)',
    'public.cancel_order(uuid)',
    'public.reclaim_order(uuid, text)',
    'public.create_order(jsonb, jsonb)',
    'public.admin_confirm_order_prices(uuid, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Invoices bucket (private) + policies
-- ---------------------------------------------------------------------------
-- Paths are '<company_id>/<order_id>.pdf' (src/lib/invoices.ts).
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage schema not present — skipping invoices bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('invoices', 'invoices', false)
  on conflict (id) do update set public = false;

  execute 'drop policy if exists invoices_admin_all on storage.objects';
  execute $p$
    create policy invoices_admin_all on storage.objects for all to authenticated
      using (bucket_id = 'invoices' and public.is_admin())
      with check (bucket_id = 'invoices' and public.is_admin())
  $p$;
  execute 'drop policy if exists invoices_company_read on storage.objects';
  execute $p$
    create policy invoices_company_read on storage.objects for select to authenticated
      using (bucket_id = 'invoices'
             and split_part(name, '/', 1) = public.current_company_id()::text)
  $p$;
end $$;

-- Expire whatever is already overdue.
select public.expire_quotes();

commit;

-- ===========================================================================
-- Verify (as postgres):
--   select proname from pg_proc where proname = 'seed_auth_user';        -- 0 rows
--   select tablename, policyname, cmd from pg_policies
--    where tablename like 'b2b_%' order by 1, 2;                          -- no customer insert/update
--   select column_default from information_schema.columns
--    where table_name = 'b2b_orders' and column_name = 'order_number';
-- ===========================================================================
