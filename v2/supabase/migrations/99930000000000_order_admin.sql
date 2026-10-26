-- Order administration (v2-admin-orders):
--  1. Status guard: admins can only move orders forward through the
--     fulfilment workflow; 'refunded' (and cancelling paid orders) is only
--     possible through the refund-order function (service role). Amounts and
--     payment data cannot be edited by admins. 'shipped' stamps shipped_at.
--  2. Invoices: gap-free numbers (counter row updated in the same transaction
--     as the invoice), stored PDFs in a private "invoices" bucket, immutable
--     once issued (GoBD).
--  3. Refunds: full and partial refunds with their own correction invoice
--     (Rechnungskorrektur / Stornorechnung, RK-YYYY-NNNNN).
--  4. Internal admin notes, ship-mail bookkeeping, DSGVO anonymisation.
--  5. Dashboard figures computed in SQL (no 1000-row cap).
-- Idempotent.

-- 1. Order columns ------------------------------------------------------------
alter table public.orders add column if not exists internal_note      text;
alter table public.orders add column if not exists refunded_amount    numeric(10,2) not null default 0;
alter table public.orders add column if not exists ship_email_sent_at timestamptz;
alter table public.orders add column if not exists anonymized_at      timestamptz;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- 2. Status guard ---------------------------------------------------------------
-- Trusted: the service role (Edge Functions) and direct DB sessions
-- (migrations, SQL editor). Everything else — the admin via PostgREST — is
-- limited to the workflow below.
create or replace function public.guard_order_update()
  returns trigger
  language plpgsql set search_path = public as $$
declare
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_trusted boolean := v_role = 'service_role'
    or (v_role is null and current_user not in ('anon', 'authenticated'));
begin
  -- Shipping always stamps the date, also when set via the status dropdown.
  if new.status = 'shipped' and old.status is distinct from 'shipped' and new.shipped_at is null then
    new.shipped_at := now();
  end if;

  if v_trusted then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'refunded' then
      raise exception 'Erstattungen bitte über „Rückerstattung“ auslösen (Stripe-Erstattung und Bestand).'
        using errcode = 'check_violation';
    end if;
    if new.status = 'cancelled' and old.status <> 'pending' then
      raise exception 'Bezahlte Bestellungen werden über „Rückerstattung“ storniert.'
        using errcode = 'check_violation';
    end if;
    if not (
         (old.status = 'pending'       and new.status in ('paid', 'cancelled'))
      or (old.status = 'paid'          and new.status in ('in_production', 'shipped', 'completed'))
      or (old.status = 'in_production' and new.status in ('paid', 'shipped', 'completed'))
      or (old.status = 'shipped'       and new.status in ('in_production', 'completed'))
      or (old.status = 'completed'     and new.status = 'shipped')
    ) then
      raise exception 'Statuswechsel von „%“ nach „%“ ist nicht erlaubt.', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  -- What was charged and how is fixed after checkout.
  if new.total                  is distinct from old.total
  or new.discount_amount        is distinct from old.discount_amount
  or new.volume_discount_amount is distinct from old.volume_discount_amount
  or new.shipping_amount        is distinct from old.shipping_amount
  or new.coupon_code            is distinct from old.coupon_code
  or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  or new.refunded_amount        is distinct from old.refunded_amount
  or new.order_number           is distinct from old.order_number
  or new.created_at             is distinct from old.created_at
  or new.ship_email_sent_at     is distinct from old.ship_email_sent_at
  or new.anonymized_at          is distinct from old.anonymized_at then
    raise exception 'Beträge, Zahlungsdaten und Bestellnummer können nicht geändert werden.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists guard_order_update on public.orders;
create trigger guard_order_update
  before update on public.orders
  for each row execute function public.guard_order_update();

-- Paid orders are accounting records: admins may only delete unpaid ones.
create or replace function public.guard_order_delete()
  returns trigger
  language plpgsql set search_path = public as $$
declare
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  if (v_role = 'service_role' or (v_role is null and current_user not in ('anon', 'authenticated')))
     or old.status in ('pending', 'cancelled') then
    return old;
  end if;
  raise exception 'Bezahlte Bestellungen können nicht gelöscht werden (Aufbewahrungspflicht). Kundendaten können anonymisiert werden.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists guard_order_delete on public.orders;
create trigger guard_order_delete
  before delete on public.orders
  for each row execute function public.guard_order_delete();

-- 3. Gap-free document numbers ----------------------------------------------------
-- nextval() is not transactional, so a failed or rolled-back issue left holes
-- in RE-YYYY-NNNNN. A counter row updated inside the issuing transaction only
-- advances when the document row is committed.
create table if not exists public.document_counters (
  kind       text primary key,   -- 'RE' invoices, 'RK' correction invoices
  last_value integer not null default 0
);
alter table public.document_counters enable row level security;
revoke all on public.document_counters from anon, authenticated;

-- Continue after the highest number already issued (sequence era).
insert into public.document_counters (kind, last_value)
select 'RE', coalesce(max(substring(invoice_number from '(\d+)$')::integer), 0)
  from public.invoices
on conflict (kind) do update
  set last_value = greatest(public.document_counters.last_value, excluded.last_value);

create or replace function public.next_document_number(p_kind text)
  returns text
  language plpgsql security definer set search_path = public as $$
declare
  v integer;
begin
  insert into public.document_counters (kind) values (p_kind) on conflict (kind) do nothing;
  update public.document_counters set last_value = last_value + 1
   where kind = p_kind
   returning last_value into v;
  return p_kind || '-' || to_char(now() at time zone 'Europe/Berlin', 'YYYY') || '-' || lpad(v::text, 5, '0');
end $$;
revoke all on function public.next_document_number(text) from public, anon, authenticated;

-- 4. Invoices: stored PDF, frozen VAT rate, mail bookkeeping ------------------------
alter table public.invoices add column if not exists pdf_path   text;
alter table public.invoices add column if not exists vat_rate   numeric(5,4);
alter table public.invoices add column if not exists emailed_at timestamptz;

-- Same signature as before; numbers now come from the gap-free counter. The
-- order row lock makes a concurrent second call wait and return the first
-- call's invoice instead of consuming a number.
create or replace function public.issue_invoice(p_order_id uuid)
  returns public.invoices
  language plpgsql security definer set search_path = public as $$
declare
  v public.invoices;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;
  select * into v from public.invoices where order_id = p_order_id;
  if found then
    return v;
  end if;
  insert into public.invoices (order_id, invoice_number)
  values (p_order_id, public.next_document_number('RE'))
  returning * into v;
  return v;
end $$;
revoke all on function public.issue_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid) to service_role;

-- Issued documents never change (number, date, stored file, VAT rate).
create or replace function public.guard_invoice_update()
  returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.order_id       is distinct from old.order_id
  or new.invoice_number is distinct from old.invoice_number
  or new.issued_at      is distinct from old.issued_at
  or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
  or (old.vat_rate is not null and new.vat_rate is distinct from old.vat_rate) then
    raise exception 'Ausgestellte Rechnungen sind unveränderlich.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists guard_invoice_update on public.invoices;
create trigger guard_invoice_update
  before update on public.invoices
  for each row execute function public.guard_invoice_update();

-- 5. Refunds + correction invoices ----------------------------------------------------
create table if not exists public.order_refunds (
  id                    uuid primary key,   -- request id from the admin UI (Stripe idempotency)
  order_id              uuid not null references public.orders (id) on delete restrict,
  amount                numeric(10,2) not null check (amount > 0),
  full_refund           boolean not null default false,
  reason                text,
  stripe_refund_id      text,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  credit_note_number    text unique,
  credit_note_issued_at timestamptz,
  credit_note_pdf_path  text
);
create index if not exists order_refunds_order_id_idx on public.order_refunds (order_id);
create unique index if not exists order_refunds_stripe_refund_id_key on public.order_refunds (stripe_refund_id);
alter table public.order_refunds enable row level security;
drop policy if exists "admin read order_refunds" on public.order_refunds;
create policy "admin read order_refunds" on public.order_refunds
  for select to authenticated using (public.is_admin());

create or replace function public.guard_refund_update()
  returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.order_id is distinct from old.order_id
  or new.amount   is distinct from old.amount
  or new.full_refund is distinct from old.full_refund
  or (old.credit_note_number    is not null and new.credit_note_number    is distinct from old.credit_note_number)
  or (old.credit_note_issued_at is not null and new.credit_note_issued_at is distinct from old.credit_note_issued_at)
  or (old.credit_note_pdf_path  is not null and new.credit_note_pdf_path  is distinct from old.credit_note_pdf_path) then
    raise exception 'Erstattungen und Rechnungskorrekturen sind unveränderlich.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists guard_refund_update on public.order_refunds;
create trigger guard_refund_update
  before update on public.order_refunds
  for each row execute function public.guard_refund_update();

-- Records a refund that Stripe has executed — once per request id / Stripe
-- refund. A full refund also sets status=refunded and restores stock via
-- mark_order_refunded (owned by checkout).
create or replace function public.record_order_refund(
  p_refund_id uuid, p_order_id uuid, p_amount numeric, p_full boolean,
  p_reason text, p_stripe_refund_id text, p_actor uuid)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_marked boolean := false;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  select id into v_existing from public.order_refunds
   where id = p_refund_id
      or (p_stripe_refund_id is not null and stripe_refund_id = p_stripe_refund_id)
      or (p_full and order_id = p_order_id and full_refund)
   limit 1;
  if v_existing is not null then
    if p_full then
      v_marked := public.mark_order_refunded(p_order_id);
    end if;
    return jsonb_build_object('created', false, 'refund_id', v_existing, 'marked', v_marked);
  end if;

  insert into public.order_refunds (id, order_id, amount, full_refund, reason, stripe_refund_id, created_by)
  values (p_refund_id, p_order_id, round(p_amount, 2), p_full, nullif(btrim(p_reason), ''), p_stripe_refund_id, p_actor);
  update public.orders set refunded_amount = refunded_amount + round(p_amount, 2) where id = p_order_id;
  if p_full then
    v_marked := public.mark_order_refunded(p_order_id);
  end if;
  return jsonb_build_object('created', true, 'refund_id', p_refund_id, 'marked', v_marked);
end $$;
revoke all on function public.record_order_refund(uuid, uuid, numeric, boolean, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_order_refund(uuid, uuid, numeric, boolean, text, text, uuid) to service_role;

-- Returns the refund with its correction-invoice number (issued on first call).
create or replace function public.issue_credit_note(p_refund_id uuid)
  returns public.order_refunds
  language plpgsql security definer set search_path = public as $$
declare
  v public.order_refunds;
begin
  select * into v from public.order_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'refund % not found', p_refund_id;
  end if;
  if v.credit_note_number is null then
    update public.order_refunds
       set credit_note_number = public.next_document_number('RK'), credit_note_issued_at = now()
     where id = p_refund_id
     returning * into v;
  end if;
  return v;
end $$;
revoke all on function public.issue_credit_note(uuid) from public, anon, authenticated;
grant execute on function public.issue_credit_note(uuid) to service_role;

-- 6. Private bucket for issued PDFs (written only by Edge Functions) -----------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('invoices', 'invoices', false, 10485760, array['application/pdf'])
  on conflict (id) do nothing;

drop policy if exists "admin read invoice pdfs" on storage.objects;
create policy "admin read invoice pdfs" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and public.is_admin());

-- 7. DSGVO Art. 17: remove personal data, keep amounts and issued invoices ------------
-- Called by the anonymize-order function after it deleted the design files.
create or replace function public.anonymize_order(p_order_id uuid)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;
  if o.anonymized_at is not null then
    return jsonb_build_object('anonymized', false);
  end if;
  if o.status in ('paid', 'in_production') then
    raise exception 'Die Bestellung ist noch in Bearbeitung und kann nicht anonymisiert werden.'
      using errcode = 'check_violation';
  end if;

  update public.orders
     set customer_name = null, customer_email = null, customer_address = null,
         tracking_number = null, internal_note = null, anonymized_at = now()
   where id = p_order_id;
  update public.order_items set design_data = null, design_render_paths = '{}'
   where order_id = p_order_id;
  if o.stripe_payment_intent_id is not null then
    update public.checkout_carts set customer = '{}'::jsonb
     where payment_intent_id = o.stripe_payment_intent_id;
  end if;
  return jsonb_build_object('anonymized', true);
end $$;
revoke all on function public.anonymize_order(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_order(uuid) to service_role;

-- 8. Dashboard figures over all orders -------------------------------------------------
create or replace function public.admin_order_stats()
  returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  with paid as (
    select * from public.orders where status in ('paid', 'in_production', 'shipped', 'completed')
  )
  select jsonb_build_object(
    'order_count',  (select count(*) from public.orders),
    'paid_count',   (select count(*) from paid),
    'open_count',   (select count(*) from paid where status in ('paid', 'in_production')),
    'review_count', (select count(*) from public.orders
                      where review_reason is not null and status not in ('cancelled', 'refunded')),
    'revenue',      (select coalesce(sum(coalesce(total, 0) - refunded_amount), 0) from paid),
    'revenue_30d',  (select coalesce(sum(coalesce(total, 0) - refunded_amount), 0) from paid
                      where created_at > now() - interval '30 days'),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'qty', t.qty) order by t.qty desc)
        from (
          -- current product name; the checkout snapshot for deleted products
          select coalesce(p.name, oi.product_name, '—') as name, sum(oi.qty)::integer as qty
            from public.order_items oi
            join paid o on o.id = oi.order_id
            left join public.products p on p.id = oi.product_id
           group by 1
           order by 2 desc
           limit 5
        ) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_order_stats() from public, anon;
grant execute on function public.admin_order_stats() to authenticated, service_role;
