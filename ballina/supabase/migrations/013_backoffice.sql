-- ===========================================================================
-- Ballina B2B · 013 back-office
-- Run AFTER 012_customer_flow.sql (does not depend on it). Idempotent; safe to
-- re-run. Runs in a single transaction.
--
--   1. Internal notes on orders and companies (b2b_order_notes,
--      b2b_company_notes). Admin-only: customers have no policy on these
--      tables, so staff remarks never reach the portal (b2b_orders.note IS
--      visible to the customer). Notes cannot be edited or deleted; author
--      and time are stamped by the database.
--   2. Reclamation workflow: b2b_orders.reclamation_status
--      ('offen' | 'in_bearbeitung' | 'erledigt') + reclamation_resolved_at.
--      A new customer reclamation (reclaim_order) starts as 'offen'.
--   3. Quotes: withdrawn_at (admin withdrew an open quote) and inquiry_id
--      (quote created from an inquiry).
--   4. Data rules: discount 0–100 %, budget >= 0, tracking link https only,
--      no "versendet"/"abgeschlossen" while prices are still unconfirmed.
--   5. Admin RPCs (SECURITY DEFINER, is_admin() checked inside, one
--      transaction each, audit row written in the same transaction):
--        admin_dashboard_stats()                  KPIs without the 1000-row cap
--        admin_create_order(company, items, meta) manual order (order + items)
--        admin_create_quote(company, items, meta) quote (+ inquiry status)
--        admin_update_quote(quote, items, meta)   correct an open quote
--        admin_withdraw_quote(quote)              withdraw an open quote
--        admin_set_reclamation_status(order, status, note)
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Internal notes (admin-only)
-- ---------------------------------------------------------------------------
create table if not exists public.b2b_order_notes (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.b2b_orders(id) on delete cascade,
  kind         text not null default 'notiz' check (kind in ('notiz', 'reklamation')),
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  author       uuid references auth.users(id) on delete set null,
  author_email text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_order_notes_order on public.b2b_order_notes (order_id, created_at desc);

create table if not exists public.b2b_company_notes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.b2b_companies(id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  author       uuid references auth.users(id) on delete set null,
  author_email text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_company_notes_company on public.b2b_company_notes (company_id, created_at desc);

-- Author + time come from the session, never from the client.
create or replace function public.b2b_notes_stamp() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.created_at := now();
  new.body := btrim(new.body);
  if auth.uid() is not null then
    new.author := auth.uid();
    new.author_email := (select u.email::text from auth.users u where u.id = auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists b2b_order_notes_stamp on public.b2b_order_notes;
create trigger b2b_order_notes_stamp before insert on public.b2b_order_notes
  for each row execute function public.b2b_notes_stamp();
drop trigger if exists b2b_company_notes_stamp on public.b2b_company_notes;
create trigger b2b_company_notes_stamp before insert on public.b2b_company_notes
  for each row execute function public.b2b_notes_stamp();

alter table public.b2b_order_notes   enable row level security;
alter table public.b2b_company_notes enable row level security;

-- Only admins; no customer policy at all. UPDATE/DELETE are revoked below, so
-- the notes double as a lightweight trail.
drop policy if exists b2b_order_notes_admin_all on public.b2b_order_notes;
create policy b2b_order_notes_admin_all on public.b2b_order_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists b2b_company_notes_admin_all on public.b2b_company_notes;
create policy b2b_company_notes_admin_all on public.b2b_company_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on table public.b2b_order_notes, public.b2b_company_notes from public, anon;
revoke update, delete, truncate, references, trigger
  on table public.b2b_order_notes, public.b2b_company_notes from authenticated;
grant select, insert on table public.b2b_order_notes, public.b2b_company_notes to authenticated;
grant all on table public.b2b_order_notes, public.b2b_company_notes to service_role;

-- ---------------------------------------------------------------------------
-- 2. Reclamation workflow
-- ---------------------------------------------------------------------------
alter table public.b2b_orders add column if not exists reclamation_status text;
alter table public.b2b_orders add column if not exists reclamation_resolved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'b2b_orders_reclamation_status_check') then
    alter table public.b2b_orders add constraint b2b_orders_reclamation_status_check
      check (reclamation_status is null or reclamation_status in ('offen', 'in_bearbeitung', 'erledigt'));
  end if;
end $$;

-- A reclamation filed by the customer (reclaim_order) starts as 'offen'.
create or replace function public.b2b_orders_reclamation_open() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if new.reclamation is not null and new.reclamation_status is null then
    new.reclamation_status := 'offen';
  end if;
  return new;
end $$;

drop trigger if exists b2b_orders_reclamation_open on public.b2b_orders;
create trigger b2b_orders_reclamation_open
  before insert or update of reclamation on public.b2b_orders
  for each row execute function public.b2b_orders_reclamation_open();

update public.b2b_orders set reclamation_status = 'offen'
 where reclamation is not null and reclamation_status is null;

create index if not exists idx_orders_open_reclamation on public.b2b_orders (created_at desc)
  where reclamation is not null and reclamation_status is distinct from 'erledigt';
create index if not exists idx_orders_unconfirmed on public.b2b_orders (created_at desc)
  where not price_confirmed;

-- ---------------------------------------------------------------------------
-- 3. Quotes: withdrawn flag + link to the inquiry it answers
-- ---------------------------------------------------------------------------
alter table public.b2b_quotes add column if not exists withdrawn_at timestamptz;
alter table public.b2b_quotes add column if not exists inquiry_id uuid
  references public.b2b_inquiries(id) on delete set null;
create index if not exists idx_quotes_created_at on public.b2b_quotes (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Data rules
-- ---------------------------------------------------------------------------
-- Discount outside 0–100 % produced negative prices in the portal.
update public.b2b_companies
   set discount_percent = least(greatest(discount_percent, 0), 100)
 where discount_percent < 0 or discount_percent > 100;
update public.b2b_companies set annual_budget = null where annual_budget < 0;
-- Tracking links are rendered as <a href>: only absolute https links. Keep
-- http:// carrier links (upgraded to https), drop everything else.
update public.b2b_orders
   set tracking_url = regexp_replace(btrim(tracking_url), '^http://', 'https://', 'i')
 where tracking_url !~ '^https://[^[:space:]]+$'
   and regexp_replace(btrim(tracking_url), '^http://', 'https://', 'i') ~ '^https://[^[:space:]]+$';
update public.b2b_orders set tracking_url = null
 where tracking_url is not null and tracking_url !~ '^https://[^[:space:]]+$';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'b2b_companies_discount_range') then
    alter table public.b2b_companies add constraint b2b_companies_discount_range
      check (discount_percent between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'b2b_companies_budget_nonnegative') then
    alter table public.b2b_companies add constraint b2b_companies_budget_nonnegative
      check (annual_budget is null or annual_budget >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'b2b_orders_tracking_url_https') then
    alter table public.b2b_orders add constraint b2b_orders_tracking_url_https
      check (tracking_url is null or tracking_url ~ '^https://[^[:space:]]+$');
  end if;
end $$;

-- Orders with provisional prices (create_order → price_confirmed = false) must
-- be confirmed (admin_confirm_order_prices) before they ship. Direct SQL /
-- service_role (auth.uid() is null) is not blocked.
create or replace function public.b2b_orders_require_confirmed_prices() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status
     and new.status in ('versendet', 'abgeschlossen')
     and not coalesce(new.price_confirmed, true)
     and auth.uid() is not null then
    raise exception 'Bitte zuerst die Preise bestätigen, bevor die Bestellung versendet wird.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists b2b_orders_require_confirmed_prices on public.b2b_orders;
create trigger b2b_orders_require_confirmed_prices
  before update of status on public.b2b_orders
  for each row execute function public.b2b_orders_require_confirmed_prices();

-- ---------------------------------------------------------------------------
-- 5. Admin RPCs
-- ---------------------------------------------------------------------------

-- Dashboard KPIs, computed in SQL (no PostgREST row cap). Order value =
-- net goods + net shipping of non-cancelled orders with confirmed prices,
-- placed in the current Europe/Berlin calendar year.
create or replace function public.admin_dashboard_stats() returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Berlin'))::integer;
  v_from timestamptz := make_timestamptz(v_year, 1, 1, 0, 0, 0, 'Europe/Berlin');
  v_to   timestamptz := make_timestamptz(v_year + 1, 1, 1, 0, 0, 0, 'Europe/Berlin');
  v      jsonb;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'year',               v_year,
           'open_orders',        count(*) filter (where o.status = 'offen'),
           'in_production',      count(*) filter (where o.status = 'in_bearbeitung'),
           'unconfirmed_orders', count(*) filter (where not o.price_confirmed and o.status <> 'storniert'),
           'unconfirmed_value',  coalesce(sum(o.total) filter (where not o.price_confirmed and o.status <> 'storniert'), 0),
           'open_reclamations',  count(*) filter (where o.reclamation is not null
                                                    and coalesce(o.reclamation_status, 'offen') <> 'erledigt'),
           'orders_year',        count(*) filter (where o.status <> 'storniert' and o.price_confirmed
                                                    and o.created_at >= v_from and o.created_at < v_to),
           'order_value_year',   coalesce(sum(o.total + o.shipping) filter (
                                   where o.status <> 'storniert' and o.price_confirmed
                                     and o.created_at >= v_from and o.created_at < v_to), 0)
         )
    into v
    from b2b_orders o;
  return v || jsonb_build_object(
    'customers',      (select count(*) from b2b_companies),
    'open_inquiries', (select count(*) from b2b_inquiries where status = 'neu'),
    'open_quotes',    (select count(*) from b2b_quotes
                        where status = 'offen' and public.b2b_quote_valid(valid_until))
  );
end $$;

-- Validate admin-entered positions (manual orders, quotes). Raises on bad
-- input; 0 € lines only with p_allow_zero (explicitly confirmed in the UI).
create or replace function public.b2b_admin_parse_items(p_items jsonb, p_allow_zero boolean)
  returns table (product_id text, product_name text, color text, size text,
                 quantity integer, unit_price numeric(10,2), print_position text)
  language plpgsql set search_path = public, pg_temp as $$
declare
  v_item  jsonb;
  v_price numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'Ungültige Positionen (1–200 erwartet).' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Ungültige Position.' using errcode = '22023';
    end if;
    product_name := left(nullif(btrim(coalesce(v_item ->> 'product_name', '')), ''), 200);
    if product_name is null then
      raise exception 'Artikelbezeichnung fehlt.' using errcode = '22023';
    end if;
    product_id := left(coalesce(nullif(btrim(coalesce(v_item ->> 'product_id', '')), ''), 'manual'), 100);
    color      := left(btrim(coalesce(v_item ->> 'color', '')), 100);
    size       := left(btrim(coalesce(v_item ->> 'size', '')), 50);
    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,6}$' then
      raise exception 'Ungültige Menge bei „%“.', product_name using errcode = '22023';
    end if;
    quantity := (v_item ->> 'quantity')::integer;
    if quantity < 1 or quantity > 100000 then
      raise exception 'Ungültige Menge bei „%“.', product_name using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'unit_price') is distinct from 'number' then
      raise exception 'Ungültiger Preis bei „%“.', product_name using errcode = '22023';
    end if;
    v_price := (v_item ->> 'unit_price')::numeric;
    if v_price < 0 or v_price > 100000 then
      raise exception 'Ungültiger Preis bei „%“.', product_name using errcode = '22023';
    end if;
    unit_price := round(v_price, 2);
    if unit_price = 0 and not coalesce(p_allow_zero, false) then
      raise exception 'Position „%“ hat keinen Preis (0 €). Bitte Preis eintragen oder 0 € ausdrücklich bestätigen.',
        product_name using errcode = '22023';
    end if;
    print_position := left(nullif(btrim(coalesce(v_item ->> 'print_position', '')), ''), 200);
    return next;
  end loop;
end $$;

-- Validated positions as a jsonb array (for jsonb_to_recordset).
create or replace function public.b2b_admin_items_json(p_items jsonb, p_allow_zero boolean)
  returns jsonb
  language sql set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.b2b_admin_parse_items(p_items, p_allow_zero) i
$$;

-- Quote validity: a Berlin calendar date (YYYY-MM-DD), today .. +2 years;
-- stored as the end of that day in Europe/Berlin.
create or replace function public.b2b_admin_valid_until(p_date text) returns timestamptz
  language plpgsql stable set search_path = public, pg_temp as $$
declare v_date date;
begin
  if coalesce(p_date, '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Bitte ein gültiges „Gültig bis“-Datum angeben.' using errcode = '22023';
  end if;
  begin
    v_date := p_date::date;
  exception when others then
    raise exception 'Bitte ein gültiges „Gültig bis“-Datum angeben.' using errcode = '22023';
  end;
  if v_date < public.b2b_today() then
    raise exception '„Gültig bis“ liegt in der Vergangenheit.' using errcode = '22023';
  end if;
  if v_date > public.b2b_today() + 730 then
    raise exception '„Gültig bis“ liegt mehr als zwei Jahre in der Zukunft.' using errcode = '22023';
  end if;
  return (v_date::timestamp + interval '23 hours 59 minutes') at time zone 'Europe/Berlin';
end $$;

-- Manual order from the back office: order + items + internal note + audit in
-- one transaction, total computed here (never trusted from the client).
-- p_meta: { status, note (visible to the customer), internal_note,
--           allow_zero_price }
create or replace function public.admin_create_order(p_company_id uuid, p_items jsonb, p_meta jsonb default '{}'::jsonb)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid      uuid := auth.uid();
  v_meta     jsonb := coalesce(p_meta, '{}'::jsonb);
  v_status   text := coalesce(nullif(btrim(coalesce(v_meta ->> 'status', '')), ''), 'offen');
  v_note     text := left(nullif(btrim(coalesce(v_meta ->> 'note', '')), ''), 2000);
  v_internal text := left(nullif(btrim(coalesce(v_meta ->> 'internal_note', '')), ''), 4000);
  v_zero     boolean := coalesce(v_meta -> 'allow_zero_price' = 'true'::jsonb, false);
  v_rows     jsonb;
  v_order    uuid;
  v_onum     text;
  v_total    numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  if not exists (select 1 from b2b_companies where id = p_company_id) then
    raise exception 'Kunde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_status not in ('offen', 'in_bearbeitung', 'versendet', 'abgeschlossen') then
    raise exception 'Ungültiger Status.' using errcode = '22023';
  end if;
  -- Validate everything before the order number is drawn (no gaps on errors).
  v_rows := public.b2b_admin_items_json(p_items, v_zero);

  insert into b2b_orders (company_id, created_by, status, total, note, price_confirmed)
  values (p_company_id, v_uid, v_status, 0, v_note, true)
  returning id, order_number into v_order, v_onum;

  insert into b2b_order_items (order_id, product_id, product_name, image_url, color, size,
                               quantity, unit_price, print_position)
  select v_order, r.product_id, r.product_name, null, r.color, r.size, r.quantity, r.unit_price, r.print_position
    from jsonb_to_recordset(v_rows) as r(product_id text, product_name text, color text, size text,
                                         quantity integer, unit_price numeric, print_position text);

  select coalesce(sum(quantity * unit_price), 0) into v_total from b2b_order_items where order_id = v_order;
  update b2b_orders set total = v_total where id = v_order;

  if v_internal is not null then
    insert into b2b_order_notes (order_id, body) values (v_order, v_internal);
  end if;

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (p_company_id, v_uid, 'bestellung.angelegt', '#' || v_onum, v_order::text,
          jsonb_build_object('detail', 'Manuell im Backoffice', 'source', 'backoffice'));
  return v_order;
end $$;

-- Replace the positions of a quote with validated rows (b2b_admin_items_json)
-- and recompute its total (internal helper).
create or replace function public.b2b_admin_set_quote_items(p_quote_id uuid, p_rows jsonb)
  returns numeric
  language plpgsql set search_path = public, pg_temp as $$
declare v_total numeric(12,2);
begin
  delete from b2b_quote_items where quote_id = p_quote_id;
  insert into b2b_quote_items (quote_id, product_id, product_name, image_url, color, size, quantity, unit_price)
  select p_quote_id, r.product_id, r.product_name, null, r.color, r.size, r.quantity, r.unit_price
    from jsonb_to_recordset(p_rows) as r(product_id text, product_name text, color text, size text,
                                         quantity integer, unit_price numeric);
  select coalesce(sum(quantity * unit_price), 0) into v_total from b2b_quote_items where quote_id = p_quote_id;
  update b2b_quotes set total = v_total where id = p_quote_id;
  return v_total;
end $$;

-- New quote (+ items, audit, and the answered inquiry → 'angebot_gesendet').
-- p_meta: { title, valid_until (YYYY-MM-DD), note, inquiry_id, allow_zero_price }
create or replace function public.admin_create_quote(p_company_id uuid, p_items jsonb, p_meta jsonb default '{}'::jsonb)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_meta  jsonb := coalesce(p_meta, '{}'::jsonb);
  v_title text := left(nullif(btrim(coalesce(v_meta ->> 'title', '')), ''), 200);
  v_note  text := left(nullif(btrim(coalesce(v_meta ->> 'note', '')), ''), 2000);
  v_zero  boolean := coalesce(v_meta -> 'allow_zero_price' = 'true'::jsonb, false);
  v_inq   uuid;
  v_inq_company uuid;
  v_valid timestamptz;
  v_rows  jsonb;
  v_quote uuid;
  v_qnum  text;
  v_cname text;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  select name into v_cname from b2b_companies where id = p_company_id;
  if not found then
    raise exception 'Kunde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_title is null then
    raise exception 'Bitte einen Titel angeben.' using errcode = '22023';
  end if;
  v_valid := public.b2b_admin_valid_until(v_meta ->> 'valid_until');
  -- Validate everything before the quote number is drawn (no gaps on errors).
  v_rows := public.b2b_admin_items_json(p_items, v_zero);
  if coalesce(v_meta ->> 'inquiry_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id, company_id into v_inq, v_inq_company from b2b_inquiries where id = (v_meta ->> 'inquiry_id')::uuid;
    -- Never link (and close) another customer's inquiry.
    if v_inq_company is not null and v_inq_company <> p_company_id then
      raise exception 'Die Anfrage gehört zu einem anderen Kunden.' using errcode = '22023';
    end if;
  end if;

  insert into b2b_quotes (company_id, title, status, total, note, valid_until, inquiry_id)
  values (p_company_id, v_title, 'offen', 0, v_note, v_valid, v_inq)
  returning id, quote_number into v_quote, v_qnum;
  perform public.b2b_admin_set_quote_items(v_quote, v_rows);

  if v_inq is not null then
    update b2b_inquiries set status = 'angebot_gesendet'
     where id = v_inq and status in ('neu', 'in_bearbeitung');
  end if;

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (p_company_id, v_uid, 'angebot.gesendet', v_qnum, v_quote::text,
          jsonb_build_object('detail', 'Neues Angebot an ' || v_cname, 'source', 'backoffice'));
  return v_quote;
end $$;

-- Correct an open quote (title, validity, note, positions).
create or replace function public.admin_update_quote(p_quote_id uuid, p_items jsonb, p_meta jsonb default '{}'::jsonb)
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_meta  jsonb := coalesce(p_meta, '{}'::jsonb);
  v_title text := left(nullif(btrim(coalesce(v_meta ->> 'title', '')), ''), 200);
  v_note  text := left(nullif(btrim(coalesce(v_meta ->> 'note', '')), ''), 2000);
  v_zero  boolean := coalesce(v_meta -> 'allow_zero_price' = 'true'::jsonb, false);
  v_q     b2b_quotes%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  -- Same row lock as accept_quote: no edit while the customer accepts.
  select * into v_q from b2b_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Angebot nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_q.status <> 'offen' or v_q.order_id is not null then
    raise exception 'Nur offene Angebote können geändert werden (Status: %).', v_q.status using errcode = '22023';
  end if;
  if v_title is null then
    raise exception 'Bitte einen Titel angeben.' using errcode = '22023';
  end if;
  update b2b_quotes
     set title = v_title,
         note = v_note,
         valid_until = public.b2b_admin_valid_until(v_meta ->> 'valid_until')
   where id = v_q.id;
  perform public.b2b_admin_set_quote_items(v_q.id, public.b2b_admin_items_json(p_items, v_zero));
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_q.company_id, v_uid, 'angebot.geaendert', v_q.quote_number, v_q.id::text,
          jsonb_build_object('detail', 'Angebot im Backoffice korrigiert', 'source', 'backoffice'));
end $$;

-- Withdraw an open quote: the customer can no longer accept it.
create or replace function public.admin_withdraw_quote(p_quote_id uuid)
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_q   b2b_quotes%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  select * into v_q from b2b_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Angebot nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_q.status <> 'offen' then
    raise exception 'Nur offene Angebote können zurückgezogen werden (Status: %).', v_q.status using errcode = '22023';
  end if;
  update b2b_quotes
     set status = 'abgelaufen',
         withdrawn_at = now(),
         valid_until = least(coalesce(valid_until, now()), now())
   where id = v_q.id;
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_q.company_id, v_uid, 'angebot.zurueckgezogen', v_q.quote_number, v_q.id::text,
          jsonb_build_object('detail', 'Angebot vom Backoffice zurückgezogen', 'source', 'backoffice'));
end $$;

-- Reclamation status (+ optional internal note). The note goes to the
-- admin-only notes table, never into the customer-readable audit log.
create or replace function public.admin_set_reclamation_status(p_order_id uuid, p_status text, p_note text default null)
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid  uuid := auth.uid();
  v_o    b2b_orders%rowtype;
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 4000);
  v_lbl  text;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('offen', 'in_bearbeitung', 'erledigt') then
    raise exception 'Ungültiger Reklamationsstatus.' using errcode = '22023';
  end if;
  select * into v_o from b2b_orders where id = p_order_id for update;
  if not found then
    raise exception 'Bestellung nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_o.reclamation is null then
    raise exception 'Zu dieser Bestellung gibt es keine Reklamation.' using errcode = '22023';
  end if;
  v_lbl := case p_status when 'offen' then 'offen' when 'in_bearbeitung' then 'in Bearbeitung' else 'erledigt' end;

  if p_status is distinct from coalesce(v_o.reclamation_status, 'offen') then
    update b2b_orders
       set reclamation_status = p_status,
           reclamation_resolved_at = case when p_status = 'erledigt' then now() end
     where id = v_o.id;
    insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
    values (v_o.company_id, v_uid, 'bestellung.reklamation_status', '#' || v_o.order_number, v_o.id::text,
            jsonb_build_object('detail', 'Reklamation → ' || v_lbl, 'source', 'backoffice'));
  elsif v_note is null then
    return;
  end if;

  if v_note is not null then
    insert into b2b_order_notes (order_id, kind, body)
    values (v_o.id, 'reklamation', 'Reklamation ' || v_lbl || ': ' || v_note);
  end if;
end $$;

-- Execute rights: admins call these with their own JWT; helpers stay internal.
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_dashboard_stats()',
    'public.admin_create_order(uuid, jsonb, jsonb)',
    'public.admin_create_quote(uuid, jsonb, jsonb)',
    'public.admin_update_quote(uuid, jsonb, jsonb)',
    'public.admin_withdraw_quote(uuid)',
    'public.admin_set_reclamation_status(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.b2b_admin_parse_items(jsonb, boolean)',
    'public.b2b_admin_items_json(jsonb, boolean)',
    'public.b2b_admin_valid_until(text)',
    'public.b2b_admin_set_quote_items(uuid, jsonb)',
    'public.b2b_notes_stamp()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

commit;

-- ===========================================================================
-- Verify (as postgres):
--   \d public.b2b_order_notes
--   select tablename, policyname, cmd from pg_policies where tablename like 'b2b_%_notes';
--   select public.admin_dashboard_stats();   -- as an admin user (else 42501)
-- ===========================================================================
