-- ===========================================================================
-- Ballina B2B · 014 hardening
-- Run AFTER 013_backoffice.sql (apply order 012 → 013 → 014, always via
-- ./supabase/apply.sh). Idempotent; safe to re-run. Runs in one transaction.
--
--   1. Audit log + order timeline are append-only: no UPDATE/DELETE for API
--      users (admins included). Direct back-office inserts into the audit log
--      get actor / time stamped by the database. Order events are written only
--      by the trg_order_status trigger.
--   2. Server-side audit entries for actions the browser never logged:
--      inquiry received, inquiry status changes, tracking (Sendungsdaten) edits.
--      Inquiry created_at is set by the database.
--   3. log_order_status(): orders created by the back office in a later status
--      ('versendet', …) no longer get the timeline note "Bestellung eingegangen.".
--   4. admin_confirm_order_prices(): cancelled / completed orders can no longer
--      be re-priced.
--   5. Companies with orders or quotes cannot be deleted (FK RESTRICT instead
--      of CASCADE + a readable error). Retention duties (GoBD) apply.
--   6. One login per company (unique b2b_profiles.company_id) — skipped with a
--      NOTICE if the data already has several logins for one company.
--   7. Mail log for the Netlify mail functions: every portal mail event is sent
--      at most once per order / quote / inquiry (b2b_mail_log, claim/done RPCs,
--      service_role only). Events before this migration are marked 'historic'.
--   8. b2b_auth_user_lookup(email) for admin-create-user (service_role only).
--   9. Admin management from the SQL editor: b2b_grant_admin(email),
--      b2b_revoke_admin(email).
--  10. Storage: MIME whitelist for `artwork`, PDF-only + 10 MB for `invoices`.
--  11. Re-asserts the hardened customer inquiry policy (status 'neu' only) in
--      case 005 was re-run by hand, and removes updated_at triggers left over
--      from the superseded 001/002 (they break inquiry status changes).
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Append-only audit log + order timeline
-- ---------------------------------------------------------------------------
-- 005 gave admins FOR ALL on both tables (edit/delete history). Replace with
-- read (+ insert for the audit log, used by the back-office client).
drop policy if exists b2b_audit_log_admin_all on public.b2b_audit_log;
drop policy if exists b2b_order_events_admin_all on public.b2b_order_events;

drop policy if exists audit_admin_read on public.b2b_audit_log;
create policy audit_admin_read on public.b2b_audit_log for select to authenticated
  using (public.is_admin());
drop policy if exists audit_admin_insert on public.b2b_audit_log;
create policy audit_admin_insert on public.b2b_audit_log for insert to authenticated
  with check (public.is_admin());
drop policy if exists events_admin_read on public.b2b_order_events;
create policy events_admin_read on public.b2b_order_events for select to authenticated
  using (public.is_admin());

-- Privileges are the hard stop (they also hold if 005 is ever re-run).
revoke all on table public.b2b_audit_log, public.b2b_order_events from anon;
revoke update, delete, truncate, references, trigger
  on table public.b2b_audit_log, public.b2b_order_events from authenticated;
revoke insert on table public.b2b_order_events from authenticated;
grant select, insert on table public.b2b_audit_log to authenticated;
grant select on table public.b2b_order_events to authenticated;

-- Belt and braces: API roles can never change or remove history rows, even if
-- a grant comes back. FK cascades (run as the table owner) and maintenance by
-- postgres stay possible.
create or replace function public.b2b_append_only() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Einträge in % können nicht geändert oder gelöscht werden.', tg_table_name
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists b2b_audit_log_append_only on public.b2b_audit_log;
create trigger b2b_audit_log_append_only before update or delete on public.b2b_audit_log
  for each row execute function public.b2b_append_only();
drop trigger if exists b2b_order_events_append_only on public.b2b_order_events;
create trigger b2b_order_events_append_only before update or delete on public.b2b_order_events
  for each row execute function public.b2b_append_only();

-- Direct API inserts (back-office client, logAuditReal): the database decides
-- who and when. Rows written inside SECURITY DEFINER RPCs/triggers run as the
-- function owner and keep their values (they already use auth.uid()).
create or replace function public.b2b_audit_log_stamp() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.actor := auth.uid();
    new.at    := now();
    new.meta  := case when jsonb_typeof(new.meta) = 'object' then new.meta else '{}'::jsonb end
                 || jsonb_build_object('source', 'backoffice');
  end if;
  return new;
end $$;

drop trigger if exists b2b_audit_log_stamp on public.b2b_audit_log;
create trigger b2b_audit_log_stamp before insert on public.b2b_audit_log
  for each row execute function public.b2b_audit_log_stamp();

-- ---------------------------------------------------------------------------
-- 2. Server-side audit entries
-- ---------------------------------------------------------------------------
create or replace function public.b2b_audit_source() returns text
  language sql stable security definer set search_path = public, pg_temp as $$
  select case when auth.uid() is null then 'system'
              when public.is_admin() then 'backoffice'
              else 'kunde' end
$$;

-- Inquiries: received (customer insert) and every status change (back-office
-- list, admin_create_quote → 'angebot_gesendet').
create or replace function public.b2b_inquiries_audit() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lbl  jsonb := '{"neu":"Neu","in_bearbeitung":"In Bearbeitung","angebot_gesendet":"Angebot gesendet","abgeschlossen":"Abgeschlossen"}';
  v_what text  := 'Anfrage ' || left(coalesce(nullif(btrim(new.product_type), ''), '–'), 60);
begin
  if tg_op = 'INSERT' then
    insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
    values (new.company_id, auth.uid(), 'anfrage.eingegangen', v_what, new.id::text,
            jsonb_build_object(
              'detail', 'Großanfrage' || coalesce(' über ' || new.quantity || ' Stück', '')
                        || coalesce(', Wunschtermin ' || to_char(new.deadline, 'DD.MM.YYYY'), ''),
              'source', public.b2b_audit_source()));
  elsif new.status is distinct from old.status then
    insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
    values (new.company_id, auth.uid(), 'anfrage.status', v_what, new.id::text,
            jsonb_build_object(
              'detail', 'Status ' || coalesce(v_lbl ->> old.status, old.status)
                        || ' → ' || coalesce(v_lbl ->> new.status, new.status),
              'source', public.b2b_audit_source()));
  end if;
  return null;
end $$;

drop trigger if exists b2b_inquiries_audit on public.b2b_inquiries;
create trigger b2b_inquiries_audit after insert or update of status on public.b2b_inquiries
  for each row execute function public.b2b_inquiries_audit();

-- Customers insert inquiries directly: the time comes from the database (the
-- inquiry mail is only sent for fresh inquiries, see send-order-email).
create or replace function public.b2b_inquiries_stamp() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists b2b_inquiries_stamp on public.b2b_inquiries;
create trigger b2b_inquiries_stamp before insert on public.b2b_inquiries
  for each row execute function public.b2b_inquiries_stamp();

-- Tracking edits (carrier / number / link) were not logged at all.
create or replace function public.b2b_orders_tracking_audit() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_detail text;
begin
  if (new.tracking_carrier, new.tracking_number, new.tracking_url)
     is distinct from (old.tracking_carrier, old.tracking_number, old.tracking_url) then
    v_detail := case
      when coalesce(new.tracking_carrier, new.tracking_number, new.tracking_url) is null
        then 'Sendungsdaten entfernt'
      else 'Sendungsdaten: '
           || coalesce(nullif(concat_ws(' ', new.tracking_carrier, new.tracking_number), ''), '–')
           || case when new.tracking_url is not null then ' (mit Tracking-Link)' else '' end
    end;
    insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
    values (new.company_id, auth.uid(), 'bestellung.sendung', '#' || new.order_number, new.id::text,
            jsonb_build_object('detail', left(v_detail, 300), 'source', public.b2b_audit_source()));
  end if;
  return null;
end $$;

drop trigger if exists b2b_orders_tracking_audit on public.b2b_orders;
create trigger b2b_orders_tracking_audit
  after update of tracking_carrier, tracking_number, tracking_url on public.b2b_orders
  for each row execute function public.b2b_orders_tracking_audit();

-- ---------------------------------------------------------------------------
-- 3. Order timeline: neutral first note for back-office orders
-- ---------------------------------------------------------------------------
create or replace function public.log_order_status() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into b2b_order_events(order_id, status, note, actor)
      values (new.id, new.status,
              case when new.status = 'offen' then 'Bestellung eingegangen.'
                   else 'Bestellung im Backoffice erfasst.' end,
              new.created_by);
  elsif new.status is distinct from old.status then
    insert into b2b_order_events(order_id, status, actor)
      values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4. admin_confirm_order_prices: status guard (same signature as 007)
-- ---------------------------------------------------------------------------
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
  -- The customer already saw these totals; budget/revenue stats use them.
  if v_o.status in ('storniert', 'abgeschlossen') then
    raise exception 'Die Preise einer % Bestellung können nicht mehr geändert werden.',
      case v_o.status when 'storniert' then 'stornierten' else 'abgeschlossenen' end
      using errcode = '22023';
  end if;
  if p_prices is not null and jsonb_typeof(p_prices) = 'object' then
    for v_key, v_val in select key, value from jsonb_each(p_prices) loop
      if v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Ungültige Position.' using errcode = '22023';
      end if;
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
          jsonb_build_object('detail', 'Preise bestätigt, Summe ' || v_total::text, 'source', 'backoffice'));
end $$;

revoke all on function public.admin_confirm_order_prices(uuid, jsonb) from public, anon;
grant execute on function public.admin_confirm_order_prices(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Companies with orders/quotes cannot be deleted
-- ---------------------------------------------------------------------------
-- 003 created b2b_orders/b2b_quotes.company_id ON DELETE CASCADE: deleting a
-- company (e.g. via REST) silently wiped its whole order history.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'public.b2b_companies'::regclass
       and c.conrelid in ('public.b2b_orders'::regclass, 'public.b2b_quotes'::regclass)
       and c.confdeltype <> 'r'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (company_id) '
                   'references public.b2b_companies(id) on delete restrict', r.tbl, r.conname);
    raise notice '% → ON DELETE RESTRICT', r.conname;
  end loop;
end $$;

-- Readable error instead of a raw FK violation.
create or replace function public.b2b_companies_delete_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from b2b_orders where company_id = old.id)
     or exists (select 1 from b2b_quotes where company_id = old.id) then
    raise exception 'Der Kunde „%“ hat Bestellungen oder Angebote und kann nicht gelöscht werden (Aufbewahrungspflicht).', old.name
      using errcode = '23503';
  end if;
  return old;
end $$;

drop trigger if exists b2b_companies_delete_guard on public.b2b_companies;
create trigger b2b_companies_delete_guard before delete on public.b2b_companies
  for each row execute function public.b2b_companies_delete_guard();

-- ---------------------------------------------------------------------------
-- 6. One login per company (model: one customer = one account)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.b2b_profiles_company_id_key') is null then
    if exists (select 1 from b2b_profiles group by company_id having count(*) > 1) then
      raise notice 'Several logins for one company exist — unique index b2b_profiles_company_id_key skipped. '
                   'Check: select company_id, count(*) from b2b_profiles group by 1 having count(*) > 1;';
    else
      create unique index b2b_profiles_company_id_key on public.b2b_profiles (company_id);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Mail log (send-order-email / quote-reminders)
-- ---------------------------------------------------------------------------
do $$
declare v_new boolean := to_regclass('public.b2b_mail_log') is null;
begin
  create table if not exists public.b2b_mail_log (
    id         bigint generated always as identity primary key,
    event      text not null check (event ~ '^[a-z_]{3,40}$'),
    ref_id     uuid not null,
    status     text not null default 'sending'
               check (status in ('sending', 'sent', 'failed', 'historic')),
    actor      uuid,
    attempts   integer not null default 1,
    claimed_at timestamptz not null default now(),
    sent_at    timestamptz,
    constraint b2b_mail_log_event_ref_key unique (event, ref_id)
  );
  if v_new then
    -- Everything that happened before the mail log existed counts as notified,
    -- so nobody can trigger mails for historic orders/quotes/inquiries.
    insert into public.b2b_mail_log (event, ref_id, status)
    select 'created', id, 'historic' from b2b_orders
    union all select 'shipped', id, 'historic' from b2b_orders where status in ('versendet', 'abgeschlossen')
    union all select 'cancelled', id, 'historic' from b2b_orders where status = 'storniert'
    union all select 'reclaimed', id, 'historic' from b2b_orders where reclamation is not null
    union all select 'prices_confirmed', id, 'historic' from b2b_orders where price_confirmed
    union all select 'quote_created', id, 'historic' from b2b_quotes
    union all select 'inquiry_created', id, 'historic' from b2b_inquiries
    on conflict (event, ref_id) do nothing;
  end if;
end $$;

alter table public.b2b_mail_log enable row level security;
-- No policies: only the service role (Netlify functions) and postgres.
revoke all on table public.b2b_mail_log from public, anon, authenticated;
grant all on table public.b2b_mail_log to service_role;

-- Claim an event before sending. true = this caller sends it; false = it was
-- already sent (or is being sent right now). A failed send, or a claim stuck
-- for 10 minutes, can be claimed again.
create or replace function public.b2b_mail_claim(p_event text, p_ref uuid, p_actor uuid default null)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  insert into b2b_mail_log as m (event, ref_id, actor)
  values (p_event, p_ref, p_actor)
  on conflict (event, ref_id) do update
     set status = 'sending', claimed_at = now(), sent_at = null,
         actor = excluded.actor, attempts = m.attempts + 1
   where m.status = 'failed'
      or (m.status = 'sending' and m.claimed_at < now() - interval '10 minutes')
  returning id into v_id;
  return v_id is not null;
end $$;

create or replace function public.b2b_mail_done(p_event text, p_ref uuid, p_ok boolean)
  returns void
  language sql security definer set search_path = public, pg_temp as $$
  update b2b_mail_log
     set status  = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() end
   where event = p_event and ref_id = p_ref and status = 'sending'
$$;

-- ---------------------------------------------------------------------------
-- 8. Lookup for admin-create-user (existing login for an e-mail?)
-- ---------------------------------------------------------------------------
create or replace function public.b2b_auth_user_lookup(p_email text)
  returns table (user_id uuid, confirmed boolean, is_admin boolean, company_id uuid, company_name text)
  language sql stable security definer set search_path = public, pg_temp as $$
  select u.id,
         u.email_confirmed_at is not null,
         exists (select 1 from b2b_admins a where a.user_id = u.id),
         p.company_id,
         c.name
    from auth.users u
    left join b2b_profiles p  on p.user_id = u.id
    left join b2b_companies c on c.id = p.company_id
   where lower(u.email) = lower(btrim(p_email))
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- 9. Back-office admins (run in the SQL editor as postgres)
-- ---------------------------------------------------------------------------
--   select public.b2b_grant_admin('name@firma.de');   -- user must be invited first
--   select public.b2b_revoke_admin('name@firma.de');
create or replace function public.b2b_grant_admin(p_email text) returns text
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid;
  v_email text;
begin
  select id, email into v_uid, v_email from auth.users where lower(email) = lower(btrim(p_email));
  if v_uid is null then
    raise exception 'Kein Benutzer mit der E-Mail %. Erst unter Authentication → Users → „Invite user“ einladen.', p_email;
  end if;
  if exists (select 1 from b2b_profiles where user_id = v_uid) then
    raise exception '% ist ein Kundenzugang und kann nicht zusätzlich Admin werden.', v_email;
  end if;
  insert into b2b_admins (user_id, email) values (v_uid, v_email)
  on conflict (user_id) do update set email = excluded.email;
  insert into b2b_audit_log (actor, action, entity, entity_id, meta)
  values (null, 'admin.ernannt', v_email, v_uid::text,
          jsonb_build_object('detail', 'Backoffice-Zugang erteilt', 'source', 'system'));
  return v_email || ' ist jetzt Backoffice-Admin.';
end $$;

create or replace function public.b2b_revoke_admin(p_email text) returns text
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid;
  v_email text;
begin
  select a.user_id, a.email into v_uid, v_email
    from b2b_admins a join auth.users u on u.id = a.user_id
   where lower(u.email) = lower(btrim(p_email));
  if v_uid is null then
    raise exception '% ist kein Backoffice-Admin.', p_email;
  end if;
  if (select count(*) from b2b_admins) <= 1 then
    raise exception 'Der letzte Admin kann nicht entfernt werden.';
  end if;
  delete from b2b_admins where user_id = v_uid;
  insert into b2b_audit_log (actor, action, entity, entity_id, meta)
  values (null, 'admin.entfernt', v_email, v_uid::text,
          jsonb_build_object('detail', 'Backoffice-Zugang entzogen', 'source', 'system'));
  return v_email || ' ist kein Admin mehr.';
end $$;

-- ---------------------------------------------------------------------------
-- 10. Storage limits (server-side; the browser checks are only advisory)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'storage' and table_name = 'buckets'
                       and column_name = 'allowed_mime_types') then
    raise notice 'storage.buckets without allowed_mime_types — storage limits skipped';
    return;
  end if;
  -- Print files: PDF, AI, EPS, SVG, PNG, JPG, TIF (src/lib/artwork.ts). Browsers
  -- send .ai/.eps under several names, or none (→ application/octet-stream).
  update storage.buckets
     set file_size_limit = 26214400, -- 25 MB
         allowed_mime_types = array[
           'application/pdf', 'application/postscript', 'application/illustrator',
           'application/eps', 'application/x-eps', 'image/eps', 'image/x-eps',
           'image/svg+xml', 'image/png', 'image/jpeg', 'image/pjpeg', 'image/tiff',
           'application/octet-stream']
   where id = 'artwork';
  -- Invoices: PDF only (src/lib/invoices.ts uploads as application/pdf).
  update storage.buckets
     set file_size_limit = 10485760, -- 10 MB
         allowed_mime_types = array['application/pdf']
   where id = 'invoices';
end $$;

-- ---------------------------------------------------------------------------
-- 11. Repairs for out-of-order runs
-- ---------------------------------------------------------------------------
-- Re-running 005 by hand re-created inq_own_insert without the status check.
drop policy if exists inq_own_insert on public.b2b_inquiries;
create policy inq_own_insert on public.b2b_inquiries for insert
  with check (company_id = public.current_company_id() and status = 'neu');

-- 001 (superseded, see supabase/_superseded/) created updated_at triggers;
-- b2b_inquiries has no updated_at column, so every status change failed.
drop trigger if exists update_b2b_profiles_updated_at  on public.b2b_profiles;
drop trigger if exists update_b2b_orders_updated_at    on public.b2b_orders;
drop trigger if exists update_b2b_inquiries_updated_at on public.b2b_inquiries;

-- ---------------------------------------------------------------------------
-- Execute rights
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  -- Netlify functions only (service_role).
  foreach f in array array[
    'public.b2b_mail_claim(text, uuid, uuid)',
    'public.b2b_mail_done(text, uuid, boolean)',
    'public.b2b_auth_user_lookup(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- SQL editor (postgres) only.
  foreach f in array array[
    'public.b2b_grant_admin(text)',
    'public.b2b_revoke_admin(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  -- Internal (trigger / helper) functions.
  foreach f in array array[
    'public.b2b_append_only()',
    'public.b2b_audit_log_stamp()',
    'public.b2b_audit_source()',
    'public.b2b_inquiries_audit()',
    'public.b2b_inquiries_stamp()',
    'public.b2b_orders_tracking_audit()',
    'public.b2b_companies_delete_guard()',
    'public.log_order_status()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

commit;

-- ===========================================================================
-- Verify (as postgres):
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('b2b_audit_log','b2b_order_events') order by 1, 2;   -- no ALL
--   select privilege_type from information_schema.role_table_grants
--    where table_name = 'b2b_audit_log' and grantee = 'authenticated';        -- INSERT, SELECT
--   select event, status, count(*) from b2b_mail_log group by 1, 2;
--   select id, file_size_limit, allowed_mime_types from storage.buckets;
-- ===========================================================================
