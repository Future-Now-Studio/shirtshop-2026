-- ===========================================================================
-- Ballina B2B · Back-office (admin) — real Supabase access
-- Run AFTER 003_platform.sql + 004_seed.sql.
--
-- An ADMIN is an authenticated user listed in b2b_admins. Admin access is granted
-- via RLS (is_admin()), so the back-office uses the normal anon key + the admin's
-- own JWT — the service_role key never touches the browser.
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- Inquiries (Großanfragen) ----------------------------------------------
create table if not exists b2b_inquiries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references b2b_companies(id) on delete set null,
  contact_person text,
  email         text,
  product_type  text not null,
  quantity      integer,
  deadline      date,
  message       text,
  status        text not null default 'neu'
                check (status in ('neu','in_bearbeitung','angebot_gesendet','abgeschlossen')),
  created_at    timestamptz not null default now()
);

-- --- Admins -----------------------------------------------------------------
create table if not exists b2b_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);
alter table b2b_admins enable row level security;
drop policy if exists admin_self on b2b_admins;
create policy admin_self on b2b_admins for select using (user_id = auth.uid());

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from b2b_admins where user_id = auth.uid())
$$;

-- --- Admin RLS: full access across all companies ---------------------------
alter table b2b_inquiries enable row level security;

-- customers may read/insert their own inquiries; admins do everything.
drop policy if exists inq_own_read on b2b_inquiries;
create policy inq_own_read on b2b_inquiries for select using (company_id = current_company_id());
drop policy if exists inq_own_insert on b2b_inquiries;
create policy inq_own_insert on b2b_inquiries for insert with check (company_id = current_company_id());

do $$
declare t text;
begin
  foreach t in array array[
    'b2b_companies','b2b_profiles','b2b_orders','b2b_order_items','b2b_order_events',
    'b2b_quotes','b2b_quote_items','b2b_audit_log','b2b_inquiries'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format(
      'create policy %I on %I for all using (is_admin()) with check (is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- --- Seed the demo admin account -------------------------------------------
do $$
declare uid uuid;
begin
  uid := seed_auth_user('admin@ballina.de', 'Ballina-Admin2026!');
  insert into b2b_admins (user_id, email) values (uid, 'admin@ballina.de')
  on conflict (user_id) do nothing;
end $$;

-- ===========================================================================
-- Verify:  select email from auth.users;  select is_admin();  (as that user)
-- ===========================================================================
