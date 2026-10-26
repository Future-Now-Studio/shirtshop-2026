-- ===========================================================================
-- Ballina B2B · 012 customer flow
-- Run after 011 (apply order: 012 → 013 → 014). Idempotent; one transaction.
--
--   1. Structured order data instead of one flattened note:
--        b2b_orders.po_number        Bestellzeichen / Kostenstelle
--        b2b_orders.delivery_address jsonb {name?, line1, zip, city, country?};
--                                    null = the company's default address
--        b2b_orders.requested_date   Wunschtermin
--      create_order() and accept_quote() take them via p_meta
--      ({note, po_number, delivery_address, requested_date}).
--   2. create_order() validates every line BEFORE inserting the order, so a
--      rejected order no longer consumes an order number. Artwork paths must
--      be one file directly in the company's own folder that exists in
--      storage ('<cid>/../<other>/…' is rejected). image_url is never taken
--      from the client: only from the company's own earlier lines, https only
--      (existing non-https item images are cleared once).
--      Admin lines share generic product ids ('manual', 'custom'); those are
--      matched by product name too, so reordering an order that came from a
--      quote no longer mixes up its lines' names and prices.
--   3. accept_quote(p_quote_id, p_meta): same meta as create_order; validity
--      is checked before the status, so an overdue quote is reported as
--      expired. The old accept_quote(uuid) is replaced.
--   4. b2b_check_artwork_path() (inquiries): same strict path rule.
--   5. "Mein Konto" self-service: update_my_profile(name, phone) and
--      update_my_delivery_address(address). Both write the audit log;
--      user_id / company_id / email stay guarded by trg_profiles_guard.
--   6. b2b_quotes.inquiry_id links a quote to the inquiry it answers
--      (customer "Meine Anfragen" → "Zum Angebot"). Set by the back office.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.b2b_orders add column if not exists po_number text;
alter table public.b2b_orders add column if not exists delivery_address jsonb;
alter table public.b2b_orders add column if not exists requested_date date;

alter table public.b2b_quotes add column if not exists inquiry_id uuid
  references public.b2b_inquiries (id) on delete set null;
create index if not exists idx_quotes_inquiry on public.b2b_quotes (inquiry_id);

-- Image URLs that an older create_order took verbatim from the client
-- (javascript:, http tracking pixels, …): the back office renders them as <img>.
update public.b2b_order_items
   set image_url = null
 where image_url is not null and image_url <> ''
   and image_url !~ '^https://[^[:space:]"''<>\\]+$';

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- A print file path is exactly '<company_id>/<file>' with a plain file name
-- (no further folders, no '.'/'..' segments) — what uploadArtwork() writes.
create or replace function public.b2b_artwork_path_ok(p_path text, p_cid uuid) returns boolean
  language sql immutable set search_path = public, pg_temp as $$
  select coalesce(
           p_cid is not null
       and length(p_path) <= 500
       and p_path ~ ('^' || p_cid::text || '/[A-Za-z0-9_.-]+$')
       and split_part(p_path, '/', 2) not in ('.', '..'),
         false)
$$;

-- Validated order meta (create_order / accept_quote). Raises on bad input.
create or replace function public.b2b_order_meta(
  p_meta jsonb,
  out po_number text,
  out delivery_address jsonb,
  out requested_date date,
  out note text)
  language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_meta  jsonb := case when jsonb_typeof(p_meta) = 'object' then p_meta else '{}'::jsonb end;
  v_addr  jsonb := v_meta -> 'delivery_address';
  v_date  text  := nullif(btrim(coalesce(v_meta ->> 'requested_date', '')), '');
  v_line1 text;
  v_zip   text;
  v_city  text;
begin
  note      := left(nullif(btrim(coalesce(v_meta ->> 'note', '')), ''), 2000);
  po_number := left(nullif(btrim(coalesce(v_meta ->> 'po_number', '')), ''), 100);

  if v_date is not null then
    if v_date !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Ungültiger Wunschtermin.' using errcode = '22023';
    end if;
    begin
      requested_date := v_date::date;
    exception when others then
      raise exception 'Ungültiger Wunschtermin.' using errcode = '22023';
    end;
    if requested_date < public.b2b_today() then
      raise exception 'Der Wunschtermin liegt in der Vergangenheit.' using errcode = '22023';
    end if;
    if requested_date > public.b2b_today() + 730 then
      raise exception 'Ungültiger Wunschtermin.' using errcode = '22023';
    end if;
  end if;

  if v_addr is null or jsonb_typeof(v_addr) = 'null' then
    delivery_address := null;  -- company default
  elsif jsonb_typeof(v_addr) <> 'object' then
    raise exception 'Ungültige Lieferadresse.' using errcode = '22023';
  else
    v_line1 := left(nullif(btrim(coalesce(v_addr ->> 'line1', '')), ''), 200);
    v_zip   := left(nullif(btrim(coalesce(v_addr ->> 'zip', '')), ''), 20);
    v_city  := left(nullif(btrim(coalesce(v_addr ->> 'city', '')), ''), 100);
    if v_line1 is null or v_zip is null or v_city is null then
      raise exception 'Lieferadresse unvollständig (Straße, PLZ und Ort).' using errcode = '22023';
    end if;
    if v_zip !~ '^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$' then
      raise exception 'Bitte eine gültige PLZ angeben.' using errcode = '22023';
    end if;
    delivery_address := jsonb_strip_nulls(jsonb_build_object(
      'name',    left(nullif(btrim(coalesce(v_addr ->> 'name', '')), ''), 200),
      'line1',   v_line1,
      'zip',     v_zip,
      'city',    v_city,
      'country', left(nullif(btrim(coalesce(v_addr ->> 'country', '')), ''), 100)));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Inquiries: strict artwork path (trigger from 009)
-- ---------------------------------------------------------------------------
create or replace function public.b2b_check_artwork_path()
  returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if new.artwork_path is not null
     and not public.b2b_artwork_path_ok(new.artwork_path, new.company_id) then
    raise exception 'artwork_path outside company folder' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists b2b_inquiries_check_artwork on public.b2b_inquiries;
create trigger b2b_inquiries_check_artwork
  before insert or update of artwork_path on public.b2b_inquiries
  for each row execute function public.b2b_check_artwork_path();

-- ---------------------------------------------------------------------------
-- 4. create_order (replaces 009). Pricing rule unchanged (see 007): the most
--    recent line for the same product in one of the company's own,
--    non-cancelled, price-confirmed orders; exact variant + quantity >= that
--    line → confirmed, otherwise provisional (price_confirmed = false).
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p_items jsonb, p_meta jsonb default '{}'::jsonb)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid       uuid := auth.uid();
  v_cid       uuid := public.current_company_id();
  v_meta      record;
  v_order     uuid;
  v_onum      text;
  v_item      jsonb;
  v_rows      jsonb := '[]'::jsonb;
  v_pid       text;
  v_color     text;
  v_size      text;
  v_qty       integer;
  v_cname     text;
  v_name      text;
  v_img       text;
  v_art       text;
  v_art_ok    boolean;
  v_generic   boolean;
  v_price     numeric(10,2);
  v_exact     boolean;
  v_src       record;
  v_confirmed boolean := true;
  v_total     numeric(12,2) := 0;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'Ungültige Positionen (1–200 erwartet).' using errcode = '22023';
  end if;
  select * into v_meta from public.b2b_order_meta(p_meta);

  -- Pass 1: validate and price every line. Nothing is written yet, so a
  -- rejected order does not draw a number from b2b_order_seq.
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Ungültige Position.' using errcode = '22023';
    end if;
    v_pid   := left(nullif(btrim(coalesce(v_item ->> 'product_id', '')), ''), 100);
    -- Colour/size may be empty: back-office lines (quotes, manual orders) do
    -- not require them (b2b_admin_parse_items stores ''), and those orders
    -- must stay reorderable.
    v_color := left(btrim(coalesce(v_item ->> 'color', '')), 100);
    v_size  := left(btrim(coalesce(v_item ->> 'size', '')), 50);
    v_cname := left(nullif(btrim(coalesce(v_item ->> 'product_name', '')), ''), 200);
    if v_pid is null then
      raise exception 'Position unvollständig (Produkt fehlt).' using errcode = '22023';
    end if;
    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,6}$' then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 100000 then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;
    -- Admin-entered lines all carry the same generic id → match by name too.
    v_generic := v_pid in ('manual', 'custom');

    select oi.unit_price, oi.quantity, oi.product_name, oi.image_url,
           (oi.color = v_color and oi.size = v_size) as exact
      into v_src
      from b2b_order_items oi
      join b2b_orders o on o.id = oi.order_id
     where o.company_id = v_cid
       and o.status <> 'storniert'
       and o.price_confirmed
       and oi.product_id = v_pid
       and (not v_generic or oi.product_name = v_cname)
     order by (oi.color = v_color and oi.size = v_size) desc, o.created_at desc
     limit 1;

    if found then
      v_price := v_src.unit_price;
      v_name  := v_src.product_name;
      v_img   := v_src.image_url;
      -- A 0 € source line (free sample/setup) never confirms a reorder price.
      v_exact := v_src.exact and v_qty >= v_src.quantity and v_src.unit_price > 0;
    else
      v_price := 0;
      v_name  := v_cname;
      v_img   := null;
      v_exact := false;
    end if;
    if v_name is null then v_name := 'Artikel ' || v_pid; end if;
    if not v_exact then v_confirmed := false; end if;

    -- Product image: only from the company's own earlier order/quote lines
    -- (written by the back office or by this function), never from the client.
    if nullif(v_img, '') is null then
      select x.image_url into v_img
        from (
          select oi.image_url, o.created_at
            from b2b_order_items oi join b2b_orders o on o.id = oi.order_id
           where o.company_id = v_cid and oi.product_id = v_pid
             and (not v_generic or oi.product_name = v_name)
             and nullif(oi.image_url, '') is not null
          union all
          select qi.image_url, q.created_at
            from b2b_quote_items qi join b2b_quotes q on q.id = qi.quote_id
           where q.company_id = v_cid and qi.product_id = v_pid
             and (not v_generic or qi.product_name = v_name)
             and nullif(qi.image_url, '') is not null
        ) x
       order by x.created_at desc
       limit 1;
    end if;
    if v_img !~ '^https://[^[:space:]"''<>\\]+$' or length(v_img) > 1000 then
      v_img := null;
    end if;

    -- Print file: one file in this company's own folder that really exists.
    v_art := nullif(btrim(coalesce(v_item ->> 'artwork_path', '')), '');
    if v_art is not null and not public.b2b_artwork_path_ok(v_art, v_cid) then
      v_art := null;
    end if;
    if v_art is not null and to_regclass('storage.objects') is not null then
      execute 'select exists (select 1 from storage.objects where bucket_id = $1 and name = $2)'
        into v_art_ok using 'artwork', v_art;
      if not v_art_ok then v_art := null; end if;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'product_id',     v_pid,
      'product_name',   v_name,
      'image_url',      v_img,
      'color',          v_color,
      'size',           v_size,
      'quantity',       v_qty,
      'unit_price',     v_price,
      'print_position', left(nullif(btrim(coalesce(v_item ->> 'print_position', '')), ''), 200),
      'artwork_name',   left(nullif(btrim(coalesce(v_item ->> 'artwork_name', '')), ''), 200),
      'artwork_path',   v_art));
    v_total := v_total + v_qty * v_price;
  end loop;

  -- Pass 2: everything is valid → create the order (draws the order number;
  -- the shipping trigger from 008 prices shipping off the total).
  insert into b2b_orders (company_id, created_by, status, total, note, price_confirmed,
                          po_number, delivery_address, requested_date)
  values (v_cid, v_uid, 'offen', v_total, v_meta.note, v_confirmed,
          v_meta.po_number, v_meta.delivery_address, v_meta.requested_date)
  returning id, order_number into v_order, v_onum;

  insert into b2b_order_items (order_id, product_id, product_name, image_url, color, size,
                               quantity, unit_price, print_position, artwork_name, artwork_path)
  select v_order, r.product_id, r.product_name, r.image_url, r.color, r.size,
         r.quantity, r.unit_price, r.print_position, r.artwork_name, r.artwork_path
    from jsonb_to_recordset(v_rows) as r(product_id text, product_name text, image_url text,
                                         color text, size text, quantity integer,
                                         unit_price numeric(10,2), print_position text,
                                         artwork_name text, artwork_path text);

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'bestellung.angelegt', '#' || v_onum, v_order::text,
          jsonb_build_object('detail',
            case when v_confirmed then 'Bestellung über das Portal'
                 else 'Bestellung über das Portal – Preise zu bestätigen' end
            || coalesce(' · Zeichen ' || v_meta.po_number, ''),
            'source', 'kunde'));
  return v_order;
end $$;

-- ---------------------------------------------------------------------------
-- 5. accept_quote(p_quote_id, p_meta) (replaces accept_quote(uuid) from 007)
-- ---------------------------------------------------------------------------
drop function if exists public.accept_quote(uuid);

create or replace function public.accept_quote(p_quote_id uuid, p_meta jsonb default '{}'::jsonb)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_cid   uuid := public.current_company_id();
  v_meta  record;
  v_q     b2b_quotes%rowtype;
  v_order uuid;
  v_onum  text;
  v_total numeric(12,2);
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  select * into v_meta from public.b2b_order_meta(p_meta);

  -- Row lock: a concurrent second accept waits here and then sees the new status.
  select * into v_q from b2b_quotes
   where id = p_quote_id and company_id = v_cid
   for update;
  if not found then
    raise exception 'Angebot nicht gefunden.' using errcode = 'P0002';
  end if;
  -- Validity before status: an overdue quote may still be 'offen' in the table
  -- until expire_quotes() runs (quote list / daily cron) — report it as expired.
  if v_q.status in ('offen', 'abgelaufen') and not public.b2b_quote_valid(v_q.valid_until) then
    raise exception 'Das Angebot ist am % abgelaufen und kann nicht mehr angenommen werden.',
      to_char(v_q.valid_until at time zone 'Europe/Berlin', 'DD.MM.YYYY')
      using errcode = '22023';
  end if;
  if v_q.status <> 'offen' then
    -- withdrawn_at is added by 013 (back office); read it via jsonb so this
    -- function also works before 013 is applied.
    raise exception '%', case
        when v_q.status = 'angenommen' then 'Dieses Angebot wurde bereits angenommen.'
        when v_q.status = 'abgelehnt'  then 'Dieses Angebot wurde abgelehnt und kann nicht mehr angenommen werden.'
        when to_jsonb(v_q) ->> 'withdrawn_at' is not null
          then 'Dieses Angebot wurde zurückgezogen und kann nicht mehr angenommen werden.'
        else 'Dieses Angebot kann nicht mehr angenommen werden.'
      end
      using errcode = '22023';
  end if;
  if not exists (select 1 from b2b_quote_items where quote_id = v_q.id) then
    raise exception 'Angebot enthält keine Positionen.' using errcode = '22023';
  end if;

  select coalesce(sum(quantity * unit_price), 0) into v_total
    from b2b_quote_items where quote_id = v_q.id;

  -- Shipping follows the same rule as every order (trigger from 008); the
  -- quote list, the quote PDF and the accept dialog show it before accepting.
  insert into b2b_orders (company_id, created_by, status, total, note, price_confirmed,
                          po_number, delivery_address, requested_date)
  values (v_cid, v_uid, 'offen', v_total,
          left('Aus Angebot ' || v_q.quote_number || ' – ' || v_q.title
               || coalesce(E'\n' || v_meta.note, ''), 2000),
          true, v_meta.po_number, v_meta.delivery_address, v_meta.requested_date)
  returning id, order_number into v_order, v_onum;

  insert into b2b_order_items (order_id, product_id, product_name, image_url, color, size, quantity, unit_price)
  select v_order, qi.product_id, qi.product_name, qi.image_url, qi.color, qi.size, qi.quantity, qi.unit_price
    from b2b_quote_items qi
   where qi.quote_id = v_q.id;

  update b2b_quotes set status = 'angenommen', order_id = v_order where id = v_q.id;

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'angebot.angenommen', v_q.quote_number, v_q.id::text,
          jsonb_build_object('detail', 'Angebot angenommen → #' || v_onum
                                       || coalesce(' · Zeichen ' || v_meta.po_number, ''),
                             'source', 'kunde', 'order_id', v_order));
  return v_order;
end $$;

-- ---------------------------------------------------------------------------
-- 6. "Mein Konto" self-service
-- ---------------------------------------------------------------------------
create or replace function public.update_my_profile(p_name text, p_phone text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_cid   uuid := public.current_company_id();
  v_name  text := left(nullif(btrim(coalesce(p_name, '')), ''), 200);
  v_phone text := left(nullif(btrim(coalesce(p_phone, '')), ''), 50);
  v_email text;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Bitte einen Namen angeben.' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()/.-]{5,40}$' then
    raise exception 'Bitte eine gültige Telefonnummer angeben.' using errcode = '22023';
  end if;
  update b2b_profiles set name = v_name, phone = v_phone
   where user_id = v_uid
  returning email into v_email;
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'kunde.profil', v_email, v_uid::text,
          jsonb_build_object('detail', 'Ansprechpartner/Telefon im Portal geändert', 'source', 'kunde'));
end $$;

-- null / {} resets the default delivery address (→ billing address is used).
create or replace function public.update_my_delivery_address(p_address jsonb) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid  uuid := auth.uid();
  v_cid  uuid := public.current_company_id();
  v_addr jsonb;
  v_name text;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  if p_address is not null and jsonb_typeof(p_address) = 'object' and p_address <> '{}'::jsonb then
    select delivery_address into v_addr
      from public.b2b_order_meta(jsonb_build_object('delivery_address', p_address));
  end if;
  update b2b_companies
     set delivery_line1   = case when v_addr is null then null
                                 else concat_ws(', ', v_addr ->> 'name', v_addr ->> 'line1') end,
         delivery_zip     = v_addr ->> 'zip',
         delivery_city    = v_addr ->> 'city',
         delivery_country = v_addr ->> 'country'
   where id = v_cid
  returning name into v_name;
  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'kunde.lieferadresse', v_name, v_cid::text,
          jsonb_build_object('detail',
            case when v_addr is null then 'Standard-Lieferadresse entfernt (Rechnungsadresse)'
                 else 'Standard-Lieferadresse: ' || concat_ws(', ', v_addr ->> 'name', v_addr ->> 'line1',
                                                             (v_addr ->> 'zip') || ' ' || (v_addr ->> 'city')) end,
            'source', 'kunde'));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Execute rights: never anon/public. The two helpers are side-effect free;
--    b2b_artwork_path_ok() also runs inside the (invoker) inquiry trigger.
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_order(jsonb, jsonb)',
    'public.accept_quote(uuid, jsonb)',
    'public.update_my_profile(text, text)',
    'public.update_my_delivery_address(jsonb)',
    'public.b2b_order_meta(jsonb)',
    'public.b2b_artwork_path_ok(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

commit;

-- ===========================================================================
-- Verify (as postgres):
--   select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'accept_quote';
--     → p_quote_id uuid, p_meta jsonb   (exactly one row)
--   select column_name from information_schema.columns
--    where table_name = 'b2b_orders' and column_name in ('po_number','delivery_address','requested_date');
-- ===========================================================================
