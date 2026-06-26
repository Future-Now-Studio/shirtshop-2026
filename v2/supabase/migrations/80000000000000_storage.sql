insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('design-renders', 'design-renders', false)
  on conflict (id) do nothing;

create policy "public read product-images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "admin write product-images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "admin update product-images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images');

create policy "admin delete product-images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images');

-- design-renders: no anon/authenticated policies → service role only.
