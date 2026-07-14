-- ============================================================================
-- ShirtShop v2 — COMPLETE idempotent setup (schema + RLS + storage + features).
-- Safe to run on a fresh database OR one where parts already ran. Re-runnable.
-- Paste into Supabase → SQL Editor → Run.
-- ============================================================================

-- ---------- Base tables ----------
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null, hex text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null, sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null,
  description text, category text,
  base_price numeric(10,2) not null default 0,
  design_element_price numeric(10,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  excluded_from_volume_discount boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color_id uuid not null references public.colors(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, color_id)
);
alter table public.variants add column if not exists hex text;
create index if not exists variants_product_id_idx on public.variants (product_id);

create table if not exists public.variant_images (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  view text not null check (view in ('front','back','left','right')),
  storage_path text not null, sort_order integer not null default 0,
  unique (variant_id, view)
);
create index if not exists variant_images_variant_id_idx on public.variant_images (variant_id);

create table if not exists public.product_sizes (
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid not null references public.sizes(id) on delete restrict,
  primary key (product_id, size_id)
);

create table if not exists public.variant_size_availability (
  variant_id uuid not null references public.variants(id) on delete cascade,
  size_id uuid not null references public.sizes(id) on delete restrict,
  available boolean not null default true,
  stock integer not null default 0,
  primary key (variant_id, size_id)
);

create table if not exists public.print_zones (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  view text not null check (view in ('front','back','left','right')),
  x numeric not null check (x >= 0 and x <= 1),
  y numeric not null check (y >= 0 and y <= 1),
  width numeric not null check (width > 0 and width <= 1),
  height numeric not null check (height > 0 and height <= 1),
  label text, sort_order integer not null default 0
);
create index if not exists print_zones_product_id_idx on public.print_zones (product_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  customer_name text, customer_email text, customer_address jsonb,
  total numeric(10,2), stripe_payment_intent_id text,
  email_sent boolean not null default false
);
-- order workflow + coupon fields
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists shipped_at      timestamptz;
alter table public.orders add column if not exists coupon_code     text;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add  constraint orders_status_check
  check (status in ('pending','paid','in_production','shipped','completed','cancelled','refunded'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.variants(id) on delete set null,
  size_id uuid references public.sizes(id) on delete set null,
  qty integer not null check (qty > 0),
  unit_price numeric(10,2) not null,
  design_data jsonb, design_render_paths text[]
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

create table if not exists public.volume_discounts (
  id uuid primary key default gen_random_uuid(),
  min_qty integer not null check (min_qty > 0),
  discount_percent numeric(5,2) not null check (discount_percent >= 0 and discount_percent <= 100)
);

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  design_element_price numeric(10,2) not null default 10.00,
  order_email text,
  updated_at timestamptz not null default now()
);
alter table public.settings add column if not exists shipping_flat           numeric(10,2) not null default 4.90;
alter table public.settings add column if not exists free_shipping_threshold numeric(10,2) not null default 50.00;
alter table public.settings add column if not exists vat_rate                numeric(5,4)  not null default 0.19;
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null, email text not null, message text not null,
  handled boolean not null default false
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique
);

-- ---------- Feature tables ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent','fixed')),
  value numeric(10,2) not null check (value >= 0),
  min_order numeric(10,2) not null default 0,
  max_uses integer, used_count integer not null default 0,
  active boolean not null default true,
  valid_from timestamptz, valid_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bulk_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'neu'
    check (status in ('neu','in_bearbeitung','angebot_gesendet','abgeschlossen')),
  filiale text, textil_art text, qualitaet text, druckverfahren text,
  stueckzahl text, anrede text, vorname text, nachname text,
  email text not null, telefon text, firma text, bemerkungen text, motiv_path text
);

-- ---------- Enable RLS ----------
do $$ declare t text; begin
  foreach t in array array[
    'colors','sizes','products','variants','variant_images','product_sizes',
    'variant_size_availability','print_zones','orders','order_items',
    'volume_discounts','settings','contact_messages','newsletter_subscribers',
    'coupons','bulk_inquiries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Anon read: global reference data ----------
drop policy if exists "anon read colors"    on public.colors;
create policy "anon read colors"    on public.colors           for select to anon using (true);
drop policy if exists "anon read sizes"     on public.sizes;
create policy "anon read sizes"     on public.sizes            for select to anon using (true);
drop policy if exists "anon read discounts" on public.volume_discounts;
create policy "anon read discounts" on public.volume_discounts for select to anon using (true);

-- ---------- Anon read: published catalog ----------
drop policy if exists "anon read published products" on public.products;
create policy "anon read published products" on public.products
  for select to anon using (status = 'published');

drop policy if exists "anon read variants of published" on public.variants;
create policy "anon read variants of published" on public.variants
  for select to anon using (exists (select 1 from public.products p
    where p.id = variants.product_id and p.status = 'published'));

drop policy if exists "anon read images of published" on public.variant_images;
create policy "anon read images of published" on public.variant_images
  for select to anon using (exists (select 1 from public.variants v
    join public.products p on p.id = v.product_id
    where v.id = variant_images.variant_id and p.status = 'published'));

drop policy if exists "anon read product_sizes of published" on public.product_sizes;
create policy "anon read product_sizes of published" on public.product_sizes
  for select to anon using (exists (select 1 from public.products p
    where p.id = product_sizes.product_id and p.status = 'published'));

drop policy if exists "anon read availability of published" on public.variant_size_availability;
create policy "anon read availability of published" on public.variant_size_availability
  for select to anon using (exists (select 1 from public.variants v
    join public.products p on p.id = v.product_id
    where v.id = variant_size_availability.variant_id and p.status = 'published'));

drop policy if exists "anon read zones of published" on public.print_zones;
create policy "anon read zones of published" on public.print_zones
  for select to anon using (exists (select 1 from public.products p
    where p.id = print_zones.product_id and p.status = 'published'));

-- ---------- Anon insert: public forms ----------
drop policy if exists "anon insert contact" on public.contact_messages;
create policy "anon insert contact" on public.contact_messages
  for insert to anon with check (true);
drop policy if exists "anon insert newsletter" on public.newsletter_subscribers;
create policy "anon insert newsletter" on public.newsletter_subscribers
  for insert to anon with check (true);
drop policy if exists "anon insert bulk_inquiries" on public.bulk_inquiries;
create policy "anon insert bulk_inquiries" on public.bulk_inquiries
  for insert to anon with check (true);

-- settings has NO anon policy (order_email must not leak).
drop policy if exists "anon read settings" on public.settings;

-- ---------- Admin (authenticated): full access everywhere ----------
do $$ declare t text; begin
  foreach t in array array[
    'colors','sizes','products','variants','variant_images','product_sizes',
    'variant_size_availability','print_zones','orders','order_items',
    'volume_discounts','settings','contact_messages','newsletter_subscribers',
    'coupons','bulk_inquiries'
  ] loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public) values
  ('product-images','product-images',true),
  ('design-renders','design-renders',false),
  ('order-designs','order-designs',false)
  on conflict (id) do nothing;

drop policy if exists "public read product-images"   on storage.objects;
create policy "public read product-images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');
drop policy if exists "admin write product-images"   on storage.objects;
create policy "admin write product-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');
drop policy if exists "admin update product-images"  on storage.objects;
create policy "admin update product-images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');
drop policy if exists "admin delete product-images"  on storage.objects;
create policy "admin delete product-images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

drop policy if exists "admin read design-renders" on storage.objects;
create policy "admin read design-renders" on storage.objects
  for select to authenticated using (bucket_id = 'design-renders');

drop policy if exists "anon upload order-designs" on storage.objects;
create policy "anon upload order-designs" on storage.objects
  for insert to anon with check (bucket_id = 'order-designs');
drop policy if exists "admin read order-designs" on storage.objects;
create policy "admin read order-designs" on storage.objects
  for select to authenticated using (bucket_id = 'order-designs');
