-- Bucket for customer design media (composite previews, design-only layers,
-- and each individual element exported separately). Customers upload while not
-- logged in (anon insert); the admin reads via signed URLs.
insert into storage.buckets (id, name, public)
  values ('order-designs', 'order-designs', false)
  on conflict (id) do nothing;

create policy "anon upload order-designs" on storage.objects
  for insert to anon
  with check (bucket_id = 'order-designs');

create policy "admin read order-designs" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-designs');
