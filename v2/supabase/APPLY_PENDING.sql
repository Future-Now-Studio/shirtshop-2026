-- ShirtShop v2 — offene Migrationen (90–93) in einem Block.
-- Im Supabase Dashboard → SQL Editor einfügen und "Run".
-- Idempotent: kann gefahrlos mehrfach ausgeführt werden.

-- 90: Kontakt + Newsletter -----------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  message     text not null,
  handled     boolean not null default false
);

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique
);

alter table public.contact_messages       enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "anon insert contact" on public.contact_messages;
create policy "anon insert contact" on public.contact_messages
  for insert to anon with check (true);

drop policy if exists "anon insert newsletter" on public.newsletter_subscribers;
create policy "anon insert newsletter" on public.newsletter_subscribers
  for insert to anon with check (true);

drop policy if exists "admin all contact" on public.contact_messages;
create policy "admin all contact" on public.contact_messages
  for all to authenticated using (true) with check (true);

drop policy if exists "admin all newsletter" on public.newsletter_subscribers;
create policy "admin all newsletter" on public.newsletter_subscribers
  for all to authenticated using (true) with check (true);

-- 91: Admin darf design-renders lesen ------------------------------------
drop policy if exists "admin read design-renders" on storage.objects;
create policy "admin read design-renders" on storage.objects
  for select to authenticated
  using (bucket_id = 'design-renders');

-- 92: order-designs Bucket (Design-Medien) -------------------------------
insert into storage.buckets (id, name, public)
  values ('order-designs', 'order-designs', false)
  on conflict (id) do nothing;

drop policy if exists "anon upload order-designs" on storage.objects;
create policy "anon upload order-designs" on storage.objects
  for insert to anon
  with check (bucket_id = 'order-designs');

drop policy if exists "admin read order-designs" on storage.objects;
create policy "admin read order-designs" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-designs');

-- 93: Hex pro Variante (Farbfix) -----------------------------------------
alter table public.variants add column if not exists hex text;
