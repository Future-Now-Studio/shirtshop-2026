-- Product reviews. Anyone may submit (unapproved); only approved reviews are
-- publicly visible; admin moderates. Idempotent.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  name        text not null,
  text        text not null,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_id_idx on public.reviews (product_id);

alter table public.reviews enable row level security;

drop policy if exists "anon read approved reviews" on public.reviews;
create policy "anon read approved reviews" on public.reviews
  for select to anon using (approved = true);

drop policy if exists "anon insert review" on public.reviews;
create policy "anon insert review" on public.reviews
  for insert to anon with check (approved = false);

drop policy if exists "admin all reviews" on public.reviews;
create policy "admin all reviews" on public.reviews
  for all to authenticated using (true) with check (true);
