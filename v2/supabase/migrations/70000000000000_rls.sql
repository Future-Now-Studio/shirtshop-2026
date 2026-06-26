-- Enable RLS everywhere
alter table public.colors                     enable row level security;
alter table public.sizes                      enable row level security;
alter table public.products                   enable row level security;
alter table public.variants                   enable row level security;
alter table public.variant_images             enable row level security;
alter table public.product_sizes              enable row level security;
alter table public.variant_size_availability  enable row level security;
alter table public.print_zones                enable row level security;
alter table public.orders                     enable row level security;
alter table public.order_items                enable row level security;
alter table public.volume_discounts           enable row level security;
alter table public.settings                   enable row level security;

-- Global reference data: anon may read.
create policy "anon read colors"    on public.colors            for select to anon using (true);
create policy "anon read sizes"     on public.sizes             for select to anon using (true);
create policy "anon read discounts" on public.volume_discounts  for select to anon using (true);
create policy "anon read settings"  on public.settings          for select to anon using (true);

-- Products: anon reads published only.
create policy "anon read published products" on public.products
  for select to anon using (status = 'published');

-- Child tables: anon reads rows whose parent product is published.
create policy "anon read variants of published" on public.variants
  for select to anon using (
    exists (select 1 from public.products p
            where p.id = variants.product_id and p.status = 'published')
  );

create policy "anon read images of published" on public.variant_images
  for select to anon using (
    exists (select 1 from public.variants v
            join public.products p on p.id = v.product_id
            where v.id = variant_images.variant_id and p.status = 'published')
  );

create policy "anon read product_sizes of published" on public.product_sizes
  for select to anon using (
    exists (select 1 from public.products p
            where p.id = product_sizes.product_id and p.status = 'published')
  );

create policy "anon read availability of published" on public.variant_size_availability
  for select to anon using (
    exists (select 1 from public.variants v
            join public.products p on p.id = v.product_id
            where v.id = variant_size_availability.variant_id and p.status = 'published')
  );

create policy "anon read zones of published" on public.print_zones
  for select to anon using (
    exists (select 1 from public.products p
            where p.id = print_zones.product_id and p.status = 'published')
  );

-- Authenticated admin: full access to every table.
do $$
declare t text;
begin
  foreach t in array array[
    'colors','sizes','products','variants','variant_images','product_sizes',
    'variant_size_availability','print_zones','orders','order_items',
    'volume_discounts','settings'
  ]
  loop
    execute format(
      'create policy "admin all %1$s" on public.%1$s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
