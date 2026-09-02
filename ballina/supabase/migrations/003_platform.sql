-- ===========================================================================
-- Ballina B2B Portal · schema + security (simplified model)
-- Self-contained & idempotent. On a FRESH Supabase project run ONLY this file
-- (it supersedes 001/002). Safe to re-run.
--
-- Model: ONE customer = ONE account. Each auth user maps to exactly one company.
-- No roles, no team, no approval workflow. Row Level Security isolates every
-- company's data; all back-office mutations are logged.
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- Companies (the customer account) --------------------------------------
create table if not exists b2b_companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  customer_number  text unique,
  vat_id           text,
  payment_terms    text,
  billing_line1    text,
  billing_zip      text,
  billing_city     text,
  billing_country  text,
  delivery_line1   text,
  delivery_zip     text,
  delivery_city    text,
  delivery_country text,
  discount_percent numeric(5,2) not null default 0,
  annual_budget    numeric(12,2),
  created_at       timestamptz not null default now()
);

-- --- Profiles: exactly one login account per company -----------------------
create table if not exists b2b_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  company_id   uuid not null references b2b_companies(id) on delete cascade,
  name         text,
  email        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --- Orders + items + status history ---------------------------------------
create sequence if not exists b2b_order_seq start 500;

create table if not exists b2b_orders (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references b2b_companies(id) on delete cascade,
  created_by    uuid references auth.users(id),
  order_number  text not null default ('2026-' || lpad(nextval('b2b_order_seq')::text, 4, '0')),
  status        text not null default 'offen'
                check (status in ('offen','in_bearbeitung','versendet','abgeschlossen','storniert')),
  total         numeric(10,2) not null default 0,
  note          text,
  tracking_carrier text,
  tracking_number  text,
  tracking_url     text,
  reclamation      text,
  invoice_name     text,            -- attached invoice PDF (admin upload)
  invoice_url      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists b2b_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references b2b_orders(id) on delete cascade,
  product_id   text not null,
  product_name text not null,
  image_url    text,
  color        text not null,
  size         text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(10,2) not null default 0,
  print_position text,
  artwork_name   text
);

create table if not exists b2b_order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references b2b_orders(id) on delete cascade,
  status     text not null,
  note       text,
  actor      uuid references auth.users(id),
  at         timestamptz not null default now()
);

-- --- Quotes (Angebote) → accept becomes an order ---------------------------
create table if not exists b2b_quotes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references b2b_companies(id) on delete cascade,
  quote_number text not null,
  title        text not null,
  status       text not null default 'offen'
               check (status in ('offen','angenommen','abgelehnt','abgelaufen')),
  total        numeric(10,2) not null default 0,
  note         text,
  valid_until  timestamptz,
  order_id     uuid references b2b_orders(id),
  created_at   timestamptz not null default now()
);

create table if not exists b2b_quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references b2b_quotes(id) on delete cascade,
  product_id   text not null,
  product_name text not null,
  image_url    text,
  color        text not null,
  size         text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(10,2) not null default 0
);

-- --- Audit log -------------------------------------------------------------
create table if not exists b2b_audit_log (
  id          bigint generated always as identity primary key,
  company_id  uuid,
  actor       uuid,
  action      text not null,
  entity      text,
  entity_id   text,
  meta        jsonb,
  at          timestamptz not null default now()
);

create index if not exists idx_profiles_user      on b2b_profiles(user_id);
create index if not exists idx_profiles_company    on b2b_profiles(company_id);
create index if not exists idx_orders_company      on b2b_orders(company_id);
create index if not exists idx_order_items_order   on b2b_order_items(order_id);
create index if not exists idx_order_events_order  on b2b_order_events(order_id);
create index if not exists idx_quotes_company      on b2b_quotes(company_id);
create index if not exists idx_audit_company       on b2b_audit_log(company_id);

-- --- Security helper (SECURITY DEFINER → no RLS recursion) ------------------
create or replace function current_company_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select company_id from b2b_profiles where user_id = auth.uid() limit 1
$$;

-- --- Row Level Security -----------------------------------------------------
alter table b2b_companies    enable row level security;
alter table b2b_profiles     enable row level security;
alter table b2b_orders       enable row level security;
alter table b2b_order_items  enable row level security;
alter table b2b_order_events enable row level security;
alter table b2b_quotes       enable row level security;
alter table b2b_quote_items  enable row level security;
alter table b2b_audit_log    enable row level security;

drop policy if exists company_read on b2b_companies;
create policy company_read on b2b_companies for select using (id = current_company_id());

drop policy if exists profile_self on b2b_profiles;
create policy profile_self on b2b_profiles for select using (user_id = auth.uid());
drop policy if exists profile_self_insert on b2b_profiles;
create policy profile_self_insert on b2b_profiles for insert with check (user_id = auth.uid());
drop policy if exists profile_self_update on b2b_profiles;
create policy profile_self_update on b2b_profiles for update using (user_id = auth.uid());

drop policy if exists orders_read on b2b_orders;
create policy orders_read on b2b_orders for select using (company_id = current_company_id());
drop policy if exists orders_insert on b2b_orders;
create policy orders_insert on b2b_orders for insert with check (company_id = current_company_id());
drop policy if exists orders_update on b2b_orders;
create policy orders_update on b2b_orders for update using (company_id = current_company_id());

drop policy if exists items_read on b2b_order_items;
create policy items_read on b2b_order_items for select
  using (exists (select 1 from b2b_orders o where o.id = order_id and o.company_id = current_company_id()));
drop policy if exists items_insert on b2b_order_items;
create policy items_insert on b2b_order_items for insert
  with check (exists (select 1 from b2b_orders o where o.id = order_id and o.company_id = current_company_id()));

drop policy if exists events_read on b2b_order_events;
create policy events_read on b2b_order_events for select
  using (exists (select 1 from b2b_orders o where o.id = order_id and o.company_id = current_company_id()));

drop policy if exists quotes_read on b2b_quotes;
create policy quotes_read on b2b_quotes for select using (company_id = current_company_id());
drop policy if exists quotes_update on b2b_quotes;
create policy quotes_update on b2b_quotes for update using (company_id = current_company_id());
drop policy if exists quote_items_read on b2b_quote_items;
create policy quote_items_read on b2b_quote_items for select
  using (exists (select 1 from b2b_quotes q where q.id = quote_id and q.company_id = current_company_id()));

drop policy if exists audit_read on b2b_audit_log;
create policy audit_read on b2b_audit_log for select using (company_id = current_company_id());

-- --- Triggers: updated_at, status history capture --------------------------
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on b2b_profiles;
create trigger trg_profiles_updated before update on b2b_profiles
  for each row execute function set_updated_at();
drop trigger if exists trg_orders_updated on b2b_orders;
create trigger trg_orders_updated before update on b2b_orders
  for each row execute function set_updated_at();

create or replace function log_order_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into b2b_order_events(order_id, status, note, actor)
      values (new.id, new.status, 'Bestellung eingegangen.', new.created_by);
  elsif new.status is distinct from old.status then
    insert into b2b_order_events(order_id, status, actor)
      values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_order_status on b2b_orders;
create trigger trg_order_status after insert or update on b2b_orders
  for each row execute function log_order_status();

-- ===========================================================================
-- Next: run 004_seed.sql. Auth settings (password policy, disable public
-- signup, MFA, backups) are configured in the dashboard — see SECURITY.md.
-- ===========================================================================
