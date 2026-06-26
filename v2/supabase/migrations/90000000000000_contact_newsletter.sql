-- Public contact form + newsletter signup.
-- Anyone (anon) may INSERT; only the authenticated admin may read/manage.

create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  message     text not null,
  handled     boolean not null default false
);

create table public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique
);

alter table public.contact_messages       enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Anyone may submit.
create policy "anon insert contact" on public.contact_messages
  for insert to anon with check (true);
create policy "anon insert newsletter" on public.newsletter_subscribers
  for insert to anon with check (true);

-- Admin (authenticated) full access.
create policy "admin all contact" on public.contact_messages
  for all to authenticated using (true) with check (true);
create policy "admin all newsletter" on public.newsletter_subscribers
  for all to authenticated using (true) with check (true);
